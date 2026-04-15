/**
 * Tests for Feature 3 — Preference Protection
 *
 * Tests classifyPriorities(), assessPreferenceProtection(), and the
 * verdict logic against the two-level priority model:
 *   explicit (from DesireSignal) → may trigger block
 *   inferred (from system axes)  → may trigger caution only
 */

import {
  classifyPriorities,
  assessPreferenceProtection,
  PRIORITY_KEYWORDS,
} from '../preference-protection';
import type {
  PreferenceProtectionResult,
  ClassifiedPriorities,
} from '../preference-protection';
import type { TradeoffAssessment } from '../tradeoff-assessment';
import type { PrimaryConstraint } from '../advisory-response';
import type { DesireSignal } from '../intent';
import type { ListenerPriority } from '../memo-findings';

// ── Test helpers ──────────────────────────────────────

function makeTradeoff(overrides: Partial<TradeoffAssessment> = {}): TradeoffAssessment {
  return {
    likelyGains: ['Improved balance'],
    likelySacrifices: ['some quality may be affected'],
    preservedStrengths: ['existing strengths'],
    magnitude: 'moderate',
    confidence: 'medium',
    confidenceReason: 'Test.',
    netNegative: false,
    source: 'structured_inference',
    ...overrides,
  };
}

function makeDesire(quality: string, direction: 'more' | 'less' = 'more'): DesireSignal {
  return { quality, direction, raw: `I want ${direction} ${quality}` };
}

function makeConstraint(category: PrimaryConstraint['category']): PrimaryConstraint {
  return {
    componentName: 'Test Component',
    category,
    explanation: 'Test constraint.',
  };
}

// ══════════════════════════════════════════════════════
// Group 1 — Priority classification
// ══════════════════════════════════════════════════════

describe('classifyPriorities', () => {
  test('desire "I want more detail" → transparency is explicit', () => {
    const priorities: ListenerPriority[] = ['transparency', 'transient_speed'];
    const desires: DesireSignal[] = [makeDesire('detail')];

    const result = classifyPriorities(priorities, desires);

    expect(result.explicit.has('transparency')).toBe(true);
    expect(result.inferred.has('transient_speed')).toBe(true);
  });

  test('desire "I want more flow" → musical_flow is explicit', () => {
    const priorities: ListenerPriority[] = ['musical_flow', 'tonal_warmth'];
    const desires: DesireSignal[] = [makeDesire('flow')];

    const result = classifyPriorities(priorities, desires);

    expect(result.explicit.has('musical_flow')).toBe(true);
    expect(result.inferred.has('tonal_warmth')).toBe(true);
  });

  test('no desires, warm system → all priorities are inferred', () => {
    const priorities: ListenerPriority[] = ['tonal_warmth', 'harmonic_richness'];

    const result = classifyPriorities(priorities, undefined);

    expect(result.explicit.size).toBe(0);
    expect(result.inferred.has('tonal_warmth')).toBe(true);
    expect(result.inferred.has('harmonic_richness')).toBe(true);
  });

  test('desire + matching axis priority → explicit takes precedence', () => {
    const priorities: ListenerPriority[] = ['tonal_warmth'];
    const desires: DesireSignal[] = [makeDesire('warmth')];

    const result = classifyPriorities(priorities, desires);

    expect(result.explicit.has('tonal_warmth')).toBe(true);
    expect(result.inferred.has('tonal_warmth')).toBe(false);
  });
});

// ══════════════════════════════════════════════════════
// Group 2 — Threat detection from sacrifice text
// ══════════════════════════════════════════════════════

