import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Prisma } from '@trainmind/db';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas/auth.js';
import type {
  RegisterInput,
  LoginInput,
  RefreshInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '../schemas/auth.js';
import { seedDefaultExercises } from '../lib/seed-default-exercises.js';
import { LEGAL_VERSIONS } from '../lib/legal.js';
import { sendEmail, buildPasswordResetEmailHtml, getAuthFrom } from '../services/email-service.js';
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
} from '../lib/refresh-tokens.js';

const SALT_ROUNDS = 12;

/** Validita' del link di reset. Breve per limitare la finestra di attacco. */
const RESET_TOKEN_TTL_MINUTES = 60;

/**
 * Nel DB salviamo solo l'hash SHA-256 del token di reset.
 * Il token in chiaro esiste unicamente nel link inviato per email.
 */
function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Impronta breve e non reversibile di un indirizzo email, da usare nei log.
 *
 * Perche' non loggare l'email in chiaro: i log finiscono spesso in aggregatori
 * esterni, con accessi piu' larghi di quelli al database. Su un servizio che
 * tratta dati sanitari, l'elenco di chi ha tentato un reset e' di per se' un
 * dato personale che non serve conservare in forma leggibile.
 *
 * Perche' un'impronta e non la semplice rimozione: a parita' di indirizzo il
 * valore e' sempre lo stesso, quindi resta possibile riconoscere tentativi
 * ripetuti sullo stesso account — che e' l'unica cosa per cui quel log serve.
 */
function emailFingerprint(email: string): string {
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 12);
}

