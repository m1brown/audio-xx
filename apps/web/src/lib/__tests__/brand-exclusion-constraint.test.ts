import { describe, it, expect } from 'vitest';
import { detectShoppingIntent } from '../shopping-intent';
import { detectIntent } from '../intent';

const EMPTY_SIGNALS = { traits: {}, symptoms: [], direction: [], preserve: [], context: [] } as never;

/**
 * M5-F3 (Mission 5, 2026-08-11 overnight) — a rejected recommendation is
 * an explicit constraint, and exclusions were not modeled at all.
 *
 * Live repro (production, mid-shopping after a Wharfedale Linton
 * recommendation): "not the wharfedales, my brother has those" fell to
 * the knowledge lane and produced an echo essay ("It sounds like you
 * might be referring to a conversation about loudspeakers…"). Worse,
 * "no klipsch please" classifies as gear_inquiry with a klipsch subject
 * — which the shopping refinement path converts into a POSITIVE
 * brandConstraint boost: asking to exclude a brand boosted it.
 *
 * Shared root cause: HardConstraints modeled topology exclusions but not
 * brand exclusions. Repairs at the constraint layer (extraction +
 * scoring gate), the routing layer (exclusion turns are shopping
 * refinements), and the boost guard (an excluded brand never becomes a
 * positive constraint).
 *
 * Rule encoded: "not X" about a known brand is a hard filter — the same
 * standing as "no tubes".
 */

describe('brand exclusion extraction', () => {
  const CASES: Array<[string, string[]]> = [
    ['not the wharfedales, my brother has those', ['wharfedale']],
    ['no klipsch please', ['klipsch']],
    ['anything but focal', ['focal']],
    ["don't want the kef, avoid harbeth too", ['kef', 'harbeth']],
  ];
  for (const [text, brands] of CASES) {
    it(`"${text}" → excludes ${brands.join(', ')}`, () => {
      const ctx = detectShoppingIntent(text, EMPTY_SIGNALS, undefined, text);
      expect(ctx.constraints.excludeBrands ?? []).toEqual(expect.arrayContaining(brands));
    });
  }

  it('control: mentioning a brand without exclusion adds no exclusion', () => {
    const ctx = detectShoppingIntent('warm speakers like the wharfedale linton', EMPTY_SIGNALS, undefined, 'warm speakers like the wharfedale linton');
    expect(ctx.constraints.excludeBrands ?? []).toHaveLength(0);
  });

  it('control: "no tubes" stays a topology exclusion, not a brand one', () => {
    const ctx = detectShoppingIntent('integrated amp, no tubes', EMPTY_SIGNALS, undefined, 'integrated amp, no tubes');
    expect(ctx.constraints.excludeTopologies.length).toBeGreaterThan(0);
    expect(ctx.constraints.excludeBrands ?? []).toHaveLength(0);
  });
});

describe('exclusion turns route to shopping refinement', () => {
  it('"not the wharfedales, my brother has those" → shopping', () => {
    expect(detectIntent('not the wharfedales, my brother has those').intent).toBe('shopping');
  });
  it('"no klipsch please" → shopping', () => {
    expect(detectIntent('no klipsch please').intent).toBe('shopping');
  });
});

