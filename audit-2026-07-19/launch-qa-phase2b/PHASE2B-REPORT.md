# Phase 2B — Evidence-Aware System Synthesis: Validation Report

**Date:** 2026-07-19 · **Baseline:** `audit-2026-07-19/launch-qa-phase2a/responses.json` · **After:** `audit-2026-07-19/launch-qa-phase2b/responses.json`. Same harness, no hand-edits; ontology, evidence model, routing, workflow, and all Phase 2A improvements preserved.

## What was built — judgement, not information

- **Evidence selection budget (P1/P5/P6).** Every component still has an engineering descriptor available; the composer now *scores* each for how much it explains this system (constraint target +3, appears in matched pairing evidence +2, distinguishing technology/numbers +1, bare category labels penalised) and spends the budget on the **top two**. The rest keep terse axis behaviour. A response shows the facts that carry the story and omits the rest.
- **Interaction before description (P3).** The System-logic effect column now names the actual partner when the chain makes it unambiguous: "low coloration — passes the Eversolo's character through intact", "reinforces the direction the Leben sets" (the named tone-setter is the component that actually sets the system lean — a neutral source that "stays out of the way" can no longer also "set the direction"). Partners are referenced by brand, reviewer-style, so each full name appears exactly once.
- **Memorable-insight slot (P10).** Exactly one per assessment, rule-ordered: a documented pairing match or transparency thesis already in the read counts as the insight; otherwise, if the speaker's entry declares room sensitivity, the Do-nothing check closes with it ("One thing likely to matter more than any component swap: with the Boenicke W5, compact cabinet means bass thins significantly in larger rooms…"). Verified live; suppressed whenever evidence already carries the insight.
- **No decoration (P6).** The boilerplate "Check system fit for your listening habits" bullet — present in **all 16** assessment responses — is gone unless the list would otherwise be empty. Subject-verb agreement fixed in the logic summary ("Hegel H190 pushes toward precision").

## Benchmark delta (vs Phase 2A)

| | |
|---|---|
| Rows byte-identical | **90 / 106** |
| Rows changed | **16** |
| Categories affected | system_assessment 11, upgrade 3, speaker_matching 1, edge_case 1 |
| Routing changes | 0 |
| Corpus length | **−0.6%** (shorter *and* more explanatory — the success criterion in one number) |
| Filler bullets | 16 rows → **0** |
| Partner-named interaction effects | **10 rows** |
| New test failures vs baseline | **0** |

## Before/after examples

**SA-01 (Harbeth SHL5+ / Hegel / Node) — System logic:**
> *Before:* `Hegel H190 → Class AB solid-state with SoundEngine2, 150W into 8Ω → preserves upstream character` · `Bluesound NODE → ARM-based network streamer with integrated ESS Sabre DAC → adds warmth from the source stage`
> *After:* `Hegel H190 → Class AB solid-state with SoundEngine2, 150W into 8Ω → carries the Bluesound's character forward` · `Harbeth Shl5+ → BBC-tradition thin-wall ported box → reinforces the direction the Bluesound sets` · `Bluesound NODE → tone-rich, smooth → adds warmth from the source stage`

Three judgement calls visible at once: the rows now describe *relationships*; the Node's ESS-chip spec — true but explaining nothing about this warm system — lost its budget slot to the SHL5+'s thin-wall cabinet (the actual counterweight); and the summary agrees grammatically.

**SA-02 (JOB / WLM / Eversolo):** the Eversolo's truncated spec dump ("network streamer (ESS ES9038Q2M internal DAC available but t…") was replaced by "clean, neutral feed" — the selection budget removed a malformed, low-value note and the row now says what matters: the JOB "passes the Eversolo's character through intact."

**SA-10 (Pontus / Leben / DeVore):** the Leben keeps its KT77/KT88/EL34 tube-swap note and the DeVore its wide-baffle note (both in the documented-pairing story); the Pontus drops to the axis phrase. The chain reads causally: Pontus anchors warmth → Leben carries it forward → DeVore reinforces the direction the Leben sets.

## Examples where no change was appropriate

90 rows are byte-identical — including every shopping, diagnosis, knowledge-lane, and comparison row (the changes are scoped to assessment synthesis), and assessment rows where Phase 2A's output already met the bar. Notably, systems whose read already carries a documented pairing (SA-02's JOB/WLM match) received **no** additional insight sentence — the one-insight budget held. The AHB2 trace case is unchanged from Phase 2A: its transparency thesis *is* the memorable insight, so nothing was added.

## Remaining reasoning bottlenecks

1. **Coverage, not judgement, drives the residual errors.** SA-05 (Cornwall + Decware) is unchanged: without a Cornwall IV catalog entry the 94 dB+ interaction cannot verify. One authored entry resolves the benchmark's worst residual red.
2. **Emergent-behavior templates** still emit the same transform prose for some warm chains regardless of fit ("speed is converted into elastic motion" on the all-warm Pontus/Leben/DeVore system) — the one remaining section whose evidence-selection is template-driven rather than judged.
3. **Ternary axes** still cap how finely the tone-setter/counterweight roles can be assigned (0.71 vs 1.0 warmth identical).
4. Possessive of s-ending brands renders as "the Denafrips's" — grammatically defensible, slightly awkward; cosmetic.

## Remaining knowledge gaps (unchanged from 2A, now the binding constraint)

Cornwall IV, LS50 Meta, Rega io and budget-brand entries absent; sensitivity missing on 20/38 speakers; `componentReadings` still unrendered in the UI; brand philosophy/house-voicing tables still unconsumed; the suppressed LLM overlay still runs.

**Success criteria check:** stronger causal explanations (partner-named chains, tone-setter coherence) ✓ · better evidence selection (budget demoted 3 low-value notes, kept story-carrying ones) ✓ · more coherent narratives (no self-contradicting rows) ✓ · educational value (insight slot, documented pairings) ✓ · length: −0.6% ✓ · editorial quality: zero new certainty/ontology regressions, 0 new test failures ✓.
