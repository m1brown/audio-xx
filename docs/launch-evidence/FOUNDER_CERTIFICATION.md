# Audio XX — Founder Certification Scripts

**Purpose:** close the remaining pre-invitation blockers with objective evidence.
**Production under test:** `4cb19df` · deployment `audio-xx-2za4u99sn` · audio-xx.com
**Prepared:** 2026-08-06 (Launch Mission 3, Phase 2)

Work through these **one at a time** and paste the result back. Each has a binary pass
condition — if it can't be evaluated as true or false from what you captured, the blocker
stays open.

> **No secrets in this repo.** Never paste an API key, auth token, DSN, session cookie or
> password into any file here or into chat. Record only IDs, statuses, URLs and screenshots.
> Redact any token that appears in a screenshot.

---

## LB-1 — Sentry deliberate production event

**Why a deliberate event:** a quiet dashboard cannot distinguish "no errors" from "pipeline
broken." Only a positive control proves the pipeline works.

| | |
|---|---|
| **URL** | https://sentry.io → your Audio XX project (`4511852607504384`) |
| **Identity** | Your Sentry login. The `SENTRY_AUTH_TOKEN` is encrypted in Vercel and unavailable to the engineering session — this is why the task is yours. |

**Actions**

1. Open audio-xx.com in a browser.
2. Open DevTools → Console and run:
   ```js
   throw new Error('AXX launch certification probe — LB-1')
   ```
3. In Sentry, open **Issues**, filter `environment:production`.
4. Find the issue titled `AXX launch certification probe — LB-1`.
5. Also note the **count of unresolved production issues** since 2026-08-06.

**Artifact to capture**

- The Sentry **issue short ID**, verbatim (e.g. `AUDIO-XX-7`).
- A **screenshot** of the filtered Issues view showing that issue and its `firstSeen`.
- The unresolved-issue **count**, as an integer.

**Pass condition (binary)**
The recorded short ID resolves to an issue with environment `production` and a `firstSeen`
later than 2026-08-06T19:31:20Z. **True or false.**

**Evidence destination:** `docs/launch-evidence/LB-1/`

> If the probe does **not** appear: client-side errors may be filtered. Report that — it is a
> real finding, and the fix is narrow.

---

## LB-2 — Legal / privacy presence checklist + sign-off

Adequacy is a legal judgment and cannot be made binary. **Presence** can be, and that is what
this blocker gates on. Your sign-off carries the adequacy judgment separately.

| | |
|---|---|
| **URLs** | https://audio-xx.com/privacy · https://audio-xx.com/terms |
| **Identity** | None — both are public. |

**Actions** — read both documents and mark each item found / not-found, quoting the line.

| # | Required disclosure | Found? | Quoted line |
|---|---|---|---|
| 1 | Categories of data collected | ⬜ | |
| 2 | Account + saved-system storage | ⬜ | |
| 3 | Third-party processors **named** (Vercel, Turso, Sentry, Resend, analytics) | ⬜ | |
| 4 | Affiliate-link disclosure | ⬜ | |
| 5 | Contact route for data access / deletion | ⬜ | |
| 6 | Effective date | ⬜ | |

Then add: `Reviewed by <name> on <date>.`

**Pass condition (binary)**
Both URLs return 200 **and** all six items are marked found with a quoted line **and** a dated
sign-off line exists. **Six of six.**

**Evidence destination:** `docs/launch-evidence/LB-2/`

> Both URLs already return 200 (verified 2026-08-06). Item 3 is the one most likely to fail —
> processor lists are commonly incomplete. Resend is named here even though recovery mail is
> currently disabled, because the integration still exists.

---

## LB-3 — Invite admission **and** exclusion

A positive test alone proves admission works. It says nothing about exclusion — and exclusion is
the property the entire "bounded cohort" premise rests on. **Both controls are required.**

| | |
|---|---|
| **URL** | https://audio-xx.com/auth/signin and whichever surface the invite gates |
| **Identity** | Two distinct identities: one invited test account, one uninvited. Use a clean browser profile or private window for the uninvited one so no session leaks in. |

**Actions**

1. **Positive control** — sign in as the invited account. Screenshot the authenticated state with
   the account identifier visible.
2. **Negative control** — in a clean profile, attempt the *same gated URL* as an uninvited
   identity. Screenshot the denial (block page or auth redirect) with the attempted URL visible.
