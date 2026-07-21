/**
 * Push Notification Service
 * Sends Web Push notifications to athlete PWA clients.
 *
 * Requires: npm install web-push
 * Environment vars: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 */

import type { PrismaClient } from '@trainmind/db';
import { Prisma } from '@trainmind/db';

// Lazy-import web-push (optional dependency)
let webpush: typeof import('web-push') | null = null;
async function getWebPush() {
  if (!webpush) {
    try {
      webpush = await import('web-push');
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      const privateKey = process.env.VAPID_PRIVATE_KEY;
      const subject = process.env.VAPID_SUBJECT || 'mailto:admin@trainmind.ai';

      if (publicKey && privateKey) {
        webpush.setVapidDetails(subject, publicKey, privateKey);
      } else {
        console.warn('[Push] VAPID keys not configured — push notifications disabled');
        webpush = null;
      }
    } catch {
      console.warn('[Push] web-push not installed — push notifications disabled');
      webpush = null;
    }
  }
  return webpush;
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Send push notification to a specific user.
 */
export async function sendPushToUser(
  prisma: PrismaClient,
  userId: string,
  payload: PushPayload,
): Promise<boolean> {
  const wp = await getWebPush();
  if (!wp) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushSubscription: true },
  });

  if (!user?.pushSubscription) return false;

  try {
    await wp.sendNotification(
      user.pushSubscription as unknown as import('web-push').PushSubscription,
      JSON.stringify(payload),
    );
    return true;
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    // 410 Gone = subscription expired, clean up
    if (statusCode === 410 || statusCode === 404) {
      await prisma.user.update({
        where: { id: userId },
        data: { pushSubscription: Prisma.JsonNull },
      });
    }
    console.error(`[Push] Failed to send to user ${userId}:`, err);
    return false;
  }
}

/**
 * Send push notification to all athlete users for a given athlete profile ID.
 * (Usually 1:1, but handles edge cases.)
 */
export async function sendPushToAthlete(
  prisma: PrismaClient,
  athleteId: string,
  payload: PushPayload,
): Promise<void> {
  const users = await prisma.user.findMany({
    where: { athleteId, role: 'ATHLETE', pushSubscription: { not: Prisma.JsonNull } },
    select: { id: true },
  });

  await Promise.allSettled(users.map((u: { id: string }) => sendPushToUser(prisma, u.id, payload)));
}

/**
 * Notify athletes when a new session is assigned.
 * Call this from training routes when sessions are created/updated.
 */
export async function notifySessionAssigned(
  prisma: PrismaClient,
  sessionTitle: string,
  sessionDate: string,
  athleteIds: string[],
): Promise<void> {
  const payload: PushPayload = {
    title: '📋 Nuova sessione programmata',
    body: `${sessionTitle} — ${new Date(sessionDate).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}`,
    url: '/sessions',
  };

  await Promise.allSettled(
    athleteIds.map((id) => sendPushToAthlete(prisma, id, payload)),
  );
}

/**
 * Notify athlete when a session is modified.
 */
export async function notifySessionModified(
  prisma: PrismaClient,
  sessionTitle: string,
  athleteIds: string[],
): Promise<void> {
  const payload: PushPayload = {
    title: '✏️ Sessione aggiornata',
    body: `"${sessionTitle}" è stata modificata dal preparatore`,
    url: '/sessions',
  };

  await Promise.allSettled(
    athleteIds.map((id) => sendPushToAthlete(prisma, id, payload)),
  );
}

/**
 * Send wellness reminder to athletes who haven't submitted today.
 * Intended to be called by a cron job or scheduled worker.
 */
export async function sendWellnessReminders(prisma: PrismaClient): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find all athlete users with push subscriptions
  const athleteUsers = await prisma.user.findMany({
    where: {
      role: 'ATHLETE',
      isActive: true,
      athleteId: { not: null },
      pushSubscription: { not: Prisma.JsonNull },
    },
    select: { id: true, athleteId: true },
  });

  if (athleteUsers.length === 0) return 0;

  // Find which athletes already submitted wellness today
  const submittedToday = await prisma.wellnessLog.findMany({
    where: {
      athleteId: { in: athleteUsers.map((u: { athleteId: string | null }) => u.athleteId!).filter(Boolean) },
      date: { gte: today },
    },
    select: { athleteId: true },
  });

  const submittedIds = new Set(submittedToday.map((w: { athleteId: string }) => w.athleteId));

  // Send reminders to those who haven't submitted
  const toNotify = athleteUsers.filter(
    (u: { id: string; athleteId: string | null }) => u.athleteId && !submittedIds.has(u.athleteId),
  );

  const payload: PushPayload = {
    title: '💚 Wellness giornaliero',
    body: 'Non dimenticare di compilare il check-in di oggi!',
    url: '/wellness',
  };

  const results = await Promise.allSettled(
    toNotify.map((u: { id: string }) => sendPushToUser(prisma, u.id, payload)),
  );

  return results.filter(
    (r: PromiseSettledResult<boolean>) => r.status === 'fulfilled' && r.value,
  ).length;
}
