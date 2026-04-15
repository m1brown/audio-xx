/**
 * Inference Layer tests — Design → Behavior → Perception chain.
 *
 * Covers:
 *   1. Three worked examples: known R2R DAC, unknown DAC, SET amplifier
 *   2. extractDesignSignals() — signal extraction from Product data
 *   3. inferBehaviorFromDesign() — 4-level fallback chain
 *   4. mapBehaviorToPerception() — behavioral → perceptual axes (8 dims)
 *   5. runInference() — full chain + provenance-based confidence
 *   6. Fallback chain priority: curated > numeric > archetype > amp_topology
 *   7. Risk flags, tradeoff summary, InferenceSource
 *   8. Edge cases — missing data, no topology, curated data detection
 */

import {
  extractDesignSignals,
  inferBehaviorFromDesign,
  mapBehaviorToPerception,
  runInference,
  type DesignSignals,
  type BehavioralTendencies,
  type InferenceResult,
} from '../inference-layer';
import type { Product } from '../products/dacs';

// ── Helpers ────────────────────────────────────────────

/** Minimal Product factory — only fields the inference layer reads. */
function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'test-product',
    brand: 'Test',
    name: 'Test Product',
    price: 1000,
    category: 'dac',
    architecture: '',
    traits: {},
    description: 'Test product',
    retailer_links: [],
    ...overrides,
  };
}

/** Helper to find a behavioral tendency by dimension. */
function findDim(behavior: BehavioralTendencies, dim: string) {
  return behavior.tendencies.find((t) => t.dimension === dim);
}

// ══════════════════════════════════════════════════════════
// Worked Example A: Known R2R DAC with curated profile
// ══════════════════════════════════════════════════════════

