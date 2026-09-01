import { chromium } from 'playwright';
const OUT = '/private/tmp/claude-501/-Users-mikebrown-audio-xx/4b31ef88-a78c-4b6b-a49b-9a695d816a5f/scratchpad/vis';
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
const inputs = p.locator('main input[type="text"], main input:not([type])');
console.log('intake inputs:', await inputs.count());
if (await inputs.count() >= 3) {
  const vals = ['dCS Rossini Apex', 'Butler Monads', 'Acora QRC-2'];
  for (let attempt = 0; attempt < 20; attempt++) {
    for (let i = 0; i < 3; i++) { await inputs.nth(i).click(); await inputs.nth(i).fill(vals[i]); }
    await p.waitForTimeout(800);
    const got = [];
    for (let i = 0; i < 3; i++) got.push(await inputs.nth(i).inputValue());
    if (got.join('|') === vals.join('|')) break;
  }
  const add = p.locator('button:has-text("ADD ANOTHER COMPONENT")').first();
  if (await add.count()) {
    await add.click();
    await p.waitForTimeout(1000);
    const inputs2 = p.locator('main input[type="text"], main input:not([type])');
    console.log('after add:', await inputs2.count());
    for (let attempt = 0; attempt < 10; attempt++) {
      await inputs2.nth(3).click(); await inputs2.nth(3).fill('ARC ref');
      await p.waitForTimeout(600);
      if ((await inputs2.nth(3).inputValue()) === 'ARC ref') break;
    }
    const allVals = [];
    for (let i = 0; i < 4; i++) allVals.push(await inputs2.nth(i).inputValue());
    console.log('final inputs:', JSON.stringify(allVals));
  }
  await p.waitForTimeout(500);
  await p.locator('button:has-text("READ MY ASSESSMENT")').first().click();
  let t = '';
  for (let i = 0; i < 30; i++) {
    await p.waitForTimeout(5000);
    t = await p.evaluate(() => document.body.innerText);
    if (/SYSTEM REVIEW|The assessment/i.test(t) || /couldn['’]t match/.test(t)) break;
  }
  await p.waitForTimeout(4000);
  t = await p.evaluate(() => document.body.innerText);
  console.log('review:', /SYSTEM REVIEW|The assessment/i.test(t), '| clarif:', /couldn['’]t match/.test(t));
  console.log('save affordance:', /Save this system|Saved|SYSTEM\n/i.test(t));
  const side = t.indexOf('SYSTEM');
  console.log('sidebar area:', t.slice(side, side + 220).replace(/\n+/g, ' | '));
  await p.screenshot({ path: `${OUT}/build-after-assess.png`, fullPage: true });
}
await b.close(); console.log('DONE');
