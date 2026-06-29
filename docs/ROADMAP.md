# Audio XX — Practical Roadmap

**Last updated:** 2026-06-29
**Audience:** technical contributors deciding what to work on next, and prospective collaborators evaluating the planned trajectory.

---

## Architecture decision — Conversation intent-resolution doctrine (2026-06-29)

**Status:** future architecture decision. **Not an implementation task.**
No code changes implied by this entry. Recorded here so the principles
that survived adversarial investigation are durable and reviewable.

### Governing principle

> The LLM may interpret language. It may never establish facts, resolve
> application state, select engines, or determine system behavior.

### Doctrine

Audio XX remains deterministic-first. Conversation **must never silently
convert an unresolved turn into diagnosis, assessment, shopping,
comparison, or any other engine path.** The default-to-diagnosis
fall-through is recognized as the root cause of the assessment-routing
class of bug; it is forbidden by this doctrine.

Conversation produces exactly one of:

1. **`CanonicalIntent`** — a typed, fully-resolved intent ready for
   Reasoning.
2. **`needs_semantic_interpretation`** — the explicit state for turns
   the deterministic router could not resolve. Not "diagnosis." Not
   "consultation_entry." Not any engine. An explicit non-resolution.
3. **Clarification** — a user-facing question issued when validation
   rejects an interpretation or when no plausible interpretation is
   available.

The deterministic router is the first path. If it resolves a
high-precision intent, it produces `CanonicalIntent`. If deterministic
resolution is incomplete, the correct architectural state is **not
diagnosis** — it is unresolved intent. A semantic interpreter (A3,
another hosted LLM, a local model, or a deterministic semantic parser)
may be introduced later, but **only inside the unresolved-intent path.**

### Semantic interpreter contract

The interpreter — whatever its implementation — may produce only a
minimal **`SemanticHypothesis`**:

  - hypothesized intent kind (validated against the schema enum)
  - hypothesized subject phrase (raw token, not an identifier)
  - evidence excerpts (spans of the user text used as justification)
  - model / prompt metadata, if applicable
  - schema version

The interpreter **must never** produce:

  - `CanonicalIntent` (Conversation enriches the hypothesis into one)
  - catalog identifiers (Catalog resolution is deterministic)
  - saved-system identifiers
  - active-system references (resolved from session state)
  - follow-up linkage (resolved deterministically from message ids)
  - authorization scope (Identity owns this)
  - trust gates (self-asserted confidence is data, never a gate)
  - engine selection (downstream of intent, never the interpreter's
    call)
  - user-facing final prose
  - anything derived from session state (the interpreter cannot read
    or write conversation state)

Conversation deterministically validates and enriches the hypothesis
into `CanonicalIntent`.

### Invariants before a `CanonicalIntent` reaches Reasoning

  1. **Type validity** — every field has the schema-declared type;
     enum fields are in their enum.
  2. **Reference integrity** — every identifier resolves (Catalog,
     active system, principal).
  3. **Provenance completeness** — every field has an explicit
     `parsed_by` provenance (`deterministic` / `interpreter` /
     `enrichment` / `fallback`); no origin is ambiguous.
  4. **State consistency** — active-system and follow-up references
     match Conversation's authoritative state, not what the interpreter
     thought.
  5. **Plausibility against deterministic features** — the intent is
     consistent with deterministic signals from the turn (e.g.,
     `diagnosis` with zero symptom signals + assessment language is
     implausible and rejected).
  6. **No LLM confidence used as a behavior gate** — interpreter-
     asserted confidence may be carried as data; it never gates
     downstream behavior.
  7. **Audit completeness** — raw text, evidence excerpts, model /
     prompt metadata, and validator decisions are carried in the
     canonical object.
  8. **Idempotency** — the same turn input + same session state + same
     interpreter response produces the same `CanonicalIntent`.

If validation fails, Conversation **asks a clarification question.
It does not guess.**

### Open question — state name

Two candidate names: `intent_unresolved` and
`needs_semantic_interpretation`.

**Recommendation: `needs_semantic_interpretation`.** It describes the
work required without binding the implementation to A3 (or any
specific interpreter). It frames the state as a *transition to a
different mode of work* rather than as a *failure to resolve*, which
shapes engineering culture around the state's growth in the right
direction.

### What this doctrine does not specify

- It does not specify when (or whether) a semantic interpreter will be
  built. The `needs_semantic_interpretation` state may, for an
  arbitrarily long time, route directly to clarification.
