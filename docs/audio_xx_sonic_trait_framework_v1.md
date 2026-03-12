# Audio XX — Sonic Trait Framework v1

**Status:** Draft for implementation
**Purpose:** Define the internal sonic trait language used by Audio XX for advisory reasoning.

This document defines the first structured sonic trait framework for Audio XX.
It should guide future implementation of trait inference, system character modeling, upgrade reasoning, and advisory language.

**Relationship:** Extends the Knowledge Model. Precedes builder refactoring and anchor population.

---

## 1. Trait Philosophy

### What traits are

Traits are the internal vocabulary the advisor uses to think about how equipment presents music. They describe tendencies — what a component, system, or listening experience leans toward — not fixed properties.

A trait assignment is a heuristic claim: "this product tends to lean warm and smooth" is a different kind of statement from "this product measures flat to 20 kHz." Both may be true. The trait framework concerns itself with the first kind.

### What traits are not

Traits are not scores. They do not rank products. A product that leans warm is not better than one that leans bright — it prioritises differently. The framework exists to reason about alignment between listener priorities and equipment tendencies, not to produce league tables.

Traits are not guarantees. A DAC described as "warm-leaning" will not sound warm in every system. Upstream source quality, amplifier topology, speaker sensitivity, room acoustics, and cable choices all modulate the final result. Traits describe the contribution a component tends to make to the chain, not the experience the listener will definitely have.

Traits are not permanent. Community perception shifts. Firmware updates change DAC behaviour. The framework should hold its assignments loosely and update them when evidence accumulates.

### Design principles

**Believable reasoning over rigid classification.** The framework should produce advisory responses that sound like a thoughtful listener explaining what they hear — not a database returning query results. If a trait assignment leads to mechanical-sounding advice, the assignment is being used wrong.

**Context over absolutes.** "This DAC is warm" means something different depending on whether it feeds a First Watt amplifier or a Benchmark AHB2. Traits are interpreted relative to the system they enter, the listener who hears them, and the musical priorities in play.

**Perceptual grounding.** Traits map to listening experience, not measurement curves. Where psychoacoustic research illuminates why a perception occurs, the framework should reference it — but the trait itself remains experiential.

**Honesty about uncertainty.** When confidence is low, the framework should say so. Uncertainty is not failure — it is useful information for the listener.

**Simplicity over taxonomy.** The framework uses language that real listeners already use. Strict orthogonality is not required if it weakens realism. Four axes and one risk overlay should cover the vast majority of advisory reasoning.

---

## 2. Primary Advisory Axes

The framework is built around four perceptual axes and one system-outcome overlay. Each axis is a continuum — products and systems sit somewhere along each one. Listeners have preferences along each axis, though those preferences may be unconscious or unarticulated.

The four axes use language drawn directly from how listeners actually describe sound. They are the primary reasoning tools for all advisory work.

---

### 2.1 Warm ↔ Bright

**What it describes:** The tonal balance — whether the presentation leans toward richness, body, and harmonic weight, or toward clarity, presence, and upper-frequency energy.

**Warm side:** Instruments have body and weight. The lower midrange and upper bass carry presence. Voices have chest resonance. Piano sounds like wood and felt, not just pitch. Treble is smooth or gently recessed. The overall impression is full, rich, and physically substantial.

**Bright side:** The upper frequencies are prominent and energetic. Detail is vivid and forward. Cymbals cut through. Transient edges are sharp. The overall impression is clear, open, and immediate. At the extreme, this becomes harsh, sibilant, or fatiguing.

**What shapes it:** Harmonic distortion profile (even-order adds warmth), frequency balance through the presence region (2–6 kHz), treble energy and roll-off behaviour. R-2R DACs, tube amplifiers, and speakers with larger drivers tend warm. Delta-sigma DACs with aggressive filtering, high-feedback solid-state, and metal-dome tweeters tend bright.

**In system reasoning:** This is the axis listeners identify most naturally. Compounded warmth (warm DAC + warm amp + warm speakers) produces congestion and muddiness — not "warmth." Compounded brightness produces fatigue and glare. Most well-balanced systems sit somewhere in the middle, with individual components contributing slight leans that offset each other.

---

### 2.2 Smooth ↔ Detailed

**What it describes:** Whether the presentation prioritises musical continuity, flow, and ease — or separation, resolution, and articulation.

**Smooth side:** Notes hand off to each other naturally. Phrases breathe. Decay feels organic. The listener follows the musical line rather than hearing individual events. Grain is minimised. Long listening sessions are comfortable. At the extreme, this becomes veiled, soft, or lacking in resolution.

