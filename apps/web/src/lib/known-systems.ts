/**
 * Known Systems Registry — Notable reference systems from the audio community.
 *
 * A curated list of systems belonging to well-known listeners, reviewers,
 * and community figures. When a user's typed-in system matches a known
 * system, Audio XX can surface the attribution and philosophical context.
 *
 * ── Design principles ─────────────────────────────────────────
 *
 *   - Keep the registry small and curated. Not a database of every
 *     reviewer's setup — only systems where the combination tells a
 *     coherent story about listening priorities.
 *
 *   - Store only core signal-chain components — the pieces that define
 *     the system's sonic identity. Tube variants, cartridge rotations,
 *     and accessories are omitted or noted separately.
 *
 *   - Matching is fuzzy and component-weighted. A 70%+ overlap of core
 *     components triggers attribution. The match is by brand+name, not
 *     exact serial numbers.
 *
 *   - Users can always rename or dismiss the attribution. It's a
 *     suggestion, not a label they're stuck with.
 *
 *   - Philosophical notes feed into advisory reasoning — they help the
 *     engine understand the design intent behind the combination.
 */

import type { ProductCategory } from './catalog-taxonomy';
import type { SystemComponentRole } from './system-types';

// Component shape for known system entries
type KnownComponent = {
  brand: string;
  name: string;
  category: ProductCategory;
  role: SystemComponentRole;
  /** If true, this component is essential for a match (vs. optional analog chain). */
  core: boolean;
};

// ── Known system record ──────────────────────────────

export interface KnownSystem {
  /** Unique identifier for this known system. */
  id: string;
  /** Display name — "Michael Lavorgna's reference system". */
  label: string;
  /** Short attribution — the person's name and context. */
  attribution: string;
  /** One sentence about who this person is. */
  bio: string;
  /** Brief philosophical note about what this system optimizes for.
   *  Feeds into advisory reasoning — not displayed verbatim. */
  philosophy: string;
  /** Core and optional components. */
  components: KnownComponent[];
  /** Optional notes about the system (tube choices, cartridge rotation, etc.). */
  notes?: string;
  /** Source URL for the system description, if public. */
  sourceUrl?: string;
}

// ── Registry ─────────────────────────────────────────

