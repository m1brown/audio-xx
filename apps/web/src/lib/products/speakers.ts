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
      { source: '6moons', note: 'Srajan Ebaen review covering the coaxial wideband design and rhythmic engagement.', url: 'https://6moons.com/audioreviews/wlm/divamonitor.html' },
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
    philosophy: 'energy',
    marketType: 'nonTraditional',
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
      { source: '6moons', note: 'Srajan Ebaen review covering spatial performance and Swiss craftsmanship.', url: 'https://6moons.com/audioreviews/boenicke5/1.html' },
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
    // Step 10: buying metadata
    typicalMarket: 'new',
    buyingContext: 'dealer_likely',
    // imageUrl: undefined, // TODO: add official product image from boenicke-audio.ch
    philosophy: 'warm',
    marketType: 'nonTraditional',
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
      { source: 'Stereophile', note: 'Herb Reichert and Art Dudley reviews praising midrange beauty and BBC heritage.', url: 'https://www.stereophile.com/content/harbeth-p3esr-loudspeaker' },
      { source: 'The Audiophiliac', note: 'Steve Guttenberg review calling the P3ESR one of the most satisfying small speakers ever made.' },
      { source: '6moons', note: 'Review covering the BBC thin-wall design and vocal naturalness.', url: 'https://6moons.com/audioreviews/harbeth3/1.html' },
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
    // Step 10: buying metadata
    buyingContext: 'better_used',
    // imageUrl: undefined, // TODO: add official product image from harbeth.co.uk
    philosophy: 'warm',
    marketType: 'traditional',
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
      { source: 'Stereophile', note: 'Herb Reichert review praising the SHL5+ as the complete Harbeth — midrange beauty with dynamic authority.', url: 'https://www.stereophile.com/content/harbeth-super-hl5plus-loudspeaker' },
      { source: 'The Audiophiliac', note: 'Steve Guttenberg coverage of the SHL5+ as a do-everything monitor.' },
      { source: '6moons', note: 'Review covering the BBC thin-wall design evolution and full-range balance.' },
    ],
    philosophy: 'warm',
    marketType: 'traditional',
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
      { source: 'Stereophile', note: 'Art Dudley review establishing the O/96 as a modern classic for tube systems.', url: 'https://www.stereophile.com/content/devore-fidelity-orangutan-o96-loudspeaker' },
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
    // Step 10: buying metadata
    typicalMarket: 'both',
    usedPriceRange: { low: 7500, high: 10000 },
    buyingContext: 'dealer_likely',
    // imageUrl: undefined, // TODO: add official product image from devorefidelity.com
    philosophy: 'warm',
    marketType: 'nonTraditional',
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
    philosophy: 'energy',
    marketType: 'nonTraditional',
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
      { source: 'Darko.Audio', note: 'Video review on the Heresy IV as an accessible horn speaker.', url: 'https://darko.audio/2024/08/klipsch-heresy-iv-video-review/' },
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
    // Step 10: buying metadata
    buyingContext: 'easy_new',
    // imageUrl: undefined, // TODO: add official product image from klipsch.com
    philosophy: 'energy',
    marketType: 'traditional',
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
      { source: 'Stereophile', note: 'Review covering the beryllium tweeter precision and bass authority.', url: 'https://www.stereophile.com/content/focal-kanta-no2-loudspeaker' },
      { source: 'Darko.Audio', note: 'John Darko video review on the Kanta No.2 as a resolving all-rounder.' },
      { source: 'What Hi-Fi?', note: 'Award coverage praising detail and build quality.' },
    ],
    // Step 10: buying metadata
    typicalMarket: 'both',
    usedPriceRange: { low: 4000, high: 5500 },
    buyingContext: 'dealer_likely',
    // imageUrl: undefined, // TODO: add official product image from focal.com
    philosophy: 'analytical',
    marketType: 'traditional',
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
      { source: 'What Hi-Fi?', note: 'Multi-award review praising the Aria 906 as one of the best bookshelf speakers at its price.', url: 'https://www.whathifi.com/focal/aria-906/review' },
      { source: 'The Audiophiliac', note: 'Steve Guttenberg review noting the flax driver naturalness and open sound.' },
      { source: 'Stereophile', note: 'Review covering the Aria line as Focal\'s best value proposition.' },
    ],
    philosophy: 'analytical',
    marketType: 'traditional',
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
    sensitivity_db: 93,
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
      { source: 'Stereophile', note: 'Art Dudley review praising the O/93 as a modern classic for tube-based systems.', url: 'https://www.stereophile.com/content/devore-fidelity-orangutan-o93-loudspeaker' },
      { source: '6moons', note: 'Srajan Ebaen review covering the 10-inch wideband driver and musical engagement.' },
      { source: 'The Audiophiliac', note: 'Steve Guttenberg feature on the O/93 and DeVore Fidelity philosophy.' },
    ],
    philosophy: 'warm',
    marketType: 'nonTraditional',
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
    sensitivity_db: 96,
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
      'Polish full-range widebander in a compact open-back cabinet — 96dB efficiency requires only 2–5W for full dynamic range, pairing naturally with SET amplifiers. The single driver handles the full frequency range without a crossover, avoiding the phase discontinuities that crossover networks introduce between drivers. The open-back cabinet radiates energy rearward as well as forward, so room reflections contribute to the spatial image — but also make speaker placement and room treatment critical.',
    retailer_links: [
      { label: 'Cube Audio', url: 'https://www.cubeaudio.com/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'spatial', tendency: 'the open-back cabinet sends energy rearward into the room — when rear-wall distance and absorption are correct, the reflected energy arrives late enough to expand the spatial image beyond the cabinets; when the room is untreated, those reflections interfere with the direct sound and the image becomes diffuse', basis: 'listener_consensus' },
        { domain: 'texture', tendency: 'a single driver handling the full range means every frequency arrives from one point source with one radiation pattern — there are no crossover-induced phase shifts between drivers, so instrumental textures are time-coherent from bass through treble', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'one driver = one impulse response — transients arrive as a single unified event rather than the staggered arrivals that multi-way crossovers produce, giving music a continuity and rhythmic coherence', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'driven by SET or low-power Class A amps (2–8W)', effect: '96dB efficiency means 2W reaches ~99dB SPL — the amp operates in its most linear range without strain, and the low-power amp\'s limitations in current delivery are never exposed', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in untreated or small rooms', effect: 'the open-back radiation pattern sends as much energy rearward as forward — without absorption behind the speaker, early reflections interfere with the direct sound and spatial precision degrades', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'time-coherent reproduction from a single driver, expanded spatial image from rear-radiated room reflections, and the ability to reach full dynamic range with very low amplifier power', cost: 'bass extension is limited by driver excursion (no separate woofer), dynamic composure degrades at high SPL as the single driver handles everything, and room treatment is not optional — the speaker\'s spatial performance is room-dependent to a degree that conventional sealed or ported designs are not', relative_to: 'conventional sealed or ported two-way monitors (Qualio IQ, KEF LS50)', basis: 'listener_consensus' },
      ],
    },
    notes: '96dB efficiency. Designed for SET amps (2–8W). Single widebander driver, no crossover. Open-back cabinet requires room treatment.',
    placementSensitivity: {
      level: 'high',
      notes: 'Open-back cabinet radiates sound forward and rearward. Requires at least 3 feet from the rear wall and ideally rear-wall absorption. Without treatment, rear-radiated energy arrives at the listener ~5–15ms after the direct sound, smearing transients and degrading image specificity. The room is functionally part of the speaker design.',
    },
    sourceReferences: [
      { source: '6moons', note: 'Srajan Ebaen review covering the full-range widebander coherence and spatial performance.', url: 'https://6moons.com/audioreview_articles/cubeaudio6/' },
      { source: 'Twittering Machines', note: 'Review praising the Nenuphar family for holographic imaging and musical flow.' },
    ],
    philosophy: 'energy',
    marketType: 'nonTraditional',
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
    philosophy: 'neutral',
    marketType: 'nonTraditional',
  },

  {
    id: 'hornshoppe-horns',
    brand: 'Hornshoppe',
    name: 'Horns',
    price: 900,
    category: 'speaker',
    architecture: 'Single-driver rear-loaded horn, crossoverless Fostex FE126E fullrange, ~95dB efficiency',
    subcategory: 'floorstanding',
    priceTier: 'budget',
    brandScale: 'boutique',
    region: 'north-america',
    country: 'US',
    topology: 'horn-loaded',
    sensitivity_db: 95,
    archetypes: { primary: 'rhythmic_propulsive', secondary: 'precision_explicit' },
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
        { trait: 'speed', level: 'emphasized' },
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'rhythm', level: 'emphasized' },
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'openness', level: 'emphasized' },
        { trait: 'flow', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'warmth', level: 'less_emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
        { trait: 'texture', level: 'less_emphasized' },
        { trait: 'composure', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      speed: 1.0,
      rhythm: 1.0,
      dynamics: 1.0,
      clarity: 0.7,
      openness: 1.0,
      flow: 0.7,
      spatial_precision: 0.7,
      tonal_density: 0.0,
      warmth: 0.0,
      texture: 0.4,
      composure: 0.0,
      fatigue_risk: 0.0,
    },
    description:
      'Handmade single-driver rear-loaded horn by Ed Schilling. Crossoverless Fostex FE126E fullrange driver — ~95dB efficiency, fast, transparent, and utterly coherent. Tonally lean rather than warm; excels at speed, timing, and transient immediacy. Needs corner placement or a subwoofer for bass below ~45Hz. Designed for low-power tube, current-source, and T-amps.',
    retailer_links: [
      { label: 'Hornshoppe', url: 'http://www.thehornshoppe.com/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'timing', tendency: 'speed, dynamics, and timing are the defining strengths — the basic trinity of musical energy', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'lean and articulate rather than warm — tonal density is traded for transparency and transient clarity', basis: 'review_consensus' },
        { domain: 'spatial', tendency: 'monitor-type staging spookiness from single-driver coherence — intimate, precise, and holographic', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'crossoverless purity in the presence region — no filter network to smear or colour the signal', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'driven by SET or low-power tube amps', effect: 'the ultra-high efficiency means even 2W amps deliver full dynamic range — the classic pairing that lets simple amplifier topologies sound their best', valence: 'positive', basis: 'review_consensus' },
        { condition: 'paired with tonally dense or warm amplification', effect: 'excellent complementary match — the amp provides the body and tonal weight that the lean Horns trade away for speed', valence: 'positive', basis: 'review_consensus' },
        { condition: 'without corner placement or subwoofer', effect: 'bass is MIA below ~45Hz — the horn design needs room boundaries or a sub to complete the bottom end', valence: 'caution', basis: 'review_consensus' },
        {
          condition: 'in system: Oppo OPDV971H → Marantz 2220B → Hornshoppe Horn',
          effect: 'The horn efficiency unlocks the Marantz\'s midrange qualities without stressing its power limits. Ravi Shankar recording produced extremely realistic tabla — strong transient realism, microdynamic expression, and physical presence.',
          valence: 'positive',
          basis: 'founder_reference',
        },
      ],
      tradeoffs: [
        { gains: 'speed, transient immediacy, coherence, and transparency from a single crossoverless driver', cost: 'tonal density, bass extension, and the composure of conventional multi-way designs', relative_to: 'sealed or ported precision monitors, multi-way floorstanders', basis: 'review_consensus' },
      ],
    },
    notes: 'Very high efficiency (~95dB). Crossoverless single-driver design — one Fostex FE126E fullrange per cabinet. Corner placement strongly recommended when run without a subwoofer. Build quality is artisanal. A classic of the single-driver genre.',
    sourceReferences: [
      { source: '6moons', note: 'Triple review by Srajan Ebaen, Paul Candy, and Michael Lavorgna. Defines the speaker as speed, dynamics, and timing first; lean rather than warm; monitor-type staging from single-driver coherence.' },
      { source: 'Stereophile', note: 'Review covering the Horn Shoppe Horn loudspeaker.' },
      { source: 'Founder listening notes', note: 'Heard in Oppo → Marantz 2220B → Hornshoppe chain. Tabla realism, transient immediacy, physical presence.' },
    ],
    philosophy: 'energy',
    marketType: 'nonTraditional',
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
    sensitivity_db: 94,
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
    philosophy: 'warm',
    marketType: 'nonTraditional',
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
    sensitivity_db: 90,
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
      { source: 'Stereophile', note: 'Art Dudley review praising the Gibbon 3XL for expressive musicality and tonal naturalness.', url: 'https://www.stereophile.com/content/devore-fidelity-gibbon-3xl-loudspeaker' },
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
    philosophy: 'warm',
    marketType: 'nonTraditional',
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
      { source: 'Darko.Audio', note: 'Video review covering the R3 as a precision standmount.', url: 'https://darko.audio/2023/09/kef-r3-meta-video-review/' },
      { source: 'What Hi-Fi?', note: 'Multi-award coverage for imaging and build quality.', url: 'https://www.whathifi.com/reviews/kef-r3' },
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
    philosophy: 'neutral',
    marketType: 'traditional',
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
    philosophy: 'warm',
    marketType: 'traditional',
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
      { source: 'Darko.Audio', note: 'Video review praising the Linton as exceptional value with old-school warmth.', url: 'https://darko.audio/2023/06/wharfedale-linton-heritage-video-review/' },
      { source: 'The Audiophiliac', note: 'Steve Guttenberg review calling it one of the best values in hi-fi.' },
      { source: 'What Hi-Fi?', note: 'Award-winning review noting rich, full-bodied sound.', url: 'https://www.whathifi.com/reviews/wharfedale-linton' },
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
    philosophy: 'warm',
    marketType: 'traditional',
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
      { source: 'Stereophile', note: 'Multiple reviews over decades praising holographic imaging and musical engagement.', url: 'https://www.stereophile.com/standloudspeakers/820/index.html' },
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
    philosophy: 'warm',
    marketType: 'nonTraditional',
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
    philosophy: 'neutral',
    marketType: 'nonTraditional',
  },

  // ── Boenicke W8 ─────────────────────────────────────

  {
    id: 'boenicke-w8',
    brand: 'Boenicke',
    name: 'W8',
    price: 9200,
    category: 'speaker',
    architecture: '2-way floorstanding, aluminium-magnesium tweeter, long-throw bass driver, swing-base decoupling',
    subcategory: 'floorstanding',
    priceTier: 'upper-mid',
    brandScale: 'boutique',
    region: 'europe',
    country: 'CH',
    topology: 'bass-reflex',
    archetypes: { primary: 'flow_organic', secondary: 'spatial_holographic' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'elastic',
      airy_closed: 'airy',
      warm_bright_n: -1,
      smooth_detailed_n: 0,
      elastic_controlled_n: -1,
      airy_closed_n: 1,
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'warmth', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'composure', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 1.0,
      spatial_precision: 1.0,
      warmth: 0.7,
      tonal_density: 0.7,
      texture: 0.7,
      dynamics: 0.7,
      clarity: 0.7,
      composure: 0.4,
      fatigue_risk: 0.0,
      openness: 1.0,
    },
    description:
      'Swiss floorstanding with Boenicke\'s signature slim-cabinet, wide-bandwidth philosophy scaled up from the W5. Warm, spacious, and holographic with exceptional disappearing act for its size. The swing-base decoupling system isolates the cabinet from the floor. More bass extension and scale than the W5 while retaining the family\'s musical flow and spatial magic.',
    retailer_links: [
      { label: 'Boenicke Audio', url: 'https://www.boenicke-audio.ch/w8' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'spatial', tendency: 'holographic imaging — the speakers disappear completely, leaving only the music in space', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'warm, natural, and balanced — body without heaviness', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'musically flowing — easy and organic rather than incisive', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with high-quality amplification (50W+)', effect: 'the long-throw bass driver rewards clean power with surprising low-end weight', valence: 'positive', basis: 'review_consensus' },
        { condition: 'in well-treated rooms with space behind', effect: 'the holographic staging reaches its full potential — needs room to breathe', valence: 'positive', basis: 'review_consensus' },
        { condition: 'paired with lean or analytical electronics', effect: 'the warmth and body compensate well — a natural system balancer', valence: 'positive', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'holographic imaging, musical flow, natural warmth, and room-filling scale from a slim cabinet', cost: 'ultimate bass authority and control compared to larger floorstanders', relative_to: 'large floorstanding speakers', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: '6moons', note: 'Review praising the W8\'s holographic staging and natural warmth.' },
      { source: 'HiFi+', note: 'Review noting the disappearing act and musical engagement.' },
    ],
    notes: 'Swiss manufacturing. The swing-base decoupling system is key to the W8\'s imaging precision. Available in multiple wood finishes. Benefits from good amplification — 50–100W recommended.',
    philosophy: 'warm',
    marketType: 'nonTraditional',
  },

  // ── DeVore Fidelity O/Baby ──────────────────────────

  {
    id: 'devore-orangutan-obaby',
    brand: 'DeVore Fidelity',
    name: 'Orangutan O/Baby',
    price: 5600,
    category: 'speaker',
    architecture: '2-way standmount, 6.5" paper cone woofer, 1" silk dome tweeter, rear-ported, 10Ω nominal, 92dB sensitivity',
    subcategory: 'standmount',
    priceTier: 'upper-mid',
    brandScale: 'boutique',
    region: 'north-america',
    country: 'US',
    topology: 'bass-reflex',
    sensitivity_db: 92,
    archetypes: { primary: 'flow_organic', secondary: 'tonal_saturated' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'elastic',
      airy_closed: 'neutral',
      warm_bright_n: -1,
      smooth_detailed_n: -1,
      elastic_controlled_n: -1,
      airy_closed_n: 0,
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'warmth', level: 'emphasized' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'composure', level: 'less_emphasized' },
        { trait: 'speed', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 1.0,
      warmth: 1.0,
      tonal_density: 0.7,
      texture: 0.7,
      dynamics: 0.7,
      clarity: 0.7,
      composure: 0.4,
      speed: 0.4,
      fatigue_risk: 0.0,
      openness: 0.4,
    },
    description:
      'Entry to the DeVore Orangutan line — the same warm, musical, tube-friendly philosophy in a compact standmount. 92dB sensitivity and 10Ω impedance make it an ideal match for low-power tube amplifiers. Paper cone and silk dome drivers deliver the natural, organic tonality the Orangutan line is known for. Smaller scale than the O/93 and O/96 but the same family voice.',
    retailer_links: [
      { label: 'DeVore Fidelity', url: 'https://www.dfridelity.com/orangutan-obaby' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'warm, organic, and natural — the DeVore house sound in a compact form', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'musically flowing and elastic — responds to the character of the amplifier', basis: 'review_consensus' },
        { domain: 'dynamics', tendency: 'lively and expressive for a standmount — the 92dB sensitivity helps', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'driven by SET or low-power tube amplifiers (2–15W)', effect: 'ideal match — the sensitivity and impedance are designed for tubes', valence: 'positive', basis: 'review_consensus' },
        { condition: 'in small to medium rooms', effect: 'the compact format fills smaller spaces well without overwhelming', valence: 'positive', basis: 'review_consensus' },
        { condition: 'paired with high-power solid-state', effect: 'works fine but doesn\'t need the power — may lose some of the tube-friendly character that\'s the point', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'tube-friendly efficiency, natural warmth, and musical engagement in a compact package', cost: 'bass extension and scale compared to the O/93 and O/96', relative_to: 'larger Orangutan models', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Stereophile', note: 'Herb Reichert coverage of the Orangutan line\'s tube-friendly design philosophy.' },
      { source: 'Positive Feedback', note: 'Review praising the O/Baby\'s natural tonality and SET compatibility.' },
    ],
    notes: 'Brooklyn, NY manufacturing. The 10Ω nominal impedance is key — it presents an easy load that lets tube amps deliver their best. Paper cones and silk domes are chosen for tonal naturalism over measured flatness.',
    philosophy: 'warm',
    marketType: 'nonTraditional',
  },

  // ── Magnepan ────────────────────────────────────────

  {
    id: 'magnepan-lrs-plus',
    brand: 'Magnepan',
    name: 'LRS+',
    price: 995,
    category: 'speaker',
    architecture: 'Full-range planar magnetic, quasi-ribbon tweeter, 4Ω nominal, 86dB sensitivity',
    subcategory: 'floorstanding',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'north-america',
    country: 'US',
    topology: 'planar-magnetic',
    sensitivity_db: 86,
    archetypes: { primary: 'precision_explicit', secondary: 'spatial_holographic' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'airy',
      warm_bright_n: 0,
      smooth_detailed_n: 1,
      elastic_controlled_n: 1,
      airy_closed_n: 2,
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'speed', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'composure', level: 'less_emphasized' },
        { trait: 'dynamics', level: 'less_emphasized' },
        { trait: 'warmth', level: 'less_emphasized' },
      ],
      riskFlags: ['bass_limited'],
    },
    traits: {
      spatial_precision: 1.0,
      clarity: 1.0,
      texture: 1.0,
      speed: 0.7,
      flow: 0.7,
      composure: 0.4,
      dynamics: 0.4,
      warmth: 0.0,
      tonal_density: 0.4,
      fatigue_risk: 0.0,
      openness: 1.0,
    },
    description:
      'Entry-level planar magnetic from Magnepan — an extraordinary value that introduces the planar sound: transparent, detailed, spacious, and utterly open. The quasi-ribbon tweeter delivers textural detail that box speakers at 3x the price struggle to match. Limited bass extension and dynamics, and the 4Ω/86dB load demands a current-capable amplifier. But for midrange purity and spatial presentation, nothing at this price comes close.',
    retailer_links: [
      { label: 'Magnepan', url: 'https://www.magnepan.com/model_LRS_Plus' },
    ],
    placementSensitivity: {
      level: 'high',
      notes: 'Requires 3+ feet from rear wall for proper imaging. Dipole radiation pattern means room treatment matters significantly. Best in medium to large rooms.',
    },
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'spatial', tendency: 'enormous, open soundstage — the planar radiation pattern creates a wall of sound that box speakers cannot replicate', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'neutral and transparent — no coloration, no box resonance, pure midrange', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'exceptional textural detail — voices and acoustic instruments have startling realism', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'driven by current-capable amplification (100W+ into 4Ω)', effect: 'essential — the 4Ω load and low sensitivity demand a strong amp to come alive', valence: 'positive', basis: 'review_consensus' },
        { condition: 'in small or untreated rooms', effect: 'the dipole radiation bounces off walls — needs space and possibly treatment to image properly', valence: 'caution', basis: 'review_consensus' },
        { condition: 'paired with warm amplification', effect: 'adds body that the Maggies don\'t provide themselves — a complementary match', valence: 'positive', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'transparency, spatial openness, midrange purity, and textural detail at an absurd price', cost: 'bass extension, dynamic impact, and the ability to play loud without compression', relative_to: 'dynamic box speakers', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Stereophile', note: 'Multiple reviews praising the LRS series as the greatest value in audio.' },
      { source: 'The Absolute Sound', note: 'Review noting the extraordinary midrange purity.' },
    ],
    notes: 'Factory-direct from Minnesota. Must be paired with a capable amplifier — weak amps are the #1 cause of Magnepan disappointment. A subwoofer integration is common for listeners who want full-range capability.',
    philosophy: 'neutral',
    marketType: 'traditional',
  },

  {
    id: 'magnepan-point-7',
    brand: 'Magnepan',
    name: '.7',
    price: 1395,
    category: 'speaker',
    architecture: 'Full-range planar magnetic with quasi-ribbon tweeter, larger panel than LRS+, 4Ω, 86dB',
    subcategory: 'floorstanding',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'north-america',
    country: 'US',
    topology: 'planar-magnetic',
    sensitivity_db: 86,
    archetypes: { primary: 'precision_explicit', secondary: 'spatial_holographic' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'airy',
      warm_bright_n: 0,
      smooth_detailed_n: 1,
      elastic_controlled_n: 1,
      airy_closed_n: 2,
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'speed', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'composure', level: 'less_emphasized' },
        { trait: 'warmth', level: 'less_emphasized' },
      ],
      riskFlags: ['bass_limited'],
    },
    traits: {
      spatial_precision: 1.0,
      clarity: 1.0,
      texture: 1.0,
      speed: 0.7,
      flow: 0.7,
      dynamics: 0.7,
      composure: 0.4,
      warmth: 0.0,
      tonal_density: 0.4,
      fatigue_risk: 0.0,
      openness: 1.0,
    },
    description:
      'Scaled-up sibling of the LRS+ with a larger panel for more bass extension and dynamic headroom. Same planar magnetic virtues — transparency, spatial openness, textural detail — with better low-end weight. Still demands quality amplification and room to breathe. A natural step up for anyone who loves the planar sound and wants more scale.',
    retailer_links: [
      { label: 'Magnepan', url: 'https://www.magnepan.com/model_Point_7' },
    ],
    placementSensitivity: {
      level: 'high',
      notes: 'Dipole — requires distance from rear wall and room treatment for best results. Larger panel needs a medium-to-large room.',
    },
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'spatial', tendency: 'wide, deep, immersive soundstage — the larger panel scales up the planar spatial magic', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'neutral and uncolored — transparent to upstream electronics', basis: 'review_consensus' },
        { domain: 'dynamics', tendency: 'more dynamic headroom than the LRS+ — the larger panel moves more air', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'driven by current-capable amplification (100W+ into 4Ω)', effect: 'essential — same amplification demands as the LRS+ but rewards quality power with better scale', valence: 'positive', basis: 'review_consensus' },
        { condition: 'in rooms with adequate space (14x16 or larger)', effect: 'the larger panel images properly and the dipole radiation has room to develop', valence: 'positive', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'more bass extension and dynamic scale than the LRS+ while retaining planar transparency', cost: 'bass slam and the ease of placement that box speakers offer', relative_to: 'dynamic floorstanding speakers', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Stereophile', note: 'Review praising the .7 as a scaled-up LRS with better bass and dynamics.' },
    ],
    notes: 'Factory-direct from Minnesota. The .7 is the sweet spot of the Magnepan line for many — more bass than the LRS+ without the size/cost leap to the 1.7i.',
    philosophy: 'neutral',
    marketType: 'traditional',
  },

  // ── Falcon LS3/5a ───────────────────────────────────
  // BBC LS3/5a monitor heritage (Falcon licensed reproduction)
  {
    id: 'falcon-ls3-5a',
    brand: 'Falcon',
    name: 'LS3/5a',
    price: 3200,
    category: 'speaker',
    architecture: 'Sealed 2-way monitor, BBC LS3/5a design (Falcon licensed), ~83dB, legendary midrange purity and imaging',
    subcategory: 'standmount',
    priceTier: 'upper-mid',
    brandScale: 'boutique',
    region: 'uk',
    country: 'UK',
    topology: 'sealed',
    sensitivity_db: 83,
    archetypes: { primary: 'precision_explicit', secondary: 'tonal_saturated' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'moderate',
      warm_bright_n: 0,
      smooth_detailed_n: 1,
      elastic_controlled_n: 1,
      airy_closed_n: 0,
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'midrange_purity', level: 'emphasized' },
        { trait: 'composure', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'bass_weight', level: 'less_emphasized' },
      ],
      riskFlags: ['bass_limited', 'placement_sensitive'],
    },
    traits: {
      spatial_precision: 1.0,
      clarity: 1.0,
      texture: 1.0,
      speed: 0.8,
      flow: 0.8,
      dynamics: 0.6,
      composure: 0.8,
      warmth: 0.5,
      tonal_density: 0.7,
      fatigue_risk: 0.0,
      openness: 0.7,
    },
    description:
      'The legendary BBC LS3/5a in contemporary Falcon Acoustics manufacture. A sealed-box monitor prized for its midrange purity, imaging precision, and vocal clarity. Needs high-quality stands and careful placement, but demands neither powerful amplification nor room treatment to shine. A reference-quality tool for listeners who value transparency and detail over bass extension. Iconic design that has influenced speaker engineering for decades.',
    retailer_links: [
      { label: 'Falcon Acoustics', url: 'https://www.falcon-acoustics.co.uk/' },
    ],
    placementSensitivity: {
      level: 'high',
      notes: 'Sealed design is less placement-sensitive than reflex, but isolation and proper stands are essential for imaging.',
    },
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'neutral, uncolored — the midrange is the voice of the speaker', basis: 'review_consensus' },
        { domain: 'spatial', tendency: 'precise, intimate imaging with excellent center image focus', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'fine detail and textural resolution throughout the midrange', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with quality stands and room treatment', effect: 'imaging and soundstage become reference-grade', valence: 'positive', basis: 'review_consensus' },
        { condition: 'used in smaller rooms (12x14 or smaller)', effect: 'the monitor scale is appropriate and bass reinforcement helps extension', valence: 'positive', basis: 'review_consensus' },
        { condition: 'given unhurried, uncolored amplification', effect: 'the neutrality allows the signal chain to be heard with unusual clarity', valence: 'positive', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'midrange purity, imaging precision, and tonal neutrality', cost: 'limited bass extension and dynamic scale', relative_to: 'larger floorstanding designs', basis: 'review_consensus' },
        { gains: 'low amplifier requirements and room-agnostic sealed design', cost: 'needs careful stands and placement for best results', relative_to: 'more forgiving speakers', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'BBC', note: 'Original design specification and decades of studio use.' },
      { source: 'Stereophile', note: 'Multiple reviews praising the LS3/5a as a reference monitor and domestic speaker.' },
    ],
    notes: 'Manufactured under license by Falcon Acoustics in the UK. The LS3/5a is a speaker that rewards careful listening and proper setup. Not a crowd-pleaser, but a tool for listeners who value truth over drama.',
    philosophy: 'neutral',
    marketType: 'traditional',
  },

  // ── Mission 770 ───────────────────────────────────
  // Reissue of a British classic
  {
    id: 'mission-770',
    brand: 'Mission',
    name: '770',
    price: 2500,
    category: 'speaker',
    architecture: '2-way standmount, bass-reflex, 87dB, warm, rich British sound with excellent midrange',
    subcategory: 'standmount',
    priceTier: 'upper-mid',
    brandScale: 'specialist',
    region: 'uk',
    country: 'UK',
    topology: 'bass-reflex',
    sensitivity_db: 87,
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'elastic',
      airy_closed: 'closed',
      warm_bright_n: -1,
      smooth_detailed_n: -1,
      elastic_controlled_n: -1,
      airy_closed_n: -1,
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'warmth', level: 'emphasized' },
        { trait: 'midrange_presence', level: 'emphasized' },
        { trait: 'musicality', level: 'emphasized' },
        { trait: 'flow', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'spatial_precision', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      spatial_precision: 0.5,
      clarity: 0.7,
      texture: 0.7,
      speed: 0.6,
      flow: 0.85,
      dynamics: 0.7,
      composure: 0.7,
      warmth: 0.85,
      tonal_density: 0.85,
      fatigue_risk: 0.0,
      openness: 0.6,
    },
    description:
      'A reissue of a British standmount classic, the 770 brings back the warm, musically engaging character that defined Mission speakers in their heyday. Rich midrange, smooth treble, and surprising bass extension from a compact box. More forgiving and emotionally engaging than strictly neutral designs — a speaker that makes listening a pleasure rather than an audition.',
    retailer_links: [
      { label: 'Mission', url: 'https://www.missionspk.com/' },
    ],
    placementSensitivity: {
      level: 'moderate',
      notes: 'Bass-reflex design is room-dependent; corner placement will reinforce bass. Needs quality stands.',
    },
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'warm, colored presentation — midrange is slightly advanced and rich', basis: 'review_consensus' },
        { domain: 'dynamics', tendency: 'lively, punchy dynamics with good rhythmic drive', basis: 'review_consensus' },
        { domain: 'spatial', tendency: 'good imaging but not analytical — soundstage is warm and enveloping', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'with tube amplification', effect: 'the warmth pairs beautifully; synergy is natural', valence: 'positive', basis: 'review_consensus' },
        { condition: 'in smaller listening rooms', effect: 'the bass-reflex reinforcement is often welcome', valence: 'positive', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'warm, musical character and midrange presence', cost: 'less analytical transparency and precision than neutral monitors', relative_to: 'precision speakers', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Hi-Fi News', note: 'Review of the reissue praising the faithful reproduction of the original character.' },
    ],
    notes: 'British engineering with modern manufacturing. A speaker for music lovers who value engagement over analysis.',
    philosophy: 'warm',
    marketType: 'traditional',
  },

  // ── Mission MS 50 8VET ───────────────────────────────────
  // Vintage British budget classic — the user's beloved speaker
  {
    id: 'mission-ms-50-8vet',
    brand: 'Mission',
    name: 'MS 50 8VET',
    price: 80,
    category: 'speaker',
    architecture: 'Vintage 2-way standmount, bass-reflex, warm, musical, incredible value when found used',
    subcategory: 'standmount',
    priceTier: 'budget',
    brandScale: 'mainstream',
    region: 'uk',
    country: 'UK',
    topology: 'bass-reflex',
    sensitivity_db: 86,
    availability: 'discontinued',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'elastic',
      airy_closed: 'closed',
      warm_bright_n: -1,
      smooth_detailed_n: -1,
      elastic_controlled_n: -1,
      airy_closed_n: -1,
    },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'warmth', level: 'emphasized' },
        { trait: 'musicality', level: 'emphasized' },
        { trait: 'flow', level: 'emphasized' },
        { trait: 'midrange_presence', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'clarity', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      spatial_precision: 0.4,
      clarity: 0.6,
      texture: 0.6,
      speed: 0.5,
      flow: 0.9,
      dynamics: 0.7,
      composure: 0.7,
      warmth: 0.9,
      tonal_density: 0.8,
      fatigue_risk: 0.0,
      openness: 0.5,
    },
    description:
      'A true bargain-bin gem. The MS 50 8VET exemplifies the warm, BBC-influenced British tuning philosophy that defined Mission\'s early product line. At under $100 used (and typically available), it punches far above its price point. Warm, musical, forgiving presentation with genuine flow and musicality. Not a precision tool, but a speaker that makes listening engaging and pleasurable. Perfect for vinyl, acoustic music, and anyone who values emotional involvement over technical analysis. This speaker is a reminder that the best audio doesn\'t require expensive equipment.',
    retailer_links: [
      { label: 'Used Market (eBay, Reverb)', url: 'https://www.ebay.com' },
    ],
    placementSensitivity: {
      level: 'moderate',
      notes: 'Vintage design; condition and foam surrounds matter. Needs quality stands and careful room placement.',
    },
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'warm, forgiving, colored — the voice of BBC-school design applied to an affordable box', basis: 'listener_consensus' },
        { domain: 'flow', tendency: 'excellent rhythmic coherence and musicality — this speaker makes time move naturally', basis: 'listener_consensus' },
        { domain: 'dynamics', tendency: 'punchy, lively presentation with good energy', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'paired with warm amplification (tube or forgiving solid-state)', effect: 'synergy is natural and the warmth becomes comforting rather than excessive', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'used for vinyl or acoustic music', effect: 'the musicality and flow are ideal pairings', valence: 'positive', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'warmth, musicality, and incredible value', cost: 'clarity and precision take a back seat', relative_to: 'neutral monitors', basis: 'listener_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Listener Consensus', note: 'Used market evidence and long-term listener satisfaction with vintage Mission speakers.' },
    ],
    notes: 'This speaker is a beloved reference point for the user. It represents genuine musicality at minimal cost. A humbling reminder that taste and character matter more than specifications and price.',
    philosophy: 'warm',
    marketType: 'traditional',
  },

  // ── Amphion Argon3S ───────────────────────────────────
  // Studio-influenced precision standmount from Finland
  {
    id: 'amphion-argon3s',
    brand: 'Amphion',
    name: 'Argon3S',
    price: 3600,
    category: 'speaker',
    architecture: '2-way sealed standmount, 86dB, studio-influenced design with exceptional imaging and neutral clarity',
    subcategory: 'standmount',
    priceTier: 'upper-mid',
    brandScale: 'specialist',
    region: 'europe',
    country: 'Finland',
    topology: 'sealed',
    sensitivity_db: 86,
    archetypes: { primary: 'precision_explicit', secondary: 'spatial_holographic' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'airy',
      warm_bright_n: 0,
      smooth_detailed_n: 1,
      elastic_controlled_n: 1,
      airy_closed_n: 1,
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'neutrality', level: 'emphasized' },
        { trait: 'composure', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'warmth', level: 'less_emphasized' },
      ],
      riskFlags: ['bass_limited'],
    },
    traits: {
      spatial_precision: 1.0,
      clarity: 1.0,
      texture: 1.0,
      speed: 0.85,
      flow: 0.7,
      dynamics: 0.75,
      composure: 0.85,
      warmth: 0.4,
      tonal_density: 0.6,
      fatigue_risk: 0.0,
      openness: 0.9,
    },
    description:
      'A studio monitor designed for home listening. The Argon3S brings professional monitoring philosophy into the living room — exceptional imaging, neutral tonal balance, and superior clarity. Sealed design offers placement flexibility and reveals recording detail without editorial coloration. Finnish engineering and build quality are evident. A reference tool for listeners who value accurate reproduction and the ability to hear into recordings.',
    retailer_links: [
      { label: 'Amphion', url: 'https://www.amphion.fi/' },
    ],
    placementSensitivity: {
      level: 'low',
      notes: 'Sealed design is room-agnostic. Flexible placement, but benefits from good stands and isolation.',
    },
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'neutral, transparent — the speaker reveals the recording rather than imposing character', basis: 'review_consensus' },
        { domain: 'spatial', tendency: 'exceptional imaging depth and precision — soundstage is three-dimensional and layered', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'fine detail and textural resolution; you hear into every recording', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'with high-resolution recordings and streaming', effect: 'the clarity and detail retrieval are ideally paired', valence: 'positive', basis: 'review_consensus' },
        { condition: 'in rooms where accurate reproduction is valued', effect: 'the neutrality and imaging make the speaker disappear', valence: 'positive', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'clarity, neutrality, and exceptional imaging', cost: 'bass extension and dynamic scale are limited', relative_to: 'larger floorstanding designs', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Stereophile', note: 'Review praising the Argon3S for studio-grade clarity in a residential setting.' },
    ],
    notes: 'Studio heritage applied to domestic listening. For listeners who value accuracy and detail retrieval above all else.',
    philosophy: 'neutral',
    marketType: 'traditional',
  },

  // ── JBL L100 Classic ───────────────────────────────────
  // Fun, dynamic floorstanding with retro styling
  {
    id: 'jbl-l100-classic',
    brand: 'JBL',
    name: 'L100 Classic',
    price: 4500,
    category: 'speaker',
    architecture: '3-way floorstanding, bass-reflex, 12" woofer, 90dB, fun, dynamic, punchy with modern drivers in retro design',
    subcategory: 'floorstanding',
    priceTier: 'high-end',
    brandScale: 'mainstream',
    region: 'north-america',
    country: 'US',
    topology: 'bass-reflex',
    sensitivity_db: 90,
    archetypes: { primary: 'rhythmic_propulsive', secondary: 'tonal_saturated' },
    primaryAxes: {
      warm_bright: 'bright',
      smooth_detailed: 'detailed',
      elastic_controlled: 'elastic',
      airy_closed: 'airy',
      warm_bright_n: 1,
      smooth_detailed_n: 0,
      elastic_controlled_n: -1,
      airy_closed_n: 1,
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'punch', level: 'emphasized' },
        { trait: 'bass_extension', level: 'emphasized' },
        { trait: 'fun_factor', level: 'emphasized' },
        { trait: 'clarity', level: 'present' },
        { trait: 'treble_energy', level: 'present' },
        { trait: 'spatial_precision', level: 'less_emphasized' },
      ],
      riskFlags: ['treble_energy'],
    },
    traits: {
      spatial_precision: 0.6,
      clarity: 0.75,
      texture: 0.7,
      speed: 0.8,
      flow: 0.7,
      dynamics: 0.95,
      composure: 0.65,
      warmth: 0.5,
      tonal_density: 0.7,
      fatigue_risk: 0.15,
      openness: 0.8,
    },
    description:
      'Retro styling meets modern drivers in this reimagined JBL classic. The L100 Classic is exuberant, dynamic, and deeply fun to listen to. Big bass, energetic midrange, and bright treble make it ideal for rock, pop, jazz, and hip-hop. The 3-way design with dual woofers delivers visceral impact. Not a reference monitor, but a speaker that prioritizes engagement and enjoyment. Modern construction and reliability wrapped in iconic aesthetic.',
    retailer_links: [
      { label: 'JBL', url: 'https://www.jbl.com/' },
    ],
    placementSensitivity: {
      level: 'moderate',
      notes: 'Bass-reflex design benefits from corner placement for reinforcement. Responds well to room acoustics treatment.',
    },
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'dynamics', tendency: 'punchy, lively, energetic — this speaker has personality and presence', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'bright, colored — the presence peak gives music energy and excitement', basis: 'review_consensus' },
        { domain: 'bass', tendency: 'extended and impactful — excellent for rhythm-driven music', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'playing rock, pop, electronic, or hip-hop', effect: 'the speaker shines; dynamics and energy are ideal matches', valence: 'positive', basis: 'review_consensus' },
        { condition: 'in larger rooms (16x18 or bigger)', effect: 'scale and impact are maximized', valence: 'positive', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'dynamic excitement, bass impact, and fun factor', cost: 'analytical precision and tonal neutrality', relative_to: 'neutral monitors', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Stereophile', note: 'Review celebrating the L100 Classic as a fun, energetic speaker with modern reliability.' },
    ],
    notes: 'A speaker that knows what it is: engaging and entertaining. Not for critical listening, but for music lovers who want to feel the energy.',
    philosophy: 'energy',
    marketType: 'traditional',
  },

  // ── Altec Model 19 ───────────────────────────────────
  // Legendary horn-loaded vintage floorstanding
  {
    id: 'altec-model-19',
    brand: 'Altec',
    name: 'Model 19',
    price: 3000,
    category: 'speaker',
    architecture: 'Horn-loaded 2-way vintage, 15" woofer + horn, ~100dB, legendary efficiency, dynamic, punchy, visceral',
    subcategory: 'floorstanding',
    priceTier: 'upper-mid',
    brandScale: 'specialist',
    region: 'north-america',
    country: 'US',
    topology: 'horn-loaded',
    sensitivity_db: 100,
    availability: 'discontinued',
    archetypes: { primary: 'rhythmic_propulsive', secondary: 'tonal_saturated' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'elastic',
      airy_closed: 'closed',
      warm_bright_n: -1,
      smooth_detailed_n: -1,
      elastic_controlled_n: -1,
      airy_closed_n: -1,
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'efficiency', level: 'emphasized' },
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'punch', level: 'emphasized' },
        { trait: 'warmth', level: 'emphasized' },
        { trait: 'musicality', level: 'present' },
        { trait: 'bass_extension', level: 'present' },
        { trait: 'spatial_precision', level: 'less_emphasized' },
      ],
      riskFlags: ['placement_sensitive', 'coloration'],
    },
    traits: {
      spatial_precision: 0.5,
      clarity: 0.65,
      texture: 0.7,
      speed: 0.7,
      flow: 0.8,
      dynamics: 0.95,
      composure: 0.6,
      warmth: 0.8,
      tonal_density: 0.8,
      fatigue_risk: 0.1,
      openness: 0.6,
    },
    description:
      'A sonic time capsule. The Altec Model 19 horn-loaded speaker represents mid-century American design philosophy: efficiency, immediacy, and visceral impact. The 15" woofer and horn-loaded tweeter deliver dynamic punch that solid-state boxes cannot match. Warm, colored, undeniably musical. Plays well at low volumes with low-powered tube gear. Typically found used; condition and driver age matter significantly. An immersive experience rather than a reference tool.',
    retailer_links: [
      { label: 'Used Market (Craigslist, Reverb)', url: 'https://www.reverb.com' },
    ],
    placementSensitivity: {
      level: 'high',
      notes: 'Vintage design; horn loading creates directional characteristics. Sensitive to room placement and acoustic treatment.',
    },
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'dynamics', tendency: 'explosive, visceral punch — horn loading delivers immediate impact', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'warm, colored, vintage character — the horn signature is present and distinct', basis: 'review_consensus' },
        { domain: 'efficiency', tendency: 'plays loud at whisper-quiet power levels — ideal for low-power tube amplifiers', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with low-power tube amplification (5-20W)', effect: 'the speaker is ideal; efficiency and impedance are perfectly matched', valence: 'positive', basis: 'review_consensus' },
        { condition: 'in rooms where placement can accommodate horn loading characteristics', effect: 'the speaker establishes a sense of presence and directness', valence: 'positive', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'efficiency, dynamic punch, and warm vintage character', cost: 'placement sensitivity and horn coloration', relative_to: 'modern sealed boxes', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Stereophile Archives', note: 'Vintage speaker retrospectives praising the Model 19 for its dynamic impact.' },
    ],
    notes: 'A vintage speaker that requires respect for its age and design philosophy. Not a precision tool, but an experience. Best used by listeners comfortable with vintage equipment and its attendant quirks. A legendary pairing with low-power tube amps.',
    philosophy: 'energy',
    marketType: 'nonTraditional',
  },

  // ── DeVore Fidelity O/92 ───────────────────────────────────
  // The middle Orangutan — more scale than O/Baby
  {
    id: 'devore-orangutan-o92',
    brand: 'DeVore Fidelity',
    name: 'Orangutan O/92',
    price: 8400,
    category: 'speaker',
    architecture: '2-way floorstanding, bass-reflex, 92dB/10Ω, tube-friendly impedance, more bass and scale than O/Baby',
    subcategory: 'floorstanding',
    priceTier: 'high-end',
    brandScale: 'boutique',
    region: 'north-america',
    country: 'US',
    topology: 'bass-reflex',
    sensitivity_db: 92,
    archetypes: { primary: 'flow_organic', secondary: 'tonal_saturated' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'smooth',
      elastic_controlled: 'elastic',
      airy_closed: 'moderate',
      warm_bright_n: 0,
      smooth_detailed_n: -1,
      elastic_controlled_n: -1,
      airy_closed_n: 0,
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'musicality', level: 'emphasized' },
        { trait: 'flow', level: 'emphasized' },
        { trait: 'midrange_presence', level: 'emphasized' },
        { trait: 'warmth', level: 'emphasized' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'spatial_precision', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      spatial_precision: 0.65,
      clarity: 0.75,
      texture: 0.8,
      speed: 0.7,
      flow: 0.95,
      dynamics: 0.8,
      composure: 0.8,
      warmth: 0.75,
      tonal_density: 0.85,
      fatigue_risk: 0.0,
      openness: 0.7,
    },
    description:
      'The middle path in the Orangutan line. The O/92 scales up from the O/Baby with more bass extension, better dynamics, and greater overall authority, while retaining the musicality and organic flow that define DeVore philosophy. Excellent tube amplifier synergy with easy 10Ω impedance. The O/92 is a floorstanding speaker that feels like a standmount — direct, engaging, and emotionally present. Not a precision monitor, but a music-making instrument.',
    retailer_links: [
      { label: 'DeVore Fidelity', url: 'https://www.devorefidelity.com/' },
    ],
    placementSensitivity: {
      level: 'moderate',
      notes: 'Bass-reflex design benefits from proper room integration. Responds well to positioning adjustments.',
    },
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'musicality', tendency: 'organic, warm, engaging — the speaker prioritizes flow and emotion', basis: 'review_consensus' },
        { domain: 'dynamics', tendency: 'lively, punchy, with natural rhythmic drive', basis: 'review_consensus' },
        { domain: 'spatial', tendency: 'warm, intimate soundstage with excellent mid-frequency focus', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with tube amplification (20-50W)', effect: 'the speaker reveals its full character; synergy is natural', valence: 'positive', basis: 'review_consensus' },
        { condition: 'playing acoustic, jazz, or vocal-heavy music', effect: 'the midrange presence and musicality are ideal', valence: 'positive', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'musicality, flow, and organic warmth', cost: 'measured precision and extreme clarity are sacrificed', relative_to: 'neutral monitors', basis: 'review_consensus' },
        { gains: 'tube amplifier friendliness and dynamic performance', cost: 'higher power amplifiers may over-drive the gentle character', relative_to: 'high-power systems', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Stereophile', note: 'Review praising the O/92 as a musical, tube-friendly loudspeaker with excellent scaling from the O/Baby.' },
    ],
    notes: 'A musical instrument, not a measuring stick. The O/92 is designed for listeners who value engagement and emotional involvement. The 10Ω impedance and bass-reflex design allow the speaker to work in diverse room contexts.',
    philosophy: 'warm',
    marketType: 'nonTraditional',
  },

  // ── Wilson Audio Sabrina X ───────────────────────────────────
  // Wilson's "entry" floorstanding — statement-level precision
  {
    id: 'wilson-audio-sabrina-x',
    brand: 'Wilson Audio',
    name: 'Sabrina X',
    price: 21500,
    category: 'speaker',
    architecture: '3-way floorstanding, sealed/ported, ~87dB, precision, dynamics, resolution — Wilson\'s entry floorstanding',
    subcategory: 'floorstanding',
    priceTier: 'statement',
    brandScale: 'specialist',
    region: 'north-america',
    country: 'US',
    topology: 'bass-reflex',
    sensitivity_db: 87,
    archetypes: { primary: 'precision_explicit', secondary: 'rhythmic_propulsive' },
    primaryAxes: {
      warm_bright: 'bright',
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'airy',
      warm_bright_n: 1,
      smooth_detailed_n: 1,
      elastic_controlled_n: 1,
      airy_closed_n: 1,
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'precision', level: 'emphasized' },
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'bass_control', level: 'emphasized' },
        { trait: 'resolution', level: 'emphasized' },
        { trait: 'warmth', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      spatial_precision: 1.0,
      clarity: 1.0,
      texture: 1.0,
      speed: 0.95,
      flow: 0.7,
      dynamics: 0.95,
      composure: 0.95,
      warmth: 0.4,
      tonal_density: 0.6,
      fatigue_risk: 0.0,
      openness: 0.9,
    },
    description:
      'Wilson\'s most affordable floorstanding model, but "affordable" is relative — the Sabrina X is a statement-level loudspeaker engineered to Wilson\'s exacting standards. Sealed/ported hybrid design, advanced driver technology, and meticulous tuning deliver precision, dynamic authority, and resolution few speakers achieve at any price. Not a forgiving or warm speaker, but a tool for listeners who demand exactness. The entry to Wilson\'s world of uncompromising engineering.',
    retailer_links: [
      { label: 'Wilson Audio', url: 'https://www.wilsonaudio.com/' },
    ],
    placementSensitivity: {
      level: 'low',
      notes: 'Wilson speakers are engineered for flexibility; placement is less critical than with many designs.',
    },
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'precision', tendency: 'extraordinarily controlled and accurate — every note is clearly articulated', basis: 'review_consensus' },
        { domain: 'dynamics', tendency: 'explosive transient response and dynamic range; the speaker gets out of the way', basis: 'review_consensus' },
        { domain: 'spatial', tendency: 'three-dimensional imaging with excellent layering and depth', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'with high-resolution sources and quality amplification', effect: 'resolution is maximized; the speaker becomes transparent', valence: 'positive', basis: 'review_consensus' },
        { condition: 'in larger rooms with dedicated audio electronics', effect: 'the speaker establishes reference-grade performance', valence: 'positive', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'precision, clarity, and dynamic control', cost: 'warmth and musicality are not priorities', relative_to: 'organic designs', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Stereophile', note: 'Review praising the Sabrina X as a statement-level loudspeaker at the entry of Wilson\'s line.' },
    ],
    notes: 'An engineering statement. The Sabrina X is designed for listeners who value precision and control above all. Synergy with high-quality amplification and sources is essential.',
    philosophy: 'analytical',
    marketType: 'traditional',
  },

  // ── Magico A3 ───────────────────────────────────
  // Studio-grade sealed precision floorstanding
  {
    id: 'magico-a3',
    brand: 'Magico',
    name: 'A3',
    price: 12500,
    category: 'speaker',
    architecture: '3-way sealed floorstanding, aluminum enclosure, ~88dB, precision, transparency, controlled bass — studio-grade',
    subcategory: 'floorstanding',
    priceTier: 'high-end',
    brandScale: 'specialist',
    region: 'north-america',
    country: 'US',
    topology: 'sealed',
    sensitivity_db: 88,
    archetypes: { primary: 'precision_explicit', secondary: 'spatial_holographic' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'airy',
      warm_bright_n: 0,
      smooth_detailed_n: 1,
      elastic_controlled_n: 1,
      airy_closed_n: 1,
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'precision', level: 'emphasized' },
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'transparency', level: 'emphasized' },
        { trait: 'bass_control', level: 'emphasized' },
        { trait: 'neutrality', level: 'present' },
        { trait: 'warmth', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      spatial_precision: 1.0,
      clarity: 1.0,
      texture: 0.95,
      speed: 0.9,
      flow: 0.65,
      dynamics: 0.85,
      composure: 0.95,
      warmth: 0.35,
      tonal_density: 0.55,
      fatigue_risk: 0.0,
      openness: 0.95,
    },
    description:
      'A studio monitor with residential pedigree. The Magico A3 applies precision-engineered studio principles — sealed enclosure, aluminum construction, and rigorous driver integration — to create a floorstanding speaker of exceptional accuracy and control. Bass response is tight and well-controlled; midrange is transparent and uncolored; treble is extended and airy. A tool for listeners who want to hear exactly what\'s on the recording. Not warm or forgiving, but brilliantly clear.',
    retailer_links: [
      { label: 'Magico', url: 'https://www.magico.net/' },
    ],
    placementSensitivity: {
      level: 'low',
      notes: 'Sealed design offers placement flexibility. Responds well to room treatment and careful component matching.',
    },
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'neutral, transparent — the speaker is silent about its own character', basis: 'review_consensus' },
        { domain: 'spatial', tendency: 'exceptional imaging precision and three-dimensional space', basis: 'review_consensus' },
        { domain: 'bass', tendency: 'tight, controlled, articulate — bass notes are distinct and clear', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'with high-resolution digital sources and quality amplification', effect: 'clarity and detail retrieval are maximized', valence: 'positive', basis: 'review_consensus' },
        { condition: 'in treated rooms with careful component synergy', effect: 'the speaker becomes reference-grade', valence: 'positive', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'precision, clarity, and tonal neutrality', cost: 'musicality and warmth take a back seat', relative_to: 'organic designs', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Stereophile', note: 'Review praising the A3 for studio-grade precision in a residential floorstanding format.' },
    ],
    notes: 'A precision instrument. The A3 is for listeners comfortable with neutral, analytical sound and willing to invest in component synergy. Not a casual speaker, but a reference tool.',
    philosophy: 'analytical',
    marketType: 'traditional',
  },

  // ── Magnepan 1.7i ───────────────────────────────────
  // The classic Magnepan sweet spot — transparency and staging
  {
    id: 'magnepan-1-7i',
    brand: 'Magnepan',
    name: '1.7i',
    price: 2495,
    category: 'speaker',
    architecture: 'Full-range planar magnetic with quasi-ribbon tweeter, 4Ω, 86dB, transparency, staging, needs current',
    subcategory: 'floorstanding',
    priceTier: 'upper-mid',
    brandScale: 'specialist',
    region: 'north-america',
    country: 'US',
    topology: 'other',
    sensitivity_db: 86,
    archetypes: { primary: 'spatial_holographic', secondary: 'precision_explicit' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'balanced',
      airy_closed: 'airy',
      warm_bright_n: 0,
      smooth_detailed_n: 1,
      elastic_controlled_n: 0,
      airy_closed_n: 2,
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'transparency', level: 'emphasized' },
        { trait: 'staging', level: 'emphasized' },
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'speed', level: 'present' },
        { trait: 'dynamics', level: 'less_emphasized' },
        { trait: 'bass_weight', level: 'less_emphasized' },
      ],
      riskFlags: ['bass_limited', 'amplifier_demanding'],
    },
    traits: {
      spatial_precision: 1.0,
      clarity: 1.0,
      texture: 0.95,
      speed: 0.8,
      flow: 0.7,
      dynamics: 0.65,
      composure: 0.6,
      warmth: 0.2,
      tonal_density: 0.45,
      fatigue_risk: 0.0,
      openness: 1.0,
    },
    description:
      'The iconic Magnepan 1.7i is the sweet spot of the planar line — larger than the LRS+ with more presence and staging, smaller and more affordable than the 3.7i. Planar transparency allows you to hear through the speakers into the room; dipole radiation creates a sense of space and openness rarely found in box speakers. Demands quality, current-capable amplification (100W+ into 4Ω) and space to breathe. Not a speaker for bass-heavy rooms or small spaces, but a musical revelation for listeners who prioritize openness and spatial presentation.',
    retailer_links: [
      { label: 'Magnepan', url: 'https://www.magnepan.com/model_1_7i' },
    ],
    placementSensitivity: {
      level: 'high',
      notes: 'Dipole design — requires distance from rear wall. Needs medium-to-large room for proper bass development and soundstage.',
    },
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'spatial', tendency: 'wide, deep, immersive soundstage — the planar dipole creates a sense of space', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'neutral, transparent — you hear the recording, not the speaker', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'exceptional detail and textural resolution across the spectrum', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with current-capable amplification (100W+ into 4Ω)', effect: 'essential for full potential realization', valence: 'positive', basis: 'review_consensus' },
        { condition: 'in rooms with adequate space (14x16 or larger)', effect: 'imaging and soundstage develop fully', valence: 'positive', basis: 'review_consensus' },
        { condition: 'with well-treated room and quality source components', effect: 'spatial presentation becomes reference-grade', valence: 'positive', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'exceptional transparency, spatial openness, and textural detail', cost: 'limited bass extension and dynamic scale', relative_to: 'dynamic floorstanding speakers', basis: 'review_consensus' },
        { gains: 'effortless midrange and treble presentation', cost: 'bass is lean and requires room reinforcement', relative_to: 'sealed designs', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Stereophile', note: 'Long-standing Stereophile recommendation for spatial presentation and transparency.' },
    ],
    notes: 'Factory-direct from Minnesota. The 1.7i is the gateway Magnepan for many listeners — a clear step into planar territory without the size and cost of larger models. Room and amplification must be part of the decision.',
    philosophy: 'neutral',
    marketType: 'traditional',
  },

  // ── sound|kaos (Switzerland — widebander) ──────────────

  {
    id: 'soundkaos-vox-3a',
    brand: 'sound|kaos',
    name: 'Vox 3a',
    price: 5500,
    category: 'speaker',
    architecture: 'Full-range driver + dual woofers + ambient ribbon supertweeter, rear-ported box, handcrafted',
    subcategory: 'standmount',
    priceTier: 'upper-mid',
    brandScale: 'boutique',
    region: 'europe',
    country: 'CH',
    topology: 'high-efficiency',
    archetypes: { primary: 'flow_organic', secondary: 'tonal_saturated' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'elastic',
      airy_closed: 'airy',
    },
    fatigueAssessment: {
      risk: 'very_low',
      notes: 'The full-range driver handles the critical midrange band without a crossover transition through it, avoiding the phase issues that cause fatigue in conventional two-ways. The ribbon supertweeter adds air without energy or edge. Long-session speaker.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'warmth', level: 'present' },
        { trait: 'spatial_precision', level: 'less_emphasized' },
        { trait: 'dynamics', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.55, warmth: 0.7, tonal_density: 0.8,
      speed: 0.7, dynamics: 0.5, flow: 0.9,
      spatial_precision: 0.5, composure: 0.6, texture: 0.85,
      fatigue_risk: 0.0, openness: 0.8,
    },
    description: 'Swiss-designed speaker built around a full-range driver that handles the midrange band without a crossover, supported by dual woofers for bass extension and an ambient ribbon supertweeter for air. The full-range driver gives the midrange a directness and coherence that conventional crossover-based designs trade away. Staging is intimate and immediate rather than wide or deep — the listener sits inside the music rather than observing it from a distance. Dynamic headroom is limited by the full-range driver\'s excursion, and bass is managed by the woofers rather than produced by a large cabinet. Extensively reviewed by Srajan Ebaen on 6moons.',
    retailer_links: [
      { label: 'sound|kaos', url: 'https://www.soundkaos.com/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'warm, rich midrange from full-range driver coherence — the critical vocal and instrument band is handled by one driver without a crossover transition through it, giving instruments a directness and wholeness', basis: 'review_consensus' },
        { domain: 'spatial', tendency: 'intimate, immediate staging — the listener is placed inside the performance rather than at a distance; soundstage width and depth are modest, not holographic', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'elastic phrasing and natural musical flow — the full-range driver\'s midrange coherence gives music an effortless continuity; woofers and supertweeter extend the range without disrupting it', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with low-power tube or SET amplification', effect: 'high efficiency means SET amps have enough headroom; the tube midrange reinforces the full-range driver\'s tonal strengths', valence: 'positive', basis: 'review_consensus' },
        { condition: 'in small to medium rooms (under ~250 sq ft)', effect: 'the intimate staging works with the room rather than fighting it — the speaker disappears more easily at close listening distances', valence: 'positive', basis: 'review_consensus' },
        { condition: 'in large rooms or at high SPL', effect: 'dynamic headroom becomes limiting — the full-range driver runs out of excursion before filling the space, and the woofers cannot compensate for the midrange\'s output ceiling', valence: 'caution', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'midrange coherence, tonal purity, musical flow, and long-session listenability from a full-range driver handling the critical band without crossover', cost: 'dynamic headroom at high SPL, and the wide precise imaging that conventional multi-way designs achieve through dedicated dome tweeters with narrower dispersion', relative_to: 'multi-way dynamic speakers (KEF, Dynaudio, Harbeth)', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: '6moons', note: 'Extensive coverage by Srajan Ebaen. Martin Gateley\'s sound|kaos is one of 6moons\' most-reviewed speaker brands.' },
    ],
    notes: 'Handcrafted in Switzerland. The Vox 3a uses a full-range driver for midrange coherence, dual woofers for bass extension, and an ambient ribbon supertweeter for air. The full-range driver handles the critical midrange band without a crossover transition through it. Designed for listeners who value tonal purity and musical flow over measurement-sheet performance.',
    philosophy: 'warm',
    marketType: 'traditional',
  },

  // ── KEF LS60 Wireless (UK — active floorstander) ───────

  {
    id: 'kef-ls60-wireless',
    brand: 'KEF',
    name: 'LS60 Wireless',
    price: 7000,
    category: 'speaker',
    architecture: 'Active wireless floorstander, 12th-gen Uni-Q coaxial driver, 4x class D amps per speaker (1400W total system), DSP crossovers, built-in streaming',
    subcategory: 'floorstanding',
    priceTier: 'upper-mid',
    brandScale: 'established',
    region: 'europe',
    country: 'GB',
    topology: 'class-d',
    activeAmplification: true,
    archetypes: { primary: 'precision_explicit', secondary: 'spatial_holographic' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'airy',
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'DSP-controlled crossovers eliminate passive crossover phase issues. Uni-Q coaxial provides coherent wavefront. Clean, controlled presentation.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'composure', level: 'emphasized' },
        { trait: 'speed', level: 'present' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.85, warmth: 0.3, tonal_density: 0.55,
      speed: 0.75, dynamics: 0.8, flow: 0.6,
      spatial_precision: 0.9, composure: 0.85, texture: 0.6,
      fatigue_risk: 0.1, glare_risk: 0.05,
      elasticity: 0.45,
    },
    description: 'Active wireless floorstander with 12th-gen Uni-Q coaxial driver and DSP crossovers. 1400W total system power from 4 class D amps per speaker. The Uni-Q places the tweeter at the acoustic centre of the midrange cone — point-source imaging with wide controlled dispersion. DSP crossovers provide phase-linear driver integration that passive crossovers cannot achieve. Built-in streaming eliminates the need for separate electronics.',
    retailer_links: [
      { label: 'KEF', url: 'https://www.kef.com/products/ls60-wireless' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'spatial', tendency: 'Uni-Q coaxial produces point-source imaging with wide, controlled dispersion — precise stereo image across a wide listening area', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'neutral, DSP-controlled — flat frequency response with room correction capability', basis: 'review_consensus' },
        { domain: 'dynamics', tendency: '1400W total system power provides headroom for dynamic peaks without compression', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'in rooms with DSP room correction engaged', effect: 'bass integration and room modes are actively managed — cleaner low-frequency response than passive alternatives', valence: 'positive', basis: 'review_consensus' },
        { condition: 'for listeners who value component tunability', effect: 'the all-in-one design eliminates amp/cable/DAC matching — either a feature or a limitation depending on priorities', valence: 'neutral', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'all-in-one convenience, DSP precision, point-source imaging, massive power reserves, room correction', cost: 'component upgrade path eliminated, tonal tunability limited to DSP settings, box coloration present in floorstander format', relative_to: 'passive speakers + separate amplification', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Darko.Audio', note: 'John Darko\'s personal speaker. Two-part video review.', url: 'https://darko.audio/2022/05/kef-ls60-wireless-video-review-part-1/' },
      { source: 'KEF', note: 'Manufacturer product page.', url: 'https://www.kef.com/products/ls60-wireless' },
    ],
    notes: 'The LS60 is KEF\'s all-in-one statement — 12th-gen Uni-Q, DSP crossovers, 1400W amplification, streaming, and room correction in a single pair of speakers. No external electronics required.',
    philosophy: 'neutral',
    marketType: 'traditional',
  },

  // ── KEF LSX II (UK — active desktop) ───────────────────

  {
    id: 'kef-lsx-ii',
    brand: 'KEF',
    name: 'LSX II',
    price: 999,
    category: 'speaker',
    architecture: 'Active wireless bookshelf, 11th-gen Uni-Q coaxial driver, class D amplification, DSP crossovers, built-in streaming',
    subcategory: 'standmount',
    priceTier: 'mid',
    brandScale: 'established',
    region: 'europe',
    country: 'GB',
    topology: 'class-d',
    activeAmplification: true,
    archetypes: { primary: 'precision_explicit' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'closed',
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Small Uni-Q driver provides coherent presentation. DSP crossover keeps phase clean. Desktop-optimized voicing.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'composure', level: 'present' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.7, warmth: 0.3, tonal_density: 0.45,
      speed: 0.65, dynamics: 0.5, flow: 0.55,
      spatial_precision: 0.7, composure: 0.65, texture: 0.45,
      fatigue_risk: 0.1, glare_risk: 0.05,
      elasticity: 0.4,
    },
    description: 'Compact active wireless speaker with 11th-gen Uni-Q coaxial and DSP crossovers. Optimized for desktop and nearfield listening. Same Uni-Q point-source principle as LS60 but smaller driver limits bass extension and dynamic scale. Built-in streaming and wireless connectivity make it a complete desktop system.',
    retailer_links: [
      { label: 'KEF', url: 'https://www.kef.com/products/lsx-ii' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'spatial', tendency: 'Uni-Q provides precise nearfield imaging — point-source coherence works well at desktop distances', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'neutral, slightly lean in the bass — small driver limits low-frequency extension below ~50Hz', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'on a desktop at nearfield distances (1-2m)', effect: 'designed for this use case — imaging and tonal balance are optimized for close listening', valence: 'positive', basis: 'review_consensus' },
        { condition: 'in a larger room as primary speakers', effect: 'bass extension and dynamic scale are insufficient — a subwoofer or larger speakers are needed', valence: 'caution', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'compact all-in-one desktop system, Uni-Q imaging, wireless streaming, DSP precision', cost: 'bass extension, dynamic scale, and power handling of larger speakers', relative_to: 'passive bookshelf speakers + separate amplification', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Darko.Audio', note: 'Video review of desktop all-in-one speaker.', url: 'https://darko.audio/2022/11/kef-lsx-ii-video-review/' },
      { source: 'KEF', note: 'Manufacturer product page.', url: 'https://www.kef.com/products/lsx-ii' },
    ],
    notes: 'The LSX II is KEF\'s desktop solution — Uni-Q imaging in a compact package with full streaming capability. No external electronics needed for a complete desktop system.',
    philosophy: 'neutral',
    marketType: 'traditional',
  },

  // ── Mission MS-50 (UK — vintage value bookshelf) ───────

  {
    id: 'mission-ms-50',
    brand: 'Mission',
    name: 'MS-50',
    price: 100,
    category: 'speaker',
    architecture: '2-way front-ported, 4-inch midbass + 1-inch silk dome tweeter, 50W continuous, 6Ω',
    subcategory: 'standmount',
    priceTier: 'budget',
    brandScale: 'established',
    region: 'europe',
    country: 'GB',
    topology: 'bass-reflex',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'elastic',
      airy_closed: 'closed',
    },
    fatigueAssessment: {
      risk: 'very_low',
      notes: 'Silk dome tweeter and warm voicing are inherently non-fatiguing. Forgiving of source quality.',
    },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'medium',
      tendencies: [
        { trait: 'warmth', level: 'emphasized' },
        { trait: 'flow', level: 'emphasized' },
        { trait: 'tonal_density', level: 'present' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.45, warmth: 0.7, tonal_density: 0.65,
      speed: 0.45, dynamics: 0.5, flow: 0.7,
      spatial_precision: 0.4, composure: 0.5, texture: 0.6,
      fatigue_risk: 0.0, glare_risk: 0.0,
      elasticity: 0.55,
    },
    description: 'Vintage British bookshelf with warm, laid-back character from a silk dome tweeter and front-ported 4-inch midbass. Originally bundled with Denon mini systems, now recognized as a standout value on the used market. The 6Ω impedance and 50W handling make them easy to drive with modest amplification. Compact dimensions suit desktop, bedroom, and small-room use. The warm tonal balance and forgiving nature make them ideal for casual listening and non-audiophile entry points.',
    retailer_links: [],
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'tonality', tendency: 'warm, laid-back — silk dome tweeter rolls off gently, avoiding harshness. Front port adds bass weight relative to size', basis: 'listener_consensus' },
        { domain: 'dynamics', tendency: 'modest dynamic range from 4-inch driver — adequate for nearfield and low-to-moderate volumes, not for large rooms', basis: 'listener_consensus' },
        { domain: 'timing', tendency: 'relaxed, musical phrasing — prioritises flow over transient precision', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'paired with warm vintage receivers or tube amplification', effect: 'warmth compounds — pleasant and immersive at low volumes but can become too soft for critical listening', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in small rooms or desktop nearfield', effect: 'designed for this scale — the compact front-ported design works well close to walls', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in large rooms or at high volumes', effect: 'the 4-inch driver runs out of headroom — dynamic compression and bass distortion appear', valence: 'caution', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'exceptional value, warm non-fatiguing presentation, compact size, easy to drive, forgiving of sources', cost: 'bass extension, dynamic range, detail retrieval, and staging precision of larger or more expensive speakers', relative_to: 'modern bookshelf speakers ($200-500)', basis: 'listener_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Head-Fi', note: 'Thread discussing the MS-50\'s warm character and value.', url: 'https://www.head-fi.org/threads/mission-ms-50s-why-do-i-love-them-so.951621/' },
      { source: 'eBay', note: 'Used market listings — typical prices $75-150.', url: 'https://www.ebay.com/sch/i.html?_nkw=Mission+MS-50' },
    ],
    notes: 'Originally bundled with Denon DM-30S and DM-50S mini systems. Favorite bargain speaker of the Audio XX editor — and spotted in a Geese music video. The MS-50 has developed a cult following for its warm, musical character at a fraction of the cost of purpose-built audiophile bookshelf speakers. Best suited as an entry point, gift speaker, or casual listening solution. Previously available for $50-75; rising recognition has pushed used prices to $75-150.',
    philosophy: 'warmth',
    marketType: 'value',
  },
];
