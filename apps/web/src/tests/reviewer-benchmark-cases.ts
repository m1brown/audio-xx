/**
 * Audio XX — Reviewer Demonstration Benchmark Set · Phase A manifest.
 *
 * Why this exists:
 *   Reviewer-grade system interpretation needs a stable, named set of
 *   cases that:
 *     - lock the maturity gains from Phase 2.5 (emergent behavior +
 *       SYSTEM READ calibration + narrative softening) against
 *       regression,
 *     - provide curated screenshot demos for outreach to reviewers,
 *     - give a deterministic side-by-side surface for a future
 *       ChatGPT parity layer (Phase C).
 *
 *   This file is the manifest. The Playwright runner
 *   (`reviewer-benchmark.spec.ts`) drives each case through the chat
 *   UI and captures evidence. The vitest regression test
 *   (`__tests__/reviewer-benchmark-regression.test.ts`) asserts the
 *   marker contract at the `buildSystemAssessment` boundary so the
 *   tier-regression cases gate CI.
 *
 * Boundaries (locked):
 *   - benchmark / harness layer only.
 *   - no engine changes, no emergent transform changes, no MemoFindings
 *     changes, no product-catalog expansion, no scraping.
 *   - REPRESENTATIVE-only — reviewer-flavor cases are fictional and
 *     marked as such. Not attributed to any reviewer's actual personal
 *     system.
 *
 * Engineering-vs-domain boundary:
 *   This file is adapter / configuration data. Audio-domain vocabulary
 *   (brands, axes, topology terms) lives here; the runner and the
 *   regression test consume it without re-encoding domain knowledge.
 */

export type BenchmarkTier = 'demo' | 'regression' | 'qualitative';

export interface BenchmarkChainEntry {
  brand: string;
  name: string;
  role: 'streamer' | 'dac' | 'integrated' | 'amplifier' | 'preamp' | 'power-amp' | 'speaker' | 'headphone' | 'turntable' | 'cartridge';
}

export interface BenchmarkMarkers {
  /** Substrings (case-insensitive) that MUST appear in the response. */
  mustContain: string[];
  /** Substrings (case-insensitive) that MUST NOT appear in the response. */
  mustNotContain: string[];
  /** Required section labels (matched case-insensitively, header form). */
  minSections?: string[];
}

/**
 * Expected resolution outcome from buildSystemAssessment. Some cases
 * exercise brands whose specific products are not yet in the catalog
 * (e.g. Audio Note) — the assessment function returns null and the
 * regression test asserts on the SKIP behavior rather than markers.
 * When products ARE catalogued the value is 'assessment'.
 */
export type ResolutionExpectation = 'assessment' | 'uncatalogued-skip';

export interface BenchmarkCase {
  /** kebab-case identifier — used for artifact directory and test filtering. */
  id: string;
  /** Display name shown in reports. */
  systemName: string;
  /** Component chain — order matters; runner concatenates into the prompt. */
  chain: BenchmarkChainEntry[];
  /** 1–2 sentences: what the curator intends this system to optimize for. */
  intendedPhilosophy: string;
  /** 1–2 sentences: the failure mode this case proves Audio XX avoids. */
  whatBadAIGetsWrong: string;
  /** 1–2 sentences: a reviewer-grade interpretation of the system. */
  expertInterpretation: string;
  prompts: {
    /** Primary prompt — first turn. */
    primary: string;
    /** Optional follow-up prompts — additional turns. */
    followups: string[];
  };
  expectedMarkers: BenchmarkMarkers;
  /**
   * Whether buildSystemAssessment is expected to return a full
   * assessment ('assessment') or to return null because the chain's
   * products aren't catalogued ('uncatalogued-skip'). When
   * 'uncatalogued-skip' the regression test verifies the skip without
   * applying marker assertions — graceful degradation is the contract.
   */
  resolutionExpectation: ResolutionExpectation;
  tier: BenchmarkTier;
  demoSuitability: 'primary' | 'secondary' | 'no';
  /**
   * Path under `apps/web/src/tests/fixtures/chatgpt-baselines/`, relative
   * — left empty in Phase A. Wired in Phase C.
   */
  chatgptBaselinePath?: string;
  /**
   * Confidentiality / attribution notes. All reviewer-flavor cases must
   * carry the "REPRESENTATIVE" disclaimer here.
   */
  notes?: string;
}

// ── Phase A — 4 regression-tier cases ──────────────────────────────

