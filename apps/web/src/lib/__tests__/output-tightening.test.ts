/**
 * Feature 8 — Output Tightening / Final Advisory Quality Pass
 *
 * Tests the unified rationale rendering in mapUpgradePaths():
 * - strategyIntent suppression when tradeoff present
 * - strategyIntent used when tradeoff absent
 * - single caution signal via priority cascade
 * - block replaces entire rationale
 * - preservation note omitted when not meaningful
 * - worst-case path stays within 3-sentence max
 */

import { renderDeterministicMemo } from '../memo-deterministic-renderer';
import type { MemoFindings, UpgradePathFinding } from '../memo-findings';
import type { TradeoffAssessment } from '../tradeoff-assessment';
import type { PreferenceProtectionResult } from '../preference-protection';
import type { CounterfactualAssessment } from '../counterfactual-assessment';
import type { PrimaryAxisLeanings } from '../axis-mapping';

// ── Factories ────────────────────────────────────────

const NEUTRAL_AXES: PrimaryAxisLeanings = {
  warm_bright: 'neutral',
  smooth_detailed: 'neutral',
  elastic_controlled: 'neutral',
  scale_intimacy: 'neutral',
};

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

function makeUpgradePath(overrides: Partial<UpgradePathFinding> = {}): UpgradePathFinding {
  return {
    rank: 1,
    targetRole: 'DAC',
    impact: 'moderate',
    targetAxes: ['smooth_detailed'],
    options: [],
    ...overrides,
  };
}

function makeMinimalFindings(upgradePaths: UpgradePathFinding[]): MemoFindings {
  return {
    componentNames: ['TestDAC', 'TestAmp', 'TestSpeakers'],
    systemChain: { roles: ['DAC', 'Amplifier', 'Speakers'], names: ['TestDAC', 'TestAmp', 'TestSpeakers'] },
    systemAxes: NEUTRAL_AXES,
    perComponentAxes: [],
    stackedTraits: [],
    bottleneck: null,
    componentVerdicts: [],
    upgradePaths,
    keeps: [],
    recommendedSequence: [],
    isDeliberate: false,
    deliberatenessSignals: [],
    listenerPriorities: [],
    hasMultipleDACs: false,
    hasMultipleAmps: false,
    roleOverlaps: [],
    activeDACInference: { activeDACName: null, reason: 'none_detected', confidence: 'low' },
    powerMatchAssessment: { matched: true, estimatedMaxCleanSPL: null, relevantInteraction: null },
    sourceReferences: [],
  };
}

const MINIMAL_PROSE = {
  subject: 'Test System',
  systemCharacterOpening: '',
  componentParagraphs: [],
  systemInteraction: '',
  assessmentStrengths: '',
  assessmentLimitations: '',
  upgradeDirection: '',
  followUp: '',
  links: [],
};

/** Extract the first upgrade path rationale from a render result. */
function renderPathRationale(path: UpgradePathFinding): string {
  const findings = makeMinimalFindings([path]);
  const result = renderDeterministicMemo(findings, MINIMAL_PROSE);
  return result.upgradePaths?.[0]?.rationale ?? '';
}

/** Count sentences (split on '. ' or terminal period, excluding abbreviations). */
function countSentences(text: string): number {
  // Split on sentence-ending punctuation followed by space or end-of-string
  const sentences = text.split(/[.!?](?:\s|$)/).filter((s) => s.trim().length > 0);
  return sentences.length;
}

// ══════════════════════════════════════════════════════
// Group 1 — strategyIntent suppression
// ══════════════════════════════════════════════════════

describe('strategyIntent suppression', () => {
  test('strategyIntent is suppressed when tradeoff data exists', () => {
    const rationale = renderPathRationale(makeUpgradePath({
      strategyIntent: 'Optimize for resolution and transparency, trading some warmth.',
      tradeoff: makeTradeoff({ likelyGains: ['improved clarity'], likelySacrifices: ['warmth'] }),
    }));

    // strategyIntent text should NOT appear in the rationale
    expect(rationale).not.toContain('Optimize for resolution');
    // But tradeoff substance should be present
    expect(rationale).toContain('clarity');
  });

  test('strategyIntent is used when tradeoff is absent', () => {
    const rationale = renderPathRationale(makeUpgradePath({
      strategyIntent: 'Optimize for resolution and transparency.',
      tradeoff: undefined,
    }));

    expect(rationale).toContain('Optimize for resolution');
  });

  test('strategyIntent is used when tradeoff has empty gains and sacrifices', () => {
    const rationale = renderPathRationale(makeUpgradePath({
      strategyIntent: 'Optimize for resolution and transparency.',
      tradeoff: makeTradeoff({ likelyGains: [], likelySacrifices: [] }),
    }));

    expect(rationale).toContain('Optimize for resolution');
  });
});

