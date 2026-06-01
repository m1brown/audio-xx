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

## 3. First-Draft Brand Entries (25 audiophile-identity + 6 commercial markers)

The full draft is reproduced verbatim in this document so it can be
reviewed without consulting source. The layout below mirrors what a
future `.ts` data file would contain; sentence lengths, claim
restraint, and `avoidOverclaiming` lists are the editorial substance
of this design pass.

### High-priority audiophile-identity brands (25)

#### 1. Naim Audio
- **matchTokens:** `['naim']`
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** Forward, rhythmically driven presentation often summarized in the editorial vocabulary as PRaT (Pace, Rhythm, and Timing).
- **designPhilosophy:** All-discrete signal path; power-supply design is treated as a primary determinant of sound, with outboard PSUs offered as a within-brand upgrade path on many models.
- **systemBuildingLogic:** Within the Naim ecosystem, upgrades tend to run through external power supplies and tier-step electronics rather than cross-brand substitution.
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
- **matchTokens:** `['tannoy']`
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** Dual-Concentric coaxial driver presentation, often described in terms of point-source imaging and a broad listening window.
- **designPhilosophy:** Heritage Dual-Concentric driver design with an HF compression driver loaded behind a low-frequency driver. Prestige line uses 12-inch and 15-inch dual-concentrics.
- **systemBuildingLogic:** Tannoy Prestige loudspeakers tend to function as system anchors; the Dual-Concentric driver shapes room placement and amplifier choices.
- **commonStrengths:** Point-source imaging; broad listening window; dynamic ease from large drivers in suitable rooms.
- **commonTradeoffs:** Cabinet size for full Prestige models; driver-coherence character is preference-dependent.
- **upgradeCautions:** Within the Prestige line, driver size (10 vs 12 vs 15 inch) shapes scale and room match more than electronics changes.
- **bestUsedWhen:** A large room benefits from the dynamic ease of 12- or 15-inch dual-concentric drivers.
- **avoidOverclaiming:** "unrivalled coherence"; "the Tannoy sound"; "the only true coaxial"; "endgame"; "world class"; "magic".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** Canterbury GR, Westminster Royal GR, Kensington, Turnberry, Cheviot, Arden, Eaton.
- **notes:** Commercial / installation Tannoy products are not in scope for this entry. Modern Tannoy ownership has shifted; treat the Prestige line as the editorial referent.

#### 6. McIntosh
- **matchTokens:** `['mcintosh']`
- **priority:** `audiophile-identity` • **confidence:** `medium`
- **houseVoicing:** Smooth, full-bodied presentation with broad headroom in many systems.
- **designPhilosophy:** Autoformer output transformers (in many solid-state designs) and unity-coupled circuit (in tube designs). Visual identity (blue meters) is a recognized part of the brand but is not a sonic claim.
- **systemBuildingLogic:** McIntosh integrated amplifiers and the MA / MC pairings often act as the system anchor; partner choice tends to follow the McIntosh presentation rather than the reverse.
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
- **houseVoicing:** BBC-licensee tradition, often described in terms of midrange naturalness and long-listening comfort, with thin-wall cabinet construction characteristic of the line.
- **designPhilosophy:** Alan Shaw lineage. RADIAL polypropylene cone material. Thin-wall MDF cabinet construction inherited from BBC research.
- **systemBuildingLogic:** Harbeth standmounts tend to function as long-term system anchors; Class-A or high-bias Class-AB amplification is the common partner.
- **commonStrengths:** Midrange naturalness; vocal presentation; long-listening comfort; long lifecycle ownership.
- **commonTradeoffs:** Bass extension limited by the BBC-tradition cabinet alignment; proper stands are part of the design.
- **upgradeCautions:** Within Harbeth, the 30.2 XD → 40.2 XD → 40.3 XD steps each materially change scale and room match.
- **bestUsedWhen:** A small-to-medium room favors midrange-led standmounts with a high-bias amplifier.
- **avoidOverclaiming:** "the most natural"; "BBC monitor truth"; "Harbeth honesty"; "endgame"; "world class"; "the only true BBC speaker"; "magic".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** 30.2 XD, SHL5plus XD, Monitor 40.3 XD, P3ESR XD.
- **notes:** BBC tradition is editorially safe when described as licensee/inheritor language rather than as exclusive BBC ownership. RADIAL is Alan Shaw's polymer cone material and is a brand-specific identity feature.

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
- **houseVoicing:** Sealed-cabinet aluminum-extrusion construction associated with a low-colouration presentation, where the cabinet's inertness is part of the design intent.
- **designPhilosophy:** Aluminum-extrusion sealed cabinets, beryllium tweeter in higher tiers, measurement-informed design (without claiming a single objective truth).
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

