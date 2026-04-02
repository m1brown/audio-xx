import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';
import { detectShoppingIntent } from '../shopping-intent';
import { buildShoppingAnswer } from '../shopping-intent';
import type { ExtractedSignals } from '../signal-types';
import { DEFAULT_SYSTEM_PROFILE } from '../system-profile';
import type { ListenerProfile } from '../listener-profile';
import { createEmptyListenerProfile } from '../listener-profile';

/**
 * "What about [brand]?" during an active shopping session.
 *
 * At the intent layer, these should resolve to product_assessment
 * (because "what about" + brand matches PRODUCT_ASSESSMENT_PATTERNS).
 * The page-level mode override then converts product_assessment → shopping
 * when shoppingAnswerCount > 0. This test validates the intent layer;
 * the mode override is exercised by page.tsx at runtime.
 */

const BRAND_FOLLOWUPS = [
  { message: 'what about chord', expectedBrand: 'chord' },
  { message: 'what about denafrips', expectedBrand: 'denafrips' },
  { message: 'what about schiit', expectedBrand: 'schiit' },
  { message: 'what about hegel', expectedBrand: 'hegel' },
  { message: 'what about the topping stuff', expectedBrand: 'topping' },
  { message: 'what about pass labs', expectedBrand: 'pass labs' },
  { message: 'what about harbeth', expectedBrand: 'harbeth' },
];

describe('Brand follow-up in shopping: intent layer', () => {
  for (const { message, expectedBrand } of BRAND_FOLLOWUPS) {
    it(`"${message}" → product_assessment with brand subject "${expectedBrand}"`, () => {
      const { intent, subjectMatches } = detectIntent(message);
      expect(intent).toBe('product_assessment');

      const brandMatch = subjectMatches.find(
        (m) => m.kind === 'brand' && m.name.toLowerCase() === expectedBrand,
      );
      expect(brandMatch).toBeDefined();
    });
  }

  it('"what about chord dacs under 1000" → shopping (budget escape hatch)', () => {
    const { intent, subjectMatches } = detectIntent('what about chord dacs under 1000');
    // Budget + category → escape hatch skips product_assessment → shopping
    expect(intent).toBe('shopping');
    const brandMatch = subjectMatches.find((m) => m.kind === 'brand' && m.name.toLowerCase() === 'chord');
    expect(brandMatch).toBeDefined();
  });
});

describe('Comparison escape hatch: "what about X vs Y" → comparison, not assessment', () => {
  const COMPARISON_CASES = [
    'what about ares vs terminator',
    'what about denafrips ares vs terminator',
    'what about chord qutest vs denafrips enyo 15th',
  ];

  for (const message of COMPARISON_CASES) {
    it(`"${message}" → comparison intent`, () => {
      const { intent, subjectMatches } = detectIntent(message);
      expect(intent).toBe('comparison');
      expect(subjectMatches.length).toBeGreaterThanOrEqual(2);
    });
  }
});

describe('Brand typo tolerance', () => {
  const TYPOS = [
    { message: 'what about denefrips', expectedBrand: 'denafrips' },
    { message: 'what about schitt', expectedBrand: 'schiit' },
  ];

  for (const { message, expectedBrand } of TYPOS) {
    it(`"${message}" → recognizes "${expectedBrand}" despite typo`, () => {
      const { subjectMatches } = detectIntent(message);
      const brandMatch = subjectMatches.find(
        (m) => m.kind === 'brand' && m.name.toLowerCase() === expectedBrand,
      );
      expect(brandMatch).toBeDefined();
    });
  }
});

// ── Failure 2 fix: product-to-category inference ──────────────────
describe('Product-to-category inference in shopping context', () => {
  const EMPTY_SIGNALS: ExtractedSignals = {
    traits: {},
    symptoms: [],
    archetype_hints: [],
    uncertainty_level: 0,
    matched_phrases: [],
    matched_uncertainty_markers: [],
  };

  it('"i think the ares is under 1000" → category=dac (not general)', () => {
    const ctx = detectShoppingIntent(
      'i think the ares is under 1000',
      EMPTY_SIGNALS,
    );
    expect(ctx.category).toBe('dac');
    expect(ctx.budgetMentioned).toBe(true);
  });

  it('"the bifrost is under 800" → category=dac (via alias map)', () => {
    const ctx = detectShoppingIntent(
      'the bifrost is under 800',
      EMPTY_SIGNALS,
    );
    expect(ctx.category).toBe('dac');
  });

  it('"pontus under 2000" → category=dac', () => {
    const ctx = detectShoppingIntent(
      'pontus under 2000',
      EMPTY_SIGNALS,
    );
    expect(ctx.category).toBe('dac');
  });

  it('taste-only "more engaging and less dry" → stays general (no false inference)', () => {
    const ctx = detectShoppingIntent(
      'more engaging and less dry',
      EMPTY_SIGNALS,
    );
    // No budget signal → product inference should NOT fire
    expect(ctx.category).toBe('general');
  });

  it('taste-only "less harsh, more immersive" → stays general', () => {
    const ctx = detectShoppingIntent(
      'less harsh, more immersive',
      EMPTY_SIGNALS,
    );
    expect(ctx.category).toBe('general');
  });
});

// ── Failure 1 fix: liked-brand over-budget injection ──────────────
describe('Liked-brand over-budget injection in shopping', () => {
  const EMPTY_SIGNALS: ExtractedSignals = {
    traits: {},
    symptoms: [],
    archetype_hints: [],
    uncertainty_level: 0,
    matched_phrases: [],
    matched_uncertainty_markers: [],
  };

  it('"best DAC under $1000" with likedBrands=["denafrips"] includes Ares 15th ($1,199)', () => {
    const ctx = detectShoppingIntent('best dac under $1000', EMPTY_SIGNALS);
    expect(ctx.category).toBe('dac');
    expect(ctx.budgetAmount).toBe(1000);

    const profile: ListenerProfile = {
      ...createEmptyListenerProfile(),
      likedBrands: ['denafrips'],
    };

    const answer = buildShoppingAnswer(
      ctx, EMPTY_SIGNALS, undefined, undefined, undefined,
      undefined, profile,
    );

    const products = answer.productExamples ?? [];
    // Should include at least one Denafrips product
    const hasDenafrips = products.some((p) => p.brand.toLowerCase() === 'denafrips');
    expect(hasDenafrips).toBe(true);

    // Specifically, the Ares 15th ($1,199) should be present as an over-budget
    // inclusion when the user has expressed brand affinity
    const hasAres = products.some(
      (p) => p.brand.toLowerCase() === 'denafrips' && p.name.toLowerCase().includes('ares'),
    );
    expect(hasAres).toBe(true);
  });

  it('"best DAC under $1000" WITHOUT liked brands does NOT include Ares 15th', () => {
    const ctx = detectShoppingIntent('best dac under $1000', EMPTY_SIGNALS);

    const answer = buildShoppingAnswer(
      ctx, EMPTY_SIGNALS, undefined, undefined, undefined,
      undefined, undefined, // no listenerProfile
    );

    const products = answer.productExamples ?? [];
    // Without liked-brand signal, Ares at $1,199 should NOT appear in $1,000 results
    const hasAres = products.some(
      (p) => p.brand.toLowerCase() === 'denafrips' && p.name.toLowerCase().includes('ares'),
    );
    expect(hasAres).toBe(false);
  });
});
