import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireMinRole } from '../middleware/rbac.js';

// ═══════════════════════════════════════════════════════════
// PLAN ADAPTATIONS — Sprint 3.4
// ═══════════════════════════════════════════════════════════
//
// Two adaptation modes:
//
// TEAM mode:
//   - Input: teamId
//   - Analyses: previous team sessions (completed)
//   - Target: next planned team session (athleteId null)
//   - Metrics: aggregate RPE/ACWR across all team members
//
// INDIVIDUAL mode:
//   - Input: athleteId
//   - Analyses: individual sessions + team sessions athlete participated in
//   - Target: next planned individual session (athleteId = athlete)
//   - Metrics: athlete-specific RPE, wellness, ACWR
//
// On approval, session exercises are updated and session is
// flagged with aiModified = true (visible in calendar + detail).
// ═══════════════════════════════════════════════════════════

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

const reviewAdaptationSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'MODIFIED']),
  reviewNotes: z.string().max(500).optional(),
  modifiedPlan: z.any().optional(),
});

const listAdaptationsSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'MODIFIED']).optional(),
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

function computeWellnessScore(log: {
  sleepQuality: number;
  mood: number;
  fatigue: number;
  soreness: number;
  stress: number;
}): number {
  return Math.round(
    ((log.sleepQuality + log.mood + (6 - log.fatigue) + (6 - log.soreness) + (6 - log.stress)) / 25) * 100,
  );
}

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
// ROUTES
// ═══════════════════════════════════════════════════════════

