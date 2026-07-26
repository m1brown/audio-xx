# Audio XX — Assessment Evolution

## Governance
- **Purpose:** the execution plan for deepening the assessment **after invite-only beta validation**. Everything here is gated on beta signal; nothing here belongs in the beta launch. Translation of the two frozen architectures into work — not a design document.
- **Status:** FROZEN — v1
- **Approval date:** 2026-07-26
- **Reviewer:** Founder (Mike Brown)
- **Change-control policy:** Sequencing and priorities **require founder approval before material changes.** Task *estimates* may evolve; **strategic ordering must not drift without review.** Governed by the frozen `docs/causal-explanation-architecture-v1.md` and `docs/assessment-expansion-architecture-v1.md`; this document must not redesign them.

Priority legend: 🟠 High leverage · 🟡 Nice to have · ⚪ Defer. Cx: S/M/L. FR: founder review.

---

## Precondition (gate for this entire document)
Do **not** start this work until the invite-only beta has produced signal that audiophiles value the assessment and want more depth. The **Knowledge Opportunity backlog from real usage** — not assumption — sets the priority within it. If the beta says the concise assessment is enough, this plan waits.

---

## Track 1 — Question Engine foundation

### E1. AnsweredQuestion + entitlement pass — 🟠 · Cx L · FR Y
- **Objective:** implement the engine that decides which `AssessableQuestion`s it is entitled to answer and emits `AnsweredQuestion` objects carrying `approvedClaims` only.
- **User value:** the foundation of evidence-earned depth.
- **Dependency:** Assessment Expansion Architecture (frozen); causal engine as one evidence source.
- **Definition of done:** entitlement conforms to the frozen registry + evidence hierarchy; every rejection test passes; behind a flag; **flag-off byte-identical**; engine gate green.

### E2. Renderer weighting — 🟠 · Cx M · FR light
- **Objective:** renderer assigns expression weight (clause / sentence / paragraph / section) from claim count, specificity, confidence; composes **only** from approved claims.
- **User value:** expansion without verbosity or repetition.
- **Dependency:** E1.
- **Definition of done:** the frozen worked example reproduces (SET × O/96 ≈ 3–4 paragraphs); the **no-artificial-differentiation** test passes (Yamamoto ≈ Decware where facts match); boilerplate test passes per section.

### E3. Knowledge Opportunity reporting — 🟠 · Cx M · FR N
- **Objective:** every omitted question emits a typed `KnowledgeOpportunity`; aggregate into a ranked internal backlog.
- **User value:** turns omissions into the authoring roadmap.
- **Dependency:** E1.
- **Definition of done:** typed records for all reason classes; aggregation query (`reasonClass × question × frequency` + "would unlock"); **no silent gaps**.

---

## Track 2 — Knowledge authoring workflow

### E4. Authoring workflow + two-track review — 🟠 · Cx S–M · FR Y
- **Objective:** define how facts / rules / catalog enter — data-file PR → **knowledge track** (facts/rules/provenance) vs **editorial track** (voice), on the draft→reviewed→approved lifecycle, with founder sign-off for rules/facts.
- **User value:** safe, repeatable depth growth by one founder.
- **Dependency:** both frozen architectures.
- **Definition of done:** written workflow; a rule/fact cannot reach prod without recorded approval; **only `approved` emits prose**; a reference-set entry carrying a fact/rule/provenance is rejected.

### E5. Testing + publication gate for knowledge — 🟠 · Cx S · FR light
- **Objective:** every knowledge change ships with golden + rejection tests and passes the engine gate; publish behind flag → Preview → founder → enable.
- **User value:** depth never costs correctness.
- **Dependency:** E4.
- **Definition of done:** CI blocks un-tested knowledge changes; a publication checklist is enforced; the engine gate stays green on every addition.

### E6. Knowledge Opportunity backlog dashboard — 🟡 · Cx M · FR N
- **Objective:** surface the ranked KO backlog so scarce founder time targets the highest-unlock authoring.
- **User value:** founder prioritization leverage.
- **Dependency:** E3.
- **Definition of done:** a ranked view with frequency + estimated unlock ("author X → unlocks `why-works` on N% of systems").

---

## Track 3 — Assessment expansion & catalog enrichment

### E7. Data-driven catalog authoring (top Knowledge Opportunities) — 🟠 · Cx M (data, ongoing) · FR Y (rules/facts)
- **Objective:** author the highest-frequency missing knowledge the backlog surfaces (e.g. generalize amp→speaker interaction rules, add downstream-eligible speakers, extend topology tags per the `topology:'set'` audit).
- **User value:** real depth exactly where users hit gaps.
- **Dependency:** E3/E6 (prioritization); E4/E5 (workflow + gate); Causal Architecture.
- **Definition of done:** each addition ships with golden + rejection tests; engine gate green; measurable reduction in the targeted KO's frequency.

### E8. Assessment expansion rollout — 🟠 · Cx M · FR Y (voice)
- **Objective:** enable the full multi-question expansion on production (behind the flag → Preview → prod), section by section, as evidence coverage grows.
- **User value:** the 800–1,200-word depth **where evidence earns it** — the differentiation the beta will have validated demand for.
- **Dependency:** E1, E2, E7; Editorial/Restraint doctrine.
- **Definition of done:** expanded assessments pass the six editorial tests + restraint suite; thin systems remain concise (honest omission); success measured on the frozen criteria (causal ratio, blind inferability, zero unsupported claims, restraint preserved).

### E9. Multi-rule causal presentation — 🟡 · Cx M · FR light
- **Objective:** replace the single-block composer with ordered, capped, de-duplicated multi-interaction presentation (the frozen "≤3, one tight sentence per interaction" shape).
- **User value:** readable depth as the interaction library grows.
- **Dependency:** E7 (a second+ causal rule must exist first).
- **Definition of done:** N-rule systems render an ordered, capped "why" set with no repetition; single-rule output unchanged.

---

## Sequencing
E1 → E2 → E3 (Track 1, the engine) establish the machinery and the backlog. E4 → E5 (Track 2) must exist before any Track-3 authoring reaches prod. E6 is a convenience once E3 exists. E7 is continuous, prioritized by E3/E6. E8 rolls out on top of E1/E2/E7. E9 waits until a second causal rule exists (an E7 output). **No dates** — throughput is bounded by one founder and by real KO signal, not a calendar.

## Non-goals
No new product concepts; no architectural redesign; no expansion beyond the frozen architectures. Depth and length remain consequences of evidence density. Beta-launch work belongs solely in `docs/BETA_LAUNCH_ROADMAP.md`.

## Status
**FROZEN — v1 (2026-07-26).** Governing evolution plan; gated on beta validation. Not started.
