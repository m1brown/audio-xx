# Audio XX — Consolidated Launch Certification Matrix

One row per certified behavior. Gate = where it's exercised; Auto =
covered by an automated suite; Manual = requires a human journey.
Status column is filled during execution (☐ → ✅/❌+severity).

## A. Free product (Gate 1)

| # | Behavior | Auto | Manual | Status |
|---|---|---|---|---|
| A1 | Homepage renders, both entry paths visible | build | ✓ | ✅ |
| A2 | Builder → artifact for valid 2+ component system | suite | ✓ | ✅ |
| A3 | Composer → artifact for free-text system | suite | ✓ | ✅ |
| A4 | First follow-up keeps assessment context | suite | ✓ | ✅ |
| A5 | Invalid input → editorial failure, recoverable | suite | ✓ | ✅ |
| A6 | Copy link → identical artifact in fresh session | — | ✓ | ✅ |
| A7 | Print view clean (no nav/actions) | — | ✓ | ✅ (G1-D1 S1 fixed) |
| A8 | 404 editorial page | — | ✓ | ✅ |
| A9 | Engine gate green (3,844 baseline) | gate | — | ✅ |

## B. Billing & entitlement (Gate 2)

| # | Behavior | Auto | Manual | Status |
|---|---|---|---|---|
| B1 | Trial = max(createdAt, BILLING_LAUNCHED_AT)+92d, ms-exact boundary | suite | — | ✅ |
| B2 | All 10 user states resolve correctly | suite | ✓ | ✅ |
| B3 | Save/add/rename/notes gated; view/print/share/remove never | suite | ✓ | ✅ |
| B4 | Real Checkout subscribe (4242) → subscriber | — | ✓ | ✅ |
| B5 | Portal cancel → canceling, paid-through retained | suite | ✓ | ✅ |
| B6 | cancel_at (timestamp) recognized as scheduled cancel | suite | ✓ | ✅ |
| B7 | Declined card → no state change, calm return notice | — | ✓ | ✅ |
| B8 | Bad webhook signature → 400, never processed | suite | ✓ | ✅ |
| B9 | Duplicate event applied zero times | suite | — | ✅ |
| B10 | Out-of-order event never overwrites newer state | suite | — | ✅ |
| B11 | Null period-end never regresses a known one | suite | — | ✅ |
| B12 | Stripe unreachable → 503 checkout, product unaffected | — | ✓ | ✅ |
| B13 | No billing code path deletes user content | suite | — | ✅ |
| B14 | Expired user: full read + remove, calm prompt | suite | ✓ | ✅ |

## C. Analytics (Gate 3)

| # | Behavior | Auto | Manual | Status |
|---|---|---|---|---|
| C1 | Exactly the 21 canonical events; unknown names dropped | suite | — | ✅ |
| C2 | Every funnel stage emits on the real journey | — | ✓ | ✅ |
| C3 | Allowlist sanitizer: no private data can transmit | suite | ✓ | ✅ |
| C4 | View events once per load; action events every time | suite | ✓ | ✅ |
| C5 | Mount-time events queue before vendor script (regression) | — | ✓ | ✅ |
| C6 | Segmentation props correct (source/signed_in/state/action) | — | ✓ | ✅ |
| C7 | Server events (account_created, sub_activated/cancelled) fire | — | ✓ | ✅ code-verified; end-to-end at beta entry (env-limited locally) |

## D. Privacy & security (Gate 4)

| # | Behavior | Auto | Manual | Status |
|---|---|---|---|---|
| D1 | Cross-user read blocked on every route | tests | ✓ | ✅ |
| D2 | Cross-user write/delete blocked | tests | ✓ | ✅ |
| D3 | Cross-user checkout-session sync rejected | suite | ✓ | ✅ |
| D4 | No secret in client bundle | scan | — | ✅ |
| D5 | Public artifact links never expose private names/notes | tests | ✓ | ✅ |
| D6 | Auth: wrong password rejected; session expiry sane | — | ✓ | ✅ |
| D7 | No open redirect on checkout return URLs | — | ✓ | ✅ |
| D8 | No user-controllable price ID | code | ✓ | ✅ |
| D9 | Test/live key confusion impossible (prefix + env scope) | — | ✓ | ✅ |

