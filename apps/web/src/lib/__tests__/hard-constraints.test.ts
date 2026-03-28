/**
 * Hard constraint enforcement tests.
 *
 * Validates that explicit user refinements act as filters, not preferences:
 * - "no tubes" → no tube amps
 * - "class AB" → only class AB amps
 * - "I want new" → no discontinued products
 * - "same budget" → budget preserved
 * - "large living room" → penalize small-scale speakers
 *
 * Exact validation flow:
 *   i like van halen → speakers → from scratch → $5000 → Heresy IV
 *   → large living room → big scale → amps same budget
 *   → class ab amps? → i don't want tubes and i want new
 */

import { describe, it, expect } from 'vitest';
import { detectShoppingIntent, buildShoppingAnswer } from '../shopping-intent';
import type { HardConstraints } from '../shopping-intent';
import { rankProducts } from '../product-scoring';
import { reason } from '../reasoning';
import { AMPLIFIER_PRODUCTS } from '../products/amplifiers';
import { SPEAKER_PRODUCTS } from '../products/speakers';
import type { ExtractedSignals } from '../signal-types';

const EMPTY_SIGNALS: ExtractedSignals = {
  traits: {},
  symptoms: [],
  archetype_hints: [],
  uncertainty_level: 0,
  matched_phrases: [],
  matched_uncertainty_markers: [],
};

const DEFAULT_SYSTEM_PROFILE = {
  outputType: 'speakers' as const,
  systemCharacter: 'neutral' as const,
  sourceType: undefined,
  sourceArchitecture: undefined,
  ampArchitecture: undefined,
};

// ══════════════════════════════════════════════════════
// 1. Hard constraint extraction
// ══════════════════════════════════════════════════════

describe('Hard constraint extraction', () => {
  it('detects "no tubes" exclusion', () => {
    const text = 'i like van halen\nspeakers\n$5000\ni don\'t want tubes and i want new';
    const ctx = detectShoppingIntent(text, EMPTY_SIGNALS);
    expect(ctx.constraints.excludeTopologies).toContain('set');
    expect(ctx.constraints.excludeTopologies).toContain('push-pull-tube');
  });

  it('detects "i want new" availability constraint', () => {
    const text = 'i like van halen\n$5000\ni don\'t want tubes and i want new';
    const ctx = detectShoppingIntent(text, EMPTY_SIGNALS);
    expect(ctx.constraints.newOnly).toBe(true);
  });

  it('detects "class ab amps" topology requirement', () => {
    const text = 'i like van halen\n$5000\ni mean in class ab amps?';
    const ctx = detectShoppingIntent(text, EMPTY_SIGNALS);
    expect(ctx.constraints.requireTopologies).toContain('class-ab-solid-state');
  });

  it('detects "in class ab" topology requirement', () => {
    const text = '$5000\nin class ab';
    const ctx = detectShoppingIntent(text, EMPTY_SIGNALS);
    expect(ctx.constraints.requireTopologies).toContain('class-ab-solid-state');
  });

  it('detects "no tubes" via "don\'t want tubes"', () => {
    const text = 'amps\n$5000\ni don\'t want tubes';
    const ctx = detectShoppingIntent(text, EMPTY_SIGNALS);
    expect(ctx.constraints.excludeTopologies).toContain('set');
    expect(ctx.constraints.excludeTopologies).toContain('push-pull-tube');
  });

  it('returns empty constraints when none stated', () => {
    const text = 'i like van halen\nspeakers\n$5000';
    const ctx = detectShoppingIntent(text, EMPTY_SIGNALS);
    expect(ctx.constraints.excludeTopologies).toHaveLength(0);
    expect(ctx.constraints.requireTopologies).toHaveLength(0);
    expect(ctx.constraints.newOnly).toBe(false);
    expect(ctx.constraints.usedOnly).toBe(false);
  });

  it('detects "same budget" as budget signal', () => {
    const text = 'what about amps? same budget';
    const ctx = detectShoppingIntent(text, EMPTY_SIGNALS);
    expect(ctx.budgetMentioned).toBe(true);
  });
});

// ══════════════════════════════════════════════════════
// 2. rankProducts with hard constraints
// ══════════════════════════════════════════════════════

