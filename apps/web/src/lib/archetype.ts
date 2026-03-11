/**
 * Sonic Archetype Layer.
 *
 * Maps listener preferences, product traits, and system tendencies into
 * five recurring sonic archetypes. This is an organizing layer — it does
 * not replace the rule engine or introduce numeric scoring. It provides
 * a shared vocabulary for bridging low-level trait signals and listener-
 * level goals.
 *
 * Archetypes:
 *   flow_organic        — ease, sweetness, continuity, natural tone, low fatigue
 *   precision_explicit  — clarity, detail, attack, separation, low blur
 *   rhythmic_propulsive — pace, drive, snap, energy, dynamic life
 *   tonal_saturated     — body, density, color, harmonic richness
 *   spatial_holographic  — depth, layering, dimensionality, air, image specificity
 */

import type { Product } from './products/dacs';
import type { DesireSignal } from './intent';
import { resolveTraitValue } from './sonic-tendencies';

// ── Types ────────────────────────────────────────────

export type SonicArchetype =
  | 'flow_organic'
  | 'precision_explicit'
  | 'rhythmic_propulsive'
  | 'tonal_saturated'
  | 'spatial_holographic';

export interface ArchetypeWeight {
  archetype: SonicArchetype;
  weight: number;
}

export interface ProductArchetypeTags {
  primary: SonicArchetype;
  secondary?: SonicArchetype;
}

export interface UserArchetypePreference {
  primary: SonicArchetype;
  secondary?: SonicArchetype;
  /** True when top two archetypes are nearly equal — user spans both. */
  blended: boolean;
}

// ── Archetype definitions ────────────────────────────

export interface ArchetypeDefinition {
  label: string;
  shortLabel: string;
  description: string;
  /** Product trait keys and their contribution weights (0–1). */
  traitWeights: Record<string, number>;
}

export const ARCHETYPE_DEFINITIONS: Record<SonicArchetype, ArchetypeDefinition> = {
  flow_organic: {
    label: 'flow and organic musicality',
    shortLabel: 'flow-oriented',
    description: 'Prioritizes musical continuity and harmonic naturalness over transient precision and analytical detail.',
    traitWeights: {
      flow: 1.0,
      composure: 0.6,
      tonal_density: 0.4,
      elasticity: 0.5,
      warmth: 0.3,
    },
  },
  precision_explicit: {
    label: 'precision and explicit detail',
    shortLabel: 'precision-oriented',
    description: 'Prioritizes transparency and transient definition over tonal richness and harmonic warmth.',
    traitWeights: {
      clarity: 1.0,
      texture: 0.5,
      speed: 0.6,
      dynamics: 0.3,
    },
  },
  rhythmic_propulsive: {
    label: 'rhythmic drive and propulsive energy',
    shortLabel: 'rhythm-oriented',
    description: 'Prioritizes rhythmic energy and dynamic contrast over composure and tonal smoothness.',
    traitWeights: {
      rhythm: 1.0,
      dynamics: 0.7,
      speed: 0.5,
      elasticity: 0.4,
    },
  },
  tonal_saturated: {
    label: 'tonal saturation and harmonic richness',
    shortLabel: 'tonally saturated',
    description: 'Prioritizes harmonic density and tonal weight over speed and explicit resolution.',
    traitWeights: {
      tonal_density: 1.0,
      warmth: 0.6,
      texture: 0.5,
      flow: 0.3,
    },
  },
  spatial_holographic: {
    label: 'spatial depth and holographic imaging',
    shortLabel: 'spatially focused',
    description: 'Prioritizes spatial precision and imaging depth over tonal density and rhythmic drive.',
    traitWeights: {
      spatial_precision: 1.0,
      openness: 0.6,
      clarity: 0.3,
      composure: 0.3,
    },
  },
};

// ── Product archetype scoring ────────────────────────

/**
 * Score a product against all archetypes using its trait profile.
 * Returns weights (not normalized) — higher = stronger affinity.
 */
export function scoreProductArchetypes(product: Product): ArchetypeWeight[] {
  return Object.entries(ARCHETYPE_DEFINITIONS).map(([key, def]) => {
    let weight = 0;
    for (const [trait, tw] of Object.entries(def.traitWeights)) {
      weight += resolveTraitValue(product.tendencyProfile, product.traits, trait) * tw;
    }
    return { archetype: key as SonicArchetype, weight };
  });
}

