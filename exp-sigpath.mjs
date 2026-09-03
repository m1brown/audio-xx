// P1 signal-path authority — end-to-end verification through the UI.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = process.argv[3] ?? '/tmp/sigpath';
const CASES = [
  { id: 'T1-FRANCE2', msg: 'Assess my system: - JOB INTegrated - WLM Diva Monitor - Eversolo DMP-A6 - Chord Hugo' },
  { id: 'T2-EXPLICIT', msg: 'Assess my system: Eversolo DMP-A6 digital out into the Chord Hugo, Hugo into the JOB INTegrated analogue input, driving WLM Diva Monitors' },
  { id: 'T3-EXCLUDED', msg: "Assess my system: Eversolo DMP-A6 analogue out into the JOB INTegrated, WLM Diva Monitors. The Chord Hugo isn't being used." },
  { id: 'T4-SIMPLE', msg: 'Assess my system: WiiM Pro, Yamaha A-S501, KEF Q3 Meta' },
  { id: 'T7-SUB', msg: 'Assess my system: Eversolo DMP-A6 Gen 2 streamer, Hegel H150 amplifier, KEF LS50 Meta speakers, SVS SB-1000 Pro subwoofer' },
];
const b = await chromium.launch();
for (const cs of CASES) {
  const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  try {
    await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForTimeout(6000);
    const box = p.locator('textarea:not([placeholder*="Anything else"]):visible').first();
    const send = p.getByRole('button', { name: 'Send', exact: true }).first();
    for (let i = 0; i < 30; i++) { await box.click().catch(() => {}); await box.fill(cs.msg).catch(() => {}); await p.waitForTimeout(400); if ((await box.inputValue().catch(() => '')) === cs.msg && (await send.isEnabled().catch(() => false))) break; }
    const beforeLen = (await p.evaluate(() => document.body.innerText)).length;
    await send.click().catch(() => p.keyboard.press('Enter'));
    let body = '';
    for (let i = 0; i < 120; i++) {
      await p.waitForTimeout(2000);
      body = await p.evaluate(() => document.body.innerText);
      if (body.length > beforeLen + 600) { await p.waitForTimeout(4000); body = await p.evaluate(() => document.body.innerText); break; }
    }
    writeFileSync(`${OUT}/${cs.id}.txt`, body);
    const flags = {
      pairwiseConversion: body.includes('contains two conversion stages'),
      ambiguityQuestion: body.includes('how are you connecting them'),
      mentionsHugo: /Hugo/i.test(body),
      clarificationStall: /signal-flow order|which component (is|does) what/i.test(body),
    };
    console.log(cs.id, JSON.stringify(flags));
  } catch (e) { console.log(cs.id, 'ERROR', String(e).slice(0, 120)); }
  await p.close();
}
await b.close(); console.log('SIGPATH-DONE');
