/**
 * Strategy Framing — Feature 7
 *
 * Transforms upgrade paths from a ranked list of suggestions into
 * clearly differentiated strategies with distinct optimization directions.
 *
 * Each path receives:
 *   strategyLabel  — short name (3–6 words)
 *   strategyIntent — one sentence explaining what this path optimizes
 *
 * Framing is derived from existing path data (impact, tradeoff, protection,
 * counterfactual, rationale). No new data sources.
 *
 * Playbook alignment:
 *   P2  Trade-off discipline (strategies make trade-off direction explicit)
 *   P7  System identity (strategies differentiate preservation vs. change)
 *   P8  Counterfactual thinking (restraint paths framed as deliberate strategy)
 *   P10 Restraint ("do nothing" is a named strategy, not absence of action)
 */

import type { TradeoffAssessment } from './tradeoff-assessment';
import type { PreferenceProtectionResult } from './preference-protection';
import type { CounterfactualAssessment } from './counterfactual-assessment';

// ── Types ────────────────────────────────────────────

export interface StrategyFrame {
  strategyLabel: string;
  strategyIntent: string;
}

/** Minimal path data needed for strategy framing. */
export interface PathForFraming {
  rank: number;
  label: string;
  impact?: string;
  rationale?: string;
  tradeoff?: TradeoffAssessment;
  protection?: PreferenceProtectionResult;
  counterfactual?: CounterfactualAssessment;
}

// ── Gain keyword → strategy direction mapping ────────
//
// Domain-specific vocabulary: this table is the adapter layer.
// The framing logic itself is domain-agnostic (keyword match → label).

const DIRECTION_KEYWORDS: Array<{
  keywords: readonly string[];
  label: string;
  intent: string;
}> = [
  {
    keywords: ['clarity', 'detail', 'resolution', 'transparency', 'microdetail', 'precision'],
    label: 'Enhance detail and precision',
    intent: 'Optimize for resolution and transparency, trading some warmth or body.',
  },
  {
    keywords: ['warmth', 'tonal density', 'body', 'richness', 'harmonic'],
    label: 'Deepen tonal richness',
    intent: 'Optimize for warmth and harmonic density, trading some speed or analytical detail.',
  },
  {
    keywords: ['flow', 'musical flow', 'continuity', 'smooth', 'organic'],
    label: 'Preserve musical flow',
    intent: 'Optimize for musical coherence and ease, trading some precision or control.',
  },
  {
    keywords: ['speed', 'transient', 'timing', 'attack', 'fast'],
    label: 'Sharpen transient response',
    intent: 'Optimize for speed and timing precision, trading some warmth or body.',
  },
  {
    keywords: ['spatial', 'imaging', 'soundstage', 'openness', 'air'],
    label: 'Expand spatial presentation',
    intent: 'Optimize for staging and openness, trading some density or intimacy.',
  },
  {
    keywords: ['dynamics', 'punch', 'impact', 'contrast', 'slam'],
    label: 'Increase dynamic authority',
    intent: 'Optimize for dynamic range and impact, trading some subtlety or finesse.',
  },
  {
    keywords: ['control', 'grip', 'composure', 'stability', 'damping'],
    label: 'Strengthen system control',
    intent: 'Optimize for grip and composure, trading some elasticity or flow.',
  },
];

// ── Internal helpers ─────────────────────────────────

/**
 * Derive a strategy direction from a path's gains text.
 * Returns the first matching direction from DIRECTION_KEYWORDS.
 */
function deriveDirectionFromGains(gains: string[]): StrategyFrame | null {
  if (gains.length === 0) return null;
  const gainsText = gains.join(' ').toLowerCase();

  for (const dir of DIRECTION_KEYWORDS) {
    if (dir.keywords.some((kw) => gainsText.includes(kw))) {
      return { strategyLabel: dir.label, strategyIntent: dir.intent };
    }
  }

  return null;
}

/**
 * Derive strategy from path impact and structural role.
 * Used when gain-based framing doesn't match.
 */
function deriveStructuralStrategy(path: PathForFraming): StrategyFrame {
  const impact = (path.impact ?? '').toLowerCase();
  const label = (path.label ?? '').toLowerCase();

  if (impact.includes('highest')) {
    return {
      strategyLabel: 'Resolve the primary bottleneck',
      strategyIntent: 'Address the system\'s most limiting factor before refining elsewhere.',
    };
  }

  if (label.includes('rebalancing')) {
    return {
      strategyLabel: 'Rebalance system character',
      strategyIntent: 'Introduce contrasting character to broaden the system\'s range.',
    };
  }

  if (impact.includes('refinement')) {
    return {
      strategyLabel: 'Refine secondary balance',
      strategyIntent: 'Fine-tune the system without changing its core identity.',
    };
  }

  return {
    strategyLabel: 'Targeted component upgrade',
    strategyIntent: 'Improve a specific weakness while preserving overall system character.',
  };
}

// ── Public API ───────────────────────────────────────

/**
 * Frame a single path as a strategy.
 *
 * Priority:
 *   1. Restraint path → "Hold — current system is working"
 *   2. Bottleneck path → "Resolve the primary bottleneck"
 *   3. Gain-based direction → matches from DIRECTION_KEYWORDS
 *   4. Structural fallback → from impact tier and label
 */
export function frameStrategy(path: PathForFraming): StrategyFrame {
  // Restraint: counterfactual says hold
  if (path.counterfactual?.restraintRecommended) {
    return {
      strategyLabel: 'Hold — preserve current balance',
      strategyIntent: path.counterfactual.restraintReason
        ?? 'The current system balance does not clearly benefit from this change.',
    };
  }

  // Protection block: similar to restraint, but from preference protection
  if (path.protection?.verdict === 'block') {
    return {
      strategyLabel: 'Hold — protect stated priorities',
      strategyIntent: path.protection.reason,
    };
  }

  // Bottleneck resolution: highest-impact paths always get structural framing
  const impact = (path.impact ?? '').toLowerCase();
  if (impact.includes('highest')) {
    return {
      strategyLabel: 'Resolve the primary bottleneck',
      strategyIntent: 'Address the system\'s most limiting factor before refining elsewhere.',
    };
  }

  // Gain-based direction: derive from tradeoff gains
  if (path.tradeoff) {
    const direction = deriveDirectionFromGains(path.tradeoff.likelyGains);
    if (direction) return direction;
  }

  // Structural fallback
  return deriveStructuralStrategy(path);
}

/**
 * Deduplicate strategy labels across paths.
 * If two paths have the same strategyLabel, append the path's component role
 * to differentiate (e.g., "Enhance detail and precision (DAC)").
 */
export function deduplicateStrategies(
  paths: Array<PathForFraming & { strategyLabel: string; strategyIntent: string }>,
): void {
  const labelCounts = new Map<string, number>();
  for (const p of paths) {
    labelCounts.set(p.strategyLabel, (labelCounts.get(p.strategyLabel) ?? 0) + 1);
  }

  for (const p of paths) {
    if ((labelCounts.get(p.strategyLabel) ?? 0) > 1) {
      // Extract role from path label (e.g., "DAC Upgrade" → "DAC")
      const role = p.label.replace(/\s+(Upgrade|Change|refinement)$/i, '').trim();
      if (role && role !== p.strategyLabel) {
        p.strategyLabel = `${p.strategyLabel} (${role})`;
      }
    }
  }
}
