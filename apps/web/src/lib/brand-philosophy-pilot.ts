/**
 * Brand philosophy pilot — runtime adapter, 7 brands.
 *
 * Purpose:
 *   Provide curated mechanism / behavior / perception / preference-fit data
 *   for the highest-risk pilot brands so the engine does not depend on
 *   regex-extraction from prose tendency text. Authored against the v2
 *   editorial layer in `docs/brand-philosophy-master-table.md`.
 *
 * Scope (Step 2 of 9 — beta path):
 *   - Read-only TypeScript literal.
 *   - No YAML, no package extraction, no build step, no validator system.
 *   - Consumed by two existing runtime paths:
 *       (a) `extractSonicTraits` in `consultation.ts` — when a pilot
 *           capsule exists for the brand, its curated `perceptionTraits`
 *           override the regex-extracted traits. This stops cross-
 *           attribution (e.g. Denafrips picking up "fast, precise
 *           timing" because its prose tendencies say "relaxed sense of
 *           timing").
 *       (b) `product-assessment.ts` — when `findBrandSiblings` returns
 *           empty AND a pilot capsule exists for the brand, the
 *           assessment uses the capsule's `mechanism` / `behavior` /
 *           `perceptionTraits` instead of falling through to "I don't
 *           have catalog data on the X." This is what unblocks
 *           Pass Labs (present in BRAND_PROFILES but absent from the
 *           product catalog).
 *
 * Out of scope:
 *   - Comparison guardrails as structured machinery (kept here as
 *     content but not yet routed into the comparison renderer).
 *   - All-brand coverage. Six pilot brands + Pass Labs only.
 *   - Multi-line capsule splits.
 *
 * Engineering-vs-domain boundary (per CLAUDE.md § 8):
 *   This module is domain-specific (audio brands, audio vocabulary).
 *   It lives in the adapter layer, not the engine. The engine's
 *   reasoning primitives consume the shape; the audio content sits
 *   here.
 */

export type PilotConfidence = 'high' | 'medium-high' | 'medium' | 'low';

export interface PilotCapsule {
  readonly brand: string;
  readonly aliases: ReadonlyArray<string>;
  readonly mechanism: string;
  readonly behavior: string;
  /**
   * Curated perception trait strings used as the canonical output of
   * `extractSonicTraits` when this capsule is matched. Each entry is a
   * complete phrase suitable for joining with ". " in display.
   */
  readonly perceptionTraits: ReadonlyArray<string>;
  readonly preferenceFit: string;
  readonly comparisonGuardrails: {
    readonly prefer: ReadonlyArray<string>;
    readonly avoid: ReadonlyArray<string>;
  };
  /**
   * Lowercase phrases that must not appear in synthesized output
   * about this brand. Checked by a thin guard in the comparison path;
   * a hit signals that the engine is about to regress on a v2-known
   * mischaracterization.
   */
  readonly protectedMischaracterizations: ReadonlyArray<string>;
  readonly confidence: {
    readonly mechanism: PilotConfidence;
    readonly behavior: PilotConfidence;
    readonly perception: PilotConfidence;
  };
}

