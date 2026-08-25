/**
 * Relational sonic synthesis.
 *
 * Electrical relations answer what a system can DO — whether an amplifier can
 * drive a loudspeaker, whether a preamplifier can load a source. They say
 * nothing whatever about what it will SOUND like, and the temptation to let
 * them is why `power_load` relations are scope-locked elsewhere in this
 * codebase. This module is the other half: what the LISTENING evidence about
 * two components, taken together with their positions in the chain, licenses
 * about the pair.
 *
 * It produces bounded hypotheses. Never a description of the system's sound.
 * No reviewer heard the listener's four boxes together, and no amount of
 * evidence about the parts becomes evidence about the whole.
 *
 * THE FOUR MISTAKES THIS EXISTS TO PREVENT.
 *
 *   "Warm plus detailed equals synergy." Two components are not a recipe.
 *   Complementarity requires opposed characters on the SAME dimension, both
 *   independently established, and a reason they interact — not a pleasing
 *   pair of adjectives.
 *
 *   "Two warm components balance each other." They do not. Same-direction
 *   characters REINFORCE, and the honest word for that is compounding, which
 *   may be exactly what the listener wanted or exactly what they should worry
 *   about. Either way it is not balance.
 *
 *   "Both are described as fast, so it is a fast system." Speed is not
 *   additive and the chain has parts nobody characterised. This is bounded to
 *   a statement about what is unlikely to be the LIMITING element, which is
 *   all that independent observations of separate boxes can support.
 *
 *   "The reviews are glowing, so the mismatch does not matter." A sonic
 *   relation never overrides, softens or annotates an electrical constraint.
 *   The two are reported side by side and the constraint keeps its force.
 */

import type {
  CharacterProposition, CharacterDimension, CharacterConfidence,
} from './component-character';
import { DIMENSION_LABEL } from './component-character';

export type RelationKind =
  /** Opposed characters on one dimension, both established, plausibly interacting. */
  | 'complementary'
  /** Same-direction characters. Compounding, not cancelling. */
  | 'reinforcing'
  /** Characters differ but no interaction is established. */
  | 'neutral_coexistence'
  /** Same direction, and the direction is one that compounds unhelpfully. */
  | 'tension'
  /** One or both sides lack the character evidence the question needs. */
  | 'not_established';

export interface SonicRelation {
  upstreamName: string;
  downstreamName: string;
  dimension: CharacterDimension;
  kind: RelationKind;
  /** The Audio XX rule that licensed this, named so the reader can weigh it. */
  rule: string;
  /** Rendered as-is. Phrased at the strength the inputs license. */
  statement: string;
  confidence: CharacterConfidence;
  /** The propositions this rests on. Empty only for `not_established`. */
  requires: CharacterProposition[];
  /** What is missing, when `not_established`. */
  blockedBy?: string;
}

/**
 * Directions that sit at opposite ends of one dimension.
 *
 * Only these pairs can produce complementarity. Anything else is either the
 * same direction or two things that are not on speaking terms.
 */
const OPPOSED: Record<CharacterDimension, [string, string] | undefined> = {
  resolution: ['high', 'limited'],
  tonal_density: ['full', 'lean'],
  warmth: ['warm', 'cool'],
  transient: ['quick', 'relaxed'],
  dynamics: ['wide', 'compressed'],
  spatial: ['developed', 'restricted'],
  bass_control: ['controlled', 'loose'],
  refinement: ['refined', 'coarse'],
  neutrality: ['neutral', 'coloured'],
};

/** Same-direction pairs whose compounding is worth flagging as a risk. */
const COMPOUNDS_UNHELPFULLY: Partial<Record<CharacterDimension, string>> = {
  warmth: 'warm',
  refinement: 'coarse',
  resolution: 'limited',
  bass_control: 'loose',
};

/**
 * The weaker of two confidences.
 *
 * A relation cannot be more certain than the least certain thing it rests on.
 * This is the arithmetic of the whole module: there is no combination rule
 * that makes two moderate claims into a high-confidence one, because the
 * uncertainty in each is about the world, not about our sampling of it.
 */
function weaker(a: CharacterConfidence, b: CharacterConfidence): CharacterConfidence {
  const order: CharacterConfidence[] = ['low', 'moderate', 'high'];
  return order[Math.min(order.indexOf(a), order.indexOf(b))];
}

/**
 * A relation is only ever a hypothesis about a pair, and the language says so.
 *
 * `comparative_only` inputs weaken it further: a relation between two claims
 * that were themselves only ever established against other products cannot
 * describe this pair in absolute terms, and the sentence has to carry that.
 */
function hedge(a: CharacterProposition, b: CharacterProposition): string {
  const comparative = a.basis === 'comparative_only' || b.basis === 'comparative_only';
  return comparative
    ? 'The available review evidence, which established these characteristics only against other products, points toward'
    : 'The available review evidence points toward';
}

