#!/usr/bin/env node
/**
 * M1 plumbing — founder-retest sequence through the REAL browser path.
 *
 * Two legs:
 *
 *   node scripts/vnext-m1-plumbing-replay.mjs [baseUrl]
 *     Full sequence against a healthy lane: assessment → three lane turns
 *     (founder retest phrasings, candidate turn repeated) → explicit new
 *     system → follow-up. Asserts authority, roster isolation and absence
 *     of every legacy surface. Never asserts prose.
 *
 *   node scripts/vnext-m1-plumbing-replay.mjs [baseUrl] --lane-failing
 *     Defect-A leg against a server whose lane cannot publish (start dev
 *     with REASONING_LANE_MODEL=<bogus>): the candidate turn must end in
 *     the lane's safe failure — never the legacy Partial Recognition
 *     reinterpretation.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const LANE_FAILING = process.argv.includes('--lane-failing');

const ASSESS = 'Assess my system: Eversolo DMP-A6, Chord Hugo, JOB INTegrated, WLM Diva Monitor.';
const T_DAC = 'Which DAC of the three should be best for me if I want the most intimacy and connection?';
const T_UPGRADE = 'What upgrade would give me the most bang for the buck if I want more of the same?';
const T_CANDIDATES = 'Can you suggest a component in each category?';
const T_NEW_SYSTEM = 'Assess this system: dCS Rossini Apex, ARC Ref 5, Butler Monads, Acora QRC-2';
const T_FOLLOWUP = 'Which amplifier is the most interesting part of this system?';

const LEGACY_REINTERPRETATION = [
  'I recognised', 'Partial recognition', 'recognised signal, no curated rule',
  'Generic product placeholder', "What's your budget", 'Roughly what budget',
];
const SAFE_FAILURE_MARK = 'take another run at it';
const CLARIFICATION_LEAK = /both appear as|Quick clarification before I run/i;

let failures = 0;
const fail = (m) => { failures++; console.error(`  ✗ ${m}`); };
const ok = (m) => console.log(`  ✓ ${m}`);

const laneCalls = [];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
p.on('request', (r) => {
  if (r.url().includes('/api/reasoning-lane') && r.method() === 'POST') {
    try { laneCalls.push(JSON.parse(r.postData() ?? '{}')); } catch { laneCalls.push({}); }
  }
});

async function bodyText() {
  for (let i = 0; i < 5; i++) {
    try { return await p.evaluate(() => (document.querySelector('main') ?? document.body).innerText); } catch { await p.waitForTimeout(2000); }
  }
  return '';
}
function prefixLen(a, c) { const n = Math.min(a.length, c.length); let i = 0; while (i < n && a[i] === c[i]) i++; return i; }
async function waitStable(minFrom) {
  let last = ''; let stable = 0; const t0 = Date.now();
  while (Date.now() - t0 < 300000) {
    await p.waitForTimeout(3000);
    const t = await bodyText();
    if (t === last && t.length > minFrom) stable++; else stable = 0;
    last = t;
    if (stable >= 3) return t;
  }
  return last;
}
await p.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
await p.waitForTimeout(3000);
const box = p.locator('textarea:not([placeholder*="Anything else"]):visible').first();
const send = p.getByRole('button', { name: 'Send', exact: true }).first();
for (let i = 0; i < 60; i++) { if (await send.isEnabled().catch(() => false)) break; await p.waitForTimeout(1000); }
async function submit(q, prev) {
  for (let k = 0; k < 30; k++) {
    await box.click().catch(() => {});
    await box.fill(q).catch(() => {});
    await p.waitForTimeout(400);
    if ((await box.inputValue().catch(() => '')) === q && (await send.isEnabled().catch(() => false))) break;
  }
  await send.click().catch(() => {});
  const full = await waitStable(prev.length);
  let region = full.slice(prefixLen(prev, full));
  const qEcho = region.indexOf(q);
  if (qEcho >= 0) region = region.slice(qEcho + q.length);
  // Cut page chrome (recents list, sidebar, footer) so content assertions
  // scan the RESPONSE only — the recents entry titles prior turns with
  // their component names and re-renders on every submit (same cut list
  // as the established capture scripts).
  for (const cut of ['\nSend\n', '\nStart over', '\nStart Over', '\nContact\n',
    'LISTENER\n', '\nRECENT\n', '\nReport issue', '\nRecent\n']) {
    const ci = region.indexOf(cut);
    if (ci > 0) region = region.slice(0, ci);
  }
  return { full, region };
}

function assertNoLegacy(region, label) {
  const hit = LEGACY_REINTERPRETATION.find((m) => region.includes(m));
  if (hit) fail(`${label}: legacy reinterpretation surfaced ("${hit}")`);
  else ok(`${label}: no legacy reinterpretation surface`);
}

let prev = await bodyText();
console.log('turn 0: assessment');
{
  const { full, region } = await submit(ASSESS, prev);
  prev = full;
  const upper = region.toUpperCase();
  if (['EVERSOLO', 'CHORD HUGO', 'JOB INTEGRATED', 'WLM DIVA'].every((n) => upper.includes(n))) {
    ok('assessment rendered with all four components');
  } else fail('assessment missing components');
}

if (LANE_FAILING) {
  // Defect-A leg: candidate turn against a lane that cannot publish.
  console.log('turn 1 (lane failing): candidate solicitation');
  const before = laneCalls.length;
  const { region } = await submit(T_CANDIDATES, prev);
  const attempts = laneCalls.length - before;
  if (attempts >= 2) ok(`lane attempted with bounded retry (${attempts} attempts)`);
  else fail(`expected 2 lane attempts, saw ${attempts}`);
  if (region.includes(SAFE_FAILURE_MARK)) ok('safe failure rendered in the lane\'s own voice');
  else fail('safe failure NOT rendered');
  assertNoLegacy(region, 'failed lane turn');
  await b.close();
  console.log(failures === 0 ? '\nPLUMBING REPLAY (lane-failing leg): ALL PASS' : `\nPLUMBING REPLAY: ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

const LANE_TURNS = [T_DAC, T_UPGRADE, T_CANDIDATES, T_CANDIDATES];
for (let i = 0; i < LANE_TURNS.length; i++) {
  const q = LANE_TURNS[i];
  const label = i === 3 ? 'repeat candidate turn' : `turn ${i + 1}`;
  console.log(`${label}: ${q.slice(0, 55)}`);
  const before = laneCalls.length;
  const { full, region } = await submit(q, prev);
  prev = full;
  if (laneCalls.length > before) ok('lane owned the turn');
  else fail('no lane request — legacy consumed the turn');
  assertNoLegacy(region, label);
  if (region.includes(SAFE_FAILURE_MARK)) console.log('  (note: safe failure on this turn — authority held)');
}

console.log('new-system turn');
{
  const before = laneCalls.length;
  const { full, region } = await submit(T_NEW_SYSTEM, prev);
  prev = full;
  if (laneCalls.length === before) ok('explicit new system bypassed every lane site');
  else fail('new-system turn reached the lane');
  if (CLARIFICATION_LEAK.test(region)) fail('false role-collision clarification rendered');
  else ok('no false duplicate-role clarification');
  const upper = region.toUpperCase();
  if (upper.includes('ROSSINI') && upper.includes('ACORA')) ok('new roster assessed');
  else fail('new roster not rendered');
  for (const leaked of ['EVERSOLO', 'WLM DIVA']) {
    if (upper.includes(leaked)) fail(`France II component leaked into new assessment: ${leaked}`);
  }
  ok('no France II contamination detected');
}

console.log('follow-up on the new system');
{
  const before = laneCalls.length;
  const { region } = await submit(T_FOLLOWUP, prev);
  const calls = laneCalls.slice(before);
  if (calls.length === 0) fail('follow-up did not reach the lane');
  else {
    const comps = calls[0]?.activeSystem?.components?.map((c) => c.displayName) ?? [];
    const compStr = comps.join(' | ').toLowerCase();
    if (compStr.includes('rossini') && !compStr.includes('eversolo')) {
      ok(`lane re-armed on the conversation-local roster (${comps.length} components)`);
    } else fail(`lane roster wrong after new assessment: [${comps.join(', ')}]`);
  }
  assertNoLegacy(region, 'follow-up');
}

await b.close();
console.log(failures === 0 ? '\nPLUMBING REPLAY: ALL PASS' : `\nPLUMBING REPLAY: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
