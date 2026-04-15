/**
 * Inference Layer — Design → Behavior → Perception chain.
 *
 * Sits between catalog facts (Product) and advisory reasoning.
 * Translates design choices into behavioral tendencies, then maps
 * behavioral tendencies to the 4-axis perceptual model.
 *
 * Fallback chain (first level that returns non-empty wins):
 *   1. Curated tendencyProfile  → confidence: high
 *   2. Legacy numeric traits    → confidence: high
 *   3. Design archetype         → confidence: medium
 *   4. Amp topology table       → confidence: medium
 *   5. No inference possible    → confidence: none
 *
 * Enforces strict chain: Design → Behavior → Perception.
 * No direct Design → Perception shortcuts allowed.
 *
 * Eight behavioral dimensions:
 *   flow              — musical continuity and phrasing coherence
 *   tonal_density     — harmonic weight and body
 *   clarity           — transparency and resolution
 *   dynamics          — dynamic contrast and energy
 *   speed             — transient leading-edge definition
 *   composure         — control under complex passages
 *   texture           — tactile surface detail
 *   spatial_precision — imaging specificity and staging coherence
 *
 * Two risk flags (binary, not continuous):
 *   fatigue_risk      — tendency toward listening fatigue
 *   glare_risk        — upper-frequency hardness
 */

import type { Product } from './products/dacs';
import type { DesignTopology } from './catalog-taxonomy';
import type {
  PrimaryAxisLeanings,
  WarmBrightLeaning,
  SmoothDetailedLeaning,
  ElasticControlledLeaning,
  AiryClosedLeaning,
} from './axis-types';
import type { SourceBasis } from './sonic-tendencies';
import { resolveArchetype, type DesignArchetype } from './design-archetypes';

// ── Design Signals ─────────────────────────────────────

/**
 * Minimal set of design-level facts extracted from a Product.
 * These are the INPUTS to the inference chain — no sonic interpretation.
 */
export interface DesignSignals {
  /** Design topology tag if cataloged (e.g. 'set', 'r2r', 'class-d'). */
  topology: DesignTopology | null;
  /** Product category (e.g. 'amplifier', 'dac', 'speaker'). */
  category: string;
  /** Freeform architecture string from product catalog. */
  architecture: string | null;
  /** Resolved design archetype from architecture pattern matching. */
  archetype: DesignArchetype | null;
}

// ── Behavioral Tendencies ──────────────────────────────

/** The eight tracked behavioral dimensions. */
export type BehavioralDimension =
  | 'flow'
  | 'tonal_density'
  | 'clarity'
  | 'dynamics'
  | 'speed'
  | 'composure'
  | 'texture'
  | 'spatial_precision';

/** All valid dimension names for runtime validation. */
const BEHAVIORAL_DIMENSIONS: Set<string> = new Set([
  'flow', 'tonal_density', 'clarity', 'dynamics', 'speed',
  'composure', 'texture', 'spatial_precision',
]);

/** Directional level within a behavioral dimension. */
export type BehavioralLevel = 'emphasized' | 'moderate' | 'less_emphasized';

/** A single behavioral tendency along one dimension. */
export interface BehavioralTendency {
  dimension: BehavioralDimension;
  level: BehavioralLevel;
}

/** Risk flag — binary, not continuous. */
export type InferenceRiskFlag = 'fatigue_risk' | 'glare_risk';

/**
 * Complete behavioral profile for a product.
 * Maximum 8 tendencies (one per dimension).
 */
export interface BehavioralTendencies {
  tendencies: BehavioralTendency[];
  riskFlags: InferenceRiskFlag[];
  basis: SourceBasis;
}

// ── Perceptual Profile ─────────────────────────────────

/**
 * Perceptual profile inferred from behavioral tendencies.
 * Maps to the existing 4-axis model (PrimaryAxisLeanings).
 */
export interface PerceptualProfile {
  /** Inferred axis positions. */
  axes: PrimaryAxisLeanings;
  /** Which axes were actually inferred (vs defaulted to neutral). */
  inferredAxes: string[];
}

// ── Inference Source & Confidence ───────────────────────

/**
 * Which level of the fallback chain produced the behavioral output.
 * Determines confidence: provenance-based, not dimension-count-based.
 */
export type InferenceSource =
  | 'curated_profile'    // per-product tendencyProfile → high
  | 'numeric_traits'     // per-product legacy traits   → high
  | 'design_archetype'   // architecture-class          → medium
  | 'amp_topology'       // amp topology table          → medium
  | 'none';              // no inference possible        → none

