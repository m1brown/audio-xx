/**
 * Primary Advisory Axis Types — v1 Sonic Trait Framework.
 *
 * Four perceptual axes and one system-outcome overlay that form
 * the top-level reasoning model for Audio XX.
 *
 * Products and systems are positioned on these axes using qualitative
 * labels — not numeric scores. The axes use language drawn directly
 * from how listeners actually describe sound.
 *
 * ── CALIBRATION PRINCIPLES ──────────────────────────────────────
 *
 * 1. Clarity ≠ Brightness.
 *    High clarity does NOT imply a 'bright' classification. Brightness
 *    means treble emphasis or tonal energy shift toward the upper
 *    frequencies. Clarity can be achieved through timing accuracy,
 *    transient precision, or transparency — none of which constitute
 *    brightness. A product that is lean (low tonal density) but achieves
 *    detail through timing should be classified as NEUTRAL, not bright.
 *    Examples: Chord Qutest (neutral), RME ADI-2 (neutral).
 *    Contrast: SMSL DO300 (bright — ESS glare risk + lean density).
 *
 * 2. Anchor references for the Warm ↔ Bright axis:
 *    - Warm pole:    Denafrips Pontus (density 1.0, harmonic richness)
 *    - Neutral:      Chord Qutest (clarity via timing, not treble)
 *    - Neutral:      RME ADI-2 (ruler-flat transparency)
 *    - Bright:       SMSL DO300 (ESS glare risk, lean density)
 *
 * See: docs/audio_xx_sonic_trait_framework_v1.md
 */

// ── Axis leanings ────────────────────────────────────────

/** Position on the Warm ↔ Bright axis. */
export type WarmBrightLeaning = 'warm' | 'bright' | 'neutral';

/** Position on the Smooth ↔ Detailed axis. */
export type SmoothDetailedLeaning = 'smooth' | 'detailed' | 'neutral';

/** Position on the Elastic ↔ Controlled axis. */
export type ElasticControlledLeaning = 'elastic' | 'controlled' | 'neutral';

/** Position on the Airy ↔ Closed axis. */
export type AiryClosedLeaning = 'airy' | 'closed' | 'neutral';

/**
 * Primary axis leanings for a product or system.
 * The first thing the engine reads when reasoning about character.
 *
 * Numeric intensity (`_n` fields) use a -2 to +2 ordinal scale:
 *   -2 = strong first pole (warm, smooth, elastic, airy)
 *   -1 = moderate first pole
 *    0 = neutral
 *   +1 = moderate second pole (bright, detailed, controlled, closed)
 *   +2 = strong second pole
 *
 * When `_n` values are present they are the source of truth —
 * the categorical label can be derived. When absent, the categorical
 * label remains the primary data (backward compatible).
 */
export interface PrimaryAxisLeanings {
  warm_bright: WarmBrightLeaning;
  smooth_detailed: SmoothDetailedLeaning;
  elastic_controlled: ElasticControlledLeaning;
  airy_closed: AiryClosedLeaning;

  /** Numeric intensity: -2 (very warm) → +2 (very bright). */
  warm_bright_n?: number;
  /** Numeric intensity: -2 (very smooth) → +2 (very detailed). */
  smooth_detailed_n?: number;
  /** Numeric intensity: -2 (very elastic) → +2 (very controlled). */
  elastic_controlled_n?: number;
  /** Numeric intensity: -2 (very airy) → +2 (very closed). */
  airy_closed_n?: number;
}

// ── Fatigue overlay ──────────────────────────────────────

/**
 * Fatigue assessment for a product or system.
 * This is a system-outcome overlay — the result of how the four
 * primary axes combine — not a design axis.
 */
export interface FatigueAssessment {
  /** Qualitative fatigue risk level. */
  risk: 'low' | 'moderate' | 'high' | 'context_dependent';
  /** When or why fatigue risk manifests. */
  notes: string;
}

// ── System character inference ────────────────────────────

/**
 * System-level axis positions inferred from the component chain.
 * Each axis holds the synthesised lean plus any compounding/compensation notes.
 */
export interface SystemAxisProfile {
  leanings: PrimaryAxisLeanings;
  fatigue: FatigueAssessment;
  /** Natural-language summary of overall system character. */
  characterSummary: string;
  /** Compounding warnings — axes where multiple components push the same direction. */
  compounding: string[];
  /** Compensation notes — axes where components offset each other. */
  compensations: string[];
}

// ── Axis inference from secondary traits ─────────────────

