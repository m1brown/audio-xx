# Causal-coverage matrix — reference systems

**Date** 2026-08-24 · Generated from `causalCoverage()` over each system's held
dossiers. An **observability tool, not a score.** Sparse evidence should
produce sparse explanation, and optimising toward full coverage would be
optimising toward fabrication.

The architectural question this answers is not "how much is explained" but
**does Audio XX know why it cannot say more.** Every gap below names the
figure responsible.

Only interfaces the system actually contains are listed. A matrix padded with
absent interfaces would measure the ontology rather than the assessment.


## NATHAN
   dCS Rossini Apex → ARC ref 5: UNRESOLVED — dCS Rossini Apex output impedance and ARC ref 5 input impedance not held
   ARC ref 5 → Butler Monads: UNRESOLVED — ARC ref 5 output impedance and Butler Monads input impedance not held
   Butler Monads → Acora QRC-2: PARTIALLY EXPLAINED — output at the stated load is established; Acora QRC-2 sensitivity is not published, so acoustic headroom cannot be estimated

## FLAWED
   Holo May KTE → Decware SE84UFO: UNRESOLVED — Holo May KTE output impedance and Decware SE84UFO input impedance not held
   Decware SE84UFO → Magnepan LRS+: PARTIALLY EXPLAINED — output at the stated load is established; Magnepan LRS+ sensitivity is not published, so acoustic headroom cannot be estimated

## LEBEN/CORNWALL
   Leben CS600X → Klipsch Cornwall IV: EXPLAINED

## MAGNEPAN
   Chord Qutest → Rega Elex-R: UNRESOLVED — Chord Qutest output impedance and Rega Elex-R input impedance not held
   Rega Elex-R → Magnepan LRS+: UNRESOLVED — no published output figure at 4 ohms — the maker states 73W@8Ω

## BALANCED REF
   Chord Qutest → Naim SuperNait 3: UNRESOLVED — Chord Qutest output impedance and Naim SuperNait 3 input impedance not held
   Naim SuperNait 3 → Harbeth SHL5+: UNRESOLVED — no published output figure at 6 ohms — the maker states 80W@8Ω

## FRANCE
   Eversolo DMP-A6 → JOB INTegrated: UNRESOLVED — Eversolo DMP-A6 output impedance and JOB INTegrated input impedance not held
   JOB INTegrated → WLM Diva Monitor: UNRESOLVED — JOB INTegrated power output and WLM Diva Monitor nominal impedance not held

## PREAMP+INTEGRATED
   ARC ref 5 → Leben CS600X: UNRESOLVED — ARC ref 5 output impedance and Leben CS600X input impedance not held
   Leben CS600X → KEF LS50 Meta: PARTIALLY EXPLAINED — output at the stated load is established; KEF LS50 Meta power handling is not published, so the pairing cannot be placed inside or outside the maker's stated limits

## LISTENER-ONLY
   Blang 2 → Frooble X: UNRESOLVED — Blang 2 power output and Frooble X nominal impedance not held

---

## What the matrix shows

**The amplifier-to-loudspeaker interface carries almost all system-level
inference.** It is the one place the catalog routinely holds both sides, and
the only interface reaching EXPLAINED anywhere.

**Every line-level interface is UNRESOLVED, in every system, for the same
reason:** output impedance and input impedance are not held for any product.
This is `missing_product_evidence`, not an architecture gap — the rule is
implemented and waiting for figures. It is the highest-value evidence
acquisition target in the ontology, because one pair of numbers per product
would resolve an interface that is currently blank everywhere.

**Two systems fail on `incompatible_conditions` rather than absence.**
Magnepan (4 Ω speaker, amplifier publishes only 8 Ω) and the balanced
reference (6 Ω speaker, amplifier publishes only 8 Ω). Both sides publish; the
loads do not correspond, and Audio XX declines to combine them. Reporting
"73 W at 8 Ω" as though it answered a 4-ohm question is exactly the class of
error the quantity guard exists to prevent. **A refusal here is a correct
outcome, not a coverage failure.**

**FRANCE resolves nothing** because no manufacturer facts are held for those
products — the catalog carries no specifications of its own. This is a data
state, not a reasoning defect.

**Sensitivity is the most commonly missing single figure.** It never blocks
compatibility, only loudness, and the matrix keeps those two questions
separate rather than collapsing them into one verdict.

## Defect this matrix surfaced in its own module

The first run reported EXPLAINED for `Leben CS600X → KEF LS50 Meta` on the
strength of sensitivity alone, while KEF's power handling was unpublished —
so the *limits* question had not been asked at all. The interface poses two
questions needing two different figures, and coverage now requires both before
claiming to have explained it.
