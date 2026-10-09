/**
 * Piani, prova gratuita ed estensioni (dal 9 ottobre 2026).
 *
 * Fonte delle regole commerciali: marketing/Strategia_commerciale_basket_v3.docx.
 * Questo file e' l'unico posto in cui i numeri del listino diventano codice:
 * le rotte chiedono qui "si puo'?", non contano da sole.
 *
 * Due offerte:
 *   - Individuale (Strength and Conditioning Coach): STARTER, PROFESSIONAL, ULTRA
 *   - Club / Societa': CLUB, piano unico
 * piu' la prova gratuita, che non e' un piano ma uno stato dell'organizzazione
 * (`trialEndsAt` valorizzata).
 *
 * Tre interruttori decidono se un limite morde davvero:
 *   1. PLAN_ENFORCEMENT=true nell'ambiente. Spento (il default) l'app si
 *      comporta esattamente come prima: si calcola tutto, non si blocca niente.
 *      Va acceso in produzione solo quando pagamenti e partita IVA sono pronti.
 *   2. `planLegacy`: le organizzazioni nate prima dei piani nuovi sono esenti
 *      finche' non si decide altrimenti, anche con l'interruttore acceso.
 *   3. il piano stesso (limiti, funzioni, estensioni).
 *
 * Regola d'oro di ogni guardia: un limite superato NON cancella e non nasconde
 * niente. Si smette solo di poter aggiungere. Chi scende di piano con quattro
 * squadre se le ritrova tutte, semplicemente non ne crea una quinta.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getCreditsForOperation, type AiOperation } from './ai-models.js';

// Stesso alias di seats.ts: il client Prisma si prende da Fastify.
type Db = FastifyInstance['prisma'];

export type PlanTier = 'STARTER' | 'PROFESSIONAL' | 'ULTRA' | 'CLUB';
export type PlanFeature = 'ai' | 'analytics' | 'dailyReport' | 'gameReport' | 'reports' | 'adaptations';
export type BillingCycle = 'monthly' | 'yearly';

export interface PlanSpec {
  offer: 'INDIVIDUAL' | 'CLUB' | 'TRIAL';
  teams: number;
  athletesPerTeam: number;
  /** Utenti dello staff inclusi. */
  seats: number;
  /** Crediti AI inclusi ogni mese. */
  aiCredits: number;
  features: Record<PlanFeature, boolean>;
  /** Squadre, pacchetti di atleti e utenti aggiuntivi acquistabili. */
  extensions: boolean;
  /** Prezzi IVA inclusa. null per la prova. */
  price: { monthly: number; yearly: number } | null;
}

const ALL_FEATURES: Record<PlanFeature, boolean> = {
  ai: true,
  analytics: true,
  dailyReport: true,
  gameReport: true,
  reports: true,
  adaptations: true,
};

/**
 * Il listino. Prezzi tondi e IVA inclusa; l'annuale vale dieci mensilita'.
 *
 * Lo Starter non ha AI, Analytics, report giornaliero e report post-partita:
 * e' la mappatura confermata l'8/10/2026. Periodizzazione e RTP restano per
 * tutti (i suggerimenti RTP scritti dall'AI no, perche' sono AI).
 */
export const PLAN_SPECS: Record<PlanTier, PlanSpec> = {
  STARTER: {
    offer: 'INDIVIDUAL',
    teams: 1,
    athletesPerTeam: 12,
    seats: 1,
    aiCredits: 0,
    features: { ai: false, analytics: false, dailyReport: false, gameReport: false, reports: true, adaptations: true },
    extensions: false,
    price: { monthly: 15, yearly: 150 },
  },
  PROFESSIONAL: {
    offer: 'INDIVIDUAL',
    teams: 2,
    athletesPerTeam: 14,
    seats: 1,
    aiCredits: 200,
    features: ALL_FEATURES,
    extensions: false,
    price: { monthly: 30, yearly: 300 },
  },
  ULTRA: {
    offer: 'INDIVIDUAL',
    teams: 4,
    athletesPerTeam: 20,
    seats: 2,
    aiCredits: 500,
    features: ALL_FEATURES,
    extensions: true,
    price: { monthly: 35, yearly: 350 },
  },
  CLUB: {
    offer: 'CLUB',
    teams: 6,
    athletesPerTeam: 20,
    seats: 4,
    aiCredits: 750,
    features: ALL_FEATURES,
    extensions: true,
    price: { monthly: 50, yearly: 500 },
  },
};

