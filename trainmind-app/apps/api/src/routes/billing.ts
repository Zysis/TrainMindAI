/**
 * Sprint 5.3 — Stripe Billing Routes
 *
 * Endpoints:
 *   POST   /billing/checkout         Create Stripe Checkout session
 *   POST   /billing/portal           Create Stripe Customer Portal session
 *   GET    /billing/subscription     Get current subscription status
 *   POST   /billing/webhook          Stripe webhook handler (no auth)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import Stripe from 'stripe';

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

// ─── Schemas ───────────────────────────────────────────

const checkoutSchema = z.object({
  tier: z.enum(['starter', 'professional', 'ultra']),
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
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

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
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

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
        const tier = session.metadata?.tier || 'starter';
        if (orgId) {
          await app.prisma.organization.update({
            where: { id: orgId },
            data: {
              subscriptionTier: tier,
              subscriptionStatus: 'active',
              stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : undefined,
            },
          });
          request.log.info({ orgId, tier }, 'Subscription activated');
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = subscription.metadata?.organizationId;
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
        if (orgId) {
          await app.prisma.organization.update({
            where: { id: orgId },
            data: {
              subscriptionTier: 'free',
              subscriptionStatus: 'cancelled',
              stripeSubscriptionId: null,
            },
          });
          request.log.info({ orgId }, 'Subscription cancelled');
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
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
