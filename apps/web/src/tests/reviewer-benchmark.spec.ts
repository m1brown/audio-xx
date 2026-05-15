/**
 * Audio XX — Reviewer Demonstration Benchmark · Playwright runner.
 *
 * Drives each case in `reviewer-benchmark-cases.ts` through the chat UI
 * and captures full evidence: rendered narrative excerpt, headings seen,
 * console errors, marker pass/fail, and a full-page screenshot per turn.
 *
 * Artifacts (relative to apps/web/reviewer-benchmark/):
 *   - <case-id>/turn-{n}.png       — full-page screenshot per turn
 *   - <case-id>/transcript.json    — per-turn evidence + marker scores
 *   - summary.json                 — pass/fail per case across the manifest
 *
 * Prerequisites:
 *   - Dev server running on http://localhost:3000 (or BASE_URL).
 *   - Playwright chromium installed: `npx playwright install chromium`.
 *
 * Run:
 *   cd apps/web
 *   npx playwright test src/tests/reviewer-benchmark.spec.ts
 *
 *   Filter to one case:
 *     npx playwright test src/tests/reviewer-benchmark.spec.ts -g "my-system"
 *
 * Design:
 *   - Self-contained: duplicates a small set of browser helpers from
 *     conversation-state.spec.ts rather than importing them. The
 *     duplication is intentional — zero behavioral risk to the existing
 *     harness, and Phase A is a small enough surface that the cost is low.
 *   - Tier 'regression' cases gate the vitest test
 *     (`reviewer-benchmark-regression.test.ts`); this Playwright runner
 *     captures the same evidence at the UI layer for demo / screenshot
 *     use.
 *
 * Engineering-vs-domain boundary:
 *   This file is harness layer. All audio-domain markers live in the
 *   manifest. The runner is reusable for any chat-UI benchmark set.
 */

import { test, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { BENCHMARK_CASES, type BenchmarkCase } from './reviewer-benchmark-cases';

// ── Artifact paths ───────────────────────────────────────

const ARTIFACT_DIR = path.resolve(__dirname, '../../reviewer-benchmark');
const SUMMARY_PATH = path.join(ARTIFACT_DIR, 'summary.json');

interface TurnEvidence {
  turn: number;
  prompt: string;
  bodyLen: number;
  headingsSeen: string[];
  responseText: string;
  consoleErrors: string[];
  /** Full-page archival screenshot — every turn. */
  screenshot: string;
  /** Outreach-oriented crop covering top through EMERGENT BEHAVIOR.
   *  Falls back to viewport-only when the synergy layer doesn't fire. */
  viewportScreenshot: string;
  expectedTermHits: Record<string, boolean>;
  forbiddenTermHits: Record<string, boolean>;
  pass: boolean;
  failReasons: string[];
}

interface CaseResult {
  id: string;
  systemName: string;
  tier: BenchmarkCase['tier'];
  demoSuitability: BenchmarkCase['demoSuitability'];
  pass: boolean;
  turns: TurnEvidence[];
}

const results: CaseResult[] = [];

// ── Helpers (self-contained) ─────────────────────────────

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

const RESPONSE_TIMEOUT = 90_000;
const STABILIZATION_MS = 2_500;
const SUBMISSION_DETECT_TIMEOUT = 4_000;
/**
 * Floor below which `document.body.innerText.length` is treated as
 * proof that the prompt never submitted (only landing-page chrome was
 * captured). Real responses observed are >= 1800 chars; the empty
 * landing page is ~900–935. 1500 is well clear of both.
 */
const MIN_VALID_BODY_LEN = 1500;

/**
 * Submit a prompt and confirm the chat actually accepted it.
 *
 * Flake mode this guards against: Playwright's click succeeds (no error)
 * but the React handler drops the event due to a hydration/timing race.
 * The page stays on its pre-submit state, the test silently moves on,
 * and the captured "responseText" is just the landing-page chrome.
 *
 * Acceptance signal: within SUBMISSION_DETECT_TIMEOUT after the click,
 * either the Send button text flips to "Thinking" OR the textarea is
 * cleared. Either of those is conclusive proof that the form ran.
 * If neither fires, refill the textarea and click once more. If still
 * neither, throw — the test fails loudly instead of returning a
 * misleading landing-page capture.
 */
async function submitPrompt(page: Page, text: string) {
  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
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
    const accepted = await Promise.race([
      page.locator('button').filter({ hasText: /Thinking/ }).waitFor({
        state: 'visible',
        timeout: SUBMISSION_DETECT_TIMEOUT,
      }).then(() => true).catch(() => false),
      page.waitForFunction(() => {
        const el = document.querySelector('#audio-input') as HTMLTextAreaElement | null;
        return !!(el && el.value.trim() === '');
      }, null, { timeout: SUBMISSION_DETECT_TIMEOUT }).then(() => true).catch(() => false),
    ]);
    if (accepted) return;
    // Attempt failed — the click happened but the chat didn't progress.
    // Loop will refill + re-click on the next iteration.
  }
  throw new Error(
    'submitPrompt: prompt submission appears to have silently failed after '
    + `${MAX_ATTEMPTS} attempts (no "Thinking" indicator visible and textarea `
    + 'still populated). The page likely lost its event handlers or the chat '
    + 'is in an unexpected state. Prompt: ' + JSON.stringify(text),
  );
}

