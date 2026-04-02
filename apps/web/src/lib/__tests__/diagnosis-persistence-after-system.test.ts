/**
 * Tests: Diagnosis mode persistence after system context is provided.
 *
 * Validates the exact flow:
 *   1. "Something sounds off"
 *   2. "bright and fatiguing"
 *   3. "soulution amp and wilson speakers"
 *   4. "maybe a tube dac?"
 *
 * The system must stay in diagnosis mode throughout, never collapse
 * into product exploration or re-ask for the system.
 */
import { describe, it, expect } from 'vitest';
import {
  detectInitialMode,
  transition,
  interpretSymptom,
} from '../conversation-state';
import { detectIntent, extractSubjectMatches } from '../intent';
import { buildSystemDiagnosis } from '../consultation';

// ── Helper: simulate what page.tsx does ──────────────

function simulateTurn(
  convState: ReturnType<typeof detectInitialMode> | { mode: string; stage: string; facts: Record<string, unknown> },
  text: string,
) {
  const { intent, subjectMatches } = detectIntent(text);
  const result = transition(
    convState as Parameters<typeof transition>[0],
    text,
    {
      hasSystem: false,
      subjectCount: subjectMatches.length,
      detectedIntent: intent,
    },
  );
  return { result, intent, subjectMatches };
}

// ── Full flow test ──────────────────────────────────

describe('Diagnosis persistence: symptom → system → follow-up', () => {
  // Track state across turns
  let convState: ReturnType<typeof detectInitialMode>;

  it('Turn 1: "Something sounds off" → diagnosis/ready_to_diagnose', () => {
    const text = 'Something sounds off';
    const { intent } = detectIntent(text);

    convState = detectInitialMode(text, {
      detectedIntent: intent,
      hasSystem: false,
      subjectCount: 0,
    });

    expect(convState).not.toBeNull();
    expect(convState!.mode).toBe('diagnosis');
    expect(convState!.stage).toBe('ready_to_diagnose');
    expect(convState!.facts.symptom).toBe(text);
  });

  it('Turn 2: "bright and fatiguing" → stays in ready_to_diagnose', () => {
    const text = 'bright and fatiguing';
    const { intent, subjectMatches } = detectIntent(text);

    const result = transition(convState!, text, {
      hasSystem: false,
      subjectCount: subjectMatches.length,
      detectedIntent: intent,
    });

    // Should stay in diagnosis/ready_to_diagnose (symptom only)
    expect(result.state.mode).toBe('diagnosis');
    expect(result.state.stage).toBe('ready_to_diagnose');

    // Symptom from initial turn is preserved
    expect(result.state.facts.symptom).toBe('Something sounds off');

    // Response should interpret the symptom, not just "Got it."
    expect(result.response).not.toBeNull();
    if (result.response!.kind === 'question') {
      expect(result.response!.acknowledge).toMatch(/bright|fatigue|upper|energy/i);
      expect(result.response!.acknowledge).not.toBe('Got it.');
    }

    convState = result.state as ReturnType<typeof detectInitialMode>;
  });

  it('Turn 3: "soulution amp and wilson speakers" → ready_to_diagnose (NOT product essay)', () => {
    const text = 'soulution amp and wilson speakers';
    const { intent, subjectMatches } = detectIntent(text);

    // Intent will be gear_inquiry (no symptom language), but state machine
    // should still recognise this as system context for the active diagnosis.
    const result = transition(convState!, text, {
      hasSystem: false,
      subjectCount: subjectMatches.length,
      detectedIntent: intent,
    });

    // CRITICAL: must stay in diagnosis, not collapse to idle
    expect(result.state.mode).toBe('diagnosis');
    expect(result.state.stage).toBe('ready_to_diagnose');
    expect(result.state.facts.hasSystem).toBe(true);

    // Must produce a proceed, not a question or product essay
    expect(result.response).not.toBeNull();
    expect(result.response!.kind).toBe('proceed');

    // Symptom from initial turn is preserved
    expect(result.state.facts.symptom).toBe('Something sounds off');

    convState = result.state as ReturnType<typeof detectInitialMode>;
  });

  it('Turn 3 (page.tsx sim): buildSystemDiagnosis gets symptom from accumulated context', () => {
    // Simulate what page.tsx does: combine stored symptom with current text
    const currentText = 'soulution amp and wilson speakers';
    const storedSymptom = 'bright and fatiguing';
    const diagText = `${storedSymptom}. ${currentText}`;

    const subjectMatches = extractSubjectMatches(diagText);

    // buildSystemDiagnosis should find the complaint from the symptom part
    const result = buildSystemDiagnosis(diagText, subjectMatches);

    expect(result).not.toBeNull();
    // Should have a subject that references the system, not a product essay
    expect(result!.subject).toBeTruthy();
    // The comparisonSummary should contain diagnosis content
    expect(result!.comparisonSummary).toBeTruthy();
    expect(result!.comparisonSummary).toMatch(/bright|fatigue|energy|upper|frequency/i);

    console.log('\n═══ DIAGNOSIS OUTPUT (Turn 3) ═══');
    console.log('diagText:', diagText);
    console.log('subjects:', subjectMatches.map(s => `${s.name} (${s.kind})`));
    console.log('subject:', result!.subject);
    console.log('diagnosis:', result!.comparisonSummary?.slice(0, 200));
    console.log('followUp:', result!.followUp);
  });

  it('Turn 4: "maybe a tube dac?" → stays in diagnosis, does NOT reset', () => {
    const text = 'maybe a tube dac?';
    const { intent, subjectMatches } = detectIntent(text);

    const result = transition(convState!, text, {
      hasSystem: false,
      subjectCount: subjectMatches.length,
      detectedIntent: intent,
    });

    // CRITICAL: must stay in diagnosis mode
    expect(result.state.mode).toBe('diagnosis');
    expect(result.state.stage).toBe('ready_to_diagnose');

    // Must NOT ask for the system again
    if (result.response!.kind === 'question') {
      expect((result.response as any).question).not.toMatch(/what.*system|what.*component/i);
    }

    // Must proceed (let the pipeline handle the remedy question in context)
    expect(result.response!.kind).toBe('proceed');

    // Facts should still have the initial symptom and system
    expect(result.state.facts.symptom).toBe('Something sounds off');
    expect(result.state.facts.hasSystem).toBe(true);
  });
});

