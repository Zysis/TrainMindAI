import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@trainmind/db';
import { calculateWellnessScore } from '@trainmind/utils';
import { requireMinRole } from '../middleware/rbac.js';
import { fullName } from '../lib/identity.js';
import { requirePlanFeature } from '../lib/plans.js';

// ═══════════════════════════════════════════════════════════
// PLAN ADAPTATIONS — Sprint 3.4, rivisto il 13/10/2026
// ═══════════════════════════════════════════════════════════
//
// Two adaptation modes:
//
// TEAM mode:
//   - Input: teamId
//   - Analyses: previous team sessions (completed)
//   - Target: a planned team session (athleteId null)
//   - Metrics: aggregate RPE/ACWR across all team members
//   - Stored with teamId set and athleteId NULL
//
// INDIVIDUAL mode:
//   - Input: athleteId
//   - Analyses: individual sessions + team sessions athlete participated in
//   - Target: a planned individual session (athleteId = athlete, or a
//     session without athlete inside the athlete's own mesocycle)
//   - Metrics: athlete-specific RPE, wellness, ACWR
//
// Ciclo di vita di una proposta:
//
//   PENDING ──approva──▶ APPROVED ─┐
//      │   ──corregge─▶ MODIFIED ──┼──ripristina──▶ REVERTED
//      │   ──rifiuta──▶ REJECTED   │
//      └── nuova proposta sulla stessa sessione ──▶ SUPERSEDED
//
// - La sessione da adattare si sceglie fra quelle PIANIFICATE da oggi a
//   ADAPT_MAX_DAYS_AHEAD giorni: le metriche sono sempre quelle di oggi, e
//   proiettarle piu' lontano dice poco.
// - Applicando, cio' che si scrive sulla sessione resta in `appliedPlan`.
// - Se la sessione e' cambiata dopo la generazione, l'approvazione si
//   rifiuta (ADAPTATION_STALE): i valori proposti erano calcolati su numeri
//   che non ci sono piu'.
// - "Ripristina originale" riporta gli esercizi ai valori di `originalPlan`;
//   solo sull'ultima proposta applicata alla sessione, e solo se la sessione
//   e' ancora pianificata.
//
// On approval, session exercises are updated and session is
// flagged with aiModified = true (visible in calendar + detail).
// ═══════════════════════════════════════════════════════════

/** Fin dove si puo' adattare: oltre, le metriche di oggi dicono poco. */
export const ADAPT_MAX_DAYS_AHEAD = 7;
const DAY_MS = 86_400_000;

const ADAPTATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'MODIFIED', 'SUPERSEDED', 'REVERTED'] as const;
const APPLIED_STATUSES = ['APPROVED', 'MODIFIED'];

// ─── Schemas ────────────────────────────────────────────

const adaptRequestSchema = z.object({
  mode: z.enum(['team', 'individual']),
  teamId: z.string().optional(),     // Required for team mode
  athleteId: z.string().optional(),   // Required for individual mode
  trainingSessionId: z.string().optional(),
  dryRun: z.boolean().default(false),
}).refine(
  (d) => (d.mode === 'team' && d.teamId) || (d.mode === 'individual' && d.athleteId),
  { message: 'teamId richiesto per modalità squadra, athleteId per modalità individuale' },
);

const adaptableSessionsQuerySchema = z.object({
  mode: z.enum(['team', 'individual']),
  teamId: z.string().optional(),
  athleteId: z.string().optional(),
}).refine(
  (d) => (d.mode === 'team' && d.teamId) || (d.mode === 'individual' && d.athleteId),
  { message: 'teamId richiesto per modalità squadra, athleteId per modalità individuale' },
);

// Il piano modificato arriva dal client e finisce dritto in scrittura sul
// database: va validato per davvero. Con `z.any()` non si controllava nulla,
// e un peso testuale arrivava fino a Prisma uscendo come 500.
//
// Si validano i tipi ma NON gli intervalli: un tetto arbitrario sui chili o
// sulle serie rifiuterebbe dati veri di qualche societa'. Le chiavi in piu'
// che il client manda (exerciseName, original*, action) le scarta zod da
// solo, senza far fallire la richiesta.
//
// `null` vuol dire "nessun valore" e viene scritto: svuotare il carico di un
// esercizio significa toglierlo. Un campo assente invece non si tocca.
const modifiedExerciseSchema = z.object({
  sessionExerciseId: z.string().min(1),
  proposedSets: z.number().int().min(0).nullable().optional(),
  proposedReps: z.string().max(50).nullable().optional(),
  proposedWeight: z.number().min(0).nullable().optional(),
  proposedRestTime: z.number().int().min(0).nullable().optional(),
});

const reviewAdaptationSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'MODIFIED']),
  reviewNotes: z.string().max(500).optional(),
  modifiedPlan: z.array(modifiedExerciseSchema).optional(),
});

const revertAdaptationSchema = z.object({
  // Da mandare dopo che il preparatore ha confermato di voler ripristinare
  // anche se la sessione e' stata ritoccata dopo l'applicazione.
  force: z.boolean().default(false),
});

