import { extractSubjectMatches } from '../intent';
import { buildSystemDiagnosis } from '../consultation';
import { analysisToAdvisory } from '../advisory-response';
import type { EvaluationResult, ExtractedSignals } from '../rule-types';
import type { SystemDirection } from '../system-direction';

test('Inspect Wilson+Soulution diagnosis output', () => {
  const input = 'i have wilson speakers and a soulution amp. the sound is great but can be a little dry';
  const subjects = extractSubjectMatches(input);
  const result = buildSystemDiagnosis(input, subjects);

  console.log('=== SUBJECT ===');
  console.log(result?.subject);
  console.log('\n=== BODY ===');
  console.log(result?.comparisonSummary);
  console.log('\n=== FOLLOW-UP ===');
  console.log(result?.followUp);
  console.log('\n=== BODY LENGTH ===');
  console.log(result?.comparisonSummary?.length, 'chars');

  expect(result).not.toBeNull();
});

test('Enriched diagnosis: bright+fatiguing with system context', () => {
  // Simulate engine output for a brightness/fatigue diagnosis
  const signals: ExtractedSignals = {
    traits: { fatigue_risk: 'up' as const, glare_risk: 'up' as const },
    symptoms: ['brightness_harshness', 'fatigue'],
    direction: [],
    preserve: [],
    context: [],
    matched_phrases: ['sounds bright', 'fatiguing'],
    archetype_hints: [],
    uncertainty_level: 0,
  };

  const result: EvaluationResult = {
    fired_rules: [{
      id: 'fatigue-brightness',
      label: 'Listener fatigue / brightness — source or DAC investigation',
      priority: 10,
      outputs: {
        explanation: 'Your description points toward brightness or listening fatigue. This is often upstream — the source or DAC may be contributing edge or glare.',
        suggestions: [
          'Investigate the source component (DAC or streamer) as a likely contributor.',
          'If using a revealing cable, consider whether it is exposing upstream brightness.',
        ],
        risks: [
          'Swapping speakers to fix brightness often trades away other strengths.',
          'Adding a "warm" component to compensate may mask detail.',
        ],
        next_step: 'Try a different source temporarily to see if the fatigue changes.',
      },
    }],
    archetype_conflict_detected: false,
    uncertainty_level: 0,
  };

  const sysDir: SystemDirection = {
    currentTendencies: ['bright_lean' as any],
    desiredDirections: [],
    tendencySummary: 'The system leans bright and forward.',
    directionSummary: null,
  };

  const advisory = analysisToAdvisory(result, signals, sysDir, undefined, {
    systemComponents: ['Chord Qutest', 'Naim Supernait 3', 'Focal Kanta No.2'],
    systemTendencies: 'detailed, resolving, precise',
  });

  console.log('\n=== ENRICHED DIAGNOSIS: bright+fatiguing ===');
  console.log('Subject:', advisory.subject);
  console.log('Interpretation:', advisory.diagnosisInterpretation);
  console.log('Explanation:', advisory.diagnosisExplanation);
  console.log('Actions:', advisory.diagnosisActions?.map((a) => `[${a.area}] ${a.guidance.slice(0, 80)}...`));
  console.log('Follow-up:', advisory.followUp);

  // Must have all enriched layers
  expect(advisory.diagnosisInterpretation).toBeTruthy();
  expect(advisory.diagnosisInterpretation).toMatch(/Chord Qutest.*Naim/);
  expect(advisory.diagnosisExplanation).toBeTruthy();
  expect(advisory.diagnosisExplanation).toMatch(/resolving|transparent|upstream/i);
  expect(advisory.diagnosisActions).toBeTruthy();
  expect(advisory.diagnosisActions!.length).toBeGreaterThanOrEqual(3);
  expect(advisory.diagnosisActions![0].area).toBe('Source / DAC');
  expect(advisory.diagnosisActions![0].examples).toBeTruthy();
  expect(advisory.followUp).toBeTruthy();
  expect(advisory.followUp).not.toMatch(/useful starting point/i);
});

test('Enriched diagnosis: thinness without system context', () => {
  const signals: ExtractedSignals = {
    traits: { tonal_density: 'down' as const },
    symptoms: ['thinness'],
    direction: [],
    preserve: [],
    context: [],
    matched_phrases: ['sounds thin'],
    archetype_hints: [],
    uncertainty_level: 0,
  };

  const result: EvaluationResult = {
    fired_rules: [{
      id: 'thinness-bass-deficit',
      label: 'Thinness / bass deficit — placement before purchase',
      priority: 20,
      outputs: {
        explanation: 'Your system sounds thin or lacking body.',
        suggestions: [
          'Move speakers closer to the rear wall.',
          'Experiment with toe-in angle and listening position.',
        ],
        risks: [
          'Excessive wall proximity can cause bass bloom.',
          'Adding a "warm" component to fix thinness may mask other qualities.',
        ],
        next_step: 'Try moving speakers 6 inches closer to the rear wall.',
      },
    }],
    archetype_conflict_detected: false,
    uncertainty_level: 0,
  };

  const advisory = analysisToAdvisory(result, signals, undefined);

  console.log('\n=== ENRICHED DIAGNOSIS: thin (no system) ===');
  console.log('Subject:', advisory.subject);
  console.log('Interpretation:', advisory.diagnosisInterpretation ?? '(none)');
  console.log('Explanation:', advisory.diagnosisExplanation);
  console.log('Actions:', advisory.diagnosisActions?.map((a) => `[${a.area}] ${a.guidance.slice(0, 80)}...`));
  console.log('Follow-up:', advisory.followUp);

  // Explanation still present without system context
  expect(advisory.diagnosisExplanation).toBeTruthy();
  expect(advisory.diagnosisExplanation).toMatch(/room|placement|wall/i);
  // Actions present with product examples
  expect(advisory.diagnosisActions).toBeTruthy();
  expect(advisory.diagnosisActions!.length).toBeGreaterThanOrEqual(3);
  expect(advisory.diagnosisActions!.some((a) => a.examples)).toBe(true);
  // Follow-up asks about room
  expect(advisory.followUp).toMatch(/room|wall|floor|speaker/i);
});
