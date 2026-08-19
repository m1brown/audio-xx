import { describe, it, expect } from 'vitest';
import {
  licensedRelations, validateRelations, filterUnlicensedRelationalProse,
  premiseTransfer, referencesComponentSet,
  type AttributeRecord, type RelationSet,
} from '../relational-explain';

const NAMES = ['dCS Rossini Apex', 'ARC ref 5', 'Butler Monads', 'Acora QRC-2'];

/** The Stereophile observation, heard through Ideon sources and JMF electronics. */
const ACORA_FOREIGN: AttributeRecord = {
  component: 'Acora QRC-2', axis: 'smooth_detailed', value: 'smooth',
  tier: 'independent_review', scope: 'product',
  attribution: {
    publication: 'Stereophile',
    sourceUrl: 'https://www.stereophile.com/content/acora-acousticshegeljmf-audioideon-audiocardas',
    condition: 'associated_equipment: driven by Ideon Audio sources and JMF Audio '
      + 'electronics at Capital AudioFest 2022',
  },
};
const DCS_BRAND: AttributeRecord = {
  component: 'dCS Rossini Apex', axis: 'smooth_detailed', value: 'detailed',
  tier: 'brand', scope: 'brand',
};
/** Same publication, but the condition is about the product itself. */
const ACORA_OWN: AttributeRecord = {
  ...ACORA_FOREIGN,
  attribution: { ...ACORA_FOREIGN.attribution, condition: 'break_in: after 500 hours' },
};

const relSet = (): RelationSet => ({
  status: 'established',
  relations: [{
    components: ['Acora QRC-2', 'dCS Rossini Apex'],
    axis: 'smooth_detailed', kind: 'counterweight', premises: [0, 1],
  }],
});

describe('transfer is a property of the premise, not of its disclosure', () => {
  it('classifies an observation made through other electronics', () => {
    expect(premiseTransfer(ACORA_FOREIGN)).toBe('transfer_limited');
  });

  it('classifies a condition about the product itself as merely conditioned', () => {
    expect(premiseTransfer(ACORA_OWN)).toBe('conditioned');
    expect(premiseTransfer(DCS_BRAND)).toBe('direct');
  });

  it('REFUSES a relation resting on a transfer-limited premise', () => {
    const v = validateRelations(relSet(), [ACORA_FOREIGN, DCS_BRAND]);
    expect(v).toHaveLength(1);
    expect(v[0].rule).toBe('transfer');
    expect(v[0].detail).toContain('Ideon');
    expect(licensedRelations(relSet(), [ACORA_FOREIGN, DCS_BRAND])).toHaveLength(0);
  });

  it('still licenses the same relation when the condition is about the product', () => {
    // The positive control. The rule must not swallow conditioned evidence
    // generally — only evidence heard through equipment the listener lacks.
    expect(licensedRelations(relSet(), [ACORA_OWN, DCS_BRAND])).toHaveLength(1);
  });
});

describe('THE ACORA / IDEON / JMF CASE — what publishes and what does not', () => {
  const surviving = licensedRelations(relSet(), [ACORA_FOREIGN, DCS_BRAND]);
  const run = (s: string) => filterUnlicensedRelationalProse(s, surviving, NAMES);

  it('publishes the attributed, conditioned Describe statement', () => {
    const s = 'Stereophile heard the Acora QRC-2 as unusually smooth, driven by Ideon '
      + 'Audio sources and JMF Audio electronics at Capital AudioFest 2022.';
    expect(run(s).prose?.trim()).toBe(s);
  });

  it('rejects the counterweight even when the foreign equipment IS disclosed', () => {
    // This exact sentence PUBLISHED before the rule existed: it named the
    // publication, stated the foreign electronics and restated the partner at
    // brand scope, satisfying every check there was. Disclosure is not licence.
    const s = 'Stereophile heard the Acora QRC-2 as unusually smooth, driven by Ideon '
      + 'Audio sources and JMF Audio electronics at Capital AudioFest 2022, which '
      + 'offsets the detail emphasis dCS designs are typically associated with.';
    const r = run(s);
    expect(r.prose?.trim()).toBeFalsy();
    expect(r.dropped[0].reason).toContain('no licensed relation');
  });

  it('rejects the reinforcement reading too — direction is not the issue', () => {
    const s = 'Stereophile heard the Acora QRC-2 as unusually smooth, driven by Ideon '
      + 'Audio sources and JMF Audio electronics, reinforcing the smoothness dCS '
      + 'designs are typically associated with.';
    expect(run(s).prose?.trim()).toBeFalsy();
  });
});

