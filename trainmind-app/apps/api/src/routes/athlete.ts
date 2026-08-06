import type { FastifyInstance } from 'fastify';
import { requireMinRole } from '../middleware/rbac.js';
import { requireAthlete } from '../middleware/rbac.js';
import {
  createInviteSchema,
  registerFromInviteSchema,
  athleteWellnessSchema,
  athleteSessionLogSchema,
  athleteSessionsQuerySchema,
  athleteWellnessQuerySchema,
  pushSubscriptionSchema,
} from '../schemas/athlete.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { LEGAL_VERSIONS } from '../lib/legal.js';
import { sendEmail } from '../services/email-service.js';

export async function athleteRoutes(app: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════
  // INVITE MANAGEMENT (Trainer/Admin side)
  // ═══════════════════════════════════════════════════════════

  // ─── POST /athlete/invite — Send invite to athlete ────────
  app.post('/athlete/invite', {
    preHandler: [app.authenticate, requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const parsed = createInviteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const { athleteId, email } = parsed.data;
    const { userId, organizationId } = request.user;

    // Check athlete exists and belongs to same org
    const athlete = await app.prisma.athlete.findFirst({
      where: { id: athleteId, organizationId },
    });
    if (!athlete) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Atleta non trovato' },
      });
    }

    // Check if athlete already has an account
    const existingUser = await app.prisma.user.findFirst({
      where: { athleteId },
    });
    if (existingUser) {
      return reply.status(409).send({
        success: false,
        error: { code: 'CONFLICT', message: 'Atleta ha già un account collegato' },
      });
    }

    // Check rate limit: max 50 invites/day per org
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inviteCount = await app.prisma.athleteInvite.count({
      where: { organizationId, createdAt: { gte: today } },
    });
    if (inviteCount >= 50) {
      return reply.status(429).send({
        success: false,
        error: { code: 'RATE_LIMIT', message: 'Limite inviti giornaliero raggiunto (50)' },
      });
    }

    // Revoke any pending invites for same athlete
    await app.prisma.athleteInvite.updateMany({
      where: { athleteId, status: 'PENDING' },
      data: { status: 'REVOKED' },
    });

    // Create invite (expires in 7 days)
    const invite = await app.prisma.athleteInvite.create({
      data: {
        athleteId,
        email,
        invitedById: userId,
        organizationId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Costruisci il link di invito verso l'app atleti
    const athleteAppUrl = process.env.ATHLETE_APP_URL || 'http://localhost:3003';
    const inviteLink = `${athleteAppUrl}/register?token=${invite.token}`;

    // Nome organizzazione per personalizzare l'email
    const orgRow = await app.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    const orgName = orgRow?.name || 'La tua squadra';
    const athleteName = `${athlete.firstName} ${athlete.lastName}`.trim();

    // Invio email (asincrono — in log-only mode se RESEND_API_KEY non è configurata)
    sendEmail(
      {
        to: [email],
        subject: `${orgName} ti invita su TrainMind`,
        html: buildAthleteInviteHtml({ athleteName, orgName, inviteLink }),
        text: buildAthleteInviteText({ athleteName, orgName, inviteLink }),
      },
      request.log,
    ).catch((err) => request.log.error({ err }, 'Athlete invite email failed'));

    return reply.status(201).send({
      success: true,
      data: {
        id: invite.id,
        token: invite.token,
        email: invite.email,
        expiresAt: invite.expiresAt,
        inviteLink, // utile al frontend per mostrare/copiare il link
      },
    });
  });

  // ─── GET /athlete/invites — List invites for org (Trainer) ─
  app.get('/athlete/invites', {
    preHandler: [app.authenticate, requireMinRole('TRAINER')],
  }, async (request, reply) => {
    const { organizationId } = request.user;

    const invites = await app.prisma.athleteInvite.findMany({
      where: { organizationId },
      include: {
        athlete: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return reply.send({ success: true, data: invites });
  });

  // ═══════════════════════════════════════════════════════════
  // REGISTRATION (Public — no auth needed)
  // ═══════════════════════════════════════════════════════════

  // ─── GET /athlete/invite/:token — Validate invite token ───
  app.get<{ Params: { token: string } }>('/athlete/invite/:token', async (request, reply) => {
    const { token } = request.params;

    const invite = await app.prisma.athleteInvite.findUnique({
      where: { token },
      include: {
        athlete: { select: { firstName: true, lastName: true } },
        organization: { select: { name: true, logoUrl: true } },
      },
    });

    if (!invite) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invito non trovato' },
      });
    }

    if (invite.status !== 'PENDING') {
      return reply.status(410).send({
        success: false,
        error: { code: 'GONE', message: `Invito già ${invite.status.toLowerCase()}` },
      });
    }

    if (new Date() > invite.expiresAt) {
      await app.prisma.athleteInvite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' },
      });
      return reply.status(410).send({
        success: false,
        error: { code: 'EXPIRED', message: 'Invito scaduto' },
      });
    }

    return reply.send({
      success: true,
      data: {
        email: invite.email,
        athleteName: `${invite.athlete.firstName} ${invite.athlete.lastName}`,
        organizationName: invite.organization.name,
        organizationLogo: invite.organization.logoUrl,
      },
    });
  });

  // ─── POST /athlete/register — Complete registration ───────
  app.post('/athlete/register', async (request, reply) => {
    const parsed = registerFromInviteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const { token, password } = parsed.data;

    const invite = await app.prisma.athleteInvite.findUnique({
      where: { token },
      include: { athlete: true },
    });

    if (!invite || invite.status !== 'PENDING' || new Date() > invite.expiresAt) {
      return reply.status(410).send({
        success: false,
        error: { code: 'INVALID_INVITE', message: 'Invito non valido o scaduto' },
      });
    }

    // Check email not already registered
    const existingUser = await app.prisma.user.findUnique({
      where: { email: invite.email },
    });
    if (existingUser) {
      return reply.status(409).send({
        success: false,
        error: { code: 'CONFLICT', message: 'Email già registrata' },
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create user + accept invite in transaction
    const user = await app.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: invite.email,
          passwordHash,
          firstName: invite.athlete.firstName,
          lastName: invite.athlete.lastName,
          role: 'ATHLETE',
          organizationId: invite.organizationId,
          athleteId: invite.athleteId,
        },
      });

      // Registra le accettazioni versionate (ToS, informativa atleti,
      // consenso esplicito art. 9 GDPR ai dati sanitari, dichiarazione età)
      await tx.consentRecord.createMany({
        data: [
          { userId: newUser.id, docType: 'TERMS', docVersion: LEGAL_VERSIONS.TERMS, ipAddress: request.ip },
          { userId: newUser.id, docType: 'PRIVACY_ATHLETE_ACK', docVersion: LEGAL_VERSIONS.PRIVACY_ATHLETE, ipAddress: request.ip },
          { userId: newUser.id, docType: 'HEALTH_DATA', docVersion: LEGAL_VERSIONS.HEALTH_DATA, ipAddress: request.ip },
          { userId: newUser.id, docType: 'AGE_DECLARATION', docVersion: LEGAL_VERSIONS.PRIVACY_ATHLETE, ipAddress: request.ip },
        ],
      });

      await tx.athleteInvite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });

      return newUser;
    });

    // Generate JWT
    const tokenPayload = {
      userId: user.id,
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };
    const accessToken = app.jwt.sign(tokenPayload);
    const refreshToken = crypto.randomBytes(64).toString('hex');

    await app.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken, lastLoginAt: new Date() },
    });

    return reply.status(201).send({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          athleteId: user.athleteId,
        },
        accessToken,
        refreshToken,
      },
    });
  });

  // ═══════════════════════════════════════════════════════════
  // ATHLETE-ONLY ROUTES (require ATHLETE role)
  // ═══════════════════════════════════════════════════════════

  // ─── GET /athlete/profile — Own profile ───────────────────
  app.get('/athlete/profile', {
    preHandler: [app.authenticate, requireAthlete()],
  }, async (request, reply) => {
    const { userId } = request.user;

    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      include: {
        athlete: {
          include: {
            athleteTeams: {
              include: { team: { select: { id: true, name: true, color: true } } },
            },
          },
        },
        organization: { select: { id: true, name: true, logoUrl: true, sport: true } },
      },
    });

    if (!user || !user.athlete) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Profilo atleta non trovato' },
      });
    }

    return reply.send({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        // Lingua UI preferita: permette all'app atleti di ripristinarla
        // al riavvio anche su un dispositivo nuovo.
        locale: user.locale ?? undefined,
        athlete: {
          id: user.athlete.id,
          firstName: user.athlete.firstName,
          lastName: user.athlete.lastName,
          dateOfBirth: user.athlete.dateOfBirth,
          position: user.athlete.position,
          jerseyNumber: user.athlete.jerseyNumber,
          height: user.athlete.height,
          weight: user.athlete.weight,
          photoUrl: user.athlete.photoUrl,
          teams: user.athlete.athleteTeams.map((at) => at.team),
        },
        organization: user.organization,
      },
    });
  });

  // ─── GET /athlete/sessions — Weekly sessions + history ────
  app.get('/athlete/sessions', {
    preHandler: [app.authenticate, requireAthlete()],
  }, async (request, reply) => {
    const { userId } = request.user;
    const query = athleteSessionsQuerySchema.parse(request.query);

    // Get athlete profile to find athleteId and teams
    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: {
        athleteId: true,
        athlete: {
          select: {
            athleteTeams: { select: { teamId: true } },
          },
        },
      },
    });

    if (!user?.athleteId) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Profilo atleta non trovato' },
      });
    }

    const teamIds = user.athlete?.athleteTeams.map((at) => at.teamId) || [];

    // Build where: sessions assigned to this athlete OR to their teams
    const where: Record<string, unknown> = {
      OR: [
        { athleteId: user.athleteId },
        // Sessions in plans assigned to athlete's teams
        {
          week: {
            trainingPlan: {
              teamId: { in: teamIds },
            },
          },
        },
      ],
    };

    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.date = {};
      if (query.from) (where.date as Record<string, unknown>).gte = new Date(query.from);
      if (query.to) (where.date as Record<string, unknown>).lte = new Date(query.to);
    }

    const [sessions, total] = await Promise.all([
      app.prisma.trainingSession.findMany({
        where,
        include: {
          sessionExercises: {
            include: {
              exercise: {
                select: { id: true, name: true, category: true, description: true, videoUrl: true, muscleGroups: true },
              },
            },
            orderBy: { orderIndex: 'asc' },
          },
          sessionLogs: {
            where: { athleteId: user.athleteId },
            take: 1,
          },
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { date: 'desc' },
      }),
      app.prisma.trainingSession.count({ where }),
    ]);

    // Map sessions with athlete-specific data
    const data = sessions.map((s) => ({
      ...s,
      myLog: s.sessionLogs[0] || null,
      sessionLogs: undefined, // remove raw array
    }));

    return reply.send({
      success: true,
      data,
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  });

  // ─── GET /athlete/sessions/:id — Session detail ──────────
  app.get<{ Params: { id: string } }>('/athlete/sessions/:id', {
    preHandler: [app.authenticate, requireAthlete()],
  }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;

    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { athleteId: true },
    });

    if (!user?.athleteId) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Profilo atleta non trovato' },
      });
    }

    const session = await app.prisma.trainingSession.findUnique({
      where: { id },
      include: {
        sessionExercises: {
          include: {
            exercise: true,
          },
          orderBy: { orderIndex: 'asc' },
        },
        week: {
          include: {
            trainingPlan: { select: { name: true, athleteId: true, teamId: true } },
          },
        },
      },
    });

    if (!session) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sessione non trovata' },
      });
    }

    // Mark as viewed (upsert SessionLog with viewedAt)
    await app.prisma.sessionLog.upsert({
      where: {
        trainingSessionId_athleteId: {
          trainingSessionId: id,
          athleteId: user.athleteId,
        },
      },
      update: {
        viewedAt: new Date(),
      },
      create: {
        trainingSessionId: id,
        athleteId: user.athleteId,
        viewedAt: new Date(),
      },
    });

    const myLog = await app.prisma.sessionLog.findUnique({
      where: {
        trainingSessionId_athleteId: {
          trainingSessionId: id,
          athleteId: user.athleteId,
        },
      },
    });

    return reply.send({
      success: true,
      data: { ...session, myLog },
    });
  });

  // ─── POST /athlete/session-log — Submit RPE + notes ───────
  app.post('/athlete/session-log', {
    preHandler: [app.authenticate, requireAthlete()],
  }, async (request, reply) => {
    const parsed = athleteSessionLogSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const { userId } = request.user;
    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { athleteId: true },
    });

    if (!user?.athleteId) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Profilo atleta non trovato' },
      });
    }

    const { trainingSessionId, actualRpe, notes, exerciseChecks } = parsed.data;

    const log = await app.prisma.sessionLog.upsert({
      where: {
        trainingSessionId_athleteId: {
          trainingSessionId,
          athleteId: user.athleteId,
        },
      },
      update: {
        actualRpe,
        notes,
        exerciseChecks: exerciseChecks || undefined,
      },
      create: {
        trainingSessionId,
        athleteId: user.athleteId,
        actualRpe,
        notes,
        exerciseChecks: exerciseChecks || undefined,
      },
    });

    return reply.status(201).send({ success: true, data: log });
  });

  // ─── POST /athlete/wellness — Submit daily wellness ───────
  app.post('/athlete/wellness', {
    preHandler: [app.authenticate, requireAthlete()],
  }, async (request, reply) => {
    const parsed = athleteWellnessSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const { userId } = request.user;
    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { athleteId: true },
    });

    if (!user?.athleteId) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Profilo atleta non trovato' },
      });
    }

    const { date, mediaUrls, ...wellnessData } = parsed.data;

    const log = await app.prisma.wellnessLog.upsert({
      where: {
        athleteId_date: {
          athleteId: user.athleteId,
          date: new Date(date),
        },
      },
      update: {
        ...wellnessData,
        mediaUrls: mediaUrls || [],
        submittedBy: 'athlete',
      },
      create: {
        athleteId: user.athleteId,
        date: new Date(date),
        ...wellnessData,
        mediaUrls: mediaUrls || [],
        submittedBy: 'athlete',
      },
    });

    return reply.status(201).send({ success: true, data: log });
  });

  // ─── GET /athlete/wellness — Own wellness history ─────────
  app.get('/athlete/wellness', {
    preHandler: [app.authenticate, requireAthlete()],
  }, async (request, reply) => {
    const { userId } = request.user;
    const query = athleteWellnessQuerySchema.parse(request.query);

    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { athleteId: true },
    });

    if (!user?.athleteId) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Profilo atleta non trovato' },
      });
    }

    const where: Record<string, unknown> = { athleteId: user.athleteId };
    if (query.from || query.to) {
      where.date = {};
      if (query.from) (where.date as Record<string, unknown>).gte = new Date(query.from);
      if (query.to) (where.date as Record<string, unknown>).lte = new Date(query.to);
    }

    const [logs, total] = await Promise.all([
      app.prisma.wellnessLog.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { date: 'desc' },
      }),
      app.prisma.wellnessLog.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: logs,
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  });

  // ─── GET /athlete/notifications — Own notifications ───────
  app.get('/athlete/notifications', {
    preHandler: [app.authenticate, requireAthlete()],
  }, async (request, reply) => {
    const { userId } = request.user;

    const notifications = await app.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return reply.send({ success: true, data: notifications });
  });

  // ─── POST /athlete/notifications/read — Mark as read ──────
  app.post<{ Body: { ids: string[] } }>('/athlete/notifications/read', {
    preHandler: [app.authenticate, requireAthlete()],
  }, async (request, reply) => {
    const { userId } = request.user;
    const { ids } = request.body as { ids: string[] };

    await app.prisma.notification.updateMany({
      where: { id: { in: ids }, userId },
      data: { isRead: true, readAt: new Date() },
    });

    return reply.send({ success: true });
  });

  // ─── POST /athlete/push-subscription — Save push sub ──────
  app.post('/athlete/push-subscription', {
    preHandler: [app.authenticate, requireAthlete()],
  }, async (request, reply) => {
    const parsed = pushSubscriptionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Sottoscrizione push non valida' },
      });
    }

    const { userId } = request.user;

    await app.prisma.user.update({
      where: { id: userId },
      data: { pushSubscription: parsed.data },
    });

    return reply.status(201).send({ success: true });
  });
}

