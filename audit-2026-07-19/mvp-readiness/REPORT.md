# Audio XX — MVP Readiness Review & Go-to-Market Gate

**Date:** 2026-07-19 · **Reviewed build:** `371ec63` (editorial pass + Phase 2A + Phase 2B) · **Evidence:** phase2b benchmark capture (106 prompts), mechanical regression scan across all four captures, three independent per-slice grading passes, test-suite audit. No code changed during this review.

---

## 1. Executive Summary

**Recommendation: GO WITH CONDITIONS.** The assessment engine — the product's core — is demonstrably mature: the flagship system-assessment experience is coherent, hedged, evidence-bearing, and demo-quality on well-covered systems, and three phases of improvement have held with zero regressions. What is *not* ready is the **shopping lane**, which none of the three phases touched: it still answers "best headphones for the gym" with a $6,000 amp-dependent planar and "best used bargains" with a $20,000 Shindo. Of 17 launch-blocker grades, **9 come from this single unguarded lane**, and most of the rest from two small consistency gaps. The conditions list is roughly **3–4 days of focused work**, after which the benchmark projects to ~0 D / ~70%+ A+B. Launch after the conditions; do not wait for anything else.

Grade distribution: **A 4 · B 51 · C 34 · D 17** (A+B = 52%). The D count overstates the engine's distance from launch: the Ds cluster into four fixes, three of them small.

## 2. Benchmark Assessment (all 106 scenarios)

Grades and per-row justifications for every C and D are in [GRADES.md](GRADES.md). Summary by slice:

| Slice | A | B | C | D |
|---|---|---|---|---|
| SA/UP/PD (assessment + upgrade + product) | 2 | 8 | 14 | 7 |
| SM/TS/PH/EC/NT/RS (matching/troubleshooting/edge) | 1 | 19 | 14 | 5 |
| LS/CG/CN/BY/BG/VG (lifestyle/budget/beginner/vague) | 1 | 24 | 6 | 5 |
| **Total** | **4** | **51** | **34** | **17** |

**The 17 Ds, clustered by root cause:**

| Cluster | IDs | Mechanism | Fix size |
|---|---|---|---|
| **D1 — Shopping price/use-case anchors** (9) | LS-04, LS-06, CG-06, BY-02, VG-04, NT-11, PD-07, UP-07, UP-08 | Deterministic shopping retrieves from the audiophile anchor catalog with no budget/use-case gate: gym → $6k Susvara; built-in-speakers → $12k DeVore; bargains/LS50/Magnepan → $20k Shindo; "phono preamp under $300" → two integrated amps; concept questions ("sub or speakers?", "is a streamer audible?") forced into product cards | One systemic guard: price-plausibility + use-case filter on shopping ranking (the `AFFORDABLE_CEILING` scaffolding exists at shopping-intent.ts:4144), plus rerouting concept-shaped questions to the knowledge lane |
| **D2 — Assessment self-contradiction** (2 + degrades ~6 Cs) | SA-12, SA-13 (echoed in SA-01/04/09/11, UP-04, EC-03) | Two unreconciled seams: "a well-balanced system with no obvious weak point" rendered beside "Primary leverage: change X"; and the `keyObservation` philosophy composer claiming "neutrality and transparency" against a warm system read | Two small consistency gates in the composer |
| **D3 — Power questions answered with brand blurbs** (4) | SM-01, SM-02, TS-01, TS-03 | "Can X drive Y" / symptom questions route to consultation/comparison templates that never engage power, sensitivity, or the symptom | Route power-match and symptom-shaped questions to the knowledge lane (verified strong on these) — a routing-pattern change, not new reasoning |
| **D4 — Point failures** (2) | SA-08 (null on Genelec/RME active chain), PD-01 (Bifrost 2/64 called delta-sigma; it is True Multibit) | Missing active-monitor handling; one wrong data field | Null → knowledge-lane fallback; one-line data fix |

**What is already excellent:** SA-10 (Leben/Pontus/DeVore) is exactly the product vision — documented pairing lore, coherent tone-first read, honest "preserve the character" advice. PD-05 (LAiV Harmony), NT-07 (Hegel vs Leben trade-off), CG-05 (R2R vs delta-sigma verdict) are demo-quality. All 22 llm-lane routings in the hardest slice were judged correct — the empty-turn guard and knowledge-lane fallback are doing their job.

## 3. Regression Report — no regressions found

Mechanical scan across all four captures (Jul-14 → editorial → 2A → 2B), rows containing each pattern:

| Pattern | Jul-14 | Editorial | 2A | 2B |
|---|---|---|---|---|
| Ontology leakage (banned terms) | 18 | 2¹ | 2¹ | 2¹ |
| Unsupported certainty ("dominate throughout" etc.) | 14 | 0 | 0 | 0 |
| Signal-flow clarification on obvious systems | 2 | 0 | 0 | 0 |
| "Weakest link in the system" | 0 | 0 | 0 | 0 |
| Filler bullet | 14 | 16 | 16 | **0** |
| Documented pairing match / caution | 0/0 | 0/0 | 6/4 | 6/4 |
| Partner-named interaction effects | 0 | 0 | 0 | 10 |
| Engineering descriptors in rows | 3 | 3 | 10 | 10 |
| Average response length (chars) | 812 | 864 | 891 | 885 |
| Empty responses | 0 | 0 | 0 | 0 |

¹ Both residual hits are Denafrips catalog philosophy prose (descriptive data, previously accepted), not templates.

