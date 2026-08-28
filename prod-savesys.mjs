import { chromium } from 'playwright';
const OUT = '/private/tmp/claude-501/-Users-mikebrown-audio-xx/4b31ef88-a78c-4b6b-a49b-9a695d816a5f/scratchpad/vis';
const MSG = 'My system is dCS Rossini Apex, ARC ref, Butler Monads, Acora QRC-2';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
await p.goto('https://audio-xx.com/auth/signin', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForTimeout(3000);
await p.locator('input[type="email"]').first().fill('diag@example.com');
await p.locator('input[type="password"]').first().fill('testpass123');
await p.locator('button[type="submit"], button:has-text("Sign in")').first().click();
await p.waitForTimeout(5000);
await p.goto('https://audio-xx.com/', { waitUntil: 'networkidle', timeout: 120000 });
await p.waitForTimeout(4000);
const box = p.locator('textarea, input[placeholder*="Help me choose"]').first();
const send = p.locator('button[type="submit"], button:has-text("Send")').first();
for (let i = 0; i < 30; i++) {
  await box.click().catch(()=>{});
  await box.fill(MSG).catch(()=>{});
  await p.waitForTimeout(700);
  if ((await box.inputValue().catch(()=>'')) === MSG && (await send.isEnabled().catch(()=>false))) break;
}
await p.keyboard.press('Enter');
await p.waitForTimeout(20000);
let t = await p.evaluate(() => document.body.innerText);
const saveIdx = t.search(/Save this system|You described a system/i);
console.log('save affordance:', saveIdx >= 0 ? t.slice(saveIdx, saveIdx + 160).replace(/\n+/g, ' | ') : 'NONE');
const saveBtn = p.locator('button:has-text("Save")').first();
if (await saveBtn.count()) {
  await saveBtn.click();
  await p.waitForTimeout(5000);
  t = await p.evaluate(() => document.body.innerText);
  console.log('after save, sidebar:', (t.match(/SYSTEM\n[^]{0,140}/) ?? ['?'])[0].replace(/\n+/g, ' | '));
}
await p.screenshot({ path: `${OUT}/prod-save.png`, fullPage: true });
await b.close(); console.log('DONE');
