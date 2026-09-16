/**
 * Staff di un'organizzazione: chi c'e', chi e' stato invitato, quanti posti
 * restano.
 *
 * Il punto di tutto il file: in un'organizzazione gia' esistente si entra
 * SOLO da qui. La registrazione normale (`/auth/register`) crea sempre
 * un'organizzazione nuova con uno slug unico, quindi digitare il nome della
 * societa' di qualcun altro non porta da nessuna parte — nessun calendario
 * condiviso per sbaglio, nessun dato altrui.
 *
 *   GET    /staff                     elenco membri + inviti + posti
 *   POST   /staff/invite              invita un collega (solo ADMIN)
 *   POST   /staff/invite/:id/revoke   revoca un invito in sospeso (ADMIN)
 *   POST   /staff/members/:id/disable disattiva un membro e libera il posto
 *   GET    /staff/invite/:token       lettura pubblica dell'invito
 *   POST   /staff/register            completamento registrazione da invito
 */

import type { FastifyInstance } from 'fastify';
import { Prisma } from '@trainmind/db';
import bcrypt from 'bcrypt';
import { requireRole } from '../middleware/rbac.js';
import { createStaffInviteSchema, staffRegisterSchema } from '../schemas/staff.js';
import {
  getSeatUsage,
  assertSeatAvailable,
  NoSeatAvailableError,
  SEAT_ROLES,
} from '../lib/seats.js';
import { issueRefreshToken, revokeAllRefreshTokens } from '../lib/refresh-tokens.js';
import { LEGAL_VERSIONS } from '../lib/legal.js';
import { sendEmail } from '../services/email-service.js';
import { appPublicUrl } from '../lib/app-url.js';

const SALT_ROUNDS = 12;
const INVITE_TTL_DAYS = 7;

