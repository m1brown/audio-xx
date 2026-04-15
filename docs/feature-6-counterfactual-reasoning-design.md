# Feature 6 — Counterfactual Reasoning: Design Review

**Status:** Pre-implementation design  
**Date:** 2026-04-11  
**Scope:** Core engine — `tradeoff-assessment`, `consultation.ts`, `advisory-response`, `memo-deterministic-renderer`

---

## 1. Current State

### Where the system already implicitly compares options

The system has scattered counterfactual instincts but no unified model.

**`tradeoff-assessment.ts` — `netNegative` flag (line 323)**  
The closest thing to a "do nothing" signal. If sacrifices outweigh gains (rules: sacrifice threatens preserved strength, high magnitude + low confidence, or minor gains with meaningful sacrifice), `netNegative` is set to `true`. In `memo-deterministic-renderer.ts` (line 271), this appends: *"Consider whether this change is necessary — the trade-offs may outweigh the gains."*  
Gap: `netNegative` is a binary flag. It says "don't change" without explaining what staying put delivers. There is no explicit baseline trajectory.

**`decision-frame.ts` — `isDoNothing` direction (lines 260–269)**  
The shopping flow explicitly builds a "Keep your [component]" direction with `isDoNothing: true`. It uses `buildDoNothingCase()` to reason from taste-profile alignment: if current component already aligns with top user traits, it argues for restraint. This is the most structurally explicit counterfactual reasoning in the system.  
Gap: This only exists in the shopping flow. The memo/consultation flow has no equivalent.

**`preference-protection.ts` — `block` verdict (lines 317–328)**  
A `block` verdict suppresses a path from recommendation. In `memo-deterministic-renderer.ts` (lines 281–285), this replaces the rationale with a warning. It is an implicit "don't take this path" counterfactual.  
Gap: Explains the threat but not what the alternative path (or doing nothing) would deliver instead.

**`consultation.ts` — restraint flow (lines 9040–9115)**  
The "should I change anything?" response explicitly articulates "the case for doing nothing" vs "the case for change" in prose. This is the most complete existing counterfactual reasoning. It is well-reasoned but fully unstructured — entirely LLM-assembled from system character and tendencies.  
Gap: Not connected to the structured memo/upgrade path flow. Cannot be tested, enforced, or rendered consistently.

**`consultation.ts` — hypothetical detection (lines 8989–9010)**  
The system detects "what if I replaced my DAC with an R2R?" queries and reasons from archetype knowledge. This is a user-initiated counterfactual.  
Gap: Response is fully prose — no schema, no confidence level, no comparison against the current baseline.

### Where counterfactual reasoning is missing

1. **No baseline trajectory.** The system never formally asks: *if nothing changes, what does this system continue to do?* It produces upgrade paths without anchoring them against the cost of not upgrading.

2. **No path-vs-path comparison.** `buildUpgradePaths()` ranks paths by impact tier, but never asks: *given that path A and path B both address the constraint, what does the listener give up or gain by choosing one over the other?*

3. **No overcorrection risk.** `system-interaction.ts` detects stacking risks (when a direction is already reinforced), but `tradeoff-assessment.ts` never asks: *does this upgrade push a tendency so far that the remedy becomes the problem?*

4. **"Do nothing" is absent from the memo format.** `buildRecommendedSequence()` produces an ordered step list with no "and here is why you might do none of these." The structured memo format has `keepRecommendations` (components to leave alone), but no system-level "hold" recommendation.

---

## 2. Core Model

### Design principle

A counterfactual assessment is not a third opinion. It is a structured anchor for every upgrade path: this path compared to the baseline, and this path compared to the next best path. Without it, recommendations float.

### Minimal schema

