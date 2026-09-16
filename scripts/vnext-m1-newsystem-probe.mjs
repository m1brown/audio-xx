#!/usr/bin/env node
// §8 acceptance — a genuinely new-system turn must reach NO lane site:
// no /api/reasoning-lane POST, the assessment path takes it, and it
// renders an assessment of the NEW roster.
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const T0 = 'Assess my system: Eversolo DMP-A6, Chord Hugo, JOB INTegrated, WLM Diva Monitor.';
const T1 = "which dac of the three should be the best, for me that's provide the most intimacy and connection";
const T2 = 'Assess this system: dCS Rossini Apex, ARC ref 5, Butler Monads, Acora QRC-2';

const posts = [];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
p.on('request', (r) => {
  if (r.url().includes('/api/reasoning-lane') && r.method() === 'POST') {
    try { posts.push(JSON.parse(r.postData() ?? '{}')); } catch { posts.push({}); }
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
  while (Date.now() - t0 < 240000) {
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
  return { full, region: full.slice(prefixLen(prev, full)) };
}

let prev = await bodyText();
let r = await submit(T0, prev); prev = r.full;
r = await submit(T1, prev); prev = r.full;
const laneCallsBefore = posts.length;
r = await submit(T2, prev);
const newSystemLanePosts = posts.length - laneCallsBefore;
const up = r.region.toUpperCase();
const newRosterShown = up.includes('ROSSINI') && (up.includes('BUTLER') || up.includes('MONAD')) && up.includes('ACORA');
const oldRosterAsActive = posts.slice(laneCallsBefore).some((b2) =>
  (b2?.activeSystem?.components ?? []).some((c) => /eversolo/i.test(c.displayName ?? '')));
console.log(JSON.stringify({
  turn1LanePosts: laneCallsBefore,
  newSystemTurnLanePosts: newSystemLanePosts,
  newRosterRendered: newRosterShown,
  staleRosterSentToLane: oldRosterAsActive,
  verdict: newSystemLanePosts === 0 && newRosterShown ? 'PASS' : 'FAIL',
}));
await b.close();
process.exit(newSystemLanePosts === 0 && newRosterShown ? 0 : 1);