**Detailed side:** Individual transients and textures are prominent. Separation is high. Instrument surfaces are tactile — the rosin on a bow, the breath in a vocal. Inner voices are revealed. At the extreme, this becomes analytical, clinical, or mechanical.

**What shapes it:** Temporal micro-detail handling, inter-sample behaviour, group delay characteristics, filter topology. NOS DACs, low-feedback amplifiers, and single-driver speakers tend smooth. FPGA-based DACs, high-feedback solid-state, and studio monitors with aggressive crossovers tend detailed.

**In system reasoning:** Smooth and detailed are often in tension — the mechanisms that increase resolution tend to reduce the sense of musical flow, and vice versa. When a listener says "I want more detail but I don't want to lose the smoothness," they are describing this axis directly. The advisor should help them find where on this continuum they want to sit, and which component is most responsible for the current position.

---

### 2.3 Elastic ↔ Controlled

**What it describes:** Whether the presentation feels dynamically alive, responsive, and rhythmically free — or precise, damped, and tightly held.

**Elastic side:** Music feels propulsive and physically engaging. Transient leading edges have snap. Micro-dynamic gestures are preserved — the system follows the music's smallest inflections. Rhythmic patterns feel vivid and intentional. At the extreme, this becomes loose, underdamped, or uncontrolled.

**Controlled side:** The system maintains composure under dynamic stress. Bass is tight and well-damped. Complex passages stay separated. The listener can push the system hard without degradation. At the extreme, this becomes overdamped, lifeless, or mechanical — music sounds controlled but uninvolving.

**What shapes it:** Amplifier damping factor, speaker efficiency, power supply headroom, feedback topology. Low-feedback amplifiers, high-efficiency speakers, and single-ended triode designs tend elastic. High-feedback solid-state amplifiers with strong damping factor, sealed-box speakers, and well-regulated power supplies tend controlled.

**In system reasoning:** This axis often determines whether a listener describes their system as "musical" or "impressive." Elastic systems engage the body — toe-tapping, head-nodding. Controlled systems impress the mind — precise, authoritative, unflappable. The two are not fully exclusive but they are genuinely in tension. High grip with low elasticity is the overdamping problem: music sounds dead despite measuring well. High elasticity with low control is the "all over the place" problem: exciting but fatiguing with complex material.

---

### 2.4 Airy ↔ Closed

**What it describes:** Whether the presentation feels spacious, open, and dimensionally free — or bounded, intimate, and contained.

**Airy side:** There is a sense of space around instruments. The soundstage extends beyond the speakers. High-frequency harmonics decay into the room rather than stopping abruptly. The presentation breathes. At the extreme, this becomes diffuse, unfocused, or lacking in directness.

**Closed side:** The presentation is intimate and bounded. Instruments are present and direct but the space around them is compressed. The listener is close to the performance rather than in the concert hall. At the extreme, this becomes boxy, congested, or claustrophobic.

**What shapes it:** High-frequency extension, inter-driver coherence, cabinet diffraction, room interaction. Speakers with clean off-axis response, open-baffle designs, electrostatics, and ribbon tweeters tend airy. Compact sealed bookshelf speakers, horn-loaded designs (paradoxically direct but sometimes closed-in spatially), and heavily damped rooms tend closed. Room treatment has an outsized effect on this axis — more than most component changes.

**In system reasoning:** This axis is disproportionately affected by room acoustics. Before attributing spatial complaints to equipment, the advisor should flag room context as a confounding factor. Adding air to a system that is already bright may tip the upper frequencies toward glare rather than openness — the Warm ↔ Bright axis interacts strongly with Airy ↔ Closed.

---

### 2.5 Relaxed ↔ Fatiguing (System-Outcome Overlay)

**What it describes:** Whether the system sustains comfortable long-session listening — or produces strain, edge, or the desire to turn down.

This is not a design axis in the same way as the four above. It is an *outcome* — the result of how the other axes combine in a specific system for a specific listener. It is included as a primary-level concept because fatigue is the most common complaint listeners bring to an advisor, and it requires its own reasoning path.

**Relaxed side:** The listener can sustain hours of engagement without strain. The system does not demand attention — it rewards it. Detail is present without being forced. Energy is present without being aggressive.

**Fatiguing side:** The listener feels strain, edge, or the need to take breaks. Common symptoms: sibilance, glare, hardness in the upper midrange, compression artefacts, or a relentless "in your face" quality.

