/**
 * Saved-System foundation — public surface.
 *
 * Future advisory builders should import from this module rather than
 * reaching into `./types`, `./helpers`, or `./repository` directly. The
 * surface is intentionally narrow.
 */

export type {
  SavedSystemProfile,
  SavedSystemRole,
  SavedSystemSlot,
  SavedSystemComponentRow,
  SavedSystemComponentStatus,
  SavedSystemRoom,
  SavedSystemSnapshot,
} from './types';

export {
  newSystemId,
  createSystem,
  touch,
  addComponent,
  removeComponent,
  updateComponent,
  setRoom,
  renameSystem,
  componentInSlot,
  componentsInSlot,
} from './helpers';

export {
  savedSystemToLegacyContext,
  buildSyntheticSystemText,
} from './legacyAdapter';
export {
  resolveSavedSystemForAdvisory,
  type ResolvedAdvisorySystem,
} from './resolveForAdvisory';

export {
  getActiveSavedSystemId,
  setActiveSavedSystemId,
  clearActiveSavedSystemId,
} from './activeSystem';

export { useSavedSystems } from './useSavedSystems';
export type { UseSavedSystemsResult } from './useSavedSystems';

export {
  loadAll,
  loadOne,
  saveOne,
  removeOne,
  clearAll,
} from './repository';