export async function authRoutes(app: FastifyInstance) {
  // Limiti per rotta sulle credenziali.
  //
  // Il limite globale (100/min) non basta: qui non c'e' blocco dell'account
  // dopo N tentativi falliti, quindi questo e' l'unica cosa fra un attacco a
  // dizionario e le password degli utenti. Venti in un quarto d'ora e' largo
  // per chi sbaglia a digitare e per uno staff dietro lo stesso IP, stretto
  // per chi prova un elenco.
  //
  // Valgono solo se `trustProxy` e' attivo in app.ts: senza, dietro il proxy
  // farebbero da tetto unico per tutta la piattaforma invece che per utente.
  const loginLimit = { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } };
  const registerLimit = { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } };

  /**
   * Le registrazioni sono aperte?
   *
   * `DISABLE_REGISTRATION=true` chiude la porta al pubblico. Ma durante i test
   * di produzione serve poter creare account passando dal flusso VERO — con
   * email, consensi versionati e seed degli esercizi — non fabbricandoli in
   * SQL, che verificherebbe tutto tranne cio' che gli utenti faranno davvero.
   *
   * Da qui il cancello: chi presenta il token in `x-registration-token` passa
   * anche a porta chiusa. Il token vive solo in `.env.deploy`: senza
   * `REGISTRATION_ACCESS_TOKEN` impostata non esiste scorciatoia, e chiuso
   * vuol dire chiuso.
   *
   * Il confronto e' a tempo costante: un `===` su stringhe esce al primo
   * carattere diverso, e la differenza di tempo fra un tentativo e l'altro
   * lascia indovinare il token un carattere per volta.
   */
  function registrationAllowed(request: FastifyRequest): boolean {
    if (process.env.DISABLE_REGISTRATION !== 'true') return true;

    const expected = process.env.REGISTRATION_ACCESS_TOKEN;
    if (!expected) return false;

    const raw = request.headers['x-registration-token'];
    const provided = Array.isArray(raw) ? raw[0] : raw;
    if (!provided) return false;

    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  // ─── POST /auth/register ────────────────────────────
  app.post<{ Body: RegisterInput }>('/auth/register', registerLimit, async (request, reply) => {
    // Interruttore per chiudere le registrazioni pubbliche (fase di test)
    if (!registrationAllowed(request)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'REGISTRATION_DISABLED',
          message: 'Le registrazioni sono momentaneamente chiuse. Contatta l\'amministratore.',
        },
      });
    }

    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dati di registrazione non validi',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const {
      email,
      password,
      firstName,
      lastName,
      organizationName,
      dateOfBirth,
      consentHealthData,
      acceptMarketing,
      uiLanguage,
      plan,
      attribution,
    } = parsed.data;

    const userAgent = request.headers['user-agent'] ?? null;

    // Check if user already exists
    const existingUser = await app.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'Un account con questa email esiste gia',
        },
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create organization + user in transaction
    const slug = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Il piano scelto in registrazione diventa il tier dell'organizzazione.
    // Lo schema garantisce uno dei tre valori, con starter come default.
    const PLAN_TO_TIER = {
      starter: 'STARTER',
      professional: 'PROFESSIONAL',
      ultra: 'ULTRA',
    } as const;
    const tier = PLAN_TO_TIER[plan];

    const result = await app.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          slug: `${slug}-${Date.now().toString(36)}`,
          sport: 'basketball',
          tier,
          // Provenienza dell'iscrizione. Le tre colonne dedicate sono quelle su
          // cui la console raggruppa; il resto sta nel JSON, che non ha bisogno
          // di una migrazione ogni volta che nasce un parametro nuovo.
          utmSource: attribution?.utmSource ?? null,
          utmMedium: attribution?.utmMedium ?? null,
          utmCampaign: attribution?.utmCampaign ?? null,
          signupReferrer: attribution?.referrer ?? null,
          signupAttribution: attribution
            ? ({
                utmTerm: attribution.utmTerm ?? null,
                utmContent: attribution.utmContent ?? null,
                landing: attribution.landing ?? null,
              } as Prisma.InputJsonValue)
            : undefined,
        },
      });

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          role: 'ADMIN',
          organizationId: organization.id,
          // La lingua scelta sulla landing/registrazione diventa la lingua
          // di default dell'account su qualsiasi dispositivo. Se il client
          // non la manda si usa l'inglese, come nell'interfaccia.
          locale: uiLanguage ?? 'en',
        },
      });

      // ─── Proof-of-consent versionato ───────────────────────
      // Salviamo ogni consenso con: versione documento, IP, User-Agent, lingua UI
      // e (per HEALTH_DATA/MARKETING) valore esplicito. Metadata utile per audit.
      const baseAudit = {
        ipAddress: request.ip,
        userAgent,
        language: uiLanguage,
      };

      const consents: Array<{
        userId: string;
        docType: string;
        docVersion: string;
        ipAddress: string | null;
        userAgent: string | null;
        language: string | null;
        metadata?: Prisma.InputJsonValue;
      }> = [
        {
          userId: user.id,
          docType: 'TERMS',
          docVersion: LEGAL_VERSIONS.TERMS,
          ...baseAudit,
        },
        {
          userId: user.id,
          docType: 'PRIVACY_ACK',
          docVersion: LEGAL_VERSIONS.PRIVACY,
          ...baseAudit,
        },
        {
          userId: user.id,
          docType: 'AGE_DECLARATION',
          docVersion: LEGAL_VERSIONS.PRIVACY,
          ...baseAudit,
          metadata: { dateOfBirth } as Prisma.InputJsonValue,
        },
      ];

      // HEALTH_DATA: opt-in esplicito (art. 9 GDPR). Registriamo sempre l'esito
      // della scelta dell'utente per tracciarne l'origine.
      consents.push({
        userId: user.id,
        docType: 'HEALTH_DATA',
        docVersion: LEGAL_VERSIONS.HEALTH_DATA,
        ...baseAudit,
        metadata: { granted: consentHealthData } as Prisma.InputJsonValue,
      });

      if (acceptMarketing) {
        consents.push({
          userId: user.id,
          docType: 'MARKETING',
          docVersion: LEGAL_VERSIONS.MARKETING,
          ...baseAudit,
        });
      }

      await tx.consentRecord.createMany({ data: consents });

      return { user, organization };
    });

    // Seed default exercises for the new org (fire-and-forget)
    seedDefaultExercises(app.prisma, result.organization.id).catch(() => {
      /* non-critical */
    });

    // Generate tokens
    const payload = {
      userId: result.user.id,
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
      organizationId: result.user.organizationId,
    };

    const accessToken = app.jwt.sign(payload);
    const refreshToken = await issueRefreshToken(
      app.prisma,
      result.user.id,
      request.headers['user-agent'],
    );

    await app.prisma.user.update({
      where: { id: result.user.id },
      data: { lastLoginAt: new Date() },
    });

    return reply.status(201).send({
      success: true,
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role,
          locale: result.user.locale ?? undefined,
          organizationId: result.user.organizationId,
          organization: {
            id: result.organization.id,
            name: result.organization.name,
            slug: result.organization.slug,
            sport: result.organization.sport,
            tier: result.organization.tier,
          },
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 900, // 15 minutes in seconds
        },
      },
    });
  });

  // ─── POST /auth/login ──────────────────────────────
  app.post<{ Body: LoginInput }>('/auth/login', loginLimit, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dati di login non validi',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const { email, password } = parsed.data;

    // Find user (include organization so the client gets the tier immediately on login)
    const user = await app.prisma.user.findUnique({
      where: { email },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, sport: true, tier: true },
        },
      },
    });
    if (!user || !user.isActive) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email o password non corretti',
        },
      });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email o password non corretti',
        },
      });
    }

    // Generate tokens
    const payload: {
      userId: string;
      id: string;
      email: string;
      role: string;
      organizationId: string;
      athleteId?: string;
    } = {
      userId: user.id,
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };
    // Include athleteId in JWT for ATHLETE users
    if (user.athleteId) payload.athleteId = user.athleteId;

    const accessToken = app.jwt.sign(payload);
    const refreshToken = await issueRefreshToken(
      app.prisma,
      user.id,
      request.headers['user-agent'],
    );

    await app.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return reply.send({
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
          athleteId: user.athleteId || undefined,
          organization: user.organization
            ? {
                id: user.organization.id,
                name: user.organization.name,
                slug: user.organization.slug,
                sport: user.organization.sport,
                tier: user.organization.tier,
              }
            : undefined,
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 900,
        },
      },
    });
  });

  // ─── POST /auth/refresh ────────────────────────────
  app.post<{ Body: RefreshInput }>('/auth/refresh', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Refresh token richiesto',
        },
      });
    }

    const { refreshToken } = parsed.data;

    // Ruota la sessione: il token ricevuto viene revocato e sostituito, le
    // altre sessioni dello stesso utente restano vive.
    const rotated = await rotateRefreshToken(
      app.prisma,
      refreshToken,
      request.headers['user-agent'],
    );

    if (!rotated) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token non valido o scaduto',
        },
      });
    }

    const user = await app.prisma.user.findUnique({ where: { id: rotated.userId } });

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token non valido o scaduto',
        },
      });
    }

    const payload: {
      userId: string;
      id: string;
      email: string;
      role: string;
      organizationId: string;
      athleteId?: string;
    } = {
      userId: user.id,
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };
    // Come al login: senza questa riga un atleta, dopo il primo refresh, si
    // ritrova un token privo di athleteId e ogni endpoint che lo legge dal JWT
    // smette di funzionare.
    if (user.athleteId) payload.athleteId = user.athleteId;

    const newAccessToken = app.jwt.sign(payload);

    return reply.send({
      success: true,
      data: {
        tokens: {
          accessToken: newAccessToken,
          refreshToken: rotated.refreshToken,
          expiresIn: 900,
        },
      },
    });
  });

  // ─── GET /auth/me ──────────────────────────────────
  app.get('/auth/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user;

    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        locale: true,
        organizationId: true,
        isActive: true,
        createdAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            sport: true,
            tier: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Utente non trovato',
        },
      });
    }

    return reply.send({
      success: true,
      data: { user },
    });
  });

  // ─── POST /auth/logout ─────────────────────────────
  app.post<{ Body?: { refreshToken?: string } }>(
    '/auth/logout',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;

      // Se il client manda il proprio refresh token si chiude solo quella
      // sessione: uscire dal telefono non deve buttare fuori anche il
      // portatile. Senza token si chiude tutto, come prima.
      const token = request.body?.refreshToken;
      if (token) {
        await revokeRefreshToken(app.prisma, token);
      } else {
        await revokeAllRefreshTokens(app.prisma, userId);
      }

      return reply.send({
        success: true,
        data: { message: 'Logout effettuato con successo' },
      });
    },
  );

  // ─── PATCH /auth/locale ────────────────────────────
  // Salva la lingua UI preferita sul profilo, cosi segue l'utente su ogni
  // dispositivo. Chiamata al login e a ogni cambio lingua in Impostazioni.
  app.patch<{ Body: { locale?: string } }>(
    '/auth/locale',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const locale = request.body?.locale;

      if (locale !== 'it' && locale !== 'en' && locale !== 'es') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Lingua non supportata (valori ammessi: it, en, es)',
          },
        });
      }

      await app.prisma.user.update({
        where: { id: userId },
        data: { locale },
      });

      return reply.send({ success: true, data: { locale } });
    },
  );

  // ─── POST /auth/change-password ────────────────────
  // Utente autenticato che conosce la password attuale.
  app.post<{ Body: ChangePasswordInput }>(
    '/auth/change-password',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = changePasswordSchema.safeParse(request.body);
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

      const { userId } = request.user;
      const { currentPassword, newPassword } = parsed.data;

      const user = await app.prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.isActive) {
        return reply.status(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'Utente non trovato' },
        });
      }

      const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!validPassword) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'La password attuale non e corretta',
          },
        });
      }

      const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

      // Tutte le sessioni cadono: chi conosceva la vecchia password non deve
      // restare dentro da nessun dispositivo.
      await app.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          resetTokenHash: null,
          resetTokenExpiry: null,
        },
      });
      await revokeAllRefreshTokens(app.prisma, userId);

      request.log.info({ userId }, 'Password cambiata dall utente');

      return reply.send({
        success: true,
        data: {
          message:
            'Password aggiornata. Per sicurezza le altre sessioni sono state disconnesse.',
        },
      });
    },
  );

  // ─── POST /auth/forgot-password ────────────────────
  // Genera un token monouso e invia il link via email.
  app.post<{ Body: ForgotPasswordInput }>(
    '/auth/forgot-password',
    {
      // Limite stretto: senza, questo endpoint diventa un mezzo per
      // bombardare di email un indirizzo altrui.
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
    const parsed = forgotPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email non valida',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const { email } = parsed.data;

    // Risposta SEMPRE identica, esista o no l'account: altrimenti questo
    // endpoint diventa un oracolo per scoprire quali email sono registrate.
    const genericResponse = {
      success: true,
      data: {
        message:
          'Se esiste un account associato a questa email, riceverai a breve un link per reimpostare la password.',
      },
    };

    const user = await app.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      request.log.info(
        { emailFp: emailFingerprint(email) },
        'Reset password richiesto per email inesistente/inattiva',
      );
      return reply.send(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await app.prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: hashResetToken(rawToken),
        resetTokenExpiry: expiry,
      },
    });

    const appUrl = process.env.APP_PUBLIC_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

    // Il link contiene il token in chiaro: chi legge i log puo' reimpostare
    // la password di chiunque. In sviluppo e' comodo (serve a recuperare il
    // link in modalita log-only), in produzione sarebbe una falla: i log
    // finiscono spesso in aggregatori esterni con accessi piu' larghi del DB.
    if (process.env.NODE_ENV === 'production') {
      request.log.info({ userId: user.id }, '[RESET PASSWORD] Link generato e inviato');
    } else {
      request.log.info({ userId: user.id, resetUrl }, '[RESET PASSWORD] Link generato');
    }

    await sendEmail(
      {
        to: [user.email],
        subject: 'Reset your password — TrainMind',
        html: buildPasswordResetEmailHtml({
          firstName: user.firstName,
          resetUrl,
          expiryMinutes: RESET_TOKEN_TTL_MINUTES,
        }),
        text: `Reimposta la tua password: ${resetUrl} (link valido ${RESET_TOKEN_TTL_MINUTES} minuti)`,
        from: getAuthFrom(),
      },
      request.log,
    );

    return reply.send(genericResponse);
    },
  );

  // ─── POST /auth/reset-password ─────────────────────
  // Consuma il token e imposta la nuova password.
  app.post<{ Body: ResetPasswordInput }>(
    '/auth/reset-password',
    {
      // Limite stretto: rende impraticabile il brute-force del token.
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
    const parsed = resetPasswordSchema.safeParse(request.body);
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

    const { token, password } = parsed.data;

    const user = await app.prisma.user.findUnique({
      where: { resetTokenHash: hashResetToken(token) },
    });

    if (!user || !user.isActive || !user.resetTokenExpiry || new Date() > user.resetTokenExpiry) {
      return reply.status(410).send({
        success: false,
        error: {
          code: 'INVALID_RESET_TOKEN',
          message: 'Link non valido o scaduto. Richiedine uno nuovo.',
        },
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Il token viene azzerato nella stessa update: e' monouso.
    await app.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        resetTokenHash: null,
        resetTokenExpiry: null,
      },
    });
    await revokeAllRefreshTokens(app.prisma, user.id);

    request.log.info({ userId: user.id }, 'Password reimpostata via token');

    return reply.send({
      success: true,
      data: { message: 'Password reimpostata con successo. Ora puoi accedere.' },
    });
    },
  );

  // ─── GET /auth/reset-password/:token — verifica preliminare ───
  // Permette alla pagina di mostrare subito "link scaduto" senza far
  // compilare il form all'utente per poi rifiutarlo.
  app.get<{ Params: { token: string } }>(
    '/auth/reset-password/:token',
    async (request, reply) => {
      const { token } = request.params;

      const user = await app.prisma.user.findUnique({
        where: { resetTokenHash: hashResetToken(token) },
        select: { email: true, isActive: true, resetTokenExpiry: true },
      });

      if (!user || !user.isActive || !user.resetTokenExpiry || new Date() > user.resetTokenExpiry) {
        return reply.status(410).send({
          success: false,
          error: {
            code: 'INVALID_RESET_TOKEN',
            message: 'Link non valido o scaduto. Richiedine uno nuovo.',
          },
        });
      }

      // Email mascherata: conferma all'utente di quale account si tratta
      // senza esporre l'indirizzo completo a chi intercettasse il link.
      const [local, domain] = user.email.split('@');
      const maskedEmail = `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 1))}@${domain}`;

      return reply.send({
        success: true,
        data: { email: maskedEmail, expiresAt: user.resetTokenExpiry },
      });
    },
  );
}
