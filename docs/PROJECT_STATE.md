# Audio XX — Project State

**Last updated:** 2026-05-09
**Audience:** prospective technical collaborators, engineering leads, or stewards evaluating where the project is and what it would take to bring it to a production tier.

This document is a candid current-state assessment. It is not a marketing document. It documents both what is working and what is not.

---

## 1. Current maturity

| Tier | Status |
|---|---|
| Prototype | ✅ Achieved many months ago |
| Internal beta (friends-shareable) | ✅ Effectively achieved on the `friends` branch |
| External beta (journalist-ready) | ⚠️ In progress; gated on M1 conversation-breaker fixes |
| Production / public launch | ❌ Not yet — significant operational and engine work remaining |

The `friends` branch can be shared with technically literate users today without significant embarrassment. The visible polish, the editorial tone, the workspace architecture, and the deterministic engine are all production-quality. The *behavioural* gaps — described in §5 below — are the primary blockers to broader release.

---

## 2. Strengths

These are areas where the project genuinely differentiates from other audio recommendation tools, and where the implementation is solid enough to demonstrate to a prospective collaborator without caveats.

**Architectural identity.** The reasoning order (system context → trait inference → system balance → anchor comparison → upgrade direction → product suggestions) is enforced in code, not just stated in a spec. Products genuinely come last. This is rare in the recommendation-engine space.

**Curated knowledge model.** ~127 components in the legacy YAML catalog plus a richer TypeScript catalog (`apps/web/src/lib/products/dacs.ts`, `amplifiers.ts`, `speakers.ts`, etc.) with hand-tuned axis positions, trait tendencies, and source-attributed citations. The 4-axis sonic trait framework (`docs/audio_xx_sonic_trait_framework_v1.md`) is locked at v1 and used consistently throughout.

**Deterministic, reviewable reasoning.** Every advisory output is generated from rule evaluation and TypeScript-coded reasoning paths. There are no hidden ML models, no black-box embeddings, no opaque "AI" calls in the production path. The output of the system is fully auditable.

**Workspace UI.** The 3-column workspace architecture (LeftRail / main / RightRail) on `/`, the monochrome editorial palette with a single restrained brand-red accent, the typographic hierarchy, and the responsive collapse behaviour all read as a real product. Recent passes have removed the prototype tells.

**Operational documentation.** As of this writing, the documentation layer (this directory) is being filled out for handoff-readiness. The locked behavioural specification (`CLAUDE.md`) and the trait framework (`audio_xx_sonic_trait_framework_v1.md`) are particularly well-developed.

**Restraint discipline.** The "do nothing is a valid outcome" principle is enforced in advisory rendering. This is the philosophical differentiator and it shows up in actual output.

---

## 3. Weaknesses

These are areas a technical reviewer would identify quickly and where current state should not be over-sold.

**No live LLM overlay.** The product roadmap identifies the LLM overlay as the highest-leverage piece of work (~60% of critical issues addressed). Scaffolding exists; the runtime call does not. Unknown products produce empty responses, general knowledge questions outside the catalog produce thin answers, and non-advisory intents can force-route into advisory framing.

**TypeScript baseline carries 98 pre-existing errors.** Most live in `qa-tests.ts` (top-level — needs `allowImportingTsExtensions` or import fixes) and `apps/web/src/app/page.tsx` (multiple shape mismatches). They are tracked but deferred (Workstream A1 in `implementation-plan.md`). The build passes; the typecheck does not. *TODO: verify — confirm Vercel build configuration tolerates these.*

**No automated regression harness for advisory behaviour.** Every advisory fix today depends on screenshot QA and manual prompt walks. The behavioural-regression harness (Workstream A8) is specified but not built. This means changes to the engine carry an unmeasured regression risk.

**Conversation messages are not persisted across navigation.** The `messages` array lives in `useReducer` state on the home page. Navigating to `/systems` or `/profile` and returning resets the conversation. The right-rail "Recent" section appears empty after any navigation away from `/`. This is a known gap.