/**
 * Prova gratuita: unica per entrambe le offerte. Capienza dello Starter, con
 * Analytics (cosi' chi poi sceglie lo Starter perde qualcosa che ha gia'
 * usato), ma senza AI e senza Adattamenti AI (decisioni del 9/10/2026).
 * Dei report resta UN SOLO report giornaliero di prova (TRIAL_DAILY_REPORTS,
 * vedi assertTrialDailyReport): basta a mantenere la promessa "il primo report
 * in dieci minuti". Generatore, invii programmati e post-partita no.
 */
export const TRIAL_SPEC: PlanSpec = {
  offer: 'TRIAL',
  teams: 1,
  athletesPerTeam: 12,
  seats: 1,
  aiCredits: 0,
  features: { ai: false, analytics: true, dailyReport: true, gameReport: false, reports: false, adaptations: false },
  extensions: false,
  price: null,
};

export const TRIAL_DAYS = 15;

/** Report giornalieri (una squadra, un giorno) compresi nella prova gratuita. */
export const TRIAL_DAILY_REPORTS = 1;

/** Estensioni: stesso listino per Ultra e Club. */
export const EXTENSIONS = {
  team: { monthly: 8, yearly: 80, aiCredits: 100 },
  athletePack: { size: 5, monthly: 2, yearly: 20 },
  seat: { monthly: 10, yearly: 100 },
} as const;

/** Tetto alle quantita' impostabili in una volta: un argine ai refusi. */
export const MAX_EXTENSION_QTY = 50;

export const MAX_REACTIVATIONS_PER_MONTH = 10;

/** Sopra questa quota dei crediti l'interfaccia avvisa. */
export const AI_ALERT_RATIO = 0.8;

/**
 * Posti dello staff come erano PRIMA dei piani nuovi. Valgono per gli account
 * storici e per tutti quando l'interruttore e' spento, cosi' spegnerlo
 * riporta davvero il comportamento di prima.
 */
export const LEGACY_SEATS_BY_TIER: Record<string, number> = {
  STARTER: 1,
  PROFESSIONAL: 2,
  ULTRA: 4,
  CLUB: 4,
};

export function isPlanEnforcementEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PLAN_ENFORCEMENT === 'true';
}

export function isPlanTier(value: unknown): value is PlanTier {
  return typeof value === 'string' && value in PLAN_SPECS;
}

/** Tier sconosciuto -> STARTER: il minimo, mai il massimo. */
export function normalizeTier(value: string | null | undefined): PlanTier {
  const upper = (value ?? '').toUpperCase();
  return isPlanTier(upper) ? upper : 'STARTER';
}

// ─── Stato del piano ─────────────────────────────────────

/**
 *  legacy  account storico, esente
 *  trial   prova in corso
 *  expired prova finita senza piano: sola lettura
 *  active  piano scelto
 */
export type PlanMode = 'legacy' | 'trial' | 'expired' | 'active';

export interface OrgPlanRow {
  tier: string;
  planLegacy: boolean;
  trialEndsAt: Date | null;
  extraTeams: number;
  extraSeats: number;
}

