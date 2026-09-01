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
await p.goto('https://audio-xx.com/systems', { waitUntil: 'networkidle', timeout: 120000 });
await p.waitForTimeout(3000);
const remove = p.locator('button:has-text("Remove"), a:has-text("Remove")').first();
if (await remove.count()) {
  await remove.click();
  await p.waitForTimeout(1500);
  const confirm = p.locator('button:has-text("Remove"), button:has-text("Confirm"), button:has-text("Yes")').first();
  if (await confirm.count()) await confirm.click().catch(() => {});
  await p.waitForTimeout(2500);
  console.log('removed old Test system:', !/Test system/.test(await p.evaluate(() => document.body.innerText)));
}
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
await p.waitForTimeout(15000);
await p.locator('button:has-text("Review & save")').first().click();
await p.waitForTimeout(2500);

// Fill the Edit System dialog with the full, correct four components.
const dlg = p.locator('div:has-text("Edit System")').last();
const nameField = p.locator('input[value="My System"], input').filter({ hasText: '' }).first();
await p.locator('input:visible').nth(0).fill('Test system C');
const rows = async () => p.locator('input[placeholder="Model"]');
// Row 1: Dcs → dCS / Rossini Apex
const brandInputs = p.locator('input:visible');
// dialog inputs: [0]=name [1]=location [2]=primary use [3]=brand1 [4]=model1 [5]=brand2 [6]=model2 ...
await brandInputs.nth(3).fill('dCS');
await brandInputs.nth(4).fill('Rossini Apex');
await brandInputs.nth(5).fill('ARC');
await brandInputs.nth(6).fill('ref');
// set row2 category if a Preamp option exists
const selects = p.locator('select:visible');
const opts2 = await selects.nth(1).locator('option').allInnerTexts();
console.log('category options:', JSON.stringify(opts2));
const pre = opts2.find((o) => /pre/i.test(o));
if (pre) { await selects.nth(1).selectOption({ label: pre }); console.log('ARC set to', pre); }
else console.log('NO PREAMP OPTION');
// Add Butler and Acora rows
for (const [brand, model, label] of [['Butler', 'Monads', 'Power amplifier'], ['Acora', 'QRC-2', 'Speaker']]) {
  await p.locator('text=+ Add component').first().click();
  await p.waitForTimeout(800);
  const all = p.locator('input:visible');
  const n = await all.count();
  await all.nth(n - 2).fill(brand);
  await all.nth(n - 1).fill(model);
  const sel = selects.last();
  await sel.selectOption({ label });
}
// Row 1 category: DAC (default may already be DAC — set explicitly).
await selects.nth(0).selectOption({ label: 'Streamer / DAC' }).catch(() => selects.nth(0).selectOption({ label: 'DAC' }));
const finalSel = [];
for (let i = 0; i < await selects.count(); i++) {
  finalSel.push(await selects.nth(i).evaluate((el) => el.selectedOptions[0]?.textContent));
}
console.log('final categories:', JSON.stringify(finalSel));
await p.screenshot({ path: `${OUT}/prod-save-dialog.png` });
await p.locator('button:has-text("Save System")').first().click();
await p.waitForTimeout(6000);
const t = await p.evaluate(() => document.body.innerText);
const si = t.indexOf('SYSTEM');
console.log('sidebar after save:', t.slice(t.indexOf('SYSTEM', t.indexOf('LISTENER')), t.indexOf('SYSTEM', t.indexOf('LISTENER')) + 200).replace(/\n+/g, ' | '));
await b.close(); console.log('DONE');
