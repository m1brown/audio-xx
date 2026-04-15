/**
 * Cleanup-pass targeted tests.
 *
 * One test per fix from the final pre-review cleanup pass:
 *   1. Canonical entity casing is preserved in detected components.
 *   2. Comparison view returns image entries for both sides.
 *   3. Duplicate ProductExamples render as a single AdvisoryOption.
 *   4. Bluesound NODE and NODE X resolve to the same catalog entry.
 *   5. "Improve my system" diagnosis grounds in user components and
 *      does not duplicate suggestion text between WHERE TO ACT and WHY THIS FITS.
 */

import { detectSystemDescription } from '../system-extraction';
import { extractSubjectMatches, detectIntent } from '../intent';
import { buildConsultationResponse, buildSystemAssessment } from '../consultation';
import { shoppingToAdvisory, analysisToAdvisory } from '../advisory-response';
import type { ProductExample } from '../shopping-intent';
import type { ShoppingAnswer } from '../shopping-intent';
import type { EvaluationResult, ExtractedSignals } from '../rule-types';
import type { AudioSessionState } from '../session-state';

// ─────────────────────────────────────────────────────────
// 1. Canonical entity casing
// ─────────────────────────────────────────────────────────

test('Issue 1: canonical entity casing preserved (P3ESR, CS300, NODE X, EVO 300)', () => {
  const cases: Array<{ text: string; mustInclude: string[] }> = [
    {
      // "leben cs300" matches the compound PRODUCT_HINTS key — canonical name
      // is "Leben CS300". Harbeth's "p3esr" matches the standalone hint —
      // canonical name is "P3ESR".
      text: 'i have leben cs300 with harbeth p3esr speakers — assess my system',
      mustInclude: ['Leben CS300', 'P3ESR'],
    },
    {
      // "bluesound node x" matches its compound PRODUCT_HINTS key → canonical
      // "Bluesound NODE X". "evo 300" matches the standalone hint → "EVO 300".
      text: 'my setup is bluesound node x into a primaluna evo 300 — what do you think?',
      mustInclude: ['Bluesound NODE X', 'EVO 300'],
    },
  ];

  const session: AudioSessionState = {} as AudioSessionState;

  for (const c of cases) {
    const matches = extractSubjectMatches(c.text);
    const proposed = detectSystemDescription(c.text, matches, session);
    expect(proposed).not.toBeNull();
    const names = proposed!.components.map((cmp) => cmp.name);
    for (const expected of c.mustInclude) {
      expect(names).toContain(expected);
    }
    // Negative: confirm none of the canonical-mangled forms slipped through.
    expect(names).not.toContain('P3esr');
    expect(names).not.toContain('Cs300');
    expect(names).not.toContain('Evo 300');
    expect(names).not.toContain('Node x');
  }
});

// ─────────────────────────────────────────────────────────
// 2. Comparison view returns image entries
// ─────────────────────────────────────────────────────────

test('Issue 2: comparison response includes comparisonImages for both sides', () => {
  const query = 'Chord Qutest vs Denafrips Pontus';
  const matches = extractSubjectMatches(query);
  const { intent } = detectIntent(query, [], undefined);
  expect(intent).toBe('comparison');

  const response = buildConsultationResponse(query, matches);
  expect(response).not.toBeNull();
  expect(response!.comparisonSummary).toBeTruthy();
  expect(response!.comparisonImages).toBeDefined();
  expect(response!.comparisonImages!.length).toBe(2);

  // Both sides should carry brand identifiers (image URL may be a placeholder).
  for (const entry of response!.comparisonImages!) {
    expect(entry.brand).toBeTruthy();
    expect(typeof entry.brand).toBe('string');
  }
});

// ─────────────────────────────────────────────────────────
// 3. Duplicate shopping cards collapse into one option
// ─────────────────────────────────────────────────────────

