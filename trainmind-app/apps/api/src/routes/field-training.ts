/**
 * Field Training — Cronometri allenamento in campo
 *
 * Endpoints (all under /api/v1):
 *   POST   /field-training/start             create session from calendar event
 *   GET    /field-training/:id               get session with entries
 *   GET    /field-training/by-event/:eventId  get session by calendar event id
 *   GET    /field-training/by-session/:sessionId  get session by training session id
 *   PUT    /field-training/:id/entries       bulk save timer data (autosave)
 *   PUT    /field-training/:id/exercises     save exercises + available athletes
 *   PUT    /field-training/:id/roster        save attendance (traffic light) + guest players
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
        calendarEventId: z.string().min(1).optional(),
        trainingSessionId: z.string().min(1).optional(),
        teamId: z.string().optional(),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success || (!parsed.data.calendarEventId && !parsed.data.trainingSessionId)) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Serve calendarEventId oppure trainingSessionId' } });
      }

      const { organizationId } = request.user;
      const { calendarEventId, trainingSessionId, teamId } = parsed.data;

      // Il foglio esiste già?
      // Il filtro sull'organizzazione non e' pleonastico: senza, questa
      // scorciatoia restituiva il foglio completo — nomi e numeri di maglia
      // degli atleti — a chiunque conoscesse un calendarEventId, anche di
      // un'altra societa'. Il controllo esisteva gia' in GET /by-event.
      const existing = await app.prisma.fieldTrainingSession.findFirst({
        where: calendarEventId
          ? { calendarEventId, organizationId }
          : { trainingSessionId, organizationId },
        include: {
          entries: {
            include: { athlete: { select: { id: true, firstName: true, lastName: true, jerseyNumber: true, position: true } } },
          },
        },
      });
      if (existing) {
        return reply.send({ success: true, data: { session: existing, created: false } });
      }

      // La squadra puo' arrivare dal corpo della richiesta: va verificata,
      // altrimenti il foglio nasce popolato con la rosa di un'altra societa'
      // e quelle entry restano scritte, finendo negli export e nei report.
      if (teamId) {
        const team = await app.prisma.team.findFirst({ where: { id: teamId, organizationId } });
        if (!team) {
          return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Squadra non trovata' } });
        }
      }

      let effectiveTeamId: string | null = teamId || null;
      let defaultDuration: number | null = null;
      let presetExercises: Array<Record<string, unknown>> = [];
      let soloAthleteId: string | null = null;

      if (calendarEventId) {
        const calendarEvent = await app.prisma.calendarEvent.findFirst({
          // Per organizzazione e non per utente: dal 2/9/2026 il calendario e'
          // della societa', e aprire il foglio su un evento creato da un
          // collega non deve piu' rispondere "evento non trovato".
          where: { id: calendarEventId, organizationId },
        });
        if (!calendarEvent) {
          return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Evento calendario non trovato (id: ${calendarEventId})` } });
        }
        effectiveTeamId = effectiveTeamId || calendarEvent.teamId;
        defaultDuration = Math.max(
          1,
          Math.round((calendarEvent.endTime.getTime() - calendarEvent.startTime.getTime()) / 60000),
        );
      } else {
        // Sessione della programmazione: la squadra si risale dal piano
        const trainingSession = await app.prisma.trainingSession.findFirst({
          where: { id: trainingSessionId, organizationId },
          include: {
            week: {
              select: {
                trainingPlan: {
                  select: {
                    teamId: true,
                    // I piani generati da una periodizzazione non sempre hanno
                    // una squadra propria: quella vera sta sulla periodizzazione.
                    periodizationPlan: { select: { teamId: true } },
                  },
                },
              },
            },
            sessionExercises: {
              orderBy: { orderIndex: 'asc' },
              select: { id: true, sets: true, exercise: { select: { name: true } } },
            },
          },
        });
        if (!trainingSession) {
          return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Sessione non trovata (id: ${trainingSessionId})` } });
        }
        const plan = trainingSession.week?.trainingPlan;
        effectiveTeamId =
          effectiveTeamId || plan?.teamId || plan?.periodizationPlan?.teamId || null;
        defaultDuration = trainingSession.duration || null;
        // Sessione individuale: la "rosa" e' quel solo atleta.
        soloAthleteId = trainingSession.athleteId || null;

        // Il foglio nasce con gli esercizi della scheda gia' in tabella: chi e'
        // in palestra deve solo far partire i cronometri. Restano modificabili.
        presetExercises = trainingSession.sessionExercises.map((se, i) => ({
          id: `plan_${se.id}`,
          name: se.exercise?.name || `Esercizio ${i + 1}`,
          isWarmup: false,
          players: 0,
          courts: 0,
          sets: se.sets ?? 0,
          activityMs: 0,
          pauseMs: 0,
          breakMs: 0,
          state: 'idle',
          breakRunning: false,
        }));
      }

      // Load athletes from team if available
      let athleteIds: string[] = [];
      if (effectiveTeamId) {
        const teamAthletes = await app.prisma.athleteTeam.findMany({
          where: { teamId: effectiveTeamId, athlete: { organizationId } },
          select: { athleteId: true },
        });
        athleteIds = teamAthletes.map((at) => at.athleteId);
      } else if (soloAthleteId) {
        athleteIds = [soloAthleteId];
      }

      // Create session + entries for each athlete
      let session;
      try {
        session = await app.prisma.fieldTrainingSession.create({
          data: {
            calendarEventId: calendarEventId || null,
            trainingSessionId: trainingSessionId || null,
            durationMinutes: defaultDuration,
            ...(presetExercises.length > 0
              ? { exercises: presetExercises as unknown as Prisma.InputJsonValue }
              : {}),
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
            calendarEvent: { select: { id: true, title: true, startTime: true, endTime: true, type: true } },
            trainingSession: { select: { id: true, title: true, date: true, duration: true } },
          },
        });
      } catch (createErr) {
        // Race condition: session was created between findUnique and create
        const raceSession = await app.prisma.fieldTrainingSession.findFirst({
          where: calendarEventId
            ? { calendarEventId, organizationId }
            : { trainingSessionId, organizationId },
          include: {
            entries: {
              include: { athlete: { select: { id: true, firstName: true, lastName: true, jerseyNumber: true, position: true } } },
              orderBy: { athlete: { lastName: 'asc' } },
            },
            team: { select: { id: true, name: true, color: true } },
            calendarEvent: { select: { id: true, title: true, startTime: true, endTime: true, type: true } },
            trainingSession: { select: { id: true, title: true, date: true, duration: true } },
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

  // ─── Riparazione di un foglio nato vuoto ────────────────
  // Un foglio creato quando il piano non aveva ancora una squadra resta senza
  // rosa, e uno creato prima del precaricamento resta senza esercizi. Invece di
  // costringere a rifarlo, lo completiamo alla prima riapertura. Non tocchiamo
  // mai un foglio gia' chiuso ne' dati che l'utente ha inserito.
  async function backfillSheet(sheetId: string, organizationId: string): Promise<boolean> {
    const sheet = await app.prisma.fieldTrainingSession.findFirst({
      where: { id: sheetId, organizationId },
      select: {
        id: true,
        status: true,
        teamId: true,
        exercises: true,
        trainingSessionId: true,
        _count: { select: { entries: true } },
      },
    });
    if (!sheet || sheet.status === 'COMPLETED') return false;

    let changed = false;

    // ── rosa ──
    if (sheet._count.entries === 0) {
      let teamId = sheet.teamId;
      let soloAthleteId: string | null = null;

      if (!teamId && sheet.trainingSessionId) {
        const planSession = await app.prisma.trainingSession.findUnique({
          where: { id: sheet.trainingSessionId },
          select: {
            athleteId: true,
            week: {
              select: {
                trainingPlan: {
                  select: { teamId: true, periodizationPlan: { select: { teamId: true } } },
                },
              },
            },
          },
        });
        const plan = planSession?.week?.trainingPlan;
        teamId = plan?.teamId || plan?.periodizationPlan?.teamId || null;
        soloAthleteId = planSession?.athleteId || null;
      }

      let athleteIds: string[] = [];
      if (teamId) {
        const teamAthletes = await app.prisma.athleteTeam.findMany({
          where: { teamId, athlete: { organizationId } },
          select: { athleteId: true },
        });
        athleteIds = teamAthletes.map((at) => at.athleteId);
      } else if (soloAthleteId) {
        athleteIds = [soloAthleteId];
      }

      if (athleteIds.length > 0) {
        await app.prisma.fieldTrainingEntry.createMany({
          data: athleteIds.map((athleteId) => ({
            fieldTrainingSessionId: sheet.id,
            athleteId,
            totalActiveMs: 0,
            laps: [],
          })),
          skipDuplicates: true,
        });
        if (teamId && !sheet.teamId) {
          await app.prisma.fieldTrainingSession.update({
            where: { id: sheet.id },
            data: { teamId },
          });
        }
        changed = true;
      }
    }

    // ── esercizi della scheda ──
    const stored = Array.isArray(sheet.exercises) ? sheet.exercises : [];
    if (stored.length === 0 && sheet.trainingSessionId) {
      const planned = await app.prisma.sessionExercise.findMany({
        where: { trainingSessionId: sheet.trainingSessionId },
        orderBy: { orderIndex: 'asc' },
        select: { id: true, sets: true, exercise: { select: { name: true } } },
      });
      if (planned.length > 0) {
        await app.prisma.fieldTrainingSession.update({
          where: { id: sheet.id },
          data: {
            exercises: planned.map((se, i) => ({
              id: `plan_${se.id}`,
              name: se.exercise?.name || `Esercizio ${i + 1}`,
              isWarmup: false,
              players: 0,
              courts: 0,
              sets: se.sets ?? 0,
              activityMs: 0,
              pauseMs: 0,
              breakMs: 0,
              state: 'idle',
              breakRunning: false,
            })) as unknown as Prisma.InputJsonValue,
          },
        });
        changed = true;
      }
    }

    return changed;
  }

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
            trainingSession: { select: { id: true, title: true, date: true, duration: true } },
          },
        });

        if (!session || session.organizationId !== request.user.organizationId) {
          return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione non trovata' } });
        }

        // Foglio nato vuoto? Prova a completarlo, poi rileggilo.
        if (await backfillSheet(session.id, request.user.organizationId)) {
          const repaired = await app.prisma.fieldTrainingSession.findUnique({
            where: { id: session.id },
            include: {
              entries: {
                include: { athlete: { select: { id: true, firstName: true, lastName: true, jerseyNumber: true, position: true } } },
                orderBy: { athlete: { lastName: 'asc' } },
              },
              team: { select: { id: true, name: true, color: true } },
              calendarEvent: { select: { id: true, title: true, startTime: true, endTime: true, type: true } },
              trainingSession: { select: { id: true, title: true, date: true, duration: true } },
            },
          });
          if (repaired) return reply.send({ success: true, data: { session: repaired } });
        }

        return reply.send({ success: true, data: { session } });
      } catch (err) {
        request.log.error(err, 'field-training/by-event error');
        const message = err instanceof Error ? err.message : 'Errore caricamento sessione';
        return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message } });
      }
    },
  );

  // ─── GET /field-training/by-session/:sessionId ──────────
  // Foglio presenze di una sessione della programmazione
  app.get<{ Params: { sessionId: string } }>(
    '/field-training/by-session/:sessionId',
    auth,
    async (request, reply) => {
      try {
        const session = await app.prisma.fieldTrainingSession.findFirst({
          where: { trainingSessionId: request.params.sessionId },
          include: {
            entries: {
              include: { athlete: { select: { id: true, firstName: true, lastName: true, jerseyNumber: true, position: true } } },
              orderBy: { athlete: { lastName: 'asc' } },
            },
            team: { select: { id: true, name: true, color: true } },
            trainingSession: { select: { id: true, title: true, date: true, duration: true } },
          },
        });

        if (!session || session.organizationId !== request.user.organizationId) {
          return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione non trovata' } });
        }

        // Foglio nato vuoto? Prova a completarlo, poi rileggilo.
        if (await backfillSheet(session.id, request.user.organizationId)) {
          const repaired = await app.prisma.fieldTrainingSession.findUnique({
            where: { id: session.id },
            include: {
              entries: {
                include: { athlete: { select: { id: true, firstName: true, lastName: true, jerseyNumber: true, position: true } } },
                orderBy: { athlete: { lastName: 'asc' } },
              },
              team: { select: { id: true, name: true, color: true } },
              calendarEvent: { select: { id: true, title: true, startTime: true, endTime: true, type: true } },
              trainingSession: { select: { id: true, title: true, date: true, duration: true } },
            },
          });
          if (repaired) return reply.send({ success: true, data: { session: repaired } });
        }

        return reply.send({ success: true, data: { session } });
      } catch (err) {
        request.log.error(err, 'field-training/by-session error');
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

  // ─── PUT /field-training/:id/exercises ──────────────────
  // Save the exercise table (name, players, courts, stopwatch totals) + available athletes
  app.put<{ Params: { id: string } }>(
    '/field-training/:id/exercises',
    auth,
    async (request, reply) => {
      const exerciseSchema = z.object({
        id: z.string().min(1),
        name: z.string().max(200),
        isWarmup: z.boolean(),
        players: z.number().int().min(0).max(999),
        courts: z.number().int().min(0).max(99),
        activityMs: z.number().int().min(0),
        pauseMs: z.number().int().min(0),
        breakMs: z.number().int().min(0),
        state: z.enum(['idle', 'running', 'paused', 'done']),
        breakRunning: z.boolean(),
      });
      const schema = z.object({
        availableAthletes: z.number().int().min(0).max(999).nullable().optional(),
        exercises: z.array(exerciseSchema).max(100),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Dati esercizi non validi', details: parsed.error.flatten() } });
      }

      const session = await app.prisma.fieldTrainingSession.findFirst({
        where: { id: request.params.id, organizationId: request.user.organizationId },
      });
      if (!session) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione non trovata' } });
      }

      await app.prisma.fieldTrainingSession.update({
        where: { id: session.id },
        data: {
          exercises: parsed.data.exercises as unknown as Prisma.InputJsonValue,
          ...(parsed.data.availableAthletes !== undefined
            ? { availableAthletes: parsed.data.availableAthletes }
            : {}),
        },
      });

      return reply.send({ success: true, data: { saved: parsed.data.exercises.length } });
    },
  );

  // ─── PUT /field-training/:id/roster ─────────────────────
  // Presenze col semaforo (verde/giallo/rosso) + giocatori ospiti di sessione
  app.put<{ Params: { id: string } }>(
    '/field-training/:id/roster',
    auth,
    async (request, reply) => {
      const statusEnum = z.enum(['PRESENT', 'UNAVAILABLE', 'ABSENT']);
      const schema = z.object({
        availableAthletes: z.number().int().min(0).max(999).nullable().optional(),
        durationMinutes: z.number().int().min(0).max(600).nullable().optional(),
        sessionRpe: z.number().int().min(1).max(10).nullable().optional(),
        athletes: z.array(z.object({
          athleteId: z.string().min(1),
          status: statusEnum,
          note: z.string().max(500).nullable().optional(),
          rpe: z.number().int().min(1).max(10).nullable().optional(),
        })).max(200),
        guests: z.array(z.object({
          id: z.string().min(1),
          name: z.string().max(120),
          status: statusEnum,
          note: z.string().max(500).nullable().optional(),
        })).max(100),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Dati presenze non validi', details: parsed.error.flatten() } });
      }

      const session = await app.prisma.fieldTrainingSession.findFirst({
        where: { id: request.params.id, organizationId: request.user.organizationId },
      });
      if (!session) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione non trovata' } });
      }

      await app.prisma.$transaction([
        app.prisma.fieldTrainingSession.update({
          where: { id: session.id },
          data: {
            guests: parsed.data.guests as unknown as Prisma.InputJsonValue,
            ...(parsed.data.availableAthletes !== undefined
              ? { availableAthletes: parsed.data.availableAthletes }
              : {}),
            ...(parsed.data.durationMinutes !== undefined
              ? { durationMinutes: parsed.data.durationMinutes }
              : {}),
            ...(parsed.data.sessionRpe !== undefined
              ? { sessionRpe: parsed.data.sessionRpe }
              : {}),
          },
        }),
        ...parsed.data.athletes.map((a) =>
          app.prisma.fieldTrainingEntry.upsert({
            where: {
              fieldTrainingSessionId_athleteId: {
                fieldTrainingSessionId: session.id,
                athleteId: a.athleteId,
              },
            },
            update: { status: a.status, note: a.note ?? null, rpe: a.rpe ?? null },
            create: {
              fieldTrainingSessionId: session.id,
              athleteId: a.athleteId,
              status: a.status,
              note: a.note ?? null,
              rpe: a.rpe ?? null,
              totalActiveMs: 0,
              laps: [],
            },
          }),
        ),
      ]);

      return reply.send({ success: true, data: { athletes: parsed.data.athletes.length, guests: parsed.data.guests.length } });
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
          calendarEvent: { select: { title: true, startTime: true, endTime: true } },
          trainingSession: { select: { id: true, title: true, date: true, duration: true } },
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

      const presentEntries = session.entries.filter((e) => e.status === 'PRESENT');

      // Durata effettiva: quella scritta nel foglio, altrimenti la si deduce.
      // È il moltiplicatore del carico, quindi non si inventa: se manca del
      // tutto, nessuna riga viene creata.
      let durationMinutes = session.durationMinutes ?? null;
      if (durationMinutes == null && session.trainingSession?.duration) {
        durationMinutes = session.trainingSession.duration;
      }
      if (durationMinutes == null && session.calendarEvent?.startTime && session.calendarEvent?.endTime) {
        durationMinutes = Math.round(
          (session.calendarEvent.endTime.getTime() - session.calendarEvent.startTime.getTime()) / 60000,
        );
      }

      const sessionTitle = session.calendarEvent?.title || session.trainingSession?.title || 'Allenamento';
      const sessionDate = session.calendarEvent?.startTime || session.trainingSession?.date || session.startedAt;

      // Una TrainingSession per ogni giocatore presente con un RPE: il carico
      // (sRPE = RPE × durata) entra così negli analytics già esistenti.
      // Chi non ha un RPE proprio eredita quello di sessione.
      const createdSessions: string[] = [];
      let skippedNoRpe = 0;

      for (const entry of presentEntries) {
        const rpe = entry.rpe ?? session.sessionRpe ?? null;
        if (!rpe || !durationMinutes || durationMinutes < 1) {
          skippedNoRpe++;
          continue;
        }

        const ts = await app.prisma.trainingSession.create({
          data: {
            title: `${sessionTitle} — ${entry.athlete.firstName} ${entry.athlete.lastName}`,
            date: sessionDate,
            duration: durationMinutes,
            rpe,
            status: 'COMPLETED',
            notes: `Presenza registrata. Carico ${rpe * durationMinutes} (RPE ${rpe} × ${durationMinutes} min).`,
            athleteId: entry.athleteId,
            organizationId,
          },
        });
        createdSessions.push(ts.id);
      }

      // Se il foglio appartiene a una sessione della programmazione, quella
      // riga di squadra non va più attribuita a tutta la rosa: adesso il
      // carico arriva dalle righe per singolo atleta appena create.
      if (session.trainingSessionId && createdSessions.length > 0) {
        await app.prisma.trainingSession.update({
          where: { id: session.trainingSessionId },
          data: { detailedByAttendance: true, status: 'COMPLETED' },
        });
      }

      return reply.send({
        success: true,
        data: {
          completed: true,
          trainingSessions: createdSessions.length,
          skippedNoRpe,
          sessionIds: createdSessions,
        },
      });
    },
  );
}
