# MVP Milestone 3 — Report: Assessment History

**Date:** 2026-07-22 · **Status:** Complete, pushed to `version-b`, **not deployed** — awaiting review and a separate promotion gate.

## What shipped

My Systems now records how a system — and Audio XX's reading of it — changes over time, with the system/assessment distinction kept sharp throughout:

1. **Saved system page** (`/systems/[id]`, replacing the legacy component-editor page) — the enduring entry: name (inline rename), notes (inline edit), component chain, "In your collection since…". Below it, **Latest assessment** with visual priority (accent label, verdict as headline, saved date + engine version, *Read the full assessment* / *Run today's assessment*), then **Assessment history · N assessments**: earlier entries newest-first, each with "Earlier assessment", "Saved on <date> · engine <v>", the verdict as a pull-quote, and *Read this assessment*. User-facing language only — no snapshot/payload/record vocabulary anywhere.
2. **Historical assessment view** (`/systems/[id]/assessment?snap=…`) — the artifact exactly as saved (never regenerated), provenance line stating **latest** vs **earlier** (earlier renders in the accent color), and for earlier readings an explicit note: *"You are reading an earlier assessment, kept exactly as it was written. A newer assessment of this system exists. Read the latest →."* Navigation: System & history · My Systems. A corrupted stored assessment degrades to an editorial notice with the system still reachable — it never blocks the rest of the history.
3. **Add today's assessment** — on the artifact page, a signed-in reader whose collection already contains this canonical system sees the action as **"Add today's assessment"** (instead of "Save this system"). Confirmations name the destination: *"Today's assessment was added to 'Living Room''s history. View the system →."* Appending preserves name and notes, creates no second system, and never overwrites earlier assessments.
4. **The identical-reassessment rule (explicit product rule):** *a new history entry is added only when the assessment actually changed — a different engine version, or materially different content. A re-run that differs only by its date is the same reading and is never silently appended.* The user is told: *"'Living Room' already has this exact assessment saved — nothing has changed, so history was left untouched"* with a link to the system. This rule also makes saves idempotent against double-submits, concurrent client/server fires, and refresh-resubmits — the protection is product behaviour, not a database constraint.
5. **My Systems refinement** — cards open the system page; the date line shows "· N assessments" when history exists; quick actions became *Latest assessment · History · Rename · Use in conversation · Remove*; long names/notes wrap (`overflowWrap`); pre-M2 systems (no saved assessments) show an honest "predates assessment history" state with a *Run its first assessment* link when possible.

## Architecture & data model

**No schema changes. No production database change is required for this milestone.** The M2 model (`System` + immutable `AssessmentSnapshot`) already carries history; M3 adds the comparison rule, a `getSavedSystem` history read, and the product surfaces. The canonical assessment URL remains the public identity; anonymous assessment generation is untouched (regression-tested). Architecture doc unchanged apart from the roadmap table.

## Automated test results

- **Product suite: 49 passing** (10 new in `assessment-history.test.ts` + reworked M2 duplicate tests), covering: exactly-one insertion on a changed reading; byte-immutability of earlier entries through later saves; newest-first ordering with the latest flagged; name/notes preservation (Journey C at persistence level); no duplicate systems; the identical rule (deterministic comparator incl. date-stripping and unreadable-payload behaviour; concurrent double-submit + refresh appending nothing; engine-change-alone appends); per-user isolation; unknown-id and unauthorized access returning null; corrupted-payload degradation; deletion cascading only its own history.
- **Engine regression gate: 3,803 passing · 20 pre-existing baselined · 0 new failures.**
- **Production build:** `prisma generate && next build` succeeds; `/systems/[id]` and `/systems/[id]/assessment` compile as dynamic routes.

## Manual acceptance (local dev, seeded three-engine history)

| Journey | Result |
|---|---|
| **A — evolution:** system page → Run today's → Add → exactly one new entry (2→3) → earlier assessment opened unchanged | ✅ |
| **B — identical:** re-run without change → explicit "already has this exact assessment saved — history left untouched", count unchanged, no new system | ✅ |
| **C — metadata:** rename + notes → append → both preserved, new entry in history | ✅ |
| **D — multiple systems:** 2 systems, one with 3 assessments — count, most-recent, latest, earlier-open, rename/notes all determinable at a glance | ✅ |
| **E — mobile 375 px:** My Systems, system page, history, historical view — no horizontal overflow, all controls reachable | ✅ |

Screenshots captured during the session: My Systems (two systems, assessment counts), the Living Room system page (latest + 3-entry history across engines `dev`/`b9f2e10`/`a1b2c3d`), the historical June assessment with the earlier-assessment banner, the identical-rule confirmation, the append confirmation, and mobile renders.

## Known limitations

- History-entry verdict quotes are the identifying summary; there is no per-entry diff view ("what changed between these two readings") — a natural M-next candidate, recorded in the roadmap.
- Notes remain system-level (per the brief); no assessment-level annotations.
- The "Add today's assessment" label depends on a client-side collection lookup; on very slow connections the button may briefly read "Save this system" before upgrading. Behaviour (not label) is identical either way.
- Pre-M2 legacy systems list without verdicts until first re-assessed (by design).

## Roadmap notes recorded (not implemented)

Reading-to-reading diff view · assessment-level annotations · pretty share links · external-image repair · builder touch-target sizing · Node 24 build engines (before 2026-10-01).

## Recommendation

**Ready for the Milestone 3 production promotion gate** (no schema step needed this time — application deploy only), and **ready to begin Milestone 4 (billing)** after that gate: the collection now has genuine retention value to charge for, and no billing prerequisite is missing.