export const KNOWN_SYSTEMS: KnownSystem[] = [
  {
    id: 'lavorgna-reference',
    label: "Michael Lavorgna's reference system",
    attribution: 'Michael Lavorgna',
    bio: 'Writer and editor at Twittering Machines. Long-running voice in the audio community, focused on musical engagement over measurement.',
    philosophy: 'Built around tonal richness, musical flow, and long-session engagement. High-efficiency speakers driven by a Japanese tube integrated, fed by a discrete R2R DAC — every component prioritizes musical involvement over analytical precision.',
    components: [
      { brand: 'Leben', name: 'CS600X', category: 'amplifier', role: null, core: true },
      { brand: 'totaldac', name: 'd1-unity', category: 'dac', role: null, core: true },
      { brand: 'DeVore Fidelity', name: 'O/96', category: 'speaker', role: null, core: true },
      { brand: 'Michell', name: 'Gyro SE', category: 'turntable', role: null, core: false },
      { brand: 'Aurorasound', name: 'VIDA MK.II', category: 'phono', role: 'phono_stage', core: false },
      { brand: 'Sorane', name: 'SA1.2', category: 'cartridge', role: null, core: false },
    ],
    notes: 'Runs Gold Lion KT77s in the Leben. Analog chain includes multiple cartridges (EMT HSD 006, Zu/DL-103 Mk.II, Ortofon SPU Mono CG 65 Di MkII). The totaldac uses the live clocking option.',
    sourceUrl: 'https://twitteringmachines.com/',
  },
  {
    id: 'boris-reference',
    label: "Boris's reference system",
    attribution: 'Boris',
    bio: 'Audio XX founder. Listener-first approach to system building.',
    philosophy: 'Built around simplicity, directness, and vintage character. A classic receiver driving single-driver horns — the system prioritizes tonal immediacy and presence over extension or refinement. Every link in the chain is deliberately simple.',
    components: [
      { brand: 'Oppo', name: 'OPDV971H', category: 'dac', role: null, core: true },
      { brand: 'Marantz', name: '2220B', category: 'amplifier', role: null, core: true },
      { brand: 'Hornshoppe', name: 'Horns', category: 'speaker', role: null, core: true },
    ],
  },

  // ── Srajan Ebaen (6moons) ────────────────────────────

  {
    id: 'srajan-main',
    label: "Srajan Ebaen's main reference system",
    attribution: 'Srajan Ebaen',
    bio: 'Publisher and chief reviewer at 6moons. One of the longest-running voices in online audio journalism.',
    philosophy: 'Built around openness, transient speed, and spatial projection. The Qualio IQ widebanders with Kinki Studio amplification and a Laiv Harmony R2R DAC prioritize microdetail and elasticity — this system reveals rather than flatters.',
    components: [
      { brand: 'Laiv', name: 'Harmony', category: 'dac', role: null, core: true },
      { brand: 'Kinki Studio', name: 'Dazzle', category: 'amplifier', role: null, core: true },
      { brand: 'Qualio', name: 'IQ', category: 'speaker', role: null, core: true },
      { brand: 'Singxer', name: 'SU-6', category: 'dac', role: null, core: false },
      { brand: 'Lifesaver Audio', name: 'Gradient Box 2', category: 'other', role: null, core: false },
    ],
    notes: 'Room is 6×8m with PSI Audio AVAA C214 active bass traps. Source is iMac running Audirvana with Qobuz.',
    sourceUrl: 'https://6moons.com/',
  },
  {
    id: 'srajan-secondary',
    label: "Srajan Ebaen's secondary system",
    attribution: 'Srajan Ebaen',
    bio: 'Publisher and chief reviewer at 6moons.',
    philosophy: 'A complementary rig to the main system — trades the widebander directness for fuller-range coverage with a MusikBoxx + Zu subwoofer foundation. Still speed-oriented through Kinki Studio amplification and a Cen.Grand R2R DAC, but with more bass authority.',
    components: [
      { brand: 'Cen.Grand', name: 'DSDAC 1.0 Deluxe', category: 'dac', role: null, core: true },
      { brand: 'Kinki Studio', name: 'EX-B7', category: 'amplifier', role: null, core: true },
      { brand: 'ModalAkustik', name: 'MusikBoxx', category: 'speaker', role: null, core: true },
      { brand: 'Hattor', name: 'ARP-S', category: 'amplifier', role: 'preamp', core: false },
      { brand: 'Zu', name: 'Method', category: 'speaker', role: null, core: false },
      { brand: 'Soundaware', name: 'D300Ref', category: 'streamer', role: null, core: false },
    ],
    sourceUrl: 'https://6moons.com/',
  },
  {
    id: 'srajan-video',
    label: "Srajan Ebaen's video system",
    attribution: 'Srajan Ebaen',
    bio: 'Publisher and chief reviewer at 6moons.',
    philosophy: 'A 2-channel video system built for engagement rather than analytical listening. The Gold Note integrated and Zu Soul VI prioritize dynamics and tonal weight — a system designed to be musically satisfying without demanding attention.',
    components: [
      { brand: 'Gold Note', name: 'IS-1000 Deluxe', category: 'integrated', role: null, core: true },
      { brand: 'Zu Audio', name: 'Soul VI', category: 'speaker', role: null, core: true },
      { brand: 'Oppo', name: 'BDP-105', category: 'dac', role: null, core: true },
      { brand: 'Dynaudio', name: '18S', category: 'speaker', role: null, core: false },
    ],
    sourceUrl: 'https://6moons.com/',
  },
];

// ── Matching ─────────────────────────────────────────

/**
 * Normalize a brand+name pair for comparison.
 * Lowercases and strips common suffixes/prefixes that vary in user input.
 */
