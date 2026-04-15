# R3b — Labeled-Chain Label-Word Fix Report

Date: 2026-04-14
Scope: One scoped cleanup pass to close the remaining R3 surface before trusted external review.
Stance: Minimal, targeted fix. Adapter-layer only. No reasoning, routing, or UI changes.

---

## TL;DR

The R3 pass correctly eliminated the role-label **inversion** ("streamer: eversolo dmp-a6" being read as `amplifier`). Live-Chrome retest showed a different, adjacent bug still active on the same surface: a **different layer** was promoting the bare label word `streamer` into the parsed component list, causing a bogus duplicate-role clarification. That second layer was `detectSystemDescription`'s `GENERIC_COMPONENT_RE` scan. This pass adds a one-paragraph label-word guard there.

Five new regression tests encode the exact failure shape and pass. The existing 11 residual-blockers tests, all 24 labeled-system-detection tests, and all other related suites remain green. Live-Chrome retest of the QA prompt now renders a full system assessment with no phantom `streamer` component and no bogus clarification — **R3 is fully cleared.**

---

## Root cause

`apps/web/src/lib/system-extraction.ts::detectSystemDescription` contains a pass that augments the parsed component list with generic component descriptors found in free text:

```ts
const GENERIC_COMPONENT_RE = [
  …
  { pattern: /\bstreamer\b/i,      category: 'streamer' },
  { pattern: /\bturntable\b/i,     category: 'turntable' },
  { pattern: /\bpreamp(?:lifier)?\b/i, category: 'amplifier' },
  …
];

for (const { pattern, category } of GENERIC_COMPONENT_RE) {
  const m = currentMessage.match(pattern);
  if (m) { … push as a brand-less component with name=desc … }
}
```

This is intended to catch phrases like "I have a streamer and some monitors" — surfacing gear the user owns but didn't brand. When the message is a labeled chain like `streamer: eversolo dmp-a6`, the bare label word `streamer` matches `\bstreamer\b`, and the layer promotes it to a component with name `"streamer"` and no brand. Downstream, the duplicate-role validator sees that phantom `streamer` plus the cataloged Eversolo streamer and raises a bogus "two streamers" clarification.

The R3 pass corrected the role-label detector (`detectUserAppliedRole`). It did not touch this adjacent promotion layer, which is why the inversion bug cleared but the user-visible clarification did not.

---

## Fix

`apps/web/src/lib/system-extraction.ts`, the GENERIC_COMPONENT_RE scan inside `detectSystemDescription` (~lines 446–488).

Exact logic change:

- Added an `isLabelAt(endIdx)` helper that scans whitespace after the match and returns `true` when the next non-space character is `:`.
- Rewrote the scan to iterate **all** occurrences of each pattern via a global-flag clone (`new RegExp(pattern.source, flags + 'g')`) instead of only the first. For each match, if `isLabelAt(matchIdx + desc.length)` is true, skip the occurrence. On the first non-label match, promote the descriptor exactly as before, then `break` (one descriptor per pattern — matching the prior behavior).

This is an adapter-layer change only. It contains no audio-specific vocabulary beyond what was already in `GENERIC_COMPONENT_RE`. The guard is a pure structural check ("is this token a `<label>:` prefix?") and passes the Climate Screen portability test.

The fix does **not** touch: `detectUserAppliedRole`, `USER_ROLE_COLON_PATTERNS`, the segment separator regex, `validateSystemComponents`, the seeding pass in `buildSystemAssessment`, the product-assessment display layer, or any UI component.

### Diff summary

```diff
- for (const { pattern, category } of GENERIC_COMPONENT_RE) {
-   const m = currentMessage.match(pattern);
-   if (m) {
-     const desc = m[0];
-     …promote…
-   }
- }
+ const isLabelAt = (endIdx: number): boolean => {
+   let i = endIdx;
+   while (i < currentMessage.length && /\s/.test(currentMessage[i])) i++;
+   return i < currentMessage.length && currentMessage[i] === ':';
+ };
+ for (const { pattern, category } of GENERIC_COMPONENT_RE) {
+   const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
+   let matchResult: RegExpExecArray | null;
+   while ((matchResult = globalPattern.exec(currentMessage)) !== null) {
+     const desc = matchResult[0];
+     if (isLabelAt(matchResult.index + desc.length)) continue;
+     …promote the first non-label match, then break…
+   }
+ }
```

---

## Files changed