Editorial quality, technical depth, conciseness, evidence selection, and transparency logic all held or improved monotonically; the Bluetooth-routing fix, empty-turn guard, and transparency gate are intact. **One honest caveat:** the editorial pass eliminated the contradictory-identity *vocabulary*, but graders found the underlying *structural* contradiction survives in two rows (SA-12/13, cluster D2) — an incomplete fix now precisely characterised, not a regression.

## 4. Test & QA Coverage Review

**Current state:** ~3,708 tests in ~195 files; 3,644 passing; **44 pre-existing failures in 27 files on the launch branch**; benchmark harness asserts only row count (it cannot fail on quality); 42/106 benchmark rows are llm-lane placeholders whose production content is never machine-verified.

**The 44 red tests are a launch-week hazard, not mere untidiness** — they forced this project to build ad-hoc baseline-diffing to detect its own regressions three times. They fall into: stale copy assertions (old template strings — the majority), one test-infra bug (`signals.yaml` resolved against the wrong working directory), and the **phase-k multi-turn release-gate suite (11 tests) — the only multi-turn coverage in the repo, and it is red** while multi-turn continuity is a known weak area (QA C1).

**High-value additions only (each materially reduces launch risk):**
1. **Banned-phrase guard over benchmark output** — asserts no ontology/certainty/filler pattern reappears; locks three phases of editorial work for ~30 lines.
2. **Knowledge-surfacing regression test** — SHL5+ alias → product entry, transparency gate holds for AHB2, Leben/DeVore evidence fires. Phases 2A/2B currently have zero dedicated tests.
3. **Shopping price-guard test** — once condition D1 lands, pin it (gym → no $6k picks; bargains → no $20k picks).
4. **Adjudicate the phase-k multi-turn suite** — fix the tests or the behaviour; either outcome de-risks demos. Fix the signals.yaml infra bug; update-or-quarantine stale copy asserts with tickets.

Not recommended: additional prose-template unit tests, snapshot tests, or benchmark expansion — low value at this gate.

## 5. Launch Blockers (complete list — nothing else blocks)

1. **Shopping price/use-case guard** (cluster D1, 9 rows) — the one change that most protects credibility; cold shopping queries are the most likely first message from a stranger.
2. **Assessment consistency gates** (cluster D2, 2 rows + 6 Cs) — "no obvious weak point" and a CHANGE verdict must never co-occur; keyObservation must not contradict the system read.
3. **Power/symptom question rerouting** (cluster D3, 4 rows) — send them to the knowledge lane until deterministic power-match prose exists.
4. **Two point fixes** (cluster D4) — SA-08 null → knowledge-lane fallback; Bifrost 2/64 architecture field.
5. **Test-suite triage** (half day) — infra bug + stale asserts + phase-k adjudication, so launch-week changes can be trusted.

Estimated total: **3–4 focused days.**

## 6. Post-Launch Roadmap (explicitly NOT blockers)

**P1 (first weeks):** author ~10 mainstream catalog entries (KEF LS50 Meta, Klipsch Cornwall IV, active-monitor staples, popular budget kit — the coverage cliff behind the boutique catalog); fill `sensitivity_db` for 20 speakers (re-arms power-match reasoning); classic-symptom direct answers in the diagnosis lane (ground loop, Fletcher-Munson, boundary bass — converts 6 Cs); multi-turn continuity fix if phase-k adjudication shows real breakage.
**P2:** render `componentReadings` in system review (the largest untapped depth reserve — a UI change); complete-the-comparison behaviour (UP-06, NT-05, PD-09 half-answered either/ors); stop paying for the suppressed LLM overlay.
**P3:** unified knowledge layer + reconciliation (JOB warmth contradiction), interaction-graph growth, numeric-trait reasoning, benchmark quality assertions + llm-lane content validation, emergent-behavior evidence-judging.

## 7. GTM Risk Assessment (top 5, ranked likelihood × impact)

| # | Risk | L×I | Smallest mitigation |
|---|---|---|---|
| 1 | **A stranger's first message is a cold shopping query and gets a $20k/$6k absurdity** — screenshot travels | High × Severe | Blocker #1 (price/use-case guard) |
| 2 | **Live demo goes multi-turn and follow-up degrades** (benchmark is turn-one only; the multi-turn suite is red) | High × High | Adjudicate phase-k; script demo flows through a 10-scenario 2-turn manual QA before any live demo |
| 3 | **Reviewer's own gear is mainstream/active and falls off the coverage cliff** (LS50 Meta, Genelecs) into brand-generic or null output | Medium × High | Blocker #4 for the null path now; the 10-entry authoring sprint immediately post-launch |
| 4 | **Self-contradiction screenshot from a plain multi-box system** (SA-12 class) | Medium × High | Blocker #2 |
| 5 | **LLM-lane dependency** — 40% of benchmark traffic rides one provider, content never machine-verified | Medium × Medium | Existing deterministic fallback + a single live smoke test and latency/error monitoring at launch |

## 8. Final Recommendation

**GO WITH CONDITIONS.** Complete the five blockers in §5 (~3–4 days), rerun the benchmark to confirm the D column clears, then ship. The evidence for GO rather than NO-GO: the core advisory experience — the thing this product *is* — already produces assessments a reviewer can be shown (SA-10, NT-07, PD-05, CG-05), all 106 prompts produce non-empty, editorially clean output, three improvement phases are regression-free, and every remaining blocker is a bounded, mechanically-understood fix rather than open-ended research. The evidence against unconditional GO: nine trust-destroying price anchors sit on exactly the query class most likely to be a stranger's first message. Fixing the funnel's last unguarded lane is days, not weeks — spend them, then launch.
