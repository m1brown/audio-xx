/**
 * Cross-brand leakage check — manufacturer-query Subject Card.
 *
 * For each of the 11 brand inquiries identified in the 2026-05-21
 * audit as either previously-leaking or at risk of leaking, type the
 * brand name into the live composer, submit, and capture:
 *
 *   - the rendered Subject Card hero image src (if any)
 *   - all image sources on the rendered response
 *   - a fullPage screenshot per brand
 *   - whether any non-target brand surfaced as the hero image
 *
 * Outputs land in audit-2026-05-21/manufacturer-integrity/cross-brand-check/.
 * Read-only — no application code touched.
 */

import { test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const APPS_WEB_ROOT = path.resolve(__dirname, '..', '..');
const REPO_ROOT = path.resolve(APPS_WEB_ROOT, '..', '..');
const OUT_DIR = path.join(
  REPO_ROOT,
  'audit-2026-05-21',
  'manufacturer-integrity',
  'cross-brand-check',
);
fs.mkdirSync(OUT_DIR, { recursive: true });

interface BrandCase {
  query: string;
  expectedBrand: string;          // surface-form
  mustNotSurface: string[];       // brands that, if surfaced, indicate a leak
}

const CASES: BrandCase[] = [
  { query: 'shindo',       expectedBrand: 'Shindo',     mustNotSurface: ['devore'] },
  { query: 'leben',        expectedBrand: 'Leben',      mustNotSurface: ['devore'] },
  { query: 'accuphase',    expectedBrand: 'Accuphase',  mustNotSurface: ['devore', 'leben'] },
  { query: 'goldmund',     expectedBrand: 'Goldmund',   mustNotSurface: ['devore'] },
  { query: 'boenicke',     expectedBrand: 'Boenicke',   mustNotSurface: ['hegel'] },
  { query: 'job',          expectedBrand: 'Job',        mustNotSurface: ['devore', 'rega', 'wlm'] },
  { query: 'denafrips',    expectedBrand: 'Denafrips',  mustNotSurface: ['pass', 'topping', 'benchmark'] },
  { query: 'kef',          expectedBrand: 'KEF',        mustNotSurface: ['naim', 'hegel'] },
  { query: 'hegel',        expectedBrand: 'Hegel',     mustNotSurface: ['kef'] },
  { query: 'kinki studio', expectedBrand: 'Kinki',      mustNotSurface: ['kef'] },
  { query: 'mola mola',    expectedBrand: 'Mola Mola',  mustNotSurface: ['devore', 'shindo', 'harbeth'] },
];

interface Probe {
  query: string;
  expectedBrand: string;
  httpStatus: number | null;
  heroImageSrc: string | null;
  heroAltOrCaption: string | null;
  heroImageHost: string | null;
  allImageSrcs: string[];
  proseFirst600: string;
  leakedBrand: string | null;
  screenshotRel: string;
}

async function probeBrand(page: Page, kase: BrandCase): Promise<Probe> {
  const resp = await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 }).catch(() => null);
  const httpStatus = resp?.status() ?? null;
  await page.waitForTimeout(800);

  // Submit query via real keyboard so React state updates.
  const textarea = page.locator('#audio-input');
  await textarea.waitFor({ state: 'visible' });
  await textarea.click();
  await textarea.fill(kase.query);
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');

  // Wait for response. The Send button text returns to "Send" after
  // the response renders; while loading it reads "Thinking…".
  try {
    await page.locator('button', { hasText: /Thinking/ }).waitFor({ state: 'visible', timeout: 5_000 });
  } catch { /* may already have rendered */ }
  try {
    await page.locator('button', { hasText: /^Send$|^Evaluate listing$/ }).first().waitFor({ state: 'visible', timeout: 30_000 });
  } catch { /* tolerated */ }

  // Settle for images.
  await page.waitForTimeout(2_500);

  const diag = await page.evaluate(() => {
    const imgs = Array.from(document.images);
    // The Subject Card is the FIRST <img> within the assistant
    // response area that resolves to a real (non-placeholder) image.
    // Reliable heuristic: first <img> whose container is not in the
    // top nav or composer area. Pick the first image whose
    // boundingClientRect has y > 80 (past the nav).
    const responseImgs = imgs.filter((img) => {
      const r = img.getBoundingClientRect();
      return r.top > 80;
    });
    const hero = responseImgs[0];
    return {
      heroImageSrc: hero?.src ?? null,
      heroAlt: hero?.alt ?? null,
      heroCaption:
        hero?.closest('figure')?.querySelector('figcaption')?.textContent ??
        hero?.parentElement?.parentElement?.querySelector('div, span')?.textContent ?? null,
      allImageSrcs: imgs.map((i) => i.src),
      proseFirst600: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 600),
    };
  });

  let heroHost: string | null = null;
  try {
    if (diag.heroImageSrc) heroHost = new URL(diag.heroImageSrc).host;
  } catch { /* ignore */ }

  const lowerCombined = [
    diag.heroImageSrc ?? '',
    diag.heroAlt ?? '',
    diag.heroCaption ?? '',
  ].join(' ').toLowerCase();
  const leak = kase.mustNotSurface.find((b) => lowerCombined.includes(b.toLowerCase()));

  const screenshotFile = `${kase.query.replace(/\s+/g, '-')}.png`;
  const screenshotPath = path.join(OUT_DIR, screenshotFile);
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch { /* tolerated */ }

  return {
    query: kase.query,
    expectedBrand: kase.expectedBrand,
    httpStatus,
    heroImageSrc: diag.heroImageSrc,
    heroAltOrCaption: diag.heroAlt ?? diag.heroCaption ?? null,
    heroImageHost: heroHost,
    allImageSrcs: diag.allImageSrcs,
    proseFirst600: diag.proseFirst600,
    leakedBrand: leak ?? null,
    screenshotRel: path.relative(REPO_ROOT, screenshotPath),
  };
}

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 1440, height: 1024 } });

for (const kase of CASES) {
  test(`cross-brand check: query "${kase.query}" → Subject Card`, async ({ page }) => {
    test.setTimeout(90_000);
    const probe = await probeBrand(page, kase);
    fs.writeFileSync(
      path.join(OUT_DIR, `${kase.query.replace(/\s+/g, '-')}.json`),
      JSON.stringify(probe, null, 2),
    );
    // Soft assertion — log rather than fail so all 11 cases capture
    // regardless of any one leaking. The summary script reports.
    if (probe.leakedBrand) {
      console.log(
        `[LEAK] query=${kase.query}  hero=${probe.heroImageSrc}  leaked=${probe.leakedBrand}`,
      );
    }
  });
}