/** Confidence in the inference result. */
export type InferenceConfidence = 'high' | 'medium' | 'low' | 'none';

// ── Inference Result ───────────────────────────────────

/**
 * Complete inference output for a single product.
 * Carries the full chain: Design → Behavior → Perception.
 */
export interface InferenceResult {
  designSignals: DesignSignals;
  behavior: BehavioralTendencies | null;
  perception: PerceptualProfile | null;
  confidence: InferenceConfidence;
  /** Short explanation for confidence level. */
  confidenceReason: string;
  /** Which level of the fallback chain produced the behavior. */
  source: InferenceSource;
  /** True when curated tendencyProfile exists — inference is supplementary. */
  hasCuratedData: boolean;
  /** What this topology typically trades away. From archetype or curated data. */
  tradeoffSummary: string | null;
  /** Binary risk flags from the best available source. */
  riskFlags: InferenceRiskFlag[];
}

// ── Amplifier Topology → Behavior ──────────────────────
//
// design-archetypes.ts covers DAC and speaker topologies but
// has NO amplifier archetypes. This table fills that gap.
// Source basis: editorial_inference (topology-class-level knowledge).

interface AmpTopologyEntry {
  tendencies: BehavioralTendency[];
  riskFlags: InferenceRiskFlag[];
  tradeoff: string;
}

const AMP_TOPOLOGY_BEHAVIOR: Record<string, AmpTopologyEntry> = {
  set: {
    tendencies: [
      { dimension: 'flow', level: 'emphasized' },
      { dimension: 'tonal_density', level: 'emphasized' },
      { dimension: 'texture', level: 'emphasized' },
      { dimension: 'clarity', level: 'less_emphasized' },
      { dimension: 'dynamics', level: 'less_emphasized' },
      { dimension: 'speed', level: 'less_emphasized' },
      { dimension: 'composure', level: 'less_emphasized' },
      { dimension: 'spatial_precision', level: 'moderate' },
    ],
    riskFlags: [],
    tradeoff: 'Midrange purity, tonal density, and texture at the cost of power, bass authority, and composure under load.',
  },
  'push-pull-tube': {
    tendencies: [
      { dimension: 'flow', level: 'emphasized' },
      { dimension: 'texture', level: 'emphasized' },
      { dimension: 'tonal_density', level: 'moderate' },
      { dimension: 'dynamics', level: 'moderate' },
      { dimension: 'clarity', level: 'moderate' },
      { dimension: 'speed', level: 'moderate' },
      { dimension: 'composure', level: 'moderate' },
      { dimension: 'spatial_precision', level: 'moderate' },
    ],
    riskFlags: [],
    tradeoff: 'Musical flow and harmonic texture with moderate power, at the cost of ultimate grip and transient precision.',
  },
  'class-a-solid-state': {
    tendencies: [
      { dimension: 'clarity', level: 'emphasized' },
      { dimension: 'speed', level: 'emphasized' },
      { dimension: 'composure', level: 'emphasized' },
      { dimension: 'flow', level: 'moderate' },
      { dimension: 'tonal_density', level: 'moderate' },
      { dimension: 'dynamics', level: 'moderate' },
      { dimension: 'texture', level: 'moderate' },
      { dimension: 'spatial_precision', level: 'moderate' },
    ],
    riskFlags: [],
    tradeoff: 'Transparency, composure, and refinement at the cost of heat, efficiency, and sometimes warmth.',
  },
  'class-ab-solid-state': {
    tendencies: [
      { dimension: 'clarity', level: 'emphasized' },
      { dimension: 'dynamics', level: 'emphasized' },
      { dimension: 'speed', level: 'emphasized' },
      { dimension: 'composure', level: 'emphasized' },
      { dimension: 'flow', level: 'moderate' },
      { dimension: 'tonal_density', level: 'less_emphasized' },
      { dimension: 'texture', level: 'moderate' },
      { dimension: 'spatial_precision', level: 'moderate' },
    ],
    riskFlags: [],
    tradeoff: 'Dynamic authority and grip at the cost of harmonic richness and midrange body.',
  },
  'class-d': {
    tendencies: [
      { dimension: 'speed', level: 'emphasized' },
      { dimension: 'clarity', level: 'emphasized' },
      { dimension: 'dynamics', level: 'moderate' },
      { dimension: 'composure', level: 'moderate' },
      { dimension: 'flow', level: 'less_emphasized' },
      { dimension: 'tonal_density', level: 'less_emphasized' },
      { dimension: 'texture', level: 'less_emphasized' },
      { dimension: 'spatial_precision', level: 'moderate' },
    ],
    riskFlags: ['fatigue_risk'],
    tradeoff: 'Efficiency, speed, and control at the cost of tonal richness, texture, and harmonic body.',
  },
  hybrid: {
    tendencies: [
      { dimension: 'flow', level: 'moderate' },
      { dimension: 'tonal_density', level: 'moderate' },
      { dimension: 'clarity', level: 'moderate' },
      { dimension: 'dynamics', level: 'moderate' },
      { dimension: 'speed', level: 'moderate' },
      { dimension: 'composure', level: 'moderate' },
      { dimension: 'texture', level: 'moderate' },
      { dimension: 'spatial_precision', level: 'moderate' },
    ],
    riskFlags: [],
    tradeoff: 'Balanced compromise between tube and solid-state qualities — neither extreme, potentially lacking strong identity.',
  },
};

