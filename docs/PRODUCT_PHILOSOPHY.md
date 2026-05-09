# Audio XX — Product Philosophy

**Last updated:** 2026-05-09
**Audience:** anyone who needs to understand what makes Audio XX different from the dozen other audio recommendation tools that exist online — and why that difference shows up as engineering decisions in the codebase.

This document is descriptive, not aspirational. The philosophy below is enforced in `CLAUDE.md` (the locked behavioural spec) and reflected in the deterministic engine's actual reasoning order.

---

## 1. What Audio XX is, and what it is not

**Audio XX is a system-level audio advisor.** Operating in the stance of a private advisor.

It is **not**:

- A recommendation engine. It does not rank products into a numeric league table.
- A store. There is no checkout, no cart, no affiliate ranking pressure. Retailer links exist for the user's convenience and are not affiliate-tagged at this writing.
- A forum. There are no user reviews, no community voting, no aggregate scores.
- A chatbot gimmick. The reasoning order is fixed and deterministic; the model is not asked to "be helpful" in the open-ended LLM sense.
- A configurator. It does not produce a complete-system bill of materials in response to a single question.

What it is: a tool that helps a listener understand how their existing components interact, what their preferences imply about engineering principles, and what trade-offs each possible direction carries. Products are illustrative outputs of that reasoning, never the entry point.

---

## 2. System-aware reasoning

The defining engineering decision is the **reasoning order**:

```
system context  →  trait inference  →  system balance  →
anchor comparison  →  upgrade direction  →  product suggestions
```

Products come last. Every other audio recommendation tool starts with products and back-fills justifications. Audio XX evaluates components relative to the user's current chain — does this candidate compensate for an existing weakness or compound it? Is this a refinement or a philosophical shift?

The implementation lives across `apps/web/src/lib/`:

- `audio-session-context.tsx` carries the active system across turns.
- `consultation.ts` takes system context as a primary input to advisory construction.
- `intent.ts` uses `hasActiveSavedSystem` as a routing signal, gating refinement-escape phrases ("more warmth," "more clarity") so they don't force-route to shopping when the user already has a system.

**A recommendation that ignores the user's existing chain is, by definition, wrong-tier.** This is the most-cited rule when fixing intent and advisory bugs.

---

## 3. Preference-aware reasoning

Listener preferences map to traits via the **4-axis sonic trait framework** (locked v1, documented in `docs/audio_xx_sonic_trait_framework_v1.md`):

```
Warm  ↔  Bright
Smooth  ↔  Detailed
Elastic  ↔  Controlled
Airy  ↔  Closed
```

Plus secondary traits: clarity, flow, tonal density, dynamics, fatigue risk, glare risk, texture, microdynamics, low-volume integrity, composure, elasticity, bass weight.

Preferences are extracted from messy language via `packages/signals/signals.yaml` (phrase → trait dictionary) and the inference layer in `apps/web/src/lib/inference-layer.ts`. The pipeline:

1. **Mirror what the user values and avoids** (don't flatter, don't over-interpret).
2. **Translate preferences into engineering principles** ("that experience usually comes from..." with one-line explanations).
3. **Map principles back to trait priorities** — clarity-first, flow-first, density-first, composure-first, etc.

Taste is treated as **evolving** — not fixed identity. Returning users have continuity (their saved systems and prior preferences inform new questions) but the engine is explicit about distinguishing curiosity, restlessness, and genuine directional change. Past recommendations are not doctrine; they are context.

---

## 4. Trade-off discipline

**Every concrete suggestion names what it costs as well as what it gains.** No exception, no override.

This is enforced by structure: the advisory output schema includes a mandatory "trade-off" field per recommendation. The renderer surfaces it as a visible block. The QA harness (when built — Workstream A8) will assert trade-off presence as a behavioural property.

Why this is non-negotiable: every recommendation tool that omits trade-offs converges to the same failure mode — recommendations sound interchangeable, the user stops trusting them, and the tool becomes a glorified search engine. Audio XX explicitly treats trade-off framing as the differentiator that earns trust.

The implementation rule, from `CLAUDE.md` (Playbook §2): "Every recommendation should explicitly identify what it is likely to improve, what it may compromise. Recommendations should never be presented as pure upside."

---

## 5. The "do nothing" philosophy

**"No change" is a first-class outcome, not a fallback.**

The rule, from `CLAUDE.md`: "Do nothing is a legitimate path."

The RightRail's restraint footer surfaces this directly to the user:

> "Doing nothing is also a valid outcome."

When the engine assesses a system as near-equilibrium, the response should say so. When the user describes symptoms that don't actually point to a specific upstream cause, the response should hold rather than fabricate. When a proposed change is a small refinement of taste rather than an objective improvement, the response should frame it as such — not as an upgrade.

The opposite — recommending change because the user asked, regardless of whether change is warranted — is the failure mode this rule prevents. The audio hobby has persistent upgrade pressure built in; Audio XX is structured to push back gently.

---

## 6. Anti-ranking philosophy

**No scoring. No "best." No urgency.**

Concrete consequences in the code:

