# Launch QA — Response Benchmark Report

**Date:** 2026-07-02 · **Branch:** `launch-qa-responses` · **Prompts:** 60 (48 structured + 12 natural) · **Method:** every prompt routed through the deterministic engine exactly as page.tsx routes a first-time visitor's first turn (guest state, no history). Full responses in `transcript.md`, structured data in `responses.json`, scores in `scores.json`.

---

## Overall launch readiness: 2.2 / 5 — NOT ready for 100 serious audiophiles

| Verdict | Count | Share |
|---|---|---|
| 🟢 Ship | 4 | 7% |
| 🟡 Good enough | 17 | 28% |
| 🔴 Must fix | 39 | 65% |

The product has a genuinely strong core — the system-assessment engine on a well-known chain (SA-10) and the head-to-head brand comparisons (NT-07) read like an experienced reviewer. But a first-time visitor asking anything **outside** those two grooves has roughly a two-in-three chance of hitting a response that damages trust: a troubleshooting question they didn't ask for, a comparison of the wrong two things, a $20,000 amplifier recommended to someone who said "won't blow up my budget," or a product sheet for a component they never mentioned.

### Average scores by dimension (1–5)

| Dimension | Avg | Notes |
|---|---|---|
| Accuracy | 2.6 | Sunk by wrong constraint calls (AHB2 "limits inner detail"), inverted comparison guidance, non-sequitur products |
| Authority | 2.7 | Excellent on known chains; template seams visible everywhere else |
| Clarity | 3.2 | Individual sentences are clear; documents contradict themselves |
| Personality | 2.9 | The Audio XX voice exists (SA-10, NT-07) but most responses are form-fill |
| Actionability | 2.4 | Worst dimension — advice questions frequently get no advice |
| Trust | 2.4 | One $20K pick for a budget shopper undoes ten good answers |

---

## Ranked recurring weaknesses

1. **The diagnosis black hole (12 responses, all 🔴).** Any general question without named components falls through `detectIntent` to the diagnosis default and gets "Got it — let's figure out what's going on. Does it sound thin, digital, fatiguing…?" Victims: *Do cables matter? · Is room treatment more important? · Build me a $3,000 system · What does sensitivity mean? · Are expensive speakers better? · is class D finally good · what would you pair with cornwalls · speakers for a desk setup · is the LS50 meta overhyped · do I need a miniDSP · something small that sounds good · my system is a Sondek and a Nait and some Kans.* A visitor asking a beginner or philosophy question is answered with symptom triage for a problem they don't have. This is the single largest source of reds.

2. **Advice questions collapse into two-brand comparisons (7 responses, all 🔴).** "Should I upgrade my DAC or amplifier?" → KEF vs Marantz comparison (and the Marantz described is the *vintage 1974 receiver*, not the PM8006 the user owns). "What's the weakest link?" → Eversolo vs WLM versus. "Where should I spend $2,000?" → Chord vs Harbeth versus. "Can my Nait 50 drive LS3/5a?" → Falcon vs Naim philosophy essay that never answers the power question. The comparison template is eating questions it was never designed for.

3. **Price-blind shopping anchors (4 responses, all 🔴).** "whats a good tube amp that wont blow up my budget" → **Shindo Cortese, $20,000**. Amp for Klipsch Forte IV → same $20K pick. Maggies + power question → a ~
few-watt SET recommended for 86dB planars (factually dangerous, not just expensive). Cold "help me choose a dac" anchors at $4,200/$12,500. Without a stated budget the anchor selection reaches for the catalog's prestige tier — instant credibility loss.

4. **System assessments contradict themselves (6 responses).** SA-01: "prioritising tonal density" + all components "tone-rich" + "this is a **detail-first** system… clarity dominates" in one document. SA-04: "no strong lean" then "warmth and body dominate" then "you prefer **neutrality**." SA-09 mixes three identities. Several responses say KEEP and CHANGE for the same component. Plus a literal "detail emphasis emphasis" duplication bug (SA-02). A careful reader concludes a machine wrote it and stops trusting the parts that were right.

5. **Wrong-product non-sequiturs (2 responses, catastrophic class).** "Why do tube amps sound different from solid state?" and "$1500, system sounds lifeless, not sure if it's the amp" both returned the **WiiM Amp ($299 Class D)** product sheet — a product the user never mentioned. Generic words ("amp") are resolving to a specific catalog product.

