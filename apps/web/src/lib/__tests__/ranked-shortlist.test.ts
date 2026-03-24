/**
 * Direct shortlist flow tests.
 *
 * "Best DAC under $2000" should route through the existing shopping flow
 * with clarification skipped when both category and budget are present.
 *
 * Covers:
 *   - Intent detection: category + budget queries route as 'shopping'
 *   - Category extraction: DAC, amplifier, speaker, headphone, IEM, streamer, turntable, phono preamp
 *   - Budget extraction: under $X, below X, <$X, around $X, for $X
 *   - Clarification skip: isAnswerReady returns true for category + budget
 *   - Shopping answer: buildShoppingAnswer produces recommendations
 */

// @ts-nocheck — globals provided by test-runner.ts

import { detectIntent, extractShortlistCategory, extractShortlistBudget, extractAmplifierSubtype } from '../intent';
import { detectShoppingIntent, isAnswerReady, buildShoppingAnswer } from '../shopping-intent';
import { shoppingToAdvisory } from '../advisory-response';

// ── Minimal signals fixture ──────────────────────────

const EMPTY_SIGNALS = {
  matched_phrases: [],
  symptoms: [],
  traits: {} as Record<string, 'up' | 'down'>,
};

// ── Intent Detection ─────────────────────────────────

describe('Direct shortlist intent routing', () => {
  it('detects "best DAC under $2000" as shopping', () => {
    const { intent } = detectIntent('Best DAC under $2000');
    expect(intent).toBe('shopping');
  });

  it('detects "top speakers under $5000" as shopping', () => {
    const { intent } = detectIntent('top speakers under $5000');
    expect(intent).toBe('shopping');
  });

  it('detects "recommend a good headphone under $500" as shopping', () => {
    const { intent } = detectIntent('recommend a good headphone under $500');
    expect(intent).toBe('shopping');
  });

  it('detects "best DAC for $1000" as shopping', () => {
    const { intent } = detectIntent('best DAC for $1000');
    expect(intent).toBe('shopping');
  });

  it('detects "best dacs under 1000" (no dollar sign) as shopping', () => {
    const { intent } = detectIntent('best dacs under 1000');
    expect(intent).toBe('shopping');
  });

  it('detects "best amplifier under $3000" as shopping', () => {
    const { intent } = detectIntent('best amplifier under $3000');
    expect(intent).toBe('shopping');
  });

  it('does NOT detect "tell me about the Pontus" as shopping', () => {
    const { intent } = detectIntent('tell me about the Pontus');
    expect(intent).not.toBe('shopping');
  });
});

// ── Category Extraction ──────────────────────────────

describe('Shortlist category extraction', () => {
  it('extracts "dac" from "best DAC under $2000"', () => {
    expect(extractShortlistCategory('best DAC under $2000')).toBe('dac');
  });

  it('extracts "speaker" from "top speakers under $5000"', () => {
    expect(extractShortlistCategory('top speakers under $5000')).toBe('speaker');
  });

  it('extracts "headphone" from "best headphones under $500"', () => {
    expect(extractShortlistCategory('best headphones under $500')).toBe('headphone');
  });

  it('extracts "amplifier" from "best amp under $3000"', () => {
    expect(extractShortlistCategory('best amp under $3000')).toBe('amplifier');
  });

  it('extracts "streamer" from "good streamer under $1000"', () => {
    expect(extractShortlistCategory('good streamer under $1000')).toBe('streamer');
  });

  it('extracts "phono_preamp" from "best phono preamp under $500"', () => {
    expect(extractShortlistCategory('best phono preamp under $500')).toBe('phono_preamp');
  });

  it('extracts "iem" from "best IEMs under $300"', () => {
    expect(extractShortlistCategory('best IEMs under $300')).toBe('iem');
  });

  it('returns null for non-category text', () => {
    expect(extractShortlistCategory('what is R2R?')).toBeNull();
  });
});

// ── Budget Extraction ────────────────────────────────

