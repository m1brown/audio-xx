# Parser Defect — Accessory field-labels misclassified as components

Found by founder during normal use; fixed within Gate 4 window.
Baseline: db6a947 (+ this fix). Correctness / trust defect.

## Report
Input:
```
Streamer: Eversolo DMP-A6
Amplifier: JOB Job Integrated
Speakers: WLM Diva Monitor
DAC: Chord Hugo
Speaker cables: Canare 4S11G Star Quad
```
The cable "Canare 4S11G Star **Quad**" was parsed as a second loudspeaker
(the token "Quad" matches the Quad brand), producing a false two-speaker
graph → a needless clarification, and — if the user proceeded — the
phantom "Quad" was resolved to Quad Electroacoustics and the assessment
fabricated "Classic Quad house sound / EL84 push-pull tube" content for a
component that does not exist. A corrupted signal chain, not a UX nit.

## Root cause
`extractSubjectMatches` (apps/web/src/lib/intent.ts) is the single
upstream matcher that both the assessment path and the save-prompt path
consume. It scans the whole message for known brand/product tokens with
word-boundary + claimed-range logic, and has **no field-label awareness**:
"STAR QUAD" contains the standalone token "quad", which is in the brand
list (mapped to `speaker`). The explicit "speaker cables:" label — which
should carry the highest classification prior — was ignored entirely.
There was no accessory/cable suppression anywhere in the matcher.

## Frequency (this is a class, not one product)
Any accessory whose product name contains a token that collides with a
known brand/product is affected — independent of which token collides:
- **Canare Star Quad** → Quad (the reported case)
- **Chord Company** speaker cables / interconnects → "Chord" (also an
  electronics/DAC brand — a common, high-impact collision)
- power cords / USB / Ethernet / HDMI / RCA / XLR cables whose names embed
  a brand or model token
Because the collision can be any token, per-token blocklists don't scale.
The correct fix keys on the **field label**, which covers the whole class.

## Fix (smallest safe correction — field-aware suppression)
In `extractSubjectMatches`, after matching, drop any match whose position
falls inside an accessory-labelled segment. An accessory label — "speaker
cables:", "interconnects:", "power cord:", "usb/ethernet/hdmi/rca/xlr
cable:", "cables:" — bounds a segment running to the next chain separator,
the next signal-path field label, or end of message. Field labels get the
highest prior, exactly as specified. Scope is deliberately limited to
*labelled* accessories; unlabelled-accessory detection needs catalog cable
knowledge and is intentionally out of scope (would broaden into NLP).

One localized change, one function, one file. Fixes both the assessment
and save-prompt paths at once (shared matcher). Does not touch the prose
engine.

## Field-aware before product-name parsing?
Yes — for *labelled* input, the field label must win. This fix implements
exactly that prior without a general re-architecture: a label suppresses
component classification within its own segment. Unlabelled accessory
recognition remains a separate, larger question (logged, not built).

## Clarification policy
The reported input is now deterministic — one streamer, one amp, one
speaker, one DAC, and a suppressed cable. No clarification fires because
the phantom second speaker no longer exists.

## Verification
- New focused test file `accessory-label-parsing.test.ts` — 5 tests:
  reported case drops Quad; real components preserved; generalises to
  interconnect/power/usb labels (incl. the Chord collision); bare
  "speakers:" still yields the speaker; and an **end-to-end
  component-graph** assertion (`detectSystemDescription`) proving exactly
  one speaker (WLM Diva) and zero "Quad" in the built system.
- Full engine regression gate: **3853 pass, 0 regressions** vs trusted
  baseline (was 3848 pre-fix; +5 new tests).
- Product suite: 84/84.
- Live browser confirmation attempted; the dev composer's React-controlled
  textarea did not fire the request under automation (known harness
  friction), so verification is the deterministic component-graph test,
  which exercises the exact path that produced the defect.

## Classification
Launch-impacting correctness/trust defect (a wrong signal chain makes the
whole assessment suspect). Fix is localized to classification logic, not
architecture. Corrected before private beta, per founder direction.
Severity: treat as S1 (should-fix-before-public-launch) — the trigger
requires an explicitly-labelled accessory line, but the failure corrupts
the core artifact when it occurs. Fixed same-day with regression tests.
