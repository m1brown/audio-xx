/**
 * Resolve a saved system to inject into the advisory pipeline.
 *
 * Selection rule:
 *   - if an active saved-system id is set and resolves → use it
 *   - else if exactly one saved system exists → use it
 *   - else if multiple saved systems exist → pick the most recently
 *     updated one (the last system the user actually touched). This
 *     avoids an ambiguity-prompt deadlock where the user has no in-chat
 *     way to resolve the conflict. A system with no current components
 *     still returns kind:'one' but with empty syntheticText — the caller
 *     can decide whether that counts as "injectable".
 *   - else → none
 *
 * Ambiguity is only reported when the most-recent tiebreak cannot pick
 * a winner (i.e. zero systems), so in practice the resolver no longer
 * returns 'ambiguous' from normal use. The variant is kept in the union
 * for compatibility with existing call sites.
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
    // Pick the most recently updated system as the implicit active system.
    // This eliminates the ambiguity-prompt deadlock while still respecting
    // an explicit active-id (checked above) when the user set one.
    const sorted = [...all].sort((a, b) => b.updatedAt - a.updatedAt);
    const most = sorted[0];
    return {
      kind: 'one',
      profile: most,
      syntheticText: buildSyntheticSystemText(most),
    };
  }
  return { kind: 'none' };
}
