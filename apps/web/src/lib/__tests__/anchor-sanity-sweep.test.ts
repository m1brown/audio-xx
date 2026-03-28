/**
 * Anchor Sanity Sweep — 5 queries with sequential turn simulation.
 * Validates that anchors are practical, buyable, and policy-compliant.
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
import { reason } from '../reasoning';
import { extractDesires } from '../intent';
import type { ExtractedSignals } from '../signal-types';

function buildSignalsFromText(text: string): ExtractedSignals {
  const lower = text.toLowerCase();
  const traits: Record<string, 'up' | 'down'> = {};
  const archetype_hints: string[] = [];
  if (/warm|rich|tube|thick|body|lush|musical|engaging/i.test(lower)) {
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
  return {
    traits, symptoms: [], archetype_hints,
    uncertainty_level: Object.keys(traits).length === 0 ? 0.8 : 0.2,
    matched_phrases: [], matched_uncertainty_markers: [],
  };
}

interface TurnResult {
  answer: ShoppingAnswer;
  anchor: { brand: string; name: string; availability?: string; subcategory?: string; topology?: string; marketType?: string; philosophy?: string; price?: number } | null;
  allProducts: string[];
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
  const ctx = detectShoppingIntent(allUserText, signals, [], latestMessage, fallbackCategory as any);
  const reasoning = reason(allUserText, desires, signals, null, ctx, undefined);
  const answer = buildShoppingAnswer(ctx, signals, undefined, reasoning, [], [], undefined, selectionMode, previousAnchor, recentProductNames);
  const p0 = answer.productExamples[0];
  const anchor = p0 ? {
    brand: p0.brand, name: p0.name,
    availability: p0.availability,
    subcategory: (p0 as any).catalogSubcategory,
    topology: p0.catalogTopology,
    marketType: p0.marketType,
    philosophy: p0.philosophy,
    price: p0.price,
  } : null;
  return { answer, anchor, allProducts: answer.productExamples.map(p => `${p.brand} ${p.name}`), selectionMode };
}

function buildPreviousAnchor(turn: TurnResult): PreviousAnchor | null {
  if (!turn.anchor) return null;
  const prod = turn.answer.productExamples[0];
  return {
    name: prod.name, brand: prod.brand,
    philosophy: prod.philosophy as any,
    marketType: prod.marketType as any,
    primaryAxes: prod.primaryAxes as any,
  };
}

describe('Anchor Sanity Sweep', () => {
  // Query 1: "Best amp under $2,000" — default mode
  const msg1 = 'Best amp under $2,000';
  const t1 = runTurn(msg1, msg1, 'default', null, []);

  it('Q1: default anchor is practical', () => {
    console.log('\n═══ Q1: "Best amp under $2,000" ═══');
    console.log('Anchor:', t1.anchor?.brand, t1.anchor?.name, `($${t1.anchor?.price})`);
    console.log('  availability:', t1.anchor?.availability ?? '(current)');
    console.log('  subcategory:', t1.anchor?.subcategory ?? 'n/a');
    console.log('  topology:', t1.anchor?.topology);
    console.log('  marketType:', t1.anchor?.marketType);
    console.log('  philosophy:', t1.anchor?.philosophy);
    console.log('All products:', t1.allProducts.join(', '));

    expect(t1.anchor).not.toBeNull();
    expect(t1.anchor!.availability).not.toBe('vintage');
    expect(t1.answer.category).toBe('amplifier');
  });

  // Query 2: "Warm amp under $3,000" — default mode
  const msg2 = 'I want a warm amp under $3,000';
  const t2 = runTurn(msg2, msg2, 'default', null, []);

  it('Q2: warm default anchor is practical', () => {
    console.log('\n═══ Q2: "Warm amp under $3,000" ═══');
    console.log('Anchor:', t2.anchor?.brand, t2.anchor?.name, `($${t2.anchor?.price})`);
    console.log('  availability:', t2.anchor?.availability ?? '(current)');
    console.log('  subcategory:', t2.anchor?.subcategory ?? 'n/a');
    console.log('  topology:', t2.anchor?.topology);
    console.log('  marketType:', t2.anchor?.marketType);
    console.log('  philosophy:', t2.anchor?.philosophy);
    console.log('All products:', t2.allProducts.join(', '));

    expect(t2.anchor).not.toBeNull();
    expect(t2.anchor!.availability).not.toBe('vintage');
  });

  // Query 3: "I have a Hegel H190 amp and want something less dry" — default mode
  const msg3 = 'I have a Hegel H190 amp and want something less dry';
  const t3 = runTurn(msg3, msg3, 'default', null, []);

  it('Q3: system-context anchor is practical', () => {
    console.log('\n═══ Q3: "Hegel H190 less dry" ═══');
    console.log('Anchor:', t3.anchor?.brand, t3.anchor?.name, `($${t3.anchor?.price})`);
    console.log('  availability:', t3.anchor?.availability ?? '(current)');
    console.log('  subcategory:', t3.anchor?.subcategory ?? 'n/a');
    console.log('  topology:', t3.anchor?.topology);
    console.log('  marketType:', t3.anchor?.marketType);
    console.log('  philosophy:', t3.anchor?.philosophy);
    console.log('All products:', t3.allProducts.join(', '));

    expect(t3.anchor).not.toBeNull();
    expect(t3.anchor!.availability).not.toBe('vintage');
  });

  // Query 4: "Show me something less traditional" — less_traditional mode
  const msg4 = 'Show me something less traditional';
  const allText4 = `${msg3}\n${msg4}`;
  const t4 = runTurn(allText4, msg4, detectSelectionMode(msg4), buildPreviousAnchor(t3), t3.allProducts, 'amplifier');

  it('Q4: less_traditional anchor is nonTraditional and not vintage', () => {
    console.log('\n═══ Q4: "less traditional" ═══');
    console.log('Anchor:', t4.anchor?.brand, t4.anchor?.name, `($${t4.anchor?.price})`);
    console.log('  availability:', t4.anchor?.availability ?? '(current)');
    console.log('  subcategory:', t4.anchor?.subcategory ?? 'n/a');
    console.log('  topology:', t4.anchor?.topology);
    console.log('  marketType:', t4.anchor?.marketType);
    console.log('  philosophy:', t4.anchor?.philosophy);
    console.log('All products:', t4.allProducts.join(', '));

    expect(t4.anchor).not.toBeNull();
    expect(t4.anchor!.marketType).toBe('nonTraditional');
    expect(t4.anchor!.availability).not.toBe('vintage');
  });

  // Query 5: "Show me something different" — different mode
  const msg5 = 'Show me something different';
  const allText5 = `${allText4}\n${msg5}`;
  const t5 = runTurn(allText5, msg5, detectSelectionMode(msg5), buildPreviousAnchor(t4), [...t3.allProducts, ...t4.allProducts], 'amplifier');

  it('Q5: different anchor is distinct, practical, not vintage/separates', () => {
    console.log('\n═══ Q5: "something different" ═══');
    console.log('Anchor:', t5.anchor?.brand, t5.anchor?.name, `($${t5.anchor?.price})`);
    console.log('  availability:', t5.anchor?.availability ?? '(current)');
    console.log('  subcategory:', t5.anchor?.subcategory ?? 'n/a');
    console.log('  topology:', t5.anchor?.topology);
    console.log('  marketType:', t5.anchor?.marketType);
    console.log('  philosophy:', t5.anchor?.philosophy);
    console.log('All products:', t5.allProducts.join(', '));

    expect(t5.anchor).not.toBeNull();
    expect(t5.anchor!.availability).not.toBe('vintage');
    // Should differ from Q4 anchor
    const t5Name = `${t5.anchor!.brand} ${t5.anchor!.name}`;
    const t4Name = `${t4.anchor!.brand} ${t4.anchor!.name}`;
    expect(t5Name).not.toBe(t4Name);
    // Subcategory should be integrated-amp or undefined
    const sub = t5.anchor!.subcategory;
    if (sub) expect(sub).toBe('integrated-amp');
  });

  // Cross-check: report any Scott 222B or vintage product appearing as anchor
  it('no vintage product appears as anchor in any query', () => {
    const allAnchors = [t1, t2, t3, t4, t5];
    for (const t of allAnchors) {
      if (t.anchor?.availability === 'vintage') {
        console.error('VINTAGE ANCHOR DETECTED:', t.anchor.brand, t.anchor.name);
      }
      expect(t.anchor?.availability).not.toBe('vintage');
    }
  });

  // Cross-check: report Scott 222B presence in any shortlist
  it('reports Scott 222B/222C presence in shortlists', () => {
    const allTurns = [
      { label: 'Q1', t: t1 },
      { label: 'Q2', t: t2 },
      { label: 'Q3', t: t3 },
      { label: 'Q4', t: t4 },
      { label: 'Q5', t: t5 },
    ];
    console.log('\n═══ Scott 222B Presence Check ═══');
    for (const { label, t } of allTurns) {
      const hasScott = t.allProducts.some(p => p.includes('Scott'));
      const isAnchor = t.anchor?.name?.includes('222');
      console.log(`${label}: present=${hasScott}, isAnchor=${!!isAnchor}`);
    }
    // Scott should never be anchor (it's vintage)
    for (const { t } of allTurns) {
      if (t.anchor?.name?.includes('222')) {
        console.error('SCOTT 222B AS ANCHOR — vintage leak!');
      }
    }
  });

  // Report Leben CS300 — it's nonTraditional but NOT vintage
  it('reports Leben CS300 behavior', () => {
    console.log('\n═══ Leben CS300 Check ═══');
    const allTurns = [
      { label: 'Q1', t: t1 },
      { label: 'Q2', t: t2 },
      { label: 'Q3', t: t3 },
      { label: 'Q4', t: t4 },
      { label: 'Q5', t: t5 },
    ];
    for (const { label, t } of allTurns) {
      const hasLeben = t.allProducts.some(p => p.includes('Leben'));
      const isAnchor = t.anchor?.brand === 'Leben';
      console.log(`${label}: present=${hasLeben}, isAnchor=${isAnchor}`);
    }
  });
});
