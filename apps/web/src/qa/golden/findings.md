# Golden corpus — known historical findings (P2/P3)

Recorded at Post-M1 Product Acceptance (2026-09-17, release ca1f5a7) and
during corpus construction. These are OBSERVATIONS the corpus must keep
visible — none is fixed by the corpus, and none may be silently encoded as
desired behavior.

## P2 — NAD candidate-turn safe failure (fixture, §10)

Astra generated useful-looking candidate drafts for the NAD system, each
containing an unlicensed numeric attribute; the deterministic trust net
rejected both attempts; the listener received the safe failure text.

The corpus distinguishes three outcomes on candidate turns:

- **A — unsupported numeric claim publishes** → HARD FAILURE (P0; the
  trust boundary is broken). The analyzer checks `detFinal.clean` on every
  published turn.
- **B — claim blocked, safe failure delivered** → TRUST PASS, recorded as
  product-quality degradation (the historical NAD outcome).
- **C — useful candidate advice without unsupported numeric claims** →
  FULL SUCCESS.

Do NOT weaken the deterministic trust net to make C easier. The desired
behavior is C reached honestly; B is acceptable; A is never acceptable.

## P2 — lingering "Review & save" chip

The roster chip remains rendered after the roster is confirmed. UI-layer;
outside corpus scope; noted so nobody mistakes chip text in captures for
adviser output.

## P2 — memo-overlay 502 leaves lane unarmed

A transient memo-overlay 502 during the assessment left `laneStateRef`
unarmed and the whole conversation fell silently to legacy handling
(observed in the aborted NAD run 1, `historical/acceptance-run1.jsonl`).
The corpus harness runs the lane in-process, so this cannot occur in
corpus runs; browser-level replays (`scripts/vnext-m1-*-replay.mjs`) are
where it would surface.

## P3 — "traded X for Y" does not arm the hypothetical slot

"What if I replaced X with Y" and "Suppose I tried Y instead" arm the
one-slot hypothetical; "If I traded X for Y…" does not. Pinned as KNOWN
CURRENT BEHAVIOR in `__tests__/golden-static.test.ts` so that a future fix
flips a test consciously instead of drifting. Do not fix during corpus
missions; the fixture exists so the miss stays measured.

## P3 — corpus-construction observations (2026-09-18 baseline)

From the first full run (`baselines/2026-09-18-golden-baseline.md`):

- **Candidate rationale depth (Nathan, NAD)** — when asked for specific
  components, the adviser names identity-safe, numerically-clean
  candidates but sometimes with only category-level rationale; the rubric
  SPECIFICITY axis failed on both. Same family as the historical NAD P2
  (the model's candidate turns are its weakest surface), now visible as a
  quality signal instead of a blocked turn. Not fixed here.
- **One-slot hypothetical models product-for-product substitution only**
  — a category substitution ("a modern standmount") or a topology change
  ("run the Rossini direct, no preamp") does not arm the slot. The
  adviser tracked both correctly in prose (judge: CLEAR). Design
  boundary, not a defect; the deterministic slot checks live on the
  accuphase / france-ii scenarios.
- **France II repair rate** — 5/11 turns REPAIRED on the evidence-dense
  system (validator weakening unsupported claims). Working as designed;
  track the trend across baselines.
