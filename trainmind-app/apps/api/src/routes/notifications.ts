import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { calculateWellnessScore } from '@trainmind/utils';
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
              metricValue = calculateWellnessScore(latest);
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
    // Per organizzazione e non per utente: il calendario e' della societa'.
    // Le sedute dei piani, qui sotto, erano gia' filtrate cosi' — erano solo
    // gli eventi creati a mano a restare personali.
    const calendarWhere: Record<string, unknown> = {
      organizationId: request.user.organizationId,
      startTime: { gte: calendarFrom },
      endTime: { lte: calendarTo },
    };
    if (query.teamId) calendarWhere.teamId = query.teamId;

    const rawEvents = await app.prisma.calendarEvent.findMany({
      where: calendarWhere,
      orderBy: { startTime: 'asc' },
      include: { team: { select: { id: true, name: true, color: true } } },
    });

    // `athleteId` non ha una relazione Prisma su CalendarEvent: i nomi si
    // risolvono con una query a parte, senza toccare lo schema.
    const eventAthleteIds = [...new Set(rawEvents.map((e) => e.athleteId).filter((x): x is string => Boolean(x)))];
    const athleteNameById = new Map<string, string>();
    if (eventAthleteIds.length > 0) {
      const eventAthletes = await app.prisma.athlete.findMany({
        where: { id: { in: eventAthleteIds }, organizationId: request.user.organizationId },
        select: { id: true, firstName: true, lastName: true },
      });
      for (const a of eventAthletes) athleteNameById.set(a.id, `${a.lastName} ${a.firstName}`);
    }

    // Stato dell'allenamento: un evento di calendario non ce l'ha, ce l'ha il
    // foglio presenze collegato. IN_PROGRESS = foglio aperto, COMPLETED = seduta
    // chiusa con "Completa sessione". Senza foglio, l'evento e' solo pianificato.
    const sheetStatusByEvent = new Map<string, string>();
    if (rawEvents.length > 0) {
      const sheets = await app.prisma.fieldTrainingSession.findMany({
        where: { calendarEventId: { in: rawEvents.map((e) => e.id) } },
        select: { calendarEventId: true, status: true },
      });
      for (const sheet of sheets) {
        if (sheet.calendarEventId) sheetStatusByEvent.set(sheet.calendarEventId, sheet.status);
      }
    }

    const events = rawEvents.map((e) => ({
      id: e.id,
      sheetStatus: sheetStatusByEvent.get(e.id) ?? null,
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
      athleteId: e.athleteId ?? null,
      athleteName: e.athleteId ? athleteNameById.get(e.athleteId) ?? null : null,
      opponent: e.opponent ?? null,
      isHome: e.isHome ?? null,
      venue: e.venue ?? null,
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
      // Tipo dedicato: le sessioni dei piani non sono eventi creati a mano e
      // non devono ereditare l'etichetta di una delle categorie scelte dall'utente.
      type: 'session',
      // Le annullate restano in calendario (servono a spiegare un buco nel
      // carico settimanale) ma in grigio, cosi' non si confondono con le attive.
      color: s.status === 'COMPLETED' ? '#22c55e'
        : s.status === 'IN_PROGRESS' ? '#0d9488'
        : s.status === 'CANCELLED' ? '#94a3b8'
        : '#3b82f6',
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
  // Tipi in cui la squadra e' un dato che esiste per definizione: un
  // allenamento di gruppo o una partita sono di QUALCUNO. Su individual,
  // rehab, medical, meeting e other resta facoltativa, perche' li la squadra
  // non e' un dato mancante — e' un dato che non c'e' (una visita e' di un
  // atleta, una riunione e' dello staff).
  const TIPI_CON_SQUADRA = ['gym', 'basket', 'shooting', 'match'] as const;
  const richiedeSquadra = (type: string) =>
    (TIPI_CON_SQUADRA as readonly string[]).includes(type);

  app.post('/calendar/events', async (request, reply) => {
    const schema = z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(500).optional(),
      startTime: z.string(),
      endTime: z.string(),
      allDay: z.boolean().default(false),
      type: z.enum(['gym', 'basket', 'individual', 'shooting', 'match', 'rehab', 'meeting', 'medical', 'other']).default('other'),
      color: z.string().optional(),
      athleteId: z.string().optional(),
      teamId: z.string().optional(),
      // Dettagli partita. Accettati per qualunque tipo e poi azzerati sotto:
      // validare "solo se type === match" complicherebbe lo schema per
      // proteggere da un caso che l'interfaccia gia' non produce.
      opponent: z.string().max(100).nullish(),
      isHome: z.boolean().nullish(),
      venue: z.string().max(120).nullish(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    if (richiedeSquadra(parsed.data.type) && !parsed.data.teamId) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'TEAM_REQUIRED',
          message: 'Per allenamenti di gruppo e partite la squadra e\' obbligatoria',
          details: { teamId: ['Required'] },
        },
      });
    }
    // La squadra dev'essere della societa': senza questo controllo si potrebbe
    // agganciare un evento alla squadra di un'altra organizzazione.
    if (parsed.data.teamId) {
      const team = await app.prisma.team.findFirst({
        where: { id: parsed.data.teamId, organizationId: request.user.organizationId },
        select: { id: true },
      });
      if (!team) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Squadra non trovata' },
        });
      }
    }

    const isMatch = parsed.data.type === 'match';
    const event = await app.prisma.calendarEvent.create({
      data: {
        ...parsed.data,
        organizationId: request.user.organizationId,
        startTime: new Date(parsed.data.startTime),
        endTime: new Date(parsed.data.endTime),
        // Un allenamento non ha un avversario: se il tipo cambia in corsa nel
        // modulo, i campi partita compilati prima non devono restare appesi.
        opponent: isMatch ? parsed.data.opponent ?? null : null,
        isHome: isMatch ? parsed.data.isHome ?? null : null,
        venue: isMatch ? parsed.data.venue ?? null : null,
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
      opponent: z.string().max(100).nullish(),
      isHome: z.boolean().nullish(),
      venue: z.string().max(120).nullish(),
      // La squadra si puo' correggere: senza, un evento nato con quella
      // sbagliata non era piu' sistemabile se non cancellandolo.
      teamId: z.string().nullish(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Dati non validi' } });
    }

    // L'evento dev'essere della societa'. Prima si filtrava per utente e la
    // updateMany, non trovando niente, rispondeva comunque `success: true`:
    // una modifica che non avveniva senza dirlo a nessuno.
    const esistente = await app.prisma.calendarEvent.findFirst({
      where: { id, organizationId: request.user.organizationId },
      select: { id: true, type: true, teamId: true },
    });
    if (!esistente) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Evento non trovato' },
      });
    }

    // Il vincolo si valuta sul risultato della modifica, non sul solo payload:
    // cambiare il tipo da 'meeting' a 'basket' senza toccare la squadra deve
    // far scattare l'obbligo lo stesso.
    const tipoFinale = parsed.data.type ?? esistente.type;
    const squadraFinale = parsed.data.teamId !== undefined ? parsed.data.teamId : esistente.teamId;
    if (richiedeSquadra(tipoFinale) && !squadraFinale) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'TEAM_REQUIRED',
          message: 'Per allenamenti di gruppo e partite la squadra e\' obbligatoria',
          details: { teamId: ['Required'] },
        },
      });
    }
    if (squadraFinale && squadraFinale !== esistente.teamId) {
      const team = await app.prisma.team.findFirst({
        where: { id: squadraFinale, organizationId: request.user.organizationId },
        select: { id: true },
      });
      if (!team) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Squadra non trovata' },
        });
      }
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.startTime) data.startTime = new Date(parsed.data.startTime);
    if (parsed.data.endTime) data.endTime = new Date(parsed.data.endTime);

    await app.prisma.calendarEvent.updateMany({
      where: { id, organizationId: request.user.organizationId },
      data,
    });

    return reply.send({ success: true });
  });

  // ─── DELETE /calendar/events/:id — Delete event ────────────
  app.delete<{ Params: { id: string } }>('/calendar/events/:id', async (request, reply) => {
    const { id } = request.params;

    const event = await app.prisma.calendarEvent.findFirst({
      where: { id, organizationId: request.user.organizationId },
      select: {
        id: true,
        title: true,
        fieldTrainingSession: { select: { status: true } },
      },
    });
    if (!event) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Evento non trovato' },
      });
    }

    // Il foglio presenze e' in cascata sull'evento, ma le righe di carico per
    // singolo atleta create al "Completa sessione" NON lo sono: hanno il loro
    // athleteId e nessun legame col foglio. Cancellare un allenamento gia'
    // completato porterebbe via il documento (chi c'era, gli RPE, i cronometri)
    // lasciando il carico dentro ACWR, report e storico dell'atleta. Dati che
    // non tornano piu' a nessuno, senza un solo messaggio d'errore.
    if (event.fieldTrainingSession?.status === 'COMPLETED') {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'EVENT_ALREADY_COMPLETED',
          message: 'Questo allenamento e\' gia\' stato completato: il carico registrato resterebbe negli analytics senza il foglio che lo spiega. Annullalo invece di eliminarlo.',
        },
      });
    }

    await app.prisma.calendarEvent.delete({ where: { id } });
    return reply.send({ success: true });
  });
}
