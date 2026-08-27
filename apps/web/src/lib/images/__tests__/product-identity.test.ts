import { describe, it, expect } from 'vitest';
import { keyNamesProduct, identityTokens, sameProductIdentity } from '../product-identity';

/**
 * An image is an identity asset. The wrong generation is worse than none.
 */

describe('THE VARIANT TRAPS — each must be impossible', () => {
  it('CS600 is not CS600X', () => {
    expect(keyNamesProduct('leben cs600', { brand: 'Leben', name: 'CS600X' })).toBe(false);
    expect(keyNamesProduct('leben cs600', { brand: 'Leben', name: 'CS600' })).toBe(true);
  });

  it('Reference 5 is not Reference 5 SE', () => {
    expect(keyNamesProduct('audio research reference 5',
      { brand: 'Audio Research', name: 'Reference 5 SE' })).toBe(false);
    expect(keyNamesProduct('audio research reference 5',
      { brand: 'Audio Research', name: 'Reference 5' })).toBe(true);
  });

  it('DMP-A6 is not DMP-A6 Gen 2, nor the Master Edition', () => {
    expect(keyNamesProduct('eversolo dmp a6', { brand: 'Eversolo', name: 'DMP-A6 Gen 2' })).toBe(false);
    expect(keyNamesProduct('eversolo dmp a6', { brand: 'Eversolo', name: 'DMP-A6 Master Edition' })).toBe(false);
    expect(keyNamesProduct('eversolo dmp a6', { brand: 'Eversolo', name: 'DMP-A6' })).toBe(true);
  });

  it('JOB 225 is never the JOB Integrated', () => {
    expect(keyNamesProduct('job 225', { brand: 'JOB', name: 'Integrated' })).toBe(false);
    expect(keyNamesProduct('goldmund job 225', { brand: 'JOB', name: 'Integrated' })).toBe(false);
  });

  it('Diva MK IV is never the Diva Monitor', () => {
    expect(keyNamesProduct('wlm diva mk iv', { brand: 'WLM', name: 'Diva Monitor' })).toBe(false);
    expect(keyNamesProduct('wlm diva', { brand: 'WLM', name: 'Diva Monitor' })).toBe(false);
  });

  it('a sibling in the same family never substitutes', () => {
    expect(keyNamesProduct('chord hugo', { brand: 'Chord', name: 'Hugo TT2' })).toBe(false);
    expect(keyNamesProduct('chord mojo', { brand: 'Chord', name: 'Mojo 2' })).toBe(false);
    expect(keyNamesProduct('magnepan lrs', { brand: 'Magnepan', name: 'LRS+' })).toBe(false);
  });
});

describe('positive controls — exact identity still matches', () => {
  it('matches when the key carries the brand', () => {
    expect(keyNamesProduct('dcs rossini apex', { brand: 'dCS', name: 'Rossini Apex' })).toBe(true);
  });

  it('matches when the key omits the brand', () => {
    // Brand may be omitted where identity is otherwise established.
    expect(keyNamesProduct('rossini apex', { brand: 'dCS', name: 'Rossini Apex' })).toBe(true);
  });

  it('is insensitive to punctuation and case', () => {
    expect(keyNamesProduct('acora qrc 2', { brand: 'Acora', name: 'QRC-2' })).toBe(true);
    expect(keyNamesProduct('ACORA  QRC-2', { brand: 'acora', name: 'qrc 2' })).toBe(true);
  });

  it('handles a brand repeated inside its own model name', () => {
    // "JOB JOB 225" is one mention, not two products.
    expect(keyNamesProduct('job 225', { brand: 'JOB', name: 'JOB 225' })).toBe(true);
  });

  it('tokenises generation markers as their own tokens', () => {
    expect(identityTokens('DMP-A6 Gen 2')).toEqual(['dmp', 'a6', 'gen', '2']);
  });
});

describe('ambiguity yields nothing', () => {
  it('an empty or nameless product never matches', () => {
    expect(keyNamesProduct('leben cs600', {})).toBe(false);
    expect(keyNamesProduct('', { brand: 'Leben', name: 'CS600' })).toBe(false);
  });

  it('a bare brand does not identify a product', () => {
    expect(keyNamesProduct('leben', { brand: 'Leben', name: 'CS600' })).toBe(false);
  });

  it('is symmetric', () => {
    const a = { brand: 'Leben', name: 'CS600' };
    const b = { brand: 'Leben', name: 'CS600X' };
    expect(sameProductIdentity(a, b)).toBe(false);
    expect(sameProductIdentity(b, a)).toBe(false);
    expect(sameProductIdentity(a, a)).toBe(true);
  });
});

describe('the live registry serves no wrong-generation asset', () => {
  it('the original DMP-A6 gets its own asset, never the Gen 2 thumbnail', async () => {
    // History: the Gen 2 thumb was once keyed as the plain `eversolo dmp a6`,
    // so FRANCE's original DMP-A6 was shown its successor. The original now
    // carries Audio46's explicitly-named Gen 1 asset (admitted 2026-08-27);
    // the invariant that survives is that the two generations never share.
    const { getProductImage } = await import('@/lib/product-images');
    expect(getProductImage('Eversolo', 'DMP-A6')).toContain('audio46');
    expect(getProductImage('Eversolo', 'DMP-A6')).not.toContain('gen2');
    expect(getProductImage('Eversolo', 'DMP-A6 Gen 2')).toContain('gen2');
  });

  it('the Leben CS600X gets no image while only a CS600 asset is held', async () => {
    const { getProductImage } = await import('@/lib/product-images');
    expect(getProductImage('Leben', 'CS600X')).toBeUndefined();
    expect(getProductImage('Leben', 'CS600')).toContain('leben-cs600');
  });

  it('the JOB Integrated carries no image, and never the 225 asset', async () => {
    // Its only asset was hosted by a used-gear reseller. Identity was exact;
    // the source class was not admissible, and coverage is not a reason to
    // broaden the policy.
    const { getProductImage } = await import('@/lib/product-images');
    expect(getProductImage('JOB', 'Integrated')).toBeUndefined();
    expect(getProductImage('JOB', 'INTegrated')).toBeUndefined();
  });

  it('no user-visible image is served from a reseller host', async () => {
    const { getProductImage } = await import('@/lib/product-images');
    for (const p of [['JOB', 'Integrated'], ['Eversolo', 'DMP-A6'], ['Leben', 'CS600X']]) {
      const url = getProductImage(p[0], p[1]) ?? '';
      expect(url, p.join(' ')).not.toMatch(/tmraudio|ebay|reverb|audiogon/i);
    }
  });
});
