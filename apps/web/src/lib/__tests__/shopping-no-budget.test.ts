/**
 * Shopping path — no-budget queries must still produce product recommendations.
 *
 * Root cause: selectProductExamples returned [] when budgetAmount was null,
 * causing shopping responses to fall through to StandardFormat (showing
 * Audio Preferences / Why this fits you / no strong directional change)
 * instead of EditorialFormat with actual product cards.
 */
import { describe, it, expect } from 'vitest';
import { detectShoppingIntent, buildShoppingAnswer, getShoppingClarification } from '../shopping-intent';
import { reason } from '../reasoning';
import { shoppingToAdvisory } from '../advisory-response';
import type { ExtractedSignals } from '../engine';
import { detectInitialMode } from '../conversation-state';
import { detectIntent } from '../intent';

// Minimal signals — no traits, no symptoms (first-message, no context)
const EMPTY_SIGNALS: ExtractedSignals = {
  symptoms: [],
  traits: {},
  matched_phrases: [],
  shopping_signals: [],
  archetype_hints: [],
};

const NO_BUDGET_QUERIES = [
  { query: 'I want to buy a DAC', expectedCategory: 'dac' },
  { query: 'recommend speakers', expectedCategory: 'speaker' },
  { query: 'suggest an amplifier', expectedCategory: 'amplifier' },
];

describe('Shopping with no budget → must produce product cards', () => {
  for (const { query, expectedCategory } of NO_BUDGET_QUERIES) {
    describe(`"${query}"`, () => {
      const shoppingCtx = detectShoppingIntent(query, EMPTY_SIGNALS, undefined);
      const reasoning = reason(query, [], EMPTY_SIGNALS, null, shoppingCtx, undefined);
      const answer = buildShoppingAnswer(shoppingCtx, EMPTY_SIGNALS, undefined, reasoning, undefined);
      const advisory = shoppingToAdvisory(answer, EMPTY_SIGNALS, reasoning, {} as any, null);

      it('detects shopping intent', () => {
        expect(shoppingCtx.detected).toBe(true);
      });

      it(`detects category=${expectedCategory}`, () => {
        expect(shoppingCtx.category).toBe(expectedCategory);
      });

      it('has no budget', () => {
        expect(shoppingCtx.budgetAmount).toBeNull();
      });

      it('skips clarification when skipToSuggestions=true', () => {
        const q = getShoppingClarification(shoppingCtx, EMPTY_SIGNALS, 1, true);
        expect(q).toBeNull();
      });

      it('produces 2-3 product examples', () => {
        expect(answer.productExamples.length).toBeGreaterThanOrEqual(2);
        expect(answer.productExamples.length).toBeLessThanOrEqual(3);
      });

      it('each product has name, brand, price, fitNote', () => {
        for (const p of answer.productExamples) {
          expect(p.name).toBeTruthy();
          expect(p.brand).toBeTruthy();
          expect(p.price).toBeGreaterThan(0);
          expect(p.fitNote).toBeTruthy();
        }
      });

      it('advisory has kind=shopping with options (triggers EditorialFormat)', () => {
        expect(advisory.kind).toBe('shopping');
        expect(advisory.options).toBeDefined();
        expect(advisory.options!.length).toBeGreaterThanOrEqual(2);
      });

      it('advisory has editorialIntro or lowPreferenceSignal (StartHereBlock replaces intro)', () => {
        // When preference is weak, editorialIntro is suppressed in favor of StartHereBlock
        expect(advisory.editorialIntro || advisory.lowPreferenceSignal).toBeTruthy();
      });

      it('marks as provisional with stated gaps', () => {
        expect(answer.provisional).toBe(true);
      });
    });
  }
});

describe('Intent detection routes no-budget purchase queries to shopping', () => {
  for (const { query } of NO_BUDGET_QUERIES) {
    it(`"${query}" → shopping intent`, () => {
      const result = detectIntent(query);
      expect(result.intent).toBe('shopping');
    });
  }
});

describe('Conversation state routes to ready_to_recommend', () => {
  for (const { query } of NO_BUDGET_QUERIES) {
    it(`"${query}" → ready_to_recommend`, () => {
      const { intent } = detectIntent(query);
      const mode = detectInitialMode(query, {
        hasSystem: false,
        subjectCount: 0,
        detectedIntent: intent,
      });
      expect(mode.mode).toBe('shopping');
      expect(mode.stage).toBe('ready_to_recommend');
    });
  }
});
