import { chromium } from 'playwright';
const OUT = '/private/tmp/claude-501/-Users-mikebrown-audio-xx/4b31ef88-a78c-4b6b-a49b-9a695d816a5f/scratchpad/vis';
const MSG = 'assess my system: Eversolo DMP-A6 streamer/dac --> JOB Job integrated amp --> WLM Diva monitor speakers';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 180000 });
const box = p.locator('textarea, input[placeholder*="Help me choose"]').first();
const send = p.locator('button[type="submit"], button:has-text("Send")').first();
for (let i = 0; i < 30; i++) {
  await box.click().catch(()=>{});
  await box.fill(MSG).catch(()=>{});
  await p.waitForTimeout(700);
  if ((await box.inputValue().catch(()=>'')) === MSG && (await send.isEnabled().catch(()=>false))) break;
}
await p.keyboard.press('Enter');
let t = '';
for (let i = 0; i < 30; i++) {
  await p.waitForTimeout(5000);
  t = await p.evaluate(() => document.body.innerText);
  if (/SYSTEM REVIEW|The assessment|What remains unknown/i.test(t)) break;
}
await p.waitForTimeout(4000);
t = await p.evaluate(() => document.body.innerText);
console.log('A 13W power output present:', /POWER OUTPUT\s*13W|13W/i.test(t));
const wlmIdx = t.indexOf('WLM Diva monitor', t.indexOf('YOUR SYSTEM'));
console.log('B WLM block:', t.slice(wlmIdx, wlmIdx + 90).replace(/\n+/g, ' | '));
const evIdx = t.indexOf('Eversolo DMP-A6', t.indexOf('YOUR SYSTEM'));
console.log('A Eversolo block:', t.slice(evIdx, evIdx + 120).replace(/\n+/g, ' | '));
console.log('C impedance-dips prose:', /impedance dips or its phase/i.test(t));
console.log('D already-bound prose:', /already bound/i.test(t));
console.log('gap para:', (t.match(/The gap is narrow and specific[^]{0,260}/) ?? ['none'])[0].replace(/\n+/g,' '));
let start = t.search(/System review|SYSTEM REVIEW|The assessment/);
if (start < 0) start = 0;
const end = t.indexOf('YOUR SYSTEM', start);
console.log('--- REVIEW BODY ---');
console.log(t.slice(start, end > start ? end : start + 5200));
console.log('--- JOB DOSSIER ---');
const j = t.indexOf('Job integrated', t.indexOf('YOUR SYSTEM'));
console.log(t.slice(j, j + 1400));
await p.screenshot({ path: `${OUT}/france-local-fixed.png`, fullPage: true });
await b.close(); console.log('DONE');
