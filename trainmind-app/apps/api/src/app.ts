import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { athleteRoutes } from './routes/athletes.js';
import { exerciseRoutes } from './routes/exercises.js';
import { wellnessRoutes } from './routes/wellness.js';
import { trainingRoutes } from './routes/training.js';
import { aiRoutes } from './routes/ai.js';
import { analyticsRoutes } from './routes/analytics.js';
import { notificationRoutes } from './routes/notifications.js';
import { adaptationRoutes } from './routes/adaptations.js';
import { reportRoutes } from './routes/reports.js';
import { reportScheduleRoutes } from './routes/report-schedules.js';
import { periodizationRoutes } from './routes/periodization.js';
import { injuryRoutes } from './routes/injuries.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { gdprRoutes } from './routes/gdpr.js';
import { billingRoutes } from './routes/billing.js';
import { teamRoutes } from './routes/teams.js';
import { fieldTrainingRoutes } from './routes/field-training.js';
import { gameTrackingRoutes } from './routes/game-tracking.js';
import { athleteRoutes as athleteAppRoutes } from './routes/athlete.js';
import { startReportSchedulerWorker } from './services/report-scheduler-worker.js';
import { startRetentionWorker } from './services/retention-worker.js';
import auditPlugin from './plugins/audit.js';
import { errorHandler } from './lib/error-handler.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    requestTimeout: 30000,
    bodyLimit: 1048576,
  });

  // ─── Security & Middleware ────────────────────────────
  const isProduction = process.env.NODE_ENV === 'production';

  await app.register(helmet, {
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", ...(process.env.CORS_ORIGIN?.split(',') || [])],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
    hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      const allowed = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3002', 'http://localhost:3003'];
      if (!origin || allowed.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error('CORS origin not allowed'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Request-Id'],
    maxAge: 86400,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    allowList: ['127.0.0.1', '::1'],
    keyGenerator: (request) => request.ip,
  });

  // NOTE: Stricter rate limiting for auth endpoints is applied per-route
  // via config.rateLimit in auth.ts route definitions, not via a second
  // plugin registration (which would crash with FST_ERR_DEC_ALREADY_PRESENT).

  // Add security headers
  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '0'); // Modern browsers use CSP instead
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (isProduction) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
  });

  await app.register(sensible);

  // ─── Plugins ──────────────────────────────────────────
  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(auditPlugin);

  // ─── Error Handler ────────────────────────────────────
  app.setErrorHandler(errorHandler);

  // ─── Routes ───────────────────────────────────────────
  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(athleteRoutes, { prefix: '/api/v1' });
  await app.register(exerciseRoutes, { prefix: '/api/v1' });
  await app.register(wellnessRoutes, { prefix: '/api/v1' });
  await app.register(trainingRoutes, { prefix: '/api/v1' });
  await app.register(aiRoutes, { prefix: '/api/v1' });
  await app.register(analyticsRoutes, { prefix: '/api/v1' });
  await app.register(notificationRoutes, { prefix: '/api/v1' });
  await app.register(adaptationRoutes, { prefix: '/api/v1' });
  await app.register(reportRoutes, { prefix: '/api/v1' });
  await app.register(reportScheduleRoutes, { prefix: '/api/v1' });
  await app.register(periodizationRoutes, { prefix: '/api/v1' });
  await app.register(injuryRoutes, { prefix: '/api/v1' });
  await app.register(dashboardRoutes, { prefix: '/api/v1' });
  await app.register(gdprRoutes, { prefix: '/api/v1' });
  await app.register(billingRoutes, { prefix: '/api/v1' });
  await app.register(teamRoutes, { prefix: '/api/v1' });
  await app.register(fieldTrainingRoutes, { prefix: '/api/v1' });
  await app.register(gameTrackingRoutes, { prefix: '/api/v1' });
  await app.register(athleteAppRoutes, { prefix: '/api/v1' });

  // ─── Background workers ───────────────────────────────
  startReportSchedulerWorker(app);
  startRetentionWorker(app);

  return app;
}