/**
 * Tag a product with its primary and optional secondary archetype.
 *
 * When the product carries explicit `archetypes` tags, those are returned
 * directly — no inference. This prevents misclassification of gear whose
 * sonic character doesn't reduce cleanly to trait-weighted scoring.
 *
 * When explicit tags are absent, falls back to trait-based inference.
 * Secondary is included only if it reaches at least 60% of the primary's weight.
 */
export function tagProductArchetype(product: Product): ProductArchetypeTags {
  // Prefer explicit tags when present
  if (product.archetypes) {
    return {
      primary: product.archetypes.primary,
      secondary: product.archetypes.secondary,
    };
  }

  // Fall back to trait-based inference
  const scores = scoreProductArchetypes(product);
  const sorted = [...scores].sort((a, b) => b.weight - a.weight);

  const primary = sorted[0];
  const secondary = sorted[1];

  return {
    primary: primary.archetype,
    secondary:
      secondary && primary.weight > 0 && secondary.weight >= primary.weight * 0.6
        ? secondary.archetype
        : undefined,
  };
}

// ── User archetype inference ─────────────────────────

/**
 * Desire quality → archetype mapping.
 * Each entry: [archetype, weight].
 */
const DESIRE_ARCHETYPE_MAP: Record<string, [SonicArchetype, number][]> = {
  // precision_explicit
  speed:         [['precision_explicit', 1.0], ['rhythmic_propulsive', 0.8]],
  timing:        [['precision_explicit', 0.8], ['rhythmic_propulsive', 0.6]],
  transients:    [['precision_explicit', 1.0], ['rhythmic_propulsive', 0.7]],
  attack:        [['precision_explicit', 0.8], ['rhythmic_propulsive', 0.8]],
  detail:        [['precision_explicit', 1.0]],
  resolution:    [['precision_explicit', 1.0]],
  clarity:       [['precision_explicit', 1.0]],
  transparency:  [['precision_explicit', 0.8]],
  separation:    [['precision_explicit', 0.8], ['spatial_holographic', 0.5]],

  // tonal_saturated
  warmth:        [['tonal_saturated', 1.0], ['flow_organic', 0.6]],
  body:          [['tonal_saturated', 1.0], ['flow_organic', 0.5]],
  richness:      [['tonal_saturated', 1.0]],
  density:       [['tonal_saturated', 1.0]],
  weight:        [['tonal_saturated', 0.8]],
  color:         [['tonal_saturated', 0.8]],
  texture:       [['tonal_saturated', 0.6], ['precision_explicit', 0.5]],

  // flow_organic
  flow:          [['flow_organic', 1.0]],
  musicality:    [['flow_organic', 1.0]],
  engagement:    [['flow_organic', 0.8], ['rhythmic_propulsive', 0.5]],
  smoothness:    [['flow_organic', 0.8]],
  ease:          [['flow_organic', 0.8]],
  relaxation:    [['flow_organic', 0.7]],
  naturalness:   [['flow_organic', 0.8], ['tonal_saturated', 0.4]],
  sweetness:     [['flow_organic', 0.8], ['tonal_saturated', 0.4]],

  // rhythmic_propulsive
  dynamics:      [['rhythmic_propulsive', 1.0], ['precision_explicit', 0.4]],
  punch:         [['rhythmic_propulsive', 1.0]],
  slam:          [['rhythmic_propulsive', 1.0]],
  rhythm:        [['rhythmic_propulsive', 1.0]],
  pace:          [['rhythmic_propulsive', 0.8]],
  drive:         [['rhythmic_propulsive', 0.8]],
  energy:        [['rhythmic_propulsive', 0.8]],
  excitement:    [['rhythmic_propulsive', 0.9], ['precision_explicit', 0.3]],

  // spatial_holographic
  soundstage:    [['spatial_holographic', 1.0]],
  imaging:       [['spatial_holographic', 1.0]],
  space:         [['spatial_holographic', 0.8]],
  air:           [['spatial_holographic', 0.8]],
  sparkle:       [['precision_explicit', 0.6], ['spatial_holographic', 0.4]],
  openness:      [['spatial_holographic', 0.8]],
  depth:         [['spatial_holographic', 1.0]],
  layering:      [['spatial_holographic', 1.0]],
  dimensionality:[['spatial_holographic', 1.0]],
};

/**
 * Infer the user's archetypal preference from desire signals.
 *
 * Optionally boost from engine archetype_hints if available.
 * Returns primary + optional secondary archetype.
 */
