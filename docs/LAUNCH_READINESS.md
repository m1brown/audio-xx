# Audio XX — Launch Readiness Dashboard

**Canonical launch status. Update this file after each completed item; do not fork it.**

| | |
|---|---|
| **Production** | `babaf0b` — deployment `audio-xx-ca4hpucfg`, **all 28 swept routes 200** |
| **Certified** | 2026-08-07T09:58:06Z (Launch Mission 3) · re-swept clean 2026-08-07 (Mission 4) |
| **Launch blockers open** | **4** — LB-1 · LB-2 · LB-3 · LB-4  ·  LB-5 live on production, 3/4 certified, one step to close |
| **Readiness** | 🔴 **NOT READY TO INVITE** |

> **Production certified; engineering complete.** `d3092c1` is live. LB-0 and LB-6 are both
> **closed with production evidence** — all eight `/brand/[slug]` routes serve 200, and a real
> `feedback_submitted` event was received carrying the same advisory id as the
> `assessment_completed` that preceded it. A 28-route sweep shows **zero failures**.
>
> **Engineering has no open launch blocker and no remaining approved work.** The four gates
> below are founder certification tasks. Scripts for each:
> [`launch-evidence/FOUNDER_CERTIFICATION.md`](launch-evidence/FOUNDER_CERTIFICATION.md).
>
> **Password recovery (LB-5) is now a Launch Blocker**, promoted 2026-08-08 on demonstrated
> evidence after a real founder lockout. It is no longer an optional withheld capability.

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
- **State** — 🟡 **OBJECTIVE TEST PASSED 6/6 (2026-08-07, re-run against production `audio-xx-ca4hpucfg`); AWAITING FOUNDER SIGN-OFF.** First run failed 5/6 — the policy disclosed no actual data processor. Repaired in `e3b786b`: the published policy now names **Vercel, Turso, OpenAI, Sentry, Amazon Associates**, states that user-typed system descriptions and questions are sent to OpenAI, discloses that voluntary feedback is stored with the identifier of the assessment it concerns, describes **Resend as integrated but not in use**, describes NextAuth.js as an in-product library rather than a processor, and carries an effective date of **August 7, 2026**. Evidence: [`launch-evidence/LB-2/presence-checklist.md`](launch-evidence/LB-2/presence-checklist.md).
- **To close** — Founder reads both documents and adds `Reviewed by <name> on <date>.` Legal-adequacy judgment; **not signed by the engineering session**.
- **Residual risk if omitted** — Collecting real user accounts and behavioural data without accurate disclosure. Users' typed system descriptions reach a third-party model provider with no disclosure that this happens. Legal exposure and a trust breach that no engineering fix repairs.

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

> **Password recovery is tracked as LB-5, not here.** It was live in Production during
> Launch Mission 2 and has since been withdrawn from the UI because it could not be
> certified. LB-4 covers saved-system persistence only — do not merge the two.

### LB-0 — Promote the brand-page repair ✅ **CLOSED 2026-08-06**
- **Objective** — Production stops returning HTTP 500 on `/brand/[slug]`.
- **Owner** — Founder (promotion approval); engineering executed.
- **Pass condition** — All five return **200** and none of the bodies contains `__next_error__`.
- **State** — ✅ **Closed.** Met at **six of six** (klipsch, devore, harbeth, kef, naim, rega); all eight brand routes recovered in the full sweep. Evidence: [`launch-evidence/LB-0/certification.md`](launch-evidence/LB-0/certification.md).
- **Residual risk** — Retired. Recurrence covered by `server-boundary-safety.test.ts` and by Gate E.

