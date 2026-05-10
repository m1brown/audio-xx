# Engineering Intent and Audible Behavior

**Status:** v0 conceptual memo for the brand-philosophy layer. Editorial / research only — no implementation.
**Created:** 2026-05-10
**Companion documents:** [`brand-philosophy-master-table.md`](brand-philosophy-master-table.md), [`brand-philosophy-layer-design.md`](brand-philosophy-layer-design.md), [`brand-philosophy-editorial-review.md`](brand-philosophy-editorial-review.md).

---

## 1. The point of this memo

A reader can fairly ask: *why does the philosophy layer separate engineering mechanism from audible behavior — and why does it matter for the engine?*

The short answer: the four things below are different kinds of claim, with different stability and different grounds for confidence. Conflating them produces output that sounds confident but quietly inverts itself when conditions change.

| Layer | What it is | Stability | Source of confidence |
|---|---|---|---|
| **Mechanism** | The engineering choice — the topology, circuit, cabinet, driver, conversion architecture, or system-level approach the brand has committed to. | High. Mechanism is what the brand *did*. It's documented, often patented, and doesn't change without a new product. | Manufacturer specifications; teardown-grade engineering literature; design papers. |
| **Behavior** | The measurable or observable consequences of that mechanism — distortion-pattern character, transient response shape, dispersion behavior, frequency response, harmonic structure. | Medium-high. Behavior is reproducible in measurement but interpretation-dependent. The same THD spec means different audible things at different harmonic orders. | Measurement archives, measurement-domain reviewers (ASR, Stereophile measurement appendices). |
| **Perception** | What listeners consistently report — "warm," "fast," "dimensional." | Medium. Perception is real but listener-dependent and system-dependent. Review consensus across multiple independent listeners is reasonable evidence; single-listener review is not. | Multi-source review consensus; long-running listener communities; the project's own listening notes when calibrated. |
| **Preference** | Whether the listener wants the perceived character. | Listener-specific by definition. Not a property of the gear. | Per-listener; per-system; per-stage-of-hobby. |

The advisory should reason at the **mechanism** level when explaining a brand's identity, at the **behavior** level when describing what to expect, at the **perception** level when characterizing what listeners report, and at the **preference** level when matching to the listener's stated values. Collapsing these layers — especially collapsing mechanism into perception and pretending the result is identity — is the structural failure mode the philosophy layer protects against.

This memo describes the conceptual model. The master table applies it to specific brands. The editorial-review memo describes the linguistic discipline that prevents drift.

---

## 2. Mechanism

Mechanism is what the brand has built. It is the most stable layer because it is a fact about the product, not an interpretation.

Examples that the philosophy layer treats as mechanism-level claims:

- **Denafrips:** discrete R2R ladder conversion using hand-selected resistor arrays. The conversion topology is published and understood.
- **Topping:** delta-sigma conversion using ESS Sabre or AKM chips, paired with low-noise output stages. The chip choice and the output-stage architecture are specified.
- **Chord Electronics:** custom FPGA-based pulse-array conversion (Rob Watts architecture) with published tap counts.
- **dCS:** proprietary ring-DAC topology — a custom oversampling ladder built and refined in-house. The architecture is described in technical papers; specific implementation details are proprietary.
- **Goldmund:** mechanical-resonance management at the chassis and signal-path level — the brand's "mechanical grounding" approach. Published as design philosophy; specific implementation details across the line are partially proprietary.
- **Pass Labs:** class-A solid-state with low or zero feedback. The topology choice is documented; specific circuit implementations are well-understood from Nelson Pass's published designs.
- **Naim:** timing-domain emphasis combined with attention to power-supply behavior (separate-PSU products, regulated supplies). The engineering priority is published; specific topology choices vary across the line.
- **Harbeth:** RADIAL polypropylene midrange driver, BBC-monitor-derived cabinet damping philosophy, vocal-accuracy-target voicing. All three are documented.
- **KEF:** Uni-Q coaxial driver array with time-aligned crossover. Topology is well-documented and central to the brand identity.
- **Magnepan:** planar-magnetic dipole topology with large-area diaphragms. Mechanism is the brand's defining characteristic.

