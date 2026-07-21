import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { registerSchema, loginSchema, refreshSchema } from '../schemas/auth.js';
import type { RegisterInput, LoginInput, RefreshInput } from '../schemas/auth.js';
import { seedDefaultExercises } from '../lib/seed-default-exercises.js';
import { LEGAL_VERSIONS } from '../lib/legal.js';

const SALT_ROUNDS = 12;

export async function authRoutes(app: FastifyInstance) {
  // ─── POST /auth/register ────────────────────────────
  app.post<{ Body: RegisterInput }>('/auth/register', async (request, reply) => {
    // Interruttore per chiudere le registrazioni pubbliche (fase di test)
    if (process.env.DISABLE_REGISTRATION === 'true') {
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

    const { email, password, firstName, lastName, organizationName } = parsed.data;

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

    const result = await app.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          slug: `${slug}-${Date.now().toString(36)}`,
          sport: 'basketball',
          tier: 'STARTER',
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
        },
      });

      // Registra le accettazioni versionate (ToS accettati, informativa presa visione)
      await tx.consentRecord.createMany({
        data: [
          { userId: user.id, docType: 'TERMS', docVersion: LEGAL_VERSIONS.TERMS, ipAddress: request.ip },
          { userId: user.id, docType: 'PRIVACY_ACK', docVersion: LEGAL_VERSIONS.PRIVACY, ipAddress: request.ip },
        ],
      });

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
    const refreshToken = crypto.randomBytes(64).toString('hex');

    // Store refresh token
    await app.prisma.user.update({
      where: { id: result.user.id },
      data: { refreshToken, lastLoginAt: new Date() },
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
  app.post<{ Body: LoginInput }>('/auth/login', async (request, reply) => {
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
    const refreshToken = crypto.randomBytes(64).toString('hex');

    // Store refresh token + update last login
    await app.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken, lastLoginAt: new Date() },
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

    // Find user by refresh token
    const user = await app.prisma.user.findFirst({
      where: { refreshToken, isActive: true },
    });

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token non valido o scaduto',
        },
      });
    }

    // Rotate tokens
    const payload = {
      userId: user.id,
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };

    const newAccessToken = app.jwt.sign(payload);
    const newRefreshToken = crypto.randomBytes(64).toString('hex');

    await app.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    return reply.send({
      success: true,
      data: {
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
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
  app.post('/auth/logout', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user;

    await app.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    return reply.send({
      success: true,
      data: { message: 'Logout effettuato con successo' },
    });
  });
}
