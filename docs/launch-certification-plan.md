# Audio XX — Launch Certification Plan

Status: **awaiting architectural review — no gate has been executed.**
Baseline: version-b `4d11948` (M5 + Stripe test-mode fixes). Production: `de13f5a`.

## Purpose

Certify that the product a stranger meets — free assessment, My Systems,
billing — is correct, trustworthy, and un-embarrassing, through a
sequence of **daily, independently reviewable gates**. Each gate ends
with evidence, a defect list sorted by severity, and an explicit
sign-off before the next gate begins. Certification produces
*confidence*, not new capability: fixes made during it are bounded to
defects the gates surface.

Severity language (S0/S1/S2) is defined in
`docs/launch-defect-severity.md`. The consolidated test inventory is
`docs/launch-certification-matrix.md`.

## Launch freeze (in effect from Gate 1)

From the start of Gate 1 until soft launch is complete, unless the
founder explicitly lifts it:

- **No** new features, architecture changes, redesign, or refactoring.
- **Only** these changes are permitted: launch-blocking defects (S0),
  regressions, copy fixes, accessibility fixes, performance fixes,
  security fixes.
- Everything else is recorded in `POST_LAUNCH.md` (repo root) with a
  one-line rationale — including good ideas discovered mid-gate.

## Launch Commander

`launch-status.md` (repo root) is the living operational dashboard —
overall status, current gate, days remaining, gate table, open S0/S1
counts, launch risks, today's and tomorrow's objectives. It is updated
at the end of every gate day and reviewed at the daily 11:00 launch
check-in. Concise entries only; detail stays in `certification/`.

## Standing rules for every gate

- **Evidence** goes in `certification/day-NN-<gate>/` — a `report.md`
  (what ran, what passed, defects with severity) plus screenshots/logs.
  Reports name real commands and real URLs, never "verified" without
  artifacts.
- **Automated baseline first**: engine gate (`node scripts/test-gate.mjs`)
  and product suite (`npx vitest run apps/web/src/product`) must be
  green at the start of every gate day; any regression stops the day.
- **Fix policy during certification**: S0 fixed immediately (same day,
  with a regression test); S1 logged and batched; S2 logged to backlog.
  No opportunistic refactors — the engine and architecture stay frozen.
- **Stop-and-review**: every gate ends with a posted report and waits
  for founder sign-off (a one-line "Gate N approved" suffices). Sign-off
  criteria are listed per gate; the universal criterion is **zero open
  S0 in that gate's scope**.
- **Cleanup**: any test accounts, saved systems, or Stripe test objects
  a gate creates are deleted at the end of the gate unless the report
  says why they were kept. The production database is never touched.
- **Report template** (every gate report ends with these two sections):
  *Estimated effort* — hours split across automation, manual QA, fixes,
  and documentation, with a total. *Launch confidence* — a short
  engineering judgment of overall launch readiness after this gate
  (increasing / flat / decreasing, with one sentence of why). Not a
  formal metric; a trend line across the certification.

---

## Gate 1 — Functional product QA (Day 1)

- **Purpose:** the free core product — the thing that is always free and
  carries the whole funnel — works end-to-end without an account.
