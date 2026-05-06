# Audio XX → Climate Screen — Implementation Plan

**Last updated:** 2026-05-06
**Pairs with:** `docs/strategic-briefing.md`
**Purpose:** Sprint-shaped task list. Pick one task at a time, paste it into a fresh AI thread along with the briefing, and execute.

---

## Three workstreams

- **Workstream A — Audio XX hygiene.** Friends-shareable in ~2 days; full Foundation tier deferred to after CS is underway.
- **Workstream B — Reasoning engine extraction.** Structural relocation now; API freeze later.
- **Workstream C — Climate Screen prep.** No-code decisions in week 1.

---

## Workstream A — Audio XX

### A0 (must-do for friends prototype) — Friends-shareable polish

Goal: Audio XX is shareable with 5–10 close friends without embarrassment. ~2 working days total.

**Tasks:**
1. **Strip production debug logs.** Grep for `console.log\(['"]\[` to find tagged lines like `[turn-debug]`, `[intent-authority]`, `[decisive-debug]`. Delete or gate behind `if (process.env.NEXT_PUBLIC_DEBUG === '1')`. ~½ day.
2. **Wire production-only Sentry.** `@sentry/nextjs`, DSN via env, basic PII filter on user input. Skip source-map polish for now. ~½ day.
3. **Sanity-check top user paths.** "best DAC under $1500", system assessment, brand question, hypothetical. Each runs clean end-to-end. ~½ day.
4. **Friend access setup.** Vercel preview link, password gate, or invite list — pick one. ~½ day.

**Acceptance:** Send to 5 friends with a one-line "tell me what's confusing or feels wrong" prompt.

---

### A1 (defer until CS week 2+) — Green up TypeScript

`npx tsc --noEmit` exits non-zero across at least:
- `src/lib/consultation.ts` (PrimaryAxisLeanings shape, BrandProfile.tendency missing)
- `src/lib/inference-layer.ts` (level type comparisons)
- `src/lib/listener-profile.ts` (missing trait keys)
- `src/lib/prisma.ts` (Prisma client cast)
- `src/lib/shopping-intent.ts` (ProductCategory comparisons, _rank field)
- `src/lib/system-bridge.ts` (missing hasExternalAmplification)
- `qa-tests.ts` (top-level — needs `allowImportingTsExtensions` or import path fixes)
- `src/app/page.tsx` (multiple — SET_SYSTEM_CONTEXT, fired_rules, SubjectMatch.brand)
- `src/app/api/orchestrator/route.ts` (StructuredData type mismatch)

**Scope:** fix or explicitly suppress (`@ts-expect-error` with justification) every error. One PR per module.

**Acceptance:** `npx tsc --noEmit -p apps/web` exits 0. Each `@ts-expect-error` has a one-line follow-up TODO.

---

### A2–A5 (defer) — Strip debug logs (full pass) / Wire Sentry (minimal) / CI gates / Pre-commit

These are sized for "open to public traffic," not "share with friends." Defer until after CS is underway. Detail preserved for future reference:

- **A2 full pass:** ESLint rule banning `console.log` outside `*.test.ts` and a `lib/debug.ts` helper.
- **A3 minimal Sentry:** errors + stack traces + source maps. Skip `Sentry.startSpan` handler wrapping, skip distributed tracing. Trace continuity comes only if a real diagnostic need surfaces.
- **A4 CI gates:** GitHub Actions workflow with `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm audit --audit-level=high`, optional gitleaks. Branch protection blocks PR merge on red.
- **A5 pre-commit:** Husky + lint-staged, prettier + eslint --fix on staged, `tsc --noEmit` on push.

---

### A6 (ongoing, parallel with B) — Burn down 8 known advisory misalignments

Tracked in MEMORY.md:
1. Advisory builders perform product lookup before system reasoning
2. Discovery flags are binary keyword matches, not evidence-based
3. Turn cap (3) is primary brake instead of evidence-based phase transitions
4. Follow-up continuity broken (QA C1)
5. Unknown products return empty responses (QA C4)
6. Non-advisory intents force-routed into advisory framing (QA C3)
7. StructuredMemoInputs deprecated path still active in `consultation.ts`
8. Component descriptions duplicate when axis positions are similar

**Approach per item:** failing regression test first, then fix, then commit. Each lives in `apps/web/src/lib/__tests__/`.

**Acceptance:** each misalignment has a named test that would have caught it; the test passes after the fix.

---

### A8 (NEW — do BEFORE A6 burndown) — Behavioral regression harness

**Why:** Audio XX's product is reasoning behavior. Right now you validate it visually and manually. Each A6 misalignment fix needs a test that would have caught the misalignment — without a harness, you have no anchor for "does this change make the system smarter or just different?"

**Scope:** new test file at `apps/web/src/lib/__tests__/behavioral-regression.test.ts` (or split into a few files by topic). Drive a curated list of canonical prompts through the orchestrator and assert *behavioral properties*, not exact text:

```
Canonical prompts to anchor:
  - "best DAC under $1500"
  - "I want more flow"
  - "my system sounds harsh"
  - "compare Qutest vs Pontus"
  - "tell me about Zu Audio" (unknown / partial-knowledge)
  - "should I do nothing?"
  - "PA system for a venue" (adjacent)
  - "line array for a concert tour" (out_of_scope)
```

For each, assert:
- Routing: lands in the expected ConversationMode
- Confidence language: matches the calibrated level (no assertive language on low-confidence outputs)
- Trade-offs: every recommendation names at least one trade-off
- Continuity: follow-up turns don't duplicate the prior response (QA C1)
- Restraint: when evidence is insufficient, system surfaces what's missing rather than fabricating
- Structure: advisory output has the expected fields populated

**Acceptance:** running the harness on `main` is green; introducing a regression in any of the 8 known misalignments would turn at least one assertion red.

**Why before B3:** the harness pins the engine's behavioral contracts. Extracting modules without it means you might preserve the API but lose the behavior.

---

### A9 (NEW — do BEFORE further UI iterations) — Design token stabilization

**Why:** the recent UI passes (palette, density, premium feel, hierarchy) have settled most decisions, but they're scattered across `COLORS` constants in three files (`AdvisoryProductCard.tsx`, `AdvisoryMessage.tsx`, `AdvisoryIntake.tsx`) and ad-hoc inline styles. Without tokens, the next UI tweak risks regressing the last one.

**Scope:** small token system, not a design-system rewrite. New file `apps/web/src/lib/design-tokens.ts` (or `apps/web/src/styles/tokens.ts`):

```ts
export const COLOR = { ... };           // single source for slate-blue palette
export const SPACE = { ... };           // 4px / 8px / 12px / 16px / 24px / 32px scale
export const TYPE = { ... };            // size + weight + line-height per role
export const RADIUS = { ... };
export const SHADOW = { ... };
```

Plus a section in `apps/web/CLAUDE.md` (or a new `apps/web/docs/ui-grammar.md`) defining the *advisory card grammar*:
- Sounds like → emotional anchor (highest weight body text)
- Why this one → reasoning (medium weight)
- Trade-off → muted (lower weight, secondary color)
- Metadata/actions → recede (smallest)

**Migration:** replace the three `COLORS` objects to import from the token file. Don't touch other styles in this PR.

**Acceptance:** a new UI tweak two weeks from now references tokens, not raw hex. The grammar doc gives any future contributor (including AI assistants) a single answer to "what should this label look like?"

---

### A7 (do before B3) — Confidence semantics lock-in

**Why:** every engine module reads/writes `confidence`. Changing the semantics post-extraction is a cross-package break.

**Scope:**
- Define levels explicitly: `'high' | 'medium' | 'low' | 'insufficient'`
- Define what each level means in output:
  - `high` → assertive language allowed
  - `medium` → measured language, name the qualifier
  - `low` → hedged language required
  - `insufficient` → refuse to recommend; surface what's missing instead
- Pin the semantics with tests in `apps/web/src/lib/__tests__/confidence-semantics.test.ts`

**Acceptance:** every engine consumer of `confidence` is covered by at least one test that would fail if the semantics drift.

---

## Workstream B — Reasoning Engine Extraction

Goal: lift the portable reasoning core into a workspace package while Audio XX is its only consumer. Sets up Climate Screen to consume it without rewrites. **Sequencing is staged** — structural relocation is cheap, API freeze should wait until behavior stabilizes.

### B0 (NEW — do before B3) — Evidence lineage primitive

**Why:** government auditors and enterprise security teams will ask "why did the system conclude this?" — not just citations, but evidence lineage, confidence origin, assumption tracking, conflicting-evidence handling. Every engine module touches recommendation construction; threading this through later means re-touching every module.

**Scope:** add two siblings to existing structured advisory output:

```ts
evidence: Array<{
  source:
    | `rule:${string}`
    | `signal:${string}`
    | `catalog:${string}`
    | `system-character:${string}`;
  contribution: 'positive' | 'negative' | 'neutral';
  weight: number;
}>;

assumptions: Array<{
  what: string;
  default: unknown;
  reason: 'missing-input' | 'low-confidence-fallback' | 'cold-start';
}>;
```

For Audio XX, render behind a "Why did you say that?" expandable. Most users won't open it; advanced users will love it. Aligns with the Adaptive Register mandate in CLAUDE.md.

For Climate Screen, primary auditor surface.

**Acceptance:** every engine module that produces a recommendation populates both fields. At least one test asserts the fields are non-empty for representative inputs.

---

### B1 (do now — low risk) — Engine module audit

**Scope:** audit `apps/web/src/lib/` and tag each file:
- `engine` (portable, no audio vocabulary): `tradeoff-assessment.ts`, `preference-protection.ts`, `inference-layer.ts`, `decision-frame.ts`, `engine.ts`, `counterfactual-assessment.ts`, parts of `reasoning.ts`
- `adapter` (translates between engine and domain types): `constraint-adapter.ts`, parts of `consultation.ts`, parts of `shopping-intent.ts`
- `domain` (audio-specific): catalogs, `system-direction.ts`, signal dictionaries, `advisory-response.ts`

