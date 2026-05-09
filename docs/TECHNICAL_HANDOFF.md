# Audio XX — Technical Handoff

**Last updated:** 2026-05-09
**Audience:** a technical contributor or engineering partner taking on stewardship of Audio XX, with no prior conversational history with the project.

This document is a focused onboarding memo. It assumes you can read the rest of the documentation; this one orients you to *which docs matter most, in which order, and why*.

---

## 1. What you should understand first

Read these in order before touching code:

1. **[`README.md`](../README.md)** — the front door. Five minutes.
2. **[`PROJECT_STATE.md`](PROJECT_STATE.md)** — honest current-state assessment. Strengths, weaknesses, maturity tier. Twenty minutes.
3. **[`PRODUCT_PHILOSOPHY.md`](PRODUCT_PHILOSOPHY.md)** — what makes the project different and why that produces specific engineering decisions. Twenty minutes.
4. **[`ARCHITECTURE.md`](ARCHITECTURE.md)** — system architecture reference. Forty minutes.
5. **[`CLAUDE.md`](../CLAUDE.md)** at the repository root — the locked behavioural specification. The single most important document in the project. Thirty minutes.

After these five, you will understand what the project is, what state it is in, and why the code is shaped the way it is. Total reading time: ~2 hours.

For local setup: **[`SETUP.md`](SETUP.md)**. For deployment: **[`DEPLOYMENT.md`](DEPLOYMENT.md)**.

---

## 2. System philosophy in one paragraph

Audio XX is a **system-level audio advisor**, not a product recommendation engine. The reasoning order is fixed: system context first, products last. Every advisory output names trade-offs. "Do nothing" is treated as a first-class outcome. The system never ranks products into numeric league tables and never produces marketing-style language. Confidence is calibrated; low-confidence outputs are hedged or refused. The visible UI is restrained, monochrome, editorial. These properties are not aspirational — they are enforced in code by the deterministic engine and in QA by the conventions in [`QA.md`](QA.md).

If you find yourself adding a feature that would compromise any of these properties, stop and re-read [`PRODUCT_PHILOSOPHY.md`](PRODUCT_PHILOSOPHY.md). The properties are not negotiable; they are the reason the project exists.

---

## 3. Architecture in five sentences

The application is a Next.js 15 App Router project with TypeScript, Prisma, NextAuth, and Vitest. The advisory engine lives in `apps/web/src/lib/` and is fully deterministic — there is no live LLM call in the production reasoning path today. The 4-axis sonic trait framework (Warm↔Bright, Smooth↔Detailed, Elastic↔Controlled, Airy↔Closed) and a hand-curated catalog drive the reasoning. The home page renders a 3-column workspace (LeftRail / main / RightRail) on desktop, collapsing responsively. Production deploys via Vercel with Turso (libsql) as the database; Sentry handles error tracking.

Full architecture: [`ARCHITECTURE.md`](ARCHITECTURE.md). All 13 sections matter.

---

## 4. Operational expectations

| Area | Expectation |
|---|---|
| Branch strategy | Day-to-day on `friends`. `main` reserved for journalist-readiness. |
| Commit discipline | One logical change per commit, descriptive imperative-mood messages. |
| Deployment | Vercel auto-deploys on push to any branch. `friends` is the active preview. |
| Quality gates | Vitest + TypeScript baseline (98 known errors, must not regress). No CI yet. |
| Documentation cadence | Update `KNOWN_ISSUES.md` and `PROJECT_STATE.md` as state changes. |
| AI-assistant usage | Ad-hoc, surgical. See [`CLAUDE_WORKFLOW.md`](CLAUDE_WORKFLOW.md) for conventions if using Claude or similar. |
| Issue triage | See [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) § 10. |

**Commit-discipline rule worth highlighting:** never commit on the developer's behalf without explicit instruction. The project has consistently isolated commits per logical change. Compound commits make blame and rollback harder.

---

## 5. The most important rules to internalise

From [`CLAUDE.md`](../CLAUDE.md), summarised:

1. **Diagnose before coding.** For any bug, trace input → detected intent → routing → handler → output before writing a fix.
2. **Smallest safe fix.** Modify only the responsible file or function. Do not expand scope. Do not refactor unrelated logic.
3. **No silent side effects.** List every file changed. Justify each change.
4. **Verify with real inputs.** Test with the exact reported input. Show detected intent and routing path. Include at least one control case.
5. **Stop and re-plan if scope expands.** If more than one logical area needs changes, stop and re-evaluate.
6. **Engine vs. domain boundary.** Core reasoning modules must remain domain-agnostic. Audio-specific logic belongs in adapter / mapping layers. Apply the "Climate Screen test" — could this logic run unchanged in another domain?

Violating these is the most common source of regressions. Treat them as enforcement, not aspiration.

---

## 6. Recommended first tasks

Once you've read the documentation and run the project locally, these are sensible first tasks in order:

### A. Confirm operational health (~½ day)

Verify the items in [`QA_CHECKLIST.md`](QA_CHECKLIST.md):

- All routes resolve and render meaningfully.
- Sentry receives a deliberate test error in the deployed environment.
- The four canonical prompts walk cleanly on the live preview URL.
- The TypeScript baseline is at 98 errors, not 99+.

This grounds you in the running state and surfaces anything that has drifted since this documentation was written.

### B. Walk a recent bug-fix end-to-end (~½ day)

Pick a recent commit from `git log --oneline` (the active-system tuning fix, the link-QA pass, or the accent restoration are good candidates). Read the diff. Read the relevant engine files. Form a mental model of *why this fix took the shape it did*. This builds the muscle memory for the project's conventions.

### C. Build (or extend) the behavioural regression harness (~3–5 days)

The harness specified in [`docs/implementation-plan.md`](implementation-plan.md) Workstream A8 is the highest-leverage piece of unbuilt infrastructure. Once it exists, every subsequent change is safer. Without it, every change carries unmeasured risk.

Suggested starting point: a single test file at `apps/web/src/lib/__tests__/behavioral-regression.test.ts` driving the canonical prompts in [`QA.md`](QA.md) § 2 through the orchestrator and asserting routing-mode and trade-off-presence properties.

### D. Pick one M1 misalignment to burn down (~1–3 days)

