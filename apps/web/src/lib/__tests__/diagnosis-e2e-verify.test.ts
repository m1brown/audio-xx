/**
 * End-to-end verification: symptom-only diagnosis produces real advisory output,
 * NOT a clarification question. Uses the actual signal processor and rule engine.
 */
import { describe, it, expect } from 'vitest';
import { processText } from '@audio-xx/signals';
import { evaluate, type EvaluationContext } from '@audio-xx/rules';
import { analysisToAdvisory } from '../advisory-response';
import { getClarificationQuestion } from '../clarification';

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

describe('Symptom-only diagnosis output verification', () => {
  const inputs = [
    // ── Original symptom types ──────────────────────────
    { text: 'too bright', expectSymptom: 'brightness_harshness', expectRule: /fatigue|bright/i },
    { text: 'my system sounds thin', expectSymptom: 'thinness', expectRule: /thin/i },
    { text: 'I get listening fatigue', expectSymptom: 'fatigue', expectRule: /fatigue/i },
    { text: 'sounds veiled', expectSymptom: 'congestion_muddiness', expectRule: /congestion|bottleneck/i },
    { text: 'boomy bass', expectSymptom: 'bass_bloom', expectRule: /bass/i },
    { text: 'too much bass', expectSymptom: 'bass_bloom', expectRule: /bass/i },
    { text: 'sounds flat and lifeless', expectSymptom: 'flat_lifeless', expectRule: /flat/i },
    { text: 'narrow soundstage', expectSymptom: 'narrow_soundstage', expectRule: /soundstage|narrow/i },
    { text: 'too much energy', expectSymptom: 'too_forward', expectRule: /composure|intensity|forward/i },

    // ── New symptom types (warmth, imbalance, metallic, distortion, physical) ──
    { text: 'too warm', expectSymptom: 'too_warm', expectRule: /warm|sluggish|clarity/i },
    { text: 'sluggish and syrupy', expectSymptom: 'too_warm', expectRule: /warm|sluggish|clarity/i },
    { text: 'not balanced', expectSymptom: 'imbalanced', expectRule: /imbalance/i },
    { text: 'something is off', expectSymptom: 'imbalanced', expectRule: /imbalance/i },
    { text: 'too metallic', expectSymptom: 'brightness_harshness', expectRule: /fatigue|bright/i },
    { text: 'sounds distorted', expectSymptom: 'fatigue', expectRule: /fatigue|bright/i },
    { text: 'gives me a headache', expectSymptom: 'fatigue', expectRule: /fatigue|bright/i },
    { text: 'makes me sweat', expectSymptom: 'fatigue', expectRule: /fatigue|bright/i },

    // ── "Not enough X" patterns ──────────────────────────
    { text: 'not enough body', expectSymptom: 'thinness', expectRule: /thin/i },
    { text: 'not enough dynamics', expectSymptom: 'flat_lifeless', expectRule: /flat/i },
    { text: 'not enough clarity', expectSymptom: 'congestion_muddiness', expectRule: /congestion|bottleneck/i },
    { text: 'lacks energy', expectSymptom: 'flat_lifeless', expectRule: /flat/i },
  ];

  for (const { text, expectSymptom, expectRule } of inputs) {
    describe(`"${text}"`, () => {
      const { signals, result } = evaluateInput(text);

      it('extracts the correct symptom', () => {
        expect(signals.symptoms).toContain(expectSymptom);
      });

      it('fires a specific rule (not just fallback)', () => {
        expect(result.fired_rules.length).toBeGreaterThanOrEqual(1);
        const primary = result.fired_rules[0];
        expect(primary.id).not.toBe('friendly-advisor-fallback');
        expect(primary.label).toMatch(expectRule);
      });

      it('analysisToAdvisory produces real diagnosis content', () => {
        const advisory = analysisToAdvisory(result, signals);

        // Must be diagnosis kind
        expect(advisory.kind).toBe('diagnosis');

        // Must have explanation (likely causes)
        expect(advisory.tendencies).toBeTruthy();
        expect(advisory.tendencies!.length).toBeGreaterThan(20);

        // Must have actionable content. Cleanup pass: when symptom maps
        // to the suggestions fallback, whyThisFits is suppressed to avoid
        // rendering the same text twice (also appears in diagnosisActions).
        const whyHasContent = !!advisory.whyThisFits && advisory.whyThisFits.length >= 1;
        const actionsHaveContent = !!advisory.diagnosisActions && advisory.diagnosisActions.length >= 1;
        expect(whyHasContent || actionsHaveContent).toBe(true);

        // Must have a follow-up question (targeted, not generic)
        expect(advisory.followUp).toBeTruthy();

        console.log(`\n=== "${text}" ===`);
        console.log('Rule:', result.fired_rules[0].id);
        console.log('Explanation:', advisory.tendencies?.slice(0, 150));
        console.log('Suggestions:', advisory.whyThisFits);
        console.log('Follow-up:', advisory.followUp);
      });

      it('getClarificationQuestion behavior is documented', () => {
        const clarification = getClarificationQuestion(signals, result, 1, text, text);
        if (clarification) {
          console.log(`  [OLD BEHAVIOR] Would have shown: "${clarification.question.slice(0, 100)}..."`);
          // Clarification layer fires — this proves the skipDiagClarification guard is needed
          expect(clarification.question.length).toBeGreaterThan(10);
        } else {
          console.log(`  [OK] Clarification layer did not fire for this input.`);
        }
      });
    });
  }
});
