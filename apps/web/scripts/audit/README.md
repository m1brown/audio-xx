# Brand Authority Audit Scripts

Re-runnable, read-only audit tooling for the BrandProfile corpus in
`apps/web/src/lib/consultation.ts`. These scripts do not modify any
source — they parse the profiles and report coverage/maturity so the
editorial team can see, at a glance, which brand pages are flagship-
grade and which are still thin.

## Scripts

### `audit-authority-coverage.ts`
Brand Authority Coverage Score — a per-brand 0–100% maturity index.
Re-runnable, percentage-based, complementing the T0/T1/T2/T3 tier
classification. Use it to track corpus maturity over time and to
identify the next-best brand-promotion candidates.

### `audit-brand-maturity.ts`
Brand Authority Maturity audit — per-brand, field-level scoring.
Enumerates every BrandProfile and reports which flagship-tier fields
(philosophyExtended, leadershipOrigin, strengths, tradeoffs,
designFamilies, pairingNotes, media, reviewerQuotes, etc.) are
present, so a single thin page is easy to spot.

## Running

From the repo root, with the workspace's TS runner (e.g. `tsx`):

```
npx tsx apps/web/scripts/audit/audit-authority-coverage.ts
npx tsx apps/web/scripts/audit/audit-brand-maturity.ts
```

Both print a table to stdout and exit 0; neither writes files or
touches the corpus. Safe to run any time.
