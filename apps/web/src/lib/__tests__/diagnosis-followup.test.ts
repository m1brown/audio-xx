import { describe, it, expect } from 'vitest';
import { processText } from '@audio-xx/signals';
import { isDiagnosisFollowUp } from '../intent';
import { refineDiagnosisWithContext } from '../advisory-response';
import type { AdvisoryResponse } from '../advisory-response';

// ── Signal extraction: bass complaint phrases ────────────
describe('Bass complaint signal extraction', () => {
  const BASS_PHRASES = [
    { input: "i don't like how much bass i hear", expectedSymptom: 'bass_bloom' },
    { input: 'too much bass', expectedSymptom: 'bass_bloom' },
    { input: 'way too much low end', expectedSymptom: 'bass_bloom' },
    { input: 'drowning in bass', expectedSymptom: 'bass_bloom' },
    { input: 'overwhelmed by bass', expectedSymptom: 'bass_bloom' },
    { input: 'all i hear is bass', expectedSymptom: 'bass_bloom' },
    { input: 'so much bass', expectedSymptom: 'bass_bloom' },
  ];

  for (const { input, expectedSymptom } of BASS_PHRASES) {
    it(`"${input}" → symptom: ${expectedSymptom}`, () => {
      const result = processText(input);
      expect(result.symptoms).toContain(expectedSymptom);
      expect(result.traits.damping_control).toBe('down');
      expect(result.traits.bass_weight).toBe('up');
    });
  }
});

// ── isDiagnosisFollowUp detection ────────────────────────
describe('isDiagnosisFollowUp', () => {
  const ROOM_FOLLOWUP = 'Can you describe the room — size, shape, and where the speakers are positioned relative to walls and corners?';

  it('room description after bass_bloom diagnosis → true', () => {
    const result = isDiagnosisFollowUp(
      'i don\'t know the metrics but it is rather small and the speakers are next to each other in the middle of the wall',
      ROOM_FOLLOWUP,
    );
    expect(result).toBe(true);
  });

  it('short room description → true', () => {
    expect(isDiagnosisFollowUp('small room, speakers on a shelf', ROOM_FOLLOWUP)).toBe(true);
  });

  it('returns false when no previous follow-up', () => {
    expect(isDiagnosisFollowUp('small room', undefined)).toBe(false);
  });

  it('new symptom complaint after diagnosis → false (topic change)', () => {
    expect(isDiagnosisFollowUp('it also sounds too bright', ROOM_FOLLOWUP)).toBe(false);
  });

  it('"now it sounds thin" → false (new symptom)', () => {
    expect(isDiagnosisFollowUp('now it sounds thin and lifeless', ROOM_FOLLOWUP)).toBe(false);
  });

  it('"lacks detail" → false (new symptom)', () => {
    expect(isDiagnosisFollowUp('it lacks detail and clarity', ROOM_FOLLOWUP)).toBe(false);
  });

  it('shopping request → false (topic change)', () => {
    expect(isDiagnosisFollowUp('best dac under 1000', ROOM_FOLLOWUP)).toBe(false);
  });

  // ── Category-pivot escape (2026-05-12) ──────────────────
  // Bug: explicit category pivots after a diagnosis follow-up question
  // were being treated as answers to that question instead of as topic
  // shifts. Confirms the fix to the pivot-verb + category-word
  // rejection check.
  describe('explicit category pivot → false (topic shift)', () => {
    const FOLLOWUP = 'Can you tell me more about which frequencies sound off?';
    it('"i\'m thinking about a turntable" → false', () => {
      expect(isDiagnosisFollowUp("i'm thinking about a turntable", FOLLOWUP)).toBe(false);
    });
    it('"thinking about a turntable" → false', () => {
      expect(isDiagnosisFollowUp('thinking about a turntable', FOLLOWUP)).toBe(false);
    });
    it('"looking at DACs" → false', () => {
      expect(isDiagnosisFollowUp('looking at DACs', FOLLOWUP)).toBe(false);
    });
    it('"considering speakers" → false', () => {
      expect(isDiagnosisFollowUp('considering speakers', FOLLOWUP)).toBe(false);
    });
    it('"looking for headphones" → false', () => {
      expect(isDiagnosisFollowUp('looking for headphones', FOLLOWUP)).toBe(false);
    });
    it('"interested in a phono preamp" → false', () => {
      expect(isDiagnosisFollowUp('interested in a phono preamp', FOLLOWUP)).toBe(false);
    });
    it('"i want a streamer" → false', () => {
      expect(isDiagnosisFollowUp('i want a streamer', FOLLOWUP)).toBe(false);
    });
    it('"need an integrated amp" → false', () => {
      expect(isDiagnosisFollowUp('need an integrated amp', FOLLOWUP)).toBe(false);
    });

    // Regression: pivot verbs without a category word remain follow-ups.
    it('"thinking about it more carefully" (no category) → true (still followup)', () => {
      expect(isDiagnosisFollowUp('thinking about it more carefully', FOLLOWUP)).toBe(true);
    });
    it('"looking at the room layout" → true (no product category)', () => {
      expect(isDiagnosisFollowUp('looking at the room layout', FOLLOWUP)).toBe(true);
    });
    // Regression: bare category word in a system-description sentence
    // (a legitimate followup answer) is NOT a pivot because it lacks a
    // pivot verb.
    it('"my DAC is a Schiit Modi" → true (system context, no pivot verb)', () => {
      expect(isDiagnosisFollowUp('my DAC is a Schiit Modi', FOLLOWUP)).toBe(true);
    });
  });
});

