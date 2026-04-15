# Phase C — Final Blocker Pass: Implementation Report

**Source of truth:** `PHASE-C-LIVE-VERIFICATION.md` (attached)
**Scope:** Five blockers only. No engine/UI redesign. No cleanup.
**Standard applied:** Audio XX Playbook (§3 Preference Protection, §5 Confidence Calibration) + Portability Requirement (engine/adapter boundary preserved).

---

## Blocker 1 — Upgrade/improvement follow-up routing (Failure A2)

**Failure transcript.** After saving a system and being offered a review, the user asked "what would you upgrade first?". The turn was classified as `gear_comparison` and landed in the comparison intake flow, breaking the active system-review frame.

**Root cause.** In `apps/web/src/lib/intent.ts`, a broad comparison regex matched any "what would ... upgrade/change/swap/switch/move" phrasing:

```
/\bwhat\s+would\b.*\b(?:upgrade|change|swap|switch|move)\b/i
```

Bare "what would you upgrade first?" has no comparison anchors (no "vs", no two named products) but still matched this pattern, winning over the saved-system consultation routing.

**Layer of fix.** Intent routing only. No handler changes, no UI changes.

**Exact logic change.**
- Removed the over-broad comparison pattern at `intent.ts:272`. Concrete upgrade-comparison phrasings ("upgrade from the X to the Y") are still caught by the remaining `\bupgrade\s+(?:from|my)\b` pattern, so comparison detection is not regressed.
- Added a dedicated `UPGRADE_FOLLOWUP_PATTERNS` array capturing the four upgrade/improvement follow-up shapes the review frame should own:

```
/\bwhat\s+would\s+you\s+(?:upgrade|change|swap|switch|replace|improve|do)\s*(?:first|next)?\b/i
/\bwhat\s+(?:should|could)\s+i\s+(?:upgrade|change|swap|improve|replace|do)\s*(?:first|next)?\b/i
/\bwhere\s+(?:should|could|would)\s+(?:i|you)\s+(?:upgrade|improve|start|focus)\b/i
/\b(?:what|where)(?:'s|\s+is)\s+(?:the\s+)?(?:weak(?:est)?\s+link|bottleneck|next\s+(?:step|move|upgrade))\b/i
```

- Routed these to `consultation_entry` gated on `options.hasActiveSavedSystem || hasOwnership` so the review frame is preserved across turns and bare upgrade questions without context do not trigger consultation.

**Verdict for A2.** Cleared. The upgrade follow-up now routes to the consultation/review handler, preserving the system-review frame.

---

## Blocker 2 — Elliptical fit follow-up routing (Failure B3)

**Failure transcript.** After "what about the qutest?" (product_assessment) the user asked "would it fit my system?" and was dropped into diagnosis.

**Root cause.** The elliptical-fit regex in `CONSULTATION_FOLLOWUP_PATTERNS` (`page.tsx:1520`) already matched the phrasing. The gate that routes into `buildConsultationFollowUp` checks `state.activeConsultation`. But the `product_assessment` branch never dispatched `SET_CONSULTATION_CONTEXT` after producing the assessment, so `activeConsultation` was null and the follow-up gate could not fire. The next turn, with no consultation state to bind to, fell through to diagnosis.

**Layer of fix.** State dispatch in the product_assessment handler. No regex changes, no intent changes.

**Exact logic change.** In `apps/web/src/app/page.tsx`, after a successful `product_assessment` advisory is dispatched, dispatch `SET_CONSULTATION_CONTEXT` with the enriched subjects and the originating query:

```ts
if (assessment) {
  const advisory = assessmentToAdvisory(assessment, advisoryCtx);
  dispatchAdvisory(advisory);
  if (enrichedSubjects.length > 0) {
    dispatch({
      type: 'SET_CONSULTATION_CONTEXT',
      subjects: enrichedSubjects,
      originalQuery: submittedText,
    });
  }
  dispatch({ type: 'SET_LOADING', value: false });
  return;
}
```

This lets the next turn's consultation follow-up gate see an active consultation bound to the Qutest (or whichever product), so "would it fit my system?" classifies as `system_fit` and routes into `buildConsultationFollowUp` instead of diagnosis.

**Verdict for B3.** Cleared. Elliptical fit follow-ups after a product assessment now preserve product context and route to the system-fit follow-up handler.

---

## Blocker 3 — Saved-system propagation into brand/product assessment (Failures B1 / B2)

**Failure transcript.** Panels rendered "No system context available" even when the user had a saved system active, because brand/product assessment received no active system.

**Root cause.** `page.tsx` computes `generalActiveSystem = isInlineSystem ? turnCtx.activeSystem : null` — deliberately gated so inline-mentioned system contexts don't leak into unrelated turns. But this gating was also applied to `product_assessment`, so a saved-but-not-re-mentioned system was stripped from the `AssessmentContext` before the assessment ran.

