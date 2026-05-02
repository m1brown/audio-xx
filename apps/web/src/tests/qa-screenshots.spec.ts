/**
 * Audio XX — QA Screenshot Pass
 *
 * Captures screenshots of key user flows for visual QA:
 *   00  Landing page (baseline, no interaction)
 *   01  System Assessment (Chord Hugo -> JOB Integrated -> WLM Diva)
 *   02  Upgrade Intent
 *   03  Shopping Intent (Best DAC under $2000)
 *   04  Comparison (Hegel H190 vs Kinki EX-M1)
 *   05  Console Error Audit
 *
 * Also produces:
 *   - Console summary of image coverage per flow
 *   - JSON report at qa-screenshots/image-coverage-report.json
 *   - Broken-image log with alt text and nearby product name
 *
 * Prerequisites:
 *   - Dev server running on http://localhost:3000
 *   - Playwright browsers installed: npx playwright install chromium
 *
 * Run:
 *   cd apps/web
 *   npx playwright test src/tests/qa-screenshots.spec.ts
 */

import { test, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// ── Constants ────────────────────────────────────────────

const SCREENSHOT_DIR = path.resolve(__dirname, '../../qa-screenshots');
const REPORT_PATH = path.join(SCREENSHOT_DIR, 'image-coverage-report.json');

/** Max time (ms) to wait for the assistant response to finish. */
const RESPONSE_TIMEOUT = 90_000;

/** Quiet period (ms) — if no DOM mutations for this long, response is considered stable. */
const STABILIZATION_MS = 2_500;

/** Accumulated coverage data written to JSON at the end. */
const coverageReport: Record<string, { rendered: number; broken: number; missing: number }> = {};

// ── Helpers ──────────────────────────────────────────────

/** Ensure the output directory exists. */
function ensureDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

/** Type text into #audio-input and submit. */
async function submitPrompt(page: Page, text: string) {
  const textarea = page.locator('#audio-input');
  await textarea.waitFor({ state: 'visible', timeout: 10_000 });
  await textarea.fill(text);
  // Let React state settle
  await page.waitForTimeout(300);

  // Click Send button (text changes to "Thinking..." while loading)
  const sendButton = page.locator('button').filter({ hasText: /^Send$/ });
  if ((await sendButton.count()) > 0) {
    await sendButton.click();
  } else {
    // Fallback: press Enter
    await textarea.press('Enter');
  }
}

/**
 * Wait for the assistant response to fully render.
 *
 * Strategy:
 *   1. Wait for the "Thinking..." indicator to appear (confirms request was sent).
 *   2. Wait for "Thinking..." to disappear (response is arriving).
 *   3. Wait for DOM stability — no mutations for STABILIZATION_MS.
 *   4. Extra settle for images / lazy layout.
 */
async function waitForResponse(page: Page) {
  // 1. Wait for loading state (button text changes to "Thinking...")
  try {
    await page.locator('button').filter({ hasText: /Thinking/ }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });
  } catch {
    // May have already started and finished — continue
  }

  // 2. Wait for loading to finish (button returns to "Send")
  try {
    await page.locator('button').filter({ hasText: /^Send$/ }).waitFor({
      state: 'visible',
      timeout: RESPONSE_TIMEOUT,
    });
  } catch {
    console.log('  [warn] Timed out waiting for response to complete');
  }

  // 3. DOM stability check — wait until no mutations for STABILIZATION_MS
  try {
    await page.evaluate((quietMs: number) => {
      return new Promise<void>((resolve) => {
        let timer: ReturnType<typeof setTimeout>;
        const observer = new MutationObserver(() => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            observer.disconnect();
            resolve();
          }, quietMs);
        });
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
        });
        // Start the timer immediately in case DOM is already quiet
        timer = setTimeout(() => {
          observer.disconnect();
          resolve();
        }, quietMs);
      });
    }, STABILIZATION_MS);
  } catch {
    console.log('  [warn] DOM stability wait timed out');
  }

  // 4. Extra settle for images
  await page.waitForTimeout(1_500);
}

