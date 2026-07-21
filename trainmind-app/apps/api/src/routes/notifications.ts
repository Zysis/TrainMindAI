import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireMinRole } from '../middleware/rbac.js';

// ═══════════════════════════════════════════════════════════
// NOTIFICATIONS & ALERT RULES — Sprint 3.3
// ═══════════════════════════════════════════════════════════

const createAlertRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['acwr_high', 'acwr_danger', 'wellness_low', 'missed_session', 'missed_wellness', 'streak', 'custom']),
  condition: z.object({
    metric: z.string(),
    operator: z.enum(['>', '<', '>=', '<=', '==']),
    threshold: z.number(),
  }),
  severity: z.enum(['info', 'warning', 'danger']).default('warning'),
  athleteId: z.string().optional(),
  cooldownMinutes: z.number().int().min(60).max(10080).default(1440),
});

const updateAlertRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  severity: z.enum(['info', 'warning', 'danger']).optional(),
  condition: z.object({
    metric: z.string(),
    operator: z.enum(['>', '<', '>=', '<=', '==']),
    threshold: z.number(),
  }).optional(),
  isActive: z.boolean().optional(),
  cooldownMinutes: z.number().int().min(60).max(10080).optional(),
});

const notificationQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().default(false),
  severity: z.enum(['info', 'warning', 'danger', 'success']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function notificationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // ═══════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════

  // ─── GET /notifications — List user notifications ──────────
  app.get('/notifications', async (request, reply) => {
    const query = notificationQuerySchema.parse(request.query);
    const { userId } = request.user;

    const where: Record<string, unknown> = { userId };
    if (query.unreadOnly) where.isRead = false;
    if (query.severity) where.severity = query.severity;

    const [notifications, total, unreadCount] = await Promise.all([
      app.prisma.notification.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          alertRule: { select: { name: true, type: true } },
        },
      }),
      app.prisma.notification.count({ where }),
      app.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return reply.send({
      success: true,
      data: notifications,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
        unreadCount,
      },
    });
  });

  // ─── GET /notifications/unread-count — Quick badge count ───
  app.get('/notifications/unread-count', async (request, reply) => {
    const count = await app.prisma.notification.count({
      where: { userId: request.user.userId, isRead: false },
    });
    return reply.send({ success: true, data: { count } });
  });

  // ─── PUT /notifications/:id/read — Mark as read ───────────
  app.put<{ Params: { id: string } }>('/notifications/:id/read', async (request, reply) => {
    const { id } = request.params;
    const notification = await app.prisma.notification.updateMany({
      where: { id, userId: request.user.userId },
      data: { isRead: true, readAt: new Date() },
    });
    return reply.send({ success: true, data: { updated: notification.count } });
  });

  // ─── PUT /notifications/read-all — Mark all as read ────────
  app.put('/notifications/read-all', async (request, reply) => {
    const result = await app.prisma.notification.updateMany({
      where: { userId: request.user.userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return reply.send({ success: true, data: { updated: result.count } });
  });

  // ═══════════════════════════════════════════════════════════
  // ALERT RULES
  // ═══════════════════════════════════════════════════════════

  // ─── GET /alerts/rules — List alert rules ─────────────────
  app.get('/alerts/rules', async (request, reply) => {
    const { organizationId } = request.user;
    const rules = await app.prisma.alertRule.findMany({
      where: { organizationId },
      include: {
        athlete: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { notifications: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ success: true, data: rules });
  });

  // ─── POST /alerts/rules — Create alert rule ───────────────
  app.post('/alerts/rules', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = createAlertRuleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const rule = await app.prisma.alertRule.create({
      data: {
        ...parsed.data,
        condition: parsed.data.condition as any,
        organizationId: request.user.organizationId,
        userId: request.user.userId,
      },
    });

    return reply.status(201).send({ success: true, data: rule });
  });

  // ─── PUT /alerts/rules/:id — Update alert rule ────────────
  app.put<{ Params: { id: string } }>('/alerts/rules/:id', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const { id } = request.params;
    const parsed = updateAlertRuleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi' },
      });
    }

    const rule = await app.prisma.alertRule.updateMany({
      where: { id, organizationId: request.user.organizationId },
      data: {
        ...parsed.data,
        condition: parsed.data.condition as any,
      },
    });

    return reply.send({ success: true, data: { updated: rule.count } });
  });

  // ─── DELETE /alerts/rules/:id — Delete alert rule ──────────
  app.delete<{ Params: { id: string } }>('/alerts/rules/:id', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const { id } = request.params;
    await app.prisma.alertRule.deleteMany({
      where: { id, organizationId: request.user.organizationId },
    });
    return reply.send({ success: true });
  });

  // ─── POST /alerts/check — Run alert checks (trigger manually or via cron) ───
  app.post('/alerts/check', {
    preHandler: [requireMinRole('TRAINER')],
  }, async (request, reply) => {
    try {
    const { organizationId, userId } = request.user;
    const now = new Date();

    // Get active rules
    const rules = await app.prisma.alertRule.findMany({
      where: { organizationId, isActive: true },
      include: { athlete: { select: { id: true, firstName: true, lastName: true } } },
    });

    // Get all athletes if needed
    const athletes = await app.prisma.athlete.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, firstName: true, lastName: true },
    });

    // Get recent data for checks
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthAgo = new Date(now.getTime() - 28 * 86400000);

    const [recentWellness, recentSessions] = await Promise.all([
      app.prisma.wellnessLog.findMany({
        where: { athlete: { organizationId }, date: { gte: weekAgo } },
        orderBy: { date: 'desc' },
      }),
      app.prisma.trainingSession.findMany({
        where: {
          organizationId,
          isTemplate: false,
          status: 'COMPLETED',
          date: { gte: monthAgo },
        },
        select: {
          athleteId: true, date: true, duration: true, rpe: true,
          week: { select: { trainingPlan: { select: { teamId: true } } } },
        },
      }),
    ]);

    // Build team→athletes mapping for attributing team sessions
    const teamAthletes = await app.prisma.athleteTeam.findMany({
      where: { team: { organizationId } },
      select: { athleteId: true, teamId: true },
    });
    const teamAthletesMap: Record<string, string[]> = {};
    for (const ta of teamAthletes) {
      if (!teamAthletesMap[ta.teamId]) teamAthletesMap[ta.teamId] = [];
      teamAthletesMap[ta.teamId].push(ta.athleteId);
    }

    // Pre-compute per-athlete session loads (including team sessions)
    const athleteSessionLoads: Record<string, Array<{ date: Date; load: number }>> = {};
    for (const s of recentSessions) {
      if (!s.date) continue;
      const rpe = s.rpe || 5;
      const dur = s.duration || 60;
      const load = rpe * dur;
      const sessionDate = new Date(s.date);

      if (s.athleteId) {
        if (!athleteSessionLoads[s.athleteId]) athleteSessionLoads[s.athleteId] = [];
        athleteSessionLoads[s.athleteId].push({ date: sessionDate, load });
      } else {
        // Team session → attribute to all athletes in the team
        const teamId = (s as any).week?.trainingPlan?.teamId;
        if (teamId && teamAthletesMap[teamId]) {
          for (const aid of teamAthletesMap[teamId]) {
            if (!athleteSessionLoads[aid]) athleteSessionLoads[aid] = [];
            athleteSessionLoads[aid].push({ date: sessionDate, load });
          }
        }
      }
    }

    const notifications: Array<{ userId: string; alertRuleId: string; type: string; severity: string; title: string; message: string; data: any }> = [];

    for (const rule of rules) {
      // Cooldown check
      if (rule.lastTriggeredAt) {
        const cooldownMs = rule.cooldownMinutes * 60000;
        if (now.getTime() - rule.lastTriggeredAt.getTime() < cooldownMs) continue;
      }

      const condition = rule.condition as { metric: string; operator: string; threshold: number };
      const targetAthletes = rule.athleteId
        ? athletes.filter((a) => a.id === rule.athleteId)
        : athletes;

      for (const athlete of targetAthletes) {
        let shouldTrigger = false;
        let metricValue: number | null = null;
        let message = '';

        switch (condition.metric) {
          case 'acwr': {
            const myLoads = athleteSessionLoads[athlete.id] || [];
            const weekStart = new Date(now.getTime() - 7 * 86400000);
            const acuteLoad = myLoads
              .filter((s) => s.date >= weekStart)
              .reduce((sum, s) => sum + s.load, 0);
            const chronicLoad = myLoads.length > 0
              ? myLoads.reduce((sum, s) => sum + s.load, 0) / 3
              : 0;
            metricValue = chronicLoad > 0 ? Math.round((acuteLoad / chronicLoad) * 100) / 100 : 0;
            message = `ACWR di ${athlete.firstName} ${athlete.lastName}: ${metricValue} (soglia: ${condition.operator} ${condition.threshold})`;
            break;
          }
          case 'wellness_score': {
            const athleteWellness = recentWellness.filter((w) => w.athleteId === athlete.id);
            if (athleteWellness.length > 0) {
              const latest = athleteWellness[0];
              metricValue = Math.round(
                ((latest.sleepQuality + latest.mood + (6 - latest.fatigue) + (6 - latest.soreness) + (6 - latest.stress)) / 25) * 100
              );
              message = `Wellness score di ${athlete.firstName} ${athlete.lastName}: ${metricValue}% (soglia: ${condition.operator} ${condition.threshold})`;
            }
            break;
          }
          case 'fatigue': {
            const athleteWellness = recentWellness.filter((w) => w.athleteId === athlete.id);
            if (athleteWellness.length > 0) {
              metricValue = athleteWellness[0].fatigue;
              message = `Fatica di ${athlete.firstName} ${athlete.lastName}: ${metricValue}/5 (soglia: ${condition.operator} ${condition.threshold})`;
            }
            break;
          }
          case 'soreness': {
            const athleteWellness = recentWellness.filter((w) => w.athleteId === athlete.id);
            if (athleteWellness.length > 0) {
              metricValue = athleteWellness[0].soreness;
              message = `Dolore muscolare di ${athlete.firstName} ${athlete.lastName}: ${metricValue}/5 (soglia: ${condition.operator} ${condition.threshold})`;
            }
            break;
          }
        }

        // Evaluate condition
        if (metricValue !== null) {
          switch (condition.operator) {
            case '>': shouldTrigger = metricValue > condition.threshold; break;
            case '<': shouldTrigger = metricValue < condition.threshold; break;
            case '>=': shouldTrigger = metricValue >= condition.threshold; break;
            case '<=': shouldTrigger = metricValue <= condition.threshold; break;
            case '==': shouldTrigger = metricValue === condition.threshold; break;
          }
        }

        if (shouldTrigger) {
          notifications.push({
            userId,
            alertRuleId: rule.id,
            type: 'alert',
            severity: rule.severity,
            title: rule.name,
            message,
            data: { athleteId: athlete.id, athleteName: `${athlete.firstName} ${athlete.lastName}`, metricValue, ruleType: rule.type },
          });
        }
      }

      // Update lastTriggeredAt if any notifications were generated for this rule
      if (notifications.some((n) => n.alertRuleId === rule.id)) {
        await app.prisma.alertRule.update({
          where: { id: rule.id },
          data: { lastTriggeredAt: now },
        });
      }
    }

    // Batch create notifications
    if (notifications.length > 0) {
      await app.prisma.notification.createMany({ data: notifications });
    }

    return reply.send({
      success: true,
      data: { checked: rules.length, triggered: notifications.length },
    });

    } catch (err) {
      app.log.error(err, 'Alert check error');
      return reply.status(500).send({
        success: false,
        error: { code: 'ALERT_CHECK_ERROR', message: `Errore nel controllo alert: ${err instanceof Error ? err.message : 'errore sconosciuto'}` },
      });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // CALENDAR EVENTS
  // ═══════════════════════════════════════════════════════════

  // ─── GET /calendar/events — List events for date range ─────
  app.get('/calendar/events', async (request, reply) => {
    const query = z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      teamId: z.string().optional(),
    }).parse(request.query);

    const calendarFrom = new Date(new Date(query.from).getTime() - 86400000);
    const calendarTo = new Date(new Date(query.to + 'T23:59:59Z').getTime() + 86400000);
    const calendarWhere: Record<string, unknown> = {
      userId: request.user.userId,
      startTime: { gte: calendarFrom },
      endTime: { lte: calendarTo },
    };
    if (query.teamId) calendarWhere.teamId = query.teamId;

    const rawEvents = await app.prisma.calendarEvent.findMany({
      where: calendarWhere,
      orderBy: { startTime: 'asc' },
      include: { team: { select: { id: true, name: true, color: true } } },
    });

    const events = rawEvents.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startTime: e.startTime,
      endTime: e.endTime,
      allDay: e.allDay,
      type: e.type,
      color: e.color,
      teamId: e.team?.id ?? null,
      teamName: e.team?.name ?? null,
      teamColor: e.team?.color ?? null,
    }));

    // Also fetch training sessions in the range for auto-display
    // Expand range ±1 day to catch timezone boundary sessions
    // (e.g. session at 2026-04-30T22:00Z = May 1 in CEST)
    // Frontend filters by local month/year so extra events get excluded
    const sessionFrom = new Date(new Date(query.from).getTime() - 86400000);
    const sessionTo = new Date(new Date(query.to + 'T23:59:59Z').getTime() + 86400000);
    const sessionWhere: Record<string, unknown> = {
      isTemplate: false,
      week: { trainingPlan: { organizationId: request.user.organizationId, ...(query.teamId ? { teamId: query.teamId } : {}) } },
      date: { gte: sessionFrom, lte: sessionTo },
    };

    const sessions = await app.prisma.trainingSession.findMany({
      where: sessionWhere,
      select: {
        id: true, title: true, date: true, duration: true, status: true, aiModified: true,
        athlete: { select: { firstName: true, lastName: true } },
        week: { select: { trainingPlan: { select: { team: { select: { id: true, name: true, color: true } } } } } },
      },
      orderBy: { date: 'asc' },
    });

    // Convert sessions to calendar event format
    const sessionEvents = sessions.map((s) => {
      const base = s.date ?? new Date();
      return ({
      id: `session-${s.id}`,
      title: s.title,
      description: s.athlete ? `${s.athlete.firstName} ${s.athlete.lastName}` : null,
      startTime: base,
      endTime: new Date(base.getTime() + (s.duration || 60) * 60000),
      allDay: false,
      type: 'training',
      color: s.status === 'COMPLETED' ? '#22c55e' : s.status === 'IN_PROGRESS' ? '#0d9488' : '#3b82f6',
      isSession: true,
      sessionId: s.id,
      status: s.status,
      aiModified: s.aiModified || false,
      teamId: s.week?.trainingPlan?.team?.id ?? null,
      teamName: s.week?.trainingPlan?.team?.name ?? null,
      teamColor: s.week?.trainingPlan?.team?.color ?? null,
    });
    });

    return reply.send({
      success: true,
      data: [...events, ...sessionEvents],
    });
  });

  // ─── POST /calendar/events — Create event ─────────────────
  app.post('/calendar/events', async (request, reply) => {
    const schema = z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(500).optional(),
      startTime: z.string(),
      endTime: z.string(),
      allDay: z.boolean().default(false),
      type: z.enum(['training', 'field_training', 'match', 'medical', 'meeting', 'other']).default('other'),
      color: z.string().optional(),
      athleteId: z.string().optional(),
      teamId: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const event = await app.prisma.calendarEvent.create({
      data: {
        ...parsed.data,
        startTime: new Date(parsed.data.startTime),
        endTime: new Date(parsed.data.endTime),
        userId: request.user.userId,
      },
    });

    return reply.status(201).send({ success: true, data: event });
  });

  // ─── PUT /calendar/events/:id — Update event ──────────────
  app.put<{ Params: { id: string } }>('/calendar/events/:id', async (request, reply) => {
    const { id } = request.params;
    const schema = z.object({
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(500).optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      allDay: z.boolean().optional(),
      type: z.string().optional(),
      color: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Dati non validi' } });
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.startTime) data.startTime = new Date(parsed.data.startTime);
    if (parsed.data.endTime) data.endTime = new Date(parsed.data.endTime);

    await app.prisma.calendarEvent.updateMany({
      where: { id, userId: request.user.userId },
      data,
    });

    return reply.send({ success: true });
  });

  // ─── DELETE /calendar/events/:id — Delete event ────────────
  app.delete<{ Params: { id: string } }>('/calendar/events/:id', async (request, reply) => {
    const { id } = request.params;
    await app.prisma.calendarEvent.deleteMany({
      where: { id, userId: request.user.userId },
    });
    return reply.send({ success: true });
  });
}
