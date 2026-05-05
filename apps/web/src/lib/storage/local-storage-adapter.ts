/**
 * Browser localStorage / sessionStorage implementation of StorageAdapter.
 *
 * Preserves the exact keys and payload shapes used by audio-session-context
 * prior to P0 — the seam is internal only. SSR-safe: every method short-
 * circuits when `window` is undefined.
 */

import type {
  ActiveSystemRef,
  DraftSystem,
  DraftSystemSnapshot,
  SavedSystem,
} from '../system-types';
import type { AnonymousUser, StorageAdapter } from './adapter';
import { STORAGE_KEYS } from './keys';

function generateId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

class LocalStorageAdapterImpl implements StorageAdapter {
  // ── Anonymous user ──────────────────────────────────────

  getOrCreateAnonymousUser(): AnonymousUser | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.user);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed.id === 'string' &&
          typeof parsed.createdAt === 'string'
        ) {
          return {
            id: parsed.id,
            createdAt: parsed.createdAt,
            schemaVersion: 1,
          };
        }
      }
    } catch {
      // Corrupt record — fall through and recreate.
    }

    const fresh: AnonymousUser = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    };
    try {
      window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(fresh));
    } catch {
      // Quota or privacy mode — degrade silently.
    }
    return fresh;
  }

  // ── Draft (sessionStorage) ──────────────────────────────

  readDraft(): DraftSystem | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEYS.draft);
      if (!raw) return null;
      const snapshot: DraftSystemSnapshot = JSON.parse(raw);
      if (
        typeof snapshot.name !== 'string' ||
        !Array.isArray(snapshot.components)
      ) {
        window.sessionStorage.removeItem(STORAGE_KEYS.draft);
        return null;
      }
      return {
        name: snapshot.name,
        components: snapshot.components,
        tendencies: snapshot.tendencies ?? null,
        notes: snapshot.notes ?? null,
      };
    } catch {
      try {
        window.sessionStorage.removeItem(STORAGE_KEYS.draft);
      } catch {
        // noop
      }
      return null;
    }
  }

  writeDraft(draft: DraftSystem | null): void {
    if (typeof window === 'undefined') return;
    try {
      if (!draft) {
        window.sessionStorage.removeItem(STORAGE_KEYS.draft);
        return;
      }
      const snapshot: DraftSystemSnapshot = {
        name: draft.name,
        components: draft.components,
        tendencies: draft.tendencies,
        notes: draft.notes,
      };
      window.sessionStorage.setItem(
        STORAGE_KEYS.draft,
        JSON.stringify(snapshot),
      );
    } catch {
      // sessionStorage full or unavailable — degrade silently.
    }
  }

  // ── Saved systems (localStorage) ────────────────────────

  readSavedSystems(): SavedSystem[] {
    if (typeof window === 'undefined') return [];
    let parsed: unknown;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.savedSystems);
      if (!raw) return [];
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
    if (!Array.isArray(parsed)) return [];

    const valid = parsed.filter(
      (s: unknown) =>
        s &&
        typeof s === 'object' &&
        typeof (s as SavedSystem).id === 'string' &&
        typeof (s as SavedSystem).name === 'string' &&
        Array.isArray((s as SavedSystem).components),
    ) as SavedSystem[];

    // Migration (P0): backfill userId from the anonymous user record on any
    // pre-existing system that lacks one. Idempotent: subsequent reads find
    // userId already populated and skip the write.
    let mutated = false;
    let anonId: string | null = null;
    for (const s of valid) {
      if (!s.userId) {
        if (anonId === null) {
          anonId = this.getOrCreateAnonymousUser()?.id ?? null;
        }
        if (anonId) {
          s.userId = anonId;
          mutated = true;
        }
      }
    }
    if (mutated) {
      try {
        window.localStorage.setItem(
          STORAGE_KEYS.savedSystems,
          JSON.stringify(valid),
        );
      } catch {
        // noop
      }
    }
    return valid;
  }

  writeSavedSystems(systems: SavedSystem[]): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.savedSystems,
        JSON.stringify(systems),
      );
    } catch {
      // Quota or privacy mode — degrade silently.
    }
  }

  // ── Active system ref (localStorage) ────────────────────

  readActiveSystemRef(): ActiveSystemRef {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.activeSystem);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.kind === 'saved' &&
        typeof parsed.id === 'string'
      ) {
        return { kind: 'saved', id: parsed.id };
      }
      if (parsed && parsed.kind === 'draft') {
        return { kind: 'draft' };
      }
      return null;
    } catch {
      return null;
    }
  }

  writeActiveSystemRef(ref: ActiveSystemRef): void {
    if (typeof window === 'undefined') return;
    try {
      if (ref === null) {
        window.localStorage.removeItem(STORAGE_KEYS.activeSystem);
      } else {
        window.localStorage.setItem(
          STORAGE_KEYS.activeSystem,
          JSON.stringify(ref),
        );
      }
    } catch {
      // degrade silently
    }
  }
}

/** Module-level singleton — safe to import from React components. */
export const localStorageAdapter: StorageAdapter = new LocalStorageAdapterImpl();
