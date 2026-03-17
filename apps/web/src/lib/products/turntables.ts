/**
 * Turntable product catalog — structured sonic traits.
 *
 * Turntable sonic character is shaped by:
 *   - Motor type: belt-drive (organic, slightly soft timing) vs direct-drive
 *     (precise, controlled, tight speed stability)
 *   - Plinth philosophy: rigid/lightweight (Rega) vs mass-loaded (VPI, Technics)
 *     vs suspended subchassis (Linn, Thorens)
 *   - Tonearm: unipivot, gimbal, linear-tracking — affects tracking stability
 *     and the way energy is absorbed
 *
 * Traits use the same 0–1 scale as DACs and speakers:
 *   strong = 1.0, moderate = 0.7, slight = 0.4, neutral = 0.0
 *
 * Turntable-relevant traits:
 *   rhythm        — pace, timing conviction, PRaT
 *   speed         — transient leading edge, attack definition
 *   warmth        — tonal fullness, bass weight
 *   tonal_density — harmonic richness and body
 *   flow          — musical continuity, phrasing coherence
 *   spatial_precision — imaging specificity and staging stability
 *   clarity       — transparency and resolution of inner detail
 *   composure     — stability under complex passages
 *   dynamics      — macro/micro dynamic contrast
 *   texture       — tactile quality, surface grain
 *
 * Turntable-specific metadata:
 *   hasBuiltInPhono  — critical for system gap detection
 *   cartridgeIncluded — affects out-of-box readiness
 *   driveType        — belt, direct, or idler
 *   suspensionType   — rigid, suspended, semi-suspended
 */

import type { Product } from './dacs';

// ── Turntable-specific metadata extension ────────────

export interface TurntableProduct extends Product {
  /** Whether a phono stage is built in. */
  hasBuiltInPhono: boolean;
  /** Whether a cartridge ships with the turntable. */
  cartridgeIncluded: boolean;
  /** Drive mechanism. */
  driveType: 'belt' | 'direct' | 'idler';
  /** Plinth/suspension approach. */
  suspensionType: 'rigid' | 'suspended' | 'semi-suspended';
  /** Advisory note when user lacks a phono stage. */
  phonoAbsentNote?: string;
  /** General fit note for advisory context. */
  fitNote?: string;
}

