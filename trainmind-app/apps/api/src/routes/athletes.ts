import type { FastifyInstance } from 'fastify';
import { createAthleteSchema, updateAthleteSchema, athleteQuerySchema } from '../schemas/athletes.js';
import { requireMinRole } from '../middleware/rbac.js';
import { sendError, notFound, handleValidation } from '../lib/api-errors.js';
import { findOrgEntity } from '../lib/org-guard.js';

export async function athleteRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', app.authenticate);

  // ─── GET /athletes — List with pagination/filters/search ──
  app.get('/athletes', async (request, reply) => {
    const query = athleteQuerySchema.parse(request.query);
    const { organizationId } = request.user;
    const { page, limit, search, position, isActive, sortBy, sortOrder, teamId } = query;

    const where: Record<string, unknown> = { organizationId };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (position) where.position = position;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (teamId) {
      where.athleteTeams = { some: { teamId } };
    }

    const [athletes, total] = await Promise.all([
      app.prisma.athlete.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          athleteTeams: {
            include: { team: { select: { id: true, name: true, color: true } } },
          },
        },
      }),
      app.prisma.athlete.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: athletes,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // ─── GET /athletes/:id — Detail ──────────────────────────
  app.get<{ Params: { id: string } }>('/athletes/:id', async (request, reply) => {
    const { id } = request.params;
    const { organizationId } = request.user;

    const athlete = await app.prisma.athlete.findFirst({
      where: { id, organizationId },
      include: {
        wellnessLogs: { orderBy: { date: 'desc' }, take: 7 },
        injuries: { where: { status: { not: 'RESOLVED' } } },
        _count: { select: { trainingSessions: true, wellnessLogs: true, injuries: true } },
      },
    });

    if (!athlete) {
      return sendError(reply, notFound('Athlete'));
    }

    return reply.send({ success: true, data: athlete });
  });

  // ─── POST /athletes — Create ─────────────────────────────
  app.post('/athletes', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = createAthleteSchema.safeParse(request.body);
    const data = handleValidation(reply, parsed);
    if (!data) return;

    const { organizationId } = request.user;
    const athlete = await app.prisma.athlete.create({
      data: {
        ...data,
        dateOfBirth: new Date(data.dateOfBirth),
        organizationId,
      },
    });

    return reply.status(201).send({ success: true, data: athlete });
  });

  // ─── PUT /athletes/:id — Update ──────────────────────────
  app.put<{ Params: { id: string } }>('/athletes/:id', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = updateAthleteSchema.safeParse(request.body);
    const data = handleValidation(reply, parsed);
    if (!data) return;

    const { id } = request.params;
    const { organizationId } = request.user;

    await findOrgEntity(app, 'athlete', id, organizationId);

    const updateData = { ...data } as Record<string, unknown>;
    if (data.dateOfBirth) {
      updateData.dateOfBirth = new Date(data.dateOfBirth);
    }

    const athlete = await app.prisma.athlete.update({ where: { id }, data: updateData });
    return reply.send({ success: true, data: athlete });
  });

  // ─── DELETE /athletes/:id — Soft delete ───────────────────
  app.delete<{ Params: { id: string } }>('/athletes/:id', {
    preHandler: [requireMinRole('ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params;
    const { organizationId } = request.user;

    await findOrgEntity(app, 'athlete', id, organizationId);

    await app.prisma.athlete.update({ where: { id }, data: { isActive: false } });
    return reply.send({ success: true, data: { message: 'Athlete deactivated' } });
  });
}
