# Audio XX — Sonic Trait Framework v1

**Status:** Design specification — not yet implemented
**Purpose:** Define how Audio XX perceives, represents, and reasons about sonic character.
**Relationship:** Extends the Knowledge Model. Precedes builder refactoring and anchor population.

---

## 1. Trait Philosophy

### What traits are

Traits are the internal vocabulary the advisor uses to think about how equipment presents music. They describe tendencies — what a component, system, or listening experience leans toward — not fixed properties.

A trait assignment is a heuristic claim: "this product tends to emphasise flow and tonal density" is a different kind of statement from "this product measures flat to 20 kHz." Both may be true. The trait framework concerns itself with the first kind.

### What traits are not

Traits are not scores. They do not rank products. A product that emphasises clarity is not better than one that emphasises warmth — it prioritises differently. The framework exists to reason about alignment between listener priorities and equipment tendencies, not to produce league tables.

Traits are not guarantees. A DAC described as "warm-leaning" will not sound warm in every system. Upstream source quality, amplifier topology, speaker sensitivity, room acoustics, and cable choices all modulate the final result. Traits describe the contribution a component tends to make to the chain, not the experience the listener will definitely have.

Traits are not permanent. Community perception shifts. Firmware updates change DAC behaviour. Break-in is real for some components and imagined for others. The framework should hold its assignments loosely and update them when evidence accumulates.

### Design principles

**Believable reasoning over rigid classification.** The framework should produce advisory responses that sound like a thoughtful listener explaining what they hear — not a database returning query results. If a trait assignment leads to mechanical-sounding advice, the assignment is being used wrong.

**Context over absolutes.** "This DAC is warm" means something different depending on whether it feeds a First Watt amplifier or a Benchmark AHB2. Traits are interpreted relative to the system they enter, the listener who hears them, and the musical priorities in play.

**Perceptual grounding.** Traits map to listening experience, not measurement curves. Where measurement and perception diverge (and they sometimes do), the framework follows perception. Where psychoacoustic research illuminates why a perception occurs, the framework should reference it — but the trait itself remains experiential.

**Honesty about uncertainty.** When confidence is low, the framework should say so. "Reports suggest this leans toward density, but we have limited basis for that claim" is better than false precision. Uncertainty is not failure — it is useful information for the listener.

---

## 2. Core Trait Families

The framework uses seven trait families. Each family describes a perceptual axis — a continuum between two recognisable listening experiences. Products and systems sit somewhere along each axis. Listeners tend to have preferences along each axis, though those preferences may be unconscious or unarticulated.

### 2.1 Flow — Musical Continuity

**What it describes:** Whether music feels continuous, connected, and phrased — or segmented, analytical, and mechanical.

**High flow:** Notes hand off to each other naturally. Phrases breathe. Decay feels organic. The listener follows the musical line rather than hearing individual events.

**Low flow:** Individual transients and details are prominent. Separation is high. The presentation may feel precise and articulate but can sound mechanical or clinical if pushed too far.

**Perceptual basis:** Flow relates to how a component handles temporal micro-detail — inter-sample behaviour, group delay characteristics, and the relationship between attack and decay. Components with gentle roll-off characteristics or lower-order filtering often score higher on perceived flow. Time-domain-optimised designs (NOS DACs, low-feedback amplifiers, single-driver speakers) tend to emphasise flow.

**Trait key:** `flow`

---

### 2.2 Tonal Density — Harmonic Weight

**What it describes:** Whether the tonal presentation feels physically substantial, harmonically rich, and full-bodied — or lean, quick, and tonally spare.

**High density:** Instruments have body and weight. Piano sounds like wood and felt and steel, not just pitch. Voices have chest resonance. The lower midrange and upper bass carry presence.

**Low density:** The presentation is lighter and faster. Individual lines are easy to follow but may lack physical conviction. Suitable when the listener prioritises speed and separation over tonal mass.

