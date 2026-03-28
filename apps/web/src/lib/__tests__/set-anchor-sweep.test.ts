/**
 * SET Anchor Practicality Sweep — 5 warm/rich queries.
 * Validates whether low-power SET amps are anchoring inappropriately.
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
  const allProducts = answer.productExamples.map(p => `${p.brand} ${p.name} ($${p.price}) [${p.catalogTopology}]`);

  console.log(`\n═══ ${label} ═══`);
  console.log(`Anchor: ${anchor?.brand} ${anchor?.name} ($${anchor?.price})`);
  console.log(`  topology: ${anchor?.topology}`);
  console.log(`  availability: ${anchor?.availability ?? '(current)'}`);
  console.log(`  subcategory: ${anchor?.subcategory ?? 'n/a'}`);
  console.log(`  marketType: ${anchor?.marketType}`);
  console.log(`  philosophy: ${anchor?.philosophy}`);
  console.log(`  IS SET: ${isSET}`);
  console.log(`All: ${allProducts.join(', ')}`);

  return { answer, anchor, allProducts: answer.productExamples, isSET };
}

function buildPrev(turn: ReturnType<typeof runQuery>): PreviousAnchor | null {
  if (!turn.anchor) return null;
  const p = turn.answer.productExamples[0];
  return { name: p.name, brand: p.brand, philosophy: p.philosophy as any, marketType: p.marketType as any, primaryAxes: p.primaryAxes as any };
}

describe('SET Anchor Practicality Sweep', () => {
  // Q1: "I have a Hegel H190 amp and want something less dry" — default, no budget
  const q1 = runQuery('Q1: Hegel less dry', 'I have a Hegel H190 amp and want something less dry', 'I have a Hegel H190 amp and want something less dry', 'default', null, []);

  // Q2: "Warm amp under $3,000" — default, budgeted
  const q2 = runQuery('Q2: Warm under $3K', 'I want a warm amp under $3,000', 'I want a warm amp under $3,000', 'default', null, []);

  // Q3: "I want something more engaging and colorful" — default, no budget, no category
  const q3 = runQuery('Q3: Engaging and colorful', 'I want an amplifier that is more engaging and colorful', 'I want an amplifier that is more engaging and colorful', 'default', null, []);

  // Q4: "Best integrated amp for emotional listening" — default
  const q4 = runQuery('Q4: Emotional listening', 'Best integrated amp for emotional listening', 'Best integrated amp for emotional listening', 'default', null, []);

  // Q5: "Show me something less traditional" — chained from Q2
  const q5 = runQuery('Q5: Less traditional (from Q2)',
    'I want a warm amp under $3,000\nShow me something less traditional',
    'Show me something less traditional',
    detectSelectionMode('Show me something less traditional'),
    buildPrev(q2),
    q2.allProducts.map(p => `${p.brand} ${p.name}`),
    'amplifier',
  );

  it('Q1: anchor is noted', () => {
    expect(q1.anchor).not.toBeNull();
  });

  it('Q2: anchor is noted', () => {
    expect(q2.anchor).not.toBeNull();
  });

  it('Q3: anchor is noted', () => {
    expect(q3.anchor).not.toBeNull();
  });

  it('Q4: anchor is noted', () => {
    expect(q4.anchor).not.toBeNull();
  });

  it('Q5: less_traditional anchor is nonTraditional', () => {
    expect(q5.anchor).not.toBeNull();
    expect(q5.anchor!.marketType).toBe('nonTraditional');
  });

  it('summary: SET anchor occurrences', () => {
    const queries = [
      { label: 'Q1', ...q1 },
      { label: 'Q2', ...q2 },
      { label: 'Q3', ...q3 },
      { label: 'Q4', ...q4 },
      { label: 'Q5', ...q5 },
    ];
    console.log('\n═══ SET ANCHOR SUMMARY ═══');
    for (const q of queries) {
      console.log(`${q.label}: ${q.anchor?.brand} ${q.anchor?.name} | SET=${q.isSET} | topology=${q.anchor?.topology}`);
    }
    const setAnchors = queries.filter(q => q.isSET);
    console.log(`\nSET anchors: ${setAnchors.length} of ${queries.length}`);
    if (setAnchors.length > 0) {
      console.log('SET anchor instances:');
      for (const q of setAnchors) {
        console.log(`  ${q.label}: ${q.anchor?.brand} ${q.anchor?.name} ($${q.anchor?.price})`);
      }
    }
  });
});
