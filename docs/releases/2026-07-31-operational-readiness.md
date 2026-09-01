# Release note — Operational-readiness release (2026-07-31)

**Production:** audio-xx.com · deployment `audio-xx-cteqjlk1m` (● Ready,
aliased audio-xx.com + www.audio-xx.com) · git head **`b5de86a`** on
version-b.

Released in two promotions the same day, both with product approval:
first `55301d7` (commerce remediation + composer change), then the full
operational-readiness envelope head `b5de86a`.

## Commits promoted

| Commit | Group |
|---|---|
| `1c902ef` | Phase 3 editorial voice (ratified by decision memo) |
| `07d0072` `5caae97` `ac25b54` | B2 click tracking + disclosure · B1 link remediation (46 fixed/38 deleted + link gates) · 6moons display-layer exclusion |
| `20931fd` `d47d2d4` | benchmark artifact refresh · register update |
| `55301d7` | composer opens empty (autofill removed; region reserved for Phase 2) |
| `cca597f` | Sentry server/edge scrubbing + activation runbook |
| `4c53ab7` | password-recovery flow (enumeration-safe, hashed single-use tokens; dark until email configured) |
| `4fe0e57` `96097ae` | authenticated-journey evidence · mobile nav + builder action-row fixes |
| `e5fed8c` `b5de86a` | funnel events (builder_first_component, assessment_submitted, auth_initiated) + event-set pin |
| `49c671d` | OG social cards (homepage + /artifact) |
| `dfec96c` | Phase 2 reserved-region doctrine |
| `93f072e` | D-010: affiliate activation-ready (NEXT_PUBLIC literal refs + tests) |

## User-visible changes

- Commerce links: no dead domains, no rotten Amazon ASINs (search links
  only), no 6moons content anywhere; honest no-commission disclosure.
- The composer opens empty (placeholder only) — no pre-filled system text.
- Mobile: signed-in pages no longer scroll horizontally at phone widths;
  the builder's two actions stack cleanly.
- Shared links now render editorial social cards (site + assessments).
- Assessment closes follow the established editorial character (Phase 3).
- Password-reset pages exist but are hidden until email delivery is
  configured (no dead recovery UI is shown).

## Documentation added

`docs/runbooks/sentry-activation.md` · `docs/auth-model.md` ·
`docs/runbooks/authenticated-journey-pass.md` ·
`docs/phase2-reserved-region.md` · funnel section in
`docs/analytics-events.md` · register rows D-009/D-010 · roadmap status
section.

## Verification at release

- Gate: **4,066 passed · 20 known-baseline · 0 new failures.**
- Production build: succeeded (Vercel ● Ready, 3m).
- Migrations: additive only — 1 CREATE TABLE + 2 indexes
  (`password_reset_tokens`); `users` untouched.
- Env vars: unchanged (16 entries, same names/scopes; activation vars
  intentionally absent).

## Founder actions remaining (no substitutes implemented)

1. Sentry activation (project + env vars + one test event).
2. Resend configuration (account + 3 env vars → recovery goes live).
3. Affiliate enrollment (Amazon Associates / EPN + 2 env vars).
4. Final authenticated production walkthrough (10-min checklist).
5. External comprehension testing (5-second test, ≥5 target users).

## Verdict (as accepted by the founder, 2026-07-31)

**Audio XX is engineering-ready for closed beta, subject to completion of
the remaining founder activation tasks.**

Audit note — authentication leg: *Account creation / authenticated
journey: Pending founder verification. Previously verified locally on
identical code; the production walkthrough is intentionally reserved for
the founder.* This is a deliberate deferral, not an unknown.

## Release baseline

This release establishes the engineering baseline for the first closed
beta. Future work should be driven primarily by observed user behavior
rather than additional architectural redesign unless a material product
issue is discovered. With this release the project transitions from
"building the product" to "learning from users."
