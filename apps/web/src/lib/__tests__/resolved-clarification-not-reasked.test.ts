import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';
import { buildSystemAssessment } from '../consultation';

/**
 * D1 (production hardening, 2026-08-11) — a clarification must not be
 * asked when its answer is already present in the message text.
 *
 * Live production repro (audio-xx.com, promoted ef2b7a4; identical on the
 * pre-release build — pre-existing, not a release regression):
 *   T1: "assess my system: streamer/DAC: Eversolo DMP-A6 (internal DAC)
 *        Amplifier: Job Integrated Speakers: WLM Diva Monitor"
 *       → role clarification: "You described the DMP-A6 as a DAC, but our
 *          data has it cataloged as a streamer. Internal DAC or external?"
 *   T2: "internal DAC" → reunited, assessment renders (re-ask suppressed
 *       only by the same-turn consumedClarification cap).
 *   T3: "What would you upgrade first?" → the direction follow-up re-runs
 *       the build over the ACCUMULATED text and the SAME clarification
 *       fires again — re-asking a fact the user answered one turn earlier,
 *       on a turn that isn't a system description.
 *
 * Root cause: validateSystemComponents raised role-conflict questions
 * without checking whether the raw text already contains their answer.
 * The resolution phrase ("internal DAC") is IN the accumulated exchange —
 * the D-8 sufficiency rule: never ask what the available text answers.
 *
 * Encoded rule: a role-conflict clarification is licensed only when the
 * message does not already resolve the conflict.
 */

const T1 = 'assess my system: streamer/DAC: Eversolo DMP-A6 (internal DAC) Amplifier: Job Integrated Speakers: WLM Diva Monitor';
const ACCUMULATED = `${T1}\ninternal DAC. ${T1}`;

function build(text: string) {
  const { subjectMatches, desires } = detectIntent(text);
  return buildSystemAssessment(text, subjectMatches, null, desires) as { kind?: string } | null;
}

describe('resolved clarifications are not re-asked', () => {
  it('inline "(internal DAC)" annotation resolves the streamer-as-DAC conflict', () => {
    const r = build(T1);
    expect(r?.kind).not.toBe('clarification');
  });

  it('accumulated exchange containing the answer does not re-raise the ask', () => {
    const r = build(ACCUMULATED);
    expect(r?.kind).not.toBe('clarification');
  });

  it('control: the unresolved form still asks', () => {
    // No internal/external answer anywhere — the clarification is licensed.
    const r = build('assess my system: DAC: Eversolo DMP-A6 Amplifier: Job Integrated Speakers: WLM Diva Monitor');
    expect(r?.kind).toBe('clarification');
  });

  it('"feeding an external DAC" also counts as an answer', () => {
    const r = build('assess my system: DAC: Eversolo DMP-A6 feeding an external DAC Amplifier: Job Integrated Speakers: WLM Diva Monitor');
    expect(r?.kind).not.toBe('clarification');
  });
});
