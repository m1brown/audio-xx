# Gate 7 — Edge Cases & Destructive Testing · Report

Date: 2026-07-25 · Baseline: 0ca67a6 (+ this gate's fix) · Method: destructive
engine-input harness (20 hostile/clumsy inputs), live API fuzz (malformed /
wrong-type / oversized bodies across 7 body-parsing routes), XSS render-path
inspection, and code-verification of the data-safety journeys.

## Recommendation: **PASS WITH MINOR ISSUES**

The central question — *does Audio XX fail honestly, recoverably, and without
corrupting the user's system or producing false authority?* — is answered yes.
One S1 (two routes 500'd on malformed JSON) found, fixed, and regression-pinned.
No data corruption, no stored XSS, no false authority, no stranding 500 on a
customer path.

## Destructive engine inputs (20 cases) — 0 throws
Every input classified honestly; **nothing crashed, nothing fabricated
authority, no graph corruption**. Evidence: engine-destructive.txt.

| Class | Inputs | Outcome |
|---|---|---|
| Correct safety clarification | conflicting role (speaker labelled DAC); two systems pasted; punctuation-heavy; slash/roman/acronym-heavy; script-injection token | CLARIFY — graph untrusted, asks rather than assesses |
| No false authority | all-unknown brands; partial description; "a"/"hi"; malformed labels; empty colon; repeated-x5 (dedup→1) | NULL (no assessment) — never invents a reading of made-up gear |
| Valid edge formats assess | accessories-mixed-with-core; emoji+text; RTL+mixed; newline-separated; arrow chain | ASSESS (core components, accessories stripped) |
| Scale/DoS | 1000 comma tokens; 50 000-char single token | NULL, fast, no hang |

Notable: accessories-mixed (speaker cables + power cord + interconnects
alongside 3 core components) correctly assesses the 3 core and strips all
accessories; two-systems-pasted correctly clarifies rather than blending two
systems into one false reading.

## Data-safety checks

**G1 — Stored XSS: PASS by construction.** `dangerouslySetInnerHTML` appears
**0 times** in the entire app; all user content (names, notes, system text,
`?system=` param) renders through React's default escaping. `?system=<script>`
returns 200 with the tag inert.

**G2 — API fuzz: 1 defect found + fixed.** Malformed / null / array / wrong-type
/ oversized bodies across `events, orchestrator, evaluate, compare, diagnose,
memo-overlay, listing-eval`:
- `events` → 204 (fire-and-forget, never throws), `orchestrator/diagnose/
  listing-eval` → 400, auth-required routes → 401/405 before parsing, webhook →
  400 on bad signature. All safe.
- **G7-D1 (S1, FIXED):** `/api/evaluate` and `/api/memo-overlay` returned **500**
  on malformed JSON (and on `null`, which is valid JSON that then throws on
  destructure). Both now guard the parse (`req.json().catch(() => null)` + a
  non-object check) → **400** for every malformed/wrong-type body. Pinned by
  `api/__tests__/malformed-body.test.ts` (12 cases). Evidence: api-fuzz.txt.

**G3 — Double-submit → one system: PASS** (suite-pinned — the M3 identical-
reassessment + idempotency tests in save-system.test.ts; 84/84).

**G4 — Stale link to a removed system → graceful not-found: PASS** (the
`/systems/[id]` route calls `notFound()` when the row isn't owned/found;
cross-user + not-found behaviour verified in Gate 4).

**G5 — Back/forward through checkout leaves consistent state: PASS
(code-verified).** Checkout return is a server-verified `?session_id` sync plus
a calm `?checkout=cancelled` notice; re-navigating only re-reads entitlement
status — no client-trusted state, no duplicate-charge path (idempotent webhook,
Gate 2).

**G6 — Session expiry mid-action → clean re-auth, no data loss: PASS
(code-verified).** Every write route returns 401 when `getUserId()` is null; the
client routes to sign-in. Nothing is written on the expired attempt, so no
partial/corrupt state.

## Findings by class (founder taxonomy)
- Correct safety clarification: 5 engine cases (all justified).
- Unnecessary false-positive clarification: **none observed**.
- Dead end: **none** (no-assessment inputs route to the clarify/question path;
  Gate 1 verified no empty screens).
- Corrupted graph: **none**.
- Incorrect assessment: **none**.
- Recoverable presentation issue: n/a.
- **Honest-failure defect: 1** (G7-D1, malformed-body 500 → fixed to 400).

## Defects
| ID | Sev | Finding | Status |
|---|---|---|---|
| G7-D1 | S1 | `/api/evaluate` + `/api/memo-overlay` returned 500 on malformed/null JSON | **FIXED** (guarded parse) + pinned (12 tests) |

Zero S0. One S1 (fixed).

## Cleanup
No DB artifacts created (auth-required routes rejected pre-write; `events` only
logs; fuzz bodies never persisted).

## Automated results
- Destructive engine harness: 20/20 honest, 0 throws.
- API fuzz: all 4xx, 0 remaining 5xx on customer routes.
- New `malformed-body.test.ts`: 12/12.
- Engine regression gate: **3881 pass, 0 regressions**.
- Product suite: 84/84.

## Estimated effort
Harness + fuzz 1.5 · analysis 0.5 · fix + pin 0.5 · documentation 0.5 · **~3h**.

## Launch confidence
**Increasing.** Boundaries hold: no crash, no data corruption, no stored XSS, no
false authority on hostile input, and the graph-integrity gate (Gate 6)
generalises correctly to malformed/conflicting/multi-system inputs. The single
defect was a trivial honest-failure gap (500→400), fixed and pinned.

## Sign-off criterion
Fuzz log clean of 5xx on customer routes; no S0; destructive inputs fail
honestly and recoverably. **PASS WITH MINOR ISSUES. Awaiting founder sign-off.
Do not begin Gate 8 without approval.**
