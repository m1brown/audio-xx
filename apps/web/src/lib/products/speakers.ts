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
    architecture: 'high-efficiency coaxial wideband driver',
    subcategory: 'standmount',
    priceTier: 'upper-mid',
    brandScale: 'boutique',
    region: 'europe',
    country: 'AT',
    topology: 'bass-reflex',
    archetypes: { primary: 'rhythmic_propulsive', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'warm',             // Tonal density present, zero fatigue — warm of neutral
      smooth_detailed: 'smooth',       // High flow, musical continuity over analytical detail
      elastic_controlled: 'elastic',   // Explosive dynamics from high efficiency
      airy_closed: 'airy',            // Open, spacious presentation
      // Founder reference calibration
      warm_bright_n: -1,         // Natural tonal density — warm but not heavy
      smooth_detailed_n: -1,     // Musical flow and ease over analytical detail
      elastic_controlled_n: -1,  // Dynamically alive — elastic, not overdamped
      airy_closed_n: -1,         // Open, spacious presentation
    },
    tendencyProfile: {
      basis: 'founder_reference',
      confidence: 'founder_reference',
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
      'High-efficiency coaxial wideband monitor designed for dynamic expression and tonal color. Prioritizes rhythmic engagement, musical flow, and harmonic richness over last-degree analytical precision. The kind of speaker that makes you tap your foot before you start analyzing.',
    retailer_links: [
      { label: 'WLM', url: 'https://www.wlm-loudspeakers.com/' },
    ],
    notes: 'Benefits from moderate-power amplification with good current delivery. Spatial precision improves significantly with careful placement.',
    placementSensitivity: {
      level: 'moderate',
      notes: 'Spatial precision improves significantly with careful positioning. Bass energy from the passive radiator can overwhelm small or untreated rooms.',
    },
    sourceReferences: [
      { source: '6moons', note: 'Srajan Ebaen review covering the coaxial wideband design and rhythmic engagement.' },
      { source: 'Twittering Machines', note: 'Review praising dynamic expression and musical involvement.' },
    ],
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
    subcategory: 'standmount',
    priceTier: 'upper-mid',
    brandScale: 'boutique',
    region: 'europe',
    country: 'CH',
    topology: 'bass-reflex',
    archetypes: { primary: 'spatial_holographic', secondary: 'precision_explicit' },
    primaryAxes: {
      warm_bright: 'neutral',            // Neutral with body — neither warm nor bright
      smooth_detailed: 'detailed',       // Texture and spatial precision dominate over flow
      elastic_controlled: 'elastic',     // Fast and articulate with low stored energy
      airy_closed: 'airy',             // Holographic spatial presentation
      // Founder reference calibration
      warm_bright_n: 0,           // Neutral — neither warm nor bright
      smooth_detailed_n: 1,       // Detailed and articulate
      elastic_controlled_n: -1,   // Fast, low stored energy — elastic
      airy_closed_n: -1,          // Holographic, airy presentation
    },
    tendencyProfile: {
      basis: 'founder_reference',
      confidence: 'founder_reference',
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
    placementSensitivity: {
      level: 'high',
      notes: 'Compact cabinet means bass thins significantly in larger rooms without boundary reinforcement or subwoofer support. Imaging precision depends heavily on positioning — benefits from precise toe-in and symmetrical placement away from side walls.',
    },
    sourceReferences: [
      { source: '6moons', note: 'Srajan Ebaen review covering spatial performance and Swiss craftsmanship.' },
      { source: 'Darko.Audio', note: 'John Darko video feature on Boenicke W5 as a holographic small speaker.' },
      { source: 'HiFi Huff', note: 'Review praising textural detail and imaging from a compact enclosure.' },
    ],
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
    usedPriceRange: { low: 1200, high: 1800 },
    availability: 'current',
    typicalMarket: 'both',
    category: 'speaker',
    architecture: 'BBC-tradition thin-wall sealed box',
    subcategory: 'standmount',
    priceTier: 'upper-mid',
    brandScale: 'specialist',
    region: 'uk',
    country: 'GB',
    topology: 'sealed',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'warm',             // Rich, dense midrange — quintessentially warm
      smooth_detailed: 'smooth',       // Musical flow over analytical detail
      elastic_controlled: 'controlled', // Composed, not dynamically explosive
      airy_closed: 'neutral',          // Intimate staging — neither expansive nor closed
    },
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
    placementSensitivity: {
      level: 'moderate',
      notes: 'Compact sealed design works well near boundaries but bass extension is limited. Best in smaller rooms where the speaker-listener distance allows the sound to coalesce. In larger spaces, the presentation can feel small-scale.',
    },
    sourceReferences: [
      { source: 'Stereophile', note: 'Herb Reichert and Art Dudley reviews praising midrange beauty and BBC heritage.' },
      { source: 'The Audiophiliac', note: 'Steve Guttenberg review calling the P3ESR one of the most satisfying small speakers ever made.' },
      { source: '6moons', note: 'Review covering the BBC thin-wall design and vocal naturalness.' },
      { source: 'What Hi-Fi?', note: 'Multi-award coverage noting refinement and musicality.' },
    ],
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
    subcategory: 'standmount',
    priceTier: 'upper-mid',
    brandScale: 'specialist',
    region: 'uk',
    country: 'GB',
    topology: 'bass-reflex',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'warm',             // Harbeth family warmth with midrange density
      smooth_detailed: 'smooth',       // Musical flow with gentle detail retrieval
      elastic_controlled: 'controlled', // Composed under pressure, not dynamically wild
      airy_closed: 'airy',            // More spacious than the P3ESR
    },
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
    sourceReferences: [
      { source: 'Stereophile', note: 'Herb Reichert review praising the SHL5+ as the complete Harbeth — midrange beauty with dynamic authority.' },
      { source: 'The Audiophiliac', note: 'Steve Guttenberg coverage of the SHL5+ as a do-everything monitor.' },
      { source: '6moons', note: 'Review covering the BBC thin-wall design evolution and full-range balance.' },
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
    subcategory: 'floorstanding',
    priceTier: 'high-end',
    brandScale: 'boutique',
    region: 'north-america',
    country: 'US',
    topology: 'high-efficiency',
    archetypes: { primary: 'rhythmic_propulsive', secondary: 'tonal_saturated' },
    primaryAxes: {
      warm_bright: 'warm',             // Deep tonal density, zero fatigue — rich and warm
      smooth_detailed: 'smooth',       // Musical flow and coherence over analytical retrieval
      elastic_controlled: 'elastic',   // Dynamically alive — one of its defining strengths
      airy_closed: 'airy',            // Open, spacious presentation with room-filling scale
    },
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
    placementSensitivity: {
      level: 'moderate',
      notes: 'Wide-baffle design produces substantial bass energy that can overwhelm rooms smaller than 15 square metres. Needs breathing room — pull away from rear walls to let the presentation open up.',
    },
    sourceReferences: [
      { source: 'Stereophile', note: 'Art Dudley review establishing the O/96 as a modern classic for tube systems.' },
      { source: 'The Audiophiliac', note: 'Steve Guttenberg review praising engagement and musicality.' },
      { source: '6moons', note: 'Srajan Ebaen review covering the high-efficiency design philosophy.' },
      { source: 'Darko.Audio', note: 'John Darko coverage of the DeVore house sound and O/96 appeal.' },
    ],
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
    subcategory: 'floorstanding',
    priceTier: 'mid-fi',
    brandScale: 'boutique',
    region: 'north-america',
    country: 'US',
    topology: 'high-efficiency',
    archetypes: { primary: 'rhythmic_propulsive' },
    primaryAxes: {
      warm_bright: 'neutral',            // Not warm, not bright — raw and direct
      smooth_detailed: 'neutral',        // Neither smooth nor detailed — rough and energetic
      elastic_controlled: 'elastic',     // Explosive dynamics, zero restraint
      airy_closed: 'airy',             // Open, forward presentation
    },
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
    sourceReferences: [
      { source: 'The Audiophiliac', note: 'Steve Guttenberg review calling the Dirty Weekend a gateway to high-efficiency listening.' },
      { source: 'Darko.Audio', note: 'John Darko coverage of Zu Audio and the full-range high-efficiency philosophy.' },
      { source: 'Twittering Machines', note: 'Review covering the raw energy and musical immediacy of the Dirty Weekend.' },
    ],
  },

  // ── Klipsch ───────────────────────────────────────────

  {
    id: 'klipsch-heresy-iv',
    brand: 'Klipsch',
    name: 'Heresy IV',
    price: 3198,
    usedPriceRange: { low: 1600, high: 2200 },
    availability: 'current',
    typicalMarket: 'both',
    category: 'speaker',
    architecture: 'three-way horn-loaded',
    subcategory: 'floorstanding',
    priceTier: 'upper-mid',
    brandScale: 'mainstream',
    region: 'north-america',
    country: 'US',
    topology: 'horn-loaded',
    archetypes: { primary: 'rhythmic_propulsive', secondary: 'precision_explicit' },
    primaryAxes: {
      warm_bright: 'neutral',            // Direct and present, not warm or bright
      smooth_detailed: 'detailed',       // Horn speed and transient clarity, not smooth at all
      elastic_controlled: 'elastic',     // Explosive horn dynamics
      airy_closed: 'neutral',           // Forward projection, not spacious or closed
    },
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
    placementSensitivity: {
      level: 'high',
      notes: 'Horn-loaded design is highly placement-dependent. Bass becomes thin away from walls — benefits from corner or near-wall positioning. Room reflections significantly affect the tonal balance and imaging.',
    },
    sourceReferences: [
      { source: 'Stereophile', note: 'Herb Reichert review praising the Heresy IV as a modern update to a heritage design.' },
      { source: 'The Audiophiliac', note: 'Steve Guttenberg review covering the dynamic impact and horn character.' },
      { source: 'Darko.Audio', note: 'Video review on the Heresy IV as an accessible horn speaker.' },
    ],
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
    subcategory: 'floorstanding',
    priceTier: 'upper-mid',
    brandScale: 'specialist',
    region: 'europe',
    country: 'FR',
    topology: 'bass-reflex',
    archetypes: { primary: 'precision_explicit', secondary: 'tonal_saturated' },
    primaryAxes: {
      warm_bright: 'neutral',            // Resolving but not harsh — neutral with beryllium precision
      smooth_detailed: 'detailed',       // Clarity is the primary character
      elastic_controlled: 'controlled',  // Composed and precise, not dynamically wild
      airy_closed: 'airy',             // Spacious presentation with depth
    },
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
    placementSensitivity: {
      level: 'moderate',
      notes: 'Beryllium tweeter can interact strongly with reflective rooms — first reflections from side walls and hard floors can push the treble toward brightness. Acoustic treatment or toe-in adjustment helps manage this.',
    },
    sourceReferences: [
      { source: 'Stereophile', note: 'Review covering the beryllium tweeter precision and bass authority.' },
      { source: 'Darko.Audio', note: 'John Darko video review on the Kanta No.2 as a resolving all-rounder.' },
      { source: 'What Hi-Fi?', note: 'Award coverage praising detail and build quality.' },
    ],
  },

  {
    id: 'focal-aria-906',
    brand: 'Focal',
    name: 'Aria 906',
    price: 999,
    category: 'speaker',
    architecture: 'two-way bass-reflex with flax driver',
    subcategory: 'standmount',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'europe',
    country: 'FR',
    topology: 'bass-reflex',
    archetypes: { primary: 'precision_explicit' },
    primaryAxes: {
      warm_bright: 'neutral',            // Balanced — neither warm nor bright
      smooth_detailed: 'detailed',       // Clarity-oriented at its price point
      elastic_controlled: 'neutral',     // Neither explosive nor controlled
      airy_closed: 'airy',             // Open, spacious for a budget bookshelf
    },
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
    sourceReferences: [
      { source: 'What Hi-Fi?', note: 'Multi-award review praising the Aria 906 as one of the best bookshelf speakers at its price.' },
      { source: 'The Audiophiliac', note: 'Steve Guttenberg review noting the flax driver naturalness and open sound.' },
      { source: 'Stereophile', note: 'Review covering the Aria line as Focal\'s best value proposition.' },
    ],
  },

  // ── Boutique expansion ────────────────────────────────

  {
    id: 'devore-orangutan-o93',
    brand: 'DeVore Fidelity',
    name: 'Orangutan O/93',
    price: 4500,
    category: 'speaker',
    architecture: 'Two-way, 10" wideband + silk dome tweeter, high-efficiency',
    subcategory: 'floorstanding',
    priceTier: 'upper-mid',
    brandScale: 'boutique',
    region: 'north-america',
    country: 'US',
    topology: 'bass-reflex',
    archetypes: { primary: 'flow_organic', secondary: 'rhythmic_propulsive' },
    primaryAxes: {
      warm_bright: 'warm',             // Rich tonal density and harmonic weight
      smooth_detailed: 'smooth',       // Musical flow dominates over analytical detail
      elastic_controlled: 'elastic',   // Dynamic, alive — shares the DeVore house character
      airy_closed: 'airy',            // Open, spacious presentation
    },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'warmth', level: 'present' },
        { trait: 'rhythm', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'openness', level: 'present' },
        { trait: 'spatial_precision', level: 'less_emphasized' },
        { trait: 'clarity', level: 'less_emphasized' },
        { trait: 'composure', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      rhythm: 0.7,
      dynamics: 1.0,
      tonal_density: 1.0,
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
      'Brooklyn-made high-efficiency floorstander designed for tube amplification. 10-inch wideband driver delivers remarkable dynamic scale with rich tonal density and natural musical flow. 93dB sensitivity makes it ideal for low-power SET and push-pull amps.',
    retailer_links: [
      { label: 'DeVore Fidelity', url: 'https://www.dfredelity.com/orangutan-o93' },
      { label: 'Tone Imports', url: 'https://toneimports.com/devore/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'dynamics', tendency: 'effortless dynamic scale — the 10" driver moves air with authority at any volume', basis: 'listener_consensus' },
        { domain: 'tonality', tendency: 'rich, warm, and harmonically dense — voices and acoustic instruments have natural body and weight', basis: 'listener_consensus' },
        { domain: 'timing', tendency: 'natural musical flow with rhythmic engagement — not analytical, but music moves forward with conviction', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'driven by low-power tube amps (SET, push-pull)', effect: 'the 93dB efficiency lets tubes deliver full dynamics — a classic pairing', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in small rooms', effect: 'the 10" driver and bass port need room to breathe — boundary effects can muddy the bass', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'dynamic ease, tonal richness, and tube-amp compatibility', cost: 'pinpoint imaging and the composure of sealed-box precision monitors', relative_to: 'Harbeth, ProAc, or Boenicke designs', basis: 'listener_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Stereophile', note: 'Art Dudley review praising the O/93 as a modern classic for tube-based systems.' },
      { source: '6moons', note: 'Srajan Ebaen review covering the 10-inch wideband driver and musical engagement.' },
      { source: 'The Audiophiliac', note: 'Steve Guttenberg feature on the O/93 and DeVore Fidelity philosophy.' },
    ],
  },

  {
    id: 'cube-audio-nendo',
    brand: 'Cube Audio',
    name: 'Nenuphar Mini (Nendo)',
    price: 3800,
    category: 'speaker',
    architecture: 'Full-range widebander, open-back cabinet',
    subcategory: 'standmount',
    priceTier: 'upper-mid',
    brandScale: 'boutique',
    region: 'europe',
    country: 'PL',
    topology: 'open-baffle',
    archetypes: { primary: 'spatial_holographic', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'warm',             // Tonal density present, zero fatigue
      smooth_detailed: 'smooth',       // Single-driver coherence and flow
      elastic_controlled: 'elastic',   // Full-range widebander — instant, dynamic response
      airy_closed: 'airy',            // Open-back cabinet — boundless spatial presentation
    },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'flow', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'openness', level: 'emphasized' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'warmth', level: 'present' },
        { trait: 'composure', level: 'less_emphasized' },
        { trait: 'clarity', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      rhythm: 0.7,
      dynamics: 0.7,
      tonal_density: 0.7,
      spatial_precision: 1.0,
      speed: 0.7,
      warmth: 0.7,
      texture: 1.0,
      composure: 0.4,
      flow: 1.0,
      clarity: 0.4,
      fatigue_risk: 0.0,
      openness: 1.0,
    },
    description:
      'Polish full-range widebander in a compact open-back cabinet. Ultra-high efficiency (96dB) with holographic spatial presentation and zero-crossover coherence. Designed for SET amps — the musical equivalent of a disappearing act.',
    retailer_links: [
      { label: 'Cube Audio', url: 'https://www.cubeaudio.com/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'spatial', tendency: 'holographic and boundless — the open-back design and single driver create a disappearing act with exceptional image specificity', basis: 'listener_consensus' },
        { domain: 'texture', tendency: 'zero-crossover coherence — textures are unified and natural, without the discontinuities of multi-way designs', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'effortless, flowing musicality — single driver means perfect phase coherence and natural timing', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'driven by SET or low-power Class A amps', effect: 'the 96dB efficiency lets even 2W amps deliver full dynamics — magical synergy', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in untreated or small rooms', effect: 'the open-back design radiates energy in all directions — room treatment is important', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'spatial holography, coherence, and the disappearing-speaker experience', cost: 'bass extension, composure under pressure, and room-treatment requirements', relative_to: 'conventional sealed or ported two-way monitors', basis: 'listener_consensus' },
      ],
    },
    notes: 'Ultra-high efficiency (96dB). Designed for SET amps. Requires careful room placement and ideally acoustic treatment.',
    placementSensitivity: {
      level: 'high',
      notes: 'Open-back cabinet design radiates sound in multiple directions. Requires significant distance from rear walls and ideally acoustic treatment. Room interaction is a defining part of the sound — placement determines whether the holographic imaging magic appears or collapses.',
    },
    sourceReferences: [
      { source: '6moons', note: 'Srajan Ebaen review covering the full-range widebander coherence and spatial performance.' },
      { source: 'Twittering Machines', note: 'Review praising the Nenuphar family for holographic imaging and musical flow.' },
    ],
  },

  {
    id: 'qualio-iq',
    brand: 'Qualio Audio',
    name: 'IQ',
    price: 5500,
    category: 'speaker',
    architecture: 'Two-way sealed, planar-magnetic tweeter + carbon-fiber woofer',
    subcategory: 'standmount',
    priceTier: 'upper-mid',
    brandScale: 'boutique',
    region: 'north-america',
    country: 'US',
    topology: 'sealed',
    archetypes: { primary: 'precision_explicit', secondary: 'spatial_holographic' },
    primaryAxes: {
      warm_bright: 'neutral',            // Transparent, not bright — lean but not glaring
      smooth_detailed: 'detailed',       // Clarity and precision are defining traits
      elastic_controlled: 'controlled',  // Sealed box composure — stable and poised
      airy_closed: 'airy',             // Wide dispersion from planar tweeter
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'composure', level: 'emphasized' },
        { trait: 'speed', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'openness', level: 'present' },
        { trait: 'tonal_density', level: 'less_emphasized' },
        { trait: 'warmth', level: 'less_emphasized' },
        { trait: 'flow', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      rhythm: 0.7,
      dynamics: 0.7,
      tonal_density: 0.4,
      spatial_precision: 1.0,
      speed: 0.7,
      warmth: 0.4,
      texture: 0.7,
      composure: 1.0,
      flow: 0.4,
      clarity: 1.0,
      fatigue_risk: 0.0,
      openness: 0.7,
    },
    description:
      'Precision-focused sealed standmount with planar-magnetic tweeter and carbon-fiber woofer. Designed for spatial accuracy, transparency, and composure. The sealed cabinet provides tight bass control and placement flexibility.',
    retailer_links: [
      { label: 'Qualio Audio', url: 'https://www.qualioaudio.com/' },
    ],
    sourceReferences: [
      { source: 'Stereophile', note: 'Herb Reichert review praising the planar-magnetic tweeter and sealed-box coherence.' },
      { source: '6moons', note: 'Review covering the Qualio IQ as a precision reference monitor.' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'spatial', tendency: 'precise, accurate imaging with wide dispersion — the planar tweeter creates an expansive, well-defined soundstage', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'lean and transparent — no warmth added, just the signal as it is', basis: 'listener_consensus' },
        { domain: 'dynamics', tendency: 'composed under pressure — holds together at volume with control and poise', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with warm or dense amplification', effect: 'the transparency lets upstream warmth through while adding spatial precision', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in analytical or lean systems', effect: 'can feel too explicit — needs some tonal weight upstream', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'spatial precision, composure, and transparency', cost: 'tonal density, warmth, and the musical ease of high-efficiency designs', relative_to: 'DeVore O/93, Harbeth 30.2', basis: 'review_consensus' },
      ],
    },
  },

  {
    id: 'hornshoppe-horns',
    brand: 'Hornshoppe',
    name: 'Horns',
    price: 900,
    category: 'speaker',
    architecture: 'Single-driver, rear-ported, horn-loaded',
    subcategory: 'floorstanding',
    priceTier: 'budget',
    brandScale: 'boutique',
    region: 'north-america',
    country: 'US',
    topology: 'horn-loaded',
    archetypes: { primary: 'rhythmic_propulsive', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'bright',            // Immediate, lively — sparkle and presence
      smooth_detailed: 'detailed',      // Strong sense of detail and articulation
      elastic_controlled: 'elastic',    // Ultra-high efficiency horn dynamics — very elastic
      airy_closed: 'airy',             // Very open, forward presentation
      // Founder reference calibration
      warm_bright_n: 1,           // Lively and bright — sparkle and presence
      smooth_detailed_n: 1,       // Detailed and articulate
      elastic_controlled_n: -2,   // Extremely elastic — explosive dynamics
      airy_closed_n: -2,          // Very airy — open, holographic
    },
    tendencyProfile: {
      basis: 'founder_reference',
      confidence: 'founder_reference',
      tendencies: [
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'rhythm', level: 'emphasized' },
        { trait: 'flow', level: 'emphasized' },
        { trait: 'openness', level: 'present' },
        { trait: 'warmth', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'speed', level: 'present' },
        { trait: 'texture', level: 'less_emphasized' },
        { trait: 'spatial_precision', level: 'less_emphasized' },
        { trait: 'composure', level: 'less_emphasized' },
        { trait: 'clarity', level: 'less_emphasized' },
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
      texture: 0.4,
      composure: 0.4,
      flow: 1.0,
      clarity: 0.4,
      fatigue_risk: 0.0,
      openness: 0.7,
    },
    description:
      'Handmade single-driver rear-ported horn-loaded speaker by Ed Schilling in South Carolina. Sub-$1k, ultra-high efficiency, raw dynamic energy, and rhythmic immediacy. May benefit from a subwoofer for deep bass extension. Designed for SET amps and the listeners who love them.',
    retailer_links: [
      { label: 'Hornshoppe', url: 'http://www.thehornshoppe.com/' },
    ],
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'dynamics', tendency: 'explosive, immediate dynamic delivery — the horn loading amplifies micro and macro dynamics', basis: 'listener_consensus' },
        { domain: 'timing', tendency: 'insistent rhythmic drive — music pushes forward with physical energy', basis: 'listener_consensus' },
        { domain: 'tonality', tendency: 'warm and present midrange — horn character adds presence and liveliness', basis: 'editorial_inference' },
      ],
      interactions: [
        { condition: 'driven by SET amps', effect: 'the ultra-high efficiency means even 2W amps deliver full dynamic range — the classic horn + SET pairing', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in small rooms', effect: 'horn energy can overwhelm — these speakers need space to breathe', valence: 'caution', basis: 'editorial_inference' },
        {
          condition: 'in system: Oppo OPDV971H → Marantz 2220B → Hornshoppe Horn',
          effect: 'The horn efficiency unlocks the Marantz\'s midrange qualities without stressing its power limits. Ravi Shankar recording produced extremely realistic tabla — strong transient realism, microdynamic expression, and physical presence.',
          valence: 'positive',
          basis: 'founder_reference',
        },
      ],
      tradeoffs: [
        { gains: 'dynamic immediacy, rhythmic drive, and SET-compatible efficiency', cost: 'refinement, imaging precision, and the composure of conventional designs', relative_to: 'sealed or ported precision monitors', basis: 'listener_consensus' },
      ],
    },
    notes: 'Very high efficiency (97dB+). Designed for SET amps. Build quality is artisanal — expect handmade rather than factory-finish.',
    sourceReferences: [
      { source: 'Twittering Machines', note: 'Review covering the back-loaded horn design and SET synergy.' },
      { source: 'Audiogon community', note: 'Listener consensus on dynamic immediacy and musical engagement.' },
    ],
  },

  {
    id: 'ocellia-calliope',
    brand: 'Ocellia',
    name: 'Calliope .21',
    price: 4800,
    category: 'speaker',
    architecture: 'Two-way, PHY-HP wideband driver, bass-reflex',
    subcategory: 'floorstanding',
    priceTier: 'upper-mid',
    brandScale: 'boutique',
    region: 'europe',
    country: 'FR',
    topology: 'bass-reflex',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'warm',             // Deeply warm — PHY-HP drivers are renowned for tonal richness
      smooth_detailed: 'smooth',       // Musical flow and harmonic truth over analytical detail
      elastic_controlled: 'neutral',   // Dynamic but not explosive — organic energy
      airy_closed: 'airy',            // Open, spacious with natural decay
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'medium',
      tendencies: [
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'flow', level: 'emphasized' },
        { trait: 'warmth', level: 'emphasized' },
        { trait: 'texture', level: 'present' },
        { trait: 'rhythm', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'openness', level: 'present' },
        { trait: 'composure', level: 'less_emphasized' },
        { trait: 'clarity', level: 'less_emphasized' },
        { trait: 'spatial_precision', level: 'less_emphasized' },
        { trait: 'speed', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      rhythm: 0.7,
      dynamics: 0.7,
      tonal_density: 1.0,
      spatial_precision: 0.4,
      speed: 0.4,
      warmth: 1.0,
      texture: 0.7,
      composure: 0.4,
      flow: 1.0,
      clarity: 0.4,
      fatigue_risk: 0.0,
      openness: 0.7,
    },
    description:
      'French artisanal speaker using PHY-HP drivers — known for extraordinary tonal richness and midrange density. High efficiency (94dB) for tube amplification. The Ocellia sound is deeply coloured and musical — prioritises harmonic truth over measured neutrality.',
    retailer_links: [
      { label: 'Ocellia', url: 'https://www.ocellia.com/' },
    ],
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'tonality', tendency: 'extraordinarily rich midrange — PHY-HP drivers are renowned for harmonic density and tonal truth', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'natural, unhurried musical flow — phrasing breathes with organic ease', basis: 'listener_consensus' },
        { domain: 'texture', tendency: 'warm, tactile textures — instruments feel physically present and harmonically complete', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'driven by SET or high-quality push-pull tube amps', effect: 'the PHY-HP driver rewards tube amplification with extraordinary tonal beauty', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'driven by analytical solid-state amplification', effect: 'can sound sluggish — the speaker\'s warmth needs complementary amplifier character', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'tonal richness, midrange beauty, and harmonic truth', cost: 'precision, composure under pressure, and bass extension', relative_to: 'modern precision monitors or sealed-box designs', basis: 'review_consensus' },
      ],
    },
    notes: 'French artisanal build. PHY-HP drivers are hand-made and define the sound. High efficiency (94dB) — designed for tube amps.',
    sourceReferences: [
      { source: '6moons', note: 'Srajan Ebaen review covering the PHY-HP driver and French artisanal build.' },
      { source: 'Twittering Machines', note: 'Review praising tonal richness and midrange density.' },
    ],
  },

  // ── DeVore Fidelity Gibbon 3XL ─────────────────────────

  {
    id: 'devore-gibbon-3xl',
    brand: 'DeVore Fidelity',
    name: 'Gibbon 3XL',
    price: 3990,
    usedPriceRange: { low: 1400, high: 2000 },
    availability: 'discontinued',
    typicalMarket: 'used',
    category: 'speaker',
    architecture: 'two-way bass-reflex with paper cone driver',
    subcategory: 'standmount',
    priceTier: 'upper-mid',
    brandScale: 'boutique',
    region: 'north-america',
    country: 'US',
    topology: 'bass-reflex',
    archetypes: { primary: 'flow_organic', secondary: 'rhythmic_propulsive' },
    primaryAxes: {
      warm_bright: 'warm',             // Rich tonal density, DeVore family warmth
      smooth_detailed: 'smooth',       // Musical flow over analytical detail
      elastic_controlled: 'neutral',   // Dynamic but not explosively so — organic
      airy_closed: 'airy',            // Spacious, organic soundstage
    },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'rhythm', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'warmth', level: 'present' },
        { trait: 'openness', level: 'present' },
        { trait: 'speed', level: 'less_emphasized' },
        { trait: 'spatial_precision', level: 'less_emphasized' },
        { trait: 'clarity', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      rhythm: 0.7,
      dynamics: 0.7,
      tonal_density: 1.0,
      spatial_precision: 0.4,
      speed: 0.4,
      warmth: 0.7,
      texture: 0.7,
      composure: 0.4,
      flow: 1.0,
      clarity: 0.4,
      fatigue_risk: 0.0,
      openness: 0.7,
    },
    description:
      'Expressive standmount with natural tone and midrange presence. High sensitivity (~90dB) makes it friendly with moderate-power amps. The precursor to the O/96 — shares the musical, lively DeVore house sound.',
    retailer_links: [],
    sourceReferences: [
      { source: 'Stereophile', note: 'Art Dudley review praising the Gibbon 3XL for expressive musicality and tonal naturalness.' },
      { source: '6moons', note: 'Review covering the paper cone driver and lively, organic presentation.' },
      { source: 'The Audiophiliac', note: 'Steve Guttenberg feature on DeVore Fidelity and the Gibbon lineage.' },
      { source: 'Head-Fi community', note: 'Used market consensus as one of the most musical standmounts under $2k.' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'natural tone and midrange presence — voices sound embodied and real', basis: 'listener_consensus' },
        { domain: 'timing', tendency: 'lively and expressive — excellent timing and musicality', basis: 'review_consensus' },
        { domain: 'spatial', tendency: 'spacious, organic soundstage — less pinpoint than studio monitors but more immersive', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'driven by clean solid-state amps with moderate power (25-100W)', effect: 'high sensitivity means easy drive — the amp controls while the speaker adds musicality', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'driven by tube amplifiers', effect: 'paper cone and high efficiency reward tube warmth beautifully', valence: 'positive', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'musicality, tonal naturalness, and engagement', cost: 'the last degree of analytical precision and spatial specificity', relative_to: 'KEF or Focal precision monitors', basis: 'review_consensus' },
      ],
    },
    notes: 'Discontinued but available used in the $1,400-2,000 range. Predecessor to the Orangutan line. Shares the DeVore musical DNA at a fraction of the O/96 price.',
  },

  // ── KEF R3 ──────────────────────────────────────────────

  {
    id: 'kef-r3',
    brand: 'KEF',
    name: 'R3',
    price: 2200,
    usedPriceRange: { low: 1200, high: 1600 },
    availability: 'current',
    typicalMarket: 'both',
    category: 'speaker',
    architecture: 'three-way with coaxial Uni-Q driver',
    subcategory: 'standmount',
    priceTier: 'mid-fi',
    brandScale: 'mainstream',
    region: 'uk',
    country: 'GB',
    topology: 'bass-reflex',
    archetypes: { primary: 'precision_explicit', secondary: 'spatial_holographic' },
    primaryAxes: {
      warm_bright: 'neutral',            // Lean but not bright — clean and neutral
      smooth_detailed: 'detailed',       // Clarity and precision from Uni-Q driver
      elastic_controlled: 'controlled',  // Composed and precise
      airy_closed: 'airy',             // Wide, coherent Uni-Q dispersion
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'composure', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'openness', level: 'present' },
        { trait: 'speed', level: 'present' },
        { trait: 'tonal_density', level: 'less_emphasized' },
        { trait: 'warmth', level: 'less_emphasized' },
        { trait: 'flow', level: 'less_emphasized' },
        { trait: 'texture', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      rhythm: 0.7,
      dynamics: 0.7,
      tonal_density: 0.4,
      spatial_precision: 1.0,
      speed: 0.7,
      warmth: 0.4,
      texture: 0.4,
      composure: 0.7,
      flow: 0.4,
      clarity: 1.0,
      fatigue_risk: 0.0,
      openness: 0.7,
    },
    description:
      'One of the most technically advanced speakers under $2k. Coaxial Uni-Q driver provides exceptional imaging and neutrality. Precision-focused presentation.',
    retailer_links: [
      { label: 'KEF', url: 'https://www.kef.com/products/r3' },
    ],
    sourceReferences: [
      { source: 'Stereophile', note: 'Herb Reichert review praising the Uni-Q imaging and neutrality.' },
      { source: 'Darko.Audio', note: 'Video review covering the R3 as a precision standmount.' },
      { source: 'What Hi-Fi?', note: 'Multi-award coverage for imaging and build quality.' },
      { source: 'The Audiophiliac', note: 'Steve Guttenberg review noting resolution and soundstage width.' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'clean and neutral — slightly lean but never harsh', basis: 'review_consensus' },
        { domain: 'spatial', tendency: 'exceptional imaging from the Uni-Q coaxial — point-source coherence', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'precise and controlled — more analytical than organic', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'driven by clean, detailed solid-state amplification', effect: 'the precision compounds — excellent for detail retrieval but may lean clinical', valence: 'caution', basis: 'listener_consensus' },
        { condition: 'driven by warmer amplification or tube gear', effect: 'the amplifier warmth fills out the lean tonal balance — often an ideal pairing', valence: 'positive', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'imaging precision, neutrality, and spatial coherence', cost: 'the organic warmth and flow of less analytical designs', relative_to: 'DeVore, Harbeth, or BBC-heritage speakers', basis: 'review_consensus' },
      ],
    },
    notes: 'Sensitive to placement. Benefits from quality stands and room treatment. The analytical presentation is a feature, not a bug — it reveals everything.',
    placementSensitivity: {
      level: 'high',
      notes: 'Highly sensitive to positioning and room acoustics. Quality stands are essential. Benefits from acoustic treatment — the analytical presentation reveals room anomalies as readily as source quality.',
    },
  },

  // ── Spendor A1 ──────────────────────────────────────────

  {
    id: 'spendor-a1',
    brand: 'Spendor',
    name: 'A1',
    price: 1900,
    availability: 'current',
    typicalMarket: 'new',
    category: 'speaker',
    architecture: 'two-way sealed box with EP77 polymer cone',
    subcategory: 'standmount',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'uk',
    country: 'GB',
    topology: 'sealed',
    archetypes: { primary: 'flow_organic', secondary: 'tonal_saturated' },
    primaryAxes: {
      warm_bright: 'warm',             // Slightly warm BBC-heritage balance
      smooth_detailed: 'smooth',       // Coherent musical flow over analytical detail
      elastic_controlled: 'controlled', // Composed and refined, not dynamically explosive
      airy_closed: 'airy',            // Open presentation for a sealed box
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'warmth', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'rhythm', level: 'less_emphasized' },
        { trait: 'dynamics', level: 'less_emphasized' },
        { trait: 'speed', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      rhythm: 0.4,
      dynamics: 0.4,
      tonal_density: 0.7,
      spatial_precision: 0.7,
      speed: 0.4,
      warmth: 0.7,
      texture: 0.7,
      composure: 0.7,
      flow: 1.0,
      clarity: 0.7,
      fatigue_risk: 0.0,
      openness: 0.7,
    },
    description:
      'Modern BBC-heritage monitor. Very coherent and natural with smooth, balanced vocals. Excellent long-term listening speaker. Slightly warm but never sluggish.',
    retailer_links: [
      { label: 'Spendor', url: 'https://www.spendoraudio.com/a1/' },
    ],
    sourceReferences: [
      { source: 'Stereophile', note: 'Herb Reichert review praising coherence and vocal naturalness.' },
      { source: '6moons', note: 'Review covering the A1 as a modern BBC-heritage reference.' },
      { source: 'What Hi-Fi?', note: 'Award-winning coverage noting build quality and musical balance.' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'smooth and balanced — excellent vocal reproduction', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'coherent and natural — phrasing breathes rather than attacks', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'refined, slightly warm — never grainy or harsh', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'driven by clean solid-state amplification', effect: 'the amplifier provides grip and dynamics while the speaker adds coherence', valence: 'positive', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'coherence, vocal naturalness, and long-term listening comfort', cost: 'dynamic impact and macro-scale excitement', relative_to: 'Zu or high-efficiency designs', basis: 'review_consensus' },
      ],
    },
    notes: 'At $1,900 new, fits under a $2k budget. BBC heritage with modern engineering. Excellent for acoustic, jazz, and vocal-forward music.',
  },

  // ── Wharfedale Linton Heritage ──────────────────────────

  {
    id: 'wharfedale-linton',
    brand: 'Wharfedale',
    name: 'Linton Heritage',
    price: 1499,
    availability: 'current',
    typicalMarket: 'new',
    category: 'speaker',
    architecture: 'three-way bass-reflex with Kevlar cone',
    subcategory: 'standmount',
    priceTier: 'mid-fi',
    brandScale: 'mainstream',
    region: 'uk',
    country: 'GB',
    topology: 'bass-reflex',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'warm',             // Rich, full-bodied — classic British warmth
      smooth_detailed: 'smooth',       // Musical flow, not analytical
      elastic_controlled: 'neutral',   // Relaxed but not sluggish — neither elastic nor controlled
      airy_closed: 'airy',            // Spacious, bigger than its size suggests
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'warmth', level: 'emphasized' },
        { trait: 'flow', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'rhythm', level: 'present' },
        { trait: 'openness', level: 'present' },
        { trait: 'clarity', level: 'less_emphasized' },
        { trait: 'speed', level: 'less_emphasized' },
        { trait: 'spatial_precision', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      rhythm: 0.7,
      dynamics: 0.7,
      tonal_density: 1.0,
      spatial_precision: 0.4,
      speed: 0.4,
      warmth: 1.0,
      texture: 0.7,
      composure: 0.7,
      flow: 0.7,
      clarity: 0.4,
      fatigue_risk: 0.0,
      openness: 0.7,
    },
    description:
      'Retro-styled three-way with rich, full-bodied sound. Exceptional value — punches well above its price in tonal richness and scale. Includes dedicated stands.',
    retailer_links: [
      { label: 'Wharfedale', url: 'https://www.wharfedale.co.uk/linton/' },
    ],
    sourceReferences: [
      { source: 'Darko.Audio', note: 'Video review praising the Linton as exceptional value with old-school warmth.' },
      { source: 'The Audiophiliac', note: 'Steve Guttenberg review calling it one of the best values in hi-fi.' },
      { source: 'What Hi-Fi?', note: 'Award-winning review noting rich, full-bodied sound.' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'rich and full-bodied — substantial midrange weight with classic British warmth', basis: 'review_consensus' },
        { domain: 'spatial', tendency: 'big, spacious presentation — larger than its physical size suggests', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'relaxed but musical — better for acoustic and vocal than hard-driving electronica', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'driven by fast, clean solid-state amplification', effect: 'the amplifier speed counterbalances the warm, relaxed speaker character', valence: 'positive', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'tonal richness, warmth, and scale at an exceptional price', cost: 'speed, transient definition, and analytical precision', relative_to: 'KEF, Focal, or modern precision monitors', basis: 'review_consensus' },
      ],
    },
    notes: 'Includes dedicated stands at $1,499 (speaker + stand bundle). Exceptional value proposition in the under-$2k category.',
  },

  // ── Totem Acoustic Model 1 Signature ────────────────────

  {
    id: 'totem-model-1-signature',
    brand: 'Totem Acoustic',
    name: 'Model 1 Signature',
    price: 3000,
    usedPriceRange: { low: 1200, high: 1800 },
    availability: 'discontinued',
    typicalMarket: 'used',
    category: 'speaker',
    architecture: 'two-way sealed box with proprietary drivers',
    subcategory: 'standmount',
    priceTier: 'upper-mid',
    brandScale: 'specialist',
    region: 'north-america',
    country: 'CA',
    topology: 'sealed',
    archetypes: { primary: 'flow_organic', secondary: 'spatial_holographic' },
    primaryAxes: {
      warm_bright: 'neutral',            // Slightly lean but never thin — neutral balance
      smooth_detailed: 'smooth',        // Flow-oriented, musical and coherent
      elastic_controlled: 'controlled', // Sealed box composure and precision
      airy_closed: 'airy',            // Holographic staging, disappearing act
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'texture', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'openness', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'dynamics', level: 'less_emphasized' },
        { trait: 'warmth', level: 'less_emphasized' },
        { trait: 'rhythm', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      rhythm: 0.4,
      dynamics: 0.4,
      tonal_density: 0.7,
      spatial_precision: 1.0,
      speed: 0.7,
      warmth: 0.4,
      texture: 0.7,
      composure: 0.7,
      flow: 1.0,
      clarity: 0.7,
      fatigue_risk: 0.0,
      openness: 1.0,
    },
    description:
      'Legendary sealed-box standmount with holographic imaging and natural musicality. Exceptional for its size — produces a disappearing soundstage that belies its compact dimensions.',
    retailer_links: [],
    sourceReferences: [
      { source: 'Stereophile', note: 'Multiple reviews over decades praising holographic imaging and musical engagement.' },
      { source: '6moons', note: 'Review covering the Model 1 as a reference small speaker.' },
      { source: 'The Audiophiliac', note: 'Steve Guttenberg feature on Totem and the Model 1 legacy.' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'spatial', tendency: 'holographic staging that seems impossible from such a small box', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'natural, slightly lean but never thin — reveals texture beautifully', basis: 'listener_consensus' },
        { domain: 'timing', tendency: 'musical and coherent — more flow-oriented than analytical', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'driven by quality solid-state amplification (50W+)', effect: 'needs current to open up — rewards good amplification disproportionately', valence: 'positive', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'imaging precision, disappearing act, and musical engagement', cost: 'bass extension and macro-dynamic scale', relative_to: 'larger floorstanders or high-efficiency designs', basis: 'review_consensus' },
      ],
    },
    notes: 'Discontinued but legendary. Available used for $1,200-1,800. Needs quality amplification and good stands. The sealed box means clean, fast bass rather than deep bass.',
  },

  // ── XSA ─────────────────────────────────────────────

  {
    id: 'xsa-vanguard',
    brand: 'XSA',
    name: 'Vanguard',
    price: 1800,
    category: 'speaker',
    architecture: 'compact two-way sealed monitor',
    subcategory: 'standmount',
    priceTier: 'mid-fi',
    brandScale: 'boutique',
    region: 'north-america',
    country: 'US',
    topology: 'sealed',
    archetypes: { primary: 'precision_explicit', secondary: 'rhythmic_propulsive' },
    primaryAxes: {
      warm_bright: 'bright',            // Articulation and clarity forward — slightly lean tonal balance
      smooth_detailed: 'detailed',      // Detail and speed over smoothness
      elastic_controlled: 'elastic',    // Quick, lively transients — not overdamped
      airy_closed: 'airy',             // Open, spacious presentation
      // Founder reference calibration
      warm_bright_n: 1,           // Lean of neutral — articulation over mass
      smooth_detailed_n: 1,       // Detail-forward — speed and clarity
      elastic_controlled_n: -1,   // Elastic — quick, not overdamped
      airy_closed_n: 1,           // Open and spacious
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Lean but not aggressive. Clarity comes from speed and openness rather than treble energy.',
    },
    tendencyProfile: {
      basis: 'founder_reference',
      confidence: 'founder_reference',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'speed', level: 'emphasized' },
        { trait: 'openness', level: 'emphasized' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'tonal_density', level: 'less_emphasized' },
        { trait: 'warmth', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 1.0,
      speed: 1.0,
      openness: 1.0,
      dynamics: 0.7,
      spatial_precision: 0.7,
      texture: 0.7,
      rhythm: 0.7,
      flow: 0.4,
      tonal_density: 0.4,
      warmth: 0.4,
      composure: 0.4,
      fatigue_risk: 0.0,
    },
    description:
      'Compact modern monitor emphasizing articulation, speed, and openness rather than tonal mass or saturation. Small-scale presentation that prioritises clarity and transient definition. Rewards systems that already have tonal body or warmth upstream.',
    retailer_links: [],
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'tonality', tendency: 'lean and articulate — clarity and definition over tonal density', basis: 'founder_reference' },
        { domain: 'timing', tendency: 'quick and lively — transient speed is a defining trait', basis: 'founder_reference' },
        { domain: 'spatial', tendency: 'open and airy staging for a compact monitor', basis: 'founder_reference' },
      ],
      interactions: [
        { condition: 'paired with warm or tonally dense amplification', effect: 'excellent balance — the amp provides body that the speaker does not add on its own', valence: 'positive', basis: 'founder_reference' },
        { condition: 'in systems already lean or bright', effect: 'lean-on-lean risk — the articulation can tip into thinness without upstream warmth', valence: 'caution', basis: 'founder_reference' },
        { condition: 'paired with tube amplification', effect: 'harmonic richness from tubes complements the speaker\'s speed and openness', valence: 'positive', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'articulation, openness, and transient speed', cost: 'tonal mass, saturation, and the scale of larger designs', relative_to: 'full-range or high-efficiency speakers', basis: 'founder_reference' },
      ],
    },
    sourceReferences: [
      { source: 'Founder listening notes', note: 'Calibrated from extended in-system use. Compact, quick, slightly lean, open.' },
    ],
    notes: 'Founder reference speaker. Best understood as a speed-and-clarity optimised monitor — works well when the system provides tonal body from other components.',
  },
];
