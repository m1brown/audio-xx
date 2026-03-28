/**
 * Batch 1 Validation — Intake + Signal Detection Upgrade
 * 5 test cases verifying confidence, anchoring, and signal detection improvements.
 */
import { describe, it, expect } from 'vitest';
import {
  detectShoppingIntent,
  buildShoppingAnswer,
  computeTasteConfidence,
  hasDirectionSignal,
  hasDislikeSignal,
  deriveSemanticPreferences,
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
  if (/horn|low[\s-]?power|high[\s-]?efficiency/i.test(lower)) {
    archetype_hints.push('specialist_path');
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
  console.log(`  anchor: ${anchor?.brand} ${anchor?.name} ($${anchor?.price})`);
  console.log(`  products: ${answer.productExamples.length}`);
  console.log(`  semanticWeights: ${ctx.semanticPreferences.weights.length}`);
  console.log(`  specialistHints: ${JSON.stringify(ctx.semanticPreferences.specialistHints)}`);
  console.log(`  tasteQuestion: ${answer.tasteQuestion ?? 'none'}`);

  return { answer, ctx, anchor, signals };
}

describe('Batch 1: Intake + Signal Detection Upgrade', () => {

  // ── Signal detection unit tests ──

  describe('direction signal detection', () => {
    it('detects emotional/involvement language', () => {
      expect(hasDirectionSignal('I want something engaging')).toBe(true);
      expect(hasDirectionSignal('Best amp for emotional listening')).toBe(true);
      expect(hasDirectionSignal('Something more involving')).toBe(true);
      expect(hasDirectionSignal('I want an immersive experience')).toBe(true);
    });

    it('detects comparative negation', () => {
      expect(hasDirectionSignal('I want something less dry')).toBe(true);
      expect(hasDirectionSignal('less harsh than what I have')).toBe(true);
      expect(hasDirectionSignal('less clinical sounding')).toBe(true);
    });

    it('detects "more X" phrasing', () => {
      expect(hasDirectionSignal('I want more body')).toBe(true);
      expect(hasDirectionSignal('more warmth and presence')).toBe(true);
      expect(hasDirectionSignal('I need more slam')).toBe(true);
    });

    it('still detects existing patterns', () => {
      expect(hasDirectionSignal('warm sounding')).toBe(true);
      expect(hasDirectionSignal('bright and detailed')).toBe(true);
      expect(hasDirectionSignal('punchy bass')).toBe(true);
    });
  });

  describe('dislike signal detection', () => {
    it('detects comparative negation as dislike', () => {
      expect(hasDislikeSignal('less dry')).toBe(true);
      expect(hasDislikeSignal('less harsh')).toBe(true);
      expect(hasDislikeSignal('less clinical')).toBe(true);
    });

    it('still detects existing patterns', () => {
      expect(hasDislikeSignal('too harsh')).toBe(true);
      expect(hasDislikeSignal("I don't like bright sound")).toBe(true);
    });
  });

  describe('semantic preferences', () => {
    it('extracts weights for emotional language', () => {
      const prefs = deriveSemanticPreferences('I want an emotional, soulful sound');
      expect(prefs.weights.length).toBeGreaterThan(0);
      const flowWeight = prefs.weights.find(w => w.trait === 'flow');
      expect(flowWeight).toBeDefined();
      expect(flowWeight!.weight).toBeGreaterThan(0);
    });

    it('extracts weights for comparative negation', () => {
      const prefs = deriveSemanticPreferences('I want something less dry');
      expect(prefs.weights.length).toBeGreaterThan(0);
      const warmthWeight = prefs.weights.find(w => w.trait === 'warmth');
      expect(warmthWeight).toBeDefined();
    });

    it('captures specialist hints', () => {
      const prefs = deriveSemanticPreferences('I like horn speakers and low power tube amps');
      expect(prefs.specialistHints).toContain('horn_higheff');
      expect(prefs.specialistHints).toContain('low_power');
    });

    it('captures SET specialist hints from brands', () => {
      const prefs = deriveSemanticPreferences('Decware or First Watt amps');
      expect(prefs.specialistHints).toContain('set_triode');
      expect(prefs.specialistHints).toContain('specialist_amp');
    });
  });

  // ── Full pipeline validation (5 spec cases) ──

  const c1 = runQuery('Case 1: Vague upgrade', 'I need a better amp');
  const c2 = runQuery('Case 2: Warm under $3K', 'Warm amp under $3000');
  const c3 = runQuery('Case 3: Engaging less dry', 'I want something more engaging and less dry');
  const c4 = runQuery('Case 4: Emotional listening', 'Best amp for emotional listening');
  const c5 = runQuery('Case 5: Horn + low power', 'I like horn speakers and low power tube amps');

  // Case 1: truly vague → low confidence, still produces results
  it('Case 1: vague input → low confidence, sensible anchor', () => {
    expect(c1.answer.tasteConfidence).toBe('low');
    expect(c1.answer.productExamples.length).toBeGreaterThanOrEqual(3);
    expect(c1.anchor).toBeDefined();
  });

  // Case 2: clear direction + budget + category → sufficient
  it('Case 2: warm + budget → sufficient confidence', () => {
    expect(c2.answer.tasteConfidence).toBe('sufficient');
    expect(c2.ctx.category).toBe('amplifier');
    expect(c2.anchor).toBeDefined();
  });

  // Case 3: "engaging" + "less dry" now detected as direction + dislike
  it('Case 3: engaging + less dry → sufficient confidence', () => {
    expect(c3.answer.tasteConfidence).toBe('sufficient');
    expect(c3.ctx.semanticPreferences.weights.length).toBeGreaterThan(0);
  });

  // Case 4: "emotional" now detected as direction signal
  it('Case 4: emotional listening → sufficient confidence', () => {
    expect(c4.answer.tasteConfidence).toBe('sufficient');
    expect(c4.ctx.category).toBe('amplifier');
  });

  // Case 5: horn + low power → specialist hints captured, sufficient confidence
  it('Case 5: horn + low power → specialist hints detected, sufficient confidence', () => {
    expect(c5.ctx.semanticPreferences.specialistHints).toContain('horn_higheff');
    expect(c5.ctx.semanticPreferences.specialistHints).toContain('low_power');
    expect(c5.answer.tasteConfidence).toBe('sufficient');
    expect(c5.anchor).toBeDefined();
  });

  // No regression: anchor eligibility rules still work
  it('no regression: anchors are not vintage or SET by default', () => {
    for (const c of [c1, c2, c3, c4]) {
      if (c.anchor) {
        expect((c.anchor as any).availability).not.toBe('vintage');
        // SET should not anchor unless explicitly requested
        expect((c.anchor as any).catalogTopology).not.toBe('set');
      }
    }
  });

  // Summary
  it('prints summary', () => {
    const cases = [
      { label: 'C1 (vague)', conf: c1.answer.tasteConfidence, anchor: `${c1.anchor?.brand} ${c1.anchor?.name}` },
      { label: 'C2 (warm $3K)', conf: c2.answer.tasteConfidence, anchor: `${c2.anchor?.brand} ${c2.anchor?.name}` },
      { label: 'C3 (engaging)', conf: c3.answer.tasteConfidence, anchor: `${c3.anchor?.brand} ${c3.anchor?.name}` },
      { label: 'C4 (emotional)', conf: c4.answer.tasteConfidence, anchor: `${c4.anchor?.brand} ${c4.anchor?.name}` },
      { label: 'C5 (horn+LP)', conf: c5.answer.tasteConfidence, anchor: `${c5.anchor?.brand} ${c5.anchor?.name}` },
    ];
    console.log('\n═══ BATCH 1 SUMMARY ═══');
    for (const c of cases) {
      console.log(`${c.label}: confidence=${c.conf} | anchor=${c.anchor}`);
    }
  });
});