3. Record where the invite list lives (env var, DB table, or provider setting) — **name only, no
   values** — and the integer count of admitted identities at launch.

**Pass condition (binary)**
Positive control shows an authenticated session **and** negative control shows a
non-authenticated result **on the same URL**, from two distinct identities. **Both.**

**Evidence destination:** `docs/launch-evidence/LB-3/`

---

## LB-4 — Authenticated save / sign-out / recover lifecycle

This is the reason to have an account. It has never been verified signed-in on production.

| | |
|---|---|
| **URL** | https://audio-xx.com |
| **Identity** | One real account. Signed-in production journeys cannot be Playwright-verified — do **not** inject localStorage to fake a session. |

**Actions** — six steps, screenshot each with the URL bar visible:

1. Sign in.
2. Build a system (any real chain).
3. Read the assessment.
4. **Save** it — record the saved system's URL or ID **verbatim**.
5. Fully sign out.
6. Sign back in and open the saved system — record the URL or ID **again**.

**Artifact to capture**
Six numbered screenshots · the identifier at step 4 · the identifier at step 6 · a screenshot
showing assessment content rendered after recovery.

**Pass condition (binary)**
The step-4 identifier is **character-identical** to the step-6 identifier, and the recovered page
renders assessment content rather than an empty or error state. **String equality.**

**Evidence destination:** `docs/launch-evidence/LB-4/`

> **Scope note.** LB-4 covers saved-system persistence only. Password recovery is LB-5 and is
> deliberately tracked separately — do not merge them.

---

## LB-6 — Feedback capture *(status: awaiting your decision — see below)*

**Do not run this test yet.** `FeedbackPrompt.tsx` is built but **rendered nowhere** — it has
zero importers, so `feedback_submitted` has never fired in production. There is nothing to test
until it is mounted, and mounting requires your approval.

If you approve the mount, the test becomes:

| | |
|---|---|
| **URL** | https://audio-xx.com |
| **Identity** | None required. |

**Actions**

1. Complete one assessment.
2. Answer the feedback prompt beneath it and submit.
3. Read the event back:
   ```bash
   npx vercel logs audio-xx.com --since 15m | grep AXX-EVENT | grep feedback_submitted
   ```

**Pass condition (binary)**
One `[AXX-EVENT]` line with `"event":"feedback_submitted"` appears, carrying the answers you
gave. **Present or absent.**

**Evidence destination:** `docs/launch-evidence/LB-6/`

---

## LB-5 — Password recovery *(OPTIONAL — not a launch blocker)*

Currently **disabled**: the public "Forgot your password?" entry point is withdrawn, so no user
can be misled. Recovery is founder-managed for the invited cohort. **You can launch without
running this.**

Run it only if you want self-service recovery live at launch.

| | |
|---|---|
| **URL** | A **Preview** deployment (the flag is still on there), not production. |
| **Identity** | A test account plus an **external inbox you control**. |

**Actions**

1. Request a reset from `/auth/forgot` on the Preview URL.
2. Confirm the email **actually arrives** in the external inbox.
3. Complete the reset via the delivered link.
4. Sign in with the new password.
5. Confirm the **old** password no longer authenticates.

**Pass condition (binary)**
Email received **and** new password authenticates **and** old password rejected. **All three.**

**If it passes**, re-enable:
```bash
npx vercel env rm NEXT_PUBLIC_PASSWORD_RESET production -y && printf '1' | npx vercel env add NEXT_PUBLIC_PASSWORD_RESET production
```
then redeploy production to rebuild (the value is inlined at build time) and confirm
"Forgot your password?" renders again.

**Evidence destination:** `docs/launch-evidence/LB-5/`

> Resend DNS for audio-xx.com is correctly configured (DKIM + `send.` SPF/MX via amazonses), so
> delivery is *likely* fine. It was disabled on the "cannot certify" rule, not because it is
> known broken. The most common cause of failure here is a Resend account still in test mode,
> which only permits sending to the account owner's own address.

---

## Suggested order

1. **LB-2** — read-only, no setup, ~10 minutes.
2. **LB-1** — one console line plus a dashboard look, ~5 minutes.
3. **LB-3** — needs two identities; do it before LB-4 so the invited account exists.
4. **LB-4** — the longest, ~15 minutes.
5. **LB-6** — only after you approve the mount.
6. **LB-5** — optional, any time, or never.

Paste each result back as you go and the evidence records will be populated and the blocker
status updated. Nothing is marked closed without the artifact.
