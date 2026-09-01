import { describe, it, expect } from 'vitest';
import { detectChurnSignal } from '../churn-avoidance';

/**
 * Control pin for the A2 repair.
 *
 * "my system is fine but i have upgrade itch" is the one prompt in this family
 * that answers well on production:
 *
 *   "That's worth thinking through. What specifically prompted this
 *    consideration? If there's a particular quality you're missing or a
 *    frustration with the current sound, that helps point toward whether a
 *    change would actually improve things — or just shift the balance."
 *
 * That response does NOT come from clarification.ts. `page.tsx` (~4657) runs
 * `detectChurnSignal` on turn 1 and returns early when it fires, so
 * `getClarificationQuestion` — and therefore `checkDiagnosticUncertainty`,
 * the function A2 modifies — is never reached.
 *
 * This test pins the separation itself: the control must keep firing churn
 * avoidance, and the four defective prompts must keep NOT firing it, because
 * that is precisely what routes them into the function being changed. If a
 * future edit moves any prompt across this boundary, the A2 repair silently
 * changes scope, and this test is what catches it.
 */

const CONTROL = 'my system is fine but i have upgrade itch';

// Only these three actually reach checkDiagnosticUncertainty. Establishing
// that was the point of pinning first — see the block at the bottom for
// "should i upgrade my dac", which turned out not to belong with them.
const A2_PROMPTS = [
  'is my system balanced',
  'weakest link in my setup?',
  'does anything need changing in my setup',
];

describe('churn avoidance protects the good control', () => {
  it('fires for the upgrade-itch control and supplies its question', () => {
    const churn = detectChurnSignal(CONTROL);
    expect(churn.detected, 'the control must keep taking the churn path').toBe(true);
    expect(churn.reflectiveQuestion, 'the early return requires a question').toBeTruthy();
  });

  it('asks what prompted the consideration, not about a symptom', () => {
    // The control is good precisely because it does not presume a problem.
    const q = detectChurnSignal(CONTROL).reflectiveQuestion ?? '';
    expect(q).toMatch(/prompted this consideration/i);
  });
});

describe('the A2 prompts are outside the churn path', () => {
  for (const p of A2_PROMPTS) {
    it(`"${p}" does not take the churn early-return`, () => {
      // If one of these started firing churn avoidance it would bypass the
      // A2 fix entirely — a silent scope change in either direction.
      expect(detectChurnSignal(p).detected).toBe(false);
    });
  }
});

/**
 * "should i upgrade my dac" does not belong with the other three.
 *
 * It satisfies churn avoidance identically to the control — detected, with
 * the same reflective question — but it routes differently: the control's
 * "my system …" phrasing makes routeConversation return 'diagnosis', which
 * folds its intent into the diagnosis path and reaches the churn early-return
 * there. "should i upgrade my dac" routes as 'inquiry', stays
 * audio_knowledge, and enters the knowledge lane (page.tsx Lane 2) — which
 * historically consumed the turn before any churn check ran, letting the
 * knowledge LLM invent "the issue" the user never reported.
 *
 * Repaired 2026-08-10: the knowledge-lane entry now runs the same first-turn
 * churn gate as the diagnosis path, so this prompt gets the reflective
 * question. This block pins that the signal itself stays available to it.
 */
describe('should i upgrade my dac — churn signal available but not applied', () => {
  it('has a churn signal identical in kind to the control', () => {
    const churn = detectChurnSignal('should i upgrade my dac');
    expect(churn.detected).toBe(true);
    expect(churn.reflectiveQuestion).toBeTruthy();
    // Same reflective question as the control, so the good response is
    // available to this prompt — it simply is not the one users receive.
    expect(churn.reflectiveQuestion).toBe(
      detectChurnSignal(CONTROL).reflectiveQuestion,
    );
  });
});
