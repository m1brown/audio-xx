import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests',
  /* Each flow can take up to 2 min (LLM-backed responses). */
  timeout: 120_000,
  expect: { timeout: 30_000 },
  /* Sequential — flows share localhost:3000 and must not overlap. */
  fullyParallel: false,
  workers: 1,
  retries: 0,
  /* Console output — structured logs are the primary reporting channel. */
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    headless: false,
    /*
     * Standardized reviewer-capture viewport (Stage 13, narrowed scope).
     *
     * 1440×1024 captures the full editorial 3-column workspace shell at
     * its natural ≥1200px breakpoint: left rail (184px) + main column
     * (820px) + right rail (296px) + gaps, fitting comfortably inside
     * the 1440px page-container max-width with side padding. Vertical
     * room is enough for the rationale + decision + recommendation
     * paragraphs to land above the fold on most comparison outputs
     * (the system-assessment case still needs scroll for the
     * trade-offs + do-nothing-check sections, captured via fullPage).
     *
     * The previous 1280×900 default cropped the right rail at the
     * grid breakpoint, producing inconsistent screenshots between
     * runs depending on whether the responsive collapse rule fired.
     *
     * Per-test viewport overrides remain available via
     * page.setViewportSize() when a specific capture needs different
     * dimensions (e.g. mobile 375×812 for single-column verification).
     */
    viewport: { width: 1440, height: 1024 },
    screenshot: 'off', // we take manual screenshots
    trace: 'off',
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
