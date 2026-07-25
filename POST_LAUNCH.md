# Audio XX — Post-Launch Backlog

Intake for everything the **launch freeze** excludes. The freeze is in
effect from Gate 1 until soft launch is complete, unless the founder
explicitly lifts it.

**Permitted during the freeze:** launch-blocking defects (S0),
regressions, copy fixes, accessibility fixes, performance fixes,
security fixes. **Everything else lands here** — new features,
architecture changes, redesign, refactoring, S2 defects, and deferred
S1s with their Gate 11 disposition.

Entry format: one line — `[source] description — why deferred`. Keep it
scannable; expand only when the item is picked up.

## Deferred by design (pre-freeze roadmap items)

- [roadmap] Generated per-assessment OG images — text unfurl ships first
- [roadmap] Pretty share links (`/a/<id>`) — query-string links work
- [roadmap] Reading-to-reading diff view in history — explicit M-brief exclusion
- [roadmap] Password reset — needs an email service
- [roadmap] External-image data repair — client-side degradation covers it
- [m5] Renewal-failure (`past_due`) end-to-end via Stripe test clocks — entitlement behavior covered by unit + DB tests
- [stripe] $5/month backup price — founder declined speculative price creation

## Deferred during certification

(Gate reports append here.)
- [gate-3] save_started can report signed_in:false when clicked within ~1s of page load (before session resolves) — attribution imprecision on one intent event, outcome events unaffected (S2, observed once in J3)
- [gate-4] No Content-Security-Policy header — strict CSP needs per-bundle nonce infrastructure; other security headers present (Referrer-Policy, X-Frame-Options, X-Content-Type-Options, HSTS in prod) (S2, hardening nicety per plan)
- [gate-4] `X-Powered-By: Next.js` response header exposed — `poweredByHeader: false` removes it; cosmetic framework-version disclosure (S2, hardening nicety per plan)

## Product proposals (recorded during certification — not launch scope unless noted)

### Reassess a saved system — first-class, recorded re-run (founder observation, 2026-07-25)

**Model.** A system is persistent; assessments are dated snapshots produced
by a particular version of Audio XX. The saved-system page is the canonical
home; each assessment is an immutable, dated result. A "Reassess System"
action runs the current engine/knowledge against the stored chain, appends a
new snapshot, never overwrites history, and returns to the newly generated
assessment with a link back to the system.

**What already exists (important — this is largely built for normally-saved
systems).** The schema and history model already support this: `System`
holds an optional `canonicalText`; each `AssessmentSnapshot` records
`payloadJson` + `engineVersion` + `createdAt`; `getSavedSystem` orders
snapshots newest-first and flags the latest. The saved-system page already
renders "Run today's assessment" (history present) and "Run its first
assessment →" (no history) — BUT only when `canonicalText` is non-null.
Re-saving the regenerated artifact appends a fresh snapshot to the same
system by canonical-text match, and the identical-reassessment rule
(`payloadsMateriallyEqual`, date-stripped) already prevents no-op duplicates
while allowing genuinely-changed (new engine version) re-runs to append.

**The two real gaps.**
1. **Dead end for canonicalText-less systems (the France II screenshot).**
   Systems created via the legacy `/api/systems` POST (`/systems/new`,
   `SystemEditor`) store components but no `canonicalText` and no snapshot.
   Their page shows a chain but `runTodayUrl` is null → NO call-to-action at
   all ("This system predates assessment history — no saved assessments
   yet." with nothing to click). Minimal remedy: when `canonicalText` is
   null but `chain` exists, reconstruct the assessment text from the chain
   so an action link is always offered. ~2 lines; editorial/robustness, not
   architecture. (See dead-end note flagged to the edge/legacy gate.)
2. **"Run today's assessment" is not a one-click *recorded* reassess.** It
   routes to the generic `/artifact?system=…` page, which regenerates but
   does not auto-append a snapshot tied to this system — the user must click
   Save again. A true "Reassess System" would run → append snapshot under
   this systemId → land on the new dated assessment. This is the genuine
   new work.

**Answers to the product questions.**
1. *Pass saved data straight into the assessment flow?* Yes. Reconstruct the
   assessment text from `canonicalText` (or, fallback, the stored chain) and
   run `runArtifactPipeline` — the same entry the builder/composer use. No
   new engine surface needed.
2. *Immediate vs builder-confirm?* Immediate for canonicalText-backed
   systems (the chain is already canonical). Open the builder pre-populated
   only for legacy/ambiguous chains that don't resolve cleanly — see Q5.
3. *Record version/date/engine?* Already handled — `AssessmentSnapshot`
   stores `payloadJson`, `engineVersion()` (from assessment-pipeline), and
   `createdAt`. Reassess just calls the existing `saveAssessment` append.
4. *Distinguish newest from history?* Already handled — snapshots order
   newest-first; the page flags "Latest assessment" vs "Earlier assessment".
5. *Incomplete/ambiguous/legacy component data?* The failure mode. Legacy
   systems may have no `canonicalText` and chains that don't re-resolve to
   catalog components. Reassess must degrade gracefully: reconstruct text
   from the chain; if resolution is ambiguous, open the builder
   pre-populated for confirmation rather than silently producing a different
   reading. Never fabricate a snapshot from unresolved input.
6. *Entitlement boundary?* Reassess appends a snapshot = a collection-write
   = it must go through `requireManage` exactly like save/add (active trial
   or subscription). Reading existing assessments stays free. This reuses
   the M5 boundary with no new policy.
7. *Analytics.* Add `reassessment_started`, `reassessment_completed`
   (the append succeeded), `reassessment_abandoned` (left before append).
   Reuse the sanitizer/allowlist; segment by entitlement `state`. Keep the
   canonical-set discipline from Gate 3.

**Scope classification: post-launch product enhancement**, with ONE carve-out
promoted earlier — the **dead-end empty state** (gap 1) is a should-fix-
before-soft-launch UX/editorial defect, tracked to the edge/legacy gate, not
the full feature. The recorded-reassess feature itself (gap 2) is not
launch-blocking: normally-saved systems already get a working "run again"
path, and the identical-reassessment rule already protects history.

**Architectural recommendation.** Do not build a new reassess pipeline.
When approved, (a) fix the dead end first (reconstruct text from chain so an
action always exists), then (b) add a thin "Reassess System" server action
that reuses `saveAssessment` (which already runs the pipeline, stamps engine
version, appends immutably, and enforces entitlement) and redirects to the
new snapshot. The only genuinely new surface is the three analytics events
and the one-click-that-records affordance. Estimated a small, single-gate
change post-launch.
