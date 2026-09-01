import { describe, it, expect } from 'vitest';
import { detectShoppingIntent, buildShoppingAnswer } from '../shopping-intent';
import { extractDesires } from '../intent';
import { reason } from '../reasoning';
import type { ExtractedSignals } from '../signal-types';

/**
 * Founder-reported (2026-08-13): "what about cheap iems?" — once routing was
 * fixed — answered with the $1,799 Campfire Solaris.
 *
 * Two causes:
 *   1. selectProductExamples early-returns into selectHeadphoneExamples for
 *      the headphone category, BEFORE the generic ranked path applies its
 *      affordability ceiling. `budgetConscious` was never even passed in, so
 *      personal audio had no affordability guard at all.
 *   2. The affordability regex matched "budget-friendly" and "on a budget"
 *      but not a bare "budget iems".
 *
 * The generic ceiling ($3,000) is category-blind and useless here; personal
 * audio uses $150, which is what the words mean in this category.
 */
const EMPTY: ExtractedSignals = {
  traits: {}, symptoms: [], archetype_hints: [], uncertainty_level: 0,
  matched_phrases: [], matched_uncertainty_markers: [],
};

function picks(q: string) {
  const ctx = detectShoppingIntent(q, EMPTY, [], q);
  const r = reason(q, extractDesires(q), EMPTY, null, ctx, undefined);
  const a = buildShoppingAnswer(ctx, EMPTY, undefined, r, []);
  return { ctx, prices: a.productExamples.map((p) => p.price).filter((n): n is number => typeof n === 'number') };
}

describe('colloquial affordability constrains personal-audio picks', () => {
  for (const q of ['what about cheap iems?', 'budget iems', 'cheap iems', 'affordable headphones', 'inexpensive earphones']) {
    it(`"${q}" recommends nothing above $150`, () => {
      const { ctx, prices } = picks(q);
      expect(ctx.budgetConscious, 'affordability signal detected').toBe(true);
      expect(prices.length).toBeGreaterThan(0);
      for (const p of prices) expect(p).toBeLessThanOrEqual(150);
    });
  }

  it('control: an explicit prestige cue still reaches flagship gear', () => {
    const { ctx, prices } = picks('high-end iems');
    expect(ctx.budgetConscious ?? false).toBe(false);
    expect(Math.max(...prices)).toBeGreaterThan(500);
  });

  it('control: an explicit budget wins over the colloquial ceiling', () => {
    const { prices } = picks('iems under $500');
    expect(prices.length).toBeGreaterThan(0);
    for (const p of prices) expect(p).toBeLessThanOrEqual(500 * 1.15);
    // and is NOT clamped to the $150 affordability ceiling
    expect(Math.max(...prices)).toBeGreaterThan(150);
  });

  it('control: speakers are unaffected by the personal-audio ceiling', () => {
    const { prices } = picks('affordable speakers');
    expect(prices.length).toBeGreaterThan(0);
  });
});
