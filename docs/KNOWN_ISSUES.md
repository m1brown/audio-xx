# Audio XX — Known Issues and Deferred Decisions

**Last updated:** 2026-05-09
**Audience:** technical contributors who need to know what is currently broken, what is intentionally deferred, and what unresolved questions exist.

This document is the canonical inventory of open issues. It cross-references the engine misalignments tracked in `MEMORY.md`, the QA findings from recent QA passes, and the deferred items from [`docs/implementation-plan.md`](implementation-plan.md).

---

## 1. Advisory engine misalignments

These are tracked in `MEMORY.md` and discussed in detail in [`PROJECT_STATE.md`](PROJECT_STATE.md) § 5–8.

| # | Issue | Severity | Tracked in |
|---|---|---|---|
| 1 | Advisory builders perform product lookup before system reasoning | Architectural | `MEMORY.md` |
| 2 | Discovery flags are binary keyword matches, not evidence-based | Architectural | `MEMORY.md`, `.plan-discovery-model.md` |
| 3 | Turn cap (3) is primary brake instead of evidence-based phase transitions | Architectural | `MEMORY.md` |
| 4 | Follow-up continuity broken (QA C1) — duplicates prior response | **Demo blocker** | `MEMORY.md`, roadmap M1 |
| 5 | Unknown products return empty responses (QA C4) | **Demo blocker** | `MEMORY.md`, roadmap M1 |
| 6 | Non-advisory intents force-routed into advisory framing (QA C3) | **Demo blocker** | `MEMORY.md`, roadmap M1 |
| 7 | `StructuredMemoInputs` deprecated path still active in `consultation.ts` | Technical debt | `MEMORY.md` |
| 8 | Component descriptions duplicate when axis positions are similar | Polish | `MEMORY.md`, roadmap M2 |

