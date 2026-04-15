/**
 * Chain-order ambiguity suppression test.
 *
 * Verifies that comma-separated component lists with explicit role labels
 * (e.g. "DAC", "speakers") bypass chain-order-ambiguity validation,
 * since the canonical signal path is inferrable from the roles alone.
 */
import { detectIntent } from '../intent';
import { buildSystemAssessment } from '../consultation';

test('comma-separated list with role labels produces assessment (not clarification)', () => {
  const msg = 'I have a Chord Qutest DAC, Hegel H190, and DeVore O/96 speakers. Should I upgrade anything?';
  const intent = detectIntent(msg);
  const result = buildSystemAssessment(msg, intent.subjectMatches, null, intent.desires);
  expect(result).not.toBeNull();
  expect(result!.kind).toBe('assessment');
});
