/**
 * Sprint 5.3 — Stripe Billing Routes
 *
 * Endpoints:
 *   POST   /billing/checkout         Create Stripe Checkout session
 *   POST   /billing/portal           Create Stripe Customer Portal session
 *   GET    /billing/subscription     Get current subscription status
 *   POST   /billing/seats            Buy extra staff seats
 *   POST   /billing/webhook          Stripe webhook handler (no auth)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import Stripe from 'stripe';
import { requireRole } from '../middleware/rbac.js';
import { getSeatUsage, SEATS_BY_TIER } from '../lib/seats.js';
import { appPublicUrl } from '../lib/app-url.js';

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

const PRICING_TIERS = {
  starter: {
    name: 'Starter',
    priceId: process.env.STRIPE_PRICE_STARTER || '',
    features: ['1 squadra (12 atleti)', 'Report base', 'Wellness tracking', 'Calendario'],
  },
  professional: {
    name: 'Professional',
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL || '',
    features: ['3 squadre (12 atleti per squadra)', 'Report avanzati', 'AI Coach', 'Periodizzazione', 'RTP', 'Analytics'],
  },
  ultra: {
    name: 'Ultra',
    priceId: process.env.STRIPE_PRICE_ULTRA || '',
    features: ['Squadre e atleti illimitati', 'Tutto Professional', 'API access', 'Supporto prioritario'],
  },
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
const TIER_TO_ENUM: Record<string, 'STARTER' | 'PROFESSIONAL' | 'ULTRA'> = {
  starter: 'STARTER',
  professional: 'PROFESSIONAL',
  ultra: 'ULTRA',
};

// ─── Schemas ───────────────────────────────────────────

const checkoutSchema = z.object({
  tier: z.enum(['starter', 'professional', 'ultra']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
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
        plans: Object.entries(PRICING_TIERS).map(([key, tier]) => ({
          id: key,
          name: tier.name,
          features: tier.features,
        })),
      },
    });
  });

  // ─── POST /billing/checkout — Create checkout session ──
  app.post('/billing/checkout', {
    preHandler: [app.authenticate],
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
    const tier = PRICING_TIERS[parsed.data.tier];
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
      line_items: [{ price: tier.priceId, quantity: 1 }],
      success_url: parsed.data.successUrl || `${appUrl}/dashboard/settings?billing=success`,
      cancel_url: parsed.data.cancelUrl || `${appUrl}/dashboard/settings?billing=cancelled`,
      metadata: { organizationId, userId, tier: parsed.data.tier },
      subscription_data: {
        metadata: { organizationId, tier: parsed.data.tier },
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
      success_url: parsed.data.successUrl || `${appUrl}/dashboard/settings?seats=success`,
      cancel_url: parsed.data.cancelUrl || `${appUrl}/dashboard/settings?seats=cancelled`,
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
  app.post('/billing/portal', {
    preHandler: [app.authenticate],
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
    // `rawBody` is provided by the fastify-raw-body plugin but isn't on the
    // FastifyContextConfig type by default — cast keeps Fastify happy.
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

    let event: Stripe.Event;
    try {
      const rawBody = (request as unknown as { rawBody: string | Buffer }).rawBody;
      event = stripe.webhooks.constructEvent(
        typeof rawBody === 'string' ? rawBody : rawBody.toString(),
        sig,
        webhookSecret,
      );
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

        const tier = session.metadata?.tier || 'starter';
        await app.prisma.organization.update({
          where: { id: orgId },
          data: {
            subscriptionTier: tier,
            // L'enum va tenuto allineato alla stringa: e' quello che decide
            // quanti posti staff include il piano.
            ...(TIER_TO_ENUM[tier] ? { tier: TIER_TO_ENUM[tier] } : {}),
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
        if (subscription.metadata?.kind === 'seats') break;
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
            if (sub.metadata?.kind === 'seats') {
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