export const TURNTABLE_PRODUCTS: TurntableProduct[] = [
  // ── Rega Planar 3 ─────────────────────────────────

  {
    id: 'rega-planar-3',
    brand: 'Rega',
    name: 'Planar 3',
    price: 1095,
    category: 'turntable',
    architecture: 'belt-drive rigid plinth',
    subcategory: 'turntable',
    priceTier: 'mid',
    brandScale: 'specialist',
    region: 'europe',
    country: 'UK',
    topology: 'belt-drive',
    hasBuiltInPhono: false,
    cartridgeIncluded: true,
    driveType: 'belt',
    suspensionType: 'rigid',
    archetypes: { primary: 'rhythmic_propulsive', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'elastic',
      airy_closed: 'airy',
    },
    traits: {
      rhythm: 1.0,
      speed: 0.7,
      warmth: 0.4,
      tonal_density: 0.4,
      flow: 0.7,
      spatial_precision: 0.4,
      clarity: 0.7,
      composure: 0.4,
      dynamics: 0.7,
      texture: 0.4,
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'rhythm', level: 'emphasized' },
        { trait: 'speed', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'spatial_precision', level: 'less_emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    description:
      'The Rega Planar 3 is built around timing and rhythmic coherence. Its lightweight rigid plinth and RB330 tonearm minimise energy storage, letting transients pass through with speed and conviction. The philosophy is "less mass, more music" — the result is a turntable that prioritises pace and engagement over tonal weight or staging grandeur. Ships with the Elys 2 cartridge.',
    retailer_links: [
      { label: 'Rega Research', url: 'https://www.rega.co.uk/planar-3' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'timing', tendency: 'Rhythmic drive and timing conviction — the defining Rega quality. Notes land with purpose and propulsion', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'Slightly lean tonal balance — speed and openness rather than warmth or density', basis: 'review_consensus' },
        { domain: 'spatial', tendency: 'Open and airy but not the last word in image specificity — timing coherence creates a sense of musical space', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'with warm cartridges (Nagaoka MP-110, Goldring)', effect: 'adds tonal body that complements the Rega speed', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'with bright or lean cartridges', effect: 'can sound thin — the plinth doesn\'t add warmth', valence: 'caution', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'rhythmic drive, speed, musical engagement', cost: 'tonal density and bass weight compared to mass-loaded or suspended designs', relative_to: 'VPI, Thorens, Linn', basis: 'review_consensus' },
      ],
    },
    notes: 'The RB330 tonearm is widely considered one of the best at this price. Rega\'s design philosophy explicitly rejects mass-loading and suspended subchassis in favour of minimal energy storage.',
  },

  // ── Technics SL-1500C ─────────────────────────────

  {
    id: 'technics-sl-1500c',
    brand: 'Technics',
    name: 'SL-1500C',
    price: 1200,
    category: 'turntable',
    architecture: 'direct-drive rigid plinth',
    subcategory: 'turntable',
    priceTier: 'mid',
    brandScale: 'major',
    region: 'asia',
    country: 'JP',
    topology: 'direct-drive',
    hasBuiltInPhono: true,
    cartridgeIncluded: true,
    driveType: 'direct',
    suspensionType: 'rigid',
    archetypes: { primary: 'precision_explicit', secondary: 'rhythmic_propulsive' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'neutral',
    },
    traits: {
      rhythm: 0.7,
      speed: 0.7,
      warmth: 0.4,
      tonal_density: 0.4,
      flow: 0.4,
      spatial_precision: 0.7,
      clarity: 1.0,
      composure: 1.0,
      dynamics: 0.7,
      texture: 0.4,
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'composure', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'speed', level: 'present' },
        { trait: 'rhythm', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'flow', level: 'less_emphasized' },
        { trait: 'warmth', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    description:
      'Technics brings its direct-drive engineering heritage to the SL-1500C — a coreless direct-drive motor with precise speed control and very low wow/flutter. Built-in phono stage and Ortofon 2M Red cartridge make it a complete front end. The presentation is controlled, neutral, and precise — prioritising accuracy and stability over tonal colour.',
    retailer_links: [
      { label: 'Technics', url: 'https://www.technics.com/products/turntables/sl-1500c.html' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'control', tendency: 'Controlled and composed — direct-drive precision gives exceptional speed stability and low-level detail retrieval', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'Neutral tonal balance — neither warm nor bright, the motor and plinth don\'t impose character', basis: 'review_consensus' },
        { domain: 'spatial', tendency: 'Stable, well-defined imaging with good separation — the quiet motor helps resolve spatial cues', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'with warm speakers or tube amplification', effect: 'the neutral platform lets upstream warmth come through without damping it', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in systems already leaning clinical', effect: 'the controlled presentation can compound — may lack life', valence: 'caution', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'precision, speed stability, composure, built-in phono convenience', cost: 'the elastic, flowing quality of belt-drive and suspended designs', relative_to: 'Rega Planar 3, Linn LP12, Thorens TD 1600', basis: 'review_consensus' },
      ],
    },
    notes: 'The built-in phono stage is competent but modest — external phono stages will improve performance. The SL-1500C descends from the legendary SL-1200 DJ line but is tuned for home listening. Shares DNA with the founder\'s former Technics SL-10 (linear-tracking direct-drive).',
  },

  // ── Pro-Ject Debut PRO ────────────────────────────

  {
    id: 'pro-ject-debut-pro',
    brand: 'Pro-Ject',
    name: 'Debut PRO',
    price: 999,
    category: 'turntable',
    architecture: 'belt-drive rigid plinth',
    subcategory: 'turntable',
    priceTier: 'mid',
    brandScale: 'specialist',
    region: 'europe',
    country: 'AT',
    topology: 'belt-drive',
    hasBuiltInPhono: false,
    cartridgeIncluded: true,
    driveType: 'belt',
    suspensionType: 'rigid',
    archetypes: { primary: 'flow_organic', secondary: 'precision_explicit' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'neutral',
      elastic_controlled: 'neutral',
      airy_closed: 'neutral',
    },
    traits: {
      rhythm: 0.4,
      speed: 0.4,
      warmth: 0.7,
      tonal_density: 0.7,
      flow: 0.7,
      spatial_precision: 0.4,
      clarity: 0.4,
      composure: 0.7,
      dynamics: 0.4,
      texture: 0.7,
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'medium',
      tendencies: [
        { trait: 'warmth', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'rhythm', level: 'less_emphasized' },
        { trait: 'speed', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    description:
      'Pro-Ject\'s 30th anniversary design with carbon/steel sandwich plinth for resonance control, electronic speed change, and Pick IT PRO cartridge. Warmer and more grounded than the Rega school — less rhythmic drive but more tonal body and texture. A balanced, forgiving platform.',
    retailer_links: [
      { label: 'Pro-Ject Audio', url: 'https://www.project-audio.com/en/product/debut-pro/' },
    ],
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'tonality', tendency: 'Warm and tonally full — the carbon/steel sandwich plinth adds body and grounds the presentation', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'Good surface texture and organic quality — instruments feel tactile rather than etched', basis: 'listener_consensus' },
        { domain: 'timing', tendency: 'Relaxed timing compared to Rega — musical flow over rhythmic drive', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'with detailed or bright cartridges', effect: 'the warm plinth balances brighter cartridges well', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in already warm/slow systems', effect: 'can compound — may lack energy and speed', valence: 'caution', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'tonal warmth, texture, organic character, resonance control', cost: 'rhythmic drive and transient speed compared to Rega designs', relative_to: 'Rega Planar 3', basis: 'review_consensus' },
      ],
    },
  },

  // ── VPI Cliffwood ─────────────────────────────────

  {
    id: 'vpi-cliffwood',
    brand: 'VPI',
    name: 'Cliffwood',
    price: 1000,
    category: 'turntable',
    architecture: 'belt-drive MDF plinth',
    subcategory: 'turntable',
    priceTier: 'mid',
    brandScale: 'specialist',
    region: 'north-america',
    country: 'US',
    topology: 'belt-drive',
    hasBuiltInPhono: false,
    cartridgeIncluded: true,
    driveType: 'belt',
    suspensionType: 'rigid',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'elastic',
      airy_closed: 'neutral',
    },
    traits: {
      rhythm: 0.4,
      speed: 0.4,
      warmth: 1.0,
      tonal_density: 1.0,
      flow: 0.7,
      spatial_precision: 0.4,
      clarity: 0.4,
      composure: 0.4,
      dynamics: 0.7,
      texture: 0.7,
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'medium',
      tendencies: [
        { trait: 'warmth', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'flow', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'clarity', level: 'less_emphasized' },
        { trait: 'speed', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    description:
      'VPI\'s entry-level turntable with their signature stainless steel/aluminum unipivot tonearm and MDF plinth. The sound is warm, dense, and organic — the turntable equivalent of an R2R DAC. Prioritises tonal richness and harmonic weight over precision or speed.',
    retailer_links: [
      { label: 'VPI Industries', url: 'https://vpiindustries.com/turntables/cliffwood/' },
    ],
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'tonality', tendency: 'Warm and harmonically dense — the MDF plinth and unipivot tonearm contribute body and weight', basis: 'review_consensus' },
        { domain: 'flow', tendency: 'Musical flow and organic phrasing — notes breathe and connect rather than etching detail', basis: 'listener_consensus' },
        { domain: 'dynamics', tendency: 'Good macro dynamics — VPI turntables tend toward scale and authority over micro-detail', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'with detailed or speed-oriented electronics', effect: 'adds welcome body and musical weight to lean systems', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in already warm/dense systems', effect: 'can sound thick — needs a cartridge with some top-end energy', valence: 'caution', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'tonal density, warmth, organic flow, dynamic authority', cost: 'transient speed, detail retrieval, and imaging precision', relative_to: 'Rega Planar 3, Technics SL-1500C', basis: 'review_consensus' },
      ],
    },
  },

  // ── Linn LP12 (base Majik level) ──────────────────

  {
    id: 'linn-lp12-majik',
    brand: 'Linn',
    name: 'LP12 Majik',
    price: 4100,
    category: 'turntable',
    architecture: 'belt-drive suspended subchassis',
    subcategory: 'turntable',
    priceTier: 'upper-mid',
    brandScale: 'specialist',
    region: 'europe',
    country: 'UK',
    topology: 'belt-drive',
    hasBuiltInPhono: false,
    cartridgeIncluded: true,
    driveType: 'belt',
    suspensionType: 'suspended',
    archetypes: { primary: 'rhythmic_propulsive', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'neutral',
      elastic_controlled: 'elastic',
      airy_closed: 'airy',
    },
    traits: {
      rhythm: 1.0,
      speed: 0.7,
      warmth: 0.7,
      tonal_density: 0.7,
      flow: 1.0,
      spatial_precision: 0.7,
      clarity: 0.7,
      composure: 0.7,
      dynamics: 0.7,
      texture: 0.7,
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'rhythm', level: 'emphasized' },
        { trait: 'flow', level: 'emphasized' },
        { trait: 'warmth', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'speed', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'dynamics', level: 'present' },
      ],
      riskFlags: [],
    },
    description:
      'The LP12 is the archetype of the "music first" turntable. Its suspended subchassis isolates the platter and tonearm from the plinth, giving it a distinctive rhythmic elasticity and musical flow that no rigid-plinth design quite replicates. The Majik spec (Krane tonearm, Adikt cartridge, Lingo power supply) is the entry to the LP12 world — upgradable through many tiers.',
    retailer_links: [
      { label: 'Linn', url: 'https://www.linn.co.uk/turntables' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'timing', tendency: 'Rhythmic elasticity and musical flow — the suspended subchassis gives notes a distinctive "bounce" and propulsion', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'Warm and tonally rich without being sluggish — the LP12 combines body with pace', basis: 'review_consensus' },
        { domain: 'engagement', tendency: 'Long-term musical engagement — the LP12 is famously addictive. Listeners describe a quality of involvement that technical specs don\'t capture', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'with Naim, Leben, or other timing-oriented amplification', effect: 'the LP12\'s rhythmic strengths are amplified — a classic pairing for musicality', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'with ultra-revealing, speed-first systems', effect: 'the suspended subchassis may introduce a subtle softening of transient attack that precision listeners notice', valence: 'caution', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'rhythmic engagement, musical flow, tonal warmth, long-term upgradability', cost: 'setup sensitivity, maintenance (suspension tuning), price of entry', relative_to: 'Rega Planar 3, Technics SL-1500C', basis: 'review_consensus' },
      ],
    },
    notes: 'The LP12 is modular — every component (motor, bearing, subchassis, tonearm, power supply) can be upgraded over decades. Philosophically aligned with Naim, Leben, Shindo, and the "tune dem" approach to hi-fi. Requires careful setup and periodic suspension tuning.',
  },

  // ── Thorens TD 1600 ───────────────────────────────

  {
    id: 'thorens-td-1600',
    brand: 'Thorens',
    name: 'TD 1600',
    price: 2500,
    category: 'turntable',
    architecture: 'belt-drive suspended subchassis',
    subcategory: 'turntable',
    priceTier: 'upper-mid',
    brandScale: 'heritage',
    region: 'europe',
    country: 'DE',
    topology: 'belt-drive',
    hasBuiltInPhono: false,
    cartridgeIncluded: false,
    driveType: 'belt',
    suspensionType: 'suspended',
    archetypes: { primary: 'tonal_saturated', secondary: 'spatial_holographic' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'elastic',
      airy_closed: 'airy',
    },
    traits: {
      rhythm: 0.4,
      speed: 0.4,
      warmth: 1.0,
      tonal_density: 1.0,
      flow: 0.7,
      spatial_precision: 0.7,
      clarity: 0.4,
      composure: 0.7,
      dynamics: 0.4,
      texture: 0.7,
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'medium',
      tendencies: [
        { trait: 'warmth', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'flow', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'rhythm', level: 'less_emphasized' },
        { trait: 'speed', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    description:
      'The TD 1600 continues Thorens\' suspended subchassis lineage (TD 150, TD 160, TD 166). The spring-suspended chassis isolates the platter assembly from external vibration, producing a warm, spacious, and relaxed presentation. Tonally richer and more laid-back than the Linn LP12 — where Linn prioritises rhythm, Thorens prioritises immersion. The TD 1600 is the modern expression of the classic Thorens sound that defined vinyl for a generation.',
    retailer_links: [
      { label: 'Thorens', url: 'https://www.thorens.com/en/turntables/td-1600.html' },
    ],
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'tonality', tendency: 'Warm, rich, and harmonically saturated — the Thorens suspended subchassis adds body and tonal weight', basis: 'review_consensus' },
        { domain: 'spatial', tendency: 'Spacious and immersive staging — good depth and a sense of being "in" the music rather than observing it', basis: 'listener_consensus' },
        { domain: 'timing', tendency: 'Relaxed pacing — musical but not rhythmically assertive. Notes flow rather than drive', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'with detailed or lean electronics', effect: 'the Thorens warmth and body complement speed-first systems beautifully', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in already warm, slow systems', effect: 'can become too relaxed — needs a cartridge or phono stage with some leading-edge definition', valence: 'caution', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'tonal warmth, spatial immersion, harmonic density, listening ease', cost: 'rhythmic drive, transient speed, and the snap/PRaT of rigid or direct-drive designs', relative_to: 'Rega Planar 3, Technics SL-1500C, Linn LP12', basis: 'review_consensus' },
      ],
    },
    notes: 'Direct descendant of the TD 160 — shares the same suspended subchassis philosophy with modern refinements (TP-92 tonearm, improved bearing). The TD 160 is one of the most commonly owned vintage turntables worldwide. The TD 1600 updates that voice with better isolation and materials.',
  },
];

