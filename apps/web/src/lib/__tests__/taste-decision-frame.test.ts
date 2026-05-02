/**
 * Taste-based decision framing tests.
 *
 * Validates that comparison and recommendation responses include
 * listener-centered language that connects product traits to user priorities.
 */

import { describe, it, expect } from 'vitest';
import { buildTasteDecisionFrame } from '../consultation';
import { detectIntent } from '../intent';
import { buildConsultationResponse } from '../consultation';
import { detectShoppingIntent, buildShoppingAnswer } from '../shopping-intent';
import type { ExtractedSignals, SignalDirection } from '../signal-types';

// ── buildTasteDecisionFrame unit tests ────────────────

describe('buildTasteDecisionFrame', () => {
  it('returns null when no taste signals in query', () => {
    const result = buildTasteDecisionFrame(
      'Chord vs Denafrips',
      'Chord', 'precision and clarity', 'Chord DACs are precise, clean, transparent',
      'Denafrips', 'warmth and musicality', 'Denafrips DACs are warm, rich, musical',
    );
    // "Chord vs Denafrips" has no listener preference keywords
    expect(result).toBeNull();
  });

  it('detects warm preference and recommends the warm option', () => {
    const result = buildTasteDecisionFrame(
      'I value warmth and body — Chord vs Denafrips?',
      'Chord', 'precision and clarity', 'Chord DACs are precise, clean, transparent',
      'Denafrips', 'warmth and musicality', 'Denafrips DACs are warm, rich, musical, organic',
    );
    expect(result).not.toBeNull();
    expect(result).toContain('Denafrips');
    expect(result).toMatch(/priority|value|preference/i);
  });

  it('detects detail preference and recommends the precise option', () => {
    const result = buildTasteDecisionFrame(
      'which has more detail? KEF vs Harbeth',
      'KEF', 'detailed and controlled', 'KEF speakers are detailed, precise, controlled',
      'Harbeth', 'warm and natural', 'Harbeth speakers are warm, natural, musical',
    );
    expect(result).not.toBeNull();
    expect(result).toContain('KEF');
    expect(result).toMatch(/priority|value|preference|interest/i);
  });

  it('handles both sides aligning with the taste axis', () => {
    const result = buildTasteDecisionFrame(
      'I want something warm — Harbeth vs Spendor?',
      'Harbeth', 'warm and natural', 'Harbeth speakers are warm, natural, full',
      'Spendor', 'warm and smooth', 'Spendor speakers are warm, smooth, organic',
    );
    expect(result).not.toBeNull();
    // Should acknowledge both serve warmth
    expect(result).toMatch(/both/i);
  });

  it('detects rhythmic preference', () => {
    const result = buildTasteDecisionFrame(
      'I care about timing and rhythm — which has more drive?',
      'Naim', 'rhythmic and energetic', 'Naim amplifiers are rhythmic, driven, musical, timing',
      'Creek', 'neutral and balanced', 'Creek amplifiers are neutral, balanced, detailed',
    );
    expect(result).not.toBeNull();
    expect(result).toContain('Naim');
  });
});

// ── Brand comparison includes taste frame ─────────────

describe('Brand comparison taste framing', () => {
  it('"warm" query adds taste frame to Chord vs Denafrips', () => {
    const { subjectMatches } = detectIntent('I prefer warmth — Chord vs Denafrips');
    const response = buildConsultationResponse('I prefer warmth — Chord vs Denafrips', subjectMatches);
    expect(response).not.toBeNull();
    if (!response) return;
    expect(response.comparisonSummary).toBeDefined();
    const summary = response.comparisonSummary!;
    // Should contain listener-centered language (taste frame or resonance phrasing)
    expect(summary).toMatch(/priority|value|preference|what you.*most|resonates|which expression/i);
  });

  it('plain "KEF vs ELAC" gets a taste-oriented prompt', () => {
    const { subjectMatches } = detectIntent('KEF vs ELAC');
    const response = buildConsultationResponse('KEF vs ELAC', subjectMatches);
    expect(response).not.toBeNull();
    if (!response) return;
    const summary = response.comparisonSummary!;
    // Should contain taste injection language — either tie-breaker or provisional inference
    expect(summary).toMatch(/prioriti[sz]e|preference|your listening|your taste|what you want|keeps you listening|instinct|engagement|resonates/i);
  });
});

// ── Shopping recommendation taste framing ─────────────

describe('Shopping recommendation taste framing', () => {
  // Use trait keys that match TASTE_PROFILES check functions:
  // tonal_density + flow → tonal_saturated profile ("harmonic richness, flow, and tonal density")
  const WARM_SIGNALS: ExtractedSignals = {
    traits: {
      tonal_density: 'up' as SignalDirection,
      flow: 'up' as SignalDirection,
    } as Record<string, SignalDirection>,
    symptoms: ['too thin', 'lacks warmth'],
    archetype_hints: ['tonal_saturated'],
    uncertainty_level: 0,
    matched_phrases: ['I want warmth', 'more body'],
    matched_uncertainty_markers: [],
  };

  it('bestFitDirection includes listener-centered framing when taste signals exist', () => {
    const ctx = detectShoppingIntent('I want a warm DAC under $1000', WARM_SIGNALS, undefined);
    const answer = buildShoppingAnswer(ctx, WARM_SIGNALS);
    // bestFitDirection should include listener-centered or directed framing
    expect(answer.bestFitDirection).toMatch(/prioriti|direction|lean toward|warmth|tonal|trade.off/i);
  });

  it('whyThisFits includes taste-leading bullet when taste signals exist', () => {
    const ctx = detectShoppingIntent('I want a warm DAC under $1000', WARM_SIGNALS, undefined);
    const answer = buildShoppingAnswer(ctx, WARM_SIGNALS);
    // First whyThisFits bullet should reference listener preference / design selection
    expect(answer.whyThisFits[0]).toMatch(/lean into|your preference|what you value/i);
  });
});
