import { describe, it, expect } from 'vitest';
import {
  licensedRelations, filterUnlicensedRelationalProse, relationScope, hasBrandAttributionFor,
  type AttributeRecord, type RelationSet,
} from '../relational-explain';

/**
 * GOVERNING INVARIANT (founder, 2026-08-17):
 *
 *   No Explain prose may survive unless the relation it expresses survived
 *   deterministic licensing.
 *
 * The production failure, captured in full from the live beta system. The
 * model proposed two relations:
 *
 *   [0] dCS Rossini Apex  smooth_detailed=detailed   (brand scope)
 *   [1] ARC ref 5         warm_bright=neutral
 *   [2] Butler Monads     elastic_controlled=controlled
 *   [3] Acora QRC-2       airy_closed=airy
 *
 *   dCS x Acora   claiming smooth_detailed   premises [0,3]
 *   Butler x ARC  claiming elastic_controlled premises [2,1]
 *
 * Both join premises on DIFFERENT axes. `validateRelations` rejected both.
 * And the published assessment said:
 *
 *   "The dCS Rossini Apex and Acora QRC-2 reinforce a richly detailed
 *    presentation… Meanwhile, the combination of the ARC ref 5 and Butler
 *    Monads ensures tight control over dynamics."
 *
 * `interactionExplanation` ran parallel to validation instead of downstream of
 * it: validation decided what Audio XX may believe, the prose decided what it
 * would say.
 */

const NAMES = ['dCS Rossini Apex', 'ARC ref 5', 'Butler Monads', 'Acora QRC-2'];

const attr = (component: string, axis: string, value: string,
  tier: AttributeRecord['tier'], scope: AttributeRecord['scope'] = 'product'): AttributeRecord =>
  ({ component, axis, value, tier, scope });

/** The exact attribute bag production produced. */
const PRODUCTION_ATTRS: AttributeRecord[] = [
  attr('dCS Rossini Apex', 'smooth_detailed', 'detailed', 'brand', 'brand'),
  attr('ARC ref 5', 'warm_bright', 'neutral', 'model'),
  attr('Butler Monads', 'elastic_controlled', 'controlled', 'model'),
  attr('Acora QRC-2', 'airy_closed', 'airy', 'model'),
];

const PRODUCTION_SET: RelationSet = {
  status: 'established',
  relations: [
    { components: ['dCS Rossini Apex', 'Acora QRC-2'], axis: 'smooth_detailed',
      kind: 'reinforcement', premises: [0, 3] },
    { components: ['Butler Monads', 'ARC ref 5'], axis: 'elastic_controlled',
      kind: 'reinforcement', premises: [2, 1] },
  ],
};

const PRODUCTION_PROSE =
  'The dCS Rossini Apex and Acora QRC-2 reinforce a richly detailed presentation, '
  + 'with the dCS pairing well with the Acora to produce an expansive sound stage. '
  + 'Meanwhile, the combination of the ARC ref 5 and Butler Monads ensures tight '
  + 'control over dynamics.';

describe('THE PRODUCTION REGRESSION — rejected relations may not be published', () => {
  const surviving = licensedRelations(PRODUCTION_SET, PRODUCTION_ATTRS);

  it('rejects both proposed relations', () => {
    expect(surviving).toHaveLength(0);
  });

  it('publishes none of the prose asserting them', () => {
    const { prose, dropped } = filterUnlicensedRelationalProse(
      PRODUCTION_PROSE, surviving, NAMES);
    expect(prose).toBeUndefined();
    // Two sentences, one per rejected relation — the whole Explain paragraph.
    expect(dropped).toHaveLength(2);
    expect(dropped[0].reason).toMatch(/no licensed relation between/);
  });

  it('names neither rejected pair anywhere in the output', () => {
    const { prose } = filterUnlicensedRelationalProse(PRODUCTION_PROSE, surviving, NAMES);
    expect(prose ?? '').not.toMatch(/Acora/);
    expect(prose ?? '').not.toMatch(/Butler/);
  });
});

