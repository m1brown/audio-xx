/**
 * D1 mobile QA — screenshot capture only (diagnose pass, no fixes).
 *
 * Runs the 8 beta-relevant surfaces at three common mobile viewports
 * (360 / 390 / 414) and an optional tablet (768). Each (viewport, surface)
 * combination is saved to apps/web/qa-screenshots/mobile/ with a
 * deterministic filename. No assertions — visual diagnosis only.
 *
 * NOTE: this spec is part of the D1 diagnose pass. It is intentionally
 * separate from qa-screenshots.spec.ts (desktop) so the desktop harness
 * is unchanged. If the inventory is acted on, this spec stays as the
 * regression harness for mobile.
 */

import { test, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.resolve(__dirname, '../../qa-screenshots/mobile');
const RESPONSE_TIMEOUT = 90_000;
const STABILIZATION_MS = 2_000;

interface Viewport {
  label: string;
  width: number;
  height: number;
}

const VIEWPORTS: Viewport[] = [
  { label: '360w', width: 360, height: 780 },
  { label: '390w', width: 390, height: 844 }, // iPhone 14
  { label: '414w', width: 414, height: 896 }, // iPhone 11 Pro Max
  { label: '768w-tablet', width: 768, height: 1024 }, // iPad mini portrait
];

function ensureDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function safeShot(page: Page, filename: string, fullPage = true) {
  try {
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage });
    console.log(`    [ok] ${filename}`);
  } catch (err) {
    console.log(`    [FAIL] ${filename}: ${(err as Error).message?.slice(0, 120)}`);
  }
}

async function submitPrompt(page: Page, text: string) {
  const textarea = page.locator('#audio-input');
  await textarea.waitFor({ state: 'visible', timeout: 10_000 });
  await textarea.fill(text);
  await page.waitForTimeout(300);
  const sendButton = page.locator('button').filter({ hasText: /^Send$/ });
  if ((await sendButton.count()) > 0) await sendButton.click();
  else await textarea.press('Enter');
}

async function waitForResponse(page: Page) {
  try {
    await page.locator('button').filter({ hasText: /Thinking/ }).waitFor({ state: 'visible', timeout: 5_000 });
  } catch { /* may have already started */ }
  try {
    await page.locator('button').filter({ hasText: /^Send$/ }).waitFor({ state: 'visible', timeout: RESPONSE_TIMEOUT });
  } catch { /* timeout — still capture what we have */ }
  try {
    await page.evaluate((quietMs: number) =>
      new Promise<void>((resolve) => {
        let timer: ReturnType<typeof setTimeout>;
        const obs = new MutationObserver(() => {
          clearTimeout(timer);
          timer = setTimeout(() => { obs.disconnect(); resolve(); }, quietMs);
        });
        obs.observe(document.body, { childList: true, subtree: true, characterData: true });
        timer = setTimeout(() => { obs.disconnect(); resolve(); }, quietMs);
      }), STABILIZATION_MS);
  } catch { /* tolerated */ }
  await page.waitForTimeout(1_000);
}

async function setMobile(page: Page, vp: Viewport) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
}

async function checkOverflow(page: Page, label: string): Promise<{ scrollWidth: number; clientWidth: number; overflowX: boolean }> {
  return await page.evaluate(() => {
    const sw = document.documentElement.scrollWidth;
    const cw = document.documentElement.clientWidth;
    return { scrollWidth: sw, clientWidth: cw, overflowX: sw > cw + 1 };
  }).then((r) => {
    if (r.overflowX) console.log(`    [OVERFLOW] ${label}: scrollWidth=${r.scrollWidth} clientWidth=${r.clientWidth}`);
    return r;
  });
}

test.beforeAll(() => {
  ensureDir();
  console.log(`\n  Mobile screenshots will be saved to: ${SCREENSHOT_DIR}\n`);
});

// One test per viewport — each walks all 8 surfaces sequentially.
// Per-viewport isolation keeps a hung surface from aborting the others.

