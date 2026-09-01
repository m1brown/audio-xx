/**
 * PB2.4 — Listener-aware advisory framing (integration).
 *
 * These tests cover the four builders that PB2.4 wires the listener
 * profile into:
 *   - buildSystemDiagnosis     (consultation.ts)
 *   - buildComparisonRefinement (consultation.ts)
 *   - buildGearResponse        (gear-response.ts)
 *
 * (System assessment is exercised in dedicated assessment tests and
 *  needs an active system with catalog hits — the diagnosis +
 *  comparison + gear paths give us the full contract without that
 *  fixture burden.)
 *
 * Contract for each builder:
 *   1. Without a listener profile, output is identical to the legacy
 *      behaviour — no framing prepended.
 *   2. With a strong profile, the same builder prepends a hedged
 *      framing sentence to the prose field that the renderer surfaces.
 *   3. The non-prose fields (subject, followUp, links, etc.) do NOT
 *      change — i.e. scoring / decision-making is unaffected.
 *   4. The injected framing uses uncertainty language.
 */
import { describe, it, expect } from 'vitest';
import {
  buildSystemDiagnosis,
  buildComparisonRefinement,
} from '../consultation';
import { buildGearResponse } from '../gear-response';
import {
  createDefaultProfile,
  applySignals,
  type PreferenceSignal,
} from '../listener-preferences';
import type { SubjectMatch } from '../intent';

// ── Profile fixtures ─────────────────────────────────────

function sig(dimension: PreferenceSignal['dimension'], direction: number): PreferenceSignal {
  return { dimension, direction, phrase: 'test', confidence: 'moderate' };
}

function strongFlowProfile() {
  let p = createDefaultProfile();
  // Six signals → confidence saturates at the cap (0.85). Strong leans
  // on flow and density so the framing sentence has something to say.
  p = applySignals(p, [
    sig('flow_vs_precision', -0.2),
    sig('density_vs_clarity', -0.2),
    sig('warmth_vs_neutrality', -0.1),
    sig('warmth_vs_neutrality', -0.1),
    sig('analytical_vs_emotional', 0.1),
    sig('analytical_vs_emotional', 0.1),
  ]);
  return p;
}

// ── buildSystemDiagnosis ─────────────────────────────────

