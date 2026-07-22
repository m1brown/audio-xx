/**
 * Product suite — Assessment History (MVP M3).
 *
 * Pins the history model against a real throwaway SQLite database:
 * one system per canonical configuration, a newest-first history of
 * immutable assessments, the explicit identical-reassessment rule,
 * metadata preservation, ownership scoping, and graceful degradation.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  saveAssessment, getSavedSystem, listMySystems, payloadsMateriallyEqual,
} from '../save-system';

const WEB_ROOT = resolve(__dirname, '../../..');
const CHAIN = 'Assess my system: Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus';

let dir: string;
let db: PrismaClient;
let userId: string;
let systemId: string;

/** Rewrite the current latest snapshot to simulate an older engine's differing reading. */
async function backdateLatest(verdict: string, engine: string): Promise<string> {
  const latest = await db.assessmentSnapshot.findFirstOrThrow({
    where: { systemId },
    orderBy: { createdAt: 'desc' },
  });
  const payload = JSON.parse(latest.payloadJson);
  payload.verdict = verdict;
  await db.assessmentSnapshot.update({
    where: { id: latest.id },
    data: {
      payloadJson: JSON.stringify(payload),
      engineVersion: engine,
      // Push it into the past so ordering by createdAt is unambiguous.
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
    },
  });
  return latest.id;
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'axx-m3-'));
  const url = `file:${join(dir, 'test.db')}`;
  execSync('npx prisma db push --skip-generate', {
    cwd: WEB_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  db = new PrismaClient({ datasources: { db: { url } } });
  const user = await db.user.create({ data: { email: 'historian@example.com', password: 'hashed' } });
  userId = user.id;
  const first = await saveAssessment(db, userId, { systemText: CHAIN, notes: 'Reference rig.' });
  systemId = first.systemId;
}, 120_000);

