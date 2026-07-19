# Audio XX — Technical Depth Investigation

**Date:** 2026-07-19 · **Type:** Diagnostic (no changes made) · **Method:** knowledge inventory (all data sources), reasoning-consumption map (field-by-field), and live pipeline traces of four systems built from the six reference products (Job Integrated, WLM Diva, Harbeth SHL5+, Chord Qutest, Naim SuperNait 3, Benchmark AHB2) capturing knowledge → findings → rendered output at each stage.

---

## Executive summary

**Audio XX already possesses most of the expert knowledge its responses fail to show. The dominant limitation is not what the system knows — it is that the pipeline throws the knowledge away in two places: the reasoning layer collapses every component into four ternary adjectives before composing prose, and the presentation layer never renders the one artifact that carries product-specific expertise.**

The single most important finding, verified live: for the system "Chord Hugo + Job Integrated + WLM Diva," the engine *builds* this paragraph —

> "The Chord Hugo — Introduced in 2014, the original Hugo was the first portable application of Rob Watts' FPGA pulse array architecture. It runs a 26,368-tap filter on a Xilinx Spartan-6 FPGA — far beyond what off-the-shelf DAC chips implement — to achieve timing precision at the microsecond level…"

— attaches it to the response as `componentReadings`, and then **never displays it**. The `system_review` renderer reads only the flattened narrative (`systemContext`), whose System-logic row for the same component is:

> "Chord Hugo → resolving, high flow conversion → defines the tonal center"