export interface ResolvedPlan {
  mode: PlanMode;
  tier: PlanTier;
  /** true = per questa organizzazione i limiti valgono davvero. */
  enforced: boolean;
  /** Prova scaduta con l'interruttore acceso: si legge e si esporta, non si scrive. */
  readOnly: boolean;
  trialEndsAt: Date | null;
  /** Giorni di prova rimasti (arrotondati per eccesso). null fuori prova. */
  trialDaysLeft: number | null;
  spec: PlanSpec;
  limits: { teams: number; athletesPerTeam: number; seats: number; aiCredits: number };
  features: Record<PlanFeature, boolean>;
  extensionsAllowed: boolean;
}

const DAY_MS = 86_400_000;

export function resolvePlan(
  org: OrgPlanRow,
  now: Date = new Date(),
  enforcementOn: boolean = isPlanEnforcementEnabled(),
): ResolvedPlan {
  const tier = normalizeTier(org.tier);

  let mode: PlanMode;
  if (org.planLegacy) mode = 'legacy';
  else if (org.trialEndsAt) mode = org.trialEndsAt.getTime() > now.getTime() ? 'trial' : 'expired';
  else mode = 'active';

  const inTrial = mode === 'trial' || mode === 'expired';
  const spec = inTrial ? TRIAL_SPEC : PLAN_SPECS[tier];
  const extraTeams = spec.extensions ? Math.max(0, org.extraTeams || 0) : 0;
  const enforced = enforcementOn && mode !== 'legacy';

  let trialDaysLeft: number | null = null;
  if (mode === 'trial' && org.trialEndsAt) {
    trialDaysLeft = Math.max(0, Math.ceil((org.trialEndsAt.getTime() - now.getTime()) / DAY_MS));
  } else if (mode === 'expired') {
    trialDaysLeft = 0;
  }

  return {
    mode,
    tier,
    enforced,
    readOnly: enforced && mode === 'expired',
    trialEndsAt: inTrial ? org.trialEndsAt : null,
    trialDaysLeft,
    spec,
    limits: {
      teams: spec.teams + extraTeams,
      athletesPerTeam: spec.athletesPerTeam,
      seats: spec.seats,
      aiCredits: spec.aiCredits + extraTeams * EXTENSIONS.team.aiCredits,
    },
    features: { ...spec.features },
    extensionsAllowed: spec.extensions,
  };
}

/** Capienza di una squadra: atleti inclusi piu' i pacchetti comprati per lei. */
export function teamCapacity(plan: ResolvedPlan, extraAthletePacks: number): number {
  const packs = plan.extensionsAllowed ? Math.max(0, extraAthletePacks || 0) : 0;
  return plan.limits.athletesPerTeam + packs * EXTENSIONS.athletePack.size;
}

/**
 * Inizio del periodo dei crediti AI e delle riattivazioni: il primo giorno del
 * mese, in UTC. Quando Stripe sara' collegato si potra' passare alla data di
 * rinnovo; per ora il mese di calendario e' l'unico riferimento che esiste
 * per tutti, anche per chi non paga attraverso Stripe.
 */
export function monthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Data di fine prova per una registrazione fatta adesso. */
export function trialEndDate(now: Date = new Date()): Date {
  return new Date(now.getTime() + TRIAL_DAYS * DAY_MS);
}

// ─── Errori ──────────────────────────────────────────────

/**
 * Limite del piano raggiunto. Le rotte lo traducono in 402: non e' un
 * permesso che manca (403), e' qualcosa da comprare. Il `code` e' quello che
 * l'interfaccia traduce; `details` porta i numeri da mostrare.
 */
export class PlanLimitError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: Record<string, string | number> = {},
  ) {
    super(message);
    this.name = 'PlanLimitError';
  }
}

export function sendPlanError(reply: FastifyReply, err: PlanLimitError) {
  return reply.status(402).send({
    success: false,
    error: { code: err.code, message: err.message, details: err.details },
  });
}

// ─── Letture dal database ────────────────────────────────

const ORG_PLAN_SELECT = {
  tier: true,
  planLegacy: true,
  trialEndsAt: true,
  extraTeams: true,
  extraSeats: true,
} as const;