// ── Step 1: Extract Design Signals ─────────────────────

/**
 * Extract design-level facts from a Product.
 * Pure data extraction — no sonic interpretation.
 */
export function extractDesignSignals(product: Product): DesignSignals {
  const archetype = product.architecture
    ? resolveArchetype(product.architecture)
    : undefined;

  return {
    topology: product.topology ?? null,
    category: product.category,
    architecture: product.architecture ?? null,
    archetype: archetype ?? null,
  };
}

// ── Step 2: Infer Behavior (4-level fallback chain) ────

/**
 * Internal result from each fallback level.
 */
interface FallbackResult {
  tendencies: BehavioralTendency[];
  riskFlags: InferenceRiskFlag[];
  basis: SourceBasis;
  source: InferenceSource;
  tradeoff: string | null;
}

// ── Level 1: Curated tendencyProfile ───────────────────

/**
 * Read behavioral tendencies from curated tendencyProfile.
 * Maps QualitativeTendency entries to BehavioralTendency,
 * filtering to tracked dimensions only.
 */
function inferFromCuratedProfile(product: Product): FallbackResult | null {
  const profile = product.tendencyProfile;
  if (!profile || profile.confidence === 'low') return null;

  const tendencies: BehavioralTendency[] = [];
  for (const t of profile.tendencies) {
    if (BEHAVIORAL_DIMENSIONS.has(t.trait)) {
      tendencies.push({
        dimension: t.trait as BehavioralDimension,
        level: t.level === 'present' ? 'moderate' : t.level,
      });
    }
  }

  if (tendencies.length === 0) return null;

  // Extract risk flags from curated profile
  const riskFlags: InferenceRiskFlag[] = [];
  if (profile.riskFlags.includes('fatigue_risk')) riskFlags.push('fatigue_risk');
  if (profile.riskFlags.includes('glare_risk')) riskFlags.push('glare_risk');

  // Extract tradeoff from product tendencies if available
  const tradeoff = product.tendencies?.tradeoffs?.[0]?.gains
    ? `${product.tendencies.tradeoffs[0].gains} at the cost of ${product.tendencies.tradeoffs[0].cost}`
    : null;

  return {
    tendencies,
    riskFlags,
    basis: profile.basis,
    source: 'curated_profile',
    tradeoff,
  };
}

// ── Level 2: Legacy numeric traits ─────────────────────

/** Threshold numeric trait values into behavioral levels. */
function numericToLevel(value: number): BehavioralLevel {
  if (value >= 0.7) return 'emphasized';
  if (value >= 0.4) return 'moderate';
  return 'less_emphasized';
}

/**
 * Read behavioral tendencies from legacy numeric traits.
 * Thresholds: ≥0.7 → emphasized, 0.4–0.7 → moderate, <0.4 → less_emphasized.
 */
function inferFromNumericTraits(product: Product): FallbackResult | null {
  const traits = product.traits;
  if (!traits || Object.keys(traits).length === 0) return null;

  const tendencies: BehavioralTendency[] = [];

  for (const dim of BEHAVIORAL_DIMENSIONS) {
    const value = traits[dim];
    if (value !== undefined) {
      tendencies.push({
        dimension: dim as BehavioralDimension,
        level: numericToLevel(value),
      });
    }
  }

  if (tendencies.length === 0) return null;

  // Extract risk flags from numeric traits
  const riskFlags: InferenceRiskFlag[] = [];
  if ((traits.fatigue_risk ?? 0) >= 0.4) riskFlags.push('fatigue_risk');
  if ((traits.glare_risk ?? 0) >= 0.4) riskFlags.push('glare_risk');

  return {
    tendencies,
    riskFlags,
    basis: 'editorial_inference',
    source: 'numeric_traits',
    tradeoff: null,
  };
}

