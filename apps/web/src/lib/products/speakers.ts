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
    archetypes: { primary: 'rhythmic_propulsive', secondary: 'flow_organic' },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'rhythm', level: 'emphasized' },
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'flow', level: 'emphasized' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'speed', level: 'present' },
        { trait: 'warmth', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'openness', level: 'present' },
        { trait: 'spatial_precision', level: 'less_emphasized' },
        { trait: 'clarity', level: 'less_emphasized' },
        { trait: 'composure', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
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
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'timing', tendency: 'insistent rhythmic drive — music pushes forward with momentum', basis: 'listener_consensus' },
        { domain: 'dynamics', tendency: 'explosive dynamic range from high efficiency — micro and macro contrasts feel visceral', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'warm, weighted midrange that favors natural timbres', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'driven by moderate-power tube amplification', effect: 'the efficiency lets tube amps deliver full dynamic range — bloom and drive coexist', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in small or untreated rooms', effect: 'bass energy can overwhelm — the passive radiator needs room to breathe', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'rhythmic engagement and dynamic life', cost: 'the pinpoint imaging and spatial precision of sealed-box or narrow-baffle designs', relative_to: 'precision-oriented monitors', basis: 'listener_consensus' },
      ],
    },
  },

  // ── Boenicke ──────────────────────────────────────────

  {
    id: 'boenicke-w5',
    brand: 'Boenicke',
    name: 'W5',
    price: 3500,
    category: 'speaker',
    architecture: 'compact sealed, wide-bandwidth single driver',
    archetypes: { primary: 'spatial_holographic', secondary: 'precision_explicit' },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'rhythm', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'speed', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'openness', level: 'present' },
        { trait: 'dynamics', level: 'less_emphasized' },
        { trait: 'warmth', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
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
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'spatial', tendency: 'holographic imaging that extends well beyond the cabinet boundaries', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'exceptionally detailed and tactile — fine grain of instruments is clearly rendered', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'refined tonal balance that avoids warmth or leanness — neutral with body', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'with high-quality, low-noise amplification', effect: 'the spatial and textural capabilities scale significantly with amplifier quality', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in larger rooms without subwoofer support', effect: 'bass foundation thins out — the small cabinet limits low-frequency extension', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'spatial precision, texture, and disappearing act', cost: 'dynamic scale and bass weight', relative_to: 'full-size floorstanders', basis: 'review_consensus' },
      ],
    },
  },

  // ── Harbeth ───────────────────────────────────────────

  {
    id: 'harbeth-p3esr',
    brand: 'Harbeth',
    name: 'P3ESR',
    price: 2495,
    category: 'speaker',
    architecture: 'BBC-tradition thin-wall sealed box',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'warmth', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'rhythm', level: 'less_emphasized' },
        { trait: 'dynamics', level: 'less_emphasized' },
        { trait: 'speed', level: 'less_emphasized' },
        { trait: 'clarity', level: 'less_emphasized' },
        { trait: 'openness', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
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
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'famously rich midrange — voices sound present and physically embodied', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'smooth, grain-free presentation that never fatigues', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'relaxed rhythmic presentation — phrasing breathes naturally', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'with clean, moderately powerful solid-state amplification', effect: 'the amplifier provides control and headroom while the speaker adds warmth and body', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'for dynamic or bass-heavy music', effect: 'limited bass extension and dynamic scale — not designed for physical impact', valence: 'caution', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'vocal naturalness, tonal beauty, and indefinite listening comfort', cost: 'dynamic scale, bass extension, and explicit transient definition', relative_to: 'efficiency-oriented or horn designs', basis: 'review_consensus' },
      ],
    },
  },

  {
    id: 'harbeth-shl5-plus',
    brand: 'Harbeth',
    name: 'Super HL5 Plus',
    price: 5795,
    category: 'speaker',
    architecture: 'BBC-tradition thin-wall ported box',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'warmth', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'openness', level: 'present' },
        { trait: 'rhythm', level: 'less_emphasized' },
        { trait: 'speed', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
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
    archetypes: { primary: 'rhythmic_propulsive', secondary: 'tonal_saturated' },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'rhythm', level: 'emphasized' },
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'flow', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'speed', level: 'present' },
        { trait: 'warmth', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'openness', level: 'present' },
      ],
      riskFlags: [],
    },
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
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'dynamics', tendency: 'effortless dynamic expression — music feels physically present in the room', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'deep tonal density with rich harmonic overtones', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'strong rhythmic conviction paired with natural musical flow', basis: 'listener_consensus' },
        { domain: 'texture', tendency: 'tactile and dimensional — instruments have weight and surface detail', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'driven by single-ended triode amplification', effect: 'the high efficiency lets SET amps deliver full dynamics — a combination voiced by the designer', valence: 'positive', basis: 'manufacturer_intent' },
        { condition: 'in rooms smaller than 15 square meters', effect: 'bass energy can overwhelm and blur — the wide baffle needs breathing room', valence: 'caution', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'engagement, tonal richness, and dynamic scale', cost: 'the spatial precision and disappearing act of smaller, narrow-baffle designs', relative_to: 'stand-mounted monitors', basis: 'review_consensus' },
      ],
    },
  },

  // ── Zu ────────────────────────────────────────────────

  {
    id: 'zu-dirty-weekend',
    brand: 'Zu',
    name: 'Dirty Weekend',
    price: 999,
    category: 'speaker',
    architecture: 'high-efficiency full-range driver + supertweeter',
    archetypes: { primary: 'rhythmic_propulsive' },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'rhythm', level: 'emphasized' },
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'speed', level: 'emphasized' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'openness', level: 'present' },
        { trait: 'spatial_precision', level: 'less_emphasized' },
        { trait: 'warmth', level: 'less_emphasized' },
        { trait: 'clarity', level: 'less_emphasized' },
        { trait: 'composure', level: 'less_emphasized' },
      ],
      riskFlags: ['fatigue_risk'],
    },
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
    archetypes: { primary: 'rhythmic_propulsive', secondary: 'precision_explicit' },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'speed', level: 'emphasized' },
        { trait: 'rhythm', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'openness', level: 'present' },
        { trait: 'spatial_precision', level: 'less_emphasized' },
        { trait: 'warmth', level: 'less_emphasized' },
        { trait: 'composure', level: 'less_emphasized' },
      ],
      riskFlags: ['fatigue_risk'],
    },
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
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'dynamics', tendency: 'explosive transient impact — horn loading delivers instantaneous dynamic response', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'blazing speed on leading edges — percussion and plucked instruments snap to attention', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'midrange horn coloration adds a distinctive tonal signature', basis: 'listener_consensus', context: 'most noticeable on sustained piano and brass' },
      ],
      interactions: [
        { condition: 'paired with warm, smooth amplification', effect: 'the speed and directness of the horns benefits from a softer upstream signal to tame brightness', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'placed away from room boundaries', effect: 'can sound bass-shy — wall reinforcement is part of the design intent', valence: 'caution', basis: 'manufacturer_intent' },
      ],
      tradeoffs: [
        { gains: 'dynamic impact and transient speed', cost: 'spatial finesse and tonal purity on sustained tones', relative_to: 'conventional cone-and-dome designs', basis: 'review_consensus' },
      ],
    },
  },

  // ── Focal ─────────────────────────────────────────────

  {
    id: 'focal-kanta-no2',
    brand: 'Focal',
    name: 'Kanta No. 2',
    price: 6990,
    category: 'speaker',
    architecture: 'three-way bass-reflex with beryllium tweeter',
    archetypes: { primary: 'precision_explicit', secondary: 'tonal_saturated' },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'rhythm', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'speed', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'openness', level: 'present' },
        { trait: 'warmth', level: 'less_emphasized' },
        { trait: 'flow', level: 'less_emphasized' },
      ],
      riskFlags: ['fatigue_risk'],
    },
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
    archetypes: { primary: 'precision_explicit' },
    tendencyProfile: {
      basis: 'editorial_inference',
      confidence: 'medium',
      tendencies: [
        { trait: 'rhythm', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'speed', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'openness', level: 'present' },
        { trait: 'tonal_density', level: 'less_emphasized' },
        { trait: 'warmth', level: 'less_emphasized' },
        { trait: 'texture', level: 'less_emphasized' },
        { trait: 'flow', level: 'less_emphasized' },
        { trait: 'composure', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
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
