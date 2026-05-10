# Audio XX — Brand Philosophy Editorial Review

**Status:** v2 editorial discipline document — anchors the master table, the layer-design memo, and the engineering-intent companion memo.
**Created:** 2026-05-10 (v0); revised same day to v1; revised again same day to v2 in response to the editorial-hardening pass that flagged remaining adjective-aggregation drift.
**Companion documents:** [`brand-philosophy-master-table.md`](brand-philosophy-master-table.md), [`brand-philosophy-layer-design.md`](brand-philosophy-layer-design.md), [`engineering-intent-and-audible-behavior.md`](engineering-intent-and-audible-behavior.md).

This memo establishes the editorial discipline the brand-philosophy layer is curated against. Every entry in the master table must respect these principles. This is the standard the layer is reviewed against — at first authoring and at every periodic recalibration.

---

## 1. Editorial principles

The brand-philosophy layer is **identity-preserving editorial reference**. It is not marketing copy, not review summary, not a feature list, not a buying guide. Its purpose is to give the engine a stable, structured account of what each manufacturer fundamentally is so that synthesis cannot drift.

Five principles anchor the discipline:

### 1.1. Matter-of-fact language over evaluative language

Capsules describe *what a brand designs around* and *what listeners consistently observe*. They do not describe *whether the brand is good*. Adjectives like "exceptional," "legendary," "reference-tier," "statement-tier," "class-leading," and "best-in-class" are review-magazine vocabulary and have no place in capsules. They tell the reader what to feel, not what to think.

If a brand is unusually well-regarded for a specific property, the capsule names the property concretely (e.g., "Shindo amplifiers are designed individually around the tube set chosen for each circuit") rather than evaluating the regard ("Shindo is the reference for tube musicality").

### 1.2. Engineering intent before audible result

Capsules lead with *what the brand engineers around* before they describe *what listeners hear*. Audible result is downstream of design intent, not the brand's identity. Two brands can produce a similar audible result through different engineering — and their identities are different. (The full model: § 3.)

### 1.3. Comparative honesty over absolute description

Brand identity is most legible by contrast. The capsule's most useful field for the engine is `comparisonGuardrails`, which names contrastive framings to prefer and to avoid. Absolute descriptions ("warm", "neutral", "fast") become useful only when calibrated against other brands in the same category.

When two brands are described identically across multiple capsule fields, one or both is failing this principle.

### 1.4. Confidence calibrated to source quality

Capsule confidence is rated honestly: `high`, `medium-high`, `medium`, `low`. Confidence reflects editorial evidence quality, not brand prominence. A famous brand with model-line spread that resists single-identity treatment gets `medium` at brand level — not `high` just because it is famous.

Editorial bar:

- **`high`** — multiple independent review-consensus references converge on the same identity description; brand has a single coherent design philosophy across its line; capsule survives sustained editorial review.
- **`medium-high`** — strong identity, but with caveats (niche review coverage, partial model-line variation, confidence in some fields lower than others).
- **`medium`** — identity recognisable but the capsule papers over genuine internal variation, or review-consensus is thin, or the brand spans more than one philosophical line.
- **`low`** — included for catalog completeness; capsule should not be relied on as canonical.

Per-layer confidence (mechanism vs behavior vs perception — see § 3.5) often matters more than a single global rating. A brand may have `high` confidence on documented mechanism but `medium-high` on behavior (less measurement coverage) and `high` on perception (strong review consensus).

### 1.5. Restraint over completeness

A capsule is more useful when it names two or three precise things than when it names ten vague ones. The `engineeringPriorities` and `strengths` fields are short and ordered. If a strength is true of every brand in the category, it is not a strength worth naming.

---

## 2. Terminology discipline

The single most common failure in v0 — and a residual risk in v1 — is adjective conflation. Treating *warm*, *rich*, *dense*, *smooth*, *neutral*, *clean*, *detailed*, *analytical*, *fast*, *dynamic*, *harmonic*, *flow*, and *PRaT* as broadly interchangeable. They are not.

The discipline below is the calibrated vocabulary every capsule must respect. Definitions are operational (what each term *picks out*), not aesthetic.

### 2.1. Tonal-balance terms

| Term | Operational meaning |
|---|---|
| **Warm** | Tonal balance: slight low-mid emphasis and slightly rolled treble. A measurable phenomenon. |
| **Neutral** | Tonal balance: no systematic emphasis or de-emphasis across frequency. |
| **Bright** | Tonal balance: slight treble emphasis relative to mids and bass. |
| **Lean** | Tonal balance: low-mid de-emphasis; the *opposite* of warm without necessarily being bright. |