describe('POSITIVE CONTROL — a licensed relation still gets said', () => {
  // The repair must not simply silence Explain.
  const A: AttributeRecord[] = [
    attr('dCS Rossini Apex', 'warm_bright', 'bright', 'model'),
    attr('ARC ref 5', 'warm_bright', 'warm', 'model'),
  ];
  const SET: RelationSet = { status: 'established', relations: [
    { components: ['dCS Rossini Apex', 'ARC ref 5'], axis: 'warm_bright',
      kind: 'counterweight', premises: [0, 1] },
  ] };
  const surviving = licensedRelations(SET, A);
  const PROSE = 'The dCS Rossini Apex leans bright, which the ARC ref 5 counterbalances '
    + 'with a warmer presentation.';

  it('licenses the relation', () => {
    expect(surviving).toHaveLength(1);
    expect(surviving[0].licensedTier).toBe('model');
    expect(surviving[0].licensedScope).toBe('product');
  });

  it('publishes the sentence unchanged', () => {
    const { prose, dropped } = filterUnlicensedRelationalProse(PROSE, surviving, NAMES);
    expect(prose).toBe(PROSE);
    expect(dropped).toHaveLength(0);
  });

  it('drops only the unlicensed sentence when both kinds are present', () => {
    const mixed = `${PROSE} The Butler Monads also complement the Acora QRC-2 throughout.`;
    const { prose } = filterUnlicensedRelationalProse(mixed, surviving, NAMES);
    expect(prose).toContain('counterbalances');
    expect(prose).not.toContain('Butler');
  });
});

describe('SCOPE — brand evidence may not silently become a product claim', () => {
  const A: AttributeRecord[] = [
    attr('dCS Rossini Apex', 'warm_bright', 'bright', 'brand', 'brand'),
    attr('ARC ref 5', 'warm_bright', 'warm', 'model'),
  ];
  const SET: RelationSet = { status: 'established', relations: [
    { components: ['dCS Rossini Apex', 'ARC ref 5'], axis: 'warm_bright',
      kind: 'counterweight', premises: [0, 1] },
  ] };
  const surviving = licensedRelations(SET, A);

  it('marks the relation brand-scoped and names the component', () => {
    expect(relationScope(A[0], A[1])).toBe('brand');
    expect(surviving[0].licensedScope).toBe('brand');
    expect(surviving[0].brandScoped).toEqual(['dCS Rossini Apex']);
  });

  it('drops a product-specific assertion built on brand evidence', () => {
    const productClaim = 'The dCS Rossini Apex is bright, which the ARC ref 5 counterbalances.';
    const { prose, dropped } = filterUnlicensedRelationalProse(productClaim, surviving, NAMES);
    expect(prose).toBeUndefined();
    expect(dropped[0].reason).toMatch(/brand-scoped relation asserted of the product/);
  });

  it('keeps the same claim when it is attributed to the maker', () => {
    const attributed = 'dCS designs are associated with a bright balance, which the '
      + 'ARC ref 5 counterbalances.';
    const { prose } = filterUnlicensedRelationalProse(attributed, surviving, NAMES);
    expect(prose).toBe(attributed);
  });
});

describe('none_establishable is a successful outcome', () => {
  const SET: RelationSet = { status: 'none_establishable', relations: [] };

  it('licenses nothing and penalises nothing', () => {
    expect(licensedRelations(SET, PRODUCTION_ATTRS)).toEqual([]);
  });

  it('still permits per-component description', () => {
    // Absence of a relation must not silence Describe — only Explain.
    const describe_ = 'The dCS Rossini Apex is a Ring DAC design. '
      + 'The Acora QRC-2 is a floorstanding loudspeaker.';
    const { prose } = filterUnlicensedRelationalProse(describe_, [], NAMES);
    expect(prose).toBe(describe_);
  });

  it('removes any sentence that implies an interaction anyway', () => {
    const implied = 'The dCS Rossini Apex and the Acora QRC-2 work together well.';
    expect(filterUnlicensedRelationalProse(implied, [], NAMES).prose).toBeUndefined();
  });
});

