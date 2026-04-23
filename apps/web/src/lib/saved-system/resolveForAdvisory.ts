/**
 * Resolve a saved system to inject into the advisory pipeline.
 *
 * Selection rule:
 *   - if an active saved-system id is set and resolves → use it
 *   - else if exactly one saved system exists → use it
 *   - else if multiple saved systems exist → return 'none' (P0 fix:
 *     the previous "most recently updated" fallback silently injected
 *     wrong systems into evaluations)
 *   - else → none
 *
 * NOTE: page.tsx no longer calls this function for advisory injection.
 * It uses turnCtx.activeSystem (AudioSessionContext) as the single
 * source of truth. This function is retained for the test suite and
 * any non-advisory callers.
 *
 * Pure browser-local. No advisory imports. Caller decides what to do
 * with the result; this module never mutates state.
 */

import { getActiveSavedSystemId } from './activeSystem';
import { loadAll, loadOne } from './repository';
import { buildSyntheticSystemText } from './legacyAdapter';
import type { SavedSystemProfile } from './types';

export type ResolvedAdvisorySystem =
  | { kind: 'one'; profile: SavedSystemProfile; syntheticText: string }
  | { kind: 'ambiguous'; labels: Array<{ id: string; label: string }> }
  | { kind: 'none' };

export function resolveSavedSystemForAdvisory(): ResolvedAdvisorySystem {
  const activeId = getActiveSavedSystemId();
  if (activeId) {
    const found = loadOne(activeId);
    if (found) {
      return {
        kind: 'one',
        profile: found,
        syntheticText: buildSyntheticSystemText(found),
      };
    }
  }

  const all = loadAll();
  if (all.length === 1) {
    const sole = all[0];
    return {
      kind: 'one',
      profile: sole,
      syntheticText: buildSyntheticSystemText(sole),
    };
  }
  if (all.length > 1) {
    // Multiple saved systems with no active ID set — do NOT silently pick one.
    // The previous "most recently updated" fallback was the root cause of
    // phantom-system contamination: a wrong system was silently injected
    // into evaluations. Return 'none' to force explicit selection.
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[resolveForAdvisory] Multiple saved systems but no activeId — returning none.',
        'Count:', all.length,
        'Labels:', all.map((s) => s.label),
      );
    }
    return { kind: 'none' };
  }
  return { kind: 'none' };
}
