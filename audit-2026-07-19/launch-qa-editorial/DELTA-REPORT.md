# Editorial Improvements — Benchmark Delta Report

**Date:** 2026-07-19 · **Baseline:** `audit-2026-07-14/launch-qa-100/responses.json` (106 prompts, captured at `fc609d1`) · **After:** `audit-2026-07-19/launch-qa-editorial/responses.json` (same 106 prompts, same harness, editorial-pass engine).

**Method:** the engine was changed, then the entire benchmark was rerun through the unchanged harness (`run-benchmark.test.ts`; only the output directory constant was date-bumped). No benchmark response was hand-edited. Every delta below is the engine producing different output for the same input.

---

## Headline numbers

| | |
|---|---|
| Rows byte-identical | **88 / 106** |
| Rows materially changed | **18** |
| Routing changes | **2** (SA-03, SA-13: `system_assessment→clarification` → `system_assessment`) |
| New test failures vs pre-change baseline | **0** (3,644 passing; 44 pre-existing failures unchanged) |

Changed rows: SA-01, SA-02, SA-03, SA-04, SA-05, SA-06, SA-09, SA-10, SA-11, SA-12, SA-13, UP-02, UP-03, UP-04, SM-01, EC-03, EC-04, CG-01. All are system-assessment / consultation-path rows — exactly the surface the seven priorities target. The 42 knowledge-lane rows are unchanged in this capture (the harness records the lane scaffold, not the LLM call), but the lane's system prompt now carries the hedging and one-memorable-insight instructions, so live responses change too.

## Ontology-leak vocabulary — rows containing each term

| Term | Before | After |
|---|---|---|
| "detail-first" (as system identity) | 6 | **0** |
| "tone-first" | 4 | **0** |
| "microdetail" | 5 | **0** |
| "control emphasis" | 2 | **0** |
| "detail emphasis" | 4 | **0** |
| "no dominant bias" | 1 | **0** |
| "prioritising \<trait\>" openers | 12 | **0** |
| "tonal density" | 12 | **2**¹ |
| "harmonic density" | 9 | **3**¹ |
| "dominate throughout" (flat certainty) | 10 | **0** |
| "signal-flow order" clarification | 2 | **0** |

¹ Remaining occurrences are descriptive catalog/brand prose used in ordinary-audiophile context (e.g. Denafrips product philosophy "rich tonal density, strong harmonic texture"), not taxonomy labels. Left in place as data, not template.

## Why the responses changed — mechanism per priority

**P1 — ontology leakage.** Recon found no central vocabulary table: five independent composers each mapped axis positions to internal trait names inline. Fixes: `buildIntroSummary`'s trait list now emits plain language (warm → "warmth and body", detailed → "fine detail", controlled → "grip and composure"); the stacked-trait tables (`CHARACTER_EXPLANATIONS`/`IMBALANCE_EXPLANATIONS`) were rewritten in observable-consequence language; the pinned listener-archetype sentences dropped "harmonic density"/"elasticity" jargon; scattered emitters in `product-assessment.ts`, `reasoning.ts`, `memo-deterministic-renderer.ts`, `emergent-behavior.ts`, and `shopping-intent.ts` were cleaned. Internal `STACKED_LABELS` keys were **preserved** (downstream reasoning keys off them) and are now translated only at print time via the existing `listenerPropertyLabel` presentation function — the ontology and evidence model are untouched.

**P4 + the contradictory-identity class (SA-01/02/04/09/12, EC-03).** Root cause of "identity soup": the intro derives system identity from system-wide axes, while the System read derived a *second* independent identity from upstream components only ("This is a detail-first system…"), plus a third from the archetype table. Fix: exactly one identity claim (the intro, "what this system is"); the System read sentence is recast as the causal explanation ("The Hegel H190 leans toward resolution and precision, reinforced by the Harbeth SHL5+" — "why it behaves that way"); the follow-on sentence states the listening consequence ("what that means"). Same signals, same order, one voice — the contradiction mechanism is gone without touching how identity is inferred.

**P2 — unsupported certainty.** The narrative composer's flat declaratives are now calibrated: "dominate throughout" → "In practice, expect … to lead the presentation"; "Change it and the entire system opens up" → "should open up"; "limits what the rest of the chain can deliver" → "likely limits…"; "the effect is strong and unambiguous" → "should be consistent and easy to hear". Evidence-backed bottleneck statements (severity-gated) retain confident phrasing — hedging is applied to predictions, not to observations.

