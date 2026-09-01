import { describe, it, expect } from 'vitest';
import {
  toAttributeRecords, findDisagreements, contextObservations,
} from '../evidence/independent-review-consumption';
import {
  licensedRelations, filterUnlicensedRelationalProse,
  type AttributeRecord, type RelationSet,
} from '../relational-explain';
import type { ReviewObservation } from '../evidence/independent-review';

/**
 * Independent-review consumption — slice 4.
 *
 * The first slice where this evidence reaches a listener, so the question is
 * not "can we cite more publications" but "does independent reporting change
 * or strengthen a premise the assessment reasons FROM". Review prose that only
 * adds adjectives has not earned its place.
 */

const NAMES = ['dCS Rossini Apex', 'ARC ref 5', 'Butler Monads', 'Acora QRC-2'];

const listening = (over: Partial<ReviewObservation> = {}): ReviewObservation => ({
  productKey: 'dcs rossini apex', productName: 'dCS Rossini APEX',
  publication: 'Stereophile',
  sourceUrl: 'https://www.stereophile.com/content/dcs-rossini-apex-da-processor',
  observationType: 'listening',
  claim: 'Reports greater differentiation of instrumental texture.',
  axis: 'smooth_detailed', direction: 'detailed',
  retrievedAt: Date.now(), ...over,
});

describe('only observations capable of being premises become premises', () => {
  it('lifts a listening observation with an axis and a direction', () => {
    const [r] = toAttributeRecords('dCS Rossini Apex', [listening()]);
    expect(r).toMatchObject({
      component: 'dCS Rossini Apex', axis: 'smooth_detailed', value: 'detailed',
      tier: 'independent_review', scope: 'product',
    });
    expect(r.attribution?.publication).toBe('Stereophile');
  });

  it('ignores a listening observation with no axis — that is prose, not a premise', () => {
    expect(toAttributeRecords('dCS Rossini Apex', [
      listening({ axis: undefined, direction: undefined }),
    ])).toHaveLength(0);
  });

  it('lifts a measurement only where it names a physical quantity', () => {
    const [r] = toAttributeRecords('Acora QRC-2', [listening({
      observationType: 'measurement', axis: undefined, direction: undefined,
      claim: 'Measured sensitivity of 86dB/2.83V/1m.',
    })]);
    expect(r).toMatchObject({ axis: 'power_load', tier: 'independent_review' });
    expect(r.value).toContain('sensitivity');
  });

  it('does NOT turn a THD figure into a sonic premise', () => {
    // A distortion measurement is real evidence and is not a position on any
    // axis. Forcing one would invent a sonic reading from a bench figure.
    expect(toAttributeRecords('dCS Rossini Apex', [listening({
      observationType: 'measurement', axis: undefined, direction: undefined,
      claim: 'Measured THD+N of 0.00026% at 1kHz.',
    })])).toHaveLength(0);
  });

  it('never lets comparison or positioning become a sonic premise', () => {
    expect(toAttributeRecords('dCS Rossini Apex', [
      listening({ observationType: 'comparison', claim: 'Larger in scale than the MRC-2.' }),
      listening({ observationType: 'positioning', claim: 'Listed in Recommended Components.' }),
    ])).toHaveLength(0);
  });

  it('still offers comparison and positioning as context', () => {
    // Real evidence about the product; simply not what a sonic conclusion
    // may rest on.
    expect(contextObservations([
      listening(),
      listening({ observationType: 'positioning', claim: 'Class A listing.' }),
    ])).toHaveLength(1);
  });
});

describe('attribution must survive into the prose that uses it', () => {
  const A: AttributeRecord[] = [
    ...toAttributeRecords('dCS Rossini Apex', [listening()]),
    { component: 'ARC ref 5', axis: 'smooth_detailed', value: 'smooth',
      tier: 'model', scope: 'product' },
  ];
  const SET: RelationSet = { status: 'established', relations: [
    { components: ['dCS Rossini Apex', 'ARC ref 5'], axis: 'smooth_detailed',
      kind: 'counterweight', premises: [0, 1] },
  ] };
  const surviving = licensedRelations(SET, A);

  it('carries the publication onto the licensed relation', () => {
    expect(surviving[0].citedPublications).toEqual(['Stereophile']);
    // The relation is no stronger than its weaker premise.
    expect(surviving[0].licensedTier).toBe('model');
  });

  it('DROPS a sentence that uses the observation without naming the publication', () => {
    // Unattributed, a review finding reads as Audio XX's own.
    const unattributed = 'The dCS Rossini Apex is detailed, which the ARC ref 5 counterbalances.';
    const { prose, dropped } = filterUnlicensedRelationalProse(unattributed, surviving, NAMES);
    expect(prose).toBeUndefined();
    expect(dropped[0].reason).toMatch(/not attributed \(Stereophile\)/);
  });

  it('publishes the same sentence once the publication is named', () => {
    const attributed = 'Stereophile reports the dCS Rossini Apex as notably detailed, '
      + 'which the ARC ref 5 counterbalances.';
    expect(filterUnlicensedRelationalProse(attributed, surviving, NAMES).prose)
      .toBe(attributed);
  });

  it('is not satisfied by naming a different publication', () => {
    const wrong = 'The Absolute Sound reports the dCS Rossini Apex as detailed, '
      + 'which the ARC ref 5 counterbalances.';
    expect(filterUnlicensedRelationalProse(wrong, surviving, NAMES).prose).toBeUndefined();
  });
});

