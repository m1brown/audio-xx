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
- **houseVoicing:** Forward, rhythmically driven presentation often summarized as PRaT (Pace, Rhythm, and Timing).
- **designPhilosophy:** All-discrete signal path; power-supply quality is treated as a primary determinant of sound, with outboard PSUs as the canonical upgrade lever.
- **systemBuildingLogic:** Upgrades within the Naim ecosystem typically run through external power supplies and tier-step electronics rather than swap-to-another-brand.
- **commonStrengths:** Rhythmic engagement; vocal directness; brand-coherent system building.
- **commonTradeoffs:** Forward presentation that does not suit all material; best results require Naim PSU hierarchy.
- **upgradeCautions:** Mixing Naim with non-Naim partners often loses the PRaT identity.
- **bestUsedWhen:** The owner prioritizes rhythm and timing engagement over warmth or maximal resolution.
- **avoidOverclaiming:** "unrivalled"; "best in class"; "naim sound" as a self-evident referent; "PRaT leader".
- **appliesToRoles:** `['source', 'amplifier']`
- **exampleModels:** NDX 2, XPS DR, Supernait 3, NAP 250, Nait XS 3.
- **notes:** PRaT is widely-recognized editorial vocabulary in Naim coverage and is safe to use. The PSU hierarchy (HiCap → XPS DR → 555PS DR) is a well-documented Naim upgrade convention.

#### 2. Linn Products
- **matchTokens:** `['linn']`
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** Source-first presentation with emphasis on rhythmic precision and timing.
- **designPhilosophy:** Source-first doctrine: in the Linn view, source quality determines what the rest of the system can convey. Heavily software-defined in modern lines (Konfig configuration software, Space Optimisation room correction).
- **systemBuildingLogic:** LP12 (vinyl) or Klimax DSM (digital) function as the brand-tier anchor; the Klimax / Akurate / Selekt tier ladder structures upgrades.
- **commonStrengths:** Source-tier coherence; modular upgrade path within ecosystem; active-speaker integration via Akubarik / Akudorik.
- **commonTradeoffs:** Single-brand voicing dependence; Linn voicing not universally preferred.
- **upgradeCautions:** Mixing Linn sources with non-Linn electronics often weakens the source-first claim.
- **bestUsedWhen:** The owner is committed to a single-brand ecosystem with source-first upgrade priorities.
- **avoidOverclaiming:** "the source of truth"; "unrivalled timing"; "Linn sound" as a self-evident referent.
- **appliesToRoles:** `['source', 'amplifier', 'speaker']`
- **exampleModels:** LP12 Klimax, Klimax DSM, Akubarik, Selekt DSM, Majik.
- **notes:** Source-first is foundational Linn editorial and widely used in Stereophile / Hi-Fi News coverage.

#### 3. Pass Labs
- **matchTokens:** `['pass labs', 'pass laboratories']`
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** Class-A solid-state with emphasis on tonal density, control without smoothing texture, and dynamic ease at moderate volumes.
- **designPhilosophy:** Nelson Pass design lineage: simple topologies, generous Class-A bias, large heatsinks, current delivery prioritized.
- **systemBuildingLogic:** XA / INT / X-series tiers each carry different Class-A bias levels; choice depends on loudspeaker drive demands.
- **commonStrengths:** Tonal density; bass control without thinning; dynamic ease; long-term listenability.
- **commonTradeoffs:** Heat output from Class-A operation; weight / chassis size.
- **upgradeCautions:** XA-series → larger XA-series is the natural step rather than swap to a different topology.
- **bestUsedWhen:** A demanding loudspeaker load benefits from Class-A current delivery, and room ventilation accommodates the heat.
- **avoidOverclaiming:** "warm"; "tube-like"; "the only Class-A that does X"; "Pass sound".
- **appliesToRoles:** `['amplifier']`
- **exampleModels:** XA25, XA60.8, XA200.8, INT-25, INT-60, XP-32, XP-27.
- **notes:** Pass amps are NOT "warm-tube-like" — common owner error to avoid. Nelson Pass also runs FirstWatt (separate brand, kit-friendly designs).

