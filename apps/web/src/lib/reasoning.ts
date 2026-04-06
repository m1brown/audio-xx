/**
 * Three-layer reasoning model.
 *
 * Explicitly separates:
 *   1. Taste inference   — what does the listener value?
 *   2. System diagnosis  — what is the current system doing?
 *   3. Recommendation direction — what direction of change aligns taste with system?
 *
 * This is an organizational layer. It calls existing helpers in
 * system-direction.ts, shopping-intent.ts, and archetype.ts — it
 * does not introduce new computation or scoring logic.
 *
 * The composite ReasoningResult is the contract between "understanding"
 * and "recommending". Product matching reads this result rather than
 * assembling taste/direction inline.
 */

import type { DesireSignal } from './intent';
import type { ExtractedSignals, SignalDirection } from './signal-types';
import type {
  Tendency,
  DirectionArrow,
} from './system-direction';
import type { SystemProfile } from './system-profile';
import { DEFAULT_SYSTEM_PROFILE } from './system-profile';
import type { ShoppingContext } from './shopping-intent';
import type { TasteProfile } from './taste-profile';
import { topTraits } from './taste-profile';
import type { SonicArchetype } from './archetype';
import {
  inferUserArchetype,
  getArchetypeLabel,
  getArchetypeShortLabel,
} from './archetype';
import { profileToArchetypeHints } from './taste-profile';

// Re-use tendency / direction inference from system-direction.
// These are the functions we're organizing, not replacing.
import { inferSystemDirection } from './system-direction';

// ── Layer 1: Taste Inference ─────────────────────────

export interface TasteInference {
  /** Directional desires extracted from user language. */
  desires: DesireSignal[];
  /** Trait signals from the rule engine. */
  traitSignals: Record<string, SignalDirection>;
  /** Matched taste label — human-readable summary. */
  tasteLabel: string;
  /** Inferred sonic archetype preference. */
  archetype: SonicArchetype | null;
  /** Whether the stored taste profile contributed to this inference. */
  storedProfileUsed: boolean;
}

// ── Layer 2: System Diagnosis ────────────────────────

export interface SystemDiagnosis {
  /** Structural system profile (amp type, output type, character). */
  profile: SystemProfile;
  /** Inferred current tendencies from symptom language. */
  currentTendencies: Tendency[];
  /** Human-readable tendency summary. */
  tendencySummary: string | null;
}

// ── Layer 3: Recommendation Direction ────────────────

export interface RecommendationDirection {
  /** Natural-language direction statement. */
  statement: string;
  /** Desired directional changes (quality + up/down). */
  arrows: DirectionArrow[];
  /** Qualities the change should preserve. */
  preserve: string[];
  /** Archetype shift note (when applicable). */
  archetypeNote: string | null;
}

// ── Composite ────────────────────────────────────────

export interface ReasoningResult {
  taste: TasteInference;
  system: SystemDiagnosis;
  direction: RecommendationDirection;
}

// ── Taste label templates ────────────────────────────
// Mirrors the TASTE_PROFILES logic in shopping-intent.ts but
// produces only a label + archetype — no direction templates.

interface TasteLabelRule {
  check: (traits: Record<string, SignalDirection>) => boolean;
  label: string;
  archetype: SonicArchetype;
}

const TASTE_LABEL_RULES: TasteLabelRule[] = [
  {
    check: (t) => t.dynamics === 'up' || t.elasticity === 'up',
    label: 'speed, transient precision, and rhythmic engagement',
    archetype: 'rhythmic_propulsive',
  },
  {
    check: (t) => t.tonal_density === 'up' && t.flow === 'up',
    label: 'harmonic richness, flow, and tonal density',
    archetype: 'tonal_saturated',
  },
  {
    check: (t) => t.clarity === 'up',
    label: 'detail, clarity, and resolution',
    archetype: 'precision_explicit',
  },
  {
    check: (t) => t.fatigue_risk === 'up' || t.glare_risk === 'up',
    label: 'reduced fatigue and smoother presentation',
    archetype: 'flow_organic',
  },
  {
    check: (t) => t.flow === 'up' && t.composure === 'up',
    label: 'smoothness, ease, and composure',
    archetype: 'flow_organic',
  },
  {
    check: (t) => t.flow === 'up',
    label: 'musical flow and harmonic naturalness',
    archetype: 'flow_organic',
  },
  {
    check: (t) => t.tonal_density === 'up',
    label: 'warmth and tonal body',
    archetype: 'tonal_saturated',
  },
  {
    check: (t) => t.spatial_precision === 'up' || t.openness === 'up',
    label: 'spatial depth and imaging precision',
    archetype: 'spatial_holographic',
  },
];

