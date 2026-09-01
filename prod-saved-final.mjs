import { chromium } from 'playwright';
const OUT = '/private/tmp/claude-501/-Users-mikebrown-audio-xx/4b31ef88-a78c-4b6b-a49b-9a695d816a5f/scratchpad/vis';
const ROW = Number(process.argv[2] ?? 1); // which USE IN CONVERSATION row
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
await p.goto('https://audio-xx.com/auth/signin', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForTimeout(3000);
await p.locator('input[type="email"]').first().fill('diag@example.com');
await p.locator('input[type="password"]').first().fill('testpass123');
await p.locator('button[type="submit"]').first().click();
await p.waitForTimeout(5000);
await p.goto('https://audio-xx.com/systems', { waitUntil: 'networkidle', timeout: 120000 });
await p.waitForTimeout(3000);
// Target the row named "Test system C" and click ITS use-in-conversation.
const row = p.locator('div,li,section').filter({ hasText: /^Test system C/ }).last();
let useBtn = row.locator('button:has-text("Use in conversation"), a:has-text("Use in conversation")').first();
if (!(await useBtn.count())) {
  // fallback: nth over all use controls
  const use = p.locator('button:has-text("Use in conversation"), a:has-text("Use in conversation")');
  console.log('fallback use controls:', await use.count(), 'clicking', ROW);
  useBtn = use.nth(ROW);
}
await useBtn.click();
await p.waitForTimeout(6000);
console.log('url now:', p.url());
// Now on the conversation with this system active; find the assess chip.
const assess = p.locator('button:has-text("Assess this system"), a:has-text("Assess this system")').first();
console.log('assess present:', await assess.count());
if (await assess.count()) {
  await assess.click();
  let t = '';
  for (let i = 0; i < 30; i++) {
    await p.waitForTimeout(5000);
    t = await p.evaluate(() => document.body.innerText);
    if (/SYSTEM REVIEW|The assessment/i.test(t) || /couldn['’]t match|both appear as amplifiers/i.test(t)) break;
  }
  await p.waitForTimeout(4000);
  t = await p.evaluate(() => document.body.innerText);
  console.log('review:', /SYSTEM REVIEW|The assessment/i.test(t));
  console.log('phantom clarification:', /couldn['’]t match/.test(t));
  console.log('role-conflict question:', /both appear as amplifiers/i.test(t));
  for (const label of ['dCS Rossini Apex', 'Audio Research Reference 5', 'Butler MONAD A100', 'Acora Acoustics QRC-2']) {
    const i = t.indexOf(label);
    console.log(label, '→', i < 0 ? 'ABSENT' : t.slice(i, i + 70).replace(/\n+/g, ' | '));
  }
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: `${OUT}/p0-saved.pdf`, format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
}
await b.close(); console.log('DONE');
