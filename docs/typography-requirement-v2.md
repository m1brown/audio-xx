# Assessment typography — v2 requirement

**Status:** recorded 2026-08-17. NOT implemented. Supersedes the token-level
note in `typography-recommendation-2026-08-17.md`, which is now understood to
have been insufficient.

## The requirement

The assessment still reads too large at normal 100% browser zoom. **Treat as
unresolved.**

- Ordinary long-form assessment body: **~12–14px rendered, ~13px initial
  target.** Not a token delta from wherever it happens to sit today.
- Judge the **perceived scale of the whole assessment**: body size, line height,
  paragraph spacing, section headings, and column measure together. A body
  reduction alone will not fix perceived density if the measure and leading
  keep marketing-page proportions.
- The objective is **editorial/report reading density**, not enlarged web
  marketing typography.
- Print/PDF uses a conventional editorial body of **~9.5–11pt**, not inherited
  screen typography.
- **Do not shrink labels, provenance markers, navigation or controls
  indiscriminately.** Preserve hierarchy while making the analytical content
  materially denser.

## Method — required before implementation

Show a **100%-zoom before/after of an actual full System Assessment**,
including at least one analysis-heavy section. The change is judged from that
artifact, not from token values.

This is the correction to how the previous pass was run: tokens were proposed
and reasoned about in the abstract, the reduction was too conservative, and the
column measure was never examined at all. The earlier recommendation
(`bodySize` 0.92→0.83rem, `bodyLine` 1.9→1.78) remains a starting point, not an
answer — 0.83rem is ~13.3px, inside the target band, which means the residual
problem is likely leading, paragraph spacing and measure rather than size.
