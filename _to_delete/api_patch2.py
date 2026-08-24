# -*- coding: utf-8 -*-
"""Endpoint roster (semaforo presenze + ospiti) e nuovo Completa Sessione."""
import io

p = 'trainmind-app/apps/api/src/routes/field-training.ts'
s = io.open(p, encoding='utf-8').read()

# ── 1. doc header ──────────────────────────────────────────
old = " *   PUT    /field-training/:id/exercises     save exercises + available athletes\n"
new = (" *   PUT    /field-training/:id/exercises     save exercises + available athletes\n"
       " *   PUT    /field-training/:id/roster        save attendance (traffic light) + guest players\n")
assert s.count(old) == 1, 'doc header'
s = s.replace(old, new)

# ── 2. nuovo endpoint roster, prima di POST /:id/athletes ──
anchor = "  // ─── POST /field-training/:id/athletes ──────────────────\n"
assert s.count(anchor) == 1, 'anchor athletes'

roster = '''  // ─── PUT /field-training/:id/roster ─────────────────────
  // Presenze col semaforo (verde/giallo/rosso) + giocatori ospiti di sessione
  app.put<{ Params: { id: string } }>(
    '/field-training/:id/roster',
    auth,
    async (request, reply) => {
      const statusEnum = z.enum(['PRESENT', 'UNAVAILABLE', 'ABSENT']);
      const schema = z.object({
        availableAthletes: z.number().int().min(0).max(999).nullable().optional(),
        athletes: z.array(z.object({
          athleteId: z.string().min(1),
          status: statusEnum,
          note: z.string().max(500).nullable().optional(),
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
            update: { status: a.status, note: a.note ?? null },
            create: {
              fieldTrainingSessionId: session.id,
              athleteId: a.athleteId,
              status: a.status,
              note: a.note ?? null,
              totalActiveMs: 0,
              laps: [],
            },
          }),
        ),
      ]);

      return reply.send({ success: true, data: { athletes: parsed.data.athletes.length, guests: parsed.data.guests.length } });
    },
  );

'''
s = s.replace(anchor, roster + anchor)

# ── 3. nuovo corpo di /complete ────────────────────────────
old_complete = '''      // For each athlete with active time > 0, create/update a TrainingSession
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
'''

new_complete = '''      // Effettivo per giocatore della seduta, ricalcolato dagli esercizi salvati:
      //   netto = attività − pause
      //   effettivo = netto × (giocatori impiegati / atleti disponibili)
      // Gli atleti disponibili sono i semafori verdi (atleti in rosa + ospiti).
      type StoredExercise = { players?: number; activityMs?: number; pauseMs?: number };
      const exercises = Array.isArray(session.exercises)
        ? (session.exercises as unknown as StoredExercise[])
        : [];
      const guests = Array.isArray(session.guests)
        ? (session.guests as unknown as Array<{ status?: string }>)
        : [];
      const presentEntries = session.entries.filter((e) => e.status === 'PRESENT');
      const presentGuests = guests.filter((g) => g.status === 'PRESENT').length;
      const available = presentEntries.length + presentGuests || session.availableAthletes || 0;

      let effectiveMs = 0;
      if (available > 0) {
        for (const ex of exercises) {
          const net = (Number(ex.activityMs) || 0) - (Number(ex.pauseMs) || 0);
          effectiveMs += net * ((Number(ex.players) || 0) / available);
        }
      }
      const effectiveMinutes = Math.round(effectiveMs / 60000);

      // Una TrainingSession per ogni giocatore presente, così il dato entra
      // negli analytics (sRPE, ACWR, grafici di carico).
      const createdSessions: string[] = [];
      for (const entry of presentEntries) {
        // Fallback per le sessioni vecchie, registrate coi cronometri per atleta
        const legacyMinutes = Math.round(entry.totalActiveMs / 60000);
        const durationMinutes = effectiveMinutes >= 1 ? effectiveMinutes : legacyMinutes;
        if (durationMinutes < 1) continue;

        const notes = effectiveMinutes >= 1
          ? `Presente all'allenamento in campo. Effettivo per giocatore: ${durationMinutes} min su ${exercises.length} esercizi, ${available} giocatori disponibili.`
          : `Tempo attivo registrato con cronometro: ${durationMinutes} min.`;

        const ts = await app.prisma.trainingSession.create({
          data: {
            title: `${session.calendarEvent?.title || 'Allenamento in campo'} — ${entry.athlete.firstName} ${entry.athlete.lastName}`,
            date: session.calendarEvent?.startTime || session.startedAt,
            duration: durationMinutes,
            status: 'COMPLETED',
            notes,
            athleteId: entry.athleteId,
            organizationId,
          },
        });
        createdSessions.push(ts.id);
      }
'''
assert s.count(old_complete) == 1, 'blocco complete non trovato'
s = s.replace(old_complete, new_complete)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('api ok')