#### 4. Quad (Acoustical Manufacturing)
- **matchTokens:** `['quad esl', 'quad ii']` — *non-ESL Quad excluded by token specificity*
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** Electrostatic-loudspeaker family: midrange realism, point-source coherence, limited SPL ceiling.
- **designPhilosophy:** Acoustical Manufacturing heritage; Peter Walker original-designer lineage in the ESL line. The ESL panel is a full-range dipole electrostatic with characteristic load behavior.
- **systemBuildingLogic:** ESL loudspeakers pair best with specific amplifier types (typically tube or low-power solid-state with care); the ESL is the system anchor.
- **commonStrengths:** Midrange realism; vocal naturalness; time coherence; long-term listenability.
- **commonTradeoffs:** SPL ceiling; room placement is critical for dipole behavior; difficult electrostatic load for some amplifiers.
- **upgradeCautions:** ESL panels are not amplifier-promiscuous; partner choice matters substantially. Modern Quad ESL service / panel availability is an ownership consideration.
- **bestUsedWhen:** The listener prioritizes midrange truth and vocal naturalness over scale, and the room supports dipole loading.
- **avoidOverclaiming:** "the only true electrostatic"; "unbeatable midrange"; "Peter Walker's last word".
- **appliesToRoles:** `['speaker', 'amplifier']` *(amplifier covers Quad II / II-forty tube line)*
- **exampleModels:** ESL-57, ESL-63, ESL-2912, Quad II, Quad II Classic, Quad II-forty.
- **notes:** Non-ESL Quad products (Quad 99, Vena, S-2, etc.) are not destination-tier. `matchTokens` is intentionally narrowed to `quad esl` / `quad ii` to avoid triggering on non-heritage Quads.

#### 5. Tannoy
- **matchTokens:** `['tannoy']`
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** Dual-Concentric coaxial driver presentation: point-source imaging, broad listening window, characteristic Tannoy midrange.
- **designPhilosophy:** Heritage Dual-Concentric driver design with HF compression driver loaded behind a low-frequency driver. Prestige line uses 12-inch and 15-inch dual-concentrics.
- **systemBuildingLogic:** Tannoy Prestige loudspeakers function as system anchors; the Dual-Concentric driver dictates room placement and amplifier requirements.
- **commonStrengths:** Point-source imaging; broad listening window; dynamic ease from large drivers.
- **commonTradeoffs:** Cabinet size for full Prestige models; driver-coherence character is preference-dependent.
- **upgradeCautions:** Within the Prestige line, the driver size (10 vs 12 vs 15 inch) shapes scale and room match more than electronics changes.
- **bestUsedWhen:** A large room benefits from the dynamic ease of 12 or 15-inch dual-concentric drivers.
- **avoidOverclaiming:** "unrivalled coherence"; "tannoy sound"; "the only true coaxial".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** Canterbury GR, Westminster Royal GR, Kensington, Turnberry, Cheviot, Arden, Eaton.
- **notes:** Commercial / installation Tannoy products are not in scope for this entry.

#### 6. McIntosh
- **matchTokens:** `['mcintosh']`
- **priority:** `audiophile-identity` • **confidence:** `medium`
- **houseVoicing:** Smooth, full-bodied presentation with broad headroom; characteristic McIntosh tonal weight at moderate volume.
- **designPhilosophy:** Autoformer output transformers (in many SS designs) and unity-coupled circuit (in tube designs). Visual identity (blue meters) is a strong part of the brand.
- **systemBuildingLogic:** McIntosh integrated amplifiers and their MA / MC pairings are the typical anchor; speakers are usually chosen for the McIntosh weight and presentation rather than the reverse.
- **commonStrengths:** Broad headroom; tonal weight; long-term ownership ecosystem.
- **commonTradeoffs:** Presentation is preference-dependent; weight / physical scale of larger models.
- **upgradeCautions:** Hybrid tube/SS designs (e.g. MA12000) are not pure-tube despite the tube indicator stage.
- **bestUsedWhen:** The owner values broad headroom and is committed to the McIntosh visual / sonic identity.
- **avoidOverclaiming:** "warmest in solid-state"; "unbeatable bass"; "the only autoformer".
- **appliesToRoles:** `['amplifier']`
- **exampleModels:** MC275, MA12000, MA8950, MC462, MC1.25KW.
- **notes:** Hybrid tube+SS designs (MA12000) commonly mistaken for pure-tube; the tube stage is preamp / driver, the output is solid-state with autoformer.

