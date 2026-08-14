# Known asymmetry: the personal-audio path diverges from other categories

**Opened:** 2026-08-13 · **Status:** WATCH DURING BETA — do not sweep
**Class:** engineering (structural), recorded as a ledger entry

## The finding

Three defects were found and fixed on 2026-08-13. Individually they read as
unrelated bugs. Together they are one shape: **headphones and IEMs travel a
different path through the engine than DACs, speakers, amplifiers and
turntables, and repeatedly miss protections the other categories receive.**

| # | Defect | Where the divergence sits |
|---|---|---|
| 1 | Headphone/IEM recommendations rendered with no purchase links; brand queries called catalogued makers "outside the current curated catalog" | `HEADPHONE_PRODUCTS` was absent from `ALL_PRODUCTS`, which feeds product lookup, brand resolution and the Subject Card |
| 2 | "cheap iems" / "what about cheap iems?" classified as `audio_knowledge`, so the knowledge lane carried the previous subject forward | `hasCategoryTarget` in `intent.ts` listed `headphones` but not `iems / earphones / earbuds` |
| 3 | Once routed, "cheap iems" answered with the $1,799 Solaris | `selectProductExamples` early-returns into `selectHeadphoneExamples` BEFORE the generic ranked path applies its affordability ceiling; `budgetConscious` was never passed in |

All three are repaired (commits `994b781`, `accca5c`, and the routing +
affordability fix), each with regression tests and negative controls.

## Why the seam exists

Not carelessness — structure:

1. **A separate catalogue file.** `products/headphones.ts` is its own module,
   and every shared pool that must include it is a hand-maintained list.
2. **An early return.** The headphone branch leaves `selectProductExamples`
   before the shared ranking pipeline, so every guard added to that pipeline
   (affordability ceiling, mainstream anchor ceiling, budget floor) has to be
   duplicated deliberately or it silently does not apply.
3. **Hand-maintained category vocabularies.** Several regexes enumerate
   category nouns. Adding a class means remembering every list.

Any one of these is reasonable. Together they mean a change made for "the
catalogue" often is not made for personal audio.

## What to watch in beta — signals, not a sweep

Founder decision (2026-08-13): record the asymmetry, **do not start a synthetic
sweep hunting every possible headphone-specific discrepancy.** Real usage
decides what matters. Watch for:

- A headphone/IEM answer that is missing something the same query produces for
  a DAC or speaker (links, resources, caveats, a budget guard).
- Any "not in the catalogue" claim about a maker we actually carry.
- Recommendations wildly off the requested price band in personal audio.

When one appears, check the shared-pipeline equivalent FIRST — the question is
almost always "does the non-headphone path already handle this?"

## Known and deliberately unaddressed

- **Cold-query anchoring in personal audio.** The generic path guards a cold
  query with a $6,000 mainstream anchor ceiling. Personal audio has no
  equivalent, so "recommend some iems" with no signal at all still anchors on
  the $1,799 Solaris. Category-relative, so the generic number would not help.
  Not fixed: no user has asked that way yet, and the affordability path now
  covers the phrasing that was actually reported.