#### 18. Audio Note (UK & Japan)
- **matchTokens:** `['audio note']` — *cannot disambiguate UK vs Japan from chain name alone*
- **priority:** `audiophile-identity` • **confidence:** `medium` *(downgraded effective ceiling — see notes on UK/Japan disambiguation; the composer should treat this entry as `low` until disambiguation lands)*
- **houseVoicing:** Tube-led, high-efficiency-speaker tradition often associated with tonal density and single-ended triode partnering, with caveats below about UK vs Japan.
- **designPhilosophy:** Peter Qvortrup (UK) and the separate Audio Note Japan lineage. SET amplifier focus, high-efficiency speaker partner (AN-E, AN-J, AN-K), silver / copper wire emphasis.
- **systemBuildingLogic:** Within-brand partnering is the canonical approach; tier ladders span an enormous price range. The UK and Japan lineages should not be collapsed.
- **commonStrengths:** Tonal density; SET intimacy; within-brand voicing coherence.
- **commonTradeoffs:** SPL ceiling on lower-tier SET pairings; single-brand voicing is preference-dependent; UK vs Japan disambiguation is non-trivial.
- **upgradeCautions:** Audio Note UK and Audio Note Japan are separate companies despite the shared name; ownership and service paths differ.
- **bestUsedWhen:** The listener is committed to SET / high-efficiency philosophy and ideally builds within the brand.
- **avoidOverclaiming:** "unrivalled tone"; "the only SET that does X"; "the Audio Note sound"; "endgame"; "world class"; "the SET reference"; "magic"; "musicality" as an unexplained noun.
- **appliesToRoles:** `['source', 'amplifier', 'speaker']`
- **exampleModels:** CD 2.1x, Meishu, Soro, AN-E SPe HE, AN-J, AN-K.
- **notes:** **CRITICAL** distinction: Audio Note UK ≠ Audio Note Japan. Both are legitimate, separately owned, and have different lineages. The artifact should NOT collapse them; until the composer can disambiguate by model token, treat this entry as effectively `low` confidence and prefer not to surface house-voicing prose. Editorial review flagged this as the highest-risk entry in the draft.

#### 19. Leben Hi-Fi
- **matchTokens:** `['leben']`
- **priority:** `audiophile-identity` • **confidence:** `medium`
- **houseVoicing:** Push-pull tube integrated amplifiers with characteristic Japanese boutique tonal balance; mature voicing without warmth-bloat.
- **designPhilosophy:** Taku Hyodo (founder, Tokyo). Push-pull tube designs with EL84 / 6L6GC / 6CA7 output stages.
- **systemBuildingLogic:** CS300 / CS600 / CS600X / CS1000P tier. The CS600 series is the canonical Leben integrated.
- **commonStrengths:** Mature voicing stability; push-pull tube character without warmth-bloat; pairing well with high-efficiency speakers.
- **commonTradeoffs:** Lower-power tube limits demanding loads; boutique-brand service consideration.
- **upgradeCautions:** CS300 → CS600 is a meaningful step in headroom and authority.
- **bestUsedWhen:** A high-efficiency loudspeaker partner with moderate room scale benefits from push-pull tube tonal density.
- **avoidOverclaiming:** "the best Japanese tube"; "audiophile underground secret"; "the Leben truth"; "endgame"; "world class"; "the only push-pull that…"; "magic"; "musicality" as an unexplained noun.
- **appliesToRoles:** `['amplifier']`
- **exampleModels:** CS300, CS600X, CS1000P, RS28CX (preamp).
- **notes:** Phase K reference uses Leben CS600X. Boutique service network is limited outside Japan; ownership consideration on parts availability.

