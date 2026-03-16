/**
 * Headphone and IEM product catalog for shopping recommendations.
 *
 * Uses the same Product interface from dacs.ts. Traits describe sonic
 * character on the 0–1 scale:
 *   strong = 1.0, moderate = 0.7, slight = 0.4, neutral = 0.0
 *
 * Headphone-relevant traits:
 *   clarity       — transparency and detail retrieval
 *   warmth        — lower midrange / upper bass fullness
 *   tonal_density — harmonic weight and body
 *   speed         — transient leading-edge definition
 *   dynamics      — micro/macro dynamic contrast
 *   flow          — musical continuity and phrasing coherence
 *   spatial_precision — imaging and staging (as headphones can)
 *   composure     — ability to stay controlled at volume
 *   texture       — tactile detail, grain of instruments
 *   fatigue_risk  — tendency toward listening fatigue (higher = riskier)
 *   openness      — spaciousness and freedom from constriction
 *
 * Additional headphone-specific metadata:
 *   portableUse   — suitability for commute/travel
 *   formFactor    — over-ear, on-ear, iem
 *   wireless      — Bluetooth capability
 *   anc           — active noise cancellation
 *   isolation     — passive noise isolation level
 *
 * Prices are approximate USD street prices as of early 2025.
 */

import type { Product } from './dacs';

/** Extended headphone metadata — attached via the product's `notes` field
 *  and parsed by the headphone selection logic. */
export interface HeadphoneMetadata {
  formFactor: 'over-ear' | 'on-ear' | 'iem';
  wireless: boolean;
  anc: boolean;
  isolation: 'low' | 'moderate' | 'high';
  portableUse: boolean;
  /** Use-case tags for matching. */
  useCases: ('commute' | 'flight' | 'gym' | 'home' | 'office' | 'studio')[];
}

/** A headphone product with explicit portable/travel metadata. */
export interface HeadphoneProduct extends Product {
  headphoneMeta: HeadphoneMetadata;
}

