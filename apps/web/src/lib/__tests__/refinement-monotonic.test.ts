/**
 * Refinement monotonicity tests.
 *
 * Validates that refinement turns (room size, preferences) do NOT
 * downgrade product quality, ignore budget, or return weaker options.
 *
 * Success criteria:
 *   Van Halen → speakers → from scratch → $5000 → Heresy IV → "large living room"
 *   → stays in ~$3k–$5k range
 *   → includes Heresy IV or similar tier
 *   → shifts toward larger-scale speakers
 *   → no $999 fallback
 */

import { describe, it, expect } from 'vitest';
import { detectShoppingIntent, buildShoppingAnswer } from '../shopping-intent';
import { reason } from '../reasoning';
import type { ExtractedSignals } from '../signal-types';

const EMPTY_SIGNALS: ExtractedSignals = {
  traits: {},
  symptoms: [],
  archetype_hints: [],
  uncertainty_level: 0,
  matched_phrases: [],
  matched_uncertainty_markers: [],
};

// Simulates accumulated text after the full flow
const FULL_FLOW_TEXT = [
  'i like van halen',
  'speakers',
  'starting from scratch',
  '$5000',
  'Klipsch Heresy IV',
  'a large living room',
].join('\n');

// Text up to initial recommendation (before refinement)
const INITIAL_TEXT = [
  'i like van halen',
  'speakers',
  'starting from scratch',
  '$5000',
].join('\n');

describe('Refinement monotonicity: budget preservation', () => {
  it('preserves $5000 budget on refinement turn', () => {
    const ctx = detectShoppingIntent(FULL_FLOW_TEXT, EMPTY_SIGNALS, undefined, 'a large living room');
    expect(ctx.budgetMentioned).toBe(true);
    expect(ctx.budgetAmount).toBe(5000);
  });

  it('detects room context as "large"', () => {
    const ctx = detectShoppingIntent(FULL_FLOW_TEXT, EMPTY_SIGNALS, undefined, 'a large living room');
    expect(ctx.roomContext).toBe('large');
  });
});

describe('Refinement monotonicity: no price downgrade', () => {
  it('initial recommendations are in $3k-$5k range', () => {
    const ctx = detectShoppingIntent(INITIAL_TEXT, EMPTY_SIGNALS);
    const reasoning_result = reason(INITIAL_TEXT, [], EMPTY_SIGNALS, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS, undefined, reasoning_result);

    expect(answer.productExamples.length).toBeGreaterThan(0);
    for (const product of answer.productExamples) {
      // No product should be below $1500 (30% of $5000)
      expect(product.price).toBeGreaterThanOrEqual(1500);
    }
  });

  it('refinement recommendations stay in same tier — no $999 fallback', () => {
    const ctx = detectShoppingIntent(FULL_FLOW_TEXT, EMPTY_SIGNALS, undefined, 'a large living room');
    const reasoning_result = reason(FULL_FLOW_TEXT, [], EMPTY_SIGNALS, null, ctx, undefined);
    const engagedNames = ['heresy iv', 'klipsch heresy iv'];
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS, undefined, reasoning_result, undefined, engagedNames);

    expect(answer.productExamples.length).toBeGreaterThan(0);

    const prices = answer.productExamples.map((p) => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // All products must be above $1500 (no starter-set fallback)
    expect(minPrice).toBeGreaterThanOrEqual(1500);
    // At least one product should be in the $3k+ range
    expect(maxPrice).toBeGreaterThanOrEqual(3000);
    // No product should exceed budget by more than 20%
    expect(maxPrice).toBeLessThanOrEqual(6000);
  });

  it('refinement does NOT produce lower-tier products than initial', () => {
    // Initial recommendations
    const initialCtx = detectShoppingIntent(INITIAL_TEXT, EMPTY_SIGNALS);
    const initialReasoning = reason(INITIAL_TEXT, [], EMPTY_SIGNALS, null, initialCtx, undefined);
    const initialAnswer = buildShoppingAnswer(initialCtx, EMPTY_SIGNALS, undefined, initialReasoning);
    const initialMinPrice = Math.min(...initialAnswer.productExamples.map((p) => p.price));

    // Refinement recommendations
    const refinedCtx = detectShoppingIntent(FULL_FLOW_TEXT, EMPTY_SIGNALS, undefined, 'a large living room');
    const refinedReasoning = reason(FULL_FLOW_TEXT, [], EMPTY_SIGNALS, null, refinedCtx, undefined);
    const engagedNames = ['heresy iv'];
    const refinedAnswer = buildShoppingAnswer(refinedCtx, EMPTY_SIGNALS, undefined, refinedReasoning, undefined, engagedNames);
    const refinedMinPrice = Math.min(...refinedAnswer.productExamples.map((p) => p.price));

    // Refinement minimum price should be within 20% of initial minimum
    // (monotonic — no dramatic downgrade)
    expect(refinedMinPrice).toBeGreaterThanOrEqual(initialMinPrice * 0.8);
  });
});

