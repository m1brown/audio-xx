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

### Three questions, not one

The counts only read correctly if these are kept apart:

- **classification** — what is *established* about a record;
- **displayed under staged `identity`** — what a reader sees *today*;
- **admissible under target `full` doctrine** — what would survive the
  invariant applied completely.

An earlier version of this document reported `provenance_ineligible: 96` beside
`138 displayed` without reconciling them, because that state merged two
different things: a source that is **prohibited** (a standing ruling) and a
source that was **never recorded** (a question never asked). They receive
opposite treatment, so 88 of 96 rows called "ineligible" were in fact being
displayed, and the classification could not be read as a display count.

They are now separate states, and **state alone determines display at each
level** — no caller re-derives the decision from `sourceClass` or host, and a
lock test asserts zero state→display mismatches.

| state | meaning | staged `identity` | target `full` |
| --- | --- | :---: | :---: |
| `admissible` | all three predicates established | shown | shown |
| `legacy_rights_pending` | correctly identified first-party asset, rights never recorded | shown, **temporarily** | shown |
| `identity_unverified` | nothing establishes which product this depicts | shown | withheld |
| `provenance_unestablished` | provenance was never recorded | shown | withheld |
| `provenance_prohibited` | reviewer, reseller, marketplace, 6moons, un-provenanced catalog | **withheld** | withheld |
| `identity_wrong` | the asset depicts a different product | **withheld** | withheld |

### The counts

**Registry — 156 rows.** Classification is mutually exclusive and sums to 156.

| state | rows | shown @ `identity` |
| --- | ---: | ---: |
| `provenance_unestablished` | 85 | 85 |
| `identity_unverified` | 38 | 38 |
| `provenance_prohibited` | 12 | 0 |
| `legacy_rights_pending` | 12 | 12 |
| `identity_wrong` | 9 | 0 |

- displayed under staged `identity`: **135** · suppressed: **21**
- displayable under `full`: **12** · suppressed under `full`: **144**

**Catalog — 28 `imageUrl` records** (13 `identity_unverified`, 11
`legacy_rights_pending`, 4 `provenance_prohibited`): **24 shown**, 4 suppressed;
**11** would survive `full`.

**Zero state→display mismatches** in either set, asserted by a lock test.

The morning report said 39 catalog records. The true count was 29, and is now
28 after one wrong image was removed; the 39 came from a bad grep.

Suppression always **retains the record**. The URL, and the fact a human once
curated it, are the raw material for verifying or regularising it later.
Deleting a suppressed row destroys the only evidence of what was checked.

## Enforcement is staged, and says so

The invariant is not staged. What is staged is the **withdrawal** of imagery
that pre-dates it.

Applying every predicate at once withholds **144 of 156** registry rows,
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
| `kef ls60` | `…ls60w…` | the **LS60 Wireless** — unresolved, held suppressed |
| `goldmund telos 590` | `Telos-690-low-res-9.png` | the **Telos 690** |
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

1. **Move to `full` enforcement?** The cost is 144 of 156 registry rows (134 shown today, 12 would survive). The
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

## Rights-regularization backlog

**No outreach was attempted.** Permission is never inferred, and asking is a
founder decision, not an overnight one.

The `legacy_rights_pending` class is small (12) and entirely single-asset, so
ranking it would answer the wrong question. The set that actually needs
regularizing is everything **currently displayed**: 140 assets, **90 with no
recorded credit at all**, spread across 90 distinct holders.

| displayed assets | holder | class |
| ---: | --- | --- |
| 6 | `www.schiit.com` | unclassified |
| 6 | `static.wixstatic.com` (Denafrips, Crayon, others) | unclassified |
| 5 | `chordelectronics.co.uk` | unclassified |
| 4 | local (`/brand-heroes`, `/images/products`) | unclassified |
| 4 | DeVore Fidelity | manufacturer |
| 3 | `www.hegel.com` | unclassified |
| 3 | `dam.focal-naim.com` | unclassified |
| 3 | Kitsune HiFi | authorized_dealer |
| 3 | `magnepan.com` | unclassified |
| 3 | `store.hifiman.com` | unclassified |

**60 holders have exactly one displayed asset.** That long tail is the real
shape of the problem: regularizing the top ten covers roughly 40 assets, and
the remaining hundred would need ~80 separate conversations. Any plan that
depends on clearing the tail will not finish.

Ranked by likely effort-to-yield:

1. **Documentable without outreach.** Makers publishing press or media-kit
   terms — Schiit, Chord, Hegel, Focal/Naim, Magnepan, HiFiMan, Topping. Their
   terms pages may already answer the question; reading one is cheap, and a
   recorded `published_terms` + `termsUrl` + `rightsCheckedAt` moves an asset
   to `admissible` with no correspondence at all. **Start here.**
