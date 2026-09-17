/**
 * Sprint 4.2 — Report scheduler worker
 *
 * In-process cron worker that:
 *   1. Every minute, finds active ReportSchedules with nextRunAt <= now
 *   2. For each due schedule: generates the report, sends email with attachment,
 *      records a ReportScheduleRun, recomputes nextRunAt
 *   3. Exposes runScheduleNow() for manual triggers from the HTTP API
 *
 * The worker is registered as a Fastify plugin via startReportSchedulerWorker()
 * called from app.ts after all other plugins are ready.
 */

import type { FastifyInstance } from 'fastify';
import cron from 'node-cron';
import cronParser from 'cron-parser';
// Infer Prisma model types from the DB package to avoid direct @prisma/client dep
type ReportSchedule = Awaited<ReturnType<FastifyInstance['prisma']['reportSchedule']['findUniqueOrThrow']>>;
type ReportScheduleRun = Awaited<ReturnType<FastifyInstance['prisma']['reportScheduleRun']['findUniqueOrThrow']>>;
import { generateReport } from '../routes/reports.js';
import { sendEmail, buildReportEmailHtml, type EmailAttachment } from './email-service.js';

const TICK_CRON = '* * * * *'; // every minute
let scheduledTask: cron.ScheduledTask | null = null;

// ─── Period helpers ───────────────────────────────────────

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function computePeriod(periodDays: number, asOf: Date = new Date()): { from: string; to: string } {
  const to = new Date(asOf);
  to.setUTCHours(0, 0, 0, 0);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - periodDays);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

function computeNextRun(cronExpression: string, timezone: string): Date | null {
  try {
    const interval = cronParser.parseExpression(cronExpression, { tz: timezone });
    return interval.next().toDate();
  } catch {
    return null;
  }
}

// ─── Single-schedule executor ─────────────────────────────

interface ExecutionResult {
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  errorMessage?: string;
  fileSizeBytes?: number;
  recipientsSent: number;
}