const listAdaptationsSchema = z.object({
  status: z.enum(ADAPTATION_STATUSES).optional(),
  athleteId: z.string().optional(),
  teamId: z.string().optional(),
  mode: z.enum(['team', 'individual']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Types ──────────────────────────────────────────────

interface PerformanceMetrics {
  acwr: number;
  acuteLoad: number;
  chronicLoad: number;
  wellnessScore: number;
  rpeAvg: number;
  targetRpeAvg: number;
  completionRate: number;
  sessionsCount: number;
  rpeDeviation: number;
}

interface AdaptationProposal {
  reason: string;
  aiReasoning: string;
  volumeDelta: number;
  intensityDelta: number;
  changes: ChangeItem[];
  proposedExercises: ProposedExercise[];
  severity: 'info' | 'warning' | 'danger';
}

interface ChangeItem {
  type: 'volume' | 'intensity' | 'exercise' | 'rest';
  description: string;
  delta?: number;
  exerciseName?: string;
}

interface ProposedExercise {
  sessionExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  originalSets?: number | null;
  originalReps?: string | null;
  originalWeight?: number | null;
  originalRestTime?: number | null;
  proposedSets?: number | null;
  proposedReps?: string | null;
  proposedWeight?: number | null;
  proposedRestTime?: number | null;
  action: 'keep' | 'scale' | 'replace' | 'remove';
}

// ─── Helpers ────────────────────────────────────────────

/** Definizione unica in `@trainmind/utils`: qui c'era una copia della formula. */
const computeWellnessScore = calculateWellnessScore;

/**
 * Core adaptation algorithm. Decision tree:
 *   - ACWR > 1.5 OR wellness < 40 → danger: -20% vol, -10% intensity
 *   - ACWR > 1.3 OR wellness < 55 → warning: -15% vol
 *   - RPE deviation > +2 → -10% intensity
 *   - Completion < 70% → -10% vol
 *   - ACWR < 0.8 AND wellness > 70 → +10% vol (progression)
 *   - Otherwise → no change
 */
function buildProposal(
  metrics: PerformanceMetrics,
  sessionExercises: Array<{
    id: string;
    exerciseId: string;
    sets: number | null;
    reps: string | null;
    weight: number | null;
    restTime: number | null;
    exercise: { name: string };
  }>,
): AdaptationProposal {
  const changes: ChangeItem[] = [];
  let volumeDelta = 0;
  let intensityDelta = 0;
  let severity: 'info' | 'warning' | 'danger' = 'info';
  const reasons: string[] = [];

  if (metrics.acwr > 1.5 || metrics.wellnessScore < 40) {
    volumeDelta = -0.20;
    intensityDelta = -0.10;
    severity = 'danger';
    if (metrics.acwr > 1.5) reasons.push(`ACWR critico (${metrics.acwr.toFixed(2)})`);
    if (metrics.wellnessScore < 40) reasons.push(`Wellness molto basso (${metrics.wellnessScore}%)`);
  } else if (metrics.acwr > 1.3 || metrics.wellnessScore < 55) {
    volumeDelta = -0.15;
    severity = 'warning';
    if (metrics.acwr > 1.3) reasons.push(`ACWR alto (${metrics.acwr.toFixed(2)})`);
    if (metrics.wellnessScore < 55) reasons.push(`Wellness basso (${metrics.wellnessScore}%)`);
  } else if (metrics.rpeDeviation > 2) {
    intensityDelta = -0.10;
    severity = 'warning';
    reasons.push(`RPE reale +${metrics.rpeDeviation.toFixed(1)} rispetto al target`);
  } else if (metrics.completionRate < 0.70 && metrics.sessionsCount >= 2) {
    volumeDelta = -0.10;
    severity = 'warning';
    reasons.push(`Completamento basso (${Math.round(metrics.completionRate * 100)}%)`);
  } else if (metrics.acwr > 0 && metrics.acwr < 0.8 && metrics.wellnessScore > 70 && metrics.rpeDeviation < -1) {
    volumeDelta = 0.10;
    severity = 'info';
    reasons.push(`ACWR basso (${metrics.acwr.toFixed(2)}) con wellness ottimo (${metrics.wellnessScore}%) — progressione suggerita`);
  }

  const proposedExercises: ProposedExercise[] = sessionExercises.map((ex) => {
    const scaleVol = 1 + volumeDelta;
    const scaleInt = 1 + intensityDelta;
    let proposedSets = ex.sets;
    let proposedWeight = ex.weight;
    let action: ProposedExercise['action'] = 'keep';

    if (volumeDelta !== 0 && ex.sets) {
      proposedSets = Math.max(1, Math.round(ex.sets * scaleVol));
      if (proposedSets !== ex.sets) action = 'scale';
    }
    if (intensityDelta !== 0 && ex.weight) {
      proposedWeight = Math.round(ex.weight * scaleInt * 10) / 10;
      if (proposedWeight !== ex.weight) action = 'scale';
    }

    return {
      sessionExerciseId: ex.id,
      exerciseId: ex.exerciseId,
      exerciseName: ex.exercise.name,
      originalSets: ex.sets,
      originalReps: ex.reps,
      originalWeight: ex.weight,
      originalRestTime: ex.restTime,
      proposedSets,
      proposedReps: ex.reps,
      proposedWeight,
      proposedRestTime: ex.restTime,
      action,
    };
  });

  if (volumeDelta !== 0) {
    changes.push({
      type: 'volume',
      description: `${volumeDelta > 0 ? 'Aumento' : 'Riduzione'} volume ${Math.abs(Math.round(volumeDelta * 100))}%`,
      delta: volumeDelta,
    });
  }
  if (intensityDelta !== 0) {
    changes.push({
      type: 'intensity',
      description: `${intensityDelta > 0 ? 'Aumento' : 'Riduzione'} intensità ${Math.abs(Math.round(intensityDelta * 100))}%`,
      delta: intensityDelta,
    });
  }

  if (reasons.length === 0) {
    reasons.push('Tutti gli indicatori sono in range ottimale');
  }

  const reason = reasons.join('; ');
  const aiReasoning = [
    `Analisi basata su ${metrics.sessionsCount} sessioni recenti.`,
    `ACWR: ${metrics.acwr.toFixed(2)} (zona ${
      metrics.acwr < 0.8 ? 'bassa' : metrics.acwr <= 1.3 ? 'ottimale' : metrics.acwr <= 1.5 ? 'alta' : 'critica'
    }).`,
    `Wellness score: ${metrics.wellnessScore}%.`,
    `RPE medio: ${metrics.rpeAvg.toFixed(1)}/10 (target ${metrics.targetRpeAvg.toFixed(1)}, deviazione ${metrics.rpeDeviation >= 0 ? '+' : ''}${metrics.rpeDeviation.toFixed(1)}).`,
    `Tasso completamento: ${Math.round(metrics.completionRate * 100)}%.`,
    '',
    `Proposta: ${reason}.`,
    changes.length > 0 ? `Modifiche applicate: ${changes.map((c) => c.description).join(', ')}.` : 'Nessuna modifica necessaria.',
  ].join(' ');

  return { reason, aiReasoning, volumeDelta, intensityDelta, changes, proposedExercises, severity };
}

/**
 * Compute metrics from a list of completed sessions + wellness logs.
 * For team mode, sessionLogs may be empty (use session-level RPE/duration).
 */
function computeMetrics(
  recentSessions: Array<{
    date: Date | null;
    rpe: number | null;
    duration: number;
    status: string;
    sessionExercises: Array<{ sets: number | null }>;
    sessionLogs: Array<{ actualRpe: number | null; actualDuration: number | null; completedSets: unknown }>;
  }>,
  recentWellness: Array<{ sleepQuality: number; mood: number; fatigue: number; soreness: number; stress: number }>,
): PerformanceMetrics {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

  // ACWR
  const acuteSessions = recentSessions.filter((s) => s.date && new Date(s.date) >= weekAgo);
  const acuteLoad = acuteSessions.reduce((sum, s) => {
    const rpe = s.sessionLogs[0]?.actualRpe || s.rpe || 5;
    const dur = s.sessionLogs[0]?.actualDuration || s.duration || 60;
    return sum + rpe * dur;
  }, 0);
  const chronicLoad = recentSessions.length > 0
    ? recentSessions.reduce((sum, s) => {
        const rpe = s.sessionLogs[0]?.actualRpe || s.rpe || 5;
        const dur = s.sessionLogs[0]?.actualDuration || s.duration || 60;
        return sum + rpe * dur;
      }, 0) / 4
    : 0;
  const acwr = chronicLoad > 0 ? Math.round((acuteLoad / chronicLoad) * 100) / 100 : 0;

  // Wellness
  const wellnessScore = recentWellness.length > 0
    ? Math.round(recentWellness.reduce((sum, w) => sum + computeWellnessScore(w), 0) / recentWellness.length)
    : 75;

  // RPE (last 14 days)
  const twoWeekSessions = recentSessions.filter((s) => s.date && new Date(s.date) >= twoWeeksAgo);
  const rpeValues = twoWeekSessions
    .map((s) => s.sessionLogs[0]?.actualRpe)
    .filter((r): r is number => typeof r === 'number');
  const rpeAvg = rpeValues.length > 0 ? rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length : 5;
  const targetRpeValues = twoWeekSessions
    .map((s) => s.rpe)
    .filter((r): r is number => typeof r === 'number');
  const targetRpeAvg = targetRpeValues.length > 0
    ? targetRpeValues.reduce((a, b) => a + b, 0) / targetRpeValues.length
    : 6;
  const rpeDeviation = Math.round((rpeAvg - targetRpeAvg) * 10) / 10;

  // Completion rate
  let plannedSets = 0;
  let completedSets = 0;
  for (const s of twoWeekSessions) {
    const planned = s.sessionExercises.reduce((sum, ex) => sum + (ex.sets || 0), 0);
    plannedSets += planned;
    const logCompleted = s.sessionLogs[0]?.completedSets as Record<string, { sets?: unknown[] }> | null;
    if (logCompleted) {
      for (const key of Object.keys(logCompleted)) {
        const entry = logCompleted[key];
        if (entry && Array.isArray(entry.sets)) completedSets += entry.sets.length;
      }
    } else if (s.status === 'COMPLETED') {
      completedSets += planned;
    }
  }
  const completionRate = plannedSets > 0 ? Math.min(1, completedSets / plannedSets) : 1;

  return {
    acwr,
    acuteLoad: Math.round(acuteLoad),
    chronicLoad: Math.round(chronicLoad),
    wellnessScore,
    rpeAvg: Math.round(rpeAvg * 10) / 10,
    targetRpeAvg: Math.round(targetRpeAvg * 10) / 10,
    completionRate: Math.round(completionRate * 100) / 100,
    sessionsCount: twoWeekSessions.length,
    rpeDeviation,
  };
}

// ═══════════════════════════════════════════════════════════
// SESSIONI ADATTABILI E CONFRONTI
// ═══════════════════════════════════════════════════════════

/**
 * Le date delle sessioni sono salvate come giorno: "2026-10-13" diventa
 * 2026-10-13T00:00Z. Il confronto con `new Date()` che si faceva prima
 * escludeva la seduta di oggi appena passata la mezzanotte UTC. La finestra
 * parte quindi dalla mezzanotte UTC di oggi e comprende i
 * ADAPT_MAX_DAYS_AHEAD giorni successivi (oggi + 7).
 */
function adaptWindow(now: Date) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const to = new Date(from.getTime() + (ADAPT_MAX_DAYS_AHEAD + 1) * DAY_MS); // esclusivo
  return { from, to };
}

type AdaptTarget = { mode: 'team'; teamId: string } | { mode: 'individual'; athleteId: string };

/** Le sessioni che si possono adattare per una squadra o un atleta. */
function adaptableSessionWhere(
  target: AdaptTarget,
  organizationId: string,
  now: Date,
): Prisma.TrainingSessionWhereInput {
  const { from, to } = adaptWindow(now);
  const base: Prisma.TrainingSessionWhereInput = {
    status: 'PLANNED',
    isTemplate: false,
    date: { gte: from, lt: to },
  };
  if (target.mode === 'team') {
    return {
      ...base,
      athleteId: null,
      week: { trainingPlan: { teamId: target.teamId, organizationId } },
    };
  }
  return {
    ...base,
    week: { trainingPlan: { organizationId } },
    OR: [
      { athleteId: target.athleteId },
      // Mesociclo individuale le cui sessioni non portano l'atleta: sono sue.
      { athleteId: null, week: { trainingPlan: { athleteId: target.athleteId } } },
    ],
  };
}

/** Una riga di originalPlan / proposedPlan / appliedPlan, come salvata in JSON. */
interface PlanRow {
  sessionExerciseId: string;
  exerciseId?: string;
  exerciseName?: string;
  sets?: number | null;
  reps?: string | null;
  weight?: number | null;
  restTime?: number | null;
  originalSets?: number | null;
  originalReps?: string | null;
  originalWeight?: number | null;
  originalRestTime?: number | null;
  proposedSets?: number | null;
  proposedReps?: string | null;
  proposedWeight?: number | null;
  proposedRestTime?: number | null;
  action?: ProposedExercise['action'];
}

interface CurrentExercise {
  id: string;
  sets: number | null;
  reps: string | null;
  weight: number | null;
  restTime: number | null;
}

type ValueKeys = { sets: keyof PlanRow; reps: keyof PlanRow; weight: keyof PlanRow; restTime: keyof PlanRow };
const ORIGINAL_KEYS: ValueKeys = { sets: 'sets', reps: 'reps', weight: 'weight', restTime: 'restTime' };
const APPLIED_KEYS: ValueKeys = {
  sets: 'proposedSets', reps: 'proposedReps', weight: 'proposedWeight', restTime: 'proposedRestTime',
};

function asPlan(json: Prisma.JsonValue | null | undefined): PlanRow[] {
  return Array.isArray(json) ? (json as unknown as PlanRow[]) : [];
}

function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-6;
  // '' e null sono entrambi "niente": il client a volte manda l'uno, il DB ha l'altro.
  const norm = (v: unknown) => (v === '' || v === undefined ? null : v);
  return norm(a) === norm(b);
}

/**
 * Le righe dell'istantanea che non corrispondono piu' alla sessione: valore
 * cambiato, o esercizio tolto. Un campo assente dall'istantanea non si
 * confronta (le righe vecchie non li salvavano tutti). Gli esercizi aggiunti
 * dopo non contano: la proposta non li tocca.
 */
function rowsChangedSince(snapshot: PlanRow[], current: CurrentExercise[], keys: ValueKeys): PlanRow[] {
  const byId = new Map(current.map((c) => [c.id, c]));
  return snapshot.filter((row) => {
    const cur = byId.get(row.sessionExerciseId);
    if (!cur) return true;
    return (['sets', 'reps', 'weight', 'restTime'] as const).some((field) => {
      const snap = row[keys[field]];
      if (snap === undefined) return false;
      return !sameValue(snap, cur[field]);
    });
  });
}

function rowNames(rows: PlanRow[]): string[] {
  return rows.map((r) => r.exerciseName || r.sessionExerciseId);
}

function actionFor(row: PlanRow): ProposedExercise['action'] {
  const differs =
    !sameValue(row.originalSets, row.proposedSets) ||
    !sameValue(row.originalReps, row.proposedReps) ||
    !sameValue(row.originalWeight, row.proposedWeight) ||
    !sameValue(row.originalRestTime, row.proposedRestTime);
  return differs ? 'scale' : 'keep';
}

const toJson = (v: unknown) => v as Prisma.InputJsonValue;

// ═══════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════

export async function adaptationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  // Adattamenti AI: fuori dalla prova gratuita (9/10/2026).
  app.addHook('preHandler', requirePlanFeature(app, 'adaptations'));

  // ─── GET /ai/adapt/sessions — Sessioni che si possono adattare ───
  // Alimenta il selettore della pagina: pianificate, da oggi a +7 giorni,
  // con l'indicazione di quelle che hanno gia' una proposta in attesa.
  app.get('/ai/adapt/sessions', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = adaptableSessionsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }
    const { mode, teamId, athleteId } = parsed.data;
    const { organizationId } = request.user;
    const now = new Date();

    if (mode === 'team') {
      const team = await app.prisma.team.findFirst({ where: { id: teamId!, organizationId }, select: { id: true } });
      if (!team) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Squadra non trovata' } });
      }
    } else {
      const athlete = await app.prisma.athlete.findFirst({ where: { id: athleteId!, organizationId }, select: { id: true } });
      if (!athlete) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Atleta non trovato' } });
      }
    }

    const target: AdaptTarget = mode === 'team'
      ? { mode: 'team', teamId: teamId! }
      : { mode: 'individual', athleteId: athleteId! };

    const sessions = await app.prisma.trainingSession.findMany({
      where: adaptableSessionWhere(target, organizationId, now),
      select: { id: true, title: true, date: true, aiModified: true },
      orderBy: { date: 'asc' },
      take: 50,
    });

    const pending = sessions.length > 0
      ? await app.prisma.planAdaptation.findMany({
          where: { organizationId, status: 'PENDING', trainingSessionId: { in: sessions.map((s) => s.id) } },
          select: { id: true, trainingSessionId: true },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    const pendingBySession = new Map<string, string>();
    for (const p of pending) {
      if (p.trainingSessionId && !pendingBySession.has(p.trainingSessionId)) {
        pendingBySession.set(p.trainingSessionId, p.id);
      }
    }

    const { from, to } = adaptWindow(now);
    return reply.send({
      success: true,
      data: sessions.map((s) => ({ ...s, pendingAdaptationId: pendingBySession.get(s.id) ?? null })),
      meta: {
        maxDaysAhead: ADAPT_MAX_DAYS_AHEAD,
        from: from.toISOString(),
        to: new Date(to.getTime() - DAY_MS).toISOString(), // ultimo giorno compreso
      },
    });
  });

  // ─── POST /ai/adapt — Generate adaptation proposal ──────
  app.post('/ai/adapt', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = adaptRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const { mode, teamId, athleteId, trainingSessionId, dryRun } = parsed.data;
    const { organizationId, userId } = request.user;
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 28 * DAY_MS);
    const threeDaysAgo = new Date(now.getTime() - 3 * DAY_MS);

    // ─── Chi si adatta ──────────────────────────────────────
    let target: AdaptTarget;
    let subjectLabel: string;
    let wellnessAthleteIds: string[];
    let historyWhere: Prisma.TrainingSessionWhereInput;
    let logAthleteId: string | null = null;

    if (mode === 'team') {
      const team = await app.prisma.team.findFirst({
        where: { id: teamId!, organizationId },
        include: { athleteTeams: { select: { athleteId: true } } },
      });
      if (!team) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Squadra non trovata' } });
      }
      target = { mode: 'team', teamId: team.id };
      subjectLabel = `Adattamento squadra proposto per ${team.name}`;
      wellnessAthleteIds = team.athleteTeams.map((a) => a.athleteId);
      // Recent completed TEAM sessions for this team
      historyWhere = {
        athleteId: null,
        week: { trainingPlan: { teamId: team.id, organizationId } },
      };
    } else {
      const athlete = await app.prisma.athlete.findFirst({
        where: { id: athleteId!, organizationId },
        // Serve il nome per il titolo della notifica: va chiesto al caveau.
        include: { identity: { select: { firstName: true, lastName: true } } },
      });
      if (!athlete) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Atleta non trovato' } });
      }
      // Get athlete's teams (for fetching team sessions they participated in)
      const athleteTeamIds = await app.prisma.athleteTeam.findMany({
        where: { athleteId: athlete.id },
        select: { teamId: true },
      });
      const teamIds = athleteTeamIds.map((t) => t.teamId);
      target = { mode: 'individual', athleteId: athlete.id };
      subjectLabel = `Adattamento proposto per ${fullName(athlete)}`;
      wellnessAthleteIds = [athlete.id];
      logAthleteId = athlete.id;
      // Recent sessions: individual + team sessions (for history/metrics)
      historyWhere = {
        organizationId,
        OR: [
          { athleteId: athlete.id },
          { athleteId: null, week: { trainingPlan: { athleteId: athlete.id } } },
          ...(teamIds.length > 0
            ? [{ athleteId: null, week: { trainingPlan: { teamId: { in: teamIds } } } }]
            : []),
        ],
      };
    }

    // ─── Sessione da adattare ───────────────────────────────
    // Scelta dal preparatore, o la prima della finestra. In entrambi i casi
    // vale la stessa regola: pianificata, da oggi a +7 giorni.
    const targetSession = await app.prisma.trainingSession.findFirst({
      where: {
        ...adaptableSessionWhere(target, organizationId, now),
        ...(trainingSessionId ? { id: trainingSessionId } : {}),
      },
      include: { sessionExercises: { include: { exercise: true }, orderBy: { orderIndex: 'asc' } } },
      orderBy: { date: 'asc' },
    });

    if (!targetSession) {
      if (trainingSessionId) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'SESSION_NOT_ADAPTABLE',
            message: `Questa sessione non si può adattare: deve essere pianificata e cadere entro ${ADAPT_MAX_DAYS_AHEAD} giorni da oggi.`,
          },
        });
      }
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: mode === 'team'
            ? `Nessuna sessione di squadra pianificata nei prossimi ${ADAPT_MAX_DAYS_AHEAD} giorni`
            : `Nessuna sessione individuale pianificata nei prossimi ${ADAPT_MAX_DAYS_AHEAD} giorni per questo atleta`,
        },
      });
    }

    const [recentSessions, recentWellness] = await Promise.all([
      app.prisma.trainingSession.findMany({
        where: {
          ...historyWhere,
          status: 'COMPLETED',
          date: { gte: monthAgo },
          isTemplate: false,
        },
        include: {
          sessionExercises: { select: { sets: true } },
          sessionLogs: logAthleteId ? { where: { athleteId: logAthleteId }, take: 1 } : { take: 1 },
        },
        orderBy: { date: 'desc' },
      }),
      // Team wellness: average of all athletes in team (last 3 days)
      app.prisma.wellnessLog.findMany({
        where: { athleteId: { in: wellnessAthleteIds }, date: { gte: threeDaysAgo } },
        orderBy: { date: 'desc' },
      }),
    ]);

    const metrics = computeMetrics(recentSessions, recentWellness);
    const proposal = buildProposal(metrics, targetSession.sessionExercises);

    const originalPlan = targetSession.sessionExercises.map((ex) => ({
      sessionExerciseId: ex.id,
      exerciseId: ex.exerciseId,
      exerciseName: ex.exercise.name,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight,
      restTime: ex.restTime,
      orderIndex: ex.orderIndex,
    }));

    const targetSummary = { id: targetSession.id, title: targetSession.title, date: targetSession.date };

    if (dryRun) {
      return reply.send({
        success: true,
        data: { dryRun: true, mode, metrics, proposal, originalPlan, targetSession: targetSummary, metricsAsOf: now },
      });
    }

    // Una sola proposta in attesa per sessione: la nuova sostituisce le
    // precedenti, che restano visibili come SUPERSEDED.
    const { adaptation, supersededCount } = await app.prisma.$transaction(async (tx) => {
      const created = await tx.planAdaptation.create({
        data: {
          trainingSessionId: targetSession.id,
          athleteId: target.mode === 'individual' ? target.athleteId : null,
          teamId: target.mode === 'team' ? target.teamId : null,
          organizationId,
          proposedById: userId,
          status: 'PENDING',
          reason: proposal.reason,
          aiReasoning: proposal.aiReasoning,
          metrics: toJson(target.mode === 'team'
            ? { ...metrics, mode: 'team', teamId: target.teamId }
            : { ...metrics, mode: 'individual' }),
          originalPlan: toJson(originalPlan),
          proposedPlan: toJson(proposal.proposedExercises),
          changes: toJson(proposal.changes),
          volumeDelta: proposal.volumeDelta,
          intensityDelta: proposal.intensityDelta,
        },
      });
      const superseded = await tx.planAdaptation.updateMany({
        where: {
          organizationId,
          trainingSessionId: targetSession.id,
          status: 'PENDING',
          id: { not: created.id },
        },
        data: { status: 'SUPERSEDED', supersededById: created.id },
      });
      return { adaptation: created, supersededCount: superseded.count };
    });

    await app.prisma.notification.create({
      data: {
        userId,
        type: 'ai_insight',
        severity: proposal.severity,
        title: subjectLabel,
        message: proposal.reason,
        data: toJson({
          adaptationId: adaptation.id,
          ...(target.mode === 'team' ? { teamId: target.teamId } : { athleteId: target.athleteId }),
          sessionId: targetSession.id,
        }),
      },
    });

    return reply.status(201).send({
      success: true,
      data: {
        adaptationId: adaptation.id,
        status: adaptation.status,
        mode,
        metrics,
        proposal,
        originalPlan,
        targetSession: targetSummary,
        metricsAsOf: now,
        supersededCount,
      },
    });
  });

  // ─── GET /ai/adaptations — List adaptations ─────────────
  app.get('/ai/adaptations', async (request, reply) => {
    const parsedQuery = listAdaptationsSchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsedQuery.error.flatten().fieldErrors },
      });
    }
    const query = parsedQuery.data;
    const { organizationId } = request.user;

    // Prima `teamId` e `mode` venivano letti dallo schema e poi ignorati.
    const and: Prisma.PlanAdaptationWhereInput[] = [{ organizationId }];
    if (query.status) and.push({ status: query.status });
    if (query.athleteId) and.push({ athleteId: query.athleteId });
    if (query.teamId) and.push({ teamId: query.teamId });
    if (query.mode === 'team') and.push({ athleteId: null });
    if (query.mode === 'individual') and.push({ athleteId: { not: null } });
    const where: Prisma.PlanAdaptationWhereInput = { AND: and };

    const [adaptations, total] = await Promise.all([
      app.prisma.planAdaptation.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          athlete: { select: { id: true, identity: { select: { firstName: true, lastName: true } } } },
          team: { select: { id: true, name: true } },
          proposedBy: { select: { id: true, identity: { select: { firstName: true, lastName: true } } } },
          reviewedBy: { select: { id: true, identity: { select: { firstName: true, lastName: true } } } },
        },
      }),
      app.prisma.planAdaptation.count({ where }),
    ]);

    // Enrich with target session info
    const sessionIds = [...new Set(adaptations
      .map((a) => a.trainingSessionId)
      .filter((id): id is string => !!id))];
    const sessionsMap = new Map<string, { id: string; title: string; date: Date | null; status: string }>();
    // Per sessione, l'ultima proposta applicata e non ripristinata: e' l'unica
    // che si puo' annullare senza scavalcarne un'altra.
    const latestApplied = new Map<string, string>();
    if (sessionIds.length > 0) {
      const [sessions, applied] = await Promise.all([
        app.prisma.trainingSession.findMany({
          where: { id: { in: sessionIds } },
          select: { id: true, title: true, date: true, status: true },
        }),
        app.prisma.planAdaptation.findMany({
          where: { organizationId, trainingSessionId: { in: sessionIds }, status: { in: APPLIED_STATUSES } },
          select: { id: true, trainingSessionId: true },
          orderBy: { appliedAt: 'desc' },
        }),
      ]);
      for (const s of sessions) sessionsMap.set(s.id, s);
      for (const a of applied) {
        if (a.trainingSessionId && !latestApplied.has(a.trainingSessionId)) latestApplied.set(a.trainingSessionId, a.id);
      }
    }

    const enriched = adaptations.map((a) => {
      const m = a.metrics as Record<string, unknown> | null;
      const mode = (m?.mode as string) || (a.athleteId ? 'individual' : 'team');
      const session = a.trainingSessionId ? sessionsMap.get(a.trainingSessionId) || null : null;
      const canRevert = APPLIED_STATUSES.includes(a.status)
        && !!session
        && session.status === 'PLANNED'
        && latestApplied.get(session.id) === a.id;
      return {
        ...a,
        mode,
        teamName: a.team?.name ?? null,
        targetSession: session,
        canRevert,
      };
    });

    return reply.send({
      success: true,
      data: enriched,
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  });

  // ─── GET /ai/adaptations/:id — Get single adaptation ────
  app.get<{ Params: { id: string } }>('/ai/adaptations/:id', async (request, reply) => {
    const { id } = request.params;
    const adaptation = await app.prisma.planAdaptation.findFirst({
      where: { id, organizationId: request.user.organizationId },
      include: {
        athlete: { select: { id: true, identity: { select: { firstName: true, lastName: true } } } },
        team: { select: { id: true, name: true } },
        proposedBy: { select: { id: true, identity: { select: { firstName: true, lastName: true } } } },
        reviewedBy: { select: { id: true, identity: { select: { firstName: true, lastName: true } } } },
      },
    });

    if (!adaptation) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Adattamento non trovato' } });
    }

    return reply.send({ success: true, data: adaptation });
  });

  // ─── POST /ai/adaptations/:id/review — Approve/Reject/Modify ───
  app.post<{ Params: { id: string } }>('/ai/adaptations/:id/review', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const { id } = request.params;
    const parsed = reviewAdaptationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const { status, reviewNotes, modifiedPlan } = parsed.data;
    const { organizationId, userId } = request.user;
    const now = new Date();

    const adaptation = await app.prisma.planAdaptation.findFirst({
      where: { id, organizationId },
    });
    if (!adaptation) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Adattamento non trovato' } });
    }

    if (adaptation.status !== 'PENDING') {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'ADAPTATION_ALREADY_REVIEWED',
          message: 'Questa proposta è già stata gestita: non si può più approvare né rifiutare.',
          details: { status: adaptation.status },
        },
      });
    }

    // ─── Rifiuto: non si scrive niente sulla sessione ─────
    if (status === 'REJECTED') {
      const res = await app.prisma.planAdaptation.updateMany({
        where: { id, status: 'PENDING' },
        data: { status, reviewNotes, reviewedAt: now, reviewedById: userId },
      });
      if (res.count === 0) {
        return reply.status(409).send({
          success: false,
          error: { code: 'ADAPTATION_ALREADY_REVIEWED', message: 'Questa proposta è già stata gestita.' },
        });
      }
      const updated = await app.prisma.planAdaptation.findUnique({ where: { id } });
      return reply.send({ success: true, data: updated });
    }

    // ─── Approvazione, con o senza correzioni ─────────────
    if (!adaptation.trainingSessionId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_SESSION', message: 'Adattamento non collegato a nessuna sessione' },
      });
    }

    // Fissato in una costante, e non usato come `adaptation.trainingSessionId`
    // piu' sotto: dentro le callback TypeScript perde il restringimento fatto
    // dalla guardia qui sopra, il tipo torna `string | null` e Prisma lo
    // rifiuta. Una `const` locale invece il restringimento se lo tiene.
    const targetSessionId = adaptation.trainingSessionId;

    const session = await app.prisma.trainingSession.findFirst({
      where: { id: targetSessionId, OR: [{ organizationId }, { week: { trainingPlan: { organizationId } } }] },
      select: {
        id: true,
        status: true,
        date: true,
        sessionExercises: { select: { id: true, sets: true, reps: true, weight: true, restTime: true } },
      },
    });
    if (!session) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione non trovata' } });
    }
    if (session.status !== 'PLANNED' || (session.date && session.date < adaptWindow(now).from)) {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'SESSION_NOT_ADAPTABLE',
          message: 'La sessione non è più pianificata o è già passata: la proposta non si può applicare.',
        },
      });
    }

    // La proposta e' calcolata sui valori di quando e' nata. Se nel frattempo
    // qualcuno ha toccato la sessione, applicarla scriverebbe numeri calcolati
    // su un punto di partenza che non esiste piu'.
    const original = asPlan(adaptation.originalPlan);
    const stale = rowsChangedSince(original, session.sessionExercises, ORIGINAL_KEYS);
    if (stale.length > 0) {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'ADAPTATION_STALE',
          message: 'La sessione è stata modificata dopo la generazione della proposta: rigenerala per partire dai valori attuali.',
          details: { exercises: rowNames(stale) },
        },
      });
    }

    const proposed = asPlan(adaptation.proposedPlan);
    const exercises: PlanRow[] = (status === 'MODIFIED' && modifiedPlan) ? modifiedPlan : proposed;

    if (exercises.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: 'EMPTY_PLAN', message: 'Piano proposto vuoto' },
      });
    }

    // Gli esercizi devono appartenere ALLA sessione di questo adattamento.
    //
    // Prima il filtro era il solo `id`: verificava che quegli esercizi
    // esistessero al mondo, non che fossero i nostri. Con `status:
    // 'MODIFIED'` i `sessionExerciseId` arrivano dal corpo della richiesta,
    // quindi bastava conoscerne uno di un'altra societa' per riscriverne
    // serie, ripetizioni e carichi. Il vincolo sul genitore chiude la porta
    // una volta sola per tutti e due i percorsi (APPROVED usa il piano
    // proposto dall'AI, che nasce gia' da questa sessione).
    const validSet = new Set(session.sessionExercises.map((e) => e.id));
    const missing = exercises.filter((ex) => !validSet.has(ex.sessionExerciseId));
    if (missing.length > 0) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'EXERCISE_NOT_FOUND',
          message: `${missing.length} esercizi non appartengono a questa sessione — potrebbe essere stata modificata`,
        },
      });
    }

    // Cio' che si scrive davvero, con nome e valori di partenza accanto: e'
    // quello che si rivede riaprendo la proposta, ed e' la base del ripristino.
    const proposedById = new Map(proposed.map((p) => [p.sessionExerciseId, p]));
    const originalById = new Map(original.map((o) => [o.sessionExerciseId, o]));
    const appliedPlan: PlanRow[] = exercises.map((ex) => {
      const base = proposedById.get(ex.sessionExerciseId);
      const orig = originalById.get(ex.sessionExerciseId);
      const row: PlanRow = {
        sessionExerciseId: ex.sessionExerciseId,
        exerciseId: base?.exerciseId ?? orig?.exerciseId,
        exerciseName: base?.exerciseName ?? orig?.exerciseName,
        originalSets: base?.originalSets ?? orig?.sets ?? null,
        originalReps: base?.originalReps ?? orig?.reps ?? null,
        originalWeight: base?.originalWeight ?? orig?.weight ?? null,
        originalRestTime: base?.originalRestTime ?? orig?.restTime ?? null,
        proposedSets: ex.proposedSets !== undefined ? ex.proposedSets : base?.proposedSets,
        proposedReps: ex.proposedReps !== undefined ? ex.proposedReps : base?.proposedReps,
        proposedWeight: ex.proposedWeight !== undefined ? ex.proposedWeight : base?.proposedWeight,
        proposedRestTime: ex.proposedRestTime !== undefined ? ex.proposedRestTime : base?.proposedRestTime,
      };
      row.action = actionFor(row);
      return row;
    });

    const updated = await app.prisma.$transaction(async (tx) => {
      // Prima lo stato, con la condizione PENDING: se due richieste arrivano
      // insieme, la seconda non trova piu' niente da approvare.
      const claimed = await tx.planAdaptation.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status,
          reviewNotes,
          reviewedAt: now,
          reviewedById: userId,
          appliedAt: now,
          appliedPlan: toJson(appliedPlan),
        },
      });
      if (claimed.count === 0) return null;

      for (const ex of appliedPlan) {
        // updateMany e non update: accetta il filtro composto e cosi' il
        // vincolo sulla sessione vale anche qui, non solo nel controllo.
        // `undefined` lascia il campo com'e', `null` lo svuota.
        await tx.sessionExercise.updateMany({
          where: { id: ex.sessionExerciseId, trainingSessionId: targetSessionId },
          data: {
            sets: ex.proposedSets,
            reps: ex.proposedReps,
            weight: ex.proposedWeight,
            restTime: ex.proposedRestTime,
          },
        });
      }

      await tx.trainingSession.update({
        where: { id: targetSessionId },
        data: { aiModified: true },
      });

      return tx.planAdaptation.findUnique({ where: { id } });
    });

    if (!updated) {
      return reply.status(409).send({
        success: false,
        error: { code: 'ADAPTATION_ALREADY_REVIEWED', message: 'Questa proposta è già stata gestita.' },
      });
    }

    return reply.send({ success: true, data: updated });
  });

  // ─── POST /ai/adaptations/:id/revert — Ripristina originale ───
  // Riporta gli esercizi toccati dall'adattamento ai valori che avevano
  // prima. Solo sull'ultima proposta applicata alla sessione (altrimenti si
  // annullerebbe "sotto" una successiva) e solo se la sessione e' ancora
  // pianificata. Se dopo l'applicazione qualcuno ha ritoccato quegli
  // esercizi, chiede conferma (`force`) prima di sovrascrivere.
  app.post<{ Params: { id: string } }>('/ai/adaptations/:id/revert', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const { id } = request.params;
    const parsed = revertAdaptationSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }
    const { force } = parsed.data;
    const { organizationId, userId } = request.user;

    const adaptation = await app.prisma.planAdaptation.findFirst({ where: { id, organizationId } });
    if (!adaptation) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Adattamento non trovato' } });
    }
    if (!APPLIED_STATUSES.includes(adaptation.status) || !adaptation.trainingSessionId) {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'ADAPTATION_NOT_REVERTIBLE',
          message: 'Si può ripristinare solo un adattamento applicato.',
          details: { status: adaptation.status },
        },
      });
    }
    const targetSessionId = adaptation.trainingSessionId;

    const session = await app.prisma.trainingSession.findFirst({
      where: { id: targetSessionId, OR: [{ organizationId }, { week: { trainingPlan: { organizationId } } }] },
      select: {
        id: true,
        status: true,
        sessionExercises: { select: { id: true, sets: true, reps: true, weight: true, restTime: true } },
      },
    });
    if (!session) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sessione non trovata' } });
    }
    if (session.status !== 'PLANNED') {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'SESSION_COMPLETED_READONLY',
          message: 'La sessione è già stata svolta o annullata: non si può più ripristinare.',
        },
      });
    }

    const later = await app.prisma.planAdaptation.findFirst({
      where: {
        organizationId,
        trainingSessionId: targetSessionId,
        status: { in: APPLIED_STATUSES },
        id: { not: id },
        appliedAt: { gt: adaptation.appliedAt ?? new Date(0) },
      },
      select: { id: true },
    });
    if (later) {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'ADAPTATION_NOT_LATEST',
          message: 'Su questa sessione è stato applicato un adattamento più recente: ripristina prima quello.',
          details: { adaptationId: later.id },
        },
      });
    }

    const original = asPlan(adaptation.originalPlan);
    const applied = adaptation.appliedPlan ? asPlan(adaptation.appliedPlan) : null;

    // Le MODIFIED precedenti al 13/10/2026 non hanno salvato cosa hanno
    // scritto: non si sa se la sessione e' stata ritoccata dopo, e si chiede
    // conferma comunque.
    const conflicts = applied
      ? rowsChangedSince(applied, session.sessionExercises, APPLIED_KEYS)
      : original;
    if (conflicts.length > 0 && !force) {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'ADAPTATION_REVERT_CONFLICT',
          message: applied
            ? 'Dopo l’adattamento la sessione è stata modificata: ripristinando si perdono anche quelle modifiche.'
            : 'Di questo adattamento non è registrato cosa fu applicato: il ripristino riporta gli esercizi ai valori originali, qualunque modifica sia stata fatta dopo.',
          details: { exercises: rowNames(conflicts), unknownApplied: !applied },
        },
      });
    }

    // Si ripristinano solo gli esercizi che l'adattamento ha toccato e che
    // esistono ancora.
    const touched = new Set((applied ?? original).map((r) => r.sessionExerciseId));
    const existing = new Set(session.sessionExercises.map((e) => e.id));
    const toRestore = original.filter((o) => touched.has(o.sessionExerciseId) && existing.has(o.sessionExerciseId));
    const skipped = original.filter((o) => touched.has(o.sessionExerciseId) && !existing.has(o.sessionExerciseId));

    const now = new Date();
    const updated = await app.prisma.$transaction(async (tx) => {
      const claimed = await tx.planAdaptation.updateMany({
        where: { id, status: { in: APPLIED_STATUSES } },
        data: { status: 'REVERTED', revertedAt: now, revertedById: userId },
      });
      if (claimed.count === 0) return null;

      for (const o of toRestore) {
        await tx.sessionExercise.updateMany({
          where: { id: o.sessionExerciseId, trainingSessionId: targetSessionId },
          data: { sets: o.sets, reps: o.reps, weight: o.weight, restTime: o.restTime },
        });
      }

      // Il badge "Modificata dall'AI" resta se sulla sessione c'e' ancora un
      // adattamento precedente in vigore.
      const stillApplied = await tx.planAdaptation.count({
        where: { trainingSessionId: targetSessionId, status: { in: APPLIED_STATUSES } },
      });
      await tx.trainingSession.update({
        where: { id: targetSessionId },
        data: { aiModified: stillApplied > 0 },
      });

      return tx.planAdaptation.findUnique({ where: { id } });
    });

    if (!updated) {
      return reply.status(409).send({
        success: false,
        error: { code: 'ADAPTATION_NOT_REVERTIBLE', message: 'Questo adattamento è già stato ripristinato.' },
      });
    }

    return reply.send({
      success: true,
      data: { ...updated, restoredCount: toRestore.length, skippedExercises: rowNames(skipped) },
    });
  });
}
