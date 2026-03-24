/**
 * Tests for the "Start Here" preference capture entry point.
 *
 * Validates:
 *   Case 1: "I want speakers" → generic output, lowPreferenceSignal = true
 *   Case 2: Preference capture selections map to correct traits
 *   Case 3: Re-run with captured preferences → updated output reflects taste
 *   Case 4: "I want warm, rich sound" → lowPreferenceSignal = false
 */
import { describe, it, expect } from 'vitest';
import { detectShoppingIntent, buildShoppingAnswer, getStatedGaps } from '../shopping-intent';
import { shoppingToAdvisory } from '../advisory-response';
import type { ExtractedSignals, SignalDirection } from '../signal-types';

// ── Helpers ───────────────────────────────────────────

function emptySignals(): ExtractedSignals {
  return {
    traits: {} as Record<string, SignalDirection>,
    symptoms: [],
    archetype_hints: [],
    uncertainty_level: 0,
    matched_phrases: [],
    matched_uncertainty_markers: [],
  };
}

// ── Case 1: Generic input → lowPreferenceSignal = true ──

describe('Case 1: Generic shopping input shows START HERE', () => {
  it('"I want speakers" → lowPreferenceSignal is true', () => {
    const signals = emptySignals();
    const ctx = detectShoppingIntent('I want speakers under $2000', signals, undefined);
    const answer = buildShoppingAnswer(ctx, signals);
    const advisory = shoppingToAdvisory(answer, signals);

    expect(advisory.lowPreferenceSignal).toBe(true);
    expect(advisory.shoppingCategory).toBeDefined();
  });

  it('"I want a DAC" → lowPreferenceSignal is true (no taste signal)', () => {
    const signals = emptySignals();
    const ctx = detectShoppingIntent('I want a DAC under $1000', signals, undefined);
    const answer = buildShoppingAnswer(ctx, signals);
    const advisory = shoppingToAdvisory(answer, signals);

    expect(advisory.lowPreferenceSignal).toBe(true);
  });

  it('no system question in response (no system gating)', () => {
    const signals = emptySignals();
    const ctx = detectShoppingIntent('I want speakers under $2000', signals, undefined);
    const gaps = getStatedGaps(ctx, signals);

    // System should NOT be a gap for fresh shopping (no systemProvided)
    expect(gaps).not.toContain('system');
    // Taste SHOULD be a gap
    expect(gaps).toContain('taste');
  });
});

// ── Case 2: Preference capture maps to correct traits ──

describe('Case 2: Preference selections produce correct trait signals', () => {
  it('warm/rich + relaxed/smooth → tonal_density, flow, composure', () => {
    // Simulates the mapping from handlePreferenceCapture
    const traits: Record<string, SignalDirection> = {};

    // Tonal: warm/rich (choice 'a')
    traits.tonal_density = 'up';
    traits.flow = 'up';

    // Energy: relaxed/smooth (choice 'a')
    traits.composure = 'up';

    const signals: ExtractedSignals = {
      traits,
      symptoms: [],
      archetype_hints: [],
      uncertainty_level: 0,
      matched_phrases: ['warmth and tonal richness', 'natural, organic presentation'],
      matched_uncertainty_markers: [],
    };

    const ctx = detectShoppingIntent('I want speakers — I prefer warmth and tonal richness, natural, organic presentation', signals, undefined);
    const answer = buildShoppingAnswer(ctx, signals);

    // Should have matched a taste profile (tonal_density + flow = tonal_saturated)
    expect(answer.preferenceSummary).not.toContain('balanced');
  });

  it('clean/detailed + fast/dynamic → clarity, dynamics, elasticity', () => {
    const traits: Record<string, SignalDirection> = {};

    // Tonal: clean/detailed (choice 'b')
    traits.clarity = 'up';

    // Energy: fast/dynamic (choice 'b')
    traits.dynamics = 'up';
    traits.elasticity = 'up';

    const signals: ExtractedSignals = {
      traits,
      symptoms: [],
      archetype_hints: [],
      uncertainty_level: 0,
      matched_phrases: ['detail and precision', 'dynamics and impact'],
      matched_uncertainty_markers: [],
    };

    const ctx = detectShoppingIntent('I want a DAC — I prefer detail and precision, dynamics and impact', signals, undefined);
    const answer = buildShoppingAnswer(ctx, signals);

    // Should have matched a taste profile (not balanced)
    expect(answer.preferenceSummary).not.toContain('balanced');
  });
});

