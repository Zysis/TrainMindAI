/**
 * Retention worker: pulizia periodica dei dati soggetti a policy di ritenzione.
 *
 * Regole applicate una volta al giorno alle 03:15 (server time):
 *   1. Audit log più vecchi di AUDIT_LOG_RETENTION_DAYS (default 365) → hard delete
 *   2. Utenti soft-deleted da più di USER_HARD_DELETE_DAYS (default 30) → hard delete
 *      (finestra di ripensamento; oltre, l'utente viene rimosso davvero)
 *
 * Disattivabile con DISABLE_RETENTION_WORKER=1 (usato nei test).
 */

import type { FastifyInstance } from 'fastify';
import cron from 'node-cron';

const TICK_CRON = '15 3 * * *'; // ogni giorno alle 03:15
let scheduledTask: cron.ScheduledTask | null = null;

function getRetentionDays(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function runRetention(app: FastifyInstance): Promise<void> {
  const now = new Date();

  // ─── 1. Audit log ─────────────────────────────────────
  const auditDays = getRetentionDays('AUDIT_LOG_RETENTION_DAYS', 365);
  const auditCutoff = new Date(now.getTime() - auditDays * 86400_000);
  const auditRes = await app.prisma.auditLog.deleteMany({
    where: { createdAt: { lt: auditCutoff } },
  });

  // ─── 2. Utenti soft-deleted oltre finestra ────────────
  const userDays = getRetentionDays('USER_HARD_DELETE_DAYS', 30);
  const userCutoff = new Date(now.getTime() - userDays * 86400_000);
  const oldSoftDeleted = await app.prisma.user.findMany({
    where: { deletedAt: { lt: userCutoff, not: null } },
    select: { id: true },
  });
  let userRemoved = 0;
  for (const u of oldSoftDeleted) {
    try {
      await app.prisma.user.delete({ where: { id: u.id } });
      userRemoved++;
    } catch (err) {
      app.log.warn({ err, userId: u.id }, 'retention: user hard-delete failed');
    }
  }

  app.log.info(
    { auditRemoved: auditRes.count, userRemoved, auditDays, userDays },
    'retention worker tick completed',
  );
}

export function startRetentionWorker(app: FastifyInstance): void {
  if (scheduledTask) {
    app.log.warn('Retention worker already started');
    return;
  }
  if (process.env.NODE_ENV === 'test' || process.env.DISABLE_RETENTION_WORKER === '1') {
    app.log.info('Retention worker disabled');
    return;
  }

  scheduledTask = cron.schedule(TICK_CRON, () => {
    runRetention(app).catch((err) => {
      app.log.error({ err }, 'retention worker tick failed');
    });
  });

  app.log.info('Retention worker started (tick: 03:15 daily)');

  app.addHook('onClose', async () => {
    if (scheduledTask) {
      scheduledTask.stop();
      scheduledTask = null;
      app.log.info('Retention worker stopped');
    }
  });
}
