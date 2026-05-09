# Audio XX — System Architecture Summary

A high-level technical overview written for two audiences: an engineer evaluating implementation, and a non-technical operator who needs a working mental model of how the system is constructed.

Each section opens with a plain-language framing, then expands into specifics. Engineering terms are briefly explained at first mention. For deeper detail, see [`/docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

---

## The shape of the system in one paragraph

Audio XX is a single web application. The user interacts with it through a browser. When a user asks a question, the application classifies what the user is asking, extracts signals from the words they used, looks up the user's saved equipment, runs the advisory reasoning, and returns a structured response. Every step of that reasoning is implemented in deterministic code (predictable, reviewable rules and logic — no machine-learning model is making decisions). A curated reference catalog supplies the knowledge about specific products. The application is hosted on a commercial platform that automatically deploys each branch of the code repository to its own preview environment.

That paragraph is the entire system. The sections below describe each piece in more detail.

---

## Stack at a glance

| Layer | Choice | Plain-language note |
|---|---|---|
| Application framework | Next.js 15 (App Router), React 19 | Next.js is a popular framework for building modern web applications. React is the underlying library it uses to build user interfaces. |
| Language | TypeScript | A version of JavaScript that adds type-checking. Helps catch a class of bugs before the code runs. |
| Database | Prisma 6 + libsql (Turso-compatible) | Prisma is a tool for talking to a database from code. libsql is a database engine; Turso is the hosted service that runs it. |
| Authentication | NextAuth 4 (credentials provider) | NextAuth is a library for handling user sign-in. The credentials provider means users sign in with email and password. |
| Test runner | Vitest | The tool that runs the project's automated tests. |
| Error tracking | Sentry | When something goes wrong in the running application, Sentry catches the error and reports it to a dashboard. |
| Hosting | Vercel | The commercial service that hosts the application and creates a preview deployment for each branch of code. |
| Workspace tool | npm workspaces | A way to organise multiple related code packages in a single repository. |

A reader does not need to know any of these specific tools to understand the project. They are all conventional choices for a modern web application.

---

## Repository structure

```
audio-xx/
├── apps/web/              The application itself — UI plus reasoning engine
│   ├── src/app/             Browser routes (which URL shows which page)
│   ├── src/components/      Reusable UI building blocks
│   └── src/lib/             The advisory engine: intent classification,
│                            reasoning logic, advisory response construction
├── packages/
│   ├── data/                Curated reference catalog (YAML files)
│   ├── rules/               Deterministic rule definitions
│   └── signals/             Phrase → trait mappings (how words become signals)
├── docs/                  Technical and operational documentation
├── handoff/               Onboarding package (this directory)
├── CLAUDE.md              The locked behavioural specification for the advisor
└── ROADMAP-SPEAKS-FOR-ITSELF.md
```

The application code lives in `apps/web/`. The curated knowledge lives in `packages/`. The documentation lives in `docs/` and `handoff/`. There is no separate API service or back-end project — the same Next.js application serves both the UI and the reasoning logic.

---

## Deterministic reasoning, with a planned language-model overlay

**Plain-language framing.** Every advisory response is generated today by predictable code — rules, lookup tables, and explicit logic. There is no large language model (the kind of system behind ChatGPT or similar tools) actually answering user questions in production. The advantage is that every response is auditable: you can read the code and trace exactly why the system said what it said.

A language-model overlay is planned but not yet active. It is intended to handle cases the deterministic core cannot answer well — for example, products that are not in the curated catalog. The deterministic core would remain in charge of the main advisory path; the language model would only be called as a fallback for specific gaps.

```
       ┌─────────────────────────────────────────┐
       │       DETERMINISTIC CORE (today)        │
       │                                         │
       │  Intent classification                  │  ← what is the user asking?
       │  Signal extraction                      │  ← which traits do their
       │                                         │     words point to?
       │  Trait inference                        │  ← what listening
       │                                         │     priorities does that
       │                                         │     imply?
       │  System balance reasoning               │  ← how does the user's
       │                                         │     existing system shape
       │                                         │     this answer?
       │  Comparison resolution                  │  ← if they named two
       │                                         │     products, find both
       │  Advisory response construction         │  ← assemble the structured
       │                                         │     reply
       │                                         │
       │  Source: rule engine + curated catalog  │
       └─────────────────────────────────────────┘
                         │
                         │  (planned, not yet wired)
                         ▼
       ┌─────────────────────────────────────────┐
       │   LANGUAGE-MODEL OVERLAY (scaffolded)   │
       │                                         │
       │  Unknown-product graceful handling      │
       │  General audiophile knowledge fallback  │
       │  Non-advisory intent decline            │
       │  Free-form clarification                │
       │                                         │
       │  Confidence reconciliation with core    │
       └─────────────────────────────────────────┘
```

The deterministic core is the source of truth on the advisory path. The language-model overlay is intended as a fallback for cases the core cannot handle, not as a replacement.

---

## Advisory flow

**Plain-language framing.** When a user types a question, the system goes through a sequence of steps to decide what kind of question it is, what listening preferences the words imply, what existing equipment the user owns, and what advisory response is appropriate. The flow always runs the same order. The result is a structured response object that the UI then draws on screen.

```
User input
    │
    ▼
Intent classification     ──→  Decide what kind of question this is:
                                shopping, system improvement, diagnosis,
                                comparison, system assessment, general
                                question, refinement of a prior answer.
    │
    ▼
Signal extraction          ──→  Translate the user's words into trait
                                tendencies: flow, clarity, tonal density,
                                dynamics, fatigue risk, glare risk,
                                texture, composure, etc.
    │
    ▼
System context resolution  ──→  Look up which saved system (if any) the
                                user has marked as active. The advisory
                                will be system-relative if a system is
                                active, generic otherwise.
    │
    ▼
Reasoning pipeline         ──→  In order:
                                1. Mirror the user's stated preferences
                                2. Map preferences to engineering principles
                                3. Reason about how the candidate would
                                   interact with the user's existing chain
                                4. Frame 2–3 directional options
                                5. Land a restrained conclusion
    │
    ▼
Advisory response          ──→  A structured object containing the
                                subject, axis positions, named trade-offs,
                                directional recommendations, calibrated
                                confidence, and source citations.
    │
    ▼
Rendering layer            ──→  The UI draws the response: product cards,
                                comparison artifact, trade-off blocks,
                                source attributions.
```

The five-step framing in the reasoning pipeline (preference extraction → architectural mapping → system-level reasoning → directional framing → restrained conclusion) is the canonical model. It is documented in detail in [`/docs/AudioXX_Advisory_Brain.md`](../docs/AudioXX_Advisory_Brain.md).

---

## Product catalog structure

**Plain-language framing.** The catalog is the system's knowledge base of specific products. Think of it as a hand-built reference library — every entry is curated, each one carries calibrated trait positions on the four-axis framework, and each is annotated with source citations. The catalog is small by design; depth and care matter more than breadth.

The catalog exists in two formats today:

- **TypeScript catalog** at `apps/web/src/lib/products/{dacs,amplifiers,speakers,turntables,headphones,legacy-models}.ts`. Used directly by the advisory engine. Each entry carries axis positions on the four-axis trait framework, trait tendencies, descriptions, retailer links, source citations, and (where calibrated) tendency profiles with confidence scoring.
- **Legacy YAML catalog** at `packages/data/components.yaml`. Approximately 127 components in an older qualitative format. Loaded into the database via a seed script.

The two formats are not yet unified. The newer entries live in the TypeScript files; the legacy YAML serves as the database seed and historical reference. Consolidation is a known item in [`/docs/KNOWN_ISSUES.md`](../docs/KNOWN_ISSUES.md).

The four-axis sonic trait framework is documented in detail in [`/docs/audio_xx_sonic_trait_framework_v1.md`](../docs/audio_xx_sonic_trait_framework_v1.md) and is locked at version 1.

---

## Workspace architecture

**Plain-language framing.** When a user opens the application's home page on a desktop browser, they see three columns side-by-side. The left column is workspace navigation. The middle column is the conversation and advisory output — this is where most of the user's attention lives. The right column shows context: their listener profile, their active system, and recent activity.

On smaller screens, the side columns disappear and the middle column expands to fill the screen. This is automatic.

```
┌─────────────┬──────────────────────────┬──────────────┐
│             │                          │              │
│  Left rail  │       Main column        │  Right rail  │
│   ~184px    │   ~820px (constrained)   │    ~296px    │
│             │                          │              │
│  Workspace  │  Hero / conversation /   │  Listener    │
│  navigation │  advisory output         │  System      │
│             │                          │  Recent      │
│             │                          │              │
└─────────────┴──────────────────────────┴──────────────┘
```

Responsive collapse (how the layout adapts to screen size):

- 1200 pixels wide and above: full three-column layout
- 1024 to 1199 pixels: left rail and main column visible; right rail hidden
- Below 1024 pixels: single-column main; both rails hidden

The rails currently mount only on the home page route. Other pages (like the systems list or the listener profile) show the top navigation bar only. This is a deliberate scope decision; expanding the rails to all routes is an open architectural question documented in [`/docs/KNOWN_ISSUES.md`](../docs/KNOWN_ISSUES.md).

The visual style is monochrome editorial — charcoal text on near-white background — with a single restrained brand-red accent (a specific shade close to `#C83A3A`) used sparingly: the wordmark "XX" glyph, top accent rules, and the active-navigation indicator. All other surfaces are charcoal and cool neutral. There are no warm tints, gradients, shadows, or marketing-style chrome.

---

## Deployment structure

**Plain-language framing.** When code is pushed to the GitHub repository, a service called Vercel automatically builds the application and deploys it to a URL. Each branch of the code (a separate line of development) gets its own URL. This is convenient for review — you can give someone a URL that shows your in-progress work without affecting the main version.

```
GitHub repository (m1brown/audio-xx)
        │
        │ (push to any branch)
        ▼
Vercel (auto-detected Next.js)
        │
        ├── main         → reserved for the production tier
        ├── friends      → shared development preview (active branch)
        ├── mike-lab     → private experimentation preview
        └── feature/*    → ad-hoc preview deployments
```

The application's data is stored in a hosted database (Turso, accessed via Prisma + libsql). User authentication is handled by NextAuth with a credentials provider (email and password). Errors that happen in production are reported to Sentry when the appropriate environment variables are populated.

There is no separate "staging" tier. The Vercel previews per branch serve that role. The repository contains no `vercel.json` (a configuration file Vercel sometimes needs); instead, Vercel auto-detects that the project is built with Next.js.

---

## Branch strategy

**Plain-language framing.** Branches are independent lines of development in the same code repository. The project uses three primary branches with distinct roles, plus several historical backups that are not actively used.

| Branch | Role |
|---|---|
| `main` | Stable / production-tier. Reserved for journalist-readiness and external launch. |
| `friends` | Shared collaborator development. The default working branch for any contributor. |
| `mike-lab` | Private strategic experimentation by the project author. Not intended for collaborator review. |
| Legacy branches | Historical / backup. Treat as read-only. |

Day-to-day collaborative work happens on `friends`. Each logical change ships as an isolated commit (a single recorded change to the code). Merging `friends` into `main` is gated on milestone definitions documented in the roadmap.

The full branch hygiene model is in [`/docs/OPERATING_MODEL.md`](../docs/OPERATING_MODEL.md).

---

## QA direction

**Plain-language framing.** Quality assurance is the practice of confirming that changes do not break expected behaviour. Today, most QA happens manually — the project author reviews screenshots, walks through a list of canonical questions, and confirms that the resulting answers look right.

Some automation is in place (the test suite catches obvious bugs), but the more sophisticated checks — verifying that the *advisory reasoning itself* still produces sensible output across a wide range of inputs — are still planned, not yet built.

Quality-assurance practice today is largely manual:

- **Screenshot review** by the project author after UI-touching changes
- **Canonical prompt walks** before friends-shareable pushes
- **Periodic link audits** against the retailer URL catalog
- **TypeScript baseline preservation** (a small number of pre-existing type-check warnings exist; the count must not grow)
- **Vitest suite** runs locally before commits

Automation infrastructure that is partially planned:

- **Behavioural regression harness** — a future test suite designed to drive the canonical questions through the reasoning engine and verify properties of the response (for example: "did the response name a trade-off?", "did the response avoid duplicating the prior turn?"). Specified but not yet built.
- **CI/CD with quality gates** — automated checks (type-check, lint, test, security audit) that run before any code can be merged. On the roadmap but not active.
- **Pre-commit hooks** — automatic checks that run on a developer's machine before a commit can be created. Not configured.
- **End-to-end testing** — an automated test that drives the application like a real user (Playwright is the chosen tool; installed but not yet used).

The QA framework is documented in [`/docs/QA.md`](../docs/QA.md) and operationalised as a checklist in [`/docs/QA_CHECKLIST.md`](../docs/QA_CHECKLIST.md).

---

## What is not in this summary

Deliberately excluded from this overview, and instead found in the deeper documentation:

- Per-module implementation detail (see `/docs/ARCHITECTURE.md`)
- Specific function signatures or code excerpts (read the source)
- Database schema (see `apps/web/prisma/schema.prisma`)
- Detailed routing tables and middleware behaviour
- Per-route SEO and metadata configuration

The intent of this document is orientation. A reader who has internalised the structure above should be able to navigate the deeper documentation and the source itself without further preamble.
