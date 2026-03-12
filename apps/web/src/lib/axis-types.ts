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
 */
export interface PrimaryAxisLeanings {
  warm_bright: WarmBrightLeaning;
  smooth_detailed: SmoothDetailedLeaning;
  elastic_controlled: ElasticControlledLeaning;
  airy_closed: AiryClosedLeaning;
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
export const AXIS_LABELS: Record<keyof PrimaryAxisLeanings, { low: string; high: string; name: string }> = {
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
 * Detect compounding on an axis — when multiple components lean the same direction.
 */
export function detectCompounding(
  componentAxes: PrimaryAxisLeanings[],
): string[] {
  const warnings: string[] = [];
  const axes: (keyof PrimaryAxisLeanings)[] = [
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
 * Synthesise system-level axis leanings from component leanings.
 * Simple majority-vote with compounding detection.
 */
export function synthesiseSystemAxes(
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