test('Issue 3: duplicate ProductExamples dedupe to a single AdvisoryOption', () => {
  const product: ProductExample = {
    name: 'Pontus II',
    brand: 'Denafrips',
    price: 1800,
    fitNote: 'R-2R DAC with organic, harmonically rich presentation.',
  };
  const duplicateProduct: ProductExample = {
    ...product,
    fitNote: 'Same product surfaced twice under different roles.',
  };
  const differentProduct: ProductExample = {
    name: 'Qutest',
    brand: 'Chord',
    price: 1895,
    fitNote: 'Crisp, transient-led FPGA-based DAC.',
  };

  const answer: ShoppingAnswer = {
    category: 'dac',
    budget: 2000,
    preferenceSummary: 'natural tonality, long-session comfort',
    bestFitDirection: 'organic with natural decay',
    whyThisFits: ['preserves long-session comfort'],
    productExamples: [product, duplicateProduct, differentProduct],
    watchFor: [],
  };

  const advisory = shoppingToAdvisory(answer);
  expect(advisory.options).toBeDefined();
  expect(advisory.options!.length).toBe(2);
  const identities = advisory.options!.map((o) => `${o.brand} ${o.name}`.toLowerCase());
  expect(identities).toContain('denafrips pontus ii');
  expect(identities).toContain('chord qutest');
});

// ─────────────────────────────────────────────────────────
// 4. NODE / NODE X family alignment
// ─────────────────────────────────────────────────────────

test('Issue 4: Bluesound NODE and NODE X resolve to the same catalog product', () => {
  const queries = [
    'My system: Bluesound NODE → Rega Brio → Harbeth P3ESR. Assess my system.',
    'My system: Bluesound NODE X → Rega Brio → Harbeth P3ESR. Assess my system.',
  ];

  const sources: Array<string | undefined> = [];
  for (const q of queries) {
    const matches = extractSubjectMatches(q);
    const result = buildSystemAssessment(q, matches, null, []);
    expect(result).not.toBeNull();
    if (!result || result.kind !== 'assessment') {
      throw new Error('expected assessment kind');
    }
    // perComponentAxes carries the catalog source used to derive each
    // component's axes. With the alias in place, plain "NODE" should
    // resolve from the catalog (source === 'product') rather than falling
    // through to inferred-neutral axes.
    const nodeEntry = result.findings.perComponentAxes.find((p) =>
      p.name.toLowerCase().includes('node'),
    );
    expect(nodeEntry).toBeTruthy();
    sources.push(nodeEntry!.source);
  }

  // Both queries must hit the same catalog source — without the alias,
  // plain "NODE" would fall through to 'inferred' while NODE X would be
  // 'product'. The alias keeps both at 'product'.
  expect(sources[0]).toBe('product');
  expect(sources[1]).toBe('product');
});

// ─────────────────────────────────────────────────────────
// 5. Improve-my-system diagnosis grounding
// ─────────────────────────────────────────────────────────

test('Issue 5: diagnosis grounds in user components and avoids duplicated copy', () => {
  // Use a fired rule with NO matching SYMPTOM_ACTIONS entry so the
  // suggestions-fallback path runs. Without the fix, the same suggestion
  // text would render in both diagnosisActions and whyThisFits.
  const signals: ExtractedSignals = {
    traits: {},
    symptoms: ['general_dissatisfaction'],
    direction: [],
    preserve: [],
    context: [],
    matched_phrases: ['improve my system'],
    archetype_hints: [],
    uncertainty_level: 0,
  };

  const result: EvaluationResult = {
    fired_rules: [{
      id: 'unmapped-improvement-request',
      label: 'Generic improvement request',
      priority: 5,
      outputs: {
        explanation: 'No specific symptom — looking for general system improvement.',
        suggestions: [
          'Audit speaker placement before any component change.',
          'Consider whether the source chain is the limiting factor.',
        ],
        risks: [],
        next_step: 'Describe what you want to improve specifically.',
      },
    }],
    archetype_conflict_detected: false,
    uncertainty_level: 0,
  };

  const advisory = analysisToAdvisory(result, signals, undefined, undefined, {
    systemComponents: ['Chord Qutest', 'Naim Supernait 3', 'Harbeth P3ESR'],
    systemTendencies: 'detailed, neutral, controlled',
  });

  // Grounding: WHERE TO ACT must be present (fallback path)
  expect(advisory.diagnosisActions).toBeTruthy();
  expect(advisory.diagnosisActions!.length).toBeGreaterThanOrEqual(1);
  expect(advisory.diagnosisActions![0].area).toBe('Suggested action');

  // De-duplication: WHY THIS FITS must NOT carry the same suggestion text
  expect(advisory.whyThisFits).toBeUndefined();

  // Component grounding: interpretation references the user's actual components
  expect(advisory.diagnosisInterpretation).toBeTruthy();
  expect(advisory.diagnosisInterpretation).toMatch(/Chord Qutest|Naim Supernait|Harbeth P3ESR/);
});