function normalizeComponent(brand: string, name: string): string {
  return `${brand}:${name}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two component identifiers match, allowing for common variations.
 *
 * Handles:
 *   - Exact match after normalization
 *   - Brand match + partial name match (e.g., "leben cs600" matches "leben cs600x")
 *   - Common brand aliases (e.g., "devore" matches "devore fidelity")
 */
function componentsMatch(
  inputBrand: string,
  inputName: string,
  knownBrand: string,
  knownName: string,
): boolean {
  const ib = inputBrand.toLowerCase().trim();
  const in_ = inputName.toLowerCase().trim();
  const kb = knownBrand.toLowerCase().trim();
  const kn = knownName.toLowerCase().trim();

  // Exact match
  if (ib === kb && in_ === kn) return true;

  // Brand aliases
  const brandAliases: Record<string, string[]> = {
    'devore fidelity': ['devore'],
    'devore': ['devore fidelity'],
    'hornshoppe': ['horn shoppe'],
  };
  const brandMatches =
    ib === kb ||
    (brandAliases[kb] ?? []).includes(ib) ||
    ib.includes(kb) ||
    kb.includes(ib);

  if (!brandMatches) return false;

  // Name match — allow partial (user might type "cs600" for "cs600x",
  // or "2220b" for "2220B", or "o/96" for "O/96")
  if (in_ === kn) return true;
  if (kn.includes(in_) || in_.includes(kn)) return true;

  // Word-level match for multi-word names
  const inputWords = in_.split(/[\s/]+/).filter((w) => w.length >= 2);
  const knownWords = kn.split(/[\s/]+/).filter((w) => w.length >= 2);
  const matchingWords = inputWords.filter((iw) =>
    knownWords.some((kw) => kw.includes(iw) || iw.includes(kw)),
  );

  return matchingWords.length > 0 && matchingWords.length >= inputWords.length * 0.5;
}

/**
 * Result of a known system match.
 */
export interface KnownSystemMatch {
  /** The matched known system. */
  system: KnownSystem;
  /** Fraction of core components matched (0–1). */
  coreOverlap: number;
  /** Fraction of all components matched (0–1). */
  totalOverlap: number;
  /** Specific components that matched. */
  matchedComponents: string[];
}

/**
 * Check if a set of user components matches any known system.
 *
 * Returns the best match if core overlap >= 0.67 (2 of 3 core components),
 * or null if no known system matches well enough.
 *
 * @param userComponents — Array of { brand, name } from user input
 * @returns Best matching known system, or null
 */
export function findKnownSystemMatch(
  userComponents: Array<{ brand: string; name: string }>,
): KnownSystemMatch | null {
  if (userComponents.length < 2) return null;

  let bestMatch: KnownSystemMatch | null = null;

  for (const known of KNOWN_SYSTEMS) {
    const coreComponents = known.components.filter((c) => c.core);
    const allComponents = known.components;

    // Count matches
    const matchedCore: string[] = [];
    const matchedAll: string[] = [];

    for (const kc of allComponents) {
      const matched = userComponents.some((uc) =>
        componentsMatch(uc.brand, uc.name, kc.brand, kc.name),
      );
      if (matched) {
        const label = `${kc.brand} ${kc.name}`;
        matchedAll.push(label);
        if (kc.core) matchedCore.push(label);
      }
    }

    const coreOverlap = coreComponents.length > 0
      ? matchedCore.length / coreComponents.length
      : 0;
    const totalOverlap = allComponents.length > 0
      ? matchedAll.length / allComponents.length
      : 0;

    // Require at least 67% core overlap (e.g., 2 of 3 core components)
    if (coreOverlap >= 0.66) {
      if (!bestMatch || coreOverlap > bestMatch.coreOverlap ||
          (coreOverlap === bestMatch.coreOverlap && totalOverlap > bestMatch.totalOverlap)) {
        bestMatch = {
          system: known,
          coreOverlap,
          totalOverlap,
          matchedComponents: matchedAll,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Build a suggested system name from a known system match.
 *
 * Returns the known system's label (e.g., "Michael Lavorgna's reference system")
 * when the match is strong. Returns null for weak matches.
 */
export function suggestKnownSystemName(
  match: KnownSystemMatch,
): string | null {
  // Full core match → use the full label
  if (match.coreOverlap >= 1.0) {
    return match.system.label;
  }
  // Partial core match → softer attribution
  if (match.coreOverlap >= 0.66) {
    return `Similar to ${match.system.attribution}'s system`;
  }
  return null;
}