#### 7. Audio Research
- **matchTokens:** `['audio research']`
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** All-tube Reference line: harmonic density without warmth-romanticism, dynamic capability without thinness. LS line is more solid-state-adjacent in voicing.
- **designPhilosophy:** William Z. Johnson lineage. Reference series is all-tube high-power, often with auto-bias. Distinct LS (line stage) and Ref (reference) line voicings.
- **systemBuildingLogic:** Ref series components partner with destination-class loudspeakers (Wilson, Magico, Sonus Faber are common); LS series is the mid-tier all-tube preamplifier with a less imposing chassis.
- **commonStrengths:** Harmonic density; dynamic capability; reference-tier coherence with destination speakers.
- **commonTradeoffs:** Tube life as ownership cost; heat output from large Ref amps.
- **upgradeCautions:** Ref → larger Ref is the natural step within the brand; cross to non-ARC tube architecture changes system identity.
- **bestUsedWhen:** The owner has a destination-class loudspeaker that benefits from tube character without warmth-bloat.
- **avoidOverclaiming:** "warm"; "best of all worlds"; "ARC voice".
- **appliesToRoles:** `['amplifier']`
- **exampleModels:** Ref 6, Ref 6SE, Ref 160M, Ref 80, LS28, Ref Phono 3.
- **notes:** Reference and LS lines are voiced differently — the artifact should not collapse them. ARC was recently sold (2024); ownership / service is a current ownership consideration.

#### 8. dCS
- **matchTokens:** `['dcs']`
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** Reference-tier digital with characteristic timing precision and clean extension; not a "voiced" DAC in the warmth/lean sense.
- **designPhilosophy:** Ring DAC architecture — a discrete FPGA-driven topology distinct from conventional R2R or delta-sigma. Originated in pro audio.
- **systemBuildingLogic:** Vivaldi (reference stack) / Rossini (one-box) / Bartók (compact streaming endpoint) tier ladder. The Bartók is the entry point and is editorially destination-class on its own.
- **commonStrengths:** Timing precision; resolution; low noise floor; reference-tier service / firmware support.
- **commonTradeoffs:** Cost ceiling for Vivaldi APEX; not for listeners who want a euphonic R2R signature.
- **upgradeCautions:** Within dCS, the Vivaldi APEX upgrade is the natural step; cross to R2R brands changes the digital character substantively.
- **bestUsedWhen:** The system is reference-class downstream and the digital source is the limiting factor.
- **avoidOverclaiming:** "the only reference DAC"; "unbeatable"; "transparent" (over-used).
- **appliesToRoles:** `['source']`
- **exampleModels:** Bartók, Rossini, Vivaldi APEX.
- **notes:** Ring DAC is a dCS trademark architecture and safe to name.

#### 9. Chord Electronics
- **matchTokens:** `['chord hugo', 'chord dave', 'chord m scaler', 'chord mojo', 'chord qutest']` — *narrowed to specific Chord Electronics products to avoid collision with "Chord Company" cables*
- **priority:** `audiophile-identity` • **confidence:** `medium`
- **houseVoicing:** FPGA-driven DAC line with characteristic transient sharpness and spatial focus; distinct from R2R and delta-sigma voicings.
- **designPhilosophy:** Rob Watts FPGA designs (Hugo / DAVE / M Scaler / Mojo line). Distinct case design (aluminum-billet chassis).
- **systemBuildingLogic:** Hugo TT2 / DAVE function as the brand-tier anchors; the M Scaler adds upstream taps in the digital domain.
- **commonStrengths:** Transient clarity; spatial focus; distinctive desktop ergonomics.
- **commonTradeoffs:** Preference-dependent voicing; aesthetic / case design is polarizing.
- **upgradeCautions:** Hugo line → DAVE is a substantial price step; M Scaler is the alternative upgrade path.
- **bestUsedWhen:** The owner values transient precision and is comfortable with the Chord case aesthetic.
- **avoidOverclaiming:** "the most resolving"; "measurement leader"; "Rob Watts proves".
- **appliesToRoles:** `['source']`
- **exampleModels:** Hugo TT2, DAVE, M Scaler, Hugo 2, Mojo 2, Qutest.
- **notes:** Chord Company (cables) is a separate entity. `matchTokens` is intentionally narrowed to specific product names to avoid false positives on "Chord cables" / similar.

