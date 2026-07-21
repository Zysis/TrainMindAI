import type { FastifyInstance } from 'fastify';
import { createWellnessLogSchema, createMetricSchema, wellnessQuerySchema } from '../schemas/wellness.js';
import { requireMinRole } from '../middleware/rbac.js';

export async function wellnessRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // ─── POST /wellness — Create wellness log ──────────────────
  app.post('/wellness', { preHandler: [requireMinRole('TRAINER')] }, async (request, reply) => {
    const parsed = createWellnessLogSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const log = await app.prisma.wellnessLog.upsert({
      where: {
        athleteId_date: {
          athleteId: parsed.data.athleteId,
          date: new Date(parsed.data.date),
        },
      },
      update: { ...parsed.data, date: new Date(parsed.data.date) },
      create: { ...parsed.data, date: new Date(parsed.data.date) },
    });

    return reply.status(201).send({ success: true, data: log });
  });

  // ─── GET /wellness — List wellness logs ────────────────────
  app.get('/wellness', async (request, reply) => {
    const query = wellnessQuerySchema.parse(request.query);
    const { organizationId } = request.user;
    const { athleteId, teamId, from, to, page, limit } = query;

    const where: Record<string, unknown> = {
      athlete: { organizationId },
    };
    if (athleteId) {
      where.athleteId = athleteId;
    } else if (teamId) {
      const teamAthletes = await app.prisma.athleteTeam.findMany({
        where: { teamId },
        select: { athleteId: true },
      });
      where.athleteId = { in: teamAthletes.map((ta) => ta.athleteId) };
    }
    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, unknown>).gte = new Date(from);
      if (to) (where.date as Record<string, unknown>).lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      app.prisma.wellnessLog.findMany({
        where,
        include: { athlete: { select: { firstName: true, lastName: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      app.prisma.wellnessLog.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: logs,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // ─── POST /metrics — Create metric ────────────────────────
  app.post('/metrics', { preHandler: [requireMinRole('TRAINER')] }, async (request, reply) => {
    const parsed = createMetricSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const metric = await app.prisma.metric.create({
      data: { ...parsed.data, date: new Date(parsed.data.date) },
    });

    return reply.status(201).send({ success: true, data: metric });
  });

  // ─── GET /metrics — List metrics ──────────────────────────
  app.get('/metrics', async (request, reply) => {
    const query = wellnessQuerySchema.parse(request.query);
    const { organizationId } = request.user;
    const { athleteId, type, from, to, page, limit } = query;

    const where: Record<string, unknown> = {
      athlete: { organizationId },
    };
    if (athleteId) where.athleteId = athleteId;
    if (type) where.type = type;
    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, unknown>).gte = new Date(from);
      if (to) (where.date as Record<string, unknown>).lte = new Date(to);
    }

    const [metrics, total] = await Promise.all([
      app.prisma.metric.findMany({
        where,
        include: { athlete: { select: { firstName: true, lastName: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      app.prisma.metric.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: metrics,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });
}
