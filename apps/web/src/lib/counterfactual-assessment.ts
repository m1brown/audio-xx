/**
 * Counterfactual Reasoning — Feature 6 v1
 *
 * Deterministic assessment attached to each UpgradePath where tradeoff exists.
 * Answers three questions:
 *   (a) What is the baseline trajectory if nothing changes?
 *   (b) Does this upgrade push an existing tendency too far?
 *   (c) Should the listener hold rather than act?
 *
 * No LLM involvement. All logic is deterministic.
 * Confidence floors to tradeoff.confidence — never exceeds it.
 *
 * Playbook alignment:
 *   P7  System identity (baseline preserves system character assessment)
 *   P8  Counterfactual thinking (this IS the implementation)
 *   P9  Reversibility (overcorrection risk signals irreversible shifts)
 *   P10 Restraint (restraintRecommended surfaces "do nothing")
 */

import type { TradeoffAssessment } from './tradeoff-assessment';
import type { PreferenceProtectionResult } from './preference-protection';
import type { PrimaryConstraint, StackedTraitInsight } from './advisory-response';

// ── Public type ──────────────────────────────────────

/**
 * CounterfactualAssessment — Feature 6 v1 (final schema)
 *
 * Attached to each UpgradePath where tradeoff exists.
 * Renders as at most one sentence appended to rationale.
 */
export interface CounterfactualAssessment {
  /**
   * Baseline trajectory of the current system if no change is made.
   *   'improving' — system has headroom and is being used below its ceiling
   *   'stable'    — system is functioning; change is optional
   *   'degrading' — a constraint or stacked imbalance is limiting the system
   */
  baseline: 'improving' | 'stable' | 'degrading';

  /**
   * Overcorrection risk — does this path reinforce an existing tendency too far?
   * Only fires when: stacked traits classified as system_imbalance exist
   * AND the proposed path's gains reinforce a keyword-matched trait.
   */
  overcorrectionRisk: {
    present: boolean;
    /** Which stacked trait is being reinforced. Only when present. */
    trait?: string;
    /** One-sentence explanation. Only when present. */
    reason?: string;
  };

  /**
   * Whether holding is the recommended outcome for this path.
   *
   * True when ANY of:
   *   - tradeoff.netNegative is true
   *   - protection.verdict is 'block'
   *   - baseline is 'stable' AND overcorrectionRisk.present is true
   */
  restraintRecommended: boolean;

  /**
   * One sentence, affirmative framing. Only when restraintRecommended is true.
   */
  restraintReason?: string;

  /**
   * Confidence in this counterfactual assessment.
   * Floors to tradeoff.confidence for the same path. Never higher.
   * Additional floor: if baseline derived from axis data only
   * (no constraint, no stacked traits), cap at 'medium'.
   */
  confidence: 'high' | 'medium' | 'low';
}

// ── Trait keyword matching for overcorrection detection ──

/**
 * Maps stacked trait property labels to keywords that indicate
 * a gain reinforces that trait direction.
 *
 * Domain-specific vocabulary: this table is the adapter layer.
 * The matching logic itself is domain-agnostic.
 */
const TRAIT_GAIN_KEYWORDS: Record<string, readonly string[]> = {
  high_clarity:    ['clarity', 'detail', 'microdetail', 'resolution', 'transparency'],
  high_warmth:     ['warmth', 'warm', 'tonal density', 'body', 'weight'],
  high_density:    ['tonal density', 'density', 'body', 'weight', 'fullness'],
  high_speed:      ['transient', 'speed', 'attack', 'fast', 'timing'],
  high_dynamics:   ['dynamics', 'dynamic', 'punch', 'impact', 'contrast'],
  high_flow:       ['flow', 'musical flow', 'smooth', 'organic'],
  high_elasticity: ['elasticity', 'bounce', 'elastic'],
  high_spatial_precision: ['spatial', 'imaging', 'precision', 'focus'],
  high_openness:   ['openness', 'air', 'airy', 'spacious'],
  high_composure:  ['composure', 'controlled', 'control', 'grip', 'stability'],
};

function gainReinforcesImbalance(gains: string[], traitProperty: string): boolean {
  const keywords = TRAIT_GAIN_KEYWORDS[traitProperty];
  if (!keywords) return false;
  const gainsText = gains.join(' ').toLowerCase();
  return keywords.some((kw) => gainsText.includes(kw));
}