const PILOT_LIST: ReadonlyArray<PilotCapsule> = [
  {
    brand: 'Denafrips',
    aliases: ['denafrips'],
    mechanism:
      'Discrete R2R ladder DAC with hand-selected resistor arrays; consistent house voicing across a graduated price line.',
    behavior:
      'Harmonic structure preserved across the conversion stage; transient leading edges shaped by analog-domain summing rather than chip-implementation filtering.',
    perceptionTraits: [
      'warm, dense, harmonically rich',
      'relaxed transient timing — softer leading edges than delta-sigma',
      'spatial presentation dimensional rather than precision-imaged',
    ],
    preferenceFit:
      'Listeners prioritising tonal weight and long-form listening continuity over analytical separation.',
    comparisonGuardrails: {
      prefer: [
        'Discrete R2R ladder conversion engineered for harmonic continuity vs measurement-forward delta-sigma engineering optimised for chip-implementation transparency',
        'R2R conversion with relaxed transient timing vs R2R conversion with dynamic engagement',
      ],
      avoid: [
        'warm vs cold',
        'rich vs thin',
        'precision vs musicality',
        'smooth vs detailed',
      ],
    },
    protectedMischaracterizations: [
      'fast, precise timing',
      'fast transient',
      'measurement-forward',
      'analytical',
      'lean',
      'neutral, clean',
    ],
    confidence: { mechanism: 'high', behavior: 'medium-high', perception: 'high' },
  },
  {
    brand: 'Topping',
    aliases: ['topping'],
    mechanism:
      'Measurement-forward delta-sigma DACs using premium chip implementations (ESS Sabre, AKM) with measurement-grade analog output stages.',
    behavior:
      'Measurement specifications at the upper end of the category — THD+N, SNR, dynamic range; analog output engineered to pass the chip signal with minimum coloration.',
    perceptionTraits: [
      'neutral, clean tonality',
      'high clarity, fast transient definition',
      'light tonal weight; low harmonic emphasis',
    ],
    preferenceFit:
      'Listeners prioritising measurement-class signal pass-through, often paired with bodied downstream electronics to compensate for the leanness.',
    comparisonGuardrails: {
      prefer: [
        'Measurement-forward delta-sigma signal-path transparency vs discrete R2R harmonic continuity',
        'Chip-implementation specification vs FPGA pulse-array timing',
      ],
      avoid: ['warm vs cold', 'precision vs musicality'],
    },
    protectedMischaracterizations: [
      'warm',
      'rich',
      'harmonically dense',
      'harmonically rich',
      'tonally dense',
      'dense, harmonically',
      'cold',
      'sterile',
      'detail-poor',
    ],
    confidence: { mechanism: 'high', behavior: 'high', perception: 'high' },
  },
  {
    brand: 'Goldmund',
    aliases: ['goldmund', 'goldmund / job', 'job'],
    mechanism:
      'Mechanically grounded chassis architecture with mechanical-energy dissipation across component mounts and inter-unit interfaces; low-feedback signal-path topology; transient-timing emphasis.',
    behavior:
      'Philosophy predicts cleaner transient leading edges and reduced mechanically-coupled modulation of the output stage; comparative measurement of these effects against alternative chassis approaches is under-documented in independent archives.',
    perceptionTraits: [
      'fast transient definition',
      'signal pass-through with low mechanically-coupled contribution',
      'tonally lean, controlled dynamics, low harmonic emphasis',
    ],
    preferenceFit:
      'Listeners prioritising transient speed and architectural composure; less aligned for listeners seeking tonal density at the amplifier stage.',
    comparisonGuardrails: {
      prefer: [
        'Mechanical-energy management and transient timing engineering vs class-A harmonic structure',
        'System-level architectural engineering vs measurement-spec engineering',
      ],
      avoid: ['analytical as character', 'rigid chassis as shorthand'],
    },
    protectedMischaracterizations: [
      'warm',
      'romantic',
      'tube-like',
      'rich',
      'harmonically dense',
      'lush',
      'cold as character',
    ],
    confidence: { mechanism: 'high', behavior: 'medium', perception: 'high' },
  },
  {
    brand: 'Naim',
    aliases: ['naim', 'naim audio'],
    mechanism:
      'Timing-domain emphasis through power-supply design and discrete circuit topology; tightly damped bass alignment in the integrated amplifiers.',
    behavior:
      'Transients arrive with consistent timing across the frequency range; bass damping is tight; temporal alignment between musical events is preserved.',
    perceptionTraits: [
      'propulsive and forward, tightly defined bass',
      'transient definition emphasised',
      'rhythmic momentum (PRaT) is the dominant axis',
    ],
    preferenceFit:
      'Listeners prioritising rhythmic momentum on rock, jazz, electronic material; less aligned for listeners prioritising spatial precision or tonal density.',
    comparisonGuardrails: {
      prefer: [
        'Timing-domain accuracy vs harmonic density',
        'PRaT engineering vs tube-coloration engineering',
      ],
      avoid: ['warm vs cold', 'British warmth framing'],
    },
    protectedMischaracterizations: [
      'warm',
      'smooth',
      'laid-back',
      'British warmth',
      'lush',
      'soft',
      'relaxed',
    ],
    confidence: { mechanism: 'medium-high', behavior: 'medium', perception: 'high' },
  },
  {
    brand: 'Harbeth',
    aliases: ['harbeth'],
    mechanism:
      'RADIAL polypropylene midrange driver with BBC-lineage cabinet philosophy (controlled cabinet contribution rather than maximum-rigidity); voicing target oriented to vocal accuracy.',
    behavior:
      'Midrange continuity across transients; relaxed transient leading edges through driver and cabinet behavior; treble extension constrained by the driver philosophy.',
    perceptionTraits: [
      'vocally accurate, tonally honest in the midrange',
      'smooth on transients (absence of edge)',
      'scale and dynamic headroom less than larger floorstanders',
    ],
    preferenceFit:
      'Listeners prioritising vocal reproduction and long-session midrange comfort; less aligned for listeners prioritising treble extension or large-scale dynamics.',
    comparisonGuardrails: {
      prefer: [
        'BBC-lineage midrange accuracy via RADIAL driver vs contemporary driver-stack imaging',
      ],
      avoid: ['boring', 'warm without specifier'],
    },
    protectedMischaracterizations: [
      'etched',
      'hyper-detailed',
      'analytical',
      'aggressive',
      'forward',
      'bright',
      'lean',
    ],
    confidence: { mechanism: 'high', behavior: 'high', perception: 'high' },
  },
  {
    brand: 'Shindo',
    aliases: ['shindo', 'shindo laboratory'],
    mechanism:
      'Per-circuit individual tube design with hand-wound transformers and point-to-point wiring; vintage / NOS tube selection per circuit.',
    behavior:
      'Harmonic saturation through tube circuit choice; transient leading edges shaped by tube character and transformer behavior; output power constrained by topology, requiring high-sensitivity speakers.',
    perceptionTraits: [
      'dense, harmonically saturated, physically present',
      'tonally weighted, relaxed transient timing',
      'long-form listening engagement',
    ],
    preferenceFit:
      'Listeners prioritising tonal density and harmonic saturation over measurement-class neutrality; system pairing with high-sensitivity speakers (90 dB+) is part of the design.',
    comparisonGuardrails: {
      prefer: [
        'Per-circuit hand-built tube design vs measurement-driven solid-state',
        'Per-circuit individual design vs integrated-system tube philosophy',
      ],
      avoid: ['generic warm tube amp framing'],
    },
    protectedMischaracterizations: [
      'neutral',
      'clinical',
      'measurement-first',
      'analytical',
      'transparent',
      'fast',
      'precise',
      'lean',
    ],
    confidence: { mechanism: 'high', behavior: 'medium', perception: 'high' },
  },
  {
    brand: 'Pass Labs',
    aliases: ['pass labs', 'pass', 'first watt', 'pass labs / first watt'],
    mechanism:
      'Class-A solid-state with low or zero feedback (Nelson Pass design lineage). Even-order harmonic content from class-A topology, contrasted with tube circuits.',
    behavior:
      'Class-A even-order harmonic content; transient response relaxed without being slow; harmonic structure full. The body is from class-A topology and harmonic structure, not from tube character.',
    perceptionTraits: [
      'dense (tonally weighted), harmonically natural',
      'relaxed transient response without being slow',
      'full harmonic structure, body without tube saturation',
    ],
    preferenceFit:
      'Listeners seeking tube-adjacent harmonic structure without tube maintenance. First Watt models pair with high-efficiency speakers; Pass flagship models drive a wide range.',
    comparisonGuardrails: {
      prefer: [
        'Class-A topology with low feedback vs high-current solid-state with feedback techniques',
        'Class-A harmonic structure vs tube harmonic saturation',
      ],
      avoid: ['warm vs neutral', 'tube-like without qualification'],
    },
    protectedMischaracterizations: [
      'warm',
      'tube-like',
      'measurement-first',
      'analytical',
      'lean',
      'sterile',
      'low-mid emphasis',
    ],
    confidence: { mechanism: 'high', behavior: 'high', perception: 'high' },
  },
  {
    // Source: BrandProfile.philosophy (consultation.ts:1040) — "hand-wired
    // tube amplifiers in the Japanese tradition… CS600X and CS300X use
    // push-pull KT77/KT88/EL34 topology with very low negative feedback…
    // Every unit is hand-assembled in Japan."
    // BrandProfile.tendencies (1041) — "warm, tonally dense, rhythmically
    // alive, and harmonically rich… surprising bass grip from the
    // KT77/KT88 push-pull topology."
    // BrandProfile.systemContext (1042) + pairing-resolver.ts:80
    // ("32 W is more than the 96-dB speaker ever needs") +
    // upgrade-path-content.ts:90 ("Midrange weight and texture over
    // transient attack; warm without being slow").
    // Source-discipline note: every field below traces verbatim or by
    // truncation to the above existing BrandProfile prose.
    // Confidence: behavior is 'medium-high' rather than 'high' because
    // the engineering→audible mapping is inferred from the existing
    // BrandProfile triangulation rather than independent measurement
    // archives — same pattern as Goldmund.
    brand: 'Leben',
    aliases: ['leben'],
    mechanism:
      'Hand-wired push-pull KT77 / KT88 / EL34 tube topology with very low negative feedback; small-scale Japanese hand-assembly per unit.',
    behavior:
      'Harmonic continuity and midrange presence shaped by push-pull tube topology; bass grip and rhythmic drive retained at low feedback through transformer behaviour and tube selection.',
    perceptionTraits: [
      'warm, tonally dense, rhythmically alive',
      'midrange weight and texture — voices and acoustic instruments with body',
      'surprising bass grip for a push-pull tube design',
    ],
    preferenceFit:
      'Listeners prioritising tube body and rhythmic drive on high-efficiency speakers (90 dB+); the 32 W CS600X is more than adequate at 96 dB. Less aligned for listeners seeking analytical separation or low-sensitivity speaker drive.',
    comparisonGuardrails: {
      prefer: [
        'Push-pull tube topology with low feedback vs single-ended triode (different harmonic profile, more bass grip)',
        'Hand-wired Japanese tube integrated vs solid-state precision designs',
      ],
      avoid: [
        'generic warm-tube framing — push-pull is not SET',
        'slow / dark — Leben retains rhythmic drive and bass grip',
      ],
    },
    protectedMischaracterizations: [
      'SET',
      'single-ended triode',
      'slow',
      'dark',
      'measurement-first',
      'analytical',
      'lean',
      'thin',
      'sluggish',
    ],
    confidence: { mechanism: 'high', behavior: 'medium-high', perception: 'high' },
  },
  {
    // Source: BrandProfile.philosophy (consultation.ts:1353) — "amplifiers
    // around their proprietary 'SoundEngine' technology — a patented
    // feed-forward error correction system… High damping factor, strong
    // speaker control, integrated streaming and DAC in many models. The
    // engineering prioritises measured accuracy and signal purity."
    // BrandProfile.tendencies (1354) — "controlled, composed, and neutral
    // to slightly cool… Strong macrodynamic authority with grip and slam.
    // Soundstage is structured, precise, and wide but flatter than tube
    // or low-feedback designs… fatigue may creep in with revealing
    // speakers."
    // BrandProfile.systemContext (1355) + pairingNotes (1356) — fatigue
    // is speaker-conditioned, not unconditional. upgrade-path-content.ts:64
    // — "Quiet, neutral Norwegian integrated. Raises grip and resolution
    // without altering the tonal balance of the chain."
    // Source-discipline note: perceptionTraits and behavior are direct
    // truncations from the above existing BrandProfile prose. The
    // "fatigue is speaker-dependent, not unconditional" guardrail is
    // sourced from BrandProfile.systemContext + pairingNotes nuance.
    // Confidence: same medium-high pattern on behavior as Leben — the
    // measurable→audible inference is prose-triangulated, not
    // independently archived.
    brand: 'Hegel',
    aliases: ['hegel'],
    mechanism:
      'Proprietary "SoundEngine" feed-forward error correction with high damping factor; integrated DAC and streaming on most models; engineering oriented to measured accuracy and signal purity.',
    behavior:
      'High damping factor delivers tight bass and strong load control across difficult speaker impedances; feed-forward correction removes audio-band distortion at the cost of a flatter, less time-domain-varied stage geometry than tube or low-feedback designs.',
    perceptionTraits: [
      'controlled, composed, neutral to slightly cool',
      'macrodynamic authority — grip and slam',
      'structured, precise imaging on a flatter stage than tube designs',
    ],
    preferenceFit:
      'Listeners prioritising bass control, dynamic authority, and integrated convenience (built-in DAC / streaming) on demanding speaker loads. Less aligned for listeners seeking tube body or long-session tonal warmth on already-revealing chains.',
    comparisonGuardrails: {
      prefer: [
        'High damping factor and feed-forward correction vs low-feedback or transformer-coupled topologies',
        'Integrated streaming / DAC convenience vs separates with discrete DAC',
      ],
      avoid: [
        'cold or sterile as character — fatigue is speaker-dependent, not unconditional',
        'analytical without specifier — the macrodynamic and bass-grip dimensions matter',
      ],
    },
    protectedMischaracterizations: [
      'cold',
      'sterile',
      'lifeless',
      'thin',
      'tube-like',
      'warm',
      'lush',
      'romantic',
    ],
    confidence: { mechanism: 'high', behavior: 'medium-high', perception: 'high' },
  },
];

