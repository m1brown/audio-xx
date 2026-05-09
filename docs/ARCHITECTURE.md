# Audio XX — Architecture

**Last updated:** 2026-05-09
**Audience:** technical stewards joining the project. Assumes general fluency with TypeScript, React, and Next.js but no prior knowledge of Audio XX.

---

## 1. System philosophy

Audio XX is a **system-level audio advisor**, not a product recommendation engine.

The reasoning order is fixed: system context → trait inference → system balance → anchor comparison → upgrade direction → product suggestions. Products are illustrative outputs of that reasoning, never the entry point. The product reasons about what the user values and how the user's existing chain interacts with that — then optionally cites concrete examples.

Identity invariants worth knowing before reading code:

- **Restraint is a valid outcome.** "Do nothing" is treated as a first-class recommendation path, not a fallback.
- **No scoring, no "best," no urgency.** The engine never ranks products into a numeric league table or emits marketing-pitch language.
- **Trade-offs are mandatory.** Every concrete suggestion names what it costs as well as what it gains.
- **Confidence calibration over assertiveness.** Low-confidence inferences are hedged or refused; the engine surfaces missing information rather than fabricating.

The full behavioural spec lives in `CLAUDE.md` (root); this doc covers structure.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 19 |
| Language | TypeScript ~5.6 |
| Database | Prisma 6 + libsql (Turso-compatible) |
| Auth | NextAuth 4 |
| Test runner | Vitest 2 (134 test files) |
| E2E (latent) | Playwright (installed, used sparingly) |
| Error tracking | Sentry 10 (instrumentation files wired) |
| Workspace tool | npm workspaces (not pnpm) |
| Package manager | npm |
| Hosting | Vercel (per-branch preview deployments) |

---

## 3. Repo layout

```
audio-xx/                          # root (npm workspaces)
├── apps/
│   └── web/                       # Next.js application
│       ├── src/
│       │   ├── app/               # App Router routes
│       │   ├── components/        # UI components
│       │   └── lib/               # advisory engine, intent, consultation
│       ├── prisma/                # Prisma schema + seed
│       ├── instrumentation.ts     # Sentry server init
│       └── instrumentation-client.ts  # Sentry browser init
├── packages/
│   ├── data/                      # YAML catalogs (components.yaml etc.)
│   ├── rules/                     # rules.yaml — 19 deterministic rules
│   └── signals/                   # signals.yaml — phrase → trait dictionary
├── docs/                          # (this directory)
├── CLAUDE.md                      # locked behaviour spec
├── ROADMAP-SPEAKS-FOR-ITSELF.md   # 5-milestone roadmap
└── memory/MEMORY.md               # known misalignments + working preferences
```

Engine code lives in `apps/web/src/lib/`. The `packages/` workspaces hold data and configuration but no advisory logic. Despite the workspace structure, **no code has been extracted into the packages yet** — the long-term plan (Workstream B in `docs/implementation-plan.md`) is to lift the portable reasoning core into a `@audioxx/decision-engine` package once behaviour stabilises. As of this writing, that extraction has not begun.

---

## 4. Deterministic + LLM hybrid (current state)

**Today the system is fully deterministic.** Every advisory response is generated from rule evaluation, signal extraction, and TypeScript-coded reasoning paths over the YAML catalog.

There is **no live LLM call in the production path** at the moment. The LLM overlay (referred to in the QA report and the roadmap as "the LLM overlay") is a planned addition that would handle:

- Unknown products (graceful acknowledgement instead of empty response)
- General audiophile knowledge questions outside the catalog
- Free-form clarifications and educational content

Pieces of overlay infrastructure exist (`apps/web/src/app/api/memo-overlay/`, `packages/signals` integration points, structured-data envelopes in route handlers), but the runtime call is not wired. Treat the LLM overlay as the highest-leverage piece of work that has not yet shipped.

The deterministic path is what a journalist would currently see end-to-end.

---

## 5. Advisory pipeline (deterministic path)

The five-step pipeline is documented in detail in `docs/AudioXX_Advisory_Brain.md`. Summary:

1. **Preference extraction.** Phrases and signals from the user's input map to trait tendencies (`flow`, `clarity`, `tonal_density`, `dynamics`, `fatigue_risk`, etc.) via `packages/signals/signals.yaml` and code in `apps/web/src/lib/`.
2. **Architectural mapping.** Trait priorities translate to engineering principles (topology, feedback, damping, etc.) — surfaced to the user as "that experience usually comes from" framing.
3. **System-level reasoning.** Active-system context (from `AudioSessionContext`) determines whether candidate components compensate or compound existing tendencies.
4. **Directional framing.** 2–3 paths surfaced, each with what-it-optimises, trade-offs, and an illustrative gear example.
5. **Restrained conclusion.** Recommendations are calibrated: high-confidence allows assertive language; low-confidence requires hedging or refusal.