```typescript
/**
 * CounterfactualAssessment — Feature 6
 *
 * Attached to each UpgradePath. Anchors the path against:
 *   (a) the baseline — what happens if nothing changes
 *   (b) an alternative path — when one exists
 *   (c) overcorrection risk — when the change may push too far
 *
 * Designed to stay concise. Renders as at most 1–2 sentences in output.
 */
export interface CounterfactualAssessment {
  /**
   * What happens if the listener does nothing.
   * Always populated for every path.
   */
  baseline: {
    /**
     * One sentence: what the system continues to do.
     * Grounded in current axis leanings and stacked traits.
     * Example: "The system continues to lean bright and detailed;
     * the current weakness in tonal density persists."
     */
    trajectory: string;

    /**
     * Sustainability signal — is the current state working?
     *   'stable'       — system is working; change is optional
     *   'acceptable'   — system is functional but has a real limitation
     *   'constrained'  — a genuine bottleneck; staying put has a cost
     */
    sustainabilitySignal: 'stable' | 'acceptable' | 'constrained';
  };

  /**
   * Comparison to the next-best alternative path.
   * Only populated when ≥2 paths exist.
   * Answers: "path A vs path B — when should you choose each?"
   */
  alternativeComparison?: {
    /** Label of the alternative path being compared. */
    alternativeLabel: string;
    /**
     * One sentence: what this path gives you that the alternative doesn't.
     * Written from the perspective of this path.
     */
    advantage: string;
    /**
     * One sentence: what the alternative gives you that this path doesn't.
     * Must be non-empty — no one-sided comparisons.
     */
    alternativeAdvantage: string;
    /**
     * When the alternative path is the better call.
     * One condition, concisely stated.
     */
    preferAlternativeWhen: string;
  };

  /**
   * Overcorrection risk: does this path push a current tendency too far?
   * Derived from stacking risks in system-interaction.ts + tradeoff magnitude.
   */
  overcorrectionRisk: {
    present: boolean;
    /** Only populated when present is true. One sentence. */
    description?: string;
  };

  /**
   * Whether "do nothing" is the recommended outcome for this path.
   * True when: netNegative is true, OR protection.verdict is 'block',
   * OR baseline.sustainabilitySignal is 'stable' AND overcorrectionRisk is present.
   *
   * When true, restraintReason must be populated.
   */
  restraintRecommended: boolean;

  /**
   * One sentence explaining why restraint is recommended.
   * Only populated when restraintRecommended is true.
   */
  restraintReason?: string;

  /**
   * Confidence in this counterfactual assessment.
   * Floors to the tradeoff confidence — never higher.
   */
  confidence: 'high' | 'medium' | 'low';
}
```

---

## 3. Required Logic

### Baseline trajectory

Derived deterministically from available system data:

1. Read the system's `PrimaryAxisLeanings` and identify dominant leanings (any axis not `neutral`).
2. Read `StackedTraitInsight[]` — traits classified as `system_character` define what the system consistently does.
3. Read the `PrimaryConstraint` — if one exists, it defines the cost of doing nothing.

```
IF constraint exists AND sustainabilitySignal is NOT yet set:
  sustainabilitySignal = 'constrained'
ELSE IF component assessments show ≥1 bottleneck AND no constraint:
  sustainabilitySignal = 'acceptable'
ELSE:
  sustainabilitySignal = 'stable'
```

`trajectory` text is constructed from:
- System's dominant stacked traits ("continues to lean X")
- Current component weakness on this path ("the weakness in Y persists")
- Constraint summary if applicable ("the constraint at [component] remains unresolved")

**Rule:** If `sustainabilitySignal` is `stable`, the counterfactual must include that signal in the rationale — it is evidence that restraint may be correct.

### Likely outcome of proposed change

Already computed by `assessTradeoffs()`. The counterfactual borrows:
- `likelyGains` → what changes if this path is taken
- `likelySacrifices` → what the system loses
- `magnitude` → how significant the shift is

No new computation needed. The counterfactual reframes these relative to the baseline.

### Overcorrection risk

Derived from `SystemInteraction.stackingRisks` (already computed in `decision-frame.ts`):

