/**
 * vNext Phase 0 — bake-off runner. Runs ONLY with QA_VNEXT=1.
 *
 *   QA_VNEXT=1 OPENAI_API_KEY=… npx vitest run apps/web/src/qa/vnext/__run__/experiment.test.ts
 *
 * Env knobs:
 *   QA_VNEXT_MODELS   csv (default "gpt-6-astra")
 *   QA_VNEXT_SYSTEMS  csv of system ids, or "all" (default) / "core" / "holdout"
 *   QA_VNEXT_ARMS     csv (default "A,B")
 *   QA_VNEXT_REPEAT   integer (default 1)
 *   QA_VNEXT_RUN      run id (default timestamp) — results land in results/<run>/
 *
 * One `it` per conversation (concurrent); each conversation is sequential
 * internally because every arm must see its own prior answers. Results are
 * appended per-turn as JSONL so a crashed run keeps its evidence.
 */
import { describe, it, expect } from 'vitest';
import { mkdirSync, appendFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { seedFrozenEvidence, EXPERIMENT_SYSTEMS, FROZEN_SNAPSHOT_ID } from '../frozen-evidence';
import { CONVERSATIONS } from '../conversations';
import { runArmTurn, newArmState } from '../arms';

const RUN = process.env.QA_VNEXT === '1';
const MODELS = (process.env.QA_VNEXT_MODELS ?? 'gpt-6-astra').split(',').map((s) => s.trim()).filter(Boolean);
const ARMS = (process.env.QA_VNEXT_ARMS ?? 'A,B').split(',').map((s) => s.trim()) as Array<'A' | 'B'>;
const REPEAT = Number(process.env.QA_VNEXT_REPEAT ?? '1');
const RUN_ID = process.env.QA_VNEXT_RUN ?? new Date().toISOString().replace(/[:.]/g, '-').slice(0, 17);
const OUT_DIR = join(__dirname, '..', 'results', RUN_ID);

function selectedSystems() {
  const sel = process.env.QA_VNEXT_SYSTEMS ?? 'all';
  if (sel === 'all') return EXPERIMENT_SYSTEMS;
  if (sel === 'core') return EXPERIMENT_SYSTEMS.filter((s) => !s.holdout);
  if (sel === 'holdout') return EXPERIMENT_SYSTEMS.filter((s) => s.holdout);
  const ids = new Set(sel.split(',').map((s) => s.trim()));
  return EXPERIMENT_SYSTEMS.filter((s) => ids.has(s.id));
}

describe.runIf(RUN)('vNext Phase 0 bake-off', () => {
  const apiKey = process.env.OPENAI_API_KEY ?? '';
  const systems = selectedSystems();

  it('preconditions', async () => {
    expect(apiKey.length).toBeGreaterThan(10);
    await seedFrozenEvidence();
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify({
      runId: RUN_ID,
      snapshot: FROZEN_SNAPSHOT_ID,
      models: MODELS,
      arms: ARMS,
      repeat: REPEAT,
      systems: systems.map((s) => s.id),
      maxCompletionTokens: 4096,
      timeoutMs: 180000,
      validator: { model: 'gpt-4o', timeoutMs: 30000 },
      startedAt: new Date().toISOString(),
    }, null, 2));
  });

  for (const model of MODELS) {
    for (const system of systems) {
      for (const arm of ARMS) {
        for (let rep = 0; rep < REPEAT; rep++) {
          it.concurrent(`${model} · ${system.id} · arm ${arm} · r${rep}`, async () => {
            await seedFrozenEvidence();
            const script = CONVERSATIONS[system.id];
            expect(script?.length).toBeGreaterThan(0);
            const file = join(OUT_DIR, `${model}__${system.id}__${arm}__r${rep}.jsonl`);
            rmSync(file, { force: true });
            const state = newArmState();
            let failures = 0;
            for (let i = 0; i < script.length; i++) {
              const turn = script[i];
              const res = await runArmTurn(
                arm, system, state, i, turn.user, !!turn.observation, model,
                { apiKey, maxCompletionTokens: 4096, timeoutMs: 180000 },
              );
              appendFileSync(file, `${JSON.stringify(res)}\n`);
              if (res.failed) failures++;
            }
            // A conversation with any hard failure is recorded, not hidden —
            // but a fully-failed conversation voids the run.
            expect(failures).toBeLessThan(script.length);
          }, 3600000);
        }
      }
    }
  }
});

describe.runIf(!RUN)('vNext Phase 0 bake-off (gated off)', () => {
  it('set QA_VNEXT=1 to run', () => { expect(true).toBe(true); });
});
