/**
 * Tests for Feature 6 — Counterfactual Reasoning
 *
 * Tests assessCounterfactual() against the v1 schema:
 * baseline, overcorrectionRisk, restraintRecommended, confidence.
 */

import { assessCounterfactual } from '../counterfactual-assessment';
import type { CounterfactualAssessment } from '../counterfactual-assessment';
import type { TradeoffAssessment } from '../tradeoff-assessment';
import type { PreferenceProtectionResult } from '../preference-protection';
import type { PrimaryConstraint, StackedTraitInsight } from '../advisory-response';

// ── Test helpers ──────────────────────────────────────

function makeTradeoff(overrides: Partial<TradeoffAssessment> = {}): TradeoffAssessment {
  return {
    likelyGains: ['improved clarity'],
    likelySacrifices: ['warmth may decrease'],
    preservedStrengths: ['tonal density'],
    magnitude: 'moderate',
    confidence: 'medium',
    confidenceReason: 'Test.',
    netNegative: false,
    source: 'structured_inference',
    ...overrides,
  };
}

function makeConstraint(overrides: Partial<PrimaryConstraint> = {}): PrimaryConstraint {
  return {
    componentName: 'Test DAC',
    category: 'dac_limitation',
    explanation: 'The DAC limits tonal density.',
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
    reason: 'No threats.',
    ...overrides,
  };
}

