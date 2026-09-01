# Gate 9 — SEO, Metadata, Sharing & Print · Report

Date: 2026-07-25 · Baseline: 68bd9a9 (+ this gate's fixes) · Method: live
metadata crawl of public + private routes, artifact-unfurl inspection,
robots/sitemap verification, print-CSS check, production build.
Evidence: metadata-evidence.txt.

## Recommendation: **PASS WITH MINOR ISSUES**

Judged as a publication: the shared assessment link unfurls as editorial, the
private surfaces are protected, and the public pages are individually
addressable. Three real SEO/publication defects found and fixed (missing
robots/sitemap; duplicate public-page titles; double-suffix legal-page titles).
Two optional enhancements (canonical tags, JSON-LD) deferred. No S0.

## The question — "would I be happy to share this with another enthusiast?"
Yes. A pasted artifact link previews with the **verdict as the title**, the
standfirst plus the component chain as the description, an absolute canonical
URL, and a Twitter summary card — and it prints as one clean editorial spread.

## Defects found & fixed
| ID | Sev | Finding | Fix |
|---|---|---|---|
| G9-D1 | S1 | **No robots.txt and no sitemap.xml** — the site shipped with neither. | Added `app/robots.ts` (crawl public, disallow private, point at sitemap) and `app/sitemap.ts` (public editorial pages only). |
| G9-D2 | S1 | **Duplicate titles** — how-it-works, glossary, resources, about, and every `tech/[slug]` + `brand/[slug]` page inherited the root title. | Per-page `metadata` on the four static pages; per-slug `generateMetadata` on the two dynamic routes (title = brand/tech name, description = its tagline). |
| G9-D3 | S1 | **Double suffix** — /privacy and /affiliate-disclosure rendered "… — Audio XX — Audio XX" (hardcoded suffix + template). | Titles trimmed to the bare page name; the root template appends "— Audio XX" once. |

All three are gate-established SEO/publication defects, cheap and safe, fixed
in-gate and pinned (robots/sitemap regression test; build typechecks the rest).

## Matrix results
| # | Check | Result |
|---|---|---|
| I1 | Artifact unfurl: verdict title + standfirst description | ✅ og:title = verdict, og:description = standfirst + credit, og:type article, absolute og:url, twitter summary |
| I2 | Private pages (account, systems, save, signin) noindex | ✅ all `robots: noindex` |
| I3 | Public pages have title+description; no dupes | ✅ (after G9-D2/D3 fixes) — every public route now has a distinct title |
| I4 | Print-to-PDF artifact reads as editorial | ✅ 3 `@media print` rules strip chrome/actions → clean single-artifact spread |
| I5 | Unfurl never leaks private names/notes | ✅ by construction — the artifact + its metadata are generated from the URL's system text, never from saved rows |

## Deferred (optional enhancements → POST_LAUNCH, not defects)
- **Canonical `<link rel="canonical">`** — `metadataBase` + per-artifact
  `og:url` cover sharing; explicit canonical tags across pages are a
  nice-to-have (low duplicate-content risk, artifact URLs are unique).
- **Structured data (JSON-LD)** — an `Article`/`Review` schema on the artifact
  could enrich results; not present, optional.

## Automated results
- New `seo-metadata.test.ts`: robots allows crawl + points at sitemap +
  disallows every private surface; sitemap lists the public pages and never a
  private one — 4/4.
- Engine regression gate: **PASSED, 0 regressions**.
- Product suite: 84/84.
- Production build: **EXIT 0** (robots/sitemap emit as static routes; all
  generateMetadata typechecks).

## Estimated effort
Metadata audit + unfurl checks 1.0 · fixes (robots, sitemap, 6 page titles,
2 legal titles) 1.0 · regression test + build 0.5 · documentation 0.5 · **~3h**.

## Launch confidence
**Increasing.** This is the acquisition-loop gate, and it now behaves like a
publication platform: every public page is individually titled and crawlable,
private surfaces are excluded at both robots and per-page level, and a shared
assessment unfurls and prints as editorial. The remaining items are optional
enrichments, not blockers.

## Sign-off criterion
Unfurl + noindex matrix complete; robots + sitemap present and private-safe;
no private page indexable; no unfurl leak; artifact links stable. **PASS WITH
MINOR ISSUES. Awaiting founder sign-off. Do not begin Gate 10 without approval.**
