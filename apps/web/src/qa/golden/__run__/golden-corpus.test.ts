/**
 * Golden System Conversations — TIER C live runner.
 *
 *   QA_GOLDEN=1 OPENAI_API_KEY=… npx vitest run \
 *     apps/web/src/qa/golden/__run__/golden-corpus.test.ts
 *
 * Runs the four golden scenarios plus the §6 observation pairs through the
 * CURRENT production publication boundary (B2 rules, governed context,
 * validator, deterministic trust gate, one bounded retry, safe failure) —
 * the same harness the M1 model selection used, so results remain
 * comparable across model/config migrations.
 *
 * Env knobs:
 *   QA_GOLDEN_MODEL     generation model   (default gpt-6-astra — production)
 *   QA_GOLDEN_VALIDATOR validator model    (default gpt-4o     — production)
 *   QA_GOLDEN_RUN       run id             (default golden-<date>)
 *   QA_GOLDEN_REPS      reps per scenario  (default 1; rep r uses paraphrase
 *                       variant r, so later reps exercise the variants)
 *   QA_GOLDEN_SYSTEMS   csv filter         (default all four)
 *
 * Before any conversation runs, a pending Suggested-Edits contribution
 * naming each golden system's products is planted with a canary marker
 * (§17): if the marker ever surfaces in a governed context or an answer,
 * the corpus fails hard. Canary rows are removed afterwards.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { mkdirSync, appendFileSync, writeFileSync, rmSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { seedFrozenEvidence, EXPERIMENT_SYSTEMS, FROZEN_SNAPSHOT_ID } from '../../vnext/frozen-evidence';
import { runArmTurn, newArmState } from '../../vnext/arms';
import { GOLDEN_SCENARIOS, OBSERVATION_PAIRS, turnText } from '../scenarios';
import { GOLDEN_ARCHETYPES } from '../archetypes';
import { writeContribution } from '@/lib/contributions/contribution-store';
import { prisma } from '@/lib/prisma';
import { assembleGovernedContext } from '@/lib/reasoning/context-assembly';
import { serializeGovernedContext } from '@/lib/reasoning/governed-context';

const RUN = process.env.QA_GOLDEN === '1';
const MODEL = process.env.QA_GOLDEN_MODEL ?? 'gpt-6-astra';
const VALIDATOR = process.env.QA_GOLDEN_VALIDATOR ?? 'gpt-4o';
const RUN_ID = process.env.QA_GOLDEN_RUN ?? `golden-${new Date().toISOString().slice(0, 10)}`;
const REPS = Number(process.env.QA_GOLDEN_REPS ?? '1');
const OUT_DIR = join(__dirname, '..', 'results', RUN_ID);
const GEN = { maxCompletionTokens: 4096, timeoutMs: 180000 } as const;

const CANARY = 'GOLDEN-CANARY-7f3a-pending-contributions-never-enter-reasoning';
const CANARY_USER = 'golden-canary@qa.local';

function selectedScenarios() {
  const sel = process.env.QA_GOLDEN_SYSTEMS;
  if (!sel) return GOLDEN_SCENARIOS;
  const ids = new Set(sel.split(',').map((s) => s.trim()));
  return GOLDEN_SCENARIOS.filter((s) => ids.has(s.systemId));
}

function systemFor(id: string) {
  const sys = EXPERIMENT_SYSTEMS.find((s) => s.id === id);
  if (!sys) throw new Error(`no ExperimentSystem for ${id}`);
  return sys;
}

async function removeCanaries() {
  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "ContributionV1" WHERE "userId" = ?`, CANARY_USER,
    );
  } catch { /* table may not exist yet — nothing to remove */ }
}

