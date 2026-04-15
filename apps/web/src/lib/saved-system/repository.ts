/**
 * Saved-System repository — minimal localStorage persistence.
 *
 * Why localStorage:
 *   - The legacy SystemEditor already uses sessionStorage for guest
 *     drafts. Saved systems are heavier and meant to outlive a tab,
 *     so localStorage is the right boundary for the foundation tier.
 *   - The backend Prisma layer is used by the older SavedSystem shape
 *     in `lib/system-types.ts`; this new SavedSystemProfile foundation
 *     is intentionally client-only for now to avoid touching the API
 *     surface. Server promotion is deferred.
 *
 * The repository is the only module in the saved-system layer that
 * touches storage. Helpers stay pure; UI and advisory code go through
 * `loadAll` / `saveOne` / `removeOne`.
 *
 * SSR-safe: every entry point checks for `window` before touching
 * localStorage and returns a sensible empty value when unavailable.
 */

import type { SavedSystemProfile, SavedSystemSnapshot } from './types';

const STORAGE_KEY = 'audioxx:saved-systems:v1';
const CURRENT_SCHEMA_VERSION = 1 as const;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function emptySnapshot(): SavedSystemSnapshot {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, systems: [] };
}

function readSnapshot(): SavedSystemSnapshot {
  if (!isBrowser()) return emptySnapshot();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySnapshot();
    const parsed = JSON.parse(raw) as Partial<SavedSystemSnapshot>;
    if (!parsed || parsed.schemaVersion !== CURRENT_SCHEMA_VERSION || !Array.isArray(parsed.systems)) {
      // Unknown shape — fail closed rather than corrupt user data.
      return emptySnapshot();
    }
    return { schemaVersion: CURRENT_SCHEMA_VERSION, systems: parsed.systems as SavedSystemProfile[] };
  } catch {
    return emptySnapshot();
  }
}

function writeSnapshot(snapshot: SavedSystemSnapshot): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Quota / serialization errors are intentionally swallowed in the
    // foundation tier; UI does not yet surface persistence failures.
  }
}

// ── Public API ────────────────────────────────────────

/** Load all persisted systems. Returns [] when storage is empty or
 *  unavailable. Order is insertion order (most-recently-saved last). */
export function loadAll(): SavedSystemProfile[] {
  return readSnapshot().systems;
}

/** Find one persisted system by id. */
export function loadOne(id: string): SavedSystemProfile | undefined {
  return readSnapshot().systems.find((s) => s.id === id);
}

/** Insert or update a system. The system's own `updatedAt` should
 *  already be fresh — call `touch()` from helpers if you mutated it
 *  outside the helper functions. */
export function saveOne(system: SavedSystemProfile): void {
  const snap = readSnapshot();
  const idx = snap.systems.findIndex((s) => s.id === system.id);
  if (idx === -1) snap.systems.push(system);
  else snap.systems[idx] = system;
  writeSnapshot(snap);
}

/** Remove a system by id. No-op when not present. */
export function removeOne(id: string): void {
  const snap = readSnapshot();
  const next = snap.systems.filter((s) => s.id !== id);
  if (next.length !== snap.systems.length) {
    writeSnapshot({ schemaVersion: CURRENT_SCHEMA_VERSION, systems: next });
  }
}

/** Wipe all persisted systems. Intended for tests / dev. UI should
 *  not call this without explicit user consent. */
export function clearAll(): void {
  if (!isBrowser()) return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
