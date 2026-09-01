import { chromium } from 'playwright';
const BASE = process.argv[2] ?? 'http://localhost:54216';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
await p.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
const box = p.locator('textarea:not([placeholder*="Anything else"]):visible').first();
const send = p.getByRole('button', { name: 'Send', exact: true }).first();
for (let i = 0; i < 60; i++) { if (await send.isEnabled().catch(() => false)) break; await p.waitForTimeout(1000); }
const T1 = 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - Pre-amp: ARC ref 5. - Amps: Butler Monads. - Speakers: Acora QRC-2.';
await box.fill(T1); await send.click();
let len0 = 0;
for (let i = 0; i < 40; i++) { await p.waitForTimeout(3000); const t = await p.evaluate(() => document.body.innerText); if (/SYSTEM REVIEW|What remains unknown/i.test(t)) { len0 = t.length; break; } }
await p.waitForTimeout(3000);
// One governed follow-up with a length trace.
const Q = 'What about a Leben CS600 instead of the Butler?';
for (let i = 0; i < 30; i++) { await box.click().catch(()=>{}); await box.fill(Q).catch(()=>{}); await p.waitForTimeout(400); if ((await box.inputValue().catch(()=>'')) === Q && (await send.isEnabled().catch(()=>false))) break; }
const before = (await p.evaluate(() => document.body.innerText)).length;
const t0 = Date.now();
await send.click();
for (let i = 0; i < 60; i++) {
  await p.waitForTimeout(1000);
  const L = (await p.evaluate(() => document.body.innerText)).length;
  console.log(`${Math.round((Date.now() - t0) / 1000)}s len=${L} Δ=${L - before}`);
  if (L > before + 400) break;
}
console.log('UI-TURN-COMPLETE at', Math.round((Date.now() - t0) / 1000), 's');
await b.close();
