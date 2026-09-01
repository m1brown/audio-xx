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

## Private-beta EXIT criteria (beta → soft launch)

The beta is a bounded phase, not a resting state. Target window:
**2–3 weeks**. Soft launch proceeds when ALL of the following are met
(numbers are founder-refinable at beta start; the criteria themselves
are fixed):

1. **Participation:** ≥ 15 invitees; ≥ 10 distinct people ran at least
   one assessment.
2. **Completion:** ≥ 80% of started assessments rendered successfully
   (measured `assessment_rendered` / entry events; zero
   `assessment_failed` on inputs a reasonable person would call valid).
3. **Return:** ≥ 3 users came back on a later day (repeat
   `my_systems_viewed` or a second assessment session).
4. **Saves:** ≥ 5 users created an account and saved a system.
5. **Defects:** zero open S0; every beta-reported issue triaged within
   48h; no untriaged reports outstanding.
6. **Billing:** the live billing path verified working (founder's own
   live-mode subscribe + cancel per the runbook smoke test — beta users
   are inside the free trial, so real subscriber conversion is NOT an
   exit criterion).
7. **Analytics:** the funnel is readable end-to-end in the dashboard
   for the beta cohort; no missing stages.
8. **Monitoring:** Sentry captured and surfaced every production error
   that occurred; none discovered only via user report.
9. **Founder approval:** explicit written go for soft launch.

If the window closes with criteria unmet, the outcome is a decision,
not drift: either fix the named blockers and re-run the window, or the
founder explicitly revises the criteria in writing. Remaining in beta
by default is not an option.

## Production activation point (restated)

After certification completion + founder walkthrough + live-account
verification + founder tax decision — and before private beta. Exact
runbook: `docs/launch-runbook.md`. S1 cleanup continues during beta;
it does not gate activation.