A brand can be **lean and bright** (analytical / etched), **lean and neutral** (transparent / clean), **warm and dense**, or **warm and smooth** — these are independent variables.

### 2.2. Harmonic / textural terms

| Term | Operational meaning |
|---|---|
| **Rich** | Harmonic content: multiple harmonics audibly present, particularly even-order from tube or class-A solid-state distortion patterns. *Rich* is about harmonic structure, not tonal balance. |
| **Dense** | Tonal weight: timbre carries substantial body and tonal mass. *Dense* is about tonal weight, not necessarily harmonic complexity. |
| **Textured** | Microdynamic / harmonic detail: small-scale tonal variations are audibly present and articulate. |
| **Saturated** | Harmonic intensity: strong harmonic colouration, typically from tube circuits or transformer-coupled output stages. Stronger than *rich*. |

A brand can be **dense without being warm** (Pass Labs, Hegel — bodied solid-state). A brand can be **rich without being warm** (some push-pull tube designs that emphasize harmonics without low-mid lift). A brand can be **textured without being dense** (Chord Electronics — articulate microdynamics with light tonal weight).

### 2.3. Edge / smoothness terms

| Term | Operational meaning |
|---|---|
| **Smooth** | Absence of audible edge / glare on transients and treble; *smooth* describes the leading-edge character, not tonal balance. A neutral DAC can be smooth (dCS). A warm DAC can be smooth (Denafrips). A lean DAC can be smooth (Mola Mola). |
| **Etched** | Hard, defined leading edges; the opposite of *smooth*. |
| **Glare** | Treble peakiness producing audible edge; specifically a tonal-balance pathology. |

### 2.4. Information / presentation terms

| Term | Operational meaning |
|---|---|
| **Clean** | Low distortion / low noise floor; a signal-purity term, not a tonal-balance or harmonic term. |
| **Detailed** | Information-presentation: small details of the recording are audibly present. *Detailed* does not imply *bright* or *etched*. |
| **Analytical** | Information-presentation with a particular cool / dry character. *Analytical* is more specific than *detailed* — it implies presentation tilted toward dissection rather than musical engagement. |
| **Resolved** / **resolving** | Higher-quality variant of *detailed* — capable of resolving fine information without imposing edge. |
| **Transparent** | Low coloration overall; honest signal pass-through. *Transparent* is about coloration absence. (See § 4 — *transparent* is a term requiring caution.) |

### 2.5. Time / dynamics terms

| Term | Operational meaning |
|---|---|
| **Fast** | Transient response: leading edges are quickly defined. *Fast* is about transient timing, not tonal balance or pace. |
| **Elastic** | Transient character: leading edges have natural attack-and-decay shape. |
| **Dynamic** | Amplitude range: the system reproduces loud and quiet passages with appropriate scale. Distinguish *macrodynamic* from *microdynamic*. |
| **Composed** | Steady-state stability: the system maintains coherence at high SPL and complex passages. |
| **Controlled** | Damping: bass and transients reproduced without overshoot or bloom. |

### 2.6. Engagement terms (high-risk)

These are most often used as filler and require concrete grounding when they appear.

| Term | Operational meaning | Discipline |
|---|---|---|
| **Flow** | Musical pacing: melodic and rhythmic lines connect naturally across notes. | Acceptable when describing a brand whose engineering specifically targets timing-domain coherence; else replace with the specific behavior. |
| **PRaT** (pace, rhythm, timing) | British-audio shorthand for rhythmic engagement. | Use sparingly, only for brands with documented timing-domain engineering priority (Naim, Rega, Linn). |
| **Engaging** / **engagement** | High-risk filler. | **Avoid as a primary descriptor.** Acceptable only when paired with the mechanism that produces it (e.g., "rhythmic engagement through timing-domain accuracy"). |
| **Musical** | High-risk filler. | **Avoid as a primary descriptor.** Acceptable only when contrasted with a specific alternative (e.g., "engineered for musical naturalness over measurement specification"). |

---

## 3. Engineering intent vs audible description

The single most important editorial discipline this layer enforces: brand identity is anchored at **engineering intent**, not at **audible description**. The two are different kinds of claim, with different stability and different grounds for confidence.

The companion memo [`engineering-intent-and-audible-behavior.md`](engineering-intent-and-audible-behavior.md) develops the model in depth. The summary belongs here because it shapes how every capsule is authored.

