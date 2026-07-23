# Audio XX — Launch Runbook (M5 production activation)

The order matters: schema first, then env, then deploy, then webhook,
then smoke. Nothing before step 6 affects live users.

## 0. Prerequisites (founder, one-time)

- Stripe account with **test mode** verified end-to-end first (journeys
  D–F below), then **live mode**: create the single product/price —
  *Audio XX My Systems*, **$3.00/month recurring**, no trial configured
  in Stripe (the trial is ours, server-side).
- Sentry project (optional but recommended): copy the DSN.

## 1. Back up production data

```sh
# From apps/web — full dump of the Turso database before any change
turso db shell audio-xx ".dump" > backups/prod-pre-m5-$(date +%Y%m%d).sql
```

## 2. Apply the additive schema

Apply exactly the DDL in `docs/billing-and-entitlement.md` (two tables,
three indexes; no existing table is touched). Verify:
`SELECT name FROM sqlite_schema WHERE name IN ('subscriptions','processed_stripe_events');`

## 3. Set production env vars (Vercel → audio-xx-web → Production only)

```
STRIPE_SECRET_KEY      = sk_live_…      (server)
STRIPE_WEBHOOK_SECRET  = whsec_…        (from step 5 — can be added after)
STRIPE_PRICE_ID        = price_…        (the live $3/month price)
BILLING_LAUNCHED_AT    = <the activation instant, ISO-8601 UTC>
SENTRY_DSN             = https://…      (optional)
NEXT_PUBLIC_SENTRY_DSN = https://…      (optional)
DEBUG_ERROR_TOKEN      = <random long string> (optional)
```

**`BILLING_LAUNCHED_AT` is the moment every pre-billing account's
3-month trial begins.** Set it to the real deploy time — do not backdate.
Keep test keys (`sk_test_`) out of Production scope entirely; the live/
test distinction is carried by the key prefix and never mixed.

## 4. Deploy

```sh
cd apps/web && npx vercel deploy --prod
```

## 5. Stripe webhook endpoint (live mode)

Stripe dashboard → Developers → Webhooks → Add endpoint:

- URL: `https://audio-xx.com/api/billing/webhook`
- Events: `checkout.session.completed`,
  `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET` (step 3) and
  redeploy if it was added after the deploy.

## 6. Smoke tests (live, ~10 minutes)

1. Anonymous: homepage → builder → assessment renders; copy link; print view.
2. Sign in (existing account): `/account` shows **Free trial** with the
   correct end date (launch instant + 92 days).
3. Save a system; rename it; edit notes — all work in trial.
4. `Stripe dashboard → Webhooks` shows the endpoint receiving events
   with 2xx responses (send a test event from the dashboard).
5. Optional real purchase: subscribe with a real card, confirm
   `/account` flips to "Subscriber", then cancel in the portal and
   confirm "paid through" is shown. (Self-refund in Stripe afterwards.)
6. 404: visit `/nonexistent` — editorial page, links work.
7. If Sentry configured: `GET /api/debug/error?token=…` then confirm
   the event in Sentry. Never share the token.

## 7. Where to look after launch

- **Funnel / product events:** Vercel → audio-xx-web → **Analytics →
  Custom events** (spec: `docs/analytics-events.md`).
- **Errors:** Sentry project dashboard (or Vercel → Logs if no Sentry).
- **Money:** Stripe dashboard (test/live toggle top-left — check it).
- **Webhook health:** Stripe → Developers → Webhooks → endpoint →
  delivery attempts.

## Pause checkout (kill switch)

Remove `STRIPE_SECRET_KEY` from Production env and redeploy (~1 min).
Checkout and portal return 503 "billing unavailable"; **everything else
keeps working**, existing subscribers keep entitlement (state is read
from the DB, not Stripe, at request time). Re-add the key to resume.

## Rollback

- **App:** `npx vercel rollback` to the previous deployment (billing
  tables are ignored by older code — additive schema means no
  incompatibility).
- **Schema:** leave the two new tables in place (they are inert without
  the code); dropping them is never required for rollback.
- **Data:** the step-1 dump restores everything in the worst case.

## Boundaries reaffirmed

- Never run destructive SQL against production.
- Never put a secret in a `NEXT_PUBLIC_` var, a commit, or a log.
- Node runtime: `engines` is pinned to 24.x (Vercel deprecates 22.x on
  2026-10-01); no action needed.