describe('threat detection from sacrifices', () => {
  test('sacrifice with "warmth" + explicit tonal_warmth → explicit threat', () => {
    const classified: ClassifiedPriorities = {
      explicit: new Set(['tonal_warmth'] as ListenerPriority[]),
      inferred: new Set<ListenerPriority>(),
    };
    const tradeoff = makeTradeoff({
      likelySacrifices: ['tonal warmth and harmonic richness may be reduced'],
    });

    const result = assessPreferenceProtection(
      tradeoff, classified, 'moderate', undefined, [],
    );

    expect(result.threats.length).toBeGreaterThanOrEqual(1);
    expect(result.threats[0].basis).toBe('explicit');
    expect(result.threats[0].priority).toBe('tonal_warmth');
  });

  test('sacrifice with "precision" + inferred control_precision → inferred threat', () => {
    const classified: ClassifiedPriorities = {
      explicit: new Set<ListenerPriority>(),
      inferred: new Set(['control_precision'] as ListenerPriority[]),
    };
    const tradeoff = makeTradeoff({
      likelySacrifices: ['precision and grip may decrease'],
    });

    const result = assessPreferenceProtection(
      tradeoff, classified, 'moderate', undefined, [],
    );

    expect(result.threats.length).toBeGreaterThanOrEqual(1);
    expect(result.threats[0].basis).toBe('inferred');
    expect(result.inferredAtRisk).toBe(true);
    expect(result.explicitAtRisk).toBe(false);
  });

  test('sacrifice "bass extension" does NOT match tonal_warmth', () => {
    const classified: ClassifiedPriorities = {
      explicit: new Set(['tonal_warmth'] as ListenerPriority[]),
      inferred: new Set<ListenerPriority>(),
    };
    const tradeoff = makeTradeoff({
      likelySacrifices: ['bass extension may be limited'],
    });

    const result = assessPreferenceProtection(
      tradeoff, classified, 'moderate', undefined, [],
    );

    expect(result.threats.length).toBe(0);
    expect(result.verdict).toBe('safe');
  });

  test('sacrifice "transparency and detail retrieval" + explicit transparency → threat', () => {
    const classified: ClassifiedPriorities = {
      explicit: new Set(['transparency'] as ListenerPriority[]),
      inferred: new Set<ListenerPriority>(),
    };
    const tradeoff = makeTradeoff({
      likelySacrifices: ['transparency and detail retrieval may be reduced'],
    });

    const result = assessPreferenceProtection(
      tradeoff, classified, 'moderate', undefined, [],
    );

    expect(result.threats.length).toBeGreaterThanOrEqual(1);
    expect(result.explicitAtRisk).toBe(true);
  });

  test('empty sacrifice + explicit priority → no threat from sacrifice text', () => {
    const classified: ClassifiedPriorities = {
      explicit: new Set(['tonal_warmth'] as ListenerPriority[]),
      inferred: new Set<ListenerPriority>(),
    };
    const tradeoff = makeTradeoff({ likelySacrifices: [] });

    // No target axes → no axis fallback either
    const result = assessPreferenceProtection(
      tradeoff, classified, 'moderate', undefined, [],
    );

    expect(result.threats.length).toBe(0);
    expect(result.verdict).toBe('safe');
  });

  test('"transient speed" matches transient_speed, but "speed" alone does not', () => {
    const classified: ClassifiedPriorities = {
      explicit: new Set(['transient_speed'] as ListenerPriority[]),
      inferred: new Set<ListenerPriority>(),
    };

    // "transient speed" should match
    const tradeoff1 = makeTradeoff({
      likelySacrifices: ['transient speed may be reduced'],
    });
    const result1 = assessPreferenceProtection(
      tradeoff1, classified, 'moderate', undefined, [],
    );
    expect(result1.threats.length).toBe(1);

    // "speed" alone should NOT match transient_speed keywords
    const tradeoff2 = makeTradeoff({
      likelySacrifices: ['speed of delivery may change'],
    });
    const result2 = assessPreferenceProtection(
      tradeoff2, classified, 'moderate', undefined, [],
    );
    expect(result2.threats.length).toBe(0);
  });
});

// ══════════════════════════════════════════════════════
// Group 3 — Verdict logic
// ══════════════════════════════════════════════════════

