# Labeled-System Detection — Focused Chrome Retest Report

**Date:** 2026-04-13
**Environment:** localhost:3000 (development server, Next.js App Router)
**Method:** Manual browser testing via Chrome MCP, 5 natural system-input prompts
**Saved system present:** "Livingroom" — Chord Hugo (DAC), Job Integrated (amp), WLM Diva Monitor (speaker)
**Code changes under test:** Task 6 labeled-system detection fix (ROLE_LABEL_RE in intent.ts + STRONG_OWNERSHIP_RE expansion in system-extraction.ts)

---

## Results Summary

| # | Prompt | Expected Route | Actual Route | Verdict |
|---|--------|---------------|-------------|---------|
| 1 | "how's this system: speakers: wlm diva monitors - amplifier: job integrated - streamer: eversolo dmp-a6" | system_assessment | **system_assessment** | **PASS** |
| 2 | "here's my system: dac: chord qutest - amp: hegel h190 - speakers: devore orangutan o/96" | system_assessment | **gear_inquiry** → diagnosis | **FAIL** |
| 3 | "current system: source: bluesound node x - amp: primaluna evo 300 - speakers: harbeth p3esr" | system_assessment | **gear_inquiry** → comparison | **FAIL** |
| 4 | "speakers: harbeth super hl5+ - amp: leben cs300 - dac: pontus ii. evaluate this setup" | system_assessment | **system_assessment** | **PASS** |
| 5 | "wlm diva monitors, job integrated, eversolo dmp-a6 — what do you think of this system?" | system_assessment | **product_assessment** | **FAIL** |

**Score: 2 of 5 pass.**

---

## Detailed Results

### Prompt 1 — Labeled roles + assessment language ✅

**Input:** "how's this system: speakers: wlm diva monitors - amplifier: job integrated - streamer: eversolo dmp-a6"
**Console:** `intent=system_assessment routedMode=consultation` | 5 subjects detected
**Response:** Asks clarification about Eversolo role (catalog = streamer, user labeled as amplifier). Proposed system detected. "Review & save" offered.
**Parsing note:** "streamer" role label also extracted as a 4th subject entity.
**Verdict:** PASS — This is the exact Case B from the fix spec. Routes correctly.

---

### Prompt 2 — Labeled roles + ownership, NO assessment language ❌

**Input:** "here's my system: dac: chord qutest - amp: hegel h190 - speakers: devore orangutan o/96"
**Console:** `intent=gear_inquiry routedMode=diagnosis`
**Response:** "Let's figure out what's going on with your amplifier." Asks about distortion/heat/dynamics. Misroutes entirely.
**Parsing note:** Proposed system shows duplicates: "Chord Hegel h190, DeVore Orangutan, Chord Qutest, DeVore O/96"
**Root cause:** All three `system_assessment` gates require `hasAssessmentLanguage` or `hasArrowChain`. This prompt has `hasOwnership` + `hasLabeledRoleChain` but no assessment language. No gate covers `ownership + chainSeparator + 2+ subjects`.

---

### Prompt 3 — Labeled roles + ownership, NO assessment language ❌

**Input:** "current system: source: bluesound node x - amp: primaluna evo 300 - speakers: harbeth p3esr"
**Console:** `intent=gear_inquiry routedMode=inquiry`
**Response:** Gear Comparison (Harbeth vs PrimaLuna). Bluesound Node X dropped entirely.
**Root cause:** Same as Prompt 2 — ownership + labeled-role chain but no assessment language. Falls through all system_assessment gates.

---

### Prompt 4 — Labels-first + trailing assessment language ✅

**Input:** "speakers: harbeth super hl5+ - amp: leben cs300 - dac: pontus ii. evaluate this setup"
**Console:** `intent=system_assessment routedMode=consultation`
**Response:** Asks clarification about Leben CS300 role (catalog = amplifier, system says user labeled as DAC — incorrect, user labeled it as amp).
**Parsing note:** Role-to-component assignment is reversed. The system associates "dac:" with Leben rather than Pontus. Labels are parsed positionally (each label grabs the next product) but the extraction logic doesn't respect the label-value boundary when products span the hyphen separators.
**Verdict:** PASS for routing. Role assignment parsing is a separate bug.

---

### Prompt 5 — Comma-separated, NO labels, assessment language ❌

