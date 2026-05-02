# QA Screenshots

Automated visual QA pass for Audio XX using Playwright.

## How to run

```bash
cd apps/web

# First time only — install Chromium
npx playwright install chromium

# Start dev server (if not already running)
npm run dev

# Run the screenshot pass
npx playwright test src/tests/qa-screenshots.spec.ts
```

Screenshots land in this directory. The JSON coverage report is written to `image-coverage-report.json`.

## What each screenshot captures

| File | Flow | Description |
|------|------|-------------|
| `00-landing-page.png` | Landing | Baseline — the app before any interaction |
| `01-system-assessment-full.png` | Assessment | Full page after "Evaluate my system: Chord Hugo → JOB Integrated → WLM Diva" |
| `01-system-assessment-viewport.png` | Assessment | Above-the-fold view of the same response |
| `01-system-assessment-card-first.png` | Assessment | Close-up of the first product card |
| `01-system-assessment-cards-viewport.png` | Assessment | Viewport centered on the product cards area |
| `01-system-assessment-bottom.png` | Assessment | Bottom of page (scrolled) |
| `02-upgrade-initial-assessment.png` | Upgrade | Assessment of Schiit Bifrost → Ragnarok → KEF R3 |
| `02-upgrade-intent-full.png` | Upgrade | Response to "I want to improve my system" |
| `02-upgrade-intent-viewport.png` | Upgrade | Above-the-fold upgrade response |
| `02-upgrade-intent-card-first.png` | Upgrade | First upgrade product card |
| `03-shopping-intent-full.png` | Shopping | Response to "Best DAC under $2000 for a warm system" |
| `03-shopping-intent-card-first.png` | Shopping | First shopping recommendation card |
| `04-comparison-full.png` | Comparison | Response to "Compare Hegel H190 vs Kinki EX-M1" |
| `04-comparison-card-first.png` | Comparison | First comparison product card |
| `05-console-audit-full.png` | Audit | Full page for Chord Qutest → Pass Labs INT-25 → DeVore O/96 |

## Image coverage report

After each run, `image-coverage-report.json` contains per-flow image stats:

```json
{
  "landing-page": { "rendered": 0, "broken": 0, "missing": 0 },
  "system-assessment": { "rendered": 6, "broken": 0, "missing": 0 },
  "upgrade-intent": { "rendered": 4, "broken": 1, "missing": 0 },
  ...
}
```

### How to interpret

- **rendered** — images that loaded successfully and are visible on screen
- **broken** — images with a `src` attribute that failed to load (`naturalWidth === 0`)
- **missing** — `<img>` elements with no `src` attribute at all

### What "good" looks like

- All product cards show rendered images (rendered count matches number of product cards)
- `broken: 0` across all flows
- `missing: 0` across all flows
- Console output shows `Overall: CLEAN`

### What "bad" looks like

- Any `broken > 0` — a product image URL is dead or returning an error
- Any `missing > 0` — a product card was rendered without an image source
- Console shows `[IMAGE_BROKEN] "Hegel H190" src="..."` — tells you exactly which product and URL failed
- Console output shows `Overall: X broken, Y missing — review screenshots`

## Console output

The test prints structured logs to stdout. Key patterns:

```
[ok]            Screenshot captured successfully
[skip]          Element not found (non-critical)
[warn]          Timing issue — screenshot was taken but response may be incomplete
[FAIL]          Screenshot could not be captured
[IMAGE_BROKEN]  Specific broken image with product context and URL
[IMAGE_MISSING] Image element with no src attribute
```

## Notes

- Tests run sequentially (one at a time) — each flow gets a fresh page
- The dev server must be running on port 3000
- Each flow has up to 2 minutes to complete (LLM-backed responses can be slow)
- Screenshots are always captured even if parts of the UI fail (try/catch wrapping)
- The test never fails due to broken images — it reports them for manual review
