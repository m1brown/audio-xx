/**
 * Independent-review evidence — the admission contract.
 *
 * SLICE 1 ONLY: types and admission. No network, no persistence, no
 * retrieval, no reasoning consumption, no UI. Everything that can be got
 * wrong permanently is decided here, and all of it is testable offline.
 *
 * Its own regime, separately governed from manufacturer evidence, because a
 * maker states what they built and a reviewer states what they heard. They
 * share the `EvidenceItem` shape and nothing else.
 *
 * The two rules that matter most, both learned from real coverage of the beta
 * products rather than from preference:
 *
 *   EXACT VARIANT. Stereophile reviewed the Reference 5 SE — doubled
 *   power-supply capacitance, Teflon coupling capacitors. That is not weaker
 *   evidence about the Reference 5; it is evidence about a different product.
 *   Acora's SRB, VRC, SRC-1 and MRC-2 are heavily reviewed and none of them is
 *   the QRC-2. Sibling and variant reviews are REJECTED at admission rather
 *   than admitted at lower confidence.
 *
 *   CONDITIONS TRAVEL. The Absolute Sound found the Reference 5 "relatively
 *   airless and bloomless" and then "glorious" after 500 hours. Either half
 *   without its condition misrepresents the source, and the condition is the
 *   only part a listener could act on.
 */

import { getSourceEntry, isWhitelistedSource } from './source-whitelist';
import { identifyingTokens } from '../entity-corroboration';
import { CLASS_TIER, type EvidenceItem } from './evidence-types';

export type ObservationType =
  /** What the reviewer reports hearing. */
  | 'listening'
  /** A figure the publication measured on ITS sample, under ITS conditions. */
  | 'measurement'
  /** This product relative to a named other. */
  | 'comparison'
  /** Market or reference placement, class listings, price context. */
  | 'positioning';

export const OBSERVATION_TYPES: readonly ObservationType[] =
  ['listening', 'measurement', 'comparison', 'positioning'] as const;

/**
 * A material condition the observation depends on.
 *
 * Modest and typed on purpose. Modelling every possible condition now would be
 * an ontology built ahead of any observed need; `other` plus a description
 * absorbs what the five named kinds do not.
 */
export interface ObservationCondition {
  kind: 'break_in' | 'setup' | 'mode' | 'associated_equipment' | 'level' | 'other';
  /** As the publication stated it, paraphrased. Must not be empty. */
  description: string;
}

export interface ReviewObservation {
  /** Normalised identity of the product this is about. */
  productKey: string;
  /** The product AS THE PUBLICATION NAMED IT. The variant check reads this. */
  productName: string;
  publication: string;
  reviewer?: string;
  sourceUrl: string;
  publishedAt?: string;
  observationType: ObservationType;
  /** Audio XX's faithful paraphrase. Required — this is the evidence. */
  claim: string;
  /** Optional, sparing, only where exact wording materially matters. */
  quote?: string;
  /** Listening observations only. */
  axis?: string;
  direction?: string;
  condition?: ObservationCondition;
  /**
   * Set only when the publication ITSELF states the observation holds across
   * variants. Relaxes the variant check; never inferred by us.
   */
  appliesAcrossVariants?: boolean;
  retrievedAt: number;
}

export type RejectionReason =
  | 'publication_not_approved'
  | 'source_not_publication_domain'
  | 'malformed_source_url'
  | 'missing_attribution'
  | 'unknown_observation_type'
  | 'different_product'
  | 'condition_dropped'
  | 'empty_condition'
  | 'quote_too_long'
  /** Model matched, maker unstated, and the publication page did not confirm it. */
  | 'brand_not_established';

export type AdmissionVerdict =
  | { admitted: true }
  | { admitted: false; reason: RejectionReason; detail?: string };

/** A quotation is an aid, not the evidence. Kept short by contract. */
export const MAX_QUOTE_CHARS = 240;

