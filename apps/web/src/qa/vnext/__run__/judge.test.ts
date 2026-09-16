/**
 * vNext Phase 0 — judging pass. Runs ONLY with QA_VNEXT_JUDGE=1.
 *
 *   QA_VNEXT_JUDGE=1 OPENAI_API_KEY=… npx vitest run apps/web/src/qa/vnext/__run__/judge.test.ts
 *
 * For every (model, system, rep) pair with both arms recorded:
 *   - blind pairwise experience judgment (X/Y randomized, mapping recorded);
 *   - symmetric trust audit: the SAME claim checker over arm A's text, arm
 *     B's raw draft, and arm B's validated text, against the same frozen
 *     evidence package (validator-effect isolation);
 *   - deterministic stray-figure counts.
 * Arm C captures (results/c-capture) receive the same trust audit.
 *
 * Env: QA_VNEXT_RUNS (csv of run dirs, default "main,gpt4o,repeats"),
 *      QA_VNEXT_JUDGE_MODEL (default "gpt-6-astra").
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync, appendFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { seedFrozenEvidence, EXPERIMENT_SYSTEMS } from '../frozen-evidence';
import { CONVERSATIONS } from '../conversations';
import { assembleGovernedContext } from '@/lib/reasoning/context-assembly';
import { serializeGovernedContext } from '@/lib/reasoning/governed-context';
import { pairwiseJudge, trustAudit, strayFigures, formatConversation } from '../judge';

const RUN = process.env.QA_VNEXT_JUDGE === '1';
const RUNS = (process.env.QA_VNEXT_RUNS ?? 'main,gpt4o,repeats').split(',').map((s) => s.trim());
const JUDGE_MODEL = process.env.QA_VNEXT_JUDGE_MODEL ?? 'gpt-6-astra';
const RESULTS = join(__dirname, '..', 'results');

interface Turn { turnIndex: number; question: string; text: string; rawDraft?: string; validation?: { status: string } }

function loadTurns(file: string): Turn[] {
  return readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}

async function frozenAuditBlock(systemId: string): Promise<string> {
  const sys = EXPERIMENT_SYSTEMS.find((s) => s.id === systemId)!;
  const script = CONVERSATIONS[systemId];
  const ctx = await assembleGovernedContext({
    activeSystem: { components: sys.components, source: 'stated' },
    currentHypothetical: null,
    question: script[script.length - 1].user,
    recentTurns: script.slice(0, -1).map((t) => ({ role: 'user' as const, content: t.user })),
    userObservations: script.filter((t) => t.observation).map((t) => t.user),
  });
  return serializeGovernedContext(ctx);
}

describe.runIf(RUN)('vNext Phase 0 judging', () => {
  const apiKey = process.env.OPENAI_API_KEY ?? '';
  const outJudg = join(RESULTS, 'judgments.jsonl');
  const outTrust = join(RESULTS, 'trust.jsonl');

  it('preconditions', async () => {
    expect(apiKey.length).toBeGreaterThan(10);
    await seedFrozenEvidence();
    rmSync(outJudg, { force: true });
    rmSync(outTrust, { force: true });
  });

  const pairs: Array<{ run: string; model: string; system: string; rep: string }> = [];
  for (const run of RUNS) {
    const dir = join(RESULTS, run);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      const m = /^(.+)__(.+)__A__(r\d+)\.jsonl$/.exec(f);
      if (!m) continue;
      if (existsSync(join(dir, `${m[1]}__${m[2]}__B__${m[3]}.jsonl`))) {
        pairs.push({ run, model: m[1], system: m[2], rep: m[3] });
      }
    }
  }

  for (const p of pairs) {
    it.concurrent(`judge ${p.run}/${p.model}/${p.system}/${p.rep}`, async () => {
      await seedFrozenEvidence();
      const dir = join(RESULTS, p.run);
      const a = loadTurns(join(dir, `${p.model}__${p.system}__A__${p.rep}.jsonl`));
      const b = loadTurns(join(dir, `${p.model}__${p.system}__B__${p.rep}.jsonl`));
      const convA = formatConversation(a);
      const convB = formatConversation(b);
      // Deterministic position randomization, recorded.
      const aIsX = (p.system.length + p.model.length + Number(p.rep.slice(1))) % 2 === 0;
      const res = await pairwiseJudge(apiKey, JUDGE_MODEL,
        aIsX ? convA : convB, aIsX ? convB : convA);
      appendFileSync(outJudg, `${JSON.stringify({ ...p, judgeModel: JUDGE_MODEL, aIsX, res })}\n`);
      expect('skipped' in res, JSON.stringify(res).slice(0, 200)).toBe(false);

      // Trust audits against the same frozen package.
      const block = await frozenAuditBlock(p.system);
      const convText = a.map((t) => t.question).join('\n');
      for (const [version, text] of [
        ['A', a.map((t) => t.text).join('\n\n')],
        ['B-raw', b.map((t) => t.rawDraft ?? t.text).join('\n\n')],
        ['B-validated', b.map((t) => t.text).join('\n\n')],
      ] as const) {
        const audit = await trustAudit(apiKey, text, block, convText);
        const stray = strayFigures(text, [block, convText]);
        appendFileSync(outTrust, `${JSON.stringify({ ...p, version, ...audit, strayCount: stray.length, stray: stray.slice(0, 12) })}\n`);
      }
    }, 1800000);
  }

  it.concurrent('trust-audit arm C captures', async () => {
    await seedFrozenEvidence();
    const dir = join(RESULTS, 'c-capture');
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.jsonl'))) {
      const system = f.replace(/\.jsonl$/, '');
      const turns = loadTurns(join(dir, f));
      const block = await frozenAuditBlock(system);
      const convText = turns.map((t) => t.question).join('\n');
      const text = turns.map((t) => t.text).join('\n\n');
      const audit = await trustAudit(apiKey, text, block, convText);
      const stray = strayFigures(text, [block, convText]);
      appendFileSync(outTrust, `${JSON.stringify({ run: 'c-capture', model: 'production-1498b17', system, rep: 'r0', version: 'C', ...audit, strayCount: stray.length, stray: stray.slice(0, 12) })}\n`);
    }
  }, 1800000);
});

describe.runIf(!RUN)('vNext Phase 0 judging (gated off)', () => {
  it('set QA_VNEXT_JUDGE=1 to run', () => { expect(true).toBe(true); });
});
