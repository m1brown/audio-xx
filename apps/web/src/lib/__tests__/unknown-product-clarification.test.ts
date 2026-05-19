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
  resolveUnknownProductName,
} from '../unknown-product-clarification';
import { getGenericPlaceholder, getProductImage, getProductImageEntry } from '../product-images';
import type { SubjectMatch } from '../intent';

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

// ── P1 follow-on regression: name-resolution fallback ──────────────
//
// Reproduces the production regression where unknown-product
// prompts rendered with "the that product" broken grammar and no
// Explore section. The synthesized subjectMatch produced by
// detectIntent's gate 0a (in intent.ts) must reach the safety-check
// even though buildTurnContext rebuilds subjectMatches independently
// via extractSubjectMatches (catalog-only).

describe('resolveUnknownProductName — turnCtx → intent → fallback precedence', () => {
  const catalogued: SubjectMatch = { name: 'leben cs600x', kind: 'product' };
  const synthesized: SubjectMatch = { name: 'Buchardt A700', kind: 'product' };
  const synthesizedBrand: SubjectMatch = { name: 'Buchardt', kind: 'brand' };

  it('returns the turnCtx product match when present (catalogued path)', () => {
    expect(resolveUnknownProductName([catalogued], [synthesized])).toBe('leben cs600x');
  });

  it('falls back to the intent-synthesized match when turnCtx is empty (unknown product)', () => {
    expect(resolveUnknownProductName([], [synthesized])).toBe('Buchardt A700');
  });

  it('falls back to the intent-synthesized brand when neither has a product match', () => {
    expect(resolveUnknownProductName([], [synthesizedBrand])).toBe('Buchardt');
  });

  it('returns "that product" when both arrays are empty', () => {
    expect(resolveUnknownProductName([], [])).toBe('that product');
  });

  it('returns "that product" when both arrays are undefined', () => {
    expect(resolveUnknownProductName(undefined, undefined)).toBe('that product');
  });

  it('precedence: turnCtx beats intent-synthesized even when intent has a product and turnCtx has only a brand', () => {
    const turnCtxBrand: SubjectMatch = { name: 'chord', kind: 'brand' };
    const intentProduct: SubjectMatch = { name: 'Buchardt A700', kind: 'product' };
    // turnCtx brand wins over intent product — preserving the cataloged
    // canonical brand string when available.
    expect(resolveUnknownProductName([turnCtxBrand], [intentProduct])).toBe('chord');
  });
});

// ── 2026-05-19: per-subject manufacturer image override ────────────
//
// When a product isn't in the curated Product catalog but IS in
// PRODUCT_IMAGE_URLS, the unknown-product fallback renderer should
// surface the real manufacturer-hosted image instead of the generic
// placeholder. The "Generic placeholder" caption suppresses in that
// case (it would be inaccurate — the image IS the actual product).

describe('Subject-keyed manufacturer image override (2026-05-19)', () => {
  it('Buchardt A700 lookup resolves to the buchardtaudio.com Shopify CDN image', () => {
    const url = getProductImage(undefined, 'Buchardt A700');
    expect(url).toBeDefined();
    expect(url).toContain('buchardtaudio.com');
    expect(url).toMatch(/\.jpg(?:\?|$)/);
  });

  it('lookup is case-insensitive (matches normalized lowercase key)', () => {
    expect(getProductImage(undefined, 'BUCHARDT A700')).toBeDefined();
    expect(getProductImage(undefined, 'buchardt a700')).toBeDefined();
  });

  it('the Buchardt URL is hosted on the manufacturer site (F4-clean — not reviewer-hosted)', () => {
    const url = getProductImage(undefined, 'Buchardt A700')!;
    // F4 forbids reviewer-publication-hosted images. Manufacturer
    // CDN is allowed; verify the host directly.
    expect(url).toMatch(/^https:\/\/(?:[a-z0-9-]+\.)?buchardtaudio\.com/);
    expect(url).not.toMatch(/6moons|stereophile|darko\.audio|twitteringmachines|positive-feedback|stereotimes|headfonics/i);
  });

  it('returns undefined for genuinely uncatalogued / unknown products (placeholder path still fires)', () => {
    const url = getProductImage(undefined, 'Made-Up Brand XYZ-12345');
    expect(url).toBeUndefined();
  });

  it('returns undefined for the "that product" fallback string (Explore-link guard reinforced)', () => {
    const url = getProductImage(undefined, 'that product');
    expect(url).toBeUndefined();
  });
});