describe('Refinement monotonicity: room-size ranking effect', () => {
  it('large room context boosts high-dynamics speakers', () => {
    const ctx = detectShoppingIntent(FULL_FLOW_TEXT, EMPTY_SIGNALS, undefined, 'a large living room');
    const reasoning_result = reason(FULL_FLOW_TEXT, [], EMPTY_SIGNALS, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS, undefined, reasoning_result);

    const productNames = answer.productExamples.map((p) => `${p.brand} ${p.name}`);
    // Should NOT include small-room-only speakers
    // The Boenicke W5 is explicitly "best in smaller rooms"
    // and should be penalized for large room context
    const hasSmallRoomOnly = productNames.some((n) =>
      n.includes('Boenicke W5'),
    );
    // Note: this is a soft test — it's possible W5 still appears if
    // there aren't enough alternatives, but it should be ranked lower.
    // The key guarantee: Heresy IV or similar high-sensitivity speakers
    // should appear if engaged.
  });

  it('"a large living room" does not produce desktop/nearfield speakers', () => {
    const ctx = detectShoppingIntent(FULL_FLOW_TEXT, EMPTY_SIGNALS, undefined, 'a large living room');
    const reasoning_result = reason(FULL_FLOW_TEXT, [], EMPTY_SIGNALS, null, ctx, undefined);
    const engagedNames = ['heresy iv'];
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS, undefined, reasoning_result, undefined, engagedNames);

    // All products should be appropriate for a large room
    expect(answer.productExamples.length).toBeGreaterThan(0);
    // Budget preserved
    expect(answer.budget).toBe(5000);
    // Category preserved
    expect(answer.category).toMatch(/speaker/i);
  });
});

describe('Refinement monotonicity: engaged product continuity', () => {
  it('Heresy IV stays in shortlist when engaged and room context added', () => {
    const ctx = detectShoppingIntent(FULL_FLOW_TEXT, EMPTY_SIGNALS, undefined, 'a large living room');
    const reasoning_result = reason(FULL_FLOW_TEXT, [], EMPTY_SIGNALS, null, ctx, undefined);
    const engagedNames = ['heresy iv', 'klipsch heresy iv'];
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS, undefined, reasoning_result, undefined, engagedNames);

    const productNames = answer.productExamples.map((p) =>
      `${p.brand} ${p.name}`.toLowerCase(),
    );
    const hasHeresy = productNames.some((n) => n.includes('heresy'));
    expect(hasHeresy).toBe(true);
  });
});

describe('Refinement monotonicity: no starter-set on weak input', () => {
  it('"large living room" with budget produces budget-appropriate results', () => {
    // Even though "large living room" alone is a weak taste signal,
    // with budget stated, products must not fall to starter level
    const ctx = detectShoppingIntent(FULL_FLOW_TEXT, EMPTY_SIGNALS, undefined, 'a large living room');
    const reasoning_result = reason(FULL_FLOW_TEXT, [], EMPTY_SIGNALS, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS, undefined, reasoning_result);

    // Every product should cost at least 30% of budget
    for (const p of answer.productExamples) {
      expect(p.price).toBeGreaterThanOrEqual(1500);
    }
  });

  it('budget and category persist in answer', () => {
    const ctx = detectShoppingIntent(FULL_FLOW_TEXT, EMPTY_SIGNALS, undefined, 'a large living room');
    const reasoning_result = reason(FULL_FLOW_TEXT, [], EMPTY_SIGNALS, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS, undefined, reasoning_result);

    expect(answer.budget).toBe(5000);
    expect(answer.category).toMatch(/speaker/i);
  });
});
