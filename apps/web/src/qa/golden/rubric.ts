/**
 * Golden System Conversations — semantic evaluation rubric.
 *
 * Single-conversation judging against behavioral qualities, with the
 * accepted M1 transcript available as an EXEMPLAR of good behavior — never
 * as the expected answer. Different wording, a different defensible
 * recommendation, or a different clarifying question is NOT regression.
 *
 * Verdicts are enums with mandatory quoted evidence (the Phase-0 judge
 * discipline). There is deliberately no aggregate numeric score.
 */

export const RUBRIC_AXES = [
  'SYSTEM_UNDERSTANDING',
  'RELATIONSHIP_REASONING',
  'CAUSAL_DEPTH',
  'PRIORITIZATION',
  'DECISION_VALUE',
  'LISTENER_ALIGNMENT',
  'RESTRAINT',
  'CONTINUITY',
  'SPECIFICITY',
  'NATURALNESS',
] as const;

export type RubricAxis = (typeof RUBRIC_AXES)[number];

export interface AxisJudgment {
  axis: RubricAxis;
  verdict: 'PASS' | 'WEAK' | 'FAIL';
  evidence: string;
  reason: string;
}

export interface ConversationJudgment {
  axes: AxisJudgment[];
  /** Final stance of the conversation, for the §8 restraint distribution. */
  stance: 'CHANGE' | 'AUDITION' | 'EXPERIMENT' | 'LEAVE_ALONE' | 'UNCLEAR';
  /** §6: how the listener observations entered the reasoning. */
  observationUse: 'INCORPORATED' | 'REPEATED' | 'IGNORED';
  /** §7: did the adviser track actual vs hypothetical configuration? */
  hypotheticalTracking: 'CLEAR' | 'CONFUSED' | 'NOT_EXERCISED';
  overallReason: string;
}

export function rubricPrompt(opts: {
  archetypeTitle: string;
  stresses: string[];
  watchFor: string[];
  exemplar: string | null;
  conversation: string;
}): string {
  const exemplarBlock = opts.exemplar
    ? `\n=== HISTORICAL EXEMPLAR (accepted earlier conversation on this same system — an EXAMPLE of good behavior, NOT the expected answer; judge the new conversation on its own merits) ===\n${opts.exemplar}\n`
    : '';
  return `You are evaluating ONE complete hi-fi advisory conversation against a behavioral rubric. Judge only what is written. Do NOT reward verbosity, citations, or recitation of component data. A different recommendation than any exemplar is fine when it is well-supported; wording differences are never defects.

This system archetype exists to stress: ${opts.stresses.join('; ')}.
Known failure patterns to watch for: ${opts.watchFor.join('; ')}.

For each axis return {"axis","verdict":"PASS"|"WEAK"|"FAIL","evidence","reason"} — evidence must QUOTE the decisive passage(s); never invent quotes.

- SYSTEM_UNDERSTANDING: grasps the actual system and what each part is doing in it.
- RELATIONSHIP_REASONING: reasons about how components act on one another (interfaces, power, routing), not components in isolation.
- CAUSAL_DEPTH: explains WHY, reconstructible as facts → causes → conclusions.
- PRIORITIZATION: ranks what matters with reasons; no undifferentiated category lists.
- DECISION_VALUE: the listener can act — including confidently not acting.
- LISTENER_ALIGNMENT: the listener's stated context and observations shape the reasoning (a safe answer that ignores them fails this).
- RESTRAINT: can say no change is needed without becoming useless; never manufactures a weakness.
- CONTINUITY: later turns build on earlier ones; no resets or contradictions of its own established reasoning.
- SPECIFICITY: when candidates are requested, they answer "why THIS component in THIS system for THIS listener" — not a generic best-of list, no invented exact specifications.
- NATURALNESS: reads as an intelligent adviser, not an evidence audit or shopping assistant.

Also classify:
- "stance": the conversation's final position — "CHANGE" (buy/replace now), "AUDITION" (go listen before deciding), "EXPERIMENT" (free/reversible trial first), "LEAVE_ALONE", or "UNCLEAR".
- "observationUse": "INCORPORATED" (listener-stated facts causally shaped the advice — including a reasoned explanation of why they do NOT change it), "REPEATED" (acknowledged but did no work), "IGNORED".
- "hypotheticalTracking": "CLEAR" (always knew whether the actual or a hypothetical configuration was under discussion, and returned cleanly to the actual system), "CONFUSED", or "NOT_EXERCISED".

Output STRICT JSON:
{"axes":[...10 objects...],"stance":...,"observationUse":...,"hypotheticalTracking":...,"overallReason":...}
No commentary.
${exemplarBlock}
=== CONVERSATION UNDER EVALUATION (${opts.archetypeTitle}) ===
${opts.conversation}`;
}

/**
 * §6 observation-pair judging: same system, same final question, one run
 * with and one without a material listener observation. The invariant is
 * that the observation MATERIALLY ENTERS THE REASONING — not that the
 * recommendation changes.
 */
export function observationPairPrompt(opts: {
  observation: string;
  baselineAnswer: string;
  transformedAnswer: string;
}): string {
  return `Two answers to the same hi-fi question about the same system. Answer B's listener additionally said: "${opts.observation}". Answer A's listener said nothing about how they listen.

Judge ONLY how the stated listening context entered answer B's reasoning. The recommendation is allowed to stay the same — but then B must explain why the context does not change it.

Return STRICT JSON {"use":"INCORPORATED"|"REPEATED"|"IGNORED","evidence","reason"}:
- INCORPORATED: the context causally shaped B's advice or its explicit justification.
- REPEATED: B mentions the context but it does no reasoning work.
- IGNORED: B's advice is indistinguishable from context-free advice, with no engagement.
Evidence must QUOTE from answer B. No commentary.

=== ANSWER A (no context) ===
${opts.baselineAnswer}

=== ANSWER B (context stated) ===
${opts.transformedAnswer}`;
}
