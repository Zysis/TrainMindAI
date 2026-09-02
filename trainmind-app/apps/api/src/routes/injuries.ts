/**
 * Infortuni e protocolli RTP.
 *
 * I criteri di rientro non sono piu' una lista unica hardcoded: arrivano dalla
 * libreria dei protocolli (rotte in `rtp-templates.ts`), scelta per zona del
 * corpo, tipo di infortunio e severita'. Una spalla e un ginocchio non hanno
 * gli stessi criteri, ed e' il punto di tutto questo.
 *
 * All'avvio, fasi e criteri vengono *copiati* sul protocollo dell'atleta: se
 * il template cambia a meta' stagione, chi e' gia' in cura non si ritrova le
 * regole cambiate sotto i piedi.
 */

import type { FastifyInstance } from 'fastify';
import { requireMinRole } from '../middleware/rbac.js';
import { rtpBaseZone, rtpRegionOf } from '@trainmind/types';
import { pickRtpTemplate, rtpEstimatedReturn } from '@trainmind/utils';

type PhaseName = 'PHASE_1' | 'PHASE_2' | 'PHASE_3' | 'PHASE_4' | 'PHASE_5' | 'PHASE_6';

const PHASE_BY_ORDER: PhaseName[] = ['PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4', 'PHASE_5', 'PHASE_6'];

/**
 * Protocollo storico, per i due casi in cui la libreria non risponde: un
 * database dove il seed non e' ancora passato, o un template che non copre la
 * combinazione. Meglio cinque fasi generiche che un protocollo vuoto.
 */
const FALLBACK_PHASES = [
  { order: 1, name: 'Controllo dolore', goal: null as string | null, minDays: null as number | null, typicalDays: 10 as number | null,
    criteria: ['Dolore a riposo entro 2/10', 'Range of Motion passivo recuperato oltre il 70%', 'Nessun segno di infiammazione acuta'] },
  { order: 2, name: 'Mobilita\' e forza base', goal: null, minDays: null, typicalDays: 14,
    criteria: ['Dolore nelle attivita\' quotidiane entro 2/10', 'ROM attivo completo e simmetrico', 'Forza isometrica oltre il 70% del controlaterale', 'Corsa rettilinea senza dolore'] },
  { order: 3, name: 'Sport-specifico', goal: null, minDays: null, typicalDays: 21,
    criteria: ['Corsa con cambi di direzione senza dolore', 'Forza concentrica/eccentrica oltre l\'80% del controlaterale', 'Hop test LSI oltre l\'80%', 'Drill basket non-contatto completati'] },
  { order: 4, name: 'Allenamento completo', goal: null, minDays: null, typicalDays: 14,
    criteria: ['Allenamento con contatto limitato senza dolore', 'Forza oltre il 90% del controlaterale', 'Hop test LSI oltre il 90%', 'Drill sport-specifici al 100% di intensita\''] },
  { order: 5, name: 'Return to competition', goal: null, minDays: null, typicalDays: 10,
    criteria: ['Allenamento completo con la squadra (2+ sessioni)', 'Nessun versamento post-allenamento', 'Questionario psicologico RTP positivo', 'Clearance medica firmata'] },
];

/** Ordine delle fasi del singolo protocollo, con CLEARED in coda. */
function phaseSequence(phases: Array<{ phase: string; order: number }>): string[] {
  const ordered = [...phases].sort((a, b) => a.order - b.order).map((p) => p.phase);
  if (!ordered.length) return [...PHASE_BY_ORDER.slice(0, 5), 'CLEARED'];
  return [...ordered, 'CLEARED'];
}

const PROTOCOL_INCLUDE = {
  injury: true,
  // Il `code` del template di sistema e' la chiave con cui il frontend traduce
  // fasi e criteri: le righe copiate nel protocollo restano in italiano.
  template: { select: { code: true } },
  athlete: { select: { id: true, firstName: true, lastName: true, position: true, photoUrl: true } },
  phases: { orderBy: { order: 'asc' as const } },
  criteria: { orderBy: [{ phase: 'asc' as const }, { order: 'asc' as const }, { createdAt: 'asc' as const }] },
  phaseLogs: {
    orderBy: { createdAt: 'desc' as const },
    include: { changedBy: { select: { firstName: true, lastName: true } } },
  },
};

