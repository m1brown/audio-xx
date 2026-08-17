import { describe, it, expect } from 'vitest';
import { computeComponentProvenance } from '../llm-system-inference';
import { tierFor } from '../entity-corroboration';

/**
 * GOVERNING INVARIANT (founder, 2026-08-17):
 *
 *   Evidence determines prose authority; prose never determines evidence.
 *
 * `computeComponentProvenance` used to require BOTH corroboration AND a
 * mention of the component in the generated prose before granting `model`.
 * The result was that identical evidence produced different labels depending
 * on what the model chose to write about — including telling a listener that
 * their independently corroborated Acora QRC-2 was "your description only".
 *
 * The signature no longer accepts prose at all, which is the strongest
 * available form of the guarantee: there is nothing to pass.
 */

const BETA = ['dCS Rossini Apex', 'ARC ref 5', 'Butler Monads', 'Acora QRC-2'];
const DCS_BRAND = [{ name: 'dCS Rossini Apex', source: 'brand' as const }];
const ALL_CORROBORATED = ['ARC ref 5', 'Butler Monads', 'Acora QRC-2'];

const basisOf = (p: Array<{ name: string; basis: string }>) =>
  Object.fromEntries(p.map((e) => [e.name, e.basis]));

describe('the beta system resolves identically every time', () => {
  const expected = {
    'dCS Rossini Apex': 'brand',
    'ARC ref 5': 'model',
    'Butler Monads': 'model',
    'Acora QRC-2': 'model',
  };

  it('gives each component the basis its evidence supports', () => {
    expect(basisOf(computeComponentProvenance(BETA, DCS_BRAND, ALL_CORROBORATED)))
      .toEqual(expected);
  });

  it('is byte-identical across repeated calls', () => {
    // The production failure was three identical runs producing three
    // different answers. Determinism is the fix, so it is asserted directly.
    const runs = Array.from({ length: 25 }, () =>
      JSON.stringify(computeComponentProvenance(BETA, DCS_BRAND, ALL_CORROBORATED)));
    expect(new Set(runs).size).toBe(1);
  });

  it('is unaffected by component ORDER', () => {
    const reversed = computeComponentProvenance([...BETA].reverse(), DCS_BRAND, ALL_CORROBORATED);
    expect(basisOf(reversed)).toEqual(expected);
  });
});

describe('prose cannot reach provenance', () => {
  it('takes no prose argument at all', () => {
    // (names, knownDescriptions, corroborated) — three parameters, none of
    // them generated text. A regression would have to change this signature.
    expect(computeComponentProvenance.length).toBe(3);
  });

  it('grants model basis to a corroborated component the prose never mentions', () => {
    // The exact production defect: the Acora corroborated, the model wrote no
    // sentence about it, and the card read "your description only".
    const p = basisOf(computeComponentProvenance(BETA, DCS_BRAND, ALL_CORROBORATED));
    expect(p['Acora QRC-2']).toBe('model');
  });

  it('does NOT grant model basis to an uncorroborated component', () => {
    // Decoupling from prose must not weaken the gate itself. A fictional
    // product stays at user tier however confidently it might be described.
    const withFiction = [...BETA, 'Zorblax ZX1 5 watt SET'];
    const p = basisOf(computeComponentProvenance(withFiction, DCS_BRAND, ALL_CORROBORATED));
    expect(p['Zorblax ZX1 5 watt SET']).toBe('user');
  });

  it('keeps curated evidence above corroboration', () => {
    const catalogued = [{ name: 'ARC ref 5', source: 'product' as const }];
    const p = basisOf(computeComponentProvenance(BETA, catalogued, ALL_CORROBORATED));
    expect(p['ARC ref 5']).toBe('catalog');
  });
});

describe('the rendered path agrees with the computed path', () => {
  it('tierFor and computeComponentProvenance return the same basis', () => {
    // page.tsx renders via tierFor. Two derivations of one fact must not be
    // able to disagree — a label and a paragraph that contradict each other
    // are worse than either alone.
    const computed = basisOf(computeComponentProvenance(BETA, DCS_BRAND, ALL_CORROBORATED));
    for (const name of BETA) {
      const rendered = tierFor(
        false,
        name === 'dCS Rossini Apex',
        ALL_CORROBORATED.includes(name) ? 'corroborated' : 'uncorroborated',
      );
      expect(rendered).toBe(computed[name]);
    }
  });

  it('treats lookup_unknown as user basis, never as corroborated', () => {
    expect(tierFor(false, false, 'lookup_unknown')).toBe('user');
    expect(tierFor(false, false, undefined)).toBe('user');
  });

  it('lets curated evidence survive a failed lookup', () => {
    // A lookup failure says nothing about a product we already hold data for.
    expect(tierFor(true, false, 'lookup_unknown')).toBe('catalog');
    expect(tierFor(false, true, 'lookup_unknown')).toBe('brand');
  });
});
