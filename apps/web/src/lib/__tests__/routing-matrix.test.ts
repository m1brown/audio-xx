/**
 * PHASE 2 — deterministic routing golden gate.
 *
 * Probes the production category-routing path across the founder's axes:
 * standalone naming, follow-up/lock context, noun-first explicit requests,
 * incidental mentions (must NOT switch), verb-first switches, and cross-domain
 * contamination (the request head noun must win).
 *
 * FIDELITY: production resolves category in TWO layers — detectShoppingIntent
 * (detection) then the page.tsx category-lock (context memory). The detector's
 * `fallback` param is a *default when nothing is detected*, NOT a lock that
 * resists an incidental keyword. `resolveWithLock` below replicates the page
 * lock decision so this matrix reflects what a user actually receives.
 */
import { describe, it, expect } from 'vitest';
import {
  detectShoppingIntent,
  detectExplicitCategorySwitch,
  type ShoppingCategory,
} from '@/lib/shopping-intent';

const SIGNALS = { traits: {}, symptoms: [], direction: [], preserve: [], context: [] } as never;

/** Faithful two-layer resolution: detector + page.tsx category-lock. */
function resolveWithLock(
  utter: string,
  lock: ShoppingCategory | undefined,
  latest = utter,
): { category: ShoppingCategory; requested?: ShoppingCategory } {
  const ctx = detectShoppingIntent(utter, SIGNALS, undefined, latest, lock);
  const explicitSwitch = detectExplicitCategorySwitch(latest);
  // page.tsx lock: a live lock holds UNLESS the user explicitly switched or
  // named a class this turn. An explicit requestedCategory always wins.
  if (lock && lock !== 'general' && !explicitSwitch && !ctx.requestedCategory) {
    return { category: lock, requested: ctx.requestedCategory };
  }
  if (ctx.requestedCategory && lock && lock !== ctx.requestedCategory) {
    return { category: ctx.requestedCategory, requested: ctx.requestedCategory };
  }
  return { category: ctx.category, requested: ctx.requestedCategory };
}

interface Case {
  id: string;
  utter: string;
  lock?: ShoppingCategory;
  expect: ShoppingCategory;
  axis: string;
}

const MATRIX: Case[] = [
  // Standalone category naming
  { id: 'S1', utter: 'recommend a DAC', expect: 'dac', axis: 'standalone' },
  { id: 'S2', utter: 'what streamer should I buy?', expect: 'streamer', axis: 'standalone' },
  { id: 'S3', utter: 'looking for an integrated amplifier', expect: 'amplifier', axis: 'standalone' },
  { id: 'S4', utter: 'which turntable under $2000?', expect: 'turntable', axis: 'standalone' },
  { id: 'S5', utter: 'suggest some headphones', expect: 'headphone', axis: 'standalone' },
  { id: 'S6', utter: 'I need new speakers', expect: 'speaker', axis: 'standalone' },
  { id: 'S7', utter: 'any network player recommendations?', expect: 'streamer', axis: 'standalone' },

  // Follow-up / carried lock, no new class — lock must hold
  { id: 'F1', utter: 'what about under $2000?', lock: 'dac', expect: 'dac', axis: 'lock-hold' },
  { id: 'F2', utter: 'any other options?', lock: 'streamer', expect: 'streamer', axis: 'lock-hold' },
  { id: 'F3', utter: 'something cheaper?', lock: 'amplifier', expect: 'amplifier', axis: 'lock-hold' },
  { id: 'F4', utter: 'and for a warmer sound?', lock: 'speaker', expect: 'speaker', axis: 'lock-hold' },

  // Noun-first explicit request under a stale lock — THE PRODUCTION BUG
  { id: 'N1', utter: 'what other streamers would you recommend?', lock: 'dac', expect: 'streamer', axis: 'noun-first-switch' },
  { id: 'N2', utter: 'which other turntables would you recommend?', lock: 'dac', expect: 'turntable', axis: 'noun-first-switch' },
  { id: 'N3', utter: 'what integrated amps do you suggest?', lock: 'speaker', expect: 'amplifier', axis: 'noun-first-switch' },
  { id: 'N4', utter: 'any headphone recommendations?', lock: 'dac', expect: 'headphone', axis: 'noun-first-switch' },
  { id: 'N5', utter: 'what other DACs are there?', lock: 'streamer', expect: 'dac', axis: 'noun-first-switch' },

  // Verb-first explicit switch
  { id: 'V1', utter: 'recommend a turntable instead', lock: 'dac', expect: 'turntable', axis: 'verb-first-switch' },
  { id: 'V2', utter: 'show me some speakers', lock: 'dac', expect: 'speaker', axis: 'verb-first-switch' },

  // Incidental mention must NOT switch the lock
  { id: 'I1', utter: 'does it pair well with my turntable?', lock: 'dac', expect: 'dac', axis: 'incidental' },
  { id: 'I2', utter: 'I mostly listen through headphones', lock: 'streamer', expect: 'streamer', axis: 'incidental' },
  { id: 'I3', utter: 'my speakers are already quite bright', lock: 'dac', expect: 'dac', axis: 'incidental' },

  // Cross-domain contamination — request head noun must win.
  // NOTE: X2 (a category named in a SEPARATE trailing clause) is a documented
  // KNOWN LIMITATION, asserted separately below — see routing-doctrine.md.
  { id: 'X1', utter: 'recommend a DAC for my headphones', expect: 'dac', axis: 'cross-domain' },
  { id: 'X3', utter: 'an amplifier for my new speakers?', expect: 'amplifier', axis: 'cross-domain' },
];

describe('PHASE 2 routing golden gate — licensed category is what the user asked for', () => {
  for (const c of MATRIX) {
    it(`${c.id} [${c.axis}] "${c.utter}"${c.lock ? ` (lock=${c.lock})` : ''} → ${c.expect}`, () => {
      const { category } = resolveWithLock(c.utter, c.lock);
      expect(category).toBe(c.expect);
    });
  }

  // X2 — DOCUMENTED KNOWN LIMITATION (backlog G3): a category named in a
  // separate trailing clause is not distinguished from the request head noun,
  // so pattern-order wins ('dac'). Pinned here so a future improvement that
  // resolves it to 'streamer' trips this test and prompts the doctrine update.
  // NOT fixed in this envelope: it is a different root defect from the G1 lock
  // bug and the clean fix (leftmost-match) regresses "headphone amp"→amplifier.
  it('X2 [cross-domain] KNOWN LIMITATION: "...streamer...to feed my DAC" currently resolves to dac', () => {
    const { category } = resolveWithLock('what streamer would you recommend to feed my DAC?', undefined);
    expect(category).toBe('dac'); // documented gap — ideal answer is 'streamer'
  });
});
