import { describe, it, expect } from 'vitest';
import { mentionsRecommendedProduct } from '../shopping-intent';

/**
 * D9 (saturation cohort, 2026-08-11) — the shopping-refinement lock must
 * not absorb questions about gear it never recommended.
 *
 * Live repro (production, mid-shopping with answers already shown):
 *   "have you heard anything about the aiyima a07?"
 *   → the shopping answer re-rendered (WiiM AMP / $500 boilerplate);
 *     the named product appeared nowhere in the response.
 *
 * Cause: page.tsx folded EVERY product_assessment back into shopping
 * once shoppingAnswerCount > 0. That is correct when the question is
 * about a product from the shown recommendations ("thoughts on the
 * chord qutest" right after the Qutest was recommended) and wrong for
 * novel external gear — the same explicit-subject-wins principle as the
 * saved-system release fix, at the shopping-lock gate.
 *
 * Encoded rule: a product question stays in shopping refinement only
 * when it names a product the shopping answer actually showed.
 */

const RECENT = ['Chord Qutest', 'Denafrips Ares 15th', 'Schiit Modius E'];

describe('mentionsRecommendedProduct', () => {
  it('a recommended product name matches', () => {
    expect(mentionsRecommendedProduct(['qutest'], RECENT)).toBe(true);
    expect(mentionsRecommendedProduct(['chord qutest'], RECENT)).toBe(true);
  });

  it('brand-only reference to a recommended product matches', () => {
    expect(mentionsRecommendedProduct(['denafrips'], RECENT)).toBe(true);
  });

  it('a novel external product does not match', () => {
    expect(mentionsRecommendedProduct(['aiyima a07'], RECENT)).toBe(false);
    expect(mentionsRecommendedProduct(['Aiyima A07'], RECENT)).toBe(false);
  });

  it('empty inputs never match', () => {
    expect(mentionsRecommendedProduct([], RECENT)).toBe(false);
    expect(mentionsRecommendedProduct(['qutest'], [])).toBe(false);
  });
});
