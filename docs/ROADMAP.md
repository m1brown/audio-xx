# Audio XX — Practical Roadmap

**Last updated:** 2026-05-09
**Audience:** technical contributors deciding what to work on next, and prospective collaborators evaluating the planned trajectory.

This document is the practical near-term roadmap. It complements two other planning documents:

- [`ROADMAP-SPEAKS-FOR-ITSELF.md`](../ROADMAP-SPEAKS-FOR-ITSELF.md) at the repo root — the milestone framing oriented around journalist-readiness
- [`docs/implementation-plan.md`](implementation-plan.md) — the sprint-shaped task list with explicit dependencies

The current document is the consolidated, time-bounded view that synthesises both.

---

## 1. Roadmap structure

The work is organised into five tiers, ordered by dependency:

1. **Beta hardening** — bring the `friends` branch to external-beta quality
2. **QA automation** — make regressions detectable without manual screenshot walks
3. **Operational tooling** — basic CI/CD, dependency hygiene, monitoring discipline
4. **Onboarding improvements** — make handoff smoother for the next contributor
5. **Affiliate architecture and public-preview readiness** — the path to public launch
6. **Longer-term opportunities** — engine extraction, second-domain consumer, etc.

Each tier should largely complete before the next. Working out of order is possible but introduces avoidable rework.

---

## 2. Tier 1 — Beta hardening (next priority)

**Goal:** the `friends` branch can be shared with technically literate external users (journalists, prospective collaborators) without hitting demo-killer bugs.

### Items