export async function loadPlan(prisma: Db, organizationId: string, now: Date = new Date()): Promise<ResolvedPlan> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: ORG_PLAN_SELECT,
  });
  // Organizzazione non trovata: la si tratta come storica, cioe' senza
  // blocchi. Le rotte hanno gia' le loro guardie sull'esistenza dei dati, e
  // un limite che scatta su un id sbagliato confonderebbe la diagnosi.
  if (!org) {
    return resolvePlan({ tier: 'STARTER', planLegacy: true, trialEndsAt: null, extraTeams: 0, extraSeats: 0 }, now);
  }
  return resolvePlan(org, now);
}

/** Crediti AI consumati nel mese. Le chiamate fallite non costano niente. */
export async function countAiCreditsUsed(prisma: Db, organizationId: string, now: Date = new Date()): Promise<number> {
  const agg = await prisma.aiUsageLog.aggregate({
    where: { organizationId, success: true, createdAt: { gte: monthStart(now) } },
    _sum: { creditsCharged: true },
  });
  return agg._sum.creditsCharged ?? 0;
}

export async function countReactivationsThisMonth(prisma: Db, organizationId: string, now: Date = new Date()): Promise<number> {
  return prisma.athleteReactivation.count({
    where: { organizationId, createdAt: { gte: monthStart(now) } },
  });
}

/** Atleti attivi in una squadra (gli archiviati escono gia' dalle rose). */
async function activeMemberIds(prisma: Db, teamId: string): Promise<Set<string>> {
  const rows = await prisma.athleteTeam.findMany({
    where: { teamId, athlete: { isActive: true } },
    select: { athleteId: true },
  });
  return new Set(rows.map((r) => r.athleteId));
}

/**
 * Capienza complessiva dell'organizzazione: squadre consentite per atleti per
 * squadra, piu' i pacchetti. Serve a chiudere l'unica scorciatoia possibile,
 * cioe' tenere atleti attivi fuori da ogni squadra.
 */
async function organizationCapacity(prisma: Db, organizationId: string, plan: ResolvedPlan): Promise<number> {
  let packs = 0;
  if (plan.extensionsAllowed) {
    const agg = await prisma.team.aggregate({
      where: { organizationId },
      _sum: { extraAthletePacks: true },
    });
    packs = agg._sum.extraAthletePacks ?? 0;
  }
  return plan.limits.teams * plan.limits.athletesPerTeam + packs * EXTENSIONS.athletePack.size;
}

// ─── Guardie ─────────────────────────────────────────────
// Tutte no-op quando il piano non e' applicato (interruttore spento o
// account storico).

export async function assertCanCreateTeam(prisma: Db, organizationId: string): Promise<void> {
  const plan = await loadPlan(prisma, organizationId);
  if (!plan.enforced) return;
  const teams = await prisma.team.count({ where: { organizationId } });
  if (teams >= plan.limits.teams) {
    throw new PlanLimitError(
      'PLAN_TEAM_LIMIT',
      `Il piano include al massimo ${plan.limits.teams} squadre`,
      { limit: plan.limits.teams, canExtend: plan.extensionsAllowed ? 'yes' : 'no' },
    );
  }
}

/** La squadra ha posto per questi atleti? Quelli gia' in rosa non contano due volte. */
export async function assertTeamHasRoom(
  prisma: Db,
  organizationId: string,
  teamId: string,
  athleteIds: string[],
): Promise<void> {
  const plan = await loadPlan(prisma, organizationId);
  if (!plan.enforced) return;

  const team = await prisma.team.findFirst({
    where: { id: teamId, organizationId },
    select: { extraAthletePacks: true },
  });
  if (!team) return; // la rotta rispondera' "squadra non trovata"

  const capacity = teamCapacity(plan, team.extraAthletePacks);
  const current = await activeMemberIds(prisma, teamId);
  const adding = new Set(athleteIds.filter((id) => !current.has(id))).size;
  if (adding > 0 && current.size + adding > capacity) {
    throw new PlanLimitError(
      'PLAN_ATHLETE_LIMIT',
      `La squadra puo' avere al massimo ${capacity} atleti`,
      { limit: capacity, canExtend: plan.extensionsAllowed ? 'yes' : 'no' },
    );
  }
}

