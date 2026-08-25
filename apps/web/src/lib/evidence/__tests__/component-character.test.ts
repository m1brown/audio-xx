import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  deriveCharacter, dimensionsOf, describesTransition, CHARACTER_DIMENSIONS,
} from '../component-character';
import { seedObservations, seedObservationsFor } from '../independent-review-seed';
import { synthesise, revealingDownstream } from '../relational-synthesis';
import type { ReviewObservation } from '../independent-review';

const obs = (o: Partial<ReviewObservation>): ReviewObservation => ({
  productKey: 'p', productName: 'P', publication: 'Stereophile',
  sourceUrl: 'https://www.stereophile.com/x', observationType: 'listening',
  claim: '', retrievedAt: 0, ...o,
});

const character = (key: string, name: string) =>
  deriveCharacter(key, name, seedObservations().admitted);

describe('the character layer may not become the axis system again', () => {
  it('imports no catalog, product or axis data', () => {
    const src = readFileSync(
      join(__dirname, '..', 'component-character.ts'), 'utf8',
    );
    const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    // Its only dependency is the shape of the evidence it summarises.
    expect(imports).toEqual(['./independent-review']);
  });

  it('produces nothing at all without observations', () => {
    const r = deriveCharacter('unknown', 'Unknown Thing', []);
    expect(r.propositions).toEqual([]);
    expect(r.gap?.reason).toBe('no_admitted_observations');
  });

  it('every proposition names the observations that license it', () => {
    for (const key of ['dcs rossini apex', 'audio research reference 5', 'acora qrc-2']) {
      for (const p of character(key, 'X').propositions) {
        expect(p.support.length, `${key}/${p.dimension}`).toBeGreaterThan(0);
        expect(p.publications.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('negation — the claim-inverting defect', () => {
  /*
   * The Absolute Sound described the Reference 5 as balanced "without the
   * sweetness, darkness or syrupiness some listeners expect from tube
   * equipment". Three warmth words, all negated. A plain vocabulary match read
   * that as a warm preamplifier — the exact misreading this evidence exists to
   * refute, asserted in Audio XX's own voice.
   */
  it('does not read negated vocabulary as a claim', () => {
    const r = deriveCharacter('p', 'P', [obs({
      claim: 'Balanced without the sweetness, darkness or syrupiness some listeners '
        + 'expect from tube equipment, in a presentation characterised as neutral.',
    })]);
    expect(r.propositions.find((p) => p.dimension === 'warmth')).toBeUndefined();
  });

  it('still reads the positive claim in the same sentence', () => {
    const r = deriveCharacter('p', 'P', [obs({
      claim: 'Balanced without the sweetness, darkness or syrupiness some listeners '
        + 'expect from tube equipment, in a presentation characterised as neutral.',
    })]);
    expect(r.propositions.find((p) => p.dimension === 'neutrality')?.direction).toBe('neutral');
  });

  it('negation reaches across a list but stops at a new clause', () => {
    // "not" governs the speed claim; "though" opens a clause it does not reach.
    const r = deriveCharacter('p', 'P', [obs({
      observationType: 'comparison',
      claim: 'Did not equal the best solid-state preamplifiers in transient speed or '
        + 'bottom-end grip, though it came closer than the Reference 3.',
    })]);
    expect(r.propositions.find((p) => p.dimension === 'transient')).toBeUndefined();
  });

  it('the real Reference 5 evidence yields no warmth claim', () => {
    const r = character('audio research reference 5', 'Audio Research Reference 5');
    expect(r.propositions.map((p) => p.dimension)).not.toContain('warmth');
  });
});

describe('transitions describe a change, not a state', () => {
  it('recognises a break-in transition', () => {
    expect(describesTransition(
      'Sounded darker when new, the darkness giving way to light and air once run in.',
    )).toBe(true);
  });

  it('draws no direction from one', () => {
    /*
     * Collapsing this to a single direction produced "warm, though only after
     * several hundred hours" — asserting warmth on the far side of a
     * transition where the reviewer heard the opposite.
     */
    const r = deriveCharacter('p', 'P', [obs({
      claim: 'Sounded darker in balance and relatively airless when new, the darkness '
        + 'giving way to light, air and bloom once run in.',
      condition: { kind: 'break_in', description: 'after several hundred hours' },
    })]);
    expect(r.propositions).toEqual([]);
  });
});

describe('comparative evidence stays comparative', () => {
  it('a comparison never becomes an absolute claim', () => {
    const r = character('dcs rossini apex', 'dCS Rossini Apex');
    const resolution = r.propositions.find((p) => p.dimension === 'resolution');
    expect(resolution?.basis).toBe('comparative_only');
    expect(resolution?.comparedWith).toBeTruthy();
    expect(resolution?.statement).toMatch(/relative to/i);
    expect(resolution?.statement).toMatch(/absolute terms was not established/i);
  });

  it('the anchor survives a lowercase modifier', () => {
    /*
     * Every Stereophile comparison is against "the earlier Rossini DAC".
     * Requiring the anchor to begin with a capital dropped all of them, and a
     * proposition with no anchor is never constructed — so the strongest
     * evidence in the review vanished silently.
     */
    const resolution = character('dcs rossini apex', 'X')
      .propositions.find((p) => p.dimension === 'resolution');
    expect(resolution?.comparedWith).toMatch(/rossini/i);
  });

  it('refuses to merge comparisons made against different products', () => {
    const r = deriveCharacter('p', 'P', [
      obs({ observationType: 'comparison', claim: 'Richer in tone than the Alpha One.' }),
      obs({ observationType: 'comparison', claim: 'Fuller in tone than the Beta Two.' }),
    ]);
    expect(r.propositions.find((p) => p.dimension === 'tonal_density')).toBeUndefined();
  });
});

describe('conditions travel', () => {
  it('a show report carries its conditions into the statement', () => {
    const warmth = character('acora qrc-2', 'Acora Acoustics QRC-2')
      .propositions.find((p) => p.dimension === 'warmth');
    expect(warmth?.basis).toBe('conditional');
    expect(warmth?.confidence).toBe('low');
    expect(warmth?.statement).toMatch(/Toronto Audiofest/);
    expect(warmth?.statement).toMatch(/Hegel/);
  });

  it('so the QRC-2 is never described as simply warm', () => {
    const warmth = character('acora qrc-2', 'Acora Acoustics QRC-2')
      .propositions.find((p) => p.dimension === 'warmth');
    expect(warmth?.statement).toMatch(/though only/);
  });
});

describe('disagreement is a finding, not noise to average', () => {
  it('two publications pointing opposite ways produce no claim', () => {
    const r = deriveCharacter('p', 'P', [
      obs({ publication: 'Stereophile', claim: 'Tone was rich and full.' }),
      obs({
        publication: 'The Absolute Sound',
        sourceUrl: 'https://www.theabsolutesound.com/x',
        claim: 'Tone was thin and lean.',
      }),
    ]);
    expect(r.propositions.find((p) => p.dimension === 'tonal_density')).toBeUndefined();
  });
});

describe('the Butler is the case the architecture must not paper over', () => {
  it('has no admitted observations', () => {
    expect(seedObservationsFor('butler monad a100')).toEqual([]);
  });

  it('yields a named gap rather than silence', () => {
    const r = character('butler monad a100', 'Butler Monad A100');
    expect(r.propositions).toEqual([]);
    expect(r.gap?.reason).toBe('no_admitted_observations');
    expect(r.gap?.detail).toMatch(/Butler Monad A100/);
  });

  it('blocks every relation that would need its character', () => {
    const pre = {
      name: 'Audio Research Reference 5',
      propositions: character('audio research reference 5', 'Audio Research Reference 5').propositions,
    };
    const amp = { name: 'Butler Monad A100', propositions: [] };
    const known = pre.propositions.map((p) => p.dimension);
    expect(known.length).toBeGreaterThan(0);
    for (const d of CHARACTER_DIMENSIONS) {
      const r = synthesise(pre, amp, d);
      expect(r.kind, d).toBe('not_established');
      // Where the preamplifier IS characterised, the amplifier is named as the
      // reason — the listener learns which box to be curious about.
      if (known.includes(d)) expect(r.blockedBy, d).toBe('Butler Monad A100');
    }
  });
});

describe('relational rules', () => {
  const withDim = (name: string, dimension: typeof CHARACTER_DIMENSIONS[number], direction: string) => ({
    name,
    propositions: [{
      productKey: name, productName: name, dimension, direction,
      statement: '', basis: 'direct_observation' as const, confidence: 'moderate' as const,
      support: [obs({})], publications: ['Stereophile'], conditions: [],
    }],
  });

  it('two warm components reinforce — they do not balance', () => {
    const r = synthesise(withDim('A', 'warmth', 'warm'), withDim('B', 'warmth', 'warm'), 'warmth');
    expect(r.kind).toBe('tension');
    expect(r.statement).toMatch(/compound rather than offset/);
    // "tonal balance" is the dimension's own name; what must never appear is
    // the claim that the two components balance EACH OTHER.
    expect(r.statement).not.toMatch(/balance each other|counterweight|cancel|counteract/i);
  });

  it('opposed and established may complement', () => {
    const r = synthesise(withDim('A', 'warmth', 'warm'), withDim('B', 'warmth', 'cool'), 'warmth');
    expect(r.kind).toBe('complementary');
  });

  it('difference with thin evidence is difference, not complementarity', () => {
    const a = withDim('A', 'warmth', 'warm');
    a.propositions[0].confidence = 'low';
    const r = synthesise(a, withDim('B', 'warmth', 'cool'), 'warmth');
    expect(r.kind).toBe('neutral_coexistence');
    expect(r.statement).toMatch(/Difference is established here; complementarity is not/);
  });

  it('a relation is never more confident than its weakest side', () => {
    const a = withDim('A', 'resolution', 'high');
    a.propositions[0].confidence = 'low';
    const r = synthesise(a, withDim('B', 'resolution', 'high'), 'resolution');
    expect(r.confidence).toBe('low');
  });

  it('a revealing speaker raises consequence, it does not claim system resolution', () => {
    const spk = withDim('Speaker', 'resolution', 'high');
    const r = revealingDownstream(['DAC'], spk);
    expect(r?.statement).toMatch(/more audible/);
    expect(r?.statement).toMatch(/not a claim that the system as a whole sounds resolving/);
  });

  it('and is withheld when the speaker’s resolution is not established', () => {
    expect(revealingDownstream(['DAC'], { name: 'Speaker', propositions: [] })).toBeUndefined();
  });
});

describe('the seed is candidates, not facts', () => {
  it('every row passes the real admission gate', () => {
    const { admitted, rejected } = seedObservations();
    expect(rejected).toEqual([]);
    expect(admitted.length).toBeGreaterThan(10);
  });

  it('carries no excluded or unapproved publication', () => {
    for (const o of seedObservations().admitted) {
      expect(o.sourceUrl).not.toMatch(/6moons|audiobeatnik|audiogon|enjoythemusic|diyaudio/i);
    }
  });

  it('holds no Acora sibling or ARC variant as evidence for the listener’s unit', () => {
    for (const o of seedObservations().admitted) {
      if (o.productKey === 'acora qrc-2') expect(o.productName).toMatch(/QRC-2/);
      if (o.productKey === 'audio research reference 5') {
        expect(o.productName).not.toMatch(/\bSE\b/);
      }
    }
  });

  it('dimensionsOf reads description, not product knowledge', () => {
    expect(dimensionsOf(obs({ claim: 'Bass was firm and extended.' }))).toContain('bass_control');
    expect(dimensionsOf(obs({ claim: 'A completely unrelated sentence.' }))).toEqual([]);
  });
});