describe('LAYER BOUNDARY — no layer consumes evidence it bypassed', () => {
  const A: AttributeRecord[] = [
    attr('dCS Rossini Apex', 'warm_bright', 'bright', 'model'),
    attr('Acora QRC-2', 'airy_closed', 'airy', 'model'),
  ];
  const rejected: RelationSet = { status: 'established', relations: [
    { components: ['dCS Rossini Apex', 'Acora QRC-2'], axis: 'warm_bright',
      kind: 'reinforcement', premises: [0, 1] },
  ] };
  const surviving = licensedRelations(rejected, A);

  it('Describe cannot smuggle in an Explain claim', () => {
    const smuggled = 'The dCS Rossini Apex is bright and pairs with the Acora QRC-2 '
      + 'to produce an airy presentation.';
    expect(filterUnlicensedRelationalProse(smuggled, surviving, NAMES).prose).toBeUndefined();
  });

  it('Evaluate cannot rebuild a rejected relation from the attribute bag', () => {
    const rebuilt = 'You gain detail because the dCS Rossini Apex reinforces what the '
      + 'Acora QRC-2 already does.';
    expect(filterUnlicensedRelationalProse(rebuilt, surviving, NAMES).prose).toBeUndefined();
  });

  it('leaves single-component statements alone at every layer', () => {
    const single = 'The dCS Rossini Apex leans bright.';
    expect(filterUnlicensedRelationalProse(single, surviving, NAMES).prose).toBe(single);
  });
});

/**
 * The two live escapes from the first implementation, pinned verbatim.
 *
 * Both walked past a connective vocabulary. The rule is now positional:
 * naming or referring to a second component is what requires a licence.
 */
describe('LIVE ESCAPE 1 — a connective the list did not contain', () => {
  const A: AttributeRecord[] = [
    attr('dCS Rossini Apex', 'smooth_detailed', 'detailed', 'brand', 'brand'),
    attr('Acora QRC-2', 'airy_closed', 'airy', 'model'),
  ];
  const SET: RelationSet = { status: 'established', relations: [
    { components: ['dCS Rossini Apex', 'Acora QRC-2'], axis: 'smooth_detailed',
      kind: 'reinforcement', premises: [0, 1] },
  ] };
  const surviving = licensedRelations(SET, A);

  it('rejects the relation for commensurability', () => {
    expect(surviving).toHaveLength(0);
  });

  it('drops the exact published sentence', () => {
    // Shipped on 2026-08-17 after both relations were rejected. "further
    // supported by" was simply absent from RELATIONAL_CONNECTIVE.
    const escaped = 'The dCS Rossini Apex acts as a precise and transparent source, '
      + 'establishing a detailed baseline that is further supported by the airy '
      + 'resolution of the Acora QRC-2 speakers, leading to a refined and open soundstage.';
    const { prose, dropped } = filterUnlicensedRelationalProse(escaped, surviving, NAMES);
    expect(prose).toBeUndefined();
    expect(dropped[0].reason).toMatch(/no licensed relation between/);
  });

  it('drops it however the interaction is worded', () => {
    // The point of the positional rule: no synonym helps.
    for (const verb of ['further supported by', 'works alongside', 'is echoed by',
      'finds an ally in', 'is picked up by', 'sits comfortably with']) {
      const s = `The dCS Rossini Apex is detailed and ${verb} the Acora QRC-2.`;
      expect(filterUnlicensedRelationalProse(s, surviving, NAMES).prose).toBeUndefined();
    }
  });
});

