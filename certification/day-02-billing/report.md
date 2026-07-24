# Gate 2 — Billing & Entitlement QA · Report

Date: 2026-07-24 · Baseline: c62dcb1 · Environment: local dev + real Stripe test mode (CLI webhook forwarding)

## Recommendation: **PASS**

Zero defects. All ten user states verified against the live server —
three of them (subscribe, cancel, cancelled-return) through real Stripe
surfaces. All automated suites green. One test-harness pitfall
identified and neutralized (below); no product implication.

## Automated results

| Check | Result | Evidence |
|---|---|---|
| Product suite (incl. entitlement 19, billing 11, analytics 10) | 83/83, re-confirmed after manual phase | product-suite.txt |
| Structural no-delete grep on billing.ts | 0 destructive calls against user content | infra-check.txt |
| Webhook signature crypto, duplicate, out-of-order, null-regression, cancel_at | pinned in billing.test.ts (suite above) | — |
| Trial boundary ms-exact, timezone determinism, pre-launch accounts | pinned in entitlement.test.ts (suite above) | — |

## The ten user states — all verified live

| # | State | Verified via | Result |
|---|---|---|---|
| 1 | Anonymous | routes + page scan | status/save → 401; zero billing UI anywhere on the free product |
| 2 | Active trial | m5-trial sign-in | `trial`, 92 days, canManage |
| 3 | Trial near expiry | backdated account (12 days left) | copy switches to explicit date: "Free trial ends 5 August 2026" |
| 4 | Expired | 200-day-old account | `expired`; list/read notes 200; rename & save → 403 `subscription_required`; /systems shows "Your collection is still here." with the collection rendered below it (screenshot in transcript) |
| 5 | Subscriber | **real Checkout, 4242** | `subscriber`; rename 200; "Manage subscription" shown |
| 6 | Cancelled, paid-through | **real portal cancel** | `canceling`, paidThrough 2026-08-24 retained, editing still works — flipped by the webhook alone (cancel_at fix verified in the wild) |
| 7 | Past-due | DB-simulated via live server | grace (future period): canManage + rename 200; beyond grace: 403, reads intact; row restored byte-identically |
| 8 | Returning from successful checkout | real redirect | "Welcome to My Systems. Your subscription is active." with period end shown **on first return** (null-regression fix verified in the wild) |
| 9 | Returning from cancelled checkout | real cancel-return | "Checkout was cancelled — nothing was charged. Your collection is unchanged."; state untouched |
| 10 | Billing unavailable | key disabled + server restart | checkout/portal 503 "Subscriptions are not yet available."; entitlement served from last-known DB state (access retained); reads and assessments 200 |

Additional: free **remove** verified (DELETE 200, collection 0 after) —
the DELETE route has no entitlement guard by design (code + suite).

## Webhook lifecycle evidence

All deliveries in today's window returned 200 with valid signatures
(webhook-deliveries.txt). Live sequence observed: checkout events →
activation; portal cancel → `customer.subscription.updated` (cancel_at)
→ `canceling`. **Bonus authority demonstration:** when cleanup cancelled
the test subscription at Stripe, the resulting
`customer.subscription.deleted` webhook *re-created* the row my cleanup
script had deleted out-of-band — the webhook stream is authoritative
over ad-hoc writes, exactly the designed behavior.

## Defects

None. (S0: 0, S1: 0, S2: 0.)

## Findings that were NOT defects (recorded for honesty)

1. **Test-harness env pitfall.** A first past-due simulation ran
   `getEntitlement` in a standalone script without `.env.local`'s
   `BILLING_LAUNCHED_AT`, so the fallback launch date re-opened the
   trial and masked the blocked state. Re-verified through the live
   server (correct env): behavior correct. Lesson recorded: state
   simulations go through the running server, not standalone scripts.
2. **Secret-handling slip, contained.** A process-list check echoed the
   *test-mode* secret key into a local evidence file; it was scrubbed
   before commit. It also transited this session's local transcript.
   Risk: low (sandbox key, local machine). Founder may rotate the test
   key at leisure; live keys were never involved.

## Cleanup

cert-near/cert-expired users deleted (cascade); their Stripe test
subscription cancelled at Stripe; past-due simulation restored exactly;
Stripe key restored and verified; m5-trial/m5-expired fixtures intact
(cleanup.txt). Production untouched — `.env` DATABASE_URL confirmed to
be the local SQLite file; no script ever held Turso credentials.

## Estimated effort

| Area | Hours |
|---|---|
| Automation (suite runs, grep, webhook evidence) | 0.5 |
| Manual QA (10 states, 3 real Stripe surfaces, degradation test) | 2.5 |
| Fixes | 0 |
| Documentation (report, matrix, status) | 0.5 |
| **Total** | **~3.5** |

## Launch confidence

**Increasing.** The money path — the highest-risk surface in the
product — passed a full ten-state sweep with zero defects, and both
fixes from the Stripe integration day were observed working unprompted
in real flows. Two gates in: one S1 total, nothing wrong twice.

## Sign-off criterion

Ten-state table fully evidenced; zero open S0. **Awaiting founder
sign-off.**
