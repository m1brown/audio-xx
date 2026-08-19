# Independent-review evidence — store architecture

**Phase 6, overnight pass 2026-08-19. Specification only. No ingestion built.**

---

## The open question

One evidence store with a class discriminator, or separate manufacturer and
review stores?

## Recommendation

**Separate stores. Shared consumption shape.** Keep `EvidenceItem` as the
common interface every consumer reads; give `independent_review` its own
table, its own admission function, and its own governance — exactly the
pattern `ManufacturerFactV1` already establishes, and for the reasons its own
header already states:

> "They share a consumption shape (`EvidenceItem`), not a table: different
> provenance regimes, different admission rules, different revalidation
> cadence, and merging them would let one regime's governance drift into the
> other's."

That comment was written as an intention. This is the argument that it was
correct.

## Evaluated against each criterion

**Provenance integrity.** A manufacturer fact is admissible because the maker
published it on their own domain (`isFirstPartySource`). A review claim is
admissible on almost the opposite basis — that the source is *not* the maker.
One table means one admission function branching on class, and every future
change to one regime is a change to a function the other depends on. Two
tables means the first-party check cannot accidentally run, or accidentally
fail to run, on a review row.

**Different trust regimes.** `TIER_RANK` already orders `manufacturer` above
`independent_review`. That ordering is meaningful only if the two cannot be
confused at the row level. A discriminator column is one bad migration, one
missing `WHERE`, or one over-broad query away from collapsing.

**Source-specific metadata.** They barely overlap. Manufacturer rows need
`sourceUrl` + `quotedText` and nothing more. Review rows need publication,
reviewer identity, publication date, review context (system used, room),
and whether the unit was a loan or a sample. Forcing both into one table means
a wide table where half the columns are null for half the rows — and null
columns are where governance goes to die.

**Deduplication.** Manufacturer facts dedupe on `(productKey, field)` —
already the primary key, and correct, because a maker has one published
sensitivity. Reviews must NOT dedupe that way: three reviewers disagreeing
about a product's bass is the *signal*, and a primary key that collapses them
destroys the thing Critical Consensus exists to read. Two regimes with
incompatible identity rules do not belong in one table.

**Product-page consumption.** Unaffected — consumers read `EvidenceItem[]`,
and `readFactsForNames` already shows the shape a per-store reader takes. A
consumer wanting both calls both and concatenates. `physicalFactsFor` already
filters on `evidenceClass === 'manufacturer'` and would keep working
unchanged, which is the test that the shared shape is doing its job.

**Comparisons.** A comparison wants manufacturer specifications on both sides
(commensurable) and review opinion on both sides (not commensurable, and
presented differently). Separate reads make that distinction structural rather
than a filter every comparison surface has to remember.

**Critical Consensus.** This is the strongest argument. Consensus is a
computation over *multiple independent opinions about one product* — it needs
many rows per product, reviewer identity, and disagreement preserved. It is a
fundamentally different query shape from "the maker's published figure for
this field", which is a point lookup. Building both against one table
guarantees one of them is awkward forever.

**Citation rendering.** Review claims must render with attribution visible —
publication, reviewer, date. Manufacturer facts render as specifications with
a source link. Different rendering contracts; keeping them separate keeps
`REQUIRES_ATTRIBUTION` honest per class instead of per row.

**Preventing opinion becoming fact.** The decisive one. The whole risk is a
review's "sounds warm" acquiring the authority of a maker's "86 dB". With one
table that risk is a value in a column. With two, it requires writing to the
wrong store — a mistake that is visible in a diff and catchable in review.

## Specification sketch

```ts
interface ReviewClaim {
  productKey: string;
  evidenceClass: 'independent_review';
  tier: 'independent_review';
  scope: 'product';

  claim: string;               // what was said
  quotedText: string;          // required — the words, verbatim
  publication: string;         // must pass isWhitelistedSource
  reviewer?: string;           // resolves against REVIEWER_PROFILES
  publishedAt: string;         // ISO
  sourceUrl: string;

  /** Review context. A claim about bass in an untreated room is a claim
   *  about that room too, and dropping it launders conditions away. */
  context?: { system?: string[]; room?: string };
}
```

Primary key `(productKey, publication, publishedAt)` — **not**
`(productKey, field)`. Disagreement must survive storage.

Admission gate: `isWhitelistedSource(publication)` — the existing whitelist,
which is where the 6moons exclusion is already enforced.

## 6moons

**The exclusion is preserved and is not reconsidered here.** The standing
instruction (`source-whitelist.ts`, founder, 2026-07-31) is that 6moons
content may not be displayed, quoted, or linked anywhere in the product.

Note a live tension for whoever builds this: 6moons currently appears in
`REVIEWER_PROFILES` (`reviewers.ts`) and in a dormant `EVIDENCE_STORE` entry
(`kinki-ex-m1-6moons`), tolerated because the whitelist filter blocks them at
render. **Routing review ingestion through `isWhitelistedSource` keeps that
guarantee; routing it through `REVIEWER_PROFILES` would silently break it.**
That is a concrete trap, and it is the kind of thing a shared table makes
easier to fall into.

## Not built tonight

Ingestion is on the stop list. This specifies the store; it does not create
the class, write a migration, or acquire a single review.
