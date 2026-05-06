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

## Decision log (append entries with date)

| Date | Decision | Reasoning |
|---|---|---|
| 2026-05-06 | Audio XX stays consumer, 2-day polish then pivot to CS | Foundation tier (3-4 weeks) is sized for public launch, not friends. Friends-shareable bar is much lower; full lift would delay CS without serving the consumer audience. |
| 2026-05-06 | Engine extraction staged: B1/B2 now, B3 after misalignment burndown | Structural relocation is low risk; API freeze should wait until advisory object model stabilizes (8 known misalignments are reshaping it). |
| 2026-05-06 | Provenance/evidence-lineage primitive added to engine before B3 | Every engine module touches recommendation construction; threading evidence through is dramatically cheaper now (one consumer, one author) than later. |
| _next entry_ | _cloud + compliance posture (C2)_ | _to be decided week 1 of CS_ |
| _next entry_ | _identity provider (C3)_ | _to be decided week 1 of CS_ |
