# Gate 5 — Editorial & Visual QA · Report

Date: 2026-07-25 · Baseline: f3a7f7b (+ this gate's fix) · Method: real
artifact pipeline (`runArtifactPipeline`) over the representative system
set; every text field reviewed against the five dimensions.

## Recommendation: **PASS WITH MINOR ISSUES**

One S1 editorial naming defect (the founder's required `wLM` case) found,
fixed, regression-pinned, and re-verified. No fabricated technical claims
(factual restraint holds). The technical-depth direction is a genuine,
valuable enhancement but a doctrine + knowledge limitation, not a
launch-blocking defect — recorded to POST_LAUNCH with a restraint-preserving
plan. Remaining findings are S2, deferred with causal classification.

## Assessments reviewed (evidence: assessments-before.txt / -after.txt)

| # | System | Verdict | Notes |
|---|---|---|---|
| 1 | Eversolo / Job / **WLM Diva** / Chord Hugo (reported) | Nothing here needs changing | naming defect G5-D1 (fixed) |
| 2 | Bluesound Node / Hegel H190 / KEF LS50 Meta | The amplifier is steering the whole system | credit drops to bare "KEF" (G5-D3) |
| 3 | Chord Qutest / Naim SN3 / Klipsch La Scala | The DAC is holding the system back | credit drops to bare "Klipsch" (G5-D3) |
| 4 | Denafrips Ares II / Leben CS600X / Magnepan LRS+ | Nothing here needs changing | "Ares Ii" mis-case (G5-D3); power-match depth (G5-D5) |
| 5 | Chord Qutest / Naim SN3 / Harbeth SHL5+ | Nothing here needs changing | clean |
| 6 | vague "vintage receiver + used bookshelves" | — (null) | correctly routes to low-confidence/clarification, not a fabricated assessment |

## Findings by dimension

**1. Editorial coherence.** Headlines match standfirsts; verdicts follow
the diagnosis; bottleneck systems (2, 3) name a role and a heard
consequence; restraint systems (1, 5) end cleanly. One tension: system 4's
"Nothing here needs changing" is followed by a soft "if you ever want more…
a source upgrade" beat (G5-D4, S2).

**2. Technical explanatory depth.** Uniformly phenomenological — *what* the
system sounds like, rarely *why* in engineering terms. This is the
founder's direction; classified as a doctrine + knowledge limitation, not a
defect (see POST_LAUNCH). The engine describes component interaction
("nothing fights what the speaker is trying to do", axis agreement) but does
not reach topology/filter/sensitivity/crossover causes.

**3. Factual restraint — PASS.** No fabricated manufacturer histories,
circuit claims, driver tech, or lineages in any of the six. The engine
currently under-claims rather than over-claims. The one prior fabrication
class ("Classic Quad / EL84 tube" from a mis-parsed cable) is already fixed
upstream (parser fix, f3a7f7b). The depth enhancement must preserve this.

**4. Product & brand integrity.**
- **G5-D1 (S1, FIXED):** "wLM Diva Monitor" mid-sentence — the trade
  sentence decapitalised the first character for flow, mangling the WLM
  acronym. The credit line, image label, and metadata were already correct;
  only the flow-decap was wrong. Fixed (proper-name/acronym-safe decap);
  re-verified: the trade now reads "WLM Diva Monitor", while common-word
  fragments still decapitalise ("transient edge…", "if you want…").
- **G5-D3 (S2, knowledge-data):** uncataloged models degrade — "KEF LS50
  Meta"→"KEF", "Klipsch La Scala"→"Klipsch", "Denafrips Ares II"→"Ares Ii".
  Root cause is missing catalog entries (fallback naming), not a renderer
  bug; correct fix is data. Deferred to POST_LAUNCH.

**5. Visual hierarchy.** The v2 artifact gives the verdict the largest type,
the standfirst as italic standfirst, a component photo rail, then the case
paragraphs; the trade and recommendation read as their own beats. The
engineering explanation (when it lands) will need to stay one sentence per
junction to avoid a dense block — a constraint noted for the depth work.

## Defects

| ID | Sev | Causal class | Finding | Disposition |
|---|---|---|---|---|
| G5-D1 | S1 | rendering | acronym decapitalised mid-sentence ("wLM") | **FIXED** + pinned |
| G5-D2 | S2 | doctrine + knowledge | technical explanatory depth (phenomenological, not causal) | POST_LAUNCH |
| G5-D3 | S2 | knowledge-data | uncataloged models → bare-brand / mis-cased names | POST_LAUNCH |
| G5-D4 | S2 | editorial | "nothing needs changing" + soft upgrade beat | POST_LAUNCH |
| G5-D5 | S2 | doctrine + knowledge | power-match caution absent on low-power/hard-speaker pairing | POST_LAUNCH |

Zero S0. One S1 (fixed). Factual restraint passes — no fabrication.

## Fixes applied
- `synthesizeArtifact.ts` `lowerFirst`: preserve original case when a
  fragment begins with a proper name (internal-capital first token, or two
  capitalised leading tokens); applied at all five decap sites. Regression
  test `proper-name-casing.test.ts` (3 cases).

## Items deferred
G5-D2..D5 to POST_LAUNCH.md with causal classes above. The technical-depth
enhancement is the largest and is knowledge-first; the founder's benchmark
paragraph is recorded as the endpoint, with the restraint guardrail.

## Automated results
- New `proper-name-casing.test.ts`: 3/3.
- Engine regression gate: **3856 pass, 0 regressions** (was 3853; +3 tests).
- Product suite: 84/84 (unchanged; presentation-only edit).

## Estimated effort
Automation/harness 1.0 · manual 6-system review 1.5 · fix + pin 0.5 ·
documentation 0.5 · **total ~3.5h**.

## Launch confidence
**Increasing.** The gate confirmed the assessment does not fabricate
technical authority — the failure mode is under-explanation, not
over-claiming, which is the safe direction to launch on and the right base
to build depth from. The one rendered-name defect that visibly dents
confidence is fixed. The remaining items are enhancement and catalog-data
work, cleanly separated from launch trustworthiness.

## Sign-off criterion
Six representative assessments reviewed across all five dimensions; the
required naming defect fixed and pinned; no fabricated claim found; deferred
items classified by cause. **Awaiting founder sign-off. Do not begin Gate 6
without approval.**
