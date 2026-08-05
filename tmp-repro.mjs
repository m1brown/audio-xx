import { chromium } from 'playwright';

const QUERIES = process.env.QUERIES ? JSON.parse(process.env.QUERIES) : [];
const BASE = process.env.BASE || 'https://audio-xx.com';
const WAIT = Number(process.env.WAIT || 45000);

const browser = await chromium.launch();
for (const q of QUERIES) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const logs = [];
  const net = [];
  const t0 = Date.now();
  page.on('console', (m) => logs.push(`+${Date.now()-t0}ms [${m.type()}] ${m.text().slice(0, 300)}`));
  page.on('pageerror', (e) => logs.push(`+${Date.now()-t0}ms [PAGEERROR] ${e.message}\n${(e.stack||'').slice(0,600)}`));
  page.on('requestfailed', (r) => { if (r.url().includes('/api/')) net.push(`+${Date.now()-t0}ms FAILED ${r.failure()?.errorText} ${r.url().replace(BASE,'')}`); });
  page.on('response', (r) => { const u = r.url(); if (u.includes('/api/') && !u.includes('sentry')) net.push(`+${Date.now()-t0}ms ${r.status()} ${u.replace(BASE,'')}`); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  const ta = page.locator('textarea').first();
  await ta.waitFor({ timeout: 30000 });
  await ta.click();
  await ta.pressSequentially(q, { delay: 5 });
  if ((await ta.inputValue()) !== q) console.log('INPUT MISMATCH');
  const btns = page.locator('button');
  const n = await btns.count();
  let clicked = false;
  for (let i = n - 1; i >= 0; i--) {
    const b = btns.nth(i);
    if (await b.isEnabled().catch(() => false)) {
      const t = ((await b.textContent().catch(() => '')) || '') + ((await b.getAttribute('aria-label').catch(() => '')) || '');
      if (/send|→|submit|ask/i.test(t)) { await b.click(); clicked = true; break; }
    }
  }
  if (!clicked) await ta.press('Enter');
  const sendAt = Date.now();
  const timeline = [];
  let last = '';
  while (Date.now() - sendAt < WAIT) {
    await page.waitForTimeout(1000);
    const t = await page.evaluate(() => document.body.innerText);
    const state = t.includes('Thinking about') ? 'PLACEHOLDER'
      : t.includes("I don't have enough structured data") ? 'FALLBACK_TEXT'
      : 'OTHER';
    if (state !== last) { timeline.push(`+${Date.now()-sendAt}ms ${state}`); last = state; }
  }
  const text = await page.evaluate(() => document.body.innerText);
  console.log('='.repeat(70));
  console.log('QUERY:', q);
  console.log('TIMELINE:', timeline.join(' | '));
  console.log('FINAL STATE:', last);
  console.log('--- NET ---'); console.log(net.join('\n'));
  console.log('--- CONSOLE ---'); console.log(logs.join('\n'));
  console.log('--- TEXT (1800 chars after user msg) ---');
  const i = text.indexOf(q.slice(0, 40));
  console.log(text.slice(i, i + 1800));
  await ctx.close();
}
await browser.close();
