/**
 * Taste Profile — persistent listener preference model.
 *
 * Represents a user's listening preferences as 7 fixed traits on a 0–1 scale.
 * Stored in the Profile model's `preferredTraits` JSON field.
 *
 * The profile acts as a soft prior in the recommendation engine:
 *   - Conversation signals always take precedence.
 *   - Profile influence is gated by confidence (max 30% at full confidence).
 *   - Empty profiles have zero influence.
 */

import type { SonicArchetype } from './archetype';

// ── Trait definitions ────────────────────────────────

export type ProfileTraitKey =
  | 'flow'
  | 'clarity'
  | 'rhythm'
  | 'tonal_density'
  | 'spatial_depth'
  | 'dynamics'
  | 'warmth';

export interface ProfileTraitDef {
  key: ProfileTraitKey;
  label: string;
  description: string;
}

/**
 * The 7 fixed traits in display order.
 */
export const PROFILE_TRAITS: ProfileTraitDef[] = [
  { key: 'flow',          label: 'Flow',          description: 'Ease, continuity, and musical phrasing' },
  { key: 'clarity',       label: 'Clarity',       description: 'Detail, separation, and resolution' },
  { key: 'rhythm',        label: 'Rhythm',        description: 'Pace, drive, and rhythmic energy' },
  { key: 'tonal_density', label: 'Tonal Density', description: 'Body, weight, and harmonic richness' },
  { key: 'spatial_depth', label: 'Spatial Depth', description: 'Soundstage, air, and imaging depth' },
  { key: 'dynamics',      label: 'Dynamics',      description: 'Punch, contrast, and dynamic life' },
  { key: 'warmth',        label: 'Warmth',        description: 'Lower-midrange color and tonal warmth' },
];

export const PROFILE_TRAIT_LABELS: Record<ProfileTraitKey, string> = Object.fromEntries(
  PROFILE_TRAITS.map((t) => [t.key, t.label]),
) as Record<ProfileTraitKey, string>;

export const PROFILE_TRAIT_DESCRIPTIONS: Record<ProfileTraitKey, string> = Object.fromEntries(
  PROFILE_TRAITS.map((t) => [t.key, t.description]),
) as Record<ProfileTraitKey, string>;

// ── Core type ────────────────────────────────────────

export interface TasteProfile {
  /** Trait strengths: 0 = no preference, 1 = strong preference. */
  traits: Record<ProfileTraitKey, number>;
  /** How established the profile is: 0 = empty, 1 = fully established. */
  confidence: number;
  /** ISO timestamp of last update. */
  lastUpdated: string;
}

// ── Helpers ──────────────────────────────────────────

/**
 * Create an empty profile with all traits at 0.
 */
export function createEmptyProfile(): TasteProfile {
  return {
    traits: {
      flow: 0,
      clarity: 0,
      rhythm: 0,
      tonal_density: 0,
      spatial_depth: 0,
      dynamics: 0,
      warmth: 0,
    },
    confidence: 0,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Parse a stored JSON value into a TasteProfile.
 * Returns empty profile if the value is missing, empty, or invalid.
 */
export function parseTasteProfile(raw: unknown): TasteProfile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return createEmptyProfile();
  }

  const obj = raw as Record<string, unknown>;

  // Must have a traits object with at least one numeric value
  if (!obj.traits || typeof obj.traits !== 'object' || Array.isArray(obj.traits)) {
    return createEmptyProfile();
  }

  const traits = { ...createEmptyProfile().traits };
  const rawTraits = obj.traits as Record<string, unknown>;

  for (const key of PROFILE_TRAITS.map((t) => t.key)) {
    const val = rawTraits[key];
    if (typeof val === 'number' && val >= 0 && val <= 1) {
      traits[key] = val;
    }
  }

  return {
    traits,
    confidence: typeof obj.confidence === 'number' ? Math.max(0, Math.min(1, obj.confidence)) : 0,
    lastUpdated: typeof obj.lastUpdated === 'string' ? obj.lastUpdated : new Date().toISOString(),
  };
}

/**
 * Return the top N traits by strength, descending.
 */
export function topTraits(
  profile: TasteProfile,
  n = 3,
): { key: ProfileTraitKey; label: string; value: number }[] {
  return PROFILE_TRAITS
    .map((t) => ({ key: t.key, label: t.label, value: profile.traits[t.key] }))
    .filter((t) => t.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

/**
 * Check whether a profile has any meaningful data.
 */
export function isProfileEmpty(profile: TasteProfile): boolean {
  return Object.values(profile.traits).every((v) => v === 0);
}

// ── Engine integration ───────────────────────────────

/**
 * Trait → archetype affinity mapping.
 * Each trait contributes to one or two archetypes.
 */
const TRAIT_ARCHETYPE_MAP: Record<ProfileTraitKey, [SonicArchetype, number][]> = {
  flow:          [['flow_organic', 1.0]],
  clarity:       [['precision_explicit', 1.0], ['spatial_holographic', 0.3]],
  rhythm:        [['rhythmic_propulsive', 1.0]],
  tonal_density: [['tonal_saturated', 1.0], ['flow_organic', 0.3]],
  spatial_depth: [['spatial_holographic', 1.0]],
  dynamics:      [['rhythmic_propulsive', 0.7], ['precision_explicit', 0.3]],
  warmth:        [['tonal_saturated', 0.7], ['flow_organic', 0.5]],
};

/**
 * Map profile traits to archetype hint strings for the inference engine.
 *
 * Returns hints for traits above a threshold (default 0.4), weighted by
 * trait strength. These feed into `inferUserArchetype()` as soft hints
 * at 0.2 weight (lighter than explicit desire-based hints at 0.3).
 */
export function profileToArchetypeHints(
  profile: TasteProfile,
  threshold = 0.4,
): string[] {
  if (isProfileEmpty(profile) || profile.confidence < 0.2) return [];

  // Accumulate archetype weights from traits
  const weights: Record<SonicArchetype, number> = {
    flow_organic: 0,
    precision_explicit: 0,
    rhythmic_propulsive: 0,
    tonal_saturated: 0,
    spatial_holographic: 0,
  };

  for (const trait of PROFILE_TRAITS) {
    const val = profile.traits[trait.key];
    if (val < threshold) continue;
    const mappings = TRAIT_ARCHETYPE_MAP[trait.key];
    for (const [arch, w] of mappings) {
      weights[arch] += val * w;
    }
  }

  // Convert to hint strings — only archetypes above a minimum weight
  const ARCHETYPE_HINT_NAMES: Record<SonicArchetype, string> = {
    flow_organic: 'engagement',
    precision_explicit: 'precision',
    rhythmic_propulsive: 'rhythm',
    tonal_saturated: 'tonal',
    spatial_holographic: 'spatial',
  };

  return (Object.entries(weights) as [SonicArchetype, number][])
    .filter(([, w]) => w >= 0.3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2) // max 2 hints from profile
    .map(([arch]) => ARCHETYPE_HINT_NAMES[arch]);
}
