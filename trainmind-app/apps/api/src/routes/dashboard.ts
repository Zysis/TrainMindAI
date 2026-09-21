import type { FastifyInstance } from 'fastify';
import { computeAcwr, type AcwrLoadPoint } from '@trainmind/utils';
import { fullName } from '../lib/identity.js';

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
          athlete: { select: { identity: { select: { firstName: true, lastName: true } } } },
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
          athlete: { select: { position: true, identity: { select: { firstName: true, lastName: true } } } },
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

    // ─── Atleti a rischio ──────────────────────────────────────────────
    //
    // Il rischio lo determina il CARICO, non il wellness.
    //
    // Prima questa lista era "chi ha segnato <= 2 in una voce del wellness
    // nell'ultima rilevazione". E' un criterio fuorviante: il wellness e' una
    // percezione soggettiva su una scala corta, con una varianza enorme fra
    // atleti e fra giorni; un 2 dopo una notte storta non dice niente sul
    // rischio di infortunio, e un atleta abituato a segnare alto puo' essere
    // in pieno sovraccarico segnando 4.
    //
    // Quello che il rischio lo descrive davvero e' il rapporto fra carico
    // acuto e cronico (ACWR) costruito sull'sRPE: quanto ha lavorato negli
    // ultimi 7 giorni rispetto a quanto e' abituato a lavorare nelle ultime 3
    // settimane. Sopra 1.5 e' uno scalino di carico, sotto 0.8 e' un
    // decondizionamento (rischioso al rientro).
    //
    // Il wellness resta, ma nel ruolo che gli compete: conferma. Un ACWR alto
    // con anche il wellness in calo rispetto alla media dell'atleta e' un
    // segnale piu' solido dello stesso ACWR con il wellness stabile. Da solo
    // NON mette nessuno in lista — viene contato a parte, cosi' il dato non
    // si perde ma non si traveste da allarme.
    const riskWindowStart = new Date(now.getTime() - 21 * 86400000);

    const [loadSessions, riskWellness, riskAthletes] = await Promise.all([
      app.prisma.trainingSession.findMany({
        where: {
          status: 'COMPLETED',
          rpe: { not: null },
          date: { gte: riskWindowStart, lte: now },
          isTemplate: false,
          // Le sedute di squadra hanno athleteId nullo e valgono per tutta la
          // rosa del piano: e' cosi' che le conta /analytics/acwr. Filtrarle
          // via con `athlete: ...` rendeva "non valutabile" chiunque si alleni
          // in gruppo, cioe' il caso normale.
          OR: teamAthleteIds
            ? [
                { athleteId: { in: teamAthleteIds } },
                { athleteId: null, week: { trainingPlan: { teamId } } },
              ]
            : [
                { athlete: athleteOrgFilter },
                { athleteId: null, week: { trainingPlan: { organizationId } } },
              ],
        },
        select: {
          athleteId: true,
          date: true,
          duration: true,
          rpe: true,
          week: { select: { trainingPlan: { select: { teamId: true } } } },
        },
      }),
      app.prisma.wellnessLog.findMany({
        where: { ...wellnessAthleteFilter, date: { gte: riskWindowStart } },
        select: { athleteId: true, date: true, fatigue: true, soreness: true, mood: true, sleepQuality: true, stress: true },
      }),
      app.prisma.athlete.findMany({
        where: athleteOrgFilter,
        select: { id: true, identity: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    const nameById = new Map(riskAthletes.map((a) => [a.id, fullName(a)]));

    // sRPE = RPE x durata. Le finestre e la formula stanno in
    // `computeAcwr` (@trainmind/utils): qui si raggruppano solo le sedute.
    const teamMemberships = await app.prisma.athleteTeam.findMany({
      where: { athlete: athleteOrgFilter },
      select: { teamId: true, athleteId: true },
    });
    const athletesByTeam = new Map<string, string[]>();
    for (const m of teamMemberships) {
      const list = athletesByTeam.get(m.teamId) ?? [];
      list.push(m.athleteId);
      athletesByTeam.set(m.teamId, list);
    }

    const loadByAthlete = new Map<string, AcwrLoadPoint[]>();
    const pushLoad = (athleteId: string, date: Date, load: number) => {
      const list = loadByAthlete.get(athleteId) ?? [];
      list.push({ date, load });
      loadByAthlete.set(athleteId, list);
    };
    for (const ts of loadSessions) {
      if (!ts.date || !ts.rpe) continue;
      const load = ts.rpe * (ts.duration ?? 0);
      if (ts.athleteId) {
        pushLoad(ts.athleteId, ts.date, load);
        continue;
      }
      // Seduta di squadra: vale per ogni atleta iscritto a quella squadra.
      const sessionTeamId = ts.week?.trainingPlan?.teamId;
      if (!sessionTeamId) continue;
      for (const aid of athletesByTeam.get(sessionTeamId) ?? []) {
        pushLoad(aid, ts.date, load);
      }
    }

    // Wellness: media delle cinque voci (su tutte 5 e' il meglio), confrontata
    // fra gli ultimi 3 giorni e la base delle 3 settimane. Serve il confronto
    // con SE STESSO: una soglia assoluta uguale per tutti e' proprio l'errore
    // che si sta togliendo.
    const wellAcc = new Map<string, { recent: number[]; baseline: number[] }>();
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
    for (const w of riskWellness) {
      const score = (w.fatigue + w.soreness + w.mood + w.sleepQuality + w.stress) / 5;
      const cur = wellAcc.get(w.athleteId) ?? { recent: [], baseline: [] };
      if (w.date >= threeDaysAgo) cur.recent.push(score);
      else cur.baseline.push(score);
      wellAcc.set(w.athleteId, cur);
    }
    const mean = (xs: number[]) => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

    interface RiskRow {
      athleteId: string;
      athlete: string;
      acwr: number;
      acwrZone: 'low' | 'optimal' | 'high' | 'danger';
      acuteLoad: number;
      chronicLoad: number;
      weeklyDeltaPct: number | null;
      wellnessRecent: number | null;
      wellnessBaseline: number | null;
      wellnessDrop: boolean;
      reasons: string[];
      level: 'danger' | 'warning';
    }

    const riskRows: RiskRow[] = [];
    let wellnessOnlyDrops = 0;    // cali di wellness senza conferma dal carico
    let notAssessable = 0;        // in totale, non valutabili
    let insufficientHistory = 0;  // di questi, quelli con storico troppo corto

    for (const [athleteId, name] of nameById) {
      const load = computeAcwr(loadByAthlete.get(athleteId) ?? [], now);
      const w = wellAcc.get(athleteId);
      const recent = w ? mean(w.recent) : null;
      const baseline = w ? mean(w.baseline) : null;
      // Un calo di 0.8 punti su 5 rispetto alla propria media: abbastanza da
      // non essere rumore, abbastanza poco da accorgersene prima del crollo.
      const wellnessDrop = recent != null && baseline != null && baseline - recent >= 0.8;

      // Chi non e' valutabile non entra in lista: o non ha carico nelle tre
      // settimane, o ha meno di 14 giorni di storico. Il perche' di quella
      // soglia sta scritto una volta sola, in `computeAcwr`.
      if (load.notAssessable) {
        notAssessable++;
        if (load.notAssessable === 'short-history') insufficientHistory++;
        if (wellnessDrop) wellnessOnlyDrops++;
        continue;
      }

      const acwr = load.acwr as number;
      const zone = load.zone as RiskRow['acwrZone'];

      const reasons: string[] = [];
      if (zone === 'danger') reasons.push('ACWR_SPIKE');
      else if (zone === 'high') reasons.push('ACWR_HIGH');
      else if (zone === 'low') reasons.push('ACWR_LOW');

      if (reasons.length === 0) {
        if (wellnessDrop) wellnessOnlyDrops++;
        continue;
      }
      if (wellnessDrop) reasons.push('WELLNESS_DROP');

      riskRows.push({
        athleteId,
        athlete: name,
        acwr,
        acwrZone: zone,
        acuteLoad: load.acuteLoad,
        chronicLoad: load.chronicLoad,
        weeklyDeltaPct: load.previousWeekLoad > 0
          ? Math.round(((load.acuteLoad - load.previousWeekLoad) / load.previousWeekLoad) * 100)
          : null,
        wellnessRecent: recent != null ? Math.round(recent * 10) / 10 : null,
        wellnessBaseline: baseline != null ? Math.round(baseline * 10) / 10 : null,
        wellnessDrop,
        reasons,
        // Il wellness non crea l'allarme ma lo aggrava: uno scalino di carico
        // confermato dalla percezione dell'atleta pesa piu' dello stesso
        // scalino con il wellness fermo.
        level: zone === 'danger' || (zone === 'high' && wellnessDrop) ? 'danger' : 'warning',
      });
    }

    riskRows.sort((a, b) =>
      (a.level === b.level ? 0 : a.level === 'danger' ? -1 : 1) ||
      Math.abs(b.acwr - 1.05) - Math.abs(a.acwr - 1.05));

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
          recentLogs: recentWellness.slice(0, 5),
        },
        risk: {
          athletes: riskRows,
          // Contati a parte, non nascosti: un calo di wellness senza conferma
          // dal carico e' un'informazione, non un allarme.
          wellnessOnlyDrops,
          notAssessable,
          insufficientHistory,
          assessed: nameById.size - notAssessable,
        },
        injuries: {
          summary: injurySummary,
          activeRTP: activeRTP.map((p) => ({
            id: p.id,
            athlete: fullName(p.athlete),
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
