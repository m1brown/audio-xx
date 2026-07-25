# Audio XX — Public Launch Checklist (MVP)

Every item is independently verifiable. Items are grouped by the milestone that produces them; nothing here requires work outside the roadmap in `docs/mvp-product-architecture.md`.

**Status legend (updated M4, 2026-07-22):** ✅ complete (verified) · ⬜ remaining · ⏸ intentionally deferred. All M1–M4 items are now verified on production (M3/M4 promoted 23 July).

## Core experience (M1 — live on production since 22 July)
- ✅ Landing renders the builder + composer, no account prompt, on production URL
- ✅ Typeahead suggests real catalog gear within one keystroke round-trip
- ✅ Builder → assessment renders server-side quickly on production
- ✅ Assessment URL pasted into a fresh browser renders identically
- ✅ Print produces a clean single-artifact document (no chrome, no actions)
- ✅ Unresolvable input shows the guided failure path, never an error page
- ✅ Mobile 375 px: no horizontal scroll on landing or artifact

## Accounts & My Systems (M2–M3 live on production)
- ✅ Save → create account → system + assessment snapshot persisted (verified in prod DB)
- ✅ Fresh-browser sign-in shows the saved collection
- ✅ Rename and notes work; delete cascades only its own history
- ✅ Assessment history: newest-first, latest flagged, earlier assessments open exactly as saved
- ✅ Identical re-assessment declined with the explicit message; changed reading appends exactly one entry
- ✅ No account is ever required to read, print, or share any assessment
- ✅ Password hashing (bcrypt) — verified in code and prod rows

## Launch polish (M4 — live on production since 23 July)
- ✅ Site + per-page titles; per-assessment title = verdict in the browser tab
- ✅ OG/meta tags: shared artifact links unfurl with verdict + system description
- ✅ Private pages (`/systems`, `/save`, sign-in) noindexed
- ✅ Broken product images remove themselves — no empty frames in the artifact
- ✅ Builder: arrow-key suggestion navigation, 44 px touch targets, "Preparing your assessment…" pending state
- ✅ Sign-in page in the editorial voice; nav says "My Systems"
- ✅ Visible keyboard focus (accent outline) on links/buttons site-wide
- ✅ Favicon + apple icon present

## Billing (M5 — Stripe test mode APPROVED at 4d11948)
- ✅ Account creation requires no card; trial = max(createdAt, BILLING_LAUNCHED_AT) + 92 days, shown in My Systems and /account
- ✅ Stripe sandbox account created; product renamed to **My Systems**; one recurring price US$3/month; no Stripe-managed trial
- ✅ Checkout verified in real Stripe test mode (4242 → subscriber, webhooks 2xx, immediate entitlement)
- ✅ Customer Portal verified; cancellation retains paid-through access (cancel_at API shape handled)
- ✅ Failed checkout verified: declined card changes nothing; calm cancelled-return notice
- ✅ Lapsed account: collection fully readable, removable; save/add/rename/notes prompt to subscribe
- ✅ Grep-verified in the test suite: no code path deletes user data on any subscription event
- ✅ Webhook signature verification (real crypto in tests + live; invalid signature → 400, never processed)
- ✅ Idempotent + out-of-order-safe webhook processing; null period-end never regresses a known one
- ✅ Entitlement is one server-side function; no client-supplied price or entitlement anywhere
- ⬜ **Founder decision (production-activation prerequisite): tax treatment** — selling entity + jurisdiction; whether US$3/month is tax-inclusive; whether Stripe Tax is enabled; live-account identity/banking/business/support/branding. Provisional preference: US$3/month, taxes included where applicable. Not decided autonomously.

## Launch Certification (tracking: launch-status.md · plan: docs/launch-certification-plan.md)
- ✅ Gate 1 Functional — PASS WITH MINOR ISSUES (1 S1 fixed + pinned; certification/day-01-functional/)
- ✅ Gate 2 Billing & entitlement — PASS (10 states live, 0 defects; certification/day-02-billing/)
- ✅ Gate 3 Analytics & funnel — PASS WITH MINOR ISSUES (3 S1 fixed + pinned; certification/day-03-analytics/)
- ✅ Gate 4 Privacy & security — PASS (cross-user probe matrix denies; secret scan clean; 0 defects; certification/day-04-security/)
- ⬜ Gates 5–11

## Trust, legal, operations (before public launch)
- ⬜ Privacy policy + affiliate disclosure reviewed against actual behaviour (accounts, Stripe, analytics)
- 🟡 Error monitoring wired (Sentry hooks complete, no-op without DSN; token-gated test route added) — DSN + controlled test at activation
- ✅ Analytics: 21 canonical events through one shared layer (builder vs composer, anon vs signed-in, trial vs subscriber, first vs repeat save); spec in docs/analytics-events.md
- ✅ Engine regression gate + product suite green on the release commit (3,805 · 41 product · 0 new)
- ⬜ Final benchmark rerun on the public-launch release commit
- ⬜ Manual pass of the five demo scenarios on production after the launch-release promotion
- ✅ Backup/restore story exercised once (M2 promotion gate: full dump + verified restore path)
- ✅ Custom-domain HTTPS, www + apex aliases verified
- ✅ Node 24 build engines set (root + apps/web package.json)
- ✅ 404 page in editorial style ("This page isn't in the collection.")

## Intentionally deferred (not launch-blocking; roadmap)
- ⏸ Generated per-assessment OG images (text unfurl ships first)
- ⏸ Pretty share links (`/a/<id>`)
- ⏸ Reading-to-reading diff view in history
- ⏸ Password reset (needs email service)
- ⏸ External-image data repair (client-side degradation covers it)
- ⏸ Assessment-level annotations

## Launch decision
- ⬜ Founder walk-through: first visit → build → read → print → share → save → account → My Systems → history, on a phone, without touching a keyboard shortcut or dev tool
