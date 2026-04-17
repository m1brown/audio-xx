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
  sourceReferences?: Array<{ source: string; note: string; url?: string }>;

  // ── Availability metadata ─────────────────────────────

  /** Market availability status. Defaults to 'current' when omitted. */
  availability?: 'current' | 'discontinued' | 'vintage';
  /** Where this product is typically found. Defaults to 'new' when omitted. */
  typicalMarket?: 'new' | 'used' | 'both';
  /** Approximate used-market price range (USD), for discontinued/vintage products. */
  usedPriceRange?: { low: number; high: number };

  // ── Enhanced catalog fields (Step 10) ─────────────────
  /** Product image URL — official press image or product shot. */
  imageUrl?: string;
  /** Structured buying context label for the card. Overrides inference when present. */
  buyingContext?: 'easy_new' | 'better_used' | 'dealer_likely' | 'used_only';

  // ── 4-option recommendation metadata ──────────────────
  /** Design philosophy — energy, neutral, warm, or analytical. */
  philosophy?: 'energy' | 'neutral' | 'warm' | 'analytical';
  /** Market type — traditional (major/established), nonTraditional (boutique/niche), or value (performance-per-dollar). */
  marketType?: 'traditional' | 'nonTraditional' | 'value';

  // ── Multi-role support ──────────────────────────────────
  /**
   * All functional roles this component fulfills in a system.
   * E.g., a Bluesound Node is both a streamer and a DAC.
   * When omitted, roles are inferred from category + subcategory.
   */
  roles?: string[];

  // ── Amp/speaker compatibility fields ───────────────────
  /**
   * Nominal power output in watts per channel (amplifiers only).
   * Used by amp/speaker power-match assessment.
   * Populated from catalog prose — omit when not clearly documented.
   */
  power_watts?: number;
  /**
   * Nominal sensitivity in dB (speakers only, typically 2.83V/1m).
   * Used by amp/speaker power-match assessment.
   * Populated from catalog prose — omit when not clearly documented.
   */
  sensitivity_db?: number;

  // ── Topology compatibility flags ───────────────────────
  /**
   * Speakers only. True when the speaker has its own built-in amplification
   * (active / powered / wireless designs such as KEF LS60 Wireless, LSX II,
   * Genelec monitors, Dutch & Dutch 8c). When the user already has an
   * external amplifier in the chain, these products are architecturally
   * incompatible as a primary recommendation and must be excluded from the
   * anchor pool. See `rankProducts` compatibility filter.
   */
  activeAmplification?: boolean;
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
    philosophy: 'neutral',
    marketType: 'traditional',
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
    // Step 10: buying metadata
    typicalMarket: 'new',
    buyingContext: 'easy_new',
    // imageUrl: undefined, // TODO: add official product image
    philosophy: 'analytical',
    marketType: 'value',
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
    // Step 10: buying metadata
    typicalMarket: 'new',
    buyingContext: 'easy_new',
    // imageUrl: undefined, // TODO: add official product image
    philosophy: 'analytical',
    marketType: 'value',
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
    philosophy: 'neutral',
    marketType: 'value',
  },

  {
    id: 'denafrips-enyo-15th',
    brand: 'Denafrips',
    name: 'Enyo 15th',
    price: 699,
    category: 'dac',
    architecture: 'R2R',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'southeast-asia',
    country: 'SG',
    topology: 'r2r',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    // Axis reasoning: Entry R2R — successor to the Ares 12th-1 at this price point.
    // Same Denafrips house sound: body, engagement, warmth over analytical precision.
    // Inherits the Ares 12th-1 sonic character at the entry-level position.
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
      'Entry-level R2R DAC inheriting the Denafrips house sound. Strong tonal density and natural rhythmic flow. Favors body and engagement over analytical precision.',
    retailer_links: [
      { label: 'Denafrips', url: 'https://www.denafrips.com/product-page/denafrips-enyo-15th-r-2r-dac' },
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
      { source: 'Denafrips official', note: 'Enyo 15th is the current entry-level R2R DAC, replacing the Ares 12th-1 at this price point.' },
      { source: 'Head-Fi community', note: 'Owner comparisons confirm similar tonal character to the Ares 12th-1.' },
    ],
    typicalMarket: 'new',
    buyingContext: 'dealer_likely',
    philosophy: 'warm',
    marketType: 'value',
  },

  {
    id: 'denafrips-ares-15th',
    brand: 'Denafrips',
    name: 'Ares 15th',
    price: 1199,
    category: 'dac',
    architecture: 'R2R',
    subcategory: 'standalone-dac',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'southeast-asia',
    country: 'SG',
    topology: 'r2r',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    // Axis reasoning: Mid-range R2R — refined version of Denafrips house sound.
    // More resolving than the Enyo while retaining the tonal density and flow
    // that define the Denafrips character. Enhanced power supply and I2S input.
    primaryAxes: {
      warm_bright: 'warm',            // Denafrips house sound — tonal density, flow
      smooth_detailed: 'smooth',      // Flow present, slightly more resolving than Enyo
      elastic_controlled: 'neutral',  // Dynamics present but balanced
      airy_closed: 'neutral',        // No strong spatial data
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Warmth and ease make fatigue unlikely. Slightly more resolving than the Enyo but still relaxed.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'clarity', level: 'present' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 0.75,
      tonal_density: 0.75,
      clarity: 0.5,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.75,
      composure: 0.5,
      elasticity: 0.45,
    },
    description:
      'Mid-range R2R DAC with refined Denafrips house sound. More resolving than the Enyo while retaining tonal density and natural flow. Enhanced power supply with UPOCC copper.',
    retailer_links: [
      { label: 'Denafrips', url: 'https://www.denafrips.com/product-page/denafrips-ares-15th-r-2r-dac' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'dense harmonic texture with physical midrange weight — more refined than Enyo', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'relaxed sense of timing with improved microdynamic resolution', basis: 'listener_consensus' },
        { domain: 'texture', tendency: 'grain-free detail retrieval with better separation than entry-level', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with bright or analytical amplifiers', effect: 'tends to temper upper-frequency edge without dulling transients', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in systems already biased toward warmth', effect: 'can compound density — midrange may feel heavy or congested', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'tonal body, listening ease, and improved resolution over Enyo', cost: 'transient precision and analytical separation vs delta-sigma', relative_to: 'delta-sigma designs at this price', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Denafrips official', note: 'Ares 15th is the current mid-range R2R DAC at $1,199.' },
      { source: 'Darko.Audio', note: 'Review covering Denafrips R2R house sound.', url: 'https://darko.audio/2021/06/denafrips-ares-ii-video-review/' },
      { source: 'Head-Fi community', note: 'Extensive owner comparisons with Bifrost 2 and other R2R alternatives.' },
    ],
    typicalMarket: 'new',
    buyingContext: 'dealer_likely',
    philosophy: 'warm',
    marketType: 'value',
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
    // Step 10: buying metadata
    typicalMarket: 'both',
    usedPriceRange: { low: 450, high: 600 },
    buyingContext: 'easy_new',
    // imageUrl: undefined, // TODO: add official product image
    philosophy: 'energy',
    marketType: 'traditional',
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
    // Axis reasoning: ESS Sabre delta-sigma measures flat. The "lean" perception comes from
    // low harmonic distortion and fast transients — the chip doesn't add body or warmth.
    // Not bright by measurement, but systems that rely on source-level warmth will sound lean.
    primaryAxes: {
      warm_bright: 'neutral',              // Measures flat — perceived leanness comes from absence of added harmonics, not from treble emphasis
      smooth_detailed: 'detailed',         // Clarity emphasized, flow less_emphasized
      elastic_controlled: 'controlled',    // Composure 0.7, composed
      airy_closed: 'neutral',             // Precise imaging but not described as airy
    },
    fatigueAssessment: {
      risk: 'context_dependent',
      notes: 'The D90SE itself measures flat and adds minimal distortion. Fatigue in D90SE systems typically comes from what it doesn\'t do — it adds no warmth or harmonic cushion, so aggressive amplification or speakers become more audible.',
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
      'ESS Sabre delta-sigma implementation with very low distortion and wide bandwidth. The chip\'s fast transient response and low harmonic distortion mean the D90SE contributes minimal coloration — what goes in comes out with high measured fidelity. The trade-off is that it adds no harmonic body of its own, so systems that rely on the DAC for tonal weight will sound lean.',
    retailer_links: [
      { label: 'Topping', url: 'https://www.toppingaudio.com/product-item/d90se' },
      { label: 'Amazon', url: 'https://www.amazon.com/dp/B09DVCCQGP' },
      { label: 'Apos Audio', url: 'https://apos.audio/products/topping-d90se' },
    ],
    notes: 'Strengths are measurable: low distortion, wide bandwidth, high channel separation. The ESS chip\'s fast reconstruction filter produces sharp transients that some listeners read as "lean" compared to the slower rolloff of R2R or NOS designs.',
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'low harmonic distortion means the D90SE contributes minimal tonal coloration — instruments have separation and definition but less midrange body than R2R designs that add even-order harmonics', basis: 'review_consensus' },
        { domain: 'spatial', tendency: 'precise imaging from high channel separation and low noise floor — instrument placement is explicit', basis: 'review_consensus' },
        { domain: 'dynamics', tendency: 'controlled and composed — the fast reconstruction filter preserves transient shape but the low-level delivery is even rather than explosive', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'paired with warm or tube-based amplification', effect: 'the DAC provides a transparent, uncolored source signal — the amplifier\'s harmonic character passes through without being fought or duplicated', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in systems that are already lean or lacking midrange body', effect: 'the D90SE won\'t compensate — it adds no warmth or harmonic padding, so leanness upstream or downstream becomes more audible', valence: 'caution', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'measured transparency, transient accuracy, and channel separation at this price', cost: 'the midrange body and harmonic density that R2R designs produce through their inherent even-order distortion products — the D90SE is accurate but not rich', relative_to: 'R2R designs (Denafrips Enyo 15th, Schiit Bifrost 2/64)', basis: 'review_consensus' },
      ],
    },
    philosophy: 'analytical',
    marketType: 'value',
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
      { source: '6Moons', note: 'Review covering the NOS tube output stage and its effect on musical continuity.', url: 'https://6moons.com/audioreview_articles/mhdtlab/2/' },
      { source: 'Twittering Machines', note: 'Coverage of the Orchid as a musically engaging NOS alternative.' },
      { source: 'The Audiophiliac', note: 'Steve Guttenberg review praising the Orchid for organic musicality.' },
      { source: 'Audiogon community', note: 'Tube-rolling reports and system pairing impressions.' },
    ],
    philosophy: 'warm',
    marketType: 'nonTraditional',
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
    philosophy: 'neutral',
    marketType: 'nonTraditional',
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
    philosophy: 'energy',
    marketType: 'value',
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
    // Scale↔Intimacy: NEUTRAL — "precise, stable imaging" is spatial precision, not
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
    philosophy: 'neutral',
    marketType: 'traditional',
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
    // Step 10: buying metadata
    typicalMarket: 'both',
    buyingContext: 'dealer_likely',
    // imageUrl: undefined, // TODO: add official product image
    philosophy: 'energy',
    marketType: 'traditional',
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
    // Step 10: buying metadata
    typicalMarket: 'both',
    usedPriceRange: { low: 3500, high: 4500 },
    buyingContext: 'dealer_likely',
    // imageUrl: undefined, // TODO: add official product image
    philosophy: 'energy',
    marketType: 'traditional',
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
    // Scale↔Intimacy: SCALE (slight) — subtle spatial openness in the FPGA
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
      { source: 'Darko.Audio', note: 'Review covering FPGA pulse array architecture and transient performance.', url: 'https://darko.audio/2018/11/a-short-film-about-the-chord-qutest/' },
      { source: 'What Hi-Fi?', note: 'Multi-award coverage noting detail retrieval and timing.', url: 'https://www.whathifi.com/chord/qutest/review' },
      { source: 'Head-Fi community', note: 'Extensive listener impressions on tonal weight vs clarity balance.' },
    ],
    // Step 10: buying metadata
    buyingContext: 'easy_new',
    imageUrl: 'https://chordelectronics.co.uk/wp-content/uploads/2018/09/Qutest-2.jpg',
    philosophy: 'energy',
    marketType: 'traditional',
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
    // Scale↔Intimacy: SCALE (slight) — "deep, holographic staging with good layering
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
      { label: 'Denafrips', url: 'https://www.denafrips.com/' },
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
    philosophy: 'warm',
    marketType: 'value',
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
    philosophy: 'analytical',
    marketType: 'value',
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
      { label: 'Apos Audio', url: 'https://apos.audio/products/eversolo-dmp-a6' },
    ],
    philosophy: 'energy',
    marketType: 'value',
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
      { label: 'WiiM', url: 'https://www.wiimhome.com/wiimpro' },
    ],
    philosophy: 'neutral',
    marketType: 'value',
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
      { label: 'WiiM', url: 'https://www.wiimhome.com/wiimultra' },
    ],
    philosophy: 'neutral',
    marketType: 'value',
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
    philosophy: 'analytical',
    marketType: 'value',
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
    philosophy: 'analytical',
    marketType: 'value',
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
    philosophy: 'analytical',
    marketType: 'value',
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
    archetypes: { primary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'neutral',
      airy_closed: 'airy',
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Warm R2R character with no glare — easy to listen to for extended sessions.',
    },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'medium',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'clarity', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'composure', level: 'present' },
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
    },
    description:
      'Singapore-designed discrete R2R DAC with strong harmonic density and tonal richness. Shares sonic territory with the Denafrips Pontus/Venus tier — warm, textured, and spatially open. Emphasises musical engagement over analytical precision.',
    retailer_links: [
      { label: 'LAiV Audio', url: 'https://www.laiv.audio/' },
    ],
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'tonality', tendency: 'warm and harmonically dense — tonal richness is the defining characteristic, with strong midrange body and natural timbre', basis: 'listener_consensus' },
        { domain: 'texture', tendency: 'textured and organic — the discrete R2R topology contributes a tactile, layered quality to instruments and voices', basis: 'listener_consensus' },
        { domain: 'spatial', tendency: 'open and airy staging with good depth — not pinpoint precise, but natural and immersive', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'paired with neutral or slightly bright amplification', effect: 'the warmth and density carry through without muddying, adding body to the presentation', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'paired with already-warm or very dense tube amplification', effect: 'tonality may become too thick — loses some clarity and articulation', valence: 'caution', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'tonal richness, textural density, and fatigue-free musicality', cost: 'the last degree of transient speed and analytical resolution', relative_to: 'Chord Qutest, Topping D90', basis: 'listener_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Head-Fi community', note: 'Listening comparisons with Denafrips Pontus II and Holo Spring.' },
      { source: 'Audio Science Review', note: 'Discussion thread covering R2R implementation and sound character.' },
    ],
    philosophy: 'warm',
    marketType: 'value',
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
    philosophy: 'analytical',
    marketType: 'nonTraditional',
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
      { label: 'FiiO', url: 'https://www.fiio.com/k9pro' },
    ],
    philosophy: 'analytical',
    marketType: 'traditional',
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
      { label: 'HiFiMAN', url: 'https://hifiman.com/products/detail/327' },
    ],
    sourceReferences: [
      { source: 'Head-Fi community', note: 'Impressions and comparisons with Schiit Bifrost and dedicated R2R DACs.' },
    ],
    philosophy: 'neutral',
    marketType: 'traditional',
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
    // Scale↔Intimacy: NEUTRAL — unremarkable spatial presentation,
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
    philosophy: 'warm',
    marketType: 'nonTraditional',
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
    // Scale↔Intimacy: NEUTRAL — clean spatial presentation without
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
    philosophy: 'warm',
    marketType: 'nonTraditional',
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
    philosophy: 'neutral',
    marketType: 'nonTraditional',
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
    philosophy: 'warm',
    marketType: 'nonTraditional',
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
    philosophy: 'warm',
    marketType: 'nonTraditional',
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
      { label: 'Denafrips', url: 'https://www.denafrips.com/' },
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
    philosophy: 'warm',
    marketType: 'value',
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
    philosophy: 'warm',
    marketType: 'nonTraditional',
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
      airy_closed_n: -1,         // Scale — natural, open staging
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
        {
          condition: 'in system: TotalDAC d1 → TotalDAC Amp-1 → TotalDAC d100%wood',
          effect: 'Complete TotalDAC chain heard as effortless and supremely refined — no internal friction between components. The shared voicing philosophy produces a seamless, coherent presentation where nothing fights anything else.',
          valence: 'positive',
          basis: 'founder_reference',
        },
      ],
      tradeoffs: [
        { gains: 'tonal realism, natural timbre, and emotional engagement', cost: 'transient speed and the explosive dynamics of FPGA designs', relative_to: 'Chord Hugo TT2, Rockna Wavelight', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: '6moons', note: 'Srajan Ebaen review covering the d1-twelve as TotalDAC\'s entry-level masterpiece.' },
      { source: 'Twittering Machines', note: 'Michael Lavorgna coverage of TotalDAC house sound and d1 range.' },
      { source: 'Head-Fi community', note: 'Owner impressions praising tonal realism and natural timbre.' },
      { source: 'Founder listening notes', note: 'Full TotalDAC chain (d1 → Amp-1 → d100%wood) at TotalDAC Fun Day 2022, Paris. Effortless and supremely refined.' },
    ],
    philosophy: 'warm',
    marketType: 'nonTraditional',
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
    philosophy: 'warm',
    marketType: 'nonTraditional',
  },

  {
    id: 'laiv-harmony',
    brand: 'LAiV',
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
      { label: 'LAiV', url: 'https://www.laiv.net/product/harmony-dac/' },
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
    philosophy: 'warm',
    marketType: 'value',
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
    philosophy: 'analytical',
    marketType: 'traditional',
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
    philosophy: 'neutral',
    marketType: 'traditional',
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
    philosophy: 'neutral',
    marketType: 'traditional',
  },

  {
    id: 'denafrips-venus-ii',
    brand: 'Denafrips',
    name: 'Venus II',
    price: 2600,
    category: 'dac',
    architecture: 'R-2R ladder, fully balanced, 26-bit, DSD1024 capable',
    subcategory: 'standalone-dac',
    priceTier: 'upper-mid',
    brandScale: 'specialist',
    region: 'southeast-asia',
    country: 'SG',
    topology: 'r2r',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'neutral',
      airy_closed: 'airy',
      warm_bright_n: 0.8,
      smooth_detailed_n: 0.7,
      elastic_controlled_n: 0,
      airy_closed_n: 0.4,
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'R-2R architecture with refined treble control reduces fatigue. Warm but not aggressive — risk is congestion only when paired with already-warm components.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'flow', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'clarity', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.75,
      warmth: 0.8,
      tonal_density: 0.85,
      speed: 0.65,
      dynamics: 0.7,
      flow: 0.85,
      spatial_precision: 0.7,
      composure: 0.8,
      texture: 0.85,
      fatigue_risk: 0.05,
      glare_risk: 0.0,
    },
    description:
      'Refined R-2R ladder DAC stepping up from Pontus — more textured staging, smoother treble control, and greater compositional coherence. Retains the house Denafrips warmth and organic flow while adding precision and spatial clarity. Fully balanced, supports USB, I2S, coaxial, and optical inputs with both NOS and oversampling modes.',
    retailer_links: [
      { label: 'Denafrips', url: 'https://www.denafrips.com/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'warm R-2R character with refined harmonic texture — body without bluntness', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'layered, dimensional staging — more refined spatial rendering than Pontus', basis: 'review_consensus' },
        { domain: 'spatial', tendency: 'smooth and extended without harshness — spatial refinement distinguishes Venus from lower-tier R-2R', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'organic and coherent — phrasing flows naturally without loss of rhythmic precision', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'paired with fast, precision-oriented amplifiers', effect: 'R-2R warmth and amp clarity create balance — avoids both sluggishness and excessive dryness', valence: 'positive', basis: 'editorial_inference' },
        { condition: 'in systems already rich or warm in tonality', effect: 'cumulative body can congeal lower mids — best in systems with some brightness or control', valence: 'caution', basis: 'editorial_inference' },
        { condition: 'as upgrade from Pontus II', effect: 'gains precision, staging clarity, and treble smoothness without sacrificing warmth — a refinement rather than a philosophical shift', valence: 'positive', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'treble smoothness, spatial refinement, and tonal authority over Pontus', cost: 'not a cost — the Venus is genuinely refined; the trade-off is financial investment versus marginal incremental gain', relative_to: 'Denafrips Pontus II', basis: 'review_consensus' },
        { gains: 'organic warmth and harmonic texture', cost: 'ultimate transient sharpness and clinical resolution versus delta-sigma precision designs', relative_to: 'ESS-based DACs', basis: 'editorial_inference' },
      ],
    },
    sourceReferences: [
      { source: 'Darko.Audio', note: 'Comparison placing Venus in the Denafrips hierarchy — refinement over Pontus with retained house character.' },
      { source: 'Audiophile Style', note: 'Detailed R-2R architecture analysis and Venus-specific listening notes.' },
      { source: 'Head-Fi communities', note: 'User reports comparing Venus II to Pontus II and contemporary flagship DACs.' },
    ],
    notes: 'Venus II sits between Pontus II and Terminator II in the Denafrips R-2R lineup. More refined than Pontus — better spatial staging, smoother treble, more precise. Retains warm, organic house sound but with greater clarity and texture differentiation. A meaningful step up for systems that benefit from both R-2R warmth and spatial resolution.',
    philosophy: 'warm',
    marketType: 'value',
  },

  // ── Streamers ────────────────────────────

  {
    id: 'bluesound-node',
    brand: 'Bluesound',
    name: 'Node',
    price: 600,
    category: 'streamer',
    architecture: 'ARM-based network streamer with integrated ESS Sabre DAC, MQA, Roon Ready, AirPlay 2',
    subcategory: 'streamer',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'north-america',
    country: 'CA',
    topology: 'delta-sigma',
    archetypes: { primary: 'flow_organic', secondary: 'tonal_saturated' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'neutral',
      airy_closed: 'neutral',
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Warm, smooth presentation designed for non-fatiguing listening. No glare or harshness risk.',
    },
    tendencyProfile: {
      basis: 'owner_reference',
      confidence: 'medium',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'warmth', level: 'emphasized' },
        { trait: 'composure', level: 'present' },
        { trait: 'clarity', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 0.5,
      warmth: 0.5,
      tonal_density: 0.4,
      clarity: 0.4,
      speed: 0.4,
      dynamics: 0.4,
      spatial_precision: 0.4,
      texture: 0.3,
      composure: 0.5,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Competent network streamer with stable BluOS app. Built-in ESS Sabre DAC is functional but the primary value is as a transport. Warm side of neutral, smooth, non-fatiguing. Coax, optical, and HDMI eARC digital outputs. RCA and headphone analogue out.',
    retailer_links: [
      { label: 'Bluesound', url: 'https://www.bluesound.com/products/node' },
    ],
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'tonality', tendency: 'warm and smooth — designed for non-fatiguing, musicality-first presentation', basis: 'owner_reference' },
        { domain: 'streaming', tendency: 'BluOS app is stable and well-refined — no app-related dropouts or instability', basis: 'owner_reference' },
        { domain: 'dac_stage', tendency: 'competent but not remarkable — best used as a transport feeding external DAC via coax or optical', basis: 'owner_reference' },
      ],
      interactions: [
        { condition: 'used as transport with external DAC', effect: 'the Node excels as a stable network-to-digital converter; outboard DAC will dominate sonic character', valence: 'positive', basis: 'owner_reference' },
        { condition: 'internal DAC in use', effect: 'warm, smooth character keeps listening relaxed but does not deliver high-resolution transparency', valence: 'neutral', basis: 'owner_reference' },
        { condition: 'in systems already warm or rolled-back in treble', effect: 'additive warmth can accumulate — monitor for mid-bass bloom and rolled-off top-end', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'stable streaming app, non-fatiguing warm character, multiple digital outputs', cost: 'DAC stage sophistication and transparency', relative_to: 'server-based streamers or external DAC chains', basis: 'owner_reference' },
      ],
    },
    sourceReferences: [
      { source: 'Owner reference', note: 'Excellent streaming transport with stable BluOS app. Built-in DAC is competent but external DAC via coax/optical recommended for serious listening.' },
    ],
    notes: 'Owner reference. Excellent streaming transport with stable BluOS app. Built-in DAC is competent but external DAC via coax/optical recommended for serious listening. No USB digital output.',
    philosophy: 'neutral',
    marketType: 'traditional',
  },

  {
    id: 'innuos-zen-mk3',
    brand: 'Innuos',
    name: 'Zen Mk3',
    price: 2800,
    category: 'streamer',
    architecture: 'Linux-based music server/streamer with linear power supply, SSD storage, USB output',
    subcategory: 'streamer',
    priceTier: 'upper-mid',
    brandScale: 'specialist',
    region: 'europe',
    country: 'PT',
    topology: 'other',
    archetypes: { primary: 'precision_explicit', secondary: 'spatial_holographic' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'neutral',
      airy_closed: 'neutral',
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Clean, quiet background. No fatigue or glare — the character is transparent, not editorial.',
    },
    tendencyProfile: {
      basis: 'owner_reference',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'composure', level: 'present' },
        { trait: 'warmth', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.6,
      speed: 0.5,
      spatial_precision: 0.5,
      flow: 0.5,
      warmth: 0.0,
      tonal_density: 0.4,
      dynamics: 0.4,
      texture: 0.4,
      composure: 0.6,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Minimalist Linux-based music server with linear PSU and clean USB output. The Innuos Zen improves sound quality through dedicated OS, optimized power supply, and low-noise USB architecture. Black background, improved transient clarity, excellent noise floor. Storage-based with SSD and ripping capability.',
    retailer_links: [
      { label: 'Innuos', url: 'https://www.innuos.com/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'power_delivery', tendency: 'linear PSU significantly reduces noise floor compared to SMPS — improves low-level detail and spatial clarity', basis: 'owner_reference' },
        { domain: 'usb_output', tendency: 'clean, low-jitter USB output via dedicated architecture — external DAC will perform at full potential', basis: 'owner_reference' },
        { domain: 'app_ecosystem', tendency: 'Innuos Sense app is refined and stable — no platform friction', basis: 'owner_reference' },
      ],
      interactions: [
        { condition: 'paired with high-resolution external DAC', effect: 'the Zen removes power and timing noise bottlenecks — allows DAC to deliver full sonic performance', valence: 'positive', basis: 'owner_reference' },
        { condition: 'in storage-based workflows with local ripping', effect: 'integrated SSD storage and Innuos ripping tools create a unified ecosystem', valence: 'positive', basis: 'owner_reference' },
        { condition: 'as alternative to generic computer audio', effect: 'substantial improvement in clarity, image focus, and dynamic ease — the architecture change pays dividend in listening experience', valence: 'positive', basis: 'owner_reference' },
      ],
      tradeoffs: [
        { gains: 'clean USB output, linear PSU, low noise floor, dedicated OS, storage-based convenience', cost: 'significant capital investment compared to computer-based streaming', relative_to: 'PC/NAS streaming', basis: 'owner_reference' },
        { gains: 'minimalist design philosophy focuses on clean signal path, not feature count', cost: 'fewer streaming protocol options or integrated DAC — requires external DAC for best results', relative_to: 'integrated streamer/DAC units', basis: 'editorial_inference' },
      ],
    },
    sourceReferences: [
      { source: 'Owner reference', note: 'Former owner. Minimalist music server — the value is in the clean USB output via linear PSU and dedicated Innuos Sense app.' },
      { source: 'Innuos ecosystem', note: 'The Zen occupies the sweet spot between the budget Pulse and the statement Statement in the Innuos line.' },
    ],
    notes: 'Former owner reference. Minimalist music server — the value is in the clean USB output via linear PSU and dedicated Innuos Sense app. Storage-based with SSD. Ripping capability. The Zen occupies the sweet spot in the Innuos line between the budget Pulse and the statement Statement.',
    philosophy: 'neutral',
    marketType: 'traditional',
  },

  {
    id: 'innuos-pulse-mini',
    brand: 'Innuos',
    name: 'Pulse Mini',
    price: 1100,
    category: 'streamer',
    architecture: 'Network streamer with linear power supply, Roon Ready, USB output',
    subcategory: 'streamer',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'europe',
    country: 'PT',
    topology: 'other',
    archetypes: { primary: 'precision_explicit' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'neutral',
      elastic_controlled: 'neutral',
      airy_closed: 'neutral',
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Clean and quiet. Transparent character — no fatigue or colorations.',
    },
    tendencyProfile: {
      basis: 'editorial_inference',
      confidence: 'medium',
      tendencies: [
        { trait: 'clarity', level: 'present' },
        { trait: 'composure', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'warmth', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.5,
      speed: 0.4,
      spatial_precision: 0.4,
      flow: 0.4,
      warmth: 0.0,
      tonal_density: 0.3,
      dynamics: 0.4,
      texture: 0.3,
      composure: 0.5,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Entry-level Innuos network streamer with linear power supply and Innuos Sense app. USB and S/PDIF digital outputs. Clean, stable streaming with less refined PSU than Zen Mk3 but still a meaningful upgrade from generic computer or NAS streaming.',
    retailer_links: [
      { label: 'Innuos', url: 'https://www.innuos.com/' },
    ],
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'power_delivery', tendency: 'linear PSU delivers cleaner power than SMPS — improves noise floor and detail retrieval relative to PC streaming', basis: 'editorial_inference' },
        { domain: 'usb_output', tendency: 'dedicated USB output with Innuos architecture — transparent handoff to external DAC', basis: 'editorial_inference' },
        { domain: 'app_stability', tendency: 'Innuos Sense app is refined and responsive', basis: 'editorial_inference' },
      ],
      interactions: [
        { condition: 'paired with external DAC', effect: 'clean power and timing reduce upstream noise — allows DAC to perform optimally', valence: 'positive', basis: 'editorial_inference' },
        { condition: 'in network streaming workflows', effect: 'Roon Ready support and stable app create familiar, friction-free operation', valence: 'positive', basis: 'editorial_inference' },
        { condition: 'as upgrade from PC or NAS streaming', effect: 'meaningful improvement in clarity and stability without approaching Zen investment', valence: 'positive', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'entry to Innuos ecosystem, linear PSU, clean USB output, stable app', cost: 'less refined power supply and feature set than Zen Mk3', relative_to: 'Innuos Zen Mk3', basis: 'editorial_inference' },
        { gains: 'significantly quieter and cleaner than generic SMPS-based streamers', cost: 'higher cost than budget network streamers', relative_to: 'WiiM or Bluesound entry models', basis: 'editorial_inference' },
      ],
    },
    sourceReferences: [
      { source: 'Innuos product positioning', note: 'Entry point to Innuos ecosystem with linear PSU and dedicated streaming app.' },
    ],
    notes: 'Entry point to Innuos ecosystem. Linear PSU, Innuos Sense app, USB and S/PDIF output. A meaningful upgrade from generic computer/NAS streaming.',
    philosophy: 'neutral',
    marketType: 'traditional',
  },

  // ── Five new statement-tier DACs ──────────────────────

  {
    id: 'chord-dave',
    brand: 'Chord',
    name: 'DAVE',
    price: 10500,
    category: 'dac',
    architecture: 'FPGA (Spartan 6, 164,000-tap WTA filter), built-in preamp and headphone amp, dual BNC, USB, optical',
    subcategory: 'standalone-dac',
    priceTier: 'statement',
    brandScale: 'specialist',
    region: 'uk',
    country: 'GB',
    topology: 'fpga',
    archetypes: { primary: 'precision_explicit', secondary: 'spatial_holographic' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'airy',
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'Neutral-to-cool tonal balance reveals everything in the recording. Can sound lean in warm systems. The precision is remarkable but lack of warmth can be exposing in lean or bright systems.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'speed', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'composure', level: 'emphasized' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'flow', level: 'less_emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 1.0,
      speed: 1.0,
      spatial_precision: 1.0,
      composure: 1.0,
      dynamics: 0.7,
      texture: 0.7,
      flow: 0.7,
      warmth: 0.0,
      tonal_density: 0.4,
      fatigue_risk: 0.2,
      glare_risk: 0.2,
    },
    description:
      'Supreme timing precision and enormous spatial depth. Razor-sharp transients, neutral-to-cool tonal balance. Not an analog-sounding DAC — pure precision. Reveals everything in the recording without editorializing.',
    retailer_links: [
      { label: 'Chord Electronics', url: 'https://chordelectronics.co.uk/product/dave/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'timing', tendency: 'supreme timing precision and razor-sharp transient definition', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'neutral-to-cool balance — lean without brightness, achieved through timing not treble emphasis', basis: 'listener_consensus' },
        { domain: 'spatial', tendency: 'enormous spatial depth and holographic imaging — three-dimensional rendering of the soundstage', basis: 'review_consensus' },
        { domain: 'resolution', tendency: 'incredible transparency reveals everything in the recording without adding color', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'in systems already biased toward brightness or lean tonality', effect: 'the neutrality and clarity can reinforce thinness — pair with warm amplification for balance', valence: 'caution', basis: 'editorial_inference' },
        { condition: 'paired with tonally dense or warm amplifiers', effect: 'the FPGA timing cuts through added warmth without losing clarity — creates ideal balance', valence: 'positive', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'uncompromising transient precision and spatial rendering', cost: 'tonal density and harmonic saturation versus warm R2R designs', relative_to: 'Denafrips and other R2R flagship DACs', basis: 'editorial_inference' },
      ],
    },
    sourceReferences: [
      { source: 'Darko.Audio', note: 'Detailed coverage of FPGA WTA filter architecture and spatial rendering.' },
      { source: 'What Hi-Fi?', note: 'Review noting supreme timing and transient definition.' },
      { source: 'Head-Fi community', note: 'Extensive comparisons placing DAVE at the pinnacle of precision DACs.' },
    ],
    notes: 'Statement-tier FPGA design. The Chord DAVE represents the pinnacle of timing-first DAC architecture. Extraordinary spatial depth, clarity, and composure. Best in systems that benefit from precision without requiring tonal warmth.',
    imageUrl: 'https://chordelectronics.co.uk/wp-content/uploads/2018/09/DAVE-1.jpg',
    philosophy: 'energy',
    marketType: 'traditional',
  },

  {
    id: 'mola-mola-tambaqui',
    brand: 'Mola Mola',
    name: 'Tambaqui',
    price: 13400,
    category: 'dac',
    architecture: 'Custom discrete dual DAC, all PCM upsampled to 3.125MHz/32-bit, Roon Ready, headphone amp',
    subcategory: 'standalone-dac',
    priceTier: 'statement',
    brandScale: 'boutique',
    region: 'europe',
    country: 'NL',
    topology: 'other',
    archetypes: { primary: 'precision_explicit', secondary: 'spatial_holographic' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'airy',
    },
    fatigueAssessment: {
      risk: 'very_low',
      notes: 'Despite neutral/analytical lean, the natural high-frequency rendering avoids digital harshness. Low fatigue if system is balanced.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'composure', level: 'emphasized' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'flow', level: 'less_emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 1.0,
      spatial_precision: 1.0,
      composure: 1.0,
      dynamics: 0.7,
      texture: 0.7,
      flow: 0.7,
      speed: 0.7,
      warmth: 0.0,
      tonal_density: 0.4,
      fatigue_risk: 0.1,
      glare_risk: 0.1,
    },
    description:
      'Neutral, analytical, supremely clean discrete design. 130dB SNR. Dense imaging with weight and scale. Lean tonal balance reveals recordings without editorializing. Natural high frequencies avoid digital edge. Bruno Putzeys design excellence.',
    retailer_links: [
      { label: 'Mola Mola', url: 'https://www.molamola.audio/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'neutral and analytical — reveals recording without adding color', basis: 'review_consensus' },
        { domain: 'clarity', tendency: 'supremely clean with 130dB SNR — exceptional signal-to-noise ratio', basis: 'review_consensus' },
        { domain: 'spatial', tendency: 'dense imaging with weight and scale — precise three-dimensional rendering', basis: 'listener_consensus' },
        { domain: 'texture', tendency: 'natural high frequencies avoid digital harshness — refined treble extension', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'in warm or tonally dense systems', effect: 'the analytical leanness provides transparency and clarity without being masked', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'paired with already-precise amplification', effect: 'the neutrality can reinforce analytical character — monitor system balance', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'analytical clarity and supreme cleanliness', cost: 'tonal density and harmonic warmth versus R2R designs', relative_to: 'warm R2R flagship DACs', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Darko.Audio', note: 'Review highlighting custom discrete architecture and signal purity.', url: 'https://darko.audio/2020/08/mola-mola-tambaqui-video-review/' },
      { source: 'Stereophile', note: 'Measurement and listening coverage of the Tambaqui\'s exceptional SNR and imaging.' },
      { source: 'AudioGon community', note: 'Comparisons with DAVE and other statement-tier precision DACs.' },
    ],
    notes: 'Statement-tier discrete design by Bruno Putzeys. The Tambaqui represents a different architectural philosophy from R2R — pure custom discrete implementation with extraordinary cleanliness. Best for systems that prioritize analytical clarity and imaging precision.',
    philosophy: 'warm',
    marketType: 'nonTraditional',
  },

  {
    id: 'lampizator-baltic-5',
    brand: 'Lampizator',
    name: 'Baltic 5',
    price: 7000,
    category: 'dac',
    architecture: 'Tube output stage (12BH7), choke-filtered PSU, directly heated rectifier, NOS R2R, DSD512 native',
    subcategory: 'standalone-dac',
    priceTier: 'high-end',
    brandScale: 'boutique',
    region: 'europe',
    country: 'PL',
    topology: 'r2r',
    archetypes: { primary: 'flow_organic', secondary: 'tonal_saturated' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'elastic',
      airy_closed: 'airy',
    },
    fatigueAssessment: {
      risk: 'very_low',
      notes: 'Tube output stage and NOS approach create an inherently non-fatiguing, warm, organic presentation. Zero harshness.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'warmth', level: 'present' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'texture', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'clarity', level: 'less_emphasized' },
        { trait: 'speed', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 1.0,
      warmth: 0.7,
      tonal_density: 1.0,
      texture: 0.7,
      spatial_precision: 0.7,
      dynamics: 0.7,
      clarity: 0.7,
      speed: 0.4,
      composure: 0.4,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Pure, spacious, organic presentation. Tube warmth without artificial coloration. Musical flow and naturalness. Smooth harmonic delivery. The entry point to serious Lampizator ownership with full NOS tube magic.',
    retailer_links: [
      { label: 'Lampizator', url: 'https://www.lampizator.eu/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'pure tube warmth without artificial coloration — organic and natural', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'spacious, layered texture with strong midrange presence and body', basis: 'listener_consensus' },
        { domain: 'flow', tendency: 'musical flow and phrasing coherence — rhythm breathes without losing precision', basis: 'listener_consensus' },
        { domain: 'harmonic', tendency: 'smooth harmonic presentation with realistic instrument tone', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'in systems that are already warm or dark', effect: 'the cumulative warmth can reduce clarity — best with some system brightness for balance', valence: 'caution', basis: 'editorial_inference' },
        { condition: 'paired with fast or analytical amplifiers', effect: 'tube warmth and amp precision complement each other — creates musicality with control', valence: 'positive', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'organic warmth, flow, and harmonic naturalness', cost: 'ultimate clarity and transient speed versus FPGA and precision delta-sigma designs', relative_to: 'Chord and ESS-based flagship DACs', basis: 'editorial_inference' },
      ],
    },
    sourceReferences: [
      { source: 'Darko.Audio', note: 'Review highlighting tube output stage warmth and NOS character.' },
      { source: 'Audiophile Style', note: 'Detailed analysis of Lampizator\'s directly heated rectifier topology.' },
      { source: 'Head-Fi communities', note: 'User reports on tube warmth character and comparison to other R2R designs.' },
    ],
    notes: 'Lampizator Baltic 5 is the entry to serious tube-based R2R conversion. NOS architecture with tube output stage delivers organic warmth and musical flow. Best for listeners prioritizing organic musicality over analytical precision.',
    philosophy: 'warm',
    marketType: 'nonTraditional',
  },

  {
    id: 'sonnet-pasithea',
    brand: 'Sonnet',
    name: 'Pasithea',
    price: 5000,
    category: 'dac',
    architecture: 'Eight custom SDA-3 R2R discrete resistor ladder modules per channel, NOS, discrete component output',
    subcategory: 'standalone-dac',
    priceTier: 'high-end',
    brandScale: 'boutique',
    region: 'europe',
    country: 'NL',
    topology: 'r2r',
    archetypes: { primary: 'flow_organic', secondary: 'tonal_saturated' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'elastic',
      airy_closed: 'neutral',
    },
    fatigueAssessment: {
      risk: 'very_low',
      notes: 'NOS mode bypasses reconstruction filtering, avoiding pre-ringing that causes listening fatigue. R2R ladder conversion adds even-order harmonic density that softens the presentation.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'warmth', level: 'present' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'speed', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 0.85,
      warmth: 0.7,
      tonal_density: 0.85,
      texture: 0.85,
      spatial_precision: 0.7,
      dynamics: 0.7,
      clarity: 0.7,
      speed: 0.4,
      composure: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Eight discrete R2R modules per channel — more resistor elements per conversion step means finer voltage resolution, reducing quantization noise and producing smoother low-level detail than simpler R2R implementations. NOS mode bypasses digital reconstruction filtering, allowing transients to arrive without the pre-ringing that sharp digital filters introduce. The combination delivers dense harmonic midrange and natural phrasing, stepping up from the Morpheus with greater resolution.',
    retailer_links: [
      { label: 'Sonnet', url: 'https://www.sonnet.nl/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'R2R ladder conversion inherently produces even-order harmonics that delta-sigma chips suppress — this gives the Pasithea a denser midrange with more overtone structure per instrument', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'eight modules per channel increase voltage resolution in the ladder — finer steps mean smoother low-level transitions and less quantization roughness in quiet passages', basis: 'listener_consensus' },
        { domain: 'flow', tendency: 'NOS mode avoids the pre-ringing of sharp digital reconstruction filters — transients arrive without the smeared leading edge that oversampling introduces, which listeners perceive as more natural phrasing', basis: 'listener_consensus' },
        { domain: 'dynamics', tendency: 'discrete transistor output stage has higher current capability than the op-amp outputs typical at this price — macro-dynamics have physical weight', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with fast or precision-oriented amplifiers', effect: 'the DAC\'s harmonic richness complements the amp\'s transient speed — body from the source, control from the amp', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in systems already warm or tonally dense', effect: 'cumulative harmonic density can reduce transparency and separation — midrange may feel congested', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'harmonic density from R2R conversion, smooth low-level detail from eight-module architecture, and natural transient shape from NOS mode', cost: 'the ultimate transient precision and treble extension of oversampling delta-sigma designs — NOS mode trades high-frequency accuracy for temporal purity', relative_to: 'ESS-based and FPGA flagship DACs (Weiss DAC501, Chord DAVE)', basis: 'editorial_inference' },
      ],
    },
    sourceReferences: [
      { source: 'Audiophile Style', note: 'Analysis of eight-module SDA-3 architecture and NOS implementation.' },
      { source: 'Head-Fi', note: 'User comparisons between Pasithea and Morpheus highlighting upgrade path.' },
    ],
    notes: 'Eight discrete R2R modules per channel is the densest ladder architecture at this price. More modules = finer voltage resolution = smoother conversion. NOS mode bypasses reconstruction filtering for temporal purity at the cost of high-frequency rolloff.',
    philosophy: 'warm',
    marketType: 'nonTraditional',
  },

  {
    id: 'totaldac-d1-unity',
    brand: 'TotalDAC',
    name: 'd1-unity',
    price: 12500,
    category: 'dac',
    architecture: 'Discrete R2R ladder (100 Vishay foil resistors per channel), fully discrete transistor output stage',
    subcategory: 'standalone-dac',
    priceTier: 'statement',
    brandScale: 'boutique',
    region: 'europe',
    country: 'FR',
    topology: 'r2r',
    archetypes: { primary: 'flow_organic', secondary: 'tonal_saturated' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'elastic',
      airy_closed: 'neutral',
    },
    fatigueAssessment: {
      risk: 'very_low',
      notes: 'Organic R2R presentation. Discrete Vishay foil resistors and transistor output deliver body without digital edge.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'warmth', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'speed', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 1.0,
      warmth: 0.7,
      tonal_density: 1.0,
      texture: 1.0,
      spatial_precision: 0.7,
      dynamics: 0.7,
      clarity: 0.7,
      speed: 0.4,
      composure: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
    },
    description:
      'Natural, organic architecture with strong presence and instrument contrast. Clarity alongside body and dynamic weight without fatigue. Realistic timbre. The unified architecture improves upon the d1-twelve MK2 with consolidated performance.',
    retailer_links: [
      { label: 'TotalDAC', url: 'https://www.totaldac.com/' },
    ],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'natural and organic with strong tonal presence — body and weight without warmth excess', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'refined harmonic texture with distinct instrument separation and presence', basis: 'listener_consensus' },
        { domain: 'contrast', tendency: 'strong dynamic contrast between instruments with authentic timbre rendering', basis: 'review_consensus' },
        { domain: 'flow', tendency: 'organic phrasing coherence with natural musical continuity', basis: 'listener_consensus' },
      ],
      interactions: [
        { condition: 'paired with fast, precise amplifiers', effect: 'R2R organic weight and amp precision create ideal balance — no sluggishness', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'in systems already warm or dense', effect: 'cumulative body can reduce clarity — monitor system balance for optimal tuning', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'unified architectural coherence, discrete Vishay resistor quality, realistic timbre', cost: 'not a cost but a philosophical choice — trades precision for organic musicality', relative_to: 'Chord DAVE and precision-first DACs', basis: 'editorial_inference' },
      ],
    },
    sourceReferences: [
      { source: 'Darko.Audio', note: 'Review of unified architecture and Vishay resistor implementation.' },
      { source: 'Stereophile', note: 'Listening coverage of TotalDAC\'s organic presentation and timbre accuracy.' },
      { source: 'AudioGon community', note: 'Comparisons with d1-twelve MK2 and other statement-tier R2R DACs.' },
    ],
    notes: 'Statement-tier discrete R2R masterwork. The d1-unity represents TotalDAC\'s architectural pinnacle — consolidated design with 100 Vishay foil resistors per channel. Unified presentation delivers organic musicality with serious clarity and presence. Best for listeners who value harmonic authenticity and textural richness at the highest level.',
    philosophy: 'warm',
    marketType: 'nonTraditional',
  },

  // ── Budget warm/musical DACs ──────────────────────────

  {
    id: 'ifi-zen-dac-v2',
    brand: 'iFi',
    name: 'Zen DAC V2',
    price: 199,
    category: 'dac' as const,
    architecture: 'Burr-Brown True Native, balanced output',
    subcategory: 'standalone-dac',
    priceTier: 'budget' as const,
    brandScale: 'specialist' as const,
    region: 'europe' as const,
    country: 'GB',
    topology: 'delta-sigma',
    archetypes: { primary: 'flow_organic' as const },
    primaryAxes: {
      warm_bright: 'warm' as const,
      smooth_detailed: 'smooth' as const,
      elastic_controlled: 'neutral' as const,
      airy_closed: 'neutral' as const,
    },
    fatigueAssessment: {
      risk: 'low' as const,
      notes: 'Warm, smooth character — very low fatigue risk. Designed for extended listening.',
    },
    tendencyProfile: {
      basis: 'review_consensus' as const,
      confidence: 'medium' as const,
      tendencies: [
        { trait: 'flow', level: 'present' as const },
        { trait: 'tonal_density', level: 'present' as const },
        { trait: 'warmth', level: 'present' as const },
        { trait: 'clarity', level: 'less_emphasized' as const },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 0.7,
      tonal_density: 0.7,
      clarity: 0.4,
      dynamics: 0.4,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      warmth: 0.7,
      composure: 0.4,
    },
    description:
      'Warm, musical Burr-Brown implementation with balanced output at a budget price. iFi\'s analog warmth voicing makes this a natural fit for bright or lean systems. Not a resolution champion — prioritises musicality and long-session comfort.',
    retailer_links: [
      { label: 'iFi Audio', url: 'https://ifi-audio.com/products/zen-dac/' },
      { label: 'Amazon', url: 'https://www.amazon.com/dp/B09J8XGRS4' },
    ],
    sourceReferences: [
      { source: 'Darko.Audio', note: 'Review covering Burr-Brown warmth and value proposition.' },
      { source: 'Head-Fi community', note: 'Extensive impressions as a warm budget DAC/amp.' },
    ],
    notes: 'Budget warm DAC with balanced output. The Burr-Brown implementation adds body and warmth that most sub-$200 DACs lack.',
    philosophy: 'warm',
    marketType: 'traditional',
  },

  {
    id: 'musical-fidelity-v90-dac',
    brand: 'Musical Fidelity',
    name: 'V90-DAC',
    price: 299,
    category: 'dac' as const,
    architecture: 'Burr-Brown PCM5102A, single-ended Class A output',
    subcategory: 'standalone-dac',
    priceTier: 'budget' as const,
    brandScale: 'specialist' as const,
    region: 'europe' as const,
    country: 'GB',
    topology: 'delta-sigma',
    archetypes: { primary: 'tonal_saturated' as const },
    primaryAxes: {
      warm_bright: 'warm' as const,
      smooth_detailed: 'smooth' as const,
      elastic_controlled: 'neutral' as const,
      airy_closed: 'neutral' as const,
    },
    fatigueAssessment: {
      risk: 'low' as const,
      notes: 'The Class A output stage rolls off the top end gently and adds even-order harmonic body that the PCM5102A chip doesn\'t natively produce. The result is a softer presentation than the chip alone would deliver.',
    },
    tendencyProfile: {
      basis: 'review_consensus' as const,
      confidence: 'medium' as const,
      tendencies: [
        { trait: 'flow', level: 'present' as const },
        { trait: 'tonal_density', level: 'present' as const },
        { trait: 'clarity', level: 'less_emphasized' as const },
      ],
      riskFlags: [],
    },
    traits: {
      flow: 0.7,
      tonal_density: 0.7,
      clarity: 0.4,
      dynamics: 0.4,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      warmth: 0.7,
    },
    description:
      'Budget DAC using a Burr-Brown PCM5102A delta-sigma chip with a single-ended Class A analog output stage. The PCM5102A converts neutrally — the warmth comes from the Class A output stage, which adds even-order harmonics and softens the treble downstream. More midrange body than typical budget DACs that use op-amp outputs.',
    retailer_links: [
      { label: 'Musical Fidelity', url: 'https://www.musicalfidelity.com/v90-dac' },
    ],
    sourceReferences: [
      { source: 'What Hi-Fi?', note: 'Review praising warm tonality and musicality for the price.' },
      { source: 'Stereophile', note: 'Brief coverage of Musical Fidelity V-series budget components.' },
    ],
    notes: 'The warmth comes from the Class A analog output stage, not the delta-sigma chip. The PCM5102A converts neutrally; the output stage adds harmonic body. This is why the entry has delta-sigma topology but warm traits — the analog section downstream of the chip defines the tonal character.',
    philosophy: 'neutral',
    marketType: 'traditional',
  },

  {
    id: 'schiit-modi-multibit',
    brand: 'Schiit',
    name: 'Modi Multibit',
    price: 299,
    category: 'dac' as const,
    architecture: 'Multibit (Analog Devices AD5547)',
    subcategory: 'standalone-dac',
    priceTier: 'budget' as const,
    brandScale: 'specialist' as const,
    region: 'north-america' as const,
    country: 'US',
    topology: 'multibit',
    archetypes: { primary: 'rhythmic_propulsive' as const },
    primaryAxes: {
      warm_bright: 'neutral' as const,
      smooth_detailed: 'neutral' as const,
      elastic_controlled: 'elastic' as const,
      airy_closed: 'neutral' as const,
    },
    fatigueAssessment: {
      risk: 'low' as const,
      notes: 'Multibit conversion avoids the treble artifacts that cause delta-sigma fatigue. Engaging rather than relaxing.',
    },
    tendencyProfile: {
      basis: 'review_consensus' as const,
      confidence: 'medium' as const,
      tendencies: [
        { trait: 'dynamics', level: 'present' as const },
        { trait: 'flow', level: 'present' as const },
        { trait: 'tonal_density', level: 'present' as const },
        { trait: 'clarity', level: 'less_emphasized' as const },
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
      elasticity: 0.7,
    },
    description:
      'Entry-level multibit DAC bringing Schiit\'s engagement-first philosophy to the $300 tier. Shares the Bifrost\'s dynamic snap and tonal weight in a smaller package. More engaging than typical budget delta-sigma options.',
    retailer_links: [
      { label: 'Schiit', url: 'https://www.schiit.com/products/modi' },
    ],
    sourceReferences: [
      { source: 'Darko.Audio', note: 'Comparison with Modi delta-sigma and budget competitors.' },
      { source: 'The Audiophiliac', note: 'Steve Guttenberg coverage of the multibit Modi as a budget giant-killer.' },
    ],
    notes: 'Budget multibit DAC with surprising dynamics and engagement. Entry point into Schiit\'s multibit house sound.',
    philosophy: 'energy',
    marketType: 'traditional',
  },

  // ── Cen.Grand (China — discrete DSD) ───────────────────

  {
    id: 'cengrand-dsdac-1-0-deluxe',
    brand: 'Cen.Grand',
    name: 'DSDAC 1.0 Deluxe',
    price: 3500,
    category: 'dac',
    architecture: 'Discrete DSD conversion (no off-the-shelf DAC chip) + R-2R ladder for PCM',
    subcategory: 'standalone-dac',
    priceTier: 'upper-mid',
    brandScale: 'specialist',
    region: 'asia',
    country: 'CN',
    topology: 'r2r',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'elastic',
      airy_closed: 'neutral',
    },
    fatigueAssessment: {
      risk: 'very_low',
      notes: 'Discrete DSD conversion avoids the sharp reconstruction filters of chip-based delta-sigma — no pre-ringing on transients. The slower transient edges and harmonic density make extended listening easy.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'warmth', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'flow', level: 'emphasized' },
        { trait: 'texture', level: 'present' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.6, warmth: 0.8, tonal_density: 0.85,
      speed: 0.6, dynamics: 0.7, flow: 0.85,
      spatial_precision: 0.65, composure: 0.65, texture: 0.8,
      fatigue_risk: 0.0, glare_risk: 0.0,
      elasticity: 0.7,
    },
    description: 'Discrete DSD conversion without off-the-shelf DAC chips — the DSD-to-analog path is built from individual resistors and transistors, avoiding the reconstruction filtering that chip-based converters impose. DSD\'s native 1-bit stream reaches the analog output with minimal processing, producing denser harmonic structure and softer transient edges than chip-based designs. PCM input is converted via a discrete R-2R ladder with similar tonal character.',
    retailer_links: [],
    tendencies: {
      confidence: 'high',
      character: [
        { domain: 'tonality', tendency: 'the discrete conversion path produces denser harmonic overtones than chip-based DSD decoding — instruments have more body and midrange weight because the conversion preserves harmonic information that integrated chips attenuate during internal processing', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'transient edges are slower than chip-based designs because there is no sharp reconstruction filter — leading edges are rounded rather than pre-rung, which listeners perceive as more continuous phrasing', basis: 'review_consensus' },
        { domain: 'texture', tendency: 'the discrete resistor ladder for PCM and discrete transistor path for DSD both add their own harmonic signature — more textural complexity per note than the cleaner output of integrated chips', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'fed native DSD files (DSD64, DSD128, DSD256)', effect: 'DSD reaches the analog output with minimal processing — the discrete path handles the 1-bit stream directly, which is where the topology\'s advantage over chip-based DSD is most audible', valence: 'positive', basis: 'review_consensus' },
        { condition: 'paired with transparent or fast amplification', effect: 'the DAC provides harmonic density and body; a transparent amp lets that through without adding further coloration', valence: 'positive', basis: 'editorial_inference' },
        { condition: 'paired with already-warm tube amplification', effect: 'cumulative harmonic density may reduce clarity and separation — the system can tip toward congestion in the midrange', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'harmonic density from discrete conversion, DSD-native processing without chip compromises, and textural richness from the analog output path', cost: 'transient speed and leading-edge precision are slower than chip-based delta-sigma or FPGA designs — the discrete path trades temporal accuracy for harmonic completeness', relative_to: 'precision delta-sigma (Weiss DAC501) or FPGA DACs (Chord DAVE)', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: '6moons', note: 'Reviewed. Praised for discrete DSD topology and harmonically dense presentation.' },
    ],
    notes: 'Discrete DSD topology is genuinely unique — most DACs use chips or FPGA. Cen.Grand builds DSD conversion from individual components.',
    philosophy: 'warm',
    marketType: 'traditional',
  },

  // ── WiiM Ultra (China — streaming DAC) ─────────────────

  {
    id: 'wiim-ultra',
    brand: 'WiiM',
    name: 'Ultra',
    price: 329,
    category: 'dac',
    architecture: 'Streaming transport + ESS ES9038Q2M DAC, balanced XLR output, no amplification',
    subcategory: 'standalone-dac',
    priceTier: 'budget',
    brandScale: 'established',
    region: 'asia',
    country: 'CN',
    topology: 'delta-sigma',
    archetypes: { primary: 'precision_explicit' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'neutral',
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'ES9038Q2M is clean and well-behaved. No inherent fatigue triggers at this implementation level.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'medium',
      tendencies: [
        { trait: 'clarity', level: 'present' },
        { trait: 'composure', level: 'present' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.65, warmth: 0.25, tonal_density: 0.4,
      speed: 0.6, dynamics: 0.5, flow: 0.5,
      spatial_precision: 0.55, composure: 0.6, texture: 0.4,
      fatigue_risk: 0.1, glare_risk: 0.05,
      elasticity: 0.4,
    },
    description: 'Streaming DAC with ES9038Q2M and balanced output. The ES9038Q2M provides clean, detailed conversion with adequate dynamic range for this price tier. Balanced XLR output extends the performance ceiling when paired with balanced amplification. No built-in amplification — source-only device.',
    retailer_links: [
      { label: 'WiiM', url: 'https://www.wiimhome.com/' },
    ],
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'tonality', tendency: 'neutral to slightly lean — ESS delta-sigma provides clarity over tonal density', basis: 'review_consensus' },
        { domain: 'dynamics', tendency: 'clean conversion with adequate dynamic range for the price tier', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'feeding a warm or tube amplifier', effect: 'the neutral source lets downstream warmth dominate — good complementary pairing', valence: 'positive', basis: 'editorial_inference' },
        { condition: 'compared to standalone DACs at 3-5x price', effect: 'resolution, staging, and tonal density differences become apparent', valence: 'neutral', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'streaming integration, balanced output, ESS DAC quality, compact, affordable', cost: 'tonal density, spatial depth, and harmonic texture of dedicated DACs at higher price points', relative_to: 'standalone DACs ($800+)', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'WiiM', note: 'Manufacturer product page.', url: 'https://www.wiimhome.com/' },
    ],
    notes: 'The Ultra is WiiM\'s source-only offering — no amplification. Balanced XLR output makes it a viable source for balanced amplifiers and active speakers.',
    philosophy: 'neutral',
    marketType: 'nonTraditional',
  },

  // ── FiiO K11 R2R (China — budget R-2R DAC) ────────────

  {
    id: 'fiio-k11-r2r',
    brand: 'FiiO',
    name: 'K11 R2R',
    price: 150,
    category: 'dac',
    architecture: 'R-2R (resistor ladder) DAC with headphone amplifier, balanced 4.4mm output',
    subcategory: 'standalone-dac',
    priceTier: 'budget',
    brandScale: 'specialist',
    region: 'asia',
    country: 'CN',
    topology: 'r2r',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    primaryAxes: {
      warm_bright: 'warm',
      smooth_detailed: 'smooth',
      elastic_controlled: 'elastic',
      airy_closed: 'neutral',
    },
    fatigueAssessment: {
      risk: 'very_low',
      notes: 'R-2R conversion produces smoother transient edges than delta-sigma. Warm tonal balance reduces fatigue risk.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'medium',
      tendencies: [
        { trait: 'warmth', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'flow', level: 'present' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.5, warmth: 0.6, tonal_density: 0.6,
      speed: 0.5, dynamics: 0.5, flow: 0.65,
      spatial_precision: 0.45, composure: 0.5, texture: 0.6,
      fatigue_risk: 0.0, glare_risk: 0.0,
      elasticity: 0.5,
    },
    description: 'Budget R-2R DAC with headphone amplifier. The resistor ladder topology produces warmer, denser tonal balance than delta-sigma designs at this price. Transient edges are smoother. Measured precision is lower than ESS/AKM chips — the trade-off is tonal character for measured accuracy. At $150, R-2R implementation has linearity limitations but delivers the characteristic tonal density.',
    retailer_links: [
      { label: 'FiiO', url: 'https://www.fiio.com/' },
    ],
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'tonality', tendency: 'warm, tonally dense — R-2R ladder produces more harmonic weight than delta-sigma at this price', basis: 'review_consensus' },
        { domain: 'timing', tendency: 'smoother transient edges — R-2R conversion rounds leading edges compared to delta-sigma sharpness', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with neutral or lean headphones/amplifiers', effect: 'R-2R warmth adds body and tonal substance — good complementary pairing', valence: 'positive', basis: 'editorial_inference' },
        { condition: 'paired with already-warm equipment', effect: 'warmth may compound — bass and lower midrange can become heavy', valence: 'caution', basis: 'editorial_inference' },
      ],
      tradeoffs: [
        { gains: 'R-2R tonal character, warmth, smooth transients, and non-fatiguing presentation at entry price', cost: 'measured precision, detail retrieval, and transient speed of delta-sigma designs at this price', relative_to: 'delta-sigma desktop DACs (Topping DX5, SMSL DO400)', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Darko.Audio', note: 'DAR-KO Award winner.', url: 'https://darko.audio/2025/07/fiios-k11-r2r-is-a-very-special-dac-for-very-little-money/' },
      { source: 'FiiO', note: 'Manufacturer product page.', url: 'https://www.fiio.com/' },
    ],
    notes: 'One of the cheapest true R-2R DACs available. At this price, R-2R linearity is not reference-grade, but the tonal character of ladder conversion is present and distinct from delta-sigma alternatives.',
    philosophy: 'warm',
    marketType: 'traditional',
  },

  // ── Bluesound NODE X (Canada — streaming DAC) ──────────

  {
    id: 'bluesound-node-x',
    brand: 'Bluesound',
    name: 'NODE X',
    price: 799,
    category: 'dac',
    architecture: 'Streaming transport + ESS ES9038PRO DAC, MQA decoding, balanced XLR output, BluOS ecosystem',
    subcategory: 'standalone-dac',
    priceTier: 'mid',
    brandScale: 'specialist',
    region: 'north-america',
    country: 'CA',
    topology: 'delta-sigma',
    archetypes: { primary: 'precision_explicit' },
    primaryAxes: {
      warm_bright: 'neutral',
      smooth_detailed: 'detailed',
      elastic_controlled: 'controlled',
      airy_closed: 'neutral',
    },
    fatigueAssessment: {
      risk: 'low',
      notes: 'ES9038PRO is well-implemented at this tier. Clean, detailed without aggression.',
    },
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'medium',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'composure', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.75, warmth: 0.3, tonal_density: 0.5,
      speed: 0.65, dynamics: 0.6, flow: 0.55,
      spatial_precision: 0.65, composure: 0.7, texture: 0.5,
      fatigue_risk: 0.1, glare_risk: 0.05,
      elasticity: 0.45,
    },
    description: 'Streaming DAC with flagship ESS ES9038PRO chip and balanced output. The ES9038PRO provides better measured performance than budget ESS implementations — wider dynamic range, lower noise floor, improved linearity. BluOS ecosystem enables multi-room streaming. MQA hardware decoding (value depends on your streaming service and perspective on MQA).',
    retailer_links: [
      { label: 'Bluesound', url: 'https://www.bluesound.com/products/node-x/' },
    ],
    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'tonality', tendency: 'neutral, clean — ES9038PRO provides high resolution without tonal coloration', basis: 'review_consensus' },
        { domain: 'dynamics', tendency: 'good dynamic range from flagship ESS chip — better than budget streaming DACs', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'in a BluOS multi-room setup', effect: 'ecosystem integration is seamless — grouping, routing, and control are strengths', valence: 'positive', basis: 'review_consensus' },
        { condition: 'compared to dedicated DACs at similar price (Denafrips Ares, Schiit Bifrost)', effect: 'streaming convenience vs dedicated conversion quality — the NODE X trades some DAC performance for integration', valence: 'neutral', basis: 'review_consensus' },
      ],
      tradeoffs: [
        { gains: 'streaming ecosystem, flagship ESS DAC, balanced output, multi-room capability', cost: 'DAC performance ceiling vs dedicated converters at similar price; MQA dependency (controversial)', relative_to: 'standalone DAC + separate streamer', basis: 'review_consensus' },
      ],
    },
    sourceReferences: [
      { source: 'Darko.Audio', note: 'Video review + 18 follow-up thoughts.', url: 'https://darko.audio/2023/06/bluesound-node-x-video-review/' },
      { source: 'Bluesound', note: 'Manufacturer product page.', url: 'https://www.bluesound.com/products/node-x/' },
    ],
    notes: 'The NODE X is Bluesound\'s DAC-focused streamer — the ES9038PRO is a meaningful upgrade over the standard NODE\'s chip. The BluOS ecosystem competes with Sonos for multi-room but targets audiophile-grade output quality.',
    philosophy: 'neutral',
    marketType: 'traditional',
  },
];
