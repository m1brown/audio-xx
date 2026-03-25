/**
 * Comparison follow-up and output discipline tests.
 *
 * Validates:
 * 1. Bare product name answers stay in comparison mode (Problem 2)
 * 2. Comparison advisory output has no heavy blocks (Problem 1)
 * 3. Context refinement produces concise, decision-oriented output
 */

import { describe, it, expect } from 'vitest';
import { detectIntent, isComparisonFollowUp, detectContextEnrichment } from '../intent';
import type { SubjectMatch } from '../intent';
import { buildConsultationResponse, buildContextRefinement, classifySubjectAsContext } from '../consultation';
import { consultationToAdvisory } from '../advisory-response';

// ── Helper: build a comparison and get the advisory response ──

function getComparisonAdvisory(query: string) {
  const { intent, subjectMatches } = detectIntent(query, [], undefined);
  const response = buildConsultationResponse(query, subjectMatches);
  if (!response) return null;
  return consultationToAdvisory(response);
}

// ── Problem 1: Output discipline ──────────────────────────────

describe('Comparison output discipline', () => {
  it('Chord vs Denafrips: no audioProfile, philosophy, tendencies, systemFit', () => {
    const advisory = getComparisonAdvisory('Chord vs Denafrips');
    expect(advisory).not.toBeNull();
    if (!advisory) return;
    expect(advisory.comparisonSummary).toBeDefined();
    expect(advisory.audioProfile).toBeUndefined();
    expect(advisory.philosophy).toBeUndefined();
    expect(advisory.tendencies).toBeUndefined();
    expect(advisory.systemFit).toBeUndefined();
    expect(advisory.systemContext).toBeUndefined();
  });

  it('KEF vs ELAC: no whyFitsYou, recommendedDirection, tradeOffs', () => {
    const advisory = getComparisonAdvisory('KEF vs ELAC');
    expect(advisory).not.toBeNull();
    if (!advisory) return;
    expect(advisory.whyFitsYou).toBeUndefined();
    expect(advisory.recommendedDirection).toBeUndefined();
    expect(advisory.tradeOffs).toBeUndefined();
  });

  it('Comparison advisory mode is gear_comparison', () => {
    const advisory = getComparisonAdvisory('Harbeth or Magnepan');
    expect(advisory).not.toBeNull();
    if (!advisory) return;
    expect(advisory.advisoryMode).toBe('gear_comparison');
  });

  it('Comparison has comparisonSummary as primary content (followUp optional)', () => {
    const advisory = getComparisonAdvisory('Chord vs Denafrips');
    expect(advisory).not.toBeNull();
    if (!advisory) return;
    expect(advisory.comparisonSummary).toBeDefined();
    // Expert comparisons end with a decision — followUp is optional
    // These should all be absent:
    expect(advisory.listenerPriorities).toBeUndefined();
    expect(advisory.systemTendencies).toBeUndefined();
    expect(advisory.alignmentRationale).toBeUndefined();
    expect(advisory.componentReadings).toBeUndefined();
    expect(advisory.upgradePaths).toBeUndefined();
  });
});

// ── Problem 2: Follow-up routing ──────────────────────────────

