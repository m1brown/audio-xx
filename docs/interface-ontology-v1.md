# Interface Ontology v1

**Status:** governing for assessment reasoning
**Date:** 2026-08-24

The unit of reasoning is the **interface**, not the component. Two components
with excellent dossiers and nothing established between them is a system Audio
XX does not understand, and must say so.

Implemented by `apps/web/src/lib/artifact/causal-coverage.ts`.
Quantity guards in `apps/web/src/lib/evidence/quantity-compatibility.ts`.

---

## The licensing chain

    COMPONENT EVIDENCE A
  + COMPONENT EVIDENCE B
  + INTERACTION RULE
  + COMPATIBLE CONDITIONS
  → LICENSED SYSTEM INFERENCE

All four inputs are required. Missing any one produces an UNRESOLVED
relationship with a **named** cause — never "insufficient evidence".

---

## Why an interface is unresolved

| Cause | Meaning | Fixed by |
|---|---|---|
| `no_interaction_rule` | Audio XX has no rule relating these two evidence types | architecture work |
| `missing_product_evidence` | The rule exists; a figure is absent | evidence acquisition |
| `incompatible_conditions` | Both sides publish, but the conditions do not correspond | nothing — a correct refusal |
| `not_publicly_established` | Nobody publishes what would be needed | nothing — a correct limit |

The taxonomy is the diagnostic value. A system that knows *which figure* is
missing can ask the listener for it. A system that only knows it is short of
evidence can do nothing but hedge.

---

## The interfaces

### 1. Source / streamer → DAC

**Ideal questions.** Does the transport constrain what the DAC can resolve?
Is the clocking relationship one where jitter is plausibly audible?

**Required evidence.** Interface type and supported formats on both sides;
clock architecture; whether the DAC reclocks.

**Currently held.** Essentially nothing. Format lists appear in some dossiers;
clock architecture almost never.

**Licensed.** Format compatibility, where both sides publish their interfaces.

**NOT licensed.** Any claim that one transport sounds different from another
through the same DAC. Jitter audibility is not established by a specification.

**Status.** `no_interaction_rule` — and correctly so. The rule would need
evidence the catalog does not carry.

---

### 2. DAC → preamplifier — and 3. Preamplifier → power amplifier

Treated together: they are the same electrical question at two points.

**Ideal questions.** Can the upstream stage drive the downstream input without
loss of level or bandwidth? Is there a gain mismatch that costs usable
travel on the volume control?

**Required evidence.** Upstream **output impedance**, downstream **input
impedance** — for the loading question. Upstream **output level**, downstream
**input sensitivity** — for the gain question.

**Currently held.** Neither, for almost every product. Dossiers carry
frequency response, input lists and tube complements, none of which relate two
line-level stages.

**Licensed today.** Nothing.

**NOT licensed.** That a tube preamplifier "warms" a solid-state amplifier;
that either stage constrains the other; that a gain mismatch exists.

**Licensed (added 2026-08-25).** The ratio of input to output impedance, on a
MATCHED connection, establishes a loading **margin** — conventionally a load
should present ten times the source impedance or more. Stated as a margin and
nothing else.

**NOT licensed.** Any audible consequence. A real deviation depends on how the
source's output impedance behaves *across frequency*, and a single figure at
one point says nothing about that curve. This is the same boundary as nominal
impedance versus electrical difficulty, at the other end of the chain.

Conditions are matched before the arithmetic: Audio Research publishes the
Reference 5 at "600 ohms balanced, 300 ohms single-ended", and a balanced
output against a single-ended input is not a like-for-like ratio.

**Status.** `missing_product_evidence`.

> **Correction (2026-08-25).** An earlier version of this document said "the
> rule is implemented — hold both impedances and the interface resolves". That
> was wrong. Coverage *detected* the two labels and reported EXPLAINED, while
> nothing composed a sentence from the figures: "explained" meant "detected".
> Coverage over-claiming is worse than a gap, because it hides one. The rule
> is implemented now, and coverage requires a comparable pair before it will
> claim to have explained anything.

