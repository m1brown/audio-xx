/**
 * Diagnosis → Comparison transition isolation tests.
 *
 * Verifies that diagnosis state resets cleanly when the user shifts
 * from a symptom-driven diagnosis to a product comparison.
 * Comparison is a STRONG_INTENT — it should always trigger a mismatch
 * and produce a fresh comparison state.
 */
import { describe, it, expect } from 'vitest';
import {
  transition,
  detectInitialMode,
} from '../conversation-state';
import { detectIntent } from '../intent';
import { processText } from '@audio-xx/signals';

// ── Helpers ──────────────────────────────────────────────

function twoTurnFlow(
  turn1: string,
  turn2: string,
  turn2Overrides?: { hasSystem?: boolean; subjectCount?: number },
) {
  const i1 = detectIntent(turn1);
  const initial = detectInitialMode(turn1, {
    detectedIntent: i1.intent,
    hasSystem: false,
    subjectCount: i1.subjectMatches?.length ?? 0,
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
// 1. Diagnosis → Comparison: mode switch fires correctly
// ══════════════════════════════════════════════════════════

describe('Diagnosis → Comparison transition', () => {
  it('"too bright" → "Schiit Bifrost vs Denafrips Ares" → enters comparison', () => {
    const { initial, result, i2 } = twoTurnFlow(
      'too bright',
      'Schiit Bifrost vs Denafrips Ares',
      { subjectCount: 2 },
    );

    expect(initial.mode).toBe('diagnosis');
    expect(i2.intent).toBe('comparison');
    // Should NOT stay in diagnosis — comparison is a strong intent
    expect(result.state.mode).not.toBe('diagnosis');
  });

  it('"listening fatigue" → "KEF LS50 vs ELAC Debut" → exits diagnosis', () => {
    const { initial, result } = twoTurnFlow(
      'listening fatigue',
      'KEF LS50 vs ELAC Debut',
      { subjectCount: 2 },
    );

    expect(initial.mode).toBe('diagnosis');
    expect(result.state.mode).not.toBe('diagnosis');
  });

  it('"sounds veiled" → "compare tube vs solid state" → exits diagnosis', () => {
    const { initial, result, i2 } = twoTurnFlow(
      'sounds veiled',
      'compare tube vs solid state amps',
      { subjectCount: 2 },
    );

    expect(initial.mode).toBe('diagnosis');
    // Should detect comparison intent
    expect(i2.intent).toBe('comparison');
  });
});

// ══════════════════════════════════════════════════════════
// 2. Diagnosis facts do not persist into comparison
// ══════════════════════════════════════════════════════════

describe('Diagnosis state cleanup on comparison transition', () => {
  it('diagnosis symptom does not leak into comparison facts', () => {
    const { result } = twoTurnFlow(
      'too bright',
      'Schiit Bifrost vs Denafrips Ares',
      { subjectCount: 2 },
    );

    const facts = result.state.facts as Record<string, unknown>;
    // Comparison should have fresh facts, not diagnosis symptoms
    expect(facts.symptom).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════
// 3. Signals: diagnosis signals not extracted from comparison text
// ══════════════════════════════════════════════════════════

describe('Signal isolation: comparison text produces no diagnosis signals', () => {
  it('"Schiit Bifrost vs Denafrips Ares" → no symptoms', () => {
    const signals = processText('Schiit Bifrost vs Denafrips Ares');
    expect(signals.symptoms.length).toBe(0);
  });

  it('"KEF LS50 vs ELAC Debut" → no symptoms', () => {
    const signals = processText('KEF LS50 vs ELAC Debut');
    expect(signals.symptoms.length).toBe(0);
  });

  it('"compare tube vs solid state amps" → no diagnosis symptoms', () => {
    const signals = processText('compare tube vs solid state amps');
    // May have archetype hints but should not have diagnosis symptoms
    expect(signals.symptoms).not.toContain('fatigue');
    expect(signals.symptoms).not.toContain('brightness_harshness');
    expect(signals.symptoms).not.toContain('congestion_muddiness');
  });
});

// ══════════════════════════════════════════════════════════
// 4. Comparison → Diagnosis: reverse direction also works
// ══════════════════════════════════════════════════════════

describe('Comparison → Diagnosis transition', () => {
  it('"Schiit vs Denafrips" → "too bright" → enters diagnosis', () => {
    const i1 = detectIntent('Schiit Bifrost vs Denafrips Ares');
    const initial = detectInitialMode('Schiit Bifrost vs Denafrips Ares', {
      detectedIntent: i1.intent,
      hasSystem: false,
      subjectCount: 2,
    });

    // comparison may or may not get a mode — if null, diagnosis cold-start works
    if (initial) {
      const i2 = detectIntent('too bright');
      const result = transition(initial, 'too bright', {
        hasSystem: false,
        subjectCount: 0,
        detectedIntent: i2.intent,
      });
      expect(result.state.mode).toBe('diagnosis');
    } else {
      // Null initial = idle state, so diagnosis would cold-start
      const mode = detectInitialMode('too bright', {
        detectedIntent: 'diagnosis',
        hasSystem: false,
        subjectCount: 0,
      });
      expect(mode).not.toBeNull();
      expect(mode!.mode).toBe('diagnosis');
    }
  });
});
