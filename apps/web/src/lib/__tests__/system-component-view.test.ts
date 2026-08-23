import { describe, it, expect } from 'vitest';
import { buildComponentViews, roleLabel } from '../system-component-view';

/**
 * GOVERNING INVARIANT: a system is a collection of component identities. No
 * downstream surface may collapse them into a synthetic product.
 *
 * Production defect (2026-08-16): `subject: componentNames.join(', ')` became
 * the identity consumed by image lookup, HiFiShark, eBay and the Subject Card,
 * producing a search for a four-headed product that does not exist and a
 * system-wide generic placeholder.
 */
const BETA = [
  { displayName: 'dCS Rossini Apex', role: 'dac' },
  { displayName: 'ARC ref 5', role: 'preamplifier' },
  { displayName: 'Butler Monads', role: 'amplifier' },
  { displayName: 'Acora QRC-2', role: 'speaker' },
];

describe('components never collapse into a synthetic product', () => {
  const views = buildComponentViews(BETA, [
    { name: 'dCS Rossini Apex', basis: 'brand' },
    { name: 'ARC ref 5', basis: 'user' },
    { name: 'Butler Monads', basis: 'user' },
    { name: 'Acora QRC-2', basis: 'user' },
  ]);

  it('produces one presentation per graph node', () => {
    expect(views).toHaveLength(4);
    expect(new Set(views.map((v) => v.displayName)).size).toBe(4);
  });

  it('no identity is a concatenation of several components', () => {
    for (const v of views) {
      expect(v.displayName).not.toMatch(/\+|,\s*\w+\s+\w+\s*,/);
      // A name carrying two known component names is the defect itself.
      const hits = BETA.filter((c) => v.displayName.includes(c.displayName));
      expect(hits.length).toBeLessThanOrEqual(1);
    }
  });

  it('each component gets its OWN HiFiShark and eBay search', () => {
    const sharks = views.map((v) => v.hifiSharkUrl).filter(Boolean);
    const ebays = views.map((v) => v.ebayUrl).filter(Boolean);
    expect(sharks).toHaveLength(4);
    expect(ebays).toHaveLength(4);
    expect(new Set(sharks).size).toBe(4);
    expect(new Set(ebays).size).toBe(4);
  });

  it('no marketplace query contains more than one component', () => {
    for (const v of views) {
      const q = decodeURIComponent(`${v.hifiSharkUrl ?? ''} ${v.ebayUrl ?? ''}`).toLowerCase();
      const named = BETA.filter((c) => q.includes(c.displayName.toLowerCase()));
      expect(named.length).toBeLessThanOrEqual(1);
    }
  });

  it('provenance attaches to the component it qualifies', () => {
    expect(views.find((v) => v.listenerName === 'dCS Rossini Apex')?.basis).toBe('brand');
    expect(views.find((v) => v.listenerName === 'Acora QRC-2')?.basis).toBe('user');
  });

  it('an unknown component defaults to the lowest tier, never higher', () => {
    const [only] = buildComponentViews([{ displayName: 'Qwibble Q1', role: 'dac' }], []);
    expect(only.basis).toBe('user');
  });
});

describe('failure degrades per component, never per system', () => {
  it('one component without an image does not suppress another that has one', () => {
    const views = buildComponentViews(
      [
        // First-party host for its brand, so the asset is admissible and this
        // test keeps testing what it means to: per-component independence.
        // It previously used `https://cdn/x.jpg`, which is first-party to
        // nothing and is now withheld — a catalog URL no longer wins outright.
        { displayName: 'Has Image', role: 'dac', product: { brand: 'Acme', name: 'Y', imageUrl: 'https://acme.com/y.jpg' } },
        { displayName: 'Acora QRC-2', role: 'speaker' },
      ],
      [],
    );
    expect(views[0].imageUrl).toBe('https://acme.com/y.jpg');
    expect(views[1].imageUrl).toBeUndefined();
    // Crucially, the first survives the second's absence.
    expect(views).toHaveLength(2);
  });

  it('a missing image is undefined — never a shared placeholder', () => {
    const [v] = buildComponentViews([{ displayName: 'Acora QRC-2', role: 'speaker' }], []);
    expect(v.imageUrl).toBeUndefined();
  });
});

describe('canonical identity is used where corroboration established one', () => {
  it('display and marketplace queries prefer the manufacturer designation', () => {
    const [v] = buildComponentViews(
      [{ displayName: 'ARC ref 5', role: 'preamplifier', canonicalName: 'Audio Research Reference 5' }],
      [{ name: 'ARC ref 5', basis: 'model' }],
    );
    expect(v.displayName).toBe('Audio Research Reference 5');
    expect(v.listenerName).toBe('ARC ref 5');   // nothing the listener typed is lost
    expect(decodeURIComponent(v.hifiSharkUrl ?? '')).toMatch(/Audio Research Reference 5/i);
    expect(v.basis).toBe('model');
  });
});

describe('a multi-role component states both roles', () => {
  it('keeps what the listener described', () => {
    expect(roleLabel('dac', ['dac', 'streamer'])).toBe('DAC / Streamer');
    expect(roleLabel('speaker')).toBe('Loudspeaker');
    expect(roleLabel('amplifier')).toBe('Power amplifier');
  });
});
