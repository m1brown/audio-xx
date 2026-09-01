import { defineConfig } from '@playwright/test';

/**
 * Audio XXI — Visual regression config (Tier B of the automated QA workflow).
 *
 * Separate from the interactive playwright.config.ts so the visual baselines,
 * diffs, and headless run settings stay isolated from the manual reviewer
 * specs. Drives the same fixture suite as the engine tier (src/qa/fixtures.ts).
 *
 *   First run  → writes PNG baselines under qa-regression/baseline/visual/.
 *   Later runs → pixel-diffs against them; meaningful layout changes fail the
 *                test and emit a *-diff.png under qa-regression/runs/visual/.
 *
 * Run from repo root: npm run qa:regress:visual
 * Adopt new/intended visuals: npm run qa:regress:visual -- --update-snapshots
 */
export default defineConfig({
  testDir: './src/tests',
  testMatch: /visual-regression\.spec\.ts$/,
  timeout: 120_000,
  expect: {
    timeout: 30_000,
    // Pixel tolerance: absorbs font anti-aliasing jitter while still catching
    // real layout / spacing / color regressions. Tune per project maturity.
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', scale: 'css' },
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: './qa-regression/runs/visual',
  snapshotPathTemplate: './qa-regression/baseline/visual/{arg}{ext}',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    viewport: { width: 1440, height: 1024 },
    trace: 'off',
  },
  webServer: {
    // A3 Character overlay defaults OFF in local dev, so capture is the
    // deterministic engine render. Explicit kill-switch for safety.
    command: 'NEXT_PUBLIC_A3_CHARACTER=false npm run dev',
    port: 3000,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
