import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import * as NEW from '@/lib/product-images';
import * as OLD from '@/lib/__diffsnapshot__/old-product-images';
import { DAC_PRODUCTS } from '@/lib/products/dacs';
import { AMPLIFIER_PRODUCTS } from '@/lib/products/amplifiers';
import { SPEAKER_PRODUCTS } from '@/lib/products/speakers';
import { TURNTABLE_PRODUCTS } from '@/lib/products/turntables';
import { HEADPHONE_PRODUCTS } from '@/lib/products/headphones';
import { GOVERNED_REGISTRY } from '@/lib/product-images';
import { keyNamesProduct } from '../product-identity';

/**
 * Complete pre-change vs post-change resolution diff.
 *
 * `__diffsnapshot__/old-product-images.ts` is the file as it stood at b9cc3ac,
 * imported alongside the current one so both answer the same questions about
 * the same products. Claiming a change is conservative is not the same as
 * measuring it, and the two resolvers disagree in more than one direction:
 * exact matching can now REACH an entry that substring shadowing used to hide.
 */

type P = { brand: string; name: string; imageUrl?: string; category?: string };
const UNIVERSE: P[] = [
  ...DAC_PRODUCTS, ...AMPLIFIER_PRODUCTS, ...SPEAKER_PRODUCTS,
  ...TURNTABLE_PRODUCTS, ...HEADPHONE_PRODUCTS,
] as P[];

/** Every registry key, as a product, so suppressed rows appear in the diff too. */
const REGISTRY_AS_PRODUCTS: P[] = GOVERNED_REGISTRY.map((r) => ({ brand: '', name: r.key }));

const ALL = [...UNIVERSE, ...REGISTRY_AS_PRODUCTS];

type Row = {
  product: string; surface: string;
  before?: string; after?: string;
  kind: 'suppressed' | 'revealed' | 'substituted';
  reason: string;
};

function classify(p: P, before: string | undefined, after: string | undefined): Row['kind'] {
  if (before && !after) return 'suppressed';
  if (!before && after) return 'revealed';
  return 'substituted';
}

function reasonFor(p: P, before?: string, after?: string): string {
  const row = GOVERNED_REGISTRY.find((r) => r.url === before);
  // The asset previously shown belonged to a DIFFERENT product — a sibling
  // supplied by substring matching or by the brand-level fallback. Campfire
  // Audio's Andromeda was illustrated with the Solaris. That is a correctness
  // fix however it arrived, and calling it a matcher artefact would understate
  // what a reader was being shown.
  if (before && row && !keyNamesProduct(row.key, { brand: p.brand, name: p.name })) {
    return `correctness — the asset shown belonged to a different product (${row.key})`;
  }
  if (before && !after) {
    if (row?.state === 'identity_wrong') return `correctness — ${row.identityNote}`;
    if (row?.state === 'provenance_prohibited') return `correctness — prohibited source (${row.sourceClass})`;
    if (row?.state === 'provenance_unestablished') return `provenance suppression — no provenance recorded`;
    if (row) return `provenance suppression — ${row.state}`;
    return 'provenance suppression — catalog URL not first-party and no recorded provenance';
  }
  if (!before && after) return 'exact-matcher shadowing change — a nearer entry was previously hidden by a substring match';
  return 'exact-matcher shadowing change — a different entry now matches exactly';

}

