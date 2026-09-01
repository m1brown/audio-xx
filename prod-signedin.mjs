import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
await p.goto('https://audio-xx.com/auth/signin', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForTimeout(3000);
await p.locator('input[type="email"], input[name="email"]').first().fill('diag@example.com');
await p.locator('input[type="password"], input[name="password"]').first().fill('testpass123');
await p.locator('button[type="submit"], button:has-text("Sign in")').first().click();
await p.waitForTimeout(5000);
const t0 = await p.evaluate(() => document.body.innerText);
const signedIn = !/sign in/i.test(p.url()) || /My Systems|Test system|LISTENER/i.test(t0);
console.log('signed in:', signedIn, '| url:', p.url());
console.log('systems page:', t0.slice(0, 400).replace(/\n+/g, ' | '));
await p.goto('https://audio-xx.com/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForTimeout(5000);
const assess = p.locator('button:has-text("Assess this system"), a:has-text("Assess this system")').first();
console.log('assess control present:', (await assess.count()) > 0);
if (await assess.count() > 0) {
  await assess.click();
  let t = '';
  for (let i = 0; i < 30; i++) {
    await p.waitForTimeout(5000);
    t = await p.evaluate(() => document.body.innerText);
    if (/SYSTEM REVIEW|The assessment/i.test(t) || /couldn['\u2019]t match/.test(t)) break;
  }
  await p.waitForTimeout(4000);
  t = await p.evaluate(() => document.body.innerText);
  console.log('has review:', /SYSTEM REVIEW|The assessment/i.test(t));
  console.log('has clarification:', /couldn['\u2019]t match/.test(t));
  const ys = t.indexOf('YOUR SYSTEM');
  for (const label of ['dCS Rossini Apex', 'Audio Research Reference 5', 'Butler MONAD A100', 'Acora Acoustics QRC-2']) {
    const i = t.indexOf(label, ys);
    console.log(label, '→', i < 0 ? 'ABSENT' : t.slice(i, i + 60).replace(/\n+/g, ' | '));
  }
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: '/private/tmp/claude-501/-Users-mikebrown-audio-xx/4b31ef88-a78c-4b6b-a49b-9a695d816a5f/scratchpad/vis/p0-saved.pdf', format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
}
await b.close(); console.log('DONE');
