# Independent-review evidence — specification v1

**Status:** APPROVED 2026-08-19 with three decisions, recorded in §2, §4a and
§4b below. Not yet implemented. Reconciled against the ManufacturerFact
architecture now live (`f136e43`).

Governing architecture, unchanged:

    separate evidence regimes → common typed interface → shared site-level consumers

Manufacturer facts and independent reviews stay separately stored and governed
because their provenance and permissible claims differ. A maker states what
they built; a reviewer states what they heard. Neither is the other, and
merging the stores would let one regime's governance drift into the other's.

## 0. Actual coverage for the beta products

Determined by search restricted to approved publications, not assumed.

| Product | Approved coverage | Usable? |
|---|---|---|
| **dCS Rossini APEX** | Stereophile (review, measurements, Recommended Components), Mono & Stereo, Hi-Fi+, Twittering Machines | **Rich** — review, measurement and positioning evidence all present |
| **Audio Research Reference 5** | The Absolute Sound (Ref 5), SoundStage!Ultra (Ref 5), Stereophile (**Ref 5 SE**) | **Good, with a scope trap** |
| **Butler MONAD A100** | **None found** | **Zero** |
| **Acora QRC-2** | Sibling models heavily covered (SRB, VRC, SRC-1, MRC-2); QRC-2 itself only in passing | **Sparse, with a scope trap** |

Two findings that shape the design more than any preference would have:

**The scope traps are the main risk, and they are already live.** Stereophile
reviewed the Reference 5 **SE** — a different product with doubled power-supply
capacitance and Teflon coupling capacitors. The Absolute Sound reviewed the
non-SE Reference 5 and found it "relatively airless and bloomless… closer to a
solid-state sound", then noted it "sounds glorious" after 500 hours. Attaching
either to the wrong variant would be a false claim carrying an approved
publication's authority. Same for Acora: the SRC/SRB/VRC/MRC line is well
covered and the QRC-2 barely is.

**Coverage is genuinely uneven, which validates demand-driven.** One of four
beta products has no approved coverage at all. A corpus-building approach would
have spent most of its effort on products no listener has asked about.

### A correction I owe

In earlier reconciliations I described the Acora QRC-2 as having a **granite**
cabinet, and used that as the worked example of a manufacturer fact worth
holding. **It is quartz.** Acora uses granite for the SRC/SRB line and quartz
for the QRC line, and their founder states the two behave differently.

I asserted it from model memory, repeatedly, with confidence, in exactly the
register this architecture exists to prevent. It is a small error and a large
illustration: the reasoning was fine and the premise was wrong, which is what
unattributable evidence does. Nothing in the product ever published it —
`filterUnlicensedRelationalProse` and the scope rules kept it out — but it
reached the founder in my prose, which is a surface with no licensing layer.

## 1. Storage schema

Its own table. Keyed by product identity, like every site-level regime.

```ts
interface IndependentReviewObservation {
  productKey: string;          // normalised identity; the ONLY join key
  publication: string;         // must be on SOURCE_WHITELIST
  reviewer?: string;           // where the publication attributes one
  sourceUrl: string;           // the original article. Required.
  publishedAt?: string;        // ISO date where stated
  productName: string;         // the product AS THE PUBLICATION NAMED IT
  observationType: ObservationType;
  claim: string;               // PARAPHRASE by default, Audio XX's words
  quote?: string;              // optional; only where exact wording matters
  axis?: string;               // present only for listening observations
  direction?: string;          // e.g. 'warm', 'detailed' — only with axis
  condition?: ObservationCondition;   // see below — part of the licence
  retrievedAt: number;
}

type ObservationType =
  | 'listening'        // what the reviewer reports hearing
  | 'measurement'      // a figure the publication measured on its sample
  | 'comparison'       // this product relative to a named other
  | 'positioning';     // market/reference placement, class listings, price context

/**
 * A material condition the observation depends on.
 *
 * DECISION (founder, 2026-08-19): an observation may carry a condition, and
 * that condition is PART OF THE LICENCE. It cannot be consumed without it.
 *
 * The Reference 5 is the case that forced this: The Absolute Sound found it
 * "relatively airless and bloomless" and then "glorious" after 500 hours.
 * Storing either half without the condition misrepresents the source, and the
 * condition is the only part a listener could act on.
 *
 * Modest and typed on purpose. Trying to model every possible condition now
 * would be an ontology built ahead of any observed need; `other` plus a
 * description absorbs what the five named kinds do not.
 */
interface ObservationCondition {
  kind: 'break_in' | 'setup' | 'mode' | 'associated_equipment' | 'level' | 'other';
  description: string;   // as the publication stated it, paraphrased
}
```

`observationType` is the load-bearing field. A measured THD figure, a
description of bass texture, and a Class A listing are three different kinds of
claim with three different licensing consequences, and flattening them into
"review said" is what makes review evidence dangerous.

## 2. Common evidence-interface mapping

