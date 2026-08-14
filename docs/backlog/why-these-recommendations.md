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

---

## Extension 2026-08-13 — "are my preferences actually being used?"

Founder, viewing https://audio-xx.com/profile:

> "is this profile used in the recommendations? perhaps we need a toggle -
> on / off so people know if their preferences are being used"

### What the code actually does (verified, not assumed)

`tasteProfile` **is** passed into every `buildShoppingAnswer` call in page.tsx
and does influence ranking — but conditionally:

```
shopping-intent.ts (two ranking sites)
  if (tasteProfile && tasteProfile.confidence > 0.2) {
    profileWeight = tasteProfile.confidence * 0.15
    // bonus applied to the top TWO profile traits, then re-sort
  }
```

`taste-profile.ts` states the design intent in its header: *"The profile acts
as a soft prior… Conversation signals always take precedence… Profile influence
is gated by confidence (max 30% at full confidence). Empty profiles have zero
influence."* `buildWhyThisFitsYou` applies the same `confidence < 0.2` gate.

So there are three distinct states, and today the user can distinguish none of
them:

| State | What happens | What the user sees |
|---|---|---|
| No profile / empty | zero influence | nothing |
| Profile, confidence ≤ 0.2 | **silently ignored** | nothing |
| Profile, confidence > 0.2 | ranking bonus, top 2 traits, ≤30% at full confidence | nothing |

### Why a plain on/off toggle is the wrong fix

A toggle would report the user's *intent*, not the system's *behaviour*. Set to
"on" with a low-confidence profile, it would say preferences are being used
while ranking ignored them — a UI element that lies, which is worse than the
current silence and squarely against D-7.

### What to build instead

Fold this into the selection trace above. The trace already has to report which
stages bound; profile influence is simply one more stage, with three honest
outputs:

- **"Your listening profile did not affect this list"** — no profile, or below
  the confidence threshold. Say which, and what would raise it.
- **"Your listening profile shifted the order"** — name the traits that carried
  weight (the top two the code actually used) and that it re-ranked rather than
  filtered. It never adds or removes candidates.
- **"Conversation signals took precedence"** — when stated preferences in the
  turn overrode the stored prior, which is the documented design.

A control may still be worth offering, but it should be *"ignore my saved
profile for this question"* — an override the engine genuinely honours — rather
than a status light claiming an influence that may not exist.

### Success measure

A user who has filled in a profile can tell, without asking, whether it did
anything to the list in front of them — and if it did not, why not.