// ── Level 3: Design archetype ──────────────────────────

/**
 * Convert archetype TypicalTendency[] to our 8-dimensional model.
 * Filters to only tracked dimensions; maps direction to level.
 */
function archetypeToBehavior(archetype: DesignArchetype): BehavioralTendency[] {
  return archetype.typicalTendencies
    .filter((t) => BEHAVIORAL_DIMENSIONS.has(t.trait))
    .map((t) => ({
      dimension: t.trait as BehavioralDimension,
      level: t.direction === 'emphasized'
        ? ('emphasized' as const)
        : ('less_emphasized' as const),
    }));
}

function inferFromArchetype(signals: DesignSignals): FallbackResult | null {
  if (!signals.archetype) return null;

  const tendencies = archetypeToBehavior(signals.archetype);
  if (tendencies.length === 0) return null;

  return {
    tendencies,
    riskFlags: [],
    basis: signals.archetype.basis,
    source: 'design_archetype',
    tradeoff: signals.archetype.typicalTradeoff,
  };
}

// ── Level 4: Amp topology table ────────────────────────

function inferFromAmpTopology(signals: DesignSignals): FallbackResult | null {
  if (!signals.topology) return null;
  const entry = AMP_TOPOLOGY_BEHAVIOR[signals.topology];
  if (!entry) return null;

  return {
    tendencies: entry.tendencies,
    riskFlags: entry.riskFlags,
    basis: 'editorial_inference',
    source: 'amp_topology',
    tradeoff: entry.tradeoff,
  };
}

// ── Combined fallback chain ────────────────────────────

/**
 * Infer behavioral tendencies through the 4-level fallback chain.
 * First level that returns a non-empty result wins. Levels are NOT merged.
 *
 * Resolution order:
 *   1. Curated tendencyProfile (per-product editorial)
 *   2. Legacy numeric traits (per-product data)
 *   3. Design archetype (architecture-class knowledge)
 *   4. Amp topology table (amplifier topology-class)
 *   5. null — no inference possible
 */
export function inferBehaviorFromDesign(
  product: Product,
  signals: DesignSignals,
): FallbackResult | null {
  return (
    inferFromCuratedProfile(product) ??
    inferFromNumericTraits(product) ??
    inferFromArchetype(signals) ??
    inferFromAmpTopology(signals) ??
    null
  );
}

// ── Step 3: Map Behavior to Perception ─────────────────

/**
 * Map behavioral tendencies to the 4-axis perceptual model.
 *
 * Strict: Behavior → Perception only.
 * Each axis mapping is documented inline.
 *
 * Derivation rules (from spec section 2.4):
 *   warm_bright:        tonal_density vs. clarity
 *   smooth_detailed:    flow vs. clarity + texture
 *   elastic_controlled: dynamics vs. composure
 *   airy_closed:        spatial_precision
 */
export function mapBehaviorToPerception(
  behavior: BehavioralTendencies,
): PerceptualProfile {
  const dims = new Map<BehavioralDimension, BehavioralLevel>();
  for (const t of behavior.tendencies) {
    dims.set(t.dimension, t.level);
  }

  const inferredAxes: string[] = [];

  // ── warm_bright ──
  // tonal_density emphasized → warm
  // clarity emphasized + tonal_density less_emphasized → bright
  const density = dims.get('tonal_density');
  const clarity = dims.get('clarity');
  let warm_bright: WarmBrightLeaning = 'neutral';
  if (density === 'emphasized') {
    warm_bright = 'warm';
    inferredAxes.push('warm_bright');
  } else if (clarity === 'emphasized' && density === 'less_emphasized') {
    warm_bright = 'bright';
    inferredAxes.push('warm_bright');
  }

  // ── smooth_detailed ──
  // flow emphasized → smooth
  // clarity emphasized + texture emphasized (and flow not emphasized) → detailed
  // clarity emphasized alone (flow not emphasized) → detailed
  const flow = dims.get('flow');
  const texture = dims.get('texture');
  let smooth_detailed: SmoothDetailedLeaning = 'neutral';
  if (flow === 'emphasized') {
    smooth_detailed = 'smooth';
    inferredAxes.push('smooth_detailed');
  } else if (clarity === 'emphasized' && flow !== 'emphasized') {
    smooth_detailed = 'detailed';
    inferredAxes.push('smooth_detailed');
  } else if (texture === 'emphasized' && flow !== 'emphasized') {
    // Texture alone leans detailed — fine-grained surface information
    smooth_detailed = 'detailed';
    inferredAxes.push('smooth_detailed');
  }

  // ── elastic_controlled ──
  // dynamics emphasized → elastic
  // composure emphasized → controlled
  // (composure is the direct signal for control, replacing the speed+dynamics proxy)
  const dynamics = dims.get('dynamics');
  const composure = dims.get('composure');
  let elastic_controlled: ElasticControlledLeaning = 'neutral';
  if (dynamics === 'emphasized' && composure !== 'emphasized') {
    elastic_controlled = 'elastic';
    inferredAxes.push('elastic_controlled');
  } else if (composure === 'emphasized' && dynamics !== 'emphasized') {
    elastic_controlled = 'controlled';
    inferredAxes.push('elastic_controlled');
  }

  // ── airy_closed ──
  // spatial_precision emphasized → airy
  // spatial_precision less_emphasized → closed
  const spatial = dims.get('spatial_precision');
  let airy_closed: AiryClosedLeaning = 'neutral';
  if (spatial === 'emphasized') {
    airy_closed = 'airy';
    inferredAxes.push('airy_closed');
  } else if (spatial === 'less_emphasized') {
    airy_closed = 'closed';
    inferredAxes.push('airy_closed');
  }

  return {
    axes: { warm_bright, smooth_detailed, elastic_controlled, airy_closed },
    inferredAxes,
  };
}

