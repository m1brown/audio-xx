# Reasoning representation — reconciliation memo

**Status:** analysis only, 2026-08-19. No implementation. Written after Slice 4
established that the evidence pipeline works and the assessment still isn't
materially better.

The finding that prompted it:

```
"deeper silences between notes, greater grace, flow, warmth in strings"
  ->  smooth_detailed = smooth
```

Everything downstream then reasons over `smooth`. The rest is unrecoverable.

---

## 1. What `AttributeRecord` loses

`AttributeRecord` is `{ component, axis, value, tier, scope, attribution }`.
`axis` is one of five fixed dimensions and `value` is a direction on it. That
shape can hold a *position*, and nothing else.

Against the seven categories, using Nathan's actual held evidence:

| Category | Real example (held today) | Representable? |
|---|---|---|
| **Sonic quality** | Stereophile on the dCS: *"deeper silences between notes, greater grace, flow, warmth in strings"* | **Lossy.** Becomes `smooth_detailed = smooth`. Four distinct perceptual claims collapse to one; the register ("in strings") is lost; the dimension actually described (decay / noise floor) has no axis. |
| **Mechanism / design fact** | Butler's `tube_complement` (hybrid tube + MOSFET output); Acora's quartz enclosure | **Not at all.** Manufacturer facts become premises only where the field is `power_output`, `sensitivity` or `impedance`. `cabinet_material`, `tube_complement`, `driver_complement` are acquired, admitted, stored — and can never be a premise. |
| **Measured physical fact** | Butler `100W RMS @ 8Ω; 128W RMS`; Acora `4 ohm`; Stereophile's measured *"very low output impedance"* | **Badly.** Live premise P4 read: `power_load = impedance: Measured performance was beyond reproach, with wide input sampling range…` — a paragraph stuffed into a scalar slot, asserting an impedance whose value is prose. Worse than absent: it looks like a quantity and is not one. |
| **Relative / comparative** | SoundStage!: *"compared with the MRC‑2, the QRC‑2 delivered faster transients, greater dynamic range… without compression even at very high levels"* | **Barred.** `comparison` may not be a premise. The single richest observation held about Nathan's loudspeakers contributes nothing. |
| **Conditional** | *"driven by Ideon Audio sources and JMF Audio electronics at Capital AudioFest 2022"* | **Carried, not reasoned over.** The condition survives as a string and is enforced in prose. Audio XX cannot ask whether it *applies to Nathan's chain* — and it doesn't, which is the most useful thing about it. |
| **System-relevant consequence** | *"floated as if apart from the hi‑fi system"*; *"no compression even at very high levels"* | **Not at all.** These are behaviours under conditions, not positions on an axis. They are also the claims a system assessment most wants. |
| **Market / reference position** | Stereophile Recommended Components listing | **Barred** (correctly, as a sonic premise) and **unusable** for stature, which has no representation. |

**One and a half of seven.** And the half is actively harmful: P4 above is a
malformed quantity that the relation builder treated as commensurable with the
Acora's real 4Ω figure.

### The concrete damage, in this run

The published paragraph was:

> *"The amplifier's substantial power output pairs effectively with the Acora
> QRC-2's 4 ohm impedance, ensuring that the speakers are driven with
> authority."*

Both premises are real, cited, manufacturer-published. The conclusion does not
follow. **100W is specified into 8Ω; the loudspeaker is 4Ω.** What the
amplifier delivers into 4Ω is unstated, and a hybrid output stage may or may
not double. Because both facts flattened to `power_load` positions, D-12 saw
two commensurable premises and licensed *reinforcement* — the one relation kind
that is certainly wrong here.

That is not a prose defect. The representation could not tell "two numbers in
the same domain" from "two numbers that combine into a third".

---

## 2. Proposed premise model

A premise becomes a **typed proposition about a subject**, with the axis
demoted from *meaning* to *index*.

```ts
interface Premise {
  id: string;                     // stable; relations reference these
  subject: { productKey: string; displayName: string };
  proposition: Proposition;
  provenance: {
    evidenceClass: EvidenceClass;   // unchanged
    tier: EvidenceTier;             // unchanged
    scope: 'product' | 'brand';     // unchanged
    attribution?: EvidenceAttribution;
    condition?: ObservationCondition;
  };
  strength: 'measured' | 'reported' | 'stated' | 'inferred';
  /** Optional index for finding commensurable premises. NOT the content. */
  projections?: Array<{ axis: string; direction: string }>;
}

type Proposition =
  | { kind: 'quality';    dimension: string; direction: string;
                          register?: string; magnitude?: 'slight' | 'marked' }
  | { kind: 'quantity';   field: string; value: number; unit: string;
                          qualifier?: string }        // "@ 8 ohms", "1W/1m"
  | { kind: 'mechanism';  feature: string; value: string }
  | { kind: 'comparative'; against: string; dimension: string;
                          direction: 'more' | 'less' | 'equal' }
  | { kind: 'consequence'; behaviour: string; whenever?: string }
  | { kind: 'position';   scheme: string; placement: string };
```

