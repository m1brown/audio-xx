import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';

/**
 * Founder-reported (2026-08-13): after a system assessment, "what about cheap
 * iems?" returned "Still with Dmp-a6…" — the knowledge lane carrying the
 * previous subject forward instead of answering about IEMs.
 *
 * Two causes, both in detectIntent:
 *   1. `hasCategoryTarget` listed "headphones" but not iems/earphones/earbuds,
 *      so even a purchase verb aimed at IEMs missed the shopping route.
 *   2. `bareCategory` required the message to be ONLY the category, so any
 *      qualifier ("cheap iems") fell through.
 *
 * CLAUDE.md invariant at stake: "explicit category overrides previous
 * category."
 */
describe('a qualified category request is a shopping request', () => {
  const SHOPPING = [
    'what about cheap iems?',
    'what about budget iems?',
    'cheap iems',
    'cheap iems?',
    'any good speakers?',
    'what about affordable headphones?',
    'how about budget dacs?',
    'better amps?',
    'some decent earbuds',
  ];
  for (const q of SHOPPING) {
    it(`"${q}" routes to shopping`, () => {
      expect(detectIntent(q).intent).toBe('shopping');
    });
  }

  // Controls — these must NOT be swept into shopping by the new pattern.
  const NOT_SHOPPING = [
    'what about the Chord Hugo?',      // a named product, not a class
    'what about my amp?',              // possessive — about their own gear
    'what about placement?',           // not a category at all
    'what about the warmth?',          // a quality, not a category
  ];
  for (const q of NOT_SHOPPING) {
    it(`control: "${q}" is not routed to shopping`, () => {
      expect(detectIntent(q).intent).not.toBe('shopping');
    });
  }

  it('control: an assessment request still routes to assessment, not shopping', () => {
    const i = detectIntent('Assess my system: Job integrated, WLM Diva monitor, Eversolo DMP-A6');
    expect(i.intent).not.toBe('shopping');
  });

  it('IEMs are recognised as a category target alongside headphones', () => {
    expect(detectIntent('recommend some iems').intent).toBe('shopping');
    expect(detectIntent('I want to buy earbuds').intent).toBe('shopping');
  });
});
