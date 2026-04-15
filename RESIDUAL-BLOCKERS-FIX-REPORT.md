# Residual Blockers (R1–R3) — Fix Report

Date: 2026-04-14
Scope: Final stabilization before trusted external review
Stance: Minimal, targeted fixes. No engine redesign. No UI structure changes. No feature additions.

---

## TL;DR

All three residual blocker-level issues surfaced by the post-fix Chrome
QA are resolved with targeted, scoped changes. Eleven new regression
tests encode the exact failure shapes and all pass. No prior tests
regress on any module touched by this pass.

- R1 (phantom saved-system override) — resolved in consultation.ts seeding pass.
- R2 (Chord brand-only copy regression) — resolved in product-assessment.ts display path plus a one-line header separator in AdvisoryMessage.tsx.
- R3 (Eversolo role-label inversion) — resolved in consultation.ts `detectUserAppliedRole`.

Recommended: this pass should clear R1–R3 from the QA report. The three
named surfaces are re-tested below in summary form.

---

## R1. Phantom saved-system override

### Root cause

`buildSystemAssessment` seeds its component list from
`activeSystem.components`, filtering each by whether the component's
brand or model name appears in the current user message. The filter
used `wordAwareIncludes` with `ac.name` alone. When the saved
component's model name is a generic category term — "Integrated",
"Streamer", "DAC", "Monitor" — it matches inside compound model names
the user typed ("PrimaLuna EVO 300 **Integrated**") and phantom-seeds
the saved component into the new chain.

This is a seeding-layer match too loose, not a state-merge bug. The
cleanest fix is at the match predicate, not upstream in page-level
state management.

### Fix

`apps/web/src/lib/consultation.ts` (seeding pass in `buildSystemAssessment`):

Added a stop-list `GENERIC_COMPONENT_WORDS` of category/role terms
(`integrated`, `amp`, `amplifier`, `dac`, `streamer`, `speaker`,
`monitor`, `preamp`, `turntable`, etc.). When the saved component's
model name (or stripped name) is a single generic word from this list,
seeding requires additional evidence: either the brand must appear in
the message, or the full `"<brand> <name>"` literal must appear.
Specific model names like "Diva", "Hugo", "Node", "Qutest" are NOT on
the list — they remain discriminating on their own.

Changed lines: `~4760–4800` (stop-list helper), `~4840–4865` (seeding
predicate). Domain-agnostic logic — no audio-specific vocabulary
introduced into reasoning modules.

### Tests

- `residual-blockers.test.ts > R1 > saved "JOB Integrated" is NOT
  seeded into a typed Bluesound/PrimaLuna/Harbeth chain` — asserts
  the exact scenario from QA.
- `residual-blockers.test.ts > R1 > control: when brand "JOB" IS in
  the message, the saved "JOB Integrated" component IS seeded` —
  control case, confirms we only blocked the ambiguous path.

Existing `integration-assessment.test.ts > active system seed does not
inject components not in the message` remains green.

---

## R2. Chord brand-only copy regression

### Root cause

