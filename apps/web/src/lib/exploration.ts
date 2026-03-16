/**
 * Exploration Mode — "What else is like X?"
 *
 * Maps the philosophical neighborhood of a reference product or brand.
 * Groups results by *why* they are similar (shared design philosophy,
 * archetype affinity, tonal family) rather than by product category.
 *
 * This is distinct from:
 *   - Shopping (budget-constrained, category-scoped)
 *   - Comparison (two specific items, side-by-side)
 *   - Gear inquiry (single product deep-dive)
 *
 * Exploration answers: "If I like X, what else lives in that world?"
 */

import type { Product } from './products/dacs';
import { DAC_PRODUCTS } from './products/dacs';
import { SPEAKER_PRODUCTS } from './products/speakers';
import { AMPLIFIER_PRODUCTS } from './products/amplifiers';
import { TURNTABLE_PRODUCTS } from './products/turntables';
import { tagProductArchetype } from './archetype';
import type { SonicArchetype } from './archetype';
import type { SubjectMatch } from './intent';
import type { ActiveSystemContext } from './system-types';

// ── All products ─────────────────────────────────────

const ALL_PRODUCTS: Product[] = [...DAC_PRODUCTS, ...SPEAKER_PRODUCTS, ...AMPLIFIER_PRODUCTS, ...TURNTABLE_PRODUCTS];

// ── Types ────────────────────────────────────────────

export interface ExplorationNeighbor {
  product: Product;
  /** Why this product belongs in the neighborhood. */
  reason: string;
  /** What it shares with the reference. */
  sharedTraits: string[];
  /** Where it diverges from the reference. */
  divergence: string;
  /** Similarity score (0–1, used for sorting, never displayed). */
  similarity: number;
}

export interface PhilosophicalGroup {
  /** Group label — the shared philosophical thread. */
  label: string;
  /** Short description of what unites this group. */
  description: string;
  /** Products in this group, sorted by similarity. */
  neighbors: ExplorationNeighbor[];
}

export interface ExplorationResponse {
  /** The reference product or brand being explored. */
  reference: {
    name: string;
    brand: string;
    architecture: string;
    /** Core character summary. */
    character: string;
  };
  /** Philosophical groups, ordered by relevance. */
  groups: PhilosophicalGroup[];
  /** What the system would steer away from. */
  antiPatterns: string[];
  /** System context note (if active system exists). */
  systemNote?: string;
  /** Follow-up prompt. */
  followUp: string;
}

// ── Axis distance ────────────────────────────────────

type AxisKey = 'warm_bright' | 'smooth_detailed' | 'elastic_controlled' | 'airy_closed';

const AXIS_KEYS: AxisKey[] = ['warm_bright', 'smooth_detailed', 'elastic_controlled', 'airy_closed'];

const AXIS_VALUES: Record<string, number> = {
  warm: -1, bright: 1, neutral: 0,
  smooth: -1, detailed: 1,
  elastic: -1, controlled: 1,
  airy: -1, closed: 1,
};

function axisToNumeric(value: string | undefined): number {
  if (!value) return 0;
  return AXIS_VALUES[value.toLowerCase()] ?? 0;
}

function axisDistance(a: Product, b: Product): number {
  if (!a.primaryAxes || !b.primaryAxes) return 1; // max distance when no data
  let sumSq = 0;
  for (const key of AXIS_KEYS) {
    const va = axisToNumeric(a.primaryAxes[key]);
    const vb = axisToNumeric(b.primaryAxes[key]);
    sumSq += (va - vb) ** 2;
  }
  // Normalize: max possible distance is sqrt(4 * 4) = 4 (all axes differ by 2)
  return Math.sqrt(sumSq) / 4;
}

// ── Trait similarity ─────────────────────────────────

