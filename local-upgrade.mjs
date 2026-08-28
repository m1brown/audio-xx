import { chromium } from 'playwright';
const MSG = 'assess my system: Eversolo DMP-A6 streamer/dac --> JOB Job integrated amp --> WLM Diva monitor speakers';
const FU = 'Would replacing the Eversolo with a much better external DAC be a worthwhile upgrade?';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
p.on('console', (m) => { if (m.text().includes('fu-debug')) console.log('CONSOLE:', m.text()); });
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 180000 });
const typeAndSend = async (msg) => {
  const box = p.locator('textarea:visible, input[placeholder*="Help me choose"]:visible, input[placeholder*="Reply"]:visible').last();
  const send = p.locator('button[type="submit"]:visible, button:has-text("Send"):visible').last();
  let ok = false;
  for (let i = 0; i < 40; i++) {
    await box.click().catch(()=>{});
    await box.fill(msg).catch(()=>{});
    await p.waitForTimeout(700);
    if ((await box.inputValue().catch(()=>'')) === msg && (await send.isEnabled().catch(()=>false))) { ok = true; break; }
  }
  console.log('submit ready:', ok, '| sending:', msg.slice(0, 40));
  await send.click().catch(async () => { await p.keyboard.press('Enter'); });
  await p.waitForTimeout(1500);
  const sent = (await p.evaluate(() => document.body.innerText)).includes(msg.slice(0, 30));
  console.log('bubble present:', sent);
};
await typeAndSend(MSG);
let t = '';
for (let i = 0; i < 30; i++) {
  await p.waitForTimeout(5000);
  t = await p.evaluate(() => document.body.innerText);
  if (/What remains unknown/i.test(t)) break;
}
await p.waitForTimeout(3000);
const lenBefore = (await p.evaluate(() => document.body.innerText)).length;
await typeAndSend(FU);
let t2 = '';
for (let i = 0; i < 24; i++) {
  await p.waitForTimeout(5000);
  t2 = await p.evaluate(() => document.body.innerText);
  if (t2.length > lenBefore + 150 && !/Thinking|…$/.test(t2.slice(-80))) break;
}
await p.waitForTimeout(6000);
t2 = await p.evaluate(() => document.body.innerText);
const li = t2.indexOf('LISTENER');
const convEnd = li > 0 ? li : t2.length;
console.log('--- CONVERSATION TAIL ---');
console.log(t2.slice(Math.max(0, convEnd - 2600), convEnd).replace(/\n{2,}/g, '\n'));
await b.close(); console.log('DONE');