describe('Worked Example A: Known R2R DAC', () => {
  const product = makeProduct({
    id: 'denafrips-ares-ii',
    brand: 'Denafrips',
    name: 'Ares II',
    category: 'dac',
    architecture: 'R2R resistor ladder, balanced',
    topology: 'r2r',
    tendencyProfile: {
      basis: 'review_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'flow', level: 'emphasized' },
        { trait: 'texture', level: 'present' },
      ],
      riskFlags: [],
    },
  });

  it('extracts correct design signals', () => {
    const signals = extractDesignSignals(product);
    expect(signals.topology).toBe('r2r');
    expect(signals.category).toBe('dac');
    expect(signals.archetype).not.toBeNull();
    expect(signals.archetype!.id).toBe('r2r');
  });

  it('uses curated profile as primary source (not archetype)', () => {
    const result = runInference(product);
    expect(result.source).toBe('curated_profile');
    // Curated has tonal_density, flow, texture — all should come through
    expect(findDim(result.behavior!, 'tonal_density')?.level).toBe('emphasized');
    expect(findDim(result.behavior!, 'flow')?.level).toBe('emphasized');
    // 'present' maps to 'moderate' in behavioral terms
    expect(findDim(result.behavior!, 'texture')?.level).toBe('moderate');
  });

  it('maps behavior to warm + smooth perception', () => {
    const result = runInference(product);
    expect(result.perception!.axes.warm_bright).toBe('warm');
    expect(result.perception!.axes.smooth_detailed).toBe('smooth');
    expect(result.perception!.inferredAxes).toContain('warm_bright');
    expect(result.perception!.inferredAxes).toContain('smooth_detailed');
  });

  it('full chain: high confidence from curated source', () => {
    const result = runInference(product);
    expect(result.confidence).toBe('high');
    expect(result.source).toBe('curated_profile');
    expect(result.hasCuratedData).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
// Worked Example B: Unknown DAC (no topology, no data)
// ══════════════════════════════════════════════════════════

describe('Worked Example B: Unknown DAC (no topology, no architecture)', () => {
  const product = makeProduct({
    id: 'mystery-dac',
    brand: 'Unknown',
    name: 'Mystery DAC',
    category: 'dac',
    architecture: '',
  });

  it('extracts minimal design signals', () => {
    const signals = extractDesignSignals(product);
    expect(signals.topology).toBeNull();
    expect(signals.archetype).toBeNull();
    expect(signals.category).toBe('dac');
  });

  it('full chain: confidence none, source none, no crash', () => {
    const result = runInference(product);
    expect(result.confidence).toBe('none');
    expect(result.source).toBe('none');
    expect(result.behavior).toBeNull();
    expect(result.perception).toBeNull();
    expect(result.hasCuratedData).toBe(false);
    expect(result.tradeoffSummary).toBeNull();
    expect(result.riskFlags).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════
// Worked Example C: SET Amplifier with curated profile
// ══════════════════════════════════════════════════════════

describe('Worked Example C: SET Amplifier', () => {
  const product = makeProduct({
    id: 'decware-se84ufo',
    brand: 'Decware',
    name: 'SE84UFO',
    category: 'amplifier',
    architecture: 'Single-ended triode, SV83 output tubes',
    topology: 'set',
    power_watts: 2,
    tendencyProfile: {
      basis: 'listener_consensus',
      confidence: 'high',
      tendencies: [
        { trait: 'flow', level: 'emphasized' },
        { trait: 'tonal_density', level: 'emphasized' },
        { trait: 'texture', level: 'emphasized' },
        { trait: 'composure', level: 'less_emphasized' },
        { trait: 'speed', level: 'less_emphasized' },
      ],
      riskFlags: [],
    },
  });

  it('uses curated profile (not amp topology table) because curated wins', () => {
    const result = runInference(product);
    expect(result.source).toBe('curated_profile');
    expect(result.confidence).toBe('high');
    // Curated profile includes composure — verify it comes through
    expect(findDim(result.behavior!, 'composure')?.level).toBe('less_emphasized');
  });

  it('maps to warm + smooth + no specific airy_closed', () => {
    const result = runInference(product);
    expect(result.perception!.axes.warm_bright).toBe('warm');
    expect(result.perception!.axes.smooth_detailed).toBe('smooth');
    expect(result.perception!.axes.airy_closed).toBe('neutral');
  });

  it('reports hasCuratedData true and has tradeoff from topology', () => {
    const result = runInference(product);
    expect(result.hasCuratedData).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
// Fallback chain priority
// ══════════════════════════════════════════════════════════

describe('Fallback chain priority', () => {
  it('Level 1 curated wins over Level 2 numeric traits', () => {
    const product = makeProduct({
      architecture: 'R2R',
      topology: 'r2r',
      traits: { clarity: 1.0, speed: 1.0 }, // would yield emphasized clarity
      tendencyProfile: {
        basis: 'review_consensus',
        confidence: 'high',
        tendencies: [{ trait: 'flow', level: 'emphasized' }],
        riskFlags: [],
      },
    });
    const result = runInference(product);
    expect(result.source).toBe('curated_profile');
    // Should have flow from curated, NOT clarity from numeric
    expect(findDim(result.behavior!, 'flow')?.level).toBe('emphasized');
    expect(findDim(result.behavior!, 'clarity')).toBeUndefined();
  });

  it('Level 2 numeric wins over Level 3 archetype when no curated', () => {
    const product = makeProduct({
      architecture: 'R2R resistor ladder',
      topology: 'r2r',
      traits: {
        flow: 0.9,
        tonal_density: 0.8,
        clarity: 0.3,
        composure: 0.7,
        texture: 0.5,
      },
    });
    const result = runInference(product);
    expect(result.source).toBe('numeric_traits');
    expect(result.confidence).toBe('high');
    // Numeric traits give composure emphasized (0.7 ≥ 0.7)
    expect(findDim(result.behavior!, 'composure')?.level).toBe('emphasized');
    // texture 0.5 → moderate
    expect(findDim(result.behavior!, 'texture')?.level).toBe('moderate');
  });

  it('Level 3 archetype wins when no curated or numeric', () => {
    const product = makeProduct({
      architecture: 'R2R resistor ladder',
      topology: 'r2r',
      traits: {}, // empty traits
    });
    const result = runInference(product);
    expect(result.source).toBe('design_archetype');
    expect(result.confidence).toBe('medium');
  });

  it('Level 4 amp topology wins when no curated, numeric, or archetype', () => {
    const product = makeProduct({
      category: 'amplifier',
      architecture: 'custom amplifier', // doesn't match any archetype pattern
      topology: 'class-ab-solid-state',
      traits: {},
    });
    const result = runInference(product);
    expect(result.source).toBe('amp_topology');
    expect(result.confidence).toBe('medium');
  });

  it('low-confidence curated does NOT win (skipped)', () => {
    const product = makeProduct({
      architecture: 'R2R',
      topology: 'r2r',
      tendencyProfile: {
        basis: 'editorial_inference',
        confidence: 'low',
        tendencies: [{ trait: 'flow', level: 'emphasized' }],
        riskFlags: [],
      },
      traits: { tonal_density: 0.9 },
    });
    const result = runInference(product);
    // Low-confidence curated is skipped → falls to numeric traits
    expect(result.source).toBe('numeric_traits');
  });
});

// ══════════════════════════════════════════════════════════
// Risk flags
// ══════════════════════════════════════════════════════════

describe('Risk flags', () => {
  it('surfaces risk flags from curated profile', () => {
    const product = makeProduct({
      architecture: 'Delta-sigma',
      topology: 'delta-sigma',
      tendencyProfile: {
        basis: 'review_consensus',
        confidence: 'high',
        tendencies: [{ trait: 'clarity', level: 'emphasized' }],
        riskFlags: ['fatigue_risk', 'glare_risk'],
      },
    });
    const result = runInference(product);
    expect(result.riskFlags).toContain('fatigue_risk');
    expect(result.riskFlags).toContain('glare_risk');
  });

  it('surfaces risk flags from numeric traits', () => {
    const product = makeProduct({
      architecture: 'Delta-sigma',
      topology: 'delta-sigma',
      // Must include at least one behavioral dim so numeric level wins
      traits: { clarity: 0.8, fatigue_risk: 0.6, glare_risk: 0.5 },
    });
    const result = runInference(product);
    expect(result.source).toBe('numeric_traits');
    expect(result.riskFlags).toContain('fatigue_risk');
    expect(result.riskFlags).toContain('glare_risk');
  });

  it('surfaces risk flags from amp topology', () => {
    const product = makeProduct({
      category: 'amplifier',
      architecture: 'Class-D switching',
      topology: 'class-d',
      traits: {},
    });
    const result = runInference(product);
    expect(result.riskFlags).toContain('fatigue_risk');
  });

  it('no risk flags when none present', () => {
    const product = makeProduct({
      architecture: 'R2R',
      topology: 'r2r',
      traits: {},
    });
    const result = runInference(product);
    expect(result.riskFlags).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════
// Tradeoff summary
// ══════════════════════════════════════════════════════════

describe('Tradeoff summary', () => {
  it('surfaces archetype tradeoff', () => {
    const product = makeProduct({
      architecture: 'R2R resistor ladder',
      topology: 'r2r',
      traits: {},
    });
    const result = runInference(product);
    expect(result.tradeoffSummary).not.toBeNull();
    expect(result.tradeoffSummary).toContain('density');
  });

  it('surfaces amp topology tradeoff', () => {
    const product = makeProduct({
      category: 'amplifier',
      architecture: 'custom',
      topology: 'set',
      traits: {},
    });
    const result = runInference(product);
    expect(result.tradeoffSummary).not.toBeNull();
    expect(result.tradeoffSummary).toContain('purity');
  });

  it('surfaces curated tradeoff from product tendencies', () => {
    const product = makeProduct({
      architecture: 'R2R',
      topology: 'r2r',
      tendencyProfile: {
        basis: 'review_consensus',
        confidence: 'high',
        tendencies: [{ trait: 'flow', level: 'emphasized' }],
        riskFlags: [],
      },
      tendencies: {
        confidence: 'high',
        character: [],
        interactions: [],
        tradeoffs: [
          { gains: 'midrange purity', cost: 'low power', basis: 'review_consensus' },
        ],
      },
    });
    const result = runInference(product);
    expect(result.tradeoffSummary).toBe('midrange purity at the cost of low power');
  });

  it('null when no tradeoff data', () => {
    const product = makeProduct({
      tendencyProfile: {
        basis: 'review_consensus',
        confidence: 'high',
        tendencies: [{ trait: 'flow', level: 'emphasized' }],
        riskFlags: [],
      },
    });
    const result = runInference(product);
    expect(result.tradeoffSummary).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════
// Design signal extraction
// ══════════════════════════════════════════════════════════

describe('extractDesignSignals', () => {
  it('resolves archetype from architecture string', () => {
    const product = makeProduct({
      architecture: 'Delta-sigma, ESS ES9038PRO',
      topology: 'delta-sigma',
    });
    const signals = extractDesignSignals(product);
    expect(signals.archetype).not.toBeNull();
    expect(signals.archetype!.id).toBe('delta_sigma');
  });

  it('returns null archetype for unknown architecture', () => {
    const product = makeProduct({
      architecture: 'Proprietary custom design',
    });
    const signals = extractDesignSignals(product);
    expect(signals.archetype).toBeNull();
  });

  it('handles missing architecture', () => {
    const product = makeProduct({
      architecture: '',
      topology: 'class-d',
    });
    const signals = extractDesignSignals(product);
    expect(signals.topology).toBe('class-d');
    expect(signals.archetype).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════
// Expanded perceptual mapping (8 dimensions)
// ══════════════════════════════════════════════════════════

describe('mapBehaviorToPerception — expanded dimensions', () => {
  it('tonal_density emphasized → warm', () => {
    const behavior: BehavioralTendencies = {
      tendencies: [{ dimension: 'tonal_density', level: 'emphasized' }],
      riskFlags: [],
      basis: 'review_consensus',
    };
    expect(mapBehaviorToPerception(behavior).axes.warm_bright).toBe('warm');
  });

  it('clarity emphasized + tonal_density less_emphasized → bright', () => {
    const behavior: BehavioralTendencies = {
      tendencies: [
        { dimension: 'clarity', level: 'emphasized' },
        { dimension: 'tonal_density', level: 'less_emphasized' },
      ],
      riskFlags: [],
      basis: 'review_consensus',
    };
    expect(mapBehaviorToPerception(behavior).axes.warm_bright).toBe('bright');
  });

  it('flow emphasized → smooth', () => {
    const behavior: BehavioralTendencies = {
      tendencies: [{ dimension: 'flow', level: 'emphasized' }],
      riskFlags: [],
      basis: 'review_consensus',
    };
    expect(mapBehaviorToPerception(behavior).axes.smooth_detailed).toBe('smooth');
  });

  it('texture emphasized (without flow) → detailed', () => {
    const behavior: BehavioralTendencies = {
      tendencies: [{ dimension: 'texture', level: 'emphasized' }],
      riskFlags: [],
      basis: 'review_consensus',
    };
    expect(mapBehaviorToPerception(behavior).axes.smooth_detailed).toBe('detailed');
  });

  it('composure emphasized → controlled', () => {
    const behavior: BehavioralTendencies = {
      tendencies: [{ dimension: 'composure', level: 'emphasized' }],
      riskFlags: [],
      basis: 'review_consensus',
    };
    expect(mapBehaviorToPerception(behavior).axes.elastic_controlled).toBe('controlled');
  });

  it('dynamics emphasized (composure not emphasized) → elastic', () => {
    const behavior: BehavioralTendencies = {
      tendencies: [
        { dimension: 'dynamics', level: 'emphasized' },
        { dimension: 'composure', level: 'moderate' },
      ],
      riskFlags: [],
      basis: 'review_consensus',
    };
    expect(mapBehaviorToPerception(behavior).axes.elastic_controlled).toBe('elastic');
  });

  it('dynamics emphasized + composure emphasized → neutral (opposing forces)', () => {
    const behavior: BehavioralTendencies = {
      tendencies: [
        { dimension: 'dynamics', level: 'emphasized' },
        { dimension: 'composure', level: 'emphasized' },
      ],
      riskFlags: [],
      basis: 'review_consensus',
    };
    expect(mapBehaviorToPerception(behavior).axes.elastic_controlled).toBe('neutral');
  });

  it('spatial_precision emphasized → airy', () => {
    const behavior: BehavioralTendencies = {
      tendencies: [{ dimension: 'spatial_precision', level: 'emphasized' }],
      riskFlags: [],
      basis: 'review_consensus',
    };
    const p = mapBehaviorToPerception(behavior);
    expect(p.axes.airy_closed).toBe('airy');
    expect(p.inferredAxes).toContain('airy_closed');
  });

  it('spatial_precision less_emphasized → closed', () => {
    const behavior: BehavioralTendencies = {
      tendencies: [{ dimension: 'spatial_precision', level: 'less_emphasized' }],
      riskFlags: [],
      basis: 'review_consensus',
    };
    const p = mapBehaviorToPerception(behavior);
    expect(p.axes.airy_closed).toBe('closed');
    expect(p.inferredAxes).toContain('airy_closed');
  });

  it('no spatial signal → airy_closed neutral', () => {
    const behavior: BehavioralTendencies = {
      tendencies: [
        { dimension: 'flow', level: 'emphasized' },
        { dimension: 'dynamics', level: 'emphasized' },
      ],
      riskFlags: [],
      basis: 'review_consensus',
    };
    expect(mapBehaviorToPerception(behavior).axes.airy_closed).toBe('neutral');
  });

  it('tracks which axes were inferred', () => {
    const behavior: BehavioralTendencies = {
      tendencies: [
        { dimension: 'tonal_density', level: 'emphasized' },
        { dimension: 'composure', level: 'emphasized' },
        { dimension: 'spatial_precision', level: 'emphasized' },
      ],
      riskFlags: [],
      basis: 'review_consensus',
    };
    const p = mapBehaviorToPerception(behavior);
    expect(p.inferredAxes).toContain('warm_bright');
    expect(p.inferredAxes).toContain('elastic_controlled');
    expect(p.inferredAxes).toContain('airy_closed');
    expect(p.inferredAxes).not.toContain('smooth_detailed');
  });
});

// ══════════════════════════════════════════════════════════
// Provenance-based confidence
// ══════════════════════════════════════════════════════════

describe('runInference — provenance-based confidence', () => {
  it('curated_profile → high regardless of dimension count', () => {
    const product = makeProduct({
      tendencyProfile: {
        basis: 'review_consensus',
        confidence: 'high',
        tendencies: [{ trait: 'flow', level: 'emphasized' }], // just 1 dimension
        riskFlags: [],
      },
    });
    const result = runInference(product);
    expect(result.source).toBe('curated_profile');
    expect(result.confidence).toBe('high');
  });

  it('numeric_traits → high regardless of dimension count', () => {
    const product = makeProduct({
      traits: { flow: 0.9 }, // just 1 dimension
    });
    const result = runInference(product);
    expect(result.source).toBe('numeric_traits');
    expect(result.confidence).toBe('high');
  });

  it('design_archetype → medium with good coverage', () => {
    const product = makeProduct({
      architecture: 'R2R resistor ladder',
      topology: 'r2r',
      traits: {},
    });
    const result = runInference(product);
    expect(result.source).toBe('design_archetype');
    expect(result.confidence).toBe('medium');
  });

  it('design_archetype → low with sparse coverage (<3 dims)', () => {
    // multibit has 3 tendencies: dynamics, tonal_density, flow — all tracked → medium
    // But if archetype only yields 2, it downgrades to low
    const product = makeProduct({
      architecture: 'custom-archetype',
      traits: {},
    });
    // Create a product that resolves to an archetype with only 2 tracked dims
    // We'll use the FPGA archetype which has: dynamics, speed, texture (3 tracked now!)
    const product2 = makeProduct({
      architecture: 'FPGA-based',
      topology: 'fpga',
      traits: {},
    });
    const result = runInference(product2);
    expect(result.source).toBe('design_archetype');
    // FPGA now has 3 tracked dims (dynamics, speed, texture) → medium
    expect(result.confidence).toBe('medium');
  });

  it('amp_topology → medium with full coverage', () => {
    const product = makeProduct({
      category: 'amplifier',
      architecture: 'custom',
      topology: 'class-ab-solid-state',
      traits: {},
    });
    const result = runInference(product);
    expect(result.source).toBe('amp_topology');
    expect(result.confidence).toBe('medium');
  });

  it('none → none when nothing matches', () => {
    const product = makeProduct({
      architecture: '',
      traits: {},
    });
    const result = runInference(product);
    expect(result.source).toBe('none');
    expect(result.confidence).toBe('none');
  });
});

// ══════════════════════════════════════════════════════════
// Curated data detection
// ══════════════════════════════════════════════════════════

describe('runInference — curated data detection', () => {
  it('detects curated tendencyProfile with non-low confidence', () => {
    const product = makeProduct({
      architecture: 'R2R ladder',
      topology: 'r2r',
      tendencyProfile: {
        basis: 'review_consensus',
        confidence: 'high',
        tendencies: [{ trait: 'flow', level: 'emphasized' }],
        riskFlags: [],
      },
    });
    expect(runInference(product).hasCuratedData).toBe(true);
  });

  it('does not count low-confidence profile as curated', () => {
    const product = makeProduct({
      architecture: 'R2R ladder',
      topology: 'r2r',
      tendencyProfile: {
        basis: 'editorial_inference',
        confidence: 'low',
        tendencies: [{ trait: 'flow', level: 'emphasized' }],
        riskFlags: [],
      },
    });
    expect(runInference(product).hasCuratedData).toBe(false);
  });

  it('no tendencyProfile → hasCuratedData false', () => {
    const product = makeProduct({
      architecture: 'Delta-sigma',
      topology: 'delta-sigma',
    });
    expect(runInference(product).hasCuratedData).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════
// Strict chain enforcement
// ══════════════════════════════════════════════════════════

describe('runInference — strict Design → Behavior → Perception chain', () => {
  it('no behavior → no perception (no Design → Perception shortcut)', () => {
    const product = makeProduct({
      architecture: 'Unknown custom',
      topology: 'other',
      traits: {},
    });
    const result = runInference(product);
    expect(result.behavior).toBeNull();
    expect(result.perception).toBeNull();
  });

  it('perception derives from behavioral output, not topology', () => {
    const product = makeProduct({
      architecture: 'Sealed box, two-way',
      topology: 'sealed',
      category: 'speaker',
      traits: {},
    });
    const result = runInference(product);
    expect(result.behavior).not.toBeNull();
    expect(result.perception).not.toBeNull();
    // sealed_box archetype: speed↑, composure↑, dynamics↓
    // composure emphasized + dynamics less_emphasized → controlled
    expect(result.perception!.axes.elastic_controlled).toBe('controlled');
  });
});

// ══════════════════════════════════════════════════════════
// Numeric traits threshold mapping
// ══════════════════════════════════════════════════════════

describe('Numeric traits → behavioral mapping', () => {
  it('≥0.7 → emphasized', () => {
    const product = makeProduct({ traits: { flow: 0.7 } });
    const result = runInference(product);
    expect(findDim(result.behavior!, 'flow')?.level).toBe('emphasized');
  });

  it('0.4–0.69 → moderate', () => {
    const product = makeProduct({ traits: { clarity: 0.5 } });
    const result = runInference(product);
    expect(findDim(result.behavior!, 'clarity')?.level).toBe('moderate');
  });

  it('<0.4 → less_emphasized', () => {
    const product = makeProduct({ traits: { composure: 0.2 } });
    const result = runInference(product);
    expect(findDim(result.behavior!, 'composure')?.level).toBe('less_emphasized');
  });

  it('only maps tracked dimensions (ignores elasticity, warmth)', () => {
    const product = makeProduct({
      traits: { elasticity: 0.9, warmth: 0.8, flow: 0.6 },
    });
    const result = runInference(product);
    // elasticity and warmth are not tracked dimensions
    expect(result.behavior!.tendencies.length).toBe(1); // only flow
    expect(findDim(result.behavior!, 'flow')?.level).toBe('moderate');
  });
});
