/**
 * Evidence-derived component character.
 *
 * The capability this adds is a summary of what independent listeners
 * repeatedly observed about ONE product, at the strength their observations
 * actually license — and nothing else. It is the layer between a pile of
 * scoped review observations and any statement about how a system may behave.
 *
 * WHAT THIS IS NOT.
 *
 * It is not the catalog axis system under a new name. That system ran
 *
 *     catalog axis -> generated sonic prose
 *
 * and it was removed because the axis was an editorial judgement entered once,
 * by us, and everything downstream read as though it were a finding. Nothing
 * here may be created that way. A proposition exists ONLY because admitted
 * observations exist, it names them, and it dies with them. This module
 * therefore imports no catalog, no axis table and no product data — enforced
 * by a purity test, the same way `engineering-rules.ts` is.
 *
 * THE RULE THAT DOES THE REAL WORK.
 *
 * A comparative observation stays comparative. Stereophile heard the Rossini
 * Apex render tone "fuller and richer" THAN THE ROSSINI IT REPLACED. That
 * licenses "richer than its predecessor". It does not license "rich", because
 * the reviewer never established where the pair sits in absolute terms — a
 * warmer shade of lean is still lean. The same discipline applies to every
 * condition: an observation made through one input, at one break-in state, in
 * one system, carries that condition into every sentence descended from it.
 *
 * Convergence is the only thing that promotes a claim, and only across
 * INDEPENDENT publications. Two observations from one review are one
 * publication's opinion stated twice.
 */

import type { ReviewObservation, ObservationCondition } from './independent-review';

/**
 * The dimensions a review observation can speak to.
 *
 * Deliberately the minimum that the acquired evidence actually populates,
 * rather than a complete ontology of audio description. Adding a dimension
 * because it sounds like it belongs is how the axis system started.
 */
export type CharacterDimension =
  | 'resolution'
  | 'tonal_density'
  | 'warmth'
  | 'transient'
  | 'dynamics'
  | 'spatial'
  | 'bass_control'
  | 'refinement'
  | 'neutrality';

export const CHARACTER_DIMENSIONS: readonly CharacterDimension[] = [
  'resolution', 'tonal_density', 'warmth', 'transient',
  'dynamics', 'spatial', 'bass_control', 'refinement', 'neutrality',
] as const;

/** Reader-facing name. Used in prose and in the evidence ledger. */
export const DIMENSION_LABEL: Record<CharacterDimension, string> = {
  resolution: 'resolution and low-level detail',
  tonal_density: 'tone colour and density',
  warmth: 'tonal balance',
  transient: 'transient attack',
  dynamics: 'dynamic scale',
  spatial: 'imaging and staging',
  bass_control: 'bass weight and grip',
  refinement: 'refinement',
  neutrality: 'neutrality and coloration',
};

/**
 * How a proposition came to be, in descending order of what it licenses.
 *
 * `comparative_only` is not a weaker version of the others. It is a claim of a
 * different SHAPE — about a pair — and the anchor is part of the claim
 * permanently, not a caveat that can be dropped when the sentence gets long.
 */
export type CharacterBasis =
  /** Several independent publications, same direction, no blocking condition. */
  | 'convergent_observations'
  /** One publication's direct listening observation. Travels with attribution. */
  | 'direct_observation'
  /** Only ever established against a named other product. */
  | 'comparative_only'
  /** Established only under a stated condition. The condition travels. */
  | 'conditional';

export type CharacterConfidence = 'high' | 'moderate' | 'low';

export interface CharacterProposition {
  productKey: string;
  /** The product as Audio XX names it, for prose. */
  productName: string;
  dimension: CharacterDimension;
  /**
   * Which way the evidence points, in one or two words as the sources put it
   * ("high", "full", "low coloration"). Not a scale position.
   */
  direction: string;
  /** The claim at exactly the strength the evidence licenses. Rendered as-is. */
  statement: string;
  basis: CharacterBasis;
  confidence: CharacterConfidence;
  /** Never empty. A proposition with no support must not be constructed. */
  support: ReviewObservation[];
  /** Distinct publications supporting it. Drives convergence. */
  publications: string[];
  /** Conditions that must travel into anything descended from this. */
  conditions: ObservationCondition[];
  /** Set when and only when basis is `comparative_only`. */
  comparedWith?: string;
}

