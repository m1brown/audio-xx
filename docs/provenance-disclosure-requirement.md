# Provenance disclosure — UX requirement

**Status:** recorded 2026-08-17. NOT implemented. Site-wide pattern.

## The problem

`EXPANDED REASONING` is not self-explanatory. To a listener it reads as an
internal system label and could mean "better reasoning", "more detailed
analysis", or simply "AI-generated". It must explain the **evidence condition**
it represents.

## Requirement

An interactive provenance indicator — badge plus info affordance. Activating it
opens a small popover or disclosure; it does not navigate away.

### Initial copy

> **Expanded Reasoning**
>
> This product sits outside Audio XX's curated catalog. Audio XX has verified
> the product's identity, but does not hold the same depth of reviewed product
> data it has for catalogued components.
>
> To assess it, Audio XX uses its reasoning model together with the evidence
> available for this product and system. Claims based on this broader reasoning
> are treated with greater caution than claims supported by Audio XX's curated
> product evidence.

**Not "an LLM was used."** Model use is disclosed, but the primary information
is epistemic: what evidence Audio XX has, what it does not have, and therefore
how strongly the resulting claims are licensed.

### Assessment-level caption

From:

> "Using expanded reasoning because parts of this system sit outside Audio XX's
> curated catalog."

Toward:

> "Some components fall outside Audio XX's curated catalog, so parts of this
> assessment rely on broader evidence and model reasoning."

### Future state — the evidence stack

```
Evidence used
  ✓ Product identity verified
  ✓ Manufacturer information
  ✓ Independent reviews
  ○ Audio XX curated product profile
```

**Rows must reflect actual evidence state, never decorative or inferred
availability.** ManufacturerFact and independent-review evidence do not exist
yet; the disclosure must not imply they do.

## Architectural requirements

Site-wide, not assessment-specific. "Expanded Reasoning" means the same thing
in system assessments, product pages, comparisons and recommendations. The
component **consumes** the existing provenance/evidence state and establishes
no second source of truth.

D-7 and D-12 semantics are preserved. This explains an evidence state; it is
not a new tier and not a relaxation of licensing.

## Where it enters the sequence

The disclosure is a **renderer** of the basis already computed by
`computeComponentProvenance` / `tierFor`. That state is now stable and
authoritative (`af91558`, `648b1cc`), so nothing blocks a static version today.

Recommended sequencing:

1. **Static disclosure now-ish** — the four-tier basis (catalog / brand / model
   / user) already carries everything the initial copy needs. Small, and it
   removes a live comprehension problem.
2. **Evidence-stack rows after ManufacturerFact lands** — the rows are one line
   per evidence class actually held, so they need classes that exist. Building
   the row model earlier means inventing placeholder states, which is the
   failure the requirement itself warns against.
3. **Site-wide extraction with the payload convergence work** — product pages
   and comparisons do not yet consume a shared provenance payload, so a
   genuinely shared component wants that contract to exist first.

## Architectural conflicts found

**One naming conflict, worth resolving before implementation.** The internal
basis vocabulary and the listener-facing vocabulary have drifted:

| Internal basis | Rendered today |
|---|---|
| `catalog` | (curated / catalog-verified) |
| `brand` | AUDIO XX BRAND EVIDENCE |
| `model` | EXPANDED REASONING |
| `user` | YOUR DESCRIPTION ONLY |

`model` → "Expanded Reasoning" is the mapping the copy above explains, and it
is the only one whose label does not name its evidence. If the disclosure is
built as a lookup keyed by basis, this resolves itself; if it is built per
surface, the vocabularies will drift again.

**A second, smaller one.** `brand` basis carries its own epistemic condition —
Audio XX holds evidence about the *maker*, not this model — and D-12 now
enforces that distinction in prose (`f4ec793`). The disclosure should cover
brand basis too, or a listener will see enforced brand-scoped language with no
explanation of why.

Related: `docs/manufacturer-fact-spec-v1.md` (site-level evidence classes),
`docs/assessment-as-artifact-requirement.md` (share/print carry provenance
too — a printed assessment cannot open a popover, so the artifact needs a
static expression of the same state).