That is the technical-depth gap in one example. The expertise exists, is assembled per-request, and is discarded at the render boundary. The same pattern held in all four traced systems (AHB2's "feed-forward error correction… lowest noise and distortion of any consumer amplifier by measurement"; Leben's "~32W, switchable KT77/KT88/EL34… one of the most celebrated pairings in modern audio with the DeVore O/96"; DeVore's "voiced for single-ended triodes and low-power tubes (2–30W)" — all built, none rendered).

Root-cause allocation (estimated relative contribution to the observed depth gap):

| Class | Contribution | One-line statement |
|---|---|---|
| **C. Editorial deficit** | **~45%** | The rich per-component readings are built but unrendered in `system_review`; the rendered narrative is composed exclusively from axis-bucket templates |
| **B. Reasoning deficit** | **~30%** | Reasoning consumes a 4-ternary-axis projection of the data; numeric trait magnitudes, tendency prose, interaction conditions, and brand philosophy are never reasoned over |
| **A. Knowledge deficit** | **~20%** | No measured values anywhere; hard specs sparse (sensitivity on 18/38 speakers); knowledge fragmented across 2 catalogs + 7 side-tables with contradictions; one resolution failure hides an entire product entry |
| **D. Prompting deficit** | **~5%** | The narrative body is fully deterministic — no prompt to fix; the one LLM overlay writes three fields the `system_review` UI suppresses (a wiring issue, counted under C) |
| **E. Other** | — | Nothing observed outside the four classes |

**The implication for sequencing is direct: knowledge enrichment is the *third* priority, not the first.** Rendering and reasoning changes surface existing expertise at near-zero data cost; enrichment done first would pour new knowledge into the same funnel that discards it.

---

## Pipeline analysis — where technical richness enters, and where it is lost

```
KNOWLEDGE          RESOLUTION        REASONING              SYNTHESIS               RENDER
158-product        subject match →   classifyComponentAxes  componentParagraphs     RewrittenSystemReview
catalog (rich) ──► catalog lookup ─► [LOSS 2: 12 numeric    (RICH — consumes        reads ONLY systemContext
61 brand profiles  [LOSS 1: alias    traits + prose →       character + design-     [LOSS 4: componentReadings
7 side-tables      gaps drop to      4 ternary buckets] ──► Family prose) ──►       never rendered]
2 YAML seeds       brand level]                             composeAssessment-
                                                            Narrative
                                                            [LOSS 3: all sections
                                                            re-derived from ternary
                                                            axes only]
```

**Richness enters at the catalog.** The 158-entry catalog is genuinely deep on the qualitative side: 100% of products carry `architecture` prose and 4-axis positions, 94% carry graded tendency profiles with provenance (`review_consensus` 653 trait-lines, `founder_reference` 61…), 87% carry structured tendency prose including condition→effect interaction entries, 83% cite sources. Five of the six reference products have strong entries; several (Qutest is marked "PRIORITY ANCHOR" with ~30 lines of calibration reasoning) are excellent.

**Loss 1 — Resolution (small but sharp).** "Harbeth SHL5+" in a user message resolves only to the *brand* (confidence: low), even though `harbeth-shl5-plus` exists in the catalog — the entry is named "Super HL5 Plus" and no alias bridges the gap. The trace shows the consequence: the SHL5+ system rendered from generic brand text while a full product entry sat unused. Knowledge present, not retrieved.

**Loss 2 — The axis collapse (structural).** `resolveProductAxes` (axis-types.ts:168) reduces each component to 4 ternary labels in one line: `return product.primaryAxes ?? inferAxesFromTraits(product.traits)`. After this point, a product with `tonal_density 0.71` and one with `1.0` are identical; when `primaryAxes` is present, the 12 numeric traits are not read at all. The tendency prose is consumed only as a boolean (`hasTendencies`) to pick a paragraph branch.

**Loss 3 — Template synthesis.** Every sentence of the rendered 7-section narrative (System read, System logic, Primary leverage, Decision, Trade-offs, Next steps, Do-nothing) is derived from the ternary axes plus role. `deriveComponentBehavior`: `warm → 'tone-rich'`, `controlled → 'high control'`. Any two warm amps produce the same System-logic row; every warm system produces "a warm, full-bodied tonal balance." The interaction data — including named-partner knowledge like Leben↔DeVore — is never consulted here. (The two exceptions that *do* reach the narrative: power/sensitivity match notes, and `tendencies.interactions` surfaced via `surfaceAmpSpeakerInteraction` — but sensitivity is absent for 20 of 38 speakers including both traced speaker anchors, so the power path usually cannot fire.)

**Loss 4 — The render boundary (the big one).** `componentParagraphs` (consultation.ts:9146) is the one composer that weaves `character` prose + `designFamily` knowledge into expert-level per-component paragraphs. It is attached to every response as `componentReadings` (memo-deterministic-renderer.ts:754). The `system_review` UI path (`AdvisoryMessage.tsx` → `RewrittenSystemReview`) reads **only `systemContext`** — zero references to `componentReadings` in its entire body. The only product-specific prose that survives to the user is the one-line `product.description` on the Component-Contributions cards.

**LLM involvement:** none in the narrative body. The gpt-4o overlay fires on every assessment but refines only `introSummary`/`keyObservation`/`recommendedSequence` — all three gated off in `system_review` rendering. So its output is generated and paid for, then suppressed. The provisional LLM path fires only for low-confidence (uncatalogued) systems.

---

## Evidence (selected; all reproducible)

**E1 — Built but unrendered (all four traces).** Benchmark AHB2 `componentReading`: "Lowest noise and distortion of any consumer amplifier by measurement. The design goal is zero contribution… a warm R-2R DAC sounds warm through it, an aggressive delta-sigma sounds aggressive." Rendered System-logic row: "Benchmark AHB2 → high control, low coloration → preserves upstream character."

**E2 — Interaction knowledge ignored by reasoning.** The Leben CS600X entry contains "One of the most celebrated pairings in modern audio with the DeVore O/96"; the DeVore entry contains "Voiced for single-ended triodes and low-power tubes (2–30W). A natural tube partner." The rendered narrative for exactly that pairing says: "Denafrips Pontus II 12th-1 and Leben CS600X and DeVore Orangutan O/96 reinforce the same direction." The single most quotable expert fact about this system is in the data and absent from the answer.

**E3 — Reasoning contradicts its own knowledge.** For AHB2 + KEF LS50 Meta, the stacked-control heuristic nominated the AHB2 as the constraint ("limits tonal ease and forgiveness… Change it"), while the AHB2's own entry says its design goal is zero contribution and its fatigue note says fatigue "is almost always caused by what's upstream." The reasoning never reads those fields, so it cannot be corrected by them.

**E4 — Knowledge is qualitative, not quantified.** Across all 158 products there is no structured field for any measurement (SNR, THD, damping factor, output impedance, driver complement, crossover, tap count). The AHB2 — the best-measuring amp in consumer audio, and the catalog's most technical entry — carries no number at all. Expert-expected facts absent for the six: Qutest's WTA tap count and output stage; SHL5+'s ~86 dB sensitivity, RADIAL2 driver, and super-tweeter complement; the Diva's sensitivity and driver material; SuperNait's damping/output-stage detail; JOB's power rating.

**E5 — Fragmentation and contradiction.** The same product can be described in up to 6 places (catalog entry, brand profile, house-voicing capsule, philosophy pilot, topology table, YAML seed) with no reconciliation. The JOB Integrated is "no added warmth" (catalog, tonal_density 0.4) and "unexpected warmth… a glow" (components.yaml) and "slightly golden tonality, almost tube-adjacent" (brand profile) simultaneously.

**E6 — Coverage cliff behind the flagships.** Harbeth SHL5+ — a canonical audiophile speaker — has the thinnest product entry of the six (no tendency prose, no interactions, no fatigue assessment) even while Harbeth has the *deepest brand-level* coverage in the codebase. Per-model pairing capsules exist for exactly 4 speakers. `PRODUCT_SIGNIFICANCE` is an intentionally empty map; the nascent `knowledge/` JSON layer contains 3 draft files.

---

## Recommendations

### Immediate (days; no new knowledge required; each passes the Product Test directly)

1. **Render `componentReadings` in `system_review`.** One UI change in the rewritten-review renderer. Every assessment immediately gains 2–4 expert-level per-component paragraphs that are already being generated on every request. This is the highest depth-per-effort move available anywhere in the system.
2. **Surface matched interaction facts in the System read.** When a component's `tendencies.interactions` condition matches the actual partner in the chain (or a `pairingNotes`/pairing-capsule names the partner), quote it — "the Leben and DeVore are one of the most celebrated pairings in modern audio" is a sentence customers screenshot. The data is condition-tagged; a first version can match on partner category/topology.
3. **Close the resolution gap.** Add model aliases (SHL5+/Super HL5 Plus and a sweep for similar mismatches) so existing product entries are actually found. A one-day audit of PRODUCT_NAMES vs catalog names likely recovers several "thin" assessments.

### Medium-term (weeks; reasoning consumes what it already has)

4. **Let the System-logic rows draw from `tendencies.character` when present**, falling back to axis templates only when it isn't. This replaces "resolving, high flow conversion" with the product's actual stored character, per component.
5. **Feed `architecture`/`notes` facts into the "why it behaves that way" sentence** — the causal slot created by the editorial pass is the natural home for "the Qutest's FPGA filtering is why the top end resolves without etch."
6. **A knowledge-consistency check in reasoning:** a component whose entry declares "zero contribution by design" (or `fatigueAssessment` pointing upstream) should be protected from being nominated as a tonal constraint (the AHB2 case, E3). This is a small gate, same family as the existing voicing-coherence gates.
7. **Fill the two cheap structured fields:** `sensitivity_db` for the 20 uncovered speakers, `power_watts` for the 7 uncovered amps — this alone re-arms the power-match reasoning (currently dead for half of speaker systems).
8. **Stop paying for suppressed LLM output:** either render the overlay's three fields in `system_review` or skip the call in that mode.

### Long-term (architectural)

9. **Unify the knowledge layer.** One per-product knowledge record (the `knowledge/` JSON schema already drafted is the right shape), consolidating the catalog entry + brand tables + YAML seeds, with a reconciliation pass for contradictions (E5). Add structured spec fields (sensitivity, impedance, power, topology detail, key measurements) so facts become reasonable rather than only quotable.
10. **Interaction graph.** Grow the 4 authored pairing capsules toward a real per-model pairing layer, prioritised by what users actually ask (benchmark + production query logs tell you which pairs matter).
11. **Depth-aware synthesis.** Once 1–8 are in, the composer should choose *what to explain* based on which knowledge is strongest for this system (a topology story for the Qutest system, a pairing-tradition story for Leben/DeVore, a measurement story for the AHB2) — that is what makes each assessment read like it was written by someone who knows *these* components, which is the product differentiation P7 pointed at.

## Proposed roadmap

**Phase 1 (render what exists): items 1–3.** Editorial-layer only, no data work, no reasoning risk; transforms perceived depth in days. Verify against the benchmark + the review tool.
**Phase 2 (reason over what exists): items 4–8.** Presentation-adjacent reasoning changes plus two cheap data fills; each independently testable against the 106-prompt benchmark.
**Phase 3 (enrich and unify): items 9–11.** Only now does new knowledge authoring pay full freight, because the pipeline no longer discards it.

The investigation directly contradicts the intuitive "write richer component data first" instinct: **the funnel, not the reservoir, is the constraint.** Fix the funnel (Phases 1–2), then fill the reservoir (Phase 3) — and every hour of future knowledge authoring will surface in customer-visible responses instead of dying in an unrendered field.
