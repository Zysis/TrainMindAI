/**
 * Sprint 4.1 — Report Engine
 *
 * Endpoint POST /api/v1/ai/report
 *
 * Aggregates organization data for a given period + audience, optionally
 * calls the Python ai-service to produce a narrative summary, and returns
 * either a ReportData JSON (for in-browser preview), a PDF, or a DOCX.
 *
 * Audiences: STAFF | MEDICAL | TRAINER
 *
 * The heavy aggregation (Prisma queries, ACWR bucketing, adherence math)
 * lives here. The AI service only handles the narrative synthesis — it
 * receives the already-aggregated payload and returns a 2-3 sentence
 * Italian summary.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requireMinRole } from '../middleware/rbac.js';
import { getModelForOperation } from '../lib/ai-models.js';
import { recordAiUsage, extractUsage } from '../services/ai-usage.js';
import type {
  ReportData,
  ReportMetadata,
  StaffReportData,
  MedicalReportData,
  TrainerReportData,
  ReportKPI,
  ReportTable,
  ReportChart,
} from '@trainmind/types';
import { renderReportPdf } from '../services/report-renderer-pdf.js';
import { renderReportDocx } from '../services/report-renderer-docx.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3004';

// ─── Request schema ─────────────────────────────────────

const generateReportSchema = z.object({
  audience: z.enum(['STAFF', 'MEDICAL', 'TRAINER']),
  periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  format: z.enum(['PDF', 'DOCX', 'JSON']).default('JSON'),
  includeAISummary: z.boolean().optional().default(true),
  teamId: z.string().optional(),
});

// ─── Helpers ────────────────────────────────────────────

function daysBetween(from: Date, to: Date): number {
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

/**
 * Wellness composite score: 0-100.
 * Higher is better. Formula matches the one used in adaptations.ts.
 */
function computeWellnessScore(log: {
  sleepQuality: number;
  mood: number;
  fatigue: number;
  soreness: number;
  stress: number;
}): number {
  const numerator =
    log.sleepQuality + log.mood + (6 - log.fatigue) + (6 - log.soreness) + (6 - log.stress);
  return (numerator / 25) * 100;
}

/**
 * ACWR = acute load (7 days) / chronic load (28 days / 4).
 * sRPE = rpe × duration (minutes).
 */
function computeAcwr(logs: Array<{ rpe: number; duration: number; date: Date }>, at: Date): number | null {
  const acuteCutoff = new Date(at.getTime() - 7 * 24 * 3600 * 1000);
  const chronicCutoff = new Date(at.getTime() - 28 * 24 * 3600 * 1000);
  let acute = 0;
  let chronic = 0;
  for (const l of logs) {
    if (l.date < chronicCutoff) continue;
    const sRpe = l.rpe * l.duration;
    if (l.date >= acuteCutoff) acute += sRpe;
    chronic += sRpe;
  }
  if (chronic === 0) return null;
  return acute / (chronic / 4);
}

function acwrBucket(acwr: number): 'low' | 'optimal' | 'high' | 'danger' {
  if (acwr < 0.8) return 'low';
  if (acwr <= 1.3) return 'optimal';
  if (acwr <= 1.5) return 'high';
  return 'danger';
}

