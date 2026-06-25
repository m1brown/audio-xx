/**
 * Preference Protection — Feature 3
 *
 * Prevents the system from recommending changes that degrade the
 * listener's core priorities or the system's defining strengths
 * without explicit justification.
 *
 * Key design rule:
 *   Only EXPLICIT user priorities (from DesireSignal) may trigger `block`.
 *   Inferred priorities (from system axes) may trigger `caution` only.
 *
 * Playbook alignment:
 *   P3  Preference protection (this IS the implementation)
 *   P4  Constraint hierarchy (hard constraints override protection)
 *   P5  Confidence calibration (confidence affects enforcement strength)
 *   P10 Restraint ("do nothing" when preservation outweighs correction)
 */

import type { ListenerPriority } from './memo-findings';
import { LISTENER_PRIORITY_LABELS } from './memo-findings';
import type { TradeoffAssessment } from './tradeoff-assessment';
import type { PrimaryConstraint } from './advisory-response';
import type { DesireSignal } from './intent';
import type { ListenerProfile } from './listener-preferences';
import { resolveConstraintClass } from './constraint-adapter';

// ── Types ────────────────────────────────────────────

/** Whether this priority was explicitly stated by the user or inferred. */
export type PriorityBasis = 'explicit' | 'inferred';

/** A listener priority that may be threatened by a recommendation. */
export interface PriorityThreat {
  /** Which listener priority is at risk. */
  priority: ListenerPriority;
  /** Human-readable label. */
  label: string;
  /** The sacrifice text or detection method that triggered the match. */
  threatSource: string;
  /** Whether this priority was user-stated or system-inferred. */
  basis: PriorityBasis;
}

/** Preference protection assessment for a single upgrade path. */
export interface PreferenceProtectionResult {
  /** All detected priority threats. */
  threats: PriorityThreat[];
  /** Whether any explicit (user-stated) priority is threatened. */
  explicitAtRisk: boolean;
  /** Whether any inferred priority is threatened. */
  inferredAtRisk: boolean;
  /** Whether a hard constraint overrides the threat. */
  overriddenByConstraint: boolean;
  /**
   * Verdict:
   *   'safe'    — no meaningful priority threat detected
   *   'caution' — a priority is at risk but evidence or basis is insufficient to block
   *   'block'   — an explicit priority is clearly threatened with no justification
   */
  verdict: 'safe' | 'caution' | 'block';
  /** One-sentence explanation. */
  reason: string;
}

// ── Hard constraint classes that can override protection (engine-level) ──

const HARD_CONSTRAINT_CLASSES: ReadonlySet<string> = new Set([
  'critical_mismatch',
  'systemic_imbalance',
]);

// ── Priority keyword mapping ─────────────────────────
//
// Narrow, conservative. Multi-word phrases preferred to reduce false positives.
// Each keyword must clearly correspond to one priority.

export const PRIORITY_KEYWORDS: Record<ListenerPriority, readonly string[]> = {
  timing_accuracy:         ['timing accuracy', 'time-domain'],
  rhythmic_articulation:   ['rhythmic', 'articulation', 'pace'],
  transient_speed:         ['transient speed', 'transient attack'],
  tonal_density:           ['tonal density', 'midrange weight', 'midrange body'],
  tonal_warmth:            ['tonal warmth', 'warmth'],
  harmonic_richness:       ['harmonic richness', 'harmonic texture'],
  musical_flow:            ['musical flow', 'flow', 'continuity'],
  spatial_openness:        ['spatial openness', 'soundstage', 'imaging'],
  fatigue_resistance:      ['fatigue', 'listening fatigue', 'harshness'],
  dynamic_contrast:        ['dynamic contrast', 'dynamic range', 'macro dynamics'],
  control_precision:       ['control', 'precision', 'grip', 'damping'],
  transparency:            ['transparency', 'resolution', 'detail retrieval'],
  microdynamic_expression: ['microdynamic', 'micro-expression'],
  low_stored_energy:       ['stored energy'],
};

