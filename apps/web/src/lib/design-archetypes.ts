/**
 * Design archetype reasoning — class-level knowledge about audio
 * design topologies and their characteristic sonic tendencies.
 *
 * This sits in the explanation fallback chain between per-product
 * curated tendencies and raw trait-label inference:
 *
 *   1. Curated ProductTendencies (highest — editorial, per-product)
 *   2. Qualitative TendencyProfile (per-product, directional labels)
 *   3. Design Archetype (class-level — this file)
 *   4. Trait-label fallback (lowest — numeric inference)
 *
 * Each archetype represents a well-understood design philosophy with
 * documented sonic tendencies. The pattern table maps product
 * architecture strings to archetypes deterministically.
 *
 * Archetype knowledge is cautious and conservative:
 *   - designPrinciple is short (1 sentence)
 *   - confidence is explicit (high = research consensus, medium = editorial)
 *   - typicalTendencies are directional, not absolute
 */

import type { SourceBasis } from './sonic-tendencies';

// ── Archetype identifiers ────────────────────────────

export type DesignArchetypeId =
  // DAC topologies
  | 'r2r'
  | 'delta_sigma'
  | 'nos_tube'
  | 'fpga'
  | 'multibit'
  // Speaker topologies
  | 'sealed_box'
  | 'bass_reflex'
  | 'horn_loaded'
  | 'high_efficiency_wideband';

// ── Archetype confidence ─────────────────────────────

export type ArchetypeConfidence = 'high' | 'medium' | 'low';

// ── Archetype definition ─────────────────────────────

export interface TypicalTendency {
  trait: string;
  direction: 'emphasized' | 'less_emphasized';
}

export interface DesignArchetype {
  id: DesignArchetypeId;
  label: string;
  /** Short, cautious — one sentence maximum. */
  designPrinciple: string;
  /** How well-established the sonic tendencies are. */
  confidence: ArchetypeConfidence;
  /** Source basis for the archetype's tendency claims. */
  basis: SourceBasis;
  /** Characteristic sonic tendencies of this topology. */
  typicalTendencies: TypicalTendency[];
  /** Known trade-off — what this topology typically gives up. */
  typicalTradeoff: string;
  /** Common caution — what to watch for. */
  caution?: string;
}

// ── Archetype definitions ────────────────────────────

