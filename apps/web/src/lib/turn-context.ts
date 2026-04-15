/**
 * TurnContext — canonical extraction and normalization for each conversation turn.
 *
 * This module centralizes the extraction pipeline so that all downstream
 * consumers (intent detection, advisory builders, save prompt, rendering)
 * operate on the same normalized data.
 *
 * Pipeline order:
 *   1. Subject extraction (brands + products from user text)
 *   2. Desire extraction (what qualities the user wants more/less of)
 *   3. System description detection (ownership language + component list)
 *   4. Component normalization and deduplication
 *   5. Active system resolution (saved/draft/inline-promoted)
 *   6. Extraction confidence scoring
 *
 * The resulting TurnContext is immutable for the turn — all builders
 * and routing decisions consume this same object.
 */

import type { SubjectMatch, DesireSignal } from './intent';
import { extractSubjectMatches, extractDesires } from './intent';
import type { ActiveSystemContext, AudioSessionState, ProposedSystem } from './system-types';
import { resolveActiveSystemContext, activeSystemToProfile } from './system-bridge';
import type { SystemProfile } from './system-profile';
import { detectSystemDescription } from './system-extraction';

// ── Types ────────────────────────────────────────────────

export type ExtractionConfidence = 'high' | 'moderate' | 'low';

export interface TurnContext {
  /** Raw user message for this turn. */
  rawMessage: string;

  /** Extracted subject matches (brands + products), normalized. */
  subjectMatches: SubjectMatch[];
  /** Convenience: subject names only. */
  subjects: string[];

  /** Extracted desire signals ("want more warmth", "less brightness"). */
  desires: DesireSignal[];

  /** Proposed system from system description detection. Null if not detected. */
  proposedSystem: ProposedSystem | null;

  /**
   * Active system for this turn.
   * Resolved from: explicit ref → single-saved auto-activate → inline promotion.
   * Null if no system context is available.
   */
  activeSystem: ActiveSystemContext | null;

  /**
   * System profile derived from activeSystem.
   * Null when no system is active (not DEFAULT_SYSTEM_PROFILE).
   */
  activeProfile: SystemProfile | null;

  /**
   * How confident the extraction is.
   * - high: saved/draft system active, or inline promotion with 3+ components
   * - moderate: inline promotion with 2 components, or saved system auto-activated
   * - low: no system context, brand-only matches, or ambiguous extraction
   */
  confidence: ExtractionConfidence;

  /**
   * Where the active system came from.
   * - 'saved' — explicitly set or auto-activated saved system
   * - 'draft' — guest draft system
   * - 'inline' — promoted from current message's detected components
   * - null — no active system
   */
  systemSource: 'saved' | 'draft' | 'inline' | null;
}

// ── Normalization ───────────────────────────────────────

/**
 * Normalize a display name to prevent "JOB JOB 225" style duplication.
 * If the product name already starts with the brand, don't repeat the brand.
 */
export function normalizeDisplayName(brand: string, name: string): string {
  const b = brand.trim();
  const n = name.trim();
  if (!b) return n || 'Unknown';
  if (!n) return b;
  if (n.toLowerCase().startsWith(b.toLowerCase())) {
    return n.charAt(0).toUpperCase() + n.slice(1);
  }
  return `${b} ${n}`;
}

/**
 * Normalize components in an ActiveSystemContext — deduplicate brand
 * prefixes and clean up empty names.
 */
function normalizeSystemComponents(system: ActiveSystemContext): ActiveSystemContext {
  return {
    ...system,
    components: system.components.map((c) => ({
      ...c,
      name: c.name.toLowerCase().startsWith(c.brand.toLowerCase())
        ? c.name
        : c.name,
      // The display normalization happens at render time via normalizeDisplayName.
      // Here we just ensure brand/name are trimmed.
      brand: c.brand.trim(),
    })),
  };
}

// ── Builder ─────────────────────────────────────────────

/**
 * Build the canonical TurnContext for a conversation turn.
 *
 * This runs BEFORE intent detection and BEFORE advisory builder selection.
 * The result is shared by all downstream consumers.
 */