// ── Desire → ListenerPriority mapping ────────────────
//
// Mirrors the mapping in inferListenerPriorityTags() from consultation.ts.
// Used to determine which priorities are explicitly user-stated.

const DESIRE_TO_PRIORITY: Array<{ keywords: string[]; priority: ListenerPriority }> = [
  { keywords: ['detail', 'clarity'],                priority: 'transparency' },
  { keywords: ['warm', 'body', 'rich'],             priority: 'tonal_warmth' },
  { keywords: ['spatial', 'stage', 'air'],          priority: 'spatial_openness' },
  { keywords: ['dynamics', 'punch'],                priority: 'dynamic_contrast' },
  { keywords: ['timing', 'rhythm'],                 priority: 'rhythmic_articulation' },
  { keywords: ['flow', 'smooth'],                   priority: 'musical_flow' },
  { keywords: ['density', 'weight'],                priority: 'tonal_density' },
  { keywords: ['speed', 'fast', 'transient'],       priority: 'transient_speed' },
  { keywords: ['control', 'grip'],                  priority: 'control_precision' },
  { keywords: ['fatigue', 'ease', 'gentle'],        priority: 'fatigue_resistance' },
  { keywords: ['harmonic', 'texture'],              priority: 'harmonic_richness' },
];

// ── Axis → priority alignment (for empty-sacrifice fallback) ──

const AXIS_PRIORITY_ALIGNMENT: Record<string, {
  leftPriorities: ListenerPriority[];
  rightPriorities: ListenerPriority[];
  leftLabel: string;
  rightLabel: string;
}> = {
  warm_bright: {
    leftPriorities: ['tonal_warmth', 'harmonic_richness', 'tonal_density'],
    rightPriorities: ['transient_speed', 'transparency'],
    leftLabel: 'warm',
    rightLabel: 'bright',
  },
  smooth_detailed: {
    leftPriorities: ['musical_flow', 'fatigue_resistance'],
    rightPriorities: ['transparency', 'microdynamic_expression'],
    leftLabel: 'smooth',
    rightLabel: 'detailed',
  },
  elastic_controlled: {
    leftPriorities: ['rhythmic_articulation', 'timing_accuracy'],
    rightPriorities: ['control_precision', 'dynamic_contrast'],
    leftLabel: 'elastic',
    rightLabel: 'controlled',
  },
};

// ── Priority classification ──────────────────────────

export interface ClassifiedPriorities {
  explicit: Set<ListenerPriority>;
  inferred: Set<ListenerPriority>;
}

/**
 * Classify listener priorities into explicit (user-stated) and inferred.
 *
 * Explicit = derived from DesireSignal (user said "I want more X").
 * Inferred = from system axis position (not directly stated by user).
 *
 * Computed once, reused across all paths.
 */
export function classifyPriorities(
  listenerPriorities: ListenerPriority[],
  desires?: DesireSignal[],
): ClassifiedPriorities {
  const explicit = new Set<ListenerPriority>();

  // Map desires to priorities
  if (desires) {
    for (const d of desires) {
      if (d.direction !== 'more') continue;
      const q = d.quality.toLowerCase();
      for (const mapping of DESIRE_TO_PRIORITY) {
        if (mapping.keywords.some((kw) => q.includes(kw))) {
          explicit.add(mapping.priority);
        }
      }
    }
  }

  // Everything in listenerPriorities that isn't explicit is inferred
  const inferred = new Set<ListenerPriority>();
  for (const p of listenerPriorities) {
    if (!explicit.has(p)) {
      inferred.add(p);
    }
  }

  return { explicit, inferred };
}

// ── Intent stance (P1 — shared intent gate) ──────────
//
// Recommendation = Judgment × User Intent.
//
// The system assessment ("Judgment") is observer-invariant. The recommendation
// surfaces multiply that judgment by what the USER actually wants. Per the
// frozen ontology, User Intent comes ONLY from explicit DesireSignals and the
// accumulated ListenerProfile — NEVER from system-inferred listenerPriorities
// or from the system's own axis positions. deriveIntentStance() is the single
// place that reads those two intent sources and resolves them to a directional
// lean (or null) on each of the four canonical axes.