6. **Wrong constraint calls on deliberate pairings and transparent gear (4 responses).** Cornwall IV + Decware SET: "CHANGE the amplifier… it limits what the chain can deliver" — the one pairing where a 2W SET is *correct*. Benchmark AHB2: "limits inner detail and texture" — the most transparent amp in production, while the real question (power for Maggies) goes unaddressed. Topping D90SE and Harbeth C7 get the same treatment.

7. **One-sided comparisons (3 responses).** Holo May vs Yggdrasil → Holo essay, Schiit never mentioned. Node → A8 → Node covered, A8 ignored. Qutest vs Pontus (user owns both) → Pontus sheet only.

8. **Unknown/empty handling (3 responses).** Unknown products (Fooblaster) → nothing at all (known QA C4). Genelec+RME → engine null. A8-vs-A6 → two sentences of nothing.

9. **Cosmetic authority leaks.** Model-name case mangling ("Decware Se84ufo", "Falcon Ls3/5a", "Benchmark ahb2", "rADIAL"); one comparison with inverted guidance (PD-01 tells the warmth-seeker to buy Chord and the clarity-seeker to buy Schiit — backwards from its own descriptions).

---

## The five highest-impact launch fixes (not implemented, per protocol)

1. **Retire the diagnosis default.** Unresolved intent must never route to symptom triage. Smallest change: when no symptom words are present, route unresolved general questions to the knowledge lane (or a neutral "here's my take + one question" clarification). Converts ~12 reds; single biggest trust win per line of code.
2. **Advice-question guard before the comparison gate.** When a message names ≥2 owned components AND contains an advice pattern (*upgrade / weakest link / where should I spend / keep what I have / can X drive Y*), route to system assessment in advice framing — never brand-vs-brand. Converts ~7 reds.
3. **Budget sanity for anchors.** No stated budget → cap the anchor at the catalog's mainstream tier and ask the budget question in the same breath; treat "won't blow up my budget" as an explicit budget signal; hard-block low-watt SET anchors for low-sensitivity speakers (the Maggie case). Converts 4 reds and protects every shopping answer.
4. **Assessment coherence gate.** One computed system lean feeds every section; suppress template sentences that contradict it; never emit KEEP and CHANGE for the same component; fix the "emphasis emphasis" duplication. Upgrades most of the SA category from contradiction to coherence.
5. **Comparison completeness check.** If the user names two products and only one resolves, say so explicitly ("I know the May well; I don't have calibrated data on the Yggdrasil") instead of silently answering one side; fix the PD-01 direction inversion. Converts 3 reds and is exactly the honesty the voice claims.

## The five strongest responses — this is the Audio XX voice

1. **SA-10** (Pontus II / Leben CS600X / DeVore O/96) — "The chain works because speed is converted into elastic motion rather than edge… Low stored energy and fast recovery keep musical energy moving through the chain." Leverage call: *system balance — preserve, don't add.* This is the product at its best.
2. **NT-07** ("selling my hegel for a leben, am I crazy") — names the real trade (feed-forward control vs hand-wired tone), describes both accurately, takes a side. Exactly how a trusted friend answers.
3. **PD-05** (LAiV Harmony) — real knowledge of a niche product, honest sourcing, places it against Pontus/Venus tier. Credibility builder.
4. **PD-03** (KEF R3 vs Harbeth P3ESR) — a true taste fork, decisively framed: "warmth and tonal body vs precision and control."
5. **SA-02's Emergent behavior paragraph** (France system) — "speed is converted into elastic motion rather than edge… microdynamics stay lively, quick, and sweet instead of merely lean." The register every assessment should hit.

The pattern in all five: **they explain the interaction and take a position.** The pattern in the 39 reds: **the template answered a different question than the user asked.**

---

## Method caveats

- Single-turn, deterministic-engine capture. The LLM lanes (audio_knowledge, memo overlay, A3 Character/Case overlays) were not exercised — on prod, philosophy answers and assessment prose may be materially better when the model responds. But the *routing* failures (weakness #1, #2) happen before any LLM is consulted and are faithfully captured.
- Shopping cards render richer detail on prod (technical rationale, trade-offs, images) than the harness's text flattening shows; PD-06/PD-07 scores account for this.
- Two clarification responses (SA-03, SA-07) produced question objects the harness didn't fully flatten; verify their wording on prod before acting on them.