const MY_SYSTEM: BenchmarkCase = {
  id: 'my-system',
  systemName: 'My System',
  chain: [
    { brand: 'Eversolo', name: 'DMP-A6', role: 'streamer' },
    { brand: 'Chord', name: 'Hugo', role: 'dac' },
    { brand: 'JOB', name: 'Integrated', role: 'integrated' },
    { brand: 'WLM', name: 'Diva Monitor', role: 'speaker' },
  ],
  intendedPhilosophy:
    'A speed-and-elasticity chain: FPGA timing precision feeding a low-feedback Goldmund-derived integrated into a high-efficiency paper-cone monitor. Speed becomes expressive dynamics rather than analytical edge.',
  whatBadAIGetsWrong:
    'Flat-aggregates the chain as "fast + fast + warm speaker = lean system corrected by the speaker." Misses that the contrast is intentional voicing — the speaker is contributing body and dynamic release, not rescuing leanness.',
  expertInterpretation:
    'Specialist pairing in the SET/horn lineage tradition translated to solid-state: low-friction upstream feeds high-efficiency downstream, dynamics stay elastic and present, midrange carries body without the chain getting in the way.',
  prompts: {
    primary: 'Assess my system: Eversolo DMP-A6, Chord Hugo, JOB Integrated, WLM Diva Monitor',
    followups: [],
  },
  expectedMarkers: {
    mustContain: [
      'speed is converted into elastic motion',
      'deliberately voiced together',
      'intentionally speed-forward',
      'adding body, warmth, and dynamic release',
      'adds body while preserving speed and flow',
      'deliberate balance of',
      'Current setup excels at speed, flow, and immediacy',
      // Phase C Calibration Pass 1 — listener identity + system philosophy.
      // Pass 1 wording refinement (2026-05-14): descriptive list form,
      // no oppositional "X over Y" framing.
      'This system reflects a listener drawn to timing precision, elasticity, and dynamic immediacy',
      'This system is organized around immediacy, elasticity, and musical communication',
    ],
    mustNotContain: [
      'supplying all of the warmth',
      'unless the speaker compensates',
      'prevents thinness',
      'alone restores weight',
      'unless corrected',
      'careful compensation',
      'exposes thinness',
      // Negative-control thesis must NOT fire on the synergy case.
      'This system is built around composure, precision, and low-noise resolution',
    ],
    minSections: ['System read', 'Emergent behavior', 'System logic', 'Decision', 'Do nothing check'],
  },
  resolutionExpectation: 'assessment',
  tier: 'regression',
  demoSuitability: 'primary',
  chatgptBaselinePath: 'my-system.md',
  notes:
    'Calibration anchor. The full Phase 2.5 narrative (SYSTEM READ → EMERGENT BEHAVIOR → SYSTEM LOGIC → Decision/Trade-offs/Do nothing) reads in synergy mode end to end.',
};

