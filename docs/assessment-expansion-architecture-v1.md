# Assessment Expansion Architecture — v1 (FROZEN governing design)

Status: **FROZEN 2026-07-26.** Governing design for future assessment work.
**Not implemented** — this is the reference the implementation must conform to.
Companion to `docs/causal-explanation-architecture-v1.md` (the causal engine is
one evidence source consumed here).

## Purpose

Assessments are correct but too brief (~300 words). This architecture lets an
assessment expand toward 800–1,200 words **only where evidence earns it**, by
answering *more distinct reader questions* — never by writing more per answer.
Length is a **consequence of evidence density**, not a target.

## Governing principles (accepted)

1. **Evidence density determines richness.** A rich catalog yields a long
   assessment; a thin one stays short — honestly.
2. **Evidence classes are not interchangeable.** Each class has a maximum
   strength and permitted uses (§Evidence hierarchy).
3. **Questions are admitted by evidentiary strength and specificity, not by
   desired length.**
4. **Identical approved claims legitimately produce similar assessments.** No
   artificial differentiation (see Yamamoto vs Decware, §Specificity).
5. **Omitted questions identify missing knowledge, not missing writing** — each
   omission becomes a typed Knowledge Opportunity (§Knowledge Opportunity).

## Core reframe: questions, not paragraphs

The engine reasons about **questions it is entitled to answer**, never about
paragraphs it wishes to write. Two responsibilities are kept strictly separate:

- **Engine (content / entitlement).** For each `AssessableQuestion`, decide —
  from the available, class-typed, provenance-carrying evidence — whether the
  assessment is *entitled* to answer it, and produce the `approvedClaims`. The
  engine never decides form.
- **Renderer (expression weight).** Given an `AnsweredQuestion`, decide whether
  the answer is expressed as a **clause**, a **sentence**, a **paragraph**, or a
  standalone **section** — a pure function of how many distinct, system-specific,
  non-redundant approved claims exist and their confidence. The renderer never
  invents content and is never asked to "write a section."

```
evidence ──▶ [ENGINE: entitlement] ──▶ AnsweredQuestion (approved claims)
                     │                          │
                     ▼                          ▼
          KnowledgeOpportunity        [RENDERER: expression weight]
          (when NOT entitled)          clause | sentence | paragraph | section
```

## AssessableQuestion registry

The closed set of reader questions the product may answer. Anchors are always
answered; body questions are entitlement-gated; exceptional questions render
only when they materially clarify.

| id | Reader question | Kind | Entitled by |
|----|-----------------|------|-------------|
| `what-is-it` | What is this system, in a line? | anchor | always (verdict + standfirst) |
| `what-for` | What is it built for? | anchor | always (recognition) |
| `why-works` | Why do these components produce this result *together*? | body | authored **InteractionRule** (+ trait agreement as support) |
| `defining-trade` | What did it deliberately give up, and why is that the right cost? | body | trade-off records converging to a **system** trade |
| `what-rewards` | What does it do especially well? | body | emphasized-trait payoff (often folds into `what-for`) |
| `what-asks` | What does getting the best from it require? | body | placement / matched conditional effect / user context |
| `alt-philosophy` | What different philosophy could have been chosen, and what would it trade? | **exceptional** | decision-material capsule contrast only |
| `upgrade` | If you ever want change, what moves what — and what is protected? | body | upgrade path / primary constraint (often folds into recommendation) |
| `listen-for` | What should you actually listen *for*? | body | **restrained** cue evidence only |
| `should-change` | Should anything change? | anchor | always (recommendation) |

## Evidence hierarchy

Each class has a **maximum answer strength** and permitted uses. Not
interchangeable.

