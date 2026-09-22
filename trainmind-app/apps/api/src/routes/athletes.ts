import type { FastifyInstance } from 'fastify';
import { createAthleteSchema, updateAthleteSchema, athleteQuerySchema } from '../schemas/athletes.js';
import { requireMinRole } from '../middleware/rbac.js';
import { sendError, notFound, handleValidation, AppError } from '../lib/api-errors.js';
import { findOrgEntity } from '../lib/org-guard.js';
import { splitAthletePayload } from '../lib/identity.js';

export async function athleteRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', app.authenticate);

  // ─── GET /athletes — List with pagination/filters/search ──
  app.get('/athletes', async (request, reply) => {
    const query = athleteQuerySchema.parse(request.query);
    const { organizationId } = request.user;
    const { page, limit, search, position, isActive, sortBy, sortOrder, teamId } = query;

    const where: Record<string, unknown> = { organizationId };

    if (position) where.position = position;
    // Un atleta archiviato non deve comparire da nessuna parte: liste, filtri,
    // menu a tendina, "Aggiungi Esistente". Chi lo vuole vedere lo chiede.
    if (isActive === 'all') {
      // niente filtro: attivi e archiviati insieme
    } else {
      where.isActive = isActive === undefined ? true : isActive === 'true';
    }
    if (teamId) {
      where.athleteTeams = { some: { teamId } };
    }

    const perNome = sortBy === 'firstName' || sortBy === 'lastName';

    // Ricerca e ordinamento per nome NON possono passare da SQL: nome e cognome
    // sono cifrati, e un `contains` su testo cifrato non trova niente mentre un
    // `orderBy` ordina per ciphertext. Entrambi darebbero un risultato sbagliato
    // senza alcun errore. Si caricano quindi le anagrafiche della sola
    // organizzazione — decifrate dal client — e si filtra e ordina in memoria.
    //
    // Questo percorso si usa SEMPRE, anche quando la cifratura non e' attiva.
    // Farlo dipendere dalla chiave significherebbe che in sviluppo gira un
    // ramo e in produzione un altro, e quello di produzione arriverebbe agli
    // utenti senza essere mai stato eseguito dai test.
    if (search || perNome) {
      const tutti = await app.prisma.athlete.findMany({
        where,
        select: { id: true, identity: { select: { firstName: true, lastName: true } } },
      });

      const ago = search?.trim().toLowerCase();
      const filtrati = ago
        ? tutti.filter((a) => {
            const n = (a.identity?.firstName ?? '').toLowerCase();
            const c = (a.identity?.lastName ?? '').toLowerCase();
            return n.includes(ago) || c.includes(ago) || `${n} ${c}`.includes(ago);
          })
        : tutti;

      const verso = sortOrder === 'desc' ? -1 : 1;
      const chiave = (a: (typeof filtrati)[number]) =>
        perNome
          ? `${a.identity?.[sortBy as 'firstName' | 'lastName'] ?? ''}`
          : '';
      filtrati.sort((x, y) => verso * chiave(x).localeCompare(chiave(y), 'it', { sensitivity: 'base' }));

      const total = filtrati.length;
      const idPagina = filtrati.slice((page - 1) * limit, page * limit).map((a) => a.id);

      const righe = await app.prisma.athlete.findMany({
        where: { id: { in: idPagina } },
        include: {
          identity: true,
          athleteTeams: {
            include: { team: { select: { id: true, name: true, color: true } } },
          },
        },
      });

      // `in` non garantisce l'ordine: si rimette quello calcolato sopra.
      const perId = new Map(righe.map((r) => [r.id, r]));
      const athletes = idPagina.map((id) => perId.get(id)).filter(Boolean);

      return reply.send({
        success: true,
        data: athletes,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }

    // Nessun nome di mezzo: l'ordinamento e la paginazione restano a SQL.
    const [athletes, total] = await Promise.all([
      app.prisma.athlete.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          identity: true,
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
        identity: true,
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

    // Il corpo della richiesta resta piatto (il client non e' cambiato): qui
    // si divide fra riga dati e caveau. Vedi lib/identity.ts.
    const { teamId, ...athleteData } = data;
    const { core } = splitAthletePayload(athleteData);
    const dateOfBirth = new Date(data.dateOfBirth);

    try {
      // Creazione e iscrizione alla squadra nella stessa transazione: o
      // l'atleta nasce gia' in rosa, o non nasce affatto.
      const athlete = await app.prisma.$transaction(async (tx) => {
        if (teamId) {
          const team = await tx.team.findFirst({
            where: { id: teamId, organizationId },
            select: { id: true },
          });
          if (!team) {
            throw new AppError(400, 'INVALID_TEAM', 'Squadra non trovata');
          }
        }

        // Due passi invece di uno, dentro la transazione che c'era gia'.
        //
        // L'anagrafica e' cifrata con l'athleteId come dato associato (AAD),
        // che lega il cifrato alla sua riga. In un `create` annidato l'id non
        // esiste ancora — lo genera il motore da `@default(cuid())` — quindi
        // l'AAD non sarebbe calcolabile. Si crea prima l'atleta, poi
        // l'anagrafica con l'id appena ottenuto. La transazione garantisce che
        // o ci sono entrambi o non c'e' nessuno dei due, come prima.
        const atleta = await tx.athlete.create({
          data: {
            ...core,
            birthYear: dateOfBirth.getFullYear(),
            organizationId,
          },
        });

        await tx.athleteIdentity.create({
          data: {
            athleteId: atleta.id,
            firstName: data.firstName,
            lastName: data.lastName,
            dateOfBirth,
            email: data.email,
            photoUrl: data.photoUrl,
          },
        });

        const created = await tx.athlete.findUniqueOrThrow({
          where: { id: atleta.id },
          include: { identity: true },
        });

        if (teamId) {
          await tx.athleteTeam.create({ data: { athleteId: created.id, teamId } });
        }

        return created;
      });

      return reply.status(201).send({ success: true, data: athlete });
    } catch (error) {
      if (error instanceof AppError) return sendError(reply, error);
      throw error;
    }
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

    const { core, identity } = splitAthletePayload(data);
    const dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : undefined;
    const identityUpdate = { ...identity, ...(dateOfBirth ? { dateOfBirth } : {}) };

    const athlete = await app.prisma.athlete.update({
      where: { id },
      data: {
        ...core,
        // L'anno resta anche sulla riga dati: serve alle norme per eta'.
        ...(dateOfBirth ? { birthYear: dateOfBirth.getFullYear() } : {}),
        ...(Object.keys(identityUpdate).length > 0 ? { identity: { update: identityUpdate } } : {}),
      },
      include: { identity: true },
    });
    return reply.send({ success: true, data: athlete });
  });

  // ─── DELETE /athletes/:id — Archiviazione ─────────────────
  // L'atleta esce da TUTTE le rose e sparisce da liste e filtri, ma resta nel
  // database con il suo storico: si ripristina, e lo si puo' rimettere in una
  // squadra qualsiasi. Non e' una cancellazione: per quella c'e' /erase.
  app.delete<{ Params: { id: string } }>('/athletes/:id', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const { id } = request.params;
    const { organizationId } = request.user;

    await findOrgEntity(app, 'athlete', id, organizationId);

    const { teamsLeft } = await app.prisma.$transaction(async (tx) => {
      const removed = await tx.athleteTeam.deleteMany({ where: { athleteId: id } });
      await tx.athlete.update({ where: { id }, data: { isActive: false } });
      return { teamsLeft: removed.count };
    });

    request.log.info({ athleteId: id, teamsLeft }, 'athlete archived');
    return reply.send({ success: true, data: { archived: true, teamsLeft } });
  });

  // ─── POST /athletes/:id/restore — Ripristino ──────────────
  // Torna attivo, ma senza squadre: si riassegna con "Aggiungi Esistente".
  app.post<{ Params: { id: string } }>('/athletes/:id/restore', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const { id } = request.params;
    const { organizationId } = request.user;

    await findOrgEntity(app, 'athlete', id, organizationId);

    const athlete = await app.prisma.athlete.update({
      where: { id },
      data: { isActive: true },
    });

    request.log.info({ athleteId: id }, 'athlete restored');
    return reply.send({ success: true, data: athlete });
  });

  // ─── GET /athletes/:id/training — programmato e svolto ────
  //
  // Mette insieme le tre cose che vivono in posti diversi:
  //  1. i mesocicli **individuali** (TrainingPlan.athleteId = lui);
  //  2. i mesocicli **di squadra** delle squadre a cui appartiene — per un
  //     giocatore di movimento sono quasi sempre gli unici popolati;
  //  3. gli allenamenti **svolti**, cioe' le TrainingSession con il suo
  //     athleteId e stato COMPLETED. Nascono dal foglio presenze
  //     (`PUT /field-training/:id/complete`) e portano RPE e durata, da cui
  //     il carico. Non hanno weekId: sono il registro, non la programmazione.
  //
  // Le presenze vere si contano sui fogli, non sulle sessioni: un atleta
  // assente non genera nessuna TrainingSession, quindi contando solo quelle
  // il rapporto svolto/pianificato sarebbe muto sulle assenze.
  app.get<{ Params: { id: string } }>('/athletes/:id/training', async (request, reply) => {
    const { id } = request.params;
    const { organizationId } = request.user;

    const athlete = await app.prisma.athlete.findFirst({
      where: { id, organizationId },
      select: { id: true, athleteTeams: { select: { teamId: true } } },
    });
    if (!athlete) return sendError(reply, notFound('Athlete'));

    const teamIds = athlete.athleteTeams.map((t) => t.teamId);

    const [plans, completed, entries, events] = await Promise.all([
      app.prisma.trainingPlan.findMany({
        where: {
          organizationId,
          OR: [
            { athleteId: id },
            ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : []),
          ],
        },
        orderBy: { startDate: 'desc' },
        include: {
          team: { select: { id: true, name: true } },
          weeks: {
            orderBy: { weekNumber: 'asc' },
            include: {
              trainingSessions: {
                orderBy: [{ date: 'asc' }, { title: 'asc' }],
                select: {
                  id: true, title: true, date: true, duration: true,
                  status: true, rpe: true,
                  _count: { select: { sessionExercises: true } },
                },
              },
            },
          },
        },
      }),

      app.prisma.trainingSession.findMany({
        where: { athleteId: id, status: 'COMPLETED' },
        orderBy: { date: 'desc' },
        take: 500,
        select: { id: true, title: true, date: true, duration: true, rpe: true, weekId: true },
      }),

      app.prisma.fieldTrainingEntry.findMany({
        where: { athleteId: id, fieldTrainingSession: { organizationId } },
        select: {
          status: true,
          fieldTrainingSession: { select: { status: true, startedAt: true } },
        },
      }),

      // Eventi creati a mano dal Calendario che lo coinvolgono: o perche'
      // intestati a lui, o perche' rivolti a una sua squadra. `sessionId`
      // valorizzato vuol dire che l'evento rispecchia una sessione di piano,
      // gia' mostrata sotto il suo mesociclo: si escluderebbe due volte.
      //
      // Nota: CalendarEvent non ha organizationId, e' legato all'utente che
      // l'ha creato. Il filtro resta comunque dentro l'organizzazione perche'
      // `teamIds` viene dall'atleta, che e' stato verificato sopra.
      app.prisma.calendarEvent.findMany({
        where: {
          sessionId: null,
          OR: [
            { athleteId: id },
            ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : []),
          ],
        },
        orderBy: { startTime: 'desc' },
        take: 300,
        select: {
          id: true, title: true, type: true, startTime: true, endTime: true,
          athleteId: true,
          team: { select: { id: true, name: true } },
          fieldTrainingSession: { select: { id: true, status: true } },
        },
      }),
    ]);

    // Solo i fogli chiusi contano: uno aperto e' un allenamento non ancora svolto.
    const closed = entries.filter((e) => e.fieldTrainingSession.status === 'COMPLETED');
    const present = closed.filter((e) => e.status === 'PRESENT').length;

    const plannedSessions = plans.reduce(
      (n, plan) => n + plan.weeks.reduce((m, w) => m + w.trainingSessions.length, 0),
      0,
    );

    const withLoad = completed.filter((c) => c.rpe && c.duration);
    const totalLoad = withLoad.reduce((n, c) => n + (c.rpe as number) * (c.duration as number), 0);
    const avgRpe = withLoad.length > 0
      ? Math.round((withLoad.reduce((n, c) => n + (c.rpe as number), 0) / withLoad.length) * 10) / 10
      : null;

    return reply.send({
      success: true,
      data: {
        plans: plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          description: plan.description,
          startDate: plan.startDate,
          endDate: plan.endDate,
          aiGenerated: plan.aiGenerated,
          trainingDays: plan.trainingDays,
          source: plan.athleteId === id ? 'individual' : 'team',
          teamName: plan.team?.name ?? null,
          weeks: plan.weeks.map((w) => ({
            id: w.id,
            weekNumber: w.weekNumber,
            sessions: w.trainingSessions.map((x) => ({
              id: x.id,
              title: x.title,
              date: x.date,
              duration: x.duration,
              status: x.status,
              rpe: x.rpe,
              exerciseCount: x._count.sessionExercises,
            })),
          })),
        })),
        events: events.map((e) => ({
          id: e.id,
          title: e.title,
          type: e.type,
          startTime: e.startTime,
          endTime: e.endTime,
          teamName: e.team?.name ?? null,
          // intestato al singolo atleta, non alla squadra
          personal: e.athleteId === id,
          sheetId: e.fieldTrainingSession?.id ?? null,
          sheetStatus: e.fieldTrainingSession?.status ?? null,
        })),
        completed: completed.map((c) => ({
          id: c.id,
          title: c.title,
          date: c.date,
          duration: c.duration,
          rpe: c.rpe,
          load: c.rpe && c.duration ? c.rpe * c.duration : null,
          // true = riga nata dal foglio presenze, non da una settimana di piano
          fromAttendance: c.weekId === null,
        })),
        summary: {
          plansCount: plans.length,
          eventsCount: events.length,
          plannedSessions,
          completedSessions: completed.length,
          sheetsClosed: closed.length,
          present,
          attendanceRate: closed.length > 0
            ? Math.round((present / closed.length) * 1000) / 10
            : null,
          totalLoad,
          avgRpe,
        },
      },
    });
  });
}
