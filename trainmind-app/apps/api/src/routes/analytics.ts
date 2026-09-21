import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { computeAcwr, calculateWellnessScore } from '@trainmind/utils';
import { fullName } from '../lib/identity.js';

// ═══════════════════════════════════════════════════════════
// ANALYTICS ROUTES — Sprint 3.2
// ═══════════════════════════════════════════════════════════

const analyticsQuerySchema = z.object({
  athleteId: z.string().optional(),
  teamId: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.coerce.number().int().min(7).max(365).default(30),
});

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // ─── Helper: resolve team athletes ───
  async function getTeamAthleteIds(organizationId: string, teamId?: string | null): Promise<Record<string, string[]>> {
    const teamAthletes = await app.prisma.athleteTeam.findMany({
      where: teamId ? { teamId } : { team: { organizationId } },
      select: { athleteId: true, teamId: true },
    });
    const map: Record<string, string[]> = {};
    for (const ta of teamAthletes) {
      if (!map[ta.teamId]) map[ta.teamId] = [];
      map[ta.teamId].push(ta.athleteId);
    }
    return map;
  }

  // ─── Helper: resolve which teams an athlete belongs to ───
  async function getAthleteTeamIds(athleteId: string): Promise<string[]> {
    const memberships = await app.prisma.athleteTeam.findMany({
      where: { athleteId },
      select: { teamId: true },
    });
    return memberships.map((m) => m.teamId);
  }

  // ─── GET /analytics/performance — Training volume & load over time ───
  // Now queries TrainingSession directly (not SessionLog) so team sessions work.
  app.get('/analytics/performance', async (request, reply) => {
    const query = analyticsQuerySchema.parse(request.query);
    const { organizationId } = request.user;

    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - query.days * 86400000);

    const sessionWhere: Record<string, unknown> = {
      status: 'COMPLETED',
      date: { gte: from, lte: to },
      organizationId,
      isTemplate: false,
    };
    if (query.athleteId) {
      // Individual sessions for this athlete OR team sessions where athlete is a member
      const athleteTeamIds = await getAthleteTeamIds(query.athleteId);
      sessionWhere.OR = [
        { athleteId: query.athleteId },
        ...(athleteTeamIds.length > 0
          ? [{ athleteId: null, week: { trainingPlan: { teamId: { in: athleteTeamIds } } } }]
          : []),
      ];
    }
    else if (query.teamId) {
      // Resolve team athletes — catch both individual sessions AND team-plan sessions (athleteId null)
      const teamAthletes = await app.prisma.athleteTeam.findMany({
        where: { teamId: query.teamId },
        select: { athleteId: true },
      });
      const teamAthleteIdList = teamAthletes.map((ta) => ta.athleteId);
      sessionWhere.OR = [
        { athleteId: { in: teamAthleteIdList } },
        { athleteId: null, week: { trainingPlan: { teamId: query.teamId } } },
      ];
    }

    const sessions = await app.prisma.trainingSession.findMany({
      where: sessionWhere,
      select: {
        id: true,
        athleteId: true,
        date: true,
        duration: true,
        rpe: true,
        sessionExercises: {
          select: { sets: true, reps: true, weight: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Aggregate by date
    const dailyData: Record<string, {
      date: string;
      sessions: number;
      totalDuration: number;
      avgRpe: number;
      totalVolume: number;
      totalSets: number;
      rpeSum: number;
    }> = {};

    for (const s of sessions) {
      if (!s.date) continue;
      const dateKey = new Date(s.date).toISOString().slice(0, 10);
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { date: dateKey, sessions: 0, totalDuration: 0, avgRpe: 0, totalVolume: 0, totalSets: 0, rpeSum: 0 };
      }
      const d = dailyData[dateKey];
      d.sessions++;
      d.totalDuration += s.duration || 0;

      const rpe = s.rpe || 0;
      if (rpe > 0) d.rpeSum += rpe;

      // Volume from session exercises
      for (const se of s.sessionExercises) {
        const sets = se.sets || 0;
        const reps = parseInt(se.reps || '0') || 0;
        const weight = se.weight || 0;
        d.totalVolume += sets * reps * weight;
        d.totalSets += sets;
      }
    }

    const performance = Object.values(dailyData).map((d) => ({
      ...d,
      avgRpe: d.sessions > 0 && d.rpeSum > 0 ? Math.round((d.rpeSum / d.sessions) * 10) / 10 : 0,
    }));

    // Per-athlete breakdown (when viewing team, not single athlete)
    let perAthlete: Array<{
      athleteId: string;
      athleteName: string;
      sessions: number;
      totalDuration: number;
      avgRpe: number;
      totalVolume: number;
    }> | undefined;

    if (!query.athleteId) {
      const athleteStats: Record<string, {
        athleteId: string;
        athleteName: string;
        sessions: number;
        totalDuration: number;
        rpeSum: number;
        rpeCount: number;
        totalVolume: number;
      }> = {};

      // Need athlete names - fetch them
      const athleteNames = new Map<string, string>();
      const athleteRecords = await app.prisma.athlete.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, identity: { select: { firstName: true, lastName: true } } },
      });
      for (const a of athleteRecords) {
        athleteNames.set(a.id, fullName(a));
      }

      // Re-iterate sessions for per-athlete stats
      for (const s of sessions) {
        if (!s.date || !s.athleteId) continue;
        if (!athleteStats[s.athleteId]) {
          athleteStats[s.athleteId] = {
            athleteId: s.athleteId,
            athleteName: athleteNames.get(s.athleteId) || 'Sconosciuto',
            sessions: 0, totalDuration: 0, rpeSum: 0, rpeCount: 0, totalVolume: 0,
          };
        }
        const st = athleteStats[s.athleteId];
        st.sessions++;
        st.totalDuration += s.duration || 0;
        if (s.rpe && s.rpe > 0) { st.rpeSum += s.rpe; st.rpeCount++; }
        for (const se of s.sessionExercises) {
          const sets = se.sets || 0;
          const reps = parseInt(se.reps || '0') || 0;
          const weight = se.weight || 0;
          st.totalVolume += sets * reps * weight;
        }
      }

      perAthlete = Object.values(athleteStats)
        .map((st) => ({
          athleteId: st.athleteId,
          athleteName: st.athleteName,
          sessions: st.sessions,
          totalDuration: st.totalDuration,
          avgRpe: st.rpeCount > 0 ? Math.round((st.rpeSum / st.rpeCount) * 10) / 10 : 0,
          totalVolume: st.totalVolume,
        }))
        .sort((a, b) => b.sessions - a.sessions);
    }

    return reply.send({ success: true, data: performance, perAthlete });
  });

  // ─── GET /analytics/wellness-heatmap — Wellness scores heatmap data ───
  app.get('/analytics/wellness-heatmap', async (request, reply) => {
    const query = analyticsQuerySchema.parse(request.query);
    const { organizationId } = request.user;

    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - query.days * 86400000);

    const where: Record<string, unknown> = {
      athlete: { organizationId },
      date: { gte: from, lte: to },
    };
    // L'atleta è più specifico della squadra: se c'è, vince lui. Con due `if`
    // separati il filtro squadra sovrascriveva quello atleta e la heatmap
    // mostrava tutta la rosa anche selezionando un singolo giocatore.
    if (query.athleteId) {
      where.athleteId = query.athleteId;
    } else if (query.teamId) {
      // Resolve team athlete IDs for reliable filtering
      const teamAthletes = await app.prisma.athleteTeam.findMany({
        where: { teamId: query.teamId },
        select: { athleteId: true },
      });
      where.athleteId = { in: teamAthletes.map((ta) => ta.athleteId) };
    }

    const wellnessLogs = await app.prisma.wellnessLog.findMany({
      where,
      include: {
        athlete: { select: { id: true, identity: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { date: 'asc' },
    });

    const heatmapData = wellnessLogs.map((log) => ({
      athleteId: log.athleteId,
      athleteName: fullName(log.athlete),
      date: new Date(log.date).toISOString().slice(0, 10),
      sleepQuality: log.sleepQuality,
      fatigue: log.fatigue,
      soreness: log.soreness,
      stress: log.stress,
      mood: log.mood,
      wellnessScore: calculateWellnessScore(log),
    }));

    return reply.send({ success: true, data: heatmapData });
  });

  // ─── GET /analytics/acwr — Acute:Chronic Workload Ratio ───
  // Handles team sessions: attributes load to ALL athletes in the session's team.
  app.get('/analytics/acwr', async (request, reply) => {
    const query = analyticsQuerySchema.parse(request.query);
    const { organizationId } = request.user;

    const to = query.to ? new Date(query.to) : new Date();
    // Un filtro 'YYYY-MM-DD' arriva a mezzanotte: senza questa riga le sedute
    // di oggi restano fuori e l'ACWR "attuale" e' quello di ieri sera.
    if (query.to) to.setHours(23, 59, 59, 999);
    // Inizio richiesto (filtro date) oppure finestra `days`.
    const displayFrom = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - Math.max(query.days, 28) * 86400000);
    // Il carico cronico guarda indietro 21 giorni: si leggono 28 giorni in più
    // prima dell'inizio, così il primo punto del grafico è già calcolabile.
    const from = new Date(displayFrom.getTime() - 28 * 86400000);

    const acwrSessionWhere: Record<string, unknown> = {
      status: 'COMPLETED',
      date: { gte: from, lte: to },
      organizationId,
      isTemplate: false,
    };
    if (query.athleteId) {
      const athleteTeamIds = await getAthleteTeamIds(query.athleteId);
      acwrSessionWhere.OR = [
        { athleteId: query.athleteId },
        ...(athleteTeamIds.length > 0
          ? [{ athleteId: null, week: { trainingPlan: { teamId: { in: athleteTeamIds } } } }]
          : []),
      ];
    }
    else if (query.teamId) {
      // Catch both individual athlete sessions AND team-plan sessions (athleteId null)
      const teamAthletes = await app.prisma.athleteTeam.findMany({
        where: { teamId: query.teamId },
        select: { athleteId: true },
      });
      acwrSessionWhere.OR = [
        { athleteId: { in: teamAthletes.map((ta) => ta.athleteId) } },
        { athleteId: null, week: { trainingPlan: { teamId: query.teamId } } },
      ];
    }

    const sessions = await app.prisma.trainingSession.findMany({
      where: acwrSessionWhere,
      select: {
        id: true,
        date: true,
        duration: true,
        rpe: true,
        detailedByAttendance: true,
        athleteId: true,
        athlete: { select: { id: true, identity: { select: { firstName: true, lastName: true } } } },
        week: {
          select: {
            trainingPlan: {
              select: { teamId: true },
            },
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Get team→athletes mapping
    const teamAthletesMap = await getTeamAthleteIds(organizationId, query.teamId);

    // Also get all athletes for name resolution
    const allAthletes = await app.prisma.athlete.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, identity: { select: { firstName: true, lastName: true } } },
    });
    const athleteNameMap: Record<string, string> = {};
    for (const a of allAthletes) {
      athleteNameMap[a.id] = fullName(a);
    }

    // Build per-athlete session loads, attributing team sessions to all team members
    const byAthlete: Record<string, Array<{ date: Date; load: number }>> = {};

    for (const s of sessions) {
      if (!s.date) continue;
      const rpe = s.rpe || 5;
      const duration = s.duration || 60;
      const load = rpe * duration;
      const sessionDate = new Date(s.date);

      if (s.athleteId) {
        // Individual session → single athlete
        if (!byAthlete[s.athleteId]) byAthlete[s.athleteId] = [];
        byAthlete[s.athleteId].push({ date: sessionDate, load });
      } else if (!s.detailedByAttendance) {
        // Team session → attribute to all athletes in team.
        // Saltata quando il foglio presenze ha già generato le righe per
        // singolo atleta: altrimenti il carico si conterebbe due volte.
        const teamId = s.week?.trainingPlan?.teamId;
        if (teamId && teamAthletesMap[teamId]) {
          for (const athleteId of teamAthletesMap[teamId]) {
            if (!byAthlete[athleteId]) byAthlete[athleteId] = [];
            byAthlete[athleteId].push({ date: sessionDate, load });
          }
        }
      }
    }

    // Calculate ACWR per athlete per week
    const acwrData: Array<{
      athleteId: string;
      athleteName: string;
      weekEnd: string;
      acuteLoad: number;
      chronicLoad: number;
      acwr: number;
      zone: 'low' | 'optimal' | 'high' | 'danger';
    }> = [];

    for (const [athleteId, athleteSessions] of Object.entries(byAthlete)) {
      // Le date in cui si campiona la serie: una a settimana da `displayFrom`,
      // piu' SEMPRE un punto finale su `to`.
      //
      // Il badge "ACWR attuale" del grafico legge l'ultimo punto della serie.
      // Col solo passo settimanale quel punto poteva essere vecchio di sei
      // giorni, e mostrava un valore diverso da quello della scheda Squadra,
      // che calcola a oggi: stessa formula, momenti diversi. Da qui la
      // divergenza segnalata dagli utenti.
      const stops: Date[] = [];
      const cursor = new Date(displayFrom.getTime());
      while (cursor <= to) {
        stops.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 7);
      }
      const last = stops[stops.length - 1];
      if (!last || last.getTime() !== to.getTime()) stops.push(new Date(to.getTime()));

      for (const weekEnd of stops) {
        // Stessa formula di tutto il resto: `computeAcwr` si ritaglia da sola
        // le finestre attorno a `weekEnd`, quindi le sedute si passano intere.
        const punto = computeAcwr(athleteSessions, weekEnd);

        // Un punto non valutabile (storico troppo corto, o nessun carico nella
        // finestra) NON entra nella serie. Prima diventava 0, che il grafico
        // legge come "sotto-allenamento": un'informazione falsa al posto di
        // un'informazione mancante, e un'altra fonte di divergenza con la
        // scheda Squadra, che quegli atleti li conta come non valutabili.
        if (punto.acwr === null || punto.zone === null) continue;

        acwrData.push({
          athleteId,
          athleteName: athleteNameMap[athleteId] || 'Sconosciuto',
          weekEnd: weekEnd.toISOString().slice(0, 10),
          acuteLoad: Math.round(punto.acuteLoad),
          chronicLoad: Math.round(punto.chronicLoad),
          acwr: punto.acwr,
          zone: punto.zone,
        });
      }
    }

    // If filtering by single athlete, only return that athlete's data
    const filteredAcwr = query.athleteId
      ? acwrData.filter((d) => d.athleteId === query.athleteId)
      : acwrData;

    return reply.send({ success: true, data: filteredAcwr });
  });

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
            athlete: { select: { id: true, identity: { select: { firstName: true, lastName: true } } } },
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

    const athleteNames: Record<
      string,
      { id: string; identity: { firstName: string; lastName: string } | null }
    > = {};
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
        firstName: athleteNames[id]?.identity?.firstName || '',
        lastName: athleteNames[id]?.identity?.lastName || '',
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

  // ─── GET /analytics/team-overview — Team risk distribution summary ───
  // Handles team sessions: attributes session load to all athletes in the team.
  app.get('/analytics/team-overview', async (request, reply) => {
    const { organizationId } = request.user;
    const { teamId } = request.query as { teamId?: string };

    // Resolve team athlete IDs upfront (if team filter)
    let teamAthleteIds: string[] | null = null;
    if (teamId) {
      const teamAthletes = await app.prisma.athleteTeam.findMany({
        where: { teamId },
        select: { athleteId: true },
      });
      teamAthleteIds = teamAthletes.map((ta) => ta.athleteId);
    }

    // Get athletes (optionally filtered by team)
    const athleteWhere: Record<string, unknown> = { organizationId, isActive: true };
    if (teamAthleteIds) {
      athleteWhere.id = { in: teamAthleteIds };
    }
    const athletes = await app.prisma.athlete.findMany({
      where: athleteWhere,
      select: { id: true, position: true, identity: { select: { firstName: true, lastName: true } } },
    });
    const athleteIds = athletes.map((a) => a.id);

    // Recent wellness (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const recentWellness = await app.prisma.wellnessLog.findMany({
      where: {
        athleteId: { in: athleteIds },
        date: { gte: weekAgo },
      },
      orderBy: { date: 'desc' },
    });

    // Recent completed sessions (last 21 days for ACWR — 3-week chronic window)
    const monthAgo = new Date(Date.now() - 21 * 86400000);
    const sessionWhere: Record<string, unknown> = {
      status: 'COMPLETED',
      date: { gte: monthAgo },
      organizationId,
      isTemplate: false,
    };
    if (teamId) {
      sessionWhere.OR = [
        { athleteId: { in: athleteIds } },
        { athleteId: null, week: { trainingPlan: { teamId } } },
      ];
    } else {
      // Include both individual sessions AND team-plan sessions (athleteId null)
      // so ACWR calculations match the per-team filtered view
      sessionWhere.OR = [
        { athleteId: { in: athleteIds } },
        { athleteId: null },
      ];
    }

    const recentSessions = await app.prisma.trainingSession.findMany({
      where: sessionWhere,
      select: {
        athleteId: true,
        date: true,
        duration: true,
        rpe: true,
        detailedByAttendance: true,
        week: {
          select: {
            trainingPlan: { select: { teamId: true } },
          },
        },
      },
    });

    // Build team→athletes mapping for attributing team sessions
    const teamAthletesMap = await getTeamAthleteIds(organizationId, teamId);
    const athleteTeamIds: Record<string, string[]> = {};
    for (const [tid, aids] of Object.entries(teamAthletesMap)) {
      for (const aid of aids) {
        if (!athleteTeamIds[aid]) athleteTeamIds[aid] = [];
        athleteTeamIds[aid].push(tid);
      }
    }

    // Attribute sessions to athletes
    const athleteSessionLoads: Record<string, Array<{ date: Date; load: number }>> = {};
    for (const s of recentSessions) {
      if (!s.date) continue;
      const rpe = s.rpe || 5;
      const duration = s.duration || 60;
      const load = rpe * duration;
      const sessionDate = new Date(s.date);

      if (s.athleteId) {
        if (!athleteSessionLoads[s.athleteId]) athleteSessionLoads[s.athleteId] = [];
        athleteSessionLoads[s.athleteId].push({ date: sessionDate, load });
      } else if (!s.detailedByAttendance) {
        // Vedi sopra: niente doppio conteggio con le presenze registrate.
        const sessTeamId = s.week?.trainingPlan?.teamId;
        if (sessTeamId && teamAthletesMap[sessTeamId]) {
          for (const aid of teamAthletesMap[sessTeamId]) {
            if (!athleteSessionLoads[aid]) athleteSessionLoads[aid] = [];
            athleteSessionLoads[aid].push({ date: sessionDate, load });
          }
        }
      }
    }

    // Build per-athlete overview
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 86400000);

    const overview = athletes.map((athlete) => {
      // Wellness
      const athleteWellness = recentWellness.filter((w) => w.athleteId === athlete.id);
      const latestWellness = athleteWellness[0];
      const avgWellnessScore = athleteWellness.length > 0
        ? Math.round(
            athleteWellness.reduce((sum, w) => sum + calculateWellnessScore(w), 0) /
              athleteWellness.length
          )
        : null;

      // ACWR from attributed sessions
      const myLoads = athleteSessionLoads[athlete.id] || [];

      const acuteLoad = myLoads
        .filter((s) => s.date >= weekStart)
        .reduce((sum, s) => sum + s.load, 0);

      const chronicLoad = myLoads.length > 0
        ? myLoads.reduce((sum, s) => sum + s.load, 0) / 3
        : 0;

      const acwr = chronicLoad > 0 ? Math.round((acuteLoad / chronicLoad) * 100) / 100 : 0;

      let riskZone: 'low' | 'optimal' | 'high' | 'danger';
      if (acwr < 0.8) riskZone = 'low';
      else if (acwr <= 1.3) riskZone = 'optimal';
      else if (acwr <= 1.5) riskZone = 'high';
      else riskZone = 'danger';

      const sessionsThisWeek = myLoads.filter((s) => s.date >= weekStart).length;

      return {
        ...athlete,
        wellnessScore: avgWellnessScore,
        latestWellness: latestWellness ? {
          sleepQuality: latestWellness.sleepQuality,
          fatigue: latestWellness.fatigue,
          soreness: latestWellness.soreness,
          stress: latestWellness.stress,
          mood: latestWellness.mood,
        } : null,
        acwr,
        riskZone,
        sessionsThisWeek,
        acuteLoad,
        chronicLoad: Math.round(chronicLoad),
      };
    });

    const zoneCounts = { low: 0, optimal: 0, high: 0, danger: 0 };
    for (const a of overview) {
      zoneCounts[a.riskZone]++;
    }

    return reply.send({
      success: true,
      data: {
        athletes: overview,
        summary: {
          totalAthletes: athletes.length,
          zoneCounts,
          avgTeamWellness: overview.filter((a) => a.wellnessScore !== null).length > 0
            ? Math.round(
                overview.filter((a) => a.wellnessScore !== null).reduce((s, a) => s + a.wellnessScore!, 0) /
                overview.filter((a) => a.wellnessScore !== null).length
              )
            : null,
        },
      },
    });
  });
}