| Evidence class | Max strength alone | Component desc. | System judgment | Causal | Listening cue | Contrast | Recommendation |
|---|---|---|---|---|---|---|---|
| Component tendency (trait level) | **clause** | ✅ | contributes (aggregate) | ✗ | ✗ | ✗ | ✗ |
| Component-specific fact (topology/power/price/identity) | **sentence** | ✅ | ✅ (when it interacts) | ✗ (needs rule) | ✗ | ✗ | constraint only |
| Topology capsule | **sentence** (generic) | ✅ | ✗ (generic) | source *via rule* | seed, bound to a fact | source (if material) | ✗ |
| Trade-off record | **paragraph** | ✅ | ✅ | ✗ | ✗ | ✅ (relative_to) | direction |
| Conditional effect (matched) | **paragraph** | ✗ | ✅ (if condition matches) | ✗ | ✗ | ✗ | ✅ (setup) |
| Authored InteractionRule | **paragraph→section** | ✗ | ✅ | ✅ (only licenser) | ✗ | ✗ | ✗ |
| Review consensus (basis) | **internal** | confidence | confidence | ✗ | ✗ | ✗ | ✗ |
| Individual source reference | **internal** | attribution only | ✗ | ✗ | ✗ | ✗ | ✗ |
| User room/preference/usage | **paragraph** (user-scoped) | ✗ | ✅ (rel. to user) | ✗ | ✗ | ✗ | ✅ |

Invariants: only an **InteractionRule** licenses causal prose; a **single
tendency is a clause** (never a paragraph); **capsules are generic** until
instantiated to this system; **review consensus / source references are
provenance, not claims** — they adjust confidence and may *attribute* an
already-admitted claim, never originate one.

## AnsweredQuestion — the engine's output object

The engine emits one of these per entitled question. The renderer composes
**only** from `approvedClaims`; it is never asked to "write a section."

```
AnsweredQuestion {
  question            // AssessableQuestion id
  readerQuestion      // the single question this owns
  admittedEvidence: { class, basis, specificity, ref }[]
  approvedClaims: Claim[]         // the ONLY expressible content; each maps to evidence
  systemSpecificity: 'generic' | 'component-specific' | 'system-specific'
  confidence          // min over the evidence chain
  prohibitedExtensions: string[]  // localized restraint, per question
  redundancyKey       // owns exactly one reader question; cross-question dedup
}
```

### Renderer expression-weight mapping (form is the renderer's job)

Let *n* = count of **distinct, non-redundant, system-specific** approved claims.

| Condition | Expression weight |
|---|---|
| n = 0 | **omit** → emit a `KnowledgeOpportunity` |
| n = 1, redundant with a stronger answer | **clause**, folded into that answer |
| n = 1, non-redundant | **sentence** (may fold into an anchor) |
| n = 2–3 | **paragraph** |
| n ≥ 4, non-overlapping, confidence ≥ medium | **section** (own heading) |

A `redundancyKey` collision downgrades one weight. `confidence < medium`
downgrades one weight. `systemSpecificity = generic` caps the weight at
**sentence** (generic knowledge never earns a system paragraph).

## System specificity — no artificial differentiation

Two systems whose engine produces **identical `approvedClaims` render
identically**. Differentiation is a property of *evidence*, not of writing.

**Test case — Yamamoto A-08S vs Decware SE84UFO** (both `topology:set`, 2 W):
- **Genuinely distinguishing (represented):** output device (45 triode vs SV83) —
  *identity string only*; price ($5,000 vs $3,200); efficiency thresholds
  (95/92 dB vs 94/90 dB); provenance basis (review vs listener consensus —
  *internal*); minor trait-list articulation.
- **Shared:** core character (warm, dense, textured, flowing SET), 2 W,
  high-efficiency requirement, the defining trade.
- **Cannot honestly distinguish today:** the audible 45-vs-SV83 *system*
  behavior — real in the world, **not authored** as distinct tendency facts;
  the character prose differs in *wording*, not represented behavior.
- **Consequence:** their assessments **should be similar**, differing only in
  identity/price and the slightly different `what-asks` thresholds. Genuine
  differentiation is a **catalog-authoring** task (author 45-vs-SV83 behavioral
  tendencies), surfaced as a Knowledge Opportunity — not a rendering problem.

## Per-question constraints

