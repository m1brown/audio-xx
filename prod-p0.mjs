import { chromium } from 'playwright';
const OUT = '/private/tmp/claude-501/-Users-mikebrown-audio-xx/4b31ef88-a78c-4b6b-a49b-9a695d816a5f/scratchpad/vis';
const CASES = {
  france: 'assess my system: Eversolo DMP-A6 streamer/dac --> JOB Job integrated amp --> WLM Diva monitor speakers',
  nathan: 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - Pre-amp: ARC ref 5. - Amps: Butler Monads. - Speakers: Acora QRC-2.',
  untouched: 'assess my system: Rega Elex-R integrated amp, Magnepan LRS speakers',
  sideways: 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - leben cs600 integrated amplifier - Speakers: devore o/96',
  fictional: 'assess my system: Zorblax ZX1 dac, Quibblewock Q2 amp, Fnord F3 speakers',
};
const b = await chromium.launch();
for (const [name, msg] of Object.entries(CASES)) {
  const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  await p.goto('https://audio-xx.com/', { waitUntil: 'networkidle', timeout: 180000 });
  const box = p.locator('textarea, input[placeholder*="Help me choose"]').first();
  const send = p.locator('button[type="submit"], button:has-text("Send")').first();
  for (let i = 0; i < 30; i++) {
    await box.click().catch(()=>{});
    await box.fill(msg).catch(()=>{});
    await p.waitForTimeout(700);
    if ((await box.inputValue().catch(()=>'')) === msg && (await send.isEnabled().catch(()=>false))) break;
  }
  await p.keyboard.press('Enter');
  let t = '';
  for (let i = 0; i < 36; i++) {
    await p.waitForTimeout(5000);
    t = await p.evaluate(() => document.body.innerText);
    if (/SYSTEM REVIEW|The assessment|What remains unknown/i.test(t)) break;
  }
  await p.waitForTimeout(4000);
  t = await p.evaluate(() => document.body.innerText);
  const ys = t.indexOf('YOUR SYSTEM');
  const block = (label) => {
    const i = t.indexOf(label, ys);
    return i < 0 ? 'ABSENT' : t.slice(i, i + 70).replace(/\n+/g, ' | ');
  };
  console.log(`=== ${name} ===`);
  console.log('13W:', /13W/.test(t), '| impedance-dips:', /impedance dips or its phase/i.test(t), '| already-bound:', /already bound/i.test(t));
  if (name === 'france') {
    console.log('EV:', block('Eversolo DMP-A6'));
    console.log('WLM:', block('WLM Diva monitor'));
    console.log('gap:', (t.match(/The gap is narrow and specific[^]{0,200}/) ?? ['none'])[0].replace(/\n+/g,' '));
  }
  if (name === 'nathan') {
    console.log('Butler:', block('Butler MONAD A100'));
    console.log('Acora:', block('Acora Acoustics QRC-2'));
    console.log('gap:', (t.match(/The gap is narrow and specific[^]{0,180}/) ?? ['none'])[0].replace(/\n+/g,' '));
  }
  if (name === 'untouched') {
    console.log('Rega:', block('Rega'));
    console.log('Magnepan:', block('Magnepan'));
  }
  if (name === 'sideways') {
    console.log('Leben:', block('Leben CS600'));
    console.log('DeVore:', block('DeVore Fidelity Orangutan'));
  }
  if (name === 'fictional') {
    console.log('clarifies:', /couldn['\u2019]t match|which model|what are they|not recognise|don't hold/i.test(t));
    console.log('head:', t.slice(t.indexOf('Zorblax'), t.indexOf('Zorblax') + 120).replace(/\n+/g, ' | '));
  }
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: `${OUT}/p0-${name}.pdf`, format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
  await p.close();
}
await b.close(); console.log('DONE');
