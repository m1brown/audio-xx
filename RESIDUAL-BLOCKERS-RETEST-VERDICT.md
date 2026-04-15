# Residual Blockers (R1–R3) — Chrome Retest Verdict

Date: 2026-04-14
Scope: Live Chrome retest only. No code changes. Verdict on whether R1, R2, R3 are cleared in user-visible behavior, and ship-readiness recommendation for trusted external review.
Method: Next.js dev server at `localhost:3000`; three prompts submitted via the in-app composer; rendered output read from the DOM.

---

## TL;DR

| Blocker | Stated failure | Live-Chrome result | Verdict |
|---|---|---|---|
| R1 | Phantom saved-system injection of JOB/Chord/WLM into a typed chain | Saved and cleared runs render **identically**. No JOB/Chord/WLM in the chain. | **CLEAR** |
| R2 | `chord` / `chordFPGA` lowercase run-on in brand-only header/body | Header reads **"Chord· FPGA"**; body reads **"Chord designs FPGA components…"** throughout. | **CLEAR** |
| R3 | Eversolo DMP-A6 labeled as "amplifier" against explicit `streamer:` | Eversolo is **not** inverted to amplifier. But an unrelated phantom "streamer" label-word leaks in as a component, triggering a different (still bogus) clarification. | **PARTIAL** |

**Recommendation:** One more cleanup pass before external review. R1 and R2 are demonstrably fixed. R3's specific inversion bug is fixed, but the labeled-chain surface still produces a bogus clarification at a different layer — visible to any external reviewer who types a labeled chain. This is user-visible and worth closing before we ship.

---

## Prompt 1 — Typed chain with and without saved system

Input:
```
Bluesound NODE X → PrimaLuna EVO 300 Integrated → Harbeth P3ESR. What should I upgrade?
```

**Run A (saved "Livingroom" system present — Chord Hugo / JOB Integrated / WLM Diva Monitor):**
- Chain displayed: `Bluesound NODE X → PrimaLuna EVO 300 Integrated → Harbeth P3ESR`
- Role labels: `DAC → Amplifier → Speakers`
- Copy nowhere mentions JOB, Chord, Hugo, WLM, or Diva.
- The word "JOB" that appears in the "do nothing" phrasing ("already does its JOB") is template prose, not a seeded component — confirmed by Run B.

**Run B (localStorage cleared, page reloaded):**
- Output is **identical** to Run A, byte-for-byte, including the "already does its JOB" phrasing.
- This proves the saved system is not leaking in; the phrase is just a rendering choice in the template.

**R1 verdict: CLEAR.** The phantom-seeding path from the QA report is closed. Two unrelated quirks were noted in the output (entity-name duplication in "Detail Emphasis"/"Tonal Richness" copy, NODE X labeled as DAC rather than Streamer) — both present in both runs, so unrelated to R1 and out of scope for this retest.

---

## Prompt 2 — Brand-only homepage query

Input:
```
Tell me about the Chord sound
```

Rendered:
- Header: **Chord· FPGA**
- Lead: "Chord designs FPGA components that emphasise clarity and speed. Assessment is based on the brand's known character."
- "What this component brings" bullets use **Chord** (capitalized).
- No "not in catalog" error.
- Separator between brand name and architecture renders cleanly; copy-extractable as "Chord· FPGA" (no `chordFPGA` run-on).
- Tone matches the advisor register — no hype.

**R2 verdict: CLEAR.** Display casing and the header separator both render as specified.

---

## Prompt 3 — Labeled chain with " - " separator

Input:
```
how's this system: speakers: wlm diva monitors - amp: job integrated - streamer: eversolo dmp-a6
```

Rendered:
- **The specific inversion bug is gone.** The app does **not** describe Eversolo DMP-A6 as an amplifier. The reply explicitly treats the Eversolo as a streamer.
- **But a clarification still appears, for a different reason.** The rendered message reads:
  > "Quick clarification before I run the assessment. Eversolo Dmp-a6 and streamer both appear as streamers. Are both active in the signal path, or has one replaced the other?"
  > "You described a system: Job integrated, Eversolo Dmp-a6, WLM Diva, streamer"
- A phantom component named literally **"streamer"** (the label word) is being added to the parsed component list, alongside the actual Eversolo DMP-A6. That produces a duplicate-role conflict and a bogus clarification.
- The two entities the clarification is comparing are the Eversolo and a ghost. Chain parsing, not role detection, is the remaining failure point.

**R3 verdict: PARTIAL.** The inversion this pass targeted is fixed (and has regression coverage in `residual-blockers.test.ts`). However, the user-visible surface — typing a correctly-labeled chain — still produces a bogus clarification. An external reviewer typing the QA prompt will see the clarification and not notice that the underlying inversion was fixed.

### Likely root cause (for the next pass)
The R3 fix targeted `detectUserAppliedRole` and the segment-separator regex. Upstream, `extractSubjectMatches` (or whichever function feeds the component list into `validateSystemComponents`) is now treating the label word `streamer` in `streamer: eversolo dmp-a6` as a component in its own right — so the component list becomes `[wlm diva, job integrated, eversolo dmp-a6, streamer]`. The new " - " splitter exposes the label as a standalone token that the subject-matcher then promotes.

The fix is likely narrow: when a segment begins with `<role>:` and `<role>` is a known category term (same set as `USER_ROLE_COLON_PATTERNS`), strip the leading `<role>:` from the segment before subject extraction. It should not need to touch the reasoning layer or the role-detector that the R3 pass already corrected.

---

## Ship-readiness recommendation

**Not yet ready for trusted external review.** One more scoped pass is warranted.

- R1 and R2 are demonstrably clear in live Chrome and covered by regression tests.
- R3's inversion is clear at the unit level but the end-to-end labeled-chain surface still renders a bogus clarification.
- The fix is expected to be narrow (strip leading `<role>:` labels before subject extraction) and should not require reopening the R3 detector work.
- After that fix, re-run Prompt 3 in Chrome and confirm: no clarification, or a genuine clarification that names real components only.

Scope discipline: R4 (Rega/Planar 3 dedup), R5 (Topping D90SE routing), R6 (warm-DAC misalignment), and the secondary quirks observed in Prompt 1 (entity duplication in "Detail Emphasis"/"Tonal Richness", NODE X labeled as DAC) all remain explicitly out of scope until the R3 surface is closed.

---

## Appendix — Raw rendered text snippets

Prompt 1 (both runs, identical):
> My System
> Bluesound NODE X → PrimaLuna EVO 300 Integrated → Harbeth P3ESR
> DAC → Amplifier → Speakers
> The Bluesound NODE X, PrimaLuna EVO 300 Integrated, and Harbeth P3ESR form a chain…
> Staying here means trading the urge to upgrade for a system that already does its JOB…

Prompt 2:
> Chord· FPGA
> Chord designs FPGA components that emphasise clarity and speed. Assessment is based on the brand's known character.

Prompt 3:
> Quick clarification before I run the assessment.
> Eversolo Dmp-a6 and streamer both appear as streamers. Are both active in the signal path, or has one replaced the other?
> You described a system: Job integrated, Eversolo Dmp-a6, WLM Diva, streamer
