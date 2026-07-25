# Activation Verification Record — Audio XX production promotion

**Date:** 2026-07-25 · **Verifier:** live browser check of `https://audio-xx.com`
in a fresh session (not preview). This is the founder-required post-promotion
verification for the technical production promotion of the certified release
candidate. Checkout remains commercially disabled (Stripe unset).

---

## Deployment identity

| | |
|---|---|
| Certified commit (approved) | `7e9805b` (built from a detached checkout of exactly this commit) |
| Repo HEAD at deploy | `0c45744` = `7e9805b` + 2 doc-only commits (outside `apps/web`); `apps/web`+`packages` byte-identical, so the build is the certified build |
| New production deployment | `dpl_GVM4My5Lhz1qp41WDf9wF8NSWNvV` (`audio-xx-5cpv410hb-m1browns-projects.vercel.app`), readyState READY, target production |
| Deploy meta | `certifiedCommit=7e9805b2d8c99a2c066ce899013f21096bca7c9b`, `releaseGate=gate-11` |
| Previous production (rollback target) | `dpl_6hYBEXPsakA6VqgyH2D7AWdUDJEs` (`audio-xx-q9y15haep`, 22 Jul = `de13f5a`) |

Rollback = re-promote `dpl_6hYBEXPsakA6VqgyH2D7AWdUDJEs` (or `vercel rollback`) —
that deployment still exists and is Ready.

---

## Pre-deploy production database migration (additive, verified)

Applied the two M5 tables to the **production Turso** DB (`audio-xx-m1brown`)
via the project's established raw-DDL-to-Turso method (authoritative DDL from
`prisma migrate diff`, prod schema → certified schema, offline):

- BEFORE: 8 tables, 6 indexes. Neither `subscriptions` nor
  `processed_stripe_events` present. Row counts users=2, systems=4,
  system_components=12, profiles=2, preference_snapshots=0.
- APPLIED: 2 `CREATE TABLE` (`subscriptions`, `processed_stripe_events`) +
  3 `CREATE UNIQUE INDEX`. Zero ALTER/DROP/DELETE/UPDATE.
- AFTER: 10 tables, 9 indexes. **New = exactly the two tables + three indexes.
  Removed = none. Existing row counts unchanged.** No user data touched.

This is the hard prerequisite for My Systems under the entitlement gate
(`getEntitlement` joins `subscription`; fail-closed if the table is absent).

---

## Seven-point live verification (all on `https://audio-xx.com`, fresh session)

1. **Deployed commit == certified RC.** Built from a detached checkout of
   `7e9805b`; deployment `dpl_GVM4My5Lhz1qp41WDf9wF8NSWNvV`; deploy meta records
   the full SHA. Behavioural corroboration in (2)/(3) proves the certified code
   (≥ `d42c24a`) is what is live. **PASS.**

2. **`wLM` no longer appears.** Built the WLM Diva system
   (Eversolo DMP-A6 · Job integrated · WLM Diva monitor). The rendered
   assessment reads **"WLM Diva Monitor"** in (a) the small-caps credit line,
   (b) the body prose — *"WLM Diva Monitor carries it without thinning it out"*,
   and (c) the share `og:description`. **No `wLM` anywhere.** Production baseline
   (`de13f5a`) rendered mid-sentence `wLM`; the Gate-5 proper-name-safe
   `lowerFirst` fix is now live. **PASS.**

3. **Certified renderer (v2 editorial artifact).** Output is the v2
   `AssessmentArtifact`: masthead "AUDIO XX / 25 JULY 2026", verdict-first
   ("Nothing here needs changing."), italic standfirst, credit line, Evidence
   section, Recommendation ("Leave it alone."). Matches the certified payload
   shape and the calm-restraint doctrine. `NEXT_PUBLIC_ASSESSMENT_ARTIFACT_V2`
   is set on Production. **PASS.**

4. **No stale alias / old build.** `vercel inspect` on the new deployment shows
   it holds every production alias — `audio-xx.com`, `www.audio-xx.com`,
   `audio-xx-web.vercel.app`, and the project aliases. The prior deployment no
   longer holds them. **PASS.**

5. **Tested on the live public URL after deploy** (not preview), fresh browser
   session. Homepage `HTTP 200`. **PASS.**

6. **Principal journeys.** build → read → share → print all present and working
   on prod:
   - **build/read:** assessment generated from the builder and rendered.
   - **share (copy-link):** permalink
     `https://audio-xx.com/artifact?system=Assess%20my%20system%3A%20Eversolo%20DMP-A6%2C%20Job%20integrated%2C%20WLM%20Diva%20monitor`
     copied and resolves to the permanent artifact.
   - **share (unfurl):** `og:title` = the verdict
     ("Nothing here needs changing — Audio XX System Assessment");
     `og:description` = standfirst + correctly-cased credit line;
     `twitter:card` = summary. (`og:image` null = the deferred
     generated-OG-image roadmap item, not a regression.)
   - **print:** Print button present and wired (Gate-9 print CSS certified).
   - **save:** "Save this system" button present and wired; the *authenticated*
     save round-trip is the standing founder-manual prod check (auth features
     are not injected/impersonated in QA). **PASS (save round-trip = founder-manual).**

7. **Billing correctly disabled.** `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` /
   `STRIPE_WEBHOOK_SECRET` unset in Production, so `stripeConfigured()` is false.
   `POST /api/billing/checkout` and `/portal` return **401** unauthenticated
   (auth gate first); for an authenticated user the code returns **503**
   "Subscriptions are not yet available." No live-payment path is reachable.
   `BILLING_LAUNCHED_AT` explicitly set to `2026-07-25T00:00:00Z` (not the
   fallback), so every account is inside its 92-day trial and the Subscribe CTA
   is not surfaced. **PASS.**

---

## Production env changes made for this promotion

Added to the **Production** environment to match the certified (version-b) build
and honour the founder's tightening request:

- `NEXT_PUBLIC_SYSTEM_ASSESSMENT_ARTIFACT=on`
- `NEXT_PUBLIC_BRAND_HOUSE_VOICING=on`
- `NEXT_PUBLIC_BRAND_AUTHORITY_PREVIEW=on`
- `BILLING_LAUNCHED_AT=2026-07-25T00:00:00Z`

(`NEXT_PUBLIC_ASSESSMENT_ARTIFACT_V2` was already on Production. The certified
v2 pipeline is independent of the three legacy flags — grep-confirmed — so the
main assessment output is governed by V2 alone; the three flags are set for full
config parity with the certified build.)

Stripe live variables deliberately left **unset** (commercial activation is a
separate, later founder switch).

---

## Not-yet-done (founder-owned, flagged — NOT part of this technical promotion)

- **Sentry DSN unset in Production.** `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN`
  are absent, so error monitoring is a no-op. The app functions normally without
  it; wiring the DSN + one controlled live-fire remains a founder activation
  prerequisite (needs the DSN value, which is founder-owned).
- **Authenticated prod checks** (Save round-trip, My Systems, history, account)
  are the standing founder-manual verification — not injected in automated QA.
- **Commercial activation** (tax/entity, Stripe Live, live products/webhook)
  remains the separate later switch.

## Cosmetic observation (consistent with deferred backlog)
- Component image frames render empty for these uncataloged components — the
  Gate-11-deferred external-image-repair item, not a new regression.

---

## Result
Technical production promotion of the certified release candidate is **complete
and verified**. All seven verification points pass on the live domain (save
round-trip and Sentry live-fire are the flagged founder-manual/founder-owned
items). Production database migrated additively with no data touched. Checkout
remains commercially inactive. No post-launch feature work started.
