# Audio XX — Deployment and Operations

**Last updated:** 2026-05-09
**Audience:** anyone deploying, monitoring, or operating Audio XX in a hosted environment.

For local setup, see [`SETUP.md`](SETUP.md).

---

## 1. Hosting model

| Component | Service |
|---|---|
| Source repository | GitHub: `m1brown/audio-xx` |
| Application hosting | Vercel (per-branch preview deployments via GitHub integration) |
| Database | Turso (libsql) accessed via Prisma + `@prisma/adapter-libsql` |
| Authentication | NextAuth (credentials provider) |
| Error tracking | Sentry (`@sentry/nextjs ^10.51.0`) |
| Domain | `audio-xx.com` *(TODO: verify domain registration and DNS configuration are documented in operations records)* |

There is no separate staging tier today — Vercel previews per branch serve that role. The `friends` branch acts as a preview / friends-shareable environment; `main` is reserved for journalist-readiness.

---

## 2. Branch-to-environment mapping

| Branch | Environment | Trigger | Audience |
|---|---|---|---|
| `main` | Production | Push to `main` | Public-facing (when ready) |
| `friends` | Preview | Push to `friends` | Internal review and friends-shareable testing |
| Feature branches | Preview | Push to any branch | Per-branch preview URLs from Vercel |

The Vercel project is configured via the GitHub integration. There is no `vercel.json` in the repository — Vercel uses Next.js auto-detection.

*TODO: verify — production-domain mapping in the Vercel dashboard. Confirm `main` deploys to `audio-xx.com` and that friends preview is gated appropriately (password / SSO / public).*

---

## 3. Required environment variables (production)

Set these in the Vercel project's Environment Variables panel for the **Production** environment (and mirrored to Preview where appropriate).

### Required

| Variable | Purpose |
|---|---|
| `TURSO_DATABASE_URL` | libsql connection URL |
| `TURSO_AUTH_TOKEN` | libsql auth token |
| `NEXTAUTH_SECRET` | NextAuth session signing key (rotate carefully — invalidates sessions) |
| `NEXTAUTH_URL` | Canonical production URL (e.g. `https://audio-xx.com`) |

### Strongly recommended

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Browser-side Sentry DSN |
| `SENTRY_DSN` | Server-side Sentry DSN (typically the same value) |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Environment label (e.g. `production`, `preview`) |
| `SENTRY_ENVIRONMENT` | Server-side environment label |

### Required for Vercel build only

| Variable | Purpose |
|---|---|
| `SENTRY_AUTH_TOKEN` | Source-map upload during build |
| `SENTRY_ORG` | Sentry organisation slug |
| `SENTRY_PROJECT` | Sentry project slug |

Without `SENTRY_AUTH_TOKEN`, the build still succeeds but source maps are not uploaded — production stack traces will be obfuscated.

### Optional

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | LLM overlay (planned, not currently invoked at runtime) |
| `MEMO_LLM_PROVIDER`, `MEMO_LLM_MODEL` | LLM overlay configuration |
| `NEXT_PUBLIC_DEBUG` | Set to `"1"` to keep tagged debug logs visible in production. Leave blank otherwise. |

---

## 4. Sentry setup

Sentry is wired in code:

- `apps/web/instrumentation.ts` — server-side init
- `apps/web/instrumentation-client.ts` — browser init
- `apps/web/src/app/global-error.tsx` — App Router error boundary forwarding to `Sentry.captureException`

Without DSN values set in the environment, Sentry initialises as a no-op. With DSN set, errors automatically flow to the configured project.

To verify Sentry is reporting after deployment:

1. Trigger a deliberate error in a non-critical path (e.g. a one-off test endpoint or an intentional `throw`).
2. Confirm the error appears in the Sentry dashboard within ~1 minute.
3. Verify the stack trace is unminified (requires source-map upload during build).

*TODO: verify — confirm Sentry alert routing (email, Slack, etc.) is configured for the production environment.*

---

## 5. Database operations

### Schema migrations

Schema lives in `apps/web/prisma/schema.prisma`. Migration workflow:

```bash
# Apply schema changes to local SQLite
cd apps/web
npx prisma db push

# Apply to Turso production (run with production env vars)
TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx prisma db push
```

Vercel does not run schema migrations during deployment. The build runs `prisma generate` only. Schema changes must be pushed to Turso manually before deploying code that depends on them.

*TODO: verify — confirm migration workflow if Prisma Migrate is adopted in the future. Currently the project uses `db push` (schema-first, no migration history).*

### Seeding

Seed data is curated in `packages/data/components.yaml` and loaded via `apps/web/prisma/seed.ts`. The seed is intended for fresh databases:

```bash
npm run db:seed
```

In production, the seed should run once after initial schema push. Subsequent catalog changes ship via the TypeScript catalog (`apps/web/src/lib/products/`), which is consumed directly by the advisory engine without database round-trips.

---