/** Scan all <img> elements and classify them. Returns summary stats. */
async function collectImageCoverage(
  page: Page,
  flowName: string,
): Promise<{ rendered: number; broken: number; missing: number }> {
  const report = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs.map((img) => {
      const src = img.src || img.getAttribute('src') || '';
      const alt = img.alt || '(no alt)';
      const naturalW = img.naturalWidth;
      const displayed = img.offsetWidth > 0 && img.offsetHeight > 0;
      const loaded = naturalW > 0;
      const hasSrc = src.length > 0;

      // Walk up to find the nearest product-card class or text container
      let context = '';
      let el: Element | null = img;
      for (let i = 0; i < 8 && el; i++) {
        el = el.parentElement;
        if (el?.classList?.contains('audioxx-product-card')) {
          const nameEl = el.querySelector('.audioxx-product-name');
          context = nameEl?.textContent?.trim() || el.textContent?.slice(0, 60)?.trim() || '';
          break;
        }
      }
      if (!context) {
        // Fallback: grab nearest heading or strong text
        let parent: Element | null = img;
        for (let i = 0; i < 5 && parent; i++) {
          parent = parent.parentElement;
          const heading = parent?.querySelector('h1, h2, h3, h4, strong');
          if (heading?.textContent) {
            context = heading.textContent.trim().slice(0, 60);
            break;
          }
        }
      }

      return { src, alt, naturalW, displayed, loaded, hasSrc, context };
    });
  });

  const rendered = report.filter((r) => r.loaded && r.displayed).length;
  const broken = report.filter((r) => r.hasSrc && !r.loaded).length;
  const missing = report.filter((r) => !r.hasSrc).length;

  // Console summary
  console.log(`\n  [${flowName}] Image Coverage`);
  console.log(`    rendered: ${rendered}`);
  console.log(`    broken:   ${broken}`);
  console.log(`    missing:  ${missing}`);

  // Log broken images with context
  for (const img of report.filter((r) => r.hasSrc && !r.loaded)) {
    const label = img.context || img.alt;
    console.log(`    [IMAGE_BROKEN] "${label}" src="${img.src.slice(0, 120)}"`);
  }
  for (const img of report.filter((r) => !r.hasSrc)) {
    const label = img.context || img.alt;
    console.log(`    [IMAGE_MISSING] "${label}" (no src attribute)`);
  }

  // Store for JSON report
  coverageReport[flowName] = { rendered, broken, missing };

  return { rendered, broken, missing };
}

/** Take a screenshot — never throws. */
async function safeScreenshot(
  page: Page,
  filename: string,
  opts: { fullPage?: boolean } = { fullPage: true },
) {
  try {
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, filename),
      fullPage: opts.fullPage ?? true,
    });
    console.log(`    [ok] ${filename}`);
  } catch (err) {
    console.log(`    [FAIL] ${filename}: ${(err as Error).message?.slice(0, 120)}`);
  }
}

/** Try to screenshot product cards area if present. */
async function screenshotCards(page: Page, prefix: string) {
  const cards = page.locator('.audioxx-product-card');
  const count = await cards.count();
  if (count === 0) {
    console.log(`    [skip] No .audioxx-product-card elements found`);
    return;
  }
  console.log(`    Found ${count} product card(s)`);

  // Screenshot the first card
  try {
    await cards.first().screenshot({
      path: path.join(SCREENSHOT_DIR, `${prefix}-card-first.png`),
    });
    console.log(`    [ok] ${prefix}-card-first.png`);
  } catch (err) {
    console.log(`    [skip] Could not screenshot first card: ${(err as Error).message?.slice(0, 80)}`);
  }

  // Scroll to cards area and take viewport shot
  try {
    await cards.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await safeScreenshot(page, `${prefix}-cards-viewport.png`, { fullPage: false });
  } catch {
    // non-critical
  }
}

// ── Setup ────────────────────────────────────────────────

test.beforeAll(() => {
  ensureDir();
  console.log(`\n  Screenshots will be saved to: ${SCREENSHOT_DIR}\n`);
});

test.afterAll(() => {
  // Write the accumulated coverage report
  try {
    fs.writeFileSync(REPORT_PATH, JSON.stringify(coverageReport, null, 2));
    console.log(`\n  Coverage report written to: ${REPORT_PATH}`);
  } catch (err) {
    console.log(`  [FAIL] Could not write coverage report: ${(err as Error).message}`);
  }

  // Final summary
  console.log('\n  ═══ QA Summary ═══');
  let totalBroken = 0;
  let totalMissing = 0;
  for (const [flow, stats] of Object.entries(coverageReport)) {
    const status =
      stats.broken === 0 && stats.missing === 0 ? 'CLEAN' : 'ISSUES';
    console.log(
      `    ${flow}: ${stats.rendered} rendered, ${stats.broken} broken, ${stats.missing} missing  [${status}]`,
    );
    totalBroken += stats.broken;
    totalMissing += stats.missing;
  }
  if (totalBroken === 0 && totalMissing === 0) {
    console.log('  Overall: CLEAN');
  } else {
    console.log(`  Overall: ${totalBroken} broken, ${totalMissing} missing — review screenshots`);
  }
});