**P3 — forced weakest link.** Two mechanisms fixed. (a) The tier-gap heuristic (price-tier comparison with no trait deficiency) previously hard-coded "it is the weakest link in the system" and drove a CHANGE verdict — the SA-09 mechanism. It now reads as headroom, not fault: "Nothing here is misbehaving — but the X is the most modest piece in the chain… the natural place to look when you next feel like upgrading", with matching Primary-leverage, Decision ("CHANGE the amp only when you're ready for an upgrade — nothing is wrong"), and Action-path phrasing. (b) When *no* bottleneck exists, Primary leverage previously nominated the DAC anyway ("Change it and the entire character shifts") — the SM-01 mechanism. It now says "None — no obvious bottleneck… changes are a matter of taste rather than correction", and the Decision line frames any change as preference, keeping the DAC only as a taste pointer.

**P5 — causal recommendations.** The bottleneck action path already emitted an expected-change clause derived from the constrained axes ("Expect more …"); the tier-only path now gets an honest one ("Expect the rest of the chain to show more of what it can already do") instead of the generic "more depth, more texture, more space". Upgrade-path rationales now speak in listener terms via the same label translation.

**P6 — infer ordinary systems (SA-03, SA-13).** The chain-order-ambiguity clarification fired whenever a comma-listed system contained a same-brand pair or an uncatalogued brand and canonical ordering failed — i.e. exactly on ordinary systems. The gate's question is removed: the engine now assumes standard signal flow and proceeds to a full assessment. Genuine ambiguities that change the answer (two DACs, two amps, role-label conflicts) are still caught by the unchanged duplicate-role and role-conflict checks. Both rows now produce complete assessments; two clarification dead-ends are eliminated.

**P7 — teach something.** For the deterministic path this pass leans on the causal System read (the "the Node sets the ceiling"-style observation now has a dedicated sentence slot). For the 26+ knowledge-lane prompts, the lane's system prompt now instructs: present hypotheses as hypotheses, and "leave the reader with one memorable insight — a single observation they could repeat to a friend" — woven into prose, never labelled.

## Recurring failure classes — expected reduction (against the 2026-07-14 red list)

| Failure class | Red IDs affected | Status after rerun |
|---|---|---|
| Contradictory identity / ontology soup | SA-01, SA-02, SA-04, SA-06, SA-09, SA-11, SA-12, UP-02, UP-03, UP-04, EC-03 | Single identity claim, plain vocabulary, hedged — the specific quoted failures ("detail-first" vs "harmonic richness and tonal density"; "no strong lean" beside "warmth and body dominate") can no longer be produced by these templates |
| Signal-flow clarification on obvious systems | SA-03, SA-13 | Both now route to full assessments |
| Forced CHANGE verdicts | SA-09 (tier-gap), SM-01 (no-bottleneck DAC nomination) | Reframed as upgrade direction / taste; no manufactured hierarchy |
| SA-05 (Cornwall + Decware SET) | partial | Still recommends changing the amplifier, now hedged ("likely limits") — but this verdict comes from the evidence model (top-end air / detail deficit scoring), not from presentation. Teaching the engine that 2W SETs on 102 dB horns are the point is a knowledge-data change, out of editorial scope. Flagged as the next candidate fix. |
| Single-product collapse (SA-14, EC-02), diagnosis questionnaire (TS-04/05/06, RS-03), price anchors (PD-07, SM-04, CG-06, VG-04), empty shopping (LS-02/03, CG-04) | unchanged | These live in subject recognition, the diagnosis knowledge base, and shopping ranking — reasoning/data layers explicitly preserved by this pass. They are mapped (file:line) and ready if prioritised. |

## Discipline check

- Ontology, assessment architecture, evidence model, benchmark harness: **unchanged.** The one regression risk found mid-pass — stacked-trait labels feed downstream reasoning — was caught by tests and resolved by keeping internal labels stable and translating only at print time.
- Full suite: **0 new failures** (44 pre-existing failures on the untouched baseline remain, unrelated to this pass).
- 7 test files updated only where they asserted the old template strings verbatim.
