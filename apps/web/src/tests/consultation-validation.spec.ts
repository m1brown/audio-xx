/**
 * Audio XX — Consultation visual validation (Stage 6.2 follow-up).
 *
 * Drives 6 consultation-style prompts through the chat UI and captures
 * evidence to verify the `ConsultationSubjectContext` block (added in
 * Stage 6.2) renders correctly across boutique product, brand
 * philosophy, DAC, amplifier, speaker, and used-market discussions.
 *
 * NOT a regression scorer — pure visual validation. Captures:
 *   - <case-id>/turn-1.png            (full page)
 *   - <case-id>/turn-1-viewport.png   (top through Learn More)
 *   - <case-id>/transcript.json       (prompt, body length, response text excerpt, console errors)
 *   - summary.json                    (per-case routing + length signal)
 *
 * Run:
 *   cd apps/web
 *   npx playwright test src/tests/consultation-validation.spec.ts
 */

import { test, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = path.resolve(__dirname, '../../consultation-validation');
const SUMMARY_PATH = path.join(ARTIFACT_DIR, 'summary.json');

interface ConsultationCase {
  id: string;
  category: 'boutique' | 'brand_philosophy' | 'dac' | 'amplifier' | 'speaker' | 'used_market';
  prompt: string;
  expectedSubject: string;
}

const CASES: ConsultationCase[] = [
  {
    id: 'leben-cs600x-boutique',
    category: 'boutique',
    prompt: 'What do you think of the Leben CS600X?',
    expectedSubject: 'Leben CS600X',
  },
  {
    id: 'wlm-brand-philosophy',
    category: 'brand_philosophy',
    prompt: 'What makes WLM speakers different?',
    expectedSubject: 'WLM',
  },
  {
    id: 'chord-hugo-dac',
    category: 'dac',
    prompt: 'What kind of listener likes the Chord Hugo?',
    expectedSubject: 'Chord Hugo',
  },
  {
    id: 'job-integrated-amp',
    category: 'amplifier',
    prompt: 'Thoughts on the JOB Integrated?',
    expectedSubject: 'JOB Integrated',
  },
  {
    id: 'devore-o96-speaker',
    category: 'speaker',
    prompt: 'Tell me about DeVore O/96',
    expectedSubject: 'DeVore O/96',
  },
  {
    id: 'denafrips-pontus-used',
    category: 'used_market',
    prompt: 'Is the Denafrips Pontus II still competitive?',
    expectedSubject: 'Denafrips Pontus II',
  },
];

interface CaseResult {
  id: string;
  category: ConsultationCase['category'];
  prompt: string;
  bodyLen: number;
  responseExcerpt: string;
  /** Whether the resolved subject name appears in the rendered body. */
  subjectInBody: boolean;
  /** Whether the "Learn more" section heading appears. */
  hasLearnMore: boolean;
  /** Whether a known product-image domain appears in rendered <img> src. */
  hasProductImage: boolean;
  consoleErrors: string[];
  screenshot: string;
  viewportScreenshot: string;
}

const results: CaseResult[] = [];

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

const RESPONSE_TIMEOUT = 90_000;
const STABILIZATION_MS = 2_500;

async function submitPrompt(page: Page, text: string) {
  const textarea = page.locator('#audio-input');
  await textarea.waitFor({ state: 'visible', timeout: 10_000 });
  await textarea.click();
  await textarea.fill(text);
  const sendButton = page.locator('button').filter({ hasText: /^Send$/ });
  const enabledByTime = Date.now() + 8_000;
  let clicked = false;
  while (Date.now() < enabledByTime) {
    if ((await sendButton.count()) > 0 && !(await sendButton.first().isDisabled().catch(() => true))) {
      try {
        await sendButton.first().click({ timeout: 2_000 });
        clicked = true;
        break;
      } catch {
        // race — retry
      }
    }
    await page.waitForTimeout(250);
  }
  if (!clicked) {
    await textarea.press('Enter');
  }
}

async function waitForResponse(page: Page) {
  try {
    await page.locator('button').filter({ hasText: /Thinking/ }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });
  } catch { /* already past */ }
  try {
    await page.locator('button').filter({ hasText: /^Send$/ }).waitFor({
      state: 'visible',
      timeout: RESPONSE_TIMEOUT,
    });
  } catch { /* take whatever's there */ }
  try {
    await page.evaluate((quietMs: number) => {
      return new Promise<void>((resolve) => {
        let timer: ReturnType<typeof setTimeout>;
        const observer = new MutationObserver(() => {
          clearTimeout(timer);
          timer = setTimeout(() => { observer.disconnect(); resolve(); }, quietMs);
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        timer = setTimeout(() => { observer.disconnect(); resolve(); }, quietMs);
      });
    }, STABILIZATION_MS);
  } catch { /* continue */ }
  await page.waitForTimeout(1_000);
}

async function captureSignals(page: Page, prompt: string, subject: string) {
  return page.evaluate(({ p, s }) => {
    const t = document.body.innerText;
    const idx = t.indexOf(p);
    const main = idx >= 0 ? t.slice(idx, idx + 6000) : t.slice(-6000);
    const bodyLen = t.length;
    const responseExcerpt = main.slice(0, 4000);
    const subjectInBody = main.toLowerCase().includes(s.toLowerCase());
    const hasLearnMore = /Learn more/i.test(main);
    const imgs = Array.from(document.querySelectorAll('img'))
      .map((img) => (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src || '')
      .filter((src) => src && !src.startsWith('data:'));
    const hasProductImage = imgs.some((src) =>
      /(\.png|\.jpg|\.jpeg|\.webp)(\?|$)/i.test(src),
    );
    return { bodyLen, responseExcerpt, subjectInBody, hasLearnMore, hasProductImage };
  }, { p: prompt, s: subject });
}

async function screenshotFull(page: Page, caseDir: string): Promise<string> {
  const full = path.join(caseDir, 'turn-1.png');
  try { await page.screenshot({ path: full, fullPage: true }); } catch { /* ignore */ }
  return full;
}

async function screenshotViewport(page: Page, caseDir: string): Promise<string> {
  const out = path.join(caseDir, 'turn-1-viewport.png');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  // Find the "Learn more" section bottom Y, then capture top → Learn-more + padding
  const cropY = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('section, h2, h3, div'));
    let target: Element | null = null;
    for (const el of candidates) {
      const text = el.textContent ?? '';
      if (/^\s*Learn more\b/i.test(text) && text.length < 4000) {
        target = el;
        break;
      }
    }
    if (!target) return null;
    let walker: Element | null = target;
    while (walker && walker.tagName !== 'SECTION' && walker.parentElement) {
      walker = walker.parentElement;
    }
    const rect = (walker ?? target).getBoundingClientRect();
    const y = rect.bottom + window.scrollY + 40;
    return Math.max(0, Math.min(y, 5000));
  });
  const viewport = page.viewportSize() ?? { width: 1280, height: 900 };
  try {
    if (cropY && cropY > 200) {
      await page.screenshot({
        path: out,
        fullPage: true,
        clip: { x: 0, y: 0, width: viewport.width, height: cropY },
      });
    } else {
      await page.screenshot({ path: out, fullPage: false });
    }
  } catch { /* ignore */ }
  return out;
}