Mechanism-level claims are stable across reviewers, across time, and across system context. When a capsule says "Denafrips engineers around discrete R2R ladder conversion," that claim does not depend on how the DAC sounds in any particular system — it describes what was built.

Mechanism-level claims earn `high` confidence in the philosophy layer when they are directly published or independently verified. They earn `medium-high` confidence when they are public claims by the manufacturer that have not been independently disputed but have not been independently verified either. They earn `medium` confidence when they are inferred from product behavior and reviewer consensus rather than directly stated.

---

## 3. Behavior

Behavior is what the mechanism produces. It is one step removed from the mechanism — the transient response, distortion pattern, frequency response, dispersion characteristic that follows from the engineering choice.

Behavior is measurable. Reasonable independent measurement archives exist. But behavior is also *interpretive*: the same THD measurement means different audible things depending on whether the harmonics are predominantly even-order (often perceived as warmth-additive) or odd-order (often perceived as etched). The same frequency-response curve measured anechoically may behave differently in a real listening room.

Examples of behavior-level claims:

- **Denafrips:** R2R ladder conversion produces *characteristic harmonic structure preservation* and *softer transient leading edges* relative to oversampling chip-based delta-sigma. These are observable in measurement (transient response shape) and in time-domain analysis. The behavior is reproducible across the line.
- **Topping:** ESS Sabre with low-noise output stages produces *very low THD+N* and *fast transient response*, with measured noise floor at the silicon limit of the topology. The behavior is reproducible and well-archived.
- **Goldmund:** mechanical-resonance management produces *narrow transient reproduction* and *low low-level resonance contamination*. Measurable in the time domain; less commonly measured than THD+N because the relevant measurements are non-standard.
- **Class-A solid-state (Pass Labs):** produces predominantly even-order harmonic distortion at low levels and low feedback in the signal path. The harmonic distribution is measurable; the audible interpretation is "harmonically natural without tube character."
- **Push-pull tube (Leben):** output transformer plus push-pull topology produces canceled even-order distortion at the device level but reintroduces some at the transformer level. The harmonic spectrum differs from single-ended tubes (which preserve even-order strongly).
- **Planar-magnetic dipole (Magnepan):** wide-area driver produces *low driver mass with corresponding fast transient response* and *figure-eight radiation pattern* that requires room space for the rear wave.

Behavior is the bridge between mechanism (what the brand did) and perception (what listeners report). The philosophy layer documents behavior at `medium-high` confidence in most cases — the engineering chain is supported by measurement, but the specific behavior profile of any given product is not always independently verified across multiple sources.

When the editorial-review memo notes "honest about uncertainty," much of the uncertainty lives at this layer: we know the mechanism, and we have review-level evidence of the perception, but the behavior layer that connects them is sometimes inferred more than measured.

---

## 4. Perception

Perception is what listeners report. It is one step removed from behavior — the audible character that emerges when a listener with a particular system in a particular room hears the result of the behavior described in § 3.

Perception is the layer most populated in audio writing. It is also the most vulnerable to drift, because:

- It is listener-dependent. A given DAC sounds different to a given listener in a given system.
- It is system-dependent. The downstream and upstream of the chain shape what the listener perceives.
- It is vocabulary-conflated. Reviewers use *warm*, *rich*, *dense*, *smooth*, *neutral* with overlapping informal definitions. (The editorial-review memo § 2 establishes calibrated definitions.)
- It is bias-prone. Brand reputation, aesthetic, price, and writer's prior listening shape what writers report.

The philosophy layer treats perception-level claims at `high` confidence only when:

- Multiple independent reviewers report the same perceptual character.
- The reported character is consistent with the mechanism and behavior layers above it.
- The character has held stable across the brand's product line over time.

When perception-level claims do not meet that bar, confidence is `medium-high` or `medium`, and the capsule states honestly that the perception is consensus-based rather than mechanism-derived.

Examples:

- **Denafrips perceived as "warm and dense":** high-confidence perception. Multi-source review consensus; consistent with R2R mechanism; stable across the line.
- **Topping perceived as "lean and fast":** high-confidence perception. Multi-source consensus; consistent with ESS Sabre + low-noise output mechanism; stable across the line.
- **Goldmund perceived as "fast and transparent":** high-confidence perception. Multi-source consensus; consistent with mechanical-resonance-management mechanism.
- **Boenicke perceived as "spatially dimensional":** medium-high-confidence perception. Strong consensus on the spatial property; the cabinet-engineering mechanism is documented; the connection between mechanism and the spatial perception is partially inferred rather than measured.
- **Naim perceived as "rhythmically engaging" (PRaT):** high-confidence perception in British audio writing; medium-high in non-British writing. The PRaT framing is partially a vocabulary tradition; the underlying timing-domain engineering is documented.

Perception is what user-facing language usually surfaces. The philosophy layer's `sonicTendencies` field is the perception layer, expressed in calibrated trait vocabulary. The capsule ties it explicitly back to the mechanism and behavior that produce it.

---

## 5. Preference

Preference is the listener's input. Whether they value the perception is a property of the listener and the system, not of the brand.

The philosophy layer never asserts preference. It asserts mechanism, behavior, and perception, and lets the advisory match those to the listener's stated values.

This layer is the user's domain. The capsule's `listenerArchetype` field describes who the brand's identity tends to suit — but that is a directional pairing claim ("listeners who prioritise tonal density"), not a preference assertion ("you should prefer Denafrips").

The advisory's job is to:

1. Read the listener's stated values (which the user provides — explicit traits, system context, budget).
2. Read the brand's identity at mechanism / behavior / perception levels.
3. Match: does this brand's identity serve what the listener says they value?
4. Surface trade-offs honestly: every match has a cost.

This is identity-first reasoning. It is fundamentally different from a recommendation system that scores a brand against a generic "quality" rubric and ranks. The philosophy layer enables the advisory to *match* identity to listener — not to rank brands.

---

## 6. The four-layer chain in practice

The discipline applied to one example:

### Denafrips (high-confidence chain across all four layers)

| Layer | Content | Confidence |
|---|---|---|
| **Mechanism** | Discrete R2R ladder conversion. Resistor arrays selected and matched per unit. Graduated price-line house voicing maintained from Ares to Terminator. | high — documented and consistent across the line |
| **Behavior** | R2R ladder conversion produces specific harmonic-structure preservation and softer transient leading edges relative to oversampling delta-sigma chip-based DACs. Measurable in time-domain; reviewable. | medium-high — engineering rationale is published; specific behavior profile per model is partially measured |
| **Perception** | Listeners consistently report warm tonal balance, dense tonal weight, rich harmonic character, and relaxed transient pace relative to delta-sigma DACs. | high — multi-source review consensus; consistent with mechanism |
| **Preference fit** | Suits listeners prioritising tonal density and harmonic continuity; risks compounding warmth in already-warm chains. | (not asserted as preference; surfaced as pairing context) |

### Topping (high-confidence chain across all four layers)

| Layer | Content | Confidence |
|---|---|---|
| **Mechanism** | Delta-sigma conversion using ESS Sabre or AKM chips, with low-noise output stages. Engineering target is measurement specification. | high — documented |
| **Behavior** | Low THD+N, low noise floor, fast transient response. Measured at-or-near silicon performance limit. | high — extensively measured by independent reviewers |
| **Perception** | Listeners consistently report lean tonal weight, neutral-to-slightly-bright tonal balance, high clarity through low coloration. *Specifically not warm or harmonically dense.* | high — multi-source consensus; consistent with mechanism |
| **Preference fit** | Suits listeners prioritising signal-path transparency and low coloration; pairs with bodied downstream chains. | (not asserted as preference) |

### Goldmund (chain anchored at mechanism but with line-spread caveat)

| Layer | Content | Confidence |
|---|---|---|
| **Mechanism** | Mechanical-resonance management at chassis and signal-path level. Low-feedback signal path. Architectural / system-level coherence as a design priority. | high (philosophy is documented); medium-high (specific implementation details across the line are partially proprietary) |
| **Behavior** | Fast transient definition; transparent signal pass-through; low low-level resonance contamination. The audible behavior follows from the mechanism with reasonable directness. | medium-high — review-consensus level evidence |
| **Perception** | Listeners report fast, transparent, lean tonal weight, controlled dynamics. *Specifically not analytical-as-character.* | medium-high |
| **Preference fit** | Suits listeners prioritising transient speed and architectural coherence; pairs with bodied downstream partners. | (not asserted) |

