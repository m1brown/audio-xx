# QA Architecture — Four Release Gates

Status: **governing** · Established: Stabilization Gate 1 (2026-07-30) · Owner: engine/product
Extended by: **Engineering Operating Doctrine v1** (2026-07-30) — severity model,
root-cause report format, release vocabulary, escape analysis (§ below).

Roles: founder = product owner · Claude = implementation engineer, QA lead,
release manager · ChatGPT = architectural reviewer, final release reviewer.
The product owner should not have to discover regressions manually.

Audio XX is live. The objective of QA is no longer proving the engine correct —
it is ensuring **every release preserves the product itself**. A passing
unit-test count is not sufficient evidence that the product is ready: the
routing envelope shipped with 4,020 green tests while the Tonal Signature graph
was missing from two of three assessment surfaces. Engine tests protect engine
correctness; these gates protect what the customer sees.

## The four gates

**No production release is complete until all four gates pass.**

Runner: `node scripts/release-gate.mjs` (repo root). Add `--visual` to run the
Playwright tier against a local server; without it, C-visual/D report DEFERRED
and the release report must carry visual evidence from a manual run.

| Gate | What it protects | How it runs |
|---|---|---|
| **A — Engine** | Engine correctness (units, integration, advisory prose rules) vs the trusted baseline | `node scripts/test-gate.mjs` |
| **B — Routing** | The licensed-category invariant — the system answers the question actually asked | `routing-matrix.test.ts` + `requested-category-constraint.test.ts` + `validate-shopping-answer.test.ts` |
| **C — Artifact** | The Assessment as a contractual artifact: structure + visual integrity | Structural: `assessment-artifact-contract.test.ts`, `assessment-artifact-ia-order.test.ts`. Visual: Playwright `Gate C` block in `visual-regression.spec.ts` (graph visible desktop + mobile, pixel baseline) |
| **D — UX** | Homepage, builder, assessment, recommendation, comparison — desktop + mobile | Playwright `Gate D` block (7 widths: 1440/1280/1024/320/360/390/414 — overflow, clipped controls, blank regions, builder discoverability, pixel baselines) + existing per-fixture chat captures |

## The Assessment contract (Gate C)

Every completed Assessment must contain — structurally required, not stylistic:
resolved system · component imagery · hero verdict · tonal summary ·
**three-axis Tonal Signature graph** (Warm↔Bright, Smooth↔Detailed,
Elastic↔Controlled; `airy_closed` is never plotted) · Recognition ·
Recommendation · Engineering · provenance statement · Primary Sources (when
applicable) · no empty educational blocks · no duplicated sections.

**Data invariant behind the graph** (the regression this gate exists for): the
tonal axes must travel **in the `ArtifactPayload` itself** (`systemAxes`),
never only in the raw engine result. Any surface that renders from the payload
alone — the chat embed, saved snapshots — must still produce the graph.
`toCanonicalAssessment` reads `raw.findings.systemAxes ?? payload.systemAxes`.

## Gate D checklist (homepage/builder)

At every required width: no horizontal overflow · no clipped controls · no
excessive blank region (>300px between content blocks pre-assessment; the
artifact's 60vh follow-up separator is deliberate design, not a defect) ·
builder fields visible · add-component flow visible · assess CTA present ·
free-text path present.

## Visual baselines

Playwright config: `apps/web/playwright.visual.config.ts` → baselines under
`apps/web/qa-regression/baseline/visual/`. First run writes the PNG; later runs
pixel-diff (1% tolerance). Adopt intended changes with
`npm run qa:regress:visual -- --update-snapshots` — adoption is a **reviewed
act**, named in the release report, never a reflex to a red diff.

## Severity model (Operating Doctrine v1)

Every issue is classified before disposition:

| Severity | Meaning | Release consequence |
|---|---|---|
| **Blocker** | Incorrect advice · broken assessment · wrong routing · corrupt graph · missing required artifact element · data loss · unsafe production behaviour | Production must not proceed |
| **Major** | Visible degradation · broken workflow · incorrect layout · missing CTA · important mobile regression | Promotion only with explicit product-owner approval |
| **Minor** | Cosmetic: spacing, typography, copy | Backlog acceptable |
| **Backlog** | Enhancement, future improvement, design exploration | Never inflated into a blocker |

## Root-cause report format (every regression)

Problem · Root cause · Affected files · **Why existing tests missed it** ·
Fix · Tests added · Residual risk · Confidence.

## Escape analysis (when a regression reaches production)

Identify: (1) why it escaped; (2) which release gate should have caught it;
(3) what new protection prevents recurrence. Improving the release process is
part of the implementation, not separate work.

## Release report standard

Every production release report must contain, in order:

1. **Engine gate** — pass/fail + counts vs baseline
2. **Routing gate** — pass/fail
3. **Artifact gate** — structural + visual, per surface (public / chat / saved)
4. **UX gate** — per width, with any deferred items named
5. **Visual evidence** — screenshots or baseline-diff results
6. **Known limitations** — explicitly listed, each with disposition
7. **Production recommendation** — with reason

…closing with the gate table:

```
| Gate    | Status | Confidence | Notes |
```

plus the **top three remaining risks**. Recommendations use ONLY:
**READY** · **READY WITH KNOWN LIMITATIONS** · **NOT READY**.
Never claim "complete" / "fixed" / "production ready" without evidence;
confidence must reflect evidence, and remaining uncertainty is stated.

## Known limitations (as of Stabilization Gate 1)

- Saved assessment snapshots created **before** the `systemAxes` payload field
  render without the graph (snapshots are immutable by design; the payload they
  stored has no axes). New saves carry the graph.
- The Playwright tier requires a local server; it does not run in the plain
  `release-gate.mjs` invocation (reported DEFERRED, never silently skipped).
- Chat-surface visual capture runs with the legacy renderer flags of local dev;
  production flag state (`NEXT_PUBLIC_ASSESSMENT_ARTIFACT_V2`) is a deployment
  concern verified at promotion, not by this tier.
