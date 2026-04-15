# Core Engine Spec v1

Decision-quality reasoning engine — portable across domains.

-------------------------------------

## 1. Purpose

The core engine is a portable decision-quality reasoning system. It evaluates entities within a system, identifies constraints and trade-offs, protects stated priorities, calibrates confidence to source quality, and frames multi-path options including "do nothing."

Audio XX is the reference implementation (audio equipment advisory).
Climate Screen is the target application (climate risk and portfolio assessment).

The engine does not make decisions. It structures the reasoning that supports good decisions.

-------------------------------------

## 2. Core Engine Primitives

### Inference (Design → Behavior → Outcome)
Map observable design attributes of an entity to behavioral tendencies, then to experienced outcomes. No direct shortcuts from design to conclusion unless justified by curated knowledge.

### Trade-off Assessment
Every recommendation explicitly identifies what is likely gained, what may be sacrificed, and what is preserved. Recommendations are never presented as pure upside. Magnitude and confidence are stated.

### Preference Protection
Identify what the current system does well. Flag when a recommendation threatens a stated or inferred priority. Explicit priorities (from user input) may block a recommendation; inferred priorities may only trigger caution.

### Constraint Evaluation
Hard constraints (physical incompatibilities, capacity limits, regulatory requirements) take priority over softer preference refinements. Constraint violations override preference-level reasoning.

### Confidence Calibration
Language strength matches source quality and inference confidence. High-confidence curated data supports strong language. Low-confidence inference is surfaced as uncertain. The system never presents weak evidence as fact.

### Option Framing (Multi-path)
Present 2–3 plausible paths as different trade-off optimizations, not as a ranked hierarchy. Each path states what it optimizes and what it compromises.

### "Do Nothing" Enforcement
"No change" is always a valid outcome. The engine does not recommend change unless the likely benefit is meaningful and justified. Restraint is a first-class output.

-------------------------------------

## 3. Core Data Interfaces

These are conceptual shapes. Implementation types may carry additional domain fields.

### Entity
A single component or asset within a system.
Fields: name, role(s), attributes, behavioral profile, source quality.

### System
An ordered collection of entities that interact.
Fields: entities, system-level behavioral profile, stacked traits, identity signals.

### BehavioralProfile
A structured description of an entity's or system's tendencies along defined axes.
Fields: axis positions (enum per axis), provenance (curated / inferred / archetype).

### Constraint
A hard limitation that restricts viable options.
Fields: source entity, category, affected dimensions, severity.

### Priority
Something the user values, either stated explicitly or inferred from system characteristics.
Fields: tag, basis (explicit / inferred), source signal.

### Tradeoff
The assessed consequences of a recommendation.
Fields: likely gains, likely sacrifices, preserved strengths, magnitude, confidence, confidence reason, net-negative flag, source provenance.

### Recommendation
A directional option presented to the user.
Fields: target role, impact tier, trade-off assessment, preference protection result, concrete options.

-------------------------------------

## 4. Audio Mapping (Reference Implementation)

| Core Primitive | Audio XX Implementation |
|---|---|
| Entity | Component (DAC, amplifier, speakers, cables, source) |
| System | Signal chain (source → DAC → amp → speakers) |
| BehavioralProfile | PrimaryAxisLeanings: warm/bright, smooth/detailed, elastic/controlled, airy/closed |
| Constraint | BottleneckFinding: power_match, dac_limitation, speaker_scale, tonal_imbalance, stacked_bias |
| Priority | ListenerPriority: tonal_warmth, transparency, musical_flow, transient_speed, etc. (14 tags) |
| Tradeoff | TradeoffAssessment: gains/sacrifices/preserved from inference layer and axis delta |
| Recommendation | UpgradePathFinding: ranked by impact tier (highest / moderate / refinement) |
| Inference chain | Product catalog → InferenceResult (8 behavioral dimensions) → axis position |
| Confidence sources | curated product → brand archetype → amp topology → delta inference |
| Preference protection | DesireSignal → ClassifiedPriorities (explicit/inferred) → block/caution/safe |

-------------------------------------

## 5. Climate Screen Mapping (Target Implementation)

| Core Primitive | Climate Screen Implementation |
|---|---|
| Entity | Project, asset, facility, or investment |
| System | Portfolio, municipality, supply chain, or policy package |
| BehavioralProfile | Risk/performance/impact profile along defined axes (e.g., transition readiness, physical exposure, regulatory alignment) |
| Constraint | Financing limit, physical risk threshold, regulatory requirement, emissions cap |
| Priority | Investor mandate, policy objective, community resilience goal, return target |
| Tradeoff | Resilience vs. cost vs. return vs. compliance vs. timeline |
| Recommendation | Directional path: divest, retrofit, insure, hedge, hold, reallocate |
| Inference chain | Asset attributes → risk/performance tendencies → portfolio-level outcome |
| Confidence sources | Measured data → modeled projection → scenario estimate → qualitative assessment |
| Preference protection | Stated investment thesis or policy goal → flag when recommendation conflicts |

-------------------------------------

## 6. Interface Boundary

What the engine expects from any domain adapter:

### Inputs
- Entities with typed attributes and role assignments
- A method to derive behavioral profiles from entity attributes
- Constraint definitions with category, severity, and affected dimensions
- Priority definitions with basis (explicit / inferred) and source signal

### Derived (by engine)
- System-level behavioral synthesis from entity profiles
- Stacked trait detection (2+ entities reinforcing same tendency)
- Constraint ranking and bottleneck identification
- Trade-off assessment per recommendation path
- Preference protection assessment per recommendation path
- Confidence calibration from source provenance

### Outputs
- Ranked recommendation paths with trade-off and protection assessments
- Constraint findings with severity and affected dimensions
- System identity signals (deliberateness, coherence)
- Confidence-calibrated language guidance
- "Do nothing" assessment as a first-class option

-------------------------------------

## 7. Implementation Guidance

- Keep core reasoning logic free of domain vocabulary. Audio terms (warm, bright, DAC) belong in the audio adapter, not in trade-off or preference-protection logic.
- Isolate domain-specific keyword mappings (e.g., PRIORITY_KEYWORDS, AXIS_PRIORITY_ALIGNMENT) in adapter modules that the engine consumes as configuration.
- Avoid premature refactoring. The current Audio XX implementation is the working testbed. Extract portable abstractions only when a second domain (Climate Screen) forces the boundary.
- Use Audio XX Features 1–4 to validate all core primitives before attempting multi-domain abstraction.
- Target extraction window: after Feature 5–6, when the full reasoning pipeline is stable and tested.
- When adding new features, ask: "Does this logic depend on audio vocabulary?" If yes, it belongs in the adapter. If no, it belongs in the engine.
