/**
 * Speaker product catalog — structured sonic traits.
 *
 * Traits are derived from common reviewer observations and known design
 * tendencies, not measurements. They describe sonic character in broad
 * qualitative terms on the same 0–1 scale used for DACs:
 *
 *   strong = 1.0, moderate = 0.7, slight = 0.4, neutral = 0.0
 *
 * Speaker-relevant traits:
 *   rhythm        — rhythmic drive and timing conviction
 *   dynamics      — macro/micro dynamic contrast
 *   tonal_density — harmonic weight and body
 *   spatial_precision — imaging specificity and staging coherence
 *   speed         — transient leading-edge definition
 *   warmth        — lower midrange / upper bass fullness
 *   texture       — tactile detail, grain of instruments
 *   composure     — ability to stay controlled under pressure
 *   flow          — musical continuity and phrasing coherence
 *   clarity       — transparency and lack of veiling
 *   fatigue_risk  — tendency toward listening fatigue (higher = riskier)
 *   openness      — spaciousness and freedom from constriction
 *
 * Prices are approximate USD street prices as of early 2025.
 */

import type { Product } from './dacs';

export const SPEAKER_PRODUCTS: Product[] = [
  // ── WLM ───────────────────────────────────────────────

  {
    id: 'wlm-diva-monitor',
    brand: 'WLM',
    name: 'Diva Monitor',
    price: 4500,
    category: 'speaker',
    architecture: 'high-efficiency single-driver + passive radiator',
    traits: {
      rhythm: 1.0,
      dynamics: 1.0,
      tonal_density: 0.7,
      spatial_precision: 0.4,
      speed: 0.7,
      warmth: 0.7,
      texture: 0.7,
      composure: 0.4,
      flow: 1.0,
      clarity: 0.4,
      fatigue_risk: 0.0,
      openness: 0.7,
    },
    description:
      'High-efficiency design built around rhythmic drive and dynamic life. Prioritizes musical engagement and tonal weight over last-degree resolution. The kind of speaker that makes you tap your foot before you start analyzing.',
    retailer_links: [
      { label: 'WLM', url: 'https://www.wlm-loudspeakers.com/' },
    ],
    notes: 'Benefits from moderate-power amplification with good current delivery. Spatial precision improves significantly with careful placement.',
  },

  // ── Boenicke ──────────────────────────────────────────

  {
    id: 'boenicke-w5',
    brand: 'Boenicke',
    name: 'W5',
    price: 3500,
    category: 'speaker',
    architecture: 'compact sealed, wide-bandwidth single driver',
    traits: {
      rhythm: 0.7,
      dynamics: 0.4,
      tonal_density: 0.7,
      spatial_precision: 1.0,
      speed: 0.7,
      warmth: 0.4,
      texture: 1.0,
      composure: 0.7,
      flow: 0.7,
      clarity: 0.7,
      fatigue_risk: 0.0,
      openness: 0.7,
    },
    description:
      'Swiss precision miniature with extraordinary spatial presentation from a small enclosure. Prioritizes texture, imaging, and tonal refinement over dynamic scale. A speaker that disappears and leaves the music suspended in space.',
    retailer_links: [
      { label: 'Boenicke Audio', url: 'https://www.boenicke-audio.ch/' },
    ],
    notes: 'Needs quality amplification to shine. Bass quantity limited by cabinet size — room gain or a subwoofer helps in larger rooms.',
  },

  // ── Harbeth ───────────────────────────────────────────

  {
    id: 'harbeth-p3esr',
    brand: 'Harbeth',
    name: 'P3ESR',
    price: 2495,
    category: 'speaker',
    architecture: 'BBC-tradition thin-wall sealed box',
    traits: {
      rhythm: 0.4,
      dynamics: 0.4,
      tonal_density: 1.0,
      spatial_precision: 0.7,
      speed: 0.4,
      warmth: 1.0,
      texture: 0.7,
      composure: 0.7,
      flow: 0.7,
      clarity: 0.4,
      fatigue_risk: 0.0,
      openness: 0.4,
    },
    description:
      'BBC-heritage design with famously rich, warm midrange and exceptional vocal naturalness. Trades outright resolution for tonal beauty and zero fatigue. The reference for "I could listen to this all day."',
    retailer_links: [
      { label: 'Music Direct', url: 'https://www.musicdirect.com/speakers/harbeth-p3esr/' },
    ],
    notes: 'Limited bass extension and dynamic scale. Best for smaller rooms, vocal and acoustic music. Not the choice for hard-driving rock or large-scale orchestral.',
  },

  {
    id: 'harbeth-shl5-plus',
    brand: 'Harbeth',
    name: 'Super HL5 Plus',
    price: 5795,
    category: 'speaker',
    architecture: 'BBC-tradition thin-wall ported box',
    traits: {
      rhythm: 0.4,
      dynamics: 0.7,
      tonal_density: 1.0,
      spatial_precision: 0.7,
      speed: 0.4,
      warmth: 0.7,
      texture: 0.7,
      composure: 0.7,
      flow: 0.7,
      clarity: 0.7,
      fatigue_risk: 0.0,
      openness: 0.7,
    },
    description:
      'Full-range Harbeth with the family warmth and midrange density, but more dynamic headroom and bass weight than the P3ESR. Resolving yet forgiving — a speaker for long sessions across all genres.',
    retailer_links: [
      { label: 'Music Direct', url: 'https://www.musicdirect.com/speakers/harbeth-super-hl5-plus/' },
    ],
  },

  // ── DeVore ────────────────────────────────────────────

  {
    id: 'devore-orangutan-o96',
    brand: 'DeVore',
    name: 'Orangutan O/96',
    price: 12000,
    category: 'speaker',
    architecture: 'high-efficiency wide-baffle two-way',
    traits: {
      rhythm: 1.0,
      dynamics: 1.0,
      tonal_density: 1.0,
      spatial_precision: 0.7,
      speed: 0.7,
      warmth: 0.7,
      texture: 1.0,
      composure: 0.7,
      flow: 1.0,
      clarity: 0.7,
      fatigue_risk: 0.0,
      openness: 0.7,
    },
    description:
      'High-efficiency design that combines deep tonal density with remarkable rhythmic drive. Makes music feel physically present in the room. A speaker built for engagement across all genres, voiced by ear rather than measurement.',
    retailer_links: [
      { label: 'DeVore Fidelity', url: 'https://www.dfridelity.com/o96' },
    ],
    notes: 'Exceptional with low-power tube amplification. Sensitivity allows SET amps to drive them with authority. Room-dependent bass — needs space to breathe.',
  },

  // ── Zu ────────────────────────────────────────────────

  {
    id: 'zu-dirty-weekend',
    brand: 'Zu',
    name: 'Dirty Weekend',
    price: 999,
    category: 'speaker',
    architecture: 'high-efficiency full-range driver + supertweeter',
    traits: {
      rhythm: 1.0,
      dynamics: 1.0,
      tonal_density: 0.7,
      spatial_precision: 0.4,
      speed: 1.0,
      warmth: 0.4,
      texture: 0.7,
      composure: 0.4,
      flow: 0.7,
      clarity: 0.4,
      fatigue_risk: 0.4,
      openness: 0.7,
    },
    description:
      'Zu\'s entry-level high-efficiency design — raw, fast, dynamically explosive. Prioritizes rhythmic energy and speed over refinement. The audio equivalent of a muscle car: thrilling, rough around the edges, deeply fun.',
    retailer_links: [
      { label: 'Zu Audio', url: 'https://www.zuaudio.com/dirty-weekend' },
    ],
    notes: 'Can be forward and lively in the upper midrange. Benefits from warmer, smoother amplification. Not the choice for critical classical listening.',
  },

  // ── Klipsch ───────────────────────────────────────────

  {
    id: 'klipsch-heresy-iv',
    brand: 'Klipsch',
    name: 'Heresy IV',
    price: 3198,
    category: 'speaker',
    architecture: 'three-way horn-loaded',
    traits: {
      rhythm: 0.7,
      dynamics: 1.0,
      tonal_density: 0.7,
      spatial_precision: 0.4,
      speed: 1.0,
      warmth: 0.4,
      texture: 0.7,
      composure: 0.4,
      flow: 0.7,
      clarity: 0.7,
      fatigue_risk: 0.4,
      openness: 0.7,
    },
    description:
      'Horn-loaded design with explosive dynamics and blazing transient speed. The Heresy trades spatial finesse for visceral impact — music hits you in the chest before you hear it in your head.',
    retailer_links: [
      { label: 'Klipsch', url: 'https://www.klipsch.com/products/heresy-iv-floorstanding-speaker' },
      { label: 'Crutchfield', url: 'https://www.crutchfield.com/p_714HRESYIV/' },
    ],
    notes: 'Horn coloration can be noticeable on sustained tones. Room placement matters — can be bass-shy away from walls.',
  },

  // ── Focal ─────────────────────────────────────────────

  {
    id: 'focal-kanta-no2',
    brand: 'Focal',
    name: 'Kanta No. 2',
    price: 6990,
    category: 'speaker',
    architecture: 'three-way bass-reflex with beryllium tweeter',
    traits: {
      rhythm: 0.7,
      dynamics: 0.7,
      tonal_density: 0.7,
      spatial_precision: 0.7,
      speed: 0.7,
      warmth: 0.4,
      texture: 0.7,
      composure: 0.7,
      flow: 0.4,
      clarity: 1.0,
      fatigue_risk: 0.4,
      openness: 0.7,
    },
    description:
      'French design combining Focal\'s beryllium tweeter precision with a warm, full cabinet voice. Highly resolving but not analytical — detail presented with tonal richness and spatial depth.',
    retailer_links: [
      { label: 'Focal', url: 'https://www.focal.com/en/home-audio/high-fidelity-speakers/kanta/kanta-n2' },
    ],
    notes: 'Beryllium tweeter can lean bright in untreated rooms or with forward-sounding electronics. Benefits from careful amplifier matching.',
  },

  {
    id: 'focal-aria-906',
    brand: 'Focal',
    name: 'Aria 906',
    price: 999,
    category: 'speaker',
    architecture: 'two-way bass-reflex with flax driver',
    traits: {
      rhythm: 0.7,
      dynamics: 0.7,
      tonal_density: 0.4,
      spatial_precision: 0.7,
      speed: 0.7,
      warmth: 0.4,
      texture: 0.4,
      composure: 0.4,
      flow: 0.4,
      clarity: 0.7,
      fatigue_risk: 0.0,
      openness: 0.7,
    },
    description:
      'Focal\'s flax-cone bookshelf — lively, open, and well-balanced for the price. Resolving without being aggressive. A solid all-rounder that hints at Focal\'s higher-end voicing.',
    retailer_links: [
      { label: 'Focal', url: 'https://www.focal.com/en/home-audio/high-fidelity-speakers/aria-evo-x/aria-906' },
      { label: 'Crutchfield', url: 'https://www.crutchfield.com/p_091AR906/' },
    ],
  },
];
