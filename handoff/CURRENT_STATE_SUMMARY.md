# Audio XX — Current State Summary

An honest snapshot of where the project stands. Intended for a reader evaluating maturity, fit, or scope of contribution. Readable by both engineers and non-technical operators.

For deeper material, see [`/docs/PROJECT_STATE.md`](../docs/PROJECT_STATE.md) and [`/docs/KNOWN_ISSUES.md`](../docs/KNOWN_ISSUES.md).

---

## In one paragraph

Audio XX is technically credible and visibly polished, with a deterministic reasoning engine and a curated knowledge base. It is currently suitable for sharing with technically literate friends as a preview. It is not yet ready for a public launch or for sharing with a journalist — the remaining gaps are documented and tractable, not mysterious. Roughly one focused week of work would close the gap to journalist-readiness; eight to ten weeks of part-time work would close the gap to public preview.

---

## Maturity tier

| Tier | Status |
|---|---|
| Prototype | Achieved |
| Internal beta (friends-shareable) | Effectively achieved on the active development branch |
| External beta (suitable for journalist or technical reviewer) | In progress; gated on a small number of resolvable issues |
| Production / public launch | Not yet — requires meaningful operational and engine work |

The friends-shareable preview can be shared with technically literate users today without significant embarrassment. Visible polish, editorial tone, and the deterministic reasoning engine are at production quality. The remaining gaps are behavioural rather than visual — described in the limitations section below.

---

## Strengths

These are areas where the project genuinely differentiates and where the implementation is solid enough to demonstrate without caveats.

**Architectural identity.** The reasoning order — system context, then preferences, then directional options, then optionally illustrative products — is enforced in the code itself, not merely stated as an aspiration. Products genuinely come last in the pipeline.

**Curated knowledge model.** Approximately 127 components in the legacy reference catalog plus a richer hand-tuned catalog with calibrated trait positions and source-attributed citations. The four-axis sonic trait framework is locked at version 1 and used consistently throughout.

**Deterministic, reviewable reasoning.** Every advisory output is generated from explicit code paths over the catalog. No machine-learning model is involved in production reasoning. Anyone reading the source can trace exactly why a given response was produced.

**Workspace user interface.** The three-column workspace layout, monochrome editorial palette, restrained typographic hierarchy, and responsive collapse behaviour read as a real product, not a prototype.

**Restraint discipline.** The principle that "doing nothing is also a valid outcome" is enforced in the rendered response. Recommendations are paired with trade-offs as a structural requirement, not as a stylistic suggestion.

**Documentation layer.** Substantial documentation exists in `/docs/` covering architecture, philosophy, quality-assurance workflow, deployment, and operational model. The behavioural specification (`/CLAUDE.md`) and the trait framework documentation are particularly well-developed.

---

## Weaknesses

Areas a technical reviewer would identify quickly and where current state should not be over-stated.

**No live language-model overlay.** The planned overlay is the highest-leverage piece of unbuilt work. Scaffolding exists; the runtime call is not wired. As a result, unknown products produce empty responses, general knowledge questions outside the catalog produce thin answers, and non-advisory intents (such as practical requests outside the audio domain) can force-route into advisory framing.

**TypeScript baseline carries pre-existing warnings.** Approximately 98 warnings are present today, concentrated in the top-level test runner and the home page. They are catalogued and tracked, but the type-check does not currently pass cleanly. New warnings are not allowed; the existing baseline is a hard floor, but cleanup is deferred.

**No automated behavioural regression coverage.** Engine changes today depend on screenshot review and manual prompt walks. The behavioural regression harness — an automated test suite that would catch reasoning regressions — is specified but not built. Without it, every advisory engine change carries unmeasured risk.

**Conversation messages do not persist across navigation.** The in-progress conversation lives only on the home page. Navigating to a different page and returning resets the conversation. The right rail's "Recent" section appears empty after any navigation. This is a known and documented gap.

**Workspace rails mount only on the home route.** Other routes show only the top navigation. The active-state highlighting on rail items other than "Conversation" is dead code in practice (the rails do not render on those pages, so the highlighting cannot trigger). This was a deliberate scope decision but limits the workspace experience to the conversation surface.

**Two parallel `/systems` flows.** A legacy database-backed flow at `/systems` and a newer local-storage-backed flow at `/systems/saved` coexist. Navigation points to the former; the latter is reachable only via direct URL. This is unresolved technical debt.

**Eight known engine misalignments.** Tracked in the project's memory file. Three of them — follow-up continuity, unknown-product handling, non-advisory intent decline — are demo-blockers per the project's roadmap framing.

**No automated quality gates.** Pre-commit hooks (automatic checks before a commit can be created), continuous integration (automated checks on every push), branch protection rules, and similar safeguards are all unbuilt. Quality gates run on the developer's machine only.

---

## Technical debt

A non-exhaustive inventory:

- Approximately 98 pre-existing TypeScript warnings, concentrated in the test runner and the home page
- A deprecated code path still active in one core module alongside the current path
- Catalog format duality (legacy YAML format and newer TypeScript format not unified)
- Image overlay map normalisation pitfalls — products with diacritic characters (such as `Frérot`) or hyphen-versus-space variations have caused stealth misses historically
- Engine versus domain boundary not yet separated in the code (portable reasoning logic and audio-specific logic coexist in the same directory)
- Confidence semantics not yet locked formally (different consumers of the same data could interpret the same confidence label differently)
- No `CONTRIBUTING.md` or `CHANGELOG.md`

Each of these is tractable. None are mysterious.

---

## Operational maturity