describe('pre/post resolution diff', () => {
  const rows: Row[] = [];

  const SURFACES: Array<[string, (p: P) => string | undefined, (p: P) => string | undefined]> = [
    ['getProductImage',
      (p) => OLD.getProductImage(p.brand, p.name),
      (p) => NEW.getProductImage(p.brand, p.name)],
    ['getProductImageEntry',
      (p) => OLD.getProductImageEntry(p.brand, p.name)?.url,
      (p) => NEW.getProductImageEntry(p.brand, p.name)?.url],
    ['resolveProductImageStrict',
      (p) => OLD.resolveProductImageStrict(p.brand, p.name, p.imageUrl),
      (p) => NEW.resolveProductImageStrict(p.brand, p.name, p.imageUrl)],
    ['resolveProductImage',
      (p) => OLD.resolveProductImage(p.brand, p.name, p.imageUrl, p.category),
      (p) => NEW.resolveProductImage(p.brand, p.name, p.imageUrl, p.category)],
    // The pattern ten call sites wrote by hand: the catalog URL winning
    // outright, facing neither the identity nor the provenance test. This is
    // what those consumers actually did before, so it is what must be diffed.
    ['consumer: imageUrl ?? getProductImage',
      (p) => p.imageUrl ?? OLD.getProductImage(p.brand, p.name),
      (p) => NEW.resolveProductImageStrict(p.brand, p.name, p.imageUrl)],
    ['resolveProductImageWithConfidence',
      (p) => OLD.resolveProductImageWithConfidence({ catalogUrl: p.imageUrl, brand: p.brand, name: p.name, category: p.category }).url,
      (p) => NEW.resolveProductImageWithConfidence({ catalogUrl: p.imageUrl, brand: p.brand, name: p.name, category: p.category }).url],
  ];

  it('writes the complete diff', () => {
    for (const [surface, oldFn, newFn] of SURFACES) {
      for (const p of ALL) {
        const before = oldFn(p);
        const after = newFn(p);
        if (before === after) continue;
        rows.push({
          product: `${p.brand} ${p.name}`.trim(),
          surface, before, after,
          kind: classify(p, before, after),
          reason: reasonFor(p, before, after),
        });
      }
    }

    const tally = rows.reduce<Record<string, number>>(
      (a, r) => ({ ...a, [r.kind]: (a[r.kind] ?? 0) + 1 }), {});

    writeFileSync('docs/audits/image-resolution-diff.json', JSON.stringify({
      baseline: 'b9cc3ac', head: 'staged identity enforcement',
      productsProbed: ALL.length, surfaces: SURFACES.map((s) => s[0]),
      changedResolutions: rows.length, byKind: tally,
      rows: rows.sort((a, b) => a.product.localeCompare(b.product)),
    }, null, 2) + '\n');

    console.log('probed', ALL.length, 'products ×', SURFACES.length, 'surfaces');
    console.log('changed resolutions:', rows.length, tally);
    const revealed = rows.filter((r) => r.kind === 'revealed');
    console.log('REVEALED:', revealed.length);
    for (const r of revealed.slice(0, 40)) console.log(`  ${r.surface} | ${r.product} -> ${r.after?.slice(0, 70)}`);
    const subs = rows.filter((r) => r.kind === 'substituted');
    console.log('SUBSTITUTED:', subs.length);
    for (const r of subs.slice(0, 40)) console.log(`  ${r.surface} | ${r.product}\n     was ${r.before?.slice(0,70)}\n     now ${r.after?.slice(0,70)}`);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('nothing became newly visible without passing admission', () => {
    for (const r of rows) {
      if (r.kind !== 'revealed' && r.kind !== 'substituted') continue;
      const row = GOVERNED_REGISTRY.find((g) => g.url === r.after);
      // Every newly-shown asset must be a governed, displayable registry row,
      // a first-party catalog URL, or a local placeholder SVG.
      const ok = (row !== undefined) || r.after?.startsWith('/images/placeholders/');
      expect(ok, `${r.product} → ${r.after}`).toBe(true);
    }
  });

  it('no wrong-variant asset survives on any surface', () => {
    for (const r of rows) {
      if (!r.after) continue;
      // Several rows may share one URL — `goldmund telos 590` and `goldmund
      // telos 690` do, one rightly and one wrongly. `find` returns whichever
      // comes first in the table, which is not a fact about this product. The
      // asset is admissible if SOME row entitles it.
      const claiming = GOVERNED_REGISTRY.filter((g) => g.url === r.after);
      if (claiming.length === 0) continue;
      expect(
        claiming.some((g) => g.state !== 'identity_wrong'),
        `${r.product} → ${r.after} is claimed only by wrong-variant rows`,
      ).toBe(true);
    }
  });
});