afterAll(async () => {
  await db?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

describe('the identical-reassessment rule', () => {
  it('is deterministic on the payload comparator: date differences are not a new reading', () => {
    const a = JSON.stringify({ verdict: 'Same.', date: '1 JULY 2026', caseParagraphs: ['x'] });
    const b = JSON.stringify({ verdict: 'Same.', date: '22 JULY 2026', caseParagraphs: ['x'] });
    const c = JSON.stringify({ verdict: 'Different.', date: '22 JULY 2026', caseParagraphs: ['x'] });
    expect(payloadsMateriallyEqual(a, b)).toBe(true);
    expect(payloadsMateriallyEqual(a, c)).toBe(false);
    expect(payloadsMateriallyEqual('{broken', b)).toBe(false);
  });

  it('double submission and refresh-resubmit append nothing', async () => {
    const [r1, r2] = await Promise.all([
      saveAssessment(db, userId, { systemText: CHAIN }),
      saveAssessment(db, userId, { systemText: CHAIN }),
    ]);
    const r3 = await saveAssessment(db, userId, { systemText: CHAIN }); // "refresh"
    expect([r1.identical, r2.identical, r3.identical].filter(Boolean).length).toBeGreaterThanOrEqual(2);
    const snaps = await db.assessmentSnapshot.count({ where: { systemId } });
    expect(snaps).toBe(1);
    const systems = await db.system.count({ where: { userId } });
    expect(systems).toBe(1);
  });

  it('an engine change alone is a meaningful reason to append', async () => {
    // Same content, different engine version stored → the rule appends,
    // because the reading now carries a different engine's signature.
    const latest = await db.assessmentSnapshot.findFirstOrThrow({ where: { systemId } });
    await db.assessmentSnapshot.update({
      where: { id: latest.id },
      data: { engineVersion: 'v-previous', createdAt: new Date(Date.now() - 86_400_000) },
    });
    const result = await saveAssessment(db, userId, { systemText: CHAIN });
    expect(result.identical).toBe(false);
    expect(await db.assessmentSnapshot.count({ where: { systemId } })).toBe(2);
  });
});

describe('history — journeys A and C at the persistence level', () => {
  it('a changed reading appends exactly one entry; history is newest first with the latest flagged', async () => {
    await db.system.update({ where: { id: systemId }, data: { name: 'The Listening Room', notes: 'Renamed by hand.' } });
    await backdateLatest('The amplifier was the earlier concern.', 'v-old-2');

    const result = await saveAssessment(db, userId, { systemText: CHAIN, name: 'Ignored', notes: 'Ignored' });
    expect(result.identical).toBe(false);

    const detail = (await getSavedSystem(db, userId, systemId))!;
    expect(detail.name).toBe('The Listening Room');          // Journey C: preserved
    expect(detail.notes).toBe('Renamed by hand.');            // Journey C: preserved
    expect(detail.history.length).toBe(3);
    expect(detail.history[0].latest).toBe(true);
    expect(detail.history.slice(1).every((h) => !h.latest)).toBe(true);
    const dates = detail.history.map((h) => h.savedAt);
    expect([...dates].sort().reverse()).toEqual(dates);       // newest first
    // The rewritten fixture entry was backdated 30 days — it sits at the
    // bottom of the newest-first list.
    expect(detail.history[2].verdict).toBe('The amplifier was the earlier concern.');
  });

  it('earlier assessments remain byte-immutable through later saves', async () => {
    const before = await db.assessmentSnapshot.findMany({
      where: { systemId }, orderBy: { createdAt: 'asc' },
    });
    await backdateLatest('Different again for the next append.', 'v-old-3');
    await saveAssessment(db, userId, { systemText: CHAIN });
    const after = await db.assessmentSnapshot.findMany({
      where: { systemId }, orderBy: { createdAt: 'asc' },
    });
    // Every previously-existing row except the one we deliberately rewrote
    // in the fixture is byte-identical.
    for (const row of before.slice(0, -1)) {
      const match = after.find((r) => r.id === row.id)!;
      expect(match.payloadJson).toBe(row.payloadJson);
      expect(match.engineVersion).toBe(row.engineVersion);
    }
    expect(after.length).toBe(before.length + 1);
  });

  it('a corrupted history entry degrades without hiding the rest', async () => {
    const corrupt = await db.assessmentSnapshot.create({
      data: {
        systemId, userId, systemText: CHAIN,
        payloadJson: '{not json', engineVersion: 'dev',
        createdAt: new Date(Date.now() - 86_400_000 * 60),
      },
    });
    const detail = (await getSavedSystem(db, userId, systemId))!;
    const entry = detail.history.find((h) => h.id === corrupt.id)!;
    expect(entry.readable).toBe(false);
    expect(entry.verdict).toBeNull();
    expect(detail.history.filter((h) => h.readable).length).toBeGreaterThanOrEqual(3);
    await db.assessmentSnapshot.delete({ where: { id: corrupt.id } });
  });
});

describe('access control and degradation', () => {
  it('another user cannot read the system or its history', async () => {
    const stranger = await db.user.create({ data: { email: 'stranger@example.com', password: 'hashed' } });
    expect(await getSavedSystem(db, stranger.id, systemId)).toBeNull();
    expect(await listMySystems(db, stranger.id)).toHaveLength(0);
  });

  it('an unknown system id returns null, not an error', async () => {
    expect(await getSavedSystem(db, userId, 'no-such-id')).toBeNull();
  });

  it('the collection summary counts history correctly', async () => {
    const list = await listMySystems(db, userId);
    const item = list.find((s) => s.id === systemId)!;
    expect(item.snapshotCount).toBe(4);
    expect(item.verdict).toBeTruthy();
  });

  it('deleting the system removes its full history and nothing else', async () => {
    const other = await saveAssessment(db, userId, {
      systemText: 'Assess my system: Bluesound Node, Marantz PM8006, KEF R3',
    });
    await db.system.delete({ where: { id: systemId } });
    expect(await db.assessmentSnapshot.count({ where: { systemId } })).toBe(0);
    expect(await db.assessmentSnapshot.count({ where: { systemId: other.systemId } })).toBe(1);
  });
});