async function callAiSummary(
  app: FastifyInstance,
  organizationId: string,
  userId: string | null,
  payload: {
    audience: string;
    organization_name: string;
    period_from: string;
    period_to: string;
    data: unknown;
  },
): Promise<string | null> {
  // Il riassunto di un report è testo breve e schematico: va sul modello
  // economico. Il modello va passato esplicitamente all'ai-service.
  const model = getModelForOperation('REPORT');
  const startedAt = Date.now();

  try {
    const res = await fetch(`${AI_SERVICE_URL}/ai/generate-report-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, language: 'it', model }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      void recordAiUsage(app, {
        organizationId,
        userId,
        operation: 'REPORT',
        endpoint: '/ai/generate-report-summary',
        requestedModel: model,
        success: false,
        errorCode: `HTTP_${res.status}`,
        durationMs: Date.now() - startedAt,
      });
      return null;
    }

    const body = (await res.json()) as { summary?: string };
    void recordAiUsage(app, {
      organizationId,
      userId,
      operation: 'REPORT',
      endpoint: '/ai/generate-report-summary',
      requestedModel: model,
      usage: extractUsage(body),
      durationMs: Date.now() - startedAt,
    });
    return body.summary ?? null;
  } catch (err) {
    void recordAiUsage(app, {
      organizationId,
      userId,
      operation: 'REPORT',
      endpoint: '/ai/generate-report-summary',
      requestedModel: model,
      success: false,
      errorCode: (err instanceof Error ? err.message : String(err)).slice(0, 60),
      durationMs: Date.now() - startedAt,
    });
    return null;
  }
}

// ─── Aggregators ────────────────────────────────────────

async function aggregateStaff(
  app: FastifyInstance,
  organizationId: string,
  from: Date,
  to: Date,
  metadata: ReportMetadata,
  teamId?: string,
): Promise<StaffReportData> {
  const prisma = app.prisma;

  // Active athletes — filter by team if specified
  let athletes;
  if (teamId) {
    const teamAthletes = await prisma.athleteTeam.findMany({
      where: { teamId },
      select: { athlete: { select: { id: true, firstName: true, lastName: true } } },
    });
    athletes = teamAthletes.map((ta) => ta.athlete);
  } else {
    athletes = await prisma.athlete.findMany({
      where: { organizationId },
      select: { id: true, firstName: true, lastName: true },
    });
  }
  const athleteIds = athletes.map((a) => a.id);

  // Training data in the chronic window (needed for ACWR of each athlete at `to`)
  // Query TrainingSession directly — includes plan sessions, field training, and game completions
  const chronicFrom = new Date(to.getTime() - 28 * 24 * 3600 * 1000);
  // Include ALL completed sessions (game, field, plan) — don't filter by rpe
  const rawSessionsWhere: Record<string, unknown> = {
    organizationId,
    date: { gte: chronicFrom, lte: to },
    status: 'COMPLETED',
    isTemplate: false,
  };
  if (teamId) {
    rawSessionsWhere.OR = [
      { athleteId: { in: athleteIds } },
      { athleteId: null, week: { trainingPlan: { teamId } } },
    ];
  } else {
    rawSessionsWhere.athleteId = { in: athleteIds };
  }
  const rawSessions = await prisma.trainingSession.findMany({
    where: rawSessionsWhere,
    select: {
      athleteId: true,
      date: true,
      rpe: true,
      duration: true,
      week: { select: { trainingPlan: { select: { teamId: true } } } },
    },
  });

  // For sRPE calcs: use rpe when available, default to 5 for sessions without RPE (games etc.)
  // Also attribute team-plan sessions (athleteId null) to all team athletes
  const teamAthletesMap = teamId
    ? { [teamId]: athleteIds }
    : await (async () => {
        const ta = await prisma.athleteTeam.findMany({
          where: { team: { organizationId } },
          select: { athleteId: true, teamId: true },
        });
        const map: Record<string, string[]> = {};
        for (const t of ta) {
          if (!map[t.teamId]) map[t.teamId] = [];
          map[t.teamId].push(t.athleteId);
        }
        return map;
      })();

  const sessionLogs: Array<{ athleteId: string; date: Date; rpe: number; duration: number }> = [];
  for (const s of rawSessions) {
    if (!s.date) continue;
    const rpe = s.rpe ?? 5;
    const duration = s.duration || 60;
    if (s.athleteId) {
      sessionLogs.push({ athleteId: s.athleteId, date: s.date, rpe, duration });
    } else {
      // Team-plan session → attribute to all team athletes
      const sessTeamId = s.week?.trainingPlan?.teamId;
      if (sessTeamId && teamAthletesMap[sessTeamId]) {
        for (const aid of teamAthletesMap[sessTeamId]) {
          sessionLogs.push({ athleteId: aid, date: s.date, rpe, duration });
        }
      }
    }
  }

  // ACWR distribution
  const acwrDist = { low: 0, optimal: 0, high: 0, danger: 0 };
  for (const a of athletes) {
    const athleteLogs = sessionLogs.filter((l) => l.athleteId === a.id);
    const acwr = computeAcwr(athleteLogs, to);
    if (acwr === null) continue;
    acwrDist[acwrBucket(acwr)]++;
  }

  // Sessions completed in the period (plan-based + standalone field/game)
  const sessionsCompletedWhere: Record<string, unknown> = {
    organizationId,
    date: { gte: from, lte: to },
    isTemplate: false,
  };
  if (teamId) {
    sessionsCompletedWhere.OR = [
      { athleteId: { in: athleteIds } },
      { athleteId: null, week: { trainingPlan: { teamId } } },
    ];
  }
  const trainingSessions = await prisma.trainingSession.findMany({
    where: sessionsCompletedWhere,
    select: { status: true },
  });
  const planned = trainingSessions.length;
  const completed = trainingSessions.filter((s) => s.status === 'COMPLETED').length;
  const cancelled = trainingSessions.filter((s) => s.status === 'CANCELLED').length;
  const completionRate = planned > 0 ? completed / planned : 0;

  // Active notifications (alerts) in period — Notification is scoped by user.organizationId
  const notifications = await prisma.notification.findMany({
    where: {
      user: { organizationId },
      createdAt: { gte: from, lte: to },
      type: { in: ['alert', 'ai_insight'] },
    },
    select: {
      severity: true,
      title: true,
      createdAt: true,
      data: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const activeAlertsByAthlete = new Map<string, string>(
    athletes.map((a) => [a.id, `${a.firstName} ${a.lastName}`]),
  );
  const activeAlerts: ReportTable = {
    title: 'Alert attivi nel periodo',
    columns: ['Data', 'Severità', 'Atleta', 'Messaggio'],
    rows: notifications.slice(0, 20).map((n) => {
      const athleteId = (n.data as { athleteId?: string } | null)?.athleteId;
      return [
        n.createdAt.toLocaleDateString('it-IT'),
        (n.severity || 'info').toUpperCase(),
        athleteId ? activeAlertsByAthlete.get(athleteId) || '—' : '—',
        n.title,
      ];
    }),
    footnote: notifications.length > 20 ? `+${notifications.length - 20} altri alert nel periodo` : undefined,
  };

  // Wellness trend — daily team average
  const wellnessLogs = await prisma.wellnessLog.findMany({
    where: {
      athleteId: { in: athleteIds },
      date: { gte: from, lte: to },
    },
    select: { date: true, sleepQuality: true, mood: true, fatigue: true, soreness: true, stress: true },
  });
  const wellnessByDay = new Map<string, number[]>();
  for (const w of wellnessLogs) {
    const k = w.date.toISOString().slice(0, 10);
    const score = computeWellnessScore(w);
    if (!wellnessByDay.has(k)) wellnessByDay.set(k, []);
    wellnessByDay.get(k)!.push(score);
  }
  const wellnessTrendLabels: string[] = [];
  const wellnessTrendData: number[] = [];
  const dayMs = 24 * 3600 * 1000;
  for (let t = from.getTime(); t <= to.getTime(); t += dayMs) {
    const k = new Date(t).toISOString().slice(0, 10);
    const scores = wellnessByDay.get(k) || [];
    wellnessTrendLabels.push(new Date(t).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }));
    wellnessTrendData.push(scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0);
  }
  const wellnessTrend: ReportChart = {
    title: 'Wellness medio team',
    type: 'line',
    labels: wellnessTrendLabels,
    datasets: [{ label: 'Wellness (0-100)', data: wellnessTrendData.map((v) => Math.round(v)), color: '#0d9488' }],
    yAxisLabel: 'Score',
  };

  // Load trend — team daily sRPE sum
  const loadByDay = new Map<string, number>();
  for (const l of sessionLogs) {
    if (l.date < from || l.date > to) continue;
    const k = l.date.toISOString().slice(0, 10);
    loadByDay.set(k, (loadByDay.get(k) || 0) + l.rpe * l.duration);
  }
  const loadTrendLabels: string[] = [];
  const loadTrendData: number[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += dayMs) {
    const k = new Date(t).toISOString().slice(0, 10);
    loadTrendLabels.push(new Date(t).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }));
    loadTrendData.push(loadByDay.get(k) || 0);
  }
  const loadTrend: ReportChart = {
    title: 'Carico giornaliero team (sRPE totale)',
    type: 'bar',
    labels: loadTrendLabels,
    datasets: [{ label: 'sRPE', data: loadTrendData, color: '#3b82f6' }],
    yAxisLabel: 'sRPE',
  };

  const kpis: ReportKPI[] = [
    { label: 'Atleti monitorati', value: athletes.length, severity: 'info' },
    {
      label: 'Completamento sessioni',
      value: formatPct(completionRate),
      severity: completionRate >= 0.8 ? 'success' : completionRate >= 0.6 ? 'warning' : 'danger',
    },
    {
      label: 'ACWR in zona rossa',
      value: acwrDist.high + acwrDist.danger,
      severity: acwrDist.danger > 0 ? 'danger' : acwrDist.high > 0 ? 'warning' : 'success',
    },
    {
      label: 'Alert nel periodo',
      value: notifications.length,
      severity: notifications.length > 10 ? 'warning' : 'info',
    },
  ];

  return {
    audience: 'STAFF',
    metadata,
    summary: '',
    kpis,
    acwrDistribution: acwrDist,
    sessionsCompleted: { planned, completed, cancelled, completionRate },
    activeAlerts,
    wellnessTrend,
    loadTrend,
  };
}

async function aggregateMedical(
  app: FastifyInstance,
  organizationId: string,
  from: Date,
  to: Date,
  metadata: ReportMetadata,
  teamId?: string,
): Promise<MedicalReportData> {
  const prisma = app.prisma;

  // If team filter, get team athlete IDs
  let teamAthleteIds: string[] | undefined;
  if (teamId) {
    const ta = await prisma.athleteTeam.findMany({
      where: { teamId },
      select: { athleteId: true },
    });
    teamAthleteIds = ta.map((t) => t.athleteId);
  }

  // Injuries active during the period
  const injuries = await prisma.injury.findMany({
    where: {
      athlete: { organizationId },
      ...(teamAthleteIds ? { athleteId: { in: teamAthleteIds } } : {}),
      OR: [
        { dateResolved: null },
        { dateResolved: { gte: from } },
      ],
    },
    include: {
      athlete: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { dateOccurred: 'desc' },
  });

  const now = new Date();
  const injuredAthletes: ReportTable = {
    title: 'Atleti infortunati',
    columns: ['Atleta', 'Tipo', 'Fase RTP', 'Giorni dall\'infortunio', 'Stato'],
    rows: injuries.map((i) => {
      const daysSince = Math.round(
        (now.getTime() - new Date(i.dateOccurred).getTime()) / (24 * 3600 * 1000),
      );
      return [
        `${i.athlete.firstName} ${i.athlete.lastName}`,
        i.type || '—',
        (i as unknown as { rtpPhase?: string }).rtpPhase || '—',
        daysSince,
        i.dateResolved ? 'Risolto' : 'Attivo',
      ];
    }),
  };

  // RTP phase distribution (bar chart)
  const phaseCounts: Record<string, number> = {
    PHASE_1: 0, PHASE_2: 0, PHASE_3: 0, PHASE_4: 0, PHASE_5: 0, CLEARED: 0,
  };
  for (const i of injuries) {
    const phase = (i as unknown as { rtpPhase?: string }).rtpPhase;
    if (phase && phase in phaseCounts) phaseCounts[phase]++;
  }
  const rtpProgress: ReportChart = {
    title: 'Distribuzione fasi Return-to-Play',
    type: 'bar',
    labels: ['Fase 1', 'Fase 2', 'Fase 3', 'Fase 4', 'Fase 5', 'Clear'],
    datasets: [{
      label: 'Atleti',
      data: [
        phaseCounts.PHASE_1, phaseCounts.PHASE_2, phaseCounts.PHASE_3,
        phaseCounts.PHASE_4, phaseCounts.PHASE_5, phaseCounts.CLEARED,
      ],
      color: '#ef4444',
    }],
  };

  // Recovery metrics — avg wellness per injured athlete in period
  const injuredIds = injuries.map((i) => i.athlete.id);
  const wellnessLogs = await prisma.wellnessLog.findMany({
    where: {
      athleteId: { in: injuredIds },
      date: { gte: from, lte: to },
    },
  });
  const grouped = new Map<string, typeof wellnessLogs>();
  for (const w of wellnessLogs) {
    if (!grouped.has(w.athleteId)) grouped.set(w.athleteId, []);
    grouped.get(w.athleteId)!.push(w);
  }
  const recoveryMetrics: ReportTable = {
    title: 'Metriche recovery atleti infortunati',
    columns: ['Atleta', 'Sonno avg', 'Dolori avg', 'Fatica avg', 'Wellness %'],
    rows: injuries.map((i) => {
      const logs = grouped.get(i.athlete.id) || [];
      if (logs.length === 0) {
        return [`${i.athlete.firstName} ${i.athlete.lastName}`, '—', '—', '—', '—'];
      }
      const avg = (k: 'sleepQuality' | 'soreness' | 'fatigue') =>
        logs.reduce((s, l) => s + l[k], 0) / logs.length;
      const wellnessAvg =
        logs.reduce((s, l) => s + computeWellnessScore(l), 0) / logs.length;
      return [
        `${i.athlete.firstName} ${i.athlete.lastName}`,
        avg('sleepQuality').toFixed(1),
        avg('soreness').toFixed(1),
        avg('fatigue').toFixed(1),
        `${wellnessAvg.toFixed(0)}%`,
      ];
    }),
  };

  // Wellness flags — any athlete (injured or not) with sustained poor wellness
  const orgAthletes = await prisma.athlete.findMany({
    where: {
      organizationId,
      ...(teamAthleteIds ? { id: { in: teamAthleteIds } } : {}),
    },
    select: { id: true, firstName: true, lastName: true },
  });
  const recent = await prisma.wellnessLog.findMany({
    where: {
      athleteId: { in: orgAthletes.map((a) => a.id) },
      date: { gte: from, lte: to },
    },
  });
  const poorByAthlete = new Map<string, number>();
  for (const w of recent) {
    if (computeWellnessScore(w) < 55) {
      poorByAthlete.set(w.athleteId, (poorByAthlete.get(w.athleteId) || 0) + 1);
    }
  }
  const wellnessFlags: ReportTable = {
    title: 'Atleti con wellness segnalato',
    columns: ['Atleta', 'Giorni in zona critica', 'Stato'],
    rows: Array.from(poorByAthlete.entries())
      .filter(([, count]) => count >= 2)
      .map(([athleteId, count]) => {
        const a = orgAthletes.find((x) => x.id === athleteId);
        return [
          a ? `${a.firstName} ${a.lastName}` : athleteId,
          count,
          count >= 4 ? 'Critico' : 'Monitorare',
        ];
      }),
  };

  const active = injuries.filter((i) => !i.dateResolved).length;
  const cleared = injuries.filter((i) => i.dateResolved && i.dateResolved >= from).length;
  const avgRecoveryDays = (() => {
    const resolved = injuries.filter((i) => i.dateResolved);
    if (resolved.length === 0) return 0;
    const total = resolved.reduce((s, i) => {
      const days = (new Date(i.dateResolved!).getTime() - new Date(i.dateOccurred).getTime()) / (24 * 3600 * 1000);
      return s + days;
    }, 0);
    return Math.round(total / resolved.length);
  })();

  // Hide RTP chart if no data
  const hasRtpData = Object.values(phaseCounts).some((v) => v > 0);

  // ─── New section: Injury history by type ──────────────
  const typeCounts = new Map<string, number>();
  for (const i of injuries) {
    const t = i.type || 'Altro';
    typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
  }
  const typeLabels = Array.from(typeCounts.keys());
  const injuryHistoryByType: ReportChart | undefined = typeLabels.length > 0 ? {
    title: 'Infortuni per tipo',
    type: 'bar',
    labels: typeLabels,
    datasets: [{ label: 'Conteggio', data: typeLabels.map((k) => typeCounts.get(k)!), color: '#ef4444' }],
  } : undefined;

  // ─── New section: Injury history by body zone ─────────
  const zoneCounts = new Map<string, number>();
  for (const i of injuries) {
    const z = i.location || 'Altro';
    zoneCounts.set(z, (zoneCounts.get(z) || 0) + 1);
  }
  const zoneLabels = Array.from(zoneCounts.keys());
  const injuryHistoryByZone: ReportChart | undefined = zoneLabels.length > 0 ? {
    title: 'Infortuni per zona corporea',
    type: 'bar',
    labels: zoneLabels,
    datasets: [{ label: 'Conteggio', data: zoneLabels.map((k) => zoneCounts.get(k)!), color: '#f97316' }],
  } : undefined;

  // ─── New section: Wellness trend for injured athletes ──
  const dayMs = 24 * 3600 * 1000;
  let injuredWellnessTrend: ReportChart | undefined;
  if (wellnessLogs.length > 0) {
    const wellnessByDay = new Map<string, number[]>();
    for (const w of wellnessLogs) {
      const k = w.date.toISOString().slice(0, 10);
      const score = computeWellnessScore(w);
      if (!wellnessByDay.has(k)) wellnessByDay.set(k, []);
      wellnessByDay.get(k)!.push(score);
    }
    const trendLabels: string[] = [];
    const trendData: number[] = [];
    for (let t = from.getTime(); t <= to.getTime(); t += dayMs) {
      const k = new Date(t).toISOString().slice(0, 10);
      const scores = wellnessByDay.get(k) || [];
      trendLabels.push(new Date(t).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }));
      trendData.push(scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0);
    }
    injuredWellnessTrend = {
      title: 'Wellness medio atleti infortunati',
      type: 'line',
      labels: trendLabels,
      datasets: [{ label: 'Wellness (0-100)', data: trendData, color: '#0d9488' }],
      yAxisLabel: 'Score',
    };
  }

  // ─── New section: Load vs injuries correlation ────────
  // Show training load per week alongside injury occurrences
  const athleteIdsForLoad = teamAthleteIds || orgAthletes.map((a) => a.id);
  const loadSessionsWhere: Record<string, unknown> = {
    organizationId,
    date: { gte: from, lte: to },
    status: 'COMPLETED',
    isTemplate: false,
  };
  if (teamId) {
    loadSessionsWhere.OR = [
      { athleteId: { in: athleteIdsForLoad } },
      { athleteId: null, week: { trainingPlan: { teamId } } },
    ];
  } else {
    loadSessionsWhere.athleteId = { in: athleteIdsForLoad };
  }
  const loadSessions = await prisma.trainingSession.findMany({
    where: loadSessionsWhere,
    select: { date: true, rpe: true, duration: true },
  });
  let loadVsInjuries: ReportChart | undefined;
  if (loadSessions.length > 0 || injuries.length > 0) {
    const weekLoadMap = new Map<string, number>();
    const weekInjuryMap = new Map<string, number>();
    for (const s of loadSessions) {
      if (!s.date) continue;
      const monday = new Date(s.date);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      weekLoadMap.set(key, (weekLoadMap.get(key) || 0) + (s.rpe ?? 5) * s.duration);
    }
    for (const i of injuries) {
      const monday = new Date(i.dateOccurred);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      if (new Date(key) >= from && new Date(key) <= to) {
        weekInjuryMap.set(key, (weekInjuryMap.get(key) || 0) + 1);
      }
    }
    const allWeeks = Array.from(new Set([...weekLoadMap.keys(), ...weekInjuryMap.keys()])).sort();
    if (allWeeks.length > 0) {
      loadVsInjuries = {
        title: 'Carico settimanale vs Infortuni',
        type: 'bar',
        labels: allWeeks.map((k) => new Date(k).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })),
        datasets: [
          { label: 'sRPE totale', data: allWeeks.map((k) => weekLoadMap.get(k) || 0), color: '#3b82f6' },
          { label: 'Infortuni', data: allWeeks.map((k) => (weekInjuryMap.get(k) || 0) * 500), color: '#ef4444' },
        ],
        yAxisLabel: 'sRPE / Infortuni (×500)',
      };
    }
  }

  const kpis: ReportKPI[] = [
    { label: 'Infortuni attivi', value: active, severity: active > 3 ? 'danger' : active > 0 ? 'warning' : 'success' },
    { label: 'RTP in corso', value: Object.values(phaseCounts).reduce((s, v) => s + v, 0) - phaseCounts.CLEARED },
    { label: 'Rientri nel periodo', value: cleared, severity: 'success' },
    { label: 'Giorni medi recupero', value: avgRecoveryDays || '—' },
  ];

  return {
    audience: 'MEDICAL',
    metadata,
    summary: '',
    kpis,
    injuredAthletes,
    rtpProgress: hasRtpData ? rtpProgress : null,
    recoveryMetrics,
    wellnessFlags,
    injuryHistoryByType,
    injuryHistoryByZone,
    injuredWellnessTrend,
    loadVsInjuries,
  };
}

async function aggregateTrainer(
  app: FastifyInstance,
  organizationId: string,
  from: Date,
  to: Date,
  metadata: ReportMetadata,
  teamId?: string,
): Promise<TrainerReportData> {
  const prisma = app.prisma;

  let athletes;
  if (teamId) {
    const teamAthletes = await prisma.athleteTeam.findMany({
      where: { teamId },
      select: { athlete: { select: { id: true, firstName: true, lastName: true } } },
    });
    athletes = teamAthletes.map((ta) => ta.athlete);
  } else {
    athletes = await prisma.athlete.findMany({
      where: { organizationId },
      select: { id: true, firstName: true, lastName: true },
    });
  }
  const athleteIds = athletes.map((a) => a.id);

  // Team map for attributing team-plan sessions to athletes
  const trainerTeamMap = teamId
    ? { [teamId]: athleteIds }
    : await (async () => {
        const ta = await prisma.athleteTeam.findMany({
          where: { team: { organizationId } },
          select: { athleteId: true, teamId: true },
        });
        const map: Record<string, string[]> = {};
        for (const t of ta) {
          if (!map[t.teamId]) map[t.teamId] = [];
          map[t.teamId].push(t.athleteId);
        }
        return map;
      })();

  // Adherence: planned vs completed per athlete in the period
  // Includes ALL sessions (plan-based + standalone field/game + team-plan)
  const adherenceWhere: Record<string, unknown> = {
    organizationId,
    date: { gte: from, lte: to },
    isTemplate: false,
  };
  if (teamId) {
    adherenceWhere.OR = [
      { athleteId: { in: athleteIds } },
      { athleteId: null, week: { trainingPlan: { teamId } } },
    ];
  }
  const sessions = await prisma.trainingSession.findMany({
    where: adherenceWhere,
    select: { status: true, athleteId: true, duration: true, rpe: true, week: { select: { trainingPlan: { select: { teamId: true } } } } },
  });

  // Build adherence map: attribute team-plan sessions to all team athletes
  const adherenceMap: Record<string, { planned: number; completed: number }> = {};
  for (const a of athletes) adherenceMap[a.id] = { planned: 0, completed: 0 };

  for (const s of sessions) {
    const targetIds: string[] = [];
    if (s.athleteId) {
      if (adherenceMap[s.athleteId]) targetIds.push(s.athleteId);
    } else {
      // Team-plan session → attribute to all team athletes
      const sessTeamId = s.week?.trainingPlan?.teamId;
      if (sessTeamId) {
        const teamMembers = teamId
          ? athleteIds
          : (trainerTeamMap[sessTeamId] || []);
        for (const aid of teamMembers) {
          if (adherenceMap[aid]) targetIds.push(aid);
        }
      }
    }
    for (const aid of targetIds) {
      adherenceMap[aid].planned++;
      if (s.status === 'COMPLETED') adherenceMap[aid].completed++;
    }
  }

  const adherenceRows: Array<Array<string | number>> = [];
  for (const a of athletes) {
    const stats = adherenceMap[a.id];
    if (stats.planned === 0) continue;
    const adherence = stats.completed / stats.planned;
    adherenceRows.push([
      `${a.firstName} ${a.lastName}`,
      stats.planned,
      stats.completed,
      formatPct(adherence),
    ]);
  }
  adherenceRows.sort((a, b) => parseInt(b[3] as string, 10) - parseInt(a[3] as string, 10));

  const adherenceByAthlete: ReportTable = {
    title: 'Aderenza piano per atleta',
    columns: ['Atleta', 'Pianificate', 'Completate', 'Aderenza'],
    rows: adherenceRows,
  };

  // Performance trend — ALL completed sessions (plan + field + game), no rpe filter
  const trainerSessionsWhere: Record<string, unknown> = {
    organizationId,
    date: { gte: from, lte: to },
    status: 'COMPLETED',
    isTemplate: false,
  };
  if (teamId) {
    trainerSessionsWhere.OR = [
      { athleteId: { in: athleteIds } },
      { athleteId: null, week: { trainingPlan: { teamId } } },
    ];
  } else {
    trainerSessionsWhere.athleteId = { in: athleteIds };
  }
  const rawTrainerSessions = await prisma.trainingSession.findMany({
    where: trainerSessionsWhere,
    select: {
      athleteId: true,
      date: true,
      rpe: true,
      duration: true,
      week: { select: { trainingPlan: { select: { teamId: true } } } },
    },
  });

  // Attribute team-plan sessions to all team athletes, default RPE=5 when null
  const sessionLogs: Array<{ athleteId: string; date: Date; rpe: number; duration: number }> = [];
  for (const s of rawTrainerSessions) {
    if (!s.date) continue;
    const rpe = s.rpe ?? 5;
    const duration = s.duration || 60;
    if (s.athleteId) {
      sessionLogs.push({ athleteId: s.athleteId, date: s.date, rpe, duration });
    } else {
      const sessTeamId = s.week?.trainingPlan?.teamId;
      if (sessTeamId && trainerTeamMap[sessTeamId]) {
        for (const aid of trainerTeamMap[sessTeamId]) {
          sessionLogs.push({ athleteId: aid, date: s.date, rpe, duration });
        }
      }
    }
  }
  sessionLogs.sort((a, b) => a.date.getTime() - b.date.getTime());

  const weekBuckets = new Map<string, { sum: number; count: number }>();
  for (const l of sessionLogs) {
    const monday = new Date(l.date);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    if (!weekBuckets.has(key)) weekBuckets.set(key, { sum: 0, count: 0 });
    const b = weekBuckets.get(key)!;
    b.sum += l.rpe * l.duration;
    b.count++;
  }
  const weekKeys = Array.from(weekBuckets.keys()).sort();
  const performanceTrends: ReportChart = {
    title: 'Volume settimanale team (sRPE totale)',
    type: 'line',
    labels: weekKeys.map((k) => new Date(k).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })),
    datasets: [{
      label: 'sRPE',
      data: weekKeys.map((k) => weekBuckets.get(k)!.sum),
      color: '#0d9488',
    }],
  };

  // Planned vs actual load per week
  // Use sessionLogs (completed with rpe) for actual, all sessions for planned
  const sessionsByWeek = new Map<string, { planned: number; actual: number }>();
  for (const l of sessionLogs) {
    const monday = new Date(l.date);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    if (!sessionsByWeek.has(key)) sessionsByWeek.set(key, { planned: 0, actual: 0 });
    sessionsByWeek.get(key)!.actual += l.rpe * l.duration;
  }
  // Planned = all sessions in period (completed or not) × target RPE 5
  const allSessionsForPlan = await prisma.trainingSession.findMany({
    where: {
      organizationId,
      date: { gte: from, lte: to },
      isTemplate: false,
      athleteId: { in: athleteIds },
    },
    select: { date: true, duration: true },
  });
  for (const s of allSessionsForPlan) {
    if (!s.date) continue;
    const monday = new Date(s.date);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    if (!sessionsByWeek.has(key)) sessionsByWeek.set(key, { planned: 0, actual: 0 });
    sessionsByWeek.get(key)!.planned += (s.duration || 60) * 5;
  }
  const pvaKeys = Array.from(sessionsByWeek.keys()).sort();
  const plannedVsActual: ReportChart = {
    title: 'Pianificato vs Effettivo',
    type: 'bar',
    labels: pvaKeys.map((k) => new Date(k).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })),
    datasets: [
      { label: 'Pianificato', data: pvaKeys.map((k) => sessionsByWeek.get(k)!.planned), color: '#94a3b8' },
      { label: 'Effettivo', data: pvaKeys.map((k) => sessionsByWeek.get(k)!.actual), color: '#0d9488' },
    ],
  };

  // Recent adaptations
  const recentAdaptations = await prisma.planAdaptation.findMany({
    where: {
      organizationId,
      createdAt: { gte: from, lte: to },
    },
    include: { athlete: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 15,
  });
  const adaptations: ReportTable = {
    title: 'Adattamenti AI nel periodo',
    columns: ['Data', 'Atleta', 'Δ Volume', 'Δ Intensità', 'Stato'],
    rows: recentAdaptations.map((a) => [
      a.createdAt.toLocaleDateString('it-IT'),
      `${a.athlete.firstName} ${a.athlete.lastName}`,
      a.volumeDelta != null ? `${(a.volumeDelta * 100).toFixed(0)}%` : '—',
      a.intensityDelta != null ? `${(a.intensityDelta * 100).toFixed(0)}%` : '—',
      a.status,
    ]),
  };

  // Top movers: biggest volume delta (absolute)
  const movers = recentAdaptations
    .filter((a) => a.volumeDelta != null)
    .sort((a, b) => Math.abs(b.volumeDelta!) - Math.abs(a.volumeDelta!))
    .slice(0, 5);
  const topMovers: ReportTable = {
    title: 'Atleti con maggiori variazioni',
    columns: ['Atleta', 'Δ Volume', 'Motivo'],
    rows: movers.map((m) => [
      `${m.athlete.firstName} ${m.athlete.lastName}`,
      `${(m.volumeDelta! * 100).toFixed(0)}%`,
      m.reason.length > 60 ? m.reason.slice(0, 57) + '…' : m.reason,
    ]),
  };

  const totalPlanned = adherenceRows.reduce((s, r) => s + (r[1] as number), 0);
  const totalCompleted = adherenceRows.reduce((s, r) => s + (r[2] as number), 0);
  const overallAdherence = totalPlanned > 0 ? totalCompleted / totalPlanned : 0;
  const adaptationsApplied = recentAdaptations.filter(
    (a) => a.status === 'APPROVED' || a.status === 'MODIFIED',
  ).length;

  const kpis: ReportKPI[] = [
    {
      label: 'Aderenza globale',
      value: formatPct(overallAdherence),
      severity: overallAdherence >= 0.85 ? 'success' : overallAdherence >= 0.7 ? 'warning' : 'danger',
    },
    { label: 'Sessioni completate', value: totalCompleted },
    { label: 'Adattamenti applicati', value: adaptationsApplied, severity: 'info' },
    { label: 'Periodo (giorni)', value: daysBetween(from, to) },
  ];

  return {
    audience: 'TRAINER',
    metadata,
    summary: '',
    kpis,
    adherenceByAthlete,
    performanceTrends,
    plannedVsActual,
    adaptations,
    topMovers,
  };
}

// ─── Route registration ─────────────────────────────────

export async function reportRoutes(app: FastifyInstance) {
  // ─── POST /ai/report ─────────────────────────────────
  app.post(
    '/ai/report',
    { preHandler: [app.authenticate, requireMinRole('TRAINER')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = generateReportSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Parametri non validi', details: parsed.error.flatten().fieldErrors },
        });
      }

      const { audience, periodFrom, periodTo, format, includeAISummary, teamId } = parsed.data;
      const { organizationId, userId } = request.user;

      let result: GenerateReportOutput;
      try {
        result = await generateReport({
          app,
          organizationId,
          userId,
          audience,
          periodFrom,
          periodTo,
          format,
          includeAISummary,
          teamId,
        });
      } catch (err) {
        request.log.error({ err }, 'Report generation failed');
        const message = err instanceof Error ? err.message : 'Errore nella generazione del report';
        return reply.status(500).send({
          success: false,
          error: { code: 'REPORT_FAILED', message },
        });
      }

      if (format === 'JSON') {
        return reply.send({ success: true, data: { report: result.report } });
      }

      reply.header('Content-Type', result.contentType);
      reply.header('Content-Disposition', `attachment; filename="${result.filename}"`);
      return reply.send(result.buffer);
    },
  );
}

// ─── Reusable report generator (used by HTTP route + cron worker) ───────

export interface GenerateReportInput {
  app: FastifyInstance;
  organizationId: string;
  userId: string;
  audience: 'STAFF' | 'MEDICAL' | 'TRAINER';
  periodFrom: string; // YYYY-MM-DD
  periodTo: string;   // YYYY-MM-DD
  format: 'JSON' | 'PDF' | 'DOCX';
  includeAISummary: boolean;
  teamId?: string;
}

export interface GenerateReportOutput {
  report: ReportData;
  buffer: Buffer | null;       // null when format === 'JSON'
  contentType: string;
  filename: string;
}

export async function generateReport(input: GenerateReportInput): Promise<GenerateReportOutput> {
  const { app, organizationId, userId, audience, periodFrom, periodTo, format, includeAISummary, teamId } = input;

  const from = new Date(periodFrom + 'T00:00:00Z');
  const to = new Date(periodTo + 'T23:59:59Z');
  if (from > to) {
    throw new Error('periodFrom deve essere anteriore a periodTo');
  }

  const [org, user, team] = await Promise.all([
    app.prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    app.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } }),
    teamId ? app.prisma.team.findUnique({ where: { id: teamId }, select: { name: true } }) : null,
  ]);

  const metadata: ReportMetadata = {
    audience,
    organizationName: org?.name || '—',
    periodFrom,
    periodTo,
    generatedAt: new Date().toISOString(),
    generatedBy: user ? `${user.firstName} ${user.lastName}` : '—',
    teamName: team?.name,
  };

  let report: ReportData;
  if (audience === 'STAFF') {
    report = await aggregateStaff(app, organizationId, from, to, metadata, teamId);
  } else if (audience === 'MEDICAL') {
    report = await aggregateMedical(app, organizationId, from, to, metadata, teamId);
  } else {
    report = await aggregateTrainer(app, organizationId, from, to, metadata, teamId);
  }

  if (includeAISummary) {
    const aiSummary = await callAiSummary(app, organizationId, userId, {
      audience,
      organization_name: metadata.organizationName,
      period_from: metadata.periodFrom,
      period_to: metadata.periodTo,
      data: report,
    });
    report.summary = aiSummary || buildFallbackSummary(report);
  } else {
    report.summary = buildFallbackSummary(report);
  }

  const teamSlug = team?.name ? `-${team.name.toLowerCase().replace(/\s+/g, '_')}` : '';
  const baseFilename = `report-${audience.toLowerCase()}${teamSlug}-${periodFrom}_${periodTo}`;

  if (format === 'JSON') {
    return {
      report,
      buffer: null,
      contentType: 'application/json',
      filename: `${baseFilename}.json`,
    };
  }

  if (format === 'PDF') {
    const buffer = await renderReportPdf(report);
    return {
      report,
      buffer,
      contentType: 'application/pdf',
      filename: `${baseFilename}.pdf`,
    };
  }

  // DOCX
  const buffer = await renderReportDocx(report);
  return {
    report,
    buffer,
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    filename: `${baseFilename}.docx`,
  };
}

// ─── Deterministic fallback summary ─────────────────────

function buildFallbackSummary(report: ReportData): string {
  const { metadata } = report;
  const periodLabel = `dal ${new Date(metadata.periodFrom).toLocaleDateString('it-IT')} al ${new Date(metadata.periodTo).toLocaleDateString('it-IT')}`;

  if (report.audience === 'STAFF') {
    const r = report as StaffReportData;
    const red = r.acwrDistribution.high + r.acwrDistribution.danger;
    return `Nel periodo ${periodLabel}, il team ha completato ${formatPct(r.sessionsCompleted.completionRate)} delle sessioni pianificate. ${red > 0 ? `${red} atleti presentano ACWR in zona di rischio e richiedono monitoraggio.` : 'La distribuzione del carico risulta ottimale per tutti gli atleti monitorati.'} Totale alert generati: ${r.activeAlerts.rows.length}.`;
  }

  if (report.audience === 'MEDICAL') {
    const r = report as MedicalReportData;
    const active = r.injuredAthletes.rows.filter((row) => row[4] === 'Attivo').length;
    return `Nel periodo ${periodLabel}, sono stati monitorati ${r.injuredAthletes.rows.length} atleti infortunati (${active} casi ancora attivi). ${r.wellnessFlags.rows.length > 0 ? `${r.wellnessFlags.rows.length} atleti presentano segnali wellness critici da monitorare.` : 'I dati wellness non mostrano criticità aggiuntive.'}`;
  }

  const r = report as TrainerReportData;
  const adherenceKpi = r.kpis.find((k) => k.label === 'Aderenza globale');
  return `Nel periodo ${periodLabel}, l'aderenza globale al piano è pari a ${adherenceKpi?.value ?? '—'}. ${r.adaptations.rows.length > 0 ? `Sono stati proposti ${r.adaptations.rows.length} adattamenti AI, di cui ${r.kpis.find((k) => k.label === 'Adattamenti applicati')?.value ?? 0} applicati.` : 'Nessun adattamento AI è stato necessario nel periodo.'}`;
}