The pipeline is implemented across `apps/web/src/lib/` (consultation.ts, reasoning.ts, advisory-response.ts, decision-frame.ts, etc.) and is the substantive surface area of the codebase.

---

## 6. Routing / intents

`apps/web/src/lib/intent.ts` classifies each user message into an intent (`shopping`, `improvement`, `diagnosis`, `comparison`, `assess_my_system`, `general_question`, etc.). The classifier uses keyword patterns, signal extraction, and conversation-state context.

A few notable behaviours:

- **`REFINEMENT_ESCAPE` gating.** Phrases like "more warmth" or "more clarity" are treated as refinements of the active system rather than new shopping queries when an active saved system exists. The gate lives in `intent.ts` and depends on the `hasActiveSavedSystem` option.
- **Chip intent persistence.** Curated starter chips (Assess / Improve / Compare etc.) set a `chipIntentRef` so follow-ups stay in the chosen lane across turns.
- **Diagnosis short-circuit.** When intent is diagnosis and either an inline subject or an active system exists, `buildSystemDiagnosis` runs immediately, bypassing shopping-tier resolution.

Known misalignments in this layer are tracked in `MEMORY.md` (items 4–6 are intent/routing-related: follow-up continuity, unknown products, non-advisory force-routing).

---

## 7. System memory model

State lives in `AudioSessionContext` (`apps/web/src/lib/audio-session-context.tsx`). The model has three classes of system reference:

- **Saved system** — persisted in localStorage (`audioxx.systems.v1`), resolved to API-fetched `SavedSystem` records when authenticated.
- **Draft system** — held in sessionStorage (`audioxx:draft-system`) for guest / unauthenticated flows. Survives page reloads but not new sessions.
- **Active system reference** — `ActiveSystemRef = { kind: 'saved'; id } | { kind: 'draft' } | null`.

Lifecycle highlights:

1. On mount, the context lazily hydrates the draft from sessionStorage (no race with React 18 strict mode).
2. When NextAuth becomes `authenticated`, profile + saved systems fetch in parallel and resolve `activeSystemRef` from `profile.activeSystemId` (validated against fetched systems).
3. On sign-out, saved systems are cleared but the draft is preserved.
4. Storage adapters live in `apps/web/src/lib/storage/local-storage-adapter.ts`.

**Conversation messages are NOT persisted across navigation.** They live in the `useReducer` state of the home page (`apps/web/src/app/page.tsx`). Navigating away from `/` and returning resets the conversation. This is a known gap surfaced in the navigation QA pass — see `MEMORY.md` and the QA section below.

---

## 8. Comparison flow

Comparisons are entered when intent classifier detects a "X vs Y" pattern or when a user asks about a brand without specifying a product. Resolution lives in `apps/web/src/lib/consultation.ts`:

- **Subject matching.** `resolveComparisonSubject` matches both products by name (normalize-tolerant, handles diacritics and hyphen/space variations).
- **Brand-only fallback.** When the user names a brand without a model, a `BRAND_REPRESENTATIVE_PRODUCTS` lookup (with longest-match priority) substitutes the brand's most-representative model from the catalog. Each entry is hand-curated.
- **Output.** `buildComparisonArtifact` produces the structured comparison block rendered by `AdvisoryProductCard` / `AdvisoryUpgradePaths`.

Image fallback is integrated: `resolveProductImageStrict` returns `undefined` when no real image is available, and the renderer omits the image surface rather than substituting the wrong product.

---

## 9. Product catalog structure

The catalog is split between two formats. **They are the same data conceptually but rendered through different paths today.**

**TypeScript catalog (used by the advisory engine):**

```
apps/web/src/lib/products/
├── dacs.ts            # 76 retailer-link entries
├── amplifiers.ts      # 66 entries
├── speakers.ts        # 37 entries
├── turntables.ts      # 6 entries
├── headphones.ts      # 4 entries
└── legacy-models.ts   # legacy → current successor mapping
```

Each entry includes axis positions, trait tendencies, descriptions, retailer links, source citations, and (where available) tendency profiles with confidence scoring. The dual-axis primary classification (`warm_bright`, `smooth_detailed`, `elastic_controlled`, `airy_closed`) is the canonical 4-axis sonic trait framework — see `docs/audio_xx_sonic_trait_framework_v1.md`.

