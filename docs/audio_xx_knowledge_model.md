# Audio XX — Knowledge Model

**Status:** Locked for v1
**Purpose:** Define how Audio XX reasons about products and systems.

This document defines the official knowledge model for Audio XX.
Architectural decisions should remain consistent with this model unless explicitly revised.

---

## 1. Hybrid Product Knowledge Model

Audio XX uses a hybrid knowledge architecture consisting of three layers:

1. **Curated Anchor Products** — a small, stable catalog of well-understood components that represent recognizable design philosophies. These serve as comparison reference points, not as a comprehensive product listing.

2. **AI Market Knowledge** — broader awareness of the audio market drawn from general training knowledge. This provides coverage beyond the anchor catalog for conversational fluency, but is never treated as authoritative for specific trait assignments.

3. **Sonic Trait Reasoning** — the core reasoning engine. Traits describe sonic tendencies qualitatively, in context, relative to the listener's system and priorities. Trait reasoning is the primary advisory mechanism.

Audio XX is not a comprehensive product database.
It is a system advisory engine that reasons about sonic tendencies and system balance.

**Audio XX reasons primarily through sonic traits and system interactions, using curated anchor products for stability and AI knowledge for breadth.**

---

## 2. Anchor Product Strategy

The anchor catalog is small and curated by design. Its purpose is to provide stable comparison references, not to cover the entire audio market.

### v1 Target Counts

- DACs: ~10
- Amplifiers: ~10
- Speakers: 12–15
- Headphones: optional for v1

### Design Philosophy Coverage

Anchor products represent recognizable design philosophies. The catalog should include representatives of:

- FPGA DAC designs (Chord-style) — fast, incisive, timing-forward
- Ladder DAC tonal density (Denafrips-style) — dense, harmonic, flowing
- Studio-neutral DACs (RME / Benchmark-style) — transparent, measured, flat
- NOS / filterless DAC voices — organic, textured, time-domain-focused
- Tube amplification archetypes — harmonic richness, midrange density, elastic dynamics
- High-feedback solid-state amplifiers — control, precision, damping authority
- Low-feedback / zero-feedback solid-state — openness, directness, micro-dynamic life
- High-efficiency speakers — dynamic ease, liveliness at low power
- Analytical studio speakers — accuracy, imaging precision, reference neutrality
- Warm / musical speakers — tonal richness, midrange body, listener-friendly balance
- Full-range / single-driver designs — coherence, point-source imaging, simplicity trade-offs

### Anchor Selection Criteria

An anchor product should:

- Be widely recognized and discussed in the audio community
- Represent a coherent design philosophy (not a generic middle-ground product)
- Have well-understood sonic tendencies with community consensus
- Serve as a useful reference point when explaining trade-offs to listeners
- Remain stable over time (not a rapidly iterated product line)

---

## 3. Sonic Trait Philosophy

Traits are the internal reasoning language of the advisor. They describe how a component or system tends to present music.

### Trait Principles

Traits should be:

- **Qualitative** — described in listening language, not numeric scales
- **Contextual** — meaning shifts depending on the system and listener
- **System-dependent** — a trait's impact depends on chain interaction
- **Heuristic signals** — tendencies, not guarantees

Traits represent tendencies, not guarantees.
Do not use rigid numerical scoring for v1.

### Sonic Reasoning Language

The trait vocabulary reflects real listening descriptions:

- **Flow vs mechanical presentation** — whether music feels continuous and connected or segmented and analytical
- **Sweetness vs dryness** — harmonic richness and upper-frequency smoothness vs leaner, more literal reproduction
- **Air / openness / sparkle vs closedness** — spatial breath and high-frequency life vs a more contained, bounded presentation
- **Excitement / forwardness vs calmness** — dynamic urgency and presence-range energy vs relaxed, laid-back balance
- **Groundedness / density vs tonal lightness** — physical weight and midrange body vs a lighter, faster presentation
- **Control / grip vs overdamping** — bass authority and transient precision vs a constrained, lifeless feel
- **Fatigue / glare vs relaxed listening** — the boundary between vivid detail and uncomfortable edginess

These form the internal language through which the advisor interprets systems, evaluates balance, and frames directional guidance.

### Trait Interaction

Traits do not exist in isolation. The advisory engine should reason about trait interactions:

- A warm DAC into a warm amplifier may compound density into congestion
- A fast, precise source into analytical speakers may push clarity past the fatigue boundary
- Adding air to a system that already sparkles may introduce glare rather than openness

System balance reasoning depends on understanding these interactions, not just individual component traits.

---

## 4. Advisory Reasoning Order

Advisory logic follows this reasoning sequence:

```
system context
→ trait inference
→ system balance reasoning
→ anchor comparison (optional)
→ upgrade direction
→ product suggestions (optional)
```

Product suggestions should never be the starting point of advice.

The system should behave like **a knowledgeable listener explaining system balance**, not like:

- a ranking engine
- a shopping filter
- a product database

### Reasoning Stage Descriptions

1. **System context** — what is the listener working with? What components, room conditions, listening habits, and musical priorities are present?

2. **Trait inference** — given the system context and listener descriptions, what sonic traits are likely present? What tendencies dominate the current chain?

3. **System balance reasoning** — is the system balanced for the listener's priorities? Where are the compounding tendencies? Where are the gaps? Is the listener near equilibrium?

4. **Anchor comparison** (optional) — when useful, reference anchor products to illustrate a design philosophy or trade-off. Anchors clarify direction; they do not constitute recommendations.

5. **Upgrade direction** — what direction would address the listener's priorities? What trait shift would improve engagement? Is the answer refinement, compensation, or architectural change?

6. **Product suggestions** (optional) — only when confidence is sufficient and the listener has requested or signaled readiness. Suggestions are illustrative, not prescriptive.

---

## 5. Confidence Handling

Confidence remains qualitative. It influences the tone and assertiveness of advice, not numeric scoring.

### Internal Confidence Levels

- **High confidence** — well-understood system context, clear listener priorities, strong signal alignment. Advice can be direct and specific.

- **Moderate confidence** — partial system context or ambiguous preferences. Advice should frame trade-offs and present options rather than assert direction.

- **Exploratory** — minimal context, early in conversation, or listener is still articulating preferences. Advice should focus on clarifying questions, trait education, and orientation rather than product direction.

### Confidence Influence

Confidence affects:

- **Language** — high confidence uses direct framing ("this would likely..."); exploratory uses open framing ("one direction worth considering...")
- **Specificity** — high confidence can name specific anchors and directions; exploratory stays at the philosophy level
- **Recommendation gating** — product suggestions require high confidence with at least 3 preference signals and known system context (for chain-sensitive categories)

Confidence does not affect the reasoning structure itself. The same reasoning order applies at all confidence levels — only the depth and assertiveness of output changes.

---

## 6. Implementation Roadmap

1. **Define v1 anchor catalog** — select ~10 DACs, ~10 amplifiers, 12–15 speakers that represent the target design philosophies
2. **Define sonic trait framework** — formalize the trait vocabulary, interaction rules, and assignment methodology
3. **Define trait assignment rules** — how traits are assigned to anchors, how confidence is determined, how community consensus is weighted
4. **Define non-anchor product reasoning rules** — how the engine reasons about products outside the anchor catalog using AI market knowledge and trait inference
5. **Build system character model** — how the engine infers overall system character from individual component traits, and how it reasons about balance and interaction
