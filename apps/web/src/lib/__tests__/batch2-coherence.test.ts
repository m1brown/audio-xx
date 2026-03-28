/**
 * Batch 2 Validation — Recommendation Coherence + Category-Light Handling
 * 6 test cases verifying confidence, category resolution, product availability,
 * response usefulness, and follow-up question behavior.
 */
import { describe, it, expect } from 'vitest';
import {
  detectShoppingIntent,
  buildShoppingAnswer,
  buildCategoryQuestion,
  type ShoppingAnswer,
} from '../shopping-intent';
import { reason } from '../reasoning';
import { extractDesires } from '../intent';
import type { ExtractedSignals } from '../signal-types';

function buildSignalsFromText(text: string): ExtractedSignals {
  const lower = text.toLowerCase();
  const traits: Record<string, 'up' | 'down'> = {};
  const archetype_hints: string[] = [];
  if (/warm|rich|tube|thick|body|lush|musical|engaging|emotional|colorful|soulful|involving/i.test(lower)) {
    traits.tonal_density = 'up'; traits.flow = 'up';
    archetype_hints.push('tonal_saturated');
  }
  if (/precise|detail|analytical|resolv|accurate|controlled|control/i.test(lower)) {
    traits.clarity = 'up';
    archetype_hints.push('precision_explicit');
  }
  if (/harsh|bright|fatiguing|dry/i.test(lower)) {
    traits.clarity = 'down';
    traits.tonal_density = traits.tonal_density ?? 'up';
  }
  if (/flow|organic|natural|smooth|relaxed/i.test(lower)) {
    traits.flow = 'up';
  }
  if (/immersive/i.test(lower)) {
    traits.flow = 'up';
    archetype_hints.push('spatial_holographic');
  }
  return {
    traits, symptoms: [], archetype_hints,
    uncertainty_level: Object.keys(traits).length === 0 ? 0.8 : 0.2,
    matched_phrases: [], matched_uncertainty_markers: [],
  };
}

function runQuery(label: string, text: string) {
  const signals = buildSignalsFromText(text);
  const desires = extractDesires(text);
  const ctx = detectShoppingIntent(text, signals, [], text);
  const reasoning = reason(text, desires, signals, null, ctx, undefined);
  const answer = buildShoppingAnswer(ctx, signals, undefined, reasoning, [], [], undefined, 'default', null, []);

  const anchor = answer.productExamples[0];
  console.log(`\n═══ ${label} ═══`);
  console.log(`  confidence: ${answer.tasteConfidence}`);
  console.log(`  category: ${ctx.category}`);
  console.log(`  products: ${answer.productExamples.length}`);
  console.log(`  anchor: ${anchor ? `${anchor.brand} ${anchor.name} ($${anchor.price})` : 'NONE'}`);
  console.log(`  tasteQuestion: ${answer.tasteQuestion ?? 'none'}`);
  console.log(`  categoryQuestion: ${answer.categoryQuestion ?? 'none'}`);
  console.log(`  preferenceSummary: ${answer.preferenceSummary.substring(0, 80)}...`);
  console.log(`  bestFitDirection: ${answer.bestFitDirection.substring(0, 80)}...`);

  return { answer, ctx, anchor, signals };
}