// ── refineDiagnosisWithContext ────────────────────────────
describe('refineDiagnosisWithContext: bass_bloom + room', () => {
  const BASS_BLOOM_ADVISORY: AdvisoryResponse = {
    kind: 'diagnosis',
    subject: 'Your bass sounds boomy or resonant',
    tendencies: 'Your system currently leans warm and full-bodied.',
    diagnosisExplanation: 'Bass bloom is almost always room-driven.',
    diagnosisActions: [
      { area: 'Speaker placement', guidance: 'Move speakers away from rear walls and corners.' },
      { area: 'Room treatment', guidance: 'Bass traps in room corners.' },
      { area: 'Amplifier damping', guidance: 'Higher damping factor.', examples: 'Benchmark AHB2, Parasound A23+' },
    ],
    followUp: 'Can you describe the room — size, shape, and where the speakers are positioned relative to walls and corners?',
    diagnostics: {
      matchedPhrases: ['too much bass'],
      symptoms: ['bass_bloom'],
      traits: { damping_control: 'down', bass_weight: 'up' },
    },
  };

  it('small room + speakers against wall → refined actions', () => {
    const refined = refineDiagnosisWithContext(
      BASS_BLOOM_ADVISORY,
      'it is rather small and the speakers are next to each other in the middle of the wall',
    );

    expect(refined).toBeDefined();
    expect(refined!.kind).toBe('diagnosis');

    // Should NOT repeat the room question
    expect(refined!.followUp).not.toContain('describe the room');

    // Should mention small room in explanation
    expect(refined!.diagnosisExplanation).toContain('small room');

    // Should have specific actions for wall-adjacent speakers
    const actionAreas = refined!.diagnosisActions!.map((a) => a.area.toLowerCase());
    expect(actionAreas.some((a) => a.includes('pull') || a.includes('away from'))).toBe(true);
  });

  it('corner placement → mentions corner reinforcement', () => {
    const refined = refineDiagnosisWithContext(
      BASS_BLOOM_ADVISORY,
      'speakers are in the corners of the room',
    );

    expect(refined).toBeDefined();
    expect(refined!.diagnosisExplanation).toContain('corner');
  });

  it('no room info → returns undefined (fall through to pipeline)', () => {
    const refined = refineDiagnosisWithContext(
      BASS_BLOOM_ADVISORY,
      'I just want it to sound better',
    );

    expect(refined).toBeUndefined();
  });

  it('speakers close together → mentions separation', () => {
    const refined = refineDiagnosisWithContext(
      BASS_BLOOM_ADVISORY,
      'they are right next to each other against the wall',
    );

    expect(refined).toBeDefined();
    const actionAreas = refined!.diagnosisActions!.map((a) => a.area.toLowerCase());
    expect(actionAreas.some((a) => a.includes('separation'))).toBe(true);
  });
});
