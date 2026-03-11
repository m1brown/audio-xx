/**
 * System bridge utilities — convert the multi-system model into the
 * existing SystemProfile type consumed by advisory builders.
 *
 * Phase 1: these functions exist and are tested, but are not yet
 * called by advisory builders. Phase 3 will wire them in.
 *
 * Design principle: the bridge reads from the active system (saved or
 * draft) and produces the same SystemProfile shape that parseSystemProfile()
 * currently derives from raw conversation text. This allows Phase 3 to
 * swap the source without changing downstream builder signatures.
 */

import type { ProductCategory } from './catalog-taxonomy';
import type {
  SystemProfile,
  OutputType,
  SystemCharacter,
} from './system-profile';
import { DEFAULT_SYSTEM_PROFILE } from './system-profile';
import type {
  AudioSessionState,
  DraftSystem,
  DraftSystemComponent,
  SavedSystem,
  SavedSystemComponent,
  SystemComponentRole,
} from './system-types';

// ── Category → output type mapping ──────────────────────

const SPEAKER_CATEGORIES: ReadonlySet<ProductCategory> = new Set([
  'speaker',
]);

const HEADPHONE_CATEGORIES: ReadonlySet<ProductCategory> = new Set([
  'headphone',
  'iem',
]);

// ── Category → tube likelihood ──────────────────────────
// Components in these categories *may* indicate tube amplification,
// but only when their role or name confirms it. The bridge checks
// both category and role.

const AMPLIFIER_CATEGORIES: ReadonlySet<ProductCategory> = new Set([
  'amplifier',
  'integrated',
  'phono',
]);

// ── Tendencies text → character mapping ─────────────────

const WARM_SIGNALS = [
  'warm', 'tube', 'lush', 'rich', 'organic', 'euphonic', 'smooth',
  'vinyl', 'analog', 'analogue',
];

const BRIGHT_SIGNALS = [
  'bright', 'analytical', 'detailed', 'precise', 'lean', 'clinical',
  'revealing', 'transparent',
];

// ── Helpers ─────────────────────────────────────────────

type GenericComponent = DraftSystemComponent | SavedSystemComponent;

function hasCategory(
  components: readonly GenericComponent[],
  categories: ReadonlySet<ProductCategory>,
): boolean {
  return components.some((c) => categories.has(c.category));
}

function inferOutputType(components: readonly GenericComponent[]): OutputType {
  const hasSpeakers = hasCategory(components, SPEAKER_CATEGORIES);
  const hasHeadphones = hasCategory(components, HEADPHONE_CATEGORIES);
  if (hasSpeakers && hasHeadphones) return 'both';
  if (hasSpeakers) return 'speakers';
  if (hasHeadphones) return 'headphones';
  return 'unknown';
}

function inferTubeAmplification(components: readonly GenericComponent[]): boolean {
  return components.some((c) => {
    if (!AMPLIFIER_CATEGORIES.has(c.category)) return false;
    // Check role and name for tube signals
    const nameLower = c.name.toLowerCase();
    const brandLower = c.brand.toLowerCase();
    const roleStr = c.role ?? '';
    const combined = `${nameLower} ${brandLower} ${roleStr}`;
    return (
      combined.includes('tube') ||
      combined.includes('valve') ||
      combined.includes('set ') || // single-ended triode
      combined.includes('triode') ||
      combined.includes('300b') ||
      combined.includes('el34') ||
      combined.includes('kt88') ||
      combined.includes('el84') ||
      combined.includes('6l6') ||
      combined.includes('6v6') ||
      combined.includes('2a3')
    );
  });
}

function inferLowPowerContext(components: readonly GenericComponent[]): boolean {
  return components.some((c) => {
    const nameLower = c.name.toLowerCase();
    return (
      nameLower.includes('single-ended') ||
      nameLower.includes('set ') ||
      nameLower.includes('2a3') ||
      nameLower.includes('300b') ||
      nameLower.includes('first watt') ||
      nameLower.includes('decware') ||
      // Role-based: headphone_amp in the context of sensitive IEMs
      (c.role === 'headphone_amp' && c.category === 'amplifier')
    );
  });
}

