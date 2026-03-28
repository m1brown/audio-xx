/**
 * SET Anchor Guard Validation — 7 test cases.
 * Confirms SET amps no longer anchor by default, still appear in contrast/wildcard,
 * and can still anchor when explicitly requested.
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
  if (/warm|rich|tube|thick|body|lush|musical|engaging|colorful|emotional/i.test(lower)) {
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
  if (/\bset\b|single.ended|triode|decware|yamamoto|bottlehead/i.test(lower)) {
    archetype_hints.push('set_topology');
  }
  return {
    traits, symptoms: [], archetype_hints,
    uncertainty_level: Object.keys(traits).length === 0 ? 0.8 : 0.2,
    matched_phrases: [], matched_uncertainty_markers: [],
  };
}

function runQuery(
  label: string,
  allText: string,
  latestMessage: string,
  selectionMode: SelectionMode,
  previousAnchor: PreviousAnchor | null,
  recentProductNames: string[],
  fallbackCategory?: string,
) {
  const signals = buildSignalsFromText(allText);
  const desires = extractDesires(allText);
  const ctx = detectShoppingIntent(allText, signals, [], latestMessage, fallbackCategory as any);
  const reasoning = reason(allText, desires, signals, null, ctx, undefined);
  const answer = buildShoppingAnswer(ctx, signals, undefined, reasoning, [], [], undefined, selectionMode, previousAnchor, recentProductNames);

  const p0 = answer.productExamples[0];
  const anchor = p0 ? {
    brand: p0.brand, name: p0.name, price: p0.price,
    availability: p0.availability,
    subcategory: (p0 as any).catalogSubcategory,
    topology: p0.catalogTopology,
    marketType: p0.marketType,
    philosophy: p0.philosophy,
  } : null;

  const isSET = anchor?.topology === 'set';
  const allProducts = answer.productExamples.map(p => ({
    label: `${p.brand} ${p.name}`,
    topology: p.catalogTopology,
    price: p.price,
    role: p === answer.productExamples[0] ? 'anchor' : 'non-anchor',
  }));
  const setInList = answer.productExamples.some(p => p.catalogTopology === 'set');

  console.log(`\n═══ ${label} ═══`);
  console.log(`Anchor: ${anchor?.brand} ${anchor?.name} ($${anchor?.price})`);
  console.log(`  topology: ${anchor?.topology}`);
  console.log(`  IS SET anchor: ${isSET}`);
  console.log(`  SET in list: ${setInList}`);
  console.log(`All: ${allProducts.map(p => `${p.label} [${p.topology}]`).join(', ')}`);

  return { answer, anchor, allProducts, isSET, setInList };
}

function buildPrev(turn: ReturnType<typeof runQuery>): PreviousAnchor | null {
  if (!turn.anchor) return null;
  const p = turn.answer.productExamples[0];
  return { name: p.name, brand: p.brand, philosophy: p.philosophy as any, marketType: p.marketType as any, primaryAxes: p.primaryAxes as any };
}

describe('SET Anchor Guard Validation', () => {
  // ── Group A: No SET signal — SET must NOT anchor ──

  // Case 1: "I have a Hegel H190 amp and want something less dry"
  const c1 = runQuery('Case 1: Hegel less dry',
    'I have a Hegel H190 amp and want something less dry',
    'I have a Hegel H190 amp and want something less dry',
    'default', null, []);

  it('Case 1: no SET signal → anchor is NOT SET', () => {
    expect(c1.anchor).not.toBeNull();
    expect(c1.isSET).toBe(false);
  });

  // Case 2: "I want a warm, engaging amp under $3,000"
  const c2 = runQuery('Case 2: Warm engaging under $3K',
    'I want a warm, engaging amp under $3,000',
    'I want a warm, engaging amp under $3,000',
    'default', null, []);

  it('Case 2: warm/general → anchor is NOT SET', () => {
    expect(c2.anchor).not.toBeNull();
    expect(c2.isSET).toBe(false);
  });

  // Case 3: "Best integrated amp for emotional listening"
  const c3 = runQuery('Case 3: Emotional listening',
    'Best integrated amp for emotional listening',
    'Best integrated amp for emotional listening',
    'default', null, []);

  it('Case 3: emotional/vague → anchor is NOT SET', () => {
    expect(c3.anchor).not.toBeNull();
    expect(c3.isSET).toBe(false);
  });

  // ── Group B: Less traditional — SET must NOT anchor ──

  // Case 4: chain from Case 2 → "Show me something less traditional"
  const c4 = runQuery('Case 4: Less traditional (from C2)',
    'I want a warm, engaging amp under $3,000\nShow me something less traditional',
    'Show me something less traditional',
    detectSelectionMode('Show me something less traditional'),
    buildPrev(c2),
    c2.allProducts.map(p => p.label),
    'amplifier',
  );

  it('Case 4: less traditional → anchor is NOT SET', () => {
    expect(c4.anchor).not.toBeNull();
    expect(c4.isSET).toBe(false);
    expect(c4.anchor!.marketType).toBe('nonTraditional');
  });

  // ── Group C: Explicit SET intent — SET SHOULD anchor ──

  // Case 5: "I want a SET amp"
  const c5 = runQuery('Case 5: Explicit SET',
    'I want a SET amp',
    'I want a SET amp',
    'default', null, []);

  it('Case 5: explicit "SET amp" → SET can anchor', () => {
    expect(c5.anchor).not.toBeNull();
    expect(c5.setInList).toBe(true);
    // With explicit SET intent, SET should be eligible as anchor
    expect(c5.isSET).toBe(true);
  });

  // Case 6: "I want a single-ended triode amplifier"
  const c6 = runQuery('Case 6: Single-ended triode',
    'I want a single-ended triode amplifier',
    'I want a single-ended triode amplifier',
    'default', null, []);

  it('Case 6: explicit "single-ended triode" → SET can anchor', () => {
    expect(c6.anchor).not.toBeNull();
    expect(c6.setInList).toBe(true);
    // With explicit SET phrasing, SET should be eligible as anchor
    expect(c6.isSET).toBe(true);
  });

  // Case 7: "I'm interested in Decware or Yamamoto style amps"
  const c7 = runQuery('Case 7: Decware/Yamamoto brand',
    "I'm interested in Decware or Yamamoto style amps",
    "I'm interested in Decware or Yamamoto style amps",
    'default', null, []);

  it('Case 7: brand-driven SET → SET can anchor', () => {
    expect(c7.anchor).not.toBeNull();
    expect(c7.setInList).toBe(true);
    // With brand-driven SET intent, SET should be eligible as anchor
    expect(c7.isSET).toBe(true);
  });

  // ── Summary ──
  it('summary: SET anchor occurrences', () => {
    const cases = [
      { label: 'C1 (Hegel less dry)', ...c1 },
      { label: 'C2 (Warm $3K)', ...c2 },
      { label: 'C3 (Emotional)', ...c3 },
      { label: 'C4 (Less traditional)', ...c4 },
      { label: 'C5 (Explicit SET)', ...c5 },
      { label: 'C6 (Single-ended triode)', ...c6 },
      { label: 'C7 (Decware/Yamamoto)', ...c7 },
    ];
    console.log('\n═══ SET ANCHOR GUARD SUMMARY ═══');
    for (const c of cases) {
      console.log(`${c.label}: anchor=${c.anchor?.brand} ${c.anchor?.name} | SET=${c.isSET} | SET_in_list=${c.setInList} | topology=${c.anchor?.topology}`);
    }
    const setAnchors = cases.filter(c => c.isSET);
    console.log(`\nSET anchors: ${setAnchors.length} of ${cases.length}`);
    if (setAnchors.length > 0) {
      console.log('SET anchor instances:');
      for (const c of setAnchors) {
        console.log(`  ${c.label}: ${c.anchor?.brand} ${c.anchor?.name} ($${c.anchor?.price})`);
      }
    }
  });
});
