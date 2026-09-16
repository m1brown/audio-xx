#!/usr/bin/env node
/**
 * M1 model selection — aggregation.
 *   node scripts/vnext-msel-analyze.mjs [runId=msel]
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RUN_ID = process.argv[2] ?? 'msel';
const DIR = `apps/web/src/qa/vnext/results/${RUN_ID}`;
const JUDG = `apps/web/src/qa/vnext/results/judgments-${RUN_ID}.jsonl`;
const jl = (f) => existsSync(f)
  ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(q * s.length))]) : 0; };

const perModel = {};
const perTurnKey = {};
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.jsonl'))) {
  const m = /^(.+?)__(.+)__B2__r(\d+)\.jsonl$/.exec(f);
  if (!m) continue;
  const [, model, system] = m;
  const agg = perModel[model] = perModel[model] ?? {
    convs: 0, turns: 0, published: 0, checked: 0, repaired: 0, safeFail: 0,
    retries: 0, deletionReq: 0, genErr: 0,
    detRaw: { wattLoad: 0, strayFigures: 0, evidenceVoice: 0 },
    detFinalViol: 0, semViolRaw: 0, semViolRemaining: 0,
    genLat: [], valLat: [], totalLat: [], inTok: 0, outTok: 0,
    safeFailBySystem: {},
  };
  agg.convs++;
  for (const t of jl(join(DIR, f))) {
    agg.turns++;
    const p = t.publication;
    if (!p) { if (t.failed) agg.genErr++; continue; }
    if (p.published) agg.published++;
    if (p.status === 'CHECKED') agg.checked++;
    else if (p.status === 'REPAIRED') agg.repaired++;
    else if (p.status === 'SAFE_FAILURE') {
      agg.safeFail++;
      agg.safeFailBySystem[system] = (agg.safeFailBySystem[system] ?? 0) + 1;
      const tk = `${model} · ${system} · t${t.turnIndex}`;
      perTurnKey[tk] = (perTurnKey[tk] ?? 0) + 1;
    }
    agg.retries += p.retries;
    if (p.deletionRequired) agg.deletionReq++;
    agg.detRaw.wattLoad += p.detRawDraft.wattLoad;
    agg.detRaw.strayFigures += p.detRawDraft.strayFigures;
    agg.detRaw.evidenceVoice += p.detRawDraft.evidenceVoice;
    if (!p.detFinal.clean) agg.detFinalViol++;
    for (const a of p.attempts) {
      if (a.genError) agg.genErr++;
      agg.semViolRaw += a.violations;
      agg.inTok += a.promptTokens ?? 0;
      agg.outTok += a.completionTokens ?? 0;
    }
    const first = p.attempts[0];
    if (first && !first.genError) { agg.genLat.push(first.genLatencyMs); agg.valLat.push(first.valLatencyMs); }
    agg.totalLat.push(p.attempts.reduce((s, a) => s + a.genLatencyMs + a.valLatencyMs, 0));
  }
}

console.log(`=== PUBLICATION RELIABILITY (${RUN_ID}) ===`);
for (const [model, a] of Object.entries(perModel)) {
  const r = (n) => `${(100 * n / a.turns).toFixed(1)}%`;
  console.log(`\n${model}: convs=${a.convs} turns=${a.turns}`);
  console.log(`  published=${r(a.published)} (CHECKED ${r(a.checked)}, REPAIRED ${r(a.repaired)}) · SAFE_FAILURE ${r(a.safeFail)} · retries=${a.retries} (${r(a.retries)}) · deletionReq turns=${a.deletionReq} · genErr=${a.genErr}`);
  console.log(`  det RAW drafts: wattLoad=${a.detRaw.wattLoad} stray=${a.detRaw.strayFigures} evVoice=${a.detRaw.evidenceVoice} · det violations in FINAL published text=${a.detFinalViol}`);
  console.log(`  semantic violations flagged (all attempts)=${a.semViolRaw}`);
  console.log(`  latency ms: gen p50=${pct(a.genLat, 0.5)} p90=${pct(a.genLat, 0.9)} · val p50=${pct(a.valLat, 0.5)} p90=${pct(a.valLat, 0.9)} · turn-total p50=${pct(a.totalLat, 0.5)} p90=${pct(a.totalLat, 0.9)}`);
  console.log(`  tokens: prompt=${a.inTok} completion=${a.outTok}`);
  console.log(`  safe failures by system: ${JSON.stringify(a.safeFailBySystem)}`);
}
if (Object.keys(perTurnKey).length) {
  console.log('\nSAFE-FAILURE TURNS (which turn, how often):');
  for (const [k, n] of Object.entries(perTurnKey).sort()) console.log(`  ${k}: ${n}`);
}

// ── Blind pairwise ─────────────────────────────────────────────────────
const judg = jl(JUDG);
if (judg.length) {
  const overall = {};
  const axes = {};
  const perConv = [];
  let skipped = 0;
  for (const j of judg) {
    if (!j.res || j.res.skipped) { skipped++; continue; }
    const toModel = (v) => (v === 'TIE' ? 'TIE' : (v === 'X') === j.aIsX ? j.aModel : j.bModel);
    const o = toModel(j.res.overall);
    overall[o] = (overall[o] ?? 0) + 1;
    perConv.push(`${j.system}·r${j.rep}→${o === 'TIE' ? 'TIE' : o}`);
    for (const ax of j.res.axes ?? []) {
      const t = axes[ax.axis] = axes[ax.axis] ?? {};
      const w = toModel(ax.verdict);
      t[w] = (t[w] ?? 0) + 1;
    }
  }
  console.log(`\n=== BLIND PAIRWISE (judge=${judg[0]?.judgeModel}; ${judg.length - skipped} judged, ${skipped} skipped) ===`);
  console.log('overall:', JSON.stringify(overall));
  for (const [ax, t] of Object.entries(axes)) console.log(`  ${ax.padEnd(32)} ${JSON.stringify(t)}`);
  console.log('per conversation:', perConv.join('  '));
}
