/**
 * Tests for Feature 2 — Trade-off Enforcement
 *
 * Tests assessTradeoffs() and assessNetNegative() against the planned
 * schema, logic rules, and Playbook principles.
 */

import { assessTradeoffs, assessNetNegative } from '../tradeoff-assessment';
import type { TradeoffAssessment } from '../tradeoff-assessment';
import type { InferenceResult } from '../inference-layer';
import type { ComponentAssessment, PrimaryConstraint, StackedTraitInsight } from '../advisory-response';
import type { PrimaryAxisLeanings } from '../axis-types';

// ── Test helpers ──────────────────────────────────────

function makeAssessment(overrides: Partial<ComponentAssessment> = {}): ComponentAssessment {
  return {
    name: 'Test Component',
    summary: 'A test component.',
    strengths: ['tonal density', 'harmonic richness'],
    weaknesses: ['transient speed', 'spatial precision'],
    verdict: 'This is the weak link.',
    verdictKind: 'upgrade_candidate',
    ...overrides,
  };
}

function makeInference(overrides: Partial<InferenceResult> = {}): InferenceResult {
  return {
    designSignals: { topology: undefined, architecture: undefined, archetype: undefined },
    behavior: null,
    perception: null,
    confidence: 'none',
    confidenceReason: 'No data.',
    source: 'none',
    hasCuratedData: false,
    tradeoffSummary: null,
    riskFlags: [],
    ...overrides,
  };
}

function makeConstraint(overrides: Partial<PrimaryConstraint> = {}): PrimaryConstraint {
  return {
    componentName: 'Test Component',
    category: 'dac_limitation',
    explanation: 'The DAC limits tonal density and flow in this system.',
    ...overrides,
  };
}

const NEUTRAL_AXES: PrimaryAxisLeanings = {
  warm_bright: 'neutral',
  smooth_detailed: 'neutral',
  elastic_controlled: 'neutral',
  airy_closed: 'neutral',
};

const WARM_SYSTEM: PrimaryAxisLeanings = {
  warm_bright: 'warm',
  smooth_detailed: 'smooth',
  elastic_controlled: 'neutral',
  airy_closed: 'neutral',
};

// ══════════════════════════════════════════════════════
// Group 1 — Source priority and sacrifice population
// ══════════════════════════════════════════════════════

