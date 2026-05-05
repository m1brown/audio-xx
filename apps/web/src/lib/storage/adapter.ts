/**
 * Storage adapter contract.
 *
 * P0 seam: every read/write of audio-session persistence flows through this
 * interface. The current implementation (`LocalStorageAdapter`) preserves
 * existing localStorage / sessionStorage keys byte-for-byte. Future backends
 * (cloud sync) can implement the same interface without touching call sites.
 */

import type {
  ActiveSystemRef,
  DraftSystem,
  SavedSystem,
} from '../system-types';

/** Anonymous user record stored at `axx:user`. */
export interface AnonymousUser {
  id: string;
  createdAt: string;
  schemaVersion: 1;
}

export interface StorageAdapter {
  /**
   * Return the anonymous user record, creating one on first call.
   * Returns null in non-browser environments (SSR).
   */
  getOrCreateAnonymousUser(): AnonymousUser | null;

  /** Read guest draft from sessionStorage. */
  readDraft(): DraftSystem | null;
  /** Write or clear (null) the guest draft in sessionStorage. */
  writeDraft(draft: DraftSystem | null): void;

  /** Read persisted saved systems from localStorage. */
  readSavedSystems(): SavedSystem[];
  /** Persist saved systems to localStorage. */
  writeSavedSystems(systems: SavedSystem[]): void;

  /** Read active-system pointer from localStorage. */
  readActiveSystemRef(): ActiveSystemRef;
  /** Persist or clear (null) the active-system pointer. */
  writeActiveSystemRef(ref: ActiveSystemRef): void;
}
