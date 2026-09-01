import { chromium } from 'playwright';
const OUT = '/private/tmp/claude-501/-Users-mikebrown-audio-xx/4b31ef88-a78c-4b6b-a49b-9a695d816a5f/scratchpad/vis';
const b = await chromium.launch();
const typeAndSend = async (p, msg) => {
  const box = p.locator('textarea:not([placeholder*="Anything else"]):visible, input[placeholder*="Help me choose"]:visible, input[placeholder*="Reply"]:visible').first();
  const send = p.getByRole('button', { name: 'Send', exact: true }).first();
  for (let i = 0; i < 40; i++) {
    await box.click().catch(()=>{});
    await box.fill(msg).catch(()=>{});
    await p.waitForTimeout(700);
    if ((await box.inputValue().catch(()=>'')) === msg && (await send.isEnabled().catch(()=>false))) break;
  }
  await send.click().catch(async () => { await p.keyboard.press('Enter'); });
};
const waitReview = async (p) => {
  let t = '';
  for (let i = 0; i < 30; i++) {
    await p.waitForTimeout(5000);
    t = await p.evaluate(() => document.body.innerText);
    if (/What remains unknown|couldn['’]t match|both appear as/i.test(t)) break;
  }
  await p.waitForTimeout(4000);
  return await p.evaluate(() => document.body.innerText);
};
const check = (name, t) => {
  const ys = t.indexOf('YOUR SYSTEM');
  console.log(`=== ${name} ===`);
  console.log('review:', /SYSTEM REVIEW/i.test(t), '| couldnt-match:', /couldn['’]t match/.test(t), '| dup-role-q:', /both appear as/i.test(t));
  for (const label of ['dCS Rossini Apex', 'Audio Research Reference 5', 'Butler MONAD A100', 'Acora Acoustics QRC-2']) {
    const i = t.indexOf(label, ys);
    console.log(label, '→', i < 0 ? 'ABSENT' : t.slice(i, i + 90).replace(/\n+/g, ' | ').slice(0, 90));
  }
  const open = t.indexOf('SYSTEM REVIEW');
  console.log('opening:', t.slice(open, open + 160).replace(/\n+/g, ' '));
};
// A1. direct signed-out
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  await p.goto('https://audio-xx.com/', { waitUntil: 'networkidle', timeout: 180000 });
  await typeAndSend(p, 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - Pre-amp: ARC ref 5. - Amps: Butler Monads. - Speakers: Acora QRC-2.');
  const t = await waitReview(p);
  check('A1 direct signed-out', t);
  await p.evaluate(async () => { await Promise.all(Array.from(document.images).map(i => i.complete ? 1 : new Promise(r => { i.onload = r; i.onerror = r; }))); });
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: `${OUT}/beta-nathan.pdf`, format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
  await p.close();
}
// A4. natural restatement
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  await p.goto('https://audio-xx.com/', { waitUntil: 'networkidle', timeout: 180000 });
  await typeAndSend(p, 'Assess my dCS Rossini Apex, ARC Ref 5, Butler Monads and Acora QRC-2');
  check('A4 natural restatement', await waitReview(p));
  await p.close();
}
// A5. accumulated conversation
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  await p.goto('https://audio-xx.com/', { waitUntil: 'networkidle', timeout: 180000 });
  await typeAndSend(p, 'I have a dCS Rossini Apex going into an ARC Ref 5');
  await p.waitForTimeout(14000);
  await typeAndSend(p, 'The amps are Butler Monads driving Acora QRC-2 speakers');
  await p.waitForTimeout(14000);
  await typeAndSend(p, 'Please assess my system');
  check('A5 accumulated', await waitReview(p));
  await p.close();
}
await b.close(); console.log('DONE');