- **Scope:** homepage; composer (free text) and builder entry paths;
  assessment artifact rendering for both; first-follow-up continuity;
  copy-link; print view; artifact failure path ("couldn't read that as a
  system"); presets; nav; 404.
- **Automated:** engine gate; product suite; build.
- **Manual journeys:** (a) anonymous: land → builder → artifact → copy
  link → open link in fresh private window → print preview; (b)
  anonymous: land → composer → artifact → one follow-up question; (c)
  garbage input → editorial failure notice → recover to builder.
- **Evidence:** screenshots of each journey stage; pasted-link unfurl
  check; report.
- **Release-blocking (S0):** any dead end (empty response, crash,
  unrecoverable state) on the free path; artifact fails for a valid
  2-component system; share link renders differently from the original.
- **Non-blocking:** copy nits, spacing, non-core page issues (S1/S2).
- **Cleanup:** none required for anonymous flows; sweep anything created.
- **Duration:** 1 day. **Sign-off:** three journeys evidenced clean.

## Gate 2 — Billing & entitlement QA (Day 2)

- **Purpose:** money and access are never wrong — recheck the full
  M5 surface on the certification baseline (post-`4d11948`).
- **Scope:** all 10 user states; trial arithmetic incl. boundary;
  protected-action enforcement (save/add/rename/notes) vs always-free
  actions (view/print/share/remove); checkout, portal, webhook lifecycle
  in Stripe test mode; degradation with Stripe unreachable.
- **Automated:** entitlement + billing test files; webhook-crypto tests;
  grep check that no billing path deletes user content.
- **Manual journeys:** re-run D (subscribe 4242), E (portal cancel →
  paid-through retained), F (declined card → nothing changes), expired
  user reads + removes freely, blocked actions show the calm prompt.
- **Evidence:** stripe-listen delivery log (all 2xx), before/after DB
  row snapshots, screenshots of each state's UI copy.
- **Release-blocking:** any state where a user is charged wrongly,
  loses paid-through access, gains unpaid access, or sees data
  deleted/hidden; webhook accepted with bad signature.
- **Non-blocking:** status-line wording, portal branding.
- **Cleanup:** cancel/delete test-mode subscriptions; remove local test
  accounts created for the gate.
- **Duration:** 1 day. **Sign-off:** 10-state table fully evidenced.

## Gate 3 — Analytics & funnel verification (Day 3)

- **Purpose:** at launch the founder can answer "where do users drop
  out before paying?" from the dashboard alone.
- **Scope:** all 21 canonical events; segmentation (builder/composer,
  anon/signed-in, trial/subscriber, first/repeat save); privacy
  sanitizer; once-per-load dedupe; server events.
- **Automated:** analytics test file; grep audit that no call site
  passes non-allowlisted props.
- **Manual journeys:** walk the full funnel in dev debug mode and check
  every expected event fires exactly once with only allowlisted props;
  simulate the blocked-action path and confirm `trial_action_blocked`
  carries the right `action`.
- **Evidence:** annotated console log mapping each journey step → event;
  spec cross-check against `docs/analytics-events.md`.
- **Release-blocking:** a private value (name, note, email, free text,
  URL) observed in any event; a funnel stage that emits nothing.
- **Non-blocking:** missing nice-to-have prop, double-count on an edge
  navigation.
- **Cleanup:** none. **Duration:** ½–1 day.
- **Sign-off:** event-by-event checklist complete; privacy row all-pass.

## Gate 4 — Privacy, authentication & security (Day 4)

- **Purpose:** no user can see or affect another user's data or billing;
  secrets stay server-side.
- **Scope:** cross-user access attempts on every API route (systems,
  snapshots, billing status/portal/checkout); auth flows (register,
  sign-in, sign-out, wrong password); webhook signature rejection +
  replay; open-redirect probes on checkout returns; secret scan of the
  client bundle and repo; headers; artifact-metadata privacy (public
  links must never expose private names/notes).
- **Automated:** build + `grep` bundle scan for key prefixes
  (`sk_test|sk_live|whsec|NEXTAUTH_SECRET` values); existing
  privacy-boundary tests.
- **Manual journeys:** two accounts, A tries every route with B's ids;
  tampered webhook payload → 400; `?session_id=` belonging to another
  user → rejected; crafted redirect params.
- **Evidence:** request/response transcript per probe; bundle-scan
  output.
- **Release-blocking:** ANY cross-user read/write, secret in bundle,
  unsigned webhook accepted, private data in a public surface. (All
  security items are S0 by definition.)
- **Non-blocking:** hardening niceties (rate limiting, CSP tightening) → S1/S2.
- **Cleanup:** delete probe accounts. **Duration:** 1 day.
- **Sign-off:** probe matrix all-deny; founder reads the transcript.

## Gate 5 — Editorial & visual QA (Day 5)

- **Purpose:** every screen reads as one publication — the artifact's
  editorial standard applied product-wide.
- **Scope:** homepage, artifact, sign-in, save, My Systems, system
  detail, history, account, prompts/blocked states, 404, print
  stylesheet; typography/spacing consistency vs `editorial-tokens.ts`;
  image-failure degradation.
- **Automated:** token-lock test; build.
- **Manual:** screen-by-screen review at desktop width against a copy
  checklist (voice, no dev jargon, no lorem/stub text, dates format,
  em-dash/quote typography); Playwright contact sheet for diffing.
- **Evidence:** contact sheet + annotated defect screenshots.
- **Release-blocking:** stub/placeholder text on a customer path; broken
  layout on a core screen; wrong product naming.
- **Non-blocking:** kerning-level polish (S2 unless embarrassing).
- **Cleanup:** none. **Duration:** 1 day.
- **Sign-off:** contact sheet reviewed; S0 none, S1 list agreed.

## Gate 6 — Audiophile assessment QA (Day 6)

- **Purpose:** the advice itself — the product — is credible to the
  audience it claims to serve.
- **Scope:** ~30 representative systems drawn from the existing
  benchmark pool + M5-era additions: budget/mid/high-end, vintage,
  actives, headphone chains, all-in-ones, mixed-brand, same-brand,
  deliberately imbalanced, and 3 "reviewer-bait" prestige systems.
- **Automated:** benchmark harness rerun on the certification commit;
  compare against the last accepted classification (no new
  "embarrassing" class).
- **Manual:** expert read of 10 sampled artifacts using the standing
  3-question rubric (answered? ChatGPT better? embarrassing?) plus
  factual spot-checks (no wrong component identity, no cross-brand
  leakage, no contradiction between verdict and body).
- **Evidence:** rendered artifacts, per-system scores, delta vs last
  benchmark.
- **Release-blocking:** factual mis-identification of a component;
  contradictory verdict; any output the founder would not defend to an
  audio journalist.
- **Non-blocking:** flat prose, missed nuance (S1/S2).
- **Cleanup:** none. **Duration:** 1 day.
- **Sign-off:** zero embarrassing; ≥90% "good" maintained.

## Gate 7 — Edge cases & destructive testing (Day 7)

- **Purpose:** hostile or clumsy input never corrupts data or strands a
  user.
- **Scope:** absurd inputs (1,000-component text, emoji, HTML/script
  injection in names/notes, RTL text); double-submits; rapid
  save/remove; concurrent sessions; expired session mid-action; direct
  API calls with malformed bodies; deleting a system then using stale
  links; browser back/forward through checkout; localStorage/cookie
  wipes mid-flow.
- **Automated:** existing suites; a small scripted API-fuzz pass
  (malformed JSON, oversized fields, wrong types) asserting 4xx-not-5xx.
- **Manual:** the journeys above, done vindictively.
- **Evidence:** fuzz output; screenshots of graceful failures.
- **Release-blocking:** data corruption/loss; stored XSS; a 500 that
  strands a signed-in user; duplicate charge path.
- **Non-blocking:** ugly-but-safe error states.
- **Cleanup:** remove fuzz artifacts from local DB. **Duration:** 1 day.
- **Sign-off:** fuzz log clean of 5xx on customer routes; no S0.

## Gate 8 — Mobile, browser, accessibility & performance (Day 8)

- **Purpose:** the publication holds up on the devices audiophiles
  actually read on.
- **Scope:** mobile (375w) + tablet + desktop on the core journeys;
  Safari + Chrome + Firefox; keyboard-only pass (focus visible, all
  actions reachable); title/landmark/alt basics; Lighthouse on home +
  artifact (mobile); artifact render weight.
- **Automated:** Playwright viewport sweep; Lighthouse CI runs.
- **Manual:** phone-sized walkthrough of build→assess→save→blocked
  prompt; print from mobile Safari.
- **Evidence:** viewport contact sheets; Lighthouse reports; keyboard
  video or step log.
- **Release-blocking:** horizontal scroll/unusable control on a core
  mobile journey; keyboard-unreachable purchase or save; Lighthouse
  performance so poor the artifact visibly janks (<50 mobile perf on
  the artifact is the working line).
- **Non-blocking:** score-chasing beyond that line (S2).
- **Cleanup:** none. **Duration:** 1 day.
- **Sign-off:** sheets reviewed; blockers none.

## Gate 9 — SEO, metadata, sharing & print (Day 9)

- **Purpose:** every shared assessment link is the acquisition loop —
  it must unfurl, index, and print like editorial.
- **Scope:** OG/Twitter unfurls for artifact links (the verdict-as-title
  behavior), homepage metadata, robots/noindex on private pages
  (account, systems), sitemap/canonical sanity, favicon set, print
  output of artifact + system page, copy-link URL stability.
- **Automated:** metadata assertions (existing + a small route-metadata
  test); crawl of public routes checking title/description presence.
- **Manual:** paste an artifact link into a Slack/Discord/WhatsApp
  preview tool; print-to-PDF two artifacts and read them.
- **Evidence:** unfurl screenshots; PDFs; crawl output.
- **Release-blocking:** private page indexable; unfurl leaking a private
  name/note; artifact link that 404s.
- **Non-blocking:** unfurl aesthetics, missing OG image (deferred by
  design).
- **Cleanup:** none. **Duration:** ½–1 day.
- **Sign-off:** unfurl + noindex matrix complete.

## Gate 10 — Founder embarrassment & reviewer-lens review (Day 10)

- **Purpose:** the product is read cold by the people who could make or
  break it — the founder, and a panel of representative reviewer
  perspectives: "would I send this to an audio journalist today?"
- **Scope:** two parts.
  *Part A — founder session:* founder-led, unscripted: 30–45 minutes
  using the product as a stranger (Claude observes, logs, does not
  steer), then 15 minutes as a paying customer; ends with the founder
  naming anything embarrassing.
  *Part B — reviewer-lens panel:* the product (homepage, three
  representative assessments, a brand page, the paywall moment) is
  evaluated through five named perspectives, asking of each **"what
  would this reviewer criticise?"**:
  - **John Darko** — presentation, design taste, whether the writing
    sounds like marketing; how it demos on video.
  - **Michael Lavorgna** — editorial voice and sincerity; whether the
    prose earns its opinions or hides behind hedges.
  - **Herb Reichert** — musical truth; does the assessment describe how
    systems actually sound, or recite spec-sheet tropes.
  - **Steve Guttenberg** — accessibility to the ordinary enthusiast;
    jargon load; whether a newcomer feels welcome or judged.
  - **An experienced Reddit audiophile (r/audiophile moderator
    archetype)** — factual nits, price/value skepticism, snake-oil
    detection, "what is this actually doing that ChatGPT doesn't?"
  Each lens produces a written findings list; every finding is recorded
  and triaged S0/S1/S2 with the founder.
- **Automated:** none — deliberately.
- **Manual:** the founder's session plus the five-lens critique.
- **Evidence:** timestamped founder session log; one findings section
  per reviewer lens; combined triage table.
- **Release-blocking:** whatever the founder declares embarrassing —
  this gate has founder-defined S0. A lens finding becomes S0 only by
  founder adoption.
- **Non-blocking:** all other lens findings logged with severity.
- **Cleanup:** any accounts created. **Duration:** ½–1 day + fixes.
- **Sign-off:** founder states, in writing, "nothing embarrassing
  remains on the core paths," having read all five lens reports.

## Gate 11 — Private-beta readiness & issue triage (Days 11–12)

- **Purpose:** convert certification output into a beta the founder can
  actually run.
- **Scope:** consolidated defect triage (all S1s dispositioned:
  fix-now vs post-launch); Sentry live-fire (DSN set in the target env,
  controlled test error observed); runbook walk-through; beta mechanics
  (invite copy, feedback channel — email `Report issue` path verified,
  where feedback lands); analytics dashboard checked with founder
  driving; rollback rehearsal on preview.
- **Automated:** full suites one final time on the certification commit.
- **Manual:** founder locates the funnel and an error in the dashboards
  without help.
- **Evidence:** triage table; Sentry event screenshot; signed
  certification summary.
- **Release-blocking:** any open S0 anywhere; founder cannot see errors
  or funnel.
- **Non-blocking:** S1s explicitly deferred with rationale.
- **Cleanup:** full test-data sweep; byte-check that prod data is
  untouched.
- **Duration:** 1–2 days.
- **Sign-off:** certification completion criteria met (see severity
  doc) — this sign-off IS launch certification.

---

## Day-by-day schedule (working days)

| Day | Gate | Owner |
|---|---|---|
| 0 | Plan approval (this review) | Founder |
| 1 | G1 Functional | Claude, founder signs |
| 2 | G2 Billing & entitlement | Claude, founder signs |
| 3 | G3 Analytics & funnel | Claude, founder signs |
| 4 | G4 Privacy & security | Claude, founder signs |
| 5 | G5 Editorial & visual | Claude, founder signs |
| 6 | G6 Audiophile assessment | Claude + founder read |
| 7 | G7 Edge & destructive | Claude, founder signs |
| 8 | G8 Mobile/browser/a11y/perf | Claude, founder signs |
| 9 | G9 SEO/meta/share/print | Claude, founder signs |
| 10 | G10 Founder + reviewer-lens review + **founder Stripe test-mode walkthrough** (same sitting) | Founder, Claude logs |
| 11 | G11 triage + Sentry + runbook rehearsal | Both |
| 12 | G11 close-out + certification sign-off | Founder |
| 13 | Stripe live-account verification (identity/bank/tax decision) + **production activation gate** | Founder decides, Claude executes runbook |
| 14 | Buffer / beta invitations | Both |

10-day floor (compress G3+G9 into neighbors, G11 in one day); 14-day
ceiling with buffer. Gates are independent: a blocked day pauses that
gate, not the sequence — reorder freely except G10/G11 last.

## The exact production-activation point

Production activation happens when **all** of:
1. All 11 gates signed off with **zero open S0** (S1s may remain if
   dispositioned in the G11 triage table);
2. Founder has done the Stripe test-mode walkthrough personally;
3. Stripe live account verified (identity, banking, business, support,
   branding) — the wizard seen on Day 0;
4. The **tax decision** is made by the founder (provisional preference
   recorded: US$3/month, taxes included where applicable — not decided
   autonomously);
5. Runbook executed at the gate: backup → additive schema → env → deploy
   → live webhook → smoke tests.

It does **not** wait for S1/S2 cleanup. Should-fix items ride into the
beta window; the backlog rides past launch.

## Sequencing (as approved)

Plan approval → certification execution → founder Stripe walkthrough →
live-account verification → production activation gate → private beta →
soft launch.
