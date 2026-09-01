/**
 * Curated review-entry wedge — phase 1.
 *
 * Scope: a narrow wedge of products across tube amps and DACs.
 * Narrow by design.
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
    // Stereophile is trusted in the tube-amp domain; it adds
    // measurement context alongside the listening read.
    id: 'leben-cs300:stereophile-staff',
    productId: 'leben-cs300',
    reviewerId: 'stereophile-staff',
    year: 2010,
    url: 'https://www.stereophile.com/content/leben-cs300-integrated-amplifier',
    shortQuote: 'rhythmic engagement and tonal richness from a modest EL84 design',
    sonicTags: ['tonal_saturated', 'rhythmic_propulsive'],
    synthesis:
      'Source corroborating the CS300\u2019s reputation for '
      + 'rhythmic drive and midrange density. Useful when a listener '
      + 'wants measurement-context reassurance alongside the listening read.',
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
    medium: 'video',
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
    medium: 'video',
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
    medium: 'video',
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
    medium: 'video',
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
    medium: 'video',
  },

  // ── DACs: additional coverage for upgrade paths ───

  {
    id: 'schiit-bifrost-2-64:british-audiophile',
    productId: 'schiit-bifrost-2-64',
    reviewerId: 'british-audiophile',
    year: 2023,
    url: 'https://www.youtube.com/watch?v=bBZVgSvmJeo',
    shortQuote: 'multibit warmth with genuine tonal weight',
    sonicTags: ['tonal_saturated', 'flow_organic'],
    synthesis:
      'Schiit\u2019s multibit DAC positioned as a serious mid-price R2R '
      + 'alternative. Valued for tonal density and ease over analytical precision.',
    medium: 'video',
  },

  {
    id: 'denafrips-pontus-ii:srajan-ebaen',
    productId: 'denafrips-pontus-ii-12th-1',
    reviewerId: 'srajan-ebaen',
    year: 2020,
    url: 'https://6moons.com/audioreviews2/denafrips8/1.html',
    shortQuote: 'R2R maturity that belies the price point',
    sonicTags: ['tonal_saturated', 'flow_organic', 'spatial_holographic'],
    synthesis:
      'The mid-tier Denafrips R2R DAC. Brings the house signature of '
      + 'tonal weight and spatial ease at a price tier where most '
      + 'competitors still use delta-sigma topology.',
  },

  {
    id: 'eversolo-dmp-a6:british-audiophile',
    productId: 'eversolo-dmp-a6',
    reviewerId: 'british-audiophile',
    year: 2023,
    url: 'https://www.youtube.com/watch?v=xSvV8760Xkg',
    shortQuote: 'a streaming DAC that punches well above its price',
    sonicTags: ['precision_explicit'],
    synthesis:
      'An all-in-one streamer-DAC with a touch screen and full '
      + 'streaming stack. Positioned as a practical digital hub for '
      + 'listeners entering the streaming front-end space.',
    medium: 'video',
  },

  {
    id: 'eversolo-dmp-a6:cheapaudioman',
    productId: 'eversolo-dmp-a6',
    reviewerId: 'cheapaudioman',
    year: 2023,
    url: 'https://www.youtube.com/watch?v=pEyGH_hlxYQ',
    shortQuote: 'genuinely impressive at this price tier',
    sonicTags: ['precision_explicit'],
    synthesis:
      'Budget-conscious take on the DMP-A6 as an all-in-one digital '
      + 'front-end. Highlights practical value and streaming convenience.',
    medium: 'video',
  },

  {
    id: 'denafrips-ares-15th:cheapaudioman',
    productId: 'denafrips-ares-15th',
    reviewerId: 'cheapaudioman',
    year: 2022,
    url: 'https://www.youtube.com/watch?v=E7jHPIbhmFo',
    shortQuote: 'the R2R entry point that actually delivers',
    sonicTags: ['tonal_saturated', 'flow_organic'],
    synthesis:
      'Budget-focused perspective confirming the Ares as a credible '
      + 'entry R2R DAC. Emphasizes value relative to delta-sigma '
      + 'alternatives at the same price.',
    medium: 'video',
  },

  {
    id: 'chord-qutest:british-audiophile',
    productId: 'chord-qutest',
    reviewerId: 'british-audiophile',
    year: 2022,
    url: 'https://www.youtube.com/watch?v=K8QFHePb5Lg',
    shortQuote: 'FPGA timing precision in a compact package',
    sonicTags: ['precision_explicit', 'rhythmic_propulsive'],
    synthesis:
      'Video assessment of the Qutest emphasizing its transient speed '
      + 'and timing precision. Useful counterpoint to the warmer R2R '
      + 'alternatives in the same price range.',
    medium: 'video',
  },

  {
    id: 'rme-adi-2-dac:iiwi-reviews',
    productId: 'rme-adi-2-dac-fs',
    reviewerId: 'iiwi-reviews',
    year: 2023,
    url: 'https://www.youtube.com/watch?v=SbL_tCkFmME',
    shortQuote: 'measurement king with serious parametric EQ tools',
    sonicTags: ['precision_explicit'],
    synthesis:
      'Measurement-informed take on the RME ADI-2 highlighting its '
      + 'parametric EQ, low noise floor, and reference-grade accuracy. '
      + 'A clinical tool more than a voiced DAC.',
    medium: 'video',
  },

  {
    id: 'holo-spring-3:srajan-ebaen',
    productId: 'holo-spring-3',
    reviewerId: 'srajan-ebaen',
    year: 2022,
    url: 'https://6moons.com/audioreviews2/holoaudio4/1.html',
    shortQuote: 'NOS R2R with uncommon tonal maturity',
    sonicTags: ['tonal_saturated', 'flow_organic', 'spatial_holographic'],
    synthesis:
      'A discrete R2R NOS-capable DAC with strong tonal saturation '
      + 'and spatial depth. Positioned in the upper-mid tier where '
      + 'design philosophy diverges sharply from delta-sigma approaches.',
  },

  {
    id: 'innuos-pulse-mini:john-darko',
    productId: 'innuos-pulse-mini',
    reviewerId: 'john-darko',
    year: 2023,
    url: 'https://darko.audio/2023/03/innuos-pulse-mini-review/',
    shortQuote: 'a serious network transport at an entry price',
    sonicTags: ['precision_explicit'],
    synthesis:
      'Innuos\u2019s entry streamer-transport. Emphasises clean signal '
      + 'delivery to an external DAC rather than built-in conversion. '
      + 'A practical upgrade path for listeners outgrowing all-in-one units.',
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