**Workspace rails mount only on `/`.** The 3-column architecture is homepage-scoped. Other routes (`/systems`, `/profile`, etc.) render the top nav only. Active-state highlighting on left-rail items other than "Conversation" is dead code today (the rail isn't rendered on those pages). This is a deliberate scope decision, not an oversight, but it limits the workspace experience to the conversation surface.

**Two parallel `/systems` flows.** `/systems` (Prisma-backed, auth-required) and `/systems/saved` (local SavedSystemsPanel-backed) coexist. Nav points to the former; the latter is reachable only via direct URL. This is unresolved technical debt.

**Eight known advisory misalignments.** Tracked in `MEMORY.md`. Three of them (follow-up continuity, unknown products, non-advisory force-routing) are demo-blockers per the project roadmap. None have been fully resolved.

**No CI/CD pipeline.** Pre-commit hooks, GitHub Actions, branch protection, and automated typecheck/test/lint gates are all deferred (Workstream A4/A5). Quality gates run on the developer's machine only.

---

## 4. Technical debt

A non-exhaustive inventory:

- **TypeScript errors (98 pre-existing).** See `docs/implementation-plan.md` Workstream A1 for the per-file breakdown.
- **Untyped advisory output shape variance.** `apps/web/src/app/page.tsx` has multiple shape-mismatch errors around `SubjectMatch.brand`, `SET_SYSTEM_CONTEXT`, `fired_rules`, etc. The advisory output schema is not fully consolidated.
- **`StructuredMemoInputs` deprecated path still active in `consultation.ts`.** Dual code paths exist; one should be removed.
- **`qa-tests.ts` at the top level uses `.ts` import paths without `allowImportingTsExtensions`.** Five errors from this file alone.
- **No engine vs. domain separation in code yet.** The plan (Workstream B) is to lift the portable reasoning core into a `@audioxx/decision-engine` package. This has not begun. The portable modules (`tradeoff-assessment.ts`, `preference-protection.ts`, `inference-layer.ts`, `decision-frame.ts`, `engine.ts`, `counterfactual-assessment.ts`) currently live alongside audio-specific modules in `apps/web/src/lib/`.
- **Confidence semantics not locked.** The plan (Workstream A7) is to formalise `'high' | 'medium' | 'low' | 'insufficient'` semantics with per-level output rules and tests. This precedes the engine extraction.
- **Catalog format duality.** Legacy YAML (`packages/data/components.yaml`, ~127 entries with qualitative trait values) coexists with the newer TypeScript catalog (axis-positioned, more granular). The two are not unified.
- **Image overlay map normalisation pitfalls.** Diacritic stripping and hyphen/space variations have caused stealth misses historically. New entries require both normalised and non-normalised forms to be verified.

---

## 5. Production readiness gaps

For a public-launch tier, the following must be in place. Treat this as the gap inventory between "friends-shareable" and "production":

| Concern | Status |
|---|---|
| Conversation continuity (no duplicate replies on follow-ups) | ❌ Open — see `MEMORY.md` #4 |
| Unknown product graceful handling | ❌ Open — needs LLM overlay |
| Non-advisory intent decline | ❌ Open — `MEMORY.md` #6 |
| General-knowledge fallback | ❌ Open — needs LLM overlay |
| Behavioural regression harness | ❌ Open — Workstream A8 |
| TypeScript baseline = 0 errors | ❌ Open — Workstream A1 |
| CI/CD with quality gates | ❌ Open — Workstream A4/A5 |
| Pre-commit hooks | ❌ Open — Workstream A5 |
| Mobile responsive behaviour verified | ⚠️ Partial — rails hidden below 1024px; full mobile QA not formalised |
| Reference attribution surfaced in UI | ⚠️ Partial — data exists, not consistently rendered |
| Coverage transparency message | ❌ Open — Roadmap M5 |
| Affiliate disclosure copy alignment | ⚠️ Misaligned — current footer claims affiliate participation; no affiliate tags are wired today |
| Database backup policy | ⚠️ Unverified — *TODO: verify Turso backup configuration* |
| Sentry alert routing | ⚠️ Unverified — *TODO: verify alert destinations* |
| Domain auto-renewal | ⚠️ Unverified — *TODO: verify* |

---

## 6. Beta readiness

For an external beta (e.g. sharing with a journalist or prospective collaborator), the bar is lower. The roadmap's M1 milestone defines this tier:

> A journalist can type 5–6 varied messages and never hit a wall that makes them question whether the tool works.

Status against this bar:

- ✅ Visible polish — recent UI passes raised this above prototype tier
- ✅ Reasoning quality — the deterministic engine produces substantive responses for in-catalog queries
- ⚠️ Conversation continuity — partial; follow-up duplication risk remains
- ⚠️ Unknown products — produces blank wall today
- ✅ Tone and voice — calm, restrained, advisory; no marketing language
- ✅ Trade-off framing — consistently present in advisory output

**Net assessment:** the project is approximately one focused sprint away from external-beta-ready. The blocking items are M1 conversation breakers (follow-up continuity, unknown products, non-advisory intents) plus a short manual QA pass.

---

## 7. Operational risks

**Single-developer dependency.** The project today has one primary contributor. Architecture, product direction, and implementation are concentrated. A handoff to a second technical collaborator is possible (this documentation is intended to enable it) but no such handoff has happened to date.

**No automated tests of the deployed behaviour.** The Vitest suite covers unit-level concerns. The behavioural regression harness is unbuilt. End-to-end testing relies on manual walks of canonical prompts.

**Catalog liveness.** ~189 retailer URLs across the catalog will rot over time. There is no automated probe in CI. A recent link-QA pass (2026-05-09) caught and fixed broken links for Gustard X16 / R26 / X26 Pro, Line Magnetic, Hornshoppe, and Chord Qutest's Amazon entry — but the underlying decay process continues.

**Image overlay drift.** New catalog entries can be added without overlay map entries, silently dropping image coverage. Coverage as of last documented push: ~94%.

**Affiliate disclosure misalignment.** The footer claims "Audio XX may earn commissions from qualifying purchases as an Amazon Associate." No affiliate tags are wired in retailer URLs today. The disclosure is forward-looking rather than descriptive of current state. See [`AFFILIATE_POLICY.md`](AFFILIATE_POLICY.md).

**Auth secret rotation.** `NEXTAUTH_SECRET` rotation policy is undocumented. Rotation invalidates all sessions.

**Dependency drift.** Without automated dependency updates (Dependabot or equivalent), security advisories may go unaddressed for periods.

---

## 8. Architectural risks

**Engine vs. domain boundary not yet separated in code.** The portable reasoning modules and the audio-specific modules coexist in `apps/web/src/lib/`. The intended separation (Workstream B in `implementation-plan.md`) is well-specified but not yet executed. The risk: if the boundary is not maintained mentally, the portable modules accumulate audio-specific dependencies and become harder to extract later.

**Advisory output schema drift.** The `MemoFindings` and `ConsultationResponse` shapes have evolved over time. Multiple deprecated paths exist (`StructuredMemoInputs` for example). This makes typecheck cleanup non-trivial and complicates the engine extraction.

**Deterministic-only constraint.** The system has been intentionally LLM-free in the production path. This is a strength (auditability) but also a weakness (cannot gracefully handle out-of-catalog queries). The planned LLM overlay is meant to address this without compromising determinism on the core advisory path. Until shipped, the constraint imposes coverage gaps.

**State management split.** Conversation state in `useReducer` (in-page-only) vs. system state in `AudioSessionContext` (persistent) creates inconsistent persistence semantics. The right rail's "Recent" section appears empty after navigation because of this split.

---

## 9. Areas requiring caution

When evolving the system, treat these areas with elevated care:

1. **`apps/web/src/lib/intent.ts`** — the intent classifier is the routing layer. Changes here can silently re-route entire categories of queries. Always include regression tests.
2. **`apps/web/src/lib/consultation.ts`** — central advisory orchestration. Several known issues are concentrated here (item #7 in `MEMORY.md` deprecated path, complaint extraction regex). Bug-fix scope tends to expand here; respect the smallest-safe-fix discipline.
3. **`apps/web/src/lib/products/*.ts`** — catalog data. Brand normalisation, axis positioning, and image overlay keying have all caused stealth bugs. Add catalog entries through the existing patterns; do not invent shapes.
4. **`apps/web/src/components/advisory/AdvisoryProductCard.tsx` and `AdvisoryUpgradePaths.tsx`** — the advisory rendering layer. These files are large (~1000+ lines) and carry presentational logic that has accreted over time. Refactoring them is high-risk without the behavioural regression harness in place.
5. **`apps/web/src/app/page.tsx`** — the home page is large (~5000 lines) and concentrates orchestration logic that should arguably live in `lib/`. Most of the 98 pre-existing TS errors live here.
6. **`packages/rules/rules.yaml`** — 19 rules currently. New rules can have unintended interactions with existing ones via priority and condition overlap. Prefer adding behavioural-regression tests with each new rule.

---

## 10. Recommended near-term focus

If this project were handed off today, the recommended sequence for a new technical steward is documented in [`TECHNICAL_HANDOFF.md`](TECHNICAL_HANDOFF.md) § Recommended first tasks, and [`ROADMAP.md`](ROADMAP.md). At a high level:

1. **Stabilise the typecheck baseline** (Workstream A1) before further engine changes.
2. **Build the behavioural regression harness** (Workstream A8) before fixing the M1 conversation breakers.
3. **Burn down the M1 misalignments** with the harness as the safety net.
4. **Then** consider engine extraction, design-token consolidation, and CI/CD.

This ordering protects the engine's behaviour during the work that touches it most.
