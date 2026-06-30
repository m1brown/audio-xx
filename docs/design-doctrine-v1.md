# Audio XX Design Doctrine v1 — Editorial First

**Set:** 2026-06-30, by Mike.
**Status:** Active. Governs every UI change going forward.
**Anchor reference:** the v2 Assessment Artifact (system_assessment surface in production at `audio-xx.com`).

This is a product direction decision, not a one-off redesign.

The assessment artifact is now the **design anchor** for Audio XX.

Do not treat it as a single page. Treat it as the visual language for the entire product.

---

## Core principle

Audio XX is an editorial publication first and an AI application second.

The conversation exists to produce a publication-quality assessment.

Every screen should feel like another page from the same publication.

---

## Design goals

Everything should communicate:

- authority
- restraint
- intelligence
- craftsmanship
- permanence

Never:

- SaaS dashboard
- chatbot UI
- analytics platform
- enterprise software
- feature showcase

---

## Visual language

- Typography is the primary interface.
- Whitespace is a feature.
- Evidence is presented editorially, not as widgets.
- One important number is worth more than ten small metrics.
- Navigation should recede.
- The assessment should dominate visual attention.

---

## The homepage

The homepage should no longer feel like an application shell.

It should feel like the opening spread of the publication.

The assessment CTA is the hero. Everything else supports it.

- Reduce visual noise.
- Increase whitespace.
- Strengthen typography.
- Make the experience feel premium before the visitor types anything.

---

## Every page

The following pages should all feel like they belong to the same publication:

- homepage
- assessments
- product pages
- brand pages
- comparison pages
- learning articles
- glossary
- resources
- saved systems

Do not redesign each page independently.

Instead ask:

> "If this page were another spread in the same magazine, what would it look like?"

---

## Shared design system

Extract reusable design primitives from the assessment artifact. These include:

- typography hierarchy
- spacing scale
- evidence rail
- colour palette
- article width
- grid
- captions
- pull quotes
- editorial metadata
- section dividers
- icon restraint
- interaction patterns

Every new component should be built from these primitives. Avoid introducing new visual languages.

**Existing extraction:** `apps/web/src/lib/editorial-tokens.ts` is the shared module exporting tokens. Brand and preview surfaces already consume it. The doctrine elevates this from "two surfaces" to "every surface."

---

## UI philosophy

When there is a choice between:

- adding UI chrome, or
- improving typography and whitespace

choose typography.

When there is a choice between:

- another card, or
- stronger editorial composition

choose editorial composition.

---

## Product philosophy

The assessment is the product.

Everything before it exists to encourage one.

Everything after it exists to deepen trust and encourage return.

The conversation is not the destination. The publication is.

---

## Implementation approach

This is **not** a redesign sprint.

This becomes the default direction for every future UI change.

Whenever a screen is touched, move it closer to this editorial language.

Do not stop launch work to rebuild the site. Instead, let the new design system gradually replace the existing application shell as features are naturally revised.

Any proposed UI that moves away from this editorial identity should be challenged before implementation.

---

## How to apply (operational form)

When touching any UI:

1. **Ask the spread question.** "If this were another spread in the same magazine, what would it look like?" Answer in one sentence. Apply.
2. **Use editorial-tokens.** If a value isn't there yet, extract it from the assessment artifact's CSS rather than re-inventing.
3. **Subtract before adding.** Before adding a card, label, or section, check whether typography + whitespace could carry the same meaning.
4. **Challenge UI chrome.** Buttons, panels, badges, status pills, sortable tables, breadcrumbs, side rails, share widgets — all default-suspect.
5. **Number discipline.** One large editorial number > many small metrics. If a screen has three "metric cards," one of them is probably the real headline; the other two are noise.

---

## Interaction with prior doctrines

- **[Product Doctrine v1.0](../.claude/projects/-Users-mikebrown-audio-xx/memory/product-doctrine-v1.md)** — advisor-is-the-product. The editorial direction *implements* this doctrine: the advisor's outputs deserve a publication-quality container.
- **Editorial North Star** (memory: `editorial_north_star.md`) — three-test design lens (useful / valuable / insightful) for the *content* of pages. This doctrine governs the *visual container* the content sits in. They are complementary, not redundant.
- **Standing Execution Rule 4 — autonomous-by-default** (memory: `rules_autonomous_mode.md`) — when fixing a UI bug under Rule 4, fold in adjacent editorial-debt issues *if the same file is being touched and the fix doesn't materially expand scope*. The smallest-safe-fix rule still bounds this; the doctrine raises the floor on what "safe to leave behind" means.

---

## What does NOT change

- The recommendation engine is still the primary product surface.
- Existing pages stay as-is until they are naturally touched for unrelated reasons.
- No redesign sprint is being authorised by this document.

## What DOES change

- Every PR that touches a UI surface is now judged against the editorial-first lens.
- New components default-build from `editorial-tokens.ts`.
- "Add a card" / "add a metric pill" / "add a chrome rail" become default-suspect proposals.
- The completion-report voice when shipping UI work should include a one-line "moved closer to editorial language by X" note where applicable.

---

## Versioning

This is **v1**. Future revisions are tagged `design-doctrine-v2.md`, `v3.md`, etc. Earlier versions remain in the repo for historical reference and are NOT deleted. The latest version supersedes all earlier ones; any conflict goes to the latest.
