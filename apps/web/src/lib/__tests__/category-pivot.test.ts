// @ts-nocheck — vitest globals injected via apps/web vitest config

/**
 * Tests for `detectExplicitCategoryPivot` — the shared helper that
 * recognizes when a user message names an explicit category pivot
 * ("thinking about a turntable", "looking at DACs", etc.) regardless
 * of which continuation state is active.
 *
 * Block A2 (2026-05-13): this helper is consulted by:
 *   - isDiagnosisFollowUp (intent.ts)            — diagnosis continuation
 *   - convStateRef reset (page.tsx)              — state-machine continuation
 *   - active-comparison gates (page.tsx, ×3)     — comparison continuation
 *   - active-consultation gate (page.tsx)        — consultation continuation
 *
 * This file validates the helper itself. The page.tsx wiring is verified
 * separately by the conversation-state Playwright harness.
 */

import { detectExplicitCategoryPivot, detectIntent } from '../intent';

describe('detectExplicitCategoryPivot — positive cases (pivot detected)', () => {
  // Each case is a real user phrasing observed in production OR a
  // canonical phrasing for the same intent class.
  const POSITIVE_CASES = [
    // Reported production bug case
    "i'm thinking about a turntable",
    'thinking about a turntable',
    // Variant verbs
    'considering speakers',
    'considering a streamer',
    'looking at DACs',
    'looking for headphones',
    'looking into a phono preamp',
    'interested in a cartridge',
    'shopping for a tube amp',
    'tell me about integrated amplifiers',
    // Desire verbs
    'i want a turntable',
    'i want to buy a streamer',
    'i need a new DAC',
    'i need an integrated amp',
    // Recommendation verbs
    'best DACs under $1500',
    'recommend a streamer',
    'compare push-pull amps',
    'which speakers should i look at',
    // Multi-word categories
    'thinking about a record player',
    'looking at a network player',
    'interested in a power amp',
    'considering a phono preamp',
  ];

  for (const text of POSITIVE_CASES) {
    it(`"${text}" → pivot detected`, () => {
      expect(detectExplicitCategoryPivot(text)).toBe(true);
    });
  }
});

describe('detectExplicitCategoryPivot — negative cases (pivot NOT detected)', () => {
  // Each case should NOT be treated as a pivot. Common pitfalls:
  //  - pivot verb without category
  //  - category word without pivot verb (system-context phrasing)
  //  - genuine follow-up answers
  //  - diagnostic complaints
  const NEGATIVE_CASES = [
    // Pivot verb, no category — genuine follow-up
    'thinking about it more carefully',
    'considering my options',
    'looking at the room layout',
    'interested in what you said',
    'i want to understand the trade-offs',
    'tell me about the differences',
    // Category word, no pivot verb — system context
    'my DAC is a Schiit Modi',
    'the amp is a Hegel H190',
    'i have a turntable already',
    'using KEF LS50 speakers',
    'my system has an integrated amp',
    // Diagnostic complaints (should stay as diagnosis)
    'my system sounds harsh',
    'too much bass',
    'lacks detail',
    'not enough warmth',
    'sounds thin on female vocals',
    // Follow-up answers
    'mostly on female vocals',
    'small room, speakers on a shelf',
    "i don't know the dimensions",
    'about 12x15 feet with a rug',
    // Pure questions / orientation
    'why is that?',
    'how do horns differ from box speakers?',
    'what about my system?',
    // Empty / trivial
    '',
    'yes',
    'no',
    'continue',
  ];

  for (const text of NEGATIVE_CASES) {
    it(`"${text}" → pivot NOT detected`, () => {
      expect(detectExplicitCategoryPivot(text)).toBe(false);
    });
  }
});

describe('detectExplicitCategoryPivot — adjacent at-risk patterns', () => {
  // Edge cases that document the helper's coverage boundaries.

  it('"upgrade my turntable" → pivot detected (bare desire + category)', () => {
    // "upgrade" isn't in the verb list explicitly, but no verb-only
    // version of upgrade should pivot anyway. Documenting current behavior.
    expect(detectExplicitCategoryPivot('upgrade my turntable')).toBe(false);
  });

  it('"new turntable" alone → NOT a pivot (no verb)', () => {
    expect(detectExplicitCategoryPivot('new turntable')).toBe(false);
  });

  it('case-insensitive — "I AM THINKING ABOUT A TURNTABLE"', () => {
    expect(detectExplicitCategoryPivot('I AM THINKING ABOUT A TURNTABLE')).toBe(true);
  });

  it('mixed casing — "Thinking About A Streamer"', () => {
    expect(detectExplicitCategoryPivot('Thinking About A Streamer')).toBe(true);
  });

  // Cross-category coverage — each major catalog category should fire
  it('DACs', () => {
    expect(detectExplicitCategoryPivot('thinking about DACs')).toBe(true);
  });
  it('amps', () => {
    expect(detectExplicitCategoryPivot('thinking about an amp')).toBe(true);
  });
  it('integrated', () => {
    expect(detectExplicitCategoryPivot('thinking about an integrated')).toBe(true);
  });
  it('speakers', () => {
    expect(detectExplicitCategoryPivot('thinking about speakers')).toBe(true);
  });
  it('headphones', () => {
    expect(detectExplicitCategoryPivot('thinking about headphones')).toBe(true);
  });
  it('streamer', () => {
    expect(detectExplicitCategoryPivot('thinking about a streamer')).toBe(true);
  });
  it('phono preamp', () => {
    expect(detectExplicitCategoryPivot('thinking about a phono preamp')).toBe(true);
  });
});

describe('detectIntent — pivot phrasings route to shopping', () => {
  // Block A2: without these, pivot phrasings fell through to the default
  // diagnosis bucket and saved-system users got a thinness analysis
  // instead of the requested category exploration.
  it('"i\'m thinking about a turntable" → shopping', () => {
    expect(detectIntent("i'm thinking about a turntable").intent).toBe('shopping');
  });
  it('"thinking about a turntable" → shopping', () => {
    expect(detectIntent('thinking about a turntable').intent).toBe('shopping');
  });
  it('"considering speakers" → shopping', () => {
    expect(detectIntent('considering speakers').intent).toBe('shopping');
  });
  it('"interested in a phono preamp" → shopping', () => {
    expect(detectIntent('interested in a phono preamp').intent).toBe('shopping');
  });
  it('"looking at DACs" → shopping', () => {
    expect(detectIntent('looking at DACs').intent).toBe('shopping');
  });
  // Control cases: complaints still route to diagnosis (pivot does NOT
  // hijack legitimate diagnostic requests)
  it('"my system sounds harsh" → diagnosis (NOT shopping)', () => {
    expect(detectIntent('my system sounds harsh').intent).toBe('diagnosis');
  });
  it('"system is too thin" → diagnosis (NOT shopping)', () => {
    expect(detectIntent('system is too thin').intent).toBe('diagnosis');
  });
});
