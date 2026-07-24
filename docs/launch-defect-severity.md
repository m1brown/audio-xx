# Audio XX — Defect Severity & Launch Criteria

## Severity definitions

**S0 — release-blocking.** The launch does not proceed with an open S0.
- Money wrong: charged incorrectly, paid access lost, unpaid access granted.
- Data wrong: user content lost, corrupted, or visible to another user.
- Security: any cross-user access, secret exposure, unsigned webhook
  accepted, stored XSS, open redirect.
- Privacy: private names/notes/free-text in analytics, unfurls, or any
  public surface.
- Trust: factually wrong component identification, contradictory
  verdict, or any output the founder calls embarrassing (Gate 10 gives
  the founder unilateral S0 authority).
- Dead end: a core journey (assess, share, save, subscribe, cancel)
  that cannot be completed or recovered.

**S1 — should-fix-before-public-launch.** Degrades trust or polish but
does not make the product wrong. Examples: awkward copy on a visible
state, layout blemish on a core screen, missing segmentation prop, slow
but functional page. S1s are triaged at Gate 11: each is either fixed
during the beta window or explicitly accepted for launch with rationale.
**S1s never block production activation or beta entry.**

**S2 — post-launch backlog.** Cosmetic, rare-path, or enhancement-class.
Logged with enough context to act on later; no launch bearing.

Classification rule of thumb: *would a paying stranger be harmed,
misled, or blocked?* → S0. *Would they notice and think less of us?* →
S1. *Would only we notice?* → S2.

## Launch-blocking criteria

Launch (production activation) is blocked while ANY of:
- an open S0 exists anywhere;
- engine gate or product suite is red on the certification commit;
- the founder has not completed the Stripe test-mode walkthrough;
- the Stripe live account is unverified, or the tax decision is unmade;
- the runbook's backup + smoke steps have not been executed at the gate.

Explicitly NOT launch-blocking: open S1s (dispositioned), S2 backlog,
deferred roadmap items (OG images, pretty links, diffs, password reset).

## Certification completion criteria

Certification is complete when:
1. all 11 gates have signed reports in `certification/`;
2. matrix rows all ✅ or ❌-with-severity, and S0 count is zero;
3. suites green on the final certification commit;
4. the G11 triage table dispositions every S1;
5. test data swept; production data verified untouched.

## Private-beta entry criteria

Beta invitations go out when:
- certification is complete (above);
- production activation has occurred and live smoke tests passed;
- Sentry and the analytics dashboard are confirmed working in
  production (founder-verified);
- the feedback path (Report issue) is tested end-to-end;
- an invite list and a one-paragraph invitation exist;
- the pause-checkout kill switch has been read and understood by the
  founder (not rehearsed against prod).

## Production activation point (restated)

After certification completion + founder walkthrough + live-account
verification + founder tax decision — and before private beta. Exact
runbook: `docs/launch-runbook.md`. S1 cleanup continues during beta;
it does not gate activation.