- It does not specify the model, provider, prompt, or schema for the
  hypothesis. Those are implementation details to be settled when (and
  if) the interpreter is built.
- It does not specify rate ceilings or telemetry thresholds for the
  `needs_semantic_interpretation` state. Those are governance details
  to be set with the implementation, not in this doctrine.

What it does specify is the *contract* the interpreter must honour
whenever it is built, the *invariants* the canonical object must
satisfy before Reasoning sees it, and the *forbidden silent-routing
behaviour* that the deterministic router has historically allowed.

---

## Checkpoint — Primary assessment-routing bug fixed (2026-06-29)

`fix(intent): widen system-assessment qualifier window for assess/evaluate`
([commit `ea74735`](https://github.com/m1brown/audio-xx/commit/ea74735),
pushed to `origin/version-b`).

With an active saved system selected, natural phrasings that placed
qualifier words between the determiner (`my` / `the` / `this`) and the
system noun (`system` / `setup` / `rig` / `chain`) were misrouting to
the diagnosis clarification flow instead of producing a system
assessment. The `assess` and `evaluate` entries in
`SYSTEM_ASSESSMENT_PATTERNS` allowed only a single optional `current`
between determiner and noun; anything wider fell through to the
line-1755 default `diagnosis` intent.

**Now classified as `system_assessment` (with an active saved system):**

- `Evaluate the currently selected system.`
- `Give me a full assessment of my living room system.`
- `Assess my current living room system.`

**Diagnostic prompts unchanged — still classify as `diagnosis`:**

- `my system sounds bright`
- `it lacks bass`
- `the sound is harsh`
- `vocals sound thin`

**Symptom-leak closed.** The bare word `full` in
`"Give me a full assessment…"` previously reached the diagnosis engine's
signal extractor and matched `warmth_richness` in `signals.yaml`, then
surfaced as `"I recognised 'warmth richness'…"` even though those words
were never supplied. The routing fix routes the prompt as
`system_assessment` *before* the diagnosis engine sees it, so the
signal extraction never runs and `warmth_richness` is no longer
reachable from that prompt.

**Scope:** intent classification only. No change to the diagnosis
engine, the conversation state machine, `signals.yaml`, `rules.yaml`,
the artifact synthesizer, or any UI. Two regexes, one new shared
fragment (`SYS_NOUN_PHRASE_FRAG`) widening the qualifier window from
`(?:current\s+)?` to `(?:\w+\s+){0,3}`.

**Verified:** 14/14 new tests; 124/126 broader intent/routing bundle
(2 failures pre-existing, unrelated, confirmed via git-stash baseline
rerun); tsc at the 94 baseline.

**Live browser smoke pending.** A real-device chat-surface smoke
under the active-saved-system condition should be run on the Vercel
preview rather than locally — the dev server's homepage
hydration / Start-Over path wiped injected `localStorage`
saved-system records on every reload, blocking the local
end-to-end run. The unit test exercises the exact
`detectIntent(text, { hasActiveSavedSystem: true })` call the
production submit handler makes at `page.tsx:1654`, so the routing
fix is mechanically equivalent to the test; the preview smoke
remains worth doing for full UI confirmation.

---

## Checkpoint — Catalog boundary introduced (2026-06-29)

First in-process step toward the target layering:

  **Catalog → Inference → Assessment → Editorial → Presentation**

with Conversation orchestrating across engines and the LLM tier
cross-cutting (never the source of truth). No network boundary introduced;
runtime behaviour unchanged.

**Completed (commit `bc58296`, pushed to `origin/version-b`):**

- New module `apps/web/src/lib/catalog/lookups.ts` carries the five
  read-only catalog-lookup functions previously housed in
  `consultation.ts`:
  `findBrandProfileByName`, `findBrandProfileBySlug`,
  `findProductsByBrandSlug`, `findProductInProse`,
  `findProductByComponentName`.
  Bodies copied verbatim; signatures unchanged; behaviour byte-identical.
- All four runtime imports from `@/lib/consultation` under
  `apps/web/src/components/advisory/` have been re-pointed to
  `@/lib/catalog/lookups`. The Presentation → Domain runtime coupling
  via consultation is broken for the advisory tree.
  `BrandAuthorityPreview.tsx` retains its type-only consultation
  import.
- A new boundary test
  (`apps/web/src/lib/__tests__/catalog-boundary.test.ts`) walks every
  `.tsx` file under `components/advisory/` and asserts no runtime
  imports from `@/lib/consultation`. 24 assertions, all green.
- Test status: tsc at the 94-error baseline; advisory bundle 580/580
  pass; comparison-contract + comparison-followup pass via the shim;
  homepage and `/artifact?case=balanced` serve correctly.

**Transitional state — intentional, named here so the next pass can
clear it:**

- `consultation.ts` keeps a **compatibility shim** that re-exports the
  five names. Non-renderer callers (other `lib/` modules and tests)
  continue to import them from `@/lib/consultation` without changes.
  The shim is the reason this commit was risk-free; removing it
  belongs to a later pass once those callers migrate.
- The new module reads `BRAND_PROFILES` and `ALL_PRODUCTS` (now exported
  from `consultation.ts`) and the `BrandProfile` interface (already
  exported). This creates a **module graph cycle**:
  `consultation` ↔ `catalog/lookups`. It is benign under ESM — the data
  is read only inside function bodies, never at module-init — but it
  is debt that the next catalog step is intended to eliminate.

**Next catalog step (defined, not started):**

- Move `BRAND_PROFILES` and `ALL_PRODUCTS` data arrays out of
  `consultation.ts` and into `lib/catalog/`.
- Move the `BrandProfile` interface to `lib/catalog/`.
- Decide where the `Product` interface lives (currently exported from
  the quirky home `lib/products/dacs.ts`).
- After the data and types move, **remove the consultation.ts
  compatibility shim** for the five lookup functions. Other `lib/`
  callers re-point to `@/lib/catalog/lookups` directly. At that
  point the cycle is gone and the Catalog layer stands on its own.

This is queued, **not authorised** — the next architectural step is a
separate decision, not implied by this checkpoint.

---

## Checkpoint — Assessment Artifact track complete (2026-06-28)

The artifact-centric Audio XX track (renderer → synthesizer → editorial rules
→ PDF) is feature-complete on `version-b` as an isolated `/artifact` route.
The artifact is not yet wired into the main user flow.

**Completed:**
- **Artifact renderer** — `apps/web/src/app/artifact/` (commit `8bd0a04`).
  Canonical assessment as a finished editorial document: masthead, two
  peaks (verdict, recommendation), one seam (evidence rail | judgment
  column), three silences, single permitted entrance, follow-up isolated
  outside the article. Print mode via `?print=1`.
- **Engine → artifact synthesizer** — `synthesizeArtifact.ts` (commit
  `fd9d6d9`). Maps `buildSystemAssessment` output to the editorial payload.
  No engine, ontology, or recommendation logic changed; contradictions in
  engine output are surfaced rather than smoothed.
- **PDF export** — `scripts/export-artifact.mts` (commit `391d540`).
  `npm run artifact:pdf -- --case=… | --system=…`, A4 portrait, deterministic
  given a `--date` override (matching SHA after stripping CreationDate /
  ModDate / Producer metadata).
- **Editorial rule set R1–R8** — frozen, explicit, post-condition-enforced
  in the synthesizer (commits `7ce0615`, `8c55bec`):
  - R1 — recognition ≠ standfirst
  - R2 — recognition describes apparent **intent**, never the tonal
    signature (general derivation; no fallback path)
  - R3 — bottleneck case moves mechanism → heard consequence (bottleneck
    path only; restraint governed by R8)
  - R4 — no datum repeat when the evidence rail shows it
  - R5 — no recommendation preview inside the case
  - R6 — recommendation acts only on the engine's bottleneck role
  - R7 — cost names the specific trade-off implied by the recommendation
  - R8 — restraint demonstrates equilibrium; forbidden refrains
    ("It is balanced", "no weak link", "nothing needs changing/fixing")
    stripped
  - Each rule documented at the top of `synthesizeArtifact.ts` and every
    failed post-condition logged as a contradiction.
- **Stress-tested across 6 categories / 8 runs.** All reachable
  categories — `power_match`, restraint/no-change, `dac_limitation`,
  `stacked_bias` — pass every applicable rule. Per-category heard-
  consequence lines added for `power_match`, `dac_limitation`,
  `stacked_bias`, `speaker_scale`, `amplifier_control`.

**Known limits at this checkpoint:**
- **Untriggered categories:** `speaker_scale` and `amplifier_control`
  branches exist (cost lines + heard-consequence lines) but the engine did
  not classify any catalog-resident system into them during stress
  testing. Coverage will arrive when the engine's classifier reaches them
  on real systems.
- **Engine data issue (not synthesizer):** partial model resolution — e.g.
  `chain.fullChain[0] = "Topping"` with no resolved model — surfaces as
  bare-brand text in the artifact. Fixed at the engine-resolution layer,
  not in `synthesizeArtifact.ts`.

**Stylistic variation:** intentionally not added. Each rule emits one
fixed shape per slot; rotation across multiple phrasings is a deliberate
future call, not part of this checkpoint.

**Next decision (open):** integrate the artifact into the main user flow
(preferred — surface it behind a clean route or feature flag so it gets
real use), or fix engine coverage gaps (`speaker_scale`,
`amplifier_control`, partial model resolution) first. Integration is
favored because the artifact now needs use, not more isolated polishing.

---

## Status — Automated QA workflow (2026-06-25)

Eliminates Mike as the manual browser-QA bottleneck after engine changes.
Two-tier, single-command regression workflow (commit `ea4df19`,
`apps/web/qa-regression/`).

**Completed:**
- Automated QA workflow implemented.
- Tier A engine-snapshot regression working across 10 fixtures (deterministic capture + exact diff + concise report).
- Tier B visual regression smoke test working (Playwright `toHaveScreenshot`, homepage baseline verified).
- One-command scripts added:
  - `npm run qa:regress`
  - `npm run qa:baseline`
  - `npm run qa:regress:visual`
  - `npm run qa:regress:all`

**Known notes:**
- Tier A is the primary launch QA mechanism.
- Tier B visual baselines are OS/environment-specific — treat as a layout smoke test, not the main regression source.
- Visual fixture expansion should wait until after the UI trust pass.

---

## Status — Recommendation-bias remediation (2026-06-25)

Launch-critical removal of the universal-"better" bias from the recommendation
surfaces. Governing rule: **Recommendation = Judgment × User Intent**, with User
Intent sourced only from `desires` / `listenerPreferenceProfile` (never
`listenerPriorities` or system-inferred preferences). Ontology unchanged.

**Completed (shipped to `origin/version-b`, commits `30fa279`, `d2c7a49`):**
- **P1 — Intent Gate** — `deriveIntentStance()` in `preference-protection.ts`.
- **P2 — Path 1 Direction** — counter-direction targets fire only when intent opposes the bottleneck's lean (`buildUpgradePaths`).
- **P3 — Bottleneck Promotion** — preference-relative bottlenecks whose lean the user wants are demoted from imperative "Highest Impact" to same-direction "Optional Direction"; detection stays observer-invariant (`detectPrimaryConstraint` untouched).
- **P5 — Limitation Framing** — limitations describing the downside of a wanted trait are reframed as accepted trade-offs (`inferAssessmentLimitations`).

**Known non-blocking follow-up:**
- **P4 — §10 narrative upgrade-direction prose** (`inferUpgradeDirection`) may still contain counter-direction wording. Track as **Nice-to-Have / fast-follow, not launch-blocking** — the decisive recommendation surfaces (P2/P3) and the limitations section (P5) are already intent-correct; this is prose-level reinforcement only.

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

### Listing evaluation — seller communication and negotiation (Phase 2 / 3)

The image-based listing-evaluation MVP shipped on `version-b` (commits `f9cd099` → `6da51fc`). Users can upload a screenshot of a used listing and get a structured, candid read against their saved system. That establishes a new product surface — Audio XX as a second pair of eyes on a specific listing — and there is a natural Phase 2 / 3 follow-on once the MVP has been used on real listings long enough to validate it.

Phase 2 / 3 — **seller communication and negotiation assistance**. After an evaluation, surface optional follow-up actions to help the user actually talk to the seller: draft a polite inquiry in the seller's language, ask for additional information (service history, voltage, accessories, defects), request specific photos (rear panel, serial plate, internals), translate the seller's response, draft follow-up questions, draft a respectful price-negotiation message, or decline politely. Target the European used-market languages — FR / DE / NL / IT / ES / EN.

The same advisor constraints carry over: no legal advice, no seller-trust or authenticity claims, no pressure tactics, no "buy now", preserve uncertainty, and recommend asking questions before negotiating when key risks are unresolved. Not a marketplace; not escrow or payment.

Detailed framing — use cases, hard constraints, UI sketch, dependencies — lives in [`ROADMAP-SPEAKS-FOR-ITSELF.md`](../ROADMAP-SPEAKS-FOR-ITSELF.md) under "Beyond Late-May 2026 — Listing Evaluation Feature Line". *Not currently scheduled.* Treat as deferred until MVP usage signals validate the surface.

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
