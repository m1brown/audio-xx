/**
 * D-12 — Relational Licensing.
 *
 * The Explain layer kept producing enumeration dressed as analysis:
 *
 *   "The Rossini is precise. The ARC likely adds warmth. The Butler further
 *    complements this. Finally the Acora realises the intent."
 *
 * Four independent characterisations joined by connectives. Inserting the word
 * "complements" between two sentences does not make them a relation, and a
 * schema change alone did not fix it — the container changed shape while the
 * operation stayed the same. This module supplies the operation.
 *
 * A relation is licensed only when all four hold:
 *
 *   (a) COMMENSURABILITY  both attributes sit on the same axis or in the same
 *       physical domain. "Warm vs powerful" is not a relation; "warm vs warm"
 *       and "watts vs sensitivity" are.
 *   (b) TYPED             the relation is reinforcement, counterweight or
 *       constraint. There is no fourth kind — see `RelationSet` for how the
 *       absence of any relation is expressed.
 *   (c) COUNTERFACTUAL    the claim changes if either attribute changes. This
 *       is the test enumeration fails: altering B says nothing about a claim
 *       made of A alone. Evaluated internally; never required in the prose.
 *   (d) TIER PROPAGATION  the relation is no stronger than its WEAKER premise.
 *
 * (d) is the anti-laundering rule. Two hedged observations must not combine
 * into one confident causal sentence — a sophisticated claim built from
 * unlicensed premises is still unlicensed.
 *
 * ── Fit with existing doctrine ──────────────────────────────────────
 * D-7  no claim stronger than its source — D-12 extends it from single claims
 *      to JOINS, which is where D-7 previously leaked.
 * D-11 no diagnosis without licensed evidence — D-12 is the sibling rule: no
 *      INTERACTION without licensed evidence.
 * Describe → Explain → Evaluate — D-12 is the admission predicate for Explain.
 *      Describe needs one licensed attribute; Explain needs two commensurable
 *      ones and a relation between them.
 * Playbook §8 (counterfactual thinking) — already governing. Formalised here,
 *      not introduced.
 *
 * IMPORTANT: D-12 bounds the strength of a SPECIFIC relation, never of the
 * whole assessment. A system may hold one catalog-tier relation and one
 * model-tier relation in the same paragraph, each at its own authority. The
 * failure mode to avoid is the over-correction that made Audio XX mute:
 * this rule limits how strongly a thing may be said, not whether it may be
 * said at all.
 */

export type EvidenceTier = 'catalog' | 'brand' | 'model' | 'user';

/** Ordered weakest→strongest. Used only to take a minimum. */
const TIER_RANK: Record<EvidenceTier, number> = { user: 0, model: 1, brand: 2, catalog: 3 };

export type RelationKind = 'reinforcement' | 'counterweight' | 'constraint';

/**
 * One attribute Audio XX actually holds about one component.
 *
 * `scope` is what stops brand evidence from licensing a product claim. The dCS
 * BrandProfile supports "dCS designs are associated with a neutral-to-cool
 * balance"; it does not support "the Rossini Apex IS neutral-to-cool". Both are
 * usable — they are not interchangeable.
 */
export interface AttributeRecord {
  component: string;
  /** Axis or physical domain: 'warm_bright', 'power_load', etc. */
  axis: string;
  value: string;
  tier: EvidenceTier;
  scope: 'product' | 'brand';
}

/**
 * A claimed interaction, with the premises it rests on.
 *
 * `premises` is what makes validation possible. Without it the model could
 * declare an axis and a tier and we would be trusting the same self-report the
 * corroboration work already proved untrustworthy — a component alternated
 * between known and unknown on identical input. A relation must point at the
 * attributes it was built from so the check can be run against evidence rather
 * than against an assertion.
 */
export interface Relation {
  components: [string, string];
  axis: string;
  kind: RelationKind;
  /** Indices into the attribute set — one premise per component. */
  premises: [number, number];
  /** The model's claimed tier. Advisory only; the validator recomputes it. */
  tier?: EvidenceTier;
}

/**
 * The relation set for one assessment.
 *
 * `none_establishable` is a STATE of the set, not a kind of relation. Modelling
 * it as a relation would let it sit alongside positive relations and compete
 * with them, which is incoherent: either we established something or we did
 * not. Absence is explicit and carries no penalty — an assessment that
 * establishes no interaction is a valid outcome, not a failure to try.
 */
export type RelationSet =
  | { status: 'established'; relations: Relation[] }
  | { status: 'none_establishable'; relations: [] };

export interface RelationViolation {
  index: number;
  rule: 'commensurability' | 'premises' | 'counterfactual' | 'tier';
  detail: string;
}

/** The tier a relation may be asserted at: the weaker of its two premises. */
export function relationTier(a: AttributeRecord, b: AttributeRecord): EvidenceTier {
  return TIER_RANK[a.tier] <= TIER_RANK[b.tier] ? a.tier : b.tier;
}

