/**
 * Provisional Product Store.
 *
 * Holds product records derived from review synthesis or LLM inference.
 * These records use the same trait model as the validated catalog but
 * carry explicit provenance metadata.
 *
 * ── Adding provisional products ──────────────────────────────────
 *
 * 1. Gather evidence in the evidence store (lib/evidence/store.ts).
 * 2. When evidence reaches 'sufficient', run the synthesis pipeline.
 * 3. Add the synthesized record here with:
 *    - sourceType: 'review_synthesis'
 *    - validationStatus: 'provisional'
 *    - confidence based on evidence quality
 *    - agreementLevel from the evidence record
 *    - Full reference attribution
 *
 * ── Promoting products ───────────────────────────────────────────
 *
 * When an editor reviews and confirms a provisional record:
 *    - Update sourceType to 'review_validated'
 *    - Update validationStatus to 'validated'
 *    - Set lastReviewedAt to the review date
 *    - Optionally refine axis positions or tendencies
 *
 * Products promoted to review_validated stay in this store.
 * Only reference-tier products live in the validated catalog.
 */

import type { ProvisionalProduct } from './types';

// ── Provisional product records ──────────────────────
//
// Add synthesized product records below.
// Each record must include a complete provenance block.

export const PROVISIONAL_PRODUCTS: ProvisionalProduct[] = [
  // ── Kinki Studio EX-M1 ─────────────────────────────
  // Synthesized from evidence store. Chinese Class A/AB integrated
  // amplifier commonly asked about in Audio XX conversations.
  // Not in the validated catalog — demonstrates the review-synthesis path.
  {
    id: 'kinki-studio-ex-m1',
    brand: 'Kinki Studio',
    name: 'EX-M1',
    category: 'amplifier',
    price: 2500,
    priceCurrency: 'USD',
    architecture: 'Class A/AB solid-state integrated amplifier',
    priceTier: 'upper-mid',
    brandScale: 'boutique',
    region: 'east-asia',
    country: 'CN',

    primaryAxes: {
      warm_bright: 'neutral',          // Neutral to very slightly warm — not lean, not lush
      smooth_detailed: 'neutral',       // Smooth grain structure but good resolution — balanced
      elastic_controlled: 'controlled', // High current, authoritative grip, composed dynamics
      airy_closed: 'airy',             // Wide staging with good depth layering
    },

    traits: {
      flow: 0.7,
      tonal_density: 0.7,
      clarity: 0.7,
      dynamics: 1.0,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.7,
      composure: 1.0,
      warmth: 0.4,
      speed: 0.7,
      spatial_precision: 0.7,
      elasticity: 0.7,
    },

    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'medium',
      tendencies: [
        { trait: 'dynamics', level: 'emphasized' },
        { trait: 'composure', level: 'emphasized' },
        { trait: 'flow', level: 'present' },
        { trait: 'clarity', level: 'present' },
        { trait: 'texture', level: 'present' },
        { trait: 'speed', level: 'present' },
        { trait: 'spatial_precision', level: 'present' },
        { trait: 'warmth', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },

    fatigueAssessment: {
      risk: 'low',
      notes: 'Controlled treble with no glare. High power delivery stays composed — no strain even at high levels.',
    },

    tendencies: {
      confidence: 'medium',
      character: [
        { domain: 'dynamics', tendency: 'Authoritative dynamic grip with high current delivery — controls demanding speakers well beyond what the price suggests', basis: 'review_consensus' },
        { domain: 'tonality', tendency: 'Neutral to very slightly warm midrange. Not lush, not lean — sits in a balanced middle ground that accepts upstream character without imposing its own', basis: 'review_consensus' },
        { domain: 'spatial', tendency: 'Wide, well-separated soundstage with good depth layering. Spatial performance is a strength for the price class', basis: 'listener_consensus' },
        { domain: 'timing', tendency: 'Fast, composed transient response with good rhythmic articulation — not mechanical, but precise', basis: 'review_consensus' },
      ],
      interactions: [
        { condition: 'paired with resolving DACs (Chord, Denafrips)', effect: 'the neutral tonality passes through upstream character faithfully — lets the source shape the presentation', valence: 'positive', basis: 'listener_consensus' },
        { condition: 'paired with demanding low-impedance speakers', effect: 'high current delivery maintains control and composure where lesser amplifiers compress', valence: 'positive', basis: 'review_consensus' },
        { condition: 'paired with already-lean or bright upstream components', effect: 'the neutral balance does not add compensating warmth — may need a warmer source for tonal balance', valence: 'caution', basis: 'listener_consensus' },
      ],
      tradeoffs: [
        { gains: 'dynamic authority, current delivery, composure, and exceptional value', cost: 'the last degree of tonal warmth and midrange lushness', relative_to: 'Pass Labs, Luxman', basis: 'review_consensus' },
      ],
    },

    description: 'Chinese Class A/AB integrated amplifier with high current delivery and authoritative dynamic control. Frequently compared to amplifiers costing 2-3x more. Neutral, composed, and powerful — a strong value proposition for listeners who prioritise grip and spatial scale over tonal warmth.',

    sourceReferences: [
      { source: '6moons', note: 'Professional review praising dynamic authority and transient speed.' },
      { source: 'Audio Science Review', note: 'Community listening impressions confirming neutral tonality and staging.' },
      { source: 'Head-Fi', note: 'Integrated amplifier comparison thread noting value and low fatigue.' },
    ],

    provenance: {
      sourceType: 'review_synthesis',
      confidence: 'medium',
      validationStatus: 'provisional',
      evidenceCount: 3,
      agreementLevel: 'strong',
      references: [
        { label: '6moons review', url: 'https://www.6moons.com/' },
        { label: 'Audio Science Review community', url: 'https://www.audiosciencereview.com/' },
        { label: 'Head-Fi community', url: 'https://www.head-fi.org/' },
      ],
      synthesizedAt: '2026-03-16',
      rationale: 'Three independent sources agree on neutral-to-warm tonality, authoritative dynamic grip, and wide staging. Consensus on high value relative to price. Axis positions reflect consistent description of controlled dynamics, neutral tonality, and open spatial character. Confidence medium — Chinese boutique brand with less long-term reliability data than established manufacturers.',
    },
  },
];

// ── Lookup helpers ───────────────────────────────────

/**
 * Find a provisional product by ID.
 */
export function findProvisionalProduct(productId: string): ProvisionalProduct | undefined {
  return PROVISIONAL_PRODUCTS.find((p) => p.id === productId);
}

/**
 * Find a provisional product by name (case-insensitive).
 * Checks name, brand+name, and id.
 */
export function findProvisionalProductByName(name: string): ProvisionalProduct | undefined {
  const lower = name.toLowerCase().trim();
  return PROVISIONAL_PRODUCTS.find((p) => {
    const full = `${p.brand} ${p.name}`.toLowerCase();
    return (
      p.name.toLowerCase() === lower ||
      full === lower ||
      p.id === lower
    );
  });
}

/**
 * Get all provisional products with a given validation status.
 */
export function getProvisionalByStatus(
  status: 'validated' | 'provisional',
): ProvisionalProduct[] {
  return PROVISIONAL_PRODUCTS.filter((p) => p.provenance.validationStatus === status);
}

/**
 * Get all provisional products suitable for deterministic use.
 * Includes both review_synthesis and review_validated records.
 * Excludes llm_inference records (those are runtime-only).
 */
export function getUsableProvisionalProducts(): ProvisionalProduct[] {
  return PROVISIONAL_PRODUCTS.filter(
    (p) =>
      p.provenance.sourceType === 'review_synthesis' ||
      p.provenance.sourceType === 'review_validated',
  );
}
