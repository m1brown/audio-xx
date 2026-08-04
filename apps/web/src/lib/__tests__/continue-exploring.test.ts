/**
 * Continue Exploring — link integrity.
 *
 * The section's whole value is that its links resolve, so these tests run
 * against the real profile data rather than fixtures. The important
 * assertions are the negative ones: no group for a subject we know nothing
 * about, and no /tech/set for the word "set" appearing in ordinary prose.
 */
import { describe, it, expect } from 'vitest';
import { buildContinueExploring } from '../continue-exploring';
import { findBrandProfileBySlug } from '../catalog/lookups';
import { findTechnologyProfileBySlug } from '../technology-profiles';

/** Every emitted href must resolve against the data backing its route. */
function assertAllResolve(groups: ReturnType<typeof buildContinueExploring>) {
  for (const g of groups) {
    for (const l of g.links) {
      expect(l.label.trim().length).toBeGreaterThan(0);
      if (l.href.startsWith('/brand/')) {
        expect(findBrandProfileBySlug(l.href.slice('/brand/'.length))).toBeDefined();
      } else if (l.href.startsWith('/tech/')) {
        expect(findTechnologyProfileBySlug(l.href.slice('/tech/'.length))).toBeDefined();
      } else {
        throw new Error(`unexpected href shape: ${l.href}`);
      }
    }
  }
}

describe('buildContinueExploring', () => {
  it('resolves manufacturers from full product names', () => {
    const groups = buildContinueExploring({
      componentNames: ['Chord Hugo', 'Eversolo DMP-A6'],
    });
    assertAllResolve(groups);
    const brands = groups.find((g) => g.title === 'Manufacturers');
    expect(brands).toBeDefined();
    expect(brands!.links.length).toBeGreaterThan(0);
  });

  it('emits no group at all for an entirely unknown subject', () => {
    const groups = buildContinueExploring({
      componentNames: ['Zzyzx Fictional 9000'],
      brandNames: ['Zzyzx'],
      prose: 'A product we have never heard of.',
    });
    expect(groups).toEqual([]);
  });

  it('never emits a Products group while no product route exists', () => {
    const groups = buildContinueExploring({
      componentNames: ['Chord Hugo', 'Eversolo DMP-A6'],
      prose: 'The Chord Hugo is a DAC.',
    });
    expect(groups.find((g) => g.title === 'Products')).toBeUndefined();
  });

  it('does not match the idea page /tech/set on the ordinary word "set"', () => {
    const groups = buildContinueExploring({
      prose: 'Once the speakers are set up and the levels are set, the system is ready.',
    });
    const ideas = groups.find((g) => g.title === 'Ideas');
    expect(ideas?.links.some((l) => l.href === '/tech/set')).toBeFalsy();
  });

  it('does match /tech/set on the SET acronym', () => {
    const groups = buildContinueExploring({
      prose: 'A SET amplifier asks a great deal of the speaker.',
    });
    assertAllResolve(groups);
    const ideas = groups.find((g) => g.title === 'Ideas');
    expect(ideas?.links.some((l) => l.href === '/tech/set')).toBe(true);
  });

  it('matches multi-word idea pages in prose', () => {
    const groups = buildContinueExploring({
      prose: 'These are high-efficiency loudspeakers, so amplifier power is not the constraint.',
    });
    assertAllResolve(groups);
    const ideas = groups.find((g) => g.title === 'Ideas');
    expect(ideas?.links.some((l) => l.href === '/tech/high-efficiency-loudspeakers')).toBe(true);
  });

  it('deduplicates repeated brands and caps each group', () => {
    const groups = buildContinueExploring({
      componentNames: Array(20).fill('Chord Hugo'),
    });
    const brands = groups.find((g) => g.title === 'Manufacturers');
    expect(brands!.links.length).toBe(1);
    for (const g of groups) expect(g.links.length).toBeLessThanOrEqual(6);
  });

  it('labels brands in published form, never the raw slug alias', () => {
    const groups = buildContinueExploring({
      componentNames: ['Chord Hugo', 'WLM Diva Monitor'],
    });
    const labels = groups.find((g) => g.title === 'Manufacturers')!.links.map((l) => l.label);
    // The first render of this section shipped "chord" and "wlm" — names[0]
    // is the slug source, not a display name.
    expect(labels).toContain('Chord Electronics');
    expect(labels).toContain('WLM');
    for (const l of labels) expect(l).not.toBe(l.toLowerCase());
  });

  it('is safe on empty input', () => {
    expect(buildContinueExploring({})).toEqual([]);
    expect(buildContinueExploring({ componentNames: [], prose: '' })).toEqual([]);
  });
});
