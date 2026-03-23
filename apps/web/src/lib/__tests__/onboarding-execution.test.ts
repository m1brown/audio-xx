/**
 * Integration test: exercises the client-side execution path after
 * /api/evaluate returns successfully.
 *
 * Mimics what page.tsx does after res.ok:
 *   1. detectShoppingIntent(synthesized, signals)
 *   2. reason(synthesized, ...)
 *   3. buildShoppingAnswer(...)
 *   4. buildDecisionFrame(...)
 *   5. shoppingToAdvisory(...)
 *   6. attachQuickRecommendation(...)
 *
 * Uses realistic but minimal signals to avoid needing the YAML engine.
 */

import { describe, it, expect } from 'vitest';
import { detectShoppingIntent, buildShoppingAnswer } from '../shopping-intent';
import { reason } from '../reasoning';
import { buildDecisionFrame } from '../decision-frame';
import { shoppingToAdvisory } from '../advisory-response';
import type { ShoppingAdvisoryContext } from '../advisory-response';
import { attachQuickRecommendation } from '../quick-recommendation';
import type { ExtractedSignals } from '../signal-types';

/** Realistic minimal signals — what the engine returns for music descriptions. */
const MUSIC_SIGNALS: ExtractedSignals = {
  traits: { warmth: 'boost', dynamics: 'boost' },
  symptoms: [],
  archetype_hints: [],
  uncertainty_level: 0.3,
  matched_phrases: ['van halen'],
  matched_uncertainty_markers: [],
};

const EMPTY_CTX: ShoppingAdvisoryContext = {
  systemComponents: undefined,
  systemLocation: undefined,
  systemPrimaryUse: undefined,
  storedDesires: undefined,
  systemTendencies: undefined,
};

const SYNTHESIZED_QUERIES = [
  {
    query: 'I listen to van halen. Looking for speakers under $5000. Starting from scratch.',
    category: 'speakers',
    label: 'speakers from-scratch with budget',
  },
  {
    query: 'I listen to van halen. Looking for speakers under $5000.',
    category: 'speakers',
    label: 'speakers without from-scratch',
  },
  {
    query: 'I listen to jazz. Looking for headphones under $500. Starting from scratch.',
    category: 'headphones',
    label: 'headphones from-scratch',
  },
  {
    query: 'I listen to electronic music. Looking for speakers under $2,000. Starting from scratch.',
    category: 'speakers',
    label: 'speakers electronic from-scratch',
  },
];

describe('Synthesized query execution pipeline (post-evaluate)', () => {
  for (const { query, category, label } of SYNTHESIZED_QUERIES) {
    it(`full pipeline for: "${label}"`, () => {
      // Step 1: detectShoppingIntent
      let shoppingCtx: ReturnType<typeof detectShoppingIntent>;
      expect(() => {
        shoppingCtx = detectShoppingIntent(query, MUSIC_SIGNALS, undefined);
      }).not.toThrow();
      expect(shoppingCtx!).toBeTruthy();
      expect(shoppingCtx!.detected).toBe(true);

      // Step 2: reason
      let reasonResult: ReturnType<typeof reason>;
      expect(() => {
        reasonResult = reason(query, [], MUSIC_SIGNALS, null, shoppingCtx!, null);
      }).not.toThrow();

      // Step 3: buildShoppingAnswer
      let answer: ReturnType<typeof buildShoppingAnswer>;
      expect(() => {
        answer = buildShoppingAnswer(shoppingCtx!, MUSIC_SIGNALS, undefined, reasonResult!, undefined);
      }).not.toThrow();
      expect(answer!).toBeTruthy();

      // Step 4: buildDecisionFrame
      let decisionFrame: ReturnType<typeof buildDecisionFrame>;
      expect(() => {
        decisionFrame = buildDecisionFrame(shoppingCtx!.category, EMPTY_CTX, undefined);
      }).not.toThrow();

      // Step 5: shoppingToAdvisory
      let advisory: ReturnType<typeof shoppingToAdvisory>;
      expect(() => {
        advisory = shoppingToAdvisory(answer!, MUSIC_SIGNALS, reasonResult!, EMPTY_CTX, decisionFrame!);
      }).not.toThrow();
      expect(advisory!).toBeTruthy();

      // Step 6: attachQuickRecommendation
      let quickAdvisory: typeof advisory;
      expect(() => {
        const catLabel = category === 'headphones' ? 'headphones' : 'speakers';
        quickAdvisory = attachQuickRecommendation(advisory!, catLabel, `You're looking for ${catLabel} under $5000.`);
      }).not.toThrow();
      expect(quickAdvisory!).toBeTruthy();

      // Verify the advisory has actual product recommendations
      console.log(`\n── ${label} ──`);
      console.log(`  shopping mode: ${shoppingCtx!.mode}`);
      console.log(`  category: ${shoppingCtx!.category}`);
      console.log(`  budget: ${shoppingCtx!.budgetAmount}`);
      if (advisory!.whyThisFits) {
        console.log(`  suggestions: ${advisory!.whyThisFits.length}`);
      }
    });
  }
});

describe('Shopping context for from-scratch queries', () => {
  it('"from scratch" → build-a-system mode', () => {
    const ctx = detectShoppingIntent(
      'I listen to van halen. Looking for speakers under $5000. Starting from scratch.',
      MUSIC_SIGNALS,
      undefined,
    );
    expect(ctx.mode).toBe('build-a-system');
    expect(ctx.category).toBe('speaker');
    expect(ctx.budgetMentioned).toBe(true);
  });

  it('without "from scratch" → specific-component mode', () => {
    const ctx = detectShoppingIntent(
      'I listen to van halen. Looking for speakers under $5000.',
      MUSIC_SIGNALS,
      undefined,
    );
    expect(ctx.mode).toBe('specific-component');
  });
});
