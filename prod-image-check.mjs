import { chromium } from 'playwright';
const OUT = '/private/tmp/claude-501/-Users-mikebrown-audio-xx/4b31ef88-a78c-4b6b-a49b-9a695d816a5f/scratchpad/campaign2';
const CASES = [
  ['cornwall', 'Assess my system: PrimaLuna EVO 300 tube amp with Klipsch Cornwall IV speakers, source is a Bluesound Node'],
  ['ls50meta', 'Assess my system: Chord DAVE DAC running directly into a Benchmark AHB2 power amplifier, KEF LS50 Meta speakers'],
];
const b = await chromium.launch();
for (const [id, msg] of CASES) {
  const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  await p.goto('https://audio-xx.com/', { waitUntil: 'networkidle', timeout: 180000 });
  const box = p.locator('textarea:not([placeholder*="Anything else"]):visible, input[placeholder*="Help me choose"]:visible, input[placeholder*="Reply"]:visible').first();
  const send = p.getByRole('button', { name: 'Send', exact: true }).first();
  for (let i = 0; i < 120; i++) { if (await send.isEnabled().catch(() => false)) break; await p.waitForTimeout(1000); }
  for (let i = 0; i < 60; i++) {
    await box.click().catch(() => {}); await box.fill(msg).catch(() => {});
    await p.waitForTimeout(700);
    if ((await box.inputValue().catch(() => '')) === msg && (await send.isEnabled().catch(() => false))) break;
  }
  await send.click().catch(async () => { await p.keyboard.press('Enter'); });
  let t = '';
  for (let i = 0; i < 32; i++) {
    await p.waitForTimeout(5000);
    t = await p.evaluate(() => document.body.innerText);
    if (/VIEW ASSESSMENT/i.test(t)) break;
  }
  await p.waitForTimeout(3000);
  const view = p.locator('a:has-text("VIEW ASSESSMENT"), button:has-text("VIEW ASSESSMENT")').first();
  if (await view.count()) {
    const href = await view.getAttribute('href').catch(() => null);
    if (href) { await p.goto(new URL(href, 'https://audio-xx.com').toString(), { waitUntil: 'networkidle', timeout: 120000 }); }
    else { await view.click(); await p.waitForTimeout(8000); }
  }
  await p.waitForTimeout(6000);
  console.log(id, 'url:', p.url());
  await p.evaluate(async () => { await Promise.all(Array.from(document.images).map((i) => i.complete ? 1 : new Promise((r) => { i.onload = r; i.onerror = r; }))); });
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: `${OUT}/${id}.pdf`, format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
  console.log(id, 'pdf written');
  await p.close();
}
await b.close(); console.log('IMG-CHECK-DONE');
