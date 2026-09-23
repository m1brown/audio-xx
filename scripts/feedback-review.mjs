#!/usr/bin/env node
/**
 * Beta feedback — founder review listing.
 *
 *   node scripts/feedback-review.mjs [limit=200]
 *
 * Thin wrapper: the listing lives beside the store
 * (apps/web/src/lib/feedback/review-cli.ts) so it shares the app's prisma
 * client and environment resolution. Same pattern as contributions-review.
 */
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const r = spawnSync('npx', ['tsx', 'apps/web/src/lib/feedback/review-cli.ts', ...args], {
  stdio: 'inherit',
  cwd: new URL('..', import.meta.url).pathname,
});
process.exit(r.status ?? 1);
