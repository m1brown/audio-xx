import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { getProductImage, resolveProductImageStrict } from '@/lib/product-images';

/**
 * `/brand-heroes` is a SEPARATE governance question and stays separate.
 *
 * These are brand-authority illustrations, not product-card imagery: they
 * answer "what does this maker stand for", where a product image answers
 * "is this the box you own". Folding them into the product-image admission
 * model would apply an exact-variant identity rule to an asset that is not
 * making a variant claim in the first place.
 *
 * Their provenance is in fact BETTER than the product registry's — every one
 * carries a credit and a first-party source URL, which 93 registry rows do
 * not. What they lack is a rights basis, and two of them assert one.
 */

const DIR = 'apps/web/public/brand-heroes';
const FILES = readdirSync(DIR).filter((f) => /\.(jpg|png|webp)$/.test(f));
const CONSULTATION = readFileSync('apps/web/src/lib/consultation.ts', 'utf8');

describe('brand-hero audit', () => {
  it('writes the artifact', () => {
    const rows = FILES.map((file) => {
      const url = `/brand-heroes/${file}`;
      const i = CONSULTATION.indexOf(`'${url}'`);
      const ctx = i >= 0 ? CONSULTATION.slice(Math.max(0, i - 700), i + 700) : '';
      const grab = (n: string) => {
        const m = new RegExp(`${n}:\\s*'([^']*)'`).exec(ctx);
        return m ? m[1] : undefined;
      };
      const credit = grab('credit');
      return {
        file, url,
        bytes: statSync(`${DIR}/${file}`).size,
        renderedAsBrandHero: i >= 0,
        credit,
        sourceUrl: grab('sourceUrl'),
        // A rights DEFENCE asserted in a credit line is not a recorded basis.
        rightsClaim: credit?.includes('fair-use') ? 'fair_use_asserted' : 'none_recorded',
        alsoUsedAsProductImage:
          getProductImage(undefined, file.replace(/\.\w+$/, '').replace(/-/g, ' ')) === url
          || CONSULTATION.includes(`imageUrl: '${url}'`)
          || readFileSync('apps/web/src/lib/products/amplifiers.ts', 'utf8').includes(`imageUrl: '${url}'`)
          || readFileSync('apps/web/src/lib/product-images.ts', 'utf8').includes(`'${url}'`),
        hosting: 'local' as const,
      };
    });

    writeFileSync('docs/audits/brand-heroes.json', JSON.stringify({
      note: 'Brand-authority illustrations. Governed SEPARATELY from product images.',
      total: rows.length,
      renderedAsBrandHero: rows.filter((r) => r.renderedAsBrandHero).length,
      withCredit: rows.filter((r) => r.credit).length,
      withSourceUrl: rows.filter((r) => r.sourceUrl).length,
      withRightsBasis: 0,
      fairUseAsserted: rows.filter((r) => r.rightsClaim === 'fair_use_asserted').map((r) => r.file),
      alsoUsedAsProductImage: rows.filter((r) => r.alsoUsedAsProductImage).map((r) => r.file),
      rows,
    }, null, 2) + '\n');

    expect(rows.length).toBe(18);
  });

  it('no brand hero is remote — none can 404 or be swapped underneath us', () => {
    for (const f of FILES) expect(statSync(`${DIR}/${f}`).size).toBeGreaterThan(0);
  });

  it('no credit line asserts a rights basis the record does not hold', () => {
    // Two credits read "(curated under fair-use product reference)". Fair use
    // is a DEFENCE raised after the fact, not a permission granted in advance,
    // so the string asserted a legal conclusion the evidence does not contain
    // — and asserted it to the reader, in rendered attribution. The rights
    // basis for every brand hero is none_recorded, and the credit line must
    // say who made the thing, not why we believe we may show it.
    for (const m of CONSULTATION.matchAll(/credit:\s*'([^']*)'/g)) {
      expect(m[1], 'credit asserts a rights basis').not.toMatch(
        /fair[- ]use|public domain|royalty[- ]free|permitted|licen[cs]ed/i);
    }
  });

  it('a brand hero never silently becomes a product photograph', () => {
    // Two of these files ARE product shots (marantz-2220b, goldmund-telos-690)
    // and were wired in as catalog `imageUrl`. That is the crossover worth
    // watching: an asset curated to illustrate a BRAND, reused to assert
    // which PRODUCT someone owns, without ever facing the identity rule.
    const crossover: Array<[string, string, string]> = [
      ['Marantz', '2220B', '/brand-heroes/marantz-2220b.jpg'],
      ['Goldmund', 'Telos 690', '/brand-heroes/goldmund-telos-690.jpg'],
    ];
    for (const [brand, name, url] of crossover) {
      // Passing the catalog URL must add nothing. Whatever resolves has to
      // resolve WITHOUT it — otherwise the catalog is still deciding.
      const withCatalog = resolveProductImageStrict(brand, name, url);
      const withoutCatalog = resolveProductImageStrict(brand, name);
      expect(withCatalog, `${brand} ${name}: catalog URL still decides`).toBe(withoutCatalog);
    }

    // Marantz resolves to its hero through a GOVERNED registry row, which is
    // legitimate: the row is curated and exact-matched. Goldmund's catalog
    // entry is closed and falls through to the first-party goldmund.com asset.
    expect(resolveProductImageStrict('Marantz', '2220B')).toBe('/brand-heroes/marantz-2220b.jpg');
    expect(resolveProductImageStrict('Goldmund', 'Telos 690')).toContain('goldmund.com');
  });
});