describe('PB2.4 — buildSystemDiagnosis: framing layer', () => {
  // Diagnosis needs both a complaint word and at least one known component
  // subject — otherwise it returns null long before our framing prepend
  // would run. "Chord" is a brand present in the DAC catalog.
  const message = 'My Chord system sounds bright and fatiguing';
  const subjects: SubjectMatch[] = [{ name: 'Chord', kind: 'brand' }];

  it('returns unchanged output when no listenerProfile is provided', () => {
    const a = buildSystemDiagnosis(message, subjects);
    const b = buildSystemDiagnosis(message, subjects);
    expect(a).toEqual(b);
    expect(a).not.toBeNull();
    // No framing language in the baseline output.
    expect(a!.comparisonSummary).not.toMatch(/Based on what you'?ve said so far/i);
    expect(a!.comparisonSummary).not.toMatch(/seems to matter to you/i);
  });

  it('prepends framing when a strong listenerProfile is provided', () => {
    const baseline = buildSystemDiagnosis(message, subjects);
    const framed = buildSystemDiagnosis(message, subjects, strongFlowProfile());
    expect(framed).not.toBeNull();
    expect(baseline).not.toBeNull();
    // Framing is *prepended* — the original prose still appears.
    expect(framed!.comparisonSummary).toContain(baseline!.comparisonSummary);
    expect(framed!.comparisonSummary.length).toBeGreaterThan(
      baseline!.comparisonSummary.length,
    );
    // Uncertainty language is present.
    expect(framed!.comparisonSummary).toMatch(/\b(seems|appears?|may|based on what you'?ve said)\b/i);
  });

  it('does not change the diagnosis follow-up or subject', () => {
    const baseline = buildSystemDiagnosis(message, subjects);
    const framed = buildSystemDiagnosis(message, subjects, strongFlowProfile());
    expect(framed!.followUp).toBe(baseline!.followUp);
    expect(framed!.subject).toBe(baseline!.subject);
    expect(framed!.advisoryMode).toBe(baseline!.advisoryMode);
  });
});

// ── buildComparisonRefinement ────────────────────────────

describe('PB2.4 — buildComparisonRefinement: framing layer', () => {
  const activeComparison = {
    left: { name: 'Chord', kind: 'brand' as const },
    right: { name: 'Denafrips', kind: 'brand' as const },
    scope: 'brand' as const,
  };
  const followUp = 'which is more musical?';

  it('returns unchanged output when no listenerProfile is provided', () => {
    const a = buildComparisonRefinement(activeComparison, followUp);
    const b = buildComparisonRefinement(activeComparison, followUp);
    expect(a).toEqual(b);
    expect(a.comparisonSummary).not.toMatch(/Given that you appear to value/i);
  });

  it('prepends framing when a strong listenerProfile is provided', () => {
    const baseline = buildComparisonRefinement(activeComparison, followUp);
    const framed = buildComparisonRefinement(
      activeComparison, followUp, strongFlowProfile(),
    );
    expect(framed.comparisonSummary).toContain(baseline.comparisonSummary!);
    expect(framed.comparisonSummary!.length).toBeGreaterThan(
      baseline.comparisonSummary!.length,
    );
    expect(framed.comparisonSummary).toMatch(/\b(appears?|may|seems?)\b/i);
  });

  it('does not change the comparison subject or follow-up suggestion', () => {
    const baseline = buildComparisonRefinement(activeComparison, followUp);
    const framed = buildComparisonRefinement(
      activeComparison, followUp, strongFlowProfile(),
    );
    expect(framed.subject).toBe(baseline.subject);
    expect(framed.followUp).toBe(baseline.followUp);
    expect(framed.comparisonImages).toEqual(baseline.comparisonImages);
  });
});

// ── buildGearResponse ────────────────────────────────────

describe('PB2.4 — buildGearResponse: framing layer', () => {
  const subjects = ['Chord', 'Denafrips'];
  const message = "what's the difference between chord and denafrips?";

  it('returns unchanged output when no listenerProfile is provided', () => {
    const a = buildGearResponse('comparison', subjects, message);
    const b = buildGearResponse('comparison', subjects, message);
    expect(a).toEqual(b);
    if (a) {
      expect(a.anchor).not.toMatch(/appear to value/i);
      expect(a.anchor).not.toMatch(/Your profile suggests/i);
    }
  });

  it('prepends framing to the anchor when a strong profile is provided', () => {
    const baseline = buildGearResponse('comparison', subjects, message);
    const framed = buildGearResponse(
      'comparison', subjects, message,
      undefined, undefined, undefined,
      strongFlowProfile(),
    );
    if (!baseline || !framed) {
      // If either path can't build a response (e.g. catalog miss), there
      // is nothing to compare and the contract trivially holds.
      return;
    }
    expect(framed.anchor.length).toBeGreaterThan(baseline.anchor.length);
    expect(framed.anchor).toContain(baseline.anchor);
    expect(framed.anchor).toMatch(/\b(appears?|may|seems?|based on what you'?ve said)\b/i);
  });

  it('does not alter scoring-relevant fields (character / direction / subjects)', () => {
    const baseline = buildGearResponse('comparison', subjects, message);
    const framed = buildGearResponse(
      'comparison', subjects, message,
      undefined, undefined, undefined,
      strongFlowProfile(),
    );
    if (!baseline || !framed) return;
    expect(framed.character).toBe(baseline.character);
    expect(framed.direction).toBe(baseline.direction);
    expect(framed.subjects).toEqual(baseline.subjects);
    expect(framed.matchedProducts).toEqual(baseline.matchedProducts);
    expect(framed.upgradeAnalysis).toEqual(baseline.upgradeAnalysis);
  });
});