#### 10. Klipsch Heritage
- **brandFamily:** `'Klipsch'`
- **matchTokens:** `['klipsch heresy', 'klipsch forte', 'klipsch cornwall', 'klipsch la scala', 'klipsch lascala', 'klipschorn', 'klipsch khorn']` — *intentionally NOT 'klipsch' alone*
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** Horn-loaded high-efficiency presentation: dynamic immediacy, broad dynamic range, controlled directivity at the cost of off-axis evenness.
- **designPhilosophy:** Paul W. Klipsch heritage (Hope, Arkansas). Horn loading + high efficiency (~99 dB) → very low amplifier power requirements.
- **systemBuildingLogic:** Heritage loudspeakers pair with low-power tube amplifiers in the canonical Klipsch system. The cabinet is the long-term anchor.
- **commonStrengths:** Dynamic immediacy; pairs naturally with low-power tube amplification; long lifecycle ownership.
- **commonTradeoffs:** Forward presentation that does not suit all material; off-axis response varies more than dome / planar designs.
- **upgradeCautions:** Heritage line is distinct from Klipsch mass-market (RP / R / Reference Premiere) — they share no design philosophy.
- **bestUsedWhen:** A low-power tube amplifier benefits from a high-efficiency partner; the room accommodates the cabinet size.
- **avoidOverclaiming:** "the only horn that does X"; "best in class"; "Paul Klipsch's last word".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** Heresy IV, Forte IV, Cornwall IV, La Scala AL5, Klipschorn AK6.
- **notes:** **CRITICAL** — Klipsch Heritage is sonically and editorially distinct from Klipsch RP / Reference Premiere mass-market. The artifact must not transfer Heritage identity to the RP line. `matchTokens` matches only Heritage model names.

#### 11. JBL Studio Monitor & Synthesis
- **brandFamily:** `'JBL'`
- **matchTokens:** `['jbl 4329', 'jbl 4349', 'jbl 4367', 'jbl 4429', 'jbl k2', 'jbl m2', 'jbl everest', 'jbl dd67000']`
- **priority:** `audiophile-identity` • **confidence:** `medium`
- **houseVoicing:** Professional-monitor heritage: dynamic capability, controlled directivity via large compression-driver horns, broad headroom.
- **designPhilosophy:** Greg Timbers and successors. 4xxx Studio Monitor lineage from professional recording-monitor use. K2/M2/Everest in the Synthesis flagship line.
- **systemBuildingLogic:** 4xxx Studio Monitor functions as system anchor; high-efficiency horn loading favors moderate-power solid-state or hybrid amplification.
- **commonStrengths:** Dynamic capability; broad headroom; pro-monitor lineage credibility.
- **commonTradeoffs:** Cabinet size for larger models; JBL forward presentation is preference-dependent.
- **upgradeCautions:** 4xxx Studio Monitor line is distinct from JBL Stage / Studio mid-tier home — they are not the same lineage.
- **bestUsedWhen:** A large room benefits from horn-loaded dynamic capability; the listener values pro-monitor presentation.
- **avoidOverclaiming:** "the only professional monitor"; "flat reference"; "JBL sound".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** 4429, 4349, 4367, K2 S9900, M2, Project Everest DD67000.
- **notes:** JBL Stage / Studio (5xx, 6xx) and L100 Classic are separate lines with different voicings; intentionally NOT in `matchTokens`.

