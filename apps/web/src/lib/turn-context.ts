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
import type { ListenerProfile, PreferenceSignal } from './listener-preferences';
import {
  extractPreferenceSignals,
  applySignals,
  createDefaultProfile,
} from './listener-preferences';

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

  /**
   * Stage PB2.2 — Listener preference signals extracted from rawMessage.
   * Per-turn snapshot only (no cross-turn accumulation in v1).
   */
  preferenceSignals: PreferenceSignal[];

  /**
   * Stage PB2.2 — Listener profile derived from this turn's signals
   * applied to a fresh default profile. Cross-turn accumulation will
   * be added by consumers that maintain their own profile state.
   */
  listenerProfile: ListenerProfile;

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
  /**
   * Stage PB2.3 — optional accumulated listener profile from prior turns.
   * When omitted, this turn starts from a fresh default profile (legacy
   * per-turn snapshot behavior). When provided, the turn's signals are
   * folded on top of the existing profile so confidence and lean
   * accumulate across the conversation.
   */
  existingListenerProfile?: ListenerProfile,
): TurnContext {
  // ── Step 1: Subject extraction ──────────────────────
  const subjectMatches = extractSubjectMatches(rawMessage);
  const subjects = subjectMatches.map((m) => m.name);

  // ── Step 2: Desire extraction ───────────────────────
  const desires = extractDesires(rawMessage);

  // ── Step 2b: Listener-preference extraction (PB2.2 / PB2.3) ──
  // Sits alongside desire extraction. If an accumulated profile from
  // earlier turns is passed in, this turn's signals are folded onto it
  // so the lean strengthens (with diminishing returns) over time.
  // Otherwise we fall back to the per-turn snapshot behaviour.
  const preferenceSignals = extractPreferenceSignals(rawMessage);
  const baseProfile = existingListenerProfile ?? createDefaultProfile();
  const listenerProfile = applySignals(baseProfile, preferenceSignals);

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

  /*
   * A DEGRADED RESTATEMENT OF THE SAVED SYSTEM IS NOT A NEW SYSTEM.
   *
   * "Assess this system" sends the saved chain as message text, and the
   * inline detector re-parses it — often worse than the saved record it came
   * from ("dCS Rossini Apex, ARC ref, ..." re-parsed to the bare brands
   * "Dcs, ARC"). Inline precedence then displaced four resolved saved
   * components with two bare brands, and the engine asked the listener to
   * identify equipment it was holding a complete record of. That is the
   * saved-system invariant violated at the layer above the seeding fix:
   * selecting a saved system may never yield fewer components.
   *
   * Precedence is unchanged for genuine new chains: if ANY inline component
   * fails to match a saved component's identity (or at least its brand), the
   * user has stated different equipment and the inline system wins exactly
   * as before. Only a restatement that adds nothing defers to the saved
   * record it restates.
   */
  const savedForGuard = resolveActiveSystemContext(audioState);
  const restatesSaved = (
    proposed: { components: Array<{ brand?: string | null; name?: string | null }> } | null | undefined,
  ): boolean => {
    if (!proposed || !savedForGuard || savedForGuard.components.length === 0) return false;
    // No count comparison: the parser can split one saved product into two
    // fragments ("DeVore Orangutan O/96" → "DeVore Orangutan" + "DeVore
    // O/96"), and a fragment count above the saved count is not new
    // equipment. New equipment is a component that matches NOTHING saved —
    // one such component and the inline chain wins exactly as before.
    const fold = (x: string) => new Set(
      (x ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
        .filter((t) => t.length >= 2).map((t) => t.replace(/s$/, '')));
    return proposed.components.every((c) => {
      const inlineToks = fold(`${c.brand ?? ''} ${c.name ?? ''}`);
      if (inlineToks.size === 0) return true;
      return savedForGuard.components.some((sc) => {
        const savedToks = fold(`${sc.brand ?? ''} ${sc.name ?? ''}`);
        const overlap = [...inlineToks].filter((t) => savedToks.has(t)).length;
        return overlap >= Math.min(2, inlineToks.size, savedToks.size);
      });
    });
  };

  /*
   * THE INVARIANT, applied at the source (production blocker, 2026-09-01):
   * a restatement of the active saved system is NOT a proposal. Nulling it
   * HERE means every consumer agrees at once — the save-suggestion chip
   * cannot offer a degraded duplicate ("You described a system: Dcs, ARC"),
   * the saved-system injection guards do not treat the restatement as new
   * equipment, and the canonical record stays authoritative. A single
   * component that matches nothing saved keeps the whole inline chain, as
   * before: SAVED STRUCTURED STATE > NATURAL-LANGUAGE REPARSE, but only
   * for what the listener has not actually changed.
   */
  const effectiveProposedSystem = proposedSystem && restatesSaved(proposedSystem) ? null : proposedSystem;

  if (effectiveProposedSystem && effectiveProposedSystem.components.length >= 2) {
    // User explicitly stated a system in this message — use it,
    // regardless of whether a saved system exists.
    activeSystem = {
      name: effectiveProposedSystem.suggestedName,
      components: effectiveProposedSystem.components.map((c) => ({
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
    // effectiveProposedSystem exists, it takes precedence over saved/draft systems
    // for subsequent turns. The user's freshly-stated system stays active
    // for the rest of the conversation.
    audioState.proposedSystem
    && audioState.proposedSystem.components.length >= 2
    && !dismissedFingerprints.has(audioState.proposedSystem.fingerprint)
    && !restatesSaved(audioState.proposedSystem)
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
    confidence = (effectiveProposedSystem?.components.length ?? 0) >= 3 ? 'high' : 'moderate';
  } else if (subjectMatches.length >= 2) {
    confidence = 'moderate';
  }

  // ── Dev logging ─────────────────────────────────────
  // P0 debug: always log the active system used for evaluation (temporary).
  console.log('[TurnContext] Active system used for evaluation:', activeSystem
    ? {
        name: activeSystem.name,
        source: systemSource,
        components: activeSystem.components.map((c) => {
          const b = (c.brand || '').trim();
          const n = (c.name || '').trim();
          return b && !n.toLowerCase().startsWith(b.toLowerCase()) ? `${b} ${n}` : n || b || 'Unknown';
        }),
        tendencies: activeSystem.tendencies,
      }
    : '(none)',
  );
  if (process.env.NODE_ENV === 'development') {
    console.log('[TurnContext] subjects:', subjects);
    console.log('[TurnContext] subjectMatches:', subjectMatches.map((m) => `${m.kind}:${m.name}`));
    if (effectiveProposedSystem) {
      console.log('[TurnContext] proposed:', effectiveProposedSystem.suggestedName,
        '| components:', effectiveProposedSystem.components.map((c) => normalizeDisplayName(c.brand, c.name)));
    }
    console.log('[TurnContext] confidence:', confidence);
  }

  return {
    rawMessage,
    subjectMatches,
    subjects,
    desires,
    preferenceSignals,
    listenerProfile,
    proposedSystem: effectiveProposedSystem,
    activeSystem,
    activeProfile,
    confidence,
    systemSource,
  };
}