Once the harness is in place, the three demo-blockers (`MEMORY.md` #4, #5, #6) become safer to fix. C1 (follow-up continuity) is the most demo-visible because it triggers on the second message in any conversation; it's a sensible first target.

### E. Align the affiliate disclosure copy with current code state (<1 hour)

The current footer disclosure is forward-looking but reads as descriptive. Soften the copy until affiliate is actually wired. See [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) § 6 and [`AFFILIATE_POLICY.md`](AFFILIATE_POLICY.md).

After these five tasks, you will have demonstrated competence in the codebase, materially improved the regression-detection capability, addressed a demo-blocker, and aligned a small but visible inconsistency. A reasonable two-week onboarding window.

---

## 7. Suggested stabilisation priorities

If your charter is to bring Audio XX to a more stable production tier:

1. **Tier 1 from [`ROADMAP.md`](ROADMAP.md)** — beta hardening. Demo-blocker fixes plus disclosure alignment. ~1 week.
2. **Tier 2 from [`ROADMAP.md`](ROADMAP.md)** — QA automation. Behavioural regression harness, confidence semantics lock, at least one E2E test. ~2 weeks.
3. **Tier 3 from [`ROADMAP.md`](ROADMAP.md)** — operational tooling. CI/CD, pre-commit hooks, TypeScript baseline cleanup. ~2 weeks.

After these three tiers, the project has the operational scaffolding to be evolved safely by additional contributors and to absorb significant change without proportional regression risk.

---

## 8. Suggested maintenance responsibilities

Recurring responsibilities a technical steward should hold:

- **Weekly:** glance at the Sentry dashboard. Triage any new errors.
- **Per push to `friends`:** confirm Vercel preview deploys successfully. Walk the four canonical paths if the change touched routing or the advisory pipeline.
- **Quarterly:** link audit. Probe retailer URLs for liveness. See [`QA.md`](QA.md) § 4.
- **Quarterly:** dependency audit. `npm audit`; review high-severity advisories.
- **As needed:** update `KNOWN_ISSUES.md` when an issue is resolved or a new one is identified.
- **Annually or on rotation:** rotate `NEXTAUTH_SECRET`. Document the rotation date.
- **On every catalog addition:** verify image overlay map matches the new entry's normalised brand+name; verify retailer URLs return 200; confirm axis positions are documented in the entry's comments.

---

## 9. Things that are explicitly not your responsibility

To keep boundaries clean:

- **Product direction.** The reasoning order, the trait framework, the editorial voice, and the philosophical principles in [`CLAUDE.md`](../CLAUDE.md) are owned by the product author. Do not modify them without explicit collaboration.
- **Catalog content.** Adding new components, refining axis positions, and updating descriptions require domain knowledge. A technical steward can fix obvious bugs (broken URLs, image overlay mis-keys) but should not author new entries unilaterally.
- **Brand and visual identity.** The monochrome palette plus the single restrained brand-red accent is a deliberate design decision. Changes here go through product review.
- **The locked v1 trait framework.** [`docs/audio_xx_sonic_trait_framework_v1.md`](audio_xx_sonic_trait_framework_v1.md) is locked. Adding new axes or changing existing axis semantics is out of scope without explicit collaboration.

The technical steward's domain is the runtime behaviour, the operational health, the regression-detection infrastructure, and the boundary between portable reasoning and audio-specific adapters. The product author's domain is everything above that.

See [`OPERATING_MODEL.md`](OPERATING_MODEL.md) for the full ownership map.

---

## 10. When to reach out

A non-exhaustive list of moments where escalation to the product author is warranted:

- A proposed change would alter the reasoning order (system → traits → balance → comparison → direction → products).
- A proposed change would weaken trade-off discipline, calibrated confidence, or the do-nothing primacy.
- A proposed catalog change touches axis positions or trait tendencies on existing entries.
- A proposed change introduces a new dependency or replaces an existing one.
- A proposed change crosses the engine/domain boundary in either direction.
- An unfamiliar regression appears in advisory output that you cannot trace cleanly.
- The TypeScript baseline regresses (98 → 99+) for a reason you cannot resolve.

For routine fixes that respect the existing conventions, no escalation is needed.

---

## 11. The minimum bar for a useful contribution

A change that would be welcome from a new contributor:

- ✅ Touches one file or one tightly-scoped function
- ✅ Includes a regression test where applicable
- ✅ Does not regress the TypeScript baseline
- ✅ Is committed with a clear imperative-mood message
- ✅ Respects the engine vs. domain boundary
- ✅ Either preserves existing behaviour (refactor) or names the changed behaviour explicitly (feature/fix)

A change that would *not* be welcome without prior discussion:

- ❌ Refactors the engine without a corresponding regression harness
- ❌ Touches the catalog data without verification
- ❌ Bundles multiple unrelated changes into one commit
- ❌ Adds new dependencies without justification
- ❌ Introduces marketing language, scoring, or anti-restraint output patterns
- ❌ Modifies `CLAUDE.md` or the trait framework documentation

The bar is intentionally high. The project has invested heavily in identity coherence; preserving that is the steward's primary responsibility.

---

## 12. Contact and decision-making

See [`OPERATING_MODEL.md`](OPERATING_MODEL.md) for the project's operating model — who owns what, how decisions are made, and what the cadence looks like. The short version: product direction is owned by the project author; tactical implementation is owned by whoever is currently doing the work; AI-assisted tooling (Claude or similar) is used as a sharp tool, not an autonomous agent.

If you are picking up the project cold, the appropriate first message is something like: *"I have read [`README.md`](../README.md), [`PROJECT_STATE.md`](PROJECT_STATE.md), [`PRODUCT_PHILOSOPHY.md`](PRODUCT_PHILOSOPHY.md), [`ARCHITECTURE.md`](ARCHITECTURE.md), and [`CLAUDE.md`](../CLAUDE.md). I have run the project locally and walked the four canonical prompts. I am ready to start with [first task]. Are there constraints I should know that aren't documented?"*

That message demonstrates competence, respects existing scope, and surfaces any unwritten conventions before they become a regression.
