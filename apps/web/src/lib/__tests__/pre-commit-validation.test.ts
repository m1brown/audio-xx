/**
 * Pre-Commit Validation — Final end-to-end check across all completed work.
 * Covers: anchor policy, taste confidence, signal detection, category-light,
 * multi-turn, and guardrail enforcement.
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
  if (/immersive/i.test(lower)) {
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
  console.log(`  anchor=${a ? `${a.brand} ${a.name} ($${a.price}) [${a.catalogTopology}] avail=${(a as any).availability}` : 'NONE'}`);
  console.log(`  catQ=${answer.categoryQuestion ?? 'none'} tasteQ=${answer.tasteQuestion ?? 'none'}`);
  console.log(`  prefSum=${answer.preferenceSummary.substring(0, 70)}...`);
  console.log(`  direction=${answer.bestFitDirection.substring(0, 70)}...`);

  return { answer, ctx, a };
}

function prevFrom(r: ReturnType<typeof run>): PreviousAnchor | null {
  if (!r.a) return null;
  return { name: r.a.name, brand: r.a.brand, philosophy: r.a.philosophy as any,
    marketType: r.a.marketType as any, primaryAxes: r.a.primaryAxes as any };
}

describe('Pre-Commit Validation', () => {

  // ── 1. Ordinary shopping ──
  const t1 = run('T1: Best amp under $2K', 'Best amp under $2,000', 'Best amp under $2,000', 'default', null, []);

  it('T1: ordinary → low or sufficient, category=amplifier, products≥2, sensible anchor', () => {
    expect(t1.ctx.category).toBe('amplifier');
    expect(t1.answer.productExamples.length).toBeGreaterThanOrEqual(2);
    expect(t1.a).toBeDefined();
    expect(t1.answer.categoryQuestion).toBeUndefined();
    // anchor not vintage, not SET
    expect((t1.a as any).availability).not.toBe('vintage');
    expect((t1.a as any).catalogTopology).not.toBe('set');
  });

  // ── 2. Strong taste + known category ──
  const t2 = run('T2: Warm amp $3K', 'Warm amp under $3,000', 'Warm amp under $3,000', 'default', null, []);

  it('T2: warm + category → sufficient, products, no category question', () => {
    expect(t2.answer.tasteConfidence).toBe('sufficient');
    expect(t2.ctx.category).toBe('amplifier');
    expect(t2.answer.productExamples.length).toBeGreaterThanOrEqual(2);
    expect(t2.answer.categoryQuestion).toBeUndefined();
    // preferenceSummary should NOT be generic
    expect(t2.answer.preferenceSummary).not.toContain('solid starting points');
  });

  // ── 3. Strong taste + missing category ──
  const t3 = run('T3: Engaging less dry', 'I want something more engaging and less dry',
    'I want something more engaging and less dry', 'default', null, []);

  it('T3: taste but no category → sufficient, 0 products, category question', () => {
    expect(t3.answer.tasteConfidence).toBe('sufficient');
    expect(t3.ctx.category).toBe('general');
    expect(t3.answer.productExamples.length).toBe(0);
    expect(t3.answer.categoryQuestion).toBeDefined();
  });

  const t4 = run('T4: Emotional sound', 'I want a more emotional sound',
    'I want a more emotional sound', 'default', null, []);

  it('T4: emotional + no category → sufficient, 0 products, category question', () => {
    expect(t4.answer.tasteConfidence).toBe('sufficient');
    expect(t4.ctx.category).toBe('general');
    expect(t4.answer.productExamples.length).toBe(0);
    expect(t4.answer.categoryQuestion).toBeDefined();
  });

  // ── 4. System reference + direction ──
  const t5 = run('T5: Hegel less dry', 'I have a Hegel H190 amp and want something less dry',
    'I have a Hegel H190 amp and want something less dry', 'default', null, []);

  it('T5: system ref + direction → sufficient, category=amplifier, products, no catQ', () => {
    expect(t5.answer.tasteConfidence).toBe('sufficient');
    expect(t5.ctx.category).toBe('amplifier');
    expect(t5.answer.productExamples.length).toBeGreaterThanOrEqual(2);
    expect(t5.answer.categoryQuestion).toBeUndefined();
  });

  // ── 5. Specialist: SET explicit ──
  const t6 = run('T6: SET amp', 'I want a SET amp', 'I want a SET amp', 'default', null, []);

  it('T6: explicit SET → SET in list, sufficient confidence', () => {
    expect(t6.answer.tasteConfidence).toBe('sufficient');
    const hasSET = t6.answer.productExamples.some(p => p.catalogTopology === 'set');
    expect(hasSET).toBe(true);
  });

  const t7 = run('T7: Single-ended triode', 'I want a single-ended triode amplifier',
    'I want a single-ended triode amplifier', 'default', null, []);

  it('T7: explicit triode → SET in list, sufficient confidence', () => {
    expect(t7.answer.tasteConfidence).toBe('sufficient');
    const hasSET = t7.answer.productExamples.some(p => p.catalogTopology === 'set');
    expect(hasSET).toBe(true);
  });

  // ── 6. Multi-turn refinement ──
  const m1 = run('M1: Amp under $2K', 'Looking for an amp under $2,000',
    'Looking for an amp under $2,000', 'default', null, []);

  const m2text = 'Looking for an amp under $2,000\nMake it warmer and more engaging';
  const m2 = run('M2: Warmer', m2text, 'Make it warmer and more engaging',
    'default', prevFrom(m1), m1.answer.productExamples.map(p => `${p.brand} ${p.name}`));

  const m3text = m2text + '\nShow me something different';
  const m3 = run('M3: Different', m3text, 'Show me something different',
    detectSelectionMode('Show me something different'),
    prevFrom(m2), m2.answer.productExamples.map(p => `${p.brand} ${p.name}`),
    'amplifier');

  it('M1→M2→M3: multi-turn produces distinct anchors', () => {
    expect(m1.ctx.category).toBe('amplifier');
    expect(m2.ctx.category).toBe('amplifier');
    expect(m3.ctx.category).toBe('amplifier');
    // All should have products
    expect(m1.answer.productExamples.length).toBeGreaterThanOrEqual(2);
    expect(m2.answer.productExamples.length).toBeGreaterThanOrEqual(2);
    expect(m3.answer.productExamples.length).toBeGreaterThanOrEqual(2);
    // M3 should have different anchor than M2
    if (m2.a && m3.a) {
      expect(`${m3.a.brand} ${m3.a.name}`).not.toBe(`${m2.a.brand} ${m2.a.name}`);
    }
  });

  // ── 7. Guardrail enforcement ──

  it('GUARD: no vintage anchor in any default-mode case', () => {
    for (const t of [t1, t2, t5, m1, m2]) {
      if (t.a) {
        expect((t.a as any).availability).not.toBe('vintage');
      }
    }
  });

  it('GUARD: no SET anchor without explicit intent', () => {
    for (const t of [t1, t2, t5, m1, m2]) {
      if (t.a) {
        expect((t.a as any).catalogTopology).not.toBe('set');
      }
    }
  });

  it('GUARD: category question only when category=general + no products', () => {
    // Should have catQ
    expect(t3.answer.categoryQuestion).toBeDefined();
    expect(t4.answer.categoryQuestion).toBeDefined();
    // Should NOT have catQ
    expect(t1.answer.categoryQuestion).toBeUndefined();
    expect(t2.answer.categoryQuestion).toBeUndefined();
    expect(t5.answer.categoryQuestion).toBeUndefined();
    expect(t6.answer.categoryQuestion).toBeUndefined();
  });

  it('GUARD: no contradiction — sufficient confidence cases have taste-specific language', () => {
    for (const t of [t2, t5]) {
      expect(t.answer.preferenceSummary).not.toContain('solid starting points');
      expect(t.answer.bestFitDirection.length).toBeGreaterThan(30);
    }
  });

  // ── Summary ──
  it('prints full summary', () => {
    const all = [
      { l: 'T1 (best amp $2K)', ...t1 },
      { l: 'T2 (warm $3K)', ...t2 },
      { l: 'T3 (engaging/dry)', ...t3 },
      { l: 'T4 (emotional)', ...t4 },
      { l: 'T5 (Hegel dry)', ...t5 },
      { l: 'T6 (SET)', ...t6 },
      { l: 'T7 (triode)', ...t7 },
      { l: 'M1 (amp $2K)', ...m1 },
      { l: 'M2 (warmer)', ...m2 },
      { l: 'M3 (different)', ...m3 },
    ];
    console.log('\n═══════════════════════════════════════');
    console.log('    PRE-COMMIT VALIDATION SUMMARY');
    console.log('═══════════════════════════════════════');
    for (const t of all) {
      const anchor = t.a ? `${t.a.brand} ${t.a.name} [${t.a.catalogTopology}]` : 'NONE';
      console.log(`${t.l}: conf=${t.answer.tasteConfidence} cat=${t.ctx.category} prods=${t.answer.productExamples.length} anchor=${anchor} catQ=${!!t.answer.categoryQuestion}`);
    }
  });
});
