# Audio XX — QA/QC Evaluation Harness

Development/test infrastructure. The harness observes Audio XX through its
real entry points and evaluates observations against semantic expectations.
It answers: *did this change improve the targeted case without breaking
identity, evidence, reasoning, or advisory behavior elsewhere?*

The harness tests Audio XX. Audio XX never changes shape to satisfy the
harness. Nothing in this directory is imported by runtime code.

## Architecture

| Module | Role |
| --- | --- |
| `schema.ts` | Fixture format (`GoldenCase`), observation and failure records |
| `corpus.ts` | Golden corpus (17 cases, each for a distinct semantic condition) |
| `observe.ts` | Runs the REAL pipeline: extraction identity, end-to-end turn, deterministic composition |
| `mutate.ts` | Deterministic metamorphic operators (frames, separators, order, roles, omitted brand) |
| `invariants.ts` | Tier 1/2 evaluators — pure functions of (case, observation) |
| `judge.ts` | Tier 3 soft judge (small enums, quoted evidence, observational only) |
| `report.ts` | Compact failure blocks + run summary |

Tests: `../__tests__/qa-fast.test.ts` (blocking, no model calls),
`qa-historical-proof.test.ts` (blocking; constructed bad observations prove
each historical failure class is detectable), `qa-full.test.ts` (gated on
`QA_FULL=1`; per-frame end-to-end admission + soft judge).

## Run modes

```bash
node scripts/qa-harness.mjs fast              # tiers 1–2 + historical proof, ~5s, 0 model calls
node scripts/qa-harness.mjs full              # + e2e frame admission + soft judge (OPENAI_API_KEY optional)
node scripts/qa-harness.mjs p1 <caseId>       # targeted: case + mutations + related golden controls
node scripts/qa-harness.mjs capture           # refresh live production captures for soft judging
```

Case ids: `accuphase-trio`, `followon-discourse`, `nad-vintage`,
`decware-magnepan`, `nathan-2`, … (see `corpus.ts`).

## The P1 repair protocol (proven twice, 2026-09-13/14)

1. **Record** the exact real-user input and production output.
2. **Reduce** to a failure signature ("same-brand sibling deleted", never
   "Accuphase broken").
3. **Neighborhood**: at least five deterministic variants sharing the
   structural defect, plus one inverse/control case.
4. **Run the neighborhood BEFORE the fix** (`qa-harness.mjs p1 …`).
5. **Fix the owning layer** (smallest principled change).
6. **Re-run** reproducer + neighborhood + the whole corpus (`fast`), then the
   repo gate.
7. **Promote** the incident and at least one generalized neighbor into the
   corpus permanently (`landmarkMutations` / a new golden case).

## Tiers

- **TIER 1 (blocking)**: identity preservation, phantom detection,
  token-origin, roles, duplicate collapse, kind admission, chain
  completeness, quantitative provenance (`E-LOAD-PROVENANCE`,
  `E-WATT-ORIGIN`, `E-SENS-BASIS`, `E-QUANT-CLEAN`), sonic licence,
  deterministic contradiction states (`R-EXCLUSIVE`, `R-STATE`,
  `R-COMPAT`, `R-RESTRAINT`), drive-lane state, ladder pins.
- **TIER 2 (blocking where deterministic)**: per-case MUST/MUST-NOT semantic
  expectations over composed output.
- **TIER 3 (observational, never gates)**: `SYSTEM_REASONING_PRESENT`,
  `SYSTEM_DECISION_VALUE`, `LISTENER_UNIQUE_NEXT_QUESTION`,
  `TOPOLOGY_CALIBRATED`, `CLAIM_CONTRADICTION`, `EXPLANATION_CONSISTENT` —
  each negative verdict must carry quoted evidence, a reason, and the
  expected behavior. A soft finding blocks nothing until independently
  confirmed and promoted to a deterministic invariant.

## Boundaries

Do not import harness abstractions into production, add QA metadata to user
responses, or adjust product prose to make tests pass. Mutations are curated
and deterministic — no LLM-generated inputs in the blocking suite. Captures
under `../captures/` are git-ignored working files, not fixtures.
