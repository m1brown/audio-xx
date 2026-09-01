# Mission 4 — Trust Disclosure + Stateful Clarification Integrity (2026-08-10)

Scope split: the affiliate-disclosure correction and the conversational
trust-question gate (§1–2 of the mission) run in the founder-started
separate session (`task_dc41e463`, own worktree); this record covers the
stateful-clarification root repair (§3) and the five severe re-probes (§4).
Production at mission end: **`audio-xx-bghx5ajx1`**. All fixes measured
live first, pinned by tests, full suite at the 20-failure baseline
throughout, cross-brand harness 11/11 where triggered.

## §3 Stateful clarification — root cause and repair

**Mechanism mapped.** Clarification questions were dispatched via
`ADD_QUESTION` with no pending state: the conversation state machine's
mode/stage/facts continuity exists, but the A2 system-components ask, the
legacy clarify_system ask, the churn reflective question, and the
assessment path's partial-recognition ask all bypassed it. The answering
turn re-entered `handleSubmit` cold and was classified on the answer text
alone. Live reproduction (h9b4qckpc): "is my system balanced" +
uncatalogued chain → components ask → component answer → *"let's figure
out what's going on with your amplifier. Is it distorting, running
hot…"* — an invented problem.

**Repair (three commits).**
1. `pendingClarificationRef` armed at every system-components /
   churn-reflection ask; the next turn is reunited —
   `${answer}. ${originalRequest}` — before extraction and routing
   (verified: reunited text routes to `system_assessment`; the answer
   alone routed to `gear_inquiry`). Pivot guard: answers that classify as
   standalone requests (shopping, comparison…) are honoured un-reunited.
   Gate 1b-judgment: judgment phrasings + ≥2 named components =
   assessment request; bare judgment prompts keep the components ask.
2. The assessment partial-recognition ask arms the same state; a re-ask
   cap (`consumedClarificationRef`) detects ask→answer→ask-again on
   uncatalogued gear and proceeds with the **provisional whole-system
   assessment** (existing low-confidence machinery) instead of looping.
3. "Start over" clears both refs.

**Live-verified end-to-end** (da4vzcc0p → bghx5ajx1): judgment → ask →
component answer → *"RECOGNISED ✓ Bluesound NODE ✓ Klipsch"* → provisional
assessment under **EXPANDED REASONING** ("parts of this system are not
fully recognized"), reasoning about the actual Feliks Envy (hedged:
"is expected to", "probably") and the Cornwall IV as itself. No invented
problem, no repeat question, no brand-level all-clear.

