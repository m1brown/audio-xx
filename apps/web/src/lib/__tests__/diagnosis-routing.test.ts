/**
 * Diagnosis routing priority tests.
 *
 * When a user provides system components AND a sound complaint,
 * the system must route to diagnosis — not shopping, gear inquiry,
 * or product assessment.
 */

import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';
import { detectInitialMode } from '../conversation-state';

describe('Diagnosis routing priority', () => {
  const DIAGNOSIS_QUERIES = [
    'wilson speakers and soulution amp, a little dry',
    'harbeth p3esr with naim nait, sounds a bit bright',
    'I have a leben cs300 and devore o/93, it can be fatiguing',
    'my chord qutest and pass labs sounds too clinical',
    'focal utopia and hegel h390, something feels off',
    'running a denafrips pontus into a first watt sit-3, lacks bass',
    'kef ls50 and cambridge audio cxa81, a little thin',
    'magnepan .7 with parasound a21, a touch lean',
  ];

  for (const q of DIAGNOSIS_QUERIES) {
    it(`routes "${q}" to diagnosis`, () => {
      const result = detectIntent(q);
      expect(result.intent).toBe('diagnosis');
    });
  }

  it('extracts subjects from diagnosis query', () => {
    const result = detectIntent('wilson speakers and soulution amp, a little dry');
    expect(result.subjects.length).toBeGreaterThanOrEqual(1);
    const subjectNames = result.subjects.map(s => s.toLowerCase());
    expect(subjectNames.some(s => s.includes('wilson') || s.includes('soulution'))).toBe(true);
  });

  // Shopping must NOT trigger when system + complaint are present
  const SHOULD_NOT_BE_SHOPPING = [
    'wilson speakers and soulution amp, a little dry',
    'I have devore speakers and shindo amp, sounds a bit dull',
    'running klipsch heresy with leben, too forward',
  ];

  for (const q of SHOULD_NOT_BE_SHOPPING) {
    it(`does NOT route "${q}" to shopping`, () => {
      const result = detectIntent(q);
      expect(result.intent).not.toBe('shopping');
    });
  }

  for (const q of SHOULD_NOT_BE_SHOPPING) {
    it(`does NOT route "${q}" to gear_inquiry`, () => {
      const result = detectIntent(q);
      expect(result.intent).not.toBe('gear_inquiry');
    });
  }
});

describe('Diagnosis conversation state — inline system detection', () => {
  // When the user provides components + complaint on the FIRST turn,
  // the system should go straight to ready_to_diagnose, not clarify_system.
  const INLINE_SYSTEM_QUERIES = [
    'wilson speakers and soulution amp, a little dry',
    'harbeth p3esr with naim nait, sounds a bit bright',
    'kef ls50 and cambridge audio cxa81, a little thin',
    'focal utopia and hegel h390, something feels off',
    'running a denafrips pontus into a first watt sit-3, lacks bass',
  ];

  for (const q of INLINE_SYSTEM_QUERIES) {
    it(`goes to ready_to_diagnose for "${q}" (no prior system)`, () => {
      const intent = detectIntent(q);
      const state = detectInitialMode(q, {
        detectedIntent: intent.intent,
        hasSystem: false,  // first turn, no prior system
        subjectCount: intent.subjectMatches.length,
      });
      expect(state).not.toBeNull();
      expect(state!.mode).toBe('diagnosis');
      expect(state!.stage).toBe('ready_to_diagnose');
      expect(state!.facts.hasSystem).toBe(true);
    });
  }

  it('still asks for system when no subjects are present', () => {
    const q = 'sounds a bit bright and thin';
    const intent = detectIntent(q);
    const state = detectInitialMode(q, {
      detectedIntent: intent.intent,
      hasSystem: false,
      subjectCount: 0,
    });
    expect(state).not.toBeNull();
    expect(state!.mode).toBe('diagnosis');
    expect(state!.stage).toBe('clarify_system');
  });
});

describe('Diagnosis must NOT be triggered for pure gear queries', () => {
  const PURE_GEAR_QUERIES = [
    'what do you think of the chord qutest',
    'tell me about denafrips',
    'how is the wilson sabrina',
  ];

  for (const q of PURE_GEAR_QUERIES) {
    it(`routes "${q}" to product_assessment, not diagnosis`, () => {
      const result = detectIntent(q);
      // These now correctly route to product_assessment (not gear_inquiry)
      // because assessment language + known product/brand triggers
      // the product_assessment priority gate.
      expect(result.intent).toBe('product_assessment');
    });
  }

  const PURE_SHOPPING_QUERIES = [
    'I want to buy a DAC',
    'recommend speakers under 2000',
    'best amp for my system',
  ];

  for (const q of PURE_SHOPPING_QUERIES) {
    it(`routes "${q}" to shopping, not diagnosis`, () => {
      const result = detectIntent(q);
      expect(result.intent).toBe('shopping');
    });
  }
});
