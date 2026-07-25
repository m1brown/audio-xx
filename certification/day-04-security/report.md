# Gate 4 — Privacy, Authentication & Security · Report

Date: 2026-07-25 · Baseline: 95e20c5 · Environment: local dev, live
server probes + production build for the bundle scan.

## Recommendation: **PASS**

Every cross-user access attempt is denied, no secret reaches the client
bundle, unsigned webhooks are rejected, and no private data appears on a
public surface. Zero S0. Zero S1. Two S2 hardening niceties logged to
POST_LAUNCH (the plan pre-classifies these as non-blocking).

## Probe matrix (all deny)

| # | Probe | Result |
|---|---|---|
| D1 | Cross-user read blocked on every route | ✅ B never sees A's system; `/api/systems/[id]` → 404 |
| D2 | Cross-user write/delete blocked | ✅ B PATCH rename → 404 · PATCH notes → 404 · DELETE → 404 · set-active-profile → 400 "does not belong to this user" |
| D3 | Cross-user checkout-session sync rejected | ✅ foreign/bogus `session_id` never activates the caller (`syncFromCheckoutSession` checks `client_reference_id === userId`) |
| D4 | No secret in client bundle | ✅ 75 chunks; no `sk_`/`whsec_` prefix; no real value of STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / NEXTAUTH_SECRET / DATABASE_URL |
| D5 | Public artifact links never expose private names/notes | ✅ the public artifact is generated from URL free-text only — it never reads saved rows, so private data cannot leak by construction |
| D6 | Auth: wrong password rejected; session sane | ✅ wrong password → `authorize` returns null (no session); JWT strategy, hardcoded `/systems` post-login nav |
| D7 | No open redirect on checkout/auth returns | ✅ all return URLs server-built from `NEXTAUTH_URL`; sign-in uses `redirect:false` + hardcoded push — no user-controlled target |
| D8 | No user-controllable price ID | ✅ checkout uses `process.env.STRIPE_PRICE_ID` server-side; entitlement is one server function |
| D9 | Test/live key confusion impossible | ✅ single `STRIPE_SECRET_KEY` read server-side; env-scoped (test in dev/preview, live added only at founder activation); no live key present now |

Unauthenticated sweep — every protected route returns **401** (systems,
my-systems, billing status/portal/checkout, profile, systems/[id]);
landing is public 200. Webhook: missing signature → **400**, bad
signature → **400**, DB never touched.

Cross-user integrity check after B's full attack run: A's system still
exists, name intact, notes intact — nothing B did modified A's data.

## Automated results

| Check | Result |
|---|---|
| Route/billing/entitlement/save/history suites | 52/52 |
| Full product suite | 84/84 |
| Engine regression gate | PASSED (3848 pass, 0 baseline regressions) |
| Client bundle secret scan | clean |
| Cross-user live probe (7 probes) | allDenied ✅ · anyLeak ✗ (none) |

## Defects

**None (S0/S1).** No security boundary was crossed.

## S2 hardening — logged to POST_LAUNCH (non-blocking by plan)

- **No Content-Security-Policy header.** Intentional today — a strict CSP
  needs per-bundle nonce infrastructure (documented in next.config.ts).
  Referrer-Policy, X-Frame-Options, X-Content-Type-Options, and HSTS
  (prod) are present. CSP tightening is a post-launch hardening item.
- **`X-Powered-By: Next.js` exposed.** Trivial framework-version
  disclosure; `poweredByHeader: false` removes it. Cosmetic; deferred.

Both are the plan's named "hardening niceties (rate limiting, CSP
tightening) → S1/S2." Neither breaks a boundary; deferring maintains
freeze discipline (no code change in a security gate absent a real
defect).

## Cleanup

Two probe accounts (`cert-sec-a@example.com`, `cert-sec-b@example.com`)
and their systems/profiles/subscriptions deleted. A's probe system
deleted by A at end of run. No Stripe objects created.

## Evidence files

`cross-user-probe.mjs` (harness), `cross-user-probe.json` (full probe
stream), `unauth-and-webhook-probes.txt`, `bundle-secret-scan.txt`,
`engine-gate.txt`, `cleanup.txt`.

## Estimated effort

| Area | Hours |
|---|---|
| Automation (probe harness + production build/scan) | 1.5 |
| Manual/route audit (every route's ownership scoping, headers, redirects) | 1.0 |
| Fixes | 0 (none required) |
| Documentation | 0.5 |
| **Total** | **~3** |

## Launch confidence

**Increasing.** This gate targeted the highest-consequence failure class
— one user reading or altering another's data, or a secret leaking to
the browser — and found none. The ownership model is uniform (`findFirst`
scoped by session `userId` on every route; no id is ever trusted from the
client), and the probes confirm it against a live server, not just code.
The only findings are cosmetic hardening deferrals. Consistent with the
three prior gates: the defect surface keeps narrowing.

## Sign-off criterion

Probe matrix all-deny; secret scan clean; founder reads the transcript.
**Awaiting founder sign-off.**