`buildProductAssessment` returns a `ProductAssessment` whose
`candidateName` / `candidateBrand` fields feed directly into the
rendered header and body. When there is no catalog match but a brand
is recognized (the brand-only path used by "Tell me about the Chord
sound"), the fallback chain was:

```ts
candidateName = productSubject?.name ?? brandSubject?.name ?? 'Unknown product';
brandName    = candidate?.brand ?? productNote?.brand ?? brandSubject?.name ?? …;
```

`BRAND_NAMES` / `PRODUCT_NAMES` are lowercase (for case-insensitive
matching), so `brandSubject.name === 'chord'`. The rendered header read
`chord` and the body read `chord designs FPGA components`.

The `<h2>` header template in `AdvisoryMessage.tsx` also concatenated
the candidate name and architecture with only a CSS `marginLeft`
separating them — visually fine at width, but copy-pasting produced
the run-on `chordFPGA` text.

### Fix

`apps/web/src/lib/product-assessment.ts`:

- New `toDisplayName(raw)` helper that applies conservative
  per-token first-letter capitalization. Scoped to the display-
  layer only; catalog data already carries canonical casing and
  is not touched.
- Applied at the two fallback points: `candidateName` (lines
  ~297–302) and `brandName` (lines ~305–308). Catalog-match paths
  remain unchanged.

`apps/web/src/components/advisory/AdvisoryMessage.tsx`:

- Added a literal `'· '` separator inside the architecture span
  (line ~1921) so the header reads "Chord · FPGA" both visually
  and when copied as text.

### Tests

- `residual-blockers.test.ts > R2 > "Tell me about the Chord sound"
  produces capitalized candidateName / brandName`.
- `residual-blockers.test.ts > R2 > lowercase input still produces
  capitalized output` — guards against the user typing lowercase.
- `residual-blockers.test.ts > R2 > preserves catalog-match casing
  when a specific product matches (control)` — ensures we didn't
  disturb the catalog path.

Existing `blocker-fixes.test.ts > Blocker C` (four tests) all remain
green.

---

## R3. Eversolo role-label inversion

### Root cause

`detectUserAppliedRole` is given a raw message and a product name and
returns the user-asserted role by segmenting the message around the
product and scanning for nearby role keywords.

Two issues:

1. The segment-separator regex recognized arrows (`→`, `=>`, `-->`),
   `into`, and commas — but not " - " (whitespace-hyphen-whitespace).
   The labeled chain `speakers: X - amp: Y - streamer: Z` was one
   undifferentiated segment.
2. Within a segment, the first matching entry of `USER_ROLE_KEYWORDS`
   won. So `\bamp(?:lifier)?\b` could match an earlier "amp:" label
   even when the user had explicitly written `streamer:` next to the
   product — the colon was ignored.

Together, these caused "streamer: eversolo dmp-a6" to be read as
`amplifier`, producing a bogus role-conflict clarification.

### Fix

`apps/web/src/lib/consultation.ts` (`detectUserAppliedRole` and its
support constants):

- Added `USER_ROLE_COLON_PATTERNS` — the same set of role keywords but
  each followed by `\s*:`. Explicit colon labels are unambiguous user
  assertions.
- `detectUserAppliedRole` now scans colon patterns first and only
  falls back to bare-keyword scanning if none matched. This preserves
  all existing behavior on unlabeled chains.
- Added `\s+-\s+` to the segment-separator regex so " - " between
  labeled phrases splits segments as intended. Hyphens inside product
  names (`DMP-A6`, `LS50 Meta`) are untouched — the pattern requires
  surrounding whitespace.

### Tests

- `residual-blockers.test.ts > R3 > detectUserAppliedRole returns
  "streamer" for "streamer: eversolo dmp-a6"` — the exact QA case.
- `residual-blockers.test.ts > R3 > ... returns "integrated" for
  "amp: job integrated" (not streamer)` — verifies segment isolation.
- `residual-blockers.test.ts > R3 > ... returns "speaker" for
  "speakers: wlm diva monitors"`.
- `residual-blockers.test.ts > R3 > validateSystemComponents produces
  NO role-label conflict for correctly-labeled Eversolo streamer`.
- `residual-blockers.test.ts > R3 > still flags a genuine conflict:
  "streamer: chord qutest"` — control: real mislabels still caught.
- `residual-blockers.test.ts > R3 > still honors arrow-chain nearby
  keywords` — control: the existing "WiiM Pro DAC" arrow-chain path
  still returns `dac`.

Existing `validation-layer.test.ts` (role-label conflict, duplicate
role, chain-order ambiguity, and clean-pass cases) all remain green.

---

## Files changed

| File | Lines touched | Purpose |
|---|---|---|
| `apps/web/src/lib/consultation.ts` | +~55 | R1 stop-list + generic-word guard in seeding; R3 colon-label patterns + " - " separator |
| `apps/web/src/lib/product-assessment.ts` | +~22 | R2 display-casing helper applied at brand/product fallback |
| `apps/web/src/components/advisory/AdvisoryMessage.tsx` | +2 | R2 header separator so copy-paste reads "Chord · FPGA" |
| `apps/web/src/lib/__tests__/residual-blockers.test.ts` | +~310 (new) | Regression tests for R1, R2, R3 |

No unrelated files modified.

---

## Playbook and Portability compliance

- Engine vs Domain boundary preserved. The new `GENERIC_COMPONENT_WORDS`
  set and the colon-label patterns are configuration/vocabulary at the
  adapter layer of consultation.ts, not in portable core reasoning
  modules (tradeoff-assessment, preference-protection).
- `toDisplayName` is purely cosmetic — no semantic meaning attached,
  no audio vocabulary, domain-agnostic.
- No scoring, no hype, no urgency added. No copy changes outside the
  casing/separator fix required for R2.
- "No change" remained a legitimate outcome everywhere — fixes were
  subtractive (removing false positives) or cosmetic (casing/separator).

---

## Test results

```
residual-blockers.test.ts             11 tests   passed
Full suite                          2004 passed  (4 pre-existing
                                                   unrelated failures
                                                   in untracked WIP
                                                   lowPreferenceSignal
                                                   tests; no symbols
                                                   touched by this
                                                   pass are referenced)
```

The four unrelated failures are in `_sample_print.test.ts`,
`intent-evaluate-trace.test.ts`, `qa-full-pass.test.ts`, and
`start-here-block.test.ts` — all exercising `lowPreferenceSignal` on
the shopping advisory path. Grepped each for
`buildSystemAssessment`, `buildProductAssessment`,
`detectUserAppliedRole`, `toDisplayName`,
`GENERIC_COMPONENT_WORDS`, `USER_ROLE_COLON_PATTERNS`,
`isGenericComponentWord`, and for the user-visible strings
"Chord sound", "JOB Integrated", "Eversolo DMP", "streamer:" —
zero hits in each. These failures predate this pass.

---

## Clearance determination

This pass should clear R1, R2, and R3 from the post-fix Chrome QA
report. The three surfaces it exercised are:

- Saved-system + typed-chain interaction → generic-name seeding is
  now brand-gated.
- Homepage "Tell me about the Chord sound" → brand-only template
  renders "Chord · FPGA" with proper casing and a real separator.
- Explicit labeled-system parsing (" - " between `role:` segments)
  → colon labels win over keyword scan; segments isolate correctly.

Re-running the QA Part 1 prompts #2 (Bluesound/PrimaLuna/Harbeth with
and without localStorage), #3 (Chord sound), and #6 (labeled Eversolo
chain) should now render clean.

The remaining QA polish items — R4 (Rega/Planar 3 dedup), R5 (Topping
D90SE routing), R6 (warm-DAC misalignment) — are explicitly out of
scope for this pass per the stated priority (R1–R3 only) and the
playbook preference for scoped, reversible changes.
