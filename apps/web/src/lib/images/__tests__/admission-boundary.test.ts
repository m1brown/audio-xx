import { describe, it, expect } from 'vitest';
import {
  getProductImage, getProductImageEntry, resolveProductImageStrict,
  resolveProductImage, resolveProductImageWithConfidence, GOVERNED_REGISTRY,
} from '@/lib/product-images';
import { admissionState, isDisplayable, variantDisagreement, hostIsIneligible } from '../admission';

/**
 * ONE boundary. Before this, three separate paths could serve an image, and
 * each enforced a different rule:
 *
 *   getProductImage          — exact identity + the F4 reviewer gate
 *   getProductImageEntry     — SUBSTRING matching, so CS600 matched CS600X
 *   catalogImageUrl          — nothing at all; it won outright
 *
 * A rule enforced on one path out of three is not a rule.
 */

const RESOLVERS: Array<[string, (b: string, n: string) => string | undefined]> = [
  ['getProductImage', (b, n) => getProductImage(b, n)],
  ['getProductImageEntry', (b, n) => getProductImageEntry(b, n)?.url],
  ['resolveProductImageStrict', (b, n) => resolveProductImageStrict(b, n)],
];

describe('every user-visible resolver enforces exact identity', () => {
  const TRAPS: Array<[string, string]> = [
    ['Leben', 'CS600X'],
    ['Magnepan', 'LRS+'],
    ['Audio Research', 'Reference 5 SE'],
    // 2026-08-27: 'Eversolo DMP-A6' and 'WLM Diva Monitor' left this list —
    // they were absence pins from when no admissible source existed, not
    // variant traps. Both now carry identity-exact authorized-dealer assets
    // (Audio46's explicitly-named Gen 1 page; Onair's original-Diva-Monitor
    // asset, distinct from the MK IV). The variant separations stay pinned
    // in production-controls and product-identity.
    ['JOB', 'Integrated'],
    ['Vinnie Rossi', 'L2i'],
    ['Chord', 'Mojo'],
    ['Klipsch', 'Heresy'],
  ];

  for (const [name, resolve] of RESOLVERS) {
    for (const [brand, product] of TRAPS) {
      it(`${name} serves no image for ${brand} ${product}`, () => {
        expect(resolve(brand, product)).toBeUndefined();
      });
    }
  }
});

describe('the catalog is not an alternate trust boundary', () => {
  // It used to be: `catalogImageUrl ?? getProductImage(...)`.
  const WRONG = 'https://positive-feedback.com/wp-content/uploads/2020/09/L2i-SE-Front-Silver-1.jpg';

  it('a catalog URL from a prohibited host is withheld', () => {
    expect(resolveProductImageStrict('Vinnie Rossi', 'L2i', WRONG)).toBeUndefined();
  });

  it('a catalog URL from a reseller is withheld', () => {
    expect(
      resolveProductImageStrict('JOB', '225', 'https://tmraudio.com/cdn/shop/files/12146.jpg'),
    ).toBeUndefined();
  });

  it('a catalog URL whose host is a different brand is withheld', () => {
    expect(
      resolveProductImageStrict('KEF', 'LS50', 'https://devorefidelity.com/img/o93.jpg'),
    ).toBeUndefined();
  });

  it('a suppressed catalog URL never reaches the confidence resolver either', () => {
    const r = resolveProductImageWithConfidence({
      catalogUrl: WRONG, brand: 'Vinnie Rossi', name: 'L2i', category: 'amplifier',
    });
    expect(r.url).not.toContain('positive-feedback');
    expect(r.source).toBe('placeholder');
  });

  it('a first-party catalog URL for the right brand still resolves', () => {
    expect(
      resolveProductImageStrict('DeVore Fidelity', 'Orangutan O/93',
        'https://devorefidelity.com/img/o93.jpg'),
    ).toBe('https://devorefidelity.com/img/o93.jpg');
  });
});