// ── Case 3: Re-run with captured preferences → updated output ──

describe('Case 3: Re-run after preference capture improves output', () => {
  it('preferences produce lowPreferenceSignal = false on re-run', () => {
    // First run: no preferences
    const emptyCtx = detectShoppingIntent('I want speakers under $2000', emptySignals(), undefined);
    const emptyAnswer = buildShoppingAnswer(emptyCtx, emptySignals());
    const emptyAdvisory = shoppingToAdvisory(emptyAnswer, emptySignals());
    expect(emptyAdvisory.lowPreferenceSignal).toBe(true);

    // Second run: with captured preferences (tonal_density + flow)
    const capturedSignals: ExtractedSignals = {
      traits: {
        tonal_density: 'up' as SignalDirection,
        flow: 'up' as SignalDirection,
      },
      symptoms: [],
      archetype_hints: [],
      uncertainty_level: 0,
      matched_phrases: ['warmth and tonal richness'],
      matched_uncertainty_markers: [],
    };

    const capturedCtx = detectShoppingIntent('I want speakers — I prefer warmth and tonal richness', capturedSignals, undefined);
    const capturedAnswer = buildShoppingAnswer(capturedCtx, capturedSignals);
    const capturedAdvisory = shoppingToAdvisory(capturedAnswer, capturedSignals);

    // After preferences: should no longer show START HERE
    expect(capturedAdvisory.lowPreferenceSignal).toBe(false);
  });

  it('re-run with preferences produces personalized direction', () => {
    const signals: ExtractedSignals = {
      traits: {
        tonal_density: 'up' as SignalDirection,
        flow: 'up' as SignalDirection,
      },
      symptoms: [],
      archetype_hints: [],
      uncertainty_level: 0,
      matched_phrases: ['warmth and tonal richness'],
      matched_uncertainty_markers: [],
    };

    const ctx = detectShoppingIntent('I want speakers under $2000 — I prefer warmth and tonal richness', signals, undefined);
    const answer = buildShoppingAnswer(ctx, signals);

    // Direction should be personalized, not generic
    expect(answer.bestFitDirection).toMatch(/preference|harmonic|tonal|density|richness/i);
  });
});

// ── Case 4: Strong preference → no START HERE ──

describe('Case 4: Strong preference suppresses START HERE', () => {
  it('"I want warm, rich speakers" → lowPreferenceSignal = false', () => {
    // Signals with tonal_density + flow traits (warm preference)
    const signals: ExtractedSignals = {
      traits: {
        tonal_density: 'up' as SignalDirection,
        flow: 'up' as SignalDirection,
      },
      symptoms: ['lacks warmth'],
      archetype_hints: ['tonal_saturated'],
      uncertainty_level: 0,
      matched_phrases: ['warm', 'rich'],
      matched_uncertainty_markers: [],
    };

    const ctx = detectShoppingIntent('I want warm, rich speakers under $2000', signals, undefined);
    const answer = buildShoppingAnswer(ctx, signals);
    const advisory = shoppingToAdvisory(answer, signals);

    expect(advisory.lowPreferenceSignal).toBe(false);
  });

  it('"I prefer detail and precision in a DAC" → lowPreferenceSignal = false', () => {
    const signals: ExtractedSignals = {
      traits: {
        clarity: 'up' as SignalDirection,
      },
      symptoms: [],
      archetype_hints: ['precision_explicit'],
      uncertainty_level: 0,
      matched_phrases: ['detail', 'precision'],
      matched_uncertainty_markers: [],
    };

    const ctx = detectShoppingIntent('I prefer detail and precision in a DAC under $1000', signals, undefined);
    const answer = buildShoppingAnswer(ctx, signals);
    const advisory = shoppingToAdvisory(answer, signals);

    expect(advisory.lowPreferenceSignal).toBe(false);
  });

  it('strong preference: no taste gap in statedGaps', () => {
    const signals: ExtractedSignals = {
      traits: {
        dynamics: 'up' as SignalDirection,
        elasticity: 'up' as SignalDirection,
      },
      symptoms: [],
      archetype_hints: [],
      uncertainty_level: 0,
      matched_phrases: ['fast', 'dynamic'],
      matched_uncertainty_markers: [],
    };

    const ctx = detectShoppingIntent('I want fast, dynamic speakers under $3000', signals, undefined);
    const gaps = getStatedGaps(ctx, signals);

    expect(gaps).not.toContain('taste');
  });
});