### 3.1. Why engineering intent is more stable than subjective adjectives

Engineering intent is what the brand built. It is documented in manufacturer specifications, design papers, patents. It does not change without a new product. A Denafrips DAC built around a discrete R2R ladder remains R2R regardless of which amp, which speakers, which room, which listener. The mechanism is a fact about the product.

Subjective adjectives — *warm*, *clean*, *fast*, *holographic* — describe perception. Perception is real but listener-dependent, system-dependent, and vocabulary-conflated. Two reviewers will not agree on whether the same DAC is "warm" or "neutral with body." Two listeners in different rooms will hear it differently. The same word will mean different things to different writers.

A layer anchored at perception is fragile. A layer anchored at engineering intent is durable. When the layer says "Denafrips engineers around discrete R2R ladder conversion," that claim survives. When it says "Denafrips is warm," that claim is hostage to vocabulary, system, and listener.

### 3.2. Why experienced listeners reason through topology and design priorities

Experienced listeners — reviewers, engineers, long-time hobbyists — talk about gear in terms of what it is engineered to do. They name the topology (R2R ladder, FPGA pulse-array, class-A solid-state, push-pull tube). They name the engineering priority (timing-domain accuracy, harmonic structure preservation, mechanical-resonance management). They explain what they hear by reference to those choices.

Less experienced listeners talk about gear in terms of what it sounds like. They use perception-level adjectives. The vocabulary is a register difference. An advisory operating in the experienced register reads as credible to experienced listeners and educational to less-experienced ones. An advisory operating only in the perception register sounds plausible but inverts under pressure — exactly the failure mode the Topping regression demonstrated.

### 3.3. Why trait synthesis alone produces flattened comparisons

A synthesis layer that operates only at the perception layer composes comparisons by extracting adjectives from prose, scoring them, and assembling framings. The result is structurally flat: every comparison reduces to a flavour preference along one or two tonal-balance axes.

A synthesis layer that anchors at engineering intent composes comparisons by surfacing the contrastive design choices. "Discrete R2R ladder conversion vs measurement-forward delta-sigma" is not a flavour preference — it is two answers to a different question about what a DAC should do. The user is invited to think about the choice rather than pick a flavour.

The philosophy layer's `comparisonGuardrails.prefer` field — populated with engineering-intent framings — is the structural feature that prevents flattening.

### 3.4. Why Audio XX should preserve causal chains rather than isolated adjectives

A capsule that lists "warm; dense; harmonically rich" without explaining what produces those perceptions is asserting an opinion. A capsule that explains "discrete R2R ladder conversion produces specific harmonic structure preservation, which listeners describe as warm and dense" is preserving a *causal chain* — mechanism produces behavior, behavior is perceived as character.

Causal chains are more stable than asserted character because:

- They explain *why* the perception is consistent.
- They survive system-context variation (the mechanism is the same; the perception may shift slightly).
- They give the user a mental model rather than a label.
- They are auditable — if the perception drifts in synthesis output, the causal chain reveals where the drift occurred.

Capsules in the master table that do not state the causal chain explicitly are flagged for v3 revision. Where confidence does not support drawing the chain, the capsule states honestly that perception is consensus-based rather than mechanism-derived.

### 3.5. The four-layer model in summary

| Layer | What it is | Stability | Confidence source |
|---|---|---|---|
| **Mechanism** | Engineering choice — topology, circuit, cabinet, driver, conversion architecture | High | Manufacturer specifications, design papers |
| **Behavior** | Measurable consequences of the mechanism | Medium-high | Measurement archives, measurement-domain reviewers |
| **Perception** | Audible character listeners report | Medium | Multi-source review consensus |
| **Preference** | Whether the listener wants the perception | Listener-specific | Per-listener |

The advisory should reason at mechanism when explaining identity, at behavior when describing what to expect, at perception when characterizing what listeners report, at preference when matching to the listener's stated values. Each layer has different stability and different language. Conflating them produces output that sounds confident but inverts under context change.

---

## 4. Terms requiring explicit caution

Beyond the calibrated vocabulary in § 2 and the forbidden review-cliché phrases in § 9.6, the following individual terms deserve specific editorial caution. Each has potential operational meaning *if grounded* but drifts toward review-cliché *when used loosely*. The discipline below sets the bar for when the term is acceptable and when it should be replaced.

### 4.1. *Musical*

**Where it becomes meaningless:** Used as a standalone descriptor — "this DAC is musical" — *musical* asserts approval without picking out any specific property. Every recording-playback device is, definitionally, reproducing music; saying gear is "musical" tells the reader nothing about engineering, behavior, or perception.

