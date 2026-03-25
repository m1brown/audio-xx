import { describe, it, expect } from 'vitest';
import {
  transition,
  detectInitialMode,
  INITIAL_CONV_STATE,
  isReadyToDiagnose,
  type ConvState,
  type ConvFacts,
} from '../conversation-state';
import { detectIntent } from '../intent';

/**
 * Partial-system diagnosis tests.
 *
 * Diagnosis should be opportunistic: proceed with whatever info is available.
 * System info enriches but never gates. A symptom alone is sufficient.
 */

// ── Helpers ─────────────────────────────────────────────

function contextFor(text: string) {
  const { intent, subjectMatches } = detectIntent(text);
  return {
    hasSystem: subjectMatches.length >= 2,
    subjectCount: subjectMatches.length,
    detectedIntent: intent,
  };
}

function initialMode(text: string) {
  const { intent, subjectMatches } = detectIntent(text);
  return detectInitialMode(text, {
    detectedIntent: intent,
    hasSystem: subjectMatches.length >= 2,
    subjectCount: subjectMatches.length,
  });
}

// ── isReadyToDiagnose ───────────────────────────────────

describe('isReadyToDiagnose', () => {
  it('symptom alone is sufficient', () => {
    expect(isReadyToDiagnose({ symptom: 'too bright' })).toBe(true);
  });

  it('symptom + system is sufficient', () => {
    expect(isReadyToDiagnose({ symptom: 'too bright', hasSystem: true })).toBe(true);
  });

  it('no symptom is not ready', () => {
    expect(isReadyToDiagnose({})).toBe(false);
    expect(isReadyToDiagnose({ hasSystem: true })).toBe(false);
  });
});

// ── Single-message diagnosis (component + symptom) ──────

describe('Single-message diagnosis with partial system', () => {
  it('"topping dac, too bright" → ready_to_diagnose immediately', () => {
    const state = initialMode('topping dac, too bright');
    expect(state).not.toBeNull();
    expect(state!.mode).toBe('diagnosis');
    expect(state!.stage).toBe('ready_to_diagnose');
    expect(state!.facts.symptom).toBeTruthy();
  });

  it('"my KEF speakers sound harsh" → ready_to_diagnose (1 component)', () => {
    const state = initialMode('my KEF speakers sound harsh');
    expect(state).not.toBeNull();
    expect(state!.mode).toBe('diagnosis');
    expect(state!.stage).toBe('ready_to_diagnose');
  });
});

// ── Symptom-only diagnosis (no components) ──────────────

describe('Symptom-only diagnosis (no system info)', () => {
  it('"too bright" → ready_to_diagnose (not clarify_system)', () => {
    const state = initialMode('too bright');
    // Should proceed to diagnose, not ask for system
    expect(state).not.toBeNull();
    if (state!.mode === 'diagnosis') {
      expect(state!.stage).toBe('ready_to_diagnose');
    }
  });

  it('"my system sounds thin" → ready_to_diagnose', () => {
    const state = initialMode('my system sounds thin');
    expect(state).not.toBeNull();
    expect(state!.mode).toBe('diagnosis');
    expect(state!.stage).toBe('ready_to_diagnose');
  });

  it('"I get listening fatigue" → ready_to_diagnose', () => {
    const state = initialMode('I get listening fatigue');
    expect(state).not.toBeNull();
    expect(state!.mode).toBe('diagnosis');
    expect(state!.stage).toBe('ready_to_diagnose');
  });
});

// ── Multi-turn: symptom first, then component ───────────

describe('Multi-turn partial diagnosis', () => {
  it('turn 1: symptom → proceed; turn 2: component → proceed (no re-ask)', () => {
    // Turn 1: "sounds thin" — symptom, no system
    const mode1 = initialMode('sounds thin');
    expect(mode1).not.toBeNull();
    expect(mode1!.mode).toBe('diagnosis');
    expect(mode1!.stage).toBe('ready_to_diagnose');

    // Turn 2: user provides "Schiit Magni" — component info
    const result2 = transition(mode1!, 'Schiit Magni', contextFor('Schiit Magni'));
    // Should proceed to diagnose, not loop back to clarify_system
    expect(result2.state.mode).toBe('diagnosis');
    expect(result2.state.stage).toBe('ready_to_diagnose');
    expect(result2.response?.kind).toBe('proceed');
  });

  it('turn 1: symptom → proceed; turn 2: full system → proceed', () => {
    const mode1 = initialMode('my system sounds thin');
    expect(mode1!.stage).toBe('ready_to_diagnose');

    const result2 = transition(mode1!, 'WiiM Mini, Schiit Magni, KEF Q150', {
      hasSystem: true,
      subjectCount: 3,
      detectedIntent: 'diagnosis',
    });
    expect(result2.state.mode).toBe('diagnosis');
    expect(result2.state.stage).toBe('ready_to_diagnose');
    expect(result2.state.facts.hasSystem).toBe(true);
  });
});

// ── Never re-asks "what's in your system" ───────────────

describe('No system re-ask loops', () => {
  it('diagnosis state never produces clarify_system stage from detectInitialMode', () => {
    const inputs = [
      'my system sounds thin',
      'too bright',
      'sounds thin',
      'I get listening fatigue',
      'not enough bass',
      'sounds harsh and fatiguing',
    ];
    for (const input of inputs) {
      const state = initialMode(input);
      if (state && state.mode === 'diagnosis') {
        expect(state.stage).not.toBe('clarify_system');
      }
    }
  });

  it('transition from clarify_system always proceeds (never loops)', () => {
    const diagState: ConvState = {
      mode: 'diagnosis',
      stage: 'clarify_system',
      facts: { symptom: 'too bright' },
    };

    // Even with no components, should proceed
    const result = transition(diagState, 'I\'m not sure what I have', {
      hasSystem: false,
      subjectCount: 0,
      detectedIntent: 'diagnosis',
    });
    expect(result.state.stage).toBe('ready_to_diagnose');
    expect(result.state.stage).not.toBe('clarify_system');
  });
});