Six kinds, closed. `dimension` is free text on `quality` because perceptual
vocabulary is genuinely open — "decay length", "microdynamic variation",
"image detachment" are all real and none is one of our five axes.

**What each field protects:** `subject.productKey` keeps exact-product scope;
`provenance` is unchanged and keeps evidence class, tier, condition and
attribution intact; `strength` records how the source knows it, which is what
separates a bench measurement from a listening impression *within* the same
publication.

**Why `quantity` carries `unit` and `qualifier`:** so `100 W @ 8 Ω` and `4 Ω`
are not both "power_load positions". This single field is what would have
prevented the paragraph above.

---

## 3. What changes in D-12, and what does not

**Unchanged:** the four licensing rules, tier propagation, scope, the
fail-closed publication boundary, `none_establishable` as a success, the rule
that the model proposes and Audio XX decides.

**Changed:** *commensurability* stops meaning "same axis string" and starts
meaning "these proposition types can stand in this relation". A relation kind
becomes licensable only from the proposition kinds that can support it:

| Relation kind | Licensed from | Audio XX's check |
|---|---|---|
| `reinforcement` / `counterweight` | two `quality` premises sharing a dimension (directly, or via projection) | same dimension; opposed or aligned direction; tier = weaker premise |
| `constraint` | two `quantity` premises in one physical domain **with a known combining rule** | units compatible under the rule; **rule computes the consequence, not the model** |
| `complementary_function` | one `mechanism` + one `quality`/`consequence` | requires a design→behaviour link (see risk) |
| `transfer_limited` | any premise whose `condition` names associated equipment absent from this system | **new**, and derivable today |
| `none_establishable` | anything else | unchanged |

The `constraint` case is the important one. Today D-12 asks "same axis?" and
gets yes. Under the proposal it asks "is there a rule combining watts at a
stated impedance with a load impedance?" — and if the answer is "not without
the 4Ω figure", the licensed output is **a named gap**, not a reinforcement.

`transfer_limited` costs almost nothing and is worth more than it sounds: the
Acora's only listening account was made through Ideon and JMF electronics.
Audio XX already holds that string. Under the current schema it can only repeat
it; under the proposal it can *reason* that tonal findings transfer weakly
across a different amplifier while dynamic-compression findings transfer
better.

---

## 4. Nathan, worked

### Premises the richer model would hold

**Butler MONAD A100** — manufacturer
- `quantity` power_output = 100, W, qualifier "minimum, @ 8 Ω" *(measured/stated)*
- `quantity` power_output = 128, W, qualifier "RMS"
- `mechanism` output_stage = hybrid tube + MOSFET

**Acora QRC-2** — manufacturer + Stereophile + SoundStage!
- `quantity` impedance = 4, Ω
- `quality` dimension "tonal richness", direction "rich", *cond:* Ideon/JMF at CAF 2022, Stereophile
- `quality` dimension "microdynamic variation", direction "smooth", same condition
- `consequence` behaviour "images detach from the loudspeakers", same condition
- `comparative` against "Acora MRC-2": dimension "transient speed", direction "more"
- `comparative` against "Acora MRC-2": dimension "dynamic range", direction "more"
- `consequence` behaviour "no audible compression at very high levels", *cond:* showroom A/B

**dCS Rossini APEX** — Stereophile
- `quality` dimension "decay / silence between notes", direction "deeper", *cond:* A/B vs earlier Rossini
- `quality` dimension "tonal warmth", register "strings", direction "more", same condition
- `quality` dimension "treble smoothness", direction "smoother", *cond:* Ethernet vs USB
- `consequence` behaviour "input choice materially changes tonal saturation and bass firmness", same condition
- `quantity` output_impedance, "very low" *(measured, Stereophile — note: no number published, so this stays `quality` unless a figure is held)*

**ARC Reference 5** — manufacturer only, 4 facts, no listening evidence.

### Analytical propositions that become derivable

1. **The power question is open, and Audio XX can say so.** 100 W is specified
   at 8 Ω; the loudspeaker is 4 Ω; the output stage is hybrid. Nothing held
   establishes delivered power into 4 Ω. *Licensed output: a named gap, and a
   specific question worth asking.* Today this same evidence produced "driven
   with authority".