**Where it may still be useful:** When *musical* is contrasted with a specific alternative — "engineered for musical naturalness over measurement specification" — the term inherits operational content from the contrast.

**Discipline:** Forbidden as a standalone descriptor. Acceptable in explicit contrast. Capsule authors must justify every appearance of *musical* by pairing it with what it is contrasted against.

**Weak usage:** "Denafrips is a musical DAC."
**Disciplined usage:** "Denafrips engineers around harmonic continuity through R2R conversion — listeners describe the result as musically natural in contrast to measurement-forward chip-based DACs."

### 4.2. *Natural* / *naturalness*

**Where it becomes meaningless:** Used without specifying *what* is natural. "Natural presentation" tells the reader the writer approves; it does not tell the reader what the gear does.

**Where it may still be useful:** When the *what* is specified — *vocally natural* (vocal accuracy through midrange-driver choice), *harmonically natural* (harmonic structure preservation), *transient-natural* (relaxed transient timing). Each of these has specific operational content.

**Discipline:** Always specify the object. *Natural* alone is forbidden; *natural [property]* is acceptable when the property is operationally grounded.

**Weak usage:** "DeVore speakers have a natural presentation."
**Disciplined usage:** "DeVore voicing targets vocal naturalness — vocal reproduction with midrange continuity rather than measurement-class linearity."

### 4.3. *Analog* / *analog-like* / *analogue-leaning*

**Where it becomes meaningless:** Applied to digital gear without specifying which analog property is referenced — "this DAC sounds analog-like" could mean vinyl-like transient timing, tube-like harmonic content, smooth-and-rounded character, or generic "non-digital approval."

**Where it may still be useful:** When the specific analog property is named — "vinyl-like transient timing through NOS conversion," "tube-like harmonic content through tube output stage."

**Discipline:** Specify the analog property. *Analog-like* alone is forbidden.

**Weak usage:** "TotalDAC has an analogue-leaning presentation."
**Disciplined usage:** "TotalDAC's per-unit R2R ladder produces transient timing closer to analog playback than to oversampling delta-sigma chip-based DACs."

### 4.4. *Coherent* / *coherence*

**Where it becomes meaningless:** Used as a standalone positive — "coherent presentation" — without specifying what kind of coherence.

**Where it remains useful:** When the type of coherence is specified — *single-driver coherence* (no crossover-summing artifacts), *time-aligned coherence* (point-source imaging), *system-level architectural coherence* (mechanical-resonance management across components), *temporal coherence* (timing-domain accuracy).

**Discipline:** Specify the type. *Coherent* alone is forbidden; *[kind] coherence* is acceptable.

**Weak usage:** "Hornshoppe speakers have coherent imaging."
**Disciplined usage:** "Hornshoppe's single-driver topology produces single-driver coherence — no crossover-summing artifacts."

### 4.5. *Holographic*

**Where it becomes meaningless:** Used to describe spatial presentation without specifying the engineering producing it. *Holographic* is the most review-cliché of the spatial vocabulary terms.

**Where it may still be useful:** Rarely. Where it appears, it should be replaced with *spatially dimensional* or *spatially precise* depending on the property.

**Discipline:** Replace where it appears. *Holographic* in a v2 master table capsule should be revised to *spatially dimensional* (when imaging depth is the property) or *spatially precise* (when imaging accuracy is the property).

**Weak usage:** "McIntosh has a holographic soundstage."
**Disciplined usage:** "McIntosh autoformer-coupled output produces spatial dimensionality with relaxed imaging precision."

### 4.6. *Emotional* / *emotionally engaging*

**Where it becomes meaningless:** *Emotional* applied to gear is an evaluative claim wearing perceptual clothing. It tells the reader the gear is approved; it does not pick out any property.

**Discipline:** Forbidden in capsules. The advisory's domain is identity and trade-off; emotional response is the listener's domain.

**Weak usage:** "Shindo amplifiers have emotional engagement."
**Disciplined usage:** "Shindo's per-circuit voicing produces dense harmonic saturation and relaxed transient timing; listeners report long-form listening engagement consistent with this character."

### 4.7. *Transparent*

**Where it becomes meaningless:** *Transparent* is potentially operational (low THD+N, low noise floor, low coloration), but it drifts into "I approve of this" usage without grounding.

