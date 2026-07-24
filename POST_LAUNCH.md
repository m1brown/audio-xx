# Audio XX — Post-Launch Backlog

Intake for everything the **launch freeze** excludes. The freeze is in
effect from Gate 1 until soft launch is complete, unless the founder
explicitly lifts it.

**Permitted during the freeze:** launch-blocking defects (S0),
regressions, copy fixes, accessibility fixes, performance fixes,
security fixes. **Everything else lands here** — new features,
architecture changes, redesign, refactoring, S2 defects, and deferred
S1s with their Gate 11 disposition.

Entry format: one line — `[source] description — why deferred`. Keep it
scannable; expand only when the item is picked up.

## Deferred by design (pre-freeze roadmap items)

- [roadmap] Generated per-assessment OG images — text unfurl ships first
- [roadmap] Pretty share links (`/a/<id>`) — query-string links work
- [roadmap] Reading-to-reading diff view in history — explicit M-brief exclusion
- [roadmap] Password reset — needs an email service
- [roadmap] External-image data repair — client-side degradation covers it
- [m5] Renewal-failure (`past_due`) end-to-end via Stripe test clocks — entitlement behavior covered by unit + DB tests
- [stripe] $5/month backup price — founder declined speculative price creation

## Deferred during certification

(Gate reports append here.)