**Perceptual basis:** Tonal density relates to harmonic distortion profile (particularly even-order), lower midrange energy balance, and bass-to-midrange transition behaviour. R-2R DACs, tube amplifiers, and speakers with larger drivers or resonant cabinet designs tend toward higher density. Delta-sigma DACs with aggressive filtering, high-feedback solid-state, and compact sealed monitors tend toward lower density.

**Trait key:** `tonal_density`

---

### 2.3 Sweetness — Upper-Frequency Character

**What it describes:** Whether the upper frequencies feel smooth, harmonically rich, and inviting — or dry, literal, and exposed.

**High sweetness:** Treble has a quality of warmth or glow without sounding rolled off. Cymbals shimmer rather than sizzle. Sibilance is managed. Strings have a silky quality. The listener can sustain long sessions without fatigue.

**Low sweetness (dryness):** The treble is honest and unadorned. There is no added warmth or harmonic bloom. Detail is presented literally. This can sound refreshingly transparent or, if pushed, clinical and tiring.

**Perceptual basis:** Sweetness correlates with gentle treble roll-off, low odd-order distortion, and the absence of energy peaks in the 2–6 kHz presence region. It is related to but distinct from warmth (which operates lower in frequency). Tube output stages, ribbon tweeters, and R-2R/NOS DAC topologies often exhibit sweetness. Aggressive delta-sigma reconstruction filters and metal-dome tweeters tend toward dryness.

**Trait key:** `sweetness`

**Relationship to existing signals:** Currently partially captured by `fatigue_risk: down` and `flow: up` in the signal dictionary. This trait separates the upper-frequency component from the broader concepts of flow and fatigue.

---

### 2.4 Air and Openness — Spatial Breath

**What it describes:** Whether the presentation feels spacious, unbounded, and dimensionally free — or contained, close, and boxed-in.

**High air:** There is a sense of space around instruments. The soundstage extends beyond the speakers. High-frequency harmonics decay into room space rather than stopping abruptly. The presentation feels like removing a window between the listener and the performance.

**Low air (closedness):** The presentation is more intimate and bounded. Instruments are present but the space around them is compressed. This is not inherently negative — some listeners prefer the directness of a close presentation and find excessive air diffuse or unfocused.

**Perceptual basis:** Air relates to high-frequency extension, inter-driver coherence, cabinet diffraction behaviour, and room interaction. Speakers with clean off-axis response, open-baffle or dipole designs, and electrostatics tend to excel here. Room treatment has an outsized effect on perceived air — more than most component changes.

**Trait keys:** `openness`, `soundstage`, `spatial_precision`

**Note:** The existing codebase separates `openness` (spaciousness), `soundstage` (width/depth), and `spatial_precision` (imaging specificity). These are related but independent: a speaker can image precisely within a narrow stage, or present a vast stage with vague localisation. The framework preserves this distinction.

---

### 2.5 Drive and Excitement — Forward Energy

**What it describes:** Whether the presentation pushes music forward with energy, dynamic urgency, and rhythmic insistence — or presents it in a calm, laid-back, and unhurried way.

**High drive:** The system makes music feel propulsive. Transient leading edges are emphasised. Rhythmic patterns are vivid. The listener feels engaged and physically drawn in. At the extreme, this becomes aggressive or fatiguing.

**Low drive (calmness):** The presentation is relaxed and patient. Music unfolds without urgency. This suits contemplative listening and long sessions but may feel lifeless with music that depends on rhythmic energy.

**Perceptual basis:** Drive relates to transient rise time, presence-region energy (1–4 kHz), and dynamic contrast behaviour. High-efficiency speakers, low-feedback amplifiers, and fast-slewing source components contribute to drive. High-feedback amplifiers with strong damping, soft-dome tweeters with gentle roll-off, and heavily filtered digital sources tend toward calmness.

**Trait keys:** `dynamics`, `elasticity`, `rhythm`

