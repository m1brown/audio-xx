# Audio XX → Climate Screen — Strategic Briefing

**Last updated:** 2026-05-06
**Owner:** Mike Brown
**Purpose:** Self-contained context for collaborators (including AI assistants). Paste the whole document into a fresh thread to brief a new helper.

---

## Project context

Two products. Audio XX is in late-stage development; Project Climate Screen ("CS") will start once Audio XX is shareable.

**Audio XX**
- Repo: `/Users/mikebrown/audio-xx/audio-xx/` (Next.js app at `apps/web/`)
- Stack: Next.js 14+, TypeScript, Prisma + Postgres, NextAuth, React (no separate state lib — useReducer + Context)
- Audience: enthusiast individual hi-fi listeners
- Status: pre-1.0; targeting friends-shareable prototype ~2026-05-08, audio-journalist outreach in late May 2026
- Distinctive asset: a structured **decision-quality reasoning engine** with a strict engine-vs-domain boundary (see `apps/web/CLAUDE.md`). Modules like `tradeoff-assessment`, `preference-protection`, `inference-layer`, `decision-frame`, `engine`, and confidence-calibration primitives are deliberately domain-agnostic.

**Project Climate Screen (next)**
- Audience: government and enterprise users
- Will reuse the Audio XX reasoning engine as a portable package
- Has compliance and procurement requirements Audio XX does not (SOC 2, likely FedRAMP/StateRAMP, Section 508, GDPR)

---

## Strategic decisions

1. **Audio XX stays a consumer product.** No enterprise-ization. The audience is individuals, not orgs.
2. **Audio XX gets a minimal "friends-shareable" lift before public sharing** (~2 days). Strip debug logs, wire production-only Sentry, sanity-check top user paths, set up access (Vercel preview / password gate / invite list).
3. **Reasoning engine extracted into a portable package while Audio XX is still its only consumer** — but staged: structural relocation now (cheap), API freeze later (after behavior stabilizes).
4. **CS gets enterprise/government foundations from day 0**, not day 60. Identity, multi-tenancy, audit log, observability, accessibility — all built in before any domain code.

---

## Lessons Audio XX is teaching — KEEP for CS

- **Engine vs. domain-adapter boundary as a non-negotiable architectural rule.** The "Climate Screen test" check ("could this logic run unchanged in Climate Screen?") in CLAUDE.md is the single most valuable line in the spec.
- **CLAUDE.md as a real architectural spec** encoding invariants, constraint hierarchies, and quality bars — not a vibes doc.
- **Structured advisory output:** `whyFitsSystem`, `likelyImprovements`, `tradeOffs`, `goalAlignment`, `recommendation`. Same shape transfers to CS with different domain types.
- **Restraint as a first-class outcome.** "Do nothing is a valid path" matters even more in climate decisions where stakes are millions of dollars and regulatory exposure.
- **Confidence calibration.** "Language strength must match source quality" is the deepest principle in the system — and a regulatory shield in CS where output is read by auditors.
- **Trade-off discipline.** Every recommendation explicitly names what improves AND what compromises.
- **Evidence lineage and assumption tracking** as first-class output. Every recommendation carries a list of contributing signals/rules/data points with weights, and a list of assumptions made when data was missing. Audio XX renders this behind a disclosure ("why did you say that?"); Climate Screen treats it as a primary surface for auditors.

---

## Lessons Audio XX is teaching — DO DIFFERENTLY in CS

- **Identity from commit 1.** Audio XX bolted NextAuth on later; the guest-vs-authenticated reconciliation logic is brittle as a result. CS uses SSO/SAML (WorkOS, Auth0, or Stytch) with org→user→role hierarchy from the start.
- **Postgres + Row-Level Security as the source of truth from commit 1.** No localStorage of substantive data ever, only ephemeral UI state. Audio XX has overlapping localStorage / sessionStorage / NextAuth-profile / Prisma layers — debt that won't be repeated.
- **Multi-tenancy from commit 1.** Every row has `org_id`. Every query filtered by session org. Retrofitting multi-tenancy is the most painful refactor in enterprise SaaS.
- **Audit log table from commit 1.** Append-only, immutable. Every state change writes one row. Required for SOC 2 / FedRAMP and useless if added late.
- **CI as a hard gate from commit 1.** Typecheck + lint + tests + dependency audit + secret scanner + SAST. PRs blocked on red. Audio XX has accumulated TS errors and debug `console.log`s because the gate isn't enforced.
- **Structured logging from commit 1.** Real logger (pino, winston, platform standard) with log levels — never `console.log`.
- **Section 508 / WCAG 2.1 AA from week 1.** axe-core in CI; keyboard-only nav; weekly screen-reader checks. Government procurement asks for a VPAT.
- **Compliance scaffold (Vanta or Drata) before code.** SOC 2 Type 2 needs ~6 months of evidence — start the clock early.

---

## Day-0 Commitments for Climate Screen

Read this list before writing the first line of CS code. Each entry is a **non-negotiable** — violating it is the kind of decision that costs months later.

