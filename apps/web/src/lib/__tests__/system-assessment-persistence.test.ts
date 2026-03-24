/**
 * System Assessment Persistence Tests
 *
 * Validates that system_assessment mode:
 * 1. Stays active across turns
 * 2. Accumulates components incrementally
 * 3. Does not collapse into product essay or shopping mode
 * 4. Handles repeated/clarified components correctly
 */
import { describe, it, expect } from 'vitest';
import { transition, detectInitialMode, INITIAL_CONV_STATE } from '../conversation-state';
import type { ConvState } from '../conversation-state';
import { detectIntent } from '../intent';

const defaultCtx = (text: string) => {
  const { intent, subjectMatches } = detectIntent(text);
  return {
    hasSystem: false,
    subjectCount: subjectMatches.length,
    detectedIntent: intent,
  };
};

// ═══════════════════════════════════════════════════════════════
// FLOW 1: "evaluate my system" → component description → more
// ═══════════════════════════════════════════════════════════════
describe('Flow 1: evaluate my system → incremental component assembly', () => {
  // Turn 1: "evaluate my system"
  const turn1Intent = detectIntent('evaluate my system');

  it('Turn 1: detects consultation_entry intent (no subjects)', () => {
    expect(turn1Intent.intent).toBe('consultation_entry');
    expect(turn1Intent.subjectMatches.length).toBe(0);
  });

  it('Turn 1: detectInitialMode routes to system_assessment/entry', () => {
    const mode = detectInitialMode('evaluate my system', {
      hasSystem: false,
      subjectCount: 0,
      detectedIntent: 'consultation_entry',
    });
    expect(mode).toBeDefined();
    expect(mode!.mode).toBe('system_assessment');
    expect(mode!.stage).toBe('entry');
  });

  it('Turn 1: transition from entry asks for components (not "what to improve")', () => {
    const entryState: ConvState = {
      mode: 'system_assessment',
      stage: 'entry',
      facts: { hasSystem: true },
    };
    const t = transition(entryState, 'evaluate my system', {
      hasSystem: false,
      subjectCount: 0,
      detectedIntent: 'consultation_entry',
    });
    expect(t.state.mode).toBe('system_assessment');
    expect(t.state.stage).toBe('assembling_system');
    expect(t.response).toBeDefined();
    expect(t.response!.kind).toBe('question');
    expect((t.response as any).question).toMatch(/component/i);
  });

  // Turn 2: "job integrated amp and wlm diva speakers"
  it('Turn 2: component description stays in system_assessment', () => {
    const assemblingState: ConvState = {
      mode: 'system_assessment',
      stage: 'assembling_system',
      facts: { hasSystem: true },
    };
    const text = 'job integrated amp and wlm diva speakers';
    const ctx = defaultCtx(text);
    const t = transition(assemblingState, text, ctx);

    expect(t.state.mode).toBe('system_assessment');
    // Should progress to ready_to_assess (has amp + speaker = 2 roles)
    expect(t.state.stage).toBe('ready_to_assess');
    expect(t.state.facts.systemComponents).toBeDefined();
    expect(t.state.facts.systemComponents!.length).toBeGreaterThan(0);
    expect(t.state.facts.systemAssessmentText).toContain('job');
  });

  // Turn 3: "i pair it with a job integrated amplifier" (reinforcement)
  it('Turn 3: repeated component reinforces, stays in system_assessment', () => {
    const readyState: ConvState = {
      mode: 'system_assessment',
      stage: 'ready_to_assess',
      facts: {
        hasSystem: true,
        systemComponents: ['job integrated amp and wlm diva speakers'],
        systemAssessmentText: 'job integrated amp and wlm diva speakers',
      },
    };
    const text = 'i pair it with a job integrated amplifier';
    const ctx = defaultCtx(text);
    const t = transition(readyState, text, ctx);

    expect(t.state.mode).toBe('system_assessment');
    expect(t.state.stage).toBe('ready_to_assess');
    // Components should be accumulated
    expect(t.state.facts.systemComponents!.length).toBe(2);
    expect(t.state.facts.systemAssessmentText).toContain('job integrated amplifier');
  });

  // Turn 4: "JOB integrated amplifier" (bare repetition)
  it('Turn 4: bare component name stays in system_assessment', () => {
    const readyState: ConvState = {
      mode: 'system_assessment',
      stage: 'ready_to_assess',
      facts: {
        hasSystem: true,
        systemComponents: ['job integrated amp and wlm diva speakers', 'i pair it with a job integrated amplifier'],
        systemAssessmentText: 'job integrated amp and wlm diva speakers\ni pair it with a job integrated amplifier',
      },
    };
    const text = 'JOB integrated amplifier';
    const ctx = defaultCtx(text);
    const t = transition(readyState, text, ctx);

    expect(t.state.mode).toBe('system_assessment');
    expect(t.state.stage).toBe('ready_to_assess');
    // Should NOT fall into shopping, comparison, or product essay
  });
});

