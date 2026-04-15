# Feature 6 — Counterfactual Reasoning: Design v1

**Status:** Pre-implementation design (tightened from draft)  
**Date:** 2026-04-11  
**Supersedes:** `feature-6-counterfactual-reasoning-design.md` (draft)  
**Scope:** `counterfactual-assessment.ts` (new), `consultation.ts`, `advisory-response.ts`, `memo-deterministic-renderer.ts`

---

## What changed from the draft

The draft included `alternativeComparison` (path A vs path B). That is cut from v1. It requires reliable cross-path awareness at render time, introduces coordination complexity, and is not needed for the core value of counterfactual reasoning. A future v2 can add it once the baseline layer is stable.

v1 answers exactly three questions per upgrade path:
1. What does the system continue to do if nothing changes?
2. Does this upgrade push an existing tendency too far?
3. Should the listener hold rather than act?

---

## Revised Schema

```typescript
/**
 * CounterfactualAssessment — Feature 6 v1
 *
 * Attached to each UpgradePath. Three concerns only:
 *   (a) baseline — what happens if nothing changes
 *   (b) overcorrection risk — does this path reinforce an existing tendency too far?
 *   (c) restraint — is holding the right call?
 *
 * Renders as at most one sentence in output.
 * Confidence floors to tradeoff.confidence — never exceeds it.
 */
export interface CounterfactualAssessment {
  baseline: {
    /**
     * One sentence. What the system continues to do if this path is not taken.
     * Grounded in stacked traits and constraint state. No speculation.
     * Example: "The system continues to lean bright and detailed;
     *           the tonal density limitation at the DAC persists."
     */
    trajectory: string;

    /**
     * Is the status quo working?
     *   'stable'      — system is functioning; change is optional
     *   'acceptable'  — functional but a real limitation is present
     *   'constrained' — a bottleneck exists; staying put has a real cost
     */
    sustainabilitySignal: 'stable' | 'acceptable' | 'constrained';
  };

  /**
   * Overcorrection risk.
   * Only present when: (1) a stacking risk already exists in the system,
   * AND (2) the proposed path clearly reinforces the same trait/axis.
   * Does NOT fire from weak axis alignment alone.
   */
  overcorrectionRisk: {
    present: boolean;
    /** Populated only when present is true. One sentence. */
    description?: string;
  };

  /**
   * Whether holding is the recommended outcome for this path.
   *
   * True when ANY of:
   *   - tradeoff.netNegative is true
   *   - protection.verdict is 'block'
   *   - baseline.sustainabilitySignal is 'stable' AND overcorrectionRisk.present is true
   *
   * When true, restraintReason must be populated.
   */
  restraintRecommended: boolean;

  /**
   * One sentence, affirmative framing.
   * Lead with "Holding is the right call here because..." not cautionary hedging.
   * Only populated when restraintRecommended is true.
   */
  restraintReason?: string;

  /**
   * Confidence in this counterfactual assessment.
   * Floors to tradeoff.confidence for the same path. Never higher.
   * Additional floor: if baseline derived from axis data only (no constraint,
   * no curated product), cap at 'medium'.
   */
  confidence: 'high' | 'medium' | 'low';
}
```

---
## Logic Outline

### `buildBaseline(systemAxes, stacked, constraint, assessments)`

**`trajectory` text** — constructed in priority order:

1. If `PrimaryConstraint` exists: *"The [constraint.componentName] continues to [constraint.explanation shortened]. Staying put preserves the current limitation."*
2. Else if `StackedTraitInsight[]` has `classification === 'system_character'` entries: *"The system continues to lean [trait labels]; this character is stable."*
3. Else from dominant `PrimaryAxisLeanings`: *"The system continues to lean [dominant axis labels]."*
4. Final fallback: *"The current system balance is maintained."*

**`sustainabilitySignal`** — determined in priority order:

| Condition | Signal |
|---|---|
| `PrimaryConstraint` present | `'constrained'` |
| ≥1 component assessment has verdict `bottleneck` but no formal constraint | `'acceptable'` |
| No constraint, no bottleneck | `'stable'` |

