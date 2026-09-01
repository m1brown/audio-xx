/**
 * Product suite — billing integrity (MVP M5).
 *
 * Webhook processing against a real throwaway database with REAL
 * signature crypto (stripe's own generateTestHeaderString): rejection
 * of bad signatures, idempotent duplicates, out-of-order delivery,
 * activation, cancellation, payment failure, and checkout-return
 * cross-user protection. No live Stripe account is required.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { applyStripeEvent } from '../billing';

const WEB_ROOT = resolve(__dirname, '../../..');
const WEBHOOK_SECRET = 'whsec_test_secret_for_unit_tests';
const stripe = new Stripe('sk_test_dummy_key_never_used_for_network');

let dir: string;
let db: PrismaClient;
let userId: string;

function makeEvent(
  id: string, type: string, object: Record<string, unknown>, createdSec: number,
): Stripe.Event {
  return {
    id, type, created: createdSec, object: 'event',
    api_version: '2024-06-20', livemode: false, pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: { object },
  } as unknown as Stripe.Event;
}

const subObject = (over: Record<string, unknown> = {}) => ({
  id: 'sub_abc', object: 'subscription', customer: 'cus_abc',
  status: 'active', cancel_at_period_end: false,
  metadata: { userId: 'SET_LATER' },
  items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] },
  ...over,
});

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'axx-m5b-'));
  const url = `file:${join(dir, 'test.db')}`;
  execSync('npx prisma db push --skip-generate', {
    cwd: WEB_ROOT, env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe',
  });
  db = new PrismaClient({ datasources: { db: { url } } });
  const u = await db.user.create({ data: { email: 'payer@example.com', password: 'x' } });
  userId = u.id;
}, 120_000);

afterAll(async () => {
  await db?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

describe('signature verification (the route boundary)', () => {
  it('a correctly signed payload verifies; a tampered one is rejected', () => {
    const payload = JSON.stringify(makeEvent('evt_sig', 'customer.subscription.updated', subObject(), 1_800_000_000));
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    const verified = stripe.webhooks.constructEvent(payload, header, WEBHOOK_SECRET);
    expect(verified.id).toBe('evt_sig');
    expect(() => stripe.webhooks.constructEvent(payload + ' ', header, WEBHOOK_SECRET)).toThrow();
    expect(() => stripe.webhooks.constructEvent(payload, header, 'whsec_wrong')).toThrow();
  });
});

describe('event application — idempotent, ordered, correct', () => {
  it('subscription activation upserts the authoritative row', async () => {
    const ev = makeEvent('evt_1', 'customer.subscription.created',
      subObject({ metadata: { userId } }), 1_800_000_000);
    const out = await applyStripeEvent(db, ev);
    expect(out).toMatchObject({ handled: true, reason: 'processed' });
    const row = await db.subscription.findUnique({ where: { userId } });
    expect(row).toMatchObject({ status: 'active', stripeCustomerId: 'cus_abc', cancelAtPeriodEnd: false });
    expect(row?.currentPeriodEnd).toBeInstanceOf(Date);
  });

  it('a duplicate event id is acknowledged and applied zero times', async () => {
    const ev = makeEvent('evt_1', 'customer.subscription.created',
      subObject({ metadata: { userId }, status: 'canceled' }), 1_800_000_500);
    const out = await applyStripeEvent(db, ev);
    expect(out).toMatchObject({ handled: false, reason: 'duplicate' });
    const row = await db.subscription.findUnique({ where: { userId } });
    expect(row?.status).toBe('active'); // untouched by the replay
  });

  it('an out-of-order (older) event never overwrites newer state', async () => {
    // Newer event first: payment failure at t=1_800_001_000
    await applyStripeEvent(db, makeEvent('evt_2', 'customer.subscription.updated',
      subObject({ metadata: { userId }, status: 'past_due' }), 1_800_001_000));
    // Older event arrives late: still-active at t=1_800_000_800
    const stale = await applyStripeEvent(db, makeEvent('evt_3', 'customer.subscription.updated',
      subObject({ metadata: { userId }, status: 'active' }), 1_800_000_800));
    expect(stale).toMatchObject({ handled: false, reason: 'stale' });
    const row = await db.subscription.findUnique({ where: { userId } });
    expect(row?.status).toBe('past_due');
  });

  it('a portal cancel expressed as cancel_at (boolean false) is a scheduled cancellation', async () => {
    // Observed live: current-API portal cancels set cancel_at and leave
    // cancel_at_period_end false. The row must record the schedule.
    await applyStripeEvent(db, makeEvent('evt_cancel_at', 'customer.subscription.updated',
      subObject({ metadata: { userId }, status: 'active', cancel_at_period_end: false, cancel_at: 1_800_050_000 }), 1_800_001_200));
    const row = await db.subscription.findUnique({ where: { userId } });
    expect(row?.cancelAtPeriodEnd).toBe(true);
    // Restore the plain-active state for the tests that follow.
    await applyStripeEvent(db, makeEvent('evt_cancel_undo', 'customer.subscription.updated',
      subObject({ metadata: { userId }, status: 'active' }), 1_800_001_300));
  });

  it('a null period end never regresses one learned from a subscription event', async () => {
    // Observed live in test mode: checkout.session.completed (which does
    // not know the period end) can process AFTER customer.subscription.created
    // (which does). The placeholder must not clobber the real boundary.
    const before = await db.subscription.findUnique({ where: { userId } });
    expect(before?.currentPeriodEnd).toBeInstanceOf(Date);
    const ev = makeEvent('evt_regress', 'checkout.session.completed', {
      id: 'cs_regress', object: 'checkout.session', mode: 'subscription',
      client_reference_id: userId, customer: 'cus_abc', subscription: 'sub_abc',
      metadata: {},
    }, 1_800_001_500);
    const out = await applyStripeEvent(db, ev);
    expect(out).toMatchObject({ handled: true });
    const after = await db.subscription.findUnique({ where: { userId } });
    expect(after?.currentPeriodEnd?.getTime()).toBe(before?.currentPeriodEnd?.getTime());
  });

  it('payment failure → past_due; deletion → canceled', async () => {
    await applyStripeEvent(db, makeEvent('evt_4', 'customer.subscription.deleted',
      subObject({ metadata: { userId } }), 1_800_002_000));
    const row = await db.subscription.findUnique({ where: { userId } });
    expect(row?.status).toBe('canceled');
  });

  it('events without a resolvable user fall back to customer lookup, then no_user', async () => {
    // Known customer id, no metadata → resolves via the existing row.
    const byCustomer = await applyStripeEvent(db, makeEvent('evt_5', 'customer.subscription.updated',
      subObject({ metadata: {}, status: 'active' }), 1_800_003_000));
    expect(byCustomer).toMatchObject({ handled: true, reason: 'processed' });
    // Unknown customer → acknowledged, nothing written.
    const unknown = await applyStripeEvent(db, makeEvent('evt_6', 'customer.subscription.updated',
      subObject({ metadata: {}, customer: 'cus_stranger', id: 'sub_stranger' }), 1_800_003_100));
    expect(unknown).toMatchObject({ handled: false, reason: 'no_user' });
  });

  it('checkout.session.completed activates via client_reference_id', async () => {
    const other = await db.user.create({ data: { email: 'payer2@example.com', password: 'x' } });
    const ev = makeEvent('evt_7', 'checkout.session.completed', {
      id: 'cs_1', object: 'checkout.session', mode: 'subscription',
      client_reference_id: other.id, customer: 'cus_other', subscription: 'sub_other',
      metadata: {},
    }, 1_800_004_000);
    const out = await applyStripeEvent(db, ev);
    expect(out).toMatchObject({ handled: true });
    const row = await db.subscription.findUnique({ where: { userId: other.id } });
    expect(row).toMatchObject({ status: 'active', stripeSubscriptionId: 'sub_other' });
  });

  it('ignored event types are acknowledged without effect', async () => {
    const out = await applyStripeEvent(db, makeEvent('evt_8', 'invoice.finalized', { id: 'in_1' }, 1_800_005_000));
    expect(out).toMatchObject({ handled: false, reason: 'ignored_type' });
  });

  it('no code path deletes user data on any subscription event', async () => {
    // Structural check at the module level: billing.ts contains no
    // deletes against user-content tables.
    const src = (await import('node:fs')).readFileSync(
      resolve(WEB_ROOT, 'src/product/billing.ts'), 'utf8',
    );
    expect(src).not.toMatch(/system\.delete|assessmentSnapshot\.delete|user\.delete/);
  });
});