**Where it remains useful:** When grounded in the mechanism producing the transparency — "audibility-research-grounded transparency" (Mola Mola), "studio-grade pass-through transparency" (Benchmark), "pro-audio measurement transparency."

**Discipline:** Ground in mechanism. *Transparent* alone is acceptable but weaker than *transparent through [mechanism]*.

**Weak usage:** "Mola Mola is a transparent DAC."
**Disciplined usage:** "Mola Mola's audibility-research-grounded design produces transparency through low audible-threshold distortion and low noise."

### 4.8. *Realistic*

**Where it becomes meaningless:** *Realistic* applied to playback claims a fidelity to the live event that cannot be verified — playback is structurally not the live event. The term smuggles in approval as if it were a measurement.

**Discipline:** Forbidden in capsules. Where the underlying property is what the writer means — *vocal accuracy*, *spatial dimensionality*, *harmonic structure preservation* — name that property directly.

### 4.9. *Refined*

**Where it becomes meaningless:** Used as standalone praise for high-tier gear, without specifying what is refined.

**Where it remains useful:** When the specific refinement is named — *resolution refinement* (dCS), *tonal-balance refinement* (Accuphase polish), *per-line refinement consistency* (Japanese build culture).

**Discipline:** Specify the property. *Refined* alone is forbidden.

**Weak usage:** "Accuphase produces refined Japanese voicing."
**Disciplined usage:** "Accuphase's voicing emphasizes uniform tonal-balance polish across the line — distinct from Western statement-tier brands' approach to dynamic drama."

### 4.10. *Effortless*

**Where it becomes meaningless:** Used for high-power amplification without specifying what produces the ease.

**Where it remains useful:** When grounded in mechanism — *high-current effortless drive* (Hegel — driving difficult speakers without strain through high-current output stage), *headroom-effortless reproduction* (large amplifiers in their power range).

**Discipline:** Ground in mechanism.

**Weak usage:** "Hegel sounds effortless."
**Disciplined usage:** "Hegel's high-current solid-state with feedback-reduction techniques produces effortless drive into difficult-load speakers."

### 4.11. *Organic*

**Where it becomes meaningless:** *Organic* applied to electronics is metaphor without operational content.

**Discipline:** Forbidden. Where the underlying property is meant — *harmonically rich*, *flowing transient timing*, *texturally articulate* — name that property directly.

### 4.12. *Immersive*

**Where it becomes meaningless:** *Immersive* describes the listener's experience, not the gear. It is a preference-layer claim, not a perception-layer claim.

**Discipline:** Forbidden in capsules. The capsule's `listenerArchetype` field captures whom a brand suits without claiming the brand is *immersive*.

---

## 5. Comparative reasoning principles

Brand identity is most legible *by contrast*. The comparison-side use of the philosophy layer is where identity preservation matters most. Three principles govern comparative framing:

### 5.1. Frame on the design-intent axis, not the audible-result axis

A comparison between Denafrips and Topping should not be framed as "warm vs neutral" or "rich vs clean." That frames the audible result on a single tonal axis and collapses the philosophical distinction into a flavour preference.

The correct frame is design-intent: "discrete R2R ladder conversion engineered for harmonic continuity vs measurement-forward delta-sigma engineering optimised for chip-implementation transparency." That frame preserves what each brand is trying to do.

### 5.2. Use contrastive pairs that respect both brands

A good comparative frame is symmetric. Each side describes what the brand *positively* does, not what it *fails* to do. "Topping vs Denafrips: precision vs warmth" reads as if Topping has no warmth and Denafrips has no precision. Both are wrong.

Better: "Topping vs Denafrips: measurement-class signal pass-through vs harmonic continuity through analog conversion."

### 5.3. Reject the single-axis fallacy

Many comparisons cannot be reduced to a single axis. dCS vs Chord Electronics is not warm-vs-cold or fast-vs-slow — it is "ring-DAC oversampling refinement vs FPGA pulse-array timing precision." Two different architectural approaches.

---

## 6. Identity-preservation guidelines

### 6.1. The identity test

For each capsule, ask: *if I removed the brand name, could a knowledgeable listener guess which brand this describes?* A capsule that fails the identity test (could describe several brands equally well) is too generic.

### 6.2. The four anchors of identity

Each capsule must clearly answer four questions:

1. **What is the brand engineering around?** — design intent, not audible result.
2. **What is unique about its approach?** — not "what does it sound like," but "what is it trying to do that other brands aren't."
3. **What does it deliberately de-prioritise?** — every brand makes trade-offs; an honest capsule names them.
4. **Who is this for?** — the listener archetype that the brand's design intent serves.