1. **No code lands before C1, C2, C3 are answered.** CLAUDE.md skeleton, cloud + compliance posture, identity provider — decisions in writing, not in heads.
2. **First commit on `main` includes:** repo scaffold, `tsconfig`, `eslint`, `prettier`, **CI workflow with all gates green** (typecheck, lint, test, dependency audit, secret scan), and a passing smoke test. CI exists *before* feature code.
3. **Identity before UI.** WorkOS / Auth0 / Stytch wired and proving SSO + SCIM roundtrip before any user-facing screen exists. Org → User → Role schema in Postgres on day 1.
4. **Postgres + RLS from the schema's first table.** Every table has `org_id`. Every query goes through a per-session role that RLS enforces. No application-layer "remember to filter by org" code.
5. **Audit log from the schema's first migration.** `audit_events (id, org_id, actor_id, action, target_type, target_id, payload_json, created_at)`. Append-only. Every state change writes a row.
6. **Structured logger from day 1.** `pino` (or platform equivalent) with JSON output, log levels, and request-scoped correlation IDs. No `console.log` in production paths, ever. ESLint rule banning it from the start.
7. **No localStorage of substantive data, ever.** Use it only for ephemeral UI state (panel collapsed, last-viewed tab). Anything an auditor would want to see lives in Postgres.
8. **Compliance scaffold signed up week 1.** Vanta or Drata. SOC 2 Type 2 evidence collection runs in the background for ~6 months — start the clock immediately.
9. **Accessibility is a CI gate from week 1.** axe-core integrated into the test suite. Keyboard-only nav verified by hand. Section 508 / WCAG 2.1 AA is procurement-blocking for cities and federal — it's table stakes, not a polish phase.
10. **No new dependency without flagging the choice and one alternative.** Dependency sprawl in a single-founder enterprise codebase is fatal. Each new package gets a one-line justification in the PR description.
11. **Reasoning engine consumed as a published package** (`@audioxx/decision-engine` or its successor name). CS does not copy-paste engine code from Audio XX. The package boundary is the contract.
12. **Provenance and evidence are first-class output**, not an afterthought. Every recommendation surfaces evidence lineage and stated assumptions. Auditors will read this surface.
13. **Vercel commercial is fine for cities-first launch; revisit GovCloud / Azure Government when a customer pulls in federal scope.** Don't pre-optimize for FedRAMP High when you're targeting cities.
14. **One PR per concern.** Same surgical discipline as Audio XX, enforced harder. Reviewer fatigue is a real risk when you're the only reviewer.

If any of these gets compromised, the right move is to stop and re-evaluate — not to push through. The cost of fixing them later compounds quadratically.

---

## Working norms with the AI assistant

I work in single-file or single-feature increments. Preferred:
- Surgical edits over rewrites
- Exact diffs and file paths over prose summaries
- Acceptance criteria stated upfront
- "What's the smallest safe change?" as the default question
- Explicit scope (this file only, not adjacent ones)

When asked for help, please:
- Treat the engine modules above as portable; flag any cross-domain leakage
- Treat the CLAUDE.md spec as authoritative on tone and behavior
- Surface unintended scope expansion before doing it
- Match existing code style; don't refactor unrelated code
- Filter the 80% validation, surface the 20% concrete additions

---

## PM agent (audio-xx-pm-brief)

A scheduled remote routine writes a daily PM brief to `docs/daily-briefs/`.

| Field | Value |
|---|---|
| Routine ID | `trig_01AXbHsFTCAu8z6UqbSiNU47` |
| Cron | `0 6 * * 1-5` UTC (8am Paris during CEST, 7am Paris during CET) |
| Repo | `github.com/m1brown/audio-xx` (main branch) |
| Output | `docs/daily-briefs/YYYY-MM-DD.md` + updated `docs/daily-briefs/INDEX.md`, committed to `main` |
| Email | deferred — Gmail connector is attached but `permitted_tools` is empty; enable by updating the routine prompt + connector permissions |
| Console URL | `https://claude.ai/code/routines/trig_01AXbHsFTCAu8z6UqbSiNU47` |

### How to call it on-demand

Tell Claude in any session: **"Run the PM brief now."** Claude invokes:
```
RemoteTrigger { action: "run", trigger_id: "trig_01AXbHsFTCAu8z6UqbSiNU47" }
```

Or click "Run now" on the routine page in the Anthropic console.

### How to pause / disable

Tell Claude: **"Disable the PM brief routine."** Or in the console, toggle `enabled: false`.

### How to update

Tell Claude: **"Update the PM brief — [what to change]."** Common changes:
- Adjust the cron when DST flips (October → `0 7 * * 1-5`)
- Add the email-send step once Gmail tools are permitted on the routine
- Tighten or loosen the brief format

### When DST flips

- **Late October 2026:** CET resumes. The current cron fires at 7am Paris instead of 8am. Update to `0 7 * * 1-5` to keep 8am Paris.
- **Late March 2027:** CEST resumes. Revert to `0 6 * * 1-5`.
- The agent is instructed to flag this in the relevant week's brief so you don't miss it.

---

## Decision log (append entries with date)

| Date | Decision | Reasoning |
|---|---|---|
| 2026-05-06 | Audio XX stays consumer, 2-day polish then pivot to CS | Foundation tier (3-4 weeks) is sized for public launch, not friends. Friends-shareable bar is much lower; full lift would delay CS without serving the consumer audience. |
| 2026-05-06 | Engine extraction staged: B1/B2 now, B3 after misalignment burndown | Structural relocation is low risk; API freeze should wait until advisory object model stabilizes (8 known misalignments are reshaping it). |
| 2026-05-06 | Provenance/evidence-lineage primitive added to engine before B3 | Every engine module touches recommendation construction; threading evidence through is dramatically cheaper now (one consumer, one author) than later. |
| _next entry_ | _cloud + compliance posture (C2)_ | _to be decided week 1 of CS_ |
| _next entry_ | _identity provider (C3)_ | _to be decided week 1 of CS_ |
