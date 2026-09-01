# Launch QA — Root Cause Analysis

**Date:** 2026-07-02 · **Branch:** `launch-qa-responses` · **Inputs:** REPORT.md, transcript.md, scores.json (no re-run) · **Scope:** all 39 🔴 Must Fix responses, grouped by shared root cause. No fixes implemented.

---

## Executive Summary

- **Total benchmark failures:** 39 of 60 (65%)
- **Distinct architectural problems:** 6 major + 2 minor defects explain all 39. No failure required a unique explanation.
- **Top three root causes by impact:**
  1. **Diagnosis-default routing** — 12 failures (31%)
  2. **Question-type blindness** — 8 failures (21%)
  3. **Ungoverned anchor selection** — 3 failures but the highest per-incident trust damage ($20K pick for a budget shopper; SET recommended for Magnepans)

The failures are not 39 bugs. They are a small number of boundary decisions made confidently and wrongly, then executed faithfully by engines that are themselves mostly sound.

---

## Root Cause Table

### RC1 — Diagnosis-default routing (the black hole)
| | |
|---|---|
| **Description** | `detectIntent` is a precision-tuned pattern cascade whose fallthrough is `diagnosis`. Any message matching no pattern — beginner questions, philosophy questions, vague natural asks — is treated as a broken-system complaint and answered with symptom triage. The repo's own ROADMAP doctrine already names this wrong: *"If deterministic resolution is incomplete, the correct architectural state is **not diagnosis** — it is unresolved intent."* The code predates the doctrine. |
| **Failures explained** | 12 — PH-01, PH-02, BG-01, BG-03, BG-04, NT-02, NT-03, NT-04, NT-06, NT-10, NT-12, EC-06 |
| **Real-user impact** | Highest of any cause. Beginner/philosophy/vague queries plausibly represent 20–30% of first-visitor messages; every one of them currently gets "does it sound thin, digital, fatiguing…?" |
| **Smallest launch fix** | Replace the diagnosis fallthrough with an unresolved-intent state routed to the existing knowledge lane (or a neutral answer-first clarification). Diagnosis fires only on symptom vocabulary. |
| **Effort** | Hours. The knowledge lane already exists. |
| **Launch priority** | **P0** |

### RC2 — Question-type blindness (advice eaten by the comparison template)
| | |
|---|---|
| **Description** | Once ≥2 subjects are detected, routing keys entirely on the subjects and discards the question. "Should I upgrade my DAC or amplifier?" (UP-01) becomes a KEF-vs-Marantz brand essay; "what's the weakest link?" (UP-02) becomes Eversolo-vs-WLM; "can my Nait 50 drive LS3/5a?" (SM-01) becomes a Falcon-vs-Naim philosophy piece that contains the 83dB fact but never uses it to answer. The user's question type (allocation, capability, diagnosis) has no representation in the routing decision. |
| **Failures explained** | 8 — UP-01, UP-02, UP-03, UP-04, SM-01, SM-02, TS-01, TS-03 |
| **Real-user impact** | Very high — "should I upgrade X or Y" and "is my amp enough" are core audiophile questions, and system owners (the target user) always name components. |
| **Smallest launch fix** | An advice/capability guard evaluated before the comparison gate: advice patterns (*upgrade / weakest link / where should I spend / keep / can X drive Y / enough power*) + ≥2 owned components → system assessment in advice framing, never brand-vs-brand. |
| **Effort** | ~1 day with tests. |
| **Launch priority** | **P0** |

### RC3 — Ungoverned anchor selection (prestige-tier price blindness)
| | |
|---|---|
| **Description** | `buildRecommendationSet` anchors purely on trait fit. The warm/tube region of the catalog is dominated by boutique entries, so "whats a good tube amp that wont blow up my budget" anchors on the **$20,000 Shindo Cortese** (NT-09). Colloquial budget language isn't parsed as a budget signal. Worse, shopping ignores speaker context: NT-11 recommends the same SET for 86dB Magnepans — technically dangerous, not just expensive. |
| **Failures explained** | 3 — SM-04, NT-09, NT-11 (also degrades 🟡 PD-06/PD-07 anchoring) |
| **Real-user impact** | Moderate frequency, **maximum severity per incident** — a $20K default pick reads as either a joke or a dealer shill; one screenshot of it on a forum defines the product. |
| **Smallest launch fix** | No stated budget → cap the anchor at the mainstream tier and ask the budget question in the same response; parse "won't blow up my budget"-class phrases as budget signals; block low-watt topologies when a known low-sensitivity speaker is in context. |
| **Effort** | ~1 day. |
| **Launch priority** | **P0** (severity) |

