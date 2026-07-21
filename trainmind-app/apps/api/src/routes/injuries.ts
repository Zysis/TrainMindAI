import type { FastifyInstance } from 'fastify';
import { requireMinRole } from '../middleware/rbac.js';

// ─── Default clearance criteria per RTP phase (basketball-specific) ──
const DEFAULT_CRITERIA: Record<string, string[]> = {
  PHASE_1: [
    'Dolore a riposo < 2/10 VAS',
    'Range of Motion passivo recuperato > 70%',
    'Nessun segno di infiammazione acuta',
  ],
  PHASE_2: [
    'Dolore durante ADL < 2/10 VAS',
    'ROM attivo completo e simmetrico',
    'Forza isometrica > 70% lato sano',
    'Corsa rettilinea senza dolore',
  ],
  PHASE_3: [
    'Corsa con cambi di direzione senza dolore',
    'Forza concentrica/eccentrica > 80% lato sano',
    'Hop test LSI > 80%',
    'Drill basket non-contatto completati',
  ],
  PHASE_4: [
    'Allenamento con contatto limitato senza dolore',
    'Forza > 90% lato sano',
    'Hop test LSI > 90%',
    'Y-Balance test simmetrico',
    'Completamento drill sport-specifici al 100% intensità',
  ],
  PHASE_5: [
    'Allenamento completo con squadra (2+ sessioni)',
    'Nessun versamento post-allenamento',
    'Questionario psicologico RTP positivo',
    'Clearance medica firmata',
  ],
};

