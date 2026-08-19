# Assessment as Artifact — delivery architecture

**Phase 5, overnight pass 2026-08-19. Specification. No site redesign.
Two trivial, isolated fixes landed; everything else is specified only.**

Four delivery modes — **Read on web · Print · Save as PDF · Share** — must not
become four separately generated assessments.

---

## 1. The convergence point already exists

`CanonicalAssessment` (the CAM, `lib/artifact/canonical.ts`) is described in
its own header as "the single typed normalization boundary between the engine
payload and the shared Assessment Renderer, so one assessment renders many
ways without two implementations."

That is the right boundary and it is already built. **The architecture problem
is not that a convergence point is missing — it is that the CAM was leaking,
and that only one of the four modes actually renders from it.**

The pipeline today:

```
systemText
  └─ buildSystemAssessment(…, manufacturerEvidence)   ← engine
       └─ MemoFindings                                 ← structured contract
            └─ synthesizeArtifact  → ArtifactPayload   ← composed prose
                 └─ toCanonicalAssessment → CAM        ← presentation-neutral
                      └─ AssessmentArtifact (React)    ← the ONLY renderer
                           ├─ web        (print=false)
                           └─ print      (print=true, @media print)
```

`Save as PDF` is the browser's print dialogue against that same component.
`Share` is a URL that re-runs the whole pipeline server-side.

## 2. What was actually wrong (fixed this pass)

Two leaks, both now closed, because the boundary is worthless if things fall
out of it:

- **The CAM dropped `keyDatum`.** The headroom figure — "≈ 87 dB, the most
  this pairing plays cleanly" — reached the web artifact and stopped. Print
  and share lost the single most concrete statement in the assessment.
- **The evidence statement was a constant.** Every artifact claimed
  "manufacturer documentation, designer statements" regardless of what was
  held. Now derived once at synthesis and carried in the payload, so a saved
  snapshot — which holds no engine findings — states the same basis the live
  assessment did.

The general rule these two violations share, and the one that governs
everything below:

> **Anything a renderer needs must be IN the CAM. A renderer that reaches past
> the CAM — to the raw result, to the engine, to a constant — has created a
> second assessment.**

## 3. Remaining structural gap: `Share` is a re-render, not an artifact

`/artifact?system=<text>` re-runs the engine on every request. That is fine
for a link the author opens, and wrong for a shared one:

- the catalogue, the evidence store and the engine all move, so the same URL
  yields a different assessment next month;
- it carries the listener's system description in the query string;
- manufacturer evidence is read live, so a store failure silently downgrades
  someone else's copy of the assessment.

**Sharing is a persistence + access + privacy problem.** A shared assessment
must be a *stored CAM*, addressed by an opaque id, rendered from storage and
never re-derived. `engineVersion()` already exists on the pipeline for exactly
this reason, which suggests the intent was there.

**This is on the stop list (assessment persistence / public sharing) and is
NOT designed further here.** The architectural constraint worth recording: the
stored object is the **CAM**, not the payload and not the input text. It is
presentation-neutral, it is what every renderer already consumes, and storing
it makes a shared assessment immutable by construction.

## 4. Print and PDF: the actual gap is typographic, not architectural

Print today is `@media print{ .axa-root{background:#fff;color:#000} }` plus
hiding contradictions. Everything else — sizes, measure, leading, page
breaks — is the screen design photographed onto paper. That is precisely the
"webpage someone happened to print" quality.

No new pipeline is needed. What is needed is a print stylesheet that treats
paper as its own medium.

**Screen body** is currently `1.1875rem` (19px) on `.axx-judgment p` and
`.axx-reading p` — above the 12–14px target. Reducing the number alone would
be wrong; the target is a judgement about size *with* leading and measure:

| | Now | Target |
|---|---|---|
| Screen body size | 19px | 13–14px |
| Screen leading | 1.62 | 1.55–1.6 |
| Screen measure | unbounded in `.axx-reading` | 62–72ch |
| Print body size | inherits ~19px | 9.5–11pt |
| Print leading | 1.62 | 1.35–1.45 |
| Print measure | full page width | 68–78 characters |

**2–3 pages is a consequence, not a lever.** It follows from the sizes above
plus the rules below. It is never reached by deleting licensed analysis — if
an assessment runs to four pages because the engine licensed four pages of
findings, it is a four-page assessment.

Print rules to specify (not yet built):
- `@page { margin: 18mm 16mm; }` with a running footer carrying the evidence
  statement and edition.
- `break-inside: avoid` on axis rows, the key-datum block and the component
  strip; `break-after: avoid` on every section heading.
- Component photos: either print at a deliberate size or are suppressed —
  they must not be screen images at screen density.
- The tonal-signature graph needs a print form that survives without colour.
- **The provenance disclosure degrades to static text** (specified in
  `provenance-disclosure.ts`): the same paragraphs, rendered as a block under
  the evidence statement, since there is nothing to click on paper.

## 5. Recommended sequence

1. **Close CAM leaks** — done this pass (`keyDatum`, derived evidence
   statement). Any future field a renderer needs goes in the CAM first.
2. **Print stylesheet as its own medium** — the highest-value remaining work
   and entirely isolated: no engine change, no pipeline change, one CSS file
   and a `@page` block. This is what makes the artifact feel typeset.
3. **Screen typography pass** — 19px → 13–14px with measure and leading
   judged together. Touches the same file; do it in the same sitting so the
   two are calibrated against each other rather than separately.
4. **Stored-CAM sharing** — requires the persistence decision. Blocked, and
   correctly so.

Steps 2 and 3 need no architectural permission. Step 4 needs a product
decision that has not been made.
