#!/usr/bin/env node
/**
 * Audio XX — QA harness CLI.
 *
 *   node scripts/qa-harness.mjs fast            # deterministic tiers 1-2 + historical proof (no model calls)
 *   node scripts/qa-harness.mjs full            # + e2e frame admission + TIER 3 soft judge (OPENAI_API_KEY optional)
 *   node scripts/qa-harness.mjs p1 <caseId>     # targeted: one case + its mutations + related golden controls
 *   node scripts/qa-harness.mjs capture         # capture live production assessments for soft judging
 *
 * Case ids for `p1`: see apps/web/src/qa/harness/corpus.ts (e.g.
 * followon-discourse, accuphase-trio, nad-vintage, decware-magnepan).
 */
import { spawnSync } from 'node:child_process';

const [mode, arg] = process.argv.slice(2);
const FAST_FILES = [
  'apps/web/src/qa/__tests__/qa-fast.test.ts',
  'apps/web/src/qa/__tests__/qa-historical-proof.test.ts',
];
const FULL_FILES = [...FAST_FILES, 'apps/web/src/qa/__tests__/qa-full.test.ts'];

function run(files, env = {}) {
  const t0 = Date.now();
  const r = spawnSync('npx', ['vitest', 'run', ...files], {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  console.log(`\n[qa-harness] mode=${mode} elapsed=${((Date.now() - t0) / 1000).toFixed(1)}s`);
  process.exit(r.status ?? 1);
}

switch (mode) {
  case 'fast':
    run(FAST_FILES);
    break;
  case 'full':
    run(FULL_FILES, { QA_FULL: '1' });
    break;
  case 'p1': {
    if (!arg) {
      console.error('usage: node scripts/qa-harness.mjs p1 <caseId>');
      process.exit(2);
    }
    run(FAST_FILES, { QA_P1: arg });
    break;
  }
  case 'capture': {
    const r = spawnSync('node', ['scripts/qa-capture-live.mjs'], { stdio: 'inherit' });
    process.exit(r.status ?? 1);
    break;
  }
  default:
    console.error('usage: node scripts/qa-harness.mjs fast|full|p1 <caseId>|capture');
    process.exit(2);
}
