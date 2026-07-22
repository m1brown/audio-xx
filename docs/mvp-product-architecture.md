# Audio XX — MVP Product Architecture (Phase 3)

**Status:** Adopted 2026-07-20 · Engine frozen (see `audit-2026-07-19/launch-checklist/LAUNCH-CHECKLIST.md`) · This document governs product work until public launch.

**Guiding principle applied throughout:** every decision below was tested against "does this get Audio XX into real users' hands faster while improving their first experience?" Where the answer was no, the item is on the roadmap, not in the MVP.

---

## 1. Product Architecture

Audio XX MVP is **one page-flow wrapped around one artifact**:

```
Landing ("What are you listening to?")
   └─ Build Your System  (typeahead over the catalog + free text)
         └─ Assessment    (the product — server-rendered editorial artifact)
               ├─ Print   (free, unlimited)
               ├─ Share   (free, unlimited — the URL IS the share link)
               └─ Save System → create account → My Systems (3-month trial → $3/mo)
```

Three deliberate properties:

1. **The assessment is stateless and free.** An assessment is a pure function of the system description: `URL → engine → artifact`. No account, no database row, no rate limit. This makes sharing trivial (copy the URL), makes printing trivial (print CSS on the same page), and means anonymous traffic costs us nothing but compute.
2. **Persistence is the paid product.** Accounts exist for exactly one reason: *keeping* systems. `My Systems` is a collection, not a feature gate. Nothing a lapsed subscriber saved is ever deleted or hidden.
3. **The engine is a frozen in-process library.** No service boundary, no API between product and engine. The product calls `buildSystemAssessment()` + `synthesizeArtifact()` directly in a server component — the same functions the regression suite pins.

**What already exists and is reused (this is most of the MVP):**

| Product need | Existing asset | Gap |
|---|---|---|
| Assessment page | `/artifact?system=…` server route → engine → `AssessmentArtifact` (editorial design, print CSS) | Product chrome: print/share/save actions |
| Landing | Phase 2A editorial cover ("Notes on Your System") | Builder as primary input |
| Build Your System | Free-text composer (works, but demands the user compose a sentence) | Catalog typeahead builder |
| Accounts | NextAuth credentials + Prisma `User`/`Profile` | Explicit "create account at save" flow; polish |
| Saved systems | `System`/`SystemComponent` models + `/api/systems` CRUD + `/systems` pages | Assessment snapshots; My Systems collection UX |
| Billing | — | Stripe, Milestone 4 |

## 2. User Journey

**First visit (anonymous, frictionless end-to-end):**
1. Land on the editorial cover. One question: *what are you listening to?* Two ways to answer: pick components (builder) or describe in your own words (composer). An example assessment is one click away for readers who want proof before effort.
2. Builder: type "pontus" → catalog suggests *Denafrips Pontus II — DAC*; three fields (source, amplifier, speakers), add more if needed; unknown gear accepted as typed. Fifteen seconds of typing, zero forms, zero dropdown archaeology.
3. **Read my assessment** → `/artifact?system=…`, server-rendered in well under a second (deterministic engine, no LLM on the critical path). The page is the publication spread: verdict first, evidence, recommendation.
4. Actions on the artifact: **Print** (browser print, print stylesheet already tuned), **Copy link** (the URL is self-contained — paste it in a forum, the recipient sees the identical assessment), **Assess another system**, **Save this system**.
5. **Save this system** → account creation (email + password, one screen, copy: "Start your collection — free for three months"). On success the system + assessment snapshot persist and the user lands in **My Systems**.
6. Return visits: My Systems shows the collection; each system opens to its saved assessment; *Re-assess* re-runs the frozen engine (later: the evolved engine — this is the "updated assessments" promise).
7. Day ~76 and ~88 of trial: an unobtrusive notice in My Systems ("your trial ends on <date> — $3/month to keep building"). Post-trial without subscribing: everything saved remains readable, printable, sharable forever; **saving new systems and re-assessing** require the subscription. Paying is for *building* the collection, never for reading it.

**Sharing loop (the acquisition mechanism):** every shared artifact URL is a landing page — the recipient reads a real assessment of a real system, and the same page invites them to build their own. No watermark walls, no "sign up to view".

## 3. Screen Specifications

