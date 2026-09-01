# M5 — Billing, Measurement, and Launch Operations: Milestone Report

Date: 2026-07-23 · Branch: version-b · Production remains at `de13f5a` (M5 NOT deployed)

## What was built

**Entitlement** (`apps/web/src/product/entitlement.ts`) — the single
server-side rule `canManageCollection = active trial OR active paid
access`, with the founder-approved model: 92-day trial from
`max(createdAt, BILLING_LAUNCHED_AT)`, UTC-exact exclusive boundary,
five states (trial / subscriber / canceling / past_due / expired),
canceled-retains-paid-through, past-due grace, unknown-status-never-
grants. Enforced via `requireManage` on save-new, add-assessment,
rename, and notes; viewing, printing, sharing, and **removal stay free
forever**. Full spec: `docs/billing-and-entitlement.md`.

**Stripe** (`billing.ts` + `/api/billing/{checkout,portal,webhook,status}`)
— server-fixed price ID, fixed return URLs, signature-verified webhooks,
idempotency ledger (`processed_stripe_events`), out-of-order guard
(`last_event_at`), cross-user checkout protection, checkout-return
direct sync (webhook lag can only delay upgrades), graceful 503
degradation when unconfigured.

**Measurement** — 21 canonical events through ONE vendor-swappable
layer (`analytics.ts` / `analytics-server.ts`) with an allowlist
sanitizer (nothing private can be transmitted — enforced in code, pinned
in tests) and once-per-load dedupe for view events. Spec:
`docs/analytics-events.md`. Wired at every funnel point from
landing_viewed to subscription_cancelled.

**Ops** — Sentry hook completion (router-transition capture; no-op
without DSN), token-gated debug-error route, editorial 404, Node
`engines: 24.x`, launch/rollback/pause-checkout runbook
(`docs/launch-runbook.md`).

**UI** — `/account` page (status line, checkout returns, portal link),
SubscriptionPrompt ("Your collection is still here." · $3/month ·
cancel anytime), calm blocked-state messages on rename/notes/save,
trial status line on My Systems.

## One product bug found and fixed during verification

`@vercel/analytics`'s `track()` silently **drops** events fired before
its script initializes — and every mount-time view event (the entire
top of the funnel: landing_viewed, assessment_rendered,
my_systems_viewed, subscription_prompt_viewed) fires before the root
layout's `<Analytics />` mounts. Without the fix, launch analytics
would have shown clicks but no views — exactly the "can't answer where
users drop out" failure this milestone exists to prevent. Fixed by
installing the vendor's own queue stub before emitting; verified live
(events now queue and flush on page load).

## Test results

- Product suite: **78/78** (41 existing + 37 new: entitlement 19,
  billing 8, analytics 10) — trial arithmetic incl. ms-exact boundary
  and pre-launch accounts, all entitlement states, DB-backed
  enforcement, real webhook signature crypto, duplicate/out-of-order
  events, no-user-data-deletion structural check, canonical event set,
  privacy sanitizer, once-per-load dedupe.
- Engine gate: **3,842 passed, 0 regressions** vs trusted baseline (20
  known-failing unchanged).
- Production build: clean; all new routes present
  (`/account`, `/api/billing/*`, `/_not-found`).

## Manual journeys (local dev, simulated billing states)

| Journey | Result |
|---|---|
| A Free visitor | ✅ build → assess → copy link → print, no account, no billing surface |
| B Active trial | ✅ "Free trial · 90 days remaining" on /account; save/rename work |
| C Expired trial | ✅ collection intact + readable, REMOVE offered, "Your collection is still here." prompt; rename → 403 `subscription_required` + calm message |
| D Subscribe | ✅ server-side (simulated `active` row → state subscriber, PATCH 200, "Manage subscription" shown) · ⚠ Stripe Checkout UI itself not exercised — **no Stripe keys exist in any environment** |
| E Cancel | ✅ server-side (`canceled` + future period → state canceling, access retained) · ⚠ portal UI needs keys |
| F Failed payment | ✅ past_due in grace = access; past period end = blocked 403 |
| G Measurement | ✅ events verified end-to-end in dev debug mode (incl. the queue fix); privacy sanitizer pinned by tests |
| H Error monitoring | ✅ debug route 404s without token; Sentry no-ops without DSN (DSN + controlled test happen at activation) |
| I Existing account | ✅ pre-billing account received trial from launch instant (unit-pinned + exercised in dev with backdated launch) |

Screenshots captured: active trial (/account), expired trial with
preserved collection + prompt (/systems), active subscription
(/account), 404, mobile expired state. Checkout/portal screens require
the founder's Stripe test account (see below).

## Proposed production schema (NOT applied)

Two additive tables + three unique indexes, zero changes to existing
tables, no backfill (exact DDL in `docs/billing-and-entitlement.md`).
Applied to local dev.db only.

## Existing-user activation plan

No migration and no special-case code: setting `BILLING_LAUNCHED_AT` to
the activation instant gives every pre-billing account the full 92-day
trial from that moment via the standard `max()` rule.

## What only the founder can do (activation gate prerequisites)

1. Create a Stripe account; run journeys D/E/F in **test mode** with
   real Checkout/portal UI (keys → env, per the runbook).
2. Create the single live $3/month price; configure the live webhook.
3. Optionally create a Sentry project (DSN).
4. Set `BILLING_LAUNCHED_AT` at deploy time.

## Recommendation

M5 is code-complete, tested, and verified everywhere that does not
require a Stripe account. **Ready for the production activation gate**
with one honest caveat: the Stripe-hosted surfaces (Checkout page,
billing portal) have never been exercised because no Stripe keys exist
anywhere — the first test-mode run-through per the runbook should
happen before live keys. Server-side correctness (signatures,
idempotency, ordering, entitlement, degradation) is covered by tests
that do not need the network.

Dev conveniences left in place: `BILLING_LAUNCHED_AT=2025-01-01` in
`apps/web/.env.local` (gitignored, documented inline) and two local
test accounts (m5-trial@ / m5-expired@example.com, password
`journey-m5-pass`) for manual poking.