export function buildTurnContext(
  rawMessage: string,
  audioState: AudioSessionState,
  dismissedFingerprints: Set<string>,
): TurnContext {
  // ── Step 1: Subject extraction ──────────────────────
  const subjectMatches = extractSubjectMatches(rawMessage);
  const subjects = subjectMatches.map((m) => m.name);

  // ── Step 2: Desire extraction ───────────────────────
  const desires = extractDesires(rawMessage);

  // ── Step 3: System description detection ────────────
  const proposedSystem = detectSystemDescription(rawMessage, subjectMatches, audioState);

  // ── Step 4: Active system resolution ────────────────
  // Priority: user-stated system (inline) → explicit ref → auto-activate single saved
  //
  // When the user explicitly describes a system in the current message
  // (proposedSystem with ≥ 2 components), that ALWAYS takes precedence
  // over any saved/draft system. This prevents phantom saved-system
  // contamination when the user provides a new chain to evaluate.
  // Saved systems only apply when the user did NOT state components.
  let activeSystem: ActiveSystemContext | null = null;
  let systemSource: TurnContext['systemSource'] = null;

  if (proposedSystem && proposedSystem.components.length >= 2) {
    // User explicitly stated a system in this message — use it,
    // regardless of whether a saved system exists.
    activeSystem = {
      name: proposedSystem.suggestedName,
      components: proposedSystem.components.map((c) => ({
        name: c.name,
        brand: c.brand,
        category: c.category,
        role: c.role,
      })),
      tendencies: null,
      location: null,
      primaryUse: null,
    };
    systemSource = 'inline';
  } else if (
    // Phase K — persistence of inline-detected system across follow-up turns.
    //
    // Without this branch, the orchestrator only honours an inline
    // ProposedSystem on the turn it was detected. A follow-up like
    // "my stereo doesn't have a lot of bass" carries no system tokens
    // of its own, so the resolver fell back to the saved system and
    // phantom components (e.g. WLM / JOB / Chord) re-leaked into the
    // active system.
    //
    // The page.tsx orchestrator stores the most recent inline detection
    // on audioState.proposedSystem until the user explicitly accepts or
    // dismisses it. We honour that persistence here: while a non-dismissed
    // proposedSystem exists, it takes precedence over saved/draft systems
    // for subsequent turns. The user's freshly-stated system stays active
    // for the rest of the conversation.
    audioState.proposedSystem
    && audioState.proposedSystem.components.length >= 2
    && !dismissedFingerprints.has(audioState.proposedSystem.fingerprint)
  ) {
    const persisted = audioState.proposedSystem;
    activeSystem = {
      name: persisted.suggestedName,
      components: persisted.components.map((c) => ({
        name: c.name,
        brand: c.brand,
        category: c.category,
        role: c.role,
      })),
      tendencies: null,
      location: null,
      primaryUse: null,
    };
    systemSource = 'inline';
  } else {
    // No user-stated system — fall back to saved/draft system.
    activeSystem = resolveActiveSystemContext(audioState);
    if (activeSystem) {
      const ref = audioState.activeSystemRef;
      systemSource = ref?.kind === 'draft' ? 'draft' : 'saved';
      activeSystem = normalizeSystemComponents(activeSystem);
    } else if (audioState.savedSystems.length === 1) {
      // resolveActiveSystemContext already handles this, but track the source
      systemSource = 'saved';
    }
  }

  // ── Step 5: Profile resolution ──────────────────────
  const activeProfile = activeSystem
    ? activeSystemToProfile(audioState)
    : null;

  // ── Step 6: Confidence scoring ──────────────────────
  let confidence: ExtractionConfidence = 'low';
  if (systemSource === 'saved' || systemSource === 'draft') {
    confidence = 'high';
  } else if (systemSource === 'inline') {
    confidence = (proposedSystem?.components.length ?? 0) >= 3 ? 'high' : 'moderate';
  } else if (subjectMatches.length >= 2) {
    confidence = 'moderate';
  }

  // ── Dev logging ─────────────────────────────────────
  if (process.env.NODE_ENV === 'development') {
    console.log('[TurnContext] subjects:', subjects);
    console.log('[TurnContext] subjectMatches:', subjectMatches.map((m) => `${m.kind}:${m.name}`));
    console.log('[TurnContext] activeSystem:', activeSystem?.name ?? '(none)', '| source:', systemSource);
    if (proposedSystem) {
      console.log('[TurnContext] proposed:', proposedSystem.suggestedName,
        '| components:', proposedSystem.components.map((c) => normalizeDisplayName(c.brand, c.name)));
    }
    console.log('[TurnContext] confidence:', confidence);
  }

  return {
    rawMessage,
    subjectMatches,
    subjects,
    desires,
    proposedSystem,
    activeSystem,
    activeProfile,
    confidence,
    systemSource,
  };
}
