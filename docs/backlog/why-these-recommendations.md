# "Why these recommendations" — explaining the shortlist

**Opened:** 2026-08-13 (founder request)
**Status:** SPECCED, NOT BUILT. Post-beta.
**Class:** feature — causal explanation applied to recommendations

## The request

> "I'd really like a 'why these recommendations' feature where i could click a
> button and get an accurate answer as to how the recommendations were made"

Emphasis on **accurate**. The failure mode is worse than the absence: a button
that produces a plausible-sounding rationalisation would be exactly the
generated-prose defect tracked in `machine-voice-editorial.md`, except now
attached to the product's most load-bearing claim.

## Why it matters commercially

It is the honest answer to the most common objection a knowledgeable audiophile
raises — "this is just ChatGPT." A recommender that can show its work is
categorically different from one that cannot. It is also the reason the phrase
"Why did you recommend that one?" was deliberately withheld from the composer's
rotating placeholders on 2026-08-13: the product could not yet answer it.

## Hard requirement: report, do not narrate

The explanation must be generated FROM the ranking that actually ran — not
composed afterwards from the same inputs. If the two can drift, the feature is
a liability. Practically this means the selector must emit a trace, and the
explanation must render that trace.

## What the engine already knows (no new data required)

`selectProductExamples` / `selectHeadphoneExamples` in `shopping-intent.ts`
already apply, in order:

1. **Category constraint** — `requestedCategory` as a typed immutable
   constraint (routing doctrine), incl. the IEM form-factor filter (REC-1).
2. **Budget window** — `budgetAmount`, `budgetFloor`, `budgetConscious`.
3. **Hard constraints** — `ctx.constraints`, power/sensitivity partner checks,
   dependency rules.
4. **Trait/axis fit** — extracted + stated traits scored against product
   `traits` and `tendencyProfile`.
5. **Diversity and anti-repetition** — `recentProductNames`, `engagedProductNames`,
   anchor/role assignment (`isPrimary`, `pickRole`).

Every one of those is a fact about why a product survived or did not. None of
it is currently surfaced.

## Proposed shape

A `SelectionTrace` emitted alongside `productExamples`:

```
{
  category: 'headphone', formFactor: 'iem',
  budget: { ceiling: 100, floor: undefined },
  poolSize: 9, afterCategory: 9, afterBudget: 2, afterConstraints: 2,
  picks: [{ name, survivedBecause: [...], rankedOn: [{ trait, weight, productValue }] }],
  nearMisses: [{ name, excludedBy: 'budget', detail: '$179 exceeds $100 ceiling' }]
}
```

Rendered behind a disclosure control on the recommendation block — not open by
default; the advisory voice stays primary.

**Near-misses are the most valuable part.** "The AONIC 3 fits your description
but is $179" is more useful and more trust-building than any positive rationale,
and it is impossible to fake because it names a specific product and a specific
threshold.

## Admission rules (D-7 / D-8)

- Report only what the selector actually did. If a stage did not run, say
  nothing about it — never infer a reason after the fact.
- Distinguish a **constraint** (budget, category, power) from a **preference
  weighting** (trait fit). They have different epistemic weight and the user
  should be able to tell them apart.
- Where ranking used a low-confidence tendency profile
  (`tendencyProfile.basis === 'listener_consensus'`), say so — the explanation
  must not present consensus inference as measurement.
- No teleology, no flattery, no "we chose this because you deserve".

## Success measure

A skeptical tester reads the explanation and can state, in their own words,
one concrete reason a product they expected was NOT in the list. If they
cannot, the feature has not worked.

## Related

- `machine-voice-editorial.md` — the anti-pattern this must avoid, and the
  Dominant Character rebuild (same discipline: name causes, not restatements).
- Routing doctrine (`docs/routing-doctrine.md`) — the category constraint is
  the first thing any explanation must report.