---

### `assessOvercorrectionRisk(path, systemInteraction, systemAxes)`

**Two conditions must both be true** to set `present: true`:

1. `systemInteraction.stackingRisks` contains at least one entry with `severity === 'significant'` (already computed by `analyzeSystemInteraction()`)
2. The proposed path's target axis (derived from `tradeoff.likelyGains` keywords or path `rationale`) clearly reinforces the same trait as the stacking risk

If only one condition is met, `present: false`. No overcorrection warning from weak axis overlap alone.

**`description`** template when `present`:  
*"This change reinforces [stacked trait label] in a system that already leans that way."*

If `systemInteraction` is unavailable (system not in catalog): `present: false`. Do not speculate.

---

### `determineRestraint(netNegative, protectionVerdict, baseline, overcorrectionRisk)`

```
restraintRecommended = false
restraintReason = undefined

IF netNegative is true:
  restraintRecommended = true
  restraintReason = "Holding is the right call here because the trade-offs outweigh
                    the likely gains for this system."

ELSE IF protectionVerdict is 'block':
  restraintRecommended = true
  restraintReason = "Holding is the right call here because this change threatens
                    a stated listening priority."

ELSE IF baseline.sustainabilitySignal is 'stable' AND overcorrectionRisk.present is true:
  restraintRecommended = true
  restraintReason = "Holding is the right call here because the system is working
                    and this change would reinforce a tendency that is already present."
```

Priority order matters — the first true condition wins. Do not compound reasons.

---

### Confidence flooring

```
confidence = tradeoff.confidence   // floor inherited from Feature 2

IF baseline was derived from axis data only (no constraint, no stacked traits):
  confidence = min(confidence, 'medium')

IF tradeoff.source is 'delta_inference':
  confidence = min(confidence, 'medium')
```

`min()` uses the same rank ordering established in `tradeoff-assessment.ts`:  
`high (3) > medium (2) > low (1)`.

---

## Implementation Plan

### New file: `counterfactual-assessment.ts`

`apps/web/src/lib/counterfactual-assessment.ts`

Exports:
- `CounterfactualAssessment` (type)
- `assessCounterfactual(params): CounterfactualAssessment`

```typescript
// Signature
export function assessCounterfactual(params: {
  tradeoff: TradeoffAssessment;
  protection: PreferenceProtectionResult | undefined;
  systemAxes: PrimaryAxisLeanings;
  stacked: StackedTraitInsight[];
  constraint: PrimaryConstraint | undefined;
  componentAssessments: ComponentAssessment[];
  systemInteraction: SystemInteraction | undefined;
}): CounterfactualAssessment
```

Internal functions (not exported):
- `buildBaseline(systemAxes, stacked, constraint, componentAssessments)`
- `assessOvercorrectionRisk(tradeoff, systemInteraction)`
- `determineRestraint(netNegative, protectionVerdict, baseline, overcorrectionRisk)`
- `floorConfidence(tradeoff, baseline)`

No LLM involvement. All deterministic.

---

### `advisory-response.ts`

Add `counterfactual?: CounterfactualAssessment` to `UpgradePath` after `protection?`:

```typescript
export interface UpgradePath {
  // ... existing fields ...
  tradeoff?: TradeoffAssessment;           // Feature 2
  protection?: PreferenceProtectionResult; // Feature 3
  counterfactual?: CounterfactualAssessment; // Feature 6
  options: UpgradePathOption[];
}
```

---

### `consultation.ts` — `buildUpgradePaths()` (after line 8294)

Add Feature 6 as a third pass, after Feature 2 (tradeoffs) and Feature 3 (protection):

```typescript
// ── Attach counterfactual assessments (Feature 6) ──
for (const p of paths) {
  if (!p.tradeoff) continue;

  p.counterfactual = assessCounterfactual({
    tradeoff: p.tradeoff,
    protection: p.protection,
    systemAxes: axes,
    stacked: stacked ?? [],
    constraint,
    componentAssessments: assessments,
    systemInteraction: systemInteractionResult, // derived from analyzeSystemInteraction()
  });
}
```

