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
import type { InferenceResult } from './inference-layer';
import type { TradeoffAssessment } from './tradeoff-assessment';
import type { PreferenceProtectionResult } from './preference-protection';
import type { CounterfactualAssessment } from './counterfactual-assessment';

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
  | 'source_limitation'
  | 'power_match';

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
  /** Primary role in the signal chain (backward compat). */
  role: string;
  /**
   * All functional roles this component fulfills.
   * E.g., a Bluesound Node → ['streamer', 'dac'].
   * Always contains at least the primary role.
   */
  roles: string[];
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
  /** Architecture topology if known (e.g. "FPGA pulse array", "R2R"). */
  architecture?: string;
  /** Price tier from catalog (e.g. "budget", "mid", "upper-mid", "high-end"). */
  priceTier?: string;
  /** Approximate price if known. */
  price?: number;
  /** Product/brand links associated with this component. */
  links?: Array<{ label: string; url: string; kind?: 'reference' | 'dealer' | 'review'; region?: string }>;
  /**
   * Inference layer result for this component.
   * Present when a product was matched and design signals exist.
   * When hasCuratedData is true, curated tendencyProfile takes precedence.
   */
  inference?: InferenceResult;
  /**
   * How confident the system is in this component's behavioral assessment.
   * Derived from inference confidence: high/medium/low.
   * When no inference exists, defaults to 'low'.
   */
  confidence: 'high' | 'medium' | 'low';
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
  /** Min confidence of contributing components. */
  confidence?: 'high' | 'medium' | 'low';
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
  /** Confidence in the bottleneck identification, from the bottleneck component. */
  confidence?: 'high' | 'medium' | 'low';
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
  /** Trade-off assessment for this path. Populated by Feature 2. */
  tradeoff?: TradeoffAssessment;
  /** Preference protection assessment. Populated by Feature 3. */
  protection?: PreferenceProtectionResult;
  /** Counterfactual reasoning assessment. Populated by Feature 6. */
  counterfactual?: CounterfactualAssessment;
  /** Strategy label — short name for optimization direction. Populated by Feature 7. */
  strategyLabel?: string;
  /** Strategy intent — what this path optimizes. Populated by Feature 7. */
  strategyIntent?: string;
  /** Concise explanation lines ("why this works"). Max 2. Populated by Feature 9. */
  explanation?: string[];
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
  /** Direct URL to the review or source, if available. */
  url?: string;
}

// ── Active DAC inference ──────────────────────────────

/**
 * Result of active DAC inference.
 *
 * This is a topology-based best guess, not a confirmed signal path.
 * When multiple DAC-capable components exist, this identifies which one
 * is most likely defining the system's digital-to-analogue conversion.
 */
export interface ActiveDACInference {
  /** Display name of the inferred active DAC, or null if ambiguous. */
  activeDACName: string | null;
  /** How the active DAC is hosted: standalone unit, built into amp, or built into source. */
  activeDACType: 'standalone' | 'integrated' | 'source' | null;
  /** True when 2+ components have DAC capability. */
  multipleDACs: boolean;
  /** True when inference cannot resolve a clear winner. */
  needsDACClarification: boolean;
  /**
   * How much we trust this inference.
   * - high: exactly one DAC-capable component — no ambiguity
   * - medium: multiple DACs but priority cleanly selects one
   * - low: same-priority tie, malformed data, or classification ambiguity
   */
  confidence: 'high' | 'medium' | 'low';
}

// ── Amp/speaker power-match assessment ───────────────────

/**
 * Result of amp/speaker power-match inference.
 *
 * Evaluates whether the amplifier can physically drive the speakers
 * to adequate listening levels without dynamic compression.
 * This is a deterministic calculation from power_watts and sensitivity_db,
 * not a subjective preference assessment.
 *
 * When data is missing for either side, compatibility is 'unknown'
 * and the assessment is invisible in the narrative.
 */
export interface PowerMatchAssessment {
  /** Display name of the amplifier, or null if no amp found. */
  ampName: string | null;
  /** Display name of the speaker, or null if no speaker found. */
  speakerName: string | null;
  /** Amp power output in watts, or null if not cataloged. */
  ampPowerWatts: number | null;
  /** Speaker sensitivity in dB, or null if not cataloged. */
  speakerSensitivityDb: number | null;
  /**
   * Compatibility tier:
   * - optimal: amp and speaker are well-matched for typical room levels
   * - adequate: workable with some headroom limitations
   * - strained: dynamics will compress at moderate-to-loud levels
   * - mismatched: amp fundamentally cannot drive these speakers
   * - unknown: missing data on one or both sides
   */
  compatibility: 'optimal' | 'adequate' | 'strained' | 'mismatched' | 'unknown';
  /**
   * Estimated maximum clean SPL at listening position (dB).
   * Calculated as: sensitivity_db + 10 * log10(power_watts).
   * Null when either input is missing.
   */
  estimatedMaxCleanSPL: number | null;
  /**
   * Relevant interaction note from the amp's catalog data,
   * if one matches the speaker's efficiency range.
   * Null when no matching interaction exists.
   */
  relevantInteraction: string | null;
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
  /**
   * Whether components share aligned voicing from specialist/boutique brands.
   * When true, axis stacking is system identity — not a constraint.
   */
  isCoherent: boolean;
  /** Traits shared by the coherent system's voicing direction. */
  coherentSharedTraits: string[];
  /** What the coherent voicing deliberately trades away. */
  coherentTradeoffs: string[];
  /** Structured signals supporting the deliberateness assessment. */
  deliberatenessSignals: DeliberatenessSignal[];
  /** Inferred listener priorities (controlled tags). */
  listenerPriorities: ListenerPriority[];

  // ── Multi-role awareness ──
  /** True when 2+ components both fulfil the DAC role. */
  hasMultipleDACs: boolean;
  /** True when 2+ components both fulfil an amplifier role. */
  hasMultipleAmps: boolean;
  /**
   * Components whose roles overlap with another component in the chain.
   * E.g., a streamer/DAC combo paired with a standalone DAC.
   */
  roleOverlaps: { role: string; components: string[] }[];

  // ── Active DAC inference ──
  /** Which DAC is most likely defining the system's sound. */
  activeDACInference: ActiveDACInference;

  // ── Amp/speaker power match ──
  /** Whether the amplifier can physically drive the speakers. */
  powerMatchAssessment: PowerMatchAssessment;

  // ── Sources ──
  /** References from catalogued products. */
  sourceReferences: SourceReferenceFinding[];
}
