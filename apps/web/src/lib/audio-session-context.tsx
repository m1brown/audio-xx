'use client';

/**
 * AudioSessionContext — multi-system state management for Audio XX.
 *
 * Provides the active system context that advisory builders will consume
 * in Phase 3. For now, this is purely state infrastructure — no advisory
 * plumbing or API wiring.
 *
 * Guest draft persistence: the draft system is written to sessionStorage
 * on every change and hydrated on mount. This survives refresh but not
 * tab close, matching the product rule that unsaved systems are temporary.
 *
 * Saved systems: will be fetched from the backend in Phase 2. For now,
 * savedSystems starts empty and loading resolves immediately.
 */

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';

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

const initialState: AudioSessionState = {
  activeSystemRef: null,
  savedSystems: [],
  draftSystem: null,
  loading: false, // Phase 2 will set true while fetching
};

// ── Actions ─────────────────────────────────────────────

type AudioSessionAction =
  | { type: 'SET_ACTIVE_SYSTEM'; ref: ActiveSystemRef }
  | { type: 'SET_DRAFT_SYSTEM'; draft: DraftSystem | null }
  | { type: 'UPDATE_DRAFT_SYSTEM'; patch: Partial<DraftSystem> }
  | { type: 'SET_SAVED_SYSTEMS'; systems: SavedSystem[] }
  | { type: 'PROMOTE_DRAFT_TO_SAVED'; saved: SavedSystem }
  | { type: 'CLEAR_SYSTEM_STATE' };

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
        // If setting a draft, auto-activate it
        activeSystemRef: action.draft ? { kind: 'draft' } : state.activeSystemRef,
      };

    case 'UPDATE_DRAFT_SYSTEM': {
      if (!state.draftSystem) return state;
      return {
        ...state,
        draftSystem: { ...state.draftSystem, ...action.patch },
      };
    }

    case 'SET_SAVED_SYSTEMS':
      return {
        ...state,
        savedSystems: action.systems,
        loading: false,
      };

    case 'PROMOTE_DRAFT_TO_SAVED':
      return {
        ...state,
        draftSystem: null,
        savedSystems: [...state.savedSystems, action.saved],
        activeSystemRef: { kind: 'saved', id: action.saved.id },
      };

    case 'CLEAR_SYSTEM_STATE':
      return {
        ...initialState,
      };

    default:
      return state;
  }
}

// ── Context ─────────────────────────────────────────────

interface AudioSessionContextValue {
  state: AudioSessionState;
  dispatch: React.Dispatch<AudioSessionAction>;
}

const AudioSessionContext = createContext<AudioSessionContextValue | null>(null);

// ── sessionStorage helpers ──────────────────────────────

function readDraftFromStorage(): DraftSystem | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const snapshot: DraftSystemSnapshot = JSON.parse(raw);
    // Validate minimum shape
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

function clearDraftStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ── Provider ────────────────────────────────────────────

export function AudioSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(audioSessionReducer, initialState);
  const mountedRef = useRef(false);

  // ── Hydrate draft from sessionStorage on mount ──
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const draft = readDraftFromStorage();
    if (draft) {
      dispatch({ type: 'SET_DRAFT_SYSTEM', draft });
    }
  }, []);

  // ── Persist draft to sessionStorage on change ──
  // Skip the first render to avoid writing the initial null back to storage
  // before hydration completes.
  const initialRenderRef = useRef(true);
  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }
    writeDraftToStorage(state.draftSystem);
  }, [state.draftSystem]);

  // ── Clear draft storage when promoted ──
  // Detect transition: if activeSystemRef just became 'saved' and draftSystem
  // just became null in the same state, clear storage. This is handled
  // automatically by writeDraftToStorage(null) above, but we also clear
  // explicitly on PROMOTE for safety.
  const prevDraftRef = useRef(state.draftSystem);
  useEffect(() => {
    if (prevDraftRef.current && !state.draftSystem) {
      clearDraftStorage();
    }
    prevDraftRef.current = state.draftSystem;
  }, [state.draftSystem]);

  return (
    <AudioSessionContext.Provider value={{ state, dispatch }}>
      {children}
    </AudioSessionContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────

/**
 * Access the audio session state and dispatch.
 *
 * Must be called within AudioSessionProvider.
 * Returns { state, dispatch } — consumers read state and dispatch actions.
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

export type { AudioSessionAction, AudioSessionContextValue };
