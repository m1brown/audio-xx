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

/**
 * Ordered weakest to strongest.
 *
 * `manufacturer` slots between model and brand per the founder's ordering
 * (2026-08-18): curated evidence > manufacturer facts > independent review >
 * model reasoning > listener evidence. `user` is retained as the local name
 * for the listener tier, since it is what every existing premise uses.
 *
 * That brand outranks a manufacturer fact is not a claim that our prose beats
 * their spec sheet — SCOPE settles that, because brand evidence may only make
 * brand-scoped claims and so never competes for a product-level statement.
 */
export type EvidenceTier =
  | 'catalog' | 'brand' | 'manufacturer' | 'independent_review' | 'model' | 'user';

const TIER_RANK: Record<EvidenceTier, number> = {
  user: 0, model: 1, independent_review: 2, manufacturer: 3, brand: 4, catalog: 5,
};

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
  /**
   * Where a premise came from, when its regime requires that to travel.
   *
   * Independent-review premises carry the publication that made the
   * observation and, where the observation was conditioned, the condition. A
   * relation resting on one may not be expressed without them: an unattributed
   * review claim reads as Audio XX's own finding, and a conditioned claim
   * stated flat is a claim the publication never made.
   */
  attribution?: {
    publication?: string;
    sourceUrl?: string;
    condition?: string;
  };
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
  rule: 'commensurability' | 'premises' | 'counterfactual' | 'tier' | 'transfer';
  detail: string;
}

/**
 * Does this premise's finding transfer to the listener's own system?
 *
 * GOVERNING RULE (founder, 2026-08-19):
 *
 *   A `transfer_limited` premise may support a Describe claim with its source
 *   and condition preserved, but may not enter an Explain or Evaluate relation.
 *
 * An observation made through OTHER electronics cannot separate what belongs to
 * the product from what belongs to the chain that produced it. Stereophile
 * heard the Acora QRC-2 "as smooth as silk" driven by Ideon sources and JMF
 * electronics; a counterweight claim against this listener's dCS needs the
 * smoothness to be a property of the QRC-2, and that observation cannot
 * establish it.
 *
 * The rule closes a real escape rather than a theoretical one. Before it, a
 * sentence that named the publication, stated the foreign equipment AND
 * restated the partner at brand scope was PUBLISHED — a system-level
 * counterweight resting entirely on a finding made in someone else's system.
 * Disclosure was being taken for licence: naming the Ideon and JMF gear tells
 * the reader the finding does not transfer, and the sentence then asserted
 * that it does.
 *
 * A condition about the PRODUCT ITSELF — break-in, an input, a mode, a
 * listening level — is `conditioned`, not transfer-limited. It still tells the
 * listener about their own unit, under a stated condition, and continues to
 * license relations.
 */