function makeStacked(overrides: Partial<StackedTraitInsight> = {}): StackedTraitInsight {
  return {
    label: 'high_warmth',
    contributors: ['DAC', 'Amp'],
    explanation: 'Both lean warm.',
    classification: 'system_character',
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════
// Group 1 — Baseline determination
// ══════════════════════════════════════════════════════

describe('baseline determination', () => {
  test('constraint present → degrading', () => {
    const result = assessCounterfactual({
      tradeoff: makeTradeoff(),
      protection: undefined,
      constraint: makeConstraint(),
      stacked: [],
    });

    expect(result.baseline).toBe('degrading');
  });

  test('system_imbalance stacked trait → degrading', () => {
    const result = assessCounterfactual({
      tradeoff: makeTradeoff(),
      protection: undefined,
      constraint: undefined,
      stacked: [makeStacked({ classification: 'system_imbalance' })],
    });

    expect(result.baseline).toBe('degrading');
  });

  test('no constraint, no imbalance → stable', () => {
    const result = assessCounterfactual({
      tradeoff: makeTradeoff(),
      protection: undefined,
      constraint: undefined,
      stacked: [],
    });

    expect(result.baseline).toBe('stable');
  });

  test('system_character stacked trait (no imbalance) → stable', () => {
    const result = assessCounterfactual({
      tradeoff: makeTradeoff(),
      protection: undefined,
      constraint: undefined,
      stacked: [makeStacked({ classification: 'system_character' })],
    });

    expect(result.baseline).toBe('stable');
  });
});

// ══════════════════════════════════════════════════════
// Group 2 — Overcorrection risk
// ══════════════════════════════════════════════════════

describe('overcorrection risk', () => {
  test('system_imbalance + gains reinforce same trait → present', () => {
    const result = assessCounterfactual({
      tradeoff: makeTradeoff({ likelyGains: ['improved warmth and body'] }),
      protection: undefined,
      constraint: undefined,
      stacked: [makeStacked({
        property: 'high_warmth',
        classification: 'system_imbalance',
      })],
    });

    expect(result.overcorrectionRisk.present).toBe(true);
    expect(result.overcorrectionRisk.trait).toBe('warmth');
    expect(result.overcorrectionRisk.reason).toContain('warmth');
  });

  test('system_imbalance but gains do NOT reinforce → not present', () => {
    const result = assessCounterfactual({
      tradeoff: makeTradeoff({ likelyGains: ['improved clarity and speed'] }),
      protection: undefined,
      constraint: undefined,
      stacked: [makeStacked({
        property: 'high_warmth',
        classification: 'system_imbalance',
      })],
    });

    expect(result.overcorrectionRisk.present).toBe(false);
  });

  test('system_character (not imbalance) + matching gains → not present', () => {
    const result = assessCounterfactual({
      tradeoff: makeTradeoff({ likelyGains: ['improved warmth'] }),
      protection: undefined,
      constraint: undefined,
      stacked: [makeStacked({
        property: 'high_warmth',
        classification: 'system_character',
      })],
    });

    expect(result.overcorrectionRisk.present).toBe(false);
  });

  test('no stacked traits → not present', () => {
    const result = assessCounterfactual({
      tradeoff: makeTradeoff(),
      protection: undefined,
      constraint: undefined,
      stacked: [],
    });

    expect(result.overcorrectionRisk.present).toBe(false);
  });
});

// ══════════════════════════════════════════════════════
// Group 3 — Restraint determination
// ══════════════════════════════════════════════════════

describe('restraint determination', () => {
  test('netNegative → restraint recommended', () => {
    const result = assessCounterfactual({
      tradeoff: makeTradeoff({ netNegative: true }),
      protection: undefined,
      constraint: undefined,
      stacked: [],
    });

    expect(result.restraintRecommended).toBe(true);
    expect(result.restraintReason).toContain('trade-offs outweigh');
  });

  test('protection block → restraint recommended', () => {
    const result = assessCounterfactual({
      tradeoff: makeTradeoff(),
      protection: makeProtection({ verdict: 'block' }),
      constraint: undefined,
      stacked: [],
    });

    expect(result.restraintRecommended).toBe(true);
    expect(result.restraintReason).toContain('stated listening priority');
  });

  test('stable baseline + overcorrection → restraint recommended', () => {
    const result = assessCounterfactual({
      tradeoff: makeTradeoff({ likelyGains: ['improved warmth and body'] }),
      protection: undefined,
      constraint: undefined,
      stacked: [makeStacked({
        property: 'high_warmth',
        classification: 'system_imbalance',
      })],
    });

    // baseline = degrading (has imbalance), so this trigger shouldn't fire
    // because baseline must be 'stable' for this rule
    expect(result.baseline).toBe('degrading');
    // restraint may still not fire if netNegative is false and no block
    expect(result.restraintRecommended).toBe(false);
  });

  test('no negative signals → no restraint', () => {
    const result = assessCounterfactual({
      tradeoff: makeTradeoff(),
      protection: makeProtection({ verdict: 'safe' }),
      constraint: undefined,
      stacked: [],
    });

    expect(result.restraintRecommended).toBe(false);
    expect(result.restraintReason).toBeUndefined();
  });

  test('netNegative takes priority over protection block', () => {
    const result = assessCounterfactual({
      tradeoff: makeTradeoff({ netNegative: true }),
      protection: makeProtection({ verdict: 'block' }),
      constraint: undefined,
      stacked: [],
    });

    expect(result.restraintRecommended).toBe(true);
    expect(result.restraintReason).toContain('trade-offs outweigh');
  });
});

// ══════════════════════════════════════════════════════
// Group 4 — Confidence
// ══════════════════════════════════════════════════════

describe('confidence', () => {
  test('floors to tradeoff confidence', () => {
    const result = assessCounterfactual({
      tradeoff: makeTradeoff({ confidence: 'low' }),
      protection: undefined,
      constraint: makeConstraint(),
      stacked: [makeStacked()],
    });

    expect(result.confidence).toBe('low');
  });

  test('no constraint + no stacked → capped at medium', () => {
    const result = assessCounterfactual({
      tradeoff: makeTradeoff({ confidence: 'high' }),
      protection: undefined,
      constraint: undefined,
      stacked: [],
    });

    expect(result.confidence).toBe('medium');
  });

  test('constraint present + high tradeoff → high', () => {
    const result = assessCounterfactual({
      tradeoff: makeTradeoff({ confidence: 'high' }),
      protection: undefined,
      constraint: makeConstraint(),
      stacked: [],
    });

    expect(result.confidence).toBe('high');
  });

  test('stacked present + high tradeoff → high', () => {
    const result = assessCounterfactual({
      tradeoff: makeTradeoff({ confidence: 'high' }),
      protection: undefined,
      constraint: undefined,
      stacked: [makeStacked()],
    });

    expect(result.confidence).toBe('high');
  });
});

// ══════════════════════════════════════════════════════
// Group 5 — Integration
// ══════════════════════════════════════════════════════

describe('integration', () => {
  test('constrained system with matching gains → degrading + overcorrection + no restraint (degrading ≠ stable)', () => {
    const result = assessCounterfactual({
      tradeoff: makeTradeoff({
        likelyGains: ['improved warmth and tonal density'],
        confidence: 'medium',
      }),
      protection: undefined,
      constraint: makeConstraint(),
      stacked: [makeStacked({
        property: 'high_warmth',
        classification: 'system_imbalance',
      })],
    });

    expect(result.baseline).toBe('degrading');
    expect(result.overcorrectionRisk.present).toBe(true);
    expect(result.restraintRecommended).toBe(false); // baseline is degrading, not stable
    expect(result.confidence).toBe('medium');
  });

  test('stable system + netNegative tradeoff → restraint recommended', () => {
    const result = assessCounterfactual({
      tradeoff: makeTradeoff({
        netNegative: true,
        confidence: 'high',
      }),
      protection: undefined,
      constraint: undefined,
      stacked: [],
    });

    expect(result.baseline).toBe('stable');
    expect(result.restraintRecommended).toBe(true);
    // confidence capped at medium (no constraint, no stacked)
    expect(result.confidence).toBe('medium');
  });
});
