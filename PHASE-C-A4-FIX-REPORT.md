# Phase C — A.4 Fix Report: Saved-System Grounding on Shopping Path

**Scope:** Single blocker. Minimal fix. No redesign, no broad cleanup.
**Standard applied:** Audio XX Playbook (§3 Preference Protection, §5 Confidence Calibration) + Portability Requirement (engine/adapter boundary preserved).

---

## Root cause

Live Chrome verification A.4 showed that after a system evaluation, a direct shopping follow-up like "give me specific DAC ideas under $2000" was still rendering the generic fallback copy:

- "Without more system context, this is a sound direction — but the audible difference may be modest."
- "For sharper recommendations, tell me about your system."

…even though the saved system was active and prior turns were correctly grounded on it.

Tracing the path: `apps/web/src/app/page.tsx:935–947` constructs the `ShoppingAdvisoryContext` that feeds the deterministic shopping rendering path (`shoppingToAdvisory` → `deriveExpectedImpact` / `deriveSystemFitExplanation` in `advisory-response.ts`). That construction gated the grounding fields on `isInlineSystem`:

```ts
systemComponents: isInlineSystem ? activeComponentNames : undefined,
systemLocation:   isInlineSystem ? (turnCtx.activeSystem?.location ?? undefined) : undefined,
systemPrimaryUse: isInlineSystem ? (turnCtx.activeSystem?.primaryUse ?? undefined) : undefined,
systemTendencies: isInlineSystem ? (turnCtx.activeSystem?.tendencies ?? undefined) : undefined,
```

When the user did not re-mention their system in the shopping turn, `isInlineSystem` was false and these fields were stripped — leaving only `savedSystemNote` as a secondary addendum. Downstream, `deriveExpectedImpact` (advisory-response.ts:2042) gates on `ctx.systemComponents.length > 0` and falls through to the "Without more system context…" copy when the field is undefined. Same for `deriveSystemFitExplanation` (advisory-response.ts:2092).

The Blocker 3 fix in the prior pass addressed this for `product_assessment` (by passing `turnCtx.activeSystem` directly into `AssessmentContext`), but did not extend to the shopping `advisoryCtx` construction.

The LLM editorial overlay path (`editorialContext` at page.tsx:2876) was already correct — it reads `turnCtx.activeSystem` directly with no `isInlineSystem` gate. So the live bug surfaced only on the deterministic render path, which is the path the user was seeing on direct shopping follow-ups.

## Layer of fix

Adapter wiring only (page.tsx). No engine modules touched. No intent or regex changes. No handler redesign. No changes to `advisory-response.ts`, `shopping-llm-overlay.ts`, or any engine primitive.

## Files changed

| File | Nature of change |
|---|---|
| `apps/web/src/app/page.tsx` | Added `hasActiveSystem = isInlineSystem \|\| isSavedSystem`; switched the shopping `advisoryCtx` grounding fields from `isInlineSystem ? …` to `hasActiveSystem ? …`. |
| `apps/web/src/lib/__tests__/phase-c-blocker-fixes.test.ts` | Added `Phase C live-verification §A.4` describe block with 5 regression tests. Added `ExtractedSignals` type import. |

No other files modified. The EXPLICIT-GEAR PRECEDENCE rule (Blocker 4) in `shopping-llm-overlay.ts` is untouched — `queryAnchors` derivation at page.tsx:2910 is untouched, the system prompt's EXPLICIT-GEAR PRECEDENCE rule is untouched, and the "Evaluating against" user-prompt line is untouched.

## Exact logic change

`apps/web/src/app/page.tsx` (around line 935):

```ts
// Phase C blocker A.4 fix: when a saved/draft system is active, the
// shopping overlay and editorial context must receive it as first-class
// grounding — not merely as a secondary savedSystemNote. Without this,
// `deriveExpectedImpact` and `deriveSystemFitExplanation` in
// advisory-response.ts fall back to the "Without more system context"
// copy because they gate on `ctx.systemComponents.length > 0`. The
// EXPLICIT-GEAR PRECEDENCE rule from Blocker 4 is unaffected: it lives
// in shopping-llm-overlay.ts via queryAnchors, which still win over
// systemComponents for the systemFit anchor.
const hasActiveSystem = isInlineSystem || isSavedSystem;
const advisoryCtx: ShoppingAdvisoryContext = {
  systemComponents: hasActiveSystem ? activeComponentNames : undefined,
  systemLocation:   hasActiveSystem ? (turnCtx.activeSystem?.location ?? undefined) : undefined,
  systemPrimaryUse: hasActiveSystem ? (turnCtx.activeSystem?.primaryUse ?? undefined) : undefined,
  storedDesires:    tasteProfile ? topTraits(tasteProfile, 5).map((t) => t.label) : undefined,
  systemTendencies: hasActiveSystem ? (turnCtx.activeSystem?.tendencies ?? undefined) : undefined,
  tasteReflection:  generateTasteReflection(listenerProfileRef.current) ?? undefined,
  savedSystemNote,
};
```