const LEBEN_DEVORE: BenchmarkCase = {
  id: 'leben-devore',
  systemName: 'Leben CS600X + DeVore O/96',
  chain: [
    // A 3-component representation of the canonical pairing. The system
    // name uses the headline pairing (amp + speaker) but the chain
    // includes a representative R2R source so the assessment exercises
    // the full evaluation pipeline.
    { brand: 'Denafrips', name: 'Pontus II', role: 'dac' },
    { brand: 'Leben', name: 'CS600X', role: 'integrated' },
    { brand: 'DeVore', name: 'O/96', role: 'speaker' },
  ],
  intendedPhilosophy:
    'Canonical push-pull tube + high-efficiency floorstander pairing, fed by an R2R source. Harmonic continuity from source through tubes into a paper-cone speaker — body, density, and rhythmic engagement over analytical precision.',
  whatBadAIGetsWrong:
    'Misses the celebrated authored pairing, treats the chain as a generic "warm system" recommendation. Or worse — flags low amplifier power as a constraint when the speaker is 96 dB sensitive.',
  expertInterpretation:
    'One of the most celebrated modern pairings — push-pull tube voicing into a high-efficiency design that asks for body without overdoing it. The R2R source extends the harmonic-continuity story upstream.',
  prompts: {
    primary: 'Assess my system: Denafrips Pontus II, Leben CS600X, DeVore O/96',
    followups: [],
  },
  expectedMarkers: {
    // Empirically verified against buildSystemAssessment 2026-05-14:
    // SYSTEM READ reads as "warmth-first ... reinforced by" (all three
    // components warm-leaning, !hasContrast → calibration override does
    // NOT fire). Emergent behavior DOES fire because architecture matches
    // R2R DAC + tube amp + high-efficiency speaker.
    mustContain: [
      // Brands surface by name.
      'Leben',
      'DeVore',
      'Denafrips',
      // Emergent behavior fires for this canonical specialist chain.
      'Emergent behavior',
      // The high-efficiency speaker is recognised.
      'high-efficiency driver',
      // Phase C Calibration Pass 1 — listener identity + system philosophy.
      // Pass 1 wording refinement (2026-05-14): descriptive list form,
      // no oppositional "X over Y" framing.
      'This system reflects a listener drawn to harmonic density, tonal continuity, and timbral depth',
      'This system is organized around harmonic restraint, smoothness, and unforced presence',
    ],
    mustNotContain: [
      // Power-mismatch language MUST NOT fire — 32 W push-pull into a
      // 96 dB speaker is well-matched.
      'significantly underpowered',
      'has limited headroom',
      'Dynamic compression and loss of bass control',
      // Corrective compensation framing — must NOT appear because the
      // system reads as aligned-warmth, not as contrast needing rescue.
      'unless corrected',
      'careful compensation',
      'alone restores weight',
      // Negative-control thesis must NOT fire on a synergy case.
      'This system is built around composure, precision, and low-noise resolution',
    ],
    minSections: ['System read', 'Emergent behavior', 'System logic'],
  },
  resolutionExpectation: 'assessment',
  tier: 'regression',
  demoSuitability: 'primary',
  chatgptBaselinePath: 'leben-devore.md',
  notes:
    'Canonical authored pairing — pairing-resolver capsule for DeVore O/96 lists Leben CS600X as the canonical match. Demonstrates that Audio XX recognises a specialist tube-and-horn chain via topology + architecture data. The pairing-capsule prose ("Canonical pairing. The CS600X push-pull topology preserves DeVore\'s tonal density without overdoing it") fires only in the comparison flow, not the system-assessment flow — both flows reach the same underlying knowledge but render it differently.',
};

const AUDIO_NOTE_COHERENT: BenchmarkCase = {
  id: 'audio-note-coherent',
  systemName: 'Audio Note coherent system',
  chain: [
    // A single-brand chain — tests deliberateness detection on a system
    // designed and voiced as a whole. Audio Note UK's typical full chain
    // pattern: CDT → DAC → SET integrated → high-efficiency speaker.
    { brand: 'Audio Note', name: 'DAC 2.1x Signature', role: 'dac' },
    { brand: 'Audio Note', name: 'OTO SE', role: 'integrated' },
    { brand: 'Audio Note', name: 'AN-E', role: 'speaker' },
  ],
  intendedPhilosophy:
    'A holistic SET-anchored chain voiced as a single system: NOS DAC feeding a single-ended triode integrated into a high-efficiency speaker designed to be driven by exactly this kind of amp. Tonal density, midrange luminosity, harmonic continuity throughout.',
  whatBadAIGetsWrong:
    'Treats it as three independent components and flags low SET power as a universal constraint, missing that AN-E is voiced for low-power tube drive. Or applies modern measurement criteria to a system optimised for harmonic perception.',
  expertInterpretation:
    'The single-philosophy system: every link in the chain commits to the same priorities. Architectural coherence reads as harmonic continuity, midrange luminosity, and effortless dynamic ease at moderate listening levels.',
  prompts: {
    primary: 'Assess my system: Audio Note DAC 2.1x Signature, Audio Note OTO SE, Audio Note AN-E',
    followups: [],
  },
  expectedMarkers: {
    // No marker assertions when resolutionExpectation is
    // 'uncatalogued-skip' — the contract is graceful degradation, not
    // narrative content. The vitest test verifies result is null /
    // non-assessment and that the system did not invent product details.
    mustContain: [],
    mustNotContain: [],
  },
  // Audio Note has a brand profile but no specific products in the
  // catalog as of 2026-05-14. buildSystemAssessment returns null. The
  // regression test asserts the SKIP behavior — graceful degradation
  // is the contract, not invented product details. Playwright will
  // exercise the UI's clarification fallback (qualitative tier only).
  resolutionExpectation: 'uncatalogued-skip',
  tier: 'regression',
  demoSuitability: 'secondary',
  notes:
    'REPRESENTATIVE — not attributed to any reviewer\'s actual personal system. Tests that single-philosophy single-brand chains are handled gracefully when products are uncatalogued. When Audio Note products are added to the catalog later this case auto-upgrades to a marker-asserting case (change resolutionExpectation to "assessment" and add the expected NOS/SET/single-ended markers).',
};

