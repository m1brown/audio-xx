/**
 * D-011 — unrecognized-model honesty (pre-beta audit, 2026-08-04).
 *
 * Production evidence that motivated this: asking about the Cambridge
 * Audio MXN10 (a network streamer with no amplification) returned
 * "Cambridge Audio· Class AB, 80W/ch, neutral, clean, analytical
 * British design" and never once named the MXN10. The brand's TYPICAL
 * amplifier spec string was presented as if it described the product.
 * Same shape for the Naim Uniti Atom ("70W/ch"; the real Atom is 40W).
 *
 * Contract pinned here:
 *   1. the model the user typed is echoed back;
 *   2. uncertainty is stated explicitly;
 *   3. no brand-typical spec string is asserted about it;
 *   4. a clarifying question is asked;
 *   5. bare-brand queries keep their previous, non-hedged behaviour.
 */
import { describe, it, expect } from 'vitest';
import { extractUnmatchedModel, buildProductAssessment } from '../product-assessment';
import type { SubjectMatch } from '../intent';

const brandOnly = (name: string): SubjectMatch[] =>
  [{ kind: 'brand', name } as SubjectMatch];

function assess(message: string, brand: string) {
  return buildProductAssessment({
    subjectMatches: brandOnly(brand),
    currentMessage: message,
  });
}

describe('extractUnmatchedModel', () => {
  it('recovers the model from a natural question', () => {
    expect(extractUnmatchedModel('Tell me about the Cambridge Audio MXN10', 'Cambridge Audio'))
      .toMatch(/MXN10/i);
  });
  it('recovers multi-word models', () => {
    expect(extractUnmatchedModel('What do you know about the Naim Uniti Atom?', 'Naim'))
      .toMatch(/Uniti Atom/i);
  });
  it('returns undefined for a bare-brand question', () => {
    expect(extractUnmatchedModel('Tell me about the Chord sound', 'Chord')).toBeUndefined();
  });
  it('returns undefined when only the brand is named', () => {
    expect(extractUnmatchedModel('What do you think of Naim?', 'Naim')).toBeUndefined();
  });
  it('does not swallow a whole sentence as a model name', () => {
    const r = extractUnmatchedModel(
      'I was wondering whether Naim would suit a small room with hardwood floors and lots of glass',
      'Naim',
    );
    expect(r).toBeUndefined();
  });
});

describe('unrecognized model — response honesty', () => {
  const CASES = [
    { msg: 'Tell me about the Cambridge Audio MXN10', brand: 'Cambridge Audio', model: /MXN10/i },
    { msg: 'What do you know about the Naim Uniti Atom?', brand: 'Naim', model: /Uniti Atom/i },
  ];

  for (const c of CASES) {
    it(`names the model the user asked about — ${c.msg}`, () => {
      const r = assess(c.msg, c.brand);
      expect(r).not.toBeNull();
      expect(r!.shortAnswer).toMatch(c.model);
    });

    it(`states uncertainty explicitly — ${c.msg}`, () => {
      const r = assess(c.msg, c.brand);
      expect(r!.shortAnswer.toLowerCase()).toMatch(/don'?t have|can'?t confirm|not in my catalog/);
    });

    it(`asserts no brand-typical spec string — ${c.msg}`, () => {
      const r = assess(c.msg, c.brand);
      const all = [r!.shortAnswer, ...(r!.whatChanges ?? []), r!.recommendation ?? ''].join(' ');
      // The concrete fabrication class observed in production: wattage,
      // ohms and amplifier class asserted for an unidentified product.
      expect(all).not.toMatch(/\d+\s?W\/ch|\d+\s?watts?\b|\bclass\s?(A|AB|D)\b/i);
    });

    it(`asks a clarifying question — ${c.msg}`, () => {
      const r = assess(c.msg, c.brand);
      const all = [r!.shortAnswer, r!.recommendation ?? ''].join(' ').toLowerCase();
      expect(all).toMatch(/tell me|what it is|share|confirm|which/);
    });
  }

  it('bare-brand queries keep brand-level description (no false hedge)', () => {
    const r = assess('Tell me about the Chord sound', 'Chord');
    if (r) {
      expect(r.shortAnswer.toLowerCase()).not.toMatch(/don'?t have the .* in my catalog/);
    }
  });
});