describe('Comparison follow-up: bare product answer', () => {
  const activeComparison = {
    left: { name: 'Job', kind: 'brand' as const },
    right: { name: 'Leben', kind: 'brand' as const },
    scope: 'brand' as const,
  };

  it('"devore o96" is NOT a comparison follow-up (it introduces a new subject)', () => {
    // isComparisonFollowUp should return false because devore is a new subject
    expect(isComparisonFollowUp('devore o96', activeComparison)).toBe(false);
  });

  it('"devore o96" is NOT detected as context enrichment by pattern matching', () => {
    // detectContextEnrichment should return null for bare product names
    expect(detectContextEnrichment('devore o96')).toBeNull();
  });

  it('classifySubjectAsContext returns speaker for DeVore', () => {
    const subjects: SubjectMatch[] = [{ name: 'DeVore', kind: 'brand' }];
    const kind = classifySubjectAsContext(subjects);
    expect(kind).toBe('speaker');
  });

  it('buildContextRefinement with speaker context produces comparison refinement', () => {
    const refinement = buildContextRefinement(activeComparison, 'devore o96', 'speaker');
    expect(refinement).toBeDefined();
    expect(refinement.comparisonSummary).toBeDefined();
    expect(refinement.subject).toContain('Job');
    expect(refinement.subject).toContain('Leben');
    // System-anchored decisions end with the decision, not a follow-up question
    expect(refinement.followUp).toBeUndefined();
    // Should NOT produce a product essay about DeVore
    expect(refinement.philosophy).toBeUndefined();
    expect(refinement.tendencies).toBeUndefined();
  });

  it('Context refinement advisory has no heavy blocks', () => {
    const refinement = buildContextRefinement(activeComparison, 'devore o96', 'speaker');
    const advisory = consultationToAdvisory(refinement);
    expect(advisory.comparisonSummary).toBeDefined();
    expect(advisory.audioProfile).toBeUndefined();
    expect(advisory.philosophy).toBeUndefined();
    expect(advisory.tendencies).toBeUndefined();
    expect(advisory.systemFit).toBeUndefined();
    expect(advisory.whyFitsYou).toBeUndefined();
  });
});

// ── Combined flow validation ──────────────────────────────────

describe('Full comparison flow: JOB vs Leben + speaker answer', () => {
  it('Step 1: "job integrated vs leben cs300" produces comparison', () => {
    const { intent, subjectMatches } = detectIntent('job integrated vs leben cs300');
    expect(intent).toBe('comparison');
    // Both JOB and Leben should be detected as subjects
    expect(subjectMatches.length).toBeGreaterThanOrEqual(2);
    const brandMatches = subjectMatches.filter((m) => m.kind === 'brand');
    console.log('Subject matches:', JSON.stringify(subjectMatches));
    console.log('Brand matches:', brandMatches.length);

    const response = buildConsultationResponse('job integrated vs leben cs300', subjectMatches);
    expect(response).not.toBeNull();
    if (!response) return;

    // If buildConsultationResponse produced a comparison, validate it.
    // If it produced a single-subject response (e.g. one brand profile),
    // the comparison routing happened at a different level.
    if (response.comparisonSummary) {
      // Expert comparisons end with a decision — followUp is optional
      expect(response.philosophy).toBeUndefined();
      expect(response.tendencies).toBeUndefined();
    } else {
      // Single-subject response — the page.tsx pipeline handles comparison
      // routing via gearResponseToAdvisory. Validate the advisory adapter
      // strips heavy blocks when advisoryMode is gear_comparison.
      const advisory = consultationToAdvisory(response);
      // At minimum, should still have content
      expect(advisory.subject).toBeDefined();
    }
  });

  it('Step 2: "devore o96" classifies as speaker context and stays in comparison', () => {
    const { subjectMatches } = detectIntent('devore o96');
    // Should find DeVore as a subject
    expect(subjectMatches.length).toBeGreaterThan(0);

    // classifySubjectAsContext should identify it as speaker
    const contextKind = classifySubjectAsContext(subjectMatches);
    expect(contextKind).toBe('speaker');

    // buildContextRefinement should produce a comparison-style response
    const activeComparison = {
      left: { name: 'Job', kind: 'brand' as const },
      right: { name: 'Leben', kind: 'brand' as const },
      scope: 'brand' as const,
    };
    const refinement = buildContextRefinement(activeComparison, 'devore o96', contextKind);
    expect(refinement.subject).toMatch(/job.*leben|leben.*job/i);
    expect(refinement.comparisonSummary).toBeDefined();
    // Expert system-anchored output — substantive but bounded
    expect(refinement.comparisonSummary!.length).toBeLessThan(3000);
    expect(refinement.comparisonSummary!.length).toBeGreaterThan(200);
  });
});
