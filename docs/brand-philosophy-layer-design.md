# Audio XX — Brand Philosophy Layer Design Memo

**Status:** v1 design memo — refined against the editorial-review memo's structural recommendations. No implementation.
**Created:** 2026-05-10 (v0); revised 2026-05-10 (v1).
**Companion documents:** [`brand-philosophy-master-table.md`](brand-philosophy-master-table.md), [`brand-philosophy-editorial-review.md`](brand-philosophy-editorial-review.md), [`brand-philosophy-master-table.csv`](brand-philosophy-master-table.csv).

---

## 1. Why this layer matters

Audio XX's central claim is that it reasons about products as expressions of design philosophy and engineering trade-offs, not as items in a database to be scored or ranked. The credibility of every advisory output depends on the system's ability to keep manufacturer identities coherent throughout reasoning — particularly during synthesis, where the engine must compose comparisons or recommendations from underlying trait data without losing the thread of *who this brand is and what it is trying to do*.

The Topping vs Denafrips regression of 2026-05-10 demonstrated the failure mode this layer is meant to prevent. The catalog data was correct. The brand profiles were correct. The product-level axis values for Topping clearly classified it as bright / detailed / lean. Yet the synthesis layer produced output describing Topping as having a "warm harmonic character" — directly inverting the brand's measurement-forward identity. The fix (`stripNegatedClauses`) closed that specific hole. The underlying vulnerability — synthesis collapsing distinct manufacturer identities into a small set of pre-formed adjective fragments — is structural.

Without an editorially-curated, version-controlled, structurally-discoverable manufacturer identity layer, the system is one regex away from another similar regression at any time. The layer is the canonical reference that synthesis output is checked against. When synthesis contradicts the canonical record, the contradiction is observable. When new brands are added, they are added through editorial discipline rather than accreting from product entries.

This is foundational infrastructure for: comparisons, recommendations, upgrade guidance, system matching, trade-off reasoning, and used-market advisory workflows. All of these rely on stable manufacturer identity to produce credible output.

---

## 2. Where current synthesis is vulnerable

Six structural vulnerability classes in the current codebase. The first four were diagnosed in v0; the last two have been clarified through the editorial-review pass.

### 2.1. Negation-blind regex matching

The Topping regression. Matchers like `extractSonicTraits` and `buildTradeoffStatement` operate by running keyword regexes against lowercased prose, without honouring clause-level negation. Partially fixed by `stripNegatedClauses` in commit `7cee216`. The vulnerability remains anywhere prose tendency text is consumed by a keyword matcher that does not consult the philosophy layer.

### 2.2. Adjective-bucket conflation

The synthesis layer's keyword groupings (`warmWords`, `controlWords`) treat genuinely distinct trait concepts as substitutes. Editorial-review memo § 2 establishes the calibrated trait vocabulary that distinguishes them. Until the synthesis layer consumes capsule-level identity rather than scoring against bucketed keywords, these conflations remain.

### 2.3. The dominant-axis classifier

`buildTradeoffStatement` reduces every brand to one of four axes — `warm`, `control`, `flow`, `neutral`. Brands whose identity lives outside these axes (dCS's resolution-with-smoothness, Boenicke's spatial dimensionality, Naim's timing-domain accuracy, Goldmund's mechanical-resonance management) get squeezed into the closest axis, which is identity loss.

### 2.4. Brand identity loss across multi-step synthesis

Brand-vs-brand comparison runs through `buildBrandComparison → buildInitialComparisonPayload → extractSonicTraits + buildTradeoffStatement → renderComparisonPayload`. Each step transforms prose into derived data; the further from source, the more lossy. No stage runs a canonical identity check. If Topping is mis-framed as warm at any synthesis stage, no downstream validator currently notices.

### 2.5. Single-identity assumption for multi-line brands

Schiit, Gustard, McIntosh, Lampizator, Spendor, Wilson Audio (and to varying degrees Cayin, PrimaLuna, NAD, Marantz) span topology / voicing philosophies that no single capsule can compress without distortion. The current synthesis path treats each as a single voice. The v1 master table flags these brands with `multiLineBrand: true` and the editorial-review memo § 7.5 states the corresponding rule: synthesis must not produce brand-level output for these brands without a model anchor.

### 2.6. Trait-synthesizing rather than identity-reasoning

