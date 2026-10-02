# Human Beta — Findings Ledger

Observations from real beta users. Record everything; fix almost
nothing (Beta Stewardship Doctrine v2: reproduce → explain → classify →
smallest principled fix → wait for approval; P0/P1 stop-and-report,
P2/P3 recorded here and in the P2 pattern ledger).

The beta exists to answer product questions, not engineering metrics:
**Understanding** (did it get the system and the question right?) ·
**Trust** (does the user see why a claim is made and its evidence?) ·
**Conversation** (do they keep talking, or revert to isolated
prompts?) · **Judgment** (real problem vs. upgrade pressure?) ·
**Context** (system, hypotheticals, observations, corrections
remembered?) · **Usefulness** (did it help a decision?) ·
**Differentiation** (better than asking a generic AI?) ·
**Return intent**.

No numerical thresholds yet — first beta generates observations.

## Finding template

```
### YYYY-MM-DD — <short title>
- user: <email or agreed identifier>
- system: <components>
- turn/advisory: <advisory id from feedback row, if any>
- attempted: <what the user tried, their words where possible>
- observed: <what Audio XX did>
- reaction: <what the user said/felt>
- class: bug | ux | reasoning | evidence | identity | feature-request | unknown
- severity: P0 | P1 | P2 | P3
- reproducible: yes | no | untried
- sha: <from /api/version or the feedback row>
- disposition: recorded | escalated | fixed(<commit>) | wontfix(<why>)
```

## Known going in (founder-accepted, 2026-10-02 — observations to watch, not tasks)

These are pre-beta conditions accepted at the `fc62c09` baseline. They are
recorded so real-user signal lands against them; neither is current
engineering work.

### K-1 — Conversation persistence
Saved systems and assessment artifacts persist; conversations do not
survive a reload. Acceptable for first beta. **Watch:** do real users
naturally expect conversational continuity (reopening the site and
resuming), or does save-system + artifact cover their mental model?
Record every instance where a user is surprised by a fresh conversation.

### K-2 — Observability window
Vercel turn-level logs are short-lived (hours). **Operating rule:** review
feedback rows + lane logs + Sentry the SAME DAY as each beta session
(runbook §3/§5). Do not build additional observability unless actual beta
experience shows we need it.

## Findings

### 2026-10-02 — F-1 · One-authority integration passes first real use
- user: brownmike@gmail.com · sha fc62c09
- system: dCS Rossini Apex / Audio Research Reference 5 / Butler Monads / Acora QRC-2
- attempted: initial assessment + "anything seem off?" follow-up
- observed: fact → relationship → implication → boundary-of-knowledge
  reasoning; no manufactured weak link; gain structure identified as the
  concrete setup item; "I wouldn't change anything just from this list."
- reaction: founder — "that response is a pass."
- class: (positive observation) · severity: — · disposition: recorded
- runtime: assessment REPAIRED 2→2 det-clean 20.6s; follow-up turns
  CHECKED/REPAIRED, all published, 0 fallbacks (lane logs captured same-day)

### 2026-10-02 — F-2 · Excessive epistemic restraint on France II
- user: brownmike@gmail.com · sha fc62c09
- system: Eversolo DMP-A6 / Chord Hugo / JOB INTegrated / WLM Diva Monitor
- attempted: initial assessment
- observed: correct but compatibility-heavy — amplifier adequacy +
  conversion-path determination dominated; less system insight than the
  US assessment, which proves bounded positive inference is possible
  within existing doctrine.
- class: reasoning (product/reasoning finding, NOT a bug)
- severity: P2 · reproducible: likely · disposition: recorded — the open
  question is "say everything the evidence licenses," never loosening
  evidence standards. Await more sessions before any change.

### 2026-10-02 — F-3 · Brand-only candidate turn is generic — DIAGNOSED: evidence routing, not reasoning policy
- user: brownmike@gmail.com · sha fc62c09 · turn ~15:38 UTC+2 (mode=turn CHECKED cand=3)
- attempted: "how would goldmund amps pair?" (US system active)
- observed: safe but generic — model-matters / check-impedance / audition.
- DIAGNOSIS (read-only reproduction of the context assembly): for this
  question the candidate detector yields exactly one candidate,
  `goldmund`, resolution AMBIGUOUS, **0 evidence items**. The entire
  Goldmund content of the governed context is two lines:
  `## Candidate …: goldmund` + `[IDENTITY — AMBIGUOUS] "goldmund" names
  a brand, not a model…`. No Goldmund brand/manufacturer evidence and no
  JOB↔Goldmund relationship reached the lane (that relationship lives in
  catalog/legacy layers the candidate retriever does not read, and the
  JOB system evidence wasn't in context — JOB isn't in this system).
  Given that substrate, the generic answer is close to the best licensed
  answer: **cause B (evidence retrieval/utilization), not cause A
  (restraint policy)**.
- PREDICTION for the §8 A/B: a specific model will NOT help much —
  probing "Goldmund Telos 300" yields resolution UNKNOWN, 0 items ("no
  catalog or evidence identity held"). The substrate holds no Goldmund
  product or evidence rows at all; only the B2 bounded-knowledge licence
  (model knowledge-as-knowledge, hedged) could enrich the answer, and
  the [IDENTITY — UNKNOWN] marking steers composition away from it.
- class: evidence (acquisition/coverage + candidate-retrieval scope)
- severity: P2 · disposition: recorded — awaiting founder's
  specific-model experiment; no retrieval or prompt changes made.

### 2026-10-02 — F-4 · Data-quality: role labels + merged condition/value facts
- user: brownmike@gmail.com · sha fc62c09 · system: US reference system
- observed: (a) Reference 5 card shows role `amplifier` (should read as
  preamplifier/linestage); Butler Monads and Acora QRC-2 show `other`
  (should read power amplifier / speaker). Root-cause note: with an
  unlabelled comma roster, roles type only from catalog identity or
  stated labels; Butler/Acora are not ALL_PRODUCTS rows, so `other` is
  the extraction's honest ignorance (known limitation, 2026-09-20) — but
  the DISPLAY reads as wrong metadata rather than honest absence.
  (b) Reference 5 facts merge balanced/single-ended into one row
  ("output impedance, balanced; 300 ohms single-ended" above "600 ohms";
  same for input impedance 60K/120K) — same class as the repaired
  Rossini row; likely eventual treatment is separate per-condition
  facts. (c) Reference 5 frequency-response row embeds the Ref 5 vs
  Ref 5 SE variant distinction in its label — audit eventually.
- class: evidence/data-quality + ux · severity: P2 · disposition:
  recorded, NOT implemented (founder: wait).

### 2026-10-02 — F-5 · Sound graph vs. stated uncertainty (K-debt observed in anger)
- user: brownmike@gmail.com · sha fc62c09 · system: France II
- observed: seven-axis graph renders above prose that says tonal balance
  is not established — the finished experience makes the mismatch more
  noticeable. Known limitation (documented at the render site,
  2026-09-21). Watch whether other beta users perceive it or find the
  graph useful regardless.
- class: ux/evidence · severity: P3 · disposition: recorded — observe.