/**
 * What two components' characters, and their order in the chain, license.
 *
 * `upstream` feeds `downstream`. Order matters for one rule only — resolution
 * propagates forward and not backward — and is otherwise symmetric.
 */
export function synthesise(
  upstream: { name: string; propositions: CharacterProposition[] },
  downstream: { name: string; propositions: CharacterProposition[] },
  dimension: CharacterDimension,
): SonicRelation {
  const base = {
    upstreamName: upstream.name,
    downstreamName: downstream.name,
    dimension,
  };

  const a = upstream.propositions.find((p) => p.dimension === dimension);
  const b = downstream.propositions.find((p) => p.dimension === dimension);

  /*
   * R5 — MISSING CHARACTER BLOCKS THE QUESTION.
   *
   * Named first because it fires most often and because the naming matters:
   * "we cannot say how these two combine" is useless, while "no independent
   * review evidence for the amplifier has been admitted, so its contribution
   * to tone colour is unknown" tells the listener exactly which box to be
   * curious about and exactly what would change the answer.
   */
  if (!a || !b) {
    const missing = !a ? upstream.name : downstream.name;
    return {
      ...base,
      kind: 'not_established',
      rule: 'R5 missing-character-blocks',
      confidence: 'low',
      requires: [a, b].filter(Boolean) as CharacterProposition[],
      blockedBy: missing,
      statement: `How the ${upstream.name} and the ${downstream.name} combine in `
        + `${DIMENSION_LABEL[dimension]} is not established: no admitted review evidence `
        + `characterises the ${missing} on this dimension.`,
    };
  }

  const confidence = weaker(a.confidence, b.confidence);
  const opposed = OPPOSED[dimension];
  const sameDirection = a.direction === b.direction;

  /*
   * R1 — SAME DIRECTION REINFORCES. It never cancels.
   *
   * The single most common error in audio writing, and the one the founder
   * called out by name. Two components described the same way on one
   * dimension compound; whether that is good news depends entirely on the
   * direction, which is why the unhelpful directions are named separately
   * rather than judged here.
   */
  if (sameDirection) {
    const unhelpful = COMPOUNDS_UNHELPFULLY[dimension] === a.direction;
    return {
      ...base,
      kind: unhelpful ? 'tension' : 'reinforcing',
      rule: 'R1 same-direction-reinforces',
      confidence,
      requires: [a, b],
      statement: `${hedge(a, b)} the ${upstream.name} and the ${downstream.name} `
        + `pushing the same way in ${DIMENSION_LABEL[dimension]} — both are described as `
        + `${a.direction}. Characteristics in the same direction compound rather than `
        + `offset each other`
        + (unhelpful
          ? `, so this is the tendency most likely to become audible as a system trait, `
            + `and the one to listen for first.`
          : `, so expect this quality to be a property of the system rather than of `
            + `either box alone.`),
    };
  }

  /*
   * R3 — COMPLEMENTARITY IS A HIGH BAR.
   *
   * Opposed directions are necessary but nowhere near sufficient. Both sides
   * must be established at moderate confidence or better, because calling two
   * low-confidence guesses complementary manufactures a system-level
   * conclusion out of two things we barely know. Where that bar is not met the
   * honest verdict is that the components differ and the interaction is
   * unestablished — Section VII's "difference established, interaction not".
   */
  if (opposed && opposed.includes(a.direction) && opposed.includes(b.direction)) {
    if (confidence === 'low') {
      return {
        ...base,
        kind: 'neutral_coexistence',
        rule: 'R3 complementarity-requires-established-sides',
        confidence: 'low',
        requires: [a, b],
        statement: `The ${upstream.name} and the ${downstream.name} are described `
          + `differently in ${DIMENSION_LABEL[dimension]} — ${a.direction} and `
          + `${b.direction} respectively — but the evidence on at least one of them is `
          + `too thin to say whether the difference amounts to an interaction. `
          + `Difference is established here; complementarity is not.`,
      };
    }
    return {
      ...base,
      kind: 'complementary',
      rule: 'R3 opposed-and-established-may-complement',
      confidence,
      requires: [a, b],
      statement: `${hedge(a, b)} a possible complement in ${DIMENSION_LABEL[dimension]}: `
        + `the ${upstream.name} is described as ${a.direction} where the `
        + `${downstream.name} is described as ${b.direction}. Whether they meet in the `
        + `middle or one dominates depends on the room, the level and the recording, `
        + `none of which the review evidence covers.`,
    };
  }

  return {
    ...base,
    kind: 'neutral_coexistence',
    rule: 'R4 difference-without-established-interaction',
    confidence,
    requires: [a, b],
    statement: `The ${upstream.name} and the ${downstream.name} are characterised `
      + `differently in ${DIMENSION_LABEL[dimension]}, but nothing in the admitted `
      + `evidence establishes that the two interact on it.`,
  };
}

