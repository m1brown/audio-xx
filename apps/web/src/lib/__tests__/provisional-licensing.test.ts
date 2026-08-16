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
    const p = computeComponentProvenance(NAMES, KNOWN, NAMES, ['Butler Monads']);
    expect(p.find((x) => x.name === 'dCS Bartok')?.basis).toBe('catalog');
    expect(p.find((x) => x.name === 'Butler Monads')?.basis).toBe('model');
  });

  it('characterisation alone cannot reach Expanded Reasoning — corroboration gates it', () => {
    // The model saying it knows a product is not evidence the product exists;
    // a fictional component alternated between unknown and confidently
    // described on identical input. Without independent corroboration the
    // component stays at the listener's own authority no matter how
    // confidently the prose reads.
    const p = computeComponentProvenance(NAMES, KNOWN, NAMES /* no corroboration */);
    expect(p.find((x) => x.name === 'Butler Monads')?.basis).toBe('user');
  });

  it('corroboration without characterisation does not promote either', () => {
    // Existence is not knowledge. A product may be real and still be one the
    // model has nothing useful to say about.
    const p = computeComponentProvenance(NAMES, KNOWN, [], ['Butler Monads']);
    expect(p.find((x) => x.name === 'Butler Monads')?.basis).toBe('user');
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

/**
 * Licensed specifications are PREMISES, not inventions (2026-08-16).
 *
 * The Magnepan LRS catalog entry states "4Ω/86dB". When the provisional model
 * uses those figures to explain why a 5-watt SET is a poor match, it is
 * reasoning with evidence Audio XX independently holds — and that sentence is
 * the most valuable one in the assessment, because it is where the real
 * mismatch gets named.
 *
 * The validator previously rejected it: the numbers appeared in generated
 * prose, the sentence didn't happen to name "Magnepan", so it read as a
 * fabricated specification and collapsed the whole answer into the fallback.
 *
 * The distinction is asserting an unsupported spec vs. reasoning with a
 * supported one — established by an explicit licensed-fact set, never by a
 * regex exception for particular figures.
 */
import { collectLicensedFacts } from '../llm-system-inference';

describe('licensed specifications may be used as premises', () => {
  const CURATED = [
    'Entry-level planar magnetic from Magnepan. Limited bass extension, and the '
    + '4Ω/86dB load demands a current-capable amplifier.',
  ];
  const facts = collectLicensedFacts(CURATED);
  const NAMES = ['Magnepan LRS'];
  const UNRESOLVED = ['Zorblax ZX1 5 watt SET'];

  it('collects the figures our own evidence contains', () => {
    expect(facts).toEqual(expect.arrayContaining(['4ω', '86db']));
  });

  it('permits the mismatch argument that cites them', () => {
    const prose =
      'A 5-watt SET will struggle into an 86dB, 4Ω load, so the amplifier is the '
      + 'limiting component here.';
    expect(findLicensingViolations(prose, UNRESOLVED, NAMES, facts)).toEqual([]);
  });

  it('still refuses a specification we do not hold', () => {
    const prose = 'The amplifier delivers 250 watts into 8 ohms.';
    expect(findLicensingViolations(prose, UNRESOLVED, NAMES, facts).length).toBeGreaterThan(0);
  });

  it('a figure inside the listener’s own component name is not a claim', () => {
    const prose = 'The Zorblax ZX1 5 watt SET sits in the amplification position.';
    expect(findLicensingViolations(prose, UNRESOLVED, NAMES, facts)).toEqual([]);
  });

  it('no curated evidence means no licensed premises', () => {
    const prose = 'A 5-watt SET will struggle into an 86dB, 4Ω load.';
    expect(findLicensingViolations(prose, UNRESOLVED, [], []).length).toBeGreaterThan(0);
  });
});

describe('figures the listener supplied are premises too', () => {
  // Production diagnostic (2026-08-16): the model paraphrased the component
  // name — "the Zorblax ZX1 ... providing 5 watts" — so masking the literal
  // string missed it and the listener's own figure read as an invented spec.
  const NAMES = ['Magnepan LRS'];
  const UNRESOLVED = ['Zorblax ZX1 5 watt SET'];
  const facts = collectLicensedFacts([
    'the 4Ω/86dB load demands a current-capable amplifier',
    'Zorblax ZX1 5 watt SET',
  ]);

  it('permits the paraphrased form that production actually produced', () => {
    const prose =
      'The amplifier, Zorblax ZX1, as a single-ended triode design providing 5 watts, '
      + 'is unlikely to control an 86dB, 4Ω planar load.';
    expect(findLicensingViolations(prose, UNRESOLVED, NAMES, facts)).toEqual([]);
  });

  it('a figure the listener never supplied is still refused', () => {
    const prose = 'The Zorblax ZX1 offers 0.02% distortion at 120 watts.';
    expect(findLicensingViolations(prose, UNRESOLVED, NAMES, facts).length).toBeGreaterThan(0);
  });
});
