/**
 * Audio XX — Brand House Voicing data layer (Phase E-5B.1).
 *
 * Production data structure consumed by the future §5 / §8 / §10
 * composer integration to surface brand-specific identity sentences
 * with strict editorial discipline.
 *
 * **Stage E-5B.1 scope.** This file contains the production data and
 * a single pure lookup helper. It is NOT wired into any composer.
 * Stages E-5B.2 / E-5B.3 / E-5B.4 will add the gate stack and
 * composer integration behind a Preview-only feature flag.
 *
 * **Editorial provenance.** Every audiophile-identity entry transfers
 * verbatim from the approved
 * `docs/phase-E-5A-brand-house-voicing-design.md` §3, with the
 * implementation-time matchToken narrowings documented in
 * `docs/phase-E-5B-implementation-design.md` §2.3 (KEF and Focal
 * tier-enforcement; Tannoy Prestige / Legacy scoping is preserved
 * from E-5A directly). No editorial wording changes.
 *
 * **Exclusions.** Audio Note (#18) and Shindo Laboratory (#20) from
 * the E-5A document are NOT carried into this production file at any
 * confidence level. They are structurally absent per E-5A §12.4.
 *
 * **Governing principle.** Per E-5A §1A Brand Layer Philosophy:
 * architecture produces behavior; brand is the name attached to a
 * coherent set of architectural choices, not the cause of the
 * experience. This file's data adheres to that principle; future
 * surfacing through the composer must too.
 *
 * Set sizes:
 *   - 23 active audiophile-identity entries
 *   - 6 commercial markers
 *   - Total: 29
 */

// ─── Type definitions ────────────────────────────────────────────────

/**
 * Confidence the composer can have when surfacing brand voicing for an
 * entry. `low` never surfaces; `medium` surfaces only without
 * conflict-signal in the chain; `high` surfaces unless explicitly
 * suppressed by other gates. Enforced by the gate stack in E-5B.2.
 */
export type BrandConfidence = 'high' | 'medium' | 'low';

/**
 * Editorial designation. `commercial` is a HARD GATE — the gate stack
 * must never emit identity prose for a commercial entry. `mixed`
 * surfaces only at higher tiers (the data file enforces the tier cut
 * via narrowed `matchTokens`). `audiophile-identity` is the canonical
 * brand-voicing surface.
 */
export type BrandPriority = 'audiophile-identity' | 'mixed' | 'commercial';

/**
 * Role families used for the `appliesToRoles` gate. The gate stack
 * suppresses surfacing when the component's roleFamily is not in the
 * entry's `appliesToRoles`. `'all'` is a wildcard reserved for future
 * use; no current entry uses it.
 */
export type RoleFamily =
  | 'source'
  | 'amplifier'
  | 'speaker'
  | 'auxiliary'
  | 'all';

/**
 * Brand-house-voicing entry. Schema is the approved E-5A §2 shape.
 * All voicing fields are optional; the gate stack chooses the highest-
 * priority field that is set (per the section-specific priority
 * documented in E-5B §4.3).
 */
export interface BrandHouseVoicing {
  /** Canonical display name for the entry. */
  brand: string;
  /** Optional lineage marker (e.g. JBL Synthesis → JBL). */
  brandFamily?: string;
  /**
   * Lower-case tokens matched as substrings against the lower-cased
   * component name. Array order is the specificity order — more
   * specific tokens appear first within an entry's list.
   */
  matchTokens: readonly string[];
  /** Editorial designation; see {@link BrandPriority}. */
  priority: BrandPriority;
  /** Composer-surfacing confidence; see {@link BrandConfidence}. */
  confidence: BrandConfidence;
  /** Tonal / timing / dynamic character — at most one sentence. */
  houseVoicing?: string;
  /** Engineering / design ethos — at most one sentence. */
  designPhilosophy?: string;
  /** How upgrades work within the ecosystem — at most one sentence. */
  systemBuildingLogic?: string;
  /** 2-4 short phrases. */
  commonStrengths: readonly string[];
  /** 1-3 short phrases. */
  commonTradeoffs: readonly string[];
  /** 0-2 caution sentences; §10 surfaces `upgradeCautions[0]`. */
  upgradeCautions: readonly string[];
  /** ≤1 sentence — when this brand fits the system context. */
  bestUsedWhen?: string;
  /**
   * Per-entry deny-list. Sentences containing any of these substrings
   * (case-insensitive) must be suppressed by the gate stack before
   * surfacing. The universal cliché-deny vocabulary in
   * {@link UNIVERSAL_AVOID_OVERCLAIMING} applies in addition.
   */
  avoidOverclaiming: readonly string[];
  /** Roles for which this entry's voicing applies. */
  appliesToRoles: readonly RoleFamily[];
  /** Reference anchor models. */
  exampleModels: readonly string[];
  /** Editorial notes for future maintainers. */
  notes?: string;
}

// ─── Universal cliché-deny vocabulary ────────────────────────────────

/**
 * §12.6 universal cliché-deny vocabulary. Applied by the gate stack
 * in addition to each entry's per-entry `avoidOverclaiming` list. Any
 * candidate sentence containing one of these phrases (case-insensitive
 * substring) must be suppressed.
 *
 * `'musicality'` is included with the understanding that it is denied
 * when used as an unexplained noun. The gate stack treats the
 * substring uniformly; in practice, no E-5A-approved sentence uses
 * the word, so the gate will not over-fire on the production data.
 */
export const UNIVERSAL_AVOID_OVERCLAIMING: readonly string[] = [
  'magic',
  'legendary',
  'unrivalled',
  'unrivaled',
  'giant killer',
  'giant-killer',
  'giant slayer',
  'giant-slayer',
  'world class',
  'world-class',
  'best in class',
  'best-in-class',
  'endgame',
  'end-game',
  'end game',
  'cult',
  'reference killer',
  'reference-killer',
  'musicality',
] as const;

// ─── Production data ─────────────────────────────────────────────────

/**
 * Production set: 23 active audiophile-identity entries + 6 commercial
 * markers. Audio Note (#18) and Shindo (#20) from E-5A §3 are
 * intentionally absent.
 *
 * Array order encodes lookup specificity:
 *
 *   1. **Specific-token entries** (model names or compound tokens) —
 *      alphabetic by brand. These match first so split-tier brands
 *      (Klipsch Heritage vs RP, JBL Studio Monitor vs Stage, etc.) and
 *      tier-narrowed brands (KEF Reference+ only, Focal Sopra+ only)
 *      cannot be over-matched by a bare-brand entry.
 *   2. **Bare-brand single-token entries** — alphabetic by brand.
 *   3. **Commercial markers** — alphabetic by brand.
 *
 * Iteration in {@link findBrandHouseVoicing} is in array order;
 * first-match wins.
 */
