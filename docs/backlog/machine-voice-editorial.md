# Machine-voice editorial defects

**Opened:** 2026-08-13 (founder, reviewing production)
**Status:** OPEN — logged, not started. No copy has been changed.
**Class:** editorial quality (not engineering)

## The complaint

Founder, reading two unrelated production surfaces on the same day:

> "this page seems very much written by AI. not natural."
> — https://audio-xx.com/tech/musical-communication-school

> "this line also sounds very unnatural" (System Assessment, FRANCE system)
> — "Warmth runs through the whole system, tone placed ahead of edge."

Two instances, two different subsystems, one symptom: prose that is
grammatical and on-doctrine but reads as generated — aphoristic, abstract,
self-repeating, and unattached to a specific listener or object.

## Instance 1 — school page opening

Quoted for removal (founder: "let's remove all of this"):

```
Musical Communication School
The chain is the unit of design — voiced choices at every junction, end to end.

The chain is the unit of design.

Every junction — cartridge, conversion, amplification, loudspeaker — is a
voiced choice made against the others, not against an isolated measurement target.
```

Source: `apps/web/src/lib/technology-profiles.ts`
- `tagline` (~line 1480)
- `manifesto.pullQuote` + `manifesto.supporting` (~line 1487–1490)

The specific tell: the tagline and the pull-quote are **the same sentence,
twice, inches apart** — the tagline is "The chain is the unit of design — voiced
choices at every junction, end to end", then the manifesto restates "The chain is
the unit of design." A human editor would never set the same line twice as
though the repetition were emphasis.

Scope, checked 2026-08-13: **only one profile of the 128 carries a `manifesto`
block** — this one. So this is a contained edit, not a systemic pattern to
unwind. The structure was added as a "Phase 2 school page top section" that
deliberately resurfaces prose from further down the page; on the single profile
that uses it, that resurfacing produced verbatim self-repetition. Removing the
`manifesto` field (and reviewing the tagline) fixes the reported instance
without touching the other 127 profiles.

## Instance 2 — Dominant character line

`composeDominantCharacter()` in `apps/web/src/lib/artifact/canonical.ts`
(~line 170) selects between **four hard-coded sentences** by axis flag. Every
warm system in the catalogue receives the identical line. It is a template
wearing the costume of an observation.

Already partially addressed 2026-08-13: the line was demoted from pull-quote
staging to ordinary labeled prose (commit 7695cef) after the founder said it
was "trying too hard". That fixed the *presentation*; this item is the
remaining *copy* defect, previously filed as "option C — post-beta engine work".

Two candidate resolutions:
1. **Remove the section.** Consistent with the restraint doctrine — the product
   should not manufacture a summarising flourish it cannot ground. Cheapest,
   and loses little.
2. **Compose it from the system's own evidence** (named components, actual
   axis distances) instead of four templates. This is the causal-explanation
   north-star direction and is real engine work.

## Governing constraints

- Editorial changes follow the **Five-Step Editorial Pattern** in CLAUDE.md:
  inspect → propose with exact before/after prose quoted → apply only after
  explicit founder confirmation. Do not edit copy autonomously.
- `docs/design-doctrine-v1.md` and the editorial-restraint invariant already
  forbid the register this drifts toward; the defect is that generated prose
  satisfies the *word list* while failing the *voice*.
- Worth deciding as one theme rather than two tickets: the underlying question
  is which surfaces are allowed to carry **generated** prose at all, versus
  authored-once editorial prose.

## Not doing yet

Nothing has been changed. Next step when the founder picks this up: audit how
widely the two patterns appear (school-page manifestos across profiles; the
four dominant-character templates across catalogue systems), then propose exact
copy diffs for approval.

---

## DECIDED 2026-08-13 — Dominant Character: name the responsible component

Founder decision: resolution #2 (compose from evidence), scoped **post-beta**.
The line should name **the component responsible for the character**, not
restate the character.

Why this is the right target: the standfirst already names the character
("Tonally balanced, detail-forward…") and the Tonal Signature graph plots it.
A third restatement is the repetition defect this document is about. Naming the
*cause* is the one thing on that page which is not already said, and it is the
causal-explanation north star in miniature — facts → cause → conclusion.

### What it must be built from

The engine already carries the input: `findings.perComponentAxes` (per-component
axis values + catalog source) alongside `findings.systemChain.roles`, and since
2026-08-13 the role-weighted numeric aggregation
`findings.systemAxisNumeric` (`synthesiseSystemAxisNumeric` in axis-types.ts).

The responsible component for an axis = the component whose weighted
contribution moves the system value furthest from neutral on that axis. That is
computable from data already present — `resolveAxisIntensity(component) × roleWeight(role)`
per component, ranked. No new catalog data required.

Shape (illustrative, not authored copy):
> "The WLM Diva monitor sets the system's warmth; the Job integrated follows it
>  rather than correcting it."

### Admission rules (D-7 / D-8)

- Only emit when ONE component clearly dominates the axis — if two components
  contribute comparably, there is no single responsible party and the honest
  output is no line at all.
- Only emit for an axis the system actually commits to (outside the ±0.35
  balanced band). A balanced system has no dominant character; say nothing.
- Never infer designer intent ("meant to", "designed to") — the existing
  `validateDominantCharacter` teleology/justification checks still apply.
- The named component must be one the assessment already lists, so the claim is
  traceable to the same evidence the rest of the page rests on.

### Blocking defect to resolve first (or as part of this work)

`composeDominantCharacter()` currently reads the **categorical** `systemAxes`,
making it the last consumer of the pre-unification aggregation. When categorical
and numeric disagree — i.e. whenever a categorical pole sits inside the numeric
balanced band — the line contradicts the graph and standfirst on the same page.
Observed live on production 2026-08-13 with the founder's FRANCE system:
graph BALANCED (numeric −0.29) + standfirst "Tonally balanced" +
dominant character "Warmth runs through the whole system."

Whatever happens in the interim, the rebuilt version must read
`systemAxisNumeric`, not `systemAxes`.