## 6. Deployment workflow

### Standard deployment (preview)

```bash
git checkout friends
# make changes
git add <files>
git commit -m "<imperative-mood message>"
git push origin friends
```

Vercel detects the push and deploys automatically. Build duration: typically 60–120 seconds. The preview URL is visible in the Vercel dashboard and in the GitHub commit status.

### Production deployment (when applicable)

Production deployments happen via `main`. The standard pattern:

```bash
# from `friends`, ensure clean state
git checkout main
git pull origin main
git merge friends     # or rebase, project preference
git push origin main
```

*TODO: verify — confirm production deployment policy (fast-forward merge vs. merge commit, tag-based releases vs. branch-tip).*

---

## 7. Pre-deployment verification checklist

Before pushing to `friends` or `main`:

- [ ] `npm run typecheck` reports the same 98 pre-existing errors (no new errors)
- [ ] `npm test` passes (no failed Vitest tests)
- [ ] `npm run build` completes successfully if database schema or build config changed
- [ ] Manual walk of the four canonical paths from `docs/QA_CHECKLIST.md` § Canonical prompts
- [ ] No accidentally-staged `.env.local` or other secret-bearing file
- [ ] Commit message describes the change clearly

For production deployments specifically, also:

- [ ] Sentry DSN populated in Vercel production env vars
- [ ] Database schema is in sync (Turso production push completed if applicable)
- [ ] `friends` has been demonstrated stable to the maintainer for at least one full day

---

## 8. Post-deployment verification

After a deployment, exercise the live URL:

1. **Cold load.** Visit the deployed URL with a clean browser session. Home page renders within 3 seconds. No console errors.
2. **Sign-in path.** Sign in (or create) a test account. Confirm session persists across page reloads.
3. **Advisory path.** Submit `best DAC under $1500`. Confirm a substantive response with a product card and trade-off framing.
4. **Right rail context.** Confirm the LISTENER, SYSTEM, RECENT sections populate correctly.
5. **Reset path.** Click the "Audio XX" wordmark or the small accent rule. Confirm the conversation resets cleanly.
6. **Sentry sanity.** If a non-fatal error occurs, confirm it lands in the Sentry dashboard.

The full QA checklist is in [`QA_CHECKLIST.md`](QA_CHECKLIST.md).

---

## 9. Rollback

Vercel maintains a history of all deployments per branch. To roll back:

1. Open the Vercel project dashboard.
2. Navigate to the Deployments tab.
3. Locate the last known-good deployment.
4. Click "Promote to Production" (or branch-equivalent).

This rolls back the application code only. **Database schema is not rolled back automatically** — if a recent deployment depended on a Prisma `db push` change, rolling back the code without addressing the schema may leave the application in an inconsistent state. *TODO: verify — establish a database rollback procedure aligned with the deployment policy.*

For a code-level rollback via Git:

```bash
git checkout friends
git revert <commit-sha>
git push origin friends
```

`git revert` is preferred over `git reset --hard` on shared branches.

---

## 10. Operational responsibilities

A non-exhaustive list of recurring operational concerns:

- **Catalog liveness.** Retailer URLs decay over time. A quarterly link audit is reasonable. See [`QA_CHECKLIST.md`](QA_CHECKLIST.md) § Links.
- **Image coverage.** New catalog entries should ship with image overlay map entries where licensable images exist. See [`QA.md`](QA.md) § Image QA.
- **Sentry triage.** A daily glance at the Sentry dashboard catches regressions early.
- **Database backups.** *TODO: verify — confirm Turso backup policy is in place.*
- **Domain renewal.** *TODO: verify — confirm domain registration auto-renewal status.*
- **Authentication secret rotation.** `NEXTAUTH_SECRET` should be rotated periodically. Document the rotation date when performed.
- **Dependency updates.** Periodic `npm audit` and security-update review. The project does not have automated dependency PRs (e.g. Dependabot) configured at this writing — *TODO: verify whether Dependabot is desired*.

---

## 11. Incident response

There is no formal incident response process today. For a friends-shareable / pre-public-beta environment this is acceptable; for public launch this should be formalised.

A reasonable starting framework:

1. **Detection.** Sentry alert fires, or a user reports a broken behaviour.
2. **Assessment.** Reproduce locally (or in preview). Confirm severity: blocking (demo killer), degrading (annoying), cosmetic (polish).
3. **Triage.** Blocking issues warrant immediate rollback to last-known-good deployment.
4. **Fix.** Apply the smallest-safe fix per the conventions in [`CLAUDE_WORKFLOW.md`](CLAUDE_WORKFLOW.md).
5. **Verify.** Walk the full QA checklist before redeploying.
6. **Postmortem.** Note the incident in [`docs/issues-log.md`](issues-log.md) (or a successor incident log).

For a public-launch tier, formalise SLOs, on-call rotation, status-page updates, and customer communication. None of this exists today — by design, since the project has not launched publicly.
