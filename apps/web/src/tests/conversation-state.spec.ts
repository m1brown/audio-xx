/**
 * Audio XX — Conversation-State Regression Harness
 *
 * Why this exists:
 *   Unit tests on intent classification pass single-shot prompts. They miss
 *   the class of bug where the app handles each prompt correctly in
 *   isolation but loses track of conversation state across turns. The
 *   2026-05-12 "thinking about a turntable" bug — where the diagnosis
 *   continuation heuristic silently swallowed an explicit category pivot
 *   — was a member of this class.
 *
 *   This harness drives the dev server in a real browser, runs single-
 *   turn canonical prompts (sanity) and multi-turn state-transition
 *   sequences, and records per-turn evidence: heading, response prose,
 *   product card names, right-rail state, console errors, and a screenshot.
 *   Each turn is scored against expected and forbidden terms.
 *
 * Scope:
 *   - Tests only. No app changes.
 *   - Uses the existing @playwright/test toolchain already wired into
 *     apps/web/playwright.config.ts.
 *
 * Prerequisites:
 *   - Dev server running on http://localhost:3000 (or set BASE_URL).
 *   - Playwright chromium installed: `npx playwright install chromium`.
 *
 * Run:
 *   cd apps/web
 *   npx playwright test src/tests/conversation-state.spec.ts
 *
 * Artifacts (relative to apps/web/qa-conversation-state/):
 *   - {test-id}/turn-{n}.png       — screenshot per turn
 *   - {test-id}/transcript.json    — full turn-by-turn evidence
 *   - summary.json                 — pass/fail per test, mode detected, term hits
 *
 * Engineering-vs-domain boundary:
 *   This file is harness layer (engine-agnostic): it knows how to drive a
 *   chat UI, capture DOM state, and assert against term lists. The
 *   audio-domain knowledge (what an "expected" / "forbidden" term is per
 *   sequence) lives in the test data tables below.
 */

import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// ── Artifact paths ───────────────────────────────────────

const ARTIFACT_DIR = path.resolve(__dirname, '../../qa-conversation-state');
const SUMMARY_PATH = path.join(ARTIFACT_DIR, 'summary.json');

interface TurnEvidence {
  turn: number;
  prompt: string;
  bodyLen: number;
  detectedMode: string | null;
  headingsSeen: string[];
  productCards: Array<{ brand: string; name: string }>;
  rightRailHasSystem: boolean;
  rightRailLine: string | null;
  responseText: string; // first 2500 chars of the response
  consoleErrors: string[];
  expectedTermHits: Record<string, boolean>;
  forbiddenTermHits: Record<string, boolean>;
  screenshot: string;
  pass: boolean;
  failReasons: string[];
}

interface TestResult {
  id: string;
  description: string;
  turns: TurnEvidence[];
  pass: boolean;
  failReasons: string[];
}

const results: TestResult[] = [];

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// ── Browser helpers (self-contained — no dep on qa-screenshots.spec) ──

const RESPONSE_TIMEOUT = 90_000;
const STABILIZATION_MS = 2_500;

async function submitPrompt(page: Page, text: string) {
  const textarea = page.locator('#audio-input');
  await textarea.waitFor({ state: 'visible', timeout: 10_000 });
  // Click the textarea first to ensure React state subscriptions are set up.
  await textarea.click();
  await textarea.fill(text);
  // Some dev-server / session-bootstrap states leave the Send button
  // disabled for an extended period even with valid textarea content.
  // Wait up to 8 s for it to enable. If it never enables, fall back to
  // pressing Enter (which dispatches the same form submit handler).
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
        // race — try again
      }
    }
    await page.waitForTimeout(250);
  }
  if (!clicked) {
    // Fallback: simulate Enter keypress on the textarea.
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
    // Already past Thinking — continue
  }
  try {
    await page.locator('button').filter({ hasText: /^Send$/ }).waitFor({
      state: 'visible',
      timeout: RESPONSE_TIMEOUT,
    });
  } catch {
    // Continue and capture whatever's there
  }
  // Quiet-period stabilization
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

/**
 * Capture DOM evidence for the turn we just submitted.
 * `promptText` is used to find the response section in the rendered body.
 */