describe('LIVE ESCAPE 2 — the second component arrived as a pronoun', () => {
  const A: AttributeRecord[] = [
    attr('dCS Rossini Apex', 'smooth_detailed', 'detailed', 'brand', 'brand'),
    attr('ARC ref 5', 'smooth_detailed', 'smooth', 'model'),
  ];
  const SET: RelationSet = { status: 'established', relations: [
    { components: ['dCS Rossini Apex', 'ARC ref 5'], axis: 'smooth_detailed',
      kind: 'counterweight', premises: [0, 1] },
  ] };
  const surviving = licensedRelations(SET, A);

  it('licenses the relation, brand-scoped', () => {
    expect(surviving).toHaveLength(1);
    expect(surviving[0].licensedScope).toBe('brand');
  });

  it('drops the exact published pair — scope survives the pronoun', () => {
    // Shipped 2026-08-17. `This` carried the dCS across the sentence boundary,
    // so only ARC was named, the pair check never ran, and a brand-scoped
    // claim was asserted of the product.
    const escaped = 'The dCS Rossini Apex offers a detailed and slightly cool presentation. '
      + 'This is counterweighted by the ARC ref 5, which delivers smoother sound.';
    const { prose, dropped } = filterUnlicensedRelationalProse(escaped, surviving, NAMES);
    expect(prose).toBe('The dCS Rossini Apex offers a detailed and slightly cool presentation.');
    expect(dropped[0].reason).toMatch(/brand-scoped relation asserted of the product/);
  });

  it('publishes the same anaphoric sentence once the maker is attributed', () => {
    const attributed = 'dCS designs tend toward a detailed presentation. '
      + 'This is counterweighted by the ARC ref 5, whose smoother character '
      + 'is described as balancing it.';
    expect(filterUnlicensedRelationalProse(attributed, surviving, NAMES).prose)
      .toBe(attributed);
  });

  it('resolves anaphora to an UNLICENSED antecedent and drops it', () => {
    const other: AttributeRecord[] = [
      attr('Butler Monads', 'elastic_controlled', 'controlled', 'model'),
      attr('Acora QRC-2', 'airy_closed', 'airy', 'model'),
    ];
    const none = licensedRelations({ status: 'none_establishable', relations: [] }, other);
    const s = 'The Butler Monads deliver controlled dynamics. '
      + 'It is complemented by the Acora QRC-2.';
    const { prose } = filterUnlicensedRelationalProse(s, none, NAMES);
    expect(prose).toBe('The Butler Monads deliver controlled dynamics.');
  });
});

describe('MIXED PARAGRAPH — only the licensed relational content survives', () => {
  const A: AttributeRecord[] = [
    attr('dCS Rossini Apex', 'warm_bright', 'bright', 'model'),
    attr('ARC ref 5', 'warm_bright', 'warm', 'model'),
    attr('Butler Monads', 'elastic_controlled', 'controlled', 'model'),
    attr('Acora QRC-2', 'airy_closed', 'airy', 'model'),
  ];
  const SET: RelationSet = { status: 'established', relations: [
    { components: ['dCS Rossini Apex', 'ARC ref 5'], axis: 'warm_bright',
      kind: 'counterweight', premises: [0, 1] },
    { components: ['Butler Monads', 'Acora QRC-2'], axis: 'elastic_controlled',
      kind: 'reinforcement', premises: [2, 3] },   // non-commensurable → rejected
  ] };
  const surviving = licensedRelations(SET, A);

  it('licenses exactly one of the two', () => {
    expect(surviving).toHaveLength(1);
    expect(surviving[0].components).toEqual(['dCS Rossini Apex', 'ARC ref 5']);
  });

  it('keeps the licensed relation, the single-component sentence, and nothing else', () => {
    const para = 'The dCS Rossini Apex leans bright, which the ARC ref 5 counterbalances. '
      + 'The Butler Monads bring control that the Acora QRC-2 turns into an airy stage. '
      + 'The Acora QRC-2 is a floorstanding design.';
    const { prose, dropped } = filterUnlicensedRelationalProse(para, surviving, NAMES);
    expect(prose).toContain('counterbalances');
    expect(prose).toContain('floorstanding design');
    expect(prose).not.toContain('airy stage');
    expect(dropped).toHaveLength(1);
  });
});

