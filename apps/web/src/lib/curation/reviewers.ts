/**
 * Reviewer registry — phase 1.
 *
 * Source hierarchy (per product policy):
 *   Primary curated:
 *     - 6moons (Srajan Ebaen)         — golden in tube-amp and DAC domains
 *     - Darko.Audio (John Darko)      — trusted across digital front-ends
 *     - Twittering Machines (M. Lavorgna) — trusted across DAC/streamer
 *   Secondary:
 *     - Stereophile, The Absolute Sound, HiFi Pig
 *   Supplementary:
 *     - Selected YouTube reviewers (e.g. A British Audiophile)
 *
 * Srajan is domain-scoped golden: authoritative on SET/tube designs and
 * boutique R2R DACs, but only `trusted` on mainstream solid-state.
 * This reflects where his ear has been consistently load-bearing.
 */

import type { Reviewer } from './types';

export const REVIEWERS: Reviewer[] = [
  // ── Primary curated ────────────────────────────────
  {
    id: 'srajan-ebaen',
    displayName: 'Srajan Ebaen',
    publication: '6moons',
    tier: 'trusted',
    domainTiers: {
      'tube-amp': 'golden',
      'dac': 'golden',
      'speaker': 'trusted',
      'solid-state-amp': 'trusted',
    },
    areasOfAuthority: ['tube-amp', 'dac', 'speaker'],
    homepageUrl: 'https://6moons.com/',
    notes: 'Domain-scoped golden source. Decades of SET, tube, and R2R '
      + 'reviewing with a coherent listening framework. Authoritative on '
      + 'boutique and non-mainstream designs; weighted as trusted (not '
      + 'golden) on mass-market solid-state.',
  },
  {
    id: 'john-darko',
    displayName: 'John Darko',
    publication: 'Darko.Audio',
    tier: 'trusted',
    areasOfAuthority: ['dac', 'streamer', 'solid-state-amp', 'speaker'],
    homepageUrl: 'https://darko.audio/',
    notes: 'Primary curated source. Strong context around digital front-ends, '
      + 'streamers, and real-world system integration. Practical-buyer voice.',
  },
  {
    id: 'michael-lavorgna',
    displayName: 'Michael Lavorgna',
    publication: 'Twittering Machines',
    tier: 'trusted',
    domainTiers: {
      // Co-primary with Srajan Ebaen in the DAC domain. Lavorgna\u2019s
      // long-form, system-aware DAC listening notes carry equal authority
      // to 6moons for this category and should never be collapsed into a
      // single "house view" \u2014 divergent interpretations stay visible.
      'dac': 'golden',
    },
    areasOfAuthority: ['dac', 'streamer', 'tube-amp'],
    homepageUrl: 'https://twitteringmachines.com/',
    notes: 'Primary curated source. Long-form, system-aware listening notes. '
      + 'Co-primary (golden) with 6moons in the DAC domain; trusted in '
      + 'streamer and tube-amp domains.',
  },

  // ── Secondary ──────────────────────────────────────
  {
    id: 'stereophile-staff',
    displayName: 'Stereophile (staff)',
    publication: 'Stereophile',
    tier: 'trusted',
    areasOfAuthority: ['general'],
    homepageUrl: 'https://www.stereophile.com/',
    notes: 'Secondary trusted source. Measurements + listening impressions. '
      + 'Used for corroboration and measurement context.',
  },
  {
    id: 'tas-staff',
    displayName: 'The Absolute Sound (staff)',
    publication: 'The Absolute Sound',
    tier: 'trusted',
    areasOfAuthority: ['general'],
    homepageUrl: 'https://www.theabsolutesound.com/',
    notes: 'Secondary trusted source. Reference-system listening impressions.',
  },
  {
    id: 'hifi-pig',
    displayName: 'HiFi Pig',
    publication: 'HiFi Pig',
    tier: 'trusted',
    areasOfAuthority: ['general'],
    homepageUrl: 'https://hifipig.com/',
    notes: 'Secondary trusted source.',
  },

  // ── Supplementary: YouTube ────────────────────────
  {
    id: 'iiwi-reviews',
    displayName: 'iiWi Reviews',
    publication: 'iiWi Reviews',
    tier: 'community',
    areasOfAuthority: ['dac', 'solid-state-amp', 'streamer'],
    homepageUrl: 'https://www.youtube.com/@iiWiReviews',
    notes: 'Supplementary YouTube source. Measurement-informed DAC and '
      + 'solid-state comparisons with clear listening methodology.',
  },
  {
    id: 'cheapaudioman',
    displayName: 'Cheap Audio Man',
    publication: 'Cheap Audio Man',
    tier: 'community',
    areasOfAuthority: ['dac', 'solid-state-amp', 'speaker', 'general'],
    homepageUrl: 'https://www.youtube.com/@CheapAudioMan',
    notes: 'Supplementary YouTube source. Budget-to-midrange gear with '
      + 'practical system-integration perspective. Useful for entry-level '
      + 'and value-oriented recommendations.',
  },
  {
    id: 'british-audiophile',
    displayName: 'A British Audiophile',
    publication: 'A British Audiophile',
    tier: 'community',
    domainTiers: {
      'dac': 'trusted',
      'streamer': 'trusted',
    },
    areasOfAuthority: ['dac', 'streamer', 'solid-state-amp'],
    homepageUrl: 'https://www.youtube.com/@ABritishAudiophile',
    notes: 'Supplementary YouTube source. Detailed DAC and streamer '
      + 'comparisons with consistent listening methodology. Elevated to '
      + 'trusted in DAC and streamer domains based on depth and consistency.',
  },
];

/** Fast lookup by id. */
export const REVIEWER_BY_ID: Record<string, Reviewer> = Object.fromEntries(
  REVIEWERS.map((r) => [r.id, r]),
);

/** Resolve the effective tier for a reviewer within a specific product domain.
 *  Falls back to the default tier when no domain override is set. */
export function effectiveTier(
  reviewerId: string,
  domain: import('./types').ReviewerDomain,
): import('./types').ReviewerTier | undefined {
  const r = REVIEWER_BY_ID[reviewerId];
  if (!r) return undefined;
  return r.domainTiers?.[domain] ?? r.tier;
}