export function premiseTransfer(a: AttributeRecord): 'direct' | 'conditioned' | 'transfer_limited' {
  const kind = a.attribution?.condition?.split(':')[0]?.trim();
  if (!kind) return 'direct';
  return kind === 'associated_equipment' ? 'transfer_limited' : 'conditioned';
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

    // (transfer) — a finding made through other electronics may be reported,
    // with its source and condition, and may not be reasoned FROM. Checked
    // before commensurability so the rejection reason names the real defect:
    // an axis mismatch would otherwise mask it, as it did on first inspection.
    for (const premise of [a, b]) {
      if (premiseTransfer(premise) === 'transfer_limited') {
        violations.push({
          index,
          rule: 'transfer',
          detail: `${premise.component} premise was observed through other equipment `
            + `(${premise.attribution?.condition}) — it may be described, not reasoned from`,
        });
        return;
      }
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
): LicensedRelation[] {
  if (set.status === 'none_establishable') return [];
  const bad = new Set(validateRelations(set, attributes).map((v) => v.index));
  return set.relations
    .map((r, index) => ({ r, index }))
    .filter(({ index }) => !bad.has(index))
    .map(({ r }) => {
      const a = attributes[r.premises[0]];
      const b = attributes[r.premises[1]];
      const premises = [a, b];
      return {
        ...r,
        licensedTier: relationTier(a, b),
        licensedScope: relationScope(a, b),
        brandScoped: premises.filter((x) => x.scope === 'brand').map((x) => x.component),
        citedPublications: [...new Set(premises
          .filter((x) => x.tier === 'independent_review')
          .map((x) => x.attribution?.publication)
          .filter((p): p is string => !!p))],
        conditions: [...new Set(premises
          .map((x) => x.attribution?.condition)
          .filter((c): c is string => !!c))],
      };
    });
}

// ── Expression licensing ────────────────────────────────────────────

/**
 * A relation's scope is the WEAKER of its premises' scopes.
 *
 * The dCS BrandProfile supports "dCS designs are associated with a
 * neutral-to-cool balance". It does not support "the Rossini APEX IS
 * neutral-to-cool". `AttributeRecord.scope` was written to carry exactly that
 * distinction and was never read by anything — so a brand-scoped premise
 * silently produced product-specific prose, which is D-7 leaking through the
 * one field built to stop it.
 */
export function relationScope(a: AttributeRecord, b: AttributeRecord): 'product' | 'brand' {
  return a.scope === 'brand' || b.scope === 'brand' ? 'brand' : 'product';
}

export interface LicensedRelation extends Relation {
  licensedTier: EvidenceTier;
  licensedScope: 'product' | 'brand';
  /** Components whose contribution rests on brand-scoped evidence. */
  brandScoped: string[];
  /** Publications whose observation underwrites a premise of this relation. */
  citedPublications: string[];
  /** Conditions a premise depends on. Each must survive into the prose. */
  conditions: string[];
}

/** Tokens that identify a component in prose. */
function componentTokens(name: string): string[] {
  return name.split(/\s+/).map((t) => t.replace(/[^\w-]/g, '')).filter((t) => t.length >= 3);
}

/**
 * A DEFINITE reference to this system's component set, as a plural collective.
 *
 * THE ESCAPE THIS CLOSES. The positional rule requires a licence whenever a
 * sentence names or refers to a second component — but it resolved references
 * one at a time, so a claim about ALL of them at once named none of them and
 * walked straight through:
 *
 *   "The components synergize well to produce a consistent and coherent
 *    audio experience."
 *
 * That is an aggregate interaction claim. It asserts more than any two-component
 * sentence would, and it was the one shape that needed no licence at all.
 *
 * The fix is not a synonym list — "synergize" would simply become "work
 * together", then "complement one another", forever. A collective noun phrase
 * REFERS TO every component in the system, so it is resolved to every
 * component, and the existing default-deny rule then does the work unchanged:
 * touching N components requires all N(N-1)/2 pairs to be licensed. No new
 * policy, no predicate vocabulary, nothing about what the sentence claims.
 *
 * DEFINITE is the load-bearing word. "the components", "its components", "all
 * four components", "each component" refer to THIS system's set. A bare plural
 * — "systems leaning toward purely tube-driven components" — is a generic use
 * of the word about other systems entirely, and is left alone.
 */
const COLLECTIVE_REFERENCE =
  /\b(?:the|these|those|its|their|your|our|all|each|every|both|either)\s+(?:\w+['\u2019]?s?[- ]){0,2}(?:components?|parts|pieces|elements|boxes|units)\b/i;

export function referencesComponentSet(sentence: string): boolean {
  return COLLECTIVE_REFERENCE.test(sentence);
}

/**
 * A component's role in the chain, so a role noun can be resolved to a product.
 *
 * THE ESCAPE THIS CLOSES. The positional rule requires a licence when a
 * sentence NAMES a second component. It said nothing about referring to one by
 * its job, so two live sentences walked out of production:
 *
 *   "This synergy likely results in a compelling performance that balances the
 *    dCS's smoothness and the amplifier's robust power supply."
 *   "The system is coherent, with key synergy between the amplifier and
 *    speakers founded on high sensitivity."
 *
 * The first names one component and points at a second by role; the second
 * names none and points at two. Both assert interactions that no surviving
 * relation licensed.
 *
 * This is reference resolution, not vocabulary. "Synergy" is not the problem —
 * it would become "partnership", then "match", then "pairing". The problem is
 * that "the amplifier" IS the Butler Monads, and a sentence saying so in fewer
 * words makes exactly the same claim.
 */
export interface ComponentRole {
  name: string;
  /** Chain role: 'amplifier', 'speaker', 'dac', 'preamplifier', … */
  role: string;
}

/**
 * Role nouns, each mapped to the chain roles it can denote.
 *
 * Definite reference only, exactly as with collective references: "the
 * amplifier" and "your speakers" point at this listener's components, while a
 * bare "amplifier power is worth having" is a generic use of the word.
 */
const ROLE_NOUNS: Array<{ pattern: RegExp; roles: string[] }> = [
  { pattern: /\b(?:the|your|its|their|this)\s+(?:power\s+)?amps?\b/i, roles: ['amplifier', 'integrated'] },
  { pattern: /\b(?:the|your|its|their|this)\s+(?:power\s+)?amplifiers?\b/i, roles: ['amplifier', 'integrated'] },
  { pattern: /\b(?:the|your|its|their|this)\s+(?:pre-?amp|pre-?amplifier|line\s?stage)s?\b/i, roles: ['preamplifier'] },
  { pattern: /\b(?:the|your|its|their|these|those)\s+(?:loud)?speakers?\b/i, roles: ['speaker'] },
  { pattern: /\b(?:the|your|its|their|this)\s+(?:dac|d\/a\s+converter)\b/i, roles: ['dac'] },
  { pattern: /\b(?:the|your|its|their|this)\s+(?:streamer|transport)\b/i, roles: ['streamer', 'dac', 'source'] },
  { pattern: /\b(?:the|your|its|their|this)\s+(?:turntable|record\s+player)\b/i, roles: ['turntable'] },
  { pattern: /\b(?:the|your|its|their|these|those)\s+headphones?\b/i, roles: ['headphone'] },
];

/**
 * Components a sentence points at by role rather than by name.
 *
 * A role noun matching NOTHING in the chain resolves to nothing and is left
 * alone — it is a generic use of the word, not a reference. A role matching
 * SEVERAL components resolves to all of them, because the sentence has not
 * distinguished between them and we must not guess which one it meant.
 */
/** Role words, for detecting a coordination that shares one determiner. */
const ROLE_WORD = '(?:power\\s+)?(?:amps?|amplifiers?|pre-?amps?|pre-?amplifiers?|'
  + 'line\\s?stages?|(?:loud)?speakers?|dacs?|streamers?|transports?|'
  + 'turntables?|headphones?)';

/**
 * Give every member of a coordinated list its own determiner.
 *
 * "the amplifier and speakers" carries ONE "the" across two role nouns, so a
 * pattern requiring a determiner sees the amplifier and misses the speakers —
 * which is how "key synergy between the amplifier and speakers founded on high
 * sensitivity" survived the first version of this rule. Rewriting it to "the
 * amplifier and the speakers" changes nothing about meaning and lets one
 * pattern set handle both shapes.
 */
function distributeDeterminers(sentence: string): string {
  const coordination = new RegExp(
    `\\b(the|your|its|their|these|those)\\s+(${ROLE_WORD}(?:\\s*(?:,|and|or)\\s+${ROLE_WORD})+)\\b`,
    'gi');
  return sentence.replace(coordination, (_m, det: string, list: string) =>
    list.split(/\s*(?:,|\band\b|\bor\b)\s+/i)
      .filter(Boolean)
      .map((part) => `${det} ${part.trim()}`)
      .join(' and '));
}

export function rolesIn(sentence: string, roles: ComponentRole[]): string[] {
  const expanded = distributeDeterminers(sentence);
  const hits: string[] = [];
  for (const { pattern, roles: denoted } of ROLE_NOUNS) {
    if (!pattern.test(expanded)) continue;
    for (const c of roles) {
      if (denoted.includes(c.role.toLowerCase().trim())) hits.push(c.name);
    }
  }
  return [...new Set(hits)];
}

function namesIn(sentence: string, componentNames: string[]): string[] {
  return componentNames.filter((n) =>
    componentTokens(n).some((t) => new RegExp(`\\b${t}\\b`, 'i').test(sentence)));
}

const pairKey = (a: string, b: string) =>
  [a.toLowerCase().trim(), b.toLowerCase().trim()].sort().join('||');

/**
 * Remove Explain prose that no surviving relation licenses.
 *
 * GOVERNING INVARIANT (founder, 2026-08-17):
 *
 *   No Explain prose may survive unless the relation it expresses survived
 *   deterministic licensing.
 *
 * The production failure this exists to end: the model proposed
 *
 *   dCS(smooth_detailed) x Acora(airy_closed)      -> reinforcement
 *   Butler(elastic_controlled) x ARC(warm_bright)  -> reinforcement
 *
 * Both were rejected for commensurability — the premises sit on different axes
 * — and both were then stated in the published assessment anyway, because
 * `interactionExplanation` ran parallel to validation instead of downstream of
 * it. Validation was deciding what Audio XX may BELIEVE while the prose
 * decided what it would SAY.
 *
 * Brand scope is enforced in the same pass. A sentence expressing a relation
 * that rests on brand evidence must attribute it to the maker; one that
 * asserts it of the specific product is dropped, because that is the claim the
 * evidence does not support.
 *
 * DEFAULT DENY. The first implementation asked "does this sentence look
 * relational?" against a list of connectives, and two live escapes followed
 * immediately: "further supported by" was not in the list, and
 * "This is counterweighted by…" named only one component because the other
 * arrived as a pronoun. Both are the same mistake — detecting interactions
 * with a vocabulary, which can always be walked around by a synonym.
 *
 * The rule is now positional, not lexical: naming or referring to a SECOND
 * component is what requires a licence. There is no connective test, so there
 * is no synonym to find. A sentence about one component publishes freely,
 * because this restricts Explain and silencing Describe would be the
 * over-correction rather than the fix.
 */
export function filterUnlicensedRelationalProse(
  prose: string | undefined,
  surviving: LicensedRelation[],
  componentNames: string[],
  /**
   * Chain roles, so "the amplifier" resolves to the product filling that role
   * before the default-deny rule runs. Optional: without it, role references
   * are invisible and the rule behaves exactly as it did before.
   */
  componentRoles: ComponentRole[] = [],
  /**
   * The premise set, so a CONDITIONED observation keeps its condition even in a
   * single-component sentence.
   *
   * GOVERNING RULE (founder, 2026-08-21):
   *
   *   A material condition is part of the evidence licence regardless of
   *   whether the claim is Describe or Explain.
   *
   * Condition enforcement previously lived only on relations, so Nathan
   * published "The dCS Rossini Apex is established as providing controlled and
   * smooth dynamics… according to Stereophile" while the observation behind it
   * held only under a direct A/B against the earlier Rossini. Stated flat, that
   * is a claim the publication never made — the same defect the relational rule
   * already caught, one claim-type along.
   */
  premises: AttributeRecord[] = [],
): {
  prose: string | undefined;
  dropped: Array<{ sentence: string; reason: string }>;
  normalized: Array<{ from: string; to: string }>;
} {
  if (!prose?.trim()) return { prose, dropped: [], normalized: [] };

  const licensed = new Map(surviving.map((r) => [pairKey(r.components[0], r.components[1]), r]));
  const dropped: Array<{ sentence: string; reason: string }> = [];
  const normalized: Array<{ from: string; to: string }> = [];

  const keptParagraphs = prose.split(/\n\n+/).map((para) => {
    // The antecedent for anaphora: the subject of the most recent sentence
    // that named a component. English is subject-first often enough that the
    // FIRST name is the right guess, and guessing wrong only ever costs a
    // sentence — the failure direction we want.
    let antecedent: string | undefined;
    // The text the antecedent came from. A component that enters by pronoun
    // is standing in for a claim made elsewhere, so its attribution lives
    // there — which is what keeps a properly attributed brand claim usable
    // across a sentence boundary.
    let antecedentSentence = '';

    const kept = para.split(/(?<=[.!?])\s+/).map((original) => {
      let sentence = original;
      const named = namesIn(sentence, componentNames);
      const referred = ANAPHORA.test(sentence) && antecedent && !named.includes(antecedent)
        ? [antecedent] : [];
      // A collective reference reaches every component at once. Resolving it to
      // the whole set is what puts an aggregate claim under the same rule as a
      // two-component one, instead of under no rule at all.
      const collective = referencesComponentSet(sentence) ? componentNames : [];
      // A role noun IS a reference to the component holding that role. Resolved
      // before the licence check, so naming one component and pointing at
      // another by its job requires exactly the relation that writing both
      // names out would have required.
      const byRole = rolesIn(sentence, componentRoles);
      const touched = [...new Set([...named, ...referred, ...collective, ...byRole])];

      // Capture the antecedent BEFORE advancing it: this sentence's own names
      // must not become the source we check its own anaphora against.
      const priorSentence = antecedentSentence;
      if (named.length > 0) { antecedent = named[0]; antecedentSentence = sentence; }

      // One component, or none: Describe. Publishable — the repair restricts
      // Explain, and silencing description would be the over-correction — but
      // a conditioned observation still carries its condition into the
      // sentence or does not publish.
      //
      // Reliance is detected by the sentence NAMING THE PUBLICATION. That is
      // the structural marker: a sentence citing Stereophile about a component
      // whose Stereophile premise is conditioned is resting on that
      // observation, whatever else it says. (A sentence that uses review
      // content without citing it is not reached by this rule; that is an
      // attribution failure, and a separate one.)
      if (touched.length < 2) {
        const relied = premises.filter((p) =>
          p.attribution?.condition
          && p.attribution.publication
          && touched.includes(p.component)
          && sentenceNames(sentence, p.attribution.publication));
        const missing = relied
          .filter((p) => !conditionStated(sentence, p.attribution!.condition!, p.component))
          .map((p) => p.attribution!.condition!);
        if (missing.length > 0) {
          dropped.push({ sentence: original.trim(),
            reason: `premise condition dropped (${[...new Set(missing)].join('; ')})` });
          return null;
        }
        return sentence;
      }

      // Two or more: every pair must be licensed. No connective test, no
      // vocabulary. Naming a second component IS the thing that requires a
      // licence, because "supported by" and "pairs with" and every future
      // synonym all name one.
      for (let i = 0; i < touched.length; i++) {
        for (let j = i + 1; j < touched.length; j++) {
          const rel = licensed.get(pairKey(touched[i], touched[j]));
          if (!rel) {
            dropped.push({ sentence: sentence.trim(),
              reason: `no licensed relation between ${touched[i]} and ${touched[j]}`
                + (collective.length ? ' (via collective reference to the components)'
                  : byRole.length && !named.includes(touched[j]) ? ' (via role reference)'
                    : referred.length ? ` (via anaphora to ${antecedent})` : '') });
            return null;
          }
          // Scope survives anaphora, and EVERY brand-scoped component must be
          // attributed on its own account. Two brand-scoped components need two
          // attributions; one does not cover the other.
          // A review-derived premise must name its publication where the
          // observation is doing the epistemic work. Unattributed, it reads as
          // Audio XX's own finding — the same failure as brand evidence
          // becoming a product claim, one regime along.
          const unattributedPubs = rel.citedPublications.filter(
            (pub) => !sentenceNames(sentence, pub));
          if (unattributedPubs.length > 0) {
            dropped.push({ sentence: original.trim(),
              reason: `review-derived premise not attributed (${unattributedPubs.join(', ')})` });
            return null;
          }

          // A conditioned observation stated flat is a claim the publication
          // never made. The condition is part of the licence, so it travels
          // into the sentence or the sentence does not publish.
          const droppedConditions = rel.conditions.filter(
            (c) => !conditionStated(sentence, c));
          if (droppedConditions.length > 0) {
            dropped.push({ sentence: original.trim(),
              reason: `premise condition dropped (${droppedConditions.join('; ')})` });
            return null;
          }

          if (rel.licensedScope === 'brand') {
            const unattributed = rel.brandScoped.filter((c) => {
              const source = named.includes(c) ? sentence : priorSentence;
              return !hasBrandAttributionFor(source, c);
            });
            if (unattributed.length > 0) {
              // Try to preserve the statement by restating the premise at the
              // scope actually held, before giving up on it.
              let repaired: string | null = sentence;
              for (const c of unattributed) {
                if (!named.includes(c)) { repaired = null; break; }   // arrived by pronoun
                repaired = repaired === null ? null : normalizeToBrandScope(repaired, c);
              }
              if (repaired && unattributed.every((c) => hasBrandAttributionFor(repaired!, c))) {
                normalized.push({ from: original.trim(), to: repaired.trim() });
                sentence = repaired;
              } else {
                dropped.push({ sentence: original.trim(),
                  reason: `brand-scoped relation asserted of the product (${unattributed.join(', ')})` });
                return null;
              }
            }
          }
        }
      }
      return sentence;
    }).filter((x): x is string => x !== null).join(' ').trim();
    return kept;
  }).filter(Boolean);

  return { prose: keptParagraphs.join('\n\n').trim() || undefined, dropped, normalized };
}

/**
 * Restate a premise at the scope Audio XX actually holds.
 *
 * The situation this exists for: Audio XX holds real brand evidence about dCS,
 * the model phrases it as a product claim, the validator correctly refuses the
 * scope escalation — and an otherwise licensed relation disappears. The
 * evidence supported a useful statement and the listener got silence.
 *
 * This is SCOPE NORMALISATION, not prose rewriting. It changes who the claim
 * is about and nothing else: the sonic content, direction, strength, axis,
 * tier, relation kind and conclusion all pass through untouched. The only
 * edit is the grammatical subject and the verb agreement that follows from it.
 *
 *   "The dCS Rossini Apex is transparent and precise"
 *   -> "dCS designs are typically transparent and precise"
 *
 * Deliberately narrow. It fires only where the component is the SUBJECT of a
 * characterising predicate, because that is the one position where swapping
 * the subject is meaning-preserving. "the cool, transparent output of the dCS"
 * is not repairable this way — the claim is embedded in a noun phrase — and
 * per the governing rule such a sentence is dropped rather than guessed at.
 *
 * It cannot manufacture a licence: the caller only reaches it for relations
 * that already survived D-12.
 */
export function normalizeToBrandScope(
  sentence: string,
  componentName: string,
): string | null {
  const brand = componentName.split(/\s+/)[0];
  if (!brand || brand.length < 2) return null;
  const esc = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const subject = `(^|(?<=[.!?]\\s))(?:The\\s+|the\\s+)?${esc(componentName)}\\s+`;

  // Copular: the verb becomes plural and gains the hedge the brand scope
  // implies. "is" -> "are typically" is the whole edit.
  const copular = new RegExp(`${subject}(?:is|was)\\s+`);
  if (copular.test(sentence)) {
    return sentence.replace(copular, (_m, lead) => `${lead ?? ''}${brand} designs are typically `);
  }

  // Third-person singular predicate: "offers" -> "typically offer". The -s is
  // stripped because the subject became plural, which is agreement, not
  // paraphrase.
  const verbal = new RegExp(`${subject}(\\w+?)s\\s+`);
  const m = sentence.match(verbal);
  if (m && m[2] && !/^(?:i|wa|ha|doe|ga)$/i.test(m[2])) {
    return sentence.replace(verbal, (_m, lead, stem) =>
      `${lead ?? ''}${brand} designs typically ${stem} `);
  }

  return null;
}

/**
 * Back-references that can carry a component into a sentence without naming it.
 *
 * Production published "This is counterweighted by the ARC ref 5" where `This`
 * was a brand-scoped dCS claim from the previous sentence — one name in the
 * sentence, so the pair check never ran and the scope requirement was bypassed
 * by a pronoun. The list is closed and grammatical rather than semantic: these
 * are the words English uses to point backwards, not a vocabulary of ways to
 * describe audio.
 */
/** Does the sentence name this publication? Punctuation-insensitive. */
function sentenceNames(sentence: string, publication: string): boolean {
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
  return norm(sentence).includes(norm(publication));
}

/**
 * Does the sentence carry this condition?
 *
 * Matched on the condition's own distinctive terms rather than its wording, so
 * "after approximately 500 hours" is satisfied by "after 500 hours of use" but
 * not by silence. Numbers count for more than words here: a break-in figure is
 * the part a listener acts on.
 */
function conditionStated(sentence: string, condition: string, subject?: string): boolean {
  const body = condition.replace(/^[a-z_]+:\s*/i, '');
  const numbers = body.match(/\d+/g) ?? [];
  if (numbers.length > 0) return numbers.every((n) => sentence.includes(n));

  // Words belonging to the SUBJECT'S OWN NAME cannot evidence the condition.
  // "direct A/B comparison with the earlier Rossini DAC" shares "Rossini" with
  // the dCS Rossini Apex, so merely naming the product read as stating the
  // condition and the flat claim published. Naming what a claim is about is
  // not the same as saying when it holds.
  const subjectWords = new Set((subject ?? '').toLowerCase().split(/\W+/).filter(Boolean));
  const terms = body.toLowerCase().split(/\W+/)
    .filter((t) => t.length >= 4
      && !['with', 'after', 'when', 'from', 'that', 'this'].includes(t)
      && !subjectWords.has(t));
  if (terms.length === 0) return true;
  const lower = sentence.toLowerCase();
  return terms.some((t) => lower.includes(t));
}

const ANAPHORA =
  /(?:^|[\s,;(])(?:this|that|these|those|it|its|which|the former|the latter|the same|doing so)\b/i;

/**
 * Is THIS component's contribution framed as brand-derived, in this text?
 *
 * The check was sentence-level and a live run walked straight through it:
 *
 *   "...the cool, transparent output of the dCS pairs with the ARC's warmer
 *    tonal tendencies, providing a balanced sound signature."
 *
 * The dCS premise is brand-scoped, and the sentence asserts a product fact
 * about it — "the cool, transparent output of the dCS". It passed because the
 * word "tendencies" appeared later, attached to the ARC. Attribution for one
 * component was licensing an unattributed claim about another.
 *
 * The marker must now be anchored to the component itself: its brand token
 * carrying a generalising noun ("dCS designs", "Harbeth components"), or a
 * tendency verb governed by that brand within a few words. Attribution
 * attached to a different component cannot reach across the sentence.
 */
export function hasBrandAttributionFor(text: string, componentName: string): boolean {
  if (!text) return false;
  const brand = componentName.split(/\s+/)[0]?.replace(/[^\w-]/g, '');
  if (!brand || brand.length < 2) return false;
  const B = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const GENERALISING = '(?:designs?|components?|products?|range|line|family|house\\s+(?:sound|style)|catalogue|catalog)';
  const TENDENCY = '(?:tend(?:s|ed|ency|encies)?|typically|generally|usually|often|'
    + 'are\\s+(?:described|associated|known)|is\\s+(?:described|associated|known)|'
    + 'lean(?:s|ing)?\\s+toward)';

  return [
    // "dCS designs", "dCS's components"
    new RegExp(`\\b${B}(?:'s)?\\s+(?:\\w+\\s+){0,2}${GENERALISING}\\b`, 'i'),
    // "designs from dCS", "components by dCS"
    new RegExp(`\\b${GENERALISING}\\s+(?:from|by)\\s+${B}\\b`, 'i'),
    // "dCS tends toward", "dCS is described as"
    new RegExp(`\\b${B}(?:'s)?\\s+(?:\\w+\\s+){0,3}${TENDENCY}`, 'i'),
  ].some((re) => re.test(text));
}

// ── Question typing ─────────────────────────────────────────────────

export type ActionVerdict = 'no_change' | 'constraint' | 'indeterminate';
export type QuestionType =
  /**
   * OPEN diagnostic — asks what the listener notices without naming any
   * candidate fault. The only type permitted after a no-change verdict.
   */
  | 'open_diagnostic'
  /** Diagnostic scoped to a concern Evaluate actually established. */
  | 'diagnostic'
  | 'directional'
  | 'missing_evidence';

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
    // Nothing was found wrong, so nothing may be suggested as wrong. A
    // scoped diagnostic needs a concern to scope it to, and a no-change
    // verdict is the statement that there isn't one.
    case 'no_change': return 'open_diagnostic';
    case 'constraint': return 'directional';
    case 'indeterminate': return 'missing_evidence';
  }
}

/**
 * The question Audio XX asks when it found nothing wrong.
 *
 * Deliberately contains no candidate fault. Production, after a no-change
 * verdict, asked "Are you experiencing any listening fatigue or a lack of
 * sonic warmth?" — technically a diagnostic, and still an invitation to find
 * two problems the assessment had just declined to find. A question that
 * supplies its own hypotheses is a recommendation wearing a question mark.
 */
export const OPEN_DIAGNOSTIC_QUESTION =
  'What, if anything, are you dissatisfied with in the system as it stands?';

/**
 * Perceptual qualities a question may not introduce under a no-change verdict.
 *
 * This list is a REGRESSION GUARD, not the mechanism. The mechanism is that
 * `open_diagnostic` permits no named quality at all — see
 * `questionIntroducesConcern`, which works from sentence shape rather than
 * from this vocabulary, so a quality it has never seen is caught anyway.
 */
const PERCEPTUAL_QUALITY =
  /\b(?:fatigue|fatiguing|harsh|harshness|bright(?:ness)?|thin(?:ness)?|lean|warmth|warm|dull|muddy|congest\w*|sibilan\w*|glare|edgy|boomy|bloated|veiled|closed[- ]in|forward|recessed|sluggish|slow|loose|shrill)\b/i;

/**
 * Does this question hand the listener a hypothesis?
 *
 * Two shapes, both structural:
 *
 *   1. A DEFICIENCY FRAME — "are you experiencing X", "any lack of Y",
 *      "do you find it too Z". These presuppose a fault and ask only whether
 *      the listener agrees.
 *   2. A NAMED QUALITY under a verdict that established none. Naming a
 *      quality is legitimate when Evaluate found a concern about it; after
 *      no-change there is nothing for it to be scoped to.
 */
export function questionIntroducesConcern(question: string): boolean {
  if (!question?.trim()) return false;
  // The lookbehind matters: "Do you notice harshness?" presupposes harshness,
  // while "WHAT do you notice first?" presupposes nothing. An open
  // interrogative head turns the same clause into a genuine question, and
  // without this the rule rejected exactly the questions it wants.
  const deficiencyFrame =
    /(?<!\b(?:what|which|how|where|when)\s)\b(?:are you (?:experiencing|noticing|finding|hearing)|do you (?:experience|notice|find|hear)|any (?:lack|absence|shortage) of|too (?:much|little|bright|warm|thin|forward)|is (?:it|the \w+) (?:ever )?(?:too|overly))\b/i;
  return deficiencyFrame.test(question)
    || PERCEPTUAL_QUALITY.test(question)
    || CHANGE_SEEKING.test(question);
}

/**
 * Predicates of alteration — incompatible with a no-change verdict.
 *
 * Production kept following "nothing needs changing" with "anything you are
 * seeking to adjust or improve upon?", which quietly converts restraint into
 * an upgrade prompt. Earlier guards missed it: "improve" names no perceptual
 * quality and "seeking to" is not a deficiency frame.
 *
 * This is not an open vocabulary being extended. It is the closed semantic
 * class MAKE DIFFERENT / MAKE BETTER — every English predicate for wanting a
 * change, matched by stem so inflections are covered. A no-change verdict is
 * the statement that no change is indicated; a question presupposing one
 * contradicts the sentence above it.
 *
 * Comparatives are included for the same reason: "more warmth" presupposes
 * that more would be desirable, which is the finding the verdict declined.
 */
const CHANGE_SEEKING =
  /\b(?:chang\w*|improv\w*|adjust\w*|enhanc\w*|upgrad\w*|alter\w*|modif\w*|swap\w*|replac\w*|tweak\w*|refin\w*|optimi[sz]\w*|better|fix|remedy|address|increas\w*|reduc\w*|boost\w*|dial (?:in|back)|more (?:of|warmth|detail|body|clarity|space)|less (?:of|warmth|detail|body|clarity)|seeking to|looking to|hoping to|want(?:ing)? to|wish(?:ing)? to|like to (?:see|have|get))\b/i;

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
  if ((required === 'open_diagnostic' || required === 'diagnostic')
    && DIRECTIONAL_MARKERS.test(question)) {
    out.push('directional question emitted under a no-change verdict');
  }
  if (required === 'open_diagnostic' && questionIntroducesConcern(question)) {
    out.push('question seeds a concern the assessment did not establish');
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
      // Adjectival forms. The re-run caught "the overall performance suggests
      // a deliberate architectural choice" — same claim, no participle for the
      // adverb rule to attach to.
      + '|\\b(?:deliberate|intentional|purposeful|conscious|considered)\\s+(?:\\w+\\s+)?'
      + '(?:choice|choices|decision|decisions|design|voicing|assembly|selection|pairing|build)\\b'
      // "This system is designed to deliver…" asserts that someone designed the
      // SYSTEM. Scoped to the system on purpose: "the DAC is designed to…" is a
      // manufacturer design fact and stays licensed.
      + '|\\b(?:this |the )?(?:system|chain|setup)\\s+(?:is|was|appears to be|seems to be)\\s+'
      + '(?:\\w+\\s+)?(?:designed|engineered|built|configured|voiced|assembled|constructed)\\s+to\\b'
      // ONTOLOGY, not vocabulary. A system is a collection of components;
      // purposes belong to people. Any construction making the system, chain
      // or its components the HOLDER of an intention, aim, preference or
      // choice is unlicensed unless attributable design evidence establishes
      // it — and none of that evidence exists in an ordinary assessment.
      //
      // Behavioural predicates stay available: a system may produce, exhibit,
      // reinforce, counterbalance or constrain. What it may not do is want
      // something. That distinction is why this is one rule rather than a
      // growing list of adjectives — "intended", "aims", "seeks", "pursues"
      // and every future synonym are the same claim.
      + `|\\b(?:the\\s+|this\\s+|its\\s+)?(?:system|chain|setup|configuration|components?|`
      + `design)(?:'s|s')?\\s+(?:\\w+\\s+){0,2}`
      + `(?:intend\\w*|aim\\w*|seek\\w*|desire\\w*|want\\w*|wish\\w*|choos\\w*|chose|`
      + `pursu\\w*|strive\\w*|prefer\\w*|purpose\\w*|goal\\w*|ambition\\w*|choice\\w*|`
      + `aspir\\w*|mean(?:s|t)?\\b)`
      // "its intended sound", "the intended balance" — the ascription moved
      // into an adjective, and it is the same claim.
      + `|\\b(?:its|the|this)\\s+(?:\\w+\\s+){0,2}`
      + `(?:intended|desired|sought|aspired|targeted|wanted)\\s+\\w+`
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
  opts: { componentsInRelations?: string[]; basisByComponent?: Record<string, string> } = {},
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

/**
 * Degree of assertion, as a closed grammatical class.
 *
 * D-7 extended from WHAT may be claimed to HOW STRONGLY: claim intensity may
 * not exceed evidence authority. A model-tier premise supports a characterised
 * tendency — "detailed", "leans cool" — and cannot support "brilliantly
 * detailed", because nothing in unverifiable model memory establishes a
 * degree, only a direction.
 *
 * Two forms, both grammatical rather than semantic, so this does not become an
 * adjective dictionary:
 *
 *   - adverbs of extreme degree modifying an adjective
 *   - superlative morphology (-est, "most X", "the best")
 *
 * Curated evidence may still speak strongly. Audio XX holding measured data
 * about a product is exactly the condition under which a superlative could be
 * earned, and flattening every judgment to the same middle register would make
 * the advisor uniformly bland — a different failure, not a fix.
 */
const EXTREME_DEGREE =
  /\b(?:brilliantly|exceptionally|extraordinarily|remarkably|stunningly|superbly|magnificently|incredibly|astonishingly|supremely|utterly|profoundly|immensely|breathtakingly|spectacularly|phenomenally|unusually|strikingly)\s+\w+/i;
const SUPERLATIVE =
  /\b(?:the (?:best|finest|greatest|most \w+)|most \w+ (?:available|on the market|at any price)|\w{4,}est\b(?! ?\w*(?:western|honest|modest|earnest|interest)))\b/i;

/** Which components in a sentence rest on evidence weaker than the catalog. */
function weaklyEvidencedIn(
  sentence: string,
  basisByComponent: Record<string, string>,
): string[] {
  return Object.entries(basisByComponent)
    .filter(([name, basis]) => basis !== 'catalog'
      && name.split(/\s+/).some((t) => t.length >= 3
        && new RegExp(`\\b${t.replace(/[^\w-]/g, '')}\\b`, 'i').test(sentence)))
    .map(([name]) => name);
}

export function overclaimViolations(
  prose: string,
  opts: {
    componentsInRelations?: string[];
    /** Evidence basis per component. Absent means no tier check is applied. */
    basisByComponent?: Record<string, string>;
  } = {},
): Array<{ kind: string; sentence: string }> {
  if (!prose) return [];
  const related = new Set((opts.componentsInRelations ?? []).map((c) => c.toLowerCase()));
  const basis = opts.basisByComponent;
  const out: Array<{ kind: string; sentence: string }> = [];

  for (const sentence of prose.split(/(?<=[.!?])\s+/)) {
    // Tier-bounded intensity. Only applied where we know the basis, and only
    // against components the sentence actually names — a superlative about a
    // catalogued product remains available.
    if (basis && (EXTREME_DEGREE.test(sentence) || SUPERLATIVE.test(sentence))) {
      const weak = weaklyEvidencedIn(sentence, basis);
      if (weak.length > 0) {
        out.push({ kind: 'intensity', sentence: sentence.trim() });
        continue;
      }
    }
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