Even with negation-stripping, even with calibrated vocabulary, the current synthesis layer fundamentally *synthesizes traits*: it extracts adjectives from prose, scores them, and assembles framings. Trait synthesis is structurally different from identity reasoning. Identity reasoning starts from "what is this brand engineering around" and produces framings consistent with that engineering. Trait synthesis starts from words and produces phrase fragments. The editorial-review memo § 6 documents specific examples in the codebase. The philosophy layer's primary contribution is to replace trait synthesis with identity reasoning at synthesis-layer entry points.

---

## 3. How manufacturer identity should influence advisory reasoning

The brand-philosophy layer should function as a **canonical constraint** on synthesis output, not as additional input data. The distinction matters: input data flows through synthesis and gets transformed (and potentially distorted). A canonical constraint sits beside synthesis and rejects output that contradicts it.

Three integration points:

### 3.1. Pre-synthesis identity hydration

Before synthesis runs on a brand-vs-brand comparison or a recommendation, both subjects are augmented with their canonical capsule. Synthesis reads `comparisonGuardrails.prefer` for contrastive framing, `sonicTendencies` for calibrated trait language, and `engineeringPriorities` for design-intent framing. The result: synthesis composes identity-coherent framings rather than synthesizing them from prose.

### 3.2. Output validation against mischaracterizations

After synthesis produces a draft response, the response is checked against each named brand's `mischaracterizationsToAvoid` list. If the output contains a forbidden framing — "Topping has warm harmonic character" — the validator flags it. The `validateComparisonOutput` function already runs after rendering; the philosophy layer extends what it can check.

The mischaracterization field is structured (§ 5 below), not a bare string list, to avoid false-positive triggers on legitimate contrastive framings.

### 3.3. Comparison routing

For brand-vs-brand comparisons, the philosophy layer's `comparisonGuardrails.prefer` provides the *preferred contrastive framing* for each brand. The synthesis layer composes from both sides' preferred framings. For Denafrips vs Topping, the layer supplies "discrete R2R ladder conversion engineered for harmonic continuity vs measurement-forward delta-sigma engineering optimised for chip-implementation transparency" — the framing comes from the capsules, not from regex on prose.

These three integration points respect a key constraint: the philosophy layer never decides *what* a recommendation is. The decision logic remains in the existing reasoning pipeline. The philosophy layer prevents that pipeline from producing identity-incoherent output.

---

## 4. Schema (v1)

The v1 schema is tighter than v0. Two material changes: `mischaracterizationsToAvoid` becomes a structured pattern type (§ 5), and the field set is now classified as engine-internal vs UI-appropriate (§ 4.2).

### 4.1. Type sketch

```ts
interface BrandPhilosophy {
  // Identity (mostly mechanical)
  brand: string;
  aliases?: string[];
  primaryCategories: ProductCategory[];

  // Curated identity (the editorial substance)
  designPhilosophy: string;          // 1–2 sentences, engineering intent first
  engineeringPriorities: string[];   // ordered list, most important first
  sonicTendencies: string;           // calibrated trait vocabulary; downstream of design intent
  strengths: string[];               // ordered, short, specific
  tradeoffs: string[];               // ordered, short, specific
  listenerArchetype: string;         // who this brand serves
  measurementVsExperiential:
    | 'strongly-measurement'
    | 'measurement-leaning'
    | 'hybrid'
    | 'experiential-leaning'
    | 'strongly-experiential';

  // Synthesis constraints (engine-only; never user-facing)
  comparisonGuardrails: {
    prefer: string[];                // contrastive framings to use
    avoid: string[];                 // contrastive framings to NOT use
  };
  mischaracterizationsToAvoid: MischaracterizationPattern[];  // see § 5

  // Editorial metadata (engine-only)
  confidence: 'high' | 'medium-high' | 'medium' | 'low';
  reviewNotes?: string;
  inCatalog: boolean;
  multiLineBrand?: boolean;
  lastReviewed?: string;             // ISO date
}

interface MischaracterizationPattern {
  pattern: string;                   // the disallowed framing
  appliesWhen: 'subject_is_brand' | 'brand_appears_in_text';
  excludedContexts?: string[];       // contexts where this pattern is permitted
  severity: 'high' | 'medium' | 'low';
                                     // high: validator blocks; medium: warns; low: logs
}
```

### 4.2. Field classification: engine-only vs UI-appropriate

The capsule contains two kinds of content. Some fields are appropriate for user-facing display (in advisory output, brand pages, comparison artifacts). Others are engine-internal — synthesis constraints and editorial metadata that should never reach a user interface.