const FALLBACK_TASTE_LABEL = 'musical engagement';

// ── Preserve inference ───────────────────────────────
// Given directional arrows, infer what qualities should not be lost.

function inferPreserve(arrows: DirectionArrow[], tendencies: Tendency[]): string[] {
  const preserve: string[] = [];

  for (const arrow of arrows) {
    if (arrow.direction === 'up') {
      // Pushing one quality up risks losing its complement
      if (arrow.quality === 'warmth' || arrow.quality === 'density' || arrow.quality === 'body') {
        preserve.push('transient definition');
      } else if (arrow.quality === 'speed' || arrow.quality === 'dynamics' || arrow.quality === 'punch') {
        preserve.push('tonal density');
      } else if (arrow.quality === 'clarity' || arrow.quality === 'detail') {
        preserve.push('listening ease');
      } else if (arrow.quality === 'flow' || arrow.quality === 'smoothness' || arrow.quality === 'composure') {
        preserve.push('musical detail');
      } else if (arrow.quality === 'soundstage' || arrow.quality === 'air') {
        preserve.push('tonal weight');
      }
    }
  }

  // If system has known tendencies, preserve qualities that are already good
  for (const t of tendencies) {
    if (t === 'flowing' && !preserve.includes('musical flow')) preserve.push('musical flow');
    if (t === 'dynamic' && !preserve.includes('dynamic energy')) preserve.push('dynamic energy');
    if (t === 'spacious' && !preserve.includes('spatial openness')) preserve.push('spatial openness');
  }

  return preserve.slice(0, 3); // Keep it concise
}

// ── Direction statement builder ──────────────────────

function buildDirectionStatement(
  arrows: DirectionArrow[],
  preserve: string[],
  archetype: SonicArchetype | null,
): string {
  if (arrows.length === 0) {
    if (archetype) {
      return `Your preferences align with a ${archetype} sensibility. The recommendations below are chosen to match that direction.`;
    }
    return 'No strong directional signal — the recommendations below maintain the current character rather than pulling in a new direction.';
  }

  const gains = arrows
    .filter((a) => a.direction === 'up')
    .slice(0, 2)
    .map((a) => `more ${a.quality}`);
  const reductions = arrows
    .filter((a) => a.direction === 'down')
    .slice(0, 2)
    .map((a) => `less ${a.quality}`);

  const parts = [...gains, ...reductions];
  const preserveNote = preserve.length > 0
    ? ` without sacrificing ${preserve.slice(0, 2).join(' or ')}`
    : '';

  if (parts.length === 1) {
    return `Move toward ${parts[0]}${preserveNote}.`;
  }
  const last = parts.pop()!;
  return `Move toward ${parts.join(', ')} and ${last}${preserveNote}.`;
}

// ── Public API ───────────────────────────────────────

/**
 * Layer 1 — infer taste from user language, extracted signals, and stored profile.
 */
