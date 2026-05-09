# Audio XX — Operating Model

**Last updated:** 2026-05-09
**Audience:** anyone working on or with the project. Documents how decisions are made, who owns what, and what the working cadence looks like.

---

## 1. Ownership map

| Domain | Owner | Notes |
|---|---|---|
| Product direction and identity | Project author | The reasoning order, philosophical principles, editorial voice, and the trait framework are owned here. Locked in [`CLAUDE.md`](../CLAUDE.md) and [`audio_xx_sonic_trait_framework_v1.md`](audio_xx_sonic_trait_framework_v1.md). |
| Catalog content | Project author | Component entries, axis positions, trait tendencies, and source citations. Domain expertise required. |
| Tactical implementation | Whoever is currently coding | Surgical fixes, feature implementation, test coverage, refactors that preserve behaviour. |
| Technical stewardship | Designated technical steward (when one is engaged) | Operational health, regression infrastructure, deployment, dependency hygiene. |
| Quality assurance | Shared, with a designated owner per QA cycle | Pre-deployment walks, screenshot review, link audits, behavioural regression testing. |
| Visual / brand identity | Project author | Workspace architecture, palette, typography, accent system. |
| Documentation | Shared | The contributor making a change updates the relevant doc; the project author retains editorial review on philosophy-touching documents. |

The clearest principle: **product identity is centralised; implementation is decentralised**. A new contributor can ship code without explicit approval on every change, but cannot evolve the editorial voice, the reasoning order, or the catalog content unilaterally.

---

## 2. Technical stewardship role

The technical steward, when engaged, is responsible for:

- Day-to-day operational health (deploys succeed, errors are triaged)
- Regression infrastructure (test coverage, CI/CD, behavioural harness)
- Dependency and security hygiene
- Onboarding additional contributors
- Making the project transferable

Specifically *not* in the technical steward's remit:

- Authoring catalog entries
- Modifying the locked trait framework
- Changing the editorial voice or advisory tone
- Adding marketing-style features or surfaces
- Introducing scoring, ranking, or anti-restraint patterns

See [`TECHNICAL_HANDOFF.md`](TECHNICAL_HANDOFF.md) § 9 for the full out-of-scope list.

---

## 3. AI-assisted workflow

The project uses AI assistants as sharp tools for specific tasks. The pattern that has emerged:

| Tool | Used for | Not used for |
|---|---|---|
| Conversational AI (e.g. ChatGPT) | Strategic direction, voice calibration, document shaping, philosophy review, copy review | Direct code edits |
| Coding-capable AI (e.g. Claude) | Surgical implementation, file edits, traces, audits, test scaffolding, isolated commits | Product direction, catalog authorship, autonomous refactoring |
| Both | Generating drafts that are then reviewed and incorporated by the human contributor | Replacing human review of identity-touching changes |

Conventions used when working with a coding-capable AI assistant are documented in [`CLAUDE_WORKFLOW.md`](CLAUDE_WORKFLOW.md). Key constraints:

- The AI does not commit autonomously.
- The AI follows the smallest-safe-fix discipline.
- The AI surfaces scope expansion before acting on it.
- The AI works against an explicit prompt that names acceptance criteria.

The project has historically benefited from this division. Strategic and tactical work proceed in parallel without colliding.

---

## 4. Issue management

### Where issues live

| Type | Location |
|---|---|
| Known engine misalignments | [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) § 1 (canonical) and `MEMORY.md` (cross-reference) |
| Routing / persistence / typecheck gaps | [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) §§ 2–4 |
| Architectural open questions | [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) § 8 |
| Roadmap items | [`ROADMAP.md`](ROADMAP.md) |
| Operational issue log | [`docs/issues-log.md`](issues-log.md) — sparse; primarily a historical record |

There is no GitHub Issues usage at this writing. The project is small enough that documentation-as-issue-tracker is sufficient. *TODO: verify whether GitHub Issues should be activated for external contributor tracking.*

### Triage flow

When a new issue is reported:

1. **Reproduce** with exact inputs.
2. **Categorise** as engine, routing, persistence, polish, architectural, or operational.
3. **Assess severity:** demo-blocker, degrading, cosmetic, or architectural-only.
4. **Decide:** fix now, schedule via the roadmap, or document and defer.
5. **If fix now:** apply via the smallest-safe-fix discipline; commit in isolation; verify regression.
6. **If schedule or defer:** add to [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) with severity and disposition.

---

## 5. QA gates

The project does not have automated QA gates today. The current gates are manual:

| Gate | When | Who |
|---|---|---|
| `npm run typecheck` clean of new errors | Before every commit | Whoever is committing |
| `npm test` passes | Before every commit | Whoever is committing |
| Visual screenshot inspection | After UI-touching changes | Project author |
| Canonical prompt walk | Before friends-shareable push | Designated reviewer |
| Link audit | Quarterly | Designated reviewer |
| Sentry dashboard glance | Weekly | Technical steward |

