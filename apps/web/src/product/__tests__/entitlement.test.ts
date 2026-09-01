/**
 * Product suite — entitlement & trial logic (MVP M5).
 *
 * Pins THE rule: canManageCollection = active trial OR active paid
 * access. Pure-function tests give exact boundary determinism; the
 * DB-backed tests run protected-action enforcement against a real
 * throwaway SQLite database.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  computeEntitlement, trialEndFor, getEntitlement, requireManage,
  SubscriptionRequiredError, TRIAL_DAYS,
} from '../entitlement';
import { saveAssessment } from '../save-system';

const LAUNCH = new Date('2026-08-01T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

describe('trial arithmetic — UTC, deterministic, boundary-exact', () => {
  it('a post-launch account trials for exactly 92 days from creation', () => {
    const created = new Date('2026-09-10T12:00:00Z');
    const end = trialEndFor(created, LAUNCH);
    expect(end.getTime()).toBe(created.getTime() + TRIAL_DAYS * DAY);
  });

  it('a pre-launch account gets the full trial from the launch instant', () => {
    const created = new Date('2026-05-01T09:30:00Z'); // helped test before billing
    const end = trialEndFor(created, LAUNCH);
    expect(end.getTime()).toBe(LAUNCH.getTime() + TRIAL_DAYS * DAY);
  });

  it('the expiry boundary is exclusive: one ms before = trial, at the instant = expired', () => {
    const created = new Date('2026-09-01T00:00:00Z');
    const end = trialEndFor(created, LAUNCH);
    expect(computeEntitlement(created, null, new Date(end.getTime() - 1), LAUNCH).canManage).toBe(true);
    expect(computeEntitlement(created, null, end, LAUNCH).canManage).toBe(false);
    expect(computeEntitlement(created, null, end, LAUNCH).state).toBe('expired');
  });

  it('is timezone-independent (pure epoch arithmetic)', () => {
    const created = new Date('2026-09-01T23:59:59.999Z');
    const a = trialEndFor(created, LAUNCH).toISOString();
    const b = trialEndFor(new Date(created.getTime()), LAUNCH).toISOString();
    expect(a).toBe(b);
  });
});

describe('entitlement states', () => {
  const created = new Date('2026-08-02T00:00:00Z');
  const inTrial = new Date('2026-09-01T00:00:00Z');
  const afterTrial = new Date('2026-12-01T00:00:00Z');
  const sub = (over: Partial<{ status: string; currentPeriodEnd: Date | null; cancelAtPeriodEnd: boolean }>) => ({
    status: 'active', currentPeriodEnd: new Date('2026-12-15T00:00:00Z'), cancelAtPeriodEnd: false, ...over,
  });

  it('active trial, no subscription → trial/canManage', () => {
    const e = computeEntitlement(created, null, inTrial, LAUNCH);
    expect(e).toMatchObject({ state: 'trial', canManage: true });
    expect(e.trialDaysLeft).toBeGreaterThan(0);
  });

  it('expired trial, no subscription → expired/cannot manage', () => {
    expect(computeEntitlement(created, null, afterTrial, LAUNCH))
      .toMatchObject({ state: 'expired', canManage: false, trialDaysLeft: 0 });
  });

  it('active subscriber → subscriber/canManage', () => {
    expect(computeEntitlement(created, sub({}), afterTrial, LAUNCH))
      .toMatchObject({ state: 'subscriber', canManage: true });
  });

  it('cancelled but paid-through → retains access until the period end', () => {
    const e = computeEntitlement(created, sub({ status: 'canceled' }), afterTrial, LAUNCH);
    expect(e).toMatchObject({ state: 'canceling', canManage: true });
  });

  it('cancel scheduled (cancelAtPeriodEnd) → access to the period end', () => {
    expect(computeEntitlement(created, sub({ cancelAtPeriodEnd: true }), afterTrial, LAUNCH))
      .toMatchObject({ state: 'canceling', canManage: true });
  });

  it('cancelled and period over → expired', () => {
    const e = computeEntitlement(
      created,
      sub({ status: 'canceled', currentPeriodEnd: new Date('2026-11-20T00:00:00Z') }),
      afterTrial, LAUNCH,
    );
    expect(e).toMatchObject({ state: 'expired', canManage: false });
  });

  it('past_due → grace access until the period end, then blocked', () => {
    const graced = computeEntitlement(created, sub({ status: 'past_due' }), afterTrial, LAUNCH);
    expect(graced).toMatchObject({ state: 'past_due', canManage: true });
    const overdue = computeEntitlement(
      created,
      sub({ status: 'past_due', currentPeriodEnd: new Date('2026-11-20T00:00:00Z') }),
      afterTrial, LAUNCH,
    );
    expect(overdue).toMatchObject({ state: 'past_due', canManage: false });
  });

  it('incomplete/unknown provider states never grant paid access', () => {
    expect(computeEntitlement(created, sub({ status: 'incomplete' }), afterTrial, LAUNCH).canManage).toBe(false);
    expect(computeEntitlement(created, sub({ status: 'weird_new_status' }), afterTrial, LAUNCH).canManage).toBe(false);
  });

  it('a paid state during an active trial never blocks the trial', () => {
    const e = computeEntitlement(
      created,
      sub({ status: 'canceled', currentPeriodEnd: new Date('2026-08-15T00:00:00Z') }),
      inTrial, LAUNCH,
    );
    expect(e.canManage).toBe(true); // trial still open
  });
});

describe('protected actions against a real database', () => {
  const WEB_ROOT = resolve(__dirname, '../../..');
  let dir: string;
  let db: PrismaClient;
  let trialUser: string;
  let expiredUser: string;

  const prevLaunch = process.env.BILLING_LAUNCHED_AT;

  beforeAll(async () => {
    // Pin the launch instant to the past so the backdated account's
    // trial (launch + 92 days) has genuinely lapsed. Without this, the
    // existing-user rule would (correctly) grant a fresh trial.
    process.env.BILLING_LAUNCHED_AT = '2025-01-01T00:00:00Z';
    dir = mkdtempSync(join(tmpdir(), 'axx-m5-'));
    const url = `file:${join(dir, 'test.db')}`;
    execSync('npx prisma db push --skip-generate', {
      cwd: WEB_ROOT, env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe',
    });
    db = new PrismaClient({ datasources: { db: { url } } });
    const a = await db.user.create({ data: { email: 'trial@example.com', password: 'x' } });
    trialUser = a.id;
    const b = await db.user.create({
      data: { email: 'expired@example.com', password: 'x', createdAt: new Date('2025-01-01T00:00:00Z') },
    });
    expiredUser = b.id;
    // Seed the expired user's collection while entitled is irrelevant at
    // the repo layer — saveAssessment itself is not gated (routes are).
    await saveAssessment(db, expiredUser, {
      systemText: 'Assess my system: Bluesound Node, Marantz PM8006, KEF R3',
      notes: 'Kept.',
    });
  }, 120_000);

  afterAll(async () => {
    if (prevLaunch === undefined) delete process.env.BILLING_LAUNCHED_AT;
    else process.env.BILLING_LAUNCHED_AT = prevLaunch;
    await db?.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  });

  it('requireManage passes for an active trial', async () => {
    await expect(requireManage(db, trialUser)).resolves.toMatchObject({ state: 'trial' });
  });

  it('requireManage throws the typed error for an expired trial', async () => {
    await expect(requireManage(db, expiredUser)).rejects.toBeInstanceOf(SubscriptionRequiredError);
  });

  it('an expired user still READS everything: list, system, history, notes', async () => {
    const { listMySystems, getSavedSystem } = await import('../save-system');
    const list = await listMySystems(db, expiredUser);
    expect(list).toHaveLength(1);
    const detail = await getSavedSystem(db, expiredUser, list[0].id);
    expect(detail?.notes).toBe('Kept.');
    expect(detail?.history.length).toBe(1);
  });

  it('a subscription row flips the expired user back to entitled', async () => {
    await db.subscription.create({
      data: {
        userId: expiredUser, stripeCustomerId: 'cus_test_1',
        stripeSubscriptionId: 'sub_test_1', status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * DAY),
      },
    });
    await expect(requireManage(db, expiredUser)).resolves.toMatchObject({ state: 'subscriber' });
    await db.subscription.delete({ where: { userId: expiredUser } });
  });

  it('missing/stale provider state degrades to the last-known DB state (trial rule)', async () => {
    const e = await getEntitlement(db, expiredUser);
    expect(e).toMatchObject({ state: 'expired', canManage: false, hasSubscription: false });
  });

  it('unknown user → null entitlement, typed error from the guard', async () => {
    expect(await getEntitlement(db, 'no-such-user')).toBeNull();
    await expect(requireManage(db, 'no-such-user')).rejects.toBeInstanceOf(SubscriptionRequiredError);
  });
});