| Field | Classification | Notes |
|---|---|---|
| `brand` | UI-appropriate | Canonical display name. |
| `aliases` | Engine-only | Internal normalisation. |
| `primaryCategories` | UI-appropriate | Used in catalog navigation and filter UI. |
| `designPhilosophy` | UI-appropriate | This is what a brand authority page would surface. |
| `engineeringPriorities` | UI-appropriate (selectively) | Top one or two priorities can surface; full ordered list is engine-only. |
| `sonicTendencies` | UI-appropriate | Surfaces in advisory output for comparisons / recommendations. |
| `strengths` | UI-appropriate | Surfaces under product cards and brand pages. |
| `tradeoffs` | UI-appropriate | Surfaces under product cards (trade-off discipline). |
| `listenerArchetype` | UI-appropriate | Surfaces in recommendation framing. |
| `measurementVsExperiential` | Engine-only | Internal categorisation; not user-facing as a label. |
| `comparisonGuardrails` | **Engine-only** | The synthesis layer's input. Never user-facing. |
| `mischaracterizationsToAvoid` | **Engine-only** | The validator's input. Never user-facing. |
| `confidence` | Engine-only | Internal calibration metadata; degrades to "we have less data" framing in user-facing copy. |
| `reviewNotes` | **Engine-only** | Editorial workspace; never user-facing. |
| `inCatalog` | Engine-only | Routing decision. |
| `multiLineBrand` | Engine-only | Synthesis routing decision. |
| `lastReviewed` | Engine-only | Editorial metadata. |

The implementation must keep these separated cleanly. A brand authority page rendering `comparisonGuardrails` would be confusing; a synthesis layer ignoring `comparisonGuardrails` defeats the layer's purpose.

### 4.3. Schema simplifications considered and rejected

The v0 schema review surfaced several proposed simplifications. Each was considered and rejected for the reason given:

- **Combine `strengths` and `tradeoffs` into a single field.** Rejected: trade-off discipline is structural in Audio XX. Strengths and trade-offs being explicit (and ordered) is what protects against trade-off-blind recommendations.
- **Drop `engineeringPriorities` (subsumed by `designPhilosophy`).** Rejected: priorities are *ordered*; design philosophy is prose. The ordering matters for synthesis.
- **Replace `comparisonGuardrails` with derived framing computed from `sonicTendencies`.** Rejected: this is exactly the trait-synthesizing failure mode the layer is meant to prevent.
- **Drop `measurementVsExperiential`.** Rejected: it carries one bit of categorical information that synthesis uses for cross-axis comparisons (comparing a measurement-forward brand to an experiential brand requires a different framing than comparing two measurement-forward brands).
- **Make `mischaracterizationsToAvoid` a flat string list.** Rejected: § 5 — bare strings produce false-positive triggers.

### 4.4. Storage format remains an open implementation decision

The schema is format-agnostic at this stage. Three plausible options:

- **TypeScript module** with the type defined and an array of capsules exported. Pro: type-checked, importable. Con: not editor-friendly for non-engineers.
- **YAML files** (one per brand or one large file). Pro: editor-friendly. Con: requires schema-validation tooling.
- **Markdown with frontmatter**. Pro: prose fields read naturally; structured fields in frontmatter. Con: parser custom-built.

Recommendation: defer the decision until first integration. The current Markdown + CSV draft is an acceptable editorial staging format; the production format should optimise for the use pattern (read-frequently, edit-occasionally, validate-on-edit).

---

## 5. Mischaracterizations as structured patterns

The v0 schema treated `mischaracterizationsToAvoid` as a string list. This is too coarse. The validator that consumes the field needs to distinguish between:

- The brand being described as warm when it is the subject (`"Topping has warm character"` — block).
- The brand being mentioned in a contrastive comparison (`"less warm than Denafrips"` applied to Topping — allow).
- The brand appearing in unrelated context (`"warm" in a sentence about a different brand` — allow).

The v1 schema therefore uses a structured pattern object:

```ts
interface MischaracterizationPattern {
  pattern: string;                   // the disallowed framing as a word/phrase pattern
  appliesWhen: 'subject_is_brand' | 'brand_appears_in_text';
                                     // when does this pattern trigger?
  excludedContexts?: string[];       // contexts where the pattern is acceptable
                                     // (e.g., "contrastive comparison with warm brand")
  severity: 'high' | 'medium' | 'low';
                                     // high: validator blocks rendering
                                     // medium: validator emits a warning
                                     // low: validator logs for review
}
```

