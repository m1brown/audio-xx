/**
 * DAC product catalog for shopping recommendations.
 *
 * Each product has trait scores on the 0–1 scale matching QUALITATIVE_MAP:
 *   strong = 1.0, moderate = 0.7, slight = 0.4, neutral = 0.0
 *
 * Trait values describe the component's sonic character, not quality.
 * A DAC with low clarity is not "worse" — it prioritizes something else.
 *
 * Risk traits (fatigue_risk, glare_risk) use the same scale:
 *   0.0 = no risk, 0.4 = slight risk, 0.7 = moderate risk, 1.0 = strong risk
 *
 * Retailer links are informational. Prices are approximate street prices
 * as of early 2025 and may shift. The system does not track live pricing.
 */

import type { ProductTendencies, TendencyProfile } from '../sonic-tendencies';
import type {
  ProductCategory,
  ProductSubcategory,
  PriceTier,
  BrandScale,
  GeoRegion,
  DesignTopology,
} from '../catalog-taxonomy';

export interface RetailerLink {
  label: string;
  url: string;
  /** ISO 3166-1 region code or broad label (e.g. 'US', 'EU', 'JP', 'global'). */
  region?: string;
}

export interface Product {
  id: string;
  brand: string;
  name: string;
  /**
   * Representative price in the currency specified by priceCurrency.
   * Used for approximate budget filtering, not as a definitive quote.
   */
  price: number;
  /** ISO 4217 currency code. Defaults to 'USD' when omitted. */
  priceCurrency?: string;
  category: ProductCategory;
  architecture: string;

  // ── Catalog diversity metadata (all optional) ──────
  /** Finer classification within the category. */
  subcategory?: ProductSubcategory;
  /** Price tier relative to the product's category. */
  priceTier?: PriceTier;
  /** Brand scale / market position. */
  brandScale?: BrandScale;
  /** Geographic region of brand origin / design heritage. */
  region?: GeoRegion;
  /** Country of origin (ISO 3166-1 name or code). */
  country?: string;
  /** Design topology tag — enables cross-catalog filtering. */
  topology?: DesignTopology;

  /**
   * Legacy numeric traits (0–1 scale). Retained during migration.
   * Scoring and archetype inference read through resolveTraitValue(),
   * which prefers tendencyProfile when present.
   */
  traits: Record<string, number>;
  /**
   * Qualitative tendency profile — the editorial source of truth.
   * When present, explanation code reads this directly and scoring
   * derives numeric weights from it via resolveTraitValue().
   * Traits not listed are treated as neutral.
   */
  tendencyProfile?: TendencyProfile;
  /** Fallback summary text. Demoted — tendencies take priority for reasoning. */
  description: string;
  retailer_links: RetailerLink[];
  notes?: string;
  /**
   * Explicit archetype tags. When present, these override trait-inferred
   * archetypes. Use this to prevent misclassification of gear whose
   * sonic character doesn't reduce cleanly to trait-weighted scoring.
   */
  archetypes?: {
    primary: import('../archetype').SonicArchetype;
    secondary?: import('../archetype').SonicArchetype;
  };
  /**
   * Curated sonic tendencies: character, interactions, and trade-offs.
   * When present and confidence is not 'provisional', these drive
   * advisory explanations instead of the description field.
   */
  tendencies?: ProductTendencies;
  /**
   * Named source references — review publications, measurement resources,
   * or trusted community references that informed the product's tendency data.
   * Surfaced in the "Sources" section of advisory responses.
   */
  sourceReferences?: Array<{ source: string; note: string }>;
}

