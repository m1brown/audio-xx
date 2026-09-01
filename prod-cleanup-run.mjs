import { chromium } from 'playwright';
const OUT = '/private/tmp/claude-501/-Users-mikebrown-audio-xx/4b31ef88-a78c-4b6b-a49b-9a695d816a5f/scratchpad/vis';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
await p.goto('https://audio-xx.com/auth/signin', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForTimeout(3000);
await p.locator('input[type="email"]').first().fill('diag@example.com');
await p.locator('input[type="password"]').first().fill('testpass123');
await p.locator('button[type="submit"]').first().click();
await p.waitForTimeout(5000);
// Remove the two stale QA records named exactly "Test system", keep "Test system C".
const res = await p.evaluate(async () => {
  const r = await fetch('/api/systems'); const systems = await r.json();
  const out = [];
  for (const s of systems) {
    if (s.name === 'Test system') {
      const d = await fetch(`/api/systems/${s.id}`, { method: 'DELETE' });
      out.push(`${s.id}: ${d.status}`);
    }
  }
  const after = await (await fetch('/api/systems')).json();
  return { deleted: out, remaining: after.map((s) => s.name) };
});
console.log(JSON.stringify(res));
// Activate Test system C and run the chip control.
await p.goto('https://audio-xx.com/systems', { waitUntil: 'networkidle', timeout: 120000 });
await p.waitForTimeout(3000);
await p.locator('button:has-text("Use in conversation"), a:has-text("Use in conversation")').first().click();
await p.waitForTimeout(6000);
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
console.log('review:', /SYSTEM REVIEW|The assessment/i.test(t));
console.log('phantom clarification:', /couldn['’]t match/.test(t));
console.log('role-conflict question:', /both appear as/i.test(t));
for (const label of ['dCS Rossini Apex', 'Audio Research Reference 5', 'Butler MONAD A100', 'Acora Acoustics QRC-2']) {
  const i = t.indexOf(label);
  console.log(label, '→', i < 0 ? 'ABSENT' : t.slice(i, i + 70).replace(/\n+/g, ' | '));
}
await p.evaluate(async () => {
  await Promise.all(Array.from(document.images).map(i => i.complete ? 1 : new Promise(r => { i.onload = r; i.onerror = r; })));
});
await p.emulateMedia({ media: 'print' });
await p.pdf({ path: `${OUT}/p0-saved.pdf`, format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
await b.close(); console.log('DONE');