`savedSystemNote` is retained — advisory-response.ts already suppresses it when `effectiveSystemNote` is present (line 3142), so there is no duplicated "In your system…" copy.

## Portability check

The change lives in `page.tsx` (the adapter / consultation wiring layer). It passes turn context from state into a handler input. No engine primitive (tradeoff-assessment, preference-protection, reasoning core) is touched. No audio vocabulary was added. Climate Screen test passes: the fix is about which context to pass into the renderer, not about signal-chain reasoning.

## Tests added

`apps/web/src/lib/__tests__/phase-c-blocker-fixes.test.ts` grew from 34 to 39 tests. New describe block `Phase C live-verification §A.4 — saved-system grounding on shopping path` contains:

1. **page.tsx advisoryCtx no longer gates systemComponents on isInlineSystem only** — source-level assertion that `hasActiveSystem = isInlineSystem || isSavedSystem` exists and feeds `systemComponents` / `systemTendencies`.
2. **shoppingToAdvisory does NOT emit the "Without more system context" fallback when an active system is supplied** — exercises the full `detectShoppingIntent → reason → buildShoppingAnswer → shoppingToAdvisory` pipeline with a populated `ShoppingAdvisoryContext` and asserts `advisory.expectedImpact.explanation` does not contain the fallback string.
3. **expectedImpact tier is NOT "subtle" when systemComponents + systemTendencies are supplied** — asserts the grounded path produces `noticeable` or `system-level`, not the thin-context `subtle` fallback.
4. **EXPLICIT-GEAR PRECEDENCE preserved** — re-asserts that `queryAnchors`, `EXPLICIT-GEAR PRECEDENCE`, and "Evaluating against" still ship in `shopping-llm-overlay.ts`. Confirms the A.4 fix did not regress Blocker 4.
5. **page.tsx queryAnchors derivation intact** — asserts the `turnCtx.subjectMatches` filter for `brand`/`product` that feeds queryAnchors survived the fix.

Tests 1 and 5 satisfy the user's requirement that "shopping rationale remains anchored correctly when explicit gear is also named" at the source level (the queryAnchors pipeline is the mechanism for explicit-gear precedence). Tests 2 and 3 satisfy "shopping prompt / editorial context does not emit 'tell me about your system' when saved system is active".

## Test results

- `apps/web/src/lib/__tests__/phase-c-blocker-fixes.test.ts`: **39 / 39 pass** (grew from 34 to 39).
- Full workspace suite: **2070 pass / 4 fail / 4 skipped** (was 2065 / 4 / 4 before; +5 new tests).
  - The 4 failures are the same pre-existing ones identified in the prior blocker pass:
    - `start-here-block.test.ts` ×3 (lowPreferenceSignal on shopping).
    - `qa-full-pass.test.ts` ×1 (lowPreferenceSignal location).
  - 2 "No test suite found" warnings (`_sample_print.test.ts`, `intent-evaluate-trace.test.ts`) — pre-existing empty stubs.
- Zero new regressions introduced by this fix.

## A.4 verdict

**Cleared at the adapter / data-flow level.** With the saved system active, the shopping `ShoppingAdvisoryContext` now carries `systemComponents`, `systemLocation`, `systemPrimaryUse`, and `systemTendencies`, so `deriveExpectedImpact` and `deriveSystemFitExplanation` no longer fall through to the "Without more system context…" / "tell me about your system" copy. The Blocker 4 EXPLICIT-GEAR PRECEDENCE rule is preserved: when the user names a component in the shopping query (e.g., "best integrated amp for Harbeth"), the `queryAnchors` path in `shopping-llm-overlay.ts` still anchors the systemFit rationale on the user-named component, with the saved system demoted to secondary background.

Live Chrome re-verification against the original A.4 prompt ("give me specific DAC ideas under $2000" with an active saved system) should be re-run to confirm rendered panel copy before closing Phase C live verification. The unit tests above pin the data-flow condition end-to-end but do not render the DOM.

## Invariants preserved

- Explicit category overrides previous category: untouched.
- Budget persists unless explicitly changed: untouched.
- Comparison must not degrade in shopping mode: untouched.
- Gear questions must not route to diagnosis: untouched.
- EXPLICIT-GEAR PRECEDENCE (Blocker 4): re-asserted by test §A.4.4 and §A.4.5.
- Engine/adapter boundary: engine modules untouched; only page.tsx wiring changed.