#### 20. Shindo Laboratory
- **matchTokens:** `['shindo']`
- **priority:** `audiophile-identity` • **confidence:** `medium`
- **houseVoicing:** All-tube, vintage-tube-focused designs often associated with tonal density and dynamic restraint at moderate volumes.
- **designPhilosophy:** Ken Shindo lineage (continued by Takashi Shindo). Vintage-tube focus, often NOS components, low-power SET and push-pull tube designs.
- **systemBuildingLogic:** Shindo amplifiers tend to partner with high-efficiency loudspeakers (DeVore Orangutan is a frequently-cited NYC pairing). Within-brand source partnership is also common.
- **commonStrengths:** Tonal density; vintage-tube character; long editorial history of within-brand system building.
- **commonTradeoffs:** SPL ceiling on SET pairings; limited service network outside specialist dealers; long-term ownership depends on vintage-tube supply.
- **upgradeCautions:** Discontinued Shindo models (Aurieges, Monbrison, Cortese, Haut-Brion) have very limited replacement and repair paths.
- **bestUsedWhen:** A high-efficiency loudspeaker is in place and the listener is comfortable with vintage-tube ownership trade-offs.
- **avoidOverclaiming:** "unmatched tone"; "unsurpassed musicality"; "Shindo magic"; "cult"; "endgame"; "world class"; "the only SET that does X"; "musicality" as an unexplained noun; "the Shindo sound" as a self-evident referent.
- **appliesToRoles:** `['amplifier']`
- **exampleModels:** Aurieges-L, Cortese, Monbrison, Haut-Brion.
- **notes:** Shindo has a long editorial following (Art Dudley's Stereophile coverage shaped much of the modern Shindo identity). Restraint is critical to avoid hype framing; do not import "cult," "magic," or "musicality" as an unexplained noun into any output sentence.

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
- **houseVoicing:** Japanese Class-AB integrated heritage with heavy power supplies, often associated with tonal richness and dynamic ease.
- **designPhilosophy:** Luxman Corporation lineage (Yokohama). High-bias Class-AB designs; tube models (LX series) and solid-state (L-series) coexist.
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
- **houseVoicing:** Brand-coherent voicing across vinyl + electronics + loudspeaker — characteristic Rega rhythmic engagement and tonal density.
- **designPhilosophy:** Roy Gandy lineage (Essex, UK). Rega ecosystem is intentionally cross-component voiced for synergy.
- **systemBuildingLogic:** Planar 1 → 2 → 3 → 6 → 8 → 10 vinyl ladder; Brio / Aethos / Osiris electronics ladder; RX speakers. Brand-coherent partnering is the canonical Rega approach.
- **commonStrengths:** Brand-coherent voicing; rhythmic engagement; within-ecosystem synergy.
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
- **houseVoicing:** Uni-Q point-source coaxial driver across modern KEF speakers; characteristic broad imaging window and modern voicing across tiers.
- **designPhilosophy:** Uni-Q driver: concentric tweeter-in-midbass for point-source dispersion. Modern KEF Reference / Blade lineage and entry Q-series share Uni-Q.
- **systemBuildingLogic:** Q-series (entry) → R-series → Reference → Blade and LS-series active wireless ladder.
- **commonStrengths:** Point-source imaging across the lineup; modern voicing consistency; reference-tier credibility via Reference / Blade.
- **commonTradeoffs:** Q-series and R-series are mid-tier; not all KEF speakers are destination-class. LS50 series is preference-polarizing for some listeners.
- **upgradeCautions:** Q-series → R-series → Reference / Blade are meaningfully different tiers.
- **bestUsedWhen:** A modern listening style favors Uni-Q point-source imaging; system tier matches speaker tier.
- **avoidOverclaiming:** "the best coaxial"; "flat measurement reference"; "the KEF sound"; "endgame"; "world class"; "the only Uni-Q"; "magic"; "giant killer" (a phrase historically attached to LS50 reviews).
- **appliesToRoles:** `['speaker']`
- **exampleModels:** LS50 Meta, LS60 Wireless, R3 Meta, Reference 3 Meta, Blade Two Meta.
- **notes:** KEF spans a wide range from budget Q-series to flagship Blade. Brand-level destination protection would over-protect the Q-series; entry models are not destination-class. The `mixed` priority signals "audiophile-identity at higher tiers, commercial at entry tiers." The composer should not surface house voicing on Q-series chains; restrict identity prose to R-series and above.

#### 25. Focal
- **matchTokens:** `['focal']`
- **priority:** `mixed` • **confidence:** `medium`
- **houseVoicing:** Beryllium tweeter (high-end) presentation with characteristic top-end extension; inverted dome heritage.
- **designPhilosophy:** French heritage (Saint-Étienne). Beryllium tweeter in higher tiers; aluminum/magnesium dome in mid-tier; W cone / Flax cone midbass options.
- **systemBuildingLogic:** Chora / Aria / Sopra / Utopia tier ladder; Maestro Utopia / Stella Utopia / Grande Utopia EM Evo flagships.
- **commonStrengths:** Top-end extension via beryllium; brand-coherent voicing direction; wide tier range.
- **commonTradeoffs:** Beryllium top-end is preference-dependent; tier voicings are not identical across Chora → Utopia.
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
| 18 | Audio Note (UK & Japan) | medium | medium (effective `low`) | UK vs Japan disambiguation is not solvable from chain name alone; entry instructs the composer to treat the entry as `low` confidence until a model-token disambiguation is added. Highest-risk entry in the draft. |

### 12.4 Deferred (do NOT include in E-5B initial implementation)

| Brand / category | Reason |
|---|---|
| Audio Research (forward-looking voicing under new ownership) | New-product voicing claims must wait for editorial validation post-2024 ownership change. |
| Audio Note UK vs Japan disambiguated entries | Requires `brandFamily` / model-token disambiguation work before identity prose can be safely surfaced. |
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
- [ ] Audio Note's notes field explicitly states the composer should
      treat it as `low` confidence until UK/Japan disambiguation
      lands.

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

---

*End of Phase E-5A design document, as revised in editorial review.
No code is wired. This file is documentation-only. The §12 findings
and §13 implementation gate are the operative conditions for E-5B
and SUPERSEDE the §11 self-check on any disagreement.*
