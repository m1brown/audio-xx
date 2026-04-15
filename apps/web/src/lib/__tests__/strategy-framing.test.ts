/**
 * Tests for Feature 7 — Strategy Framing
 *
 * Tests frameStrategy() and deduplicateStrategies() against the v1 schema:
 * strategyLabel, strategyIntent.
 */

import { frameStrategy, deduplicateStrategies } from '../strategy-framing';
import type { PathForFraming } from '../strategy-framing';
import type { TradeoffAssessment } from '../tradeoff-assessment';
import type { PreferenceProtectionResult } from '../preference-protection';
import type { CounterfactualAssessment } from '../counterfactual-assessment';

// ── Test helpers ──────────────────────────────────────

function makePath(overrides: Partial<PathForFraming> = {}): PathForFraming {
  return {
    rank: 1,
    label: 'DAC Upgrade',
    impact: 'moderate',
    rationale: 'Improves resolution.',
    ...overrides,
  };
}

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

function makeCounterfactual(overrides: Partial<CounterfactualAssessment> = {}): CounterfactualAssessment {
  return {
    baseline: 'stable',
    overcorrectionRisk: { present: false },
    restraintRecommended: false,
    confidence: 'medium',
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════
// Group 1 — Restraint paths
// ══════════════════════════════════════════════════════

describe('restraint paths', () => {
  test('counterfactual restraint → Hold — preserve current balance', () => {
    const result = frameStrategy(makePath({
      counterfactual: makeCounterfactual({
        restraintRecommended: true,
        restraintReason: 'The trade-offs outweigh the gains.',
      }),
    }));

    expect(result.strategyLabel).toBe('Hold — preserve current balance');
    expect(result.strategyIntent).toBe('The trade-offs outweigh the gains.');
  });

  test('counterfactual restraint without reason → default intent', () => {
    const result = frameStrategy(makePath({
      counterfactual: makeCounterfactual({
        restraintRecommended: true,
      }),
    }));

    expect(result.strategyLabel).toBe('Hold — preserve current balance');
    expect(result.strategyIntent).toContain('does not clearly benefit');
  });

  test('protection block → Hold — protect stated priorities', () => {
    const result = frameStrategy(makePath({
      protection: makeProtection({
        verdict: 'block',
        reason: 'Would compromise warmth.',
      }),
    }));

    expect(result.strategyLabel).toBe('Hold — protect stated priorities');
    expect(result.strategyIntent).toBe('Would compromise warmth.');
  });

  test('restraint takes priority over protection block', () => {
    const result = frameStrategy(makePath({
      counterfactual: makeCounterfactual({
        restraintRecommended: true,
        restraintReason: 'Restraint reason.',
      }),
      protection: makeProtection({
        verdict: 'block',
        reason: 'Block reason.',
      }),
    }));

    expect(result.strategyLabel).toContain('Hold — preserve');
    expect(result.strategyIntent).toBe('Restraint reason.');
  });
});

// ══════════════════════════════════════════════════════
// Group 2 — Bottleneck paths
// ══════════════════════════════════════════════════════

describe('bottleneck paths', () => {
  test('highest impact → Resolve the primary bottleneck', () => {
    const result = frameStrategy(makePath({
      impact: 'highest',
    }));

    expect(result.strategyLabel).toBe('Resolve the primary bottleneck');
    expect(result.strategyIntent).toContain('most limiting factor');
  });

  test('highest impact takes priority over gain-based direction', () => {
    const result = frameStrategy(makePath({
      impact: 'highest',
      tradeoff: makeTradeoff({ likelyGains: ['improved clarity and detail'] }),
    }));

    expect(result.strategyLabel).toBe('Resolve the primary bottleneck');
  });
});

// ══════════════════════════════════════════════════════
// Group 3 — Gain-based direction
// ══════════════════════════════════════════════════════

describe('gain-based direction', () => {
  test('clarity gains → Enhance detail and precision', () => {
    const result = frameStrategy(makePath({
      tradeoff: makeTradeoff({ likelyGains: ['improved clarity and resolution'] }),
    }));

    expect(result.strategyLabel).toBe('Enhance detail and precision');
    expect(result.strategyIntent).toContain('resolution');
  });

  test('warmth gains → Deepen tonal richness', () => {
    const result = frameStrategy(makePath({
      tradeoff: makeTradeoff({ likelyGains: ['enhanced warmth and body'] }),
    }));

    expect(result.strategyLabel).toBe('Deepen tonal richness');
    expect(result.strategyIntent).toContain('warmth');
  });

  test('flow gains → Preserve musical flow', () => {
    const result = frameStrategy(makePath({
      tradeoff: makeTradeoff({ likelyGains: ['improved musical flow and continuity'] }),
    }));

    expect(result.strategyLabel).toBe('Preserve musical flow');
  });

  test('speed gains → Sharpen transient response', () => {
    const result = frameStrategy(makePath({
      tradeoff: makeTradeoff({ likelyGains: ['faster transient attack'] }),
    }));

    expect(result.strategyLabel).toBe('Sharpen transient response');
  });

  test('spatial gains → Expand spatial presentation', () => {
    const result = frameStrategy(makePath({
      tradeoff: makeTradeoff({ likelyGains: ['wider soundstage and imaging'] }),
    }));

    expect(result.strategyLabel).toBe('Expand spatial presentation');
  });

  test('dynamics gains → Increase dynamic authority', () => {
    const result = frameStrategy(makePath({
      tradeoff: makeTradeoff({ likelyGains: ['greater dynamics and punch'] }),
    }));

    expect(result.strategyLabel).toBe('Increase dynamic authority');
  });

  test('control gains → Strengthen system control', () => {
    const result = frameStrategy(makePath({
      tradeoff: makeTradeoff({ likelyGains: ['improved grip and control'] }),
    }));

    expect(result.strategyLabel).toBe('Strengthen system control');
  });

  test('first matching direction wins', () => {
    const result = frameStrategy(makePath({
      tradeoff: makeTradeoff({ likelyGains: ['clarity and warmth improvement'] }),
    }));

    // clarity keywords come before warmth in DIRECTION_KEYWORDS
    expect(result.strategyLabel).toBe('Enhance detail and precision');
  });
});

// ══════════════════════════════════════════════════════
// Group 4 — Structural fallback
// ══════════════════════════════════════════════════════

describe('structural fallback', () => {
  test('rebalancing label → Rebalance system character', () => {
    const result = frameStrategy(makePath({
      label: 'Character Rebalancing',
      tradeoff: makeTradeoff({ likelyGains: ['subtle improvement'] }),
    }));

    expect(result.strategyLabel).toBe('Rebalance system character');
  });

  test('refinement impact → Refine secondary balance', () => {
    const result = frameStrategy(makePath({
      impact: 'refinement',
      tradeoff: makeTradeoff({ likelyGains: ['subtle improvement'] }),
    }));

    expect(result.strategyLabel).toBe('Refine secondary balance');
  });

  test('no matching signals → Targeted component upgrade', () => {
    const result = frameStrategy(makePath({
      impact: 'moderate',
      tradeoff: makeTradeoff({ likelyGains: ['subtle improvement'] }),
    }));

    expect(result.strategyLabel).toBe('Targeted component upgrade');
    expect(result.strategyIntent).toContain('specific weakness');
  });

  test('no tradeoff at all → structural fallback', () => {
    const result = frameStrategy(makePath({
      impact: 'moderate',
    }));

    expect(result.strategyLabel).toBe('Targeted component upgrade');
  });
});

// ══════════════════════════════════════════════════════
// Group 5 — Deduplication
// ══════════════════════════════════════════════════════

describe('deduplicateStrategies', () => {
  test('unique labels → no change', () => {
    const paths = [
      { ...makePath({ label: 'DAC Upgrade' }), strategyLabel: 'Enhance detail and precision', strategyIntent: 'intent A' },
      { ...makePath({ label: 'Amp Upgrade' }), strategyLabel: 'Deepen tonal richness', strategyIntent: 'intent B' },
    ];

    deduplicateStrategies(paths);

    expect(paths[0].strategyLabel).toBe('Enhance detail and precision');
    expect(paths[1].strategyLabel).toBe('Deepen tonal richness');
  });

  test('duplicate labels → appends component role', () => {
    const paths = [
      { ...makePath({ label: 'DAC Upgrade' }), strategyLabel: 'Enhance detail and precision', strategyIntent: 'intent A' },
      { ...makePath({ label: 'Amp Upgrade' }), strategyLabel: 'Enhance detail and precision', strategyIntent: 'intent B' },
    ];

    deduplicateStrategies(paths);

    expect(paths[0].strategyLabel).toBe('Enhance detail and precision (DAC)');
    expect(paths[1].strategyLabel).toBe('Enhance detail and precision (Amp)');
  });

  test('trims Upgrade/Change/refinement from role suffix', () => {
    const paths = [
      { ...makePath({ label: 'Speaker Change' }), strategyLabel: 'Same label', strategyIntent: 'intent' },
      { ...makePath({ label: 'Cable refinement' }), strategyLabel: 'Same label', strategyIntent: 'intent' },
    ];

    deduplicateStrategies(paths);

    expect(paths[0].strategyLabel).toBe('Same label (Speaker)');
    expect(paths[1].strategyLabel).toBe('Same label (Cable)');
  });
});

// ══════════════════════════════════════════════════════
// Group 6 — Priority integration
// ══════════════════════════════════════════════════════

describe('priority order integration', () => {
  test('restraint > block > bottleneck > gains > structural', () => {
    // Restraint wins over everything
    const restraintPath = makePath({
      impact: 'highest',
      counterfactual: makeCounterfactual({ restraintRecommended: true, restraintReason: 'Hold.' }),
      protection: makeProtection({ verdict: 'block', reason: 'Block.' }),
      tradeoff: makeTradeoff({ likelyGains: ['improved clarity'] }),
    });
    expect(frameStrategy(restraintPath).strategyLabel).toContain('Hold — preserve');

    // Block wins when no restraint
    const blockPath = makePath({
      impact: 'highest',
      protection: makeProtection({ verdict: 'block', reason: 'Block.' }),
      tradeoff: makeTradeoff({ likelyGains: ['improved clarity'] }),
    });
    expect(frameStrategy(blockPath).strategyLabel).toContain('Hold — protect');

    // Bottleneck wins when no restraint/block
    const bottleneckPath = makePath({
      impact: 'highest',
      tradeoff: makeTradeoff({ likelyGains: ['improved clarity'] }),
    });
    expect(frameStrategy(bottleneckPath).strategyLabel).toBe('Resolve the primary bottleneck');

    // Gains win when no restraint/block/bottleneck
    const gainsPath = makePath({
      impact: 'moderate',
      tradeoff: makeTradeoff({ likelyGains: ['improved clarity'] }),
    });
    expect(frameStrategy(gainsPath).strategyLabel).toBe('Enhance detail and precision');
  });
});
