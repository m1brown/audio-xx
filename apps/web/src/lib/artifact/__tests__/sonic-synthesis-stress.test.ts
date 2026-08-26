import { describe, it, expect } from 'vitest';
import { synthesiseChain, resolveObservationKey } from '../sonic-synthesis';
import { seedObservations } from '@/lib/evidence/independent-review-seed';
import { synthesise } from '@/lib/evidence/relational-synthesis';
import type { ReviewObservation } from '@/lib/evidence/independent-review';
import type { CharacterProposition } from '@/lib/evidence/component-character';

/**
 * STRESS TEST ACROSS REFERENCE SYSTEMS.
 *
 * The failure this guards against is a Nathan sentence library: an
 * architecture tuned until one system reads well, which then says
 * approximately the same thing about every other system. Each case below is
 * chosen because a DIFFERENT part of the licensing chain has to fire, and the
 * assertions are about what must NOT appear as much as what must.
 */

const admitted = seedObservations().admitted;

const NATHAN = [
  { displayName: 'dCS Rossini Apex', role: 'dac' },
  { displayName: 'ARC ref 5', role: 'preamplifier' },
  { displayName: 'Butler Monads', role: 'amplifier' },
  { displayName: 'Acora QRC-2', role: 'speaker' },
];

const prop = (
  dimension: CharacterProposition['dimension'],
  direction: string,
  confidence: CharacterProposition['confidence'] = 'moderate',
): CharacterProposition => ({
  productKey: 'k', productName: 'n', dimension, direction, statement: '',
  basis: 'direct_observation', confidence, support: [{} as ReviewObservation],
  publications: ['Stereophile'], conditions: [],
});

describe('NATHAN — the well-evidenced case', () => {
  const s = synthesiseChain(NATHAN, admitted);

  it('establishes relations the other systems do not', () => {
    const established = s.relations.filter((r) => r.kind === 'reinforcing' || r.kind === 'complementary');
    expect(established.length).toBeGreaterThan(0);
  });

  it('now characterises every component in the chain', () => {
    /*
     * Nathan was the system with a hole in the middle. A second acquisition
     * pass and one governed identity decision closed it: The Audio Beatnik
     * covers the A100, and the sole-model plural alias connects it to the
     * name this listener actually writes.
     */
    expect(s.uncharacterised).toEqual([]);
  });

  it('but the Butler’s character stays conditional on its fitted tube', () => {
    const butler = s.character.get('Butler Monads') ?? [];
    expect(butler.length).toBeGreaterThan(0);
    for (const p of butler) {
      expect(p.basis, p.dimension).toBe('conditional');
      expect(p.confidence).toBe('low');
    }
  });

  it('walks the chain in signal order, not input order', () => {
    // The regression: "preamplifier" did not match "preamp", so the ARC sorted
    // behind the loudspeaker and the review paired the speaker with the
    // preamplifier feeding it.
    const pairs = s.relations.map((r) => `${r.upstreamName}->${r.downstreamName}`);
    expect(pairs).toContain('dCS Rossini Apex->ARC ref 5');
    expect(pairs.some((p) => p.startsWith('Acora QRC-2->'))).toBe(false);
  });
});

describe('FRANCE — difference is not balance', () => {
  it('opposed characters on thin evidence stay "difference", not synergy', () => {
    const r = synthesise(
      { name: 'A', propositions: [prop('warmth', 'warm', 'low')] },
      { name: 'B', propositions: [prop('warmth', 'cool')] },
      'warmth',
    );
    expect(r.kind).toBe('neutral_coexistence');
    expect(r.statement).toMatch(/complementarity is not/);
    expect(r.statement).not.toMatch(/balance each other|counterweight|synergy/i);
  });
});

describe('FLAWED REFERENCE — reviews never soften an engineering constraint', () => {
  it('the scope note is a fixed string the sonic layer cannot weaken', async () => {
    const { ELECTRICAL_SCOPE_NOTE } = await import('@/lib/evidence/relational-synthesis');
    expect(ELECTRICAL_SCOPE_NOTE).toMatch(/what the system can do, not how it sounds/);
    expect(ELECTRICAL_SCOPE_NOTE).toMatch(/Nothing in the power and impedance evidence/);
  });

  it('no sonic relation carries an electrical verdict', () => {
    for (const r of synthesiseChain(NATHAN, admitted).relations) {
      expect(r.statement).not.toMatch(/\b(watts?|ohms?|impedance|sensitivity|dB)\b/i);
    }
  });
});

