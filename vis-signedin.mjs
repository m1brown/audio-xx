import { chromium } from 'playwright';
const OUT = process.env.OUT;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
p.on('pageerror', e => console.log('PAGEERR:', String(e).slice(0, 400)));
p.on('console', m => { if (m.type() === 'error') console.log('CERR:', m.text().slice(0, 250)); });
await p.goto('http://localhost:3000/auth/signin', { waitUntil: 'domcontentloaded', timeout: 240000 });
await p.waitForTimeout(2500);
await p.locator('input[type="email"], input[name="email"]').first().fill('diag@example.com');
await p.locator('input[type="password"], input[name="password"]').first().fill('testpass123');
await p.locator('button[type="submit"], button:has-text("Sign in")').first().click();
await p.waitForTimeout(4000);
console.log('after signin url:', p.url());
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 240000 });
await p.waitForTimeout(4000);
const t0 = await p.evaluate(() => document.body.innerText);
console.log('signed in:', /Test system|My Systems/i.test(t0));
// Find the saved-system assess control.
const assess = p.locator('button:has-text("Assess this system"), a:has-text("Assess this system")').first();
if (await assess.count() === 0) {
  console.log('NO ASSESS CONTROL on home; trying My Systems');
  await p.goto('http://localhost:3000/systems', { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(()=>{});
  await p.waitForTimeout(3000);
  console.log('systems page text:', (await p.evaluate(() => document.body.innerText)).slice(0, 600).replace(/\n+/g,' | '));
} else {
  await assess.click();
  let t = '';
  for (let i = 0; i < 24; i++) {
    await p.waitForTimeout(5000);
    t = await p.evaluate(() => document.body.innerText);
    if (/System review|The assessment/i.test(t) || /couldn['’]t match/.test(t)) break;
  }
  console.log('has review:', /System review|The assessment/i.test(t));
  console.log('has clarification:', /couldn['’]t match/.test(t));
  console.log('body tail:', t.slice(-500).replace(/\n+/g,' | '));
  await p.screenshot({ path: `${OUT}/signedin.png`, fullPage: true });
}
await b.close(); console.log('DONE');
