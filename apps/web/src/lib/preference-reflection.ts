/**
 * Preference reflection — short helper that produces an honest
 * response when the user asks meta-questions about their own
 * listening preferences ("help me understand my listening
 * preferences", "what do I actually value", "I don't know what
 * kind of sound I like").
 *
 * Behaviour:
 *   • If the accumulated ListenerProfile has meaningful confidence
 *     (> 0.2) and produces a non-empty summary, the response opens
 *     with a cautious read of the emerging profile and invites
 *     refinement — never claims certainty.
 *   • Otherwise, the response acknowledges that a single question
 *     isn't enough to form a profile and offers a small set of
 *     optional questions. Partial answers are explicitly fine.
 *
 * Non-goals: this module never fabricates a profile, never asks for
 * a system, never routes to shopping or diagnosis. It returns the
 * same `{ acknowledge, question }` shape used by the greeting /
 * educational dispatcher in page.tsx so the existing ADD_QUESTION
 * action can render it without new UI plumbing.
 *
 * Tied to the homepage intro:
 *   "Audio XX helps you understand your listening preferences,
 *    find gear that fits those tastes, and build systems that
 *    work together."
 * — this is the path that honours the first clause.
 */

import { renderProfileSummary, type ListenerProfile } from './listener-preferences';

export interface PreferenceReflectionResponse {
  acknowledge: string;
  question: string;
}

const PROFILE_CONFIDENCE_FLOOR = 0.2;

const REFLECTION_PROMPTS = [
  'What do you like most about your current system?',
  'What bothers you or causes listening fatigue?',
  'Do you lean toward warmth/body, clarity/separation, rhythm/flow, scale, or detail?',
  'What music do you listen to most?',
  'What change are you hoping for?',
];

function formatReflectionQuestionBlock(): string {
  return [
    'A few questions that usually surface taste quickly:',
    ...REFLECTION_PROMPTS.map((p) => `• ${p}`),
    '',
    'Any subset is fine — even one answer is enough to start.',
  ].join('\n');
}

/**
 * Build a preference-reflection response. The optional profile lets
 * mid-conversation calls cautiously summarize what's emerged so far;
 * cold-start callers pass `undefined` (or a default-confidence profile)
 * and get the question-led path.
 */
export function buildPreferenceReflection(
  profile?: ListenerProfile | null,
): PreferenceReflectionResponse {
  const summary = profile ? renderProfileSummary(profile) : '';
  const hasMeaningfulProfile =
    !!profile && profile.confidence > PROFILE_CONFIDENCE_FLOOR && summary.length > 0;

  if (hasMeaningfulProfile) {
    return {
      acknowledge:
        `Based on what you've said so far, ${summary} That's a tentative read — `
        + `it gets sharper the more you describe.`,
      question: formatReflectionQuestionBlock(),
    };
  }

  return {
    acknowledge:
      'Happy to help you reflect on your listening preferences. '
      + 'I don\'t form a profile from a single question — your preferences come '
      + 'through over the course of the conversation, and only as far as the '
      + 'evidence supports.',
    question: formatReflectionQuestionBlock(),
  };
}

/** Exposed for tests — the canonical question list. */
export const PREFERENCE_REFLECTION_QUESTIONS: ReadonlyArray<string> = REFLECTION_PROMPTS;
