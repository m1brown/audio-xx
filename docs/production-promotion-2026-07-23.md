# Milestones 3–4 Production Promotion Report

**Date:** 2026-07-23 · Task: promote assessment history (M3) + launch polish (M4), verify, stop. No billing work performed.

## Release

| | |
|---|---|
| Prior production commit | `d8ea67b` (M2 baseline, promoted 22 July) |
| Deployed commit | **`de13f5a`** — confirmed pre-deploy (HEAD = `version-b` = `origin/version-b`, clean tree, zero commits above approved) and **from the live application**: a snapshot created through the product records `engine de13f5a` |
| Deployment | `audio-xx-q9y15haep` · Ready ~13:55 CEST 23 July · project `audio-xx-web` |
| Production URL | `https://audio-xx.com` — apex and `www` aliases both confirmed on the new deployment |
| Database | **No schema change required** (zero schema diff `d8ea67b → de13f5a`); M2 snapshot schema confirmed present; connectivity verified; pre-test state recorded (2 users · 3 systems · 0 snapshots) |

No new secrets, external services, or Stripe dependency (grep-verified zero Stripe references).

## Automated gates at `de13f5a`

| Gate | Result |
|---|---|
| Product suite (incl. metadata + history + persistence tests) | **41/41 passing** |
| Engine regression | **3,805 passing · 20 pre-existing baselined · 0 new** |
| Production build (`prisma generate && next build`, includes type-check) | ✅ compiled |
| Lint | `next lint` has never been configured in this repository (pre-existing; interactive setup prompt) — the build's type-check is the repo's static gate. Not a new failure. |
| Environment warnings | Vercel Node 20 deprecation notice (existing; engines bump due before 2026-10-01, on the checklist) |

*Erratum corrected in docs: earlier M3/M4 reports overstated the product-suite count (49/51); correct totals are 39 (M3) and 41 (M4), now fixed.*

## Milestone 3 live acceptance (audio-xx.com, test account `prod-gate-test@audio-xx.com`)

| Check | Result |
|---|---|
| Saved-system page (name, notes, chain, "in your collection since") | ✅ |
| Latest assessment visual priority (accent label, verdict headline, date + engine) | ✅ |
| Assessment history newest-first with counts | ✅ ("Assessment history · 2/3 assessments") |
| Earlier assessment renders exactly as saved (fixture verdict byte-intact) with banner + "Read the latest →" + System & history navigation | ✅ |
| Changed reassessment: exactly one entry appended (1→2), no second system | ✅ |
| Identical reassessment: `identical: true`, explicit rule applied, history untouched, same system returned | ✅ |
| Name + notes preserved through appends ("M34 Gate Rig" + notes survived) | ✅ |
| Corrupted history (controlled test row): entry degrades with the editorial notice, other entries intact, direct corrupt-snapshot URL shows graceful notice + back navigation, no crash | ✅ |
| Mobile 375 px history flow (system page, controls reachable, no overflow) | ✅ |

## Milestone 4 live acceptance

| Check | Result |
|---|---|
| Metadata (raw page source): homepage title/OG; artifact title = verdict; OG title/description/url/type; description = standfirst + chain | ✅ |
| **Privacy boundary** | ✅ — public artifact source contains **zero** occurrences of the private system name or notes; signed-out requests for `/systems/[id]` and its assessments → 307 to sign-in with no name/verdict/date leak; `/systems`, `/save`, sign-in all `noindex` |
| Single engine execution for metadata + page | ✅ — artifact TTFB 179 ms / 191 ms total (React-cache dedupe) |
| Builder: arrow-key nav (`aria-activedescendant`), Enter select, 44 px targets, "Preparing your assessment…" pending + disabled (no double submit, no dead click) | ✅ |
| Images: working photos render; no broken frames on the live Bifrost artifact; onError + pre-hydration mount check in place; print coherent without images | ✅ |
| Auth: editorial sign-in on the production domain; return path to My Systems; "My Systems" nav label | ✅ |
| Accessibility: accent `:focus-visible` rule live; combobox semantics; labeled fields; contrast unchanged | ✅ |
| Mobile 375 px: landing, builder, assessment, sign-in, My Systems, system history, historical view — no overflow | ✅ |
| Print/sharing: `?print=1` chrome-free; copied assessment links render for a session-less client (curl) | ✅ |
| Stability: no repeated production exceptions observed during acceptance; no console errors of note | ✅ |

## Test data & cleanup

Both test systems deleted through the product API (200s); cascades verified. **Post-cleanup database exactly matches pre-test state: 2 users · 3 systems · 0 snapshots.** The inert, clearly-named `prod-gate-test@audio-xx.com` account remains (no account-deletion endpoint exists — known, unchanged from the M2 gate).

## Issues

- **Deployment-specific fixes: none required.** No rollback conditions encountered.
- Known limitations carried forward (unchanged): no account deletion endpoint; Node 24 engines bump due before Oct 1; Sentry wiring unverified; `next lint` unconfigured.
- **Founder manual check remaining: none required** — the full signed-in journey ran on the production domain with the test account.

## Recommendation

**Production approved — ready to begin Milestone 5 billing.**
