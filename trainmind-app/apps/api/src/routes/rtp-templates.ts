/**
 * Libreria dei protocolli RTP.
 *
 * Endpoints (tutti sotto /api/v1):
 *   GET    /rtp-templates                 elenco: di sistema + dell'organizzazione
 *   GET    /rtp-templates/match           quale protocollo verrebbe scelto, e perche'
 *   GET    /rtp-templates/:id             dettaglio con fasi e criteri
 *   POST   /rtp-templates                 nuovo protocollo dell'organizzazione
 *   POST   /rtp-templates/:id/duplicate   copia (e' il modo per partire da uno di sistema)
 *   PUT    /rtp-templates/:id             modifica (solo i propri)
 *   DELETE /rtp-templates/:id             elimina (solo i propri)
 *
 * I template di sistema sono in sola lettura: il seed li riallinea a ogni
 * deploy, quindi una modifica fatta sopra andrebbe persa senza dirlo a
 * nessuno. Per cambiarli si duplica.
 *
 * Le modifiche a un template NON toccano i protocolli gia' avviati: all'avvio
 * fasi e criteri vengono copiati sull'atleta. Un criterio corretto a meta'
 * stagione non deve cambiare le regole del rientro a chi e' gia' in cura.
 */

import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireMinRole } from '../middleware/rbac.js';
import { RTP_BODY_ZONES, RTP_BODY_REGIONS, RTP_COMPARATORS, rtpBaseZone, rtpRegionOf } from '@trainmind/types';
import { pickRtpTemplate, rtpEstimatedReturn } from '@trainmind/utils';

const INJURY_TYPES = ['muscular', 'tendon', 'ligament', 'bone', 'joint'] as const;

const criterionSchema = z.object({
  order: z.number().int().min(1).max(50),
  description: z.string().min(1).max(300),
  testCode: z.string().max(80).nullish(),
  comparator: z.enum(RTP_COMPARATORS).nullish(),
  targetValue: z.number().finite().nullish(),
  unit: z.string().max(24).nullish(),
  mandatory: z.boolean(),
});

const phaseSchema = z.object({
  order: z.number().int().min(1).max(6),
  name: z.string().min(1).max(120),
  goal: z.string().max(300).nullish(),
  minDays: z.number().int().min(0).max(400).nullish(),
  typicalDays: z.number().int().min(0).max(400).nullish(),
  criteria: z.array(criterionSchema).min(1).max(20),
});

const templateSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(1000).nullish(),
  bodyZone: z.enum(RTP_BODY_ZONES).nullish(),
  bodyRegion: z.enum(RTP_BODY_REGIONS).nullish(),
  injuryType: z.enum(INJURY_TYPES).nullish(),
  severityMin: z.number().int().min(1).max(5).nullish(),
  severityMax: z.number().int().min(1).max(5).nullish(),
  isActive: z.boolean().optional(),
  phases: z.array(phaseSchema).min(3).max(6),
});

type TemplateInput = z.infer<typeof templateSchema>;

/** Le fasi devono essere 1..N contigue: un buco manda in crisi l'avanzamento. */
function phaseOrderProblem(input: TemplateInput): string | null {
  const orders = input.phases.map((p) => p.order).sort((a, b) => a - b);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) return `Le fasi devono essere numerate da 1 a ${orders.length} senza salti.`;
  }
  if (input.severityMin != null && input.severityMax != null && input.severityMin > input.severityMax) {
    return 'La severita\' minima non puo\' superare la massima.';
  }
  return null;
}

const FULL_INCLUDE = {
  phases: {
    orderBy: { order: 'asc' as const },
    include: { criteria: { orderBy: { order: 'asc' as const } } },
  },
};

