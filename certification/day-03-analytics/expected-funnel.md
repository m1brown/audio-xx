# Gate 3 — Expected Funnel Baseline (defined before testing)

Reconciliation of the founder's expected sequence against the canonical
event set (docs/analytics-events.md). The canonical names are the
authority; differences are deliberate and explained.

| Founder step | Founder name | Canonical event(s) | Why it differs |
|---|---|---|---|
| Landing | landing_view | `landing_viewed` | naming convention (past tense) |
| Start assessment | assessment_started | `builder_started` **or** `composer_started` | split by entry path — answers the launch question "builder vs composer" directly |
| Assessment rendered | assessment_completed | `assessment_rendered` `{source: builder\|composer\|direct, signed_in}` | one event, source-segmented; **composer emission added this gate (G3-D1)** |
| Copy link | assessment_copied | `copy_link_clicked` | naming |
| Print | assessment_printed | `print_clicked` | naming |
| Save | assessment_saved | `save_started` then exactly one outcome: `first_system_saved` / `additional_system_saved` / `assessment_added` / `identical_assessment_declined` | intent vs outcome split — answers "first-save vs returning" without user IDs |
| Boundary shown | subscription_prompt_shown | `subscription_prompt_viewed` `{state}` | naming + state segmentation |
| Checkout started | checkout_started | `checkout_started` | identical |
| Subscription completed | subscription_started | `subscription_activated` (server-side, webhook-driven) | fires on the verified webhook, not the client — cannot be spoofed or missed by tab-close |

Also canonical (no founder-table counterpart): `sign_in_completed`,
`account_created` (server), `my_systems_viewed`, `trial_action_blocked`,
`checkout_cancelled`, `subscription_cancelled` (server),
`assessment_failed`.

## Expected per-journey sequences (controlled, fresh sessions)

- **J1 anonymous builder:** landing_viewed → builder_started →
  assessment_rendered{source:builder, signed_in:false} →
  copy_link_clicked → print_clicked → save_started{signed_in:false}
- **J2 anonymous composer:** landing_viewed → composer_started →
  assessment_rendered{source:composer}
- **J3 signed-in save lifecycle:** sign_in_completed{source:signin} →
  save_started{signed_in:true} → first_system_saved → (second system)
  additional_system_saved → (same system again)
  identical_assessment_declined → my_systems_viewed{state:trial}
- **J4 boundary (expired):** my_systems_viewed{state:expired} +
  subscription_prompt_viewed{state:expired} → (blocked save)
  trial_action_blocked{action} → checkout_started →
  checkout_cancelled (on cancel return)
- **J5 dedupe/ordering:** React strict-mode double-mount and in-page
  re-renders must not duplicate view events; action events repeat by
  design; a full reload is a new page-load (view events fire again —
  correct: funnel counts visits, not sessions)
- **J6 degradation:** vendor `window.va` throwing on every call must not
  affect any journey step
- **Server events** (`account_created`, `subscription_activated`,
  `subscription_cancelled`): code-path verified; `@vercel/analytics/server`
  transmits only on Vercel-hosted environments, so end-to-end observation
  is deferred to the beta-entry criterion "funnel readable in production"
  (already a required check).