describe('TWO DACS — no interface is manufactured where none exists', () => {
  const twoDacs = [
    { displayName: 'dCS Rossini Apex', role: 'dac' },
    { displayName: 'Some Other DAC', role: 'dac' },
    { displayName: 'Acora QRC-2', role: 'speaker' },
  ];

  it('produces no established relation between two sources', () => {
    const s = synthesiseChain(twoDacs, admitted);
    const between = s.relations.filter(
      (r) => r.upstreamName === 'dCS Rossini Apex' && r.downstreamName === 'Some Other DAC',
    );
    expect(between.every((r) => r.kind === 'not_established')).toBe(true);
  });
});

describe('PREAMP + INTEGRATED — the topology the listener stated is preserved', () => {
  it('does not silently reorder an integrated ahead of the preamplifier', () => {
    const s = synthesiseChain([
      { displayName: 'ARC ref 5', role: 'preamplifier' },
      { displayName: 'Some Integrated', role: 'integrated' },
      { displayName: 'Acora QRC-2', role: 'speaker' },
    ], admitted);
    const pairs = s.relations.map((r) => `${r.upstreamName}->${r.downstreamName}`);
    expect(pairs.some((p) => p.startsWith('ARC ref 5->Some Integrated'))).toBe(true);
    expect(pairs.some((p) => p.startsWith('Some Integrated->ARC ref 5'))).toBe(false);
  });
});

describe('LISTENER-ONLY / UNCATALOGUED — sparse evidence produces limits, not prose', () => {
  const unknown = [
    { displayName: 'Some Unknown Streamer', role: 'streamer' },
    { displayName: 'Another Unknown Amp', role: 'amplifier' },
    { displayName: 'Unknown Speakers', role: 'speaker' },
  ];

  it('produces no character at all', () => {
    const s = synthesiseChain(unknown, admitted);
    expect([...s.character.values()].flat()).toEqual([]);
    expect(s.uncharacterised).toHaveLength(3);
  });

  it('and no relation whatsoever — silence, not filler', () => {
    // Every dimension is unknown on BOTH sides, so there is not even a
    // "not established" to report: nothing about this system was ever in
    // question. Emitting one line per dimension per pair would be filler
    // wearing the costume of rigour.
    expect(synthesiseChain(unknown, admitted).relations).toEqual([]);
  });
});

describe('the exact-variant rule survives every entry point', () => {
  it('an SE variant never inherits the base model’s evidence', () => {
    expect(resolveObservationKey('Audio Research Reference 5 SE', admitted)).toBeUndefined();
    expect(resolveObservationKey('ARC Ref 5 SE', admitted)).toBeUndefined();
  });

  it('a predecessor never inherits its successor’s evidence', () => {
    expect(resolveObservationKey('dCS Rossini', admitted)).toBeUndefined();
    expect(resolveObservationKey('Audio Research Reference 3', admitted)).toBeUndefined();
  });

  it('an Acora sibling never inherits the QRC-2’s evidence', () => {
    for (const n of ['Acora QRC-1', 'Acora SRC-2', 'Acora MRC-2', 'Acora VRC']) {
      expect(resolveObservationKey(n, admitted), n).toBeUndefined();
    }
  });

  it('but the listener’s own shorthand for the exact unit does resolve', () => {
    expect(resolveObservationKey('ARC ref 5', admitted)).toBe('audio research reference 5');
    expect(resolveObservationKey('Acora QRC-2', admitted)).toBe('acora qrc-2');
    expect(resolveObservationKey('dCS Rossini Apex', admitted)).toBe('dcs rossini apex');
  });

  it('a bare brand resolves to nothing', () => {
    for (const n of ['Acora', 'dCS', 'Audio Research', 'ARC']) {
      expect(resolveObservationKey(n, admitted), n).toBeUndefined();
    }
  });
});

describe('systems produce materially different assessments', () => {
  it('Nathan and the unknown system share no relation text', () => {
    const nathan = synthesiseChain(NATHAN, admitted).relations.map((r) => r.statement);
    const unknown = synthesiseChain([
      { displayName: 'Unknown A', role: 'dac' },
      { displayName: 'Unknown B', role: 'speaker' },
    ], admitted).relations.map((r) => r.statement);
    expect(nathan.filter((s) => unknown.includes(s))).toEqual([]);
  });

  it('a system missing its speaker reasons differently from one missing its source', () => {
    const noSpeaker = synthesiseChain([
      { displayName: 'dCS Rossini Apex', role: 'dac' },
      { displayName: 'ARC ref 5', role: 'preamplifier' },
    ], admitted);
    const noSource = synthesiseChain([
      { displayName: 'ARC ref 5', role: 'preamplifier' },
      { displayName: 'Acora QRC-2', role: 'speaker' },
    ], admitted);
    expect(noSpeaker.relations.map((r) => r.statement))
      .not.toEqual(noSource.relations.map((r) => r.statement));
  });
});
