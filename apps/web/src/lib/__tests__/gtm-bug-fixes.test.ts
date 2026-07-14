/**
 * GTM bug-fix regressions (2026-07-05).
 *
 * Bug 1 — Bluetooth speaker misroute: "what's the best bluetooth
 * speaker?" entered the shopping lane as generic category 'speaker'
 * and was answered with passive hi-fi floorstanders (DeVore O/96).
 * The catalog contains no Bluetooth/portable/smart speakers, so these
 * queries must skip shopping entirely and route to the knowledge lane,
 * which answers the consumer question naturally.
 */
import { describe, it, expect } from 'vitest';
import { detectShoppingIntent, LIFESTYLE_SPEAKER_PATTERN } from '../shopping-intent';
import { detectIntent } from '../intent';
import type { ExtractedSignals } from '../signal-types';

const EMPTY_SIGNALS: ExtractedSignals = {
  traits: {},
  symptoms: [],
  archetype_hints: [],
  uncertainty_level: 0.5,
  matched_phrases: [],
  matched_uncertainty_markers: [],
};

describe('Bug 1: Bluetooth speaker queries never reach hi-fi shopping', () => {
  it('the exact failing query skips shopping and routes to the knowledge lane', () => {
    const q = "what's the best bluetooth speaker?";
    expect(detectShoppingIntent(q, EMPTY_SIGNALS).detected).toBe(false);
    expect(detectIntent(q).intent).toBe('audio_knowledge');
  });

  it('portable and smart speaker phrasings are covered', () => {
    for (const q of ['best portable speaker for the beach', 'recommend a smart speaker', 'good speakers with bluetooth']) {
      expect(detectShoppingIntent(q, EMPTY_SIGNALS).detected).toBe(false);
      expect(detectIntent(q).intent).toBe('audio_knowledge');
    }
  });

  it('component hi-fi speaker shopping is unchanged', () => {
    for (const q of ['best bookshelf speakers under $2000', 'what speakers should I buy for my Naim amp']) {
      const ctx = detectShoppingIntent(q, EMPTY_SIGNALS);
      expect(ctx.detected).toBe(true);
      expect(ctx.category).toBe('speaker');
      expect(detectIntent(q).intent).toBe('shopping');
    }
  });

  it('the pattern does not overreach into non-speaker bluetooth questions', () => {
    expect(LIFESTYLE_SPEAKER_PATTERN.test('does the Eversolo have bluetooth input')).toBe(false);
    expect(LIFESTYLE_SPEAKER_PATTERN.test('best DAC under $1000')).toBe(false);
  });
});