/**
 * A product Audio XX looked for evidence about and did not find enough of.
 *
 * Recorded rather than omitted, because "we have no character evidence for the
 * amplifier" is a finding the review needs in order to say honestly where its
 * reasoning stops. Silence would read as nothing worth saying.
 */
export interface CharacterGap {
  productKey: string;
  productName: string;
  reason: 'no_admitted_observations' | 'only_positioning' | 'only_measurement' | 'conflicting';
  detail: string;
}

/**
 * Words that place an observation on a dimension.
 *
 * A vocabulary of English description, applied to a paraphrase we wrote
 * ourselves at admission. It is not a knowledge base about products: nothing
 * here knows what a Rossini is, and the same table runs over every product.
 */
const DIMENSION_CUES: Record<CharacterDimension, RegExp> = {
  resolution: /\b(resolution|resolv|detail|low-level|nuance|texture|inner|retriev|discern|transparen)/i,
  tonal_density: /\b(tone colou?r|tonal|timbre|saturat|colou?rful|dense|density|richer|richness|fuller|body|harmonic)/i,
  warmth: /\b(warm|dark|lean|thin|bright|cool|syrupy|sweet)/i,
  transient: /\b(transient|attack|speed|leading edge|pace|fast|quick|sharp)/i,
  dynamics: /\b(dynamic|scale|impact|compress|crescendo|loud|swing|gradient)/i,
  spatial: /\b(image|imaging|soundstage|staging|stage|space|spatial|dimension|depth|holograph|bloom|air)/i,
  bass_control: /\b(bass|low frequenc|bottom|grip|foundation|woofer|sub|octave)/i,
  refinement: /\b(refine|smooth|liquid|grain|harsh|aggressive|polish|natural|unforced|silk)/i,
  neutrality: /\b(neutral|colou?ration|accurate|uncolou?red|honest|tube-like|tubey|character)/i,
};

/** Which dimensions one observation speaks to. An observation may touch several. */
export function dimensionsOf(observation: ReviewObservation): CharacterDimension[] {
  const text = `${observation.claim} ${observation.axis ?? ''} ${observation.direction ?? ''}`;
  return CHARACTER_DIMENSIONS.filter((d) => DIMENSION_CUES[d].test(text));
}

/**
 * The direction the evidence points, phrased as the sources phrase it.
 *
 * Returns undefined rather than guessing. An observation that mentions bass
 * without saying anything about its quality supports no proposition, and a
 * default of "present" or "neutral" would be a claim we invented.
 */
/**
 * Negations, and the span each one governs.
 *
 * Without this the character layer inverts claims. The Absolute Sound
 * described the Reference 5 as balanced "without the sweetness, darkness or
 * syrupiness some listeners expect from tube equipment" — a statement that it
 * is NOT warm. A plain search for warmth vocabulary reads three warm words in
 * that sentence and concludes the opposite of what the reviewer wrote, which
 * is the single most damaging thing this module could do.
 *
 * The window is deliberately short. English negation scope is unbounded in
 * principle, but a negator forty characters upstream is usually governing a
 * different clause, and over-reaching would start suppressing real claims.
 */
const NEGATOR = /\b(?:without|no trace of|free (?:of|from)|lacking|devoid of|not|never|rather than|instead of)\b/gi;

/**
 * Where a negation stops governing.
 *
 * A fixed character window is the obvious implementation and it is wrong in
 * both directions. Too short and "did not equal the best solid-state
 * preamplifiers in transient speed" reads as a claim about speed; too long and
 * "without the sweetness, darkness or syrupiness ..., in a presentation the
 * reviewer characterised as neutral" suppresses the neutrality it asserts.
 *
 * Clause boundaries do the job properly. A comma alone is NOT one — English
 * negation reaches across a list, which is exactly the construction in the
 * Reference 5 sentence — but a comma introducing a new predicate is.
 */
const CLAUSE_BOUNDARY = /;|\.\s|,?\s+(?:though|but|although|yet|while|whereas)\s|,\s+(?:in|with|and|on|at|for|which)\s/i;

/**
 * Claims that describe a CHANGE rather than a state.
 *
 * The Reference 5 sounded dark and bloomless when new and opened up after
 * several hundred hours. Both halves are in one sentence, and any single
 * direction drawn from it is half right and half backwards — the collapse
 * produced "warm, though only after several hundred hours", which asserts
 * warmth on the far side of a transition where the reviewer heard light and
 * air. A transition licenses no character proposition. The observation stays
 * admitted, and remains exactly the kind of thing the limits section should
 * carry, because break-in state is something the listener can act on.
 */
