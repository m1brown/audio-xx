/**
 * AdvisorContext (Audio XX vI, Phase 0)
 *
 * The grounded interface between the deterministic Audio XX engine and the
 * A3 advisor layer. It is a PURE PROJECTION of MemoFindings (+ optional
 * emergent behaviors): grounded facts only — no generated prose, no rendered
 * summaries, no narrative fragments.
 *
 * Designed to be reused later for comparisons / upgrade advice / shopping /
 * consultation chat, not only assessments — hence the `intent` discriminator
 * and the generic `system` / `signals` / `recommendations` shape.
 *
 * The deterministic engine remains the source of truth for everything in
 * here. A3 reasons FROM this object; it must never contradict or extend it.
 */

import type { MemoFindings } from './memo-findings';
import type { PrimaryAxisLeanings } from './axis-types';
import type { EmergentBehavior } from './emergent-behavior';

export type AdvisorIntent =
  | 'assessment'
  | 'comparison'
  | 'upgrade'
  | 'shopping'
  | 'consultation';

export interface AdvisorContextComponent {
  name: string;
  roles: string[];
  axisPosition: PrimaryAxisLeanings;
  strengths: string[];
  weaknesses: string[];
  verdict: string;
  architecture?: string;
  priceTier?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface AdvisorContext {
  intent: AdvisorIntent;

  system: {
    chain: { roles: string[]; names: string[] };
    components: AdvisorContextComponent[];
    /** System-level synthesised axis positions — the binding calibrated truth. */
    axes: PrimaryAxisLeanings;
    tier?: string;
  };

  signals: {
    stackedTraits: MemoFindings['stackedTraits'];
    bottleneck: MemoFindings['bottleneck'];
    listenerPriorities: MemoFindings['listenerPriorities'];
    emergentBehaviors: EmergentBehavior[];
    synergy: {
      isCoherent: boolean;
      isDeliberate: boolean;
      sharedTraits: string[];
      tradeoffs: string[];
    };
    activeDAC: MemoFindings['activeDACInference'];
    powerMatch: MemoFindings['powerMatchAssessment'];
  };

  recommendations: {
    upgradePaths: MemoFindings['upgradePaths'];
    keeps: MemoFindings['keeps'];
    recommendedSequence: MemoFindings['recommendedSequence'];
  };

  evidence: { sources: MemoFindings['sourceReferences'] };
}

/**
 * Build an AdvisorContext from completed deterministic findings.
 *
 * Pure and side-effect-free. Whitelists grounded fields only — by
 * construction it cannot carry composed prose (introSummary, systemContext,
 * keyObservation are never read here).
 */
export function toAdvisorContext(
  findings: MemoFindings,
  opts?: { intent?: AdvisorIntent; emergentBehaviors?: EmergentBehavior[] },
): AdvisorContext {
  return {
    intent: opts?.intent ?? 'assessment',
    system: {
      chain: {
        roles: findings.systemChain.roles,
        names: findings.systemChain.names,
      },
      components: findings.componentVerdicts.map((c) => ({
        name: c.name,
        roles: c.roles,
        axisPosition: c.axisPosition,
        strengths: c.strengths,
        weaknesses: c.weaknesses,
        verdict: c.verdict,
        architecture: c.architecture,
        priceTier: c.priceTier,
        confidence: c.confidence,
      })),
      axes: findings.systemAxes,
      tier: undefined,
    },
    signals: {
      stackedTraits: findings.stackedTraits,
      bottleneck: findings.bottleneck,
      listenerPriorities: findings.listenerPriorities,
      emergentBehaviors: opts?.emergentBehaviors ?? [],
      synergy: {
        isCoherent: findings.isCoherent,
        isDeliberate: findings.isDeliberate,
        sharedTraits: findings.coherentSharedTraits,
        tradeoffs: findings.coherentTradeoffs,
      },
      activeDAC: findings.activeDACInference,
      powerMatch: findings.powerMatchAssessment,
    },
    recommendations: {
      upgradePaths: findings.upgradePaths,
      keeps: findings.keeps,
      recommendedSequence: findings.recommendedSequence,
    },
    evidence: { sources: findings.sourceReferences },
  };
}
