# Evidence acquisition backlog — ranked by causal coverage gained

**Date** 2026-08-25 · Derived from the causal-coverage matrix across the
reference systems. No per-request web search was added in this pass; this is
the demand-driven, cached acquisition list that replaces it.

## The ranking rule

A fact is worth acquiring in proportion to the **interfaces it unblocks**, not
to how many products lack it. A figure that completes a rule Audio XX already
implements is worth more than a figure with no rule waiting for it.

Three tiers follow, in strict priority order.

---

## Tier 1 — Output impedance + input impedance (line level)

**Unblocks:** every line-level interface in every reference system. Today
*all* of them are UNRESOLVED, and all for this one reason.

**Interfaces:** source→preamp, preamp→power amp, source→integrated,
DAC→integrated. In an average three-box system this is one to two of the two
or three interfaces the chain contains.

**Why it ranks first:** the rule is implemented and waiting. `causalCoverage`
already asks the question, already names both missing figures, and would move
straight to EXPLAINED the moment both sides are held. Nothing has to be
designed — only the numbers acquired.

**Cost:** two figures per product. Most manufacturers publish output impedance
for sources and preamps, and input impedance for amplifiers, on the same
specification page Audio XX already reads for power output.

**Caution:** acquiring only one side of a pair buys nothing. An interface needs
both, so acquisition should proceed by CHAIN, not alphabetically by product.

---

## Tier 2 — Loudspeaker power handling

**Unblocks:** the "within published limits" half of the amplifier→loudspeaker
question, which is the interface carrying almost all system-level inference
today.

**Observed gap:** KEF LS50 Meta, Harbeth SHL5+, Magnepan LRS+ hold impedance
and sensitivity but no rated power window, so the pairing cannot be placed
inside or outside the maker's stated limits. Each currently reports
PARTIALLY EXPLAINED with that figure named.

**Why second:** it completes an interface already half-answered, rather than
opening a closed one. Higher marginal value per figure than Tier 3, lower
total reach than Tier 1.

---

## Tier 3 — Loudspeaker sensitivity

**Unblocks:** the loudness half of the amplifier→loudspeaker question — how
loud a pairing will play, and whether acoustic headroom is adequate.

**Observed gap:** Acora QRC-2 (Nathan's open question), Magnepan LRS+.

**Why third:** sensitivity never blocks compatibility, only loudness. Its
absence downgrades an interface from EXPLAINED to PARTIALLY EXPLAINED and
never to UNRESOLVED — real, but the least severe of the three.

---

## Explicitly NOT on this list

**Amplifier output at a second load.** Magnepan (4 Ω) and the balanced
reference (6 Ω) fail on `incompatible_conditions`: the maker publishes 8 Ω
only, and Audio XX declines to combine figures measured under different
conditions. **That refusal is a correct outcome, not a gap.** Where a maker
genuinely publishes a second load — as Butler does — the figure is already
read and used.

**Impedance minimum and phase angle.** These would license the DIFFICULTY
question that a nominal impedance cannot. Almost no manufacturer publishes
them, so this is `not_publicly_established` rather than an acquisition target;
pursuing it would mean sourcing independent measurement, a different evidence
regime with its own admission rules.

**Broad catalog character.** Recognition-only coverage was falsified in July
2026 and is not revisited here.

---

## Acquisition policy (founder decision, 2026-08-25)

No synchronous web acquisition per assessment. Held evidence is read first;
unresolved interfaces state the exact missing figure. Acquisition is
demand-driven and cached: the store is keyed by product identity, so a figure
fetched once serves every later assessment of that product.

The natural trigger is this backlog crossed with observed demand — rank the
products listeners actually enter, and acquire Tier 1 figures for the top of
that list first.
