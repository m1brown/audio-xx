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
