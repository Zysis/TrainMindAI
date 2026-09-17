/**
 * Sprint 4.2 — Report Schedules CRUD
 *
 * Endpoints (all under /api/v1):
 *   GET    /reports/schedules            list schedules for current org
 *   POST   /reports/schedules            create schedule
 *   GET    /reports/schedules/:id        fetch single schedule (with last 10 runs)
 *   PATCH  /reports/schedules/:id        update schedule
 *   DELETE /reports/schedules/:id        delete schedule
 *   POST   /reports/schedules/:id/run    trigger manual run (used by UI "Run now")
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import cronParser from 'cron-parser';
import { requireMinRole } from '../middleware/rbac.js';
import { runScheduleNow } from '../services/report-scheduler-worker.js';

// ─── Validation schemas ───────────────────────────────────

const cronExpressionSchema = z.string().refine(
  (value) => {
    try {
      cronParser.parseExpression(value);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Espressione cron non valida (formato standard 5 campi)' },
);

const createScheduleSchema = z.object({
  name: z.string().min(1).max(120),
  audience: z.enum(['STAFF', 'MEDICAL', 'TRAINER']),
  format: z.enum(['JSON', 'PDF', 'DOCX']).default('PDF'),
  cronExpression: cronExpressionSchema,
  timezone: z.string().default('Europe/Rome'),
  periodDays: z.number().int().min(1).max(365).default(7),
  recipients: z.array(z.string().email()).min(1).max(20),
  includeAISummary: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

const updateScheduleSchema = createScheduleSchema.partial();

// ─── Helpers ──────────────────────────────────────────────

function computeNextRun(cronExpression: string, timezone: string): Date | null {
  try {
    const interval = cronParser.parseExpression(cronExpression, { tz: timezone });
    return interval.next().toDate();
  } catch {
    return null;
  }
}

// ─── Routes ───────────────────────────────────────────────

export async function reportScheduleRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate, requireMinRole('TRAINER')] };

  // ─── GET /reports/schedules ─────────────────────────
  app.get('/reports/schedules', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const { organizationId } = request.user;

    const schedules = await app.prisma.reportSchedule.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { runs: true } },
      },
    });

    return reply.send({ success: true, data: { schedules } });
  });

  // ─── POST /reports/schedules ────────────────────────
  app.post('/reports/schedules', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createScheduleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dati schedulazione non validi',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const { organizationId, userId } = request.user;
    const data = parsed.data;
    const nextRunAt = computeNextRun(data.cronExpression, data.timezone);

    const schedule = await app.prisma.reportSchedule.create({
      data: {
        organizationId,
        createdById: userId,
        name: data.name,
        audience: data.audience,
        format: data.format,
        cronExpression: data.cronExpression,
        timezone: data.timezone,
        periodDays: data.periodDays,
        recipients: data.recipients,
        includeAISummary: data.includeAISummary,
        isActive: data.isActive,
        nextRunAt,
      },
    });

    return reply.status(201).send({ success: true, data: { schedule } });
  });

  // ─── GET /reports/schedules/:id ─────────────────────
  app.get<{ Params: { id: string } }>(
    '/reports/schedules/:id',
    auth,
    async (request, reply) => {
      const { organizationId } = request.user;
      const { id } = request.params;

      const schedule = await app.prisma.reportSchedule.findFirst({
        where: { id, organizationId },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          runs: { orderBy: { startedAt: 'desc' }, take: 10 },
        },
      });

      if (!schedule) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Schedulazione non trovata' },
        });
      }

      return reply.send({ success: true, data: { schedule } });
    },
  );

  // ─── PATCH /reports/schedules/:id ───────────────────
  app.patch<{ Params: { id: string } }>(
    '/reports/schedules/:id',
    auth,
    async (request, reply) => {
      const parsed = updateScheduleSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dati di aggiornamento non validi',
            details: parsed.error.flatten().fieldErrors,
          },
        });
      }

      const { organizationId } = request.user;
      const { id } = request.params;

      const existing = await app.prisma.reportSchedule.findFirst({
        where: { id, organizationId },
      });
      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Schedulazione non trovata' },
        });
      }

      const data = parsed.data;
      const cronChanged = data.cronExpression && data.cronExpression !== existing.cronExpression;
      const tzChanged = data.timezone && data.timezone !== existing.timezone;
      const newNextRunAt =
        cronChanged || tzChanged
          ? computeNextRun(data.cronExpression || existing.cronExpression, data.timezone || existing.timezone)
          : existing.nextRunAt;

      const updated = await app.prisma.reportSchedule.update({
        where: { id },
        data: {
          ...data,
          nextRunAt: newNextRunAt,
        },
      });

      return reply.send({ success: true, data: { schedule: updated } });
    },
  );

  // ─── DELETE /reports/schedules/:id ──────────────────
  app.delete<{ Params: { id: string } }>(
    '/reports/schedules/:id',
    auth,
    async (request, reply) => {
      const { organizationId } = request.user;
      const { id } = request.params;

      const existing = await app.prisma.reportSchedule.findFirst({
        where: { id, organizationId },
      });
      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Schedulazione non trovata' },
        });
      }

      await app.prisma.reportSchedule.delete({ where: { id } });
      return reply.send({ success: true, data: { id } });
    },
  );

  // ─── POST /reports/schedules/:id/run ────────────────
  app.post<{ Params: { id: string } }>(
    '/reports/schedules/:id/run',
    auth,
    async (request, reply) => {
      const { organizationId } = request.user;
      const { id } = request.params;

      const schedule = await app.prisma.reportSchedule.findFirst({
        where: { id, organizationId },
      });
      if (!schedule) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Schedulazione non trovata' },
        });
      }

      try {
        const run = await runScheduleNow(app, schedule.id);
        return reply.send({ success: true, data: { run } });
      } catch (err) {
        request.log.error({ err }, 'Manual schedule run failed');
        const message = err instanceof Error ? err.message : 'Esecuzione manuale fallita';
        return reply.status(500).send({
          success: false,
          error: { code: 'RUN_FAILED', message },
        });
      }
    },
  );
}