#### 12. Harbeth
- **matchTokens:** `['harbeth']`
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** BBC LS3/5a tradition: thin-wall cabinet construction, midrange honesty, BBC-tradition vocal naturalness.
- **designPhilosophy:** Alan Shaw lineage. RADIAL polypropylene cone material. Thin-wall MDF cabinet construction inherited from BBC heritage.
- **systemBuildingLogic:** Harbeth standmounts function as long-term system anchors; Class-A or high-bias Class-AB amplification is the typical partner.
- **commonStrengths:** Midrange honesty; vocal naturalness; long-listening comfort; long lifecycle ownership.
- **commonTradeoffs:** Bass extension limited (per BBC heritage); stand-required for proper midrange.
- **upgradeCautions:** Within Harbeth, the 30.2 XD → 40.2 XD → 40.3 XD steps each materially change scale.
- **bestUsedWhen:** A small-to-medium room favors midrange-honest standmounts with a high-bias amplifier.
- **avoidOverclaiming:** "the most natural"; "BBC monitor truth"; "Harbeth honesty".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** 30.2 XD, SHL5plus XD, Monitor 40.3 XD, P3ESR XD.
- **notes:** BBC tradition is editorially safe. RADIAL cone is brand-distinct identity.

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
- **avoidOverclaiming:** "BBC truth"; "British best"; "Spendor sound".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** Classic 2/3, SP100R2, D7.2, D9.2, A4, Classic 1/2.
- **notes:** Distinguish Classic line from D-series — they are not the same voicing.

#### 14. Wilson Audio Specialties
- **matchTokens:** `['wilson audio', 'wilson sasha', 'wilson sabrina', 'wilson alexx', 'wilson watt', 'wamm']`
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** Dynamic-range capability with characteristic cabinet damping; X-Material composite chassis distinct from MDF / aluminum.
- **designPhilosophy:** David Wilson lineage. Time-aligned driver arrangement; cabinet adjustability (modular drivers) on flagship models.
- **systemBuildingLogic:** Sabrina X / Sasha DAW / Alexx V / WAMM Master Chronosonic form a destination ladder; the cabinet is the long-term anchor.
- **commonStrengths:** Dynamic capability; sustained scale; cabinet damping → low coloration.
- **commonTradeoffs:** Room-dependent; cabinet size for upper-tier models; setup-sensitive.
- **upgradeCautions:** Sasha DAW → Alexx V is a substantial scale step; not all rooms support it.
- **bestUsedWhen:** A large room and a destination-tier amplifier benefit from Wilson dynamic range.
- **avoidOverclaiming:** "the only dynamic speaker"; "flat measurement reference"; "Wilson sound".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** Sabrina X, Sasha DAW, Alexx V, WAMM Master Chronosonic.
- **notes:** Wilson Benesch is a separate UK brand (carbon-fibre cabinet).

#### 15. Magico
- **matchTokens:** `['magico']`
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** Sealed-cabinet aluminum-extrusion construction; characteristic low-coloration presentation prioritizing measurement-correct response.
- **designPhilosophy:** Aluminum-extrusion sealed cabinets, beryllium tweeter (in higher tiers), measurement-led design.
- **systemBuildingLogic:** A-series (entry) / S-series / M-series tier ladder. Sealed-cabinet design favors solid-state amplification with strong bass control.
- **commonStrengths:** Cabinet inertness; bass control via sealed alignment; measurement consistency.
- **commonTradeoffs:** Cabinet weight; sealed-cabinet bass extension favors amplification with grip.
- **upgradeCautions:** A1 → A3 → A5 → S3 → M-series each substantially change scale.
- **bestUsedWhen:** Solid-state amplification with strong bass control partners; the room benefits from sealed cabinet bass discipline.
- **avoidOverclaiming:** "the most neutral"; "measurement winner"; "Magico measurement".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** A1, A3, A5, S3, M3, M6.
- **notes:** Sealed-cabinet construction is a Magico identity feature.