export async function rtpTemplateRoutes(app: FastifyInstance) {
  /** Il client Prisma non conosce i template finche' non si rigenera. */
  function prismaReady(): boolean {
    const client = app.prisma as unknown as Record<string, unknown>;
    return Boolean(client.rTPTemplate && client.rTPTemplatePhase && client.rTPProtocolPhase);
  }

  function notGenerated(reply: FastifyReply) {
    app.log.error(
      'Modelli RTPTemplate assenti dal client Prisma: eseguire `pnpm db:generate` (e `pnpm db:push` o `prisma migrate deploy`) e riavviare l\'API.',
    );
    return reply.status(503).send({
      success: false,
      error: {
        code: 'PRISMA_CLIENT_OUTDATED',
        message:
          'Il client Prisma non conosce ancora i protocolli RTP. Esegui `pnpm db:generate` e `pnpm db:push` dalla radice del progetto, poi riavvia l\'API.',
      },
    });
  }

  /** Sistema + organizzazione: sono le due sole visibilita' che esistono. */
  function visibleWhere(organizationId: string) {
    return { OR: [{ organizationId: null }, { organizationId }] };
  }

  // ─── LIST ─────────────────────────────────────────────
  app.get('/rtp-templates', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!prismaReady()) return notGenerated(reply);
    const { full } = request.query as { full?: string };

    const summaryInclude = {
      phases: {
        orderBy: { order: 'asc' as const },
        select: {
          id: true, order: true, name: true, typicalDays: true,
          _count: { select: { criteria: true } },
        },
      },
    };

    const templates = await app.prisma.rTPTemplate.findMany({
      where: visibleWhere(request.user.organizationId),
      include: full === '1' ? FULL_INCLUDE : summaryInclude,
      orderBy: [{ isSystem: 'asc' }, { name: 'asc' }],
    });

    return { success: true, data: { templates } };
  });

  // ─── MATCH: quale protocollo verrebbe scelto ──────────
  app.get('/rtp-templates/match', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!prismaReady()) return notGenerated(reply);
    const q = request.query as { location?: string; injuryType?: string; severity?: string };
    const location = q.location ?? '';
    const injuryType = q.injuryType ?? '';
    const severity = Number(q.severity ?? 3);
    if (!location || !injuryType || !Number.isFinite(severity)) {
      return reply.badRequest('Servono location, injuryType e severity.');
    }

    const candidates = await app.prisma.rTPTemplate.findMany({
      where: { ...visibleWhere(request.user.organizationId), isActive: true },
      select: {
        id: true, name: true, code: true, isSystem: true, organizationId: true,
        bodyZone: true, bodyRegion: true, injuryType: true, severityMin: true, severityMax: true,
        phases: { select: { typicalDays: true } },
      },
    });

    const zone = rtpBaseZone(location);
    const region = rtpRegionOf(location);
    const picked = pickRtpTemplate(candidates, { zone, region, injuryType, severity });
    const estimated = picked ? rtpEstimatedReturn(new Date(), picked.phases) : null;

    return {
      success: true,
      data: {
        zone,
        region,
        template: picked ? { ...picked, phases: undefined, phaseCount: picked.phases.length } : null,
        estimatedReturn: estimated ? estimated.toISOString() : null,
      },
    };
  });

  // ─── DETAIL ───────────────────────────────────────────
  app.get('/rtp-templates/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!prismaReady()) return notGenerated(reply);
    const { id } = request.params as { id: string };

    const template = await app.prisma.rTPTemplate.findFirst({
      where: { id, ...visibleWhere(request.user.organizationId) },
      include: FULL_INCLUDE,
    });
    if (!template) return reply.notFound('Protocollo non trovato');

    return { success: true, data: { template } };
  });

  // ─── CREATE ───────────────────────────────────────────
  app.post('/rtp-templates', {
    preHandler: [app.authenticate, requireMinRole('MEDICAL')],
  }, async (request, reply) => {
    if (!prismaReady()) return notGenerated(reply);
    const parsed = templateSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.issues[0]?.message ?? 'Dati non validi');
    const problem = phaseOrderProblem(parsed.data);
    if (problem) return reply.badRequest(problem);

    const created = await app.prisma.rTPTemplate.create({
      data: {
        organizationId: request.user.organizationId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        bodyZone: parsed.data.bodyZone ?? null,
        bodyRegion: parsed.data.bodyRegion ?? null,
        injuryType: parsed.data.injuryType ?? null,
        severityMin: parsed.data.severityMin ?? null,
        severityMax: parsed.data.severityMax ?? null,
        isSystem: false,
        isActive: parsed.data.isActive ?? true,
        phases: {
          create: parsed.data.phases.map((p) => ({
            order: p.order,
            name: p.name,
            goal: p.goal ?? null,
            minDays: p.minDays ?? null,
            typicalDays: p.typicalDays ?? null,
            criteria: {
              create: p.criteria.map((c) => ({
                order: c.order,
                description: c.description,
                testCode: c.testCode ?? null,
                comparator: c.comparator ?? null,
                targetValue: c.targetValue ?? null,
                unit: c.unit ?? null,
                mandatory: c.mandatory,
              })),
            },
          })),
        },
      },
      include: FULL_INCLUDE,
    });

    return reply.status(201).send({ success: true, data: { template: created } });
  });

  // ─── DUPLICATE ────────────────────────────────────────
  app.post('/rtp-templates/:id/duplicate', {
    preHandler: [app.authenticate, requireMinRole('MEDICAL')],
  }, async (request, reply) => {
    if (!prismaReady()) return notGenerated(reply);
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { name?: string };

    const source = await app.prisma.rTPTemplate.findFirst({
      where: { id, ...visibleWhere(request.user.organizationId) },
      include: FULL_INCLUDE,
    });
    if (!source) return reply.notFound('Protocollo non trovato');

    const copy = await app.prisma.rTPTemplate.create({
      data: {
        organizationId: request.user.organizationId,
        name: body.name?.trim() || `${source.name} (copia)`,
        description: source.description,
        bodyZone: source.bodyZone,
        bodyRegion: source.bodyRegion,
        injuryType: source.injuryType,
        severityMin: source.severityMin,
        severityMax: source.severityMax,
        isSystem: false,
        isActive: true,
        phases: {
          create: source.phases.map((p) => ({
            order: p.order,
            name: p.name,
            goal: p.goal,
            minDays: p.minDays,
            typicalDays: p.typicalDays,
            criteria: {
              create: p.criteria.map((c) => ({
                order: c.order,
                description: c.description,
                testCode: c.testCode,
                comparator: c.comparator,
                targetValue: c.targetValue,
                unit: c.unit,
                mandatory: c.mandatory,
              })),
            },
          })),
        },
      },
      include: FULL_INCLUDE,
    });

    return reply.status(201).send({ success: true, data: { template: copy } });
  });

  // ─── UPDATE ───────────────────────────────────────────
  // Fasi e criteri si riscrivono in blocco: sono un documento, non righe con
  // vita propria, e un merge per id complicherebbe l'editor senza dare nulla.
  app.put('/rtp-templates/:id', {
    preHandler: [app.authenticate, requireMinRole('MEDICAL')],
  }, async (request, reply) => {
    if (!prismaReady()) return notGenerated(reply);
    const { id } = request.params as { id: string };
    const parsed = templateSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.issues[0]?.message ?? 'Dati non validi');
    const problem = phaseOrderProblem(parsed.data);
    if (problem) return reply.badRequest(problem);

    const existing = await app.prisma.rTPTemplate.findFirst({
      where: { id, ...visibleWhere(request.user.organizationId) },
      select: { id: true, isSystem: true },
    });
    if (!existing) return reply.notFound('Protocollo non trovato');
    if (existing.isSystem) {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'RTP_TEMPLATE_SYSTEM_READONLY',
          message: 'I protocolli di sistema non si modificano: duplicalo e lavora sulla copia.',
        },
      });
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      await tx.rTPTemplatePhase.deleteMany({ where: { templateId: id } });
      return tx.rTPTemplate.update({
        where: { id },
        data: {
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          bodyZone: parsed.data.bodyZone ?? null,
          bodyRegion: parsed.data.bodyRegion ?? null,
          injuryType: parsed.data.injuryType ?? null,
          severityMin: parsed.data.severityMin ?? null,
          severityMax: parsed.data.severityMax ?? null,
          isActive: parsed.data.isActive ?? true,
          phases: {
            create: parsed.data.phases.map((p) => ({
              order: p.order,
              name: p.name,
              goal: p.goal ?? null,
              minDays: p.minDays ?? null,
              typicalDays: p.typicalDays ?? null,
              criteria: {
                create: p.criteria.map((c) => ({
                  order: c.order,
                  description: c.description,
                  testCode: c.testCode ?? null,
                  comparator: c.comparator ?? null,
                  targetValue: c.targetValue ?? null,
                  unit: c.unit ?? null,
                  mandatory: c.mandatory,
                })),
              },
            })),
          },
        },
        include: FULL_INCLUDE,
      });
    });

    return { success: true, data: { template: updated } };
  });

  // ─── DELETE ───────────────────────────────────────────
  app.delete('/rtp-templates/:id', {
    preHandler: [app.authenticate, requireMinRole('MEDICAL')],
  }, async (request, reply) => {
    if (!prismaReady()) return notGenerated(reply);
    const { id } = request.params as { id: string };

    const existing = await app.prisma.rTPTemplate.findFirst({
      where: { id, organizationId: request.user.organizationId },
      select: { id: true, isSystem: true, _count: { select: { protocols: true } } },
    });
    if (!existing) {
      const isSystem = await app.prisma.rTPTemplate.findFirst({ where: { id, organizationId: null }, select: { id: true } });
      if (isSystem) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'RTP_TEMPLATE_SYSTEM_READONLY',
            message: 'I protocolli di sistema non si eliminano. Se non ti serve, disattivalo dalla copia.',
          },
        });
      }
      return reply.notFound('Protocollo non trovato');
    }

    // I protocolli gia' avviati restano: hanno la loro copia di fasi e criteri
    // e continuano a mostrare da dove venivano (`templateName`).
    await app.prisma.rTPTemplate.delete({ where: { id } });

    return { success: true, data: { deleted: true, detachedProtocols: existing._count.protocols } };
  });
}