// ══════════════════════════════════════════════════════
// Group 2 — Single caution signal
// ══════════════════════════════════════════════════════

describe('single caution signal', () => {
  test('restraint wins over protection caution, netNegative, and overcorrection', () => {
    const rationale = renderPathRationale(makeUpgradePath({
      tradeoff: makeTradeoff({ netNegative: true }),
      protection: makeProtection({ verdict: 'caution', reason: 'Watch for warmth tension.' }),
      counterfactual: makeCounterfactual({
        restraintRecommended: true,
        restraintReason: 'The trade-offs outweigh the likely gains.',
        overcorrectionRisk: { present: true, reason: 'May overcorrect warmth.' },
      }),
    }));

    // Restraint reason should appear
    expect(rationale).toContain('trade-offs outweigh the likely gains');
    // Others should NOT appear
    expect(rationale).not.toContain('Watch for warmth tension');
    expect(rationale).not.toContain('whether this change is necessary');
    expect(rationale).not.toContain('overcorrect warmth');
  });

  test('protection caution wins when no restraint', () => {
    const rationale = renderPathRationale(makeUpgradePath({
      tradeoff: makeTradeoff({ netNegative: true }),
      protection: makeProtection({ verdict: 'caution', reason: 'Watch for warmth tension.' }),
      counterfactual: makeCounterfactual({
        overcorrectionRisk: { present: true, reason: 'May overcorrect warmth.' },
      }),
    }));

    expect(rationale).toContain('Watch for warmth tension');
    expect(rationale).not.toContain('whether this change is necessary');
    expect(rationale).not.toContain('overcorrect warmth');
  });

  test('netNegative wins when no restraint or protection caution', () => {
    const rationale = renderPathRationale(makeUpgradePath({
      tradeoff: makeTradeoff({ netNegative: true }),
      counterfactual: makeCounterfactual({
        overcorrectionRisk: { present: true, reason: 'May overcorrect warmth.' },
      }),
    }));

    expect(rationale).toContain('whether this change is necessary');
    expect(rationale).not.toContain('overcorrect warmth');
  });

  test('overcorrection wins when no stronger signals', () => {
    const rationale = renderPathRationale(makeUpgradePath({
      tradeoff: makeTradeoff(),
      counterfactual: makeCounterfactual({
        overcorrectionRisk: { present: true, reason: 'May overcorrect existing warmth tendency.' },
      }),
    }));

    expect(rationale).toContain('overcorrect existing warmth');
  });

  test('stable baseline note appears when no other caution fires', () => {
    const rationale = renderPathRationale(makeUpgradePath({
      tradeoff: makeTradeoff(),
      counterfactual: makeCounterfactual({ baseline: 'stable' }),
    }));

    expect(rationale).toContain('current system balance is working');
  });

  test('no caution when no signals are present', () => {
    const rationale = renderPathRationale(makeUpgradePath({
      tradeoff: makeTradeoff(),
      counterfactual: makeCounterfactual({ baseline: 'degrading' }),
    }));

    // No caution language at all
    expect(rationale).not.toContain('whether this change');
    expect(rationale).not.toContain('overcorrect');
    expect(rationale).not.toContain('current system balance');
    expect(rationale).not.toContain('Tentatively');
  });
});

// ══════════════════════════════════════════════════════
// Group 3 — Block behavior
// ══════════════════════════════════════════════════════

describe('block replaces entire rationale', () => {
  test('block verdict suppresses tradeoff substance and strategyIntent', () => {
    const rationale = renderPathRationale(makeUpgradePath({
      strategyIntent: 'Optimize for resolution.',
      tradeoff: makeTradeoff({ likelyGains: ['improved clarity'] }),
      protection: makeProtection({
        verdict: 'block',
        reason: 'Would compromise warmth.',
        threats: [{ label: 'warmth', priority: 'tonal_warmth' as any, source: 'explicit' }],
      }),
    }));

    expect(rationale).toContain('Not recommended');
    expect(rationale).toContain('warmth');
    // Should NOT contain tradeoff or strategy intent
    expect(rationale).not.toContain('Optimize for resolution');
    expect(rationale).not.toContain('improved clarity');
  });
});

// ══════════════════════════════════════════════════════
// Group 4 — Preservation note
// ══════════════════════════════════════════════════════

