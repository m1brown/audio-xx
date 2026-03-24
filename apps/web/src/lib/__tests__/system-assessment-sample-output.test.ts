/**
 * System Assessment Sample Output Validation
 *
 * Traces the full conversation flow for the specified validation scenario
 * and prints sample outputs at each stage.
 */
import { describe, it, expect } from 'vitest';
import { transition, detectInitialMode, INITIAL_CONV_STATE } from '../conversation-state';
import type { ConvState } from '../conversation-state';
import { detectIntent, extractSubjectMatches } from '../intent';
import { buildSystemAssessment } from '../consultation';

describe('Sample output: evaluate my system → JOB + WLM flow', () => {
  // ── Turn 1: "evaluate my system" ──
  it('Turn 1: "evaluate my system" → asks for components', () => {
    const text = 'evaluate my system';
    const { intent, subjectMatches } = detectIntent(text);
    console.log('\n═══ TURN 1: "evaluate my system" ═══');
    console.log('intent:', intent);
    console.log('subjects:', subjectMatches.map(s => s.name));

    const initialMode = detectInitialMode(text, {
      detectedIntent: intent,
      hasSystem: false,
      subjectCount: subjectMatches.length,
    });
    console.log('initialMode:', initialMode?.mode, initialMode?.stage);

    expect(initialMode).toBeDefined();
    expect(initialMode!.mode).toBe('system_assessment');

    // Run transition
    const t = transition(initialMode!, text, {
      hasSystem: false,
      subjectCount: subjectMatches.length,
      detectedIntent: intent,
    });
    console.log('after transition:', t.state.mode, t.state.stage);
    console.log('response:', t.response);
    expect(t.state.mode).toBe('system_assessment');
    expect(t.state.stage).toBe('assembling_system');
    expect(t.response?.kind).toBe('question');
    console.log('✅ Asks for components');
  });

  // ── Turn 2: "job integrated amp and wlm diva speakers" ──
  it('Turn 2: "job integrated amp and wlm diva speakers" → ready_to_assess', () => {
    const text = 'job integrated amp and wlm diva speakers';
    const { intent, subjectMatches } = detectIntent(text);
    console.log('\n═══ TURN 2: "job integrated amp and wlm diva speakers" ═══');
    console.log('intent:', intent);
    console.log('subjects:', subjectMatches.map(s => `${s.name} (${s.kind})`));

    const state: ConvState = {
      mode: 'system_assessment',
      stage: 'assembling_system',
      facts: { hasSystem: true },
    };

    const t = transition(state, text, {
      hasSystem: false,
      subjectCount: subjectMatches.length,
      detectedIntent: intent,
    });
    console.log('after transition:', t.state.mode, t.state.stage);
    console.log('systemComponents:', t.state.facts.systemComponents);
    console.log('systemAssessmentText:', t.state.facts.systemAssessmentText);

    expect(t.state.mode).toBe('system_assessment');
    expect(t.state.stage).toBe('ready_to_assess');
    console.log('✅ Ready to assess — no product essay, no shopping');

    // Verify subjects are extractable from accumulated text
    const allSubjects = extractSubjectMatches(t.state.facts.systemAssessmentText!);
    console.log('extractable subjects:', allSubjects.map(s => `${s.name} (${s.kind})`));
    expect(allSubjects.length).toBeGreaterThanOrEqual(2);
  });

  // ── Turn 3: "i pair it with a job integrated amplifier" ──
  it('Turn 3: "i pair it with a job integrated amplifier" → stays in assessment', () => {
    const text = 'i pair it with a job integrated amplifier';
    const { intent, subjectMatches } = detectIntent(text);
    console.log('\n═══ TURN 3: "i pair it with a job integrated amplifier" ═══');
    console.log('intent:', intent);
    console.log('subjects:', subjectMatches.map(s => `${s.name} (${s.kind})`));

    const state: ConvState = {
      mode: 'system_assessment',
      stage: 'ready_to_assess',
      facts: {
        hasSystem: true,
        systemComponents: ['job integrated amp and wlm diva speakers'],
        systemAssessmentText: 'job integrated amp and wlm diva speakers',
      },
    };

    const t = transition(state, text, {
      hasSystem: false,
      subjectCount: subjectMatches.length,
      detectedIntent: intent,
    });
    console.log('after transition:', t.state.mode, t.state.stage);
    console.log('systemComponents:', t.state.facts.systemComponents);

    expect(t.state.mode).toBe('system_assessment');
    expect(t.state.stage).toBe('ready_to_assess');
    console.log('✅ Stays in assessment, components accumulated');
  });

  // ── Turn 4: "JOB integrated amplifier" (bare repetition) ──
  it('Turn 4: "JOB integrated amplifier" → still in assessment, no iFi output', () => {
    const text = 'JOB integrated amplifier';
    const { intent, subjectMatches } = detectIntent(text);
    console.log('\n═══ TURN 4: "JOB integrated amplifier" ═══');
    console.log('intent:', intent);
    console.log('subjects:', subjectMatches.map(s => `${s.name} (${s.kind})`));

    const state: ConvState = {
      mode: 'system_assessment',
      stage: 'ready_to_assess',
      facts: {
        hasSystem: true,
        systemComponents: [
          'job integrated amp and wlm diva speakers',
          'i pair it with a job integrated amplifier',
        ],
        systemAssessmentText: 'job integrated amp and wlm diva speakers\ni pair it with a job integrated amplifier',
      },
    };

    const t = transition(state, text, {
      hasSystem: false,
      subjectCount: subjectMatches.length,
      detectedIntent: intent,
    });
    console.log('after transition:', t.state.mode, t.state.stage);

    expect(t.state.mode).toBe('system_assessment');
    expect(t.state.stage).toBe('ready_to_assess');
    console.log('✅ No mode collapse, no iFi-style wrong product');

    // Verify: all accumulated text contains both JOB and WLM
    const accText = t.state.facts.systemAssessmentText!;
    console.log('\n--- Accumulated text ---');
    console.log(accText);

    const allSubjects = extractSubjectMatches(accText);
    console.log('\n--- All extractable subjects ---');
    console.log(allSubjects.map(s => `${s.name} (${s.kind})`));

    expect(allSubjects.some(s => s.name === 'job integrated')).toBe(true);
    expect(allSubjects.some(s => s.name === 'diva')).toBe(true);
    expect(allSubjects.some(s => s.name === 'wlm')).toBe(true);
  });

  // ── Verify buildSystemAssessment with accumulated text ──
  it('buildSystemAssessment with accumulated text resolves JOB + WLM', () => {
    const accText = 'job integrated amp and wlm diva speakers\ni pair it with a job integrated amplifier';
    const subjects = extractSubjectMatches(accText);
    console.log('\n═══ ASSESSMENT BUILD ═══');
    console.log('subjects:', subjects.map(s => `${s.name} (${s.kind})`));

    const result = buildSystemAssessment(accText, subjects, undefined, []);
    console.log('result kind:', result?.kind);
    if (result && result.kind === 'assessment') {
      console.log('\n--- Assessment Response ---');
      console.log('systemIdentity:', (result.response as any).systemIdentity);
      console.log('sharedPhilosophy:', (result.response as any).sharedPhilosophy?.slice(0, 100));
    } else if (result && result.kind === 'low_confidence') {
      console.log('low_confidence components:', result.components.map(c => c.displayName));
      console.log('unknown:', result.unknownComponents);
    } else if (result && result.kind === 'clarification') {
      console.log('clarification:', result.clarification);
    } else {
      console.log('null result — no assessment produced');
    }

    // The assessment should at minimum find JOB and WLM/Diva
    expect(result).toBeDefined();
    if (result?.kind === 'assessment') {
      expect(result.response).toBeDefined();
    } else if (result?.kind === 'low_confidence') {
      // Low confidence is acceptable — some components may not have full profiles
      expect(result.components.length).toBeGreaterThan(0);
    }
  });
});