#### 16. YG Acoustics
- **matchTokens:** `['yg acoustics', 'yg carmel', 'yg hailey', 'yg sonja', 'yg vantage']`
- **priority:** `audiophile-identity` • **confidence:** `medium`
- **houseVoicing:** Precision-machined aluminum drivers (BilletCore), sealed-cabinet construction, measurement-led voicing with characteristic transient sharpness.
- **designPhilosophy:** Yoav Geva lineage. Precision aluminum driver machining; sealed cabinets. Statement-class US loudspeaker brand.
- **systemBuildingLogic:** Carmel 2 (entry) / Hailey / Sonja / Vantage tier ladder. Every model is reference-class.
- **commonStrengths:** Precision driver behavior; sealed-cabinet bass discipline; measurement consistency.
- **commonTradeoffs:** Preference-dependent transient sharpness; room dependence.
- **upgradeCautions:** Carmel 2 → Hailey is a substantial scale step.
- **bestUsedWhen:** Solid-state amplification with linear measurement; the listener values transient precision.
- **avoidOverclaiming:** "the most precise"; "measurement leader"; "YG sound".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** Carmel 2, Hailey 2.2, Sonja XV, Vantage.
- **notes:** BilletCore driver and sealed cabinet are YG identity features.

#### 17. DeVore Fidelity
- **matchTokens:** `['devore', 'devore fidelity']`
- **priority:** `audiophile-identity` • **confidence:** `high`
- **houseVoicing:** Wide-baffle dynamic loudspeakers with high efficiency; characteristic warm tube-amp partnering for the Orangutan line.
- **designPhilosophy:** John DeVore lineage. New York-based. Orangutan line uses wide-baffle high-efficiency dynamic drivers; Reference line uses different architecture.
- **systemBuildingLogic:** Orangutan O/93, O/96, O/Reference, and the Gibbon line cover a wide range. The Orangutan line specifically pairs canonically with low-to-moderate power tube amplification.
- **commonStrengths:** High efficiency for tube partnering; wide-baffle scale; tonal density.
- **commonTradeoffs:** Wide-baffle imaging is not pinpoint; cabinet width / placement requirements.
- **upgradeCautions:** Orangutan line voicing is distinct from Gibbon — they are not the same lineage.
- **bestUsedWhen:** A low-power tube amplifier benefits from a high-efficiency partner; the listener prefers tonal weight over pinpoint imaging.
- **avoidOverclaiming:** "the warmest"; "reference natural"; "DeVore sound".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** O/93, O/96, O/Reference, Gibbon 88, Gibbon Super 8.
- **notes:** Small NYC-based brand; service / ownership is a relevant ownership consideration.

#### 18. Audio Note (UK & Japan)
- **matchTokens:** `['audio note']` — *cannot disambiguate UK vs Japan from chain name alone*
- **priority:** `audiophile-identity` • **confidence:** `medium`
- **houseVoicing:** Tube-led, high-efficiency-speaker tradition with emphasis on tonal density and single-ended triode partnering.
- **designPhilosophy:** Peter Qvortrup (UK) and the separate Audio Note Japan lineage. SET amplifier focus, high-efficiency speaker partner (AN-E, AN-J, AN-K), silver / copper wire emphasis.
- **systemBuildingLogic:** Tier ladder spans an enormous range (Cobra to flagship Ongaku / Gaku-On). Within-brand partnering is the canonical approach.
- **commonStrengths:** Tonal density; SET intimacy; single-brand voicing coherence.
- **commonTradeoffs:** SPL ceiling on lower-tier SET pairings; single-brand voicing is preference-dependent.
- **upgradeCautions:** Audio Note UK and Audio Note Japan are separate companies despite shared name.
- **bestUsedWhen:** The owner is committed to SET / high-efficiency philosophy and ideally builds within the brand.
- **avoidOverclaiming:** "unrivalled tone"; "the only SET that does X"; "Audio Note sound".
- **appliesToRoles:** `['source', 'amplifier', 'speaker']`
- **exampleModels:** CD 2.1x, Meishu, Soro, AN-E SPe HE, AN-J, AN-K.
- **notes:** **CRITICAL** distinction: Audio Note UK ≠ Audio Note Japan. Both are legitimate. The artifact should NOT collapse them.

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
- **avoidOverclaiming:** "the best Japanese tube"; "audiophile underground secret"; "Leben truth".
- **appliesToRoles:** `['amplifier']`
- **exampleModels:** CS300, CS600X, CS1000P, RS28CX (preamp).
- **notes:** Phase K reference uses Leben CS600X.

