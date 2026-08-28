import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('https://audio-xx.com/auth/signin', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForTimeout(3000);
await p.locator('input[type="email"]').first().fill('diag@example.com');
await p.locator('input[type="password"]').first().fill('testpass123');
await p.locator('button[type="submit"]').first().click();
await p.waitForTimeout(5000);
await p.goto('https://audio-xx.com/systems', { waitUntil: 'networkidle', timeout: 120000 });
await p.waitForTimeout(3000);
let t = await p.evaluate(() => document.body.innerText);
const removes = p.locator('button:has-text("Remove"), a:has-text("Remove")');
console.log('remove controls:', await removes.count());
await removes.first().click();
await p.waitForTimeout(2000);
t = await p.evaluate(() => document.body.innerText);
console.log('after click:', t.slice(t.indexOf('Test system'), t.indexOf('Test system') + 300).replace(/\n+/g, ' | '));
// Handle a confirm affordance of any phrasing near the row.
const confirm = p.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Remove system"), button:has-text("Delete")').first();
if (await confirm.count()) { await confirm.click(); await p.waitForTimeout(2500); }
else {
  // Some UIs turn the same link into "REMOVE?" or "CONFIRM REMOVE" — click it again.
  await removes.first().click().catch(() => {});
  await p.waitForTimeout(2500);
}
t = await p.evaluate(() => document.body.innerText);
const count = (t.match(/Test system/g) ?? []).length;
console.log('Test system rows remaining:', count);
await b.close();
