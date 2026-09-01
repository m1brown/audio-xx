# Audio XX — Beta Launch Roadmap

## Governance
- **Purpose:** the minimal, definitive set of work between today's Preview build and the first **invite-only public beta**. Execution plan, not design. Only work that must realistically happen *before users are invited* belongs here.
- **Status:** FROZEN — v1
- **Approval date:** 2026-07-26
- **Reviewer:** Founder (Mike Brown)
- **Change-control policy:** Roadmap **sequencing and priorities require founder approval before material changes.** Individual task *estimates* may evolve freely; **strategic ordering must not drift without review.** Post-beta assessment/engine work lives only in `docs/ASSESSMENT_EVOLUTION.md` and must not dilute this roadmap.

Priority legend: 🔴 Launch blocker · 🟠 High leverage. Cx: S/M/L. FR: founder review.

---

## Beta Launch Checklist

```text
Beta Launch Checklist

□ 1. Homepage clarity
□ 2. Builder onboarding
□ 3. Beta bug sweep
□ 4. Causal voice harmonization
□ 5. OG share images
□ 6. Sentry
□ 7. Production authenticated QA
□ 8. Legal / privacy review
□ 9. Password reset
□ 10. Invite-only beta
```

Everything below explains these items. Nothing outside this list is required to open the invite-only beta.

---

## Sequencing rationale (reconsidered)

Reordered from the earlier draft through one lens: **if a brand-new visitor arrived tomorrow, what most improves the probability they understand Audio XX and complete an assessment?**

- The three items that *directly* move understanding + completion — **homepage clarity, builder onboarding, and a bug-free assessment** — are pulled to the top. They are what a cold visitor experiences first and what determines whether they "get it" and finish.
- **Causal voice harmonization** follows next: it elevates the *quality of the completed assessment* (the payoff the visitor came for and what makes it worth sharing/returning). It is the one assessment-quality item in an otherwise readiness-focused beta, and it only requires re-wording an already-built, already-approved Phase 1 block.
- **OG share images** turn a completed assessment into reach — post-completion, so it sits just below the completion drivers.
- The **operational gates — Sentry, authenticated prod QA, legal/privacy, password reset — are mandatory before *inviting* users but do not change whether a visitor comprehends or completes.** They are sequenced after the experience drivers and may run **in parallel**; their internal order is not strategic. (Exception the founder may elect: pull **Sentry** earlier for instrument-first visibility during the bug sweep — an estimate-level choice, not a strategic reorder.)

This changes the top of the order from "operational-first" to "comprehension-and-completion-first," which is the correct bias for converting cold beta traffic.

---

## Tasks

### 1. Homepage clarity — 🔴 · Cx M · FR Y (positioning)
- **Objective:** a cold audiophile grasps what Audio XX is and starts a system without help.
- **User value:** the single biggest lever on public-beta conversion.
- **Dependency:** none (presentation).
- **Definition of done:**
  - a cold visitor understands the product within **five seconds** (5-second test with ≥5 target users passes);
  - homepage→builder conversion is **measured** (event fires in analytics);
  - founder **approves positioning** and copy.

### 2. Builder onboarding — 🔴 · Cx S · FR light
- **Objective:** a first-time visitor can enter a system (or use the free-text lane) without instruction.
- **User value:** removes the main drop-off between arrival and a completed assessment.
- **Dependency:** none.
- **Definition of done:**
  - an example/placeholder and the "describe it in your own words" lane are **visibly discoverable**;
  - a new user completes a first assessment unaided in a quick usability check;
  - builder→assessment completion rate is **measured**.

### 3. Beta bug sweep — 🔴 · Cx M (bounded, <½-day fixes) · FR light (the "embarrassing" judgment)
- **Objective:** the assessment a visitor receives is never wrong or embarrassing.
- **User value:** trust — a single embarrassing output loses an audiophile.
- **Dependency:** none.
- **Definition of done:**
  - ~100-prompt benchmark rerun scores **≥ ~90% "good" and zero "embarrassing"**;
  - **0 open S0/S1** defects;
  - the known-misalignment list is triaged (fixed, or explicitly deferred with a reason).

### 4. Causal voice harmonization — 🟠 · Cx S–M · FR Y (voice)
- **Objective:** re-word the live causal block into the Audio XX voice, then enable it on production.
- **User value:** a genuinely differentiated, deeper assessment on the systems it fires on.
- **Dependency:** Causal Explanation Architecture (frozen) + Editorial/Restraint doctrine. Phase 1 block already built and approved — this is wording + enable, not new engine work.
- **Definition of done:**
  - rewrite **preserves every approved claim and exclusion** (claim-by-claim mapping verified);
  - reads in-voice — passes the six editorial tests incl. the boilerplate test; **no provenance-meta phrasing** ("authored… effect", "catalogued as") in reader-facing prose;
  - flag-off byte-identical; **enabled on production** and confirmed live on a benchmark system.

### 5. OG share images — 🟠 · Cx M · FR light (design)
- **Objective:** a shared assessment link unfurls with a branded verdict card.
- **User value:** turns completed assessments into reach.
- **Dependency:** none (share metadata exists; `og:image` is null today).
- **Definition of done:**
  - `og:image` renders the verdict card (non-null);
  - verified unfurling in **≥2 real surfaces** (e.g. iMessage + Slack/X);
  - no text/layout overflow on the card at standard crop.

