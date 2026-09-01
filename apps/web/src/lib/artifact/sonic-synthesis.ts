/**
 * The bridge from a listener's chain to what the listening evidence licenses.
 *
 * Resolves each component to its admitted review observations, derives what
 * those observations support about that component alone, and then walks the
 * chain in signal order applying the relational rules. Everything it returns
 * is already licensed; the review composer's job is to render it, not to
 * decide what may be said.
 *
 * Chain order matters here in a way it does not in the electrical layer. A
 * revealing loudspeaker makes upstream choices more consequential, and the
 * same two components in the opposite order would not support that statement.
 */

import {
  deriveCharacter, CHARACTER_DIMENSIONS,
  type CharacterProposition, type CharacterGap, type CharacterDimension,
} from '../evidence/component-character';
import {
  synthesise, revealingDownstream, type SonicRelation,
} from '../evidence/relational-synthesis';
import { seedObservations, PRODUCT_IDENTITIES } from '../evidence/independent-review-seed';
import { normalizeRole } from '../assessment/authoritative';
import type { ReviewObservation } from '../evidence/independent-review';

export interface ChainComponent {
  displayName: string;
  role: string;
  /** Catalog identity where known; falls back to the display name. */
  productKey?: string;
}

export interface SonicSynthesis {
  character: Map<string, CharacterProposition[]>;
  gaps: CharacterGap[];
  relations: SonicRelation[];
  /** Components with no admitted listening evidence at all. */
  uncharacterised: string[];
}

/**
 * Signal order, coarse enough to be right about every system Audio XX sees.
 *
 * An integrated amplifier occupies the preamplifier AND amplifier positions;
 * it is placed once, at the amplifier position, because the relation that
 * matters downstream is the one into the loudspeaker. A separate preamplifier
 * feeding an integrated is a real topology and is NOT collapsed — the
 * integrated stays where the listener put it.
 */
/*
 * Spelled in `normalizeRole`'s OWN vocabulary, which canonicalises to
 * "preamplifier" rather than "preamp". Writing the short form here put every
 * separate preamplifier at the unknown-role index — behind the loudspeaker.
 */
const CHAIN_ORDER = [
  'streamer', 'source', 'transport', 'streamer_dac', 'dac',
  'preamplifier', 'integrated', 'amplifier', 'speaker',
] as const;

/**
 * Where a role sits in the chain.
 *
 * Delegates to `normalizeRole`, the same function the licensing gate uses, so
 * that a role vocabulary fix lands in one place. Matching the literal strings
 * here instead silently mis-ordered every system with a separate
 * preamplifier: "preamplifier" is not "preamp", so the ARC sorted to the end
 * of the chain BEHIND the loudspeaker, and the review paired the loudspeaker
 * with the preamplifier feeding it. The relations were individually well
 * formed and collectively describing a system nobody owns.
 */
function chainIndex(role: string): number {
  const normalised = normalizeRole(role ?? '') ?? '';
  const bare = normalised.replace(/[\s_-]/g, '');
  const found = CHAIN_ORDER.findIndex((c) => c.replace(/_/g, '') === bare);
  return found === -1 ? CHAIN_ORDER.length : found;
}

/**
 * The key an observation is stored under.
 *
 * Normalised the same way on both sides so that "dCS Rossini Apex" in a
 * listener's system finds the rows filed under `dcs rossini apex`. Nothing
 * fuzzier than case and spacing: a looser match here would hand one product's
 * evidence to another, which is the failure the exact-variant rule exists to
 * prevent and the one place it could still be undone.
 */