describe('no family substitution survives anywhere', () => {
  it('the brand-level fallback is gone', async () => {
    const mod = await import('@/lib/product-images');
    expect('getBrandImage' in mod).toBe(false);
  });

  it('the legacy chain degrades to a placeholder, never to a sibling', () => {
    // DeVore has curated imagery for other models; none may stand in here.
    const url = resolveProductImage('DeVore Fidelity', 'Nonexistent Model 999', undefined, 'speaker');
    expect(url).toBe('/images/placeholders/speaker.svg');
  });
});

describe('the registry itself is governed', () => {
  it('withholds every asset the detector found wrong', () => {
    const wrong = GOVERNED_REGISTRY.filter((r) => r.state === 'identity_wrong');
    expect(wrong.length).toBeGreaterThan(0);
    for (const r of wrong) expect(isDisplayable(r), r.key).toBe(false);
  });

  it('serves nothing from a reviewer publication, reseller, or 6moons', () => {
    for (const r of GOVERNED_REGISTRY) {
      if (!isDisplayable(r)) continue;
      expect(r.url, r.key).not.toMatch(/tmraudio|ebay\.|reverb\.com|audiogon|6moons|positive-feedback|headfonics/i);
    }
  });

  it('full enforcement is strictly a subset of staged enforcement', () => {
    for (const r of GOVERNED_REGISTRY) {
      if (isDisplayable(r, 'full')) expect(isDisplayable(r, 'identity'), r.key).toBe(true);
    }
  });
});

describe('the detector distinguishes disagreement from silence', () => {
  it('catches a variant the key does not name', () => {
    expect(variantDisagreement('klipsch heresy', 'https://x.com/Heresy-IV_Walnut.jpg')).toBe('iv');
    expect(variantDisagreement('vinnie rossi l2i', 'https://x.com/L2i-SE-Front.jpg')).toBe('se');
  });

  it('catches a token the asset EXTENDS — the substring hazard', () => {
    // `z40` is a substring of `z40i`, so containment alone calls this a match.
    expect(variantDisagreement('linear tube audio z40', 'https://x.com/Z40i_004.jpg')).toBe('z40i');
  });

  it('reads a URL "+" as a space, not as the LRS+ suffix', () => {
    expect(variantDisagreement('magico a3', 'https://x.com/3+%284%29.jpg')).toBeUndefined();
  });

  it('tolerates a filename joining tokens the key separates', () => {
    // `gen 2` in the key, `gen2` in the filename — the same product.
    expect(variantDisagreement('eversolo dmp a6 gen 2', 'https://x.com/eversolo-a6-gen2.webp'))
      .toBeUndefined();
  });

  it('says nothing about an opaque filename', () => {
    expect(variantDisagreement('magico a3', 'https://cdn.x.com/1567191992078-77SK24QU.jpg'))
      .toBeUndefined();
  });
});

type GovernedImageLike = Partial<Parameters<typeof admissionState>[0]>;

