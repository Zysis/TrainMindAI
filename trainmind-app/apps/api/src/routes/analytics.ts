import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

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
        select: { id: true, firstName: true, lastName: true },
      });
      for (const a of athleteRecords) {
        athleteNames.set(a.id, `${a.firstName} ${a.lastName}`);
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
    if (query.athleteId) where.athleteId = query.athleteId;
    if (query.teamId) {
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
        athlete: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { date: 'asc' },
    });

    const heatmapData = wellnessLogs.map((log) => ({
      athleteId: log.athleteId,
      athleteName: `${log.athlete.firstName} ${log.athlete.lastName}`,
      date: new Date(log.date).toISOString().slice(0, 10),
      sleepQuality: log.sleepQuality,
      fatigue: log.fatigue,
      soreness: log.soreness,
      stress: log.stress,
      mood: log.mood,
      wellnessScore: Math.round(
        ((log.sleepQuality + log.mood + (6 - log.fatigue) + (6 - log.soreness) + (6 - log.stress)) / 25) * 100
      ),
    }));

    return reply.send({ success: true, data: heatmapData });
  });

  // ─── GET /analytics/acwr — Acute:Chronic Workload Ratio ───
  // Handles team sessions: attributes load to ALL athletes in the session's team.
  app.get('/analytics/acwr', async (request, reply) => {
    const query = analyticsQuerySchema.parse(request.query);
    const { organizationId } = request.user;

    const to = query.to ? new Date(query.to) : new Date();
    const from = new Date(to.getTime() - Math.max(query.days, 28) * 86400000);

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
        athleteId: true,
        athlete: { select: { id: true, firstName: true, lastName: true } },
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
      select: { id: true, firstName: true, lastName: true },
    });
    const athleteNameMap: Record<string, string> = {};
    for (const a of allAthletes) {
      athleteNameMap[a.id] = `${a.firstName} ${a.lastName}`;
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
      } else {
        // Team session → attribute to all athletes in team
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
      const startDate = new Date(from.getTime() + 21 * 86400000);
      const current = new Date(startDate);

      while (current <= to) {
        const weekEnd = new Date(current);
        const weekStart = new Date(current.getTime() - 7 * 86400000);
        const chronicStart = new Date(current.getTime() - 21 * 86400000);

        const acuteLoad = athleteSessions
          .filter((s) => s.date >= weekStart && s.date <= weekEnd)
          .reduce((sum, s) => sum + s.load, 0);

        const chronicSessions = athleteSessions.filter(
          (s) => s.date >= chronicStart && s.date <= weekEnd,
        );
        const chronicLoad = chronicSessions.length > 0
          ? chronicSessions.reduce((sum, s) => sum + s.load, 0) / 3
          : 0;

        const acwr = chronicLoad > 0 ? Math.round((acuteLoad / chronicLoad) * 100) / 100 : 0;

        let zone: 'low' | 'optimal' | 'high' | 'danger';
        if (acwr < 0.8) zone = 'low';
        else if (acwr <= 1.3) zone = 'optimal';
        else if (acwr <= 1.5) zone = 'high';
        else zone = 'danger';

        acwrData.push({
          athleteId,
          athleteName: athleteNameMap[athleteId] || 'Sconosciuto',
          weekEnd: weekEnd.toISOString().slice(0, 10),
          acuteLoad: Math.round(acuteLoad),
          chronicLoad: Math.round(chronicLoad),
          acwr,
          zone,
        });

        current.setDate(current.getDate() + 7);
      }
    }

    // If filtering by single athlete, only return that athlete's data
    const filteredAcwr = query.athleteId
      ? acwrData.filter((d) => d.athleteId === query.athleteId)
      : acwrData;

    return reply.send({ success: true, data: filteredAcwr });
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
      select: { id: true, firstName: true, lastName: true, position: true },
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
      } else {
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
            athleteWellness.reduce((sum, w) => {
              return sum + ((w.sleepQuality + w.mood + (6 - w.fatigue) + (6 - w.soreness) + (6 - w.stress)) / 25) * 100;
            }, 0) / athleteWellness.length
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
