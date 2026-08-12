/**
 * TrainMind — Frontend Monitoring & Error Tracking.
 *
 * Sprint 2.5.4: Integrazione Sentry per error tracking frontend.
 * Configurabile via env var NEXT_PUBLIC_SENTRY_DSN.
 *
 * Se Sentry non è configurato, gli errori vengono loggati solo in console.
 */

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || '';

interface ErrorContext {
  /** Context tag for grouping (e.g. 'ai-chat', 'ai-generate') */
  context?: string;
  /** Extra data to attach to the error */
  extra?: Record<string, unknown>;
  /** User identifier */
  userId?: string;
}

// Sentry is loaded lazily via dynamic import. The module is typed as `any` so the
// file compiles even when `@sentry/nextjs` isn't installed — when it is installed
// the dynamic import still returns the real SDK at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SentryModule = any;

let _sentryInitialized = false;
let _Sentry: SentryModule = null;

/**
 * Lazy-init Sentry SDK. Imported dynamically to avoid bundle bloat
 * when Sentry is not configured.
 */
async function initSentry(): Promise<void> {
  if (_sentryInitialized || !SENTRY_DSN) return;

  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — @sentry/nextjs is an optional dependency; installed separately
    _Sentry = await import('@sentry/nextjs');
    _Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.2,  // 20% of transactions
      replaysSessionSampleRate: 0.0,
      replaysOnErrorSampleRate: 0.5,

      // Filter out noisy errors
      ignoreErrors: [
        'ResizeObserver loop',
        'Failed to fetch',
        'Load failed',
        'AbortError',
        'Network request failed',
      ],
    });
    _sentryInitialized = true;
    console.info('[Monitoring] Sentry initialized');
  } catch (err) {
    console.warn('[Monitoring] Sentry init failed:', err);
  }
}

/**
 * Capture an error with optional context.
 */
export async function captureError(error: Error, ctx?: ErrorContext): Promise<void> {
  console.error(`[${ctx?.context || 'app'}]`, error.message, ctx?.extra);

  if (SENTRY_DSN) {
    await initSentry();
    if (_Sentry) {
      _Sentry.withScope((scope: SentryModule) => {
        if (ctx?.context) scope.setTag('context', ctx.context);
        if (ctx?.userId) scope.setUser({ id: ctx.userId });
        if (ctx?.extra) {
          Object.entries(ctx.extra).forEach(([k, v]) => scope.setExtra(k, v));
        }
        _Sentry!.captureException(error);
      });
    }
  }
}

/**
 * Capture a custom message/breadcrumb.
 */
export async function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  ctx?: ErrorContext
): Promise<void> {
  if (SENTRY_DSN) {
    await initSentry();
    if (_Sentry) {
      _Sentry.withScope((scope: SentryModule) => {
        if (ctx?.context) scope.setTag('context', ctx.context);
        if (ctx?.extra) {
          Object.entries(ctx.extra).forEach(([k, v]) => scope.setExtra(k, v));
        }
        _Sentry!.captureMessage(message, level);
      });
    }
  }
}

/**
 * Track AI-specific performance metrics.
 */
export function trackAIMetric(metric: {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
}): void {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.info(`[AI Metric] ${metric.name}: ${metric.value}${metric.unit || ''}`, metric.tags);
  }

  // In production, these would be sent to a metrics backend
  // For now, store in-memory for the monitoring dashboard
  _metricsBuffer.push({
    ...metric,
    timestamp: Date.now(),
  });

  // Keep buffer bounded
  if (_metricsBuffer.length > 100) {
    _metricsBuffer.splice(0, 50);
  }
}

interface BufferedMetric {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  timestamp: number;
}

const _metricsBuffer: BufferedMetric[] = [];

/**
 * Get recent AI metrics for display in a monitoring dashboard.
 */
export function getRecentMetrics(): BufferedMetric[] {
  return [..._metricsBuffer];
}

/**
 * Set user context for error tracking.
 */
export async function setUserContext(user: {
  id: string;
  email?: string;
  role?: string;
}): Promise<void> {
  if (SENTRY_DSN) {
    await initSentry();
    _Sentry?.setUser(user);
  }
}
