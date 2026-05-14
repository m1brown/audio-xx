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
  screenshot: string;
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
    const screenshot = await screenshotTurn(page, caseDir, turnNo);
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