**What produces fatigue:** Fatigue usually traces to the upper frequencies — presence-region peaks (2–6 kHz), odd-order distortion, aggressive treble energy, or a combination of bright + detailed without sufficient warmth or smoothness to cushion the presentation. But fatigue can also come from compression (the system hardens under dynamic stress), from bass problems (room modes producing physical discomfort), or from sheer loudness.

**In system reasoning:** When a listener reports fatigue, the advisor should not immediately blame a single component. The reasoning path is: (1) identify where on the Warm ↔ Bright axis the system sits, (2) check whether the Smooth ↔ Detailed axis is pushing detail without smoothness, (3) assess whether the Elastic ↔ Controlled axis reveals composure problems under stress, (4) consider room acoustics. Fatigue is almost always a system-level interaction, not a single-component deficiency.

**Risk flags:** `fatigue_risk` and `glare_risk` are binary markers on products. They indicate that a component has a known tendency to contribute to fatigue in certain system contexts — not that it will always produce fatigue. A bright-leaning DAC has `fatigue_risk` not because it is bad, but because in a system already leaning bright and detailed, it may push past the comfort boundary.

---

## 3. Secondary and Explanatory Traits

The four primary axes and the fatigue overlay handle most advisory reasoning. But finer-grained concepts are needed for product description, system diagnosis, and explanatory depth. These secondary traits are not independent axes — they describe specific aspects of the primary axes or capture qualities that cut across them.

Secondary traits appear in product tendency profiles, in advisory explanations, and in diagnostic reasoning. They do not appear as top-level axes in system assessment or user-facing profiles.

### 3.1 Secondary Trait Definitions

**`flow`** — Musical continuity and phrasing. The sense that music moves as a connected whole rather than as discrete events. Primarily expresses the smooth side of Smooth ↔ Detailed, with an emphasis on temporal connectedness. NOS DACs and low-feedback amplifiers tend to emphasise flow.

**`sweetness`** — Upper-frequency smoothness with harmonic richness. Treble that shimmers rather than sizzles. Operates at the intersection of Warm ↔ Bright (warm side) and Smooth ↔ Detailed (smooth side), specifically in the upper frequencies. Tube output stages and ribbon tweeters tend toward sweetness. Distinct from warmth, which operates lower in frequency.

**`tonal_density`** — Harmonic weight and body. The physical substance of instruments. Primarily expresses the warm side of Warm ↔ Bright, with emphasis on the lower midrange. R-2R DACs and tube amplifiers tend toward density. Extreme density without counterbalancing clarity produces congestion.

**`clarity`** — Transparency, separation, and resolution. The ability to hear into the mix. Expresses the detailed side of Smooth ↔ Detailed and the bright side of Warm ↔ Bright. High-feedback solid-state and studio monitors tend toward clarity. Not the same as brightness — a component can be clear without being bright.

**`dynamics`** — Macro-dynamic contrast and impact. Punch, slam, the difference between loud and soft. Primarily the elastic side of Elastic ↔ Controlled at the large-scale level. High-efficiency speakers and powerful amplifiers tend toward strong dynamics.

**`elasticity`** — Micro-dynamic life and responsiveness. The system's ability to follow small-scale musical gestures — the accent on a note, the breath between phrases. The elastic side of Elastic ↔ Controlled at the fine-grained level. Low-feedback amplifiers and high-efficiency speakers tend toward elasticity. Distinct from macro-dynamics: a speaker can slam without being micro-dynamically alive.

**`rhythm`** — Timing conviction and the sense that rhythmic patterns are communicated with intent. Relates to how well a component preserves temporal relationships between musical events. Expresses the elastic side of Elastic ↔ Controlled with emphasis on timing rather than dynamic contrast. Components with fast settling time and minimal temporal smearing tend to convey rhythm convincingly.

**`composure`** — Behaviour under stress. Whether the system maintains its character during orchestral climaxes, dense electronic music, and high volumes. Expresses the controlled side of Elastic ↔ Controlled. High-power solid-state amplifiers and speakers with large driver complements favour composure. When composure breaks down, the result is often fatigue or glare.

**`openness`** — Spaciousness and the sense of unbounded presentation. Expresses the airy side of Airy ↔ Closed. Speakers with clean off-axis response and electrostatics tend toward openness.

**`soundstage`** — Width and depth of the spatial presentation. The dimensional scale of the image. Related to Airy ↔ Closed but not identical — a system can be spatially large without feeling "airy" (if the space is dense or dark-toned).

**`spatial_precision`** — Imaging specificity. The ability to place instruments precisely in the sound field. Can coexist with either end of Airy ↔ Closed — a speaker can image precisely in a small space, or vaguely in a large space.