describe('Shortlist budget extraction', () => {
  it('extracts 2000 from "under $2000"', () => {
    expect(extractShortlistBudget('best DAC under $2000')).toBe(2000);
  });

  it('extracts 2000 from "under 2000" (no dollar sign)', () => {
    expect(extractShortlistBudget('best DAC under 2000')).toBe(2000);
  });

  it('extracts 5000 from "below $5,000" (with comma)', () => {
    expect(extractShortlistBudget('top speakers below $5,000')).toBe(5000);
  });

  it('extracts 1000 from "for $1000"', () => {
    expect(extractShortlistBudget('best DAC for $1000')).toBe(1000);
  });

  it('extracts 1500 from "around $1500"', () => {
    expect(extractShortlistBudget('best DAC around $1500')).toBe(1500);
  });

  it('extracts 2000 from "<$2000"', () => {
    expect(extractShortlistBudget('best DAC <$2000')).toBe(2000);
  });

  it('returns null for text with no budget', () => {
    expect(extractShortlistBudget('best DAC for detail')).toBeNull();
  });
});

// ── Clarification Skip ───────────────────────────────

describe('isAnswerReady for direct shortlist', () => {
  it('returns true when category and budget are both present', () => {
    const ctx = detectShoppingIntent('best DAC under $2000', EMPTY_SIGNALS);
    expect(ctx.detected).toBe(true);
    expect(ctx.category).toBe('dac');
    expect(ctx.budgetMentioned).toBe(true);

    const ready = isAnswerReady(ctx, EMPTY_SIGNALS);
    expect(ready).toBe(true);
  });

  it('returns true for speakers with budget', () => {
    const ctx = detectShoppingIntent('top speakers under $5000', EMPTY_SIGNALS);
    expect(ctx.detected).toBe(true);
    expect(ctx.budgetMentioned).toBe(true);

    const ready = isAnswerReady(ctx, EMPTY_SIGNALS);
    expect(ready).toBe(true);
  });

  it('does NOT skip clarification for general category without budget', () => {
    const ctx = detectShoppingIntent('looking for something good', EMPTY_SIGNALS);
    // general category or no budget — should not be ready
    if (ctx.detected && ctx.category === 'general') {
      const ready = isAnswerReady(ctx, EMPTY_SIGNALS);
      expect(ready).toBe(false);
    }
  });
});

// ── Shopping Answer Generation ───────────────────────

describe('Shopping answer for direct shortlist', () => {
  it('produces a shopping answer with product examples for "best DAC under $2000"', () => {
    const ctx = detectShoppingIntent('best DAC under $2000', EMPTY_SIGNALS);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS);

    expect(answer.category).toBe('DAC');
    expect(answer.productExamples.length).toBeGreaterThan(0);

    // All products must be at or under budget
    for (const p of answer.productExamples) {
      expect(p.price).toBeLessThan(2001);
    }
  });

  it('produces an AdvisoryResponse via shoppingToAdvisory', () => {
    const ctx = detectShoppingIntent('best DAC under $2000', EMPTY_SIGNALS);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS);
    const advisory = shoppingToAdvisory(answer, EMPTY_SIGNALS);

    expect(advisory.kind).toBe('shopping');
    expect(advisory.options).toBeDefined();
    expect(advisory.options!.length).toBeGreaterThan(0);
  });

  it('marks answer as provisional when taste signals are absent', () => {
    const ctx = detectShoppingIntent('best DAC under $2000', EMPTY_SIGNALS);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS);

    expect(answer.provisional).toBe(true);
  });

  it('produces speaker recommendations for "top speakers under $5000"', () => {
    const ctx = detectShoppingIntent('top speakers under $5000', EMPTY_SIGNALS);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS);

    expect(answer.category).toBe('speakers');
    expect(answer.productExamples.length).toBeGreaterThan(0);
    for (const p of answer.productExamples) {
      expect(p.price).toBeLessThan(5001);
    }
  });
});

// ── Amplifier Shopping Flow ──────────────────────────

