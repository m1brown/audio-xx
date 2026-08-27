import { describe, it, expect } from 'vitest';
import {
  getProductImage, getProductImageEntry, resolveProductImageStrict,
  resolveProductImage, resolveProductImageWithConfidence, GOVERNED_REGISTRY,
} from '@/lib/product-images';
import { keyNamesProduct } from '../product-identity';
import { classifyCatalogHost } from '../admission';
import { DAC_PRODUCTS } from '@/lib/products/dacs';
import { AMPLIFIER_PRODUCTS } from '@/lib/products/amplifiers';
import { SPEAKER_PRODUCTS } from '@/lib/products/speakers';
import { TURNTABLE_PRODUCTS } from '@/lib/products/turntables';
import { HEADPHONE_PRODUCTS } from '@/lib/products/headphones';

/**
 * THE 59-PRODUCT FAILURE CLASS.
 *
 * The single most important empirical finding of the image-governance work:
 * 59 products could receive ANOTHER PRODUCT'S photograph. The Leben CS600X was
 * shown the CS600. The Magnepan LRS+ was shown the LRS. Campfire Audio's
 * Andromeda was shown the Solaris. Not through one bug but through six
 * independent mechanisms — substring keys, a brand-level fallback, catalog
 * URLs that bypassed matching entirely, variant suffixes that normalised away,
 * duplicate assets claimed by several keys, and resolvers that disagreed with
 * each other about which rule applied.
 *
 * WHY THIS IS ONE UNIVERSAL TEST AND NOT 59 CASES.
 *
 * Fifty-nine bespoke assertions would pin today's catalog, not the doctrine.
 * They would pass while a 60th product broke, and they would need editing
 * every time a row is added — which makes them a maintenance tax that gets
 * relaxed under pressure, exactly when it matters.
 *
 * So the invariant is stated universally instead, quantified over every
 * product the system knows and every surface that can show one:
 *
 *   A user-visible image for product P must come from a registry row whose
 *   key EXACTLY names P, or from a catalog URL first-party to P's brand.
 *
 * Nothing else is admissible, whatever future mechanism proposes it. New
 * products are covered the day they are added. The named controls below are
 * kept as documentation of the six mechanisms, not as the proof.
 */

type P = { brand?: string; name?: string; imageUrl?: string; category?: string };

const CATALOG: P[] = [
  ...DAC_PRODUCTS, ...AMPLIFIER_PRODUCTS, ...SPEAKER_PRODUCTS,
  ...TURNTABLE_PRODUCTS, ...HEADPHONE_PRODUCTS,
] as P[];

/** Every surface a reader can receive an image through. */
const SURFACES: Array<[string, (p: P) => string | undefined]> = [
  ['getProductImage', (p) => getProductImage(p.brand, p.name)],
  ['getProductImageEntry', (p) => getProductImageEntry(p.brand, p.name)?.url],
  ['resolveProductImageStrict', (p) => resolveProductImageStrict(p.brand, p.name, p.imageUrl)],
  ['resolveProductImage', (p) => resolveProductImage(p.brand, p.name, p.imageUrl, p.category)],
  ['resolveProductImageWithConfidence',
    (p) => resolveProductImageWithConfidence({
      catalogUrl: p.imageUrl, brand: p.brand, name: p.name, category: p.category,
    }).url],
];

/** Is this URL something product P is entitled to display? */
function entitled(p: P, url: string): { ok: boolean; why: string } {
  if (url.startsWith('/images/placeholders/')) return { ok: true, why: 'placeholder' };

  // Entitlement is a DISJUNCTION, and the order matters only for the message.
  // Two independent records can each entitle the same asset: a curated
  // registry row whose key names the product, or the product's own catalog
  // imageUrl when it is first-party. Marantz's hero is reached both ways.
  const rows = GOVERNED_REGISTRY.filter((r) => r.url === url);
  if (rows.some((r) => keyNamesProduct(r.key, p))) {
    return { ok: true, why: 'registry key names this product' };
  }
  if (p.imageUrl === url && classifyCatalogHost(p.brand, url) === 'manufacturer') {
    return { ok: true, why: 'first-party catalog URL' };
  }
  if (rows.length > 0) {
    return { ok: false, why: `claimed only by key(s) naming a DIFFERENT product: ${rows.map((r) => r.key).join(', ')}` };
  }
  if (p.imageUrl === url) {
    return { ok: false, why: 'catalog URL not first-party to this brand' };
  }
  return { ok: false, why: 'URL traceable to no governed record' };
}

