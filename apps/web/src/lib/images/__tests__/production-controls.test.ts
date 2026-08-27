import { describe, it, expect } from 'vitest';
import { getProductImage, getProductImageEntry, resolveProductImageStrict, GOVERNED_REGISTRY } from '@/lib/product-images';
import { keyNamesProduct } from '../product-identity';

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
    // Admitted 2026-08-27: Audio46's explicitly-named Gen 1 asset. The
    // invariant is unchanged — the original never wears the Gen 2's photo.
    for (const url of paths('Eversolo', 'DMP-A6')) {
      expect(url).toContain('audio46');
      expect(url).not.toContain('gen2');
    }
    expect(getProductImage('Eversolo', 'DMP-A6 Gen 2')).toContain('gen2');
  });

  it('the JOB INTegrated is never shown the 225, nor a reseller asset', () => {
    for (const url of paths('JOB', 'INTegrated')) expect(url).toBeUndefined();
    for (const url of paths('JOB', '225')) expect(url ?? '').not.toMatch(/tmraudio/);
  });

  it('the WLM Diva Monitor is never shown the Diva MK IV', () => {
    // Admitted 2026-08-27: Onair Records' original-Diva-Monitor asset,
    // presented distinctly from the MK IV on the dealer's own brand page.
    for (const url of paths('WLM', 'Diva Monitor')) {
      expect(url).toContain('wlm_diva_monitor');
      expect(url ?? '').not.toMatch(/mk.?iv|mkii/i);
    }
    expect(getProductImage('WLM', 'Diva MK IV')).toBeUndefined();
  });
});

describe('Nathan — dCS Rossini Apex / ARC Reference 5 / Butler MONAD A100 / Acora QRC-2', () => {
  const NATHAN: Array<[string, string]> = [
    ['dCS', 'Rossini Apex'],
    ['Audio Research', 'Reference 5'],
    ['Butler', 'MONAD A100'],
    ['Acora', 'QRC-2'],
  ];

  it('no component borrows another product\'s asset', () => {
    for (const [brand, name] of NATHAN) {
      for (const url of paths(brand, name)) {
        if (url === undefined) continue;
        // Whatever resolves must be keyed to THIS product, not a sibling.
        const row = GOVERNED_REGISTRY.find((r) => r.url === url);
        if (row) expect(keyNamesProduct(row.key, { brand, name }), `${brand} ${name}`).toBe(true);
      }
    }
  });

  it('the Reference 5 is never shown the Reference 5 SE', () => {
    const base = getProductImage('Audio Research', 'Reference 5');
    const se = getProductImage('Audio Research', 'Reference 5 SE');
    if (base && se) expect(base).not.toBe(se);
  });

  it('every resolver agrees per component — no surface is more permissive', () => {
    for (const [brand, name] of NATHAN) {
      const [a, b, c] = paths(brand, name);
      expect(new Set([a, b, c]).size, `${brand} ${name} disagrees across surfaces`).toBe(1);
    }
  });
});

describe('Leben CS600 / Acora QRC-2 and the variant neighbours', () => {
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
    ['Eversolo', 'DMP-A6', 'DMP-A6 Master Edition'],
    ['JOB', 'Integrated', '225'],
    ['WLM', 'Diva Monitor', 'Diva'],
    ['WLM', 'Diva Monitor', 'Diva MK IV'],
    ['WLM', 'Diva', 'Diva MK IV'],
  ];

  for (const [brand, base, variant] of PAIRS) {
    it(`${brand} ${base} and ${variant} never share an asset`, () => {
      const a = getProductImage(brand, base);
      const b = getProductImage(brand, variant);
      if (a !== undefined && b !== undefined) expect(a).not.toBe(b);
    });
  }
});


describe('imagery is presentation only — it changes no reasoning', () => {
  it('no reasoning module imports an image resolver', async () => {
    const { readFileSync } = await import('node:fs');
    const REASONING = [
      'apps/web/src/lib/relational-explain.ts',
      'apps/web/src/lib/evidence/physical-quantities.ts',
      'apps/web/src/lib/evidence/product-dossier.ts',
      'apps/web/src/lib/artifact/canonical.ts',
      'apps/web/src/lib/axis-poles.ts',
    ];
    for (const f of REASONING) {
      const src = readFileSync(f, 'utf8');
      expect(src, `${f} couples imagery to reasoning`).not.toMatch(/product-images|images\/admission/);
    }
  });

  it('synthesizeArtifact touches imagery in exactly one place', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('apps/web/src/lib/artifact/synthesizeArtifact.ts', 'utf8');
    // This module assembles the payload, so it legitimately resolves component
    // photos. What must stay true is that the result reaches presentation and
    // NOTHING else — the moment a verdict or an axis reads it, image
    // availability starts changing what Audio XX says.
    // Comments discuss these names deliberately; count only live code.
    const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    const calls = [...code.matchAll(/getProductImage\s*\(/g)];
    expect(calls, 'more than one image lookup in the reasoning module').toHaveLength(1);
    for (const name of ['componentPhotos', 'resolvedPhotoCount', 'showPhotoRail']) {
      const uses = [...code.matchAll(new RegExp(`\\b${name}\\b`, 'g'))];
      // Declaration plus a bounded number of presentation reads. If this grows,
      // something new is reading image state and needs checking by hand.
      expect(uses.length, `${name} has spread beyond the photo rail`).toBeLessThanOrEqual(4);
    }
    // The rail is the terminal consumer.
    expect(code).toMatch(/componentPhotos:\s*showPhotoRail \? componentPhotos : undefined/);
  });

  it('the artifact snapshot carries no image URL', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('apps/web/src/lib/artifact/snapshot.ts', 'utf8');
    // A frozen snapshot must stay valid when an asset is later withdrawn, and
    // must not be re-openable as a route by which a suppressed image returns.
    expect(src).not.toMatch(/imageUrl|product-images/);
  });
});