const TRANSITION = /\b(?:giv(?:ing|es|en)? way to|gave way to|once (?:run|broken) in|turn(?:ed|ing)? into|at first\b[\s\S]{0,80}\b(?:later|then|eventually)|initially\b[\s\S]{0,80}\b(?:later|then|after))/i;

export function describesTransition(claim: string): boolean {
  return TRANSITION.test(claim);
}

/**
 * Does `re` match somewhere the claim is not negating?
 *
 * Every match is checked rather than just the first: "warm without any
 * syrupiness" and "without any syrupiness, but warm" mean the same thing and
 * must both read as warm.
 */
function hasUnnegated(claim: string, re: RegExp): boolean {
  const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  for (const match of claim.matchAll(global)) {
    const at = match.index ?? 0;
    const before = claim.slice(0, at);
    NEGATOR.lastIndex = 0;
    let negated = false;
    for (const n of before.matchAll(NEGATOR)) {
      const from = (n.index ?? 0) + n[0].length;
      // The negation governs unless a clause boundary closes it before the cue.
      if (!CLAUSE_BOUNDARY.test(before.slice(from))) { negated = true; break; }
    }
    if (!negated) return true;
  }
  return false;
}

export function directionOf(
  observation: ReviewObservation,
  dimension: CharacterDimension,
): string | undefined {
  if (describesTransition(observation.claim)) return undefined;
  const c = observation.claim.toLowerCase();
  const has = (re: RegExp) => hasUnnegated(c, re);
  switch (dimension) {
    case 'resolution':
      return has(/\b(more|higher|greater|better|improv|notabl|exception)/) ? 'high'
        : has(/\b(softer|obscur|veil)/) || /\b(?:less|lower)\s+(?:resolution|detail)/.test(c) ? 'limited'
        : undefined;
    case 'tonal_density':
      return has(/\b(rich|full|dense|saturat|colou?rful|round|substanc)/) ? 'full'
        : has(/\b(thin|lean|bleach|pale|washed)/) ? 'lean' : undefined;
    case 'warmth':
      return has(/\b(warm|dark|syrupy|sweet)/) ? 'warm'
        : has(/\b(lean|bright|cool|thin|acerbic)/) ? 'cool' : undefined;
    case 'transient':
      return has(/\b(fast|quick|sharp|lightning|attack|speed|grip)/) ? 'quick'
        : has(/\b(slow|soft|blunt|round)/) ? 'relaxed' : undefined;
    case 'dynamics':
      return has(/\b(more|better|greater|impact|uncompress|scale)/) ? 'wide'
        : has(/\b(compress|blur|limit|flatten)/) ? 'compressed' : undefined;
    case 'spatial':
      return has(/\b(wide|deep|three-dimension|dimension|holograph|open|bloom|air|realis|focus)/) ? 'developed'
        : has(/\b(flat|narrow|congest|closed|vague)/) ? 'restricted' : undefined;
    case 'bass_control':
      return has(/\b(firm|tight|grip|extend|deep|foundation|substantial|authorit)/) ? 'controlled'
        : has(/\b(loose|congeal|muddy|thin|shy|soft)/) ? 'loose' : undefined;
    case 'refinement':
      return has(/\b(smooth|liquid|refine|natural|unforced|silk|polish)/) ? 'refined'
        : has(/\b(harsh|aggressive|grain|edgy|noisy|coarse)/) ? 'coarse' : undefined;
    case 'neutrality':
      return has(/\b(neutral|uncolou?red|accurate|lower.{0,12}colou?ration|less.{0,12}(tubey|tube-like))/) ? 'neutral'
        : has(/\b(colou?red|tubey|tube-like|character)/) ? 'coloured' : undefined;
    default:
      return undefined;
  }
}

/** A condition that blocks promotion to an unconditioned claim. */
function isMaterial(condition: ObservationCondition | undefined): boolean {
  if (!condition) return false;
  // Every modelled condition kind is material by construction: admission
  // rejects an empty one, so its presence means the publication qualified the
  // claim. `other` included — we do not get to decide a stated qualification
  // was decorative.
  return true;
}