export type IntentAxis =
  | 'warm_bright'
  | 'smooth_detailed'
  | 'elastic_controlled'
  | 'airy_closed';

export type IntentSide =
  | 'warm' | 'bright'
  | 'smooth' | 'detailed'
  | 'elastic' | 'controlled'
  | 'airy' | 'closed';

/**
 * Per-axis directional intent. A side means the user wants the system to lean
 * that way; null means no resolvable intent on that axis (silent or ambiguous).
 */
export interface IntentStance {
  warm_bright: 'warm' | 'bright' | null;
  smooth_detailed: 'smooth' | 'detailed' | null;
  elastic_controlled: 'elastic' | 'controlled' | null;
  airy_closed: 'airy' | 'closed' | null;
  /** True when the user has expressed any directional intent at all. */
  hasIntent: boolean;
}

const AXIS_OPPOSITE: Record<IntentSide, IntentSide> = {
  warm: 'bright', bright: 'warm',
  smooth: 'detailed', detailed: 'smooth',
  elastic: 'controlled', controlled: 'elastic',
  airy: 'closed', closed: 'airy',
};

/**
 * Canonical quality token (from intent.ts KNOWN_QUALITIES) → axis + the side it
 * expresses when the user wants MORE of it. A "less" desire flips to the
 * opposite side. Intentionally conservative — only tokens with an unambiguous
 * axis-side are mapped; ambiguous ones (speed, attack) are omitted.
 */
const DESIRE_TO_AXIS: Record<string, { axis: IntentAxis; side: IntentSide }> = {
  // warm_bright
  warmth: { axis: 'warm_bright', side: 'warm' },
  body: { axis: 'warm_bright', side: 'warm' },
  richness: { axis: 'warm_bright', side: 'warm' },
  density: { axis: 'warm_bright', side: 'warm' },
  weight: { axis: 'warm_bright', side: 'warm' },
  brightness: { axis: 'warm_bright', side: 'bright' },
  edge: { axis: 'warm_bright', side: 'bright' },
  // smooth_detailed
  detail: { axis: 'smooth_detailed', side: 'detailed' },
  resolution: { axis: 'smooth_detailed', side: 'detailed' },
  clarity: { axis: 'smooth_detailed', side: 'detailed' },
  transparency: { axis: 'smooth_detailed', side: 'detailed' },
  texture: { axis: 'smooth_detailed', side: 'detailed' },
  smoothness: { axis: 'smooth_detailed', side: 'smooth' },
  ease: { axis: 'smooth_detailed', side: 'smooth' },
  relaxation: { axis: 'smooth_detailed', side: 'smooth' },
  flow: { axis: 'smooth_detailed', side: 'smooth' },
  musicality: { axis: 'smooth_detailed', side: 'smooth' },
  naturalness: { axis: 'smooth_detailed', side: 'smooth' },
  // elastic_controlled
  dynamics: { axis: 'elastic_controlled', side: 'elastic' },
  punch: { axis: 'elastic_controlled', side: 'elastic' },
  slam: { axis: 'elastic_controlled', side: 'elastic' },
  energy: { axis: 'elastic_controlled', side: 'elastic' },
  excitement: { axis: 'elastic_controlled', side: 'elastic' },
  rhythm: { axis: 'elastic_controlled', side: 'elastic' },
  pace: { axis: 'elastic_controlled', side: 'elastic' },
  timing: { axis: 'elastic_controlled', side: 'elastic' },
  control: { axis: 'elastic_controlled', side: 'controlled' },
  grip: { axis: 'elastic_controlled', side: 'controlled' },
  // airy_closed
  soundstage: { axis: 'airy_closed', side: 'airy' },
  imaging: { axis: 'airy_closed', side: 'airy' },
  space: { axis: 'airy_closed', side: 'airy' },
  width: { axis: 'airy_closed', side: 'airy' },
  depth: { axis: 'airy_closed', side: 'airy' },
  air: { axis: 'airy_closed', side: 'airy' },
  openness: { axis: 'airy_closed', side: 'airy' },
  extension: { axis: 'airy_closed', side: 'airy' },
  sparkle: { axis: 'airy_closed', side: 'airy' },
};

