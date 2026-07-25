# Audio XX — Canonical Product Events (M5)

**This document is the single specification for product measurement.**
Every event flows through one shared function — `track()` in
`apps/web/src/product/analytics.ts` (client) or `trackServer()` in
`analytics-server.ts` (server) — currently backed by Vercel Analytics.
Swapping vendors means changing those two files only; no call site
changes.

The canonical set is pinned by `apps/web/src/product/__tests__/analytics.test.ts`.
Adding, renaming, or removing an event means editing `EVENTS` and that
test together — nothing else can emit.

## The funnel

```
landing_viewed
  → builder_started | composer_started
    → assessment_rendered (source: builder | composer)   [assessment_failed]
      → copy_link_clicked / print_clicked
      → save_started
        → account_created → sign_in_completed
          → first_system_saved | additional_system_saved | assessment_added
            → my_systems_viewed
              → trial_action_blocked → subscription_prompt_viewed
                → checkout_started → checkout_cancelled | subscription_activated
                  → subscription_cancelled
```

## Events

| Event | Fired when | Where | Props |
|---|---|---|---|
| `landing_viewed` | Homepage mounts | `app/page.tsx` | — |
| `builder_started` | First interaction with the system builder | `product/SystemBuilder.tsx` | — |
| `composer_started` | First free-text submission (not follow-ups) | `app/page.tsx` | — |
| `assessment_rendered` | Artifact page renders successfully | `app/artifact/ArtifactActions.tsx` | `source` (`builder`\|`composer`\|`direct`), `signed_in` |
| `assessment_failed` | Artifact input could not be read as a system | `app/artifact/TrackFailure.tsx` | — |
| `copy_link_clicked` | Copy-link action on the artifact | `ArtifactActions.tsx` | — |
| `print_clicked` | Print action on the artifact | `ArtifactActions.tsx` | — |
| `save_started` | Save pressed on the artifact | `ArtifactActions.tsx` | `signed_in` |
| `account_created` | Auto-registration creates a new account | `lib/auth.ts` (server) | — |
| `sign_in_completed` | Successful sign-in | `app/save/page.tsx`, `app/auth/signin/page.tsx` | `source` (`save`\|`signin`) |
| `first_system_saved` | Save results in the user's first system | `ArtifactActions.tsx` | — |
| `additional_system_saved` | Save results in a further system | `ArtifactActions.tsx` | — |
| `assessment_added` | Re-assessment appended to an existing system | `ArtifactActions.tsx` | — |
| `identical_assessment_declined` | Identical re-assessment not appended | `ArtifactActions.tsx` | — |
| `my_systems_viewed` | My Systems page mounts | `app/systems/page.tsx` | `state` (entitlement state) |
| `subscription_prompt_viewed` | The subscribe prompt renders | `product/SubscriptionPrompt.tsx` | `state` |
| `checkout_started` | Subscribe button → checkout session | `SubscriptionPrompt.tsx` | — |
| `checkout_cancelled` | Return from checkout with `?checkout=cancelled` | `app/account/page.tsx` | — |
| `subscription_activated` | Verified webhook activates a subscription | `api/billing/webhook` (server) | — |
| `subscription_cancelled` | Verified webhook cancels a subscription | `api/billing/webhook` (server) | — |
| `trial_action_blocked` | A protected action returns 403 | `ArtifactActions.tsx`, `systems/page.tsx`, `systems/[id]/SystemMeta.tsx` | `action` (`save`\|`add`\|`rename`\|`notes`) |

## Segmentation

The founder's four questions map directly:

- **Builder vs composer** — `assessment_rendered.source`.
- **Anonymous vs signed-in** — `signed_in` on `assessment_rendered` / `save_started`.
- **Trial vs subscriber** — `state` on `my_systems_viewed` / `subscription_prompt_viewed`.
- **First vs repeat save** — distinct events (`first_system_saved` vs `additional_system_saved`).
- **Where do users drop out before paying?** — read the funnel top-to-bottom
  in the Vercel Analytics dashboard (project **audio-xx-web → Analytics →
  Custom events**); each stage above is one event.

## Privacy (release-blocking)

`sanitizeProps` enforces an **allowlist** at the emission boundary:
`source`, `signed_in`, `state`, `first`, `action`, `days_left`, `outcome`.
Strings are capped at 24 characters; everything else is dropped. The
following can therefore never be transmitted, and tests pin this:
passwords, emails, private notes, private system names, full system
URLs, raw composer text, card data. Identification is Vercel Analytics'
anonymous visitor model — no user IDs are attached to events.

## Dedupe

View events (`landing_viewed`, `assessment_rendered`, `my_systems_viewed`,
`subscription_prompt_viewed`, `builder_started`, `composer_started`) emit
**once per page load** — React strict-mode double-effects and hydration
re-renders cannot double-count. Action events emit every time.

## Minimum viable launch dashboard (documentation only — Gate 3 follow-up)

The decision framework for reading the data after launch. Nothing here
is implemented; every row is readable from the Vercel Analytics custom
events dashboard (server rows appear in production only). Read daily for
the first two weeks, then weekly.

| Question | Read from | Why it matters |
|---|---|---|
| Visitors today | Vercel visitors + `landing_viewed` | Is anyone arriving at all? |
| Assessment starts | `builder_started` + `composer_started` | Does the landing page convert attention into intent? |
| Assessment completions | `assessment_rendered` | Does intent survive to a delivered assessment? |
| Completion rate | `assessment_rendered` ÷ starts | The single core product health number |
| Builder vs composer usage | start-event split; `assessment_rendered.source` | Which entry deserves investment |
| Copy rate | `copy_link_clicked` ÷ `assessment_rendered` | Do people share it? (organic growth signal) |
| Print rate | `print_clicked` ÷ `assessment_rendered` | Is the artifact treated as a document worth keeping? |
| Save rate | `save_started` ÷ `assessment_rendered`; outcomes (`first_system_saved` etc.) | Does the free artifact pull people toward the paid surface? |
| Subscription prompts shown | `subscription_prompt_viewed` (by `state`) | How many people reach the boundary |
| Checkout starts | `checkout_started` | Boundary → intent to pay |
| Subscription conversions | `subscription_activated` (server) ÷ `checkout_started` | Does checkout close? |
| First saved systems | `first_system_saved` | New engaged users (the activation event) |
| Returning users | `sign_in_completed` vs server `account_created`; `my_systems_viewed` | Is there a reason to come back? |

Reading order is the funnel order above: each row only matters if the
rows above it have volume. The launch question hierarchy: (1) do
visitors complete assessments? (2) do completions lead to saves? (3) do
saves lead to subscriptions? A weak number is a *localised* problem —
fix the stage, not the product.
