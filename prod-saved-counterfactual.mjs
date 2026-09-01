import { chromium } from 'playwright';
const OUT = '/private/tmp/claude-501/-Users-mikebrown-audio-xx/4b31ef88-a78c-4b6b-a49b-9a695d816a5f/scratchpad/campaign2';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
await p.goto('https://audio-xx.com/auth/signin', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForTimeout(3000);
await p.locator('input[type="email"]').first().fill('diag@example.com');
await p.locator('input[type="password"]').first().fill('testpass123');
await p.locator('button[type="submit"]').first().click();
await p.waitForTimeout(5000);
const before = await p.evaluate(async () => {
  const systems = await (await fetch('/api/systems')).json();
  return systems.map((s) => ({ id: s.id, name: s.name, comps: s.components.map((c) => `${c.brand} ${c.name}`) }));
});
console.log('SAVED-BEFORE:', JSON.stringify(before));
if (!before.length) { console.log('NO-SAVED-SYSTEM — aborting'); await b.close(); process.exit(0); }
await p.goto('https://audio-xx.com/', { waitUntil: 'networkidle', timeout: 120000 });
await p.waitForTimeout(4000);
const typeAndSend = async (msg) => {
  const box = p.locator('textarea:not([placeholder*="Anything else"]):visible, input[placeholder*="Help me choose"]:visible, input[placeholder*="Reply"]:visible').first();
  const send = p.getByRole('button', { name: 'Send', exact: true }).first();
  for (let i = 0; i < 120; i++) { if (await send.isEnabled().catch(() => false)) break; await p.waitForTimeout(1000); }
  for (let i = 0; i < 60; i++) {
    await box.click().catch(() => {}); await box.fill(msg).catch(() => {});
    await p.waitForTimeout(700);
    if ((await box.inputValue().catch(() => '')) === msg && (await send.isEnabled().catch(() => false))) break;
  }
  await send.click().catch(async () => { await p.keyboard.press('Enter'); });
};
const assess = p.locator('button:has-text("Assess this system"), a:has-text("Assess this system")').first();
if (await assess.count()) { await assess.click(); } else { await typeAndSend('Assess my saved system'); }
let t = '';
for (let i = 0; i < 30; i++) {
  await p.waitForTimeout(5000);
  t = await p.evaluate(() => document.body.innerText);
  if (/SYSTEM REVIEW|What remains unknown|couldn['’]t match/i.test(t)) break;
}
await p.waitForTimeout(3000);
const outputs = [{ q: '(saved assessment)', text: await p.evaluate(() => document.body.innerText) }];
for (const q of ['What about a Leben CS600 instead of the Butler?', 'Keep the Butler. What would you change next?']) {
  const beforeLen = (await p.evaluate(() => document.body.innerText)).length;
  await typeAndSend(q);
  for (let i = 0; i < 24; i++) {
    await p.waitForTimeout(5000);
    const t2 = await p.evaluate(() => document.body.innerText);
    if (t2.length > beforeLen + 100) break;
  }
  await p.waitForTimeout(4000);
  outputs.push({ q, text: await p.evaluate(() => document.body.innerText) });
}
const after = await p.evaluate(async () => {
  const systems = await (await fetch('/api/systems')).json();
  return systems.map((s) => ({ id: s.id, name: s.name, comps: s.components.map((c) => `${c.brand} ${c.name}`) }));
});
console.log('SAVED-AFTER:', JSON.stringify(after));
console.log('SAVED-UNCHANGED:', JSON.stringify(before) === JSON.stringify(after));
const fs = await import('node:fs');
fs.writeFileSync(`${OUT}/SAVED-CF.json`, JSON.stringify(outputs));
console.log('SAVED-CF done', outputs.map((o) => o.text.length).join(','));
await b.close();