describe('conditions travel with the claim into the prose', () => {
  const CONDITIONED = listening({
    productKey: 'audio research reference 5', productName: 'Audio Research Reference 5',
    publication: 'The Absolute Sound',
    sourceUrl: 'https://www.theabsolutesound.com/articles/audio-research-reference-5-linestage-preamplifier/',
    claim: 'Reports the presentation opens up markedly.',
    axis: 'smooth_detailed', direction: 'smooth',
    condition: { kind: 'break_in', description: 'after approximately 500 hours' },
  });
  const A: AttributeRecord[] = [
    ...toAttributeRecords('ARC ref 5', [CONDITIONED]),
    { component: 'dCS Rossini Apex', axis: 'smooth_detailed', value: 'detailed',
      tier: 'model', scope: 'product' },
  ];
  const SET: RelationSet = { status: 'established', relations: [
    { components: ['ARC ref 5', 'dCS Rossini Apex'], axis: 'smooth_detailed',
      kind: 'counterweight', premises: [0, 1] },
  ] };
  const surviving = licensedRelations(SET, A);

  it('carries the condition onto the licensed relation', () => {
    expect(surviving[0].conditions[0]).toContain('500 hours');
  });

  it('DROPS the sentence when the condition is not stated', () => {
    // A conditioned finding reported flat is a claim the publication never
    // made — and the condition is the only part a listener can act on.
    const flat = 'The Absolute Sound reports the ARC ref 5 smoothing the presentation, '
      + 'counterbalancing the dCS Rossini Apex.';
    const { prose, dropped } = filterUnlicensedRelationalProse(flat, surviving, NAMES);
    expect(prose).toBeUndefined();
    expect(dropped[0].reason).toMatch(/condition dropped/);
  });

  it('publishes the sentence when the condition is stated', () => {
    const stated = 'The Absolute Sound reports the ARC ref 5 smoothing the presentation '
      + 'after 500 hours of use, counterbalancing the dCS Rossini Apex.';
    expect(filterUnlicensedRelationalProse(stated, surviving, NAMES).prose).toBe(stated);
  });
});

describe('disagreement is preserved, never resolved', () => {
  const CONFLICTING: ReviewObservation[] = [
    listening({ publication: 'Stereophile', axis: 'warm_bright', direction: 'bright' }),
    listening({ publication: 'The Absolute Sound', axis: 'warm_bright', direction: 'warm',
      sourceUrl: 'https://www.theabsolutesound.com/articles/x/' }),
  ];

  it('reports both positions with their publications', () => {
    const [d] = findDisagreements('dCS Rossini Apex', CONFLICTING);
    expect(d.axis).toBe('warm_bright');
    expect(d.positions.map((p) => p.direction).sort()).toEqual(['bright', 'warm']);
    expect(d.positions.map((p) => p.publication).sort())
      .toEqual(['Stereophile', 'The Absolute Sound']);
  });

  it('does not average, rank or pick a majority', () => {
    const [d] = findDisagreements('dCS Rossini Apex', CONFLICTING);
    expect(Object.keys(d)).toEqual(['component', 'axis', 'positions']);
    for (const k of ['score', 'average', 'consensus', 'winner', 'resolved']) {
      expect(Object.keys(d)).not.toContain(k);
    }
  });

  it('reports nothing where the sources agree', () => {
    expect(findDisagreements('dCS Rossini Apex', [
      listening({ publication: 'Stereophile', axis: 'warm_bright', direction: 'bright' }),
      listening({ publication: 'HiFi+', axis: 'warm_bright', direction: 'bright',
        sourceUrl: 'https://hifiplus.com/articles/x/' }),
    ])).toHaveLength(0);
  });

  it('keeps BOTH conflicting premises available rather than dropping one', () => {
    // Silencing the minority view would be resolution by another name.
    expect(toAttributeRecords('dCS Rossini Apex', CONFLICTING)).toHaveLength(2);
  });
});

describe('zero coverage invents nothing', () => {
  it('yields no premises and no context for a product with no observations', () => {
    expect(toAttributeRecords('Butler Monads', [])).toHaveLength(0);
    expect(contextObservations([])).toHaveLength(0);
    expect(findDisagreements('Butler Monads', [])).toHaveLength(0);
  });
});