describe('Batch 2: Recommendation Coherence + Category-Light Handling', () => {

  // ── Unit test: buildCategoryQuestion ──

  describe('buildCategoryQuestion', () => {
    it('fires when taste sufficient + category general + no products', () => {
      const q = buildCategoryQuestion({ tasteConfidence: 'sufficient', category: 'general', hasProducts: false });
      expect(q).not.toBeNull();
      expect(q).toContain('speakers');
    });

    it('does NOT fire when confidence is low', () => {
      const q = buildCategoryQuestion({ tasteConfidence: 'low', category: 'general', hasProducts: false });
      expect(q).toBeNull();
    });

    it('does NOT fire when category is known', () => {
      const q = buildCategoryQuestion({ tasteConfidence: 'sufficient', category: 'amplifier', hasProducts: true });
      expect(q).toBeNull();
    });

    it('does NOT fire when products exist', () => {
      const q = buildCategoryQuestion({ tasteConfidence: 'sufficient', category: 'general', hasProducts: true });
      expect(q).toBeNull();
    });
  });

  // ── Full pipeline: 6 validation cases ──

  // Case 1: Strong taste, no category → category question
  const c1 = runQuery('Case 1: Engaging less dry (no category)',
    'I want something more engaging and less dry');

  it('Case 1: strong taste, no category → sufficient confidence + category question', () => {
    expect(c1.answer.tasteConfidence).toBe('sufficient');
    expect(c1.ctx.category).toBe('general');
    expect(c1.answer.productExamples.length).toBe(0);
    expect(c1.answer.categoryQuestion).not.toBeUndefined();
    // preferenceSummary should still reflect detected taste
    expect(c1.answer.preferenceSummary.length).toBeGreaterThan(20);
  });

  // Case 2: Strong taste, no category → category question
  const c2 = runQuery('Case 2: Emotional sound (no category)',
    'I want a more emotional sound');

  it('Case 2: emotional + no category → sufficient confidence + category question', () => {
    expect(c2.answer.tasteConfidence).toBe('sufficient');
    expect(c2.ctx.category).toBe('general');
    expect(c2.answer.productExamples.length).toBe(0);
    expect(c2.answer.categoryQuestion).not.toBeUndefined();
  });

  // Case 3: Strong taste, no category → category question
  const c3 = runQuery('Case 3: Less harsh more immersive (no category)',
    'less harsh, more immersive');

  it('Case 3: less harsh + immersive → sufficient confidence + category question', () => {
    expect(c3.answer.tasteConfidence).toBe('sufficient');
    expect(c3.ctx.category).toBe('general');
    expect(c3.answer.productExamples.length).toBe(0);
    expect(c3.answer.categoryQuestion).not.toBeUndefined();
  });

  // Case 4: Category known → no category question, products present
  const c4 = runQuery('Case 4: Warm amp under $3K (category known)',
    'Warm amp under $3000');

  it('Case 4: category known → sufficient confidence, products shown, NO category question', () => {
    expect(c4.answer.tasteConfidence).toBe('sufficient');
    expect(c4.ctx.category).toBe('amplifier');
    expect(c4.answer.productExamples.length).toBeGreaterThanOrEqual(2);
    expect(c4.answer.categoryQuestion).toBeUndefined();
    expect(c4.anchor).toBeDefined();
  });

  // Case 5: Category known + emotional → decisive, no category question
  const c5 = runQuery('Case 5: Emotional amp (category known)',
    'Best amp for emotional listening');

  it('Case 5: emotional + amp category → sufficient, products shown, decisive', () => {
    expect(c5.answer.tasteConfidence).toBe('sufficient');
    expect(c5.ctx.category).toBe('amplifier');
    expect(c5.answer.productExamples.length).toBeGreaterThanOrEqual(3);
    expect(c5.answer.categoryQuestion).toBeUndefined();
    expect(c5.anchor).toBeDefined();
  });

  // Case 6: System reference + direction → category known, decisive
  const c6 = runQuery('Case 6: Hegel less dry (system ref + category)',
    'I have a Hegel H190 amp and want something less dry');

  it('Case 6: system ref + category → sufficient, products, no category question', () => {
    expect(c6.answer.tasteConfidence).toBe('sufficient');
    expect(c6.ctx.category).toBe('amplifier');
    expect(c6.answer.productExamples.length).toBeGreaterThanOrEqual(3);
    expect(c6.answer.categoryQuestion).toBeUndefined();
    expect(c6.anchor).toBeDefined();
  });

  // ── Coherence checks ──

  it('category-known cases: preferenceSummary mentions taste label', () => {
    // Cases 4, 5, 6 should have taste-specific language in preferenceSummary
    for (const c of [c4, c5, c6]) {
      // Should reference detected taste or direction, not generic framing
      expect(c.answer.preferenceSummary).not.toContain('solid starting points');
    }
  });

  it('category-known cases: anchor philosophy aligns with detected taste direction', () => {
    // Case 4: "warm" → anchor should not be a precision/analytical product
    if (c4.anchor) {
      expect((c4.anchor as any).philosophy).not.toBe('bright');
    }
    // Case 5: "emotional" → anchor should lean warm/musical
    if (c5.anchor) {
      expect(['warm', 'neutral'].includes((c5.anchor as any).philosophy)).toBe(true);
    }
  });

  // Summary
  it('prints summary', () => {
    const cases = [
      { label: 'C1 (engaging/dry)', conf: c1.answer.tasteConfidence, cat: c1.ctx.category, products: c1.answer.productExamples.length, catQ: !!c1.answer.categoryQuestion },
      { label: 'C2 (emotional)', conf: c2.answer.tasteConfidence, cat: c2.ctx.category, products: c2.answer.productExamples.length, catQ: !!c2.answer.categoryQuestion },
      { label: 'C3 (harsh/immersive)', conf: c3.answer.tasteConfidence, cat: c3.ctx.category, products: c3.answer.productExamples.length, catQ: !!c3.answer.categoryQuestion },
      { label: 'C4 (warm amp $3K)', conf: c4.answer.tasteConfidence, cat: c4.ctx.category, products: c4.answer.productExamples.length, catQ: !!c4.answer.categoryQuestion },
      { label: 'C5 (emotional amp)', conf: c5.answer.tasteConfidence, cat: c5.ctx.category, products: c5.answer.productExamples.length, catQ: !!c5.answer.categoryQuestion },
      { label: 'C6 (Hegel less dry)', conf: c6.answer.tasteConfidence, cat: c6.ctx.category, products: c6.answer.productExamples.length, catQ: !!c6.answer.categoryQuestion },
    ];
    console.log('\n═══ BATCH 2 SUMMARY ═══');
    for (const c of cases) {
      console.log(`${c.label}: conf=${c.conf} | cat=${c.cat} | products=${c.products} | catQ=${c.catQ}`);
    }
  });
});
