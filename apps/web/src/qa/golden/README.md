# Golden System Conversations — behavioral regression corpus

Preserves the product behavior validated at Post-M1 Product Acceptance
(2026-09-17). **We are not freezing answers; we are freezing expectations
about the quality of reasoning.** A future model may use different words,
reach a different appropriately-supported recommendation, or ask a
different question and still be excellent. No test in this corpus asserts
expected output strings outside the narrow deterministic trust layer.

The corpus exists so Audio XX continues to: understand the system, reason
about relationships, listen to the listener, distinguish knowledge from
hypothesis, make useful decisions, and know when not to recommend a
purchase.

## The three layers

1. **Deterministic invariants** — owned by existing lock tests; this
   corpus references them and `__tests__/golden-static.test.ts` fails if
   any pin disappears:
   - exact figures / watt-load / evidence voice require license →
     `lib/reasoning/__tests__/deterministic-trust.test.ts`
   - deletion never publishes → `migration1-publication.test.ts`
   - safe failure never falls through to legacy → `migration1-authority.test.ts`
   - actual roster never mutates → `lib/__tests__/new-system-isolation.test.ts`
     (+ browser replays `scripts/vnext-m1-newsystem-probe.mjs`)
   - founder lane model/validator → `m1-astra-config.test.ts`
   - pending contributions never enter reasoning →
     `lib/contributions/__tests__/slice1.test.ts` structural pins + the
     Tier C runtime canary
   - hypothetical slot morphology (incl. the KNOWN P3 "traded X for Y"
     miss) → pinned deterministically in `golden-static.test.ts`
2. **Semantic product qualities** — `rubric.ts`: ten PASS/WEAK/FAIL axes
   with mandatory quoted evidence, plus stance, observation-use, and
   hypothetical-tracking classifications. Never collapsed into one score.
3. **Historical golden transcripts** — `historical/` (provenance in
   `historical/PROVENANCE.md`). Exemplars for humans and for the judge,
   never test answers.

## Files

- `archetypes.ts` — what each of the four systems protects.
- `scenarios.ts` — conversation shapes with paraphrase variants +
  §6 observation pairs.
- `rubric.ts` — judge prompts (single-conversation rubric; pair probe).
- `findings.md` — known historical P2/P3, incl. the NAD safe-failure
  fixture and its A/B/C classification.
- `__tests__/golden-static.test.ts` — Tier A (in the standard gate).
- `__run__/golden-corpus.test.ts` — Tier C runner (gated `QA_GOLDEN=1`).
- `__run__/golden-judge.test.ts` — Tier C judge (gated `QA_GOLDEN_JUDGE=1`).
- `../../../../../../scripts/golden-analyze.mjs` — aggregation + hard
  invariant checks (non-zero exit on Class A, slot-survival, or an
  ignored observation).
- `results/` — git-ignored working output; `baselines/` — committed
  baseline summaries per run.

## Tiers — when to run what

**TIER A — every relevant change (free, in the standard gate).**
`golden-static.test.ts` runs with `node scripts/test-gate.mjs`: corpus
integrity, invariant wiring, hypothetical morphology. All the referenced
lock tests also run in the gate. UI-only releases stop here.

**TIER B — pre-release for reasoning-adjacent changes (cheap live).**
One focused conversation instead of the full corpus:

```bash
QA_GOLDEN=1 QA_GOLDEN_SYSTEMS=nad OPENAI_API_KEY=… npx vitest run apps/web/src/qa/golden/__run__/golden-corpus.test.ts
node scripts/golden-analyze.mjs
```

Pick the archetype nearest the change (evidence retrieval → accuphase;
candidate generation → nad; interface reasoning → nathan; budget/decision
value → france-ii).

**TIER C — model / validator / prompt / substrate / retrieval / state /
identity / trust-validation migrations (full live).**

```bash
QA_GOLDEN=1 OPENAI_API_KEY=… npx vitest run apps/web/src/qa/golden/__run__/golden-corpus.test.ts
QA_GOLDEN_JUDGE=1 OPENAI_API_KEY=… npx vitest run apps/web/src/qa/golden/__run__/golden-judge.test.ts
node scripts/golden-analyze.mjs
```

Four full conversations + four observation pairs through the CURRENT
production publication boundary, semantic judging, comparison against the
previous baseline in `baselines/`. For a model change, also run the
pairwise judge from the model-selection kit (`vnext/__run__/model-judge`)
between old and new model outputs.

Roughly 60 generation calls + validators + ~12 judge calls per full run —
never wire this into per-commit CI.

## Reading results

- A **Class A** line (published det violation) is a P0: stop and report.
- A **B** on the NAD candidates turn matches the historical P2 — trust
  pass, quality degradation; not a regression, not success.
- Rubric FAILs and observation-pair IGNORED are regressions to
  investigate; WEAK is signal, not failure.
- Stance distribution flags (§8): all-CHANGE across systems → upgrade
  bias; no concrete stance anywhere → over-caution. Neither gates; both
  demand review.

## Boundaries

QA-only: imports product code, never the reverse. Do not tune prompts,
evidence, or the trust net to improve corpus results. If a run surfaces a
real P0/P1 — stop and report.