describe('preservation note', () => {
  test('preservation note included when sacrifices exist and strength offsets them', () => {
    const rationale = renderPathRationale(makeUpgradePath({
      tradeoff: makeTradeoff({
        likelyGains: ['improved clarity'],
        likelySacrifices: ['warmth may decrease'],
        preservedStrengths: ['tonal density'],
      }),
    }));

    expect(rationale).toContain('Tonal density should remain intact');
  });

  test('preservation note omitted when no sacrifices stated', () => {
    const rationale = renderPathRationale(makeUpgradePath({
      tradeoff: makeTradeoff({
        likelyGains: ['improved clarity'],
        likelySacrifices: [],
        preservedStrengths: ['tonal density'],
      }),
    }));

    expect(rationale).not.toContain('remain intact');
    expect(rationale).not.toContain('tonal density');
  });
});

// ══════════════════════════════════════════════════════
// Group 5 — Sentence count / output limits
// ══════════════════════════════════════════════════════

describe('output limits', () => {
  test('worst-case path (tradeoff + sacrifice + preserve + caution) stays within 3 sentences', () => {
    const rationale = renderPathRationale(makeUpgradePath({
      strategyIntent: 'Optimize for resolution and transparency, trading some warmth.',
      tradeoff: makeTradeoff({
        likelyGains: ['improved clarity and resolution'],
        likelySacrifices: ['warmth and body'],
        preservedStrengths: ['tonal density'],
        netNegative: true,
      }),
      protection: makeProtection({ verdict: 'caution', reason: 'Watch for tension with warmth.' }),
      counterfactual: makeCounterfactual({
        restraintRecommended: true,
        restraintReason: 'The trade-offs outweigh the likely gains here.',
        overcorrectionRisk: { present: true, reason: 'May overcorrect warmth.' },
        baseline: 'stable',
      }),
    }));

    const sentences = countSentences(rationale);
    expect(sentences).toBeLessThanOrEqual(3);
  });

  test('minimal path (gains only, no sacrifice, no caution) renders 1 sentence', () => {
    const rationale = renderPathRationale(makeUpgradePath({
      tradeoff: makeTradeoff({
        likelyGains: ['improved clarity'],
        likelySacrifices: [],
        preservedStrengths: [],
      }),
      counterfactual: makeCounterfactual({ baseline: 'degrading' }),
    }));

    const sentences = countSentences(rationale);
    expect(sentences).toBe(1);
  });
});

// ══════════════════════════════════════════════════════
// Group 6 — Confidence handling
// ══════════════════════════════════════════════════════

describe('confidence handling', () => {
  test('"Tentatively:" prefix suppressed when tradeoff verb hedging is present', () => {
    const rationale = renderPathRationale(makeUpgradePath({
      tradeoff: makeTradeoff({ confidence: 'low' }),
      counterfactual: makeCounterfactual({
        confidence: 'low',
        overcorrectionRisk: { present: true, reason: 'May overcorrect warmth.' },
      }),
    }));

    // Low-confidence tradeoff uses "May improve" verb hedging
    expect(rationale).toContain('May improve');
    // Should NOT also prepend "Tentatively:"
    expect(rationale).not.toContain('Tentatively');
  });

  test('"Tentatively:" prefix used when no tradeoff exists and confidence is low', () => {
    const rationale = renderPathRationale(makeUpgradePath({
      tradeoff: undefined,
      strategyIntent: 'Improve clarity.',
      counterfactual: makeCounterfactual({
        confidence: 'low',
        overcorrectionRisk: { present: true, reason: 'May overcorrect warmth.' },
      }),
    }));

    expect(rationale).toContain('Tentatively');
  });
});

// ══════════════════════════════════════════════════════
// Group 7 — Unified voice (no template artifacts)
// ══════════════════════════════════════════════════════

describe('unified voice', () => {
  test('rationale does not start with "A {role} change"', () => {
    const rationale = renderPathRationale(makeUpgradePath({
      tradeoff: makeTradeoff({ likelyGains: ['improved clarity'], likelySacrifices: ['warmth'] }),
    }));

    expect(rationale).not.toMatch(/^A \w+ change/);
  });

  test('rationale does not contain "Preserve:" metadata dump', () => {
    const rationale = renderPathRationale(makeUpgradePath({
      tradeoff: makeTradeoff({
        likelyGains: ['improved clarity'],
        likelySacrifices: ['warmth'],
        preservedStrengths: ['tonal density'],
      }),
    }));

    expect(rationale).not.toContain('Preserve:');
  });
});
