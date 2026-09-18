# Golden System Conversations — historical provenance

These artifacts are the accepted output of:

    AUDIO XX — POST-M1 PRODUCT ACCEPTANCE
    verdict: M1 PRODUCT CONDITIONALLY ACCEPTED

| field       | value |
| ----------- | ----- |
| release     | `ca1f5a7` (production at time of acceptance) |
| generation  | `gpt-6-astra` (`REASONING_LANE_MODEL`) |
| validator   | `gpt-4o` (`REASONING_VALIDATOR_MODEL`) |
| date        | 2026-09-17 |
| surface     | real conversation UI, local production build, production lane semantics |
| systems     | France II · Nathan · NAD · Accuphase |
| turns       | 33 lane turns: 30 CHECKED · 2 REPAIRED · 1 retry-recovery · 1 safe failure (NAD candidates turn) |

## Files

- `acceptance-transcripts.md` — the complete user-visible transcripts
  (68k chars). Sections: SYSTEM A — FRANCE II, B — NATHAN, C — NAD,
  D — ACCUPHASE; per-turn status lines carry the publication telemetry.
- `acceptance.jsonl` — structured per-turn harness telemetry of the
  accepted run (model/vmodel observability, statuses, roster and
  hypothetical traces).
- `acceptance-run1.jsonl` — the aborted first NAD run (memo-overlay 502
  derail + driver race), retained because its failure mode is a recorded
  P2, not because its conversations are exemplars.

## Standing

These transcripts are REFERENCE EXAMPLES OF GOOD BEHAVIOR, not expected
string output. A future model may use different words, reach a different
appropriately-supported recommendation, or ask a different question and
still be excellent. No test may assert equality against this text. The
judge receives them as exemplars only.

Known findings recorded at acceptance (see `../findings.md`):
- P2 — NAD candidates turn: two useful candidate drafts each carried an
  unlicensed numeric attribute; the deterministic trust net rejected
  both; the listener received the safe failure. Trust PASS,
  product-quality degradation.
- P2 — lingering "Review & save" chip after roster confirmation.
- P2 — memo-overlay 502 leaves the lane unarmed → silent legacy for the
  rest of the conversation.
- P3 — "traded X for Y" phrasing does not arm the hypothetical slot.
