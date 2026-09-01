import { describe, it, expect } from 'vitest';
import { buildProvisionalPrompt } from '../llm-system-inference';
import {
  licensedRelations, filterUnlicensedRelationalProse,
  type AttributeRecord, type RelationSet,
} from '../relational-explain';

/**
 * REGRESSION GUARD — independent-review evidence must be able to reach a
 * licensed conclusion.
 *
 * Slice 4 found review evidence admitted, stored and offered to reasoning, and
 * then never entering a single relation. The cause was structural, not a
 * matter of the model's judgment: `relations[].premises` indexed the model's
 * OWN attribute array, and review-derived records were appended afterwards, so
 * they occupied positions nothing could reference. Audio XX now selects the
 * premise set and it occupies the LEADING indices.
 *
 * Nathan cannot be this fixture. Every one of his review observations is
 * conditioned or transfer-limited, so under current doctrine they license
 * description and not system reasoning — correctly. Proving the path needs a
 * case where the evidence is legitimately applicable, which means an
 * UNCONDITIONAL exact-product listening observation from an approved
 * publication.
 *
 * Nothing here relaxes a rule to make the test pass. If this fixture fails,
 * the reachability defect has returned.
 */

const COMPONENTS = ['Chord Qutest', 'Harbeth Super HL5 Plus'];

/** Unconditional, exact-product, approved publication, on a known axis. */
const UNCONDITIONAL_OBSERVATION = {
  productKey: 'harbeth super hl5 plus',
  productName: 'Harbeth Super HL5 Plus',
  publication: 'Darko.Audio',
  reviewer: 'John Darko',
  sourceUrl: 'https://darko.audio/harbeth-super-hl5-plus',
  publishedAt: '2024-04-02',
  observationType: 'listening' as const,
  claim: 'The Super HL5 Plus plays with an unforced midrange and no edge on massed strings.',
  axis: 'smooth_detailed',
  direction: 'smooth',
  retrievedAt: 1,
};

function build() {
  return buildProvisionalPrompt(
    'Assess my system: Chord Qutest, Harbeth Super HL5 Plus',
    COMPONENTS,
    [],
    COMPONENTS.map((name) => ({ name, role: name.includes('Harbeth') ? 'speaker' : 'dac' })),
    COMPONENTS,
    [],
    [] as never,
    { 'Harbeth Super HL5 Plus': [UNCONDITIONAL_OBSERVATION] } as never,
  );
}

describe('review evidence reaches the selected premise set', () => {
  const { suppliedPremises, userPrompt } = build();

  it('selects the review observation as a premise', () => {
    const p = suppliedPremises.find((x) => x.component === 'Harbeth Super HL5 Plus');
    expect(p).toBeDefined();
    expect(p).toMatchObject({
      axis: 'smooth_detailed', value: 'smooth',
      tier: 'independent_review', scope: 'product',
    });
    expect(p!.attribution?.publication).toBe('Darko.Audio');
    expect(p!.attribution?.condition).toBeUndefined();
  });

  it('occupies a LEADING index the model can reference', () => {
    // The whole contract. A premise the model cannot point at is a premise
    // that does not exist, which is exactly what Slice 4 discovered.
    expect(suppliedPremises.length).toBeGreaterThan(0);
    expect(suppliedPremises[0].component).toBe('Harbeth Super HL5 Plus');
    expect(userPrompt).toMatch(/P0\. Harbeth Super HL5 Plus — smooth_detailed = smooth \[Darko\.Audio\]/);
  });
});

describe('a surviving relation rests on it', () => {
  const { suppliedPremises } = build();

  // What the model returns: its own attribute for the other component, and a
  // relation joining premise index 0 (ours) to the first model attribute.
  const modelAttributes: AttributeRecord[] = [{
    component: 'Chord Qutest', axis: 'smooth_detailed', value: 'smooth',
    tier: 'model', scope: 'product',
  }];
  const attributes = [...suppliedPremises, ...modelAttributes];
  const relations: RelationSet = {
    status: 'established',
    relations: [{
      components: ['Harbeth Super HL5 Plus', 'Chord Qutest'],
      axis: 'smooth_detailed', kind: 'reinforcement',
      premises: [0, suppliedPremises.length],
    }],
  };
  const surviving = licensedRelations(relations, attributes);

  it('is licensed, and carries the publication', () => {
    expect(surviving).toHaveLength(1);
    expect(surviving[0].citedPublications).toEqual(['Darko.Audio']);
    expect(surviving[0].conditions).toEqual([]);
  });

  it('is bounded by its WEAKER premise, not laundered upward', () => {
    expect(surviving[0].licensedTier).toBe('model');
    expect(surviving[0].licensedScope).toBe('product');
  });

  it('publishes prose that names the publication', () => {
    const s = 'Darko.Audio heard the Harbeth Super HL5 Plus as unforced through the '
      + 'midrange, and the Chord Qutest carries the same ease rather than sharpening it.';
    expect(filterUnlicensedRelationalProse(s, surviving, COMPONENTS, [], attributes)
      .prose?.trim()).toBe(s);
  });

  it('still refuses the same claim unattributed', () => {
    // Attribution is the licence, not decoration: unattributed, a review
    // finding reads as Audio XX's own.
    const s = 'The Harbeth Super HL5 Plus is unforced through the midrange, and the '
      + 'Chord Qutest carries the same ease rather than sharpening it.';
    const r = filterUnlicensedRelationalProse(s, surviving, COMPONENTS, [], attributes);
    expect(r.prose?.trim()).toBeFalsy();
    expect(r.dropped[0].reason).toContain('not attributed');
  });
});
