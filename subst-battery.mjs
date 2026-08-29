import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const OUT = '/private/tmp/claude-501/-Users-mikebrown-audio-xx/4b31ef88-a78c-4b6b-a49b-9a695d816a5f/scratchpad/campaign';
const CASES = JSON.parse(process.argv[2]);
const b = await chromium.launch();
for (const cs of CASES) {
  const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  const typeAndSend = async (msg) => {
    const box = p.locator('textarea:not([placeholder*="Anything else"]):visible, input[placeholder*="Help me choose"]:visible, input[placeholder*="Reply"]:visible').first();
    const send = p.getByRole('button', { name: 'Send', exact: true }).first();
    for (let i = 0; i < 120; i++) { if (await send.isEnabled().catch(() => false)) break; await p.waitForTimeout(1000); }
    for (let i = 0; i < 60; i++) {
      await box.click().catch(()=>{}); await box.fill(msg).catch(()=>{});
      await p.waitForTimeout(700);
      if ((await box.inputValue().catch(()=>'')) === msg && (await send.isEnabled().catch(()=>false))) break;
    }
    await send.click().catch(async () => { await p.keyboard.press('Enter'); });
  };
  await p.goto('https://audio-xx.com/', { waitUntil: 'networkidle', timeout: 180000 });
  await typeAndSend(cs.assess);
  let t = '';
  for (let i = 0; i < 32; i++) {
    await p.waitForTimeout(5000);
    t = await p.evaluate(() => document.body.innerText);
    if (/What remains unknown|couldn['’]t match|What role does it play|exact make and model/i.test(t)) break;
  }
  await p.waitForTimeout(3000);
  const outputs = [{ q: '(assessment)', text: t }];
  for (const q of cs.questions) {
    const before = (await p.evaluate(() => document.body.innerText)).length;
    await typeAndSend(q);
    let t2 = '';
    for (let i = 0; i < 24; i++) {
      await p.waitForTimeout(5000);
      t2 = await p.evaluate(() => document.body.innerText);
      if (t2.length > before + 100) break;
    }
    await p.waitForTimeout(4000);
    outputs.push({ q, text: await p.evaluate(() => document.body.innerText) });
  }
  writeFileSync(`${OUT}/${cs.id}.json`, JSON.stringify(outputs));
  console.log(cs.id, 'done', outputs.map((o) => o.text.length).join(','));
  await p.close();
}
await b.close(); console.log('BATTERY-DONE');
