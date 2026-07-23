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

## Billing (M5 — next milestone)
- ⬜ Account creation requires no card; trial end date = createdAt + 3 months, shown in My Systems and /account
- ⬜ Stripe test-mode: subscribe, cancel, lapse each reflected in app state
- ⬜ Lapsed account: saved systems remain fully readable/printable/sharable; new saves and re-assessments prompt to subscribe
- ⬜ Grep-verified: no code path deletes user data on any subscription event
- ⬜ Webhook signature verification on the Stripe endpoint

## Trust, legal, operations (before public launch)
- ⬜ Privacy policy + affiliate disclosure reviewed against actual behaviour (accounts, Stripe, analytics)
- ⬜ Error monitoring capturing production exceptions (Sentry package present; verify wiring + DSN)
- ⬜ Analytics distinguishing: builder vs composer entry, assessment views, copy-link clicks, saves, account creations
- ✅ Engine regression gate + product suite green on the release commit (3,805 · 41 product · 0 new)
- ⬜ Final benchmark rerun on the public-launch release commit
- ⬜ Manual pass of the five demo scenarios on production after the launch-release promotion
- ✅ Backup/restore story exercised once (M2 promotion gate: full dump + verified restore path)
- ✅ Custom-domain HTTPS, www + apex aliases verified
- ⬜ Node 24 build engines set before 2026-10-01 (Vercel deprecation)
- ⬜ 404 page in editorial style

## Intentionally deferred (not launch-blocking; roadmap)
- ⏸ Generated per-assessment OG images (text unfurl ships first)
- ⏸ Pretty share links (`/a/<id>`)
- ⏸ Reading-to-reading diff view in history
- ⏸ Password reset (needs email service)
- ⏸ External-image data repair (client-side degradation covers it)
- ⏸ Assessment-level annotations

## Launch decision
- ⬜ Founder walk-through: first visit → build → read → print → share → save → account → My Systems → history, on a phone, without touching a keyboard shortcut or dev tool
