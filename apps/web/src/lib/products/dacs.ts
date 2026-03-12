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
    // Axis reasoning: Entry R-2R — "body and engagement over analytical precision."
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
    // ── PRIORITY ANCHOR: RME ADI-2 DAC FS ──
    // Axis reasoning: Pro-audio heritage — "ruler-flat tonal balance with no editorial
    // voice." Clarity 1.0, composure 1.0, flow 0.4, density 0.4. "Transparent,
    // composed, and deeply configurable." "Reveals everything but editorializes nothing."
    // The parametric EQ is a system-tuning tool, not a sonic character trait.
    //
    // Warm↔Bright: BRIGHT — clarity 1.0, density 0.4, "lean" in the Topping mold
    //   but without glare risk. "Ruler-flat" sounds neutral, but the *absence* of
    //   harmonic editorial means it reads as bright compared to R-2R/tube designs.
    //   The EQ can compensate, but the *native* voicing is transparency-first.
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
      warm_bright: 'bright',              // Transparency reads as bright vs editorial designs
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
    // Axis reasoning: Portable Chord FPGA. Clarity 1.0, flow 0.7, density 0.4.
    // "Speed over weight." "Lighter tonal balance than desktop Chord units."
    // Shares Chord timing precision but with less authority.
    primaryAxes: {
      warm_bright: 'bright',          // Clarity 1.0, density 0.4 — "lighter tonal balance"
      smooth_detailed: 'detailed',    // Clarity emphasized, flow present but secondary
      elastic_controlled: 'neutral',  // No strong dynamic character — neither punchy nor damped
      airy_closed: 'neutral',        // "Good headphone staging" but not notably airy
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Despite bright lean, no glare risk. Chord FPGA character avoids analytical edge. Fatigue unlikely.',
    },
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
    // Axis reasoning: FPGA pulse array — the archetypal timing-precision DAC.
    // Clarity 1.0, flow 0.7, elasticity 0.7, composure 0.7, density 0.4.
    //
    // Warm↔Bright: BRIGHT — clarity 1.0, density 0.4. "Lighter tonal weight
    //   than R-2R designs." The FPGA character avoids delta-sigma harshness but
    //   the tonal weight is unmistakably lean compared to warm references.
    //   No glare risk — the brightness is precision, not edge.
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
    // Airy↔Closed: NEUTRAL — no strong spatial documentation. The Qutest is
    //   not noted for spaciousness or intimacy. Staging depends on downstream.
    primaryAxes: {
      warm_bright: 'bright',          // Clarity 1.0, density 0.4, "lighter tonal weight"
      smooth_detailed: 'detailed',    // Timing precision, transient resolution
      elastic_controlled: 'elastic',  // FPGA snap, dynamics 0.7, elasticity 0.7
      airy_closed: 'neutral',        // No strong spatial character
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
    // ── PRIORITY ANCHOR: Denafrips Pontus II 12th-1 ──
    // Axis reasoning: Full-scale R-2R — the archetypal warm, textured DAC.
    // Flow 1.0, density 1.0, texture 1.0, clarity 0.7, dynamics 0.7, composure 0.7.
    //
    // Warm↔Bright: WARM — density 1.0, "rich harmonic density with physical
    //   midrange presence." The Pontus is the warm-axis reference product in the
    //   DAC catalog. Zero glare risk. "Prioritizes body and musical weight over
    //   transient sharpness."
    //
    // Smooth↔Detailed: SMOOTH — flow 1.0, "relaxed but coherent — phrasing breathes."
    //   Clarity at 0.7 means it's not soft or veiled — but the perceptual emphasis
    //   is on musical continuity and texture, not on analytical resolution.
    //   "Instruments have body and resonance" → smooth, not detailed.
    //
    // Elastic↔Controlled: NEUTRAL — dynamics 0.7 and composure 0.7. Neither
    //   explosive nor overdamped. The R-2R conversion style has a natural ease
    //   that doesn't push dynamics forward but doesn't suppress them either.
    //   Elasticity at 0.4 is the only weak signal, but "relaxed" timing suggests
    //   neither elastic snap nor controlled grip — just flow.
    //
    // Airy↔Closed: AIRY — "deep, holographic staging with good layering
    //   front-to-back." The R-2R architecture creates a sense of dimensional
    //   space that delta-sigma designs often lack at this price.
    primaryAxes: {
      warm_bright: 'warm',            // Density 1.0, "rich harmonic density" — the warm reference
      smooth_detailed: 'smooth',      // Flow 1.0, "phrasing breathes" — the smooth reference
      elastic_controlled: 'neutral',  // Dynamics and composure balanced — neither dominates
      airy_closed: 'airy',           // "Deep, holographic staging" — spatial openness
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'The R-2R warmth and flow are inherently fatigue-resistant. The risk with the Pontus is never fatigue — it is congestion when paired with other warm components.',
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
    // Axis reasoning: Discrete R-2R but "less warm than the Denafrips, more textured
    // than delta-sigma." All core traits at 0.7 — balanced across the board.
    // "Body without excess warmth." "Controlled rather than explosive."
    // "A middle ground between R-2R warmth and delta-sigma precision."
    primaryAxes: {
      warm_bright: 'warm',            // R-2R architecture with density 0.7 — warm, but mild
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
