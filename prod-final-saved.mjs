import { chromium } from 'playwright';
const OUT = '/private/tmp/claude-501/-Users-mikebrown-audio-xx/4b31ef88-a78c-4b6b-a49b-9a695d816a5f/scratchpad/vis';
const MSG = 'My system is dCS Rossini Apex, ARC ref, Butler Monads, Acora QRC-2';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
await p.goto('https://audio-xx.com/auth/signin', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForTimeout(3000);
await p.locator('input[type="email"]').first().fill('diag@example.com');
await p.locator('input[type="password"]').first().fill('testpass123');
await p.locator('button[type="submit"]').first().click();
await p.waitForTimeout(5000);
// Delete every existing QA record so the new editor writes fresh.
const del = await p.evaluate(async () => {
  const systems = await (await fetch('/api/systems')).json();
  const out = [];
  for (const s of systems) { const d = await fetch(`/api/systems/${s.id}`, { method: 'DELETE' }); out.push(`${s.name}: ${d.status}`); }
  return out;
});
console.log('deleted:', JSON.stringify(del));
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
await p.locator('input:visible').nth(0).fill('Test system');
const brandInputs = p.locator('input:visible');
await brandInputs.nth(3).fill('dCS');
await brandInputs.nth(4).fill('Rossini Apex');
await brandInputs.nth(5).fill('ARC');
await brandInputs.nth(6).fill('ref');
const selects = p.locator('select:visible');
await selects.nth(0).selectOption({ label: 'Streamer / DAC' });
await selects.nth(1).selectOption({ label: 'Pre-amplifier' });
for (const [brand, model, label] of [['Butler', 'Monads', 'Power amplifier'], ['Acora', 'QRC-2', 'Speaker']]) {
  await p.locator('text=+ Add component').first().click();
  await p.waitForTimeout(800);
  const all = p.locator('input:visible');
  const n = await all.count();
  await all.nth(n - 2).fill(brand);
  await all.nth(n - 1).fill(model);
  await selects.last().selectOption({ label });
}
const finalSel = [];
for (let i = 0; i < await selects.count(); i++) finalSel.push(await selects.nth(i).evaluate((el) => el.selectedOptions[0]?.textContent));
console.log('categories at save:', JSON.stringify(finalSel));
await p.locator('button:has-text("Save System")').first().click();
await p.waitForTimeout(6000);
// What did the store actually keep?
const stored = await p.evaluate(async () => {
  const systems = await (await fetch('/api/systems')).json();
  return systems.map((s) => ({ name: s.name, components: s.components.map((c) => ({ b: c.brand, n: c.name, cat: c.category, role: c.role })) }));
});
console.log('stored:', JSON.stringify(stored));
// The chip control.
await p.goto('https://audio-xx.com/', { waitUntil: 'networkidle', timeout: 120000 });
await p.waitForTimeout(4000);
const assess = p.locator('button:has-text("Assess this system"), a:has-text("Assess this system")').first();
console.log('assess present:', await assess.count());
await assess.click();
let t = '';
for (let i = 0; i < 30; i++) {
  await p.waitForTimeout(5000);
  t = await p.evaluate(() => document.body.innerText);
  if (/SYSTEM REVIEW|The assessment/i.test(t) || /couldn['’]t match|both appear as/i.test(t)) break;
}
await p.waitForTimeout(6000);
t = await p.evaluate(() => document.body.innerText);
console.log('review:', /SYSTEM REVIEW|The assessment/i.test(t), '| phantom:', /couldn['’]t match/.test(t), '| conflict:', /both appear as/i.test(t));
console.log('roles in dossiers:', JSON.stringify(['STREAMER','PREAMPLIFIER','AMPLIFIER','SPEAKER','PREAMP','POWER_AMP','OTHER'].map((r) => [r, (t.match(new RegExp('\\n' + r + '\\n', 'g')) ?? []).length])));
await p.evaluate(async () => { await Promise.all(Array.from(document.images).map(i => i.complete ? 1 : new Promise(r => { i.onload = r; i.onerror = r; }))); });
await p.emulateMedia({ media: 'print' });
await p.pdf({ path: `${OUT}/p0-saved-final.pdf`, format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
await b.close(); console.log('DONE');
