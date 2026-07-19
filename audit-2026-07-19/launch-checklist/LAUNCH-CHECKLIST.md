# Audio XX — Final Launch Checklist

**Date:** 2026-07-19 · **Engine frozen at:** the commit carrying this file on `version-b`. All five launch conditions from the MVP readiness review are complete and verified. Subsequent engine work moves to the post-launch roadmap.

## Conditions — all complete

| # | Condition | Status | Evidence |
|---|---|---|---|
| 1 | **Test triage → trusted baseline** | ✅ | `signals.yaml` cwd bug fixed (revived the 11-test phase-k multi-turn release-gate suite, previously red for infra reasons); 35 remaining known failures pinned in `apps/web/test-baseline.json`; `scripts/test-gate.mjs` fails only on NEW failures and shrinks the baseline as fixes land (now 20 after the guardrail work fixed 15) |
| 2 | **Shopping guardrails** | ✅ | Lifestyle/mismatch queries (gym headphones, all-in-one record players, phono stages) decline shopping → knowledge lane; "bargain" phrasing triggers the affordability ceiling; cold queries capped at a $6,000 mainstream anchor ceiling (explicit prestige cue lifts it); traditional-marketType presence guaranteed in anchor pools (skipped when the user stated brand preferences); image preference can no longer evict traditional candidates; planar/LS50 partner cues filter low-watt SETs. All 13 previously-failing shopping-anchor spec tests now pass |
| 3 | **Concept/power routing** | ✅ | "Can X drive Y", "enough power for", "is an upgrade audible", "sub or speakers" → knowledge lane; symptom complaints stay with diagnosis (verified by test); benchmark harness Route-2 aligned to page.tsx's knowledge-before-shopping order |
| 4 | **Assessment consistency gates** | ✅ | "No obvious weak point" can never share a screen with a change verdict; keyObservation neutrality claims require component-level support; internal stacked-trait labels translate to listener language at every render surface (shared `listener-labels.ts`) |
| 5 | **Point corrections** | ✅ | Null assessments (Genelec/RME actives) fall back to the knowledge lane in page.tsx; brand comparisons lead with the model the user named (Bifrost 2/64 = multibit, not delta-sigma) |

## Verification results

**Test gate:** 3,751 passing · 20 known-failure baseline · **0 new failures**. New `launch-guards.test.ts` (16 tests) pins every condition: shopping ceilings, SET filter, prestige escape, concept routing, diagnosis preservation, consistency gates, alias resolution, Leben/DeVore evidence, transparency gate, banned-vocabulary sweep across three full assessments.

**Benchmark (final capture, `audit-2026-07-19/launch-qa-final/`):** vs Phase 2B — 78 identical, 28 changed, 13 routing changes, every one a D-cluster fix. Every graded-D shopping row now clean: gym/record-player/phono/bargains/LS50/Magnepan queries produce no absurd anchors (max prices now $2,800–$4,200 where cards remain; knowledge-lane prose where the catalog cannot serve). SM-01/02, TS-03, UP-07/08, BY-02, LS-04/06 all route to the knowledge lane. Two rows (CG-03, VG-05) surfaced as knowledge-lane in the capture because the harness now mirrors prod's dispatch order — their prod behaviour was already the knowledge lane; the capture is more faithful, not different.

**Demo scenarios (live dev server, real UI):**
1. *Flagship assessment* (Pontus II / CS600X / O/96): coherent tone-first read, "Leave it alone" verdict, documented-pairing narrative, zero contradictions. Follow-up turn produced a sensible clarifying question — conversation continues, no dead-end (see caveat below).
2. *Cold shopping* ("I want a tube amp"): anchors Leben CS300 $2,800 push-pull, traditional, with used-market pricing — not the $20,000 Shindo.
3. *Lifestyle reroute* ("best headphones for the gym"): knowledge lane, honest consumer guidance with live LLM prose, zero hi-fi price cards.
4. *Power question* ("Can my Nait 50 drive Falcon LS3/5a?"): knowledge lane, real prose engaging sensitivity directly.

## Known caveats accepted at freeze (all post-launch roadmap)

- ~~Multi-turn follow-ups after an assessment re-ask rather than answer from context~~ **RESOLVED post-freeze (founder-approved, commit c642f22):** the first follow-up direction question ("which upgrade first?", "weakest link?") now answers from the assessment's own findings. Scope is one turn; deeper conversational memory remains roadmap P1.
- **SA-08 capture still shows `system_assessment→null`** — the harness simulates routing and does not execute the page.tsx fallback; prod now answers via the knowledge lane. The harness's null-path note is stale by one fix.
- **PD-07** ("help me choose a dac") anchors at $4,200 max under the mainstream ceiling — inside tolerance, no longer the $12,500 anchor; sweet-spot pressure can improve it post-launch.
- Coverage cliff (LS50 Meta, Cornwall IV entries), sensitivity data, diagnosis classic answers, `componentReadings` rendering, suppressed LLM overlay: **post-launch roadmap P1/P2 as per the MVP readiness report.**

## Freeze declaration

With this commit pushed to `origin/version-b`, the engine is **frozen for MVP**. Changes permitted before launch: content/data only (catalog entries, copy), deployment configuration, and fixes for launch-blocking production incidents — each gated by `node scripts/test-gate.mjs` and a benchmark rerun. All other work queues on the post-launch roadmap.
