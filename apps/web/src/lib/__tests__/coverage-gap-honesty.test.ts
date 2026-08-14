import { describe, it, expect } from 'vitest';
import { detectShoppingIntent, buildShoppingAnswer } from '../shopping-intent';
import { extractDesires } from '../intent';
import { reason } from '../reasoning';
import type { ExtractedSignals } from '../signal-types';

/**
 * Founder-reported (2026-08-13): "I also asked for under $75 and under $50
 * and didn't get results." The engine correctly refused to substitute
 * over-ears for IEMs (REC-1's invariant) but then said nothing at all, so an
 * honest coverage limit read as a broken feature.
 *
 * Rule: never substitute a neighbouring category to fill a coverage gap —
 * but never present an empty answer as an answer either. Name the limit.
 */
const EMPTY: ExtractedSignals = {
  traits: {}, symptoms: [], archetype_hints: [], uncertainty_level: 0,
  matched_phrases: [], matched_uncertainty_markers: [],
};

function answerFor(q: string) {
  const ctx = detectShoppingIntent(q, EMPTY, [], q);
  const r = reason(q, extractDesires(q), EMPTY, null, ctx, undefined);
  return { ctx, answer: buildShoppingAnswer(ctx, EMPTY, undefined, r, []) };
}

describe('coverage gaps are explained, never silently empty', () => {
  it('an IEM budget below catalogue coverage explains the limit', () => {
    const { answer } = answerFor('IEM recommendations under $75');
    expect(answer.productExamples.length).toBe(0);
    expect(answer.systemNote).toBeDefined();
    expect(answer.systemNote).toMatch(/catalogue|carry/i);
    // States the actual floor rather than a vague apology.
    expect(answer.systemNote).toMatch(/\$80/);
  });

  it('an even lower budget behaves the same way', () => {
    const { answer } = answerFor('IEM recommendations under $50');
    expect(answer.productExamples.length).toBe(0);
    expect(answer.systemNote).toMatch(/\$50/);
  });

  it('never substitutes another category to fill the gap (REC-1 invariant holds)', () => {
    const { ctx, answer } = answerFor('IEM recommendations under $75');
    expect(ctx.category).toBe('headphone');
    expect(answer.productExamples).toEqual([]);
  });

  it('a servable budget still returns products and no gap note', () => {
    const { answer } = answerFor('IEM recommendations under $100');
    expect(answer.productExamples.length).toBeGreaterThan(0);
    expect(answer.systemNote ?? '').not.toMatch(/coverage starts at/i);
  });

  it('control: a servable DAC budget is unaffected', () => {
    const { answer } = answerFor('recommend a DAC under $2000');
    expect(answer.productExamples.length).toBeGreaterThan(0);
  });
});
