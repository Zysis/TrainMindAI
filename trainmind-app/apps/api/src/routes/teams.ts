import type { FastifyInstance } from 'fastify';
import { createTeamSchema, updateTeamSchema, teamQuerySchema, addAthletesSchema } from '../schemas/teams.js';
import { requireMinRole } from '../middleware/rbac.js';
import { sendError, notFound, duplicate, handleValidation, AppError } from '../lib/api-errors.js';
import { findOrgEntity } from '../lib/org-guard.js';

// ─── Routes ─────────────────────────────────────────────

export async function teamRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // ─── GET /teams — List teams for current org ──────────
  app.get('/teams', async (request, reply) => {
    const query = teamQuerySchema.parse(request.query);
    const { organizationId } = request.user;
    const { page, limit, search, sortBy, sortOrder } = query;

    const where: Record<string, unknown> = { organizationId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [teams, total] = await Promise.all([
      app.prisma.team.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              athleteTeams: true,
              trainingPlans: true,
              periodizationPlans: true,
            },
          },
        },
      }),
      app.prisma.team.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: teams,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // ─── GET /teams/:id — Team detail with athletes ──────
  app.get<{ Params: { id: string } }>('/teams/:id', async (request, reply) => {
    const { id } = request.params;
    const { organizationId } = request.user;

    const team = await app.prisma.team.findFirst({
      where: { id, organizationId },
      include: {
        athleteTeams: {
          include: {
            athlete: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                position: true,
                jerseyNumber: true,
                photoUrl: true,
                isActive: true,
                dateOfBirth: true,
              },
            },
          },
          orderBy: { athlete: { lastName: 'asc' } },
        },
        _count: {
          select: {
            athleteTeams: true,
            trainingPlans: true,
            periodizationPlans: true,
            calendarEvents: true,
          },
        },
      },
    });

    if (!team) {
      return sendError(reply, notFound('Team'));
    }

    // Flatten athletes from join table
    const { athleteTeams, ...teamData } = team;
    const athletes = athleteTeams.map((at) => at.athlete);

    return reply.send({ success: true, data: { ...teamData, athletes } });
  });

  // ─── POST /teams — Create team ────────────────────────
  app.post('/teams', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = createTeamSchema.safeParse(request.body);
    const data = handleValidation(reply, parsed);
    if (!data) return;

    const { organizationId } = request.user;

    // Check unique name within org
    const existing = await app.prisma.team.findFirst({
      where: { organizationId, name: data.name },
    });
    if (existing) {
      return sendError(reply, duplicate('Team'));
    }

    const team = await app.prisma.team.create({
      data: { ...data, organizationId },
    });

    return reply.status(201).send({ success: true, data: team });
  });

  // ─── PUT /teams/:id — Update team ────────────────────
  app.put<{ Params: { id: string } }>('/teams/:id', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = updateTeamSchema.safeParse(request.body);
    const data = handleValidation(reply, parsed);
    if (!data) return;

    const { id } = request.params;
    const { organizationId } = request.user;

    const existing = await findOrgEntity(app, 'team', id, organizationId);

    // Check name uniqueness if changing name
    if (data.name && data.name !== (existing as any).name) {
      const dup = await app.prisma.team.findFirst({
        where: { organizationId, name: data.name, id: { not: id } },
      });
      if (dup) {
        return sendError(reply, duplicate('Team'));
      }
    }

    const team = await app.prisma.team.update({ where: { id }, data });
    return reply.send({ success: true, data: team });
  });

  // ─── DELETE /teams/:id — Delete team ──────────────────
  app.delete<{ Params: { id: string } }>('/teams/:id', {
    preHandler: [requireMinRole('ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params;
    const { organizationId } = request.user;

    await findOrgEntity(app, 'team', id, organizationId);

    await app.prisma.team.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Team deleted' } });
  });

  // ─── POST /teams/:id/athletes — Add athletes to team ─
  app.post<{ Params: { id: string } }>('/teams/:id/athletes', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = addAthletesSchema.safeParse(request.body);
    const data = handleValidation(reply, parsed);
    if (!data) return;

    const { id } = request.params;
    const { organizationId } = request.user;

    await findOrgEntity(app, 'team', id, organizationId);

    // Verify all athletes belong to same org
    const athletes = await app.prisma.athlete.findMany({
      where: { id: { in: data.athleteIds }, organizationId },
      select: { id: true },
    });

    if (athletes.length !== data.athleteIds.length) {
      return sendError(reply, new AppError(400, 'INVALID_ATHLETES', 'Some athletes were not found'));
    }

    // Upsert — skipDuplicates so adding already-assigned athletes is idempotent
    await app.prisma.athleteTeam.createMany({
      data: data.athleteIds.map((athleteId) => ({
        athleteId,
        teamId: id,
      })),
      skipDuplicates: true,
    });

    return reply.status(201).send({ success: true, data: { message: 'Athletes added to team' } });
  });

  // ─── DELETE /teams/:id/athletes/:athleteId — Remove ──
  app.delete<{ Params: { id: string; athleteId: string } }>('/teams/:id/athletes/:athleteId', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const { id, athleteId } = request.params;
    const { organizationId } = request.user;

    await findOrgEntity(app, 'team', id, organizationId);

    const membership = await app.prisma.athleteTeam.findFirst({
      where: { teamId: id, athleteId },
    });

    if (!membership) {
      return sendError(reply, notFound('AthleteTeam membership'));
    }

    await app.prisma.athleteTeam.delete({ where: { id: membership.id } });
    return reply.send({ success: true, data: { message: 'Athlete removed from team' } });
  });
}