describe('Amplifier shopping flow', () => {
  it('detects "best integrated amp under $3000" as shopping', () => {
    const result = detectIntent('best integrated amp under $3000');
    expect(result.intent).toBe('shopping');
  });

  it('extracts amplifier category', () => {
    expect(extractShortlistCategory('best integrated amp under $3000')).toBe('amplifier');
  });

  it('extracts amplifier subtype as integrated', () => {
    expect(extractAmplifierSubtype('best integrated amp under $3000')).toBe('integrated');
  });

  it('extracts budget as 3000', () => {
    expect(extractShortlistBudget('best integrated amp under $3000')).toBe(3000);
  });

  it('skips clarification when category + budget present', () => {
    const ctx = detectShoppingIntent('best integrated amp under $3000', EMPTY_SIGNALS);
    expect(ctx.category).toBe('amplifier');
    expect(ctx.budgetMentioned).toBe(true);
    expect(isAnswerReady(ctx, EMPTY_SIGNALS)).toBe(true);
  });

  it('produces a shopping answer with amplifier catalog', () => {
    const ctx = detectShoppingIntent('best integrated amp under $3000', EMPTY_SIGNALS);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS);
    expect(answer.category).toBe('amplifier');
    // Amplifiers don't have a product catalog yet
    expect(answer.bestFitDirection.length).toBeGreaterThan(0);
  });
});

// ── Synthesis Brief & Sonic Landscape ────────────────

describe('Synthesis brief and sonic landscape', () => {
  it('includes synthesis brief for DAC shortlist', () => {
    const ctx = detectShoppingIntent('best DAC under $2000', EMPTY_SIGNALS);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS);

    expect(answer.synthesisBrief).toBeDefined();
    expect(answer.synthesisBrief!.kind).toBe('shopping_shortlist');
    expect(answer.synthesisBrief!.queryCategory).toBe('DAC');
    expect(answer.synthesisBrief!.budget).toBe(2000);
  });

  it('includes sonic landscape for sparse-signal DAC query', () => {
    const ctx = detectShoppingIntent('best DAC under $2000', EMPTY_SIGNALS);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS);

    expect(answer.sonicLandscape).toBeDefined();
    expect(answer.sonicLandscape!.length).toBeGreaterThan(0);
  });

  it('includes refinement prompts when context is missing', () => {
    const ctx = detectShoppingIntent('best DAC under $2000', EMPTY_SIGNALS);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS);

    expect(answer.refinementPrompts).toBeDefined();
    expect(answer.refinementPrompts!.length).toBeGreaterThan(0);
  });

  it('passes sonic landscape through to AdvisoryResponse', () => {
    const ctx = detectShoppingIntent('best DAC under $2000', EMPTY_SIGNALS);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS);
    const advisory = shoppingToAdvisory(answer, EMPTY_SIGNALS);

    expect(advisory.sonicLandscape).toBeDefined();
  });

  it('passes refinement prompts through to AdvisoryResponse (or suppresses when preference weak)', () => {
    const ctx = detectShoppingIntent('best DAC under $2000', EMPTY_SIGNALS);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS);
    const advisory = shoppingToAdvisory(answer, EMPTY_SIGNALS);

    // When preference signal is weak, refinementPrompts are suppressed
    // in favor of StartHereBlock. Either refinementPrompts exist OR lowPreferenceSignal is true.
    if (advisory.lowPreferenceSignal) {
      expect(advisory.refinementPrompts).toBeUndefined();
    } else {
      expect(advisory.refinementPrompts).toBeDefined();
      expect(advisory.refinementPrompts!.length).toBeGreaterThan(0);
    }
  });

  it('candidate philosophies reflect different topologies', () => {
    const ctx = detectShoppingIntent('best DAC under $2000', EMPTY_SIGNALS);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS);

    const labels = answer.synthesisBrief!.candidatePhilosophies.map((p) => p.label);
    // Should have multiple distinct philosophies
    const unique = new Set(labels);
    expect(unique.size).toBeGreaterThan(1);
  });
});

// ── Why This Fits You ─────────────────────────────────

