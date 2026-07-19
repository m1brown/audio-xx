#!/usr/bin/env node
/**
 * Test gate — trusted-baseline runner (MVP launch condition, 2026-07-19).
 *
 * The repo carries a set of known-failing tests (apps/web/test-baseline.json)
 * triaged at the launch gate: stale copy assertions from months of prose
 * evolution, plus tests that encode desired shopping-anchor behaviour the
 * launch blockers are about to implement. Rather than letting 35 red tests
 * mask new regressions, this gate:
 *
 *   - runs the full vitest suite (excluding the launch-qa benchmark harness),
 *   - FAILS (exit 1) on any failure NOT in the baseline (a regression),
 *   - reports baseline entries that now PASS so the baseline can shrink
 *     (prune them from test-baseline.json — never let it grow).
 *
 * Usage:  node scripts/test-gate.mjs
 * Update: fix a test → remove its line from apps/web/test-baseline.json.
 * Adding NEW entries to the baseline requires explicit founder sign-off.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(REPO, 'apps/web/test-baseline.json');
const outFile = join(mkdtempSync(join(tmpdir(), 'test-gate-')), 'results.json');

const baseline = new Set(JSON.parse(readFileSync(BASELINE_PATH, 'utf8')));

try {
  execSync(
    `npx vitest run --exclude "**/node_modules/**" --exclude "**/launch-qa/**" --reporter=json --outputFile=${outFile}`,
    { cwd: REPO, stdio: ['ignore', 'ignore', 'inherit'] },
  );
} catch {
  // vitest exits non-zero when any test fails — expected; results file still written.
}

const results = JSON.parse(readFileSync(outFile, 'utf8'));
const failures = [];
let passed = 0;
for (const tf of results.testResults) {
  for (const a of tf.assertionResults) {
    if (a.status === 'failed') {
      failures.push(tf.name.replace(REPO + '/', '') + ' :: ' + a.fullName);
    } else if (a.status === 'passed') {
      passed++;
    }
  }
}

const newFailures = failures.filter((f) => !baseline.has(f));
const stillFailing = failures.filter((f) => baseline.has(f));
const nowPassing = [...baseline].filter((b) => !failures.includes(b));

console.log(`\n── Test gate ──`);
console.log(`passed: ${passed} · failing (in baseline): ${stillFailing.length} · baseline entries now passing: ${nowPassing.length}`);
if (nowPassing.length > 0) {
  console.log(`\nBaseline entries that now PASS — prune from ${BASELINE_PATH}:`);
  nowPassing.forEach((f) => console.log('  ✓ ' + f));
}
if (newFailures.length > 0) {
  console.log(`\n✗ NEW failures (not in baseline) — the gate FAILS:`);
  newFailures.forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('\nGate PASSED — no regressions vs trusted baseline.');