/**
 * ListenerProfile dimension → axis, with the side each pole implies. One
 * dimension per axis keeps the mapping unambiguous (the profile carries other
 * dimensions, but only these four map cleanly onto the canonical sonic axes).
 */
const PROFILE_DIM_TO_AXIS: Array<{
  dim: 'warmth_vs_neutrality' | 'smoothness_vs_attack' | 'flow_vs_precision' | 'intimacy_vs_scale';
  axis: IntentAxis;
  low: IntentSide;
  high: IntentSide;
}> = [
  { dim: 'warmth_vs_neutrality', axis: 'warm_bright', low: 'warm', high: 'bright' },
  { dim: 'smoothness_vs_attack', axis: 'smooth_detailed', low: 'smooth', high: 'detailed' },
  { dim: 'flow_vs_precision', axis: 'elastic_controlled', low: 'elastic', high: 'controlled' },
  { dim: 'intimacy_vs_scale', axis: 'airy_closed', low: 'closed', high: 'airy' },
];

/** Below this profile confidence, accumulated leans don't count as intent.
 *  Mirrors the framing-layer floor in listener-preferences.ts. */
const PROFILE_INTENT_FLOOR = 0.2;
/** Minimum deviation from neutral (0.5) for a profile dimension to count. */
const PROFILE_INTENT_DEVIATION = 0.15;

/**
 * Resolve the user's directional intent on each canonical axis from the two
 * permitted intent sources — explicit DesireSignals (primary) and the
 * accumulated ListenerProfile (secondary fill). Never reads listenerPriorities
 * or system axes. Returns a per-axis side or null, plus a hasIntent flag.
 *
 * Resolution rules:
 *   - Explicit desires win. Two explicit desires that disagree on the same
 *     axis cancel to null (ambiguous — the engine should not guess).
 *   - The ListenerProfile only fills axes the desires left silent, and only
 *     when its confidence clears the floor and the dimension deviates from
 *     neutral.
 */
export function deriveIntentStance(
  desires?: DesireSignal[],
  profile?: ListenerProfile | null,
): IntentStance {
  const stance: IntentStance = {
    warm_bright: null,
    smooth_detailed: null,
    elastic_controlled: null,
    airy_closed: null,
    hasIntent: false,
  };
  const conflicted = new Set<IntentAxis>();

  // 1. Explicit desires (stated User Intent) take priority.
  if (desires) {
    for (const d of desires) {
      const q = d.quality?.toLowerCase?.();
      if (!q) continue;
      const map = DESIRE_TO_AXIS[q];
      if (!map) continue;
      const side = d.direction === 'less' ? AXIS_OPPOSITE[map.side] : map.side;
      const current = stance[map.axis];
      if (current === null && !conflicted.has(map.axis)) {
        stance[map.axis] = side as never;
      } else if (current !== null && current !== side) {
        // Two explicit desires disagree on this axis → ambiguous; clear it.
        stance[map.axis] = null;
        conflicted.add(map.axis);
      }
    }
  }

  // 2. ListenerProfile fills only the axes the user did not state explicitly.
  if (profile && profile.signalCount > 0 && profile.confidence >= PROFILE_INTENT_FLOOR) {
    for (const m of PROFILE_DIM_TO_AXIS) {
      if (stance[m.axis] !== null || conflicted.has(m.axis)) continue;
      const v = profile[m.dim] as number;
      if (typeof v !== 'number') continue;
      const delta = v - 0.5;
      if (Math.abs(delta) < PROFILE_INTENT_DEVIATION) continue;
      stance[m.axis] = (delta < 0 ? m.low : m.high) as never;
    }
  }

  stance.hasIntent =
    stance.warm_bright !== null
    || stance.smooth_detailed !== null
    || stance.elastic_controlled !== null
    || stance.airy_closed !== null;

  return stance;
}