export async function injuryRoutes(app: FastifyInstance) {
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
  app.post('/injuries/:injuryId/rtp', {
    preHandler: [app.authenticate, requireMinRole('MEDICAL')],
  }, async (request, reply) => {
    const { injuryId } = request.params as { injuryId: string };
    const body = request.body as {
      targetDate?: string;
      notes?: string;
      autoCreateCriteria?: boolean;
    };

    const injury = await app.prisma.injury.findFirst({
      where: { id: injuryId, athlete: { organizationId: request.user.organizationId } },
      include: { athlete: true },
    });
    if (!injury) return reply.notFound('Infortunio non trovato');

    // Update injury status to RECOVERING
    await app.prisma.injury.update({
      where: { id: injuryId },
      data: { status: 'RECOVERING' },
    });

    const protocol = await app.prisma.rTPProtocol.create({
      data: {
        injuryId,
        athleteId: injury.athleteId,
        startDate: new Date(),
        targetDate: body.targetDate ? new Date(body.targetDate) : null,
        notes: body.notes,
      },
    });

    // Auto-create default clearance criteria for all phases
    if (body.autoCreateCriteria !== false) {
      const criteriaData: Array<{
        rtpProtocolId: string;
        phase: 'PHASE_1' | 'PHASE_2' | 'PHASE_3' | 'PHASE_4' | 'PHASE_5';
        description: string;
      }> = [];
      for (const [phase, descriptions] of Object.entries(DEFAULT_CRITERIA)) {
        for (const description of descriptions) {
          criteriaData.push({
            rtpProtocolId: protocol.id,
            phase: phase as 'PHASE_1' | 'PHASE_2' | 'PHASE_3' | 'PHASE_4' | 'PHASE_5',
            description,
          });
        }
      }
      await app.prisma.clearanceCriteria.createMany({ data: criteriaData });
    }

    // Log initial phase
    await app.prisma.rTPPhaseLog.create({
      data: {
        rtpProtocolId: protocol.id,
        fromPhase: 'PHASE_1',
        toPhase: 'PHASE_1',
        changedById: request.user.id,
        reason: 'Protocollo RTP avviato',
      },
    });

    // Refetch with relations
    const full = await app.prisma.rTPProtocol.findUnique({
      where: { id: protocol.id },
      include: {
        injury: true,
        athlete: { select: { id: true, firstName: true, lastName: true } },
        criteria: { orderBy: [{ phase: 'asc' }, { createdAt: 'asc' }] },
        phaseLogs: { orderBy: { createdAt: 'desc' }, include: { changedBy: { select: { firstName: true, lastName: true } } } },
      },
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
      include: {
        injury: true,
        athlete: { select: { id: true, firstName: true, lastName: true, position: true, photoUrl: true } },
        criteria: { orderBy: [{ phase: 'asc' }, { createdAt: 'asc' }] },
        phaseLogs: {
          orderBy: { createdAt: 'desc' },
          include: { changedBy: { select: { firstName: true, lastName: true } } },
        },
      },
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
        injury: { select: { type: true, location: true, severity: true } },
        athlete: { select: { id: true, firstName: true, lastName: true, position: true, photoUrl: true } },
        _count: { select: { criteria: true, phaseLogs: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return { success: true, data: { protocols } };
  });

  // ─── ADVANCE / REVERT RTP phase ───────────────────────
  app.post('/rtp/:id/advance', {
    preHandler: [app.authenticate, requireMinRole('MEDICAL')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { targetPhase: string; reason?: string; force?: boolean };

    const protocol = await app.prisma.rTPProtocol.findFirst({
      where: { id, athlete: { organizationId: request.user.organizationId } },
      include: { criteria: true },
    });
    if (!protocol) return reply.notFound('Protocollo RTP non trovato');

    const PHASE_ORDER = ['PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4', 'PHASE_5', 'CLEARED'];
    const currentIdx = PHASE_ORDER.indexOf(protocol.currentPhase);
    const targetIdx = PHASE_ORDER.indexOf(body.targetPhase);
    if (targetIdx < 0) return reply.badRequest('Fase non valida');

    // If advancing (not reverting), check clearance criteria
    if (targetIdx > currentIdx && !body.force) {
      const unmetCriteria = protocol.criteria.filter(
        (c) => c.phase === protocol.currentPhase && !c.isMet
      );
      if (unmetCriteria.length > 0) {
        return reply.status(422).send({
          success: false,
          error: {
            code: 'CRITERIA_NOT_MET',
            message: `${unmetCriteria.length} criteri non soddisfatti per la fase corrente`,
            unmetCriteria: unmetCriteria.map((c) => ({ id: c.id, description: c.description })),
          },
        });
      }
    }

    // Update phase
    await app.prisma.rTPProtocol.update({
      where: { id },
      data: { currentPhase: body.targetPhase as any },
    });

    // Log transition
    await app.prisma.rTPPhaseLog.create({
      data: {
        rtpProtocolId: id,
        fromPhase: protocol.currentPhase,
        toPhase: body.targetPhase as any,
        changedById: request.user.id,
        reason: body.reason,
      },
    });

    // If cleared, resolve injury
    if (body.targetPhase === 'CLEARED') {
      await app.prisma.injury.update({
        where: { id: protocol.injuryId },
        data: { status: 'RESOLVED', dateResolved: new Date() },
      });
    }

    // Refetch
    const updated = await app.prisma.rTPProtocol.findUnique({
      where: { id },
      include: {
        injury: true,
        athlete: { select: { id: true, firstName: true, lastName: true } },
        criteria: { orderBy: [{ phase: 'asc' }, { createdAt: 'asc' }] },
        phaseLogs: { orderBy: { createdAt: 'desc' }, include: { changedBy: { select: { firstName: true, lastName: true } } } },
      },
    });

    return { success: true, data: { protocol: updated } };
  });

  // ─── TOGGLE clearance criterion ────────────────────────
  app.patch('/rtp/criteria/:criterionId', {
    preHandler: [app.authenticate, requireMinRole('MEDICAL')],
  }, async (request, reply) => {
    const { criterionId } = request.params as { criterionId: string };
    const body = request.body as { isMet: boolean; notes?: string };

    const criterion = await app.prisma.clearanceCriteria.findFirst({
      where: {
        id: criterionId,
        rtpProtocol: { athlete: { organizationId: request.user.organizationId } },
      },
    });
    if (!criterion) return reply.notFound('Criterio non trovato');

    const updated = await app.prisma.clearanceCriteria.update({
      where: { id: criterionId },
      data: {
        isMet: body.isMet,
        metAt: body.isMet ? new Date() : null,
        metById: body.isMet ? request.user.id : null,
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    });

    return { success: true, data: { criterion: updated } };
  });

  // ─── ADD custom clearance criterion ────────────────────
  app.post('/rtp/:id/criteria', {
    preHandler: [app.authenticate, requireMinRole('MEDICAL')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { phase: string; description: string };

    const protocol = await app.prisma.rTPProtocol.findFirst({
      where: { id, athlete: { organizationId: request.user.organizationId } },
    });
    if (!protocol) return reply.notFound('Protocollo RTP non trovato');

    const criterion = await app.prisma.clearanceCriteria.create({
      data: {
        rtpProtocolId: id,
        phase: body.phase as any,
        description: body.description,
      },
    });

    return reply.status(201).send({ success: true, data: { criterion } });
  });
}
