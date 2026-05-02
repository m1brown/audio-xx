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
    viewport: { width: 1280, height: 900 },
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
