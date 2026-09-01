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
  // The entry-tier band was added 2026-08-13 (extended with Quarks $13 and
  // GATE $20), so $75 / $50 / $25 / $15 are all served. $12 sits below the
  // catalogue floor ($13) and is the genuine gap.
  it('an IEM budget below catalogue coverage explains the limit', () => {
    const { answer } = answerFor('IEM recommendations under $12');
    expect(answer.productExamples.length).toBe(0);
    expect(answer.systemNote).toBeDefined();
    expect(answer.systemNote).toMatch(/catalogue|carry/i);
    // States the actual floor rather than a vague apology.
    expect(answer.systemNote).toMatch(/\$13/);
  });

  it('names the budget the reader actually asked for', () => {
    const { answer } = answerFor('IEM recommendations under $12');
    expect(answer.systemNote).toMatch(/\$12/);
  });

  it('never substitutes another category to fill the gap (REC-1 invariant holds)', () => {
    const { ctx, answer } = answerFor('IEM recommendations under $12');
    expect(ctx.category).toBe('headphone');
    expect(answer.productExamples).toEqual([]);
  });

  it('the budget band added 2026-08-13 is genuinely served', () => {
    for (const q of ['IEM recommendations under $100', 'IEM recommendations under $75',
                     'IEM recommendations under $50', 'IEM recommendations under $25',
                     'IEM recommendations under $15']) {
      const { answer } = answerFor(q);
      expect(answer.productExamples.length, q).toBeGreaterThan(0);
      expect(answer.coverageGap, q).toBeUndefined();
      // Nothing recommended may exceed the stated ceiling.
      const ceiling = Number(q.match(/\$(\d+)/)![1]);
      for (const ex of answer.productExamples) {
        if (typeof ex.price === 'number') expect(ex.price, `${q} → ${ex.name}`).toBeLessThanOrEqual(ceiling);
      }
    }
  });

  it('control: a servable DAC budget is unaffected', () => {
    const { answer } = answerFor('recommend a DAC under $2000');
    expect(answer.productExamples.length).toBeGreaterThan(0);
  });
});

describe('a coverage gap is a catalogue limit, not any empty shortlist', () => {
  it('does NOT claim a gap when the catalogue has products in band', () => {
    // Regression (caught by the QA-8 gate before shipping): the first
    // implementation fired on "empty results + a budget", which also covers
    // shortlists emptied by trait fit or hard constraints. Reporting "no
    // speaker under $4,000" when the catalogue is full of them is a false
    // claim about coverage.
    const signals: ExtractedSignals = {
      ...EMPTY,
      traits: { tonal_density: 'up', flow: 'up' } as ExtractedSignals['traits'],
      archetype_hints: ['tonal_saturated'],
    };
    const q = ['I love the warmth and body of tube amps, thick rich sound', 'I want speakers', 'starting from scratch', '$4000'].join('\n');
    const ctx = detectShoppingIntent(q, signals, [], '$4000');
    const r = reason(q, extractDesires(q), signals, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, signals, undefined, r, []);
    expect(answer.coverageGap).toBeUndefined();
    expect(answer.systemNote ?? '').not.toMatch(/coverage starts at/i);
  });

  it('reports the gap only when the cheapest catalogued item exceeds the budget', () => {
    const { answer } = answerFor('IEM recommendations under $12');
    expect(answer.coverageGap?.catalogueFloor).toBe(13);
    expect(answer.coverageGap!.catalogueFloor!).toBeGreaterThan(answer.coverageGap!.budget);
  });
});
