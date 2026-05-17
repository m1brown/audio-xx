/**
 * Listener Preferences — Stage PB2.3 tests.
 *
 * Covers the accumulation-aware behaviour introduced in PB2.3:
 *   - default profile shape
 *   - phrase → signal extraction
 *   - signal application direction and clamping
 *   - diminishing returns on repeated reinforcement of one dimension
 *   - confidence saturation capped at 0.85
 *   - summary rendering with uncertainty language
 */

import { describe, it, expect } from 'vitest';
import {
  createDefaultProfile,
  extractPreferenceSignals,
  applySignals,
  renderProfileSummary,
  buildListenerFraming,
  MAX_PROFILE_CONFIDENCE,
  type PreferenceSignal,
  type ListenerProfileDimension,
  type FramingContext,
} from '../listener-preferences';

// ── Helpers ──────────────────────────────────────────────

const DIMENSIONS: ListenerProfileDimension[] = [
  'warmth_vs_neutrality',
  'density_vs_clarity',
  'ease_vs_intensity',
  'flow_vs_precision',
  'intimacy_vs_scale',
  'smoothness_vs_attack',
  'fatigue_sensitivity',
  'novelty_vs_coherence',
  'analytical_vs_emotional',
  'immediacy_vs_relaxation',
];

function sig(
  dimension: ListenerProfileDimension,
  direction: number,
  phrase = 'test',
): PreferenceSignal {
  return { dimension, direction, phrase, confidence: 'moderate' };
}

// ── createDefaultProfile ─────────────────────────────────

describe('createDefaultProfile', () => {
  it('returns every dimension at 0.5 with confidence and signalCount at 0', () => {
    const p = createDefaultProfile();
    for (const d of DIMENSIONS) {
      expect(p[d]).toBe(0.5);
    }
    expect(p.confidence).toBe(0);
    expect(p.signalCount).toBe(0);
    expect(p.dimensionCounts).toEqual({});
    expect(typeof p.lastUpdated).toBe('string');
  });
});

// ── extractPreferenceSignals ─────────────────────────────

describe('extractPreferenceSignals', () => {
  it('returns an empty array for empty or whitespace input', () => {
    expect(extractPreferenceSignals('')).toEqual([]);
    expect(extractPreferenceSignals('   ')).toEqual([]);
  });

  it('finds the flow-and-timing signal in matching text', () => {
    const signals = extractPreferenceSignals('I love flow and timing in a system');
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.some((s) => s.dimension === 'flow_vs_precision' && s.direction < 0)).toBe(true);
  });

  it('finds fatigue-sensitivity from "detail fatigues me"', () => {
    const signals = extractPreferenceSignals('detail fatigues me after a while');
    expect(signals.some((s) => s.dimension === 'fatigue_sensitivity' && s.direction > 0)).toBe(true);
  });

  it('returns multiple signals when multiple phrases match', () => {
    const signals = extractPreferenceSignals(
      'I want body and warmth, and easier to listen to for hours',
    );
    const dims = new Set(signals.map((s) => s.dimension));
    expect(dims.size).toBeGreaterThanOrEqual(2);
  });
});

// ── applySignals: direction + clamping ───────────────────

describe('applySignals — direction and clamping', () => {
  it('moves a dimension in the requested direction', () => {
    const start = createDefaultProfile();
    const out = applySignals(start, [sig('warmth_vs_neutrality', -0.2)]);
    expect(out.warmth_vs_neutrality).toBeCloseTo(0.3, 5);

    const out2 = applySignals(start, [sig('density_vs_clarity', 0.15)]);
    expect(out2.density_vs_clarity).toBeCloseTo(0.65, 5);
  });

  it('clamps below 0 and above 1', () => {
    const start = createDefaultProfile();
    const huge = applySignals(start, [
      sig('warmth_vs_neutrality', -0.6),
      sig('warmth_vs_neutrality', -0.6),
    ]);
    expect(huge.warmth_vs_neutrality).toBe(0);

    const veryHigh = applySignals(start, [
      sig('density_vs_clarity', 0.6),
      sig('density_vs_clarity', 0.6),
    ]);
    expect(veryHigh.density_vs_clarity).toBe(1);
  });

  it('returns the same profile when no signals are provided', () => {
    const start = createDefaultProfile();
    const out = applySignals(start, []);
    expect(out).toBe(start);
  });
});

// ── Diminishing returns ──────────────────────────────────

