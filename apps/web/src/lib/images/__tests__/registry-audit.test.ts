import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { GOVERNED_REGISTRY } from '@/lib/product-images';
import { admissionState, isDisplayable, classifyCatalogHost, variantDisagreement, assetCorroboratesKey, hostIsIneligible, type GovernedImage } from '../admission';
import { DAC_PRODUCTS } from '@/lib/products/dacs';
import { AMPLIFIER_PRODUCTS } from '@/lib/products/amplifiers';
import { SPEAKER_PRODUCTS } from '@/lib/products/speakers';
import { TURNTABLE_PRODUCTS } from '@/lib/products/turntables';

/**
 * Regenerates docs/audits/image-admission.json — the machine-readable audit
 * of EVERY image Audio XX could show, registry and catalog alike.
 *
 * It lives as a test rather than a script so it cannot rot: it runs in the
 * gate, and the assertions below are the standing regression. If a new row is
 * added with a variant-significant token its key does not name, this fails.
 */

const CATALOG = [
  ...DAC_PRODUCTS.map((p) => ({ ...p, pool: 'dacs' })),
  ...AMPLIFIER_PRODUCTS.map((p) => ({ ...p, pool: 'amplifiers' })),
  ...SPEAKER_PRODUCTS.map((p) => ({ ...p, pool: 'speakers' })),
  ...TURNTABLE_PRODUCTS.map((p) => ({ ...p, pool: 'turntables' })),
] as Array<{ brand: string; name: string; imageUrl?: string; pool: string }>;

function governCatalog(p: { brand: string; name: string; imageUrl?: string; pool: string }) {
  const url = p.imageUrl!;
  const key = `${p.brand} ${p.name}`;
  const disagreement = variantDisagreement(key, url);
  const img: GovernedImage = {
    key, url,
    identityStatus: disagreement ? 'known_wrong'
      : (assetCorroboratesKey(key, url) ? 'corroborated' : 'unverified'),
    identityNote: disagreement ? `asset asserts '${disagreement}'` : undefined,
    sourceClass: classifyCatalogHost(p.brand, url),
    rightsBasis: 'none_recorded',
    hosting: url.startsWith('/') ? 'local' : 'remote',
  };
  return { ...img, pool: p.pool, state: admissionState(img), displayed: isDisplayable(img) };
}

describe('image admission audit', () => {
  const catalog = CATALOG.filter((p) => p.imageUrl && p.imageUrl.trim()).map(governCatalog);
  const registry = GOVERNED_REGISTRY.map((r) => ({ ...r, displayed: isDisplayable(r) }));

  it('writes the audit artifact', () => {
    const tally = (rows: Array<{ state: string }>) =>
      rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r.state]: (a[r.state] ?? 0) + 1 }), {});

    writeFileSync('docs/audits/image-admission.json', JSON.stringify({
      generatedBy: 'apps/web/src/lib/images/__tests__/registry-audit.test.ts',
      invariant: 'exact identity AND approved provenance AND recorded rights, established independently',
      enforcement: 'identity (staged) — see lib/images/admission.ts',
      totals: {
        registry: registry.length,
        registryDisplayed: registry.filter((r) => r.displayed).length,
        catalog: catalog.length,
        catalogDisplayed: catalog.filter((r) => r.displayed).length,
      },
      registryByState: tally(registry),
      catalogByState: tally(catalog),
      registry: registry.map(({ key, url, state, displayed, identityStatus, sourceClass, rightsBasis, hosting, identityNote, credit, captured }) =>
        ({ key, url, state, displayed, identityStatus, sourceClass, rightsBasis, hosting, identityNote, credit, captured })),
      catalog: catalog.map(({ key, url, state, displayed, identityStatus, sourceClass, hosting, pool, identityNote }) =>
        ({ key, url, state, displayed, identityStatus, sourceClass, hosting, pool, identityNote })),
    }, null, 2) + '\n');

    expect(registry.length).toBeGreaterThan(150);
  });

  it('nothing wrong or prohibited is displayed, registry or catalog', () => {
    for (const r of [...registry, ...catalog]) {
      if (!r.displayed) continue;
      expect(r.state, r.key).not.toBe('identity_wrong');
      expect(hostIsIneligible(r.url), r.key).toBe(false);
    }
  });

  it('no catalog asset is served from another brand\'s host', () => {
    for (const r of catalog) {
      if (!r.displayed) continue;
      expect(r.sourceClass, `${r.key} → ${r.url}`).toBe('manufacturer');
    }
  });

  it('every rights basis is still unrecorded — the grandfather clause is live', () => {
    // A deadline, not a design. When this starts failing because rows have
    // real rights records, the enforcement level should move to 'full'.
    expect(registry.every((r) => r.rightsBasis === 'none_recorded')).toBe(true);
    expect(registry.filter((r) => r.state === 'admissible')).toHaveLength(0);
  });
});