/** C'e' posto per altri `adding` atleti attivi nell'organizzazione? */
export async function assertOrganizationHasRoom(prisma: Db, organizationId: string, adding = 1): Promise<void> {
  const plan = await loadPlan(prisma, organizationId);
  if (!plan.enforced) return;

  const [active, capacity] = await Promise.all([
    prisma.athlete.count({ where: { organizationId, isActive: true } }),
    organizationCapacity(prisma, organizationId, plan),
  ]);
  if (active + adding > capacity) {
    throw new PlanLimitError(
      'PLAN_ATHLETE_TOTAL_LIMIT',
      `Il piano include al massimo ${capacity} atleti attivi`,
      { limit: capacity, canExtend: plan.extensionsAllowed ? 'yes' : 'no' },
    );
  }
}

/**
 * Prova gratuita: un solo report giornaliero. Quello si puo' riaprire,
 * modificare ed esportare quante volte si vuole; un altro giorno o un'altra
 * squadra no. Vale anche a prova scaduta (in sola lettura lo si consulta).
 *
 * `requireSaved` serve all'export: senza, si potrebbero scaricare giorni
 * diversi senza mai salvarli e il limite non conterebbe niente.
 */
export async function assertTrialDailyReport(
  prisma: Db,
  organizationId: string,
  teamId: string,
  date: string,
  opts: { requireSaved?: boolean } = {},
): Promise<void> {
  const plan = await loadPlan(prisma, organizationId);
  if (!plan.enforced || (plan.mode !== 'trial' && plan.mode !== 'expired')) return;

  const saved = await prisma.dailyReport.findMany({
    where: { organizationId },
    select: { teamId: true, date: true },
    orderBy: { createdAt: 'asc' },
    take: TRIAL_DAILY_REPORTS + 1,
  });
  const isSame = (r: { teamId: string; date: Date }) =>
    r.teamId === teamId && r.date.toISOString().slice(0, 10) === date;
  if (saved.some(isSame)) return;

  if (saved.length >= TRIAL_DAILY_REPORTS) {
    const first = saved[0];
    throw new PlanLimitError(
      'PLAN_TRIAL_REPORT_LIMIT',
      `La prova gratuita comprende ${TRIAL_DAILY_REPORTS} report giornaliero`,
      { limit: TRIAL_DAILY_REPORTS, teamId: first.teamId, date: first.date.toISOString().slice(0, 10) },
    );
  }
  if (opts.requireSaved) {
    throw new PlanLimitError(
      'PLAN_TRIAL_REPORT_SAVE_FIRST',
      'Nella prova gratuita il report si esporta dopo averlo salvato',
    );
  }
}

export async function assertReactivationAllowed(prisma: Db, organizationId: string): Promise<void> {
  const plan = await loadPlan(prisma, organizationId);
  if (!plan.enforced) return;
  const used = await countReactivationsThisMonth(prisma, organizationId);
  if (used >= MAX_REACTIVATIONS_PER_MONTH) {
    throw new PlanLimitError(
      'PLAN_REACTIVATION_LIMIT',
      `Al massimo ${MAX_REACTIVATIONS_PER_MONTH} riattivazioni al mese`,
      { limit: MAX_REACTIVATIONS_PER_MONTH },
    );
  }
}

/**
 * Registra una riattivazione. Sempre, anche a interruttore spento: il giorno
 * in cui lo si accende il conteggio del mese e' gia' vero. Non deve mai far
 * fallire il ripristino: se la tabella non c'e' (migrazione non ancora
 * applicata) si scrive nel log e si va avanti.
 */