### 5.1. Example: Topping

```ts
mischaracterizationsToAvoid: [
  {
    pattern: 'warm harmonic character',
    appliesWhen: 'subject_is_brand',
    severity: 'high'
  },
  {
    pattern: 'rich',
    appliesWhen: 'subject_is_brand',
    excludedContexts: ['contrastive comparison'],
    severity: 'medium'
  },
  {
    pattern: 'harmonically dense',
    appliesWhen: 'subject_is_brand',
    severity: 'high'
  },
  {
    pattern: 'cold',
    appliesWhen: 'subject_is_brand',
    excludedContexts: ['user-quoted concern'],
    severity: 'medium'
  }
]
```

The structure lets the validator be specific. A response saying "Topping is leaner than Denafrips, with less harmonic richness" should not trigger any of these — it is a contrastive framing, not a mischaracterization.

### 5.2. Validator integration

The existing `validateComparisonOutput` function in `consultation.ts` (line 2008) already checks rendered output for "generic phrases." Extending it to consume `mischaracterizationsToAvoid` is the smallest-leverage integration step. Pseudocode:

```
for each named brand in the rendered output:
  for each pattern in brand.mischaracterizationsToAvoid:
    if patternMatches(rendered, pattern, brand):
      if severity == 'high': block; raise; surface to telemetry
      if severity == 'medium': emit warning; degrade confidence; log
      if severity == 'low': log only
```

Implementation of `patternMatches` requires the same negation-aware text processing already implemented for the synthesis layer (`stripNegatedClauses`).

### 5.3. False-positive mitigation

The single largest implementation risk is over-triggering. Mitigations:

- `appliesWhen: 'subject_is_brand'` is the default; it requires the brand to be the *subject* of a phrase containing the pattern, not just appearing nearby.
- `excludedContexts` allows whitelisting common false-positive scenarios (contrastive comparisons, user-quoted concerns, system-state descriptions).
- `severity: 'medium'` for borderline patterns lets the validator warn without blocking — useful during initial integration.
- Confidence-degradation as the validator's signal: a triggered medium-severity pattern degrades the response's confidence rather than blocking it. This avoids the layer becoming an over-restrictive censor.

### 5.4. The over-constraint risk

A user query may surface a real exception (`"my Topping D70 sounds warm in this system"`) that contradicts the canonical capsule. The validator must not silence the response. Mitigation: the validator distinguishes between *brand-claim* mischaracterizations (Audio XX asserting Topping is warm — block) and *user-described observations* (the user reporting their Topping sounds warm — accept and reason about why). This is captured by `excludedContexts: ['user-quoted concern']`.

---

## 6. Risks and edge cases

### 6.1. Hand-curated content drifts from review consensus over time

Brand philosophies evolve. **Mitigation:** `lastReviewed` ISO date; quarterly review cadence; flag entries unreviewed for >12 months.

### 6.2. Multi-line brands resist single-identity capsules

Schiit, Gustard, McIntosh, Lampizator, Spendor, Wilson Audio. **Mitigation:** the schema includes `multiLineBrand: true`. For these brands, comparisons must reference specific models. The synthesis layer should refuse to produce brand-level output without a model anchor.

### 6.3. New brands enter the catalog faster than capsules are written

**Mitigation:** the schema treats absence as honest. Brands without capsules get standard per-product reasoning; the advisory does not pretend identity grounding exists where it does not.

### 6.4. Editorial bias risks

A single editor concentrates curation authority. **Mitigation:** confidence ratings are honest; review notes surface uncertainty; second-pass review is editorial discipline (editorial-review memo § 7.1).

### 6.5. Legal / brand-relationship concerns

Naming a manufacturer's "common mischaracterizations to avoid" is editorially clear but may be perceived as critical commentary. **Mitigation:** the language is identity-preserving (avoid framing X as warm because the brand is precision-focused) rather than evaluative. Worth an explicit policy review before public-facing exposure of the layer's content.

### 6.6. Over-constraint risk

Discussed in § 5.4. The validator should warn-and-degrade rather than block where ambiguity exists.

### 6.7. Confidence-rating inflation

Over time, "high" can drift toward "we kind of think this is right." **Mitigation:** the editorial-review memo § 1.4 establishes evidence thresholds for each confidence tier. Confidence-degradation is the editorial signal that a capsule needs re-work.

### 6.8. Per-line variation within a single-philosophy brand