describe('POSITIVE CONTROLS — the rule must not silence Describe', () => {
  const surviving = licensedRelations({ status: 'none_establishable', relations: [] }, []);

  it('publishes per-component description with no relations at all', () => {
    const d = 'The dCS Rossini Apex is a Ring DAC design. '
      + 'The ARC ref 5 is a tube line stage. '
      + 'The Butler Monads are hybrid monoblocks. '
      + 'The Acora QRC-2 is a floorstanding loudspeaker.';
    expect(filterUnlicensedRelationalProse(d, surviving, NAMES).prose).toBe(d);
  });

  it('publishes a system-level statement naming no component', () => {
    const v = 'Nothing here obviously needs changing.';
    expect(filterUnlicensedRelationalProse(v, surviving, NAMES).prose).toBe(v);
  });

  it('publishes an anaphoric sentence that stays on one component', () => {
    const a = 'The Acora QRC-2 uses a stone enclosure. This points toward low cabinet contribution.';
    expect(filterUnlicensedRelationalProse(a, surviving, NAMES).prose).toBe(a);
  });
});

/**
 * Brand attribution is COMPONENT-LOCAL.
 *
 * The sentence-level check let attribution for one component license an
 * unattributed product claim about another. Live escape, 2026-08-18:
 *
 *   "...the cool, transparent output of the dCS pairs with the ARC's warmer
 *    tonal tendencies, providing a balanced sound signature."
 *
 * The dCS premise is brand-scoped and the sentence asserts a product fact
 * about it. It published because "tendencies" appeared later, attached to the
 * ARC.
 */
describe('SCOPE PRECISION — attribution cannot reach across a sentence', () => {
  const A: AttributeRecord[] = [
    attr('dCS Rossini Apex', 'warm_bright', 'cool', 'brand', 'brand'),
    attr('ARC ref 5', 'warm_bright', 'warm', 'model'),
  ];
  const SET: RelationSet = { status: 'established', relations: [
    { components: ['dCS Rossini Apex', 'ARC ref 5'], axis: 'warm_bright',
      kind: 'counterweight', premises: [0, 1] },
  ] };
  const surviving = licensedRelations(SET, A);

  it('licenses the relation as brand-scoped on dCS alone', () => {
    expect(surviving[0].licensedScope).toBe('brand');
    expect(surviving[0].brandScoped).toEqual(['dCS Rossini Apex']);
  });

  it('drops the exact live escape', () => {
    const escaped = 'The dCS Rossini Apex and ARC ref 5 form a complementary pairing, '
      + "where the cool, transparent output of the dCS pairs with the ARC's warmer "
      + 'tonal tendencies, providing a balanced sound signature.';
    const { prose, dropped } = filterUnlicensedRelationalProse(escaped, surviving, NAMES);
    expect(prose).toBeUndefined();
    expect(dropped[0].reason).toContain('dCS Rossini Apex');
  });

  it('publishes the same claim when attribution is attached to dCS', () => {
    const fixed = 'dCS designs tend toward a cool, transparent presentation, which the '
      + "ARC ref 5's warmer character counterbalances.";
    expect(filterUnlicensedRelationalProse(fixed, surviving, NAMES).prose).toBe(fixed);
  });

  it('accepts the other attribution forms', () => {
    for (const framing of [
      'dCS components are described as cool, which the ARC ref 5 counterbalances.',
      'Designs from dCS lean toward coolness, which the ARC ref 5 counterbalances.',
      'dCS typically leans cool, which the ARC ref 5 counterbalances.',
    ]) {
      expect(filterUnlicensedRelationalProse(framing, surviving, NAMES).prose).toBe(framing);
    }
  });

  it('is not satisfied by attribution belonging to the other component', () => {
    const wrong = "The dCS Rossini Apex is cool, offsetting the ARC ref 5's warm tendencies.";
    expect(filterUnlicensedRelationalProse(wrong, surviving, NAMES).prose).toBeUndefined();
  });
});

