# Suggested Edits — Slice 1 (capture only)

Status: implemented 2026-09-17. Design: approved "Suggested Edits & Community
Evidence" spec (post-M1 design mission).

## What Slice 1 is

One quiet door: a user who sees wrong or missing product knowledge can tell
Audio XX, in their own words, with an optional source URL. The submission is
captured as an **inert pending record** with its context (surface, product
reference or the user's typed wording, reason, source).

- Affordance: "Suggest an edit" on component dossier cards; on cards where
  Audio XX holds no specifications, the copy becomes
  "Know this product? Help improve Audio XX."
- Sheet: reason (4 plain-language options) → free text → optional source URL.
- Signed-in users only; unauthenticated visitors see a sign-in note.
- Confirmation: "Thank you. A person reviews every suggestion before
  Audio XX's knowledge changes."

## What Slice 1 is NOT

- Submissions do **not** become evidence. No contribution — sourced or not —
  changes catalog facts, evidence items, product identity, images, retrieval,
  or anything the reasoning lane reads. The separation is pinned by tests
  (`apps/web/src/lib/contributions/__tests__/slice1.test.ts`).
- No contributor assertion ever changes Audio XX knowledge. The doctrine:
  **the contributor tells us where to look; the source determines what
  Audio XX may know.** Review and evidence admission belong to a future slice
  (Slice 3 of the approved spec), with human approval.
- Owner observations, personal unit facts, system-context attachment,
  supersession, AI-assisted review, uploads, and any admin dashboard are not
  implemented.

## Mechanics

- Store: `ContributionV1` table via the house ensure-table pattern
  (`apps/web/src/lib/contributions/contribution-store.ts`) — the repo's
  durable-table convention (no Prisma migration; TEXT timestamps per the
  libSQL adapter lesson).
- API: `POST /api/contributions` — session-required, validated, 5/hour per
  account, content-free observability line.
- Review: `node scripts/contributions-review.mjs` prints pending
  contributions (read-only). Valuable contributions are acted on through the
  existing evidence-authoring path, outside this feature.
- Analytics: `suggested_edit_opened` / `suggested_edit_submitted` with shape
  flags only (surface, known identity, reason, sourced) — never free text.

## Rollback

Remove the `<SuggestEdit>` affordance from `ComponentDossiers.tsx` (or revert
the release merge). Stored rows are inert and harmless; no knowledge rollback
can ever be required because Slice 1 writes no knowledge.
