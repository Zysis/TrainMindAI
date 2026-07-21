/**
 * Game Tracking — Minuti partita
 *
 * Endpoints (all under /api/v1):
 *   POST   /game/start                    create game session from calendar event
 *   GET    /game/by-event/:eventId         get game session by calendar event id
 *   GET    /game/:id                       get game session with entries
 *   PUT    /game/:id/entries               bulk save playing time data
 *   POST   /game/:id/athletes              add athlete to game
 *   DELETE /game/:id/athletes/:athleteId   remove athlete from game
 *   PUT    /game/:id/complete              mark game complete → create training sessions for analytics
 *   POST   /game/:id/overtime              add overtime period
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@trainmind/db';
import { z } from 'zod';
import { requireMinRole } from '../middleware/rbac.js';

export async function gameTrackingRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate, requireMinRole('TRAINER')] };

  const athleteSelect = { id: true, firstName: true, lastName: true, jerseyNumber: true, position: true };

  // ─── POST /game/start ──────────────────────────────────
  app.post('/game/start', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        calendarEventId: z.string().min(1),
        teamId: z.string().optional(),
        quarters: z.number().int().min(1).max(10).optional().default(4),
        quarterDurationMs: z.number().int().min(60000).optional().default(600000),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'calendarEventId richiesto' } });
      }

      const { organizationId } = request.user;
      const { calendarEventId, teamId, quarters, quarterDurationMs } = parsed.data;

      // Check if session already exists
      const existing = await app.prisma.gameSession.findUnique({
        where: { calendarEventId },
        include: {
          entries: {
            include: { athlete: { select: athleteSelect } },
            orderBy: { athlete: { lastName: 'asc' } },
          },
          team: { select: { id: true, name: true, color: true } },
        },
      });
      if (existing) {
        return reply.send({ success: true, data: { session: existing, created: false } });
      }

      // Verify calendar event
      const calendarEvent = await app.prisma.calendarEvent.findFirst({
        where: { id: calendarEventId, userId: request.user.userId },
      });
      if (!calendarEvent) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Evento calendario non trovato (id: ${calendarEventId})` } });
      }

      const effectiveTeamId = teamId || calendarEvent.teamId;

      // Load athletes from team
      let athleteIds: string[] = [];
      if (effectiveTeamId) {
        const teamAthletes = await app.prisma.athleteTeam.findMany({
          where: { teamId: effectiveTeamId },
          select: { athleteId: true },
        });
        athleteIds = teamAthletes.map((at) => at.athleteId);
      }

      let session;
      try {
        session = await app.prisma.gameSession.create({
          data: {
            calendarEventId,
            teamId: effectiveTeamId || null,
            organizationId,
            quarters,
            quarterDurationMs,
            entries: {
              create: athleteIds.map((athleteId) => ({
                athleteId,
                totalPlayingMs: 0,
                stints: [],
                onCourt: false,
              })),
            },
          },
          include: {
            entries: {
              include: { athlete: { select: athleteSelect } },
              orderBy: { athlete: { lastName: 'asc' } },
            },
            team: { select: { id: true, name: true, color: true } },
          },
        });
      } catch (createErr) {
        // Race condition
        const raceSession = await app.prisma.gameSession.findUnique({
          where: { calendarEventId },
          include: {
            entries: {
              include: { athlete: { select: athleteSelect } },
              orderBy: { athlete: { lastName: 'asc' } },
            },
            team: { select: { id: true, name: true, color: true } },
          },
        });
        if (raceSession) {
          return reply.send({ success: true, data: { session: raceSession, created: false } });
        }
        throw createErr;
      }

      return reply.status(201).send({ success: true, data: { session, created: true } });
    } catch (err) {
      request.log.error(err, 'game/start error');
      const message = err instanceof Error ? err.message : 'Errore avvio sessione partita';
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message } });
    }
  });

  // ─── GET /game/by-event/:eventId ───────────────────────
  app.get<{ Params: { eventId: string } }>(
    '/game/by-event/:eventId',
    auth,
    async (request, reply) => {
      try {
        const session = await app.prisma.gameSession.findUnique({
          where: { calendarEventId: request.params.eventId },
          include: {
            entries: {
              include: { athlete: { select: athleteSelect } },
              orderBy: { athlete: { lastName: 'asc' } },
            },
            team: { select: { id: true, name: true, color: true } },
            calendarEvent: { select: { id: true, title: true, startTime: true, endTime: true, type: true } },
          },
        });

        if (!session || session.organizationId !== request.user.organizationId) {
          return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione partita non trovata' } });
        }

        return reply.send({ success: true, data: { session } });
      } catch (err) {
        request.log.error(err, 'game/by-event error');
        const message = err instanceof Error ? err.message : 'Errore caricamento sessione partita';
        return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message } });
      }
    },
  );

  // ─── GET /game/:id ─────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/game/:id',
    auth,
    async (request, reply) => {
      const session = await app.prisma.gameSession.findFirst({
        where: { id: request.params.id, organizationId: request.user.organizationId },
        include: {
          entries: {
            include: { athlete: { select: athleteSelect } },
            orderBy: { athlete: { lastName: 'asc' } },
          },
          team: { select: { id: true, name: true, color: true } },
          calendarEvent: { select: { id: true, title: true, startTime: true, endTime: true, type: true } },
        },
      });

      if (!session) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione partita non trovata' } });
      }

      return reply.send({ success: true, data: { session } });
    },
  );

  // ─── PUT /game/:id/entries ─────────────────────────────
  app.put<{ Params: { id: string } }>(
    '/game/:id/entries',
    auth,
    async (request, reply) => {
      const entrySchema = z.object({
        athleteId: z.string(),
        totalPlayingMs: z.number().int().min(0),
        stints: z.array(z.object({
          quarter: z.number().int(),
          inMs: z.number(),
          outMs: z.number().nullable(),
          durationMs: z.number().int().min(0),
        })),
        onCourt: z.boolean(),
      });
      const parsed = z.array(entrySchema).safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten() } });
      }

      const session = await app.prisma.gameSession.findFirst({
        where: { id: request.params.id, organizationId: request.user.organizationId },
      });
      if (!session) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione partita non trovata' } });
      }

      await app.prisma.$transaction(
        parsed.data.map((entry) =>
          app.prisma.gamePlayerEntry.upsert({
            where: {
              gameSessionId_athleteId: {
                gameSessionId: session.id,
                athleteId: entry.athleteId,
              },
            },
            update: {
              totalPlayingMs: entry.totalPlayingMs,
              stints: entry.stints as unknown as Prisma.InputJsonValue,
              onCourt: entry.onCourt,
            },
            create: {
              gameSessionId: session.id,
              athleteId: entry.athleteId,
              totalPlayingMs: entry.totalPlayingMs,
              stints: entry.stints as unknown as Prisma.InputJsonValue,
              onCourt: entry.onCourt,
            },
          }),
        ),
      );

      return reply.send({ success: true, data: { saved: parsed.data.length } });
    },
  );

  // ─── POST /game/:id/athletes ───────────────────────────
  app.post<{ Params: { id: string } }>(
    '/game/:id/athletes',
    auth,
    async (request, reply) => {
      const schema = z.object({ athleteId: z.string().min(1) });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'athleteId richiesto' } });
      }

      const session = await app.prisma.gameSession.findFirst({
        where: { id: request.params.id, organizationId: request.user.organizationId },
      });
      if (!session) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione partita non trovata' } });
      }

      const athlete = await app.prisma.athlete.findFirst({
        where: { id: parsed.data.athleteId, organizationId: request.user.organizationId },
        select: athleteSelect,
      });
      if (!athlete) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Atleta non trovato' } });
      }

      const entry = await app.prisma.gamePlayerEntry.upsert({
        where: {
          gameSessionId_athleteId: {
            gameSessionId: session.id,
            athleteId: athlete.id,
          },
        },
        update: {},
        create: {
          gameSessionId: session.id,
          athleteId: athlete.id,
          totalPlayingMs: 0,
          stints: [],
          onCourt: false,
        },
        include: { athlete: { select: athleteSelect } },
      });

      return reply.send({ success: true, data: { entry } });
    },
  );

  // ─── DELETE /game/:id/athletes/:athleteId ──────────────
  app.delete<{ Params: { id: string; athleteId: string } }>(
    '/game/:id/athletes/:athleteId',
    auth,
    async (request, reply) => {
      const session = await app.prisma.gameSession.findFirst({
        where: { id: request.params.id, organizationId: request.user.organizationId },
      });
      if (!session) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione partita non trovata' } });
      }

      await app.prisma.gamePlayerEntry.deleteMany({
        where: { gameSessionId: session.id, athleteId: request.params.athleteId },
      });

      return reply.send({ success: true, data: { removed: true } });
    },
  );

  // ─── POST /game/:id/overtime ───────────────────────────
  app.post<{ Params: { id: string } }>(
    '/game/:id/overtime',
    auth,
    async (request, reply) => {
      const session = await app.prisma.gameSession.findFirst({
        where: { id: request.params.id, organizationId: request.user.organizationId },
      });
      if (!session) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione partita non trovata' } });
      }

      const updated = await app.prisma.gameSession.update({
        where: { id: session.id },
        data: {
          overtimes: session.overtimes + 1,
        },
      });

      return reply.send({
        success: true,
        data: {
          overtimes: updated.overtimes,
          totalPeriods: updated.quarters + updated.overtimes,
        },
      });
    },
  );

  // ─── PUT /game/:id/complete ────────────────────────────
  app.put<{ Params: { id: string } }>(
    '/game/:id/complete',
    auth,
    async (request, reply) => {
      const session = await app.prisma.gameSession.findFirst({
        where: { id: request.params.id, organizationId: request.user.organizationId },
        include: {
          entries: { include: { athlete: { select: { id: true, firstName: true, lastName: true } } } },
          calendarEvent: { select: { title: true, startTime: true } },
        },
      });
      if (!session) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione partita non trovata' } });
      }

      const { organizationId } = request.user;

      await app.prisma.gameSession.update({
        where: { id: session.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      // Create TrainingSessions for analytics (like field training)
      const createdSessions: string[] = [];
      for (const entry of session.entries) {
        if (entry.totalPlayingMs <= 0) continue;

        const durationMinutes = Math.round(entry.totalPlayingMs / 60000);
        if (durationMinutes < 1) continue;

        const stintsArray = (entry.stints as Array<{ quarter: number; durationMs: number }>) || [];
        const stintsText = stintsArray.map((s) =>
          `Q${s.quarter}: ${Math.round(s.durationMs / 60000)} min`
        ).join(', ');

        const ts = await app.prisma.trainingSession.create({
          data: {
            title: `${session.calendarEvent?.title || 'Partita'} — ${entry.athlete.firstName} ${entry.athlete.lastName}`,
            date: session.calendarEvent?.startTime || session.startedAt,
            duration: durationMinutes,
            status: 'COMPLETED',
            notes: `Minuti partita: ${durationMinutes} min. ${stintsArray.length} stint. ${stintsText}`,
            athleteId: entry.athleteId,
            organizationId,
          },
        });
        createdSessions.push(ts.id);
      }

      return reply.send({
        success: true,
        data: {
          completed: true,
          trainingSessions: createdSessions.length,
          sessionIds: createdSessions,
        },
      });
    },
  );
}