export function inferTaste(
  desires: DesireSignal[],
  signals: ExtractedSignals,
  storedProfile: TasteProfile | null,
): TasteInference {
  const traits = signals.traits;

  // Match taste label from trait signals
  const matched = TASTE_LABEL_RULES.find((r) => r.check(traits));
  let tasteLabel = matched?.label ?? FALLBACK_TASTE_LABEL;
  let archetype: SonicArchetype | null = matched?.archetype ?? null;

  // Enrich with stored profile if available and no strong signal match
  let storedProfileUsed = false;
  if (!matched && storedProfile && storedProfile.confidence > 0.3) {
    const topTwo = topTraits(storedProfile, 2);
    if (topTwo.length > 0) {
      const profileHints = profileToArchetypeHints(storedProfile);
      const inferred = profileHints.length > 0
        ? inferUserArchetype(desires, profileHints)
        : undefined;
      if (inferred) {
        archetype = inferred.primary;
        tasteLabel = `a preference toward ${getArchetypeLabel(inferred.primary)}`;
        storedProfileUsed = true;
      }
    }
  }

  // If we have an archetype from stored profile but signals also matched,
  // note the profile reinforcement
  if (matched && storedProfile && storedProfile.confidence > 0.3) {
    const profileHints = profileToArchetypeHints(storedProfile);
    if (archetype && profileHints.includes(archetype)) {
      storedProfileUsed = true;
    }
  }

  return {
    desires,
    traitSignals: traits,
    tasteLabel,
    archetype,
    storedProfileUsed,
  };
}

/**
 * Layer 2 — diagnose system from conversation text and shopping context.
 *
 * Uses system-direction.ts tendency inference for current tendencies.
 * Uses shopping-intent.ts system profile parsing for structural profile.
 *
 * When an active system profile is provided (from the multi-system model),
 * it takes priority over the conversation-derived profile from shopping context.
 * This allows the reasoning engine to use saved system data without requiring
 * the user to re-describe their system each session.
 */
export function diagnoseSystem(
  text: string,
  desires: DesireSignal[],
  signals: ExtractedSignals,
  shoppingCtx: ShoppingContext | null,
  activeSystemProfile?: SystemProfile | null,
): SystemDiagnosis {
  // Active system profile takes priority, then shopping context, then default.
  const profile = activeSystemProfile ?? shoppingCtx?.systemProfile ?? DEFAULT_SYSTEM_PROFILE;

  // Current tendencies + summaries from existing system-direction layer
  const sysDir = inferSystemDirection(text, desires, undefined);
  const currentTendencies = sysDir.currentTendencies;
  const tendencySummary = sysDir.tendencySummary;

  return {
    profile,
    currentTendencies,
    tendencySummary,
  };
}

/**
 * Layer 3 — derive recommendation direction from taste + system.
 *
 * Synthesizes a directional statement, preserves list, and archetype note.
 * This is the bridge between understanding and recommending.
 */
export function deriveDirection(
  taste: TasteInference,
  system: SystemDiagnosis,
  desires: DesireSignal[],
  storedProfile: TasteProfile | null,
): RecommendationDirection {
  // Arrows: from desires + inferred from system tendencies
  const sysDir = inferSystemDirection('', desires, undefined, storedProfile ?? undefined);
  const arrows = sysDir.desiredDirections;

  // Preserve: inferred from arrows + system tendencies
  const preserve = inferPreserve(arrows, system.currentTendencies);

  // Archetype note
  let archetypeNote: string | null = null;
  if (taste.archetype) {
    archetypeNote = `This aligns with ${getArchetypeShortLabel(taste.archetype)} priorities.`;
  }

  const statement = buildDirectionStatement(arrows, preserve, taste.archetype);

  return {
    statement,
    arrows,
    preserve,
    archetypeNote,
  };
}

/**
 * Full reasoning pipeline — runs all three layers in sequence.
 *
 * This is the primary entry point for shopping and diagnosis paths.
 *
 * When activeSystemProfile is provided (from the multi-system model's
 * bridge utility), it is used as the structural system profile, taking
 * priority over the conversation-derived profile from shopping context.
 */
export function reason(
  text: string,
  desires: DesireSignal[],
  signals: ExtractedSignals,
  storedProfile: TasteProfile | null,
  shoppingCtx: ShoppingContext | null,
  activeSystemProfile?: SystemProfile | null,
): ReasoningResult {
  const taste = inferTaste(desires, signals, storedProfile);
  const system = diagnoseSystem(text, desires, signals, shoppingCtx, activeSystemProfile);
  const direction = deriveDirection(taste, system, desires, storedProfile);

  return { taste, system, direction };
}
