# Post-Fix Chrome QA — External-Review Readiness Assessment

Date: 2026-04-14
Environment: localhost:3000 (Next.js dev mode), Chrome MCP
Stance: strict, grounded in observed output

---

## TL;DR — Verdict

**One more cleanup pass needed.**

The three named blocker fixes are **verified** in the live Chrome environment:

- Blocker A (`_DEBUG` leak) — clean across all 6 Part 1 prompts.
- Blocker B (brand fusion) — no fused entities on the Bluesound / PrimaLuna / Harbeth canary.
- Blocker C ("Chord not in catalog") — gone; Chord is treated as a known brand with siblings.

However, the expanded pass surfaces four residual issues that an experienced external reviewer will hit inside the first ten minutes. None are new regressions caused by the blocker fixes, but they were not addressed by the blocker scope and they undermine trust in exactly the surfaces the blockers were supposed to clean up.

---

## Part 1 — Key-prompt retest (6 prompts)

### 1. `Denafrips Pontus II → Leben CS300 → Harbeth Super HL5 Plus. Assess my system.`
- Routing: SYSTEM REVIEW ✓
- `_DEBUG` / `dominant:` / `primary kind:` / `damping evidence:` — **none present** ✓
- Entity parsing: all three components intact ✓
- Bottleneck call-out is present and phrased in advisory register ✓

**Verdict: clean.**

### 2. `My system: Bluesound NODE X → PrimaLuna EVO 300 Integrated → Harbeth P3ESR. What should I upgrade?`
- First run (with a pre-existing saved "Livingroom" system in localStorage): chain rendered as `Bluesound NODE X → JOB Integrated → PrimaLuna EVO 300 Integrated → Harbeth P3ESR`. JOB was injected from saved state, not from the prompt. **Phantom saved-system override.**
- Second run (after `localStorage.clear()`): chain rendered as `Bluesound Node X → PrimaLuna Evo 300 Integrated → Harbeth P3esr`. No fusion, no JOB injection, no `_DEBUG`. ✓

The brand-fusion fix itself holds. The saved-system override behaviour is a separate issue (see Residual Issue 1) that the user explicitly called out as "no phantom saved-system override" — so it still counts against readiness.

### 3. `Tell me about the Chord sound`
- No `isn't in my catalog` / `not in catalog` ✓
- `catalogMatch` behaviour is correct: Chord is recognised with siblings ✓
- **Polish regressions on the brand-only copy path**:
  - Header rendered as `chordFPGA` (run-on, missing space and capitalisation)
  - Brand name appears as lowercase `chord` throughout the body ("chord designs FPGA components…", "the chord likely follows this direction")
  - This is visible, not hidden.

Blocker C is fixed at the routing/catalog level, but the copy that now runs through that path looks visibly unfinished.

### 4. `Rega Planar 3 + Hegel H95 + KEF LS50 Meta, everything sounds thin`
- Routing: SYSTEM REVIEW (diagnosis-aware) ✓
- No `_DEBUG` ✓
- Diagnosis content is reasonable and trade-off-aware
- **Entity issue**: header reads `With Planar 3 + KEF + Hegel + Rega` — Rega is listed as a distinct entity on top of the Planar 3, which is itself a Rega product. Brand-over-product duplication, and the order is not the chain order.

### 5. `Just picked up a Topping D90SE, curious what you think`
- No `_DEBUG` ✓
- No "not in catalog" ✓
- **Routing polish**: lands in `EXPLORATORY RECOMMENDATIONS` rather than `PRODUCT ASSESSMENT`, even though the user named a specific product they own. Content then reads as brand-level rather than product-specific.

### 6. `how's this system: speakers: wlm diva monitors - amp: job integrated - streamer: eversolo dmp-a6`
- No `_DEBUG` ✓
- No fusion ✓
- **Label-parsing failure**: the app replies "You described the Eversolo Dmp-a6 as an amplifier, but our data has it as a streamer." The user's prompt **explicitly** labelled it `streamer:`. The parser ignored the user's own label and then asked the user to defend the label it invented for them. This is a trust problem, not a catalog problem.

---

## Part 2 — Homepage example prompt (only one not covered by Part 1)

