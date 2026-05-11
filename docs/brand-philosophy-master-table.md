# Audio XX — Brand Philosophy Master Table

**Status:** v2 — revised again against the v2 editorial-review discipline. The v1 → v2 pass focused on (a) applying the four-layer mechanism → behavior → perception → preference chain explicitly to capsules, (b) scrubbing cliché-drift terms identified in editorial-review memo § 4 (*natural*, *refined*, *holographic*, *effortless*, *organic*, *analog-like*, *coherent*, *transparent*, *immersive*, *emotional*, *realistic*, *musical* without grounding), (c) calibrating per-layer confidence honestly where mechanism, behavior, and perception diverge.
**Created:** 2026-05-10 (v0); revised same day to v1; revised same day to v2.
**Scope:** brands currently represented in the Audio XX catalog where confidence in the philosophy and sonic identity reasonably supports curated framing. Brands with thinner editorial coverage are listed in § "Brands flagged for review" with reasons.
**Authority:** product author (Mike). Engineering may reference but not modify.

---

## How to read this table

Each entry is a **canonical identity capsule** for one manufacturer, structured to support synthesis-layer reasoning without collapsing into adjective soup. Field definitions are in editorial-review memo § 1, the calibrated trait vocabulary is in § 2, the engineering-intent discipline is in § 3, and the cautioned terms are in § 4. Companion memo: [`engineering-intent-and-audible-behavior.md`](engineering-intent-and-audible-behavior.md).

The capsule's most-important fields, in order of synthesis-layer load-bearingness:

1. **Core design philosophy** — what the brand is engineering *around*. The starting fact.
2. **Engineering chain (where applicable)** — explicit `mechanism → behavior → perception` reasoning for the named example brands (Goldmund, Denafrips, Harbeth, Naim, Topping, Shindo) and the calibration-vulnerable cases. Other brands follow the same discipline implicitly across the engineering-priorities and sonic-tendencies fields.
3. **Comparison guardrails** — preferred contrastive framings; the engine consumes these directly.
4. **Common mischaracterizations to avoid** — the validator's input; structured patterns, not bare strings.
5. **Sonic tendencies** — calibrated trait vocabulary; the perception-layer result downstream of the mechanism.
6. **Strengths and trade-offs** — short, specific, ordered.

### Confidence reading (v2)

Confidence ratings are calibrated per editorial-review memo § 1.4. The v2 pass distinguishes:

- **Mechanism confidence** — how well the brand's engineering choice is documented.
- **Behavior confidence** — how well the measurable consequences are documented.
- **Perception confidence** — how well the audible character is consensus-described in independent reviews.

Where these diverge, capsules carry per-layer confidence. Where they converge, a single global rating applies.

### Phrasing discipline (v2)

Forbidden / cautioned phrasings per editorial-review memo § 4 and § 9.6 have been scrubbed. Specifically:

- *Natural* / *naturalness* without object → replaced with *vocally natural*, *harmonically natural*, *transient-natural* (object specified).
- *Refined* without grounding → replaced with the specific refinement (resolution refinement, tonal-balance polish, etc.).
- *Holographic* → replaced with *spatially dimensional* or *spatially precise* depending on the property.
- *Effortless* without mechanism → replaced with *high-current effortless drive* or similar mechanism-grounded form.
- *Coherent* without type → replaced with *single-driver coherence*, *time-aligned coherence*, *temporal coherence*, etc.
- *Analog-like* / *analogue-leaning* without specifier → replaced with the specific analog property referenced.
- *Transparent* alone → grounded in the mechanism producing the transparency.
- *Organic*, *emotional*, *realistic*, *immersive*, *musical* → removed or replaced with operationally grounded substitutes.

Where any cautioned term survived v2 editorial review, it is contextualised concretely.

Brands grouped by primary category for navigation.

---

## DACs

### Denafrips

| Field | Value |
|---|---|
| **Brand** | Denafrips |
| **Categories** | DAC |
| **Core design philosophy** | Discrete R2R ladder conversion. Each resistor in the ladder shapes the analog output directly; the design intent is harmonic continuity through the conversion stage rather than measurement-class signal pass-through. |
| **Engineering chain** | **Mechanism:** discrete R2R ladder DAC with hand-selected resistor arrays. **Behavior:** harmonic structure preserved across the conversion stage; transient leading edges shaped by the analog-domain summing rather than chip-implementation filtering. **Perception:** listeners consistently report warm tonal balance, density, harmonic richness, and softer leading edges relative to delta-sigma designs. **Preference fit:** listeners prioritising tonal weight and long-form listening continuity over analytical separation. |
| **Engineering priorities** | (1) Discrete R2R ladder topology with hand-selected resistor arrays. (2) Consistent house voicing across a graduated price line (Ares → Pontus → Venus → Terminator). (3) Tonal density and harmonic continuity as the conversion-stage priority. (4) Listener-comfort across long-format listening rather than transient impact. |
| **Sonic tendencies** | Warm; dense; harmonically rich; relaxed transient timing; softer leading edges than delta-sigma designs; spatial presentation dimensional rather than precision-imaged. Distinct from *smooth* — Denafrips's softer leading edges are a function of R2R conversion character, not high-frequency rolloff. |
| **Strengths** | (1) Tonal weight and harmonic continuity at every price tier. (2) Vocal and acoustic-instrument body. (3) Consistent house identity across a wide price range — the Ares and the Terminator share recognisable voicing. |
| **Trade-offs** | (1) Transient definition softer than FPGA or flagship ESS designs. (2) Less analytical separation of complex passages. (3) Pace can feel relaxed in systems already biased toward leanness or precision. |
| **Listener / system fit** | Listeners prioritising tonal density and harmonic continuity. Pairs naturally with neutral-to-precise downstream electronics. Risks compounding density in already-warm chains (tube preamp + warm speaker). |
| **Comparison guardrails — prefer** | "Discrete R2R ladder conversion engineered for harmonic continuity vs measurement-forward delta-sigma engineering optimised for chip-implementation transparency" (vs Topping/SMSL). "R2R conversion with relaxed transient timing vs R2R conversion with dynamic engagement" (vs Holo). "Graduated price-line house voicing vs per-unit boutique customisation" (vs TotalDAC). |
| **Comparison guardrails — avoid** | "Warm vs cold" — flattens to a tonal-axis preference. "Rich vs thin" — pejorative on the contrasted side. "Best vs worst" — Audio XX policy. "Smooth vs detailed" — Denafrips is dense, not smooth; smoothness names absence-of-edge, not the R2R character. |
| **Mischaracterizations to avoid** | "Warm but lacks detail" — Denafrips is not detail-poor; it presents detail in softer-focused, less etched form. "Smooth" as a primary descriptor — Denafrips is dense, not smooth. |
| **Measurement vs experiential** | Strongly experiential at the perception layer; mechanism is documented. |
| **Confidence** | mechanism: high; behavior: high; perception: high. |
| **Review notes** | Calibration consistent with current `BRAND_PROFILES` entry. No flag. v2 added explicit engineering chain. |

### Topping

| Field | Value |
|---|---|
| **Brand** | Topping |
| **Categories** | DAC, headphone amp |
| **Core design philosophy** | Measurement-forward delta-sigma engineering using premium chip implementations (ESS Sabre, AKM). The design intent is signal-path transparency through chip-implementation specification — low THD+N, low noise, wide dynamic range — at value pricing. |
| **Engineering chain** | **Mechanism:** premium delta-sigma chip implementations (ES9038Pro, AK4499, etc.) with measurement-grade analog output stages. **Behavior:** measurement specifications at the upper end of the category — THD+N, SNR, dynamic range; the analog output is engineered to pass the chip's signal with minimum coloration. **Perception:** listeners report leanness, neutrality (sometimes neutral-to-slightly-bright), high clarity, and light tonal weight. Specifically *not* warm and *not* dense. **Preference fit:** listeners prioritising measurement-class signal pass-through, often with bodied downstream electronics to compensate for the leanness. |
| **Engineering priorities** | (1) Measured performance specification (THD+N, SNR, dynamic range) optimisation. (2) Chip-implementation quality across the line (ES9038Pro, AK4499, etc.). (3) Value pricing for measurement-class performance. (4) Signal path with minimal coloration. |
| **Sonic tendencies** | Lean; neutral-to-slightly-bright; high clarity; fast transient definition; light tonal weight; low harmonic emphasis. Specifically *not* warm and *not* dense. Detail retrieval is high without etched edge. |
| **Strengths** | (1) Detail retrieval and channel separation per dollar. (2) Transient precision and low noise floor. (3) Class-of-its-tier measured performance. |
| **Trade-offs** | (1) Tonal density and harmonic richness are not the design priority. (2) Light tonal weight requires partner electronics with body. (3) In already-precise systems, the leanness compounds. |
| **Listener / system fit** | Listeners prioritising signal-path transparency, low noise, and analytical clarity. Pairs naturally with warmer or more bodied downstream electronics. |
| **Comparison guardrails — prefer** | "Measurement-forward delta-sigma signal-path transparency vs discrete R2R harmonic continuity" (vs Denafrips/Holo/TotalDAC). "Chip-implementation specification vs FPGA pulse-array timing" (vs Chord). |
| **Comparison guardrails — avoid** | "Warm vs cold." "Precision vs musicality" — implies one side is unmusical. Single-axis tonal-balance comparisons against R2R brands. |
| **Mischaracterizations to avoid** | "Warm" — Topping is lean, not warm. "Rich" / "harmonically dense" — directly inverts the design intent. "Cold" / "sterile" — pejorative; the leanness is engineering intent, not character failure. "Detail-poor" — the brand's measurement-class detail retrieval is a strength, not a weakness. |
| **Measurement vs experiential** | Strongly measurement-forward. |
| **Confidence** | mechanism: high; behavior: high; perception: high. |
| **Review notes** | Calibration regression of 2026-05-10 traced to synthesis-layer negation handling. Watch for recurrence. v2 added explicit engineering chain; capsule remains the canonical defence against negation-pattern misclassification. |

