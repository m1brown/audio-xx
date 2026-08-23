# Image governance

**Status** governing · **Set** 2026-08-23 · **Enforcement** `identity` (staged)
**Code** `apps/web/src/lib/images/admission.ts` · **Audit** `docs/audits/image-admission.json`

## The invariant

A user-visible product image is fully admissible only when all three of these
are **independently** established:

1. **exact identity** — the exact product and variant;
2. **approved provenance** — manufacturer or verified authorized dealer;
3. **an affirmative recorded basis** to reproduce or display it.

None may be inferred from another. Recorded rights do not establish identity.
Verified identity does not establish provenance. A manufacturer host does not
establish permission.

Two consequences follow, and both are load-bearing:

- **Images have zero evidentiary authority.** An image may never establish
  identity for another evidence object, license a ProductFact, enter a
  calculation, become a D-12 premise, or support an interpretation or a
  recommendation. Presentation, never evidence.
- **No image is preferable to the wrong image.** Absence is a normal finished
  state. There is no coverage target, and coverage is never a reason to relax
  a predicate.

## Why one boundary

Three separate paths could put an image in front of a reader, and each enforced
a different rule:

| path | rule it enforced |
| --- | --- |
| `getProductImage` | exact identity + the F4 reviewer gate |
| `getProductImageEntry` | **substring** matching — `leben cs600` matched a CS600X |
| catalog `imageUrl` | **nothing**; `p.imageUrl ?? getProductImage(...)` won outright |

A rule enforced on one path out of three is not a rule. The exact-identity fix
had been applied to the first path only, so the defect it was written to
prevent stayed reachable through the other two — and the catalog was an
alternate trust boundary where neither identity nor provenance applied at all.

All three now resolve through the same boundary.

## The admission states

Derived from the atomic fields, never stored. A verdict kept beside the
metadata that justifies it drifts from it — the failure that once produced
three different values for one tonal axis.

| state | meaning | displayed |
| --- | --- | --- |
| `admissible` | all three predicates established | yes |
| `legacy_rights_pending` | correctly identified first-party asset, rights never recorded | yes, **temporarily** |
| `identity_unverified` | nothing establishes which product this depicts | staged |
| `provenance_ineligible` | prohibited source, or none established | staged / never |
| `identity_wrong` | the asset depicts a different product | **never** |

Suppression always **retains the record**. The URL, and the fact a human once
curated it, are the raw material for verifying or regularising it later.
Deleting a suppressed row destroys the only evidence of what was checked.

## Enforcement is staged, and says so

The invariant is not staged. What is staged is the **withdrawal** of imagery
that pre-dates it.

Applying every predicate at once withholds **143 of 156** registry rows,
because 93 were written before provenance was recorded at all and carry no
source block. Those images are not known to be wrong — they are unaccounted
for. Removing nearly all photography from the product surface is a product
decision with a measured cost, and it belongs to the founder, not to a refactor
asked to close correctness bypasses.

- **`identity`** (current) — withhold what is **wrong** or from a **prohibited**
  source. Both are correctness.
- **`full`** — additionally withhold every asset whose identity or provenance
  was never established. The invariant complete, and the intended end state.

`full` is provably a subset of `identity`; a lock test asserts it, so the
staging can only ever be more permissive, never differently permissive.

**Two things are never staged**, because both are standing rulings rather than
recordkeeping gaps:

- **Cross-brand leakage.** An un-provenanced catalog URL is withheld at every
  level, so a DeVore asset can never render on a KEF card.
- **Prohibited hosts.** Review publications (F4), used-gear resellers — The
  Music Room was ruled ineligible explicitly — and 6moons, which must never be
  used, displayed, or linked.

### Moving to `full`

The grandfather clause is a deadline. A lock test asserts that **no row yet
carries a rights basis** and that **zero rows are `admissible`**. When that test
starts failing because rows have real rights records, that is the signal to
move the enforcement level, not a test to relax.

## The detector is not an admission mechanism

`variantDisagreement(key, url)` compares a registry key against its asset's
filename. It answers one question: **do these disagree?**

It never confers identity. A filename that says nothing leaves the row
`unverified`, not verified — filenames are written by people too, and a
matching one proves only that two humans agreed. Only a check against the
source page yields `verified_exact`, and nothing in the codebase can do that.

Beyond the two wrong assets already known, it found six more:

| key | asset | what it actually depicts |
| --- | --- | --- |
| `linear tube audio z40` | `Z40i_004+…jpg` | the **Z40i** |
| `klipsch heresy` | `Heresy-IV_American-Walnut…` | the **Heresy IV** |
| `agd productions vivace` / `agd vivace` | `gran-vivace-mk-iv-…` | the **Gran Vivace MK IV** |
| `kef ls60` | `…ls60w…` | the **LS60 Wireless** — likely benign, see below |
| `chord mojo` | `Mojo-2-4.4-2-Edited…` | the **Mojo 2** |

The Mojo was found **structurally, not lexically**. Its filename names no token
from the variant list; what gives it away is that a *more specific key claims
the same file*. When one URL is claimed by two keys and one key's tokens are a
strict prefix of the other's, the two name different products, so at most one
can be depicted, and the less specific key is making the unsupported claim.

That test is deliberately narrow. Many keys share a URL as legitimate
**aliases** — `qualio iq` / `qualio audio iq`, `altec model 19` / `altec lansing
model 19`, `1995 immanis` / `raal requisite 1995 immanis`. Aliases vary at the
**front**, in how the brand is written, which the identity rule expressly
permits; variants append at the **end**. Only a suffix extension is a conflict.

It also cleared two false positives, which matters as much as the catches — a
detector that cries wolf gets overridden:

- a `+` in a URL is an encoded **space**, not the `LRS+` suffix. Reading
  `3+%284%29.jpg` as a variant claim accused a correctly-keyed Magico A3.
- a filename may **join** tokens a key separates: `eversolo-a6-gen2.webp`
  against the key `eversolo dmp a6 gen 2` is the same product.

## Open decisions for the founder

None of these were resolved autonomously; each needs a call.

1. **Move to `full` enforcement?** The cost is 143 of 156 registry rows. The
   alternative is recording provenance for the rows worth keeping.
2. **Re-key the six wrong rows?** Filename evidence says `klipsch heresy` should
   be `klipsch heresy iv`, and so on. But identity from a filename is a
   detector, not an admission mechanism, so re-keying on that evidence alone
   would violate the rule this work exists to enforce. They stay suppressed
   until someone checks the source page.
3. **`kef ls60` is probably benign.** The LS60 Wireless is the only LS60, so the
   asset is likely correct and the flag is the suffix rule being strict.
   Suppressed pending a look, because the conservative direction is the safe one.
4. **Denafrips is hosted on `static.wixstatic.com`.** Two first-party catalog
   assets are suppressed because a maker using a generic site builder is
   indistinguishable from a random host by hostname alone. This is a real limit
   of host-based classification and an argument for recorded provenance rather
   than a reason to loosen the test.
5. **Two `/brand-heroes/*.jpg` catalog assets** (Marantz 2220B, Goldmund Telos
   690) are served by Audio XX itself, and hosting a file answers neither who
   photographed it nor under what permission.

## Phase 5 — local hosting: design only

**Not implemented. No assets were downloaded.** Recorded so the decision is
made on a design rather than on a migration already half-done.

The founder's prior — an immutable governed asset ID rather than a raw URL —
survives testing, for a reason the audit itself demonstrates rather than
assumes:

> The Eversolo DMP-A6 product URL now serves the **Gen 2**. The maker replaced
> the page in place; the URL did not move, the product it describes did. (See
> `docs/defects/mutable-first-party-citation.md`.)

A remote URL is therefore not a stable reference to an image. It is a reference
to *whatever that path serves today*, which is exactly the property that let a
successor's photograph reach a reader. An asset ID fixes the bytes; a URL fixes
only the address.

What a migration would need, and why each part is load-bearing:

1. **Content-addressed IDs.** The ID derives from the bytes, so re-fetching a
   changed remote file yields a *different* ID rather than silently replacing
   the asset behind the same reference.
2. **Provenance travels with the asset, not the row.** `sourceUrl`,
   `rightsBasis`, `termsUrl`, `rightsCheckedAt`, `credit`, `captured` belong to
   the stored asset. Today they sit on a registry row and are lost the moment
   the row is edited.
3. **Local hosting does not create rights.** Copying a file changes where it is
   served and nothing about whether it may be shown. A migration that quietly
   upgraded `none_recorded` to admissible would launder the exact gap the
   staging exists to keep visible — the most likely way this goes wrong.
4. **Migration is per-asset and gated on admission.** Only rows that are already
   displayable are candidates. Downloading suppressed assets would build a
   library of material we have no basis to use.
5. **Drift detection stays.** Re-fetching a source URL and finding different
   bytes is a *signal* — the maker changed the page — and should raise the
   citation-drift question, not silently update.

The cost is real: 153 remote assets, storage, and a fetch pipeline. It is
worth doing only after the enforcement-level decision, because `full`
enforcement may leave far fewer assets worth hosting.
