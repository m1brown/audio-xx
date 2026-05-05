'use client';

/**
 * AudioSessionContext — multi-system state management for Audio XX.
 *
 * Phase 2: authenticated loading from /api/profile and /api/systems.
 *
 * Lifecycle:
 *   1. On mount, synchronously hydrate guest draft from sessionStorage
 *      (lazy initializer — no race with React 18 strict mode).
 *   2. When NextAuth session becomes 'authenticated', fetch profile + systems
 *      in parallel. Tracked per-user to avoid re-fetching.
 *   3. Resolve activeSystemRef from profile.activeSystemId — validated against
 *      fetched systems. Stale refs fall back to null (preserving draft ref
 *      if one exists).
 *   4. Guest draft is NEVER destroyed by auth resolution. It persists until
 *      explicitly promoted or cleared.
 *   5. On sign-out, saved systems are cleared but draft is preserved.
 *
 * Helper functions are exposed via context for Phase 3/4 consumers:
 *   - loadSavedSystems()
 *   - setActiveSavedSystem(id)
 *   - clearActiveSystem()
 *   - refreshSavedSystems()
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { useSession } from 'next-auth/react';

import type {
  AudioSessionState,
  ActiveSystemRef,
  DraftSystem,
  ProposedSystem,
  SavedSystem,
} from './system-types';
import { setActiveSavedSystemId } from './saved-system/activeSystem';
import { localStorageAdapter } from './storage/local-storage-adapter';

// ── Initial state ───────────────────────────────────────

/**
 * Synchronous lazy initializer for useReducer.
 * Hydrates guest draft from sessionStorage AND saved systems from
 * localStorage on first render. Systems persisted in localStorage
 * survive refresh and deployments.
 */
function buildInitialState(): AudioSessionState {
  // Ensure the anonymous user record exists from first paint. Idempotent —
  // returns the same record on subsequent calls. No UI surface yet (P0).
  localStorageAdapter.getOrCreateAnonymousUser();
  const draft = localStorageAdapter.readDraft();

  // Saved systems are NOT loaded from localStorage on cold boot.
  // Auth status is unknown at this point — loading saved systems here
  // causes phantom-system contamination when the user is signed out
  // (localStorage retains saved systems from a previous authenticated
  // session). Instead, saved systems are populated by the auth effect:
  //   - authenticated → fetched from API (or fallback to localStorage)
  //   - unauthenticated → remain empty
  //
  // Draft systems (sessionStorage) are session-scoped and safe to load.
  let activeSystemRef: ActiveSystemRef = null;
  if (draft) {
    activeSystemRef = { kind: 'draft' };
  }

  return {
    activeSystemRef,
    savedSystems: [],
    draftSystem: draft,
    loading: false,
    proposedSystem: null,
  };
}

// ── Actions ─────────────────────────────────────────────

type AudioSessionAction =
  | { type: 'SET_ACTIVE_SYSTEM'; ref: ActiveSystemRef }
  | { type: 'SET_DRAFT_SYSTEM'; draft: DraftSystem | null }
  | { type: 'UPDATE_DRAFT_SYSTEM'; patch: Partial<DraftSystem> }
  | { type: 'SET_SAVED_SYSTEMS'; systems: SavedSystem[]; activeSystemId: string | null }
  | { type: 'PROMOTE_DRAFT_TO_SAVED'; saved: SavedSystem }
  | { type: 'CLEAR_SYSTEM_STATE' }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_PROPOSED_SYSTEM'; proposed: ProposedSystem | null };

// ── Reducer ─────────────────────────────────────────────

function audioSessionReducer(
  state: AudioSessionState,
  action: AudioSessionAction,
): AudioSessionState {
  switch (action.type) {
    case 'SET_ACTIVE_SYSTEM':
      return { ...state, activeSystemRef: action.ref };

    case 'SET_DRAFT_SYSTEM':
      return {
        ...state,
        draftSystem: action.draft,
        // Auto-activate when setting a draft.
        // When clearing, only null the ref if it was pointing to draft.
        activeSystemRef: action.draft
          ? { kind: 'draft' }
          : state.activeSystemRef?.kind === 'draft'
            ? null
            : state.activeSystemRef,
      };

    case 'UPDATE_DRAFT_SYSTEM': {
      if (!state.draftSystem) return state;
      return {
        ...state,
        draftSystem: { ...state.draftSystem, ...action.patch },
      };
    }

    case 'SET_SAVED_SYSTEMS': {
      const { systems, activeSystemId } = action;
      let ref: ActiveSystemRef = state.activeSystemRef;

      if (activeSystemId) {
        const exists = systems.some((s) => s.id === activeSystemId);
        if (exists) {
          // Valid saved system — activate it. But if user currently has a
          // draft active, the saved ref takes priority on initial load
          // (the draft is preserved in state, just not the active ref).
          ref = { kind: 'saved', id: activeSystemId };
        } else {
          // Stale activeSystemId — system was deleted.
          // Preserve draft ref if present, otherwise null.
          ref = state.activeSystemRef?.kind === 'draft'
            ? state.activeSystemRef
            : null;
        }
      }
      // If no activeSystemId from backend, preserve current ref (e.g. draft).

      return {
        ...state,
        savedSystems: systems,
        loading: false,
        activeSystemRef: ref,
      };
    }

    case 'PROMOTE_DRAFT_TO_SAVED':
      return {
        ...state,
        draftSystem: null,
        savedSystems: [...state.savedSystems, action.saved],
        activeSystemRef: { kind: 'saved', id: action.saved.id },
      };

    case 'CLEAR_SYSTEM_STATE':
      return {
        activeSystemRef: null,
        savedSystems: [],
        draftSystem: null,
        loading: false,
        proposedSystem: null,
      };

    case 'SET_LOADING':
      return { ...state, loading: action.loading };

    case 'SET_PROPOSED_SYSTEM':
      return { ...state, proposedSystem: action.proposed };

    default:
      return state;
  }
}