describe('verdict logic', () => {
  test('explicit threat, medium confidence, moderate path, no constraint → block', () => {
    const classified: ClassifiedPriorities = {
      explicit: new Set(['transparency'] as ListenerPriority[]),
      inferred: new Set<ListenerPriority>(),
    };
    const tradeoff = makeTradeoff({
      likelySacrifices: ['transparency and resolution will decrease'],
      confidence: 'medium',
    });

    const result = assessPreferenceProtection(
      tradeoff, classified, 'moderate', undefined, [],
    );

    expect(result.verdict).toBe('block');
    expect(result.explicitAtRisk).toBe(true);
  });

  test('explicit threat, low confidence → caution (weak evidence)', () => {
    const classified: ClassifiedPriorities = {
      explicit: new Set(['transparency'] as ListenerPriority[]),
      inferred: new Set<ListenerPriority>(),
    };
    const tradeoff = makeTradeoff({
      likelySacrifices: ['transparency may be affected'],
      confidence: 'low',
    });

    const result = assessPreferenceProtection(
      tradeoff, classified, 'moderate', undefined, [],
    );

    expect(result.verdict).toBe('caution');
  });

  test('explicit threat, highest impact path → caution (bottleneck override)', () => {
    const classified: ClassifiedPriorities = {
      explicit: new Set(['tonal_warmth'] as ListenerPriority[]),
      inferred: new Set<ListenerPriority>(),
    };
    const tradeoff = makeTradeoff({
      likelySacrifices: ['warmth may be reduced'],
      confidence: 'high',
    });

    const result = assessPreferenceProtection(
      tradeoff, classified, 'highest', undefined, [],
    );

    expect(result.verdict).toBe('caution');
  });

  test('explicit threat, power_match constraint → caution (hard constraint)', () => {
    const classified: ClassifiedPriorities = {
      explicit: new Set(['tonal_warmth'] as ListenerPriority[]),
      inferred: new Set<ListenerPriority>(),
    };
    const tradeoff = makeTradeoff({
      likelySacrifices: ['warmth may be reduced'],
      confidence: 'high',
    });

    const result = assessPreferenceProtection(
      tradeoff, classified, 'highest', makeConstraint('power_match'), [],
    );

    expect(result.verdict).toBe('caution');
    expect(result.overriddenByConstraint).toBe(true);
  });

  test('inferred threat only → caution (never block)', () => {
    const classified: ClassifiedPriorities = {
      explicit: new Set<ListenerPriority>(),
      inferred: new Set(['control_precision'] as ListenerPriority[]),
    };
    const tradeoff = makeTradeoff({
      likelySacrifices: ['control and precision may shift'],
      confidence: 'high',
    });

    const result = assessPreferenceProtection(
      tradeoff, classified, 'moderate', undefined, [],
    );

    expect(result.verdict).toBe('caution');
    expect(result.inferredAtRisk).toBe(true);
    expect(result.explicitAtRisk).toBe(false);
  });

  test('no threats → safe', () => {
    const classified: ClassifiedPriorities = {
      explicit: new Set(['tonal_warmth'] as ListenerPriority[]),
      inferred: new Set<ListenerPriority>(),
    };
    const tradeoff = makeTradeoff({
      likelySacrifices: ['bass extension may decrease'],
    });

    const result = assessPreferenceProtection(
      tradeoff, classified, 'moderate', undefined, [],
    );

    expect(result.verdict).toBe('safe');
  });

  test('explicit threat, high confidence, refinement path → block', () => {
    const classified: ClassifiedPriorities = {
      explicit: new Set(['musical_flow'] as ListenerPriority[]),
      inferred: new Set<ListenerPriority>(),
    };
    const tradeoff = makeTradeoff({
      likelySacrifices: ['musical flow and continuity may decrease'],
      confidence: 'high',
    });

    const result = assessPreferenceProtection(
      tradeoff, classified, 'refinement', undefined, [],
    );

    expect(result.verdict).toBe('block');
  });

  test('explicit threat, medium confidence, highest + non-hard constraint → caution', () => {
    const classified: ClassifiedPriorities = {
      explicit: new Set(['transparency'] as ListenerPriority[]),
      inferred: new Set<ListenerPriority>(),
    };
    const tradeoff = makeTradeoff({
      likelySacrifices: ['transparency may be reduced'],
      confidence: 'medium',
    });

    // highest impact prevents block regardless of constraint category
    const result = assessPreferenceProtection(
      tradeoff, classified, 'highest', makeConstraint('dac_limitation'), [],
    );

    expect(result.verdict).toBe('caution');
  });
});