function inferCharacterFromTendencies(tendencies: string | null): SystemCharacter {
  if (!tendencies) return 'unknown';
  const lower = tendencies.toLowerCase();
  const warmScore = WARM_SIGNALS.filter((s) => lower.includes(s)).length;
  const brightScore = BRIGHT_SIGNALS.filter((s) => lower.includes(s)).length;
  if (warmScore > 0 && brightScore > 0) return 'neutral';
  if (warmScore > 0) return 'warm';
  if (brightScore > 0) return 'bright';
  return 'unknown';
}

// ── Public API ──────────────────────────────────────────

/**
 * Convert an active system (saved or draft) into the existing SystemProfile
 * type that advisory builders consume.
 *
 * Returns DEFAULT_SYSTEM_PROFILE if no active system is present.
 * This ensures existing behavior is preserved when no system context exists.
 */
export function activeSystemToProfile(state: AudioSessionState): SystemProfile {
  const { activeSystemRef, savedSystems, draftSystem } = state;

  if (!activeSystemRef) return DEFAULT_SYSTEM_PROFILE;

  if (activeSystemRef.kind === 'draft') {
    return draftSystem
      ? systemToProfile(draftSystem.components, draftSystem.tendencies)
      : DEFAULT_SYSTEM_PROFILE;
  }

  // kind === 'saved'
  const saved = savedSystems.find((s) => s.id === activeSystemRef.id);
  return saved
    ? systemToProfile(saved.components, saved.tendencies)
    : DEFAULT_SYSTEM_PROFILE;
}

/**
 * Build a SystemProfile from a component list and tendencies string.
 * Shared implementation for both saved and draft systems.
 */
function systemToProfile(
  components: readonly GenericComponent[],
  tendencies: string | null,
): SystemProfile {
  return {
    outputType: inferOutputType(components),
    systemCharacter: inferCharacterFromTendencies(tendencies),
    tubeAmplification: inferTubeAmplification(components),
    lowPowerContext: inferLowPowerContext(components),
  };
}

/**
 * Generate a human-readable tendencies summary from a component list.
 *
 * This is a lightweight heuristic — it reads component names, brands,
 * and categories to produce a short phrase like "tube amplification,
 * speaker-based, vinyl source". It does NOT replace the signal engine's
 * deeper taste inference.
 *
 * Used when creating or updating a draft system from conversation extraction.
 */
export function inferTendenciesFromComponents(
  components: readonly GenericComponent[],
): string | null {
  if (components.length === 0) return null;

  const traits: string[] = [];

  // Amplification type
  if (inferTubeAmplification(components)) {
    traits.push('tube amplification');
  } else if (components.some((c) => AMPLIFIER_CATEGORIES.has(c.category))) {
    traits.push('solid-state amplification');
  }

  // Output type
  const output = inferOutputType(components);
  if (output === 'speakers') traits.push('speaker-based');
  else if (output === 'headphones') traits.push('headphone-based');
  else if (output === 'both') traits.push('speaker + headphone');

  // Source detection
  const hasVinyl = components.some(
    (c) => c.category === 'turntable' || c.category === 'cartridge' || c.category === 'phono',
  );
  const hasDigital = components.some(
    (c) => c.category === 'dac' || c.category === 'streamer',
  );
  if (hasVinyl && hasDigital) traits.push('vinyl + digital sources');
  else if (hasVinyl) traits.push('vinyl source');
  else if (hasDigital) traits.push('digital source');

  // Low power
  if (inferLowPowerContext(components)) {
    traits.push('low-power context');
  }

  return traits.length > 0 ? traits.join(', ') : null;
}
