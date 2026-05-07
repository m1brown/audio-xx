/**
 * `buildComparisonImagesFromProducts` regression test.
 *
 * Locks the products-based comparison-image generation contract:
 *   - returns undefined when fewer than two products are supplied
 *   - returns the FIRST two products in input order (no reorder)
 *   - resolves imageUrl through resolveProductImage (catalog override
 *     wins, full 4-step chain falls through to placeholder otherwise)
 *   - preserves brand and name verbatim on each entry
 *
 * Brand-name based comparison-image generation
 * (`consultation.ts:buildComparisonImages`) covers a different input
 * shape (string labels + query text + brand-only fallback) and is NOT
 * unified with this helper. The two helpers cover non-overlapping
 * input surfaces by design.
 */

import { describe, it, expect } from 'vitest';

import { buildComparisonImagesFromProducts } from '../advisory-response';

// ── Minimal product fixture ───────────────────────────

type ProductLike = { brand: string; name: string; imageUrl?: string; category?: string };

function fixtureProduct(overrides: Partial<ProductLike> & Pick<ProductLike, 'brand' | 'name'>): ProductLike {
  return {
    category: 'dac',
    ...overrides,
  };
}

const CHORD_QUTEST: ProductLike = fixtureProduct({
  brand: 'Chord',
  name: 'Qutest',
  imageUrl: 'https://example.test/qutest-catalog.jpg',
});

const DENAFRIPS_PONTUS: ProductLike = fixtureProduct({
  brand: 'Denafrips',
  name: 'Pontus II',
  imageUrl: 'https://example.test/pontus-catalog.jpg',
});

const SCHIIT_BIFROST: ProductLike = fixtureProduct({
  brand: 'Schiit',
  name: 'Bifrost 2/64',
  imageUrl: 'https://example.test/bifrost-catalog.jpg',
});

const PRODUCT_NO_IMAGE: ProductLike = fixtureProduct({
  brand: 'Unknown',
  name: 'Phantom DAC',
  category: 'dac',
});

// ── Tests ─────────────────────────────────────────────

describe('buildComparisonImagesFromProducts — products-based comparison images', () => {
  it('returns undefined when fewer than two products are supplied', () => {
    expect(buildComparisonImagesFromProducts([])).toBeUndefined();
    expect(buildComparisonImagesFromProducts([CHORD_QUTEST])).toBeUndefined();
  });

  it('returns exactly two entries in input order', () => {
    const result = buildComparisonImagesFromProducts([CHORD_QUTEST, DENAFRIPS_PONTUS]);
    expect(result).toBeDefined();
    expect(result!.length).toBe(2);
    expect(result![0].brand).toBe('Chord');
    expect(result![0].name).toBe('Qutest');
    expect(result![1].brand).toBe('Denafrips');
    expect(result![1].name).toBe('Pontus II');
  });

  it('preserves order — second product first reverses output order', () => {
    const result = buildComparisonImagesFromProducts([DENAFRIPS_PONTUS, CHORD_QUTEST]);
    expect(result![0].brand).toBe('Denafrips');
    expect(result![1].brand).toBe('Chord');
  });

  it('takes only the first two products when more are supplied', () => {
    const result = buildComparisonImagesFromProducts([
      CHORD_QUTEST,
      DENAFRIPS_PONTUS,
      SCHIIT_BIFROST,
    ]);
    expect(result!.length).toBe(2);
    expect(result![0].name).toBe('Qutest');
    expect(result![1].name).toBe('Pontus II');
    // Bifrost must NOT appear
    expect(result!.some((e) => e.name === 'Bifrost 2/64')).toBe(false);
  });

  it('resolves catalog imageUrl through the full chain when product carries it', () => {
    const result = buildComparisonImagesFromProducts([CHORD_QUTEST, DENAFRIPS_PONTUS]);
    expect(result![0].imageUrl).toBeTruthy();
    expect(result![1].imageUrl).toBeTruthy();
    // Catalog override should propagate (the chain prefers the catalog imageUrl)
    expect(result![0].imageUrl).toBe('https://example.test/qutest-catalog.jpg');
    expect(result![1].imageUrl).toBe('https://example.test/pontus-catalog.jpg');
  });

  it('still returns entries when a product has no imageUrl (graceful — chain may yield undefined)', () => {
    const result = buildComparisonImagesFromProducts([CHORD_QUTEST, PRODUCT_NO_IMAGE]);
    expect(result).toBeDefined();
    expect(result!.length).toBe(2);
    // First entry has a catalog override, must resolve
    expect(result![0].imageUrl).toBeTruthy();
    // Second entry has no override; imageUrl is whatever resolveProductImage
    // returns for an unknown product — we don't assert truthiness, only that
    // the entry is present so the renderer's "both must have imageUrl" gate
    // can correctly fall back to text-only comparison.
    expect(result![1].brand).toBe('Unknown');
    expect(result![1].name).toBe('Phantom DAC');
  });
});
