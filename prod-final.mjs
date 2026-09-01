import { chromium } from 'playwright';
const OUT = '/private/tmp/claude-501/-Users-mikebrown-audio-xx/4b31ef88-a78c-4b6b-a49b-9a695d816a5f/scratchpad/vis';
const CASES = {
  nathan: 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - Pre-amp: ARC ref 5. - Amps: Butler Monads. - Speakers: Acora QRC-2.',
  sideways: 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - leben cs600 integrated amplifier - Speakers: devore o/96',
};
const which = process.argv[2];
const b = await chromium.launch();
for (const [name, msg] of Object.entries(CASES)) {
  if (which && which !== name) continue;
  const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  await p.goto('https://audio-xx.com/', { waitUntil: 'networkidle', timeout: 180000 });
  const box = p.locator('textarea, input[placeholder*="Help me choose"]').first();
  // Hydration eats keystrokes: loop until send is enabled AND the value took.
  const send = p.locator('button[type="submit"], button:has-text("Send")').first();
  for (let i = 0; i < 30; i++) {
    await box.click().catch(()=>{});
    await box.fill(msg).catch(()=>{});
    await p.waitForTimeout(700);
    const v = await box.inputValue().catch(()=> '');
    const en = await send.isEnabled().catch(()=> false);
    if (v === msg && en) break;
  }
  await p.keyboard.press('Enter');
  let t = '';
  for (let i = 0; i < 36; i++) {
    await p.waitForTimeout(5000);
    t = await p.evaluate(() => document.body.innerText);
    if (/SYSTEM REVIEW|The assessment/i.test(t)) break;
  }
  // Every dossier image fully loaded before printing.
  await p.waitForTimeout(4000);
  await p.evaluate(async () => {
    await Promise.all(Array.from(document.images).map(i => i.complete ? 1 : new Promise(r => { i.onload = r; i.onerror = r; })));
  });
  const imgs = await p.evaluate(() => Array.from(document.images)
    .filter(i => i.naturalWidth > 60)
    .map(i => ({ src: (i.currentSrc || i.src).slice(0, 80), w: i.naturalWidth, shown: i.getBoundingClientRect().width > 20 })));
  console.log(name, 'review:', /SYSTEM REVIEW|The assessment/i.test(t), 'clarif:', /couldn['’]t match/.test(t));
  console.log(name, 'IMAGES:', JSON.stringify(imgs));
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: `${OUT}/final-${name}.pdf`, format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
  await p.close();
}
await b.close(); console.log('DONE');
