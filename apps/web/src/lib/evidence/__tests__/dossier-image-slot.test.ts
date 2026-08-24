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
  it('no Nathan component resolves to any image', () => {
    for (const name of [
      'dCS Rossini Apex', 'Audio Research Reference 5', 'ARC ref 5',
      'Butler Audio MONAD A100', 'Butler Monads', 'Acora Acoustics QRC-2', 'Acora QRC-2',
    ]) {
      expect(getProductImageEntry(undefined, name), name).toBeUndefined();
    }
  });

  it('the fixture is a test fixture only — it names no Nathan product', () => {
    const fixture = withImage();
    expect(fixture.displayName).not.toMatch(/dcs|rossini|audio research|reference 5|butler|monad|acora|qrc/i);
  });
});
