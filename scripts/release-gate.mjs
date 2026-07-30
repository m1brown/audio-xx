#!/usr/bin/env node
/**
 * Audio XX — four-gate release runner (Stabilization Gate 1, QA architecture).
 *
 * No production release is complete until all four gates pass:
 *   Gate A — Engine   : full unit/integration suite vs trusted baseline
 *   Gate B — Routing  : deterministic routing matrix (licensed-category)
 *   Gate C — Artifact : Assessment structural contract (+ visual tier)
 *   Gate D — UX       : homepage/builder/assessment at required widths (visual tier)
 *
 * Gates A–C are headless and always run. The visual tier (C-visual + D) drives
 * a local dev server via Playwright; it runs when --visual is passed (or
 * RELEASE_GATE_VISUAL=1) and is otherwise reported as DEFERRED — a release
 * report must then carry visual evidence from a manual `npm run qa:regress:visual`.
 *
 * Usage (repo root):
 *   node scripts/release-gate.mjs            # gates A, B, C-structural
 *   node scripts/release-gate.mjs --visual   # + Playwright visual gates (C/D)
 *
 * A passing unit-test count is no longer sufficient evidence that the product
 * is ready — the release report must cover all four gates plus visual
 * evidence, known limitations, and a production recommendation
 * (docs/qa-architecture.md).
 */
import { spawnSync } from 'node:child_process';

const visual = process.argv.includes('--visual') || process.env.RELEASE_GATE_VISUAL === '1';
const results = [];

function run(name, cmd, args, opts = {}) {
  process.stdout.write(`\n━━ ${name} ━━\n`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  const pass = r.status === 0;
  results.push({ name, status: pass ? 'PASS' : 'FAIL' });
  return pass;
}

// Gate A — Engine (full suite vs trusted baseline)
run('Gate A — Engine', 'node', ['scripts/test-gate.mjs']);

// Gate B — Routing (deterministic matrix + typed-constraint + validator tests)
run('Gate B — Routing', 'npx', ['vitest', 'run',
  'apps/web/src/lib/__tests__/routing-matrix.test.ts',
  'apps/web/src/lib/__tests__/requested-category-constraint.test.ts',
  'apps/web/src/lib/__tests__/validate-shopping-answer.test.ts',
]);

// Gate C — Assessment Artifact (structural contract)
run('Gate C — Artifact (structural)', 'npx', ['vitest', 'run',
  'apps/web/src/app/artifact/__tests__/assessment-artifact-contract.test.ts',
  'apps/web/src/app/artifact/__tests__/assessment-artifact-ia-order.test.ts',
]);

// Gates C-visual + D — Playwright visual/UX tier (needs local server).
// Defect-register gap watch #3: skipping this tier must be a CONSCIOUS act.
// Without --visual, the runner FAILS unless --accept-deferred is passed
// explicitly; the acceptance is then printed so it lands in the release report.
const acceptDeferred = process.argv.includes('--accept-deferred');
if (visual) {
  run('Gates C-visual + D — UX (Playwright)', 'npm',
    ['run', 'qa:regress:visual', '--', '--grep', 'Gate C|Gate D'],
    { cwd: 'apps/web' });
} else if (acceptDeferred) {
  results.push({ name: 'Gates C-visual + D — UX (Playwright)', status: 'DEFERRED (explicitly accepted — must appear in release report)' });
} else {
  results.push({ name: 'Gates C-visual + D — UX (Playwright)', status: 'FAIL' });
  process.stdout.write('\nVisual/UX tier did not run. Run with --visual, or pass --accept-deferred to defer it consciously.\n');
}

process.stdout.write('\n━━ Release gate summary ━━\n');
for (const r of results) process.stdout.write(`  ${r.status.padEnd(28)} ${r.name}\n`);
const failed = results.some((r) => r.status === 'FAIL');
process.stdout.write(failed
  ? '\nRELEASE GATE: FAIL — do not promote.\n'
  : '\nRELEASE GATE: PASS (deferred items must appear in the release report).\n');
process.exit(failed ? 1 : 0);
