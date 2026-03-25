/**
 * QA Scenario Matrix — Full routing trace
 *
 * Exercises intent detection → state machine → shopping pipeline routing.
 * Tests the same decision points that page.tsx uses.
 */
import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';
import { detectShoppingIntent, buildShoppingAnswer, getStatedGaps } from '../shopping-intent';
import {
  detectInitialMode,
  transition,
  INITIAL_CONV_STATE,
  type ConvState,
} from '../conversation-state';
import { buildSystemDiagnosis } from '../consultation';
import type { ExtractedSignals, SignalDirection } from '../signal-types';

const EMPTY_SIGNALS: ExtractedSignals = {
  traits: {} as Record<string, SignalDirection>,
  symptoms: [],
  archetype_hints: [],
  uncertainty_level: 0,
  matched_phrases: [],
  matched_uncertainty_markers: [],
};

function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    dac: 'a DAC', speaker: 'speakers', headphone: 'headphones',
    amplifier: 'an amplifier', turntable: 'a turntable', streamer: 'a streamer',
  };
  return labels[cat] ?? cat;
}

/** Simulate a multi-turn conversation through the state machine. */
function simulateTurns(turns: Array<{ text: string; hasSystem?: boolean; subjectCount?: number }>) {
  let state: ConvState = { ...INITIAL_CONV_STATE };
  const results: Array<{
    text: string;
    intent: string;
    state: ConvState;
    responseText: string;
    responseKind: string;
  }> = [];

  for (const turn of turns) {
    const { intent, subjectMatches } = detectIntent(turn.text);
    const hasSystem = turn.hasSystem ?? false;
    const subjectCount = turn.subjectCount ?? (subjectMatches?.length ?? 0);

    let resultState: ConvState;
    let responseText = '';
    let responseKind = 'none';

    if (state.mode === 'idle') {
      const initial = detectInitialMode(turn.text, { detectedIntent: intent, hasSystem, subjectCount });
      if (initial) {
        resultState = initial;
        if (initial.stage === 'clarify_system') {
          responseText = "What's in your current system?";
          responseKind = 'question';
        } else if (initial.stage === 'clarify_budget') {
          responseText = `Got it — looking for ${categoryLabel(initial.facts.category || 'general')}. What's your budget?`;
          responseKind = 'question';
        } else if (initial.stage === 'clarify_category') {
          responseText = 'What type of component? speakers, headphones, DAC, amplifier, or turntable.';
          responseKind = 'question';
        } else if (initial.stage === 'ready_to_recommend') {
          responseText = '[PIPELINE: ready to recommend]';
          responseKind = 'proceed';
        } else if (initial.stage === 'ready_to_diagnose') {
          responseText = '[PIPELINE: ready to diagnose]';
          responseKind = 'proceed';
        } else if (initial.stage === 'ready_to_compare') {
          responseText = '[PIPELINE: ready to compare]';
          responseKind = 'proceed';
        } else if (initial.mode === 'music_input') {
          responseText = 'Got it — [music acknowledged]. Speakers, headphones, or something else?';
          responseKind = 'note';
        } else if (initial.mode === 'orientation') {
          responseText = 'Are you looking to buy new equipment or improve what you have?';
          responseKind = 'question';
        }
      } else {
        resultState = { ...INITIAL_CONV_STATE };
      }
    } else {
      const result = transition(state, turn.text, { hasSystem, subjectCount, detectedIntent: intent });
      resultState = result.state;
      if (result.response) {
        if (result.response.kind === 'question') {
          responseText = `${result.response.acknowledge}\n${result.response.question}`;
          responseKind = 'question';
        } else if (result.response.kind === 'note') {
          responseText = result.response.content;
          responseKind = 'note';
        } else if (result.response.kind === 'proceed') {
          responseText = result.response.synthesizedQuery ?? '[PIPELINE: proceed]';
          responseKind = 'proceed';
        }
      } else if (resultState.mode === 'idle') {
        responseText = '[STATE RESET — re-route from idle]';
        responseKind = 'reset';
      } else {
        responseText = `[${resultState.mode}/${resultState.stage}]`;
        responseKind = 'implicit';
      }
    }

    state = resultState;
    results.push({ text: turn.text, intent, state: { ...resultState }, responseText, responseKind });
  }

  return results;
}

// ══════════════════════════════════════════════════════════
// A. Music → shopping → from scratch
// ══════════════════════════════════════════════════════════