async function captureTurn(
  page: Page,
  turnNo: number,
  promptText: string,
  consoleErrors: string[],
): Promise<Omit<TurnEvidence, 'expectedTermHits' | 'forbiddenTermHits' | 'pass' | 'failReasons' | 'screenshot'>> {
  const data = await page.evaluate((p) => {
    const t = document.body.innerText;
    const idx = t.indexOf(p);
    const main = idx >= 0 ? t.slice(idx, idx + 5000) : t.slice(-5000);

    // Detect "mode" by scanning for canonical heading tokens.
    const headingTokens = [
      'SYSTEM TENDENCIES',     // diagnosis
      'WHAT THIS MEANS',       // diagnosis Layer 2
      'WHERE TO ACT',          // diagnosis Layer 3
      'SYSTEM REVIEW',         // system_assessment
      'SYSTEM READ',           // system_assessment
      'GEAR COMPARISON',       // comparison
      'EXPLORATORY RECOMMENDATIONS', // shopping
      'PRIMARY RECOMMENDATION',// shopping
      'AUDIO PREFERENCES',     // taste-extraction shopping
      'YOUR SYSTEM',           // right-rail / system context
    ];
    const headingsSeen = headingTokens.filter((h) => main.toUpperCase().includes(h));

    // Coarse mode mapping — first match wins, ordered by specificity.
    // Notes on disambiguation:
    //   - "WHAT THIS MEANS FOR COMPONENT CHOICE" is a shopping_taste
    //     subheading and must NOT be read as the diagnostic "WHAT THIS
    //     MEANS" header. Strip the qualified form first.
    //   - "SYSTEM TENDENCIES" is the strongest diagnostic anchor — when
    //     present, mode is diagnosis regardless of other headings.
    //   - "AUDIO PREFERENCES" anchored at the response top is the
    //     shopping_taste signal; check it before shopping (which only
    //     fires on bare EXPLORATORY/PRIMARY RECOMMENDATION text).
    const mainUpper = main.toUpperCase();
    const diagWhatThisMeans = mainUpper.includes('WHAT THIS MEANS')
      && !mainUpper.includes('WHAT THIS MEANS FOR COMPONENT CHOICE');
    let detectedMode: string | null = null;
    if (mainUpper.includes('SYSTEM REVIEW')) detectedMode = 'system_assessment';
    else if (mainUpper.includes('GEAR COMPARISON')) detectedMode = 'comparison';
    else if (mainUpper.includes('SYSTEM TENDENCIES')
          || mainUpper.includes('WHERE TO ACT')
          || diagWhatThisMeans) detectedMode = 'diagnosis';
    else if (mainUpper.includes('AUDIO PREFERENCES')) detectedMode = 'shopping_taste';
    else if (mainUpper.includes('EXPLORATORY RECOMMENDATIONS')
          || mainUpper.includes('PRIMARY RECOMMENDATION')) detectedMode = 'shopping';
    else if (/describe what specifically/i.test(main) && /tonal density|rhythmic drive|spatial precision/i.test(main)) {
      detectedMode = 'vague_intercept';
    } else if (/Got it — let'?s figure out|Got it — voice-forward|Got it — looking for|Got it — natural|Got it — relaxed/i.test(main)) {
      detectedMode = 'conversational';
    } else if (main.length < 1500) {
      detectedMode = 'short_response';
    }

    // Product cards: scan rendered .audioxx-product-card elements.
    const cardEls = Array.from(document.querySelectorAll('.audioxx-product-card'));
    const productCards = cardEls.map((el) => {
      const nameEl = el.querySelector('.audioxx-product-name');
      const text = nameEl?.textContent?.trim() || el.textContent?.slice(0, 80)?.trim() || '';
      // Cards typically render as "BRAND\nModel Name" — split.
      const lines = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
      const brand = lines[0] || '';
      const name = lines[1] || '';
      return { brand, name };
    });

    // Right-rail: look for an <aside> that contains the SYSTEM line.
    const asides = Array.from(document.querySelectorAll('aside'));
    let rightRailHasSystem = false;
    let rightRailLine: string | null = null;
    for (const a of asides) {
      const txt = (a.innerText || '').trim();
      const m = txt.match(/SYSTEM\s*\n([^\n]+)/);
      if (m && m[1] && !/No system active/i.test(m[1])) {
        rightRailHasSystem = true;
        rightRailLine = m[1].trim();
        break;
      }
    }

    return {
      bodyLen: t.length,
      detectedMode,
      headingsSeen,
      productCards,
      rightRailHasSystem,
      rightRailLine,
      responseText: main.slice(0, 2500),
    };
  }, promptText);

  return {
    turn: turnNo,
    prompt: promptText,
    bodyLen: data.bodyLen,
    detectedMode: data.detectedMode,
    headingsSeen: data.headingsSeen,
    productCards: data.productCards,
    rightRailHasSystem: data.rightRailHasSystem,
    rightRailLine: data.rightRailLine,
    responseText: data.responseText,
    consoleErrors: [...consoleErrors],
  };
}