### Chord Electronics

| Field | Value |
|---|---|
| **Brand** | Chord Electronics |
| **Categories** | DAC |
| **Core design philosophy** | Custom FPGA-based pulse-array conversion (Rob Watts architecture). The design intent is timing-domain accuracy — high tap-count processing emphasises temporal fidelity in the digital-to-analog stage rather than chip-based or ladder-based topology. |
| **Engineering priorities** | (1) FPGA pulse-array topology with high tap counts. (2) Temporal accuracy in the digital-to-analog stage. (3) Bit-perfect signal path with minimal phase distortion. (4) Consistent voicing across the line (Mojo → Hugo → Qutest → DAVE). |
| **Sonic tendencies** | Neutral with slight tonal leanness; transient definition is fast and articulate without being etched; detail is high through timing precision rather than treble emphasis; spatial presentation is open. |
| **Strengths** | (1) Timing-domain accuracy and transient definition. (2) Detail through timing rather than tonal-balance shift. (3) House identity consistent from entry to flagship. |
| **Trade-offs** | (1) Lighter tonal weight than R2R designs. (2) Less midrange body. (3) Flagship pricing scales with FPGA tap-count. |
| **Listener / system fit** | Listeners prioritising temporal precision and detail-through-timing. Pairs well with bodied downstream electronics or speakers. |
| **Comparison guardrails — prefer** | "FPGA pulse-array timing-domain processing vs chip-based delta-sigma signal pass-through" (vs Topping). "FPGA timing precision vs R2R harmonic continuity" (vs Denafrips). "FPGA pulse-array vs ring-DAC oversampling" (vs dCS). |
| **Comparison guardrails — avoid** | Describing Chord as *bright* — high clarity is via timing, not via treble emphasis. |
| **Mischaracterizations to avoid** | "Bright" — high clarity, not high treble energy. "Cold" — neutral-leaning, not aggressively analytical. |
| **Measurement vs experiential** | Hybrid. Engineering is measurement-rigorous in the timing domain; voicing is more experiential than chip-based delta-sigma peers. |
| **Confidence** | high |
| **Review notes** | None. |

### Holo Audio

| Field | Value |
|---|---|
| **Brand** | Holo Audio |
| **Categories** | DAC |
| **Core design philosophy** | Discrete R2R ladder DAC engineered for combined harmonic continuity and dynamic linearity — explicitly distinguishing itself from softer-transient R2R competitors via wide-bandwidth output stage and dynamic-range design. |
| **Engineering priorities** | (1) Discrete R2R topology with dynamic linearity. (2) NOS / OS dual-mode flexibility. (3) Wide-bandwidth output stage. (4) Higher transient definition than typical warm-R2R designs. |
| **Sonic tendencies** | Warm; dense; harmonically rich; transient definition higher than typical R2R designs; wide spatial presentation. Distinct from Denafrips: less softer-focused, more dynamically engaged. |
| **Strengths** | (1) R2R harmonic continuity combined with above-category transient definition. (2) Strong dynamic range. (3) The KTE (Kitsune Tuned Edition) is widely positioned as a value reference at its price tier. |
| **Trade-offs** | (1) Less softer-focused than Denafrips for listeners specifically seeking R2R relaxation. (2) Build complexity vs simpler chip-based DACs. |
| **Listener / system fit** | Listeners wanting R2R tonal density without sacrificing dynamic engagement. |
| **Comparison guardrails — prefer** | "R2R conversion with dynamic engagement vs R2R conversion with relaxed transient timing" (vs Denafrips). "Discrete R2R vs measurement-forward delta-sigma" (vs Topping). |
| **Comparison guardrails — avoid** | Flattening Holo and Denafrips into a single "warm R2R" bucket. |
| **Mischaracterizations to avoid** | "Same as Denafrips" — both R2R, but Holo is more dynamic and less softer-focused. "Bright" — Holo is warm despite the higher transient definition. |
| **Measurement vs experiential** | Hybrid — leans experiential but with measurement-class dynamic linearity. |
| **Confidence** | high |
| **Review notes** | None. |

### dCS

| Field | Value |
|---|---|
| **Brand** | dCS |
| **Categories** | DAC, streamer, transport |
| **Core design philosophy** | Proprietary ring-DAC topology — a custom oversampling ladder built and refined in-house. The design intent is high resolution combined with absence of edge on transients, distinguished from chip-based delta-sigma and from FPGA pulse-array. |
| **Engineering priorities** | (1) Custom ring-DAC architecture. (2) Resolution at the upper end of the market. (3) Quiet noise floor. (4) Modular product architecture (Vivaldi stack — clock, transport, DAC, upsampler as separate units). |
| **Sonic tendencies** | Highly resolved; smooth transient character (absence of edge on leading edges, not treble rolloff); neutral tonal balance with subtle low-mid weight; spatially precise rather than dimensional. |
| **Strengths** | (1) Resolution combined with smoothness — distinct from delta-sigma resolution paired with edge. (2) Quiet noise floor exposes upstream limitations. (3) Modular architecture supports component-by-component upgrade. |
| **Trade-offs** | (1) Pricing at the top of the market. (2) Some listeners describe the smoothness as polish rather than character. (3) The modular architecture only pays off when the full stack is in place. |
| **Listener / system fit** | Listeners building reference systems prioritising resolution; the noise floor reveals downstream limitations. |
| **Comparison guardrails — prefer** | "Ring-DAC oversampling refinement vs FPGA pulse-array timing precision" (vs Chord). "Resolution-with-smoothness vs measurement-forward chip-based transparency" (vs Mola Mola). "Ring-DAC oversampling vs discrete R2R ladder" (vs Denafrips). |
| **Comparison guardrails — avoid** | "Cold" / "analytical" — the resolution-with-smoothness combination is the opposite of analytical edge. |
| **Mischaracterizations to avoid** | "Same as Chord" — both are non-chip-DAC architectures, but ring-DAC and FPGA pulse-array answer different questions about conversion. |
| **Measurement vs experiential** | Measurement-rigorous with experiential voicing. |
| **Confidence** | high |
| **Review notes** | None. |

### Mola Mola

| Field | Value |
|---|---|
| **Brand** | Mola Mola |
| **Categories** | DAC, amplifier |
| **Core design philosophy** | Custom discrete topology designed by Bruno Putzeys, with audibility-research-grounded measurement engineering. The Tambaqui DAC's design intent is signal-path transparency at audible-threshold measurement levels — not measurement-spec optimisation as such, but engineering against what is *actually audible*. |
| **Engineering priorities** | (1) Custom discrete DAC architecture. (2) Audibility-threshold-aware measurement (not raw THD spec). (3) Low noise and low distortion at audible levels. (4) Minimal signal-path coloration. |
| **Sonic tendencies** | Transparency through audibility-aware low distortion at audible levels; clean; spatially open; neutral; resolution without etched edge; low harmonic emphasis. Distinct from dCS: Mola Mola's transparency is signal-pass-through; dCS's smoothness is post-resolution character at the conversion topology. |
| **Strengths** | (1) Audibility-aware measurement transparency — distinct from spec-optimisation. (2) Spatial precision and low noise floor. (3) Bruno Putzeys engineering lineage. |
| **Trade-offs** | (1) Less tonal weight than R2R designs. (2) High-end pricing. |
| **Listener / system fit** | Listeners prioritising transparency and signal pass-through. Pairs naturally with warm or full-bodied downstream chains. |
| **Comparison guardrails — prefer** | "Audibility-research-grounded transparency vs R2R harmonic continuity" (vs Denafrips). "Custom-discrete transparency vs ring-DAC oversampling refinement" (vs dCS). |
| **Comparison guardrails — avoid** | "Warm" / "rich" — directly inverts the brand's transparency-first identity. |
| **Mischaracterizations to avoid** | "Cold" — transparency does not mean cold. "Same as dCS" — both are non-chip non-R2R DACs, but the engineering philosophies differ on whether refinement comes from oversampling-ladder topology (dCS) or audibility-aware signal pass-through (Mola Mola). |
| **Measurement vs experiential** | Strongly measurement-forward, with explicit audibility-research grounding. |
| **Confidence** | mechanism: high (Tambaqui specifically); behavior: high; perception: medium-high (Tambaqui well-covered; broader line less so). |
| **Review notes** | Tambaqui specifically is well-documented; the broader Mola Mola line less so. |

### Lampizator

| Field | Value |
|---|---|
| **Brand** | Lampizator |
| **Categories** | DAC |
| **Core design philosophy** | Tube-output DAC with discrete digital architectures (DSD-native, R2R variants depending on model). The design intent is harmonic colouration through a tube output stage — the digital architecture varies, but the tube output stage is the brand's identity. |
| **Engineering priorities** | (1) Tube output stage as the brand-defining element. (2) Discrete digital architecture (model-dependent). (3) Tube-rolling flexibility for user voicing. (4) Build presence and tube-aesthetic. |
| **Sonic tendencies** | Warm; harmonically saturated; tube-output bloom on transients; relaxed transient timing; midrange continuity from tube-stage harmonic addition. Distinguished from R2R warmth: Lampizator's warmth comes from the tube output stage, not from the conversion topology. |
| **Strengths** | (1) Distinct tube-output coloration at the source. (2) User-rollable tube character. (3) Pairs particularly well with solid-state amplification needing harmonic addition. |
| **Trade-offs** | (1) Pricing scales steeply with line position. (2) Tube dependency requires occasional replacement. (3) The tube-output coloration is pronounced enough that some listeners find it too forward. |
| **Listener / system fit** | Listeners specifically seeking tube character at the source. Pairs naturally with neutral-to-precise solid-state amplification. |
| **Comparison guardrails — prefer** | "Tube-output coloration vs R2R harmonic continuity" (vs Denafrips). "Tube-output character vs measurement-forward chip transparency" (vs Topping). |
| **Comparison guardrails — avoid** | Flattening into "warm DAC" without naming the tube-output mechanism. |
| **Mischaracterizations to avoid** | "Coloured" without context — the colour is the design intent, not a defect. "Slow" without context — the relaxed transient timing is intentional. |
| **Measurement vs experiential** | Strongly experiential. |
| **Confidence** | medium |
| **Review notes** | Voicing varies between models more than most brands. Per-line capsules may be needed. Confidence dropped from v0's medium-high. |

