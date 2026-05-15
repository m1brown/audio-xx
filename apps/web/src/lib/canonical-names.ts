/**
 * Canonical brand display-name normalization.
 *
 * BrandProfile.names entries are stored lowercased for case-insensitive
 * alias matching. The rendered output needs proper casing, including
 * non-trivial cases the simple "first-letter capitalize" pattern can't
 * handle:
 *   - "DeVore"   (internal capital)
 *   - "dCS"      (proprietary capitalization)
 *   - "darTZeel" (mid-word capital)
 *   - "CH Precision" / "BAT" / "AGD" (all-caps abbreviations)
 *   - "First Watt" / "Pass Labs" (each word capitalized)
 *
 * `toDisplayName(key)` looks up the canonical form. Safe fallback:
 * when no entry matches, return the input with only the first letter
 * uppercased (preserves the existing pre-Stage-12.1 behavior).
 *
 * Stage 12.1 — display-layer hygiene only.
 * Not used for:
 *   - matching / routing (those keep working on lowercased keys)
 *   - alias resolution
 *   - canonical-axis classification
 *   - cadence vocabulary or rules
 *
 * Adding entries: append to BRAND_DISPLAY_NAMES, keep alphabetical by
 * key for review legibility. No regex tweaks; literal lookups only.
 */

/**
 * Lowercased-key → canonical display string.
 *
 * Keys MUST be lowercase. Values are display strings (mixed case,
 * apostrophes, hyphens preserved as authored).
 *
 * Multiple keys may point to the same display string when a brand has
 * multiple aliases that should render identically. E.g. "audio note",
 * "audio note uk" both → "Audio Note".
 */
const BRAND_DISPLAY_NAMES: ReadonlyMap<string, string> = new Map([
  // ── A ──
  ['agd', 'AGD'],
  ['agd productions', 'AGD Productions'],
  ['ank', 'Audio Note Kits'],
  ['audio note', 'Audio Note'],
  ['audio note kits', 'Audio Note Kits'],
  ['audio note uk', 'Audio Note'],
  // ── B ──
  ['boenicke', 'Boenicke'],
  ['boenicke audio', 'Boenicke Audio'],
  ['border patrol', 'Border Patrol'],
  // ── C ──
  ['cen.grand', 'Cen.Grand'],
  ['cengrand', 'Cen.Grand'],
  ['ch precision', 'CH Precision'],
  ['chord', 'Chord'],
  ['chord electronics', 'Chord Electronics'],
  ['cube audio', 'Cube Audio'],
  // ── D ──
  ['dartzeel', 'darTZeel'],
  ['data conversion systems', 'dCS'],
  ['dcs', 'dCS'],
  ['dcs audio', 'dCS'],
  ['devore', 'DeVore'],
  ['devore fidelity', 'DeVore Fidelity'],
  // ── E ──
  ['emt', 'EMT'],
  // ── F ──
  ['fiio', 'FiiO'],
  ['first watt', 'First Watt'],
  // ── H ──
  ['hifiman', 'HiFiMan'],
  ['holo', 'Holo Audio'],
  ['holo audio', 'Holo Audio'],
  // ── K ──
  ['kef', 'KEF'],
  ['kinki', 'Kinki Studio'],
  ['kinki studio', 'Kinki Studio'],
  // ── M ──
  ['michell', 'Michell'],
  ['michell engineering', 'Michell Engineering'],
  ['mola mola', 'Mola Mola'],
  // ── P ──
  ['pass', 'Pass Labs'],
  ['pass labs', 'Pass Labs'],
  ['pro-ject', 'Pro-Ject'],
  ['project', 'Pro-Ject'],
  // ── Q ──
  ['qualio', 'Qualio'],
  ['qualio audio', 'Qualio Audio'],
  // ── R ──
  ['raal', 'Raal-Requisite'],
  ['raal requisite', 'Raal-Requisite'],
  ['raal-requisite', 'Raal-Requisite'],
  // ── S ──
  ['shindo', 'Shindo'],
  ['shindo laboratory', 'Shindo Laboratory'],
  ['smsl', 'SMSL'],
  ['sound kaos', 'sound|kaos'],
  ['sound|kaos', 'sound|kaos'],
  ['soundkaos', 'sound|kaos'],
  // ── T ──
  ['total dac', 'TotalDAC'],
  ['totaldac', 'TotalDAC'],
  // ── W ──
  ['wiim', 'WiiM'],
  ['wlm', 'WLM'],
]);

/**
 * Resolve a brand key (lowercased alias or display fragment) to its
 * canonical display form.
 *
 * Lookup is case-insensitive and whitespace-trimmed. When no canonical
 * entry exists, falls back to the first-letter-uppercase behavior the
 * comparison engine has used historically — so adding new BrandProfiles
 * never regresses display until a canonical entry is also authored.
 *
 * Empty / null / undefined input returns the empty string.
 */
export function toDisplayName(key: string | null | undefined): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (!trimmed) return '';
  const lookup = BRAND_DISPLAY_NAMES.get(trimmed.toLowerCase());
  if (lookup) return lookup;
  // Safe fallback: only uppercase position 0. Preserves hyphenated
  // capitals, internal punctuation, and proper-noun parentheticals.
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Diagnostic accessor — returns true when the input has a canonical
 * mapping. Useful for tests that want to assert "no silent fallback".
 * Not used by the renderer.
 */
export function hasCanonicalDisplayName(key: string | null | undefined): boolean {
  if (!key) return false;
  return BRAND_DISPLAY_NAMES.has(key.trim().toLowerCase());
}
