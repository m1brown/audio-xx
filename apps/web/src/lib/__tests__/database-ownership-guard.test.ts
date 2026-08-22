import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The guard that stops a normal developer command deleting the evidence layer.
 *
 * Production holds four tables `schema.prisma` does not declare, and
 * `prisma db push` drops tables it does not know about. Running the approved
 * schema change through `db push` would have deleted 46 manufacturer facts and
 * 5 admitted review observations — including the published figures behind the
 * only licensed finding in the beta system's assessment.
 */
const ROOT = process.cwd();
const GUARD = join(ROOT, 'scripts/guard-prisma-push.mjs');

const run = (env: Record<string, string | undefined>) => {
  try {
    const out = execFileSync('node', [GUARD, '--help'], {
      env: { PATH: process.env.PATH, ...env } as NodeJS.ProcessEnv,
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stderr: string; stdout: string };
    return { code: err.status, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
};

describe('prisma db push cannot reach production', () => {
  it('REFUSES when Turso credentials are present', () => {
    const r = run({ TURSO_DATABASE_URL: 'libsql://audio-xx.turso.io' });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/REFUSED/);
    expect(r.out).toMatch(/ManufacturerFactV1/);
    expect(r.out).toMatch(/IndependentReviewV1/);
  });

  it('names the four tables it is protecting', () => {
    const r = run({ TURSO_DATABASE_URL: 'libsql://audio-xx.turso.io' });
    for (const t of ['ManufacturerFactV1', 'IndependentReviewV1',
      'CorroborationCacheV2', 'CorroborationCache']) {
      expect(r.out, t).toContain(t);
    }
  });

  it('explains the consequence rather than only refusing', () => {
    const r = run({ TURSO_DATABASE_URL: 'libsql://audio-xx.turso.io' });
    expect(r.out).toMatch(/DROPS tables it does not know about/);
    expect(r.out).toMatch(/docs\/database-ownership\.md/);
  });

  it('offers the local escape hatch', () => {
    expect(run({ TURSO_DATABASE_URL: 'libsql://x' }).out).toMatch(/USE_LOCAL_DB=1/);
  });

  it('does not trip on a local SQLite target', () => {
    // A guard that blocks ordinary local work gets deleted, and then protects
    // nothing. It must be inert exactly where it is not needed.
    const r = run({ TURSO_DATABASE_URL: 'libsql://x', USE_LOCAL_DB: '1' });
    expect(r.out).not.toMatch(/REFUSED/);
    const r2 = run({ TURSO_DATABASE_URL: 'libsql://x', DATABASE_URL: 'file:./dev.db' });
    expect(r2.out).not.toMatch(/REFUSED/);
  });
});

describe('the npm script routes through the guard', () => {
  it('db:push cannot invoke prisma directly', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'apps/web/package.json'), 'utf8'));
    expect(pkg.scripts['db:push']).toContain('guard-prisma-push');
    expect(pkg.scripts['db:push']).not.toMatch(/^prisma db push/);
  });
});

describe('the ownership conflict is documented, not just guarded', () => {
  const doc = readFileSync(join(ROOT, 'docs/database-ownership.md'), 'utf8');

  it('names both categories', () => {
    expect(doc).toMatch(/Category 1 — Prisma-managed/);
    expect(doc).toMatch(/Category 2 — direct-SQL evidence and cache stores/);
  });

  it('records why the four tables were not simply added to Prisma', () => {
    expect(doc).toMatch(/Why not simply add the four tables/);
    expect(doc).toMatch(/two writers for one table definition/);
  });

  it('states the rule a production change must satisfy', () => {
    expect(doc).toMatch(/explicit targeted migration/);
    expect(doc).toMatch(/migration system that understands every production table/);
  });
});
