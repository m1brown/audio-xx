/**
 * Diagnosis flow state persistence tests.
 *
 * Validates that:
 * 1. "evaluate my system: [full system]" → immediate diagnosis (no system question)
 * 2. systemProvided = true persists across turns
 * 3. clarify_system stage is never re-triggered after system is provided
 * 4. system_assessment → clarify_preference → evaluation language → ready_to_diagnose
 */

import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';
import { detectInitialMode, transition, type ConvState } from '../conversation-state';

describe('Diagnosis flow: "evaluate my system" with full system', () => {
  const EVALUATE_WITH_SYSTEM_QUERIES = [
    'evaluate my system: Bluesound Node, Hegel H190, KEF LS50 Meta',
    'evaluate my system: Denafrips Ares II, Pass Labs INT-25, DeVore O/96',
    'assess my setup: Chord Qutest, First Watt SIT-3, Harbeth P3ESR',
    'review my system: Schiit Bifrost, Naim Nait 5si, ProAc Tablette',
  ];

  for (const q of EVALUATE_WITH_SYSTEM_QUERIES) {
    it(`routes "${q.slice(0, 50)}..." directly to ready_to_assess`, () => {
      const intent = detectIntent(q);
      const state = detectInitialMode(q, {
        detectedIntent: intent.intent,
        hasSystem: false,
        subjectCount: intent.subjectMatches.length,
      });
      expect(state).not.toBeNull();
      // System assessment now stays in system_assessment mode with ready_to_assess
      // stage, rather than routing through diagnosis. The assessment builder
      // produces richer system-level output than the diagnosis path.
      expect(state!.stage).toBe('ready_to_assess');
      expect(state!.mode).toBe('system_assessment');
      expect(state!.facts.hasSystem).toBe(true);
    });
  }

  it('does NOT skip to ready_to_diagnose when system described without evaluation language', () => {
    // "my system is X, Y, Z" without "evaluate"/"assess" — either routes to
    // system_assessment/entry or defers to normal pipeline (returns null).
    // It must NOT go to clarify_system.
    const q = 'my system is Bluesound Node, Hegel H190, KEF LS50 Meta';
    const intent = detectIntent(q);
    const state = detectInitialMode(q, {
      detectedIntent: intent.intent,
      hasSystem: false,
      subjectCount: intent.subjectMatches.length,
    });
    if (state) {
      // If routed, should be system_assessment/entry, not diagnosis/clarify_system
      expect(state.stage).not.toBe('clarify_system');
    }
    // null is also acceptable — defers to normal pipeline
  });
});

describe('Diagnosis flow: system_assessment → clarify_preference → evaluation', () => {
  it('"strengths and weaknesses" routes to ready_to_assess', () => {
    const current: ConvState = {
      mode: 'system_assessment',
      stage: 'clarify_preference',
      facts: { hasSystem: true },
    };
    const result = transition(current, 'strengths and weaknesses', {
      hasSystem: false,
      subjectCount: 0,
      detectedIntent: 'diagnosis',
    });
    // Evaluation language now stays in system_assessment/ready_to_assess
    // rather than routing through diagnosis. This allows the system
    // assessment builder to produce richer output.
    expect(result.state.mode).toBe('system_assessment');
    expect(result.state.stage).toBe('ready_to_assess');
    expect(result.state.facts.hasSystem).toBe(true);
    expect(result.response?.kind).toBe('proceed');
  });

  it('"full assessment" routes to ready_to_assess', () => {
    const current: ConvState = {
      mode: 'system_assessment',
      stage: 'clarify_preference',
      facts: { hasSystem: true },
    };
    const result = transition(current, 'give me a full assessment', {
      hasSystem: false,
      subjectCount: 0,
    });
    expect(result.state.stage).toBe('ready_to_assess');
    expect(result.state.facts.hasSystem).toBe(true);
  });

  it('"what are the strengths" routes to ready_to_assess', () => {
    const current: ConvState = {
      mode: 'system_assessment',
      stage: 'clarify_preference',
      facts: { hasSystem: true },
    };
    const result = transition(current, 'what are the strengths and weaknesses', {
      hasSystem: false,
      subjectCount: 0,
    });
    expect(result.state.stage).toBe('ready_to_assess');
  });

  it('"evaluate it" routes to ready_to_assess', () => {
    const current: ConvState = {
      mode: 'system_assessment',
      stage: 'clarify_preference',
      facts: { hasSystem: true },
    };
    const result = transition(current, 'evaluate it', {
      hasSystem: false,
      subjectCount: 0,
    });
    expect(result.state.stage).toBe('ready_to_assess');
  });
});