// ── 2026-05-19: visible manufacturer attribution policy ────────────
//
// Policy: when the unknown-product fallback surfaces a real
// manufacturer-hosted image, the UI must display an
// "Image source: <site>" attribution line beneath the image so the
// origin of the photo is explicit. This is asserted via the new
// getProductImageEntry helper which returns both the URL AND the
// provenance metadata the renderer needs to build the attribution.

describe('getProductImageEntry — provenance for visible attribution', () => {
  it('returns url + source.site for Buchardt A700 (manufacturer attribution path)', () => {
    const entry = getProductImageEntry(undefined, 'Buchardt A700');
    expect(entry).toBeDefined();
    expect(entry!.url).toContain('buchardtaudio.com');
    expect(entry!.source).toBeDefined();
    expect(entry!.source!.site).toBe('buchardtaudio.com');
    expect(entry!.source!.tier).toBe('manufacturer');
    expect(entry!.source!.credit).toBe('Buchardt Audio');
  });

  it('returns undefined for genuinely uncatalogued products (placeholder path still fires)', () => {
    const entry = getProductImageEntry(undefined, 'Made-Up Brand XYZ-12345');
    expect(entry).toBeUndefined();
  });

  it('F4 invariant — never returns an entry with tier === "review_publication"', () => {
    // hifi.nl, classicreceivers.com, positive-feedback.com, 6moons.com,
    // stereotimes.com, headfonics.com are all review_publication entries
    // in product-images.ts. Lookup by their associated product names
    // should NOT return those entries (gate applies in getProductImageEntry
    // identically to getProductImage).
    const reviewerHostPattern = /6moons|darko\.audio|twitteringmachines|stereophile|positive-feedback|stereotimes|headfonics|hifi\.nl|classicreceivers/i;
    // Probe a few known review_publication-keyed products
    const probes = ['first watt sit 3', 'vinnie rossi l2i', 'linnenberg liszt', 'hornshoppe horn'];
    for (const name of probes) {
      const entry = getProductImageEntry(undefined, name);
      if (entry) {
        // If something resolved, it must NOT be reviewer-hosted
        expect(entry.url, `lookup for "${name}" must not return reviewer-hosted URL`).not.toMatch(reviewerHostPattern);
        expect(entry.source?.tier, `lookup for "${name}" must not return review_publication tier`).not.toBe('review_publication');
      }
    }
  });
});

describe('P1 fallback end-to-end: resolveUnknownProductName + buildUnknownProductClarification', () => {
  it('unknown-product synthesized name produces hedged clarification with Explore links', () => {
    const synthesized: SubjectMatch = { name: 'Buchardt A700', kind: 'product' };
    const productName = resolveUnknownProductName([], [synthesized]);
    expect(productName).toBe('Buchardt A700');

    const clarification = buildUnknownProductClarification(productName);
    expect(clarification.subject).toBe('Buchardt A700');
    expect(clarification.bottomLine).toContain('Buchardt A700');
    // Explore links present (the bug was: empty turnCtx → "that product" → links suppressed)
    expect(clarification.links).toBeDefined();
    expect(clarification.links).toHaveLength(3);
  });

  it('empty arrays produce "that product" → links suppressed (current behavior)', () => {
    const productName = resolveUnknownProductName([], []);
    const clarification = buildUnknownProductClarification(productName);
    expect(clarification.subject).toBe('that product');
    expect(clarification.links).toBeUndefined();
  });
});