**Relationship between keys:**
- `dynamics` — macro-dynamic contrast and impact (punch, slam)
- `elasticity` — micro-dynamic life and responsiveness (the system's ability to follow small-scale musical gestures). Note: the codebase `TraitName` type also includes `microdynamics` as a key. For v1, `elasticity` is the canonical term; `microdynamics` should be treated as a deprecated alias pending cleanup.
- `rhythm` — timing conviction and the sense that rhythmic patterns are communicated with intent. Perceptually, rhythm relates to how a component preserves the temporal relationship between musical events — the spacing of notes, the emphasis of downbeats, the groove of a bass line. Components with fast settling time, low group delay variation, and minimal temporal smearing tend to convey rhythmic intent more convincingly. This is related to but not identical to transient speed; rhythm is about relationships between events, not the sharpness of any single event.

These often correlate but can diverge. A speaker may have strong macro-dynamics (high `dynamics`) but poor micro-dynamic responsiveness (low `elasticity`). A component may be rhythmically confident (`rhythm`) without being dynamically explosive (`dynamics`).

---

### 2.6 Groundedness — Physical Weight and Density of Foundation

**What it describes:** Whether the presentation has a solid, physically grounded foundation — or feels lightweight and free-floating.

**High groundedness:** Bass and lower-midrange energy anchors the presentation. Instruments feel planted. Orchestral music has a sense of physical scale. The system conveys the weight of acoustic instruments.

**Low groundedness (lightness):** The presentation is agile and quick but may lack physical authority in the bass and lower midrange. Works well for acoustic, vocal, and chamber music. May feel insufficient for orchestral, electronic, or heavy rock.

**Perceptual basis:** Groundedness relates to bass extension, bass-to-midrange energy continuity, cabinet volume and driver excursion (for speakers), power supply headroom (for amplifiers), and low-frequency damping behaviour. Large floorstanding speakers, powerful amplifiers with substantial power supplies, and R-2R DACs tend toward groundedness. Compact bookshelf speakers, single-ended triode amplifiers, and lean digital sources tend toward lightness.

**Trait keys:** `bass_weight`, `tonal_density` (lower-frequency component), `damping_control`

**Note:** Groundedness overlaps with tonal density but operates lower in the frequency range. A system can be tonally dense through the midrange without having strong bass foundation, and vice versa.

---

### 2.7 Control and Composure — Behaviour Under Pressure

**What it describes:** Whether the system maintains its character under dynamic stress, complex passages, and high volume — or loses composure, compresses, hardens, or distorts.

**High composure:** The system handles orchestral climaxes, dense electronic music, and high volumes without strain. Instruments remain separate. Tonal character is preserved. The listener can push the system without fear of degradation.

**Low composure:** Complex passages cause congestion, hardening, or compression. The system sounds best with simpler material or at moderate volumes. This is not always a design flaw — single-ended triode amplifiers, for instance, deliberately trade power headroom for midrange purity.

**Perceptual basis:** Composure relates to amplifier headroom, speaker driver excursion limits, crossover behaviour under stress, and power supply regulation. High-power solid-state amplifiers, speakers with large driver complements, and well-regulated power supplies favour composure. Low-power tube amplifiers, full-range single drivers, and speakers with limited bass extension trade composure for other qualities.

**Trait keys:** `composure`, `damping_control`

**Risk flags:** `fatigue_risk`, `glare_risk`

When composure breaks down, the result is often fatigue or glare — the system hardens tonally and the upper frequencies become aggressive. The risk flags capture this boundary condition. They are not continuous traits but threshold markers: present or absent.

---

### 2.8 Cross-Cutting Traits

Some traits in the codebase do not belong to a single family. They operate across families or serve specific roles:

**`warmth`** — Lower-midrange colour and tonal warmth. The user-facing taste profile includes `warmth` as a distinct trait because listeners identify it as a first-class preference. Architecturally, warmth is a composite: it draws from `tonal_density` (body, harmonic richness) and `sweetness` (upper-frequency smoothness), with emphasis on the lower-midrange and upper-bass region. The framework treats `warmth` as a user-facing proxy that maps onto multiple underlying traits. In product tendency profiles, warmth is expressed through the combination of `tonal_density` and `sweetness` assignments rather than as an independent key. In the taste profile, `warmth` remains as a distinct axis because listeners can meaningfully distinguish "I want warmth" from "I want density" — warmth implies frequency-specific colouration, not just mass.

**`texture`** — Tactile detail and the grain of instrumental surfaces. Texture describes whether instruments feel physically tangible — the rosin on a bow, the felt of a piano hammer, the breath in a vocal. It is related to but distinct from clarity (which concerns separation and transparency) and tonal density (which concerns harmonic weight). Texture is most relevant for product-level description and comparison. It appears in product trait maps and TRAIT_LABELS but is not a taste profile axis — most listeners do not articulate texture preferences directly. In the trait framework, texture is a descriptive trait used primarily in advisory writing when characterising individual products, not as a system-level reasoning axis.

**`speed`** — Transient leading-edge definition and temporal precision. Speed appears in TRAIT_LABELS and product descriptions. It overlaps with `dynamics` (macro transient impact), `elasticity` (micro-dynamic responsiveness), and `rhythm` (timing conviction). The framework does not elevate speed to a standalone family because it is better understood as a component of the Drive and Excitement family. In advisory writing, speed is a useful descriptive term ("this DAC is fast") that the engine translates internally to the appropriate combination of `dynamics`, `elasticity`, and `rhythm`.

**`clarity`** — Transparency, separation, and resolution. Clarity is used as both a desire signal (`clarity: up/down`) and a product trait. It is related to the Air and Openness family but operates differently: a product can be spacious without being clear (diffuse staging), or clear without being spacious (intimate but transparent). The framework treats clarity as a standalone product trait key that interacts with multiple families.

**Profile-to-backend mapping:** The user-facing taste profile uses seven keys (`flow`, `clarity`, `rhythm`, `tonal_density`, `spatial_depth`, `dynamics`, `warmth`) that are deliberately simpler than the full backend trait vocabulary. The mapping:

| Profile trait | Backend keys it aggregates |
|---|---|
| `flow` | `flow` |
| `clarity` | `clarity` |
| `rhythm` | `rhythm`, `elasticity` |
| `tonal_density` | `tonal_density`, `bass_weight` |
| `spatial_depth` | `openness`, `soundstage`, `spatial_precision` |
| `dynamics` | `dynamics` |
| `warmth` | `tonal_density` (lower-midrange), `sweetness` |

This aggregation is intentional. The profile is a listener self-description tool; the backend traits are the engine's reasoning vocabulary. Listeners think in terms of "spatial depth" — the engine reasons about whether that depth comes from spaciousness, stage dimensions, or imaging precision.

---

## 3. Trait Usage

### 3.1 User Language → Trait Signals

The signal dictionary (`packages/signals/signals.yaml`) maps natural language to trait signals. This mapping operates in two modes:

**Desire mode** — the listener says what they want more or less of.
Examples: "I want more warmth" → `tonal_density: up`. "Too bright" → `fatigue_risk: up, glare_risk: up`.

**Symptom mode** — the listener describes a problem without necessarily knowing the cause.
Examples: "It sounds boring" → `flow: down, dynamics: down, elasticity: down`. "Can't listen for long" → `fatigue_risk: up`.

The signal dictionary should evolve to include sweetness-related phrases that currently fold into broader categories. Specifically:

| User language | Current mapping | Preferred mapping |
|---|---|---|
| "sweet", "silky", "glow" | `flow: up, tonal_density: up` | `sweetness: up, flow: up` |
| "dry", "sterile", "clinical" | `fatigue_risk: up` | `sweetness: down` (distinct from fatigue) |
| "airy", "open", "spacious" | `clarity: up` (partial) | `openness: up` |

**Mapping principles:**
- One user phrase may activate multiple trait signals. "Organic" implies `flow: up`, `sweetness: up`, `tonal_density: up`.
- Contradictory signals within the same message are valid — the listener may be describing a complex experience. The engine should not resolve contradictions silently; it should surface them as clarification opportunities.
- Uncertainty markers ("maybe," "sort of," "not sure") reduce signal confidence but do not suppress signals entirely.
- Negation detection is limited in v1. "Not too warm" should suppress `tonal_density: up`, but the current phrase-matching engine may not catch all negation patterns. The framework acknowledges this limitation.

### 3.2 Anchor Products → Tendencies and Counter-Tendencies

Each anchor product in the catalog expresses its sonic character through the trait framework. This takes two forms:

**Tendency profile** (qualitative — preferred):
```yaml
tendencies:
  - trait: flow
    level: emphasized
  - trait: tonal_density
    level: present
  - trait: sweetness
    level: emphasized
  - trait: composure
    level: less_emphasized
```

Levels:
- `emphasized` — a defining characteristic of this product
- `present` — clearly there, not a standout
- `less_emphasized` — structurally or intentionally de-prioritised

Traits not listed are treated as neutral.

**Counter-tendencies** (what the product trades away):
```yaml
counter_tendencies:
  - clarity
  - composure
  - spatial_precision
```

Counter-tendencies are the flip side of tendencies. A tube amplifier that emphasises flow and tonal density typically counter-tends clarity and composure. This is not a deficiency — it is a design choice. The framework presents counter-tendencies as trade-offs, not criticisms.

**Assignment methodology:**

1. Start from design signals. An R-2R DAC with no oversampling has structural reasons to emphasise flow and tonal density. Begin with what the architecture predicts.
2. Validate against community consensus. If multiple independent reviewers and listener reports confirm the predicted tendencies, assign with high confidence.
3. Note divergences. If the architecture predicts warmth but listeners consistently report neutrality, the architecture prediction is wrong. Follow the evidence.
4. Assign confidence basis. Every anchor's tendency profile must declare why we believe the assignment: `review_consensus`, `listener_consensus`, `manufacturer_intent`, or `editorial_inference`.

**Rules for tendency assignment:**
- Maximum 4 traits at `emphasized` level. If everything is emphasised, nothing is.
- Counter-tendencies must be logically consistent with tendencies. A product cannot emphasise both `flow` and `clarity` at the highest level without explanation — these are often in tension.
- Risk flags (`fatigue_risk`, `glare_risk`) are binary. A product either has a known risk pattern or it doesn't. Assign conservatively — a flag is a warning, not an accusation.

### 3.3 System-Level Trait Reasoning

This is where the framework does its most important work. Individual component traits are inputs; system-level reasoning is the output.

**Compounding:** When adjacent components in the chain share the same strong tendency, the effect compounds. A warm DAC into a warm amplifier into warm speakers does not produce "warm" — it produces congested, slow, and muddy. Compounding is the most common system problem and the most common reason listeners feel something is wrong without being able to name it.

**Compensation:** When components have opposing tendencies, they can compensate for each other. A bright-leaning DAC into a warm amplifier may produce a balanced result. Compensation is a valid system design strategy, but the framework should note when balance depends on opposing forces rather than inherent neutrality — because removing one component breaks the equilibrium.

**Masking:** A strong trait in one component can mask a weaker trait in another. A speaker with extreme tonal density may hide the fact that the DAC is lean. This is not the same as compensation — the lean quality is still present in the signal, just overwhelmed perceptually.

**Conflict:** Some trait combinations produce incoherent results. A component that pushes both extreme drive and extreme sweetness simultaneously is rare because the underlying mechanisms (fast transients vs. gentle treble) are in tension. When the framework detects such combinations, it should flag them as unusual rather than impossible.

**System reasoning rules:**

1. **Map the chain.** Identify each component's dominant tendencies (top 2–3 emphasised traits) and counter-tendencies.
2. **Identify compounds.** Where two or more components share an emphasised trait, flag it as a compounding zone. Compounding is more likely to cause problems than any single component.
3. **Identify compensations.** Where one component's emphasised trait opposes another's counter-tendency, note the compensating relationship. Flag that this balance is partnership-dependent.
4. **Assess overall lean.** Synthesise the chain into a short characterisation: "This system leans warm and flowing with moderate dynamic life and limited spatial precision."
5. **Compare to listener priorities.** Does the system lean align with what the listener values? If the listener wants clarity and the system compounds warmth, the misalignment is clear. If the listener wants flow and the system compounds flow, the listener may actually be in good shape — or may be past the point of diminishing returns.
6. **Identify the limiting factor.** In a well-assembled system, one component or room condition is usually the bottleneck for the listener's highest priority. The framework should attempt to identify this.

### 3.4 Trait Reasoning by Advisory Context

Traits serve different roles depending on what the listener is asking:

**System assessment:** Traits are used to characterise the overall system lean, identify compounding zones, and assess alignment with listener priorities. The advisor reasons through the chain before drawing conclusions.

**Upgrade advice:** Traits identify what the listener wants to shift, what the current system emphasises, and what direction a new component should lean to achieve the desired change. The framework explicitly distinguishes between refinement (small shift within the same philosophy), compensation (adding a counterbalancing tendency), and architectural change (shifting the system's fundamental character).

**Comparison:** Traits provide the vocabulary for explaining how two products differ. "The Qutest emphasises timing and clarity; the Pontus II emphasises flow and tonal density. The question is which priority matters more to you." Comparisons should never reduce to "X is better than Y" — they should explain what each optimises and what each trades away.

**Diagnosis:** When the listener describes a problem, traits help the advisor reason about likely causes. "Fatigue usually traces to the upper frequencies — either a presence-region peak, odd-order distortion, or a mismatch between source brightness and speaker voicing." The diagnosis path works backward from symptom to probable trait imbalance to candidate component.

---

## 4. Confidence Handling

Confidence remains qualitative throughout the framework. There are no numeric confidence scores. Instead, confidence manifests as advisory register — how direct, how specific, and how assertive the advisor is willing to be.

### 4.1 Three Confidence Registers

**High confidence** — the advisor has strong basis for its claims.

Conditions: well-known product with community consensus, clear listener priorities (3+ signals), system context established.

Language register: Direct and specific. "This DAC emphasises timing and articulation. In your system, that's likely to push the overall lean further toward precision and away from the warmth you've described wanting."

Trait usage: Full trait reasoning. Name specific traits, describe compounding and compensation, reference anchor comparisons when illustrative.

**Moderate confidence** — partial information, plausible inferences.

Conditions: Known product category or design philosophy but limited specific data, or listener priorities are emerging but not yet fully articulated, or system context is partial.

Language register: Hedged but still useful. "Products in this design family tend to lean toward density and flow. Whether that's the right direction depends on what your current system already emphasises."

Trait usage: Trait families and tendencies rather than specific product claims. Frame reasoning as "tends to" and "often" rather than "will" and "clearly."

**Exploratory** — early in conversation, minimal context, listener still orienting.

Conditions: Fewer than 3 preference signals, no system context, or listener is asking broad questions without a specific decision in view.

Language register: Educational and orienting. "There are a few different directions this could go. Some listeners in your situation prioritise warmth and flow — they want to be drawn into the music. Others prioritise clarity and detail — they want to hear everything. Both are valid."

Trait usage: Trait families as educational vocabulary, not as product-specific claims. The goal is to help the listener articulate what they value, not to push them toward a conclusion.

### 4.2 Confidence and product specificity

Product-specific trait claims carry their own confidence independent of conversation confidence:

- An anchor product with `confidence: high` and `basis: review_consensus` can be described with authority regardless of conversation state.
- A non-anchor product reasoned about through AI market knowledge should be described with hedging regardless of how much conversation context exists.
- The two confidence dimensions (conversation confidence and product-data confidence) multiply. High conversation confidence + low product-data confidence still produces hedged advice. Low conversation confidence + high product-data confidence still produces trait education rather than directional advice.

### 4.3 Confidence and system reasoning

System-level trait reasoning inherits the lowest confidence in the chain. If three components have high-confidence trait data and one has low-confidence data, the system assessment should flag the weak link: "I can reason about most of this chain with confidence, but I'm less certain about the DAC's contribution — that affects how much weight to put on the overall assessment."

---

## 5. Advisory Writing Guidance

### 5.1 Voice principles

The trait framework supports the advisory voice. It does not replace it. When a builder constructs a response, traits are the reasoning substrate — the internal logic that connects listener priorities to equipment tendencies. But the response itself should sound like a knowledgeable person thinking through a question, not like a system returning scored results.

**Good:** "The Pontus II tends to bring a sense of tonal weight and musical flow that's hard to find at this price. In your system, with the AHB2 providing very precise, controlled amplification, it's likely to add some warmth and harmonic body that the Benchmark doesn't contribute on its own. The trade-off is you may give up some of the razor-sharp transient definition you'd get from a Chord-style DAC."

**Bad:** "Pontus II scores high on tonal density and flow. Your system has high clarity from the AHB2. The Pontus compensates."

The first version reasons through traits. The second version reports them.

### 5.2 Trait vocabulary in responses

When using trait language in user-facing responses, prefer natural listening descriptions over framework terminology:

| Internal trait | Preferred language |
|---|---|
| `flow` | musical flow, continuity, phrasing |
| `tonal_density` | tonal weight, body, harmonic richness |
| `sweetness` | sweetness, smoothness, treble warmth |
| `openness` | air, openness, spaciousness |
| `dynamics` | dynamic life, punch, contrast |
| `elasticity` | micro-dynamic responsiveness, liveliness |
| `rhythm` | rhythmic drive, timing, pace |
| `composure` | composure, control under stress |
| `clarity` | clarity, transparency, resolution |
| `fatigue_risk` | listening fatigue, upper-frequency edge |
| `glare_risk` | glare, hardness, aggressive treble |

The advisor should never say "this product has high elasticity." It should say "this tends to be dynamically alive — it follows the music's small gestures rather than smoothing them over."

### 5.3 Structuring trait-informed responses

When the advisory response structure applies (system assessments, upgrade advice, comparisons), traits inform each section:

1. **Context framing** — traits identify what the listener's real question is. "You're asking about DACs, but the underlying question seems to be about adding tonal density and sweetness to a system that's currently leaning analytical."

2. **Architectural identity** — traits describe the product's design bias in listening terms, not marketing terms. "The Pontus II is an R-2R ladder DAC that prioritises harmonic density and musical flow over transient precision."

3. **Mirror alignment** — traits connect the product's tendencies to the listener's stated or inferred priorities. "You've mentioned wanting more body and richness — that's directly in this product's wheelhouse."

4. **Chain interaction** — system-level trait reasoning shows how the product would behave in the listener's specific chain. "Your amplifier already leans warm. Adding a warm-leaning DAC could push you past the sweet spot into congestion."

5. **Value lens** — traits frame proportionality. "The sonic shift you're looking for — more warmth and density — is relatively achievable at this price point. You don't need to spend more to get this particular quality."

6. **Restrained conclusion** — trait-informed but not trait-driven. "This is a strong fit for what you've described. The one thing to watch is that it may reduce the transient crispness you're currently getting."

7. **Directional options** — each path is framed in trait terms. "Path A optimises for density. Path B optimises for flow without sacrificing clarity. Path C is to stay put — your current system may be closer to balanced than it feels."

### 5.4 What the engine should never do

- **Never list trait scores.** No "flow: 0.8, clarity: 0.4" in responses.
- **Never rank products by trait sums.** Traits are not additive. A product with high flow and high dynamics is not "better" than one with moderate flow and high clarity.
- **Never use trait language as marketing.** "Incredible flow and stunning dynamics" is not advisory language. "Tends to emphasise musical flow and dynamic contrast" is.
- **Never present traits as objective truth.** "Listeners consistently describe this as..." is better than "this has..."
- **Never hide behind traits to avoid saying something.** If the advisor's assessment is that a product is a poor fit, say so in plain language. Traits explain why, but the conclusion should be clear and human.
- **Never assign traits to products without declared basis.** If the engine doesn't have confidence in a trait assignment, it should say "I'm reasoning from limited information" rather than presenting uncertain claims as established.

---

## 6. Implementation Notes

### 6.1 Relationship to existing code

The codebase currently uses two parallel trait systems:

1. **Numeric traits** (`Record<string, number>`, 0–1 scale) — used for product scoring and comparison. Defined in product catalogs (e.g., `speakers.ts`).

2. **Qualitative tendency profiles** (`TendencyProfile` in `sonic-tendencies.ts`) — used for explanation and advisory writing. Uses `emphasized / present / less_emphasized` levels.

The bridge function `resolveTraitValue()` converts qualitative profiles to numeric values for scoring. This dual system should persist for v1, with the qualitative profile as the source of truth for advisory reasoning and the numeric values available for scoring operations that require them.

### 6.2 New trait keys

The framework introduces one new trait key not currently in the codebase:

- `sweetness` — currently partially captured by combinations of `fatigue_risk: down`, `flow: up`, and `tonal_density: up`

The `sweetness` trait should be added to:
- Signal dictionary (new phrases and refinement of existing mappings)
- Product tendency profiles (anchor population)
- Taste profile keys (extending `ProfileTraitKey`)

### 6.3 Trait key reference

Complete list of trait keys for v1, grouped by family:

| Family | Keys | Risk flags |
|---|---|---|
| Flow | `flow` | — |
| Tonal density | `tonal_density`, `bass_weight` | — |
| Sweetness | `sweetness` | — |
| Air and openness | `openness`, `soundstage`, `spatial_precision` | — |
| Drive and excitement | `dynamics`, `elasticity`, `rhythm` | — |
| Groundedness | `bass_weight`, `tonal_density` (overlap), `damping_control` | — |
| Control and composure | `composure`, `damping_control` | `fatigue_risk`, `glare_risk` |

Cross-cutting and descriptive keys (not primary family members — see section 2.8):

| Key | Role | Notes |
|---|---|---|
| `warmth` | Profile trait, user-facing proxy | Maps to `tonal_density` + `sweetness` in lower-midrange region |
| `texture` | Product descriptive trait | Tactile detail; used in product comparison, not system reasoning |
| `speed` | Descriptive alias | Maps to `dynamics` + `elasticity` + `rhythm` |
| `clarity` | Desire signal + product trait | Transparency and separation; interacts with multiple families |
| `microdynamics` | Deprecated alias | Use `elasticity`; pending codebase cleanup |

Additional signal-only keys (used for symptom detection, not as product traits):
- `low_volume_integrity` — captures "thin at low volume" symptom

### 6.4 Migration path

1. Add `sweetness` to trait key types and signal dictionary.
2. Populate anchor product tendency profiles using the framework's assignment methodology.
3. Refactor advisory builders to follow system context → trait inference → system balance → anchor comparison → upgrade direction → product suggestion order.
4. Update signal dictionary phrase-to-trait mappings per section 3.1 table.
5. Extend taste profile to include `sweetness` as an eighth profile trait.

### 6.5 What this document does not cover

- Specific anchor product trait assignments (deferred to anchor population step)
- Builder implementation details (deferred to builder refactor step)
- Non-anchor product trait inference rules (deferred to future iteration)
- Room acoustics as a trait modifier (acknowledged as important, deferred)
- Headphone-specific trait behaviour (optional for v1)