/**
 * Strip non-response content before scoring against expected/forbidden terms:
 *   - The user's own prompt echo (conversation log).
 *   - The LISTENER right-rail block (accumulated preference memory).
 *   - The SYSTEM right-rail block (saved-system summary).
 *
 * These are conversation-state surfaces, not part of the model's response
 * to the current turn. Matching forbidden terms against them produces
 * false positives whenever the user's prior turn introduced a phrase
 * (e.g. "flow without losing detail") that then echoes in the right rail.
 */
function stripPromptEcho(text: string, prompt: string): string {
  let out = text;
  // Strip prompt echo.
  const idx = out.toLowerCase().indexOf(prompt.toLowerCase());
  if (idx >= 0) out = out.slice(0, idx) + out.slice(idx + prompt.length);
  // Strip the LISTENER right-rail block — extends from "LISTENER" header
  // to the next ALL-CAPS section header or end of text.
  out = out.replace(/\bLISTENER\b[\s\S]*?(?=\b(?:SYSTEM|RECENT|REFERENCE|WORKSPACE|How It Works)\b|$)/g, ' ');
  // Strip the SYSTEM right-rail block.
  out = out.replace(/\bSYSTEM\b\n[\s\S]*?(?=\b(?:RECENT|REFERENCE|WORKSPACE|How It Works|LISTENER)\b|$)/g, ' ');
  // Strip the RECENT block (search history).
  out = out.replace(/\bRECENT\b[\s\S]*?(?=\b(?:LISTENER|SYSTEM|REFERENCE|WORKSPACE|How It Works)\b|$)/g, ' ');
  return out;
}

function scoreTerms(text: string, prompt: string, expected: string[], forbidden: string[]): {
  expectedTermHits: Record<string, boolean>;
  forbiddenTermHits: Record<string, boolean>;
} {
  const stripped = stripPromptEcho(text, prompt);
  const lower = stripped.toLowerCase();
  const expectedTermHits: Record<string, boolean> = {};
  for (const e of expected) expectedTermHits[e] = lower.includes(e.toLowerCase());
  const forbiddenTermHits: Record<string, boolean> = {};
  for (const f of forbidden) forbiddenTermHits[f] = lower.includes(f.toLowerCase());
  return { expectedTermHits, forbiddenTermHits };
}

function makeTestDir(id: string) {
  const d = path.join(ARTIFACT_DIR, id);
  ensureDir(d);
  return d;
}

async function screenshotTurn(page: Page, testDir: string, turnNo: number): Promise<string> {
  const filename = `turn-${turnNo}.png`;
  const full = path.join(testDir, filename);
  try {
    await page.screenshot({ path: full, fullPage: true });
  } catch {
    // ignore
  }
  return full;
}

// ── Per-turn expectation shape ──────────────────────────

interface TurnExpect {
  prompt: string;
  /** Coarse mode the turn should land in. */
  expectMode?: TurnEvidence['detectedMode'] | TurnEvidence['detectedMode'][];
  /** Substrings (case-insensitive) that MUST appear in the response. */
  expectedTerms?: string[];
  /** Substrings (case-insensitive) that MUST NOT appear in the response. */
  forbiddenTerms?: string[];
  /** Lower bound on product cards rendered. */
  minProductCards?: number;
  /** Whether the right-rail SYSTEM line should be populated. */
  expectRightRailSystem?: boolean;
}

