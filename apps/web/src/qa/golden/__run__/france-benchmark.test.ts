/**
 * France Grok-benchmark — permanent product acceptance fixture (2026-09-19).
 *
 *   QA_FRANCE_BENCH=1 OPENAI_API_KEY=… npx vitest run \
 *     apps/web/src/qa/golden/__run__/france-benchmark.test.ts
 *
 * Runs CONVERSATIONS['france-grok-benchmark'] — the full listener-context
 * France conversation (stated preferences, reference systems, three
 * substitution candidates including the cable overclaim trap) — through
 * the CURRENT production publication boundary. The acceptance criterion is
 * not matching the competitor's conclusions: it is an assessment at least
 * as useful, personalized and system-aware, with every consequential
 * conclusion traceable to evidence and properly licensed reasoning.
 *
 * Deterministic in-run checks: every published turn is det-clean (no
 * unlicensed figures), and the run records per-turn publication telemetry
 * for the committed baseline document in ../baselines/.
 */
import { describe, it, expect } from 'vitest';
import { mkdirSync, appendFileSync, rmSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { seedFrozenEvidence, EXPERIMENT_SYSTEMS } from '../../vnext/frozen-evidence';
import { CONVERSATIONS } from '../../vnext/conversations';
import { runArmTurn, newArmState } from '../../vnext/arms';

const RUN = process.env.QA_FRANCE_BENCH === '1';
const MODEL = process.env.QA_GOLDEN_MODEL ?? 'gpt-6-astra';
const VALIDATOR = process.env.QA_GOLDEN_VALIDATOR ?? 'gpt-4o';
const RUN_ID = process.env.QA_FRANCE_BENCH_RUN ?? `france-bench-${new Date().toISOString().slice(0, 10)}`;
const OUT_DIR = join(__dirname, '..', 'results', RUN_ID);
const GEN = { maxCompletionTokens: 4096, timeoutMs: 180000 } as const;

describe.runIf(RUN)('France Grok benchmark', () => {
  const apiKey = process.env.OPENAI_API_KEY ?? '';

  it('runs the benchmark conversation through the production boundary', async () => {
    expect(apiKey.length).toBeGreaterThan(10);
    await seedFrozenEvidence();
    const system = EXPERIMENT_SYSTEMS.find((s) => s.id === 'france-ii')!;
    const script = CONVERSATIONS['france-grok-benchmark'];
    expect(script.length).toBeGreaterThan(0);
    mkdirSync(OUT_DIR, { recursive: true });
    const file = join(OUT_DIR, 'france-grok-benchmark.jsonl');
    if (existsSync(file)) return; // resumable
    const tmp = `${file}.part`;
    rmSync(tmp, { force: true });
    const state = newArmState();
    for (let i = 0; i < script.length; i++) {
      const res = await runArmTurn(
        'B', system, state, i, script[i].user, !!script[i].observation, MODEL,
        { apiKey, ...GEN, variant: 'B2', productionBoundary: true, validatorModel: VALIDATOR },
      );
      appendFileSync(tmp, `${JSON.stringify(res)}\n`);
      // Trust invariant: nothing publishes with deterministic violations.
      if (res.publication?.published) {
        expect(res.publication.detFinal.clean, `turn ${i} det-clean`).toBe(true);
      }
    }
    // The observation turns must have reached the governed context.
    expect(state.observations.length).toBeGreaterThanOrEqual(2);
    renameSync(tmp, file);
  }, 3600000);
});

describe.runIf(!RUN)('France Grok benchmark (gated off)', () => {
  it('set QA_FRANCE_BENCH=1 to run', () => { expect(true).toBe(true); });
});
