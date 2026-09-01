# MVP Milestone 2 — Report

**Milestone:** Save System → account → persistent My Systems with assessment snapshots
**Date:** 2026-07-21 · **Status:** Complete, awaiting review before Milestone 3

## Completed work

1. **Data model** — new `AssessmentSnapshot` (systemText, payloadJson, engineVersion, createdAt; immutable, indexed by system) and `System.canonicalText` (the normalized assessment-URL text — the system's canonical identity, driving per-user duplicate detection). Applied to the dev database; **production Turso needs one `prisma db push` at deploy — flagged below.**
2. **One pipeline, extracted** — `product/assessment-pipeline.ts` is now the single text→engine→ArtifactPayload path used by both `/artifact` (rendering) and saving (snapshotting), so a saved assessment is byte-identical to the one the user just read. `engineVersion()` records the Vercel commit (locally `dev`).
3. **Save logic** (`product/save-system.ts`, DB-injectable for tests) — recomputes the assessment server-side (never trusts a client payload), creates System + snapshot; **duplicate saves append a snapshot to the existing system** and never rename or overwrite user notes. `listMySystems` returns the collection with latest-snapshot summaries (chain, verdict, dates, engine version), falling back to legacy component rows for pre-M2 systems.
4. **API** — `POST/GET /api/my-systems`, `PATCH/DELETE /api/my-systems/[id]` (rename, notes, remove; ownership-checked; snapshots have no mutation route by design).
5. **Save flow UX** — "Save this system" on the artifact now saves directly when signed in ("Added to your collection · View My Systems →" / "Already in your collection — today's assessment has been added to its history"); anonymous readers go to **`/save`**: one editorial card — *"Begin your collection. Create your free account to save this system and begin building My Systems."* — where account creation and saving are a single motion (auto-register credentials; same fields sign existing users in).
6. **My Systems** (`/systems`, rewritten) — a collection, not a dashboard: hairline-ruled entries with name (inline rename), chain, the verdict as a pull-quote, saved date, notes; quiet actions (Read assessment · Rename · Use in conversation · Remove). "Use in conversation" preserves the existing saved-system activation bridge into the advisory chat.
7. **Saved assessment** (`/systems/[id]/assessment`) — renders the **stored snapshot payload, not a re-run**, in the same artifact layout/stylesheet, with a provenance line (name · saved date · engine version), the user's notes as a colophon, Print, and *Run today's assessment* (the canonical stateless URL — the M3 seam for updated-assessment comparison).

**Architecture notes:** no material change to `docs/mvp-product-architecture.md` — M2 landed exactly as designed there (canonical URL identity, persistence around it, snapshot immutability). The one refinement: the AssessmentSnapshot model shipped with `userId` denormalized for cheap per-user queries.

## Automated test results

- **Product suite: 29 passing** (12 new in `save-system.test.ts`, running the real Prisma client against a throwaway SQLite database with the real schema): save creates system + immutable snapshot with all required fields; duplicate save appends history, never a second system; re-saves never overwrite name/notes; earlier snapshots untouched by later saves; unresolvable/empty text rejected with typed errors; per-user isolation (two users, same chain → two systems; lists never leak across users); corrupted payload degrades gracefully; delete cascades own snapshots only. Plus M1's 17 (catalog, builder, spine) still green.
- **Engine regression gate: 3,793 passing · 20 baselined · 0 new failures.**

## Manual acceptance (live dev server, fresh browser state)

| Step | Result |
|---|---|
| Anonymous artifact → Save this system | ✅ Routed to `/save` with the approved copy and the system named ("Saving: Bluesound Node, Marantz PM8006, KEF R3") |
| Create account & save (new email) | ✅ Account auto-created, system saved, landed on `/systems?welcome=1` — "Your collection has begun." |
| Collection card | ✅ Name, chain, verdict as pull-quote, date, four quiet actions |
| Read assessment | ✅ Snapshot page: provenance line "…· saved 21 July 2026 · engine dev", artifact identical to the one saved |
| Signed-in re-save of same chain | ✅ "Already in your collection — today's assessment has been added to its history. View My Systems →" |
| Rename + notes | ✅ PATCH 200; "Living Room" + notes persisted and survive later re-saves |
| Wrong password on existing email | ✅ Clear inline error, no state change |
| Correct password sign-in save | ✅ Lands on My Systems; history grew by exactly one snapshot |

**Found & fixed during acceptance:** the `/save` form submit and the post-sign-in effect could each fire a save (benign — absorbed as a duplicate — but it padded history by one). Guarded; verified fixed by the exactly-one-snapshot check above.

## Known limitations

- **Production schema step:** `AssessmentSnapshot` + `System.canonicalText` must be pushed to Turso before deploy (`npx prisma db push` with Turso env). Additive only — no existing rows change. **Not run — awaiting your go, per the no-unattended-migrations rule.**
- The `/save` page names auth failures generically ("already registered with a different password") — no password reset exists yet (roadmap; needs an email service).
- Default system names derive from the component credit, so a fresh card reads name ≈ chain until renamed. Honest, but a naming prompt at save time could be nicer (M3 polish candidate).
- "Basic organisation" = rename/notes/remove/order-by-recency. Grouping/pinning deferred (nothing yet to organize at collection sizes of 1–5).
- Old-flow systems (component rows, no snapshots) render in the collection without verdict/Read-assessment — correct degradation, disappears as users re-save.

## Recommendation on Milestone 3

**Ready to begin, with one prerequisite and one suggestion.** Prerequisite: the Turso schema push above (one command, additive). Suggestion: M3's core (*Re-assess → new snapshot alongside old, snapshot history view*) is already 80% seamed — `Run today's assessment` renders the current-engine take and `?snap=` addresses historical snapshots; M3 mainly adds "save this re-assessment" + a history list per system. That is a small milestone; consider bundling the M5 OG/meta work into it if you want fewer review cycles. Billing (M4) remains untouched, as instructed.
