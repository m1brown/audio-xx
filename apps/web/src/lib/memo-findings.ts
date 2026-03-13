/**
 * MemoFindings — the structured contract between the deterministic
 * assessment engine and all downstream renderers.
 *
 * The deterministic pipeline (parsing, axis synthesis, stacked trait
 * detection, bottleneck detection, upgrade ranking, reconciliation)
 * produces a MemoFindings object. Both the deterministic template
 * renderer and the LLM overlay renderer consume this contract.
 *
 * Design principles:
 *   - All fields are structured (enums, tags, short factual phrases)
 *   - No prose or semi-rendered language
 *   - The LLM receives only this contract, never raw reasoning
 *   - Any renderer can produce a complete memo from MemoFindings alone
 */

import type { PrimaryAxisLeanings } from './axis-types';

// ── Controlled tag vocabularies ────────────────────────

/**
 * Listener priority tags — closed set.
 * Inferred from system axis positions and component patterns.
 * Used in key observation and future ListenerProfile integration.
 */
export type ListenerPriority =
  | 'timing_accuracy'
  | 'low_stored_energy'
  | 'rhythmic_articulation'
  | 'transient_speed'
  | 'microdynamic_expression'
  | 'tonal_density'
  | 'tonal_warmth'
  | 'spatial_openness'
  | 'fatigue_resistance'
  | 'harmonic_richness'
  | 'dynamic_contrast'
  | 'control_precision'
  | 'transparency'
  | 'musical_flow';

/** Human-readable labels for listener priorities. */
export const LISTENER_PRIORITY_LABELS: Record<ListenerPriority, string> = {
  timing_accuracy: 'timing accuracy',
  low_stored_energy: 'low stored energy',
  rhythmic_articulation: 'rhythmic articulation',
  transient_speed: 'transient speed',
  microdynamic_expression: 'microdynamic expression',
  tonal_density: 'tonal density',
  tonal_warmth: 'tonal warmth',
  spatial_openness: 'spatial openness',
  fatigue_resistance: 'fatigue resistance',
  harmonic_richness: 'harmonic richness',
  dynamic_contrast: 'dynamic contrast',
  control_precision: 'control and precision',
  transparency: 'transparency',
  musical_flow: 'musical flow',
};

/**
 * Deliberateness signal tags — closed set.
 * Detected by assessSystemDeliberateness() when the component
 * choices suggest an intentional, coherent build.
 */
export type DeliberatenessSignal =
  | 'consistent_axis_alignment'
  | 'multi_brand_coherence'
  | 'complementary_compensation'
  | 'price_tier_consistency'
  | 'design_philosophy_match'
  | 'specialist_brands_present'
  | 'punches_above_tier';

/**
 * Bottleneck constraint categories — closed set.
 * Matches the existing ConstraintCategory in the pipeline.
 */
export type ConstraintCategory =
  | 'dac_limitation'
  | 'speaker_scale'
  | 'amplifier_control'
  | 'tonal_imbalance'
  | 'stacked_bias'
  | 'source_limitation';

/**
 * Component verdict — how the deterministic engine classifies
 * each component's status in the system.
 */
export type ComponentVerdict = 'keep' | 'upgrade' | 'bottleneck' | 'neutral';

/**
 * Catalog source quality — how the component was characterised.
 */
export type CatalogSource = 'product' | 'brand' | 'inferred';

// ── Core contract ──────────────────────────────────────

/**
 * Per-component structured findings.
 * All fields are factual / tag-based. No prose.
 */
export interface ComponentFindings {
  /** Display name (e.g. "Chord Qutest", "Pass Labs INT-25"). */
  name: string;
  /** Role in the signal chain. */
  role: string;
  /** How the component was characterised. */
  catalogSource: CatalogSource;
  /** This component's axis position. */
  axisPosition: PrimaryAxisLeanings;
  /** Short factual strength phrases (not prose sentences). */
  strengths: string[];
  /** Short factual weakness phrases. */
  weaknesses: string[];
  /** Deterministic verdict. */
  verdict: ComponentVerdict;
  /** Architecture topology if known (e.g. "FPGA pulse array", "R-2R"). */
  architecture?: string;
}

/**
 * Stacked trait finding — when 2+ components push the same direction.
 */