// ── Phono stage awareness ────────────────────────────

/**
 * Check whether a turntable has a built-in phono stage.
 * Used by accessory chaining logic to flag phono stage needs.
 */
export function turntableNeedsPhono(turntableId: string): boolean {
  const tt = TURNTABLE_PRODUCTS.find((t) => t.id === turntableId);
  return tt ? !tt.hasBuiltInPhono : true; // default to needing phono if unknown
}

/**
 * Select turntable examples for shopping, with phono-awareness scoring.
 */
/**
 * Check whether the user's active system includes a phono stage.
 * Returns 'present' | 'absent' | 'unknown'.
 *
 * Logic:
 *   1. If any component has role === 'phono_stage', → present
 *   2. If the system has a turntable with built-in phono, → present
 *   3. If the system has components but no phono_stage and no built-in phono turntable, → absent
 *   4. If no system or no components, → unknown
 */
export function detectSystemPhono(
  system: { components: Array<{ name: string; category: string; role: string | null }> } | null | undefined,
): 'present' | 'absent' | 'unknown' {
  if (!system || !system.components || system.components.length === 0) return 'unknown';

  // Explicit phono_stage component
  if (system.components.some((c) => c.role === 'phono_stage')) return 'present';

  // Turntable with built-in phono
  const systemTurntables = system.components.filter((c) => c.category === 'turntable');
  for (const tt of systemTurntables) {
    const catalogTt = TURNTABLE_PRODUCTS.find(
      (p) => p.name.toLowerCase() === tt.name.toLowerCase() || p.id === tt.name.toLowerCase().replace(/\s+/g, '-'),
    );
    if (catalogTt?.hasBuiltInPhono) return 'present';
  }

  // System exists but no phono found
  return 'absent';
}

