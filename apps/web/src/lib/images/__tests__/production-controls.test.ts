import { describe, it, expect } from 'vitest';
import { getProductImage, getProductImageEntry, resolveProductImageStrict } from '@/lib/product-images';

/**
 * The two beta systems, checked component by component.
 *
 * These are the assessments a real listener reads, so they are the place a
 * wrong photograph does actual damage: a reader takes an image as
 * confirmation that Audio XX knows which product they own.
 *
 * An expected `undefined` here is a PASS, not a coverage gap. No image is
 * preferable to the wrong image, and absence is a finished state.
 */

const paths = (b: string, n: string) => [
  getProductImage(b, n),
  getProductImageEntry(b, n)?.url,
  resolveProductImageStrict(b, n),
];

describe('FRANCE — Eversolo DMP-A6 / JOB INTegrated / WLM Diva Monitor', () => {
  it('the DMP-A6 is never shown its successor', () => {
    // The only Eversolo asset is `eversolo-a6-gen2-thumb.webp`, and this
    // listener owns the original.
    for (const url of paths('Eversolo', 'DMP-A6')) expect(url).toBeUndefined();
    expect(getProductImage('Eversolo', 'DMP-A6 Gen 2')).toContain('gen2');
  });

  it('the JOB INTegrated is never shown the 225, nor a reseller asset', () => {
    for (const url of paths('JOB', 'INTegrated')) expect(url).toBeUndefined();
    for (const url of paths('JOB', '225')) expect(url ?? '').not.toMatch(/tmraudio/);
  });

  it('the WLM Diva Monitor is never shown the Diva MK IV', () => {
    for (const url of paths('WLM', 'Diva Monitor')) expect(url).toBeUndefined();
  });
});

describe('Nathan — Leben CS600 / Acora QRC-2 and the variant neighbours', () => {
  it('the CS600 resolves, and the CS600X does not borrow it', () => {
    expect(getProductImage('Leben', 'CS600')).toContain('leben-cs600');
    for (const url of paths('Leben', 'CS600X')) expect(url).toBeUndefined();
  });

  it('the Acora QRC-2 never borrows another Acora model', () => {
    const own = getProductImage('Acora', 'QRC-2');
    for (const other of ['QRC-1', 'SRC-1', 'SRB']) {
      const url = getProductImage('Acora', other);
      if (url && own) expect(url).not.toBe(own);
    }
  });
});

describe('the named variant pairs stay separated', () => {
  const PAIRS: Array<[string, string, string]> = [
    ['Leben', 'CS600', 'CS600X'],
    ['Magnepan', 'LRS', 'LRS+'],
    ['Audio Research', 'Reference 5', 'Reference 5 SE'],
    ['Eversolo', 'DMP-A6', 'DMP-A6 Gen 2'],
    ['Chord', 'Hugo', 'Hugo TT2'],
    ['Chord', 'Mojo', 'Mojo 2'],
    ['Klipsch', 'Heresy', 'Heresy IV'],
    ['Linear Tube Audio', 'Z40', 'Z40i'],
    ['Vinnie Rossi', 'L2i', 'L2i-SE'],
  ];

  for (const [brand, base, variant] of PAIRS) {
    it(`${brand} ${base} and ${variant} never share an asset`, () => {
      const a = getProductImage(brand, base);
      const b = getProductImage(brand, variant);
      if (a !== undefined && b !== undefined) expect(a).not.toBe(b);
    });
  }
});