export const BRAND_HOUSE_VOICING: readonly BrandHouseVoicing[] = [
  // ───────── Group 1 — Specific-token entries (alphabetic) ─────────

  {
    brand: 'Chord Electronics',
    matchTokens: [
      'chord hugo',
      'chord dave',
      'chord m scaler',
      'chord mojo',
      'chord qutest',
    ],
    priority: 'audiophile-identity',
    confidence: 'medium',
    houseVoicing:
      'FPGA-driven DAC line often described in terms of transient sharpness and spatial focus; distinct from typical R2R and delta-sigma voicings.',
    designPhilosophy:
      'Rob Watts FPGA designs across the Hugo / DAVE / M Scaler / Mojo line. Distinctive aluminum-billet chassis as visual identity.',
    systemBuildingLogic:
      'Hugo TT2 / DAVE act as the brand-tier anchors; the M Scaler adds upstream taps in the digital domain.',
    commonStrengths: [
      'Transient clarity',
      'spatial focus',
      'distinctive desktop ergonomics',
    ],
    commonTradeoffs: [
      'Voicing is preference-dependent',
      'case aesthetic is polarizing',
    ],
    upgradeCautions: [
      'Hugo line → DAVE is a substantial price step; M Scaler is an alternative within-brand upgrade path rather than a direct replacement.',
    ],
    bestUsedWhen:
      'The listener values transient precision and is comfortable with the Chord case aesthetic.',
    avoidOverclaiming: [
      'the most resolving',
      'measurement leader',
      'Rob Watts proves',
      'endgame',
      'world class',
      'the only FPGA DAC',
      'magic',
    ],
    appliesToRoles: ['source'],
    exampleModels: ['Hugo TT2', 'DAVE', 'M Scaler', 'Hugo 2', 'Mojo 2', 'Qutest'],
    notes:
      'Chord Company (cables) is a separate entity. matchTokens is intentionally narrowed to specific product names to avoid false positives on "Chord cables" / similar.',
  },

  {
    brand: 'DeVore Fidelity',
    matchTokens: ['devore fidelity', 'devore'],
    priority: 'audiophile-identity',
    confidence: 'high',
    houseVoicing:
      'Wide-baffle dynamic loudspeakers with high efficiency; the Orangutan line is associated with low-to-moderate power tube amplification as its canonical partner.',
    designPhilosophy:
      'John DeVore lineage. New York-based. Orangutan line uses wide-baffle high-efficiency dynamic drivers; the Reference line uses a different architecture and should be treated separately.',
    systemBuildingLogic:
      'Orangutan models specifically tend to anchor systems built around low-to-moderate power tube amplification; the Gibbon line is a different lineage.',
    commonStrengths: [
      'High efficiency that suits tube partnering',
      'wide-baffle scale',
      'tonal density in the right context',
    ],
    commonTradeoffs: [
      'Wide-baffle imaging is not pinpoint',
      'cabinet width and placement requirements limit room fit',
    ],
    upgradeCautions: [
      'Orangutan line voicing is distinct from Gibbon — they are not the same lineage.',
    ],
    bestUsedWhen:
      'A low-power tube amplifier benefits from a high-efficiency partner and the listener prefers tonal weight over pinpoint imaging.',
    avoidOverclaiming: [
      'the warmest',
      'reference natural',
      'the DeVore sound',
      'endgame',
      'world class',
      'the only horn alternative',
      'magic',
    ],
    appliesToRoles: ['speaker'],
    exampleModels: ['O/93', 'O/96', 'O/Reference', 'Gibbon 88', 'Gibbon Super 8'],
    notes:
      'Small NYC-based brand; service and ownership continuity is an ownership consideration. Phase K reference uses DeVore in a high-efficiency tube context.',
  },

  {
    brand: 'Focal',
    matchTokens: [
      'focal grande utopia',
      'focal maestro',
      'focal stella',
      'focal utopia',
      'focal sopra',
    ],
    priority: 'mixed',
    confidence: 'medium',
    houseVoicing:
      'Beryllium-tweeter top-end extension in higher tiers (Sopra and above), with the inverted-dome midrange as the brand\'s distinctive driver lineage; tier voicings differ meaningfully and brand-level claims should be scoped to Sopra and above.',
    designPhilosophy:
      'Saint-Étienne lineage. Beryllium tweeter in higher tiers; aluminum/magnesium dome in mid-tier; W-cone and Flax-cone midbass options. The driver architecture is the durable explanatory mechanism; tier voicings differ enough that one description cannot cover the line.',
    systemBuildingLogic:
      'Chora / Aria / Sopra / Utopia tier ladder; Maestro Utopia / Stella Utopia / Grande Utopia EM Evo flagships. Identity prose should be scoped to Sopra and above; Chora and entry Aria are positioned for a different listener.',
    commonStrengths: [
      'Top-end extension from the beryllium tweeter (Sopra and above)',
      'distinctive inverted-dome midrange lineage',
      'wide tier coverage from entry to statement',
    ],
    commonTradeoffs: [
      'Beryllium top-end is preference-dependent',
      'tier voicings vary meaningfully across Chora → Utopia and brand-level claims flatten that variation',
    ],
    upgradeCautions: [
      'Chora / Aria → Sopra / Utopia is a substantial scale step. Focal headphone (Utopia / Clear / Bathys) is a separate lineage.',
    ],
    bestUsedWhen:
      'A modern system favors top-end extension and the listener prefers beryllium character.',
    avoidOverclaiming: [
      'the most resolving tweeter',
      'the French sound',
      'beryllium leader',
      'endgame',
      'world class',
      'the only beryllium tweeter',
      'magic',
      'best in class',
    ],
    appliesToRoles: ['speaker'],
    exampleModels: [
      'Aria 906',
      'Sopra No. 2',
      'Utopia III',
      'Utopia M Maestro',
      'Grande Utopia EM Evo',
    ],
    notes:
      'Focal Pro (studio) is a separate division; mass-market Chora is not destination-class. The composer should restrict identity prose to Sopra and above; Chora and entry Aria tiers behave as commercial for this purpose. matchTokens are narrowed at the data-layer level to enforce this restriction (E-5B §2.3).',
  },

  {
    brand: 'JBL Studio Monitor & Synthesis',
    brandFamily: 'JBL',
    matchTokens: [
      'jbl 4329',
      'jbl 4349',
      'jbl 4367',
      'jbl 4429',
      'jbl k2',
      'jbl m2',
      'jbl everest',
      'jbl dd67000',
    ],
    priority: 'audiophile-identity',
    confidence: 'medium',
    houseVoicing:
      'Professional-monitor heritage, often described in terms of dynamic capability, controlled directivity via large compression-driver horns, and broad headroom.',
    designPhilosophy:
      'The 4xxx Studio Monitor lineage extends professional recording-monitor design into home audio.',
    systemBuildingLogic:
      'A 4xxx Studio Monitor tends to act as the system anchor; high-efficiency horn loading favors moderate-power solid-state or hybrid amplification.',
    commonStrengths: [
      'Dynamic capability',
      'broad headroom',
      'pro-monitor lineage credibility',
    ],
    commonTradeoffs: [
      'Cabinet size for larger models',
      'forward presentation is preference-dependent',
    ],
    upgradeCautions: [
      'The 4xxx Studio Monitor line is distinct from JBL Stage / Studio mid-tier home; they are not the same lineage.',
    ],
    bestUsedWhen:
      'A large room benefits from horn-loaded dynamic capability and the listener values pro-monitor presentation.',
    avoidOverclaiming: [
      'the only professional monitor',
      'flat reference',
      'the JBL sound',
      'endgame',
      'world class',
      'the only studio monitor that…',
      'giant killer',
    ],
    appliesToRoles: ['speaker'],
    exampleModels: ['4429', '4349', '4367', 'K2 S9900', 'M2', 'Project Everest DD67000'],
    notes:
      'JBL Stage / Studio (5xx, 6xx) and L100 Classic are separate lines with different voicings; intentionally NOT in matchTokens.',
  },

  {
    brand: 'KEF',
    matchTokens: [
      'kef reference',
      'kef blade',
      'kef muon',
      'kef r11',
      'kef r7',
      'kef r5',
      'kef r3',
    ],
    priority: 'mixed',
    confidence: 'medium',
    houseVoicing:
      'Uni-Q point-source coaxial driver — a concentric tweeter-in-midbass topology that tends to widen the off-axis listening window.',
    designPhilosophy:
      'Uni-Q driver: concentric tweeter-in-midbass for shared acoustic centre and broad dispersion. The same Uni-Q architecture appears across Q-series, R-series, Reference and Blade, but cabinet design, crossover topology, and voicing targets differ enough that the tiers are not interchangeable identities.',
    systemBuildingLogic:
      'Q-series (entry, commercial-tier presentation) → R-series (mid) → Reference → Blade and LS-series active wireless ladder; identity prose should be restricted to R-series and above. The Q-series is positioned and voiced for a different listener.',
    commonStrengths: [
      'Point-source imaging from the Uni-Q geometry',
      'broad off-axis dispersion',
      'engineering consistency at the architecture level',
    ],
    commonTradeoffs: [
      'Q-series and R-series are mid-tier and not destination-class',
      'LS50 series is preference-polarizing',
      'brand-level claims about voicing flatten meaningful tier differences',
    ],
    upgradeCautions: [
      'Q-series → R-series → Reference / Blade are meaningfully different tiers.',
    ],
    bestUsedWhen:
      'A modern listening style favors Uni-Q point-source imaging; system tier matches speaker tier.',
    avoidOverclaiming: [
      'the best coaxial',
      'flat measurement reference',
      'the KEF sound',
      'endgame',
      'world class',
      'the only Uni-Q',
      'magic',
      'giant killer',
    ],
    appliesToRoles: ['speaker'],
    exampleModels: [
      'LS50 Meta',
      'LS60 Wireless',
      'R3 Meta',
      'Reference 3 Meta',
      'Blade Two Meta',
    ],
    notes:
      'KEF spans a wide range from budget Q-series to flagship Blade. The "mixed" priority signals "audiophile-identity at higher tiers, commercial at entry tiers." matchTokens are narrowed at the data-layer level to enforce the tier restriction documented in E-5A notes (R-series and above only). The composer should not surface house voicing on Q-series chains.',
  },

  {
    brand: 'Klipsch Heritage',
    brandFamily: 'Klipsch',
    matchTokens: [
      'klipsch heresy',
      'klipsch forte',
      'klipsch cornwall',
      'klipsch la scala',
      'klipsch lascala',
      'klipschorn',
      'klipsch khorn',
    ],
    priority: 'audiophile-identity',
    confidence: 'high',
    houseVoicing:
      'Horn-loaded high-efficiency presentation, often described in terms of dynamic immediacy and broad dynamic range, with controlled directivity that trades off-axis evenness for on-axis efficiency.',
    designPhilosophy:
      'Paul W. Klipsch heritage (Hope, Arkansas). Horn loading plus high efficiency (~99 dB) translates to very low amplifier power requirements.',
    systemBuildingLogic:
      'Heritage loudspeakers tend to pair with low-power tube amplifiers in the canonical Klipsch system; the cabinet is the long-term anchor.',
    commonStrengths: [
      'Dynamic immediacy',
      'suits low-power tube amplification',
      'long lifecycle ownership',
    ],
    commonTradeoffs: [
      'Forward presentation that does not suit every recording',
      'off-axis response varies more than dome / planar designs',
    ],
    upgradeCautions: [
      'The Heritage line is distinct from Klipsch mass-market (RP / R / Reference Premiere); they share little design philosophy.',
    ],
    bestUsedWhen:
      'A low-power tube amplifier benefits from a high-efficiency partner and the room accommodates the cabinet size.',
    avoidOverclaiming: [
      'the only horn that does X',
      'best in class',
      "Paul Klipsch's last word",
      'endgame',
      'world class',
      'magic',
      'the only horn',
      'giant killer',
      'the original horn that…',
    ],
    appliesToRoles: ['speaker'],
    exampleModels: ['Heresy IV', 'Forte IV', 'Cornwall IV', 'La Scala AL5', 'Klipschorn AK6'],
    notes:
      'CRITICAL — Klipsch Heritage is sonically and editorially distinct from Klipsch RP / Reference Premiere mass-market. The artifact must not transfer Heritage identity to the RP line. matchTokens matches only Heritage model names.',
  },

  {
    brand: 'Quad',
    matchTokens: ['quad esl', 'quad ii'],
    priority: 'audiophile-identity',
    confidence: 'high',
    houseVoicing:
      'Electrostatic loudspeaker family often associated with midrange realism and point-source coherence at the cost of SPL ceiling.',
    designPhilosophy:
      "Acoustical Manufacturing heritage carried forward from Peter Walker's original ESL design. The ESL panel is a full-range dipole electrostatic with a load curve distinct from conventional dynamic loudspeakers.",
    systemBuildingLogic:
      'ESL loudspeakers tend to pair with specific amplifier types — typically tube or low-power solid-state chosen for the electrostatic load — and act as the system anchor.',
    commonStrengths: [
      'Midrange realism',
      'vocal naturalness',
      'time coherence',
      'long-term listenability in the right context',
    ],
    commonTradeoffs: [
      'SPL ceiling',
      'room placement matters for dipole behavior',
      'electrostatic load is demanding for some amplifiers',
    ],
    upgradeCautions: [
      'ESL panels are amplifier-sensitive; partner choice matters substantially. Modern Quad ESL service and panel availability is an ownership consideration.',
    ],
    bestUsedWhen:
      'The listener prioritizes midrange and vocal naturalness over scale, and the room supports dipole loading.',
    avoidOverclaiming: [
      'the only true electrostatic',
      'unbeatable midrange',
      "Peter Walker's last word",
      'magic',
      'endgame',
      'world class',
      'the only ESL that does X',
    ],
    appliesToRoles: ['speaker'],
    exampleModels: ['ESL-57', 'ESL-63', 'ESL-2912', 'Quad II', 'Quad II Classic', 'Quad II-forty'],
    notes:
      'Phase E-5B.2A — appliesToRoles narrowed to speaker-only. The houseVoicing / designPhilosophy / systemBuildingLogic fields are written about the ESL speaker family, not the Quad II tube-amp line; previously a Quad II Classic amplifier card would receive the electrostatic-speaker sentence, which is editorially wrong. The Quad II tube amps remain matched at the lookup level (matchToken "quad ii"), but the role gate now suppresses surfacing on amplifier cards. A future revision can add a separate amplifier-appropriate entry. Non-ESL Quad products (Quad 99, Vena, S-2, etc.) remain out of scope. matchTokens is narrowed to "quad esl" / "quad ii".',
  },

  {
    brand: 'Tannoy',
    matchTokens: [
      'tannoy prestige',
      'tannoy legacy',
      'canterbury',
      'westminster',
      'kensington',
      'turnberry',
      'cheviot',
      'arden',
      'eaton',
      'glenair',
      'stirling',
    ],
    priority: 'audiophile-identity',
    confidence: 'high',
    houseVoicing:
      'Dual-Concentric coaxial driver design, often described in terms of point-source imaging and a broad listening window; the coaxial geometry is what produces the imaging characteristic, not the brand.',
    designPhilosophy:
      'Heritage Dual-Concentric driver — an HF compression driver loaded behind a low-frequency driver, sharing a single acoustic axis. The Prestige line uses 12-inch and 15-inch dual-concentrics in classic cabinet alignments inherited from the Tannoy Monitor heritage.',
    systemBuildingLogic:
      "Tannoy Prestige loudspeakers tend to function as system anchors because the Dual-Concentric driver's load curve and the cabinet's room-coupling characteristic dictate placement and amplifier choices before any other system decision.",
    commonStrengths: [
      'Point-source imaging from the Dual-Concentric geometry',
      'broad listening window',
      'dynamic ease from large drivers in suitable rooms',
    ],
    commonTradeoffs: [
      'Cabinet size for full Prestige models',
      "the coaxial driver's coherence character is preference-dependent",
    ],
    upgradeCautions: [
      'Within the Prestige and Legacy lines, driver size (10 vs 12 vs 15 inch) shapes scale and room match more than electronics changes.',
    ],
    bestUsedWhen:
      'A large room benefits from the dynamic ease of 12- or 15-inch Dual-Concentric drivers.',
    avoidOverclaiming: [
      'unrivalled coherence',
      'the Tannoy sound',
      'the only true coaxial',
      'endgame',
      'world class',
      'magic',
    ],
    appliesToRoles: ['speaker'],
    exampleModels: ['Canterbury GR', 'Westminster Royal GR', 'Kensington', 'Turnberry GR', 'Cheviot', 'Arden', 'Eaton'],
    notes:
      "Confidence rationale: high confidence is retained because the explanatory mechanism is the Dual-Concentric architecture itself, not corporate continuity. matchTokens is narrowed to Prestige / Legacy model names so that identity transfer to non-Prestige Tannoy products is structurally prevented.",
  },

  {
    brand: 'Wilson Audio Specialties',
    matchTokens: [
      'wilson audio',
      'wilson sasha',
      'wilson sabrina',
      'wilson alexx',
      'wilson watt',
      'wamm',
    ],
    priority: 'audiophile-identity',
    confidence: 'high',
    houseVoicing:
      'Often described in terms of dynamic-range capability with cabinet damping that contributes to low colouration; X-Material composite chassis is distinct from MDF or aluminum.',
    designPhilosophy:
      'David Wilson lineage. Time-aligned driver arrangement; cabinet adjustability (modular drivers) on flagship models.',
    systemBuildingLogic:
      'Sabrina X / Sasha DAW / Alexx V / WAMM Master Chronosonic form a within-brand ladder; the cabinet tends to be the long-term anchor.',
    commonStrengths: [
      'Dynamic capability',
      'sustained scale at volume',
      'cabinet damping that supports low colouration',
    ],
    commonTradeoffs: [
      'Room-dependent',
      'cabinet size for upper-tier models',
      'setup-sensitive on placement and toe',
    ],
    upgradeCautions: [
      'Sasha DAW → Alexx V is a substantial scale step; not every room supports it.',
    ],
    bestUsedWhen:
      'A large room and a destination-tier amplifier benefit from Wilson scale and dynamic range.',
    avoidOverclaiming: [
      'the only dynamic speaker',
      'flat measurement reference',
      'the Wilson sound',
      'endgame',
      'world class',
      'the only modular speaker',
      'magic',
    ],
    appliesToRoles: ['speaker'],
    exampleModels: ['Sabrina X', 'Sasha DAW', 'Alexx V', 'WAMM Master Chronosonic'],
    notes:
      'Wilson Benesch is a separate UK brand (carbon-fibre cabinet) and is not the same identity.',
  },

  {
    brand: 'YG Acoustics',
    matchTokens: ['yg acoustics', 'yg carmel', 'yg hailey', 'yg sonja', 'yg vantage'],
    priority: 'audiophile-identity',
    confidence: 'medium',
    houseVoicing:
      'Precision-machined aluminum drivers (BilletCore) in sealed cabinets, often described in terms of measurement-led voicing and transient sharpness.',
    designPhilosophy:
      'Yoav Geva lineage. Precision aluminum driver machining; sealed cabinets. US-designed loudspeaker brand with a measurement-forward stance.',
    systemBuildingLogic:
      'Carmel 2 (entry) → Hailey → Sonja → Vantage within-brand ladder; each step is a meaningful change in scale and ambition.',
    commonStrengths: [
      'Precision driver behavior',
      'sealed-cabinet bass discipline',
      'engineering consistency across the line',
    ],
    commonTradeoffs: [
      'Transient sharpness is preference-dependent',
      'placement and amplification choices matter',
    ],
    upgradeCautions: [
      'Carmel 2 → Hailey is a substantial scale step in both price and room demand.',
    ],
    bestUsedWhen:
      'A solid-state amplifier with linear measurement partners well, and the listener values transient precision.',
    avoidOverclaiming: [
      'the most precise',
      'measurement leader',
      'the YG sound',
      'endgame',
      'world class',
      'every model is reference',
      'the only precision speaker',
      'magic',
    ],
    appliesToRoles: ['speaker'],
    exampleModels: ['Carmel 2', 'Hailey 2.2', 'Sonja XV', 'Vantage'],
    notes:
      'BilletCore driver and sealed cabinet are YG identity features. Do not treat every tier as reference-class; Carmel 2 is the entry into the line and is positioned differently from Sonja.',
  },

  // ───── Group 2 — Bare-brand single-token entries (alphabetic) ─────

  {
    brand: 'Audio Research',
    matchTokens: ['audio research'],
    priority: 'audiophile-identity',
    confidence: 'medium',
    houseVoicing:
      'All-tube Reference designs often associated with harmonic density and dynamic capability; the LS line voicing is closer to neutral.',
    designPhilosophy:
      'The Reference series is all-tube high-power, often with auto-bias topology.',
    systemBuildingLogic:
      'Reference series components historically partner with destination-class loudspeakers; the LS series sits as the mid-tier all-tube preamplifier with a less imposing chassis.',
    commonStrengths: [
      'Harmonic density',
      'dynamic capability',
      'long history of partnership with destination-class loudspeakers',
    ],
    commonTradeoffs: [
      'Tube life as ongoing ownership cost',
      'heat output from larger Ref amps',
    ],
    upgradeCautions: [
      "Within the historical ARC catalog, Ref → larger Ref is the canonical step; cross to non-ARC tube architecture changes the system's identity.",
      'ARC changed hands in 2024 and the future direction of the brand is not yet established — treat current claims as historical until new product confirms continuity.',
    ],
    bestUsedWhen:
      'A destination-class loudspeaker benefits from tube character without bloom.',
    avoidOverclaiming: [
      'warm',
      'best of all worlds',
      'the ARC voice',
      'endgame',
      'world class',
      'the reference tube brand',
      'magic',
    ],
    appliesToRoles: ['amplifier'],
    exampleModels: ['Ref 6', 'Ref 6SE', 'Ref 160M', 'Ref 80', 'LS28', 'Ref Phono 3'],
    notes:
      'Reference and LS lines are voiced differently — the artifact should not collapse them. ARC was sold in 2024; ownership and service continuity is a current consideration, and any new model under new ownership should be treated as a separate editorial entity until validated.',
  },

  {
    brand: 'dCS',
    matchTokens: ['dcs'],
    priority: 'audiophile-identity',
    confidence: 'high',
    houseVoicing:
      'Digital presentation often described in terms of timing precision and clean extension; not a "voiced" DAC in the warmth/lean sense.',
    designPhilosophy:
      'Ring DAC architecture — a discrete FPGA-driven topology distinct from conventional R2R or delta-sigma. Originated in professional audio applications.',
    systemBuildingLogic:
      'Vivaldi (statement stack) / Rossini (one-box) / Bartók (compact streaming endpoint) tier ladder; each step is meaningful in capability and cost.',
    commonStrengths: [
      'Timing precision',
      'resolution',
      'low noise floor',
      'long-term firmware support cadence',
    ],
    commonTradeoffs: [
      'Cost ceiling for Vivaldi APEX',
      'not aimed at listeners who prefer a euphonic R2R signature',
    ],
    upgradeCautions: [
      'Within dCS, the Vivaldi APEX path is the canonical within-brand step; cross to R2R brands changes the digital character substantively.',
    ],
    bestUsedWhen:
      'The system is high-resolution downstream and the digital source is the limiting factor.',
    avoidOverclaiming: [
      'the only reference DAC',
      'unbeatable',
      'transparent',
      'endgame',
      'world class',
      'the digital reference',
      'measurement leader',
      'magic',
    ],
    appliesToRoles: ['source'],
    exampleModels: ['Bartók', 'Rossini', 'Vivaldi APEX'],
    notes:
      'Ring DAC is a dCS trademark architecture and safe to name. The Bartók is widely regarded as high-tier but is not unilaterally destination-class — destination decisions remain system-context-dependent.',
  },

  {
    brand: 'Harbeth',
    matchTokens: ['harbeth'],
    priority: 'audiophile-identity',
    confidence: 'high',
    houseVoicing:
      'BBC research-derived tradition, often described in terms of midrange naturalness and long-listening comfort, with thin-wall cabinet construction characteristic of the line.',
    designPhilosophy:
      "Alan Shaw lineage. RADIAL polypropylene cone material. Thin-wall MDF cabinet construction inherited from BBC research; Harbeth's relationship to that research is genealogical (founder Dudley Harwood was a BBC engineer) rather than a perpetual licensing arrangement.",
    systemBuildingLogic:
      'Harbeth standmounts tend to function as long-term system anchors; Class-A or high-bias Class-AB amplification is the common partner.',
    commonStrengths: [
      'Midrange naturalness',
      'vocal presentation',
      'long-listening comfort',
      'long lifecycle ownership',
    ],
    commonTradeoffs: [
      'Bass extension limited by the BBC-tradition cabinet alignment',
      'proper stands are part of the design',
    ],
    upgradeCautions: [
      'Within Harbeth, the 30.2 XD → 40.2 XD → 40.3 XD steps each materially change scale and room match.',
    ],
    bestUsedWhen:
      'A small-to-medium room favors midrange-led standmounts with a high-bias amplifier.',
    avoidOverclaiming: [
      'the most natural',
      'BBC monitor truth',
      'Harbeth honesty',
      'endgame',
      'world class',
      'the only true BBC speaker',
      'magic',
    ],
    appliesToRoles: ['speaker'],
    exampleModels: ['30.2 XD', 'SHL5plus XD', 'Monitor 40.3 XD', 'P3ESR XD'],
    notes:
      "BBC tradition is editorially safe when described as research-derived / genealogical, not as licensing or exclusive ownership. RADIAL is Alan Shaw's polymer cone material and is a brand-specific identity feature.",
  },

  {
    brand: 'Hegel Music Systems',
    matchTokens: ['hegel'],
    priority: 'audiophile-identity',
    confidence: 'medium',
    houseVoicing:
      'Class-AB integrated amplifiers with SoundEngine feedback architecture, often associated with transient grip and neutral presentation.',
    designPhilosophy:
      "Bent Holter (founder). SoundEngine is Hegel's proprietary feedback architecture; their Class-AB integrateds emphasize transient grip without warmth coloration.",
    systemBuildingLogic:
      'H95 / H120 / H190 / H390 / H600 tier ladder. The H190 is a longstanding mid-tier reference.',
    commonStrengths: [
      'Transient grip',
      'neutral voicing',
      'long-term reliability',
    ],
    commonTradeoffs: [
      'Solid-state register not preferred by every listener',
      'aesthetic / fascia design is utilitarian',
    ],
    upgradeCautions: [
      'H120 → H190 → H390 → H600 — each step adds power and resolution without changing the SoundEngine character.',
    ],
    bestUsedWhen:
      'A well-matched modern loudspeaker benefits from neutral Class-AB grip and broad streaming connectivity.',
    avoidOverclaiming: [
      'the best integrated',
      'the Norwegian sound',
      'Hegel quiet',
      'endgame',
      'world class',
      'the only Class-AB that…',
      'magic',
      'best in class',
    ],
    appliesToRoles: ['amplifier'],
    exampleModels: ['H120', 'H190', 'H390', 'H600'],
    notes:
      'SoundEngine is a Hegel trademark architecture and safe to reference as a brand-specific feedback approach (not as an objective superiority claim).',
  },

  {
    brand: 'Leben Hi-Fi',
    matchTokens: ['leben'],
    priority: 'audiophile-identity',
    confidence: 'medium',
    houseVoicing:
      'Push-pull tube integrated amplifiers using EL84 / 6L6GC / 6CA7 output stages, often associated with mature voicing that avoids euphonic warmth-bloat in many systems.',
    designPhilosophy:
      "Taku Hyodo lineage (founder, Tokyo). Push-pull tube topology with selected output-stage tubes; the design choices (push-pull rather than SET, mid-power output, EL84/6L6GC/6CA7 selection) are the explanatory mechanism, not the brand's regional provenance.",
    systemBuildingLogic:
      'CS300 / CS600 / CS600X / CS1000P tier. The CS600 series is the canonical Leben integrated.',
    commonStrengths: [
      'Mature voicing stability',
      'push-pull tube character without warmth-bloat',
      'pairing well with high-efficiency speakers',
    ],
    commonTradeoffs: [
      'Lower-power tube limits demanding loads',
      'boutique-brand service consideration',
    ],
    upgradeCautions: [
      'CS300 → CS600 is a meaningful step in headroom and authority.',
    ],
    bestUsedWhen:
      'A high-efficiency loudspeaker partner with moderate room scale benefits from push-pull tube tonal density.',
    avoidOverclaiming: [
      'the best Japanese tube',
      'audiophile underground secret',
      'the Leben truth',
      'endgame',
      'world class',
      'the only push-pull that…',
      'magic',
      'musicality',
    ],
    appliesToRoles: ['amplifier'],
    exampleModels: ['CS300', 'CS600X', 'CS1000P', 'RS28CX'],
    notes:
      'Phase K reference uses Leben CS600X. Boutique service network is limited outside Japan; ownership consideration on parts availability.',
  },

  {
    brand: 'Linn Products',
    matchTokens: ['linn'],
    priority: 'audiophile-identity',
    confidence: 'high',
    houseVoicing:
      'Source-first presentation, with emphasis on rhythmic precision and timing in many systems.',
    designPhilosophy:
      "Source-first design principle: in Linn's editorial position, source quality sets a ceiling on what the rest of the system can convey. Heavily software-defined in modern lines (Konfig configuration software, Space Optimisation room correction).",
    systemBuildingLogic:
      'LP12 (vinyl) or Klimax DSM (digital) commonly function as the brand-tier anchor; the Klimax / Akurate / Selekt tier ladder structures within-brand upgrades.',
    commonStrengths: [
      'Source-tier coherence',
      'modular upgrade path within the ecosystem',
      'active-speaker integration via Akubarik / Akudorik',
    ],
    commonTradeoffs: [
      'Single-brand voicing dependence',
      'Linn presentation is preference-dependent',
    ],
    upgradeCautions: [
      'Mixing Linn sources with non-Linn electronics often weakens the source-first premise.',
    ],
    bestUsedWhen:
      'The listener is committed to a single-brand ecosystem with source-first upgrade priorities.',
    avoidOverclaiming: [
      'the source of truth',
      'unrivalled timing',
      'the Linn sound',
      'endgame',
      'world class',
      'the only source-first brand',
    ],
    appliesToRoles: ['source', 'amplifier', 'speaker'],
    exampleModels: ['LP12 Klimax', 'Klimax DSM', 'Akubarik', 'Selekt DSM', 'Majik'],
    notes:
      "Source-first is foundational Linn editorial vocabulary and is safe to reference; do not present it as an objective property. Linn's voicing across decades has shifted (early Tiefenbrun era vs. modern software-defined era); treat the modern era as the referent.",
  },

  {
    brand: 'Luxman',
    matchTokens: ['luxman'],
    priority: 'audiophile-identity',
    confidence: 'medium',
    houseVoicing:
      'High-bias Class-AB integrated amplifier designs with substantial power supplies and large output stages, often associated with tonal richness and dynamic ease at moderate volumes.',
    designPhilosophy:
      'Luxman Corporation lineage (Yokohama, Japan). High-bias Class-AB topology with conservative bias points and oversized power supplies; the tube models (LX series) use push-pull triode designs and the solid-state (L-series) lineage coexists with separate voicing targets.',
    systemBuildingLogic:
      'L-505 / L-509X / L-595A SE solid-state integrated ladder; LX-380 / LX-1000 valve integrated tier. The L-509X has historically anchored the flagship reference.',
    commonStrengths: [
      'Tonal richness',
      'dynamic ease',
      'long-cycle ownership in many systems',
    ],
    commonTradeoffs: [
      'Weight and chassis scale',
      'heat from high-bias designs',
    ],
    upgradeCautions: [
      'L-509X → L-595A SE is a substantial step in price; the LX tube models are a voicing choice rather than a hierarchy step from the SS line.',
    ],
    bestUsedWhen:
      "A loudspeaker partner benefits from Class-AB headroom paired with the brand's tonal character.",
    avoidOverclaiming: [
      'the most musical',
      'the Japanese sound',
      'Luxman warmth',
      'endgame',
      'world class',
      'the only high-bias Class-AB that…',
      'magic',
      'musicality',
    ],
    appliesToRoles: ['amplifier'],
    exampleModels: ['L-509X', 'L-595A SE', 'LX-380', 'LX-1000'],
    notes:
      'Distinguish the L-series (solid-state) from the LX-series (tube) — they are different voicings, not a tier ladder.',
  },

  {
    brand: 'Magico',
    matchTokens: ['magico'],
    priority: 'audiophile-identity',
    confidence: 'high',
    houseVoicing:
      'Sealed-cabinet aluminum-extrusion construction designed to minimize cabinet contribution; the engineering goal is low cabinet colouration, though the resulting presentation is preference-dependent — some listeners hear neutrality, others find it analytical.',
    designPhilosophy:
      'Aluminum-extrusion sealed cabinets and beryllium tweeters (in higher tiers) are the durable engineering claims; "low colouration" is the design intent rather than a universally-agreed listening outcome.',
    systemBuildingLogic:
      'A-series (entry) → S-series → M-series within-brand ladder; sealed-cabinet design tends to favor solid-state amplification with strong bass control.',
    commonStrengths: [
      'Cabinet inertness',
      'bass control via sealed alignment',
      'engineering consistency across the line',
    ],
    commonTradeoffs: [
      'Cabinet weight',
      'sealed-cabinet bass extension favors amplification with grip',
    ],
    upgradeCautions: [
      'A1 → A3 → A5 → S3 → M-series each substantially change scale and room match.',
    ],
    bestUsedWhen:
      'A solid-state amplifier with strong bass control is in place, and the room benefits from sealed-cabinet bass discipline.',
    avoidOverclaiming: [
      'the most neutral',
      'measurement winner',
      'Magico measurement',
      'the only sealed-cabinet leader',
      'endgame',
      'world class',
      'the measurement reference',
      'magic',
    ],
    appliesToRoles: ['speaker'],
    exampleModels: ['A1', 'A3', 'A5', 'S3', 'M3', 'M6'],
    notes:
      'Sealed-cabinet aluminum-extrusion construction is a Magico identity feature; measurement claims must be hedged because "neutral" is not a universally-shared category among destination loudspeakers.',
  },

  {
    brand: 'McIntosh',
    matchTokens: ['mcintosh'],
    priority: 'audiophile-identity',
    confidence: 'medium',
    houseVoicing:
      'Smooth, full-bodied presentation with broad headroom in many systems.',
    designPhilosophy:
      'Autoformer output transformers (in many solid-state designs) and unity-coupled circuit (in tube designs).',
    systemBuildingLogic:
      "McIntosh integrated amplifiers and MA / MC pairings often act as the system anchor because the autoformer-coupled output offers broad load tolerance across difficult speaker impedance curves; in many systems this lets the speaker be chosen for room and listener taste rather than to match an amplifier's load preferences.",
    commonStrengths: [
      'Broad headroom',
      'tonal weight',
      'long-term within-brand ownership ecosystem',
    ],
    commonTradeoffs: [
      'Presentation is preference-dependent',
      'weight and physical scale of larger models',
    ],
    upgradeCautions: [
      'Hybrid tube/SS designs (e.g. MA12000) are not pure-tube despite the tube indicator stage.',
    ],
    bestUsedWhen:
      'The listener values broad headroom and is comfortable with the McIntosh presentation.',
    avoidOverclaiming: [
      'warmest in solid-state',
      'unbeatable bass',
      'the only autoformer',
      'the McIntosh sound',
      'endgame',
      'world class',
      'best integrated',
    ],
    appliesToRoles: ['amplifier'],
    exampleModels: ['MC275', 'MA12000', 'MA8950', 'MC462', 'MC1.25KW'],
    notes:
      'Hybrid tube+SS designs (MA12000) are often mistaken for pure-tube; the tube stage is preamp / driver, the output is solid-state with autoformer. Brand voicing has evolved across ownership and era; treat the modern Binghamton-made models as the referent.',
  },

  {
    brand: 'Naim Audio',
    matchTokens: ['naim'],
    priority: 'audiophile-identity',
    confidence: 'high',
    houseVoicing:
      'The discrete signal path and tight coupling to the power supply tend to produce a forward, rhythmically engaged presentation — what editorial coverage labels PRaT.',
    designPhilosophy:
      'All-discrete signal path; power-supply design treated as a primary determinant of sound, with outboard PSUs offered as a within-brand upgrade path on many models. The PSU hierarchy is an engineering choice, not a marketing label.',
    systemBuildingLogic:
      'Within the Naim ecosystem, upgrades tend to run through external power supplies and within-brand tier-step electronics rather than cross-brand substitution.',
    commonStrengths: [
      'Rhythmic engagement',
      'vocal directness',
      'ecosystem-coherent system building',
    ],
    commonTradeoffs: [
      'Forward presentation that does not suit every recording',
      'in many systems the PSU hierarchy is part of how the brand is meant to be heard',
    ],
    upgradeCautions: [
      "Mixing Naim with non-Naim partners often shifts the presentation away from the brand's identity.",
    ],
    bestUsedWhen:
      'The listener prioritizes rhythm and timing engagement over warmth or maximal resolution.',
    avoidOverclaiming: [
      'unrivalled',
      'best in class',
      'the Naim sound',
      'PRaT leader',
      'the only brand that does PRaT',
      'endgame',
      'world class',
    ],
    appliesToRoles: ['source', 'amplifier'],
    exampleModels: ['NDX 2', 'XPS DR', 'Supernait 3', 'NAP 250', 'Nait XS 3'],
    notes:
      'PRaT is widely-recognized editorial vocabulary in Naim coverage and is safe to use when hedged as editorial vocabulary, not as an objective property. The PSU hierarchy (HiCap → XPS DR → 555PS DR) is a documented Naim upgrade convention; reference it as a within-brand convention, not as a universal upgrade truth.',
  },

  {
    brand: 'Pass Labs',
    matchTokens: ['pass labs', 'pass laboratories'],
    priority: 'audiophile-identity',
    confidence: 'high',
    houseVoicing:
      'Class-A solid-state often described in terms of tonal density and dynamic ease at moderate volumes, with control achieved without smoothing texture.',
    designPhilosophy:
      'Nelson Pass design lineage: relatively simple topologies, generous Class-A bias, large heatsinks, and current delivery prioritized over feature complexity.',
    systemBuildingLogic:
      'XA / INT / X-series tiers each carry different Class-A bias levels; within-brand step typically follows loudspeaker drive demands.',
    commonStrengths: [
      'Tonal density',
      'bass control without thinning',
      'long-term listenability in many systems',
    ],
    commonTradeoffs: [
      'Heat output from Class-A operation',
      'chassis weight',
      'room ventilation is part of ownership',
    ],
    upgradeCautions: [
      'XA-series → larger XA-series is the canonical within-brand step rather than substitution to a different topology.',
    ],
    bestUsedWhen:
      'A demanding loudspeaker load benefits from Class-A current delivery, and the room accommodates the heat.',
    avoidOverclaiming: [
      'warm',
      'tube-like',
      'the only Class-A that does X',
      'the Pass sound',
      'endgame',
      'world class',
      'Class-A leader',
    ],
    appliesToRoles: ['amplifier'],
    exampleModels: ['XA25', 'XA60.8', 'XA200.8', 'INT-25', 'INT-60', 'XP-32', 'XP-27'],
    notes:
      'Pass amplifiers are not tube-like in voicing — a common owner shorthand to avoid. Nelson Pass also runs FirstWatt as a separate brand for kit-friendly low-power designs; do not conflate the two.',
  },

  {
    brand: 'Rega',
    matchTokens: ['rega'],
    priority: 'audiophile-identity',
    confidence: 'high',
    houseVoicing:
      'A cross-component design — turntables, electronics, and loudspeakers from the same team — that tends to produce ecosystem-level compatibility and rhythmic engagement.',
    designPhilosophy:
      "Roy Gandy lineage (Essex, UK). The cross-component design philosophy is the engineering choice: turntables, electronics, and loudspeakers share a single team's voicing target and within-brand cartridge / tonearm / speaker pairings are tested as full systems before release.",
    systemBuildingLogic:
      'Within-brand Rega partnering tends to surface ecosystem-level compatibility — matched gain stages, recommended cartridges, intentional voicing alignment — that cross-brand substitution typically dilutes.',
    commonStrengths: [
      'Ecosystem-level compatibility from the cross-component design',
      'rhythmic engagement when systems are built within the brand',
      'long-cycle ownership',
    ],
    commonTradeoffs: [
      'Single-brand voicing dependence',
      'Rega character is preference-dependent',
    ],
    upgradeCautions: [
      'Planar tier steps are meaningful; cross-brand cartridge changes the foundation.',
    ],
    bestUsedWhen:
      'The owner values brand-coherent voicing and is committed to building within the Rega ecosystem.',
    avoidOverclaiming: [
      'the rhythm leader',
      'unbeatable PRaT',
      'the Rega truth',
      'endgame',
      'world class',
      'the only brand-coherent system',
      'magic',
      'musicality',
    ],
    appliesToRoles: ['source', 'amplifier', 'speaker'],
    exampleModels: ['Planar 6', 'Planar 10', 'Aethos', 'Aria Mk3', 'Brio'],
    notes:
      'Rega ecosystem synergy is editorially safe to reference. Do not collapse Rega "rhythm" into Naim\'s PRaT vocabulary — they are different editorial traditions and should not borrow each other\'s house terminology.',
  },

  {
    brand: 'Spendor',
    matchTokens: ['spendor'],
    priority: 'audiophile-identity',
    confidence: 'high',
    houseVoicing:
      'BBC heritage line (Classic) is sealed-cabinet, midrange-focused; D-series modern line is bass-reflex and more modern-voiced.',
    designPhilosophy:
      'BBC heritage extends from LS3/5a / LS5/8 lineage. Modern D-series moves the brand toward bass-reflex modern speakers without abandoning the heritage line.',
    systemBuildingLogic:
      'Classic 2/3 / SP100R2 are sealed BBC heritage; D7.2 / D9.2 / A4 are modern bass-reflex. The two lines are voiced differently.',
    commonStrengths: [
      'BBC tradition (Classic line)',
      'modern bass extension (D-series)',
      'sealed-cabinet control (Classic)',
    ],
    commonTradeoffs: [
      'Classic line bass extension limited',
      'D-series voicing distinct from Classic — not a like-for-like upgrade',
    ],
    upgradeCautions: [
      'Classic → D-series is a voicing change, not a hierarchical step.',
    ],
    bestUsedWhen:
      'The owner has decided whether they prefer the sealed BBC tradition or the modern reflex direction.',
    avoidOverclaiming: [
      'BBC truth',
      'British best',
      'the Spendor sound',
      'endgame',
      'world class',
      'the only true BBC line',
      'magic',
    ],
    appliesToRoles: ['speaker'],
    exampleModels: ['Classic 2/3', 'SP100R2', 'D7.2', 'D9.2', 'A4', 'Classic 1/2'],
    notes:
      'Distinguish Classic line from D-series — they are not the same voicing. Like Harbeth, Spendor is a BBC licensee/inheritor; do not present BBC heritage as exclusive ownership.',
  },

  // ───────── Group 3 — Commercial markers (alphabetic) ─────────
  // priority === 'commercial' is a HARD GATE in the future gate
  // stack. These entries intentionally omit houseVoicing /
  // designPhilosophy / systemBuildingLogic; the composer must
  // refuse to emit identity prose for any entry in this group.

  {
    brand: 'Bluesound',
    matchTokens: ['bluesound'],
    priority: 'commercial',
    confidence: 'low',
    commonStrengths: ['BluOS streaming ecosystem', 'broad protocol support'],
    commonTradeoffs: ['Identity is platform-defined rather than voicing-defined'],
    upgradeCautions: [],
    avoidOverclaiming: ['Any house-voicing claim'],
    appliesToRoles: ['source'],
    exampleModels: ['Node', 'Pulse', 'Powernode'],
    notes: 'Use as functional category descriptor only.',
  },

  {
    brand: 'Eversolo',
    matchTokens: ['eversolo'],
    priority: 'commercial',
    confidence: 'low',
    commonStrengths: [
      'Affordable streaming entry',
      'touch-screen front panel',
      'broad protocol support',
    ],
    commonTradeoffs: ['Identity is functional rather than voicing-led'],
    upgradeCautions: [],
    avoidOverclaiming: ['Any house-voicing claim'],
    appliesToRoles: ['source'],
    exampleModels: ['DMP-A6', 'DMP-A8'],
    notes: 'Use as functional category descriptor only.',
  },

  {
    brand: 'iFi Audio',
    matchTokens: ['ifi'],
    priority: 'commercial',
    confidence: 'low',
    commonStrengths: [
      'Wide product range',
      'budget-to-mid',
      'XBass / 3D filtering features',
    ],
    commonTradeoffs: ['Identity is feature-led rather than voicing-led'],
    upgradeCautions: [],
    avoidOverclaiming: ['Any house-voicing claim'],
    appliesToRoles: ['source', 'amplifier'],
    exampleModels: ['Zen DAC', 'Zen Phono', 'Pro iCAN Signature'],
    notes:
      'Use as functional category descriptor only. Pro iCAN may warrant per-model treatment in a future revision.',
  },

  {
    brand: 'Schiit Audio',
    matchTokens: ['schiit'],
    priority: 'commercial',
    confidence: 'low',
    commonStrengths: [
      'Affordable modular stack',
      'iteratively upgradable',
      'broad headphone product range',
    ],
    commonTradeoffs: [
      'House voicing varies substantially by product (Magni, Bifrost, Yggdrasil all read differently)',
      'brand-level identity claim is weak',
    ],
    upgradeCautions: [],
    avoidOverclaiming: ['Any singular house-voicing claim'],
    appliesToRoles: ['source', 'amplifier'],
    exampleModels: ['Modi', 'Bifrost', 'Yggdrasil', 'Magni', 'Magnius', 'Asgard', 'Lyr'],
    notes:
      'Use as functional category descriptor only. Yggdrasil specifically may warrant a per-model entry in a future revision.',
  },

  {
    brand: 'Topping',
    matchTokens: ['topping'],
    priority: 'commercial',
    confidence: 'low',
    commonStrengths: [
      'Affordable measurement-led DAC / amp',
      'rapidly iterating product cycle',
    ],
    commonTradeoffs: ['Identity is measurement-led rather than voicing-led'],
    upgradeCautions: [],
    avoidOverclaiming: ['Any house-voicing claim', 'measurement reference'],
    appliesToRoles: ['source', 'amplifier'],
    exampleModels: ['D50s', 'D90', 'A90', 'LA90', 'LA90D'],
    notes: 'Use as functional category descriptor only.',
  },

  {
    brand: 'WiiM',
    matchTokens: ['wiim'],
    priority: 'commercial',
    confidence: 'low',
    commonStrengths: [
      'Affordable streaming entry',
      'Roon Ready / AirPlay 2 compatibility',
    ],
    commonTradeoffs: [
      'Built-in DAC limits upgrade leverage',
      'identity is functional rather than voicing-led',
    ],
    upgradeCautions: [],
    avoidOverclaiming: [
      'Any house-voicing claim',
      'punching above its price',
      'the streamer king',
    ],
    appliesToRoles: ['source'],
    exampleModels: ['WiiM Mini', 'WiiM Pro', 'WiiM Pro Plus', 'WiiM Ultra'],
    notes: 'Use as functional category descriptor only. Do NOT generate house-voicing prose.',
  },
] as const;