export function inferUserArchetype(
  desires: DesireSignal[],
  archetypeHints: string[] = [],
): UserArchetypePreference {
  const weights: Record<SonicArchetype, number> = {
    flow_organic: 0,
    precision_explicit: 0,
    rhythmic_propulsive: 0,
    tonal_saturated: 0,
    spatial_holographic: 0,
  };

  // From desire signals
  for (const desire of desires) {
    const mappings = DESIRE_ARCHETYPE_MAP[desire.quality];
    if (!mappings) continue;
    const multiplier = desire.direction === 'more' ? 1.0 : -0.3;
    for (const [arch, w] of mappings) {
      weights[arch] += w * multiplier;
    }
  }

  // Boost from engine archetype_hints (if available)
  const HINT_MAP: Record<string, SonicArchetype> = {
    engagement: 'flow_organic',
    precision: 'precision_explicit',
    rhythm: 'rhythmic_propulsive',
    tonal: 'tonal_saturated',
    spatial: 'spatial_holographic',
    // Legacy / alternate hint names
    flow: 'flow_organic',
    clarity: 'precision_explicit',
    detail: 'precision_explicit',
    drive: 'rhythmic_propulsive',
    richness: 'tonal_saturated',
    imaging: 'spatial_holographic',
  };

  for (const hint of archetypeHints) {
    const arch = HINT_MAP[hint.toLowerCase()];
    if (arch) weights[arch] += 0.3;
  }

  // Sort and pick
  const sorted = (Object.entries(weights) as [SonicArchetype, number][])
    .sort((a, b) => b[1] - a[1]);

  const [primaryArch, primaryWeight] = sorted[0];
  const [secondaryArch, secondaryWeight] = sorted[1];

  // No signal at all → default to flow_organic (most neutral)
  if (primaryWeight <= 0) {
    return { primary: 'flow_organic', blended: false };
  }

  const blended = secondaryWeight > 0 && (primaryWeight - secondaryWeight) < 0.2;

  return {
    primary: primaryArch,
    secondary: secondaryWeight > primaryWeight * 0.5 ? secondaryArch : undefined,
    blended,
  };
}

// ── Comparison helpers ───────────────────────────────

/**
 * Compare two products by archetype and return a human-readable sentence.
 */
export function compareProductArchetypes(a: Product, b: Product): string {
  const tagsA = tagProductArchetype(a);
  const tagsB = tagProductArchetype(b);
  const defA = ARCHETYPE_DEFINITIONS[tagsA.primary];
  const defB = ARCHETYPE_DEFINITIONS[tagsB.primary];

  if (tagsA.primary === tagsB.primary) {
    // Same primary archetype — differentiate by secondary
    if (tagsA.secondary && tagsB.secondary && tagsA.secondary !== tagsB.secondary) {
      const secA = ARCHETYPE_DEFINITIONS[tagsA.secondary];
      const secB = ARCHETYPE_DEFINITIONS[tagsB.secondary];
      return `Both are ${defA.shortLabel} designs, but the ${a.name} leans secondarily toward ${secA.label}, while the ${b.name} leans toward ${secB.label}.`;
    }
    return `Both are ${defA.shortLabel} designs — the differences are in degree and voicing rather than fundamental character.`;
  }

  return `The ${a.name} is a ${defA.shortLabel} design — ${defA.description.toLowerCase()} The ${b.name} is ${defB.shortLabel} — ${defB.description.toLowerCase()}`;
}

// ── Label helpers ────────────────────────────────────

/** Full human-readable label. */
export function getArchetypeLabel(archetype: SonicArchetype): string {
  return ARCHETYPE_DEFINITIONS[archetype].label;
}

/** Short descriptor for inline use. */
export function getArchetypeShortLabel(archetype: SonicArchetype): string {
  return ARCHETYPE_DEFINITIONS[archetype].shortLabel;
}

/**
 * Describe an archetype shift between two archetypes.
 * Used in system direction and recommendation explanations.
 */
export function describeArchetypeShift(
  from: SonicArchetype,
  to: SonicArchetype,
): string {
  if (from === to) return '';
  const fromDef = ARCHETYPE_DEFINITIONS[from];
  const toDef = ARCHETYPE_DEFINITIONS[to];
  return `a move from a ${fromDef.shortLabel} presentation toward a more ${toDef.shortLabel} one`;
}
