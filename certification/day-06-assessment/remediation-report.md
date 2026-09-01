# Gate 6 Remediation — Graph-Integrity Gate (G6-D1) · Report

Date: 2026-07-25 · Baseline: 33426c5 (+ this remediation) · Founder decision:
apply the smallest safe graph-integrity mitigation; do not resolve by catalog
additions; route untrusted graphs to a specific clarification.

## Recommendation: **PASS** — G6-D1 resolved. Gate 6 now passes.

## The integrity invariant implemented
Before synthesising an assessment, `buildSystemAssessment` runs
`checkGraphIntegrity(rawMessage, components)` (immediately after the existing
role-conflict validation, before the confidence gate). It asks for a specific
clarification — `kind: 'clarification'`, NOT the LLM `low_confidence` path —
when ANY of:

1. **Dropped** — the resolved component count is lower than the distinct
   primary components the user listed (accessory-labelled segments and
   role-only labels excluded; identical wording de-duplicated; a bare "/" is
   never a separator, so model names like O/96, SP3/1R, LS3/5A are intact).
2. **Duplicated / mis-bound** — one component's token set is a subset of
   another's (e.g. "Wilson" ⊂ "Wilson audio"), i.e. the same unit surfaced
   twice. A spurious BARE-brand echo of a component that carries a cataloged
   product (e.g. "Crayon" beside the cataloged "Crayon Audio CIA-1T") is first
   de-duped to the cataloged entry — that preserves the recognised component
   rather than clarifying.
3. **Two-plus unresolved models** — two or more components resolved only to a
   BARE brand (no cataloged product AND no model token in the name). A single
   bare-brand component in an otherwise intact graph still assesses (existing
   behaviour). Brand-level resolution no longer conceals model-level
   uncertainty.

The check is a counting/consistency pass over already-resolved components — no
re-parse, no re-match — so it cannot itself drop, rebind, or duplicate a
component. It preserves recognised components, preserves explicit role labels,
excludes accessories from the integrity count, and never asks the user to
re-enter the whole system.

## Before → after (the three discovered failures)
| System | Before | After |
|---|---|---|
| WiiM Pro, **Fosi V3**, Wharfedale Diamond 12.1 | assessed as 2 (amp dropped) | **clarifies** — "So far I can place these 2: WiiM Pro, Wharfedale. It looks like one more component is in what you wrote… Could you give me the exact make and model number of that one?" |
| Bluesound, Cambridge AXA35, **Q Acoustics 3030i** | assessed as 2 (speaker dropped) | **clarifies** — names Bluesound Node + Cambridge, asks for the missing model |
| Denafrips Ares II, **Rega Elex Mk4**, **Spendor A7** | assessed with amp mislabelled / bare | **clarifies** — "I recognised Ares Ii, but I couldn't confidently match Spendor, Rega to specific models. Could you confirm the exact make and model of those?" |

## Clarification copy (verbatim, live)
- Dropped: "So far I can place these N: {understood}. It looks like {k} more component(s) … Could you give me the exact make and model number of {that one/those}? Then I'll assess the whole system."
- Bare-brand models: "I recognised {known}, but I couldn't confidently match {uncertain} to specific models. Could you confirm the exact make and model of {that one/those}? Then I'll assess the whole system."
- Duplicate: "I want to be sure I have your system right — I read {list}, but one component may have been counted twice. Could you confirm each component's exact make and model?"

## Control results (must NOT over-block) — all pass
- Fully cataloged (Chord Qutest / Naim SN3 / Harbeth SHL5+) → **assesses**.
- One uncatalogued model, intact graph (Bluesound / Hegel / KEF LS50 Meta) → **assesses**.
- Labelled accessory does not inflate the count (…, speaker cables: Canare) → **assesses**.
- Duplicate user wording (Naim SN3, Naim SN3, KEF) → **assesses**.
- Genuinely ambiguous role → still clarifies (pre-existing role-conflict check).
- Speaker-cable case remains fixed (Canare not a component) → **assesses**.

## False-positive clarifications found and fixed during verification
1. **Slash model names** — the segment counter split "DeVore O/96" / "Spendor
   SP3/1R" on "/", over-counting and falsely reporting a dropped component
   (this blocked the canonical Leben CS600X + DeVore O/96). Fixed: "/" is no
   longer a separator.
2. **Brand-profile components mis-flagged as unresolved** — an earlier draft
   counted any component lacking a catalog `product` as unresolved, which
   flagged correctly-identified brand-profile units (Leben CS600X, DeVore
   O/96). Fixed: only BARE-brand (no model token) components count.
3. **Spurious bare-brand echo** — "Crayon" beside cataloged "Crayon Audio
   CIA-1T" tripped the duplicate rule. Fixed: bare echoes of a cataloged
   component are de-duped to the cataloged entry, not clarified.

## Tests added
`graph-integrity.test.ts` — 13 cases: the three known failures clarify; the
clarification names what's understood and never asks for a full re-entry; eight
controls assess (incl. slash models and the Crayon echo); a genuine two-bare
duplicate clarifies.

## Full suite results
- New graph-integrity test: 13/13.
- Engine regression gate: **3856 pass, 0 regressions** vs trusted baseline.
- Product suite: 84/84.

## Note on coverage (not a blocker)
Some real but under-catalogued systems (e.g. EMT JPA 66 + Shindo Monbrison,
Naim Uniti Atom + ProAc DB1) now clarify rather than assess — the intended
safety trade. Targeted catalog additions (logged to POST_LAUNCH as usability,
not the architectural remedy) will let common systems assess again without
weakening the gate.

## Revised Gate 6 recommendation: **PASS**
No assessment is produced from an incomplete, dropped, duplicated, or
mis-bound graph; untrusted graphs get a specific, honest clarification.
Open S0: 0. Open S1: 0. Launch confidence: recovering.
