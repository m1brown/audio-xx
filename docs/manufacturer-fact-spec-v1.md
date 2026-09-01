# ManufacturerFact — evidence-layer specification v1

**Status:** specified, NOT implemented. Next evidence-layer change after the
corroboration-durability repair (`b6ac71c`).

## Why

Audio XX corroborates a listener's product against the manufacturer's own page,
then throws that page away and keeps only "this exists". For the first real beta
system — dCS Rossini APEX → Audio Research Reference 5 → Butler MONAD A100 →
Acora Acoustics QRC-2 — none of the four is catalogued, one has a BrandProfile,
and none has an editorial entry. So the assessment reasons almost entirely from
unattributable model memory while standing on four first-party pages that state
published specifications.

The Acora's granite cabinet is the clearest case. It is a published construction
fact with direct, explainable consequences for stored energy, and it is the kind
of fact that turns enumeration into explanation. Audio XX currently discards it.

This class does not loosen D-7. It *raises* provenance: a quoted, cited,
checkable manufacturer statement is strictly stronger evidence than model recall.

## Architectural placement — site-level, not assessment-level

**Added 2026-08-17 (founder).** These evidence classes are **site-level product
knowledge**, not System Assessment inputs. Acquisition and storage must not be
coupled to the assessment renderer or the provisional reasoning path.

The same licensed evidence must later be consumable by:

- System Assessment
- product and brand pages
- comparisons
- purchase inquiries
- recommendations
- review aggregation

Consequences for the design:

1. **Storage is keyed by product identity, not by turn or assessment.** A fact
   about the Acora QRC-2 belongs to the QRC-2, not to one listener's session.
2. **Acquisition is a background/standalone concern**, reachable from anywhere
   a product identity is resolved — not a step inside provisional reasoning.
   The corroboration hop is a convenient first trigger, not the owner.
3. **The reasoning path is a CONSUMER.** `AttributeRecord` construction reads
   from the store; it does not populate it.
4. **No assessment-shaped fields.** Nothing in the record may presuppose a
   chain, a role, or a listener. Role is a property of a component in a system;
   sensitivity is a property of a loudspeaker.

The same applies to `independent_review` when it arrives.

## Shape

```ts
interface ManufacturerFact {
  /** Normalised product identity this fact belongs to. */
  product: string;
  /** Controlled vocabulary — see Permitted fields. Never free text. */
  field: ManufacturerFactField;
  /** The value as published, units preserved: "96 dB/W/M", "10 ohms". */
  value: string;
  /** First-party page the fact was read from. Required. */
  sourceUrl: string;
  /** The manufacturer's own words, verbatim, for audit. Required. */
  quotedText: string;
  /** When the page was read. Facts age; publication does not. */
  retrievedAt: number;
}

type ManufacturerFactField =
  | 'sensitivity' | 'impedance' | 'power_output' | 'power_handling'
  | 'frequency_response' | 'dimensions' | 'weight'
  | 'topology' | 'cabinet_material' | 'driver_complement'
  | 'tube_complement' | 'inputs' | 'outputs';
```

## Rules

1. **Specification and construction only.** The permitted-field list is the whole
   contract. No sonic character, no quality, no ranking, no price, no
   recommendation. A field not on the list is not returned.
2. **First-party source required.** Same host rule as corroboration — the domain
   must carry an identifying token of the product. A dealer, forum, aggregator
   or publication is not a manufacturer fact.
3. **Quoted, not summarised.** `quotedText` is mandatory. A fact that cannot be
   quoted is not returned. This is what makes the class auditable years later.
4. **Its own tier**, between catalog and model:

   ```
   catalog > brand > manufacturer > model > user
   ```

   Stronger than model memory because it is attributable and checkable; weaker
   than catalog because we have not reviewed it ourselves.
5. **Usable as a D-12 premise.** A ManufacturerFact may be an `AttributeRecord`
   with `tier: 'manufacturer'`, `scope: 'product'`, and participates in
   relations under the existing commensurability and tier-propagation rules
   unchanged. Watts against sensitivity is exactly the commensurable pairing
   D-12 already contemplates, and it feeds the constraint layer repaired in
   `036ccde` — where `classifyPowerMatch` still returns `'unknown'` for every
   uncatalogued component, and `'unknown'` still behaves identically to `'fine'`.
6. **Failure is never evidence.** Same three-state contract as corroboration:
   retrieval that does not complete is `lookup_unknown`, is never cached, and
   never licenses a claim about the product.

## Explicitly out of scope, reserved for later

A separate `independent_review` class from approved publications, governed by
the existing two-tier `SOURCE_WHITELIST` and `EDITORIAL_SOURCES`. **6moons is
excluded and must never be whitelisted** — its absence from the whitelist is the
enforcement, and dormant catalog references are tolerated only because the
filter blocks them at render time.

That class would sit at its own tier below `manufacturer`, would carry
publication, author, URL and quoted text, and would be demand-driven per the
coverage policy rather than authored in bulk.

## Sequencing

Manufacturer facts first: cheap, already reachable on pages corroboration
already loads, and they feed causal explanation immediately. Editorial second,
where observed listener demand justifies the authoring cost.

`marketPosition` (see `catalog-taxonomy.ts`) should be revisited only after this
class exists — it was blocked precisely because no product-position evidence
existed for uncatalogued gear, and this is that evidence.
