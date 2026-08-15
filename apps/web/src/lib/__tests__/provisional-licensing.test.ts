import { describe, it, expect } from 'vitest';
import {
  findLicensingViolations,
  computeComponentProvenance,
} from '../llm-system-inference';

/**
 * Evidence tiers in the provisional layer — RESTORED (2026-08-15).
 *
 * Audio XX has always had four provenance sources and three reasoning modes
 * (`AdvisorySource`, `ReasoningMode` in advisory-response.ts). Expanded
 * Reasoning exists precisely so model knowledge can be used at lower
 * authority. D-7 says no claim may be stronger than its source — it does NOT
 * say a component must be in the catalog before Audio XX may speak.
 *
 * Earlier the same day, an over-correction banned characteristics outright for
 * uncatalogued components. That collapsed "model knowledge" into "unknown" and
 * made the advisor mute on most real systems — including the first real beta
 * system, where the listener got a page of "I cannot assess this" for four
 * components a knowledgeable person could discuss usefully.
 *
 * These tests pin the restored boundary: characterisation is permitted at any
 * tier; what is never permitted is a claim BORROWING AUTHORITY IT DOES NOT
 * HAVE — a measurement, a price, a compatibility guarantee, or a cited source.
 */
describe('model knowledge is a legitimate source, not a prohibited one', () => {
  const ALLOWED = [
    'The Butler Monads use a hybrid tube and MOSFET output stage.',
    'The Acora QRC-2 uses a rigid stone enclosure, which points toward low cabinet contribution.',
    'The ARC Reference 5 is a tube line stage and should add dimensionality without softening the chain.',
    'This system should lean toward resolution and dynamic authority rather than warmth.',
  ];
  for (const prose of ALLOWED) {
    it(`permits: "${prose.slice(0, 52)}…"`, () => {
      expect(findLicensingViolations(prose)).toEqual([]);
    });
  }
});

describe('claims that borrow authority they do not have are still refused', () => {
  const CASES: Array<[string, string]> = [
    ['fabricated attribution', 'Community consensus suggests the Butler Monads are strong performers.'],
    ['reviewer attribution', 'Reviewers report that the Acora QRC-2 is exceptionally resolving.'],
    ['publication attribution', 'Stereophile measured the Rossini as class-leading.'],
    ['specification', 'The Butler Monads deliver 250 watts into 8 ohms.'],
    ['measurement', 'It reaches 20 Hz with only 0.5 db of rolloff.'],
    ['price', 'The Acora QRC-2 retails for $38,000.'],
    ['compatibility guarantee', 'The Butler Monads will drive the Acora QRC-2 without difficulty.'],
    ['perfect-match claim', 'The ARC Ref 5 is an ideal match for the Rossini.'],
  ];
  for (const [label, prose] of CASES) {
    it(`refuses ${label}`, () => {
      expect(findLicensingViolations(prose).length).toBeGreaterThan(0);
    });
  }

  it('a disclaimer is not a violation', () => {
    expect(findLicensingViolations(
      'I have no measurements for the Butler Monads and cannot confirm its power output.',
    )).toEqual([]);
  });
});

describe('provenance is computed by Audio XX, never claimed by the model', () => {
  const NAMES = ['dCS Bartok', 'ARC ref 5', 'Butler Monads', 'Acora QRC-2'];
  const KNOWN = [{ name: 'dCS Bartok', source: 'product' as const }];

  it('curated components are marked from what we hold, not what the model says', () => {
    // The model claims it characterised everything, including the catalogued
    // part. It still cannot promote ITSELF to catalog authority.
    const p = computeComponentProvenance(NAMES, KNOWN, NAMES);
    expect(p.find((x) => x.name === 'dCS Bartok')?.basis).toBe('catalog');
    expect(p.find((x) => x.name === 'Butler Monads')?.basis).toBe('model');
  });

  it('a component the model could not speak to stays user-supplied only', () => {
    const p = computeComponentProvenance(NAMES, KNOWN, ['ARC ref 5', 'Acora QRC-2']);
    expect(p.find((x) => x.name === 'Butler Monads')?.basis).toBe('user');
  });

  it('brand-level curated evidence is distinguishable from product-level', () => {
    const p = computeComponentProvenance(
      ['dCS Rossini Apex'],
      [{ name: 'dCS Rossini Apex', source: 'brand' }],
      [],
    );
    expect(p[0].basis).toBe('brand');
  });

  it('every component receives exactly one basis', () => {
    const p = computeComponentProvenance(NAMES, KNOWN, ['ARC ref 5']);
    expect(p).toHaveLength(NAMES.length);
    for (const entry of p) {
      expect(['catalog', 'brand', 'model', 'user']).toContain(entry.basis);
    }
  });
});
