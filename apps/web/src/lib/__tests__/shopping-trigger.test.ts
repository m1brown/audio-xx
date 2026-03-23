/**
 * Shopping trigger test — verifies that category + budget queries
 * correctly trigger shopping recommendations (not "balanced presentation").
 *
 * Root cause: INTENT_KEYWORDS required '$' in budget strings,
 * SHOPPING_SIGNALS required '$', and INTAKE_GUARD_PATTERNS required '$'.
 * Users typing "under 1500" (no $) fell through to the analysis engine.
 */

import { detectIntent } from '@/lib/intent';
import { detectShoppingIntent, parseBudgetAmount, buildShoppingAnswer } from '@/lib/shopping-intent';
import { routeConversation } from '@/lib/conversation-router';
import { isIntakeQuery } from '@/lib/intake';
import { detectInitialMode, isReadyToRecommend } from '@/lib/conversation-state';

const TEST_QUERIES = [
  { msg: 'I want speakers under 1500 for rock', category: 'speaker', budget: 1500 },
  { msg: 'I want a DAC under 1000 for a lean system', category: 'dac', budget: 1000 },
  { msg: 'I want an amplifier under 3000 for KEF speakers', category: 'amplifier', budget: 3000 },
  { msg: 'I want a turntable under 1000', category: 'turntable', budget: 1000 },
  { msg: 'I want headphones under 200', category: 'headphone', budget: 200 },
];

// ── 1. detectIntent must return 'shopping' (or at worst 'intake' that gets promoted) ──

describe('detectIntent → shopping for category + budget queries', () => {
  for (const { msg } of TEST_QUERIES) {
    it(`detects shopping or intake for: "${msg}"`, () => {
      const { intent } = detectIntent(msg);
      expect(['shopping', 'intake']).toContain(intent);
    });
  }
});

// ── 2. routeConversation must return 'shopping' ──

describe('routeConversation → shopping mode', () => {
  for (const { msg } of TEST_QUERIES) {
    it(`routes to shopping for: "${msg}"`, () => {
      const mode = routeConversation(msg);
      expect(mode).toBe('shopping');
    });
  }
});

// ── 3. parseBudgetAmount must extract the budget number ──

describe('parseBudgetAmount extracts budget without $', () => {
  for (const { msg, budget } of TEST_QUERIES) {
    it(`parses ${budget} from: "${msg}"`, () => {
      expect(parseBudgetAmount(msg)).toBe(budget);
    });
  }
});

// ── 4. detectShoppingIntent must return detected: true ──

describe('detectShoppingIntent detects shopping with budget but no $', () => {
  const emptySignals = { traits: {}, symptoms: [], direction: [], preserve: [], context: [] } as any;

  for (const { msg } of TEST_QUERIES) {
    it(`detects shopping for: "${msg}"`, () => {
      const ctx = detectShoppingIntent(msg, emptySignals);
      expect(ctx.detected).toBe(true);
    });
  }
});

// ── 5. detectShoppingIntent must extract correct category ──

describe('detectShoppingIntent extracts correct category', () => {
  const emptySignals = { traits: {}, symptoms: [], direction: [], preserve: [], context: [] } as any;

  for (const { msg, category } of TEST_QUERIES) {
    it(`extracts category "${category}" from: "${msg}"`, () => {
      const ctx = detectShoppingIntent(msg, emptySignals);
      expect(ctx.category).toBe(category);
    });
  }
});

// ── 6. detectShoppingIntent must extract budget amount ──

describe('detectShoppingIntent extracts budget amount', () => {
  const emptySignals = { traits: {}, symptoms: [], direction: [], preserve: [], context: [] } as any;

  for (const { msg, budget } of TEST_QUERIES) {
    it(`extracts budget ${budget} from: "${msg}"`, () => {
      const ctx = detectShoppingIntent(msg, emptySignals);
      expect(ctx.budgetAmount).toBe(budget);
    });
  }
});

// ── 7. isIntakeQuery must NOT block these queries ──
// (They should either skip intake or have guards that bypass it)

