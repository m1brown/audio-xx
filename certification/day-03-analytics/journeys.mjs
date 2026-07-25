/**
 * Gate 3 — controlled funnel journeys with a vendor-call trap.
 *
 * Each journey runs in a FRESH Playwright context (fresh session). An
 * init script traps window.va before any page code runs, so mount-time
 * events are captured with full payloads regardless of when the vendor
 * script loads. Streams are collected via an exposed binding that
 * survives navigations.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = 'http://localhost:3000';
const PASS = 'journey-m5-pass';
const results = {};

const TRAP = `
  (() => {
    let real = null;
    const wrapper = (...args) => {
      try { window.__vaPush(JSON.parse(JSON.stringify(args))); } catch { window.__vaPush(['unserializable']); }
      if (window.__vaThrow) throw new Error('simulated analytics vendor failure');
      if (real) try { real(...args); } catch {}
    };
    Object.defineProperty(window, 'va', {
      configurable: true,
      get() { return wrapper; },
      // In vendor-failure mode the vendor script's replacement is
      // discarded, so the only throws happen synchronously inside
      // product call paths (what track() must survive) — never inside
      // the vendor's own async queue flush (which would only trip the
      // dev overlay, not the product).
      set(v) { if (!window.__vaThrow) real = v; },
    });
    window.print = () => { window.__vaPush(['__window_print_called']); };
    if (navigator.clipboard) {
      const orig = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = (t) => { window.__vaPush(['__clipboard_write', String(t).slice(0, 120)]); return orig(t).catch(() => {}); };
    }
  })();
`;

async function newJourney(browser, name, { vaThrow = false } = {}) {
  const context = await browser.newContext();
  const stream = [];
  await context.exposeBinding('__vaPush', (_source, args) => stream.push(args));
  await context.addInitScript(TRAP + (vaThrow ? 'window.__vaThrow = true;' : ''));
  const page = await context.newPage();
  results[name] = stream;
  return { context, page, stream };
}

async function signIn(page, email) {
  await page.goto(`${BASE}/auth/signin`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
}

// The artifact actions bar is animation/visibility-gated, so DOM-level
// dispatch is used (same handler path as a user click).
async function clickAction(page, selector) {
  await page.evaluate((sel) => {
    let el = null;
    if (sel.startsWith('[')) el = document.querySelector(sel);
    else {
      const m = sel.match(/has-text\("(.+)"\)/);
      const txt = m ? m[1] : sel;
      el = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(txt));
    }
    if (!el) throw new Error('clickAction: not found ' + sel);
    el.click();
  }, selector);
}

async function fillBuilder(page, dac, amp, spk) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('input[placeholder*="Denafrips"]', { timeout: 60000 });
  for (const [ph, val] of [['Denafrips', dac], ['Leben', amp], ['KEF R3', spk]]) {
    const input = page.locator(`input[placeholder*="${ph}"]`);
    await input.click();
    await input.pressSequentially(val, { delay: 15 });
    await page.click('text=BEGIN HERE'); // dismiss suggestion dropdown harmlessly
    await page.waitForTimeout(150);
  }
  await page.waitForFunction(
    () => { const b = document.querySelector('[data-testid="read-assessment"]'); return b && !b.disabled; },
    undefined,
    { timeout: 20000 },
  );
  await clickAction(page, '[data-testid="read-assessment"]');
  await page.waitForURL('**/artifact**', { timeout: 30000 });
  await page.waitForSelector('[data-testid="copy-link"]', { state: 'attached', timeout: 30000 });
}