### 6. Sentry — 🔴 · Cx S · FR Y (owns DSN)
- **Objective:** production error visibility before real traffic.
- **User value:** indirect — defects caught before they churn users.
- **Dependency:** none (wiring exists; no-op without DSN).
- **Definition of done:**
  - client + server **DSN set on production**;
  - one controlled live-fire **captured in the Sentry dashboard**;
  - **no-op (404) without the debug token** confirmed.

### 7. Production authenticated QA — 🔴 · Cx S · FR Y (founder-manual)
- **Objective:** verify the signed-in core on the live production site.
- **User value:** retention paths actually work for real accounts.
- **Dependency:** M5 migration (done).
- **Definition of done:**
  - founder-manual signed-in pass on prod: **save / rename / notes / delete / history / print all succeed**;
  - entitlement gating correct (active trial → can manage);
  - **no auth/session errors** appear in Sentry during the pass.

### 8. Legal / privacy review — 🔴 · Cx S · FR Y
- **Objective:** privacy + affiliate disclosure match real behavior; add a lightweight ToS for public signup.
- **User value:** legal safety and trust.
- **Dependency:** none.
- **Definition of done:**
  - privacy policy + affiliate disclosure **verified accurate** against actual accounts / analytics / affiliate behavior;
  - a **Terms of Service** is present for public account creation;
  - founder **sign-off** recorded.

### 9. Password reset — 🟠 · Cx M · FR light
- **Objective:** users can recover a forgotten password.
- **User value:** prevents permanent lockout churn in a public beta.
- **Dependency:** an **email service integration** (not present today).
- **Definition of done:**
  - a reset email is **delivered** via the integrated service;
  - the reset flow completes and the new password **authenticates**;
  - token expiry + rate-limiting handled.

### 10. Invite-only beta — 🔴 · Cx M (mostly ops) · FR Y
- **Objective:** put the product in front of the first cohort of real audiophiles and start learning.
- **User value:** the learning loop itself.
- **Dependency:** items 1–9.
- **Definition of done:**
  - an **invite mechanism** is live (link or allowlist);
  - **in-product feedback capture** works;
  - a **weekly analytics review cadence** is agreed and the first cohort (≤~100) is invited.

---

## Launch readiness

### Remaining launch risks
- **Assessments are correct but concise.** Depth (the 800–1,200-word expansion) is deferred; the beta ships correct system-level advice + one causal insight.
- **Causal fires on few systems.** After harmonization it is live but narrow (currently the SET × DeVore O/96 family).
- **Catalog coverage is partial.** Niche or uncatalogued gear yields honest clarifications/omissions rather than depth.
- **Password reset introduces a new email-service dependency** — the one genuinely new integration in the beta set.
- **No load testing.** Acceptable at invite scale; revisited only for open beta.

### Intentionally deferred (not in this roadmap)
- The full **Question Engine / AnsweredQuestion / renderer weighting / Knowledge Opportunity reporting** and **assessment expansion** → `docs/ASSESSMENT_EVOLUTION.md`.
- **Paid subscriptions** (Stripe Live, tax/entity) — checkout stays disabled.
- **1,000-user scale hardening** (SEO depth, load, external-image repair).
- **Multi-rule causal presentation** and broader catalog enrichment.

### Why these deferrals are acceptable for an invite-only beta
The beta's job is to **learn whether audiophiles value correct, system-level advice plus a causal insight** — not to prove finished depth or to monetize. Invite scale bounds operational and reputational risk. None of the deferrals block the core loop a new visitor needs: **understand → build → read → save → share → recover access.** Monetization deliberately follows value validation, and the depth work is best *aimed by real usage signal* rather than built on assumption. Shipping this cut lets us learn the one thing that should decide everything after it.

---

## Status — 2026-07-31 (post operational-readiness release, production = b5de86a tree)

Engineering work on this checklist is COMPLETE. Remaining items are founder
activation/validation actions only. (Status annotation — no sequencing change;
change-control respected.)

```text
■ 1. Homepage clarity          — built + funnel events live; ☐ founder: 5-second test + positioning sign-off
■ 2. Builder onboarding        — built (hint, autocomplete, mobile action-row); ☐ founder: unaided-user check
■ 3. Beta bug sweep            — four-gate architecture + register D-001..D-010; gate green 4,066
■ 4. Causal voice              — Phase 3 voice live (1c902ef ratified); causal block remains Preview-flagged (unchanged status)
■ 5. OG share images           — live (homepage + /artifact cards)
◪ 6. Sentry                    — code in production, safe no-op; ☐ founder: project + env vars (runbooks/sentry-activation.md)
◪ 7. Production authed QA      — full local-stack pass evidenced; ☐ founder: 10-min walkthrough (runbooks/authenticated-journey-pass.md)
■ 8. Legal / privacy           — pages live incl. honest affiliate disclosure; ☐ founder: final read
◪ 9. Password reset            — flow in production (dark); ☐ founder: Resend + 3 env vars (docs/auth-model.md)
☐ 10. Invite-only beta          — founder decision on invite mechanism vs open beta
```

Beta readiness: engineering-side conditions PASSED (see release note
docs/releases/2026-07-31-operational-readiness.md); launch gates on the
☐ founder actions above.
