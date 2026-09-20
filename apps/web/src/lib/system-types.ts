/**
 * Multi-system modeling types for Audio XX.
 *
 * Three system states:
 *   - SavedSystem: backend-persisted, requires authentication
 *   - DraftSystem: guest in-session, persisted to sessionStorage
 *   - ProposedSystem: conversation-extracted, pending user review (Phase 5)
 *
 * ActiveSystemRef is a discriminated union that tells the context provider
 * which system (if any) the advisory builders should use for chain interaction
 * analysis and system-aware recommendations.
 */

import type { ProductCategory } from './catalog-taxonomy';

// ── Active system reference ─────────────────────────────

/**
 * Discriminated union pointing to the currently active system.
 *
 * - { kind: 'saved', id } → authenticated user's persisted system
 * - { kind: 'draft' }     → guest's in-session temporary system
 * - null                   → no system context active
 */
export type ActiveSystemRef =
  | { kind: 'saved'; id: string }
  | { kind: 'draft' }
  | null;

// ── Component role disambiguation ───────────────────────

/**
 * Fine-grained role for amplifier-category components in a system context.
 *
 * The catalog uses 'amplifier' as a blanket ProductCategory.
 * Within a system, the role distinguishes preamp vs power amp vs headphone amp.
 * Maps to the existing Prisma SystemComponent.roleOverride field.
 */
export type SystemComponentRole =
  | 'preamp'
  | 'power_amp'
  | 'headphone_amp'
  | 'phono_stage'
  | null;

/**
 * Draft components from the ASSESSMENT's own component graph (turn-0
 * consolidation, 2026-09-20).
 *
 * The save-flow proposal was built by a parallel brand-map extraction that
 * defaulted unknown brands to category 'other' and could drop components
 * the assessment resolved perfectly well — the listener then reviewed a
 * save sheet showing "Butler Monads — Other" beneath an assessment that
 * had just typed it as an amplifier and reasoned from its power figures.
 * The assessment graph is the authority on what each box is; the proposal
 * inherits it. Brand text from the original extraction is preserved where
 * a name matches.
 */
export function draftComponentsFromAssessed(
  assessed: Array<{ displayName: string; role?: string | null }>,
  prior?: DraftSystemComponent[],
): DraftSystemComponent[] {
  const toDraft = (role: string | null | undefined): { category: ProductCategory; role: SystemComponentRole } => {
    const r = (role ?? '').toLowerCase();
    if (r === 'preamplifier' || r === 'preamp') return { category: 'amplifier', role: 'preamp' };
    if (r === 'amplifier' || r === 'power_amp' || r === 'power-amp') return { category: 'amplifier', role: null };
    if (r === 'integrated') return { category: 'integrated', role: null };
    if (r === 'speaker' || r === 'loudspeaker') return { category: 'speaker', role: null };
    if (r === 'subwoofer') return { category: 'subwoofer', role: null };
    if (r === 'dac') return { category: 'dac', role: null };
    if (r === 'streamer' || r === 'source') return { category: 'streamer', role: null };
    if (r === 'streamer_dac') return { category: 'streamer_dac', role: null };
    if (r === 'turntable') return { category: 'turntable', role: null };
    if (r === 'cartridge') return { category: 'cartridge', role: null };
    if (r === 'phono') return { category: 'phono', role: 'phono_stage' };
    if (r === 'headphone') return { category: 'headphone', role: null };
    return { category: 'other', role: null };
  };
  return assessed.map((c) => {
    const match = prior?.find((p) => {
      // A prior row with an EMPTY model name matches nothing: ''.includes
      // is vacuously true, and a brand-only row ("ARC", "") would glue its
      // brand onto whichever assessed component happened to be compared
      // first ("ARC Acora QRC-2", live 2026-09-20).
      const pname = p.name.trim().toLowerCase();
      const full = `${p.brand} ${p.name}`.trim().toLowerCase();
      const dn = c.displayName.toLowerCase();
      if (pname === '') return false;
      return full === dn || pname === dn || dn.includes(pname);
    });
    return {
      name: match?.name?.trim() || c.displayName,
      brand: match?.brand?.trim() ?? '',
      ...toDraft(c.role),
    };
  });
}

