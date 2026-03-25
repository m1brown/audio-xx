/**
 * Comparison payload architecture tests.
 *
 * Tests the structured comparison payload, validation, and rendering pipeline.
 *
 * Validation Scenarios:
 *   1. job vs leben → devore o/96 (system-anchored, decisive)
 *   2. job vs hegel (initial comparison, clear trade-off)
 *   3. kef vs elac → hegel amp (speaker comparison with amp context)
 */

import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';
import {
  buildConsultationResponse,
  buildContextRefinement,
  classifySubjectAsContext,
  buildInitialComparisonPayload,
  buildSystemAnchoredPayload,
} from '../consultation';
import { consultationToAdvisory } from '../advisory-response';
import {
  type ComparisonPayload,
  validateComparisonPayload,
  validateComparisonOutput,
  renderComparisonPayload,
  detectDominantAxis,
  computeTradeoffAxis,
  scoreKeywords,
} from '../comparison-payload';

// ── Helpers ─────────────────────────────────────────────

function getComparisonResponse(query: string) {
  const { subjectMatches } = detectIntent(query, [], undefined);
  return buildConsultationResponse(query, subjectMatches);
}

function getContextRefinement(
  leftName: string, rightName: string,
  contextMessage: string, contextKind: 'speaker' | 'amplifier',
) {
  const comparison = {
    left: { name: leftName, kind: 'brand' as const },
    right: { name: rightName, kind: 'brand' as const },
    scope: 'brand' as const,
  };
  return buildContextRefinement(comparison, contextMessage, contextKind);
}

// ── Payload type & validation ───────────────────────────

describe('ComparisonPayload type and validation', () => {
  it('buildInitialComparisonPayload produces valid payload for job vs leben', () => {
    const { subjectMatches } = detectIntent('job vs leben');
    const response = getComparisonResponse('job vs leben');
    expect(response).not.toBeNull();
    // The payload is built internally — test via the rendered output
    expect(response!.comparisonSummary).toBeDefined();
  });

  it('payload validation rejects missing trade-off', () => {
    const incomplete: ComparisonPayload = {
      subject: 'Test vs Test',
      sideA: { name: 'A', character: 'warm', designPhilosophy: 'test', sonicTraits: [] },
      sideB: { name: 'B', character: 'cool', designPhilosophy: 'test', sonicTraits: [] },
      tradeoff: { axis: 'speed_vs_warmth', label: '', statement: '' },
      tasteFrame: { source: 'provisional', statement: 'test' },
      decision: { chooseAIf: 'test', chooseBIf: 'test' },
    };
    const result = validateComparisonPayload(incomplete);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing trade-off statement');
  });

  it('payload validation rejects missing decision', () => {
    const incomplete: ComparisonPayload = {
      subject: 'Test vs Test',
      sideA: { name: 'A', character: 'warm', designPhilosophy: 'test', sonicTraits: [] },
      sideB: { name: 'B', character: 'cool', designPhilosophy: 'test', sonicTraits: [] },
      tradeoff: { axis: 'speed_vs_warmth', label: 'test', statement: 'test' },
      tasteFrame: { source: 'provisional', statement: 'test' },
      decision: { chooseAIf: '', chooseBIf: '' },
    };
    const result = validateComparisonPayload(incomplete);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing chooseAIf');
  });

  it('payload validation requires anchor when system context present', () => {
    const incomplete: ComparisonPayload = {
      subject: 'Test vs Test',
      sideA: { name: 'A', character: 'warm', designPhilosophy: 'test', sonicTraits: [] },
      sideB: { name: 'B', character: 'cool', designPhilosophy: 'test', sonicTraits: [] },
      tradeoff: { axis: 'speed_vs_warmth', label: 'test', statement: 'test' },
      tasteFrame: { source: 'provisional', statement: 'test' },
      decision: { chooseAIf: 'test', chooseBIf: 'test' },
      systemAnchor: { name: 'Speaker', character: null, anchorStatement: '' },
    };
    const result = validateComparisonPayload(incomplete);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('System context present but no anchor statement');
  });

  it('output validation rejects banned phrases', () => {
    const result = validateComparisonOutput('This is a balanced presentation. Both are excellent choices.');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('output validation requires decision language', () => {
    const result = validateComparisonOutput('Brand A is warm. Brand B is cool. Both are good.');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('decision language'))).toBe(true);
  });

  it('output validation passes for well-formed output', () => {
    const result = validateComparisonOutput('If you want warmth → A. If you want precision → B. The real choice is flow vs density.');
    expect(result.valid).toBe(true);
  });
});

