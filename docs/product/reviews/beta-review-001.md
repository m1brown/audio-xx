# Beta Learning Review 001 — IN PROGRESS (collecting)

Opened 2026-08-03. Quantitative sections will be populated once the
period reaches ~10–20 meaningful sessions. Qualitative observations are
recorded as they occur, per the template.

## 0. Review header

| Field | Value |
|---|---|
| Review number | 001 |
| Period covered | 2026-08-03 → (open) |
| Meaningful sessions in period | collecting |
| Production commit(s) during period | b5de86a → 21a6b69 |
| Reviewer | Claude (founder-accepted entries) |

## 2. Qualitative observations (rolling)

### Q-001.1 — Colon-list entry with editorial verbs (founder, production, 2026-08-03)

**Observation.** Users naturally introduce component lists with simple
editorial verbs (for example, `review:`) and frequently reuse the same
formatting (`·` separators) that Audio XX itself generates when
displaying saved systems.

**Action.** Expanded assessment-intent recognition to support natural
editorial lead-ins (`review:` / `assess:` / `evaluate:` / `rate:`,
anchored to the start of the message) and product-generated component
formatting (`·`, `•` as chain separators) while preserving existing
intent boundaries. Commit `21a6b69`; pinned by
`review-colon-entry.test.ts` (8 regression tests on the new forms and
the neighbouring intents that must not move).

**Result.** System Assessment now correctly recognizes these natural
inputs without affecting comparison, trade-off, or other neighboring
intent classifications. Verified in production 2026-08-03: the original
misrouted message renders System Assessment; `X vs Y` still renders
Comparison.

**Doctrine note.** Recorded as a qualitative learning, not merely a bug
fix: the product's own output formatting teaches users an input
grammar — the parser must accept what the product itself prints.
First observed instance of the post-baseline learning loop (observed
behavior → smallest effective change → bounded scope → neighbours
pinned).

*(Sections 1, 3–6 to be populated at review close.)*
