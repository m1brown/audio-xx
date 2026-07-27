# Causal Explanation — Architecture v1 (design only, not implemented)

Status: **DESIGN — approved in principle 2026-07-25; do not implement yet.**
Scope: the first post-launch flagship. Evolve the System Assessment from
*describing outcomes* to *explaining mechanisms*, without weakening the factual
restraint and graph-integrity doctrines established during certification.

This document is the required design deliverable. It defines the intermediate
types, the provenance/confidence model, the three-level epistemic separation,
the claim-admission predicates, deterministic composition, fallback, Phase 1
scope, before/after outputs, falsification tests, and success criteria.

---

## 0. The one invariant this whole design exists to protect

> **Two verified facts about two components do NOT verify a claim about their
> interaction. An interaction claim is admissible only when an *authored,
> provenance-backed InteractionRule* exists for it. No rule ⇒ no causal
> sentence.**

Everything below is machinery to make that invariant enforceable and testable.
The failure mode we are engineering against is *"a machine that combines
individually true facts into collectively speculative explanations."*

---

## 0a. Doctrine D-7 — Epistemic Fidelity (governing doctrine)

> **Audio XX expresses only claims supported by its licensed evidence. The
> confidence, specificity, and wording of every generated statement must not
> exceed the confidence, specificity, and wording of the evidence that licenses
> it. Where evidence is interpretive rather than primary, the prose must reflect
> that distinction. When accuracy and eloquence conflict, accuracy prevails.**

This is not only about avoiding errors — it defines the editorial identity of the
product. Users may never read the doctrine, but they experience it as a system
that is unusually careful about what it claims, and that restraint is a
differentiator.

**Epistemic categories are distinct and must remain distinct** throughout the
knowledge model *and* the generated prose. A claim may not be promoted across
these categories without evidence to match:

1. objective specification
2. manufacturer statement
3. designer intent
4. measurement
5. reviewer / community consensus
6. editorial inference

Practical consequences:
- A `manufacturer_intent` basis may license prose that names manufacturer intent;
  it may **not** license prose that asserts a narrower, reviewer-originated
  reading as if the manufacturer stated it. (Worked precedent: the DeVore O/96 —
  the manufacturer states "designed especially for low-powered *tube*
  amplifiers"; "SET-specific" suitability is review-consensus / engineering
  inference and is worded as such. See the 2026-07-27 knowledge audit.)
- Widely-held belief is **not** a licence. Do not upgrade a claim because it is
  commonly repeated.
- The system must be willing to **weaken** a claim when the evidence requires it.
  Weakening a claim to match its evidence is a success state, not a regression.

D-7 governs both this causal architecture and the
`assessment-expansion-architecture-v1` knowledge model; it sits alongside the
§0 anti-fact-join invariant as a standing epistemic constraint.

---

## 0b. Doctrine D-8 — Recommendation Licensing (governing doctrine)

> **A recommendation may be generated only from something the assessment has
> established:**
> - **an identified limitation;**
> - **an explicit trade-off, where a change is relevant;**
> - **a stated listener priority.**
>
> **A tonal characteristic, design choice, or system tendency must not be
> converted into a hypothetical deficiency merely to create an upgrade path.
> When no action is licensed, the correct recommendation is no change. The
> recommendation must never exceed, contradict, or introduce a condition absent
> from the assessment that licenses it.**

Where D-7 governs whether a *claim* is supported by its evidence, D-8 governs
whether a *recommendation* is supported by the assessment. It is the
recommendation-layer analog of the §0 anti-fact-join invariant: no license ⇒ no
action. A system characteristic is not a defect, and must not be converted into
one merely to create a recommendation.

**Worked precedent — DeVore O/96 × elastic character (2026-07-27).**
- The system's *elastic* tonal character was previously converted into the
  unsupported hypothetical that it might feel **"loose or uncontrolled."**
- The assessment had established no such weakness — the system was judged
  coherent.
- That recommendation was therefore **removed**. The generator that fabricated
  it (a tonal-lean → hypothetical-deficiency composer) was retired at its
  source, and forward-looking upgrade prose no longer appears inside the
  Assessment section.

**License-state note.** The recommendation layer carries a typed license state
— `identified limitation` / `explicit trade-off` / `stated listener priority` /
`none` — and renders an explicit no-change recommendation when the license is
`none`. `explicit trade-off` and `stated listener priority` are **reserved**
states: as of this writing the pipeline does not yet capture a stated listener
priority as a directed action, so those states are defined for the doctrine but
not yet produced. Before `stated listener priority` becomes a real production
state, its behaviour must be made explicit (a stated priority must license a
*directed* recommendation, never a fabricated deficiency).