function traitSimilarity(a: Product, b: Product): number {
  const keysA = Object.keys(a.traits);
  const keysB = Object.keys(b.traits);
  const allKeys = new Set([...keysA, ...keysB]);
  if (allKeys.size === 0) return 0;

  let sumSq = 0;
  for (const key of allKeys) {
    const va = a.traits[key] ?? 0;
    const vb = b.traits[key] ?? 0;
    sumSq += (va - vb) ** 2;
  }
  // Normalize to 0–1 (0 = identical, 1 = maximally different)
  return 1 - Math.sqrt(sumSq / allKeys.size);
}

// ── Archetype affinity ───────────────────────────────

function archetypeAffinity(a: Product, b: Product): number {
  const tagsA = tagProductArchetype(a);
  const tagsB = tagProductArchetype(b);

  let score = 0;
  if (tagsA.primary === tagsB.primary) score += 0.6;
  else if (tagsA.primary === tagsB.secondary || tagsA.secondary === tagsB.primary) score += 0.3;

  if (tagsA.secondary && tagsA.secondary === tagsB.secondary) score += 0.2;
  if (tagsA.primary === tagsB.secondary && tagsA.secondary === tagsB.primary) score += 0.15;

  return Math.min(score, 1);
}

// ── Topology affinity ────────────────────────────────

const TOPOLOGY_FAMILIES: Record<string, string[]> = {
  fpga: ['fpga', 'fpga-custom'],
  r2r: ['r2r', 'discrete-r2r', 'r2r-ladder', 'nos-r2r', 'nos'],
  'delta-sigma': ['delta-sigma', 'ds', 'ess', 'akm', 'pcm'],
  tube: ['tube', 'set', 'push-pull', 'el84', 'el34', '300b', '2a3', 'otl'],
  'solid-state': ['solid-state', 'class-a', 'class-ab', 'mosfet', 'jfet', 'bipolar'],
  hybrid: ['hybrid'],
  'horn-loaded': ['horn-loaded', 'horn'],
  'open-baffle': ['open-baffle'],
  'sealed-box': ['sealed', 'acoustic-suspension'],
  'bass-reflex': ['ported', 'bass-reflex'],
  planar: ['planar', 'planar-magnetic', 'ribbon'],
  electrostatic: ['electrostatic', 'estat'],
};

function topologyFamily(topology: string | undefined): string | null {
  if (!topology) return null;
  const t = topology.toLowerCase();
  for (const [family, members] of Object.entries(TOPOLOGY_FAMILIES)) {
    if (members.some((m) => t.includes(m))) return family;
  }
  return null;
}

function topologyAffinity(a: Product, b: Product): number {
  const famA = topologyFamily(a.topology);
  const famB = topologyFamily(b.topology);
  if (!famA || !famB) return 0;
  return famA === famB ? 1 : 0;
}

// ── Combined similarity ──────────────────────────────

function computeSimilarity(ref: Product, candidate: Product): number {
  const archetype = archetypeAffinity(ref, candidate);
  const traits = traitSimilarity(ref, candidate);
  const axes = 1 - axisDistance(ref, candidate);
  const topo = topologyAffinity(ref, candidate);

  // Weighted combination — archetype and traits matter most,
  // topology adds a bonus for same-family designs
  return archetype * 0.35 + traits * 0.30 + axes * 0.20 + topo * 0.15;
}

// ── Character description ────────────────────────────

function describeCharacter(product: Product): string {
  if (product.tendencies?.character && product.tendencies.character.length > 0) {
    // Use first two character tendencies, just the key phrase
    return product.tendencies.character
      .slice(0, 2)
      .map((c) => {
        const dash = c.tendency.indexOf('—');
        return dash > 0 ? c.tendency.slice(0, dash).trim() : c.tendency;
      })
      .join('; ')
      .toLowerCase();
  }
  // Fallback to description first sentence
  return product.description.split('.')[0].toLowerCase();
}

