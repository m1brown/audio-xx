import { describe, it, expect } from 'vitest';
import {
  getProductImage, getProductImageEntry, resolveProductImageStrict,
  resolveProductImage, resolveProductImageWithConfidence, GOVERNED_REGISTRY,
} from '@/lib/product-images';
import { admissionState, isDisplayable, variantDisagreement } from '../admission';

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
    ['Eversolo', 'DMP-A6'],
    ['JOB', 'Integrated'],
    ['WLM', 'Diva Monitor'],
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
    })).toBe('provenance_ineligible');
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