const ARCHETYPES: Record<DesignArchetypeId, DesignArchetype> = {
  // ── DAC topologies ─────────────────────────────────

  r2r: {
    id: 'r2r',
    label: 'R2R ladder',
    designPrinciple: 'Resistor-ladder conversion using matched resistor networks for direct voltage output.',
    confidence: 'high',
    basis: 'review_consensus',
    typicalTendencies: [
      { trait: 'tonal_density', direction: 'emphasized' },
      { trait: 'flow', direction: 'emphasized' },
      { trait: 'texture', direction: 'emphasized' },
      { trait: 'clarity', direction: 'less_emphasized' },
    ],
    typicalTradeoff: 'Tonal density and texture at the cost of measured precision and ultimate transparency.',
    caution: 'Implementation quality varies significantly — not all R2R designs sound the same.',
  },

  delta_sigma: {
    id: 'delta_sigma',
    label: 'Delta-sigma',
    designPrinciple: 'Oversampling modulation with noise shaping and digital filtering.',
    confidence: 'high',
    basis: 'review_consensus',
    typicalTendencies: [
      { trait: 'clarity', direction: 'emphasized' },
      { trait: 'speed', direction: 'emphasized' },
      { trait: 'spatial_precision', direction: 'emphasized' },
      { trait: 'tonal_density', direction: 'less_emphasized' },
    ],
    typicalTradeoff: 'Precision and transparency at the cost of tonal weight and harmonic richness.',
    caution: 'Filter and implementation choices vary widely — chip alone does not determine character.',
  },

  nos_tube: {
    id: 'nos_tube',
    label: 'NOS tube',
    designPrinciple: 'Non-oversampling conversion with tube output stage for harmonic texture.',
    confidence: 'high',
    basis: 'review_consensus',
    typicalTendencies: [
      { trait: 'flow', direction: 'emphasized' },
      { trait: 'warmth', direction: 'emphasized' },
      { trait: 'texture', direction: 'emphasized' },
      { trait: 'speed', direction: 'less_emphasized' },
      { trait: 'clarity', direction: 'less_emphasized' },
    ],
    typicalTradeoff: 'Musical flow and harmonic warmth at the cost of transient speed and measured detail.',
  },

  fpga: {
    id: 'fpga',
    label: 'FPGA',
    designPrinciple: 'Custom digital processing on programmable hardware with designer-defined filters.',
    confidence: 'medium',
    basis: 'editorial_inference',
    typicalTendencies: [
      { trait: 'dynamics', direction: 'emphasized' },
      { trait: 'speed', direction: 'emphasized' },
      { trait: 'texture', direction: 'emphasized' },
    ],
    typicalTradeoff: 'Transient precision and dynamic contrast at the cost of tonal smoothness.',
    caution: 'FPGA is a platform, not a topology — sonic character depends entirely on the designer\'s algorithms.',
  },

  multibit: {
    id: 'multibit',
    label: 'Multibit',
    designPrinciple: 'Multi-level conversion using discrete or integrated multibit DAC chips.',
    confidence: 'medium',
    basis: 'review_consensus',
    typicalTendencies: [
      { trait: 'dynamics', direction: 'emphasized' },
      { trait: 'tonal_density', direction: 'emphasized' },
      { trait: 'flow', direction: 'emphasized' },
    ],
    typicalTradeoff: 'Dynamic weight and tonal density at the cost of ultimate resolution.',
    caution: 'Overlaps significantly with R2R — the distinction is more about implementation family than topology.',
  },

  // ── Speaker topologies ─────────────────────────────

  sealed_box: {
    id: 'sealed_box',
    label: 'Sealed box',
    designPrinciple: 'Closed cabinet providing controlled, predictable bass rolloff with low group delay.',
    confidence: 'high',
    basis: 'review_consensus',
    typicalTendencies: [
      { trait: 'speed', direction: 'emphasized' },
      { trait: 'composure', direction: 'emphasized' },
      { trait: 'dynamics', direction: 'less_emphasized' },
    ],
    typicalTradeoff: 'Transient accuracy and bass control at the cost of bass extension and dynamic scale.',
  },

  bass_reflex: {
    id: 'bass_reflex',
    label: 'Bass reflex (ported)',
    designPrinciple: 'Tuned port extends low-frequency output by using cabinet resonance.',
    confidence: 'high',
    basis: 'review_consensus',
    typicalTendencies: [
      { trait: 'dynamics', direction: 'emphasized' },
      { trait: 'warmth', direction: 'emphasized' },
      { trait: 'speed', direction: 'less_emphasized' },
    ],
    typicalTradeoff: 'Bass extension and dynamic weight at the cost of transient precision below the port tuning.',
    caution: 'Port tuning and room interaction strongly affect perceived bass quality.',
  },

  horn_loaded: {
    id: 'horn_loaded',
    label: 'Horn-loaded',
    designPrinciple: 'Acoustic horn couples driver to room for high efficiency and controlled directivity.',
    confidence: 'high',
    basis: 'review_consensus',
    typicalTendencies: [
      { trait: 'dynamics', direction: 'emphasized' },
      { trait: 'speed', direction: 'emphasized' },
      { trait: 'texture', direction: 'emphasized' },
      { trait: 'spatial_precision', direction: 'less_emphasized' },
    ],
    typicalTradeoff: 'Dynamic immediacy and transient speed at the cost of even dispersion and spatial refinement.',
    caution: 'Horn coloration varies significantly with design — some sound natural, others sound coloured.',
  },

  high_efficiency_wideband: {
    id: 'high_efficiency_wideband',
    label: 'High-efficiency wideband',
    designPrinciple: 'Single or minimal crossover design maximising driver efficiency and coherence.',
    confidence: 'medium',
    basis: 'editorial_inference',
    typicalTendencies: [
      { trait: 'speed', direction: 'emphasized' },
      { trait: 'flow', direction: 'emphasized' },
      { trait: 'texture', direction: 'emphasized' },
      { trait: 'dynamics', direction: 'less_emphasized' },
    ],
    typicalTradeoff: 'Tonal coherence and transient clarity at the cost of bass extension and power handling.',
    caution: 'Bandwidth limitations require careful amplifier matching — low-power designs preferred.',
  },
};

// ── Architecture pattern table ───────────────────────
//
// Maps product architecture strings to archetype IDs.
// Each pattern is a lowercase substring match against product.architecture.
// Order matters: first match wins.

interface ArchitecturePattern {
  pattern: string;
  archetype: DesignArchetypeId;
}

