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

(none yet)
