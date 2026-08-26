import { chromium } from 'playwright';
const OUT = process.env.OUT;
const CASES = [
  ['nathan', 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - Pre-amp: ARC ref 5. - Amps: Butler Monads. - Speakers: Acora QRC-2.'],
  ['sideways', 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - leben cs600 integrated amplifier - Speakers: devore o/96'],
];
const b = await chromium.launch();
for (const [name, N] of CASES) {
  const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 240000 });
  const box = p.locator('textarea, input[placeholder*="Help me choose"]').first();
  const send = p.locator('button:has-text("Send")').first();
  for (let a = 0; a < 10; a += 1) {
    await box.click(); await box.fill('');
    await box.pressSequentially(N, { delay: 20 });
    await p.waitForTimeout(900);
    if ((await send.isEnabled()) && (await box.inputValue()) === N) break;
    await p.waitForTimeout(1500);
  }
  if ((await box.inputValue()) !== N) { console.log(name, 'INPUT FAIL'); await p.close(); continue; }
  await send.click({ timeout: 60000 });
  try { await p.waitForSelector('text=/System review|SYSTEM REVIEW/i', { timeout: 240000 }); } catch { console.log(name, 'NO REVIEW'); }
  await p.waitForTimeout(8000);
  const t = await p.evaluate(() => document.body.innerText);
  console.log(`\n##### ${name} #####`);
  const rev = (t.split(/System review|SYSTEM REVIEW/)[1]||'').split(/Your system\n|YOUR SYSTEM/)[0].trim();
  console.log(rev.slice(0, 3000));
  console.log('IMG:', JSON.stringify(await p.evaluate(()=>Array.from(document.images).filter(i=>i.naturalWidth>60).map(i=>i.src.slice(30,60)))));
  console.log('yoursys count:', (t.match(/Your system/gi)||[]).length);
  await p.screenshot({ path: `${OUT}/${name}-conv.png`, fullPage: true });
  await p.pdf({ path: `${OUT}/${name}.pdf`, format:'A4', printBackground:true, margin:{top:'12mm',bottom:'12mm',left:'12mm',right:'12mm'} });
  await p.close();
}
await b.close(); console.log('\nDONE');
