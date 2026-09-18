#!/usr/bin/env node
/**
 * Golden System Conversations — run aggregation + invariant checks.
 *   node scripts/golden-analyze.mjs [runId=golden-<today>]
 *
 * Deterministic layer of the analysis:
 *  - publication reliability per conversation (statuses, retries, safe failures)
 *  - CLASS A CHECK: an unsupported figure in PUBLISHED text is a P0 — the
 *    exit code is non-zero if any published turn has det violations.
 *  - candidate-turn classification (§10): A hard-fail / B safe-failure /
 *    C published-clean, per system
 *  - hypothetical slot trace (§7): armed at the 'hypothetical' slot, cleared
 *    by 'return_actual'
 *  - restraint distribution (§8) from judge stances, with flags for
 *    all-purchase and never-concrete patterns
 *  - rubric + observation-pair judgments summarized (never collapsed into
 *    one numeric score)
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RUN_ID = process.argv[2] ?? `golden-${new Date().toISOString().slice(0, 10)}`;
const DIR = `apps/web/src/qa/golden/results/${RUN_ID}`;
const JUDG = `apps/web/src/qa/golden/results/judgments-${RUN_ID}.jsonl`;
const jl = (f) => existsSync(f)
  ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];

if (!existsSync(DIR)) { console.error(`no run at ${DIR}`); process.exit(2); }
let exitCode = 0;

console.log(`=== GOLDEN CORPUS RUN ${RUN_ID} ===`);
const manifest = existsSync(join(DIR, 'manifest.json')) ? JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8')) : {};
console.log(`model=${manifest.model} validator=${manifest.validator} reps=${manifest.reps}\n`);

const convFiles = readdirSync(DIR).filter((f) => /^[a-z-]+__r\d+\.jsonl$/.test(f)).sort();
for (const f of convFiles) {
  const [, system, rep] = /^([a-z-]+)__r(\d+)\.jsonl$/.exec(f);
  const rows = jl(join(DIR, f));
  let checked = 0, repaired = 0, safeFail = 0, retries = 0, genErr = 0;
  const problems = [];
  let candidateClass = null;
  let hypoArmed = false, hypoCleared = null;
  for (const t of rows) {
    const p = t.publication;
    if (!p) { if (t.failed) genErr++; continue; }
    if (p.status === 'CHECKED') checked++;
    else if (p.status === 'REPAIRED') repaired++;
    else if (p.status === 'SAFE_FAILURE') safeFail++;
    retries += p.retries ?? 0;
    // CLASS A: published text with det violations = trust boundary breach.
    if (p.published && p.detFinal && p.detFinal.clean === false) {
      problems.push(`t${t.turnIndex} [${t.slot}] PUBLISHED WITH DET VIOLATIONS — CLASS A / P0`);
      exitCode = 1;
    }
    if (t.slot === 'candidates') {
      candidateClass = p.published && p.detFinal?.clean !== false ? 'C — useful candidates published clean'
        : p.status === 'SAFE_FAILURE' ? 'B — blocked, safe failure (trust pass, quality degradation)'
          : 'A — HARD FAILURE';
      if (candidateClass.startsWith('A')) exitCode = 1;
    }
    if (t.slot === 'hypothetical') hypoArmed = !!t.hypothetical;
    if (t.slot === 'return_actual') hypoCleared = t.hypothetical == null;
  }
  console.log(`${system} r${rep}: turns=${rows.length} CHECKED=${checked} REPAIRED=${repaired} SAFE_FAILURE=${safeFail} retries=${retries} genErr=${genErr}`);
  if (candidateClass) console.log(`  candidates turn: ${candidateClass}`);
  console.log(`  hypothetical slot: armed=${hypoArmed} clearedOnReturn=${hypoCleared}`);
  if (!hypoArmed) console.log('  NOTE: hypothetical slot never armed — check phrasing vs known P3 morphology');
  if (hypoCleared === false) { console.log('  FAIL: slot survived return_actual — actual-system invariant broken'); exitCode = 1; }
  for (const pr of problems) console.log(`  ${pr}`);
}

// ── Judgments ──────────────────────────────────────────────────────────
const judg = jl(JUDG);
const rubric = judg.filter((j) => j.kind === 'rubric' && j.res && !j.res.skipped);
const pairs = judg.filter((j) => j.kind === 'obs-pair' && j.res && !j.res.skipped);
if (rubric.length) {
  console.log(`\n=== RUBRIC (judge=${rubric[0].judgeModel}; ${rubric.length} conversations) ===`);
  const stances = [];
  for (const j of rubric) {
    const fails = (j.res.axes ?? []).filter((a) => a.verdict === 'FAIL');
    const weaks = (j.res.axes ?? []).filter((a) => a.verdict === 'WEAK');
    stances.push(j.res.stance);
    console.log(`\n${j.systemId} r${j.rep}: stance=${j.res.stance} observationUse=${j.res.observationUse} hypotheticalTracking=${j.res.hypotheticalTracking}`);
    console.log(`  PASS=${(j.res.axes ?? []).length - fails.length - weaks.length} WEAK=${weaks.length} FAIL=${fails.length}`);
    for (const a of weaks) console.log(`  WEAK ${a.axis}: ${a.reason}`);
    for (const a of fails) console.log(`  FAIL ${a.axis}: ${a.reason}\n    evidence: ${String(a.evidence).slice(0, 200)}`);
    if (j.res.observationUse === 'IGNORED') console.log('  FLAG: listener observation ignored');
    if (j.res.hypotheticalTracking === 'CONFUSED') console.log('  FLAG: hypothetical/actual confusion');
  }
  // §8 restraint distribution — flags, not required distributions.
  const buy = stances.filter((s) => s === 'CHANGE').length;
  const concrete = stances.filter((s) => s && s !== 'UNCLEAR').length;
  console.log(`\nstance distribution: ${JSON.stringify(stances)}`);
  if (buy === stances.length && stances.length >= 4) console.log('FLAG (§8): purchases recommended across ALL systems — upgrade-bias review required');
  if (concrete === 0 && stances.length >= 4) console.log('FLAG (§8): no concrete stance anywhere — over-caution review required');
}
if (pairs.length) {
  console.log(`\n=== OBSERVATION PAIRS (§6) ===`);
  for (const j of pairs) {
    console.log(`${j.systemId}: ${j.res.use} — ${j.res.reason}`);
    if (j.res.use === 'IGNORED') { console.log('  FAIL: observation ignored'); exitCode = 1; }
  }
}

process.exit(exitCode);
