/**
 * M1 model selection — blind pairwise experience judging of FINAL accepted
 * answers (post-publication-boundary), gpt-4o vs gpt-6-astra, model
 * identity hidden and positions randomized.
 *
 *   QA_VNEXT_MJUDGE=1 OPENAI_API_KEY=… npx vitest run \
 *     apps/web/src/qa/vnext/__run__/model-judge.test.ts
 *
 * Axes are the §7 product-evaluation dimensions. Verbosity, citations and
 * dossier recitation are explicitly not rewarded. Judge model defaults to
 * gpt-6-astra (the Phase-0/0.1 pairwise judge); the self-judging caveat is
 * disclosed in the report and mitigated by blinding + position
 * randomization.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, appendFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { formatConversation } from '../judge';

const RUN = process.env.QA_VNEXT_MJUDGE === '1';
const RUN_ID = process.env.QA_VNEXT_MSEL_RUN ?? 'msel';
const JUDGE_MODEL = process.env.QA_VNEXT_MJUDGE_MODEL ?? 'gpt-6-astra';
const DIR = join(__dirname, '..', 'results', RUN_ID);
const OUT = join(__dirname, '..', 'results', `judgments-${RUN_ID}.jsonl`);
const MODELS = ['gpt-4o', 'gpt-6-astra'];

const AXES = [
  'SYSTEM_UNDERSTANDING',
  'CAUSAL_REASONING',
  'DECISION_VALUE',
  'PRIORITIZATION',
  'COMPARATIVE_REASONING',
  'LISTENER_ALIGNMENT',
  'RESTRAINT',
  'NATURALNESS',
  'NEXT_QUESTION_QUALITY',
  'CONCRETE_RECOMMENDATION_QUALITY',
] as const;

const PROMPT = `You are blind-judging two complete hi-fi advisory conversations (X and Y) about the SAME system, answering the SAME listener turns. You do not know how either was produced. Judge only what is written. The core question: which is the adviser this listener would want to keep talking to?

Do NOT reward verbosity, citation counts, or recitation of component data. A safe-failure turn ("ask me that once more") is an honest miss — judge how much it costs the conversation.

For each axis return {"axis","verdict":"X"|"Y"|"TIE","evidence","reason"} — evidence must QUOTE the decisive passage(s); never invent quotes.

- SYSTEM_UNDERSTANDING: grasps the actual system and how its parts relate.
- CAUSAL_REASONING: explains WHY something matters, not just what components are.
- DECISION_VALUE: the listener comes away able to act (including confidently not acting).
- PRIORITIZATION: "most bang for the buck" gets an actual priority with reasons, not an undifferentiated category list.
- COMPARATIVE_REASONING: distinguishes among existing components and proposed alternatives.
- LISTENER_ALIGNMENT: uses the listener's stated goals (intimacy, connection, "more of the same") rather than generic audiophile criteria.
- RESTRAINT: can say a change is unnecessary or evidence is insufficient without becoming useless.
- NATURALNESS: reads as an intelligent adviser, not an evidence audit, database, or shopping assistant.
- NEXT_QUESTION_QUALITY: when a question is genuinely needed, it is the highest-information one.
- CONCRETE_RECOMMENDATION_QUALITY: when components are explicitly requested, gives useful named candidates with honest reasons to consider them.

Then {"overall":"X"|"Y"|"TIE","overallReason":...}.
Output STRICT JSON: {"axes":[...10 objects...],"overall":...,"overallReason":...}. No commentary.`;

interface Turn { turnIndex: number; question: string; text: string }

function loadConv(model: string, system: string, rep: number): Turn[] | null {
  const f = join(DIR, `${model}__${system}__B2__r${rep}.jsonl`);
  if (!existsSync(f)) return null;
  return readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

describe.runIf(RUN)('M1 model selection — blind pairwise', () => {
  const apiKey = process.env.OPENAI_API_KEY ?? '';
  const pairs: Array<{ system: string; rep: number }> = [];
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.jsonl'))) {
    const m = /^gpt-4o__(.+)__B2__r(\d+)\.jsonl$/.exec(f);
    if (!m) continue;
    if (existsSync(join(DIR, `gpt-6-astra__${m[1]}__B2__r${m[2]}.jsonl`))) {
      pairs.push({ system: m[1], rep: Number(m[2]) });
    }
  }

  it('preconditions', () => {
    expect(apiKey.length).toBeGreaterThan(10);
    expect(pairs.length).toBeGreaterThan(0);
    rmSync(OUT, { force: true });
  });

  for (const { system, rep } of pairs) {
    it.concurrent(`judge ${system} r${rep}`, async () => {
      const a = loadConv(MODELS[0], system, rep)!;
      const b = loadConv(MODELS[1], system, rep)!;
      const aIsX = Math.random() < 0.5;
      const convX = formatConversation(aIsX ? a : b);
      const convY = formatConversation(aIsX ? b : a);
      let res: unknown = { skipped: 'unknown' };
      try {
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: JUDGE_MODEL,
            max_completion_tokens: 6000,
            messages: [{
              role: 'user',
              content: `${PROMPT}\n\n=== CONVERSATION X ===\n${convX}\n\n=== CONVERSATION Y ===\n${convY}`,
            }],
          }),
        });
        if (!r.ok) res = { skipped: `judge http ${r.status}` };
        else {
          const j = await r.json() as { choices?: Array<{ message?: { content?: string } }> };
          const raw = (j.choices?.[0]?.message?.content ?? '').replace(/^```(?:json)?\s*|\s*```$/g, '');
          const parsed = JSON.parse(raw) as { axes?: unknown[]; overall?: string };
          res = Array.isArray(parsed.axes) && parsed.overall ? parsed : { skipped: 'judge shape' };
        }
      } catch (e) {
        res = { skipped: String(e).slice(0, 150) };
      }
      appendFileSync(OUT, `${JSON.stringify({
        system, rep, judgeModel: JUDGE_MODEL, aModel: MODELS[0], bModel: MODELS[1], aIsX, axes: AXES, res,
      })}\n`);
      expect(true).toBe(true);
    }, 600000);
  }
});

describe.runIf(!RUN)('M1 model judge (gated off)', () => {
  it('set QA_VNEXT_MJUDGE=1 to run', () => { expect(true).toBe(true); });
});
