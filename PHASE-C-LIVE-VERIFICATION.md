# Phase C — Live Chrome Verification Report

**Date:** 2026-04-14
**Scope:** Live browser retest of failure transcripts A–E against the Phase C blocker-fix build. No code changes in this pass.
**Environment:** localhost:3000, active saved "My System" = Chord Hugo → JOB Integrated → WLM Diva Monitor.

---

## Verdict: **NO-GO** for trusted external review

Three Phase-C fixes hold in narrow test cases but **do not hold across live multi-turn flow.** The same class of failures the QA pass flagged still reach rendered output, just with new surface patterns.

---

## Per-transcript results

### Transcript A — Saved-system evaluation (multi-turn) — **FAIL**

| Turn | Input | Routing | Outcome |
|------|-------|---------|---------|
| A1 | `evaluate the saved system 'My System'` | System Review | **PASS** — renders the real saved chain (Chord Hugo → JOB Integrated → WLM Diva Monitor). No fabrication. |
| A2 | `what would you upgrade first?` | Gear Comparison | **FAIL** — "To reason about any comparison, I need to know what's actually being compared — the design architectures, not just the names … What are you comparing, and what's driving the question?" Should have stayed in an upgrade/improvement handler anchored on the saved system. |

Not run (mode-coherence already broken): A3, A4. Prior session confirmed both also fail with the same pattern — once the first turn breaks the state, subsequent turns inherit the wrong mode.

**Rule violated:** mode must stay coherent across turns when a saved system is active.

### Transcript B — Brand → product → fit — **FAIL**

| Turn | Input | Routing | Outcome |
|------|-------|---------|---------|
| B1 | `tell me about the Chord sound` | Product assessment | **PARTIAL** — Chord brand character renders, but panel shows `In your system: No system context available — tell me about your amplifier and speakers` **despite** active "My System". Saved-system context does not flow into the brand inquiry handler. |
| B2 | `what about the qutest?` | Product assessment (Qutest) | **PARTIAL** — product pivot works, but same "No system context available" banner. Grounding regression. |
| B3 | `would it fit my system?` | Diagnosis | **FAIL** — renders: "Your description does not strongly activate a specific symptom pattern … Describe one thing that sounds wrong." An elliptical fit question about a just-discussed product is misread as a vague sound-off complaint. The unit test for this (`phase-c-blocker-fixes.test.ts §5`) exercises `buildConsultationFollowUp` directly, but the live state machine never routes to that handler. |

**Rules violated:** (a) saved-system context must reach the brand/product inquiry handler; (b) elliptical fit follow-ups after a product inquiry must stay in consultation follow-up, not fall through to diagnosis.

### Transcript C — Saved-system evaluation phrasing — **PASS**

| Turn | Input | Routing | Outcome |
|------|-------|---------|---------|
| C1 | `assess my system` | System Review | **PASS** — uses saved chain (Chord Hugo / JOB Integrated / WLM Diva Monitor). |
| C2 | `tell me what you think of my system` | System Review | **PASS** — same grounded review on a fresh turn. |

Both assessment phrasings route correctly when the active saved system is present and the conversation state is clean.

### Transcript D — Reviewer-style multi-brand inline system — **PARTIAL PASS**

Input: `here's my system: LAiV Harmony DAC, Kinki Studio EX-M1+ integrated, Qualio IQ speakers. assess my system`

Parser output (**the core Phase-C fix — holds**):
- Three distinct rows. Roles correct: LAiV Harmony DAC = DAC, Kinki Studio Ex-M1 = Amplifier, Qualio = Speakers.
- No brand bleed (no LAiV↔Kinki cross-fusion, no duplicate DAC row).

Remaining concerns that should block "trusted review":
1. **Named-reviewer grounding claim.** Output contains: "Similar to Srajan Ebaen's system … This matches a known system … Srajan Ebaen's main reference system (partial match)." This is a specific, attributable third-party claim. Unless the catalog genuinely contains Srajan Ebaen's documented reference chain as a reviewer tag, this violates §5 Confidence Calibration ("language strength must match source quality"). Reviewer-level audiences will catch this immediately.
2. **Model stripping.** Input said "Qualio IQ"; output renders bare "Qualio". Minor, but degrades trust for users who typed the model name.
3. **"What the system is doing well" omits the speaker.** Only the DAC and amp are itemized; the Qualio row is absent from the strengths list even though it is surfaced everywhere else. Asymmetric coverage.
4. **"If you optimize" with zero audition basis.** Panel says "There are no clear bottlenecks here" on a chain the engine has never heard. §5 violation — confidence not earned by evidence.

