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

> **Closing rule.** A blocker is closed only when its **pass condition** is literally true and its
> **evidence artifact** is recorded in the Evidence Log. Absence of a problem is never evidence;
> every blocker below requires a **positive artifact** that could not exist if the thing were broken.

### LB-1 — Sentry error visibility confirmed
- **Objective** — Confirm the production issue stream is receiving and surfacing real errors, so the first user failure is visible rather than silent.
- **Owner** — Founder (encrypted `SENTRY_AUTH_TOKEN` is not available to the engineering session).
- **Verification** — Emit one deliberate test error from production and confirm it lands as a Sentry issue. A quiet dashboard does not distinguish "no errors" from "pipeline broken" — the test event is the positive control.
- **Evidence of completion** —
  1. The **Sentry issue short ID** of a deliberate production test event (e.g. `AUDIO-XX-4`), recorded verbatim.
  2. A **screenshot** of the Sentry Issues view, filtered `environment:production`, showing that issue and the `firstSeen` timestamp.
  3. The **count of unresolved production issues** since the `42da903` promotion, as an integer.
- **Pass condition** — The recorded issue short ID resolves to an issue whose environment is `production` and whose `firstSeen` is later than the promotion timestamp. **True or false; no interpretation.**
- **State** — ⬜ Open. Client SDK confirmed transmitting (200 to the envelope endpoint, observed twice during post-promotion verification); server-side issue stream never read.
- **Residual risk if omitted** — The first user-facing crash is invisible. Sentry already caught one real production 500 (`/api/evaluate` ENOENT) that no test found; without dashboard review that class of failure goes unnoticed until a user reports it.

### LB-2 — Legal / privacy review
- **Objective** — Confirm privacy policy, terms and data handling are published and disclose actual data practice for users who create accounts and save systems.
- **Owner** — Founder.
- **Verification** — Confirm both documents are published and that each required disclosure is literally present. *Adequacy is a legal judgment and cannot be made binary; **presence** can be, and is what this blocker gates on.*
- **Evidence of completion** —
  1. Two **published URLs** returning HTTP 200: `https://audio-xx.com/privacy` and `https://audio-xx.com/terms`.
  2. A **presence checklist**, each item marked found/not-found with the quoted line: ⬜ categories of data collected · ⬜ account and saved-system storage · ⬜ third-party processors **named** (Vercel, Turso, Sentry, Resend, analytics) · ⬜ affiliate-link disclosure · ⬜ contact route for data access/deletion · ⬜ effective date.
  3. A **dated sign-off line** naming the reviewer and the date the two documents were read.
- **Pass condition** — Both URLs return 200 **and** all six checklist items are marked found with a quoted line **and** a dated sign-off line exists. **Six of six, or the blocker stays open.**
- **State** — ⬜ Open. Roadmap item 8, never closed.
- **Residual risk if omitted** — Collecting real user accounts and behavioural data without accurate disclosure. Legal exposure and a trust breach that no engineering fix repairs.

### LB-3 — Invite-only access mechanism
- **Objective** — A working way to admit a bounded set of users and no one else.
- **Owner** — Founder (mostly ops).
- **Verification** — Run both controls. A positive test alone proves admission works; it does not prove exclusion works, and exclusion is the property the bound depends on.
- **Evidence of completion** —
  1. **Positive control** — screenshot of an invited test account in an authenticated production state, with the account identifier visible.
  2. **Negative control** — screenshot of an **uninvited** identity attempting the same gated surface in a clean browser profile, showing the denial (block page or auth redirect) and the URL attempted.
  3. The **recorded location of the invite list** (env var, table, or provider setting) and the **integer count** of admitted identities at launch.
- **Pass condition** — The positive control shows an authenticated session **and** the negative control shows a non-authenticated result on the same URL. **Both, from two distinct identities.**
- **State** — ⬜ Open. Roadmap item 10.
- **Residual risk if omitted** — There is no invite-only beta. Either nobody gets in, or scale is unbounded and the risk-limiting premise of the whole launch is void.

### LB-4 — Authenticated production journey pass
- **Objective** — Verify the signed-in core loop end to end on production: sign in → build → read assessment → save → return → recover access.
- **Owner** — Founder (manual — signed-in production journeys cannot be Playwright-verified; do not inject localStorage to fake it).
- **Verification** — Complete the loop once on audio-xx.com against a real account, capturing the saved system's identifier before and after a full sign-out. Identity of the identifier across the session boundary is the objective test; "it worked" is not.
- **Evidence of completion** —
  1. **Six numbered screenshots**, one per step of the loop, each showing the production URL bar.
  2. The **saved system's URL or ID**, recorded verbatim at save time.
  3. The **same URL or ID** recorded again after a full sign-out and fresh sign-in, with a screenshot showing the assessment content rendered.
- **Pass condition** — The identifier recorded at step 2 is **character-identical** to the one recovered at step 3, and the recovered page renders assessment content rather than an empty or error state. **String equality; no judgment.**
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

## Evidence Log

Artifacts live in `docs/launch-evidence/` as `LB-1/`, `LB-2/`, `LB-3/`, `LB-4/`.
A blocker cannot be marked ✅ while its row here is empty.

| Blocker | Artifact reference | Pass condition met | Recorded by | Date |
|---|---|---|---|---|
| LB-1 | *(Sentry issue short ID + screenshot path)* | ⬜ | | |
| LB-2 | *(two URLs + presence checklist + sign-off line)* | ⬜ | | |
| LB-3 | *(positive + negative control screenshots)* | ⬜ | | |
| LB-4 | *(six screenshots + saved system ID, before/after)* | ⬜ | | |

---

## How to use this document

1. To close a blocker: record its artifact in the **Evidence Log**, confirm the **pass condition** is literally true, then change ⬜ → ✅ in both places and update **Launch blockers open** and **Readiness**.
2. Readiness is 🟢 **READY TO INVITE** only when all four blockers are ✅ **and** all four Evidence Log rows are populated.
3. A blocker is never closed on the basis of "checked it" or "looks fine." If the pass condition cannot be evaluated as true or false from the recorded artifact, the blocker stays open.
4. Items move between tiers only by founder decision — never by engineering judgment.
5. Beta Learning items are promoted by *evidence*, not by age or convenience.

## Governing doctrine

**D-7** evidence provenance · **v3** Describe→Explain→Evaluate layering · **D-8** earned evaluation (confidence is not licence; when licence is missing, narrow the **scope** of the claim, not its confidence). Beta Stewardship v2: reproduce → explain → classify → smallest principled fix → **wait for approval**.