/** Distinct publications, case-folded. Convergence counts sources, not sentences. */
function distinctPublications(observations: ReviewObservation[]): string[] {
  const seen = new Map<string, string>();
  for (const o of observations) {
    const key = (o.publication ?? '').toLowerCase().trim();
    if (key && !seen.has(key)) seen.set(key, o.publication);
  }
  return [...seen.values()];
}

/**
 * Phrase the claim at the strength its basis licenses.
 *
 * The whole of D-7 for this layer lives in these four sentence shapes. Each
 * one is the strongest form its evidence permits, and none of them can be
 * rewritten into another without changing the evidence underneath.
 */
function phrase(
  productName: string,
  dimension: CharacterDimension,
  direction: string,
  basis: CharacterBasis,
  publications: string[],
  conditions: ObservationCondition[],
  comparedWith?: string,
): string {
  const subject = DIMENSION_LABEL[dimension];
  const sources = publications.length === 1
    ? publications[0]
    : `${publications.slice(0, -1).join(', ')} and ${publications[publications.length - 1]}`;

  /*
   * EDITORIAL PASS (2026-08-26). The earlier mechanical template produced
   * database English — "described the dCS Rossini Apex's refinement as
   * refined" — a tautology assembled by pushing a dimension label and its
   * direction through one fixed frame. Each direction now has a natural
   * predicate, and where the direction word IS the dimension's own adjective
   * the sentence drops the label rather than repeating it.
   */
  const naturally: Record<string, string> = {
    'resolution:high': 'unusually resolving, with strong low-level detail',
    'resolution:limited': 'limited in low-level detail',
    'tonal_density:full': 'full and rich in tone',
    'tonal_density:lean': 'lean in tone',
    'warmth:warm': 'warm in balance',
    'warmth:cool': 'cool in balance',
    'transient:quick': 'quick on transients',
    'transient:relaxed': 'relaxed on transients',
    'dynamics:wide': 'wide-ranging dynamically',
    'dynamics:compressed': 'dynamically compressed',
    'spatial:developed': 'strong in imaging and staging',
    'spatial:restricted': 'restricted in imaging',
    'bass_control:controlled': 'firm and well-controlled in the bass',
    'bass_control:loose': 'loose in the bass',
    'refinement:refined': 'notably refined',
    'refinement:coarse': 'coarse-sounding',
    'neutrality:neutral': 'neutral rather than coloured',
    'neutrality:coloured': 'audibly coloured',
  };
  const described = naturally[`${dimension}:${direction}`]
    ?? `${direction} in ${subject}`;

  switch (basis) {
    case 'convergent_observations':
      return `Independent reviewers at ${sources} consistently describe the `
        + `${productName} as ${described}.`;
    case 'direct_observation':
      return `${sources} described the ${productName} as ${described}.`;
    case 'comparative_only':
      return `${sources} found the ${productName} ${described} next to the `
        + `${comparedWith} — a comparison, not an absolute placement.`;
    case 'conditional': {
      const c = conditions[0];
      return `${sources} heard the ${productName} as ${described}`
        + `${c ? ` — ${c.description}` : ' under stated conditions'}.`;
    }
  }
}

/**
 * What the admitted observations about one product license, per dimension.
 *
 * The ordering of the checks IS the licensing rule, and it is deliberately
 * pessimistic at every branch: a dimension supported by both a comparison and
 * an unconditioned direct observation resolves to the direct one, but a
 * dimension supported only by comparisons can never climb out of
 * `comparative_only` no matter how many of them there are. Ten reviewers
 * agreeing that a product is warmer than its predecessor still have not said
 * it is warm.
 */
