/**
 * useSavedSystems — thin React access layer over the saved-system repository.
 *
 * Deliberately minimal:
 *  - loads once on mount from localStorage
 *  - exposes save / remove / rename / reload
 *  - no advisory integration, no scoring, no preference modeling
 *
 * All persistence goes through ./repository so the storage boundary is preserved.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SavedSystemProfile } from './types';
import { loadAll, loadOne, saveOne, removeOne } from './repository';
import { renameSystem as renameHelper, touch } from './helpers';

export interface UseSavedSystemsResult {
  systems: SavedSystemProfile[];
  ready: boolean;
  reload: () => void;
  getOne: (id: string) => SavedSystemProfile | undefined;
  save: (system: SavedSystemProfile) => SavedSystemProfile;
  remove: (id: string) => void;
  rename: (id: string, label: string) => SavedSystemProfile | undefined;
}

export function useSavedSystems(): UseSavedSystemsResult {
  const [systems, setSystems] = useState<SavedSystemProfile[]>([]);
  const [ready, setReady] = useState(false);

  const reload = useCallback(() => {
    setSystems(loadAll());
    setReady(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const getOne = useCallback(
    (id: string): SavedSystemProfile | undefined => loadOne(id) ?? undefined,
    [],
  );

  const save = useCallback((system: SavedSystemProfile): SavedSystemProfile => {
    const stamped = touch(system);
    saveOne(stamped);
    setSystems(loadAll());
    return stamped;
  }, []);

  const remove = useCallback((id: string): void => {
    removeOne(id);
    setSystems(loadAll());
  }, []);

  const rename = useCallback(
    (id: string, label: string): SavedSystemProfile | undefined => {
      const existing = loadOne(id);
      if (!existing) return undefined;
      const renamed = touch(renameHelper(existing, label));
      saveOne(renamed);
      setSystems(loadAll());
      return renamed;
    },
    [],
  );

  return { systems, ready, reload, getOne, save, remove, rename };
}
