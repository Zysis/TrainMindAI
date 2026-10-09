/**
 * Sprint 5.3 — Stripe Billing Routes
 *
 * Endpoints:
 *   POST   /billing/checkout         Create Stripe Checkout session
 *   POST   /billing/portal           Create Stripe Customer Portal session
 *   GET    /billing/subscription     Get current subscription status
 *   POST   /billing/seats            Buy extra staff seats
 *   POST   /billing/webhook          Stripe webhook handler (no auth)
 *
 * Dal 9/10/2026 (piani nuovi, vedi lib/plans.ts):
 *   GET    /billing/entitlements     Piano, prova, limiti, uso e listino
 *   POST   /billing/activate         Sceglie un piano (Stripe o, senza
 *                                    Stripe, assegnazione diretta)
 *   POST   /billing/extensions       Squadre, pacchetti atleti, utenti in piu'
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import Stripe from 'stripe';
import { requireRole } from '../middleware/rbac.js';
import { getSeatUsage, SEATS_BY_TIER } from '../lib/seats.js';
import { appPublicUrl } from '../lib/app-url.js';
import {
  getPlanOverview,
  loadPlan,
  MAX_EXTENSION_QTY,
  PLAN_SPECS,
  publicCatalog,
  type BillingCycle,
  type PlanTier,
} from '../lib/plans.js';

// ─── Stripe client (lazy init) ─────────────────────────

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key.startsWith('sk_test_xxx')) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    stripeClient = new Stripe(key, { apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion });
  }
  return stripeClient;
}

function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  return !!key && !key.startsWith('sk_test_xxx') && key.length > 20;
}

// ─── Pricing tiers ─────────────────────────────────────

/**
 * Price di Stripe per piano e ciclo. Le variabili nuove hanno il ciclo nel
 * nome (STRIPE_PRICE_ULTRA_YEARLY); per il mensile si accetta ancora quella
 * vecchia senza suffisso, cosi' una configurazione gia' fatta continua a
 * funzionare. Nomi e funzioni dei piani stanno in lib/plans.ts.
 */
function planPriceId(tier: PlanTier, cycle: BillingCycle): string {
  const suffix = cycle === 'yearly' ? 'YEARLY' : 'MONTHLY';
  const specific = process.env[`STRIPE_PRICE_${tier}_${suffix}`];
  if (specific) return specific;
  return cycle === 'monthly' ? process.env[`STRIPE_PRICE_${tier}`] || '' : '';
}

/** Price delle estensioni: STRIPE_PRICE_EXTRA_TEAM / _ATHLETES / _SEAT, + _YEARLY. */
function extensionPriceId(kind: 'teams' | 'athletes', cycle: BillingCycle): string {
  const base = kind === 'teams' ? 'STRIPE_PRICE_EXTRA_TEAM' : 'STRIPE_PRICE_EXTRA_ATHLETES';
  return (cycle === 'yearly' ? process.env[`${base}_YEARLY`] : process.env[base]) || '';
}

const PLAN_NAMES: Record<PlanTier, string> = {
  STARTER: 'Starter',
  PROFESSIONAL: 'Professional',
  ULTRA: 'Ultra',
  CLUB: 'Club',
};

/**
 * Posto aggiuntivo dello staff: costa quanto un abbonamento Starter.
 *
 * Di default riusa il price dello Starter, cosi' non serve creare niente in
 * Stripe per far partire la funzione. Se un giorno il posto dovesse avere un
 * prezzo suo (uno sconto per volume, per dire), basta valorizzare
 * STRIPE_PRICE_SEAT senza toccare il codice.
 */
function seatPriceId(): string {
  return process.env.STRIPE_PRICE_SEAT || process.env.STRIPE_PRICE_STARTER || '';
}

/**
 * Da tier pubblico (minuscolo, quello di Stripe) all'enum del database.
 *
 * Serve perche' `Organization.tier` e `Organization.subscriptionTier` sono
 * due colonne diverse: la prima e' l'enum scritto alla registrazione, la
 * seconda la stringa che arriva da Stripe. Finora il webhook aggiornava solo
 * la seconda, quindi chi cambiava piano pagando restava con il `tier` del
 * giorno dell'iscrizione. Fino a ieri era un'incoerenza da rapporti; adesso
 * che i posti dipendono dal tier sarebbe un cliente che paga il Professional
 * e non riesce a invitare nessuno.
 */