/**
 * Build a phono stage caveat string for advisory responses.
 * Returns null when no caveat is needed.
 */
export function buildPhonoCaveat(
  turntableId: string | null,
  systemPhono: 'present' | 'absent' | 'unknown',
): string | null {
  // No caveat needed if phono is present
  if (systemPhono === 'present') return null;

  // Check if the specific turntable has built-in phono
  if (turntableId) {
    const tt = TURNTABLE_PRODUCTS.find((t) => t.id === turntableId);
    if (tt?.hasBuiltInPhono) return null;
  }

  if (systemPhono === 'absent') {
    return 'Your system doesn\'t appear to include a phono stage. A turntable needs a phono preamp before it reaches your amplifier — either a separate unit or one built into the turntable itself.';
  }

  // unknown
  return 'If you don\'t already have a phono stage, you\'ll need one between the turntable and your amplifier. Some turntables include one built in.';
}

export function selectTurntableExamples(
  budgetAmount: number | null,
  phonoAbsent: boolean,
  count: number = 3,
): TurntableProduct[] {
  const effectiveBudget = budgetAmount ?? 1000;
  const ceiling = effectiveBudget * 1.2;

  const eligible = TURNTABLE_PRODUCTS.filter((t) => t.price <= ceiling);

  if (eligible.length === 0) {
    const sorted = [...TURNTABLE_PRODUCTS].sort((a, b) => a.price - b.price);
    return sorted.slice(0, count);
  }

  const scored = eligible.map((t) => {
    let score = 0;
    score += (1 - Math.abs(t.price - effectiveBudget) / effectiveBudget) * 10;
    if (phonoAbsent && t.hasBuiltInPhono) score += 5;
    if (t.cartridgeIncluded) score += 1;
    return { turntable: t, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map((s) => s.turntable);
}
