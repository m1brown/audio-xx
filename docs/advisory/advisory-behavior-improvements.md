# Audio XX — Advisory Behavior Improvements

## Goal

Improve advisory quality so the system behaves like an experienced audio advisor rather than a product catalog.

The core architecture must remain unchanged:
deterministic reasoning → LLM editorial rewrite → catalog validation.

Focus only on response structure and reasoning flow.

---

## 1. Refine Decision Framing Layer (partially implemented)

A decision framing layer has been built (`decision-frame.ts`). It generates a `DecisionFrame` with a core question and 2–3 strategic directions, rendered before the product shortlist in `EditorialFormat`.

When a query involves choosing between upgrade directions (e.g., "best DAC under $2000", "what should I upgrade"), responses should follow this reasoning order:

1. System diagnosis
2. Strategic decision framing
3. Shortlist recommendation

### Example flow:

**System diagnosis**
Explain the current sonic tendency of the user's system using component traits.

**Strategic decision**
Frame the key decision the user is making.

Example:
- Stay within the Chord / fast-transient philosophy
- vs Move toward R2R tonal density and weight.

**Shortlist**
Only then present recommended components.

Decision framing should appear when the user is evaluating upgrade directions, but is not required for single-product assessment queries.

**Important:** The "do nothing / keep current component" direction must always be present as a valid outcome. It uses taste-aligned reasoning — if the user's top trait priorities already overlap with their current component's strengths, the frame should say so explicitly.

---

## 2. Enforce Shortlist Size Limit

Shortlists should contain:

- default: 3 components
- maximum: 3 components

Never return 4–5 products. (Reduced from the previous 4–5 target.)

If catalog search produces many candidates, select only the strongest matches based on:
- system interaction
- sonic direction
- price alignment

Each product should map to a decision direction from the frame, serving as supporting evidence rather than an independent recommendation.

---

## 3. Strengthen System Interaction Reasoning

Before recommending a component, the engine should evaluate:

component topology + existing system topology + listener taste profile

### Example checks:

- R2R DAC + warm amp + warm speakers → tonal stacking risk
- fast DAC + neutral amp + neutral speakers → lean presentation risk

These interactions should appear explicitly in the explanation.

**Scoping note:** Coarse system character inference (fast-ss / warm / neutral) is already implemented in `decision-frame.ts` via `inferSystemCharacter()`. The specific per-trait chain stacking checks described above would require analyzing individual component traits across the full system chain — this is a meaningful expansion closer in scope to the deferred ordinal trait refactor. Proposals here should be aware of that constraint and suggest incremental steps rather than assuming the full trait chain is already traversable.

---

## 4. Convert "Best Under X" Queries to Advisory Mode (partially implemented)

This is already handled by the decision framing layer — shopping queries including "best under X" now trigger `buildDecisionFrame()` before the shortlist.

Queries such as:
"best DAC under $2000"

should first frame the decision space.

### Example:

At this price the meaningful choice is between:
- fast FPGA / delta-sigma designs
- R2R tonal density designs

Explain the sonic difference, then present a shortlist.

Refinements should focus on the quality and specificity of the framing prose, not the routing mechanism (which is already in place).

---

## 5. Preserve Deterministic Reasoning

All reasoning must continue to originate from:

product catalog metadata + system component traits + listener preference profile

The LLM layer should only:
- improve readability
- explain decisions
- structure responses

It must never introduce new product facts. This is already enforced by catalog validation in the editorial overlay pipeline.

---

## 6. Advisor Voice

Responses should resemble a knowledgeable dealer or system consultant.

Tone should be: calm, analytical, practical, non-salesy.

Avoid retail-style copy or marketing language.

This is already codified in the system's behavioral spec (`CLAUDE.md`) under the "Private Advisor" identity. Any tone refinements should be consistent with the existing voice specification.
