import { describe, it, expect } from 'vitest';
import { parseBudgetAmount } from '../shopping-intent';
import { transition } from '../conversation-state';
import type { ConvState } from '../conversation-state';

/**
 * D2 (production hardening, 2026-08-11) — the budget clarification loop.
 *
 * Live repro (dev + identical code promoted to production):
 *   "Speakers around two grand." → shopping
 *   "actually make it 3k, and I mostly listen to jazz at low volume"
 *      → "Got it — looking for speakers. What's your budget?"   (re-ask #1)
 *   "3k"
 *      → "Got it. Roughly what budget are you working with?"    (re-ask #2)
 *
 * The user answered the budget question in BOTH turns; neither parsed:
 *   - "make it 3k" — no revision-verb anchor in the k-suffix patterns;
 *   - bare "3k" — the clarify_budget relaxed extraction
 *     (PLAIN_BUDGET_PATTERN) requires 3+ digits and no k-suffix.
 *
 * Encoded rule: an answer to "what's your budget?" that consists of a
 * money amount in any accepted phrasing must be consumed as the budget —
 * the same question must never be asked twice across consecutive turns
 * when each turn contained a parseable amount.
 */

describe('parseBudgetAmount — revision and bare-answer phrasings', () => {
  const CASES: Array<[string, number]> = [
    ['actually make it 3k, and I mostly listen to jazz at low volume', 3000],
    ['make it 3k', 3000],
    ['change it to 2500', 2500],
    ['bump it up to 4k', 4000],
    ["let's say 1500", 1500],
    ['3k', 3000],
    ['$3k', 3000],
    ['2.5k', 2500],
    ['3000', 3000],
    ['under fifteen hundred', 1500],
  ];
  for (const [text, want] of CASES) {
    it(`"${text}" → ${want}`, () => {
      expect(parseBudgetAmount(text)).toBe(want);
    });
  }

  it('control: prices inside prose still parse to the LAST amount', () => {
    expect(parseBudgetAmount('best dac under $1000, actually make it $500')).toBe(500);
  });

  it('control: non-money numbers do not become budgets', () => {
    expect(parseBudgetAmount('for 2 channel listening')).toBeNull();
    expect(parseBudgetAmount('the LS3/5a')).toBeNull();
  });
});

describe('clarify_budget consumes k-suffix answers (no loop)', () => {
  const asking: ConvState = {
    mode: 'shopping',
    stage: 'clarify_budget',
    facts: { category: 'speakers' },
  };

  for (const answer of ['3k', 'make it 3k', 'around 3k', '3000']) {
    it(`"${answer}" advances to ready_to_recommend`, () => {
      const r = transition(asking, answer, { hasSystem: false, subjectCount: 0 });
      expect(r.state.stage).toBe('ready_to_recommend');
      expect(r.state.facts.budget).toBe('$3000');
    });
  }

  it('control: a non-answer still re-asks once', () => {
    const r = transition(asking, 'hmm not sure yet', { hasSystem: false, subjectCount: 0 });
    expect(r.state.stage).toBe('clarify_budget');
    expect(r.response?.kind).toBe('question');
  });
});

describe('shopping ENTRY consumes revision-phrased budgets (D2 residual)', () => {
  // Live production replay after the first D2 fix: the revision turn
  // "actually make it 3k, and I mostly listen to jazz at low volume"
  // re-entered shopping through detectInitialMode, whose extractBudget
  // used its own anchored pattern and missed the amount — re-asking the
  // budget again. extractBudget now delegates to parseBudgetAmount.
  it('"i want speakers, actually make it 3k" carries the budget at entry', () => {
    const r = transition(
      { mode: 'idle', stage: 'entry', facts: {} },
      'i want speakers, actually make it 3k',
      { hasSystem: false, subjectCount: 0, detectedIntent: 'shopping' },
    );
    expect(r.state.facts.budget).toBe('$3000');
  });
});

describe('clarify_budget: the stage licenses loose amounts (M5-F2)', () => {
  // Mission 5: "maybe 2k? honestly not sure I even want to spend it"
  // re-asked the budget. Inside clarify_budget the question was JUST
  // asked — the stage context is the anchor, so any k-token or bare
  // 3-6 digit number in the reply is the budget, hedges and all.
  const asking: ConvState = {
    mode: 'shopping',
    stage: 'clarify_budget',
    facts: { category: 'speakers' },
  };
  const HEDGED: Array<[string, string]> = [
    ['maybe 2k? honestly not sure I even want to spend it', '$2000'],
    ['i guess 1500 or so', '$1500'],
    ['probably 2.5k max', '$2500'],
  ];
  for (const [answer, want] of HEDGED) {
    it(`"${answer}" → ${want}`, () => {
      const r = transition(asking, answer, { hasSystem: false, subjectCount: 0 });
      expect(r.state.facts.budget).toBe(want);
      expect(r.state.stage).toBe('ready_to_recommend');
    });
  }
  it('control: an amount-free reply still re-asks', () => {
    const r = transition(asking, 'whatever it takes I suppose', { hasSystem: false, subjectCount: 0 });
    expect(r.state.stage).toBe('clarify_budget');
  });
});