describe('sacrifice source priority', () => {
  test('curated trade-off data → populates sacrifices, source = curated', () => {
    const inference = makeInference({
      source: 'curated_profile',
      confidence: 'high',
      hasCuratedData: true,
      tradeoffSummary: 'harmonic richness at the cost of transient sharpness and separation',
    });

    const result = assessTradeoffs(
      makeAssessment(),
      inference,
      'highest',
      makeConstraint(),
      [],
      NEUTRAL_AXES,
    );

    expect(result.source).toBe('curated');
    expect(result.likelySacrifices).toEqual(['transient sharpness and separation']);
  });

  test('no curated but has archetype → populates from archetype, source = structured_inference', () => {
    const inference = makeInference({
      source: 'design_archetype',
      confidence: 'medium',
      hasCuratedData: false,
      tradeoffSummary: 'Tonal density and texture at the cost of measured precision and ultimate transparency.',
    });

    const result = assessTradeoffs(
      makeAssessment(),
      inference,
      'moderate',
      undefined,
      [],
      NEUTRAL_AXES,
    );

    expect(result.source).toBe('structured_inference');
    expect(result.likelySacrifices).toEqual(['measured precision and ultimate transparency.']);
  });

  test('no curated, no archetype but axis delta exists → source = delta_inference', () => {
    const assessment = makeAssessment({
      strengths: ['warmth', 'tonal density'],
    });

    const result = assessTradeoffs(
      assessment,
      makeInference(), // source: 'none'
      'moderate',
      undefined,
      [],
      WARM_SYSTEM, // system leans warm — warmth strength is at risk
    );

    expect(result.source).toBe('delta_inference');
    expect(result.likelySacrifices.length).toBeGreaterThanOrEqual(1);
    expect(result.likelySacrifices.some((s) => s.includes('warmth'))).toBe(true);
  });

  test('no data at all → empty sacrifices, low confidence explains gap', () => {
    const assessment = makeAssessment({ strengths: [] });

    const result = assessTradeoffs(
      assessment,
      undefined,
      'refinement',
      undefined,
      [],
      NEUTRAL_AXES,
    );

    expect(result.likelySacrifices).toEqual([]);
    expect(result.confidence).toBe('low');
    expect(result.confidenceReason.toLowerCase()).toContain('insufficient');
  });

  test('curated present → archetype NOT merged (first-wins)', () => {
    // Inference has curated source AND tradeoff summary
    const inference = makeInference({
      source: 'curated_profile',
      hasCuratedData: true,
      tradeoffSummary: 'timing precision at the cost of tonal density',
    });

    const result = assessTradeoffs(
      makeAssessment(),
      inference,
      'moderate',
      undefined,
      [],
      NEUTRAL_AXES,
    );

    expect(result.source).toBe('curated');
    // Should contain only curated sacrifice, not archetype
    expect(result.likelySacrifices).toEqual(['tonal density']);
  });

  test('amp topology → source = structured_inference', () => {
    const inference = makeInference({
      source: 'amp_topology',
      hasCuratedData: false,
      tradeoffSummary: 'Midrange purity and tonal density at the cost of power and bass authority.',
    });

    const result = assessTradeoffs(
      makeAssessment(),
      inference,
      'moderate',
      undefined,
      [],
      NEUTRAL_AXES,
    );

    expect(result.source).toBe('structured_inference');
    expect(result.likelySacrifices).toEqual(['power and bass authority.']);
  });
});

// ══════════════════════════════════════════════════════
// Group 2 — Gains derivation
// ══════════════════════════════════════════════════════

describe('gains derivation', () => {
  test('bottleneck path → gains from constraint explanation', () => {
    const constraint = makeConstraint({
      explanation: 'The DAC limits tonal density and flow.',
    });

    const result = assessTradeoffs(
      makeAssessment(),
      undefined,
      'highest',
      constraint,
      [],
      NEUTRAL_AXES,
    );

    expect(result.likelyGains[0]).toBe('The DAC limits tonal density and flow.');
  });

  test('secondary path → gains from component weaknesses', () => {
    const assessment = makeAssessment({
      weaknesses: ['limited bass extension', 'compressed dynamics'],
    });

    const result = assessTradeoffs(
      assessment,
      undefined,
      'moderate',
      undefined,
      [],
      NEUTRAL_AXES,
    );

    expect(result.likelyGains.some((g) => g.toLowerCase().includes('bass extension'))).toBe(true);
    expect(result.likelyGains.some((g) => g.toLowerCase().includes('dynamics'))).toBe(true);
  });

  test('refinement path with weaknesses → gains from weaknesses', () => {
    const assessment = makeAssessment({
      weaknesses: ['slight grain in upper treble'],
    });

    const result = assessTradeoffs(
      assessment,
      undefined,
      'refinement',
      undefined,
      [],
      NEUTRAL_AXES,
    );

    expect(result.likelyGains.some((g) => g.toLowerCase().includes('grain'))).toBe(true);
  });

  test('no constraint, no weaknesses → fallback gain', () => {
    const assessment = makeAssessment({ weaknesses: [] });

    const result = assessTradeoffs(
      assessment,
      undefined,
      'moderate',
      undefined,
      [],
      NEUTRAL_AXES,
    );

    expect(result.likelyGains.length).toBeGreaterThanOrEqual(1);
    expect(result.likelyGains[0].toLowerCase()).toContain('refinement');
  });
});

// ══════════════════════════════════════════════════════
// Group 3 — Preserved strengths
// ══════════════════════════════════════════════════════

