# Audio XXI — Automated regression workflow

Eliminates manual browser QA after engine changes. Two complementary tiers,
both driven by the same fixture suite (`apps/web/src/qa/fixtures.ts`):

| Tier | What it proves | Speed | Determinism |
|---|---|---|---|
| **A — Engine text** (`scripts/qa-regression.mts`) | The assessment / recommendation / bottleneck / upgrade-path **content** is unchanged | sub-second × N | 100% (pure engine, no LLM, no browser) |
| **B — Visual** (`src/tests/visual-regression.spec.ts`) | The content still **renders** without layout breakage | ~30–90s × N | pixel-diff with tolerance |

Tier A is the primary signal and scales to hundreds of systems. Tier B is the
layout safety net for a representative subset.

## Commands (run from repo root)

```bash
npm run qa:regress           # Tier A: capture + diff vs baseline + write report
npm run qa:regress -- --fail-on-change   # same, but exit 1 if anything changed (CI gate)
npm run qa:baseline          # Tier A: (re)write the baseline after an INTENDED change
npm run qa:regress:visual    # Tier B: visual pixel-diff vs PNG baselines
npm run qa:regress:visual -- --update-snapshots   # adopt intended UI changes
npm run qa:regress:all       # Tier A then Tier B
```

Typical loop after an engine change:
1. `npm run qa:regress` → read the report; it lists ONLY meaningful changes.
2. If the changes are intended → `npm run qa:baseline` and commit the baseline.
3. If unexpected → investigate before merging.

## Layout

```
qa-regression/
  baseline/
    engine/<fixture-id>.json     # committed Tier-A baselines
    visual/<fixture-id>.png      # committed Tier-B baselines
  runs/                          # gitignored, timestamped
    <ISO-timestamp>/
      engine/<fixture-id>.json   # this run's captures
      report.md                  # human report (only meaningful diffs)
      report.json                # machine report
    visual/                      # Playwright diff/actual PNGs on failure
```

## Adding systems

Append one entry to `apps/web/src/qa/fixtures.ts` and run `npm run qa:baseline`.
The suite is designed to grow to dozens/hundreds without touching the runner.
An unresolved system text is itself flagged as a regression.

## Notes

- **Visual baselines are environment-specific.** Font anti-aliasing differs
  across OS, so PNG baselines generated on macOS may not match a Linux CI box.
  Generate/refresh them on the machine that will run the checks
  (`npm run qa:regress:visual -- --update-snapshots`). The engine tier (A) has
  no such constraint — its JSON baselines are portable.
- The committed visual baseline currently covers `homepage`; the per-fixture
  visual baselines are written on the first `qa:regress:visual` run in your
  environment (Playwright writes them and fails that first run by design).
- No AI evaluation — pure reproducible capture + exact structural comparison.
- Tier A reads engine output directly because the rendered text is a
  deterministic function of it; the only client-side nondeterminism (the A3
  Character overlay) is cosmetic and disabled for Tier B capture.