- No numeric scores anywhere in advisory output.
- No "top 10" framing. Comparisons are between 2–3 products at a time, with trade-offs between each, not a ranking.
- No "limited time" / "act now" / "don't miss out" framing. The tone is calm, slightly analytical, confident but not absolute.
- No persuasive sales language. The advisor is a private consultant, not a salesperson.
- No brand worship. Even strongly-reviewed brands are described in terms of design philosophy and trade-offs, not reputation.

This is enforced by structural choices:

- The directional-options schema offers 2–3 paths, not a ranked list.
- "Recommended" is paired with explicit calibration ("based on your stated priority of X, this aligns with...").
- Out-of-scope or low-confidence cases are required to surface uncertainty rather than guess.

---

## 7. Editorial / advisory tone

The voice is documented in detail in `docs/AudioXX_Review_Voice.md` and `docs/AudioXX_Advisory_Style_Guide.md`. Summary:

- **Calm, non-performative.** No hype, no theatrical claims.
- **Restrained.** Recommendations land softly. Trade-offs are honest, not dramatic.
- **Slightly analytical.** Confident, but not absolute.
- **Adaptive register.** Vocabulary depth scales with the user's demonstrated fluency. The advisor never talks down, never oversimplifies, never assumes advanced expertise without signal.
- **Educational.** Architectural reasoning is visible — connections between perceptual tendencies and engineering principles (psychoacoustics, distortion audibility, temporal perception) are drawn explicitly when relevant.
- **Honest about limits.** When the engine is uncertain, it says so. When data is missing, it surfaces what is missing rather than inventing.

The visual surface mirrors this: monochrome / cool-neutral palette, restrained typography, single-thread brand-red accent (`#C83A3A`) used sparingly. The UI does not perform; it recedes so the reasoning is visible.

---

## 8. Trust and restraint principles

These are the meta-principles that keep the previous seven from drifting:

**Confidence calibration.** Language strength matches source quality and inference confidence. Every advisory output carries a `confidence` field with semantics: `high` allows assertive language, `medium` requires measured language with a named qualifier, `low` requires hedged language, `insufficient` requires refusal — surface what's missing instead of recommending. The lock-in for these semantics is tracked in `docs/implementation-plan.md` Workstream A7.

**Partial knowledge handling.** Missing information must not be invented. The engine degrades confidence and surfaces uncertainty. This is the rule the LLM overlay (when shipped) is meant to operationalise — for unknown products, acknowledge by name, state that calibrated data isn't available, offer what's publicly known.

**Reversibility preference.** Recommendations that are easier to reverse are preferred over more structural changes, unless a strong constraint justifies otherwise. Cable swaps and tube rolls before chassis changes; chassis changes before topology shifts.

**Counterfactual thinking.** Before recommending change, the engine considers: what happens if nothing changes? Is there an alternative that better preserves existing strengths? See `apps/web/src/lib/counterfactual-assessment.ts`.

**Identity preservation.** A system has a character. Recommendations should improve the system without flattening or erasing its core identity, unless that identity is itself the problem. This is enforced via `apps/web/src/lib/preference-protection.ts`.

**Engagement over precision.** The primary outcome variable is long-term emotional engagement, not measured precision. Technical precision without engagement is not considered success. Improvements are judged by whether they increase durable musical involvement, not short-term impressiveness.

---

## 9. What this implies for engineering decisions

The philosophy above is not abstract — it produces concrete engineering rules:

- **Engine code must be domain-agnostic** (Climate Screen test). Audio vocabulary belongs in adapter / mapping layers. The portable reasoning core (trade-off assessment, preference protection, counterfactual thinking, restraint) should be liftable into other decision-quality domains without rewrites. See `CLAUDE.md` § "Engine vs Domain Boundary."
- **Curated knowledge over crowdsourced.** Catalog entries are hand-tuned with axis positions, trait tendencies, and trusted reference citations. There is no community voting, no scraped reviews. The credibility surface is "this advisor knows what it's talking about" — which requires the underlying data to be small, deep, and curated rather than large and noisy.
- **No affiliate links yet.** Retailer links exist but carry no `tag=` parameter. The ranking integrity rule is: monetisation cannot be allowed to bias recommendations. When affiliate links eventually ship (post-Workstream M5), they will be audited to confirm that recommendation order is unchanged.
- **Restraint is a feature, not a bug.** The product would be easier to demo if it produced confident, marketing-style output. It explicitly does not, because the failure mode of confident-when-wrong is worse than the failure mode of restrained-when-uncertain. This is a deliberate trade-off.

---

## 10. Why it exists

From `CLAUDE.md`, verbatim:

> Many listeners do not lack information — they lack orientation. They may struggle to articulate their preferences. They may adopt other people's hierarchies. They may second-guess decisions. They may make changes that unintentionally introduce new imbalances.
>
> Taste is not fixed. It evolves.
>
> This guide does not attempt to define identity. It helps users clarify their present priorities and understand how equipment shapes their musical experience. It supports deliberate experimentation. Users may preserve equilibrium or explore new directions with clear awareness of trade-offs and system consequences.
>
> The aim is not to restrict change. The aim is to make change intentional.

That paragraph is the product. Every engineering decision in the codebase serves it.
