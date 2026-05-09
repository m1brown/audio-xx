# Audio XX — Local Setup

**Last updated:** 2026-05-09
**Audience:** technical contributors setting up the project for the first time, or troubleshooting a broken local environment.

For deployment to staging or production, see [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 or later | *TODO: verify minimum — no `engines` field is declared. Project has been developed on Node 20+. Older versions are untested.* |
| npm | 10 or later | The repository uses npm workspaces; `pnpm` and `yarn` are not configured. |
| Git | any recent | Standard requirements. |

A working installation of `prisma` is provided via the `apps/web` workspace; no global Prisma install is needed.

---

## 2. Clone and install

```bash
git clone git@github.com:m1brown/audio-xx.git
cd audio-xx
git checkout friends   # active development branch
npm install
```

`npm install` at the repo root installs all workspace dependencies, including `apps/web`, `packages/rules`, `packages/data`, and `packages/signals`.

---

## 3. Environment variables

Copy the example file:

```bash
cp apps/web/.env.example apps/web/.env.local
```

The full set of variables, grouped by purpose:

### Required for local development

| Variable | Local value | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite file used by `prisma generate` / `prisma db push` |
| `NEXTAUTH_SECRET` | any random string | NextAuth session signing key. Generate with `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | `http://localhost:3000` | NextAuth canonical URL |

### Required for production / preview deployments only

| Variable | Purpose |
|---|---|
| `TURSO_DATABASE_URL` | libsql connection URL for the production database |
| `TURSO_AUTH_TOKEN` | libsql auth token |

The Prisma client is configured to use the libsql adapter (`apps/web/src/lib/prisma.ts`) when the Turso variables are set. Local development uses the SQLite file directly.

### Optional — observability

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` | Sentry error reporting. Both must be set to enable. Sentry initialises as a no-op when blank. |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` / `SENTRY_ENVIRONMENT` | Environment label (e.g. `production`, `preview`, `dev`). |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Source-map upload during the Vercel build. Not needed locally. |
| `NEXT_PUBLIC_DEBUG` | Set to `"1"` to keep tagged `console.log('[…]')` calls visible in the browser. Default empty (silenced). |

### Optional — LLM overlay (planned)

| Variable | Purpose |
|---|---|
| `MEMO_LLM_PROVIDER` | Provider key. Default: `openai`. |
| `OPENAI_API_KEY` | API key for the optional LLM overlay. |
| `MEMO_LLM_MODEL` | Model id. Default: `gpt-4o`. |

The LLM overlay is partially scaffolded but **not currently invoked in the production reasoning path**. Setting these variables enables the scaffolding to initialise without errors but does not change runtime behaviour today.

---

## 4. Database setup

### Local SQLite

```bash
cd apps/web
npx prisma generate    # generate the Prisma client
npx prisma db push     # apply the schema to dev.db
npm run db:seed        # load reference components from packages/data
cd ../..
```

The seed script reads `packages/data/components.yaml` and populates the `Component` table with the reference catalog (~127 components in the legacy YAML; the newer TypeScript catalog under `apps/web/src/lib/products/` is not loaded into the database — it is consumed directly by the advisory engine).

### Production Turso

For a production-style local connection (rare — most contributors use SQLite locally):

```bash
TURSO_DATABASE_URL=libsql://your-instance.turso.io \
TURSO_AUTH_TOKEN=your-token \
npx prisma db push
```

The Prisma client auto-detects Turso when both variables are set.

---

## 5. Authentication setup

NextAuth is configured for credentials-based sign-in (`apps/web/src/app/auth/signin/page.tsx`). Local accounts are created automatically on first sign-in — there is no separate signup flow.

For production deployments, `NEXTAUTH_SECRET` must be set to a stable random value. Rotating the secret invalidates all active sessions.

OAuth providers are not currently configured. *TODO: verify — if OAuth providers are added in the future, document configuration steps here.*

---

## 6. Running locally

From the repo root:

```bash
npm run dev
```

The Next.js dev server runs at `http://localhost:3000`. Hot module reload is active for all `apps/web/src/` files.

Common commands during development:

| Command | Use |
|---|---|
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode (re-runs on file change) |
| `npm run typecheck` | TypeScript checking |
| `npm run lint` | ESLint |

---

## 7. Verification steps

After setup, confirm the following work end-to-end:

1. **Server boots.** `npm run dev` produces `Ready on http://localhost:3000` with no fatal errors.
2. **Home page renders.** Visit `http://localhost:3000`. The 3-column workspace (LeftRail / main column / RightRail) appears at viewport width ≥ 1200px.
3. **Sign-in works.** Click "Sign in" in the top nav. Submit any email/password — a new account is created. The radar avatar appears in the top nav.
4. **System creation.** Click "Add your system" or use the system editor. Save a system with at least one component. The system appears in the right rail under "SYSTEM."
5. **Advisory query.** Type `best DAC under $1500` into the input and submit. A response renders within a few seconds, including a primary recommendation card with a product image (when available).
6. **Vitest passes.** `npm test` reports 0 failures. *TODO: verify — there are 98 known pre-existing TypeScript errors that do not block tests, but they should not regress.*
7. **TypeScript baseline.** `npm run typecheck` reports the same 98 pre-existing errors. New errors are not allowed without an explicit deferral note.

---

## 8. Common failures

| Symptom | Likely cause | Resolution |
|---|---|---|
| `Cannot find module '@prisma/client'` | Prisma client not generated | `cd apps/web && npx prisma generate` |
| Sign-in returns 500 | `NEXTAUTH_SECRET` or `NEXTAUTH_URL` missing | Set both in `apps/web/.env.local` |
| Database errors on first run | `dev.db` not created | `cd apps/web && npx prisma db push` |
| Empty advisory responses | YAML data not seeded | `npm run db:seed` |
| Sentry initialisation warnings in console | DSN unset (expected locally) | Ignore — Sentry is a no-op without DSN |
| `next build` fails on unrelated TypeScript errors | The 98 pre-existing errors | Use `next dev` for development; `next build` is run by Vercel which tolerates these via its own configuration. *TODO: verify — confirm Vercel build configuration.* |

---

## 9. Workspace notes

The repo uses npm workspaces. All packages share a single `node_modules/` at the root (with workspace-specific resolution). Implications:

- Run `npm install` from the repo root, not from `apps/web/`.
- Add new dependencies via `npm install <pkg> --workspace=apps/web` (or the appropriate package).
- Vitest runs at the root level via the root `vitest.config.ts`. Test files live primarily under `apps/web/src/lib/__tests__/` (~134 files).

Workspace structure:

```
audio-xx/
├── apps/web/              # Next.js app
├── packages/data/         # YAML catalogs
├── packages/rules/        # rules.yaml + minimal TS wrapper
├── packages/signals/      # signals.yaml + minimal TS wrapper
├── docs/                  # all documentation
└── package.json           # root, defines workspaces
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for a deeper structural overview.
