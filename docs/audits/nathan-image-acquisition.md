# Nathan — image acquisition pass

**Date** 2026-08-24 · **Result** NATHAN IMAGE COVERAGE: **0 / 4**
**Enforcement unchanged** — staged `identity`. No governance rule was altered.

## Why this is recorded here and not in the registry

Every candidate below is **first-party and identity-established**, which is
exactly what makes recording them in `PRODUCT_IMAGE_URLS` dangerous: a
manufacturer-tier row with `rightsBasis: none_recorded` derives to
`legacy_rights_pending`, and that state **displays** under staged enforcement.
Adding these rows would admit, through a side door, the four assets this pass
concluded are not admissible.

The grandfather clause covers assets that pre-date the invariant. A newly
acquired asset gets no grandfathering: all three predicates are required.

## The table

| Product | Candidate | Source | Identity | Rights | Admitted |
| --- | --- | --- | --- | --- | --- |
| **dCS Rossini Apex** | none obtainable | `dcsaudio.com` | **✗ not establishable** | not reached | ✗ |
| **Audio Research Reference 5** | `REF5_Manual.pdf` (non-SE) | `audioresearch.com/new_website/wp-content/uploads/2024/11/` | ✓ first-party literature, explicitly the non-SE model | ✗ "© 2026 Audio Research. All rights reserved"; no media kit, no press terms | ✗ |
| **Butler MONAD A100** | `monad002.jpg` | `butleraudio.com/esoteric.php` | ✓ maker's own MONAD page | ✗ "© 1995-2026 Butler Audio Inc. All rights reserved" **and** "Use of these trademarks is by permission only and is strictly enforced" | ✗ |
| **Acora QRC-2** | `QRC-2-1500-1.jpg`, `QR2-front-white-1500.jpg`, and 8 further exact assets | `acoraacoustics.com/qrc-2-product-page/` | ✓ **strongest of the four** — the embedding page is the QRC-2 product page, so identity rests on the source page, not on the filename | ✗ "© 2026 Acora Acoustics. All rights reserved" | ✗ |

## What each blocker actually is

**dCS — identity, not rights.** Every page on `dcsaudio.com` returns **403** to
this client while `/assets/…` returns **200**. So a file can be fetched but the
page that would say which product it depicts cannot. Guessing asset paths would
rest identity on a filename — a defect detector, never admission evidence — and
would amount to probing around an access control. Neither is acceptable, so the
attempt stops at identity and never reaches the rights question.

**ARC, Butler, Acora — rights, and rights alone.** Identity and provenance are
established. Each maker publishes an explicit **all-rights-reserved** notice and
none publishes media-use terms, a press kit, or downloadable press assets that
grant reproduction. Butler goes further and states that use is by permission
only and is enforced.

An all-rights-reserved notice is not an absence of information. It is a
**positive statement that permission has not been granted** — which is a
stronger negative than the `none_recorded` state most legacy rows sit in, and
it cannot be resolved by looking harder.

## What this pass changed

Nothing renders that did not render before, and nothing was weakened. What
changed is the quality of the answer: for three of the four products the rights
question moved from *unknown* to *explicitly reserved*, and for the fourth the
blocker is now known to be identity rather than rights.

## What would unblock it

A short permission request to four companies — Acora, Butler, Audio Research,
dCS — asking whether their product photography may be reproduced in a listener's
system assessment with credit. That is correspondence, which this pass was
scoped to exclude, and it is a founder action.

Acora is the one to ask first: identity is already established from the product
page itself, the assets are numerous and high-resolution (1500px), and only the
rights record is missing. A single "yes" would take Nathan from 0/4 to 1/4 with
no further engineering.