2. **Dealers with an existing relationship.** Kitsune HiFi, Shenzhen Audio,
   Bloom Audio, Enleum. A dealer that wants the referral is the likeliest
   affirmative yes, and affiliate income already depends on these relationships.
3. **Direct outreach to small makers.** DeVore, Boenicke, Auditorium 23, EMT,
   SPEC, Sugden. Small enough to reach a decision-maker; these are also the
   brands the editorial roadmap cares most about.
4. **Generic CDNs.** `static.wixstatic.com` (6) cannot be attributed by
   hostname. Provenance has to come from the **embedding page**, so the source
   page must be recorded before the asset means anything.
5. **The tail.** 60 single-asset holders. Recommend deciding per *product
   demand* rather than per asset, consistent with demand-driven coverage.

**Three findings of the same shape.** Prohibited sources were reaching readers
not through a decision but through an ABSENCE — rows that record no tier, which
staged enforcement tolerates:

- two WiiM assets from `m.media-amazon.com` — marketplace listing images;
- `wlm diva` from `hifi-guide.com` — an editorial publication (F4), and its
  file is `WLM-Diva-Monitor.jpg` served under the plain `wlm diva` key, so it
  was **also** the wrong variant;
- `scott 222` from `preview.redd.it` — user-generated, provenance unknowable
  by construction.

All three hosts are now prohibited, consistent with rulings already made. This
is the standing hazard of staging, and the reason prohibited hosts are checked
against the URL itself rather than a tier a row may never have been given.

It also exposes a gap the detector does not close: `monitor` is not a
variant-significant token, so `Diva` → `Diva Monitor` was invisible to it. Left
as-is rather than widening the token list mid-closeout — the host rule already
withholds this asset, and widening it invites the false-positive problem that
got the sibling-model detector reverted.

## Local hosting — architecture, design only

**Nothing was downloaded.** Recorded so the decision is made on a design rather
than on a migration already half-done.

The strong prior — an immutable governed asset ID rather than a mutable URL —
**survives stress-testing**, for a reason the audit produced rather than assumed:

> The Eversolo DMP-A6 product URL now serves the **Gen 2**. The maker replaced
> the page in place; the URL did not move, the product it describes did.
> (`docs/defects/mutable-first-party-citation.md`)

A remote URL is therefore not a reference to an image. It is a reference to
*whatever that path serves today* — precisely the property that let a
successor's photograph reach a reader.

### Where the prior nearly fails, and why it still holds

A content hash alone is **not** sufficient as the identity. It answers "are
these bytes the ones we captured", which is integrity, not identity — the same
bytes can be re-keyed to the wrong product, which is exactly how the L2i-SE
photograph came to be filed under the L2i. Content addressing would not have
caught a single one of the eight wrong rows found here, because in every case
the file was intact and the *claim about it* was wrong.

So the durable reference must be a **governed asset ID** whose record carries
identity, with the content hash as one field inside it rather than as the ID:

| field | why it is load-bearing |
| --- | --- |
| `assetId` | opaque, immutable, the only thing a snapshot stores |
| `productIdentity` | exact brand + model + variant tokens — the claim being made |
| `contentHash` | integrity and duplicate detection; **not** identity |
| `sourceUrl`, `sourcePage` | the page is the provenance, not the file path — the answer for generic CDNs |
| `rightsBasis`, `termsUrl`, `rightsCheckedAt`, `rightsReviewDate` | terms change; a rights record without an expiry silently rots |
| `credit`, `attribution` | what renders beside the image |
| `capturedAt`, `mimeType`, `width`, `height` | retrieval facts |
| `identityStatus`, `sourceClass` | unchanged, still independent |

Decisions this design takes:

- **Duplicate files, distinct assets.** Two products may legitimately share
  bytes (an alias), and two rows sharing bytes may be a defect (Mojo / Mojo 2).
  Deduplicating by hash would erase the distinction the conflict detector
  depends on. Store once, reference twice, keep the identity claims separate.
- **Changed terms revoke.** `rightsReviewDate` passing moves an asset back to
  `legacy_rights_pending`, not silently onward. A rights record must be able to
  expire, or the grandfather clause returns by the back door.
- **Snapshots store the `assetId` only.** A frozen assessment must stay valid
  when an asset is later withdrawn — and, more importantly, must not be a route
  by which a suppressed image returns. A lock test already asserts the snapshot
  module contains no image URL at all.
- **Migration is gated on admission and never creates rights.** Only
  already-displayable assets are candidates; copying a file changes where it is
  served and nothing about whether it may be shown. A migration that quietly
  upgraded `none_recorded` to `admissible` would launder the exact gap the
  staging exists to keep visible. **This is the most likely way this goes wrong.**
