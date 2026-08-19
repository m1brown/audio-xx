# System stature and market position — investigation

**Phase 3, overnight pass 2026-08-19. Investigation and schema specification.
No implementation. No new evidence class created.**

---

## The problem, stated precisely

A system containing a dCS Rossini Apex, an Audio Research Reference 5, a
Butler MONAD A100 and Acora QRC-2 loudspeakers currently reads as four
arbitrary components that happen to be in a chain. Nothing in the assessment
registers that three of those four are the upper reaches of their makers'
ranges, or that this is a deliberately assembled separates system rather than
a starter chain.

That is a real gap in usefulness. It is also the single most dangerous place
in the product to be careless, because the obvious ways to close it are all
forbidden.

## The three-way separation

Everything below turns on keeping these apart. They are not degrees of the
same thing; the third is a different kind of statement entirely.

**1. Product fact** — a property of the object.
*"The Reference 5 is a line-level preamplifier with 6H30 tubes."*
Source: manufacturer publication, curated catalogue. Already modelled
(`ManufacturerFact`, catalogue entries).

**2. Market-position fact** — a property of the object's place in a range or
a market, verifiable without reference to any owner.
*"The Reference 5 sat at the top of Audio Research's preamplifier range at
launch."* *"Acora build granite-cabinet loudspeakers in small numbers."*
Source: manufacturer range structure, published price positioning, production
scale. **Not currently modelled.**

**3. Inference about the owner** — FORBIDDEN, without exception.
*"This listener is serious."* *"A system at this level suggests…"*
*"An experienced audiophile would…"*
No source makes this admissible. It is not a weaker claim to be hedged; it is
a claim Audio XX does not make.

The failure mode is that (2) slides into (3) in the writing rather than in the
data. "This is an ambitious system" is a market-position statement about
components. "This is a serious listener's system" is the forbidden one. The
distance between those two sentences is one word, which is why the prohibition
has to live in the generation layer and in tests, not only in the schema.

## What Audio XX could truthfully say today

Ranked by evidential strength.

| Claim | Truthful now? | Basis |
|---|---|---|
| "The Reference 5 is a preamplifier" | Yes | Product fact, held |
| "Acora publish 86 dB sensitivity for the QRC-2" | Yes | ManufacturerFact, held |
| "This is a separates system: source, preamplifier, power amplifier, speakers" | **Yes** | Derivable from resolved roles alone |
| "Three of these four components are not in Audio XX's curated catalogue" | **Yes** | Provenance, already carried |
| "The Reference 5 is the top of ARC's preamplifier range" | No | Requires range structure we do not hold |
| "These are unusually ambitious components" | No | Requires positioning data we do not hold |
| "This listener has invested significantly" | **Never** | Category 3 |

The two "Yes" rows in bold are worth noticing: **chain-shape recognition is
available today from data already resolved, and needs no new evidence class at
all.** Naming a system as a separates chain with a discrete preamplifier and
power amplifier is a statement about configuration, not stature, and it would
already make the beta system read less like four arbitrary boxes. That is the
cheap, safe half of the problem.

The rest genuinely requires new data.

## Why market position must NOT go into ManufacturerFact

The store exists and would accept it. That is the temptation and the reason to
refuse.

1. **Different trust regime.** `ManufacturerFact` admits specifications from
   the maker's own domain, on the reasoning that a maker publishing "86 dB"
   is making a checkable claim they stand behind. A maker describing their
   own product's market position is *marketing*, and the existing
   `SONIC_OR_EVALUATIVE` filter already exists because first-party sources
   mix the two freely. "Our flagship" is not the same kind of statement as
   "86 dB".

2. **Different scope.** Manufacturer facts are `scope: 'product'` by
   construction, with the comment "a manufacturer publishes about the thing
   they made, never about their catalogue in general." Range structure is
   inherently a statement about the catalogue.

3. **Different revalidation cadence.** A published sensitivity does not
   change. Range position changes whenever the maker launches something —
   "flagship" has a shelf life, and a 180-day TTL built for specifications is
   wrong for it.

4. **Contamination is one-way and unrecoverable.** Once positioning rows sit
   in the same table wearing the same class, every consumer that trusts
   `evidenceClass: 'manufacturer'` inherits marketing. The F4 precedent
   applies: the discipline is worth more than the convenience.

## Specification — `RangePosition` (proposed, NOT built)

A separate evidence class, separate store, same `EvidenceItem` consumption
shape.

```ts
type RangeTier = 'entry' | 'mid' | 'upper' | 'flagship' | 'statement';

interface RangePositionFact {
  productKey: string;
  evidenceClass: 'range_position';
  tier: EvidenceTier;            // BELOW manufacturer — see below
  scope: 'product';
  /** Where this product sits in the maker's range for its category. */
  rangeTier: RangeTier;
  /** The category the range is scoped to. "Flagship" is meaningless unscoped. */
  category: string;              // 'preamplifier', 'dac', 'loudspeaker'
  /** Range position is a claim about a MOMENT. */
  asOf: string;                  // ISO date
  supersededBy?: string;         // productKey of the model that displaced it
  attribution: EvidenceAttribution;   // required, as with manufacturer facts
}
```

**Tier placement: below `manufacturer`, above `model`.** It is attributable and
checkable, and it is softer than a measurement — a range has edges that the
maker draws and redraws.

**Deliberately excluded from the schema:**
- price (a market-position proxy that invites owner inference, and volatile)
- "prestige", "high-end", "audiophile" (not facts)
- production volume (rarely published, easily wrong)
- anything scoped to a listener

## Generation rules, if it is ever built

1. `rangeTier` licenses statements about the PRODUCT's place in a RANGE.
   Nothing else.
2. `asOf` must survive into any rendered claim. "The flagship" is false the
   day after it isn't; "the flagship of ARC's range at launch" stays true.
3. A system-level summary may state configuration and evidence coverage —
   "a separates system; three of four components outside the curated
   catalogue" — and may NOT aggregate range tiers into a system-level
   adjective. "An upper-range system" is one short step from the forbidden
   category and buys nothing the component-level facts do not.
4. A forbidden-phrasing test must ship WITH the class, not after it: no
   "serious", "committed", "invested", "discerning", "no-expense-spared",
   "enthusiast-grade", and no second-person inference about the listener.

## Recommendation

**Split the work.**

- **Now, no new class needed:** chain-shape recognition (separates vs
  integrated, discrete preamplifier present, source/pre/power/speaker roles
  named). Available from resolved roles today. Low risk, immediate
  legibility gain on exactly the beta system that prompted this.
- **Later, requires the decision above:** `RangePosition` as its own class
  and store. Do not start until someone decides they want a second
  positioning regime to govern, because the acquisition problem (who says
  what a flagship is?) is harder than the schema.

**Stopped here as instructed** — this needs a new evidence class, which is on
the stop list.