#### 20. Shindo Laboratory
- **matchTokens:** `['shindo']`
- **priority:** `audiophile-identity` • **confidence:** `medium`
- **houseVoicing:** All-tube vintage-tube-focused designs with characteristic Shindo tonal density and dynamic restraint.
- **designPhilosophy:** Ken Shindo lineage (now continued by Takashi Shindo). Vintage-tube focus, often NOS components, low-power SET / push-pull tube designs.
- **systemBuildingLogic:** Shindo amplifiers commonly partner with high-efficiency loudspeakers (DeVore Orangutan is the canonical NYC pairing). Within-brand source partnership is also common.
- **commonStrengths:** Tonal density; vintage-tube-character voicing; editorial cult following (Art Dudley legacy).
- **commonTradeoffs:** SPL ceiling on SET pairings; limited service network; long-term ownership requires vintage-tube partnership.
- **upgradeCautions:** Discontinued Shindo models (Aurieges, Monbrison, Cortese, Haut-Brion) have very limited replacement / repair paths.
- **bestUsedWhen:** A high-efficiency loudspeaker with a committed owner-listener relationship benefits from Shindo character.
- **avoidOverclaiming:** "unmatched tone"; "unsurpassed musicality"; "Shindo magic".
- **appliesToRoles:** `['amplifier']`
- **exampleModels:** Aurieges-L, Cortese, Monbrison, Haut-Brion.
- **notes:** Shindo has cult editorial following; restraint is critical to avoid hype. Art Dudley's Stereophile coverage built much of the modern Shindo identity.

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
- **avoidOverclaiming:** "the best integrated"; "Norwegian sound"; "Hegel quiet".
- **appliesToRoles:** `['amplifier']`
- **exampleModels:** H120, H190, H390, H600.
- **notes:** SoundEngine is a Hegel trademark architecture and safe to reference.

#### 22. Luxman
- **matchTokens:** `['luxman']`
- **priority:** `audiophile-identity` • **confidence:** `medium`
- **houseVoicing:** Japanese Class-AB integrated heritage with heavy power supplies; characteristic Luxman tonal richness and dynamic ease.
- **designPhilosophy:** Luxman Corporation lineage (Yokohama). High-bias Class-AB designs; tube models (LX series) and solid-state (L-series) coexist.
- **systemBuildingLogic:** L-505 / L-509X / L-595A SE solid-state integrated ladder; LX-380 / LX-1000 valve integrated tier. The L-509X is the longstanding flagship reference.
- **commonStrengths:** Tonal richness; dynamic ease; long-cycle ownership.
- **commonTradeoffs:** Weight and chassis scale; heat from high-bias designs.
- **upgradeCautions:** L-509X → L-595A SE is a substantial step in price; LX tube models are a voicing choice, not a hierarchy step.
- **bestUsedWhen:** A high-efficiency loudspeaker partner benefits from Class-AB headroom with Luxman tonal richness.
- **avoidOverclaiming:** "the most musical"; "Japanese sound"; "Luxman warmth".
- **appliesToRoles:** `['amplifier']`
- **exampleModels:** L-509X, L-595A SE, LX-380, LX-1000.
- **notes:** Distinguish L-series (SS) from LX-series (tube).

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
- **avoidOverclaiming:** "the rhythm leader"; "unbeatable PRaT" (PRaT belongs to Naim editorial vocabulary); "Rega truth".
- **appliesToRoles:** `['source', 'amplifier', 'speaker']`
- **exampleModels:** Planar 6, Planar 10, Aethos, Aria Mk3, Brio.
- **notes:** Rega ecosystem synergy is editorially safe to reference. Do not collapse Rega "rhythm" into Naim's PRaT vocabulary — they are different editorial traditions.

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
- **avoidOverclaiming:** "the best coaxial"; "flat measurement reference"; "KEF sound".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** LS50 Meta, LS60 Wireless, R3 Meta, Reference 3 Meta, Blade Two Meta.
- **notes:** KEF spans a wide range from budget Q-series to flagship Blade. Brand-level destination protection would over-protect Q-series; entry models are not destination-class. The `mixed` priority signals "audiophile-identity at higher tiers, commercial at entry tiers."

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
- **avoidOverclaiming:** "the most resolving tweeter"; "French sound"; "beryllium leader".
- **appliesToRoles:** `['speaker']`
- **exampleModels:** Aria 906, Sopra No. 2, Utopia III, Utopia M Maestro, Grande Utopia EM Evo.
- **notes:** Focal Pro (studio) is a separate division; mass-market Chora is not destination-class.

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
| **Cult-brand overclaim.** Shindo and Audio Note especially have cult editorial followings; "magic" / "musicality" / "the only" phrasing must be suppressed. | **Medium** | `avoidOverclaiming` lists for Shindo, Audio Note, Quad ESL explicitly include "magic" / "unrivalled" / "the only." |
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
> The Naim Supernait 3 carries the signal between the Naim NDX 2 and the Falcon Acoustics LS3/5a, translating source character into drive for the speakers. **Within the Naim ecosystem, the all-discrete signal path and outboard-PSU upgrade lever define how this integrated relates to the rest of the chain.**