- **Re-fetch differences are signals, not updates.** Different bytes at the same
  URL means the maker changed the page; that raises the citation-drift question
  rather than replacing the asset.

Cost: 153 remote assets. Worth doing only **after** the enforcement decision,
since `full` may leave far fewer assets worth hosting.

## `/brand-heroes` — a separate question

18 files, 16 rendered as brand-authority illustrations. **Governed separately
and deliberately so:** a brand hero answers "what does this maker stand for",
where a product image answers "is this the box you own". Applying an
exact-variant identity rule to an asset that makes no variant claim would be
the wrong test.

Their provenance is **better** than the product registry's: 16 of 16 rendered
heroes carry a credit *and* a first-party source URL, which 90 displayed
product assets do not.

| finding | detail |
| --- | --- |
| rights basis recorded | **0 of 18** |
| fair use *asserted* | `accuphase-e3000.jpg`, `goldmund-telos-670.jpg` |
| also used as product imagery | `marantz-2220b.jpg`, `goldmund-telos-690.jpg`, `leben-cs600.jpg` |
| hosting | all local — none can 404 or be swapped underneath us |

Two issues, neither of which is a deletion:

1. **"Curated under fair-use product reference" is a rights *claim*, not a
   record.** Fair use is a defence raised after the fact, not a permission
   granted in advance, and writing it into a credit line asserts a legal
   conclusion the evidence does not contain. It should be represented as
   `rightsBasis: none_recorded` with the reasoning kept as a note — the same
   discipline applied to every other unproven claim.
2. **Three heroes are also product photographs.** `leben-cs600.jpg` and
   `marantz-2220b.jpg` resolve through governed registry rows, which is
   legitimate. `goldmund-telos-690.jpg` was wired in as a catalog `imageUrl`;
   that route is now closed and it falls through to the first-party
   goldmund.com asset. This crossover is the thing to watch — an asset curated
   to illustrate a *brand*, reused to assert which *product* someone owns.

**Recommended transition policy** (not applied): keep all 18 rendering. Record
`published_terms` where the maker's site answers it, replace the two fair-use
assertions with honest `none_recorded`, and treat any hero that doubles as a
product photograph as a **product** asset subject to the full identity rule.
Nothing here is a correctness or prohibited-source violation, so nothing is
deleted or replaced.


## The sibling-model class, and one detector that was reverted

Two live defects surfaced only when the doctrine was stated as a **universal**
invariant over every product, rather than as named controls:

- `goldmund telos 590` pointed at a **Telos 690** photograph;
- the DeVore Orangutan **O/92** carried the **O/96** file as its catalog
  `imageUrl`, so a reader comparing the two saw the same loudspeaker twice.

Neither is a variant suffix and neither is a prefix extension, so no existing
detector saw them. They are *sibling model numbers*.

A filename-shape rule for this was written and **reverted**. It raised the
wrong-row count from 8 to 35, and every addition was noise: `_2000x.jpg` and
`_1024x.jpg` are Shopify dimension suffixes, `936e` and `459b` are UUID
fragments, `dsc0072` is a camera filename. Requiring a single candidate token
did not save it, because those filenames contain exactly one. **A detector that
cries wolf gets overridden, which costs more than the cases it catches.**

What worked instead is structural. When several keys claim one asset and the
filename corroborates exactly one, the others are suspect — but corroboration
alone is not enough, because **aliases fail it routinely**: `soundkaos vox`
matches `VOX_3.jpg` and `sound kaos vox` does not, though both name one
loudspeaker. Flagging those would withdraw correct photography and call a
spelling a wrong identity.

The discriminator is a **model token**: `590` appears in one key and nowhere in
the other, so they cannot be the same product; an alias differs only in how the
brand is written. That rule found the Goldmund pair with **no false positives**.

The O/92 was not a rule problem at all — its record was simply wrong, and the
image was removed with the reason recorded in place. First-party provenance was
never the issue: devorefidelity.com is DeVore's own site, and hosting says
nothing about *which* product a photograph depicts.

## Known limitation — diacritics

`Frérot` tokenises to `["fr","rot"]`, because the accented character is
stripped as a separator rather than folded. Any product whose name carries a
diacritic can therefore fail exact identity and receive **no image**, even when
a correctly-keyed first-party asset exists. Two catalog products are affected:
**Merason Frérot** and **dCS Bartók**.

This is a false SUPPRESSION, not a foreign photograph — it withholds a correct
image rather than showing a wrong one, so it is not a correctness risk to
readers. It is left unfixed deliberately: NFD normalisation would make imagery
newly visible, which is outside a closeout envelope restricted to conservative
changes. Recorded here as a founder decision, not carried out.