```
FOR each stacking risk in systemAnalysis.stackingRisks:
  IF the proposed path's target axis aligns with the stacked trait's axis:
    AND the stacking severity is 'significant':
      overcorrectionRisk.present = true
      description = "This change reinforces [trait] in a system that already leans that way."
    ELSE IF severity is 'moderate':
      overcorrectionRisk.present = true (with softer language)
```

Also check axis delta: if the upgrade component has a large delta *in the same direction* the system already leans, mark risk as present.

**Guardrail:** Overcorrection risk does not automatically set `restraintRecommended`. It is surfaced as context, not as a verdict. The verdict requires `netNegative` or `protection.block`.

### Alternative path comparison

Only computed when ≥2 upgrade paths are available. For path rank N, the alternative is path rank N+1 (or the highest-impact alternative that targets a different component).

```
IF paths.length >= 2:
  FOR each path[i]:
    compare to path[i+1] (or closest rank):
      advantage: what this path addresses that the alternative doesn't
        — derived from constraint.explanation (highest path) or component weakness
      alternativeAdvantage: what the alternative addresses that this path doesn't
        — derived from the alternative path's likelyGains
      preferAlternativeWhen: condition under which the alternative is better
        — e.g. "if [explicit user desire] is the primary goal"
        — uses desires[] and listenerPriorities[] to frame the condition
```

**Guardrail:** `alternativeAdvantage` must be non-empty. If it cannot be derived from available data, omit `alternativeComparison` entirely rather than produce a one-sided comparison.

### Confidence flooring

Counterfactual confidence floors to `tradeoff.confidence` for the same path. It cannot assert more certainty than the underlying trade-off data. Additional floors:

- If `baseline.sustainabilitySignal` was inferred from axis data only (no constraint, no curated product data): floor to `medium`.
- If `alternativeComparison` compares paths where either path has `tradeoff.confidence === 'low'`: floor `alternativeComparison` confidence to `low` and frame with "tentatively."

---

## 4. Integration Points

### `advisory-response.ts`

Add `counterfactual?: CounterfactualAssessment` to `UpgradePath` (line 285 area, after `protection?`):

```typescript
export interface UpgradePath {
  rank: number;
  label: string;
  impact?: string;
  rationale: string;
  tradeoff?: TradeoffAssessment;
  protection?: PreferenceProtectionResult;
  counterfactual?: CounterfactualAssessment;  // Feature 6
  options: UpgradePathOption[];
}
```

### `counterfactual-assessment.ts` (new file)

New module: `apps/web/src/lib/counterfactual-assessment.ts`

Exports:
- `CounterfactualAssessment` (type)
- `assessCounterfactual(path, allPaths, tradeoff, protection, systemAxes, stacked, constraint, desires, listenerPriorities): CounterfactualAssessment`

Internal functions:
- `buildBaseline(systemAxes, stacked, constraint, componentAssessments)` → `baseline`
- `buildAlternativeComparison(thisPath, alternativePath, desires, listenerPriorities)` → `alternativeComparison | undefined`
- `assessOvercorrectionRisk(path, systemInteraction, systemAxes)` → `overcorrectionRisk`
- `determineRestraint(netNegative, protectionVerdict, baseline, overcorrectionRisk)` → `{ restraintRecommended, restraintReason }`

### `consultation.ts` — `buildUpgradePaths()` (line 8095)

After the existing Feature 3 block (lines 8268–8295), add a Feature 6 block:

```typescript
// ── Attach counterfactual assessments (Feature 6) ──
for (let i = 0; i < paths.length; i++) {
  const p = paths[i];
  if (!p.tradeoff) continue;

  const alternativePath = paths[i + 1];  // next-rank path, or undefined
  p.counterfactual = assessCounterfactual(
    p,
    alternativePath,
    p.tradeoff,
    p.protection,
    axes,
    stacked ?? [],
    constraint,
    desires,
    listenerPriorities ?? [],
  );
}
```

This preserves the existing layer order: tradeoff → protection → counterfactual.

### `tradeoff-assessment.ts`