interface TestSpec {
  id: string;
  description: string;
  turns: TurnExpect[];
}

// ── Setup / teardown ────────────────────────────────────

test.beforeAll(() => {
  ensureDir(ARTIFACT_DIR);
  console.log(`\nArtifacts root: ${ARTIFACT_DIR}\n`);
});

test.afterAll(() => {
  try {
    fs.writeFileSync(SUMMARY_PATH, JSON.stringify({
      generatedAt: new Date().toISOString(),
      totalTests: results.length,
      passed: results.filter((r) => r.pass).length,
      failed: results.filter((r) => !r.pass).length,
      tests: results,
    }, null, 2));
    console.log(`\nSummary written: ${SUMMARY_PATH}`);
  } catch (err) {
    console.log(`Could not write summary: ${(err as Error).message}`);
  }
  // Console summary
  console.log('\n═══ Conversation-State Harness Summary ═══');
  for (const r of results) {
    console.log(`  ${r.pass ? '✓' : '✗'} ${r.id} — ${r.description}`);
    for (const t of r.turns) {
      console.log(`     turn ${t.turn} [${t.detectedMode ?? '?'}] cards=${t.productCards.length} ${t.pass ? '✓' : '✗' + ' ' + t.failReasons.join('; ')}`);
    }
  }
});

// ── Runner ──────────────────────────────────────────────

