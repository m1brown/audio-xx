# Mission 3 — Reasoning Boundaries & Assessment Continuity (2026-08-10)

Baseline: production `audio-xx-k17mineyo` = `010f5c3` behavior (verified in
[2026-08-10-gate-timing-and-a2-deploy.md](2026-08-10-gate-timing-and-a2-deploy.md) §7).
All live probes below ran against that production build; every fix was
measured live first, root-caused locally, pinned by a failing test where the
layer permits, and verified against the full suite (baseline: 20 failures,
unchanged by every commit).

## Repairs landed this mission (5 commits after the closure record)

| Commit | Family | Repair |
|---|---|---|
| `fix(budget)` | F6 | Colloquial price language: "two grand", "a grand", "for 2k", bare "for 2000", "no more than N", "about N", "N max", "bucks", dollar-less ranges — all parse; category+parseable-budget gate routes them to shopping. 9/15 phrasings failed before. Lock test `colloquial-budget-language.test.ts` (29). |
| `fix(intent)` | F1 | "what do you make of it" is assessment language — the prose-chain judgment request ("my system is X into Y driving Z — what do you make of it?") was asked for the components it had just named, then dead-ended in symptom triage. Lock test `judgment-of-named-system.test.ts` (6). |
| `ef5da6a` | F1 | Inline-stated systems (Phase K persistence) count as tuning context — post-assessment "more air and openness" went to a generic knowledge essay instead of the active-system tuning handler. |
| `d0e19b4` | F4 | Category pivots phrased as questions ("ok, now what about speakers?") were exempted from the shopping lock as audio_knowledge and dropped budget + preference context; explicit category switches now win over the exemption. |
| `d383966` | F4 | "Start over" cleared the transcript but not conversation-scoped context — a prior thread's inline system leaked into fresh conversations ("WHAT I'M WORKING WITH: Denafrips Pontus II → Leben CS600X" on a new amp request) and tailored picks to a phantom chain. |

## Parked defect classes (evidence recorded; repair needs design/editorial judgment)

### P0 — 🔴 LAUNCH-RELEVANT: affiliate disclosure is factually false on production
`/affiliate-disclosure` states "Audio XX currently earns **no commission**
from any link on this site … None of these links carry affiliate tracking."
Production product cards serve `tag=audioxx20-20` (Amazon) and
`campid=5339152664` (eBay) — live affiliate tags since LS-1 activation
(2026-08-06). The published disclosure contradicts live behavior (and the
privacy policy, which names Amazon Associates). FTC-relevant. Editorial/legal
copy — founder-gated (Five-Step pattern). Task chip spawned
(`task_dc41e463`). **Interlocks with LB-2's affiliate-disclosure item.**

Corollary: direct trust questions are consumed by the shopping pipeline —
"honest question — do you make money when i click those buy links?" was
answered "You're looking for speakers." plus three more product cards.
"are you paid to recommend these?" and "why should i trust your
recommendations?" classify as `shopping`. The repair (an early deterministic
meta-trust gate, same pattern as `checkGlossaryQuestion`) is written up in
the task chip but **cannot be implemented until the disclosure copy is
settled** — any honest answer today would contradict the published page.

### P1 — Stateless judgment/diagnosis clarification (root shared by F1/F2/F3)
The "What components are in your system?" clarification (A2) arms no
conversation state, so the answering turn re-enters the pipeline cold:
- "feliks envy + klipsch cornwall iv — is my system balanced?" → asked for
  components → supplied them → "let's figure out what's going on with your
  amplifier. Is it distorting, running hot…" — an invented amp *problem* for
  a user who asked for a balance judgment.
- Corrections re-render: "one correction — the speakers are the original
  ls50, not the meta" produced a **verbatim** copy of the prior diagnosis,
  correction unacknowledged, and re-asked "What source are you using?"
  immediately after the user answered it.
Repair needs a pending-question state in the conversation machine (the
diagnosis mode has `facts.symptom`; the judgment path bypasses it).

### P2 — Resolution-level integrity in assessments
"harbeth 30.2" resolves to brand-level "Harbeth" (model silently dropped);
"denafrips pontus ii" renders as "Pontus II **12th-1**" (a version the user
never stated). The assessment then issues "Nothing here needs changing" with
the speaker resolved only to brand — a C4-adjacent all-clear at a resolution
level that cannot license it (P3ESR / M30.2 / M40.3 differ materially).

