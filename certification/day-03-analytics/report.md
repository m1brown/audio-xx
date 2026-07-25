# Gate 3 — Analytics & Funnel Verification · Report

Date: 2026-07-25 · Baseline: 3c36ab3 (+ this gate's fixes) · Environment: local dev, Playwright controlled journeys (fresh context per journey, vendor-call trap capturing full payloads incl. mount-time events)

## Recommendation: **PASS WITH MINOR ISSUES**

Three S1 instrumentation defects found, fixed, regression-pinned, and
re-verified in a clean second journey pass. One S2 logged to
POST_LAUNCH.md. Zero S0. The launch questions are all answerable from
the stream.

## Pre-gate operational hygiene (founder directive, complete)

Test-mode key rotated by founder; old key confirmed dead (Stripe 401),
new key confirmed live (200) — values never displayed. Full credential
scan of tracked files + certification-era git history: clean (doc
matches are placeholder prefixes only). `scripts/credential-scan.sh`
added as a standing pre-commit rule and used for this commit. Recorded
in the launch-status operational log only.

## Expected-sequence baseline

Defined before testing in `expected-funnel.md`, reconciling the
founder's event-name table to the canonical set. Deliberate differences:
start-assessment splits into `builder_started`/`composer_started`
(answers builder-vs-composer directly); save splits into intent
(`save_started`) plus exactly one outcome event (answers first-vs-repeat
without user IDs); subscription completion is the server-side
`subscription_activated` (webhook-driven, unspoofable).

## Automated results

| Check | Result |
|---|---|
| Product suite (incl. 11 analytics tests + updated G3-D1 pin) | 84/84 |
| Engine gate | PASSED, no regressions |
| Canonical set / sanitizer / dedupe / queue-stub | suite-pinned |

## Controlled journeys — final verification pass (journey-streams.json)

| Journey | Captured stream | Verdict |
|---|---|---|
| J1 anonymous builder | landing_viewed → builder_started → assessment_rendered{builder, signed_in:false} → copy_link_clicked (+ real clipboard write of the exact share URL) → print_clicked (+ window.print) → save_started{signed_in:false} → /save | ✅ exact match |
| J2 anonymous composer | landing_viewed → composer_started → **assessment_rendered{composer}** | ✅ (G3-D1 fix verified) |
| J3 save lifecycle | sign_in_completed{signin} → rendered{direct, signed_in:true} → save_started{true} → **first_system_saved** → (2nd) **additional_system_saved** → (same again) **identical_assessment_declined** → my_systems_viewed{state:trial} | ✅ first/repeat distinguishable |
| J4 expired boundary | my_systems_viewed{expired} → subscription_prompt_viewed{state:expired} → save_started → trial_action_blocked{save} → prompt{expired, save} → **checkout_started** → checkout_cancelled | ✅ full boundary funnel |
| J5 dedupe | one landing_viewed per page load across reloads; strict-mode double-mounts never duplicated in any journey | ✅ |
| J6 vendor unreachable (script + ingestion blocked at network) | product fully functional: artifact renders, copy works with feedback, zero page errors; events queue harmlessly | ✅ |

Launch questions → answerable: begin (builder/composer split) ✓ ·
complete (assessment_rendered by source) ✓ · copy/print/save ✓ ·
boundary encounters (prompt + blocked, state-segmented) ✓ · checkout
begins ✓ · subscriptions complete (server event; see limitation) ✓ ·
first vs returning (outcome split + my_systems_viewed) ✓ · duplicates
prevented ✓ · degradation safe ✓.

## Defects

**G3-D1 (S1, FIXED)** — *Composer completions were invisible.* The
conversation embeds the **v2** artifact (live flag), which had no
analytics; half the funnel never registered a completed assessment.
Fixed at the embed dispatch site in AdvisoryMessage (a `TrackAssessmentEmbed`
null-component beside both v2 and legacy branches → every branch
counts). Pinned in analytics.test.ts; verified live in J2.

**G3-D2 (S1, FIXED)** — *signed_in attribution absent.* `assessment_rendered`
never included it and `save_started` computed it from an unrelated
variable (always undefined). ArtifactActions now uses the real session
(emission waits for session resolution; per-load dedupe keeps it
single). Verified live: false anonymous, true signed-in.

**G3-D3 (S1, FIXED)** — *state segmentation missing.* `my_systems_viewed`
carried no `{state}` (now fired when entitlement arrives) and
`subscription_prompt_viewed` sent `{action}` instead of the spec's
`{state}` (now sends both; state threaded through all three callers,
including the artifact's blocked-save prompt from the 403 body).
Verified live in J4.

**G3-D4 (S2, logged → POST_LAUNCH)** — a save clicked within ~1s of
page load can report `signed_in:false` before the session resolves
(observed once). Intent-event imprecision only; outcomes unaffected.

## Known environment limitation (not a defect)

Server events (`account_created`, `subscription_activated`,
`subscription_cancelled`) no-op outside Vercel-hosted environments, so
they are code-verified here and observed end-to-end at the beta-entry
check "funnel readable in production" (already a required criterion).
Matrix C7 marked accordingly.

## Evidence files

`expected-funnel.md`, `journeys.mjs` (the harness), `journey-streams.json`
(full payload streams), `journey-summary.txt`, `product-suite.txt`,
`engine-gate.txt`.

## Cleanup

cert-boundary user deleted; m5-trial's journey systems removed
(fixture restored to empty collection); no Stripe objects created
(checkout session abandoned by design in J4).

## Estimated effort

| Area | Hours |
|---|---|
| Automation (harness construction + 8 iterations to de-flake) | 2.5 |
| Manual/controlled QA (journey analysis, reconciliation) | 1.0 |
| Fixes (3 × S1 + pins) | 1.0 |
| Documentation | 0.5 |
| **Total** | **~5** |

## Launch confidence

**Increasing.** Before this gate, the funnel would have launched blind
on the composer half and unable to segment by auth or entitlement —
precisely the "can't answer where users drop out" risk. Those gaps are
closed and verified against real event streams, not assumptions. The
trend across three gates: each is finding real but shrinking classes of
defect, and nothing has recurred.

## Sign-off criterion

Event-by-event checklist complete against a pre-declared baseline;
privacy row all-pass (no private value appeared in any captured
payload); zero open S0. **Awaiting founder sign-off.**
