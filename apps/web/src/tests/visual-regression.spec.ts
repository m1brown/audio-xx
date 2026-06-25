/**
 * Audio XXI — Visual regression (Tier B of the automated QA workflow).
 *
 * Drives every fixture in src/qa/fixtures.ts through the live chat UI and
 * pixel-diffs the rendered System Assessment against a committed PNG baseline.
 * This is the layout/visual safety net that complements the deterministic
 * engine-text tier (scripts/qa-regression.mts): the engine tier proves the
 * CONTENT is unchanged; this proves the content still RENDERS without breakage.
 *
 * Reuses the submit/stabilize pattern from consultation-validation.spec.ts.
 * The A3 Character overlay is disabled (config webServer env) so the capture is
 * the deterministic engine render.
 *
 * Run from repo root:  npm run qa:regress:visual
 * Adopt intended UI:   npm run qa:regress:visual -- --update-snapshots
 */
import { test, expect, type Page } from '@playwright/test';
import { QA_FIXTURES } from '../qa/fixtures';

const RESPONSE_TIMEOUT = 90_000;
const STABILIZATION_MS = 2_500;
const SUBMISSION_DETECT_TIMEOUT = 4_000;
const MIN_VALID_BODY_LEN = 1500;

async function submitPrompt(page: Page, text: string) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const textarea = page.locator('#audio-input');
    await textarea.waitFor({ state: 'visible', timeout: 10_000 });
    await textarea.click();
    await textarea.fill(text);
    const sendButton = page.locator('button').filter({ hasText: /^Send$/ });
    const deadline = Date.now() + 8_000;
    let clicked = false;
    while (Date.now() < deadline) {
      if ((await sendButton.count()) > 0 && !(await sendButton.first().isDisabled().catch(() => true))) {
        try { await sendButton.first().click({ timeout: 2_000 }); clicked = true; break; } catch { /* race */ }
      }
      await page.waitForTimeout(250);
    }
    if (!clicked) await textarea.press('Enter');
    const accepted = await Promise.race([
      page.locator('button').filter({ hasText: /Thinking/ })
        .waitFor({ state: 'visible', timeout: SUBMISSION_DETECT_TIMEOUT }).then(() => true).catch(() => false),
      page.waitForFunction(() => {
        const el = document.querySelector('#audio-input') as HTMLTextAreaElement | null;
        return !!(el && el.value.trim() === '');
      }, null, { timeout: SUBMISSION_DETECT_TIMEOUT }).then(() => true).catch(() => false),
    ]);
    if (accepted) return;
  }
  throw new Error(`submitPrompt: submission appears to have failed — ${JSON.stringify(text)}`);
}

async function waitForResponse(page: Page) {
  try {
    await page.locator('button').filter({ hasText: /Thinking/ }).waitFor({ state: 'visible', timeout: 5_000 });
  } catch { /* already past */ }
  try {
    await page.locator('button').filter({ hasText: /^Send$/ }).waitFor({ state: 'visible', timeout: RESPONSE_TIMEOUT });
  } catch { /* take whatever's there */ }
  try {
    await page.evaluate((quietMs: number) => new Promise<void>((resolve) => {
      let timer: ReturnType<typeof setTimeout>;
      const obs = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => { obs.disconnect(); resolve(); }, quietMs);
      });
      obs.observe(document.body, { childList: true, subtree: true, characterData: true });
      timer = setTimeout(() => { obs.disconnect(); resolve(); }, quietMs);
    }), STABILIZATION_MS);
  } catch { /* continue */ }
  await page.waitForTimeout(500);
}

test.describe('Audio XXI — visual regression', () => {
  // Homepage shell — a major page in its own right.
  test('homepage', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('#audio-input').waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForTimeout(1_000);
    await expect(page).toHaveScreenshot('homepage.png', { fullPage: true });
  });

  for (const fx of QA_FIXTURES) {
    test(fx.id, async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.locator('#audio-input').waitFor({ state: 'visible', timeout: 30_000 });
      await page.waitForTimeout(1_000);

      await submitPrompt(page, fx.systemText);
      await waitForResponse(page);

      const bodyLen = await page.evaluate(() => document.body.innerText.length);
      expect(bodyLen, `assessment did not render for ${fx.id}`).toBeGreaterThan(MIN_VALID_BODY_LEN);

      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot(`${fx.id}.png`, { fullPage: true });
    });
  }
});
