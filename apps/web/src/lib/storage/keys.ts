/**
 * Centralised storage keys.
 *
 * All persistence keys (localStorage and sessionStorage) live here so the
 * adapter layer is the single source of truth. Existing keys are preserved
 * verbatim for backward compatibility — do not rename without a migration.
 */

export const STORAGE_KEYS = {
  /** Anonymous user record (P0). localStorage. */
  user: 'axx:user',
  /** Guest draft system snapshot. sessionStorage. */
  draft: 'audioxx:draft-system',
  /** Persisted saved-system list. localStorage. */
  savedSystems: 'audioxx.systems.v1',
  /** Persisted active-system pointer. localStorage. */
  activeSystem: 'audioxx.active-system.v1',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