function describeSharedTraits(ref: Product, neighbor: Product): string[] {
  const shared: string[] = [];
  const tagsRef = tagProductArchetype(ref);
  const tagsN = tagProductArchetype(neighbor);

  if (tagsRef.primary === tagsN.primary) {
    shared.push(`shares ${formatArchetype(tagsRef.primary)} character`);
  }

  // Check axis alignment
  if (ref.primaryAxes && neighbor.primaryAxes) {
    for (const key of AXIS_KEYS) {
      const vr = ref.primaryAxes[key];
      const vn = neighbor.primaryAxes[key];
      if (vr && vn && vr === vn && vr !== 'neutral') {
        shared.push(`both lean ${vr} on the ${formatAxisLabel(key)} axis`);
      }
    }
  }

  // Topology family
  if (topologyAffinity(ref, neighbor) > 0) {
    shared.push(`same design topology (${neighbor.topology ?? neighbor.architecture})`);
  }

  if (shared.length === 0) {
    shared.push('similar overall sonic character');
  }

  return shared.slice(0, 3);
}

function describeDivergence(ref: Product, neighbor: Product): string {
  // Find the axis with the biggest difference
  if (ref.primaryAxes && neighbor.primaryAxes) {
    let maxDiff = 0;
    let maxAxis = '';
    let maxDir = '';
    for (const key of AXIS_KEYS) {
      const vr = axisToNumeric(ref.primaryAxes[key]);
      const vn = axisToNumeric(neighbor.primaryAxes[key]);
      const diff = Math.abs(vr - vn);
      if (diff > maxDiff) {
        maxDiff = diff;
        maxAxis = key;
        maxDir = vn > vr ? 'more ' + key.split('_')[1] : 'more ' + key.split('_')[0];
      }
    }
    if (maxDiff > 0 && maxAxis) {
      return `${maxDir} than ${ref.brand} ${ref.name}`;
    }
  }

  // Fallback: different topology
  if (ref.topology !== neighbor.topology) {
    return `different architecture (${neighbor.architecture})`;
  }

  return 'subtle voicing differences';
}

// ── Formatting helpers ───────────────────────────────

function formatArchetype(a: SonicArchetype): string {
  const labels: Record<SonicArchetype, string> = {
    flow_organic: 'flow-oriented',
    precision_explicit: 'precision-focused',
    rhythmic_propulsive: 'rhythmically driven',
    tonal_saturated: 'tonally rich',
    spatial_holographic: 'spatially immersive',
  };
  return labels[a] ?? a;
}