**Required behaviors:** answer populates system context ✅ · same
clarification not repeated ✅ · no invented problem on terse answers ✅ ·
corrections applied — **partially**: the F2 correction leg's root is
upstream of turn state. `detectSystemDescription` returns null for
partially-catalogued prose chains ("chord qutest into a naim nait 50 with
kef ls50 meta" — 4 subjects extracted, no system object), so no durable
system exists for a correction to apply to. Parked as an extraction-
coverage item (catalog/extraction work), not re-litigated as state.

**Regression coverage:** `stateful-clarification-reunite.test.ts` (12) —
reunite composition for all A2-family prompts + the uncatalogued case,
churn-answer symptom carry, pivot-guard inputs, chain-segment routing.

## §4 Five severe re-probes (each fresh-thread, settled production output)

| # | Finding | Verdict |
|---|---|---|
| 1 | Cornwall IV → Heresy IV substitution | **Reproduced, root-caused, FIXED, live-verified.** The assessment chain gate counted resolved subjects; "feliks audio envy + klipsch cornwall iv" resolves only the brand "klipsch", so the brand-consultation path served Klipsch's representative product. Chain-SEGMENT counting routes these into the assessment machinery. Live on bghx5ajx1: no Heresy anywhere; the response reasons about the actual Envy + Cornwall IV pairing. |
| 2 | Brand-level all-clear | **Fixed for the clarification path** (provisional assessment with disclosed unknowns instead of an all-clear); the resolution-level licensing rule for fully-"resolved" brand-level components in direct assessments (harbeth 30.2 → "Harbeth" + "Nothing here needs changing") remains a **product decision** — D-8 scope-narrowing at render time. Parked for founder. |
| 3 | Symptom echo / mangled chain / source re-ask | **Two of three FIXED, live-verified**: brand/product dedup ("With Qutest + KEF + Naim", Chord duplicate gone) and no source re-ask when a source-category product is named (habits question replaces it — existing approved copy; the lock test that pinned the old re-ask was updated with justification: it demanded the source ask for an input naming "my denafrips dac"). The tendencies-echo line in the muddy variant ("your system leans warm and dense" from complaint words) is advisory-copy design — parked. |
| 4 | Warmth request → non-warm primary | **Root FIXED**: "warmer sounding please" extracted ZERO signal — comparative forms were absent from the normalization table. Explicit comparative→base map added ('warmer'→'warm' etc., 21 forms, not stemming); the refinement now extracts tonal_density↑ and a flow-oriented pick enters the set. Anchor-preference weighting (warm direction present but not primary) is recommendation-engine scoring — **parked per the no-rewrite instruction** with the data-layer reproduction recorded. |
| 5 | ~$15k desk amp on contradictory constraints | **Decontaminated and decomposed.** The original probe ran in a worn thread (past the clarification cap) with a phantom system (since fixed). Fresh-thread re-probe: phantom gone; the $15k-first ranking persists because `detectShoppingIntent` marks the query `detected: false` → exploratory mode → clarifications (incl. budget ask) bypassed by design → price-blind ranking leads with the catalog's Class A flagship. Default-tier policy for exploratory mode and the thermal/power constraint vocabulary are **product decisions — parked** with a concrete recommendation: cap exploratory primaries at a modest default tier or ask budget first. |

## Measurement-artifact notes (not defects)

- The browser pane's synthetic input intermittently fails to reach React
  onChange after rendered turns; a React-fiber probe confirmed healthy app
  state each time. Live verification used fresh-load/post-reset submits
  (reliable) and data-layer replication (`npx tsx -e`) per the CLAUDE.md
  flake rule.
- The cross-brand Playwright harness runs headed; the environment closed
  its window twice. A temporary headless config override (not committed)
  produced a clean 11/11 zero-leak run.
- Full-suite runs mutate `audit-2026-07-19/launch-qa-final/*` artifacts;
  restored via git checkout each time.

## Mission 4B — independent production stress sweep (while task_dc41e463 runs)

Constraint honored: no disclosure/trust/privacy surfaces touched.
Production at sweep end: **`audio-xx-80fkjpwvn`**.

**Repairs (3, each gated + deployed + live-replayed):**
1. **Judgment requests are not hijacked into component troubleshooting** —
   "my system: shiit modius dac, luxmann l-505z, wharfdale linton — how
   does it hang together?" (3 misspellings) was answered with "let's
   figure out what's going on with your DAC". `SYSTEM_JUDGMENT_REQUEST`
   now gates the troubleshooting map; genuine complaints keep it (pinned).
2. **Verdict challenges are assessment follow-ups** — "are you sure? it
   feels like you say that to everyone" after "Nothing here needs
   changing" got a generic knowledge-lane meta-essay. Challenge phrasings
   now take the assessment-continuity path; live replay answers from the
   assessment ("Honestly — nothing… No single component is holding the
   others back"). Component additions still accumulate (pinned).
3. **Synergy judgments are assessment language with components** — "how
   does it hang together?" wasn't judgment language, so the reunited turn
   dead-ended in symptom hunting. Added to the subjects-gated judgment
   gate. Live full loop: misspelled chain → partial-recognition ask
   ("✓ Linton Heritage ✓ Schiit Modius E … one component I couldn't
   match") → answer → provisional review under EXPANDED REASONING.

**Verified clean:** commerce link↔pick integrity (Amazon/eBay/HiFiShark
search terms exactly match all picks; no wrong-brand substitution; no
phantom cards) · "no tubes" + budget honored on the shortlist ·
terse-answer clarification flows (state repair) · Start-over isolation.

**New parked items:**
- **P-4B1 (invariant violation, architectural)** — mid-session constraint
  retraction ("actually forget the no-tubes rule — what would you pick
  then?") was answered with "What's your budget?" — the $2000 stated two
  turns earlier forgotten. Data-layer replay proves the conversation
  state machine handles the same sequence CORRECTLY; the live failure is
  the page-level split: the pipeline's shopping memory
  (`lastShoppingFactsRef`) and the state machine's facts are parallel
  stores that never share. This is the known "two parallel flows /
  budget handling" Beta Learning item, upgraded with an
  invariant-violation reproduction ("budget persists unless explicitly
  changed"). Unifying fact ownership is a design decision — founder call.
- **P-4B2** — form-factor facet: "bookshelf speakers around $1500"
  returned a floorstanding panel (Magnepan .7); selection has no
  form-factor filter. Catalog/engine facet work.
- **P-4B3** — dealer-only brands render "Buy new → Amazon" search links
  (Magnepan entries carry no `buyingContext`); catalog data fix requires
  founder approval per the no-autonomous-catalog-edits rule.

**Coverage note:** long multi-turn threads (8–15 turns) were only
partially exercised — the browser pane's synthetic-input limitation
constrains deep threads (native form_input + JS-click hybrid works but
the pane's accessibility tree intermittently returns empty). The covered
legs (assessment→challenge→follow-up, shopping→refine→pivot,
ask→answer→ask→answer chains of 3–4 turns) behaved consistently post-fix.
Deeper thread soak belongs to real-user beta traffic.

## Saturation assessment — deferred to the final report

Pending the disclosure session's landing (task_dc41e463): disclosure
accuracy live + conversational trust answers. The saturation verdict and
final synthetic-hardening report follow its integration.