// ── Threat detection ─────────────────────────────────

/**
 * Detect threats from sacrifice text against listener priorities.
 *
 * Uses phrase-level substring matching (case-insensitive).
 * Conservative: only matches from the narrow PRIORITY_KEYWORDS table.
 */
function detectThreatsFromSacrifices(
  sacrifices: string[],
  classified: ClassifiedPriorities,
): PriorityThreat[] {
  const threats: PriorityThreat[] = [];
  const seen = new Set<ListenerPriority>();

  for (const sacrifice of sacrifices) {
    const lower = sacrifice.toLowerCase();

    for (const priority of [...classified.explicit, ...classified.inferred]) {
      if (seen.has(priority)) continue;

      const keywords = PRIORITY_KEYWORDS[priority];
      const matched = keywords.some((kw) => lower.includes(kw));

      if (matched) {
        seen.add(priority);
        threats.push({
          priority,
          label: LISTENER_PRIORITY_LABELS[priority],
          threatSource: sacrifice,
          basis: classified.explicit.has(priority) ? 'explicit' : 'inferred',
        });
      }
    }
  }

  return threats;
}

/**
 * Axis-opposition fallback: detect threats when sacrifice text is empty
 * but the upgrade path's target axes clearly oppose an explicit priority.
 *
 * v1 guardrails:
 *   - Only fires when likelySacrifices is empty
 *   - Only checks explicit priorities (not inferred)
 *   - Only when the path targets the opposing side of the relevant axis
 */
function detectAxisOppositionThreats(
  targetAxes: string[],
  classified: ClassifiedPriorities,
): PriorityThreat[] {
  if (classified.explicit.size === 0) return [];

  const threats: PriorityThreat[] = [];
  const seen = new Set<ListenerPriority>();

  for (const axisKey of targetAxes) {
    const alignment = AXIS_PRIORITY_ALIGNMENT[axisKey];
    if (!alignment) continue;

    // Check if any explicit priority aligns with one side,
    // while the axis being targeted implies the other side.
    // Since targetAxes only tells us *which* axis is affected (not direction),
    // we check both sides for explicit priority alignment.
    for (const priority of classified.explicit) {
      if (seen.has(priority)) continue;

      // If priority aligns with left side, the path targets this axis = potential opposition
      if (alignment.leftPriorities.includes(priority)) {
        seen.add(priority);
        threats.push({
          priority,
          label: LISTENER_PRIORITY_LABELS[priority],
          threatSource: `Axis shift on ${axisKey.replace(/_/g, '↔')} may move away from ${alignment.leftLabel}, affecting ${LISTENER_PRIORITY_LABELS[priority]}.`,
          basis: 'explicit',
        });
      }
      // If priority aligns with right side
      if (alignment.rightPriorities.includes(priority) && !seen.has(priority)) {
        seen.add(priority);
        threats.push({
          priority,
          label: LISTENER_PRIORITY_LABELS[priority],
          threatSource: `Axis shift on ${axisKey.replace(/_/g, '↔')} may move away from ${alignment.rightLabel}, affecting ${LISTENER_PRIORITY_LABELS[priority]}.`,
          basis: 'explicit',
        });
      }
    }
  }

  return threats;
}

// ── Verdict determination ────────────────────────────

/**
 * Determine the protection verdict.
 *
 * BLOCK requires ALL of:
 *   - explicitAtRisk (user-stated priority threatened)
 *   - NOT overriddenByConstraint
 *   - tradeoff confidence >= medium (enough evidence to act)
 *   - path impact != highest (don't block bottleneck resolution)
 *   - threat came from sacrifice text (not axis fallback alone)
 *
 * CAUTION covers:
 *   - inferred-only threats
 *   - explicit threats with low confidence
 *   - explicit threats overridden by hard constraint
 *   - explicit threats on highest-impact paths
 *   - weak sacrifice evidence with explicit priority implicated (axis fallback)
 *
 * SAFE: no meaningful threat detected.
 */
