// Preview product-integration battery (condition C): the full §3 conversation
// set through the REAL UI at the local flag-on preview. Captures the visible
// response, the intercepted /api/reasoning-lane payloads (validation +
// contextMeta), and per-turn latency.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const BASE = process.argv[2] ?? 'https://audio-xx.com';
const CASES_FILE = process.argv[3];
const OUT_DIR = process.argv[4];
const OUT = OUT_DIR;

const CASES = JSON.parse((await import('node:fs')).readFileSync(CASES_FILE, 'utf8'));

const b = await chromium.launch();
const RUN = CASES;
for (const cs of RUN) {
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
  await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForTimeout(6000);
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