### `Best DAC under $2000 for a warm, musical system`
- Routing: shopping flow (BEST OVERALL / CLOSE ALTERNATIVE) ✓
- No `_DEBUG` ✓
- **Preference-protection / alignment issue**: "BEST OVERALL" is **Schiit Bifrost 2/64**, "CLOSE ALTERNATIVE" is **Chord Qutest**. Neither is a warm-musical DAC — Bifrost 2/64 is neutral delta-sigma-ish, Qutest is explicitly marketed for speed and transparency. Notable absences: Denafrips (Ares II / Pontus II), Holo Audio May/Spring, Border Patrol SE-i — the canonical "warm, musical" answers.
- This is a playbook violation: the recommendation does not reflect the user's stated priority ("warm, musical") and the language ("fast, decisive leading edges", "exceptional transient resolution") actively describes the opposite tilt.

---

## Part 4 — Modern product spot-check

### `What do you think of the LAiV uDAC?`
- No `_DEBUG` ✓
- LAiV recognised; uDAC routed through the Harmony-DAC sibling path ✓
- Body carries the correct "not in the Audio XX catalog" disclaimer, which is accurate for this specific product and does **not** contradict Blocker C (which was specifically about brand-only queries where the brand IS in catalog). This path is working as intended.

---

## Residual Issues — ranked by severity

### R1. Phantom saved-system override (blocker-adjacent)
When a saved system is present in localStorage, typing a **completely new** 3-component system still merges components from the saved system into the assessed chain. Reproducible on prompt #2 before `localStorage.clear()`. The user explicitly listed "no phantom saved-system override" as a pass criterion. This remains present.

### R2. `Tell me about the Chord sound` copy regressions (polish, but on a homepage example)
`chordFPGA` run-on header, lowercase `chord` throughout body. This is the exact prompt pinned to the homepage, so it is the first thing an external reviewer will click.

### R3. Eversolo label-parsing inversion
User says "streamer:", app says the user called it an amplifier. This is a direct quality-of-reading failure on a supported brand.

### R4. Entity-level duplication (Rega + Planar 3 treated as two things)
Reveals that the brand list and product list are not deduped against the user's system.

### R5. Topping D90SE routes to EXPLORATORY instead of PRODUCT ASSESSMENT
Minor — lowers the perceived precision of the advisor for named-product prompts.

### R6. DAC-under-$2000 warm/musical recommendation is misaligned
Playbook calls this a preference-protection + confidence-calibration failure. Visible and on a homepage example.

---

## What's working well

- Blocker A fix holds across every system-review rendered; no instrumentation leaked.
- Blocker B fix holds with no saved-system contamination — the embedded-brand detection correctly anchors `Bluesound NODE X` to Bluesound and `PrimaLuna EVO 300` to PrimaLuna, and nothing pulls Harbeth or DeVore across products.
- Blocker C fix holds — brand-only Chord query no longer claims the brand is missing.
- Diagnosis mode ("everything sounds thin") is engaged when the user reports a problem.
- Shopping flow produces a structured BEST OVERALL / CLOSE ALTERNATIVE format without `_DEBUG`.

---

## Blockers vs. polish — the call

Under a strict rubric:

- **Blockers (reviewer will stop trusting the product)**: R1 (phantom saved-system override), R2 (Chord copy regression on a homepage example), R3 (Eversolo label inversion).
- **Polish (reviewer will note but not disqualify)**: R4 (Rega/Planar 3 dedup), R5 (Topping routing), R6 (warm-DAC misalignment).

R1–R3 each sit on a surface the Chrome QA was specifically supposed to clean up — saved-system interaction, the pinned homepage Chord example, and explicit labelled-system parsing. R1 was called out by the user as a pass criterion. R2 and R3 make the advisor look like it doesn't read carefully — which is the single worst impression for a guide whose whole identity is "private advisor".

---

## Final verdict

**One more cleanup pass needed.** The three named blockers are verifiably fixed. Ship-blocking residuals are R1, R2, and R3. None requires engine redesign — R1 is a reset/merge policy question, R2 is a capitalisation/spacing pass on the brand-only template, R3 is honouring explicit `role:` labels in the parser.

Recommend a tight, scoped third pass targeting R1–R3, then re-run Part 1 items 2, 3, and 6. After those are green, the app is ready for trusted external review.