/**
 * Infer primary axis leanings from a product's secondary trait values.
 * This is the bridge from the existing numeric trait system to the
 * new axis model. Used when primaryAxes is not explicitly assigned.
 *
 * Heuristic — not precise. Explicit primaryAxes assignments always
 * take precedence when present.
 */
export function inferAxesFromTraits(
  traits: Record<string, number>,
): PrimaryAxisLeanings {
  const warm_bright: WarmBrightLeaning =
    (traits.tonal_density ?? 0) >= 0.7 && (traits.fatigue_risk ?? 0) < 0.4
      ? 'warm'
      : (traits.fatigue_risk ?? 0) >= 0.5 || (traits.clarity ?? 0) >= 0.8
        ? 'bright'
        : 'neutral';

  const smooth_detailed: SmoothDetailedLeaning =
    (traits.flow ?? 0) >= 0.7
      ? 'smooth'
      : (traits.clarity ?? 0) >= 0.7 || (traits.texture ?? 0) >= 0.7
        ? 'detailed'
        : 'neutral';

  const elastic_controlled: ElasticControlledLeaning =
    (traits.elasticity ?? 0) >= 0.7 || (traits.dynamics ?? 0) >= 0.8
      ? 'elastic'
      : (traits.composure ?? 0) >= 0.7 || (traits.damping_control ?? 0) >= 0.7
        ? 'controlled'
        : 'neutral';

  const airy_closed: AiryClosedLeaning =
    (traits.soundstage ?? 0) >= 0.7 || (traits.openness ?? 0) >= 0.7
      ? 'airy'
      : (traits.soundstage ?? 0) <= 0.2
        ? 'closed'
        : 'neutral';

  return { warm_bright, smooth_detailed, elastic_controlled, airy_closed };
}

/**
 * Labels for human-readable axis descriptions.
 */
export type CategoricalAxis = 'warm_bright' | 'smooth_detailed' | 'elastic_controlled' | 'airy_closed';

export const AXIS_LABELS: Record<CategoricalAxis, { low: string; high: string; name: string }> = {
  warm_bright: { low: 'warm', high: 'bright', name: 'Warm ↔ Bright' },
  smooth_detailed: { low: 'smooth', high: 'detailed', name: 'Smooth ↔ Detailed' },
  elastic_controlled: { low: 'elastic', high: 'controlled', name: 'Elastic ↔ Controlled' },
  airy_closed: { low: 'airy', high: 'closed', name: 'Airy ↔ Closed' },
};

/**
 * Resolve a product's primary axis leanings.
 * Prefers explicit primaryAxes; falls back to trait inference.
 */
export function resolveProductAxes(product: {
  primaryAxes?: PrimaryAxisLeanings;
  traits: Record<string, number>;
}): PrimaryAxisLeanings {
  return product.primaryAxes ?? inferAxesFromTraits(product.traits);
}

/**
 * Resolve the numeric intensity for an axis.
 * Prefers explicit `_n` value; derives from categorical label if absent.
 *
 *   categorical → numeric fallback:
 *     first pole (warm/smooth/elastic/airy) → -1
 *     neutral → 0
 *     second pole (bright/detailed/controlled/closed) → +1
 */
export function resolveAxisIntensity(
  axes: PrimaryAxisLeanings,
  axis: keyof Pick<PrimaryAxisLeanings, 'warm_bright' | 'smooth_detailed' | 'elastic_controlled' | 'airy_closed'>,
): number {
  const numericKey = `${axis}_n` as keyof PrimaryAxisLeanings;
  const numericValue = axes[numericKey];
  if (typeof numericValue === 'number') return numericValue;

  // Derive from categorical
  const categorical = axes[axis] as string;
  const FIRST_POLES: Record<string, string> = {
    warm_bright: 'warm',
    smooth_detailed: 'smooth',
    elastic_controlled: 'elastic',
    airy_closed: 'airy',
  };
  if (categorical === 'neutral') return 0;
  if (categorical === FIRST_POLES[axis]) return -1;
  return 1; // second pole
}

/**
 * Detect compounding on an axis — when multiple components lean the same direction.
 */
export function detectCompounding(
  componentAxes: PrimaryAxisLeanings[],
): string[] {
  const warnings: string[] = [];
  const axes: CategoricalAxis[] = [
    'warm_bright', 'smooth_detailed', 'elastic_controlled', 'airy_closed',
  ];

  for (const axis of axes) {
    const leanings = componentAxes.map(c => c[axis]).filter(l => l !== 'neutral');
    if (leanings.length < 2) continue;

    // Check if all non-neutral leanings point the same direction
    const first = leanings[0];
    if (leanings.every(l => l === first)) {
      const label = AXIS_LABELS[axis];
      warnings.push(
        `Multiple components lean ${first} on ${label.name} — risk of compounding.`,
      );
    }
  }

  return warnings;
}

