#!/usr/bin/env node
/**
 * Migration 1 P1 — founder lane authority: PRODUCTION-PATH replay.
 *
 * Drives the REAL browser conversation surface (handleSubmit ordering,
 * state threading, display gating — not the route in isolation) through
 * the founder's actual failed DAC conversation and asserts AUTHORITY,
 * STATE and BEHAVIORAL MEANING, never prose:
 *
 *   • turn 0 ("Assess my system: …") runs the legacy assessment pipeline
 *     (a system-stating turn is a state-establishing boundary);
 *   • every post-assessment turn POSTs /api/reasoning-lane BEFORE any
 *     legacy author — each request carries ALL FOUR components including
 *     Chord Hugo, on every turn (actual-system invariant);
 *   • each lane response publishes (CHECKED/REPAIRED) and the displayed
 *     turn contains no legacy shopping/budget-intake surface;
 *   • "the JOB integrated includes an internal dac" does not trigger a
 *     budget question; "let's stick with the dac" does not become the
 *     legacy sequencing card.
 *
 * Run against a lane-enabled environment (local dev with the OpenAI key
 * pulled and lane eligibility open, which is the default off Vercel):
 *
 *   node scripts/vnext-m1-authority-replay.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';

const ASSESS = 'Assess my system: Eversolo DMP-A6, Chord Hugo, JOB INTegrated, WLM Diva Monitor.';
const TURNS = [
  "which dac of the three should be the best, for me that's provide the most intimacy and connection",
  'oh i meant of the three existing ones: Chord Hugo, Job Integrated, Eversolo DMP A6. I think i like Hugo the best and the Job next.',
  "let's stick with the dac for the moment, of the three (Chord Hugo, Job Integrated, Eversolo DMP A6)",
  'which do you suggest of the three?',
  'so not the internal dac in the job integrated?',
  'the job integrated includes an internal dac',
];

/** Legacy-surface markers that must NOT render on a lane-owned turn. */
const LEGACY_MARKERS = [
  "What's your budget",
  'Roughly what budget',
  'START HERE',
  'Dial in your sound',
  'For sharper picks',
  'WHAT ACTUALLY MATTERS IN A DAC',
];

let failures = 0;
const fail = (msg) => { failures++; console.error(`  ✗ ${msg}`); };
const ok = (msg) => console.log(`  ✓ ${msg}`);

async function bodyText(p) {
  // Dev-mode fast refresh can destroy the evaluation context mid-read
  // ("Execution context was destroyed"); the page reloads itself, so
  // retry after a beat rather than dying.
  for (let i = 0; i < 5; i++) {
    try {
      return await p.evaluate(() => (document.querySelector('main') ?? document.body).innerText);
    } catch {
      await p.waitForTimeout(2000);
    }
  }
  return '';
}
function commonPrefixLen(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}
async function waitStable(p, minGrowthFrom, maxMs) {
  const t0 = Date.now();
  let last = '';
  let stable = 0;
  while (Date.now() - t0 < maxMs) {
    await p.waitForTimeout(3000);
    const t = await bodyText(p);
    if (t === last && t.length > minGrowthFrom) stable++;
    else stable = 0;
    last = t;
    if (stable >= 3) return t;
  }
  return last;
}

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });

// Observe the real lane traffic the page generates.
const laneCalls = [];
p.on('request', (r) => {
  if (r.url().includes('/api/reasoning-lane') && r.method() === 'POST') {
    try { laneCalls.push({ body: JSON.parse(r.postData() ?? '{}'), status: null }); } catch { laneCalls.push({ body: null, status: null }); }
  }
});
p.on('response', async (r) => {
  if (r.url().includes('/api/reasoning-lane') && r.request().method() === 'POST') {
    const call = laneCalls[laneCalls.length - 1];
    if (call) {
      try { call.status = (await r.json())?.status ?? `http ${r.status()}`; } catch { call.status = `http ${r.status()}`; }
    }
  }
});

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
  const full = await waitStable(p, prev.length, 180000);
  let region = full.slice(commonPrefixLen(prev, full));
  const qEcho = region.indexOf(q);
  if (qEcho >= 0) region = region.slice(qEcho + q.length);
  return { full, region };
}

// ── Turn 0: assessment (legacy pipeline — state-establishing) ──
console.log('turn 0: assessment');
let prev = await bodyText(p);
{
  const before = laneCalls.length;
  const { full, region } = await submit(ASSESS, prev);
  prev = full;
  if (laneCalls.length !== before) fail('assessment turn must not enter the lane');
  else ok('assessment turn stayed with the legacy pipeline');
  const upper = region.toUpperCase();
  for (const name of ['EVERSOLO', 'CHORD HUGO', 'JOB INTEGRATED', 'WLM DIVA']) {
    if (!upper.includes(name)) fail(`assessment missing component: ${name}`);
  }
  ok('assessment rendered with all four components');
}

// ── Post-assessment turns: B2 first authority ──
for (let i = 0; i < TURNS.length; i++) {
  const q = TURNS[i];
  console.log(`turn ${i + 1}: ${q.slice(0, 60)}`);
  const before = laneCalls.length;
  const { full, region } = await submit(q, prev);
  prev = full;

  const calls = laneCalls.slice(before);
  if (calls.length === 0) { fail('no /api/reasoning-lane request — turn consumed by legacy routing'); continue; }
  if (calls.length > 1) fail(`lane attempted ${calls.length} times in one turn`);
  const call = calls[0];
  // The response body is read by an async listener — give it a moment.
  for (let w = 0; w < 30 && call.status === null; w++) await p.waitForTimeout(500);

  const comps = call.body?.activeSystem?.components?.map((c) => c.displayName) ?? [];
  if (comps.length === 4 && comps.includes('Chord Hugo')) ok(`lane request carries all 4 components (incl. Chord Hugo)`);
  else fail(`lane roster wrong: [${comps.join(', ')}]`);
  if (call.body?.question === q) ok('question travels verbatim');
  else fail('question mutated before the lane (reunite/rewrite leak)');

  if (call.status === 'CHECKED' || call.status === 'REPAIRED') ok(`published status=${call.status}`);
  else fail(`lane did not publish (status=${call.status}) — legacy fallback took the turn`);

  const hit = LEGACY_MARKERS.find((m) => region.includes(m));
  if (hit) fail(`legacy surface rendered on a lane turn: "${hit}"`);
  else ok('no legacy shopping/budget surface rendered');

  if (region.trim().length < 40) fail('displayed answer suspiciously short');
}

await b.close();
console.log(failures === 0
  ? '\nAUTHORITY REPLAY: ALL PASS'
  : `\nAUTHORITY REPLAY: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
