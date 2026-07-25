# Technical Production-Promotion Checklist — Audio XX

Prepared 2026-07-25. **Do not deploy without explicit founder approval.**
Scope: promote the certified release candidate to `audio-xx.com` with **paid
checkout disabled**. Commercial activation (live subscriptions) is a separate,
later, founder-controlled switch (§ Commercial activation, not in this deploy).

Certified release candidate: **`7e9805b`** (branch `version-b`).
Current production: `de13f5a` (older, uncertified). Promote the **complete** RC
as one deployment — do NOT cherry-pick individual fixes.

---

## A. Confirm the exact certified commit
- [ ] `git rev-parse HEAD` on `version-b` = `7e9805b` (or its intended
      descendant if any doc-only commits are added before promotion).
- [ ] Working tree clean; `version-b` pushed to origin.

## B. Production environment variables (non-billing operation)
Set/verify in the Vercel **Production** environment before promoting.

**Database (production Turso — NOT the local file):**
- [ ] `TURSO_DATABASE_URL` = production libSQL URL
- [ ] `TURSO_AUTH_TOKEN` = production token
- [ ] `USE_LOCAL_DB` **unset** (must NOT be present in production)

**Auth:**
- [ ] `NEXTAUTH_URL` = `https://audio-xx.com`
- [ ] `NEXTAUTH_SECRET` = production secret (JWT signing; required in prod)

**Assessment engine / composer (full function):**
- [ ] `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` (composer + knowledge lane)
- [ ] `ORCHESTRATOR_LLM_PROVIDER` / `ORCHESTRATOR_LLM_MODEL`
- [ ] `MEMO_LLM_PROVIDER` / `MEMO_LLM_MODEL`, `LISTING_EVAL_MODEL` (as used)

**Feature flags — MUST match the certified build** (the certified renderer and
editorial behaviour depend on these; a mismatch serves a different renderer):
- [ ] `NEXT_PUBLIC_ASSESSMENT_ARTIFACT_V2` = the certified value (the v2
      artifact is the certified renderer used in the conversation embed)
- [ ] `NEXT_PUBLIC_SYSTEM_ASSESSMENT_ARTIFACT`, `NEXT_PUBLIC_BRAND_HOUSE_VOICING`,
      `NEXT_PUBLIC_BRAND_AUTHORITY_PREVIEW` = certified values
- [ ] `NEXT_PUBLIC_VERCEL_ENV` / `NEXT_PUBLIC_SENTRY_ENVIRONMENT` = `production`
- [ ] `NEXT_PUBLIC_DEBUG` **off** in production

**Affiliate / monetization (non-billing revenue links):**
- [ ] `AMAZON_AFFILIATE_TAG`, `EBAY_CAMPAIGN_ID`, `EBAY_HOST`, `EBAY_CUSTOM_ID`
      (optional; set if affiliate links should be live)

**Rate limiting:** `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` (defaults acceptable).

## C. Keep checkout safely disabled (verified-off state)
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` **unset**
      in production. With these absent, `stripeConfigured()` is false and the
      checkout + portal routes return **503 "not yet available"** — no path can
      enter an incomplete live-payment state.
- [ ] `BILLING_LAUNCHED_AT` = the promotion date (or later). Fallback is
      2026-07-23; either way every account is inside its 92-day trial, so **no
      user reaches the subscribe boundary during the checkout-disabled window**
      and the Subscribe CTA is not surfaced. (Note: the Subscribe button is not
      itself gated on `billingAvailable`; the long trial is what keeps it out of
      sight. Acceptable for this window; commercial activation happens well
      inside 92 days.)
- [ ] Confirm no live Stripe products/prices exist yet (nothing to charge).

## D. Sentry (error monitoring on at promotion)
- [ ] `NEXT_PUBLIC_SENTRY_DSN` (client) and `SENTRY_DSN` (server) set to the
      production DSN; `enabled` follows DSN presence.
- [ ] `DEBUG_ERROR_TOKEN` set (for one controlled live-fire), then confirm
      `/api/debug/error?token=…` captures an event in the Sentry dashboard, and
      that without the token it is a no-op 404.

## E. Promote (one deployment, no cherry-pick)
- [ ] Confirm in the Vercel dashboard **how production is served** — which
      branch the Production environment tracks (e.g. `main`) and/or whether
      production is an alias promoted from a build. (No `vercel.json` in the
      repo; config lives in the Vercel project.)
- [ ] Promote the certified commit accordingly — either merge `version-b` →
      the production branch and let Vercel build, **or** build `version-b` and
      promote that deployment to the `audio-xx.com` production alias.
- [ ] Ensure the build is the certified commit (`7e9805b`), not a rebuild off a
      different HEAD.

## F. Mandatory post-promotion LIVE verification (founder-required)
Directly on `https://audio-xx.com` in a **fresh browser session** (not preview).
Capture browser evidence for each; a dashboard "deployed" is NOT sufficient.
- [ ] **1.** Deployed commit == certified RC (`7e9805b` / promoted descendant) —
      confirm via build metadata / deploy detail, and record the commit.
