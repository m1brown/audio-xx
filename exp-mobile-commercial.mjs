import { chromium } from 'playwright';
const BASE = 'https://audio-xx.com';
// Footer/legal + affiliate link checks
for (const path of ['/privacy', '/terms', '/affiliate-disclosure', '/about', '/contact']) {
  const s = await fetch(BASE + path, { redirect: 'follow' }).then((r) => r.status).catch(() => 0);
  console.log(`link ${path}: ${s}`);
}
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 375, height: 812 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' });
const errors = [];
p.on('pageerror', (e) => errors.push(String(e).slice(0, 100)));
await p.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
const hScroll = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 5);
console.log('mobile-no-horizontal-scroll:', !hScroll);
const box = p.locator('textarea:visible').first();
console.log('mobile-composer-visible:', await box.count() > 0);
const MSG = 'Assess my system: Rega Planar 3, Rega io amp, Wharfedale Diamond 12.1 speakers';
await box.fill(MSG).catch(() => {});
const send = p.getByRole('button', { name: 'Send', exact: true }).first();
for (let i = 0; i < 30; i++) { if (await send.isEnabled().catch(() => false)) break; await p.waitForTimeout(1000); }
await send.click().catch(() => {});
let t = '';
for (let i = 0; i < 32; i++) { await p.waitForTimeout(4000); t = await p.evaluate(() => document.body.innerText); if (/SYSTEM REVIEW|couldn['’]t match|What role/i.test(t)) break; }
console.log('mobile-assessment-renders:', /SYSTEM REVIEW|couldn['’]t match|What role/i.test(t));
console.log('affiliate-disclosure-visible:', /may earn commissions/i.test(t));
console.log('feedback-path-visible:', /Report issue|feedback/i.test(t));
console.log('affiliate-links-present:', /HiFiShark|eBay/i.test(t));
console.log('mobile-page-errors:', errors.length, errors[0] ?? '');
await b.close();
const bundles = await fetch(BASE).then((r) => r.text());
console.log('sentry-in-page:', /sentry/i.test(bundles));