// ── Draft system (guest, in-session) ────────────────────

export interface DraftSystemComponent {
  name: string;
  brand: string;
  category: ProductCategory;
  role: SystemComponentRole;
}

export interface DraftSystem {
  name: string;
  components: DraftSystemComponent[];
  /** Computed summary of system character, e.g. "warm, tube-driven, vinyl-focused". */
  tendencies: string | null;
  notes: string | null;
}

// ── Saved system (backend-persisted) ────────────────────

export interface SavedSystemComponent {
  /** SystemComponent junction row ID. */
  id: string;
  /** Component record ID. */
  componentId: string;
  name: string;
  brand: string;
  category: ProductCategory;
  role: SystemComponentRole;
  notes: string | null;
}

export interface SavedSystem {
  id: string;
  /**
   * Owning user id. Optional for back-compat with records persisted before
   * the P0 storage seam — read paths backfill from the anonymous user record
   * on first access.
   */
  userId?: string;
  name: string;
  components: SavedSystemComponent[];
  tendencies: string | null;
  notes: string | null;
  location: string | null;
  room: string | null;
  primaryUse: string | null;
}

// ── Proposed system (conversation-extracted, Phase 5) ─────

/**
 * A system description extracted from conversation, pending user review.
 *
 * Not yet saved — the user must review and confirm before it becomes
 * a DraftSystem or SavedSystem. This prevents auto-saving and ensures
 * the user controls what gets persisted.
 */
export interface ProposedSystem {
  /** Suggested system name (e.g. "Your system" or derived from components). */
  suggestedName: string;
  /** Extracted component candidates — best-effort from conversation. */
  components: DraftSystemComponent[];
  /** The user message that triggered extraction. */
  sourceQuery: string;
  /** Fingerprint for duplicate suppression (sorted brand+name, lowercased). */
  fingerprint: string;
  /**
   * If the proposed system matches a known reference system (reviewer, founder, etc.),
   * this holds the match details. Null when no match is found.
   */
  knownSystemMatch?: {
    id: string;
    label: string;
    attribution: string;
    philosophy: string;
    coreOverlap: number;
  } | null;
}

// ── Session state ───────────────────────────────────────

export interface AudioSessionState {
  activeSystemRef: ActiveSystemRef;
  /** All persisted systems for the authenticated user. Empty for guests. */
  savedSystems: SavedSystem[];
  /** Guest draft system, hydrated from sessionStorage. */
  draftSystem: DraftSystem | null;
  /** True while fetching saved systems from the backend on mount. */
  loading: boolean;
  /** Conversation-extracted system pending user review. Null when none. */
  proposedSystem: ProposedSystem | null;
}

// ── Active system context for advisory builders ─────────

/**
 * Lightweight view of the active system, passed to advisory builders.
 *
 * This is the bridge between the session state layer and the advisory
 * engine. Builders receive this instead of accessing AudioSessionState
 * directly, keeping them decoupled from React context.
 *
 * Null when no system is active — builders fall back to conversation
 * extraction (existing behavior).
 */
export interface ActiveSystemContext {
  name: string;
  components: Array<{
    name: string;
    brand: string;
    category: ProductCategory;
    role: SystemComponentRole;
  }>;
  tendencies: string | null;
  location: string | null;
  primaryUse: string | null;
}

// ── sessionStorage serialization shape ──────────────────

/**
 * Minimal shape written to sessionStorage under key 'audioxx:draft-system'.
 * Intentionally mirrors DraftSystem — kept as a separate type so the
 * persistence boundary is explicit and the shape can diverge if needed.
 */
export interface DraftSystemSnapshot {
  name: string;
  components: DraftSystemComponent[];
  tendencies: string | null;
  notes: string | null;
}