What is in place:

- Vercel auto-deployment per branch via the GitHub integration
- Sentry instrumentation wired (active when the appropriate environment variables are populated)
- Database hosted on Turso with the Prisma + libsql connection
- Branch strategy documented and consistent
- Documentation set sufficient for cold-start onboarding

What is not in place:

- No automated continuous-integration gates
- No formal incident response process
- No tagged releases or release notes
- No automated dependency update process
- No automated link or image audits
- No formal mobile quality-assurance pass
- *TODO: verify Turso backup configuration*
- *TODO: verify Sentry alert routing*
- *TODO: verify domain auto-renewal status*

For a friends-shareable / pre-public-beta environment this is acceptable. For public launch it would need to be formalised.

---

## Beta readiness

For an external beta — sharing with a journalist, a prospective collaborator, or a sophisticated friend — the bar is approximately:

> A reader can type 5–6 varied messages and never hit a wall that makes them question whether the tool works.

Current status against this bar:

- Visible polish: substantial; reads as a real product
- Reasoning quality for in-catalog queries: substantive and trade-off-disciplined
- Conversation continuity: partial; follow-up duplication risk remains
- Unknown product handling: produces empty wall; gap
- Tone and voice: calm, restrained, advisory; no marketing language
- Trade-off framing: consistently present in advisory output

**Net assessment:** the project is approximately one focused work week away from external-beta readiness. The blocking items are the three demo-blocker misalignments plus a manual quality-assurance pass.

---

## Production readiness

For a public-launch tier, additional items beyond beta readiness are required:

| Requirement | Status |
|---|---|
| Conversation continuity (no duplicate replies) | Open |
| Unknown product graceful handling | Open — depends on language-model overlay or transparency message |
| Non-advisory intent decline | Open |
| Behavioural regression test suite | Open |
| Type-check baseline at zero warnings | Open |
| Continuous-integration quality gates | Open |
| Mobile responsive review | Partial |
| Reference attribution surfaced consistently in advisory output | Partial |
| Coverage transparency message | Open |
| Affiliate disclosure copy aligned with code state | Misaligned (see notes below) |
| Database backup policy | *TODO: verify* |
| Sentry alert routing | *TODO: verify* |
| Tagged releases / changelog | Not in place |
| Incident response process | Not in place |

The path to production is documented in [`NEXT_STEPS.md`](NEXT_STEPS.md).

---

## What is stable

These areas can be relied on; changes here would be unusual:

- Four-axis sonic trait framework (locked at version 1)
- Reasoning order and advisory pipeline structure
- Curated catalog content and source citations
- Workspace layout (three-column desktop with responsive collapse)
- Brand identity and visual palette
- Behavioural specification in `/CLAUDE.md`
- Deterministic, no-language-model production reasoning path
- Documentation layer

---

## What is experimental

These areas are in flux or speculative:

- Language-model overlay integration (scaffolded, not wired; integration boundary undecided)
- Engine extraction into a separate workspace package (planned, not started)
- Evidence-lineage primitive (a planned feature for explaining why the system reached a given conclusion — specified but not implemented)
- Confidence semantics formalisation (specified, not locked)
- Behavioural regression test suite (specified, not built)
- Affiliate participation (policy documented, not implemented)
- Cross-system advisory reasoning beyond the active system

---

## What still needs hardening

Items that would warrant attention before significant new investment in the project:

1. **Conversation continuity gap.** The most demo-visible behavioural issue. Triggers on the second message of any conversation under specific conditions.
2. **Unknown product handling.** The most demo-visible coverage gap. Either ship a transparency message (low effort) or ship the language-model overlay (high leverage but more complex).
3. **TypeScript baseline cleanup.** The 98 pre-existing warnings are a constant source of friction during engine work. Burning them down before further engine changes reduces collision risk.
4. **Behavioural regression test suite.** The single highest-leverage piece of unbuilt infrastructure. Without it, engine work carries unmeasured risk.
5. **Affiliate disclosure alignment.** The footer disclosure copy currently claims affiliate participation that the code does not implement. Resolution is a low-effort decision: soften the copy or wire the affiliate participation per the documented policy.

---

## Known risks

**Single-developer dependency.** The project has had one primary contributor to date. Architecture, product direction, and implementation are concentrated. Documentation has been written to support a handoff but no handoff has happened to date.

**Catalog liveness drift.** Retailer URLs across the catalog will rot over time. There is no automated probe in continuous integration. Recent manual audits caught and fixed several broken links, but the underlying decay process continues.

**Image coverage drift.** New catalog entries can be added without image overlay map entries, silently dropping coverage. Coverage as of last audit: approximately 94 percent.

**Affiliate disclosure misalignment.** Documented above. Forward-looking disclosure copy is acceptable in many contexts but invites criticism if found to be aspirational rather than descriptive.

**Operational verification gaps.** Several `TODO: verify` items depend on dashboard inspection (Vercel, Sentry, Turso, domain registrar). These are typically quick checks but have not been completed and recorded.

---

## Summary for a non-technical reader

Audio XX is a real, working product. Anyone using the friends-shareable preview today would have a substantive experience. The reasoning is sound, the visible product looks finished, and the documentation is good enough to onboard a new contributor.

It is not yet ready for a public launch. The blocking items are well-understood, are written down honestly above, and are not particularly mysterious. Most of the remaining work is operational hardening and a small number of behavioural fixes — not new features and not architectural rebuilds.

A new technical collaborator joining today would inherit a sound foundation, a clear documentation set, and a focused list of items to address. None of the items would surprise them.