### Naim (chain anchored at engineering priority but with vocabulary tradition note)

| Layer | Content | Confidence |
|---|---|---|
| **Mechanism** | Timing-domain emphasis as engineering priority, with attention to power-supply behavior across the line (separate-PSU products, regulated supplies). Specific topology varies. | high (priority is documented); medium-high (specific topology choices are model-dependent) |
| **Behavior** | Tightly defined bass; transient definition emphasised; output stages preserve temporal relationships in the signal. | medium-high |
| **Perception** | Listeners — particularly within the British audio writing tradition — describe Naim as propulsive, rhythmically coherent, forward-leaning. The "PRaT" framing is partly vocabulary tradition (specifically British) and partly perception. | high (within British writing); medium-high (across broader review consensus) |
| **Preference fit** | Suits listeners prioritising rhythmic engagement and temporal accuracy. | (not asserted) |

### Harbeth (high-confidence chain across all four layers)

| Layer | Content | Confidence |
|---|---|---|
| **Mechanism** | RADIAL polypropylene midrange driver. BBC-monitor-derived cabinet damping. Vocal-accuracy voicing target. | high — documented |
| **Behavior** | Midrange continuity and relaxed transient behavior; smooth transient leading edges; less treble extension than ribbon / beryllium-tweeter speakers. | medium-high — measurement-supported |
| **Perception** | Listeners report vocal accuracy, midrange honesty, smoothness on transients. | high — multi-source consensus |
| **Preference fit** | Suits listeners prioritising vocal naturalness and midrange honesty over treble extension or dynamic scale. | (not asserted) |

---

## 7. Why this ordering is more stable than the alternative

A naive synthesis layer treats perception as the primary identity layer. It takes review prose, extracts adjectives, and assembles framings. The result is fragile because:

- **Perception drifts under system change.** A DAC's perceived character is partly the product of the chain it's in. Asserting brand identity at the perception layer is asserting something that varies with context.
- **Vocabulary collapses meaning.** If "warm" can mean tonal-balance-warmth, harmonic-richness, smoothness, or generic "musical positivity," then asserting "Brand X is warm" inherits that ambiguity. The synthesis layer compounds the ambiguity rather than resolving it.
- **Comparisons become flavour preferences.** "Brand A is warm; Brand B is precise" reads as a flavour choice, not an identity distinction. The user is asked to prefer warmth or precision rather than understand what the brands are trying to do.

Anchoring identity at mechanism reverses these problems:

- **Mechanism doesn't drift under system change.** A Denafrips DAC remains an R2R ladder conversion regardless of what amp it feeds.
- **Mechanism statements have specific operational content.** "Discrete R2R ladder conversion" picks out a specific engineering choice that is either present or not. There is no ambiguity at this level.
- **Comparisons become engineering-trade-off choices.** "R2R ladder conversion vs measurement-forward delta-sigma" frames the comparison as a choice between two design philosophies, with the audible result downstream of the choice.

This is what the editorial-review memo means when it talks about identity reasoning rather than trait synthesis. Identity reasoning starts at mechanism and works downward to perception. Trait synthesis starts at perception and tries to back-fill identity.

---

## 8. The drift modes the philosophy layer prevents

When the four layers collapse, specific drift modes appear. The capsule's structure is designed to make each drift mode visible.

### 8.1. Mechanism → perception elision

Drift: skipping behavior and perception, asserting mechanism *as* the identity. "Denafrips is R2R" — true at the mechanism layer, but useless without the behavioral and perceptual translation.

Mitigation: capsules require all four layers when confidence supports them.

### 8.2. Perception → identity elevation

Drift: treating perception as the brand's identity. "Topping is bright; Denafrips is warm" — these are perceptions, not identities. They drift under system change.

Mitigation: capsules anchor identity at mechanism; perception is downstream.

### 8.3. Single-axis collapse

