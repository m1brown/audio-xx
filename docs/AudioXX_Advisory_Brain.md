# Audio XX — Advisory Brain

How the advisory engine reasons about audio systems, components, and
listener preferences.

---

## 1. Purpose

Audio XX is a system-aware audio advisory engine. It analyzes component
interactions and listener preferences rather than recommending products
in isolation.

The engine follows reviewer-style reasoning — the kind of structured
thinking an experienced audiophile reviewer uses when evaluating how a
component behaves within a specific system and for a specific listener.
It identifies system tendencies, explains causal relationships between
components and sound, surfaces trade-offs, predicts how changes would
alter the system, and relates the result to what the listener values.

Audio XX does not score products. It does not rank. It reasons about
alignment between a system's character and a listener's priorities.

---

## 2. Advisory Reasoning Structure

The engine follows a five-step reasoning pipeline. Each step builds on
the previous one.

### Step 1 — System Character

Identify the likely tendencies of the system as a whole. A system built
around a high-damping solid-state amplifier and low-efficiency speakers
has a different character than one built around a single-ended triode
and high-efficiency horns. The engine infers these tendencies from
component-level traits and interaction patterns.

### Step 2 — Causal Explanation

Explain which component traits create those tendencies. If a system
leans analytical, the engine traces that to specific design
characteristics — a delta-sigma DAC topology with emphasis on measured
precision, a high-feedback amplifier circuit, or a metal-dome tweeter.
The goal is to connect what the listener hears to why the system
produces that character.

### Step 3 — Trade-off Identification

Identify what the system gains and what it sacrifices. Every design
emphasis has a cost. A system optimised for transient speed may
sacrifice harmonic richness. A system optimised for tonal density may
sacrifice spatial precision. The engine surfaces these trade-offs so
the listener can evaluate them against their own priorities.

### Step 4 — Predicted Change

Explain how a proposed component change would alter the system. If the
listener is considering a different DAC, the engine predicts how that
DAC's tendencies would interact with the existing amplifier and
speakers. Predictions are framed conditionally — the engine is
confident about component traits but careful about system-level
outcomes.

### Step 5 — Preference Alignment

Relate the predicted result to the listener's stated preferences. If
the listener values engagement and flow, the engine evaluates whether
the proposed change moves the system toward or away from those
priorities. Alignment with listener goals is the final filter — a
technically excellent change that moves the system away from what the
listener values is not a good recommendation.

---

## 3. System Tendency Axes

The engine reasons along four primary system dimensions. These are
character axes, not quality judgments. A system that leans toward one
end of an axis is not better or worse — it is different.

### Tonal Richness

**Definition:** The density and saturation of harmonic content in the
system's presentation.

**High end:** Rich, warm, harmonically saturated. Instruments have
weight and body. Vocals feel present and full.

**Low end:** Lean, spare, harmonically thin. The presentation
emphasises clarity over density. Instruments may feel lightweight.

**Typical contributors:** DAC topology (R2R and multibit designs tend
toward richness; delta-sigma designs tend toward leanness), amplifier
class (Class A and tube circuits tend toward harmonic density),
speaker driver materials, cabinet resonance behaviour.

### Transient Speed

**Definition:** How quickly the system renders the leading edge of
musical events — attacks, plucks, percussion strikes.

**High end:** Fast, precise, rhythmically incisive. Transients arrive
with snap and definition. The system feels agile and responsive.

**Low end:** Relaxed, smoothed, temporally gentle. Transients are
softened. The system feels laid-back and unhurried.

**Typical contributors:** Amplifier damping factor and feedback
topology, speaker driver mass and efficiency, DAC output stage
architecture, cable impedance characteristics.

### Resolution

**Definition:** The system's ability to render fine detail, spatial
cues, and low-level information.

**High end:** Detailed, revealing, transparent. Micro-dynamics and
spatial cues are clearly rendered. The system rewards close listening.

**Low end:** Smooth, forgiving, less explicit. Fine detail is present
but not emphasised. The system is less demanding of source quality.

**Typical contributors:** DAC precision and jitter performance,
amplifier noise floor, speaker driver resolution and crossover design,
room acoustics and absorption.

### Control / Grip

**Definition:** How tightly the amplifier manages speaker driver
movement, particularly in the bass and lower midrange.

**High end:** Tight, damped, precise. Bass is controlled and defined.
The system feels authoritative and composed under dynamic load.

**Low end:** Loose, elastic, free. Bass has more bloom and movement.
The system feels more relaxed and organic in its low-frequency
behaviour.