**`groundedness`** — Physical weight in the bass and lower midrange. The sense that the presentation has a solid foundation. Relates to the warm side of Warm ↔ Bright, but operates lower in frequency. Large floorstanding speakers and powerful amplifiers with substantial power supplies contribute groundedness.

**`bass_weight`** — Low-frequency energy and extension. A component of groundedness, specifically concerning bass presence and physical impact.

**`damping_control`** — Bass tightness and transient control in the low frequencies. The controlled side of Elastic ↔ Controlled, specifically in the bass region. High damping-factor amplifiers provide damping control; excessive damping control at the expense of elasticity produces the overdamped sound.

**`texture`** — Tactile detail and the grain of instrumental surfaces. The rosin on a bow, the felt of a piano hammer. A descriptive quality used primarily in product characterisation — most listeners do not articulate texture preferences directly.

**`speed`** — Transient leading-edge definition. How quickly the system responds to musical events. A descriptive composite of dynamics, elasticity, and rhythm — not a standalone axis. Useful shorthand in advisory writing ("this DAC is fast") but not independently assigned.

### 3.2 Mapping Secondary Traits to Primary Axes

| Secondary trait | Primary axis alignment | Notes |
|---|---|---|
| `flow` | Smooth side of Smooth ↔ Detailed | Temporal connectedness |
| `sweetness` | Warm × Smooth intersection | Upper-frequency specific |
| `tonal_density` | Warm side of Warm ↔ Bright | Lower midrange emphasis |
| `clarity` | Detailed × Bright intersection | Transparency without necessary edge |
| `dynamics` | Elastic side of Elastic ↔ Controlled | Macro-scale |
| `elasticity` | Elastic side of Elastic ↔ Controlled | Micro-scale |
| `rhythm` | Elastic side of Elastic ↔ Controlled | Temporal emphasis |
| `composure` | Controlled side of Elastic ↔ Controlled | Behaviour under stress |
| `openness` | Airy side of Airy ↔ Closed | Spaciousness |
| `soundstage` | Airy ↔ Closed related | Dimensional scale |
| `spatial_precision` | Cross-axis | Imaging; independent of openness |
| `groundedness` | Warm ↔ Bright (low-frequency) | Physical foundation |
| `bass_weight` | Warm ↔ Bright (low-frequency) | Bass-specific |
| `damping_control` | Controlled side of Elastic ↔ Controlled | Bass-specific control |
| `texture` | Detailed side of Smooth ↔ Detailed | Descriptive/product-level |
| `speed` | Elastic ↔ Controlled composite | Descriptive shorthand |

### 3.3 Profile-to-Axis Mapping

The user-facing taste profile uses simplified keys that map to the primary axes:

| Profile trait | Primary axis | Secondary keys it touches |
|---|---|---|
| `warmth` | Warm ↔ Bright | `tonal_density`, `sweetness` |
| `clarity` | Smooth ↔ Detailed (detailed side) | `clarity`, `texture` |
| `flow` | Smooth ↔ Detailed (smooth side) | `flow`, `sweetness` |
| `dynamics` | Elastic ↔ Controlled (elastic side) | `dynamics`, `elasticity` |
| `rhythm` | Elastic ↔ Controlled (elastic side) | `rhythm`, `elasticity` |
| `spatial_depth` | Airy ↔ Closed | `openness`, `soundstage`, `spatial_precision` |
| `tonal_density` | Warm ↔ Bright (warm side) | `tonal_density`, `bass_weight` |

---

## 4. Trait Usage in Advisory Reasoning

### 4.1 System Assessment

When assessing a system, the advisor reasons through the primary axes first:

1. **Where does this system sit on Warm ↔ Bright?** Look for compounding: are multiple components pushing the same direction? Is the system warm enough to sound congested, or bright enough to produce edge?
2. **Where on Smooth ↔ Detailed?** Is the system resolving well or smoothing things over? Is the listener getting flow at the expense of articulation, or detail at the expense of musical involvement?
3. **Where on Elastic ↔ Controlled?** Is the system dynamically alive or overdamped? Does it have rhythmic conviction or does it sound mechanical?
4. **Where on Airy ↔ Closed?** Is the soundstage appropriate for the listener's space and preferences? Is room acoustics a confounding factor?
5. **What is the fatigue picture?** Does the combination of positions across all four axes produce a system the listener can enjoy for extended sessions?

After establishing primary positions, use secondary traits to explain *why* the system sounds the way it does and *where* in the chain the tendency originates.

### 4.2 Upgrade Advice

When a listener wants to change something, the advisor should:

1. **Identify which axis to shift.** "I want more body" → shift Warm ↔ Bright toward warm. "I want more life" → shift Elastic ↔ Controlled toward elastic.
2. **Assess how far to shift.** Refinement (small move within current philosophy), compensation (adding a counterbalancing tendency), or architectural change (shifting the system's fundamental character).
3. **Identify the leverage point.** Which component in the chain has the most influence on the relevant axis? Changing that component will have the most effect.
4. **Frame trade-offs on the other axes.** Adding warmth may reduce clarity. Adding control may reduce elasticity. Make these trade-offs explicit.

### 4.3 Product Comparison

When comparing products, the advisor should:

1. **Position each product on the relevant primary axes.** "The Qutest leans bright and detailed; the Pontus leans warm and smooth."
2. **Explain the trade-off in listener terms.** "The question is whether you want more articulation and spatial precision, or more tonal weight and musical flow."
3. **Never reduce to "X is better than Y."** Each product optimises for a different position on the axes. The comparison is about alignment with the listener's priorities, not objective quality.

### 4.4 Diagnosis

When a listener describes a problem:

1. **Map the symptom to the primary axes.** "Harsh" → too far toward bright on Warm ↔ Bright. "Boring" → too far toward controlled on Elastic ↔ Controlled, possibly too far toward smooth on Smooth ↔ Detailed. "Congested" → compounded warmth past the useful range.
2. **Identify the likely source.** Use secondary traits to pinpoint which component or system interaction is producing the symptom. Congestion might trace to a DAC's tonal density compounding with an amplifier's warmth. Fatigue might trace to a speaker's presence-region peak interacting with a bright source.
3. **Work backward from outcome to cause.** The fatigue overlay is particularly useful here — it provides a reasoning path from the listener's complaint to the probable axis positions and component contributions.

### 4.5 Synergy Analysis

When evaluating how components work together:

1. **Check for compounding.** Two components that both lean strongly warm, or both lean strongly bright, are likely compounding past the useful range.
2. **Check for compensation.** A bright DAC into a warm amplifier can produce balance — but note that this balance is partnership-dependent. Removing one component breaks the equilibrium.
3. **Check for axis conflicts.** A component that pushes Warm ↔ Bright toward warm while pushing Elastic ↔ Controlled toward elastic is coherent (tube amplifier). A component that pushes Warm ↔ Bright toward bright while pushing Smooth ↔ Detailed toward smooth is unusual and worth investigating.
4. **Assess the fatigue picture.** Even if individual axes are reasonable, their combination may produce fatigue. Bright + detailed + elastic is exciting but exhausting. Warm + smooth + controlled is comfortable but potentially boring.

---

## 5. User Language Mapping

### 5.1 How Listener Words Map to Primary Axes

| User says | Primary axis interpretation | Secondary traits touched | Notes |
|---|---|---|---|
| "bright" | Bright on Warm ↔ Bright | `clarity`, `fatigue_risk` | A symptom — the cause may be anywhere in the chain |
| "harsh" | Bright on Warm ↔ Bright (extreme) | `fatigue_risk`, `glare_risk` | Implies discomfort, not just tonal balance |
| "analytical" | Detailed on Smooth ↔ Detailed + Bright | `clarity` | High resolution without musical engagement |
| "warm" | Warm on Warm ↔ Bright | `tonal_density`, `sweetness` | Positive — the listener wants more |
| "smooth" | Smooth on Smooth ↔ Detailed | `flow`, `sweetness` | Temporal and tonal smoothness |
| "airy" | Airy on Airy ↔ Closed | `openness` | Spatial quality — distinct from brightness |
| "congested" | Warm (extreme / compounded) | `damping_control` down | System-level compounding symptom |
| "dull" | Smooth (extreme) + Controlled (extreme) | `flow` down, `dynamics` down | Disengagement across multiple axes |
| "exciting" | Elastic on Elastic ↔ Controlled | `dynamics`, `elasticity`, `rhythm` | Desire for engagement |
| "fatiguing" | Fatiguing on Relaxed ↔ Fatiguing | `fatigue_risk` | May trace to multiple axis positions |
| "lush" | Warm + Smooth | `tonal_density`, `flow`, `sweetness` | Richness with continuity |
| "clinical" | Bright + Detailed + Controlled | `clarity`, `composure` | Technically impressive but emotionally cold |
| "musical" | Smooth + Elastic | `flow`, `elasticity`, `rhythm` | Engages the listener emotionally and physically |
| "open" | Airy + Detailed | `openness`, `clarity` | Spacious with resolution |
| "aggressive" | Bright + Elastic (extreme) | `fatigue_risk`, `dynamics` | Forward energy without tonal cushion |
| "laid back" | Warm + Smooth + Controlled | `flow`, `composure` | Relaxed but potentially uninvolving |
| "thin" | Bright + Closed (low groundedness) | `tonal_density` down, `bass_weight` down | Lacks physical foundation |
| "liquid" | Smooth (emphasis on flow) | `flow`, `sweetness` | Extreme smoothness as a positive quality |

### 5.2 Mapping Principles

One user phrase may activate signals on multiple axes. "Organic" implies warm + smooth + elastic. "Sterile" implies bright + detailed + controlled.

Contradictory signals within the same message are valid — the listener may be describing a complex experience. The engine should not resolve contradictions silently; it should surface them as clarification opportunities.

Uncertainty markers ("maybe," "sort of," "not sure") reduce signal confidence but do not suppress signals entirely.

Negation detection is limited in v1. "Not too warm" should suppress warm signals, but the current phrase-matching engine may not catch all negation patterns. The framework acknowledges this limitation.

---

## 6. Anchor Product Trait Expression

### 6.1 Format

Each anchor product expresses its sonic character through the primary axes and relevant secondary traits:

```yaml
primary_leanings:
  warm_bright: warm         # or: bright, neutral
  smooth_detailed: detailed  # or: smooth, neutral
  elastic_controlled: elastic # or: controlled, neutral
  airy_closed: airy          # or: closed, neutral

secondary_tendencies:
  - trait: clarity          level: emphasized
  - trait: rhythm           level: emphasized
  - trait: openness         level: present

counter_tendencies: [tonal_density, sweetness, flow]

fatigue_notes: "Low fatigue risk in warm systems; may contribute to
  fatigue in bright or detailed systems."

reference_notes:
  - "Extremely articulate and timing-forward."
  - "Pairs well with warmer amplification."

confidence_basis: review_consensus
```

Primary leanings are the first thing the engine reads — they position the product on the four axes using plain labels. Secondary tendencies add explanatory depth. Counter-tendencies name what the product trades away.

### 6.2 Assignment Methodology

1. **Start from architecture.** Identify the design topology and predict likely axis positions from established design-principle associations.
2. **Validate against consensus.** Cross-reference with independent reviews and listener community reports. Require at least two independent sources agreeing on primary axis position.
3. **Assign secondary tendencies.** Maximum 4 traits at `emphasized`. Counter-tendencies must be logically consistent with primary leanings.
4. **Set confidence basis.** Every anchor must declare: `review_consensus`, `listener_consensus`, `manufacturer_intent`, or `editorial_inference`.
5. **Write reference notes in advisor voice.** 1–3 sentences, calm and descriptive. Never promotional.

### 6.3 Concrete Examples

**Chord Qutest** (FPGA DAC):
```yaml
primary_leanings:
  warm_bright: bright
  smooth_detailed: detailed
  elastic_controlled: elastic
  airy_closed: airy
secondary_tendencies:
  - trait: clarity          level: emphasized
  - trait: rhythm           level: emphasized
  - trait: openness         level: emphasized
  - trait: dynamics         level: present
counter_tendencies: [tonal_density, sweetness, flow]
fatigue_notes: "Can push bright/detailed systems past the comfort
  boundary. Low risk in warm, smooth systems."
reference_notes:
  - "Extremely articulate and timing-forward. Favours transient
    precision and spatial clarity over harmonic density."
  - "In a system that already leans analytical, the Qutest can push
    past the comfort boundary. Pairs well with warmer amplification."
confidence_basis: review_consensus
```

**Denafrips Pontus II** (R-2R ladder DAC):
```yaml
primary_leanings:
  warm_bright: warm
  smooth_detailed: smooth
  elastic_controlled: neutral
  airy_closed: neutral
secondary_tendencies:
  - trait: tonal_density    level: emphasized
  - trait: flow             level: emphasized
  - trait: sweetness        level: present
  - trait: dynamics         level: present
counter_tendencies: [clarity, rhythm, spatial_precision]
fatigue_notes: "Very low fatigue risk. May sound slow or veiled in
  systems that already compound warmth."
reference_notes:
  - "Dense, flowing, and harmonically rich. Music feels physically
    present rather than etched or analytical."
  - "Can sound slow or veiled in warm systems. Benefits from
    transparent amplification downstream."
confidence_basis: review_consensus
```

**RME ADI-2 DAC FS** (delta-sigma, studio-neutral):
```yaml
primary_leanings:
  warm_bright: neutral
  smooth_detailed: detailed
  elastic_controlled: controlled
  airy_closed: neutral
secondary_tendencies:
  - trait: clarity          level: emphasized
  - trait: composure        level: emphasized
  - trait: spatial_precision level: present
counter_tendencies: [tonal_density, sweetness, flow]
fatigue_notes: "Neutral tonally. Fatigue risk depends on downstream
  components — it will not add warmth to compensate for a bright chain."
reference_notes:
  - "Reference-neutral and extremely controlled. Built for accuracy
    rather than tonal colour."
  - "Some listeners find it clinical or uninvolving. Others find it
    refreshingly honest. System context determines the experience."
confidence_basis: review_consensus
```

**Tube amplifier archetype** (e.g., Line Magnetic LM-845iA, SET):
```yaml
primary_leanings:
  warm_bright: warm
  smooth_detailed: smooth
  elastic_controlled: elastic
  airy_closed: neutral
secondary_tendencies:
  - trait: flow             level: emphasized
  - trait: sweetness        level: emphasized
  - trait: tonal_density    level: emphasized
  - trait: elasticity       level: present
counter_tendencies: [composure, damping_control, clarity]
fatigue_notes: "Very low fatigue risk. Composure degrades with
  demanding speakers or complex passages."
reference_notes:
  - "Single-ended triode topology prioritises midrange purity,
    harmonic richness, and micro-dynamic responsiveness."
  - "Limited headroom means composure degrades with demanding
    speakers. Best paired with high-efficiency designs."
confidence_basis: listener_consensus
```

**High-efficiency speaker archetype** (e.g., Klipsch Heresy IV, horn-loaded):
```yaml
primary_leanings:
  warm_bright: bright
  smooth_detailed: detailed
  elastic_controlled: elastic
  airy_closed: neutral
secondary_tendencies:
  - trait: dynamics         level: emphasized
  - trait: rhythm           level: emphasized
  - trait: elasticity       level: present
  - trait: openness         level: present
counter_tendencies: [sweetness, tonal_density, spatial_precision]
fatigue_notes: "Presence-region energy can produce fatigue with
  bright upstream components. Pairs well with warm, smooth sources."
reference_notes:
  - "Horn-loaded designs excel at dynamic immediacy and rhythmic
    drive. Music feels live and present at any volume."
  - "Can sound forward or shouty in the presence region."
confidence_basis: listener_consensus
risk_flags: [fatigue_risk]
```

---

## 7. System Character Logic

### 7.1 System Character Patterns

These are recognisable axis combinations that produce predictable system-level experiences. The advisor should learn to identify and name them:

| Axis combination | Likely system character | Advisory implication |
|---|---|---|
| Bright + Detailed + Elastic | Exciting but fatiguing | System resolves everything and pushes it forward. Thrilling in short sessions. Needs warmth or smoothness to sustain. |
| Bright + Detailed + Controlled | Clinical / studio-monitor | Technically excellent, emotionally neutral. Some love it; others find it sterile. |
| Warm + Smooth + Controlled | Comfortable but potentially dull | System prioritises ease at the expense of engagement. Listener may say "nice but boring." |
| Warm + Smooth + Elastic | Musically engaging, long-session | The "musical" system. Flows, breathes, has life. May lack last-degree resolution. |
| Warm + Detailed + Elastic | Vivid and physically involving | The "front row" experience. Dense and dynamic. Risk of being overwhelming with complex material. |
| Bright + Smooth + Controlled | Unusual / contradictory | These leanings rarely coexist coherently. Flag for investigation. |
| Airy + Bright + Detailed | Spectacular staging, fatigue risk | Immersive and transparent but demanding. Needs warm/smooth elements for balance. |
| Closed + Warm + Smooth | Intimate and cosy | Comfortable for small-scale music. May feel congested with orchestral or electronic material. |

### 7.2 System Reasoning Rules

1. **Position the system on each axis.** Combine component leanings to determine the system's overall position. Shared leanings compound; opposing leanings compensate.
2. **Identify compounding zones.** When two or more components lean the same direction on the same axis, flag it. Compounded warmth produces congestion. Compounded brightness produces fatigue. Compounded smoothness produces dullness.
3. **Identify compensating partnerships.** When one component's lean offsets another's, note that the balance is partnership-dependent. Removing one component breaks the equilibrium.
4. **Assess the fatigue picture.** Run the Relaxed ↔ Fatiguing overlay across the combined axis positions. Bright + detailed is the highest fatigue risk. Warm + smooth is the lowest.
5. **Compare to listener priorities.** Does the system's axis position align with what the listener values? If not, identify which axis is most misaligned and which component has the most leverage over it.
6. **Identify the limiting factor.** One component or room condition is usually the bottleneck for the listener's highest priority.

---

## 8. Qualitative Confidence Handling

Confidence remains qualitative throughout. No numeric confidence scores.

### 8.1 Three Confidence Registers

**High confidence** — strong basis for claims.

Conditions: well-known product with community consensus, clear listener priorities (3+ signals), system context established.

Language: Direct and specific. "This DAC leans warm and smooth. In your system, which already leans warm, that's likely to push you past the sweet spot into congestion."

Usage: Full axis reasoning. Name specific positions, describe compounding and compensation, reference anchor comparisons.

**Moderate confidence** — partial information, plausible inferences.

Conditions: Known product category or design philosophy but limited product-specific data, or listener priorities emerging but not fully articulated, or system context partial.

Language: Hedged but useful. "Products in this design family tend to lean warm and smooth. Whether that's the right direction depends on what your current system already leans toward."

Usage: Axis families and general tendencies rather than specific product claims. "Tends to" and "often" rather than "will" and "clearly."

**Exploratory** — early in conversation, minimal context.

Conditions: Fewer than 3 preference signals, no system context, or listener asking broad questions.

Language: Educational and orienting. "Some listeners in your situation want warmth and smoothness — they want to sink into the music. Others want detail and elasticity — they want to hear everything and feel the rhythm. Both are valid."

Usage: Primary axes as educational vocabulary, not product-specific claims. Help the listener articulate where they want to sit on each axis.

### 8.2 Dual Confidence Dimensions

Product-data confidence and conversation confidence are independent and multiply:

- High conversation confidence + low product-data confidence → hedged advice about the specific product, even if the listener's priorities are clear.
- Low conversation confidence + high product-data confidence → trait education using the product as an example, without directional advice.

System-level reasoning inherits the lowest confidence in the chain. If one component is poorly understood, flag it as the weak link in the assessment.

---

## 9. Implementation Guidance

This section describes how the framework should later be implemented. It comes before code — no implementation changes should be made until this document is accepted.

### 9.1 Trait Assignment Rules for Anchors

When populating anchor profiles:

1. Assign primary axis leanings first (warm/bright/neutral on each axis).
2. Assign secondary tendencies second (max 4 at `emphasized`).
3. Assign counter-tendencies from trade-off logic.
4. Write fatigue notes that describe system-context-dependent risk.
5. Declare confidence basis.

### 9.2 Trait Inference Rules for Non-Anchor Products

1. **Match by design family.** Identify the closest anchor design family and reason from its pattern.
2. **Apply brand tendency.** Some brands have consistent house sounds.
3. **Hedge.** Non-anchor reasoning should always carry moderate or exploratory confidence.
4. **Never invent specifics.** If uncertain, reason at the design-family level.

### 9.3 Signal Dictionary Updates

1. Extend `packages/signals/signals.yaml` with axis-aligned mappings from section 5.
2. Add `sweetness` as a new signal key.
3. Refine spatial phrases to map to `openness` rather than `clarity`.
4. Preserve backward compatibility with existing symptom categories.

### 9.4 System-Level Combination Rules

1. Implement compounding detection per axis.
2. Implement compensation detection across axes.
3. Implement pattern matching against the system character table.
4. Synthesise overall axis positions into natural-language system characterisation.

### 9.5 Builder Integration Plan

Builders should consume the framework in this order:

1. **System context** — resolve component positions on primary axes.
2. **Trait inference** — extract listener priorities, map to axes.
3. **System balance** — run compounding/compensation detection, synthesise lean.
4. **Anchor comparison** (optional) — compare product axis position against system lean and listener priorities.
5. **Upgrade direction** — identify which axis to shift.
6. **Product suggestions** (optional) — illustrative examples of the recommended direction.

Builders that currently perform product lookup before system reasoning (`buildSystemAssessment`, `buildGearResponse`) should be refactored to defer product lookup until after steps 1–3.

### 9.6 Migration Path

1. Add primary axis leanings to anchor product schema.
2. Add `sweetness` to trait key types and signal dictionary.
3. Populate anchor profiles with primary leanings and secondary tendencies.
4. Refactor advisory builders to follow the integration plan.
5. Update signal dictionary mappings per section 9.3.
6. Implement system-level combination rules per section 9.4.

### 9.7 What This Document Does Not Cover

- Specific anchor product trait assignments beyond the five examples (deferred to anchor population step)
- Builder implementation code (deferred to builder refactor step)
- Room acoustics as a trait modifier (acknowledged as important, deferred)
- Headphone-specific trait behaviour (optional for v1)
- Cable-specific trait reasoning (partially addressed by existing builder, full integration deferred)
