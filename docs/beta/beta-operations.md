# Human Beta — Operations Runbook

Status: ACTIVE (2026-09-22). Baseline `0e2dd16` + feedback-durability release.
Companion documents: `beta-instructions.md` (what a beta user receives),
`beta-ledger.md` (findings), `three-user-beta.md` (learning record).

## 1. Admitting a beta user (operator checklist)

Admission = cohort membership. There is no invite system: accounts
auto-register on first sign-in (email + chosen password at
audio-xx.com — an unknown email creates the account; the only failure
is an existing email with a different password).

Per user:

1. Vercel → project **audio-xx-web** → Settings → Environment Variables →
   `REASONING_LANE_USERS` (Production). The value is a comma-separated
   email list. **Append** `,their@email.com` to the existing value —
   never replace the list (existing members must be preserved; the
   variable is stored as a secret, so keep your own record of the
   current membership).
2. **Redeploy** — required; env changes only apply to a new deployment.
   Deployments → current Production deployment → ⋯ → Redeploy (same
   commit).
3. Verify: after the deploy is live, the user (signed in) opens
   `audio-xx.com/api/reasoning-lane` → must show `{"eligible":true}`.
   Signed-out must remain `{"eligible":false}`.
4. If they were already signed in and on the page before admission:
   a **page refresh** is enough. No logout/login needed — eligibility
   is fetched once per page load, and the server re-checks every turn.
5. Send them `beta-instructions.md` (or its contents in an email).

Removal: delete the email from the list + redeploy (also required).
Their account and saved systems remain; only governed-lane routing
stops. Kill switch for the whole lane: remove the variable + redeploy.

## 2. Retrieving feedback

The in-product widget (Did this help / accurate / would return /
comment) writes durably to the production database (`BetaFeedbackV1`),
associated with the signed-in account email, the advisory id and the
deploy SHA. It ALSO logs an `[AXX-EVENT]` line (ephemeral).

Retrieve with the production DB env vars set (same convention as
contributions review):

```bash
node scripts/feedback-review.mjs
```

"Report issue" (footer + conversation) is a mailto to
hello@audio-xx.com with a structured prompt — those arrive as ordinary
email.

Suggested-edit contributions: `node scripts/contributions-review.mjs`.

## 3. Observability during the beta

- **Per-turn reasoning-lane telemetry** — one structured server-log line
  per turn, no conversation content:
  `[reasoning-lane] result mode=… status=… viol=… repaired=… det=… pub=…
  totalMs=… model=… comps=…` plus `allow/deny user=…` lines. Read via
  Vercel → project → Logs (or `vercel logs <deployment-url>`).
  **Retention is short (hours)** — check logs the same day a listener
  reports something, or rely on Sentry + feedback rows.
- **Errors** — Sentry is wired (client + server, source maps, env vars
  set in Production) and has caught production errors before.
- **Deployment identity** — `audio-xx.com/api/version` (commit SHA,
  deployment, env). Feedback rows also carry the SHA.
- **Validation events** — `[AXX-EVENT]` log lines (assessment_completed,
  return_visit, unknown_product, …), same short retention.
- **What Mike CANNOT see** (by design): conversation content, prompts,
  saved-system contents in logs; there is no session replay. A failure is
  reconstructed from: feedback row (who/when/which advisory/SHA) +
  same-day lane log lines + Sentry + the listener's own account of what
  they asked.

## 4. Failure states (what a beta user experiences)

- **Lane timeout / API error / validator rejection on turn 0**: the
  deterministic assessment renders instead (structured document, honest
  evidence). Logged as `[assessment-synthesis] fallback …`.
- **Lane failure on a conversational turn**: the turn falls back to the
  legacy deterministic modules. This is the known worst fallback — the
  pre-beta simulation documented that path as weak (canned cards,
  repetition). Fallbacks have measured 0 across 29 verified production
  turns; if a listener reports a bizarre canned answer, check the logs
  for a `deny`/fallback line first and record it in the ledger.
- **Unresolved/unknown products**: honestly disclosed ("identity not
  established", "holds no published specifications") — working as
  designed.
- **Session expiry / signed out**: standard sign-in page; auto-registers
  only new emails.
- **Conversations are not stored**: a reload or later visit starts a
  fresh conversation. Saved systems (My Systems) and assessment
  artifacts (View/Print links) persist. This is the product's stated
  design, not a bug — beta users should save systems they want to keep.

## 5. First-beta session protocol (recommended)

1. Admit the user (checklist above) and confirm eligibility together.
2. Ask them to use their REAL system and follow `beta-instructions.md`
   naturally — do not read over their shoulder; let them get stuck.
3. Same day: pull `feedback-review.mjs`, skim Vercel logs for
   `[reasoning-lane]` deny/fallback lines and Sentry for errors.
4. Debrief (15 min, their words): what did it understand/miss? Did you
   trust it? Would you return? What did you expect it to remember?
5. Record everything in `beta-ledger.md` — observations only; per the
   stewardship doctrine, P0/P1 stop-and-report, everything else waits.