const TIER_TO_ENUM: Record<string, PlanTier> = {
  starter: 'STARTER',
  professional: 'PROFESSIONAL',
  ultra: 'ULTRA',
  club: 'CLUB',
};

/**
 * URL di ritorno da Stripe: quello chiesto dal client solo se punta alla
 * nostra applicazione, altrimenti quello di default.
 *
 * Senza questo controllo `successUrl` era un redirect aperto: una pagina di
 * pagamento autentica di Stripe che, finito il pagamento, rimanda dove vuole
 * chi ha costruito la richiesta. I client attuali non mandano questi campi,
 * quindi il default e' anche il comportamento di oggi.
 */
export function sameOriginOr(requested: string | undefined, fallback: string): string {
  if (!requested) return fallback;
  try {
    return new URL(requested).origin === new URL(fallback).origin ? requested : fallback;
  } catch {
    return fallback;
  }
}

// ─── Schemas ───────────────────────────────────────────

const checkoutSchema = z.object({
  tier: z.enum(['starter', 'professional', 'ultra', 'club']),
  cycle: z.enum(['monthly', 'yearly']).optional().default('monthly'),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

/** Scelta del piano dalla pagina Abbonamento. */
const activateSchema = z.object({
  tier: z.enum(['starter', 'professional', 'ultra', 'club']),
  cycle: z.enum(['monthly', 'yearly']).default('monthly'),
});

/**
 * Estensioni: valori ASSOLUTI desiderati, non incrementi. Cosi' la stessa
 * richiesta mandata due volte (doppio clic, rete lenta) non compra il doppio.
 * Senza Stripe si applicano subito; con Stripe si paga solo la differenza in
 * piu' (le riduzioni passano dal portale clienti).
 */
const extensionsSchema = z.object({
  extraTeams: z.number().int().min(0).max(MAX_EXTENSION_QTY).optional(),
  extraSeats: z.number().int().min(0).max(MAX_EXTENSION_QTY).optional(),
  teamPacks: z
    .array(z.object({ teamId: z.string().min(1), packs: z.number().int().min(0).max(MAX_EXTENSION_QTY) }))
    .max(100)
    .optional(),
  cycle: z.enum(['monthly', 'yearly']).default('monthly'),
});

/** Quanti posti comprare in una volta. Il tetto e' un argine ai refusi. */
const seatCheckoutSchema = z.object({
  quantity: z.number().int().min(1).max(20).default(1),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

// ─── Routes ────────────────────────────────────────────

export async function billingRoutes(app: FastifyInstance) {

  // ─── GET /billing/plans — Public pricing info ──────
  app.get('/billing/plans', async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        plans: (Object.keys(PLAN_SPECS) as PlanTier[]).map((tier) => ({
          id: tier.toLowerCase(),
          name: PLAN_NAMES[tier],
          offer: PLAN_SPECS[tier].offer,
          price: PLAN_SPECS[tier].price,
        })),
        catalog: publicCatalog(),
      },
    });
  });

  // ─── GET /billing/entitlements — Piano, prova, limiti e uso ──
  // Letta da tutto lo staff: serve a banner, blocchi e pagina Abbonamento.
  app.get('/billing/entitlements', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const overview = await getPlanOverview(app.prisma, request.user.organizationId);
    return reply.send({
      success: true,
      data: {
        ...overview,
        stripeConfigured: isStripeConfigured(),
        catalog: publicCatalog(),
      },
    });
  });

  // ─── POST /billing/activate — Sceglie il piano ──────
  // Due strade, decise dalla configurazione e non dal client:
  //  - Stripe collegato: si apre il checkout del piano e del ciclo scelti; il
  //    piano cambia quando arriva il webhook, cioe' a pagamento avvenuto.
  //  - Stripe non collegato: il piano viene assegnato subito, come e' sempre
  //    successo con il piano scelto in registrazione. E' il comportamento
  //    deciso l'8/10/2026 finche' i pagamenti non sono pronti.
  app.post('/billing/activate', {
    preHandler: [app.authenticate, requireRole('ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = activateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Parametri non validi' },
      });
    }
    const { organizationId, userId, email } = request.user;
    const tierEnum = TIER_TO_ENUM[parsed.data.tier];
    const cycle = parsed.data.cycle;

    if (isStripeConfigured()) {
      const priceId = planPriceId(tierEnum, cycle);
      if (!priceId) {
        return reply.status(503).send({
          success: false,
          error: { code: 'PLAN_PRICE_MISSING', message: 'Prezzo del piano non configurato in Stripe' },
        });
      }
      const stripe = getStripe();
      const appUrl = appPublicUrl();
      const customerId = await ensureStripeCustomer(app, stripe, organizationId, userId, email);
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/dashboard/billing?billing=success`,
        cancel_url: `${appUrl}/dashboard/billing?billing=cancelled`,
        metadata: { organizationId, userId, tier: parsed.data.tier, cycle },
        subscription_data: { metadata: { organizationId, tier: parsed.data.tier, cycle } },
      });
      return reply.send({ success: true, data: { url: session.url, activated: false } });
    }

    // Senza Stripe: assegnazione diretta. Le estensioni restano dove sono; se
    // il piano nuovo non le prevede, lib/plans.ts semplicemente non le conta.
    await app.prisma.organization.update({
      where: { id: organizationId },
      data: {
        tier: tierEnum,
        subscriptionTier: parsed.data.tier,
        billingCycle: cycle,
        trialEndsAt: null,
      },
    });
    request.log.info({ organizationId, tier: tierEnum, cycle }, 'Piano assegnato senza Stripe');
    return reply.send({ success: true, data: { url: null, activated: true } });
  });

  // ─── POST /billing/extensions — Squadre, atleti, utenti in piu' ──
  app.post('/billing/extensions', {
    preHandler: [app.authenticate, requireRole('ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = extensionsSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Parametri non validi' },
      });
    }
    const { organizationId, userId, email } = request.user;
    const { extraTeams, extraSeats, teamPacks, cycle } = parsed.data;

    const plan = await loadPlan(app.prisma, organizationId);
    // Le estensioni esistono solo su Ultra e Club. Gli account storici le
    // possono avere comunque (non hanno limiti, ma i numeri restano coerenti
    // il giorno in cui smettono di essere esenti).
    if (!plan.extensionsAllowed && plan.mode !== 'legacy') {
      return reply.status(402).send({
        success: false,
        error: { code: 'PLAN_EXTENSIONS_UNAVAILABLE', message: 'Le estensioni sono disponibili con Ultra e Club' },
      });
    }

    // Le squadre dei pacchetti devono essere dell'organizzazione.
    if (teamPacks && teamPacks.length > 0) {
      const ids = [...new Set(teamPacks.map((p) => p.teamId))];
      const found = await app.prisma.team.count({ where: { id: { in: ids }, organizationId } });
      if (found !== ids.length) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_TEAM', message: 'Squadra non trovata' },
        });
      }
    }

    if (isStripeConfigured()) {
      // Con Stripe si compra solo l'aumento; per ridurre c'e' il portale.
      const org = await app.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { extraTeams: true, extraSeats: true, teams: { select: { id: true, extraAthletePacks: true } } },
      });
      const currentPacks = new Map((org?.teams ?? []).map((t) => [t.id, t.extraAthletePacks]));
      const lines: Array<{ price: string; quantity: number }> = [];
      const teamsDelta = extraTeams !== undefined ? extraTeams - (org?.extraTeams ?? 0) : 0;
      const seatsDelta = extraSeats !== undefined ? extraSeats - (org?.extraSeats ?? 0) : 0;
      const packsDelta = (teamPacks ?? []).map((p) => ({ teamId: p.teamId, delta: p.packs - (currentPacks.get(p.teamId) ?? 0) }))
        .filter((p) => p.delta > 0);
      if (teamsDelta < 0 || seatsDelta < 0 || (teamPacks ?? []).some((p) => p.packs < (currentPacks.get(p.teamId) ?? 0))) {
        return reply.status(409).send({
          success: false,
          error: { code: 'EXTENSIONS_REDUCE_IN_PORTAL', message: 'Per ridurre le estensioni usa il portale clienti' },
        });
      }
      if (teamsDelta > 0) lines.push({ price: extensionPriceId('teams', cycle), quantity: teamsDelta });
      if (seatsDelta > 0) lines.push({ price: seatPriceId(), quantity: seatsDelta });
      const packsTotal = packsDelta.reduce((n, p) => n + p.delta, 0);
      if (packsTotal > 0) lines.push({ price: extensionPriceId('athletes', cycle), quantity: packsTotal });
      if (lines.length === 0) {
        return reply.send({ success: true, data: { url: null, applied: false } });
      }
      if (lines.some((l) => !l.price)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'EXTENSION_PRICE_MISSING', message: 'Prezzo delle estensioni non configurato in Stripe' },
        });
      }
      const stripe = getStripe();
      const appUrl = appPublicUrl();
      const customerId = await ensureStripeCustomer(app, stripe, organizationId, userId, email);
      // I metadata di Stripe sono stringhe corte: i pacchetti viaggiano come
      // "teamId:n,teamId:n". Il webhook li somma a quelli esistenti.
      const meta = {
        organizationId,
        kind: 'extensions',
        teams: String(Math.max(0, teamsDelta)),
        seats: String(Math.max(0, seatsDelta)),
        packs: packsDelta.map((p) => `${p.teamId}:${p.delta}`).join(',').slice(0, 480),
      };
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: lines,
        success_url: `${appUrl}/dashboard/billing?extensions=success`,
        cancel_url: `${appUrl}/dashboard/billing?extensions=cancelled`,
        metadata: { ...meta, userId },
        subscription_data: { metadata: meta },
      });
      return reply.send({ success: true, data: { url: session.url, applied: false } });
    }

    // Senza Stripe: si applicano subito, come per il piano.
    await app.prisma.$transaction(async (tx) => {
      if (extraTeams !== undefined || extraSeats !== undefined) {
        await tx.organization.update({
          where: { id: organizationId },
          data: {
            ...(extraTeams !== undefined ? { extraTeams } : {}),
            ...(extraSeats !== undefined ? { extraSeats } : {}),
          },
        });
      }
      for (const p of teamPacks ?? []) {
        await tx.team.update({ where: { id: p.teamId }, data: { extraAthletePacks: p.packs } });
      }
    });
    request.log.info({ organizationId, extraTeams, extraSeats, teamPacks: teamPacks?.length ?? 0 }, 'Estensioni aggiornate senza Stripe');
    return reply.send({ success: true, data: { url: null, applied: true } });
  });

  // ─── POST /billing/checkout — Create checkout session ──
  // Solo ADMIN, come /billing/seats: cambiare il piano impegna la societa'
  // a pagare, e fino al 16/9/2026 poteva farlo anche un osservatore.
  app.post('/billing/checkout', {
    preHandler: [app.authenticate, requireRole('ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isStripeConfigured()) {
      return reply.status(503).send({
        success: false,
        error: { code: 'STRIPE_NOT_CONFIGURED', message: 'Pagamenti non ancora configurati' },
      });
    }

    const parsed = checkoutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Parametri non validi' },
      });
    }

    const { userId, email, organizationId } = request.user;
    const tierEnum = TIER_TO_ENUM[parsed.data.tier];
    const priceId = planPriceId(tierEnum, parsed.data.cycle);
    if (!priceId) {
      return reply.status(503).send({
        success: false,
        error: { code: 'PLAN_PRICE_MISSING', message: 'Prezzo del piano non configurato in Stripe' },
      });
    }
    const stripe = getStripe();
    const appUrl = appPublicUrl();

    // Find or create Stripe customer
    const org = await app.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, stripeCustomerId: true },
    });

    let customerId = org?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: org?.name || email,
        metadata: { organizationId, userId },
      });
      customerId = customer.id;

      await app.prisma.organization.update({
        where: { id: organizationId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: sameOriginOr(parsed.data.successUrl, `${appUrl}/dashboard/settings?billing=success`),
      cancel_url: sameOriginOr(parsed.data.cancelUrl, `${appUrl}/dashboard/settings?billing=cancelled`),
      metadata: { organizationId, userId, tier: parsed.data.tier, cycle: parsed.data.cycle },
      subscription_data: {
        metadata: { organizationId, tier: parsed.data.tier, cycle: parsed.data.cycle },
      },
    });

    return reply.send({
      success: true,
      data: { url: session.url, sessionId: session.id },
    });
  });

  // ─── POST /billing/seats — Compra posti staff ───────
  //
  // Un abbonamento a parte, uno per pacchetto di posti, invece di modificare
  // la quantity dell'abbonamento principale: cosi' il piano resta quello che
  // e' (e continua a decidere le funzioni), i posti si aggiungono e si
  // disdicono per conto loro, e la disdetta di un pacchetto non tocca
  // l'abbonamento che tiene in piedi l'account.
  app.post('/billing/seats', {
    preHandler: [app.authenticate, requireRole('ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isStripeConfigured()) {
      return reply.status(503).send({
        success: false,
        error: { code: 'STRIPE_NOT_CONFIGURED', message: 'Pagamenti non ancora configurati' },
      });
    }

    const priceId = seatPriceId();
    if (!priceId) {
      return reply.status(503).send({
        success: false,
        error: { code: 'SEAT_PRICE_MISSING', message: 'Prezzo del posto aggiuntivo non configurato' },
      });
    }

    const parsed = seatCheckoutSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Parametri non validi' },
      });
    }

    const { userId, email, organizationId } = request.user;
    const { quantity } = parsed.data;
    const stripe = getStripe();
    const appUrl = appPublicUrl();

    const org = await app.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, stripeCustomerId: true },
    });

    let customerId = org?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: org?.name || email,
        metadata: { organizationId, userId },
      });
      customerId = customer.id;
      await app.prisma.organization.update({
        where: { id: organizationId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity }],
      success_url: sameOriginOr(parsed.data.successUrl, `${appUrl}/dashboard/settings?seats=success`),
      cancel_url: sameOriginOr(parsed.data.cancelUrl, `${appUrl}/dashboard/settings?seats=cancelled`),
      // `kind` e' cio' che distingue questo acquisto da un cambio di piano
      // quando il webhook rilegge la sessione: senza, comprare due posti
      // verrebbe interpretato come un passaggio al piano Starter.
      metadata: { organizationId, userId, kind: 'seats', seats: String(quantity) },
      subscription_data: {
        metadata: { organizationId, kind: 'seats', seats: String(quantity) },
      },
    });

    return reply.send({ success: true, data: { url: session.url, sessionId: session.id } });
  });

  // ─── GET /billing/seats — Stato dei posti ───────────
  app.get('/billing/seats', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const usage = await getSeatUsage(app.prisma, request.user.organizationId);
    return reply.send({
      success: true,
      data: { seats: usage, seatsByTier: SEATS_BY_TIER },
    });
  });

  // ─── POST /billing/portal — Customer portal ─────────
  // Solo ADMIN: dal portale Stripe si disdice l'abbonamento, si cambia la
  // carta e si scaricano le fatture della societa'.
  app.post('/billing/portal', {
    preHandler: [app.authenticate, requireRole('ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isStripeConfigured()) {
      return reply.status(503).send({
        success: false,
        error: { code: 'STRIPE_NOT_CONFIGURED', message: 'Pagamenti non ancora configurati' },
      });
    }

    const { organizationId } = request.user;
    const stripe = getStripe();
    const appUrl = appPublicUrl();

    const org = await app.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { stripeCustomerId: true },
    });

    if (!org?.stripeCustomerId) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NO_SUBSCRIPTION', message: 'Nessun abbonamento attivo' },
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${appUrl}/dashboard/settings`,
    });

    return reply.send({ success: true, data: { url: session.url } });
  });

  // ─── GET /billing/subscription — Current status ──────
  app.get('/billing/subscription', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { organizationId } = request.user;

    const org = await app.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        stripeCustomerId: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
      },
    });

    return reply.send({
      success: true,
      data: {
        subscription: {
          tier: org?.subscriptionTier || 'starter',
          status: org?.subscriptionStatus || 'inactive',
          endsAt: org?.subscriptionEndsAt || null,
          hasStripeCustomer: !!org?.stripeCustomerId,
        },
      },
    });
  });

  // ─── POST /billing/webhook — Stripe webhook ─────────
  // NOTE: This route must NOT have authentication middleware
  app.post('/billing/webhook', {
    // `rawBody: true` chiede al parser JSON di app.ts di conservare il corpo
    // originale in `request.rawBody`. Non e' nel tipo FastifyContextConfig,
    // da qui il cast.
    config: { rawBody: true } as Record<string, unknown>,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isStripeConfigured()) {
      return reply.status(200).send({ received: true });
    }

    const stripe = getStripe();
    const sig = request.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret || !sig) {
      request.log.warn('Stripe webhook missing signature or secret');
      return reply.status(400).send({ error: 'Missing signature' });
    }

    // La firma si verifica sul corpo ESATTO ricevuto da Stripe. Lo conserva
    // il parser JSON di app.ts per le rotte con `config.rawBody`: prima si
    // contava su un plugin fastify-raw-body mai installato, `rawBody` era
    // undefined e ogni evento veniva respinto come firma non valida.
    const rawBody = (request as unknown as { rawBody?: string }).rawBody;
    if (typeof rawBody !== 'string') {
      request.log.error('Stripe webhook: raw body not captured');
      return reply.status(400).send({ error: 'Missing raw body' });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      request.log.error({ err }, 'Stripe webhook signature verification failed');
      return reply.status(400).send({ error: 'Invalid signature' });
    }

    request.log.info({ type: event.type, id: event.id }, 'Stripe webhook received');

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.organizationId;
        if (!orgId) break;

        // Acquisto di posti aggiuntivi: non tocca il piano, aggiunge capienza.
        if (session.metadata?.kind === 'seats') {
          const bought = Number.parseInt(session.metadata?.seats ?? '1', 10);
          const seats = Number.isFinite(bought) && bought > 0 ? bought : 1;
          await app.prisma.organization.update({
            where: { id: orgId },
            data: { extraSeats: { increment: seats } },
          });
          request.log.info({ orgId, seats }, 'Extra staff seats purchased');
          break;
        }

        // Estensioni comprate dalla pagina Abbonamento: si sommano a quelle
        // esistenti (il checkout contiene solo l'aumento).
        if (session.metadata?.kind === 'extensions') {
          await applyExtensionDelta(app, orgId, session.metadata, 1);
          request.log.info({ orgId }, 'Extensions purchased');
          break;
        }

        const tier = session.metadata?.tier || 'starter';
        const cycle = session.metadata?.cycle === 'yearly' ? 'yearly' : 'monthly';
        await app.prisma.organization.update({
          where: { id: orgId },
          data: {
            subscriptionTier: tier,
            // L'enum va tenuto allineato alla stringa: e' quello che decide
            // quanti posti staff include il piano.
            ...(TIER_TO_ENUM[tier] ? { tier: TIER_TO_ENUM[tier] } : {}),
            // Pagato: la prova, se c'era, finisce qui.
            trialEndsAt: null,
            billingCycle: cycle,
            subscriptionStatus: 'active',
            stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : undefined,
          },
        });
        request.log.info({ orgId, tier }, 'Subscription activated');
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = subscription.metadata?.organizationId;
        // Un pacchetto di posti non e' l'abbonamento dell'account: se va in
        // sofferenza non deve segnare l'intera organizzazione come morosa,
        // ne' spostarne la scadenza.
        if (subscription.metadata?.kind === 'seats' || subscription.metadata?.kind === 'extensions') break;
        if (orgId) {
          await app.prisma.organization.update({
            where: { id: orgId },
            data: {
              subscriptionStatus: subscription.status === 'active' ? 'active' : 'past_due',
              subscriptionEndsAt: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000)
                : null,
            },
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = subscription.metadata?.organizationId;
        if (!orgId) break;

        // Disdetta di un pacchetto di posti: si tolgono i posti, il piano
        // resta. Il pavimento a zero e' voluto — se un evento arrivasse due
        // volte, un decremento senza freno porterebbe i posti in negativo e
        // l'organizzazione non potrebbe piu' invitare nessuno.
        if (subscription.metadata?.kind === 'seats') {
          const bought = Number.parseInt(subscription.metadata?.seats ?? '1', 10);
          const seats = Number.isFinite(bought) && bought > 0 ? bought : 1;
          const org = await app.prisma.organization.findUnique({
            where: { id: orgId },
            select: { extraSeats: true },
          });
          await app.prisma.organization.update({
            where: { id: orgId },
            data: { extraSeats: Math.max(0, (org?.extraSeats ?? 0) - seats) },
          });
          request.log.info({ orgId, seats }, 'Extra staff seats cancelled');
          break;
        }

        if (subscription.metadata?.kind === 'extensions') {
          await applyExtensionDelta(app, orgId, subscription.metadata, -1);
          request.log.info({ orgId }, 'Extensions cancelled');
          break;
        }

        await app.prisma.organization.update({
          where: { id: orgId },
          data: {
            subscriptionTier: 'free',
            subscriptionStatus: 'cancelled',
            stripeSubscriptionId: null,
          },
        });
        request.log.info({ orgId }, 'Subscription cancelled');
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;

        // Stessa distinzione di sopra: una fattura non pagata su un pacchetto
        // di posti non rende morosa l'organizzazione. Qui i metadata non sono
        // sulla fattura, quindi si guarda l'abbonamento a cui si riferisce.
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
        if (subId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subId);
            if (sub.metadata?.kind === 'seats' || sub.metadata?.kind === 'extensions') {
              request.log.warn({ subId }, 'Seat package payment failed');
              break;
            }
          } catch (err) {
            // Se Stripe non risponde si prosegue con il comportamento
            // prudente di prima: meglio un past_due di troppo che ignorare
            // una morosita' vera.
            request.log.warn({ err, subId }, 'Could not read subscription metadata');
          }
        }

        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.toString();
        if (customerId) {
          const org = await app.prisma.organization.findFirst({
            where: { stripeCustomerId: customerId },
          });
          if (org) {
            await app.prisma.organization.update({
              where: { id: org.id },
              data: { subscriptionStatus: 'past_due' },
            });
            request.log.warn({ orgId: org.id }, 'Payment failed');
          }
        }
        break;
      }

      default:
        request.log.info({ type: event.type }, 'Unhandled Stripe event');
    }

    return reply.send({ received: true });
  });
}

