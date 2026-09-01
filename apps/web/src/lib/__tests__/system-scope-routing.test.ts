import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';
import { isIntakeQuery } from '../intake';

/**
 * Founder-reported twice (2026-08-13): "help me find a system with a 5000
 * budget" answered with $79–$100 IEMs, and "i mean a 2 channel stereo —
 * speakers, amplifier, etc" answered with amplifiers alone.
 *
 * Audio XX has no whole-system recommendation path: such a request resolves
 * to shopping category 'general', which returns ZERO picks, and the empty
 * answer then falls through to unrelated content. The intake flow exists for
 * exactly this shape ("I want a new stereo" → structured questions), but:
 *
 *   1. Its patterns covered "want/need a system", not "help me find/build a
 *      system" or "2 channel stereo".
 *   2. GUARD_THRESHOLD is 1, and a single "$5000" match skipped intake — the
 *      guard exists to skip intake when there is enough detail to go straight
 *      to shopping, but no shopping path can serve a whole system, so more
 *      detail cannot make the request servable.
 */
describe('whole-system requests reach intake, not an empty shopping answer', () => {
  for (const q of [
    'help me find a system with a 5000 budget',
    'help me build a system for $5000',
    'i mean a 2 channel stereo - speakers, amplifier, etc',
    'put together a system for me',
    'help me choose a first hifi',
    'I want a new stereo',
  ]) {
    it(`"${q}" routes to intake`, () => {
      expect(detectIntent(q).intent).toBe('intake');
    });
  }

  it('system scope bypasses the specificity guard, single-category does not', () => {
    // A budget alone would normally skip intake (GUARD_THRESHOLD = 1)…
    expect(isIntakeQuery('help me build a system for $5000', 0)).toBe(true);
    // …and still does for a request shopping can actually serve.
    expect(detectIntent('I need speakers under $1500 for rock in a small room').intent).toBe('shopping');
  });

  it('controls: single-category and non-shopping intents are unchanged', () => {
    expect(detectIntent('recommend a DAC under $2000').intent).toBe('shopping');
    expect(detectIntent('cheap iems please').intent).toBe('shopping');
    expect(detectIntent('Assess my system: Job integrated, WLM Diva monitor, Eversolo DMP-A6').intent)
      .toBe('system_assessment');
    expect(detectIntent('what do you think of Shindo?').intent).toBe('gear_inquiry');
  });

  it('control: naming two specific products means the user is past intake', () => {
    expect(isIntakeQuery('help me build a system with the Leben CS600X and Harbeth P3ESR', 2)).toBe(false);
  });
});
