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
  | 'founder_reference'      // calibrated from founder's direct listening experience — highest confidence
  | 'owner_reference'        // calibrated from owner's direct listening experience
  | 'review_consensus'       // consistent across multiple independent reviews
  | 'manufacturer_intent'    // stated design goal from the manufacturer
  | 'listener_consensus'     // recurring listener reports (forums, communities)
  | 'editorial_inference';   // inferred from design approach or measurements

// ── Tendency types ───────────────────────────────────

/**
 * The five perceptual domains a tendency can address.
 */
/**
 * Core domains: timing, tonality, dynamics, spatial, texture.
 * Product data may use extended domains (flow, clarity, bass, resolution, etc.)
 * for more specific tendency descriptions.
 */
export type TendencyDomain = string;

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
 * Confidence level for tendency data.
 *   high   — recurring patterns across multiple credible sources
 *   medium — some recurring patterns but less consistent
 *   low    — weak product-specific information
 *
 * Used on both ProductTendencies and TendencyProfile.
 */
export type TendencyConfidence = 'founder_reference' | 'high' | 'medium' | 'low';

/**
 * The complete tendency set for a product.
 */
export interface ProductTendencies {
  confidence: TendencyConfidence;

  character: CharacterTendency[];
  interactions: InteractionTendency[];
  tradeoffs: TradeOffTendency[];
}

// ── Qualitative tendency profile ─────────────────────

/**
 * Directional labels for product sonic tendencies.
 *
 * These are editorial assessments of recurring patterns, not measurements.
 *   emphasized      — a defining characteristic of this product
 *   present         — clearly there, but not a standout
 *   less_emphasized — structurally or intentionally de-prioritized
 *
 * Traits not listed are treated as neutral by default.
 */
export type TendencyLevel = 'emphasized' | 'present' | 'less_emphasized';

export interface QualitativeTendency {
  trait: string;
  level: TendencyLevel;
}

/**
 * Risk conditions worth flagging.
 * Binary — either worth mentioning or not.
 */
export type RiskFlag = 'fatigue_risk' | 'glare_risk' | string;

/**
 * The qualitative tendency profile for a product.
 * Source of truth for editorial character — replaces numeric traits
 * for explanation, and is preferred for scoring when present.
 */
export interface TendencyProfile {
  /**
   * Where this profile's assessments come from.
   * Internal only — not surfaced to users.
   */
  basis: SourceBasis;
  /**
   * How much weight to place on these assessments.
   *   high   — use for explanation and scoring
   *   medium — use for explanation (with hedging) and scoring
   *   low    — use for scoring only, not explanation
   */
  confidence: TendencyConfidence;
  tendencies: QualitativeTendency[];
  riskFlags: RiskFlag[];
}

// ── Tendency level → numeric weight bridge ──────────

/**
 * Derived numeric weights for scoring.
 * This mapping is the ONLY place qualitative → quantitative
 * conversion happens. Product data stays qualitative.
 */
const LEVEL_WEIGHT: Record<TendencyLevel, number> = {
  emphasized: 1.0,
  present: 0.6,
  less_emphasized: 0.0,
};

/** Default weight for traits not mentioned in the profile. */
const NEUTRAL_WEIGHT = 0.3;

/**
 * Resolve a numeric trait value from a product's tendency profile.
 * Falls back to legacy `traits` map, then to neutral.
 *
 * This bridge lets scoring code consume qualitative profiles
 * without changing its comparison logic.
 */
export function resolveTraitValue(
  tendencyProfile: TendencyProfile | undefined,
  legacyTraits: Record<string, number>,
  trait: string,
): number {
  // Risk traits are handled separately via riskFlags
  if (trait === 'fatigue_risk' || trait === 'glare_risk') {
    if (tendencyProfile) {
      return tendencyProfile.riskFlags.includes(trait as RiskFlag) ? 0.5 : 0.0;
    }
    return legacyTraits[trait] ?? 0;
  }

  // Prefer tendency profile when present
  if (tendencyProfile) {
    const entry = tendencyProfile.tendencies.find((t) => t.trait === trait);
    if (entry) return LEVEL_WEIGHT[entry.level];
    return NEUTRAL_WEIGHT;
  }

  // Fall back to legacy numeric traits
  return legacyTraits[trait] ?? 0;
}

/**
 * Check whether a product has a risk flag.
 * Prefers riskFlags from tendency profile, falls back to legacy threshold.
 */
export function hasRisk(
  tendencyProfile: TendencyProfile | undefined,
  legacyTraits: Record<string, number>,
  risk: RiskFlag,
): boolean {
  if (tendencyProfile) {
    return tendencyProfile.riskFlags.includes(risk);
  }
  return (legacyTraits[risk] ?? 0) >= 0.4;
}

/**
 * Get the "emphasized" traits from a tendency profile as plain labels.
 * Returns human-readable trait names for explanation text.
 */
export function getEmphasizedTraits(profile: TendencyProfile): string[] {
  return profile.tendencies
    .filter((t) => t.level === 'emphasized')
    .map((t) => t.trait.replace(/_/g, ' '));
}

/**
 * Get the "less_emphasized" traits from a tendency profile as plain labels.
 */
export function getLessEmphasizedTraits(profile: TendencyProfile): string[] {
  return profile.tendencies
    .filter((t) => t.level === 'less_emphasized')
    .map((t) => t.trait.replace(/_/g, ' '));
}

// ── Helpers ──────────────────────────────────────────

/** Source basis priority for selection — prefer better-sourced tendencies. */
const BASIS_PRIORITY: Record<SourceBasis, number> = {
  founder_reference: 4,
  owner_reference: 4,
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
 * (exists and confidence is not low).
 */
export function hasTendencies(
  tendencies: ProductTendencies | undefined,
): tendencies is ProductTendencies {
  return tendencies !== undefined && tendencies.confidence !== 'low';
}

/**
 * Check whether a tendency profile is usable for user-facing explanation.
 * Low-confidence profiles contribute to scoring but not explanation.
 */
export function hasExplainableProfile(
  profile: TendencyProfile | undefined,
): profile is TendencyProfile {
  return profile !== undefined && profile.confidence !== 'low';
}
