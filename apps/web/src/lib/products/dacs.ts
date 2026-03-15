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
import type { PrimaryAxisLeanings, FatigueAssessment } from '../axis-types';
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
   * Primary advisory axis leanings (v1 trait framework).
   * When present, these are the first thing the engine reads when
   * reasoning about the product's character. Secondary traits in
   * tendencyProfile provide explanatory depth.
   */
  primaryAxes?: PrimaryAxisLeanings;
  /**
   * Fatigue assessment — system-outcome overlay.
   * Describes when and why this product may contribute to fatigue.
   */
  fatigueAssessment?: FatigueAssessment;
  /**
   * Placement sensitivity for speakers — flags designs whose performance
   * depends significantly on room positioning. Compact standmounts, open-
   * baffle, and horn-loaded designs often have strong placement dependencies.
   */
  placementSensitivity?: {
    level: 'low' | 'moderate' | 'high';
    notes: string;
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

  // ── Availability metadata ─────────────────────────────

  /** Market availability status. Defaults to 'current' when omitted. */
  availability?: 'current' | 'discontinued' | 'vintage';
  /** Where this product is typically found. Defaults to 'new' when omitted. */
  typicalMarket?: 'new' | 'used' | 'both';
  /** Approximate used-market price range (USD), for discontinued/vintage products. */
  usedPriceRange?: { low: number; high: number };
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
    // Axis reasoning: AKM delta-sigma, clean but uninflected. Clarity present
    // but not emphasized — sits near neutral on most axes. Slightly bright of
    // center due to lean tonal density; not detailed enough to be 'detailed'.
    primaryAxes: {
      warm_bright: 'neutral',       // Lean tonal density but no glare — not warm, not bright
      smooth_detailed: 'neutral',    // Moderate clarity, moderate flow — neither smooth nor revealing
      elastic_controlled: 'neutral', // No strong dynamic character in either direction
      airy_closed: 'neutral',       // No spatial data to distinguish
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Neutral, unimposing character — unlikely to fatigue. May bore rather than tire.',
    },
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
    // Axis reasoning: ESS Sabre with clarity and dynamics present, flow/density
    // less emphasized. Glare risk flag. Leans bright (lean tonal density + glare risk),
    // detailed (clarity-forward), neutral on dynamics, neutral on staging.
    primaryAxes: {
      warm_bright: 'bright',         // Lean density + glare risk → bright of neutral
      smooth_detailed: 'detailed',   // Clarity present, flow less_emphasized → detail-forward
      elastic_controlled: 'neutral', // Dynamics present but not dominant
      airy_closed: 'neutral',       // No strong spatial signature
    },
    fatigueAssessment: {
      risk: 'context_dependent',
      notes: 'Glare risk in bright systems. Pairs well with warmer amplifiers where the brightness is offset.',
    },
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
      { label: 'SMSL', url: 'https://www.smsl-audio.com/portal/product/detail/id/879.html' },
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
    // Axis reasoning: Dual ES9038Pro — clarity emphasized, flow/density less_emphasized,
    // glare risk. "Speed-first design." Very explicit presentation. Clearly bright,
    // clearly detailed. Elasticity present → elastic lean. No spatial data.
    primaryAxes: {
      warm_bright: 'bright',              // Clarity 1.0, density 0.4, glare risk
      smooth_detailed: 'detailed',        // Clarity emphasized, flow less_emphasized
      elastic_controlled: 'elastic',      // Elasticity present, dynamics present — speed-first
      airy_closed: 'neutral',            // No strong spatial signature
    },
    fatigueAssessment: {
      risk: 'context_dependent',
      notes: 'Relentless in systems already biased toward speed. Glare risk with bright speakers or cables.',
    },
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
      { label: 'Topping', url: 'https://www.toppingaudio.com/product-item/d70-pro-sabre' },
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
    // Axis reasoning: ESS-based with clarity and texture both present, no glare risk.
    // "Less aggressive than the Topping, more neutral than the Denafrips."
    // Described as well-rounded — sits near neutral on warm/bright but leans
    // slightly detailed due to clarity present + flow less_emphasized.
    primaryAxes: {
      warm_bright: 'neutral',         // No glare, no warmth emphasis — true neutral
      smooth_detailed: 'detailed',    // Clarity+texture present, flow less_emphasized
      elastic_controlled: 'neutral',  // Dynamics present but not defining
      airy_closed: 'neutral',        // No spatial data
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Well-rounded, no glare risk. Unlikely to fatigue in most systems.',
    },
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
      { label: 'Gustard', url: 'https://www.gustard.cn/productinfo/3758918.html' },
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
    architecture: 'R2R',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'southeast-asia',
    country: 'SG',
    topology: 'r2r',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    // Axis reasoning: Entry R2R — "body and engagement over analytical precision."
    // Flow+density present, clarity less_emphasized. Dense harmonic texture, relaxed
    // timing. Warm, smooth, neutral dynamics, neutral staging.
    primaryAxes: {
      warm_bright: 'warm',            // Tonal density 0.7, flow 0.7, clarity 0.4 — clearly warm
      smooth_detailed: 'smooth',      // Flow present, clarity less_emphasized, "relaxed timing"
      elastic_controlled: 'neutral',  // Dynamics present but neither elastic nor controlled
      airy_closed: 'neutral',        // No strong spatial data
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Warmth and ease make fatigue unlikely. Risk is congestion rather than fatigue in already-warm systems.',
    },
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
      'Entry-level R2R with strong tonal density and natural rhythmic flow. Favors body and engagement over analytical precision.',
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
    sourceReferences: [
      { source: 'Darko.Audio', note: 'Review covering Denafrips R2R house sound and the Ares as entry point to the lineup.' },
      { source: 'The Audiophiliac', note: 'Steve Guttenberg review praising the Ares II for musicality and engagement at its price.' },
      { source: 'Twittering Machines', note: 'Positive coverage of the R2R tonal character and listening ease.' },
      { source: 'Head-Fi community', note: 'Extensive owner comparisons with Bifrost 2, SMSL, and Topping alternatives.' },
    ],
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
    // Axis reasoning: "Exceptional dynamic snap and rhythmic drive." Dynamics 1.0,
    // elasticity 0.7, flow 0.7, density 0.7, clarity 0.7. This is an engagement-first
    // design that carries tonal weight AND transient precision. Warm due to density,
    // neutral on smooth/detailed (has both flow and clarity), strongly elastic.
    primaryAxes: {
      warm_bright: 'warm',            // Tonal density 0.7, flow 0.7 — warm with body
      smooth_detailed: 'neutral',     // Both flow 0.7 and clarity 0.7 — neither dominates
      elastic_controlled: 'elastic',  // Dynamics 1.0, elasticity 0.7 — the defining trait
      airy_closed: 'neutral',        // No spatial emphasis
    },
    fatigueAssessment: {
      risk: 'context_dependent',
      notes: 'Dynamic energy is high — can feel relentless in speed-biased systems. Low fatigue in warm or controlled pairings.',
    },
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
        { domain: 'tonality', tendency: 'more tonal weight than typical delta-sigma, less saturated than dedicated R2R', basis: 'listener_consensus' },
        { domain: 'texture', tendency: 'slightly grainy at high frequencies compared to smoother ESS implementations', basis: 'editorial_inference' },
      ],
      interactions: [
        { condition: 'paired with tube amplification', effect: 'dynamic directness tends to survive the tube stage, gaining bloom without losing rhythmic snap', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in systems already biased toward speed and precision', effect: 'can compound the forward presentation — may feel relentless over long sessions', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'rhythmic engagement and dynamic directness', cost: 'the smoothest possible treble and the deepest harmonic saturation', relative_to: 'R2R designs at this price', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Schiit Audio', note: 'Manufacturer commentary on multibit unison USB architecture.' },
      { source: 'Darko.Audio', note: 'Video review comparing Bifrost 2 to competing R2R and delta-sigma designs.' },
      { source: 'The Audiophiliac', note: 'Steve Guttenberg review praising the Bifrost as a musical, engaging multibit alternative.' },
      { source: 'Stereophile', note: 'Herb Reichert review covering tonal weight and dynamic character.' },
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
    // Axis reasoning: "Reference-grade ESS Sabre. Precision and composure over musicality."
    // Clarity 1.0, composure 0.7, flow 0.4, density 0.4, glare risk. "Lean tonal balance."
    // "Composed rather than explosive." "Can feel clinical."
    primaryAxes: {
      warm_bright: 'bright',              // Clarity 1.0, density 0.4, "lean" — clearly bright
      smooth_detailed: 'detailed',        // Clarity emphasized, flow less_emphasized
      elastic_controlled: 'controlled',   // Composure 0.7, "composed rather than explosive"
      airy_closed: 'neutral',            // "Precise imaging" but not described as airy
    },
    fatigueAssessment: {
      risk: 'context_dependent',
      notes: 'Can feel clinical in lean systems — sterility rather than glare. Low fatigue when paired with warm or tube amplification.',
    },
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
      { label: 'Topping', url: 'https://www.toppingaudio.com/product-item/d90se' },
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
        { gains: 'measured transparency and composure', cost: 'tonal richness and harmonic engagement', relative_to: 'R2R and multibit designs at this price', basis: 'review_consensus' },
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
    // Axis reasoning: NOS tube output — "musical flow and texture." Flow 1.0,
    // texture 1.0, density 0.7, clarity 0.4, dynamics 0.4. "Unhurried phrasing."
    // "Warm midrange emphasis with gently rolled upper frequencies."
    // The quintessential warm+smooth product. Controlled by default (composure 0.7).
    primaryAxes: {
      warm_bright: 'warm',            // Density 0.7, "warm midrange emphasis" — definitively warm
      smooth_detailed: 'smooth',      // Flow 1.0, clarity 0.4 — definitively smooth
      elastic_controlled: 'controlled', // Composure 0.7, dynamics 0.4 — composed, not explosive
      airy_closed: 'neutral',        // No strong spatial emphasis documented
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'NOS tube output inherently eases fatigue. Risk is over-softness in already-warm chains, not listening discomfort.',
    },
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
      { source: 'Twittering Machines', note: 'Coverage of the Orchid as a musically engaging NOS alternative.' },
      { source: 'The Audiophiliac', note: 'Steve Guttenberg review praising the Orchid for organic musicality.' },
      { source: 'Audiogon community', note: 'Tube-rolling reports and system pairing impressions.' },
    ],
  },

  // ── Goldmund / JOB ──────────────────────────────────────

  {
    id: 'goldmund-srda',
    brand: 'Goldmund',
    name: 'SRDA DAC',
    price: 3500,
    usedPriceRange: { low: 1200, high: 2500 },
    availability: 'discontinued',
    typicalMarket: 'used',
    category: 'dac',
    architecture: 'Goldmund proprietary DAC module (internal to Goldmund amplifiers and available standalone)',
    subcategory: 'standalone-dac',
    priceTier: 'upper-mid',
    brandScale: 'specialist',
    region: 'europe',
    country: 'CH',
    topology: 'delta-sigma',
    archetypes: { primary: 'precision_explicit' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'neutral',
      warm_bright_n: 0,
      smooth_detailed_n: 1,
      elastic_controlled_n: 1,
      airy_closed_n: 0,
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Extremely neutral and composed. No grain, no edge. May lack excitement rather than cause fatigue.',
    },
    tendencyProfile: {
      basis: 'founder_reference',
      confidence: 'founder_reference',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'composure', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'speed', level: 'present' },
        { trait: 'dynamics', level: 'less_emphasized' },
        { trait: 'warmth', level: 'less_emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
        { trait: 'flow', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 1.0,
      composure: 1.0,
      spatial_precision: 0.7,
      speed: 0.7,
      dynamics: 0.4,
      warmth: 0.4,
      tonal_density: 0.4,
      flow: 0.4,
      texture: 0.4,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Goldmund\'s proprietary DAC module — designed for extreme neutrality and composure. Less sparkle and excitement than the JOB internal DAC section, but exceptionally stable and transparent. A reference point for measured precision over musical engagement.',
    retailer_links: [
      { label: 'HiFi Shark (used)', url: 'https://www.hifishark.com/search?q=goldmund+dac' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'extremely neutral and transparent — no added warmth or coloration', basis: 'founder_reference' },
        { domain: 'spatial', tendency: 'composed and precise — imaging is stable and well-defined', basis: 'founder_reference' },
        { domain: 'timing', tendency: 'controlled and deliberate — prioritises stability over rhythmic excitement', basis: 'founder_reference' },
      ],
      interactions: [
        { condition: 'paired with lively, dynamic amplification', effect: 'the neutrality lets upstream character through while adding composure', valence: 'positive', basis: 'founder_reference' },
        { condition: 'in systems already neutral or controlled', effect: 'may feel too restrained — lacks the sparkle to animate a reserved system', valence: 'caution', basis: 'founder_reference' },
      ],
      tradeoffs: [
        { gains: 'neutrality, composure, and transparency', cost: 'musical excitement, dynamic spark, and the engaging quality of more characterful DACs', relative_to: 'TotalDAC, Denafrips, or Holo Audio R2R designs', basis: 'founder_reference' },
      ],
    },
    notes: 'Discontinued. The Goldmund DAC module appears in various Goldmund components. Standalone units available on the used market.',
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
    // Axis reasoning: ESS-based, "versatile and well-rounded." Clarity, dynamics,
    // composure all present; flow and density less_emphasized. No glare risk.
    // Similar profile to Gustard X16 but with more composure. Slightly bright
    // due to density deficit, slightly detailed, slightly controlled.
    primaryAxes: {
      warm_bright: 'neutral',             // No glare, but density is low — borderline; call neutral
      smooth_detailed: 'detailed',        // Clarity present, flow less_emphasized
      elastic_controlled: 'controlled',   // Composure 0.7, "well-rounded" — measured, not explosive
      airy_closed: 'neutral',            // No spatial emphasis
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'No glare risk, good composure. Versatile and unlikely to fatigue.',
    },
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
      { label: 'Eversolo', url: 'https://eversolo.com/products/dac-z8' },
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
    // ── CALIBRATED ANCHOR: RME ADI-2 DAC FS ──
    // Axis reasoning: Pro-audio heritage — "ruler-flat tonal balance with no editorial
    // voice." Clarity 1.0, composure 1.0, flow 0.4, density 0.4. "Transparent,
    // composed, and deeply configurable." "Reveals everything but editorializes nothing."
    // The parametric EQ is a system-tuning tool, not a sonic character trait.
    //
    // CALIBRATION: High clarity does NOT imply brightness. The RME is
    // transparency-first with no editorial voice — "ruler-flat" is genuinely
    // neutral rather than bright. The absence of harmonic richness is leanness,
    // not treble emphasis. Neutral per anchor calibration.
    //
    // Warm↔Bright: NEUTRAL — "ruler-flat tonal balance" is the definition of
    //   neutral. High clarity comes from transparency and resolution, not from
    //   treble emphasis or energy shift. No glare risk.
    //
    // Smooth↔Detailed: DETAILED — clarity emphasized, flow less_emphasized.
    //   "Precise, stable imaging." This is a resolving instrument, not a musical one.
    //
    // Elastic↔Controlled: CONTROLLED — composure 1.0, the highest in the catalog.
    //   "Composed and controlled — maintains grip without excess energy." No dynamic
    //   excitement — authority through restraint.
    //
    // Airy↔Closed: NEUTRAL — "precise, stable imaging" is spatial precision, not
    //   spaciousness. No sense of open/airy in the documentation.
    primaryAxes: {
      warm_bright: 'neutral',             // Ruler-flat transparency — genuinely neutral, not bright
      smooth_detailed: 'detailed',        // Resolving, clarity-first
      elastic_controlled: 'controlled',   // Composure 1.0, "maintains grip"
      airy_closed: 'neutral',            // Precise imaging but not spacious
    },
    fatigueAssessment: {
      risk: 'context_dependent',
      notes: 'The precision is clinical rather than sharp — fatigue manifests as disengagement rather than glare. The parametric EQ can correct room or system brightness, which is a unique mitigating factor.',
    },
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
      { label: 'RME', url: 'https://www.rme-audio.de/adi-2-dac.html' },
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
        { gains: 'transparency, configurability, and measured performance', cost: 'the harmonic coloration and musical editorializing that some listeners find engaging', relative_to: 'R2R and tube designs at this price', basis: 'review_consensus' },
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
    // Founder calibration: Hugo v1 is fast, lively, engaging — NOT sterile or purely analytical.
    // Founder experience: fast, alive, electric, open, engaging, slightly light.
    // Clarity comes from FPGA timing precision, not treble energy.
    // Strong air and spatial aliveness. Slightly lean tonal balance.
    primaryAxes: {
      warm_bright: 'bright',          // Slightly bright of neutral — speed and energy over tonal mass
      smooth_detailed: 'detailed',    // Strongly detail-forward — timing precision and transient speed
      elastic_controlled: 'elastic',  // FPGA transient snap, dynamic agility — elastic and alive
      airy_closed: 'airy',           // Very open and spatially alive — air is a defining trait
      // Founder reference calibration
      warm_bright_n: 1,         // Slightly lean — speed and energy over tonal density
      smooth_detailed_n: 2,     // Strongly detailed — timing precision is the primary character
      elastic_controlled_n: -1, // Elastic — lively and dynamically agile
      airy_closed_n: 2,         // Very airy — spatially alive and open
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'No glare risk. Detail comes from timing precision, not treble energy. The liveliness is engaging, not aggressive.',
    },
    tendencyProfile: {
      basis: 'founder_reference',
      confidence: 'founder_reference',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'speed', level: 'emphasized' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'tonal_density', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 1.0,
      speed: 1.0,
      flow: 0.7,
      dynamics: 0.7,
      texture: 0.7,
      elasticity: 0.7,
      tonal_density: 0.4,
      composure: 0.4,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Introduced in 2014, the original Hugo was the first portable application of Rob Watts\' FPGA pulse array architecture. It runs a 26,368-tap filter on a Xilinx Spartan-6 FPGA — far beyond what off-the-shelf DAC chips implement — to achieve timing precision at the microsecond level. Fast, lively, and highly engaging: prioritises transient speed, air, and excitement over tonal density. Slightly tonally light but never sterile — the liveliness is its defining quality.',
    retailer_links: [
      { label: 'Chord Electronics', url: 'https://chordelectronics.co.uk/product/hugo/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'timing', tendency: 'fast, precise, alive — FPGA pulse array delivers transient speed and electric engagement', basis: 'founder_reference' },
        { domain: 'tonality', tendency: 'slightly light tonal balance — speed and energy over density, but never sterile', basis: 'founder_reference' },
        { domain: 'spatial', tendency: 'very open and spatially alive — air and openness are defining traits', basis: 'founder_reference' },
      ],
      interactions: [
        { condition: 'in systems that benefit from energy and openness', effect: 'the Hugo adds life, speed, and spatial excitement — works as an energising source', valence: 'positive', basis: 'founder_reference' },
        { condition: 'paired with warm headphones or speakers', effect: 'the Chord speed and air complement warmer transducers without thinning the presentation', valence: 'positive', basis: 'founder_reference' },
        { condition: 'in already lean or bright systems', effect: 'the slight tonal lightness may compound — needs upstream or downstream body', valence: 'caution', basis: 'founder_reference' },
      ],
      tradeoffs: [
        { gains: 'speed, air, spatial aliveness, and electric engagement', cost: 'tonal grounding and the composure of denser, weightier DACs', relative_to: 'R2R or tube DACs', basis: 'founder_reference' },
      ],
    },
    sourceReferences: [
      { source: 'Founder listening notes', note: 'Calibrated from extended in-system use. Fast, alive, electric, open, engaging, slightly light.' },
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
    // Axis reasoning: Desktop reference FPGA. Clarity 1.0, composure 1.0, but
    // ALSO flow 0.7, density 0.7, elasticity 0.7. "More tonal weight and midrange
    // authority than lower Chord models." The additional tap count fills out the
    // harmonic picture. This is the rare product that has both high clarity AND
    // tonal weight — it doesn't read as bright because the density compensates.
    // "Wide, composed staging with excellent depth layering."
    primaryAxes: {
      warm_bright: 'neutral',             // Clarity 1.0 BUT density 0.7 — they balance
      smooth_detailed: 'detailed',        // Clarity emphasized, flow present — detail leads
      elastic_controlled: 'controlled',   // Composure 1.0, "effortless" — authority through grip
      airy_closed: 'airy',              // "Wide, composed staging with excellent depth layering"
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Effortless presentation with tonal weight. The composure and density prevent the bright-lean fatigue pattern. One of the lowest fatigue risks in the catalog.',
    },
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
    usedPriceRange: { low: 800, high: 1000 },
    availability: 'current',
    typicalMarket: 'both',
    category: 'dac',
    architecture: 'FPGA',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'uk',
    country: 'GB',
    topology: 'fpga',
    archetypes: { primary: 'precision_explicit', secondary: 'flow_organic' },
    // ── PRIORITY ANCHOR: Chord Qutest ──
    // Axis reasoning (CALIBRATED ANCHOR): FPGA pulse array — the archetypal
    // timing-precision DAC. Clarity 1.0, flow 0.7, elasticity 0.7, composure 0.7,
    // density 0.4.
    //
    // CALIBRATION: High clarity does NOT imply brightness. Chord achieves detail
    // through timing accuracy rather than treble emphasis. The Qutest is slightly
    // lean but not bright — neutral is the correct classification.
    //
    // Warm↔Bright: NEUTRAL — slightly lean tonal density (0.4), but clarity
    //   comes from FPGA timing precision, not treble emphasis. No glare risk.
    //   The leanness is noticeable vs warm references but does not constitute
    //   brightness in the treble-energy sense. Neutral per anchor calibration.
    //
    // Smooth↔Detailed: DETAILED — "exceptional transient resolution — leading
    //   edges are fast and fully formed." "Fine-grained detail without analytical
    //   edge." The flow at 0.7 prevents it from being purely analytical, but
    //   the defining character is detail retrieval, not smoothness.
    //
    // Elastic↔Controlled: ELASTIC — elasticity 0.7, dynamics 0.7. The Chord
    //   FPGA timing gives transients a live, immediate quality. "Fast and fully
    //   formed" leading edges suggest elastic energy rather than damped control.
    //   Different from the Hugo TT2's controlled composure — the Qutest has
    //   more snap and less authority.
    //
    // Airy↔Closed: AIRY (slight) — subtle spatial openness in the FPGA
    //   presentation. Less pronounced than the Pontus holographic staging,
    //   but present enough to warrant 'airy' rather than neutral.
    primaryAxes: {
      warm_bright: 'neutral',         // Slightly lean but not bright — clarity via timing, not treble
      smooth_detailed: 'detailed',    // Timing precision, transient resolution
      elastic_controlled: 'elastic',  // FPGA snap, dynamics 0.7, elasticity 0.7
      airy_closed: 'airy',           // Slight spatial openness — subtle but present
    },
    fatigueAssessment: {
      risk: 'context_dependent',
      notes: 'No glare risk — the FPGA avoids harsh edges. But the tonal leanness can tilt toward analytical in systems already biased toward speed. Pairs well with warm amplification where the clarity cuts through without thinning.',
    },
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
      { label: 'Chord Electronics', url: 'https://chordelectronics.co.uk/product/qutest/' },
      { label: 'Amazon', url: 'https://www.amazon.com/dp/B079C63P1V' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'timing', tendency: 'exceptional transient resolution — leading edges are fast and fully formed', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'lighter tonal weight than R2R designs but avoids the thinness of typical delta-sigma', basis: 'listener_consensus' },
        { domain: 'texture', tendency: 'fine-grained detail without analytical edge — reveals texture without harsh spotlighting', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with warm or tonally dense amplification', effect: 'the timing precision and clarity tend to cut through added warmth rather than being masked by it', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in systems that already emphasize speed and transparency', effect: 'can tilt the balance toward analytical — the tonal lightness may become noticeable', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'timing precision and articulate detail', cost: 'the tonal density and midrange weight of R2R conversion', relative_to: 'Denafrips and other R2R designs', basis: 'review_consensus' },
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
    architecture: 'R2R',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'southeast-asia',
    country: 'SG',
    topology: 'r2r',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    // ── CALIBRATED ANCHOR: Denafrips Pontus II 12th-1 ──
    // Axis reasoning: Full-scale R2R — the archetypal warm, textured DAC.
    // Flow 1.0, density 1.0, texture 1.0, clarity 0.7, dynamics 0.7, composure 0.7.
    //
    // Warm↔Bright: WARM — density 1.0, "rich harmonic density with physical
    //   midrange presence." The Pontus is the warm-axis reference product in the
    //   DAC catalog. Zero glare risk. "Prioritises body and musical weight over
    //   transient sharpness."
    //
    // Smooth↔Detailed: SMOOTH — flow 1.0, "relaxed but coherent — phrasing breathes."
    //   Clarity at 0.7 means it's not soft or veiled — but the perceptual emphasis
    //   is on musical continuity and texture, not on analytical resolution.
    //   "Instruments have body and resonance" → smooth, not detailed.
    //
    // Elastic↔Controlled: NEUTRAL — dynamics 0.7 and composure 0.7. Neither
    //   explosive nor overdamped. The R2R conversion style has a natural ease
    //   that doesn't push dynamics forward but doesn't suppress them either.
    //   Elasticity at 0.4 is the only weak signal, but "relaxed" timing suggests
    //   neither elastic snap nor controlled grip — just flow.
    //
    // Airy↔Closed: AIRY (slight) — "deep, holographic staging with good layering
    //   front-to-back." The R2R architecture creates a sense of dimensional
    //   space that delta-sigma designs often lack at this price. Present but not
    //   the defining trait — slightly airy rather than dramatically open.
    primaryAxes: {
      warm_bright: 'warm',            // Density 1.0, "rich harmonic density" — the warm reference
      smooth_detailed: 'smooth',      // Flow 1.0, "phrasing breathes" — the smooth reference
      elastic_controlled: 'neutral',  // Dynamics and composure balanced — neither dominates
      airy_closed: 'airy',           // "Deep, holographic staging" — slight spatial openness
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'The R2R warmth and flow are inherently fatigue-resistant. The risk with the Pontus is never fatigue — it is congestion when paired with other warm components.',
    },
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
      'Full-scale R2R with rich tonal density, strong harmonic texture, and refined composure. Prioritizes body and musical weight over transient sharpness.',
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
        { condition: 'paired with fast or precision-oriented amplifiers', effect: 'the R2R tonal density and the amplifier\'s speed tend to complement — body without sluggishness', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in systems that are already tonally dense or warm', effect: 'the cumulative weight can reduce clarity — bass and lower midrange may feel heavy', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'harmonic richness, texture, and tonal authority', cost: 'transient sharpness and the explicit separation of delta-sigma designs', relative_to: 'ESS-based DACs at this price', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Audiophile Style', note: 'Detailed review of R2R architecture and harmonic character.' },
      { source: 'Audio Science Review', note: 'Measurement and listening coverage of the 12th anniversary revision.' },
      { source: '6moons', note: 'Review covering the Pontus II tonal authority and R2R staging.' },
      { source: 'Darko.Audio', note: 'Comparison placing Pontus in the Denafrips lineup and R2R landscape.' },
      { source: 'Head-Fi / Audiogon communities', note: 'Extensive comparisons with Chord, Schiit, and ESS-based alternatives.' },
    ],
  },

  {
    id: 'gustard-r26',
    brand: 'Gustard',
    name: 'R26',
    price: 1499,
    category: 'dac',
    architecture: 'R2R',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    topology: 'r2r',
    archetypes: { primary: 'tonal_saturated', secondary: 'precision_explicit' },
    // Axis reasoning: Discrete R2R but "less warm than the Denafrips, more textured
    // than delta-sigma." All core traits at 0.7 — balanced across the board.
    // "Body without excess warmth." "Controlled rather than explosive."
    // "A middle ground between R2R warmth and delta-sigma precision."
    primaryAxes: {
      warm_bright: 'warm',            // R2R architecture with density 0.7 — warm, but mild
      smooth_detailed: 'neutral',     // Flow 0.7 and clarity 0.7 — balanced between smooth and detailed
      elastic_controlled: 'controlled', // "Controlled rather than explosive," composure 0.7
      airy_closed: 'neutral',        // No strong spatial signature documented
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Balanced, gentle character. No fatigue risk. A safe system component in nearly any chain.',
    },
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
      'Discrete R2R implementation offering a balance of clarity and tonal body. Less warm than the Denafrips, more textured than delta-sigma alternatives.',
    retailer_links: [
      { label: 'Gustard', url: 'https://www.gustard.cn/productinfo/3758922.html' },
      { label: 'Amazon', url: 'https://www.amazon.com/dp/B0BL2F62LJ' },
      { label: 'Apos Audio', url: 'https://apos.audio/products/gustard-r26' },
    ],
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'tonality', tendency: 'balanced tonal presentation — body without excess warmth', basis: 'listener_consensus' },
        { domain: 'texture', tendency: 'finer-grained texture than typical R2R, closer to delta-sigma resolution', basis: 'editorial_inference' },
        { domain: 'dynamics', tendency: 'even dynamic delivery — controlled rather than explosive', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'for listeners moving from delta-sigma to R2R', effect: 'a gentler architectural transition — retains clarity while adding body', valence: 'positive', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'a middle ground between R2R warmth and delta-sigma precision', cost: 'the full tonal saturation of Denafrips or the explicit speed of ESS designs', relative_to: 'both R2R and delta-sigma at this price', basis: 'editorial_inference' },
      ],
    },
  },

  // ── Lightweight product anchors ────────────────────
  // Conservative entries: enough data for axis inference and system
  // assessment. Brand-level profiles provide the primary fallback
  // when these products appear uncataloged.

  {
    id: 'eversolo-dmp-a6',
    brand: 'Eversolo',
    name: 'DMP-A6',
    price: 450,
    category: 'streamer',
    architecture: 'network streamer (ESS ES9038Q2M internal DAC available but typically used as transport)',
    subcategory: 'streamer',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'neutral',
      // Founder reference calibration
      warm_bright_n: 0,           // Neutral — technically strong, no tonal bias
      smooth_detailed_n: 1,       // Technically detailed — stable and resolving
      elastic_controlled_n: 1,    // Controlled and stable — digital filter dependent
      airy_closed_n: 0,           // Neutral staging
    },
    tendencyProfile: {
      basis: 'founder_reference',
      confidence: 'founder_reference',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'speed', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'flow', level: 'less_emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
        { trait: 'warmth', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.7,
      flow: 0.4,
      tonal_density: 0.4,
      dynamics: 0.4,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Network streamer with a capable internal DAC stage. Clean, neutral digital front-end designed for streaming service integration and network transport. Most commonly used feeding an external DAC via USB or coaxial output.',
    retailer_links: [
      { label: 'Eversolo', url: 'https://eversolo.com/products/dmp-a6' },
      { label: 'Apos Audio (retailer)', url: 'https://apos.audio/products/eversolo-dmp-a6' },
    ],
  },

  {
    id: 'wiim-pro',
    brand: 'WiiM',
    name: 'Pro',
    price: 150,
    category: 'streamer',
    architecture: 'AKM AK4493SEQ',
    priceTier: 'budget',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'neutral',
      elastic_controlled: 'neutral',
      airy_closed: 'neutral',
    },
    traits: {
      clarity: 0.4,
      flow: 0.4,
      tonal_density: 0.4,
      dynamics: 0.4,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Affordable network streamer with broad streaming service support and a polished control app. The internal DAC is functional but the primary value is as a digital transport feeding better external conversion.',
    retailer_links: [
      { label: 'WiiM official', url: 'https://www.wiimhome.com/wiimpro' },
    ],
  },

  {
    id: 'wiim-ultra',
    brand: 'WiiM',
    name: 'Ultra',
    price: 330,
    category: 'streamer',
    architecture: 'ESS ES9038Q2M',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'neutral',
      elastic_controlled: 'neutral',
      airy_closed: 'neutral',
    },
    traits: {
      clarity: 0.7,
      flow: 0.4,
      tonal_density: 0.4,
      dynamics: 0.4,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Mid-tier network streamer with improved DAC stage and analogue output over the WiiM Pro. Supports room correction and multiroom. Still best used as a transport, but the internal DAC is competent for its price.',
    retailer_links: [
      { label: 'WiiM official', url: 'https://www.wiimhome.com/wiimultra' },
    ],
  },

  {
    id: 'topping-d90',
    brand: 'Topping',
    name: 'D90',
    price: 700,
    category: 'dac',
    architecture: 'AKM AK4499',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    primaryAxes: {
      warm_bright: 'bright',           // AKM flagship chip, precision-oriented
      smooth_detailed: 'detailed',     // Measurement-focused, revealing
      elastic_controlled: 'controlled', // Composed, not elastic
      airy_closed: 'neutral',
    },
    traits: {
      clarity: 1.0,
      flow: 0.4,
      tonal_density: 0.4,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.4,
      composure: 0.7,
    },
    description:
      'Flagship desktop DAC using the AKM AK4499 chipset. Measurement performance is exceptional. The sonic character is precise and transparent — detail retrieval and separation are the primary strengths.',
    retailer_links: [
      { label: 'Topping', url: 'https://www.toppingaudio.com/product-item/d90' },
      { label: 'Apos Audio', url: 'https://apos.audio/products/topping-d90' },
    ],
    sourceReferences: [
      { source: 'Audio Science Review', note: 'Detailed measurements and listening impressions of the AKM-based D90.' },
    ],
  },

  {
    id: 'smsl-su-9',
    brand: 'SMSL',
    name: 'SU-9',
    price: 430,
    category: 'dac',
    architecture: 'ESS ES9038PRO',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    primaryAxes: {
      warm_bright: 'bright',
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'neutral',
    },
    traits: {
      clarity: 1.0,
      flow: 0.4,
      tonal_density: 0.4,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.4,
      composure: 0.7,
    },
    description:
      'ESS Sabre-based desktop DAC with strong measured performance. Precise, analytical character with good separation and low-level detail. Tonal weight is lighter than R2R alternatives.',
    retailer_links: [
      { label: 'SMSL', url: 'https://www.smsl-audio.com/portal/product/detail/id/792.html' },
      { label: 'Apos Audio', url: 'https://apos.audio/products/smsl-su-9' },
    ],
  },

  {
    id: 'gustard-x26-pro',
    brand: 'Gustard',
    name: 'X26 Pro',
    price: 1200,
    category: 'dac',
    architecture: 'ESS ES9038PRO (dual mono)',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    primaryAxes: {
      warm_bright: 'neutral',          // Dual-mono ESS, slightly less lean than typical
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'neutral',
    },
    traits: {
      clarity: 1.0,
      flow: 0.4,
      tonal_density: 0.7,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      composure: 0.7,
    },
    description:
      'Dual-mono ESS Sabre implementation with more analogue output stage investment than typical Chi-Fi. More tonal body than the Topping/SMSL tier while retaining measurement-class resolution.',
    retailer_links: [
      { label: 'Gustard', url: 'https://www.gustard.cn/productinfo/3758920.html' },
      { label: 'Apos Audio', url: 'https://apos.audio/products/gustard-x26-pro' },
    ],
  },

  {
    id: 'laiv-harmony-dac',
    brand: 'LAiV',
    name: 'Harmony DAC',
    price: 2000,
    category: 'dac',
    architecture: 'Discrete R2R',
    subcategory: 'standalone-dac',
    priceTier: 'upper-mid',
    brandScale: 'boutique',
    region: 'southeast-asia',
    country: 'SG',
    topology: 'r2r',
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'neutral',
      airy_closed: 'airy',
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
    },
    description:
      'Singapore-designed discrete R2R DAC with strong harmonic density and tonal richness. Shares sonic territory with the Denafrips Pontus/Venus tier — warm, textured, and spatially open. Emphasises musical engagement over analytical precision.',
    retailer_links: [
      { label: 'LAiV Audio', url: 'https://www.laiv.audio/' },
    ],
    sourceReferences: [
      { source: 'Head-Fi community', note: 'Listening comparisons with Denafrips Pontus II and Holo Spring.' },
    ],
  },

  {
    id: 'audalytic-dr70',
    brand: 'Audalytic',
    name: 'DR70',
    price: 800,
    category: 'dac',
    architecture: 'AKM AK4497 (dual mono)',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'neutral',
      airy_closed: 'airy',
    },
    traits: {
      clarity: 1.0,
      flow: 0.7,
      tonal_density: 0.7,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      composure: 0.7,
    },
    description:
      'Dual-mono AKM-based DAC from Audalytic (a Gustard sub-brand). Aims for transparency and staging precision with more tonal body than typical measurement-focused designs. The emphasis is on resolution without analytical hardness.',
    retailer_links: [
      { label: 'Audalytic', url: 'https://www.audalytic.com/' },
    ],
  },

  {
    id: 'fiio-k9-pro',
    brand: 'FiiO',
    name: 'K9 Pro',
    price: 550,
    category: 'dac',
    architecture: 'AKM AK4499EQ',
    subcategory: 'dac-amp',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'neutral',
      elastic_controlled: 'neutral',
      airy_closed: 'neutral',
    },
    traits: {
      clarity: 0.7,
      flow: 0.7,
      tonal_density: 0.7,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Desktop DAC/headphone amplifier combining an AKM DAC with balanced headphone output. A capable all-rounder — clean, slightly warm, and non-fatiguing. Serves as a solid desktop hub for headphone systems.',
    retailer_links: [
      { label: 'FiiO official', url: 'https://www.fiio.com/k9pro' },
    ],
  },

  {
    id: 'hifiman-ef400',
    brand: 'HiFiMAN',
    name: 'EF400',
    price: 570,
    category: 'dac',
    architecture: 'R2R (Hymalaya module)',
    subcategory: 'dac-amp',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    topology: 'r2r',
    primaryAxes: {
      warm_bright: 'warm',             // R2R module adds density
      smooth_detailed: 'smooth',       // Voiced for musical flow
      elastic_controlled: 'neutral',
      airy_closed: 'neutral',
    },
    traits: {
      flow: 0.7,
      tonal_density: 0.7,
      clarity: 0.7,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      composure: 0.4,
    },
    description:
      'Desktop DAC/headphone amplifier built around HiFiMAN\'s proprietary R2R "Hymalaya" DAC module. Smooth, slightly warm presentation with good tonal density. Designed as a one-box headphone system paired with HiFiMAN planar headphones.',
    retailer_links: [
      { label: 'HiFiMAN official', url: 'https://hifiman.com/products/detail/327' },
    ],
    sourceReferences: [
      { source: 'Head-Fi community', note: 'Impressions and comparisons with Schiit Bifrost and dedicated R2R DACs.' },
    ],
  },

  {
    id: 'merason-frerot',
    brand: 'Merason',
    name: 'Frérot',
    price: 1250,
    category: 'dac',
    architecture: 'delta-sigma (TI PCM1794A)',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'boutique',
    region: 'europe',
    country: 'CH',
    topology: 'delta-sigma',
    archetypes: { primary: 'flow_organic', secondary: 'tonal_saturated' },
    // ── ANCHOR: Merason Frérot ──
    // Axis reasoning: Swiss boutique — uses a well-known delta-sigma chip
    // (TI PCM1794A) but voices it with unusual warmth and musicality.
    // The analogue output stage does the heavy lifting — this is not a
    // chip-sound DAC. Closer in presentation to an R2R design than
    // to typical delta-sigma implementations.
    //
    // Warm↔Bright: WARM — voiced for density and body, not brightness.
    //   The analogue stage adds midrange weight uncommon for delta-sigma.
    //
    // Smooth↔Detailed: SMOOTH-NEUTRAL — good detail retrieval but
    //   presented with a relaxed quality. No analytical edge.
    //
    // Elastic↔Controlled: NEUTRAL — neither snappy nor overdamped.
    //   Musical pacing is natural.
    //
    // Airy↔Closed: NEUTRAL — unremarkable spatial presentation,
    //   neither closed-in nor holographic.
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'neutral',
      elastic_controlled: 'neutral',
      airy_closed: 'neutral',
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Voiced for long-session listening. The warmth and relaxed detail presentation minimise fatigue. No glare risk.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'texture', level: 'present' },
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
      texture: 0.7,
      composure: 0.7,
      elasticity: 0.4,
    },
    description:
      'Swiss-designed desktop DAC built around the TI PCM1794A chip, voiced with unusual warmth and tonal density for a delta-sigma design. The analogue output stage is the defining element — rich midrange weight, musical flow, and a relaxed presentation that invites long listening sessions.',
    retailer_links: [
      { label: 'Merason', url: 'https://merason.ch/frerot/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'unusual warmth and tonal density for a delta-sigma design — the analogue stage adds midrange body more typical of R2R conversion', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'musical flow and natural pacing — notes connect rather than dissect', basis: 'listener_consensus' },
        { domain: 'texture', tendency: 'rich harmonic texture without grain — surfaces detail without spotlighting it', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with revealing or brighter amplification', effect: 'the warmth provides a complementary foundation — detail emerges naturally without edge', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in systems already voiced warm', effect: 'can compound warmth — may reduce clarity and transient definition', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'musicality, midrange body, and long-session comfort', cost: 'transient speed and leading-edge definition vs FPGA or ESS designs', relative_to: 'Chord Qutest, Topping D70 Pro', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Darko.Audio', note: 'Review covering the Frérot\'s analogue voicing and Swiss design philosophy.' },
      { source: 'Part-Time Audiophile', note: 'Impressions emphasising warmth and musicality uncommon at the price.' },
    ],
  },

  {
    id: 'holo-cyan-2',
    brand: 'Holo Audio',
    name: 'Cyan 2',
    price: 799,
    category: 'dac',
    architecture: 'Discrete R2R (Holo proprietary)',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    topology: 'r2r',
    archetypes: { primary: 'flow_organic', secondary: 'tonal_saturated' },
    // ── ANCHOR: Holo Audio Cyan 2 ──
    // Axis reasoning: Entry-level discrete R2R from Holo Audio, which builds
    // the well-regarded Spring and May DACs. The Cyan 2 shares the house sound
    // — natural tonal density, good resolution, and a relaxed-but-present
    // approach to detail. More resolving than the Denafrips Ares, less dense
    // than the Pontus.
    //
    // Warm↔Bright: WARM (slight) — R2R density present but restrained.
    //   Less warm than Denafrips Ares, more body than delta-sigma.
    //
    // Smooth↔Detailed: NEUTRAL — resolving without being smooth or analytical.
    //   Good texture retrieval with natural edges.
    //
    // Elastic↔Controlled: NEUTRAL — balanced dynamics, neither snappy
    //   nor overdamped.
    //
    // Airy↔Closed: NEUTRAL — clean spatial presentation without
    //   the holographic staging of higher-tier Holo models.
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'neutral',
      elastic_controlled: 'neutral',
      airy_closed: 'neutral',
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'No fatigue risk. The natural tonal balance and R2R smoothness make it suitable for extended listening.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'composure', level: 'present' },
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
      'Entry-level discrete R2R DAC from the makers of the acclaimed Spring and May series. Natural tonal density, clean texture, and balanced resolution without analytical edge. A resolving alternative to both budget delta-sigma and the warmer Denafrips Ares.',
    retailer_links: [
      { label: 'Holo Audio', url: 'https://www.holoaudio.com/' },
      { label: 'Kitsune HiFi', url: 'https://kitsunehifi.com/product/holo-audio-cyan-2/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'natural tonal density — slightly warm but not coloured, with good midrange presence', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'clean texture retrieval — detail emerges naturally without grain or spotlighting', basis: 'listener_consensus' },
        { domain: 'timing', tendency: 'balanced dynamics and pacing — neither sluggish nor snappy, musically engaging', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'paired with transparent or analytical amplification', effect: 'the natural density provides a complementary tonal foundation without softening transients', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'compared to higher-tier Holo models (Spring, May)', effect: 'shares the house sound but with less spatial depth and composure — the core tonal character scales up rather than changing direction', valence: 'neutral', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'natural tonality, balanced resolution, and musical engagement', cost: 'the transient speed and spatial precision of FPGA or flagship ESS designs', relative_to: 'Chord Qutest, Topping D90SE', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Head-Fi community', note: 'Extensive impressions comparing with Denafrips Ares and Schiit Bifrost.' },
      { source: 'Audio Science Review', note: 'Measurements and listening impressions of the Cyan 2 R2R implementation.' },
      { source: '6moons', note: 'Review covering the discrete R2R implementation and Holo Audio design philosophy.' },
    ],
  },

  // ── Boutique expansion ────────────────────────────────

  {
    id: 'weiss-dac204',
    brand: 'Weiss',
    name: 'DAC204',
    price: 2695,
    category: 'dac',
    architecture: 'delta-sigma (ESS ES9038Pro), Weiss DSP processing',
    subcategory: 'standalone-dac',
    priceTier: 'upper-mid',
    brandScale: 'boutique',
    region: 'europe',
    country: 'CH',
    topology: 'delta-sigma',
    archetypes: { primary: 'precision_explicit', secondary: 'spatial_holographic' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'airy',
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Weiss applies DSP processing that smooths ESS edge — more refined than typical ESS implementations. Low fatigue despite the precision.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'composure', level: 'emphasized' },
        { trait: 'speed', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'warmth', level: 'less_emphasized' },
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
      composure: 1.0,
      speed: 0.7,
      spatial_precision: 1.0,
      elasticity: 0.4,
    },
    description:
      'Swiss pro-audio pedigree applied to consumer hi-fi. The DAC204 uses ESS conversion with Weiss\'s proprietary DSP processing — achieving studio-grade precision without the clinical edge typical of ESS implementations. Exceptionally composed and spatially precise.',
    retailer_links: [
      { label: 'Weiss Engineering', url: 'https://weiss.ch/products/dac204/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'spatial', tendency: 'holographic staging with precise image placement — the pro-audio heritage shows in the spatial resolution', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'neutral and transparent — the Weiss DSP removes ESS edge without adding warmth', basis: 'listener_consensus' },
        { domain: 'dynamics', tendency: 'composed and proportional — dynamic contrasts are rendered accurately without exaggeration', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with warm speakers or tube amplification', effect: 'the precision and spatial qualities shine while upstream warmth provides tonal body', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in analytical or lean systems', effect: 'may feel too precise — the DAC204 doesn\'t compensate for upstream thinness', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'studio-grade precision, spatial holography, and composure', cost: 'tonal density and harmonic richness of R2R or NOS designs', relative_to: 'Denafrips Pontus, Holo Spring', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Darko.Audio', note: 'Review covering the DAC204\'s pro-audio heritage and DSP refinement.' },
      { source: 'Headphone.Guru', note: 'Review noting the spatial precision and low-fatigue presentation.' },
    ],
  },

  {
    id: 'holo-spring-3',
    brand: 'Holo Audio',
    name: 'Spring 3',
    price: 2698,
    category: 'dac',
    architecture: 'Discrete R2R (Holo proprietary, dual-mono)',
    subcategory: 'standalone-dac',
    priceTier: 'upper-mid',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    topology: 'r2r',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'neutral',
      elastic_controlled: 'neutral',
      airy_closed: 'neutral',
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Dual-mono R2R with natural tonal density. Inherently relaxed and fatigue-free.',
    },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'flow', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'warmth', level: 'present' },
        { trait: 'speed', level: 'less_emphasized' },
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
      warmth: 0.7,
      speed: 0.4,
      spatial_precision: 0.7,
      elasticity: 0.4,
    },
    description:
      'Holo Audio\'s flagship-class dual-mono R2R DAC — the Spring 3 is the sweet spot of the Holo range. Rich tonal density, natural texture, and musical flow. Upgradeable to the Kitsune-tuned "Level 3" variant for enhanced resolution.',
    retailer_links: [
      { label: 'Holo Audio', url: 'https://www.holoaudio.com/' },
      { label: 'Kitsune HiFi', url: 'https://kitsunehifi.com/product/holo-audio-spring-3/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'rich, harmonically dense presentation — instruments have body and weight that delta-sigma designs struggle to match', basis: 'listener_consensus' },
        { domain: 'texture', tendency: 'tactile and dimensional — textures are rendered with physical presence', basis: 'listener_consensus' },
        { domain: 'timing', tendency: 'natural musical flow with good dynamic authority — not as fast as FPGA but more engaging than NOS', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with transparent or precise amplification', effect: 'the R2R density provides tonal body while the amp provides control and resolution', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in already warm or dense systems', effect: 'may compound density — clarity and transient speed could suffer', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'tonal richness, harmonic density, and natural musical engagement', cost: 'transient speed and the surgical precision of FPGA or ESS designs', relative_to: 'Chord Qutest, Weiss DAC204', basis: 'listener_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Head-Fi community', note: 'Extensive owner impressions comparing Spring 3 to May and competing R2R designs.' },
      { source: '6moons', note: 'Review praising the Spring\'s tonal authority and musical engagement.' },
    ],
  },

  {
    id: 'sonnet-morpheus',
    brand: 'Sonnet Digital Audio',
    name: 'Morpheus',
    price: 2750,
    category: 'dac',
    architecture: 'Discrete sign-magnitude R2R, non-oversampling capable',
    subcategory: 'standalone-dac',
    priceTier: 'upper-mid',
    brandScale: 'boutique',
    region: 'europe',
    country: 'NL',
    topology: 'r2r',
    archetypes: { primary: 'rhythmic_propulsive', secondary: 'tonal_saturated' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'neutral',
      elastic_controlled: 'elastic',
      airy_closed: 'neutral',
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'R2R naturalness with dynamic authority. No fatigue risk — the presentation is energetic but not aggressive.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'speed', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'elasticity', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'warmth', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 0.7,
      tonal_density: 1.0,
      clarity: 0.7,
      dynamics: 1.0,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.7,
      composure: 0.7,
      warmth: 0.4,
      speed: 0.7,
      spatial_precision: 0.7,
      elasticity: 0.7,
    },
    description:
      'Dutch R2R DAC from audio veteran Cees Ruijtenberg (also behind Metrum). Sign-magnitude discrete conversion with a lively, dynamic presentation. More energetic than typical R2R — trades some smoothness for rhythmic drive and authority.',
    retailer_links: [
      { label: 'Sonnet Digital Audio', url: 'https://www.sonnet-audio.com/morpheus.html' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'dynamics', tendency: 'authoritative and lively — macro dynamics have weight and impact uncommon in R2R designs', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'dense and energetic rather than warm — tonal weight without sluggishness', basis: 'listener_consensus' },
        { domain: 'timing', tendency: 'rhythmically engaging with good transient speed for an R2R — sign-magnitude conversion keeps the leading edge crisp', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with composed or controlled amplification', effect: 'the dynamic energy is harnessed without becoming aggressive — the amp provides grip', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'with high-efficiency speakers', effect: 'the dynamic authority can become overwhelming — the Morpheus likes speakers that need driving', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'dynamic authority, rhythmic drive, and tonal density', cost: 'the smoothness and ease of NOS or warmer R2R designs', relative_to: 'Holo Spring 3, Denafrips Pontus', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: '6moons', note: 'Review covering the Morpheus\'s sign-magnitude R2R design and dynamic presentation.' },
      { source: 'Darko.Audio', note: 'Impressions noting the lively, energetic character compared to typical R2R.' },
    ],
  },

  // ── Reference-tier DACs ($3,000–$5,000) ─────────────

  {
    id: 'denafrips-terminator-ii',
    brand: 'Denafrips',
    name: 'Terminator II',
    price: 4500,
    category: 'dac',
    architecture: 'Discrete R2R ladder, true balanced, 26-bit',
    subcategory: 'standalone-dac',
    priceTier: 'high-end',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    topology: 'r2r',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'warm',             // Dense, analog-like tonal weight
      smooth_detailed: 'smooth',       // Organic flow, not analytical
      elastic_controlled: 'neutral',   // Good dynamics but not explosive
      airy_closed: 'airy',            // Large, spacious soundstage
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Dense R2R presentation with zero digital glare. Extremely non-fatiguing. One of the most relaxed high-end DACs available.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'flow', level: 'emphasized' },
        { trait: 'warmth', level: 'emphasized' },
        { trait: 'texture', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'speed', level: 'less_emphasized' },
        { trait: 'clarity', level: 'less_emphasized' },
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
      composure: 0.7,
      warmth: 1.0,
      speed: 0.4,
      spatial_precision: 0.7,
      elasticity: 0.4,
    },
    description:
      'Denafrips\' flagship R2R DAC — dense, analog-sounding, with extraordinary tonal weight and a large soundstage. The Terminator II is widely considered one of the best R2R DACs under $5,000 and a reference for vinyl-like digital playback.',
    retailer_links: [
      { label: 'Vinshine Audio', url: 'https://www.vinshineaudio.com/product/denafrips-terminator-ii' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'dense and analog — big tonal weight with powerful bass authority and harmonic richness', basis: 'review_consensus' },
        { domain: 'spatial', tendency: 'large, spacious soundstage with natural depth — instruments are placed with scale rather than surgical precision', basis: 'listener_consensus' },
        { domain: 'timing', tendency: 'organic flow with strong macro-dynamics — not the fastest transients, but musically convincing', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with transparent or fast amplification', effect: 'the amp provides speed and grip while the DAC supplies tonal body and ease', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in already warm or slow systems', effect: 'may compound density — transient definition and clarity could soften excessively', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'tonal density, analog-like flow, and bass authority', cost: 'transient speed and the incisive detail of FPGA or delta-sigma designs', relative_to: 'Chord Hugo TT2, Weiss DAC204', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: '6moons', note: 'Srajan Ebaen review establishing the Terminator II as a reference R2R.' },
      { source: 'Headphone.Guru', note: 'Review praising tonal density and soundstage scale.' },
      { source: 'Head-Fi community', note: 'Extensive owner consensus on analog-like presentation.' },
    ],
  },

  {
    id: 'rockna-wavelight',
    brand: 'Rockna',
    name: 'Wavelight',
    price: 4200,
    category: 'dac',
    architecture: 'Discrete R2R ladder with FPGA control',
    subcategory: 'standalone-dac',
    priceTier: 'high-end',
    brandScale: 'boutique',
    region: 'europe',
    country: 'RO',
    topology: 'r2r',
    archetypes: { primary: 'spatial_holographic', secondary: 'precision_explicit' },
    primaryAxes: {
      warm_bright: 'neutral',          // Neither warm nor bright — balanced and refined
      smooth_detailed: 'detailed',     // Highly resolving with excellent depth layering
      elastic_controlled: 'neutral',   // Well-balanced dynamics
      airy_closed: 'airy',            // Exceptionally holographic imaging
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'FPGA-controlled R2R achieves high resolution without digital edge. Very refined treble.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'speed', level: 'present' },
        { trait: 'warmth', level: 'less_emphasized' },
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
      texture: 1.0,
      composure: 0.7,
      warmth: 0.4,
      speed: 0.7,
      spatial_precision: 1.0,
      elasticity: 0.7,
    },
    description:
      'Romanian FPGA-controlled R2R that bridges the gap between analog warmth and digital precision. Extremely holographic with refined treble and excellent depth layering. Widely regarded as a reference-class DAC that balances R2R tone with digital precision.',
    retailer_links: [
      { label: 'Rockna', url: 'https://www.rockna.com/wavelight-dac' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'spatial', tendency: 'best imaging in the price class — holographic staging with precise depth layering and image specificity', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'balanced and refined — not warm, not lean. R2R body with FPGA precision', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'very refined treble with natural decay — high resolution without digital artifacts', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'paired with warm or tube amplification', effect: 'the precision and spatial qualities shine while upstream warmth adds body', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in analytical systems', effect: 'may feel slightly lean — it doesn\'t add warmth, so tonal body must come from elsewhere', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'imaging precision, depth layering, and tonal balance', cost: 'the warm, dense tonal weight of pure R2R designs like Denafrips or Totaldac', relative_to: 'Denafrips Terminator II, Totaldac d1-twelve', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Darko.Audio', note: 'John Darko review praising the Wavelight\'s imaging and refinement.' },
      { source: '6moons', note: 'Review covering the FPGA+R2R hybrid approach.' },
      { source: 'Head-Fi community', note: 'Extensive comparisons positioning Wavelight as best imaging under $5k.' },
    ],
  },

  {
    id: 'totaldac-d1-twelve-mk2',
    brand: 'TotalDAC',
    name: 'd1-twelve MK2',
    price: 4800,
    usedPriceRange: { low: 3200, high: 4200 },
    availability: 'current',
    typicalMarket: 'both',
    category: 'dac',
    architecture: 'Discrete R2R (12 parallel DAC modules per channel)',
    subcategory: 'standalone-dac',
    priceTier: 'high-end',
    brandScale: 'boutique',
    region: 'europe',
    country: 'FR',
    topology: 'r2r',
    archetypes: { primary: 'flow_organic', secondary: 'tonal_saturated' },
    primaryAxes: {
      warm_bright: 'warm',             // Organic, fluid tonal density
      smooth_detailed: 'smooth',       // Musical flow and natural timbre over detail
      elastic_controlled: 'elastic',   // Natural, relaxed presentation — not rigid
      airy_closed: 'airy',            // Open, natural staging
      // Founder reference calibration
      warm_bright_n: -1,         // Warm — natural, non-digital tone
      smooth_detailed_n: -1,     // Smooth — highly relaxed presentation
      elastic_controlled_n: -1,  // Elastic — naturally flowing, not controlled
      airy_closed_n: -1,         // Airy — natural, open staging
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'One of the most natural-sounding DACs available. Zero digital character. Exceptionally low fatigue.',
    },
    tendencyProfile: {
      basis: 'founder_reference',
      confidence: 'founder_reference',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'warmth', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'speed', level: 'less_emphasized' },
        { trait: 'clarity', level: 'less_emphasized' },
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
      composure: 0.7,
      warmth: 0.7,
      speed: 0.4,
      spatial_precision: 0.7,
      elasticity: 0.4,
    },
    description:
      'Vincent Brient\'s entry into the TotalDAC range — 12 parallel R2R modules per channel for extraordinary tonal realism. Organic, fluid, and deeply natural. One of the most natural-sounding DACs available, especially strong in emotionally engaging systems.',
    retailer_links: [
      { label: 'TotalDAC', url: 'https://www.totaldac.com/en/d1-twelve-mk2-eng' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'incredible tonal realism — instruments sound like the real thing in the room. Very natural timbre.', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'organic and fluid — textures flow naturally with excellent micro-dynamics and decay', basis: 'listener_consensus' },
        { domain: 'timing', tendency: 'unhurried musical flow — phrasing breathes with natural ease', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with transparent amplification', effect: 'the natural density and flow are preserved while the amp provides control and staging', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in systems prioritising speed and explosive dynamics', effect: 'may feel too relaxed — the TotalDAC prioritises tone and flow over transient attack', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'tonal realism, natural timbre, and emotional engagement', cost: 'transient speed and the explosive dynamics of FPGA designs', relative_to: 'Chord Hugo TT2, Rockna Wavelight', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: '6moons', note: 'Srajan Ebaen review covering the d1-twelve as TotalDAC\'s entry-level masterpiece.' },
      { source: 'Twittering Machines', note: 'Michael Lavorgna coverage of TotalDAC house sound and d1 range.' },
      { source: 'Head-Fi community', note: 'Owner impressions praising tonal realism and natural timbre.' },
    ],
  },

  {
    id: 'holo-may-kte',
    brand: 'Holo Audio',
    name: 'May (KTE)',
    price: 4598,
    category: 'dac',
    architecture: 'Discrete R2R (Holo proprietary, dual-mono, fully balanced)',
    subcategory: 'standalone-dac',
    priceTier: 'high-end',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    topology: 'r2r',
    archetypes: { primary: 'flow_organic', secondary: 'tonal_saturated' },
    primaryAxes: {
      warm_bright: 'warm',             // Smooth, dense, zero digital character
      smooth_detailed: 'smooth',       // Extremely smooth with deep soundstage
      elastic_controlled: 'elastic',   // Excellent macro and micro dynamics
      airy_closed: 'airy',            // Deep, expansive soundstage
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Very low digital glare. Smooth, natural presentation with excellent dynamics. Often described as analog without losing resolution.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'warmth', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'speed', level: 'less_emphasized' },
        { trait: 'clarity', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 1.0,
      tonal_density: 1.0,
      clarity: 0.4,
      dynamics: 1.0,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.7,
      composure: 0.7,
      warmth: 0.7,
      speed: 0.4,
      spatial_precision: 0.7,
      elasticity: 0.7,
    },
    description:
      'Holo Audio\'s flagship — the May KTE is the Kitsune-tuned edition with premium components throughout. Extremely smooth with a deep soundstage, excellent macro and micro dynamics, and very low digital glare. Often described as "analog without losing resolution."',
    retailer_links: [
      { label: 'Kitsune HiFi', url: 'https://kitsunehifi.com/product/holo-audio-may-kte/' },
      { label: 'Holo Audio', url: 'https://www.holoaudio.com/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'extremely smooth and natural — dense tonal body with very natural decay and no digital artifacts', basis: 'review_consensus' },
        { domain: 'dynamics', tendency: 'excellent macro and micro dynamics — rare for an R2R to combine density with dynamic authority this well', basis: 'listener_consensus' },
        { domain: 'spatial', tendency: 'deep soundstage with natural layering — not the widest, but very convincing depth', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with fast, transparent amplification', effect: 'the amp adds speed and precision while the May provides body and flow', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in warm, slow systems', effect: 'may compound smoothness — the May already rounds transients slightly', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'smoothness, dynamic authority, and analog-like presentation', cost: 'the incisive transient response and speed of FPGA designs', relative_to: 'Chord Hugo TT2, Rockna Wavelight', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Head-Fi community', note: 'Extensive owner consensus as one of the best R2R DACs under $5k.' },
      { source: 'The Audiophiliac', note: 'Steve Guttenberg review praising the May\'s natural, analog-like quality.' },
      { source: '6moons', note: 'Review comparing the May to competing R2R and FPGA DACs.' },
    ],
  },

  {
    id: 'laiv-harmony',
    brand: 'Laiv',
    name: 'Harmony',
    price: 3500,
    category: 'dac',
    architecture: 'Discrete R2R with FPGA-controlled digital processing',
    subcategory: 'standalone-dac',
    priceTier: 'high-end',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    topology: 'r2r',
    archetypes: { primary: 'flow_organic', secondary: 'spatial_holographic' },
    primaryAxes: {
      warm_bright: 'neutral',          // Balanced — not warm, not lean
      smooth_detailed: 'smooth',       // Organic and flowing
      elastic_controlled: 'neutral',   // Well-balanced dynamics
      airy_closed: 'airy',            // Open, spacious staging
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'R2R smoothness with FPGA precision. Natural and non-fatiguing.',
    },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'medium',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'speed', level: 'present' },
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
      texture: 0.7,
      composure: 0.7,
      warmth: 0.4,
      speed: 0.7,
      spatial_precision: 1.0,
      elasticity: 0.7,
    },
    description:
      'Emerging high-value R2R ladder DAC with FPGA control. Balances organic R2R tone with strong spatial precision and good transient speed. Rapidly gaining reputation as a giant-killer in the $3-4k range.',
    retailer_links: [
      { label: 'Laiv', url: 'https://www.laiv.net/product/harmony-dac/' },
    ],
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'spatial', tendency: 'open, spacious staging with good image specificity — punches above its price on spatial performance', basis: 'listener_consensus' },
        { domain: 'tonality', tendency: 'balanced and natural — not as dense as Denafrips but more tonally full than FPGA-only designs', basis: 'listener_consensus' },
        { domain: 'timing', tendency: 'good transient speed for an R2R — the FPGA control adds definition without losing naturalness', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'paired with warm or dense amplification', effect: 'the balanced tonality accepts upstream colour without compounding', valence: 'positive', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'spatial precision, balanced tonality, and value at its price', cost: 'the ultimate tonal density of higher-end R2R like Terminator or May', relative_to: 'Denafrips Terminator II, Holo May', basis: 'listener_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Head-Fi community', note: 'Growing owner consensus as a high-value competitor to Rockna and Denafrips.' },
      { source: 'Audiophile Style', note: 'Discussion threads covering the Harmony vs established R2R competitors.' },
    ],
  },

  {
    id: 'dcs-bartok',
    brand: 'dCS',
    name: 'Bartók',
    price: 14500,
    usedPriceRange: { low: 5000, high: 7500 },
    availability: 'current',
    typicalMarket: 'both',
    category: 'dac',
    architecture: 'Ring DAC (proprietary FPGA-based discrete conversion)',
    subcategory: 'standalone-dac',
    priceTier: 'high-end',
    brandScale: 'boutique',
    region: 'uk',
    country: 'GB',
    topology: 'fpga',
    archetypes: { primary: 'precision_explicit', secondary: 'spatial_holographic' },
    primaryAxes: {
      warm_bright: 'neutral',          // Neither warm nor bright — transparent and refined
      smooth_detailed: 'detailed',     // Exceptionally resolving
      elastic_controlled: 'controlled', // Composed and authoritative
      airy_closed: 'airy',            // Expansive, layered staging
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Ring DAC achieves very high resolution without ESS-style glare. Refined and composed at all times.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'composure', level: 'emphasized' },
        { trait: 'texture', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'speed', level: 'present' },
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
      composure: 1.0,
      warmth: 0.4,
      speed: 0.7,
      spatial_precision: 1.0,
      elasticity: 0.4,
    },
    description:
      'dCS\'s "entry-level" Ring DAC — £14,500 new but occasionally available near $5k used. The Bartók delivers dCS\'s proprietary Ring DAC technology with exceptional resolution, staging, and composure. A reference point for digital conversion.',
    retailer_links: [
      { label: 'dCS', url: 'https://www.dcsaudio.com/bartok' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'spatial', tendency: 'expansive and layered — the Ring DAC creates a deep, precisely defined soundstage', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'transparent and refined — neither warm nor lean, just extremely resolved', basis: 'review_consensus' },
        { domain: 'dynamics', tendency: 'authoritative and composed — handles dynamic swings with complete control', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'paired with warm amplification or speakers', effect: 'the precision and transparency allow upstream warmth to colour naturally', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in already analytical systems', effect: 'the resolution may expose upstream shortcomings rather than mask them', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'resolution, staging, and composed authority', cost: 'the tonal density and harmonic richness of pure R2R designs', relative_to: 'Denafrips Terminator II, Totaldac d1-twelve', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Stereophile', note: 'Review establishing the Bartók as a reference DAC/headphone amp.' },
      { source: 'Darko.Audio', note: 'Coverage of the dCS Ring DAC technology and Bartók value proposition.' },
      { source: 'Head-Fi community', note: 'Used market consensus — occasionally found near $5k.' },
    ],
  },

  // ── Auralic ─────────────────────────────────────────

  {
    id: 'auralic-vega',
    brand: 'Auralic',
    name: 'Vega',
    price: 3500,
    category: 'dac',
    architecture: 'ESS Sabre ES9018 with Auralic Sanctuary audio processor',
    subcategory: 'standalone-dac',
    priceTier: 'upper-mid',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    topology: 'delta-sigma',
    archetypes: { primary: 'flow_organic', secondary: 'precision_explicit' },
    primaryAxes: {
      warm_bright: 'warm',            // Warmer than neutral — tonal body and grounding
      smooth_detailed: 'detailed',    // Polished detail — smooth surface but resolving
      elastic_controlled: 'controlled', // Composed and stable — not elastic
      airy_closed: 'closed',          // More grounded and intimate than airy
      // Founder reference calibration
      warm_bright_n: -1,        // Warm of neutral — body and grounding
      smooth_detailed_n: 1,     // Detailed — polished resolution
      elastic_controlled_n: 1,  // Controlled — composure and stability
      airy_closed_n: -1,        // More closed/grounded — less spatial excitement
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Polished and composed. Zero fatigue risk. The grounded presentation is inherently easy to listen to for extended sessions.',
    },
    tendencyProfile: {
      basis: 'founder_reference',
      confidence: 'founder_reference',
      tendencies: [
        { trait: 'composure', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'clarity', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'warmth', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'speed', level: 'less_emphasized' },
        { trait: 'dynamics', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      composure: 1.0,
      tonal_density: 1.0,
      clarity: 0.7,
      flow: 0.7,
      warmth: 0.7,
      texture: 0.7,
      spatial_precision: 0.4,
      speed: 0.4,
      dynamics: 0.4,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Auralic\'s flagship DAC featuring the ESS Sabre ES9018 implementation with their proprietary Sanctuary audio processor and femto-precision clocking. More grounded and tonally substantial than Hugo-style FPGA DACs, prioritising composure and stability over sparkle. Polished and refined — a DAC that grounds the system rather than energising it.',
    retailer_links: [
      { label: 'Auralic', url: 'https://auralic.com/' },
    ],
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'tonality', tendency: 'grounded and tonally full — body and refinement over excitement', basis: 'founder_reference' },
        { domain: 'timing', tendency: 'composed and stable — prioritises control over transient snap', basis: 'founder_reference' },
        { domain: 'spatial', tendency: 'more intimate and grounded than airy — not a staging DAC', basis: 'founder_reference' },
      ],
      interactions: [
        { condition: 'in lean or bright systems', effect: 'excellent tonal grounding — adds body and stability where it\'s needed', valence: 'positive', basis: 'founder_reference' },
        { condition: 'paired with controlled or dense amplification', effect: 'the combined composure may reduce dynamic excitement — system can feel overdamped', valence: 'caution', basis: 'founder_reference' },
        { condition: 'as a counterweight to fast or elastic speakers', effect: 'the stability provides anchor — the speakers provide the life', valence: 'positive', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'tonal body, stability, and long-session composure', cost: 'transient excitement, spatial openness, and the electric energy of FPGA designs', relative_to: 'Chord Hugo, FPGA-based DACs', basis: 'founder_reference' },
      ],
    },
    sourceReferences: [
      { source: 'Founder listening notes', note: 'Calibrated from direct comparison with Hugo v1. Polished, grounded, tonally fuller, composed.' },
      { source: 'Stereophile', note: 'Review of original Vega praising the refinement and tonal sophistication of the implementation.' },
    ],
    notes: 'Founder reference DAC. The Vega sits opposite to the Hugo v1 on the tonal axis — where Hugo is fast and airy, the Vega is grounded and composed. Good for lean systems that need body; less suited when the system already has density.',
  },

  // ── Vintage / disc players ────────────────────────────

  {
    id: 'oppo-opdv971h',
    brand: 'Oppo',
    name: 'OPDV971H',
    price: 120,
    priceCurrency: 'USD',
    category: 'dac',
    subcategory: 'standalone-dac',
    priceTier: 'budget',
    brandScale: 'mainstream',
    region: 'east-asia',
    country: 'China',
    architecture: 'DVD/CD universal disc player with integrated DAC — early Oppo design that prioritised clean, uncolored playback over tonal editorialising',
    availability: 'discontinued',
    typicalMarket: 'used',
    usedPriceRange: { low: 40, high: 150 },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'neutral',
      airy_closed: 'neutral',
      warm_bright_n: -1,
      smooth_detailed_n: -1,
      elastic_controlled_n: 0,
      airy_closed_n: 0,
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Slightly warm and smooth character reduces fatigue risk. Undemanding source that stays out of the way.',
    },
    traits: {
      clarity: 0.4,
      flow: 0.4,
      warmth: 0.4,
      texture: 0.0,
      spatial_precision: 0.0,
      speed: 0.0,
      dynamics: 0.0,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Early Oppo universal disc player known for clean, slightly warm playback. Not a resolution champion — prioritises inoffensive, musical delivery over analytical transparency. A modest source that contributes gentle warmth without strong editorial character.',
    retailer_links: [],
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'tonality', tendency: 'slightly warm and smooth — leans toward body over brightness', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'modest resolution — clean but not revealing; smooths over fine detail', basis: 'review_consensus' },
        { domain: 'dynamics', tendency: 'neutral dynamic character — neither elastic nor controlled, simply unobtrusive', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'feeding a warm amplifier', effect: 'warmth may compound slightly — system could lean toward soft if both amp and source are warm', valence: 'caution', basis: 'editorial_inference' },
        { condition: 'feeding a bright or lean amplifier', effect: 'the gentle warmth provides a useful counterbalance — keeps the chain musical', valence: 'positive', basis: 'editorial_inference' },
        {
          condition: 'in system: Oppo OPDV971H → Marantz 2220B → Hornshoppe Horn',
          effect: 'The source warmth compounds with the Marantz\'s midrange richness, but the Hornshoppe\'s efficiency and transient speed prevent the chain from becoming sluggish. Ravi Shankar recording produced extremely realistic tabla — strong transient realism and physical presence.',
          valence: 'positive',
          basis: 'founder_reference',
        },
      ],
      tradeoffs: [
        { gains: 'inoffensive musicality, gentle warmth, no fatigue', cost: 'resolution, transparency, and top-end extension', relative_to: 'modern dedicated DACs', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Founder listening notes', note: 'Used as disc source in Oppo → Marantz 2220B → Hornshoppe Horn system. Contributes gentle warmth without editorial colour.' },
      { source: 'Community consensus', note: 'Early Oppo players regarded as clean, slightly warm, musically inoffensive disc players.' },
    ],
    notes: 'Review-synthesis entry. Vintage universal disc player — modest source that contributes gentle warmth. In the founder\'s Oppo → Marantz → Hornshoppe chain, it serves as a clean, unobtrusive front end that lets the amp and speaker character dominate.',
  },
];