/**
 * Build a lookup map keyed by every alias. Frozen so callers cannot
 * mutate at runtime.
 */
const ALIAS_INDEX: ReadonlyMap<string, PilotCapsule> = (() => {
  const m = new Map<string, PilotCapsule>();
  for (const cap of PILOT_LIST) {
    m.set(cap.brand.toLowerCase(), cap);
    for (const alias of cap.aliases) m.set(alias.toLowerCase(), cap);
  }
  return m;
})();

/**
 * Resolve a brand name (or product brand-name field) to its pilot
 * capsule, if any. Returns null when no pilot exists for the brand.
 *
 * Tolerant matching:
 *   - case-insensitive
 *   - trims surrounding whitespace
 *   - falls back to prefix-match on the first word ("pass" → Pass Labs)
 */
export function getPilotCapsule(brandName: string | null | undefined): PilotCapsule | null {
  if (!brandName) return null;
  const norm = brandName.trim().toLowerCase();
  if (!norm) return null;
  const exact = ALIAS_INDEX.get(norm);
  if (exact) return exact;
  // First-word fallback (e.g. "pass labs / first watt" → "pass labs")
  const firstWord = norm.split(/\s+/)[0];
  return ALIAS_INDEX.get(firstWord) ?? null;
}

/**
 * Check whether a synthesized output text contains a v2-known
 * mischaracterization for the named brand. Returns the offending
 * phrase if any, null otherwise. Used as a thin defensive guard at
 * the comparison-output edge.
 *
 * Caller is responsible for negation handling; this helper does
 * simple lowercase substring matching by design — it is a tripwire,
 * not a parser.
 */
export function findProtectedMischaracterization(
  brandName: string | null | undefined,
  outputText: string,
): string | null {
  const cap = getPilotCapsule(brandName);
  if (!cap) return null;
  const haystack = outputText.toLowerCase();
  for (const phrase of cap.protectedMischaracterizations) {
    if (haystack.includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}

/**
 * Number of pilot capsules. Useful for diagnostics and tests.
 */
export const PILOT_CAPSULE_COUNT = PILOT_LIST.length;
