import { describe, it, expect } from 'vitest';
import {
  validateRelations, licensedRelations, relationTier, permittedQuestionType,
  questionViolations, overclaimViolations,
  type AttributeRecord, type RelationSet,
} from '../relational-explain';

/**
 * D-12 — Relational Licensing. The Explain layer produced enumeration wearing
 * connectives: four independent characterisations joined by "complements" and
 * "counterweighing". These pin the operation that separates a relation from a
 * list, and the rule that stops two weak premises becoming one strong claim.
 */
const attr = (component: string, axis: string, value: string,
  tier: AttributeRecord['tier'], scope: AttributeRecord['scope'] = 'product'): AttributeRecord =>
  ({ component, axis, value, tier, scope });

describe('a relation must rest on commensurable premises', () => {
  const A = [
    attr('dCS Rossini Apex', 'warm_bright', 'bright', 'brand', 'brand'),
    attr('ARC ref 5', 'warm_bright', 'warm', 'model'),
    attr('Butler Monads', 'power_load', '100W', 'user'),
  ];

  it('licenses a counterweight on one shared axis', () => {
    const set: RelationSet = { status: 'established', relations: [
      { components: ['dCS Rossini Apex', 'ARC ref 5'], axis: 'warm_bright', kind: 'counterweight', premises: [0, 1] },
    ] };
    expect(validateRelations(set, A)).toEqual([]);
  });

  it('refuses a relation across different axes', () => {
    // "warm vs powerful" is not an interaction, however fluent the sentence.
    const set: RelationSet = { status: 'established', relations: [
      { components: ['ARC ref 5', 'Butler Monads'], axis: 'warm_bright', kind: 'reinforcement', premises: [1, 2] },
    ] };
    expect(validateRelations(set, A)[0].rule).toBe('commensurability');
  });

  it('refuses a relation whose premises are not held', () => {
    const set: RelationSet = { status: 'established', relations: [
      { components: ['dCS Rossini Apex', 'ARC ref 5'], axis: 'warm_bright', kind: 'counterweight', premises: [0, 99] },
    ] };
    expect(validateRelations(set, A)[0].rule).toBe('premises');
  });

  it('refuses a relation built from one component twice (enumeration)', () => {
    const B = [attr('X', 'warm_bright', 'warm', 'catalog'), attr('X', 'warm_bright', 'warm', 'catalog')];
    const set: RelationSet = { status: 'established', relations: [
      { components: ['X', 'X'], axis: 'warm_bright', kind: 'reinforcement', premises: [0, 1] },
    ] };
    expect(validateRelations(set, B)[0].rule).toBe('counterfactual');
  });
});

describe('tier propagation — two weak premises cannot make a strong claim', () => {
  const A = [
    attr('P', 'warm_bright', 'bright', 'model'),
    attr('Q', 'warm_bright', 'warm', 'user'),
    attr('R', 'warm_bright', 'warm', 'catalog'),
  ];

  it('a relation is no stronger than its weaker premise', () => {
    expect(relationTier(A[0], A[1])).toBe('user');
    expect(relationTier(A[0], A[2])).toBe('model');
    expect(relationTier(A[2], A[2])).toBe('catalog');
  });

  it('refuses a claimed tier above what the premises license', () => {
    const set: RelationSet = { status: 'established', relations: [
      { components: ['P', 'Q'], axis: 'warm_bright', kind: 'counterweight', premises: [0, 1], tier: 'catalog' },
    ] };
    expect(validateRelations(set, A)[0].rule).toBe('tier');
  });

  it('MIXED TIERS: bounds each relation separately, never the whole assessment', () => {
    // Case F. One strong relation and one weak relation coexist; the weak one
    // must not drag the strong one down, and vice versa.
    const set: RelationSet = { status: 'established', relations: [
      { components: ['P', 'R'], axis: 'warm_bright', kind: 'counterweight', premises: [0, 2] },
      { components: ['P', 'Q'], axis: 'warm_bright', kind: 'counterweight', premises: [0, 1] },
    ] };
    const out = licensedRelations(set, A);
    expect(out).toHaveLength(2);
    expect(out[0].licensedTier).toBe('model');
    expect(out[1].licensedTier).toBe('user');
  });
});

describe('none establishable is a state, not a relation kind', () => {
  it('validates cleanly and yields no relations', () => {
    const set: RelationSet = { status: 'none_establishable', relations: [] };
    expect(validateRelations(set, [])).toEqual([]);
    expect(licensedRelations(set, [])).toEqual([]);
  });

  it('carries no penalty — it is a valid outcome, not a failure', () => {
    // Case D/E guard: refusing to establish a relation must never be treated
    // as an error the model should have avoided.
    const set: RelationSet = { status: 'none_establishable', relations: [] };
    expect(validateRelations(set, [attr('Z', 'warm_bright', 'warm', 'user')])).toHaveLength(0);
  });
});

describe('the action verdict fixes the question type before any prose exists', () => {
  it('maps each verdict to exactly one permitted type', () => {
    expect(permittedQuestionType('no_change')).toBe('diagnostic');
    expect(permittedQuestionType('constraint')).toBe('directional');
    expect(permittedQuestionType('indeterminate')).toBe('missing_evidence');
  });

  it('CASE G: catches the exact production violation', () => {
    const q = 'Would the listener prefer a greater emphasis on warmth, and have they considered tube rolling or different cables?';
    const v = questionViolations(q, 'diagnostic');
    expect(v).toContain('directional question emitted under a no-change verdict');
    expect(v).toContain('addresses the listener in the third person');
  });

  it('permits a diagnostic question in second person', () => {
    expect(questionViolations(
      'Is anything about the sound currently feeling lean, forward or dynamically held back?', 'diagnostic',
    )).toEqual([]);
  });

  it('permits a directional question when a constraint was established', () => {
    expect(questionViolations(
      'Would you like options for an amplifier with more current into that load?', 'directional',
    )).toEqual([]);
  });
});

describe('structural and evaluative claims may not outrun their evidence', () => {
  it('refuses claims about the listener’s intent', () => {
    expect(overclaimViolations('The system appears purposefully constructed to balance detail and warmth.')[0].kind)
      .toBe('intent');
  });

  it('refuses rank and superlative claims', () => {
    expect(overclaimViolations('It offers impeccable staging and sets a benchmark for clarity.')[0].kind)
      .toBe('rank');
  });

  it('refuses an importance claim about a component no relation names', () => {
    expect(overclaimViolations('The Acora QRC-2 plays a crucial role in the result.')[0].kind)
      .toBe('importance');
  });

  it('PERMITS an importance claim where a relation established it', () => {
    // The rule restricts strength, not subject matter — Audio XX must keep the
    // ability to say a component matters when it has shown that it does.
    expect(overclaimViolations(
      'The Acora QRC-2 plays a crucial role in the result.',
      { componentsInRelations: ['Acora QRC-2'] },
    )).toEqual([]);
  });

  it('leaves ordinary licensed judgment untouched', () => {
    expect(overclaimViolations(
      'The system leans toward resolution, and nothing here obviously needs changing.',
    )).toEqual([]);
  });
});
