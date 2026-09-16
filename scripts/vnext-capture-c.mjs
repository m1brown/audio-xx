#!/usr/bin/env node
/**
 * vNext Phase 0 — ARM C capture: the frozen production pipeline (1498b17)
 * driven through the real conversation surface with the same fixed scripts.
 *
 * C is the migration reference, not a contender; production is not modified.
 * Full ten-turn conversations for the two real-user benchmark systems;
 * abbreviated (first four turns) for the remaining core systems.
 *
 *   node scripts/vnext-capture-c.mjs
 *
 * Output: apps/web/src/qa/vnext/results/c-capture/<system>.jsonl
 * (one {turnIndex, question, text} per line — text is the rendered response
 * region diffed from the page after each turn).
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';

const BASE = 'https://audio-xx.com';
const OUT = 'apps/web/src/qa/vnext/results/c-capture';

const SCRIPTS = {
  accuphase: { turns: 10, list: [
    'Assess my system: Accuphase E-600, Accuphase DP-450 and Harbeth SHL5 Plus.',
    'Is the amp powerful enough for these speakers?',
    'I sit about nine feet away and I don’t listen very loud.',
    'What is the weakest part of the system?',
    'What if I replaced the Accuphase with a Hegel H390?',
    'How would that compare to what I have now for the way I listen?',
    'Actually forget the Hegel. Would changing the DAC side matter more?',
    'I do find it a little bright on some recordings.',
    'What would you try first?',
    'So should I just leave it alone?',
  ] },
  nad: { turns: 10, list: [
    'Assess my system: NAD AV716 receiver, Topping D70 Pro OCTO DAC, Dynaco A35 speakers.',
    'Is that receiver good enough for the Dynacos?',
    'It’s a small room, maybe 12 by 14 feet, and I listen at modest volume.',
    'What’s limiting this system?',
    'Would a modern amplifier be a meaningful upgrade over the NAD?',
    'Say I swapped in a Rega Elex Mk4 — what changes?',
    'The old speakers sound a bit soft in the bass to me.',
    'Does the second one you mentioned matter more than the amp question?',
    'What would you change first, if anything?',
    'Or should I keep it as it is and enjoy it?',
  ] },
  'job-boenicke': { turns: 4, list: [
    'Assess my system: JOB INTegrated amplifier and Boenicke W5 speakers.',
    'Are those little speakers hard to drive?',
    'My desk setup — I sit close, maybe five feet.',
    'Is the amp the right match here?',
  ] },
  'decware-magnepan': { turns: 4, list: [
    'Assess my system: Decware SE84UFO amplifier driving Magnepan LRS+ speakers.',
    'I’ve heard SETs and Maggies described as magical together — true?',
    'It does sound thin and quiet unless I crank it.',
    'So what exactly is the problem?',
  ] },
  nathan: { turns: 4, list: [
    'Assess my system: dCS Rossini Apex, Audio Research Reference 5, Butler Monad monoblocks, Acora QRC-2.',
    'Anything in that chain look mismatched to you?',
    'The room is large and treated, and I listen at realistic levels.',
    'Which component is doing the least for me?',
  ] },
};

mkdirSync(OUT, { recursive: true });

async function bodyText(p) {
  return p.evaluate(() => (document.querySelector('main') ?? document.body).innerText);
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
  let stableCount = 0;
  while (Date.now() - t0 < maxMs) {
    await p.waitForTimeout(3000);
    const t = await bodyText(p);
    if (t === last && t.length > minGrowthFrom) stableCount++;
    else stableCount = 0;
    last = t;
    if (stableCount >= 3) return t;
  }
  return last;
}

const b = await chromium.launch();
for (const [id, s] of Object.entries(SCRIPTS)) {
  const file = `${OUT}/${id}.jsonl`;
  rmSync(file, { force: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  await p.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
  await p.waitForTimeout(3000);
  const box = p.locator('textarea:not([placeholder*="Anything else"]):visible').first();
  const send = p.getByRole('button', { name: 'Send', exact: true }).first();
  for (let i = 0; i < 60; i++) { if (await send.isEnabled().catch(() => false)) break; await p.waitForTimeout(1000); }

  let prev = await bodyText(p);
  for (let i = 0; i < s.turns; i++) {
    const q = s.list[i];
    for (let k = 0; k < 30; k++) {
      await box.click().catch(() => {});
      await box.fill(q).catch(() => {});
      await p.waitForTimeout(400);
      if ((await box.inputValue().catch(() => '')) === q && (await send.isEnabled().catch(() => false))) break;
    }
    await send.click().catch(() => {});
    const t0 = Date.now();
    const full = await waitStable(p, prev.length, 180000);
    // Response region: the chat column appends downward, so the answer is
    // the text ADDED to <main> since before the send (common-prefix diff),
    // minus the echoed question and trailing chrome.
    let region = full.slice(commonPrefixLen(prev, full));
    const qEcho = region.indexOf(q);
    if (qEcho >= 0) region = region.slice(qEcho + q.length);
    for (const cut of ['You described a system:', '\nSend\n', '\nStart over', '\nStart Over',
      '\nContact\n', 'LISTENER\n', '\nRECENT\n', '\nReport issue']) {
      const ci = region.indexOf(cut);
      if (ci > 0) region = region.slice(0, ci);
    }
    appendFileSync(file, `${JSON.stringify({
      arm: 'C', turnIndex: i, question: q,
      text: region.trim().slice(0, 12000),
      latencyMs: Date.now() - t0,
    })}\n`);
    console.log(`[c-capture] ${id} turn ${i + 1}/${s.turns} · ${region.trim().length} chars`);
    prev = full;
  }
  await p.close();
}
await b.close();
writeFileSync(`${OUT}/manifest.json`, JSON.stringify({
  production: '1498b17', capturedAt: new Date().toISOString(),
}, null, 2));
console.log('[c-capture] done');
