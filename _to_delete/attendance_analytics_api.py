# -*- coding: utf-8 -*-
"""GET /analytics/attendance — presenze, RPE medio e carico per atleta."""
import io

p = 'trainmind-app/apps/api/src/routes/analytics.ts'
s = io.open(p, encoding='utf-8').read()

MARK = """    return reply.send({
      success: true,
      data: {
        athletes: overview,
        summary: {
          totalAthletes: athletes.length,"""
assert s.count(MARK) == 1, 'ancora finale non trovata'

ROUTE = r"""
  // ─── GET /analytics/attendance ───────────────────────────
  // Presenze per atleta sui fogli presenze registrati, con il dettaglio per
  // tipologia di allenamento, l'RPE medio e il carico accumulato.
  //
  // Denominatore = numero di fogli in cui l'atleta compare in rosa (cioe' gli
  // allenamenti della sua squadra), non il totale assoluto dei fogli: un
  // giocatore aggiunto a meta' stagione non risulta assente per il periodo
  // precedente.
  app.get('/analytics/attendance', async (request, reply) => {
    const query = analyticsQuerySchema.parse(request.query);
    const { organizationId } = request.user;

    const to = query.to ? new Date(query.to) : new Date();
    to.setHours(23, 59, 59, 999);
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - query.days * 86400000);
    from.setHours(0, 0, 0, 0);

    const sheetWhere: Record<string, unknown> = {
      organizationId,
      startedAt: { gte: from, lte: to },
    };
    if (query.teamId) sheetWhere.teamId = query.teamId;

    const sheets = await app.prisma.fieldTrainingSession.findMany({
      where: sheetWhere,
      select: {
        id: true,
        startedAt: true,
        durationMinutes: true,
        sessionRpe: true,
        calendarEvent: { select: { type: true, startTime: true, endTime: true } },
        trainingSessionId: true,
        entries: {
          select: {
            athleteId: true,
            status: true,
            rpe: true,
            athlete: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { startedAt: 'asc' },
    });

    type Bucket = {
      trainings: number;
      present: number;
      unavailable: number;
      absent: number;
      rpeSum: number;
      rpeCount: number;
      load: number;
    };
    const emptyBucket = (): Bucket => ({
      trainings: 0, present: 0, unavailable: 0, absent: 0, rpeSum: 0, rpeCount: 0, load: 0,
    });

    const athleteNames: Record<string, { id: string; firstName: string; lastName: string }> = {};
    const totals: Record<string, Bucket> = {};
    const byType: Record<string, Record<string, Bucket>> = {};
    const typeTotals: Record<string, number> = {};

    for (const sheet of sheets) {
      // Le sessioni della programmazione non hanno un tipo di evento:
      // le raggruppiamo sotto "session".
      const type = sheet.calendarEvent?.type || (sheet.trainingSessionId ? 'session' : 'other');
      typeTotals[type] = (typeTotals[type] || 0) + 1;

      // Durata effettiva, con la stessa catena di fallback del completamento
      let duration = sheet.durationMinutes ?? null;
      if (duration == null && sheet.calendarEvent?.startTime && sheet.calendarEvent?.endTime) {
        duration = Math.round(
          (sheet.calendarEvent.endTime.getTime() - sheet.calendarEvent.startTime.getTime()) / 60000,
        );
      }

      for (const entry of sheet.entries) {
        if (query.athleteId && entry.athleteId !== query.athleteId) continue;
        athleteNames[entry.athleteId] = entry.athlete;

        if (!totals[entry.athleteId]) totals[entry.athleteId] = emptyBucket();
        if (!byType[entry.athleteId]) byType[entry.athleteId] = {};
        if (!byType[entry.athleteId][type]) byType[entry.athleteId][type] = emptyBucket();

        const buckets = [totals[entry.athleteId], byType[entry.athleteId][type]];
        for (const b of buckets) b.trainings++;

        if (entry.status === 'PRESENT') {
          for (const b of buckets) b.present++;
          const rpe = entry.rpe ?? sheet.sessionRpe ?? null;
          if (rpe) {
            for (const b of buckets) {
              b.rpeSum += rpe;
              b.rpeCount++;
              if (duration && duration > 0) b.load += rpe * duration;
            }
          }
        } else if (entry.status === 'UNAVAILABLE') {
          for (const b of buckets) b.unavailable++;
        } else {
          for (const b of buckets) b.absent++;
        }
      }
    }

    const shape = (b: Bucket) => ({
      trainings: b.trainings,
      present: b.present,
      unavailable: b.unavailable,
      absent: b.absent,
      attendanceRate: b.trainings > 0 ? Math.round((b.present / b.trainings) * 1000) / 10 : null,
      avgRpe: b.rpeCount > 0 ? Math.round((b.rpeSum / b.rpeCount) * 10) / 10 : null,
      totalLoad: Math.round(b.load),
    });

    const athletes = Object.keys(totals)
      .map((id) => ({
        athleteId: id,
        firstName: athleteNames[id]?.firstName || '',
        lastName: athleteNames[id]?.lastName || '',
        ...shape(totals[id]),
        byType: Object.fromEntries(
          Object.entries(byType[id] || {}).map(([type, b]) => [type, shape(b)]),
        ),
      }))
      .sort((a, b) => (b.attendanceRate ?? -1) - (a.attendanceRate ?? -1));

    return reply.send({
      success: true,
      data: {
        athletes,
        types: Object.keys(typeTotals).sort(),
        summary: {
          totalSheets: sheets.length,
          sheetsByType: typeTotals,
          from: from.toISOString(),
          to: to.toISOString(),
        },
      },
    });
  });

"""

# la nuova route va inserita PRIMA dell'ultima (quella del team overview):
# la troviamo risalendo dal marcatore al suo `app.get(`.
idx = s.index(MARK)
start = s.rindex("  // ─── GET /analytics/", 0, idx)
s = s[:start] + ROUTE.lstrip('\n') + s[start:]

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('  patched', p)
