/**
 * Saved-System foundation — Phase 1.
 *
 * Bounded first version of the saved-system data model. This is the
 * shape future system-aware advisory logic will read from. It is NOT
 * yet wired into the recommendation pipeline.
 *
 * Scope is intentionally minimal:
 *   - Identity: id, label, role, timestamps.
 *   - Components by named slot (slot is the system position, NOT the
 *     catalog category — a single physical box can occupy 'integrated').
 *   - Optional room / listening context.
 *
 * Anything more (preference modeling, system character scoring, addition
 * evaluation, conflict resolution, multi-system aggregation) is deferred.
 *
 * Co-existence note:
 *   apps/web/src/lib/system-types.ts already defines a flat
 *   `SavedSystem` shape that the existing SystemEditor + Prisma backend
 *   use. That older shape is intentionally NOT modified here. This
 *   module introduces a parallel `SavedSystemProfile` foundation that
 *   future advisory work can build on without disturbing the legacy
 *   editor. Bridging the two is a future task.
 */

// ── Vocabulary ────────────────────────────────────────

/** System role — what this listening setup is for. */
export type SavedSystemRole =
  | 'primary'
  | 'desktop'
  | 'headphone'
  | 'secondary';

/** Component slot in a system. Note: slot is the system position, not
 *  the catalog product category. An integrated amplifier occupies the
 *  `integrated` slot; the same physical box never occupies `pre` or
 *  `power` simultaneously. A streamer + DAC combo occupies both
 *  `source` and `dac` slots when modelled component-wise. */
export type SavedSystemSlot =
  | 'source'
  | 'dac'
  | 'pre'
  | 'power'
  | 'integrated'
  | 'speaker'
  | 'headphone'
  | 'cartridge'
  | 'cable';

/** Component lifecycle status within the system. Used to distinguish
 *  what the user actually listens to from what they are auditioning,
 *  parking, or have moved on from. */
export type SavedSystemComponentStatus =
  | 'current'
  | 'evaluating'
  | 'parked'
  | 'sold';

// ── Component row ─────────────────────────────────────

/** A single component slot row. Either `productId` (catalog match) or
 *  `freeText` (no catalog row yet) must be present — never both empty. */
export interface SavedSystemComponentRow {
  /** Stable id for this row inside the system (uuid-ish). */
  id: string;
  slot: SavedSystemSlot;
  /** Catalog product id when matched. */
  productId?: string;
  /** Free-text component description when not catalog-matched. */
  freeText?: string;
  status: SavedSystemComponentStatus;
  /** Optional per-row notes (e.g. "with KT77 tubes", "balanced cabling"). */
  notes?: string;
}

// ── Room / listening context ──────────────────────────

export interface SavedSystemRoom {
  sizeApprox?: 'small' | 'medium' | 'large';
  treatment?: 'none' | 'light' | 'moderate' | 'heavy';
  /** Free-text listening notes — placement, near-field vs far-field, etc. */
  notes?: string;
}

// ── Saved system profile ──────────────────────────────

/** The minimal saved-system shape future advisory logic reads. */
export interface SavedSystemProfile {
  id: string;
  /** Owning user id. Empty string for guest / unauthenticated. */
  userId: string;
  /** User-facing label, e.g. "Living room", "Office desk". */
  label: string;
  role: SavedSystemRole;
  /** Unix epoch milliseconds. */
  createdAt: number;
  updatedAt: number;
  components: SavedSystemComponentRow[];
  room?: SavedSystemRoom;
}

// ── Persistence snapshot shape ────────────────────────

/** Exact shape written to localStorage. Mirrors `SavedSystemProfile`
 *  but kept as a separate type so the storage boundary is explicit
 *  and future schema migrations have a stable target. */
export interface SavedSystemSnapshot {
  schemaVersion: 1;
  systems: SavedSystemProfile[];
}
