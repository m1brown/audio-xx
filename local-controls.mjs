import { chromium } from 'playwright';
const CASES = {
  nathan: 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - Pre-amp: ARC ref 5. - Amps: Butler Monads. - Speakers: Acora QRC-2.',
  badmatch: 'assess my system: Leben CS600 integrated amplifier, Magnepan LRS speakers',
  obscure: 'assess my system: Sansui AU-517 amplifier, Snell Type J speakers',
};
const b = await chromium.launch();
for (const [name, msg] of Object.entries(CASES)) {
  const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 120000 });
  const box = p.locator('textarea, input[placeholder*="Help me choose"]').first();
  const send = p.locator('button[type="submit"], button:has-text("Send")').first();
  for (let i = 0; i < 30; i++) {
    await box.click().catch(()=>{});
    await box.fill(msg).catch(()=>{});
    await p.waitForTimeout(600);
    if ((await box.inputValue().catch(()=>'')) === msg && (await send.isEnabled().catch(()=>false))) break;
  }
  await p.keyboard.press('Enter');
  let t = '';
  for (let i = 0; i < 24; i++) {
    await p.waitForTimeout(5000);
    t = await p.evaluate(() => document.body.innerText);
    if (/System review|SYSTEM REVIEW|The assessment|couldn['’]t match/i.test(t)) break;
  }
  await p.waitForTimeout(4000);
  t = await p.evaluate(() => document.body.innerText);
  console.log(`=== ${name} ===`);
  let start = t.search(/System review|SYSTEM REVIEW|The assessment|I can see the shape/i);
  if (start < 0) start = Math.max(0, t.length - 1200);
  console.log(t.slice(start, start + 1200).replace(/\n{2,}/g, '\n'));
  await p.close();
}
await b.close(); console.log('DONE');