test.beforeAll(() => {
  ensureDir(ARTIFACT_DIR);
  console.log(`\nConsultation Validation artifacts root: ${ARTIFACT_DIR}\n`);
});

test.afterAll(() => {
  try {
    fs.writeFileSync(SUMMARY_PATH, JSON.stringify({
      generatedAt: new Date().toISOString(),
      totalCases: results.length,
      cases: results,
    }, null, 2));
    console.log(`\nSummary written: ${SUMMARY_PATH}`);
  } catch (err) {
    console.log(`Could not write summary: ${(err as Error).message}`);
  }
  console.log('\n═══ Consultation Validation Summary ═══');
  for (const r of results) {
    console.log(`  ${r.id} (${r.category})`);
    console.log(`     bodyLen=${r.bodyLen}  subject=${r.subjectInBody}  learnMore=${r.hasLearnMore}  image=${r.hasProductImage}`);
  }
});

async function runCase(page: Page, c: ConsultationCase): Promise<CaseResult> {
  const caseDir = path.join(ARTIFACT_DIR, c.id);
  ensureDir(caseDir);
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message.slice(0, 300)}`));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  try {
    await page.locator('#audio-input').waitFor({ state: 'visible', timeout: 30_000 });
  } catch { /* continue */ }
  await page.waitForTimeout(1_500);
  try {
    const startOver = page.locator('button').filter({ hasText: /^Start over$/i }).first();
    if (await startOver.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await startOver.click({ timeout: 1_500 });
      await page.waitForTimeout(500);
    }
  } catch { /* continue */ }

  await submitPrompt(page, c.prompt);
  await waitForResponse(page);
  const sig = await captureSignals(page, c.prompt, c.expectedSubject);
  const screenshot = await screenshotFull(page, caseDir);
  const viewportScreenshot = await screenshotViewport(page, caseDir);

  const result: CaseResult = {
    id: c.id,
    category: c.category,
    prompt: c.prompt,
    bodyLen: sig.bodyLen,
    responseExcerpt: sig.responseExcerpt,
    subjectInBody: sig.subjectInBody,
    hasLearnMore: sig.hasLearnMore,
    hasProductImage: sig.hasProductImage,
    consoleErrors,
    screenshot,
    viewportScreenshot,
  };

  // Per-case transcript dump
  fs.writeFileSync(
    path.join(caseDir, 'transcript.json'),
    JSON.stringify(result, null, 2),
  );

  return result;
}

for (const c of CASES) {
  test(`${c.id} — ${c.prompt}`, async ({ page }) => {
    const r = await runCase(page, c);
    results.push(r);
  });
}