describe('applySignals — diminishing returns', () => {
  it('halves direction once a dimension has already absorbed 3 signals', () => {
    // Start from a default profile, push 3 small signals in.
    // The 4th and subsequent signals on the same dimension must be halved.
    let p = createDefaultProfile();
    p = applySignals(p, [sig('warmth_vs_neutrality', 0.05)]); // 0.55, count 1
    p = applySignals(p, [sig('warmth_vs_neutrality', 0.05)]); // 0.60, count 2
    p = applySignals(p, [sig('warmth_vs_neutrality', 0.05)]); // 0.65, count 3
    const before4 = p.warmth_vs_neutrality;
    p = applySignals(p, [sig('warmth_vs_neutrality', 0.10)]); // count 4 → halved 0.05 → 0.70
    expect(p.warmth_vs_neutrality - before4).toBeCloseTo(0.05, 5);
    expect(p.dimensionCounts.warmth_vs_neutrality).toBe(4);

    // 5th signal: still halved.
    const before5 = p.warmth_vs_neutrality;
    p = applySignals(p, [sig('warmth_vs_neutrality', 0.10)]); // halved 0.05
    expect(p.warmth_vs_neutrality - before5).toBeCloseTo(0.05, 5);
  });

  it('does not halve unrelated dimensions when one is saturated', () => {
    let p = createDefaultProfile();
    for (let i = 0; i < 4; i++) {
      p = applySignals(p, [sig('warmth_vs_neutrality', 0.05)]);
    }
    const before = p.density_vs_clarity;
    p = applySignals(p, [sig('density_vs_clarity', 0.10)]);
    expect(p.density_vs_clarity - before).toBeCloseTo(0.10, 5);
  });
});

// ── Confidence cap ───────────────────────────────────────

describe('applySignals — confidence behavior', () => {
  it('increases confidence monotonically with signal count', () => {
    let p = createDefaultProfile();
    const history: number[] = [p.confidence];
    for (let i = 0; i < 6; i++) {
      p = applySignals(p, [sig('warmth_vs_neutrality', 0.01)]);
      history.push(p.confidence);
    }
    for (let i = 1; i < history.length; i++) {
      expect(history[i]).toBeGreaterThanOrEqual(history[i - 1]);
    }
  });

  it('caps confidence at MAX_PROFILE_CONFIDENCE (0.85)', () => {
    expect(MAX_PROFILE_CONFIDENCE).toBe(0.85);
    let p = createDefaultProfile();
    // 20 signals worth — formula would produce > 0.95 without the cap.
    const many: PreferenceSignal[] = Array.from({ length: 20 }, () =>
      sig('warmth_vs_neutrality', 0.001),
    );
    p = applySignals(p, many);
    expect(p.confidence).toBeLessThanOrEqual(MAX_PROFILE_CONFIDENCE);
    expect(p.confidence).toBeCloseTo(MAX_PROFILE_CONFIDENCE, 5);
  });
});

// ── renderProfileSummary ─────────────────────────────────

describe('renderProfileSummary', () => {
  it('returns an empty string for a default profile', () => {
    expect(renderProfileSummary(createDefaultProfile())).toBe('');
  });

  it('produces non-empty text for a profile with meaningful leans', () => {
    let p = createDefaultProfile();
    p = applySignals(p, [
      sig('warmth_vs_neutrality', -0.2),
      sig('density_vs_clarity', -0.2),
    ]);
    const out = renderProfileSummary(p);
    expect(out.length).toBeGreaterThan(0);
    expect(out).toMatch(/warmth|density/i);
  });

  it('uses uncertainty language (may / seems / appears / early signals)', () => {
    let p = createDefaultProfile();
    p = applySignals(p, [
      sig('warmth_vs_neutrality', -0.2),
      sig('flow_vs_precision', -0.2),
    ]);
    const lowConf = renderProfileSummary(p);
    expect(lowConf).toMatch(/\b(may|seems|appears|early signals)\b/i);

    // Push to high confidence — the higher stem must still hedge.
    let p2 = createDefaultProfile();
    for (let i = 0; i < 10; i++) {
      p2 = applySignals(p2, [
        sig('warmth_vs_neutrality', -0.05),
        sig('flow_vs_precision', -0.05),
      ]);
    }
    const highConf = renderProfileSummary(p2);
    expect(highConf).toMatch(/\b(may|seems|appears)\b/i);
  });

  it('emits a forming-signal note when signals exist but no dimension passes the threshold', () => {
    let p = createDefaultProfile();
    p = applySignals(p, [sig('warmth_vs_neutrality', 0.05)]); // tiny lean, < 0.15
    const out = renderProfileSummary(p);
    expect(out.length).toBeGreaterThan(0);
    expect(out).toMatch(/early signals|still forming|no clear/i);
  });
});

