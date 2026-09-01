import { describe, it, expect } from 'vitest';
import { dedupeComparisonSubjects } from '../gear-response';
import type { SubjectMatch } from '../intent';

/**
 * D4 (production hardening, 2026-08-11) — a comparison pair must never be
 * a product versus its own brand.
 *
 * Live repro: "harbeth p3esr vs kef ls50 meta" extracts subjects
 * [p3esr(product), harbeth(brand), kef(brand)]; page.tsx armed the active
 * comparison positionally as (subj[0], subj[1]) = P3ESR vs HARBETH. The
 * trade-off follow-up then rendered a comparison of the P3ESR against its
 * own manufacturer — including "I don't have enough data about P3esr"
 * one turn after describing the P3ESR as well documented (the product
 * name fell into a brand-profile lookup).
 *
 * Encoded rule: before pairing, a brand subject that is the manufacturer
 * of a product subject in the same list is redundant and must be dropped.
 */

const m = (name: string, kind: 'product' | 'brand'): SubjectMatch => ({ name, kind });

describe('dedupeComparisonSubjects', () => {
  it('drops a brand owned by a listed product (the D4 pair)', () => {
    const out = dedupeComparisonSubjects([m('p3esr', 'product'), m('harbeth', 'brand'), m('kef', 'brand')]);
    expect(out.map((s) => s.name)).toEqual(['p3esr', 'kef']);
  });

  it('keeps brand-only pairs untouched', () => {
    const out = dedupeComparisonSubjects([m('harbeth', 'brand'), m('kef', 'brand')]);
    expect(out.map((s) => s.name)).toEqual(['harbeth', 'kef']);
  });

  it('keeps product-product pairs untouched', () => {
    const out = dedupeComparisonSubjects([m('hugo', 'product'), m('qutest', 'product')]);
    expect(out.map((s) => s.name)).toEqual(['hugo', 'qutest']);
  });

  it('keeps an unrelated brand alongside a product', () => {
    const out = dedupeComparisonSubjects([m('p3esr', 'product'), m('kef', 'brand')]);
    expect(out.map((s) => s.name)).toEqual(['p3esr', 'kef']);
  });

  it('dedupes both sides: two products each with their brand present', () => {
    const out = dedupeComparisonSubjects([
      m('p3esr', 'product'), m('harbeth', 'brand'),
      m('job integrated', 'product'), m('job', 'brand'),
    ]);
    expect(out.map((s) => s.name)).toEqual(['p3esr', 'job integrated']);
  });
});
