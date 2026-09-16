/**
 * M1 model selection — controlled gpt-4o vs gpt-6-astra comparison of the
 * SAME B2 architecture through the CURRENT production publication boundary.
 *
 *   QA_VNEXT_MSEL=1 OPENAI_API_KEY=… npx vitest run \
 *     apps/web/src/qa/vnext/__run__/model-select.test.ts
 *
 * Held constant across models: B2 REASONING_RULES (production constants),
 * governed context assembly, frozen evidence snapshot + production store,
 * conversation scripts and observation flags, validator (gpt-4o, 30s),
 * deterministic trust gate, publication semantics (deletion-is-not-a-repair,
 * det gate on final text, one bounded retry, safe failure), completion
 * ceiling 4096, generation timeout 180s, no temperature override for
 * either model. The model is the experimental variable.
 *
 * Repetitions: 3 per conversation/model; 5 for the focused France II and
 * candidate-solicitation conversations. Every attempt/failure is recorded.
 *
 * Env knobs:
 *   QA_VNEXT_MSEL_MODELS  csv (default "gpt-4o,gpt-6-astra")
 *   QA_VNEXT_MSEL_RUN     run id (default "msel")
 *   QA_VNEXT_MSEL_SYSTEMS csv filter (default all)
 */
import { describe, it, expect } from 'vitest';
import { mkdirSync, appendFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { seedFrozenEvidence, EXPERIMENT_SYSTEMS, FROZEN_SNAPSHOT_ID } from '../frozen-evidence';
import { CONVERSATIONS } from '../conversations';
import { runArmTurn, newArmState } from '../arms';

const RUN = process.env.QA_VNEXT_MSEL === '1';
const MODELS = (process.env.QA_VNEXT_MSEL_MODELS ?? 'gpt-4o,gpt-6-astra').split(',').map((s) => s.trim()).filter(Boolean);
const RUN_ID = process.env.QA_VNEXT_MSEL_RUN ?? 'msel';
const OUT_DIR = join(__dirname, '..', 'results', RUN_ID);
const FOCUSED = new Set(['france-ii', 'accuphase-candidates']);
const REPS = (id: string) => (FOCUSED.has(id) ? 5 : 3);
const GEN = { maxCompletionTokens: 4096, timeoutMs: 180000 } as const;
const VALIDATOR_MODEL = 'gpt-4o';

function systems() {
  const sel = process.env.QA_VNEXT_MSEL_SYSTEMS;
  if (!sel) return EXPERIMENT_SYSTEMS;
  const ids = new Set(sel.split(',').map((s) => s.trim()));
  return EXPERIMENT_SYSTEMS.filter((s) => ids.has(s.id));
}

describe.runIf(RUN)('M1 model selection', () => {
  const apiKey = process.env.OPENAI_API_KEY ?? '';
  const sel = systems();

  it('preconditions + manifest', async () => {
    expect(apiKey.length).toBeGreaterThan(10);
    await seedFrozenEvidence();
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify({
      runId: RUN_ID,
      purpose: 'M1 B2 model selection — production publication boundary',
      snapshot: FROZEN_SNAPSHOT_ID,
      models: MODELS,
      arm: 'B2',
      generation: { ...GEN, temperature: 'api-default (no override, both models)' },
      validator: { model: VALIDATOR_MODEL, timeoutMs: 30000 },
      publication: 'computeValidationStatus + deterministic trust gate + 1 bounded retry + safe failure (production 9ac11b8 semantics)',
      repetitions: Object.fromEntries(sel.map((s) => [s.id, REPS(s.id)])),
      systems: sel.map((s) => s.id),
      startedAt: new Date().toISOString(),
    }, null, 2));
  });

  for (const model of MODELS) {
    for (const system of sel) {
      for (let rep = 0; rep < REPS(system.id); rep++) {
        it.concurrent(`${model} · ${system.id} · r${rep}`, async () => {
          await seedFrozenEvidence();
          const script = CONVERSATIONS[system.id];
          expect(script?.length).toBeGreaterThan(0);
          const file = join(OUT_DIR, `${model}__${system.id}__B2__r${rep}.jsonl`);
          if (existsSync(file)) return; // resumable: completed runs are kept
          const tmp = `${file}.part`;
          rmSync(tmp, { force: true });
          const state = newArmState();
          let hardFailures = 0;
          for (let i = 0; i < script.length; i++) {
            const turn = script[i];
            const res = await runArmTurn(
              'B', system, state, i, turn.user, !!turn.observation, model,
              {
                apiKey, ...GEN, variant: 'B2',
                productionBoundary: true, validatorModel: VALIDATOR_MODEL,
              },
            );
            appendFileSync(tmp, `${JSON.stringify(res)}\n`);
            if (res.failed) hardFailures++;
          }
          expect(hardFailures).toBeLessThan(script.length);
          rmSync(file, { force: true });
          const { renameSync } = await import('node:fs');
          renameSync(tmp, file);
        }, 3600000);
      }
    }
  }
});

describe.runIf(!RUN)('M1 model selection (gated off)', () => {
  it('set QA_VNEXT_MSEL=1 to run', () => { expect(true).toBe(true); });
});