// ── PB2.4 — buildListenerFraming ─────────────────────────

/** Build a profile with a real lean and enough confidence to clear the
 *  framing floor (0.2). Six signals pushes confidence above 0.85, which
 *  the cap then trims to 0.85 — comfortably above the floor. */
function strongFlowAndDensityProfile() {
  let p = createDefaultProfile();
  p = applySignals(p, [
    sig('flow_vs_precision', -0.2),       // lean: flow
    sig('density_vs_clarity', -0.2),      // lean: density
    sig('warmth_vs_neutrality', -0.1),
    sig('warmth_vs_neutrality', -0.1),
    sig('analytical_vs_emotional', 0.1),
    sig('analytical_vs_emotional', 0.1),
  ]);
  return p;
}

const ALL_CONTEXTS: FramingContext[] = [
  'assessment', 'comparison', 'upgrade', 'diagnosis',
];

describe('buildListenerFraming — silence contract', () => {
  it('returns empty string for null and undefined profile', () => {
    for (const ctx of ALL_CONTEXTS) {
      expect(buildListenerFraming(null, ctx)).toBe('');
      expect(buildListenerFraming(undefined, ctx)).toBe('');
    }
  });

  it('returns empty string for a fully default profile', () => {
    const def = createDefaultProfile();
    for (const ctx of ALL_CONTEXTS) {
      expect(buildListenerFraming(def, ctx)).toBe('');
    }
  });

  it('returns empty string below the confidence floor (< 0.2)', () => {
    // One signal → confidence ~0.28, but the lean is small.
    // Use a single small signal that keeps confidence under 0.2.
    // A direction of 0.02 keeps the dimension well below the deviation
    // threshold, and one signal alone gives 1 - e^(-1/3) ≈ 0.28 — so we
    // need to construct a profile that has signalCount > 0 but
    // confidence < 0.2. The simplest way is to manually override the
    // confidence field.
    const p = { ...createDefaultProfile(), signalCount: 1, confidence: 0.1 };
    expect(buildListenerFraming(p, 'assessment')).toBe('');
  });

  it('returns empty string when no dimension passes the deviation threshold', () => {
    let p = createDefaultProfile();
    // Many tiny signals → high confidence but no real lean.
    for (let i = 0; i < 6; i++) {
      p = applySignals(p, [sig('warmth_vs_neutrality', 0.01)]);
    }
    expect(p.confidence).toBeGreaterThan(0.2);
    expect(Math.abs(p.warmth_vs_neutrality - 0.5)).toBeLessThan(0.15);
    expect(buildListenerFraming(p, 'comparison')).toBe('');
  });
});

describe('buildListenerFraming — text contract', () => {
  it('emits non-empty hedged text for a strong profile in every context', () => {
    const p = strongFlowAndDensityProfile();
    expect(p.confidence).toBeGreaterThan(0.2);
    for (const ctx of ALL_CONTEXTS) {
      const out = buildListenerFraming(p, ctx);
      expect(out.length).toBeGreaterThan(0);
      // Uncertainty language is mandatory.
      expect(out).toMatch(/\b(appears?|seems?|may|based on what you'?ve said)\b/i);
    }
  });

  it('mentions the strongest lean label', () => {
    const p = strongFlowAndDensityProfile();
    const out = buildListenerFraming(p, 'comparison');
    // Strongest leans are flow and density (both 0.3-ish from 0.5).
    expect(out).toMatch(/flow|density/i);
  });

  it('uses different phrasings for different contexts', () => {
    const p = strongFlowAndDensityProfile();
    const a = buildListenerFraming(p, 'assessment');
    const c = buildListenerFraming(p, 'comparison');
    const u = buildListenerFraming(p, 'upgrade');
    const d = buildListenerFraming(p, 'diagnosis');
    expect(new Set([a, c, u, d]).size).toBe(4);
  });

  it('avoids rigid archetype labels and absolute certainty', () => {
    const p = strongFlowAndDensityProfile();
    for (const ctx of ALL_CONTEXTS) {
      const out = buildListenerFraming(p, ctx);
      // No archetype names baked in.
      expect(out).not.toMatch(/\b(archetype|profile type|personality|category|class) is\b/i);
      // No absolute claims.
      expect(out).not.toMatch(/\b(definitely|certainly|always|never|guaranteed)\b/i);
    }
  });
});

