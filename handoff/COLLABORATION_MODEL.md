# Audio XX — Collaboration Model

A description of how the project currently operates and how a technical collaborator can expect to work within it. The model is informal but consistent. Readable by both engineers and non-technical operators.

For deeper detail, see [`/docs/OPERATING_MODEL.md`](../docs/OPERATING_MODEL.md).

---

## Current operating posture

The project is small. It has been developed by a single primary contributor with curated input from advisors and tools. The collaboration model documented here is the structure that has emerged organically, not a formal framework.

The model is intended to scale gracefully to a small number of contributors — two, possibly three — without requiring heavyweight process. Beyond that, additional structure would be appropriate.

---

## Roles

### Product and advisory direction

The product author owns the parts of the project that define what it *is* — the editorial voice, the philosophy, the curated knowledge. Specifically:

- The reasoning order and advisory pipeline structure
- Editorial voice and tone
- The four-axis sonic trait framework
- Catalog content and curation decisions
- Visual identity and design language
- The behavioural specification in `/CLAUDE.md`
- The product philosophy documented in `/docs/PRODUCT_PHILOSOPHY.md`

These domains are centralised. Changes here go through review by the product author, not implemented unilaterally.

### Technical stewardship

A technical steward (when one is engaged) owns the parts of the project that keep it *working* — the operational health, the test coverage, the deployment story. Specifically:

- Day-to-day operational health (deploys succeed, errors are triaged)
- Regression infrastructure (test coverage, automated quality gates, behavioural test suite)
- Implementation of agreed scope
- Onboarding and documentation for additional contributors
- The portability of the codebase

Specifically not in the technical steward's remit:

- Authoring catalog entries
- Modifying the locked trait framework
- Changing the editorial voice or advisory tone
- Adding marketing-style features or surfaces
- Introducing scoring, ranking, or anti-restraint patterns

The boundary is intentional: product identity is centralised, implementation is decentralised. A new contributor can ship code without explicit approval on every change but cannot evolve the editorial voice or the catalog content unilaterally.

### Quality assurance

Quality assurance is shared. The project author retains visual review and prompt-walk responsibility on identity-touching changes. A technical steward retains regression-infrastructure responsibility. Routine quality-assurance gates (type-check preservation, test suite passing) are owned by whichever contributor is making a change.

---

## AI-assisted workflow

The project has consistently used AI assistants as sharp tools for specific tasks rather than as autonomous agents. The pattern that has emerged:

| Tool category | Used for | Not used for |
|---|---|---|
| Conversational AI | Strategic direction, voice calibration, document shaping, philosophy review, copy review | Direct code edits |
| Coding-capable AI | Surgical implementation, file edits, traces, audits, test scaffolding, isolated commits under explicit instruction | Product direction, catalog authorship, autonomous refactoring, identity-touching changes |

Conventions used when working with a coding-capable AI assistant:

- The assistant does not commit to the repository on its own initiative
- The assistant follows the smallest-safe-fix discipline (modify only the responsible file or function; do not expand scope; do not refactor unrelated logic)
- The assistant surfaces scope expansion before acting on it
- The assistant works against an explicit prompt that names acceptance criteria
- The assistant produces structured reports for human review

A new technical collaborator joining the project may use AI-assisted tooling at their own discretion within these conventions, or not at all. The conventions are documented in detail in `/docs/CLAUDE_WORKFLOW.md` (so named because of the specific assistant the project has been using; the conventions are tool-agnostic and apply equally to other coding-capable assistants).

---

## Issue management

Where issues live:

| Type | Location |
|---|---|
| Known engine misalignments | [`/docs/KNOWN_ISSUES.md`](../docs/KNOWN_ISSUES.md) (canonical list) |
| Routing and persistence gaps | Same |
| Architectural open questions | Same |
| Roadmap items | [`/docs/ROADMAP.md`](../docs/ROADMAP.md) |
| Operational issue log | `/docs/issues-log.md` (sparse, primarily historical) |

The project does not currently use GitHub Issues. Documentation-as-issue-tracker is sufficient at the current scale. *TODO: verify whether activating GitHub Issues is desirable for external contributor tracking.*

When a new issue surfaces, the convention is:

1. Reproduce with exact inputs
2. Categorise (engine, routing, persistence, polish, architectural, operational)
3. Assess severity (demo-blocker, degrading, cosmetic, architectural-only)
4. Decide: fix now, schedule via the roadmap, or document and defer
5. Record disposition in `KNOWN_ISSUES.md`

---

## Branch philosophy

A branch is an independent line of development in the same code repository. The project uses three primary branches with distinct roles, plus several historical backups that are not actively used.

| Branch | Role |
|---|---|
| `main` | Stable / production-tier. Reserved for journalist-readiness and external launch. |
| `friends` | Shared collaborator development. The default working branch. |
| `mike-lab` | Private experimentation by the project author. Not intended for collaborator review. |
| Legacy branches | Historical / backup. Treat as read-only. |

Day-to-day collaborative work happens on `friends`. Each logical change ships as an isolated commit (a single recorded change to the code). Compound commits — bundling multiple unrelated changes into one — are avoided because they make it harder to identify which change introduced a regression weeks later.

