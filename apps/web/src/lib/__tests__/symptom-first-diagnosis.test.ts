/**
 * Tests: Symptom-first diagnosis gating
 *
 * Validates that when a user provides a symptom without system details,
 * the system interprets the symptom first before asking for components.
 */
import { describe, it, expect } from 'vitest';
import {
  detectInitialMode,
  transition,
  interpretSymptom,
  INITIAL_CONV_STATE,
} from '../conversation-state';

// ── interpretSymptom unit tests ──────────────────────

describe('interpretSymptom', () => {
  it('returns a thin-specific interpretation', () => {
    const result = interpretSymptom('my system sounds thin');
    expect(result).toMatch(/tonal balance/i);
    expect(result).not.toBe('Got it.');
  });

  it('returns a dry-specific interpretation', () => {
    const result = interpretSymptom('my system sounds dry');
    expect(result).toMatch(/harmonic overtones|strips/i);
  });

  it('returns a bright+fatiguing interpretation', () => {
    const result = interpretSymptom('bright and fatiguing');
    expect(result).toMatch(/bright|fatigue|upper/i);
  });

  it('returns a harsh-specific interpretation', () => {
    const result = interpretSymptom('the sound is harsh');
    expect(result).toMatch(/harsh|distortion|resonance/i);
  });

  it('returns a muddy-specific interpretation', () => {
    const result = interpretSymptom('sounds muddy');
    expect(result).toMatch(/muddy|low-mid|bass control/i);
  });

  it('returns a clinical/sterile interpretation', () => {
    const result = interpretSymptom('my system sounds sterile');
    expect(result).toMatch(/sterile|clinical|precision/i);
  });

  it('returns a generic fallback for unknown symptoms', () => {
    const result = interpretSymptom('something is weird');
    expect(result).toMatch(/signal chain|interaction/i);
  });
});

// ── detectInitialMode: symptom-first entry ──────────

describe('detectInitialMode: symptom-first diagnosis', () => {
  it('"my system sounds thin" → diagnosis/clarify_system (not blunt gating)', () => {
    const result = detectInitialMode('my system sounds thin', {
      detectedIntent: 'diagnosis',
      hasSystem: false,
      subjectCount: 0,
    });
    expect(result).not.toBeNull();
    expect(result!.mode).toBe('diagnosis');
    expect(result!.stage).toBe('clarify_system');
    expect(result!.facts.symptom).toBe('my system sounds thin');
  });

  it('"my system sounds thin" with system → ready_to_diagnose directly', () => {
    const result = detectInitialMode('my system sounds thin', {
      detectedIntent: 'diagnosis',
      hasSystem: true,
      subjectCount: 0,
    });
    expect(result).not.toBeNull();
    expect(result!.mode).toBe('diagnosis');
    expect(result!.stage).toBe('ready_to_diagnose');
  });

  it('"bright and fatiguing" with named components → ready_to_diagnose', () => {
    const result = detectInitialMode('bright and fatiguing with my hegel and kef speakers', {
      detectedIntent: 'diagnosis',
      hasSystem: false,
      subjectCount: 2,
    });
    expect(result).not.toBeNull();
    expect(result!.mode).toBe('diagnosis');
    expect(result!.stage).toBe('ready_to_diagnose');
    expect(result!.facts.hasSystem).toBe(true);
  });
});

// ── transition: symptom-aware responses ──────────────