### P3 — Product substitution on uncatalogued models (trust surface)
"feliks audio envy + klipsch cornwall iv — what do you think of this
system?" → a full, confident **Heresy IV** essay: Heresy pricing ($3,198),
Heresy reviews (Reichert / Guttenberg / Darko), Heresy buy links — for a
user who asked about the Cornwall IV. The Feliks Envy was silently ignored
(no unknown-component acknowledgment). Ties to the existing Beta Learning
item "unverifiedComponents clarification wiring"; this evidence upgrades its
severity: same-brand *product substitution* presented as fact.

### P4 — Diagnosis-lane fabrications
- Symptom echo as system claim: after "it's muddy and congested", the lane
  asserted "Your system currently leans warm and full-bodied and dense and
  harmonically rich" — derived from the complaint words, contradicting the
  same thread's earlier "leans bright and treble-forward" for the same
  (Qutest/Nait 50/LS50) chain, and implausible for it.
- The user's own component recommended as the fix: a Chord Qutest owner told
  to consider "Examples: **Chord Qutest**…" for the source upgrade.
- Subject-list mangling: "With Qutest + Chord + KEF + Naim" (brand/product
  double-count rendered as four components).

### P5 — Refinement inversion and differentiation-copy bugs (shopping)
- "warmer sounding please" promoted the *neutral* Hegel Rost to primary —
  whose own trade-off copy reads "when warmth anchors the presentation, the
  missing emphasis turns into a structural hole."
- Copy self-contradiction: "Offers something neither NAD C 3050 provides: a
  **Class A** implementation" one line above "**Class AB** output"; "neither
  X provides" grammar with a single comparator.

### P6 — Question vocabulary converted into user preference (D-7 on the listener)
After "why do horn speakers sound so dynamic?" → "so should i buy horns?",
the pipeline asserted "**You prioritized** speed and dynamic engagement" /
"RHYTHM-DRIVEN" — from interrogative vocabulary, not stated preference — and
fabricated "Context: low-power / near-field" (never stated). The horns
question itself was never answered (primary pick: JBL L100 Classic, a
direct radiator; no horns-vs-not framing; no "do nothing" path).

### P7 — Constraint-conflict silence + tier escalation
"pure class a amp for my desk, but it has to run cool and sip power" — the
physical contradiction (Class A bias ⇒ heat) was never surfaced; "cool" and
"sip power" appear nowhere in the reply; primary pick was the **$15,000
Grandinote Shinai** with no budget stated and a desk context ignored.
Violates constraint hierarchy (D-4) and the no-unsignalled-escalation rule.

### P8 — Context lanes drop named subjects
"would a luxman integrated suit harbeth p3esr in a small room?" → the room
lane answered general small-room advice and said "I don't have your …
speaker model" — with the P3ESR (catalogued) and Luxman (calibrated
BrandProfile) in the message. Manufacturer-knowledge integration never
engaged.

## Family verdicts

| Family | Verdict |
|---|---|
| F1 continuity | Assessment→"change first?" follow-up is GOOD (restraint held). Entry phrasing + desire follow-ups repaired; clarification statelessness parked (P1). |
| F2 correction | Broken (P1/P4): corrections ignored, re-asks, fabricated tendencies. One positive: symptom retraction does switch the complaint map. |
| F3 uncatalogued certainty | Broken (P2/P3): substitution essays, silent unknowns, brand-level all-clears. |
| F4 long-thread memory | Budget + hard constraints persist ✓ within category; pivot drop fixed; cross-reset leak fixed; refinement inversion parked (P5). |
| F5 Explain→Evaluate + trust | Transition reaches shopping ✓ but with fabricated preference attribution (P6); trust questions catastrophically mishandled (P0). |
| F6 price language | Repaired + locked (29 cases). |
| F7 constraints + manufacturer knowledge | Broken (P7/P8). |

## Mission-continuation answer

Synthetic pre-beta hardening is **still producing new defect classes at a
rate that justifies another mission**. This mission found nine parked
classes plus five narrowly-repairable ones in roughly seven probe families —
including one launch-gating compliance defect (P0), one trust-surface
substitution (P3), and one architectural root (P1) that three separate
families converge on. These are systematic routing/state/provenance
defects, not taste-calibration questions — real users would experience them
but are not needed to *find* them. Recommendation: one more synthetic
mission centered on (a) the P1 pending-question state repair and re-probe of
F1/F2/F3, and (b) post-founder-decision implementation of P0's trust gate —
before any invitation. P0 itself must be resolved before the first invite
regardless of mission cadence.