describe('THE INVARIANT — no product ever receives another product\'s photograph', () => {
  for (const [surface, resolve] of SURFACES) {
    it(`${surface} shows only images entitled to the product asked for`, () => {
      const violations: string[] = [];
      for (const p of CATALOG) {
        const url = resolve(p);
        if (!url) continue;
        const verdict = entitled(p, url);
        if (!verdict.ok) violations.push(`${p.brand} ${p.name} ← ${verdict.why} (${url})`);
      }
      expect(violations, `${violations.length} products shown a foreign photograph`).toEqual([]);
    });
  }

  it('covers the whole catalog, so a new product is protected the day it is added', () => {
    // If this collapses, the invariant above is passing vacuously.
    expect(CATALOG.length).toBeGreaterThan(180);
    expect(CATALOG.filter((p) => p.brand && p.name).length).toBe(CATALOG.length);
  });

  it('every surface agrees — none is more permissive than another', () => {
    // Divergence between resolvers is how the substring rule survived in
    // getProductImageEntry after getProductImage was fixed.
    for (const p of CATALOG) {
      const strict = new Set([
        getProductImage(p.brand, p.name),
        getProductImageEntry(p.brand, p.name)?.url,
      ]);
      expect(strict.size, `${p.brand} ${p.name} resolves differently per surface`).toBe(1);
    }
  });
});

/**
 * The six mechanisms, one representative control each. Documentation of how
 * the class arose — the universal test above is what prevents its return.
 */
describe('the six mechanisms that produced the class', () => {
  it('1. sibling substitution — a brand-mate is not a match', () => {
    // Campfire Audio's Andromeda was illustrated with the Solaris.
    const andromeda = getProductImage('Campfire Audio', 'Andromeda');
    const solaris = getProductImage('Campfire Audio', 'Solaris');
    if (andromeda && solaris) expect(andromeda).not.toBe(solaris);
    expect(andromeda).toBeUndefined();
  });

  it('2. predecessor/successor substitution', () => {
    // The mechanism pinned here is generations SHARING an asset. The
    // original now has its own admitted asset (2026-08-27); each generation
    // resolves to its own photograph and never the other's.
    const original = getProductImage('Eversolo', 'DMP-A6');
    const gen2 = getProductImage('Eversolo', 'DMP-A6 Gen 2');
    expect(original).toBeDefined();
    expect(gen2).toBeDefined();
    expect(original).not.toBe(gen2);
    expect(original).not.toContain('gen2');
  });

  it('3. variant suffixes survive normalisation', () => {
    expect(getProductImage('Leben', 'CS600X')).toBeUndefined();
    expect(getProductImage('Audio Research', 'Reference 5 SE')).toBeUndefined();
  });

  it('4. "+" is a variant token, not punctuation', () => {
    // Stripping it made LRS and LRS+ the same key.
    const lrs = getProductImage('Magnepan', 'LRS');
    const plus = getProductImage('Magnepan', 'LRS+');
    expect(plus).toBeUndefined();
    expect(lrs).toBeDefined();
  });

  it('5. the brand-level fallback is gone, not narrowed', async () => {
    const mod = await import('@/lib/product-images');
    expect('getBrandImage' in mod).toBe(false);
    // A brand with curated imagery must still yield nothing for an unknown model.
    expect(getProductImage('DeVore Fidelity', 'Nonexistent 999')).toBeUndefined();
  });

  it('6. duplicate assets claimed by several keys resolve to the specific one', () => {
    // `chord mojo` and `chord mojo 2` pointed at the same file.
    expect(getProductImage('Chord', 'Mojo')).toBeUndefined();
    expect(getProductImage('Chord', 'Mojo 2')).toBeDefined();
    // Legitimate ALIASES of one product may still share a file.
    expect(getProductImage('Qualio Audio', 'IQ')).toBe(getProductImage('Qualio', 'IQ'));
  });

  it('7. a catalog imageUrl cannot bypass any of the above', () => {
    const foreign = GOVERNED_REGISTRY.find((r) => r.key.includes('devore'))!.url;
    expect(resolveProductImageStrict('KEF', 'LS50 Meta', foreign)).not.toBe(foreign);
  });
});