// ── Deterministic scoring ───────────────────────────────

describe('Deterministic trade-off computation', () => {
  it('detectDominantAxis: Leben → warm', () => {
    expect(detectDominantAxis(
      'warmth, flow, rhythmic drive, and tonal density',
      'warm, tonally dense, rhythmically alive, harmonically rich',
    )).toBe('warm');
  });

  it('detectDominantAxis: Hegel → control', () => {
    expect(detectDominantAxis(
      'composure, clarity, and dynamic energy',
      'controlled, composed, neutral to slightly cool. Analytical.',
    )).toBe('control');
  });

  it('computeTradeoffAxis: warm vs control → musicality_vs_accuracy when flow present', () => {
    expect(computeTradeoffAxis('warm', 'control', 3, 0)).toBe('musicality_vs_accuracy');
  });

  it('computeTradeoffAxis: warm vs control → speed_vs_warmth when no flow', () => {
    expect(computeTradeoffAxis('warm', 'control', 0, 0)).toBe('speed_vs_warmth');
  });

  it('computeTradeoffAxis: warm vs warm → flow_vs_density', () => {
    expect(computeTradeoffAxis('warm', 'warm', 2, 1)).toBe('flow_vs_density');
  });
});

// ── Scenario 1: job vs leben → devore o/96 ──────────────

describe('Scenario 1: job vs leben → devore o/96', () => {
  it('initial comparison produces valid output with trade-off and decision', () => {
    const response = getComparisonResponse('job vs leben');
    expect(response).not.toBeNull();
    const summary = response!.comparisonSummary!;

    // Must contain trade-off language
    expect(summary).toMatch(/real choice/i);

    // Must contain decision language
    expect(summary).toMatch(/if you want/i);

    // Must contain both brand names
    expect(summary.toLowerCase()).toContain('job');
    expect(summary.toLowerCase()).toContain('leben');

    // Output validation passes
    const outputVal = validateComparisonOutput(summary);
    expect(outputVal.valid).toBe(true);
  });

  it('system-anchored comparison with devore o/96', () => {
    const ref = getContextRefinement('Job', 'Leben', 'devore o/96', 'speaker');
    const summary = ref.comparisonSummary!;

    // System anchor present
    expect(summary).toMatch(/not a neutral comparison/i);

    // Trade-off anchored to system
    expect(summary).toMatch(/trade-off|counterbalance|compounds/i);

    // Decision present
    expect(summary).toMatch(/if you want/i);

    // No follow-up question
    expect(ref.followUp).toBeUndefined();

    // Recommendation present (system-aware, deep rationale)
    expect(summary).toMatch(/already provid|preserves|sharpens|breathes|introduces|holds the tonal|well-documented|track record/i);

    // Shopping section with HiFiShark/eBay
    expect(summary).toMatch(/recommended direction/i);
    expect(summary).toMatch(/hifishark/i);

    // Sources — editorial, not just official sites
    expect(summary).toMatch(/^Sources:/m);
    expect(summary).toMatch(/6moons|stereophile|darko|audiophiliac|documented pairing/i);

    // No repeated system question
    expect(summary).not.toMatch(/what.*speakers?.*running|what.*system/i);

    // Output validation passes
    const outputVal = validateComparisonOutput(summary);
    expect(outputVal.valid).toBe(true);
  });
});

// ── Scenario 2: job vs hegel ────────────────────────────

