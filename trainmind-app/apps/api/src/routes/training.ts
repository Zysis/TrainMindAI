import type { FastifyInstance } from 'fastify';
import {
  createTrainingPlanSchema,
  updateTrainingPlanSchema,
  trainingPlanQuerySchema,
  updateWeekSchema,
  createSessionSchema,
  createTemplateSchema,
  updateSessionSchema,
  addSessionExerciseSchema,
  updateSessionExerciseSchema,
  reorderExercisesSchema,
  createSessionLogSchema,
} from '../schemas/training.js';
import { requireMinRole } from '../middleware/rbac.js';

export async function trainingRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', app.authenticate);

  // ═══════════════════════════════════════════════════════════
  // TRAINING PLANS
  // ═══════════════════════════════════════════════════════════

  // ─── GET /training/plans — List plans ─────────────────────
  app.get('/training/plans', async (request, reply) => {
    const query = trainingPlanQuerySchema.parse(request.query);
    const { organizationId } = request.user;
    const { page, limit, athleteId, search, sortBy, sortOrder, teamId } = query;
    const { includeWeeks } = request.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = { organizationId };
    if (athleteId) where.athleteId = athleteId;
    if (teamId) where.teamId = teamId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const includeObj: Record<string, unknown> = {
      athlete: { select: { id: true, firstName: true, lastName: true, position: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { weeks: true } },
    };

    // Optionally include weeks with sessions (for import)
    if (includeWeeks === '1') {
      includeObj.weeks = {
        orderBy: { weekNumber: 'asc' },
        include: {
          trainingSessions: {
            select: { id: true, title: true, duration: true, date: true },
            orderBy: { date: 'asc' },
          },
        },
      };
    }

    const [plans, total] = await Promise.all([
      app.prisma.trainingPlan.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: includeObj,
      }),
      app.prisma.trainingPlan.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: plans,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // ─── GET /training/plans/:id — Detail with weeks & sessions
  app.get<{ Params: { id: string } }>('/training/plans/:id', async (request, reply) => {
    const { id } = request.params;
    const { organizationId } = request.user;

    const plan = await app.prisma.trainingPlan.findFirst({
      where: { id, organizationId },
      include: {
        athlete: { select: { id: true, firstName: true, lastName: true, position: true, photoUrl: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        periodizationPlan: { select: { id: true, name: true, type: true } },
        weeks: {
          orderBy: { weekNumber: 'asc' },
          include: {
            microcycle: {
              select: {
                id: true, weekNumber: true, loadPercent: true, intensity: true,
                sessionsCount: true, focusAreas: true, isDeload: true,
                mesocycle: { select: { name: true, phase: true } },
              },
            },
            trainingSessions: {
              orderBy: { date: 'asc' },
              include: {
                athlete: { select: { id: true, firstName: true, lastName: true } },
                _count: { select: { sessionExercises: true } },
              },
            },
          },
        },
      },
    });

    if (!plan) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Piano non trovato' },
      });
    }

    return reply.send({ success: true, data: plan });
  });

  // ─── POST /training/plans — Create plan with weeks ────────
  app.post('/training/plans', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = createTrainingPlanSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const { organizationId, userId } = request.user;
    const { weeks: weekCount, ...planData } = parsed.data;

    // Validate athlete belongs to same org (if provided)
    if (planData.athleteId) {
      const athlete = await app.prisma.athlete.findFirst({
        where: { id: planData.athleteId, organizationId },
      });
      if (!athlete) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Atleta non trovato nella tua organizzazione' },
        });
      }
    }

    // Create plan with weeks in a transaction
    const plan = await app.prisma.trainingPlan.create({
      data: {
        name: planData.name,
        description: planData.description,
        startDate: new Date(planData.startDate),
        endDate: new Date(planData.endDate),
        athleteId: planData.athleteId,
        teamId: planData.teamId || null,
        organizationId,
        createdById: userId,
        weeks: {
          create: Array.from({ length: weekCount }, (_, i) => ({
            weekNumber: i + 1,
          })),
        },
      },
      include: {
        athlete: { select: { id: true, firstName: true, lastName: true } },
        weeks: { orderBy: { weekNumber: 'asc' } },
        _count: { select: { weeks: true } },
      },
    });

    return reply.status(201).send({ success: true, data: plan });
  });

  // ─── POST /training/plans/from-ai — Create full plan from AI output ──
  app.post('/training/plans/from-ai', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const body = request.body as {
      planName: string;
      description: string;
      athleteId?: string;
      teamId?: string;
      weeks: Array<{
        weekNumber: number;
        notes?: string;
        sessions: Array<{
          title: string;
          duration: number;
          notes?: string;
          exercises: Array<{
            name: string;
            category: string;
            sets: number;
            reps: string;
            intensity?: string;
            restSeconds?: number;
            notes?: string;
          }>;
        }>;
      }>;
    };

    if (!body.planName || !body.weeks || body.weeks.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Piano AI non valido' },
      });
    }

    const { organizationId, userId } = request.user;
    const weekCount = body.weeks.length;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + weekCount * 7);

    // La squadra va assegnata come nella creazione manuale: la lista dei piani
    // filtra per teamId, quindi un piano senza squadra risulta invisibile a
    // chiunque abbia una squadra selezionata — sembra che non sia stato creato.
    let teamId: string | null = null;
    if (body.teamId) {
      const team = await app.prisma.team.findFirst({
        where: { id: body.teamId, organizationId },
        select: { id: true },
      });
      if (!team) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Squadra non trovata nella tua organizzazione' },
        });
      }
      teamId = team.id;
    }

    try {
      const result = await app.prisma.$transaction(async (tx) => {
        // 1. Create the plan with weeks
        const plan = await tx.trainingPlan.create({
          data: {
            name: body.planName,
            description: body.description || null,
            startDate,
            endDate,
            athleteId: body.athleteId || null,
            teamId,
            organizationId,
            createdById: userId,
            weeks: {
              create: body.weeks.map((w) => ({
                weekNumber: w.weekNumber,
                notes: w.notes || null,
              })),
            },
          },
          include: {
            weeks: { orderBy: { weekNumber: 'asc' } },
          },
        });

        // 2. Collect all unique exercise names from the AI plan
        const allExerciseNames = new Set<string>();
        for (const week of body.weeks) {
          for (const session of week.sessions) {
            for (const ex of session.exercises) {
              allExerciseNames.add(ex.name);
            }
          }
        }

        // 3. Find existing exercises by name (case-insensitive) in this org
        const existingExercises = await tx.exercise.findMany({
          where: {
            organizationId,
            name: { in: Array.from(allExerciseNames), mode: 'insensitive' },
          },
        });

        // Build a lookup map (lowercase name → exercise)
        const exerciseMap = new Map<string, { id: string }>();
        for (const ex of existingExercises) {
          exerciseMap.set(ex.name.toLowerCase(), ex);
        }

        // 4. Create missing exercises
        const exercisesToCreate: Array<{ name: string; category: string }> = [];
        for (const week of body.weeks) {
          for (const session of week.sessions) {
            for (const ex of session.exercises) {
              if (!exerciseMap.has(ex.name.toLowerCase())) {
                exercisesToCreate.push({ name: ex.name, category: ex.category });
                // Placeholder to avoid duplicates in this loop
                exerciseMap.set(ex.name.toLowerCase(), { id: '' });
              }
            }
          }
        }

        // Deduplicate by name
        const uniqueNew = Array.from(
          new Map(exercisesToCreate.map((e) => [e.name.toLowerCase(), e])).values()
        );

        for (const newEx of uniqueNew) {
          const created = await tx.exercise.create({
            data: {
              name: newEx.name,
              category: newEx.category,
              muscleGroups: [],
              equipment: [],
              organizationId,
            },
          });
          exerciseMap.set(newEx.name.toLowerCase(), created);
        }

        // 5. Create sessions and session exercises for each week
        for (const aiWeek of body.weeks) {
          const dbWeek = plan.weeks.find((w) => w.weekNumber === aiWeek.weekNumber);
          if (!dbWeek) continue;

          for (let si = 0; si < aiWeek.sessions.length; si++) {
            const aiSession = aiWeek.sessions[si];
            const sessionDate = new Date(startDate);
            sessionDate.setDate(sessionDate.getDate() + (aiWeek.weekNumber - 1) * 7 + si);

            const session = await tx.trainingSession.create({
              data: {
                title: aiSession.title,
                date: sessionDate,
                duration: aiSession.duration || 90,
                notes: aiSession.notes || null,
                athleteId: body.athleteId || null,
                weekId: dbWeek.id,
                status: 'PLANNED',
                organizationId,
              },
            });

            // Create session exercises
            for (let ei = 0; ei < aiSession.exercises.length; ei++) {
              const aiEx = aiSession.exercises[ei];
              const exercise = exerciseMap.get(aiEx.name.toLowerCase());
              if (!exercise || !exercise.id) continue;

              await tx.sessionExercise.create({
                data: {
                  trainingSessionId: session.id,
                  exerciseId: exercise.id,
                  orderIndex: ei,
                  sets: aiEx.sets || null,
                  reps: aiEx.reps || null,
                  restTime: aiEx.restSeconds || null,
                  notes: [aiEx.intensity, aiEx.notes].filter(Boolean).join(' — ') || null,
                },
              });
            }
          }
        }

        return plan;
      });

      // Fetch the full plan with all includes
      const fullPlan = await app.prisma.trainingPlan.findUnique({
        where: { id: result.id },
        include: {
          athlete: { select: { id: true, firstName: true, lastName: true, position: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { weeks: true } },
        },
      });

      return reply.status(201).send({ success: true, data: fullPlan });
    } catch (err) {
      app.log.error(err, 'Error creating AI plan');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Errore nella creazione del piano AI' },
      });
    }
  });

  // ─── PUT /training/plans/:id — Update plan ────────────────
  app.put<{ Params: { id: string } }>('/training/plans/:id', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = updateTrainingPlanSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const { id } = request.params;
    const { organizationId } = request.user;

    const existing = await app.prisma.trainingPlan.findFirst({ where: { id, organizationId } });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Piano non trovato' },
      });
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (data.startDate) data.startDate = new Date(data.startDate as string);
    if (data.endDate) data.endDate = new Date(data.endDate as string);

    const plan = await app.prisma.trainingPlan.update({ where: { id }, data });
    return reply.send({ success: true, data: plan });
  });

  // ─── DELETE /training/plans/:id — Delete plan (cascade) ───
  app.delete<{ Params: { id: string } }>('/training/plans/:id', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const { id } = request.params;
    const { organizationId } = request.user;

    const existing = await app.prisma.trainingPlan.findFirst({ where: { id, organizationId } });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Piano non trovato' },
      });
    }

    await app.prisma.trainingPlan.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Piano eliminato' } });
  });

  // ═══════════════════════════════════════════════════════════
  // WEEKS
  // ═══════════════════════════════════════════════════════════

  // ─── PUT /training/weeks/:id — Update week notes ──────────
  app.put<{ Params: { id: string } }>('/training/weeks/:id', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = updateWeekSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const { id } = request.params;
    const { organizationId } = request.user;

    // Verify ownership through plan
    const week = await app.prisma.week.findFirst({
      where: { id, trainingPlan: { organizationId } },
    });
    if (!week) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Settimana non trovata' },
      });
    }

    const updated = await app.prisma.week.update({
      where: { id },
      data: parsed.data,
    });
    return reply.send({ success: true, data: updated });
  });

  // ═══════════════════════════════════════════════════════════
  // TRAINING SESSIONS
  // ═══════════════════════════════════════════════════════════

  // ─── GET /training/sessions — List all sessions (org-wide) ──
  // ?templates=1 → list only templates (no week, reusable)
  // default → list only instances (sessions inside mesocycles with dates)
  app.get('/training/sessions', async (request, reply) => {
    const { organizationId } = request.user;
    const { search, status, teamId, from, to, limit, page, templates } = request.query as Record<string, string | undefined>;

    const take = Math.min(parseInt(limit || '50'), 200);
    const skip = ((parseInt(page || '1') - 1) * take);

    if (templates === '1') {
      // Templates: sessions without a week, reusable library
      const where: Record<string, unknown> = {
        organizationId,
        isTemplate: true,
      };
      if (search) {
        where.title = { contains: search, mode: 'insensitive' };
      }

      const [sessions, total] = await Promise.all([
        app.prisma.trainingSession.findMany({
          where,
          include: {
            sessionExercises: {
              include: { exercise: { select: { id: true, name: true, category: true } } },
              orderBy: { orderIndex: 'asc' },
            },
            _count: { select: { sessionExercises: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take,
          skip,
        }),
        app.prisma.trainingSession.count({ where }),
      ]);

      return reply.send({
        success: true,
        data: sessions,
        meta: { total, page: parseInt(page || '1'), totalPages: Math.ceil(total / take) },
      });
    }

    // Instances: sessions inside mesocycle weeks
    const where: Record<string, unknown> = {
      isTemplate: false,
      weekId: { not: null },
      week: { trainingPlan: { organizationId } },
    };
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }
    if (status) {
      where.status = status;
    }
    if (teamId) {
      where.week = { trainingPlan: { organizationId, teamId } };
    }
    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, unknown>).gte = new Date(from);
      if (to) (where.date as Record<string, unknown>).lte = new Date(to);
    }

    const [sessions, total] = await Promise.all([
      app.prisma.trainingSession.findMany({
        where,
        include: {
          week: {
            include: {
              trainingPlan: { select: { id: true, name: true, teamId: true, team: { select: { name: true, color: true } } } },
            },
          },
          athlete: { select: { id: true, firstName: true, lastName: true, position: true } },
          sessionExercises: { include: { exercise: { select: { id: true, name: true, category: true } } }, orderBy: { orderIndex: 'asc' } },
          _count: { select: { sessionExercises: true } },
        },
        orderBy: { date: 'desc' },
        take,
        skip,
      }),
      app.prisma.trainingSession.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: sessions,
      meta: { total, page: parseInt(page || '1'), totalPages: Math.ceil(total / take) },
    });
  });

  // ─── GET /training/sessions/:id — Session detail ──────────
  app.get<{ Params: { id: string } }>('/training/sessions/:id', async (request, reply) => {
    const { id } = request.params;
    const { organizationId } = request.user;

    // Try as template first (direct org ownership), then as instance (week→plan→org)
    const session = await app.prisma.trainingSession.findFirst({
      where: {
        id,
        OR: [
          { organizationId },
          { week: { trainingPlan: { organizationId } } },
        ],
      },
      include: {
        athlete: { select: { id: true, firstName: true, lastName: true, position: true } },
        week: {
          select: {
            id: true,
            weekNumber: true,
            trainingPlan: { select: { id: true, name: true } },
          },
        },
        sessionExercises: {
          orderBy: { orderIndex: 'asc' },
          include: {
            exercise: {
              select: {
                id: true, name: true, category: true,
                muscleGroups: true, equipment: true, description: true, videoUrl: true,
              },
            },
          },
        },
        sessionLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!session) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sessione non trovata' },
      });
    }

    return reply.send({ success: true, data: session });
  });

  // ─── POST /training/weeks/:weekId/sessions — Create session
  app.post<{ Params: { weekId: string } }>('/training/weeks/:weekId/sessions', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = createSessionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const { weekId } = request.params;
    const { organizationId } = request.user;

    // Verify week belongs to user's org
    const week = await app.prisma.week.findFirst({
      where: { id: weekId, trainingPlan: { organizationId } },
    });
    if (!week) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Settimana non trovata' },
      });
    }

    const session = await app.prisma.trainingSession.create({
      data: {
        title: parsed.data.title,
        date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
        duration: parsed.data.duration ?? 60,
        notes: parsed.data.notes,
        athleteId: parsed.data.athleteId,
        weekId,
        organizationId,
        isTemplate: false,
        status: 'PLANNED',
      },
      include: {
        athlete: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return reply.status(201).send({ success: true, data: session });
  });

  // ═══════════════════════════════════════════════════════════
  // SESSION TEMPLATES
  // ═══════════════════════════════════════════════════════════

  // ─── POST /training/session-templates — Create template ───
  app.post('/training/session-templates', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = createTemplateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const { organizationId } = request.user;

    const session = await app.prisma.trainingSession.create({
      data: {
        title: parsed.data.title,
        duration: parsed.data.duration ?? 60,
        notes: parsed.data.notes,
        isTemplate: true,
        organizationId,
        status: 'PLANNED',
      },
      include: { _count: { select: { sessionExercises: true } } },
    });

    return reply.status(201).send({ success: true, data: session });
  });

  // ─── PUT /training/session-templates/:id — Update template ─
  app.put<{ Params: { id: string } }>('/training/session-templates/:id', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = createTemplateSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const { id } = request.params;
    const { organizationId } = request.user;

    const existing = await app.prisma.trainingSession.findFirst({
      where: { id, organizationId, isTemplate: true },
    });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Template non trovato' },
      });
    }

    const session = await app.prisma.trainingSession.update({
      where: { id },
      data: parsed.data,
    });

    return reply.send({ success: true, data: session });
  });

  // ─── DELETE /training/session-templates/:id — Delete template
  app.delete<{ Params: { id: string } }>('/training/session-templates/:id', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const { id } = request.params;
    const { organizationId } = request.user;

    const existing = await app.prisma.trainingSession.findFirst({
      where: { id, organizationId, isTemplate: true },
    });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Template non trovato' },
      });
    }

    await app.prisma.trainingSession.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Template eliminato' } });
  });

  // ─── POST /training/session-templates/:id/import — Import template into a week
  // Copies the template session + exercises into a mesocycle week with a date
  app.post<{ Params: { id: string } }>('/training/session-templates/:id/import', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const { id } = request.params;
    const { organizationId } = request.user;
    const { weekId, date } = request.body as { weekId: string; date: string };

    if (!weekId || !date) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'weekId e date sono obbligatori' },
      });
    }

    // Verify template belongs to org
    const template = await app.prisma.trainingSession.findFirst({
      where: { id, organizationId, isTemplate: true },
      include: {
        sessionExercises: { orderBy: { orderIndex: 'asc' } },
      },
    });
    if (!template) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Template non trovato' },
      });
    }

    // Verify week belongs to org
    const week = await app.prisma.week.findFirst({
      where: { id: weekId, trainingPlan: { organizationId } },
    });
    if (!week) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Settimana non trovata' },
      });
    }

    // Create session instance from template + copy exercises
    const session = await app.prisma.trainingSession.create({
      data: {
        title: template.title,
        date: new Date(date),
        duration: template.duration,
        notes: template.notes,
        isTemplate: false,
        organizationId,
        weekId,
        status: 'PLANNED',
        sessionExercises: {
          create: template.sessionExercises.map((ex) => ({
            exerciseId: ex.exerciseId,
            orderIndex: ex.orderIndex,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight,
            duration: ex.duration,
            restTime: ex.restTime,
            notes: ex.notes,
          })),
        },
      },
      include: {
        sessionExercises: {
          include: { exercise: { select: { id: true, name: true, category: true } } },
          orderBy: { orderIndex: 'asc' },
        },
        _count: { select: { sessionExercises: true } },
      },
    });

    return reply.status(201).send({ success: true, data: session });
  });

  // ─── PUT /training/sessions/:id — Update session ──────────
  app.put<{ Params: { id: string } }>('/training/sessions/:id', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = updateSessionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const { id } = request.params;
    const { organizationId } = request.user;

    const existing = await app.prisma.trainingSession.findFirst({
      where: { id, OR: [{ organizationId }, { week: { trainingPlan: { organizationId } } }] },
    });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sessione non trovata' },
      });
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (data.date) data.date = new Date(data.date as string);

    const session = await app.prisma.trainingSession.update({ where: { id }, data });
    return reply.send({ success: true, data: session });
  });

  // ─── DELETE /training/sessions/:id — Delete session ───────
  app.delete<{ Params: { id: string } }>('/training/sessions/:id', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const { id } = request.params;
    const { organizationId } = request.user;

    const existing = await app.prisma.trainingSession.findFirst({
      where: { id, OR: [{ organizationId }, { week: { trainingPlan: { organizationId } } }] },
    });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sessione non trovata' },
      });
    }

    await app.prisma.trainingSession.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Sessione eliminata' } });
  });

  // ═══════════════════════════════════════════════════════════
  // SESSION EXERCISES
  // ═══════════════════════════════════════════════════════════

  // ─── POST /training/sessions/:sessionId/exercises — Add exercise
  app.post<{ Params: { sessionId: string } }>('/training/sessions/:sessionId/exercises', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = addSessionExerciseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const { sessionId } = request.params;
    const { organizationId } = request.user;

    // Verify session belongs to org
    const session = await app.prisma.trainingSession.findFirst({
      where: { id: sessionId, OR: [{ organizationId }, { week: { trainingPlan: { organizationId } } }] },
    });
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sessione non trovata' },
      });
    }

    // Auto orderIndex if not provided
    let { orderIndex } = parsed.data;
    if (orderIndex === 0) {
      const lastExercise = await app.prisma.sessionExercise.findFirst({
        where: { trainingSessionId: sessionId },
        orderBy: { orderIndex: 'desc' },
      });
      orderIndex = lastExercise ? lastExercise.orderIndex + 1 : 0;
    }

    const sessionExercise = await app.prisma.sessionExercise.create({
      data: {
        ...parsed.data,
        orderIndex,
        trainingSessionId: sessionId,
      },
      include: {
        exercise: {
          select: { id: true, name: true, category: true, muscleGroups: true },
        },
      },
    });

    return reply.status(201).send({ success: true, data: sessionExercise });
  });

  // ─── PUT /training/session-exercises/:id — Update exercise params
  app.put<{ Params: { id: string } }>('/training/session-exercises/:id', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = updateSessionExerciseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const { id } = request.params;
    const { organizationId } = request.user;

    const existing = await app.prisma.sessionExercise.findFirst({
      where: { id, trainingSession: { OR: [{ organizationId }, { week: { trainingPlan: { organizationId } } }] } },
    });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Esercizio sessione non trovato' },
      });
    }

    const updated = await app.prisma.sessionExercise.update({
      where: { id },
      data: parsed.data,
      include: {
        exercise: { select: { id: true, name: true, category: true } },
      },
    });
    return reply.send({ success: true, data: updated });
  });

  // ─── DELETE /training/session-exercises/:id — Remove exercise
  app.delete<{ Params: { id: string } }>('/training/session-exercises/:id', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const { id } = request.params;
    const { organizationId } = request.user;

    const existing = await app.prisma.sessionExercise.findFirst({
      where: { id, trainingSession: { OR: [{ organizationId }, { week: { trainingPlan: { organizationId } } }] } },
    });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Esercizio sessione non trovato' },
      });
    }

    await app.prisma.sessionExercise.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Esercizio rimosso dalla sessione' } });
  });

  // ─── PUT /training/sessions/:sessionId/exercises/reorder ──
  app.put<{ Params: { sessionId: string } }>('/training/sessions/:sessionId/exercises/reorder', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = reorderExercisesSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const { sessionId } = request.params;
    const { organizationId } = request.user;

    const session = await app.prisma.trainingSession.findFirst({
      where: { id: sessionId, OR: [{ organizationId }, { week: { trainingPlan: { organizationId } } }] },
    });
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sessione non trovata' },
      });
    }

    // Update all in a transaction
    await app.prisma.$transaction(
      parsed.data.exercises.map((ex) =>
        app.prisma.sessionExercise.update({
          where: { id: ex.id },
          data: { orderIndex: ex.orderIndex },
        }),
      ),
    );

    return reply.send({ success: true, data: { message: 'Ordine aggiornato' } });
  });

  // ═══════════════════════════════════════════════════════════
  // SESSION LOG (actual performance tracking)
  // ═══════════════════════════════════════════════════════════

  // ─── POST /training/sessions/:sessionId/log — Log performance (completes session)
  app.post<{ Params: { sessionId: string } }>('/training/sessions/:sessionId/log', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = createSessionLogSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const { sessionId } = request.params;
    const { organizationId } = request.user;

    const session = await app.prisma.trainingSession.findFirst({
      where: { id: sessionId, OR: [{ organizationId }, { week: { trainingPlan: { organizationId } } }] },
      include: { athlete: { select: { id: true } } },
    });
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sessione non trovata' },
      });
    }

    // Upsert: create or update session log (unique on [trainingSessionId, athleteId])
    const athleteId = session.athleteId || request.user.id;
    const log = await app.prisma.sessionLog.upsert({
      where: {
        trainingSessionId_athleteId: {
          trainingSessionId: sessionId,
          athleteId,
        },
      },
      create: {
        ...parsed.data,
        completedSets: (parsed.data.completedSets as any) ?? undefined,
        trainingSessionId: sessionId,
        athleteId,
      },
      update: {
        ...parsed.data,
        completedSets: (parsed.data.completedSets as any) ?? undefined,
      },
    });

    // Also mark session as completed and update RPE
    await app.prisma.trainingSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        rpe: parsed.data.actualRpe ?? undefined,
      },
    });

    return reply.status(201).send({ success: true, data: log });
  });

  // ─── PATCH /training/sessions/:sessionId/log — Partial save during recording (does NOT complete session)
  app.patch<{ Params: { sessionId: string } }>('/training/sessions/:sessionId/log', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = createSessionLogSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const { sessionId } = request.params;
    const { organizationId } = request.user;

    const session = await app.prisma.trainingSession.findFirst({
      where: { id: sessionId, OR: [{ organizationId }, { week: { trainingPlan: { organizationId } } }] },
    });
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sessione non trovata' },
      });
    }

    const athleteId = session.athleteId || request.user.id;

    // Upsert log without completing the session
    const log = await app.prisma.sessionLog.upsert({
      where: {
        trainingSessionId_athleteId: {
          trainingSessionId: sessionId,
          athleteId,
        },
      },
      create: {
        ...parsed.data,
        completedSets: (parsed.data.completedSets as any) ?? undefined,
        trainingSessionId: sessionId,
        athleteId,
      },
      update: {
        ...parsed.data,
        completedSets: (parsed.data.completedSets as any) ?? undefined,
      },
    });

    // Mark session as IN_PROGRESS if still PLANNED
    if (session.status === 'PLANNED') {
      await app.prisma.trainingSession.update({
        where: { id: sessionId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    return reply.status(200).send({ success: true, data: log });
  });
}