/**
 * Does the claim state a condition its data does not carry?
 *
 * The enforcement half of "a conditioned observation cannot be admitted after
 * dropping its material condition". A paraphrase that says "after 500 hours"
 * while `condition` is absent has dropped the condition on the way in, and
 * admitting it would store a claim the publication never made unqualified.
 *
 * A closed set of conditional constructions, not a vocabulary of audio terms:
 * these are the grammatical shapes English uses to qualify a claim.
 */
const CONDITIONAL_CLAIM = new RegExp([
  // "after 500 hours", "after roughly 500 hours", "after several months"
  String.raw`\bafter\s+(?:\w+\s+){0,2}\d+`,
  String.raw`\bafter\s+(?:several|many|extended|prolonged)\b`,
  String.raw`\bonce\s+\w+(?:ed|en)\b`,
  String.raw`\bonly\s+(?:when|with|after|in)\b`,
  String.raw`\bwhen\s+(?:driven|paired|used|fed|run)\b`,
  String.raw`\bwith\s+the\s+\w+\s+(?:in|set|engaged)\b`,
  // "at low levels", "at low listening levels"
  String.raw`\bat\s+(?:low|high|modest|elevated)\s+(?:\w+\s+)?(?:level|volume)s?\b`,
  String.raw`\bin\s+\w+\s+mode\b`,
  String.raw`\bfollowing\s+(?:break|burn)[- ]in\b`,
  String.raw`\bbroken[- ]in\b`,
  String.raw`\bburn(?:ed|t)?[- ]in\b`,
].join('|'), 'i');

export function claimStatesCondition(claim: string): boolean {
  return CONDITIONAL_CLAIM.test(claim ?? '');
}

/**
 * Is the source URL served by the publication's own domain?
 *
 * The `manualzz.com` lesson from the manufacturer regime, applied here: a
 * mirror or aggregator carrying a publication's text is not the publication.
 */
export function isPublicationDomain(sourceUrl: string, publication: string): boolean {
  const entry = getSourceEntry(publication);
  if (!entry?.url) return false;
  if (!sourceUrl || /\s/.test(sourceUrl)) return false;
  try {
    const src = new URL(sourceUrl);
    if (src.protocol !== 'https:' && src.protocol !== 'http:') return false;
    const strip = (h: string) => h.toLowerCase().replace(/^www\./, '');
    const a = strip(src.host);
    // A publication may run several hosts — SoundStage! publishes the same
    // editorial operation across soundstagehifi.com, soundstageultra.com and
    // others. Each is listed explicitly on the whitelist entry; nothing is
    // inferred from the name.
    const owned = [new URL(entry.url).host, ...(entry.alternateDomains ?? [])].map(strip);
    return owned.some((b) => a === b || a.endsWith(`.${b}`));
  } catch { return false; }
}

/**
 * Is the reviewed product the SAME product, not a variant or sibling?
 *
 * Bidirectional token equality. Every identifying token of the requested
 * product must appear in the publication's designation AND vice versa, so an
 * extra token on either side is disqualifying:
 *
 *   requested "Audio Research Reference 5"
 *   reviewed  "Audio Research Reference 5 SE"   -> extra "se" -> different product
 *   requested "Acora Acoustics QRC-2"
 *   reviewed  "Acora Acoustics MRC-2"           -> "qrc" vs "mrc" -> different
 *
 * The requested identity must be the CANONICAL designation, not the listener's
 * shorthand: "ARC ref 5" shares no tokens with "Audio Research Reference 5"
 * and would be rejected against its own review. Callers resolve identity
 * through corroboration before reaching here.
 */
/**
 * Category prose a publication wraps around a model name.
 *
 * PHRASES, not words, and deliberately narrow. "Player", "integrated" and
 * "monoblock" can each distinguish a real product — dCS makes both a Rossini
 * Player and a Rossini DAC — so none of them is a stopword. What is stripped
 * here is multi-word category prose that no manufacturer uses as a model
 * designation.
 *
 * Nothing containing a digit, a generation marker or a variant letter is
 * eligible, which is what keeps "SE", "Mk II" and "XD" fatal.
 */