A capsule that doesn't answer all four is incomplete.

### 6.3. The comparative-symmetry test

When two brands are commonly compared, draft both capsules side-by-side and verify:

- The first sentence of each `designPhilosophy` is materially different.
- The contrastive framings in `comparisonGuardrails.prefer` for one brand survive when read against the other brand's profile.
- No phrase in one capsule's `mischaracterizationsToAvoid` is contradicted by the other's `sonicTendencies`.

---

## 7. Examples of weak vs strong comparative framing

These pairs demonstrate the discipline. Each pair shows what the layer is intended to prevent and what it is intended to produce. Additional examples are in the engineering-intent companion memo § 11.

### 7.1. Denafrips vs Topping

**Weak (trait-synthesis):**
> "Denafrips is warm and dense; Topping is precise and clean. The choice is between warmth and precision."

**Strong (identity reasoning):**
> "Denafrips engineers around discrete R2R ladder conversion — each resistor in the ladder shapes the analog output, prioritising harmonic continuity through the conversion stage. Topping engineers around chip-implementation measurement specification — ESS Sabre converters paired with low-noise output stages, prioritising signal-path transparency. These are different answers to what a DAC should do: shape the analog output through ladder topology, or pass the recording through with minimum coloration."

### 7.2. Shindo vs Audio Note (UK)

**Weak:**
> "Both are tube brands with warm, harmonically rich presentations."

**Strong:**
> "Shindo designs each amplifier circuit individually around its chosen tubes — the design unit is the individual circuit. Audio Note designs an integrated system philosophy — DAC + amp + speaker as one — where the design unit is the complete system topology. The brands share an experiential / tone-first orientation but differ on what the design unit is."

### 7.3. Goldmund vs Pass Labs

**Weak:**
> "Goldmund is fast and analytical; Pass Labs is warm and natural."

**Strong:**
> "Goldmund engineers around mechanical-resonance management — every component connection treated as a vibration-management problem, with architectural coherence at the system level. Pass Labs engineers around class-A solid-state with low or zero feedback — harmonic naturalness through circuit topology rather than tube character. The trade-off is between transient speed achieved through mechanical engineering and harmonic structure achieved through circuit topology."

### 7.4. Naim vs warm tube electronics

**Weak:**
> "Naim is rhythmic and engaging. Tube electronics are warm and lush."

**Strong:**
> "Naim engineers around timing-domain accuracy — the temporal relationships between musical events are the design priority. The audible signature is what British audio writers call PRaT, but the engineering intent is timing fidelity. Warm tube electronics engineer around harmonic structure and tonal density, with timing as a secondary consideration."

### 7.5. Topping vs Denafrips (the regression case)

**Weak (the actual regression):**
> "Topping has a warm harmonic character; Denafrips has tonal density."

**Strong:**
> "Topping is engineered around chip-implementation measurement specification — ESS Sabre topology, low THD+N, low noise, fast transients. The audible signature is clean, neutral-to-slightly-bright, with light tonal weight and high clarity. Denafrips is engineered around discrete R2R ladder topology — each resistor directly shapes the analog output, prioritising harmonic continuity. The audible signature is warm, dense, with relaxed transient timing and softer leading edges than delta-sigma designs."

### 7.6. dCS vs Chord Electronics

**Weak:**
> "Both are flagship British DAC brands with measurement-rigorous engineering and refined presentations."

**Strong:**
> "dCS engineers around the proprietary ring-DAC topology — a custom oversampling ladder that produces high resolution combined with smoothness on transients. Chord engineers around custom FPGA-based pulse-array conversion — high-tap-count timing-domain processing that produces neutrality combined with transient precision. Both are non-chip-DAC architectures, but the architectures answer different questions about digital-to-analog conversion."

---

## 8. Identifying trait-synthesizing vs identity-reasoning errors

Patterns in the existing engine code are *trait-synthesizing* and should be flagged for replacement when the philosophy layer integrates:

### 8.1. Adjective-bucket scoring in `buildTradeoffStatement`

```ts
const warmWords = ['warm', 'rich', 'dense', 'harmonic', 'tonal density',
                   'tonal body', 'lush', 'musical', 'golden',
                   'tube-adjacent', 'saturated'];
```

This bucket conflates *warm* (tonal balance), *rich* (harmonic content), *dense* (tonal weight), *lush* / *saturated* (harmonic intensity), *musical* (filler), *golden* / *tube-adjacent* (tube-specific character) into a single "warm" axis. Trait-synthesizing.

