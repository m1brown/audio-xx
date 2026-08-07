# LB-6 — In-product feedback capture, production certification

**Blocker:** LB-6 — Feedback capture mounted and receiving
**Captured:** 2026-08-07T09:59:29Z
**Recorded by:** Claude (Launch Mission 3)

## Deployment under test

| Field | Value |
|---|---|
| Production deployment | `audio-xx-pkcq95k3x-m1browns-projects.vercel.app` |
| Commit | `d3092c1` |
| Promoted from | Preview `audio-xx-g14sczcq6` (branch alias `audio-xx-web-git-version-b`) |
| Promotion window (UTC) | 2026-08-07T09:55:22Z → 09:58:06Z (3m) |
| Alias | audio-xx.com ✅ |
| Previous production | `audio-xx-2za4u99sn` (`4cb19df`) |

## Pass condition

> One `[AXX-EVENT]` line with `"event":"feedback_submitted"` appears, carrying the answers
> given. **Present or absent.**

**Result: PASS.**

## Production evidence

Assessment delivered, then feedback submitted on audio-xx.com. Both events, from the
production log stream:

```
[AXX-EVENT] {"event":"assessment_completed","props":{"id":"772fe434-fa7b-4a32-accf-017b389956ce","components":3},"ts":1786096704896}

[AXX-EVENT] {"event":"feedback_submitted","props":{"advisoryId":"772fe434-fa7b-4a32-accf-017b389956ce","helped":"yes","accurate":"yes","wouldReturn":null,"hasComment":true,"comment":"LB-6 production certification probe"},"ts":1786096769447}
```

**The join works.** `feedback_submitted.props.advisoryId` is character-identical to
`assessment_completed.props.id` — `772fe434-fa7b-4a32-accf-017b389956ce` — 65 seconds apart.
A feedback item can be traced to the exact advisory that produced it, which is the whole
point of the binding.

Supporting production observations:

| Check | Result |
|---|---|
| Prompt renders beneath completed advisory | 1 block, `[aria-label="Feedback"]` |
| Prompt copy | "Did this help with your decision? / Did this describe your situation accurately? / Would you return for your next audio decision?" |
| `POST /api/events` | **204** (three calls; `net::ERR_ABORTED` is the expected artifact of `keepalive` fire-and-forget) |
| Post-submit state | "Thanks — your feedback helps us improve." |
| localStorage dedup keys | `axx_fb_772fe434-…`, `axx_fb_b5e8a3f8-…` — one per advisory, so a given answer is asked once |
| Second advisory | Rendered its own independent prompt (distinct id) |

## Gating verified

| Case | Prompt rendered | Correct? |
|---|---|---|
| Completed advisory (assessment) | 1 | ✅ |
| Second completed advisory | 1 (own id) | ✅ |
| Glossary term card (`kind: 'glossary'`) | 0 | ✅ — not an advisory |
| Page load, no advisory yet | 0 | ✅ |
| Intake turns | 0 by construction | ✅ — excluded in the render guard |

## Release gate

`4,151 passed · 20 baseline · 0 new.` Gates A, B, C, E PASS; C-visual/D DEFERRED
(explicitly accepted).

> **Note on a transient Gate E failure.** An earlier run reported `Gate E — Build` FAIL with
> `Cannot find module for page: /_document` at the prerender step, while compilation itself
> succeeded. Cause: the gate's `next build` ran concurrently with a local dev server, and both
> write `.next`. Re-run with the dev server stopped and `.next` cleared: **PASS**. Not a code
> defect — an orchestration error on the engineering side, recorded here so the log is not
> misread later.

## What changed

Two files. `page.tsx` imports `FeedbackPrompt` and renders it after `<AdvisoryMessage>` when
`message.advisory.kind !== 'intake'` and the message carries an id. Plus
`feedback-prompt-mount.test.ts`, pinning the mount and both gating rules — the original defect
was an *absence*, which no other test could see.

No new API, event type, schema, styling system or feedback feature. The `/api/events` sink
already allowlisted `feedback_submitted`.

## Verdict

**LB-6 CLOSED** on production evidence.