async function waitForResponse(page: Page) {
  try {
    await page.locator('button').filter({ hasText: /Thinking/ }).waitFor({
      state: 'visible',
      timeout: 5_000,
    });
  } catch {
    // Already past Thinking
  }
  try {
    await page.locator('button').filter({ hasText: /^Send$/ }).waitFor({
      state: 'visible',
      timeout: RESPONSE_TIMEOUT,
    });
  } catch {
    // Capture whatever's there
  }
  // Mutation-quiet stabilization
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
  } catch {
    // Continue
  }
  await page.waitForTimeout(1_000);
}

async function captureTurnDom(page: Page, promptText: string) {
  return page.evaluate((p) => {
    const t = document.body.innerText;
    const idx = t.indexOf(p);
    const main = idx >= 0 ? t.slice(idx, idx + 6000) : t.slice(-6000);
    const headingTokens = [
      'SYSTEM REVIEW',
      'SYSTEM READ',
      'EMERGENT BEHAVIOR',
      'SYSTEM LOGIC',
      'PRIMARY LEVERAGE',
      'DECISION',
      'TRADE-OFFS',
      'NEXT STEP',
      'DO NOTHING CHECK',
    ];
    const headingsSeen = headingTokens.filter((h) => main.toUpperCase().includes(h));
    return {
      bodyLen: t.length,
      headingsSeen,
      responseText: main.slice(0, 4000),
    };
  }, promptText);
}

function stripPromptEcho(text: string, prompt: string): string {
  let out = text;
  const idx = out.toLowerCase().indexOf(prompt.toLowerCase());
  if (idx >= 0) out = out.slice(0, idx) + out.slice(idx + prompt.length);
  // Strip right-rail blocks so they don't poison marker scoring.
  out = out.replace(/\bLISTENER\b[\s\S]*?(?=\b(?:SYSTEM|RECENT|REFERENCE|WORKSPACE|How It Works)\b|$)/g, ' ');
  out = out.replace(/\bSYSTEM\b\n[\s\S]*?(?=\b(?:RECENT|REFERENCE|WORKSPACE|How It Works|LISTENER)\b|$)/g, ' ');
  out = out.replace(/\bRECENT\b[\s\S]*?(?=\b(?:LISTENER|SYSTEM|REFERENCE|WORKSPACE|How It Works)\b|$)/g, ' ');
  return out;
}

function scoreTerms(text: string, prompt: string, expected: string[], forbidden: string[]) {
  const stripped = stripPromptEcho(text, prompt);
  const lower = stripped.toLowerCase();
  const expectedTermHits: Record<string, boolean> = {};
  for (const e of expected) expectedTermHits[e] = lower.includes(e.toLowerCase());
  const forbiddenTermHits: Record<string, boolean> = {};
  for (const f of forbidden) forbiddenTermHits[f] = lower.includes(f.toLowerCase());
  return { expectedTermHits, forbiddenTermHits };
}

function makeCaseDir(id: string) {
  const d = path.join(ARTIFACT_DIR, id);
  ensureDir(d);
  return d;
}

async function screenshotTurn(page: Page, caseDir: string, turnNo: number): Promise<string> {
  const full = path.join(caseDir, `turn-${turnNo}.png`);
  try {
    await page.screenshot({ path: full, fullPage: true });
  } catch {
    // ignore
  }
  return full;
}