export function deriveCharacter(
  productKey: string,
  productName: string,
  observations: ReviewObservation[],
): { propositions: CharacterProposition[]; gap?: CharacterGap } {
  const mine = observations.filter((o) => o.productKey === productKey);

  if (mine.length === 0) {
    return {
      propositions: [],
      gap: {
        productKey, productName,
        reason: 'no_admitted_observations',
        detail: `No independent review evidence for the ${productName} has been admitted.`,
      },
    };
  }

  const sonic = mine.filter((o) => o.observationType === 'listening' || o.observationType === 'comparison');
  if (sonic.length === 0) {
    const only = mine.every((o) => o.observationType === 'positioning') ? 'only_positioning' : 'only_measurement';
    return {
      propositions: [],
      gap: {
        productKey, productName, reason: only,
        detail: only === 'only_positioning'
          ? `Coverage of the ${productName} establishes market placement but no listening observations.`
          : `Coverage of the ${productName} is measurement only; no listening observations were admitted.`,
      },
    };
  }

  const propositions: CharacterProposition[] = [];

  for (const dimension of CHARACTER_DIMENSIONS) {
    // Group this dimension's observations by the direction they point.
    const byDirection = new Map<string, ReviewObservation[]>();
    for (const o of sonic) {
      if (!dimensionsOf(o).includes(dimension)) continue;
      const dir = directionOf(o, dimension);
      if (!dir) continue;
      const list = byDirection.get(dir) ?? [];
      list.push(o);
      byDirection.set(dir, list);
    }
    if (byDirection.size === 0) continue;

    /*
     * Sources pointing opposite ways on one dimension is a real finding, not
     * noise to be averaged. Publishing the majority view would hide the
     * disagreement, and picking either side would be us deciding which
     * reviewer to believe — which is not a licence any evidence grants.
     */
    if (byDirection.size > 1) {
      const all = [...byDirection.values()].flat();
      if (distinctPublications(all).length > 1) continue;
    }

    const [direction, support] = [...byDirection.entries()]
      .sort((a, b) => b[1].length - a[1].length)[0];

    const unconditioned = support.filter((o) => !isMaterial(o.condition));
    const absolute = unconditioned.filter((o) => o.observationType === 'listening');
    const publications = distinctPublications(support);
    const conditions = support
      .map((o) => o.condition)
      .filter((c): c is ObservationCondition => Boolean(c));

    let basis: CharacterBasis;
    let confidence: CharacterConfidence;
    let comparedWith: string | undefined;

    if (absolute.length > 0 && distinctPublications(absolute).length > 1) {
      basis = 'convergent_observations';
      confidence = 'high';
    } else if (absolute.length > 0) {
      basis = 'direct_observation';
      confidence = 'moderate';
    } else if (unconditioned.length > 0) {
      // Comparisons only. The anchor is now part of the claim forever.
      basis = 'comparative_only';
      confidence = 'moderate';
      comparedWith = comparisonAnchor(unconditioned);
      if (!comparedWith) continue; // A comparison whose anchor we cannot name says nothing.
    } else {
      basis = 'conditional';
      confidence = 'low';
    }

    propositions.push({
      productKey, productName, dimension, direction,
      statement: phrase(
        productName, dimension, direction, basis,
        distinctPublications(basis === 'convergent_observations' ? absolute : support),
        conditions, comparedWith,
      ),
      basis, confidence,
      support,
      publications,
      conditions: basis === 'conditional' ? conditions : [],
      comparedWith,
    });
  }

  if (propositions.length === 0) {
    return {
      propositions: [],
      gap: {
        productKey, productName, reason: 'conflicting',
        detail: `Admitted coverage of the ${productName} did not converge on any characteristic.`,
      },
    };
  }
  return { propositions };
}

/**
 * The product a set of comparisons was made against.
 *
 * Read from the observations rather than inferred, and abandoned when the
 * comparisons disagree about their anchor — "richer than the Rossini" and
 * "cleaner than the DV2" are two claims, and merging them would invent a
 * comparison nobody made.
 */
function comparisonAnchor(observations: ReviewObservation[]): string | undefined {
  const anchors = new Set<string>();
  for (const o of observations) {
    /*
     * The anchor is a noun phrase, and English puts lowercase modifiers inside
     * it: Stereophile's comparisons are all against "the earlier Rossini DAC".
     * Requiring the capture to start at a capital dropped every one of them,
     * and with them the strongest evidence in the review — a silent loss,
     * because a proposition with no anchor is simply not constructed.
     */
    const m = /\b(?:than|versus|vs\.?|compared (?:to|with))\s+(?:the\s+)?((?:[a-z]+\s+){0,2}[A-Z][\w-]*(?:\s+[\w-]+){0,3})/
      .exec(o.claim);
    if (!m) continue;
    // Trailing common nouns ("DAC", "it replaces") are not part of the name.
    const anchor = m[1].trim()
      .replace(/\s+(?:it|which|that)\s+replaces?\b.*$/i, '')
      .replace(/\s+(?:DAC|preamplifier|amplifier|loudspeakers?|unit)$/i, '')
      .trim();
    if (anchor) anchors.add(anchor);
  }
  return anchors.size === 1 ? [...anchors][0] : undefined;
}
