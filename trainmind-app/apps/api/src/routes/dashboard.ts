import type { FastifyInstance } from 'fastify';

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // ─── GET /dashboard/overview — aggregated KPIs ─────────
  app.get('/dashboard/overview', async (request, _reply) => {
    const { organizationId } = request.user;
    const { teamId } = request.query as { teamId?: string };
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    // If team filter, resolve athlete IDs upfront
    let teamAthleteIds: string[] | null = null;
    if (teamId) {
      const ta = await app.prisma.athleteTeam.findMany({
        where: { teamId },
        select: { athleteId: true },
      });
      teamAthleteIds = ta.map((t) => t.athleteId);
    }

    // Helper: athlete filter
    const athleteOrgFilter = teamAthleteIds
      ? { organizationId, isActive: true, id: { in: teamAthleteIds } }
      : { organizationId, isActive: true };

    const wellnessAthleteFilter = teamAthleteIds
      ? { athlete: { organizationId }, athleteId: { in: teamAthleteIds } }
      : { athlete: { organizationId } };

    const injuryAthleteFilter = teamAthleteIds
      ? { athlete: { organizationId }, athleteId: { in: teamAthleteIds } }
      : { athlete: { organizationId } };

    // Run all queries in parallel
    const [
      athleteCount,
      activeAthletes,
      exerciseCount,
      recentWellness,
      activeAlerts,
      activeRTP,
      recentSessions,
      periodizationPlans,
      upcomingSchedules,
      wellnessAvg,
      injuryStats,
    ] = await Promise.all([
      // Total athletes
      app.prisma.athlete.count({
        where: athleteOrgFilter,
      }),

      // Athletes with activity in last 7 days (wellness or training)
      app.prisma.athlete.count({
        where: {
          ...athleteOrgFilter,
          wellnessLogs: { some: { date: { gte: sevenDaysAgo } } },
        },
      }),

      // Exercise library count (org-wide, not team-filtered)
      app.prisma.exercise.count({
        where: { organizationId },
      }),

      // Recent wellness logs (last 7 days)
      app.prisma.wellnessLog.findMany({
        where: {
          ...wellnessAthleteFilter,
          date: { gte: sevenDaysAgo },
        },
        select: {
          fatigue: true,
          soreness: true,
          mood: true,
          sleepQuality: true,
          stress: true,
          date: true,
          athlete: { select: { firstName: true, lastName: true } },
        },
        orderBy: { date: 'desc' },
        take: 10,
      }),

      // Active alert rules (org-wide)
      app.prisma.alertRule.count({
        where: { organizationId, isActive: true },
      }),

      // Active RTP protocols
      app.prisma.rTPProtocol.findMany({
        where: {
          ...injuryAthleteFilter,
          currentPhase: { not: 'CLEARED' },
        },
        select: {
          id: true,
          currentPhase: true,
          startDate: true,
          athlete: { select: { firstName: true, lastName: true, position: true } },
          injury: { select: { type: true, location: true, severity: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),

      // Training sessions last 30 days
      app.prisma.trainingSession.count({
        where: teamAthleteIds
          ? {
              organizationId,
              status: 'COMPLETED',
              date: { gte: thirtyDaysAgo },
              isTemplate: false,
              OR: [
                { athleteId: { in: teamAthleteIds } },
                { athleteId: null, week: { trainingPlan: { teamId } } },
              ],
            }
          : {
              week: { trainingPlan: { organizationId } },
              status: 'COMPLETED',
              date: { gte: thirtyDaysAgo },
            },
      }),

      // Active periodization plans
      app.prisma.periodizationPlan.count({
        where: teamId
          ? { organizationId, isTemplate: false, teamId }
          : { organizationId, isTemplate: false },
      }),

      // Upcoming report schedules (org-wide)
      app.prisma.reportSchedule.count({
        where: { organizationId, isActive: true },
      }),

      // Wellness averages last 7 days
      app.prisma.wellnessLog.aggregate({
        where: {
          ...wellnessAthleteFilter,
          date: { gte: sevenDaysAgo },
        },
        _avg: {
          fatigue: true,
          soreness: true,
          mood: true,
          sleepQuality: true,
          stress: true,
        },
        _count: true,
      }),

      // Injury counts by status
      app.prisma.injury.groupBy({
        by: ['status'],
        where: injuryAthleteFilter,
        _count: true,
      }),
    ]);

    // Compute wellness trend (are things getting better/worse?)
    const wellnessTrend = wellnessAvg._count > 0
      ? {
          avgFatigue: round(wellnessAvg._avg.fatigue),
          avgSoreness: round(wellnessAvg._avg.soreness),
          avgMood: round(wellnessAvg._avg.mood),
          avgSleep: round(wellnessAvg._avg.sleepQuality),
          avgStress: round(wellnessAvg._avg.stress),
          totalLogs: wellnessAvg._count,
        }
      : null;

    // Athletes at risk: high fatigue or soreness in latest log
    const atRiskAthletes = recentWellness.filter(
      (w) => w.fatigue >= 4 || w.soreness >= 4 || w.mood <= 2
    );

    // Injury status summary
    const injurySummary = {
      active: injuryStats.find((s) => s.status === 'ACTIVE')?._count ?? 0,
      recovering: injuryStats.find((s) => s.status === 'RECOVERING')?._count ?? 0,
      resolved: injuryStats.find((s) => s.status === 'RESOLVED')?._count ?? 0,
    };

    return {
      success: true,
      data: {
        kpis: {
          totalAthletes: athleteCount,
          activeAthletes,
          exerciseLibrary: exerciseCount,
          sessionsLast30d: recentSessions,
          activeAlerts,
          activeRTPProtocols: activeRTP.length,
          periodizationPlans,
          scheduledReports: upcomingSchedules,
        },
        wellness: {
          trend: wellnessTrend,
          atRisk: atRiskAthletes.map((w) => ({
            athlete: `${w.athlete.firstName} ${w.athlete.lastName}`,
            fatigue: w.fatigue,
            soreness: w.soreness,
            mood: w.mood,
          })),
          recentLogs: recentWellness.slice(0, 5),
        },
        injuries: {
          summary: injurySummary,
          activeRTP: activeRTP.map((p) => ({
            id: p.id,
            athlete: `${p.athlete.firstName} ${p.athlete.lastName}`,
            position: p.athlete.position,
            phase: p.currentPhase,
            injuryType: p.injury.type,
            injuryLocation: p.injury.location,
            severity: p.injury.severity,
            daysSinceStart: Math.floor((now.getTime() - new Date(p.startDate).getTime()) / 86400000),
          })),
        },
      },
    };
  });
}

function round(val: number | null): number {
  if (val === null) return 0;
  return Math.round(val * 10) / 10;
}