### TotalDAC

| Field | Value |
|---|---|
| **Brand** | TotalDAC |
| **Categories** | DAC |
| **Core design philosophy** | Discrete R2R ladder DAC with per-unit customisation. The design intent is small-batch boutique R2R conversion with per-unit voicing — vinyl-like transient timing through R2R conversion plus per-unit resistor selection — rather than line-graduated price tiers. |
| **Engineering priorities** | (1) Discrete R2R topology. (2) Per-unit resistor selection and tuning. (3) Voicing oriented toward vinyl-like transient timing distinct from production-tier R2R. (4) Boutique-scale build. |
| **Sonic tendencies** | Warm; dense; spatially intimate; transient timing closer to vinyl playback than to oversampling delta-sigma. Distinct from Denafrips and Holo: TotalDAC's warmth is more intimate than Denafrips's relaxed warmth, less dynamically engaged than Holo's. |
| **Strengths** | (1) Boutique R2R voicing distinct from line-graduated R2R. (2) Per-unit voicing precision. (3) Build quality. |
| **Trade-offs** | (1) High pricing at all tiers. (2) Small-batch production limits availability. (3) Less dynamic immediacy than FPGA or solid-state designs. |
| **Listener / system fit** | Listeners seeking vinyl-like presentation at the digital source. |
| **Comparison guardrails — prefer** | "Per-unit boutique R2R customisation vs graduated-line R2R house voicing" (vs Denafrips). "Vinyl-leaning transient timing vs dynamically engaged R2R" (vs Holo). |
| **Comparison guardrails — avoid** | Equating with Denafrips or Holo without naming TotalDAC's specifically intimate, vinyl-leaning voicing. |
| **Mischaracterizations to avoid** | "Coloured" without context. "Same as Denafrips" — TotalDAC is more intimate and less line-consistent. "Analogue-leaning" without specifier — name the specific analog property (vinyl-like transient timing). |
| **Measurement vs experiential** | Strongly experiential. |
| **Confidence** | mechanism: high; behavior: medium; perception: medium (less standardised review consensus than Denafrips or Holo). |
| **Review notes** | Per-product calibration may need refinement. v2 replaced "analogue-leaning" with the specific transient-timing property. |

### LAiV

| Field | Value |
|---|---|
| **Brand** | LAiV |
| **Categories** | DAC |
| **Core design philosophy** | Boutique discrete R2R DAC oriented toward harmonic texture — closer to Denafrips/Holo end of the R2R spectrum than to Rockna's neutral R2R interpretation. |
| **Engineering priorities** | (1) Discrete R2R. (2) Tonal density emphasis. (3) Boutique build at moderate boutique pricing. |
| **Sonic tendencies** | Warm; dense; midrange continuity through R2R conversion; boutique-build character. Less differentiated from Denafrips/Holo than other capsules in this table — LAiV's distinct identity is currently more about boutique-tier positioning than about a separate sonic signature. |
| **Strengths** | (1) Harmonic-density-oriented R2R. (2) Midrange continuity. |
| **Trade-offs** | (1) Smaller-brand availability. (2) Less independent review coverage. (3) Identity overlap with established R2R competitors. |
| **Listener / system fit** | Similar to Denafrips/Holo listeners; differentiation is brand-tier rather than sonic-philosophy. |
| **Comparison guardrails — prefer** | LAiV is best framed alongside Denafrips/Holo as a smaller-brand alternative, not as a distinct sonic philosophy. |
| **Comparison guardrails — avoid** | Overclaiming a unique LAiV identity that the review consensus does not support. |
| **Mischaracterizations to avoid** | "Same as Denafrips" — broadly similar but smaller-brand boutique character; LAiV's case is genuinely *similar*, not differentiated. |
| **Measurement vs experiential** | Experiential. |
| **Confidence** | medium |
| **Review notes** | Capsule honestly admits identity overlap with Denafrips/Holo. Review whether LAiV warrants a distinct capsule or should be folded as a footnote on Denafrips's. |

### Rockna

| Field | Value |
|---|---|
| **Brand** | Rockna |
| **Categories** | DAC |
| **Core design philosophy** | Discrete R2R DAC engineered for tonal balance closer to neutral than to warmth. The design intent is R2R texture and harmonic articulation *without* the warmth bias of Denafrips/Holo — a deliberately different R2R interpretation. |
| **Engineering priorities** | (1) Discrete R2R topology. (2) Tonal balance closer to neutral. (3) Measurement-aware design within the R2R category. |
| **Sonic tendencies** | Neutral; texturally articulate; harmonically present without low-mid emphasis; balanced rather than tonally weighted. Specifically *not* warm — Rockna distinguishes itself from warm-R2R brands by tonal-balance choice. |
| **Strengths** | (1) R2R texture without imposing warmth. (2) System pairing flexibility — no warm-bias to compound. (3) Bridges R2R-enthusiast and neutrality-prioritising listeners. |
| **Trade-offs** | (1) Less harmonic body than Denafrips/Holo for listeners specifically seeking warmth. (2) Less measurement-class precision than chip-based flagships. |
| **Listener / system fit** | Listeners wanting R2R texture without warmth. Pairs across both tube and solid-state amplification without imposing tonal-balance shift. |
| **Comparison guardrails — prefer** | "Neutral R2R interpretation vs warmth-leaning R2R" (vs Denafrips/Holo). "R2R texture without tonal-balance shift vs measurement-forward delta-sigma" (vs Topping). |
| **Comparison guardrails — avoid** | Lumping all R2R DACs into "warm" — Rockna is the explicit exception. |
| **Mischaracterizations to avoid** | "Warm" — Rockna's design intent is neutral R2R; framing it as warm directly inverts the brand's identity. |
| **Measurement vs experiential** | Hybrid — R2R topology with neutral voicing. |
| **Confidence** | medium-high |
| **Review notes** | The neutral-R2R framing is what differentiates Rockna; capsule must protect it. |

### MHDT Labs

| Field | Value |
|---|---|
| **Brand** | MHDT Labs |
| **Categories** | DAC |
| **Core design philosophy** | Non-oversampling (NOS) DAC with tube output stage. The design intent combines NOS conversion timing with tube-output harmonic coloration at sub-flagship pricing. |
| **Engineering priorities** | (1) NOS conversion (no upsampling, no digital filtering). (2) Tube output stage. (3) Midrange continuity through combined NOS conversion timing + tube output. (4) Value pricing for tube-output character. |
| **Sonic tendencies** | Warm; dense; relaxed transient timing characteristic of NOS conversion; tube-output harmonic coloration. Distinguished from Lampizator: MHDT's NOS conversion contributes its own timing character on top of the tube-output coloration. |
| **Strengths** | (1) Tube-output character at sub-flagship pricing. (2) NOS conversion's specific timing signature. (3) Pairs well with solid-state amplification. |
| **Trade-offs** | (1) Less transient speed than oversampling DACs. (2) Tube dependency. |
| **Listener / system fit** | Listeners seeking tube-source character on a moderate budget. |
| **Comparison guardrails — prefer** | "NOS conversion with tube-output character vs oversampling chip-based transparency" (vs Topping). "Sub-flagship NOS-tube vs flagship Lampizator tube-output" (vs Lampizator). |
| **Comparison guardrails — avoid** | Generic "warm DAC" framing without naming the NOS-and-tube combination. |
| **Mischaracterizations to avoid** | "Slow" without context — the relaxed transient timing is the NOS character. |
| **Measurement vs experiential** | Strongly experiential. |
| **Confidence** | medium-high |
| **Review notes** | None. |

### Schiit Audio

| Field | Value |
|---|---|
| **Brand** | Schiit Audio |
| **Categories** | DAC, amplifier, headphone amp |
| **Core design philosophy** | American value-engineering with explicit philosophical opposition to high-tier audio pricing. Schiit deliberately spans multiple topology philosophies (R2R/multibit on the Yggdrasil/Bifrost line; delta-sigma on Modi/Modius; tube and solid-state on the amp lines). The design intent is not a single sonic identity — it is honest performance-per-dollar across multiple philosophical lanes. |
| **Engineering priorities** | (1) Value-per-dollar across multiple topologies. (2) Iteration cadence (model refresh and improvement). (3) Sonically-defensible engineering choices regardless of audiophile fashion. |
| **Sonic tendencies** | **Varies materially by line.** Yggdrasil/Bifrost (R2R/multibit): warm, dense, textured. Modi/Modius (delta-sigma): clean, neutral, lean. Tube products (Freya+, Lyr, etc.): tube character per topology. **No single brand-level sonic tendency applies.** |
| **Strengths** | (1) Multi-topology choice within a single brand. (2) Iteration responsiveness. (3) Value at every tier. |
| **Trade-offs** | (1) Build quality is functional rather than premium. (2) Multi-line span makes brand-level reasoning structurally inadequate. |
| **Listener / system fit** | Varies by specific model and topology. Brand-level system-fit framing is unsafe. |
| **Comparison guardrails — prefer** | **Always specify the model.** "Schiit Yggdrasil vs Denafrips Pontus" is a substantive comparison. "Schiit vs Denafrips" is not. |
| **Comparison guardrails — avoid** | Treating Schiit as a single sonic identity. |
| **Mischaracterizations to avoid** | Brand-level sonic claims without model anchor. |
| **Measurement vs experiential** | Spans both, model-dependent. |
| **Confidence** | medium (at brand level) |
| **Review notes** | `multiLineBrand: true`. Per-line capsules required for synthesis-layer use. Brand-level capsule is navigation only. |