// ═══════════════════════════════════════════════════════════════
// FLOW 2: Mode does NOT collapse into shopping or diagnosis
// ═══════════════════════════════════════════════════════════════
describe('Flow 2: system_assessment does not collapse', () => {
  it('component description does NOT trigger "improvement" fallthrough', () => {
    const state: ConvState = {
      mode: 'system_assessment',
      stage: 'clarify_preference',
      facts: { hasSystem: true },
    };
    const text = 'job integrated amp and wlm diva speakers';
    const ctx = defaultCtx(text);
    const t = transition(state, text, ctx);

    // MUST NOT be 'improvement' — that was the old broken behavior
    expect(t.state.mode).not.toBe('improvement');
    expect(t.state.mode).toBe('system_assessment');
  });

  it('component description in assembling_system does NOT fall to diagnosis', () => {
    const state: ConvState = {
      mode: 'system_assessment',
      stage: 'assembling_system',
      facts: { hasSystem: true },
    };
    const text = 'wlm diva speakers';
    const ctx = defaultCtx(text);
    const t = transition(state, text, ctx);

    expect(t.state.mode).not.toBe('diagnosis');
    expect(t.state.mode).toBe('system_assessment');
  });

  it('repeated component does NOT trigger product essay mode', () => {
    const state: ConvState = {
      mode: 'system_assessment',
      stage: 'ready_to_assess',
      facts: {
        hasSystem: true,
        systemComponents: ['job integrated and wlm diva'],
        systemAssessmentText: 'job integrated and wlm diva',
      },
    };
    const text = 'JOB integrated amplifier';
    const ctx = defaultCtx(text);
    const t = transition(state, text, ctx);

    // Must stay in system_assessment, not fall to comparison or consultation
    expect(t.state.mode).toBe('system_assessment');
  });
});

// ═══════════════════════════════════════════════════════════════
// FLOW 3: Partial system — ask for missing components
// ═══════════════════════════════════════════════════════════════
describe('Flow 3: partial system — ask for missing components', () => {
  it('amp + speakers → asks for source', () => {
    const state: ConvState = {
      mode: 'system_assessment',
      stage: 'entry',
      facts: { hasSystem: true },
    };
    // User provides amp + speakers but no source
    const text = 'i have a job integrated and wlm diva speakers';
    const ctx = defaultCtx(text);
    const t = transition(state, text, ctx);

    // Should still progress (we have 2+ subjects = enough for assessment)
    expect(t.state.mode).toBe('system_assessment');
    expect(t.state.facts.systemComponents).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// FLOW 4: Intent mismatch only on explicit mode change
// ═══════════════════════════════════════════════════════════════
describe('Flow 4: only explicit intent changes leave system_assessment', () => {
  it('explicit buying intent exits to shopping', () => {
    const state: ConvState = {
      mode: 'system_assessment',
      stage: 'ready_to_assess',
      facts: {
        hasSystem: true,
        systemComponents: ['job integrated and wlm diva'],
        systemAssessmentText: 'job integrated and wlm diva',
      },
    };
    const text = 'I want to buy a new DAC';
    const ctx = defaultCtx(text);
    const t = transition(state, text, ctx);

    // Should transition to shopping
    expect(t.state.mode).toBe('shopping');
  });

  it('symptom language exits to diagnosis', () => {
    const state: ConvState = {
      mode: 'system_assessment',
      stage: 'ready_to_assess',
      facts: {
        hasSystem: true,
        systemComponents: ['job integrated and wlm diva'],
        systemAssessmentText: 'job integrated and wlm diva',
      },
    };
    const text = 'my system sounds too bright and fatiguing';
    const ctx = defaultCtx(text);
    const t = transition(state, text, ctx);

    expect(t.state.mode).toBe('diagnosis');
  });
});

// ═══════════════════════════════════════════════════════════════
// FLOW 5: System component text accumulation
// ═══════════════════════════════════════════════════════════════
describe('Flow 5: text accumulation across turns', () => {
  it('systemAssessmentText accumulates across multiple turns', () => {
    let state: ConvState = {
      mode: 'system_assessment',
      stage: 'assembling_system',
      facts: { hasSystem: true },
    };

    // Turn 1
    const t1 = transition(state, 'job integrated amp and wlm diva speakers', {
      hasSystem: true,
      subjectCount: 2,
      detectedIntent: 'system_assessment',
    });
    state = t1.state;
    expect(state.facts.systemAssessmentText).toContain('job');
    expect(state.facts.systemAssessmentText).toContain('wlm');

    // Turn 2 — user adds source
    const t2 = transition(state, 'i also have a chord qutest dac', {
      hasSystem: true,
      subjectCount: 1,
      detectedIntent: 'system_assessment',
    });
    state = t2.state;
    expect(state.facts.systemAssessmentText).toContain('job');
    expect(state.facts.systemAssessmentText).toContain('wlm');
    expect(state.facts.systemAssessmentText).toContain('chord qutest');
    expect(state.facts.systemComponents!.length).toBe(2);
  });
});