async function runSequence(page: Page, spec: TestSpec) {
  const testDir = makeTestDir(spec.id);
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message.slice(0, 300)}`));

  // Always start from a clean session — the Start Over button resets convState.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // First-paint can take several seconds on a cold dev server. Wait for
  // the audio-input textarea to be visible before considering the page
  // ready — otherwise the first submitPrompt races the React mount and
  // hits a disabled Send button.
  try {
    await page.locator('#audio-input').waitFor({ state: 'visible', timeout: 30_000 });
  } catch {
    // Continue regardless — the helper will retry.
  }
  await page.waitForTimeout(1_500);
  try {
    const startOver = page.locator('button').filter({ hasText: /^Start over$/i }).first();
    if (await startOver.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await startOver.click();
      await page.waitForTimeout(800);
    }
  } catch {
    // ignore
  }

  const turns: TurnEvidence[] = [];
  const result: TestResult = {
    id: spec.id,
    description: spec.description,
    turns,
    pass: true,
    failReasons: [],
  };

  for (let i = 0; i < spec.turns.length; i++) {
    const turnNo = i + 1;
    const turnSpec = spec.turns[i];
    console.log(`\n  [${spec.id}] turn ${turnNo}: "${turnSpec.prompt}"`);
    await submitPrompt(page, turnSpec.prompt);
    await waitForResponse(page);

    const base = await captureTurn(page, turnNo, turnSpec.prompt, consoleErrors);
    const { expectedTermHits, forbiddenTermHits } = scoreTerms(
      base.responseText,
      turnSpec.prompt,
      turnSpec.expectedTerms ?? [],
      turnSpec.forbiddenTerms ?? [],
    );

    const failReasons: string[] = [];

    // Mode assertion
    if (turnSpec.expectMode) {
      const expectedModes = Array.isArray(turnSpec.expectMode) ? turnSpec.expectMode : [turnSpec.expectMode];
      if (!expectedModes.includes(base.detectedMode)) {
        failReasons.push(`mode expected ${expectedModes.join(' | ')}, got ${base.detectedMode ?? 'unknown'}`);
      }
    }

    // Expected term assertion: ALL must be present
    for (const [term, hit] of Object.entries(expectedTermHits)) {
      if (!hit) failReasons.push(`expected term missing: "${term}"`);
    }

    // Forbidden term assertion: NONE may be present
    for (const [term, hit] of Object.entries(forbiddenTermHits)) {
      if (hit) failReasons.push(`forbidden term present: "${term}"`);
    }

    // Product-card count assertion
    if (turnSpec.minProductCards != null && base.productCards.length < turnSpec.minProductCards) {
      failReasons.push(`product cards: ${base.productCards.length} < expected ${turnSpec.minProductCards}`);
    }

    // Right-rail system assertion
    if (turnSpec.expectRightRailSystem === true && !base.rightRailHasSystem) {
      failReasons.push('right-rail SYSTEM expected populated, was empty');
    }

    const screenshot = await screenshotTurn(page, testDir, turnNo);
    const evidence: TurnEvidence = {
      ...base,
      expectedTermHits,
      forbiddenTermHits,
      screenshot,
      pass: failReasons.length === 0,
      failReasons,
    };
    turns.push(evidence);
    if (failReasons.length > 0) {
      result.pass = false;
      result.failReasons.push(`turn ${turnNo}: ${failReasons.join('; ')}`);
    }
    console.log(`     mode=${evidence.detectedMode ?? '?'} cards=${evidence.productCards.length} ${evidence.pass ? 'PASS' : 'FAIL — ' + failReasons.join('; ')}`);
  }

  // Persist transcript regardless of pass/fail
  try {
    fs.writeFileSync(path.join(testDir, 'transcript.json'), JSON.stringify(result, null, 2));
  } catch {
    // ignore
  }
  results.push(result);
}

// ══════════════════════════════════════════════════════════
// SECTION 1 — Single-turn canonical sanity tests
// ══════════════════════════════════════════════════════════

const SINGLE_TURN_TESTS: TestSpec[] = [
  {
    id: 's1-dac-1500',
    description: 'best DAC under $1500 → shopping with budget framing',
    turns: [{
      prompt: 'best DAC under $1500',
      expectMode: ['shopping', 'shopping_taste'],
      expectedTerms: ['under', '$1', 'dac'],
      forbiddenTerms: ['SYSTEM TENDENCIES'],
      minProductCards: 1,
    }],
  },
  {
    id: 's2-denafrips-topping',
    description: 'Denafrips vs Topping → gear comparison, distinct philosophies',
    turns: [{
      prompt: 'Denafrips vs Topping',
      expectMode: 'comparison',
      expectedTerms: ['R2R', 'Topping'],
      forbiddenTerms: ['fast, precise timing\nDenafrips'], // cross-attribution canary
    }],
  },
  {
    id: 's3-pontus-used',
    description: 'Used Denafrips Pontus II → product-assessment with used-market block',
    turns: [{
      prompt: 'Is a used Denafrips Pontus II a good buy?',
      expectedTerms: ['Pontus II', 'used'],
      minProductCards: 0, // single-product flow may not surface a card grid
    }],
  },
  {
    id: 's4-bakoon-firstwatt',
    description: 'Bakoon vs First Watt → Bakoon resolves to Enleum',
    turns: [{
      prompt: 'Bakoon vs First Watt',
      expectMode: 'comparison',
      expectedTerms: ['Enleum', 'First Watt'],
      forbiddenTerms: ['iFi Zen DAC'],
    }],
  },
  {
    id: 's5-streamer-5k',
    description: 'best streamer under $5000 → 3 streamer cards, no truncation fragment',
    turns: [{
      prompt: 'best streamer under $5000',
      expectMode: ['shopping', 'shopping_taste'],
      expectedTerms: ['streamer', '$5000'],
      forbiddenTerms: ['warmth and musicality vs.', 'No strong preference signal yet'],
      minProductCards: 2,
    }],
  },
  {
    id: 's6-harsh-vocals',
    description: 'my system sounds harsh on female vocals → diagnosis flow',
    turns: [{
      prompt: 'my system sounds harsh on female vocals',
      expectMode: 'diagnosis',
      expectedTerms: ['upstream', 'source'],
      forbiddenTerms: ['EXPLORATORY RECOMMENDATIONS'],
    }],
  },
];

// ══════════════════════════════════════════════════════════
// SECTION 2 — Multi-turn state-transition tests
// ══════════════════════════════════════════════════════════

const MULTI_TURN_TESTS: TestSpec[] = [
  // A. Diagnosis continuation — second turn should NOT reset to shopping.
  {
    id: 'mA-diagnosis-continuation',
    description: 'Diagnosis → follow-up refinement stays in diagnosis',
    turns: [
      {
        // Mode is the strict assertion; the diagnostic frame paraphrases
        // "harsh" as "brightness/treble-forward" so we don't require the
        // word back verbatim — we check causal vocabulary instead.
        prompt: 'my system sounds harsh',
        expectMode: 'diagnosis',
        expectedTerms: ['upstream', 'source'],
      },
      {
        prompt: 'mostly on female vocals',
        expectMode: ['diagnosis', 'conversational'],
        forbiddenTerms: ['EXPLORATORY RECOMMENDATIONS', 'PRIMARY RECOMMENDATION', 'GEAR COMPARISON'],
      },
    ],
  },
  // B. Diagnosis → category pivot (the 2026-05-12 bug).
  {
    id: 'mB-diagnosis-turntable-pivot',
    description: 'Diagnosis → "thinking about a turntable" pivots out of diagnosis',
    turns: [
      {
        prompt: 'my system sounds harsh',
        expectMode: 'diagnosis',
        expectedTerms: ['upstream'],
      },
      {
        prompt: "i'm thinking about a turntable",
        // Acceptable: shopping (turntable shortlist), shopping_taste, or
        // conversational intake asking room/budget. NOT diagnosis.
        expectMode: ['shopping', 'shopping_taste', 'conversational', 'short_response'],
        expectedTerms: ['turntable'],
        forbiddenTerms: [
          'harsh', 'female vocals', 'glare', 'upper midrange',
          'WHERE TO ACT', 'SYSTEM TENDENCIES',
          'tube buffer',
        ],
      },
    ],
  },
  // C. Shopping → diagnosis pivot.
  {
    id: 'mC-shopping-to-diagnosis',
    description: 'Shopping → "actually my system sounds thin" pivots to diagnosis',
    turns: [
      {
        prompt: 'best DAC under $1500',
        expectMode: ['shopping', 'shopping_taste'],
        expectedTerms: ['dac'],
      },
      {
        prompt: 'actually my system sounds thin',
        expectMode: 'diagnosis',
        expectedTerms: ['thin'],
        forbiddenTerms: ['EXPLORATORY RECOMMENDATIONS', 'PRIMARY RECOMMENDATION'],
      },
    ],
  },
  // D. Comparison → system evaluation pivot. Right-rail SYSTEM must populate.
  {
    id: 'mD-comparison-to-system-eval',
    description: 'Comparison → arrow-chain system assessment',
    turns: [
      {
        prompt: 'Denafrips vs Topping',
        expectMode: 'comparison',
        expectedTerms: ['R2R'],
      },
      {
        prompt: 'evaluate my system: Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva Monitor',
        expectMode: 'system_assessment',
        expectedTerms: ['Eversolo', 'Chord Hugo', 'JOB', 'WLM Diva'],
        expectRightRailSystem: true,
        forbiddenTerms: ['GEAR COMPARISON'],
      },
    ],
  },
  // E. Vague-preference → concrete category pivot.
  {
    id: 'mE-vague-to-category',
    description: '"more flow without losing detail" → "maybe a turntable" exits clarification',
    turns: [
      {
        prompt: 'I want more flow without losing detail',
        // Acceptable: bipolar-shopping, vague-intercept, or taste-extraction.
        expectMode: ['shopping', 'shopping_taste', 'vague_intercept', 'conversational'],
      },
      {
        prompt: 'maybe a turntable',
        expectMode: ['shopping', 'shopping_taste', 'conversational', 'short_response'],
        expectedTerms: ['turntable'],
        forbiddenTerms: ['tonal density vs clarity', 'rhythmic drive', 'flow without'],
      },
    ],
  },
];

// ── Test registration ──────────────────────────────────

for (const spec of SINGLE_TURN_TESTS) {
  test(spec.id, async ({ page }) => {
    await runSequence(page, spec);
    // We never throw inside runSequence; the assert is informational so that
    // a single failure doesn't kill the whole batch. Final pass/fail is in
    // summary.json. But we do mark Playwright failure when the test failed.
    const final = results.find((r) => r.id === spec.id);
    expect(final?.pass, final?.failReasons.join(' | ')).toBe(true);
  });
}

for (const spec of MULTI_TURN_TESTS) {
  test(spec.id, async ({ page }) => {
    await runSequence(page, spec);
    const final = results.find((r) => r.id === spec.id);
    expect(final?.pass, final?.failReasons.join(' | ')).toBe(true);
  });
}