describe.runIf(RUN)('Golden System Conversations — Tier C', () => {
  const apiKey = process.env.OPENAI_API_KEY ?? '';
  const scenarios = selectedScenarios();

  afterAll(removeCanaries);

  it('preconditions: seed, canaries planted, canaries invisible to governed context, manifest', async () => {
    expect(apiKey.length).toBeGreaterThan(10);
    await seedFrozenEvidence();

    // §17 — plant a pending contribution against a product of each golden
    // system, then prove the governed context the lane assembles never
    // sees it. Structural pins (contributions slice1.test.ts) forbid the
    // import path; this is the runtime proof on the corpus's own systems.
    await removeCanaries();
    for (const a of GOLDEN_ARCHETYPES) {
      const sys = systemFor(a.systemId);
      await writeContribution(CANARY_USER, {
        surface: 'qa_canary',
        productName: sys.components[0].displayName,
        reason: 'wrong',
        text: `${CANARY} — ${sys.components[0].displayName} claim that must never surface.`,
      });
    }
    for (const a of GOLDEN_ARCHETYPES) {
      const sys = systemFor(a.systemId);
      const ctx = await assembleGovernedContext({
        activeSystem: { components: sys.components, source: 'stated' },
        currentHypothetical: null,
        question: 'What should I change first?',
        recentTurns: [],
        userObservations: [],
      });
      const block = serializeGovernedContext(ctx);
      expect(block, `${a.systemId} context must not contain the canary`).not.toContain(CANARY);
      expect(block).not.toContain('ContributionV1');
    }

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify({
      runId: RUN_ID,
      purpose: 'Golden System Conversations — behavioral regression corpus',
      snapshot: FROZEN_SNAPSHOT_ID,
      model: MODEL,
      validator: VALIDATOR,
      arm: 'B2',
      generation: { ...GEN, temperature: 'api-default (no override — production astra behavior)' },
      publication: 'production boundary (computeValidationStatus + det trust gate on final text + 1 bounded retry + safe failure)',
      reps: REPS,
      systems: scenarios.map((s) => s.systemId),
      observationPairs: OBSERVATION_PAIRS.map((p) => p.systemId),
      canary: 'planted for all four systems; context asserted clean',
      startedAt: new Date().toISOString(),
    }, null, 2));
  }, 300000);

  for (const scenario of scenarios) {
    for (let rep = 0; rep < REPS; rep++) {
      it.concurrent(`${scenario.systemId} · r${rep}`, async () => {
        await seedFrozenEvidence();
        const system = systemFor(scenario.systemId);
        const file = join(OUT_DIR, `${scenario.systemId}__r${rep}.jsonl`);
        if (existsSync(file)) return; // resumable
        const tmp = `${file}.part`;
        rmSync(tmp, { force: true });
        const state = newArmState();
        let hardFailures = 0;
        for (let i = 0; i < scenario.turns.length; i++) {
          const turn = scenario.turns[i];
          const res = await runArmTurn(
            'B', system, state, i, turnText(turn, rep), !!turn.observation, MODEL,
            { apiKey, ...GEN, variant: 'B2', productionBoundary: true, validatorModel: VALIDATOR },
          );
          appendFileSync(tmp, `${JSON.stringify({ ...res, slot: turn.slot })}\n`);
          if (res.failed) hardFailures++;
          // §17 hard invariant: the canary never reaches an answer.
          expect(res.text).not.toContain(CANARY);
          expect(res.rawDraft).not.toContain(CANARY);
        }
        expect(hardFailures).toBeLessThan(scenario.turns.length);
        rmSync(file, { force: true });
        renameSync(tmp, file);
      }, 3600000);
    }
  }

  for (const pair of OBSERVATION_PAIRS) {
    it.concurrent(`observation-pair · ${pair.systemId}`, async () => {
      await seedFrozenEvidence();
      const system = systemFor(pair.systemId);
      const file = join(OUT_DIR, `obs-pair__${pair.systemId}.jsonl`);
      if (existsSync(file)) return; // resumable
      const tmp = `${file}.part`;
      rmSync(tmp, { force: true });
      for (const leg of ['baseline', 'transformed'] as const) {
        const state = newArmState();
        const turns = leg === 'baseline'
          ? [{ text: system.statement, obs: false }, { text: pair.baseline, obs: false }]
          : [{ text: system.statement, obs: false }, { text: pair.transformed, obs: true }];
        for (let i = 0; i < turns.length; i++) {
          const res = await runArmTurn(
            'B', system, state, i, turns[i].text, turns[i].obs, MODEL,
            { apiKey, ...GEN, variant: 'B2', productionBoundary: true, validatorModel: VALIDATOR },
          );
          appendFileSync(tmp, `${JSON.stringify({ ...res, leg })}\n`);
        }
      }
      rmSync(file, { force: true });
      renameSync(tmp, file);
    }, 3600000);
  }
});

describe.runIf(!RUN)('Golden System Conversations (gated off)', () => {
  it('set QA_GOLDEN=1 to run', () => { expect(true).toBe(true); });
});
