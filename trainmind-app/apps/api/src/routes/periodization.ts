/**
 * Sprint 4.3 — Periodization Simulation
 *
 * Endpoints (all under /api/v1):
 *   GET    /periodization/plans               list plans for current org
 *   POST   /periodization/plans               create plan (with mesocycles + microcycles)
 *   GET    /periodization/plans/:id           fetch plan (deep: meso → micro)
 *   PATCH  /periodization/plans/:id           update plan metadata
 *   DELETE /periodization/plans/:id           delete plan cascade
 *   PUT    /periodization/plans/:id/mesocycles  bulk replace mesocycles + microcycles
 *   POST   /periodization/plans/:id/simulate   run simulation → load/fatigue curves
 *   GET    /periodization/templates            list built-in templates
 *   POST   /periodization/plans/from-template  create plan from template
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requireMinRole } from '../middleware/rbac.js';

// ─── Validation schemas ───────────────────────────────────

const periodizationTypes = ['LINEAR', 'UNDULATING', 'BLOCK', 'REVERSE_LINEAR', 'CONJUGATE'] as const;
const mesocyclePhases = ['PREPARATION', 'SPECIFIC', 'COMPETITION', 'TRANSITION', 'TAPER', 'RECOVERY'] as const;
const intensityLevels = ['VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH'] as const;

const microcycleSchema = z.object({
  weekNumber: z.number().int().min(1).max(12),
  loadPercent: z.number().min(0).max(150),
  intensity: z.enum(intensityLevels).default('MODERATE'),
  volume: z.number().min(0).optional(),
  sessionsCount: z.number().int().min(1).max(14).default(5),
  focusAreas: z.array(z.string()).default([]),
  isDeload: z.boolean().default(false),
  notes: z.string().optional(),
});

const mesocycleSchema = z.object({
  orderIndex: z.number().int().min(0),
  name: z.string().min(1).max(120),
  phase: z.enum(mesocyclePhases),
  durationWeeks: z.number().int().min(1).max(12),
  targetLoadPercent: z.number().min(0).max(100),
  intensityDistribution: z.record(z.number()).optional(),
  notes: z.string().optional(),
  color: z.string().optional(),
  microcycles: z.array(microcycleSchema).default([]),
});

const createPlanSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.enum(periodizationTypes).default('BLOCK'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalWeeks: z.number().int().min(1).max(52),
  isTemplate: z.boolean().default(false),
  templateCategory: z.string().optional(),
  teamId: z.string().optional(),
  mesocycles: z.array(mesocycleSchema).default([]),
});

const updatePlanSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  type: z.enum(periodizationTypes).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  totalWeeks: z.number().int().min(1).max(52).optional(),
});

const simulateSchema = z.object({
  name: z.string().default('Simulazione'),
  athleteBaseline: z.object({
    currentACWR: z.number().min(0).max(3).default(1.0),
    weeklyLoadAvg: z.number().min(0).default(600), // AU (arbitrary units)
    chronicLoad: z.number().min(0).default(500),
    injuryHistory: z.boolean().default(false),
  }).default({}),
  parameters: z.object({
    acuteWindow: z.number().int().min(3).max(14).default(7),
    chronicWindow: z.number().int().min(14).max(42).default(28),
    decayFactor: z.number().min(0).max(1).default(0.1),
  }).default({}),
});

// ─── Simulation Engine ────────────────────────────────────

interface WeeklyPoint {
  week: number;
  label: string;
  mesocycleName: string;
  phase: string;
  plannedLoad: number;
  acuteLoad: number;
  chronicLoad: number;
  acwr: number;
  fatigue: number;
  fitness: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
}

function runSimulation(
  mesocycles: Array<{
    name: string;
    phase: string;
    targetLoadPercent: number;
    microcycles: Array<{ weekNumber: number; loadPercent: number; isDeload: boolean }>;
  }>,
  params: {
    currentACWR: number;
    weeklyLoadAvg: number;
    chronicLoad: number;
    acuteWindow: number;
    chronicWindow: number;
    decayFactor: number;
  },
): { curve: WeeklyPoint[]; summary: { peakLoad: number; peakACWR: number; riskWindows: number; avgFitness: number } } {
  const curve: WeeklyPoint[] = [];

  // Flatten all weeks in order
  const allWeeks: Array<{
    mesocycleName: string;
    phase: string;
    targetLoadPercent: number;
    microLoadPercent: number;
    isDeload: boolean;
  }> = [];

  for (const meso of mesocycles) {
    const sortedMicros = [...meso.microcycles].sort((a, b) => a.weekNumber - b.weekNumber);
    for (const micro of sortedMicros) {
      allWeeks.push({
        mesocycleName: meso.name,
        phase: meso.phase,
        targetLoadPercent: meso.targetLoadPercent,
        microLoadPercent: micro.loadPercent,
        isDeload: micro.isDeload,
      });
    }
    // If mesocycle has fewer microcycles than durationWeeks, fill with defaults
  }

  if (allWeeks.length === 0) {
    return { curve: [], summary: { peakLoad: 0, peakACWR: 0, riskWindows: 0, avgFitness: 0 } };
  }

  // Banister impulse-response model (simplified)
  const baseLoad = params.weeklyLoadAvg;
  let acuteHistory: number[] = [];
  let chronicHistory: number[] = [];
  let fitness = params.chronicLoad;
  let fatigue = params.chronicLoad * params.currentACWR;

  // Pre-fill chronic history with baseline
  for (let i = 0; i < params.chronicWindow; i++) {
    chronicHistory.push(baseLoad);
  }
  for (let i = 0; i < params.acuteWindow; i++) {
    acuteHistory.push(baseLoad * params.currentACWR);
  }

  let peakLoad = 0;
  let peakACWR = 0;
  let riskWindows = 0;
  let totalFitness = 0;

  for (let i = 0; i < allWeeks.length; i++) {
    const w = allWeeks[i];
    const plannedLoad = (baseLoad * w.targetLoadPercent / 100) * (w.microLoadPercent / 100);

    acuteHistory.push(plannedLoad);
    chronicHistory.push(plannedLoad);
    if (acuteHistory.length > params.acuteWindow) acuteHistory = acuteHistory.slice(-params.acuteWindow);
    if (chronicHistory.length > params.chronicWindow) chronicHistory = chronicHistory.slice(-params.chronicWindow);

    const acuteLoad = acuteHistory.reduce((s, v) => s + v, 0) / acuteHistory.length;
    const chronicLoad = chronicHistory.reduce((s, v) => s + v, 0) / chronicHistory.length;
    const acwr = chronicLoad > 0 ? acuteLoad / chronicLoad : 1.0;

    // Fitness/fatigue (Banister)
    fitness = fitness + plannedLoad * 0.1 - fitness * params.decayFactor;
    fatigue = fatigue + plannedLoad * 0.07 - fatigue * (params.decayFactor * 1.5);

    const riskLevel: WeeklyPoint['riskLevel'] =
      acwr > 1.5 ? 'very_high' : acwr > 1.3 ? 'high' : acwr > 1.1 ? 'moderate' : 'low';

    if (riskLevel === 'high' || riskLevel === 'very_high') riskWindows++;
    if (plannedLoad > peakLoad) peakLoad = plannedLoad;
    if (acwr > peakACWR) peakACWR = acwr;
    totalFitness += fitness;

    curve.push({
      week: i + 1,
      label: `S${i + 1}`,
      mesocycleName: w.mesocycleName,
      phase: w.phase,
      plannedLoad: Math.round(plannedLoad),
      acuteLoad: Math.round(acuteLoad),
      chronicLoad: Math.round(chronicLoad),
      acwr: Math.round(acwr * 100) / 100,
      fatigue: Math.round(fatigue),
      fitness: Math.round(fitness),
      riskLevel,
    });
  }

  return {
    curve,
    summary: {
      peakLoad: Math.round(peakLoad),
      peakACWR: Math.round(peakACWR * 100) / 100,
      riskWindows,
      avgFitness: Math.round(totalFitness / allWeeks.length),
    },
  };
}

// ─── Built-in Templates ───────────────────────────────────

const BASKETBALL_TEMPLATES = [
  {
    id: 'bball-preseason-8w',
    name: 'Pre-Season Basketball (8 settimane)',
    description: 'Preparazione pre-campionato: base aerobica → forza → potenza → taper',
    type: 'BLOCK' as const,
    totalWeeks: 8,
    templateCategory: 'pre-season',
    mesocycles: [
      {
        orderIndex: 0,
        name: 'Base aerobica',
        phase: 'PREPARATION' as const,
        durationWeeks: 2,
        targetLoadPercent: 60,
        color: '#14b8a6',
        microcycles: [
          { weekNumber: 1, loadPercent: 80, intensity: 'LOW' as const, sessionsCount: 5, focusAreas: ['conditioning', 'mobility'], isDeload: false },
          { weekNumber: 2, loadPercent: 100, intensity: 'LOW' as const, sessionsCount: 5, focusAreas: ['conditioning', 'court-work'], isDeload: false },
        ],
      },
      {
        orderIndex: 1,
        name: 'Forza massimale',
        phase: 'SPECIFIC' as const,
        durationWeeks: 3,
        targetLoadPercent: 85,
        color: '#f59e0b',
        microcycles: [
          { weekNumber: 1, loadPercent: 85, intensity: 'HIGH' as const, sessionsCount: 5, focusAreas: ['strength', 'shooting'], isDeload: false },
          { weekNumber: 2, loadPercent: 100, intensity: 'HIGH' as const, sessionsCount: 6, focusAreas: ['strength', 'agility'], isDeload: false },
          { weekNumber: 3, loadPercent: 60, intensity: 'LOW' as const, sessionsCount: 4, focusAreas: ['recovery', 'technique'], isDeload: true },
        ],
      },
      {
        orderIndex: 2,
        name: 'Potenza esplosiva',
        phase: 'SPECIFIC' as const,
        durationWeeks: 2,
        targetLoadPercent: 90,
        color: '#ef4444',
        microcycles: [
          { weekNumber: 1, loadPercent: 90, intensity: 'VERY_HIGH' as const, sessionsCount: 5, focusAreas: ['power', 'plyometrics', 'scrimmage'], isDeload: false },
          { weekNumber: 2, loadPercent: 100, intensity: 'VERY_HIGH' as const, sessionsCount: 5, focusAreas: ['power', 'game-situations'], isDeload: false },
        ],
      },
      {
        orderIndex: 3,
        name: 'Taper pre-campionato',
        phase: 'TAPER' as const,
        durationWeeks: 1,
        targetLoadPercent: 50,
        color: '#8b5cf6',
        microcycles: [
          { weekNumber: 1, loadPercent: 100, intensity: 'MODERATE' as const, sessionsCount: 4, focusAreas: ['activation', 'tactics', 'rest'], isDeload: true },
        ],
      },
    ],
  },
  {
    id: 'bball-inseason-12w',
    name: 'In-Season Basketball (12 settimane)',
    description: 'Mantenimento durante campionato: 3 blocchi da 4 settimane con scarico',
    type: 'UNDULATING' as const,
    totalWeeks: 12,
    templateCategory: 'in-season',
    mesocycles: [
      {
        orderIndex: 0,
        name: 'Blocco 1 — Mantenimento forza',
        phase: 'COMPETITION' as const,
        durationWeeks: 4,
        targetLoadPercent: 70,
        color: '#14b8a6',
        microcycles: [
          { weekNumber: 1, loadPercent: 85, intensity: 'MODERATE' as const, sessionsCount: 4, focusAreas: ['strength-maintenance', 'shooting'], isDeload: false },
          { weekNumber: 2, loadPercent: 100, intensity: 'HIGH' as const, sessionsCount: 4, focusAreas: ['strength', 'agility'], isDeload: false },
          { weekNumber: 3, loadPercent: 90, intensity: 'MODERATE' as const, sessionsCount: 4, focusAreas: ['conditioning', 'tactics'], isDeload: false },
          { weekNumber: 4, loadPercent: 60, intensity: 'LOW' as const, sessionsCount: 3, focusAreas: ['recovery', 'mobility'], isDeload: true },
        ],
      },
      {
        orderIndex: 1,
        name: 'Blocco 2 — Potenza reattiva',
        phase: 'COMPETITION' as const,
        durationWeeks: 4,
        targetLoadPercent: 75,
        color: '#f59e0b',
        microcycles: [
          { weekNumber: 1, loadPercent: 80, intensity: 'MODERATE' as const, sessionsCount: 4, focusAreas: ['power', 'court-speed'], isDeload: false },
          { weekNumber: 2, loadPercent: 100, intensity: 'HIGH' as const, sessionsCount: 4, focusAreas: ['plyometrics', 'game-prep'], isDeload: false },
          { weekNumber: 3, loadPercent: 95, intensity: 'HIGH' as const, sessionsCount: 4, focusAreas: ['scrimmage', 'conditioning'], isDeload: false },
          { weekNumber: 4, loadPercent: 55, intensity: 'LOW' as const, sessionsCount: 3, focusAreas: ['recovery', 'technique'], isDeload: true },
        ],
      },
      {
        orderIndex: 2,
        name: 'Blocco 3 — Picco prestazione',
        phase: 'COMPETITION' as const,
        durationWeeks: 4,
        targetLoadPercent: 80,
        color: '#ef4444',
        microcycles: [
          { weekNumber: 1, loadPercent: 85, intensity: 'HIGH' as const, sessionsCount: 4, focusAreas: ['speed', 'game-situations'], isDeload: false },
          { weekNumber: 2, loadPercent: 100, intensity: 'VERY_HIGH' as const, sessionsCount: 4, focusAreas: ['competition-prep', 'max-effort'], isDeload: false },
          { weekNumber: 3, loadPercent: 70, intensity: 'MODERATE' as const, sessionsCount: 3, focusAreas: ['activation', 'tactics'], isDeload: false },
          { weekNumber: 4, loadPercent: 50, intensity: 'LOW' as const, sessionsCount: 3, focusAreas: ['recovery', 'rest'], isDeload: true },
        ],
      },
    ],
  },
  {
    id: 'bball-offseason-6w',
    name: 'Off-Season Recovery (6 settimane)',
    description: 'Transizione post-campionato: recupero attivo → base ricostruzione',
    type: 'LINEAR' as const,
    totalWeeks: 6,
    templateCategory: 'off-season',
    mesocycles: [
      {
        orderIndex: 0,
        name: 'Recupero attivo',
        phase: 'TRANSITION' as const,
        durationWeeks: 2,
        targetLoadPercent: 30,
        color: '#8b5cf6',
        microcycles: [
          { weekNumber: 1, loadPercent: 70, intensity: 'VERY_LOW' as const, sessionsCount: 3, focusAreas: ['mobility', 'yoga', 'swimming'], isDeload: true },
          { weekNumber: 2, loadPercent: 100, intensity: 'LOW' as const, sessionsCount: 3, focusAreas: ['mobility', 'light-cardio', 'rehab'], isDeload: false },
        ],
      },
      {
        orderIndex: 1,
        name: 'Ricostruzione base',
        phase: 'RECOVERY' as const,
        durationWeeks: 2,
        targetLoadPercent: 50,
        color: '#14b8a6',
        microcycles: [
          { weekNumber: 1, loadPercent: 80, intensity: 'LOW' as const, sessionsCount: 4, focusAreas: ['general-fitness', 'core'], isDeload: false },
          { weekNumber: 2, loadPercent: 100, intensity: 'MODERATE' as const, sessionsCount: 4, focusAreas: ['strength-endurance', 'agility'], isDeload: false },
        ],
      },
      {
        orderIndex: 2,
        name: 'Progressione graduale',
        phase: 'PREPARATION' as const,
        durationWeeks: 2,
        targetLoadPercent: 65,
        color: '#f59e0b',
        microcycles: [
          { weekNumber: 1, loadPercent: 85, intensity: 'MODERATE' as const, sessionsCount: 5, focusAreas: ['strength', 'conditioning'], isDeload: false },
          { weekNumber: 2, loadPercent: 100, intensity: 'MODERATE' as const, sessionsCount: 5, focusAreas: ['sport-specific', 'shooting'], isDeload: false },
        ],
      },
    ],
  },
];

// ─── Routes ───────────────────────────────────────────────

export async function periodizationRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate, requireMinRole('TRAINER')] };

  // ─── GET /periodization/templates ─────────────────────
  app.get('/periodization/templates', auth, async (_request: FastifyRequest, reply: FastifyReply) => {
    const templates = BASKETBALL_TEMPLATES.map(({ id, name, description, type, totalWeeks, templateCategory, mesocycles }) => ({
      id,
      name,
      description,
      type,
      totalWeeks,
      templateCategory,
      mesocycleCount: mesocycles.length,
      phases: mesocycles.map((m) => m.phase),
    }));
    return reply.send({ success: true, data: { templates } });
  });

  // ─── POST /periodization/plans/from-template ──────────
  app.post('/periodization/plans/from-template', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { templateId?: string; startDate?: string };
    if (!body.templateId || !body.startDate) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'templateId and startDate required' } });
    }

    const template = BASKETBALL_TEMPLATES.find((t) => t.id === body.templateId);
    if (!template) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Template non trovato' } });
    }

    const { organizationId, userId } = request.user;
    const start = new Date(body.startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + template.totalWeeks * 7);

    const plan = await app.prisma.periodizationPlan.create({
      data: {
        organizationId,
        createdById: userId,
        name: template.name,
        description: template.description,
        type: template.type,
        startDate: start,
        endDate: end,
        totalWeeks: template.totalWeeks,
        isTemplate: false,
        templateCategory: template.templateCategory,
        mesocycles: {
          create: template.mesocycles.map((m) => ({
            orderIndex: m.orderIndex,
            name: m.name,
            phase: m.phase,
            durationWeeks: m.durationWeeks,
            targetLoadPercent: m.targetLoadPercent,
            color: m.color,
            microcycles: {
              create: m.microcycles.map((mc) => ({
                weekNumber: mc.weekNumber,
                loadPercent: mc.loadPercent,
                intensity: mc.intensity,
                sessionsCount: mc.sessionsCount,
                focusAreas: mc.focusAreas,
                isDeload: mc.isDeload,
              })),
            },
          })),
        },
      },
      include: {
        mesocycles: { include: { microcycles: true }, orderBy: { orderIndex: 'asc' } },
      },
    });

    return reply.status(201).send({ success: true, data: { plan } });
  });

  // ─── GET /periodization/plans ─────────────────────────
  app.get('/periodization/plans', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const { organizationId } = request.user;
    const { teamId } = (request.query as Record<string, string | undefined>);

    const where: Record<string, unknown> = { organizationId, isTemplate: false };
    if (teamId) where.teamId = teamId;

    const plans = await app.prisma.periodizationPlan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        team: { select: { id: true, name: true, color: true } },
        _count: { select: { mesocycles: true, simulations: true } },
      },
    });

    return reply.send({ success: true, data: { plans } });
  });

  // ─── POST /periodization/plans ────────────────────────
  app.post('/periodization/plans', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createPlanSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati piano non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const { organizationId, userId } = request.user;
    const { mesocycles: mesocyclesData, teamId, ...planData } = parsed.data;

    const plan = await app.prisma.periodizationPlan.create({
      data: {
        organizationId,
        createdById: userId,
        ...planData,
        teamId: teamId || null,
        startDate: new Date(planData.startDate),
        endDate: new Date(planData.endDate),
        mesocycles: {
          create: mesocyclesData.map((m) => ({
            orderIndex: m.orderIndex,
            name: m.name,
            phase: m.phase,
            durationWeeks: m.durationWeeks,
            targetLoadPercent: m.targetLoadPercent,
            intensityDistribution: m.intensityDistribution ?? undefined,
            notes: m.notes,
            color: m.color,
            microcycles: {
              create: m.microcycles.map((mc) => ({
                weekNumber: mc.weekNumber,
                loadPercent: mc.loadPercent,
                intensity: mc.intensity,
                volume: mc.volume,
                sessionsCount: mc.sessionsCount,
                focusAreas: mc.focusAreas,
                isDeload: mc.isDeload,
                notes: mc.notes,
              })),
            },
          })),
        },
      },
      include: {
        mesocycles: { include: { microcycles: true }, orderBy: { orderIndex: 'asc' } },
      },
    });

    return reply.status(201).send({ success: true, data: { plan } });
  });

  // ─── GET /periodization/plans/:id ─────────────────────
  app.get<{ Params: { id: string } }>(
    '/periodization/plans/:id',
    auth,
    async (request, reply) => {
      const { organizationId } = request.user;
      const { id } = request.params;

      const plan = await app.prisma.periodizationPlan.findFirst({
        where: { id, organizationId },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          mesocycles: {
            include: {
              microcycles: {
                orderBy: { weekNumber: 'asc' },
                include: {
                  weeks: {
                    include: {
                      trainingSessions: { select: { id: true, title: true, date: true, status: true }, orderBy: { date: 'asc' } },
                      trainingPlan: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
            orderBy: { orderIndex: 'asc' },
          },
          simulations: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      });

      if (!plan) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Piano non trovato' } });
      }

      return reply.send({ success: true, data: { plan } });
    },
  );

  // ─── PATCH /periodization/plans/:id ───────────────────
  app.patch<{ Params: { id: string } }>(
    '/periodization/plans/:id',
    auth,
    async (request, reply) => {
      const parsed = updatePlanSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Dati aggiornamento non validi', details: parsed.error.flatten().fieldErrors },
        });
      }

      const { organizationId } = request.user;
      const { id } = request.params;

      const existing = await app.prisma.periodizationPlan.findFirst({ where: { id, organizationId } });
      if (!existing) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Piano non trovato' } });
      }

      const data = { ...parsed.data } as Record<string, unknown>;
      if (data.startDate) data.startDate = new Date(data.startDate as string);
      if (data.endDate) data.endDate = new Date(data.endDate as string);

      const updated = await app.prisma.periodizationPlan.update({
        where: { id },
        data,
      });

      return reply.send({ success: true, data: { plan: updated } });
    },
  );

  // ─── DELETE /periodization/plans/:id ──────────────────
  app.delete<{ Params: { id: string } }>(
    '/periodization/plans/:id',
    auth,
    async (request, reply) => {
      const { organizationId } = request.user;
      const { id } = request.params;

      const existing = await app.prisma.periodizationPlan.findFirst({ where: { id, organizationId } });
      if (!existing) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Piano non trovato' } });
      }

      await app.prisma.periodizationPlan.delete({ where: { id } });
      return reply.send({ success: true, data: { id } });
    },
  );

  // ─── PATCH /periodization/plans/:id/mesocycles/reorder ─
  // Lightweight reorder: receives array of { id, orderIndex }
  app.patch<{ Params: { id: string } }>(
    '/periodization/plans/:id/mesocycles/reorder',
    auth,
    async (request, reply) => {
      const schema = z.array(z.object({ id: z.string(), orderIndex: z.number().int().min(0) }));
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Array di { id, orderIndex } non valido' },
        });
      }

      const { organizationId } = request.user;
      const { id } = request.params;

      const existing = await app.prisma.periodizationPlan.findFirst({ where: { id, organizationId } });
      if (!existing) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Piano non trovato' } });
      }

      await app.prisma.$transaction(
        parsed.data.map((item) =>
          app.prisma.mesocycle.update({
            where: { id: item.id },
            data: { orderIndex: item.orderIndex },
          }),
        ),
      );

      const plan = await app.prisma.periodizationPlan.findUnique({
        where: { id },
        include: {
          mesocycles: {
            include: {
              microcycles: {
                orderBy: { weekNumber: 'asc' },
                include: {
                  weeks: {
                    include: {
                      trainingSessions: { select: { id: true, title: true, date: true, status: true }, orderBy: { date: 'asc' } },
                      trainingPlan: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
            orderBy: { orderIndex: 'asc' },
          },
        },
      });

      return reply.send({ success: true, data: { plan } });
    },
  );

  // ─── PUT /periodization/plans/:id/mesocycles ──────────
  // Bulk replace: delete all existing mesocycles + microcycles, recreate
  app.put<{ Params: { id: string } }>(
    '/periodization/plans/:id/mesocycles',
    auth,
    async (request, reply) => {
      const parsed = z.array(mesocycleSchema).safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Dati mesocicli non validi', details: parsed.error.flatten().fieldErrors },
        });
      }

      const { organizationId } = request.user;
      const { id } = request.params;

      const existing = await app.prisma.periodizationPlan.findFirst({ where: { id, organizationId } });
      if (!existing) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Piano non trovato' } });
      }

      // Transaction: delete old → create new
      await app.prisma.$transaction([
        app.prisma.mesocycle.deleteMany({ where: { periodizationPlanId: id } }),
        ...parsed.data.map((m) =>
          app.prisma.mesocycle.create({
            data: {
              periodizationPlanId: id,
              orderIndex: m.orderIndex,
              name: m.name,
              phase: m.phase,
              durationWeeks: m.durationWeeks,
              targetLoadPercent: m.targetLoadPercent,
              intensityDistribution: m.intensityDistribution ?? undefined,
              notes: m.notes,
              color: m.color,
              microcycles: {
                create: m.microcycles.map((mc) => ({
                  weekNumber: mc.weekNumber,
                  loadPercent: mc.loadPercent,
                  intensity: mc.intensity,
                  volume: mc.volume,
                  sessionsCount: mc.sessionsCount,
                  focusAreas: mc.focusAreas,
                  isDeload: mc.isDeload,
                  notes: mc.notes,
                })),
              },
            },
          }),
        ),
      ]);

      // Fetch updated plan (include weeks + sessions for frontend display)
      const plan = await app.prisma.periodizationPlan.findUnique({
        where: { id },
        include: {
          mesocycles: {
            include: {
              microcycles: {
                orderBy: { weekNumber: 'asc' },
                include: {
                  weeks: {
                    include: {
                      trainingSessions: { select: { id: true, title: true, date: true, status: true }, orderBy: { date: 'asc' } },
                      trainingPlan: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
            orderBy: { orderIndex: 'asc' },
          },
        },
      });

      return reply.send({ success: true, data: { plan } });
    },
  );

  // ─── POST /periodization/plans/:id/simulate ───────────
  app.post<{ Params: { id: string } }>(
    '/periodization/plans/:id/simulate',
    auth,
    async (request, reply) => {
      const parsed = simulateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Parametri simulazione non validi', details: parsed.error.flatten().fieldErrors },
        });
      }

      const { organizationId } = request.user;
      const { id } = request.params;

      const plan = await app.prisma.periodizationPlan.findFirst({
        where: { id, organizationId },
        include: {
          mesocycles: { include: { microcycles: { orderBy: { weekNumber: 'asc' } } }, orderBy: { orderIndex: 'asc' } },
        },
      });

      if (!plan) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Piano non trovato' } });
      }

      const { name, athleteBaseline, parameters } = parsed.data;

      const simResult = runSimulation(
        plan.mesocycles.map((m) => ({
          name: m.name,
          phase: m.phase,
          targetLoadPercent: m.targetLoadPercent,
          microcycles: m.microcycles.map((mc) => ({
            weekNumber: mc.weekNumber,
            loadPercent: mc.loadPercent,
            isDeload: mc.isDeload,
          })),
        })),
        {
          ...athleteBaseline,
          ...parameters,
        },
      );

      // Persist simulation
      const simulation = await app.prisma.simulation.create({
        data: {
          periodizationPlanId: id,
          name,
          parameters: { athleteBaseline, parameters },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          results: JSON.parse(JSON.stringify(simResult)) as any,
        },
      });

      return reply.send({ success: true, data: { simulation, ...simResult } });
    },
  );

  // ─── POST /periodization/plans/:id/generate-training ──
  // Generate a TrainingPlan from a PeriodizationPlan, mapping weeks to microcycles
  app.post<{ Params: { id: string } }>(
    '/periodization/plans/:id/generate-training',
    auth,
    async (request, reply) => {
      const bodySchema = z.object({
        athleteId: z.string().optional(),
        planName: z.string().min(1).max(200).optional(),
      });
      const parsed = bodySchema.safeParse(request.body || {});
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Dati non validi' },
        });
      }

      const { organizationId, userId } = request.user;
      const { id } = request.params;
      const { athleteId, planName } = parsed.data;

      // Fetch periodization plan with all mesocycles and microcycles
      const periPlan = await app.prisma.periodizationPlan.findFirst({
        where: { id, organizationId },
        include: {
          mesocycles: {
            include: { microcycles: { orderBy: { weekNumber: 'asc' } } },
            orderBy: { orderIndex: 'asc' },
          },
        },
      });

      if (!periPlan) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Piano di periodizzazione non trovato' },
        });
      }

      if (periPlan.mesocycles.length === 0) {
        return reply.status(400).send({
          success: false,
          error: { code: 'EMPTY_PLAN', message: 'Il piano di periodizzazione non ha mesocicli. Aggiungine almeno uno.' },
        });
      }

      // Phase labels for session titles
      const phaseLabels: Record<string, string> = {
        PREPARATION: 'Preparazione',
        SPECIFIC: 'Specifica',
        COMPETITION: 'Competizione',
        TRANSITION: 'Transizione',
        TAPER: 'Scarico',
        RECOVERY: 'Recupero',
      };

      // Build all weeks in order, flattening mesocycles
      const allWeeks: Array<{
        mesocycleName: string;
        phase: string;
        microcycleId: string;
        weekLabel: string;
        loadPercent: number;
        intensity: string;
        sessionsCount: number;
        focusAreas: string[];
        isDeload: boolean;
      }> = [];

      let globalWeek = 0;
      for (const meso of periPlan.mesocycles) {
        for (const micro of meso.microcycles) {
          globalWeek++;
          allWeeks.push({
            mesocycleName: meso.name,
            phase: meso.phase,
            microcycleId: micro.id,
            weekLabel: `S${globalWeek} — ${meso.name} (${phaseLabels[meso.phase] || meso.phase})`,
            loadPercent: micro.loadPercent,
            intensity: micro.intensity,
            sessionsCount: micro.sessionsCount,
            focusAreas: micro.focusAreas,
            isDeload: micro.isDeload,
          });
        }
      }

      if (allWeeks.length === 0) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NO_MICROCYCLES', message: 'I mesocicli non hanno microcicli. Configura le settimane prima di generare.' },
        });
      }

      // Calculate end date
      const startDate = periPlan.startDate;
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + allWeeks.length * 7);

      // Determine session duration based on intensity
      const durationByIntensity: Record<string, number> = {
        VERY_LOW: 45,
        LOW: 60,
        MODERATE: 75,
        HIGH: 90,
        VERY_HIGH: 90,
      };

      // Create TrainingPlan with Weeks and Sessions in a single transaction
      const trainingPlan = await app.prisma.$transaction(async (tx) => {
        const plan = await tx.trainingPlan.create({
          data: {
            name: planName || `${periPlan.name} — Piano allenamento`,
            description: `Generato dalla periodizzazione "${periPlan.name}". ${allWeeks.length} settimane, ${periPlan.mesocycles.length} mesocicli.`,
            startDate,
            endDate,
            athleteId: athleteId || null,
            organizationId,
            createdById: userId,
            periodizationPlanId: periPlan.id,
          },
        });

        // Create weeks with linked microcycles, and sessions for each week
        for (let i = 0; i < allWeeks.length; i++) {
          const w = allWeeks[i];
          const weekStart = new Date(startDate);
          weekStart.setDate(weekStart.getDate() + i * 7);

          const week = await tx.week.create({
            data: {
              trainingPlanId: plan.id,
              weekNumber: i + 1,
              microcycleId: w.microcycleId,
              notes: `${w.mesocycleName} — ${phaseLabels[w.phase] || w.phase} | Carico: ${w.loadPercent}% | ${w.isDeload ? 'Settimana di scarico' : `Intensità: ${w.intensity}`}`,
            },
          });

          // Create sessions for this week
          const sessionDuration = durationByIntensity[w.intensity] || 75;
          const focusLabel = w.focusAreas.length > 0 ? w.focusAreas.join(', ') : phaseLabels[w.phase] || w.phase;

          for (let s = 0; s < w.sessionsCount; s++) {
            const sessionDate = new Date(weekStart);
            sessionDate.setDate(sessionDate.getDate() + s); // spread sessions across week days

            await tx.trainingSession.create({
              data: {
                title: `${w.mesocycleName} — Sessione ${s + 1} (${focusLabel})`,
                date: sessionDate,
                duration: sessionDuration,
                status: 'PLANNED',
                notes: w.isDeload
                  ? `Settimana di scarico. Focus: ${focusLabel}. Carico ridotto al ${w.loadPercent}%.`
                  : `Fase: ${phaseLabels[w.phase] || w.phase}. Intensità: ${w.intensity}. Carico: ${w.loadPercent}%. Focus: ${focusLabel}.`,
                weekId: week.id,
                athleteId: athleteId || null,
                organizationId,
              },
            });
          }
        }

        // Return plan with full structure
        return tx.trainingPlan.findUnique({
          where: { id: plan.id },
          include: {
            weeks: {
              include: {
                trainingSessions: { orderBy: { date: 'asc' } },
              },
              orderBy: { weekNumber: 'asc' },
            },
            periodizationPlan: { select: { id: true, name: true, type: true } },
          },
        });
      });

      return reply.status(201).send({ success: true, data: { trainingPlan } });
    },
  );

  // ─── POST /periodization/plans/:id/link-training ────��─
  // Link an existing TrainingPlan to a specific mesocycle, mapping weeks → microcycles
  app.post<{ Params: { id: string } }>(
    '/periodization/plans/:id/link-training',
    auth,
    async (request, reply) => {
      const bodySchema = z.object({
        trainingPlanId: z.string().min(1),
        mesocycleId: z.string().min(1).optional(), // if provided, link only to this mesocycle
      });
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'trainingPlanId richiesto' },
        });
      }

      const { organizationId } = request.user;
      const { id: periPlanId } = request.params;
      const { trainingPlanId, mesocycleId } = parsed.data;

      // Verify periodization plan exists
      const periPlan = await app.prisma.periodizationPlan.findFirst({
        where: { id: periPlanId, organizationId },
        include: {
          mesocycles: {
            include: { microcycles: { orderBy: { weekNumber: 'asc' } } },
            orderBy: { orderIndex: 'asc' },
          },
        },
      });
      if (!periPlan) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Piano di periodizzazione non trovato' } });
      }

      // Verify training plan exists and belongs to same org
      const trainingPlan = await app.prisma.trainingPlan.findFirst({
        where: { id: trainingPlanId, organizationId },
        include: { weeks: { orderBy: { weekNumber: 'asc' } } },
      });
      if (!trainingPlan) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Piano di allenamento non trovato' } });
      }

      // Get target microcycles — either specific mesocycle or all
      let targetMicrocycles: Array<{ id: string }> = [];
      if (mesocycleId) {
        const meso = periPlan.mesocycles.find((m) => m.id === mesocycleId);
        if (!meso) {
          return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Mesociclo non trovato' } });
        }
        targetMicrocycles = meso.microcycles.map((mc) => ({ id: mc.id }));
      } else {
        for (const meso of periPlan.mesocycles) {
          for (const micro of meso.microcycles) {
            targetMicrocycles.push({ id: micro.id });
          }
        }
      }

      // Link: map weeks to microcycles by position
      await app.prisma.$transaction(
        trainingPlan.weeks.map((week, i) =>
          app.prisma.week.update({
            where: { id: week.id },
            data: {
              microcycleId: i < targetMicrocycles.length ? targetMicrocycles[i].id : null,
            },
          }),
        ),
      );

      return reply.send({
        success: true,
        data: {
          linked: true,
          weeksLinked: Math.min(trainingPlan.weeks.length, targetMicrocycles.length),
          totalWeeks: trainingPlan.weeks.length,
          totalMicrocycles: targetMicrocycles.length,
        },
      });
    },
  );

  // ─── POST /periodization/plans/:id/unlink-training ────
  // Unlink weeks from a specific mesocycle's microcycles
  app.post<{ Params: { id: string } }>(
    '/periodization/plans/:id/unlink-training',
    auth,
    async (request, reply) => {
      const bodySchema = z.object({
        mesocycleId: z.string().min(1),
      });
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'mesocycleId richiesto' },
        });
      }

      const { organizationId } = request.user;
      const { id: periPlanId } = request.params;
      const { mesocycleId } = parsed.data;

      // Verify periodization plan + mesocycle
      const periPlan = await app.prisma.periodizationPlan.findFirst({
        where: { id: periPlanId, organizationId },
        include: {
          mesocycles: {
            where: { id: mesocycleId },
            include: { microcycles: { select: { id: true } } },
          },
        },
      });
      if (!periPlan || periPlan.mesocycles.length === 0) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Mesociclo non trovato' } });
      }

      const microcycleIds = periPlan.mesocycles[0].microcycles.map((mc) => mc.id);

      // Set microcycleId = null on all weeks linked to these microcycles
      const result = await app.prisma.week.updateMany({
        where: { microcycleId: { in: microcycleIds } },
        data: { microcycleId: null },
      });

      return reply.send({
        success: true,
        data: { unlinked: true, weeksUnlinked: result.count },
      });
    },
  );

  // ─── POST /periodization/microcycles/:microId/ensure-week ──
  // Ensures a microcycle has a linked week (creating training plan if needed).
  // Returns { weekId, created } so the frontend can use existing session endpoints.
  app.post<{ Params: { microId: string } }>(
    '/periodization/microcycles/:microId/ensure-week',
    auth,
    async (request, reply) => {
      const { organizationId, id: userId } = request.user;
      const { microId } = request.params;

      // Find microcycle with its mesocycle and periodization plan
      const microcycle = await app.prisma.microcycle.findFirst({
        where: { id: microId },
        include: {
          mesocycle: {
            include: {
              periodizationPlan: { select: { id: true, name: true, organizationId: true, startDate: true } },
              microcycles: { orderBy: { weekNumber: 'asc' }, select: { id: true, weekNumber: true } },
            },
          },
          weeks: { select: { id: true }, take: 1 },
        },
      });

      if (!microcycle || microcycle.mesocycle.periodizationPlan.organizationId !== organizationId) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Microciclo non trovato' } });
      }

      // Already has a linked week
      if (microcycle.weeks.length > 0) {
        return reply.send({ success: true, data: { weekId: microcycle.weeks[0].id, created: false } });
      }

      const meso = microcycle.mesocycle;
      const periPlan = meso.periodizationPlan;

      // Check if any sibling microcycle has a linked week (i.e. a training plan already exists)
      const siblingWithWeek = await app.prisma.week.findFirst({
        where: { microcycleId: { in: meso.microcycles.map((mc) => mc.id) } },
        select: { trainingPlanId: true },
      });

      let trainingPlanId: string;

      if (siblingWithWeek) {
        trainingPlanId = siblingWithWeek.trainingPlanId;
      } else {
        // Create a new training plan for this mesocycle
        const startDate = new Date(periPlan.startDate);
        // Offset by weeks from previous mesocycles (approximate)
        const allMesos = await app.prisma.mesocycle.findMany({
          where: { periodizationPlanId: periPlan.id, orderIndex: { lt: meso.orderIndex } },
          select: { durationWeeks: true },
        });
        const weekOffset = allMesos.reduce((sum, m) => sum + m.durationWeeks, 0);
        startDate.setDate(startDate.getDate() + weekOffset * 7);

        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + meso.durationWeeks * 7 - 1);

        const plan = await app.prisma.trainingPlan.create({
          data: {
            name: `${meso.name}`,
            description: `Piano generato per il mesociclo "${meso.name}"`,
            startDate,
            endDate,
            organizationId,
            createdById: userId,
            periodizationPlanId: periPlan.id,
          },
        });
        trainingPlanId = plan.id;
      }

      // Create weeks for all microcycles in this mesocycle that don't have one yet
      const results: Array<{ microId: string; weekId: string }> = [];
      for (const mc of meso.microcycles) {
        const existingWeek = await app.prisma.week.findFirst({
          where: { microcycleId: mc.id },
          select: { id: true },
        });
        if (existingWeek) {
          if (mc.id === microId) results.push({ microId: mc.id, weekId: existingWeek.id });
          continue;
        }
        const week = await app.prisma.week.create({
          data: {
            trainingPlanId,
            weekNumber: mc.weekNumber,
            microcycleId: mc.id,
          },
        });
        if (mc.id === microId) results.push({ microId: mc.id, weekId: week.id });
      }

      const targetWeekId = results.find((r) => r.microId === microId)?.weekId;
      if (!targetWeekId) {
        return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Errore creazione settimana' } });
      }

      return reply.send({ success: true, data: { weekId: targetWeekId, created: true } });
    },
  );

  // ─── GET /periodization/calendar-context ──────────────
  // Returns periodization + mesocycle context for each day in a date range.
  // Query params: from=YYYY-MM-DD&to=YYYY-MM-DD
  app.get('/periodization/calendar-context', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const { from, to, teamId } = request.query as { from?: string; to?: string; teamId?: string };
    if (!from || !to) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'from and to query params required (YYYY-MM-DD)' } });
    }

    const { organizationId } = request.user;
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const planWhere: Record<string, unknown> = {
      organizationId,
      isTemplate: false,
      startDate: { lte: toDate },
      endDate: { gte: fromDate },
    };
    if (teamId) planWhere.teamId = teamId;

    // Find all non-template periodization plans that overlap with [from, to]
    const plans = await app.prisma.periodizationPlan.findMany({
      where: planWhere,
      include: {
        team: { select: { id: true, name: true, color: true } },
        mesocycles: {
          orderBy: { orderIndex: 'asc' },
          include: {
            microcycles: {
              orderBy: { weekNumber: 'asc' },
            },
          },
        },
      },
    });

    // Build a map of date ranges → mesocycle/microcycle context
    // For each plan, calculate the absolute date range of each mesocycle and microcycle
    interface WeekContext {
      weekStart: string; // YYYY-MM-DD (Monday)
      weekEnd: string;   // YYYY-MM-DD (Sunday)
      planId: string;
      planName: string;
      mesocycleId: string;
      mesocycleName: string;
      mesocyclePhase: string;
      mesocycleColor: string | null;
      microcycleWeekNumber: number;
      loadPercent: number;
      intensity: string;
      isDeload: boolean;
      teamId: string | null;
      teamName: string | null;
      teamColor: string | null;
    }

    const weekContexts: WeekContext[] = [];

    for (const plan of plans) {
      const planStart = new Date(plan.startDate);
      let weekOffset = 0;

      for (const meso of plan.mesocycles) {
        for (const micro of meso.microcycles) {
          const weekStart = new Date(planStart);
          weekStart.setDate(weekStart.getDate() + weekOffset * 7);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);

          // Only include if this week overlaps with the requested range
          if (weekEnd >= fromDate && weekStart <= toDate) {
            weekContexts.push({
              weekStart: weekStart.toISOString().split('T')[0],
              weekEnd: weekEnd.toISOString().split('T')[0],
              planId: plan.id,
              planName: plan.name,
              mesocycleId: meso.id,
              mesocycleName: meso.name,
              mesocyclePhase: meso.phase,
              mesocycleColor: meso.color,
              microcycleWeekNumber: micro.weekNumber,
              loadPercent: micro.loadPercent,
              intensity: micro.intensity,
              isDeload: micro.isDeload,
              teamId: plan.team?.id ?? null,
              teamName: plan.team?.name ?? null,
              teamColor: plan.team?.color ?? null,
            });
          }
          weekOffset++;
        }

        // If mesocycle has fewer microcycles than durationWeeks, fill remaining
        const remaining = meso.durationWeeks - meso.microcycles.length;
        for (let i = 0; i < remaining; i++) {
          const weekStart = new Date(planStart);
          weekStart.setDate(weekStart.getDate() + weekOffset * 7);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);

          if (weekEnd >= fromDate && weekStart <= toDate) {
            weekContexts.push({
              weekStart: weekStart.toISOString().split('T')[0],
              weekEnd: weekEnd.toISOString().split('T')[0],
              planId: plan.id,
              planName: plan.name,
              mesocycleId: meso.id,
              mesocycleName: meso.name,
              mesocyclePhase: meso.phase,
              mesocycleColor: meso.color,
              microcycleWeekNumber: meso.microcycles.length + i + 1,
              loadPercent: meso.targetLoadPercent,
              intensity: 'MODERATE',
              isDeload: false,
              teamId: plan.team?.id ?? null,
              teamName: plan.team?.name ?? null,
              teamColor: plan.team?.color ?? null,
            });
          }
          weekOffset++;
        }
      }
    }

    return reply.send({ success: true, data: weekContexts });
  });
}