function formatAxisLabel(key: string): string {
  const labels: Record<string, string> = {
    warm_bright: 'tonal balance',
    smooth_detailed: 'resolution',
    elastic_controlled: 'transient',
    airy_closed: 'spatial',
  };
  return labels[key] ?? key;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Group labeling ───────────────────────────────────

const ARCHETYPE_GROUP_LABELS: Record<SonicArchetype, { label: string; description: string }> = {
  flow_organic: {
    label: 'Flow and Musicality',
    description: 'Designs that prioritize ease, sweetness, natural tone, and musical continuity over analytical precision.',
  },
  precision_explicit: {
    label: 'Precision and Clarity',
    description: 'Designs that prioritize detail retrieval, transient accuracy, and spatial definition.',
  },
  rhythmic_propulsive: {
    label: 'Rhythm and Drive',
    description: 'Designs that prioritize pace, dynamic snap, energy, and musical propulsion.',
  },
  tonal_saturated: {
    label: 'Tonal Richness',
    description: 'Designs that prioritize harmonic density, midrange body, and saturated timbre.',
  },
  spatial_holographic: {
    label: 'Spatial Immersion',
    description: 'Designs that prioritize depth, layering, dimensionality, and image specificity.',
  },
};

// ── Anti-patterns ────────────────────────────────────

function buildAntiPatterns(ref: Product): string[] {
  const anti: string[] = [];
  const tags = tagProductArchetype(ref);

  if (tags.primary === 'flow_organic' || tags.primary === 'tonal_saturated') {
    anti.push('High-feedback, ultra-damped designs that prioritize silence and measurements over temporal flow');
    anti.push('Clinical or sterile presentations — precision without musical engagement');
  }
  if (tags.primary === 'precision_explicit') {
    anti.push('Warm, slow, or overly forgiving designs that obscure transient detail');
    anti.push('Heavily colored presentations where tone dominates timing');
  }
  if (tags.primary === 'rhythmic_propulsive') {
    anti.push('Overdamped, polite designs that compress dynamic contrast');
    anti.push('Slow or ponderous presentations that lack energy');
  }
  if (tags.primary === 'spatial_holographic') {
    anti.push('Closed-in, forward presentations with compressed staging');
    anti.push('Designs that sacrifice image specificity for warmth or body');
  }

  return anti.slice(0, 2);
}

// ── Main entry point ─────────────────────────────────

/**
 * Find the reference product from a subject match.
 */
export function findReferenceProduct(subjectMatches: SubjectMatch[], queryText: string): Product | null {
  const q = queryText.toLowerCase();

  // Try product-level match first
  for (const m of subjectMatches) {
    if (m.kind === 'product') {
      const found = ALL_PRODUCTS.find((p) =>
        p.name.toLowerCase().includes(m.name.toLowerCase())
        || m.name.toLowerCase().includes(p.name.toLowerCase()),
      );
      if (found) return found;
    }
  }

  // Try brand match — pick the product whose name appears in the query
  for (const m of subjectMatches) {
    if (m.kind === 'brand') {
      const brandProducts = ALL_PRODUCTS.filter(
        (p) => p.brand.toLowerCase() === m.name.toLowerCase(),
      );
      if (brandProducts.length === 1) return brandProducts[0];
      // Multiple products — try to find one mentioned by name
      const specific = brandProducts.find((p) => {
        const words = p.name.toLowerCase().split(/\s+/);
        return words.some((w) => w.length >= 3 && q.includes(w));
      });
      if (specific) return specific;
      // Default to first (most representative)
      if (brandProducts.length > 0) return brandProducts[0];
    }
  }

  return null;
}

/**
 * Build a philosophical neighborhood map for a reference product.
 *
 * Groups similar products by *why* they're similar, not by category.
 * Cross-category results are expected and encouraged — an amplifier
 * can share philosophical DNA with a DAC.
 */
export function buildExplorationResponse(
  reference: Product,
  activeSystem?: ActiveSystemContext | null,
  queryText?: string,
): ExplorationResponse {
  // Score all products against the reference
  const candidates = ALL_PRODUCTS
    .filter((p) => p.id !== reference.id)
    .map((p) => ({
      product: p,
      similarity: computeSimilarity(reference, p),
      archetype: tagProductArchetype(p),
    }))
    .filter((c) => c.similarity >= 0.35) // minimum threshold
    .sort((a, b) => b.similarity - a.similarity);

  // Group by primary archetype
  const refTags = tagProductArchetype(reference);
  const groups = new Map<SonicArchetype, ExplorationNeighbor[]>();

  for (const c of candidates.slice(0, 20)) { // cap at 20 neighbors
    const groupKey = c.archetype.primary;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey)!.push({
      product: c.product,
      reason: buildNeighborReason(reference, c.product, c.archetype.primary),
      sharedTraits: describeSharedTraits(reference, c.product),
      divergence: describeDivergence(reference, c.product),
      similarity: c.similarity,
    });
  }

  // Build ordered group list — reference's own archetype first,
  // then secondary, then remaining
  const orderedGroups: PhilosophicalGroup[] = [];
  const seen = new Set<SonicArchetype>();

  const addGroup = (key: SonicArchetype) => {
    if (seen.has(key) || !groups.has(key)) return;
    seen.add(key);
    const meta = ARCHETYPE_GROUP_LABELS[key];
    const neighbors = groups.get(key)!;
    // Within same-category, separate from cross-category
    const sameCategory = neighbors.filter((n) => n.product.category === reference.category);
    const crossCategory = neighbors.filter((n) => n.product.category !== reference.category);

    // Label the group relative to the reference
    const isRefGroup = key === refTags.primary;
    const label = isRefGroup
      ? `Closest Relatives (${meta.label})`
      : meta.label;
    const description = isRefGroup
      ? `Products that share the ${reference.brand} ${reference.name}'s core design philosophy: ${meta.description.toLowerCase()}`
      : meta.description;

    orderedGroups.push({
      label,
      description,
      neighbors: [...sameCategory, ...crossCategory].slice(0, 5), // cap per group
    });
  };

  // Order: reference primary → reference secondary → remaining
  addGroup(refTags.primary);
  if (refTags.secondary) addGroup(refTags.secondary);
  for (const key of groups.keys()) addGroup(key);

  // System context
  let systemNote: string | undefined;
  if (activeSystem?.components && activeSystem.components.length > 0) {
    const componentNames = activeSystem.components
      .map((c) => `${c.brand} ${c.name}`)
      .join(', ');
    systemNote = `Your current system (${componentNames}) provides context for evaluating these alternatives. How each interacts with the rest of your chain matters more than how they compare in isolation.`;
  }

  return {
    reference: {
      name: reference.name,
      brand: reference.brand,
      architecture: reference.architecture,
      character: describeCharacter(reference),
    },
    groups: orderedGroups,
    antiPatterns: buildAntiPatterns(reference),
    systemNote,
    followUp: `Would you like me to compare any of these more closely with your ${reference.brand} ${reference.name}, or evaluate one in the context of your system?`,
  };
}