The promotion path: experimental work in `mike-lab` may inform changes that are reimplemented cleanly in `friends`; `friends` is reviewed and merged into `main` when milestones complete. Force-push (overwriting the shared history of a branch) is not permitted on `friends` or `main`.

---

## Commit discipline

Observed conventions:

- One logical change per commit
- Imperative-mood commit messages, brief but descriptive
- No batching of unrelated changes
- No automatic commits by tooling — every commit is the result of an explicit instruction
- No `--amend` (modifying the previous commit) after a pre-commit hook fails — instead, fix the issue and create a new commit
- No `--no-verify` to skip hooks
- No force-push to shared branches

A representative recent set of commit messages:

```
Add technical handoff documentation layer
Add operational documentation layer
Upgrade Hornshoppe manufacturer URL to HTTPS
Update Line Magnetic manufacturer URL
Fix broken Gustard product links
Restore subtle Audio XX accent color
```

Each commit covers one logical scope. Each message is imperative and focused. A reader scanning the commit history can build a mental model of what changed, when, and why, without needing to inspect the underlying code.

---

## QA expectations

Pre-commit (developer's machine):

- The project's type-check (`npm run typecheck`) reports the existing baseline (~98 pre-existing warnings) without new additions
- The project's test suite (`npm test`) passes
- For UI-touching changes, visual review on a local development server

Pre-push to shared branches:

- For changes touching the advisory engine or routing: a manual walk through the relevant canonical questions
- For changes touching catalog data: confirmation that retailer URLs return successful responses and that image overlays still resolve

Pre-external-share:

- The full quality-assurance checklist in [`/docs/QA_CHECKLIST.md`](../docs/QA_CHECKLIST.md)
- Confirmation of operational dashboards (Vercel preview state, Sentry receiving)

The project does not have automated continuous-integration gates today. Quality gates run on the developer's machine. Building automated CI is on the near-term roadmap.

---

## Release philosophy

Releases are event-driven. The project does not follow a fixed cadence. Specifically:

- Pushes to `friends` happen as work completes (multiple per day during active phases, weekly during slow periods)
- Pushes to `main` happen when a milestone is reached or external sharing requires it
- Vercel auto-deploys on every push to any branch
- There are no tagged versions, no semantic versioning, no formal changelog

For a public-launch tier, this would need to evolve. The expected post-launch model:

- Tagged releases following semantic versioning (a convention where each release gets a version number such as 1.4.2, where the three numbers indicate breaking, feature, and fix changes respectively)
- A `CHANGELOG.md` updated on every push to `main`
- Release notes for any user-visible change
- A documented hot-fix process for production regressions

None of this exists today. By design, the project has not launched publicly.

---

## Communication expectations

When working synchronously (multi-message exchange or paired work):

- Each prompt or task should name what is in scope and what is out of scope
- Each response should report what changed, what was deliberately not changed, and any concerns surfaced
- Reports mirror the structure of the request where possible

When working asynchronously (commit messages, documentation updates):

- Imperative-mood commit messages, brief but descriptive
- Documentation updated in the same commit as the change it describes when feasible
- Cross-references to relevant docs in commit bodies for non-trivial changes

When making product-direction changes:

- Discuss before implementing
- Document the rationale in the relevant document (`CLAUDE.md`, `PROJECT_STATE.md`, etc.)
- Avoid implementation without alignment on direction

---

## Decision-making boundaries

For each common decision type, the appropriate owner:

| Decision type | Owner |
|---|---|
| Add a curated component | Product author for content; any contributor may implement once content is decided |
| Add or modify a deterministic rule | Product author |
| Fix a bug in routing or advisory output | Whoever is making the change; notify the product author if behaviour-touching |
| Add a regression test | Any contributor; no escalation needed |
| Refactor an engine module | Any contributor; notify the product author for engine-versus-adapter boundary changes |
| Modify the workspace UI | Small fixes: any contributor. Visual identity changes: product author. |
| Modify `/CLAUDE.md` or trait framework | Product author only |
| Add a software dependency | Any contributor with justification; notify the product author for non-trivial additions |
| Wire affiliate participation | Product author, with the integrity test mandated by `/docs/AFFILIATE_POLICY.md` running before deployment |
| Domain, hosting, secrets | Product author |
| Documentation updates | Whoever is making a change, with editorial review by the product author on identity-touching documents |

When in doubt, the cost of asking is low and the cost of an unauthorised identity-touching change is high. Default to asking.

---

## Implicit contract

A technical collaborator joining the project is implicitly agreeing to:

- Respect the existing identity (system-aware, restraint-first, anti-ranking)
- Respect the existing conventions (smallest-safe-fix, isolated commits, no autonomous identity changes)
- Update documentation as the system evolves
- Surface uncertainty rather than fabricate
- Treat the technical work as in service of the product, not the other way around

The product author, in turn, is implicitly agreeing to:

- Maintain documentation good enough that contributors can work without conversational dependency
- Respect surgical implementation work; do not impose unrelated rework
- Provide clear scope and acceptance criteria for tasks
- Review identity-touching changes promptly so contributors are not blocked

This contract is informal but real. It has shaped how the project has evolved and is the operating assumption a new contributor should expect.
