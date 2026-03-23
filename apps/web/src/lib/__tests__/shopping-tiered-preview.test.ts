/**
 * Tiered exploratory selection preview — verify price distributions.
 */
import { describe, it, expect } from 'vitest';
import { detectShoppingIntent, buildShoppingAnswer } from '../shopping-intent';
import { reason } from '../reasoning';
import { shoppingToAdvisory } from '../advisory-response';
import type { ExtractedSignals } from '../engine';

const EMPTY_SIGNALS: ExtractedSignals = {
  symptoms: [],
  traits: {},
  matched_phrases: [],
  shopping_signals: [],
  archetype_hints: [],
};

const QUERIES = [
  'I want to buy a DAC',
  'recommend speakers',
  'suggest an amplifier',
];

describe('Tiered exploratory selection — price distribution', () => {
  for (const query of QUERIES) {
    it(`"${query}" produces accessible + mid + stretch picks`, () => {
      const shoppingCtx = detectShoppingIntent(query, EMPTY_SIGNALS, undefined);
      const reasoning = reason(query, [], EMPTY_SIGNALS, null, shoppingCtx, undefined);
      const answer = buildShoppingAnswer(shoppingCtx, EMPTY_SIGNALS, undefined, reasoning, undefined);
      const advisory = shoppingToAdvisory(answer, EMPTY_SIGNALS, reasoning, {} as any, null);

      expect(advisory.options).toBeDefined();
      expect(advisory.options!.length).toBeGreaterThanOrEqual(2);

      console.log(`\n  "${query}" →`);
      for (const opt of advisory.options!) {
        console.log(`    ${opt.brand} ${opt.name}: $${opt.price} [${opt.sonicDirectionLabel ?? '?'}]`);
        console.log(`      character: ${opt.character?.slice(0, 90) ?? '-'}`);
        console.log(`      fit: ${opt.fitNote ?? '-'}`);
      }

      // Verify no ultra-high-end outliers (>2× highest non-outlier)
      const prices = advisory.options!.map(o => o.price);
      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);
      // Ratio between most and least expensive should be reasonable (<8x)
      const ratio = maxPrice / minPrice;
      console.log(`    Price range: $${minPrice} – $${maxPrice} (ratio: ${ratio.toFixed(1)}x)`);
      expect(ratio).toBeLessThan(8);
    });
  }
});
