#!/usr/bin/env node
/**
 * vNext Phase 0.1 — result aggregation.
 *   node scripts/vnext-analyze01.mjs
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RESULTS = 'apps/web/src/qa/vnext/results';
const jl = (f) => existsSync(f)
  ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];

// ── Generation ─────────────────────────────────────────────────────────
const dir = join(RESULTS, 'p01');
const perLabel = {};
for (const f of readdirSync(dir).filter((x) => x.endsWith('.jsonl'))) {
  const m = /^(.+)__(.+)__([AB]\d?)__(r\d+)\.jsonl$/.exec(f);
  if (!m) continue;
  const label = m[3];
  const rows = jl(join(dir, f));
  const agg = perLabel[label] = perLabel[label]
    ?? { convs: 0, turns: 0, fail: 0, lat: [], vlat: [], inTok: 0, outTok: 0, val: {} };
  agg.convs++;
  for (const t of rows) {
    agg.turns++;
    if (t.failed) { agg.fail++; continue; }
    agg.lat.push(t.latencyMs);
    agg.inTok += t.promptTokens ?? 0;
    agg.outTok += t.completionTokens ?? 0;
    if (t.validation) {
      agg.val[t.validation.status] = (agg.val[t.validation.status] ?? 0) + 1;
      agg.vlat.push(t.validation.validatorLatencyMs);
    }
  }
}
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };
console.log('=== GENERATION (p01) ===');
for (const [label, a] of Object.entries(perLabel)) {
  console.log(`${label}: convs=${a.convs} turns=${a.turns} fail=${a.fail} `
    + `lat p50=${pct(a.lat, 0.5)} p95=${pct(a.lat, 0.95)}`
    + (a.vlat.length ? ` vlat p50=${pct(a.vlat, 0.5)}` : '')
    + ` tok=${a.inTok}/${a.outTok} val=${JSON.stringify(a.val)}`);
}

// ── Pairwise ───────────────────────────────────────────────────────────
const judg = jl(join(RESULTS, 'judgments-p01.jsonl'));
const byPair = {};
for (const j of judg) {
  if (!j.res || j.res.skipped) continue;
  const pairKey = `${j.left} vs ${j.right}`;
  const toLabel = (v) => (v === 'TIE' ? 'TIE' : (v === 'X') === j.leftIsX ? j.left : j.right);
  const p = byPair[pairKey] = byPair[pairKey] ?? { overall: {}, axes: {}, per: [] };
  const o = toLabel(j.res.overall);
  p.overall[o] = (p.overall[o] ?? 0) + 1;
  p.per.push(`${j.system}·${j.rep}→${o}`);
  for (const ax of j.res.axes ?? []) {
    const t = p.axes[ax.axis] = p.axes[ax.axis] ?? {};
    const w = toLabel(ax.verdict);
    t[w] = (t[w] ?? 0) + 1;
  }
}
console.log('\n=== BLIND PAIRWISE ===');
for (const [pair, p] of Object.entries(byPair)) {
  console.log(`\n${pair}: overall=${JSON.stringify(p.overall)}`);
  for (const [ax, t] of Object.entries(p.axes)) console.log(`  ${ax.padEnd(24)} ${JSON.stringify(t)}`);
  console.log(`  per-conv: ${p.per.join(' ')}`);
}

// ── Trust (semantic) ───────────────────────────────────────────────────
const trust = jl(join(RESULTS, 'trust-p01.jsonl'));
console.log('\n=== SEMANTIC TRUST (same checker, same frozen package) ===');
const byVer = {};
for (const t of trust) {
  const v = byVer[t.version] = byVer[t.version] ?? { convs: 0, viol: 0, unchecked: 0, byType: {} };
  v.convs++; v.viol += t.violations; v.unchecked += t.unchecked ? 1 : 0;
  for (const [k, n] of Object.entries(t.byType ?? {})) v.byType[k] = (v.byType[k] ?? 0) + n;
}
for (const [ver, v] of Object.entries(byVer)) {
  console.log(`${ver.padEnd(14)} convs=${v.convs} viol=${v.viol} (${(v.viol / v.convs).toFixed(1)}/conv) unchecked=${v.unchecked} ${JSON.stringify(v.byType)}`);
}

// ── Trust (deterministic) ──────────────────────────────────────────────
const det = jl(join(RESULTS, 'det-trust-p01.jsonl'));
console.log('\n=== DETERMINISTIC TRUST ===');
const byVerD = {};
for (const t of det) {
  const v = byVerD[t.version] = byVerD[t.version] ?? { convs: 0, stray: 0, wattLoad: 0, names: 0 };
  v.convs++; v.stray += t.stray; v.wattLoad += t.wattLoad; v.names += t.names;
}
for (const [ver, v] of Object.entries(byVerD)) {
  console.log(`${ver.padEnd(14)} convs=${v.convs} strayFigures=${v.stray} unlicensedWattLoad=${v.wattLoad} noSourceNames=${v.names}`);
}
const wl = det.filter((t) => t.wattLoad > 0);
if (wl.length) {
  console.log('unlicensed watt-load spans:');
  for (const t of wl) console.log(`  ${t.version} ${t.system}·${t.rep}: ${JSON.stringify(t.wattLoadSpans)}`);
}

// ── Checker variance ───────────────────────────────────────────────────
const varr = jl(join(RESULTS, 'variance-p01.jsonl'));
if (varr.length) {
  console.log('\n=== SEMANTIC-CHECKER VARIANCE (duplicate audits, identical text) ===');
  for (const v of varr) console.log(`  ${v.system}·${v.rep}·${v.label}: counts=${JSON.stringify(v.counts)}`);
}
