/**
 * Active saved-system state.
 *
 * Minimal, isolated pointer to the "currently viewing" SavedSystemProfile id.
 * Step 1 of the advisory-bridge sequence — NOT wired into advisory yet.
 *
 * Storage choice: sessionStorage, scoped to the tab. This matches the
 * "currently viewing" semantic — closing the tab clears it — and keeps
 * it well away from the persistent saved-system repository in ./repository.
 * SSR-safe: every entry point guards on `window`.
 */

const STORAGE_KEY = 'audioxx:active-saved-system:v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function getActiveSavedSystemId(): string | null {
  if (!isBrowser()) return null;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setActiveSavedSystemId(id: string | null): void {
  if (!isBrowser()) return;
  try {
    if (id === null) {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(STORAGE_KEY, id);
    }
  } catch {
    // quota / privacy mode — swallow, state is non-critical
  }
}

export function clearActiveSavedSystemId(): void {
  setActiveSavedSystemId(null);
}