/**
 * Role-based influence weight for system axis synthesis.
 *
 * Hierarchy:
 *   speaker/headphones  → 3  (primary — defines system character)
 *   dac                 → 2  (strong — refines tonal balance)
 *   amplifier           → 1.5 (moderate — adjusts control and drive)
 *   source/streamer     → 0.5 (secondary — transport, minimal sonic influence)
 *   cable/accessory     → 0.25 (minor — negligible)
 */
function roleWeight(role: string): number {
  const r = role.toLowerCase();
  if (r.includes('speak') || r.includes('headphone') || r.includes('monitor')) return 3;
  if (r.includes('dac')) return 2;
  if (r.includes('amp') || r.includes('integrated') || r.includes('preamp')) return 1.5;
  if (r.includes('stream') || r.includes('source') || r.includes('transport')) return 0.5;
  if (r.includes('cable') || r.includes('accessory') || r.includes('power')) return 0.25;
  return 1; // default for unknown roles
}

/**
 * Synthesise system-level axis leanings from component leanings.
 *
 * When roles are provided, uses hierarchical influence weighting:
 * speakers define character, DAC refines, amp adjusts, source is secondary.
 *
 * When roles are omitted, uses simple majority-vote (backward compatible).
 */
export function synthesiseSystemAxes(
  componentAxes: PrimaryAxisLeanings[],
  roles?: string[],
): PrimaryAxisLeanings {
  if (!roles || roles.length !== componentAxes.length) {
    // Backward-compatible majority vote
    return synthesiseMajorityVote(componentAxes);
  }

  // Weighted synthesis — role hierarchy determines influence
  function weightedResolve<T extends string>(
    values: { value: T; weight: number }[],
    neutralValue: T,
  ): T {
    const scores = new Map<T, number>();
    for (const { value, weight } of values) {
      scores.set(value, (scores.get(value) ?? 0) + weight);
    }
    // Remove neutral from competition unless it's the only option
    const nonNeutral = [...scores.entries()].filter(([v]) => v !== neutralValue);
    if (nonNeutral.length === 0) return neutralValue;

    // The highest-weighted non-neutral leaning wins, but only if it
    // exceeds the neutral weight — prevents a minor cable from overriding
    const neutralScore = scores.get(neutralValue) ?? 0;
    let bestValue = neutralValue;
    let bestScore = neutralScore;
    for (const [v, s] of nonNeutral) {
      if (s > bestScore) { bestValue = v; bestScore = s; }
    }
    return bestValue;
  }

  const weights = roles.map(roleWeight);

  return {
    warm_bright: weightedResolve(
      componentAxes.map((c, i) => ({ value: c.warm_bright, weight: weights[i] })),
      'neutral' as WarmBrightLeaning,
    ),
    smooth_detailed: weightedResolve(
      componentAxes.map((c, i) => ({ value: c.smooth_detailed, weight: weights[i] })),
      'neutral' as SmoothDetailedLeaning,
    ),
    elastic_controlled: weightedResolve(
      componentAxes.map((c, i) => ({ value: c.elastic_controlled, weight: weights[i] })),
      'neutral' as ElasticControlledLeaning,
    ),
    airy_closed: weightedResolve(
      componentAxes.map((c, i) => ({ value: c.airy_closed, weight: weights[i] })),
      'neutral' as AiryClosedLeaning,
    ),
  };
}

/** Simple majority-vote synthesis (original algorithm, used as fallback). */
function synthesiseMajorityVote(
  componentAxes: PrimaryAxisLeanings[],
): PrimaryAxisLeanings {
  function majority<T extends string>(values: T[], neutralValue: T): T {
    const counts = new Map<T, number>();
    for (const v of values) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    let best = neutralValue;
    let bestCount = 0;
    for (const [v, c] of counts) {
      if (c > bestCount) { best = v; bestCount = c; }
    }
    return best;
  }

  return {
    warm_bright: majority(
      componentAxes.map(c => c.warm_bright),
      'neutral' as WarmBrightLeaning,
    ),
    smooth_detailed: majority(
      componentAxes.map(c => c.smooth_detailed),
      'neutral' as SmoothDetailedLeaning,
    ),
    elastic_controlled: majority(
      componentAxes.map(c => c.elastic_controlled),
      'neutral' as ElasticControlledLeaning,
    ),
    airy_closed: majority(
      componentAxes.map(c => c.airy_closed),
      'neutral' as AiryClosedLeaning,
    ),
  };
}