// ── Context shape ───────────────────────────────────────

interface AudioSessionHelpers {
  /** Fetch profile + systems from backend and update state. */
  loadSavedSystems: () => Promise<void>;
  /** Set a saved system as active (optimistic dispatch + backend persist). */
  setActiveSavedSystem: (id: string) => Promise<void>;
  /** Clear active system ref (optimistic dispatch + backend persist if authed). */
  clearActiveSystem: () => Promise<void>;
  /** Re-fetch systems from backend (alias for loadSavedSystems). */
  refreshSavedSystems: () => Promise<void>;
}

interface AudioSessionContextValue {
  state: AudioSessionState;
  dispatch: React.Dispatch<AudioSessionAction>;
  helpers: AudioSessionHelpers;
}

const AudioSessionContext = createContext<AudioSessionContextValue | null>(null);

// Persistence for draft / saved systems / active-system ref now flows
// through `localStorageAdapter` (./storage/local-storage-adapter). The
// adapter preserves the prior keys and payload shapes byte-for-byte.

// ── API helpers ─────────────────────────────────────────

interface ProfileResponse {
  activeSystemId: string | null;
  [key: string]: unknown;
}

async function fetchProfile(): Promise<ProfileResponse | null> {
  try {
    const res = await fetch('/api/profile');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchSystems(): Promise<SavedSystem[]> {
  try {
    const res = await fetch('/api/systems');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function patchProfileActiveSystem(activeSystemId: string | null): Promise<boolean> {
  try {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeSystemId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Provider ────────────────────────────────────────────

export function AudioSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(audioSessionReducer, undefined, buildInitialState);
  const { data: session, status } = useSession();

  // Track which user we've already loaded for to avoid redundant fetches.
  const loadedForUserRef = useRef<string | null>(null);

  // ── Persist draft to sessionStorage on every change ──
  useEffect(() => {
    localStorageAdapter.writeDraft(state.draftSystem);
  }, [state.draftSystem]);

  // ── Persist saved systems to localStorage on every change ──
  useEffect(() => {
    localStorageAdapter.writeSavedSystems(state.savedSystems);
  }, [state.savedSystems]);

  // ── Persist active system ref to localStorage on every change ──
  useEffect(() => {
    localStorageAdapter.writeActiveSystemRef(state.activeSystemRef);
  }, [state.activeSystemRef]);

  // ── Auth-aware loading ──
  const loadSavedSystems = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', loading: true });

    const [profile, systems] = await Promise.all([
      fetchProfile(),
      fetchSystems(),
    ]);

    // Prevent backend from wiping locally-persisted systems.
    // If the backend returns empty (new user, no DB rows yet), preserve
    // whatever localStorage already has so we don't lose client-created
    // systems on authentication.
    const systemsToSet =
      systems.length > 0 ? systems : localStorageAdapter.readSavedSystems();

    dispatch({
      type: 'SET_SAVED_SYSTEMS',
      systems: systemsToSet,
      activeSystemId: profile?.activeSystemId ?? null,
    });
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'authenticated') {
      const userId = (session?.user as { id?: string })?.id ?? null;
      if (userId && loadedForUserRef.current !== userId) {
        loadedForUserRef.current = userId;
        loadSavedSystems();
      }
    } else if (status === 'unauthenticated') {
      // User is signed out (or was never signed in). Clear saved systems
      // from in-memory state so advisory builders see no system context.
      // localStorage is left intact — if the user signs back in, the
      // auth handler will re-fetch from the API (or fall back to localStorage).
      loadedForUserRef.current = null;
      dispatch({
        type: 'SET_SAVED_SYSTEMS',
        systems: [],
        activeSystemId: null,
      });
    }
  }, [status, session, loadSavedSystems]);

  // ── Helper functions ──

  const setActiveSavedSystem = useCallback(async (id: string) => {
    // Optimistic: update state immediately, persist in background.
    dispatch({ type: 'SET_ACTIVE_SYSTEM', ref: { kind: 'saved', id } });
    // Sync sessionStorage pointer so all resolution layers agree.
    setActiveSavedSystemId(id);
    await patchProfileActiveSystem(id);
  }, []);

  const clearActiveSystem = useCallback(async () => {
    dispatch({ type: 'SET_ACTIVE_SYSTEM', ref: null });
    // Clear sessionStorage pointer to prevent stale reads.
    setActiveSavedSystemId(null);
    if (status === 'authenticated') {
      await patchProfileActiveSystem(null);
    }
  }, [status]);

  const helpers: AudioSessionHelpers = {
    loadSavedSystems,
    setActiveSavedSystem,
    clearActiveSystem,
    refreshSavedSystems: loadSavedSystems,
  };

  return (
    <AudioSessionContext.Provider value={{ state, dispatch, helpers }}>
      {children}
    </AudioSessionContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────

/**
 * Access the audio session state, dispatch, and helpers.
 *
 * Must be called within AudioSessionProvider.
 */
export function useAudioSession(): AudioSessionContextValue {
  const ctx = useContext(AudioSessionContext);
  if (!ctx) {
    throw new Error(
      'useAudioSession must be used within an AudioSessionProvider',
    );
  }
  return ctx;
}

// ── Re-exports for convenience ──────────────────────────

export type { AudioSessionAction, AudioSessionContextValue, AudioSessionHelpers };