Drift: reducing brand identity to a single tonal-balance or speed axis. "Goldmund is fast; Pass Labs is warm" — both incorrect, both anchored at perception, both miss the actual mechanism.

Mitigation: capsules surface mechanism-specific contrastive framings in `comparisonGuardrails.prefer`.

### 8.4. Vocabulary inheritance from review writing

Drift: importing review-cliché vocabulary as if it were operational language. "Refined Japanese voicing"; "musical engagement"; "natural presentation." These phrases sound informative but are operationally vague.

Mitigation: editorial-review memo § 2 establishes calibrated trait vocabulary; § 7.6 lists forbidden phrasing.

### 8.5. Pseudo-objective claims

Drift: asserting perception with an objective tone. "X has the most natural midrange in its class" — sounds factual, but is a perception claim wearing measurement clothes.

Mitigation: capsules grade confidence per layer; perception-level claims are explicitly perception-level.

### 8.6. Confidence inflation across layers

Drift: treating all four layers as equally well-attested. The mechanism is documented (high confidence). The behavior is reasonably measured (medium-high). The perception is consensus-based (high). All-tier-high is rarely honest; capsules must grade per layer.

Mitigation: per-layer confidence in the capsule's engineering chain.

---

## 9. Implications for the philosophy layer's authoring discipline

The four-layer model imposes specific authoring requirements on each capsule:

1. **Mechanism is the lead.** Every capsule's first descriptive sentence names what the brand engineers around. Audible result follows.
2. **Behavior is the bridge.** Where confidence supports it, the capsule names the *measurable* or *observable* behavioral consequence of the mechanism — not just the perceptual one.
3. **Perception is downstream.** Adjective-based descriptions live in `sonicTendencies`, downstream of the mechanism + behavior they emerge from.
4. **Preference is not asserted.** The capsule's `listenerArchetype` describes pairing context, not user preference.
5. **Confidence is per-layer.** A capsule may have `high` confidence on mechanism (documented), `medium-high` on behavior (reasonably measured), `high` on perception (multi-source consensus), and explicitly not assert preference. Stating one global confidence rating is editorially weaker than stating per-layer.
6. **Honest about inference.** If a capsule's mechanism-layer content is *inferred* from review consensus rather than independently verified, the capsule says so. Inference is acceptable; pretending it's documented is not.

---

## 10. Implications for the engine

The integration design memo describes the engine-side use of the layer. The mechanism→behavior→perception chain refines that integration:

### 10.1. Comparison framings draw from mechanism + behavior

The synthesis layer composes contrastive framings from `comparisonGuardrails.prefer`, which are mechanism-anchored. The framings name what each brand is engineering around, not what it sounds like. The audible character is downstream.

### 10.2. Recommendations explain at mechanism

When the engine recommends a product, the rationale references the brand's mechanism (R2R ladder, FPGA pulse-array, class-A topology) — not just adjectives. This gives the user a stable mental model.

### 10.3. Validation works at the perception layer

The `mischaracterizationsToAvoid` patterns operate at the perception layer — they prevent the engine from asserting perceptions that contradict the brand's documented character. The validator does not constrain mechanism statements; it constrains adjective drift.

### 10.4. Confidence affects language

When a brand's behavior layer carries `medium` confidence (mechanism documented but specific behavior less measured), the synthesis layer hedges: "Denafrips's R2R ladder conversion typically produces ..." rather than "Denafrips produces ...". Confidence-degradation is the language signal, not silence.

---

## 11. Examples of mechanism→behavior→perception reasoning vs trait synthesis

### Example A: Denafrips vs Topping

**Trait-synthesis (weak):**
> "Denafrips is warm and dense. Topping is precise and clean. The choice is warmth vs precision."

**Identity reasoning (strong):**
> "Denafrips engineers around discrete R2R ladder conversion, where each resistor in the ladder shapes the analog output directly. The mechanism produces characteristic harmonic structure preservation and softer transient leading edges, which listeners describe as warmth and tonal density. Topping engineers around delta-sigma conversion using ESS Sabre chips paired with low-noise output stages, optimised for measurement specification. The mechanism produces low THD+N, low noise floor, and fast transient response, which listeners describe as clarity and lean tonal weight. The trade-off is between two different design intentions — harmonic continuity through ladder conversion vs measurement-class signal pass-through — not between warmth and precision as flavour preferences."