// ─── Helper ────────────────────────────────────────────

/** Cliente Stripe dell'organizzazione: lo crea al primo acquisto. */
async function ensureStripeCustomer(
  app: FastifyInstance,
  stripe: Stripe,
  organizationId: string,
  userId: string,
  email: string,
): Promise<string> {
  const org = await app.prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, stripeCustomerId: true },
  });
  if (org?.stripeCustomerId) return org.stripeCustomerId;
  const customer = await stripe.customers.create({
    email,
    name: org?.name || email,
    metadata: { organizationId, userId },
  });
  await app.prisma.organization.update({
    where: { id: organizationId },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

function positiveInt(value: string | undefined): number {
  const n = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Somma (sign = 1) o toglie (sign = -1) le estensioni scritte nei metadata
 * di un acquisto. Pavimento a zero, come per i posti: un evento ripetuto non
 * deve portare nulla in negativo.
 */
async function applyExtensionDelta(
  app: FastifyInstance,
  organizationId: string,
  metadata: Record<string, string>,
  sign: 1 | -1,
): Promise<void> {
  const teams = positiveInt(metadata.teams) * sign;
  const seats = positiveInt(metadata.seats) * sign;
  const packs = (metadata.packs ?? '')
    .split(',')
    .map((pair) => pair.split(':'))
    .filter((p) => p.length === 2 && p[0])
    .map(([teamId, n]) => ({ teamId: teamId as string, delta: positiveInt(n) * sign }));

  const org = await app.prisma.organization.findUnique({
    where: { id: organizationId },
    select: { extraTeams: true, extraSeats: true },
  });
  if (!org) return;
  await app.prisma.organization.update({
    where: { id: organizationId },
    data: {
      extraTeams: Math.max(0, org.extraTeams + teams),
      extraSeats: Math.max(0, org.extraSeats + seats),
    },
  });
  for (const p of packs) {
    const team = await app.prisma.team.findFirst({
      where: { id: p.teamId, organizationId },
      select: { extraAthletePacks: true },
    });
    if (!team) continue;
    await app.prisma.team.update({
      where: { id: p.teamId },
      data: { extraAthletePacks: Math.max(0, team.extraAthletePacks + p.delta) },
    });
  }
}

