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
  name: string;
  components: SavedSystemComponent[];
  tendencies: string | null;
  notes: string | null;
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