- [ ] **2.** `wLM` no longer appears in a rendered assessment — the WLM Diva
      system's trade line reads **"WLM Diva Monitor"**.
- [ ] **3.** The assessment is generated through the **certified renderer**
      (output matches the certified payload — verdict/credit/trade as certified,
      not a cached/legacy render).
- [ ] **4.** No stale deployment alias or old production build remains — the
      apex + every alias point at the new deployment.
- [ ] **5.** Tested on the actual public URL after deploy, fresh session.
- [ ] **6.** Principal journeys still work on prod: build → read → save →
      share (copy-link + unfurl) → print.
- [ ] **7.** Billing is correctly in the chosen state — checkout **disabled**
      (503 / not surfaced), no live-payment path reachable.
- [ ] Record: deployed commit hash + screenshots in
      `certification/day-11-beta/activation-verification/`.

## G. Rollback
- [ ] Before promoting, note the current production deployment id (`de13f5a`
      build) so it can be instantly re-promoted if F fails.
- [ ] Rollback = re-promote the previous deployment / revert the merge; verify
      the live site returns to the prior state.

---

## Commercial activation (SEPARATE, later, founder switch — not this deploy)
Enable live paid subscriptions only after: tax/entity decision complete; Stripe
Live account + keys verified; live products/prices/checkout/portal verified;
webhook delivery + entitlement confirmed in production. Then set the Stripe env
vars and re-verify the billing states live. This is deliberately decoupled from
the technical promotion above.

## Status
Checklist prepared. **Awaiting explicit founder deployment approval. Not
deployed. No post-launch feature work started.**

---

## Pre-execution confirmations (founder-required, 2026-07-25)

### 1. Migration is purely additive — CONFIRMED
Authoritative DDL from `prisma migrate diff` (prod `de13f5a` schema → certified
RC schema, computed offline, no DB connection). The complete migration is:
- `CREATE TABLE "subscriptions"` (+ FK to `users(id)` `ON DELETE CASCADE` — cascade
  is defined on the NEW table, it does not alter `users`)
- `CREATE TABLE "processed_stripe_events"`
- `CREATE UNIQUE INDEX` ×3 on `subscriptions` (`user_id`, `stripe_customer_id`,
  `stripe_subscription_id`)

Statement tally: **2 CREATE TABLE + 3 CREATE UNIQUE INDEX. Zero `ALTER TABLE`,
zero `DROP`, zero standalone `DELETE`/`UPDATE`.** No existing table or column is
changed; no data is modified or removed. The `User.subscription` relation added
in the schema is a Prisma virtual relation (the FK column lives on
`subscriptions.user_id`), so it produces no DDL against `users`.

### 2. Entitlement coupling — DELIBERATE ARCHITECTURE (recorded)
`getEntitlement()`'s unconditional `include: { subscription: true }` is a
**deliberate design decision, not incidental implementation.** Entitlement is
architecturally defined as a pure function `computeEntitlement(user.createdAt,
subscription | null, now)`: the state machine (trial / subscriber / canceling /
past_due / expired) branches on the subscription record (or its absence), so
every entitlement decision must read subscription state. The single joined
query fetches both authorities at once. The consequence — collection management
(My Systems) depends on the `subscriptions` table existing — is an intentional
property (management is gated by entitlement; entitlement = active trial OR
active subscription).

One honest nuance recorded for the record (NOT tech debt requiring pre-launch
work): the coupling has no graceful-degradation fallback for a missing table —
it fails closed (error) rather than silently granting access. For an
entitlement gate, fail-closed on an infrastructure fault is defensible; it is
also exactly why the additive migration is a hard prerequisite of this deploy.
Not a redesign item; recorded per founder request.