export const HEADPHONE_PRODUCTS: HeadphoneProduct[] = [
  // ── Budget tier ($50–$150) ──────────────────────────

  {
    id: 'moondrop-aria-2',
    brand: 'Moondrop',
    name: 'Aria 2',
    price: 80,
    category: 'iem',
    architecture: 'single dynamic driver',
    subcategory: 'other',
    priceTier: 'budget',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    archetypes: { primary: 'tonal_saturated' },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'medium',
      tendencies: [
        { trait: 'tonal_density', level: 'present' },
        { trait: 'warmth', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'clarity', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.5, warmth: 0.7, tonal_density: 0.7,
      speed: 0.5, dynamics: 0.5, flow: 0.7,
      spatial_precision: 0.4, composure: 0.5, texture: 0.5,
      fatigue_risk: 0.1, openness: 0.4,
    },
    description: 'Warm, musical IEM with good tonal density and engaging midrange. Detail retrieval is competent but secondary to tonal richness. Comfortable for long sessions. Excellent value.',
    retailer_links: [],
    headphoneMeta: {
      formFactor: 'iem',
      wireless: false,
      anc: false,
      isolation: 'high',
      portableUse: true,
      useCases: ['commute', 'flight', 'office'],
    },
  },
  {
    id: 'etymotic-er2xr',
    brand: 'Etymotic',
    name: 'ER2XR',
    price: 100,
    category: 'iem',
    architecture: 'single dynamic driver, deep-insertion',
    subcategory: 'other',
    priceTier: 'budget',
    brandScale: 'specialist',
    region: 'north-america',
    country: 'US',
    archetypes: { primary: 'precision_explicit' },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
        { trait: 'warmth', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.9, warmth: 0.3, tonal_density: 0.3,
      speed: 0.7, dynamics: 0.4, flow: 0.5,
      spatial_precision: 0.6, composure: 0.8, texture: 0.5,
      fatigue_risk: 0.1, openness: 0.4,
    },
    description: 'Reference-tuned IEM with exceptional clarity and detail. Deep-insertion design provides outstanding noise isolation. Tonal weight is lean — prioritises accuracy over warmth. Excellent for commuting and flights due to isolation.',
    retailer_links: [],
    headphoneMeta: {
      formFactor: 'iem',
      wireless: false,
      anc: false,
      isolation: 'high',
      portableUse: true,
      useCases: ['commute', 'flight', 'office', 'studio'],
    },
  },
  {
    id: 'grado-sr80x',
    brand: 'Grado',
    name: 'SR80x',
    price: 125,
    category: 'headphone',
    architecture: 'dynamic driver, open-back on-ear',
    subcategory: 'other',
    priceTier: 'budget',
    brandScale: 'boutique',
    region: 'north-america',
    country: 'US',
    archetypes: { primary: 'rhythmic_propulsive', secondary: 'precision_explicit' },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'speed', level: 'emphasized' },
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'warmth', level: 'less_emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.85, warmth: 0.35, tonal_density: 0.4,
      speed: 0.85, dynamics: 0.8, flow: 0.5,
      spatial_precision: 0.4, composure: 0.5, texture: 0.55,
      fatigue_risk: 0.35, openness: 0.8,
    },
    description: 'Grado\'s flagship budget headphone: energetic, forward-leaning on-ear with punchy midrange and aggressive treble. Classic Grado house sound — direct, detailed, punchy. Lightweight construction. Natural pairing with rock, guitar, and energetic vocal-forward music. Open-back design allows ambient sound; unsuitable for isolation.',
    retailer_links: [],
    headphoneMeta: {
      formFactor: 'on-ear',
      wireless: false,
      anc: false,
      isolation: 'low',
      portableUse: true,
      useCases: ['home', 'office'],
    },
  },

  // ── Mid tier ($150–$350) ────────────────────────────

  {
    id: 'sennheiser-momentum-4',
    brand: 'Sennheiser',
    name: 'Momentum 4 Wireless',
    price: 300,
    category: 'headphone',
    architecture: 'dynamic driver, closed-back, wireless ANC',
    subcategory: 'other',
    priceTier: 'mid-fi',
    brandScale: 'mainstream',
    region: 'europe',
    country: 'DE',
    archetypes: { primary: 'tonal_saturated', secondary: 'flow_organic' },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'medium',
      tendencies: [
        { trait: 'warmth', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'flow', level: 'present' },
        { trait: 'clarity', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.6, warmth: 0.7, tonal_density: 0.7,
      speed: 0.5, dynamics: 0.6, flow: 0.7,
      spatial_precision: 0.5, composure: 0.6, texture: 0.5,
      fatigue_risk: 0.1, openness: 0.4,
    },
    description: 'Warm, musical wireless headphone with effective ANC. Tonal balance is rich and slightly warm. Detail is present but not the primary emphasis — the Momentum 4 prioritises engagement and comfort for long listening. Battery life is excellent.',
    retailer_links: [],
    headphoneMeta: {
      formFactor: 'over-ear',
      wireless: true,
      anc: true,
      isolation: 'high',
      portableUse: true,
      useCases: ['commute', 'flight', 'office'],
    },
  },
  {
    id: 'sony-wh-1000xm5',
    brand: 'Sony',
    name: 'WH-1000XM5',
    price: 300,
    category: 'headphone',
    architecture: 'dynamic driver, closed-back, wireless ANC',
    subcategory: 'other',
    priceTier: 'mid-fi',
    brandScale: 'mainstream',
    region: 'japan',
    country: 'JP',
    archetypes: { primary: 'precision_explicit' },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'medium',
      tendencies: [
        { trait: 'clarity', level: 'present' },
        { trait: 'warmth', level: 'present' },
        { trait: 'flow', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.7, warmth: 0.6, tonal_density: 0.5,
      speed: 0.6, dynamics: 0.6, flow: 0.5,
      spatial_precision: 0.6, composure: 0.7, texture: 0.4,
      fatigue_risk: 0.1, openness: 0.4,
    },
    description: 'Class-leading ANC with a balanced, slightly warm sound signature. Comfortable and light for travel. Sound quality is competent across genres — not the most engaging for critical listening but reliable and consistent. Industry-standard ANC performance.',
    retailer_links: [],
    headphoneMeta: {
      formFactor: 'over-ear',
      wireless: true,
      anc: true,
      isolation: 'high',
      portableUse: true,
      useCases: ['commute', 'flight', 'office'],
    },
  },
  {
    id: 'apple-airpods-pro-2',
    brand: 'Apple',
    name: 'AirPods Pro 2',
    price: 250,
    category: 'iem',
    architecture: 'custom driver, wireless ANC, spatial audio',
    subcategory: 'other',
    priceTier: 'mid-fi',
    brandScale: 'mainstream',
    region: 'north-america',
    country: 'US',
    archetypes: { primary: 'flow_organic' },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'medium',
      tendencies: [
        { trait: 'flow', level: 'present' },
        { trait: 'warmth', level: 'present' },
        { trait: 'clarity', level: 'less_emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.5, warmth: 0.6, tonal_density: 0.4,
      speed: 0.5, dynamics: 0.4, flow: 0.7,
      spatial_precision: 0.5, composure: 0.5, texture: 0.3,
      fatigue_risk: 0.0, openness: 0.4,
    },
    description: 'Excellent ANC in a compact wireless IEM form factor. Sound is smooth, easy-listening with a warm lean. Detail and dynamics are sacrificed for convenience and comfort. Best-in-class Apple ecosystem integration. Adaptive transparency mode is excellent.',
    retailer_links: [],
    headphoneMeta: {
      formFactor: 'iem',
      wireless: true,
      anc: true,
      isolation: 'moderate',
      portableUse: true,
      useCases: ['commute', 'flight', 'gym', 'office'],
    },
  },
  {
    id: 'moondrop-blessing-3',
    brand: 'Moondrop',
    name: 'Blessing 3',
    price: 320,
    category: 'iem',
    architecture: '1DD + 4BA hybrid',
    subcategory: 'other',
    priceTier: 'mid-fi',
    brandScale: 'specialist',
    region: 'east-asia',
    country: 'CN',
    archetypes: { primary: 'precision_explicit', secondary: 'tonal_saturated' },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'medium',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'speed', level: 'present' },
        { trait: 'flow', level: 'present' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.8, warmth: 0.5, tonal_density: 0.7,
      speed: 0.7, dynamics: 0.7, flow: 0.6,
      spatial_precision: 0.7, composure: 0.7, texture: 0.7,
      fatigue_risk: 0.2, openness: 0.6,
    },
    description: 'Technically accomplished IEM with excellent clarity and resolution combined with good tonal body. Hybrid driver configuration delivers dynamic bass and detailed treble. One of the strongest all-rounders in the mid-price IEM market.',
    retailer_links: [],
    headphoneMeta: {
      formFactor: 'iem',
      wireless: false,
      anc: false,
      isolation: 'high',
      portableUse: true,
      useCases: ['commute', 'flight', 'home', 'office'],
    },
  },
  {
    id: 'shure-aonic-3',
    brand: 'Shure',
    name: 'AONIC 3',
    price: 179,
    category: 'iem',
    architecture: 'single balanced armature',
    subcategory: 'other',
    priceTier: 'budget',
    brandScale: 'specialist',
    region: 'north-america',
    country: 'US',
    archetypes: { primary: 'precision_explicit' },
    tendencyProfile: {
      basis: 'editorial_inference',
      confidence: 'medium',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'speed', level: 'present' },
        { trait: 'warmth', level: 'less_emphasized' },
        { trait: 'tonal_density', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.8, warmth: 0.3, tonal_density: 0.4,
      speed: 0.7, dynamics: 0.5, flow: 0.5,
      spatial_precision: 0.6, composure: 0.7, texture: 0.5,
      fatigue_risk: 0.1, openness: 0.5,
    },
    description: 'Detailed, clear IEM with balanced armature precision. Excellent isolation. Sound is articulate and revealing — tonal weight is lighter but midrange clarity is a strength. Good for reference listening on the go.',
    retailer_links: [],
    headphoneMeta: {
      formFactor: 'iem',
      wireless: false,
      anc: false,
      isolation: 'high',
      portableUse: true,
      useCases: ['commute', 'flight', 'studio'],
    },
  },
  {
    id: 'audio-technica-m50xbt2',
    brand: 'Audio-Technica',
    name: 'ATH-M50xBT2',
    price: 199,
    category: 'headphone',
    architecture: 'dynamic driver, closed-back, wireless',
    subcategory: 'other',
    priceTier: 'budget',
    brandScale: 'mainstream',
    region: 'japan',
    country: 'JP',
    archetypes: { primary: 'rhythmic_propulsive' },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'medium',
      tendencies: [
        { trait: 'speed', level: 'present' },
        { trait: 'dynamics', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'warmth', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.7, warmth: 0.4, tonal_density: 0.5,
      speed: 0.7, dynamics: 0.7, flow: 0.5,
      spatial_precision: 0.5, composure: 0.6, texture: 0.5,
      fatigue_risk: 0.3, openness: 0.3,
    },
    description: 'Studio-derived wireless headphone with punchy, dynamic sound. Slightly V-shaped tuning with good clarity and bass impact. Comfortable for portable use. Not the most refined for critical listening but energetic and engaging.',
    retailer_links: [],
    headphoneMeta: {
      formFactor: 'over-ear',
      wireless: true,
      anc: false,
      isolation: 'moderate',
      portableUse: true,
      useCases: ['commute', 'office', 'studio'],
    },
  },

  // ── Upper-mid tier ($350–$700) ──────────────────────

  {
    id: 'sennheiser-hd600',
    brand: 'Sennheiser',
    name: 'HD 600',
    price: 400,
    category: 'headphone',
    architecture: 'dynamic driver, open-back',
    subcategory: 'other',
    priceTier: 'mid-fi',
    brandScale: 'mainstream',
    region: 'europe',
    country: 'DE',
    archetypes: { primary: 'flow_organic', secondary: 'tonal_saturated' },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'tonal_density', level: 'present' },
        { trait: 'warmth', level: 'present' },
        { trait: 'spatial_precision', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.6, warmth: 0.7, tonal_density: 0.7,
      speed: 0.5, dynamics: 0.5, flow: 0.8,
      spatial_precision: 0.5, composure: 0.6, texture: 0.7,
      fatigue_risk: 0.0, openness: 0.7,
    },
    description: 'Reference headphone for natural tonal balance and musical flow. Midrange is beautifully rendered. Bass is controlled but not heavy. Treble is smooth and extended. Open-back — no isolation. Best for home listening with a dedicated amp.',
    retailer_links: [],
    headphoneMeta: {
      formFactor: 'over-ear',
      wireless: false,
      anc: false,
      isolation: 'low',
      portableUse: false,
      useCases: ['home', 'studio'],
    },
  },
  {
    id: 'sony-ier-m7',
    brand: 'Sony',
    name: 'IER-M7',
    price: 500,
    category: 'iem',
    architecture: '4 balanced armature drivers',
    subcategory: 'other',
    priceTier: 'upper-mid',
    brandScale: 'mainstream',
    region: 'japan',
    country: 'JP',
    archetypes: { primary: 'precision_explicit', secondary: 'spatial_holographic' },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'medium',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'spatial_precision', level: 'emphasized' },
        { trait: 'speed', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.8, warmth: 0.4, tonal_density: 0.6,
      speed: 0.7, dynamics: 0.6, flow: 0.6,
      spatial_precision: 0.8, composure: 0.8, texture: 0.7,
      fatigue_risk: 0.1, openness: 0.6,
    },
    description: 'Refined, detailed IEM from Sony\'s professional monitoring line. Excellent staging and imaging for an IEM. Tonal balance is neutral with good body. Isolation is strong. A serious portable option for listeners who prioritise clarity and spatial precision.',
    retailer_links: [],
    headphoneMeta: {
      formFactor: 'iem',
      wireless: false,
      anc: false,
      isolation: 'high',
      portableUse: true,
      useCases: ['commute', 'flight', 'studio'],
    },
  },
  {
    id: 'grado-rs2x',
    brand: 'Grado',
    name: 'RS2x',
    price: 550,
    category: 'headphone',
    architecture: 'dynamic driver with wood housing, open-back over-ear',
    subcategory: 'other',
    priceTier: 'mid-fi',
    brandScale: 'boutique',
    region: 'north-america',
    country: 'US',
    archetypes: { primary: 'rhythmic_propulsive', secondary: 'tonal_saturated' },
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'clarity', level: 'emphasized' },
        { trait: 'speed', level: 'emphasized' },
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'warmth', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'tonal_density', level: 'present' },
      ],
      riskFlags: [],
    },
    traits: {
      clarity: 0.8, warmth: 0.6, tonal_density: 0.7,
      speed: 0.8, dynamics: 0.8, flow: 0.65,
      spatial_precision: 0.65, composure: 0.7, texture: 0.8,
      fatigue_risk: 0.25, openness: 0.85,
    },
    description: 'Refined iteration of the Grado house sound with over-ear form factor and wood-damped enclosure. Retains the energetic, forward character of SR series but with improved warmth, spatial layering, and treble control. Exceptional texture and tonal grain. Natural fit for rock, jazz, and vocal-focused music. Open-back — no isolation.',
    retailer_links: [],
    headphoneMeta: {
      formFactor: 'over-ear',
      wireless: false,
      anc: false,
      isolation: 'low',
      portableUse: false,
      useCases: ['home', 'studio'],
    },
  },
];
