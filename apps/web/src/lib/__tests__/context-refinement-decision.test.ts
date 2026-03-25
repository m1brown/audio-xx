/**
 * Tests for system-anchored comparison decisions.
 *
 * Validates the specific flow:
 *   job vs leben → devore o/96
 *
 * Expected:
 *   - system-anchored recommendation (not re-descriptions)
 *   - no repeated product summaries
 *   - no system question ("What amplifier are you pairing?")
 *   - decision guidance ("If you want X → choose A")
 */
import { describe, it, expect } from 'vitest';
import { buildContextRefinement, classifySubjectAsContext } from '../consultation';
import { consultationToAdvisory } from '../advisory-response';
import { detectIntent } from '../intent';

// ── Test setup ────────────────────────────────────────

function buildJobVsLebenComparison() {
  return {
    left: { name: 'job', kind: 'product' as const },
    right: { name: 'leben', kind: 'product' as const },
    scope: 'brand' as const,
  };
}

// ── Validation: job vs leben → devore o/96 ────────────

describe('System-anchored decision: job vs leben → devore o/96', () => {
  const comparison = buildJobVsLebenComparison();

  it('classifies "devore o96" as speaker context', () => {
    const { subjectMatches } = detectIntent('devore o96');
    expect(subjectMatches.length).toBeGreaterThan(0);
    const kind = classifySubjectAsContext(subjectMatches);
    expect(kind).toBe('speaker');
  });

  it('produces system-anchored output (not re-descriptions)', () => {
    const result = buildContextRefinement(comparison, 'devore o96', 'speaker');
    const summary = result.comparisonSummary ?? '';

    // Must anchor to system — mentions DeVore in context
    expect(summary.toLowerCase()).toMatch(/devore|o.?96/i);

    // Must contain interaction language, not just product descriptions
    expect(summary).toMatch(/with.*devore|pairing|interact|complement|compound|balance/i);
  });

  it('does NOT repeat generic product descriptions', () => {
    const result = buildContextRefinement(comparison, 'devore o96', 'speaker');
    const summary = result.comparisonSummary ?? '';

    // Should NOT contain generic description patterns
    expect(summary).not.toMatch(/(?:JOB|Leben).*(?:is described as|are described as|designs compact)/i);
  });

  it('provides decision guidance ("If you want X → choose Y")', () => {
    const result = buildContextRefinement(comparison, 'devore o96', 'speaker');
    const summary = result.comparisonSummary ?? '';

    // Must contain decision-oriented language
    expect(summary).toMatch(/if you want/i);
    // Must reference both sides in decision guidance
    expect(summary).toMatch(/\*\*Job\*\*|\*\*JOB\*\*/i);
    expect(summary).toMatch(/\*\*Leben\*\*/i);
  });

  it('ends with decision, no follow-up question', () => {
    const result = buildContextRefinement(comparison, 'devore o96', 'speaker');

    // System-anchored decisions must NOT produce a follow-up question.
    // The response ends with the decision guidance / light recommendation.
    expect(result.followUp).toBeUndefined();

    // The body itself must end with decision content, not a question
    const summary = result.comparisonSummary ?? '';
    const lastLine = summary.split('\n').filter((l) => l.trim()).pop() ?? '';
    expect(lastLine).not.toMatch(/\?$/);
  });

  it('mentions known Leben + DeVore pairing when applicable', () => {
    const result = buildContextRefinement(comparison, 'devore o96', 'speaker');
    const summary = result.comparisonSummary ?? '';

    // Leben has pairingNotes mentioning DeVore — should surface this
    expect(summary).toMatch(/pairing|documented|celebrated|track record|well-known|natural match/i);
  });

  it('advisory output has no heavy blocks', () => {
    const result = buildContextRefinement(comparison, 'devore o96', 'speaker');
    const advisory = consultationToAdvisory(result, undefined, undefined);

    expect(advisory.audioProfile).toBeUndefined();
    expect(advisory.philosophy).toBeUndefined();
    expect(advisory.tendencies).toBeUndefined();
    expect(advisory.systemFit).toBeUndefined();
    expect(advisory.whyFitsYou).toBeUndefined();
  });
});

// ── Other system-anchored context types ───────────────

describe('System-anchored decision: other context types', () => {
  it('amplifier context also produces decision guidance', () => {
    // KEF vs ELAC comparison + tube amplifier context
    const comparison = {
      left: { name: 'kef', kind: 'brand' as const },
      right: { name: 'elac', kind: 'brand' as const },
      scope: 'brand' as const,
    };

    const result = buildContextRefinement(comparison, 'leben cs600', 'amplifier');
    const summary = result.comparisonSummary ?? '';

    // Must contain decision guidance or interaction language
    expect(summary).toMatch(/if you want|interact|complement|compound|balance|with.*leben/i);

    // System-anchored decisions end with the decision, not a follow-up question
    expect(result.followUp).toBeUndefined();
  });
});

// ── Non-anchorable contexts still work ────────────────

describe('Non-anchorable contexts: fallback path preserved', () => {
  it('room context uses generic path', () => {
    const comparison = {
      left: { name: 'kef', kind: 'brand' as const },
      right: { name: 'elac', kind: 'brand' as const },
      scope: 'brand' as const,
    };

    const result = buildContextRefinement(comparison, 'small room, near-field', 'room');
    expect(result.comparisonSummary).toBeDefined();
    expect(result.followUp).toBeDefined();
  });

  it('music context uses generic path', () => {
    const comparison = {
      left: { name: 'chord', kind: 'brand' as const },
      right: { name: 'denafrips', kind: 'brand' as const },
      scope: 'brand' as const,
    };

    const result = buildContextRefinement(comparison, 'mostly jazz and vocals', 'music');
    expect(result.comparisonSummary).toBeDefined();
    expect(result.followUp).toMatch(/value|presented|body|detail/i);
  });
});