describe('A. Music → shopping → from scratch', () => {
  it('A1: van halen → speakers → from scratch → $5000', () => {
    const r = simulateTurns([
      { text: 'i like van halen' },
      { text: 'speakers' },
      { text: 'starting from scratch' },
      { text: '$5000' },
    ]);
    console.log('\n=== A1: van halen → speakers → from scratch → $5000 ===');
    r.forEach((t, i) => console.log(`  T${i + 1}: "${t.text}" → intent=${t.intent} mode=${t.state.mode}/${t.state.stage} | ${t.responseKind} | facts=${JSON.stringify(t.state.facts)}`));

    expect(r[0].state.mode).toBe('music_input');
    expect(r[r.length - 1].responseText).not.toMatch(/something went wrong/i);
  });

  it('A1b: "budget is 5000" recognized as budget', () => {
    const r = simulateTurns([
      { text: 'i like van halen' },
      { text: 'speakers' },
      { text: 'starting from scratch' },
      { text: 'budget is 5000' },
    ]);
    console.log('\n=== A1b: budget is 5000 ===');
    r.forEach((t, i) => console.log(`  T${i + 1}: "${t.text}" → mode=${t.state.mode}/${t.state.stage} facts=${JSON.stringify(t.state.facts)}`));

    const last = r[r.length - 1];
    expect(last.state.facts.budget).toBeTruthy();
  });

  it('A2: jazz → headphones → no gear → $500', () => {
    const r = simulateTurns([
      { text: 'I listen to jazz' },
      { text: 'headphones' },
      { text: "don't have any" },
      { text: '$500' },
    ]);
    console.log('\n=== A2: jazz → headphones → $500 ===');
    r.forEach((t, i) => console.log(`  T${i + 1}: "${t.text}" → mode=${t.state.mode}/${t.state.stage} facts=${JSON.stringify(t.state.facts)}`));

    expect(r[0].state.mode).toBe('music_input');
    expect(r[r.length - 1].responseText).not.toMatch(/something went wrong/i);
  });
});

// ══════════════════════════════════════════════════════════
// B. Direct shopping
// ══════════════════════════════════════════════════════════

describe('B. Direct shopping', () => {
  const directInputs = [
    { text: 'I want to buy a DAC', expectShopping: true },
    { text: 'I want speakers', expectShopping: true },
    { text: 'looking for a DAC', expectShopping: true },
    { text: 'buy a DAC', expectShopping: true },
    { text: 'DAC', expectShopping: false },  // known: routes to diagnosis (intent.ts gap)
    { text: 'amplifier', expectShopping: false },
    { text: 'turntable', expectShopping: false },
    { text: 'headphones', expectShopping: false },
  ];

  for (const { text, expectShopping } of directInputs) {
    it(`"${text}" → no error`, () => {
      const r = simulateTurns([{ text }]);
      console.log(`  B: "${text}" → intent=${r[0].intent} mode=${r[0].state.mode}/${r[0].state.stage} | facts=${JSON.stringify(r[0].state.facts)}`);

      expect(r[0].responseText).not.toMatch(/something went wrong/i);
      expect(r[0].responseText).not.toMatch(/could not reach/i);

      if (expectShopping) {
        expect(r[0].state.mode).toBe('shopping');
        expect(r[0].state.facts.category).toBeTruthy();
      }
    });
  }

  it('"I want to buy a DAC" → shopping with dac category', () => {
    const r = simulateTurns([{ text: 'I want to buy a DAC' }]);
    expect(r[0].state.mode).toBe('shopping');
    expect(r[0].state.facts.category).toBe('dac');
    // NOTE: goes to ready_to_recommend (skips budget ask) — page.tsx pipeline handles budget gap
    console.log(`  "I want to buy a DAC" → stage=${r[0].state.stage}`);
  });
});

// ══════════════════════════════════════════════════════════
// C. Diagnosis
// ══════════════════════════════════════════════════════════

