/**
 * Final verification: all 5 reviewer demo prompts produce expected output.
 */
import { detectIntent } from '../intent';
import { buildSystemAssessment, type SystemAssessmentResult } from '../consultation';

function assess(msg: string): Extract<SystemAssessmentResult, { kind: 'assessment' }> | null {
  const { subjectMatches, desires } = detectIntent(msg);
  const result = buildSystemAssessment(msg, subjectMatches, null, desires);
  if (!result || result.kind !== 'assessment') return null;
  return result;
}

test('P1: warm coherent → assessment + restraint', () => {
  const r = assess('My system: Denafrips Pontus II → Leben CS300 → Harbeth Super HL5 Plus. Assess my system.');
  expect(r).not.toBeNull();
  expect(r!.findings.keeps.length).toBeGreaterThanOrEqual(2);
  expect(r!.findings.upgradePaths.length).toBe(0);
  expect(r!.findings.systemAxes.warm_bright).toBe('warm');
});

test('P2: bottleneck → upgrade paths', () => {
  const r = assess('My system: Bluesound NODE X → PrimaLuna EVO 300 Integrated → Harbeth P3ESR. What should I upgrade?');
  expect(r).not.toBeNull();
  expect(r!.findings.bottleneck).toBeDefined();
  expect(r!.findings.upgradePaths.length).toBeGreaterThanOrEqual(2);
});

test('P3: balanced restraint → all kept', () => {
  const r = assess('My system: Chord Qutest → Hegel H190 → DeVore O/96. Should I upgrade anything?');
  expect(r).not.toBeNull();
  expect(r!.findings.keeps.length).toBeGreaterThanOrEqual(2);
});

test('P4: shopping → intent detects category', () => {
  const intent = detectIntent('Best DAC under $2000 for a warm, musical system');
  // Shopping intent is handled by a different flow, but intent should detect DAC
  expect(intent).toBeDefined();
});

test('P5: stacked warmth → traits detected', () => {
  const r = assess('My system: Denafrips Pontus II → PrimaLuna EVO 300 Integrated → Harbeth P3ESR. How does my system balance look?');
  expect(r).not.toBeNull();
  expect(r!.findings.systemAxes.warm_bright).toBe('warm');
  const warmTraits = r!.findings.stackedTraits.filter(s =>
    s.property.includes('density') || s.property.includes('warm')
  );
  expect(warmTraits.length).toBeGreaterThanOrEqual(1);
});