### Example B: Naim vs warm tube electronics

**Trait-synthesis (weak):**
> "Naim is rhythmic and engaging. Tube electronics are warm and lush."

**Identity reasoning (strong):**
> "Naim engineers around timing-domain accuracy, with attention to power-supply behavior across the line. The mechanism produces tightly defined bass and transient definition that preserves the temporal relationships between musical events; British audio writers describe this as PRaT (pace, rhythm, and timing). Warm tube electronics engineer around harmonic structure — class-A operation, output transformer behavior, harmonically rich distortion patterns — with timing as a secondary consideration. The mechanism produces dense tonal weight and harmonic saturation that listeners describe as warmth. The trade-off is between two different primary engineering targets — temporal fidelity vs harmonic structure — not between 'rhythmic' and 'warm' as character descriptors."

### Example C: Goldmund vs Pass Labs

**Trait-synthesis (weak):**
> "Goldmund is fast and analytical. Pass Labs is warm and natural."

**Identity reasoning (strong):**
> "Goldmund engineers around mechanical-resonance management — chassis and signal-path connections are treated as vibration-management problems. The mechanism produces narrow transient reproduction and low low-level resonance contamination, which listeners describe as speed and transparency. Pass Labs engineers around class-A solid-state with low or zero feedback. The mechanism produces predominantly even-order harmonic distortion with full harmonic structure, which listeners describe as harmonic naturalness — distinct from tube-warmth (which Pass deliberately is not) and from analytical solid-state (which Pass is also not). The trade-off is between transient speed achieved through mechanical engineering and harmonic structure achieved through circuit topology — not between 'analytical' and 'warm' as character descriptors."

### Example D: Harbeth vs precision speakers

**Trait-synthesis (weak):**
> "Harbeth has natural midrange. KEF has precise imaging. Both are British, both are engineered."

**Identity reasoning (strong):**
> "Harbeth engineers around the RADIAL polypropylene midrange driver and BBC-monitor-derived cabinet damping. The mechanism produces midrange continuity and relaxed transient behavior — the cabinet is deliberately not stiffened beyond a damping target, so cabinet contribution is small but not vanishing; the driver is voiced for vocal accuracy. KEF engineers around the Uni-Q coaxial driver array — tweeter and midrange share a spatial origin and a time-aligned crossover. The mechanism produces point-source coherence in imaging and consistent dispersion across the listening axis. The trade-off is between vocal-accuracy voicing through driver and cabinet choice (Harbeth) and imaging coherence through coaxial topology (KEF) — not 'natural' vs 'precise' as character preferences."

---

## 12. What the layer cannot do

Honest scope:

- The philosophy layer cannot tell a listener what they will hear in their specific system. The behavior and perception layers describe *consensus* — the listener's experience may differ.
- The philosophy layer cannot establish preference. The match between a brand's identity and a listener's values is the advisory's reasoning, not the layer's claim.
- The philosophy layer cannot replace measurement. When a specific measurement is the relevant fact, the measurement is the source — not the capsule.
- The philosophy layer cannot resolve genuine engineering disagreements. When two reviewers describe a brand's mechanism differently and the manufacturer's published material is silent or ambiguous, the capsule confidence is `medium` and the editorial discipline is honesty about the disagreement.

The layer is editorial reference, not measurement archive, not preference engine, not arbitrator of disputes.

---

## 13. Cross-references

- **Master table:** [`brand-philosophy-master-table.md`](brand-philosophy-master-table.md)
- **Editorial discipline:** [`brand-philosophy-editorial-review.md`](brand-philosophy-editorial-review.md)
- **Integration design:** [`brand-philosophy-layer-design.md`](brand-philosophy-layer-design.md)
- **Calibrated trait vocabulary:** editorial-review memo § 2.
- **Calibration regression source:** commit `7cee216`.

This memo describes the conceptual model. It is not implementation. It is editorial reference for authors of brand capsules and for engineers integrating the layer.
