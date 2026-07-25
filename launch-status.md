# Audio XX — Launch Status

> Daily operational dashboard. Reviewed at the 11:00 launch check-in.
> Concise entries only; detail lives in `certification/` reports.

**Overall status:** PROMOTED — certified RC `7e9805b` LIVE on audio-xx.com (2026-07-25); 7-point verification passed; checkout commercially inactive (Stripe unset). Commercial activation remains a separate later founder switch.
**Launch freeze:** IN EFFECT (from Gate 1 until soft launch complete; founder may lift)
**Current gate:** 11 (Beta readiness & release triage) — approved → technical promotion COMPLETE & verified
**Days remaining (plan):** 0 — certification complete; technical promotion done
**Baseline commit:** c62dcb1 (version-b) · Production: **7e9805b** (deployment dpl_GVM4My5Lhz1qp41WDf9wF8NSWNvV; was de13f5a) · Rollback: dpl_6hYBEXPsakA6VqgyH2D7AWdUDJEs

## Gates

| Gate | Status | Signed |
|---|---|---|
| 1 Functional | **PASS WITH MINOR ISSUES** — 1 S1 fixed+pinned | ✅ approved |
| 2 Billing & entitlement | **PASS** — 10 states live, 0 defects | ✅ approved |
| 3 Analytics & funnel | **PASS WITH MINOR ISSUES** — 3 S1 fixed+pinned, 1 S2 logged | ✅ approved |
| 4 Privacy & security | **PASS** — cross-user probe denies; secret scan clean; 0 defects, 2 S2 hardening logged | ✅ approved |
| 5 Editorial & visual | **PASS WITH MINOR ISSUES** — 1 S1 naming fixed+pinned, 4 S2 → backlog; no fabrication | ✅ approved |
| 6 Assessment quality | **PASS (remediated)** — graph-integrity gate; controls still assess; pinned | ✅ approved |
| 7 Edge & destructive | **PASS WITH MINOR ISSUES** — honest failure; fuzz clean after 1 fix | ✅ approved |
| 8 Mobile/browser/a11y/perf | **PASS WITH MINOR ISSUES** — responsive, a11y+print clean; 1 S2 | ✅ approved |
| 9 SEO/meta/share/print | **PASS WITH MINOR ISSUES** — robots+sitemap+titles; 3 S1 fixed+pinned | ✅ approved |
| 10 Founder + reviewer-lens review | **PASS WITH MINOR ISSUES** — 1 S1 fixed+pinned | ✅ approved |
| 11 Beta readiness & triage | **READY FOR ACTIVATION WITH CONDITIONS** — approved; technical-promotion checklist prepared (certification/day-11-beta/production-promotion-checklist.md) | ✅ approved |

## Defects

**Open S0:** 0
**Open launch-blockers (S1, must-fix-before-launch):** 0 — G6-D1 remediated (graph-integrity gate) + regression-pinned
**Open S1:** 0 (11 found across Gates 1+3+4+5+7+9+10, all fixed same-day with regression tests)
**S2 backlog:** 10 (see POST_LAUNCH.md)
**Gate 6 watch-list:** 3 content observations from Gate 1 (verdict/lede tension; brand-only credit "Rega"; recommendation phrasing) — to be judged in the assessment-quality review
**Gate 7 watch-list (edge/legacy data):** saved-system DEAD END — systems with a chain but no `canonicalText` (created via the legacy `/api/systems` POST: `/systems/new`, `SystemEditor`) render the "predates assessment history" empty state with NO action link (`runTodayUrl` is null). Evidenced by "France II" on production. Minimal remedy: reconstruct assessment text from the stored chain so an action is always offered. Should-fix before soft launch; also relevant to Gate 5 (empty-state CTA / editorial). Full proposal + the broader "Reassess System" feature in POST_LAUNCH.md.

## Operational log