`systemInteractionResult` is already computed upstream (used in `decision-frame.ts`). It should be passed into `buildUpgradePaths()` as an optional parameter rather than recomputed.

---

### `memo-deterministic-renderer.ts` — upgrade path rendering

After the existing `protection.block` / `protection.caution` block (lines 281–285), add:

```typescript
// Counterfactual framing (Feature 6)
const cf = p.counterfactual;
if (cf) {
  if (cf.restraintRecommended && cf.restraintReason) {
    // Restraint takes priority — leads the rationale
    rationale = cf.restraintReason + ' ' + rationale;
  } else if (cf.baseline.sustainabilitySignal === 'stable') {
    // Status quo is working — append as context
    rationale += ' ' + cf.baseline.trajectory;
  } else if (cf.overcorrectionRisk.present && cf.overcorrectionRisk.description) {
    // Overcorrection warning — append when restraint didn't fire
    rationale += ' ' + cf.overcorrectionRisk.description;
  }
  // Only one signal renders per path. Priority: restraint > stable > overcorrection.
}
```

**Confidence-aware language:** if `cf.confidence === 'low'`, wrap the appended clause with "Tentatively: ..." prefix.

---

## Test Plan

### Unit tests — `counterfactual-assessment.test.ts`

**`buildBaseline`**

| Scenario | Expected `sustainabilitySignal` | Expected `trajectory` contains |
|---|---|---|
| `PrimaryConstraint` present | `'constrained'` | constraint component name |
| No constraint, bottleneck verdict in assessments | `'acceptable'` | bottleneck component name |
| No constraint, no bottleneck | `'stable'` | dominant axis label or stacked trait |
| No constraint, no stacked traits, axes all neutral | `'stable'` | fallback text |

**`assessOvercorrectionRisk`**

| Scenario | Expected `present` |
|---|---|
| No stacking risks in systemInteraction | `false` |
| Stacking risk present, path reinforces different axis | `false` |
| Stacking risk present (severity 'moderate'), path reinforces same axis | `false` — moderate only, not significant |
| Stacking risk present (severity 'significant'), path reinforces same axis | `true` |
| `systemInteraction` is undefined | `false` |

**`determineRestraint`**

| Scenario | Expected `restraintRecommended` | Expected reason prefix |
|---|---|---|
| `netNegative: true` | `true` | "Holding is the right call here because the trade-offs..." |
| `protection.verdict: 'block'` | `true` | "Holding is the right call here because this change threatens..." |
| `stable` + overcorrection present | `true` | "Holding is the right call here because the system is working..." |
| `stable` + no overcorrection | `false` | — |
| `constrained` + overcorrection present | `false` (constraint wins; change is warranted) | — |
| `netNegative: true` AND `block` (both true) | `true`, first rule wins — trade-off reason only | — |

**`floorConfidence`**

| Scenario | Expected `confidence` |
|---|---|
| Tradeoff `high`, baseline from constraint | `'high'` |
| Tradeoff `high`, baseline axis-data only | `'medium'` |
| Tradeoff `medium`, source `delta_inference` | `'medium'` |
| Tradeoff `low`, any baseline | `'low'` |

---

### Integration smoke tests — `buildUpgradePaths`

These are not full unit tests — just the minimum to catch regressions:

1. **No system context:** `assessCounterfactual()` not called when `systemInteraction` is undefined — paths have `counterfactual: undefined`. No crash.
2. **Single path, constraint present:** `counterfactual.baseline.sustainabilitySignal === 'constrained'`, `restraintRecommended === false` (constraint means change is warranted).
3. **Single path, netNegative:** `restraintRecommended === true`, `restraintReason` populated.
4. **Two paths, both netNegative false:** Both paths have `restraintRecommended === false`. No contamination between paths.

---

### Renderer smoke tests — `memo-deterministic-renderer`

