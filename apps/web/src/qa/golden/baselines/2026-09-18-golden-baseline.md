# Golden corpus baseline — 2026-09-18

First durable corpus baseline, run against the accepted production
configuration.

| field      | value |
| ---------- | ----- |
| run id     | `golden-2026-09-18` (results git-ignored; summary here is the record) |
| code       | qa/golden-corpus branch off `2ae8120` (production release at run time) |
| generation | gpt-6-astra (api-default temperature — production astra behavior) |
| validator  | gpt-4o |
| boundary   | production publication semantics (computeValidationStatus + det trust gate on final text + 1 bounded retry + safe failure) |
| judge      | gpt-6-astra (self-judging caveat disclosed; enum + quoted-evidence discipline) |

## Deterministic layer

44 scenario turns + 16 observation-pair turns; zero generation errors.

| system    | CHECKED | REPAIRED | SAFE_FAILURE | retries | candidates turn | hypo slot |
| --------- | ------- | -------- | ------------ | ------- | --------------- | --------- |
| accuphase | 11 | 0 | 0 | 0 | **C** — published clean | armed + cleared |
| france-ii | 6  | 5 | 0 | 1 | **C** — published clean | armed + cleared |
| nad       | 11 | 0 | 0 | 0 | **C** — published clean | not armed (category swap — see notes) |
| nathan    | 11 | 0 | 0 | 0 | **C** — published clean | not armed (topology change — see notes) |

- **No Class A** (nothing published with deterministic violations).
- **The historical NAD candidate-turn safe failure did not recur**: this
  run reached Class C — useful candidates without unsupported numerics.
- Suggested-Edits canary: pending contributions planted for a product of
  each system; all four governed contexts and all 60 outputs clean.

## Semantic layer (rubric, PASS/WEAK/FAIL per axis)

- accuphase: 10 PASS — stance LEAVE_ALONE, observations INCORPORATED,
  hypothetical tracking CLEAR.
- france-ii: 10 PASS — stance LEAVE_ALONE, INCORPORATED, CLEAR.
- nathan: 9 PASS, 1 FAIL (SPECIFICITY) — stance EXPERIMENT, INCORPORATED,
  CLEAR. Candidates (Pass Labs X250.8, Luxman M-10X) named with listening
  goals but without distinguishing rationale for THIS system.
- nad: 9 PASS, 1 FAIL (SPECIFICITY) — stance LEAVE_ALONE, INCORPORATED,
  CLEAR. Candidates (Yamaha A-S501, Marantz PM6007, NAD C 316BEE V2)
  carry only category-level rationale.

Observation pairs (§6): 4/4 INCORPORATED — in every system the stated
listening context did causal work (deprioritized power, redirected to
setup/room/tone moves, conditioned the audition protocol), including where
the recommendation itself did not change.

Stance distribution: 3 × LEAVE_ALONE, 1 × EXPERIMENT. No §8 flag: no
upgrade bias, and restraint is everywhere accompanied by concrete,
actionable reasoning (candidates were produced whenever requested).

## Qualitative comparison with the accepted M1 transcripts

Same behavioral fingerprint, better on the known weak spot:

- Restraint conclusions match the acceptance character (Accuphase
  "leave it intact", Nathan free-experiment-before-purchase, France II
  budget treated as ceiling).
- NAD candidates turn IMPROVED vs history: acceptance ended in a safe
  failure (both drafts carried an unlicensed numeric); this run published
  clean candidates. Stochastic — the underlying tendency remains under
  watch (see findings).
- France II drew 5 REPAIRED turns (acceptance run: 2 across all systems)
  — the validator actively weakening unsupported claims on the
  evidence-dense system. Working as designed; worth tracking as a trend.
- Residual quality weakness surfaced by the rubric instead of the trust
  net: candidate rationale can be generic (the "why THIS component in
  THIS system" test). Recorded as a finding; not fixed in this mission.

## Run-specific notes

- NAD and Nathan hypothetical turns intentionally pose a CATEGORY
  substitution ("a modern standmount") and a TOPOLOGY change (running the
  Rossini direct). The one-slot product hypothetical does not arm for
  either — by design it models product-for-product substitution. The
  adviser handled both hypotheticals correctly in prose and the judge
  scored tracking CLEAR; the deterministic slot check applies to the
  accuphase and france-ii scenarios. Recorded as a P3 design-boundary
  observation in `findings.md`.