No changes to `assessTradeoffs()`. The `netNegative` output is read by `assessCounterfactual()` as an input signal. Feature 6 does not replace Feature 2's logic — it builds on top of it.

### `memo-deterministic-renderer.ts` — upgrade path rendering (lines 244–285)

After the existing `netNegative` and `protection.block` handling, add counterfactual rendering:

```typescript
// Counterfactual: baseline + restraint signal (Feature 6)
const cf = p.counterfactual;
if (cf) {
  if (cf.restraintRecommended && cf.restraintReason) {
    // Restraint: prepend to rationale with clear framing
    rationale = `Hold: ${cf.restraintReason} — ${rationale}`;
  } else if (cf.baseline.sustainabilitySignal === 'stable') {
    // Status quo is working: surface as context
    rationale += ` Note: ${cf.baseline.trajectory}`;
  }

  // Alternative comparison: append when present and confident enough
  if (cf.alternativeComparison && cf.confidence !== 'low') {
    const alt = cf.alternativeComparison;
    rationale += ` Versus the ${alt.alternativeLabel}: ${alt.advantage}. ${alt.preferAlternativeWhen ? `Prefer the alternative when: ${alt.preferAlternativeWhen}.` : ''}`;
  } else if (cf.alternativeComparison && cf.confidence === 'low') {
    rationale += ` (Tentatively versus the ${cf.alternativeComparison.alternativeLabel}: ${cf.alternativeComparison.advantage}.)`;
  }

  // Overcorrection risk: surface when present
  if (cf.overcorrectionRisk.present && cf.overcorrectionRisk.description) {
    rationale += ` Overcorrection risk: ${cf.overcorrectionRisk.description}`;
  }
}
```

**Length budget:** Counterfactual content adds at most 2 sentences to any rationale. If all three signals (restraint + alternative + overcorrection) would fire simultaneously, priority order is: restraint > alternative > overcorrection.

---

## 5. Guardrails

### "Do nothing" is a real alternative

`restraintRecommended: true` must produce visible, affirmative output — not silence. The renderer must actively frame holding as a choice, not an absence of recommendation. Language template: *"Hold: [reason]. If this changes — [condition for action] — then revisit."*

When `sustainabilitySignal` is `stable` but `restraintRecommended` is false: surface the baseline as context only. Do not suppress it. The user deserves to know the system is working.

### Output concision

Counterfactual content is bounded to 2 sentences per path. This is enforced by:
- `baseline.trajectory`: 1 sentence max, derived deterministically
- `alternativeComparison.advantage` + `preferAlternativeWhen`: 1 sentence each, enforced at derivation
- Priority ordering when multiple signals fire: restraint > alternative > overcorrection

The renderer must never emit all three signals for a single path. The most important signal wins.

### Low-confidence framing

When `counterfactual.confidence === 'low'`:
- `baseline.trajectory` must not use "will" — use "may continue to" or "likely continues to"
- `alternativeComparison` is framed as "tentatively" in renderer (see above)
- `restraintReason` must include a qualifier: "with the current data available"

This mirrors the confidence-language pattern already established in `memo-deterministic-renderer.ts` (lines 249–254).

### Avoiding fake precision

**No numeric comparisons.** The counterfactual does not say "path A improves tonal density by 30% more than path B." Axis deltas are ordinal (warm/bright/neutral), not cardinal.

**No invented alternatives.** If `alternativeComparison` cannot be grounded in actual path data (gains, desires, listenerPriorities), the field is omitted — not populated with generic language.

**No overcorrection without evidence.** `overcorrectionRisk.present` requires a positive signal from `SystemInteraction.stackingRisks` or axis delta reinforcement. It does not fire from absence of evidence.

---

## 6. Worked Examples

### Example A — Restraint recommended (netNegative path)