// ─── Lookup helper ───────────────────────────────────────────────────

/**
 * Look up the brand-house-voicing entry that matches a component name.
 *
 * Behavior:
 *   1. Returns null when `componentName` is empty / nullish.
 *   2. Lowercases `componentName` once for the match.
 *   3. Iterates {@link BRAND_HOUSE_VOICING} in array order; for each
 *      entry, iterates its `matchTokens` in array order; returns the
 *      first entry whose lowercase token appears as a substring of the
 *      lowercase component name.
 *   4. Returns null when no entry matches.
 *
 * **First-match-wins specificity.** Array order in
 * {@link BRAND_HOUSE_VOICING} places more-specific tokens before more
 * generic tokens (Group 1 → Group 2 → Group 3). This is the structural
 * answer to split-tier brands: Klipsch Heritage (Group 1) matches
 * before any hypothetical bare-`klipsch` entry. The production set has
 * no overlapping token coverage by construction, but the array order
 * is the long-term invariant.
 *
 * **No gate logic.** This helper does NOT apply the commercial hard
 * gate, the confidence gates, the role applicability check, conflict-
 * signal suppression, primary-constraint suppression, redundancy
 * suppression, anti-overclaim deny-check, or the architecture-produces-
 * behavior shape check. Those are the gate stack's responsibility
 * (Stage E-5B.2). For commercial entries, the helper returns the entry
 * so callers can identify the brand for catalog / search purposes;
 * surfacing must be suppressed at the gate stack layer.
 *
 * **Pure function.** Given the same input, the helper returns the same
 * output. No state, no side effects, no logging.
 *
 * @param componentName Chain-component display name (mixed-case OK).
 * @returns The matching entry, or null when no entry's tokens match.
 */
export function findBrandHouseVoicing(
  componentName: string | null | undefined,
): BrandHouseVoicing | null {
  if (!componentName) return null;
  const lower = componentName.toLowerCase();
  for (const entry of BRAND_HOUSE_VOICING) {
    for (const token of entry.matchTokens) {
      if (lower.includes(token)) {
        return entry;
      }
    }
  }
  return null;
}

