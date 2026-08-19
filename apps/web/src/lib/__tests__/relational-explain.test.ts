import { describe, it, expect } from 'vitest';
import {
  validateRelations, licensedRelations, relationTier, permittedQuestionType,
  questionViolations, overclaimViolations, stripOverclaims,
  questionIntroducesConcern, OPEN_DIAGNOSTIC_QUESTION,
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
    expect(permittedQuestionType('no_change')).toBe('open_diagnostic');
    expect(permittedQuestionType('constraint')).toBe('directional');
    expect(permittedQuestionType('indeterminate')).toBe('missing_evidence');
  });

  it('CASE G: catches the exact production violation', () => {
    const q = 'Would the listener prefer a greater emphasis on warmth, and have they considered tube rolling or different cables?';
    const v = questionViolations(q, 'open_diagnostic');
    expect(v).toContain('directional question emitted under a no-change verdict');
    expect(v).toContain('addresses the listener in the third person');
  });

  it('permits a scoped diagnostic where a concern was established', () => {
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

/**
 * Production regressions, pinned verbatim.
 *
 * Both sentences below were emitted by the promoted D-12 build against real
 * input while `overclaimViolations` sat in this module, fully tested and never
 * called. They are kept as literal strings rather than paraphrases because the
 * defect was never that the rule was wrong — it was that the rule was not
 * reachable from the pipeline, and a paraphrase would not have caught the verb
 * the model actually chose.
 */
describe('D-12 §6 — the production sentences that got through', () => {
  const BETA_VERDICT =
    'The system appears deliberately voiced, with components chosen to maximize '
    + 'resolution and balance tonal characteristics despite some inherent mismatches '
    + 'in system goals.';

  const ZORBLAX_VERDICT =
    'Indeterminate — The unverified Zorblax ZX1 5 watt SET amplifier is pivotal in '
    + 'defining system character and needs more information.';

  it('refuses the beta verdict as an intent claim', () => {
    expect(overclaimViolations(BETA_VERDICT)[0].kind).toBe('intent');
  });

  it('refuses an importance claim about an unverified component', () => {
    // No relation can name Zorblax — it does not exist — so nothing licenses
    // calling it pivotal, however hedged the surrounding sentence.
    expect(overclaimViolations(ZORBLAX_VERDICT)[0].kind).toBe('importance');
  });

  it('still refuses it when other components hold relations', () => {
    expect(overclaimViolations(ZORBLAX_VERDICT, {
      componentsInRelations: ['dCS Rossini Apex', 'ARC ref 5'],
    })[0].kind).toBe('importance');
  });

  it('catches the intent claim across a changed verb', () => {
    // "voiced" and "matched" were not in the original verb list; the claim is
    // the adverb of intention, not the participle it lands on.
    for (const v of ['voiced', 'matched', 'paired', 'assembled', 'curated']) {
      expect(overclaimViolations(`The system was deliberately ${v} for this room.`)[0]?.kind)
        .toBe('intent');
    }
  });

  it('catches a purpose clause attached to the components', () => {
    expect(overclaimViolations('The components were chosen to maximize resolution.')[0].kind)
      .toBe('intent');
  });
});

describe('stripOverclaims removes the sentence, not the assessment', () => {
  const PROSE =
    'The system appears deliberately voiced, with components chosen to maximize resolution. '
    + 'The dCS sets a high-resolution tone, counterbalanced by the ARC preamplifier.\n\n'
    + 'This system trades some warmth for detail and dynamic control.';

  it('drops only the offending sentence', () => {
    const { prose, removed } = stripOverclaims(PROSE);
    expect(removed).toHaveLength(1);
    expect(prose).not.toContain('deliberately voiced');
    expect(prose).toContain('counterbalanced by the ARC preamplifier');
    expect(prose).toContain('trades some warmth');
  });

  it('preserves paragraph structure', () => {
    expect(stripOverclaims(PROSE).prose?.split('\n\n')).toHaveLength(2);
  });

  it('leaves fully licensed prose byte-identical', () => {
    const clean = 'The chain counterweights itself on tonal balance.\n\nNothing here obviously needs changing.';
    expect(stripOverclaims(clean).prose).toBe(clean);
  });

  it('returns undefined rather than an empty string when everything goes', () => {
    expect(stripOverclaims('The system was deliberately voiced.').prose).toBeUndefined();
  });

  it('keeps an importance claim a relation licenses', () => {
    const s = 'The Acora QRC-2 is central to the result.';
    expect(stripOverclaims(s, { componentsInRelations: ['Acora QRC-2'] }).prose).toBe(s);
  });
});

/**
 * Second round of production sentences, from the re-run after §6 was wired.
 * The adverb+participle rule caught "deliberately voiced" and missed the same
 * claim in adjectival form.
 */
describe('D-12 §6 — intent claims that changed grammar', () => {
  it('refuses an adjectival intent claim', () => {
    expect(overclaimViolations(
      'The overall performance suggests a deliberate architectural choice rather than a deficiency.',
    )[0].kind).toBe('intent');
  });

  it('refuses "this system is designed to…"', () => {
    expect(overclaimViolations(
      'This system is designed to deliver high-resolution sound with a focus on spatial accuracy.',
    )[0].kind).toBe('intent');
  });

  it('PERMITS a manufacturer design fact about a component', () => {
    // The rule is about who assembled the system, not about how a box was
    // engineered. Blocking this would remove Describe evidence Audio XX holds.
    expect(overclaimViolations('The Rossini Apex DAC is designed to minimise jitter.')).toEqual([]);
    expect(overclaimViolations('The Butler MONAD is built to drive difficult loads.')).toEqual([]);
  });
});

/**
 * Production, immediately after a no-change verdict:
 *
 *   "Are you experiencing any listening fatigue or a lack of sonic warmth in
 *    your sessions?"
 *
 * Structurally a diagnostic, and still an invitation to find two problems the
 * assessment had just declined to find.
 */
describe('a no-change verdict may not seed a hypothesis', () => {
  it('rejects the exact production question', () => {
    expect(questionViolations(
      'Are you experiencing any listening fatigue or a lack of sonic warmth in your sessions?',
      'open_diagnostic',
    )).toContain('question seeds a concern the assessment did not establish');
  });

  it('rejects a deficiency frame even with no named quality', () => {
    expect(questionIntroducesConcern('Do you find it too much at higher volumes?')).toBe(true);
  });

  it('rejects a named quality even in an open frame', () => {
    expect(questionIntroducesConcern('What do you make of the brightness?')).toBe(true);
  });

  it('accepts the open question', () => {
    expect(questionViolations(OPEN_DIAGNOSTIC_QUESTION, 'open_diagnostic')).toEqual([]);
    expect(questionIntroducesConcern(OPEN_DIAGNOSTIC_QUESTION)).toBe(false);
  });

  it('accepts an open question about what the listener notices', () => {
    expect(questionViolations(
      'What stands out to you most when you sit down to listen?', 'open_diagnostic',
    )).toEqual([]);
  });

  it('still permits a named quality under a CONSTRAINT verdict', () => {
    // The rule bounds questions to established findings; where a concern was
    // established, naming it is the point.
    expect(questionViolations(
      'Would you like options for an amplifier with more headroom?', 'directional',
    )).toEqual([]);
  });
});

/**
 * PHASE 2 — every observed production escape after a no-change verdict.
 *
 * Each one is technically a question and each one presupposes a change the
 * assessment declined to recommend. "Improve" names no perceptual quality and
 * "seeking to" is not a deficiency frame, so the earlier guards let them past.
 */
describe('no_change admits no change-seeking question', () => {
  const ESCAPES = [
    'Is there anything in the current sound character that you are seeking to adjust or improve upon?',
    "Is there an aspect of your listening experience you're dissatisfied with, or is there a specific quality you're seeking to enhance?",
    "What, if any, aspects of your system's sound are you looking to change or improve upon?",
    'What aspects of the system\'s performance, if any, are you seeking to improve, or are you entirely satisfied with its current character?',
    'Are there any specific areas of the sound that you feel could improve?',
    'Would you like more warmth in the presentation?',
  ];
  for (const q of ESCAPES) {
    it(`refuses: "${q.slice(0, 56)}…"`, () => {
      expect(questionViolations(q, 'open_diagnostic'))
        .toContain('question seeds a concern the assessment did not establish');
    });
  }

  it('still accepts genuinely open questions', () => {
    for (const q of [
      OPEN_DIAGNOSTIC_QUESTION,
      'What stands out to you most when you sit down to listen?',
      'What do you notice first with music you know well?',
      'Is there anything about how it sounds that you are unsure of?',
    ]) {
      expect(questionViolations(q, 'open_diagnostic')).toEqual([]);
    }
  });

  it('permits change language under a CONSTRAINT verdict', () => {
    // Where a constraint was established, naming the remedy is the point.
    expect(questionViolations(
      'Would you like options for an amplifier with more headroom?', 'directional',
    )).toEqual([]);
  });
});

/**
 * PHASE 3 — claim intensity may not exceed evidence authority.
 *
 * Production, about a component whose only evidence is corroborated existence:
 * "This system provides a brilliantly detailed and precise sonic profile."
 * Model memory establishes a direction, never a degree.
 */
describe('tier-bounded intensity', () => {
  const WEAK = { 'dCS Rossini Apex': 'model', 'Acora QRC-2': 'user' };
  const CURATED = { 'Leben CS600X': 'catalog' };

  it('refuses the exact production sentence', () => {
    expect(overclaimViolations(
      'The dCS Rossini Apex is brilliantly detailed and precise.',
      { basisByComponent: WEAK },
    )[0].kind).toBe('intensity');
  });

  it('refuses a superlative on model-tier evidence', () => {
    expect(overclaimViolations(
      'The Acora QRC-2 gives the finest staging in the chain.',
      { basisByComponent: WEAK },
    )[0].kind).toBe('intensity');
  });

  it('PERMITS the ordinary characterisation the same evidence supports', () => {
    // The rule bounds degree, not subject matter. Direction survives.
    for (const s of [
      'The dCS Rossini Apex leans detailed and precise.',
      'The dCS Rossini Apex is detailed, and that shapes the chain.',
      'The Acora QRC-2 contributes an airy presentation.',
    ]) {
      expect(overclaimViolations(s, { basisByComponent: WEAK })).toEqual([]);
    }
  });

  it('PERMITS strong language where curated evidence supports it', () => {
    // Audio XX holding its own data is the condition under which a strong
    // claim can be earned. Flattening everything to one register would be a
    // different failure, not a fix.
    expect(overclaimViolations(
      'The Leben CS600X is exceptionally rhythmically assured.',
      { basisByComponent: CURATED },
    )).toEqual([]);
  });

  it('applies no tier check when the basis is unknown', () => {
    expect(overclaimViolations('It is brilliantly detailed.')).toEqual([]);
  });
});

/**
 * System intent — an ontology rule, not a longer word list.
 *
 * A system is a collection of components; purposes belong to people. The
 * escapes below all survived three earlier rounds of adjective-matching
 * because each used a different word for the same claim.
 */
describe('a system cannot hold an intention', () => {
  it.each([
    'The chain is intended to deliver high resolution.',
    'The system delivers its intended sound signature.',
    "The system's choices work harmoniously to deliver its signature.",
    'The system aims for spatial precision above warmth.',
    'This setup seeks a warmer balance than most.',
    'The components pursue clarity above all.',
    'The configuration prefers detail to body.',
    'The chain wants for nothing in the treble.',
  ])('refuses: %s', (prose) => {
    expect(overclaimViolations(prose)[0]?.kind).toBe('intent');
  });

  it.each([
    'The system produces an expansive soundstage.',
    'The chain reinforces its own direction.',
    'The ARC ref 5 counterbalances the dCS Rossini Apex.',
    'The system exhibits tonal consistency across the range.',
    'This chain constrains dynamic range at higher levels.',
    'Nothing here obviously needs changing.',
  ])('PERMITS legitimate system-level analysis: %s', (prose) => {
    // Behavioural predicates stay available. The rule removes wanting, not
    // describing — otherwise it would silence the analysis itself.
    expect(overclaimViolations(prose)).toEqual([]);
  });
});
