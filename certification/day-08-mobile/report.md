# Gate 8 — Mobile, Browser, Accessibility & Performance · Report

Date: 2026-07-25 · Baseline: bbef3ef · Method: live viewport sweep in the
in-app Chromium (375 / 768 / 1280) across the core surfaces (landing, artifact,
sign-in, systems), plus a11y/DOM inspection and print-CSS verification.
Evidence: measurements.txt.

## Recommendation: **PASS WITH MINOR ISSUES**

The publication holds up on the devices audiophiles read on. No horizontal
scroll, no unusable control, no keyboard-unreachable action, clean print. No
S0/S1. Minor S2 (touch-target sizes) logged; two checks (full Lighthouse,
Safari/Firefox) are environment-limited here and deferred to the activation
production step.

## Matrix results
| # | Check | Result |
|---|---|---|
| H1 | Core journeys clean at 375 / 768 / 1280 | ✅ **0px** horizontal overflow on landing + artifact at all three widths; no over-wide elements; viewport meta correct |
| H2 | Safari + Chrome + Firefox parity | ◑ Chromium confirmed clean; standard React/Next + CSS, no browser-specific APIs; Safari/Firefox manual check at activation (env-limited) |
| H3 | Keyboard build→assess→save | ✅ action controls are native buttons/links (Print, Copy link, Save, New assessment, Follow-up); visible focus in CSS |
| H4 | Focus visible; titles/landmarks/alt | ✅ `:focus` styling; single `h1`; main/nav/header/footer landmarks; 2/2 images alt-labelled and loaded |
| H5 | Lighthouse mobile: artifact ≥50 perf, no red a11y | ◑ proxy-verified (27–33 KB HTML, no console errors, sized images → no CLS, focus/landmarks/alt present); full Lighthouse at activation (not wired here) |
| H6 | Mobile print/PDF usable | ✅ 3 `@media print` rules strip nav, start-over, follow-up, contradiction, and the actions bar → clean single-artifact document |

## Evidence highlights
- **Landing (375w):** editorial cover, full-width builder inputs, 0 overflow.
- **Artifact (375 / 768):** verdict at largest type, italic standfirst, small-caps
  credit line, 2-up component photo grid (both product images loaded), body
  prose — all within viewport, 0 overflow at every width.
- **Print CSS** hides all chrome/actions → the artifact prints as one clean spread.

## Findings by severity
| ID | Sev | Finding | Disposition |
|---|---|---|---|
| G8-D1 | S2 | Touch targets below 44px: composer Send (37px), paperclip (36px), nav/footer text links (20–24px). Usable but under the guideline. | POST_LAUNCH (a11y polish) |

**Zero S0. Zero S1.** No code changed this gate → no regression tests required.

## Environment limitations (deferred to activation, not defects)
- **H5 full Lighthouse mobile** — Lighthouse CI is not wired in this
  environment. Proxy signals are green (lightweight HTML, no console errors,
  sized images, a11y basics). Run Lighthouse on the public-launch commit
  (already a checklist item).
- **H2 Safari/Firefox** — only the in-app Chromium is drivable here. The code
  path is browser-neutral; confirm on the two other engines at the production
  walk-through.

Both are the same class as the Gate 3 server-events caveat: code-verified now,
observed end-to-end at the existing activation/production check.

## Estimated effort
Viewport sweep + a11y/DOM inspection 1.5 · print/perf checks 0.5 ·
documentation 0.5 · **~2.5h** (no fix effort).

## Launch confidence
**Increasing.** The editorial layout is genuinely responsive — zero overflow at
every tested width, correct a11y landmarks and focus, clean print, and
lightweight pages. The only findings are cosmetic touch-target sizes and two
checks that need production tooling. Nothing blocks a mobile reader.

## Sign-off criterion
Viewport sheets reviewed; no blocker; no S0. **PASS WITH MINOR ISSUES.
Awaiting founder sign-off. Do not begin Gate 9 without approval.**