const PUBLICATION_DESCRIPTORS: readonly string[] = [
  'd/a processor', 'd a processor', 'da processor',
  'd/a converter', 'd a converter', 'da converter',
  'digital to analogue converter', 'digital to analog converter',
  'digital processor',
  'line-stage preamplifier', 'line stage preamplifier', 'linestage preamplifier',
  'line-stage preamp', 'line stage preamp',
  'power amplifier', 'monoblock power amplifier', 'monoblock amplifier',
  'integrated amplifier',
  'loudspeaker system', 'floorstanding loudspeaker', 'standmount loudspeaker',
  'streaming dac', 'network player', 'cd player',
];

/** Does removing this descriptor risk collapsing two distinct designations? */
function descriptorIsSafe(descriptor: string): boolean {
  // A digit or a lone letter inside the phrase means it may be carrying a
  // model designation rather than a category.
  return !/\d/.test(descriptor) && !/\b[a-z]\b/.test(descriptor.replace(/d\/a|d a|da/g, ''));
}

/** Strip trailing/leading category prose, once, and only when it is safe. */
function stripPublicationDescriptor(name: string): string {
  const lower = name.toLowerCase();
  for (const d of PUBLICATION_DESCRIPTORS) {
    if (!descriptorIsSafe(d)) continue;
    const at = lower.indexOf(d);
    if (at < 0) continue;
    // Only strip when the descriptor sits at an edge; a phrase in the middle
    // is more likely part of the designation than wrapping around it.
    const before = name.slice(0, at).trim();
    const after = name.slice(at + d.length).trim();
    if (before && after) continue;
    return (before || after).trim();
  }
  return name;
}

export type IdentityComparison =
  /** Same product, once representation and category prose are normalised. */
  | 'same'
  /**
   * The model designation matches exactly, and the publication wrote it
   * without the manufacturer. Admissible ONLY with independent brand
   * establishment from the publication's own page — see the acquisition layer.
   */
  | 'brand_omitted'
  | 'different';

/**
 * Compare a reviewed product against the canonical identity.
 *
 * The rule this preserves:
 *
 *   Brand may be omitted in how a publication writes the product name.
 *   Model/variant identity may not be approximate.
 *
 * So "dCS Rossini Apex D/A processor" is the same product as "dCS Rossini
 * APEX" — the extra words are category prose. "QRC-2" MAY be the same product
 * as "Acora Acoustics QRC-2", but only once something other than the model's
 * own say-so establishes the brand. "Reference 5 SE" is never "Reference 5",
 * because SE is a designation and designations are identity.
 */
export function compareProductIdentity(
  requestedName: string,
  reviewedName: string,
): IdentityComparison {
  const requested = identifyingTokens(requestedName);
  const reviewedRaw = identifyingTokens(reviewedName);
  if (requested.length === 0 || reviewedRaw.length === 0) return 'different';

  const present = (t: string, set: Set<string>) =>
    set.has(t)
    || (t.endsWith('s') && t.length > 3 && set.has(t.slice(0, -1)))
    || set.has(`${t}s`);

  const compare = (reviewedTokens: string[]): IdentityComparison => {
    const a = new Set(requested);
    const b = new Set(reviewedTokens);
    // Extra tokens on the reviewed side are always disqualifying: that is the
    // SE case, and no amount of brand context rescues it.
    for (const t of b) if (!present(t, a)) return 'different';
    const missing = requested.filter((t) => !present(t, b));
    if (missing.length === 0) return 'same';
    // Everything the publication DID write matches. What it left out is a
    // prefix of the canonical name — i.e. the manufacturer.
    const isPrefix = missing.every((t) => requested.indexOf(t) < requested.length - missing.length);
    return isPrefix ? 'brand_omitted' : 'different';
  };

  const direct = compare(reviewedRaw);
  if (direct !== 'different') return direct;

  // Second pass, with the publication's category prose removed. Attempted only
  // after a direct comparison failed, so stripping can never turn one product
  // into another that already matched.
  const stripped = identifyingTokens(stripPublicationDescriptor(reviewedName));
  if (stripped.length === 0 || stripped.length === reviewedRaw.length) return 'different';
  return compare(stripped);
}