### Quad ESL-57 (today vs. after E-5B):

Today (post-E-4):
> The Quad ESL-57 translates what the Quad II Classic delivers into sound in the room. *(§10 protection: destination-class.)*

After E-5B (with house voicing):
> The Quad ESL-57 translates what the Quad II Classic delivers into sound in the room. **The full-range dipole electrostatic panel — Peter Walker's original-designer design — frames the system's voicing around midrange realism and time coherence at the cost of SPL ceiling.**

### Pass Labs XA25 (today vs. after E-5B):

Today (post-C):
> The Pass Labs XA25 carries the signal between the dCS Bartók and the Harbeth 30.2 XD, translating source character into drive for the speakers. Its class-A solid-state design delivers control and resolution without smoothing texture.

After E-5B:
> [same first + facts sentences] **In the Nelson Pass design lineage, the XA series prioritizes Class-A current delivery over topology complexity.**

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
able to answer:

- **Is the language accurate?** Yes — each entry's `houseVoicing`,
  `designPhilosophy`, `systemBuildingLogic` is grounded in widely-cited
  editorial sources (Stereophile / Hi-Fi News / TAS / Hi-Fi+ /
  Stereophile's "Recommended Components" / brand-historical reference).
  Specific claims (PRaT, Ring DAC, Uni-Q, autoformer, Dual Concentric)
  are trademark architectures or universally-recognized editorial
  vocabulary.
- **Is it restrained?** Yes — `avoidOverclaiming` lists explicitly
  block superlatives, "the only," "magic," etc. Sentence length is
  capped at one. No marketing copy.
- **Is it useful?** Yes — the §5 prose improvements shown in §8 above
  add identity-awareness to the cards that owners would notice. The
  prose still reads as written by a thoughtful generalist, but one
  who has actually heard a Naim chain.
- **Does it improve expert credibility?** Yes — for the highest-priority
  brands (Naim, Linn, Pass, Quad, dCS, ARC, Wilson, Magico, Tannoy,
  Klipsch Heritage, JBL Synthesis, Harbeth, DeVore), the artifact moves
  from "category-aware" to "identity-aware." For the `medium` and
  `mixed` brands, the lift is smaller but real.
- **Does it avoid contaminating advisory quality with commerce?** Yes —
  the explicit `priority: 'commercial'` hard gate, the separation
  from `DESTINATION_SPEAKER_BRANDS` / `DESTINATION_SPEAKER_MODELS`,
  and the structural minimum entries for WiiM / Eversolo / Bluesound /
  Schiit / iFi / Topping demonstrate the boundary holds.

---

*End of Phase E-5A design document. No code is wired. This file is
documentation-only. Review and editorial sign-off recommended before
proceeding to Phase E-5B.*