describe('admission state is derived from independent predicates', () => {
  const base = {
    key: 'x y', url: 'https://x.com/y.jpg', hosting: 'remote' as const,
  };

  it('a wrong image is wrong however good its provenance', () => {
    expect(admissionState({
      ...base, identityStatus: 'known_wrong', sourceClass: 'manufacturer',
      rightsBasis: 'media_kit',
    })).toBe('identity_wrong');
  });

  it('recorded rights never establish identity', () => {
    expect(admissionState({
      ...base, identityStatus: 'unverified', sourceClass: 'manufacturer',
      rightsBasis: 'written_permission',
    })).toBe('identity_unverified');
  });

  it('verified identity never establishes provenance', () => {
    expect(admissionState({
      ...base, identityStatus: 'verified_exact', sourceClass: 'retailer',
      rightsBasis: 'media_kit',
    })).toBe('provenance_prohibited');
  });

  it('unrecorded provenance is a different state from prohibited provenance', () => {
    // Merging these made the audit unreadable: 88 of 96 rows classified
    // "ineligible" were being displayed. One is a ruling, the other a gap.
    expect(admissionState({
      ...base, identityStatus: 'corroborated', sourceClass: 'unclassified',
      rightsBasis: 'media_kit',
    })).toBe('provenance_unestablished');
  });

  it('state alone determines display at each enforcement level', () => {
    // No caller should have to re-derive the decision from sourceClass or host.
    const cases: Array<[GovernedImageLike, boolean, boolean]> = [
      [{ identityStatus: 'known_wrong', sourceClass: 'manufacturer' }, false, false],
      [{ identityStatus: 'corroborated', sourceClass: 'retailer' }, false, false],
      [{ identityStatus: 'corroborated', sourceClass: 'unclassified' }, true, false],
      [{ identityStatus: 'unverified', sourceClass: 'manufacturer' }, true, false],
      [{ identityStatus: 'corroborated', sourceClass: 'manufacturer' }, true, true],
    ];
    for (const [partial, atIdentity, atFull] of cases) {
      const img = { ...base, rightsBasis: 'none_recorded' as const, ...partial };
      expect(isDisplayable(img, 'identity'), JSON.stringify(partial)).toBe(atIdentity);
      expect(isDisplayable(img, 'full'), JSON.stringify(partial)).toBe(atFull);
    }
  });

  it('only all three together are admissible', () => {
    expect(admissionState({
      ...base, identityStatus: 'verified_exact', sourceClass: 'manufacturer',
      rightsBasis: 'media_kit',
    })).toBe('admissible');
  });

  it('missing rights records grandfather, they do not admit', () => {
    expect(admissionState({
      ...base, identityStatus: 'corroborated', sourceClass: 'manufacturer',
      rightsBasis: 'none_recorded',
    })).toBe('legacy_rights_pending');
  });
});

describe('marketplace imagery can never surface through a metadata gap', () => {
  /**
   * Two WiiM assets were served from `m.media-amazon.com` — marketplace
   * listing photographs, a retailer class the Tier I/II rule already excludes.
   * They reached readers for a reason worth naming: their rows carry no
   * `source` block, and under staged enforcement a MISSING tier is tolerated.
   * So the exclusion was defeated not by a decision but by an absence.
   *
   * That is the general hazard with staging, and the reason prohibited hosts
   * are checked against the URL itself rather than against a tier that a row
   * may simply never have been given.
   */
  const MARKETPLACE = [
    'https://m.media-amazon.com/images/I/51fa861331L._AC_SL1500_.jpg',
    'https://www.ebay.com/img/x.jpg',
    'https://reverb.com/img/x.jpg',
    'https://tmraudio.com/cdn/shop/files/x.jpg',
    'https://www.audiogon.com/img/x.jpg',
  ];

  it('is withheld even when the row records no provenance at all', () => {
    for (const url of MARKETPLACE) {
      expect(hostIsIneligible(url), url).toBe(true);
      expect(isDisplayable({
        key: 'wiim pro', url, hosting: 'remote',
        identityStatus: 'corroborated',   // identity is fine…
        sourceClass: 'manufacturer',      // …and the tier even claims first-party
        rightsBasis: 'media_kit',         // …and rights are recorded
      }), url).toBe(false);
    }
  });

  it('the live registry serves no marketplace asset on any surface', () => {
    for (const [name, resolve] of RESOLVERS) {
      for (const p of [['WiiM', 'Pro'], ['WiiM', 'Pro Plus'], ['JOB', '225']]) {
        const url = resolve(p[0], p[1]) ?? '';
        expect(url, `${name}: ${p.join(' ')}`).not.toMatch(/media-amazon|ebay\.|reverb\.com|tmraudio|audiogon/i);
      }
    }
  });

  it('a marketplace URL arriving as a catalog imageUrl is withheld too', () => {
    expect(resolveProductImageStrict('WiiM', 'Pro', MARKETPLACE[0])).toBeUndefined();
  });
});