1. `restraintRecommended: true` → rationale leads with `restraintReason`. Does not also append baseline or overcorrection text.
2. `sustainabilitySignal: 'stable'`, no restraint → rationale ends with `baseline.trajectory`. Overcorrection not appended.
3. `overcorrectionRisk.present: true`, `sustainabilitySignal: 'constrained'`, no restraint → overcorrection appended. (Stable signal not present — it is constrained.)
4. `confidence: 'low'` → whichever signal renders is prefixed with "Tentatively:".
5. No `counterfactual` field → rationale unchanged. No null-reference error.

---

## Worked Examples

### Example A — Restraint recommended (`netNegative`)

**System:** Linn LP12 → Chord Qutest → JOB 225 → Harbeth P3ESR  
**System character:** Stacked bright+detailed; `systemInteraction.stackingRisks` includes `{ trait: 'clarity', severity: 'significant' }`  
**Proposed path:** DAC upgrade to Chord Hugo TT2 (higher-tier FPGA)  
**Tradeoff:** `netNegative: true`, `magnitude: high`, `confidence: medium`  
**Protection:** `verdict: caution`

```
CounterfactualAssessment {
  baseline: {
    trajectory: "The system continues to lean bright and detailed; this character
                 is stable across the current chain.",
    sustainabilitySignal: 'stable'
  },
  overcorrectionRisk: {
    present: true,
    description: "This change reinforces clarity in a system that already
                  leans strongly that way."
  },
  restraintRecommended: true,
  restraintReason: "Holding is the right call here because the trade-offs
                    outweigh the likely gains for this system.",
  confidence: 'medium'
}
```

**Rendered rationale:**  
*"Holding is the right call here because the trade-offs outweigh the likely gains for this system. [existing tradeoff rationale follows...]"*

Only restraint clause renders. Overcorrection and baseline suppressed.

---

### Example B — Constrained system, change warranted

**System:** Rega P3 → Cambridge Audio 851N → Arcam SA30 → Monitor Audio Silver 200  
**Constraint:** `PrimaryConstraint` on Cambridge Audio 851N (smooth axis, limits microdetail)  
**Stacking risks:** None significant  
**User desire:** "more transparency"  
**Tradeoff:** `netNegative: false`, gains: ["improved microdetail", "better transient resolution"], `confidence: high`  
**Protection:** `verdict: safe`

```
CounterfactualAssessment {
  baseline: {
    trajectory: "The 851N continues to limit microdetail across the chain;
                 the constraint at the source remains unresolved.",
    sustainabilitySignal: 'constrained'
  },
  overcorrectionRisk: {
    present: false
  },
  restraintRecommended: false,
  restraintReason: undefined,
  confidence: 'high'
}
```

**Rendered rationale:**  
*"[existing tradeoff rationale — gains and sacrifices — unchanged]"*

`sustainabilitySignal` is `'constrained'`, not `'stable'`, so baseline trajectory clause does not render. No overcorrection. No restraint. Counterfactual assessment computed but contributes nothing to output — correctly invisible for a warranted change.

---

## Summary

| File | Change |
|---|---|
| `counterfactual-assessment.ts` | New module — `assessCounterfactual()` and 4 internal helpers |
| `advisory-response.ts` | Add `counterfactual?: CounterfactualAssessment` to `UpgradePath` |
| `consultation.ts` | Third pass in `buildUpgradePaths()` after Feature 3 block; pass `systemInteraction` as optional param |
| `memo-deterministic-renderer.ts` | Add counterfactual rendering block; one signal per path; confidence-aware prefix |

**Explicitly deferred to v2:**
- `alternativeComparison` (path A vs path B)
- Cross-path restraint reasoning ("if you're only doing one, do this instead")
- Counterfactual reasoning in the shopping / `decision-frame` flow (it already has `isDoNothing`; leave it alone)

**No changes to:** `tradeoff-assessment.ts`, `preference-protection.ts`, `system-interaction.ts`.  
Feature 6 reads their outputs. It does not modify them.
