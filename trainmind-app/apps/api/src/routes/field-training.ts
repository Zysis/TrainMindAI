/**
 * Field Training — Cronometri allenamento in campo
 *
 * Endpoints (all under /api/v1):
 *   POST   /field-training/start             create session from calendar event
 *   GET    /field-training/:id               get session with entries
 *   GET    /field-training/by-event/:eventId  get session by calendar event id
 *   PUT    /field-training/:id/entries       bulk save timer data (autosave)
 *   PUT    /field-training/:id/complete      mark complete → create training sessions for analytics
 *   POST   /field-training/:id/athletes      add athlete to session
 *   DELETE /field-training/:id/athletes/:athleteId  remove athlete from session
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@trainmind/db';
import { requireMinRole } from '../middleware/rbac.js';

export async function fieldTrainingRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate, requireMinRole('TRAINER')] };

  // ─── POST /field-training/start ─────────────────────────
  // Create a new field training session from a calendar event
  app.post('/field-training/start', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schema = z.object({
        calendarEventId: z.string().min(1),
        teamId: z.string().optional(),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'calendarEventId richiesto' } });
      }

      const { organizationId } = request.user;
      const { calendarEventId, teamId } = parsed.data;

      // Check if session already exists for this event
      const existing = await app.prisma.fieldTrainingSession.findUnique({
        where: { calendarEventId },
        include: {
          entries: {
            include: { athlete: { select: { id: true, firstName: true, lastName: true, jerseyNumber: true, position: true } } },
          },
        },
      });
      if (existing) {
        return reply.send({ success: true, data: { session: existing, created: false } });
      }

      // Verify calendar event exists
      const calendarEvent = await app.prisma.calendarEvent.findFirst({
        where: { id: calendarEventId, userId: request.user.userId },
      });
      if (!calendarEvent) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Evento calendario non trovato (id: ${calendarEventId})` } });
      }

      const effectiveTeamId = teamId || calendarEvent.teamId;

      // Load athletes from team if available
      let athleteIds: string[] = [];
      if (effectiveTeamId) {
        const teamAthletes = await app.prisma.athleteTeam.findMany({
          where: { teamId: effectiveTeamId },
          select: { athleteId: true },
        });
        athleteIds = teamAthletes.map((at) => at.athleteId);
      }

      // Create session + entries for each athlete
      let session;
      try {
        session = await app.prisma.fieldTrainingSession.create({
          data: {
            calendarEventId,
            teamId: effectiveTeamId || null,
            organizationId,
            entries: {
              create: athleteIds.map((athleteId) => ({
                athleteId,
                totalActiveMs: 0,
                laps: [],
              })),
            },
          },
          include: {
            entries: {
              include: { athlete: { select: { id: true, firstName: true, lastName: true, jerseyNumber: true, position: true } } },
              orderBy: { athlete: { lastName: 'asc' } },
            },
            team: { select: { id: true, name: true, color: true } },
          },
        });
      } catch (createErr) {
        // Race condition: session was created between findUnique and create
        const raceSession = await app.prisma.fieldTrainingSession.findUnique({
          where: { calendarEventId },
          include: {
            entries: {
              include: { athlete: { select: { id: true, firstName: true, lastName: true, jerseyNumber: true, position: true } } },
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
      request.log.error(err, 'field-training/start error');
      const message = err instanceof Error ? err.message : 'Errore avvio sessione campo';
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message } });
    }
  });

  // ─── GET /field-training/by-event/:eventId ──────────────
  app.get<{ Params: { eventId: string } }>(
    '/field-training/by-event/:eventId',
    auth,
    async (request, reply) => {
      try {
        const session = await app.prisma.fieldTrainingSession.findUnique({
          where: { calendarEventId: request.params.eventId },
          include: {
            entries: {
              include: { athlete: { select: { id: true, firstName: true, lastName: true, jerseyNumber: true, position: true } } },
              orderBy: { athlete: { lastName: 'asc' } },
            },
            team: { select: { id: true, name: true, color: true } },
            calendarEvent: { select: { id: true, title: true, startTime: true, endTime: true, type: true } },
          },
        });

        if (!session || session.organizationId !== request.user.organizationId) {
          return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione non trovata' } });
        }

        return reply.send({ success: true, data: { session } });
      } catch (err) {
        request.log.error(err, 'field-training/by-event error');
        const message = err instanceof Error ? err.message : 'Errore caricamento sessione';
        return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message } });
      }
    },
  );

  // ─── GET /field-training/:id ────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/field-training/:id',
    auth,
    async (request, reply) => {
      const session = await app.prisma.fieldTrainingSession.findFirst({
        where: { id: request.params.id, organizationId: request.user.organizationId },
        include: {
          entries: {
            include: { athlete: { select: { id: true, firstName: true, lastName: true, jerseyNumber: true, position: true } } },
            orderBy: { athlete: { lastName: 'asc' } },
          },
          team: { select: { id: true, name: true, color: true } },
          calendarEvent: { select: { id: true, title: true, startTime: true, endTime: true, type: true } },
        },
      });

      if (!session) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione non trovata' } });
      }

      return reply.send({ success: true, data: { session } });
    },
  );

  // ─── PUT /field-training/:id/entries ────────────────────
  // Bulk save/update timer data (called periodically for autosave)
  app.put<{ Params: { id: string } }>(
    '/field-training/:id/entries',
    auth,
    async (request, reply) => {
      const entrySchema = z.object({
        athleteId: z.string(),
        totalActiveMs: z.number().int().min(0),
        laps: z.array(z.object({
          startMs: z.number(),
          endMs: z.number().nullable(),
          durationMs: z.number().int().min(0),
        })),
      });
      const parsed = z.array(entrySchema).safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten() } });
      }

      const session = await app.prisma.fieldTrainingSession.findFirst({
        where: { id: request.params.id, organizationId: request.user.organizationId },
      });
      if (!session) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione non trovata' } });
      }

      // Upsert each entry
      await app.prisma.$transaction(
        parsed.data.map((entry) =>
          app.prisma.fieldTrainingEntry.upsert({
            where: {
              fieldTrainingSessionId_athleteId: {
                fieldTrainingSessionId: session.id,
                athleteId: entry.athleteId,
              },
            },
            update: {
              totalActiveMs: entry.totalActiveMs,
              laps: entry.laps as unknown as Prisma.InputJsonValue,
            },
            create: {
              fieldTrainingSessionId: session.id,
              athleteId: entry.athleteId,
              totalActiveMs: entry.totalActiveMs,
              laps: entry.laps as unknown as Prisma.InputJsonValue,
            },
          }),
        ),
      );

      return reply.send({ success: true, data: { saved: parsed.data.length } });
    },
  );

  // ─── POST /field-training/:id/athletes ──────────────────
  // Add athlete to session
  app.post<{ Params: { id: string } }>(
    '/field-training/:id/athletes',
    auth,
    async (request, reply) => {
      const schema = z.object({ athleteId: z.string().min(1) });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'athleteId richiesto' } });
      }

      const session = await app.prisma.fieldTrainingSession.findFirst({
        where: { id: request.params.id, organizationId: request.user.organizationId },
      });
      if (!session) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione non trovata' } });
      }

      // Check athlete exists in org
      const athlete = await app.prisma.athlete.findFirst({
        where: { id: parsed.data.athleteId, organizationId: request.user.organizationId },
        select: { id: true, firstName: true, lastName: true, jerseyNumber: true, position: true },
      });
      if (!athlete) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Atleta non trovato' } });
      }

      const entry = await app.prisma.fieldTrainingEntry.upsert({
        where: {
          fieldTrainingSessionId_athleteId: {
            fieldTrainingSessionId: session.id,
            athleteId: athlete.id,
          },
        },
        update: {}, // no-op if already exists
        create: {
          fieldTrainingSessionId: session.id,
          athleteId: athlete.id,
          totalActiveMs: 0,
          laps: [],
        },
        include: { athlete: { select: { id: true, firstName: true, lastName: true, jerseyNumber: true, position: true } } },
      });

      return reply.send({ success: true, data: { entry } });
    },
  );

  // ─── DELETE /field-training/:id/athletes/:athleteId ─────
  app.delete<{ Params: { id: string; athleteId: string } }>(
    '/field-training/:id/athletes/:athleteId',
    auth,
    async (request, reply) => {
      const session = await app.prisma.fieldTrainingSession.findFirst({
        where: { id: request.params.id, organizationId: request.user.organizationId },
      });
      if (!session) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione non trovata' } });
      }

      await app.prisma.fieldTrainingEntry.deleteMany({
        where: { fieldTrainingSessionId: session.id, athleteId: request.params.athleteId },
      });

      return reply.send({ success: true, data: { removed: true } });
    },
  );

  // ─── PUT /field-training/:id/complete ───────────────────
  // Mark session complete → create individual TrainingSessions for analytics
  app.put<{ Params: { id: string } }>(
    '/field-training/:id/complete',
    auth,
    async (request, reply) => {
      const session = await app.prisma.fieldTrainingSession.findFirst({
        where: { id: request.params.id, organizationId: request.user.organizationId },
        include: {
          entries: { include: { athlete: { select: { id: true, firstName: true, lastName: true } } } },
          calendarEvent: { select: { title: true, startTime: true } },
        },
      });
      if (!session) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione non trovata' } });
      }

      const { organizationId } = request.user;

      // Mark as completed
      await app.prisma.fieldTrainingSession.update({
        where: { id: session.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      // For each athlete with active time > 0, create/update a TrainingSession
      // so the data feeds into analytics (sRPE, ACWR, load charts)
      const createdSessions: string[] = [];
      for (const entry of session.entries) {
        if (entry.totalActiveMs <= 0) continue;

        const durationMinutes = Math.round(entry.totalActiveMs / 60000);
        if (durationMinutes < 1) continue;

        const lapsArray = (entry.laps as Array<{ startMs: number; endMs: number | null; durationMs: number }>) || [];
        const lapsText = lapsArray.map((lap, i) =>
          `Intervallo ${i + 1}: ${Math.round(lap.durationMs / 1000)}s`
        ).join(', ');

        const ts = await app.prisma.trainingSession.create({
          data: {
            title: `${session.calendarEvent?.title || 'Allenamento in campo'} — ${entry.athlete.firstName} ${entry.athlete.lastName}`,
            date: session.calendarEvent?.startTime || session.startedAt,
            duration: durationMinutes,
            status: 'COMPLETED',
            notes: `Tempo attivo registrato con cronometro: ${durationMinutes} min. ${lapsArray.length} intervalli. ${lapsText}`,
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