// ══════════════════════════════════════════════════════
// Group 4 — Empty sacrifice fallback (axis opposition)
// ══════════════════════════════════════════════════════

describe('axis-opposition fallback', () => {
  test('empty sacrifices + explicit tonal_warmth + warm_bright axis → caution', () => {
    const classified: ClassifiedPriorities = {
      explicit: new Set(['tonal_warmth'] as ListenerPriority[]),
      inferred: new Set<ListenerPriority>(),
    };
    const tradeoff = makeTradeoff({ likelySacrifices: [] });

    const result = assessPreferenceProtection(
      tradeoff, classified, 'moderate', undefined, ['warm_bright'],
    );

    expect(result.threats.length).toBeGreaterThanOrEqual(1);
    expect(result.threats[0].basis).toBe('explicit');
    // Should be caution, not block (axis fallback = weak evidence)
    expect(result.verdict).toBe('caution');
  });

  test('empty sacrifices + inferred priority + axis opposition → safe (v1: explicit only)', () => {
    const classified: ClassifiedPriorities = {
      explicit: new Set<ListenerPriority>(),
      inferred: new Set(['tonal_warmth'] as ListenerPriority[]),
    };
    const tradeoff = makeTradeoff({ likelySacrifices: [] });

    const result = assessPreferenceProtection(
      tradeoff, classified, 'moderate', undefined, ['warm_bright'],
    );

    // v1: axis fallback only fires for explicit priorities
    expect(result.threats.length).toBe(0);
    expect(result.verdict).toBe('safe');
  });

  test('empty sacrifices + no axis opposition → safe', () => {
    const classified: ClassifiedPriorities = {
      explicit: new Set(['tonal_warmth'] as ListenerPriority[]),
      inferred: new Set<ListenerPriority>(),
    };
    const tradeoff = makeTradeoff({ likelySacrifices: [] });

    // airy_closed doesn't have tonal_warmth in its alignment
    const result = assessPreferenceProtection(
      tradeoff, classified, 'moderate', undefined, ['airy_closed'],
    );

    expect(result.threats.length).toBe(0);
    expect(result.verdict).toBe('safe');
  });
});

// ══════════════════════════════════════════════════════
// Group 5 — Integration smoke tests
// ══════════════════════════════════════════════════════

describe('integration smoke tests', () => {
  test('user said "more flow", sacrifice does not threaten flow → safe', () => {
    const priorities: ListenerPriority[] = ['musical_flow', 'tonal_warmth', 'fatigue_resistance'];
    const desires: DesireSignal[] = [makeDesire('flow')];
    const classified = classifyPriorities(priorities, desires);

    const tradeoff = makeTradeoff({
      likelySacrifices: ['bass extension may decrease'],
      confidence: 'medium',
    });

    const result = assessPreferenceProtection(
      tradeoff, classified, 'highest', undefined, [],
    );

    expect(result.verdict).toBe('safe');
  });

  test('user said "more detail", sacrifice threatens transparency → block on moderate path', () => {
    const priorities: ListenerPriority[] = ['transparency', 'transient_speed', 'control_precision'];
    const desires: DesireSignal[] = [makeDesire('detail')];
    const classified = classifyPriorities(priorities, desires);

    const tradeoff = makeTradeoff({
      likelySacrifices: ['transparency and detail retrieval may be reduced'],
      confidence: 'high',
    });

    const result = assessPreferenceProtection(
      tradeoff, classified, 'moderate', undefined, [],
    );

    expect(result.verdict).toBe('block');
    expect(result.explicitAtRisk).toBe(true);
    expect(result.reason).toContain('transparency');
  });
});
