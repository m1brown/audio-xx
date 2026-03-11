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
  DraftSystemSnapshot,
  SavedSystem,
} from './system-types';

// ── Constants ───────────────────────────────────────────

const DRAFT_STORAGE_KEY = 'audioxx:draft-system';

// ── Initial state ───────────────────────────────────────

/**
 * Synchronous lazy initializer for useReducer.
 * Hydrates guest draft from sessionStorage on first render.
 */
function buildInitialState(): AudioSessionState {
  const draft = readDraftFromStorage();
  return {
    activeSystemRef: draft ? { kind: 'draft' } : null,
    savedSystems: [],
    draftSystem: draft,
    loading: false,
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
  | { type: 'SET_LOADING'; loading: boolean };

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
      };

    case 'SET_LOADING':
      return { ...state, loading: action.loading };

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

// ── sessionStorage helpers ──────────────────────────────

function readDraftFromStorage(): DraftSystem | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const snapshot: DraftSystemSnapshot = JSON.parse(raw);
    if (
      typeof snapshot.name !== 'string' ||
      !Array.isArray(snapshot.components)
    ) {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      return null;
    }
    return {
      name: snapshot.name,
      components: snapshot.components,
      tendencies: snapshot.tendencies ?? null,
      notes: snapshot.notes ?? null,
    };
  } catch {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    return null;
  }
}

function writeDraftToStorage(draft: DraftSystem | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!draft) {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }
    const snapshot: DraftSystemSnapshot = {
      name: draft.name,
      components: draft.components,
      tendencies: draft.tendencies,
      notes: draft.notes,
    };
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // sessionStorage full or unavailable — degrade silently
  }
}

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
    writeDraftToStorage(state.draftSystem);
  }, [state.draftSystem]);

  // ── Auth-aware loading ──
  const loadSavedSystems = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', loading: true });

    const [profile, systems] = await Promise.all([
      fetchProfile(),
      fetchSystems(),
    ]);

    dispatch({
      type: 'SET_SAVED_SYSTEMS',
      systems,
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
      // User signed out. Clear saved systems but preserve any draft.
      if (loadedForUserRef.current) {
        loadedForUserRef.current = null;
        dispatch({
          type: 'SET_SAVED_SYSTEMS',
          systems: [],
          activeSystemId: null,
        });
      }
    }
  }, [status, session, loadSavedSystems]);

  // ── Helper functions ──

  const setActiveSavedSystem = useCallback(async (id: string) => {
    // Optimistic: update state immediately, persist in background.
    dispatch({ type: 'SET_ACTIVE_SYSTEM', ref: { kind: 'saved', id } });
    await patchProfileActiveSystem(id);
  }, []);

  const clearActiveSystem = useCallback(async () => {
    dispatch({ type: 'SET_ACTIVE_SYSTEM', ref: null });
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
