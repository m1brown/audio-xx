#!/usr/bin/env node
/**
 * Suggested Edits Slice 1 — founder review listing.
 *
 *   node scripts/contributions-review.mjs [status=pending] [limit=100]
 *
 * Thin wrapper: the listing itself lives beside the store
 * (apps/web/src/lib/contributions/review-cli.ts) so it shares the app's
 * prisma client and environment resolution.
 */
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const r = spawnSync('npx', ['tsx', 'apps/web/src/lib/contributions/review-cli.ts', ...args], {
  stdio: 'inherit',
  cwd: new URL('..', import.meta.url).pathname,
});
process.exit(r.status ?? 1);