// ── Internal helpers ─────────────────────────────────

/**
 * Determine baseline trajectory from system state.
 * Priority: constraint → imbalance → stable.
 */
function determineBaseline(
  constraint: PrimaryConstraint | undefined,
  stacked: StackedTraitInsight[],
): CounterfactualAssessment['baseline'] {
  // A constraint means the system has a real limitation
  if (constraint) return 'degrading';

  // Stacked imbalances indicate drift
  const hasImbalance = stacked.some((s) => s.classification === 'system_imbalance');
  if (hasImbalance) return 'degrading';

  // No constraint, no imbalance → stable
  return 'stable';
}

/**
 * Assess overcorrection risk.
 * Fires only when:
 *   1. A stacked trait classified as system_imbalance exists
 *   2. The path's gains reinforce the same trait (keyword match)
 */
function assessOvercorrectionRisk(
  tradeoff: TradeoffAssessment,
  stacked: StackedTraitInsight[],
): CounterfactualAssessment['overcorrectionRisk'] {
  const imbalances = stacked.filter((s) => s.classification === 'system_imbalance');
  if (imbalances.length === 0) return { present: false };

  for (const imbalance of imbalances) {
    if (gainReinforcesImbalance(tradeoff.likelyGains, imbalance.property)) {
      const traitLabel = imbalance.property.replace(/^high_/, '').replace(/_/g, ' ');
      return {
        present: true,
        trait: traitLabel,
        reason: `This change reinforces ${traitLabel} in a system that already leans that way.`,
      };
    }
  }

  return { present: false };
}

/**
 * Determine whether restraint is recommended.
 * Three triggers, checked in priority order:
 */
function determineRestraint(
  netNegative: boolean,
  protectionVerdict: PreferenceProtectionResult['verdict'] | undefined,
  baseline: CounterfactualAssessment['baseline'],
  overcorrectionRisk: CounterfactualAssessment['overcorrectionRisk'],
): { restraintRecommended: boolean; restraintReason?: string } {
  if (netNegative) {
    return {
      restraintRecommended: true,
      restraintReason: 'The trade-offs outweigh the likely gains for this system.',
    };
  }
  if (protectionVerdict === 'block') {
    return {
      restraintRecommended: true,
      restraintReason: 'This change threatens a stated listening priority.',
    };
  }
  if (baseline === 'stable' && overcorrectionRisk.present) {
    return {
      restraintRecommended: true,
      restraintReason: 'The system is working and this change would push an existing tendency further.',
    };
  }
  return { restraintRecommended: false };
}

/**
 * Floor confidence to tradeoff confidence.
 * Additional cap: axis-only baseline (no constraint, no stacked) → medium max.
 */
function floorConfidence(
  tradeoffConfidence: 'high' | 'medium' | 'low',
  constraint: PrimaryConstraint | undefined,
  stacked: StackedTraitInsight[],
): 'high' | 'medium' | 'low' {
  const RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };
  let conf = tradeoffConfidence;

  // If baseline derived from axis data only (no constraint, no stacked traits), cap at medium
  if (!constraint && stacked.length === 0) {
    conf = RANK[conf] > RANK['medium'] ? 'medium' : conf;
  }

  return conf;
}

// ── Public API ───────────────────────────────────────

/**
 * Assess the counterfactual for a single upgrade path.
 *
 * Called once per path in buildUpgradePaths(), after tradeoff and protection.
 * Always computes baseline, restraintRecommended, and confidence.
 */
export function assessCounterfactual(params: {
  tradeoff: TradeoffAssessment;
  protection: PreferenceProtectionResult | undefined;
  constraint: PrimaryConstraint | undefined;
  stacked: StackedTraitInsight[];
}): CounterfactualAssessment {
  const { tradeoff, protection, constraint, stacked } = params;

  const baseline = determineBaseline(constraint, stacked);
  const overcorrectionRisk = assessOvercorrectionRisk(tradeoff, stacked);
  const { restraintRecommended, restraintReason } = determineRestraint(
    tradeoff.netNegative,
    protection?.verdict,
    baseline,
    overcorrectionRisk,
  );
  const confidence = floorConfidence(tradeoff.confidence, constraint, stacked);

  return {
    baseline,
    overcorrectionRisk,
    restraintRecommended,
    restraintReason,
    confidence,
  };
}
