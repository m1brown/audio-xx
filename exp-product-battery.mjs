// Preview product-integration battery (condition C): the full §3 conversation
// set through the REAL UI at the local flag-on preview. Captures the visible
// response, the intercepted /api/reasoning-lane payloads (validation +
// contextMeta), and per-turn latency.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const BASE = process.argv[2] ?? 'http://localhost:53297';
const OUT = '/private/tmp/claude-501/-Users-mikebrown-audio-xx/4b31ef88-a78c-4b6b-a49b-9a695d816a5f/scratchpad/productC';

const NATHAN_ASSESS = 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - Pre-amp: ARC ref 5. - Amps: Butler Monads. - Speakers: Acora QRC-2.';
const CASES = [
  { id: 'C1-NATHAN-MAIN', assess: NATHAN_ASSESS, questions: [
    'What about a Leben CS600 instead of the Butler?',
    'Would I lose bass control?',
    'What about a Hegel H590 instead?',
    'Which of the three would you choose?',
    'The second one.',
    'No, compared with mine.',
    'Assume that one for a minute.',
    'Would the ARC preamp still make sense?',
    'Go back to my real system.',
    'Keep the Butler. What would you change next?',
    'Anything else you would look at?',
  ]},
  { id: 'C2-ARCH-TUBES', assess: 'Assess my system: Chord DAVE DAC running directly into a Benchmark AHB2 power amplifier, KEF LS50 Meta speakers', questions: [
    'What if I went tubes?',
    'Would that make sense with my speakers?',
    'What would you try?',
  ]},
  { id: 'C3-ARCH-PREAMP', assess: NATHAN_ASSESS, questions: [
    'Could I eliminate the preamp?',
    'What would that change?',
    'Would you actually do it?',
  ]},
  { id: 'C4-ARCH-ACTIVE', assess: 'Assess my system: PrimaLuna EVO 300 tube amp with Klipsch Cornwall IV speakers, source is a Bluesound Node', questions: [
    'What if I went active?',
    'What parts of my current system disappear?',
    'Would that actually be an upgrade?',
  ]},
  { id: 'C5-EVIDENCE-ID', assess: NATHAN_ASSESS, questions: [
    'What about a Pass Labs XA25 instead of the Butler?',
    'What about a Bakoon AMP-13R instead?',
    'What about a Leben CS600X instead?',
    'What about Harbeths instead?',
    'What about a Fooblaster 9000 instead?',
  ]},
  { id: 'C6-ADVISORY', assess: NATHAN_ASSESS, questions: [
    'What about a WiiM Amp instead of the Butler?',
    'Should I replace the Rossini with the dCS Vivaldi stack?',
    'Worth it?',
    'Should I change anything at all?',
  ]},
  { id: 'C7-SHOP', assess: NATHAN_ASSESS, questions: [
    'What amplifier should I audition?',
    'What should I look for?',
    'Compare the Leben CS600 and the Hegel H590.',
    'And with my system as it is, what would you do?',
  ]},
];

const b = await chromium.launch();
for (const cs of CASES.filter((c) => c.id === "C1-NATHAN-MAIN")) {
  const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  const laneLog = [];
  p.on('response', async (res) => {
    if (res.url().includes('/api/reasoning-lane')) {
      try { laneLog.push({ status: res.status(), body: await res.json() }); }
      catch { laneLog.push({ status: res.status(), body: null }); }
    }
  });
  const typeAndSend = async (msg) => {
    const box = p.locator('textarea:not([placeholder*="Anything else"]):visible, input[placeholder*="Help me choose"]:visible, input[placeholder*="Reply"]:visible').first();
    const send = p.getByRole('button', { name: 'Send', exact: true }).first();
    for (let i = 0; i < 90; i++) { if (await send.isEnabled().catch(() => false)) break; await p.waitForTimeout(1000); }
    for (let i = 0; i < 40; i++) {
      await box.click().catch(() => {}); await box.fill(msg).catch(() => {});
      await p.waitForTimeout(500);
      if ((await box.inputValue().catch(() => '')) === msg && (await send.isEnabled().catch(() => false))) break;
    }
    await send.click().catch(async () => { await p.keyboard.press('Enter'); });
  };
  await p.goto(BASE, { waitUntil: 'networkidle', timeout: 180000 });
  const t0 = Date.now();
  await typeAndSend(cs.assess);
  let t = '';
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(4000);
    t = await p.evaluate(() => document.body.innerText);
    if (/SYSTEM REVIEW|What remains unknown|couldn['’]t match/i.test(t)) break;
  }
  await p.waitForTimeout(3000);
  const outputs = [{ q: '(assessment)', text: await p.evaluate(() => document.body.innerText), ms: Date.now() - t0, lane: null }];
  for (const q of cs.questions) {
    const before = (await p.evaluate(() => document.body.innerText)).length;
    const laneBefore = laneLog.length;
    const qt0 = Date.now();
    await typeAndSend(q);
    for (let i = 0; i < 30; i++) {
      await p.waitForTimeout(3000);
      const t2 = await p.evaluate(() => document.body.innerText);
      if (t2.length > before + 80) break;
    }
    await p.waitForTimeout(2500);
    outputs.push({
      q,
      text: await p.evaluate(() => document.body.innerText),
      ms: Date.now() - qt0,
      lane: laneLog.slice(laneBefore),
    });
    process.stdout.write('.');
  }
  writeFileSync(`${OUT}/${cs.id}.json`, JSON.stringify(outputs));
  console.log(' ', cs.id, 'done', outputs.map((o) => `${Math.round(o.ms / 1000)}s`).join(','));
  await p.close();
}
await b.close();
console.log('PRODUCT-BATTERY-DONE');