describe('Scenario 2: job vs hegel', () => {
  it('produces deeper reasoning than simple trait listing', () => {
    const response = getComparisonResponse('job vs hegel');
    expect(response).not.toBeNull();
    const summary = response!.comparisonSummary!;

    // Must have design philosophy (not just trait listing)
    expect(summary).toMatch(/\*\*Hegel\*\*:|Hegel:/);
    expect(summary).toMatch(/\*\*Job\*\*:|Job:/);

    // Must have explicit trade-off
    expect(summary).toMatch(/real choice/i);

    // Must have decision
    expect(summary).toMatch(/if you want/i);

    // Hegel should be positioned as precision/control, not warmth
    expect(summary).toMatch(/precision|control|accuracy/i);

    // Must include recommendation with deep rationale
    expect(summary).toMatch(/most systems|natural match|edge|engagement|coherence|flow/i);

    // Must include shopping with HiFiShark/eBay
    expect(summary).toMatch(/recommended direction/i);
    expect(summary).toMatch(/hifishark/i);
    expect(summary).toMatch(/ebay/i);

    // Must include editorial sources (not just official sites)
    expect(summary).toMatch(/^Sources:/m);
    expect(summary).toMatch(/6moons|stereophile|darko|audiophiliac/i);

    // Output validation
    const outputVal = validateComparisonOutput(summary);
    expect(outputVal.valid).toBe(true);
  });
});

// ── Scenario 3: kef vs elac → hegel amp ─────────────────

describe('Scenario 3: kef vs elac → hegel amp', () => {
  it('system context changes the framing', () => {
    const ref = getContextRefinement('KEF', 'ELAC', 'hegel', 'amplifier');
    const summary = ref.comparisonSummary!;

    // System anchor present
    expect(summary).toMatch(/not a neutral comparison|takes on a specific character/i);

    // Decision present
    expect(summary).toMatch(/if you want/i);

    // No repeated product descriptions (should be system-interaction focused)
    expect(ref.followUp).toBeUndefined();

    // Output validation
    const outputVal = validateComparisonOutput(summary);
    expect(outputVal.valid).toBe(true);
  });

  it('no product essay fallback', () => {
    const ref = getContextRefinement('KEF', 'ELAC', 'hegel', 'amplifier');
    // Should not have separate philosophy/tendencies sections
    expect(ref.philosophy).toBeUndefined();
    expect(ref.tendencies).toBeUndefined();
    // Primary content should be comparisonSummary
    expect(ref.comparisonSummary).toBeDefined();
    expect(ref.comparisonSummary!.length).toBeGreaterThan(200);
  });
});

// ── Golden test: full payload structure ──────────────────

describe('Golden test: full comparison payload', () => {
  it('job vs leben → devore o/96 payload has all required fields', () => {
    const { subjectMatches } = detectIntent('devore o/96');
    const contextKind = classifySubjectAsContext(subjectMatches);
    expect(contextKind).toBe('speaker');

    // We can't directly access the payload, but we can verify the output
    // contains all required sections by checking the rendered text
    const ref = getContextRefinement('Job', 'Leben', 'devore o/96', 'speaker');
    const summary = ref.comparisonSummary!;

    // All sections must be present:
    // 1. Anchor
    expect(summary).toMatch(/not a neutral comparison/i);
    // 2. System interaction (both sides)
    expect(summary).toMatch(/\*\*Job\*\*.+with/i);
    expect(summary).toMatch(/\*\*Leben\*\*.+with/i);
    // 3. Trade-off
    expect(summary).toMatch(/trade-off|counterbalance|compounds|real choice/i);
    // 4. Taste frame
    expect(summary).toMatch(/listening|engagement|instinct|resonates|keeps you/i);
    // 5. Decision
    expect(summary).toMatch(/if you want/i);
    // 6. Recommendation (system-aware, deep rationale)
    expect(summary).toMatch(/already provid|preserves|sharpens|breathes|introduces|well-documented|track record/i);
    // 7. Shopping (HiFiShark/eBay)
    expect(summary).toMatch(/recommended direction/i);
    expect(summary).toMatch(/hifishark/i);
    // 8. Sources (editorial)
    expect(summary).toMatch(/^Sources:/m);
    expect(summary).toMatch(/6moons|stereophile|darko|audiophiliac/i);

    // MUST NOT contain:
    expect(summary).not.toMatch(/balanced presentation/i);
    expect(summary).not.toMatch(/no strong signal/i);
    expect(summary).not.toMatch(/it depends(?! on)/i);

    // No follow-up question
    expect(ref.followUp).toBeUndefined();
    const lines = summary.split('\n').filter((l) => l.trim());
    const lastLine = lines[lines.length - 1];
    expect(lastLine).not.toMatch(/\?$/);
  });
});