| Item | Effort | Notes |
|---|---|---|
| Fix follow-up continuity (QA C1, `MEMORY.md` #4) | 1–2 days | Engine: detect context-enriching statements vs new queries; update system state mid-conversation. |
| Handle unknown products gracefully (QA C4, `MEMORY.md` #5) | 1–3 days | At minimum: acknowledge by name, state calibrated data unavailable, offer public-knowledge framing. Full LLM overlay handles fully; a transparency message handles partially. |
| Decline non-advisory intents (QA C3, `MEMORY.md` #6) | ~1 day | Intent classifier needs a "not-advisory" category that handles gracefully or declines clearly. |
| General-knowledge fallback (roadmap C2) | Depends on LLM overlay | Common audiophile questions outside the catalog. Without LLM, surface a transparency message. |
| Affiliate disclosure copy alignment | <1 hour | See [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) § 6 — soften disclosure to forward-looking until affiliate is wired. |
| Walk all 8 canonical prompts manually | ~2 hours | Confirm none hit dead ends. |

### Acceptance

A 5-message conversation walks cleanly. No duplicate replies on follow-ups. No empty walls on unknown products. No force-routed shopping responses on non-shopping queries. The four canonical prompts in [`QA_CHECKLIST.md`](QA_CHECKLIST.md) § Canonical prompts all pass.

**Estimated total effort:** ~1 working week.

---

## 3. Tier 2 — QA automation

**Goal:** changes to the engine no longer carry unmeasured regression risk. Catching a regression should not require a manual screenshot walk.

### Items

| Item | Effort | Notes |
|---|---|---|
| Behavioural regression harness (Workstream A8) | 3–5 days | New file `apps/web/src/lib/__tests__/behavioral-regression.test.ts`. Drive canonical prompts through the orchestrator; assert behavioural properties (routing, confidence, trade-off presence, continuity, restraint). |
| Confidence semantics lock-in (Workstream A7) | 1–2 days | Define `'high' \| 'medium' \| 'low' \| 'insufficient'` formally; pin with tests in `apps/web/src/lib/__tests__/confidence-semantics.test.ts`. |
| Add at least one Playwright happy-path test | <1 day | Sign-in → query → response renders. Catches a class of integration regressions unit tests miss. |
| Screenshot-comparison testing | 2–3 days | *TODO: verify desirability.* Tools like Playwright's screenshot assertion or a Percy-equivalent. Adds a class of visual-regression coverage. |
| Catalog liveness probe (link audit) | 1 day | Scheduled or on-demand `curl -I` sweep across retailer URLs; flag anything non-2xx. |

### Acceptance

CI runs the full Vitest suite and the behavioural harness on every push. The harness has at least one assertion per known misalignment in [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) § 1. A regression in any of the 8 misalignments turns at least one assertion red.

**Estimated total effort:** ~2 working weeks.

---

## 4. Tier 3 — Operational tooling

**Goal:** developer workflow and operational hygiene are formalised. Quality gates are no longer machine-of-developer-dependent.

### Items

| Item | Effort | Notes |
|---|---|---|
| GitHub Actions CI (Workstream A4) | 1–2 days | Workflow with `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm audit --audit-level=high`. Branch protection blocks merge on red. |
| Pre-commit hooks (Workstream A5) | <1 day | Husky + lint-staged: prettier + eslint --fix on staged files; `tsc --noEmit` on push. |
| TypeScript baseline cleanup (Workstream A1) | 3–5 days | Fix or `@ts-expect-error` (with justification) every error. One PR per module. |
| Strip debug logs (full pass, Workstream A2) | 1–2 days | ESLint rule banning `console.log` outside `*.test.ts`; create `lib/debug.ts` helper. |
| Sentry alert routing | <1 hour | *TODO: verify current alert configuration.* |
| Dependency update cadence | <1 hour | Decide on Dependabot or manual quarterly updates; document the decision. |
| Database backup verification | <1 hour | *TODO: verify Turso backup configuration is documented and tested.* |

### Acceptance

Every push to a protected branch runs CI. Every commit is automatically formatted and linted. The TypeScript baseline reaches 0 errors. Sentry alerts route to a human on a sensible cadence.

**Estimated total effort:** ~2 working weeks.

---

## 5. Tier 4 — Onboarding improvements

**Goal:** a new technical contributor can ramp up in <1 day.

### Items

| Item | Effort | Notes |
|---|---|---|
| Documentation layer (this directory) | Mostly done | Continue refining; add cross-references as gaps emerge. |
| Annotated code tour | 1 day | Walk through `apps/web/src/lib/` orienting a new contributor to the engine. Could be a `docs/CODE_TOUR.md` or a recorded screencast. |
| Worked-example debugging walkthrough | 1 day | Pick a real recent bug-fix (e.g. the active-system tuning fix); walk through diagnose → fix → test → commit. Makes the conventions tangible. |
| Public-facing project README polish | <1 day | The current README is good for technical readers; an `ABOUT.md` or expanded README would help non-technical readers. |
| `CONTRIBUTING.md` | <1 day | Pull-request workflow, code-style expectations, branch protocol. *Currently absent.* |

### Acceptance

A reviewer who has not seen the project before can run it locally, find the relevant engine module for a hypothetical bug, and propose a fix plan within a few hours.

**Estimated total effort:** ~1 working week (in parallel with other tiers).

---

## 6. Tier 5 — Affiliate architecture and public-preview readiness

**Goal:** the system is ready to be shared publicly, with disclosed affiliate participation that does not bias recommendations.

### Items

| Item | Effort | Notes |
|---|---|---|
| Affiliate-tag wiring | 2–3 days | See [`AFFILIATE_POLICY.md`](AFFILIATE_POLICY.md) for the policy framework. Per-retailer tag injection; manual approval per partner. |
| Ranking-integrity audit | 2 days | Confirm via test that recommendation order is unchanged whether or not affiliate tags are present. This is the core trust check. |
| Public preview gating decision | <1 day | Vercel preview branch protection, password gating, or open. *TODO: verify current configuration.* |
| Reference attribution UI | 2–3 days | Catalog data carries `trusted_references` and source citations. Surfacing these in advisory output (per Roadmap M5) is partially done; consistency pass needed. |
| Coverage transparency message | <1 day | Somewhere accessible: "Audio XX currently covers ~127 components. If your gear isn't in our database, we'll tell you what we can." Honesty is a credibility signal. |
| Curated example conversations | 1–2 days | 2–3 exchanges that show the tool at its best. A reviewer can read these without typing. |
| HTTPS, custom domain, SSL | Verify | *TODO: verify domain and SSL configuration are stable.* |
| Mobile responsive QA pass | 1–2 days | Walk all canonical paths on a phone. |

### Acceptance

A cold visitor can land at `audio-xx.com`, have a 5-message conversation, and walk away thinking *"this understood me better than any forum or review site."* No prototype tells. Reference attribution and coverage transparency are visible.

**Estimated total effort:** ~2 working weeks.

---

## 7. Longer-term opportunities

These are post-public-preview. Listed for orientation; not yet scheduled.

### LLM overlay (full)

Wire the planned LLM overlay (`apps/web/src/app/api/memo-overlay/`) into the production reasoning path. Scope:

- Unknown-product handling (graceful acknowledgement + public-information framing)
- General-knowledge questions (audiophile education outside the catalog)
- Non-advisory intent decline (more nuanced than a flat refusal)
- Free-form clarifications and educational content

The deterministic core remains the source of truth on the advisory path; the LLM is a fallback overlay for cases the core cannot handle. The boundary between core and overlay needs to be drawn explicitly — see [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) § 8.

**Estimated effort:** 1–2 weeks once the integration boundary is decided.

### Engine extraction (Workstream B)

Lift the portable reasoning core into `packages/decision-engine/`. Sequence:

1. **B1** — Engine module audit (1 day, low risk, can run now)
2. **B2** — Workspace package skeleton (<1 day, low risk, can run now)
3. **B0** — Evidence lineage primitive (3–5 days, prerequisite for B3)
4. **B3** — Module relocation in tranches (1–2 weeks total, gated on A6 + A7 + B0)
5. **B4** — Engine README (after B3 completes and a second consumer exists)

The intended payoff is reusability across decision-quality domains (the "Climate Screen" effort referenced in [`docs/strategic-briefing.md`](strategic-briefing.md)).

### Catalog expansion

The current catalog (~127 YAML + the TypeScript catalog under `apps/web/src/lib/products/`) is hand-curated. Extending coverage to additional brands and product tiers is an ongoing effort that scales linearly with curator time. No automation is planned — the curated nature is the credibility surface.

### Multi-system advisory

Today a user can save multiple systems. Comparing across systems ("how would my desk system change if I added a tube preamp from the living-room system?") is partially supported but not consistently surfaced. A focused pass could expand cross-system reasoning.

### Internationalisation

Currently English-only. Trait labels, advisory copy, glossary entries all assume English. *Not currently scheduled.*

### Voice / mobile-first interactions

Currently text-input-only on a workspace optimised for desktop. Voice input or a mobile-first re-architecture is a different product surface entirely. *Not currently scheduled.*

---

## 8. Sequencing summary

```
Tier 1 (Beta hardening)  ──────────┐
                                   │
Tier 2 (QA automation)  ───────────┤  These three can run partly in parallel
                                   │  but Tier 1 priority dominates
Tier 3 (Operational)  ─────────────┘

      ↓  (after Tier 1–3 complete)

Tier 4 (Onboarding)  — runs in parallel with everything

      ↓  (after Tier 1–3)

Tier 5 (Public-preview)  ──────────┐
                                   ↓
Longer-term (LLM, engine, etc.)
```

**Realistic public-launch window:** if the project commits to ~10–15 hours/week, Tier 1–3 takes roughly 5–6 weeks, Tier 5 adds another 2 weeks. Add buffer. A cautious estimate is **~8–10 weeks from now to a public-preview launch** if priorities hold.

**Demo-readiness window** (Tier 1 only): roughly **1 working week of focused effort**.

---

## 9. Decision points worth flagging

These are decisions the project will need to make as it progresses; documenting them so the roadmap stays honest about open questions:

- **LLM overlay vs. transparency message for unknown products.** The full LLM overlay is more capable; the transparency message is faster to ship and adds no operational complexity. The trade-off is between "broader coverage" and "deterministic-only" identity.
- **Workspace rails on all routes vs. homepage-only.** See [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) § 8.
- **Engine extraction timing.** Earlier extraction protects the boundary; later extraction reduces churn during M1 fixes.
- **Affiliate participation.** The policy is documented; the wiring decision is open. Public launch is more credible without affiliate; financial sustainability may require it.
- **Public-preview gating.** Open URL vs. invite-only vs. password-gated. Gating limits feedback volume; openness invites unmoderated criticism.

These are not blocking decisions — work can continue while they remain open — but they will shape the trajectory once made.