### 3.1 Landing / Build Your System (one screen, `/`)
- Keeps the Phase 2A editorial cover: masthead, "SYSTEM ASSESSMENT / Notes on Your System", subtitle.
- **Primary interaction — the builder** (`SystemBuilder`): three labeled fields (*Source or DAC*, *Amplifier*, *Speakers*) with catalog typeahead; suggestions show `Brand Model — category`; free text stands as typed when nothing matches; **＋ add another component** appends a fourth/fifth unlabeled field; single CTA **Read my assessment**, enabled once ≥2 fields are non-empty.
- **Secondary:** the existing conversational composer, beneath, headed "Prefer to describe it in your own words?" — preserves the full advisory chat (diagnosis, shopping, knowledge) unchanged.
- Tertiary: "See an example assessment →" (exists).
- No sign-in prompt anywhere on this screen beyond the existing quiet header link.

### 3.2 Assessment (`/artifact?system=…`)
- Server component. Runs engine + synthesizer; renders `AssessmentArtifact` (existing editorial layout: verdict headline, character line, chain banner, evidence, recommendation, dated signature).
- **Action bar** (new, screen-only — hidden in print): Print · Copy link · Save this system · New assessment. Styled as quiet editorial marginalia, not app buttons.
- Failure path: if the text doesn't resolve to ≥2 components, an editorial notice with a link back to the builder — never a dead end.
- `?print=1` remains the chrome-free render (also used for PDF capture).

### 3.3 Create account (reached only from *Save this system*)
- One card: email, password, one sentence of promise ("Your collection, free for three months. Then $3/month. Assessments stay free forever.").
- On success: persist pending system + assessment snapshot, redirect to My Systems. NextAuth credentials with auto-register (exists) — the "sign in vs sign up" distinction collapses into one field pair.

### 3.4 My Systems (`/systems`)
- The collection: one card per system — name (renamable inline), component chain line, saved-assessment date, verdict one-liner. Open → saved assessment artifact (with its actions). *Re-assess* runs the current engine and stores a new snapshot alongside the old (history preserved).
- Empty state: "No systems yet — build your first" → landing.
- Trial/subscription state appears here and only here (quiet line under the page title).

### 3.5 Account (minimal, `/account`)
- Email, subscription status (trial ends <date> / active / lapsed), subscribe & manage-billing buttons (Stripe-hosted), sign out. Nothing else in the MVP.

## 4. Technical Architecture

**Recommendation: keep the existing stack; add only Stripe.** Reasoning per layer:

- **Next.js 15 App Router on Vercel** *(existing)* — the artifact is server-rendered React sharing the engine's TypeScript in-process; splitting an "engine API" would add a network hop, a deploy unit, and a contract to maintain, for zero user-visible benefit. Vercel deploy is already proven on this repo (previews per branch = review-per-milestone for free).
- **Engine in-process, frozen** *(existing)* — deterministic, ~tens of ms per assessment, no GPU/LLM on the assessment path. The LLM overlay (prose refinement) stays out of the product path for M1; the deterministic artifact is already demo-quality, and keeping the first render synchronous keeps it fast and cheap. Revisit post-launch.
- **Prisma + SQLite (dev) / Turso libSQL (prod)** *(existing)* — the data is small (users, systems, snapshots), relational, low-write. Turso's free tier covers MVP scale; the Prisma adapter is already wired. Migrating to Postgres later is a schema-compatible move if scale demands it — not an MVP problem.
- **NextAuth credentials** *(existing)* — email+password with auto-register is the lowest-friction account creation that still works offline-from-providers. Magic links / OAuth are roadmap (they add an email service / provider console dependency to the critical path). Passwords hashed with bcrypt (exists).
- **Stripe for billing** *(new, Milestone 4)* — the only serious choice at $3/mo scale. Key design decision: **the 3-month trial is ours, not Stripe's.** `User.createdAt + 92 days = trialEndsAt`, computed, no card required at account creation (the brief demands account creation stay friction-free). Stripe enters only when the user clicks Subscribe: Checkout (hosted) → webhook → `Subscription` row. Lapse = `status != active && past trial` → save/re-assess disabled, reading untouched. No card-upfront trials, no dunning complexity at MVP.
- **Catalog typeahead: build-time static index** *(new, M1)* — `components.yaml` (~130 entries) compiles to a committed JSON index bundled with the client. No API call, no DB dependency, no auth question, instant suggestions, works in every preview. A sync test fails CI if the YAML and index drift.
- **Share links: the URL is the payload** *(M1)* — `?system=` encoding means zero storage for anonymous shares and guarantees the link never 404s. Pretty short-links (`/a/<id>`) are a roadmap nicety; saved systems get stable IDs anyway in M2.
- **Testing** — engine regression suite untouched and gated (`node scripts/test-gate.mjs`, trusted baseline). **New product suite** lives in `apps/web/src/product/__tests__/` and runs in the same vitest run; product tests never import chat internals — only the public product modules (catalog index, builder logic, artifact route pipeline, later API routes).
- **Observability** — Vercel analytics + existing console telemetry for MVP; error tracking (Sentry) is on the launch checklist, not M1.

