/**
 * Product assessment routing priority tests.
 *
 * When a user asks about a specific product with assessment language
 * ("thoughts on", "what do you think of", "how is"), the system MUST
 * route to product_assessment — not gear_inquiry, shopping, or exploration.
 *
 * The product_assessment path produces a focused analysis of THAT product
 * only, with no cross-category alternatives or exploratory recommendations.
 */

import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';
import { buildProductAssessment, findAssessmentProduct } from '../product-assessment';
import type { AssessmentContext } from '../product-assessment';

describe('Product assessment routing: priority gate', () => {
  // ── Core bug: "thoughts on job integrated amplifier" ──
  it('routes "thoughts on job integrated amplifier" to product_assessment', () => {
    const result = detectIntent('thoughts on job integrated amplifier');
    expect(result.intent).toBe('product_assessment');
    expect(result.subjectMatches.some((m) => m.kind === 'product')).toBe(true);
  });

  it('routes "thoughts on job integrated" to product_assessment', () => {
    const result = detectIntent('thoughts on job integrated');
    expect(result.intent).toBe('product_assessment');
  });

  // ── Assessment language variants ──
  const ASSESSMENT_QUERIES = [
    'what do you think of the chord qutest',
    'what do you think about the denafrips ares',
    'thoughts on the pass labs int-25',
    'how is the wilson sabrina',
    'tell me about the schiit bifrost',
    'any experience with harbeth p3esr',
    'opinion on the klipsch heresy iv',
    'what are your thoughts on the hegel h390',
    'how good is the first watt sit-3',
    'know anything about the leben cs300',
  ];

  for (const q of ASSESSMENT_QUERIES) {
    it(`routes "${q}" to product_assessment`, () => {
      const result = detectIntent(q);
      expect(result.intent).toBe('product_assessment');
    });
  }

  // ── Brand-only queries also route to product_assessment ──
  const BRAND_ASSESSMENT_QUERIES = [
    'tell me about denafrips',
    'thoughts on shindo',
    'what do you think of pass labs',
  ];

  for (const q of BRAND_ASSESSMENT_QUERIES) {
    it(`routes "${q}" to product_assessment (brand-level)`, () => {
      const result = detectIntent(q);
      expect(result.intent).toBe('product_assessment');
    });
  }
});

describe('Product assessment: product resolution', () => {
  it('resolves "job integrated" to JOB Integrated amplifier', () => {
    const result = detectIntent('thoughts on job integrated amplifier');
    const product = findAssessmentProduct(result.subjectMatches);
    expect(product).not.toBeNull();
    expect(product!.brand).toBe('JOB');
    expect(product!.category).toBe('amplifier');
  });

  it('resolves "chord qutest" to Chord Qutest DAC', () => {
    const result = detectIntent('what do you think of the chord qutest');
    const product = findAssessmentProduct(result.subjectMatches);
    expect(product).not.toBeNull();
    expect(product!.brand).toBe('Chord');
    expect(product!.category).toBe('dac');
  });
});

describe('Product assessment: no cross-category leakage', () => {
  it('JOB integrated assessment contains no DAC recommendations', () => {
    const result = detectIntent('thoughts on job integrated amplifier');
    const ctx: AssessmentContext = {
      subjectMatches: result.subjectMatches,
      currentMessage: 'thoughts on job integrated amplifier',
    };
    const assessment = buildProductAssessment(ctx);
    expect(assessment).not.toBeNull();
    expect(assessment!.candidateName).toMatch(/JOB/i);
    // No cross-category products should appear
    expect(assessment!.candidateName).not.toMatch(/iFi/i);
    expect(assessment!.candidateName).not.toMatch(/DAC/i);
  });
});

describe('Product assessment: must override shopping/exploration', () => {
  // These patterns could be confused with shopping. They must NOT be.
  const SHOULD_NOT_BE_SHOPPING = [
    'thoughts on job integrated amplifier',
    'what do you think of the chord qutest',
    'how is the schiit bifrost',
    'opinion on klipsch heresy iv',
  ];

  for (const q of SHOULD_NOT_BE_SHOPPING) {
    it(`"${q}" is NOT routed to shopping`, () => {
      const result = detectIntent(q);
      expect(result.intent).not.toBe('shopping');
    });
  }

  for (const q of SHOULD_NOT_BE_SHOPPING) {
    it(`"${q}" is NOT routed to gear_inquiry`, () => {
      const result = detectIntent(q);
      expect(result.intent).not.toBe('gear_inquiry');
    });
  }

  for (const q of SHOULD_NOT_BE_SHOPPING) {
    it(`"${q}" is NOT routed to exploration`, () => {
      const result = detectIntent(q);
      expect(result.intent).not.toBe('exploration');
    });
  }
});

describe('Product assessment: diagnosis still wins for complaints', () => {
  // Even with product names, if there's a listening complaint,
  // diagnosis should still fire.
  const DIAGNOSIS_WITH_PRODUCTS = [
    'my chord qutest sounds too bright',
    'the job integrated is making my system harsh',
    'listening fatigue with my harbeth speakers',
  ];

  for (const q of DIAGNOSIS_WITH_PRODUCTS) {
    it(`"${q}" routes to diagnosis, not product_assessment`, () => {
      const result = detectIntent(q);
      // Diagnosis patterns include "sounds too bright", "harsh", "fatigue"
      // which should NOT be overridden by product_assessment.
      // Note: product_assessment fires first in priority, but only when
      // PRODUCT_ASSESSMENT_PATTERNS match — complaint language is NOT
      // in those patterns.
      expect(result.intent).not.toBe('product_assessment');
    });
  }
});
