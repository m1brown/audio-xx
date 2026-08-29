import { chromium } from 'playwright';
const OUT = '/private/tmp/claude-501/-Users-mikebrown-audio-xx/4b31ef88-a78c-4b6b-a49b-9a695d816a5f/scratchpad/vis';
const NATHAN = 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - Pre-amp: ARC ref 5. - Amps: Butler Monads. - Speakers: Acora QRC-2.';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
await p.goto('https://audio-xx.com/', { waitUntil: 'networkidle', timeout: 180000 });
const box = p.locator('textarea:visible, input[placeholder*="Help me choose"]:visible').last();
const send = p.getByRole('button', { name: 'Send', exact: true }).first();
for (let i = 0; i < 40; i++) {
  await box.click().catch(()=>{});
  await box.fill(NATHAN).catch(()=>{});
  await p.waitForTimeout(600);
  if ((await box.inputValue().catch(()=>'')) === NATHAN && (await send.isEnabled().catch(()=>false))) break;
}
await send.click().catch(async () => { await p.keyboard.press('Enter'); });
let t = '';
for (let i = 0; i < 30; i++) {
  await p.waitForTimeout(5000);
  t = await p.evaluate(() => document.body.innerText);
  if (/What remains unknown/i.test(t)) break;
}
await p.waitForTimeout(4000);
await p.evaluate(async () => { await Promise.all(Array.from(document.images).map(i => i.complete ? 1 : new Promise(r => { i.onload = r; i.onerror = r; }))); });
t = await p.evaluate(() => document.body.innerText);
const fbOrder = await p.evaluate(() => {
  const ta = document.querySelector('textarea');
  const fb = [...document.querySelectorAll('p')].find((x) => /help us improve/i.test(x.textContent ?? ''));
  if (!ta || !fb) return { present: !!fb, order: 'n/a' };
  return { present: true, belowComposer: !!(ta.compareDocumentPosition(fb) & Node.DOCUMENT_POSITION_FOLLOWING),
    count: [...document.querySelectorAll('p')].filter((x) => /help us improve/i.test(x.textContent ?? '')).length };
});
console.log('FEEDBACK:', JSON.stringify(fbOrder));
console.log('FIND ONE count:', (t.match(/FIND ONE/g) ?? []).length, '| HiFiShark:', (t.match(/HiFiShark/g) ?? []).length);
const imgs = await p.evaluate(() => Array.from(document.images).filter(i => i.naturalWidth > 60)
  .map(i => ({ src: (i.currentSrc || i.src).slice(0, 70), shown: i.getBoundingClientRect().width > 20 })));
console.log('IMAGES:', JSON.stringify(imgs));
await p.emulateMedia({ media: 'print' });
await p.pdf({ path: `${OUT}/rc-nathan.pdf`, format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
await b.close(); console.log('DONE');
