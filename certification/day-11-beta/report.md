# Gate 11 — Beta Readiness & Release Triage · Report

Date: 2026-07-25 · Release candidate: `620ee7b` (version-b) · Production:
`de13f5a` (not yet promoted). This is a release decision, not a discovery gate.
The question: *is there sufficient evidence that we should stop improving and
release?*

---

## Release-candidate state (evidence)
- **Certification:** Gates 1–10 executed; Gates 1–9 approved, Gate 10 approved.
- **Open defects: S0 = 0 · S1 = 0.** 11 S1 found across gates, every one fixed
  same-day with a regression test. S2 backlog = 10 (all dispositioned).
- **Automated:** engine regression gate PASSED (3881 pass, 0 regressions vs
  trusted baseline); product + app + lib suites 138 passed (15 files);
  production build EXIT 0 (Gate 9); credential scan clean.
- **Test-data sweep (J7):** all certification test accounts deleted; production
  is a separate Turso DB, byte-untouched by certification (all work ran against
  local dev.db).
- One non-reproducible test flake observed once, then 3 consecutive clean full
  runs — logged as an observation, not a blocker.

---

## 1. READY (complete for private beta)
- **Core experience (M1–M4)** — builder + composer, server-side assessment,
  shareable permanent artifact URLs, guided failure path, accounts + My Systems
  + history, save/rename/notes/delete, print. Live on production since 22–23 Jul.
- **Billing & entitlement (M5)** — Stripe **test-mode** verified end-to-end
  (checkout → subscriber → webhook → immediate entitlement; portal cancel keeps
  paid-through; declined card changes nothing; lapsed account keeps read/remove;
  no data-deleting path; signature-verified, idempotent, out-of-order-safe).
- **Trust surfaces certified:** privacy/auth boundary (cross-user probe all
  deny, no secret in bundle); analytics funnel (21 events, sanitized, deduped);
  editorial + naming (wLM→WLM fixed); assessment quality (graph-integrity gate —
  never assess an untrusted graph); edge/destructive (fails honestly, 4xx-not-5xx);
  mobile/a11y/print (0-overflow, focus/landmarks/alt, clean print); SEO/sharing
  (robots+sitemap, per-page titles, verdict-as-unfurl, private noindex);
  editorial trust (five-lens review; one factual over-claim removed).
- **Doctrine established & protected:** graph-integrity ("clarify, don't
  fabricate"); factual restraint ("never claim more than the evidence
  supports"); calm restraint ("Nothing needs changing" is a strength to
  protect); honest failure.

## 2. DEFERRED (intentionally postponed until after launch)
- **FLAGSHIP: causal-explanation initiative** — deeper *why-it-sounds-that-way*
  reasoning using verified engineering knowledge. The designated next major
  evolution; not a backlog line.
- **Catalog additions** — reduce clarifications and fix bare-brand / "Ares Ii"
  naming (data work, not a code hack).
- **S2 backlog (dispositioned):** touch-target sizing; CSP header;
  X-Powered-By removal; canonical tags + JSON-LD; early-click `signed_in`
  attribution; "nothing needs changing" + soft-upgrade beat; power-match depth.
- **Post-cert docs:** Design Principles; Engine failure-modes reference.
- **Roadmap:** generated OG images; pretty share links; reading-to-reading diff;
  password reset (needs email service); external-image repair; `past_due`
  test-clock end-to-end.

## 3. REMOVED (deliberately excluded from launch scope)
- **$5/month backup Stripe price** — founder declined speculative price creation.
- **Reading-to-reading diff view** — explicit product-brief exclusion.
- **localStorage entitlement injection for prod QA** — explicitly disallowed;
  authenticated prod checks are founder-manual by decision.

## 4. BLOCKING (must precede activation — conditions, not defects)
None are software defects. All are founder-owned activation prerequisites and
the promotion/verify sequence:
1. **Tax / entity decision** (founder-only) — selling entity, jurisdiction,
   whether US$3/mo is tax-inclusive, whether Stripe Tax is enabled. Not decided
   autonomously.
2. **Stripe live-account verification** (founder-only) — identity / banking /
   business / support / branding; subject to Stripe review latency.
3. **Sentry DSN wired + one controlled live-fire** observed in the dashboard
   (error monitoring is no-op without a DSN today).
4. **Privacy policy + affiliate disclosure** reviewed against actual behaviour
   (accounts, Stripe, analytics).
5. **Promote the certified RC (`version-b` → production)** — the single
   deployment that makes all certified behaviour live (production is still
   `de13f5a`; the wLM fix and all M5 + certification work ship together).
6. **Post-promotion verification** — founder phone walk-through (first visit →
   build → read → print → share → save → account → My Systems → history);
   final benchmark rerun on the release commit; five demo scenarios on
   production.
7. **Rollback rehearsed** on preview before promotion.

---

## Recommendation

# Ready for activation with conditions

The release candidate is certification-complete: zero open S0/S1, every
defect fixed and regression-pinned, all ten quality gates passed, suites and
build green, production data untouched. The software should stop improving and
ship. Activation is gated only by the founder-owned prerequisites in §4 —
principally the tax/entity decision, Stripe live-account verification, Sentry
DSN, and the single production promotion of the certified candidate followed
by the founder walk-through. None of those are engineering defects; they are
the business and deployment steps that convert a certified candidate into a
live launch.

---

## Burden-of-proof note
Gate 11 asked the harder question — not "what else can we improve?" but "is
there sufficient evidence to release?" The evidence: a defect surface that
shrank every gate and never regressed; every S1 fixed with a test; the two
highest-consequence trust risks (a corrupted component graph; a false factual
claim) closed by doctrine, not patches; and a product that reads as credible
editorial and honestly declines to invent problems. That is sufficient. The
remaining opportunities are real but none is a trust failure, and the flagship
depth work is best done against live-user signal after launch.

## Sign-off criterion
Four-section triage complete; exactly one recommendation; S0 = 0, S1 = 0, all
S1 dispositioned; test data swept, production untouched. **Recommendation:
Ready for activation with conditions. Awaiting founder architectural review and
the activation decision.**