**YAML catalog (legacy, partial):**

```
packages/data/components.yaml   # ~127 components in the older qualitative format
```

The YAML catalog uses qualitative trait values (`strong`, `moderate`, `slight`, `neutral`, `slight-risk`, `moderate-risk`) and was the original seed format. Most newer entries live in the TypeScript files. The two formats are not fully unified — this is a known knowledge-model debt tracked in `docs/audio_xx_knowledge_model.md`.

---

## 10. Image system

`apps/web/src/lib/product-images.ts` provides image resolution. The pattern:

- An overlay map maps `${normalize(brand)} ${normalize(name)}` → `{ url, source }` where source includes tier, site, credit, and capture date.
- `getProductImage` returns the URL or empty-string sentinel.
- `resolveProductImageStrict` returns `undefined` when there is no real image (the renderer then omits the image surface entirely — no broken-image placeholder).
- Image source attribution (`ImageSource`) is rendered as a small "Image: <site>" caption under the image.

Coverage as of the most recent documented push: ~94% across the catalog. The remainder is intentional: when no licensable image is available, the strict resolver yields nothing rather than displaying a wrong-product fallback.

---

## 11. Workspace architecture

The home page (`apps/web/src/app/page.tsx`) renders a 3-column workspace grid on desktop:

```
┌──────────┬─────────────────────────┬──────────┐
│ LeftRail │ Main column             │ RightRail│
│  184px   │ minmax(0, 820px)        │  296px   │
└──────────┴─────────────────────────┴──────────┘
```

- **LeftRail** (`components/workspace/LeftRail.tsx`) — workspace navigation (Conversation, Systems, Listening Profile) + reference links (How It Works, Glossary, Resources). Conversation is hardcoded as the current item; clicking it calls `onReset`. The other items are regular `<Link>` anchors.
- **Main column** — hero, conversation thread, advisory rendering.
- **RightRail** (`components/workspace/RightRail.tsx`) — listener context (top traits), active system, recent activity. Pure presentational; receives snapshots as props.

Responsive collapse is governed by `globals.css` `audioxx-workspace-grid` rules:

- ≥1200px — full 3-column grid
- 1024–1199px — left rail + main (right rail hidden)
- <1024px — single column (both rails hidden)

**The rails currently mount only on `/`** (the home route). Other routes (`/systems`, `/profile`, etc.) render top nav only. This is an explicit scope decision — see the navigation QA section in `QA.md`.

---

## 12. Branch strategy

Currently active branches (local):

- **`main`** — stable; `origin/main` is the default branch on GitHub.
- **`friends`** — the active development branch. Currently 25+ commits ahead of `main`. All recent work (workspace architecture, accent restoration, retailer link fixes) ships here.
- Several legacy / backup branches: `eval-baseline`, `pre-fix-backup`, `safety/before-deploy-sync`, `wip-save-audio-xx`, `fix/system-state`. Treat these as historical; do not commit to them.

Workflow today:

1. Work happens on `friends`.
2. Each logical change ships as an isolated commit.
3. `friends` gets pushed to `origin/friends` after each commit.
4. Merging `friends` → `main` is gated on demo readiness (see roadmap milestones M1–M5).

There is no automated CI/CD on either branch as of this writing. Pre-commit hooks and CI gates are deferred (Workstream A items A4/A5 in `implementation-plan.md`).

---

## 13. Deployment model

- **Source of truth:** GitHub repo `m1brown/audio-xx`.
- **Hosting:** Vercel, connected via the GitHub integration. Each branch gets an automatic preview deployment.
- **No `vercel.json` in the repo** — Vercel uses Next.js auto-detection.
- **Database:** Turso (libsql) via Prisma. Connection string is configured per environment in Vercel.
- **Auth:** NextAuth, environment-specific credentials.
- **Sentry:** wired in code (`instrumentation.ts`, `instrumentation-client.ts`, `app/global-error.tsx`). Activates only when `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` are set in the environment.

Production / friends-shareable deployment status:

- The `friends` branch deploys automatically on each push to `origin/friends`.
- Whether the preview is gated (password / SSO / public) is a Vercel dashboard setting and is not visible from the repo.
- Sentry DSN presence in production env vars is also dashboard-side and must be confirmed manually.

The friends-shareable acceptance bar is documented in `docs/implementation-plan.md` (Workstream A0).