export async function injuryRoutes(app: FastifyInstance) {
  /**
   * Il protocollo da usare per questo infortunio.
   *
   * Se il client Prisma non conosce ancora i template (deploy senza
   * `db:generate`) si torna null e il chiamante usa il protocollo storico:
   * meglio un RTP generico che un errore in faccia al medico.
   */
  async function resolveTemplate(
    organizationId: string,
    injury: { location: string; type: string; severity: number },
    templateId?: string,
  ) {
    const client = app.prisma as unknown as Record<string, unknown>;
    if (!client.rTPTemplate) return null;

    const include = {
      phases: {
        orderBy: { order: 'asc' as const },
        include: { criteria: { orderBy: { order: 'asc' as const } } },
      },
    };
    const visible = { OR: [{ organizationId: null }, { organizationId }] };

    if (templateId) {
      return app.prisma.rTPTemplate.findFirst({ where: { id: templateId, ...visible }, include });
    }

    const candidates = await app.prisma.rTPTemplate.findMany({
      where: { ...visible, isActive: true },
      include,
    });
    if (!candidates.length) return null;

    return pickRtpTemplate(candidates, {
      zone: rtpBaseZone(injury.location),
      region: rtpRegionOf(injury.location),
      injuryType: injury.type,
      severity: injury.severity,
    });
  }

  // ─── LIST injuries for an athlete ──────────────────────
  app.get('/athletes/:athleteId/injuries', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { athleteId } = request.params as { athleteId: string };

    // Verify athlete belongs to user's org
    const athlete = await app.prisma.athlete.findFirst({
      where: { id: athleteId, organizationId: request.user.organizationId },
    });
    if (!athlete) return reply.notFound('Atleta non trovato');

    const injuries = await app.prisma.injury.findMany({
      where: { athleteId },
      include: {
        rtpProtocols: {
          include: {
            _count: { select: { phaseLogs: true, criteria: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { dateOccurred: 'desc' },
    });

    return { success: true, data: { injuries } };
  });

  // ─── CREATE injury ─────────────────────────────────────
  app.post('/athletes/:athleteId/injuries', {
    preHandler: [app.authenticate, requireMinRole('MEDICAL')],
  }, async (request, reply) => {
    const { athleteId } = request.params as { athleteId: string };
    const body = request.body as {
      type: string;
      onset?: string;
      location: string;
      severity: number;
      dateOccurred: string;
      notes?: string;
    };

    const athlete = await app.prisma.athlete.findFirst({
      where: { id: athleteId, organizationId: request.user.organizationId },
    });
    if (!athlete) return reply.notFound('Atleta non trovato');

    const injury = await app.prisma.injury.create({
      data: {
        athleteId,
        type: body.type,
        onset: body.onset || null,
        location: body.location,
        severity: Math.min(5, Math.max(1, body.severity)),
        dateOccurred: new Date(body.dateOccurred),
        notes: body.notes,
      },
    });

    return reply.status(201).send({ success: true, data: { injury } });
  });

  // ─── UPDATE injury ─────────────────────────────────────
  app.patch('/injuries/:id', {
    preHandler: [app.authenticate, requireMinRole('MEDICAL')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      type?: string;
      onset?: string;
      location?: string;
      severity?: number;
      status?: 'ACTIVE' | 'RECOVERING' | 'RESOLVED';
      dateResolved?: string;
      notes?: string;
    };

    const injury = await app.prisma.injury.findFirst({
      where: { id, athlete: { organizationId: request.user.organizationId } },
    });
    if (!injury) return reply.notFound('Infortunio non trovato');

    const updated = await app.prisma.injury.update({
      where: { id },
      data: {
        ...(body.type && { type: body.type }),
        ...(body.onset !== undefined && { onset: body.onset || null }),
        ...(body.location && { location: body.location }),
        ...(body.severity && { severity: Math.min(5, Math.max(1, body.severity)) }),
        ...(body.status && { status: body.status }),
        ...(body.dateResolved && { dateResolved: new Date(body.dateResolved) }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    });

    return { success: true, data: { injury: updated } };
  });

  // ─── DELETE injury ─────────────────────────────────────
  app.delete('/injuries/:id', {
    preHandler: [app.authenticate, requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const injury = await app.prisma.injury.findFirst({
      where: { id, athlete: { organizationId: request.user.organizationId } },
    });
    if (!injury) return reply.notFound('Infortunio non trovato');

    await app.prisma.injury.delete({ where: { id } });
    return { success: true };
  });

  // ─── CREATE RTP Protocol for an injury ─────────────────
  //
  // Il protocollo si sceglie da solo in base a zona, tipo e severita';
  // `templateId` serve solo quando il medico ne vuole un altro. Fasi e criteri
  // vengono copiati: da qui in avanti il protocollo dell'atleta e' suo.
  app.post('/injuries/:injuryId/rtp', {
    preHandler: [app.authenticate, requireMinRole('MEDICAL')],
  }, async (request, reply) => {
    const { injuryId } = request.params as { injuryId: string };
    const body = (request.body ?? {}) as {
      targetDate?: string;
      notes?: string;
      templateId?: string;
      autoCreateCriteria?: boolean;
    };

    const injury = await app.prisma.injury.findFirst({
      where: { id: injuryId, athlete: { organizationId: request.user.organizationId } },
      include: { athlete: true },
    });
    if (!injury) return reply.notFound('Infortunio non trovato');

    const withCriteria = body.autoCreateCriteria !== false;
    const template = withCriteria
      ? await resolveTemplate(request.user.organizationId, injury, body.templateId)
      : null;
    if (body.templateId && !template) return reply.notFound('Protocollo non trovato');

    const phases = template
      ? template.phases.map((p) => ({
          order: p.order,
          name: p.name,
          goal: p.goal,
          minDays: p.minDays,
          typicalDays: p.typicalDays,
          criteria: p.criteria,
        }))
      : withCriteria
        ? FALLBACK_PHASES.map((p) => ({
            ...p,
            criteria: p.criteria.map((description, i) => ({
              order: i + 1, description, testCode: null, comparator: null,
              targetValue: null, unit: null, mandatory: true,
            })),
          }))
        : [];

    const startDate = new Date();
    const estimated = phases.length ? rtpEstimatedReturn(startDate, phases) : null;

    await app.prisma.injury.update({
      where: { id: injuryId },
      data: { status: 'RECOVERING' },
    });

    const protocol = await app.prisma.rTPProtocol.create({
      data: {
        injuryId,
        athleteId: injury.athleteId,
        startDate,
        // La data scritta a mano vince sempre sulla stima del protocollo.
        targetDate: body.targetDate ? new Date(body.targetDate) : estimated,
        notes: body.notes,
        templateId: template?.id ?? null,
        templateName: template?.name ?? null,
        phases: {
          create: phases.map((ph) => ({
            phase: PHASE_BY_ORDER[ph.order - 1],
            order: ph.order,
            name: ph.name,
            goal: ph.goal ?? null,
            minDays: ph.minDays ?? null,
            typicalDays: ph.typicalDays ?? null,
            startedAt: ph.order === 1 ? startDate : null,
          })),
        },
        criteria: {
          create: phases.flatMap((ph) =>
            ph.criteria.map((c) => ({
              phase: PHASE_BY_ORDER[ph.order - 1],
              order: c.order,
              description: c.description,
              testCode: c.testCode ?? null,
              comparator: c.comparator ?? null,
              targetValue: c.targetValue ?? null,
              unit: c.unit ?? null,
              mandatory: c.mandatory,
            })),
          ),
        },
      },
    });

    await app.prisma.rTPPhaseLog.create({
      data: {
        rtpProtocolId: protocol.id,
        fromPhase: 'PHASE_1',
        toPhase: 'PHASE_1',
        changedById: request.user.id,
        reason: template ? `Protocollo RTP avviato — ${template.name}` : 'Protocollo RTP avviato',
      },
    });

    const full = await app.prisma.rTPProtocol.findUnique({
      where: { id: protocol.id },
      include: PROTOCOL_INCLUDE,
    });

    return reply.status(201).send({ success: true, data: { protocol: full } });
  });

  // ─── GET RTP Protocol detail ───────────────────────────
  app.get('/rtp/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const protocol = await app.prisma.rTPProtocol.findFirst({
      where: { id, athlete: { organizationId: request.user.organizationId } },
      include: PROTOCOL_INCLUDE,
    });
    if (!protocol) return reply.notFound('Protocollo RTP non trovato');

    return { success: true, data: { protocol } };
  });

  // ─── LIST all active RTP protocols (org-wide) ──────────
  app.get('/rtp', {
    preHandler: [app.authenticate],
  }, async (request, _reply) => {
    const protocols = await app.prisma.rTPProtocol.findMany({
      where: {
        athlete: { organizationId: request.user.organizationId },
        currentPhase: { not: 'CLEARED' },
      },
      include: {
        injury: { select: { type: true, location: true, severity: true, dateOccurred: true } },
        athlete: { select: { id: true, firstName: true, lastName: true, position: true, photoUrl: true } },
        phases: { orderBy: { order: 'asc' }, select: { phase: true, order: true, name: true } },
        template: { select: { code: true } },
        _count: { select: { criteria: true, phaseLogs: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return { success: true, data: { protocols } };
  });

  // ─── ADVANCE / REVERT RTP phase ───────────────────────
  //
  // L'ordine delle fasi e' quello del protocollo, non piu' una costante: un
  // protocollo puo' averne 3 come 6. A bloccare l'avanzamento sono solo i
  // criteri obbligatori; quelli facoltativi vengono riportati come avvisi,
  // perche' "consigliato" e "necessario" non sono la stessa cosa.
  app.post('/rtp/:id/advance', {
    preHandler: [app.authenticate, requireMinRole('MEDICAL')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { targetPhase: string; reason?: string; force?: boolean };

    const protocol = await app.prisma.rTPProtocol.findFirst({
      where: { id, athlete: { organizationId: request.user.organizationId } },
      include: { criteria: true, phases: { orderBy: { order: 'asc' } } },
    });
    if (!protocol) return reply.notFound('Protocollo RTP non trovato');

    const sequence = phaseSequence(protocol.phases);
    const currentIdx = sequence.indexOf(protocol.currentPhase);
    const targetIdx = sequence.indexOf(body.targetPhase);
    if (targetIdx < 0) return reply.badRequest('Fase non valida per questo protocollo');

    const advancing = targetIdx > currentIdx;
    const openCriteria = protocol.criteria.filter((c) => c.phase === protocol.currentPhase && !c.isMet);
    const blocking = openCriteria.filter((c) => c.mandatory);
    const advisory = openCriteria.filter((c) => !c.mandatory);

    if (advancing && !body.force && blocking.length > 0) {
      return reply.status(422).send({
        success: false,
        error: {
          code: 'CRITERIA_NOT_MET',
          message: `${blocking.length} criteri obbligatori non soddisfatti per la fase corrente`,
          unmetCriteria: blocking.map((c) => ({ id: c.id, description: c.description })),
          advisoryCriteria: advisory.map((c) => ({ id: c.id, description: c.description })),
        },
      });
    }

    const now = new Date();
    await app.prisma.rTPProtocol.update({
      where: { id },
      data: { currentPhase: body.targetPhase as never },
    });

    // Timbri sulle fasi: quella lasciata si chiude, quella in cui si entra si
    // apre. Tornando indietro si riapre la fase di destinazione e si annulla
    // la chiusura di quelle successive, altrimenti lo storico direbbe che una
    // fase e' stata completata due volte.
    const entered = protocol.phases.find((ph) => ph.phase === body.targetPhase);
    if (advancing) {
      const left = protocol.phases.find((ph) => ph.phase === protocol.currentPhase);
      if (left && !left.completedAt) {
        await app.prisma.rTPProtocolPhase.update({ where: { id: left.id }, data: { completedAt: now } });
      }
      if (entered && !entered.startedAt) {
        await app.prisma.rTPProtocolPhase.update({ where: { id: entered.id }, data: { startedAt: now } });
      }
    } else if (targetIdx < currentIdx) {
      const reopened = protocol.phases.filter((ph) => sequence.indexOf(ph.phase) >= targetIdx);
      if (reopened.length) {
        await app.prisma.rTPProtocolPhase.updateMany({
          where: { id: { in: reopened.map((ph) => ph.id) } },
          data: { completedAt: null },
        });
      }
    }

    await app.prisma.rTPPhaseLog.create({
      data: {
        rtpProtocolId: id,
        fromPhase: protocol.currentPhase,
        toPhase: body.targetPhase as never,
        changedById: request.user.id,
        reason: body.reason,
      },
    });

    if (body.targetPhase === 'CLEARED') {
      await app.prisma.injury.update({
        where: { id: protocol.injuryId },
        data: { status: 'RESOLVED', dateResolved: now },
      });
    } else if (protocol.currentPhase === 'CLEARED') {
      // Si torna indietro da un rientro gia' dato: l'infortunio riapre.
      await app.prisma.injury.update({
        where: { id: protocol.injuryId },
        data: { status: 'RECOVERING', dateResolved: null },
      });
    }

    const updated = await app.prisma.rTPProtocol.findUnique({
      where: { id },
      include: PROTOCOL_INCLUDE,
    });

    return { success: true, data: { protocol: updated, forced: Boolean(body.force && blocking.length) } };
  });

  // ─── TOGGLE clearance criterion ────────────────────────
  // `measuredValue` accompagna la spunta: la soglia non spunta il criterio da
  // sola (a decidere resta il medico) ma il valore misurato resta scritto
  // accanto, cosi' fra sei mesi si sa su cosa era stata presa la decisione.
  app.patch('/rtp/criteria/:criterionId', {
    preHandler: [app.authenticate, requireMinRole('MEDICAL')],
  }, async (request, reply) => {
    const { criterionId } = request.params as { criterionId: string };
    const body = request.body as { isMet?: boolean; notes?: string; measuredValue?: number | null };

    const criterion = await app.prisma.clearanceCriteria.findFirst({
      where: {
        id: criterionId,
        rtpProtocol: { athlete: { organizationId: request.user.organizationId } },
      },
    });
    if (!criterion) return reply.notFound('Criterio non trovato');

    const isMet = body.isMet ?? criterion.isMet;
    const updated = await app.prisma.clearanceCriteria.update({
      where: { id: criterionId },
      data: {
        isMet,
        metAt: isMet ? criterion.metAt ?? new Date() : null,
        metById: isMet ? criterion.metById ?? request.user.id : null,
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.measuredValue !== undefined && { measuredValue: body.measuredValue }),
      },
    });

    return { success: true, data: { criterion: updated } };
  });

  // ─── ADD custom clearance criterion ────────────────────
  app.post('/rtp/:id/criteria', {
    preHandler: [app.authenticate, requireMinRole('MEDICAL')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      phase: string;
      description: string;
      testCode?: string | null;
      comparator?: string | null;
      targetValue?: number | null;
      unit?: string | null;
      mandatory?: boolean;
    };

    const protocol = await app.prisma.rTPProtocol.findFirst({
      where: { id, athlete: { organizationId: request.user.organizationId } },
      include: { phases: { orderBy: { order: 'asc' } } },
    });
    if (!protocol) return reply.notFound('Protocollo RTP non trovato');
    if (!body.description?.trim()) return reply.badRequest('La descrizione del criterio e\' obbligatoria');
    if (!phaseSequence(protocol.phases).includes(body.phase)) {
      return reply.badRequest('Fase non valida per questo protocollo');
    }

    const last = await app.prisma.clearanceCriteria.findFirst({
      where: { rtpProtocolId: id, phase: body.phase as never },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const criterion = await app.prisma.clearanceCriteria.create({
      data: {
        rtpProtocolId: id,
        phase: body.phase as never,
        order: (last?.order ?? 0) + 1,
        description: body.description.trim(),
        testCode: body.testCode ?? null,
        comparator: body.comparator ?? null,
        targetValue: body.targetValue ?? null,
        unit: body.unit ?? null,
        mandatory: body.mandatory ?? true,
      },
    });

    return reply.status(201).send({ success: true, data: { criterion } });
  });

  // ─── DELETE clearance criterion ────────────────────────
  // Un criterio aggiunto per sbaglio bloccherebbe il passaggio di fase per
  // sempre: senza questa rotta l'unica uscita sarebbe spuntarlo per finta.
  app.delete('/rtp/criteria/:criterionId', {
    preHandler: [app.authenticate, requireMinRole('MEDICAL')],
  }, async (request, reply) => {
    const { criterionId } = request.params as { criterionId: string };

    const criterion = await app.prisma.clearanceCriteria.findFirst({
      where: {
        id: criterionId,
        rtpProtocol: { athlete: { organizationId: request.user.organizationId } },
      },
      select: { id: true },
    });
    if (!criterion) return reply.notFound('Criterio non trovato');

    await app.prisma.clearanceCriteria.delete({ where: { id: criterionId } });

    return { success: true, data: { deleted: true } };
  });
}