2. **The one listening account of the loudspeaker came from a different
   system.** Tonal findings transfer weakly; the compression finding transfers
   better because it concerns behaviour under level rather than tonal balance.
3. **The DAC's input choice is a real variable in this system.** Stereophile
   found Ethernet and USB materially different on this exact unit. Nathan
   owns a streamer/DAC; this is actionable and specific.
4. **Two independent smoothness findings, both conditioned, neither
   unconditional.** The dCS smoothness was heard against the earlier Rossini;
   the Acora smoothness through other electronics. The honest system-level
   statement is that both point the same way and neither was established in a
   chain resembling this one.
5. **What remains unevidenced.** The ARC contributes only specifications; the
   Butler has no approved listening coverage at all. Half the chain is
   unassessed for sound, and the assessment should say which half.

None of the five is expressible today. Four of them are more useful than
anything in the current output.

---

## 5. Migration from `AttributeRecord`

Additive, not a rewrite.

1. `AttributeRecord` becomes a **projection** of `Premise` — `{component, axis,
   value, tier, scope, attribution}` derived from `subject`, `projections[0]`
   and `provenance`. Every existing consumer keeps working unchanged:
   `validateRelations`, `licensedRelations`,
   `filterUnlicensedRelationalProse`, the brand-scope and condition
   enforcement, the publication boundary.
2. Premise-producing sites (`toAttributeRecords`, manufacturer physical facts,
   model attributes) emit `Premise` and project down.
3. D-12 gains the typed commensurability table **one relation kind at a time**,
   starting with `constraint` — the only one that changes an answer today.
4. `transfer_limited` next; it needs no new data.
5. `complementary_function` last, or never — see the risk.

No big-bang, and each step is independently gated.

---

## 6. Strongest objection

**This is a knowledge-representation project wearing a product's clothes.**

Six proposition kinds need six sets of licensing rules. `complementary_function`
needs a design→behaviour link table — quartz enclosure → low stored energy →
what, exactly? — and that table is unbounded, unowned, and precisely the sort of
artifact that becomes permanent maintenance for one founder. The Product Test
applies: *could a customer tell this was added?* For `constraint` and
`transfer_limited`, plainly yes. For `mechanism` reasoning, only if the link
table is good, and it will not be good for a long time.

Second objection: **the model must emit these reliably.** It has already put
citation strings in URL fields and titles in `sourceUrl`. A six-variant tagged
union is more demanding than what it is currently getting wrong. The mitigation
is that Audio XX now *supplies* premises rather than accepting them — but
acquisition still has to produce the typed propositions in the first place.

Third: **richer premises do not guarantee richer prose.** The publication
boundary drops anything unlicensed, and a longer premise is easier to state
badly. This proposal could produce more silence rather than more insight.

---

## 7. Recommendation

**Evolve — and narrowly.**

The axis model is not wrong. It is insufficient as the *sole* representation,
and the specific insufficiency that costs us today is that a quantity has no
units.

Recommended first step, and only step, until it proves out:

> Add `quantity` with `value`, `unit` and `qualifier` as a first-class
> proposition, and give D-12 a `constraint` rule that licenses a relation
> between two quantities **only where a combining rule exists and its inputs
> are present**. Where they are not, the licensed output is a named gap.

That is small, bounded, needs no new evidence, no ontology and no link table —
and it converts the single most misleading sentence in Nathan's current
assessment into the most useful one.

Then `transfer_limited`, which needs no new data either.

Hold `mechanism`, `comparative` and `position` until those two have shown the
representation earns its keep.

### On the ChatGPT benchmark

Asked directly: **what would this let Audio XX do that a web-enabled LLM does
not do reliably?**

Not "the same analysis with provenance". Three things, and they are narrow:

1. **Refuse an arithmetic that doesn't close.** A general model given "100 W"
   and "4 Ω" will say the amplifier drives the speakers well. It is not
   *wrong* so much as unfounded — and it will not notice that the specification
   is at 8 Ω. Audio XX would decline and name the gap. This is the clearest
   differentiator and it exists today, unbuilt.
2. **Track transfer.** That the only listening account of the QRC-2 came
   through different electronics is in the evidence; a general model reads
   past it, because nothing forces it to carry the condition into the
   conclusion.
3. **Reproducibility.** Same system, same answer, with the premises
   inspectable. A general model gives a different synthesis each time and
   cannot show its evidence.

Being honest about the size of that: it is a *narrow* advantage, and it only
appears where the evidence actually supports arithmetic or transfer reasoning.
On a system with no reviews and no specifications, Audio XX will remain
thinner than a general model, and no representation change fixes that.

What it does **not** buy: breadth, fluency, or the ability to talk about
products we hold nothing on. Those remain a general model's advantages and
this proposal does not contest them.
