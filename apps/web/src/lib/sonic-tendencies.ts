/**
 * Sonic Tendency Layer.
 *
 * Structured, curated product knowledge that captures recurring sonic
 * tendencies in three dimensions: character, interaction, and trade-offs.
 *
 * Purpose:
 *   - Traits power scoring and ranking (quantitative).
 *   - Tendencies power explanation and advisory reasoning (qualitative).
 *
 * Tendencies are probabilistic observations, not absolute claims.
 * They describe what a product *tends* to do, not what it always does.
 *
 * Each tendency carries a source basis (internal, never shown to users)
 * so we can audit provenance and prefer well-sourced claims when space
 * is limited.
 *
 * Products without tendencies fall back to the existing description +
 * trait-label path with no change in behavior.
 */

// ── Source basis ─────────────────────────────────────

/**
 * Where a tendency claim comes from.
 * Internal only — never surfaced to users.
 */
export type SourceBasis =
  | 'review_consensus'       // consistent across multiple independent reviews
  | 'manufacturer_intent'    // stated design goal from the manufacturer
  | 'listener_consensus'     // recurring listener reports (forums, communities)
  | 'editorial_inference';   // inferred from design approach or measurements

// ── Tendency types ───────────────────────────────────

/**
 * The five perceptual domains a tendency can address.
 */
export type TendencyDomain = 'timing' | 'tonality' | 'dynamics' | 'spatial' | 'texture';

/**
 * A single sonic tendency — what the product tends to do.
 */
export interface CharacterTendency {
  domain: TendencyDomain;
  /** Plain-language description of the tendency. */
  tendency: string;
  basis: SourceBasis;
  /** When this tendency is most or least apparent. */
  context?: string;
}

/**
 * A system interaction tendency — how the product tends to behave
 * when combined with a specific type of partner.
 */
export interface InteractionTendency {
  /** The system condition. e.g., "paired with tube amplification" */
  condition: string;
  /** What tends to happen. */
  effect: string;
  valence: 'positive' | 'neutral' | 'caution';
  basis: SourceBasis;
}

/**
 * A trade-off tendency — what you typically gain and lose.
 */
export interface TradeOffTendency {
  /** What this product tends to deliver. */
  gains: string;
  /** What it typically sacrifices. */
  cost: string;
  /** Reference frame (architecture, price class, etc.). */
  relative_to?: string;
  basis: SourceBasis;
}

/**
 * The complete tendency set for a product.
 */
export interface ProductTendencies {
  /**
   * How well-established these tendencies are overall.
   *   well_established — broad agreement across sources
   *   directional      — clear pattern, fewer sources
   *   provisional      — limited data, treat as tentative
   */
  confidence: 'well_established' | 'directional' | 'provisional';

  character: CharacterTendency[];
  interactions: InteractionTendency[];
  tradeoffs: TradeOffTendency[];
}

// ── Helpers ──────────────────────────────────────────

/** Source basis priority for selection — prefer better-sourced tendencies. */
const BASIS_PRIORITY: Record<SourceBasis, number> = {
  review_consensus: 3,
  listener_consensus: 2,
  manufacturer_intent: 1,
  editorial_inference: 0,
};

/**
 * Select character tendencies relevant to a desire quality.
 * Maps desire quality names to tendency domains.
 */
const DESIRE_TO_DOMAIN: Record<string, TendencyDomain[]> = {
  speed: ['timing'],
  pace: ['timing'],
  timing: ['timing'],
  attack: ['timing'],
  transients: ['timing'],
  warmth: ['tonality'],
  body: ['tonality'],
  richness: ['tonality'],
  density: ['tonality'],
  weight: ['tonality'],
  color: ['tonality'],
  smoothness: ['tonality', 'texture'],
  dynamics: ['dynamics'],
  punch: ['dynamics'],
  slam: ['dynamics'],
  rhythm: ['dynamics', 'timing'],
  drive: ['dynamics'],
  energy: ['dynamics'],
  soundstage: ['spatial'],
  imaging: ['spatial'],
  space: ['spatial'],
  air: ['spatial'],
  depth: ['spatial'],
  layering: ['spatial'],
  openness: ['spatial'],
  detail: ['texture'],
  clarity: ['texture', 'tonality'],
  resolution: ['texture'],
  texture: ['texture'],
  flow: ['timing', 'tonality'],
  engagement: ['dynamics', 'timing'],
};

/**
 * Pick the most relevant character tendencies for a set of desire qualities.
 * Returns up to `limit` tendencies, preferring domain matches and stronger sources.
 */
export function selectCharacterTendencies(
  tendencies: CharacterTendency[],
  desireQualities: string[],
  limit = 2,
): CharacterTendency[] {
  if (tendencies.length === 0) return [];

  // Collect target domains from desires
  const targetDomains = new Set<TendencyDomain>();
  for (const q of desireQualities) {
    const domains = DESIRE_TO_DOMAIN[q];
    if (domains) domains.forEach((d) => targetDomains.add(d));
  }

  // Score each tendency: domain relevance + source quality
  const scored = tendencies.map((t) => ({
    tendency: t,
    score: (targetDomains.has(t.domain) ? 10 : 0) + BASIS_PRIORITY[t.basis],
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.tendency);
}

/**
 * Pick the best character tendencies when no specific desire is expressed.
 * Prefers well-sourced tendencies, returns up to `limit`.
 */
export function selectDefaultTendencies(
  tendencies: CharacterTendency[],
  limit = 2,
): CharacterTendency[] {
  if (tendencies.length === 0) return [];

  const sorted = [...tendencies].sort(
    (a, b) => BASIS_PRIORITY[b.basis] - BASIS_PRIORITY[a.basis],
  );
  return sorted.slice(0, limit);
}

/**
 * Find interaction tendencies matching known system conditions.
 */
export function findMatchingInteractions(
  interactions: InteractionTendency[],
  systemKeywords: string[],
): InteractionTendency[] {
  if (interactions.length === 0 || systemKeywords.length === 0) return [];

  return interactions.filter((inter) => {
    const condLower = inter.condition.toLowerCase();
    return systemKeywords.some((kw) => condLower.includes(kw.toLowerCase()));
  });
}

/**
 * Check whether a product's tendency set is usable for explanation
 * (exists and isn't provisional).
 */
export function hasTendencies(
  tendencies: ProductTendencies | undefined,
): tendencies is ProductTendencies {
  return tendencies !== undefined && tendencies.confidence !== 'provisional';
}
