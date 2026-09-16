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
import { dailyReportRoutes } from './routes/daily-report.js';
import { gameReportRoutes } from './routes/game-report.js';
import { rtpTemplateRoutes } from './routes/rtp-templates.js';
import { athleteRoutes as athleteAppRoutes } from './routes/athlete.js';
import { staffRoutes } from './routes/staff.js';
import { startReportSchedulerWorker } from './services/report-scheduler-worker.js';
import { startRetentionWorker } from './services/retention-worker.js';
import auditPlugin from './plugins/audit.js';
import { errorHandler } from './lib/error-handler.js';

/**
 * Il plugin di autenticazione ripiega su un segreto di sviluppo scritto nel
 * codice quando JWT_SECRET manca. Il file di deploy passa `${JWT_SECRET}`
 * senza `:?`, quindi una riga dimenticata in `.env.deploy` produceva una
 * stringa vuota e, in silenzio, token firmati con un segreto pubblico:
 * chiunque avesse letto il repository poteva fabbricarsi un accesso ADMIN a
 * qualunque organizzazione. In produzione ci si rifiuta di partire.
 */
const KNOWN_WEAK_SECRETS = [
  'dev-secret-must-be-at-least-32-chars-long',
  'CAMBIAMI_stringa_casuale_di_almeno_32_caratteri',
];

export function assertProductionSecrets(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;
  const secret = env.JWT_SECRET ?? '';
  if (secret.length < 32 || KNOWN_WEAK_SECRETS.includes(secret)) {
    throw new Error(
      'JWT_SECRET mancante, troppo corto (< 32 caratteri) o uguale al valore di esempio: impostalo in .env.deploy',
    );
  }
}

export async function buildApp() {
  assertProductionSecrets();
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
    // Dietro Caddy `request.ip` era l'indirizzo del container proxy, uguale
    // per tutti: il limite di 100 richieste al minuto finiva condiviso da
    // tutta la piattaforma (una societa' che sfoglia tre atleti poteva
    // mandare in 429 le altre), i limiti su forgot/reset-password valevano
    // per il prodotto intero, e gli audit log registravano l'IP sbagliato.
    //
    // `1` e non `true`: si fida di UN solo hop, cioe' dell'ultimo valore di
    // X-Forwarded-For, che scrive Caddy. Con `true` un client potrebbe
    // spedire un X-Forwarded-For fasullo e farsi passare per 127.0.0.1,
    // che e' nella allowList qui sotto. Il container api e' su `expose` e
    // non su `ports`, quindi l'unico che lo raggiunge e' il proxy.
    trustProxy: 1,
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
    // Lista chiusa: un'intestazione non elencata qui viene rifiutata dal
    // browser nella richiesta preliminare (OPTIONS) e la chiamata vera non
    // parte nemmeno. Non e' un errore che si vede lato server, quindi chi
    // aggiunge un'intestazione nuova deve ricordarsi di aggiungerla anche qui.
    //
    // `x-registration-token` apre il cancello delle registrazioni quando sono
    // chiuse al pubblico (vedi routes/auth.ts).
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'x-registration-token',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Request-Id'],
    maxAge: 86400,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    allowList: ['127.0.0.1', '::1'],
    keyGenerator: (request) => request.ip,
  });

  // I limiti piu' stretti sulle rotte di autenticazione stanno per-rotta in
  // auth.ts, in `config.rateLimit`, e non in una seconda registrazione del
  // plugin (che morirebbe con FST_ERR_DEC_ALREADY_PRESENT).
  // Coperte: /auth/login, /auth/register, /auth/forgot-password,
  // /auth/reset-password.

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

  // ─── Corpo JSON vuoto ─────────────────────────────────
  // Alcune rotte sono azioni senza parametri (POST .../ensure-week, .../run):
  // i client mandano comunque "Content-Type: application/json" e il parser di
  // default risponde 400 FST_ERR_CTP_EMPTY_JSON_BODY, che in interfaccia
  // arrivava come un errore generico e incomprensibile. Un corpo vuoto qui
  // vale come oggetto vuoto.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req, body: string, done) => {
      // Le rotte che devono verificare una firma sul corpo (il webhook di
      // Stripe) lo chiedono con `config: { rawBody: true }`: il testo
      // originale resta in `request.rawBody`, perche' riserializzare l'oggetto
      // non restituisce gli stessi byte e la firma non tornerebbe.
      const routeConfig = req.routeOptions?.config as { rawBody?: boolean } | undefined;
      if (routeConfig?.rawBody) {
        (req as unknown as { rawBody?: string }).rawBody = body;
      }
      if (!body || body.trim() === '') return done(null, {});
      try {
        done(null, JSON.parse(body));
      } catch (err) {
        (err as Error & { statusCode?: number }).statusCode = 400;
        done(err as Error, undefined);
      }
    },
  );

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
  await app.register(dailyReportRoutes, { prefix: '/api/v1' });
  await app.register(gameReportRoutes, { prefix: '/api/v1' });
  await app.register(rtpTemplateRoutes, { prefix: '/api/v1' });
  await app.register(athleteAppRoutes, { prefix: '/api/v1' });
  await app.register(staffRoutes, { prefix: '/api/v1' });

  // ─── Background workers ───────────────────────────────
  startReportSchedulerWorker(app);
  startRetentionWorker(app);

  return app;
}
