/**
 * Trade-off Enforcement — Feature 2
 *
 * Ensures every upgrade-path recommendation explicitly identifies
 * what is gained, what is potentially lost, what must be preserved,
 * and how confident the assessment is.
 *
 * Playbook alignment:
 *   P1  Design → Behavior → Experience (trade-offs flow from design data)
 *   P2  Trade-off discipline (likelySacrifices on every path)
 *   P3  Preference protection (preservedStrengths)
 *   P5  Confidence calibration (provenance-based)
 *   P6  Partial knowledge (degrade confidence, surface uncertainty)
 *   P10 Restraint (netNegative → "do nothing" signal)
 */

import type { InferenceResult } from './inference-layer';
import type {
  PrimaryConstraint,
  StackedTraitInsight,
  ComponentAssessment,
} from './advisory-response';
import type { PrimaryAxisLeanings } from './axis-types';
import { resolveConstraintClass } from './constraint-adapter';

// ── Types ────────────────────────────────────────────

/** Provenance of the trade-off data. Aligned with Feature 1 inference sources. */
export type TradeoffSource =
  | 'curated'              // from product tendencies.tradeoffs
  | 'structured_inference'  // from design archetype or amp topology table
  | 'delta_inference';      // from axis delta comparison only

/** How significant the overall change is. */
export type TradeoffMagnitude = 'high' | 'moderate' | 'subtle';

/** Trade-off confidence level. */
export type TradeoffConfidence = 'high' | 'medium' | 'low';

/** What a recommended change is likely to gain and sacrifice. */
export interface TradeoffAssessment {
  /** What this change is likely to improve. Tied to system context. */
  likelyGains: string[];

  /**
   * What this change may compromise or reduce.
   * Usually non-empty for real recommendations.
   * May be empty ONLY when confidence is 'low' and confidenceReason
   * explains why sacrifices could not be determined.
   * Never populated with invented data.
   */
  likelySacrifices: string[];

  /** What the current system does well that this change should not degrade. */
  preservedStrengths: string[];

  /** How significant the overall shift is. */
  magnitude: TradeoffMagnitude;

  /** How confident we are in this trade-off assessment. */
  confidence: TradeoffConfidence;

  /** Why we are or aren't confident. One sentence. */
  confidenceReason: string;

  /** Whether trade-offs likely outweigh gains — signals "do nothing" preference. */
  netNegative: boolean;

  /** Provenance of the trade-off data. */
  source: TradeoffSource;
}

// ── High-magnitude constraint classes (engine-level) ──

const HIGH_MAGNITUDE_CLASSES: ReadonlySet<string> = new Set([
  'critical_mismatch',
  'systemic_imbalance',
]);

// ── Sacrifice extraction ─────────────────────────────

/**
 * Extract sacrifice strings from curated product trade-off data.
 * Returns non-empty array if curated data exists, empty otherwise.
 */
function sacrificesFromCurated(inference: InferenceResult | undefined): string[] {
  if (!inference?.hasCuratedData) return [];
  // The tradeoffSummary from curated source has the form "gains at the cost of cost"
  // We need the cost portion. If the source is curated_profile and tradeoffSummary exists,
  // extract it.
  if (inference.source !== 'curated_profile' && inference.source !== 'numeric_traits') return [];
  if (!inference.tradeoffSummary) return [];

  // The summary is formatted as "X at the cost of Y" by the inference layer
  const costMatch = inference.tradeoffSummary.match(/at the cost of\s+(.+)/i);
  if (costMatch) {
    return [costMatch[1].trim()];
  }
  // Fallback: use the whole summary as context
  return [inference.tradeoffSummary];
}

/**
 * Extract sacrifice strings from archetype or amp topology trade-off data.
 */
function sacrificesFromStructured(inference: InferenceResult | undefined): string[] {
  if (!inference?.tradeoffSummary) return [];
  if (inference.source !== 'design_archetype' && inference.source !== 'amp_topology') return [];

  const costMatch = inference.tradeoffSummary.match(/at the cost of\s+(.+)/i);
  if (costMatch) {
    return [costMatch[1].trim()];
  }
  return [inference.tradeoffSummary];
}

/**
 * Infer sacrifices from axis delta between target component and system.
 * Identifies dimensions where the system is currently strong and the
 * target component is weaker or opposing.
 */
