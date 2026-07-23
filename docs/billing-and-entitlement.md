# Audio XX — Billing & Entitlement Specification (M5)

## Product model (founder-approved, one plan)

- **Always free, no account:** build, assess, composer, view, copy/share,
  print, open public links.
- **Free account:** initial saves free; **3-month My Systems trial from
  account creation, no card required.**
- **After trial expiry:** sign in, view My Systems, open systems, read all
  history, read names/notes, **remove systems** — all still work. What
  requires the subscription: save a new system, add an assessment, rename,
  edit notes. The prompt is calm ("Your collection is still here…");
  nothing is ever deleted or hidden.
- **One plan:** $3/month, cancel anytime. No annual, tiers, coupons,
  referrals, gifts, lifetime, or card-required trials.

## The entitlement rule

One shared server-side function (`apps/web/src/product/entitlement.ts`):

```
canManageCollection = active trial OR active paid access
```

Every protected route calls `requireManage(prisma, userId)`; a failure is
a typed 403 (`code: "subscription_required"`) carrying the entitlement so
the client can render the right prompt. **Viewing never consults it.**
No client state is trusted; no client-supplied price or entitlement exists.

### Trial calculation

```
trialStart  = max(user.createdAt, BILLING_LAUNCHED_AT)
trialEndsAt = trialStart + 92 days
```

- 92 days ≈ 3 months, constant-length, so the rule is a single pure
  function with no calendar edge cases.
- All arithmetic is UTC epoch milliseconds — **timezone-independent and
  deterministic** (pinned by tests). The server's locale can never move
  a boundary.
- The boundary is **exclusive**: one millisecond before `trialEndsAt` is
  trial; at the instant it is expired.

### Existing users (activation plan)

Accounts created before billing existed get the **full trial measured
from the launch instant**, not their signup date — that's the
`max(createdAt, BILLING_LAUNCHED_AT)` term; there is no special case in
code. At the production activation gate the founder sets
`BILLING_LAUNCHED_AT` to the actual activation timestamp (ISO-8601 UTC,
e.g. `2026-07-30T00:00:00Z`). Until it is set, the fallback
(`2026-07-23T00:00:00Z`) simply means every account is in trial —
harmless in every pre-activation environment. **No backfill, no
migration, no per-user writes are needed for existing users.**

### States

| State | Meaning | canManage |
|---|---|---|
| `trial` | Inside the trial window, no active paid state | yes |
| `subscriber` | Stripe status `active`, not cancel-scheduled | yes |
| `canceling` | Cancel scheduled or status `canceled`, **paid through `currentPeriodEnd`** | yes until period end |
| `past_due` | Payment failed — **grace** until `currentPeriodEnd`, then blocked until payment recovers | yes during grace |
| `expired` | Trial over, no paid access | no |

`incomplete` and any unknown provider status **never grant paid access**
(the trial rule still applies independently). A paid state can never
block an active trial.

### Webhook delay / outage degradation

Entitlement reads the last-known DB `Subscription` row. A lagging or
failed webhook therefore can only **delay an upgrade**, never grant
unpaid access. The common upgrade case is covered anyway: returning from
checkout with `?checkout=success&session_id=…` triggers a direct,
server-side sync of that session (`syncFromCheckoutSession`, which
verifies the session belongs to the signed-in user). If the billing
provider is entirely unreachable, `/api/billing/status` returns 503 and
the UI states billing is temporarily unavailable — reading is unaffected.

## Stripe integration

- **Checkout** (`POST /api/billing/checkout`): server creates the session
  with the server-side `STRIPE_PRICE_ID`; `client_reference_id` +
  `metadata.userId` bind it to the account; success/cancel URLs are fixed
  server-side (`/account?checkout=…`) — **no user-supplied redirects or
  price IDs anywhere**.
- **Portal** (`POST /api/billing/portal`): cancellation and payment
  management happen in Stripe's hosted portal.
- **Webhook** (`POST /api/billing/webhook`): raw-body signature
  verification (`STRIPE_WEBHOOK_SECRET`) — invalid signatures get 400 and
  are never processed. Then:
  - **Idempotency:** every event id is recorded in
    `processed_stripe_events` first; replays are acknowledged and applied
    zero times.
  - **Out-of-order safety:** `subscriptions.last_event_at` stores the
    event timestamp; an older event never overwrites newer state.
  - **User resolution:** `metadata.userId` → existing customer row →
    otherwise acknowledged as `no_user` (never guessing).
  - Handled types: `checkout.session.completed`,
    `customer.subscription.created/updated/deleted`. Everything else is
    acknowledged and ignored.
- **Cross-user protection:** checkout-return sync rejects any session
  whose reference doesn't match the signed-in user; the status route only
  ever reads the caller's own row.
- **Test/live separation:** key mode is intrinsic to the key strings
  (`sk_test_`/`sk_live_`); the runbook's activation gate is the only
  place live keys are introduced, and test keys never enter Production
  env scope.
- **No Stripe customer is created until first checkout.**

## The ten user states (all tested)

1. Anonymous visitor — full free product, no billing surface.
2. Active trial — full manage access, status line shows trial end.
3. Trial near expiry — status line switches to explicit end date (≤14 days).
4. Trial expired — read-everything, remove-allowed, manage blocked with calm prompt.
5. Active subscriber — full access, "Manage subscription" portal link.
6. Cancelled but paid-through — access retained to period end (`canceling`).
7. Past-due — grace to period end, then blocked; portal link to fix payment.
8. Returning from successful checkout — direct session sync, no webhook wait.
9. Returning from cancelled checkout — calm notice, nothing changed.
10. Billing state unavailable — 503 from status; viewing unaffected; degrades to last-known DB state.

## Schema (proposed for production — NOT applied)

Exact DDL (`prisma migrate diff` between the deployed schema at
`de13f5a` and the M5 schema): two new tables + three unique indexes,
**zero changes to existing tables** — purely additive, no rewrite locks,
no backfill.

```sql
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT NOT NULL,
    "stripe_subscription_id" TEXT,
    "status" TEXT NOT NULL,
    "current_period_end" DATETIME,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "last_event_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id")
      REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "processed_stripe_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "processed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");
CREATE UNIQUE INDEX "subscriptions_stripe_customer_id_key" ON "subscriptions"("stripe_customer_id");
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");
```

Rationale: one row per user (`user_id` unique) is the server-side
authority mirrored from webhooks; `processed_stripe_events` is the
idempotency ledger. The unique indexes are exactly the lookup paths
(by user, by customer, by subscription id). Applied to local dev.db
only; production application happens at the activation gate.

## Environment variables

| Variable | Scope | Purpose |
|---|---|---|
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | existing | Turso libsql |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | existing | auth |
| `STRIPE_SECRET_KEY` | new, server-only | `sk_test_…` until the activation gate |
| `STRIPE_WEBHOOK_SECRET` | new, server-only | `whsec_…` from the endpoint config |
| `STRIPE_PRICE_ID` | new, server-only | the single $3/month price |
| `BILLING_LAUNCHED_AT` | new, server-only | ISO-8601 UTC activation instant |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | new, optional | error monitoring (no-op when unset) |
| `DEBUG_ERROR_TOKEN` | new, optional | gates the controlled Sentry test route |

Validation behavior: with no Stripe vars set, checkout/portal return 503
("billing unavailable") and the rest of the product is unaffected. No
secret is ever read client-side; no `NEXT_PUBLIC_` var carries a secret.
