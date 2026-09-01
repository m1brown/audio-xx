# Evidence and Provenance Architecture

**Status: GOVERNING.** Established 2026-05-08 (`91f0d40`), documented here
2026-08-15 after it was nearly redesigned by accident.

This document is canonical. Before changing anything about what Audio XX is
allowed to say, or where its knowledge comes from, read this first. The
architecture described here already exists in code. It has been implemented
since May. What it lacked until now was a document — which is why a hardening
pass in August narrowed it without anyone noticing that a decision was being
reversed rather than enforced.

---

## 1. The principle

> **No claim may be presented with greater authority than its evidence source
> warrants.**

That is D-7. Note what it does *not* say. It does not say Audio XX may only
speak about products in its catalog. Catalog coverage governs **how
authoritatively** a claim may be made — never **whether** the subject may be
discussed.

The failure mode this guards against is a claim wearing borrowed authority.
The failure mode it must NOT produce is an advisor that goes mute whenever its
private database is thin.

**Expanded Reasoning is a permanent breadth mechanism, not a temporary
fallback while the catalog fills up.** The catalog gives Audio XX authority;
the model gives it breadth; the provenance layer tells the reader which one
they are getting. That combination is the product. It will still be the
product when the catalog is ten times its current size, because listeners will
always own gear no catalog covers.

---

## 2. The four sources

`AdvisorySource` — `apps/web/src/lib/advisory-response.ts`

| Source | Meaning | Authority |
|---|---|---|
| `catalog` | Curated product entry with verified data | Highest |
| `brand_profile` | Curated brand-level evidence; product not individually covered | High, brand-scoped |
| `llm_inferred` | Model knowledge about a specific component | Lower — must be visible |
| `provisional_system` | Whole-system reading where coverage is thin | Lower — must be visible |

A fifth state is not a source at all: a component known **only because the
listener named it**. That licenses graph structure and nothing else.

---

## 3. The three reasoning modes

`ReasoningMode` — same file.

| Mode | Meaning | User-visible |
|---|---|---|
| `core` | Fully deterministic / curated. Default. | No indicator |
| `expanded` | LLM inference beyond curated coverage | "Expanded reasoning" indicator + caption |
| `hybrid` | Deterministic structure + validated LLM prose | No indicator — structure intact |

`FallbackReason` maps `expanded` to a caption: `unknown_subject`,
`low_confidence_system`, `brand_only`, `open_ended_query`, `thin_output`.

---

## 4. Per-component provenance

The response-level caption says *some* of an answer is model-derived. It cannot
say *which parts*. A system mixing curated and model evidence therefore
presented both in one undifferentiated voice.

`componentProvenance` closes this: every node carries `catalog | brand | model
| user`, **computed by Audio XX from what it actually holds** — never claimed
by the model. A model can report which components it was able to speak to
(`characterized`), which can only lower authority. It cannot promote itself to
`catalog`.

Rendered as a labelled list beneath the assessment: *Audio XX catalog · Audio
XX brand evidence · Expanded reasoning · Your description only.*

---

## 5. Hard prohibitions — no tier licenses these

Characterisation from model knowledge is legitimate. These are not:

- specifications, measurements, power, impedance, sensitivity, dimensions
- prices
- compatibility, matching or drive-capability guarantees stated as fact
- attribution to a review, publication, measurement or named source
- **"community consensus" / "widely regarded" / "reviewers say"** — Audio XX
  holds no evidence of consensus and must not imply it
- invented model designations, lineage or history

Enforced deterministically by `findLicensingViolations`
(`llm-system-inference.ts`), which inspects generated prose sentence by
sentence and exempts sentences that disclaim knowledge. **A prompt is a
preference; the check is the guarantee.**

---

## 6. Graph structure vs. component knowledge

Two questions the implementation once conflated:

- **Is the graph trustworthy?** Explicit `<role>: <name>` labels can establish
  it. The listener stating their own system is strong evidence.
- **Do we know anything about each node?** Only evidence establishes that.

A labelled component we cannot identify is an **opaque node**: name verbatim,
role from the label, present in the graph. Ambiguous prose grants no structure
— see `labelled-components.ts`.

---

## 7. The canonical example

Real beta user, 2026-08-15:

```
Assess my system: Pre-amp: ARC ref 5 Amps: Butler Monads
Dac/Streamer: dCS Rossini Apex Speakers: Acora QRC-2
```

Four real, high-end components. Catalog holds one dCS product (Bartók) and a
dCS brand profile; nothing for Audio Research, Butler or Acora.

**What went wrong, in order:**

1. A compound label was split on `/` as a chain separator, so the outcome
   depended on word order.
2. Component role was inferred from a ±40-character proximity window that
   reached into the next label.
3. Unresolved components were dropped silently.
4. After those were repaired, a D-7 over-correction banned characteristics for
   uncatalogued components — turning *uncatalogued* into *unknowable* and
   producing four paragraphs of "I cannot assess this" for a system a
   knowledgeable person could discuss usefully.

**What the correct answer looks like:** a real assessment — verdict first,
component roles, chain interaction, strengths and trade-offs — with dCS
carrying brand-level curated evidence, ARC / Butler / Acora carried as
Expanded Reasoning, the whole response labelled, and **restraint** at the end:
absent a problem the listener reported, nothing needs changing, and the useful
questions are room, positioning and preference rather than another purchase.

**Why it is canonical:** it is the first real-user turn, and it exercises every
tier at once. Any change to this architecture should be replayed against it.

---

## 8. Rules for changing this

1. Never equate absent catalog coverage with absent knowledge.
2. Never let a model assign its own authority tier.
3. Never remove the deterministic check because the prompt looks sufficient.
4. Restraint is an outcome, not a failure — an assessment that recommends
   nothing is often the correct one.
5. If you are about to make Audio XX say less, check whether you are enforcing
   D-7 or narrowing it. This document exists because that distinction was
   missed once already.

Related: `docs/causal-explanation-architecture-v1.md` §0a (D-7 origin),
`docs/qa-architecture.md`, `CLAUDE.md` (Operational Invariants).
