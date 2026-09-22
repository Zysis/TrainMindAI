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
import { fullName, ordinaVoci } from '../lib/identity.js';

export async function gameTrackingRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate, requireMinRole('TRAINER')] };

  const athleteSelect = { id: true, jerseyNumber: true, position: true, identity: { select: { firstName: true, lastName: true } } };

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
      //
      // findFirst e non findUnique: findUnique accetta nel where solo campi
      // unici, quindi non lascia aggiungere organizationId — ed e' cosi' che
      // era nato il buco. Senza quel filtro questa scorciatoia restituiva la
      // sessione completa (nomi degli atleti, numeri di maglia, avversario)
      // a chiunque conoscesse un calendarEventId, anche di un'altra societa'.
      // Il controllo c'era gia' venti righe piu' sotto, in GET /game/by-event.
      const existing = ordinaVoci(await app.prisma.gameSession.findFirst({
        where: { calendarEventId, organizationId },
        include: {
          entries: {
            include: { athlete: { select: athleteSelect } },
          },
          team: { select: { id: true, name: true, color: true } },
          calendarEvent: { select: { id: true, title: true, startTime: true, endTime: true, type: true, opponent: true, isHome: true, venue: true } },
        },
      }));
      if (existing) {
        return reply.send({ success: true, data: { session: existing, created: false } });
      }

      // Verify calendar event
      const calendarEvent = await app.prisma.calendarEvent.findFirst({
        // Per organizzazione e non per utente: dal 2/9/2026 il calendario e'
        // della societa', e avviare la partita su un evento creato da un
        // collega non deve piu' rispondere "evento non trovato".
        where: { id: calendarEventId, organizationId },
      });
      if (!calendarEvent) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Evento calendario non trovato (id: ${calendarEventId})` } });
      }

      // La squadra puo' arrivare dal corpo della richiesta: va verificata,
      // altrimenti la sessione nasce popolata con la rosa di un'altra
      // societa' — e quelle entry restano scritte, finendo negli export e
      // nei report. Quella presa dall'evento di calendario e' gia' sicura:
      // l'evento e' stato appena verificato come dell'utente.
      if (teamId) {
        const team = await app.prisma.team.findFirst({ where: { id: teamId, organizationId } });
        if (!team) {
          return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Squadra non trovata' } });
        }
      }

      const effectiveTeamId = teamId || calendarEvent.teamId;

      // Load athletes from team
      let athleteIds: string[] = [];
      if (effectiveTeamId) {
        const teamAthletes = await app.prisma.athleteTeam.findMany({
          where: { teamId: effectiveTeamId, athlete: { organizationId } },
          select: { athleteId: true },
        });
        athleteIds = teamAthletes.map((at) => at.athleteId);
      }

      let session;
      try {
        session = ordinaVoci(await app.prisma.gameSession.create({
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
            },
            team: { select: { id: true, name: true, color: true } },
            calendarEvent: { select: { id: true, title: true, startTime: true, endTime: true, type: true, opponent: true, isHome: true, venue: true } },
          },
        }));
      } catch (createErr) {
        // Race condition
        const raceSession = ordinaVoci(await app.prisma.gameSession.findFirst({
          where: { calendarEventId, organizationId },
          include: {
            entries: {
              include: { athlete: { select: athleteSelect } },
            },
            team: { select: { id: true, name: true, color: true } },
            calendarEvent: { select: { id: true, title: true, startTime: true, endTime: true, type: true, opponent: true, isHome: true, venue: true } },
          },
        }));
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
        const session = ordinaVoci(await app.prisma.gameSession.findUnique({
          where: { calendarEventId: request.params.eventId },
          include: {
            entries: {
              include: { athlete: { select: athleteSelect } },
            },
            team: { select: { id: true, name: true, color: true } },
            calendarEvent: { select: { id: true, title: true, startTime: true, endTime: true, type: true, opponent: true, isHome: true, venue: true } },
          },
        }));

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
      const session = ordinaVoci(await app.prisma.gameSession.findFirst({
        where: { id: request.params.id, organizationId: request.user.organizationId },
        include: {
          entries: {
            include: { athlete: { select: athleteSelect } },
          },
          team: { select: { id: true, name: true, color: true } },
          calendarEvent: { select: { id: true, title: true, startTime: true, endTime: true, type: true, opponent: true, isHome: true, venue: true } },
        },
      }));

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
          // Quante volte il cronometro si e' fermato mentre il giocatore era in
          // campo. Facoltativo: le partite salvate prima non ce l'hanno.
          breaks: z.number().int().min(0).optional(),
        })),
        onCourt: z.boolean(),
        // RPE post-partita del singolo. null = non ancora raccolto.
        rpe: z.number().int().min(1).max(10).nullable().optional(),
        // Aspettativa 0-5 per la seduta successiva, compilata nel report.
        readiness: z.number().int().min(0).max(5).nullable().optional(),
        readinessNote: z.string().max(500).nullable().optional(),
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
              rpe: entry.rpe ?? null,
              // `undefined` lascia il valore com'e': il foglio di campo salva
              // le entries senza conoscere la readiness, e non deve azzerarla.
              readiness: entry.readiness === undefined ? undefined : entry.readiness,
              readinessNote: entry.readinessNote === undefined ? undefined : entry.readinessNote,
            },
            create: {
              gameSessionId: session.id,
              athleteId: entry.athleteId,
              totalPlayingMs: entry.totalPlayingMs,
              stints: entry.stints as unknown as Prisma.InputJsonValue,
              onCourt: entry.onCourt,
              rpe: entry.rpe ?? null,
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
  // ─── PUT /game/:id/match-info ──────────────────────────
  // Risultato e competizione. Endpoint a se' e non parte di /complete perche'
  // un punteggio si corregge anche dopo, e riaprire una partita completata
  // solo per sistemare un tabellone sbagliato sarebbe assurdo.
  app.put<{ Params: { id: string } }>(
    '/game/:id/match-info',
    auth,
    async (request, reply) => {
      const schema = z.object({
        homeScore: z.number().int().min(0).max(300).nullable().optional(),
        awayScore: z.number().int().min(0).max(300).nullable().optional(),
        competition: z.string().max(100).nullable().optional(),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Dati non validi' } });
      }
      const existing = await app.prisma.gameSession.findFirst({
        where: { id: request.params.id, organizationId: request.user.organizationId },
        select: { id: true },
      });
      if (!existing) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione partita non trovata' } });
      }
      const updated = await app.prisma.gameSession.update({
        where: { id: existing.id },
        data: {
          homeScore: parsed.data.homeScore ?? null,
          awayScore: parsed.data.awayScore ?? null,
          competition: parsed.data.competition?.trim() || null,
        },
        select: { id: true, homeScore: true, awayScore: true, competition: true },
      });
      return reply.send({ success: true, data: updated });
    },
  );

  app.put<{ Params: { id: string } }>(
    '/game/:id/complete',
    auth,
    async (request, reply) => {
      const session = await app.prisma.gameSession.findFirst({
        where: { id: request.params.id, organizationId: request.user.organizationId },
        include: {
          entries: { include: { athlete: { select: { id: true, identity: { select: { firstName: true, lastName: true } } } } } },
          calendarEvent: { select: { title: true, startTime: true } },
        },
      });
      if (!session) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione partita non trovata' } });
      }

      const { organizationId } = request.user;

      // Chiusura idempotente. Ogni chiusura crea una TrainingSession per
      // giocatore, cioe' carico che entra nell'ACWR: una seconda chiamata —
      // doppio click, due schede, un retry di rete della PWA — duplicava
      // tutte le righe e raddoppiava il carico di quel giorno. L'update
      // condizionato e' atomico: di due richieste concorrenti ne passa una.
      const closed = await app.prisma.gameSession.updateMany({
        where: { id: session.id, status: { not: 'COMPLETED' } },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      if (closed.count === 0) {
        return reply.status(409).send({
          success: false,
          error: { code: 'SESSION_ALREADY_COMPLETED', message: 'Partita gia\' completata' },
        });
      }

      // Una TrainingSession per giocatore, come per l'allenamento sul campo.
      // Con l'RPE del singolo la riga porta anche il carico (sRPE = RPE x
      // minuti); senza, resta la riga dei soli minuti — meglio di niente, e
      // inventare un RPE falserebbe il carico.
      const createdSessions: string[] = [];
      let withoutRpe = 0;
      for (const entry of session.entries) {
        if (entry.totalPlayingMs <= 0) continue;

        const durationMinutes = Math.round(entry.totalPlayingMs / 60000);
        if (durationMinutes < 1) continue;

        const stintsArray = (entry.stints as Array<{ quarter: number; durationMs: number; breaks?: number }>) || [];
        const stintsText = stintsArray.map((s) => {
          const br = s.breaks ?? 0;
          return `Q${s.quarter}: ${Math.round(s.durationMs / 60000)} min${br > 0 ? ` (${br} interruzioni)` : ''}`;
        }).join(', ');

        const rpe = entry.rpe ?? null;
        if (!rpe) withoutRpe++;
        const loadNote = rpe
          ? ` Carico ${rpe * durationMinutes} (RPE ${rpe} x ${durationMinutes} min).`
          : ' RPE non raccolto: nessun carico calcolato.';

        const ts = await app.prisma.trainingSession.create({
          data: {
            title: `${session.calendarEvent?.title || 'Partita'} — ${fullName(entry.athlete)}`,
            date: session.calendarEvent?.startTime || session.startedAt,
            duration: durationMinutes,
            rpe,
            status: 'COMPLETED',
            notes: `Minuti partita: ${durationMinutes} min. ${stintsArray.length} stint. ${stintsText}.${loadNote}`,
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
          withoutRpe,
          sessionIds: createdSessions,
        },
      });
    },
  );
}