export function observationKey(displayName: string): string {
  return displayName.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * The stored key for a component the listener named, or undefined.
 *
 * A listener's "Acora QRC-2" and the catalog's "Acora Acoustics QRC-2" are one
 * loudspeaker, and an exact string match would hand the second one no
 * evidence. Containment closes that gap — EVERY token of the stored key must
 * appear in the display name — while leaving the exact-variant rule intact,
 * because the model token is one of the tokens that has to match. "Acora
 * QRC-2" therefore finds nothing under a QRC-1 key, and a Reference 5 finds
 * nothing filed under Reference 5 SE.
 *
 * Deliberately one-directional. Matching the other way round would let a
 * stored "Acora Acoustics QRC-2" satisfy a listener's bare "Acora", which is
 * how one product's evidence ends up under another product's name.
 */
/**
 * The canonical prose identity for a listener's shorthand.
 *
 * "Butler Monads" is how the owner writes it and stays the KEY everywhere —
 * the character map, the ledger scope, the invariants. But prose built on the
 * shorthand produced number-agreement errors ("the Butler Monads is...") and
 * a review that repeats the listener's abbreviation back at them. Where a
 * governed identity exists, sentences use its canonical name; where none
 * does, the listener's own words stand.
 */
export function canonicalDisplayName(displayName: string): string {
  const key = resolveObservationKey(displayName, seedObservations().admitted);
  if (!key) return displayName;
  const identity = PRODUCT_IDENTITIES.find((i) => i.productKey === key);
  return identity?.canonical ?? displayName;
}

export function resolveObservationKey(
  displayName: string,
  observations: ReviewObservation[],
): string | undefined {
  const name = observationKey(displayName);
  const tokens = new Set(name.split(/\s+/).filter(Boolean));

  /*
   * EXACT IDENTITY FIRST, then exclusions.
   *
   * The order matters and the obvious one is wrong. Exclusions are matched by
   * prefix so that unknown variants are caught ("dcs rossini apex 2" is not
   * this product) — but "dcs rossini apex" also begins with "dcs rossini",
   * the predecessor it is excluded against, so checking exclusions first made
   * the Apex disqualify itself.
   *
   * An exact match against a canonical name or a human-confirmed alias is
   * direct evidence of identity; a prefix match is a heuristic about names we
   * do not recognise. Direct evidence wins, and the heuristic then does its
   * real job on everything that fell through.
   */
  const alias = PRODUCT_IDENTITIES.find(
    (i) => name === observationKey(i.canonical) || i.aliases.includes(name),
  );
  if (alias) return alias.productKey;

  /*
   * Now exclusions, and they are absolute. A name here is a DIFFERENT product
   * that looks like this one — the SE variant, the predecessor a comparison
   * was made against, the sibling model. No amount of token overlap below may
   * override a human's explicit "not this one".
   */
  for (const identity of PRODUCT_IDENTITIES) {
    if (identity.excludes.some((x) => name === x || name.startsWith(`${x} `))) return undefined;
  }

  /*
   * Otherwise containment: EVERY token of the stored key must appear in the
   * display name, so a catalog's "Acora Acoustics QRC-2" finds rows filed
   * under "acora qrc-2" while a bare "Acora" finds nothing.
   */
  const keys = [...new Set(observations.map((o) => o.productKey))];
  const matches = keys.filter((key) => {
    const keyTokens = key.split(/\s+/).filter(Boolean);
    return keyTokens.length > 0 && keyTokens.every((t) => tokens.has(t));
  });

  // Two stored products both contained in one name means the name is ambiguous
  // and neither may be assumed. Longest-match tie-breaking would be a guess.
  if (matches.length !== 1) return undefined;
  return matches[0];
}

/**
 * Everything the listening evidence licenses about this chain.
 *
 * `observations` is injectable so tests and future demand-driven acquisition
 * can supply their own; it defaults to the curated seed, which is the only
 * source in production today.
 */
export function synthesiseChain(
  components: ChainComponent[],
  observations: ReviewObservation[] = seedObservations().admitted,
): SonicSynthesis {
  const ordered = [...components].sort((a, b) => chainIndex(a.role) - chainIndex(b.role));

  const character = new Map<string, CharacterProposition[]>();
  const gaps: CharacterGap[] = [];
  const uncharacterised: string[] = [];

  for (const c of ordered) {
    const key = c.productKey
      ?? resolveObservationKey(c.displayName, observations)
      ?? observationKey(c.displayName);
    // Canonical name in the SENTENCES; the listener's name as the KEY.
    const { propositions, gap } = deriveCharacter(key, canonicalDisplayName(c.displayName), observations);
    character.set(c.displayName, propositions);
    if (gap) { gaps.push(gap); uncharacterised.push(c.displayName); }
  }

  const relations: SonicRelation[] = [];

  /*
   * ADJACENT PAIRS ONLY.
   *
   * A DAC three boxes upstream of a loudspeaker certainly influences what the
   * loudspeaker radiates, but "these two are complementary" across everything
   * in between is a claim about the intervening components too — and those may
   * be the very ones with no evidence. Adjacency keeps each relation to a pair
   * whose members are both actually characterised.
   */
  for (let i = 0; i + 1 < ordered.length; i += 1) {
    const up = ordered[i];
    const down = ordered[i + 1];
    const upstream = {
      name: canonicalDisplayName(up.displayName),
      propositions: character.get(up.displayName) ?? [],
    };
    const downstream = {
      name: canonicalDisplayName(down.displayName),
      propositions: character.get(down.displayName) ?? [],
    };

    for (const dimension of CHARACTER_DIMENSIONS) {
      const relation = synthesise(upstream, downstream, dimension);
      // A `not_established` verdict on a dimension NEITHER side speaks to is
      // noise — it would report nine non-findings per pair. One where a
      // characterised component meets an uncharacterised one is a real
      // finding, and it is the one that names the missing box.
      if (relation.kind === 'not_established') {
        const oneSideKnown = upstream.propositions.some((p) => p.dimension === dimension)
          || downstream.propositions.some((p) => p.dimension === dimension);
        if (!oneSideKnown) continue;
      }
      relations.push(relation);
    }
  }

  // R2 is a whole-chain statement rather than a pair, so it is applied last
  // and only to the loudspeaker, the one component everything feeds.
  const speaker = ordered.find((c) => chainIndex(c.role) === chainIndex('speaker'));
  if (speaker) {
    const upstreamNames = ordered
      .filter((c) => chainIndex(c.role) < chainIndex('speaker'))
      .map((c) => c.displayName);
    const r2 = revealingDownstream(upstreamNames.map(canonicalDisplayName), {
      name: canonicalDisplayName(speaker.displayName),
      propositions: character.get(speaker.displayName) ?? [],
    });
    if (r2) relations.push(r2);
  }

  return { character, gaps, relations, uncharacterised };
}

/** Relations worth printing, strongest claim first. */
export function significantRelations(relations: SonicRelation[]): SonicRelation[] {
  const rank: Record<SonicRelation['kind'], number> = {
    tension: 0, complementary: 1, reinforcing: 2, neutral_coexistence: 3, not_established: 4,
  };
  return [...relations].sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/**
 * The dimensions on which this system has a system-level story at all.
 *
 * Used by the thesis: a principal conclusion may only rest on dimensions where
 * at least one relation was actually established, never on the full list of
 * dimensions we happened to check.
 */
export function establishedDimensions(relations: SonicRelation[]): CharacterDimension[] {
  const kinds = new Set<SonicRelation['kind']>(['tension', 'complementary', 'reinforcing']);
  return [...new Set(relations.filter((r) => kinds.has(r.kind)).map((r) => r.dimension))];
}