- 2026-07-24 · Credential hygiene (post-Gate-2 directive): full scan of
  tracked files + certification-era git history — **no credentials
  present** (two doc matches were placeholder prefixes only; the one
  evidence-file echo was scrubbed before it was ever committed).
  Standing credential-scan rule added to the plan;
  `scripts/credential-scan.sh` created and used from Gate 3 onward.
  Test-key rotation: **complete** (2026-07-25). Old key confirmed dead
  (Stripe API 401); replacement confirmed live (200) and present in
  .env.local; webhook forwarder restarted under the new key; listen
  signing secret unchanged. No key value recorded anywhere.

- 2026-07-25 · Parser defect (founder-reported, fixed in Gate 4 window):
  accessory field-labels ("speaker cables:", "interconnects:", etc.) were
  ignored by the shared subject matcher, so a cable's product token could
  surface as a phantom signal-path component — the reported case parsed
  "Canare 4S11G Star **Quad**" as a second loudspeaker and, if continued,
  fabricated Quad-brand content. Root cause + smallest-safe fix
  (field-label suppression in `extractSubjectMatches`) in
  certification/day-04-security/parser-defect/. Engine gate 3853 pass, 0
  regressions; +5 focused tests incl. an end-to-end component-graph
  assertion. Classified S1, fixed same-day.

- 2026-07-25 · **Standing engine doctrine (founder-set, Gate 6 close-out):**
  Catalog incompleteness may reduce convenience, but it must NEVER corrupt the
  component graph. When the resolved graph is incomplete, duplicated, or
  materially uncertain, Audio XX asks a specific clarification rather than
  producing a confident assessment — this outranks maximising the % of systems
  that assess uninterrupted. Targeted catalog additions may reduce unnecessary
  clarification but must never substitute for or weaken the graph-integrity
  gate. Any future false-positive clarification is a *usability* defect, fixed
  narrowly — never by broadly weakening the invariant. No catalog-completeness
  effort during certification.

- 2026-07-25 · **Production/RC deployment state (clarified, founder-accepted):**
  production = de13f5a (M4, 22 Jul); the certified release candidate = version-b
  (19 commits ahead, incl. the Gate 5 wLM fix d42c24a and all cert work).
  The live "wLM Diva Monitor" + phenomenological prose match de13f5a's code
  exactly — a deployment state, NOT a certification failure or a broken fix
  (re-verified: current code renders "WLM Diva Monitor" through the same
  runArtifactPipeline path). By design the RC promotes to production as ONE
  deployment at the activation gate. No early promotion for the cosmetic wLM
  fix; interrupt only for a genuine trust-damaging production defect.

- 2026-07-25 · **Production-baseline evidence recorded** (founder screenshot,
  certification/day-11-beta/production-baseline.md): live audio-xx.com still on
  de13f5a — "wLM Diva monitor" in the trade line + short assessment = the OLD
  build, not certified behaviour. Confirmed deployment state (mangle only in the
  mid-sentence decap; caps credit already correct). Activation MUST include a
  direct LIVE-URL browser check: (1) wLM gone; (2) deployed commit == certified
  RC; (3) assessment via certified renderer; (4) no stale build/alias serving;
  (5) test the live domain post-deploy, not the preview.

## Launch risks

1. Founder tax/entity decision unmade (activation prerequisite).
2. Stripe live-account verification not started (Stripe review latency).

## Objectives

**Today:** Certification approved (Gates 1-11). Founder decoupled TECHNICAL PROMOTION (deploy certified RC 7e9805b with checkout disabled) from COMMERCIAL ACTIVATION (live subscriptions after tax/Stripe). Prepared the technical-promotion checklist (env vars, checkout-disabled safety, Sentry DSN, one-deploy no-cherry-pick, 7-point live verification, rollback). Verified: no Stripe keys → checkout 503; 92-day trial from BILLING_LAUNCHED_AT → no subscribe boundary in the window.
**Next (on founder approval only):** promote version-b → production; run the 7-point LIVE verification on audio-xx.com. NOT deployed yet.