D-8 governs this causal architecture and the assessment renderer; it sits
alongside D-7 and the §0 invariant as a standing constraint.

---

## 0c. Doctrine D-10 — Resolution (governing doctrine)

> **Audio XX always writes at the highest resolution its evidence licenses. When
> more than one licensed explanation is available, prefer, in order: (1) an
> interaction-specific fact; (2) a component-specific fact; (3) a
> topology-specific fact; (4) the system archetype. System archetypes are
> fallback explanations, not preferred ones.**

Where D-7 governs whether a claim is *true* to its evidence, D-10 governs whether
the prose is *specific* to its evidence. The engine already computes per-component
particulars (per-component axes, tendencies, placement sensitivity, topology,
catalog interactions, causal facts); the failure mode D-10 guards against is
collapsing those to a system-level archetype *before* generating prose and then
narrating the average. Particularity is what the reader experiences; resolution
is what the architecture enforces.

Worked precedent (2026-07-27): the trade-off paragraph was routed to prefer a
component-specific limitation (e.g. a speaker's sealed-box placement trade) over
the axis-derived archetype trade-off ("transient edge and analytical detail",
identical across every warm system). Repeated *structure* is acceptable; repeated
*insight* is the failure.

---

## 0d. Doctrine D-11 — Explanatory Licensing (governing doctrine)

> **A component may be identified as the primary limitation only when the
> diagnosis is licensed by an identified interaction, constraint, or mismatch
> within the assessed system. A component's intrinsic character, tuning, or
> measured tendency is not sufficient to diagnose it as the bottleneck. Trait
> thresholds may contribute supporting evidence but may not independently
> determine the primary diagnosis.**
>
> **Listener priorities may influence recommendations, but they may not create
> or elevate a primary diagnosis unsupported by the assessed system.**

D-11 is the diagnosis-layer sibling of D-8 (which governs recommendations) and of
the §0 anti-fact-join invariant. Where D-8 stops a *recommendation* exceeding the
assessment, D-11 stops a *diagnosis* being conjured from a component's character.
A system characteristic is not a defect, and must not be converted into one
merely to produce a bottleneck.

**Strict interpretation (adopted).** A solo trait threshold can *never* become
the primary bottleneck. Primary diagnoses require a licensed interaction /
mismatch / constraint (e.g. a power/sensitivity mismatch; a portable-DAC-in-a-
speaker-system capability mismatch). There is no corroborated-heuristic exception
in the current envelope. When no licensed candidate exists there is **no primary
bottleneck** — the engine never falls back to the least-bad component. Unlicensed
trait signals may still inform the assessment body, never the primary diagnosis.

**Worked precedent — the Chord Qutest (2026-07-27).** A reference-class DAC with a
deliberately neutral voicing (`tonal_density: 0.4`, its character) was being
emitted as "The DAC is holding the system back" — a defect diagnosed from its
tuning — and thereby drove the title, verdict, and recommendation of reference
systems (Pass Labs / Magico, Klipsch / Leben). Under D-11 those systems return a
coherent verdict; the genuine 2W-SET-into-Magico power mismatch still fires,
because it is a licensed interaction.

**Superseded feature.** The former *intent-aware bottleneck promotion* (which
elevated a tonal characteristic to "Highest Impact" when a listener wanted the
opposite trait) is removed as diagnostic logic — a listener priority may not
create a primary diagnosis. It may return, if at all, only as a
**recommendation-layer** capability, never as diagnosis. (Deferred; see
`AudioXX_Architecture_Backlog.md`.)

D-11 governs the bottleneck-selection layer (`detectPrimaryConstraint`) and the
artifact's verdict/recommendation derivation; it sits alongside D-7, D-8, D-10,
and the §0 invariant as a standing constraint.

---

## 1. Diagnosis (why the current assessment is structurally thin)

`synthesizeArtifact.ts` composes Evidence prose from two inputs:

- **aggregate trait direction** (warm / bright / neutral), and
- **axis-agreement counts** ("3 of 4 components lean detailed").

Both are pure functions of the component list. By construction the output can
only ever *restate what the list already implies* — which is exactly why an
experienced reader learns nothing. The unit of composition is the component's
*position on an axis*, and positions are inferable from the list.

Insight lives on the **edges** between components. The current pipeline has no
representation of an edge, and never consults the one knowledge asset that does
model edges.

### The unused asset
`src/lib/topology-philosophy.ts` already holds authored, certification-grade
capsules for ~11 design traditions (R2R, NOS, FPGA, delta-sigma, SET,
push-pull, Class A, low-feedback, horn, BBC thin-wall). Each carries
`mechanism`, `tradeoffs`, `behavior`, `perception`, `misconceptions`,
`pairingImplication`, `canonicalExamples`. **It is not imported by
`synthesizeArtifact`.** The DAC catalog carries a structured `topology` enum
(e.g. Chord Hugo = `fpga`); amplifiers and speakers do **not** yet carry a
topology tag or structured impedance/crossover/loading fields.

> Honest consequence for scoping: `pairingImplication` is a *one-sided
> disposition* of a single topology ("what reinforces or fights R2R"). It is a
> **source** for authoring InteractionRules — it is **not itself** a
> two-property interaction rule. The composer must not treat it as one.

---

## 2. Provenance & confidence representation (reuse, don't reinvent)

The catalog already grades claims by provenance via a `basis` field. Observed
usage today: `review_consensus` (674), `listener_consensus` (218),
`editorial_inference` (115), `founder_reference` (61), `owner_reference` (15),
`manufacturer_intent` (4). We formalize this into an ordered tier and reuse it
everywhere in the causal layer.

```ts
// Ordered strongest → weakest. The ordering is load-bearing: it sets the
// confidence floor for admission and forbids weak-source interaction rules.
export type ProvenanceBasis =
  | 'measured'            // instrumented measurement (new; strongest)
  | 'manufacturer_intent' // stated design intent
  | 'founder_reference'   // founder's calibrated listening reference
  | 'review_consensus'    // convergent professional reviews
  | 'listener_consensus'  // convergent owner/community listening
  | 'owner_reference'     // single owner report
  | 'editorial_inference' // reasoned editorial synthesis (weakest)
  | 'authored_rule';      // an InteractionRule's own provenance marker

export type Confidence = 'high' | 'medium' | 'low'; // mirrors BrandConfidence

// A provenance record travels with every fact, rule, and inference.
export interface Provenance {
  basis: ProvenanceBasis;
  sources?: ReadonlyArray<{ label: string; url?: string }>;
  note?: string;
}
```

**Hard provenance rule:** an `InteractionRule` may **not** be authored on
`editorial_inference` or `owner_reference` alone. Interaction claims are the
highest-risk output in the product; they require a `basis` of `review_consensus`
or stronger, *and* an explicit author sign-off recorded on the rule.

---

## 3. The three-level epistemic separation (the core of the design)

Three distinct types, with a one-directional dependency and a firewall between
levels 1 and 2.

### 3.1 `ComponentFact` — a verified fact about ONE component or topology
```ts
// A typed property key. The key space is closed — new keys are a deliberate,
// reviewed change, because each key is a promise that a structured fact exists.
export type ComponentPropertyKey =
  | 'topology'                 // maps to a TopologyCapsule (DACs today)
  | `tendency:${string}`       // a tendencyProfile domain (all categories)
  | `conditional:${string}`    // a catalog conditionalEffect (has its own basis)
  | 'output_impedance'         // NOT YET STRUCTURED — Phase 3 authoring
  | 'crossover_order'          // NOT YET STRUCTURED — Phase 3 authoring
  | 'nominal_load'             // NOT YET STRUCTURED — Phase 3 authoring
  | 'sensitivity_db';          // partially present (DAC type has sensitivity_db)

export interface ComponentFact {
  componentId: string;            // resolved catalog id — never a bare string
  key: ComponentPropertyKey;
  value: string | number;
  mechanismRef?: TopologyId;      // link to a TopologyCapsule when key==='topology'
  provenance: Provenance;
  confidence: Confidence;
}
```
A `ComponentFact` is only ever produced by **reading existing structured
catalog/capsule data**. It never comes from prose parsing or inference. If the
structured field is absent, the fact does not exist — full stop.

### 3.2 `InteractionRule` — AUTHORED knowledge about how two properties interact
This is the new, human-authored knowledge asset. It is the *only* thing that
can license an interaction claim. It connects two **property predicates** (not
two products) and must carry a contrastive consequence.

```ts
export interface PropertyPredicate {
  role: 'source' | 'amp' | 'speaker'; // which system position this side binds to
  key: ComponentPropertyKey;
  // Predicate over the bound ComponentFact's value. Authored, total, pure.
  match: (fact: ComponentFact) => boolean;
}

export interface InteractionRule {
  id: string;
  upstream: PropertyPredicate;   // the two properties the rule connects
  downstream: PropertyPredicate;
  // Authored causal content. Prose is verified at authoring time, not generated.
  mechanism: string;             // WHY these two properties interact
  consequence: string;           // the resulting audible/behavioural effect
  // REQUIRED. This is what makes the claim non-generic (see predicate P4).
  contrast: {
    alternative: string;         // a plausible alternative downstream/upstream choice
    differingConsequence: string;// how the audible result would differ under it
  };
  suppressWhen?: (facts: ReadonlyArray<ComponentFact>) => boolean; // conflict guards
  provenance: Provenance;        // basis >= review_consensus; author sign-off in note
  confidence: Confidence;
  // ── Authoring lifecycle (see §3.4). Only status==='approved' emits prose. ──
  status: RuleStatus;
  authoredBy: string;            // drafter
  reviewedBy?: string;           // founder / reviewer who set reviewed|approved|rejected
  statusHistory: ReadonlyArray<{ status: RuleStatus; by: string; date: string }>;
}
```
Authoring an `InteractionRule` is a reviewed knowledge-base change, held to the
same bar as a catalog edit. The rule set is small, explicit, and greppable.

### 3.3 `InteractionInference` — applying ONE rule to THIS system
```ts
export interface InteractionInference {
  ruleId: string;
  edge: { fromId: string; toId: string; fromRole: string; toRole: string };
  boundFacts: readonly [ComponentFact, ComponentFact]; // upstream, downstream
  // Assembled claim, bound to the actual component names. No new causal content
  // is created here — only substitution of rule text with the bound components.
  claim: { mechanism: string; consequence: string; contrast: string };
  provenanceChain: ReadonlyArray<Provenance>; // 2 facts + 1 rule, minimum
  confidence: Confidence;        // = min(confidence) across the chain
  admission: AdmissionResult;    // see §4
}
```

**The firewall:** the composer may construct an `InteractionInference` **only**
from `(ruleId, boundFacts)` where the rule's two predicates are satisfied by two
real `ComponentFact`s. There is **no code path** that produces an interaction
claim from facts alone. That absence is the invariant in §0, and §7 tests assert
it directly.

### 3.4 Authoring & review lifecycle (founder review, 2026-07-25)

Both new knowledge assets — `InteractionRule`s and any newly-authored
structured `ComponentFact`s — enter through an explicit review lifecycle. Nothing
generates public prose until a human has approved it. Rules and facts are stored
as **authored knowledge (data files), never embedded in composer code.**

```ts
export type RuleStatus =
  | 'draft'     // project-drafted; NEVER emits prose
  | 'reviewed'  // founder has read it; still NOT active
  | 'approved'  // the ONLY status that may generate public assessment prose
  | 'rejected'  // declined; retained for the record, never active
  | 'retired';  // was approved, since withdrawn; never active

// Authoring wrapper carried by every newly-authored structured ComponentFact.
// (Facts read directly from the existing catalog inherit that entry's own
// `basis`; this wrapper is for NEW structured facts added for the causal layer.)
export interface AuthoredFactRecord {
  fact: ComponentFact;
  provenance: Provenance;       // source/basis — never marketing prose or model output
  confidence: Confidence;
  authoredBy: string;
  reviewedBy?: string;
  status: RuleStatus;           // same lifecycle; only 'approved' is consumable
  date: string;                 // ISO date of last status change
  claimScope: string;           // EXACT scope of the claim (e.g. "Hugo v1 only, not Hugo 2")
}
```

Rules governing the lifecycle:
- **`approved`-only consumption.** The composer filters `INTERACTION_RULES` and
  authored facts to `status === 'approved'` before anything runs. A `draft`
  rule cannot affect output even if its predicates match. (Tested in §9.)
- **No silent promotion.** A fact may **not** be created by extracting from
  marketing prose, reviews, or a model-generated summary and promoted to
  verified. The engine *consumes* approved facts; it never *creates* them.
- **Auditability.** `statusHistory` / `date` record who moved a rule or fact to
  each state and when, so any live causal sentence is traceable to an approval.

---

## 4. Claim-admission predicates (the strengthened inferability gate)

An `InteractionInference` becomes a sentence **only if it passes all six**. The
critical addition over the first proposal is **P4 (contrastive consequence)** —
naming a mechanism term is not enough.

```ts
export interface AdmissionResult { passed: boolean; failed?: string[] }
```

- **P1 — Provenance / anti-fact-join.** The inference is backed by exactly one
  authored `InteractionRule` whose two predicates are satisfied by two real
  `ComponentFact`s. *No rule ⇒ reject.* (Enforces §0.)
- **P2 — Connection.** The claim references **≥2 named system elements**. A
  single-component observation is never a causal claim.
- **P3 — Mechanism.** The claim names a **verified mechanism** carried by a
  fact or the rule (`FPGA/WTA timing reconstruction`, `output impedance vs.
  nominal load`), not a trait label (`detailed`, `warm`).
- **P4 — Contrastive consequence (NEW, the core rigor).** The claim must state
  an audible/behavioural consequence **and** explain *why this combination
  behaves differently from a plausible alternative combination*. Operationally:
  the bound rule's `contrast` must be present and non-trivial. This rejects
  "The FPGA reconstruction filter preserves timing into the amplifier" —
  true-sounding decoration with no system consequence — because it names no
  alternative and no differing outcome.
- **P5 — Non-inferability.** The consequence must **not** be recoverable from
  the components' trait labels alone. If the sentence survives deleting every
  mechanism/contrast token and still reads as the trait summary, it fails.
- **P6 — Confidence floor.** `min(confidence over the provenance chain) ≥
  medium`. A rule or fact at `low` cannot emit prose.

**Admission is logged, not just boolean.** Every rejected inference records
which predicate failed, so the Phase 1 evaluation can show *why* the engine
stayed silent — silence must be auditable, per the restraint doctrine.

---

## 5. Deterministic composition rules (Phase 1 — no LLM)

```
buildCausalEvidence(system):
  edges = orderedEdges(system)            # source→amp, amp→speaker, source→speaker
  claims = []
  for edge in edges:
    facts = componentFacts(edge.from) ∪ componentFacts(edge.to)   # read-only
    for rule in INTERACTION_RULES where rule.appliesTo(edge.roles):
      if rule.upstream.match(fact_on(edge.from)) and
         rule.downstream.match(fact_on(edge.to)) and
         not rule.suppressWhen(facts):
        inf = instantiate(rule, boundFacts)      # substitution only — no new content
        inf.admission = runPredicates(inf)       # P1..P6
        if inf.admission.passed: claims.push(inf)
  claims = dedupeByMechanism(claims)
  claims = rankBy(confidence desc, then edge salience: amp→speaker > source→amp)
  claims = cap(claims, perEdge=1, perAssessment=3)   # protect restraint & length
  if claims.isEmpty: return RESTRAINT_FALLBACK        # §6
  return renderDeterministic(claims)                  # fixed templates, no LLM
```

- **Substitution only.** `instantiate()` fills the rule's authored
  `mechanism/consequence/contrast` with the bound component display names. It
  adds no causal content, no history, no confidence.
- **No LLM in Phase 1.** The claim object (*what may be said, why, which
  components, intended consequence, confidence, provenance*) is fully determined
  by the engine. A later, optional LLM layer may only **rephrase a completed
  claim object** for syntax variation / de-repetition. It must never introduce
  mechanisms, add history, strengthen confidence, alter the causal relation, or
  supply a missing interaction. (Founder decision, recorded.)
- **Caps are a restraint device.** At most one claim per edge and three per
  assessment. More than that reads as a technical appendix, not insight.

---

## 6. Fallback when causal knowledge is absent

When no inference is admitted for a system (the common case until the rule set
and fact vocabulary grow), the Evidence section renders the **current
trait-aggregate prose unchanged**. That output is honest — merely shallow — and
is exactly the certified restraint behaviour. Per-edge silence is also
fallback: an edge with no admitted claim contributes nothing rather than a
padded sentence. **The assessment is never longer for lack of knowledge.**

This makes the growth path *knowledge authoring, not engine change* — the right
shape for a one-founder product: editable data, not accumulating code.

---

## 7. Phase 1 scope (narrower than "all DAC edges")

Phase 1 proves the **epistemic architecture** on the smallest surface that can
falsify it. It does **not** connect the topology library to every eligible DAC.

**Included:**
- The three intermediate types (§3), the six predicates (§4), deterministic
  composition (§5), fallback (§6).
- A **temporary labelled "Why it sounds this way" block** for evaluation only —
  explicitly NOT the final presentation (see §11). Behind a new
  `NEXT_PUBLIC_CAUSAL_EXPLANATION` flag, Preview-only, default off.
- **2–3 authored `InteractionRule`s**, each keyed to a **structured fact that
  already exists** — i.e. the DAC `topology` enum on the upstream side, matched
  against a downstream `tendency:*` domain that is genuinely present. Example
  rule *shape* (content subject to authoring review):
  `fpga-source × time-incoherent-downstream → timing-preservation contrast`.
- **1–2 benchmark systems chosen for full support**, where: component identity
  is reliable, the upstream topology fact is verified, the InteractionRule is
  explicitly authored, and the audible consequence is defensible.

**Explicitly excluded from Phase 1:**
- The Hugo–Job–WLM system as a *causal* benchmark **unless** the required facts
  exist. They do not today: Job (`job-integrated`) and WLM (`wlm-diva-monitor`)
  are cataloged for identity, but neither carries a structured
  `output_impedance` / `crossover_order` / `nominal_load` fact. **We will not
  fill those by inference.** Hugo–Job–WLM is retained only as a *restraint
  benchmark*: it must continue to fall back cleanly (as it does live today) and
  emit **zero** causal sentences until those facts and a rule are authored.
- Extending topology tags to amps/speakers (that is Phase 3 authoring).
- Any LLM involvement.

**Later phases (named, not scheduled):** Phase 2 — refactor Evidence to
edge-iteration with fallback as the default path. Phase 3 — author structured
`output_impedance`/`crossover_order`/`nominal_load` facts + amp/speaker topology
tags (unlocks the amp→speaker edge where most character lives, and the
Hugo–Job–WLM explanation). Phase 4 — author the canonical InteractionRule set.
Phase 5 — optional constrained LLM rephrasing.

---

## 8. Representative before / after

**BEFORE (live production today — real output, restraint case):**
> This system is built for resolution and detail, with composure left to the
> speaker. Eversolo DMP-A6 and Chord Hugo and Job integrated resolve cleanly;
> WLM Diva monitor keeps the result musical rather than analytical. … Why it
> hangs together: on ease vs. resolution, 3 of the 4 components lean the same
> way (detailed).

Every clause is inferable from the component list. This system **stays exactly
this** under Phase 1 (no facts/rule authored for it) — that is the correct,
restrained result, not a gap to paper over.

**AFTER (target — only for a fully-supported system, with the provenance chain
shown).** Illustrative shape for a system where an authored rule fires:
> *Mechanism + contrast:* "Because the [R2R source] reconstructs without a
> long interpolation filter, it hands the [amp] a signal whose leading-edge
> timing is intact; paired with a [time-coherent monitor] that doesn't reorder
> it in the crossover, the system keeps attack transients whole. A
> higher-order crossover in the same slot would trade some of that startle for
> flatter on-axis response — this system has chosen the former."
> `provenance: rule=r2r×time-coherent (review_consensus, authored 2026-…);
> facts: source.topology=r2r (manufacturer_intent), speaker.tendency:timing
> (review_consensus); confidence=medium`

The AFTER is **not** rendered for any system lacking that chain. It is shown
here to define the target, not to claim it for Hugo–Job–WLM.

---

## 9. Tests that would falsify or reject an unsupported claim

These are the acceptance tests; several are written to *fail the naive design*.

1. **Anti-fact-join (the central test).** Construct a system with two verified
   `ComponentFact`s and **no** matching `InteractionRule`. Assert
   `buildCausalEvidence` emits **zero** causal sentences and falls back. This is
   the test the founder's concern demands.
2. **Rule requires a fact that is absent.** Author a rule whose downstream
   predicate needs `crossover_order`; give a speaker with no such fact. Assert
   the rule does not fire.
3. **Contrastive-consequence gate (P4).** Feed an inference whose rule has an
   empty/trivial `contrast`. Assert rejection with `failed: ['P4']`. Guards
   against topology-vocabulary decoration.
4. **Non-inferability gate (P5).** Feed a candidate that reduces to the trait
   summary when mechanism/contrast tokens are removed. Assert rejection.
5. **Confidence floor (P6).** Set one chain element to `low`. Assert no prose.
6. **Weak-provenance rule rejected at authoring.** A rule authored with
   `basis: 'editorial_inference'` fails a static validation test of the rule set.
7. **Provenance-chain completeness.** Every emitted sentence resolves to ≥2
   `ComponentFact`s + exactly one `InteractionRule`; assert no orphan claims.
8. **Golden pair.** With one authored rule + the two required facts present,
   assert the expected sentence renders; **delete the rule** → assert clean
   restraint fallback (same system, zero causal prose).
9. **Restraint regression.** The existing factual-restraint and graph-integrity
   suites still pass unchanged; Hugo–Job–WLM emits zero causal sentences.
10. **Length invariant.** For any system with no admitted claims, causal-mode
    output is byte-identical to flag-off output (no padding).

---

## 10. Success criteria — is it *genuinely* more illuminating?

**The primary risk is no longer hallucination; it is generic technical prose
that passes the formal gates but teaches nothing** (founder, 2026-07-25).
Approval or "sounds more technical" is NOT a success signal. Phase 1 compares the
current vs. causal version of each benchmark against six explicit tests — every
one must pass:

1. **Combination-caused difference.** Does the output explain a difference
   caused by *the combination*, not a property of one component?
2. **Traceability.** Is every causal step traceable to an approved fact + rule?
3. **Distinguishable from generic topology commentary.** Could an experienced
   reader tell this from a boilerplate "R2R sounds dense" capsule?
4. **No unsupported-component claims.** Does it avoid asserting anything about
   components whose facts are absent?
5. **Denser, not longer.** Materially more informative without becoming
   materially longer.
6. **Boilerplate test (decisive).** Remove the component names — is the sentence
   still obviously specific to *this* interaction, or could it be pasted
   unchanged into many systems? A reusable sentence is not explanatory. This is
   the test that catches gate-passing generic prose, and benchmark selection is
   tuned to expose it early.

A causal sentence ships only if it passes all six on its benchmark. The
quantitative/adjudicated measures below support these, measured only on the
flagged Phase 1 build:

- **Causal ratio (supported systems).** Fraction of Evidence sentences passing
  P1–P6 rises from ~0 to a meaningful floor on the benchmark systems — **without
  increasing sentence count on unsupported systems.**
- **Blind inferability audit.** Show an experienced enthusiast the component
  list, then the assessment; they mark each sentence "could / could not have
  inferred this from the list." Target: supported systems produce ≥1 "could not"
  sentence that they also judge *correct*. This is the operational form of
  "I hadn't looked at the system that way before."
- **Zero unsupported causal claims.** Fuzz every catalog system through
  causal-mode; assert not a single emitted causal sentence lacks a full
  provenance chain. A single violation fails the phase.
- **Restraint preserved.** Unsupported systems produce equal-or-shorter output;
  no regression in the restraint / graph-integrity suites.
- **Maintainability.** A new InteractionRule can be added as one reviewed data
  entry with no engine change; adding one is demonstrated in the phase.

The bar is deliberately asymmetric: **more insight where knowledge exists, never
one manufactured claim where it doesn't.**

---

## 11. Presentation intent (founder decision, recorded)

Long-term, causal explanation is **integrated into the main narrative**, not a
permanent appendix. The assessment's intended movement:

1. What is this system?
2. Why does it behave that way? (the new causal content, woven in)
3. What does that mean for the listener?
4. What, if anything, should change?

The Phase 1 labelled "Why it sounds this way" block is an **evaluation
scaffold** only, so the new output can be compared cleanly; it is not assumed to
be the final placement.

---

## 12. Open decisions for the founder before Phase 1 build

1. **Benchmark selection.** Approve using a fully-supported R2R (or NOS) source
   system as the Phase 1 causal benchmark, with Hugo–Job–WLM held as the
   restraint benchmark — or nominate a specific system you want proven first
   (I will first verify the required facts + authorable rule genuinely exist).
2. **Rule authoring authority.** InteractionRules are verified knowledge. Do you
   author/sign them, or review drafts I prepare from existing verified sources
   (topology capsules + convergent reviews), with your `authoredBy` sign-off?
3. **Fact vocabulary expansion.** Confirm that adding structured
   `output_impedance` / `crossover_order` / `nominal_load` fields (Phase 3) is
   authored knowledge work gated at the same bar as catalog edits — i.e. not
   inferred from description prose.

No implementation will begin until these are settled.