### Benchmark

| Field | Value |
|---|---|
| **Brand** | Benchmark |
| **Categories** | DAC, amplifier |
| **Core design philosophy** | Studio / pro-audio engineering carried into hi-fi. The design intent is honest signal pass-through — the recording arrives at the listener with minimum additive coloration — engineered for studio-grade reliability and measurement-rigorous transparency. |
| **Engineering priorities** | (1) Measurement transparency. (2) Ultra-low THD+N. (3) Studio-grade reliability and longevity. (4) Honest pass-through with low harmonic emphasis. |
| **Sonic tendencies** | Transparent; clean; neutral; fast transient definition; analytical without etched edge; low harmonic emphasis. Distinguished from Topping: Benchmark's pro-audio lineage prioritises reliability and pass-through honesty across long sessions, where Topping prioritises measurement specification per dollar. |
| **Strengths** | (1) Pro-audio reliability and longevity. (2) Transparent signal pass-through reveals upstream and downstream limitations. (3) Engineering rigour. |
| **Trade-offs** | (1) Less tonal weight than R2R or tube designs. (2) Some listeners find the pass-through honesty too revealing of recording limitations. |
| **Listener / system fit** | Listeners and engineers prioritising honest signal reproduction. Pairs naturally with warmer-leaning sources or speakers. Reveals what is in the recording. |
| **Comparison guardrails — prefer** | "Pro-audio pass-through transparency vs experiential character" (vs tube / R2R brands). "Studio-grade reliability with measurement transparency vs measurement-spec-per-dollar" (vs Topping). |
| **Comparison guardrails — avoid** | "Cold" / "sterile" — pejorative; the brand intent is honesty. |
| **Mischaracterizations to avoid** | "Cold" — neutral-and-clean is the engineering intent, not character failure. |
| **Measurement vs experiential** | Strongly measurement-forward, with pro-audio lineage. |
| **Confidence** | high |
| **Review notes** | None. |

### Gustard

| Field | Value |
|---|---|
| **Brand** | Gustard |
| **Categories** | DAC |
| **Core design philosophy** | Chinese specialist building DACs across both delta-sigma and R2R architectures. The design intent is architectural breadth at value pricing — Gustard offers a choice of topology rather than a single voicing. |
| **Sonic tendencies** | **Architecture-dependent.** ESS models (X16, X26 Pro): neutral, clean, fast — analogous to Topping/SMSL philosophy. R2R models (R26): warmer, more textured than ESS line, but less softer-focused than Denafrips. |
| **Comparison guardrails — prefer** | **Always specify model.** "Gustard X26 Pro vs Topping D90" is a substantive comparison. "Gustard vs Denafrips" is not. |
| **Mischaracterizations to avoid** | Treating Gustard as a single voice. |
| **Measurement vs experiential** | Spans both, model-dependent. |
| **Confidence** | medium (at single-identity level) |
| **Review notes** | `multiLineBrand: true`. Per-architecture capsules required for synthesis-layer use. |

### SMSL

| Field | Value |
|---|---|
| **Brand** | SMSL |
| **Categories** | DAC, amplifier |
| **Core design philosophy** | Compact measurement-oriented Chinese specialist using ESS/AKM chip implementations. The design intent overlaps with Topping but emphasises form-factor compactness and broader product-range coverage (desktop, headphone, integrated) over flagship-tier measurement-spec leadership. |
| **Engineering priorities** | (1) Compact form factor. (2) Broad product-range coverage. (3) Measurement-class performance at value pricing. (4) ESS/AKM chip-implementation quality. |
| **Sonic tendencies** | Lean; neutral-to-analytical; clean; fast transient definition; light tonal weight. Distinguished from Topping: SMSL's voicing is comparable but the brand's identity emphasises compact / desktop-form coverage rather than flagship-spec contention. |
| **Strengths** | (1) Compact desktop-friendly builds. (2) Broad product range across price tiers. (3) Value at measurement-class transparency. |
| **Trade-offs** | (1) Tonal density and harmonic richness are not the design priority. (2) Less flagship-spec contention than Topping. |
| **Listener / system fit** | Listeners prioritising compact desktop / mid-fi builds at value pricing. Same downstream-pairing pattern as Topping. |
| **Comparison guardrails — prefer** | "Compact desktop-form measurement transparency vs flagship-spec measurement transparency" (vs Topping). "Measurement-forward delta-sigma vs R2R harmonic continuity" (vs Denafrips). |
| **Comparison guardrails — avoid** | Treating SMSL and Topping as interchangeable; the form-factor and product-range emphasis differs. |
| **Mischaracterizations to avoid** | "Warm" — same negation-vulnerability profile as Topping; SMSL is lean, not warm. |
| **Measurement vs experiential** | Strongly measurement-forward. |
| **Confidence** | high |
| **Review notes** | Capsule explicitly differentiates SMSL from Topping on form-factor / product-range axis rather than pretending sonic differentiation. |

---

## Amplifiers

### Shindo Laboratory