### Transcript E — Shopping with speaker context — **FAIL**

Input: `best integrated amp for Harbeth under $5000`. Active saved "My System" present.

Output: shopping panel with Primare i35 / PrimaLuna EVO 300 / Naim SuperNait 3. Budget ($5000) captured correctly. **But:**

1. **User-stated Harbeth is ignored.** The "Why this fits you" rationale for Primare i35 reads: "The Primare i35 will bring additional transparency to your **WLM Diva Monitors**, aligning with the clarity already provided by your **Chord Hugo**." The user did not say WLM or Chord — they said **Harbeth**. Shopping handler silently overrode the explicit user-named speaker with the active saved-system speaker. §3 Preference Protection violation.
2. **Self-contradicting panel.** Header reads: `For sharper recommendations, tell me about your system.` Body reads: rationale using your-WLM-Diva / your-Chord-Hugo. Same response says "I have no context" and "I'm using your saved context" simultaneously.
3. **Missing:** no reasoning about Harbeth drive requirements (typical Harbeth buyers want tube-friendly integrateds or warmth — PrimaLuna EVO 300 shows up, but Primare i35 as "Best overall" for a *Harbeth* buyer is questionable without explaining the damping/tonal trade-off).

---

## Cross-transcript themes

1. **Mode coherence across turns is still broken.** A2 → comparison, B3 → diagnosis. The intent classifier looks better in isolation; the live state machine does not respect it turn-to-turn.
2. **Active saved-system context is inconsistently threaded into handlers.** System Review gets it (C1, C2, A1). Brand/product inquiry does NOT (B1, B2). Shopping gets it but misuses it (E).
3. **Shopping handler overrides user-stated gear with saved-system gear.** This is the inverse of the bug the QA pass flagged (fabrication when no system exists) — now the system over-anchors to the saved context and drops what the user actually said.
4. **Confidence-calibration regressions in reviewer-facing output** (D): "Srajan Ebaen's system", "no clear bottlenecks" for a chain not heard, blank speaker-name rendering.

Positives:
- Assessment phrasing routing is now clean on a fresh session (C1/C2/A1).
- Multi-brand parser correctly handles LAiV/Kinki/Qualio — no brand bleed.
- No fabricated WLM/Chord/Job chain when none exists (verified separately in D's LAiV/Kinki/Qualio path — only real saved components render).

---

## What a reviewer will almost certainly hit in the first 5 minutes

- Ask "what would you upgrade first?" after a system review → Gear Comparison form (A2).
- Ask about a product, then "would it fit my system?" → Diagnosis prompt asking "Describe one thing that sounds wrong" (B3).
- Ask "best X for Harbeth" with an active saved system that contains different speakers → rationale silently swaps Harbeth for the saved-system speaker (E).
- Drop in a three-brand system and "assess my system" → reviewer-attribution claim ("Srajan Ebaen") plus "no clear bottlenecks" before anyone has heard anything (D).

Any one of these undermines the "knowledgeable private advisor" identity the CLAUDE.md spec defines.

---

## Recommended next Phase-C scope (if opened)

Strictly additive to current blocker set — do not expand beyond:

1. **Upgrade/improvement follow-up routing.** "what would you upgrade first/next" after a System Review must route to upgrade handler anchored on the most recently reviewed system (saved or inline), not to comparison intake.
2. **Elliptical fit recognition in the live router.** The `CONSULTATION_FOLLOWUP_PATTERNS` that unit-test §5 exercises must be consulted **before** diagnosis classification. Currently the state machine reaches diagnosis first.
3. **Saved-system propagation into brand/product assessment.** `detectIntent → product_assessment` handler must receive `turnCtx.activeSystem` and drop the "No system context available" banner when one is active.
4. **Explicit-gear precedence in shopping.** When the user names a speaker in the shopping query, that speaker must anchor the rationale — the saved-system speaker is secondary context, not an override.
5. **Reviewer-attribution guardrail.** Any "Similar to X's system" / "matches a known system" claim must be gated on a curated catalog tag, not inferred from brand-chain pattern-matching.

---

## Go / No-Go

**NO-GO.**

The user-facing regressions above are exactly the kind a knowledgeable audiophile reviewer will surface in a short sitting. Ship to external review only after items 1–4 above are addressed and re-verified in live Chrome.
