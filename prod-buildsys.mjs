import { chromium } from 'playwright';
const OUT = '/private/tmp/claude-501/-Users-mikebrown-audio-xx/4b31ef88-a78c-4b6b-a49b-9a695d816a5f/scratchpad/vis';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
await p.goto('https://audio-xx.com/auth/signin', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForTimeout(3000);
await p.locator('input[type="email"], input[name="email"]').first().fill('diag@example.com');
await p.locator('input[type="password"], input[name="password"]').first().fill('testpass123');
await p.locator('button[type="submit"], button:has-text("Sign in")').first().click();
await p.waitForTimeout(5000);
await p.goto('https://audio-xx.com/systems', { waitUntil: 'domcontentloaded', timeout: 120000 });
await p.waitForTimeout(3000);
const build = p.locator('a:has-text("Build your first"), button:has-text("Build your first")').first();
console.log('build link:', await build.count());
if (await build.count()) {
  await build.click();
  await p.waitForTimeout(4000);
  console.log('after build url:', p.url());
  console.log('page:', (await p.evaluate(() => document.body.innerText)).slice(0, 700).replace(/\n+/g, ' | '));
  await p.screenshot({ path: `${OUT}/build-flow.png`, fullPage: true });
}
await b.close(); console.log('DONE');