function sacrificesFromAxisDelta(
  targetAssessment: ComponentAssessment,
  systemAxes: PrimaryAxisLeanings,
): string[] {
  const sacrifices: string[] = [];

  // Use the target's strengths as proxies for what the system gains
  // from this component. If the component has strengths, those are
  // what would be at risk in an upgrade.
  // We convert axis leanings to readable descriptions of risk.

  const axes: Array<{
    key: keyof PrimaryAxisLeanings;
    leftLabel: string;
    rightLabel: string;
    leftValue: string;
    rightValue: string;
  }> = [
    { key: 'warm_bright', leftLabel: 'tonal warmth', rightLabel: 'transient brightness', leftValue: 'warm', rightValue: 'bright' },
    { key: 'smooth_detailed', leftLabel: 'musical smoothness', rightLabel: 'analytical detail', leftValue: 'smooth', rightValue: 'detailed' },
    { key: 'elastic_controlled', leftLabel: 'dynamic elasticity', rightLabel: 'stability and grip', leftValue: 'elastic', rightValue: 'controlled' },
    { key: 'airy_closed', leftLabel: 'spatial openness', rightLabel: 'spatial focus', leftValue: 'airy', rightValue: 'closed' },
  ];

  for (const axis of axes) {
    const sysVal = systemAxes[axis.key];
    if (!sysVal || sysVal === 'neutral' || typeof sysVal === 'number') continue;

    // If the system leans one way, and the target assessment's strengths
    // include something aligned with that lean, an upgrade away from
    // this component risks losing that quality.
    const systemLabel = sysVal === axis.leftValue ? axis.leftLabel : axis.rightLabel;
    const hasMatchingStrength = targetAssessment.strengths.some((s) =>
      s.toLowerCase().includes(systemLabel.split(' ').pop() ?? ''),
    );

    if (hasMatchingStrength) {
      sacrifices.push(`may reduce ${systemLabel} that the current component provides`);
    }
  }

  return sacrifices;
}

// ── Gains derivation ─────────────────────────────────

/**
 * Derive likely gains from the upgrade context.
 */
function deriveGains(
  targetAssessment: ComponentAssessment,
  constraint: PrimaryConstraint | undefined,
  pathImpact: 'highest' | 'moderate' | 'refinement',
): string[] {
  const gains: string[] = [];

  if (pathImpact === 'highest' && constraint) {
    // Bottleneck path: gains come from resolving the constraint
    gains.push(constraint.explanation);
  }

  // Secondary/refinement: gains from addressing weaknesses
  if (targetAssessment.weaknesses.length > 0) {
    const weaknessList = targetAssessment.weaknesses.slice(0, 2);
    for (const w of weaknessList) {
      // Don't duplicate constraint explanation
      if (gains.length > 0 && gains[0].toLowerCase().includes(w.toLowerCase().slice(0, 15))) continue;
      gains.push(`Addresses: ${w.toLowerCase()}`);
    }
  }

  // Ensure at least one gain
  if (gains.length === 0) {
    gains.push('Potential refinement to system balance');
  }

  return gains.slice(0, 3);
}

// ── Preserved strengths ──────────────────────────────

/**
 * Identify what the current system does well that should not be degraded.
 */
function derivePreservedStrengths(
  targetAssessment: ComponentAssessment,
  stacked: StackedTraitInsight[],
): string[] {
  const strengths: string[] = [];

  // Component's own strengths (what the current component contributes)
  for (const s of targetAssessment.strengths.slice(0, 3)) {
    strengths.push(s);
  }

  // System-character stacked traits this component participates in
  const characterTraits = stacked.filter(
    (s) =>
      s.classification === 'system_character'
      && s.contributors.some(
        (c) => c.toLowerCase() === targetAssessment.name.toLowerCase(),
      ),
  );
  for (const trait of characterTraits) {
    const entry = `System character: ${trait.label}`;
    if (!strengths.includes(entry)) {
      strengths.push(entry);
    }
  }

  return strengths.slice(0, 3);
}

// ── Magnitude determination ──────────────────────────

function determineMagnitude(
  pathImpact: 'highest' | 'moderate' | 'refinement',
  constraint: PrimaryConstraint | undefined,
): TradeoffMagnitude {
  if (
    pathImpact === 'highest'
    && constraint
    && HIGH_MAGNITUDE_CLASSES.has(resolveConstraintClass(constraint.category) ?? '')
  ) {
    return 'high';
  }
  if (pathImpact === 'refinement') {
    return 'subtle';
  }
  return 'moderate';
}

// ── Confidence determination ─────────────────────────

/** Confidence level ordering for min() comparisons. */
const CONFIDENCE_RANK: Record<TradeoffConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/** Return the lower of two confidence levels. */
function minConfidence(a: TradeoffConfidence, b: TradeoffConfidence): TradeoffConfidence {
  return CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b;
}

/**
 * Map inference-layer confidence to tradeoff confidence.
 * Inference uses 4 levels (high/medium/low/none); tradeoff uses 3.
 * 'none' and undefined map to 'low'.
 */
function inferenceToTradeoffConfidence(
  inference: InferenceResult | undefined,
): TradeoffConfidence {
  if (!inference || inference.confidence === 'none') return 'low';
  return inference.confidence;
}