**Input:** "wlm diva monitors, job integrated, eversolo dmp-a6 — what do you think of this system?"
**Console:** `intent=product_assessment routedMode=consultation`
**Response:** Single-product assessment for Eversolo DMP-A6 only. WLM and Job ignored. "No system context available."
**Root cause:** Two independent failures:
1. No role labels → `hasLabeledRoleChain` = false
2. No arrows/plus → `hasArrowChain`/`hasPlusChain` = false
3. "this system" without colon → doesn't match OWNERSHIP_PATTERNS (which requires "my system"/"current system" or colon format)
4. "what do you think" is assessment language, but without chain separator OR ownership, Gate 1 and Gate 2 both fail
5. `product_assessment` priority gate intercepts before system logic

---

## Root Cause Analysis

The Task 6 fix correctly added `ROLE_LABEL_RE` to `hasChainSeparator`. This works when **combined with assessment language** (Prompts 1, 4). But the three `system_assessment` gates in `detectIntent()` (lines 990–999) are:

```
Gate 1: hasAssessmentLanguage && hasOwnership && subjects >= 2
Gate 2: hasAssessmentLanguage && hasChainSeparator && subjects >= 2
Gate 3: hasArrowChain && subjects >= 3
```

**Missing gate:** `hasOwnership && hasChainSeparator && subjects >= 2`

When a user says "here's my system:" or "current system:" with labeled roles, the **act of presenting a multi-component system IS the assessment request**. Users who list their system with role labels are implicitly asking for evaluation. The absence of explicit assessment language like "evaluate" or "how's this" shouldn't disqualify them.

---

## Secondary Issues Found

| Issue | Prompts | Severity |
|---|---|---|
| **Role-to-component misassignment** — Labels parsed positionally rather than by label-value pairs | P1, P4 | MEDIUM |
| **Role label extracted as subject** — "streamer" picked up as both role label and entity | P1 | LOW |
| **Duplicate entity extraction** — "DeVore Orangutan" and "DeVore O/96" as separate subjects | P2 | LOW |
| **Component dropping** — 3rd product dropped in comparison fallback (Bluesound in P3) | P3 | Known pre-existing |
| **"this system" without colon not ownership** — Natural phrasing "what do you think of this system?" doesn't match ownership patterns | P5 | MEDIUM |
| **Comma-separated components not chain** — "X, Y, Z" with 3 subjects not recognized as chain | P5 | MEDIUM |

---

## Recommended Fix — Task 6b

**Add a 4th system_assessment gate:**

```typescript
// Gate 4: Ownership + chain separator + 2+ subjects implies system presentation.
// "here's my system: dac: X - amp: Y - speakers: Z" — the act of presenting
// a multi-component system is itself an assessment request.
if (hasOwnership && hasChainSeparator && subjectMatches.length >= 2) {
  return { intent: 'system_assessment', subjects, subjectMatches, desires };
}
```

Insert after the existing Gate 2 (line 996) and before the arrow-chain-only gate (line 998).

**Also required:** Add "current system" (without "my") to `OWNERSHIP_PATTERNS` in intent.ts:

```typescript
/\bcurrent\s+(?:system|setup|rig|chain)\b/i,
```

This pattern already exists in `STRONG_OWNERSHIP_RE` (system-extraction.ts) but is missing from the intent-level ownership check.

**Risk:** Low. `hasOwnership` already gates system_assessment in Gate 1. Adding `hasChainSeparator` as an alternative to `hasAssessmentLanguage` is a natural extension. The early `product_assessment` guard already excludes single-product queries. Adding "current system" to ownership is a natural extension — it's already recognized in system-extraction.

**Coverage improvement:** Gate 4 + "current system" ownership fixes Prompts 2 and 3. Prompt 5 would need separate work (comma-as-chain or "this system" without colon as ownership).

---

## Verdict

**The Task 6 fix is correct but insufficient.** It solves the specific Case B ("how's this system: labels...") by adding labeled-role detection to `hasChainSeparator`. However, the broader class of **system-presentation-without-assessment-language** remains unrouted. 2 of 5 natural prompts pass.

**For launch readiness:** The fix resolves the originally reported Case B and works for any prompt combining labeled roles with assessment language. The missing gate (ownership + chain + subjects) is a natural follow-up that would cover the two most common natural phrasings ("here's my system:" and "current system:"). Recommend implementing Task 6b before external review.
