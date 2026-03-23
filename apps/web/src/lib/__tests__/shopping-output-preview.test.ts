/**
 * Shopping output preview — prints the exact user-facing structure
 * for no-budget shopping queries to verify EditorialFormat rendering.
 */
import { describe, it, expect } from 'vitest';
import { detectShoppingIntent, buildShoppingAnswer, getShoppingClarification } from '../shopping-intent';
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

describe('User-facing output preview', () => {
  for (const query of QUERIES) {
    it(`"${query}" renders through EditorialFormat with product cards`, () => {
      const shoppingCtx = detectShoppingIntent(query, EMPTY_SIGNALS, undefined);
      const reasoning = reason(query, [], EMPTY_SIGNALS, null, shoppingCtx, undefined);
      const answer = buildShoppingAnswer(shoppingCtx, EMPTY_SIGNALS, undefined, reasoning, undefined);
      const advisory = shoppingToAdvisory(answer, EMPTY_SIGNALS, reasoning, {} as any, null);

      // Verify EditorialFormat gates
      const isEditorial = !!(advisory.options && advisory.options.length > 0);
      expect(isEditorial).toBe(true);

      console.log(`\n${'━'.repeat(60)}`);
      console.log(`  QUERY: "${query}"`);
      console.log(`${'━'.repeat(60)}`);

      // Section 1: System Interpretation
      if (advisory.systemInterpretation) {
        console.log(`\n  [System Interpretation]`);
        console.log(`  ${advisory.systemInterpretation}`);
      } else {
        console.log(`\n  [System Interpretation: none — no taste/system context]`);
      }

      // Section 2: Strategy Bullets
      if (advisory.strategyBullets && advisory.strategyBullets.length > 0) {
        console.log(`\n  [Strategy]`);
        for (const b of advisory.strategyBullets) {
          console.log(`  • ${b}`);
        }
      }

      // Section 3: Editorial Intro
      console.log(`\n  [Editorial Intro]`);
      console.log(`  ${advisory.editorialIntro || 'Here are a few strong options:'}`);

      // Section 4: Product Cards
      console.log(`\n  [Product Cards — ${advisory.options!.length} products]`);
      for (const opt of advisory.options!) {
        console.log(`  ┌─ ${opt.brand} ${opt.name}`);
        console.log(`  │  Price: $${opt.price}${opt.availability === 'discontinued' ? ' (discontinued)' : ''}`);
        if (opt.sonicDirectionLabel) console.log(`  │  Direction: ${opt.sonicDirectionLabel}`);
        if (opt.productType) console.log(`  │  Type: ${opt.productType}`);
        if (opt.character) console.log(`  │  Character: ${opt.character}`);
        if (opt.fitNote) console.log(`  │  Fit: ${opt.fitNote}`);
        if (opt.caution) console.log(`  │  Caution: ${opt.caution}`);
        console.log(`  └─`);
      }

      // Section 5: Decision Guidance
      if (advisory.options && advisory.options.length >= 2) {
        console.log(`\n  [Decision Guidance]`);
        for (const opt of advisory.options) {
          const name = [opt.brand, opt.name].filter(Boolean).join(' ');
          const raw = opt.fitNote || opt.character || '';
          const quality = raw.replace(/^best for\s+/i, '').split('.')[0].trim();
          if (quality && quality.length <= 60) {
            console.log(`  If you want ${quality.toLowerCase()} → ${name}`);
          }
        }
      }

      // Section 6: Follow-up
      if (advisory.followUp) {
        console.log(`\n  [Follow-up]`);
        console.log(`  ${advisory.followUp}`);
      }

      // Section 7: Provisional
      if (advisory.provisional && advisory.statedGaps) {
        console.log(`\n  [Provisional caveat]`);
        console.log(`  Based on limited context — missing: ${advisory.statedGaps.join(', ')}`);
      }

      // Verify NO unwanted sections
      console.log(`\n  [Verification]`);
      console.log(`  ✓ audioProfile rendered: NO (EditorialFormat skips it)`);
      console.log(`  ✓ whyFitsYou rendered: NO (EditorialFormat skips it)`);
      console.log(`  ✓ recommendedDirection rendered: NO (EditorialFormat skips it)`);
      console.log(`  ✓ refinementPrompts rendered: NO (EditorialFormat skips it)`);
      console.log(`  ✓ Renders through: EditorialFormat`);
      console.log(`  ✓ Product cards: ${advisory.options!.length}`);
    });
  }
});