**System:** Linn LP12 → Chord Qutest (FPGA DAC) → JOB 225 (solid-state amp) → Harbeth P3ESR  
**System character:** Stacked bright+detailed across Qutest + JOB 225; system leans analytically precise.  
**Proposed path:** DAC upgrade to Chord Hugo TT2 (higher-tier FPGA)  
**Tradeoff:** `netNegative: true` — likelyGains (greater timing resolution, larger soundstage) vs likelySacrifices (adds more brightness into an already bright chain), `magnitude: high`, `confidence: medium`  
**Protection:** `verdict: caution` (system doesn't have an explicit warmth preference on file)

Counterfactual output:
```
baseline:
  trajectory: "The system continues to lean bright and analytically precise;
               the stacked FPGA + solid-state character is intact and working."
  sustainabilitySignal: 'stable'

alternativeComparison: undefined (no second path shown here)

overcorrectionRisk:
  present: true
  description: "This upgrade reinforces brightness in a chain that already leans that
                way — the Qutest and JOB 225 both push in this direction."

restraintRecommended: true
restraintReason: "Adding a higher-tier FPGA DAC doubles down on the system's existing
                 analytical tendency. The current sound is likely working for you;
                 the trade-off does not point to a gap, only to more of the same."
```

**Rendered rationale (abbreviated):**  
*"Hold: Adding a higher-tier FPGA DAC doubles down on the system's existing analytical tendency — the trade-offs do not point to a gap. Overcorrection risk: this upgrade reinforces brightness in a chain that already leans that way."*

---

### Example B — Path A vs Path B comparison

**System:** Rega P3 → Cambridge Audio 851N (delta-sigma DAC/streamer) → Arcam SA30 → Monitor Audio Silver 200  
**Constraint:** `smooth_detailed` axis — system leans smooth; `primary_constraint: Cambridge Audio 851N` (lacks microdetail relative to system's potential)  
**Path 1:** DAC upgrade → Chord Qutest or Denafrips Ares II  
**Path 2:** Amplifier upgrade → Hegel H190 or Naim Nait XS 3  
**User desire:** "more transparency and detail"

Counterfactual for Path 1 (DAC):
```
baseline:
  trajectory: "The system leans smooth; the 851N's limited microdetail
               continues to suppress resolution across the chain."
  sustainabilitySignal: 'constrained'

alternativeComparison:
  alternativeLabel: "Amplifier Upgrade"
  advantage: "A DAC change addresses the detail constraint directly — the 851N is
              where resolution is being lost in the signal path."
  alternativeAdvantage: "An amplifier upgrade improves drive and dynamic authority;
                         if the Monitor Audios feel dynamically limited, that matters more."
  preferAlternativeWhen: "if the system feels dynamically constricted rather than
                          texturally flat — the distinction is what you hear most."

overcorrectionRisk:
  present: false

restraintRecommended: false
```

**Rendered rationale (abbreviated):**  
*"A DAC change addresses the detail constraint directly — the 851N is where resolution is being lost. Versus the Amplifier Upgrade: prefer the amplifier when the system feels dynamically constricted rather than texturally flat — the distinction is what you hear most."*

---

## Summary

| Component | Change |
|---|---|
| `advisory-response.ts` | Add `counterfactual?: CounterfactualAssessment` to `UpgradePath` |
| `counterfactual-assessment.ts` | New module — `assessCounterfactual()` and supporting functions |
| `consultation.ts` `buildUpgradePaths()` | Add Feature 6 block after Feature 3 (lines 8268–8295) |
| `memo-deterministic-renderer.ts` | Add counterfactual rendering block after `protection.block` handling |
| `tradeoff-assessment.ts` | No changes — `netNegative` is input, not output, of Feature 6 |
| `preference-protection.ts` | No changes — `verdict` is input to Feature 6's `determineRestraint()` |

**New dependencies in `assessCounterfactual()`:**  
`SystemInteraction` (from `system-interaction.ts`, already in scope via `decision-frame.ts`), `StackedTraitInsight[]`, `PrimaryConstraint`, `DesireSignal[]`, `ListenerPriority[]`.

All existing Feature 2 and Feature 3 logic is preserved. Feature 6 reads their outputs and adds a layer above them — it does not replace or modify them.
