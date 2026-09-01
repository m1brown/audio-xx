# MVP Milestone 1 — Report

**Milestone:** Frictionless core loop — Build Your System → Assessment → Print/Share
**Date:** 2026-07-20 · **Status:** Complete, awaiting review before Milestone 2

## Completed work

1. **Catalog typeahead index** — `scripts/generate-catalog-index.ts` compiles the real product catalog (the five TypeScript product modules, 182 products across DAC / amplifier / speaker / headphone / IEM / streamer / turntable) into a committed 8 KB JSON (`apps/web/src/product/catalog-index.json`). A sync-guard test fails CI if the modules and index ever drift.
2. **System Builder** (`apps/web/src/product/SystemBuilder.tsx`) — the landing cover's primary interaction under "Begin Here": three labeled fields (Source or DAC / Amplifier / Speakers or headphones) with instant catalog suggestions, free text accepted as typed, up to six components, single CTA **Read my assessment** (enabled at ≥2 components). Enter picks the top suggestion; Escape closes. The conversational composer remains below under "Or describe it in your own words" — the full advisory chat is untouched.
3. **Search + composition logic** (`catalog-search.ts`, `compose-system-text.ts`) — pure modules: token-prefix ranked search; builder fields → the proven engine phrasing `Assess my system: A, B, C` → self-contained `/artifact?system=…` URL.
4. **Assessment action bar** (`ArtifactActions.tsx`) — Print (browser print, tuned print CSS), Copy link (flips to "Link copied"; the URL *is* the payload so a pasted link renders identically for anyone, forever), Save this system (honest Milestone-2 placeholder explaining the permanent link), New assessment. Hidden in `?print=1` and `@media print`.
5. **Failure path** — an unresolvable system on `/artifact` now shows an editorial notice with "Build your system →" instead of a bare engine message.

## Architectural decisions (full rationale in `docs/mvp-product-architecture.md`)

- **The assessment stays stateless and free**: URL → in-process frozen engine → server-rendered artifact. Sharing and printing need no accounts, storage, or rate limits.
- **Static bundled catalog index** instead of a search API: no auth question, no latency, works in every preview; guarded by a drift test.
- **Builder navigates to the existing `/artifact` route** rather than adding a new render path — one artifact pipeline, already covered by the regression suite.
- **Product test suite is separate** (`apps/web/src/product/__tests__/`) and imports only product modules + the public engine entry points — never chat internals.

## Tests performed & results

- **Product suite (new):** 17 tests, all passing — catalog/module sync, entry completeness, typeahead behaviour (partials, brand-first ranking, multi-token, junk, limits), composition rules (≥2 components, whitespace normalisation), URL round-trip, and the full spine (composed text → engine → synthesized artifact payload for catalog, mainstream, and unknown-gear systems; no internal-taxonomy leakage).
- **Engine regression gate:** 3,781 passing · 20 known-failure baseline · **0 new failures**.
- **Manual acceptance (live dev server):** landing renders builder under the cover; "pontus" → *Denafrips Pontus II 12th-1 — DAC* suggestion; click-to-fill works; completed system navigates to `/artifact?system=…` and renders the full editorial artifact ("Nothing here needs changing" for the Pontus/Leben/DeVore chain); Copy link flips to "Link copied"; `?print=1` contains the verdict but no action bar; unknown-gear system shows the guided failure path; mobile (375 px): builder visible, no horizontal overflow.

## Known limitations

- **Save this system** is a placeholder note until Milestone 2 — deliberate, and it tells the truth (the permanent link is today's save).
- Typeahead selection is click/Enter-only (no arrow-key highlight). Cheap to add; deferred as polish.
- The `/artifact` page has no OG/meta tags yet, so shared links unfurl without a preview card — Milestone 5 (launch hardening) item.
- Suggestions come from the 182-product catalog; gear outside it simply stays free text (by design — the engine's brand inference still applies).
- The builder does not yet pre-warm `/artifact` (no prefetch); first navigation compiles the route in dev but is fast in production builds.

## Remaining risks

- The chat composer and builder coexist on the landing; watch real-user behaviour for confusion between the two entry points (analytics on which path users choose would settle whether the composer should move further down — Milestone 5).
- Long free-text component names produce long URLs; fine for modern browsers/messengers, but pretty share links (`/a/<id>`) are the eventual answer (roadmap).

## Open questions for review

1. Placement approval: builder above composer, composer kept under "Or describe it in your own words" — is this the right hierarchy for launch?
2. Should "Save this system" be hidden entirely until M2 instead of showing the coming-soon note? (Current choice: visible + honest, so the action bar's final shape is already in place.)

## Recommended next milestone

**Milestone 2 — Save System → account → persistence:** the save action becomes real (create-account card → persist `System` + new `AssessmentSnapshot` model → My Systems list with rename + revisit). It is the smallest step that turns the anonymous loop into a collection, and it exercises the auth + Prisma layers that already exist.