async function gotoArtifact(page, systemText) {
  const u = `${BASE}/artifact?system=${encodeURIComponent('Assess my system: ' + systemText)}`;
  await page.goto(u, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForSelector('[data-testid="copy-link"]', { state: 'attached', timeout: 60000 });
  await page.waitForTimeout(1500); // hydration cushion — clicks must hit live handlers
}

const browser = await chromium.launch();

// ── J1: anonymous builder → artifact → copy → print → save ────────────
{
  const { context, page } = await newJourney(browser, 'J1_anonymous_builder');
  await fillBuilder(page, 'Chord Qutest', 'Naim SuperNait 3', 'Harbeth Super HL5 Plus');
  await clickAction(page, '[data-testid="copy-link"]');
  await page.waitForTimeout(400);
  await clickAction(page, 'button:has-text("Print")');
  await page.waitForTimeout(400);
  await clickAction(page, 'button:has-text("Save this system")');
  await page.waitForTimeout(2000); // anonymous → redirected to /save sign-in
  results.J1_finalUrl = page.url();
  await context.close();
}

// ── J2: anonymous composer → embedded assessment ──────────────────────
{
  const { context, page } = await newJourney(browser, 'J2_anonymous_composer');
  await page.goto(`${BASE}/`);
  await page.waitForSelector('textarea', { timeout: 30000 });
  await page.fill('textarea', 'Assess my system: Bluesound Node, Rega Brio, KEF LS50 Meta');
  await page.click('button:has-text("Send")');
  await page.waitForSelector('text=SYSTEM ASSESSMENT', { timeout: 90000 });
  await page.waitForTimeout(1500);
  await context.close();
}

// ── J3: signed-in save lifecycle (fresh trial user, empty collection) ─
{
  const { context, page } = await newJourney(browser, 'J3_save_lifecycle');
  await signIn(page, 'm5-trial@example.com');
  // First save (direct artifact URL — builder mechanics are J1's scope)
  await gotoArtifact(page, 'Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus');
  await clickAction(page, 'button:has-text("Save this system")');
  await page.waitForTimeout(2500);
  // Second, different system
  await gotoArtifact(page, 'Bluesound Node, Rega Brio, KEF LS50 Meta');
  await clickAction(page, 'button:has-text("Save this system")');
  await page.waitForTimeout(2500);
  // Same system again → identical assessment declined
  await page.reload();
  await page.waitForSelector('[data-testid="copy-link"]', { state: 'attached', timeout: 60000 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Add today|Save this system/.test(x.textContent));
    if (!b) throw new Error('no save/add button after reload');
    b.click();
  });
  await page.waitForTimeout(2500);
  // My Systems
  await page.goto(`${BASE}/systems`);
  await page.waitForTimeout(2500);
  await context.close();
}

// ── J4: expired-boundary → prompt → blocked → checkout → cancelled ────
{
  const { context, page } = await newJourney(browser, 'J4_boundary');
  await signIn(page, 'cert-boundary@example.com');
  await page.goto(`${BASE}/systems`);
  await page.waitForSelector('text=Your collection is still here', { timeout: 30000 });
  await page.waitForTimeout(1000);
  // Blocked save attempt from an artifact
  await gotoArtifact(page, 'Chord Qutest, Naim SuperNait 3, KEF R3');
  await clickAction(page, 'button:has-text("Save this system")');
  await page.waitForTimeout(2500);
  // Subscribe → checkout_started (allow the Stripe redirect, then return via cancel URL)
  const sub = page.locator('button:has-text("Subscribe")').first();
  if (await sub.count()) {
    await clickAction(page, 'button:has-text("Subscribe")');
    await page.waitForURL('**checkout.stripe.com**', { timeout: 30000 }).catch(() => {});
  }
  await page.goto(`${BASE}/account?checkout=cancelled`);
  await page.waitForTimeout(2500);
  await context.close();
}

// ── J5: dedupe — reload = new page load (view events re-fire once) ────
{
  const { context, page } = await newJourney(browser, 'J5_dedupe_reload');
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(2500);
  await page.reload();
  await page.waitForTimeout(2500);
  await context.close();
}

// ── J6: vendor failure — product must remain fully usable ─────────────
{
  // Realistic vendor failure: the analytics script and ingestion
  // endpoints are unreachable (offline vendor). The product must be
  // fully usable; events simply queue and go nowhere.
  const { context, page } = await newJourney(browser, 'J6_vendor_failure');
  await context.route('**va.vercel-scripts.com/**', (r) => r.abort());
  await context.route('**/_vercel/insights/**', (r) => r.abort());
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  await gotoArtifact(page, 'Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus');
  const verdict = await page.locator('h1').first().textContent();
  await clickAction(page, '[data-testid="copy-link"]');
  await page.waitForTimeout(500);
  const copied = await page.locator('text=Link copied').count();
  results.J6_assertions = { verdictRendered: Boolean(verdict && verdict.length > 3), copyFeedback: copied > 0, pageErrors: errors };
  await context.close();
}

await browser.close();
writeFileSync(new URL('./journey-streams.json', import.meta.url), JSON.stringify(results, null, 1));
console.log('done — journeys captured');