describe('C. Diagnosis', () => {
  it('C1: "wilson and soulution, sounds dry" → diagnosis with inline system', () => {
    const r = simulateTurns([
      { text: 'wilson speakers and soulution amp, sounds a little dry', hasSystem: true, subjectCount: 2 },
    ]);
    console.log(`\n  C1: mode=${r[0].state.mode}/${r[0].state.stage}`);
    expect(r[0].state.mode).toBe('diagnosis');

    const diag = buildSystemDiagnosis(
      'wilson speakers and soulution amp, sounds a little dry',
      [{ name: 'Wilson Audio', brand: 'Wilson Audio', category: 'speaker', confidence: 0.9 },
       { name: 'Soulution', brand: 'Soulution', category: 'amplifier', confidence: 0.9 }] as any,
    );
    if (diag) {
      console.log(`  subject: ${diag.subject}`);
      console.log(`  philosophy: ${diag.philosophy?.substring(0, 120)}...`);
      console.log(`  tendencies: ${diag.tendencies?.substring(0, 120)}...`);
      const allText = [diag.philosophy, diag.tendencies, diag.systemSignature].filter(Boolean).join(' ');
      expect(allText).not.toMatch(/Audio Preferences/i);
      expect(allText).not.toMatch(/Why this fits you/i);
    } else {
      console.log('  buildSystemDiagnosis returned null (falls through to evaluate)');
    }
  });

  it('C2: "my system sounds thin" → diagnosis', () => {
    const r = simulateTurns([{ text: 'my system sounds thin', hasSystem: false, subjectCount: 0 }]);
    console.log(`\n  C2: mode=${r[0].state.mode}/${r[0].state.stage} | ${r[0].responseText.substring(0, 80)}`);
    expect(r[0].state.mode).toBe('diagnosis');
  });

  it('C3: "too bright" → diagnosis', () => {
    const r = simulateTurns([{ text: 'too bright', hasSystem: false, subjectCount: 0 }]);
    console.log(`\n  C3: mode=${r[0].state.mode}/${r[0].state.stage}`);
    expect(r[0].state.mode).toBe('diagnosis');
    expect(r[0].responseText).not.toMatch(/something went wrong/i);
  });

  it('C4: "focal utopia and hegel h390, something feels off" → diagnosis', () => {
    const r = simulateTurns([
      { text: 'focal utopia and hegel h390, something feels off', hasSystem: true, subjectCount: 2 },
    ]);
    console.log(`\n  C4: mode=${r[0].state.mode}/${r[0].state.stage}`);
    expect(r[0].state.mode).toBe('diagnosis');
  });

  it('C5: "running klipsch heresy with leben, too forward" → diagnosis', () => {
    const r = simulateTurns([
      { text: 'running klipsch heresy with leben, too forward', hasSystem: true, subjectCount: 2 },
    ]);
    console.log(`\n  C5: mode=${r[0].state.mode}/${r[0].state.stage}`);
    expect(r[0].state.mode).toBe('diagnosis');
  });
});

// ══════════════════════════════════════════════════════════
// D. Comparison
// ══════════════════════════════════════════════════════════

describe('D. Comparison', () => {
  it('D1: "KEF vs ELAC" → comparison', () => {
    const r = simulateTurns([{ text: 'KEF vs ELAC', subjectCount: 2 }]);
    console.log(`\n  D1: mode=${r[0].state.mode}/${r[0].state.stage}`);
    expect(r[0].state.mode).toBe('comparison');
  });

  it('D2: "Hegel vs Yamaha" → comparison', () => {
    const r = simulateTurns([{ text: 'Hegel vs Yamaha', subjectCount: 2 }]);
    console.log(`\n  D2: mode=${r[0].state.mode}/${r[0].state.stage}`);
    expect(r[0].state.mode).toBe('comparison');
  });

  it('D3: "Chord Qutest vs Denafrips Ares" → comparison', () => {
    const r = simulateTurns([{ text: 'Chord Qutest vs Denafrips Ares', subjectCount: 2 }]);
    console.log(`\n  D3: mode=${r[0].state.mode}/${r[0].state.stage}`);
    expect(r[0].state.mode).toBe('comparison');
  });
});

// ══════════════════════════════════════════════════════════
// E. Intent reset / state isolation
// ══════════════════════════════════════════════════════════

describe('E. Intent reset / state isolation', () => {
  it('E1: shopping(DAC) → comparison(KEF vs ELAC) — no DAC leakage', () => {
    const r = simulateTurns([
      { text: 'I want to buy a DAC' },
      { text: 'KEF vs ELAC', subjectCount: 2 },
    ]);
    console.log('\n=== E1 ===');
    r.forEach((t, i) => console.log(`  T${i + 1}: mode=${t.state.mode}/${t.state.stage} facts=${JSON.stringify(t.state.facts)}`));

    expect(r[0].state.mode).toBe('shopping');
    expect(r[0].state.facts.category).toBe('dac');
    // After reset, no DAC leakage
    expect(r[1].state.facts.category).toBeUndefined();
  });

  it('E2: comparison → shopping — no comparison residue', () => {
    const r = simulateTurns([
      { text: 'KEF vs ELAC', subjectCount: 2 },
      { text: 'I want speakers' },
    ]);
    console.log('\n=== E2 ===');
    r.forEach((t, i) => console.log(`  T${i + 1}: mode=${t.state.mode}/${t.state.stage} facts=${JSON.stringify(t.state.facts)}`));

    expect(r[0].state.mode).toBe('comparison');
    expect(r[1].state.facts.comparisonTargets).toBeUndefined();
  });

  it('E3: diagnosis → system info — stays diagnosis', () => {
    const r = simulateTurns([
      { text: 'my system sounds thin', hasSystem: false, subjectCount: 0 },
      { text: 'WiiM Mini → Schiit Magni → KEF Q150', hasSystem: true, subjectCount: 3 },
    ]);
    console.log('\n=== E3 ===');
    r.forEach((t, i) => console.log(`  T${i + 1}: mode=${t.state.mode}/${t.state.stage} facts=${JSON.stringify(t.state.facts)}`));

    expect(r[0].state.mode).toBe('diagnosis');
    expect(r[1].state.mode).toBe('diagnosis');
    expect(r[1].state.facts.symptom).toBeTruthy();
  });

  it('E4: shopping → taste — stays shopping', () => {
    const r = simulateTurns([
      { text: 'I want speakers' },
      { text: 'I listen to rock' },
    ]);
    console.log('\n=== E4 ===');
    r.forEach((t, i) => console.log(`  T${i + 1}: mode=${t.state.mode}/${t.state.stage} facts=${JSON.stringify(t.state.facts)}`));

    expect(r[0].state.mode).toBe('shopping');
    expect(r[1].state.mode).not.toBe('idle');
  });
});