/** Boolean form. `brand_omitted` is NOT the same product without brand evidence. */
export function isSameProduct(requestedName: string, reviewedName: string): boolean {
  return compareProductIdentity(requestedName, reviewedName) === 'same';
}

/**
 * The admission gate.
 *
 * Form and provenance only. Whether a reviewer heard what they say they heard
 * is not a question this layer can settle; that it was this publication, this
 * reviewer, this product and this condition is exactly what it can.
 */
export function admitReviewObservation(
  requestedProductName: string,
  observation: Partial<ReviewObservation>,
  /**
   * Whether the publication's OWN page establishes the canonical brand.
   *
   * Consulted only where the publication wrote the model without the maker.
   * Supplied by the acquisition layer from first-party page content on the
   * already-approved domain — never from the model's say-so, which is the
   * assertion this exists to check. Absent means fail closed.
   */
  brandEstablished?: boolean,
): AdmissionVerdict {
  const no = (reason: RejectionReason, detail?: string): AdmissionVerdict =>
    ({ admitted: false, reason, detail });

  // 6moons is excluded by its absence from the whitelist, which is the
  // enforcement rather than a special case.
  if (!observation.publication || !isWhitelistedSource(observation.publication)) {
    return no('publication_not_approved', observation.publication);
  }
  if (!observation.sourceUrl) return no('malformed_source_url');
  if (!isPublicationDomain(observation.sourceUrl, observation.publication)) {
    return no('source_not_publication_domain', observation.sourceUrl);
  }
  if (!observation.observationType
    || !OBSERVATION_TYPES.includes(observation.observationType)) {
    return no('unknown_observation_type', observation.observationType);
  }

  // Attribution, not quotation. The paraphrase IS the evidence, and the
  // identity is what makes it checkable.
  if (!observation.claim?.trim()) return no('missing_attribution', 'claim');
  if (!observation.productName?.trim()) return no('missing_attribution', 'productName');
  if (!observation.productKey?.trim()) return no('missing_attribution', 'productKey');

  if (observation.quote && observation.quote.length > MAX_QUOTE_CHARS) {
    return no('quote_too_long', String(observation.quote.length));
  }

  // Exact product. A variant or sibling is a different product, not weaker
  // evidence — unless the publication itself said otherwise.
  if (!observation.appliesAcrossVariants) {
    const identity = compareProductIdentity(requestedProductName, observation.productName);
    if (identity === 'different') return no('different_product', observation.productName);
    if (identity === 'brand_omitted' && brandEstablished !== true) {
      // The model designation matches and the maker is unstated. Without
      // independent confirmation from the publication's own page, a different
      // maker's identically named model could borrow this evidence.
      return no('brand_not_established', observation.productName);
    }
  }

  if (observation.condition) {
    if (!observation.condition.description?.trim()) return no('empty_condition');
  } else if (claimStatesCondition(observation.claim)) {
    return no('condition_dropped', observation.claim.slice(0, 80));
  }

  return { admitted: true };
}

/** Lift an admitted observation into the common interface. */
export function toEvidenceItem(observation: ReviewObservation): EvidenceItem {
  return {
    productKey: observation.productKey,
    evidenceClass: 'independent_review',
    tier: CLASS_TIER.independent_review,
    // Always product scope. A review is about the unit that was auditioned.
    scope: 'product',
    field: observation.observationType,
    // The condition is part of the licence, so it travels IN the value rather
    // than beside it — a consumer reading only `value` still cannot drop it.
    value: observation.condition
      ? `${observation.claim} [${observation.condition.kind}: ${observation.condition.description}]`
      : observation.claim,
    attribution: {
      sourceUrl: observation.sourceUrl,
      quotedText: observation.quote ?? '',
      publication: observation.publication,
      author: observation.reviewer,
    },
    retrievedAt: observation.retrievedAt,
  };
}
