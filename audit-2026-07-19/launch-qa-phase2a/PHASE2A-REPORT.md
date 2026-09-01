# Phase 2A — Surface Existing Knowledge: Validation Report

**Date:** 2026-07-19 · **Baseline:** `audit-2026-07-19/launch-qa-editorial/responses.json` (post-editorial-pass engine) · **After:** `audit-2026-07-19/launch-qa-phase2a/responses.json` (same harness, knowledge-utilisation engine). No benchmark response hand-edited; every delta is the engine.

## What was built (objectives 1–7)

- **Evidence extraction (new, in `extractMemoFindings`):** three findings fields — `componentEngineering` (compact per-component engineering descriptor from catalog `architecture` + strongest character tendency), `pairingEvidence` (stored interaction observations matched against the ACTUAL partners in the chain: named-partner matches, condition-class matches requiring role-family + axis/topology agreement, system-level condition matches, and cross-mentions in curated pairing prose), `transparencyDeclared` (components whose entry declares a zero-contribution design goal).
- **Narrative consumption:** System-logic rows now print the product's engineering descriptor instead of axis vocabulary (falling back to axis templates for brand-only components); the System read carries at most one matched positive pairing observation; a matched caution becomes a Trade-offs bullet; a transparency-declared upstream component gets a causal thesis ("engineered to add essentially nothing of its own, so the speakers set the tonal character").
- **Reasoning-consistency repair:** transparency-declared components are excluded from stacked-bias attribution and from the definitional trait-derived tonal rules (low warmth/density/overdamping) in constraint detection. Physical rules (power match, portable-DAC-in-speaker-system) still apply to them.
- **Alias resolution:** owner shorthand now reaches canonical entries at both layers — subject recognition (`SHL5+`, `SHL5 Plus`, `Linton`) and catalog attach (`CATALOG_NAME_ALIASES`: SHL5 family, SuperNait, Linton, Heresy, Kanta; plus `MODEL_ALIASES` in `catalog/lookups.ts` for the free-form lookup path).

## Benchmark delta

| | |
|---|---|
| Rows byte-identical | **93 / 106** |
| Rows changed | **13** (SA-01/02/05/06/09/10/11/13, UP-02/03/04, SM-01, EC-03 — all assessment-path) |
| Routing changes | 0 |
| Corpus length | **+3.1%** (evidence added only where it explains this system; density up, length ~flat) |
| Rows with a documented pairing match | **6** (was 0) |
| Rows with a documented caution | **4** (was 0) |
| Rows with engineering descriptors in System logic | **11** (was 4) |
| New test failures vs baseline | **0** (one over-broad dedup regex scoped to its actual intent) |

## Examples (verbatim from captures)

**Interaction knowledge, used as explanation (SA-10, Leben + Pontus + DeVore).** System read now ends: *"The Leben CS600X paired with DeVore O/96 is a documented match: one of the most celebrated pairings in modern high-efficiency audio — strong musical flow, natural tonality, and non-fatiguing presentation."* This sentence existed in the catalog through three benchmark rounds and had never rendered.

**Engineering over axis language (SA-01).** System logic before → after:
- `Hegel H190 → tone-rich, resolving, high control` → `Hegel H190 → Class AB solid-state with SoundEngine2, 150W into 8Ω`
- `Harbeth SHL5+ → tone-rich presentation` (brand-level) → `Harbeth Shl5+ → BBC-tradition thin-wall ported box` (full product entry attached via alias fix)
- `Bluesound NODE → tone-rich, smooth` → `Bluesound NODE → ARM-based network streamer with integrated ESS Sabre DAC`

**Objective 4's exemplar shape (JOB + WLM + Hugo).** The read now carries: *"The JOB Integrated paired with warm or dense sources and speakers is a documented match: the speed and transparency let upstream warmth through without softening it"* — the JOB's low coloration explaining why the WLM's character stays dominant — plus a documented caution in Trade-offs (*"in systems already lean or analytical: may feel too bare — the minimalist approach doesn't add body or richness"*).

**Consistency repair (AHB2 + KEF, off-benchmark trace).** Before: System read called the AHB2 transparent while Primary leverage said it "limits tonal ease… Change it." After: thesis states *"The Benchmark AHB2 is engineered to add essentially nothing of its own, so the KEF sets the system's tonal character"*; the constraint reframes as system-level balance; Decision says no component demands change; and the documented caution carries the real risk (*"the amp will not soften or buffer upstream harshness — if the DAC or recording is edgy, you will hear it"*).

## Remaining unused knowledge

- **`componentReadings`** — the full per-component expert paragraphs (the Hugo's 26,368-tap FPGA story) are still built and still unrendered in `system_review`. Phase 2A pulls their strongest facts into the narrative; the paragraphs themselves remain the largest untapped reserve (a UI change, deliberately left out of this engine-side phase).
- **`brandProfile.philosophy` / house-voicing / philosophy-pilot tables** — brand-level engineering mechanism prose still unconsumed on the assessment path (only `pairingNotes` cross-mentions are now used).
- **Numeric trait magnitudes** — reasoning still operates on ternary axes; 0.71 vs 1.0 warmth remain indistinguishable.
- **Emergent-behavior templates** — still fire generic transform prose for some warm chains ("speed is converted into elastic motion") regardless of fit.
- **The LLM overlay** — still generates three fields suppressed in `system_review` (unchanged cost, unchanged waste).

## Remaining reasoning bottlenecks

- **Coverage cliff drives residual errors, not wiring:** SA-05 (Cornwall + Decware) still recommends changing the amp because the Cornwall IV has *no catalog entry* — its 102 dB sensitivity is unknown, so both the power-match logic and the Decware's own "94dB+ speakers → comes alive" interaction cannot fire. The conservative matcher correctly refused to claim a match it couldn't verify. This is now cleanly a knowledge-authoring item (add the Cornwall entry), not an engine item.
- Products absent from the catalog (KEF LS50 Meta, Rega io, Yamaha/Q Acoustics budget lines) still degrade to brand-level or drop out of extraction; aliases can't fix absence.
- Sensitivity numbers still missing for 20/38 speakers, keeping power-match reasoning dark for those chains.
- Extraction still occasionally shortens multi-word names before lookup; the alias tables patch the observed cases, but the extraction layer has no general model-name recovery.

**Discipline check:** every added sentence is either a documented interaction that applies to this exact chain, a caution about this exact chain, or an engineering fact standing in the causal slot of a sentence that already existed. Nothing renders as standalone trivia; corpus grew 3.1%.