// ── Neighbor reason builder ──────────────────────────

function buildNeighborReason(ref: Product, neighbor: Product, neighborArchetype: SonicArchetype): string {
  const refTags = tagProductArchetype(ref);
  const sameCategory = ref.category === neighbor.category;
  const sameTopo = topologyAffinity(ref, neighbor) > 0;

  if (refTags.primary === neighborArchetype && sameCategory && sameTopo) {
    return `Same design family — ${neighbor.architecture} ${neighbor.category} with similar sonic priorities`;
  }
  if (refTags.primary === neighborArchetype && sameCategory) {
    return `Different architecture (${neighbor.architecture}) but similar sonic result`;
  }
  if (refTags.primary === neighborArchetype && !sameCategory) {
    return `Cross-category philosophical match — a ${neighbor.category} that shares the same sonic values`;
  }

  return `Shares ${formatArchetype(neighborArchetype)} tendencies`;
}

// ── Exploration response → ConsultationResponse adapter ──

import type { ConsultationResponse } from './consultation';

/**
 * Convert an ExplorationResponse to a ConsultationResponse for rendering
 * through the existing advisory pipeline.
 */
export function explorationToConsultation(exploration: ExplorationResponse): ConsultationResponse {
  const ref = exploration.reference;

  // Build philosophy section — reference character
  const philosophy = `**${ref.brand} ${ref.name}** is a ${ref.architecture} design. Its core character: ${ref.character}.\n\nBelow is a map of products that share philosophical DNA — grouped by *why* they're similar, not just what category they're in.`;

  // Build tendencies section — the neighborhood groups
  const groupTexts = exploration.groups.map((group) => {
    const header = `**${group.label}**\n${group.description}`;
    const items = group.neighbors.map((n) => {
      const p = n.product;
      const price = p.price ? ` (~$${p.price.toLocaleString()})` : '';
      return `• **${p.brand} ${p.name}**${price} — ${n.reason}. ${n.divergence}.`;
    });
    return `${header}\n${items.join('\n')}`;
  });

  // Anti-patterns
  const antiText = exploration.antiPatterns.length > 0
    ? `**What I would not steer you toward:**\n${exploration.antiPatterns.map((a) => `• ${a}`).join('\n')}`
    : '';

  const tendencies = [...groupTexts, antiText].filter(Boolean).join('\n\n');

  return {
    subject: `What else is like ${ref.brand} ${ref.name}?`,
    comparisonSummary: `A philosophical neighborhood map for the ${ref.brand} ${ref.name} — products that share its design values across categories and price points.`,
    philosophy,
    tendencies,
    systemContext: exploration.systemNote,
    followUp: exploration.followUp,
  };
}