| File | Lines | Purpose |
|---|---|---|
| `apps/web/src/lib/system-extraction.ts` | +~30 | R3b label-word guard in GENERIC_COMPONENT_RE scan |
| `apps/web/src/lib/__tests__/residual-blockers.test.ts` | +~110 | 5 new regression tests for R3b |

No other files modified.

---

## Tests added

New describe block in `residual-blockers.test.ts`: `"Residual R3b: label words must not become phantom components"`.

1. **`"streamer: eversolo dmp-a6" does not create a phantom streamer component`** — direct call to `detectSystemDescription`; asserts no brand-less component named `"streamer"` appears.
2. **`the full labeled-chain prompt does not produce a bogus duplicate-role clarification`** — runs the exact QA prompt through `detectSystemDescription` and asserts no phantom `streamer`/`turntable`/`preamp` label-words leak through, plus asserts the Eversolo still reads as a streamer (no R3 regression).
3. **`explicit role labels are still honored correctly for Eversolo, JOB, and WLM`** — re-asserts R3's core invariant at the `detectUserAppliedRole` level, confirming the adapter-layer fix didn't disturb the role detector.
4. **`genuine duplicate-role case still triggers a real clarification (control)`** — two cataloged streamers with no labels; `validateSystemComponents` must still raise a clarification. Proves we only suppressed the phantom-label false positive, not real conflicts.
5. **`unlabeled descriptor ("I have a streamer and some monitors") is still promoted as a component`** — control: a bare `streamer` token without a trailing `:` must still surface as a generic descriptor.

---

## Test results

```
residual-blockers.test.ts             16 tests   passed   (11 prior + 5 new)
labeled-system-detection.test.ts      24 tests   passed
blocker-fixes.test.ts                 11 tests   passed
validation-layer.test.ts              23 tests   passed
integration-assessment.test.ts        49 tests   passed
system-diagnosis.test.ts               8 tests   passed

Full suite                         2009 passed   (4 pre-existing
                                                  unrelated failures
                                                  in lowPreferenceSignal
                                                  tests; unchanged count
                                                  vs. previous pass)
```

Net against prior pass: +5 passing (the new R3b tests). No regressions.

The 4 pre-existing failures are still in `_sample_print.test.ts`, `intent-evaluate-trace.test.ts`, `qa-full-pass.test.ts`, and `start-here-block.test.ts` — all in the `lowPreferenceSignal` shopping-advisory surface. None reference the symbols touched by this pass (`GENERIC_COMPONENT_RE`, `detectSystemDescription`, `isLabelAt`, or the strings `streamer:`/`turntable:`/`preamp:`).

---

## Live Chrome verification

Prompt:
```
how's this system: speakers: wlm diva monitors - amp: job integrated - streamer: eversolo dmp-a6
```

Before this pass (from RETEST-VERDICT):
- Bogus clarification: "Eversolo Dmp-a6 and streamer both appear as streamers."
- Component summary included phantom word: "Job integrated, Eversolo Dmp-a6, WLM Diva, streamer"

After this pass (just-executed retest):
- **Full system assessment renders directly — no clarification dialog.**
- Chain displayed: `Eversolo Dmp-A6 → JOB Integrated → WLM Diva`
- Role labels: `Streamer → Amplifier → Speakers` (Eversolo correctly Streamer; R3 inversion fix preserved)
- System Save prompt reads: `"You described a system: Job integrated, Eversolo Dmp-a6, WLM Diva"` — phantom `streamer` is gone.
- Assessment body names the three components correctly and offers the expected "do nothing" directional framing consistent with the Playbook.

---

## Should this fully clear R3 in live Chrome?

**Yes.** Both the specific inversion bug (`detectUserAppliedRole` reading Eversolo as `amplifier`) and the adjacent phantom-component bug (`GENERIC_COMPONENT_RE` promoting the label word `streamer`) are now closed at their respective layers, with regression coverage encoding the exact failure shapes. Live Chrome renders the labeled-chain prompt as a full system assessment with no bogus clarification and correct role labels throughout.

R1 and R2 remain cleared from the previous pass. With R3 now fully cleared, the three named blocker surfaces are closed and **this build is ready for trusted external review** on those surfaces. The secondary cosmetic quirks observed during retests (entity-name duplication in "Detail Emphasis"/"Tonal Richness" copy, NODE X labeled as DAC rather than Streamer, mid-sentence "And" capitalization) and the QA-pass-R4/R5/R6 items remain explicitly out of scope for this final cleanup.