const ARCHITECTURE_PATTERNS: ArchitecturePattern[] = [
  // DAC patterns — more specific first
  { pattern: 'nos tube', archetype: 'nos_tube' },
  { pattern: 'r-2r', archetype: 'r2r' },
  { pattern: 'r2r', archetype: 'r2r' },
  { pattern: 'multibit', archetype: 'multibit' },
  { pattern: 'fpga', archetype: 'fpga' },
  { pattern: 'delta-sigma', archetype: 'delta_sigma' },
  { pattern: 'delta sigma', archetype: 'delta_sigma' },

  // Speaker patterns — more specific first
  { pattern: 'horn-loaded', archetype: 'horn_loaded' },
  { pattern: 'horn loaded', archetype: 'horn_loaded' },
  { pattern: 'three-way horn', archetype: 'horn_loaded' },
  { pattern: 'sealed', archetype: 'sealed_box' },
  { pattern: 'bass-reflex', archetype: 'bass_reflex' },
  { pattern: 'bass reflex', archetype: 'bass_reflex' },
  { pattern: 'ported', archetype: 'bass_reflex' },
  { pattern: 'high-efficiency', archetype: 'high_efficiency_wideband' },
  { pattern: 'high efficiency', archetype: 'high_efficiency_wideband' },
  { pattern: 'full-range driver', archetype: 'high_efficiency_wideband' },
  { pattern: 'single-driver', archetype: 'high_efficiency_wideband' },
  { pattern: 'single driver', archetype: 'high_efficiency_wideband' },
  { pattern: 'wide-baffle', archetype: 'high_efficiency_wideband' },
  { pattern: 'passive radiator', archetype: 'sealed_box' },
];

// ── Public API ───────────────────────────────────────

/**
 * Resolve the design archetype for a product based on its architecture
 * string. Returns undefined if no pattern matches.
 */
export function resolveArchetype(architecture: string): DesignArchetype | undefined {
  const lower = architecture.toLowerCase();
  for (const entry of ARCHITECTURE_PATTERNS) {
    if (lower.includes(entry.pattern)) {
      return ARCHETYPES[entry.archetype];
    }
  }
  return undefined;
}

/**
 * Get a design archetype by ID.
 */
export function getArchetypeById(id: DesignArchetypeId): DesignArchetype {
  return ARCHETYPES[id];
}

/**
 * Build an explanation-ready character sentence from archetype knowledge.
 * Returns undefined if archetype confidence is low.
 *
 * Uses confidence-aware language:
 *   high:   "R2R designs typically emphasize ..."
 *   medium: "This type of design tends to lean toward ..."
 */
export function archetypeCharacter(archetype: DesignArchetype): string | undefined {
  if (archetype.confidence === 'low') return undefined;

  const emphasized = archetype.typicalTendencies
    .filter((t) => t.direction === 'emphasized')
    .map((t) => t.trait.replace(/_/g, ' '));

  if (emphasized.length === 0) return undefined;

  const traitList = emphasized.slice(0, 3).join(' and ');

  if (archetype.confidence === 'high') {
    return `${archetype.label} designs typically emphasize ${traitList}. ${archetype.typicalTradeoff}`;
  }

  return `This type of design tends to lean toward ${traitList}. ${archetype.typicalTradeoff}`;
}

/**
 * Build a short fit note from archetype knowledge for shopping contexts.
 * Returns undefined if archetype confidence is low.
 */
export function archetypeFitNote(archetype: DesignArchetype): string | undefined {
  if (archetype.confidence === 'low') return undefined;

  const emphasized = archetype.typicalTendencies
    .filter((t) => t.direction === 'emphasized')
    .map((t) => t.trait.replace(/_/g, ' '));

  if (emphasized.length === 0) return undefined;

  const verb = archetype.confidence === 'high' ? 'typically emphasizes' : 'tends toward';
  return `${archetype.label} — ${verb} ${emphasized.slice(0, 2).join(' and ')}`;
}

/**
 * Build a trade-off sentence from archetype knowledge for inquiry direction.
 * Returns undefined if archetype confidence is low.
 */
export function archetypeTradeoff(archetype: DesignArchetype): string | undefined {
  if (archetype.confidence === 'low') return undefined;

  if (archetype.confidence === 'high') {
    return `The trade-off is well-understood: ${archetype.typicalTradeoff}`;
  }
  return `The likely trade-off: ${archetype.typicalTradeoff}`;
}

/**
 * Get archetype caution text if one exists and confidence is sufficient.
 */
export function archetypeCaution(archetype: DesignArchetype): string | undefined {
  if (archetype.confidence === 'low') return undefined;
  return archetype.caution;
}
