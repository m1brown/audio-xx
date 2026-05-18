/**
 * Unknown-product clarification builder tests (P1 follow-on, 2026-05-18).
 *
 * Covers the smallest safe enrichment of the unknown-product
 * fallback for early public beta:
 *   - hedged language about limited catalog knowledge (no fabrication)
 *   - Explore links (manufacturer search, eBay, HiFi Shark)
 *   - no review/reviewer URLs or labels
 *   - the placeholder image asset path used by the renderer fallback
 *     (ConsultationSubjectContext) is the generic SVG silhouette
 */

import { describe, it, expect } from 'vitest';
import {
  buildUnknownProductClarification,
  buildUnknownProductExploreLinks,
} from '../unknown-product-clarification';
import { getGenericPlaceholder } from '../product-images';

describe('buildUnknownProductClarification — shape + hedging', () => {
  it('returns kind=assessment with the user-typed product name as subject', () => {
    const r = buildUnknownProductClarification('Buchardt A700');
    expect(r.kind).toBe('assessment');
    expect(r.subject).toBe('Buchardt A700');
    expect(r.advisoryMode).toBe('product_assessment');
  });

  it('bottomLine is explicitly hedged about catalog coverage', () => {
    const r = buildUnknownProductClarification('Buchardt A700');
    expect(r.bottomLine?.toLowerCase()).toContain("don't have full catalog data");
    expect(r.bottomLine).toContain('Buchardt A700');
  });

  it('followUp asks the user to confirm the product or share a link', () => {
    const r = buildUnknownProductClarification('Buchardt A700');
    expect(r.followUp?.toLowerCase()).toMatch(/confirm|exact|share/);
  });

  it('does NOT carry top-level imageUrl (Option B: rendering handled separately)', () => {
    const r = buildUnknownProductClarification('Buchardt A700');
    // imageUrl is intentionally NOT on AdvisoryResponse; assert via
    // shape — the field must not be present on the returned object.
    expect((r as Record<string, unknown>).imageUrl).toBeUndefined();
  });

  it('does NOT carry productAssessment (no fabricated specs/traits)', () => {
    const r = buildUnknownProductClarification('Buchardt A700');
    expect(r.productAssessment).toBeUndefined();
  });

  it('does NOT carry sourceReferences (F4 reviewer-data exclusion holds)', () => {
    const r = buildUnknownProductClarification('Buchardt A700');
    expect(r.sourceReferences).toBeUndefined();
  });
});

describe('buildUnknownProductExploreLinks — Explore section structure', () => {
  it('returns 3 links for a real product name', () => {
    const links = buildUnknownProductExploreLinks('Buchardt A700');
    expect(links).toHaveLength(3);
  });

  it('returns undefined for the fallback placeholder name "that product"', () => {
    const links = buildUnknownProductExploreLinks('that product');
    expect(links).toBeUndefined();
  });

  it('returns undefined for empty input', () => {
    const links = buildUnknownProductExploreLinks('');
    expect(links).toBeUndefined();
  });

  it('Find manufacturer link is a Google search (labelled, not fabricated URL)', () => {
    const links = buildUnknownProductExploreLinks('Buchardt A700')!;
    const mfg = links.find((l) => l.label === 'Find manufacturer');
    expect(mfg).toBeDefined();
    expect(mfg!.url).toContain('google.com/search');
    expect(mfg!.url).toContain('Buchardt%20A700');
    expect(mfg!.kind).toBe('reference');
  });

  it('eBay link is a real eBay search URL', () => {
    const links = buildUnknownProductExploreLinks('Buchardt A700')!;
    const ebay = links.find((l) => l.label === 'eBay');
    expect(ebay).toBeDefined();
    expect(ebay!.url).toContain('ebay.com/sch/i.html?_nkw=');
    expect(ebay!.url).toContain('Buchardt%20A700');
    expect(ebay!.kind).toBe('dealer');
  });

  it('HiFi Shark link is a real HiFi Shark search URL', () => {
    const links = buildUnknownProductExploreLinks('Buchardt A700')!;
    const shark = links.find((l) => l.label === 'HiFi Shark');
    expect(shark).toBeDefined();
    expect(shark!.url).toContain('hifishark.com/search?q=');
    expect(shark!.url).toContain('Buchardt%20A700');
    expect(shark!.kind).toBe('dealer');
  });

  it('contains NO reviewer publication URLs', () => {
    const links = buildUnknownProductExploreLinks('Buchardt A700')!;
    const serialized = JSON.stringify(links);
    expect(serialized).not.toMatch(/6moons|darko\.audio|twitteringmachines|stereophile|theabsolutesound|hifiplus|soundstage|audiosciencereview|positive-feedback|stereotimes|headfonics|monoandstereo/i);
  });

  it('contains NO reviewer-derived link labels', () => {
    const links = buildUnknownProductExploreLinks('Buchardt A700')!;
    const labels = links.map((l) => l.label.toLowerCase()).join(' ');
    expect(labels).not.toMatch(/\breview\b|\breviewer\b|reference (?:review|publication)/);
  });

  it('properly URL-encodes product names with spaces and special characters', () => {
    const links = buildUnknownProductExploreLinks('Cube Audio F8 v2')!;
    for (const l of links) {
      expect(l.url).toContain('Cube%20Audio%20F8%20v2');
    }
  });
});

describe('Generic placeholder asset (Option B image fallback)', () => {
  it('getGenericPlaceholder() returns a real SVG asset path that the renderer can use', () => {
    const url = getGenericPlaceholder();
    expect(url).toMatch(/^\/images\/placeholders\/.+\.svg$/);
  });

  it('getGenericPlaceholder() with no category returns the generic product silhouette', () => {
    const url = getGenericPlaceholder();
    expect(url).toBe('/images/placeholders/product.svg');
  });

  it('getGenericPlaceholder() with an unknown category falls back to the generic silhouette', () => {
    const url = getGenericPlaceholder('something-the-catalog-does-not-know-about');
    expect(url).toBe('/images/placeholders/product.svg');
  });
});

describe('F4 reviewer-data exclusion still holds in the clarification', () => {
  it('full serialized response contains no reviewer publication names', () => {
    const serialized = JSON.stringify(buildUnknownProductClarification('Buchardt A700'));
    expect(serialized).not.toMatch(/6moons|Darko|Stereophile|Twittering|Srajan|Audiophiliac/i);
  });
});