**Typical contributors:** Amplifier damping factor, feedback topology
(high-feedback designs increase grip; low-feedback and zero-feedback
designs reduce it), speaker efficiency and impedance curve, output
impedance of the amplifier relative to speaker impedance.

---

## 4. Certainty Rules

The engine uses three levels of certainty in its advisory output. The
level depends on what is being described.

### Component traits — confident statements

When describing known design characteristics of a specific component,
the engine speaks with confidence. These are established facts about
the component's architecture and typical behaviour.

Example: "The Denafrips Pontus uses an R2R ladder DAC topology. This
architecture typically emphasises tonal density and harmonic richness."

### System tendencies — analytical statements

When describing the inferred character of a system composed of multiple
components, the engine uses analytical framing. System behaviour
emerges from component interaction and is less predictable than
individual component traits.

Example: "Your system currently leans warm and harmonically rich. This
comes from the combination of an R2R DAC and a low-feedback tube
amplifier — both contribute tonal density."

### Upgrade predictions — conditional statements

When predicting how a change would alter the system, the engine uses
conditional language. Predictions involve interaction effects that
depend on room, placement, source quality, and listener sensitivity.

Example: "Adding a high-feedback solid-state amplifier would likely
increase transient precision and bass control, but may reduce some of
the harmonic richness your current tube amplifier provides."

---

## 5. Component Trait Reasoning

System inference is grounded in component-level design characteristics.
The engine maintains knowledge about how specific design choices
influence sonic behaviour.

Key trait dimensions include:

**DAC architecture** — R2R / multibit vs delta-sigma vs FPGA-based.
Each topology has characteristic strengths in timing, harmonic
structure, and resolution.

**Amplifier topology** — Single-ended triode, push-pull tube,
solid-state Class A, Class A/B, Class D. Each has characteristic
damping behaviour, harmonic distortion profile, and output impedance.

**Damping factor** — The ratio of speaker impedance to amplifier output
impedance. High damping provides grip and control; low damping allows
more driver freedom and elasticity.

**Speaker efficiency** — High-efficiency speakers (90 dB+) respond
differently to amplifier topology than low-efficiency designs. They
are more revealing of amplifier character and more compatible with
low-power topologies.

**Driver topology** — Cone materials, crossover complexity, cabinet
design, and porting all influence how a speaker renders transients,
harmonics, and spatial information.

These component-level traits feed the system tendency inference layer.
The engine combines them to predict system-level character rather than
evaluating any single component in isolation.

---

## 6. System Interaction Principles

The advisory engine reasons about how components interact within a
system. Some common interaction patterns it evaluates:

**Stacking fast components.** When multiple components in a chain
emphasise transient speed — a fast DAC, a high-feedback amplifier, and
a metal-driver speaker — the cumulative effect can push the system past
incisive into aggressive. The engine identifies when speed is being
compounded rather than balanced.

**High-damping amplifiers with efficient speakers.** High-efficiency
speakers are more sensitive to amplifier character. A high-damping
solid-state amplifier paired with a 96 dB horn speaker can produce an
over-controlled, dry presentation. The engine flags this mismatch.

**Warm DACs with analytical speakers.** A tonally rich DAC paired with
a detail-forward speaker can create a complementary balance — the DAC
adds density that the speaker's precision renders clearly. The engine
recognises these compensatory pairings and evaluates whether the
balance serves the listener's priorities.

**Low-feedback amplifiers with demanding loads.** Low-feedback and
zero-feedback amplifier designs lose grip into speakers with difficult
impedance curves or low efficiency. The engine considers whether a
proposed amplifier has the electrical characteristics to drive the
listener's speakers.

The engine does not treat these as rules to enforce. It treats them as
interaction patterns to surface so the listener can make informed
decisions.

---

## 7. Listener Preference Alignment

Recommendations are evaluated against the listener's stated goals.
The engine identifies listener priorities from conversation language
and, when available, from a stored taste profile.

Common listener priority dimensions:

**Engagement** — The listener values musical involvement, rhythmic
drive, and the feeling of being drawn into the performance.

**Warmth** — The listener values tonal body, harmonic richness, and
a full, weighted presentation.

**Clarity** — The listener values detail, transparency, and the
ability to hear into recordings.

**Control** — The listener values precision, composure, and a system
that handles complex passages without strain.

**Flow** — The listener values continuity, smoothness, and a
presentation where music feels connected rather than dissected.

The engine prioritises alignment between the system's character and
the listener's priorities. A technically superior component that moves
the system away from what the listener values is not considered a good
recommendation. Conversely, a modest change that improves alignment
with the listener's priorities is considered valuable even if it does
not represent an objective upgrade on any single measured dimension.
