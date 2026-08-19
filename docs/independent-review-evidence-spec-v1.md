# Independent-review evidence — specification v1

**Status:** specification only, 2026-08-19. NOT approved, NOT implemented.
Reconciled against the ManufacturerFact architecture now live (`f136e43`).

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
  observationType: ObservationType;
  claim: string;               // PARAPHRASE by default, Audio XX's words
  quote?: string;              // short, only where justified — see §4
  axis?: string;               // present only for listening observations
  direction?: string;          // e.g. 'warm', 'detailed' — only with axis
  retrievedAt: number;
}

type ObservationType =
  | 'listening'        // what the reviewer reports hearing
  | 'measurement'      // a figure the publication measured itself
  | 'comparison'       // this product relative to a named other
  | 'positioning';     // market/reference placement, class listings, price context
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

**One change to the live contract is required.** `REQUIRES_ATTRIBUTION`
currently demands `quotedText` for `independent_review`. Reviews are
paraphrased by default, so the rule must become: **`sourceUrl` and
`publication` are required; `quotedText` is optional.** That is a real
loosening of a live invariant and should be an explicit decision, not a
side effect — flagged rather than assumed.

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

**Scope is the sharp edge.** An observation is licensed **only for the exact
product reviewed**. The Reference 5 SE is not the Reference 5; the SRB is not
the QRC-2. Enforcement:

- store the product name as the publication wrote it, alongside `productKey`
- admission requires the article's own product designation to match the
  requested identity under the **same all-tokens rule corroboration uses**
- a sibling-model review is **not** admitted as weaker evidence. It is not
  evidence about this product at all.

**What each type may license:**

| Type | May be a D-12 premise? | Notes |
|---|---|---|
| `listening` | Yes, on its axis | at `independent_review` tier; bounds any relation it enters |
| `measurement` | Yes, physical domain | may feed the compatibility path **below** manufacturer facts |
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

## Narrow implementation sequence

1. **Decide the attribution change in §2** — `quotedText` optional for this
   class. Blocking, and a doctrine decision rather than an engineering one.
2. Types + admission gate + whitelist/domain check. No network. Tests first,
   including the Reference 5 SE and Acora sibling traps as negative fixtures.
3. Store, its own table, mirroring the manufacturer-fact store's two rules.
4. Acquisition route, three-state, demand-driven, one product per call.
5. Read path: `EvidenceItem` mapping and derived disagreement detection.
6. Assessment consumption — `listening` observations as D-12 premises only,
   attributed in prose. `positioning` deliberately NOT wired yet.
7. Acceptance on the beta products: dCS rich, ARC with the SE trap, Butler
   empty, Acora sparse. **An empty result for Butler is a passing test.**

`marketPosition` and Critical Consensus follow separately, after this is
stable.

## Unresolved, needing a decision

1. **§2 attribution loosening** — stated above.
2. **Break-in and conditioned observations.** The Reference 5 evidence is
   explicitly conditional ("after 500 hours"). Nothing in the current schema
   can hold a condition, and dropping it would misrepresent the source. Options:
   a `condition?: string` field, or refusing conditioned observations entirely.
   I lean toward the field, but it widens the schema and I would rather you
   chose.
3. **Whether `measurement` may outrank a manufacturer figure.** A publication's
   own bench measurement is arguably better evidence than a maker's published
   claim. The live ordering says otherwise. I have not changed it.