export interface StackedTraitFinding {
  /** Sonic property tag (e.g. "high_speed", "high_density"). */
  property: string;
  /** Which components contribute. */
  contributors: string[];
  /** Whether this stacking is system identity or a problematic imbalance. */
  classification: 'system_character' | 'system_imbalance';
}

/**
 * Primary constraint (bottleneck) finding.
 */
export interface BottleneckFinding {
  /** Component display name. */
  component: string;
  /** Component role. */
  role: string;
  /** Constraint category tag. */
  category: ConstraintCategory;
  /** Which axes are constrained (e.g. ['warm_bright', 'smooth_detailed']). */
  constrainedAxes: string[];
  /** Severity score from the detection pipeline. */
  severity: number;
}

/**
 * Ranked upgrade path finding.
 */
export interface UpgradePathFinding {
  /** Display rank (1 = highest impact). */
  rank: number;
  /** Target role (e.g. "DAC", "Speakers"). */
  targetRole: string;
  /** Impact tier tag. */
  impact: 'highest' | 'moderate' | 'refinement';
  /** Which axes this path addresses. */
  targetAxes: string[];
  /** Product options within this path. */
  options: UpgradeOptionFinding[];
}

/**
 * A single product option within an upgrade path.
 */
export interface UpgradeOptionFinding {
  /** Product name. */
  name: string;
  /** Brand name. */
  brand: string;
  /** Price range string (e.g. "~$900–1200 used"). */
  priceRange: string;
  /** What this option brings (axis profile). */
  axisProfile: PrimaryAxisLeanings;
}

/**
 * Keep recommendation finding.
 */
export interface KeepFinding {
  /** Component name. */
  name: string;
  /** Component role. */
  role: string;
  /** Which axes this component aligns well on. */
  alignedAxes: string[];
}

/**
 * Recommended upgrade step (deterministic sequence).
 */
export interface RecommendedStepFinding {
  /** Step number (1-based). */
  step: number;
  /** Action verb + target (e.g. "Replace DAC"). */
  action: string;
  /** Target component name if applicable. */
  targetComponent?: string;
  /** Target role. */
  targetRole: string;
}

/**
 * Source reference from a catalogued product.
 */
export interface SourceReferenceFinding {
  /** Publication or reviewer name. */
  source: string;
  /** What the source covers. */
  note: string;
}

// ── The contract ───────────────────────────────────────

/**
 * MemoFindings — complete structured output of the deterministic
 * assessment pipeline.
 *
 * Both the deterministic template renderer and the LLM overlay
 * renderer consume this contract to produce the final memo.
 */
export interface MemoFindings {
  // ── Identity ──
  /** All component display names in the system. */
  componentNames: string[];
  /** System chain for display. */
  systemChain: {
    roles: string[];
    names: string[];
    fullChain?: string[];
  };

  // ── Axes ──
  /** System-level synthesised axis positions. */
  systemAxes: PrimaryAxisLeanings;
  /** Per-component axis classifications. */
  perComponentAxes: {
    name: string;
    axes: PrimaryAxisLeanings;
    source: CatalogSource;
  }[];

  // ── Stacked traits ──
  /** Traits shared by 2+ components. */
  stackedTraits: StackedTraitFinding[];

  // ── Bottleneck ──
  /** Primary system constraint, or null if none detected. */
  bottleneck: BottleneckFinding | null;

  // ── Per-component verdicts ──
  /** Structured findings per component. */
  componentVerdicts: ComponentFindings[];

  // ── Upgrade paths (ranked, deterministic order) ──
  /** Ranked upgrade directions. */
  upgradePaths: UpgradePathFinding[];

  // ── Keep recommendations ──
  /** Components the engine recommends keeping. */
  keeps: KeepFinding[];

  // ── Recommended upgrade path (deterministic sequence) ──
  /** Sequenced upgrade steps. */
  recommendedSequence: RecommendedStepFinding[];

  // ── System-level signals (controlled tags only) ──
  /** Whether the system appears deliberately assembled. */
  isDeliberate: boolean;
  /** Structured signals supporting the deliberateness assessment. */
  deliberatenessSignals: DeliberatenessSignal[];
  /** Inferred listener priorities (controlled tags). */
  listenerPriorities: ListenerPriority[];

  // ── Sources ──
  /** References from catalogued products. */
  sourceReferences: SourceReferenceFinding[];
}
