# Audio XX — Architecture Backlog

Architectural improvements and future intelligence features.
Items here are not scheduled. They are captured during development so
they are not lost between sessions.

---

## System Intelligence

### System Tendency Inference

**Status:** Not implemented
**Depends on:** Multi-system model (Phases 1–5, implemented)

Infer aggregate system tendencies from the component chain. Currently,
`tendencies` is a free-text field set manually in the system editor or
derived from a simple `inferTendenciesFromComponents()` heuristic that
maps known brands to broad character labels.

**Target capability:**

Given a system's component list, produce a structured tendency profile
across dimensions such as:

- **Transient behavior:** fast / transient-focused vs relaxed / smoothed
- **Harmonic signature:** warm / harmonically rich vs lean / analytical
- **Control profile:** damping-heavy / grip-oriented vs elastic / free
- **Efficiency pairing:** high-efficiency friendly vs power-demanding
- **Tube affinity:** tube-friendly topology vs solid-state optimized

**Approach considerations:**

- Derive from component-level `traitTendencies` in the catalog when
  available. Existing seed data already carries per-component trait maps.
- Apply interaction rules for component pairs: high-damping amp with
  high-efficiency speaker suggests over-controlled risk; low-feedback
  amp with low-sensitivity speaker suggests headroom concern.
- Output should be a structured object, not free text, so advisory
  builders can reason against it directly.
- Degrade gracefully when components lack catalog entries. Fall back to
  brand-level heuristics, then to no inference.

**Advisory integration:**

Once available, structured system tendencies would feed into
`diagnoseSystem()` and `generateAlignmentRationale()`, replacing the
current free-text bridge with trait-direction signals the reasoning
pipeline can operate on.

---

## Advisory Engine Improvements

<!-- Future entries for reasoning pipeline, rule engine, signal processing -->

---

## Data Model Enhancements

<!-- Future entries for schema evolution, persistence, migration -->

---

## UI / Product Evolution

<!-- Future entries for interface, interaction patterns, user experience -->

---

## Deferred — Intent-aware recommendation nudge (post D-11)

**Context.** Doctrine D-11 (Explanatory Licensing) retired the former
*intent-aware bottleneck promotion*: a listener priority (e.g. "I want more
detail") could elevate a warm system's tonal character to a "Highest Impact"
primary diagnosis. Under D-11 a listener priority may not create or elevate a
primary diagnosis, and a component's character is never a licensed bottleneck.

**Deferred capability.** If we still want to let a stated listener priority shape
the *direction* of a recommendation, it must be reintroduced strictly as a
**recommendation-layer** capability — never as diagnostic logic, and only when a
recommendation is already licensed (an identified limitation / trade-off /
priority per D-8). It must not manufacture a primary diagnosis. This aligns with
the reserved `priority` state noted in D-8 (see
`causal-explanation-architecture-v1.md` §0b), which is defined but not yet
produced. No design work scheduled; gated on need.