## E. Editorial & visual (Gate 5)

| # | Behavior | Auto | Manual | Status |
|---|---|---|---|---|
| E1 | Token-lock test green; screens use editorial tokens | suite | ✓ | ✅ |
| E2 | No stub/placeholder/dev text on any customer path | — | ✓ | ✅ |
| E3 | Product naming consistent ("My Systems") everywhere incl. Stripe | — | ✓ | ✅ |
| E4 | Image failure degrades cleanly (no broken-image icons) | suite | ✓ | ✅ |
| E5 | Blocked/prompt states read calm, on-voice | — | ✓ | ✅ |
| E6 | Assessment prose: coherent, factually restrained, correctly-named | pipeline | ✓ | ✅ (G5-D1 naming fixed; no fabrication; depth → POST_LAUNCH) |

## F. Assessment quality (Gate 6)

| # | Behavior | Auto | Manual | Status |
|---|---|---|---|---|
| F1 | Benchmark rerun: ≥90% good, zero embarrassing | harness | — | ☐ |
| F2 | ~30 representative systems render defensibly | harness | ✓ | ☐ |
| F3 | No component mis-identification / cross-brand leakage | tests | ✓ | ☐ |
| F4 | Verdict never contradicts body | — | ✓ | ☐ |
| F5 | Identical re-assessment declined; changed reading appends | suite | ✓ | ☐ |

## G. Edge & destructive (Gate 7)

| # | Behavior | Auto | Manual | Status |
|---|---|---|---|---|
| G1 | Script/HTML in names & notes stored inert, rendered escaped | — | ✓ | ☐ |
| G2 | Oversized/malformed API bodies → 4xx, never 5xx | fuzz | — | ☐ |
| G3 | Double-submit save → exactly one system | suite | ✓ | ☐ |
| G4 | Stale link to removed system → graceful not-found | — | ✓ | ☐ |
| G5 | Back/forward through checkout leaves consistent state | — | ✓ | ☐ |
| G6 | Session expiry mid-action → clean re-auth, no data loss | — | ✓ | ☐ |

## H. Mobile / browsers / a11y / performance (Gate 8)

| # | Behavior | Auto | Manual | Status |
|---|---|---|---|---|
| H1 | Core journeys clean at 375w / 768w / desktop | sweep | ✓ | ☐ |
| H2 | Safari + Chrome + Firefox parity on core journeys | — | ✓ | ☐ |
| H3 | Keyboard-only completion of build→assess→save | — | ✓ | ☐ |
| H4 | Focus visible; titles/landmarks/alt basics present | — | ✓ | ☐ |
| H5 | Lighthouse mobile: artifact ≥50 perf, no red a11y | LH | — | ☐ |
| H6 | Mobile print/PDF of artifact usable | — | ✓ | ☐ |

## I. SEO / metadata / sharing / print (Gate 9)

| # | Behavior | Auto | Manual | Status |
|---|---|---|---|---|
| I1 | Artifact unfurl: verdict title + standfirst description | tests | ✓ | ☐ |
| I2 | Private pages (account, systems) noindex | tests | ✓ | ☐ |
| I3 | Public pages have title+description; no dupes | crawl | — | ☐ |
| I4 | Print-to-PDF artifact reads as editorial | — | ✓ | ☐ |
| I5 | Unfurl never leaks private names/notes | tests | ✓ | ☐ |

## J. Founder & beta (Gates 10–11)

| # | Behavior | Auto | Manual | Status |
|---|---|---|---|---|
| J1 | Founder cold-run: nothing embarrassing on core paths | — | ✓ | ☐ |
| J2 | Founder Stripe test-mode walkthrough completed | — | ✓ | ☐ |
| J3 | Sentry live-fire observed in dashboard | — | ✓ | ☐ |
| J4 | Founder locates funnel + error unaided | — | ✓ | ☐ |
| J5 | Rollback rehearsed on preview | — | ✓ | ☐ |
| J6 | All S1s dispositioned; S0 count = 0 | — | ✓ | ☐ |
| J7 | Test data swept; prod data byte-untouched | script | — | ☐ |
