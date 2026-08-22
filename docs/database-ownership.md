# Database ownership — two categories, one database

Audio XX's production database contains tables owned by **two different
systems**, and neither knows about the other. This document exists because that
conflict nearly destroyed the evidence layer.

## The incident (2026-08-22)

A pre-flight audit before an approved schema change found four production
tables absent from `schema.prisma`:

| Table | Rows | Owner |
|---|---|---|
| `ManufacturerFactV1` | 46 | `lib/evidence/manufacturer-fact-store.ts` |
| `IndependentReviewV1` | 5 | `lib/evidence/independent-review-store.ts` |
| `CorroborationCacheV2` | 12 | `lib/entity-corroboration.ts` |
| `CorroborationCache` | 5 | legacy |

`prisma db push` **drops tables that are not in the schema**, and with
`--accept-data-loss` it does so without a prompt. Running the approved change
through `db push` would have deleted every manufacturer fact and every admitted
review observation — including the published figures behind the only licensed
finding in the beta system's assessment.

The change was applied as targeted SQL against the one affected table instead.

## Category 1 — Prisma-managed

`users`, `profiles`, `systems`, `system_components`, `components`,
`assessment_snapshots`, `preference_snapshots`, `reference_systems`,
`subscriptions`, `processed_stripe_events`, `password_reset_tokens`

Relational application state. Declared in `prisma/schema.prisma`, accessed
through the Prisma client, migrated by Prisma.

## Category 2 — direct-SQL evidence and cache stores

`ManufacturerFactV1`, `IndependentReviewV1`, `CorroborationCacheV2`,
`CorroborationCache`

Site-level evidence, not user data. They are created with
`CREATE TABLE IF NOT EXISTS` by the store that owns them, run raw SQL through
the libSQL client, and were built this way deliberately: a fact about the Acora
QRC-2 belongs to the QRC-2, not to one listener's account, and these stores
must work on a deployment where Prisma is unavailable.

## The rule

**A normal developer command must not be able to silently delete category 2.**

A production schema change requires either:

1. an explicit targeted migration, reviewed and applied against the specific
   tables it touches; or
2. a future migration system that understands every production table.

`scripts/guard-prisma-push.mjs` enforces this: `npm run db:push` refuses to run
against production while any category-2 table exists outside the schema. It is
a fail-fast guard, not a policy document.

## Why not simply add the four tables to `schema.prisma`

Tempting and not obviously safe. Their DDL is authored by the stores
themselves, they are created lazily on first write, and their shape has already
changed once in production (`CorroborationCache` → `CorroborationCacheV2`,
after a BIGINT column made every read fail). Declaring them in Prisma without
first moving ownership would leave two writers for one table definition — a
worse failure than the one being fixed, because it would appear to be safe.

The ownership question is open. The guard is what makes leaving it open safe.
