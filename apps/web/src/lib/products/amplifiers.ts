/**
 * Amplifier product catalog for shopping recommendations.
 *
 * Trait values describe sonic character on the 0–1 scale matching QUALITATIVE_MAP:
 *   strong = 1.0, moderate = 0.7, slight = 0.4, neutral = 0.0
 *
 * Amplifier-relevant traits:
 *   flow          — musical continuity and phrasing coherence
 *   tonal_density — harmonic weight and body
 *   clarity       — transparency and lack of veiling
 *   dynamics      — macro/micro dynamic contrast
 *   composure     — ability to stay controlled under pressure
 *   texture       — tactile detail, grain of instruments
 *   warmth        — lower midrange / upper bass fullness
 *   speed         — transient leading-edge definition
 *   elasticity    — rhythmic flexibility and bounce
 *   spatial_precision — imaging specificity and staging coherence
 *   fatigue_risk  — tendency toward listening fatigue (higher = riskier)
 *   glare_risk    — tendency toward upper-frequency harshness (higher = riskier)
 *
 * Prices are approximate USD street prices (new or typical used as noted).
 * Products marked availability: 'discontinued' or 'vintage' use usedPriceRange.
 */

import type { Product } from './dacs';

export const AMPLIFIER_PRODUCTS: Product[] = [
  // ── Single-Ended Triode (SET) ──────────────────────────

  {
    id: 'decware-se84ufo',
    brand: 'Decware',
    name: 'SE84UFO',
    price: 3200,
    category: 'amplifier',
    architecture: 'Single-ended triode, SV83 output tubes',
    subcategory: 'integrated-amp',
    priceTier: 'upper-mid',
    brandScale: 'boutique',
    region: 'north-america',
    country: 'US',
    topology: 'set',
    archetypes: { primary: 'flow_organic', secondary: 'tonal_saturated' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'elastic',
      airy_closed: 'airy',
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'SET topology inherently gentle on the ear. Designed for extended listening at moderate levels.',
    },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'warmth', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'clarity', level: 'less_emphasized' },
        { trait: 'composure', level: 'less_emphasized' },
        { trait: 'speed', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 1.0,
      tonal_density: 1.0,
      clarity: 0.4,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 1.0,
      composure: 0.4,
      warmth: 1.0,
      speed: 0.4,
      spatial_precision: 0.7,
      elasticity: 0.7,
    },
    description:
      'Hand-built single-ended triode integrated from Illinois. 2–3 watts of pure SET midrange magic. Requires high-efficiency speakers (94dB+) but rewards with extraordinary tonal density, texture, and musical flow. Long wait times — built to order.',
    retailer_links: [
      { label: 'Decware', url: 'https://www.decware.com/newsite/SE84UFO3.html' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'dense, saturated midrange with natural warmth — instruments have body and weight', basis: 'listener_consensus' },
        { domain: 'texture', tendency: 'extraordinary tactile detail — the kind of micro-texture that makes you hear the rosin on the bow', basis: 'listener_consensus' },
        { domain: 'timing', tendency: 'unhurried musical flow that lets phrases breathe — rhythm emerges from the music rather than being imposed', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'paired with high-efficiency speakers (94dB+)', effect: 'the low wattage comes alive — full dynamic range and spatial scale from minimal power', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'paired with speakers below 90dB efficiency', effect: 'dynamic compression and bass control suffer — the amp is out of its comfort zone', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'midrange purity, tonal density, and listening intimacy', cost: 'low power limits speaker choices, bass authority, and macro dynamics', relative_to: 'push-pull tube or solid-state designs', basis: 'listener_consensus' },
      ],
    },
    notes: 'Requires 94dB+ speakers. Wait times can exceed 6 months. The experience is deeply personal — either it clicks or it doesn\'t.',
  },

  {
    id: 'linear-tube-audio-z10',
    brand: 'Linear Tube Audio',
    name: 'Z10',
    price: 2400,
    category: 'amplifier',
    architecture: 'ZOTL (Zero-hysteresis OTL) tube circuit',
    subcategory: 'integrated-amp',
    priceTier: 'upper-mid',
    brandScale: 'boutique',
    region: 'north-america',
    country: 'US',
    topology: 'set',
    archetypes: { primary: 'spatial_holographic', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'elastic',
      airy_closed: 'airy',
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Unusually transparent for a tube design. No fatigue risk — the lack of output transformer keeps the presentation open and unforced.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'flow', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'clarity', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'warmth', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 1.0,
      tonal_density: 0.7,
      clarity: 0.7,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 1.0,
      composure: 0.7,
      warmth: 0.4,
      speed: 0.7,
      spatial_precision: 1.0,
      elasticity: 0.7,
    },
    description:
      'David Berning-derived ZOTL circuit — output transformerless tube design that delivers tube texture and spatial holography without the typical trade-offs. ~1W into 8Ω demands efficient speakers, but the clarity and spatial coherence are exceptional for the topology.',
    retailer_links: [
      { label: 'Linear Tube Audio', url: 'https://lineartubeaudio.com/products/z10-integrated' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'spatial', tendency: 'holographic staging with precise image placement — the OTL topology eliminates transformer-related spatial compression', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'remarkable micro-detail retrieval with tube-like dimensionality — textures feel three-dimensional', basis: 'listener_consensus' },
        { domain: 'timing', tendency: 'agile and fleet-footed — unusual speed for a tube amp, with natural musical flow', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with efficient speakers (90dB+)', effect: 'the spatial precision and texture emerge fully — the low power is sufficient for intimate to moderate listening', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'paired with planars or low-impedance speakers', effect: 'impedance mismatch can limit current delivery — the ZOTL circuit works best with higher-impedance loads', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'spatial precision, textural detail, and tube tonality without transformer coloration', cost: 'very low power and limited speaker compatibility', relative_to: 'conventional push-pull tube designs', basis: 'review_consensus' },
      ],
    },
    notes: 'Very low power (~1W @ 8Ω). Best with speakers 90dB+ and 8Ω+. The Berning ZOTL circuit is unlike conventional tube amps — audition expectations accordingly.',
  },

  // ── Push-Pull Tube ────────────────────────────────────

  {
    id: 'leben-cs300',
    brand: 'Leben',
    name: 'CS300',
    price: 2800,
    category: 'amplifier',
    architecture: 'Push-pull tube, EL84 output',
    subcategory: 'integrated-amp',
    priceTier: 'upper-mid',
    brandScale: 'specialist',
    region: 'japan',
    country: 'JP',
    topology: 'push-pull-tube',
    archetypes: { primary: 'rhythmic_propulsive', secondary: 'tonal_saturated' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'neutral',
      elastic_controlled: 'elastic',
      airy_closed: 'neutral',
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Musical and warm — designed for engagement rather than analysis. Long-session friendly.',
    },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'flow', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'warmth', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'elasticity', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'composure', level: 'less_emphasized' },
        { trait: 'spatial_precision', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 1.0,
      tonal_density: 1.0,
      clarity: 0.7,
      dynamics: 1.0,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.7,
      composure: 0.4,
      warmth: 0.7,
      speed: 0.7,
      spatial_precision: 0.4,
      elasticity: 0.7,
    },
    description:
      'Japanese push-pull tube integrated that defined a generation of desktop audiophile systems. ~15W of EL84 power with extraordinary rhythmic drive, tonal richness, and musical involvement. The kind of amp people keep for decades.',
    retailer_links: [
      { label: 'Leben', url: 'https://www.leben-hifi.com/cs300xs.html' },
      { label: 'Tone Imports', url: 'https://toneimports.com/leben/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'timing', tendency: 'insistent rhythmic drive — music has forward momentum and toe-tapping energy', basis: 'listener_consensus' },
        { domain: 'tonality', tendency: 'rich, warm midrange with harmonic density — vocals and acoustic instruments glow', basis: 'listener_consensus' },
        { domain: 'dynamics', tendency: 'punchy and expressive — macro dynamics belie the modest power rating', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with efficient speakers (88dB+)', effect: 'the 15 watts deliver full dynamic range with natural warmth — a classic pairing archetype', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in systems already warm or dense', effect: 'can compound warmth — may reduce clarity and transient speed', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'rhythmic engagement, midrange density, and long-term musical satisfaction', cost: 'ultimate composure, bass control, and power headroom', relative_to: 'solid-state integrated designs', basis: 'listener_consensus' },
      ],
    },
    sourceReferences: [
      { source: '6moons', note: 'Extensive review covering the CS300\'s musical character and EL84 voicing.' },
      { source: 'Stereophile', note: 'Ken Micallef review praising rhythmic engagement and tonal richness.' },
    ],
  },

  {
    id: 'leben-cs600x',
    brand: 'Leben',
    name: 'CS600X',
    price: 6200,
    category: 'amplifier',
    architecture: 'Push-pull tube, KT77/KT88/EL34 output (user-swappable)',
    subcategory: 'integrated-amp',
    priceTier: 'upper-mid',
    brandScale: 'specialist',
    region: 'japan',
    country: 'JP',
    topology: 'push-pull-tube',
    archetypes: { primary: 'rhythmic_propulsive', secondary: 'tonal_saturated' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'neutral',
      elastic_controlled: 'elastic',
      airy_closed: 'neutral',
      // Tube-dependent: KT77 shifts toward speed and control,
      // EL34 toward warmth and density, KT88 toward power and extension.
      warm_bright_n: -1,
      smooth_detailed_n: 0,
      elastic_controlled_n: -1,
      airy_closed_n: 0,
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Musical and warm — designed for long-term engagement. Tube rolling significantly alters voicing but fatigue risk remains low across all compatible tubes.',
    },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'flow', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'rhythm', level: 'emphasized' },
        { trait: 'warmth', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'speed', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'composure', level: 'less_emphasized' },
        { trait: 'spatial_precision', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 1.0,
      tonal_density: 1.0,
      clarity: 0.7,
      dynamics: 1.0,
      rhythm: 1.0,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.7,
      composure: 0.4,
      warmth: 0.7,
      speed: 0.7,
      spatial_precision: 0.4,
      openness: 0.7,
    },
    description:
      'Leben\'s flagship push-pull tube integrated. ~32W with switchable output tube compatibility (KT77, KT88, EL34) that meaningfully changes voicing. Extraordinary rhythmic drive, tonal density, and midrange authority. One of the most celebrated pairings in modern audio with the DeVore O/96. Tube rolling is central to the experience.',
    retailer_links: [
      { label: 'Leben', url: 'https://www.leben-hifi.com/cs600x.html' },
      { label: 'Tone Imports (US)', url: 'https://toneimports.com/leben/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'timing', tendency: 'insistent rhythmic drive with more power and authority than the CS300 — music has forward momentum and physical energy', basis: 'listener_consensus' },
        { domain: 'tonality', tendency: 'rich, warm midrange with harmonic density — vocals and acoustic instruments glow with body and presence', basis: 'listener_consensus' },
        { domain: 'dynamics', tendency: 'punchy and powerful — the ~32W output delivers convincing macro dynamics with high-efficiency speakers', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with DeVore O/96', effect: 'one of the most celebrated pairings in modern high-efficiency audio — strong musical flow, natural tonality, and non-fatiguing presentation', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'with KT77 output tubes', effect: 'tighter bass, faster transients, and a slightly more modern voicing than EL34 — shifts the balance toward speed without losing warmth', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'with EL34 output tubes', effect: 'classic tube sweetness with more midrange bloom and harmonic richness — the warmest voicing option', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in systems already warm or dense', effect: 'can compound warmth and density — may reduce clarity and transient articulation', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'rhythmic engagement, midrange density, dynamic authority, and tube-rolling versatility', cost: 'ultimate composure, absolute bass control, and analytical transparency', relative_to: 'solid-state integrated designs in the same price range', basis: 'listener_consensus' },
      ],
    },
    sourceReferences: [
      { source: '6moons', note: 'Review covering the CS600X\'s musical authority and tube-rolling potential.' },
      { source: 'Tone Publications', note: 'Detailed coverage of the Leben + DeVore pairing and tube rolling options.' },
    ],
  },

  {
    id: 'scott-222b',
    brand: 'Scott',
    name: '222B / 222C',
    price: 1200,
    category: 'amplifier',
    architecture: 'Push-pull tube, 7189 / EL84 output (vintage)',
    subcategory: 'integrated-amp',
    priceTier: 'mid-fi',
    brandScale: 'mainstream',
    region: 'north-america',
    country: 'US',
    topology: 'push-pull-tube',
    availability: 'vintage',
    typicalMarket: 'used',
    usedPriceRange: { low: 600, high: 1800 },
    archetypes: { primary: 'flow_organic', secondary: 'tonal_saturated' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'elastic',
      airy_closed: 'neutral',
      // Founder reference calibration
      warm_bright_n: -2,         // Strong tonal density and harmonic richness
      smooth_detailed_n: -1,     // Smooth, flowing — detail is present but not foregrounded
      elastic_controlled_n: -1,  // Musical and elastic — not rigid or overdamped
      airy_closed_n: 0,          // Neutral staging
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Classic American tube warmth. Inherently relaxed and easy on the ear.',
    },
    tendencyProfile: {
      basis: 'founder_reference',
      confidence: 'founder_reference',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'warmth', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'texture', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'clarity', level: 'less_emphasized' },
        { trait: 'speed', level: 'less_emphasized' },
        { trait: 'composure', level: 'less_emphasized' },
        { trait: 'spatial_precision', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 1.0,
      tonal_density: 1.0,
      clarity: 0.4,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.7,
      composure: 0.4,
      warmth: 1.0,
      speed: 0.4,
      spatial_precision: 0.4,
      elasticity: 0.4,
    },
    description:
      'Vintage American tube integrated from the golden era of hi-fi (~1960s). When properly restored, delivers a warm, flowing, musically engaging sound that defines the "classic tube" experience. Used prices vary widely based on condition and restoration quality.',
    retailer_links: [
      { label: 'HiFi Shark (used)', url: 'https://www.hifishark.com/search?q=scott+222' },
      { label: 'Audiomart', url: 'https://www.usaudiomart.com/' },
    ],
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'tonality', tendency: 'classic American tube warmth — rich midrange, generous body, soft edges', basis: 'listener_consensus' },
        { domain: 'timing', tendency: 'relaxed, unhurried musical flow — prioritises comfort over precision', basis: 'listener_consensus' },
        { domain: 'texture', tendency: 'smooth, rounded textures — detail is presented gently rather than incisively', basis: 'editorial_inference' },
      ],
      interactions: [
        { condition: 'with efficient vintage or modern speakers', effect: 'the classic hi-fi pairing — warm, musical, and deeply engaging for vocal and acoustic music', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'with modern analytical speakers', effect: 'can provide welcome warmth and body — but may limit transparency and bass control', valence: 'neutral', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'classic tube warmth, musical engagement, and vintage charm', cost: 'precision, bass control, and the need for careful restoration and tube matching', relative_to: 'modern tube or solid-state integrated amps', basis: 'listener_consensus' },
      ],
    },
    notes: 'Vintage product — condition and restoration quality vary enormously. Budget for professional servicing if buying unrestored. Tube complement affects the sound significantly.',
  },

  // ── Class A Solid-State ────────────────────────────────

  {
    id: 'schiit-aegir',
    brand: 'Schiit',
    name: 'Aegir',
    price: 799,
    category: 'amplifier',
    architecture: 'Continuity™ Class A / Class AB solid-state',
    subcategory: 'power-amp',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'north-america',
    country: 'US',
    topology: 'class-a-solid-state',
    archetypes: { primary: 'precision_explicit', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'neutral',
      elastic_controlled: 'controlled',
      airy_closed: 'neutral',
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Clean and composed — no grain, no edge. The Class A bias keeps the presentation smooth even at higher power.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'composure', level: 'emphasized' },
        { trait: 'clarity', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'speed', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'warmth', level: 'less_emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 0.7,
      tonal_density: 0.4,
      clarity: 0.7,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.7,
      composure: 1.0,
      warmth: 0.4,
      speed: 0.7,
      spatial_precision: 0.7,
      elasticity: 0.4,
    },
    description:
      'Schiit\'s Continuity circuit in a compact power amp. 20W Class A into 8Ω, bridgeable to mono. Clean, composed, and transparent — lets upstream components define the character. Exceptional value for Class A refinement.',
    retailer_links: [
      { label: 'Schiit', url: 'https://www.schiit.com/products/aegir' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'dynamics', tendency: 'composed and controlled — dynamics are clean and proportional rather than exaggerated', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'neutral to slightly lean — the amp itself doesn\'t add warmth or density, it reveals the source', basis: 'listener_consensus' },
        { domain: 'texture', tendency: 'smooth grain structure with good micro-detail — Class A refinement without Class A coloration', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with warm or dense sources', effect: 'the transparency lets upstream character pass through intact — a good complement to R2R DACs', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'paired with inefficient speakers', effect: '20W limits macro dynamics in larger rooms — consider bridged pair for demanding loads', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'Class A refinement, composure, and transparency at an exceptional price', cost: 'limited power, no preamp section, and a lean tonal character', relative_to: 'tube integrated or Class AB power amps', basis: 'review_consensus' },
      ],
    },
    notes: 'Power amp only — requires a preamp or DAC with volume control. Bridgeable to ~80W mono for more demanding speakers.',
  },

  {
    id: 'first-watt-sit-3',
    brand: 'First Watt',
    name: 'SIT-3',
    price: 4000,
    category: 'amplifier',
    architecture: 'Static Induction Transistor (SIT), single-ended Class A',
    subcategory: 'power-amp',
    priceTier: 'upper-mid',
    brandScale: 'boutique',
    region: 'north-america',
    country: 'US',
    topology: 'class-a-solid-state',
    availability: 'discontinued',
    typicalMarket: 'used',
    usedPriceRange: { low: 3000, high: 5000 },
    archetypes: { primary: 'flow_organic', secondary: 'spatial_holographic' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'detailed',
      elastic_controlled: 'elastic',
      airy_closed: 'airy',
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'The SIT topology produces a uniquely organic presentation — no listening fatigue. The single-ended Class A operation adds natural warmth.',
    },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'warmth', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'composure', level: 'less_emphasized' },
        { trait: 'speed', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 1.0,
      tonal_density: 0.7,
      clarity: 0.7,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 1.0,
      composure: 0.4,
      warmth: 0.7,
      speed: 0.4,
      spatial_precision: 1.0,
      elasticity: 0.7,
    },
    description:
      'Nelson Pass\'s single-ended Class A amplifier using rare Static Induction Transistors — solid-state devices that behave like triode tubes. 18W into 8Ω. Produces the spatial holography and textural richness of SET tubes with solid-state reliability. Discontinued — available used.',
    retailer_links: [
      { label: 'First Watt', url: 'https://www.firstwatt.com/sit3.html' },
      { label: 'HiFi Shark (used)', url: 'https://www.hifishark.com/search?q=first+watt+sit-3' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'texture', tendency: 'extraordinary tactile quality — the SIT topology produces textures that feel tangible and three-dimensional', basis: 'listener_consensus' },
        { domain: 'spatial', tendency: 'holographic staging with tube-like image density — instruments have presence and dimensional weight', basis: 'listener_consensus' },
        { domain: 'timing', tendency: 'relaxed, organic flow — music breathes naturally without mechanical precision', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with efficient, benign-load speakers', effect: 'the SIT character emerges fully — spatial magic and textural richness', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'with difficult speaker loads', effect: '18W into 8Ω with limited current — demanding speakers will restrict dynamics and control', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'tube-like spatial magic and texture in a solid-state chassis', cost: 'limited power, speaker sensitivity requirements, and discontinued status', relative_to: 'conventional Class A solid-state or tube SET amps', basis: 'listener_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Stereophile', note: 'Herb Reichert review praising the SIT-3\'s unique sonic character.' },
      { source: '6moons', note: 'Review covering the SIT topology\'s distinctive tube-like qualities.' },
    ],
    notes: 'Power amp only. Discontinued — SIT transistors are no longer manufactured. Prices rising on used market.',
  },

  // ── Class AB Solid-State ───────────────────────────────

  {
    id: 'hegel-h190',
    brand: 'Hegel',
    name: 'H190',
    price: 2995,
    category: 'amplifier',
    architecture: 'Class AB solid-state with SoundEngine2, integrated DAC',
    subcategory: 'integrated-amp',
    priceTier: 'upper-mid',
    brandScale: 'specialist',
    region: 'europe',
    country: 'NO',
    topology: 'class-ab-solid-state',
    archetypes: { primary: 'precision_explicit', secondary: 'rhythmic_propulsive' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'neutral',
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Well-balanced and composed. The SoundEngine topology keeps distortion low without making the presentation sterile.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'composure', level: 'emphasized' },
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'speed', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'warmth', level: 'less_emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 0.7,
      tonal_density: 0.4,
      clarity: 1.0,
      dynamics: 1.0,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.7,
      composure: 1.0,
      warmth: 0.4,
      speed: 0.7,
      spatial_precision: 0.7,
      elasticity: 0.4,
    },
    description:
      'Norwegian integrated with 150W into 8Ω, built-in DAC, and Hegel\'s proprietary SoundEngine2 topology. Clear, dynamic, and composed — a reference-class all-in-one for listeners who value control and transparency.',
    retailer_links: [
      { label: 'Hegel', url: 'https://www.hegel.com/products/integrated-amplifiers/h190' },
      { label: 'Crutchfield', url: 'https://www.crutchfield.com/p_839H190/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'dynamics', tendency: 'authoritative current delivery — dynamic contrasts are rendered with ease and control', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'neutral to slightly lean — transparency is the priority, not warmth', basis: 'listener_consensus' },
        { domain: 'timing', tendency: 'precise and controlled — transients are clean, timing is tight', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with warm or dense speakers', effect: 'the neutrality provides excellent complementary balance — warmth from speakers, control from the amp', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in systems already lean or bright', effect: 'may compound leanness — consider a warmer source or warmer speakers', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'control, clarity, power, and all-in-one convenience with built-in DAC', cost: 'tonal density and harmonic richness of tube or Class A designs', relative_to: 'tube or pure Class A amplifiers', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'What Hi-Fi?', note: 'Five-star review praising composure and dynamic authority.' },
      { source: 'Stereophile', note: 'Review noting the H190\'s transparent, grip-oriented character.' },
    ],
  },

  // ── Minimalist / Reference Anchors ─────────────────────

  {
    id: 'job-integrated',
    brand: 'JOB',
    name: 'Integrated',
    price: 1699,
    category: 'amplifier',
    architecture: 'Goldmund-derived minimalist Class AB solid-state',
    subcategory: 'integrated-amp',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'europe',
    country: 'CH',
    topology: 'class-ab-solid-state',
    availability: 'discontinued',
    typicalMarket: 'used',
    usedPriceRange: { low: 800, high: 1500 },
    archetypes: { primary: 'precision_explicit', secondary: 'rhythmic_propulsive' },
    primaryAxes: {
      warm_bright: 'bright',
      smooth_detailed: 'detailed',
      elastic_controlled: 'elastic',
      airy_closed: 'airy',
      // Founder reference calibration
      warm_bright_n: 1,         // Fast, vivid — bright side of neutral
      smooth_detailed_n: 2,     // Highly articulate and detailed — defining trait
      elastic_controlled_n: -1, // Elastic, lively — not overdamped
      airy_closed_n: -1,        // Open, spacious presentation
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Extremely clean circuit — no grain, no edge. The minimalist topology strips away coloration.',
    },
    tendencyProfile: {
      basis: 'founder_reference',
      confidence: 'founder_reference',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'speed', level: 'emphasized' },
        { trait: 'composure', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'tonal_density', level: 'less_emphasized' },
        { trait: 'warmth', level: 'less_emphasized' },
        { trait: 'texture', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 0.7,
      tonal_density: 0.4,
      clarity: 1.0,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.4,
      composure: 0.7,
      warmth: 0.4,
      speed: 1.0,
      spatial_precision: 0.7,
      elasticity: 0.7,
    },
    description:
      'Goldmund-derived minimalist integrated — the shortest signal path philosophy applied to an affordable chassis. Astonishingly fast, clean, and transparent. Discontinued but available used and a touchstone for the "less is more" amplifier design school.',
    retailer_links: [
      { label: 'HiFi Shark (used)', url: 'https://www.hifishark.com/search?q=job+integrated' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'timing', tendency: 'exceptionally fast and agile — transients arrive with zero hesitation', basis: 'listener_consensus' },
        { domain: 'tonality', tendency: 'stripped-back neutrality — no added warmth, no coloration, just what the source sends', basis: 'listener_consensus' },
        { domain: 'texture', tendency: 'clean and grain-free but not rich — texture is honest rather than lush', basis: 'editorial_inference' },
      ],
      interactions: [
        { condition: 'paired with warm or dense sources and speakers', effect: 'the speed and transparency let upstream warmth through without softening it', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in systems already lean or analytical', effect: 'may feel too bare — the minimalist approach doesn\'t add body or richness', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'speed, transparency, and minimalist purity', cost: 'tonal richness, harmonic density, and the body that some music demands', relative_to: 'tube or thick-sounding solid-state designs', basis: 'listener_consensus' },
      ],
    },
    notes: 'Discontinued. Goldmund-derived circuit at a fraction of the Goldmund price. Used market is the only option.',
  },

  {
    id: 'goldmund-job-225',
    brand: 'Goldmund / JOB',
    name: 'JOB 225',
    price: 1500,
    category: 'amplifier',
    architecture: 'Goldmund minimalist Class AB solid-state',
    subcategory: 'power-amp',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'europe',
    country: 'CH',
    topology: 'class-ab-solid-state',
    availability: 'discontinued',
    typicalMarket: 'used',
    usedPriceRange: { low: 700, high: 1400 },
    archetypes: { primary: 'precision_explicit', secondary: 'rhythmic_propulsive' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'elastic',
      airy_closed: 'neutral',
      // Founder reference calibration
      warm_bright_n: 0,            // Transparent, neither warm nor bright
      smooth_detailed_n: 1,        // Revealing and explicit
      elastic_controlled_n: -1,    // Fast and elastic — minimal damping philosophy
      airy_closed_n: 0,            // Neutral staging openness
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'The Goldmund circuit at its purest — ultra-clean, ultra-fast. No fatigue mechanism.',
    },
    tendencyProfile: {
      basis: 'founder_reference',
      confidence: 'founder_reference',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'speed', level: 'emphasized' },
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'composure', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'tonal_density', level: 'less_emphasized' },
        { trait: 'warmth', level: 'less_emphasized' },
        { trait: 'texture', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 0.7,
      tonal_density: 0.4,
      clarity: 1.0,
      dynamics: 1.0,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.4,
      composure: 0.7,
      warmth: 0.4,
      speed: 1.0,
      spatial_precision: 0.7,
      elasticity: 0.7,
    },
    description:
      'The original Goldmund-derived minimalist power amp that started the JOB phenomenon. 225W into 8Ω from a tiny chassis. Ultra-fast, ultra-clean, and shockingly dynamic for its size and used price. A legendary overachiever on the used market.',
    retailer_links: [
      { label: 'HiFi Shark (used)', url: 'https://www.hifishark.com/search?q=job+225' },
      { label: 'US Audio Mart', url: 'https://www.usaudiomart.com/' },
    ],
    tendencies: {
      confidence: 'founder_reference',
      character: [
        { domain: 'dynamics', tendency: 'explosive dynamic authority from a tiny chassis — 225W of clean, fast power', basis: 'founder_reference' },
        { domain: 'timing', tendency: 'lightning-fast transients — the shortest signal path design philosophy at work', basis: 'founder_reference' },
        { domain: 'tonality', tendency: 'lean, transparent, and honest — no warmth added, no density embellished', basis: 'founder_reference' },
      ],
      interactions: [
        { condition: 'paired with warm DAC and speakers', effect: 'the speed and transparency create an exciting combination — dynamics from the amp, body from the source', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'with lean or bright speakers', effect: 'the transparency can feel thin — the amp doesn\'t compensate for upstream leanness', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'speed, dynamics, and grip from a ridiculous price-to-performance ratio', cost: 'tonal richness, warmth, and the harmonic density of Class A or tube designs', relative_to: 'Class A or tube amplifiers', basis: 'listener_consensus' },
      ],
    },
    sourceReferences: [
      { source: '6moons', note: 'Review of the JOB 225 as a Goldmund-derived giant-killer.' },
    ],
    notes: 'Power amp only — requires preamp. Discontinued. Used prices represent extraordinary value.',
  },

  {
    id: 'crayon-cia-1t',
    brand: 'Crayon Audio',
    name: 'CIA-1T',
    price: 2995,
    category: 'amplifier',
    architecture: 'Current-feedback Class AB solid-state, zero global feedback',
    subcategory: 'integrated-amp',
    priceTier: 'upper-mid',
    brandScale: 'boutique',
    region: 'europe',
    country: 'AT',
    topology: 'class-ab-solid-state',
    availability: 'discontinued',
    typicalMarket: 'both',
    usedPriceRange: { low: 1500, high: 2800 },
    archetypes: { primary: 'rhythmic_propulsive', secondary: 'precision_explicit' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'neutral',
      airy_closed: 'airy',
      // Founder reference calibration
      warm_bright_n: 0,          // Highly balanced — neither warm nor bright
      smooth_detailed_n: 1,      // Strong resolution and detail retrieval
      elastic_controlled_n: 0,   // Balanced — composed but not overdamped
      airy_closed_n: -1,         // Open, airy staging
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Current-feedback design with no global feedback — fast and transparent without grain. Low fatigue risk.',
    },
    tendencyProfile: {
      basis: 'founder_reference',
      confidence: 'founder_reference',
      tendencies: [
        { trait: 'speed', level: 'emphasized' },
        { trait: 'elasticity', level: 'emphasized' },
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'tonal_density', level: 'less_emphasized' },
        { trait: 'warmth', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 0.7,
      tonal_density: 0.4,
      clarity: 1.0,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.7,
      composure: 0.7,
      warmth: 0.4,
      speed: 1.0,
      spatial_precision: 0.7,
      elasticity: 1.0,
    },
    description:
      'Austrian current-feedback integrated with zero global feedback — designed for speed, transparency, and rhythmic precision. 50W into 8Ω with a lively, elastic presentation that makes music feel immediate and alive.',
    retailer_links: [
      { label: 'Crayon Audio', url: 'https://www.crayonaudio.com/' },
      { label: 'HiFi Shark (used)', url: 'https://www.hifishark.com/search?q=crayon+cia' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'timing', tendency: 'exceptionally fast and rhythmically precise — the current-feedback topology delivers leading edges with zero hesitation', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'lean and transparent — music is presented with analytical clarity but not coldness', basis: 'listener_consensus' },
        { domain: 'spatial', tendency: 'open and airy staging — instruments are precisely placed in a spacious soundstage', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'with warm or dense speakers', effect: 'the speed and clarity complement tonal richness — an excellent balance of qualities', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'with bright or analytical speakers', effect: 'may feel lean and over-explicit — the zero-feedback transparency doesn\'t hide upstream issues', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'speed, rhythmic precision, and spatial openness', cost: 'tonal density and the warmth of tube or Class A designs', relative_to: 'tube or conventional Class A solid-state amps', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: '6moons', note: 'Review highlighting the CIA-1T\'s current-feedback speed and rhythmic precision.' },
      { source: 'HiFi+', note: 'Review praising the transparency and spatial presentation.' },
    ],
    notes: 'CIA-1T discontinued but the Crayon CFA-1.2 continues the lineage. Used CIA-1T represents excellent value.',
  },

  {
    id: 'trends-ta-10',
    brand: 'Trends Audio',
    name: 'TA-10',
    price: 99,
    category: 'amplifier',
    architecture: 'Tripath Class-T (TA2024 chip), minimal signal path',
    subcategory: 'integrated-amp',
    priceTier: 'budget',
    brandScale: 'boutique',
    region: 'east-asia',
    country: 'HK',
    topology: 'class-d',
    availability: 'discontinued',
    typicalMarket: 'used',
    usedPriceRange: { low: 50, high: 150 },
    archetypes: { primary: 'rhythmic_propulsive', secondary: 'precision_explicit' },
    primaryAxes: {
      warm_bright: 'bright',
      smooth_detailed: 'detailed',
      elastic_controlled: 'elastic',
      airy_closed: 'airy',
      // Founder reference calibration
      warm_bright_n: 1,            // Lean tonal balance — light but not harsh
      smooth_detailed_n: 1,        // Revealing, explicit micro-detail
      elastic_controlled_n: -2,    // Extremely elastic — very low stored energy
      airy_closed_n: -1,           // Open and lively staging
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'The lean tonal balance might cause restlessness in long sessions for warmth-seekers, but the Tripath circuit itself introduces no glare or grain. Fatigue-free within its design intent.',
    },
    tendencyProfile: {
      basis: 'founder_reference',
      confidence: 'founder_reference',
      tendencies: [
        { trait: 'speed', level: 'emphasized' },
        { trait: 'elasticity', level: 'emphasized' },
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'tonal_density', level: 'less_emphasized' },
        { trait: 'warmth', level: 'less_emphasized' },
        { trait: 'texture', level: 'less_emphasized' },
        { trait: 'composure', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 0.7,
      tonal_density: 0.2,
      clarity: 0.9,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.1,
      texture: 0.3,
      composure: 0.4,
      warmth: 0.2,
      speed: 1.0,
      spatial_precision: 0.6,
      elasticity: 1.0,
    },
    description:
      'Minimalist Tripath Class-T integrated amplifier built around the TA2024 chip. 15W into 4Ω from a palm-sized chassis. Legendary for its speed, transient precision, and elastic rhythmic quality — a genuine reference for what low stored energy sounds like. The TA-10 strips away everything except the signal and became a cult favourite among listeners who value timing over tonal weight.',
    retailer_links: [
      { label: 'HiFi Shark (used)', url: 'https://www.hifishark.com/search?q=trends+ta-10' },
    ],
    tendencies: {
      confidence: 'founder_reference',
      character: [
        { domain: 'timing', tendency: 'extremely fast transient response — among the quickest amplifiers at any price due to the Tripath chip\'s minimal stored energy', basis: 'founder_reference' },
        { domain: 'dynamics', tendency: 'lively and elastic — micro-dynamics are vivid, macro-dynamics limited by low power', basis: 'founder_reference' },
        { domain: 'tonality', tendency: 'lean and transparent — no warmth, no density, no editorial voice. What goes in comes out, lighter', basis: 'founder_reference' },
        { domain: 'spatial', tendency: 'open and airy staging with good image specificity for the price', basis: 'founder_reference' },
      ],
      interactions: [
        { condition: 'paired with high-efficiency speakers (>93dB)', effect: 'the TA-10 comes alive — speed and dynamics are fully expressed without strain', valence: 'positive', basis: 'founder_reference' },
        { condition: 'paired with warm or dense DACs', effect: 'excellent complement — the DAC provides the body the TA-10 doesn\'t add', valence: 'positive', basis: 'founder_reference' },
        { condition: 'with low-sensitivity speakers (<87dB)', effect: 'runs out of headroom quickly — dynamic compression and loss of composure at moderate volumes', valence: 'caution', basis: 'founder_reference' },
        { condition: 'with bright or lean speakers', effect: 'the lean-on-lean combination can feel thin and fatiguing — the TA-10 needs upstream warmth or speaker body to balance', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'speed, transient precision, and elastic rhythmic quality at a near-zero price', cost: 'tonal density, bass authority, power reserves, and the harmonic richness of tube or Class A designs', relative_to: 'conventional integrated amplifiers', basis: 'founder_reference' },
      ],
    },
    sourceReferences: [
      { source: '6moons', note: 'Review establishing the TA-10 as a reference for Tripath/Class-T sonic character.' },
      { source: 'TNT Audio', note: 'Review praising the speed and rhythmic engagement at its price point.' },
    ],
    notes: 'Discontinued. The TA-10 is a founder reference amplifier — used to calibrate what extreme elasticity and low stored energy sound like. 15W limits speaker pairing to high-efficiency designs.',
  },

  // ── Hegel ───────────────────────────────────────────

  {
    id: 'hegel-rost',
    brand: 'Hegel',
    name: 'Rost',
    price: 2000,
    category: 'amplifier',
    architecture: 'Class AB solid-state with SoundEngine, integrated DAC',
    subcategory: 'integrated-amp',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'europe',
    country: 'NO',
    topology: 'class-ab-solid-state',
    archetypes: { primary: 'precision_explicit', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'bright',             // Slightly bright of neutral — clarity and grip prioritised
      smooth_detailed: 'detailed',       // Detail-forward — composure over bloom
      elastic_controlled: 'controlled',  // Strong grip — controlled, not elastic
      airy_closed: 'neutral',           // Neither notably airy nor closed
      // Founder reference calibration
      warm_bright_n: 1,           // Cool-neutral lean
      smooth_detailed_n: 1,       // Detail and composure over smoothness
      elastic_controlled_n: 2,    // Strongly controlled — grip and discipline
      airy_closed_n: 0,           // Neutral spatiality
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Composed and disciplined. No glare or harshness. Control may read as slightly cool but not fatiguing.',
    },
    tendencyProfile: {
      basis: 'founder_reference',
      confidence: 'founder_reference',
      tendencies: [
        { trait: 'composure', level: 'emphasized' },
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'speed', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'tonal_density', level: 'less_emphasized' },
        { trait: 'warmth', level: 'less_emphasized' },
        { trait: 'elasticity', level: 'less_emphasized' },
        { trait: 'texture', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      composure: 1.0,
      clarity: 1.0,
      dynamics: 0.7,
      speed: 0.7,
      spatial_precision: 0.7,
      flow: 0.7,
      tonal_density: 0.4,
      warmth: 0.4,
      texture: 0.4,
      elasticity: 0.0,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Norwegian integrated with 75W into 8Ω, built-in DAC, and Hegel\'s SoundEngine topology. Controlled, composed, and grippy — emphasises bass control, stability, and discipline over elasticity or tonal bloom. Smaller sibling of the H190 with the same house voicing at a lower price and power output.',
    retailer_links: [
      { label: 'Hegel', url: 'https://www.hegel.com/products/integrated-amplifiers/rost' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'dynamics', tendency: 'controlled and composed — grip and order rather than explosive dynamics', basis: 'founder_reference' },
        { domain: 'tonality', tendency: 'cool-neutral — discipline over warmth, composure over bloom', basis: 'founder_reference' },
        { domain: 'timing', tendency: 'tight and disciplined — transient control is the priority', basis: 'founder_reference' },
      ],
      interactions: [
        { condition: 'paired with speakers that need control', effect: 'excellent grip — the Rost disciplines bass and keeps things orderly', valence: 'positive', basis: 'founder_reference' },
        { condition: 'in already controlled or lean systems', effect: 'risk of overdamping — the system may feel too tight and lack organic flow', valence: 'caution', basis: 'founder_reference' },
        { condition: 'paired with warm or elastic speakers', effect: 'good complementary balance — the amp provides control, the speaker provides life', valence: 'positive', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'control, composure, grip, and all-in-one convenience', cost: 'elasticity, organic flow, and the harmonic richness of tube or Class A designs', relative_to: 'tube or single-ended triode amplifiers', basis: 'founder_reference' },
      ],
    },
    sourceReferences: [
      { source: 'Founder listening notes', note: 'Calibrated from extended in-system use. Controlled, grippy, composed, cool-neutral.' },
      { source: 'What Hi-Fi?', note: 'Review praising the Rost\'s composure and value relative to the H190.' },
    ],
    notes: 'Founder reference amplifier. The Rost is the Hegel entry point — same design philosophy as the H190 (control, grip, transparency) at lower power. Good when speakers need discipline; risk of overdamping in already controlled chains.',
  },

  // ── Marantz (vintage) ───────────────────────────────

  {
    id: 'marantz-2220b',
    brand: 'Marantz',
    name: '2220B',
    price: 400,
    category: 'amplifier',
    architecture: 'Class AB solid-state stereo receiver, 20W/ch, vintage 1974–1977',
    subcategory: 'integrated-amp',
    priceTier: 'budget',
    brandScale: 'mainstream',
    region: 'japan',
    country: 'JP',
    topology: 'class-ab-solid-state',
    archetypes: { primary: 'flow_organic', secondary: 'rhythmic_propulsive' },
    primaryAxes: {
      warm_bright: 'warm',            // Classic warm Marantz house sound
      smooth_detailed: 'smooth',      // Relaxed treble, smooth presentation
      elastic_controlled: 'elastic',  // Fluid, musical — not overdamped
      airy_closed: 'closed',          // Intimate, closed-in staging typical of vintage receivers
      // Review-derived calibration
      warm_bright_n: -2,        // Strongly warm — tonal density and midrange body
      smooth_detailed_n: -1,    // Smooth — relaxed treble, not analytical
      elastic_controlled_n: -1, // Elastic — fluid musical presentation
      airy_closed_n: -1,        // Slightly closed — intimate staging
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Very low fatigue risk. The warm, smooth presentation is inherently easy on the ears for extended listening.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'medium',
      tendencies: [
        { trait: 'warmth', level: 'emphasized' },
        { trait: 'flow', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'texture', level: 'present' },
        { trait: 'rhythm', level: 'present' },
        { trait: 'clarity', level: 'less_emphasized' },
        { trait: 'speed', level: 'less_emphasized' },
        { trait: 'spatial_precision', level: 'less_emphasized' },
        { trait: 'composure', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      warmth: 1.0,
      flow: 1.0,
      tonal_density: 1.0,
      texture: 0.7,
      rhythm: 0.7,
      dynamics: 0.4,
      clarity: 0.4,
      speed: 0.4,
      spatial_precision: 0.4,
      composure: 0.4,
      elasticity: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Classic 1970s Marantz stereo receiver with 20W per channel. Warm, smooth, and musically fluid — the archetypal vintage Marantz house sound. Strong midrange tone and excellent tonal density. Limited power and bass control compared to modern designs, but a natural match for high-efficiency speakers where its warmth and flow qualities shine.',
    retailer_links: [],
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'tonality', tendency: 'warm, rich midrange — the Marantz vintage house sound prioritises tonal density and body', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'fluid and musical — relaxed rather than incisive, organic rather than precise', basis: 'review_consensus' },
        { domain: 'dynamics', tendency: 'moderate dynamics limited by 20W power — microdynamics are good but macro headroom is constrained', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with high-efficiency horn speakers', effect: 'excellent synergy — 20W is more than enough, and the warmth and smoothness temper horn brightness and forwardness', valence: 'positive', basis: 'review_consensus' },
        { condition: 'paired with low-sensitivity speakers', effect: 'runs out of headroom quickly — dynamic compression at moderate volumes', valence: 'caution', basis: 'review_consensus' },
        { condition: 'with a neutral or slightly lean digital source', effect: 'the warmth provides natural complementary balance — prevents the system from sounding clinical', valence: 'positive', basis: 'review_consensus' },
        {
          condition: 'in system: Oppo OPDV971H → Marantz 2220B → Hornshoppe Horn',
          effect: 'Ravi Shankar recording produced extremely realistic tabla — strong transient realism, microdynamic expression, and a physical sense of the instrument being present in the room. The horn efficiency unlocks the Marantz\'s midrange qualities without stressing its power limits.',
          valence: 'positive',
          basis: 'founder_reference',
        },
      ],
      tradeoffs: [
        { gains: 'warmth, midrange body, tonal richness, and long-session listening comfort', cost: 'resolution, transient precision, bass control, and the transparency of modern solid-state designs', relative_to: 'modern integrated amplifiers', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Audiokarma community', note: 'Extensive discussion of the 2220B as an entry-level vintage Marantz with the classic warm house sound.' },
      { source: 'Founder system observation', note: 'Oppo → 2220B → Hornshoppe Horn: tabla realism, microdynamic expression, instrument presence.' },
    ],
    notes: 'Vintage receiver (1974–1977). Price reflects typical used market value. May need recapping if original capacitors are still in place — recap can significantly improve clarity without losing the warm character. 20W is sufficient for speakers above 93dB sensitivity.',
  },

  // ── Kinki Studio (China) ────────────────────────────

  {
    id: 'kinki-studio-ex-m1-plus',
    brand: 'Kinki Studio',
    name: 'EX-M1+',
    price: 2898,
    category: 'amplifier',
    architecture: 'Dual-mono Class AB solid-state, 215W @ 8Ω / 290W @ 4Ω',
    subcategory: 'integrated-amp',
    priceTier: 'upper-mid',
    brandScale: 'specialist',
    region: 'asia',
    country: 'CN',
    topology: 'class-ab-solid-state',
    archetypes: { primary: 'precision_explicit', secondary: 'flow_organic' },
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
    fatigueAssessment: {
      risk: 'low',
      notes: 'Neutral presentation without etch or glare. Extended top end is airy, not aggressive. Long-session friendly.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'composure', level: 'emphasized' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'speed', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'warmth', level: 'less_emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 1.0,
      spatial_precision: 1.0,
      composure: 1.0,
      dynamics: 0.7,
      speed: 0.7,
      flow: 0.7,
      texture: 0.7,
      warmth: 0.0,
      tonal_density: 0.4,
      elasticity: 0.4,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Chinese dual-mono integrated with 215W into 8Ω. Strikingly neutral with excellent three-dimensional imaging and composure. Airy, extended top end without etch. Clean, sweet midrange. An exceptional value proposition that competes well above its price class in transparency and spatial precision.',
    retailer_links: [
      { label: 'Vinshine Audio', url: 'https://www.vinshineaudio.com/product/kinki-studio-ex-m1-plus' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'neutral to slightly warm — transparent without analytical coldness', basis: 'review_consensus' },
        { domain: 'dynamics', tendency: 'effortless composure — high power reserves keep dynamics unflustered at all levels', basis: 'review_consensus' },
        { domain: 'spatiality', tendency: 'exceptional depth and imaging — three-dimensional soundstage precision unusual at this price', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with revealing speakers', effect: 'transparency and imaging shine — the amp does not editorialize', valence: 'positive', basis: 'review_consensus' },
        { condition: 'in warm or euphonic systems', effect: 'adds composure and clarity without stripping warmth — a neutral anchor', valence: 'positive', basis: 'review_consensus' },
        { condition: 'paired with already lean or clinical sources', effect: 'may not add the warmth or body some listeners expect — stays honest', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'transparency, imaging, composure, and outstanding value', cost: 'lacks the harmonic density or tonal saturation of tube or Class A designs', relative_to: 'tube amplifiers or Class A solid-state', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'SoundStage! HiFi', note: 'Review praising neutrality and three-dimensional imaging.' },
      { source: '6moons', note: 'Blue Moon award. Noted exceptional composure and spatial depth.' },
    ],
    notes: 'Major value proposition in the $2–4K segment. Dual-mono topology with fully balanced operation. Often compared favorably to amplifiers at 2–3x its price.',
  },

  {
    id: 'kinki-studio-dazzle',
    brand: 'Kinki Studio',
    name: 'Dazzle',
    price: 8000,
    category: 'amplifier',
    architecture: 'Class AB, SSCLD topology, 12 EXICON MOSFETs/channel, 300W @ 8Ω / 560W @ 4Ω',
    subcategory: 'integrated-amp',
    priceTier: 'upper-mid',
    brandScale: 'specialist',
    region: 'asia',
    country: 'CN',
    topology: 'class-ab-solid-state',
    archetypes: { primary: 'precision_explicit', secondary: 'spatial_holographic' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'airy',
      warm_bright_n: 0,
      smooth_detailed_n: 1,
      elastic_controlled_n: 2,
      airy_closed_n: 1,
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Refined extension of EX-M1+ character. Greater authority without aggression.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'medium',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'composure', level: 'emphasized' },
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'speed', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'warmth', level: 'less_emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 1.0,
      composure: 1.0,
      dynamics: 1.0,
      spatial_precision: 1.0,
      speed: 0.7,
      flow: 0.7,
      texture: 0.7,
      warmth: 0.0,
      tonal_density: 0.4,
      elasticity: 0.4,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Flagship Kinki Studio collaboration with Vinshine Audio. 300W into 8Ω via 12 EXICON MOSFETs per channel using their Super Symmetry Current Linear Drive topology. Extends the EX-M1+ house sound — transparency, composure, imaging — with significantly greater power reserves and dynamic authority for demanding speakers.',
    retailer_links: [
      { label: 'Vinshine Audio', url: 'https://www.vinshineaudio.com/' },
    ],
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'dynamics', tendency: 'muscular authority — 560W into 4Ω delivers effortless dynamic headroom', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'transparent and composed — same neutral house sound as EX-M1+ with greater scale', basis: 'review_consensus' },
        { domain: 'spatiality', tendency: 'holographic imaging with wide, deep staging', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with power-hungry speakers', effect: 'excellent grip and dynamic headroom — speakers that need current are well served', valence: 'positive', basis: 'review_consensus' },
        { condition: 'paired with high-efficiency speakers', effect: 'surplus power — the composure and imaging remain excellent but the power advantage is irrelevant', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'authority, grip, composure at scale, transparent imaging', cost: 'tonal warmth and harmonic density of tube or Class A alternatives at this price', relative_to: 'tube or Class A amplifiers in the $5–10K range', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Darko.Audio', note: '2025 coverage of the Dazzle as Kinki\'s flagship MOSFET integrated.' },
    ],
    notes: 'Recent release (2025). Limited review corpus — character inference extrapolated from EX-M1+ lineage and architecture. SSCLD topology is Kinki\'s proprietary MOSFET current-drive design.',
  },

  // ── Enleum (Korea, formerly Bakoon) ─────────────────

  {
    id: 'enleum-amp-23r',
    brand: 'Enleum',
    name: 'AMP-23R',
    price: 6500,
    category: 'amplifier',
    architecture: 'Class AB, zero-feedback, all-discrete Exicon MOSFETs, JET 2 Bias, 25W @ 8Ω / 45W @ 4Ω',
    subcategory: 'integrated-amp',
    priceTier: 'upper-mid',
    brandScale: 'boutique',
    region: 'asia',
    country: 'KR',
    topology: 'class-ab-solid-state',
    archetypes: { primary: 'flow_organic', secondary: 'tonal_saturated' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'elastic',
      airy_closed: 'airy',
      warm_bright_n: -1,
      smooth_detailed_n: -1,
      elastic_controlled_n: -1,
      airy_closed_n: 1,
    },
    fatigueAssessment: {
      risk: 'very_low',
      notes: 'Triode-like warmth and sweetness from solid-state. Zero-feedback design is inherently gentle. Exceptional long-session comfort.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'warmth', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'elasticity', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'composure', level: 'less_emphasized' },
        { trait: 'dynamics', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 1.0,
      warmth: 1.0,
      tonal_density: 1.0,
      texture: 1.0,
      spatial_precision: 0.7,
      elasticity: 0.7,
      clarity: 0.7,
      speed: 0.4,
      composure: 0.4,
      dynamics: 0.4,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Korean boutique integrated (formerly Bakoon) with 25W of zero-feedback MOSFET power. Triode-like warmth and immediacy from solid-state — reviewers consistently describe a "glow" and sweetness that rivals SET amplifiers. Built-in headphone amplifier. Compact desktop-friendly form factor. Limited power demands efficient or moderate-sensitivity speakers.',
    retailer_links: [
      { label: 'Enleum', url: 'https://www.enleum.com/amp-23r' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'warm, sweet, triode-like — inner glow and harmonic richness unusual for solid-state', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'fluid and immediate — music feels present and alive, not analytical or mechanical', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'exceptionally tactile — fine-grained textural detail with warmth, not clinical dissection', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with efficient speakers (88dB+)', effect: 'excellent match — the warmth and immediacy sing with sensitive transducers', valence: 'positive', basis: 'review_consensus' },
        { condition: 'paired with power-hungry or insensitive speakers', effect: '25W runs out of headroom — dynamic compression at volume', valence: 'caution', basis: 'review_consensus' },
        { condition: 'as a headphone amplifier', effect: 'outstanding — the zero-feedback MOSFET topology excels at headphone duties, especially with planar magnetics', valence: 'positive', basis: 'review_consensus' },
        { condition: 'with precise or analytical sources', effect: 'the amp adds body and sweetness — an excellent counterbalance to lean or clinical DACs', valence: 'positive', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'warmth, immediacy, sweetness, textural beauty, and tube-like musicality from solid-state', cost: 'limited power (25W), reduced dynamic authority, and less control over difficult speaker loads', relative_to: 'high-power solid-state integrated amplifiers', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: '6moons', note: 'Extensive review praising triode-like immediacy and warmth. Compared favorably to SET amplifiers.' },
      { source: 'Headphone.guru', note: 'Praised as exceptional combined speaker/headphone amplifier.' },
    ],
    notes: 'Formerly Bakoon — rebranded as Enleum. The AMP-23R is the speaker amp version (the HPA-23R is headphone-only). JET 2 Bias is their proprietary adaptive biasing circuit. 25W demands careful speaker matching — best with 88dB+ sensitivity.',
  },

  // ── Grandinote (Italy) ──────────────────────────────

  {
    id: 'grandinote-shinai',
    brand: 'Grandinote',
    name: 'Shinai',
    price: 15000,
    category: 'amplifier',
    architecture: 'Pure Class A, zero-feedback, fully balanced dual-mono, direct-coupled, 37W @ 8Ω',
    subcategory: 'integrated-amp',
    priceTier: 'reference',
    brandScale: 'boutique',
    region: 'europe',
    country: 'IT',
    topology: 'class-a-solid-state',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'elastic',
      airy_closed: 'airy',
      warm_bright_n: -1,
      smooth_detailed_n: -1,
      elastic_controlled_n: -1,
      airy_closed_n: 1,
    },
    fatigueAssessment: {
      risk: 'very_low',
      notes: 'Pure Class A with zero feedback — supremely liquid and non-fatiguing. The warmth and bloom are inherently easy on the ear.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'flow', level: 'emphasized' },
        { trait: 'warmth', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'elasticity', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'speed', level: 'less_emphasized' },
        { trait: 'composure', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      tonal_density: 1.0,
      flow: 1.0,
      warmth: 1.0,
      texture: 1.0,
      dynamics: 0.7,
      spatial_precision: 0.7,
      elasticity: 0.7,
      clarity: 0.7,
      speed: 0.4,
      composure: 0.4,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Italian pure Class A integrated with zero feedback and fully balanced dual-mono architecture. 37W of rich, liquid power that sounds like the best tube amplifiers without the tube maintenance. Supremely musical, warm, and expressive — prioritises tonal color, bloom, and emotional engagement over analytical precision. Separate power cord per channel.',
    retailer_links: [
      { label: 'Grandinote', url: 'https://www.grandinote.com/shinai/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'warm, lush, harmonically saturated — tube-like richness from solid-state Class A', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'liquid and expressive — fast enough for energy but prioritises musical flow over incisive transients', basis: 'review_consensus' },
        { domain: 'dynamics', tendency: 'energetic and dynamic within its 37W envelope — punches above its power rating due to Class A operation', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with efficient or moderate-sensitivity speakers', effect: 'exceptional synergy — the richness and warmth fill the room with musical engagement', valence: 'positive', basis: 'review_consensus' },
        { condition: 'paired with power-hungry speakers below 86dB', effect: '37W may limit dynamic range — works best with speakers that don\'t need brute force', valence: 'caution', basis: 'review_consensus' },
        { condition: 'with neutral or precise sources', effect: 'excellent complementary pairing — the Shinai adds musical color without obscuring upstream detail', valence: 'positive', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'tonal beauty, harmonic richness, musicality, and emotional engagement at the highest level', cost: 'ultimate control, speed, and grip compared to high-power solid-state designs', relative_to: 'high-power Class AB or Class D amplifiers', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Stereophile', note: 'Review praising warmth, lushness, and seductive musicality from solid-state Class A.' },
      { source: '6moons', note: 'Noted rare combination of warmth and energetic dynamics.' },
    ],
    notes: 'Pure Class A runs hot — requires adequate ventilation. Dual-mono with separate mains leads per channel. 37W is sufficient for most bookshelf and moderate floorstanders. The Shinai is Grandinote\'s most popular model — sits between the entry Genesi and flagship Supremo.',
  },

  // ── Goldmund Telos (Switzerland) ────────────────────

  {
    id: 'goldmund-telos-590',
    brand: 'Goldmund',
    name: 'Telos 590 NextGen II',
    price: 26000,
    category: 'amplifier',
    architecture: 'Class AB, fully analog, high-bandwidth, 225W @ 8Ω',
    subcategory: 'integrated-amp',
    priceTier: 'reference',
    brandScale: 'luxury',
    region: 'europe',
    country: 'CH',
    topology: 'class-ab-solid-state',
    archetypes: { primary: 'precision_explicit', secondary: 'rhythmic_propulsive' },
    primaryAxes: {
      warm_bright: 'bright',
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'airy',
      warm_bright_n: 1,
      smooth_detailed_n: 2,
      elastic_controlled_n: 2,
      airy_closed_n: 1,
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Clean and precise without harshness. Slightly dry upper frequencies may be less forgiving of poor recordings but not fatiguing with quality material.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'speed', level: 'emphasized' },
        { trait: 'composure', level: 'emphasized' },
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'warmth', level: 'less_emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 1.0,
      speed: 1.0,
      composure: 1.0,
      dynamics: 1.0,
      spatial_precision: 0.7,
      texture: 0.7,
      flow: 0.7,
      warmth: 0.0,
      tonal_density: 0.4,
      elasticity: 0.4,
      fatigue_risk: 0.0,
      glare_risk: 0.4,
    },
    description:
      'Swiss reference integrated from Goldmund\'s high-end Telos line. 225W of clean, precise, highly controlled power. Neutral to slightly dry — prioritises speed, dynamics, and transparency over tonal warmth. Exceptional grip and authority. The Telos line represents Goldmund\'s serious audio engineering, far above the budget JOB sub-brand.',
    retailer_links: [
      { label: 'Goldmund', url: 'https://www.goldmund.com/products/telos-590-nextgen-ii' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'neutral to slightly dry — clean and precise, transparency over tonal color', basis: 'review_consensus' },
        { domain: 'dynamics', tendency: 'muscular and authoritative — large and low-level dynamics rendered with exceptional clarity', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'fast and responsive — prioritises speed and transient precision', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with warm or rich-sounding speakers', effect: 'excellent complementary balance — the amp provides grip and transparency, speakers provide body', valence: 'positive', basis: 'review_consensus' },
        { condition: 'in already lean or bright systems', effect: 'may compound dryness — the amp doesn\'t add warmth or sweetness', valence: 'caution', basis: 'review_consensus' },
        { condition: 'with demanding speaker loads', effect: 'rock-solid grip and current delivery — unflustered by difficult impedance curves', valence: 'positive', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'speed, precision, dynamic authority, grip, and world-class transparency', cost: 'tonal warmth, harmonic richness, and the organic sweetness of tube or Class A designs', relative_to: 'tube amplifiers or warm Class A solid-state', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'What Hi-Fi?', note: 'Review of Telos 690 (same family) praising neutrality and dynamic expression.' },
      { source: 'Stereophile', note: 'Goldmund Telos line praised for speed, precision, and authority.' },
    ],
    notes: 'Goldmund Telos line is distinct from JOB — these are serious reference-level electronics. Swiss manufacturing. The 590 is the integrated; the 690 adds a DAC module.',
  },

  // ── Soulution (Switzerland) ─────────────────────────

  {
    id: 'soulution-330',
    brand: 'Soulution',
    name: '330',
    price: 20000,
    category: 'amplifier',
    architecture: 'Class A, dual-mono, six separate power supplies (1,200 VA), 120W @ 8Ω / 240W @ 4Ω',
    subcategory: 'integrated-amp',
    priceTier: 'reference',
    brandScale: 'luxury',
    region: 'europe',
    country: 'CH',
    topology: 'class-a-solid-state',
    archetypes: { primary: 'precision_explicit', secondary: 'spatial_holographic' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'airy',
      warm_bright_n: 0,
      smooth_detailed_n: 2,
      elastic_controlled_n: 2,
      airy_closed_n: 1,
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Slightly dark tonality balances the high resolution. Very low noise floor. Class A warmth prevents analytical fatigue.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'composure', level: 'emphasized' },
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'speed', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'warmth', level: 'less_emphasized' },
        { trait: 'elasticity', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      composure: 1.0,
      dynamics: 1.0,
      clarity: 1.0,
      spatial_precision: 1.0,
      speed: 0.7,
      texture: 0.7,
      tonal_density: 0.7,
      flow: 0.7,
      warmth: 0.4,
      elasticity: 0.4,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Swiss reference Class A integrated with 120W into 8Ω doubling into 4Ω. Six separate power supplies totaling 1,200 VA. Neutral to slightly dark tonality with stunning bass authority and spatial precision. Combines Class A musicality with exceptional control and technical performance. Optional DAC and phono modules.',
    retailer_links: [
      { label: 'Soulution', url: 'https://www.soulution-audio.com/en/products/300-series/330-integrated-amplifier' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'neutral to slightly dark — body and density without warmth or brightness emphasis', basis: 'review_consensus' },
        { domain: 'dynamics', tendency: 'stunning bass authority and punch — tight, controlled, articulate low end', basis: 'review_consensus' },
        { domain: 'spatiality', tendency: 'three-dimensional imaging with uncanny spatial precision — instruments exist in space', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with reference-caliber speakers', effect: 'exceptional transparency — the amp reveals everything upstream and the speaker\'s full character', valence: 'positive', basis: 'review_consensus' },
        { condition: 'with speakers needing bass grip', effect: 'outstanding control — 240W into 4Ω with Class A authority delivers iron-fisted bass', valence: 'positive', basis: 'review_consensus' },
        { condition: 'with warm or tubey sources', effect: 'complementary — the Soulution\'s precision and the source\'s warmth balance well', valence: 'positive', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'reference-level control, bass authority, spatial precision, and Class A musicality in a single chassis', cost: 'the organic, elastic, flowing quality of lower-power single-ended designs', relative_to: 'SET or low-power Class A amplifiers', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'The Absolute Sound', note: 'Called a "bargain" for integrated pre+power performance. Exceptional bass and spatial effects.' },
      { source: 'Stereophile', note: 'Praised composure, bass authority, and musical refinement.' },
    ],
    notes: 'Swiss precision engineering. Six separate power supplies is unusual in an integrated chassis. Optional $3K DAC module and $4K phono module. Class A runs warm — requires ventilation. 120W Class A is substantially more muscular than typical 30–50W Class A designs.',
  },

  // ── darTZeel (Switzerland) ──────────────────────────

  {
    id: 'dartzeel-cth-8550',
    brand: 'darTZeel',
    name: 'CTH-8550',
    price: 41000,
    category: 'amplifier',
    architecture: 'Class AB, dual-mono, dual toroidal transformers, 200W @ 8Ω / 330W @ 4Ω, 50Ω Zeel inputs',
    subcategory: 'integrated-amp',
    priceTier: 'reference',
    brandScale: 'luxury',
    region: 'europe',
    country: 'CH',
    topology: 'class-ab-solid-state',
    archetypes: { primary: 'flow_organic', secondary: 'tonal_saturated' },
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
    fatigueAssessment: {
      risk: 'very_low',
      notes: 'Luscious, sweet, full-bodied presentation. Inherently non-fatiguing — the warm tonality and graceful dynamics invite extended listening.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'warmth', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'elasticity', level: 'present' },
        { trait: 'speed', level: 'less_emphasized' },
        { trait: 'composure', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 1.0,
      warmth: 1.0,
      tonal_density: 1.0,
      texture: 1.0,
      dynamics: 0.7,
      spatial_precision: 0.7,
      clarity: 0.7,
      elasticity: 0.7,
      speed: 0.4,
      composure: 0.4,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Swiss statement integrated — 200W into 8Ω of luscious, musically seductive power. Warm, sweet, full-bodied without softness. Proprietary 50Ω Zeel BNC inputs for darTZeel-to-darTZeel connection. Combines the harmonic richness and flow of the best tube amplifiers with solid-state authority. Bold, dynamic, and textured with exceptional finesse in timbre reproduction.',
    retailer_links: [
      { label: 'darTZeel', url: 'https://www.dartzeel.com/cth-8550/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'warm, luscious, harmonically rich — sweet without softness, full-bodied without thickness', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'fluid and musical — prioritises natural musical flow and elasticity over incisive precision', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'exceptional finesse in timbre recreation — instruments sound tangible and real', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with revealing or slightly lean speakers', effect: 'the warmth and body fill out the presentation beautifully — complementary match', valence: 'positive', basis: 'review_consensus' },
        { condition: 'in already warm or harmonically rich systems', effect: 'may compound warmth — the system could lean too lush for detail-oriented listeners', valence: 'caution', basis: 'editorial_inference' },
        { condition: 'with darTZeel source via Zeel 50Ω connection', effect: 'proprietary connection optimises impedance matching — designed for all-darTZeel systems', valence: 'positive', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'harmonic richness, musicality, warmth, timbral beauty, and supreme long-session engagement', cost: 'the last degree of transient precision, analytical clarity, and bass slam', relative_to: 'high-power precision solid-state amplifiers (Soulution, Goldmund)', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Stereophile', note: 'Extensive review praising musicality, sweetness, and timbral finesse.' },
      { source: 'The Absolute Sound', note: 'Noted as warm-leaning but detailed, with exceptional texture.' },
    ],
    notes: 'Hervé Delétraz design. The 50Ω Zeel BNC input is proprietary — only relevant in all-darTZeel systems (otherwise use standard RCA/XLR). Price reflects Swiss boutique manufacturing. The CTH-8550 is the integrated version of their NHB-108/NHB-18 separates philosophy.',
  },
];
