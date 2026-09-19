# France Grok-benchmark baseline — 2026-09-19

The product acceptance test of the Grok-parity mission: given trustworthy
admitted evidence and the full listener context, Audio XX should be at
least as useful, personalized and system-aware as the competitor's answer
while every consequential conclusion remains traceable to evidence and
properly licensed reasoning.

| field | value |
| --- | --- |
| run | `france-bench-2026-09-19` (results git-ignored; this document is the record) |
| conversation | `CONVERSATIONS['france-grok-benchmark']` — 8 turns: system + cables, stated preferences, reference systems, fit question, three on-hand candidates (DAC / amp / cable), single-swap counterfactuals, leave-alone |
| generation / validator | gpt-6-astra / gpt-4o, production publication boundary |
| outcome | 8/8 published (4 CHECKED, 4 REPAIRED), 0 retries, 0 safe failures, 0 deterministic violations |
| observations | both listener-context turns entered the governed context verbatim (widened matcher) |

## The benchmark (before)

The competitor's answer to the same brief was rich and personalized — and
made unlicensed claims throughout: cable tonal effects stated as fact
("the Canare is cleaner and clearer, removing any veil"), fatigue
guarantees ("zero listening wear", "no fatigue or harshness here"),
whole-system verdicts ("balanced and linear", "this system is optimized",
"a long-term keeper"), invented specifics (sensitivity "~94–97dB", bass
"down to ~35–40Hz"), and precise sonic consequences assigned to every
substitution.

Audio XX's own prior first-turn experience was the deterministic
initial-assessment composer — licensed but component-sequenced, with the
France II power contradiction and the duplicated conversion finding
(repaired this mission; see composition-coherence pins).

## The after — representative excerpts (verbatim from the run)

Fit, licensed by the listener's own statements:

> "Your system looks like a good, but not assured, fit: promising for
> detail, air and sparkle; less certain for the sweetness and elasticity
> that made your Scott-based systems satisfying. I wouldn't call it a
> mismatch, nor assume it needs more warmth."

Reference-system reasoning without turning memory into fact:

> "Some of the elasticity you remember may therefore have belonged to the
> amplifier–speaker partnership, rather than tubes alone."

The cable overclaim trap, refused without becoming useless:

> "Possibly, but I'd expect a subtle change or none — not a dependable
> move toward sweetness or greater flow… if you can't reliably
> distinguish them, there's no sonic reason to favour the more expensive
> cable."

Identity discipline surfacing as natural conversation:

> "I can't confidently identify that DAC from the name, and its sonic
> character is unknown to me… A photograph or full model designation
> would help."

Restraint, earned and graded (the requirement-7 ladder in the wild):

> "Yes — my recommendation is to leave it as it is unless you're hearing
> a specific, persistent shortcoming… Your combination is a plausible fit
> for your priorities, though I can't establish its sweetness, elasticity
> or freedom from fatigue from the component list… That would be a
> reversible experiment — not a presumed upgrade."

## Grok behaviors matched

Preference-driven interpretation; whole-system relationships (JOB–WLM
named as the key relationship every turn it mattered); reference-system
comparison; per-component contribution reasoning; substitutions as
one-at-a-time level-matched experiments; "keep it" as a first-class
outcome; a knowledgeable interlocutor's voice.

## Grok claims correctly refused or qualified

Cable tonal effects as fact → "subtle change or none," physics named as
mechanism, no direction promised. Fatigue guarantees → "doesn't guarantee
effortless or fatigue-free sound." Whole-system "optimized/balanced"
verdicts → "plausible fit… not assured," graded per the evidence.
Unknown-product character (Goldmund SDRA, Crayon CIA versions) →
identity questioned, no reputation-derived sound invented. Invented
specifics → none (0 deterministic violations across the run).

## How to re-run

```bash
QA_FRANCE_BENCH=1 OPENAI_API_KEY=… npx vitest run \
  apps/web/src/qa/golden/__run__/france-benchmark.test.ts
```

Tier C cost class — run on model/validator/prompt/substrate migrations,
alongside the golden corpus.
