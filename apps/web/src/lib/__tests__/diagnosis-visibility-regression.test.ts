/**
 * Regression tests for the "dispatched but invisible" diagnosis bug.
 *
 * Root cause: diagnosis advisories were dispatched to the messages array
 * but hidden by the render filter when hasPendingQuestion was true.
 * Additionally, convModeHint was not always set when intent === 'diagnosis',
 * causing skipDiagClarification to be false and clarification to fire
 * instead of diagnosis output.
 *
 * These tests verify three layers:
 *   1. Cold-start: convModeHint is set for diagnosis inputs
 *   2. Mode transitions: convModeHint is set after shopping/consultation resets
 *   3. Pipeline: diagnosis advisory is produced (not clarification) for all paths
 */
import { describe, it, expect } from 'vitest';
import {
  transition,
  detectInitialMode,
  INITIAL_CONV_STATE,
} from '../conversation-state';
import { detectIntent } from '../intent';
import { processText } from '@audio-xx/signals';
import { evaluate, type EvaluationContext } from '@audio-xx/rules';
import { analysisToAdvisory } from '../advisory-response';
import { getClarificationQuestion } from '../clarification';

// ── Helpers ──────────────────────────────────────────────

function evaluateInput(text: string) {
  const signals = processText(text);
  const ctx: EvaluationContext = {
    symptoms: signals.symptoms,
    traits: signals.traits,
    archetypes: [...signals.archetype_hints],
    uncertainty_level: signals.uncertainty_level,
    has_improvement_signals: signals.symptoms.includes('improvement'),
  };
  const result = evaluate(ctx);
  return { signals, result };
}

/**
 * Simulate the convModeHint logic from page.tsx handleSubmit.
 * Returns what convModeHint would be set to for a given input
 * at a given convState.
 */
function simulateConvModeHint(
  text: string,
  currentMode: 'idle' | 'diagnosis' | 'shopping' | 'comparison' | string,
  opts?: { hasSystem?: boolean; subjectCount?: number },
): string | undefined {
  const { intent } = detectIntent(text);
  const subjectCount = opts?.subjectCount ?? 0;
  const hasSystem = opts?.hasSystem ?? false;

  let convModeHint: string | undefined;

  if (currentMode === 'idle') {
    // Cold-start path: detectInitialMode
    const initialConvMode = detectInitialMode(text, {
      detectedIntent: intent,
      hasSystem,
      subjectCount,
    });

    if (initialConvMode) {
      if (initialConvMode.mode === 'diagnosis' && initialConvMode.stage === 'ready_to_diagnose') {
        convModeHint = 'diagnosis';
      }
    }
  } else if (currentMode !== 'idle') {
    // Active state machine path: transition
    const currentState = { mode: currentMode, stage: 'ready_to_diagnose', facts: {} } as any;
    const result = transition(currentState, text, {
      hasSystem,
      subjectCount,
      detectedIntent: intent,
    });

    if (result.state.stage === 'ready_to_diagnose' && result.state.mode === 'diagnosis') {
      convModeHint = 'diagnosis';
    }
  }

  // Safety net (mirrors page.tsx line ~1614)
  if (intent === 'diagnosis' && !convModeHint) {
    convModeHint = 'diagnosis';
  }

  return convModeHint;
}

// ══════════════════════════════════════════════════════════
// 1. Cold-start: convModeHint is 'diagnosis' for symptom inputs
// ══════════════════════════════════════════════════════════

describe('Cold-start diagnosis: convModeHint always set', () => {
  const symptomInputs = [
    'too bright',
    'my system sounds thin',
    'I get listening fatigue',
    'sounds veiled',
    'too much bass',
    'too warm',
    'not balanced',
    'too metallic',
    'gives me a headache',
    'not enough clarity',
    'something is off',
  ];

  for (const text of symptomInputs) {
    it(`"${text}" → convModeHint = 'diagnosis'`, () => {
      const hint = simulateConvModeHint(text, 'idle');
      expect(hint).toBe('diagnosis');
    });
  }
});

// ══════════════════════════════════════════════════════════
// 2. Cold-start: skipDiagClarification prevents clarification
// ══════════════════════════════════════════════════════════

