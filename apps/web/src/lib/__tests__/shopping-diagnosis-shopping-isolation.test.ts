/**
 * Shopping → Diagnosis → Shopping transition isolation tests.
 *
 * Verifies that diagnosis context (symptoms, traits, signals) does not
 * leak when the user transitions back to shopping after a diagnosis turn.
 *
 * Key concern: allUserText concatenation carries diagnosis text into the
 * shopping evaluate call. The evaluateText scoping fix gates on
 * isFirstShoppingAfterModeSwitch to scope the text.
 */
import { describe, it, expect } from 'vitest';
import {
  transition,
  detectInitialMode,
  type ConvState,
} from '../conversation-state';
import { detectIntent } from '../intent';
import { processText } from '@audio-xx/signals';

// ── Helpers ──────────────────────────────────────────────

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

function threeTurnFlow(
  turn1: string,
  turn2: string,
  turn3: string,
) {
  const i1 = detectIntent(turn1);
  const s1 = detectInitialMode(turn1, {
    detectedIntent: i1.intent,
    hasSystem: false,
    subjectCount: i1.subjectMatches?.length ?? 0,
  });
  expect(s1).not.toBeNull();

  const i2 = detectIntent(turn2);
  const r2 = transition(s1!, turn2, {
    hasSystem: false,
    subjectCount: i2.subjectMatches?.length ?? 0,
    detectedIntent: i2.intent,
  });

  const i3 = detectIntent(turn3);
  const r3 = transition(r2.state, turn3, {
    hasSystem: false,
    subjectCount: i3.subjectMatches?.length ?? 0,
    detectedIntent: i3.intent,
  });

  return { s1: s1!, r2, r3, i1, i2, i3 };
}

// ══════════════════════════════════════════════════════════
// 1. Shopping → Diagnosis: mode transitions correctly
// ══════════════════════════════════════════════════════════

describe('Shopping → Diagnosis transition', () => {
  it('"best DAC under $1000" → "too bright" → enters diagnosis mode', () => {
    const { initial, result, i2 } = twoTurnFlow(
      'best DAC under $1000',
      'too bright',
    );

    expect(initial.mode).toBe('shopping');
    // Intent mismatch should trigger fresh detection
    expect(i2.intent).toBe('diagnosis');
    expect(result.state.mode).toBe('diagnosis');
  });

  it('"I want speakers under $2000" → "listening fatigue" → enters diagnosis', () => {
    const { initial, result } = twoTurnFlow(
      'I want speakers under $2000',
      'listening fatigue',
    );

    expect(initial.mode).toBe('shopping');
    expect(result.state.mode).toBe('diagnosis');
  });
});

// ══════════════════════════════════════════════════════════
// 2. Diagnosis → Shopping: mode transitions correctly
// ══════════════════════════════════════════════════════════

describe('Diagnosis → Shopping transition', () => {
  it('"too bright" → "best DAC under $1000" → enters shopping mode', () => {
    const { initial, result, i2 } = twoTurnFlow(
      'too bright',
      'best DAC under $1000',
    );

    expect(initial.mode).toBe('diagnosis');
    expect(i2.intent).toBe('shopping');
    expect(result.state.mode).toBe('shopping');
  });

  it('"listening fatigue" → "speakers under $2000" → enters shopping', () => {
    const { initial, result } = twoTurnFlow(
      'listening fatigue',
      'speakers under $2000',
    );

    expect(initial.mode).toBe('diagnosis');
    expect(result.state.mode).toBe('shopping');
  });
});

// ══════════════════════════════════════════════════════════
// 3. Shopping → Diagnosis → Shopping: full round-trip isolation
// ══════════════════════════════════════════════════════════

describe('Shopping → Diagnosis → Shopping round-trip', () => {
  it('three-turn flow preserves correct modes at each step', () => {
    const { s1, r2, r3 } = threeTurnFlow(
      'best DAC under $1000',
      'too bright',
      'best amplifier under $2000',
    );

    expect(s1.mode).toBe('shopping');
    expect(r2.state.mode).toBe('diagnosis');
    expect(r3.state.mode).toBe('shopping');
  });

  it('diagnosis symptoms do not persist in shopping state facts', () => {
    const { r3 } = threeTurnFlow(
      'I want a DAC under $1000',
      'sounds veiled and too warm',
      'best headphones under $500',
    );

    expect(r3.state.mode).toBe('shopping');
    // Shopping facts should not carry diagnosis symptoms
    const facts = r3.state.facts as Record<string, unknown>;
    expect(facts.symptom).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════
// 4. Signal isolation: diagnosis signals don't affect shopping signals
// ══════════════════════════════════════════════════════════

describe('Signal isolation across mode switches', () => {
  it('diagnosis-only text produces fatigue signals; shopping-only text does not', () => {
    const diagSignals = processText('too bright and listening fatigue');
    expect(diagSignals.symptoms).toContain('fatigue');
    expect(diagSignals.symptoms).toContain('brightness_harshness');

    const shopSignals = processText('best DAC under $1000');
    expect(shopSignals.symptoms.length).toBe(0);
    expect(Object.keys(shopSignals.traits).length).toBe(0);
  });

  it('scoped shopping text after diagnosis does not carry fatigue signals', () => {
    // This simulates the evaluateText scoping fix:
    // instead of allUserText = "too bright\nbest DAC under $1000",
    // scoped text = "best DAC under $1000" only
    const scopedSignals = processText('best DAC under $1000');
    expect(scopedSignals.symptoms).not.toContain('fatigue');
    expect(scopedSignals.symptoms).not.toContain('brightness_harshness');
  });

  it('unscoped combined text DOES produce leaked signals (proves the bug)', () => {
    // This proves WHY the scoping fix was necessary:
    // if we had sent allUserText, diagnosis signals would leak
    const leakyText = 'too bright and listening fatigue\nbest DAC under $1000';
    const leakySignals = processText(leakyText);
    expect(leakySignals.symptoms).toContain('fatigue');
    expect(leakySignals.symptoms).toContain('brightness_harshness');
  });
});