/**
 * R2 — RESOLUTION PROPAGATES FORWARD.
 *
 * A revealing downstream component does not improve what reaches it; it makes
 * whatever reaches it more consequential. That is a claim about SENSITIVITY TO
 * upstream choices, not a claim that the system sounds resolving, and it is
 * the one relation where chain order genuinely changes the answer — which is
 * why it is a separate function rather than another branch above.
 *
 * Returns undefined when the downstream component's resolution is not
 * established, because the entire inference hangs on it.
 */
export function revealingDownstream(
  upstreamNames: string[],
  downstream: { name: string; propositions: CharacterProposition[] },
): SonicRelation | undefined {
  const resolution = downstream.propositions.find(
    (p) => p.dimension === 'resolution' && p.direction === 'high',
  );
  if (!resolution || upstreamNames.length === 0) return undefined;

  const list = upstreamNames.length === 1
    ? `the ${upstreamNames[0]}`
    : `the ${upstreamNames.slice(0, -1).join(', the ')} and the ${upstreamNames[upstreamNames.length - 1]}`;

  return {
    upstreamName: upstreamNames[upstreamNames.length - 1],
    downstreamName: downstream.name,
    dimension: 'resolution',
    kind: 'reinforcing',
    rule: 'R2 revealing-downstream-raises-consequence',
    confidence: resolution.confidence,
    requires: [resolution],
    statement: `Because the ${downstream.name}'s ${DIMENSION_LABEL.resolution} is `
      + `described as high, changes upstream of it — ${list} — are likely to be more `
      + `audible here than they would be through a less revealing component. That is a `
      + `statement about how much upstream choices will matter, not a claim that the `
      + `system as a whole sounds resolving.`,
  };
}

/**
 * The guard that keeps engineering and listening evidence in their lanes.
 *
 * Returns the sentence that must accompany any electrical relation presented
 * alongside sonic ones. It exists because the failure it prevents is silent:
 * a reader shown "the amplifier drives this load comfortably" next to three
 * paragraphs of listening evidence will read the first as part of the second
 * unless told otherwise.
 */
export const ELECTRICAL_SCOPE_NOTE =
  'Electrical compatibility establishes what the system can do, not how it sounds. '
  + 'Nothing in the power and impedance evidence licenses a conclusion about tonal character.';

/**
 * One paragraph per pair per verdict, however many dimensions it spans.
 *
 * The rule text is the same for every dimension, so emitting one relation per
 * dimension printed the same two sentences three times with a different noun
 * in the middle. Grouping keeps each finding but states the reasoning once —
 * and reads as one observation about a pair, which is what it is.
 */
export function mergeByPair(relations: SonicRelation[]): SonicRelation[] {
  const groups = new Map<string, SonicRelation[]>();
  for (const r of relations) {
    const key = `${r.upstreamName}|${r.downstreamName}|${r.kind}|${r.rule}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }

  const merged: SonicRelation[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) { merged.push(group[0]); continue; }

    const dims = group.map((r) => DIMENSION_LABEL[r.dimension]);
    const list = dims.length === 2
      ? `${dims[0]} and ${dims[1]}`
      : `${dims.slice(0, -1).join('; ')}; and ${dims[dims.length - 1]}`;
    const first = group[0];
    const directions = [...new Set(group.map((r) => r.requires[0]?.direction).filter(Boolean))];
    const weakest = group.reduce<CharacterConfidence>(
      (acc, r) => (acc === 'low' || r.confidence === 'low' ? 'low'
        : acc === 'moderate' || r.confidence === 'moderate' ? 'moderate' : 'high'),
      'high',
    );
    const requires = group.flatMap((r) => r.requires);
    const comparative = requires.some((p) => p.basis === 'comparative_only');

    merged.push({
      ...first,
      confidence: weakest,
      requires,
      statement: `${comparative
        ? 'The available review evidence, which established these characteristics only '
          + 'against other products, points toward'
        : 'The available review evidence points toward'} `
        + `the ${first.upstreamName} and the ${first.downstreamName} being described in the `
        + `same terms across ${['', 'one', 'two', 'three', 'four', 'five'][dims.length] ?? String(dims.length)} `
        + `dimensions — ${list}`
        + `${directions.length === 1 ? `, each of them ${directions[0]}` : ''}. `
        + `Characteristics pointing the same way compound rather than offset each other, so `
        + `${first.kind === 'tension'
          ? 'these are the tendencies most likely to become audible as system traits, and the '
            + 'ones to listen for first.'
          : 'expect these to be properties of the system rather than of either box alone.'}`,
    });
  }
  return merged;
}
