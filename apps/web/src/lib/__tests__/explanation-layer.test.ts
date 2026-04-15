/**
 * Feature 9 — Explanation Layer ("Why This Works")
 *
 * Tests buildExplanation() signal selection:
 * - Constraint signal when path targets bottleneck component
 * - Stacked trait signal when contributor matches path target
 * - Trade-off driver when gains and sacrifices both present
 * - Suppression for HOLD paths (restraint / block)
 * - Suppression for low-confidence paths
 * - Max 2 lines
 * - No duplication of rationale wording
 */

import { buildExplanation } from '../consultation';
import type { TradeoffAssessment } from '../tradeoff-assessment';
import type { PreferenceProtectionResult } from '../preference-protection';
import type { CounterfactualAssessment } from '../counterfactual-assessment';
import type { PrimaryConstraint, StackedTraitInsight, UpgradePath } from '../advisory-response';

// ── Factories ────────────────────────────────────────

function makeTradeoff(overrides: Partial<TradeoffAssessment> = {}): TradeoffAssessment {
  return {
    likelyGains: ['improved clarity'],
    likelySacrifices: ['warmth may decrease'],
    preservedStrengths: [],
    magnitude: 'moderate',
    confidence: 'medium',
    confidenceReason: 'Test.',
    netNegative: false,
    source: 'structured_inference',
    ...overrides,
  };
}

function makeProtection(overrides: Partial<PreferenceProtectionResult> = {}): PreferenceProtectionResult {
  return {
    threats: [],
    explicitAtRisk: false,
    inferredAtRisk: false,
    overriddenByConstraint: false,
    verdict: 'safe',
    reason: '',
    ...overrides,
  };
}

function makeCounterfactual(overrides: Partial<CounterfactualAssessment> = {}): CounterfactualAssessment {
  return {
    baseline: 'stable',
    overcorrectionRisk: { present: false },
    restraintRecommended: false,
    confidence: 'medium',
    ...overrides,
  };
}

function makePath(overrides: Partial<UpgradePath> = {}): UpgradePath {
  return {
    rank: 1,
    label: 'DAC Upgrade',
    impact: 'Moderate impact',
    rationale: 'Should improve clarity.',
    options: [],
    ...overrides,
  };
}

function makeConstraint(overrides: Partial<PrimaryConstraint> = {}): PrimaryConstraint {
  return {
    componentName: 'DAC',
    category: 'dac_limitation',
    explanation: 'The DAC is where the system has the most room to grow.',
    ...overrides,
  };
}

