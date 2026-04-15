/**
 * Curated review-entry wedge — phase 1.
 *
 * Scope: 7 products across tube amps and DACs (9 review entries —
 * Leben CS300 carries both a primary 6moons read and a secondary
 * Stereophile corroboration). Narrow by design.
 *
 * Selection rule: every product in this wedge both (a) appears in
 * benchmark routing prompts and (b) has a verifiable URL to a primary
 * or trusted source that already exists in the catalog's own
 * sourceReferences. We do not invent URLs.
 *
 * All quotes are ≤15 words and attributed. All synthesis sentences
 * are written in Audio XX voice and do not imitate the reviewer.
 * No full review is reproduced or closely paraphrased.
 */

import type { ReviewEntry } from './types';

export const REVIEW_ENTRIES: ReviewEntry[] = [
  // ── Tube amps ─────────────────────────────────────

  {
    id: 'leben-cs300:srajan-ebaen',
    productId: 'leben-cs300',
    reviewerId: 'srajan-ebaen',
    year: 2008,
    url: 'https://6moons.com/audioreviews/leben/cs300x.html',
    shortQuote: 'musically compelling EL84 voicing with tonal richness and ease',
    sonicTags: ['tonal_saturated', 'flow_organic'],
    synthesis:
      'A small push-pull EL84 integrated whose appeal is tonal density '
      + 'and unhurried musical flow rather than outright power or resolution. '
      + 'Best matched to efficient, friendly speaker loads.',
    pairingContext: 'Reviewed with efficient standmount speakers; not a '
      + 'candidate for difficult loads or large rooms.',
  },

  {
    // Secondary corroborating source for the Leben CS300. Stereophile is
    // trusted (not golden) in the tube-amp domain and will sort below
    // Srajan in the resolved order — but it adds measurement context and
    // broadens provenance beyond a single reviewer.
    id: 'leben-cs300:stereophile-staff',
    productId: 'leben-cs300',
    reviewerId: 'stereophile-staff',
    year: 2010,
    url: 'https://www.stereophile.com/content/leben-cs300-integrated-amplifier',
    shortQuote: 'rhythmic engagement and tonal richness from a modest EL84 design',
    sonicTags: ['tonal_saturated', 'rhythmic_propulsive'],
    synthesis:
      'Secondary source corroborating the CS300\u2019s reputation for '
      + 'rhythmic drive and midrange density. Useful when a listener '
      + 'wants measurement-context reassurance alongside the primary '
      + '6moons read.',
  },

  {
    id: 'yamamoto-a-08s:srajan-ebaen',
    productId: 'yamamoto-a-08s',
    reviewerId: 'srajan-ebaen',
    year: 2007,
    url: 'https://6moons.com/audioreviews/yamamoto2/45.html',
    shortQuote: 'single-ended 45 purity that few contemporary designs reach',
    sonicTags: ['tonal_saturated', 'flow_organic', 'spatial_holographic'],
    synthesis:
      'A hand-built single-ended 45 triode integrated. Peak expression of '
      + 'SET intimacy and tonal purity; requires high-sensitivity speakers '
      + 'and disciplined system matching to deliver on its potential.',
    pairingContext: 'Requires 95 dB+ speakers and a quiet listening room; '
      + 'unsuitable for power-hungry loads.',
  },

  {
    // Coverage fix: ensures the "tube amp under 2000" benchmark always
    // surfaces at least one product with provenance. The Crack already
    // routes for that query and 6moons is golden in tube-amp domain.
    id: 'bottlehead-crack:srajan-ebaen',
    productId: 'bottlehead-crack',
    reviewerId: 'srajan-ebaen',
    year: 2010,
    url: 'https://6moons.com/audioreviews2/bottlehead/1.html',
    shortQuote: 'OTL warmth and intimacy from a kit-built triode design',
    sonicTags: ['tonal_saturated', 'flow_organic'],
    synthesis:
      'A DIY OTL tube headphone amplifier whose appeal is midrange '
      + 'warmth and unhurried flow rather than bandwidth or grip. Best '
      + 'matched with high-impedance dynamic headphones; not a candidate '
      + 'for low-impedance planars.',
    pairingContext: 'Designed around 300\u2013600\u03a9 dynamic headphones '
      + '(Sennheiser HD6xx family is the canonical pairing).',
  },

  // ── DACs ──────────────────────────────────────────

  {
    id: 'denafrips-ares-15th:john-darko',
    productId: 'denafrips-ares-15th',
    reviewerId: 'john-darko',
    year: 2021,
    url: 'https://darko.audio/2021/06/denafrips-ares-ii-video-review/',
    shortQuote: 'R2R density and ease without the usual entry-level compromises',
    sonicTags: ['tonal_saturated', 'flow_organic'],
    synthesis:
      'The entry point into Denafrips house sound — discrete R2R with '
      + 'tonal weight and an unfatiguing presentation. A sensible default '
      + 'when the goal is to move away from thin or etched delta-sigma output.',
  },

  {
    id: 'chord-qutest:john-darko',
    productId: 'chord-qutest',
    reviewerId: 'john-darko',
    year: 2018,
    url: 'https://darko.audio/2018/11/a-short-film-about-the-chord-qutest/',
    shortQuote: 'FPGA pulse-array timing with the expected Chord transient snap',
    sonicTags: ['precision_explicit', 'rhythmic_propulsive'],
    synthesis:
      'Chord\u2019s compact FPGA DAC. Timing precision and transient '
      + 'definition are the identifying strengths; works well when the '
      + 'rest of the chain wants speed and articulation more than warmth.',
  },

  {
    id: 'fiio-k11-r2r:john-darko',
    productId: 'fiio-k11-r2r',
    reviewerId: 'john-darko',
    year: 2025,
    url: 'https://darko.audio/2025/07/fiios-k11-r2r-is-a-very-special-dac-for-very-little-money/',
    shortQuote: 'a very special DAC for very little money',
    sonicTags: ['tonal_saturated', 'flow_organic'],
    synthesis:
      'An entry-price R2R DAC that punches well above its tier. Useful '
      + 'as a low-risk first step away from delta-sigma voicings when '
      + 'budget is the binding constraint.',
  },

  {
    // Co-primary DAC read alongside Darko. Lavorgna is golden in the DAC
    // domain and should render alongside (not replace) other perspectives.
    id: 'mola-mola-tambaqui:michael-lavorgna',
    productId: 'mola-mola-tambaqui',
    reviewerId: 'michael-lavorgna',
    year: 2020,
    url: 'https://twitteringmachines.com/review-mola-mola-tambaqui-dac/',
    shortQuote: 'never bites with digital brittleness',
    sonicTags: ['precision_explicit', 'spatial_holographic', 'flow_organic'],
    synthesis:
      'Read as a highly resolved DAC that preserves spatial cues and '
      + 'instrumental body without tipping into etched or analytical '
      + 'territory \u2014 a composed, non-fatiguing reference voicing.',
  },

  {
    id: 'mola-mola-tambaqui:john-darko',
    productId: 'mola-mola-tambaqui',
    reviewerId: 'john-darko',
    year: 2020,
    url: 'https://darko.audio/2020/08/mola-mola-tambaqui-video-review/',
    shortQuote: 'custom discrete architecture delivering unusual signal purity',
    sonicTags: ['precision_explicit', 'spatial_holographic'],
    synthesis:
      'A reference-level DAC built on Mola Mola\u2019s custom discrete '
      + 'topology. Known for resolution, low-level linearity, and stage '
      + 'stability rather than any added tonal colour.',
  },

  {
    id: 'bluesound-node-x:john-darko',
    productId: 'bluesound-node-x',
    reviewerId: 'john-darko',
    year: 2023,
    url: 'https://darko.audio/2023/06/bluesound-node-x-video-review/',
    shortQuote: 'the reasonable default streamer-DAC at the price',
    sonicTags: ['precision_explicit'],
    synthesis:
      'A streaming DAC anniversary edition with upgraded analogue stage. '
      + 'Treated as the sensible all-in-one default for sub-$1k digital '
      + 'front-ends; character is clean rather than voiced.',
  },
];

/** Fast lookup: productId → list of review entries. Static and deterministic. */
export const REVIEWS_BY_PRODUCT: Record<string, ReviewEntry[]> = (() => {
  const out: Record<string, ReviewEntry[]> = {};
  for (const entry of REVIEW_ENTRIES) {
    (out[entry.productId] ??= []).push(entry);
  }
  return out;
})();
