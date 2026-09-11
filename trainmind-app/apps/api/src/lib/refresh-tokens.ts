import crypto from 'crypto';
import type { FastifyInstance } from 'fastify';

type Db = FastifyInstance['prisma'];

/**
 * Gestione dei refresh token.
 *
 * Prima stavano in una sola colonna, `User.refreshToken`: un utente poteva
 * avere una sola sessione viva in tutto il sistema. Aprire l'app in una
 * seconda scheda, o su un secondo dispositivo, buttava fuori la prima — e
 * siccome il token ruota a ogni rinnovo, bastavano due schede aperte sulla
 * stessa app perché si invalidassero a vicenda dopo pochi minuti. Non c'era
 * nemmeno una scadenza memorizzata: il token restava valido finché non ne
 * arrivava un altro.
 *
 * Ora ogni sessione ha la sua riga, con scadenza e revoca proprie. Del token
 * si salva solo l'hash SHA-256, come già si faceva per i token di reset
 * password: se il database finisce nelle mani sbagliate, le sessioni aperte
 * non sono riutilizzabili.
 */

/** Durata di una sessione di rinnovo. */
export const REFRESH_TOKEN_TTL_DAYS = 30;

/** Quante sessioni contemporanee teniamo per utente (le più vecchie cadono). */
const MAX_SESSIONS_PER_USER = 10;

function hash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function expiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 86400000);
}

/** Emette un nuovo refresh token e ne registra la sessione. Torna il token in chiaro. */
export async function issueRefreshToken(
  db: Db,
  userId: string,
  userAgent?: string | null,
): Promise<string> {
  const token = crypto.randomBytes(64).toString('hex');

  await db.refreshToken.create({
    data: {
      tokenHash: hash(token),
      userId,
      expiresAt: expiry(),
      userAgent: userAgent?.slice(0, 200) ?? null,
    },
  });

  await pruneSessions(db, userId);
  return token;
}

/**
 * Ruota un refresh token: valida quello ricevuto, lo revoca e ne emette uno
 * nuovo per la STESSA sessione. Torna `null` se il token non è valido, è
 * scaduto, è già stato revocato o l'utente non è più attivo — in tutti questi
 * casi il chiamante deve rispondere 401.
 */
export async function rotateRefreshToken(
  db: Db,
  token: string,
  userAgent?: string | null,
): Promise<{ userId: string; refreshToken: string } | null> {
  const row = await db.refreshToken.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: { select: { id: true, isActive: true } } },
  });

  if (!row || row.revokedAt || row.expiresAt <= new Date()) return null;
  if (!row.user || !row.user.isActive) return null;

  const next = crypto.randomBytes(64).toString('hex');

  // Una transazione sola: se la creazione fallisse dopo la revoca, l'utente
  // si ritroverebbe senza sessione pur avendo fatto tutto giusto.
  await db.$transaction([
    db.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    }),
    db.refreshToken.create({
      data: {
        tokenHash: hash(next),
        userId: row.userId,
        expiresAt: expiry(),
        userAgent: userAgent?.slice(0, 200) ?? row.userAgent,
      },
    }),
  ]);

  return { userId: row.userId, refreshToken: next };
}

/** Chiude una sola sessione (logout dal dispositivo corrente). */
export async function revokeRefreshToken(db: Db, token: string): Promise<void> {
  await db.refreshToken.updateMany({
    where: { tokenHash: hash(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Chiude tutte le sessioni di un utente. Si usa al cambio password e al
 * reset: chi conosceva la vecchia password non deve restare dentro.
 */
export async function revokeAllRefreshTokens(db: Db, userId: string): Promise<void> {
  await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Toglie di mezzo le righe scadute o revocate e tiene al massimo
 * MAX_SESSIONS_PER_USER sessioni vive, sacrificando le più vecchie.
 */
async function pruneSessions(db: Db, userId: string): Promise<void> {
  await db.refreshToken.deleteMany({
    where: {
      userId,
      OR: [{ expiresAt: { lte: new Date() } }, { revokedAt: { not: null } }],
    },
  });

  const live = await db.refreshToken.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  if (live.length > MAX_SESSIONS_PER_USER) {
    await db.refreshToken.deleteMany({
      where: { id: { in: live.slice(MAX_SESSIONS_PER_USER).map((r) => r.id) } },
    });
  }
}
