import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
// system-bridge relay
p.on('console', (m) => { const x = m.text(); if (/rescue-probe|probe-3151|system-bridge|diag-cold/.test(x)) console.log('C:', x.slice(0, 160)); });
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 120000 });
const typeAndSend = async (msg) => {
  const box = p.locator('textarea:visible, input[placeholder*="Help me choose"]:visible, input[placeholder*="Reply"]:visible').last();
  const send = p.locator('button[type="submit"]:visible, button:has-text("Send"):visible').last();
  for (let i = 0; i < 40; i++) {
    await box.click().catch(()=>{});
    await box.fill(msg).catch(()=>{});
    await p.waitForTimeout(600);
    if ((await box.inputValue().catch(()=>'')) === msg && (await send.isEnabled().catch(()=>false))) break;
  }
  await send.click().catch(async () => { await p.keyboard.press('Enter'); });
};
await typeAndSend('I have a dCS Rossini Apex going into an ARC Ref 5');
await p.waitForTimeout(14000);
await typeAndSend('The amps are Butler Monads driving Acora QRC-2 speakers');
await p.waitForTimeout(14000);
const before = (await p.evaluate(() => document.body.innerText)).length;
await typeAndSend('Please assess my system');
let t = '';
for (let i = 0; i < 24; i++) {
  await p.waitForTimeout(5000);
  t = await p.evaluate(() => document.body.innerText);
  if (t.length > before + 150) break;
}
await p.waitForTimeout(8000);
t = await p.evaluate(() => document.body.innerText);
if (/exact makes and models|lock in the exact models/i.test(t)) {
  console.log('clarification step shown — answering with models');
  await typeAndSend('dCS Rossini Apex, ARC Reference 5, Butler Monads, Acora QRC-2');
  for (let i = 0; i < 24; i++) {
    await p.waitForTimeout(5000);
    t = await p.evaluate(() => document.body.innerText);
    if (/What remains unknown/i.test(t)) break;
  }
  await p.waitForTimeout(6000);
  t = await p.evaluate(() => document.body.innerText);
}
const q = t.indexOf('Please assess my system');
console.log('--- AFTER FINAL ASK ---');
console.log(t.slice(q, Math.min(t.indexOf('LISTENER'), q + 3400)).replace(/\n{2,}/g, '\n'));
console.log('has SYSTEM REVIEW:', /SYSTEM REVIEW/.test(t));
console.log('4 comps in dossiers:', ['Butler MONAD A100','Acora Acoustics QRC-2','Audio Research Reference 5','dCS Rossini Apex'].map((x)=>t.includes(x)));
await b.close(); console.log('DONE');