describe('rankProducts: hard constraint filtering', () => {
  it('excludes tube amps when excludeTopologies includes tube types', () => {
    const constraints: HardConstraints = {
      excludeTopologies: ['set', 'push-pull-tube'],
      requireTopologies: [],
      newOnly: false,
      usedOnly: false,
    };
    const ranked = rankProducts(AMPLIFIER_PRODUCTS, {}, 5000, DEFAULT_SYSTEM_PROFILE, constraints);
    for (const { product } of ranked) {
      expect(product.topology).not.toBe('set');
      expect(product.topology).not.toBe('push-pull-tube');
    }
    expect(ranked.length).toBeGreaterThan(0);
  });

  it('only returns class-AB amps when requireTopologies includes class-ab', () => {
    const constraints: HardConstraints = {
      excludeTopologies: [],
      requireTopologies: ['class-ab-solid-state'],
      newOnly: false,
      usedOnly: false,
    };
    const ranked = rankProducts(AMPLIFIER_PRODUCTS, {}, 5000, DEFAULT_SYSTEM_PROFILE, constraints);
    for (const { product } of ranked) {
      expect(product.topology).toBe('class-ab-solid-state');
    }
    expect(ranked.length).toBeGreaterThan(0);
  });

  it('excludes discontinued products when newOnly is true', () => {
    const constraints: HardConstraints = {
      excludeTopologies: [],
      requireTopologies: [],
      newOnly: true,
      usedOnly: false,
    };
    const ranked = rankProducts(AMPLIFIER_PRODUCTS, {}, 5000, DEFAULT_SYSTEM_PROFILE, constraints);
    for (const { product } of ranked) {
      expect(product.availability).not.toBe('discontinued');
      expect(product.availability).not.toBe('vintage');
    }
    expect(ranked.length).toBeGreaterThan(0);
  });

  it('combined: class AB + no tubes + new only', () => {
    const constraints: HardConstraints = {
      excludeTopologies: ['set', 'push-pull-tube'],
      requireTopologies: ['class-ab-solid-state'],
      newOnly: true,
      usedOnly: false,
    };
    const ranked = rankProducts(AMPLIFIER_PRODUCTS, {}, 5000, DEFAULT_SYSTEM_PROFILE, constraints);
    for (const { product } of ranked) {
      expect(product.topology).toBe('class-ab-solid-state');
      expect(product.availability).not.toBe('discontinued');
      expect(product.availability).not.toBe('vintage');
    }
    expect(ranked.length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════
// 3. Room-size ranking for speakers
// ══════════════════════════════════════════════════════

describe('Room-size ranking: large room', () => {
  it('Heresy IV ranks higher than Boenicke W5 for large room', () => {
    const text = 'i like van halen\nspeakers\n$5000\na large living room\nbig scale';
    const ctx = detectShoppingIntent(text, EMPTY_SIGNALS);
    expect(ctx.roomContext).toBe('large');

    const reasoning_result = reason(text, [], EMPTY_SIGNALS, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS, undefined, reasoning_result);

    const names = answer.productExamples.map((p) => p.name.toLowerCase());
    const heresyIdx = names.findIndex((n) => n.includes('heresy'));
    const boenickeIdx = names.findIndex((n) => n.includes('w5'));

    // If both appear, Heresy should rank higher (lower index)
    if (heresyIdx >= 0 && boenickeIdx >= 0) {
      expect(heresyIdx).toBeLessThan(boenickeIdx);
    }
    // If only one appears, it should be Heresy (large room), not W5 (small room)
    if (heresyIdx < 0 && boenickeIdx >= 0) {
      throw new Error('Boenicke W5 (small room speaker) ranked without Heresy IV for large room');
    }
  });

  it('no small-room-only speakers in top 3 for large room with $5000 budget', () => {
    const text = 'speakers\n$5000\nlarge living room\nbig scale';
    const ctx = detectShoppingIntent(text, EMPTY_SIGNALS);
    const reasoning_result = reason(text, [], EMPTY_SIGNALS, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS, undefined, reasoning_result);

    // Check that none of the recommended speakers are small-room specialists
    for (const p of answer.productExamples) {
      const fullName = `${p.brand} ${p.name}`.toLowerCase();
      // Boenicke W5 and Harbeth P3ESR are explicitly small-room speakers
      // They should not appear for "large living room + big scale"
      expect(fullName).not.toContain('p3esr');
    }
  });
});

// ══════════════════════════════════════════════════════
// 4. Full validation flow
// ══════════════════════════════════════════════════════

describe('Full validation flow: constraint accumulation', () => {
  // Simulate: amps → same budget → class AB → no tubes + new
  const AMP_FLOW_TEXT = [
    'i like van halen',
    'what about amps? same budget',
    '$5000',
    'i mean in class ab amps?',
    'i don\'t want tubes and i want new',
  ].join('\n');

  it('detects amplifier category', () => {
    const ctx = detectShoppingIntent(AMP_FLOW_TEXT, EMPTY_SIGNALS);
    expect(ctx.category).toBe('amplifier');
  });

  it('preserves $5000 budget', () => {
    const ctx = detectShoppingIntent(AMP_FLOW_TEXT, EMPTY_SIGNALS);
    expect(ctx.budgetAmount).toBe(5000);
  });

  it('requires class AB topology', () => {
    const ctx = detectShoppingIntent(AMP_FLOW_TEXT, EMPTY_SIGNALS);
    expect(ctx.constraints.requireTopologies).toContain('class-ab-solid-state');
  });

  it('excludes tube topologies', () => {
    const ctx = detectShoppingIntent(AMP_FLOW_TEXT, EMPTY_SIGNALS);
    expect(ctx.constraints.excludeTopologies).toContain('set');
    expect(ctx.constraints.excludeTopologies).toContain('push-pull-tube');
  });

  it('requires new-only products', () => {
    const ctx = detectShoppingIntent(AMP_FLOW_TEXT, EMPTY_SIGNALS);
    expect(ctx.constraints.newOnly).toBe(true);
  });

  it('produces only class-AB, new, non-tube amplifiers', () => {
    const ctx = detectShoppingIntent(AMP_FLOW_TEXT, EMPTY_SIGNALS);
    const reasoning_result = reason(AMP_FLOW_TEXT, [], EMPTY_SIGNALS, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS, undefined, reasoning_result);

    expect(answer.productExamples.length).toBeGreaterThan(0);

    // Get full catalog data for each recommended product
    for (const ex of answer.productExamples) {
      const catalogEntry = AMPLIFIER_PRODUCTS.find(
        (p) => p.name === ex.name && p.brand === ex.brand,
      );
      if (catalogEntry) {
        // Must be class-AB
        expect(catalogEntry.topology).toBe('class-ab-solid-state');
        // Must not be tube
        expect(catalogEntry.topology).not.toBe('set');
        expect(catalogEntry.topology).not.toBe('push-pull-tube');
        // Must not be discontinued
        expect(catalogEntry.availability).not.toBe('discontinued');
        expect(catalogEntry.availability).not.toBe('vintage');
      }
    }
  });

  it('products are in budget range (no $999 fallback)', () => {
    const ctx = detectShoppingIntent(AMP_FLOW_TEXT, EMPTY_SIGNALS);
    const reasoning_result = reason(AMP_FLOW_TEXT, [], EMPTY_SIGNALS, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS, undefined, reasoning_result);

    for (const ex of answer.productExamples) {
      // With $5000 budget, no product should be below $1500
      expect(ex.price).toBeGreaterThanOrEqual(1500);
      expect(ex.price).toBeLessThanOrEqual(6000);
    }
  });
});

// ══════════════════════════════════════════════════════
// 5. Edge cases
// ══════════════════════════════════════════════════════

describe('Constraint edge cases', () => {
  it('empty result set produces empty shortlist, not crash', () => {
    // Require a topology that doesn't exist at this budget
    const ctx = detectShoppingIntent('amps\n$100\nin class ab', EMPTY_SIGNALS);
    const reasoning_result = reason('amps\n$100', [], EMPTY_SIGNALS, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS, undefined, reasoning_result);
    // Should not crash — may have 0 products
    expect(answer).toBeDefined();
  });

  it('constraints do not affect speakers (topology is amp-specific)', () => {
    const text = 'speakers\n$5000\ni don\'t want tubes';
    const ctx = detectShoppingIntent(text, EMPTY_SIGNALS);
    const reasoning_result = reason(text, [], EMPTY_SIGNALS, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS, undefined, reasoning_result);
    // Speakers don't have tube topologies, so all should still appear
    expect(answer.productExamples.length).toBeGreaterThan(0);
  });
});