The philosophy-layer alternative: comparison framings come from each brand's `comparisonGuardrails.prefer`, which name the contrastive design-intent axis specifically.

### 8.2. The dominant-axis classifier

Reduces every brand to one of `warm` / `control` / `flow` / `neutral`. Brands whose identity lives outside this axis — dCS's ring-DAC oversampling, Boenicke's cabinet engineering, Hornshoppe's single-driver coherence, Naim's timing-domain accuracy, Goldmund's mechanical-resonance management — get squeezed into the closest axis.

The philosophy-layer alternative: each brand's identity axis is captured in the capsule directly; comparisons surface the actual axis on which two brands differ.

### 8.3. The `extractSonicTraits` regex matcher (post-fix)

Even with negation-stripping, the regex matcher reduces brand identity to a small set of pre-formed phrase fragments — `'warm harmonic character'`, `'warm, tonally dense, harmonically rich'`. These are useful as fallback when no capsule exists, but they are trait-synthesizing.

The philosophy-layer alternative: when a capsule exists, the rendered comparison surfaces `capsule.sonicTendencies` directly (curated prose) or fields constructed from `capsule.comparisonGuardrails.prefer`. Regex synthesis is bypassed for capsuled brands.

### 8.4. Generic "musical realism" framings

Current code emits framings like:

> "The real choice: musical realism through flow and harmonic richness (BrandA) vs technical accuracy through control and precision (BrandB)."

This is acceptable as a fallback but is trait-synthesizing — works for any warm-vs-control brand pair regardless of *which specific* warm-vs-control distinction is in play.

The philosophy-layer alternative: the capsule's `comparisonGuardrails.prefer` provides the specific contrastive framing for that brand. Synthesis composes from both sides' preferred framings.

---

## 9. Recommendations for future editorial governance

### 9.1. Single editor with explicit second-pass review

Curation authority remains with the project author. Capsule changes go through second-pass review — initially by re-reading after a delay, eventually by a designated editorial reviewer. Review is for adjective discipline (§ 2), engineering-intent grounding (§ 3), terminology caution (§ 4), comparative honesty (§ 5), and identity preservation (§ 6).

### 9.2. Capsule freshness audit on a calendar cadence

Quarterly review: re-read each `high`-confidence capsule for drift; update `lastReviewed`; flag entries unreviewed for >12 months; surface `medium`-confidence capsules for evidence-based upgrade or downgrade.

### 9.3. Capsule freshness audit on event triggers

Re-review when: a brand introduces a major new product line that may shift identity; industry review consensus visibly shifts; a user-reported regression is traced to capsule content.

### 9.4. Confidence-degradation discipline

When evidence becomes ambiguous, drop confidence to the next-lower tier. Do not silently maintain `high` confidence on weakening evidence. Confidence-degradation is the editorial signal that a capsule needs re-work.

### 9.5. Per-line capsules for multi-line brands

When a capsule's review notes flag `multiLineBrand: true` and the brand has stable per-line identities (e.g., Schiit Yggdrasil distinct from Schiit Modius), draft per-line capsules. Treat the brand-level capsule as a navigation header. The synthesis layer should not produce brand-level output for multi-line brands without a model anchor.

### 9.6. Editorial-tone watch list

Maintain a watch list of phrases that should not appear in capsules without explicit grounding:

- "long-session listenability"
- "low fatigue" (without naming what causes it)
- "musical engagement" (without contrast)
- "musical" (as standalone descriptor — see § 4.1)
- "natural" / "naturalness" (without specifying what is natural — see § 4.2)
- "analog-like" / "analogue-leaning" (without specifying which analog property — see § 4.3)
- "coherent" / "coherence" (without specifying which kind — see § 4.4)
- "holographic" (replace with *spatially dimensional* or *spatially precise* — see § 4.5)
- "emotional" / "emotionally engaging" (forbidden — see § 4.6)
- "transparent" (without grounding mechanism — see § 4.7)
- "realistic" (forbidden — see § 4.8)
- "refined" (without specifying what refinement — see § 4.9)
- "effortless" (without grounding mechanism — see § 4.10)
- "organic" (forbidden — see § 4.11)
- "immersive" (forbidden — see § 4.12)
- "reference-tier" / "statement-tier" / "flagship-tier" (as standalone praise)
- "house sound" (without explaining what voicing constitutes the house sound)
- "tonally weighted" (replaced with *dense* or *warm-and-dense* depending on which is meant)
- "rich and warm" (almost always means the writer didn't decide which)
- "engaging" / "engagement" (without specifying mechanism)

When a capsule contains any of these, it must justify the use with concrete grounding — not float as standalone praise.

### 9.7. Distinction discipline at first authoring

When drafting a capsule, identify the most-similar already-curated brand and explicitly differentiate. This is the comparative-symmetry test (§ 6.3) applied at the authoring stage rather than at the review stage.

### 9.8. Accept that some brands cannot be capsuled

Some brands genuinely lack a coherent single identity — usually because they span topologies, voicings, or product categories that no single capsule can describe without distortion. For those brands, the editorial answer is `multiLineBrand: true` plus per-line capsules, or — if even per-line treatment is insufficient — *no capsule at all*, with the engine falling back to per-product reasoning.

Honesty about absence is preferable to fabricated coherence.

---

## 10. Concerns about future engine integration

This memo is editorial, not implementation, but four engine-side concerns directly affect how the layer must be authored:

### 10.1. The `mischaracterizationsToAvoid` field is a structured pattern, not a string list

A naive substring-match implementation would over-trigger. The validator must understand brand-anchoring, phrase-level matching, negation-aware context, and excluded contexts. The schema in the layer-design memo § 5 captures this; the implementation must honour it.

### 10.2. Capsule changes must be auditable in commit history

Every capsule edit changes how the engine will frame comparisons involving that brand. Commit messages must name the specific capsule and field changed.

### 10.3. The synthesis-layer fallback path must be honest

For brands without capsules, synthesis continues to use the existing prose-derived path. Comparisons mixing a capsuled brand and an uncapsuled brand will produce asymmetric output — better-grounded on the capsuled side. The advisory should be honest about this asymmetry.

### 10.4. UI exposure must respect the internal-vs-external split

`comparisonGuardrails`, `mischaracterizationsToAvoid`, full ordered `engineeringPriorities`, `confidence`, `reviewNotes`, `multiLineBrand` are engine-only. `designPhilosophy`, `sonicTendencies`, `strengths`, `tradeoffs`, `listenerArchetype` are user-facing. The format must keep them separable.

---

## 11. Summary of changes across versions

### v0 → v1 (first editorial-hardening pass)

1. Adjective conflation removed; calibrated trait vocabulary applied.
2. Differentiation enforced for seven flagged brand pairs.
3. Confidence ratings recalibrated honestly.
4. Review-cliché phrasing scrubbed.
5. `mischaracterizationsToAvoid` reformulated as structured patterns.
6. Engineering-intent first ordering applied.
7. Four-anchor identity test applied.

### v1 → v2 (second editorial-hardening pass — this revision)

1. **Engineering intent vs audible description** elevated to a top-level discipline (§ 3); companion memo created.
2. **Terms requiring explicit caution** — twelve specific terms (§ 4) called out with weak / disciplined usage examples.
3. **Forbidden phrasing watch list** (§ 9.6) expanded with the additional terms from § 4.
4. **Causal-chain preservation** added to identity-preservation guidelines: capsules state mechanism → behavior → perception explicitly where confidence supports it.
5. **Per-layer confidence** introduced — capsule confidence may be graded per-layer (mechanism vs behavior vs perception) rather than as a single global rating.
6. **`refined` retired** as a standalone descriptor; *Japanese refinement* / *resolution refinement* / *per-line refinement consistency* are the disciplined alternatives.
7. **`analogue-leaning` retired** as a standalone descriptor; mechanism-grounded alternatives required.
8. **`holographic` flagged for replacement** with *spatially dimensional* or *spatially precise*.
9. **`organic`, `realistic`, `emotional`, `immersive` declared forbidden** in capsules.

---

## 12. Cross-references

- **Master table:** [`brand-philosophy-master-table.md`](brand-philosophy-master-table.md)
- **Integration design:** [`brand-philosophy-layer-design.md`](brand-philosophy-layer-design.md)
- **Conceptual model (the engineering-intent / audible-behavior chain):** [`engineering-intent-and-audible-behavior.md`](engineering-intent-and-audible-behavior.md)
- **CSV form:** [`brand-philosophy-master-table.csv`](brand-philosophy-master-table.csv)
- **Calibrated trait framework reference:** [`audio_xx_sonic_trait_framework_v1.md`](audio_xx_sonic_trait_framework_v1.md)
- **Calibration regression source:** commit `7cee216`.

This memo is editorial. No code changes follow from it. The discipline it codifies is what the layer must respect at first authoring and at every subsequent review.
