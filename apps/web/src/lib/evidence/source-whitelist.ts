/**
 * Source Publication Whitelist — Two-Tier System.
 *
 * Controls which review publications are surfaced to users in advisory
 * responses. Sources not on either tier are still used internally for
 * trait synthesis and evidence scoring — they are just not displayed.
 *
 * Tier 1 (Preferred):
 *   Editorially aligned with Audio XX — system-aware, listener-first,
 *   engagement-oriented reviewing. These are displayed first and are the
 *   publications we actively seek out when adding new products.
 *
 * Tier 2 (Acceptable):
 *   Credible publications that don't fully match the Audio XX editorial
 *   voice but are useful for coverage. Displayed ONLY when no Tier 1
 *   source exists for a product. Over time, as Tier 1 sources are added
 *   to more products, Tier 2 citations naturally fade out.
 *
 * Not displayed:
 *   Audio Science Review, forum posts, manufacturer claims, and any
 *   publication not on either tier. These may still be used internally.
 */

export type SourceTier = 'preferred' | 'acceptable';

export interface WhitelistedSource {
  /** Publication name — must match sourceReferences entries exactly. */
  name: string;
  /** Tier 1 (preferred) or Tier 2 (acceptable). */
  tier: SourceTier;
  /** Short description of editorial perspective. */
  perspective: string;
  /** URL for the publication homepage. */
  url: string;
}

/**
 * All approved publications, ordered by tier then editorial alignment.
 */
export const SOURCE_WHITELIST: WhitelistedSource[] = [
  // ── Tier 1 — Preferred ──────────────────────────────
  {
    name: '6moons',
    tier: 'preferred',
    perspective: 'System-aware, experience-led reviewing. Strong on spatial, timing, and tonal character. Extensive comparison methodology.',
    url: 'https://6moons.com/',
  },
  {
    name: 'Mono and Stereo',
    tier: 'preferred',
    perspective: 'High-end focused with emphasis on musical engagement and system context. European perspective.',
    url: 'https://www.monoandstereo.com/',
  },
  {
    name: 'Twittering Machines',
    tier: 'preferred',
    perspective: 'Engagement-first, system-aware. Strong on tonal density, musical flow, and long-session listening.',
    url: 'https://twitteringmachines.com/',
  },
  {
    name: 'Darko.Audio',
    tier: 'preferred',
    perspective: 'Accessible, modern perspective. Good at contextualising gear for real listeners. Covers streaming and desktop well.',
    url: 'https://darko.audio/',
  },

  // ── Tier 2 — Acceptable ─────────────────────────────
  {
    name: 'Stereophile',
    tier: 'acceptable',
    perspective: 'Established US publication. Strong measurement methodology. Reviewing language tends toward spec-first framing.',
    url: 'https://www.stereophile.com/',
  },
  {
    name: 'The Absolute Sound',
    tier: 'acceptable',
    perspective: 'US high-end publication. Subjective reviewing tradition. Can be hyperbolic but covers important products.',
    url: 'https://www.theabsolutesound.com/',
  },
  {
    name: 'HiFi+',
    tier: 'acceptable',
    perspective: 'UK publication. Good balance of technical and musical assessment. Covers European brands well.',
    url: 'https://hifiplus.com/',
  },
  {
    name: 'Hifi News',
    tier: 'acceptable',
    perspective: 'UK publication. Measurement-heavy but with experienced listening panel.',
    url: 'https://www.hifinews.com/',
  },
  {
    name: 'SoundStage!',
    tier: 'acceptable',
    perspective: 'North American publication network. Consistent methodology across reviewers.',
    url: 'https://www.soundstagenetwork.com/',
  },
  {
    name: 'Tone Publications',
    tier: 'acceptable',
    perspective: 'US publication. Strong on amplifier and speaker reviews. System-context aware.',
    url: 'https://www.tonepublications.com/',
  },
  {
    name: 'The Audiophiliac',
    tier: 'acceptable',
    perspective: 'Steve Guttenberg — accessible, experience-first reviews. Good for entry and mid-level gear.',
    url: 'https://www.youtube.com/@Audiophiliac',
  },
  {
    name: 'Headphone.guru',
    tier: 'acceptable',
    perspective: 'Headphone and portable audio specialist. Useful for headphone amplifier and DAC coverage.',
    url: 'https://headphone.guru/',
  },
  {
    name: 'Head-Fi',
    tier: 'acceptable',
    perspective: 'Community forum. Consensus views useful for headphone products. Individual opinions unreliable.',
    url: 'https://www.head-fi.org/',
  },
];

// ── Lookup structures ──────────────────────────────────

const SOURCE_MAP = new Map<string, WhitelistedSource>(
  SOURCE_WHITELIST.map((s) => [s.name.toLowerCase(), s]),
);

const PREFERRED_SET = new Set(
  SOURCE_WHITELIST.filter((s) => s.tier === 'preferred').map((s) => s.name.toLowerCase()),
);

/**
 * Returns true if a source name matches any whitelisted publication (either tier).
 */
export function isWhitelistedSource(sourceName: string): boolean {
  return SOURCE_MAP.has(sourceName.toLowerCase());
}

/**
 * Returns true if a source name matches a Tier 1 (preferred) publication.
 */
export function isPreferredSource(sourceName: string): boolean {
  return PREFERRED_SET.has(sourceName.toLowerCase());
}

/**
 * Look up the whitelist entry for a source name.
 * Returns undefined if not whitelisted.
 */
export function getSourceEntry(sourceName: string): WhitelistedSource | undefined {
  return SOURCE_MAP.get(sourceName.toLowerCase());
}

/**
 * Filter source references for user-facing display.
 *
 * Logic:
 *   - If ANY Tier 1 source exists → show only Tier 1 sources
 *   - If NO Tier 1 source exists → show Tier 2 sources as fallback
 *   - Non-whitelisted sources are always excluded
 */
export function filterSourcesForDisplay<T extends { source: string }>(
  refs: T[],
): T[] {
  const tier1 = refs.filter((r) => isPreferredSource(r.source));
  if (tier1.length > 0) return tier1;

  // Fallback to Tier 2
  return refs.filter((r) => isWhitelistedSource(r.source));
}
