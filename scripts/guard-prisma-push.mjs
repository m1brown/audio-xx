#!/usr/bin/env node
/**
 * Fail-fast guard: `prisma db push` must never run against production.
 *
 * Production holds four tables that `schema.prisma` does not declare —
 * ManufacturerFactV1, IndependentReviewV1, CorroborationCacheV2 and
 * CorroborationCache — created directly by the evidence stores that own them.
 * `prisma db push` DROPS tables it does not know about, and
 * `--accept-data-loss` makes it silent. See docs/database-ownership.md.
 *
 * Local SQLite is unaffected: the guard only trips when the command would
 * reach the production Turso database.
 */
const argv = process.argv.slice(2);
const env = process.env;

const targetsProduction =
  !!env.TURSO_DATABASE_URL
  && !env.USE_LOCAL_DB
  && !(env.DATABASE_URL ?? '').startsWith('file:');

if (targetsProduction) {
  console.error(`
  ✗ REFUSED — prisma db push would target production.

    Production contains tables outside prisma/schema.prisma:
      ManufacturerFactV1, IndependentReviewV1,
      CorroborationCacheV2, CorroborationCache

    db push DROPS tables it does not know about. That is the entire
    manufacturer-fact and independent-review evidence layer.

    A production schema change needs an explicit targeted migration.
    See docs/database-ownership.md.

    For local work:  USE_LOCAL_DB=1 npm run db:push
`);
  process.exit(1);
}

const { spawnSync } = await import('node:child_process');
const r = spawnSync('npx', ['prisma', 'db', 'push', ...argv], { stdio: 'inherit' });
process.exit(r.status ?? 0);
