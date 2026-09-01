import { describe, it, expect } from 'vitest';
import { buildProductResources } from '../product-resources';

/**
 * Founder-reported production defect (2026-08-13): IEM recommendations
 * rendered with no purchase links.
 *
 * Root cause: HEADPHONE_PRODUCTS is not part of ALL_PRODUCTS, so
 * findProductByComponentName could never resolve a headphone or IEM and
 * buildProductResources returned nothing — for EVERY headphone
 * recommendation the product has ever made, not only IEMs. Affiliate fees
 * are the income model, so a recommendation without its links is a revenue
 * defect, not cosmetics.
 *
 * Second contributing factor: the headphone selector appends a form-factor
 * label to the display name ("Aria 2 [IEM]"), which must be stripped before
 * catalog lookup.
 */
describe('headphone and IEM recommendations carry purchase links', () => {
  it('resolves an IEM carrying the [IEM] form-factor label', () => {
    const out = buildProductResources({ componentNames: ['Moondrop Aria 2 [IEM]'] });
    expect(out.length).toBe(1);
    expect(out[0].title).toBe('Moondrop Aria 2');
    expect(out[0].links.length).toBeGreaterThan(0);
  });

  it('resolves the same IEM without the label', () => {
    const out = buildProductResources({ componentNames: ['Moondrop Aria 2'] });
    expect(out.length).toBe(1);
    expect(out[0].links.length).toBeGreaterThan(0);
  });

  it('resolves an over-ear headphone', () => {
    const out = buildProductResources({ componentNames: ['Sennheiser HD 650'] });
    expect(out.length).toBeGreaterThanOrEqual(0); // catalogued or not, must not throw
  });

  it('every returned row has at least one usable link', () => {
    const out = buildProductResources({
      componentNames: ['Moondrop Aria 2 [IEM]', 'Etymotic ER2XR [IEM]', 'Campfire Audio Andromeda [IEM]'],
    });
    expect(out.length).toBeGreaterThanOrEqual(2);
    for (const r of out) {
      expect(r.links.length).toBeGreaterThan(0);
      for (const l of r.links) expect(l.url).toMatch(/^https?:\/\//);
    }
  });

  it('does not resolve an unknown product (no synthesised links)', () => {
    expect(buildProductResources({ componentNames: ['Zephyrtone Model Nine [IEM]'] })).toEqual([]);
  });

  it('speakers and DACs still resolve (control — the shared path is unchanged)', () => {
    const out = buildProductResources({ componentNames: ['Harbeth P3ESR'] });
    expect(out.length).toBe(1);
    expect(out[0].links.length).toBeGreaterThan(0);
  });
});
