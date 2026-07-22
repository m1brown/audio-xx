/**
 * Product suite — Save System & My Systems persistence (MVP M2).
 *
 * Runs the real persistence logic against a throwaway SQLite database
 * (schema pushed in setup), so what's tested is what production runs:
 * saving recomputes the assessment server-side and stores an immutable
 * snapshot; duplicates append history instead of new systems; renames
 * and removals behave; snapshots survive engine-output changes.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  saveAssessment, listMySystems, normalizeSystemText, deriveSystemName, SaveError,
} from '../save-system';
import { runArtifactPipeline } from '../assessment-pipeline';

const WEB_ROOT = resolve(__dirname, '../../..');
const CHAIN = 'Assess my system: Denafrips Pontus II, Leben CS600X, DeVore O/96';

let dir: string;
let db: PrismaClient;
let userId: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'axx-m2-'));
  const url = `file:${join(dir, 'test.db')}`;
  execSync('npx prisma db push --skip-generate', {
    cwd: WEB_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  db = new PrismaClient({ datasources: { db: { url } } });
  const user = await db.user.create({ data: { email: 'collector@example.com', password: 'hashed' } });
  userId = user.id;
}, 120_000);

afterAll(async () => {
  await db?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

describe('pure logic', () => {
  it('normalizes whitespace but preserves content', () => {
    expect(normalizeSystemText('  Assess   my system:  A,  B ')).toBe('Assess my system: A, B');
  });

  it('derives the collection name from the component credit', () => {
    const rendered = runArtifactPipeline(CHAIN)!;
    const name = deriveSystemName(rendered.payload);
    expect(name).toMatch(/Pontus/);
    expect(name).toMatch(/·/);
    expect(name.length).toBeLessThanOrEqual(80);
  });
});

describe('saving', () => {
  it('creates a system with an immutable snapshot (name, dates, engine version)', async () => {
    const result = await saveAssessment(db, userId, { systemText: CHAIN, notes: 'The living room rig.' });
    expect(result.duplicate).toBe(false);
    expect(result.name).toMatch(/Pontus/);

    const system = await db.system.findUniqueOrThrow({
      where: { id: result.systemId },
      include: { assessments: true },
    });
    expect(system.canonicalText).toBe(CHAIN);
    expect(system.notes).toBe('The living room rig.');
    expect(system.createdAt).toBeInstanceOf(Date);
    expect(system.updatedAt).toBeInstanceOf(Date);
    expect(system.assessments).toHaveLength(1);

    const snap = system.assessments[0];
    expect(snap.engineVersion).toBe('dev');
    expect(snap.systemText).toBe(CHAIN);
    const payload = JSON.parse(snap.payloadJson);
    expect(payload.verdict).toBeTruthy();
    expect(payload.componentCredit.join(' ')).toMatch(/Pontus/);
  });

  it('identical re-save appends nothing — the explicit identical-reassessment rule (M3)', async () => {
    // Same engine, same content, only the date would differ → not a new
    // reading. Also makes double-submit and refresh-resubmit idempotent.
    const again = await saveAssessment(db, userId, { systemText: `  ${CHAIN}  ` });
    expect(again.duplicate).toBe(true);
    expect(again.identical).toBe(true);

    const systems = await db.system.findMany({ where: { userId, canonicalText: CHAIN } });
    expect(systems).toHaveLength(1);
    const snaps = await db.assessmentSnapshot.findMany({ where: { systemId: systems[0].id } });
    expect(snaps).toHaveLength(1);
    expect(again.snapshotId).toBe(snaps[0].id); // points at the existing latest
  });

  it('a re-save never overwrites the user’s name or notes', async () => {
    const sys = await db.system.findFirstOrThrow({ where: { userId, canonicalText: CHAIN } });
    await db.system.update({ where: { id: sys.id }, data: { name: 'Listening Room', notes: 'Renamed.' } });
    await saveAssessment(db, userId, { systemText: CHAIN, name: 'Should Be Ignored', notes: 'Also ignored' });
    const after = await db.system.findUniqueOrThrow({ where: { id: sys.id } });
    expect(after.name).toBe('Listening Room');
    expect(after.notes).toBe('Renamed.');
  });

  it('a changed reading appends exactly one snapshot; the earlier one is untouched', async () => {
    // Simulate an earlier engine's differing output by rewriting the
    // stored latest snapshot, then re-saving with the current engine.
    const sys = await db.system.findFirstOrThrow({ where: { userId, canonicalText: CHAIN } });
    const latest = await db.assessmentSnapshot.findFirstOrThrow({ where: { systemId: sys.id } });
    const olderPayload = JSON.stringify({
      ...JSON.parse(latest.payloadJson),
      verdict: 'An earlier engine said something different.',
    });
    await db.assessmentSnapshot.update({
      where: { id: latest.id },
      data: { payloadJson: olderPayload, engineVersion: 'v-old' },
    });

    const result = await saveAssessment(db, userId, { systemText: CHAIN });
    expect(result.duplicate).toBe(true);
    expect(result.identical).toBe(false);

    const snaps = await db.assessmentSnapshot.findMany({
      where: { systemId: sys.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(snaps).toHaveLength(2);
    // The earlier snapshot is immutable history — byte-identical to what we stored.
    expect(snaps[0].payloadJson).toBe(olderPayload);
    expect(snaps[0].engineVersion).toBe('v-old');
    expect(snaps[1].engineVersion).toBe('dev');
    expect(JSON.parse(snaps[1].payloadJson).verdict).not.toBe('An earlier engine said something different.');
  });

  it('rejects text that does not resolve to an assessment', async () => {
    await expect(saveAssessment(db, userId, { systemText: 'mystery box' }))
      .rejects.toThrowError(SaveError);
    await expect(saveAssessment(db, userId, { systemText: '' }))
      .rejects.toThrowError(SaveError);
  });

  it('a second user saving the same chain gets their own system', async () => {
    const other = await db.user.create({ data: { email: 'other@example.com', password: 'hashed' } });
    const result = await saveAssessment(db, other.id, { systemText: CHAIN });
    expect(result.duplicate).toBe(false);
    const mine = await db.system.findMany({ where: { canonicalText: CHAIN } });
    expect(mine).toHaveLength(2);
  });
});

describe('retrieval — the collection', () => {
  it('lists systems with chain, verdict, dates, and engine version', async () => {
    const list = await listMySystems(db, userId);
    expect(list.length).toBeGreaterThanOrEqual(1);
    const item = list.find((s) => s.canonicalText === CHAIN)!;
    expect(item.chain.join(' ')).toMatch(/Pontus/);
    expect(item.verdict).toBeTruthy();
    expect(item.assessedAt).toBeTruthy();
    expect(item.engineVersion).toBe('dev');
    expect(item.snapshotCount).toBe(2);
  });

  it('never returns another user’s systems', async () => {
    const other = await db.user.findFirstOrThrow({ where: { email: 'other@example.com' } });
    const list = await listMySystems(db, other.id);
    expect(list).toHaveLength(1);
    expect(list.every((s) => s.name !== 'Listening Room')).toBe(true);
  });

  it('a corrupted payload degrades gracefully instead of breaking the list', async () => {
    const sys = await db.system.create({
      data: { userId, name: 'Corrupt', canonicalText: 'Assess my system: X, Y' },
    });
    await db.assessmentSnapshot.create({
      data: { systemId: sys.id, userId, systemText: 'x', payloadJson: '{not json', engineVersion: 'dev' },
    });
    const list = await listMySystems(db, userId);
    const corrupt = list.find((s) => s.name === 'Corrupt')!;
    expect(corrupt.verdict).toBeNull();
    await db.system.delete({ where: { id: sys.id } });
  });
});

describe('organisation', () => {
  it('deleting a system cascades its snapshots and leaves others intact', async () => {
    const doomed = await saveAssessment(db, userId, {
      systemText: 'Assess my system: Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus',
    });
    await db.system.delete({ where: { id: doomed.systemId } });
    const orphans = await db.assessmentSnapshot.findMany({ where: { systemId: doomed.systemId } });
    expect(orphans).toHaveLength(0);
    const survivors = await db.assessmentSnapshot.findMany({ where: { userId } });
    expect(survivors.length).toBeGreaterThanOrEqual(2);
  });
});