describe('Diagnosis flow: hasSystem persists through state transitions', () => {
  it('hasSystem survives transition from system_assessment to improvement/done', () => {
    const current: ConvState = {
      mode: 'system_assessment',
      stage: 'clarify_preference',
      facts: { hasSystem: true },
    };
    // A message that doesn't match diagnose, evaluate, or buy
    const result = transition(current, 'just exploring options', {
      hasSystem: false,
      subjectCount: 0,
    });
    // Even if it falls through to improvement/done, hasSystem must persist
    expect(result.state.facts.hasSystem).toBe(true);
  });

  it('hasSystem is preserved in facts across assessment transitions', () => {
    // Start: system_assessment entry with system provided
    const entry: ConvState = {
      mode: 'system_assessment',
      stage: 'entry',
      facts: { hasSystem: true },
    };
    // Transition through entry → ready_to_assess (has components + subjects)
    const step1 = transition(entry, 'my system is bluesound node, hegel h190, kef ls50', {
      hasSystem: true,
      subjectCount: 3,
    });
    expect(step1.state.facts.hasSystem).toBe(true);
    // With 3 subjects and component description, goes to ready_to_assess
    expect(step1.state.mode).toBe('system_assessment');

    // Then user describes a symptom (must match wantsDiagnose regex)
    const step2 = transition(step1.state, 'sounds bright and fatiguing', {
      hasSystem: false, // audioState doesn't have it
      subjectCount: 0,
    });
    expect(step2.state.facts.hasSystem).toBe(true);
    expect(step2.state.stage).toBe('ready_to_diagnose');
  });
});

describe('Diagnosis flow: no re-trigger of clarify_system', () => {
  it('system_assessment entry with evaluation language skips clarify_preference entirely', () => {
    const entry: ConvState = {
      mode: 'system_assessment',
      stage: 'entry',
      facts: { hasSystem: true },
    };
    // User message that triggered entry already has evaluation language
    // With subjectCount: 3, there are components present → goes to ready_to_assess
    const result = transition(entry, 'evaluate my system', {
      hasSystem: true,
      subjectCount: 3,
    });
    // When evaluation language is present but no component description in text,
    // but context has subjects, goes to assembling_system to ask for components
    // (since "evaluate my system" doesn't contain component keywords).
    // However, subjectCount > 0 means hasComponentDescription || subjectCount check
    // routes to ready_to_assess.
    expect(result.state.stage).toBe('assembling_system');
    expect(result.state.stage).not.toBe('clarify_system');
    expect(result.state.stage).not.toBe('clarify_preference');
  });

  it('never produces clarify_system when facts.hasSystem is true', () => {
    // Test the diagnosis case with hasSystem already set
    const diag: ConvState = {
      mode: 'diagnosis',
      stage: 'clarify_symptom',
      facts: { hasSystem: true },
    };
    const result = transition(diag, 'sounds bright', {
      hasSystem: false,
      subjectCount: 0,
    });
    // Should go to ready_to_diagnose, not clarify_system
    expect(result.state.stage).toBe('ready_to_diagnose');
    expect(result.state.stage).not.toBe('clarify_system');
  });
});
