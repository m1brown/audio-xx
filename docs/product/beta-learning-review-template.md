# Beta Learning Review — Template (v1)

**Status:** GOVERNING product-learning process for the closed beta
(founder-instituted 2026-07-31, phase transition: engineering → product
learning).

**Cadence:** run once every **10–20 meaningful user sessions** (a
meaningful session = a visitor who at least starts an assessment). Copy
this template to `docs/product/reviews/beta-review-NNN.md`, populate,
commit. Reviews are numbered, never overwritten.

---

## Product doctrine (applies to every proposal, in this review or outside it)

Before proposing or implementing any significant feature, answer all five:

1. **What user behavior or evidence suggests this is needed?**
2. **What hypothesis are we testing?**
3. **How will we know whether it succeeded?**
4. **What is the smallest experiment that can answer the question?**
5. **Does this preserve the product's editorial identity and trust?**

Defaults: **conserve the current experience** (production `b5de86a`
baseline is the reference implementation). No architectural redesign
without a material defect or compelling beta evidence. The burden of
proof is on NEW functionality; improvements to **correctness, catalog
quality, recommendation quality, editorial quality, manufacturer
knowledge, and reliability continue proactively** and need no behavioral
trigger.

---

## 0. Review header

| Field | Value |
|---|---|
| Review number | NNN |
| Period covered | YYYY-MM-DD → YYYY-MM-DD |
| Meaningful sessions in period | |
| Production commit(s) during period | |
| Reviewer | |

## 1. Quantitative behavior

Data sources — populate mechanically:

- **Vercel Analytics** (audio-xx-web project → Analytics → custom
  events): all `src/product/analytics.ts` events below. Filter to the
  review period.
- **Events table** (`/api/events` telemetry lane, Turso): outbound
  commerce clicks with destination type + monetized flag.
- Funnel definitions: `docs/analytics-events.md` §"First-user funnel".

| Metric | Event(s) | Count | Prior review | Δ |
|---|---|---|---|---|
| Landing views | `landing_viewed` | | | |
| Assessment starts | `builder_started` (+ `builder_first_component`) | | | |
| Assessments submitted | `assessment_submitted` (by `source`) | | | |
| Assessment completion rate | `assessment_rendered` ÷ `assessment_submitted` (note `assessment_failed`) | | | |
| System saves | `first_system_saved` + `additional_system_saved` | | | |
| Return users | `return_visit` / `return_visit_new_decision` (events lane) | | | |
| Comparison usage | comparison-mode turns (events lane / transcript sampling) | | | |
| Recommendation engagement | shopping turns reaching a shortlist; follow-ups per shortlist | | | |
| Outbound commerce clicks | `outbound_commerce_click` (by destination type; monetized flag) | | | |
| Share activity | `copy_link_clicked` + `print_clicked` | | | |
| Authentication conversion | `auth_initiated` → `sign_in_completed` / `account_created` | | | |

**Funnel snapshot:** landing → builder start → first component → submit
→ rendered → save → share/outbound. Note the single largest drop-off.

## 2. Qualitative observations

Sources: founder inbox (Report Issue mailto), direct beta conversations,
transcript sampling of anonymized production conversations, Sentry
issues (once active).

| Category | Observations (verbatim where possible) | Frequency |
|---|---|---|
| Recurring questions | | |
| Confusion | | |
| Delight | | |
| Trust signals (or violations) | | |
| Unexpected behavior | | |
| Requested capabilities | | |

## 3. Product hypotheses

One block per important observation. Confidence: low / medium / high.

> **H-NNN.x — [name]**
> - What we believe is happening:
> - Confidence:
> - Supporting evidence:
> - Competing explanations:

## 4. Proposed experiments

**At most one or two.** Everything else goes to the backlog note at the
bottom. Each experiment must pass the five doctrine questions.

> **E-NNN.x — [name]**
> - Objective:
> - Expected outcome:
> - Success metric (and the number that would count as failure):
> - Implementation effort: S / M / L
> - Risk (incl. editorial-identity / trust impact):
> - Recommendation: **run / defer / reject**

## 5. Standing-quality actions (no evidence gate required)

Proactive correctness / catalog / recommendation / editorial /
manufacturer-knowledge / reliability improvements surfaced this period —
listed, sized, and prioritized, but distinct from experiments:

- …

## 6. Deferred / rejected this review

One line each, with the reason — so future reviews don't re-litigate:

- …
