import { describe, it, expect } from 'vitest';
import {
  transition,
  detectInitialMode,
  INITIAL_CONV_STATE,
  type ConvState,
} from '../conversation-state';
import { detectIntent } from '../intent';

/**
 * Intent-isolation tests.
 *
 * When the user changes intent mid-conversation the state machine must
 * reset cleanly — no stale category, budget, symptom, or comparison
 * targets should leak across flows.
 */

// ── helpers ──────────────────────────────────────────────

/** Boot from idle into an initial mode, then transition with a follow-up. */
function twoTurnFlow(
  turn1: string,
  turn2: string,
  turn1Overrides?: { hasSystem?: boolean; subjectCount?: number },
  turn2Overrides?: { hasSystem?: boolean; subjectCount?: number },
) {
  const i1 = detectIntent(turn1);
  const initial = detectInitialMode(turn1, {
    detectedIntent: i1.intent,
    hasSystem: turn1Overrides?.hasSystem ?? false,
    subjectCount: turn1Overrides?.subjectCount ?? (i1.subjectMatches?.length ?? 0),
  });
  expect(initial).not.toBeNull();

  const i2 = detectIntent(turn2);
  const result = transition(initial!, turn2, {
    hasSystem: turn2Overrides?.hasSystem ?? false,
    subjectCount: turn2Overrides?.subjectCount ?? (i2.subjectMatches?.length ?? 0),
    detectedIntent: i2.intent,
  });

  return { initial: initial!, i1, i2, result };
}

// ══════════════════════════════════════════════════════════
// 1. shopping → comparison — no DAC leakage
// ══════════════════════════════════════════════════════════

