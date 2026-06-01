# Phase E-5A — Brand-House-Voicing Data Layer Design

**Status:** Design draft only. Not wired into composers, renderers, or
any production rendering path. This document is a research-and-design
artifact for review prior to Phase E-5B implementation.

**Companion commit:** Documentation-only addition. No
`SystemAssessmentArtifact.tsx` changes.

---

## 1. Motivation

After Phase E-4, the artifact is structurally sound: headphones, auxiliaries,
active speakers, subwoofers, and split-tier heritage speakers all
render correctly. The remaining systemic credibility gap is identity-
awareness. The artifact recognizes that a Naim Supernait 3 is an
integrated amplifier and that a Quad ESL-57 is a destination
loudspeaker — but it does not recognize Naim *as Naim*, with its PRaT
voicing and power-supply hierarchy, or Quad ESL *as Quad ESL*, with
its Peter Walker electrostatic lineage and amplifier-matching
demands. The §5 prose reads as a competent generalist; owners read
their cards and notice that no Naim-specific knowledge was required
to write them.

Phase E-5A designs the data layer that, in a later Phase E-5B, the
§5 composer (and possibly §8 / §10) would consult to surface brand-
specific identity sentences. The objective of Phase E-5A is to produce
that data layer as a reviewable artifact — with no rendering changes —
so that the editorial discipline of the language can be inspected
before any code reads from it.

---

## Brand Layer Philosophy (Governing Principle)

The purpose of the brand layer is to explain why experienced owners
repeatedly arrive at certain system-building patterns — not to
explain sound through brand identity. Brand information may
enrich an explanation, but it must never replace
**Design → Behavior → Experience** reasoning.

Every entry in this document, every sentence the composer would
later surface, and every revision in the editorial review pass is
evaluated against the rule:

> *Architecture produces behavior. Behavior, in the right context, produces a listening experience. The brand is the name attached to a coherent set of architectural choices — not the cause of the experience.*

Concretely, this principle has three implications that are binding
on every entry below and on the Phase E-5B implementation:

1. **The data layer is allowed to name editorial vocabulary**
   (PRaT, low coloration, source-first) **only when it ties the
   vocabulary back to an identifiable design choice**. A sentence
   that uses PRaT as the explanation — rather than the editorial
   label for behavior arising from a discrete signal path and
   power-supply design — violates the principle.

2. **The data layer must not invert system-building causality.**
   "Systems are built around McIntosh because it is McIntosh" is
   the failure mode. "Systems are built around the amplifier
   because the autoformer-coupled output is load-tolerant" is the
   correct framing of the same factual observation.

3. **The brand layer is secondary, not primary.** The §5
   composer's authoritative source for character is the engine's
   trait inference and the component's facts phrase, not the
   brand entry. The brand entry adds context to an already-formed
   explanation; it does not initiate one.

This governing principle SUPERSEDES any individual entry's
phrasing where they conflict. The §12 editorial review findings
apply this principle entry-by-entry; §13 makes adherence to it a
hard precondition for E-5B.

---

## 2. Proposed Schema

```ts
type BrandConfidence = 'high' | 'medium' | 'low';
type BrandPriority = 'audiophile-identity' | 'mixed' | 'commercial';
type RoleFamily = 'source' | 'amplifier' | 'speaker' | 'auxiliary' | 'all';

interface BrandHouseVoicing {
  // ─── Identity ─────────────────────────────────────────────────
  /** Canonical display name. */
  brand: string;
  /** For sub-brands or lineage markers (e.g. JBL Synthesis → JBL). */
  brandFamily?: string;
  /**
   * Lower-case tokens to match against chain names. Used by a future
   * lookup helper analogous to brandTokensFromChainName. Match is
   * substring within the lowercased chain entry name; ordering
   * matters (more specific tokens before more general ones).
   */
  matchTokens: readonly string[];

  // ─── Editorial designation ────────────────────────────────────
  /**
   * Whether this entry is intended for advisory house-voicing prose
   * (audiophile-identity), commerce-only catalog presence (commercial),
   * or both (mixed). Commercial entries SHOULD NOT generate identity
   * prose; the field exists only so the catalog layer can mark them
   * as known brands.
   */
  priority: BrandPriority;
  /**
   * Confidence the artifact can have when emitting house-voicing prose
   * for this brand:
   *   - high   : claims are widely-agreed editorial vocabulary
   *   - medium : claims are reasonable but should be hedged
   *   - low    : do not generate identity prose; structural only
   */
  confidence: BrandConfidence;

  // ─── Voicing claims (use sparingly) ───────────────────────────
  /** ≤1 sentence — tonal / timing / dynamic character. */
  houseVoicing?: string;
  /** ≤1 sentence — engineering / design ethos. */
  designPhilosophy?: string;
  /** ≤1 sentence — how upgrades work within the brand's ecosystem. */
  systemBuildingLogic?: string;

  // ─── Editorial scaffolding (sentence fragments / bullets) ─────
  commonStrengths: readonly string[];   // 2-4 phrases
  commonTradeoffs: readonly string[];   // 1-3 phrases
  upgradeCautions: readonly string[];   // 0-2 phrases
  /** ≤1 sentence — when this brand fits the system context. */
  bestUsedWhen?: string;

  // ─── Anti-overclaim guardrails ────────────────────────────────
  /**
   * Phrases / claims the artifact must NEVER emit when referring to
   * this brand. Includes superlatives, marketing buzzwords, and
   * common owner-overclaim phrases. The composer should run an
   * explicit deny-check before output.
   */
  avoidOverclaiming: readonly string[];

  // ─── Applicability ────────────────────────────────────────────
  appliesToRoles: readonly RoleFamily[];
  /** Reference anchor models. */
  exampleModels: readonly string[];

  // ─── Maintenance notes ────────────────────────────────────────
  /** Editorial notes for future reviewers (lineage, common errors). */
  notes?: string;
}
```

### Schema discipline notes

- **All voicing fields are optional.** A brand entry can have a strong
  `commonStrengths` list and no `houseVoicing` sentence; the composer
  decides which fields are safe to surface based on `confidence`.
- **`matchTokens` is the lookup primitive.** It is intentionally
  separate from the existing `DESTINATION_SPEAKER_BRANDS` /
  `DESTINATION_SPEAKER_MODELS` token sets. The two are not the same
  axis: house voicing applies to source / amp / speaker; destination
  status applies only to speaker.
- **`priority: 'commercial'` is a hard gate.** A future composer
  reading this data MUST NOT emit identity prose for commercial-only
  entries, regardless of how rich their other fields are.
- **`avoidOverclaiming` is a deny-list at output time.** The composer
  layer should run an explicit substring check before emitting any
  composed sentence that names this brand.

---

## 3. First-Draft Brand Entries (23 active audiophile-identity + 2 deferred + 6 commercial markers)

The full draft is reproduced verbatim in this document so it can be
reviewed without consulting source. The layout below mirrors what a
future `.ts` data file would contain; sentence lengths, claim
restraint, and `avoidOverclaiming` lists are the editorial substance
of this design pass.

**Post-revision implementation set for E-5B is 23 audiophile-identity
entries**, not 25. Two entries (Audio Note, Shindo) are explicitly
marked DEFERRED below and must not be wired by the E-5B composer:

- **Audio Note (#18)** — deferred pending future model-level
  disambiguation between Audio Note UK and Audio Note Japan.
- **Shindo Laboratory (#20)** — deferred because English-language
  identity coverage falls below the multi-source confidence threshold
  applied to other entries.

The deferred entries are retained in §3 as research material; their
fields are marked "research note, do not surface" and must not be
read by the composer.

### High-priority audiophile-identity brands (23 active for E-5B; 2 deferred)

#### 1. Naim Audio
- **matchTokens:** `['naim']`
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** The discrete signal path and tight coupling between the input stage and the power supply tend to produce a forward, rhythmically engaged presentation; editorial coverage often labels this behavior PRaT (Pace, Rhythm, and Timing), but the term names the listening result rather than explaining it.
- **designPhilosophy:** All-discrete signal path; power-supply design treated as a primary determinant of sound, with outboard PSUs offered as a within-brand upgrade path on many models. The PSU hierarchy is an engineering choice, not a marketing label.
- **systemBuildingLogic:** Within the Naim ecosystem, upgrades tend to run through external power supplies and tier-step electronics because the within-brand architecture is what changes audibly; cross-brand substitution typically dilutes the rhythmic engagement that owners build around.
- **commonStrengths:** Rhythmic engagement; vocal directness; ecosystem-coherent system building.
- **commonTradeoffs:** Forward presentation that does not suit every recording; in many systems the PSU hierarchy is part of how the brand is meant to be heard.
- **upgradeCautions:** Mixing Naim with non-Naim partners often shifts the presentation away from the brand's identity.
- **bestUsedWhen:** The listener prioritizes rhythm and timing engagement over warmth or maximal resolution.
- **avoidOverclaiming:** "unrivalled"; "best in class"; "the Naim sound" as a self-evident referent; "PRaT leader"; "the only brand that does PRaT"; "endgame"; "world class".
- **appliesToRoles:** `['source', 'amplifier']`
- **exampleModels:** NDX 2, XPS DR, Supernait 3, NAP 250, Nait XS 3.
- **notes:** PRaT is widely-recognized editorial vocabulary in Naim coverage and is safe to use when hedged as editorial vocabulary, not as an objective property. The PSU hierarchy (HiCap → XPS DR → 555PS DR) is a documented Naim upgrade convention; reference it as a within-brand convention, not as a universal upgrade truth.

#### 2. Linn Products
- **matchTokens:** `['linn']`
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** Source-first presentation, with emphasis on rhythmic precision and timing in many systems.
- **designPhilosophy:** Source-first design principle: in Linn's editorial position, source quality sets a ceiling on what the rest of the system can convey. Heavily software-defined in modern lines (Konfig configuration software, Space Optimisation room correction).
- **systemBuildingLogic:** LP12 (vinyl) or Klimax DSM (digital) commonly function as the brand-tier anchor; the Klimax / Akurate / Selekt tier ladder structures within-brand upgrades.
- **commonStrengths:** Source-tier coherence; modular upgrade path within the ecosystem; active-speaker integration via Akubarik / Akudorik.
- **commonTradeoffs:** Single-brand voicing dependence; Linn presentation is preference-dependent.
- **upgradeCautions:** Mixing Linn sources with non-Linn electronics often weakens the source-first premise.
- **bestUsedWhen:** The listener is committed to a single-brand ecosystem with source-first upgrade priorities.
- **avoidOverclaiming:** "the source of truth"; "unrivalled timing"; "the Linn sound" as a self-evident referent; "endgame"; "world class"; "the only source-first brand".
- **appliesToRoles:** `['source', 'amplifier', 'speaker']`
- **exampleModels:** LP12 Klimax, Klimax DSM, Akubarik, Selekt DSM, Majik.
- **notes:** Source-first is foundational Linn editorial vocabulary and is safe to reference; do not present it as an objective property. Linn's voicing across decades has shifted (early Tiefenbrun era vs. modern software-defined era); treat the modern era as the referent.

#### 3. Pass Labs
- **matchTokens:** `['pass labs', 'pass laboratories']`
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** Class-A solid-state often described in terms of tonal density and dynamic ease at moderate volumes, with control achieved without smoothing texture.
- **designPhilosophy:** Nelson Pass design lineage: relatively simple topologies, generous Class-A bias, large heatsinks, and current delivery prioritized over feature complexity.
- **systemBuildingLogic:** XA / INT / X-series tiers each carry different Class-A bias levels; within-brand step typically follows loudspeaker drive demands.
- **commonStrengths:** Tonal density; bass control without thinning; long-term listenability in many systems.
- **commonTradeoffs:** Heat output from Class-A operation; chassis weight; room ventilation is part of ownership.
- **upgradeCautions:** XA-series → larger XA-series is the canonical within-brand step rather than substitution to a different topology.
- **bestUsedWhen:** A demanding loudspeaker load benefits from Class-A current delivery, and the room accommodates the heat.
- **avoidOverclaiming:** "warm"; "tube-like"; "the only Class-A that does X"; "the Pass sound"; "endgame"; "world class"; "Class-A leader".
- **appliesToRoles:** `['amplifier']`
- **exampleModels:** XA25, XA60.8, XA200.8, INT-25, INT-60, XP-32, XP-27.
- **notes:** Pass amplifiers are not tube-like in voicing — a common owner shorthand to avoid. Nelson Pass also runs FirstWatt as a separate brand for kit-friendly low-power designs; do not conflate the two.

#### 4. Quad (Acoustical Manufacturing)
- **matchTokens:** `['quad esl', 'quad ii']` — *non-ESL Quad excluded by token specificity*
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** Electrostatic loudspeaker family often associated with midrange realism and point-source coherence at the cost of SPL ceiling.
- **designPhilosophy:** Acoustical Manufacturing heritage carried forward from Peter Walker's original ESL design. The ESL panel is a full-range dipole electrostatic with a load curve distinct from conventional dynamic loudspeakers.
- **systemBuildingLogic:** ESL loudspeakers tend to pair with specific amplifier types — typically tube or low-power solid-state chosen for the electrostatic load — and act as the system anchor.
- **commonStrengths:** Midrange realism; vocal naturalness; time coherence; long-term listenability in the right context.
- **commonTradeoffs:** SPL ceiling; room placement matters for dipole behavior; electrostatic load is demanding for some amplifiers.
- **upgradeCautions:** ESL panels are amplifier-sensitive; partner choice matters substantially. Modern Quad ESL service and panel availability is an ownership consideration.
- **bestUsedWhen:** The listener prioritizes midrange and vocal naturalness over scale, and the room supports dipole loading.
- **avoidOverclaiming:** "the only true electrostatic"; "unbeatable midrange"; "Peter Walker's last word"; "magic"; "endgame"; "world class"; "the only ESL that does X".
- **appliesToRoles:** `['speaker', 'amplifier']` *(amplifier covers Quad II / II-forty tube line)*
- **exampleModels:** ESL-57, ESL-63, ESL-2912, Quad II, Quad II Classic, Quad II-forty.
- **notes:** Non-ESL Quad products (Quad 99, Vena, S-2, etc.) are not in scope for this entry. `matchTokens` is intentionally narrowed to `quad esl` / `quad ii` to avoid triggering on non-heritage Quad lines. The ESL-57 in particular has a well-documented SPL and amplifier-load profile; any house-voicing sentence must be hedged accordingly.

#### 5. Tannoy
- **matchTokens:** `['tannoy prestige', 'tannoy legacy', 'canterbury', 'westminster', 'kensington', 'turnberry', 'cheviot', 'arden', 'eaton', 'glenair', 'stirling']` — *intentionally model-scoped to Prestige and Legacy families; bare "tannoy" excluded to prevent identity transfer to installation / commercial Tannoy lines*
- **priority:** `audiophile-identity` • **confidence:** `high` *(retained — see notes for the Design→Behavior justification)*
- **houseVoicing:** Dual-Concentric coaxial driver design, often described in terms of point-source imaging and a broad listening window; the coaxial geometry is what produces the imaging characteristic, not the brand.
- **designPhilosophy:** Heritage Dual-Concentric driver — an HF compression driver loaded behind a low-frequency driver, sharing a single acoustic axis. The Prestige line uses 12-inch and 15-inch dual-concentrics in classic cabinet alignments inherited from the Tannoy Monitor heritage.
- **systemBuildingLogic:** Tannoy Prestige loudspeakers tend to function as system anchors because the Dual-Concentric driver's load curve and the cabinet's room-coupling characteristic dictate placement and amplifier choices before any other system decision.
- **commonStrengths:** Point-source imaging from the Dual-Concentric geometry; broad listening window; dynamic ease from large drivers in suitable rooms.
- **commonTradeoffs:** Cabinet size for full Prestige models; the coaxial driver's coherence character is preference-dependent.
- **upgradeCautions:** Within the Prestige and Legacy lines, driver size (10 vs 12 vs 15 inch) shapes scale and room match more than electronics changes.
- **bestUsedWhen:** A large room benefits from the dynamic ease of 12- or 15-inch Dual-Concentric drivers.
- **avoidOverclaiming:** "unrivalled coherence"; "the Tannoy sound"; "the only true coaxial"; "endgame"; "world class"; "magic".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** Canterbury GR, Westminster Royal GR, Kensington, Turnberry GR, Cheviot, Arden, Eaton.
- **notes:** **Confidence rationale.** High confidence is retained because the explanatory mechanism in this entry is the Dual-Concentric architecture itself, not corporate continuity. The driver geometry, the Prestige cabinet alignments, and the Legacy lineage are stable references regardless of ownership; the entry's claims would survive a further ownership change without revision. Commercial / installation Tannoy products and any post-Prestige consumer lines are out of scope — `matchTokens` is narrowed to Prestige / Legacy model names specifically so that identity transfer to non-Prestige Tannoy products is structurally prevented.

#### 6. McIntosh
- **matchTokens:** `['mcintosh']`
- **priority:** `audiophile-identity` • **confidence:** `medium`
- **houseVoicing:** Smooth, full-bodied presentation with broad headroom in many systems.
- **designPhilosophy:** Autoformer output transformers (in many solid-state designs) and unity-coupled circuit (in tube designs). Visual identity (blue meters) is a recognized part of the brand but is not a sonic claim.
- **systemBuildingLogic:** McIntosh integrated amplifiers and MA / MC pairings often act as the system anchor because the autoformer-coupled output offers broad load tolerance across difficult speaker impedance curves; in many systems this lets the speaker be chosen for room and listener taste rather than to match an amplifier's load preferences.
- **commonStrengths:** Broad headroom; tonal weight; long-term within-brand ownership ecosystem.
- **commonTradeoffs:** Presentation is preference-dependent; weight and physical scale of larger models.
- **upgradeCautions:** Hybrid tube/SS designs (e.g. MA12000) are not pure-tube despite the tube indicator stage.
- **bestUsedWhen:** The listener values broad headroom and is comfortable with the McIntosh presentation.
- **avoidOverclaiming:** "warmest in solid-state"; "unbeatable bass"; "the only autoformer"; "the McIntosh sound"; "endgame"; "world class"; "best integrated".
- **appliesToRoles:** `['amplifier']`
- **exampleModels:** MC275, MA12000, MA8950, MC462, MC1.25KW.
- **notes:** Hybrid tube+SS designs (MA12000) are often mistaken for pure-tube; the tube stage is preamp / driver, the output is solid-state with autoformer. Brand voicing has evolved across ownership and era; treat the modern Binghamton-made models as the referent.

#### 7. Audio Research
- **matchTokens:** `['audio research']`
- **priority:** `audiophile-identity` • **confidence:** `medium` *(DOWNGRADED in editorial review — 2024 ownership change makes forward-looking house voicing less certain than the historical record)*
- **houseVoicing:** All-tube Reference line often described in terms of harmonic density and dynamic capability, without slipping into euphonic warmth. The LS line voicing is more neutral and less obviously tube-flavored.
- **designPhilosophy:** William Z. Johnson lineage. Reference series is all-tube high-power, often with auto-bias. The LS (line stage) and Ref (reference) lines are voiced differently and should not be collapsed.
- **systemBuildingLogic:** Reference series components historically partner with destination-class loudspeakers (Wilson, Magico, Sonus Faber are common pairings); the LS series sits as the mid-tier all-tube preamplifier with a less imposing chassis.
- **commonStrengths:** Harmonic density; dynamic capability; long history of partnership with destination-class loudspeakers.
- **commonTradeoffs:** Tube life as ongoing ownership cost; heat output from larger Ref amps.
- **upgradeCautions:** Within the historical ARC catalog, Ref → larger Ref is the canonical step; cross to non-ARC tube architecture changes the system's identity. ARC changed hands in 2024 and the future direction of the brand is not yet established — treat current claims as historical until new product confirms continuity.
- **bestUsedWhen:** A destination-class loudspeaker benefits from tube character without bloom.
- **avoidOverclaiming:** "warm"; "best of all worlds"; "the ARC voice"; "endgame"; "world class"; "the reference tube brand"; "magic".
- **appliesToRoles:** `['amplifier']`
- **exampleModels:** Ref 6, Ref 6SE, Ref 160M, Ref 80, LS28, Ref Phono 3.
- **notes:** Reference and LS lines are voiced differently — the artifact should not collapse them. ARC was sold in 2024; ownership and service continuity is a current consideration, and any new model under new ownership should be treated as a separate editorial entity until validated.

#### 8. dCS
- **matchTokens:** `['dcs']`
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** Digital presentation often described in terms of timing precision and clean extension; not a "voiced" DAC in the warmth/lean sense.
- **designPhilosophy:** Ring DAC architecture — a discrete FPGA-driven topology distinct from conventional R2R or delta-sigma. Originated in professional audio applications.
- **systemBuildingLogic:** Vivaldi (statement stack) / Rossini (one-box) / Bartók (compact streaming endpoint) tier ladder; each step is meaningful in capability and cost.
- **commonStrengths:** Timing precision; resolution; low noise floor; long-term firmware support cadence.
- **commonTradeoffs:** Cost ceiling for Vivaldi APEX; not aimed at listeners who prefer a euphonic R2R signature.
- **upgradeCautions:** Within dCS, the Vivaldi APEX path is the canonical within-brand step; cross to R2R brands changes the digital character substantively.
- **bestUsedWhen:** The system is high-resolution downstream and the digital source is the limiting factor.
- **avoidOverclaiming:** "the only reference DAC"; "unbeatable"; "transparent" (over-used); "endgame"; "world class"; "the digital reference"; "measurement leader"; "magic".
- **appliesToRoles:** `['source']`
- **exampleModels:** Bartók, Rossini, Vivaldi APEX.
- **notes:** Ring DAC is a dCS trademark architecture and safe to name. The Bartók is widely regarded as high-tier but is not unilaterally destination-class — destination decisions remain system-context-dependent.

#### 9. Chord Electronics
- **matchTokens:** `['chord hugo', 'chord dave', 'chord m scaler', 'chord mojo', 'chord qutest']` — *narrowed to specific Chord Electronics products to avoid collision with "Chord Company" cables*
- **priority:** `audiophile-identity` • **confidence:** `medium`
- **houseVoicing:** FPGA-driven DAC line often described in terms of transient sharpness and spatial focus; distinct from typical R2R and delta-sigma voicings.
- **designPhilosophy:** Rob Watts FPGA designs across the Hugo / DAVE / M Scaler / Mojo line. Distinctive aluminum-billet chassis as visual identity.
- **systemBuildingLogic:** Hugo TT2 / DAVE act as the brand-tier anchors; the M Scaler adds upstream taps in the digital domain.
- **commonStrengths:** Transient clarity; spatial focus; distinctive desktop ergonomics.
- **commonTradeoffs:** Voicing is preference-dependent; case aesthetic is polarizing.
- **upgradeCautions:** Hugo line → DAVE is a substantial price step; M Scaler is an alternative within-brand upgrade path rather than a direct replacement.
- **bestUsedWhen:** The listener values transient precision and is comfortable with the Chord case aesthetic.
- **avoidOverclaiming:** "the most resolving"; "measurement leader"; "Rob Watts proves"; "endgame"; "world class"; "the only FPGA DAC"; "magic".
- **appliesToRoles:** `['source']`
- **exampleModels:** Hugo TT2, DAVE, M Scaler, Hugo 2, Mojo 2, Qutest.
- **notes:** Chord Company (cables) is a separate entity. `matchTokens` is intentionally narrowed to specific product names to avoid false positives on "Chord cables" / similar.

#### 10. Klipsch Heritage
- **brandFamily:** `'Klipsch'`
- **matchTokens:** `['klipsch heresy', 'klipsch forte', 'klipsch cornwall', 'klipsch la scala', 'klipsch lascala', 'klipschorn', 'klipsch khorn']` — *intentionally NOT 'klipsch' alone*
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** Horn-loaded high-efficiency presentation, often described in terms of dynamic immediacy and broad dynamic range, with controlled directivity that trades off-axis evenness for on-axis efficiency.
- **designPhilosophy:** Paul W. Klipsch heritage (Hope, Arkansas). Horn loading plus high efficiency (~99 dB) translates to very low amplifier power requirements.
- **systemBuildingLogic:** Heritage loudspeakers tend to pair with low-power tube amplifiers in the canonical Klipsch system; the cabinet is the long-term anchor.
- **commonStrengths:** Dynamic immediacy; suits low-power tube amplification; long lifecycle ownership.
- **commonTradeoffs:** Forward presentation that does not suit every recording; off-axis response varies more than dome / planar designs.
- **upgradeCautions:** Heritage line is distinct from Klipsch mass-market (RP / R / Reference Premiere) — they share little design philosophy and should not be presented under the same identity.
- **bestUsedWhen:** A low-power tube amplifier benefits from a high-efficiency partner and the room accommodates the cabinet size.
- **avoidOverclaiming:** "the only horn that does X"; "best in class"; "Paul Klipsch's last word"; "endgame"; "world class"; "magic"; "the only horn"; "giant killer"; "the original horn that…".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** Heresy IV, Forte IV, Cornwall IV, La Scala AL5, Klipschorn AK6.
- **notes:** **CRITICAL** — Klipsch Heritage is sonically and editorially distinct from Klipsch RP / Reference Premiere mass-market. The artifact must not transfer Heritage identity to the RP line. `matchTokens` matches only Heritage model names.

#### 11. JBL Studio Monitor & Synthesis
- **brandFamily:** `'JBL'`
- **matchTokens:** `['jbl 4329', 'jbl 4349', 'jbl 4367', 'jbl 4429', 'jbl k2', 'jbl m2', 'jbl everest', 'jbl dd67000']`
- **priority:** `audiophile-identity` • **confidence:** `medium`
- **houseVoicing:** Professional-monitor heritage, often described in terms of dynamic capability, controlled directivity via large compression-driver horns, and broad headroom.
- **designPhilosophy:** Greg Timbers and successors. 4xxx Studio Monitor lineage carries forward from professional recording-monitor use; K2 / M2 / Everest sit in the Synthesis flagship line.
- **systemBuildingLogic:** A 4xxx Studio Monitor tends to act as the system anchor; high-efficiency horn loading favors moderate-power solid-state or hybrid amplification.
- **commonStrengths:** Dynamic capability; broad headroom; pro-monitor lineage credibility.
- **commonTradeoffs:** Cabinet size for larger models; forward presentation is preference-dependent.
- **upgradeCautions:** The 4xxx Studio Monitor line is distinct from JBL Stage / Studio mid-tier home — they are not the same lineage and should not be collapsed.
- **bestUsedWhen:** A large room benefits from horn-loaded dynamic capability and the listener values pro-monitor presentation.
- **avoidOverclaiming:** "the only professional monitor"; "flat reference"; "the JBL sound"; "endgame"; "world class"; "the only studio monitor that…"; "giant killer".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** 4429, 4349, 4367, K2 S9900, M2, Project Everest DD67000.
- **notes:** JBL Stage / Studio (5xx, 6xx) and L100 Classic are separate lines with different voicings; intentionally NOT in `matchTokens`.

#### 12. Harbeth
- **matchTokens:** `['harbeth']`
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** BBC research-derived tradition, often described in terms of midrange naturalness and long-listening comfort, with thin-wall cabinet construction characteristic of the line.
- **designPhilosophy:** Alan Shaw lineage. RADIAL polypropylene cone material. Thin-wall MDF cabinet construction inherited from BBC research; Harbeth's relationship to that research is genealogical (founder Dudley Harwood was a BBC engineer) rather than a perpetual licensing arrangement.
- **systemBuildingLogic:** Harbeth standmounts tend to function as long-term system anchors; Class-A or high-bias Class-AB amplification is the common partner.
- **commonStrengths:** Midrange naturalness; vocal presentation; long-listening comfort; long lifecycle ownership.
- **commonTradeoffs:** Bass extension limited by the BBC-tradition cabinet alignment; proper stands are part of the design.
- **upgradeCautions:** Within Harbeth, the 30.2 XD → 40.2 XD → 40.3 XD steps each materially change scale and room match.
- **bestUsedWhen:** A small-to-medium room favors midrange-led standmounts with a high-bias amplifier.
- **avoidOverclaiming:** "the most natural"; "BBC monitor truth"; "Harbeth honesty"; "endgame"; "world class"; "the only true BBC speaker"; "magic".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** 30.2 XD, SHL5plus XD, Monitor 40.3 XD, P3ESR XD.
- **notes:** BBC tradition is editorially safe when described as research-derived / genealogical, not as licensing or exclusive ownership. RADIAL is Alan Shaw's polymer cone material and is a brand-specific identity feature.

#### 13. Spendor
- **matchTokens:** `['spendor']`
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** BBC heritage line (Classic) is sealed-cabinet, midrange-focused; D-series modern line is bass-reflex and more modern-voiced.
- **designPhilosophy:** BBC heritage extends from LS3/5a / LS5/8 lineage. Modern D-series moves the brand toward bass-reflex modern speakers without abandoning the heritage line.
- **systemBuildingLogic:** Classic 2/3 / SP100R2 are sealed BBC heritage; D7.2 / D9.2 / A4 are modern bass-reflex. The two lines are voiced differently.
- **commonStrengths:** BBC tradition (Classic line); modern bass extension (D-series); sealed-cabinet control (Classic).
- **commonTradeoffs:** Classic line bass extension limited; D-series voicing distinct from Classic — not a like-for-like upgrade.
- **upgradeCautions:** Classic → D-series is a voicing change, not a hierarchical step.
- **bestUsedWhen:** The owner has decided whether they prefer the sealed BBC tradition or the modern reflex direction.
- **avoidOverclaiming:** "BBC truth"; "British best"; "the Spendor sound"; "endgame"; "world class"; "the only true BBC line"; "magic".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** Classic 2/3, SP100R2, D7.2, D9.2, A4, Classic 1/2.
- **notes:** Distinguish Classic line from D-series — they are not the same voicing. Like Harbeth, Spendor is a BBC licensee/inheritor; do not present BBC heritage as exclusive ownership.

#### 14. Wilson Audio Specialties
- **matchTokens:** `['wilson audio', 'wilson sasha', 'wilson sabrina', 'wilson alexx', 'wilson watt', 'wamm']`
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** Often described in terms of dynamic-range capability with cabinet damping that contributes to low colouration; X-Material composite chassis is distinct from MDF or aluminum.
- **designPhilosophy:** David Wilson lineage. Time-aligned driver arrangement; cabinet adjustability (modular drivers) on flagship models.
- **systemBuildingLogic:** Sabrina X / Sasha DAW / Alexx V / WAMM Master Chronosonic form a within-brand ladder; the cabinet tends to be the long-term anchor.
- **commonStrengths:** Dynamic capability; sustained scale at volume; cabinet damping that supports low colouration.
- **commonTradeoffs:** Room-dependent; cabinet size for upper-tier models; setup-sensitive on placement and toe.
- **upgradeCautions:** Sasha DAW → Alexx V is a substantial scale step; not every room supports it.
- **bestUsedWhen:** A large room and a destination-tier amplifier benefit from Wilson scale and dynamic range.
- **avoidOverclaiming:** "the only dynamic speaker"; "flat measurement reference"; "the Wilson sound"; "endgame"; "world class"; "the only modular speaker"; "magic".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** Sabrina X, Sasha DAW, Alexx V, WAMM Master Chronosonic.
- **notes:** Wilson Benesch is a separate UK brand (carbon-fibre cabinet) and is not the same identity.

#### 15. Magico
- **matchTokens:** `['magico']`
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** Sealed-cabinet aluminum-extrusion construction designed to minimize cabinet contribution; the engineering goal is low cabinet colouration, though the resulting presentation is preference-dependent — some listeners hear neutrality, others find it analytical.
- **designPhilosophy:** Aluminum-extrusion sealed cabinets and beryllium tweeters (in higher tiers) are the durable engineering claims; "low colouration" is the design intent rather than a universally-agreed listening outcome.
- **systemBuildingLogic:** A-series (entry) → S-series → M-series within-brand ladder; sealed-cabinet design tends to favor solid-state amplification with strong bass control.
- **commonStrengths:** Cabinet inertness; bass control via sealed alignment; engineering consistency across the line.
- **commonTradeoffs:** Cabinet weight; sealed-cabinet bass extension favors amplification with grip.
- **upgradeCautions:** A1 → A3 → A5 → S3 → M-series each substantially change scale and room match.
- **bestUsedWhen:** A solid-state amplifier with strong bass control is in place, and the room benefits from sealed-cabinet bass discipline.
- **avoidOverclaiming:** "the most neutral"; "measurement winner"; "Magico measurement"; "the only sealed-cabinet leader"; "endgame"; "world class"; "the measurement reference"; "magic".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** A1, A3, A5, S3, M3, M6.
- **notes:** Sealed-cabinet aluminum-extrusion construction is a Magico identity feature; measurement claims must be hedged because "neutral" is not a universally-shared category among destination loudspeakers.

#### 16. YG Acoustics
- **matchTokens:** `['yg acoustics', 'yg carmel', 'yg hailey', 'yg sonja', 'yg vantage']`
- **priority:** `audiophile-identity` • **confidence:** `medium`
- **houseVoicing:** Precision-machined aluminum drivers (BilletCore) in sealed cabinets, often described in terms of measurement-led voicing and transient sharpness.
- **designPhilosophy:** Yoav Geva lineage. Precision aluminum driver machining; sealed cabinets. US-designed loudspeaker brand with a measurement-forward stance.
- **systemBuildingLogic:** Carmel 2 (entry) → Hailey → Sonja → Vantage within-brand ladder; each step is a meaningful change in scale and ambition.
- **commonStrengths:** Precision driver behavior; sealed-cabinet bass discipline; engineering consistency across the line.
- **commonTradeoffs:** Transient sharpness is preference-dependent; placement and amplification choices matter.
- **upgradeCautions:** Carmel 2 → Hailey is a substantial scale step in both price and room demand.
- **bestUsedWhen:** A solid-state amplifier with linear measurement partners well, and the listener values transient precision.
- **avoidOverclaiming:** "the most precise"; "measurement leader"; "the YG sound"; "endgame"; "world class"; "every model is reference"; "the only precision speaker"; "magic".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** Carmel 2, Hailey 2.2, Sonja XV, Vantage.
- **notes:** BilletCore driver and sealed cabinet are YG identity features. Do not treat every tier as reference-class; Carmel 2 is the entry into the line and is positioned differently from Sonja.

#### 17. DeVore Fidelity
- **matchTokens:** `['devore', 'devore fidelity']`
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** Wide-baffle dynamic loudspeakers with high efficiency; the Orangutan line is associated with low-to-moderate power tube amplification as its canonical partner.
- **designPhilosophy:** John DeVore lineage. New York-based. Orangutan line uses wide-baffle high-efficiency dynamic drivers; the Reference line uses a different architecture and should be treated separately.
- **systemBuildingLogic:** Orangutan O/93, O/96, O/Reference, and the Gibbon line cover a wide range; the Orangutan line in particular tends to pair with low-to-moderate power tube amplification.
- **commonStrengths:** High efficiency that suits tube partnering; wide-baffle scale; tonal density in the right context.
- **commonTradeoffs:** Wide-baffle imaging is not pinpoint; cabinet width and placement requirements limit room fit.
- **upgradeCautions:** Orangutan line voicing is distinct from Gibbon — they are not the same lineage.
- **bestUsedWhen:** A low-power tube amplifier benefits from a high-efficiency partner and the listener prefers tonal weight over pinpoint imaging.
- **avoidOverclaiming:** "the warmest"; "reference natural"; "the DeVore sound"; "endgame"; "world class"; "the only horn alternative"; "magic".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** O/93, O/96, O/Reference, Gibbon 88, Gibbon Super 8.
- **notes:** Small NYC-based brand; service and ownership continuity is an ownership consideration. Phase K reference uses DeVore in a high-efficiency tube context.

#### 18. Audio Note (UK & Japan) — **DEFERRED FROM E-5B**

> **Status: DEFERRED.** This entry is excluded from the initial
> Phase E-5B implementation set. The decision is structural, not
> editorial: a single brand-level entry for "Audio Note" cannot
> correctly serve both Audio Note UK and Audio Note Japan, which
> are separately owned companies with different lineages,
> different model ranges, and different voicing targets. Surfacing
> house-voicing prose against the unified `['audio note']` token
> would risk misattributing UK character to a Japan owner (or
> vice versa) — exactly the failure mode the §12.6 split-tier
> rule was written to prevent.
>
> **Future treatment requires model-level disambiguation.** A
> future revision should replace this single entry with two
> entries keyed to identifiable model families (for example
> Audio Note UK on `['an-e', 'an-j', 'an-k', 'cd 2.1x',
> 'meishu', 'soro', 'oto']`, Audio Note Japan on the appropriate
> Ongaku / Gaku-On / Tomei lineage) rather than the brand name.
> Composer integration should not attempt to disambiguate UK
> versus Japan from chain context.

The fields below are retained as research notes for the future
model-level entries and **must not be surfaced by the E-5B
composer**. They are kept in this document so that the future
disambiguation work has a starting point.

- **matchTokens:** `['audio note']` — *cannot disambiguate UK vs Japan from chain name alone; this token set must NOT be used for E-5B identity prose*
- **priority:** `audiophile-identity` (*deferred — do not implement*) • **confidence:** *N/A while deferred*
- **houseVoicing (research note, do not surface):** Tube-led, high-efficiency-speaker tradition often associated with tonal density and single-ended triode partnering — with the UK and Japan lineages voiced separately.
- **designPhilosophy (research note, do not surface):** Peter Qvortrup (UK) and the separate Audio Note Japan lineage. SET amplifier focus, high-efficiency speaker partners (AN-E, AN-J, AN-K on the UK side), silver / copper wire emphasis on the UK side.
- **systemBuildingLogic (research note, do not surface):** Within-brand partnering is the canonical approach on both sides; tier ladders span an enormous price range. The UK and Japan lineages must not be collapsed.
- **commonStrengths:** Tonal density; SET intimacy; within-brand voicing coherence — when correctly attributed to UK or Japan.
- **commonTradeoffs:** SPL ceiling on lower-tier SET pairings; single-brand voicing is preference-dependent; UK vs Japan disambiguation is unsolvable from brand name alone.
- **upgradeCautions:** Audio Note UK and Audio Note Japan are separate companies despite the shared name; ownership and service paths differ.
- **bestUsedWhen:** The listener is committed to SET / high-efficiency philosophy and builds within the correctly-identified lineage.
- **avoidOverclaiming:** "unrivalled tone"; "the only SET that does X"; "the Audio Note sound"; "endgame"; "world class"; "the SET reference"; "magic"; "musicality" as an unexplained noun.
- **appliesToRoles:** `['source', 'amplifier', 'speaker']` (*deferred*)
- **exampleModels (mixed across lineages; for research only):** CD 2.1x, Meishu, Soro, AN-E SPe HE, AN-J, AN-K (UK side); Ongaku, Gaku-On, Tomei (Japan side).
- **notes:** **DEFERRED.** The composer must treat `['audio note']` as not present in the data layer for E-5B. Re-introduce only after a future revision splits this into two model-level entries. Until then, an Audio Note component receives no house-voicing prose; the §5 composer's existing facts phrase and trait inference remain the only character source.

#### 19. Leben Hi-Fi
- **matchTokens:** `['leben']`
- **priority:** `audiophile-identity` • **confidence:** `medium`
- **houseVoicing:** Push-pull tube integrated amplifiers using EL84 / 6L6GC / 6CA7 output stages, often associated with mature voicing that avoids euphonic warmth-bloat in many systems.
- **designPhilosophy:** Taku Hyodo lineage (founder, Tokyo). Push-pull tube topology with selected output-stage tubes; the design choices (push-pull rather than SET, mid-power output, EL84/6L6GC/6CA7 selection) are the explanatory mechanism, not the brand's regional provenance.
- **systemBuildingLogic:** CS300 / CS600 / CS600X / CS1000P tier. The CS600 series is the canonical Leben integrated.
- **commonStrengths:** Mature voicing stability; push-pull tube character without warmth-bloat; pairing well with high-efficiency speakers.
- **commonTradeoffs:** Lower-power tube limits demanding loads; boutique-brand service consideration.
- **upgradeCautions:** CS300 → CS600 is a meaningful step in headroom and authority.
- **bestUsedWhen:** A high-efficiency loudspeaker partner with moderate room scale benefits from push-pull tube tonal density.
- **avoidOverclaiming:** "the best Japanese tube"; "audiophile underground secret"; "the Leben truth"; "endgame"; "world class"; "the only push-pull that…"; "magic"; "musicality" as an unexplained noun.
- **appliesToRoles:** `['amplifier']`
- **exampleModels:** CS300, CS600X, CS1000P, RS28CX (preamp).
- **notes:** Phase K reference uses Leben CS600X. Boutique service network is limited outside Japan; ownership consideration on parts availability.

#### 20. Shindo Laboratory — **DEFERRED FROM E-5B**

> **Status: DEFERRED.** This entry is excluded from the initial
> Phase E-5B implementation set.
>
> **Rationale.** Much of Shindo's identity in English-language
> editorial coverage is disproportionately influenced by a small
> number of reviewers — notably Art Dudley's long-running
> Stereophile coverage — rather than the multi-source
> editorial consensus applied to entries like Naim, Quad, Pass,
> Wilson, or Klipsch Heritage. The brand's surrounding
> vocabulary ("tone," "musicality," "magic," "cult,"
> "endgame") is also more folklore-laden than the editorial
> discipline of this document can safely surface, even with a
> strong deny-list.
>
> Shindo does not currently meet the multi-source confidence
> threshold applied elsewhere. Deferring is the safe default;
> downgrading to `low` confidence and suppressing identity
> rendering would achieve the same outcome but would leave the
> entry visible to future maintainers as if it were ready for
> surfacing.

The fields below are retained as research notes for any future
revision and **must not be surfaced by the E-5B composer**.

- **matchTokens:** `['shindo']` *(deferred — must NOT be used for E-5B identity prose)*
- **priority:** `audiophile-identity` (*deferred — do not implement*) • **confidence:** *N/A while deferred*
- **houseVoicing (research note, do not surface):** All-tube, vintage-tube-focused designs often associated with tonal density and dynamic restraint at moderate volumes — with strong caveats about single-reviewer foundation.
- **designPhilosophy (research note, do not surface):** Ken Shindo lineage (continued by Takashi Shindo). Vintage-tube focus, often NOS components, low-power SET and push-pull tube designs.
- **systemBuildingLogic (research note, do not surface):** Shindo amplifiers tend to partner with high-efficiency loudspeakers (the Shindo + DeVore Orangutan pairing is a frequently-cited example). Within-brand source partnership is also common.
- **commonStrengths:** Tonal density; vintage-tube character; long editorial history of within-brand system building.
- **commonTradeoffs:** SPL ceiling on SET pairings; limited service network outside specialist dealers; long-term ownership depends on vintage-tube supply; single-reviewer-foundation risk in English-language coverage.
- **upgradeCautions:** Discontinued Shindo models (Aurieges, Monbrison, Cortese, Haut-Brion) have very limited replacement and repair paths.
- **bestUsedWhen:** A high-efficiency loudspeaker is in place and the listener is comfortable with vintage-tube ownership trade-offs.
- **avoidOverclaiming:** "unmatched tone"; "unsurpassed musicality"; "Shindo magic"; "cult"; "endgame"; "world class"; "the only SET that does X"; "musicality" as an unexplained noun; "the Shindo sound" as a self-evident referent.
- **appliesToRoles:** `['amplifier']` (*deferred*)
- **exampleModels:** Aurieges-L, Cortese, Monbrison, Haut-Brion.
- **notes:** **DEFERRED.** Single-reviewer-foundation in English-language editorial coverage falls below the multi-source confidence threshold applied to other entries. The composer must treat `['shindo']` as not present in the data layer for E-5B. A Shindo component receives no house-voicing prose; the §5 composer's existing facts phrase and trait inference remain the only character source. A future revision could re-introduce the entry after additional independent editorial sources are surveyed.

#### 21. Hegel Music Systems
- **matchTokens:** `['hegel']`
- **priority:** `audiophile-identity` • **confidence:** `medium`
- **houseVoicing:** Norwegian-designed Class-AB integrated amplifiers with characteristic SoundEngine feedback architecture; controlled, neutral presentation.
- **designPhilosophy:** Bent Holter (founder). SoundEngine is Hegel's proprietary feedback architecture; their Class-AB integrateds emphasize transient grip without warmth coloration.
- **systemBuildingLogic:** H95 / H120 / H190 / H390 / H600 tier ladder. The H190 is a longstanding mid-tier reference.
- **commonStrengths:** Transient grip; neutral voicing; long-term reliability.
- **commonTradeoffs:** Solid-state register not preferred by every listener; aesthetic / fascia design is utilitarian.
- **upgradeCautions:** H120 → H190 → H390 → H600 — each step adds power and resolution without changing the SoundEngine character.
- **bestUsedWhen:** A well-matched modern loudspeaker benefits from neutral Class-AB grip and broad streaming connectivity.
- **avoidOverclaiming:** "the best integrated"; "the Norwegian sound"; "Hegel quiet"; "endgame"; "world class"; "the only Class-AB that…"; "magic"; "best in class".
- **appliesToRoles:** `['amplifier']`
- **exampleModels:** H120, H190, H390, H600.
- **notes:** SoundEngine is a Hegel trademark architecture and safe to reference as a brand-specific feedback approach (not as an objective superiority claim).

#### 22. Luxman
- **matchTokens:** `['luxman']`
- **priority:** `audiophile-identity` • **confidence:** `medium`
- **houseVoicing:** High-bias Class-AB integrated amplifier designs with substantial power supplies and large output stages, often associated with tonal richness and dynamic ease at moderate volumes.
- **designPhilosophy:** Luxman Corporation lineage (Yokohama, Japan). High-bias Class-AB topology with conservative bias points and oversized power supplies; the tube models (LX series) use push-pull triode designs and the solid-state (L-series) lineage coexists with separate voicing targets.
- **systemBuildingLogic:** L-505 / L-509X / L-595A SE solid-state integrated ladder; LX-380 / LX-1000 valve integrated tier. The L-509X has historically anchored the flagship reference.
- **commonStrengths:** Tonal richness; dynamic ease; long-cycle ownership in many systems.
- **commonTradeoffs:** Weight and chassis scale; heat from high-bias designs.
- **upgradeCautions:** L-509X → L-595A SE is a substantial step in price; the LX tube models are a voicing choice rather than a hierarchy step from the SS line.
- **bestUsedWhen:** A loudspeaker partner benefits from Class-AB headroom paired with the brand's tonal character.
- **avoidOverclaiming:** "the most musical"; "the Japanese sound"; "Luxman warmth"; "endgame"; "world class"; "the only high-bias Class-AB that…"; "magic"; "musicality" as an unexplained noun.
- **appliesToRoles:** `['amplifier']`
- **exampleModels:** L-509X, L-595A SE, LX-380, LX-1000.
- **notes:** Distinguish the L-series (solid-state) from the LX-series (tube) — they are different voicings, not a tier ladder.

#### 23. Rega
- **matchTokens:** `['rega']`
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** A cross-component design — turntables, electronics, and loudspeakers developed by the same engineering team — that tends to produce ecosystem-level compatibility and a rhythmically engaged presentation when systems are built largely within the brand.
- **designPhilosophy:** Roy Gandy lineage (Essex, UK). The cross-component design philosophy is the engineering choice: turntables, electronics, and loudspeakers share a single team's voicing target and within-brand cartridge / tonearm / speaker pairings are tested as full systems before release.
- **systemBuildingLogic:** Planar 1 → 2 → 3 → 6 → 8 → 10 vinyl ladder; Brio / Aethos / Osiris electronics ladder; RX speakers. Within-brand partnering tends to surface ecosystem-level compatibility (matched gain stages, recommended cartridges, intentional voicing alignment) that cross-brand substitution typically dilutes.
- **commonStrengths:** Ecosystem-level compatibility from the cross-component design; rhythmic engagement when systems are built within the brand; long-cycle ownership.
- **commonTradeoffs:** Single-brand voicing dependence; Rega character is preference-dependent.
- **upgradeCautions:** Planar tier steps are meaningful; cross-brand cartridge changes the foundation.
- **bestUsedWhen:** The owner values brand-coherent voicing and is committed to building within the Rega ecosystem.
- **avoidOverclaiming:** "the rhythm leader"; "unbeatable PRaT" (PRaT belongs to Naim editorial vocabulary, not Rega); "the Rega truth"; "endgame"; "world class"; "the only brand-coherent system"; "magic"; "musicality" as an unexplained noun.
- **appliesToRoles:** `['source', 'amplifier', 'speaker']`
- **exampleModels:** Planar 6, Planar 10, Aethos, Aria Mk3, Brio.
- **notes:** Rega ecosystem synergy is editorially safe to reference. Do not collapse Rega "rhythm" into Naim's PRaT vocabulary — they are different editorial traditions and should not borrow each other's house terminology.

#### 24. KEF
- **matchTokens:** `['kef']`
- **priority:** `mixed` • **confidence:** `medium`
- **houseVoicing:** Uni-Q point-source coaxial driver — a concentric tweeter-in-midbass topology that tends to widen the off-axis listening window — carried across the modern lineup; the driver geometry produces a consistent imaging behavior, but voicing varies meaningfully by tier and brand-level claims should be scoped to the tier in question.
- **designPhilosophy:** Uni-Q driver: concentric tweeter-in-midbass for shared acoustic centre and broad dispersion. The same Uni-Q architecture appears across Q-series, R-series, Reference and Blade, but cabinet design, crossover topology, and voicing targets differ enough that the tiers are not interchangeable identities.
- **systemBuildingLogic:** Q-series (entry, commercial-tier presentation) → R-series (mid) → Reference → Blade and LS-series active wireless ladder; identity prose should be restricted to R-series and above. The Q-series is positioned and voiced for a different listener.
- **commonStrengths:** Point-source imaging from the Uni-Q geometry; broad off-axis dispersion; engineering consistency at the architecture level.
- **commonTradeoffs:** Q-series and R-series are mid-tier and not destination-class; LS50 series is preference-polarizing; brand-level claims about voicing flatten meaningful tier differences.
- **upgradeCautions:** Q-series → R-series → Reference / Blade are meaningfully different tiers.
- **bestUsedWhen:** A modern listening style favors Uni-Q point-source imaging; system tier matches speaker tier.
- **avoidOverclaiming:** "the best coaxial"; "flat measurement reference"; "the KEF sound"; "endgame"; "world class"; "the only Uni-Q"; "magic"; "giant killer" (a phrase historically attached to LS50 reviews).
- **appliesToRoles:** `['speaker']`
- **exampleModels:** LS50 Meta, LS60 Wireless, R3 Meta, Reference 3 Meta, Blade Two Meta.
- **notes:** KEF spans a wide range from budget Q-series to flagship Blade. Brand-level destination protection would over-protect the Q-series; entry models are not destination-class. The `mixed` priority signals "audiophile-identity at higher tiers, commercial at entry tiers." The composer should not surface house voicing on Q-series chains; restrict identity prose to R-series and above.

#### 25. Focal
- **matchTokens:** `['focal']`
- **priority:** `mixed` • **confidence:** `medium`
- **houseVoicing:** Beryllium-tweeter top-end extension in higher tiers (Sopra and above), with the inverted-dome midrange as the brand's distinctive driver lineage; tier voicings differ meaningfully and brand-level claims should be scoped to Sopra and above.
- **designPhilosophy:** Saint-Étienne lineage. Beryllium tweeter in higher tiers; aluminum/magnesium dome in mid-tier; W-cone and Flax-cone midbass options. The driver architecture is the durable explanatory mechanism; tier voicings differ enough that one description cannot cover the line.
- **systemBuildingLogic:** Chora / Aria / Sopra / Utopia tier ladder; Maestro Utopia / Stella Utopia / Grande Utopia EM Evo flagships. Identity prose should be scoped to Sopra and above; Chora and entry Aria are positioned for a different listener.
- **commonStrengths:** Top-end extension from the beryllium tweeter (Sopra and above); distinctive inverted-dome midrange lineage; wide tier coverage from entry to statement.
- **commonTradeoffs:** Beryllium top-end is preference-dependent; tier voicings vary meaningfully across Chora → Utopia and brand-level claims flatten that variation.
- **upgradeCautions:** Chora / Aria → Sopra / Utopia is a substantial scale step. Focal headphone (Utopia / Clear / Bathys) is a separate lineage.
- **bestUsedWhen:** A modern system favors top-end extension and the listener prefers beryllium character.
- **avoidOverclaiming:** "the most resolving tweeter"; "the French sound"; "beryllium leader"; "endgame"; "world class"; "the only beryllium tweeter"; "magic"; "best in class".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** Aria 906, Sopra No. 2, Utopia III, Utopia M Maestro, Grande Utopia EM Evo.
- **notes:** Focal Pro (studio) is a separate division; mass-market Chora is not destination-class. The composer should restrict identity prose to Sopra and above; Chora and entry Aria tiers behave as `commercial` for this purpose.

### Commercial-priority markers (6 — structural minimums only)

These entries demonstrate the schema accommodates commerce-relevant
brands while explicitly suppressing identity-prose generation. The
fields `houseVoicing` / `designPhilosophy` / `systemBuildingLogic`
are intentionally omitted; the composer should refuse to emit any
identity sentence when `priority === 'commercial'`.

#### 26. WiiM
- **matchTokens:** `['wiim']`
- **priority:** `commercial` • **confidence:** `low`
- **commonStrengths:** Affordable streaming entry; Roon Ready / AirPlay 2 compatibility.
- **commonTradeoffs:** Built-in DAC limits upgrade leverage; identity is functional rather than voicing-led.
- **avoidOverclaiming:** Any house-voicing claim; "punching above its price"; "the streamer king".
- **appliesToRoles:** `['source']`
- **exampleModels:** WiiM Mini, WiiM Pro, WiiM Pro Plus, WiiM Ultra.
- **notes:** Use as functional category descriptor only. Do NOT generate house-voicing prose.

#### 27. Eversolo
- **matchTokens:** `['eversolo']`
- **priority:** `commercial` • **confidence:** `low`
- **commonStrengths:** Affordable streaming entry; touch-screen front panel; broad protocol support.
- **commonTradeoffs:** Identity is functional rather than voicing-led.
- **avoidOverclaiming:** Any house-voicing claim.
- **appliesToRoles:** `['source']`
- **exampleModels:** DMP-A6, DMP-A8.
- **notes:** Use as functional category descriptor only.

#### 28. Bluesound
- **matchTokens:** `['bluesound']`
- **priority:** `commercial` • **confidence:** `low`
- **commonStrengths:** BluOS streaming ecosystem; broad protocol support.
- **commonTradeoffs:** Identity is platform-defined rather than voicing-defined.
- **avoidOverclaiming:** Any house-voicing claim.
- **appliesToRoles:** `['source']`
- **exampleModels:** Node, Pulse, Powernode.
- **notes:** Use as functional category descriptor only.

#### 29. Schiit Audio
- **matchTokens:** `['schiit']`
- **priority:** `commercial` • **confidence:** `low`
- **commonStrengths:** Affordable modular stack; iteratively upgradable; broad headphone product range.
- **commonTradeoffs:** House voicing varies substantially by product (Magni, Bifrost, Yggdrasil all read differently); brand-level identity claim is weak.
- **avoidOverclaiming:** Any singular house-voicing claim.
- **appliesToRoles:** `['source', 'amplifier']`
- **exampleModels:** Modi, Bifrost, Yggdrasil, Magni, Magnius, Asgard, Lyr.
- **notes:** Use as functional category descriptor only. Yggdrasil specifically may warrant a per-model entry in a future revision.

#### 30. iFi Audio
- **matchTokens:** `['ifi']`
- **priority:** `commercial` • **confidence:** `low`
- **commonStrengths:** Wide product range; budget-to-mid; XBass / 3D filtering features.
- **commonTradeoffs:** Identity is feature-led rather than voicing-led.
- **avoidOverclaiming:** Any house-voicing claim. Pro iCAN may warrant per-model treatment in a future revision.
- **appliesToRoles:** `['source', 'amplifier']`
- **exampleModels:** Zen DAC, Zen Phono, Pro iCAN Signature.
- **notes:** Use as functional category descriptor only.

#### 31. Topping
- **matchTokens:** `['topping']`
- **priority:** `commercial` • **confidence:** `low`
- **commonStrengths:** Affordable measurement-led DAC / amp; rapidly iterating product cycle.
- **commonTradeoffs:** Identity is measurement-led rather than voicing-led.
- **avoidOverclaiming:** Any house-voicing claim; "measurement reference".
- **appliesToRoles:** `['source', 'amplifier']`
- **exampleModels:** D50s, D90, A90, LA90, LA90D.
- **notes:** Use as functional category descriptor only.

---

## 4. Brands Included and Why

| Brand | Reason for inclusion |
|---|---|
| Naim, Linn, Rega | Strong UK identity brands; appear in real-world validation fixtures (Naim + LS3/5a, Linn Klimax, Rega ecosystem); brand-coherence claims are widely-cited. |
| Pass Labs | Appears in multiple validation fixtures (XA25, INT-60, XP-27, XA200.8); Nelson Pass design lineage is widely-cited. |
| Quad (ESL line) | Real-world Quad ESL-57 fixture exposed the most pointed identity-blindness gap of the validation. Heritage tube + electrostatic is Peter Walker's editorial signature. |
| Tannoy, Klipsch Heritage, JBL Studio Monitor / Synthesis | Heritage horn / dual-concentric architectures; appear in validation; each has distinct house identity. |
| McIntosh | Validation fixture used MA12000; autoformer / unity-coupled output is editorially-cited. |
| Audio Research, dCS, Chord Electronics | Reference-tier electronics; appear in statement-class validation fixtures; each has well-documented design philosophy. |
| Harbeth, Spendor | BBC heritage line; widely-cited identity; appear in validation. |
| Wilson Audio, Magico, YG Acoustics | Statement-class US loudspeakers; brand-level destination already in `DESTINATION_SPEAKER_BRANDS`; this adds voicing depth. |
| DeVore | Phase K reference uses O/96; brand identity is well-defined and Stereophile-grounded. |
| Audio Note, Leben, Shindo | Tube + high-efficiency editorial tradition; appear in validation; each has distinct lineage. |
| Hegel, Luxman | Modern integrated amplifier identity; appear in validation. |
| KEF, Focal | `mixed` priority — high-tier products (Reference / Blade; Sopra / Utopia) have identity; entry products do not. Including with explicit `priority: 'mixed'` documents this. |
| WiiM, Eversolo, Bluesound, Schiit, iFi, Topping | Commercial-only entries; structural placeholders demonstrating the schema can hold them without generating identity prose. |

## 5. Brands Deferred and Why

| Brand | Reason for deferral |
|---|---|
| **SMSL, Cambridge Audio, SVS** | Same category as Topping / Schiit; the 6 commercial entries above are sufficient to demonstrate the structure. Can be added in a follow-on if needed for commerce-side completeness. |
| **Marantz, Yamaha, NAD, Denon** | Mass-market home electronics; each is `mixed` at best, but their identity is fragmented across vintage / modern / multi-channel / 2-channel lines. Deferred until the composer integration is clearer about how `mixed` is presented. |
| **Boenicke, Borresen, Raidho, Marten, Verity Audio, Rockport, Stenheim, TAD** | Already covered as destination via brand-level allowlist in Phase D-1; voicing depth is desirable but not blocking. Add in a later revision once Phase E-5B is stable. |
| **Vandersteen, ATC** | Already covered by Phase E-4 model patterns; voicing depth desirable but defer. Vandersteen's time-and-phase ethos and ATC's pro-monitor heritage would each be a single, well-justified entry. |
| **Sonus Faber** | Brand-level destination already in `DESTINATION_SPEAKER_BRANDS`; voicing-depth entry is desirable (lute lineage, wood cabinet, Italian craftsmanship) but defer to keep first draft narrow. |
| **B&W, Bowers & Wilkins** | Famously polarizing; "mixed" at best (700 series vs. 800 Diamond vs. Nautilus). Defer until the `mixed` presentation pattern is established. |
| **Audio Note (UK vs Japan distinction)** | Included as one entry with explicit `notes:` warning; full sub-brand separation deferred (requires data-model decision about how to thread brandFamily through composers). |
| **Boutique amp builders (Atma-Sphere, Jadis, VAC, Ayon, Lamm, etc.)** | Each is a single iconic identity but the cardinality is high. Defer until validation surfaces them. |
| **Vintage / heritage Quad (non-ESL), Spendor (BC1), KEF (LS3/5a)** | Vintage products outside the artifact's typical advisory scope. |

---

## 6. Risk Analysis

| Risk | Severity | Mitigation |
|---|---|---|
| **Overclaim / hype leak.** A composer wired to surface `houseVoicing` could emit "the best of all worlds" or similar marketing language even if the source data is restrained. | **High** | `avoidOverclaiming` list per entry; composer must run an explicit substring deny-check before output. Editorial review of each first-draft entry before E-5B. |
| **Identity contamination across split-tier brands.** Klipsch Heritage identity transferring to Klipsch RP-600M would be a trust failure. | **High** | `matchTokens` is intentionally narrowed (`klipsch heresy` not `klipsch`); Phase E-4 already proves this gate works for destination protection; same gate logic applies to voicing. |
| **Commerce contamination.** WiiM / Eversolo / Bluesound presence in catalog could leak into identity prose if `priority` filtering is forgotten. | **High** | Composer must hard-gate on `priority === 'commercial'` → emit nothing identity-related. Separate test suite per priority value before E-5B ships. |
| **Stale identity claims.** Brands change ownership, voicing direction, and reference models over time. Audio Research changed hands in 2024; ARC voicing under new ownership is not yet established. | **Medium** | `notes` field flags ownership / lineage changes; `confidence: medium/low` reduces composer assertion strength; annual editorial review pass scheduled. |
| **Brand-conflict overlap.** A chain with both Naim and Linn could surface PRaT (Naim) and source-first (Linn) claims that read as competing rather than complementary. | **Medium** | Per-component identity selection (use the brand for THAT component only); composer should emit at most one identity sentence per §5 card. |
| **Devoted-audience overclaim.** Shindo and Audio Note especially have devoted editorial audiences; "magic" / "musicality" / "the only" phrasing must be suppressed. | **Medium** | `avoidOverclaiming` lists for Shindo, Audio Note, Quad ESL explicitly include "magic" / "unrivalled" / "the only" / "musicality" as an unexplained noun / "cult." |
| **Tier-collapse.** Treating "KEF" as if Q-series and Blade share the same identity. | **Medium** | `priority: 'mixed'` documented; per-model granularity may be needed in E-5B. |
| **PRaT vocabulary collision.** Naim's PRaT is widely-cited; Rega owners sometimes use "PRaT" too. The composer must not transfer Naim's identity to Rega. | **Low** | Rega's `avoidOverclaiming` explicitly includes `"unbeatable PRaT"`; identity sentences would be different per brand. |
| **Hybrid topology misclassification.** McIntosh MA12000 is hybrid tube/SS; presenting it as pure tube would be wrong. | **Low** | McIntosh `notes:` explicitly warns; Phase C facts extraction already distinguishes hybrid from pure tube. |
| **`exampleModels` going stale.** Naim Nait XS 3 is current; if Naim releases Nait XS 4, the field becomes outdated. | **Low** | Examples are illustrative, not authoritative. Field is `readonly` so additions are explicit. |

---

## 7. Proposed Integration Points (E-5B preview, NOT in this commit)

When (if) Phase E-5B implements the composer integration, the natural
integration points are:

### §5 component card (`composeContributionBody`)
**Position:** Insert a third sentence AFTER the existing fact-phrase
sentence, when:
- The component's brand matches a `BrandHouseVoicing` entry
- `priority !== 'commercial'`
- `confidence` is `high` OR (`medium` AND no conflict-signal in chain)
- One of `houseVoicing` / `designPhilosophy` / `systemBuildingLogic`
  is set
- `appliesToRoles` includes the current component's family

**Output shape:** One sentence chosen from `houseVoicing` /
`designPhilosophy` / `systemBuildingLogic` (priority order: voicing
→ philosophy → systemBuilding). The composer should NOT generate;
it should select-and-quote the static string.

### §8 *Why This System Works* (`composeWhyThisSystemWorks` keep-recs branch)
**Position:** When multiple chain components from the same brand are
present (Naim NDX 2 + Supernait 3, Linn LP12 + Klimax DSM + Akubarik,
Rega Planar 10 + Aphelion 2 + Aura + Aethos + RX5), surface a single
brand-ecosystem coherence sentence drawn from `systemBuildingLogic`.

### §10 hierarchy paragraph (`composeUpgradeHierarchy`)
**Position:** When a destination-class speaker matches a brand with
`upgradeCautions`, surface that caution alongside the existing
"treat as a fixed point" sentence.

### Conflict-signal interaction
**Critical:** Phase A B3/B4 hasConflictSignal still gates §8 and §9
on conflict-signaled chains. Brand voicing must NOT bypass that
gate — a conflict-signaled chain still suppresses positive coherence
prose, even when the chain has strong brand identity.

---

## 8. Examples of How §5 Prose Would Improve (illustrative, NOT live)

These are mock-ups of what the composer COULD emit after E-5B
integration. They are presented here for review, not implemented.

### Naim Supernait 3 (today vs. after E-5B):

Today (post-E-2B):
> The Naim Supernait 3 carries the signal between the Naim NDX 2 and the Falcon Acoustics LS3/5a, translating source character into drive for the speakers.

After E-5B (with house voicing):
> The Naim Supernait 3 carries the signal between the Naim NDX 2 and the Falcon Acoustics LS3/5a, translating source character into drive for the speakers. **Within the Naim ecosystem, the all-discrete signal path and external power-supply hierarchy are part of how this integrated is meant to behave in the rest of the system.**

### Quad ESL-57 (today vs. after E-5B):

Today (post-E-4):
> The Quad ESL-57 translates what the Quad II Classic delivers into sound in the room. *(§10 protection: destination-class.)*

After E-5B (with house voicing):
> The Quad ESL-57 translates what the Quad II Classic delivers into sound in the room. **The full-range dipole electrostatic panel, carried forward from Peter Walker's original design, tends to frame the system's voicing around midrange realism and time coherence at the cost of SPL ceiling.**

### Pass Labs XA25 (today vs. after E-5B):

Today (post-C):
> The Pass Labs XA25 carries the signal between the dCS Bartók and the Harbeth 30.2 XD, translating source character into drive for the speakers. Its class-A solid-state design delivers control and resolution without smoothing texture.

After E-5B:
> [same first + facts sentences] **In the Nelson Pass design lineage, the XA series is associated with Class-A current delivery prioritized over topology complexity.**

### dCS Bartók (today vs. after E-5B):

Today (post-C, post-E-4):
> The dCS Bartók establishes the character of the signal feeding the Pass Labs XA25. Its Ring DAC architecture prioritizes timing precision and quietness over conventional ladder or delta-sigma topologies.

After E-5B: **(no change — `houseVoicing` is the same as `facts.topology` source phrase. The composer would detect overlap and suppress the brand sentence to avoid repetition.)**

This last example is important: the composer must detect when a
brand sentence would be redundant with an existing facts sentence and
SKIP it. Otherwise the same idea ("Ring DAC", "timing precision")
would appear twice in consecutive sentences.

---

## 9. Tests That Would Be Needed Before E-5B Implementation

When Phase E-5B is proposed, the following test suites should
accompany the implementation:

### Unit tests on the data layer

- **Schema conformance** — every entry has required fields; `matchTokens` is non-empty; `appliesToRoles` is non-empty for `priority === 'audiophile-identity' | 'mixed'`.
- **Token uniqueness** — no two entries share a `matchTokens` value (lookup collision detection).
- **Confidence calibration** — entries marked `confidence: 'high'` have all three voicing sentences set; entries `medium` have at least one; entries `low` have none.
- **Avoidance vocabulary** — every entry's `avoidOverclaiming` list includes at least one superlative anti-claim.

### Integration tests on the composer

- **`priority === 'commercial'` HARD GATE** — no commerce entry generates identity prose, regardless of confidence.
- **Confidence gating** — `low` never surfaces; `medium` surfaces only without conflict signal; `high` surfaces unless explicitly suppressed.
- **Conflict-signal suppression** — `hasConflictSignal` chains still suppress brand voicing in §8 / §9.
- **PrimaryConstraint suppression** — brand voicing for a primary-constraint component should not contradict the engine's upgrade direction.
- **Anti-overclaim deny-check** — output strings are scanned against the brand's `avoidOverclaiming` list before render; any match causes the sentence to be suppressed.
- **Per-card-one-sentence** — no §5 card emits more than one brand-voicing sentence.
- **Brand-conflict resolution** — chain with Naim + Linn surfaces each brand's voicing on its own component card, not as competing claims in a shared section.
- **Token-collision regression** — Klipsch Heritage identity does NOT appear on a chain with Klipsch RP-600M; same gate as Phase E-4.
- **Phase K regression** — Pontus II / Leben / DeVore card prose unchanged for `confidence: 'low'` brands; for `medium`+ brands, the new sentence appears as the documented third sentence.

### Per-fixture acceptance

- 28-fixture real-world re-render audited for: per-card prose still makes sense; no marketing language leaks; no overclaim survives the deny-check; statement-class chains (Wilson Alexx, Magico M3, YG Hailey) now read with audible identity awareness.

---

## 10. Recommendation

**Proceed to Phase E-5B implementation, but with an editorial review of this draft data file BEFORE any composer changes.**

The reasoning:

1. **The data design is structurally sound.** The schema accommodates the editorial discipline the user spec asked for (separation between identity / commerce / destination / catalog), and the first-draft entries demonstrate that restrained language is achievable without losing the identity-awareness lift.

2. **The integration approach is small.** Phase E-5B is a single optional sentence per §5 card, with hard gates on priority + confidence + conflict signals. The composer change is bounded; the risk envelope is the data, not the code.

3. **The risk is concentrated in the data, not the code.** The deny-list + confidence-gating + per-card-one-sentence rules together make the composer-side risk low. The remaining risk — overclaim / contamination / staleness — is editorial, and editorial review of this draft document is the correct mitigation.

4. **The validation fixture pool is ready.** Phase K, 36-fixture, and 28-fixture pools already exist; an E-5B implementation can re-run all three and verify per-brand prose improvements without new fixture work.

**Suggested editorial review process before E-5B:**

- Surface this document to a domain reviewer (or the user) for line-by-line review of each entry's `houseVoicing`, `designPhilosophy`, `systemBuildingLogic`, `avoidOverclaiming`.
- Specifically flag the `medium` and `low` confidence entries for whether they justify any voicing claim at all.
- Confirm: every `avoidOverclaiming` list is sufficient to block the obvious failure modes (superlatives, "the only", "magic", "best in class").
- Confirm: the 6 commercial entries do not accidentally enable identity-prose generation.

**Do not commit composer wiring** until the above editorial review is complete and the data file is moved into the canonical TypeScript location (e.g. `apps/web/src/lib/brand-house-voicing.ts`).

---

## 11. Success-Criterion Self-Check

The user's success criterion: at the end of this phase we should be
able to answer five questions. The answers below are this draft
author's own assessment and are NOT independent verification. The
later "Editorial Review Findings" section (§12) supersedes the
self-check on every disagreement.

- **Is the language accurate?** Mostly. Specific claims (PRaT, Ring
  DAC, Uni-Q, autoformer, Dual Concentric, SoundEngine, BilletCore,
  RADIAL, X-Material) are trademark or widely-cited editorial
  vocabulary and are safe to name. Several first-draft sentences were
  rewritten in editorial review for accuracy — see §12 for the list.
  Forward-looking voicing claims about Audio Research (post-2024
  ownership) and Tannoy (current ownership) are not yet established
  and should be treated as historical until validated.
- **Is it restrained?** Mostly, after the editorial pass. The original
  draft contained self-referential phrases ("characteristic McIntosh
  tonal weight," "characteristic Tannoy midrange") that have been
  removed. `avoidOverclaiming` lists were strengthened across the
  board to block "endgame," "world class," "magic," "cult,"
  "musicality" as an unexplained noun, and brand-specific superlatives
  ("the Naim sound," "the Wilson sound," etc.) as self-evident
  referents.
- **Is it useful?** This cannot be answered from the draft alone — it
  depends on whether the composer integration in E-5B preserves the
  restraint discipline encoded here. The risk is that gating logic
  fails open, not that the source data is too aggressive.
- **Does it improve expert credibility?** Plausibly, conditional on
  the editorial review (§12) and on the E-5B implementation gates
  (§13) being respected. The highest-confidence brands (Naim, Linn,
  Pass, Quad, dCS, Wilson, Magico, Tannoy, Klipsch Heritage, JBL
  Synthesis, Harbeth, Spendor, Hegel, DeVore) carry voicing claims
  that experienced owners would recognize as appropriate. The
  `medium`-confidence brands carry more editorial risk and should
  surface less freely.
- **Does it avoid contaminating advisory quality with commerce?** The
  `priority: 'commercial'` hard gate is the right structural answer
  but it has not been tested end-to-end. §13 makes the gate a hard
  precondition for E-5B implementation.

---

## 12. Editorial Review Findings

This section was added in the Phase E-5A editorial review pass. It
records the classification of every brand entry after line-level
review against accuracy, restraint, audiophile credibility,
absence of manufacturer-copy language, commerce-boundary discipline,
overclaim risk, cliché vocabulary, and overgeneralization risk.

The classifications below SUPERSEDE the self-check in §11 wherever
they conflict.

### 12.1 Approved as-is (post-editorial-pass)

These entries were judged accurate and restrained after the editorial
sweep applied minor wording adjustments and strengthened
`avoidOverclaiming` lists (the entries themselves did not require
substantive rewrites of `houseVoicing` / `designPhilosophy` /
`systemBuildingLogic`):

| # | Brand | Confidence | Notes |
|---|---|---|---|
| 13 | Spendor | high | Classic vs D-series split is correctly captured. |
| 14 | Wilson Audio | high | Cabinet damping and X-Material claims are restrained. |
| 19 | Leben | medium | Phase K reference brand; boutique service note appropriate. |
| 21 | Hegel | medium | SoundEngine reference is brand-trademark and safely framed. |
| 23 | Rega | high | Brand-ecosystem framing is appropriate; PRaT collision blocked. |
| 24 | KEF | mixed/medium | `mixed` priority correctly handles Q-tier vs Reference/Blade. |

### 12.2 Approved with edits (this revision)

These entries had problematic language in the first draft. The
editorial pass rewrote phrasing for accuracy and restraint, removed
self-referential constructions, and strengthened `avoidOverclaiming`
lists:

| # | Brand | Edit summary |
|---|---|---|
| 1 | Naim | Removed "canonical upgrade lever" mechanical phrasing; rewrote systemBuildingLogic to use "system" not "chain"; expanded avoid-list to include "endgame," "world class," and "the only brand that does PRaT." |
| 2 | Linn | Replaced "doctrine" with "design principle"; added "the only source-first brand" to avoid-list. |
| 3 | Pass Labs | Distributed dense claims into restrained phrasing ("often described in terms of"); added "Class-A leader" and "endgame" to avoid-list. |
| 4 | Quad (ESL) | **Fixed "Peter Walker original-designer lineage" awkwardness** — now "Peter Walker's original ESL design" framed historically. Added ESL-57 SPL/load profile note. |
| 5 | Tannoy | Removed self-referential "characteristic Tannoy midrange"; added current ownership-shift note; strengthened avoid-list. |
| 6 | McIntosh | Removed self-referential "characteristic McIntosh tonal weight"; clarified visual identity is not a sonic claim; added "the McIntosh sound" / "best integrated" to avoid-list. |
| 8 | dCS | Hedged "reference-tier" to "high-tier"; removed "destination-class on its own" assertion about Bartók; added "the digital reference" / "measurement leader" to avoid-list. |
| 9 | Chord Electronics | Restrained "characteristic transient sharpness" → "often described in terms of"; expanded avoid-list. |
| 10 | Klipsch Heritage | Strengthened avoid-list with "giant killer," "endgame," "world class"; clarified Heritage vs RP separation in upgradeCautions. |
| 11 | JBL Studio Monitor & Synthesis | Restrained "professional-monitor heritage" framing; expanded avoid-list. |
| 12 | Harbeth | Reframed "BBC LS3/5a tradition" → "BBC-licensee tradition" (Harbeth is a licensee/inheritor, not a BBC entity); strengthened avoid-list. |
| 15 | Magico | Removed "measurement-correct response" (overclaim); hedged measurement framing; expanded avoid-list with "measurement reference," "the only sealed-cabinet leader." |
| 16 | YG Acoustics | **Removed "Every model is reference-class"** (overclaim — Carmel 2 is the entry tier and is not reference-class); added explicit note about tier separation. |
| 17 | DeVore | Rewrote awkward "characteristic warm tube-amp partnering" → "associated with low-to-moderate power tube amplification as its canonical partner"; expanded avoid-list. |
| 20 | Shindo | **Removed "cult" from commonStrengths**; rewrote "editorial cult following" → "long editorial history of within-brand system building"; expanded avoid-list to block "magic" / "cult" / "musicality" / "the Shindo sound." |
| 22 | Luxman | Removed self-referential "characteristic Luxman tonal richness"; expanded avoid-list with "musicality" / "endgame" / "the only high-bias Class-AB." |
| 25 | Focal | Strengthened avoid-list with "endgame" / "magic" / "best in class"; added note restricting identity prose to Sopra and above. |

### 12.3 Downgraded confidence

| # | Brand | From | To | Reason |
|---|---|---|---|---|
| 7 | Audio Research | high | medium | 2024 ownership change makes forward-looking voicing claims uncertain; ARC entry now notes this explicitly and labels current claims as historical. |

### 12.3a Confidence levels explicitly retained after independent review

| # | Brand | Confidence | Why retained |
|---|---|---|---|
| 5 | Tannoy | high *(retained)* | The Design→Behavior explanatory mechanism in the entry is the Dual-Concentric driver geometry and the Prestige / Legacy cabinet alignments, not corporate continuity. `matchTokens` were narrowed to Prestige / Legacy model names so identity transfer to non-Prestige Tannoy products is structurally prevented. The claims would survive a further ownership change without revision. |

### 12.4 Deferred (do NOT include in E-5B initial implementation)

The first two rows are the **structural** deferrals from this
revision pass — they were upgraded to explicit deferrals on the
basis of the independent editorial review and the §1A Brand Layer
Philosophy. The remaining rows are coverage-completeness
deferrals (entries that could later be added without blocking
E-5B).

| Brand / category | Reason |
|---|---|
| **Audio Note (#18) — deferred from E-5B (structural)** | A single brand-level entry for "Audio Note" cannot correctly serve both Audio Note UK and Audio Note Japan, which are separately owned companies with different lineages, model ranges, and voicing targets. Future treatment requires model-level disambiguation (entries keyed to identifiable model families rather than brand name alone), not a confidence-level workaround. The §3 entry is marked DEFERRED and its `houseVoicing` / `designPhilosophy` / `systemBuildingLogic` fields are research notes only. |
| **Shindo Laboratory (#20) — deferred from E-5B (structural)** | Shindo's English-language identity is disproportionately influenced by a small number of reviewers (notably Art Dudley's Stereophile coverage), and the surrounding editorial vocabulary is more folklore-laden than this document's discipline can safely surface. The entry does not currently meet the multi-source confidence threshold applied elsewhere (Naim, Quad, Pass, Wilson, Klipsch Heritage, etc.). Deferring is the safe default; the §3 entry is marked DEFERRED and its `houseVoicing` / `designPhilosophy` / `systemBuildingLogic` fields are research notes only. |
| Audio Research (forward-looking voicing under new ownership) | New-product voicing claims must wait for editorial validation post-2024 ownership change. The entry itself remains active for E-5B with claims framed as historical. |
| Vandersteen, ATC | Already covered by Phase E-4 model patterns; voicing-depth entry deferred from this draft as low-priority. |
| Sonus Faber, Boenicke, Borresen, Raidho, Marten, Verity, Rockport, Stenheim, TAD | Already covered as destination via Phase D-1 brand allowlist; voicing depth desirable but not blocking. |
| Marantz, Yamaha, NAD, Denon | Mass-market identity fragmented across vintage / modern / multi-channel lines; defer until `mixed` presentation pattern is established. |
| B&W / Bowers & Wilkins | Polarizing across 700 / 800 / Nautilus; defer until `mixed` presentation pattern is established. |
| SMSL, Cambridge Audio, SVS | Same category as included commercial markers; the 6 already-included entries are sufficient to demonstrate the boundary. |
| Boutique tube builders (Atma-Sphere, Jadis, VAC, Ayon, Lamm, etc.) | High cardinality; defer until validation surfaces them. |
| Vintage non-ESL Quad, Spendor BC1, KEF LS3/5a (vintage) | Outside the artifact's typical advisory scope. |

### 12.5 Commercial-only (HARD-GATED — must never emit identity prose)

The following 6 entries carry `priority === 'commercial'` and
`confidence === 'low'`. They were re-verified to confirm that:

- `houseVoicing` is unset
- `designPhilosophy` is unset
- `systemBuildingLogic` is unset
- `avoidOverclaiming` includes "Any house-voicing claim" as a literal entry
- `notes` instructs the composer to use the entry as functional category descriptor only

| # | Brand | Verified commercial-only |
|---|---|---|
| 26 | WiiM | Yes |
| 27 | Eversolo | Yes |
| 28 | Bluesound | Yes |
| 29 | Schiit | Yes |
| 30 | iFi | Yes |
| 31 | Topping | Yes |

The boundary holds at the data layer. The composer must enforce it
at the output layer (§13).

### 12.6 Implementation restrictions (apply to ALL entries)

The editorial review pass derived the following restrictions, which
apply uniformly to every audiophile-identity entry regardless of
confidence:

1. **Use "system" not "chain"** in any output sentence, unless the
   sentence specifically refers to the literal signal-path order.
2. **Prefer restrained hedging vocabulary**: "often," "tends to,"
   "is associated with," "in many systems," "when used in the right
   context," "its value is strongest when…"
3. **Block the editorial-cliché vocabulary** in every entry's
   `avoidOverclaiming` list: "magic," "legendary," "unrivalled,"
   "giant killer," "world class," "best," "endgame," "cult,"
   "giant-slayer," "reference-killer," "musicality" as an unexplained
   noun.
4. **Block brand-name-as-self-evident-referent**: every entry's
   avoid-list includes "the X sound" where X is the brand.
5. **Treat split-tier brands as split**. Klipsch Heritage ≠ Klipsch
   RP. JBL Synthesis ≠ JBL Stage. Spendor Classic ≠ Spendor D.
   Audio Note UK ≠ Audio Note Japan. McIntosh tube ≠ McIntosh hybrid
   ≠ McIntosh autoformer SS. Luxman L ≠ Luxman LX. DeVore Orangutan
   ≠ DeVore Gibbon.
6. **Treat ownership / lineage changes as confidence-limiting**.
   Audio Research (2024) and Tannoy (current ownership) carry
   historical-only claims until new-ownership product validates
   continuity.
7. **Do not import editorial vocabulary across brands**. Naim's PRaT
   stays with Naim; Rega's "rhythm" is its own term.
8. **Do not use affiliate / commerce relevance as advisory
   relevance**. WiiM is in catalog for purchase paths; it is not in
   the identity-prose layer.
9. **Architecture must produce behavior — not the other way
   around.** This is the §1A Brand Layer Philosophy applied at
   the sentence level: any house-voicing sentence that names a
   trait without naming the design choice that produces it is a
   restraint failure, even if it passes every other gate.

### 12.7 Final-pass revisions (after independent editorial review)

A second editorial pass was applied following an independent
review. The revisions below are recorded so future maintainers
can trace why specific entries read the way they do.

| # | Brand | Final-pass change |
|---|---|---|
| 1 | Naim | `houseVoicing` rewritten so the discrete signal path + tightly-coupled PSU **produce** the forward, rhythmically engaged presentation; PRaT moved into editorial-vocabulary framing ("names the listening result rather than explaining it"). `designPhilosophy` clarifies PSU hierarchy is an engineering choice, not a marketing label. `systemBuildingLogic` rewritten to ground within-brand upgrade behavior in the architecture rather than brand loyalty. |
| 5 | Tannoy | `matchTokens` narrowed from `['tannoy']` to Prestige + Legacy + model names so the entry cannot transfer identity to installation / commercial Tannoy products. Confidence retained at `high` with explicit rationale documenting that the explanatory mechanism is the Dual-Concentric architecture, not corporate continuity. `notes` records the confidence rationale. |
| 6 | McIntosh | `systemBuildingLogic` rewritten to ground amplifier-as-anchor system-building behavior in the autoformer-coupled output's load tolerance, not in the brand's presentation preference. The Brand → System Choice inversion is removed. |
| 12 | Harbeth | "BBC-licensee tradition" → "BBC research-derived tradition." `designPhilosophy` and `notes` clarify the relationship is genealogical (founder ex-BBC engineer) rather than a perpetual licensing arrangement. |
| 15 | Magico | "low colouration presentation" replaced with a balanced formulation: sealed-cabinet aluminum-extrusion design is the durable engineering claim; the listening result is preference-dependent (some hear neutrality, others find it analytical). |
| 19 | Leben | National-identity framing ("Japanese boutique tonal balance") replaced with topology-grounded language (push-pull tube topology, EL84 / 6L6GC / 6CA7 selection). |
| 22 | Luxman | "Japanese Class-AB integrated heritage" replaced with topology-grounded "high-bias Class-AB integrated amplifier designs with substantial power supplies and large output stages." |
| 23 | Rega | Self-referential "characteristic Rega rhythmic engagement and tonal density" removed. `houseVoicing` rewritten around the cross-component design philosophy; `systemBuildingLogic` grounds ecosystem-level compatibility in concrete engineering features (matched gain stages, recommended cartridges, intentional voicing alignment). |
| 24 | KEF | "modern voicing across tiers" / "modern voicing consistency" empty phrases removed. Tier differentiation strengthened — identity prose explicitly scoped to R-series and above; brand-level claims flagged as flattening meaningful tier differences. |
| 25 | Focal | "characteristic top-end extension" self-reference removed. Identity prose scoped to Sopra and above. Tier voicings explicitly framed as differing meaningfully across Chora → Utopia. |
| 18 | Audio Note | **Marked DEFERRED FROM E-5B** with structural rationale. Fields converted to research notes. The composer must not read this entry. |
| 20 | Shindo | **Marked DEFERRED FROM E-5B** with multi-source-threshold rationale. Fields converted to research notes. The composer must not read this entry. |

---

## 13. E-5B Implementation Gate

Composer integration in Phase E-5B should proceed ONLY when every
condition below is satisfied. These conditions are preconditions,
not aspirations.

### 13.1 Data-layer preconditions

- [ ] Every entry in the canonical TypeScript file (e.g.
      `apps/web/src/lib/brand-house-voicing.ts`) has been editorially
      reviewed in §12 and reflects the corrections recorded there.
- [ ] No entry uses raw manufacturer-copy language; sentences pass
      the cliché-vocabulary deny-check defined in §12.6.
- [ ] Commercial entries (`priority === 'commercial'`) have
      `houseVoicing`, `designPhilosophy`, and `systemBuildingLogic`
      all unset; their `avoidOverclaiming` lists include "Any
      house-voicing claim."
- [ ] `matchTokens` are narrowed for every split-tier brand (Klipsch
      Heritage, JBL Studio Monitor/Synthesis, Audio Note, Quad ESL,
      Chord Electronics) to prevent identity contamination.
- [ ] Token uniqueness is verified — no two entries share a
      `matchTokens` value.
- [ ] Audio Research is `confidence: 'medium'` (downgraded from
      first-draft `high`).
- [ ] Tannoy is `confidence: 'high'` with `matchTokens` narrowed to
      Prestige / Legacy + model names (per §12.3a, the high
      confidence is anchored to the Dual-Concentric architecture
      and Prestige / Legacy lineage, not to corporate continuity).
- [ ] **Audio Note (#18) is DEFERRED.** The composer must treat the
      `['audio note']` token as not present in the data layer.
      Re-introduction requires model-level disambiguation (a
      separate `audio-note-uk` entry keyed to UK model tokens and
      a separate `audio-note-japan` entry keyed to Japan model
      tokens). Confidence-level workarounds are not acceptable.
- [ ] **Shindo Laboratory (#20) is DEFERRED.** The composer must
      treat the `['shindo']` token as not present in the data
      layer. Re-introduction requires a survey of additional
      independent editorial sources beyond Stereophile's
      Art-Dudley-era coverage. Downgrading to `low` confidence is
      not acceptable as a workaround — the entry must be absent
      from the implementation set.
- [ ] The §1A Brand Layer Philosophy has been adopted as a
      governing principle. Every active entry's `houseVoicing` /
      `designPhilosophy` / `systemBuildingLogic` is reviewable
      against the Architecture → Behavior → Experience rule and
      does not invert that hierarchy.

### 13.2 Composer-layer preconditions (hard gates)

The composer MUST enforce ALL of the following before emitting any
brand-voicing sentence:

- [ ] **Commercial hard-gate.** No identity prose emits when
      `priority === 'commercial'`. This is enforced as an explicit
      early-return, not as a sentence-level filter.
- [ ] **Per-card-one-sentence cap.** No §5 component card emits more
      than one brand-voicing sentence. Even if `houseVoicing`,
      `designPhilosophy`, and `systemBuildingLogic` are all set, the
      composer selects at most one to surface.
- [ ] **No conflict-signal bypass.** When Phase A B3/B4
      `hasConflictSignal` is true on a chain, brand voicing must NOT
      surface in §8 or §9 — the conflict-suppression gate takes
      precedence.
- [ ] **No primary-constraint bypass.** When Phase A B5
      primary-constraint protection-suppression is active for a
      component, brand voicing on that component must NOT contradict
      the engine's upgrade direction. The composer should suppress
      the brand sentence rather than emit competing claims.
- [ ] **Anti-overclaim deny-check.** Before emitting any composed
      sentence that names a brand, the composer runs a substring
      check of the sentence against the entry's `avoidOverclaiming`
      list and the universal §12.6 cliché-vocabulary list. Any match
      causes the sentence to be suppressed (not retried — suppression
      is the safe default).
- [ ] **Redundancy suppression.** When the brand sentence would
      duplicate a substring already present in the §5 card's facts
      sentence (e.g. dCS Bartók — Ring DAC named in both), the
      composer skips the brand sentence.
- [ ] **Confidence gating.** `low` confidence never surfaces.
      `medium` surfaces only when no conflict-signal is present on
      the chain and no primary-constraint suppression applies.
      `high` surfaces unless explicitly suppressed by the above
      gates.
- [ ] **No manufacturer-copy passthrough.** The composer never
      generates novel brand prose. It selects one of the static
      strings (`houseVoicing` | `designPhilosophy` |
      `systemBuildingLogic`) verbatim from the data layer; if all
      three fail the gates, the composer emits nothing.
- [ ] **Split-tier respect.** The composer does not transfer
      Klipsch Heritage identity to Klipsch RP, JBL Synthesis identity
      to JBL Stage, Spendor Classic identity to Spendor D, etc. The
      `matchTokens`-narrowing approach is the structural answer; the
      composer must rely on it.
- [ ] **"System" not "chain".** No brand sentence may include the
      word "chain" except in literal signal-path discussion.
- [ ] **Affiliate isolation.** No brand identity claim is sourced
      from, conditioned on, or co-located with affiliate or
      commercial catalog data. Commerce data and identity data live
      in separate code paths.

### 13.3 Test preconditions

Before any composer wiring is committed, the following tests must
exist and pass:

- [ ] Unit: schema conformance for every entry
- [ ] Unit: token uniqueness across the file
- [ ] Unit: every audiophile-identity entry's `avoidOverclaiming`
      list contains at least the universal §12.6 cliché vocabulary
- [ ] Unit: every commercial entry has `houseVoicing` /
      `designPhilosophy` / `systemBuildingLogic` unset
- [ ] Integration: commercial hard-gate — Topping / WiiM / Bluesound
      chain emits no identity prose
- [ ] Integration: per-card-one-sentence cap — Naim chain with two
      Naim components emits at most one brand sentence per card
- [ ] Integration: conflict-signal suppression — chain with conflict
      signal emits no brand prose in §8/§9 even when the brand has
      `confidence: 'high'`
- [ ] Integration: primary-constraint suppression — brand sentence
      on a primary-constraint component is suppressed
- [ ] Integration: anti-overclaim deny-check — adversarial sentence
      containing "endgame" or "magic" is suppressed
- [ ] Integration: split-tier separation — Klipsch RP-600M chain
      gets no Heritage identity; JBL Stage chain gets no Synthesis
      identity
- [ ] Integration: redundancy suppression — dCS Bartók chain
      surfaces one brand sentence, not two
- [ ] Integration: confidence gating — Audio Note chain (effective
      `low` until disambiguation) emits no identity prose
- [ ] Integration: ARC chain treats voicing claims as historical /
      hedged
- [ ] Regression: Phase K reference chain (Pontus II / Leben /
      DeVore) byte-equivalent under low-confidence path; expected
      change under medium-confidence path is the single documented
      brand sentence per card
- [ ] Per-fixture acceptance: 28-fixture real-world re-render —
      every brand-voicing sentence reads as restrained, accurate,
      and non-contradictory

### 13.4 Editorial-review preconditions

- [ ] §12 above has been read by the project owner or an independent
      audiophile reviewer.
- [ ] At least the 25 audiophile-identity entries have been
      individually reviewed for accuracy by the project owner.
- [ ] Any entry the reviewer flags as "would annoy a knowledgeable
      owner" has been edited or downgraded.
- [ ] The commercial-boundary discipline (§12.5) has been
      independently confirmed.

### 13.5 Promotion discipline

- [ ] Composer wiring lands BEHIND a feature flag, scoped to Preview
      on `version-b` only.
- [ ] No Production promotion until the validation pools (Phase K,
      36-fixture, 28-fixture) all show preserved or improved
      credibility — never just "passes tests."
- [ ] The Brand Authority layer remains untouched; this is an
      additive layer only.

**If any precondition above is unmet, E-5B should not proceed.**

The §1A Brand Layer Philosophy is the operative governing principle
for every active entry. The §12 findings record the editorial
state. The §13 preconditions are the implementation gate. In any
disagreement between this document and the §11 self-check, §1A,
§12, and §13 prevail.

---

*End of Phase E-5A design document, as revised in two editorial
review passes. No code is wired. This file is documentation-only.
The §1A Brand Layer Philosophy, §12 findings, and §13 implementation
gate are the operative conditions for E-5B and SUPERSEDE the §11
self-check on any disagreement.*

*Post-final-pass implementation set: 23 active audiophile-identity
entries + 2 explicit deferrals (Audio Note, Shindo) + 6 commercial
markers. Audio Research is the only confidence downgrade
(high → medium); Tannoy is the only retained `high` carrying an
explicit Design→Behavior justification documented at §12.3a.*
