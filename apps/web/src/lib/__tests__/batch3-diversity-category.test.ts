/**
 * Batch 3 Validation — Diversity, Category Accuracy, First Response Quality
 */
import { describe, it, expect } from 'vitest';
import {
  detectShoppingIntent,
  buildShoppingAnswer,
  detectSelectionMode,
  type PreviousAnchor,
  type SelectionMode,
} from '../shopping-intent';
import { reason } from '../reasoning';
import { extractDesires } from '../intent';
import type { ExtractedSignals } from '../signal-types';

function buildSignals(text: string): ExtractedSignals {
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
  if (/\bset\b|single.ended|triode|decware|yamamoto/i.test(lower)) {
    archetype_hints.push('set_topology');
  }
  return {
    traits, symptoms: [], archetype_hints,
    uncertainty_level: Object.keys(traits).length === 0 ? 0.8 : 0.2,
    matched_phrases: [], matched_uncertainty_markers: [],
  };
}

function run(label: string, allText: string, latest: string, mode: SelectionMode,
  prev: PreviousAnchor | null, recent: string[], fallbackCat?: string) {
  const signals = buildSignals(allText);
  const desires = extractDesires(allText);
  const ctx = detectShoppingIntent(allText, signals, [], latest, fallbackCat as any);
  const reasoning = reason(allText, desires, signals, null, ctx, undefined);
  const answer = buildShoppingAnswer(ctx, signals, undefined, reasoning, [], [], undefined, mode, prev, recent);
  const a = answer.productExamples[0];
  console.log(`\n═══ ${label} ═══`);
  console.log(`  conf=${answer.tasteConfidence} cat=${ctx.category} products=${answer.productExamples.length}`);
  console.log(`  anchor=${a ? `${a.brand} ${a.name}` : 'NONE'}`);
  console.log(`  prefSum=${answer.preferenceSummary.substring(0, 80)}...`);
  console.log(`  direction=${answer.bestFitDirection.substring(0, 80)}...`);
  return { answer, ctx, a };
}

function prevFrom(r: ReturnType<typeof run>): PreviousAnchor | null {
  if (!r.a) return null;
  return { name: r.a.name, brand: r.a.brand, philosophy: r.a.philosophy as any,
    marketType: r.a.marketType as any, primaryAxes: r.a.primaryAxes as any };
}