export async function adaptationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

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
    const monthAgo = new Date(now.getTime() - 28 * 86400000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);

    // ─── TEAM MODE ──────────────────────────────────────────
    if (mode === 'team') {
      // Verify team
      const team = await app.prisma.team.findFirst({
        where: { id: teamId!, organizationId },
        include: { athleteTeams: { select: { athleteId: true } } },
      });
      if (!team) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Squadra non trovata' } });
      }

      const teamAthleteIds = team.athleteTeams.map((a) => a.athleteId);

      // Find target: next planned TEAM session (athleteId null) for this team
      let targetSession;
      if (trainingSessionId) {
        targetSession = await app.prisma.trainingSession.findFirst({
          where: { id: trainingSessionId, athleteId: null, week: { trainingPlan: { teamId: teamId!, organizationId } } },
          include: { sessionExercises: { include: { exercise: true }, orderBy: { orderIndex: 'asc' } } },
        });
      } else {
        targetSession = await app.prisma.trainingSession.findFirst({
          where: {
            status: 'PLANNED',
            date: { gte: now },
            athleteId: null,
            week: { trainingPlan: { teamId: teamId!, organizationId } },
          },
          include: { sessionExercises: { include: { exercise: true }, orderBy: { orderIndex: 'asc' } } },
          orderBy: { date: 'asc' },
        });
      }

      if (!targetSession) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Nessuna sessione di squadra pianificata trovata' },
        });
      }

      // Recent completed TEAM sessions for this team
      const recentSessions = await app.prisma.trainingSession.findMany({
        where: {
          status: 'COMPLETED',
          date: { gte: monthAgo },
          athleteId: null,
          isTemplate: false,
          week: { trainingPlan: { teamId: teamId!, organizationId } },
        },
        include: {
          sessionExercises: { select: { sets: true } },
          sessionLogs: { take: 1 },
        },
        orderBy: { date: 'desc' },
      });

      // Team wellness: average of all athletes in team (last 3 days)
      const recentWellness = await app.prisma.wellnessLog.findMany({
        where: { athleteId: { in: teamAthleteIds }, date: { gte: threeDaysAgo } },
        orderBy: { date: 'desc' },
      });

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

      if (dryRun) {
        return reply.send({
          success: true,
          data: { dryRun: true, mode: 'team', metrics, proposal, originalPlan, targetSession: { id: targetSession.id, title: targetSession.title, date: targetSession.date } },
        });
      }

      const adaptation = await app.prisma.planAdaptation.create({
        data: {
          trainingSessionId: targetSession.id,
          athleteId: teamAthleteIds[0] || userId, // Use first athlete as anchor; mode stored in metrics
          organizationId,
          proposedById: userId,
          status: 'PENDING',
          reason: proposal.reason,
          aiReasoning: proposal.aiReasoning,
          metrics: { ...metrics, mode: 'team', teamId: teamId! } as any,
          originalPlan: originalPlan as any,
          proposedPlan: proposal.proposedExercises as any,
          changes: proposal.changes as any,
          volumeDelta: proposal.volumeDelta,
          intensityDelta: proposal.intensityDelta,
        },
      });

      await app.prisma.notification.create({
        data: {
          userId,
          type: 'ai_insight',
          severity: proposal.severity,
          title: `Adattamento squadra proposto per ${team.name}`,
          message: proposal.reason,
          data: { adaptationId: adaptation.id, teamId: teamId!, sessionId: targetSession.id } as any,
        },
      });

      return reply.status(201).send({
        success: true,
        data: {
          adaptationId: adaptation.id,
          mode: 'team',
          metrics,
          proposal,
          originalPlan,
          targetSession: { id: targetSession.id, title: targetSession.title, date: targetSession.date },
        },
      });
    }

    // ─── INDIVIDUAL MODE ────────────────────────────────────
    const athlete = await app.prisma.athlete.findFirst({
      where: { id: athleteId!, organizationId },
    });
    if (!athlete) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Atleta non trovato' } });
    }

    // Get athlete's teams (for fetching team sessions they participated in)
    const athleteTeamIds = await app.prisma.athleteTeam.findMany({
      where: { athleteId: athleteId! },
      select: { teamId: true },
    });
    const teamIds = athleteTeamIds.map((t) => t.teamId);

    // Find target: next planned INDIVIDUAL session (athleteId = this athlete)
    let targetSession;
    if (trainingSessionId) {
      targetSession = await app.prisma.trainingSession.findFirst({
        where: { id: trainingSessionId, athleteId: athleteId!, week: { trainingPlan: { organizationId } } },
        include: { sessionExercises: { include: { exercise: true }, orderBy: { orderIndex: 'asc' } } },
      });
    } else {
      targetSession = await app.prisma.trainingSession.findFirst({
        where: {
          status: 'PLANNED',
          date: { gte: now },
          athleteId: athleteId!,
          week: { trainingPlan: { organizationId } },
        },
        include: { sessionExercises: { include: { exercise: true }, orderBy: { orderIndex: 'asc' } } },
        orderBy: { date: 'asc' },
      });
    }

    if (!targetSession) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Nessuna sessione individuale pianificata trovata per questo atleta' },
      });
    }

    // Recent sessions: individual + team sessions (for history/metrics)
    const [recentSessions, recentWellness] = await Promise.all([
      app.prisma.trainingSession.findMany({
        where: {
          status: 'COMPLETED',
          date: { gte: monthAgo },
          organizationId,
          isTemplate: false,
          OR: [
            { athleteId: athleteId! },
            ...(teamIds.length > 0
              ? [{ athleteId: null, week: { trainingPlan: { teamId: { in: teamIds } } } }]
              : []),
          ],
        },
        include: {
          sessionExercises: { select: { sets: true } },
          sessionLogs: { where: { athleteId: athleteId! }, take: 1 },
        },
        orderBy: { date: 'desc' },
      }),
      app.prisma.wellnessLog.findMany({
        where: { athleteId: athleteId!, date: { gte: threeDaysAgo } },
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

    if (dryRun) {
      return reply.send({
        success: true,
        data: { dryRun: true, mode: 'individual', metrics, proposal, originalPlan, targetSession: { id: targetSession.id, title: targetSession.title, date: targetSession.date } },
      });
    }

    const adaptation = await app.prisma.planAdaptation.create({
      data: {
        trainingSessionId: targetSession.id,
        athleteId: athleteId!,
        organizationId,
        proposedById: userId,
        status: 'PENDING',
        reason: proposal.reason,
        aiReasoning: proposal.aiReasoning,
        metrics: { ...metrics, mode: 'individual' } as any,
        originalPlan: originalPlan as any,
        proposedPlan: proposal.proposedExercises as any,
        changes: proposal.changes as any,
        volumeDelta: proposal.volumeDelta,
        intensityDelta: proposal.intensityDelta,
      },
    });

    await app.prisma.notification.create({
      data: {
        userId,
        type: 'ai_insight',
        severity: proposal.severity,
        title: `Adattamento proposto per ${athlete.firstName} ${athlete.lastName}`,
        message: proposal.reason,
        data: { adaptationId: adaptation.id, athleteId: athleteId!, sessionId: targetSession.id } as any,
      },
    });

    return reply.status(201).send({
      success: true,
      data: {
        adaptationId: adaptation.id,
        mode: 'individual',
        metrics,
        proposal,
        originalPlan,
        targetSession: { id: targetSession.id, title: targetSession.title, date: targetSession.date },
      },
    });
  });

  // ─── GET /ai/adaptations — List adaptations ─────────────
  app.get('/ai/adaptations', async (request, reply) => {
    const query = listAdaptationsSchema.parse(request.query);
    const { organizationId } = request.user;

    const where: Record<string, unknown> = { organizationId };
    if (query.status) where.status = query.status;
    if (query.athleteId) where.athleteId = query.athleteId;

    const [adaptations, total] = await Promise.all([
      app.prisma.planAdaptation.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          athlete: { select: { id: true, firstName: true, lastName: true } },
          proposedBy: { select: { id: true, firstName: true, lastName: true } },
          reviewedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      app.prisma.planAdaptation.count({ where }),
    ]);

    // Enrich with target session info
    const sessionIds = adaptations
      .map((a) => a.trainingSessionId)
      .filter((id): id is string => !!id);
    const sessionsMap = new Map<string, { id: string; title: string; date: Date | null }>();
    if (sessionIds.length > 0) {
      const sessions = await app.prisma.trainingSession.findMany({
        where: { id: { in: sessionIds } },
        select: { id: true, title: true, date: true },
      });
      for (const s of sessions) sessionsMap.set(s.id, s);
    }

    // Enrich team names for team-mode adaptations
    const teamIdsNeeded = adaptations
      .map((a) => (a.metrics as Record<string, unknown> | null)?.teamId as string | undefined)
      .filter((id): id is string => !!id);
    const teamsMap = new Map<string, string>();
    if (teamIdsNeeded.length > 0) {
      const foundTeams = await app.prisma.team.findMany({
        where: { id: { in: [...new Set(teamIdsNeeded)] } },
        select: { id: true, name: true },
      });
      for (const t of foundTeams) teamsMap.set(t.id, t.name);
    }

    const enriched = adaptations.map((a) => {
      const m = a.metrics as Record<string, unknown> | null;
      const mode = (m?.mode as string) || 'individual';
      const teamId = m?.teamId as string | undefined;
      return {
        ...a,
        mode,
        teamName: teamId ? teamsMap.get(teamId) || null : null,
        targetSession: a.trainingSessionId ? sessionsMap.get(a.trainingSessionId) || null : null,
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
        athlete: { select: { id: true, firstName: true, lastName: true } },
        proposedBy: { select: { id: true, firstName: true, lastName: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
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

    const adaptation = await app.prisma.planAdaptation.findFirst({
      where: { id, organizationId },
    });
    if (!adaptation) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Adattamento non trovato' } });
    }

    if (adaptation.status !== 'PENDING') {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_STATE', message: 'Adattamento già revisionato' },
      });
    }

    // Apply changes if approving
    let appliedAt: Date | null = null;
    if (status === 'APPROVED' || status === 'MODIFIED') {
      if (!adaptation.trainingSessionId) {
        return reply.status(400).send({
          success: false,
          error: { code: 'MISSING_SESSION', message: 'Adattamento non collegato a nessuna sessione' },
        });
      }

      const planToApply = (status === 'MODIFIED' && modifiedPlan) ? modifiedPlan : adaptation.proposedPlan;
      const exercises = planToApply as Array<{
        sessionExerciseId: string;
        proposedSets?: number | null;
        proposedReps?: string | null;
        proposedWeight?: number | null;
        proposedRestTime?: number | null;
      }>;

      if (!exercises || exercises.length === 0) {
        return reply.status(400).send({
          success: false,
          error: { code: 'EMPTY_PLAN', message: 'Piano proposto vuoto' },
        });
      }

      // Verify exercises still exist
      const existingIds = await app.prisma.sessionExercise.findMany({
        where: { id: { in: exercises.map((ex) => ex.sessionExerciseId) } },
        select: { id: true },
      });
      const existingSet = new Set(existingIds.map((e) => e.id));
      const missing = exercises.filter((ex) => !existingSet.has(ex.sessionExerciseId));
      if (missing.length > 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'EXERCISE_NOT_FOUND',
            message: `${missing.length} esercizi non trovati — la sessione potrebbe essere stata modificata`,
          },
        });
      }

      // Apply exercises in transaction
      await app.prisma.$transaction(
        exercises.map((ex) =>
          app.prisma.sessionExercise.update({
            where: { id: ex.sessionExerciseId },
            data: {
              sets: ex.proposedSets ?? undefined,
              reps: ex.proposedReps ?? undefined,
              weight: ex.proposedWeight ?? undefined,
              restTime: ex.proposedRestTime ?? undefined,
            },
          }),
        ),
      );

      // Flag session as AI-modified (safe if column not yet migrated)
      try {
        await app.prisma.trainingSession.update({
          where: { id: adaptation.trainingSessionId },
          data: { aiModified: true },
        });
      } catch { /* aiModified column may not exist yet */ }

      appliedAt = new Date();
    }

    const updated = await app.prisma.planAdaptation.update({
      where: { id },
      data: {
        status,
        reviewNotes,
        reviewedAt: new Date(),
        reviewedById: userId,
        appliedAt,
      },
    });

    return reply.send({ success: true, data: updated });
  });
}