// ── Confidence Calculation ─────────────────────────────

/**
 * Derive confidence from provenance (InferenceSource).
 *
 * Provenance is the primary determinant:
 *   curated_profile / numeric_traits → high
 *   design_archetype / amp_topology  → medium
 *   none                             → none
 *
 * Dimension count is a secondary DOWNGRADE factor only:
 *   medium source with <3 tendencies → low
 */
function calculateConfidence(
  source: InferenceSource,
  tendencyCount: number,
  archetype: DesignArchetype | null,
): { confidence: InferenceConfidence; reason: string } {
  if (source === 'none') {
    return { confidence: 'none', reason: 'no usable design signals or product data' };
  }

  if (source === 'curated_profile') {
    return { confidence: 'high', reason: 'per-product curated tendencies' };
  }

  if (source === 'numeric_traits') {
    return { confidence: 'high', reason: 'per-product numeric trait data' };
  }

  if (source === 'design_archetype') {
    const label = archetype?.label ?? 'archetype';
    // Downgrade if archetype only yields 1-2 tracked dimensions
    if (tendencyCount < 3) {
      return {
        confidence: 'low',
        reason: `${label} archetype — limited dimensional coverage (${tendencyCount} of 8)`,
      };
    }
    return { confidence: 'medium', reason: `${label} archetype — architecture-class inference` };
  }

  if (source === 'amp_topology') {
    if (tendencyCount < 3) {
      return {
        confidence: 'low',
        reason: `amp topology — limited dimensional coverage (${tendencyCount} of 8)`,
      };
    }
    return { confidence: 'medium', reason: 'amplifier topology-class inference' };
  }

  return { confidence: 'none', reason: 'unknown inference source' };
}

// ── Main Entry Point ───────────────────────────────────

/**
 * Run the full inference chain for a product.
 *
 * Design → Behavior → Perception (strict, no shortcuts).
 *
 * Uses 4-level fallback chain:
 *   curated → numeric → archetype → amp_topology → none
 *
 * First level that returns non-empty wins. Levels are NOT merged.
 */
export function runInference(product: Product): InferenceResult {
  const hasCuratedData = !!(
    product.tendencyProfile &&
    product.tendencyProfile.confidence !== 'low'
  );

  // Step 1: Extract design signals
  const designSignals = extractDesignSignals(product);

  // Step 2: Design → Behavior (strict, 4-level fallback)
  const fallback = inferBehaviorFromDesign(product, designSignals);

  const behavior: BehavioralTendencies | null = fallback
    ? { tendencies: fallback.tendencies, riskFlags: fallback.riskFlags, basis: fallback.basis }
    : null;

  const source: InferenceSource = fallback?.source ?? 'none';
  const tradeoffSummary = fallback?.tradeoff ?? null;
  const riskFlags = fallback?.riskFlags ?? [];

  // Step 3: Behavior → Perception (strict — only if behavior exists)
  const perception = behavior ? mapBehaviorToPerception(behavior) : null;

  // Step 4: Calculate confidence from provenance
  const { confidence, reason } = calculateConfidence(
    source,
    behavior?.tendencies.length ?? 0,
    designSignals.archetype,
  );

  return {
    designSignals,
    behavior,
    perception,
    confidence,
    confidenceReason: reason,
    source,
    hasCuratedData,
    tradeoffSummary,
    riskFlags,
  };
}