### LB-6 — In-product feedback capture ✅ **CLOSED 2026-08-07**
- **Objective** — The beta has an operational evidence intake path.
- **Owner** — Engineering (mount); founder approved the mount 2026-08-07.
- **Pass condition** — One `[AXX-EVENT]` line with `"event":"feedback_submitted"` appears carrying the answers given.
- **State** — ✅ **Closed.** `FeedbackPrompt` had zero importers, so the event had never fired once in production. Now mounted beneath completed advisories only (intake excluded; id required). Production event received with `advisoryId` character-identical to the preceding `assessment_completed` id. Evidence: [`launch-evidence/LB-6/certification.md`](launch-evidence/LB-6/certification.md).
- **Residual risk** — Retired. Recurrence covered by `feedback-prompt-mount.test.ts`.
- **Readback** — `npx vercel logs <deployment> | grep AXX-EVENT`

### LB-5 — Password recovery 🔴 **LAUNCH BLOCKER** *(promoted 2026-08-08)*
- **Objective** — An invited user who forgets their password can regain access.
- **Owner** — Founder (certification needs an external inbox); engineering for any configuration repair.
- **Why promoted** — Previously an optional withheld capability, deferred on the argument that a 10–15 cohort makes manual recovery sufficient. **Evidence has falsified that argument.** On 2026-08-08 the founder was locked out of his own production account while attempting LB-4, requested a reset twice, and received nothing. Under the evidence ladder that is **L3 — demonstrated product impact**: a real user, a real lockout, no working recovery path.
- **What the lockout refuted** — not the severity estimate but the **base rate**. The deferral assumed "a handful of lockouts across 10–15 users over several weeks." The very first authenticated production session produced one, from the person who knows the system best. Cohort size is therefore **not** adequate mitigation on its own — and founder-managed recovery has no fallback when the person locked out *is* the founder.
- **Verification** — One end-to-end reset to an external inbox: email **arrives** · reset link completes · new password authenticates · old password rejected.
- **Evidence of completion** — Delivered message ID and receiving inbox, plus the provider status captured by the rejection logger. Recorded in [`launch-evidence/LB-5/password-recovery.md`](launch-evidence/LB-5/password-recovery.md).
- **Pass condition** — All four steps succeed. **Or** an explicitly founder-approved alternative recovery mechanism is demonstrated working **for an external beta user** — not for the founder, and not as a stated intention.
- **State** — 🟡 **Recovery is LIVE on production and working. 3 of 4 conditions certified on production; the 4th is Preview-proven only.** Root cause was a malformed `RESEND_API_KEY` — the value carried a control character plus extra content, so `Headers.append` threw during request construction and the send never reached Resend. Repair was configuration only; no code changed. Production `audio-xx-99ct3fcio` (`05976b0`) carries the corrected key and `NEXT_PUBLIC_PASSWORD_RESET=1`; email delivery, reset completion and new-password authentication are all evidenced on `audio-xx.com`, resolving to the same pre-existing user id with saved systems intact. Full chain in [`launch-evidence/LB-5/password-recovery.md`](launch-evidence/LB-5/password-recovery.md).
- **Single missing item** — Condition 4 (old password rejected) is proven on Preview in self-evidencing form but not on production: the refused password was never *observed working* on production first, so the before-and-after is not both on the production record. **Residual risk low** — a single overwritten `password` column, same code and same database as the Preview run — but the criterion is not being weakened to fit. Closes with one sequence (~30s): sign in · reset · attempt the previous password.
- **Residual risk if omitted** — An invited user who forgets their password is permanently locked out of their account and saved systems, with no self-service path and no manual path proven to work for anyone but the founder.

---

## 2 · Launch Specification
*Approved scope. May complete during invite-only beta. No beta evidence required.*

| # | Item | State | Note |
|---|---|---|---|
| LS-1 | **Affiliate activation** — `NEXT_PUBLIC_*` tag vars in Production | ✅ | **Complete.** Verified live 2026-08-06: `tag=audioxx20-20` on Amazon links and `campid=5339152664` on eBay links, served from audio-xx.com. Both vars present in the Production environment. |
| LS-2 | Build step added to the release gate | ✅ | **Complete.** Added as **Gate E — Build** (`next build`) in `scripts/release-gate.mjs`. Deliberately not `tsc --noEmit` — see the note below. |
| LS-3 | Register gate extended to catalog prose | ⛔ | **Blocked — architectural decision required.** 53 violations across 4 catalog files (29 romance-vocabulary, 20 breathes, 3 comes-alive, 1 sings). `editorial-register.ts` documents the catalog layer as deliberately out of scope; reversing that is a scope decision, and closing it means 53 hand-rewrites of editorial voice. |
| LS-4 | Klipsch Heresy IV factual correction | ⛔ | **Blocked — misdiagnosed as a one-record edit.** The record is correct; the *threshold* is wrong. See below. |

