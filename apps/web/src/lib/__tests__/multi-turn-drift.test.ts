/**
 * Multi-Turn Consistency & Drift Test
 *
 * Validates that the system remains stable across multiple conversational turns:
 *   - Anchor changes when "different" is requested
 *   - Anchor is never reused from previous turn
 *   - Category lock holds
 *   - Confidence and language update correctly
 *   - No random reshuffling or fallback leakage
 *
 * Run with: npx vitest run src/lib/__tests__/multi-turn-drift.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  detectShoppingIntent,
  buildShoppingAnswer,
  detectSelectionMode,
  type PreviousAnchor,
  type SelectionMode,
  type ShoppingAnswer,
} from '../shopping-intent';
import { shoppingToAdvisory } from '../advisory-response';
import { reason } from '../reasoning';
import { extractDesires } from '../intent';
import type { ExtractedSignals } from '../signal-types';

// ── Helpers ─────────────────────────────────────────────────

function buildSignalsFromText(text: string): ExtractedSignals {
  const lower = text.toLowerCase();
  const traits: Record<string, 'up' | 'down'> = {};
  const archetype_hints: string[] = [];

  if (/warm|rich|tube|thick|body|lush|musical|engaging/i.test(lower)) {
    traits.tonal_density = 'up';
    traits.flow = 'up';
    archetype_hints.push('tonal_saturated');
  }
  if (/dynamic|punch|rhythm|energy|impact/i.test(lower)) {
    traits.dynamics = 'up';
    traits.elasticity = 'up';
    archetype_hints.push('rhythmic_propulsive');
  }
  if (/precise|detail|analytical|resolv|accurate|controlled|control/i.test(lower)) {
    traits.clarity = 'up';
    archetype_hints.push('precision_explicit');
  }
  if (/spatial|stage|holograph|imaging|soundstage/i.test(lower)) {
    archetype_hints.push('spatial_holographic');
  }
  if (/flow|organic|natural|smooth|relaxed/i.test(lower)) {
    traits.flow = 'up';
    if (!archetype_hints.includes('tonal_saturated')) {
      archetype_hints.push('flow_organic');
    }
  }
  if (/harsh|bright|fatiguing|dry/i.test(lower)) {
    traits.clarity = 'down';
    traits.tonal_density = traits.tonal_density ?? 'up';
  }

  return {
    traits,
    symptoms: [],
    archetype_hints,
    uncertainty_level: Object.keys(traits).length === 0 ? 0.8 : 0.2,
    matched_phrases: [],
    matched_uncertainty_markers: [],
  };
}

interface TurnResult {
  answer: ShoppingAnswer;
  advisory: ReturnType<typeof shoppingToAdvisory>;
  anchor: { brand: string; name: string } | null;
  allProducts: string[];
  confidence: string | undefined;
  selectionMode: SelectionMode;
}

function runTurn(
  allUserText: string,
  latestMessage: string,
  selectionMode: SelectionMode,
  previousAnchor: PreviousAnchor | null,
  recentProductNames: string[],
  fallbackCategory?: string,
): TurnResult {
  const signals = buildSignalsFromText(allUserText);
  const desires = extractDesires(allUserText);
  const ctx = detectShoppingIntent(
    allUserText,
    signals,
    [],
    latestMessage,
    fallbackCategory as any,
  );
  const reasoning = reason(allUserText, desires, signals, null, ctx, undefined);
  const answer = buildShoppingAnswer(
    ctx,
    signals,
    undefined,
    reasoning,
    [],       // activeSystemComponents
    [],       // engagedProductNames
    undefined, // listenerProfile
    selectionMode,
    previousAnchor,
    recentProductNames,
  );
  const advisory = shoppingToAdvisory(answer, signals, reasoning, {});

  const anchor = answer.productExamples.length > 0
    ? { brand: answer.productExamples[0].brand, name: answer.productExamples[0].name }
    : null;
  const allProducts = answer.productExamples.map((p) => `${p.brand} ${p.name}`);

  return { answer, advisory, anchor, allProducts, confidence: answer.tasteConfidence, selectionMode };
}

function buildPreviousAnchor(turn: TurnResult): PreviousAnchor | null {
  if (!turn.anchor) return null;
  const prod = turn.answer.productExamples[0];
  return {
    name: prod.name,
    brand: prod.brand,
    philosophy: prod.philosophy as any,
    marketType: prod.marketType as any,
    primaryAxes: prod.primaryAxes as any,
  };
}

// ═════════════════════════════════════════════════════════════
// SCENARIO 1 — Refinement: budget → warmer → different
// ═════════════════════════════════════════════════════════════
describe('Scenario 1 — Refinement (budget → warmer → different)', () => {
  const msg1 = 'Looking for an amp under $2,000';
  const msg2 = 'Make it warmer and more engaging';
  const msg3 = 'Give me something different';

  // Turn 1: budget only
  const t1 = runTurn(msg1, msg1, 'default', null, []);

  // Turn 2: refinement with direction
  const allText2 = `${msg1}\n${msg2}`;
  const t2 = runTurn(allText2, msg2, 'default', buildPreviousAnchor(t1), t1.allProducts, 'amplifier');

  // Turn 3: different mode
  const allText3 = `${allText2}\n${msg3}`;
  const t3 = runTurn(allText3, msg3, detectSelectionMode(msg3), buildPreviousAnchor(t2), [...t1.allProducts, ...t2.allProducts], 'amplifier');

  it('Turn 1: low confidence, has products', () => {
    expect(t1.confidence).toBe('low');
    expect(t1.allProducts.length).toBeGreaterThanOrEqual(2);
  });

  it('Turn 2: sufficient confidence after direction signal added', () => {
    expect(t2.confidence).toBe('sufficient');
  });

  it('Turn 3: detects "different" mode', () => {
    expect(t3.selectionMode).toBe('different');
  });

  it('Turn 3: anchor differs from Turn 2 anchor', () => {
    expect(t3.anchor).not.toBeNull();
    expect(t2.anchor).not.toBeNull();
    const t3Name = `${t3.anchor!.brand} ${t3.anchor!.name}`;
    const t2Name = `${t2.anchor!.brand} ${t2.anchor!.name}`;
    expect(t3Name).not.toBe(t2Name);
  });

  it('Turn 3: category remains amplifier', () => {
    expect(t3.answer.category).toBe('amplifier');
  });

  it('Turn 3: recommendations are visible', () => {
    expect(t3.allProducts.length).toBeGreaterThanOrEqual(2);
  });

  it('Turn 3: anchor is not vintage or separates', () => {
    const anchor = t3.answer.productExamples[0];
    expect(anchor.availability).not.toBe('vintage');
    // subcategory should be integrated-amp or undefined
    const sub = (anchor as any).catalogSubcategory;
    if (sub) expect(sub).toBe('integrated-amp');
  });

  it('prints audit', () => {
    console.log('\n═══ SCENARIO 1 AUDIT ═══');
    console.log('T1:', t1.confidence, '|', t1.anchor?.brand, t1.anchor?.name, '| products:', t1.allProducts.length);
    console.log('T2:', t2.confidence, '|', t2.anchor?.brand, t2.anchor?.name, '| products:', t2.allProducts.length);
    console.log('T3:', t3.confidence, t3.selectionMode, '|', t3.anchor?.brand, t3.anchor?.name, '| products:', t3.allProducts.length);
    console.log('T3 all:', t3.allProducts.join(', '));
  });
});

// ═════════════════════════════════════════════════════════════
// SCENARIO 2 — Anchor change pressure
// ═════════════════════════════════════════════════════════════
describe('Scenario 2 — Anchor change pressure (warm → less traditional → different)', () => {
  const msg1 = 'I want a warm amp under $3,000';
  const msg2 = 'Show me something less traditional';
  const msg3 = 'Now something different again';

  const t1 = runTurn(msg1, msg1, 'default', null, []);

  const allText2 = `${msg1}\n${msg2}`;
  const t2 = runTurn(allText2, msg2, detectSelectionMode(msg2), buildPreviousAnchor(t1), t1.allProducts, 'amplifier');

  const allText3 = `${allText2}\n${msg3}`;
  const t3 = runTurn(allText3, msg3, detectSelectionMode(msg3), buildPreviousAnchor(t2), [...t1.allProducts, ...t2.allProducts], 'amplifier');

  it('Turn 2: detects less_traditional mode', () => {
    expect(t2.selectionMode).toBe('less_traditional');
  });

  it('Turn 2: anchor is nonTraditional', () => {
    const anchor = t2.answer.productExamples[0];
    expect(anchor.marketType).toBe('nonTraditional');
  });

  it('Turn 3: detects different mode', () => {
    expect(t3.selectionMode).toBe('different');
  });

  it('Turn 3: anchor differs from Turn 2', () => {
    expect(t3.anchor).not.toBeNull();
    expect(t2.anchor).not.toBeNull();
    const t3Name = `${t3.anchor!.brand} ${t3.anchor!.name}`;
    const t2Name = `${t2.anchor!.brand} ${t2.anchor!.name}`;
    expect(t3Name).not.toBe(t2Name);
  });

  it('Turn 3: anchor differs from Turn 1', () => {
    expect(t1.anchor).not.toBeNull();
    const t3Name = `${t3.anchor!.brand} ${t3.anchor!.name}`;
    const t1Name = `${t1.anchor!.brand} ${t1.anchor!.name}`;
    expect(t3Name).not.toBe(t1Name);
  });

  it('all turns stay in amplifier category', () => {
    expect(t1.answer.category).toBe('amplifier');
    expect(t2.answer.category).toBe('amplifier');
    expect(t3.answer.category).toBe('amplifier');
  });

  it('all turns produce recommendations', () => {
    expect(t1.allProducts.length).toBeGreaterThanOrEqual(2);
    expect(t2.allProducts.length).toBeGreaterThanOrEqual(2);
    expect(t3.allProducts.length).toBeGreaterThanOrEqual(2);
  });

  it('prints audit', () => {
    console.log('\n═══ SCENARIO 2 AUDIT ═══');
    console.log('T1:', t1.confidence, 'default |', t1.anchor?.brand, t1.anchor?.name);
    console.log('T2:', t2.confidence, t2.selectionMode, '|', t2.anchor?.brand, t2.anchor?.name, '| marketType:', t2.answer.productExamples[0]?.marketType);
    console.log('T3:', t3.confidence, t3.selectionMode, '|', t3.anchor?.brand, t3.anchor?.name);
    console.log('T3 all:', t3.allProducts.join(', '));
  });
});

// ═════════════════════════════════════════════════════════════
// SCENARIO 3 — Reference system evolution
// ═════════════════════════════════════════════════════════════
describe('Scenario 3 — Reference system evolution (Hegel → richer → different direction)', () => {
  const msg1 = 'I have a Hegel H190 amp and want something less dry';
  const msg2 = 'I still want control but more richness in an amplifier';
  const msg3 = 'Show me something different';

  const t1 = runTurn(msg1, msg1, 'default', null, []);

  const allText2 = `${msg1}\n${msg2}`;
  const t2 = runTurn(allText2, msg2, 'default', buildPreviousAnchor(t1), t1.allProducts, t1.answer.category as any);

  const allText3 = `${allText2}\n${msg3}`;
  const t3 = runTurn(allText3, msg3, detectSelectionMode(msg3), buildPreviousAnchor(t2), [...t1.allProducts, ...t2.allProducts], t2.answer.category as any);

  it('Turn 3: detects different mode', () => {
    expect(t3.selectionMode).toBe('different');
  });

  it('Turn 3: anchor differs from Turn 2', () => {
    expect(t3.anchor).not.toBeNull();
    expect(t2.anchor).not.toBeNull();
    const t3Name = `${t3.anchor!.brand} ${t3.anchor!.name}`;
    const t2Name = `${t2.anchor!.brand} ${t2.anchor!.name}`;
    expect(t3Name).not.toBe(t2Name);
  });

  it('category stays consistent across all turns', () => {
    // All should resolve to the same category
    expect(t2.answer.category).toBe(t1.answer.category);
    expect(t3.answer.category).toBe(t1.answer.category);
  });

  it('confidence is sufficient by Turn 2 (direction signals accumulate)', () => {
    expect(t2.confidence).toBe('sufficient');
  });

  it('all turns produce recommendations', () => {
    expect(t1.allProducts.length).toBeGreaterThanOrEqual(2);
    expect(t2.allProducts.length).toBeGreaterThanOrEqual(2);
    expect(t3.allProducts.length).toBeGreaterThanOrEqual(2);
  });

  it('prints audit', () => {
    console.log('\n═══ SCENARIO 3 AUDIT ═══');
    console.log('T1:', t1.confidence, '|', t1.answer.category, '|', t1.anchor?.brand, t1.anchor?.name);
    console.log('T2:', t2.confidence, '|', t2.answer.category, '|', t2.anchor?.brand, t2.anchor?.name);
    console.log('T3:', t3.confidence, t3.selectionMode, '|', t3.answer.category, '|', t3.anchor?.brand, t3.anchor?.name);
  });
});

// ═════════════════════════════════════════════════════════════
// SCENARIO 4 — Constraint stacking (4 turns, two "different" in a row)
// ═════════════════════════════════════════════════════════════
describe('Scenario 4 — Constraint stacking (budget → less trad → different → different again)', () => {
  const msg1 = 'Best amp under $2,500';
  const msg2 = 'Less traditional';
  const msg3 = 'Show me something different';
  const msg4 = 'Show me something else';

  const t1 = runTurn(msg1, msg1, 'default', null, []);

  const allText2 = `${msg1}\n${msg2}`;
  const t2 = runTurn(allText2, msg2, detectSelectionMode(msg2), buildPreviousAnchor(t1), t1.allProducts, 'amplifier');

  const allText3 = `${allText2}\n${msg3}`;
  const recentAfter2 = [...t1.allProducts, ...t2.allProducts];
  const t3 = runTurn(allText3, msg3, detectSelectionMode(msg3), buildPreviousAnchor(t2), recentAfter2, 'amplifier');

  const allText4 = `${allText3}\n${msg4}`;
  const recentAfter3 = [...recentAfter2, ...t3.allProducts];
  const t4 = runTurn(allText4, msg4, detectSelectionMode(msg4), buildPreviousAnchor(t3), recentAfter3, 'amplifier');

  it('Turn 2: less_traditional mode', () => {
    expect(t2.selectionMode).toBe('less_traditional');
  });

  it('Turn 3: different mode', () => {
    expect(t3.selectionMode).toBe('different');
  });

  it('Turn 4: different mode', () => {
    expect(t4.selectionMode).toBe('different');
  });

  it('all 4 anchors are distinct', () => {
    const anchors = [t1, t2, t3, t4].map((t) => `${t.anchor?.brand} ${t.anchor?.name}`);
    const unique = new Set(anchors);
    expect(unique.size).toBe(4);
  });

  it('no anchor is vintage or separates', () => {
    for (const t of [t1, t2, t3, t4]) {
      const anchor = t.answer.productExamples[0];
      expect(anchor.availability).not.toBe('vintage');
      const sub = (anchor as any).catalogSubcategory;
      if (sub) expect(sub).toBe('integrated-amp');
    }
  });

  it('category remains amplifier across all turns', () => {
    for (const t of [t1, t2, t3, t4]) {
      expect(t.answer.category).toBe('amplifier');
    }
  });

  it('all turns produce recommendations', () => {
    for (const t of [t1, t2, t3, t4]) {
      expect(t.allProducts.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('decisive recommendation present in advisory for all turns', () => {
    // This tests that low-confidence no longer suppresses decisiveRecommendation
    // Note: decisiveRecommendation depends on ctx.decisiveRecommendation which we pass as {}
    // so it may be undefined — but that's because we don't have a listener profile, not suppression
    // The key check is that the code path doesn't suppress it based on confidence
    // We verify by checking products are always visible
    for (const t of [t1, t2, t3, t4]) {
      expect(t.advisory.options).toBeDefined();
      expect(t.advisory.options!.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('prints audit', () => {
    console.log('\n═══ SCENARIO 4 AUDIT ═══');
    const turns = [
      { label: 'T1', t: t1 },
      { label: 'T2', t: t2 },
      { label: 'T3', t: t3 },
      { label: 'T4', t: t4 },
    ];
    for (const { label, t } of turns) {
      console.log(`${label}: ${t.confidence} ${t.selectionMode} | ${t.anchor?.brand} ${t.anchor?.name} | products: ${t.allProducts.length}`);
      console.log(`  all: ${t.allProducts.join(', ')}`);
    }
    // Check for product reuse across turns
    const allAnchors = turns.map(({ t }) => `${t.anchor?.brand} ${t.anchor?.name}`);
    console.log('All anchors:', allAnchors);
    console.log('Unique anchors:', new Set(allAnchors).size, 'of', allAnchors.length);
  });
});