export async function staffRoutes(app: FastifyInstance) {
  // ═══════════════════════════════════════════════════════
  // LATO ORGANIZZAZIONE
  // ═══════════════════════════════════════════════════════

  // ─── GET /staff — membri, inviti e posti ───────────────
  //
  // Leggibile da chiunque sia dentro: sapere con chi si condivide il
  // calendario non e' un privilegio amministrativo, e' il minimo per capire
  // cosa sta succedendo ai propri dati.
  app.get('/staff', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { organizationId } = request.user;

    const [members, invites, seats] = await Promise.all([
      app.prisma.user.findMany({
        where: {
          organizationId,
          deletedAt: null,
          role: { in: [...SEAT_ROLES] },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
      }),
      app.prisma.staffInvite.findMany({
        where: { organizationId, status: 'PENDING', expiresAt: { gt: new Date() } },
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      getSeatUsage(app.prisma, organizationId),
    ]);

    return reply.send({ success: true, data: { members, invites, seats } });
  });

  // ─── POST /staff/invite — invita un collega ────────────
  app.post('/staff/invite', {
    preHandler: [app.authenticate, requireRole('ADMIN')],
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = createStaffInviteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dati non validi',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const { role } = parsed.data;
    const { userId, organizationId } = request.user;

    // Un indirizzo appartiene a un solo account, e un account a una sola
    // organizzazione. Spostare un utente esistente qui dentro sembrerebbe
    // comodo, ma lascerebbe dietro di se' i suoi eventi di calendario, le sue
    // schede e i suoi report nell'organizzazione di partenza, che punterebbero
    // a un utente che non c'e' piu'. Meglio dirlo chiaramente.
    const existingUser = await app.prisma.user.findUnique({
      where: { email },
      select: { id: true, organizationId: true },
    });
    if (existingUser) {
      const sameOrg = existingUser.organizationId === organizationId;
      return reply.status(409).send({
        success: false,
        error: {
          code: sameOrg ? 'ALREADY_MEMBER' : 'EMAIL_IN_USE',
          message: sameOrg
            ? 'Questa persona fa gia\' parte del tuo staff'
            : 'Questo indirizzo ha gia\' un account TrainMind. Per unirsi alla tua organizzazione deve prima chiudere quello esistente.',
        },
      });
    }

    try {
      await assertSeatAvailable(app.prisma, organizationId);
    } catch (err) {
      if (err instanceof NoSeatAvailableError) {
        // 402 e non 403: non e' un permesso che manca, e' un posto da
        // comprare. Il frontend distingue i due casi per mostrare l'upsell
        // invece di un messaggio di errore.
        return reply.status(402).send({
          success: false,
          error: {
            code: 'NO_SEAT_AVAILABLE',
            message: 'Hai esaurito i posti del tuo piano',
            seats: err.usage,
          },
        });
      }
      throw err;
    }

    const invite = await app.prisma.$transaction(async (tx) => {
      // Un solo invito valido per indirizzo: reinvitare qualcuno deve
      // sostituire il vecchio link, non affiancarne un secondo ancora buono.
      await tx.staffInvite.updateMany({
        where: { organizationId, email, status: 'PENDING' },
        data: { status: 'REVOKED' },
      });

      return tx.staffInvite.create({
        data: {
          email,
          role,
          invitedById: userId,
          organizationId,
          expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
        },
      });
    });

    // appPublicUrl() e non process.env.APP_URL: in produzione quella
    // variabile non esiste e il link finiva su localhost, cioe' sulla
    // macchina di chi riceveva l'invito.
    const inviteLink = `${appPublicUrl()}/register?staff=${invite.token}`;

    const [org, inviter] = await Promise.all([
      app.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      }),
      app.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      }),
    ]);
    const orgName = org?.name || 'TrainMind';
    const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}`.trim() : orgName;

    sendEmail(
      {
        to: [email],
        subject: `${inviterName} invited you to join ${orgName} on TrainMind`,
        html: buildStaffInviteHtml({ inviterName, orgName, inviteLink, role }),
        text: buildStaffInviteText({ inviterName, orgName, inviteLink }),
      },
      request.log,
    ).catch((err) => request.log.error({ err }, 'Staff invite email failed'));

    return reply.status(201).send({
      success: true,
      data: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
        inviteLink,
        // Riletti, non ricalcolati a mano: l'invito appena creato conta gia'
        // come posto occupato e il client deve vedere il numero vero.
        seats: await getSeatUsage(app.prisma, organizationId),
      },
    });
  });

  // ─── POST /staff/invite/:id/revoke ─────────────────────
  app.post<{ Params: { id: string } }>('/staff/invite/:id/revoke', {
    preHandler: [app.authenticate, requireRole('ADMIN')],
  }, async (request, reply) => {
    const { organizationId } = request.user;

    const invite = await app.prisma.staffInvite.findFirst({
      where: { id: request.params.id, organizationId, status: 'PENDING' },
    });
    if (!invite) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invito non trovato' },
      });
    }

    await app.prisma.staffInvite.update({
      where: { id: invite.id },
      data: { status: 'REVOKED' },
    });

    return reply.send({
      success: true,
      data: { seats: await getSeatUsage(app.prisma, organizationId) },
    });
  });

  // ─── POST /staff/members/:id/disable ───────────────────
  //
  // Disattiva, non cancella. I dati di un preparatore che se ne va — eventi
  // di calendario, schede, report firmati — restano dell'organizzazione e
  // continuano a puntare a lui: cancellare la riga li lascerebbe orfani. Il
  // posto, pero', torna libero subito.
  app.post<{ Params: { id: string } }>('/staff/members/:id/disable', {
    preHandler: [app.authenticate, requireRole('ADMIN')],
  }, async (request, reply) => {
    const { organizationId, userId } = request.user;
    const targetId = request.params.id;

    if (targetId === userId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'CANNOT_DISABLE_SELF', message: 'Non puoi disattivare il tuo stesso account' },
      });
    }

    const target = await app.prisma.user.findFirst({
      where: { id: targetId, organizationId, deletedAt: null, role: { in: [...SEAT_ROLES] } },
      select: { id: true, role: true, isActive: true },
    });
    if (!target) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Membro non trovato' },
      });
    }

    // Un'organizzazione senza amministratori attivi non puo' piu' invitare
    // nessuno ne' gestire l'abbonamento: si chiuderebbe fuori da sola.
    if (target.role === 'ADMIN' && target.isActive) {
      const otherAdmins = await app.prisma.user.count({
        where: {
          organizationId,
          role: 'ADMIN',
          isActive: true,
          deletedAt: null,
          id: { not: targetId },
        },
      });
      if (otherAdmins === 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'LAST_ADMIN',
            message: 'Deve restare almeno un amministratore attivo',
          },
        });
      }
    }

    await app.prisma.user.update({ where: { id: targetId }, data: { isActive: false } });
    // Disattivare senza chiudere le sessioni aperte non disattiva niente: il
    // token di accesso resta valido fino alla scadenza.
    await revokeAllRefreshTokens(app.prisma, targetId);

    return reply.send({
      success: true,
      data: { seats: await getSeatUsage(app.prisma, organizationId) },
    });
  });

  // ═══════════════════════════════════════════════════════
  // LATO INVITATO (pubblico)
  // ═══════════════════════════════════════════════════════

  // ─── GET /staff/invite/:token ──────────────────────────
  app.get<{ Params: { token: string } }>('/staff/invite/:token', async (request, reply) => {
    const invite = await app.prisma.staffInvite.findUnique({
      where: { token: request.params.token },
      include: { organization: { select: { name: true, logoUrl: true } } },
    });

    if (!invite) {
      return reply.status(404).send({
        success: false,
        error: { code: 'INVITE_NOT_FOUND', message: 'Invito non trovato' },
      });
    }

    // Un codice per stato, invece del generico GONE con dentro il valore
    // dell'enum: quello stampava "Invito gia' revoked" — italiano con dentro
    // una parola inglese, su una pagina che puo' essere in tre lingue. Il
    // codice e' stabile e la traduzione sta nel client (apiErrors.*).
    if (invite.status !== 'PENDING') {
      const codeByStatus = {
        REVOKED: 'INVITE_REVOKED',
        ACCEPTED: 'INVITE_ACCEPTED',
        EXPIRED: 'INVITE_EXPIRED',
      } as const;
      const code = codeByStatus[invite.status as keyof typeof codeByStatus] ?? 'INVALID_INVITE';
      return reply.status(410).send({
        success: false,
        error: { code, message: 'Invito non piu\' valido' },
      });
    }

    if (new Date() > invite.expiresAt) {
      await app.prisma.staffInvite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' },
      });
      return reply.status(410).send({
        success: false,
        error: { code: 'INVITE_EXPIRED', message: 'Invito scaduto' },
      });
    }

    return reply.send({
      success: true,
      data: {
        email: invite.email,
        role: invite.role,
        organizationName: invite.organization.name,
        organizationLogo: invite.organization.logoUrl,
        expiresAt: invite.expiresAt,
      },
    });
  });

  // ─── POST /staff/register ──────────────────────────────
  app.post('/staff/register', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
  }, async (request, reply) => {
    const parsed = staffRegisterSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dati non validi',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const {
      token,
      password,
      firstName,
      lastName,
      dateOfBirth,
      consentHealthData,
      acceptMarketing,
      uiLanguage,
    } = parsed.data;

    const invite = await app.prisma.staffInvite.findUnique({ where: { token } });
    if (!invite || invite.status !== 'PENDING' || new Date() > invite.expiresAt) {
      return reply.status(410).send({
        success: false,
        error: { code: 'INVALID_INVITE', message: 'Invito non valido o scaduto' },
      });
    }

    const existingUser = await app.prisma.user.findUnique({ where: { email: invite.email } });
    if (existingUser) {
      return reply.status(409).send({
        success: false,
        error: { code: 'EMAIL_ALREADY_REGISTERED', message: 'Email gia\' registrata' },
      });
    }

    // Secondo controllo sul posto. Fra l'invio dell'invito e questo momento
    // possono essere passati giorni: il piano puo' essere stato declassato, o
    // i posti riempiti da altri inviti partiti dopo. Senza questo controllo
    // basterebbe tenere un link in tasca per entrare su un posto che non
    // esiste piu'.
    try {
      await assertSeatAvailable(app.prisma, invite.organizationId, { ignoreInviteId: invite.id });
    } catch (err) {
      if (err instanceof NoSeatAvailableError) {
        return reply.status(402).send({
          success: false,
          error: {
            code: 'NO_SEAT_AVAILABLE',
            message: 'L\'organizzazione ha esaurito i posti disponibili. Contatta chi ti ha invitato.',
          },
        });
      }
      throw err;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userAgent = request.headers['user-agent'] ?? null;
    const baseAudit = { ipAddress: request.ip, userAgent, language: uiLanguage };

    const user = await app.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: invite.email,
          passwordHash,
          firstName,
          lastName,
          role: invite.role,
          organizationId: invite.organizationId,
          locale: uiLanguage,
        },
      });

      const consents: Array<{
        userId: string;
        docType: string;
        docVersion: string;
        ipAddress: string | null;
        userAgent: string | null;
        language: string | null;
        metadata?: Prisma.InputJsonValue;
      }> = [
        { userId: newUser.id, docType: 'TERMS', docVersion: LEGAL_VERSIONS.TERMS, ...baseAudit },
        { userId: newUser.id, docType: 'PRIVACY_ACK', docVersion: LEGAL_VERSIONS.PRIVACY, ...baseAudit },
        {
          userId: newUser.id,
          docType: 'AGE_DECLARATION',
          docVersion: LEGAL_VERSIONS.PRIVACY,
          ...baseAudit,
          metadata: { dateOfBirth } as Prisma.InputJsonValue,
        },
        {
          userId: newUser.id,
          docType: 'HEALTH_DATA',
          docVersion: LEGAL_VERSIONS.HEALTH_DATA,
          ...baseAudit,
          metadata: { granted: consentHealthData } as Prisma.InputJsonValue,
        },
      ];
      if (acceptMarketing) {
        consents.push({
          userId: newUser.id,
          docType: 'MARKETING',
          docVersion: LEGAL_VERSIONS.MARKETING,
          ...baseAudit,
        });
      }
      await tx.consentRecord.createMany({ data: consents });

      await tx.staffInvite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });

      return newUser;
    });

    const accessToken = app.jwt.sign({
      userId: user.id,
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });
    const refreshToken = await issueRefreshToken(app.prisma, user.id, request.headers['user-agent']);

    await app.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const organization = await app.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { id: true, name: true, slug: true, sport: true, tier: true },
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
          locale: user.locale ?? undefined,
          organizationId: user.organizationId,
          organization,
        },
        // Stessa forma di /auth/register: il client riusa tale e quale il
        // codice che salva i token, senza un ramo a parte per gli invitati.
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 900,
        },
      },
    });
  });
}

// ─── Email ───────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'administrator',
  TRAINER: 'strength coach',
  MEDICAL: 'medical staff',
  VIEWER: 'viewer',
};

function buildStaffInviteHtml(opts: {
  inviterName: string;
  orgName: string;
  inviteLink: string;
  role: string;
}): string {
  const safeInviter = escapeHtml(opts.inviterName);
  const safeOrg = escapeHtml(opts.orgName);
  const safeRole = escapeHtml(ROLE_LABELS[opts.role] || 'staff member');
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f7; margin: 0; padding: 24px; color: #0f172a;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <h1 style="margin: 0 0 8px 0; font-size: 22px; color: #0f766e;">Join ${safeOrg} on TrainMind</h1>
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #334155;">
      <strong>${safeInviter}</strong> invited you to <strong>${safeOrg}</strong> as <strong>${safeRole}</strong>.
      You will share the same calendar, athletes and reports.
    </p>
    <p style="text-align: center; margin: 28px 0;">
      <a href="${opts.inviteLink}" style="display: inline-block; padding: 14px 28px; background: #0f766e; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
        Create your account
      </a>
    </p>
    <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.6; color: #64748b;">
      The link is valid for 7 days. If the button doesn't work, copy and paste this address into your browser:
    </p>
    <p style="margin: 0 0 24px 0; font-size: 12px; word-break: break-all; color: #475569;">
      <a href="${opts.inviteLink}" style="color: #0f766e;">${opts.inviteLink}</a>
    </p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
    <p style="margin: 0; font-size: 12px; color: #94a3b8;">
      If you weren't expecting this email you can ignore it: the invitation will expire on its own.
    </p>
  </div>
</body>
</html>`;
}

function buildStaffInviteText(opts: {
  inviterName: string;
  orgName: string;
  inviteLink: string;
}): string {
  return `${opts.inviterName} invited you to join ${opts.orgName} on TrainMind.

Create your account here:
${opts.inviteLink}

The link is valid for 7 days.

— The TrainMind team`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
