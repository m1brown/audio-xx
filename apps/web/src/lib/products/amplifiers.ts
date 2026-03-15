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
    name: 'INTegrated',
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
];