/**
 * Outreach-oriented viewport crop (Phase 2.6 polish, 2026-05-14).
 *
 * Saves a second PNG per turn at `turn-{n}-viewport.png` capturing the
 * top of the page through the end of the EMERGENT BEHAVIOR section.
 *
 * Implementation:
 *   1. Find the EMERGENT BEHAVIOR section by walking up from any node
 *      whose text matches /emergent behavior/i to the nearest <section>.
 *   2. Take that section's bottom Y coordinate + 32 px padding.
 *   3. page.screenshot with `clip: { x:0, y:0, width:viewport, height: y }`.
 *
 * Fallback — if EMERGENT BEHAVIOR isn't rendered (negative-control
 * case or any case where the synergy layer doesn't fire), capture the
 * default viewport rectangle instead. The full-page archival
 * screenshot remains untouched in either case.
 */
async function viewportCropTurn(page: Page, caseDir: string, turnNo: number): Promise<string> {
  const out = path.join(caseDir, `turn-${turnNo}-viewport.png`);
  // Scroll to document top first — after a chat response the page is
  // scrolled to the bottom, and a non-fullPage screenshot would capture
  // the wrong region. Combined with `fullPage: true` below, this also
  // makes `clip` coordinates document-relative.
  await page.evaluate(() => window.scrollTo(0, 0));
  // Quiet stabilization — let images/fonts finish rendering at the top.
  await page.waitForTimeout(400);

  const cropY = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('section, h2, h3, div'));
    let target: Element | null = null;
    for (const el of candidates) {
      const text = el.textContent ?? '';
      // Match a section whose own text starts with "Emergent behavior" so
      // we don't accidentally match a container that wraps the whole page.
      if (/^\s*Emergent behavior\b/i.test(text) && text.length < 3000) {
        target = el;
        break;
      }
    }
    if (!target) return null;
    // Walk up to the closest <section> wrapper for accurate bottom.
    let walker: Element | null = target;
    while (walker && walker.tagName !== 'SECTION' && walker.parentElement) {
      walker = walker.parentElement;
    }
    const rect = (walker ?? target).getBoundingClientRect();
    // window.scrollY is 0 after scrollTo(0,0); rect.bottom is the
    // viewport-relative bottom which equals document-Y when scrolled to top.
    const y = rect.bottom + window.scrollY + 40;
    return Math.max(0, Math.min(y, 4000));
  });
  const viewport = page.viewportSize() ?? { width: 1280, height: 900 };
  try {
    if (cropY && cropY > 200) {
      // fullPage: true makes clip document-relative — captures from y:0
      // (document top) through the EMERGENT BEHAVIOR bottom + padding.
      await page.screenshot({
        path: out,
        fullPage: true,
        clip: { x: 0, y: 0, width: viewport.width, height: cropY },
      });
    } else {
      // Fallback — no synergy section present (negative-control case).
      // Capture the default viewport from the document top.
      await page.screenshot({ path: out, fullPage: false });
    }
  } catch {
    // ignore
  }
  return out;
}

// ── Setup / teardown ────────────────────────────────────

test.beforeAll(() => {
  ensureDir(ARTIFACT_DIR);
  console.log(`\nReviewer Benchmark artifacts root: ${ARTIFACT_DIR}\n`);
});

test.afterAll(() => {
  try {
    fs.writeFileSync(SUMMARY_PATH, JSON.stringify({
      generatedAt: new Date().toISOString(),
      totalCases: results.length,
      passed: results.filter((r) => r.pass).length,
      failed: results.filter((r) => !r.pass).length,
      cases: results,
    }, null, 2));
    console.log(`\nSummary written: ${SUMMARY_PATH}`);
  } catch (err) {
    console.log(`Could not write summary: ${(err as Error).message}`);
  }
  console.log('\n═══ Reviewer Benchmark Summary ═══');
  for (const r of results) {
    console.log(`  ${r.pass ? '✓' : '✗'} ${r.id} (${r.tier}, demo:${r.demoSuitability}) — ${r.systemName}`);
    for (const t of r.turns) {
      const failNote = t.pass ? '' : ` — ${t.failReasons.join('; ')}`;
      console.log(`     turn ${t.turn}: pass=${t.pass}${failNote}`);
    }
  }
});