/**
 * Validate a relation set against the attributes actually held.
 *
 * Returns the violations; an empty array means every relation is licensed.
 * A relation that fails is dropped by the caller — never silently weakened,
 * because a weakened version would still assert an interaction we cannot
 * support.
 */
export function validateRelations(
  set: RelationSet,
  attributes: AttributeRecord[],
): RelationViolation[] {
  if (set.status === 'none_establishable') return [];

  const violations: RelationViolation[] = [];

  set.relations.forEach((r, index) => {
    const [i, j] = r.premises ?? [];
    const a = attributes[i];
    const b = attributes[j];

    // (premises) — the relation must point at real, distinct attributes, one
    // per component. A relation citing the same attribute twice is a claim
    // about one component wearing relational clothing.
    if (!a || !b) {
      violations.push({ index, rule: 'premises', detail: 'premise index does not resolve to a held attribute' });
      return;
    }
    if (i === j) {
      violations.push({ index, rule: 'premises', detail: 'both premises are the same attribute' });
      return;
    }
    const named = new Set(r.components.map((c) => c.toLowerCase().trim()));
    if (!named.has(a.component.toLowerCase().trim()) || !named.has(b.component.toLowerCase().trim())) {
      violations.push({ index, rule: 'premises', detail: 'premises do not belong to the components named in the relation' });
      return;
    }
    if (a.component.toLowerCase().trim() === b.component.toLowerCase().trim()) {
      violations.push({ index, rule: 'counterfactual', detail: 'both premises describe the same component — no interaction exists' });
      return;
    }

    // (a) commensurability
    if (a.axis !== b.axis || r.axis !== a.axis) {
      violations.push({
        index,
        rule: 'commensurability',
        detail: `premises are not on one axis (${a.axis} vs ${b.axis}, relation claims ${r.axis})`,
      });
      return;
    }

    // (d) tier propagation — a declared tier stronger than the weaker premise
    // is exactly the laundering this rule exists to stop.
    const licensed = relationTier(a, b);
    if (r.tier && TIER_RANK[r.tier] > TIER_RANK[licensed]) {
      violations.push({
        index,
        rule: 'tier',
        detail: `claimed ${r.tier} but premises license only ${licensed}`,
      });
    }
  });

  return violations;
}

/** Relations that survived validation, each carrying its licensed tier. */
export function licensedRelations(
  set: RelationSet,
  attributes: AttributeRecord[],
): Array<Relation & { licensedTier: EvidenceTier }> {
  if (set.status === 'none_establishable') return [];
  const bad = new Set(validateRelations(set, attributes).map((v) => v.index));
  return set.relations
    .map((r, index) => ({ r, index }))
    .filter(({ index }) => !bad.has(index))
    .map(({ r }) => ({
      ...r,
      licensedTier: relationTier(attributes[r.premises[0]], attributes[r.premises[1]]),
    }));
}

// ── Question typing ─────────────────────────────────────────────────

export type ActionVerdict = 'no_change' | 'constraint' | 'indeterminate';
export type QuestionType = 'diagnostic' | 'directional' | 'missing_evidence';

/**
 * The action verdict determines the ONLY permitted question type, decided
 * before any prose exists.
 *
 * Production emitted "no urgent need to change anything" and then, in the very
 * next sentence, proposed tube rolling and cables — inventing the deficiency
 * the evaluation had just declined to find. That happened because the question
 * was an independent generative field: nothing bound it to the verdict above
 * it. A directional question after a no-change verdict silently retracts that
 * verdict, which is worse than either sentence alone.
 */
export function permittedQuestionType(verdict: ActionVerdict): QuestionType {
  switch (verdict) {
    case 'no_change': return 'diagnostic';
    case 'constraint': return 'directional';
    case 'indeterminate': return 'missing_evidence';
  }
}

/**
 * Regression guard, not the mechanism.
 *
 * Typing the question structurally is the fix. This catches the case where a
 * question is labelled diagnostic and then written directionally anyway — the
 * same belt-and-braces pattern the licensing validator uses, for the same
 * reason: a declared type is a claim, and claims get checked.
 */
const DIRECTIONAL_MARKERS =
  /\b(?:would you (?:like|prefer|want)|have you considered|thinking of (?:upgrading|changing)|tube[- ]roll|different cables|upgrade path|looking to (?:add|improve))\b/i;

/** Third person about the listener, in a document addressed to them. */
const THIRD_PERSON_MARKERS = /\bthe listener\b/i;

export function questionViolations(question: string, required: QuestionType): string[] {
  const out: string[] = [];
  if (!question?.trim()) return out;
  if (required === 'diagnostic' && DIRECTIONAL_MARKERS.test(question)) {
    out.push('directional question emitted under a no-change verdict');
  }
  if (THIRD_PERSON_MARKERS.test(question)) {
    out.push('addresses the listener in the third person');
  }
  return out;
}

// ── Structural / evaluative overclaiming ────────────────────────────