function determineConfidence(
  inference: InferenceResult | undefined,
  sacrificeSource: TradeoffSource,
): { confidence: TradeoffConfidence; reason: string } {
  // Step 1: determine confidence from sacrifice source provenance
  let sourceConfidence: TradeoffConfidence;
  let reason: string;

  if (sacrificeSource === 'curated') {
    sourceConfidence = 'high';
    reason = 'Trade-off data derived from curated product profiles with explicit gains and costs.';
  } else if (sacrificeSource === 'structured_inference') {
    sourceConfidence = 'medium';
    reason = 'Trade-offs inferred from design archetype or amplifier topology patterns.';
  } else if (!inference || inference.source === 'none') {
    sourceConfidence = 'low';
    reason = 'Insufficient product data to determine specific trade-offs; assessment based on axis position only.';
  } else {
    sourceConfidence = 'low';
    reason = 'Trade-offs estimated from axis comparison; no curated or archetype-level data available.';
  }

  // Step 2: floor to target component's inference confidence (Feature 5)
  const inferenceConfidence = inferenceToTradeoffConfidence(inference);
  const effective = minConfidence(sourceConfidence, inferenceConfidence);

  if (CONFIDENCE_RANK[effective] < CONFIDENCE_RANK[sourceConfidence]) {
    reason += ' Capped by limited component data.';
  }

  return { confidence: effective, reason };
}

// ── netNegative evaluation ───────────────────────────

/**
 * Determine whether trade-offs likely outweigh gains.
 *
 * v1 heuristic — conservative, biased toward false negatives.
 * Three testable rules:
 *   1. A sacrifice directly threatens a preserved strength (keyword overlap)
 *   2. High magnitude with low confidence
 *   3. Minor gains (≤1) with meaningful sacrifices (≥2) and confidence < high
 */
export function assessNetNegative(
  likelyGains: string[],
  likelySacrifices: string[],
  preservedStrengths: string[],
  magnitude: TradeoffMagnitude,
  confidence: TradeoffConfidence,
): boolean {
  // Rule 1: sacrifice threatens a preserved strength
  // Direct keyword overlap — conservative, no fuzzy matching.
  // Extract significant words (≥4 chars) from each side and check intersection.
  if (likelySacrifices.length > 0 && preservedStrengths.length > 0) {
    const strengthWords = new Set(
      preservedStrengths
        .join(' ')
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length >= 4),
    );

    for (const sacrifice of likelySacrifices) {
      const sacrificeWords = sacrifice
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length >= 4);

      // Require at least 2 overlapping words to trigger — avoids false positives
      // from generic words like "system" or "current"
      const overlap = sacrificeWords.filter((w) => strengthWords.has(w));
      if (overlap.length >= 2) {
        return true;
      }
    }
  }

  // Rule 2: high magnitude + low confidence
  if (magnitude === 'high' && confidence === 'low') {
    return true;
  }

  // Rule 3: minor gains with meaningful sacrifices, uncertain data
  if (
    likelyGains.length <= 1
    && likelySacrifices.length >= 2
    && confidence !== 'high'
  ) {
    return true;
  }

  return false;
}

// ── Main entry point ─────────────────────────────────

/**
 * Assess the trade-offs of a recommended upgrade path.
 *
 * Called once per upgrade path in buildUpgradePaths().
 * Returns a structured assessment tied to system context.
 */
export function assessTradeoffs(
  targetAssessment: ComponentAssessment,
  targetInference: InferenceResult | undefined,
  pathImpact: 'highest' | 'moderate' | 'refinement',
  constraint: PrimaryConstraint | undefined,
  stacked: StackedTraitInsight[],
  systemAxes: PrimaryAxisLeanings,
): TradeoffAssessment {
  // ── Gains ──
  const likelyGains = deriveGains(targetAssessment, constraint, pathImpact);

  // ── Preserved strengths ──
  const preservedStrengths = derivePreservedStrengths(targetAssessment, stacked);

  // ── Sacrifices (3-level fallback, first non-empty wins) ──
  let likelySacrifices: string[] = [];
  let source: TradeoffSource = 'delta_inference';

  // Level 1: curated product trade-off data
  const curatedSacrifices = sacrificesFromCurated(targetInference);
  if (curatedSacrifices.length > 0) {
    likelySacrifices = curatedSacrifices;
    source = 'curated';
  }

  // Level 2: archetype / amp topology
  if (likelySacrifices.length === 0) {
    const structuredSacrifices = sacrificesFromStructured(targetInference);
    if (structuredSacrifices.length > 0) {
      likelySacrifices = structuredSacrifices;
      source = 'structured_inference';
    }
  }

  // Level 3: axis delta inference
  if (likelySacrifices.length === 0) {
    const deltaSacrifices = sacrificesFromAxisDelta(targetAssessment, systemAxes);
    if (deltaSacrifices.length > 0) {
      likelySacrifices = deltaSacrifices;
      source = 'delta_inference';
    }
  }

  // ── Magnitude ──
  const magnitude = determineMagnitude(pathImpact, constraint);

  // ── Confidence ──
  const { confidence, reason: confidenceReason } = determineConfidence(
    targetInference,
    source,
  );

  // ── netNegative ──
  const netNegative = assessNetNegative(
    likelyGains,
    likelySacrifices,
    preservedStrengths,
    magnitude,
    confidence,
  );

  return {
    likelyGains,
    likelySacrifices,
    preservedStrengths,
    magnitude,
    confidence,
    confidenceReason,
    netNegative,
    source,
  };
}
