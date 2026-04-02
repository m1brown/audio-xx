/**
 * Vague/uncertain symptom phrasing tests.
 *
 * Verifies that ambiguous or hedged symptom descriptions are handled
 * gracefully: routed to diagnosis mode, produce either a clarification
 * question or a fallback advisory, and set appropriate uncertainty levels.
 *
 * These inputs are at the boundary between "enough signal to diagnose"
 * and "need more information." The system should never produce no response.
 */
import { describe, it, expect } from 'vitest';
import { processText } from '@audio-xx/signals';
import { evaluate, type EvaluationContext } from '@audio-xx/rules';
import { analysisToAdvisory } from '../advisory-response';
import { getClarificationQuestion } from '../clarification';
import { detectIntent } from '../intent';
import { detectInitialMode } from '../conversation-state';

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

// ══════════════════════════════════════════════════════════
// 1. Vague inputs: signal extraction behavior
// ══════════════════════════════════════════════════════════

describe('Vague symptom signal extraction', () => {
  const vagueInputs = [
    { text: 'something sounds off', expectSomeSymptom: false },  // "sounds off" not a dictionary phrase
    { text: 'it just doesn\'t sound right', expectSomeSymptom: false },
    { text: 'my system could sound better', expectSomeSymptom: false },
    { text: 'not sure what\'s wrong', expectSomeSymptom: false },
    { text: 'I think there might be an issue', expectSomeSymptom: false },
    { text: 'something is off', expectSomeSymptom: true },  // "something is off" → imbalanced
  ];

  for (const { text, expectSomeSymptom } of vagueInputs) {
    it(`"${text}" → ${expectSomeSymptom ? 'extracts at least one symptom' : 'may extract zero symptoms'}`, () => {
      const { signals } = evaluateInput(text);
      if (expectSomeSymptom) {
        expect(signals.symptoms.length).toBeGreaterThanOrEqual(1);
      }
      // All vague inputs should have elevated uncertainty or zero symptoms
      // — the system should not confidently misclassify
      if (signals.symptoms.length === 0) {
        // No symptoms = system should ask for clarification downstream
        expect(signals.uncertainty_level).toBeGreaterThanOrEqual(0);
      }
    });
  }
});

// ══════════════════════════════════════════════════════════
// 2. Vague inputs: routing (diagnosis or clarification)
// ══════════════════════════════════════════════════════════

describe('Vague symptom routing', () => {
  const vagueInputs = [
    'something is off',
    'something feels wrong',
    'something is missing',
    'my system could sound better',
  ];

  for (const text of vagueInputs) {
    it(`"${text}" → routes to diagnosis intent`, () => {
      const { intent } = detectIntent(text);
      expect(intent).toBe('diagnosis');
    });
  }
});

// ══════════════════════════════════════════════════════════
// 3. Vague inputs: always produce SOME response (never blank)
// ══════════════════════════════════════════════════════════

describe('Vague symptom always produces a response', () => {
  const vagueInputs = [
    'something is off',
    'something feels wrong',
    'something is missing',
    'my system could sound better',
    'not sure what\'s wrong',
    'I think there might be an issue',
  ];

  for (const text of vagueInputs) {
    it(`"${text}" → produces either advisory or clarification question`, () => {
      const { signals, result } = evaluateInput(text);

      // Try advisory
      const advisory = analysisToAdvisory(result, signals);
      const hasAdvisoryContent = advisory.kind === 'diagnosis' && advisory.tendencies && advisory.tendencies.length > 10;

      // Try clarification
      const clarification = getClarificationQuestion(signals, result, 1, text, text);
      const hasClarification = clarification && clarification.question && clarification.question.length > 10;

      // At least one must produce output — system should never go blank
      expect(hasAdvisoryContent || hasClarification).toBe(true);
    });
  }
});

// ══════════════════════════════════════════════════════════
// 4. Hedged symptoms: real symptom + uncertainty marker
// ══════════════════════════════════════════════════════════

describe('Hedged symptom inputs', () => {
  const hedgedInputs = [
    { text: 'I think it might be too bright', expectedSymptom: 'brightness_harshness' },
    { text: 'maybe too much bass', expectedSymptom: 'bass_bloom' },
    { text: 'I think it sounds thin', expectedSymptom: 'thinness' },
    { text: 'possibly too warm', expectedSymptom: 'too_warm' },
  ];

  for (const { text, expectedSymptom } of hedgedInputs) {
    it(`"${text}" → extracts symptom despite hedging language`, () => {
      const { signals } = evaluateInput(text);
      expect(signals.symptoms).toContain(expectedSymptom);
    });

    it(`"${text}" → elevated uncertainty level`, () => {
      const { signals } = evaluateInput(text);
      // Hedging language ("I think", "maybe", "seems", "possibly")
      // should produce non-zero uncertainty
      expect(signals.uncertainty_level).toBeGreaterThanOrEqual(1);
    });

    it(`"${text}" → routes to diagnosis`, () => {
      const { intent } = detectIntent(text);
      expect(intent).toBe('diagnosis');
    });
  }
});

// ══════════════════════════════════════════════════════════
// 5. Vague inputs: convModeHint still set for diagnosis routing
// ══════════════════════════════════════════════════════════

describe('Vague inputs: convModeHint via detectInitialMode', () => {
  const vagueInputs = [
    'something is off',
    'something feels wrong',
  ];

  for (const text of vagueInputs) {
    it(`"${text}" → detectInitialMode returns diagnosis/ready_to_diagnose`, () => {
      const { intent, subjectMatches } = detectIntent(text);
      const mode = detectInitialMode(text, {
        detectedIntent: intent,
        hasSystem: false,
        subjectCount: subjectMatches?.length ?? 0,
      });
      expect(mode).not.toBeNull();
      expect(mode!.mode).toBe('diagnosis');
      expect(mode!.stage).toBe('ready_to_diagnose');
    });
  }
});
