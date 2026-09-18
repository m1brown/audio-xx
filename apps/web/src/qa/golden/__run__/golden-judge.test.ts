/**
 * Golden System Conversations — semantic judging (Tier C, after the runner).
 *
 *   QA_GOLDEN_JUDGE=1 OPENAI_API_KEY=… npx vitest run \
 *     apps/web/src/qa/golden/__run__/golden-judge.test.ts
 *
 * For each corpus conversation: one rubric judgment (10 PASS/WEAK/FAIL
 * axes with quoted evidence, stance, observation use, hypothetical
 * tracking), with the accepted M1 transcript for that system supplied as
 * an EXEMPLAR — never the expected answer. For each §6 observation pair:
 * one INCORPORATED/REPEATED/IGNORED judgment.
 *
 * Env knobs:
 *   QA_GOLDEN_RUN          run id to judge (default golden-<date>)
 *   QA_GOLDEN_JUDGE_MODEL  judge model (default gpt-6-astra; the
 *                          self-judging caveat is disclosed in reports and
 *                          mitigated by the enum+quoted-evidence discipline)
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, appendFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { formatConversation } from '../../vnext/judge';
import { GOLDEN_ARCHETYPES } from '../archetypes';
import { OBSERVATION_PAIRS } from '../scenarios';
import { rubricPrompt, observationPairPrompt } from '../rubric';

const RUN = process.env.QA_GOLDEN_JUDGE === '1';
const RUN_ID = process.env.QA_GOLDEN_RUN ?? `golden-${new Date().toISOString().slice(0, 10)}`;
const JUDGE_MODEL = process.env.QA_GOLDEN_JUDGE_MODEL ?? 'gpt-6-astra';
const DIR = join(__dirname, '..', 'results', RUN_ID);
const OUT = join(__dirname, '..', 'results', `judgments-${RUN_ID}.jsonl`);

const EXEMPLAR_SECTIONS: Record<string, string> = {
  'france-ii': 'SYSTEM A — FRANCE II',
  nathan: 'SYSTEM B — NATHAN',
  nad: 'SYSTEM C — NAD',
  accuphase: 'SYSTEM D — ACCUPHASE',
};

function exemplarFor(systemId: string): string | null {
  const path = join(__dirname, '..', 'historical', 'acceptance-transcripts.md');
  if (!existsSync(path)) return null;
  const md = readFileSync(path, 'utf8');
  const marker = `## ${EXEMPLAR_SECTIONS[systemId]}`;
  const start = md.indexOf(marker);
  if (start < 0) return null;
  const next = md.indexOf('\n## SYSTEM', start + marker.length);
  return md.slice(start, next < 0 ? undefined : next);
}

async function callJudge(apiKey: string, content: string): Promise<unknown> {
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: JUDGE_MODEL,
        max_completion_tokens: 6000,
        messages: [{ role: 'user', content }],
      }),
    });
    if (!r.ok) return { skipped: `judge http ${r.status}` };
    const j = await r.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = (j.choices?.[0]?.message?.content ?? '').replace(/^```(?:json)?\s*|\s*```$/g, '');
    return JSON.parse(raw);
  } catch (e) {
    return { skipped: String(e).slice(0, 150) };
  }
}

interface Row { turnIndex: number; question: string; text: string; leg?: string }

describe.runIf(RUN)('Golden corpus — semantic judging', () => {
  const apiKey = process.env.OPENAI_API_KEY ?? '';
  const convFiles = existsSync(DIR)
    ? readdirSync(DIR).filter((f) => /^[a-z-]+__r\d+\.jsonl$/.test(f))
    : [];

  it('preconditions', () => {
    expect(apiKey.length).toBeGreaterThan(10);
    expect(convFiles.length).toBeGreaterThan(0);
    rmSync(OUT, { force: true });
  });

  for (const f of convFiles) {
    const m = /^([a-z-]+)__r(\d+)\.jsonl$/.exec(f)!;
    const systemId = m[1];
    const rep = Number(m[2]);
    it.concurrent(`rubric · ${systemId} r${rep}`, async () => {
      const rows: Row[] = readFileSync(join(DIR, f), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
      const arch = GOLDEN_ARCHETYPES.find((a) => a.systemId === systemId)!;
      const res = await callJudge(apiKey, rubricPrompt({
        archetypeTitle: arch.title,
        stresses: arch.stresses,
        watchFor: arch.watchFor,
        exemplar: exemplarFor(systemId),
        conversation: formatConversation(rows),
      }));
      appendFileSync(OUT, `${JSON.stringify({ kind: 'rubric', systemId, rep, judgeModel: JUDGE_MODEL, res })}\n`);
      expect(true).toBe(true);
    }, 600000);
  }

  for (const pair of OBSERVATION_PAIRS) {
    it.concurrent(`obs-pair · ${pair.systemId}`, async () => {
      const f = join(DIR, `obs-pair__${pair.systemId}.jsonl`);
      if (!existsSync(f)) {
        appendFileSync(OUT, `${JSON.stringify({ kind: 'obs-pair', systemId: pair.systemId, res: { skipped: 'no pair file' } })}\n`);
        return;
      }
      const rows: Row[] = readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
      const baseAns = rows.filter((r) => r.leg === 'baseline').at(-1)?.text ?? '';
      const transAns = rows.filter((r) => r.leg === 'transformed').at(-1)?.text ?? '';
      const observation = pair.transformed.replace(/\s*What would you change first\?$/, '');
      const res = await callJudge(apiKey, observationPairPrompt({
        observation, baselineAnswer: baseAns, transformedAnswer: transAns,
      }));
      appendFileSync(OUT, `${JSON.stringify({ kind: 'obs-pair', systemId: pair.systemId, judgeModel: JUDGE_MODEL, res })}\n`);
      expect(true).toBe(true);
    }, 600000);
  }
});

describe.runIf(!RUN)('Golden corpus judge (gated off)', () => {
  it('set QA_GOLDEN_JUDGE=1 to run', () => { expect(true).toBe(true); });
});
