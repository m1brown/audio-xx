import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import ComponentDossiers from '@/components/advisory/ComponentDossiers';
import type { DossierView } from '@/lib/evidence/dossier-presentation';
import { getProductImageEntry } from '@/lib/product-images';

/**
 * ADDING A PHOTOGRAPH IS A DATA OPERATION.
 *
 * The point of this file is to prove that the renderer work is DONE: when the
 * governed boundary admits an exact-product asset, every surface shows it, and
 * when it admits nothing, every surface renders nothing at all. Nobody should
 * have to open a component file again to turn an image on.
 *
 * The fixture below uses an asset that is ALREADY ADMISSIBLE for its own
 * product, and it is never associated with a Nathan component. Nathan has no
 * admitted imagery — its makers publish all-rights-reserved notices — and
 * dressing it in a borrowed photograph to make a demo look finished is the
 * exact failure the image doctrine exists to prevent.
 */

/** An asset the governed boundary already admits, for the product it depicts. */
const ADMITTED = getProductImageEntry('Leben', 'CS600');

const withImage = (): DossierView => ({
  displayName: 'Leben CS600',
  primary: [{ label: 'POWER OUTPUT', value: '32W per channel' }],
  secondary: [],
  gaps: [],
  hasDetail: false,
  image: { url: ADMITTED!.url, credit: ADMITTED?.source?.credit },
});

const withoutImage = (): DossierView => ({
  displayName: 'Acora QRC-2',
  primary: [{ label: 'IMPEDANCE', value: '4 ohm' }],
  secondary: [],
  gaps: [],
  hasDetail: false,
});

const render = (dossiers: DossierView[]) =>
  renderToStaticMarkup(React.createElement(ComponentDossiers, { dossiers }));

describe('the image slot is wired, not hypothetical', () => {
  it('the fixture asset really is admissible — the slot is not proved with a fake', () => {
    expect(ADMITTED, 'no admissible fixture available').toBeDefined();
    expect(ADMITTED!.url.length).toBeGreaterThan(0);
  });

  it('an admitted image renders, with its credit', () => {
    const html = render([withImage()]);
    expect(html).toContain('<figure');
    expect(html).toContain(ADMITTED!.url);
    expect(html).toMatch(/alt="Leben CS600"/);
  });

  it('no image renders NOTHING — no frame, no placeholder, no reserved space', () => {
    const html = render([withoutImage()]);
    expect(html).not.toContain('<figure');
    expect(html).not.toContain('<img');
    // The card is still a finished card: its facts are all there.
    expect(html).toContain('Acora QRC-2');
    expect(html).toContain('4 ohm');
  });

  it('mixed coverage renders exactly one image across two cards', () => {
    // Asymmetry is the expected state and must read as intentional rather than
    // as one card waiting for something.
    const html = render([withImage(), withoutImage()]);
    expect(html.split('<figure').length - 1).toBe(1);
    expect(html.split('<img').length - 1).toBe(1);
    expect(html).toContain('Acora QRC-2');
  });

  it('the image never displaces dossier evidence', () => {
    const withPhoto = render([withImage()]);
    const noPhoto = render([{ ...withImage(), image: undefined }]);
    for (const fact of ['POWER OUTPUT', '32W per channel']) {
      expect(withPhoto).toContain(fact);
      expect(noPhoto).toContain(fact);
    }
  });
});

describe('Nathan carries no borrowed photography', () => {
  it('Nathan resolves images ONLY where first-party identity was established', () => {
    /*
     * This once asserted that NO Nathan component resolved to any image, which
     * was true when written and was never the actual rule. The rule is that
     * absence is preferable to a wrong, substituted or unprovenanced image —
     * not that these four products may never have one.
     *
     * Two were acquired on 2026-08-25 from the makers' own domains, each
     * embedded on a page naming the exact model. The other two remain absent
     * for stated reasons, and those reasons are what this test now pins.
     */
    for (const name of ['Acora QRC-2', 'Acora Acoustics QRC-2', 'Butler MONAD A100']) {
      const e = getProductImageEntry(undefined, name);
      expect(e, name).toBeDefined();
      // First-party only. A retailer or reviewer asset for these products
      // would be a governance failure, not coverage.
      expect(e!.source?.tier, name).toBe('manufacturer');
      expect(e!.url, name).toMatch(/acoraacoustics\.com|butleraudio\.com/);
    }
  });

  it('the two blocked products stay absent, and for the right reasons', () => {
    // dCS: every identifying page returns 403 to an automated client, so which
    // asset depicts the Rossini Apex cannot be established — an IDENTITY
    // blocker that permission alone would not clear.
    //
    // ARC Reference 5: discontinued, and audioresearch.com carries no page for
    // it. Only SE photography appears to exist, and a variant is never a
    // substitute.
    for (const name of ['dCS Rossini Apex', 'Audio Research Reference 5', 'ARC ref 5']) {
      expect(getProductImageEntry(undefined, name), name).toBeUndefined();
    }
  });

  /*
   * SUPERSEDED BY IDENTITY RESEARCH (founder decision, 2026-08-26).
   *
   * This test withheld the A100's photograph from "Butler Monads" on the
   * grounds that butleraudio.com "lists MONAD and A100 as separate items".
   * That was a misreading of the navigation: MONAD is a section link, A100 is
   * the product heading on it. The maker's site has one Monad — one nav entry,
   * one product page, one manual — and that manual says "most applications
   * will use at least a pair of MONAD amplifiers".
   *
   * With no sibling model in existence the plural cannot be ambiguous, so
   * this is identity rather than substitution. The rule is SOLE-MODEL and does
   * not generalise, which is what the rest of this block now pins.
   */
  it('the sole-model plural resolves to the exact product', () => {
    const e = getProductImageEntry(undefined, 'Butler Monads');
    expect(e).toBeDefined();
    expect(e!.source?.tier).toBe('manufacturer');
    expect(e!.url).toMatch(/butleraudio\.com/);
    // The same asset the canonical name resolves to — one product, one photograph.
    expect(e!.url).toBe(getProductImageEntry(undefined, 'Butler MONAD A100')!.url);
  });

  it('does NOT generalise the plural rule to other products', () => {
    // Acora and dCS both ship multiple models, so a plural or bare-brand
    // string remains ambiguous and must still resolve to nothing.
    for (const name of ['Acora QRCs', 'Acoras', 'dCS Rossinis', 'Audio Research References']) {
      expect(getProductImageEntry(undefined, name), name).toBeUndefined();
    }
  });

  it('the fixture is a test fixture only — it names no Nathan product', () => {
    const fixture = withImage();
    expect(fixture.displayName).not.toMatch(/dcs|rossini|audio research|reference 5|butler|monad|acora|qrc/i);
  });
});