export async function recordReactivation(
  app: FastifyInstance,
  organizationId: string,
  athleteId: string,
  userId: string | null,
): Promise<void> {
  try {
    await app.prisma.athleteReactivation.create({ data: { organizationId, athleteId, userId } });
  } catch (err) {
    app.log.warn({ err, organizationId, athleteId }, 'Riattivazione non registrata');
  }
}

export function assertFeature(plan: ResolvedPlan, feature: PlanFeature): void {
  if (!plan.enforced || plan.features[feature]) return;
  throw new PlanLimitError(
    'PLAN_FEATURE_UNAVAILABLE',
    'Questa funzione non e\' inclusa nel piano',
    { feature },
  );
}

/** AI disponibile per questa operazione? Funzione nel piano + crediti del mese. */
export async function assertAiAvailable(prisma: Db, organizationId: string, operation: AiOperation): Promise<void> {
  const plan = await loadPlan(prisma, organizationId);
  if (!plan.enforced) return;
  assertFeature(plan, 'ai');

  const used = await countAiCreditsUsed(prisma, organizationId);
  const cost = getCreditsForOperation(operation);
  if (used + cost > plan.limits.aiCredits) {
    throw new PlanLimitError(
      'AI_QUOTA_EXCEEDED',
      'Crediti AI del mese esauriti',
      { used, limit: plan.limits.aiCredits },
    );
  }
}

/** Come sopra, ma risponde si'/no: per chi ha gia' un piano B (la sintesi dei report). */
export async function isAiAvailable(prisma: Db, organizationId: string, operation: AiOperation): Promise<boolean> {
  try {
    await assertAiAvailable(prisma, organizationId, operation);
    return true;
  } catch (err) {
    if (err instanceof PlanLimitError) return false;
    throw err;
  }
}

// ─── Adattatori per Fastify ──────────────────────────────

/** preHandler: la funzione dev'essere nel piano. Va messo DOPO app.authenticate. */
export function requirePlanFeature(app: FastifyInstance, feature: PlanFeature) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isPlanEnforcementEnabled()) return;
    const plan = await loadPlan(app.prisma, request.user.organizationId);
    try {
      assertFeature(plan, feature);
    } catch (err) {
      if (err instanceof PlanLimitError) return sendPlanError(reply, err);
      throw err;
    }
  };
}

/**
 * Rotte che restano scrivibili anche in sola lettura: accesso e password,
 * scelta del piano, diritti GDPR (esportazione, cancellazione, consensi) e
 * notifiche lette. Tutto il resto, a prova scaduta, risponde PLAN_READ_ONLY.
 */