describe('preserved strengths', () => {
  test('component with 4 strengths → capped at 3', () => {
    const assessment = makeAssessment({
      strengths: ['tonal density', 'flow', 'texture', 'spatial precision'],
    });

    const result = assessTradeoffs(
      assessment,
      undefined,
      'moderate',
      undefined,
      [],
      NEUTRAL_AXES,
    );

    expect(result.preservedStrengths.length).toBeLessThanOrEqual(3);
  });

  test('component contributing to system_character → trait appears in preserved strengths', () => {
    const stacked: StackedTraitInsight[] = [{
      label: 'harmonic warmth',
      contributors: ['Test Component', 'Other Component'],
      explanation: 'The chain stacks warmth.',
      classification: 'system_character',
    }];

    const result = assessTradeoffs(
      makeAssessment({ strengths: ['flow'] }),
      undefined,
      'moderate',
      undefined,
      stacked,
      NEUTRAL_AXES,
    );

    expect(result.preservedStrengths.some((s) => s.includes('harmonic warmth'))).toBe(true);
  });

  test('component with no strengths → empty preserved strengths', () => {
    const result = assessTradeoffs(
      makeAssessment({ strengths: [] }),
      undefined,
      'moderate',
      undefined,
      [],
      NEUTRAL_AXES,
    );

    expect(result.preservedStrengths).toEqual([]);
  });

  test('system_imbalance stacked trait does NOT appear in preserved strengths', () => {
    const stacked: StackedTraitInsight[] = [{
      label: 'excessive brightness',
      contributors: ['Test Component'],
      explanation: 'Stacked brightness.',
      classification: 'system_imbalance',
    }];

    const result = assessTradeoffs(
      makeAssessment({ strengths: ['clarity'] }),
      undefined,
      'moderate',
      undefined,
      stacked,
      NEUTRAL_AXES,
    );

    expect(result.preservedStrengths.some((s) => s.includes('excessive brightness'))).toBe(false);
  });
});

// ══════════════════════════════════════════════════════
// Group 4 — Magnitude
// ══════════════════════════════════════════════════════

describe('magnitude determination', () => {
  test('rank 1 bottleneck with tonal_imbalance → high', () => {
    const result = assessTradeoffs(
      makeAssessment(),
      undefined,
      'highest',
      makeConstraint({ category: 'tonal_imbalance' }),
      [],
      NEUTRAL_AXES,
    );

    expect(result.magnitude).toBe('high');
  });

  test('rank 1 bottleneck with stacked_bias → high', () => {
    const result = assessTradeoffs(
      makeAssessment(),
      undefined,
      'highest',
      makeConstraint({ category: 'stacked_bias' }),
      [],
      NEUTRAL_AXES,
    );

    expect(result.magnitude).toBe('high');
  });

  test('rank 2 with moderate impact → moderate', () => {
    const result = assessTradeoffs(
      makeAssessment(),
      undefined,
      'moderate',
      undefined,
      [],
      NEUTRAL_AXES,
    );

    expect(result.magnitude).toBe('moderate');
  });

  test('refinement tier → subtle', () => {
    const result = assessTradeoffs(
      makeAssessment(),
      undefined,
      'refinement',
      undefined,
      [],
      NEUTRAL_AXES,
    );

    expect(result.magnitude).toBe('subtle');
  });

  test('rank 1 with dac_limitation → moderate (not all bottlenecks are high)', () => {
    const result = assessTradeoffs(
      makeAssessment(),
      undefined,
      'highest',
      makeConstraint({ category: 'dac_limitation' }),
      [],
      NEUTRAL_AXES,
    );

    expect(result.magnitude).toBe('moderate');
  });
});

// ══════════════════════════════════════════════════════
// Group 5 — Confidence
// ══════════════════════════════════════════════════════

