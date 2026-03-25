/**
 * Comparison response format tests.
 *
 * Validates:
 * 1. Brand-level comparisons produce concise side-by-side output
 * 2. Both items always presented
 * 3. Decision guidance included
 * 4. No long review-style sections
 * 5. Previously-missing brands (ELAC, Wharfedale, etc.) now detected
 */

import { detectIntent } from '../intent';
import { buildConsultationResponse } from '../consultation';

function getComparisonResponse(query: string) {
  const { intent, subjectMatches } = detectIntent(query, [], undefined);
  if (intent !== 'comparison') {
    return { intent, response: null, subjectMatches };
  }
  const response = buildConsultationResponse(query, subjectMatches);
  return { intent, response, subjectMatches };
}

describe('Comparison intent detection', () => {
  test('KEF vs ELAC detected as comparison with 2 brand matches', () => {
    const { intent, subjectMatches } = detectIntent('KEF vs ELAC', [], undefined);
    expect(intent).toBe('comparison');
    const brands = subjectMatches.filter((m) => m.kind === 'brand');
    expect(brands.length).toBeGreaterThanOrEqual(2);
    expect(brands.map((b) => b.name.toLowerCase())).toEqual(
      expect.arrayContaining(['kef', 'elac']),
    );
  });

  test('Chord vs Denafrips detected as comparison', () => {
    const { intent, subjectMatches } = detectIntent('Chord vs Denafrips', [], undefined);
    expect(intent).toBe('comparison');
    expect(subjectMatches.filter((m) => m.kind === 'brand').length).toBeGreaterThanOrEqual(2);
  });

  test('Wharfedale vs KEF detected as comparison', () => {
    const { intent, subjectMatches } = detectIntent('Wharfedale vs KEF', [], undefined);
    expect(intent).toBe('comparison');
    expect(subjectMatches.filter((m) => m.kind === 'brand').length).toBeGreaterThanOrEqual(2);
  });

  test('Harbeth vs Magnepan detected as comparison', () => {
    const { intent, subjectMatches } = detectIntent('Harbeth or Magnepan for vocals?', [], undefined);
    expect(intent).toBe('comparison');
    expect(subjectMatches.filter((m) => m.kind === 'brand').length).toBeGreaterThanOrEqual(2);
  });
});

describe('Comparison response format', () => {
  test('KEF vs ELAC produces response with both brands', () => {
    const { response } = getComparisonResponse('KEF vs ELAC');
    expect(response).not.toBeNull();
    if (!response) return;
    expect(response.comparisonSummary).toBeDefined();
    const summary = response.comparisonSummary!;
    // Both brands must appear
    expect(summary.toLowerCase()).toContain('kef');
    expect(summary.toLowerCase()).toContain('elac');
  });

  test('Comparison summary contains side-by-side structure', () => {
    const { response } = getComparisonResponse('Chord vs Denafrips');
    expect(response).not.toBeNull();
    if (!response) return;
    const summary = response.comparisonSummary!;
    // Should have bold brand names (with or without colon)
    expect(summary).toMatch(/\*\*Chord/);
    expect(summary).toMatch(/\*\*Denafrips/);
  });

  test('Comparison includes decision guidance', () => {
    const { response } = getComparisonResponse('KEF vs ELAC');
    expect(response).not.toBeNull();
    if (!response) return;
    const summary = response.comparisonSummary!;
    // Should contain directional guidance (warm/precise or similar)
    expect(summary).toMatch(/if you want|both lean|leans toward/i);
  });

  test('Comparison does NOT produce long review sections', () => {
    const { response } = getComparisonResponse('Chord vs Denafrips');
    expect(response).not.toBeNull();
    if (!response) return;
    // philosophy and tendencies should be empty/undefined for comparisons
    expect(response.philosophy).toBeUndefined();
    expect(response.tendencies).toBeUndefined();
    expect(response.systemContext).toBeUndefined();
  });

  test('Comparison follow-up is absent when no design families exist, or present as a question', () => {
    const { response } = getComparisonResponse('KEF vs ELAC');
    expect(response).not.toBeNull();
    if (!response) return;
    // Expert comparisons end with a decision — follow-up is optional.
    // When present (brands with design families), it should be a question.
    if (response.followUp) {
      expect(response.followUp).toContain('?');
    }
    // The comparison itself must contain decision guidance
    expect(response.comparisonSummary).toMatch(/if you want/i);
  });

  test('Comparison summary is substantive but not excessive', () => {
    const { response } = getComparisonResponse('Chord vs Denafrips');
    expect(response).not.toBeNull();
    if (!response) return;
    const summary = response.comparisonSummary!;
    // Expert comparison includes philosophy, sonic translation, trade-off,
    // taste injection, and decision — typically 800–2500 chars.
    expect(summary.length).toBeLessThan(3000);
    // Must be substantive
    expect(summary.length).toBeGreaterThan(400);
  });

  test('Wharfedale vs KEF produces warm-vs-precise guidance', () => {
    const { response } = getComparisonResponse('Wharfedale vs KEF');
    expect(response).not.toBeNull();
    if (!response) return;
    const summary = response.comparisonSummary!;
    expect(summary.toLowerCase()).toContain('wharfedale');
    expect(summary.toLowerCase()).toContain('kef');
    // Should detect warm vs precise axis
    expect(summary).toMatch(/warm|precision|detail|body/i);
  });
});

describe('Comparison response subject line', () => {
  test('Subject reflects both brands', () => {
    const { response } = getComparisonResponse('KEF vs ELAC');
    expect(response).not.toBeNull();
    if (!response) return;
    expect(response.subject.toLowerCase()).toContain('kef');
    expect(response.subject.toLowerCase()).toContain('elac');
    expect(response.subject).toContain('vs');
  });
});
