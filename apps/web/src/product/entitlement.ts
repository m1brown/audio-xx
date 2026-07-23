/**
 * Entitlement (MVP M5) — THE single server-side rule for My Systems.
 *
 *   canManageCollection = active trial OR active paid access
 *
 * Every protected action (save a new system, add an assessment, rename,
 * edit notes) consults this one function. Viewing, printing, sharing,
 * and removing systems never require it. No client state is trusted.
 *
 * Trial rule (founder-approved):
 *   trialStart  = max(user.createdAt, BILLING_LAUNCHED_AT)
 *   trialEndsAt = trialStart + 92 days
 * All arithmetic is in UTC epoch milliseconds — timezone-independent
 * and deterministic. The boundary is exclusive: at exactly trialEndsAt
 * the trial is over. Accounts created before billing existed get the
 * full trial from the launch instant, not from their signup date.
 *
 * Paid states (synchronised from verified Stripe webhooks into the
 * Subscription row — the server-side authority):
 *   - status active            → paid access
 *   - cancelAtPeriodEnd        → paid access until currentPeriodEnd
 *   - status canceled          → paid access until currentPeriodEnd
 *   - status past_due          → GRACE: paid access until currentPeriodEnd,
 *                                then expired until payment recovers
 *   - other/unknown statuses   → no paid access (trial rule still applies)
 * Webhook delay/outage degradation: entitlement reads the last-known
 * DB state, so a lagging webhook can only delay an UPGRADE (checkout
 * return also syncs directly, covering the common case); it can never
 * grant access that was not paid for.
 */
import type { PrismaClient } from '@prisma/client';

export const TRIAL_DAYS = 92;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The instant billing went live in production. Accounts created before
 * this get their trial measured from here. Set via env at the activation
 * gate; the fallback keeps pre-activation environments in "trial for
 * everyone" mode harmlessly (every account is newer than a past date
 * only after activation is configured).
 */
export function billingLaunchedAt(): Date {
  const raw = process.env.BILLING_LAUNCHED_AT;
  const parsed = raw ? new Date(raw) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date('2026-07-23T00:00:00Z');
}

export type EntitlementState =
  | 'trial'
  | 'subscriber'
  | 'canceling'      // cancel scheduled, paid through period end
  | 'past_due'       // payment failed, in grace until period end
  | 'expired';

export interface Entitlement {
  state: EntitlementState;
  /** May the user save/add/rename/edit-notes right now? */
  canManage: boolean;
  /** Trial end for this user (always computed, even for subscribers). */
  trialEndsAt: string;
  /** Days of trial remaining (0 when over). */
  trialDaysLeft: number;
  /** Paid-through instant when a subscription row exists. */
  paidThrough: string | null;
  hasSubscription: boolean;
}

export function trialEndFor(userCreatedAt: Date, launchedAt: Date = billingLaunchedAt()): Date {
  const start = Math.max(userCreatedAt.getTime(), launchedAt.getTime());
  return new Date(start + TRIAL_DAYS * DAY_MS);
}

interface SubscriptionShape {
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

/** Pure rule — fully deterministic given inputs; the tests pin this. */
export function computeEntitlement(
  userCreatedAt: Date,
  subscription: SubscriptionShape | null,
  now: Date,
  launchedAt: Date = billingLaunchedAt(),
): Entitlement {
  const trialEnd = trialEndFor(userCreatedAt, launchedAt);
  const trialActive = now.getTime() < trialEnd.getTime();
  const trialDaysLeft = trialActive
    ? Math.ceil((trialEnd.getTime() - now.getTime()) / DAY_MS)
    : 0;

  const base = {
    trialEndsAt: trialEnd.toISOString(),
    trialDaysLeft,
    paidThrough: subscription?.currentPeriodEnd?.toISOString() ?? null,
    hasSubscription: Boolean(subscription),
  };

  if (subscription) {
    const periodOpen = subscription.currentPeriodEnd
      ? now.getTime() < subscription.currentPeriodEnd.getTime()
      : false;
    if (subscription.status === 'active' && !subscription.cancelAtPeriodEnd) {
      return { ...base, state: 'subscriber', canManage: true };
    }
    if (subscription.status === 'active' && subscription.cancelAtPeriodEnd) {
      // Cancel scheduled — retains paid access to the period end.
      return { ...base, state: 'canceling', canManage: periodOpen || trialActive };
    }
    if (subscription.status === 'canceled') {
      return periodOpen
        ? { ...base, state: 'canceling', canManage: true }
        : trialActive
          ? { ...base, state: 'trial', canManage: true }
          : { ...base, state: 'expired', canManage: false };
    }
    if (subscription.status === 'past_due') {
      return { ...base, state: 'past_due', canManage: periodOpen || trialActive };
    }
    // incomplete / unknown provider states never grant paid access.
  }

  return trialActive
    ? { ...base, state: 'trial', canManage: true }
    : { ...base, state: 'expired', canManage: false };
}

/** DB-backed lookup used by every protected route. */
export async function getEntitlement(
  db: PrismaClient,
  userId: string,
  now: Date = new Date(),
): Promise<Entitlement | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });
  if (!user) return null;
  return computeEntitlement(user.createdAt, user.subscription, now);
}

export class SubscriptionRequiredError extends Error {
  code = 'subscription_required' as const;
  constructor(public entitlement: Entitlement) {
    super('An active trial or subscription is required for this action.');
  }
}

/** Guard for protected routes: throws a typed error when not entitled. */
export async function requireManage(
  db: PrismaClient,
  userId: string,
  now: Date = new Date(),
): Promise<Entitlement> {
  const ent = await getEntitlement(db, userId, now);
  if (!ent) throw new SubscriptionRequiredError({
    state: 'expired', canManage: false, trialEndsAt: now.toISOString(),
    trialDaysLeft: 0, paidThrough: null, hasSubscription: false,
  });
  if (!ent.canManage) throw new SubscriptionRequiredError(ent);
  return ent;
}