/**
 * A claim about INTENT, IMPORTANCE or RANK requires evidence of that kind.
 *
 * The prose learned where the guard was looking: sonic adjectives got hedged
 * ("likely warm") while structural and evaluative claims went unhedged
 * ("purposefully constructed", "impeccable staging", "crucial role"). Those
 * carry more authority than any adjective — one asserts the listener's
 * intentions, one asserts causal importance, one asserts rank.
 *
 * Per D-7's own lesson, this restricts STRENGTH, not subject matter. Audio XX
 * may still conclude a system is coherent and say so plainly; it may not claim
 * the listener meant it to be.
 */
export const OVERCLAIM_MARKERS: Array<{ kind: 'intent' | 'importance' | 'rank'; re: RegExp }> = [
  {
    kind: 'intent',
    // Audio XX never knows why someone bought something.
    //
    // The verb list is open on purpose. Production emitted "deliberately
    // VOICED" and "components CHOSEN TO maximize resolution" against a marker
    // set that only knew "deliberately constructed" — the claim survived by
    // changing verb, which is what happens whenever a rule enumerates surface
    // forms. The three shapes below are the claim itself: an adverb of
    // intention attached to any act of system-building; a purpose clause
    // attached to the components; and a direct assertion about what the owner
    // wanted.
    re: new RegExp(
      '\\b(?:purposefully|deliberately|intentionally|carefully|thoughtfully|consciously|'
      + 'meticulously|purposely)\\s+(?:\\w+\\s+)?'
      + '(?:constructed|assembled|chosen|selected|picked|built|curated|voiced|matched|paired|'
      + 'designed|configured|specified|put together)\\b'
      + '|\\b(?:components?|parts|pieces|system|chain)\\b[^.]{0,40}?'
      + '\\b(?:chosen|selected|picked|assembled|matched|voiced)\\s+to\\b'
      + '|\\bchosen (?:to|for)\\b'
      + '|\\bby design\\b'
      + '|\\bthe (?:owner|listener)(?:\\s+\\w+){0,2}\\s+(?:wanted|intended|meant|sought)\\b',
      'i',
    ),
  },
  {
    kind: 'importance',
    // Licensed only when a relation actually names the component.
    re: /\b(?:crucial|pivotal|essential|vital|central|decisive|indispensable)\b/i,
  },
  {
    kind: 'rank',
    re: /\b(?:impeccable|benchmark|reference[- ](?:grade|standard)|world[- ]class|flawless|unrivalled|unrivaled|peerless|exceptional|outstanding|superb|state[- ]of[- ]the[- ]art)\b/i,
  },
];

/**
 * Remove the sentences that overclaim, keep the ones that do not.
 *
 * Proportionality is the whole design here. Falling back to the deterministic
 * licensed answer over a single unearned adverb would throw away an assessment
 * that is otherwise fully licensed — the over-correction that made Audio XX
 * mute once already. Rewriting the sentence in place would mean inventing
 * prose to replace prose, which is how a guard becomes an author.
 *
 * Dropping the offending sentence is the smallest honest operation: what
 * remains was written by the model and is licensed, and what left was never
 * supported. The caller is responsible for what happens when a field empties
 * — see `systemSignature`, which is recomposed from the structured verdict
 * rather than left blank.
 */
export function stripOverclaims(
  prose: string | undefined,
  opts: { componentsInRelations?: string[] } = {},
): { prose: string | undefined; removed: Array<{ kind: string; sentence: string }> } {
  if (!prose?.trim()) return { prose, removed: [] };
  const removed = overclaimViolations(prose, opts);
  if (removed.length === 0) return { prose, removed };

  const dropped = new Set(removed.map((r) => r.sentence.trim()));
  // Paragraph structure is preserved: an assessment whose paragraphs collapse
  // into one block reads as a different document even when every surviving
  // sentence is identical.
  const kept = prose
    .split(/\n\n+/)
    .map((para) => para
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) => !dropped.has(sentence.trim()))
      .join(' ')
      .trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();

  return { prose: kept || undefined, removed };
}

export function overclaimViolations(
  prose: string,
  opts: { componentsInRelations?: string[] } = {},
): Array<{ kind: string; sentence: string }> {
  if (!prose) return [];
  const related = new Set((opts.componentsInRelations ?? []).map((c) => c.toLowerCase()));
  const out: Array<{ kind: string; sentence: string }> = [];

  for (const sentence of prose.split(/(?<=[.!?])\s+/)) {
    for (const { kind, re } of OVERCLAIM_MARKERS) {
      if (!re.test(sentence)) continue;
      // An importance claim is licensed when the sentence concerns a component
      // that a surviving relation actually names — there the importance was
      // established rather than asserted.
      if (kind === 'importance'
        && [...related].some((c) => sentence.toLowerCase().includes(c))) continue;
      out.push({ kind, sentence: sentence.trim() });
      break;
    }
  }
  return out;
}