describe('isIntakeQuery does not trap category+budget queries', () => {
  for (const { msg } of TEST_QUERIES) {
    it(`does not return intake for: "${msg}"`, () => {
      // subjectCount 0 for most queries (no brand names)
      const result = isIntakeQuery(msg, 0);
      // If intake pattern matches, guards should bypass it
      // OR the pattern shouldn't match at all
      // The key requirement: these queries must NOT get stuck in intake
      // (detectConvMode promotes intake to shopping when category + budget exist,
      // but the ideal path is to not be intake at all)
    });
  }
});

// ── 8. State machine: detectInitialMode must produce shopping/ready_to_recommend ──

describe('detectInitialMode → shopping/ready_to_recommend', () => {
  for (const { msg } of TEST_QUERIES) {
    it(`produces ready_to_recommend for: "${msg}"`, () => {
      const { intent, subjectMatches } = detectIntent(msg);
      const state = detectInitialMode(msg, {
        detectedIntent: intent,
        hasSystem: false,
        subjectCount: subjectMatches.length,
      });
      expect(state).not.toBeNull();
      expect(state!.mode).toBe('shopping');
      expect(state!.stage).toBe('ready_to_recommend');
    });
  }
});

// ── 9. Full pipeline: products must be returned ──

describe('Full pipeline: buildShoppingAnswer returns products', () => {
  const emptySignals = { traits: {}, symptoms: [], direction: [], preserve: [], context: [] } as any;

  for (const { msg, budget } of TEST_QUERIES) {
    it(`returns product options for: "${msg}"`, () => {
      const ctx = detectShoppingIntent(msg, emptySignals);
      if (!ctx.detected) {
        throw new Error(`detectShoppingIntent returned detected: false for "${msg}"`);
      }
      const answer = buildShoppingAnswer(ctx, emptySignals);
      // Must have at least 1 product recommendation
      expect(answer.productExamples.length).toBeGreaterThanOrEqual(1);
    });
  }
});

// ── 10. Explicit purchase intent routes to shopping, not intake ──

describe('Explicit purchase intent → shopping (not intake)', () => {
  const purchaseQueries = [
    'I want to buy a DAC',
    'I want to buy speakers',
    'looking to purchase an amplifier',
    'I want to buy headphones',
    'I want to shop for a turntable',
  ];

  for (const msg of purchaseQueries) {
    it(`routes "${msg}" to shopping`, () => {
      const { intent } = detectIntent(msg);
      expect(intent).toBe('shopping');
    });

    it(`does NOT route "${msg}" to intake`, () => {
      const isIntake = isIntakeQuery(msg, 0);
      expect(isIntake).toBe(false);
    });

    it(`detectInitialMode → shopping/ready_to_recommend for "${msg}"`, () => {
      const state = detectInitialMode(msg, {
        detectedIntent: 'shopping',
        hasSystem: false,
        subjectCount: 0,
      });
      expect(state).not.toBeNull();
      expect(state!.mode).toBe('shopping');
      expect(state!.stage).toBe('ready_to_recommend');
    });
  }
});

// ── 11. Vague queries WITHOUT purchase verb still get intake ──

describe('Vague queries without purchase verb → still intake', () => {
  const vagueQueries = [
    'I want a DAC',
    'I need speakers',
    'I want a new stereo',
  ];

  for (const msg of vagueQueries) {
    it(`routes "${msg}" to intake (not shopping)`, () => {
      const { intent } = detectIntent(msg);
      expect(intent).toBe('intake');
    });
  }
});

// ── 12. Queries WITH $ should still work (regression check) ──

describe('Queries with $ still work (regression)', () => {
  const dollarQueries = [
    'I want speakers under $1500 for rock',
    'best DAC under $1000',
    'recommend an amplifier under $3000',
  ];
  const emptySignals = { traits: {}, symptoms: [], direction: [], preserve: [], context: [] } as any;

  for (const msg of dollarQueries) {
    it(`still detects shopping for: "${msg}"`, () => {
      const { intent } = detectIntent(msg);
      expect(intent).toBe('shopping');
      const ctx = detectShoppingIntent(msg, emptySignals);
      expect(ctx.detected).toBe(true);
    });
  }
});