**Layer of fix.** Handler wiring. The gating rule for general-purpose handlers is preserved — only `product_assessment` is lifted to use the turn's full active system.

**Exact logic change.** In the `product_assessment` branch of `page.tsx`, the `AssessmentContext` now reads `activeSystem: turnCtx.activeSystem` directly (not `generalActiveSystem`). `turnCtx.activeSystem` is already set from `state.savedSystem` upstream, so saved-system grounding flows into the brand/product assessment regardless of whether the current turn re-mentions components.

**Portability check.** This lives in `page.tsx` (consultation wiring / adapter layer). No engine module sees audio vocabulary. Climate Screen test passes: the fix is about which context to pass into a handler, not about signal-chain reasoning.

**Verdict for B1/B2.** Cleared at the data-flow level — `product_assessment` now receives the saved system. Rendered panel copy (e.g. the exact "In your system" sentence) is covered by the assertion in the regression test that the assessment no longer returns the "no system context available" placeholder, but live Chrome re-verification is the authoritative check for panel strings.

---

## Blocker 4 — Explicit-gear precedence in shopping (Failure E)

**Failure transcript.** "best integrated amp for Harbeth under $5000" — with a saved system whose speaker is a WLM — produced a rationale that silently swapped Harbeth for the saved-system's WLM. The user-named component was demoted to a footnote.

**Root cause.** The shopping LLM overlay (`buildSystemPrompt` / `buildUserPrompt` in `shopping-llm-overlay.ts`) surfaced the saved system prominently but had no explicit rule stating that a user-named component in the query takes precedence as the system-fit anchor. The model defaulted to the most prominent context (saved system) and overrode the query's explicit Harbeth.

**Layer of fix.** Adapter / prompt construction. No engine reasoning change.

**Exact logic changes.**
1. Added `queryAnchors?: string[]` to the `ShoppingEditorialContext` type — the list of brand/product names the user explicitly named in the current query.
2. `buildSystemPrompt` gained an **EXPLICIT-GEAR PRECEDENCE** rule stating that any component named in the user's query is the primary anchor for `systemFit` reasoning; a saved system may inform compatibility but must not replace the user-named anchor.
3. `buildUserPrompt` and `buildClosingUserPrompt` now surface the query anchors on a dedicated line:
   ```
   Evaluating against (from user's query — PRIMARY anchor for system fit): Harbeth
   ```
4. In `page.tsx`, the shopping editorial call now derives `queryAnchors` from `turnCtx.subjectMatches`, filtering to `brand` and `product` kinds and deduplicating.

**Portability check.** `queryAnchors` is a generic concept (explicit user-named entities). The EXPLICIT-GEAR PRECEDENCE rule is expressed in audio vocabulary because this prompt is the audio adapter's shopping overlay — that is the correct layer for audio-specific instruction text. No core engine module was touched.

**Verdict for E.** Cleared. The LLM now has both the prompt rule and the structured input to anchor `systemFit` rationale on the user-named component.

---

## Blocker 5 — Reviewer-attribution guardrail (Failure D)

**Failure transcript.** Diagnosis output included "Similar to Srajan Ebaen's system" despite no verified curated backing — the match came from a partial brand-chain overlap, not a curated tag.

**Root cause.** `suggestKnownSystemName` in `known-systems.ts` emitted "Similar to <attribution>'s system" whenever `coreOverlap >= 0.66`. Partial overlaps of well-known brand chains are frequently coincidental (e.g. two systems sharing a DAC and an amplifier does not make one a reference for the other). Named-reviewer attribution is a specific third-party claim; per §5 Confidence Calibration, language strength must match source quality.

Additionally, `system-extraction.ts` constructed the `knownSystemMatch` object at the same loose threshold, so the SystemSavePrompt UI could receive a partial-match label even if `suggestKnownSystemName` returned null.

**Layer of fix.** Adapter data layer. No engine module touched.

**Exact logic changes.**
1. `known-systems.ts` — `suggestKnownSystemName` now requires `coreOverlap >= 1.0` (full core match) to return a label; partial matches return `null`:
   ```ts
   export function suggestKnownSystemName(match: KnownSystemMatch): string | null {
     if (match.coreOverlap >= 1.0) return match.system.label;
     return null;
   }
   ```
   Accompanying doc comment documents the §5 calibration rationale.
2. `system-extraction.ts` — gated the `knownSystemMatch` object returned from `detectSystemDescription` on the same `coreOverlap >= 1.0` threshold, so the SystemSavePrompt UI never renders a partial-match label even if it reads the raw match.

**Verdict for D.** The "Similar to Srajan Ebaen's system" attribution is cleared at source: partial matches no longer produce the label in either the save prompt or the advisory text path. ("No clear bottlenecks" language in the same Failure D bullet is a §5 confidence-calibration concern but was called out by the user as out of scope — not touched.)

---

## Files changed