Even single-philosophy brands sometimes have outlier products. **Mitigation:** the catalog product entry remains authoritative for per-product traits. The capsule provides the brand frame; per-product variation is captured in catalog notes.

### 6.9. UI exposure leakage

`mischaracterizationsToAvoid` and `comparisonGuardrails` could leak into user-facing output if the implementation does not enforce the field-classification table (§ 4.2). **Mitigation:** the data layer should expose two views — full capsule (engine) and public capsule (UI) — with the public view explicitly stripping the engine-only fields.

---

## 7. What should remain editorially curated vs auto-derived

Per § 4.2, classification of fields:

- **Auto-derived from catalog:** `aliases` (with editorial review), `primaryCategories`, `inCatalog`.
- **Editorial only:** `designPhilosophy`, `engineeringPriorities`, `sonicTendencies`, `strengths`, `tradeoffs`, `listenerArchetype`, `measurementVsExperiential`, `comparisonGuardrails`, `mischaracterizationsToAvoid`, `confidence`, `reviewNotes`, `multiLineBrand`, `lastReviewed`.

The pattern: **everything that constrains comparative meaning is editorial.** Mechanical bookkeeping is auto-derived.

---

## 8. Editorial intake protocol for new brands

Per the editorial-review memo § 7.7 and § 7.8, a four-step protocol:

1. **Triage** — classify new brand into `identity-rich` / `identity-thin` / `multi-line` states.
2. **Drafting** — author the capsule using the calibrated trait vocabulary, conservative confidence rating, and the four identity anchors (editorial-review memo § 4.2).
3. **Editorial review** — second-pass for adjective discipline, comparative honesty, identity preservation.
4. **Integration** — committed once chosen storage format is in place; per-PR commit cadence.

Per § 7.7 of the editorial-review memo: at first authoring, identify the most-similar already-curated brand and verify the new capsule explicitly differentiates. This is the comparative-symmetry test applied at intake.

---

## 9. How the layer should interact with comparisons and recommendations

### 9.1. Brand-vs-brand comparison (today vs proposed)

**Today:**

```
buildBrandComparison(profileA, profileB, query)
  → buildInitialComparisonPayload (extracts sonic traits via regex)
  → renderComparisonPayload
  → validateComparisonOutput (checks for generic phrases)
```

**Proposed:**

```
resolveBrandPhilosophy(A) → BrandPhilosophy capsule for A
resolveBrandPhilosophy(B) → BrandPhilosophy capsule for B
composeBrandComparison(capsule A, capsule B, query)
  ├── frame trade-off using both sides' comparisonGuardrails.prefer
  ├── populate sonicTraits from capsule.sonicTendencies (no regex)
  └── populate decision rationale from capsule.designPhilosophy
renderComparisonPayload
validateAgainstMischaracterizations(rendered output, [capsule A, capsule B])
  └── if any pattern from either side's mischaracterizationsToAvoid
      matches the rendered output, raise / warn / log per severity.
```

The synthesis still uses the existing reasoning pipeline. What changes is that identity-preserving constraints come from the canonical layer rather than from regex on prose.

### 9.2. Recommendation

When the engine recommends a specific product, the brand's `comparisonGuardrails.prefer` framing influences how the recommendation is described, and `mischaracterizationsToAvoid` constrains what cannot be said about it. Trade-off framing in recommendations gains canonical grounding.

### 9.3. Upgrade guidance

Trade-off statements (e.g., "moving from Topping D90 to Denafrips Pontus") are framed against both brands' capsules: "trading measurement-class signal pass-through for harmonic continuity through R2R conversion," not "a more musical sound."

### 9.4. System matching

The `listenerArchetype` field informs whether a candidate compounds or compensates the existing system's tendencies. Today this happens via per-product axis inference; the philosophy layer makes it explicit at brand level.

### 9.5. Used-market workflows (future)

The capsule's identity-stability guarantee is most important for used-market advisory: a 1995 Naim and a 2020 Naim share a recognisable timing-domain identity even if specific products differ. The capsule provides the durable through-line that justifies recommending used Naim gear to a "PRaT-curious" listener.

---

## 10. How to avoid future identity-drift regressions

Five operational safeguards:

1. **Mischaracterization-aware validation.** Extend `validateComparisonOutput` to honour each brand's `mischaracterizationsToAvoid` patterns. The 2026-05-10 Topping regression would have been caught immediately by such a check.
2. **Negation-aware text processing.** Already partially shipped via `stripNegatedClauses`. Same discipline must apply to any future regex / substring matcher consuming brand prose.
3. **Behavioural regression harness anchors.** When the regression suite (Workstream A8) is built, every brand's identity capsule should anchor at least one canonical assertion — e.g., "compare Denafrips vs Topping should produce R2R-vs-delta-sigma framing, not warm-vs-anything framing."
4. **Periodic editorial review cadence.** Quarterly review pass: refresh `lastReviewed`, surface drift, downgrade confidence where evidence weakens.
5. **Confidence-degradation discipline.** When evidence becomes ambiguous, drop confidence to the next-lower tier. Do not silently maintain `high` confidence on weakening evidence.

---

## 11. Implementation sequencing (proposal — not implementation)

If this layer ships in code, a defensible sequence:

1. **Storage format decision.** Choose canonical format (TypeScript / YAML / Markdown frontmatter). § 4.4.
2. **Type and resolver.** `BrandPhilosophy` type, `resolveBrandPhilosophy(brandName)`. Hydrate from the chosen format. Smoke-test against existing `BRAND_PROFILES` data.
3. **Mischaracterization validator.** Extend `validateComparisonOutput` to honour structured-pattern mischaracterizations. *This single step closes the highest-impact regression class — implementable independently of the rest of the layer.*
4. **Comparison framing routing.** In `buildBrandComparison`, swap regex-driven sonic-trait extraction for capsule-driven extraction when capsules exist; fall back to existing logic when not.
5. **Trade-off framing routing.** Same pattern for `buildTradeoffStatement`.
6. **Behavioural regression tests.** Anchor canonical assertions per brand in the regression harness.
7. **Multi-line brand handling.** Implement `multiLineBrand: true` path requiring a model anchor before brand-level synthesis runs.
8. **Editorial workflow tooling.** CLI / script for adding capsules, validating against schema, surfacing review-needed entries.
9. **UI separation.** Enforce the field-classification table (§ 4.2). Render only the UI-appropriate subset to user-facing surfaces.
10. **LLM overlay integration (when overlay ships).** Capsule provides system-prompt-grade context for LLM-mediated paths.

Each step is independently shippable. None require rewriting the engine. All should be gated on the canonical capsules being editorially complete for the brands they constrain.

---

## 12. Open editorial questions

Resolved-or-deferred questions from v0 plus new items from the v1 review:

1. **Audio Note inclusion policy.** v1 keeps Audio Note as flagged-editorial-reference (not in catalog). Policy decision deferred.
2. **Multi-line brand handling.** v1 schema includes `multiLineBrand: true`; per-line capsules deferred. Ownership: editorial.
3. **Confidence rating taxonomy.** v1 uses four levels (`high / medium-high / medium / low`). Production may collapse to three. Cosmetic.
4. **Review cadence ownership.** Quarterly proposed. Realistic for single-author project? Editorial decision.
5. **Public exposure of internal fields.** v1 § 4.2 makes the field-classification explicit. Implementation must respect it.
6. **Relationship to LLM overlay.** Capsule-as-system-prompt-context vs capsule-as-tool-call decision deferred until overlay ships.
7. **Versioning of capsule edits.** Each capsule should carry a hash or version for audit. Format-dependent.
8. **Mischaracterization severity taxonomy.** v1 uses `high / medium / low`. Validator implementation will determine whether this is enough resolution.

---

## 13. Cross-references

- **Editorial discipline:** [`brand-philosophy-editorial-review.md`](brand-philosophy-editorial-review.md)
- **Master table:** [`brand-philosophy-master-table.md`](brand-philosophy-master-table.md) (v1)
- **Spreadsheet form:** [`brand-philosophy-master-table.csv`](brand-philosophy-master-table.csv) (v0 — pending sync to v1)
- **Existing brand profiles:** `apps/web/src/lib/consultation.ts` `BRAND_PROFILES` array.
- **Calibration regression source:** commit `7cee216`.
- **Synthesis-layer entry points** that would consume this layer: `extractSonicTraits`, `buildTradeoffStatement`, `buildInitialComparisonPayload`, `validateComparisonOutput`, `buildComparisonRecommendation`, `buildInitialComparisonRecommendation`, `buildComparisonGuidance`, `buildBrandComparison`, in `apps/web/src/lib/consultation.ts`.

This memo is research and architectural proposal. No code is changed. The master table and the editorial-review memo are the deliverables; this memo describes how they should eventually integrate.