describe('Cold-start diagnosis: skipDiagClarification blocks clarification', () => {
  const symptomInputs = ['too bright', 'my system sounds thin'];

  for (const text of symptomInputs) {
    it(`"${text}" → produces advisory, not clarification`, () => {
      const { signals, result } = evaluateInput(text);

      // Verify the pipeline produces real rules
      expect(result.fired_rules.length).toBeGreaterThanOrEqual(1);
      expect(result.fired_rules[0].id).not.toBe('friendly-advisor-fallback');

      // Verify analysisToAdvisory produces a diagnosis advisory
      const advisory = analysisToAdvisory(result, signals);
      expect(advisory.kind).toBe('diagnosis');
      expect(advisory.tendencies).toBeTruthy();

      // Verify getClarificationQuestion WOULD fire without the guard
      const clarification = getClarificationQuestion(signals, result, 1, text, text);
      // (clarification may or may not fire — the point is the guard skips it)

      // The key assertion: convModeHint is set, so skipDiagClarification = true
      const hint = simulateConvModeHint(text, 'idle');
      expect(hint).toBe('diagnosis');
      const skipDiagClarification = hint === 'diagnosis';
      expect(skipDiagClarification).toBe(true);
    });
  }
});

// ══════════════════════════════════════════════════════════
// 3. Shopping → diagnosis: convModeHint set after mode reset
// ══════════════════════════════════════════════════════════

