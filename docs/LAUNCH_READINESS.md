# Audio XX — Launch Readiness Dashboard

**Canonical launch status. Update this file after each completed item; do not fork it.**

| | |
|---|---|
| **Production** | `42da903` — Ready, serving 200 at audio-xx.com |
| **Last updated** | 2026-08-06 |
| **Launch blockers open** | **4 of 4** |
| **Readiness** | 🔴 **NOT READY TO INVITE** — all four blockers are founder-owned |

> **Headline:** engineering has **no** open launch blockers. Every remaining gate is a founder task.
> The product is technically ready; the launch is waiting on operational, legal and verification steps
> that cannot be automated.

---

## 1 · Launch Blockers
*Must be complete before the first beta invitation.*

### LB-1 — Sentry error visibility confirmed
- **Objective** — Confirm the production issue stream is receiving and surfacing real errors, so the first user failure is visible rather than silent.
- **Owner** — Founder (encrypted `SENTRY_AUTH_TOKEN` is not available to the engineering session).
- **Verification** — Open the Sentry dashboard for project `4511852607504384`; confirm zero unexpected issues since the `42da903` promotion, and that the project is receiving events.
- **State** — ⬜ Open. Client SDK confirmed transmitting (200 to the envelope endpoint, observed twice during post-promotion verification); server-side issue stream never read.
- **Residual risk if omitted** — The first user-facing crash is invisible. Sentry already caught one real production 500 (`/api/evaluate` ENOENT) that no test found; without dashboard review that class of failure goes unnoticed until a user reports it.

### LB-2 — Legal / privacy review
- **Objective** — Confirm privacy policy, terms and data handling are adequate for inviting real users who create accounts and save systems.
- **Owner** — Founder.
- **Verification** — Founder sign-off that the published `/privacy` and `/terms` reflect actual data practice (accounts, saved systems, analytics events, affiliate links).
- **State** — ⬜ Open. Roadmap item 8, never closed.
- **Residual risk if omitted** — Collecting real user accounts and behavioural data without accurate disclosure. Legal exposure and a trust breach that no engineering fix repairs.

### LB-3 — Invite-only access mechanism
- **Objective** — A working way to admit a bounded set of users and no one else.
- **Owner** — Founder (mostly ops).
- **Verification** — One invited account can sign in; one uninvited visitor cannot reach gated surfaces.
- **State** — ⬜ Open. Roadmap item 10.
- **Residual risk if omitted** — There is no invite-only beta. Either nobody gets in, or scale is unbounded and the risk-limiting premise of the whole launch is void.

### LB-4 — Authenticated production journey pass
- **Objective** — Verify the signed-in core loop end to end on production: sign in → build → read assessment → save → return → recover access.
- **Owner** — Founder (manual — signed-in production journeys cannot be Playwright-verified; do not inject localStorage to fake it).
- **Verification** — Founder completes the loop once on audio-xx.com against a real account and reports any break.
- **State** — ⬜ Open. Roadmap item 7. Anonymous journeys verified on `42da903`; authenticated ones never.
- **Residual risk if omitted** — Save/recover is the reason to have an account. If it is broken, the first invited user hits it on their first session, and the failure lands on the exact feature the invite was for.

---

## 2 · Launch Specification
*Approved scope. May complete during invite-only beta. No beta evidence required.*

| # | Item | State | Note |
|---|---|---|---|
| LS-1 | **Affiliate activation** — set `NEXT_PUBLIC_*` tag vars in Production | ⬜ | **Highest-cost delay on this page.** Links render today and earn nothing; every beta session before this is permanently lost revenue. Config only, no code, no doctrinal risk. |
| LS-2 | Build step added to the release gate | ⬜ | 4,124 tests passed a syntax error that broke the production build. Needs architectural approval — changes the gate contract. |
| LS-3 | Register gate extended to catalog prose | ⬜ | The gate excludes catalog files, so reviewer clichés ship in the most-read layer. Approval needed — will fail existing entries. |
| LS-4 | Klipsch Heresy IV factual correction | ⬜ | Described as "rich, full-bodied"; its defining trait is limited LF extension. Safe one-record edit. |

---

## 3 · Beta Learning
*Implement only after user evidence or telemetry demonstrates need. Do not pre-emptively build.*

**Highest severity:** **C4** — unlicensed "Nothing here needs changing" on an uncatalogued amplifier paired with a demanding speaker. Ontology settled under D-8; repair is to establish the Explain-level causal bridge or decline the interaction-level evaluation, **not** to hedge or narrow restraint. *Promotion trigger: a beta user receives an all-clear on a pairing later shown to be wrong.*

Others, unranked: conversation loss on navigation · two parallel `/systems` flows · `unverifiedComponents` clarification wiring · cable positioning · value-question and budget handling · catalog coverage · trait-list synonym stacking · price/lifecycle staleness · comparison "more of everything" framing · internal symptom name in prose · mobile Product Resources hierarchy · `ShoppingLinks` bypassing the shared builder · aggregator host list · latency variability · `packages/rules` dead code · `brand-house-voicing` wall-clock flake.

---

## 4 · Future Product
*Intentionally beyond launch scope. All require architectural approval to start.*

Question Engine / assessment expansion (`ASSESSMENT_EVOLUTION.md`) · paid subscriptions · 1,000-user scale hardening · multi-rule causal presentation · product detail routes · manufacturer knowledge integration.

> **Open classification question:** manufacturer knowledge integration sits here because no user evidence supports it — but manufacturer knowledge is a named product asset in the stewardship doctrine, which would make it Launch Specification. Founder's call; it moves on request.

---

## How to use this document

1. When a blocker closes, change ⬜ → ✅, update **Launch blockers open**, and update **Readiness**.
2. Readiness is 🟢 **READY TO INVITE** only when all four blockers are ✅.
3. Items move between tiers only by founder decision — never by engineering judgment.
4. Beta Learning items are promoted by *evidence*, not by age or convenience.

## Governing doctrine

**D-7** evidence provenance · **v3** Describe→Explain→Evaluate layering · **D-8** earned evaluation (confidence is not licence; when licence is missing, narrow the **scope** of the claim, not its confidence). Beta Stewardship v2: reproduce → explain → classify → smallest principled fix → **wait for approval**.
