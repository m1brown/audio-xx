# Gate 1 — Functional Product QA · Report

Date: 2026-07-24 · Baseline: 25e83a3 (+ this gate's fix) · Environment: local dev (anonymous session)

## Recommendation: **PASS WITH MINOR ISSUES**

One S1 defect found and fixed with a regression test. Zero S0. All three
manual journeys completed and evidenced. All automated suites green.

## Automated results

| Check | Result | Evidence |
|---|---|---|
| Product suite | 80/80 (pre-fix) → 83/83 (with new print-chrome pins) | product-suite.txt |
| Engine gate | 3,844 passed · 0 regressions (20 known-failing baseline unchanged) | engine-gate.txt |
| Production build | Compiled successfully; all routes present | build.txt |

## Manual journeys

**A — anonymous builder → artifact → share → print.** Homepage renders
signed-out. Builder accepted Chord Qutest / Naim SuperNait 3 / Harbeth
Super HL5 Plus → artifact at a stable shareable URL
(`/artifact?system=…`). Verdict "Nothing here needs changing." with
correct component credits. Copy link verified to copy exactly that URL
(instrumented `clipboard.writeText`; button flips to "Link copied").
Opening the copied URL in a fresh tab rendered the identical artifact.
`?print=1` view mounts no action buttons. **PASS** (with G1-D1 below).

**B — anonymous composer → assessment → first follow-up.** Free-text
"Assess my system: Bluesound Node, Rega Brio, KEF LS50 Meta" produced
the embedded assessment; follow-up "Would adding a subwoofer help this
system?" answered in context, opening with the user's actual chain
("Your system: Bluesound NODE → KEF LS50 Meta → Rega") and grounding the
answer in the LS50 Meta's bass limits. No empty turn. **PASS.**

**C — garbage input → recovery.** `?system=asdf qwerty zzz` produced the
editorial failure notice ("I couldn't read that as a system — an
assessment needs at least two named components…") with a working "Build
your system →" recovery link. No dead end. **PASS.**

Also verified: `?case=flawed` preset renders end-to-end; `/definitely-not-a-page`
returns HTTP 404 with the editorial page ("This page isn't in the collection.").

## Defects

**G1-D1 (S1, FIXED)** — *Printed assessment included site chrome.* The
global nav and the floating "Start Over" bar had no `@media print`
rules, so a user printing an assessment (a core "keep, print, share"
deliverable) got navigation links and a UI button on paper. Not S0: no
data wrong, no journey blocked — but a first-time visitor printing their
assessment would notice and think less of it. Fix: print-media rule in
`globals.css` hiding `nav` and `.audioxx-global-startover`. Regression
test: `apps/web/src/product/__tests__/print-chrome.test.ts` (3 tests)
pins that every `@media print` exclusion (nav, Start Over, artifact
actions, follow-up) exists. Suite re-run green.

## Observations logged for later gates (not Gate 1 defects)

- **→ Gate 6:** composer assessment for the Bluesound/Rega/KEF system
  showed (a) standfirst "Tonally warm system" vs evidence lede "built
  for resolution and speed" tension; (b) "Rega Brio" credited as brand-only
  "Rega"; (c) recommendation line "I'd start with the system." following
  a nothing-needs-changing verdict. All content-quality items in Gate 6's
  scope; recorded for its ~30-system review.
- **By design:** the artifact's component image row omits cells with no
  catalog image (Harbeth had none) rather than showing broken images.

## Environmental notes (not product defects)

- Running `next build` while the dev server shares `.next` corrupted the
  dev chunk cache (unstyled header); resolved by restarting the dev
  server. Certification practice going forward: stop the dev server
  before production builds.
- The dev server dropped once mid-gate and was restarted; no product
  implication (local tooling).
- Browser-pane clipboard read is sandboxed; copy-link verification used
  an instrumented `writeText` wrapper instead.

## Evidence files

`product-suite.txt`, `engine-gate.txt`, `build.txt`,
`01-homepage.png`, `02-artifact-builder.png`, `03-artifact-failure.png`,
`04-404.png`, `05-artifact-preset-flawed.png`.

## Cleanup

Anonymous flows only — no accounts or saved systems created. The
composer conversation exists only in local browser state.

## Sign-off criterion

Three journeys evidenced clean; zero open S0 in scope. **Awaiting
founder sign-off.**