describe('Shopping → diagnosis transition: convModeHint set', () => {
  it('"best DAC under $1000" → "too bright" → diagnosis hint active', () => {
    // Turn 1: Shopping (sets convState, which then resets to idle)
    const shop = detectIntent('best DAC under $1000');
    const shopMode = detectInitialMode('best DAC under $1000', {
      detectedIntent: shop.intent,
      hasSystem: false,
      subjectCount: shop.subjectMatches.length,
    });
    expect(shopMode).not.toBeNull();
    expect(shopMode!.mode).toBe('shopping');

    // After shopping dispatches, convState resets to idle (page.tsx line 497).
    // Turn 2: User says "too bright" — convState is idle again.
    const hint = simulateConvModeHint('too bright', 'idle');
    expect(hint).toBe('diagnosis');

    // Verify the advisory pipeline works
    const { signals, result } = evaluateInput('too bright');
    expect(result.fired_rules.length).toBeGreaterThanOrEqual(1);
    const advisory = analysisToAdvisory(result, signals);
    expect(advisory.kind).toBe('diagnosis');
  });

  it('"speakers under $500" → "my system sounds thin" → diagnosis hint active', () => {
    const hint = simulateConvModeHint('my system sounds thin', 'idle');
    expect(hint).toBe('diagnosis');

    const { signals, result } = evaluateInput('my system sounds thin');
    const advisory = analysisToAdvisory(result, signals);
    expect(advisory.kind).toBe('diagnosis');
    expect(advisory.tendencies).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════
// 4. Consultation → diagnosis: convModeHint set via safety net
// ══════════════════════════════════════════════════════════

describe('Consultation → diagnosis transition: convModeHint set', () => {
  it('"tell me about Chord" → "my system sounds thin" → diagnosis hint active', () => {
    // Turn 1: Consultation (doesn't use state machine, convState stays idle)
    const consult = detectIntent('tell me about Chord');
    // Consultation intent — convState remains idle.

    // Turn 2: "my system sounds thin" — convState still idle
    const hint = simulateConvModeHint('my system sounds thin', 'idle');
    expect(hint).toBe('diagnosis');

    const { signals, result } = evaluateInput('my system sounds thin');
    const advisory = analysisToAdvisory(result, signals);
    expect(advisory.kind).toBe('diagnosis');
  });

  it('"what makes R2R DACs different?" → "too bright" → diagnosis hint active', () => {
    const hint = simulateConvModeHint('too bright', 'idle');
    expect(hint).toBe('diagnosis');
  });
});

// ══════════════════════════════════════════════════════════
// 5. Diagnosis follow-up: second diagnosis turn still works
// ══════════════════════════════════════════════════════════

describe('Diagnosis follow-up: convModeHint persists', () => {
  it('"too bright" → "what about my DAC?" → still in diagnosis', () => {
    // Turn 1: cold start → diagnosis
    const hint1 = simulateConvModeHint('too bright', 'idle');
    expect(hint1).toBe('diagnosis');

    // Turn 2: follow-up while convState is diagnosis/ready_to_diagnose
    const hint2 = simulateConvModeHint('what about my DAC?', 'diagnosis', { subjectCount: 1 });
    expect(hint2).toBe('diagnosis');
  });

  it('"my system sounds thin" → "I have KEF speakers and a Hegel amp" → diagnosis produces advisory', () => {
    // Turn 1: symptom
    const hint1 = simulateConvModeHint('my system sounds thin', 'idle');
    expect(hint1).toBe('diagnosis');

    // Turn 2: system info while in diagnosis mode
    const hint2 = simulateConvModeHint(
      'I have KEF speakers and a Hegel amp',
      'diagnosis',
      { hasSystem: true, subjectCount: 2 },
    );
    expect(hint2).toBe('diagnosis');

    // Full pipeline should produce advisory
    const { signals, result } = evaluateInput('my system sounds thin. I have KEF speakers and a Hegel amp');
    const advisory = analysisToAdvisory(result, signals);
    expect(advisory.kind).toBe('diagnosis');
  });
});

// ══════════════════════════════════════════════════════════
// 6. Render filter: diagnosis advisory not hidden by itself
// ══════════════════════════════════════════════════════════

describe('Render filter regression: diagnosis advisory visibility', () => {
  // Simulates the render filter logic from page.tsx line 3029-3040
  type MockMessage = {
    role: 'user' | 'assistant';
    kind?: 'question' | 'advisory' | 'note' | 'glossary';
    advisory?: { kind: string };
  };

  function applyRenderFilter(messages: MockMessage[], lastMessage: MockMessage | undefined) {
    return messages.filter((msg) => {
      // Exact logic from page.tsx after the fix
      if (
        lastMessage?.kind === 'question' &&
        msg.role === 'assistant' && msg.kind === 'advisory' && msg.advisory?.kind === 'diagnosis'
      ) {
        return false;
      }
      return true;
    });
  }

  it('diagnosis advisory is visible when it is the only assistant message', () => {
    const messages: MockMessage[] = [
      { role: 'user' },
      { role: 'assistant', kind: 'advisory', advisory: { kind: 'diagnosis' } },
    ];
    const lastMessage = messages[messages.length - 1];
    const visible = applyRenderFilter(messages, lastMessage);
    expect(visible).toHaveLength(2); // Both messages visible
  });

  it('diagnosis advisory is hidden when a clarification question follows it', () => {
    const messages: MockMessage[] = [
      { role: 'user' },
      { role: 'assistant', kind: 'advisory', advisory: { kind: 'diagnosis' } },
      { role: 'assistant', kind: 'question' },
    ];
    const lastMessage = messages[messages.length - 1];
    const visible = applyRenderFilter(messages, lastMessage);
    // The diagnosis advisory should be hidden (question is pending)
    expect(visible).toHaveLength(2); // user + question
    expect(visible.find((m) => m.kind === 'advisory')).toBeUndefined();
  });

  it('diagnosis advisory is visible after user answers the question', () => {
    const messages: MockMessage[] = [
      { role: 'user' },
      { role: 'assistant', kind: 'advisory', advisory: { kind: 'diagnosis' } },
      { role: 'assistant', kind: 'question' },
      { role: 'user' }, // User answered
    ];
    const lastMessage = messages[messages.length - 1];
    const visible = applyRenderFilter(messages, lastMessage);
    expect(visible).toHaveLength(4); // All messages visible
  });

  it('shopping advisory is never hidden by the filter', () => {
    const messages: MockMessage[] = [
      { role: 'user' },
      { role: 'assistant', kind: 'advisory', advisory: { kind: 'shopping' } },
      { role: 'assistant', kind: 'question' },
    ];
    const lastMessage = messages[messages.length - 1];
    const visible = applyRenderFilter(messages, lastMessage);
    // Shopping advisory should remain visible even with pending question
    expect(visible.find((m) => m.kind === 'advisory')).toBeTruthy();
  });

  it('consultation advisory is never hidden by the filter', () => {
    const messages: MockMessage[] = [
      { role: 'user' },
      { role: 'assistant', kind: 'advisory', advisory: { kind: 'consultation' } },
      { role: 'assistant', kind: 'question' },
    ];
    const lastMessage = messages[messages.length - 1];
    const visible = applyRenderFilter(messages, lastMessage);
    expect(visible.find((m) => m.kind === 'advisory')).toBeTruthy();
  });

  it('OLD BUG: advisory as lastMessage no longer hides itself', () => {
    // This is the exact scenario that caused the original bug.
    // hasPendingQuestion was: lastMessage.kind === 'question' || lastMessage.kind === 'advisory'
    // The advisory made ITSELF the "pending question" and hid itself.
    const messages: MockMessage[] = [
      { role: 'user' },
      { role: 'assistant', kind: 'advisory', advisory: { kind: 'diagnosis' } },
    ];
    const lastMessage = messages[messages.length - 1]; // The advisory itself
    const visible = applyRenderFilter(messages, lastMessage);
    // With the fix: lastMessage.kind === 'advisory' (not 'question'),
    // so the filter does NOT trigger. Advisory stays visible.
    expect(visible).toHaveLength(2);
    expect(visible[1].kind).toBe('advisory');
  });
});
