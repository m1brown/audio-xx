# vNext Phase 0 — the architecture experiment

Answers one question with evidence:

> Can Audio XX preserve frontier-model intelligence while adding the trust,
> evidence, persistence and tools that make Audio XX worth existing?

Three arms, same listener turns, each arm conversing over its own answers:

- **A — naked model**: same model, same rules-of-register, no Audio XX
  evidence. The intelligence control.
- **B — Audio XX substrate**: the governed reasoning lane's context
  (identity, classed evidence with provenance, computed facts, one-slot
  hypothetical, listener observations, raw history) + free-prose reasoning
  + claim validation. Raw draft and validated answer are both retained.
- **C — current production (1498b17)**: captured through the real
  conversation surface (`scripts/vnext-capture-c.mjs`). Migration
  reference, unmodified.

Evidence is FROZEN (`frozen-evidence.ts`, snapshot id in the file): seeded
into the fact store's in-process tier at run start; in-repo authored facts
and catalog records flow through the lane unchanged. Retrieval variance is
zero by construction.

## Run

```bash
# generation (arms A/B; env knobs documented in __run__/experiment.test.ts)
QA_VNEXT=1 OPENAI_API_KEY=… npx vitest run apps/web/src/qa/vnext/__run__/experiment.test.ts

# arm C capture from production
node scripts/vnext-capture-c.mjs

# blind pairwise judging + symmetric trust audits
QA_VNEXT_JUDGE=1 OPENAI_API_KEY=… npx vitest run apps/web/src/qa/vnext/__run__/judge.test.ts

# aggregate
node scripts/vnext-analyze.mjs
```

## Instruments

- **Experience**: blind pairwise whole-conversation judgment (positions
  randomized and recorded), nine enum axes with mandatory quoted evidence,
  dossier-free decision-value rule. No numeric scores.
- **Trust**: the SAME claim-validation checker audits every arm's text
  against the same frozen evidence package — arm A is measured under
  exactly the rules arm B lives under. B is audited twice (raw draft and
  validated answer) so substrate damage and validation damage stay
  separable. Deterministic stray-figure counts back the model checker.
- **State**: per-turn hypothetical-slot traces recorded in the JSONL.

Results land in `results/` (git-ignored): per-turn JSONL per conversation,
`judgments.jsonl`, `trust.jsonl`, and a manifest per run with the full
configuration. A fallback or failure is recorded as an outcome — never
counted as a successful answer from that arm.

## Boundaries

Phase 0 changes no production behavior: the lane fixes it needed
(`forget`/`never mind` clearing, past-tense substitution morphology, the
non-amplifier power-delta guard) live in flag-off lane code and are pinned
in `lib/reasoning/__tests__/phase0-lane-fixes.test.ts`. The experiment kit
is QA-only and imports product code, never the reverse.
