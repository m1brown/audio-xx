/**
 * The common evidence interface.
 *
 * ARCHITECTURAL DECISION (founder, 2026-08-18):
 *
 *   separate evidence regimes -> common typed interface -> shared consumers
 *
 * NOT everything into one evidence bucket. Manufacturer evidence and
 * independent-review evidence are different provenance regimes and stay
 * independently governed at acquisition and storage — one is first-party
 * factual, the other is attributable third-party observation, and they are
 * gathered, trusted and audited differently.
 *
 * What they share is a SHAPE, so that assessments, product pages, comparisons,
 * recommendations and later Critical Consensus need one reasoning
 * architecture rather than one per source.
 *
 * D-7 remains controlling. Normalisation may unify the shape and must never
 * erase:
 *
 *   - `evidenceClass`  which regime produced it
 *   - `tier`           how much authority it carries
 *   - `scope`          whether it speaks about a product or a maker
 *   - `attribution`    where it came from and, where required, its own words
 *
 * A consumer that reads only `field` and `value` is reading it wrong; the
 * type makes the rest non-optional wherever the regime requires it.
 */

/** Which regime produced this evidence. Never collapsed. */
export type EvidenceClass =
  /** Audio XX's own curated product data. */
  | 'catalog'
  /** Audio XX's own curated evidence about a maker. Brand-scoped by nature. */
  | 'brand_profile'
  /** First-party published fact — specification, construction, topology. */
  | 'manufacturer'
  /** Attributable observation from an approved publication. NOT YET IMPLEMENTED. */
  | 'independent_review'
  /** The reasoning model's own knowledge, admissible only once identity is corroborated. */
  | 'model'
  /** What the listener told us. Identity and role; never sonic character. */
  | 'listener';

/**
 * Authority, ordered weakest to strongest.
 *
 * The order is the founder's, 2026-08-18:
 *   curated evidence > manufacturer facts > independent review > model > listener
 *
 * `brand` sits with `catalog` as curated evidence. That it outranks a
 * manufacturer fact is not a claim that our prose beats their spec sheet —
 * SCOPE settles that. Brand evidence may only make brand-scoped claims, so it
 * never competes with a manufacturer fact for a product-level statement.
 */
export type EvidenceTier =
  | 'listener'
  | 'model'
  | 'independent_review'
  | 'manufacturer'
  | 'brand'
  | 'catalog';

export const TIER_RANK: Record<EvidenceTier, number> = {
  listener: 0,
  model: 1,
  independent_review: 2,
  manufacturer: 3,
  brand: 4,
  catalog: 5,
};

/** The weaker of two tiers. The anti-laundering primitive D-12 rests on. */
export function weakerTier(a: EvidenceTier, b: EvidenceTier): EvidenceTier {
  return TIER_RANK[a] <= TIER_RANK[b] ? a : b;
}

/** What a claim built on this evidence may be ABOUT. */
export type EvidenceScope = 'product' | 'brand';

/**
 * Where evidence came from.
 *
 * `quotedText` is required for any regime whose licence depends on being
 * checkable later — manufacturer and independent review both do. A fact that
 * cannot be quoted is not admitted, which is what keeps this auditable after
 * the page it came from changes.
 */
export interface EvidenceAttribution {
  sourceUrl: string;
  quotedText: string;
  /** Independent review only: the publication. Never inferred. */
  publication?: string;
  author?: string;
}

/**
 * One piece of evidence, as every consumer sees it.
 *
 * Deliberately not an `AttributeRecord`: that type is D-12's premise shape and
 * carries an axis. Most evidence has no axis — a cabinet material is not a
 * position on warm/bright — and forcing one would invent a sonic reading from
 * a construction fact. Adapters map the subset that IS axis-bearing.
 */
export interface EvidenceItem {
  /** Normalised product identity. Storage and lookup key. */
  productKey: string;
  evidenceClass: EvidenceClass;
  tier: EvidenceTier;
  scope: EvidenceScope;
  /** Controlled per class. Never free text. */
  field: string;
  /** As published, units preserved: "96 dB/W/M", "10 ohms". */
  value: string;
  /** Required for manufacturer and independent_review; absent for model/listener. */
  attribution?: EvidenceAttribution;
  retrievedAt: number;
}

/** The tier each regime carries. One place, so no consumer invents its own. */
export const CLASS_TIER: Record<EvidenceClass, EvidenceTier> = {
  catalog: 'catalog',
  brand_profile: 'brand',
  manufacturer: 'manufacturer',
  independent_review: 'independent_review',
  model: 'model',
  listener: 'listener',
};

/** Regimes whose admission requires a quotable source. */
export const REQUIRES_ATTRIBUTION: ReadonlySet<EvidenceClass> =
  new Set<EvidenceClass>(['manufacturer', 'independent_review']);

/**
 * Is this item admissible under its own regime's rules?
 *
 * The gate every store writes through. It is deliberately about FORM, not
 * about whether a claim is true: truth is the acquisition layer's problem,
 * and form is what keeps the licensing chain checkable.
 */
export function isAdmissible(item: EvidenceItem): boolean {
  if (!item.productKey || !item.field || !item.value) return false;
  if (CLASS_TIER[item.evidenceClass] !== item.tier) return false;
  if (REQUIRES_ATTRIBUTION.has(item.evidenceClass)) {
    if (!item.attribution?.sourceUrl || !item.attribution?.quotedText) return false;
  }
  // Brand-scoped evidence about a specific product is a category error: the
  // scope says "this is about the maker" while the key says "this is about
  // this unit". Only brand_profile may be brand-scoped.
  if (item.scope === 'brand' && item.evidenceClass !== 'brand_profile') return false;
  return true;
}
