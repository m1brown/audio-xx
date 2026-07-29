/**
 * Typed requested-category constraint (production G1 fix).
 *
 * "what other streamers would you recommend?" produced DAC education + DAC picks
 * because a carried-forward 'dac' lock overrode the explicitly-named 'streamer'
 * (the current-utterance category scan is suppressed when a fallback is present).
 *
 * Invariant: a product class named in the CURRENT utterance is a typed immutable
 * constraint — it must win over any carried-forward fallback/lock.
 */
import { describe, it, expect } from 'vitest';
import { detectShoppingIntent } from '@/lib/shopping-intent';

const SIGNALS = { traits: {}, symptoms: [], direction: [], preserve: [], context: [] } as never;

describe('requestedCategory — explicit class beats stale lock', () => {
  it('the observed failure: streamer request under a stale dac lock resolves to streamer', () => {
    const ctx = detectShoppingIntent(
      'what other streamers would you recommend?',
      SIGNALS,
      undefined,
      'what other streamers would you recommend?', // latestMessage
      'dac', // stale carried-forward lock
    );
    expect(ctx.requestedCategory).toBe('streamer');
    expect(ctx.category).toBe('streamer'); // NOT 'dac'
  });

  it('captures requestedCategory for other classes and lets it override a mismatched fallback', () => {
    const amp = detectShoppingIntent('what integrated amplifier would you suggest?', SIGNALS, undefined,
      'what integrated amplifier would you suggest?', 'dac');
    expect(amp.requestedCategory).toBe('amplifier');
    expect(amp.category).toBe('amplifier');

    const tt = detectShoppingIntent('any turntable recommendations?', SIGNALS, undefined,
      'any turntable recommendations?', 'streamer');
    expect(tt.requestedCategory).toBe('turntable');
    expect(tt.category).toBe('turntable');
  });

  it('when the utterance names NO class, requestedCategory is undefined and the lock still carries', () => {
    const ctx = detectShoppingIntent('what about under $2000?', SIGNALS, undefined,
      'what about under $2000?', 'dac');
    expect(ctx.requestedCategory).toBeUndefined();
    // With no explicit class this turn, the carried-forward category is preserved.
    expect(ctx.category).toBe('dac');
  });
});