async function executeSchedule(
  app: FastifyInstance,
  schedule: ReportSchedule,
): Promise<ExecutionResult> {
  const log = app.log.child({ scheduleId: schedule.id, scheduleName: schedule.name });

  // Resolve a "system user" for the report metadata: prefer the creator
  const creator = await app.prisma.user.findUnique({
    where: { id: schedule.createdById },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!creator) {
    log.warn('Schedule creator no longer exists, skipping');
    return { status: 'SKIPPED', errorMessage: 'Creator not found', recipientsSent: 0 };
  }

  const { from, to } = computePeriod(schedule.periodDays);

  log.info({ from, to, audience: schedule.audience, format: schedule.format }, 'Generating scheduled report');

  let result;
  try {
    result = await generateReport({
      app,
      organizationId: schedule.organizationId,
      userId: schedule.createdById,
      audience: schedule.audience as 'STAFF' | 'MEDICAL' | 'TRAINER',
      periodFrom: from,
      periodTo: to,
      format: schedule.format as 'JSON' | 'PDF' | 'DOCX',
      includeAISummary: schedule.includeAISummary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Report generation failed';
    log.error({ err }, 'Scheduled report generation failed');
    return { status: 'FAILED', errorMessage: message, recipientsSent: 0 };
  }

  // Build attachment
  let attachment: EmailAttachment;
  if (schedule.format === 'JSON') {
    const jsonStr = JSON.stringify(result.report, null, 2);
    attachment = {
      filename: result.filename,
      content: Buffer.from(jsonStr, 'utf-8'),
      contentType: 'application/json',
    };
  } else {
    if (!result.buffer) {
      return { status: 'FAILED', errorMessage: 'Empty buffer for non-JSON format', recipientsSent: 0 };
    }
    attachment = {
      filename: result.filename,
      content: result.buffer,
      contentType: result.contentType,
    };
  }

  const html = buildReportEmailHtml({
    organizationName: result.report.metadata.organizationName,
    audience: schedule.audience,
    periodFrom: from,
    periodTo: to,
    summary: result.report.summary,
  });

  const emailRes = await sendEmail(
    {
      to: schedule.recipients,
      subject: `[TrainMind] ${schedule.name} — ${from} → ${to}`,
      html,
      attachments: [attachment],
    },
    log,
  );

  if (!emailRes.success) {
    return {
      status: 'FAILED',
      errorMessage: emailRes.error || 'Email send failed',
      fileSizeBytes: attachment.content.length,
      recipientsSent: 0,
    };
  }

  return {
    status: 'SUCCESS',
    fileSizeBytes: attachment.content.length,
    recipientsSent: schedule.recipients.length,
  };
}

async function recordRunAndAdvance(
  app: FastifyInstance,
  schedule: ReportSchedule,
  startedAt: Date,
  result: ExecutionResult,
): Promise<ReportScheduleRun> {
  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const nextRunAt = computeNextRun(schedule.cronExpression, schedule.timezone);

  const [run] = await app.prisma.$transaction([
    app.prisma.reportScheduleRun.create({
      data: {
        scheduleId: schedule.id,
        status: result.status,
        startedAt,
        finishedAt,
        durationMs,
        fileSizeBytes: result.fileSizeBytes,
        errorMessage: result.errorMessage,
        recipientsSent: result.recipientsSent,
      },
    }),
    app.prisma.reportSchedule.update({
      where: { id: schedule.id },
      data: {
        lastRunAt: finishedAt,
        lastRunStatus: result.status,
        nextRunAt,
      },
    }),
  ]);

  return run;
}

// ─── Public API ───────────────────────────────────────────

/**
 * Manually trigger a single schedule (used by HTTP "Run now" endpoint).
 * Bypasses nextRunAt check but still records a run + advances nextRunAt.
 */
export async function runScheduleNow(
  app: FastifyInstance,
  scheduleId: string,
): Promise<ReportScheduleRun> {
  const schedule = await app.prisma.reportSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) {
    throw new Error('Schedule not found');
  }

  const startedAt = new Date();
  const result = await executeSchedule(app, schedule);
  return recordRunAndAdvance(app, schedule, startedAt, result);
}

/**
 * Cron tick: process all due schedules.
 */
async function processDueSchedules(app: FastifyInstance): Promise<void> {
  const now = new Date();

  const due = await app.prisma.reportSchedule.findMany({
    where: {
      isActive: true,
      nextRunAt: { lte: now },
    },
  });

  if (due.length === 0) return;

  app.log.info({ count: due.length }, 'Processing due report schedules');

  // Sequential to keep load predictable; PDFs use Puppeteer which is heavy
  for (const schedule of due) {
    const startedAt = new Date();
    try {
      const result = await executeSchedule(app, schedule);
      await recordRunAndAdvance(app, schedule, startedAt, result);
    } catch (err) {
      app.log.error({ err, scheduleId: schedule.id }, 'Unhandled error in schedule execution');
      // Best-effort: still advance nextRunAt to avoid tight loops on broken schedule
      try {
        await recordRunAndAdvance(app, schedule, startedAt, {
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message : 'Unhandled error',
          recipientsSent: 0,
        });
      } catch {
        /* swallow — we logged the original error */
      }
    }
  }
}

/**
 * Start the in-process cron worker. Called once from app.ts after Prisma
 * is registered. Idempotent — calling twice is a no-op.
 */
export function startReportSchedulerWorker(app: FastifyInstance): void {
  if (scheduledTask) {
    app.log.warn('Report scheduler worker already started');
    return;
  }

  // Skip in test env to keep tests deterministic
  if (process.env.NODE_ENV === 'test' || process.env.DISABLE_REPORT_SCHEDULER === '1') {
    app.log.info('Report scheduler worker disabled (NODE_ENV=test or DISABLE_REPORT_SCHEDULER=1)');
    return;
  }

  scheduledTask = cron.schedule(TICK_CRON, () => {
    processDueSchedules(app).catch((err) => {
      app.log.error({ err }, 'processDueSchedules tick failed');
    });
  });

  app.log.info('Report scheduler worker started (tick: every minute)');

  // Stop the cron task gracefully when the server closes
  app.addHook('onClose', async () => {
    if (scheduledTask) {
      scheduledTask.stop();
      scheduledTask = null;
      app.log.info('Report scheduler worker stopped');
    }
  });
}
