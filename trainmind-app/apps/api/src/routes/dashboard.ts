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
    const acuteStart = new Date(now.getTime() - 7 * 86400000);
    const prevWeekStart = new Date(now.getTime() - 14 * 86400000);

    const [loadSessions, riskWellness, riskAthletes] = await Promise.all([
      app.prisma.trainingSession.findMany({
        where: {
          status: 'COMPLETED',
          rpe: { not: null },
          date: { gte: riskWindowStart, lte: now },
          athlete: athleteOrgFilter,
        },
        select: { athleteId: true, date: true, duration: true, rpe: true },
      }),
      app.prisma.wellnessLog.findMany({
        where: { ...wellnessAthleteFilter, date: { gte: riskWindowStart } },
        select: { athleteId: true, date: true, fatigue: true, soreness: true, mood: true, sleepQuality: true, stress: true },
      }),
      app.prisma.athlete.findMany({
        where: athleteOrgFilter,
        select: { id: true, firstName: true, lastName: true },
      }),
    ]);

    const nameById = new Map(riskAthletes.map((a) => [a.id, `${a.firstName} ${a.lastName}`]));

    // sRPE = RPE x durata. Acuto = ultimi 7 giorni; cronico = media
    // settimanale delle ultime 3, cioe' il totale diviso 3.
    const loadAcc = new Map<string, { acute: number; chronic: number; prevWeek: number; firstDate: Date }>();
    for (const ts of loadSessions) {
      if (!ts.athleteId || !ts.date || !ts.rpe) continue;
      const load = ts.rpe * (ts.duration ?? 0);
      const cur = loadAcc.get(ts.athleteId) ?? { acute: 0, chronic: 0, prevWeek: 0, firstDate: ts.date };
      cur.chronic += load;
      if (ts.date < cur.firstDate) cur.firstDate = ts.date;
      if (ts.date >= acuteStart) cur.acute += load;
      else if (ts.date >= prevWeekStart) cur.prevWeek += load;
      loadAcc.set(ts.athleteId, cur);
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
      const l = loadAcc.get(athleteId);
      const w = wellAcc.get(athleteId);
      const recent = w ? mean(w.recent) : null;
      const baseline = w ? mean(w.baseline) : null;
      // Un calo di 0.8 punti su 5 rispetto alla propria media: abbastanza da
      // non essere rumore, abbastanza poco da accorgersene prima del crollo.
      const wellnessDrop = recent != null && baseline != null && baseline - recent >= 0.8;

      if (!l || l.chronic <= 0) {
        notAssessable++;
        if (wellnessDrop) wellnessOnlyDrops++;
        continue;
      }

      // Il cronico si divide SEMPRE per 3 settimane, perche' e' quello che
      // significa: "quanto sei abituato a lavorare". Ma se lo storico copre
      // solo gli ultimi giorni, quel divisore fa uscire un ACWR gonfiato di
      // tre volte — con tutto il carico nell'ultima settimana viene esatto
      // 3.00 per chiunque, e l'intera rosa finisce in rosso il giorno dopo
      // aver iniziato a registrare gli RPE.
      //
      // Normalizzare sulle settimane davvero coperte sarebbe l'errore
      // opposto: darebbe circa 1.0, cioe' "va tutto bene", a un atleta di cui
      // non si sa niente. Senza due settimane di storico la risposta onesta
      // e' che non si puo' dire.
      const historyDays = (now.getTime() - l.firstDate.getTime()) / 86400000;
      if (historyDays < 14) {
        notAssessable++;
        insufficientHistory++;
        if (wellnessDrop) wellnessOnlyDrops++;
        continue;
      }

      const chronicWeekly = l.chronic / 3;
      const acwr = Math.round((l.acute / chronicWeekly) * 100) / 100;
      const zone: RiskRow['acwrZone'] =
        acwr < 0.8 ? 'low' : acwr <= 1.3 ? 'optimal' : acwr <= 1.5 ? 'high' : 'danger';

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
        acuteLoad: Math.round(l.acute),
        chronicLoad: Math.round(chronicWeekly),
        weeklyDeltaPct: l.prevWeek > 0 ? Math.round(((l.acute - l.prevWeek) / l.prevWeek) * 100) : null,
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
