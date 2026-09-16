/**
 * Posti dello staff di un'organizzazione.
 *
 * Un "posto" e' un account di staff — preparatore, medico, osservatore — che
 * vive dentro l'organizzazione e ne vede i dati: calendario, atleti, report.
 * Gli atleti NON occupano un posto: hanno il loro invito, il loro ruolo e la
 * loro app, e farli pesare sul piano dello staff significherebbe far pagare
 * la squadra invece di chi lavora sul software.
 *
 * Perche' esiste questo file: entrare in un'organizzazione avviene solo per
 * invito, e l'invito e' anche il punto in cui si conta. Prima di questa
 * modifica nessuno contava niente, e quattro preparatori su una sola login
 * erano non solo possibili ma invisibili.
 */

import type { FastifyInstance } from 'fastify';

// Stesso alias di refresh-tokens.ts: il client Prisma si prende da Fastify,
// cosi' questo file non dipende da come `@trainmind/db` espone i tipi.
type Db = FastifyInstance['prisma'];

/**
 * Posti INCLUSI nel piano. Gli eventuali posti in piu' si comprano a parte
 * (uno per uno, al prezzo di un abbonamento Starter) e finiscono in
 * `Organization.extraSeats`.
 */
export const SEATS_BY_TIER: Record<string, number> = {
  STARTER: 1,
  PROFESSIONAL: 2,
  ULTRA: 4,
};

/** Quota di sicurezza per un tier sconosciuto: il minimo, mai l'illimitato. */
const FALLBACK_SEATS = 1;

/**
 * Ruoli che occupano un posto. Tutto cio' che non e' un atleta.
 *
 * Scritto come elenco esplicito e non come "diverso da ATHLETE" perche' il
 * giorno in cui nascesse un ruolo nuovo (poniamo, un dirigente in sola
 * lettura) si deve decidere apposta se paga o no, invece di scoprirlo dopo
 * averlo messo in produzione.
 */
export const SEAT_ROLES = ['ADMIN', 'TRAINER', 'MEDICAL', 'VIEWER'] as const;
export type SeatRole = (typeof SEAT_ROLES)[number];

export function isSeatRole(role: string): role is SeatRole {
  return (SEAT_ROLES as readonly string[]).includes(role);
}

export interface SeatUsage {
  /** Posti inclusi nel piano. */
  included: number;
  /** Posti comprati oltre il piano. */
  extra: number;
  /** included + extra. */
  total: number;
  /** Account di staff attivi. */
  members: number;
  /** Inviti mandati e non ancora accettati (non scaduti). */
  pendingInvites: number;
  /** members + pendingInvites: i posti gia' impegnati. */
  used: number;
  /** Quanti se ne possono ancora impegnare. Mai negativo. */
  available: number;
}

/**
 * Fotografia dei posti di un'organizzazione.
 *
 * Gli inviti in sospeso contano come occupati. Altrimenti un amministratore
 * con un posto libero potrebbe mandare cinque inviti — al momento dell'invio
 * il posto risulta libero tutte e cinque le volte — e ritrovarsi cinque
 * persone che completano la registrazione.
 */
export async function getSeatUsage(
  prisma: Db,
  organizationId: string,
  options: {
    /**
     * Invito da NON contare fra i pendenti. Serve al momento
     * dell'accettazione: quell'invito sta per diventare un membro, quindi
     * contarlo sia come pendente sia come nuovo arrivato lo farebbe pesare
     * due volte e l'ultimo posto libero risulterebbe sempre occupato.
     */
    ignoreInviteId?: string;
  } = {},
): Promise<SeatUsage> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { tier: true, extraSeats: true },
  });

  const included = org ? (SEATS_BY_TIER[org.tier] ?? FALLBACK_SEATS) : FALLBACK_SEATS;
  const extra = org?.extraSeats ?? 0;

  const [members, pendingInvites] = await Promise.all([
    prisma.user.count({
      where: {
        organizationId,
        isActive: true,
        deletedAt: null,
        role: { in: [...SEAT_ROLES] },
      },
    }),
    prisma.staffInvite.count({
      where: {
        organizationId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
        ...(options.ignoreInviteId ? { id: { not: options.ignoreInviteId } } : {}),
      },
    }),
  ]);

  const total = included + extra;
  const used = members + pendingInvites;

  return {
    included,
    extra,
    total,
    members,
    pendingInvites,
    used,
    // Puo' capitare di avere piu' membri che posti — per esempio dopo un
    // declassamento di piano. In quel caso non si butta fuori nessuno: si
    // smette solo di poterne aggiungere.
    available: Math.max(0, total - used),
  };
}

/** Alzata quando non c'e' un posto libero. La rotta la traduce in 402. */
export class NoSeatAvailableError extends Error {
  readonly usage: SeatUsage;

  constructor(usage: SeatUsage) {
    super('Nessun posto disponibile nel piano');
    this.name = 'NoSeatAvailableError';
    this.usage = usage;
  }
}

/**
 * Controlla che ci sia un posto e lo "prenota" logicamente.
 *
 * Va chiamata DUE volte: quando l'invito parte e quando viene accettato. Fra
 * i due momenti possono passare giorni, e nel mezzo il piano puo' essere
 * declassato o i posti possono essersi riempiti per altra via. Controllare
 * solo all'invio lascerebbe entrare persone su posti che nel frattempo non
 * esistono piu'.
 */
export async function assertSeatAvailable(
  prisma: Db,
  organizationId: string,
  options: { ignoreInviteId?: string } = {},
): Promise<SeatUsage> {
  const usage = await getSeatUsage(prisma, organizationId, options);
  if (usage.available < 1) throw new NoSeatAvailableError(usage);
  return usage;
}