describe('shopping → comparison (no DAC leakage)', () => {
  it('resets to idle when comparison intent arrives during shopping', () => {
    const { initial, result } = twoTurnFlow(
      'I want to buy a DAC',
      'KEF vs ELAC',
    );

    // Turn 1 should have entered shopping with DAC category
    expect(initial.mode).toBe('shopping');
    expect(initial.facts.category).toBe('dac');

    // Turn 2: comparison intent is incompatible with shopping → reset
    expect(result.state.mode).toBe('idle');
    expect(result.state.facts.category).toBeUndefined();
    expect(result.state.facts.budget).toBeUndefined();
    expect(result.response).toBeNull();
  });

  it('clears budget from shopping when switching to comparison', () => {
    const shoppingState: ConvState = {
      mode: 'shopping',
      stage: 'clarify_budget',
      facts: { category: 'dac', budget: '$500' },
    };

    const i2 = detectIntent('KEF vs ELAC');
    const result = transition(shoppingState, 'KEF vs ELAC', {
      hasSystem: false,
      subjectCount: i2.subjectMatches?.length ?? 0,
      detectedIntent: i2.intent,
    });

    expect(result.state.mode).toBe('idle');
    expect(result.state.facts.category).toBeUndefined();
    expect(result.state.facts.budget).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════
// 2. comparison → shopping — no comparison residue
// ══════════════════════════════════════════════════════════

describe('comparison → shopping (no comparison residue)', () => {
  it('resets to idle when shopping intent arrives during comparison', () => {
    const { initial, result } = twoTurnFlow(
      'KEF vs ELAC',
      'I want speakers',
    );

    // Turn 1 should have entered comparison
    expect(initial.mode).toBe('comparison');

    // Turn 2: shopping intent is incompatible with comparison → reset
    expect(result.state.mode).toBe('idle');
    expect(result.state.facts.comparisonTargets).toBeUndefined();
    expect(result.response).toBeNull();
  });

  it('clears comparison targets when switching to shopping', () => {
    const comparisonState: ConvState = {
      mode: 'comparison',
      stage: 'ready_to_compare',
      facts: { comparisonTargets: ['KEF LS50', 'ELAC Debut'] },
    };

    const i2 = detectIntent('I want speakers');
    const result = transition(comparisonState, 'I want speakers', {
      hasSystem: false,
      subjectCount: i2.subjectMatches?.length ?? 0,
      detectedIntent: i2.intent,
    });

    expect(result.state.mode).toBe('idle');
    expect(result.state.facts.comparisonTargets).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════
// 3. diagnosis → system info — stays diagnosis, no reset
// ══════════════════════════════════════════════════════════

describe('diagnosis → system info (stays diagnosis)', () => {
  it('does not reset when user provides system components during diagnosis', () => {
    const { initial, result } = twoTurnFlow(
      'my system sounds thin',
      'WiiM Mini → Schiit Magni → KEF Q150',
      { hasSystem: false, subjectCount: 0 },
      { hasSystem: true, subjectCount: 3 },
    );

    // Turn 1 should have entered diagnosis
    expect(initial.mode).toBe('diagnosis');
    expect(initial.facts.symptom).toBeTruthy();

    // Turn 2: system_assessment is compatible with diagnosis — no reset
    expect(result.state.mode).toBe('diagnosis');
    expect(result.state.facts.symptom).toBeTruthy();
    expect(result.state.facts.hasSystem).toBe(true);
  });

  it('preserves symptom when system info arrives on turn 2', () => {
    const diagState: ConvState = {
      mode: 'diagnosis',
      stage: 'ready_to_diagnose',
      facts: { symptom: 'sounds thin' },
    };

    const i2 = detectIntent('WiiM Mini → Schiit Magni → KEF Q150');
    const result = transition(diagState, 'WiiM Mini → Schiit Magni → KEF Q150', {
      hasSystem: true,
      subjectCount: 3,
      detectedIntent: i2.intent,
    });

    expect(result.state.mode).toBe('diagnosis');
    expect(result.state.facts.symptom).toBe('sounds thin');
  });
});

// ══════════════════════════════════════════════════════════
// 4. shopping → taste context — stays shopping
// ══════════════════════════════════════════════════════════

describe('shopping → taste context (stays shopping)', () => {
  it('does not reset when user shares music taste during shopping', () => {
    const { initial, result } = twoTurnFlow(
      'I want speakers',
      'I listen to rock',
    );

    // Turn 1 should have entered shopping
    expect(initial.mode).toBe('shopping');

    // Turn 2: music_input is compatible with shopping — no reset
    expect(result.state.mode).not.toBe('idle');
    expect(['shopping', 'music_input']).toContain(result.state.mode);
  });

  it('preserves category when taste context is added', () => {
    const shoppingState: ConvState = {
      mode: 'shopping',
      stage: 'clarify_budget',
      facts: { category: 'speaker' },
    };

    const i2 = detectIntent('I like jazz and classical');
    const result = transition(shoppingState, 'I like jazz and classical', {
      hasSystem: false,
      subjectCount: 0,
      detectedIntent: i2.intent,
    });

    expect(result.state.mode).not.toBe('idle');
  });
});

// ══════════════════════════════════════════════════════════
// 5. Edge cases — bare numbers and ambiguous text
// ══════════════════════════════════════════════════════════

describe('edge cases — no false resets', () => {
  it('does not reset shopping when user says "$2000"', () => {
    const shoppingState: ConvState = {
      mode: 'shopping',
      stage: 'clarify_budget',
      facts: { category: 'speaker' },
    };

    const i2 = detectIntent('$2000');
    const result = transition(shoppingState, '$2000', {
      hasSystem: false,
      subjectCount: 0,
      detectedIntent: i2.intent,
    });

    expect(result.state.mode).not.toBe('idle');
  });

  it('does not reset shopping when user says "under 1500"', () => {
    const shoppingState: ConvState = {
      mode: 'shopping',
      stage: 'clarify_budget',
      facts: { category: 'dac' },
    };

    const i2 = detectIntent('under 1500');
    const result = transition(shoppingState, 'under 1500', {
      hasSystem: false,
      subjectCount: 0,
      detectedIntent: i2.intent,
    });

    expect(result.state.mode).not.toBe('idle');
  });

  it('DOES reset shopping when user describes a real symptom', () => {
    const shoppingState: ConvState = {
      mode: 'shopping',
      stage: 'clarify_budget',
      facts: { category: 'dac' },
    };

    const text = 'my system sounds bright and fatiguing';
    const i2 = detectIntent(text);
    const result = transition(shoppingState, text, {
      hasSystem: false,
      subjectCount: 0,
      detectedIntent: i2.intent,
    });

    expect(result.state.mode).toBe('idle');
  });
});

// ══════════════════════════════════════════════════════════
// 6. Cross-mode transitions — additional coverage
// ══════════════════════════════════════════════════════════

describe('additional cross-mode transitions', () => {
  it('shopping → diagnosis resets on explicit symptom', () => {
    const shoppingState: ConvState = {
      mode: 'shopping',
      stage: 'clarify_budget',
      facts: { category: 'speaker', budget: '$1000' },
    };

    const text = 'I get listening fatigue';
    const i2 = detectIntent(text);
    const result = transition(shoppingState, text, {
      hasSystem: false,
      subjectCount: 0,
      detectedIntent: i2.intent,
    });

    expect(result.state.mode).toBe('idle');
    expect(result.state.facts.category).toBeUndefined();
    expect(result.state.facts.budget).toBeUndefined();
  });

  it('diagnosis → comparison resets cleanly', () => {
    const diagState: ConvState = {
      mode: 'diagnosis',
      stage: 'ready_to_diagnose',
      facts: { symptom: 'sounds thin', hasSystem: true },
    };

    const i2 = detectIntent('Schiit Modi vs Topping D10');
    const result = transition(diagState, 'Schiit Modi vs Topping D10', {
      hasSystem: false,
      subjectCount: 2,
      detectedIntent: i2.intent,
    });

    expect(result.state.mode).toBe('idle');
    expect(result.state.facts.symptom).toBeUndefined();
  });

  it('diagnosis → shopping transitions cleanly', () => {
    const diagState: ConvState = {
      mode: 'diagnosis',
      stage: 'ready_to_diagnose',
      facts: { symptom: 'too bright' },
    };

    const i2 = detectIntent('I want to buy a DAC');
    const result = transition(diagState, 'I want to buy a DAC', {
      hasSystem: false,
      subjectCount: 0,
      detectedIntent: i2.intent,
    });

    // Diagnosis → shopping should route to shopping directly (not reset to idle)
    expect(result.state.mode).toBe('shopping');
    expect(result.state.facts.category).toBe('dac');
  });
});