// ─── Template email invito atleta ────────────────────────────
function buildAthleteInviteHtml(opts: { athleteName: string; orgName: string; inviteLink: string }): string {
  const safeName = escapeHtml(opts.athleteName);
  const safeOrg = escapeHtml(opts.orgName);
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f7; margin: 0; padding: 24px; color: #0f172a;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <h1 style="margin: 0 0 8px 0; font-size: 22px; color: #0f766e;">Ciao ${safeName},</h1>
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #334155;">
      <strong>${safeOrg}</strong> ti ha invitato su <strong>TrainMind AI</strong>, l'app per comunicare col tuo preparatore, registrare il tuo benessere quotidiano e seguire i tuoi allenamenti.
    </p>
    <p style="text-align: center; margin: 28px 0;">
      <a href="${opts.inviteLink}" style="display: inline-block; padding: 14px 28px; background: #0f766e; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
        Crea il tuo account
      </a>
    </p>
    <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.6; color: #64748b;">
      Il link è valido per 7 giorni. Se il pulsante non funziona, copia e incolla questo indirizzo nel browser:
    </p>
    <p style="margin: 0 0 24px 0; font-size: 12px; word-break: break-all; color: #475569;">
      <a href="${opts.inviteLink}" style="color: #0f766e;">${opts.inviteLink}</a>
    </p>
    <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">
      💡 Dopo la registrazione, dal tuo telefono puoi installare TrainMind come app: apri il menu del browser e scegli "Aggiungi a schermata Home".
    </p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
    <p style="margin: 0; font-size: 12px; color: #94a3b8;">
      Se non ti aspettavi questa email, puoi ignorarla: l'invito scadrà automaticamente.
    </p>
  </div>
</body>
</html>`;
}

function buildAthleteInviteText(opts: { athleteName: string; orgName: string; inviteLink: string }): string {
  return `Ciao ${opts.athleteName},

${opts.orgName} ti ha invitato su TrainMind AI.

Crea il tuo account cliccando qui:
${opts.inviteLink}

Il link è valido per 7 giorni.

Dopo la registrazione, dal tuo telefono puoi installare TrainMind come app: apri il menu del browser e scegli "Aggiungi a schermata Home".

— Team TrainMind`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