| File | Blockers | Nature of change |
|---|---|---|
| `apps/web/src/lib/intent.ts` | 1 | Removed over-broad comparison regex; added `UPGRADE_FOLLOWUP_PATTERNS` + routing branch. |
| `apps/web/src/app/page.tsx` | 2, 3, 4 | Dispatch `SET_CONSULTATION_CONTEXT` after product_assessment; pass `turnCtx.activeSystem` into assessment context; derive `queryAnchors` for shopping editorial. |
| `apps/web/src/lib/shopping-llm-overlay.ts` | 4 | Added `queryAnchors` field to `ShoppingEditorialContext`; added EXPLICIT-GEAR PRECEDENCE rule to system prompt; surfaced query anchors in user prompts. |
| `apps/web/src/lib/known-systems.ts` | 5 | Raised `suggestKnownSystemName` threshold to `coreOverlap >= 1.0`. |
| `apps/web/src/lib/system-extraction.ts` | 5 | Gated `knownSystemMatch` construction on full core overlap. |
| `apps/web/src/lib/__tests__/phase-c-blocker-fixes.test.ts` | 1–5 | Regression tests per blocker (see below). |

No other files modified. No engine modules (tradeoff-assessment, preference-protection) touched. Audio vocabulary introduced only in the shopping overlay prompt — the correct adapter layer.

---

## Tests added

New describe blocks in `phase-c-blocker-fixes.test.ts`, one per blocker, covering the exact failing transcripts plus at least one control case each:

- **§1 Upgrade follow-up routing.** "what would you upgrade first?" after a saved system routes to `consultation_entry`; bare "what would you upgrade?" with no saved system does NOT route to consultation; "upgrade from the Qutest to the Bifrost" still routes to `gear_comparison` (control — comparison is not regressed).
- **§2 Elliptical fit follow-up routing.** After a `product_assessment`, the elliptical fit pattern classifies as `system_fit`; `activeConsultation` is populated post-assessment; control: "how does it measure?" still classifies as `sonic_detail`, not `system_fit`.
- **§3 Saved-system propagation.** `product_assessment` receives `turnCtx.activeSystem` when a saved system is active; the `AssessmentContext` never carries the "no system context available" placeholder when `savedSystem` is set.
- **§4 Explicit-gear precedence.** `buildSystemPrompt` contains the EXPLICIT-GEAR PRECEDENCE rule string; `buildUserPrompt` surfaces `queryAnchors` on the "Evaluating against" line; `ShoppingEditorialContext` accepts `queryAnchors` without type error.
- **§5 Reviewer-attribution guardrail.** `suggestKnownSystemName` returns null for partial (0.67, 0.8) overlaps; returns the full label only at 1.0; `detectSystemDescription` drops `knownSystemMatch` on partial overlap and keeps it at 1.0.

---

## Test results

- `apps/web/src/lib/__tests__/phase-c-blocker-fixes.test.ts`: **34 / 34 pass** (grew from 14 tests to 34 with the new regression cases).
- Full workspace suite: **2065 pass / 4 fail / 4 skipped**. The 4 failures are pre-existing and unrelated to these fixes:
  - `start-here-block.test.ts` ×3 and `qa-full-pass.test.ts` ×1 — all concern `lowPreferenceSignal` handling.
  - Verified by stash/pop check: the same 4 fail on the pre-fix tree.
- 2 "No test suite found" warnings (`_sample_print.test.ts`, `intent-evaluate-trace.test.ts`) — empty stubs, pre-existing.

---

## Failures A–E status

| Report ID | Status | Notes |
|---|---|---|
| A1 | Already passing | Not touched. |
| **A2** | **Cleared** | Upgrade follow-up now routes to consultation_entry. |
| **B1** | **Cleared (data flow)** | product_assessment now receives saved system; panel copy should be live-reverified. |
| **B2** | **Cleared (data flow)** | Same fix as B1. |
| **B3** | **Cleared** | Elliptical fit after product_assessment now routes to system_fit follow-up. |
| C | Unchanged | Already passing. Not touched. |
| **D** (reviewer attribution) | **Cleared** | "Similar to <reviewer>'s system" requires exact curated match. |
| D ("no clear bottlenecks") | Out of scope | §5 calibration concern, explicitly excluded by user. |
| **E** | **Cleared** | EXPLICIT-GEAR PRECEDENCE + queryAnchors anchor the rationale on the user-named component. |

---

## Caveat for the user

Unit tests cover the blocker-specific behaviors end-to-end through the intent router, handler wiring, and prompt construction. **Live Chrome re-verification was not re-run** in this pass — the authoritative check for rendered panel strings (the exact "In your system" copy in B1/B2, the shopping rationale sentence in E, and the absence of "Similar to Srajan Ebaen's system" in D) should be performed in the browser against the prior failing prompts before closing Phase C.

No scope creep: no engine modules changed, no UI redesign, no general cleanup, no speculative refactors. Core invariants (budget persistence, comparison non-degradation, gear-question non-routing-to-diagnosis, explicit-category precedence) preserved.
