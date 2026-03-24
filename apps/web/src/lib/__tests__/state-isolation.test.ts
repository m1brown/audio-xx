import { describe, it, expect } from 'vitest';
import {
  transition,
  detectInitialMode,
  INITIAL_CONV_STATE,
  type ConvState,
  type ConvFacts,
} from '../conversation-state';
import { detectIntent } from '../intent';

/**
 * State isolation tests.
 *
 * When a user changes intent mid-conversation (e.g. shopping → comparison),
 * the state machine must fully reset — no category, budget, or other facts
 * from the prior flow should leak into the new one.
 */

// ── Helpers ─────────────────────────────────────────────

/** Build a shopping state with DAC category and budget. */
function shoppingState(overrides: Partial<ConvFacts> = {}): ConvState {
  return {
    mode: 'shopping',
    stage: 'clarify_budget',
    facts: { category: 'dac', budget: '$1000', hasSystem: false, ...overrides },
  };
}

/** Build a diagnosis state with symptom. */
function diagnosisState(overrides: Partial<ConvFacts> = {}): ConvState {
  return {
    mode: 'diagnosis',
    stage: 'clarify_system',
    facts: { symptom: 'sounds thin', hasSystem: false, ...overrides },
  };
}

/** Build a comparison state with targets. */
function comparisonState(overrides: Partial<ConvFacts> = {}): ConvState {
  return {
    mode: 'comparison',
    stage: 'clarify_targets',
    facts: { comparisonTargets: ['KEF', 'ELAC'], ...overrides },
  };
}

function contextFor(text: string) {
  const { intent, subjectMatches } = detectIntent(text);
  return {
    hasSystem: false,
    subjectCount: subjectMatches.length,
    detectedIntent: intent,
  };
}

// ── Shopping → other intent ─────────────────────────────

describe('Shopping → new intent resets state', () => {
  it('shopping + "KEF vs ELAC" → idle (comparison clears DAC state)', () => {
    const result = transition(shoppingState(), 'KEF vs ELAC', contextFor('KEF vs ELAC'));
    expect(result.state.mode).toBe('idle');
    expect(result.state.facts).toEqual({});
    expect(result.response).toBeNull();
  });

  it('shopping + "my system sounds thin" → idle (diagnosis clears shopping)', () => {
    const result = transition(shoppingState(), 'my system sounds thin', contextFor('my system sounds thin'));
    expect(result.state.mode).toBe('idle');
    expect(result.state.facts).toEqual({});
    expect(result.response).toBeNull();
  });

  it('shopping + "I like jazz" → stays in shopping (music_input is taste context)', () => {
    const result = transition(shoppingState(), 'I like jazz', contextFor('I like jazz'));
    // music_input IS compatible with shopping — mentioning music during
    // shopping provides taste context, not a new flow
    expect(result.state.mode).toBe('shopping');
  });

  it('shopping + "$2000" → stays in shopping (budget is compatible)', () => {
    const state = shoppingState({ budget: undefined });
    const result = transition(state, '$2000', contextFor('$2000'));
    // $2000 doesn't trigger a strong incompatible intent — stays in shopping
    expect(result.state.mode).toBe('shopping');
  });
});

// ── Diagnosis → other intent ────────────────────────────

describe('Diagnosis → new intent resets state', () => {
  it('diagnosis + "best DAC under $1000" → idle (shopping clears diagnosis)', () => {
    const result = transition(diagnosisState(), 'best DAC under $1000', contextFor('best DAC under $1000'));
    expect(result.state.mode).toBe('idle');
    expect(result.state.facts).toEqual({});
  });

  it('diagnosis + "KEF vs ELAC" → idle (comparison clears diagnosis)', () => {
    const result = transition(diagnosisState(), 'KEF vs ELAC', contextFor('KEF vs ELAC'));
    expect(result.state.mode).toBe('idle');
    expect(result.state.facts).toEqual({});
  });

  it('diagnosis + "Bryston and Harbeth" → stays in diagnosis (system info is compatible)', () => {
    const result = transition(diagnosisState(), 'Bryston 4B and Harbeth SHL5', {
      hasSystem: false,
      subjectCount: 2,
      detectedIntent: 'diagnosis',
    });
    expect(result.state.mode).toBe('diagnosis');
  });
});

// ── Comparison → other intent ───────────────────────────

describe('Comparison → new intent resets state', () => {
  it('comparison + "I want a DAC" → idle (shopping clears comparison)', () => {
    const result = transition(comparisonState(), 'I want a DAC', contextFor('I want a DAC'));
    expect(result.state.mode).toBe('idle');
    expect(result.state.facts).toEqual({});
  });

  it('comparison + "my system sounds bright" → idle (diagnosis clears comparison)', () => {
    const result = transition(comparisonState(), 'my system sounds bright', contextFor('my system sounds bright'));
    expect(result.state.mode).toBe('idle');
    expect(result.state.facts).toEqual({});
  });
});

// ── Music input → other intent ──────────────────────────

describe('Music input → compatible transitions', () => {
  it('music_input + "speakers" stays in music_input (shopping is compatible)', () => {
    const musicState: ConvState = {
      mode: 'music_input',
      stage: 'awaiting_listening_path',
      facts: { musicDescription: 'van halen' },
    };
    const result = transition(musicState, 'speakers', {
      hasSystem: false,
      subjectCount: 0,
      detectedIntent: 'shopping',
    });
    // music_input accepts shopping intent — this is the onboarding flow
    expect(result.state.mode).not.toBe('idle');
  });

  it('music_input + "KEF vs ELAC" → idle (comparison clears music_input)', () => {
    const musicState: ConvState = {
      mode: 'music_input',
      stage: 'awaiting_listening_path',
      facts: { musicDescription: 'van halen' },
    };
    const result = transition(musicState, 'KEF vs ELAC', contextFor('KEF vs ELAC'));
    expect(result.state.mode).toBe('idle');
    expect(result.state.facts).toEqual({});
  });
});

// ── No leakage of facts ─────────────────────────────────

describe('Facts do not leak across intents', () => {
  it('DAC category from shopping does not appear after comparison reset', () => {
    const prior = shoppingState({ category: 'dac', budget: '$1000' });
    const result = transition(prior, 'KEF vs ELAC', contextFor('KEF vs ELAC'));
    expect(result.state.facts.category).toBeUndefined();
    expect(result.state.facts.budget).toBeUndefined();
  });

  it('symptom from diagnosis does not appear after shopping reset', () => {
    const prior = diagnosisState({ symptom: 'too bright' });
    const result = transition(prior, 'best DAC under $1000', contextFor('best DAC under $1000'));
    expect(result.state.facts.symptom).toBeUndefined();
  });

  it('comparison targets do not appear after shopping reset', () => {
    const prior = comparisonState({ comparisonTargets: ['KEF', 'ELAC'] });
    const result = transition(prior, 'I want speakers', contextFor('I want speakers'));
    expect(result.state.facts.comparisonTargets).toBeUndefined();
  });
});
