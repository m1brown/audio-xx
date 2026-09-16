/**
 * vNext Phase 0.1 — judging pass. Runs ONLY with QA_VNEXT_JUDGE01=1.
 *
 * Pairings per (model, system, rep) within the run dir given by
 * QA_VNEXT_P01_DIR (default "p01"): A vs B1, A vs B2, B1 vs B2 — positions
 * randomized and recorded. Trust: semantic audits for B1/B2 (raw and
 * validated) plus the deterministic layer for every version including A and
 * the frozen C captures. Checker variance quantified by duplicate audits on
 * three conversations.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync, appendFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { seedFrozenEvidence, EXPERIMENT_SYSTEMS } from '../frozen-evidence';
import { CONVERSATIONS } from '../conversations';
import { assembleGovernedContext } from '@/lib/reasoning/context-assembly';
import { serializeGovernedContext } from '@/lib/reasoning/governed-context';
import { pairwiseJudge, trustAudit, deterministicTrust, formatConversation } from '../judge';

const RUN = process.env.QA_VNEXT_JUDGE01 === '1';
/** Recompute only the deterministic layer (no model calls). */
const DET_ONLY = process.env.QA_VNEXT_DET_ONLY === '1';
const DIR_NAME = process.env.QA_VNEXT_P01_DIR ?? 'p01';
const JUDGE_MODEL = process.env.QA_VNEXT_JUDGE_MODEL ?? 'gpt-6-astra';
const RESULTS = join(__dirname, '..', 'results');
const DIR = join(RESULTS, DIR_NAME);

interface Turn { turnIndex: number; question: string; text: string; rawDraft?: string }

const loadTurns = (f: string): Turn[] =>
  readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l));

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

describe.runIf(RUN)('vNext Phase 0.1 judging', () => {
  const apiKey = process.env.OPENAI_API_KEY ?? '';
  const outJudg = join(RESULTS, 'judgments-p01.jsonl');
  const outTrust = join(RESULTS, 'trust-p01.jsonl');
  const outDet = join(RESULTS, 'det-trust-p01.jsonl');
  const outVar = join(RESULTS, 'variance-p01.jsonl');

  it('preconditions', async () => {
    expect(apiKey.length).toBeGreaterThan(10);
    expect(existsSync(DIR)).toBe(true);
    await seedFrozenEvidence();
    for (const f of DET_ONLY ? [outDet] : [outJudg, outTrust, outDet, outVar]) {
      rmSync(f, { force: true });
    }
  });

  // Discover (model, system, rep) → available arm labels.
  const found = new Map<string, Set<string>>();
  if (existsSync(DIR)) {
    for (const f of readdirSync(DIR)) {
      const m = /^(.+)__(.+)__([AB]\d?)__(r\d+)\.jsonl$/.exec(f);
      if (m) {
        const k = `${m[1]}|${m[2]}|${m[4]}`;
        found.set(k, (found.get(k) ?? new Set()).add(m[3]));
      }
    }
  }
  const PAIRS: Array<[string, string]> = [['A', 'B1'], ['A', 'B2'], ['B1', 'B2']];

  for (const [key, labels] of found) {
    const [model, system, rep] = key.split('|');
    it.concurrent(`judge+trust ${model}/${system}/${rep}`, async () => {
      await seedFrozenEvidence();
      const file = (label: string) => join(DIR, `${model}__${system}__${label}__${rep}.jsonl`);
      const turnsByLabel = new Map<string, Turn[]>();
      for (const label of labels) turnsByLabel.set(label, loadTurns(file(label)));

      // Pairwise judgments.
      for (const [left, right] of PAIRS) {
        if (DET_ONLY) break;
        if (!labels.has(left) || !labels.has(right)) continue;
        const convL = formatConversation(turnsByLabel.get(left)!);
        const convR = formatConversation(turnsByLabel.get(right)!);
        const leftIsX = (key.length + left.length + Number(rep.slice(1))) % 2 === 0;
        const res = await pairwiseJudge(apiKey, JUDGE_MODEL,
          leftIsX ? convL : convR, leftIsX ? convR : convL);
        appendFileSync(outJudg, `${JSON.stringify({ model, system, rep, left, right, leftIsX, judgeModel: JUDGE_MODEL, res })}\n`);
        expect('skipped' in res, JSON.stringify(res).slice(0, 160)).toBe(false);
      }

      // Trust: semantic (B variants) + deterministic (all labels).
      const block = await frozenAuditBlock(system);
      const anyTurns = turnsByLabel.values().next().value as Turn[];
      const convText = anyTurns.map((t) => t.question).join('\n');
      for (const label of labels) {
        const turns = turnsByLabel.get(label)!;
        const versions: Array<[string, string]> = label === 'A'
          ? [[label, turns.map((t) => t.text).join('\n\n')]]
          : [
            [`${label}-raw`, turns.map((t) => t.rawDraft ?? t.text).join('\n\n')],
            [`${label}-validated`, turns.map((t) => t.text).join('\n\n')],
          ];
        for (const [version, text] of versions) {
          if (!DET_ONLY) {
            const audit = await trustAudit(apiKey, text, block, convText);
            appendFileSync(outTrust, `${JSON.stringify({ model, system, rep, version, ...audit })}\n`);
          }
          const det = deterministicTrust(text, block, convText);
          appendFileSync(outDet, `${JSON.stringify({ model, system, rep, version,
            stray: det.strayFigures.length, wattLoad: det.unlicensedWattLoad.length,
            names: det.noSourceNames.length,
            wattLoadSpans: det.unlicensedWattLoad.slice(0, 6),
            nameList: det.noSourceNames.slice(0, 8) })}\n`);
        }
      }
    }, 2400000);
  }

  it.concurrent('deterministic trust over frozen C captures', async () => {
    await seedFrozenEvidence();
    const dir = join(RESULTS, 'c-capture');
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.jsonl'))) {
      const system = f.replace(/\.jsonl$/, '');
      const turns = loadTurns(join(dir, f));
      const block = await frozenAuditBlock(system);
      const convText = turns.map((t) => t.question).join('\n');
      const det = deterministicTrust(turns.map((t) => t.text).join('\n\n'), block, convText);
      appendFileSync(outDet, `${JSON.stringify({ model: 'production-1498b17', system, rep: 'r0', version: 'C',
        stray: det.strayFigures.length, wattLoad: det.unlicensedWattLoad.length,
        names: det.noSourceNames.length })}\n`);
    }
  }, 600000);

  it.concurrent('semantic-checker variance sample (duplicate audits)', async () => {
    if (DET_ONLY) return;
    await seedFrozenEvidence();
    const sample = [...found.entries()].slice(0, 3);
    for (const [key, labels] of sample) {
      const [model, system, rep] = key.split('|');
      const label = labels.has('B1') ? 'B1' : [...labels][0];
      const turns = loadTurns(join(DIR, `${model}__${system}__${label}__${rep}.jsonl`));
      const block = await frozenAuditBlock(system);
      const convText = turns.map((t) => t.question).join('\n');
      const text = turns.map((t) => t.text).join('\n\n');
      const counts: number[] = [];
      for (let i = 0; i < 2; i++) {
        const audit = await trustAudit(apiKey, text, block, convText);
        counts.push(audit.violations);
      }
      appendFileSync(outVar, `${JSON.stringify({ model, system, rep, label, counts })}\n`);
    }
  }, 1200000);
});

describe.runIf(!RUN)('vNext Phase 0.1 judging (gated off)', () => {
  it('set QA_VNEXT_JUDGE01=1 to run', () => { expect(true).toBe(true); });
});
