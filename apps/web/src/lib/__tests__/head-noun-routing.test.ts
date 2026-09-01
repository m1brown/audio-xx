import { describe, it, expect } from 'vitest';
import { detectShoppingIntent } from '../shopping-intent';
import type { ExtractedSignals } from '../signal-types';

/**
 * Founder-reported (2026-08-13): "what are the best speakers for a job
 * amplifier?" returned three AMPLIFIERS.
 *
 * Cause: the "for <category>" priority patterns read the noun AFTER "for" as
 * the requested class. That is right when no category precedes it
 * ("recommendations for speakers") and inverted for a partner phrase
 * ("speakers FOR a job amplifier"), where the amplifier is context. The
 * failure was symmetric — "best amp for my speakers" resolved to speaker.
 *
 * The requestedCategory resolution carried the same gap as documented
 * limitation G3 in routing-doctrine.md. Both sites now consult one shared
 * rule: the request head noun before "for" outranks the partner after it.
 */
const E: ExtractedSignals = {
  traits: {}, symptoms: [], archetype_hints: [], uncertainty_level: 0,
  matched_phrases: [], matched_uncertainty_markers: [],
};
const cat = (q: string) => detectShoppingIntent(q, E, [], q).category;

describe('the request head noun outranks a partner named after "for"', () => {
  const CASES: Array<[string, string]> = [
    ['what are the best speakers for a job amplifier ?', 'speaker'],
    ['best speakers for a job amplifier', 'speaker'],
    ['speakers for my amplifier', 'speaker'],
    ['speakers for a tube amp', 'speaker'],
    ['what are the best amps for my WLM Diva monitor?', 'amplifier'],
    ['best amp for my speakers', 'amplifier'],
    ['what dac for my leben', 'dac'],
    ['iems for my phone', 'headphone'],
  ];
  for (const [q, expected] of CASES) {
    it(`"${q}" → ${expected}`, () => expect(cat(q)).toBe(expected));
  }

  // Controls: with NO category before "for", the noun after it IS the request.
  const AFTER_FOR: Array<[string, string]> = [
    ['recommendations for speakers', 'speaker'],
    ['suggestions for a dac', 'dac'],
    ['what should I get for my amplifier', 'amplifier'],
  ];
  for (const [q, expected] of AFTER_FOR) {
    it(`control: "${q}" → ${expected}`, () => expect(cat(q)).toBe(expected));
  }

  it('control: golden-gate X1 — "recommend a DAC for my headphones" stays a DAC request', () => {
    expect(cat('recommend a DAC for my headphones')).toBe('dac');
  });

  it('control: REC-1 — an explicit IEM request is unaffected', () => {
    expect(cat('I want some IEMs')).toBe('headphone');
    expect(cat('Recommend speakers')).toBe('speaker');
  });
});