describe('confidence determination', () => {
  test('curated trade-off data → high', () => {
    const inference = makeInference({
      source: 'curated_profile',
      confidence: 'high',
      hasCuratedData: true,
      tradeoffSummary: 'X at the cost of Y',
    });

    const result = assessTradeoffs(
      makeAssessment(),
      inference,
      'moderate',
      undefined,
      [],
      NEUTRAL_AXES,
    );

    expect(result.confidence).toBe('high');
  });

  test('archetype-only → medium', () => {
    const inference = makeInference({
      source: 'design_archetype',
      confidence: 'medium',
      tradeoffSummary: 'X at the cost of Y',
    });

    const result = assessTradeoffs(
      makeAssessment(),
      inference,
      'moderate',
      undefined,
      [],
      NEUTRAL_AXES,
    );

    expect(result.confidence).toBe('medium');
  });

  test('delta-only → low', () => {
    const result = assessTradeoffs(
      makeAssessment({ strengths: ['warmth'] }),
      makeInference(), // source: 'none'
      'moderate',
      undefined,
      [],
      WARM_SYSTEM,
    );

    expect(result.confidence).toBe('low');
  });
});

// ══════════════════════════════════════════════════════
// Group 6 — netNegative
// ══════════════════════════════════════════════════════

describe('assessNetNegative', () => {
  test('sacrifice threatens a preserved strength (keyword overlap ≥2) → true', () => {
    const result = assessNetNegative(
      ['Addresses: limited bass extension'],
      ['may reduce tonal density and harmonic richness in the midrange'],
      ['tonal density', 'harmonic richness', 'musical flow'],
      'moderate',
      'medium',
    );

    expect(result).toBe(true);
  });

  test('high magnitude + low confidence → true', () => {
    const result = assessNetNegative(
      ['Improved composure'],
      ['unknown trade-offs'],
      ['flow'],
      'high',
      'low',
    );

    expect(result).toBe(true);
  });

  test('1 gain, 2 sacrifices, medium confidence → true', () => {
    const result = assessNetNegative(
      ['Addresses: limited bass'],
      ['may reduce warmth', 'may reduce flow'],
      ['warmth'],
      'moderate',
      'medium',
    );

    expect(result).toBe(true);
  });

  test('2 gains, 1 sacrifice, high confidence → false', () => {
    const result = assessNetNegative(
      ['Improved tonal density', 'Better bass authority'],
      ['may reduce transient speed'],
      ['spatial precision'],
      'moderate',
      'high',
    );

    expect(result).toBe(false);
  });

  test('no sacrifices, low confidence → false (no evidence of harm)', () => {
    const result = assessNetNegative(
      ['Addresses: limited detail'],
      [],
      ['warmth'],
      'moderate',
      'low',
    );

    expect(result).toBe(false);
  });

  test('high magnitude + high confidence → false', () => {
    const result = assessNetNegative(
      ['Resolves power mismatch', 'Improved composure'],
      ['may require speaker change'],
      ['flow'],
      'high',
      'high',
    );

    expect(result).toBe(false);
  });

  test('single overlapping word (< 2) does NOT trigger rule 1', () => {
    const result = assessNetNegative(
      ['Better dynamics'],
      ['may reduce overall system clarity'],  // 'system' overlaps but only 1 significant word
      ['the system sounds great'],
      'moderate',
      'medium',
    );

    // 'system' appears in both but is a generic word; only 1 overlap < 2 threshold
    expect(result).toBe(false);
  });
});

// ══════════════════════════════════════════════════════
// Group 7 — Integration smoke tests
// ══════════════════════════════════════════════════════