- **`listen-for` (restrained cue standard).** Admissible: a hedged rendering of
  an emphasized trait as an audible cue ("the midrange carries noticeable body
  and texture"). NOT a cue: a general character line (that folds elsewhere).
  **Prohibited:** any simulated impression — no invented tracks, sessions,
  spatial images, instrument behavior, or sensory detail inferred from a
  tendency label ("you'll hear the rosin lift off the bow" is rejected).
- **`alt-philosophy` (exceptional).** Renders **only** when a decision-material
  capsule contrast changes the *verdict*, the *trade-off's stakes*, or the
  *owner's decision*. If it would merely restate the trade-off, **omit**. Never
  generic "tubes vs solid-state" education.
- **Source references / review consensus.** Corroboration and provenance, not
  claims. They raise `confidence` and may *attribute* an already-admitted,
  system-level claim ("widely regarded as…"); they may never originate a claim,
  populate a question alone, or become a system-level conclusion. Default:
  internal.

## Knowledge Opportunity — omissions become the authoring backlog

Every un-entitled (omitted) question emits a typed record. Omissions are
**reportable internally** and aggregate into the knowledge-authoring backlog —
the product roadmap is *derived from what the assessments could not yet say*.

```
KnowledgeOpportunity {
  question            // which AssessableQuestion went unanswered
  system              // component ids (context)
  reasonClass         // typed (below)
  detail              // which evidence was missing / too weak
  wouldUnlock         // the authoring that would make it answerable
}
```

| reasonClass | Means | Example |
|---|---|---|
| `missing_interaction_rule` | causal facts present, no authored rule | amp↔speaker pairing with no rule |
| `missing_product_specific_distinction` | shared profile, no distinguishing fact | Yamamoto vs Decware behavior |
| `missing_listening_evidence` | no admissible cue evidence | `listen-for` with only generic traits |
| `missing_user_context` | needs room/preference/usage not provided | `what-asks` without a stated room |
| `insufficient_confidence` | evidence below the floor | `editorial_inference`-only caution |
| `generic_only` | evidence exists but is generic, not system-specific | `alt-philosophy` capsule with no decision relevance |
| `redundant` | answer would duplicate a stronger answer | `what-rewards` folding into `what-for` |

**Backlog aggregation.** Count `reasonClass × question` across real assessments;
the most frequent unanswered questions are the highest-value authoring targets
("author the amp→speaker interaction rule — it would unlock `why-works` on N%
of systems"). This closes the loop: **assessment omissions ⇒ prioritized
knowledge authoring.**

## Worked example — SET × O/96 (honest)

| Question | Distinct system-specific claims | Weight | Notes |
|---|---|---|---|
| `what-is-it` / `what-for` | anchors | verdict + standfirst + recognition | always |
| `why-works` | SET×high-efficiency rule (+ trait agreement) | **paragraph** | causal block |
| `defining-trade` | system trades power/dynamics/analytical detail → purity/intimacy | **short paragraph** | owns *cost* |
| `what-asks` | O/96 placement/room demands | **short paragraph** | not the power match |
| `what-rewards` | emphasized warm/textured/flowing | **fold → `what-for`** | overlaps standfirst |
| `upgrade` | source-upgrade-for-clarity | **fold → recommendation** | overlaps cost line |
| `alt-philosophy` | SET vs push-pull (generic) | **omit** | `generic_only` / redundant |
| `listen-for` | one restrained cue (midrange body) | **clause/omit** | fabrication risk |
| `should-change` | anchor | recommendation | always |

**Honest total: recognition + 3 earned paragraphs (why / trade / asks), rewards
+ upgrade folded, ≤1 restrained cue ≈ 450–650 words** — real depth, not
800–1,200. The upper band is a **catalog-authoring** outcome (unlocked via the
Knowledge Opportunities above), not a rendering target.

## Rejection tests (design-level)

1. A single component tendency → **clause only**, never a standalone paragraph.
2. A topology capsule not instantiated to this system → **no `alt-philosophy`**
   (`generic_only`).
3. A source reference alone → **no reader-facing claim** (internal; confidence).
4. Two systems, identical `approvedClaims` → **identical assessments**.
5. A conditional effect whose condition does not match the system → **not admitted**.
6. A `perception`/texture label → **no simulated sensory impression**.
7. Answer colliding on `redundancyKey` → **folded/merged**, not repeated.
8. `editorial_inference`-only evidence → **downgraded** below a system paragraph.
9. `what-rewards` that reduces to the standfirst when names are stripped →
   **folded, not sectioned** (boilerplate test).
10. Every omission emits a **typed `KnowledgeOpportunity`** (no silent gaps).

## Non-goals
Not making every assessment long; not adding facts, rules, confidence, or
provenance in the renderer; not verbosity; not artificial differentiation.
Length and richness are always *consequences* of evidence density.

## Status
**FROZEN 2026-07-26.** Governing design for future assessment work. Implementation
(engine entitlement pass, renderer weighting, KnowledgeOpportunity reporting)
is a later, separately-approved work package. Not started.