## 5. Data Model (minimum persistent)

Existing models kept; two additions (marked ★). All JSON columns are strings (libSQL).

```
User          id, email (unique), password (bcrypt), createdAt
              → trialEndsAt is COMPUTED (createdAt + 92d), not stored

System        id, userId, name, notes?, location?, primaryUse?, createdAt, updatedAt
SystemComponent  (existing) systemId, brand, name, category/role, seed ref?

★ AssessmentSnapshot
              id, systemId, userId, systemText (the exact engine input),
              payloadJson (synthesized ArtifactPayload — what was rendered),
              engineVersion (git sha at render), createdAt
              — immutable; re-assessment appends a new row. This is what makes
                "revisit previous assessments" and "updated assessments as the
                engine evolves" possible without re-running old engines.

★ Subscription
              id, userId (unique), stripeCustomerId, stripeSubscriptionId,
              status ('active'|'canceled'|'past_due'…), currentPeriodEnd, updatedAt
              — absence of a row + past trialEndsAt = lapsed. Data never deleted
                on lapse, by construction: no code path deletes user content on
                subscription events.
```

`Profile`, `Component` (catalog mirror), and preference tables already exist and are untouched by MVP milestones.

## 6. MVP Roadmap

Each milestone leaves `main`-deployable, independently testable, and small enough to review in one sitting.

| # | Objective | Scope | Done when |
|---|---|---|---|
| **M1** ✅ | **Frictionless core loop** — Build Your System → beautiful assessment → print/share | Shipped 2026-07-20 (`docs/mvp-milestone-1-report.md`) | Anonymous user goes from landing to printed/shared assessment with zero accounts; gate green; product tests green |
| **M2** ✅ | **Save System → account → persistence** | Shipped 2026-07-21 (`docs/mvp-milestone-2-report.md`) — save flow, `/save` account card, AssessmentSnapshot model, My Systems collection, saved-assessment view. Deploy prerequisite: one additive `prisma db push` to Turso | Save → account → revisit works end-to-end on a fresh browser ✅ |
| **M3** ✅ | **Assessment history** | Shipped 2026-07-22 (`docs/mvp-milestone-3-report.md`) — saved-system page with newest-first history, historical assessment view, Add today's assessment, explicit identical-reassessment rule. No schema change; not yet deployed (own promotion gate) | A returning user manages ≥2 systems with several assessments each; history is understanding, not an archive ✅ |
| **M4** | **Billing** | Stripe Checkout + webhook + `Subscription`; computed trial; lapse behavior (read forever, build requires subscription); `/account` | Test-mode subscribe/cancel/lapse verified; no data-deletion path exists |
| **M5** | **Launch hardening** | OG/meta per artifact, mobile pass, perf budget, Sentry, legal pages check, MVP checklist executed | Every checklist item verifiable and green |

**Deferred by design** (architecture leaves the door open): comparison (snapshots are per-system rows — comparing is a read), recommendations, wishlists, community, additional assessment types (the `AssessmentSnapshot.payloadJson` is typed by `engineVersion`), OAuth/magic links, short share links.

---

## Milestone 1 — Definition of Done (implemented this phase)

1. `catalog-index.json` generated from `components.yaml` + sync-guard test.
2. `SystemBuilder` on the landing cover: 3 role fields + add-more, typeahead, free-text fallback, CTA → `/artifact?system=…`. Existing composer preserved as the secondary path.
3. Artifact action bar: Print, Copy link, New assessment, Save this system (→ honest "coming with My Systems" affordance until M2). Hidden in `?print=1` and browser print.
4. Failure path on unresolvable systems links back to the builder.
5. Product test suite: catalog index (sync, search), builder composition (fields → engine text), artifact pipeline e2e (composed text → assessment kind, non-empty payload), URL round-trip.
6. Engine regression gate green; live browser acceptance of the full loop; milestone report.
