# Audio XX — Public Launch Checklist (MVP)

Every item is independently verifiable. Items are grouped by the milestone that produces them; nothing here requires work outside the roadmap in `docs/mvp-product-architecture.md`.

## Core experience (M1 — done, ☐ = re-verify on production before launch)
- [ ] Landing renders the builder + composer, no account prompt, on production URL
- [ ] Typeahead suggests real catalog gear within one keystroke round-trip
- [ ] Builder → assessment renders server-side in < 1.5 s on production
- [ ] Assessment URL pasted into a fresh incognito browser renders identically
- [ ] Print produces a clean single-artifact document (no chrome, no actions)
- [ ] Unresolvable input shows the guided failure path, never an error page
- [ ] Mobile 375 px: no horizontal scroll on landing or artifact

## Accounts & My Systems (M2–M3)
- [ ] Save → create account → system + assessment snapshot persisted (verify in DB)
- [ ] Fresh-browser sign-in shows the saved collection
- [ ] Rename, re-assess (new snapshot, old kept), delete all work
- [ ] Assessment history: newest-first, latest flagged, earlier assessments open exactly as saved
- [ ] Identical re-assessment declined with the explicit message; changed reading appends exactly one entry
- [ ] No account is ever required to read, print, or share any assessment
- [ ] Password hashing verified (bcrypt, no plaintext anywhere in DB)

## Billing (M4)
- [ ] Account creation requires no card; trial end date = createdAt + 3 months, shown in My Systems and /account
- [ ] Stripe test-mode: subscribe, cancel, lapse each reflected in app state
- [ ] Lapsed account: saved systems remain fully readable/printable/sharable; new saves and re-assessments prompt to subscribe
- [ ] Grep-verified: no code path deletes user data on any subscription event
- [ ] Webhook signature verification on the Stripe endpoint

## Trust, legal, polish (M5)
- [ ] OG/meta tags: shared artifact links unfurl with title + description
- [ ] Privacy policy + affiliate disclosure reviewed against actual behaviour (accounts, Stripe, analytics)
- [ ] Error monitoring (e.g. Sentry) capturing production exceptions
- [ ] Analytics distinguishing: builder vs composer entry, assessment views, shares (copy-link clicks), saves, account creations
- [ ] Engine regression gate + product suite green on the release commit
- [ ] Final benchmark rerun on the release commit — zero embarrassing rows
- [ ] Manual pass of the five demo scenarios on production
- [ ] Backup/restore story for the production database tested once
- [ ] Custom-domain HTTPS, www/apex redirect, 404 page in editorial style

## Launch decision
- [ ] Founder walk-through: first visit → build → read → print → share → save → account → My Systems, on a phone, without touching a keyboard shortcut or dev tool