This remains the highest-value acquisition target in the ontology — every
line-level interface in every reference system is unresolved for want of these
two figures.

*Nathan specifically:* dCS → ARC and ARC → Butler produce no relational
analysis, because no held fact relates them. That is the correct output, not a
defect to be written around.

---

### 4/5. Integrated amplifier → loudspeaker · Power amplifier → loudspeaker

The same interface; the only difference is how many boxes precede it. **The one
interface where the catalog routinely holds both sides**, and therefore where
almost all genuine system-level inference currently happens.

**Ideal questions.** Does the amplifier's output suit this loudspeaker? How
loud will the pairing play in this room? Does the amplifier behave as a voltage
source into this load?

**Required evidence.**
- amplifier **power output**, *with its stated load, status and basis*
- loudspeaker **nominal impedance**
- loudspeaker **power handling range** — for the limits question
- loudspeaker **sensitivity** — for the loudness question
- loudspeaker **impedance minimum and phase** — for the difficulty question

**Licensed.**
- *Which figure applies*: the loudspeaker's nominal load selects the
  amplifier figure to read.
- *Within published limits*: output at that load, set against the
  loudspeaker's rated window.
- *Outside published limits*: the same comparison reaching the opposite
  conclusion. **Both directions are equally licensed** — see D-12b below.
- *Voltage-source behaviour*: two like-for-like figures at two loads
  establish whether output scales, and by how much.

**NOT licensed — the difficulty boundary.** A nominal impedance is one summary
number. It establishes **compatibility**, never **difficulty**. It does not
establish minimum impedance, phase angle, or current drawn across the real
curve. So none of these are sayable from it: "demanding", "current-hungry",
"easy to drive", "difficult load", "a demand for current rather than voltage".

Nor is driver count evidence about impedance behaviour.

Nor does "within published limits" mean the match is a good one. A published
minimum is a maker's recommendation, not a measurement of the pairing.

**Status.** `explained` or `partially_explained` when both dossiers are
populated. Sensitivity is the single most commonly missing figure, and its
absence downgrades loudness to `partially_explained` while leaving
compatibility fully established.

---

### 6. Source / DAC → integrated amplifier

Electrically identical to interfaces 2/3, and derived from the chain present
rather than hardcoded — a system with no preamplifier still has this interface
examined.

---

### 7. Loudspeaker → room

**Ideal questions.** Will this loudspeaker load this room?

**Status.** `not_publicly_established` on the product side, and the room is
not evidence Audio XX holds at all. Room dimensions are a **diagnostic
question to the listener**, not an inference.

---

## D-12b — Symmetry of licensed conclusions

> If evidence licenses a positive conclusion at an interface, the same evidence
> licenses the negative conclusion. A system that can confirm compatibility but
> falls silent on incompatibility is not restrained; it is broken in one
> direction.

Restraint is refusing a claim the evidence does not support. Refusing a claim
the evidence *does* support is a different failure that wears restraint's
clothing.

## D-12c — Conditions are part of licensing

Before any arithmetic, comparison, scaling or relational inference over
published quantities, every material condition must be verified compatible:
units, load, operating condition, measurement basis, minimum/typical/maximum
status, continuous/peak, channel configuration, bandwidth, and manufacturer
versus independent measurement.

A refusal carries its **reason**, so the coverage matrix can report
"incompatible evidence conditions" rather than the useless "insufficient
evidence".

The worked example that forced this: Butler publishes, in one string,
`Minimum 100 W RMS @ 8 Ω; 128 W RMS typical @ 8 Ω; 200 W RMS typical @ 4 Ω`.
First-match takes the *minimum* at 8 Ω against the *typical* at 4 Ω and reports
the amplifier doubling its power. Like-for-like it rises about 1.6×. **Nothing
about the wrong answer looks wrong** — which is why the check is architectural
and not a fix at one call site.
