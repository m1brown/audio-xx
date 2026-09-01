/**
 * Product suite — catalog index (MVP M1).
 *
 * 1. Sync guard: the committed index must exactly mirror the product
 *    modules. Fails when someone edits a product file without running
 *    `npx tsx scripts/generate-catalog-index.ts`.
 * 2. Search behaviour: the typeahead must find real gear from partial,
 *    lowercase, mid-word queries — and return nothing for junk.
 */
import { describe, it, expect } from 'vitest';
import { CATALOG_ENTRIES, searchCatalog, displayName, categoryLabel } from '../catalog-search';
import { DAC_PRODUCTS } from '@/lib/products/dacs';
import { AMPLIFIER_PRODUCTS } from '@/lib/products/amplifiers';
import { SPEAKER_PRODUCTS } from '@/lib/products/speakers';
import { HEADPHONE_PRODUCTS } from '@/lib/products/headphones';
import { TURNTABLE_PRODUCTS } from '@/lib/products/turntables';

describe('catalog index — sync with product modules', () => {
  it('contains exactly the ids of the product catalog (no drift)', () => {
    const source = new Set(
      [...DAC_PRODUCTS, ...AMPLIFIER_PRODUCTS, ...SPEAKER_PRODUCTS,
        ...HEADPHONE_PRODUCTS, ...TURNTABLE_PRODUCTS]
        .filter((p) => p?.id && p.brand && p.name && p.category)
        .map((p) => p.id),
    );
    const index = new Set(CATALOG_ENTRIES.map((e) => e.id));
    const missing = [...source].filter((id) => !index.has(id));
    const stale = [...index].filter((id) => !source.has(id));
    expect({ missing, stale }).toEqual({ missing: [], stale: [] });
  });

  it('every entry is complete and unique', () => {
    const ids = new Set<string>();
    for (const e of CATALOG_ENTRIES) {
      expect(e.id).toBeTruthy();
      expect(e.brand).toBeTruthy();
      expect(e.name).toBeTruthy();
      expect(e.category).toBeTruthy();
      expect(ids.has(e.id)).toBe(false);
      ids.add(e.id);
    }
    expect(CATALOG_ENTRIES.length).toBeGreaterThan(150);
  });
});

describe('catalog search — typeahead behaviour', () => {
  it('finds the Pontus from a lowercase partial', () => {
    const hits = searchCatalog('pontus');
    expect(hits.length).toBeGreaterThan(0);
    expect(displayName(hits[0])).toMatch(/Denafrips Pontus/);
  });

  it('brand-prefix query surfaces that brand first', () => {
    const hits = searchCatalog('leben');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].brand).toBe('Leben');
  });

  it('multi-token queries require all tokens ("kef r3")', () => {
    const hits = searchCatalog('kef r3');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].brand).toBe('KEF');
    expect(hits[0].name).toMatch(/R3/);
  });

  it('returns nothing for junk and for empty queries', () => {
    expect(searchCatalog('zzzzqqq')).toEqual([]);
    expect(searchCatalog('')).toEqual([]);
    expect(searchCatalog('   ')).toEqual([]);
  });

  it('respects the result limit', () => {
    expect(searchCatalog('a', 6).length).toBeLessThanOrEqual(6);
  });

  it('display names never duplicate the brand', () => {
    for (const e of CATALOG_ENTRIES) {
      const d = displayName(e).toLowerCase();
      expect(d.startsWith(`${e.brand.toLowerCase()} ${e.brand.toLowerCase()}`)).toBe(false);
    }
  });

  it('every category has a listener-facing label', () => {
    for (const c of new Set(CATALOG_ENTRIES.map((e) => e.category))) {
      expect(categoryLabel(c)).not.toBe('');
    }
  });
});
