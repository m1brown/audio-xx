import { chromium } from 'playwright';
const NATHAN = 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - Pre-amp: ARC ref 5. - Amps: Butler Monads. - Speakers: Acora QRC-2.';
const QS = ["What modern amplifier should I audition against the Butler?"];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
await p.goto('https://audio-xx.com/', { waitUntil: 'networkidle', timeout: 180000 });
const typeAndSend = async (msg) => {
  const box = p.locator('textarea:not([placeholder*="Anything else"]):visible, input[placeholder*="Help me choose"]:visible, input[placeholder*="Reply"]:visible').first();
  const send = p.getByRole('button', { name: 'Send', exact: true }).first();
  for (let i = 0; i < 120; i++) {
    if (await send.isEnabled().catch(() => false)) break;
    await p.waitForTimeout(1000);
  }
  let armed = false;
  for (let i = 0; i < 60; i++) {
    await box.click().catch(()=>{});
    await box.fill(msg).catch(()=>{});
    await p.waitForTimeout(700);
    if ((await box.inputValue().catch(()=>'')) === msg && (await send.isEnabled().catch(()=>false))) { armed = true; break; }
  }
  if (!armed) console.log('SUBMIT-NOT-ARMED for:', msg.slice(0, 40));
  await send.click().catch(async () => { await p.keyboard.press('Enter'); });
};
await typeAndSend(NATHAN);
let t = '';
for (let i = 0; i < 30; i++) {
  await p.waitForTimeout(5000);
  t = await p.evaluate(() => document.body.innerText);
  if (/What remains unknown/i.test(t)) break;
}
await p.waitForTimeout(4000);
for (const q of QS) {
  const before = (await p.evaluate(() => document.body.innerText)).length;
  await typeAndSend(q);
  let t2 = '';
  for (let i = 0; i < 24; i++) {
    await p.waitForTimeout(5000);
    t2 = await p.evaluate(() => document.body.innerText);
    if (t2.length > before + 120) break;
  }
  await p.waitForTimeout(5000);
  t2 = await p.evaluate(() => document.body.innerText);
  const qi = t2.indexOf(q);
  let end = t2.indexOf('HELP US IMPROVE', qi);
  if (end < 0) end = qi + q.length + 1600;
  const seg = t2.slice(qi + q.length, end);
  console.log(`\n===== Q: ${q}`);
  console.log(seg.replace(/\n{2,}/g, '\n').slice(0, 1500));
}
await b.close(); console.log('DONE');