describe('Batch 3: Diversity, Category Accuracy, First Response Quality', () => {

  // ═══ Category detection correctness ═══

  describe('category detection (word-boundary)', () => {
    it('"amp" → amplifier (not speaker)', () => {
      const ctx = detectShoppingIntent('I need a better amp', buildSignals('I need a better amp'), [], 'I need a better amp');
      expect(ctx.category).toBe('amplifier');
    });

    it('"example speakers" → speaker (not amplifier)', () => {
      const ctx = detectShoppingIntent('example speakers for my room', buildSignals(''), [], 'example speakers for my room');
      expect(ctx.category).toBe('speaker');
    });

    it('"sample of headphones" → headphone (not amplifier)', () => {
      const ctx = detectShoppingIntent('a sample of headphones', buildSignals(''), [], 'a sample of headphones');
      expect(ctx.category).toBe('headphone');
    });

    it('"warm amp under $3000" → amplifier', () => {
      const ctx = detectShoppingIntent('warm amp under $3000', buildSignals('warm amp'), [], 'warm amp under $3000');
      expect(ctx.category).toBe('amplifier');
    });

    it('"headphone amp" → amplifier', () => {
      const ctx = detectShoppingIntent('headphone amp recommendation', buildSignals(''), [], 'headphone amp recommendation');
      // "amp" should match amplifier before "headphone" matches headphone
      // since amplifier comes before headphone in pattern order
      expect(ctx.category).toBe('amplifier');
    });

    it('"bookshelf speakers" → speaker', () => {
      const ctx = detectShoppingIntent('best bookshelf speakers', buildSignals(''), [], 'best bookshelf speakers');
      expect(ctx.category).toBe('speaker');
    });

    it('"DAC" → dac', () => {
      const ctx = detectShoppingIntent('best DAC under $500', buildSignals(''), [], 'best DAC under $500');
      expect(ctx.category).toBe('dac');
    });
  });

  // ═══ First response quality for vague inputs ═══

  describe('first response quality', () => {
    const vague = run('Vague: better amp', 'I need a better amp', 'I need a better amp', 'default', null, []);

    it('vague input produces products', () => {
      expect(vague.answer.productExamples.length).toBeGreaterThanOrEqual(2);
    });

    it('vague input produces orientating direction text', () => {
      // Should mention "amplifier" context and describe design approaches
      expect(vague.answer.bestFitDirection).toContain('amplifier');
      expect(vague.answer.bestFitDirection.length).toBeGreaterThan(50);
    });

    it('vague input produces substantive preference summary', () => {
      // Should NOT be overly generic
      expect(vague.answer.preferenceSummary.toLowerCase()).toContain('amplifier');
      expect(vague.answer.preferenceSummary.length).toBeGreaterThan(20);
    });

    it('vague input still asks taste question', () => {
      expect(vague.answer.tasteQuestion).toBeDefined();
    });
  });

  // ═══ Multi-turn diversity / over-convergence prevention ═══

  describe('multi-turn anchor diversity', () => {
    // Turn 1: initial query
    const t1 = run('Div-T1: amp $2K', 'Looking for an amp under $2,000',
      'Looking for an amp under $2,000', 'default', null, []);

    // Turn 2: same query, with previous anchor
    const t2 = run('Div-T2: repeat', 'Looking for an amp under $2,000',
      'Looking for an amp under $2,000', 'default', prevFrom(t1),
      t1.answer.productExamples.map(p => `${p.brand} ${p.name}`));

    it('T2 does NOT re-anchor on T1 anchor', () => {
      if (t1.a && t2.a) {
        expect(`${t2.a.brand} ${t2.a.name}`).not.toBe(`${t1.a.brand} ${t1.a.name}`);
      }
    });

    // Turn 3: "different" from T2
    const t3text = 'Looking for an amp under $2,000\nShow me something different';
    const t3 = run('Div-T3: different', t3text, 'Show me something different',
      detectSelectionMode('Show me something different'),
      prevFrom(t2), t2.answer.productExamples.map(p => `${p.brand} ${p.name}`),
      'amplifier');

    it('T3 ("different") produces distinct anchor from T2', () => {
      if (t2.a && t3.a) {
        expect(`${t3.a.brand} ${t3.a.name}`).not.toBe(`${t2.a.brand} ${t2.a.name}`);
      }
    });

    it('3-turn sequence produces 3 unique anchors', () => {
      const anchors = [t1, t2, t3].filter(t => t.a).map(t => `${t.a!.brand} ${t.a!.name}`);
      const unique = new Set(anchors);
      expect(unique.size).toBe(anchors.length);
    });

    // Summary
    it('prints diversity summary', () => {
      console.log('\n═══ DIVERSITY SUMMARY ═══');
      for (const [label, t] of [['T1', t1], ['T2', t2], ['T3', t3]] as const) {
        console.log(`${label}: anchor=${t.a ? `${t.a.brand} ${t.a.name}` : 'NONE'}`);
      }
    });
  });

  // ═══ Full pipeline validation (6 spec cases) ═══

  const c1 = run('C1: better amp', 'I need a better amp', 'I need a better amp', 'default', null, []);
  const c2 = run('C2: warm $3K', 'Warm amp under $3000', 'Warm amp under $3000', 'default', null, []);
  const c3 = run('C3: engaging dry', 'I want something more engaging and less dry',
    'I want something more engaging and less dry', 'default', null, []);
  const c4 = run('C4: emotional', 'Best amp for emotional listening',
    'Best amp for emotional listening', 'default', null, []);
  const c5 = run('C5: SET', 'I want a SET amp', 'I want a SET amp', 'default', null, []);

  // Multi-turn
  const m1 = run('M-T1', 'Looking for an amp under $2,000', 'Looking for an amp under $2,000',
    'default', null, []);
  const m2text = 'Looking for an amp under $2,000\nMake it warmer and more engaging';
  const m2 = run('M-T2', m2text, 'Make it warmer and more engaging',
    'default', prevFrom(m1), m1.answer.productExamples.map(p => `${p.brand} ${p.name}`));
  const m3text = m2text + '\nShow me something different';
  const m3 = run('M-T3', m3text, 'Show me something different',
    detectSelectionMode('Show me something different'),
    prevFrom(m2), m2.answer.productExamples.map(p => `${p.brand} ${p.name}`),
    'amplifier');

  it('C1: category=amplifier', () => expect(c1.ctx.category).toBe('amplifier'));
  it('C2: category=amplifier, sufficient', () => {
    expect(c2.ctx.category).toBe('amplifier');
    expect(c2.answer.tasteConfidence).toBe('sufficient');
  });
  it('C3: strong taste, no category → catQ', () => {
    expect(c3.answer.categoryQuestion).toBeDefined();
  });
  it('C4: emotional amp → sufficient', () => {
    expect(c4.ctx.category).toBe('amplifier');
    expect(c4.answer.tasteConfidence).toBe('sufficient');
  });
  it('C5: SET → SET in list', () => {
    expect(c5.answer.productExamples.some(p => p.catalogTopology === 'set')).toBe(true);
  });
  it('multi-turn: all produce products, distinct anchors', () => {
    expect(m1.answer.productExamples.length).toBeGreaterThanOrEqual(2);
    expect(m2.answer.productExamples.length).toBeGreaterThanOrEqual(2);
    expect(m3.answer.productExamples.length).toBeGreaterThanOrEqual(2);
    if (m2.a && m3.a) {
      expect(`${m3.a.brand} ${m3.a.name}`).not.toBe(`${m2.a.brand} ${m2.a.name}`);
    }
  });

  // Guardrails preserved
  it('GUARD: no vintage/SET anchor without intent', () => {
    for (const t of [c1, c2, c4, m1, m2]) {
      if (t.a) {
        expect((t.a as any).availability).not.toBe('vintage');
        expect((t.a as any).catalogTopology).not.toBe('set');
      }
    }
  });
});