### LS-4 — corrected diagnosis (2026-08-06)

The Heresy IV record is internally consistent and factually sound. The defect is in
[`product-assessment.ts:241`](../apps/web/src/lib/product-assessment.ts): `describeCharacter` emits
superlative prose at `>= 0.7`, and the catalog convention maps **`present` → 0.7**
(116 of 127 sampled speaker traits; `emphasized` → 1.0, `less_emphasized` → 0.4).

So `0.7` — the single most common value in the catalog, 46 records for `tonal_density` alone — means
*"a normal amount"* and renders as *"Rich, full-bodied tone."* The Heresy IV therefore claims
full-bodied tone in the same assessment that flags it bass-shy away from walls.

Correcting the Heresy datum alone would break the level↔number convention and paper over the cause,
which Doctrine v3 forbids. Raising the threshold changes rendered output for every product sitting at
0.7 across the catalog — a product-wide editorial change, not an engineering fix. **Founder decision
required.**

### Note on Gate E scope

Gate E runs `next build`, not `tsc --noEmit`. The tree carries **107 pre-existing type errors across
15 files**; Next.js never typechecks (SWC transpiles without type analysis), so those errors do not
affect the deployable artifact and a typecheck gate would fail on the same tree serving production
today. Compilation is the contract Gate E enforces. Type cleanliness is separate, unscheduled work.

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
| LB-2 | [`LB-2/presence-checklist.md`](launch-evidence/LB-2/presence-checklist.md) — objective 6 of 6 ✅; sign-off pending | 🟡 PART | Claude | 2026-08-07 |
| LB-3 | *(positive + negative control screenshots)* | ⬜ | | |
| LB-4 | *(six screenshots + saved system ID, before/after)* | ⬜ | | |
| LB-0 | [`LB-0/certification.md`](launch-evidence/LB-0/certification.md) — 6 slugs, deployment `audio-xx-2za4u99sn` | ✅ | Claude | 2026-08-06 |
| LB-5 | [`LB-5/password-recovery.md`](launch-evidence/LB-5/password-recovery.md) — recovery LIVE on production (`audio-xx-99ct3fcio`); **3 of 4 certified on production**, condition 4 Preview-proven only | 🟡 | Claude | 2026-08-09 |
| LB-6 | [`LB-6/certification.md`](launch-evidence/LB-6/certification.md) — production `feedback_submitted` event, id joins to advisory | ✅ | Claude | 2026-08-07 |

---

## How to use this document

1. To close a blocker: record its artifact in the **Evidence Log**, confirm the **pass condition** is literally true, then change ⬜ → ✅ in both places and update **Launch blockers open** and **Readiness**.
2. Readiness is 🟢 **READY TO INVITE** only when all four blockers are ✅ **and** all four Evidence Log rows are populated.
3. A blocker is never closed on the basis of "checked it" or "looks fine." If the pass condition cannot be evaluated as true or false from the recorded artifact, the blocker stays open.
4. Items move between tiers only by founder decision — never by engineering judgment.
5. Beta Learning items are promoted by *evidence*, not by age or convenience.

## Governing doctrine

**D-7** evidence provenance · **v3** Describe→Explain→Evaluate layering · **D-8** earned evaluation (confidence is not licence; when licence is missing, narrow the **scope** of the claim, not its confidence). Beta Stewardship v2: reproduce → explain → classify → smallest principled fix → **wait for approval**.