function makeStackedTrait(overrides: Partial<StackedTraitInsight> = {}): StackedTraitInsight {
  return {
    label: 'warm_tilt',
    contributors: ['DAC', 'Amplifier'],
    explanation: 'DAC and Amplifier both push toward warm tilt.',
    classification: 'compounding_bias',
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════
// Group 1 — Constraint signal
// ══════════════════════════════════════════════════════

describe('constraint signal', () => {
  test('explanation includes constraint when path targets bottleneck component', () => {
    const result = buildExplanation(
      makePath({ label: 'DAC Upgrade', tradeoff: makeTradeoff() }),
      makeConstraint({ componentName: 'DAC', category: 'dac_limitation' }),
      [],
    );

    expect(result).toBeDefined();
    expect(result!.length).toBeGreaterThanOrEqual(1);
    expect(result![0]).toContain('limiting factor');
    expect(result![0]).toContain('dac limitation');
  });

  test('constraint signal not included when path targets different component', () => {
    const result = buildExplanation(
      makePath({ label: 'Speaker Upgrade', tradeoff: makeTradeoff() }),
      makeConstraint({ componentName: 'DAC', category: 'dac_limitation' }),
      [],
    );

    // Should not have constraint line (path targets speakers, not DAC)
    if (result) {
      for (const line of result) {
        expect(line).not.toContain('limiting factor');
      }
    }
  });
});

// ══════════════════════════════════════════════════════
// Group 2 — Stacked trait signal
// ══════════════════════════════════════════════════════

describe('stacked trait signal', () => {
  test('explanation includes stacked trait when contributor matches path target', () => {
    const result = buildExplanation(
      makePath({ label: 'DAC Upgrade', tradeoff: makeTradeoff() }),
      undefined,
      [makeStackedTrait({ contributors: ['DAC', 'Amplifier'], classification: 'compounding_bias' })],
    );

    expect(result).toBeDefined();
    expect(result!.some((line) => line.includes('push toward'))).toBe(true);
  });

  test('stacked trait labeled as system_character uses signature language', () => {
    const result = buildExplanation(
      makePath({ label: 'DAC Upgrade', tradeoff: makeTradeoff() }),
      undefined,
      [makeStackedTrait({ contributors: ['DAC', 'Amplifier'], classification: 'system_character' })],
    );

    expect(result).toBeDefined();
    expect(result!.some((line) => line.includes('system signature'))).toBe(true);
  });

  test('stacked trait not included when no contributor matches path target', () => {
    const result = buildExplanation(
      makePath({ label: 'Speaker Upgrade', tradeoff: makeTradeoff() }),
      undefined,
      [makeStackedTrait({ contributors: ['DAC', 'Amplifier'] })],
    );

    // No stacked trait line since speakers aren't contributors
    if (result) {
      for (const line of result) {
        expect(line).not.toContain('push toward');
        expect(line).not.toContain('system signature');
      }
    }
  });
});

// ══════════════════════════════════════════════════════
// Group 3 — Trade-off driver
// ══════════════════════════════════════════════════════

describe('tradeoff driver signal', () => {
  test('explanation includes tradeoff driver when gains and sacrifices both present', () => {
    const result = buildExplanation(
      makePath({
        label: 'Speaker Upgrade',
        tradeoff: makeTradeoff({
          likelyGains: ['improved detail'],
          likelySacrifices: ['warmth may decrease'],
        }),
      }),
      undefined,
      [],
    );

    expect(result).toBeDefined();
    expect(result!.some((line) => line.includes('Improving') && line.includes('trading'))).toBe(true);
  });

  test('tradeoff driver omitted when only gains, no sacrifices', () => {
    const result = buildExplanation(
      makePath({
        label: 'Speaker Upgrade',
        tradeoff: makeTradeoff({
          likelyGains: ['improved detail'],
          likelySacrifices: [],
        }),
      }),
      undefined,
      [],
    );

    // No "Improving X requires trading Y" line
    if (result) {
      for (const line of result) {
        expect(line).not.toContain('trading');
      }
    }
  });
});

// ══════════════════════════════════════════════════════
// Group 4 — Suppression rules
// ══════════════════════════════════════════════════════

describe('suppression rules', () => {
  test('explanation suppressed for HOLD path (restraintRecommended)', () => {
    const result = buildExplanation(
      makePath({
        tradeoff: makeTradeoff(),
        counterfactual: makeCounterfactual({ restraintRecommended: true }),
      }),
      makeConstraint(),
      [makeStackedTrait()],
    );

    expect(result).toBeUndefined();
  });

  test('explanation suppressed for HOLD path (protection block)', () => {
    const result = buildExplanation(
      makePath({
        tradeoff: makeTradeoff(),
        protection: makeProtection({ verdict: 'block', reason: 'Would compromise warmth.' }),
      }),
      makeConstraint(),
      [makeStackedTrait()],
    );

    expect(result).toBeUndefined();
  });

  test('explanation suppressed when tradeoff confidence is low', () => {
    const result = buildExplanation(
      makePath({
        label: 'DAC Upgrade',
        tradeoff: makeTradeoff({ confidence: 'low' }),
      }),
      makeConstraint(),
      [makeStackedTrait()],
    );

    expect(result).toBeUndefined();
  });

  test('explanation returned when tradeoff confidence is medium', () => {
    const result = buildExplanation(
      makePath({
        label: 'DAC Upgrade',
        tradeoff: makeTradeoff({ confidence: 'medium' }),
      }),
      makeConstraint({ componentName: 'DAC' }),
      [],
    );

    expect(result).toBeDefined();
    expect(result!.length).toBeGreaterThanOrEqual(1);
  });
});

// ══════════════════════════════════════════════════════
// Group 5 — Max 2 lines
// ══════════════════════════════════════════════════════

describe('output limits', () => {
  test('never more than 2 explanation lines even with all signals present', () => {
    const result = buildExplanation(
      makePath({
        label: 'DAC Upgrade',
        tradeoff: makeTradeoff({
          likelyGains: ['improved detail'],
          likelySacrifices: ['warmth'],
        }),
        protection: makeProtection({ verdict: 'safe', explicitAtRisk: false }),
      }),
      makeConstraint({ componentName: 'DAC' }),
      [makeStackedTrait({ contributors: ['DAC', 'Amplifier'] })],
    );

    expect(result).toBeDefined();
    expect(result!.length).toBeLessThanOrEqual(2);
  });
});

// ══════════════════════════════════════════════════════
// Group 6 — No rationale duplication
// ══════════════════════════════════════════════════════

describe('no rationale duplication', () => {
  test('explanation lines are distinct from typical rationale phrases', () => {
    const result = buildExplanation(
      makePath({
        label: 'DAC Upgrade',
        tradeoff: makeTradeoff({
          likelyGains: ['improved clarity'],
          likelySacrifices: ['warmth'],
        }),
      }),
      makeConstraint({ componentName: 'DAC' }),
      [],
    );

    expect(result).toBeDefined();
    // Explanation should not use the rationale's "Should improve" / "may decrease" phrasing
    for (const line of result!) {
      expect(line).not.toContain('Should improve');
      expect(line).not.toContain('may decrease');
    }
  });
});

// ══════════════════════════════════════════════════════
// Group 7 — Priority ordering
// ══════════════════════════════════════════════════════

describe('priority ordering', () => {
  test('constraint appears before tradeoff driver', () => {
    const result = buildExplanation(
      makePath({
        label: 'DAC Upgrade',
        tradeoff: makeTradeoff({
          likelyGains: ['improved detail'],
          likelySacrifices: ['warmth'],
        }),
      }),
      makeConstraint({ componentName: 'DAC' }),
      [],
    );

    expect(result).toBeDefined();
    expect(result!.length).toBe(2);
    expect(result![0]).toContain('limiting factor');
    expect(result![1]).toContain('trading');
  });

  test('constraint + stacked trait fill both slots, tradeoff excluded', () => {
    const result = buildExplanation(
      makePath({
        label: 'DAC Upgrade',
        tradeoff: makeTradeoff({
          likelyGains: ['improved detail'],
          likelySacrifices: ['warmth'],
        }),
      }),
      makeConstraint({ componentName: 'DAC' }),
      [makeStackedTrait({ contributors: ['DAC', 'Amplifier'] })],
    );

    expect(result).toBeDefined();
    expect(result!.length).toBe(2);
    expect(result![0]).toContain('limiting factor');
    expect(result![1]).toContain('push toward');
  });
});
