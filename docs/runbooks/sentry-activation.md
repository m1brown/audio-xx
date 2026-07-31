# Sentry activation runbook (pre-beta item 2)

Status 2026-07-31: **code layer complete and verified; activation blocked on
one founder action** (Sentry account/project creation — an account action
Claude cannot perform).

## What is already in place (no further code work needed)

- `apps/web/instrumentation.ts` — Node + Edge `Sentry.init`, no-op without
  `SENTRY_DSN`; `onRequestError` covers RSC/route-handler failures.
- `apps/web/instrumentation-client.ts` — browser init, no-op without
  `NEXT_PUBLIC_SENTRY_DSN`; router-transition instrumentation wired.
- **Scrubbing (both sides):** request bodies `[redacted]`, breadcrumb data
  messages `[redacted]`, cookies emptied server-side, `sendDefaultPii: false`,
  `tracesSampleRate: 0`. User conversation text, system descriptions, and
  passwords never reach Sentry.
- **Fail-safe:** the SDK is enabled only when a DSN is present; Sentry
  outages degrade to no-ops and cannot break the application.
- Source-map upload wired via `withSentryConfig` in `next.config.*`
  (activates when `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` exist).
- Controlled test route `/api/debug/error?token=<DEBUG_ERROR_TOKEN>` —
  404 unless the token env var is set and matches; fires exactly one
  deliberate test event.

## Founder actions (once, ~15 minutes)

1. Create a Sentry account/org + one Next.js project (sentry.io).
2. In Vercel → audio-xx-web → Environment Variables, add:

   | Variable | Environments | Value |
   |---|---|---|
   | `NEXT_PUBLIC_SENTRY_DSN` | Production + Preview | project DSN |
   | `SENTRY_DSN` | Production + Preview | same DSN |
   | `SENTRY_ENVIRONMENT` + `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Production | `production` |
   | `SENTRY_ENVIRONMENT` + `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Preview | `preview` |
   | `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Production + Preview | from Sentry (auth token: `project:releases` scope, for source maps) |
   | `DEBUG_ERROR_TOKEN` | Production | any long random string |

3. Redeploy (any push or `vercel redeploy`).

## Verification (Claude or founder, after step 3)

1. `curl "https://audio-xx.com/api/debug/error?token=<DEBUG_ERROR_TOKEN>"`
   → `{"captured":true}`.
2. Confirm the event "Audio XX controlled monitoring test error" appears in
   Sentry with environment `production` and a readable (source-mapped)
   stack trace.
3. Confirm the event contains no request body, no cookies, no user text.
