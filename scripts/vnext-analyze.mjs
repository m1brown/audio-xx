#!/usr/bin/env node
/**
 * vNext Phase 0 — result aggregation.
 *
 *   node scripts/vnext-analyze.mjs
 *
 * Reads apps/web/src/qa/vnext/results/{<runs>/*.jsonl, judgments.jsonl,
 * trust.jsonl} and prints the experiment summary: pairwise preferences by
 * axis, trust violations by arm/version, validation statuses, latency and
 * token usage, failures.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RESULTS = 'apps/web/src/qa/vnext/results';
const RUNS = ['main', 'gpt4o', 'repeats'];

const jl = (f) => readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));

// ── Generation stats ───────────────────────────────────────────────────
const gen = { A: [], B: [] };
const valStatus = {};
let failures = 0;
for (const run of RUNS) {
  const dir = join(RESULTS, run);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.jsonl'))) {
    for (const t of jl(join(dir, f))) {
      if (t.failed) { failures++; continue; }
      gen[t.arm]?.push(t);
      if (t.validation) valStatus[t.validation.status] = (valStatus[t.validation.status] ?? 0) + 1;
    }
  }
}
const p = (arr, q) => {
  const s = [...arr].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
};
console.log('=== GENERATION ===');
for (const arm of ['A', 'B']) {
  const ts = gen[arm];
  const lat = ts.map((t) => t.latencyMs);
  const vlat = ts.map((t) => t.validation?.validatorLatencyMs ?? 0);
  const inTok = ts.reduce((s, t) => s + (t.promptTokens ?? 0), 0);
  const outTok = ts.reduce((s, t) => s + (t.completionTokens ?? 0), 0);
  console.log(`arm ${arm}: turns=${ts.length} lat p50=${p(lat, 0.5)}ms p95=${p(lat, 0.95)}ms`
    + (arm === 'B' ? ` +validator p50=${p(vlat, 0.5)}ms p95=${p(vlat, 0.95)}ms` : '')
    + ` promptTok=${inTok} completionTok=${outTok}`);
}
console.log('failures:', failures, '· validation statuses:', JSON.stringify(valStatus));

// ── Pairwise judgments ─────────────────────────────────────────────────
const jf = join(RESULTS, 'judgments.jsonl');
if (existsSync(jf)) {
  const judg = jl(jf);
  const axisTally = {};
  const overall = { A: 0, B: 0, TIE: 0 };
  const perSystem = {};
  for (const j of judg) {
    if (!j.res || j.res.skipped) continue;
    const toArm = (v) => (v === 'TIE' ? 'TIE' : (v === 'X') === j.aIsX ? 'A' : 'B');
    const o = toArm(j.res.overall);
    overall[o]++;
    perSystem[`${j.model}·${j.system}·${j.rep}`] = o;
    for (const ax of j.res.axes ?? []) {
      axisTally[ax.axis] = axisTally[ax.axis] ?? { A: 0, B: 0, TIE: 0 };
      axisTally[ax.axis][toArm(ax.verdict)]++;
    }
  }
  console.log('\n=== BLIND PAIRWISE (A vs B) ===');
  console.log('overall:', JSON.stringify(overall));
  for (const [ax, t] of Object.entries(axisTally)) {
    console.log(`  ${ax.padEnd(24)} A=${t.A} B=${t.B} TIE=${t.TIE}`);
  }
  console.log('per conversation:', JSON.stringify(perSystem, null, 0));
}

// ── Trust audits ───────────────────────────────────────────────────────
const tf = join(RESULTS, 'trust.jsonl');
if (existsSync(tf)) {
  const trust = jl(tf);
  console.log('\n=== TRUST AUDIT (same checker, same frozen package) ===');
  const byVersion = {};
  for (const t of trust) {
    const v = byVersion[t.version] = byVersion[t.version]
      ?? { convs: 0, violations: 0, unchecked: 0, stray: 0, byType: {} };
    v.convs++;
    v.violations += t.violations;
    v.unchecked += t.unchecked ? 1 : 0;
    v.stray += t.strayCount;
    for (const [k, n] of Object.entries(t.byType ?? {})) v.byType[k] = (v.byType[k] ?? 0) + n;
  }
  for (const [ver, v] of Object.entries(byVersion)) {
    console.log(`${ver.padEnd(12)} convs=${v.convs} violations=${v.violations} unchecked=${v.unchecked} strayFigures=${v.stray} byType=${JSON.stringify(v.byType)}`);
  }
  console.log('\nper-conversation violations:');
  for (const t of trust) {
    console.log(`  ${String(t.version).padEnd(12)} ${t.model}·${t.system}·${t.rep}: ${t.violations}${t.strayCount ? ` stray=${t.strayCount}` : ''}`);
  }
}