// ── Explicit mode exit tests ─────────────────────────

describe('Diagnosis mode: explicit exit signals', () => {
  it('"I want to buy a new DAC" exits diagnosis to shopping', () => {
    const state = {
      mode: 'diagnosis' as const,
      stage: 'ready_to_diagnose' as const,
      facts: { symptom: 'bright and fatiguing', hasSystem: true, category: 'dac' as string },
    };
    const text = 'I want to buy a new DAC';
    const { intent, subjectMatches } = detectIntent(text);

    const result = transition(state, text, {
      hasSystem: true,
      subjectCount: subjectMatches.length,
      detectedIntent: intent,
    });

    expect(result.state.mode).toBe('shopping');
  });

  it('"what about a warmer source?" stays in diagnosis', () => {
    const state = {
      mode: 'diagnosis' as const,
      stage: 'ready_to_diagnose' as const,
      facts: { symptom: 'bright and fatiguing', hasSystem: true },
    };
    const text = 'what about a warmer source?';
    const { intent, subjectMatches } = detectIntent(text);

    const result = transition(state, text, {
      hasSystem: true,
      subjectCount: subjectMatches.length,
      detectedIntent: intent,
    });

    expect(result.state.mode).toBe('diagnosis');
    expect(result.state.stage).toBe('ready_to_diagnose');
    expect(result.response!.kind).toBe('proceed');
  });

  it('"would tubes help?" stays in diagnosis', () => {
    const state = {
      mode: 'diagnosis' as const,
      stage: 'ready_to_diagnose' as const,
      facts: { symptom: 'sounds harsh', hasSystem: true },
    };
    const text = 'would tubes help?';
    const { intent, subjectMatches } = detectIntent(text);

    const result = transition(state, text, {
      hasSystem: true,
      subjectCount: subjectMatches.length,
      detectedIntent: intent,
    });

    expect(result.state.mode).toBe('diagnosis');
    expect(result.response!.kind).toBe('proceed');
  });
});

// ── Symptom update during clarify_system ─────────────

describe('Diagnosis: symptom elaboration during ready_to_diagnose', () => {
  it('updates symptom when user elaborates instead of naming components', () => {
    const state = {
      mode: 'diagnosis' as const,
      stage: 'ready_to_diagnose' as const,
      facts: { symptom: 'something sounds off' },
    };
    const text = 'it sounds bright and harsh';
    const { subjectMatches } = detectIntent(text);

    const result = transition(state, text, {
      hasSystem: false,
      subjectCount: subjectMatches.length,
    });

    expect(result.state.mode).toBe('diagnosis');
    expect(result.state.stage).toBe('ready_to_diagnose');
    // Symptom is updated to the new, more specific description
    expect(result.state.facts.symptom).toBe('it sounds bright and harsh');
    // Acknowledge should interpret the updated symptom
    if (result.response!.kind === 'question') {
      expect(result.response!.acknowledge).toMatch(/bright|harsh|upper|distortion/i);
    }
  });
});