| Field | Value |
|---|---|
| **Brand** | Shindo Laboratory |
| **Categories** | Amplifier (preamp and power amp) |
| **Core design philosophy** | Hand-built tube amplifiers, each circuit individually designed around its chosen tube set. The design unit is the individual circuit rather than a model line — Ken Shindo's lineage emphasises per-circuit voicing using selected vintage and NOS tubes. |
| **Engineering chain** | **Mechanism:** per-circuit individual tube design with hand-wound transformers and point-to-point wiring; vintage / NOS tube selection per circuit. **Behavior:** harmonic saturation through tube circuit choice; transient leading edges shaped by tube character and transformer behavior; output power constrained by topology, requiring high-sensitivity speakers. **Perception:** listeners report *dense*, *harmonically saturated*, *physically present*, *long-form listenable*; transient timing is relaxed. **Preference fit:** listeners prioritising tonal density and harmonic saturation over measurement-class neutrality, with high-efficiency speakers in their system. The speaker pairing is part of the design. |
| **Engineering priorities** | (1) Per-circuit individual design — no stock topologies. (2) Hand-wound transformers and point-to-point wiring. (3) NOS / vintage tube selection. (4) System pairing with high-efficiency speakers. |
| **Sonic tendencies** | Dense; harmonically saturated; midrange continuity through tube-circuit harmonic structure; tonally weighted; transient timing relaxed; spatial presentation favours physical presence over imaging precision. Distinguished from generic "tube warmth": Shindo's character is specifically dense and harmonically saturated, not lush-and-rolled. |
| **Strengths** | (1) Per-circuit specificity — each Shindo circuit is voiced individually. (2) Hand-wound transformer and point-to-point construction. (3) Deep system synergy with high-efficiency speakers (DeVore, Altec, Tannoy heritage). |
| **Trade-offs** | (1) Limited bass authority and dynamic headroom relative to high-power solid-state. (2) Requires high-sensitivity speakers (90 dB+). (3) Vintage-tube dependency — replacement tubes scarce. (4) Limited production. |
| **Listener / system fit** | Listeners prioritising tonal density and harmonic saturation over measurement-class neutrality. Pairs with high-efficiency speakers; the speaker pairing is part of the design. |
| **Comparison guardrails — prefer** | "Per-circuit hand-built tube design vs measurement-driven solid-state" (vs Pass Labs). "Per-circuit individual design vs integrated-system tube philosophy" (vs Audio Note). "Single-ended / push-pull tube density vs push-pull tube rhythmic articulation" (vs Leben). |
| **Comparison guardrails — avoid** | Generic "warm tube amp" framing — collapses Shindo into a category aesthetic. |
| **Mischaracterizations to avoid** | "Neutral" — Shindo is explicitly tonally weighted. "Slow" — the relaxed transient timing is intentional. "Coloured" without explanation — the colour is the brand's identity. "Emotional" / "musical" without grounding — replace with the mechanism (per-circuit voicing, tube saturation). |
| **Measurement vs experiential** | Strongly experiential. The brand's positioning explicitly opposes measurement-driven design. |
| **Confidence** | mechanism: high; behavior: medium-high (limited measurement archive given the brand's stance); perception: high. |
| **Review notes** | v2 added explicit engineering chain. Replaced "flowing" with "midrange continuity through tube-circuit harmonic structure". |

### Pass Labs / First Watt

| Field | Value |
|---|---|
| **Brand** | Pass Labs / First Watt |
| **Categories** | Amplifier |
| **Core design philosophy** | Nelson Pass design lineage — class-A solid-state with low or zero feedback. The design intent is *harmonically natural* circuit behavior — even-order harmonic content from class-A topology without tube character. Contrasted explicitly against tube circuits: the harmonic structure is class-A-derived, not tube-derived. First Watt is the lower-power experimental sister brand. |
| **Engineering priorities** | (1) Class-A operation. (2) Low feedback or zero feedback topologies. (3) Harmonically natural circuit behavior (even-order harmonics from class-A topology, not from tubes). (4) Minimalism in signal path. |
| **Sonic tendencies** | Dense (tonally weighted); harmonically natural in the class-A even-order sense, without tube saturation; *not* warm in the tonal-balance sense; transient response relaxed without being slow; harmonic structure full. Distinguished from Hegel: Pass's body comes from class-A topology and harmonic structure; Hegel's body comes from high-current solid-state with proprietary feedback techniques. |
| **Strengths** | (1) Class-A harmonic structure without tube dependency. (2) Broad speaker compatibility (high-power Pass) or specialist matches (First Watt low-power). (3) Long design lineage and consistent house philosophy. |
| **Trade-offs** | (1) Class-A heat dissipation. (2) Statement-tier pricing on flagship Pass models. (3) First Watt models are speaker-specific. |
| **Listener / system fit** | Listeners seeking tube-adjacent harmonic structure without tube maintenance. |
| **Comparison guardrails — prefer** | "Class-A topology with low feedback vs high-current solid-state with feedback techniques" (vs Hegel). "Class-A harmonic structure vs tube harmonic saturation" (vs tube brands). |
| **Comparison guardrails — avoid** | "Warm" — Pass is not warm in the tonal-balance sense; it is tonally weighted with full harmonic structure. "Tube-like" without qualification — Pass is solid-state class-A with even-order harmonic content, not tube character. |
| **Mischaracterizations to avoid** | "Warm" — Pass's body is harmonic and tonal-weight, not low-mid emphasis. "Tube-like" — solid-state with class-A topology, not tube. "Musical" without grounding — replace with the class-A harmonic-structure mechanism. |
| **Measurement vs experiential** | Hybrid — engineering is measurement-rigorous; voicing is experientially calibrated. |
| **Confidence** | mechanism: high; behavior: high; perception: high. |
| **Review notes** | v2 replaced "tube-adjacent musicality" with the specific harmonic-structure mechanism. |

### Naim Audio

| Field | Value |
|---|---|
| **Brand** | Naim Audio |
| **Categories** | Amplifier, streamer, integrated |
| **Core design philosophy** | British engineering centred on timing-domain accuracy and power-supply behavior. The design intent is temporal fidelity — the time relationships between musical events are preserved with priority over tonal density or spatial precision. The audible result is what British audio writers call PRaT (pace, rhythm, and timing); the engineering intent is *temporal accuracy*. |
| **Engineering chain** | **Mechanism:** timing-domain emphasis through power-supply design and discrete circuit topology, plus tightly damped bass alignment in the integrated amplifiers. **Behavior:** transients arrive with consistent timing across the frequency range; bass damping is tight; temporal alignment between musical events is preserved. **Perception:** listeners report *propulsive*, *forward*, *rhythmically engaged* — what British reviewers historically call PRaT. **Preference fit:** listeners prioritising rhythmic momentum, particularly on rock, jazz, electronic material; less aligned for listeners prioritising spatial precision or tonal density. |
| **Engineering priorities** | (1) Timing-domain accuracy. (2) Tightly defined bass for rhythmic clarity. (3) Ecosystem-level signal-path consistency across Naim's own electronics. (4) Forward-leaning presentation that emphasises engagement-through-timing. |
| **Sonic tendencies** | Forward; tightly defined bass; transient definition emphasised; tonal density less than warm-leaning brands; spatial precision present but not the primary axis. Specifically *not* warm, *not* smooth — Naim is propulsive and articulate, with timing as the dominant axis. |
| **Strengths** | (1) Timing-domain accuracy as primary engineering target. (2) Rhythmic momentum, particularly on rock / jazz / electronic material. (3) Naim within-brand component pairing produces consistent timing across the chain. |
| **Trade-offs** | (1) Less tonal density than warm-leaning brands. (2) Less spatial precision than refinement-focused designs. (3) Some listeners find the forward presentation fatiguing. |
| **Listener / system fit** | Listeners prioritising rhythmic momentum and temporal accuracy. Pairs with speakers having good transient response; less suited to listeners prioritising spatial-imaging precision. |
| **Comparison guardrails — prefer** | "Timing-domain accuracy vs harmonic density" (vs warm tube brands). "Temporal fidelity vs resolution refinement" (vs dCS-tier sources). "PRaT engineering vs tube-coloration engineering" (vs Shindo / Audio Note). |
| **Comparison guardrails — avoid** | Describing Naim as "warm" or "smooth" — directly inverts the brand's identity. Generic "British warmth" framing — Naim is not warm; the British engineering tradition includes both warmth-leaning and timing-leaning brands. |
| **Mischaracterizations to avoid** | "Warm" — Naim is propulsive and forward, not warm. "Smooth" — Naim is articulate, not smooth. "British warmth" — Naim's British heritage is timing-focused, not warmth-focused. |
| **Measurement vs experiential** | Hybrid — timing accuracy is measurable; voicing is engagement-focused. |
| **Confidence** | mechanism: high; behavior: high; perception: high. |
| **Review notes** | v2 added explicit engineering chain. Replaced "spatial holography" with "spatial precision" per editorial-review § 4.5. |

### Goldmund (and JOB)

| Field | Value |
|---|---|
| **Brand** | Goldmund (and JOB) |
| **Categories** | Amplifier, DAC |
| **Core design philosophy** | Swiss engineering centred on treating mechanical behavior as part of signal integrity. Goldmund's design philosophy positions chassis, component coupling, and inter-unit interfaces as a single mechanical-energy management problem — the architecture is engineered to dissipate and ground mechanical energy across the signal path rather than to address structural stiffness alone. The expected consequence is improved transient and dynamic behavior at the circuit level. JOB is the accessible sister brand applying the same DNA in lower-power integrated form. |
| **Engineering chain** | **Mechanism:** mechanically grounded chassis architecture with mechanical-energy dissipation across component mounts and inter-unit interfaces; low-feedback signal-path topology; transient-timing emphasis. Mechanical behavior is treated as part of signal integrity, not as a structural concern separate from the circuit. **Behavior:** the philosophy predicts cleaner transient leading edges and reduced mechanically-coupled modulation of the output stage. Direct comparative measurement of these effects against alternative chassis approaches is under-documented in independent measurement archives; this is the layer where evidence is thinnest. **Perception:** listeners report *fast*, *transparent*, *spatially precise*, *composed*; tonal weight is lean. **Preference fit:** listeners prioritising transient speed and architectural composure; less aligned for listeners seeking tonal density at the amplifier stage. |
| **Engineering priorities** | (1) Vibration-control-focused system design — mechanical-energy dissipation and grounding across chassis, component mounts, and inter-unit interfaces. (2) Transient timing accuracy. (3) Low-feedback signal path. (4) Architectural / system-level design — Goldmund treats the rack as part of the signal path. |
| **Sonic tendencies** | Fast transient definition; signal pass-through with low mechanically-coupled contribution at the output; tonally lean; controlled dynamics; low harmonic emphasis. Distinguished from Topping: Goldmund's leanness is the audible result of mechanical-energy management and timing engineering, not of measurement-specification engineering. |
| **Strengths** | (1) Transient timing precision. (2) System-level architectural composure. (3) Reveals upstream chain quality. |
| **Trade-offs** | (1) Lean tonal weight requires speakers / sources with their own body. (2) Statement-tier pricing on Goldmund line. (3) Compounds leanness in already-precise chains. |
| **Listener / system fit** | Listeners prioritising transient speed and architectural composure. Pairs with bodied speakers; risks compounding leanness with already-lean partners. |
| **Comparison guardrails — prefer** | "Mechanical-energy management and transient timing engineering vs class-A harmonic structure" (vs Pass Labs). "System-level architectural engineering vs measurement-spec engineering" (vs Benchmark). |
| **Comparison guardrails — avoid** | Describing Goldmund as "analytical" *as a character* — Goldmund's leanness is design-intent, not analytical-character. Reducing the mechanical engineering to "rigid chassis" — the philosophy is mechanical-energy dissipation and grounding, not stiffness alone. |
| **Mischaracterizations to avoid** | "Bright" — clarity is via timing and mechanical-energy management, not via treble emphasis. "Cold" / "analytical" as character — the brand's leanness is engineering intent, not analytical disposition. "Rigid chassis" as shorthand for the philosophy — the design intent is grounding and dissipating mechanical energy across the signal path, not chassis stiffness as such. |
| **Measurement vs experiential** | Hybrid — measurement-rigorous in distortion and timing; experientially calibrated at the perception layer; the mechanical-grounding behavior layer is honestly under-measured. |
| **Confidence** | mechanism: high (the design philosophy is documented and consistent across the line); behavior: medium (the measurable causal chain from mechanical grounding to audible transient and spatial behavior is under-documented in independent archives); perception: high (consistent review consensus across decades). |
| **Review notes** | v2 added explicit engineering chain. Soak-audit revision: behavior confidence lowered from high to medium to reflect honestly that the mechanical-grounding → audible-behavior link is mechanism-philosophy-supported but not independently measurement-supported in comparative archives. Mechanism wording strengthened away from generic "rigid chassis" framing toward mechanical-energy dissipation and grounding. |

### JOB (Goldmund sister)

| Field | Value |
|---|---|
| **Brand** | JOB |
| **Categories** | Integrated amplifier |
| **Core design philosophy** | Goldmund design DNA at accessible pricing. The design intent is to deliver transient timing and architectural coherence in an integrated form factor at significantly lower price than Goldmund. |
| **Sonic tendencies** | Fast transient definition; elastic transient character (natural attack-and-decay shape); harmonic structure with slightly golden tonal character (more harmonic content than cool-and-clean solid-state); microdynamic articulation; spatial openness. JOB's golden tonality comes from circuit topology and is not present in Goldmund's flagship voicing. |
| **Comparison guardrails — prefer** | "Goldmund DNA at integrated-pricing vs Goldmund flagship" (vs Goldmund). "Class-A solid-state with golden tonality vs class-A solid-state without golden tonality" (vs Pass Labs). |
| **Mischaracterizations to avoid** | "Bright" — JOB is fast and elastic, not treble-emphasised. "Same as Goldmund" — JOB has a distinct golden tonality not present in Goldmund flagship. |
| **Confidence** | high |
| **Review notes** | None. |

### Hegel

| Field | Value |
|---|---|
| **Brand** | Hegel |
| **Categories** | Amplifier, integrated, DAC |
| **Core design philosophy** | Norwegian engineering centred on high-current solid-state with proprietary distortion-reduction circuitry (SoundEngine). The design intent is bodied solid-state with high-current drive into difficult loads — distinct from Pass's class-A topology approach. |
| **Engineering priorities** | (1) High-current output stages. (2) Proprietary feedback / distortion-reduction circuitry. (3) Drive-difficult-speaker capability. (4) Bodied tonal character without tube colouration. |
| **Sonic tendencies** | Dense (bodied); controlled; high-current effortless drive into difficult loads; spatially open; tonal balance neutral; dynamic capability strong; harmonic emphasis lower than Pass. Distinguished from Pass Labs: Hegel's body comes from high-current solid-state with feedback-reduction techniques; Pass's body comes from class-A topology with low/zero feedback. The audible weight is similar; the engineering is different. |
| **Strengths** | (1) Drives difficult speakers without strain through high-current output stage. (2) Bodied solid-state without tube dependency. (3) Composure at high SPL. |
| **Trade-offs** | (1) Less tonal "character" than warm tube designs. (2) Some listeners find the neutrality reserved. |
| **Listener / system fit** | Listeners wanting solid-state drive with body. Particularly aligned for difficult-to-drive speakers. |
| **Comparison guardrails — prefer** | "High-current solid-state with feedback-reduction techniques vs class-A topology with low feedback" (vs Pass Labs). "Bodied solid-state vs warm tube" (vs tube brands). "Bodied solid-state vs measurement-class transparency" (vs Benchmark). |
| **Comparison guardrails — avoid** | "Warm" — Hegel is bodied / dense, not warm in the tonal-balance sense. |
| **Mischaracterizations to avoid** | "Warm" — body / density without low-mid emphasis. "Boring" — the neutrality is design intent. "Same as Pass Labs" — sound similar in places, but engineering philosophies differ. "Effortless" without mechanism — Hegel's ease comes specifically from high-current output, not magic. |
| **Measurement vs experiential** | Hybrid. |
| **Confidence** | mechanism: high; behavior: high; perception: high. |
| **Review notes** | v2 grounded "effortless" in the high-current output mechanism per editorial-review § 4.10. |

### Luxman

| Field | Value |
|---|---|
| **Brand** | Luxman |
| **Categories** | Amplifier, DAC, integrated |
| **Core design philosophy** | Long-established Japanese manufacturer building both tube and solid-state designs. The design intent is consistent tonal-balance voicing across topologies, with emphasis on tonal density combined with composure rather than dynamic drama. |
| **Sonic tendencies** | Slightly warm (subtle low-mid emphasis); dense; composed; controlled; spatial presentation without imaging drama. |
| **Comparison guardrails — prefer** | "Tonal-density-with-composure voicing vs propulsive timing engineering" (vs Naim). "Tube-and-solid-state line voicing vs class-A topology" (vs Pass Labs). |
| **Mischaracterizations to avoid** | "Warm-and-loose" — Luxman has tonal density with composure and control, not bloom. |
| **Confidence** | mechanism: high; behavior: high; perception: high. |
| **Review notes** | v2 replaced "refined" / "spatially natural" with operationally specific terms per editorial-review § 4.9. |

### Accuphase

| Field | Value |
|---|---|
| **Brand** | Accuphase |
| **Categories** | Amplifier, integrated, DAC |
| **Core design philosophy** | Japanese long-tenure solid-state manufacturer with deep build longevity and uniform tonal-balance voicing across the line. The design intent is long-term reliability paired with consistent tonal-balance polish — distinct from Western statement-tier brands' approach to dynamic drama. |
| **Sonic tendencies** | Smooth (absence of edge on transients); uniform tonal-balance polish across the line; neutral with subtle warmth; dynamic capability composed rather than dramatic. Distinguished from Luxman: Accuphase's polish is more uniform across the line; Luxman's voicing varies more between models and tube/solid-state. |
| **Comparison guardrails — prefer** | "Uniform tonal-balance polish across the line vs European dynamic drama or American power" (vs Western statement brands). "Smooth solid-state vs tube saturation" (vs tube brands). |
| **Mischaracterizations to avoid** | "Warm" — neutral with subtle warmth and uniform polish, not warm in the tonal-balance sense. "Refined" without specifier — the specific refinement is uniform tonal-balance polish across the line. |
| **Confidence** | mechanism: medium-high; behavior: high; perception: high. |
| **Review notes** | v2 replaced "refined Japanese voicing" / "tonally polished" with the specific property — uniform tonal-balance polish across the line — per editorial-review § 4.9. |

### McIntosh

| Field | Value |
|---|---|
| **Brand** | McIntosh |
| **Categories** | Amplifier, integrated, preamplifier |
| **Core design philosophy** | American engineering with autoformer-coupled output coupling on most models, hybrid topologies (tube preamp + solid-state output) on the MA series, and tube heritage in the dedicated tube line. The brand's identity is the McIntosh house warmth — a deliberately tonally weighted, dense presentation — combined with iconic visual identity (glass-front aesthetic). The brand spans tube, hybrid, and solid-state lines with related but distinct voicings. |
| **Sonic tendencies** | **Varies by line.** MA hybrid line: warm; dense; full-bodied; smooth; spatially dimensional. Tube line: closer to traditional tube character with greater harmonic saturation. Solid-state line: similar warmth but with autoformer coupling shaping bass character. |
| **Comparison guardrails — prefer** | "Autoformer-coupled hybrid warmth vs class-A solid-state harmonic structure" (vs Pass Labs). **Always specify line** for cross-tube/hybrid/solid-state comparisons. |
| **Mischaracterizations to avoid** | Treating McIntosh as a single sonic identity — line-level disambiguation required. "Holographic" without grounding — the spatial property is dimensional presentation produced by autoformer-coupled output behavior, not generic *holographic* praise. |
| **Measurement vs experiential** | Strongly experiential. |
| **Confidence** | brand-level: mechanism: medium-high; behavior: medium-high; perception: medium-high. MA hybrid line: high across all three layers. |
| **Review notes** | `multiLineBrand: true`. The MA hybrid line is the most-cataloged here (MA252, MA12000); tube and solid-state lines deferred. McIntosh speakers are a separate category not currently in catalog. v2 replaced "holographic" with "spatially dimensional" per editorial-review § 4.5. |

### Leben

| Field | Value |
|---|---|
| **Brand** | Leben |
| **Categories** | Amplifier (push-pull tube) |
| **Core design philosophy** | Japanese push-pull tube amplifiers (CS300, CS600) built around the KT77/KT88 tube family. The design intent combines tube harmonic saturation with rhythmic articulation — distinct from SET designs' intimacy and from Shindo's per-circuit individuality. |
| **Sonic tendencies** | Warm; dense; harmonically saturated; rhythmically articulate through push-pull tube dynamics (unusual for tube amps in this power tier); bass grip surprising for the power output. Distinguished from Shindo: Leben's character emphasises rhythmic articulation through push-pull tube behavior, where Shindo emphasises harmonic density through per-circuit voicing. |
| **Comparison guardrails — prefer** | "Push-pull tube rhythmic articulation vs single-ended tube intimacy" (vs SET designs). "Push-pull tube dynamic articulation vs per-circuit Shindo voicing" (vs Shindo). |
| **Mischaracterizations to avoid** | "Slow" — Leben is rhythmically articulate for a tube amp. |
| **Confidence** | high |
| **Review notes** | None. |

---

## Speakers

### DeVore Fidelity

| Field | Value |
|---|---|
| **Brand** | DeVore Fidelity |
| **Categories** | Speaker |
| **Core design philosophy** | Brooklyn-based speakers voiced by ear in real rooms with real music — explicitly not by anechoic measurement target. The design intent is rhythmic articulation and vocal continuity through listening-driven voicing rather than measurement optimisation. |
| **Sonic tendencies** | Warm midrange; harmonic structure rich; rhythmic articulation present; tonally weighted body; less measured linearity than precision-target speakers; voicing tuned for low-to-moderate SPL listening. |
| **Strengths** | (1) Rhythmic articulation and midrange body. (2) High-sensitivity options (Orangutan series) pair with low-power tube amplification. (3) Less placement-sensitive than narrow-pattern designs. |
| **Trade-offs** | (1) Less measured linearity than precision speakers. (2) Less analytical separation. (3) Boutique-tier pricing. |
| **Listener / system fit** | Listeners prioritising rhythmic articulation and midrange body. Pairs naturally with low-power tube amplification (Shindo, Leben, SET designs). |
| **Comparison guardrails — prefer** | "Voiced-by-ear rhythmic articulation vs measurement-target precision" (vs KEF / Magico). |
| **Mischaracterizations to avoid** | "Cold" / "analytical" — directly inverts identity. "Neutral" — DeVore is intentionally voiced, not neutral. "Natural" without specifier — DeVore's *natural* is specifically *vocal continuity through ear-voiced midrange*. |
| **Measurement vs experiential** | Strongly experiential. |
| **Confidence** | mechanism: medium-high (voicing process documented but not measurement-archived); behavior: medium; perception: high. |
| **Review notes** | v2 replaced "tonal naturalness" with "vocal continuity" per editorial-review § 4.2. |

### Boenicke Audio

| Field | Value |
|---|---|
| **Brand** | Boenicke Audio |
| **Categories** | Speaker |
| **Core design philosophy** | Swiss small-cabinet speakers from solid hardwood (no MDF). The design intent is spatial dimensionality through cabinet-disappearance — solid-hardwood cabinet behavior plus driver matching engineered to minimise audible cabinet contribution. |
| **Sonic tendencies** | Spatially dimensional; airy; tonally even (no systematic emphasis); cabinet contribution minimal; surprising scale for small cabinet size. Distinguished from KEF: Boenicke's spatial character comes from cabinet design and driver matching; KEF's spatial character comes from the Uni-Q coaxial driver. |
| **Comparison guardrails — prefer** | "Solid-hardwood cabinet engineering vs MDF-cabinet engineering" (vs most competitors). "Cabinet-disappearance spatial dimensionality vs scale and dynamic authority" (vs Wilson / Magico). |
| **Mischaracterizations to avoid** | "Warm" — tonally even, not warm in the tonal-balance sense. "Natural" without specifier — replace with the specific property (tonal evenness; cabinet-disappearance spatial behavior). |
| **Measurement vs experiential** | Hybrid — measurement-aware but experientially voiced. |
| **Confidence** | mechanism: high; behavior: medium-high; perception: high. |
| **Review notes** | v2 replaced "tonally natural" with the specific property — tonal evenness — per editorial-review § 4.2. |

### Harbeth

| Field | Value |
|---|---|
| **Brand** | Harbeth |
| **Categories** | Speaker |
| **Core design philosophy** | British BBC-lineage monitors (LS3/5a heritage) centred on the RADIAL polypropylene midrange driver and a cabinet philosophy that uses controlled cabinet contribution rather than maximum-rigidity suppression. The design intent is midrange accuracy and vocal clarity — direct descendants of the BBC LS series broadcasting monitors. |
| **Engineering chain** | **Mechanism:** RADIAL polypropylene midrange driver, BBC-lineage cabinet design that allows controlled cabinet behavior, voicing target oriented to vocal accuracy. **Behavior:** midrange continuity across transients; relaxed transient leading edges through driver and cabinet behavior; treble extension constrained by the driver philosophy. **Perception:** listeners report *vocally accurate*, *tonally honest in the midrange*, *relaxed*, *smooth on transients*; scale and dynamic headroom less than larger floorstanders. **Preference fit:** listeners prioritising vocal reproduction and long-session midrange comfort; less aligned for listeners prioritising treble extension or large-scale dynamics. |
| **Engineering priorities** | (1) RADIAL polypropylene midrange driver. (2) Cabinet philosophy with controlled contribution (BBC-lineage rather than maximum-rigidity). (3) Vocal accuracy as the primary voicing target. (4) Long-term broadcast-monitor lineage. |
| **Sonic tendencies** | Vocal accuracy; tonally honest in midrange; smooth (absence of edge) on transients; scale less than larger floorstanders; treble extension less than ribbon / beryllium tweeter designs. Distinguished from Spendor: Harbeth's RADIAL midrange driver is the brand's identity-defining engineering choice; Spendor's identity is split between BBC-lineage Classic line and contemporary D/A line. |
| **Comparison guardrails — prefer** | "BBC-lineage midrange accuracy via RADIAL driver vs contemporary driver-stack imaging" (vs KEF). "Single-philosophy BBC lineage vs split-line BBC + contemporary" (vs Spendor). |
| **Mischaracterizations to avoid** | "Boring" — the midrange accuracy is the design intent. "Warm" — vocally accurate, not warm. "Natural" without specifier — Harbeth's *natural* is specifically *vocal naturalness*. |
| **Measurement vs experiential** | Hybrid. |
| **Confidence** | mechanism: high; behavior: high; perception: high. |
| **Review notes** | v2 added explicit engineering chain. |

### Spendor

| Field | Value |
|---|---|
| **Brand** | Spendor |
| **Categories** | Speaker |
| **Core design philosophy** | British heritage with two distinct philosophical lines: Classic (BBC-lineage, parallel to Harbeth) and D/A (contemporary, less BBC-derivative). The brand identity is dual-line rather than single-philosophy. |
| **Sonic tendencies** | **Line-dependent.** Classic line: closer to Harbeth — midrange-natural, tonally honest, smooth. D/A line: more contemporary voicing, broader frequency-response presentation, less BBC-monitor-derived. |
| **Comparison guardrails — prefer** | **Disambiguate by line.** "Spendor Classic line vs Harbeth" — substantive comparison. "Spendor D/A line vs contemporary speakers" — substantive. "Spendor vs anything" without line specification — too coarse. |
| **Confidence** | medium (single-identity), medium-high (per-line) |
| **Review notes** | `multiLineBrand: true`. Two genuinely distinct lines requiring per-line capsules. v1 confidence dropped from v0 to reflect the line split honestly. |

### Magnepan

| Field | Value |
|---|---|
| **Brand** | Magnepan |
| **Categories** | Speaker (planar magnetic) |
| **Core design philosophy** | Planar-magnetic dipole speakers with large-area diaphragms. The design intent is naturalness through low-mass driver topology and dipolar dispersion — a fundamentally different presentation from box speakers. |
| **Sonic tendencies** | Spatially dimensional; transient response fast (low driver mass); tonally even across the panel; less bass extension than ported boxes; scale large; sensitivity lower than typical boxes. |
| **Comparison guardrails — prefer** | "Planar-magnetic dipole topology vs cone-driver box topology" (vs all box speakers). "Planar dipole spatial dimension vs box-speaker bass extension." |
| **Mischaracterizations to avoid** | "Bass-shy" without context — the bass character is dipolar back-radiation behaviour, not bass deficiency. |
| **Confidence** | high |
| **Review notes** | None. |

### KEF

| Field | Value |
|---|---|
| **Brand** | KEF |
| **Categories** | Speaker |
| **Core design philosophy** | British engineering centred on the Uni-Q coaxial driver array. The design intent is point-source coherence — tweeter and midrange share a spatial origin, producing time-aligned imaging consistent across the listening axis. |
| **Sonic tendencies** | Time-aligned imaging precision (point-source coherence); tonally neutral; consistent across listening positions; controlled; clean. Distinguished from Boenicke: KEF's spatial character is point-source coherence via coaxial driver; Boenicke's is cabinet-engineering-driven dimensionality. |
| **Comparison guardrails — prefer** | "Uni-Q coaxial point-source coherence vs traditional driver-stack imaging" (vs most competitors). "Measurement-target imaging vs voiced-by-ear rhythmic articulation" (vs DeVore). |
| **Mischaracterizations to avoid** | "Cold" — neutral and precise, not cold. |
| **Measurement vs experiential** | Strongly measurement-forward. |
| **Confidence** | high |
| **Review notes** | None. |

### WLM (Wiener Lautsprecher Manufaktur)

| Field | Value |
|---|---|
| **Brand** | WLM |
| **Categories** | Speaker (high-efficiency horn / horn-loaded) |
| **Core design philosophy** | Austrian high-efficiency speakers engineered for low-power tube amplification. The design intent is dynamic ease at moderate SPL through high sensitivity — distinct from precision-monitor philosophy. |
| **Sonic tendencies** | Dense; harmonic structure rich; dynamic ease at moderate SPL through high sensitivity; less measured linearity than precision speakers; vocally articulate. |
| **Comparison guardrails — prefer** | "High-efficiency dynamic-ease speaker engineering vs measurement-class precision speaker engineering" (vs KEF). |
| **Mischaracterizations to avoid** | "Coloured" without context — the coloration is the design intent. |
| **Confidence** | medium |
| **Review notes** | Confidence dropped from v0's medium-high to reflect thinner independent review consensus. |

### Wilson Audio

| Field | Value |
|---|---|
| **Brand** | Wilson Audio |
| **Categories** | Speaker |
| **Core design philosophy** | American statement-tier speakers with large-cabinet engineering and custom drivers. The design intent across the line is dynamic capability and resolution at scale — but the line spans materially different voicings (Sasha vs Alexx vs Sabrina), and brand-level single-identity treatment is less defensible than for single-philosophy brands. |
| **Sonic tendencies** | **Line-dependent.** Sasha series: dynamic, neutral with subtle low-mid weight, large-scale. Sabrina (smaller form): scaled-down version with similar voicing intent. Alexx / WAMM (flagship): higher resolution, more uniform tonal-balance polish. |
| **Comparison guardrails — prefer** | **Specify model series.** Wilson Sasha vs Magico S series — substantive. "Wilson vs Magico" without model — too coarse. |
| **Mischaracterizations to avoid** | "Bright" — neutral with subtle low-mid weight, not treble-emphasised. Treating Wilson as a single voice across the entire line. "Natural" / "refined" without specifier — replace with the specific property. |
| **Confidence** | medium |
| **Review notes** | Confidence dropped from v0's medium-high. Line spread is wider than v0 acknowledged. |

### Magico

| Field | Value |
|---|---|
| **Brand** | Magico |
| **Categories** | Speaker |
| **Core design philosophy** | American statement-tier speakers with aluminium / composite cabinet engineering centred on resonance suppression. The design intent is signal pass-through — minimum cabinet contribution to the audible result. |
| **Sonic tendencies** | Transparent through cabinet-resonance suppression (low audible cabinet contribution); neutral; spatially precise; dynamically linear; low harmonic emphasis. Distinguished from Wilson: Magico's transparency comes from cabinet-resonance engineering (vanishing cabinet contribution); Wilson's character comes from large-cabinet resolution at scale. |
| **Comparison guardrails — prefer** | "Cabinet-resonance suppression engineering vs large-cabinet resolution engineering" (vs Wilson). "Aluminium-composite cabinet engineering vs voiced-by-ear cabinet philosophy" (vs DeVore). |
| **Mischaracterizations to avoid** | "Cold" — transparency through cabinet-resonance suppression does not mean cold. |
| **Measurement vs experiential** | Strongly measurement-forward. |
| **Confidence** | medium |
| **Review notes** | Confidence dropped from v0's medium-high — line is broader than capsule covers. |

---

## Other categories (representative)

### Rega

| Field | Value |
|---|---|
| **Brand** | Rega |
| **Categories** | Turntable, amplifier |
| **Core design philosophy** | British engineering centred on rhythmic timing through low mass and rigid construction. The design intent is timing-domain accuracy across the analog playback chain — turntables, cartridges, and amplifiers all engineered around pace and articulation. |
| **Comparison guardrails — prefer** | "Low-mass rigid-construction rhythmic engagement vs heavy-mass tonal-density engineering" (vs heavy-platter turntables / Linn). |
| **Confidence** | high |
| **Review notes** | None. |

### Audio Note (UK)

| Field | Value |
|---|---|
| **Brand** | Audio Note (UK) |
| **Categories** | DAC, amplifier, speaker (full system philosophy) |
| **Core design philosophy** | British boutique brand with an integrated system philosophy: NOS DAC conversion + zero-feedback / low-feedback amplification + high-efficiency speaker matching. The design unit is the *complete system* — each component is engineered to be heard as part of an Audio Note stack. Distinguished from Shindo: Shindo's design unit is the individual circuit; Audio Note's is the full system topology. |
| **Sonic tendencies** | Warm; dense; harmonically rich; midrange continuity through tube circuit + NOS conversion + high-efficiency speaker matching; spatially intimate; relaxed transient timing. |
| **Comparison guardrails — prefer** | "Integrated-system tube philosophy (DAC + amp + speaker) vs per-circuit individual tube design" (vs Shindo). "NOS-conversion + zero-feedback experiential design vs measurement-forward design." |
| **Mischaracterizations to avoid** | "Neutral" — Audio Note is explicitly tonally weighted. "Clinical" — opposite of design philosophy. "Same as Shindo" — both tube experiential, but Audio Note's identity is system-level, Shindo's is circuit-level. |
| **Measurement vs experiential** | Strongly experiential. |
| **Confidence** | high (as editorial archetype) |
| **Review notes** | **Audio Note (UK) is NOT currently in the Audio XX catalog.** Included at user's explicit request as an editorial archetype useful as a comparison anchor. If the brand is not added to catalog, this entry remains a documentation reference only. Audio Note (Japan) is a related but distinct brand and is not addressed in this v1. |

### Hornshoppe

| Field | Value |
|---|---|
| **Brand** | Hornshoppe (the horn shoppe) |
| **Categories** | Speaker (single-driver rear-loaded horn) |
| **Core design philosophy** | American boutique single-driver horn speakers built around a Fostex full-range driver. The design intent is single-driver coherence — no crossover, no driver-summing artefacts. |
| **Sonic tendencies** | Single-driver coherence (no crossover-summing artifacts); transient definition fast; vocally articulate; tonally lean rather than warm; bass extension limited by single-driver topology. Specifically *not* warm — Hornshoppe explicitly counters the "warm horn" stereotype. |
| **Comparison guardrails — prefer** | "Single-driver coherence vs multi-driver crossover-summed imaging" (vs all multi-driver speakers). |
| **Mischaracterizations to avoid** | "Warm" — Hornshoppe is tonally lean despite the horn topology. "Same as Klipsch / horn-typical" — single-driver and full-range, not the multi-driver horn stereotype. "Coherent" without specifier — Hornshoppe's coherence is specifically single-driver coherence (no crossover-summing). |
| **Confidence** | medium |
| **Review notes** | Confidence dropped from v0's medium-high — narrow review consensus. |

### iFi Audio

| Field | Value |
|---|---|
| **Brand** | iFi Audio |
| **Categories** | DAC, headphone amp, accessory |
| **Core design philosophy** | British / Hong Kong-based brand spanning portable and desktop electronics. Generally measurement-aware design with selective tonal voicing options (XBass, 3D, etc. — explicit user-toggleable tone controls distinguish iFi from peers). |
| **Confidence** | medium |
| **Review notes** | Catalog presence as a brand mention in a few products. Capsule deferred for full curation; this is a placeholder. |

---

## Brands flagged for review or recalibration

Brands present in the catalog but **not yet covered** at full capsule depth in this v1 master table. Triaged with reason:

| Brand | Reason |
|---|---|
| **Cayin** | Tube amp brand spanning SET and push-pull lines; per-line capsules required before single-identity treatment is honest. |
| **PrimaLuna** | Push-pull tube; many models with subtle voicing differences. Capsule worth careful curation. |
| **Linear Tube Audio** | OTL tube heritage (David Berning licensure); identity recognisable. Boutique. |
| **Vinnie Rossi** | Discrete linestage / tube hybrid. Capsule deferred. |
| **darTZeel, Soulution, Boulder** | Statement-tier Swiss / European brands — careful curation warranted. Niche review consensus. |
| **Ayre** | Zero-feedback American philosophy; recognisable but capsule deferred. |
| **Innuos, Auralic** | Streaming / server specialists; identity oriented around source-side optimisation rather than transducer-side voicing. |
| **AGD Productions** | GaN-FET amplification; identity worth a separate capsule. |
| **Bottlehead** | DIY tube heritage; positioning differs from production brands. |
| **Sonnet Digital Audio, Merason** | R2R-influenced; capsules deferred. |
| **Cube Audio** | Single-driver speaker; relevant horn-adjacent positioning. |
| **Falcon Acoustics** | LS3/5a heritage; BBC-lineage adjacent to Harbeth/Spendor. |
| **Quad** | British heritage; electrostatic line plus solid-state. Multi-line. |
| **JBL, Klipsch** | Vintage-and-current spread makes single capsule difficult. |
| **Focal** | Beryllium-tweeter house sound is recognisable; capsule deferred. |
| **Wharfedale, Mission, ELAC** | British / German heritage brands; capsules deferred. |
| **Totem Acoustic** | Canadian; small-format speakers. |
| **Amphion** | Finnish; coaxial / studio-monitor heritage. |
| **Linn** | Source-component philosophy + hi-fi system heritage; capsule worth careful curation. |
| **Marantz, NAD** | Heritage brands with current and vintage identities; multi-line. |
| **Pro-Ject, Thorens** | Turntable specialists; capsules deferred. |
| **Sennheiser, Audeze, HiFiMan, Focal headphones, ZMF, Dan Clark, Grado** | Headphone brands need their own category-specific capsules. Deferred. |
| **MA series McIntosh speakers** | Not yet in catalog; would inform McIntosh capsule expansion when added. |

---

## Brands whose existing trait profiles may need synthesis-layer protection

Synthesis-layer regression risk anchored in v1 capsules:

| Brand | Risk class | v1 protection |
|---|---|---|
| **Topping** | Negation-pattern in tendency text | Capsule's mischaracterizations explicitly forbid warm / rich / dense framings. |
| **SMSL** | Same as Topping | Same capsule-level protection. |
| **Rockna** | "Without warmth" framing risk | Capsule explicitly distinguishes Rockna as the neutral-R2R exception. |
| **Hegel** | "Bodied not warm" compound-phrase risk | Capsule explicitly distinguishes density-without-warmth. |
| **Naim** | "British warmth" stereotype risk | Capsule explicitly forbids warm / smooth / British-warmth framings. |
| **Pass Labs** | "Warm" stereotype risk | Capsule explicitly forbids warm framing; Pass is dense, not warm. |
| **Schiit, Gustard, McIntosh, Lampizator, Spendor, Wilson** | Multi-line single-identity risk | Capsules tagged `multiLineBrand: true`. Synthesis must not produce brand-level output without model anchor. |

---

## v2 changelog (2026-05-10)

The v1 → v2 pass was an editorial-hardening pass focused on precision, operational meaning, and hidden cliché drift. Specific changes:

1. **Engineering chain added at full depth** to the named example brands (Denafrips, Topping, Goldmund, Naim, Harbeth, Shindo). Each carries an explicit `mechanism → behavior → perception → preference fit` field.
2. **Per-layer confidence ratings** (mechanism / behavior / perception) replaced single global ratings on the named-example brands and the brands where layers diverge (Mola Mola, TotalDAC, McIntosh, DeVore, Boenicke, Shindo).
3. **Cliché-drift terms scrubbed** per editorial-review memo § 4:
   - *Holographic* → *spatially dimensional* / *spatially precise* (McIntosh, Naim).
   - *Natural* / *naturalness* without object → object specified (DeVore: vocal continuity; Boenicke: tonal evenness; Magnepan: tonal evenness).
   - *Refined* without grounding → specific refinement named (Accuphase: uniform tonal-balance polish; Luxman: tonal density with composure).
   - *Effortless* without mechanism → mechanism-grounded (Hegel: high-current effortless drive into difficult loads).
   - *Analogue-leaning* without specifier → specific analog property named (TotalDAC: vinyl-like transient timing).
   - *Coherent* without type → type specified (Hornshoppe: single-driver coherence; Naim: temporal coherence).
   - *Transparent* alone → grounded in mechanism (Mola Mola: audibility-aware transparency; Magico: cabinet-resonance-suppression transparency).
   - *Flowing* → replaced with *midrange continuity* with mechanism named (Audio Note, Lampizator, MHDT).
   - *Musical* / *musicality* → replaced with operationally grounded language (Pass Labs).
   - *Spatial holography* → *spatial precision* (Naim).
4. **Mischaracterizations expanded** to include the cliché-drift terms each capsule's downstream synthesis must avoid.
5. **Engineering priorities and sonic tendencies separated more cleanly** so that mechanism-layer claims and perception-layer claims are not conflated within a single bullet.

## Cross-references

- **Editorial discipline:** [`brand-philosophy-editorial-review.md`](brand-philosophy-editorial-review.md) (v2)
- **Engineering-intent companion memo:** [`engineering-intent-and-audible-behavior.md`](engineering-intent-and-audible-behavior.md)
- **Integration design:** [`brand-philosophy-layer-design.md`](brand-philosophy-layer-design.md)
- **Spreadsheet form:** [`brand-philosophy-master-table.csv`](brand-philosophy-master-table.csv) (v0 — behind; pending sync to v2)
- **Source for existing brand profiles:** `apps/web/src/lib/consultation.ts` `BRAND_PROFILES` array (line 350+).
- **Calibrated trait-vocabulary reference:** editorial-review memo § 2.
- **Cautioned-terms reference:** editorial-review memo § 4.
- **Engineering-intent reasoning reference:** editorial-review memo § 3.
- **Calibration regression source:** commit `7cee216`.
