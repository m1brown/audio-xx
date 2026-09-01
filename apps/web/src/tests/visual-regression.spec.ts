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

// ─────────────────────────────────────────────────────────────────────────────
// STABILIZATION GATE 1 — Gate C (artifact visual) + Gate D (homepage/builder UX)
//
// Gate C visual: the completed Assessment is a contractual artifact. One
// deterministic fixture page (/artifact?case=flawed) is pixel-baselined at
// desktop and mobile, and the three-axis Tonal Signature graph is asserted
// VISIBLE (computed styles, not just DOM presence) at both.
//
// Gate D: the homepage/builder audited as a first-time visitor at every
// required width. Structural invariants (no horizontal overflow, no clipped
// controls, builder + add-component + CTA discoverable) are asserted
// programmatically; a pixel baseline is captured per width.
// ─────────────────────────────────────────────────────────────────────────────

const ARTIFACT_VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

test.describe('Gate C — Assessment Artifact visual integrity', () => {
  for (const vp of ARTIFACT_VIEWPORTS) {
    test(`tonal signature graph visible + baseline (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/artifact?case=flawed', { waitUntil: 'networkidle' });
      await page.locator('.axa-sig').waitFor({ state: 'visible', timeout: 15_000 });

      // Exactly three axes; each track and dot actually painted (visible size).
      await expect(page.locator('.axa-axis')).toHaveCount(3);
      const metrics = await page.evaluate(() => {
        const tracks = [...document.querySelectorAll('.axa-track')];
        const dots = [...document.querySelectorAll('.axa-track i')];
        const vis = (el: Element) => {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
        };
        return {
          tracks: tracks.length, dots: dots.length,
          allTracksVisible: tracks.every(vis), allDotsVisible: dots.every(vis),
          dotPositions: dots.map((d) => (d as HTMLElement).style.left),
          noFourthAxis: !/\bAiry\b|\bClosed\b/.test(document.querySelector('.axa-sig')?.textContent ?? ''),
        };
      });
      expect(metrics.tracks).toBe(3);
      expect(metrics.dots).toBe(3);
      expect(metrics.allTracksVisible).toBe(true);
      expect(metrics.allDotsVisible).toBe(true);
      expect(metrics.noFourthAxis).toBe(true);
      for (const pos of metrics.dotPositions) expect(['24%', '50%', '78%']).toContain(pos);

      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot(`artifact-completed-${vp.name}.png`, { fullPage: true });
    });
  }
});

const UX_WIDTHS = [
  { width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 1024, height: 768 },
  { width: 320, height: 700 }, { width: 360, height: 740 }, { width: 390, height: 844 }, { width: 414, height: 896 },
];

test.describe('Gate D — homepage/builder integrity at required widths', () => {
  for (const vp of UX_WIDTHS) {
    test(`builder discoverable, no overflow/clip/blank (${vp.width}w)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.locator('#audio-input').waitFor({ state: 'visible', timeout: 30_000 });
      await page.waitForTimeout(500);

      const audit = await page.evaluate(() => {
        const q = (sel: string) => document.querySelector(sel);
        const findText = (txt: string) => [...document.querySelectorAll('button,div,p,span,a')]
          .find((e) => e.children.length < 4 && (e.textContent ?? '').trim().toUpperCase().includes(txt));
        // Clipped interactive controls (extend past either horizontal edge).
        const clipped = [...document.querySelectorAll('input,button,a,textarea')]
          .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1); })
          .map((e) => ((e as HTMLElement).innerText || (e as HTMLInputElement).placeholder || '').slice(0, 20));
        // Excessive blank regions: no gap over 300px between consecutive
        // content blocks above the footer (60vh artifact separator excluded —
        // it never appears pre-assessment).
        const blocks = [...document.querySelectorAll('main p, main h1, main label, main input, main textarea, main button, main ul')]
          .filter((e) => e.getBoundingClientRect().height > 0)
          .map((e) => ({ t: e.getBoundingClientRect().top + scrollY, b: e.getBoundingClientRect().bottom + scrollY }))
          .sort((a, b) => a.t - b.t);
        const merged: Array<{ t: number; b: number }> = [];
        for (const r of blocks) {
          if (merged.length && r.t <= merged[merged.length - 1].b + 60) merged[merged.length - 1].b = Math.max(merged[merged.length - 1].b, r.b);
          else merged.push({ ...r });
        }
        let maxGap = 0;
        for (let i = 1; i < merged.length; i++) maxGap = Math.max(maxGap, merged[i].t - merged[i - 1].b);
        return {
          overflowX: document.documentElement.scrollWidth > innerWidth,
          builderFieldCount: document.querySelectorAll('input[placeholder]').length,
          addComponentVisible: !!findText('ADD ANOTHER COMPONENT'),
          ctaPresent: !!findText('READ MY ASSESSMENT'),
          composerPresent: !!q('#audio-input'),
          clipped, maxGap: Math.round(maxGap),
        };
      });

      expect(audit.overflowX, 'no horizontal overflow').toBe(false);
      expect(audit.clipped, 'no clipped controls').toEqual([]);
      expect(audit.builderFieldCount, 'builder fields present').toBeGreaterThanOrEqual(3);
      expect(audit.addComponentVisible, 'add-component flow visible').toBe(true);
      expect(audit.ctaPresent, 'assess CTA present').toBe(true);
      expect(audit.composerPresent, 'free-text path present').toBe(true);
      expect(audit.maxGap, 'no excessive blank region').toBeLessThan(300);

      await expect(page).toHaveScreenshot(`homepage-${vp.width}w.png`, { fullPage: true });
    });
  }
});