const MODERN_PRECISION_CONTROL: BenchmarkCase = {
  id: 'modern-precision-control',
  systemName: 'Modern precision control (negative case)',
  chain: [
    // The "must NOT produce intentional-synergy framing" control. All
    // three components lean toward measurement-led precision; aligned
    // direction, not a specialist pairing.
    { brand: 'Topping', name: 'D90SE', role: 'dac' },
    { brand: 'Hegel', name: 'H190', role: 'integrated' },
    { brand: 'KEF', name: 'LS50 Meta', role: 'speaker' },
  ],
  intendedPhilosophy:
    'A measurement-led modern chain: clean delta-sigma source, high-damping integrated, precision two-way monitor. Detail, control, spatial accuracy.',
  whatBadAIGetsWrong:
    'Generates synergy framing it has no basis for — or produces a "diagnose what is wrong with this clean system" assessment when nothing is broken. Both fail Phase 2.5\'s confidence-calibration test.',
  expertInterpretation:
    'A coherent precision-led system. Three components reinforcing the same architectural priorities. Not specialist-voiced, but internally consistent — Audio XX should describe it as such without forcing emergent synergy onto it.',
  prompts: {
    primary: 'Assess my system: Topping D90SE, Hegel H190, KEF LS50 Meta',
    followups: [],
  },
  expectedMarkers: {
    // Empirically verified 2026-05-14: the system reads as "detail-first
    // ... with KEF adding definition. Clarity, timing, and spatial
    // precision dominate unless the speaker compensates." Emergent
    // behavior does NOT fire (no synergy transforms match).
    mustContain: [
      'Topping',
      'Hegel',
      'KEF',
      // The non-synergy corrective wording is preserved (negative-control
      // confirms calibration is gated, not blanket-applied).
      'unless the speaker compensates',
      // Phase C Calibration Pass 1 — negative-control identity + thesis.
      // Must produce a DISTINCT identity+thesis pair from the synergy cases.
      // Pass 1 wording refinement (2026-05-14): descriptive list form,
      // no oppositional "X over Y" framing.
      'This system reflects a listener drawn to composure, articulation, and dynamic control',
      'This system is built around composure, precision, and low-noise resolution',
    ],
    mustNotContain: [
      // The Phase 2.5 intentional-synergy markers MUST NOT fire.
      'speed is converted into elastic motion',
      'deliberately voiced together',
      'intentionally speed-forward',
      'adding body, warmth, and dynamic release',
      'adds body while preserving speed and flow',
      'deliberate balance of',
      'Current setup excels at speed, flow, and immediacy',
      'low-friction output',
      // No emergent paragraph for this aligned-precision chain.
      'Emergent behavior',
      // Phase C: synergy-case identities/theses must NOT fire here.
      'drawn to timing precision, elasticity, and dynamic immediacy',
      'drawn to harmonic density, tonal continuity, and timbral depth',
      'organized around harmonic restraint, smoothness, and unforced presence',
      'organized around immediacy, elasticity, and musical communication',
    ],
    minSections: ['System read', 'System logic'],
  },
  resolutionExpectation: 'assessment',
  tier: 'regression',
  demoSuitability: 'no',
  notes:
    'Negative control — confirms intentional-synergy framing is gated on the synergy transforms firing, not blanket-applied to all systems.',
};

// ── Manifest export ────────────────────────────────────────────────

export const BENCHMARK_CASES: ReadonlyArray<BenchmarkCase> = [
  MY_SYSTEM,
  LEBEN_DEVORE,
  AUDIO_NOTE_COHERENT,
  MODERN_PRECISION_CONTROL,
];

/** Filter helpers — small and explicit. */
export function regressionCases(): ReadonlyArray<BenchmarkCase> {
  return BENCHMARK_CASES.filter((c) => c.tier === 'regression');
}

export function demoCases(suitability: 'primary' | 'secondary' = 'primary'): ReadonlyArray<BenchmarkCase> {
  return BENCHMARK_CASES.filter((c) => c.demoSuitability === suitability);
}
