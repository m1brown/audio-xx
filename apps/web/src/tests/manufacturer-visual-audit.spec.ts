/**
 * Audio XX — Manufacturer Visual Audit (Phase 2).
 *
 * Visits every /brand/<slug> route at desktop (1440×1024) and mobile
 * (390×844 — iPhone 14 baseline). For each viewport per brand we:
 *
 *   - record console errors, page errors, and failed network requests
 *   - check for horizontal overflow (scrollWidth > clientWidth + 1)
 *   - detect broken hero images (img.naturalWidth === 0 OR img.complete && naturalWidth === 0)
 *   - count outbound links + classify by host
 *   - save fullPage screenshot
 *   - save per-brand JSON diagnostics sidecar
 *
 * Slugs are read from the Phase 1 audit JSON. Outputs land under
 * audit-2026-05-21/manufacturer-integrity/visual/{desktop,mobile}/.
 *
 * NO assertions that fail the run — this is a diagnose harness, not
 * a regression suite. Every (viewport × brand) records its findings
 * to disk regardless of state.
 *
 * Run from repo root via the existing Playwright config:
 *   cd apps/web
 *   npx playwright test src/tests/manufacturer-visual-audit.spec.ts
 *
 * Pre-req: dev server on http://localhost:3000 (Playwright config has
 * reuseExistingServer: true).
 */

