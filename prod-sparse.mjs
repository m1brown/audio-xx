import { chromium } from 'playwright';
const OUT = '/private/tmp/claude-501/-Users-mikebrown-audio-xx/4b31ef88-a78c-4b6b-a49b-9a695d816a5f/scratchpad/vis';
const CASES = {
  france: { msg: 'assess my system: Eversolo DMP-A6 streamer/dac --> JOB Job integrated amp --> WLM Diva monitor speakers' },
  nathan: { msg: 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - Pre-amp: ARC ref 5. - Amps: Butler Monads. - Speakers: Acora QRC-2.' },
  badmatch: { msg: 'assess my system: Leben CS600 integrated amplifier, Magnepan LRS speakers' },
  obscure: { msg: 'assess my system: Sansui AU-517 amplifier, Snell Type J speakers' },
  upgrade: {
    msg: 'assess my system: Eversolo DMP-A6 streamer/dac --> JOB Job integrated amp --> WLM Diva monitor speakers',
    followUp: 'Would replacing the Eversolo with a much better external DAC be a worthwhile upgrade?',
  },
};
const typeAndSend = async (p, msg) => {
  const box = p.locator('textarea, input[placeholder*="Help me choose"], input[placeholder*="Reply"]').first();
  const send = p.locator('button[type="submit"], button:has-text("Send")').first();
  for (let i = 0; i < 30; i++) {
    await box.click().catch(()=>{});
    await box.fill(msg).catch(()=>{});
    await p.waitForTimeout(600);
    if ((await box.inputValue().catch(()=>'')) === msg && (await send.isEnabled().catch(()=>false))) break;
  }
  await p.keyboard.press('Enter');
};
const b = await chromium.launch();
for (const [name, c] of Object.entries(CASES)) {
  const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  await p.goto('https://audio-xx.com/', { waitUntil: 'networkidle', timeout: 180000 });
  await typeAndSend(p, c.msg);
  let t = '';
  for (let i = 0; i < 30; i++) {
    await p.waitForTimeout(5000);
    t = await p.evaluate(() => document.body.innerText);
    if (/System review|SYSTEM REVIEW|The assessment|couldn['’]t match|none of these/i.test(t)) break;
  }
  await p.waitForTimeout(4000);
  if (c.followUp) {
    await typeAndSend(p, c.followUp);
    for (let i = 0; i < 24; i++) {
      await p.waitForTimeout(5000);
      const t2 = await p.evaluate(() => document.body.innerText);
      if (t2.length > t.length + 200) { t = t2; break; }
    }
    await p.waitForTimeout(4000);
    t = await p.evaluate(() => document.body.innerText);
  }
  console.log(`=== ${name} ===`);
  let start = t.search(/System review|SYSTEM REVIEW|The assessment|I can see the shape/i);
  if (start < 0) start = 0;
  console.log(t.slice(start, start + (name === 'upgrade' ? 0 : 1400)).replace(/\n{2,}/g, '\n'));
  if (c.followUp) {
    const fu = t.lastIndexOf(c.followUp);
    console.log('--- FOLLOW-UP ANSWER ---');
    console.log(t.slice(fu + c.followUp.length, fu + c.followUp.length + 1600).replace(/\n{2,}/g, '\n'));
  }
  await p.evaluate(async () => { await Promise.all(Array.from(document.images).map(i => i.complete ? 1 : new Promise(r => { i.onload = r; i.onerror = r; }))); });
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: `${OUT}/sp-${name}.pdf`, format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
  await p.close();
}
await b.close(); console.log('DONE');