describe('an aggregate claim cannot escape by naming nobody', () => {
  const surviving = licensedRelations(relSet(), [ACORA_OWN, DCS_BRAND]);
  const run = (s: string) => filterUnlicensedRelationalProse(s, surviving, NAMES);

  it('resolves a definite collective reference to every component', () => {
    for (const s of ['The components synergize well.', 'Its components work together.',
      'All four components complement one another.', 'Each component supports the others.',
      "The system's components are well matched."]) {
      expect(referencesComponentSet(s)).toBe(true);
    }
  });

  it('DROPS the escape Nathan demonstrated', () => {
    const r = run('The components synergize well to produce a consistent and coherent '
      + 'audio experience.');
    expect(r.prose?.trim()).toBeFalsy();
    expect(r.dropped[0].reason).toContain('collective reference');
  });

  it('drops the rephrasings too, without knowing the words', () => {
    // The rule never reads the predicate, so no synonym escapes it.
    for (const s of ['The components work together beautifully.',
      'The parts complement each other.', 'These elements are extremely well matched.',
      'Its components are voiced as a single coherent whole.']) {
      expect(run(s).prose?.trim()).toBeFalsy();
    }
  });

  it('leaves a generic plural about OTHER systems alone', () => {
    // Indefinite, and not about this system's set at all.
    const s = 'Some listeners prefer systems leaning toward purely tube-driven components.';
    expect(referencesComponentSet(s)).toBe(false);
    expect(run(s).prose?.trim()).toBe(s);
  });
});

describe('positive controls — restraint must not become muteness', () => {
  const surviving = licensedRelations(relSet(), [ACORA_OWN, DCS_BRAND]);
  const run = (s: string) => filterUnlicensedRelationalProse(s, surviving, NAMES);

  it('keeps the overall verdict', () => {
    for (const s of ['Nothing here clearly needs changing.',
      'Nothing in this setup appears to need adjustment.',
      'Nothing here obviously needs changing, and the chain reinforces its own direction.']) {
      expect(run(s).prose?.trim()).toBe(s);
    }
  });

  it('keeps system-level DESCRIPTION, which ascribes a property to one whole', () => {
    // "The system" is one object, not a plurality acting on itself. Silencing
    // this would be the over-correction the licensing work exists to avoid.
    for (const s of ['The system is coherent, with a smooth and controlled character.',
      'This setup leans toward resolution over warmth.']) {
      expect(referencesComponentSet(s)).toBe(false);
      expect(run(s).prose?.trim()).toBe(s);
    }
  });

  it('keeps single-component description', () => {
    const s = 'The Acora QRC-2 presents a 4 ohm load.';
    expect(run(s).prose?.trim()).toBe(s);
  });

  it("keeps Audio XX's own derived quantity conclusion", () => {
    // Two components named, and the drive relation licenses the pair.
    const drive = [...surviving, {
      components: ['Butler Monads', 'Acora QRC-2'] as [string, string],
      axis: 'power_load', kind: 'reinforcement' as const, premises: [0, 0] as [number, number],
      licensedTier: 'manufacturer' as const, licensedScope: 'product' as const,
      brandScoped: [], citedPublications: [], conditions: [],
    }];
    const s = 'Published figures put the Butler Monads at 200 watts into 4 ohms, which '
      + 'is the load the Acora QRC-2 presents.';
    expect(filterUnlicensedRelationalProse(s, drive, NAMES).prose?.trim()).toBe(s);
  });
});