The three demo-blockers (#4, #5, #6) are the focal point of the next work cycle. The roadmap framing: *"these are the things that end a demo in the first 60 seconds."*

---

## 2. Routing inconsistencies

### Two parallel `/systems` flows

| Route | Backing | Auth required | Linked from |
|---|---|---|---|
| `/systems` | Prisma + `/api/systems` | Yes | Top nav, left rail |
| `/systems/saved` | Local `SavedSystemsPanel` (localStorage) | No | Direct URL only |

Both render meaningfully but the data sources are independent. A user creating a system via `/systems` does not see it via `/systems/saved`, and vice versa. The intended consolidation is unresolved.

**Caution:** changing either flow risks breaking the other. The legacy `/systems` flow predates the local SavedSystemsPanel; the latter was added without removing the former.

### `/profile` reachable from multiple entries

- Top nav: radar avatar (icon-only, no text label)
- Left rail: "Listening profile" text link

Both target `/profile`. Functionally redundant but not currently broken.

### Top nav active-state highlighting is recent

The top nav now applies an `aria-current="page"` and a subtle bottom border to the matching route (`/how-it-works`, `/glossary`, `/resources`, `/systems`). This was added in a recent commit. There is no active-state on `/profile` because the radar avatar has no text label to underline.

### Left rail rails-only-on-`/`

The LeftRail and RightRail mount only on the home route. Active-state plumbing on left-rail items other than "Conversation" is dead code at runtime. This was an explicit scope decision; expanding the rails to all routes is a deferred architectural question (see § 8 below).

---

## 3. Persistence limitations

### Conversation messages are not persisted across navigation

The `messages` array lives in `useReducer` state on `apps/web/src/app/page.tsx`. When a user navigates to `/systems` or `/profile` and returns to `/`, the conversation is empty. The right rail's "Recent" section, which derives from `messages`, also resets.

The persistent state in `AudioSessionContext` (saved systems, draft system, active system reference) survives navigation correctly. Conversation does not.

### Implications

- A user who reads the right rail's "Recent" entries before clicking away to `/systems` will see them disappear on return.
- Multi-turn conversations that span a navigation event are lost.
- This is the most-visible UX gap in the workspace architecture.

### Workaround / fix paths

- Add a `useEffect` that persists `messages` to `sessionStorage` and rehydrates on mount.
- Or accept the gap as a constraint and surface it via copy ("Recent activity from this session — clears on navigation").
- No work is in progress on either path.

---

## 4. TypeScript baseline

`npm run typecheck` reports **98 pre-existing errors**. Per-file distribution (from a recent audit):

- `qa-tests.ts` — top-level test runner with `.ts` import paths; needs `allowImportingTsExtensions` or path fixes
- `apps/web/src/app/page.tsx` — multiple shape mismatches (`SubjectMatch.brand`, `SET_SYSTEM_CONTEXT`, `fired_rules`, `decisiveRecommendation` undefined narrowing, `ShoppingContext` shape, `EvaluationResult` cast)
- `apps/web/src/lib/consultation.ts` — `PrimaryAxisLeanings` shape, `BrandProfile.tendency` missing
- `apps/web/src/lib/inference-layer.ts` — level type comparisons
- `apps/web/src/lib/listener-profile.ts` — missing trait keys
- `apps/web/src/lib/prisma.ts` — Prisma client cast
- `apps/web/src/lib/shopping-intent.ts` — `ProductCategory` comparisons, `_rank` field
- `apps/web/src/lib/system-bridge.ts` — missing `hasExternalAmplification`
- `apps/web/src/app/api/orchestrator/route.ts` — `StructuredData` type mismatch

The cleanup is tracked as Workstream A1 in `docs/implementation-plan.md` and is deferred until after the M1 demo-blockers are addressed (so the baseline cleanup does not collide with the engine changes those fixes require).

**Operational rule:** new errors are not allowed. Every change must keep the count at 98 or reduce it.

---

## 5. Image and link drift

### Catalog liveness

Retailer URLs across `apps/web/src/lib/products/*.ts` (~189 entries) decay over time. Recent confirmed cases (fixed 2026-05-09):

- Gustard X16 / R26 / X26 Pro: `gustard.cn/productinfo/<id>.html` returned non-functional pages → replaced with `gustard.com` root
- Chord Qutest Amazon: ASIN no longer resolved → entry removed
- Line Magnetic: `line-magnetic.com` redirects to a French parking page ("Page d'accueil À vendre") on both HTTP and HTTPS → replaced with `line-magnetic.eu` root
- WLM: `wiener-lautsprecher-manufaktur.com` HTTPS port 443 refused → kept HTTP intentionally
- Hornshoppe: HTTP → HTTPS confirmed working → upgraded

**Outstanding HTTP-only URLs (not upgraded):**
- WLM (`http://www.wiener-lautsprecher-manufaktur.com/en-speaker`) — HTTPS unsupported by server

### Image coverage

Approximately 94% of catalog entries have image overlays as of the last documented push. New entries can ship without overlays, silently dropping coverage. Diacritic stripping (e.g. `Frérot` → `fr rot`) and hyphen/space variations have caused stealth misses; new overlay map entries should be verified against both normalised and original spellings.

### No automated audit

There is no scheduled job or CI check for either link liveness or image coverage. Both are caught by manual QA passes today.

---

## 6. Affiliate implementation status

The current state, in detail:

- **No affiliate tags are wired in any retailer URL.** Catalog Amazon entries use canonical `amazon.com/dp/<ASIN>` form with no `tag=` parameter. Other retailer URLs are direct manufacturer / dealer pages.
- **The Footer disclosure copy** at `apps/web/src/components/Footer.tsx` line 60–63 reads: *"Audio XX may earn commissions from qualifying purchases as an Amazon Associate. This does not affect our recommendations."* This is forward-looking — the system does not currently participate in any affiliate programme.
- **The README** at the repository root carries an "Affiliate and Outbound Links Policy" section with similar forward-looking framing.

The misalignment is between current code state (no affiliate participation) and disclosure copy (claims affiliate participation). Three resolution paths:

1. Soften the disclosure to "may earn in the future..." until affiliate is actually wired.
2. Wire affiliate participation, audit ranking integrity (recommendations must not change), and document the integration.
3. Remove the disclosure entirely until needed.

The full policy framework lives in [`AFFILIATE_POLICY.md`](AFFILIATE_POLICY.md). Until that policy is implemented in code, the disclosure copy should be aligned with current reality.

---

## 7. QA gaps

### No behavioural-regression harness

Specified in `docs/implementation-plan.md` Workstream A8. Not yet built. Target file: `apps/web/src/lib/__tests__/behavioral-regression.test.ts`. Canonical prompts are listed in [`QA.md`](QA.md) § 2.

Without this harness, every advisory engine fix carries an unmeasured regression risk. The recommendation is to build the harness *before* burning down the M1 misalignments.

### No CI/CD pipeline

GitHub Actions, branch protection, automated typecheck/test/lint gates, and pre-commit hooks are all unspecified beyond the plan. Workstreams A4 and A5.

### No automated link or image audit

See § 5 above.

### No mobile-specific QA

Workspace rails hide below 1024px viewport via media query. Beyond that, mobile behaviour has not been formally walked. Edge cases (long messages, touch interactions, narrow-viewport hero layout) are uncatalogued.

### No formal end-to-end test path

Playwright is installed (`@playwright/test ^1.59.1` in devDependencies) but there are no Playwright tests in the repo. Adding even a single happy-path E2E test (sign-in → query → response renders) would catch a class of regressions that unit tests miss.

---

## 8. Unresolved architectural questions

These are genuinely open. None of them have been decided; documenting them here so a new technical steward can inherit the decision space honestly.

### Should the workspace rails mount on every route?

Today they mount only on `/`. Pros of expanding: active-state highlighting on left-rail items becomes meaningful; right rail context (LISTENER / SYSTEM / RECENT) follows the user across the workspace. Cons: requires moving mounting from `apps/web/src/app/page.tsx` into `app/layout.tsx`; the responsive grid wrapper would need to live in layout; some secondary pages may not benefit from rails.

### Should `/systems` and `/systems/saved` be unified?

Two flows, two data sources, no documented consolidation path. The Prisma flow predates the SavedSystemsPanel; both have known users (Prisma flow is auth-required, SavedSystemsPanel is local-only). A merge could break either.

### Should the engine be extracted into a workspace package now or after stabilisation?

`docs/implementation-plan.md` Workstream B sequences this carefully: B1/B2 (audit + skeleton) are low-risk and can run now; B3 (module relocation) should wait for A6 (advisory misalignment burndown), A7 (confidence semantics lock), and B0 (evidence lineage primitive). The dependency order is intentional but the timing remains an open call.

### LLM overlay scope

Scaffolding exists at `apps/web/src/app/api/memo-overlay/`. The runtime call is not wired. The intended scope (handle unknown products, general-knowledge questions, non-advisory intents) is documented in `ROADMAP-SPEAKS-FOR-ITSELF.md`. The boundary between deterministic core and LLM overlay needs to be drawn explicitly: which inputs trigger the overlay, how confidence is reconciled, what the fallback path is when the LLM call fails.

### Confidence semantics lock

`'high' | 'medium' | 'low' | 'insufficient'` semantics are described in `docs/implementation-plan.md` Workstream A7 but not enforced. Each engine consumer of `confidence` could currently assert different semantics. Locking this is a prerequisite for engine extraction.

### Evidence lineage primitive

`docs/implementation-plan.md` Workstream B0 specifies adding `evidence: Array<{source, contribution, weight}>` and `assumptions: Array<{what, default, reason}>` fields to advisory output. Required for explainability, particularly for any future government / enterprise consumer (Climate Screen). Not yet implemented.

### Reset surfaces consolidation

Four reset paths exist on `/`: main column accent rule, main column wordmark h1, left rail accent rule, "Start over" button below the input. Plus a layout-level `StartOverBar` that mounts on every route with different reset semantics (clears system state and storage). Functionally these overlap in confusing ways. No consolidation is in progress.

---

## 9. Documentation conflicts to consolidate

A short list of places where existing documentation may conflict with current code state and should be reconciled in a future pass:

- **README "Affiliate and Outbound Links Policy"** vs. current code state — see § 6 above.
- **`MEMORY.md` rule count** — references "14 rules" in `packages/rules`. Actual count is 19 (`grep -c "^  - id:" packages/rules/rules.yaml`). Update when convenient.
- **Rule file structure** — `MEMORY.md` references "14 rules" as if they are separate files; they are entries in a single `rules.yaml`.
- **`docs/implementation-plan.md` schedule** — targets in the plan reference "Early April / Mid-April / Late April" etc. The actual current date (2026-05-09) is past most of those targets. The plan needs a calendar refresh; the priorities and dependency order remain valid.
- **`README.md` Architecture section** — describes the "9-section system review structure." This refers to the system-assessment renderer and is accurate; mentioning here only because a reader could conflate it with the workspace 3-column architecture (`docs/ARCHITECTURE.md` § 11).

---

## 10. How to triage a new issue

When a new issue surfaces:

1. **Reproduce.** Confirm the symptom with exact inputs.
2. **Categorise** against the lists above:
   - Is it one of the 8 advisory misalignments (§ 1)?
   - Is it a known persistence/routing/typecheck gap (§ 2–4)?
   - Is it a new finding?
3. **For new findings:** add an entry here with severity classification, then file a fix plan per the conventions in [`CLAUDE_WORKFLOW.md`](CLAUDE_WORKFLOW.md) § 3.
4. **For known findings:** check whether a fix is in progress; if not, prioritise against the roadmap in [`ROADMAP.md`](ROADMAP.md).

Treat this document as additive — issues are added when discovered and removed only when they are confirmed fixed (with a regression test in place).