The full QA checklist is in [`QA_CHECKLIST.md`](QA_CHECKLIST.md). The behavioural regression harness, when built, will move several of these gates from manual to automated.

---

## 6. Release cadence

There is no fixed release cadence. The project follows an **event-driven cadence**:

- Pushes to `friends` happen as work completes (typically multiple per day during active development, or weekly during slow periods).
- Pushes to `main` happen when a milestone is reached or an external party is being given access.
- Vercel auto-deploys on every push to any branch.
- There are no scheduled releases, no tagged versions, and no changelogs.

For a more formal public-launch tier, this would need to evolve. A reasonable target post-launch:

- Tagged releases (semantic versioning).
- A `CHANGELOG.md` updated on every push to `main`.
- Release notes for any user-visible change.
- A documented hot-fix process for production regressions.

None of this exists today. Documenting here so a future technical steward knows it is on the future-state list.

---

## 7. Decision ownership boundaries

For each common decision type, the appropriate owner:

| Decision type | Owner | Escalation |
|---|---|---|
| Add a curated component | Project author | Implementation can be done by anyone, content review by author |
| Add or modify a YAML rule | Project author | Same |
| Fix a bug in routing or advisory output | Implementation contributor | Notify author if behaviour-touching |
| Add a regression test | Implementation contributor | No escalation needed |
| Refactor an engine module | Implementation contributor | Notify author for engine vs. adapter boundary changes |
| Modify the workspace UI | Implementation contributor for small fixes; project author for visual-identity changes | Discuss before substantive changes |
| Modify [`CLAUDE.md`](../CLAUDE.md) | Project author only | Locked spec |
| Modify the trait framework | Project author only | Locked v1 |
| Add a dependency | Implementation contributor with justification | Notify author for non-trivial additions |
| Wire affiliate participation | Project author | Per [`AFFILIATE_POLICY.md`](AFFILIATE_POLICY.md), the integrity test must run before deployment |
| Domain, hosting, secrets | Project author | Operational items |
| Documentation updates | Whoever is making a change | Author retains editorial review on identity-touching docs |

When in doubt, default to "ask the project author." The cost of asking is low; the cost of an unauthorised identity-touching change is high.

---

## 8. Contributing rhythm

For an active contributor:

| Cadence | Activity |
|---|---|
| Per work session | Identify the smallest unit of progress; ship it as an isolated commit. |
| Daily (during active phases) | Push to `friends`. Confirm Vercel preview deploys cleanly. |
| Per change touching the engine | Add a regression test (or document why one is not feasible). |
| Per UI-touching change | Verify on the live preview at desktop and below 1024px. |
| Per catalog change | Verify image overlay key, retailer URLs, axis positions. |
| Weekly | Glance at Sentry. Update [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) if anything has changed. |
| Quarterly | Link audit. Dependency audit. |
| Per milestone | Update [`PROJECT_STATE.md`](PROJECT_STATE.md) and [`ROADMAP.md`](ROADMAP.md). |

This rhythm is informal but has emerged organically over the project's history. Following it keeps the codebase coherent.

---

## 9. Communication patterns

When working synchronously (multi-message exchange):

- Each prompt should name what is in scope and what is out of scope.
- Each response should report what changed, what was deliberately not changed, and any concerns surfaced.
- Reports should mirror the structure of the prompt where possible.

When working asynchronously (commit messages, doc updates):

- Imperative-mood commit messages.
- Brief but descriptive — focus on the *why* as well as the *what*.
- Cross-reference relevant docs in commit bodies when the change is non-trivial.

When making product-direction changes:

- Discuss before implementing.
- Document the rationale in the relevant doc (`CLAUDE.md`, `PROJECT_STATE.md`, etc.).
- Avoid implementation without alignment on direction.

---

## 10. The implicit contract

A new contributor joining the project is implicitly agreeing to:

- Respect the existing identity (system-aware, restraint-first, anti-ranking).
- Respect the existing conventions (smallest-safe-fix, isolated commits, no autonomous identity changes).
- Update documentation as the system evolves.
- Surface uncertainty rather than fabricate.
- Treat the technical work as in service of the product, not the other way around.

The project author, in turn, is implicitly agreeing to:

- Make the documentation good enough that contributors can work without conversational dependency.
- Respect surgical implementation work; do not impose unrelated rework.
- Provide clear scope and acceptance criteria for tasks.
- Review identity-touching changes promptly so contributors are not blocked.

This contract is informal but real. It has shaped how the project has evolved to date and is the operating assumption a new technical collaborator should expect.
