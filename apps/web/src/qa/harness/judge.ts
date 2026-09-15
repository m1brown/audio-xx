/**
 * QA harness — TIER 3 soft judge. OBSERVATIONAL ONLY, never gates a release.
 *
 * A model judge is used only for qualities deterministic checks cannot
 * answer. Judgments are small enums; every negative answer must return the
 * exact offending sentence, a reason, and the expected semantic behavior.
 * No generic quality scores.
 *
 * QA-only module: mirrors the product's OpenAI call shape but is never
 * imported by runtime code.
 */

export interface SoftJudgment {
  question: string;
  verdict: string;
  evidence?: string;
  reason?: string;
  expected?: string;
}

export const JUDGE_QUESTIONS = [
  {
    id: 'SYSTEM_REASONING_PRESENT',
    verdicts: ['YES', 'NO'],
    ask: 'Does the assessment reason about the SYSTEM — at least one relationship '
      + 'between components — rather than only summarising each component? '
      + 'If NO, quote the closest it comes and say what a system-level sentence would add.',
  },
  {
    id: 'SYSTEM_DECISION_VALUE',
    verdicts: ['YES', 'PARTIAL', 'NO'],
    ask: 'Ignoring dossier facts, evidence-methodology and provenance language: does the '
      + 'remaining text give the listener at least one useful system-level judgment, '
      + 'elimination, constraint, meaningful unresolved question, counterfactual, or '
      + 'decision-changing next step? Quote the sentence(s) that carry it; if PARTIAL or '
      + 'NO, state what decision value is missing.',
  },
  {
    id: 'LISTENER_UNIQUE_NEXT_QUESTION',
    verdicts: ['YES', 'NO', 'NO_QUESTION'],
    ask: 'If the assessment asks the listener a question: does it ask for information '
      + 'only the listener can supply (distance, level, room, connections, goals) rather '
      + 'than specifications Audio XX could research itself? If NO, quote the question '
      + 'and name what Audio XX should have retrieved or already declared unavailable.',
  },
  {
    id: 'TOPOLOGY_CALIBRATED',
    verdicts: ['YES', 'NO', 'NOT_APPLICABLE'],
    ask: 'Where the text describes how components connect: is an inferred/likely path '
      + 'clearly presented as assumption ("most likely", "tell me if"), never as '
      + 'established fact the listener did not state? If NO, quote the overstated sentence.',
  },
  {
    id: 'CLAIM_CONTRADICTION',
    verdicts: ['YES', 'NO'],
    ask: 'Do any two claims about the SAME relationship contradict (adequate vs '
      + 'constrained power; no-obvious-mismatch vs the-match-is-the-problem; resolved vs '
      + 'unresolved; change-nothing vs replace-now)? If YES, quote both claims.',
  },
  {
    id: 'EXPLANATION_CONSISTENT',
    verdicts: ['YES', 'PARTIAL', 'NO'],
    ask: 'Does the explanatory prose claim only what the stated facts establish? Watch '
      + 'for: implying the amplifier maker publishes a rating at the speaker\'s exact '
      + 'load when none is stated; and collapsing acoustic demand (sensitivity) with '
      + 'electrical loading (impedance) as if they played the same role. If PARTIAL or '
      + 'NO, quote the overstating sentence and state the accurate version of the claim.',
  },
] as const;

export function buildJudgePrompt(assessmentText: string, caseNotes: string[]): string {
  const qs = JUDGE_QUESTIONS.map((q) =>
    `${q.id} (${q.verdicts.join(' | ')}): ${q.ask}`).join('\n\n');
  return [
    'You are auditing one audio-system assessment produced by an advisory product.',
    'Answer each question with its enum verdict. For every verdict that is not the',
    'best possible one, you MUST include "evidence" (exact quoted sentence(s) from',
    'the assessment), "reason", and "expected" (the semantically correct behavior).',
    'Never invent quotes. Never give numeric quality scores.',
    caseNotes.length ? `\nCase-specific observation notes:\n- ${caseNotes.join('\n- ')}` : '',
    `\nQuestions:\n\n${qs}`,
    '\nReturn STRICT JSON: an array of objects',
    '{ "question": string, "verdict": string, "evidence"?: string, "reason"?: string, "expected"?: string }.',
    '\n--- ASSESSMENT UNDER AUDIT ---\n',
    assessmentText,
  ].join('\n');
}

export async function judgeAssessment(
  assessmentText: string,
  caseNotes: string[] = [],
): Promise<{ judgments: SoftJudgment[]; modelCalls: number } | { skipped: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { skipped: 'OPENAI_API_KEY not set — soft judge skipped' };
  const model = process.env.QA_JUDGE_MODEL ?? 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: 0,
      messages: [{ role: 'user', content: buildJudgePrompt(assessmentText, caseNotes) }],
    }),
  });
  if (!response.ok) {
    return { skipped: `judge call failed: ${response.status} ${(await response.text()).slice(0, 120)}` };
  }
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content ?? '';
  const jsonText = raw.replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    const arr = JSON.parse(jsonText) as SoftJudgment[];
    return { judgments: arr, modelCalls: 1 };
  } catch {
    return { skipped: `judge returned unparseable output: ${raw.slice(0, 160)}` };
  }
}

export function formatSoftFinding(caseId: string, j: SoftJudgment): string {
  const lines = [`CASE ${caseId}`, `TIER soft`, `JUDGMENT ${j.question} = ${j.verdict}`];
  if (j.evidence) lines.push(`EVIDENCE ${j.evidence}`);
  if (j.reason) lines.push(`REASON ${j.reason}`);
  if (j.expected) lines.push(`EXPECTED ${j.expected}`);
  return lines.join('\n');
}