### RC4 — Subject resolution invents specificity
| | |
|---|---|
| **Description** | Generic category words resolve to specific catalog products. "Why do tube amps sound different from solid state?" (PH-05) and "system sounds lifeless, not sure if it's the amp" (NT-01) both returned the **WiiM Amp** product sheet — a substring match on "amp" treated as a confident product identification. UP-01's Marantz PM8006 resolving to the vintage 2220B is the same defect at model granularity. |
| **Failures explained** | 2 wholly (PH-05, NT-01); contributes to UP-01, EC-06 |
| **Real-user impact** | Moderate frequency, catastrophic per incident — answering about a product the user never mentioned is the fastest possible trust kill. |
| **Smallest launch fix** | Match-quality gate: consultation may build a product sheet only from a brand+model (or exact multi-token) match, never from a bare category word. |
| **Effort** | ~half day. |
| **Launch priority** | **P1** |

### RC5 — Comparison completeness not enforced
| | |
|---|---|
| **Description** | When one side of a two-product comparison fails to resolve (Yggdrasil, Eversolo A8, the user's own Qutest), the builder silently answers the side it knows. PD-02 is a Holo essay with Schiit never mentioned; PD-04 is two empty sentences; NT-05 ignores both the second DAC and the user's actual dilemma. |
| **Failures explained** | 3 — PD-02, PD-04, NT-05 (also degrades 🟡 UP-06) |
| **Real-user impact** | High among purchase researchers — versus queries are the highest-intent traffic a review product gets. |
| **Smallest launch fix** | If requested subjects ≥2 but resolved <2, open with explicit honesty ("I have calibrated data on the May; I don't on the Yggdrasil") and answer within that frame. The honesty is on-brand; the silence is not. |
| **Effort** | ~half day. |
| **Launch priority** | **P1** |

### RC6 — No single source of truth for system identity (self-contradicting assessments)
| | |
|---|---|
| **Description** | introSummary, System read, keyObservation, and Decision are generated by independent template selectors reading different findings fields. SA-04 says "no strong lean," then "warmth and body dominate," then "you prefer neutrality" — three selectors, three sources, no reconciliation. KEEP and CHANGE co-occur for the same component; "detail emphasis emphasis" is a literal duplication bug. |
| **Failures explained** | 2 — SA-04, SA-09 (also the main defect in 🟡 SA-01, SA-02, EC-03) |
| **Real-user impact** | Affects nearly every assessment a careful reader sees — the contradiction doesn't make one answer wrong, it makes all answers suspect. |
| **Smallest launch fix** | Compute one canonical system-lean object; every section renders from it; suppress CHANGE when the decision is keep-at-equilibrium. (Note: the A3 Character/Case overlays already mask this on prose surfaces when active — the deterministic memo is what needs the gate.) |
| **Effort** | 1–2 days. |
| **Launch priority** | **P1** |

### RC7 — Constraint heuristic ignores design intent and data confidence
| | |
|---|---|
| **Description** | `detectPrimaryConstraint` names the trait-weakest component as the system's limiter regardless of (a) deliberate-pairing recognition — SA-05 tells a Cornwall+SET owner to change the amp, the one pairing where 2W is *correct*; (b) product truth — SA-06 claims the Benchmark AHB2 "limits inner detail," inverting the best-measuring amp in production, while the real Maggie power question goes unasked; (c) trait sparsity — thin catalog data reads as "limiting" (SA-11 D90SE, SA-12 "Harbeth limits tonal weight"). |
| **Failures explained** | 4 — SA-05, SA-06, SA-11, SA-12 |
| **Real-user impact** | High among exactly the users Audio XX most wants — owners of deliberate systems. A wrong constraint call on a loved system reads as ignorance, not analysis. |
| **Smallest launch fix** | Veto the constraint call when the coherence/deliberateness findings are positive and no physics violation exists; require minimum trait-data confidence before naming any limiter; kill the raw trait-gap phrasing ("limits X and Y and Z and W"). |
| **Effort** | ~1 day. |
| **Launch priority** | **P1** |

### Minor defects
- **RC8 — Coverage dead-ends (4):** SA-08 (Genelec/RME → null), EC-01 (unknown products → empty, the known C4), PH-03 (music_input → nothing), PH-04 (half-answered R2R question). Smallest fix: unknown/null assessments route to the knowledge lane with an honesty frame. ~1 day. P2.
- **RC9 — Comparison guidance inversion (1):** PD-01 tells the comfort-seeker to buy Chord and the clarity-seeker Schiit — backwards from its own descriptions. A template variable-ordering bug. Hours. P1 (it's actively wrong advice).

**Coverage check:** 12+8+3+2+3+2+4+4+1 = 39. ✓

---

## Architectural Assessment: the hypothesis

**Hypothesis:** failures arise because Audio XX classifies requests before understanding them (`pattern match → intent bucket → engine → polish`), and an understand-first flow (`LLM semantic understanding → strategy → engine facts → LLM writes`) would be a better launch architecture.

**Verdict: PARTIALLY SUPPORTED — strongly for the front half, weakly for the back half.**

**Supported by the evidence:**
- RC1 (12), RC2 (8), and RC4 (2) — **22 of 39 failures, 56%** — are pure classification failures. No LLM reading "Do cables actually matter?" concludes *troubleshooting*; none reading "should I upgrade my DAC or amplifier?" concludes *brand-versus-brand essay*; none reading "why do tube amps sound different?" concludes *the user is asking about the WiiM Amp*. Every one of these happened **before any engine or LLM was consulted** — the frame was wrong at the door.
- Under the full proposed architecture, RC5 (3) and RC6 (2) also largely disappear — an LLM writing the final response from engine facts would notice half the question is unanswered, and cannot contradict itself the way independent template selectors do. RC8 partially (3 of 4) — an LLM can reason honestly from type when facts are absent. **Full-architecture estimate: ~31 of 39 failures eliminated (75–80%).** Front-half only (semantic understanding replaces classification, deterministic generation kept): **~22–24 of 39 (55–60%)**.

**Contradicted / out of scope for the hypothesis:**
- RC3 (price-blind anchors), RC7 (wrong constraint calls), and part of RC8 — **~8 of 39 (20%)** — occur **after** correct routing, inside the engine's own reasoning. Under the proposed architecture the engine still supplies the $20,000 anchor and still asserts "the AHB2 is the limiter"; grounding rules correctly forbid the writing LLM from contradicting supplied facts, so it would fluently narrate the same wrong conclusions. Understanding-first fixes the frame, not the facts.

**Overall structural judgment:** the current architecture shows **one dominant architectural weakness, not a need for broad redesign.** The facts layer is provably sound — SA-10, NT-07, and PD-05 are excellent *because* the engine's structured knowledge is real. The weakness is that **irreversible framing decisions are made by pattern-matching before the request is understood**, and the composition layer then executes the wrong frame with full confidence. Notably, the repo's own ROADMAP doctrine and the A3 workstream already specify the corrective architecture (semantic interpreter inside the unresolved-intent path; A3 writes narrative from engine facts, validated). The benchmark is empirical confirmation that the doctrine is right — launch needs at least its first half.

---

## Decision Recommendation

**One engineering day: introduce the unresolved-intent state the ROADMAP already specifies, and route it through a single validated LLM triage call.**

Concretely: two routing conditions stop producing confident wrong frames and instead enter `needs_semantic_interpretation` — (1) the current diagnosis fallthrough (no pattern matched), and (2) advice-pattern messages that would otherwise fall into the comparison gate. That state makes one LLM call (the A3 pattern: existing `/api/memo-overlay` endpoint, hypothesis validated against the intent enum, deterministic fallback to a neutral clarification if the model is unavailable or fails validation) which selects the reasoning strategy; the existing engines then answer as they do today.

Why this single change: it eliminates RC1 and RC2 — **20 of 39 failures (51%)** — using infrastructure that already exists and an architectural state the project's own doctrine already sanctions. Nothing else on the table converts half the reds in a day. The next-worst offenders (RC3's price governor, RC7's constraint veto) are each ~a day of engine-side work and are unaffected by — and unaddressed by — any routing change, so they remain the evidence-designated follow-ups once this ships and the benchmark is re-run.
