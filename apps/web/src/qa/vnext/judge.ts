/**
 * vNext Phase 0 — evaluation instruments.
 *
 * EXPERIENCE: blind pairwise judging of two whole conversations for the same
 * system (positions randomized by the caller; the judge never knows which
 * arm is which). Small enums with mandatory quoted evidence — no 1-10
 * scores.
 *
 * TRUST: symmetric instrument — the SAME evidence-licensing checker
 * (claim-validation's contract) audits every arm's answers against the same
 * frozen evidence package, so arm A is measured with exactly the rules arm
 * B lives under. Deterministic stray-figure counting backs it.
 */
import { validateClaims } from '@/lib/reasoning/claim-validation';

export const EXPERIENCE_AXES = [
  'SYSTEM_UNDERSTANDING',
  'RELATIONSHIP_REASONING',
  'DECISION_VALUE',
  'BOUNDED_UNCERTAINTY',
  'COUNTERFACTUAL_QUALITY',
  'CONTINUITY_REFERENTS',
  'RESTRAINT',
  'NEXT_QUESTION_QUALITY',
  'NATURALNESS',
] as const;

export interface PairwiseAxisVerdict {
  axis: string;
  verdict: 'X' | 'Y' | 'TIE';
  evidence?: string;
  reason?: string;
}

export interface PairwiseResult {
  axes: PairwiseAxisVerdict[];
  overall: 'X' | 'Y' | 'TIE';
  overallReason?: string;
}

const JUDGE_PROMPT = `You are blind-judging two complete advisory conversations (X and Y) about the SAME hi-fi system, answering the SAME listener turns. You do not know how either was produced. Judge only what is written.

For each axis below return {"axis", "verdict": "X"|"Y"|"TIE", "evidence", "reason"} — evidence must QUOTE the decisive passage(s); never invent quotes. Judge DECISION_VALUE ignoring any component data listings: a beautiful dossier is not a good system assessment — what matters is whether the listener learns what to do, not do, test, or watch for.

Axes:
- SYSTEM_UNDERSTANDING: does it grasp what this system IS and how the parts relate?
- RELATIONSHIP_REASONING: are component-to-component relationships reasoned about, not just described?
- DECISION_VALUE: does the listener come away able to act (including confidently not acting)?
- BOUNDED_UNCERTAINTY: are unknowns handled with useful bounded reasoning rather than either invention or paralysis?
- COUNTERFACTUAL_QUALITY: are the substitution/hypothetical turns reasoned concretely and honestly?
- CONTINUITY_REFERENTS: do later answers correctly use earlier turns, referents ("the second one"), observations, and reverts?
- RESTRAINT: is "change nothing" genuinely available and used when warranted, without hedging everything?
- NEXT_QUESTION_QUALITY: when questions are asked, do they ask for what only this listener can supply?
- NATURALNESS: does it read as one adviser conversing, not assembled fragments?

Then return {"overall": "X"|"Y"|"TIE", "overallReason": ...} for which conversation better serves this listener overall.

Output STRICT JSON: {"axes":[...9 objects...], "overall":"X"|"Y"|"TIE", "overallReason": string}. No commentary.`;

export function formatConversation(turns: Array<{ question: string; text: string }>): string {
  return turns.map((t, i) =>
    `TURN ${i + 1}\nLISTENER: ${t.question}\nADVISER: ${t.text || '[no answer produced]'}`,
  ).join('\n\n');
}

export async function pairwiseJudge(
  apiKey: string,
  judgeModel: string,
  convX: string,
  convY: string,
): Promise<PairwiseResult | { skipped: string }> {
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: judgeModel,
        max_completion_tokens: 4096,
        messages: [{
          role: 'user',
          content: `${JUDGE_PROMPT}\n\n=== CONVERSATION X ===\n${convX}\n\n=== CONVERSATION Y ===\n${convY}`,
        }],
      }),
    });
    if (!r.ok) return { skipped: `judge ${r.status}` };
    const j = await r.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = (j.choices?.[0]?.message?.content ?? '').replace(/^```(?:json)?\s*|\s*```$/g, '');
    const parsed = JSON.parse(raw) as PairwiseResult;
    if (!Array.isArray(parsed.axes) || !parsed.overall) return { skipped: 'judge shape' };
    return parsed;
  } catch (e) {
    return { skipped: String(e).slice(0, 120) };
  }
}

/**
 * Symmetric trust audit: the claim-validation checker over one turn's
 * answer, against the frozen evidence package. Violation counts are the
 * metric; no repair is applied to the text.
 */
export async function trustAudit(
  apiKey: string,
  answer: string,
  frozenContextBlock: string,
  conversationText: string,
): Promise<{ violations: number; byType: Record<string, number>; unchecked: boolean }> {
  const v = await validateClaims({
    answer, contextBlock: frozenContextBlock, conversationText,
    apiKey, timeoutMs: 45000,
  });
  const byType: Record<string, number> = {};
  for (const x of v.violations) byType[x.type] = (byType[x.type] ?? 0) + 1;
  return { violations: v.violations.length, byType, unchecked: v.unchecked };
}

/** Deterministic stray-figure count: numbers in the answer with no source in
 *  the frozen evidence, the conversation, or plausible arithmetic bases. */
export function strayFigures(answer: string, allowedSources: string[]): string[] {
  const nums = (t: string) => new Set((t.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,.]+$/, '')));
  const allowed = new Set(allowedSources.flatMap((s) => [...nums(s)]));
  return [...nums(answer)].filter((n) => n.length > 1 && !allowed.has(n));
}
