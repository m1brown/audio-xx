/**
 * Billing (MVP M5) — thin Stripe integration for the one plan:
 * My Systems, $3/month, cancel anytime.
 *
 * Design rules:
 *  - The price is ALWAYS the server-configured STRIPE_PRICE_ID; no
 *    client-supplied price or product identifiers exist anywhere.
 *  - No card data touches this codebase — checkout and cancellation
 *    happen on Stripe-hosted surfaces.
 *  - The Subscription row (synchronised from verified webhooks, plus a
 *    direct sync on checkout return) is the server-side authority; the
 *    client is never trusted for entitlement.
 *  - Webhooks are signature-verified, idempotent (ProcessedStripeEvent
 *    ledger), and out-of-order-safe (event.created vs lastEventAt).
 *  - Checkout return URLs are fixed server-side paths — no open redirect.
 *  - No private system names or notes are placed in Stripe metadata;
 *    only the internal userId.
 */
import Stripe from 'stripe';
import type { PrismaClient } from '@prisma/client';

let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

const APP_URL = () => process.env.NEXTAUTH_URL || 'https://audio-xx.com';

/** Create a subscription Checkout session for the signed-in user. */
export async function createCheckoutSession(
  db: PrismaClient,
  userId: string,
  userEmail: string,
): Promise<string> {
  const stripe = getStripe();
  const existing = await db.subscription.findUnique({ where: { userId } });

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    // Reuse the customer when one exists so a lapsed subscriber does not
    // get a duplicate Stripe customer.
    ...(existing
      ? { customer: existing.stripeCustomerId }
      : { customer_email: userEmail }),
    client_reference_id: userId,
    metadata: { userId },
    subscription_data: { metadata: { userId } },
    success_url: `${APP_URL()}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL()}/account?checkout=cancelled`,
    allow_promotion_codes: false,
  });
  if (!session.url) throw new Error('Stripe did not return a checkout URL');
  return session.url;
}

/** Stripe-hosted billing portal (cancel anytime lives here). */
export async function createPortalSession(
  db: PrismaClient,
  userId: string,
): Promise<string | null> {
  const sub = await db.subscription.findUnique({ where: { userId } });
  if (!sub) return null;
  const session = await getStripe().billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${APP_URL()}/account`,
  });
  return session.url;
}

// ── Webhook processing ────────────────────────────────────────────────

export interface WebhookOutcome {
  handled: boolean;
  reason: 'processed' | 'duplicate' | 'stale' | 'ignored_type' | 'no_user';
}

interface SubscriptionSnapshot {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

function snapshotFromStripeSubscription(
  sub: Stripe.Subscription,
): Omit<SubscriptionSnapshot, 'userId'> & { userId: string | null } {
  const item = sub.items?.data?.[0];
  const periodEnd = item?.current_period_end ?? null;
  return {
    userId: (sub.metadata?.userId as string) ?? null,
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripeSubscriptionId: sub.id,
    status: sub.status,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
  };
}

async function upsertSubscription(
  db: PrismaClient,
  snap: SubscriptionSnapshot,
  eventCreatedAt: Date,
): Promise<'processed' | 'stale'> {
  const existing = await db.subscription.findUnique({ where: { userId: snap.userId } });
  if (existing?.lastEventAt && existing.lastEventAt.getTime() > eventCreatedAt.getTime()) {
    return 'stale'; // out-of-order delivery — a newer event already applied
  }
  await db.subscription.upsert({
    where: { userId: snap.userId },
    create: { ...snap, lastEventAt: eventCreatedAt },
    update: {
      stripeCustomerId: snap.stripeCustomerId,
      stripeSubscriptionId: snap.stripeSubscriptionId,
      status: snap.status,
      currentPeriodEnd: snap.currentPeriodEnd,
      cancelAtPeriodEnd: snap.cancelAtPeriodEnd,
      lastEventAt: eventCreatedAt,
    },
  });
  return 'processed';
}

/**
 * Apply one verified Stripe event. Idempotent: an event id is applied at
 * most once; replays and duplicates are acknowledged without effect.
 */
export async function applyStripeEvent(
  db: PrismaClient,
  event: Stripe.Event,
  resolveUserIdByCustomer?: (customerId: string) => Promise<string | null>,
): Promise<WebhookOutcome> {
  // Idempotency ledger first — replay/duplicate protection.
  const seen = await db.processedStripeEvent.findUnique({ where: { id: event.id } });
  if (seen) return { handled: false, reason: 'duplicate' };
  await db.processedStripeEvent.create({ data: { id: event.id, type: event.type } });

  const created = new Date(event.created * 1000);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = (session.client_reference_id
        ?? (session.metadata?.userId as string)) || null;
      if (!userId || session.mode !== 'subscription') {
        return { handled: false, reason: 'no_user' };
      }
      const snap: SubscriptionSnapshot = {
        userId,
        stripeCustomerId: typeof session.customer === 'string'
          ? session.customer
          : (session.customer as Stripe.Customer)?.id ?? '',
        stripeSubscriptionId: typeof session.subscription === 'string'
          ? session.subscription
          : (session.subscription as Stripe.Subscription)?.id ?? null,
        status: 'active',
        currentPeriodEnd: null, // the subsequent subscription event fills this
        cancelAtPeriodEnd: false,
      };
      const outcome = await upsertSubscription(db, snap, created);
      return { handled: outcome === 'processed', reason: outcome };
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const snap = snapshotFromStripeSubscription(sub);
      let userId = snap.userId;
      if (!userId && resolveUserIdByCustomer) {
        userId = await resolveUserIdByCustomer(snap.stripeCustomerId);
      }
      if (!userId) {
        const byCustomer = await db.subscription.findUnique({
          where: { stripeCustomerId: snap.stripeCustomerId },
        });
        userId = byCustomer?.userId ?? null;
      }
      if (!userId) return { handled: false, reason: 'no_user' };
      const status = event.type === 'customer.subscription.deleted' ? 'canceled' : snap.status;
      const outcome = await upsertSubscription(
        db,
        { ...snap, userId, status },
        created,
      );
      return { handled: outcome === 'processed', reason: outcome };
    }

    default:
      return { handled: false, reason: 'ignored_type' };
  }
}

/**
 * Checkout-return sync: covers webhook lag so "user returning from
 * successful checkout" (required state 8) is active immediately. Reads
 * the session from Stripe (never trusting the client), then applies the
 * same upsert path as webhooks.
 */
export async function syncFromCheckoutSession(
  db: PrismaClient,
  userId: string,
  sessionId: string,
): Promise<boolean> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription'],
  });
  // The session must belong to this signed-in user — no cross-user sync.
  const sessionUser = session.client_reference_id ?? session.metadata?.userId;
  if (sessionUser !== userId) return false;
  if (session.mode !== 'subscription' || session.payment_status !== 'paid') return false;
  const sub = session.subscription as Stripe.Subscription | null;
  if (!sub || typeof sub === 'string') return false;
  const snap = snapshotFromStripeSubscription(sub);
  await upsertSubscription(db, { ...snap, userId }, new Date());
  return true;
}
