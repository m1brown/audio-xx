# Gate 6 — Audiophile Assessment QA · Report

Date: 2026-07-25 · Baseline: d42c24a · Method: real artifact pipeline
(`runArtifactPipeline`) over a 30-system representative pool with automated
red-flag detection (component mis-identification, dropped/duplicated
components, cross-brand leakage, verdict/body contradiction), plus detailed
inspection of flagged cases. Full scan: quality-scan.txt; mis-ID detail:
misidentification-cases.txt.

## Recommendation: **FAIL**

The gate found its release-blocking class — **factual mis-identification of a
component** — on ordinary systems, including a mainstream budget system. This
is the certification process working: a genuine launch-blocker caught before
launch, not a paperwork defect.

## Scan result (30 systems)
13 clean · 9 low-confidence/null (the safe path) · **8 flagged**, of which
~6 are genuine user-visible component-graph corruption.

## The launch-blocking finding — G6-D1 (S1, launch-blocking)

**Component mis-identification on systems containing uncataloged models.**
The rendered system does not match what the user entered:

| System (input) | Rendered credit | Fault |
|---|---|---|
| WiiM Pro, **Fosi Audio V3**, Wharfedale Diamond 12.1 | WiiM Pro \| Wharfedale | **amplifier dropped** (3→2) |
| Bluesound Node, Cambridge AXA35, **Q Acoustics 3030i** | Bluesound Node \| Cambridge audio | **speaker dropped** (3→2) |
| Rega Planar 3, Sugden A21, **Spendor SP3/1R** | Rega Planar 3 \| Sugden A21 | **speaker dropped** (3→2) |
| Denafrips Ares II, **Rega Elex Mk4**, Spendor A7 | Denafrips Ares II \| **Ares Ii** \| Spendor | **amp mislabelled as a duplicate DAC** |
| dCS Vivaldi, Boulder 866, **Wilson Audio Sasha DAW** | dCS \| Boulder 866 \| Wilson \| **Wilson audio** | **speaker duplicated** (3→4) |

The first is a common entry-level system — exactly what a first-time visitor
would type — and it renders with the amplifier missing. A system shown with a
dropped or duplicated component is not defensible to an audio journalist, and
it fails "zero embarrassing."

**Root cause.** Same class as the Gate 5 knowledge-data finding, more
severe manifestation. When two or more models in a system are not in the
catalog, the deterministic subject matcher either (a) fails to match the
model at all (the component silently drops), or (b) mis-binds a brand token
to the wrong model via proximity assignment (duplication / cross-labelling).
The **low-confidence gate measures catalog *coverage*, not component-graph
*integrity*** — so a system whose brands resolve but whose models don't can
clear the confidence check and produce a confident, wrong assessment instead
of routing to clarification. The synthesizer's corruption guard catches some
cases (e.g. Technics/Marantz/Klipsch rendered correctly despite an internal
scramble) but not dropped or duplicated components.

## Other findings (not launch-blocking)
- **Bare-brand degradation** (Gate 5 G5-D3, already logged): KEF, Emt,
  Shindo, Klipsch, Parasound render as bare brands. Knowledge-data.
- **High null rate (9/30).** Many real systems (Naim/Naim/Neat, Audio Note
  trio, Cambridge Evo + B&W) route to low-confidence. This is the *safe*
  failure (no fabrication), but it is a coverage limitation worth tracking —
  provided the low-confidence UI is graceful (Gate 1 verified no empty
  screens; the low-confidence path shows a provisional/clarifying response).
- **Factual restraint holds.** No fabricated technical claims, no cross-brand
  content leakage (the apparent "ifi" leaks were a harness substring artefact
  in "amplifier", corrected). Consistent with Gate 5.

## Verdict/body coherence, F4, F5
No verdict-contradicts-body cases found (restraint verdicts on the flagged
systems are wrong because the *graph* is wrong, not because the verdict
contradicts its own body). Identical-reassessment decline / append is
suite-pinned (Gate 1).

## Why this is FAIL, not PASS WITH MINOR ISSUES
The plan's release-blocking line is categorical: "factual mis-identification
of a component; ... any output the founder would not defend." ~6/30 (20%)
show a wrong component graph on normal systems. That is the exact trust
failure the founder has repeatedly prioritised ("if Audio XX misidentifies
the signal chain, everything downstream becomes suspect"). Recording this as
a minor issue would be dishonest.

## Recommended remediation (for architectural decision — not implemented)
No fix applied in-gate: the correct fixes are engine-behaviour or knowledge
changes that warrant your approval under the freeze, and the gate loop is to
stop on a FAIL.

1. **Smallest safe mitigation (recommended first):** extend the
   low-confidence gate to check **graph integrity**, not just coverage —
   route to the existing clarification/low-confidence path whenever the
   resolved component count is less than the input component count, or the
   synthesizer's corruption guard fires, or ≥2 models are uncataloged. This
   converts a confident-wrong assessment into an honest "tell me a bit more",
   directly consistent with your approved principle: under-explain / ask
   rather than fabricate. Bounded, testable, no parser redesign.
2. **Knowledge-data:** add the common missing models surfaced here (Fosi V3,
   Wharfedale Diamond 12.x, Q Acoustics 3030i, Rega Elex, Sugden A21, Spendor
   A7/SP3/1R, Wilson Sasha, Parasound A21, KEF LS50 Meta, Klipsch La Scala).
3. **Do NOT** broaden into a general parser/NLP redesign.

Both 1 and 2 are launch-relevant. I recommend 1 as the launch gate (safety)
and 2 as ongoing coverage work.

## Automated results
- 30-system quality scan: 13 clean / 9 null / 8 flagged (evidence attached).
- Engine regression gate: 3856 pass, 0 regressions (no engine change this
  gate — the mis-ID is pre-existing behaviour on uncataloged systems, not a
  new regression).
- Product suite: 84/84.

## Estimated effort
Harness + red-flag detection 1.5 · manual case analysis 1.0 · documentation
0.5 · **total ~3h** (no fix effort — deferred to architectural decision).

## Launch confidence
**Decreasing.** This is the first gate to surface a launch-blocking
correctness defect. It does not undermine the earlier gates (billing,
privacy, analytics, editorial all hold), but it means the assessment cannot
go to public launch until systems with uncataloged models either resolve
correctly or route to clarification. The remediation is bounded and aligns
with the product's existing "don't fabricate" posture, so confidence is
recoverable — but it must be resolved, not deferred.

## Sign-off criterion
Zero embarrassing / ≥90% good: **not met** (≈20% show a wrong component
graph). **FAIL. Awaiting founder architectural decision on the remediation
path before Gate 7.**