export const DAC_PRODUCTS: Product[] = [
  // ── Budget tier ($100–$300) ─────────────────────────

  {
    id: 'schiit-modius-e',
    brand: 'Schiit',
    name: 'Modius E',
    price: 199,
    category: 'dac',
    architecture: 'delta-sigma (AKM)',
    subcategory: 'standalone-dac',
    priceTier: 'budget',
    brandScale: 'specialist',
    region: 'north-america',
    country: 'US',
    topology: 'delta-sigma',
    archetypes: { primary: 'precision_explicit' },
    tendencyProfile: {
      basis: 'editorial_inference',
      confidence: 'medium',
      tendencies: [
        { trait: 'clarity', level: 'present' },
        { trait: 'flow', level: 'less_emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 0.4,
      tonal_density: 0.4,
      clarity: 0.7,
      dynamics: 0.4,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.4,
      composure: 0.4,
    },
    description:
      'Clean, balanced entry point with AKM conversion. Honest rather than euphonic — a competent foundation that stays out of the way.',
    retailer_links: [
      { label: 'Schiit', url: 'https://www.schiit.com/products/modius' },
    ],
  },

  {
    id: 'smsl-do300',
    brand: 'SMSL',
    name: 'DO300',
    price: 349,
    category: 'dac',
    architecture: 'delta-sigma (ESS)',
    subcategory: 'standalone-dac',
    priceTier: 'budget',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    topology: 'delta-sigma',
    archetypes: { primary: 'precision_explicit', secondary: 'rhythmic_propulsive' },
    tendencyProfile: {
      basis: 'editorial_inference',
      confidence: 'medium',
      tendencies: [
        { trait: 'clarity', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'flow', level: 'less_emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
      ],
      riskFlags: ['glare_risk'],
    },
    traits: {
      flow: 0.4,
      tonal_density: 0.4,
      clarity: 0.7,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.4,
      elasticity: 0.4,
      texture: 0.4,
      composure: 0.4,
    },
    description:
      'ESS Sabre-based design with strong measured performance. Prioritizes clarity and dynamic range over tonal warmth.',
    retailer_links: [
      { label: 'Amazon', url: 'https://www.amazon.com/dp/B0BPRL3GYX' },
      { label: 'Apos Audio', url: 'https://apos.audio/products/smsl-do300' },
    ],
    notes: 'Can lean analytical in bright systems. Pairs well with warmer amplifiers.',
  },

  // ── Mid tier ($400–$700) ────────────────────────────

  {
    id: 'topping-d70-pro-sabre',
    brand: 'Topping',
    name: 'D70 Pro SABRE',
    price: 450,
    category: 'dac',
    architecture: 'delta-sigma (ESS)',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    topology: 'delta-sigma',
    archetypes: { primary: 'precision_explicit', secondary: 'rhythmic_propulsive' },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'elasticity', level: 'present' },
        { trait: 'flow', level: 'less_emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
      ],
      riskFlags: ['glare_risk'],
    },
    traits: {
      flow: 0.4,
      tonal_density: 0.4,
      clarity: 1.0,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.4,
      elasticity: 0.7,
      texture: 0.4,
      composure: 0.4,
    },
    description:
      'Dual ES9038Pro implementation emphasizing transient precision and wide dynamic range. A speed-first design.',
    retailer_links: [
      { label: 'Amazon', url: 'https://www.amazon.com/dp/B0CL5FCRPQ' },
      { label: 'Apos Audio', url: 'https://apos.audio/products/topping-d70-pro-sabre' },
    ],
    notes: 'Very explicit presentation. May feel relentless in systems already biased toward speed.',
  },

  {
    id: 'gustard-x16',
    brand: 'Gustard',
    name: 'X16',
    price: 550,
    category: 'dac',
    architecture: 'delta-sigma (ESS)',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    topology: 'delta-sigma',
    archetypes: { primary: 'precision_explicit' },
    tendencyProfile: {
      basis: 'editorial_inference',
      confidence: 'medium',
      tendencies: [
        { trait: 'clarity', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'flow', level: 'less_emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 0.4,
      tonal_density: 0.4,
      clarity: 0.7,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.7,
      composure: 0.4,
    },
    description:
      'Well-rounded ESS implementation with good texture and detail retrieval. Less aggressive than the Topping, more neutral than the Denafrips.',
    retailer_links: [
      { label: 'Amazon', url: 'https://www.amazon.com/dp/B09RFDMZPJ' },
      { label: 'Apos Audio', url: 'https://apos.audio/products/gustard-x16' },
    ],
  },

  {
    id: 'denafrips-ares-12th-1',
    brand: 'Denafrips',
    name: 'Ares 12th-1',
    price: 600,
    category: 'dac',
    architecture: 'R-2R',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'southeast-asia',
    country: 'SG',
    topology: 'r2r',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'clarity', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 0.7,
      tonal_density: 0.7,
      clarity: 0.4,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.7,
      composure: 0.4,
      elasticity: 0.4,
    },
    description:
      'Entry-level R-2R with strong tonal density and natural rhythmic flow. Favors body and engagement over analytical precision.',
    retailer_links: [
      { label: 'Vinshine Audio', url: 'https://www.vinshineaudio.com/product/denafrips-ares-12th-1' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'dense harmonic texture with physical midrange weight', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'relaxed sense of timing — notes bloom rather than snap', basis: 'listener_consensus' },
        { domain: 'texture', tendency: 'grain-free, slightly soft-focused detail retrieval', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with bright or analytical amplifiers', effect: 'tends to temper upper-frequency edge without dulling transients', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in systems already biased toward warmth', effect: 'can compound density — midrange may feel heavy or congested', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'tonal body and listening ease', cost: 'the last degree of transient precision and analytical separation', relative_to: 'delta-sigma designs at this price', basis: 'review_consensus' },
      ],
    },
  },

  {
    id: 'schiit-bifrost-2-64',
    brand: 'Schiit',
    name: 'Bifrost 2/64',
    price: 699,
    category: 'dac',
    architecture: 'multibit',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'north-america',
    country: 'US',
    topology: 'multibit',
    archetypes: { primary: 'rhythmic_propulsive', secondary: 'tonal_saturated' },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'flow', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'elasticity', level: 'present' },
        { trait: 'texture', level: 'present' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 0.7,
      tonal_density: 0.7,
      clarity: 0.7,
      dynamics: 1.0,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      elasticity: 0.7,
      texture: 0.7,
      composure: 0.4,
    },
    description:
      'Multibit architecture with exceptional dynamic snap and rhythmic drive. Combines tonal weight with transient precision — an engagement-first design.',
    retailer_links: [
      { label: 'Schiit', url: 'https://www.schiit.com/products/bifrost' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'timing', tendency: 'fast, decisive leading edges — notes start with conviction', basis: 'review_consensus' },
        { domain: 'dynamics', tendency: 'punchy macrodynamics with good microdynamic gradation', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'more tonal weight than typical delta-sigma, less saturated than dedicated R-2R', basis: 'listener_consensus' },
        { domain: 'texture', tendency: 'slightly grainy at high frequencies compared to smoother ESS implementations', basis: 'editorial_inference' },
      ],
      interactions: [
        { condition: 'paired with tube amplification', effect: 'dynamic directness tends to survive the tube stage, gaining bloom without losing rhythmic snap', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in systems already biased toward speed and precision', effect: 'can compound the forward presentation — may feel relentless over long sessions', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'rhythmic engagement and dynamic directness', cost: 'the smoothest possible treble and the deepest harmonic saturation', relative_to: 'R-2R designs at this price', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Schiit Audio', note: 'Manufacturer commentary on multibit unison USB architecture.' },
      { source: 'Darko.Audio', note: 'Video review comparing Bifrost 2 to competing R-2R and delta-sigma designs.' },
    ],
  },

  {
    id: 'topping-d90se',
    brand: 'Topping',
    name: 'D90SE',
    price: 700,
    category: 'dac',
    architecture: 'delta-sigma (ESS)',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    topology: 'delta-sigma',
    archetypes: { primary: 'precision_explicit' },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'composure', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'flow', level: 'less_emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
      ],
      riskFlags: ['glare_risk'],
    },
    traits: {
      flow: 0.4,
      tonal_density: 0.4,
      clarity: 1.0,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.4,
      elasticity: 0.4,
      texture: 0.4,
      composure: 0.7,
    },
    description:
      'Reference-grade ESS Sabre implementation with very low distortion and wide bandwidth. Precision and composure over musicality.',
    retailer_links: [
      { label: 'Amazon', url: 'https://www.amazon.com/dp/B09DVCCQGP' },
      { label: 'Apos Audio', url: 'https://apos.audio/products/topping-d90se' },
    ],
    notes: 'Strengths are measured performance. Can feel clinical in systems that lack warmth upstream.',
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'lean tonal balance — prioritizes separation over body', basis: 'review_consensus' },
        { domain: 'spatial', tendency: 'precise imaging with well-defined instrument placement', basis: 'review_consensus' },
        { domain: 'dynamics', tendency: 'controlled dynamic delivery — composed rather than explosive', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'paired with warm or tube-based amplification', effect: 'tends to provide a transparent, clean source that lets the amplifier add color', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in systems that are already lean or bright', effect: 'can feel clinical — the precision becomes sterility without compensating warmth', valence: 'caution', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'measured transparency and composure', cost: 'tonal richness and harmonic engagement', relative_to: 'R-2R and multibit designs at this price', basis: 'review_consensus' },
      ],
    },
  },

  // ── Upper-mid tier ($700–$1000) ─────────────────────

  {
    id: 'mhdt-orchid',
    brand: 'MHDT',
    name: 'Orchid',
    price: 800,
    category: 'dac',
    architecture: 'NOS tube',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'boutique',
    region: 'east-asia',
    country: 'TW',
    topology: 'nos',
    archetypes: { primary: 'flow_organic', secondary: 'tonal_saturated' },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'clarity', level: 'less_emphasized' },
        { trait: 'dynamics', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 1.0,
      tonal_density: 0.7,
      clarity: 0.4,
      dynamics: 0.4,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 1.0,
      composure: 0.7,
      elasticity: 0.4,
    },
    description:
      'Non-oversampling tube output design prioritizing musical flow and texture. Smooths digital edges without losing rhythmic coherence.',
    retailer_links: [
      { label: 'MHDT Labs', url: 'https://www.mhdtlab.com/orchid.htm' },
    ],
    notes: 'Detail retrieval is softer than delta-sigma designs. Best paired with revealing amplifiers and speakers.',
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'timing', tendency: 'unhurried phrasing — music flows rather than pushes', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'rich tactile quality — rosin, breath, and decay feel physical', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'warm midrange emphasis with gently rolled upper frequencies', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'paired with revealing or analytical amplifiers', effect: 'the tube output smooths the upstream signal while the amplifier preserves detail — a complementary pairing', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in systems that already lean warm and smooth', effect: 'can push the balance too far toward softness — transient definition may suffer', valence: 'caution', basis: 'editorial_inference' },
        { condition: 'with tube rolling', effect: 'character shifts meaningfully with different tube types — a significant tuning variable', valence: 'neutral', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'musical continuity, texture, and listening ease', cost: 'transient sharpness and micro-detail retrieval', relative_to: 'oversampling designs at this price', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: '6Moons', note: 'Review covering the NOS tube output stage and its effect on musical continuity.' },
      { source: 'Audiogon community', note: 'Tube-rolling reports and system pairing impressions.' },
    ],
  },

  {
    id: 'eversolo-dac-z8',
    brand: 'Eversolo',
    name: 'DAC-Z8',
    price: 799,
    category: 'dac',
    architecture: 'delta-sigma (ESS)',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    topology: 'delta-sigma',
    archetypes: { primary: 'precision_explicit' },
    tendencyProfile: {
      basis: 'editorial_inference',
      confidence: 'medium',
      tendencies: [
        { trait: 'clarity', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'flow', level: 'less_emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 0.4,
      tonal_density: 0.4,
      clarity: 0.7,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.4,
      composure: 0.7,
      elasticity: 0.4,
    },
    description:
      'Feature-rich ESS-based DAC with balanced output, MQA decoding, and built-in headphone amplifier. Versatile and well-rounded.',
    retailer_links: [
      { label: 'Amazon', url: 'https://www.amazon.com/dp/B0DJCCBSMZ' },
      { label: 'Apos Audio', url: 'https://apos.audio/products/eversolo-dac-z8' },
    ],
  },

  // ── Serious tier ($1000–$1500) ──────────────────────

  {
    id: 'rme-adi-2-dac-fs',
    brand: 'RME',
    name: 'ADI-2 DAC FS',
    price: 1099,
    category: 'dac',
    architecture: 'delta-sigma (AKM)',
    subcategory: 'dac-preamp',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'europe',
    country: 'DE',
    topology: 'delta-sigma',
    archetypes: { primary: 'precision_explicit' },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'composure', level: 'emphasized' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'flow', level: 'less_emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 0.4,
      tonal_density: 0.4,
      clarity: 1.0,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.7,
      composure: 1.0,
      elasticity: 0.4,
    },
    description:
      'Pro-audio heritage with parametric EQ, crossfeed, and exceptional measured performance. A precision instrument — transparent, composed, and deeply configurable.',
    retailer_links: [
      { label: 'B&H Photo', url: 'https://www.bhphotovideo.com/c/product/1543585-REG/' },
      { label: 'Amazon', url: 'https://www.amazon.com/dp/B07Y2GBLQR' },
    ],
    notes: 'The built-in parametric EQ is a significant advantage for system tuning. Not the most emotionally engaging, but extraordinarily capable.',
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'ruler-flat tonal balance with no editorial voice', basis: 'review_consensus' },
        { domain: 'spatial', tendency: 'precise, stable imaging with clear center focus', basis: 'review_consensus' },
        { domain: 'dynamics', tendency: 'composed and controlled — maintains grip without excess energy', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'with its built-in parametric EQ', effect: 'allows targeted correction of room or headphone frequency response issues — a significant system-tuning advantage', valence: 'positive', basis: 'manufacturer_intent' },
        { condition: 'for listeners who prioritize emotional engagement', effect: 'the neutral transparency can feel uninvolved — it reveals everything but editorializes nothing', valence: 'neutral', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'transparency, configurability, and measured performance', cost: 'the harmonic coloration and musical editorializing that some listeners find engaging', relative_to: 'R-2R and tube designs at this price', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Audio Science Review', note: 'Comprehensive measurements confirming exceptional SINAD and parametric EQ capabilities.' },
      { source: 'Head-Fi community', note: 'Extensive headphone pairing reports and EQ configuration sharing.' },
    ],
  },

  {
    id: 'chord-hugo',
    brand: 'Chord',
    name: 'Hugo',
    price: 1600,
    category: 'dac',
    architecture: 'FPGA',
    subcategory: 'portable-dac',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'uk',
    country: 'GB',
    topology: 'fpga',
    archetypes: { primary: 'precision_explicit', secondary: 'flow_organic' },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'flow', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'tonal_density', level: 'less_emphasized' },
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
      elasticity: 0.4,
      composure: 0.4,
    },
    description:
      'Portable FPGA-based DAC/headphone amplifier with Chord\'s proprietary pulse array technology. Shares the Chord house sound — timing precision and transient clarity — in a compact form factor with crossfeed and headphone output.',
    retailer_links: [
      { label: 'Chord Electronics', url: 'https://chordelectronics.co.uk/product/hugo/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'timing', tendency: 'fast, precise transient resolution from FPGA pulse array — the Chord signature at a portable scale', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'lighter tonal balance than desktop Chord units — speed over weight', basis: 'listener_consensus' },
        { domain: 'spatial', tendency: 'good headphone staging for a portable device, with usable crossfeed', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'as a desktop source feeding external amplification', effect: 'the timing precision translates well but the output stage is optimised for headphones — dedicated desktop sources may have more authority', valence: 'neutral', basis: 'editorial_inference' },
        { condition: 'paired with warm headphones or IEMs', effect: 'the Chord clarity tends to complement warmer transducers without thinning the presentation', valence: 'positive', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'portability, timing precision, and Chord FPGA character', cost: 'the scale, composure, and output authority of desktop Chord units like Qutest or Hugo TT2', relative_to: 'Chord desktop lineup', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'What Hi-Fi?', note: 'Review of original Hugo covering portability and Chord FPGA character.' },
      { source: 'Head-Fi community', note: 'Extensive headphone pairing impressions and comparisons with Hugo 2 and Qutest.' },
    ],
  },

  {
    id: 'chord-hugo-tt2',
    brand: 'Chord',
    name: 'Hugo TT2',
    price: 5495,
    category: 'dac',
    architecture: 'FPGA',
    subcategory: 'dac-preamp',
    priceTier: 'high-end',
    brandScale: 'specialist',
    region: 'uk',
    country: 'GB',
    topology: 'fpga',
    archetypes: { primary: 'precision_explicit', secondary: 'flow_organic' },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'composure', level: 'emphasized' },
        { trait: 'flow', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'elasticity', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 0.7,
      tonal_density: 0.7,
      clarity: 1.0,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.7,
      elasticity: 0.7,
      composure: 1.0,
    },
    description:
      'Desktop reference FPGA DAC/preamp with significantly more taps than the Hugo or Qutest. The additional processing power delivers greater composure, fuller tonal density, and a more effortless presentation while retaining the Chord timing signature.',
    retailer_links: [
      { label: 'Chord Electronics', url: 'https://chordelectronics.co.uk/product/hugo-tt2/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'timing', tendency: 'the same FPGA pulse array timing precision as the Qutest and Hugo, but with greater effortlessness — transients resolve fully without strain', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'more tonal weight and midrange authority than lower Chord models — the additional tap count fills out the harmonic picture', basis: 'listener_consensus' },
        { domain: 'spatial', tendency: 'wide, composed staging with excellent depth layering and stable imaging', basis: 'review_consensus' },
        { domain: 'dynamics', tendency: 'effortless dynamic scaling — handles peaks without compression or hardening', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'as a preamp driving power amplification directly', effect: 'the preamp output stage is designed for this use — tends to deliver a more composed result than running through a separate preamp', valence: 'positive', basis: 'manufacturer_intent' },
        { condition: 'compared to Qutest or Hugo in the same system', effect: 'the primary gains are composure, tonal density, and effortlessness — the timing signature is shared but the Hugo TT2 delivers it with greater authority', valence: 'positive', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'composure, tonal density, effortless dynamics, and preamp capability', cost: 'significant price premium over Qutest for incremental rather than architectural change', relative_to: 'Chord Qutest and Hugo', basis: 'listener_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Stereophile', note: 'Review covering Hugo TT2 tap count, composure, and desktop reference performance.' },
      { source: 'Darko.Audio', note: 'Comparison with Qutest and Hugo 2 covering upgrade path reasoning.' },
      { source: 'Head-Fi community', note: 'Extensive impressions on Hugo TT2 as preamp/DAC and comparisons within the Chord lineup.' },
    ],
  },

  {
    id: 'chord-qutest',
    brand: 'Chord',
    name: 'Qutest',
    price: 1295,
    category: 'dac',
    architecture: 'FPGA',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'uk',
    country: 'GB',
    topology: 'fpga',
    archetypes: { primary: 'precision_explicit', secondary: 'flow_organic' },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'flow', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'elasticity', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'tonal_density', level: 'less_emphasized' },
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
      elasticity: 0.7,
      composure: 0.7,
    },
    description:
      'FPGA-based pulse array design with exceptional timing resolution and transient definition. Detail without analytical edge — fast, articulate, and composed.',
    retailer_links: [
      { label: 'Amazon', url: 'https://www.amazon.com/dp/B079C63P1V' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'timing', tendency: 'exceptional transient resolution — leading edges are fast and fully formed', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'lighter tonal weight than R-2R designs but avoids the thinness of typical delta-sigma', basis: 'listener_consensus' },
        { domain: 'texture', tendency: 'fine-grained detail without analytical edge — reveals texture without harsh spotlighting', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with warm or tonally dense amplification', effect: 'the timing precision and clarity tend to cut through added warmth rather than being masked by it', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in systems that already emphasize speed and transparency', effect: 'can tilt the balance toward analytical — the tonal lightness may become noticeable', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'timing precision and articulate detail', cost: 'the tonal density and midrange weight of R-2R conversion', relative_to: 'Denafrips and other R-2R designs', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Darko.Audio', note: 'Review covering FPGA pulse array architecture and transient performance.' },
      { source: 'What Hi-Fi?', note: 'Multi-award coverage noting detail retrieval and timing.' },
      { source: 'Head-Fi community', note: 'Extensive listener impressions on tonal weight vs clarity balance.' },
    ],
  },

  {
    id: 'denafrips-pontus-ii-12th-1',
    brand: 'Denafrips',
    name: 'Pontus II 12th-1',
    price: 1499,
    category: 'dac',
    architecture: 'R-2R',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'southeast-asia',
    country: 'SG',
    topology: 'r2r',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'clarity', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'elasticity', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 1.0,
      tonal_density: 1.0,
      clarity: 0.7,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 1.0,
      composure: 0.7,
      elasticity: 0.4,
    },
    description:
      'Full-scale R-2R with rich tonal density, strong harmonic texture, and refined composure. Prioritizes body and musical weight over transient sharpness.',
    retailer_links: [
      { label: 'Vinshine Audio', url: 'https://www.vinshineaudio.com/product/denafrips-pontus-ii-12th-1' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'rich harmonic density with physical midrange presence', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'layered, dimensional texture — instruments have body and resonance', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'relaxed but coherent — phrasing breathes without losing rhythmic thread', basis: 'listener_consensus' },
        { domain: 'spatial', tendency: 'deep, holographic staging with good layering front-to-back', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'paired with fast or precision-oriented amplifiers', effect: 'the R-2R tonal density and the amplifier\'s speed tend to complement — body without sluggishness', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in systems that are already tonally dense or warm', effect: 'the cumulative weight can reduce clarity — bass and lower midrange may feel heavy', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'harmonic richness, texture, and tonal authority', cost: 'transient sharpness and the explicit separation of delta-sigma designs', relative_to: 'ESS-based DACs at this price', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Audiophile Style', note: 'Detailed review of R-2R architecture and harmonic character.' },
      { source: 'Audio Science Review', note: 'Measurement and listening coverage of the 12th anniversary revision.' },
      { source: 'Head-Fi / Audiogon communities', note: 'Extensive comparisons with Chord, Schiit, and ESS-based alternatives.' },
    ],
  },

  {
    id: 'gustard-r26',
    brand: 'Gustard',
    name: 'R26',
    price: 1499,
    category: 'dac',
    architecture: 'R-2R',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    topology: 'r2r',
    archetypes: { primary: 'tonal_saturated', secondary: 'precision_explicit' },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'elasticity', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 0.7,
      tonal_density: 0.7,
      clarity: 0.7,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.7,
      composure: 0.7,
      elasticity: 0.4,
    },
    description:
      'Discrete R-2R implementation offering a balance of clarity and tonal body. Less warm than the Denafrips, more textured than delta-sigma alternatives.',
    retailer_links: [
      { label: 'Amazon', url: 'https://www.amazon.com/dp/B0BL2F62LJ' },
      { label: 'Apos Audio', url: 'https://apos.audio/products/gustard-r26' },
    ],
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'tonality', tendency: 'balanced tonal presentation — body without excess warmth', basis: 'listener_consensus' },
        { domain: 'texture', tendency: 'finer-grained texture than typical R-2R, closer to delta-sigma resolution', basis: 'editorial_inference' },
        { domain: 'dynamics', tendency: 'even dynamic delivery — controlled rather than explosive', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'for listeners moving from delta-sigma to R-2R', effect: 'a gentler architectural transition — retains clarity while adding body', valence: 'positive', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'a middle ground between R-2R warmth and delta-sigma precision', cost: 'the full tonal saturation of Denafrips or the explicit speed of ESS designs', relative_to: 'both R-2R and delta-sigma at this price', basis: 'editorial_inference' },
      ],
    },
  },
];