describe('transition: symptom-aware diagnosis responses', () => {
  it('orientation → diagnosis with symptom interpretation', () => {
    const state = { mode: 'orientation' as const, stage: 'entry' as const, facts: {} };
    const result = transition(state, 'it sounds thin and harsh', {
      hasSystem: false,
      subjectCount: 0,
    });
    expect(result.state.mode).toBe('diagnosis');
    expect(result.state.stage).toBe('clarify_system');
    expect(result.response).not.toBeNull();
    expect(result.response!.kind).toBe('question');
    if (result.response!.kind === 'question') {
      // The acknowledge should contain symptom interpretation, NOT just a quote
      expect(result.response!.acknowledge).not.toMatch(/^Understood —/);
      expect(result.response!.acknowledge).toMatch(/tonal|harmonic|distortion|upper/i);
      // The question should ask for components, not bluntly "What's in your system?"
      expect(result.response!.question).toMatch(/component|chain/i);
    }
  });

  it('diagnosis fallback uses symptom interpretation', () => {
    const state = {
      mode: 'diagnosis' as const,
      stage: 'entry' as const,
      facts: { symptom: 'my system sounds dry' },
    };
    const result = transition(state, 'help me figure this out', {
      hasSystem: false,
      subjectCount: 0,
    });
    expect(result.state.mode).toBe('diagnosis');
    expect(result.response).not.toBeNull();
    if (result.response!.kind === 'question') {
      expect(result.response!.acknowledge).toMatch(/harmonic|strips|overtone/i);
    }
  });

  it('clarify_symptom → clarify_system uses symptom interpretation', () => {
    const state = {
      mode: 'diagnosis' as const,
      stage: 'clarify_symptom' as const,
      facts: {},
    };
    const result = transition(state, 'it sounds dull and lifeless', {
      hasSystem: false,
      subjectCount: 0,
    });
    expect(result.state.mode).toBe('diagnosis');
    expect(result.state.stage).toBe('clarify_system');
    expect(result.response).not.toBeNull();
    if (result.response!.kind === 'question') {
      expect(result.response!.acknowledge).toMatch(/dull|lifeless|smoothing|damping/i);
      expect(result.response!.question).toMatch(/component|chain/i);
    }
  });
});

// ── Full flow simulation ──────────────────────────────

describe('Full flow: symptom-first → system → diagnosis', () => {
  it('Turn 1: symptom → interpret + ask for system', () => {
    const initial = detectInitialMode('my system sounds thin', {
      detectedIntent: 'diagnosis',
      hasSystem: false,
      subjectCount: 0,
    });
    expect(initial!.mode).toBe('diagnosis');
    expect(initial!.stage).toBe('clarify_system');
    expect(initial!.facts.symptom).toBe('my system sounds thin');
  });

  it('Turn 2: system provided → ready_to_diagnose', () => {
    const state = {
      mode: 'diagnosis' as const,
      stage: 'clarify_system' as const,
      facts: { symptom: 'my system sounds thin' },
    };
    const result = transition(state, 'bluesound node, hegel h190, kef q350', {
      hasSystem: false,
      subjectCount: 3,
    });
    expect(result.state.mode).toBe('diagnosis');
    expect(result.state.stage).toBe('ready_to_diagnose');
    expect(result.state.facts.hasSystem).toBe(true);
    expect(result.response!.kind).toBe('proceed');
  });

  it('No blunt "What\'s in your system?" anywhere in the response', () => {
    // Test all paths that could produce a system question
    const paths = [
      // detectInitialMode path
      () => {
        detectInitialMode('my system sounds dry', {
          detectedIntent: 'diagnosis',
          hasSystem: false,
          subjectCount: 0,
        });
        // This path dispatches in page.tsx — we test interpretSymptom directly
        const ack = interpretSymptom('my system sounds dry');
        return ack;
      },
      // orientation → diagnosis
      () => {
        const result = transition(
          { mode: 'orientation', stage: 'entry', facts: {} },
          'it sounds thin and fatiguing',
          { hasSystem: false, subjectCount: 0 },
        );
        return result.response?.kind === 'question' ? result.response.acknowledge : '';
      },
      // diagnosis fallback
      () => {
        const result = transition(
          { mode: 'diagnosis', stage: 'entry' as any, facts: { symptom: 'bright and harsh' } },
          'what can i do',
          { hasSystem: false, subjectCount: 0 },
        );
        return result.response?.kind === 'question' ? result.response.acknowledge : '';
      },
    ];

    for (const getAck of paths) {
      const ack = getAck();
      // None of these should be a blunt quote-back or generic "Got it"
      expect(ack).not.toMatch(/^Understood — "/);
      expect(ack).not.toBe('Got it.');
    }
  });
});