for (const vp of VIEWPORTS) {
  test(`Mobile QA @ ${vp.label} (${vp.width}×${vp.height})`, async ({ page }) => {
    test.setTimeout(300_000); // 5 min per viewport — multiple LLM-backed turns
    await setMobile(page, vp);
    const prefix = `mobile-${vp.label}`;

    // ── Surface 1: Homepage / initial advisory prompt state ──
    console.log(`\n═══ ${vp.label}: 01-homepage ═══`);
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2_000);
    await safeShot(page, `${prefix}-01-homepage-full.png`, true);
    await safeShot(page, `${prefix}-01-homepage-viewport.png`, false);
    await checkOverflow(page, `${prefix}-01-homepage`);

    // ── Surface 2: System assessment response ──
    console.log(`\n═══ ${vp.label}: 02-system-assessment ═══`);
    await submitPrompt(page, 'Evaluate my system: Chord Hugo → JOB Integrated → WLM Diva');
    await waitForResponse(page);
    await safeShot(page, `${prefix}-02-assessment-full.png`, true);
    await safeShot(page, `${prefix}-02-assessment-viewport.png`, false);
    await checkOverflow(page, `${prefix}-02-assessment`);

    // ── Surface 3: Product cards (if surfaced) ──
    console.log(`\n═══ ${vp.label}: 03-product-cards ═══`);
    const cards = page.locator('.audioxx-product-card');
    const cardCount = await cards.count();
    console.log(`    Found ${cardCount} product card(s)`);
    if (cardCount > 0) {
      try {
        await cards.first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await safeShot(page, `${prefix}-03-cards-viewport.png`, false);
        await cards.first().screenshot({ path: path.join(SCREENSHOT_DIR, `${prefix}-03-card-first.png`) });
      } catch (err) {
        console.log(`    [skip] card screenshot failed: ${(err as Error).message?.slice(0, 80)}`);
      }
    }

    // ── Surface 4: Follow-up continuity path (B1) ──
    console.log(`\n═══ ${vp.label}: 04-followup-continuity ═══`);
    // Establish a single-subject consultation first
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1_500);
    await submitPrompt(page, 'What do you think of Harbeth?');
    await waitForResponse(page);
    await safeShot(page, `${prefix}-04a-consultation.png`, true);
    // Then a general follow-up — the B1 path
    await submitPrompt(page, 'tell me more');
    await waitForResponse(page);
    await safeShot(page, `${prefix}-04b-general-followup.png`, true);
    await safeShot(page, `${prefix}-04b-general-followup-viewport.png`, false);
    await checkOverflow(page, `${prefix}-04-followup`);

    // ── Surface 5: Unknown-product fallback (C1) ──
    console.log(`\n═══ ${vp.label}: 05-unknown-product ═══`);
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1_500);
    await submitPrompt(page, 'tell me about the Foobar Audio 9000');
    await waitForResponse(page);
    await safeShot(page, `${prefix}-05-unknown-product-full.png`, true);
    await safeShot(page, `${prefix}-05-unknown-product-viewport.png`, false);
    await checkOverflow(page, `${prefix}-05-unknown-product`);

    // ── Surface 6: Non-advisory bypass (C2) ──
    console.log(`\n═══ ${vp.label}: 06-non-advisory-bypass ═══`);
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1_500);
    // Mid-session greeting (start a turn first, then greet)
    await submitPrompt(page, 'What do you think of Harbeth?');
    await waitForResponse(page);
    await submitPrompt(page, 'hi');
    await waitForResponse(page);
    await safeShot(page, `${prefix}-06a-greeting-mid-session.png`, true);
    // Knowledge question
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1_500);
    await submitPrompt(page, 'what is R2R?');
    await waitForResponse(page);
    await safeShot(page, `${prefix}-06b-knowledge.png`, true);
    await safeShot(page, `${prefix}-06b-knowledge-viewport.png`, false);
    await checkOverflow(page, `${prefix}-06-non-advisory`);

    // ── Surface 7: Listener preference panel after several turns ──
    console.log(`\n═══ ${vp.label}: 07-listener-panel ═══`);
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1_500);
    // Send 3 preference-bearing messages so the PB2.3 panel surfaces
    await submitPrompt(page, 'I love flow and timing in a system');
    await waitForResponse(page);
    await submitPrompt(page, 'detail fatigues me after a while');
    await waitForResponse(page);
    await submitPrompt(page, 'I want body and warmth, easier to listen to for hours');
    await waitForResponse(page);
    await safeShot(page, `${prefix}-07-listener-panel-full.png`, true);
    await safeShot(page, `${prefix}-07-listener-panel-viewport.png`, false);
    await checkOverflow(page, `${prefix}-07-listener-panel`);

    // ── Surface 8: Saved-system panel / prompt (if visible without auth) ──
    console.log(`\n═══ ${vp.label}: 08-saved-system ═══`);
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1_500);
    // Submit a system description so the save-system prompt may surface
    await submitPrompt(page, 'I have a Chord Hugo TT2, Pass Labs INT-25, and DeVore O/96 speakers');
    await waitForResponse(page);
    await safeShot(page, `${prefix}-08-saved-system-full.png`, true);
    await safeShot(page, `${prefix}-08-saved-system-viewport.png`, false);
    await checkOverflow(page, `${prefix}-08-saved-system`);

    console.log(`\n  ── ${vp.label} pass complete ──\n`);
  });
}