const READ_ONLY_ALLOWED_PREFIXES = [
  '/api/v1/auth/',
  '/api/v1/billing/',
  '/api/v1/gdpr/',
  '/api/v1/notifications',
];

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Sola lettura a prova scaduta. Chiamata dal plugin di autenticazione per lo
 * staff (gli atleti hanno la loro app e i loro dati: non si blocca chi compila
 * il wellness per colpa di un abbonamento che non e' suo).
 */
export async function readOnlyViolation(
  prisma: Db,
  request: FastifyRequest,
): Promise<PlanLimitError | null> {
  if (!isPlanEnforcementEnabled()) return null;
  if (!MUTATING_METHODS.has(request.method)) return null;
  const route = request.routeOptions?.url ?? request.url;
  if (READ_ONLY_ALLOWED_PREFIXES.some((p) => route.startsWith(p))) return null;

  const plan = await loadPlan(prisma, request.user.organizationId);
  if (!plan.readOnly) return null;
  return new PlanLimitError(
    'PLAN_READ_ONLY',
    'La prova gratuita e\' terminata: scegli un piano per continuare a modificare i dati',
  );
}

// ─── Riepilogo per l'interfaccia ─────────────────────────

export interface PlanOverview {
  enforced: boolean;
  mode: PlanMode;
  tier: PlanTier;
  offer: PlanSpec['offer'];
  readOnly: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  intendedTier: PlanTier | null;
  billingCycle: BillingCycle | null;
  limits: ResolvedPlan['limits'];
  features: Record<PlanFeature, boolean>;
  extensionsAllowed: boolean;
  extensions: { extraTeams: number; extraSeats: number };
  usage: {
    teams: number;
    athletesActive: number;
    athleteCapacity: number;
    perTeam: Array<{ id: string; name: string; athletes: number; capacity: number; extraAthletePacks: number }>;
    aiCreditsUsed: number;
    aiPeriodStart: string;
    aiAlert: boolean;
    reactivationsThisMonth: number;
    reactivationsLimit: number;
  };
}

export async function getPlanOverview(prisma: Db, organizationId: string, now: Date = new Date()): Promise<PlanOverview> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { ...ORG_PLAN_SELECT, intendedTier: true, billingCycle: true },
  });
  const plan = org
    ? resolvePlan(org, now)
    : resolvePlan({ tier: 'STARTER', planLegacy: true, trialEndsAt: null, extraTeams: 0, extraSeats: 0 }, now);

  const [teams, athletesActive, aiCreditsUsed, reactivations] = await Promise.all([
    prisma.team.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        extraAthletePacks: true,
        _count: { select: { athleteTeams: { where: { athlete: { isActive: true } } } } },
      },
    }),
    prisma.athlete.count({ where: { organizationId, isActive: true } }),
    countAiCreditsUsed(prisma, organizationId, now),
    countReactivationsThisMonth(prisma, organizationId, now),
  ]);

  const packs = plan.extensionsAllowed ? teams.reduce((n, t) => n + t.extraAthletePacks, 0) : 0;
  const cycle = org?.billingCycle === 'monthly' || org?.billingCycle === 'yearly' ? org.billingCycle : null;

  return {
    enforced: plan.enforced,
    mode: plan.mode,
    tier: plan.tier,
    offer: plan.spec.offer,
    readOnly: plan.readOnly,
    trialEndsAt: plan.trialEndsAt ? plan.trialEndsAt.toISOString() : null,
    trialDaysLeft: plan.trialDaysLeft,
    intendedTier: org?.intendedTier && isPlanTier(org.intendedTier) ? org.intendedTier : null,
    billingCycle: cycle,
    limits: plan.limits,
    features: plan.features,
    extensionsAllowed: plan.extensionsAllowed,
    extensions: { extraTeams: org?.extraTeams ?? 0, extraSeats: org?.extraSeats ?? 0 },
    usage: {
      teams: teams.length,
      athletesActive,
      athleteCapacity: plan.limits.teams * plan.limits.athletesPerTeam + packs * EXTENSIONS.athletePack.size,
      perTeam: teams.map((t) => ({
        id: t.id,
        name: t.name,
        athletes: t._count.athleteTeams,
        capacity: teamCapacity(plan, t.extraAthletePacks),
        extraAthletePacks: t.extraAthletePacks,
      })),
      aiCreditsUsed,
      aiPeriodStart: monthStart(now).toISOString(),
      aiAlert: plan.limits.aiCredits > 0 && aiCreditsUsed >= plan.limits.aiCredits * AI_ALERT_RATIO,
      reactivationsThisMonth: reactivations,
      reactivationsLimit: MAX_REACTIVATIONS_PER_MONTH,
    },
  };
}

/** Listino pubblico, per la pagina Abbonamento e la landing. */
export function publicCatalog() {
  return {
    trial: { days: TRIAL_DAYS, ...TRIAL_SPEC, price: null },
    plans: (Object.keys(PLAN_SPECS) as PlanTier[]).map((tier) => ({ tier, ...PLAN_SPECS[tier] })),
    extensions: EXTENSIONS,
    reactivationsPerMonth: MAX_REACTIVATIONS_PER_MONTH,
  };
}