// ── Runner ──────────────────────────────────────────────

async function runCase(page: Page, c: BenchmarkCase): Promise<CaseResult> {
  const caseDir = makeCaseDir(c.id);
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message.slice(0, 300)}`));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  try {
    await page.locator('#audio-input').waitFor({ state: 'visible', timeout: 30_000 });
  } catch {
    // Continue
  }
  await page.waitForTimeout(1_500);
  // Always start clean — click Start Over if visible.
  try {
    const startOver = page.locator('button').filter({ hasText: /^Start over$/i }).first();
    if (await startOver.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await startOver.click({ timeout: 1_500 });
      await page.waitForTimeout(500);
    }
  } catch {
    // Continue
  }

  const prompts = [c.prompts.primary, ...c.prompts.followups];
  const turns: TurnEvidence[] = [];

  for (let i = 0; i < prompts.length; i++) {
    const turnNo = i + 1;
    const prompt = prompts[i];
    await submitPrompt(page, prompt);
    await waitForResponse(page);
    const dom = await captureTurnDom(page, prompt);
    // Defensive sanity check: if submitPrompt's acceptance signal was
    // somehow incorrect (e.g., the textarea cleared but the request was
    // still dropped server-side), the captured body will be just the
    // landing-page chrome. Fail loudly with a clear message rather than
    // letting the marker scorer report a string of "missing expected"
    // false positives. Captures the real failure cause first.
    if (dom.bodyLen < MIN_VALID_BODY_LEN) {
      throw new Error(
        `Prompt appears not to have submitted; captured landing page instead of `
        + `advisory response (bodyLen=${dom.bodyLen}, expected >= ${MIN_VALID_BODY_LEN}). `
        + `Case=${c.id}, turn=${turnNo}, prompt=${JSON.stringify(prompt)}.`,
      );
    }
    const screenshot = await screenshotTurn(page, caseDir, turnNo);
    // Phase 2.6 polish — outreach crop sits alongside the full-page
    // archival screenshot. Captured BEFORE term scoring so the crop
    // reflects the same DOM state.
    const viewportScreenshot = await viewportCropTurn(page, caseDir, turnNo);
    const { expectedTermHits, forbiddenTermHits } = scoreTerms(
      dom.responseText,
      prompt,
      c.expectedMarkers.mustContain,
      c.expectedMarkers.mustNotContain,
    );
    const failReasons: string[] = [];
    for (const [k, v] of Object.entries(expectedTermHits)) {
      if (!v) failReasons.push(`missing expected: "${k}"`);
    }
    for (const [k, v] of Object.entries(forbiddenTermHits)) {
      if (v) failReasons.push(`forbidden present: "${k}"`);
    }
    if (c.expectedMarkers.minSections) {
      for (const section of c.expectedMarkers.minSections) {
        if (!dom.headingsSeen.some((h) => h.toUpperCase().includes(section.toUpperCase()))) {
          failReasons.push(`missing section: "${section}"`);
        }
      }
    }
    const turnPass = failReasons.length === 0;
    turns.push({
      turn: turnNo,
      prompt,
      bodyLen: dom.bodyLen,
      headingsSeen: dom.headingsSeen,
      responseText: dom.responseText,
      consoleErrors: [...consoleErrors],
      screenshot,
      viewportScreenshot,
      expectedTermHits,
      forbiddenTermHits,
      pass: turnPass,
      failReasons,
    });
  }

  const transcriptPath = path.join(caseDir, 'transcript.json');
  try {
    fs.writeFileSync(transcriptPath, JSON.stringify({ case: c, turns }, null, 2));
  } catch (err) {
    console.log(`Could not write transcript for ${c.id}: ${(err as Error).message}`);
  }

  const casePass = turns.every((t) => t.pass);
  return {
    id: c.id,
    systemName: c.systemName,
    tier: c.tier,
    demoSuitability: c.demoSuitability,
    pass: casePass,
    turns,
  };
}

// ── Test cases — one per benchmark case ─────────────────

for (const c of BENCHMARK_CASES) {
  test(`${c.id} — ${c.systemName}`, async ({ page }) => {
    const result = await runCase(page, c);
    results.push(result);
  });
}
