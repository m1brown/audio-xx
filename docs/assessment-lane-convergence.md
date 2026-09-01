# Assessment lane convergence — migration record

**Date** 2026-08-25 · **Status** complete; reasoning architecture frozen.

## What was wrong

Two lanes could each author user-visible claims:

- the **evidence lane** — dossiers, licensed relationships, composed review;
- the **trait/axis lane** — catalog tendencies expanded into template prose.

They disagreed, and the trait lane was the one production showed. On 24 August
2026 a Leben CS600X with Klipsch Cornwall IV published:

> "Nothing here needs changing."
> "Leben CS600X resolves cleanly; Klipsch Cornwall IV keeps the result musical
> rather than analytical."
> "…leading edges are clean and quick, and the image extends wide without
> being pushed forward."

Audio XX held **zero** manufacturer facts for the Leben and no listening
evidence for either component. The evidence lane, asked the same question,
reported the relationship as unresolved.

The defect is epistemic, not cosmetic: **whichever lane a surface happened to
call decided whether D-7 applied.** Signed-out readers got the weaker path,
and catalogued systems got a confident essay while uncatalogued ones got
restraint — catalog membership deciding whether evidence was required.

## The authoritative product

    evidence
      → licensed relationships
        → evaluation / restraint
          → SYSTEM REVIEW → YOUR SYSTEM → EVIDENCE

`licenseAssessment` (`lib/assessment/authoritative.ts`) runs inside **both**
snapshot builders, so an unlicensed snapshot cannot be constructed. The gate
sits at construction rather than at the renderers because a gate at the
renderer is a gate the next surface forgets to call — which is exactly how
this happened.

`authoritativeAssessment` (`lib/assessment/from-result.ts`) is the single
route from an engine result to a rendered document.

## Scope is part of licensing

The first version of the gate treated "established" as one permission, and a
power-match finding promptly licensed "resolves cleanly" — tonal character
riding in on a wattage comparison. A `power_load` relation establishes what a
system can **do**, never what it sounds like.

| Material | Rule |
|---|---|
| `tonalSignature` | removed always — `AxisReading.pole` is "which pole the SYSTEM commits to", the aggregation no rule licenses |
| `standfirst`, `recognition` | removed always — a tonal summary of the whole chain |
| `operatingCondition` | removed always — `detectStackedTraits` runs on axis profiles |
| Engineering `sections` | removed unless a CONSTRAINT is established |
| `recommendation`, `cost` | kept under a constraint — guidance bounded by the finding that licenses it |
| verdict | recomposed from established relations, unless a constraint supplies specific evidence-derived wording |
| per-component character | **kept**, in YOUR SYSTEM, beside the basis that licenses it |

`composeListeningSession` is deleted, as `composeDominantCharacter` was a
fortnight earlier. Its two gates stopped it *contradicting* the verdict;
neither made it licensed.

## Caller classification

| Caller | Classification | Result |
|---|---|---|
| `AdvisoryMessage` (conversation) | **replace** | renders the authoritative assessment |
| `app/artifact/page.tsx` (shared link) | **replace** | same; deprecated but still user-visible |
| `generateMetadata` (link previews) | **replace** | unfurled "Nothing here needs changing" as the title to everyone who saw the preview |
| `systems/[id]/assessment` (signed-in) | **replace** | licensed on read; legacy rows fail closed |
| `save-system.ts` (write path) | **replace** | stores the licensed snapshot, not the payload |
| `synthesizeArtifact` / CAM | **subordinate input** | presentation adapter; authors nothing user-visible |
| `AssessmentArtifact` | **retained internally** | fallback only when the gate returns null |
| `SystemAssessmentArtifact` | **dead** | unreachable behind a default-off flag |
| `composeListeningSession` | **removed** | no licensed basis in any form |
| `verdictForVerdictLine` | **removed** | composed a verdict from a label |

## Invariants now enforced by test

- one system assessment, multiple surfaces;
- signed-out uses no weaker epistemic path;
- catalog membership does not determine whether D-7 applies;
- no "Nothing here needs changing" without Explain-level support;
- no sonic prediction from catalog axes alone;
- no Listening Session prose unless licensed evidence supports it;
- unresolved interfaces stay unresolved and name the missing fact;
- character survives only where source and conditions license it;
- the artifact is `SYSTEM REVIEW → YOUR SYSTEM → EVIDENCE`.

Controls: `lib/assessment/__tests__/one-assessment.test.ts` (17),
`lib/artifact/__tests__/snapshot-parity.test.ts` (34),
`lib/__tests__/evaluate-requires-explain.test.ts` (6),
`lib/artifact/__tests__/causal-coverage.test.ts` (11).

## Two defects the render itself surfaced

A product name lower-cased into "leaves **leben** CS600X power output
unresolved" — a proper noun mangled by a mid-sentence casing rule.

A document contradicting itself in consecutive sentences: "establishes one
compatibility finding" above "power output not held", because coverage reads
the **dossiers** while the engine's power match reads the **catalog**. An
interface another evidence source has settled is no longer reported as
unresolved.

## Expected consequence

Assessments of thinly-evidenced systems are now visibly **shorter**. That is
the intended result, not a regression: the length was never licensed. It is
remedied by evidence acquisition — see
`docs/audits/evidence-acquisition-backlog.md` — and never by restoring prose.