**Acceptance:** one-page audit naming each file and its tier. No code change.

---

### B2 (do now — low risk) — Workspace package skeleton

**Scope:** confirm `pnpm-workspace.yaml` (or root `package.json` workspaces field). Add `packages/decision-engine/` with:
- `package.json` (private, scoped: `@audioxx/decision-engine`)
- `tsconfig.json` extending root
- `src/index.ts` re-exporting the public surface (empty for now)
- No code moved yet

**Acceptance:** `apps/web` can import from `@audioxx/decision-engine` even though it exports nothing.

---

### B3 (defer — do AFTER A6 stabilizes the advisory object model AND A7 locks confidence semantics AND B0 lands the evidence primitive) — Module relocation

**Why deferred:** the 8 known misalignments include changes that will reshape advisory output (StructuredMemoInputs deprecation, turn-cap → evidence-based phase transitions). Don't move files into a public-shaped package right before changing their internals.

**Scope:** one PR per module. For each move:
- Cut the file from `apps/web/src/lib/` to `packages/decision-engine/src/`
- Update imports in Audio XX
- Run the test suite green
- Verify zero audio-specific vocabulary (the "Climate Screen test"). If it doesn't pass, leave it where it is and flag for adapter-extraction PR.

**Suggested order:** smallest-leaf-first. Probably `counterfactual-assessment.ts` → `tradeoff-assessment.ts` → `preference-protection.ts` → larger modules.

**Acceptance per PR:** Audio XX still passes all tests; the moved module has no audio domain references; no circular imports.

---

### B4 (defer — only after B3 done AND a second consumer exists) — Engine README

**Why deferred:** README documents what's true, not aspirational. Two consumers prove the abstraction; one can't.

**Scope:** `packages/decision-engine/README.md` listing every exported function and contract. Include the "Climate Screen test" — every export answers "yes, this could run in a different domain."

---

## Workstream C — Climate Screen Prep

No code. Decisions only. Three evenings, max — interleave with Workstream A in week 1.

### C1 — Climate Screen CLAUDE.md skeleton

Reuse the structure of `apps/web/CLAUDE.md`. Add sections on:
- Regulatory invariants (what counts as a regulated activity in this jurisdiction)
- Source attribution and data provenance
- The line between "advisory" and "advice that is itself a regulated activity" (in some jurisdictions this is the difference between a software product and a licensed consultancy)
- Government / enterprise tone constraints

**Acceptance:** skeleton committed to (eventual) CS repo. At least the engine-vs-domain boundary section copied verbatim.

### C2 — Cloud + compliance posture

Pick one and commit:
- AWS GovCloud vs. Azure Government
- FedRAMP Moderate vs. High (depends on customer)
- SOC 2 Type 2 — assume yes
- StateRAMP — depends on go-to-market

**Acceptance:** decision documented in `docs/strategic-briefing.md` decision log with reasoning.

### C3 — Identity provider

Pick one:
- WorkOS, Auth0, or Stytch
- Decision criteria: SSO/SAML coverage, SCIM provisioning, FedRAMP authorization status, pricing at expected tier

**Acceptance:** decision documented; not integrated yet.

---

## Execution order (revised)

1. **Day 1–2:** A0 (friends-shareable polish) → send to friends.
2. **Day 3–5:** C1, C2, C3 (CS decisions, evening tasks). Audio XX feedback loop runs in background.
3. **Week 2:** Begin CS scaffold (foundations from day 0 — see strategic briefing). On Audio XX side, start A1 (TS green) and A9 (design tokens) — both stabilize the ground before more iteration.
4. **Week 2–3:** A8 (behavioral regression harness). This must precede A6 — every misalignment fix needs a test that would have caught it.
5. **Week 3–4:** A6 (misalignment burndown) using the harness. B1 (engine audit), B2 (package skeleton) in parallel — both low-risk organizational moves.
6. **Week 4+:** A2/A4 (debug-log full pass + CI gates). A7 (confidence semantics) before B3.
7. **Week 5+:** B0 (evidence lineage primitive) — adds `evidence` and `assumptions` arrays to existing advisory output objects.
8. **After A6 stabilizes + A7 done + B0 done:** B3 (module relocation) in tranches.
9. **After B3 + second consumer (CS) lights up:** B4 (engine README).
10. **Late May:** journalist-outreach version of Audio XX, informed by friend feedback.

**Key sequencing rules:**
- A8 (harness) gates A6 (burndown).
- A9 (tokens) gates further UI iteration.
- A6 + A7 + B0 all gate B3 (extraction).
- B3 + CS as second consumer gate B4 (public README).

---

## Constraints for AI assistant

- Surgical edits — touch only the file in scope
- Exact diffs with file paths and line ranges
- State acceptance criteria upfront before writing code
- Do not refactor unrelated logic
- Do not introduce new dependencies without flagging the choice and alternatives
- Match existing code style and naming conventions
- Flag scope expansion before acting on it
