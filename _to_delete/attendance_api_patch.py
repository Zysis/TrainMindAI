# -*- coding: utf-8 -*-
"""API foglio presenze: sessioni della programmazione, RPE per atleta, carico."""
import io

p = 'trainmind-app/apps/api/src/routes/field-training.ts'
s = io.open(p, encoding='utf-8').read()


def sub(old, new, label):
    global s
    assert s.count(old) == 1, 'ancora "%s" non trovata o non unica' % label
    s = s.replace(old, new)


# ── intestazione ────────────────────────────────────────────────────────
sub(" *   GET    /field-training/by-event/:eventId  get session by calendar event id\n",
    " *   GET    /field-training/by-event/:eventId  get session by calendar event id\n"
    " *   GET    /field-training/by-session/:sessionId  get session by training session id\n",
    'doc header')

# ── POST /start: evento di calendario oppure sessione di programmazione ──
sub("""      const schema = z.object({
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

      const effectiveTeamId = teamId || calendarEvent.teamId;""",
    """      const schema = z.object({
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
      const existing = await app.prisma.fieldTrainingSession.findFirst({
        where: calendarEventId ? { calendarEventId } : { trainingSessionId },
        include: {
          entries: {
            include: { athlete: { select: { id: true, firstName: true, lastName: true, jerseyNumber: true, position: true } } },
          },
        },
      });
      if (existing) {
        return reply.send({ success: true, data: { session: existing, created: false } });
      }

      let effectiveTeamId: string | null = teamId || null;
      let defaultDuration: number | null = null;

      if (calendarEventId) {
        const calendarEvent = await app.prisma.calendarEvent.findFirst({
          where: { id: calendarEventId, userId: request.user.userId },
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
          include: { week: { select: { trainingPlan: { select: { teamId: true } } } } },
        });
        if (!trainingSession) {
          return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Sessione non trovata (id: ${trainingSessionId})` } });
        }
        effectiveTeamId = effectiveTeamId || trainingSession.week?.trainingPlan?.teamId || null;
        defaultDuration = trainingSession.duration || null;
      }""",
    'POST /start')

sub("""        session = await app.prisma.fieldTrainingSession.create({
          data: {
            calendarEventId,
            teamId: effectiveTeamId || null,
            organizationId,""",
    """        session = await app.prisma.fieldTrainingSession.create({
          data: {
            calendarEventId: calendarEventId || null,
            trainingSessionId: trainingSessionId || null,
            durationMinutes: defaultDuration,
            teamId: effectiveTeamId || null,
            organizationId,""",
    'create foglio')

sub("""        // Race condition: session was created between findUnique and create
        const raceSession = await app.prisma.fieldTrainingSession.findUnique({
          where: { calendarEventId },""",
    """        // Race condition: session was created between findUnique and create
        const raceSession = await app.prisma.fieldTrainingSession.findFirst({
          where: calendarEventId ? { calendarEventId } : { trainingSessionId },""",
    'race condition')

# ── GET by-session ──────────────────────────────────────────────────────
sub("""  // ─── GET /field-training/:id ────────────────────────────""",
    """  // ─── GET /field-training/by-session/:sessionId ──────────
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

        return reply.send({ success: true, data: { session } });
      } catch (err) {
        request.log.error(err, 'field-training/by-session error');
        const message = err instanceof Error ? err.message : 'Errore caricamento sessione';
        return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message } });
      }
    },
  );

  // ─── GET /field-training/:id ────────────────────────────""",
    'GET by-session')

# by-event deve restituire anche la sessione di piano collegata (per il titolo)
sub("""            team: { select: { id: true, name: true, color: true } },
            calendarEvent: { select: { id: true, title: true, startTime: true, endTime: true, type: true } },
          },
        });

        if (!session || session.organizationId !== request.user.organizationId) {""",
    """            team: { select: { id: true, name: true, color: true } },
            calendarEvent: { select: { id: true, title: true, startTime: true, endTime: true, type: true } },
            trainingSession: { select: { id: true, title: true, date: true, duration: true } },
          },
        });

        if (!session || session.organizationId !== request.user.organizationId) {""",
    'by-event include trainingSession')

# ── roster: RPE per atleta, durata effettiva, RPE di sessione ───────────
sub("""      const schema = z.object({
        availableAthletes: z.number().int().min(0).max(999).nullable().optional(),
        athletes: z.array(z.object({
          athleteId: z.string().min(1),
          status: statusEnum,
          note: z.string().max(500).nullable().optional(),
        })).max(200),""",
    """      const schema = z.object({
        availableAthletes: z.number().int().min(0).max(999).nullable().optional(),
        durationMinutes: z.number().int().min(0).max(600).nullable().optional(),
        sessionRpe: z.number().int().min(1).max(10).nullable().optional(),
        athletes: z.array(z.object({
          athleteId: z.string().min(1),
          status: statusEnum,
          note: z.string().max(500).nullable().optional(),
          rpe: z.number().int().min(1).max(10).nullable().optional(),
        })).max(200),""",
    'schema roster')

sub("""            guests: parsed.data.guests as unknown as Prisma.InputJsonValue,
            ...(parsed.data.availableAthletes !== undefined
              ? { availableAthletes: parsed.data.availableAthletes }
              : {}),""",
    """            guests: parsed.data.guests as unknown as Prisma.InputJsonValue,
            ...(parsed.data.availableAthletes !== undefined
              ? { availableAthletes: parsed.data.availableAthletes }
              : {}),
            ...(parsed.data.durationMinutes !== undefined
              ? { durationMinutes: parsed.data.durationMinutes }
              : {}),
            ...(parsed.data.sessionRpe !== undefined
              ? { sessionRpe: parsed.data.sessionRpe }
              : {}),""",
    'update foglio nel roster')

sub("""            update: { status: a.status, note: a.note ?? null },
            create: {
              fieldTrainingSessionId: session.id,
              athleteId: a.athleteId,
              status: a.status,
              note: a.note ?? null,
              totalActiveMs: 0,
              laps: [],
            },""",
    """            update: { status: a.status, note: a.note ?? null, rpe: a.rpe ?? null },
            create: {
              fieldTrainingSessionId: session.id,
              athleteId: a.athleteId,
              status: a.status,
              note: a.note ?? null,
              rpe: a.rpe ?? null,
              totalActiveMs: 0,
              laps: [],
            },""",
    'upsert entry con rpe')

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('  patched', p)
