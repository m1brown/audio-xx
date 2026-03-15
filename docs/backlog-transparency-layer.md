# Backlog: Transparency & Sources Layer

Status: concept — not yet scheduled for implementation.

---

Audio XX should eventually surface the reasoning and evidence behind its advisory output. The goal is not academic citation but honest orientation: helping listeners understand *why* the system says what it says, and where the knowledge comes from.

Four source categories to expose:

**1. Listening literature**
Published reviews, listener consensus threads, and measurement databases that inform product tendency data. The system already tracks `sourceReferences` per product and `basis` per tendency claim (review_consensus, listener_consensus, editorial_inference). A transparency layer would make these visible to the user on request — not inline, but accessible.

**2. Engineering principles**
Design archetype knowledge (R2R behaviour, FPGA pulse array timing, delta-sigma noise shaping, feedback topology trade-offs) currently lives in `design-archetypes.ts` and feeds architectural explanations. A transparency layer would let users drill into *why* architecture tends to produce certain sonic outcomes — grounded in recognised engineering domains, not speculative claims.

**3. Human listening calibration**
Axis positions and trait assignments are calibrated against human listening judgement, not derived purely from specifications or automated inference. The calibration principles (e.g. "clarity ≠ brightness") and anchor references should be surfaceable so users can understand and challenge the framework's assumptions.

**4. Advisory framework explanation**
The four-axis model, fatigue overlay, system-level reasoning (compounding, compensation, chain interaction), and the outcome hierarchy (long-term engagement over short-term impressiveness) are structural choices that shape every recommendation. Users should be able to understand the framework without needing to read source code.

---

Design intent: this is not a footnote system. It is an optional depth layer — available when a listener wants to understand the reasoning, invisible when they don't. The advisory voice stays conversational; the transparency layer supports it without cluttering it.
