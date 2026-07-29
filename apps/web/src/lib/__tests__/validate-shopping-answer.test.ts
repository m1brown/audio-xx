/**
 * Fail-closed licensed-category validator (production G1 backstop).
 *
 * The routing layer resolves the licensed category before an answer is built;
 * this validator is the last line of defense that a composed answer actually
 * conforms to the class the user is entitled to. Hard violations must withhold
 * the answer; soft (advisory-quality) issues are logged only.
 */
import { describe, it, expect } from 'vitest';
import {
  validateShoppingAnswer,
  type ShoppingContext,
  type ShoppingAnswer,
  type ProductExample,
} from '@/lib/shopping-intent';

function ctx(partial: Partial<ShoppingContext>): ShoppingContext {
  return {
    category: 'streamer',
    budgetAmount: null,
    constraints: [],
    semanticPreferences: { musicHints: [] },
    ...partial,
  } as unknown as ShoppingContext;
}

function product(partial: Partial<ProductExample>): ProductExample {
  return { name: 'X', brand: 'Y', price: 1000, fitNote: '' , ...partial } as ProductExample;
}

function answer(partial: Partial<ShoppingAnswer>): ShoppingAnswer {
  return {
    category: 'streamer',
    budget: null,
    preferenceSummary: '',
    bestFitDirection: '',
    whyThisFits: [],
    productExamples: [],
    watchFor: [],
    ...partial,
  } as ShoppingAnswer;
}

describe('validateShoppingAnswer — fail-closed licensed-category gate', () => {
  it('a coherent streamer answer with no catalog products passes', () => {
    const v = validateShoppingAnswer(
      ctx({ category: 'streamer', requestedCategory: 'streamer' }),
      answer({ category: 'streamer', productExamples: [product({ name: 'Node' })] }),
    );
    expect(v.ok).toBe(true);
    expect(v.hard).toHaveLength(0);
  });

  it('(A) category-mismatch: explicit streamer license but resolved dac → hard violation', () => {
    const v = validateShoppingAnswer(
      ctx({ category: 'dac', requestedCategory: 'streamer' }),
      answer({ category: 'DAC' }),
    );
    expect(v.ok).toBe(false);
    expect(v.hard.map((h) => h.code)).toContain('category-mismatch');
  });

  it('(B) preamble-mismatch: answer label disagrees with resolved category → hard violation', () => {
    const v = validateShoppingAnswer(
      ctx({ category: 'streamer', requestedCategory: 'streamer' }),
      answer({ category: 'DAC' }), // should be "streamer"
    );
    expect(v.ok).toBe(false);
    expect(v.hard.map((h) => h.code)).toContain('preamble-mismatch');
  });

  it('(C) product-out-of-class: a real DAC recommended under a streamer license is dropped', () => {
    // Denafrips Ares is a catalog DAC — under a streamer license it must not survive.
    const v = validateShoppingAnswer(
      ctx({ category: 'streamer', requestedCategory: 'streamer' }),
      answer({
        category: 'streamer',
        productExamples: [
          product({ name: 'Ares 15th', brand: 'Denafrips' }),
          product({ name: 'Some Streamer', brand: 'Curated' }),
        ],
      }),
    );
    expect(v.hard.map((h) => h.code)).toContain('product-out-of-class');
    // The unverifiable curated streamer survives the conforming set.
    expect(v.conformingProducts.some((p) => p.name === 'Some Streamer')).toBe(true);
    expect(v.conformingProducts.some((p) => p.name === 'Ares 15th')).toBe(false);
  });

  it('does not flag products whose class is unverifiable (curated / general)', () => {
    const v = validateShoppingAnswer(
      ctx({ category: 'general', requestedCategory: undefined }),
      answer({ category: 'component', productExamples: [product({ name: 'Mystery Box' })] }),
    );
    expect(v.ok).toBe(true);
    expect(v.conformingProducts).toHaveLength(1);
  });

  it('(D) system-component-dropped is SOFT, never withholds', () => {
    const v = validateShoppingAnswer(
      ctx({ category: 'streamer', requestedCategory: 'streamer' }),
      answer({
        category: 'streamer',
        systemNote: undefined,
        productExamples: [product({ name: 'Node', brand: 'Bluesound', fitNote: 'clean' })],
      }),
      ['Chord Hugo', 'WLM Diva'],
    );
    // Still ok (no HARD violation) — soft note only.
    expect(v.ok).toBe(true);
    expect(v.soft.map((s) => s.code)).toContain('system-component-dropped');
  });

  it('(D) acknowledges the system when a component name appears in the prose', () => {
    const v = validateShoppingAnswer(
      ctx({ category: 'streamer', requestedCategory: 'streamer' }),
      answer({
        category: 'streamer',
        systemNote: 'Pairs cleanly with your Chord Hugo.',
        productExamples: [product({ name: 'Node', brand: 'Bluesound' })],
      }),
      ['Chord Hugo', 'WLM Diva'],
    );
    expect(v.soft).toHaveLength(0);
  });
});