describe('full assessTradeoffs integration', () => {
  test('Pontus II-like curated component → correct structure', () => {
    const assessment = makeAssessment({
      name: 'Pontus II',
      strengths: ['tonal density', 'harmonic richness', 'texture'],
      weaknesses: ['transient sharpness'],
    });

    const inference = makeInference({
      source: 'curated_profile',
      confidence: 'high',
      hasCuratedData: true,
      tradeoffSummary: 'harmonic richness, texture, and tonal authority at the cost of transient sharpness and the explicit separation of delta-sigma designs',
    });

    const result = assessTradeoffs(
      assessment,
      inference,
      'moderate',
      undefined,
      [],
      { warm_bright: 'warm', smooth_detailed: 'smooth', elastic_controlled: 'neutral', airy_closed: 'neutral' },
    );

    expect(result.source).toBe('curated');
    expect(result.confidence).toBe('high');
    expect(result.likelySacrifices.length).toBeGreaterThanOrEqual(1);
    expect(result.preservedStrengths).toContain('tonal density');
    expect(result.magnitude).toBe('moderate');
    expect(result.netNegative).toBe(false); // curated + moderate = valid path
  });

  test('minimal data component → graceful degradation', () => {
    const assessment = makeAssessment({
      name: 'Unknown DAC',
      strengths: [],
      weaknesses: ['limited detail'],
    });

    const result = assessTradeoffs(
      assessment,
      undefined,
      'refinement',
      undefined,
      [],
      NEUTRAL_AXES,
    );

    expect(result.confidence).toBe('low');
    expect(result.magnitude).toBe('subtle');
    expect(result.netNegative).toBe(false); // no evidence of harm
    expect(result.likelyGains.length).toBeGreaterThanOrEqual(1);
    expect(result.preservedStrengths).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════
// Group 8 — Confidence floor rule (Feature 5)
// ══════════════════════════════════════════════════════

describe('confidence floor rule', () => {
  test('curated sacrifice + high inference → high (no cap)', () => {
    const inference = makeInference({
      source: 'curated_profile',
      confidence: 'high',
      hasCuratedData: true,
      tradeoffSummary: 'warmth at the cost of speed',
    });

    const result = assessTradeoffs(
      makeAssessment(),
      inference,
      'moderate',
      undefined,
      [],
      NEUTRAL_AXES,
    );

    expect(result.confidence).toBe('high');
    expect(result.confidenceReason).not.toContain('Capped');
  });

  test('curated sacrifice + low inference → capped to low', () => {
    const inference = makeInference({
      source: 'curated_profile',
      confidence: 'low',
      hasCuratedData: true,
      tradeoffSummary: 'warmth at the cost of speed',
    });

    const result = assessTradeoffs(
      makeAssessment(),
      inference,
      'moderate',
      undefined,
      [],
      NEUTRAL_AXES,
    );

    expect(result.confidence).toBe('low');
    expect(result.confidenceReason).toContain('Capped');
  });

  test('structured sacrifice + low inference → capped to low', () => {
    const inference = makeInference({
      source: 'design_archetype',
      confidence: 'low',
      tradeoffSummary: 'X at the cost of Y',
    });

    const result = assessTradeoffs(
      makeAssessment(),
      inference,
      'moderate',
      undefined,
      [],
      NEUTRAL_AXES,
    );

    expect(result.confidence).toBe('low');
    expect(result.confidenceReason).toContain('Capped');
  });

  test('structured sacrifice + medium inference → medium (no cap)', () => {
    const inference = makeInference({
      source: 'design_archetype',
      confidence: 'medium',
      tradeoffSummary: 'X at the cost of Y',
    });

    const result = assessTradeoffs(
      makeAssessment(),
      inference,
      'moderate',
      undefined,
      [],
      NEUTRAL_AXES,
    );

    expect(result.confidence).toBe('medium');
    expect(result.confidenceReason).not.toContain('Capped');
  });

  test('no inference (undefined) → treated as low ceiling', () => {
    const result = assessTradeoffs(
      makeAssessment(),
      undefined,
      'moderate',
      undefined,
      [],
      WARM_SYSTEM,
    );

    expect(result.confidence).toBe('low');
  });

  test('inference confidence none → treated as low ceiling', () => {
    const inference = makeInference({
      source: 'curated_profile',
      confidence: 'none',
      hasCuratedData: true,
      tradeoffSummary: 'warmth at the cost of speed',
    });

    const result = assessTradeoffs(
      makeAssessment(),
      inference,
      'moderate',
      undefined,
      [],
      NEUTRAL_AXES,
    );

    expect(result.confidence).toBe('low');
    expect(result.confidenceReason).toContain('Capped');
  });
});
