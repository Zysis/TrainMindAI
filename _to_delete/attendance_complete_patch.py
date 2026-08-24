# -*- coding: utf-8 -*-
"""Completa sessione: carico = RPE del singolo × durata effettiva."""
import io

p = 'trainmind-app/apps/api/src/routes/field-training.ts'
s = io.open(p, encoding='utf-8').read()


def sub(old, new, label):
    global s
    assert s.count(old) == 1, 'ancora "%s" non trovata o non unica' % label
    s = s.replace(old, new)


# serve anche la sessione di piano collegata
sub("""          entries: { include: { athlete: { select: { id: true, firstName: true, lastName: true } } } },
          calendarEvent: { select: { title: true, startTime: true } },
        },
      });""",
    """          entries: { include: { athlete: { select: { id: true, firstName: true, lastName: true } } } },
          calendarEvent: { select: { title: true, startTime: true, endTime: true } },
          trainingSession: { select: { id: true, title: true, date: true, duration: true } },
        },
      });""",
    'include complete')

old_block = """      // Effettivo per giocatore della seduta, ricalcolato dagli esercizi salvati:
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
"""

new_block = """      const presentEntries = session.entries.filter((e) => e.status === 'PRESENT');

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
"""

sub(old_block, new_block, 'blocco complete')

sub("""        data: {
          completed: true,
          trainingSessions: createdSessions.length,
          sessionIds: createdSessions,
        },""",
    """        data: {
          completed: true,
          trainingSessions: createdSessions.length,
          skippedNoRpe,
          sessionIds: createdSessions,
        },""",
    'risposta complete')

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('  patched', p)

# ── analytics/report: la riga di squadra "dettagliata" non si attribuisce ──
GUARD = """      } else {
        // Team session → attribute to all team athletes"""

for path, pairs in [
    ('trainmind-app/apps/api/src/routes/analytics.ts', None),
    ('trainmind-app/apps/api/src/routes/reports.ts', None),
]:
    src = io.open(path, encoding='utf-8').read()
    n = 0
    # ogni ramo "else" che attribuisce una sessione senza athleteId alla squadra
    for old, new in [
        ("""      } else {
        // Team session → attribute to all athletes in team
        const teamId = s.week?.trainingPlan?.teamId;""",
         """      } else if (!s.detailedByAttendance) {
        // Team session → attribute to all athletes in team.
        // Saltata quando il foglio presenze ha già generato le righe per
        // singolo atleta: altrimenti il carico si conterebbe due volte.
        const teamId = s.week?.trainingPlan?.teamId;"""),
        ("""      } else {
        const sessTeamId = s.week?.trainingPlan?.teamId;""",
         """      } else if (!s.detailedByAttendance) {
        // Vedi sopra: niente doppio conteggio con le presenze registrate.
        const sessTeamId = s.week?.trainingPlan?.teamId;"""),
        ("""    } else {
      // Team-plan session → attribute to all team athletes
      const sessTeamId = s.week?.trainingPlan?.teamId;""",
         """    } else if (!s.detailedByAttendance) {
      // Team-plan session → attribute to all team athletes.
      // Saltata se le presenze hanno già prodotto le righe per atleta.
      const sessTeamId = s.week?.trainingPlan?.teamId;"""),
    ]:
        if old in src:
            src = src.replace(old, new)
            n += 1
    io.open(path, 'w', encoding='utf-8', newline='').write(src)
    print('  patched %s (%d rami)' % (path, n))