import { test, type Page, type ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ── Paths ────────────────────────────────────────────────

const APPS_WEB_ROOT = path.resolve(__dirname, '..', '..');
const REPO_ROOT = path.resolve(APPS_WEB_ROOT, '..', '..');
const AUDIT_ROOT = path.join(REPO_ROOT, 'audit-2026-05-21', 'manufacturer-integrity');
const VISUAL_ROOT = path.join(AUDIT_ROOT, 'visual');
const DESKTOP_DIR = path.join(VISUAL_ROOT, 'desktop');
const MOBILE_DIR = path.join(VISUAL_ROOT, 'mobile');
const DIAG_DIR = path.join(VISUAL_ROOT, 'diagnostics');

for (const d of [VISUAL_ROOT, DESKTOP_DIR, MOBILE_DIR, DIAG_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// ── Brand list (from Phase 1 audit JSON) ─────────────────

interface Phase1Brand {
  slug: string;
  primaryName: string;
  routeUrl: string;
}

function loadBrandSlugs(): Phase1Brand[] {
  const auditPath = path.join(AUDIT_ROOT, 'manufacturer-audit.json');
  if (!fs.existsSync(auditPath)) {
    throw new Error(
      `Phase 1 audit JSON not found at ${auditPath}. Run scripts/audit-manufacturers.ts first.`,
    );
  }
  const raw = JSON.parse(fs.readFileSync(auditPath, 'utf-8')) as {
    brands: Array<{ slug: string; primaryName: string; routeUrl: string }>;
  };
  return raw.brands.map((b) => ({
    slug: b.slug,
    primaryName: b.primaryName,
    routeUrl: b.routeUrl,
  }));
}

// ── Diagnostics shape ────────────────────────────────────

interface ImageDiag {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  complete: boolean;
  visible: boolean;
  alt: string | null;
  broken: boolean;
}

interface LinkDiag {
  href: string;
  text: string;
  target: string | null;
  rel: string | null;
}

interface FailedRequest {
  url: string;
  method: string;
  failure: string | null;
  resourceType: string;
}

interface PerViewportDiag {
  slug: string;
  primaryName: string;
  viewport: 'desktop' | 'mobile';
  viewportWidth: number;
  viewportHeight: number;
  routeUrl: string;
  httpStatus: number | null;
  pageTitle: string;
  scrollWidth: number;
  clientWidth: number;
  overflowX: boolean;
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: FailedRequest[];
  images: ImageDiag[];
  brokenImageCount: number;
  outboundLinkCount: number;
  outboundLinkHosts: Record<string, number>;
  outboundLinks: LinkDiag[];
  screenshotPath: string;
  capturedAt: string;
}

// ── Setup ────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' });

// Loaded lazily inside the test functions because Playwright test files
// are evaluated at collection time before fs is guaranteed ready.
const brands = loadBrandSlugs();

console.log(`[visual-audit] enumerated ${brands.length} brand routes`);

// ── Page walk ────────────────────────────────────────────

async function walkBrandPage(
  page: Page,
  brand: Phase1Brand,
  viewport: 'desktop' | 'mobile',
): Promise<PerViewportDiag> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: FailedRequest[] = [];

  const consoleHandler = (msg: ConsoleMessage) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      const text = `[${msg.type()}] ${msg.text()}`;
      if (msg.type() === 'error') consoleErrors.push(text);
    }
  };
  const errorHandler = (err: Error) => {
    pageErrors.push(err.message.slice(0, 300));
  };
  const requestFailedHandler = (req: import('@playwright/test').Request) => {
    failedRequests.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText ?? null,
      resourceType: req.resourceType(),
    });
  };

  page.on('console', consoleHandler);
  page.on('pageerror', errorHandler);
  page.on('requestfailed', requestFailedHandler);

  let httpStatus: number | null = null;
  try {
    const resp = await page.goto(brand.routeUrl, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });
    httpStatus = resp?.status() ?? null;
  } catch (err) {
    pageErrors.push(`navigation: ${(err as Error).message?.slice(0, 200) ?? 'unknown'}`);
  }

  // Allow lazy images a moment to settle, but don't block forever.
  await page.waitForTimeout(1500);
  try {
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.images)
          .filter((img) => !img.complete)
          .slice(0, 20)
          .map((img) => new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
            setTimeout(() => resolve(), 3000);
          })),
      ),
    );
  } catch { /* tolerated */ }

  const pageTitle = await page.title().catch(() => '');

  const diag = await page.evaluate(() => {
    const scrollWidth = document.documentElement.scrollWidth;
    const clientWidth = document.documentElement.clientWidth;
    const images = Array.from(document.images).map((img) => {
      const rect = img.getBoundingClientRect();
      const broken = img.complete && (img.naturalWidth === 0 || img.naturalHeight === 0);
      return {
        src: img.src,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        complete: img.complete,
        visible: rect.width > 0 && rect.height > 0,
        alt: img.getAttribute('alt'),
        broken,
      };
    });
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
      .map((a) => ({
        href: a.href,
        text: (a.textContent ?? '').trim().slice(0, 100),
        target: a.getAttribute('target'),
        rel: a.getAttribute('rel'),
      }));
    return { scrollWidth, clientWidth, images, links };
  });

  // Only count outbound (off-host) links — same-origin /brand /product
  // routes are internal navigation and irrelevant to the audit.
  const HOST_OF_PAGE = 'localhost:3000';
  const outbound = diag.links.filter((l) => {
    try {
      const u = new URL(l.href);
      return u.host !== HOST_OF_PAGE;
    } catch {
      return false;
    }
  });
  const outboundLinkHosts: Record<string, number> = {};
  for (const l of outbound) {
    try {
      const host = new URL(l.href).host.replace(/^www\./, '');
      outboundLinkHosts[host] = (outboundLinkHosts[host] ?? 0) + 1;
    } catch { /* ignore */ }
  }

  const screenshotFilename = `${brand.slug}.png`;
  const screenshotDir = viewport === 'desktop' ? DESKTOP_DIR : MOBILE_DIR;
  const screenshotPath = path.join(screenshotDir, screenshotFilename);
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch (err) {
    pageErrors.push(`screenshot: ${(err as Error).message?.slice(0, 200) ?? 'unknown'}`);
  }

  page.off('console', consoleHandler);
  page.off('pageerror', errorHandler);
  page.off('requestfailed', requestFailedHandler);

  const viewportSize = page.viewportSize() ?? { width: 0, height: 0 };
  const result: PerViewportDiag = {
    slug: brand.slug,
    primaryName: brand.primaryName,
    viewport,
    viewportWidth: viewportSize.width,
    viewportHeight: viewportSize.height,
    routeUrl: brand.routeUrl,
    httpStatus,
    pageTitle,
    scrollWidth: diag.scrollWidth,
    clientWidth: diag.clientWidth,
    overflowX: diag.scrollWidth > diag.clientWidth + 1,
    consoleErrors,
    pageErrors,
    failedRequests,
    images: diag.images,
    brokenImageCount: diag.images.filter((i) => i.broken).length,
    outboundLinkCount: outbound.length,
    outboundLinkHosts,
    outboundLinks: outbound.slice(0, 50),
    screenshotPath: path.relative(REPO_ROOT, screenshotPath),
    capturedAt: new Date().toISOString(),
  };

  return result;
}

// ── Tests ────────────────────────────────────────────────

for (const viewport of ['desktop', 'mobile'] as const) {
  const isDesktop = viewport === 'desktop';
  const vpWidth = isDesktop ? 1440 : 390;
  const vpHeight = isDesktop ? 1024 : 844;

  test.describe(`${viewport} (${vpWidth}×${vpHeight})`, () => {
    test.use({ viewport: { width: vpWidth, height: vpHeight } });

    for (const brand of brands) {
      test(`${brand.slug}`, async ({ page }) => {
        test.setTimeout(60_000);
        const diag = await walkBrandPage(page, brand, viewport);
        const sidecarPath = path.join(
          DIAG_DIR,
          `${brand.slug}.${viewport}.json`,
        );
        fs.writeFileSync(sidecarPath, JSON.stringify(diag, null, 2));
      });
    }
  });
}