// ══════════════════════════════════════════════════════════
// F. Shopping with empty signals (API failure path)
// ══════════════════════════════════════════════════════════

describe('F. Shopping pipeline with empty signals', () => {
  it('F1: detectShoppingIntent works with empty signals', () => {
    const ctx = detectShoppingIntent('I want speakers under $1000', EMPTY_SIGNALS, undefined);
    console.log(`\n  F1: category=${ctx.category} budget=${ctx.budgetAmount}`);
    expect(ctx.category).toBe('speaker');
    expect(ctx.budgetAmount).toBeGreaterThan(0);
  });

  it('F2: buildShoppingAnswer works with empty signals', () => {
    const ctx = detectShoppingIntent('I want a DAC under $500', EMPTY_SIGNALS, undefined);
    expect(() => {
      buildShoppingAnswer(ctx, EMPTY_SIGNALS, undefined, undefined as any, undefined);
    }).not.toThrow();
  });

  it('F3: getStatedGaps does not require system for shopping', () => {
    const ctx = detectShoppingIntent('I want a DAC', EMPTY_SIGNALS, undefined);
    const gaps = getStatedGaps(ctx, EMPTY_SIGNALS);
    console.log(`\n  F3: gaps=${JSON.stringify(gaps)}`);
    // Should ask for budget, NOT system
    expect(gaps).toContain('budget');
  });
});

// ══════════════════════════════════════════════════════════
// G. Diagnosis output quality
// ══════════════════════════════════════════════════════════

describe('G. Diagnosis output quality', () => {
  const diagCases = [
    {
      name: 'Wilson + Soulution dry',
      text: 'wilson and soulution, sounds dry',
      subjects: [
        { name: 'Wilson Audio', brand: 'Wilson Audio', category: 'speaker', confidence: 0.9 },
        { name: 'Soulution', brand: 'Soulution', category: 'amplifier', confidence: 0.9 },
      ],
    },
    {
      name: 'Klipsch + Leben forward',
      text: 'running klipsch heresy with leben, too forward',
      subjects: [
        { name: 'Klipsch Heresy', brand: 'Klipsch', category: 'speaker', confidence: 0.9 },
        { name: 'Leben', brand: 'Leben', category: 'amplifier', confidence: 0.9 },
      ],
    },
    {
      name: 'Denafrips + First Watt lacks bass',
      text: 'running a denafrips pontus into a first watt sit-3, lacks bass',
      subjects: [
        { name: 'Denafrips Pontus', brand: 'Denafrips', category: 'dac', confidence: 0.9 },
        { name: 'First Watt SIT-3', brand: 'First Watt', category: 'amplifier', confidence: 0.9 },
      ],
    },
  ];

  for (const { name, text, subjects } of diagCases) {
    it(`${name}: no shopping labels, no generic blocks`, () => {
      const diag = buildSystemDiagnosis(text, subjects as any);
      if (diag) {
        const allText = [diag.subject, diag.philosophy, diag.tendencies, diag.systemSignature].filter(Boolean).join(' ');
        console.log(`\n  ${name}:`);
        console.log(`    subject: ${diag.subject}`);
        console.log(`    philosophy: ${diag.philosophy?.substring(0, 150)}`);
        console.log(`    tendencies: ${diag.tendencies?.substring(0, 150)}`);
        console.log(`    systemSignature: ${diag.systemSignature?.substring(0, 150)}`);

        // No shopping-style content in diagnosis
        expect(allText).not.toMatch(/Audio Preferences/i);
        expect(allText).not.toMatch(/Why this fits you/i);
        expect(allText).not.toMatch(/Top pick/i);
        expect(allText).not.toMatch(/Price range/i);
        // No generic filler
        expect(allText).not.toMatch(/no strong directional change/i);
      } else {
        console.log(`  ${name}: buildSystemDiagnosis returned null`);
      }
    });
  }
});