describe('two brand-scoped components need two attributions', () => {
  const A: AttributeRecord[] = [
    attr('dCS Rossini Apex', 'warm_bright', 'cool', 'brand', 'brand'),
    attr('Acora QRC-2', 'warm_bright', 'neutral', 'brand', 'brand'),
  ];
  const SET: RelationSet = { status: 'established', relations: [
    { components: ['dCS Rossini Apex', 'Acora QRC-2'], axis: 'warm_bright',
      kind: 'reinforcement', premises: [0, 1] },
  ] };
  const surviving = licensedRelations(SET, A);

  it('marks both components brand-scoped', () => {
    expect(surviving[0].brandScoped).toEqual(['dCS Rossini Apex', 'Acora QRC-2']);
  });

  it('drops when only one is attributed', () => {
    const half = 'dCS designs lean cool, reinforced by the Acora QRC-2 which is also neutral.';
    const { prose, dropped } = filterUnlicensedRelationalProse(half, surviving, NAMES);
    expect(prose).toBeUndefined();
    expect(dropped[0].reason).toContain('Acora QRC-2');
    expect(dropped[0].reason).not.toContain('dCS');
  });

  it('publishes when both are attributed', () => {
    const both = 'dCS designs lean cool, reinforced by Acora components which typically '
      + 'sit neutral.';
    expect(filterUnlicensedRelationalProse(both, surviving, NAMES).prose).toBe(both);
  });
});

describe('anaphora carries attribution from where the claim was made', () => {
  const A: AttributeRecord[] = [
    attr('dCS Rossini Apex', 'warm_bright', 'cool', 'brand', 'brand'),
    attr('ARC ref 5', 'warm_bright', 'warm', 'model'),
  ];
  const SET: RelationSet = { status: 'established', relations: [
    { components: ['dCS Rossini Apex', 'ARC ref 5'], axis: 'warm_bright',
      kind: 'counterweight', premises: [0, 1] },
  ] };
  const surviving = licensedRelations(SET, A);

  it('publishes when the antecedent sentence attributed the brand claim', () => {
    const ok = 'dCS designs tend toward a cool balance. This is counterbalanced by the '
      + 'ARC ref 5.';
    expect(filterUnlicensedRelationalProse(ok, surviving, NAMES).prose).toBe(ok);
  });

  it('drops when the antecedent asserted it of the product', () => {
    const bad = 'The dCS Rossini Apex is cool and transparent. This is counterbalanced '
      + 'by the ARC ref 5.';
    const { prose } = filterUnlicensedRelationalProse(bad, surviving, NAMES);
    expect(prose).toBe('The dCS Rossini Apex is cool and transparent.');
  });
});

describe('CONTROL — product-scoped relations are unaffected', () => {
  const A: AttributeRecord[] = [
    attr('ARC ref 5', 'warm_bright', 'warm', 'model'),
    attr('Butler Monads', 'warm_bright', 'neutral', 'model'),
  ];
  const SET: RelationSet = { status: 'established', relations: [
    { components: ['ARC ref 5', 'Butler Monads'], axis: 'warm_bright',
      kind: 'counterweight', premises: [0, 1] },
  ] };
  const surviving = licensedRelations(SET, A);

  it('needs no attribution at all', () => {
    expect(surviving[0].licensedScope).toBe('product');
    const plain = 'The ARC ref 5 adds warmth, which the Butler Monads keep in check.';
    expect(filterUnlicensedRelationalProse(plain, surviving, NAMES).prose).toBe(plain);
  });
});
