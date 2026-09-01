/**
 * Production smoke battery — post-deployment release gate (2026-09-01).
 *
 * Small on purpose: proves the correct artifact is live and the core user
 * promises survived deployment. Not a regression suite. Run after every
 * release:  node scripts/prod-smoke.mjs <expected-commit-sha> [base-url]
 */
import { chromium } from 'playwright';
const EXPECTED = process.argv[2];
const BASE = process.argv[3] ?? 'https://audio-xx.com';
if (!EXPECTED) { console.error('usage: node scripts/prod-smoke.mjs <expected-commit> [base]'); process.exit(2); }

const results = [];
const check = (id, ok, detail = '') => {
  results.push({ id, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? ' — ' + detail : ''}`);
};

// A · deployment identity
const v = await fetch(`${BASE}/api/version`).then((r) => r.json()).catch(() => null);
check('A-identity', !!v && (v.commit === EXPECTED || v.commit?.startsWith(EXPECTED)),
  `served=${v?.commit?.slice(0, 10)} env=${v?.env} expected=${EXPECTED.slice(0, 10)}`);

// B · homepage
const home = await fetch(BASE).then((r) => r.ok ? r.text() : '').catch(() => '');
check('B-homepage', home.includes('Audio XX') || home.includes('AUDIO XX'));

// H · share route
const share = await fetch(`${BASE}/artifact/s/3nkS-YHOoaja3s7dfLRtNg`).then((r) => r.status).catch(() => 0);
check('H-share-route', share === 200, `status=${share}`);

const b = await chromium.launch();

// C–G · signed-in saved-system journey
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  await p.goto(`${BASE}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(2500);
  await p.locator('input[type="email"]').first().fill('diag@example.com');
  await p.locator('input[type="password"]').first().fill('testpass123');
  await p.locator('button[type="submit"]').first().click();
  await p.waitForTimeout(4000);
  const systems = await p.evaluate(async () => {
    const r = await fetch('/api/systems'); return r.ok ? r.json() : null;
  });
  check('C-signed-in', Array.isArray(systems), `systems=${systems?.length}`);
  const nathan = (systems ?? []).find((s) => (s.components ?? []).some((c) => /butler/i.test(`${c.brand} ${c.name}`)));
  check('D-saved-resolves', !!nathan && nathan.components.length === 4,
    (nathan?.components ?? []).map((c) => c.name).join(','));

  await p.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
  await p.waitForTimeout(3000);
  const box = p.locator('textarea:not([placeholder*="Anything else"]):visible').first();
  const send = p.getByRole('button', { name: 'Send', exact: true }).first();
  for (let i = 0; i < 60; i++) { if (await send.isEnabled().catch(() => false)) break; await p.waitForTimeout(1000); }
  const MSG = 'Assess my system: dCS Rossini Apex, ARC ref 5, Butler Monads, Acora QRC-2';
  for (let i = 0; i < 30; i++) { await box.click().catch(() => {}); await box.fill(MSG).catch(() => {}); await p.waitForTimeout(500); if ((await box.inputValue().catch(() => '')) === MSG && (await send.isEnabled().catch(() => false))) break; }
  await send.click();
  let t = '';
  for (let i = 0; i < 35; i++) { await p.waitForTimeout(4000); t = await p.evaluate(() => document.body.innerText); if (/SYSTEM REVIEW|signal-flow|clarification/i.test(t)) break; }
  await p.waitForTimeout(4000);
  t = await p.evaluate(() => document.body.innerText);
  check('E-no-flow-clarification', !/signal-flow order|source to output/i.test(t) && /SYSTEM REVIEW/i.test(t));
  check('F-canonical-chain', /Butler (MONAD A100|Monads)/i.test(t) && /Acora/i.test(t) && /Rossini/i.test(t));
  check('G-no-degraded-save-chip', !/You described a system/i.test(t));
  check('J-no-page-errors-signedin', errors.length === 0, errors[0] ?? '');
  await p.close();
}

// I · signed-out assessment
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  await p.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
  const box = p.locator('textarea:not([placeholder*="Anything else"]):visible').first();
  const send = p.getByRole('button', { name: 'Send', exact: true }).first();
  for (let i = 0; i < 60; i++) { if (await send.isEnabled().catch(() => false)) break; await p.waitForTimeout(1000); }
  const MSG = 'Assess my system: PrimaLuna EVO 300 tube amp with Klipsch Cornwall IV speakers, source is a Bluesound Node';
  for (let i = 0; i < 30; i++) { await box.click().catch(() => {}); await box.fill(MSG).catch(() => {}); await p.waitForTimeout(500); if ((await box.inputValue().catch(() => '')) === MSG && (await send.isEnabled().catch(() => false))) break; }
  await send.click();
  let t = '';
  for (let i = 0; i < 35; i++) { await p.waitForTimeout(4000); t = await p.evaluate(() => document.body.innerText); if (/SYSTEM REVIEW/i.test(t)) break; }
  check('I-signed-out-assessment', /SYSTEM REVIEW/i.test(t));
  check('J-no-page-errors-signedout', errors.length === 0, errors[0] ?? '');
  await p.close();
}

await b.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length === 0 ? 'SMOKE: ALL PASS' : `SMOKE: ${failed.length} FAILURES`);
process.exit(failed.length === 0 ? 0 : 1);