```
EvidenceItem {
  productKey     ← productKey
  evidenceClass  ← 'independent_review'
  tier           ← 'independent_review'      (already in the live enum)
  scope          ← 'product'                 (always; see §4)
  field          ← observationType
  value          ← claim
  attribution    ← { sourceUrl, publication, author: reviewer, quotedText: quote }
  retrievedAt    ← retrievedAt
}
```

### DECISION 1 (founder, 2026-08-19) — attribution replaces quotation

`REQUIRES_ATTRIBUTION` demanded `quotedText`. For this class the requirement
becomes an ATTRIBUTION requirement instead. Every observation must retain:

- a faithful paraphrase (`claim`)
- **exact product identity** (`productName`, plus `productKey`)
- `publication`
- `reviewer` where the publication attributes one
- `sourceUrl`
- `observationType`

Verbatim quotation is **optional**, used sparingly where exact wording
materially matters.

This is not a weakening. The quote was standing in for auditability, and the
six fields above provide it better: a paraphrase with a source URL and a named
publication can be checked, while a quote alone cannot even establish which
product it was about. `manufacturer` keeps its quote requirement unchanged —
there the quote IS the fact, because a specification is a figure rather than a
judgment.

## 3. Acquisition and retrieval

Demand-driven, one product at a time, never bulk.

1. Trigger where a product identity resolves and no review evidence is held —
   same lazy shape as the power-match fetch, not a crawl.
2. Search restricted to `SOURCE_WHITELIST`. **6moons is excluded entirely** and
   its absence from the whitelist is the enforcement.
3. Retrieve the article; extract structured observations; **paraphrase**.
4. Admission gate, by analogy to `isManufacturerFactAcceptable`:
   - publication on the whitelist
   - `sourceUrl` host matches the publication's own domain (the
     `manualzz.com` lesson — a mirror is not the publication)
   - `observationType` in the controlled set
   - the article must name **this exact product** (see §4)
   - `quote`, where present, under a hard character cap
5. Three-state result — `observations` / `none` / `lookup_unknown` — with
   `none` a completed finding and `lookup_unknown` never cached, retried once.

## 4. D-7 / D-12 licensing rules

**Tier.** `independent_review` sits below `manufacturer` and above `model` in
the live ordering. A reviewer's account is attributable and checkable, and it
is not the maker's own statement of what they built.

### 4a. Exact-product scoping is a HARD ADMISSION REQUIREMENT

DECISION (founder, 2026-08-19). Reference 5 SE evidence is **not weaker
Reference 5 evidence — it is evidence about a different product**, unless an
observation explicitly applies across variants.

- store the product name as the publication wrote it (`productName`) alongside
  `productKey`
- admission requires the article's own designation to match the requested
  identity under the **same all-tokens rule corroboration uses**, so a trailing
  "SE" is a distinguishing token exactly as "Zenith" was for the invented dCS
- a sibling-model review is **rejected at admission**, not down-tiered
- an observation that the publication itself states applies across variants may
  be admitted for each, with the cross-variant statement recorded in `claim`

**Empty coverage is a legitimate result.** The whitelist is not widened to
eliminate zeros. Butler MONAD A100 returning nothing is the correct outcome
and is a passing acceptance test.

### 4b. Conditions travel with the observation

An observation carrying a `condition` may not be consumed without it. The
symmetry with brand scope is exact: brand-scoped evidence must name its maker
in the prose that uses it, and a conditioned observation must state its
condition. The same publication-boundary machinery applies — an expression that
drops the condition is dropped, not published.

### 4c. Independent measurement does NOT outrank manufacturer specification

DECISION (founder, 2026-08-19). No global precedence rule. They are separate
evidence types describing different things:

- **manufacturer specification** — what the maker publishes
- **independent measurement** — what the publication measured on ITS sample,
  under ITS stated conditions

Both may coexist and both may disagree, and the disagreement is informative
rather than an error to resolve. Consumers such as the compatibility
calculation may later define **field-specific** precedence explicitly; until
they do, **normalisation must never silently overwrite one with the other**.

Consequence for the live code: `physicalFactsFor` already filters to
`evidenceClass === 'manufacturer'` and therefore cannot absorb a review
measurement by accident. Any future independent-measurement projection is a
SEPARATE function, and any consumer wanting both states its own precedence at
the point of use.

**What each type may license:**

| Type | May be a D-12 premise? | Notes |
|---|---|---|
| `listening` | Yes, on its axis | at `independent_review` tier; bounds any relation it enters |
| `measurement` | Yes, physical domain | a SEPARATE type from manufacturer spec — see §4c, no global precedence |
| `comparison` | **No** | a claim about a pair, not about this product alone |
| `positioning` | **No** | Describe/stature only — never a sonic premise |

**Never silently converted into Audio XX fact.** A published observation stays
attributed in the prose that expresses it, exactly as brand-scoped evidence
must name its maker. The existing `hasBrandAttributionFor` machinery
generalises: attribution becomes component-local **and source-local**.

## 5. Disagreement, represented rather than averaged

Reviewers disagree, and the disagreement is often the most informative thing
present. Averaging destroys it and a score hides it.

- Every observation is stored **individually**, with its own attribution. There
  is no merge step and no aggregate field.
