# Three-User Beta — Founder Learning Record

Beta of the validated adviser (generation gpt-6-astra, validator gpt-4o)
with three real system owners. Golden-corpus archetypes cover these
systems for AFTERWARD (reproduction of reported issues) — the users are
never given test prompts, expectations, or question lists. The only
instruction they receive: talk to Audio XX naturally about your system.

Primary question: did this person get enough value that they would want
to use Audio XX again?

Fill each record from the user's own feedback (the 5 questions below),
consented product feedback (`feedback_submitted` events), and the passive
signals — never from private conversation content, which the product does
not store.

## Passive signals to check per user (Vercel logs, `AXX-EVENT` +
## `[reasoning-lane]` lines; no conversation content)

- `account_created` / `sign_in_completed` — reached the door
- `[reasoning-lane] allow user=<email>` — actually used the validated adviser
- `assessment_completed` — first assessment rendered
- `decision_intent_entry` with `followUp: true` — substantive follow-up
  (the SECOND SERIOUS QUESTION signal)
- `return_visit` / `return_visit_new_decision` — came back
- `first_system_saved` — kept the system
- `suggested_edit_opened` / `suggested_edit_submitted` — correction door used
- `feedback_submitted` (helped / accurate / wouldReturn / comment)

## Feedback questions (conversational, max 5)

1. Was it useful?
2. Did it understand your system?
3. Was there anything it got clearly wrong?
4. Was there a moment where it told you something genuinely useful or surprising?
5. Would you use it again?

(Optional, if the conversation invites it: what would you want it to do
that it couldn't?)

---

## NATHAN — dCS Rossini Apex · ARC Reference 5 · Butler Monads · Acora QRC-2

| field | value |
| --- | --- |
| invited date | |
| account email allowlisted | ☐ |
| first session completed | ☐ |
| substantive follow-up (2nd serious question) | ☐ |
| returned | ☐ |
| system saved | ☐ |
| Suggested Edit used | ☐ |
| feedback summary | |
| clear factual error reported | |
| strongest value moment | |
| biggest frustration | |
| findings (P0/P1/P2/P3) | |

## NAD OWNER — NAD AV716 · Topping D70 Pro OCTO · Dynaco A35

| field | value |
| --- | --- |
| invited date | |
| account email allowlisted | ☐ |
| first session completed | ☐ |
| substantive follow-up (2nd serious question) | ☐ |
| returned | ☐ |
| system saved | ☐ |
| Suggested Edit used | ☐ |
| feedback summary | |
| clear factual error reported | |
| strongest value moment | |
| biggest frustration | |
| findings (P0/P1/P2/P3) | |

## ACCUPHASE OWNER — Accuphase E-600 · Accuphase DP-450 · Harbeth SHL5+

| field | value |
| --- | --- |
| invited date | |
| account email allowlisted | ☐ |
| first session completed | ☐ |
| substantive follow-up (2nd serious question) | ☐ |
| returned | ☐ |
| system saved | ☐ |
| Suggested Edit used | ☐ |
| feedback summary | |
| clear factual error reported | |
| strongest value moment | |
| biggest frustration | |
| findings (P0/P1/P2/P3) | |

---

## Issue investigation path (golden-corpus handoff)

When a user reports "Audio XX did something strange":

1. Ask for the exchange in their words (or a shared transcript — never
   pull private conversations; the product does not store them).
2. Reproduce the SEMANTIC situation against the matching golden
   archetype (`apps/web/src/qa/golden/`, Tier B focused run:
   `QA_GOLDEN=1 QA_GOLDEN_SYSTEMS=<nathan|nad|accuphase|france-ii> …`).
3. Classify: stochastic behavior · evidence gap · identity issue ·
   reasoning regression · UX issue · genuinely new user need.
4. P0/P1 → stop and report. P2/P3 → record here and in the P2 pattern
   ledger; do not fix mid-beta.

Do not force real user behavior into the golden scripts; the corpus
protects the product, the beta discovers it.

## Access note

Lane cohort = `REASONING_LANE_USERS` (Vercel Production, comma-separated
emails; server-side; kill switch = remove the email / unset). To admit a
beta user: append their sign-in email, redeploy, and verify
`GET /api/reasoning-lane` returns `{"eligible":true}` for them (they can
check by opening audio-xx.com/api/reasoning-lane while signed in).
Rollback is deleting the email from the list — nothing else changes.