function determineVerdict(
  threats: PriorityThreat[],
  explicitAtRisk: boolean,
  inferredAtRisk: boolean,
  overriddenByConstraint: boolean,
  tradeoffConfidence: 'high' | 'medium' | 'low',
  pathImpact: 'highest' | 'moderate' | 'refinement',
  hasSacrificeEvidence: boolean,
): { verdict: PreferenceProtectionResult['verdict']; reason: string } {
  if (threats.length === 0) {
    return { verdict: 'safe', reason: 'No listener priorities threatened.' };
  }

  const threatLabels = [...new Set(threats.map((t) => t.label))];
  const labelText = threatLabels.join(' and ');

  // BLOCK: explicit priority threatened with sufficient evidence and no override
  if (
    explicitAtRisk
    && !overriddenByConstraint
    && tradeoffConfidence !== 'low'
    && pathImpact !== 'highest'
    && hasSacrificeEvidence
  ) {
    return {
      verdict: 'block',
      reason: `This change threatens ${labelText} — a stated priority. The trade-offs outweigh the gains for your preferences.`,
    };
  }

  // CAUTION for all other threat cases
  if (explicitAtRisk && !hasSacrificeEvidence) {
    return {
      verdict: 'caution',
      reason: `Sacrifice evidence is limited, but this change may affect ${labelText}. Assess whether this aligns with your direction.`,
    };
  }
  if (explicitAtRisk && tradeoffConfidence === 'low') {
    return {
      verdict: 'caution',
      reason: `This may affect ${labelText}, but trade-off evidence is uncertain.`,
    };
  }
  if (explicitAtRisk && overriddenByConstraint) {
    return {
      verdict: 'caution',
      reason: `A hard constraint justifies this change, but it may affect ${labelText}.`,
    };
  }
  if (explicitAtRisk && pathImpact === 'highest') {
    return {
      verdict: 'caution',
      reason: `This is the highest-impact path, but it may affect ${labelText}.`,
    };
  }
  if (inferredAtRisk) {
    return {
      verdict: 'caution',
      reason: `This change may affect ${labelText}, which your system currently emphasizes.`,
    };
  }

  // Fallback — shouldn't reach here if threats > 0, but safe default
  return { verdict: 'safe', reason: 'No listener priorities threatened.' };
}

// ── Main entry point ─────────────────────────────────

/**
 * Assess whether a recommended upgrade path threatens listener priorities.
 *
 * Called once per upgrade path, after assessTradeoffs() (Feature 2).
 * Reads the TradeoffAssessment but does not modify it.
 */
export function assessPreferenceProtection(
  tradeoff: TradeoffAssessment,
  classified: ClassifiedPriorities,
  pathImpact: 'highest' | 'moderate' | 'refinement',
  constraint: PrimaryConstraint | undefined,
  targetAxes: string[],
): PreferenceProtectionResult {
  // ── Detect threats from sacrifice text ──
  let threats = detectThreatsFromSacrifices(tradeoff.likelySacrifices, classified);
  const hasSacrificeEvidence = tradeoff.likelySacrifices.length > 0;

  // ── Axis-opposition fallback (v1: explicit priorities only, empty sacrifices only) ──
  if (!hasSacrificeEvidence && classified.explicit.size > 0) {
    const axisFallbackThreats = detectAxisOppositionThreats(targetAxes, classified);
    threats = [...threats, ...axisFallbackThreats];
  }

  const explicitAtRisk = threats.some((t) => t.basis === 'explicit');
  const inferredAtRisk = threats.some((t) => t.basis === 'inferred');

  const overriddenByConstraint =
    pathImpact === 'highest'
    && constraint != null
    && HARD_CONSTRAINT_CLASSES.has(resolveConstraintClass(constraint.category) ?? '');

  const { verdict, reason } = determineVerdict(
    threats,
    explicitAtRisk,
    inferredAtRisk,
    overriddenByConstraint,
    tradeoff.confidence,
    pathImpact,
    hasSacrificeEvidence,
  );

  return {
    threats,
    explicitAtRisk,
    inferredAtRisk,
    overriddenByConstraint,
    verdict,
    reason,
  };
}