- A `disagreement` is **derived at read time**: two or more admitted
  observations on the same `axis` with opposing `direction`.
- Where one exists, the licensing rule is that Audio XX **may not assert either
  direction as settled**. It may state that approved sources differ, name them,
  and — where the assessment needs a direction — treat the axis as
  indeterminate rather than picking a side.
- This is the honest reading of the Reference 5 evidence: TAS found it
  "relatively airless and bloomless… closer to a solid-state sound" *and*
  "glorious" after 500 hours. That is a disagreement **with itself, conditioned
  on break-in**, and flattening it to "warm" or "lean" would lose the only part
  a listener could act on.

## 6. marketPosition / stature, without inferring owner intent

Review evidence is the **first legitimate source** for stature, and it works
because it is an observation about the PRODUCT, not about the owner.

Admissible as `positioning`: a publication's class listing (Stereophile
Recommended Components Class A), an explicit market-segment placement
("something of a best buy in the super-preamp category"), a stated retail price
in the publication's own words.

The rules from the frozen `marketPosition` note survive unchanged:

- stature is a **Describe** claim about products, aggregated to the system
- its consumer is **Evaluate**, as evidentiary burden for recommending change
- it may never become a claim about why the listener bought anything
- model-tier stature still earns nothing; `positioning` at
  `independent_review` tier does, because it is cited

`brandScale` remains a measure of company size and remains unusable for this.

## 7. Path to Critical Consensus

Critical Consensus is a **read-time projection of this store**, not a second
dataset and not a score.

Group admitted observations by `axis` (listening) or `field` (measurement),
show agreement and disagreement side by side, each attributed to publication
and reviewer, each linked to its source. Where sources agree, that is a
stronger Describe claim; where they differ, the disagreement is the finding.

No numeric aggregate, no star rating, no "consensus score" — those are exactly
the averaging §5 exists to prevent.

## Smallest implementation slice — proposed

**Slice 1: the admission contract. No network, no store, no consumption.**

Everything that can be got wrong permanently is decided here, and all of it is
testable offline against the four beta products.

Ships:

- `independent-review.ts` — `ObservationType`, `ObservationCondition`, the
  observation shape, and `isReviewObservationAcceptable`
- attribution requirement per §2 (paraphrase + exact product identity +
  publication + reviewer where available + sourceUrl + observationType)
- exact-variant admission per §4a, reusing corroboration's all-tokens rule
- publication must be on `SOURCE_WHITELIST`; source host must match the
  publication's own domain
- `toEvidenceItem` mapping to the live common interface
- the `REQUIRES_ATTRIBUTION` change in `evidence-types.ts`, scoped to this
  class so `manufacturer` keeps its quote requirement

Acceptance fixtures, exactly as you sequenced them:

| Product | Role | Passing behaviour |
|---|---|---|
| **dCS Rossini APEX** | rich positive | listening, measurement and positioning observations all admitted from Stereophile / Mono & Stereo / Hi-Fi+ / Twittering Machines |
| **ARC Reference 5** | variant + condition | TAS and SoundStage!Ultra admitted; **Stereophile's Ref 5 SE rejected at admission**; the 500-hour break-in observation admitted WITH its condition and rejected without it |
| **Butler MONAD A100** | zero-coverage | admits nothing, and that is a PASS |
| **Acora QRC-2** | sibling exclusion | SRB / VRC / SRC-1 / MRC-2 observations all rejected — different products, not weaker evidence |

Why this is the right first cut: it is one logical area, it needs no
infrastructure, and every rule the founder decided is exercised by a fixture
rather than asserted in prose. If the admission contract is right, the
remaining slices are plumbing of shapes already proven elsewhere.

**Then, each its own slice, in order:**

2. **Store** — own table, keyed by `(productKey, publication, observationType,
   claim-hash)` so multiple observations coexist and none overwrites another.
   Mirrors the manufacturer-fact store's two rules and its TEXT timestamp.
3. **Acquisition route** — three-state, demand-driven, one product per call,
   whitelist-restricted search, retrieve-and-paraphrase.
4. **Read path** — `EvidenceItem` mapping plus derived disagreement detection
   (§5). No stored aggregate.
5. **Assessment consumption** — `listening` observations as D-12 premises only,
   attributed and condition-stated in prose via the existing publication
   boundary. `positioning` deliberately NOT wired.

`marketPosition` and Critical Consensus follow separately. **No Critical
Consensus UI in any of these slices.**

## Decisions taken (2026-08-19)

1. **Attribution replaces quotation** for this class — §2.
2. **Conditioned observations admitted**, typed, condition part of the
   licence — §1 and §4b.
3. **No global measurement-over-specification rule** — separate types that may
   coexist and disagree; field-specific precedence deferred to consumers;
   normalisation never overwrites — §4c.

Also fixed: exact-variant scoping is a hard admission requirement (§4a); empty
approved coverage is a legitimate result and the whitelist is not widened to
remove zeros; Critical Consensus stores no score, average or consensus field
and remains a read-time projection (§7).

Nothing further is blocked.