describe('Why this fits you layer', () => {
  it('includes whyFitsYou when taste signals are present', () => {
    const signals = {
      matched_phrases: ['warmth'],
      symptoms: [],
      traits: { tonality: 'up' as const, elasticity: 'up' as const },
    };
    const ctx = detectShoppingIntent('best DAC under $2000', signals);
    const answer = buildShoppingAnswer(ctx, signals);

    expect(answer.whyFitsYou).toBeDefined();
    expect(answer.whyFitsYou!.length).toBeGreaterThan(0);
    expect(answer.whyFitsYou!.length).toBeLessThan(5); // max 4
  });

  it('passes whyFitsYou through to AdvisoryResponse', () => {
    const signals = {
      matched_phrases: ['warmth'],
      symptoms: [],
      traits: { tonality: 'up' as const, elasticity: 'up' as const },
    };
    const ctx = detectShoppingIntent('best DAC under $2000', signals);
    const answer = buildShoppingAnswer(ctx, signals);
    const advisory = shoppingToAdvisory(answer, signals);

    expect(advisory.whyFitsYou).toBeDefined();
    expect(advisory.whyFitsYou!.length).toBeGreaterThan(0);
  });

  it('includes topology diversity bullet when multiple topologies present', () => {
    const ctx = detectShoppingIntent('best DAC under $2000', EMPTY_SIGNALS);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS);

    // Sparse signals → diverse topologies → should mention different philosophies
    if (answer.whyFitsYou) {
      const hasDiversityBullet = answer.whyFitsYou.some((b) => b.includes('design philosophies'));
      // When topology diversity exists, this bullet should be present
      expect(hasDiversityBullet || answer.whyFitsYou.length === 0).toBe(true);
    }
  });

  it('returns undefined whyFitsYou when no context and no products', () => {
    // Streamer category has no scored catalog — products will be empty
    const ctx = detectShoppingIntent('best streamer under $1000', EMPTY_SIGNALS);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS);

    // With no taste, no system, no products → should be undefined
    expect(answer.whyFitsYou).toBeUndefined();
  });
});

// ── Amplifier Shortlist with Real Catalog ─────────────

describe('Amplifier shortlist with catalog', () => {
  it('produces product examples for "best integrated amp under $3000"', () => {
    const ctx = detectShoppingIntent('best integrated amp under $3000', EMPTY_SIGNALS);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS);

    expect(answer.productExamples.length).toBeGreaterThan(0);
    expect(answer.category).toBe('amplifier');
  });

  it('produces diverse topologies in amplifier shortlist', () => {
    const ctx = detectShoppingIntent('best amp under $3000', EMPTY_SIGNALS);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS);

    // With sparse signals and diverse catalog, should have multiple products
    expect(answer.productExamples.length).toBeGreaterThan(2);
  });

  it('generates sonic landscape for amplifier shortlist', () => {
    const ctx = detectShoppingIntent('best amplifier under $3000', EMPTY_SIGNALS);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS);

    expect(answer.sonicLandscape).toBeDefined();
    expect(answer.sonicLandscape!).toContain('sonic directions');
  });

  it('generates synthesis brief for amplifier shortlist', () => {
    const ctx = detectShoppingIntent('best integrated amp under $3000', EMPTY_SIGNALS);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS);

    expect(answer.synthesisBrief).toBeDefined();
    expect(answer.synthesisBrief!.kind).toBe('shopping_shortlist');
    expect(answer.synthesisBrief!.queryCategory).toBe('amplifier');
  });

  it('produces AdvisoryResponse with amplifier product options', () => {
    const ctx = detectShoppingIntent('best amp under $3000', EMPTY_SIGNALS);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS);
    const advisory = shoppingToAdvisory(answer, EMPTY_SIGNALS);

    expect(advisory.options).toBeDefined();
    expect(advisory.options!.length).toBeGreaterThan(0);
    expect(advisory.kind).toBe('shopping');
    expect(advisory.subject).toBe('amplifier');
  });

  it('respects budget ceiling for amplifier products', () => {
    const ctx = detectShoppingIntent('best amp under $1000', EMPTY_SIGNALS);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS);

    for (const p of answer.productExamples) {
      expect(p.price).toBeLessThan(1001);
    }
  });
});