// ══════════════════════════════════════════════════════════
// 00 — Landing Page (baseline)
// ══════════════════════════════════════════════════════════

test('00 — Landing Page', async ({ page }) => {
  console.log('\n═══ 00: Landing Page ═══');

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2_000);

  await safeScreenshot(page, '00-landing-page.png');
  await collectImageCoverage(page, 'landing-page');
});

// ══════════════════════════════════════════════════════════
// 01 — System Assessment
// ══════════════════════════════════════════════════════════

test('01 — System Assessment', async ({ page }) => {
  console.log('\n═══ 01: System Assessment ═══');

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2_000);

  await submitPrompt(
    page,
    'Evaluate my system: Chord Hugo → JOB Integrated → WLM Diva',
  );
  console.log('  Submitted assessment prompt');

  await waitForResponse(page);

  // Full page
  await safeScreenshot(page, '01-system-assessment-full.png');

  // Viewport (above the fold)
  await safeScreenshot(page, '01-system-assessment-viewport.png', { fullPage: false });

  // Product cards
  await screenshotCards(page, '01-system-assessment');

  // Scroll to bottom
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await safeScreenshot(page, '01-system-assessment-bottom.png', { fullPage: false });

  await collectImageCoverage(page, 'system-assessment');
});

// ══════════════════════════════════════════════════════════
// 02 — Upgrade Intent
// ══════════════════════════════════════════════════════════

test('02 — Upgrade Intent', async ({ page }) => {
  console.log('\n═══ 02: Upgrade Intent ═══');

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2_000);

  // First establish a system
  await submitPrompt(
    page,
    'Assess my system: Schiit Bifrost 2/64 → Schiit Ragnarok → KEF R3',
  );
  await waitForResponse(page);

  await safeScreenshot(page, '02-upgrade-initial-assessment.png');

  // Now ask to upgrade
  await submitPrompt(page, 'I want to improve my system');
  await waitForResponse(page);

  await safeScreenshot(page, '02-upgrade-intent-full.png');
  await safeScreenshot(page, '02-upgrade-intent-viewport.png', { fullPage: false });
  await screenshotCards(page, '02-upgrade-intent');

  await collectImageCoverage(page, 'upgrade-intent');
});

// ══════════════════════════════════════════════════════════
// 03 — Shopping Intent
// ══════════════════════════════════════════════════════════

test('03 — Shopping Intent', async ({ page }) => {
  console.log('\n═══ 03: Shopping Intent ═══');

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2_000);

  await submitPrompt(page, 'Best DAC under $2000 for a warm system');
  await waitForResponse(page);

  await safeScreenshot(page, '03-shopping-intent-full.png');
  await safeScreenshot(page, '03-shopping-intent-viewport.png', { fullPage: false });
  await screenshotCards(page, '03-shopping-intent');

  await collectImageCoverage(page, 'shopping-intent');
});

// ══════════════════════════════════════════════════════════
// 04 — Comparison
// ══════════════════════════════════════════════════════════

test('04 — Comparison', async ({ page }) => {
  console.log('\n═══ 04: Comparison ═══');

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2_000);

  await submitPrompt(page, 'Compare Hegel H190 vs Kinki EX-M1');
  await waitForResponse(page);

  await safeScreenshot(page, '04-comparison-full.png');
  await safeScreenshot(page, '04-comparison-viewport.png', { fullPage: false });
  await screenshotCards(page, '04-comparison');

  await collectImageCoverage(page, 'comparison');
});

// ══════════════════════════════════════════════════════════
// 05 — Console Error Audit (final pass)
// ══════════════════════════════════════════════════════════

test('05 — Console Error Audit', async ({ page }) => {
  console.log('\n═══ 05: Console Error Audit ═══');

  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(`PAGE ERROR: ${err.message}`);
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2_000);

  await submitPrompt(
    page,
    'Assess my system: Chord Qutest → Pass Labs INT-25 → DeVore O/96',
  );
  await waitForResponse(page);

  // Screenshot
  await safeScreenshot(page, '05-console-audit-full.png');

  // Report
  console.log(`\n  Console errors: ${consoleErrors.length}`);
  for (const err of consoleErrors.slice(0, 15)) {
    console.log(`    [error] ${err.slice(0, 200)}`);
  }

  console.log(`  Console warnings: ${consoleWarnings.length}`);
  for (const warn of consoleWarnings.slice(0, 10)) {
    console.log(`    [warn] ${warn.slice(0, 200)}`);
  }

  await collectImageCoverage(page, 'console-audit');
});
