/**
 * Audio XX — Topology / Philosophy Knowledge Layer (Phase 2).
 *
 * Why this exists:
 *   The system handles brand-named queries well ("Why do people describe
 *   Chord DACs as precise?" surfaces the Chord brand profile). It fails on
 *   topology-only queries ("Why do R2R DACs sound denser?", "What is BBC
 *   thin-wall cabinet philosophy?") because there is no companion data
 *   structure for engineering abstractions — only brands.
 *
 *   This module is the companion. Each entry is an authored capsule
 *   covering the mechanism → behavior → perception chain for one design
 *   tradition, plus pairing implications and common misconceptions. The
 *   register is deliberately specialist (6moons / Twittering Machines /
 *   experienced designer), NOT generic-AI tutorial prose.
 *
 *   Scope (smallest safe):
 *     - Authored data only; no LLM generation, no scraping.
 *     - Topologies covered: R2R, NOS, FPGA, delta-sigma, SET, push-pull
 *       tube, Class A solid-state, low-feedback, horn / high-efficiency
 *       speakers, BBC thin-wall monitor philosophy.
 *     - Resolver: keyword/phrase match into the capsule set.
 *     - One renderer-side helper (`buildTopologyExplainer`) for callers
 *       that want a deterministic prose summary.
 *
 *   Out of scope (deferred):
 *     - Full UI / modal architecture.
 *     - Expandable glossary system.
 *     - LLM rewriting of capsules.
 *     - Per-product topology cross-references (catalog entries already
 *       have `topology` fields; that linkage is fine as-is).
 *
 * Engineering-vs-domain boundary (CLAUDE.md §8):
 *   This is adapter / domain-layer content. It must NOT be imported by
 *   the engine reasoning modules. Render-layer code (consultation.ts,
 *   advisory-response.ts, page.tsx response builders) is the intended
 *   consumer. The data structure itself contains no audio reasoning —
 *   the audio reasoning is the prose text in each field. The shape is
 *   portable: any other domain (climate, finance) could populate it with
 *   their own topology equivalents.
 */

export type TopologyId =
  | 'r2r'
  | 'nos-dac'
  | 'fpga'
  | 'delta-sigma'
  | 'set'
  | 'push-pull-tube'
  | 'class-a-solid-state'
  | 'low-feedback'
  | 'horn-high-efficiency'
  | 'bbc-thin-wall';

export interface TopologyCapsule {
  id: TopologyId;
  /** Canonical display label — short, no marketing fluff. */
  label: string;
  /**
   * Aliases / phrases that should resolve to this capsule.
   * Lowercased, matched as substrings against the input text.
   * Order matters: longest / most specific first.
   */
  aliases: ReadonlyArray<string>;
  /** Engineering mechanism in 2–3 sentences. Causal, not aspirational. */
  mechanism: string;
  /** What the design trades to achieve its mechanism. Two sides explicit. */
  tradeoffs: string;
  /** Measurable / observable engineering tendencies that follow. */
  behavior: string;
  /** How those tendencies typically surface to a listener. */
  perception: string;
  /** Common misreadings or marketing-driven misconceptions, named directly. */
  misconceptions: string;
  /** Pairing implications: what upstream / downstream choices reinforce or fight the topology. */
  pairingImplication: string;
  /**
   * Canonical examples — three or fewer well-known products / brands that
   * exemplify the topology in its most coherent form. Not exhaustive.
   */
  canonicalExamples: ReadonlyArray<string>;
}

/**
 * Topology capsules. Authored in specialist register: no "in conclusion",
 * no "interestingly", no "many audiophiles believe". Each capsule reads
 * like a private-advisor short brief.
 */
const TOPOLOGY_CAPSULES: ReadonlyArray<TopologyCapsule> = [
  // ── R2R ladder DACs ─────────────────────────────────────
  {
    id: 'r2r',
    label: 'R2R ladder DAC',
    aliases: ['r2r ladder', 'r-2-r ladder', 'r-2-r', 'r-2r', 'r2r dac', 'r2r', 'ladder dac', 'discrete ladder', 'resistor ladder'],
    mechanism: 'A resistor ladder network converts the digital code directly to an analog voltage in one step per sample. Each bit corresponds to a physical resistor; the conversion is the resistor sum, not a noise-shaped pulse stream.',
    tradeoffs: 'The bit depth is bounded by resistor matching tolerance — real R2R designs sit at ~20 bits of effective resolution rather than chasing the 24-bit measurement bar. The gain is a flat, low-aliasing impulse response and a reconstruction filter that can be very short or skipped entirely.',
    behavior: 'Linear conversion, low correlated noise above the audio band, low rate of dynamic glitch on transient onsets. Reconstruction filter ringing — endemic to long-tap sigma-delta — is absent or minimal.',
    perception: 'Tonal density, midrange weight, a sense that instruments occupy a physical volume rather than a spectrogram. Listeners typically describe R2R as denser and less etched than delta-sigma at the same resolving power. Time-domain naturalness — note attack and decay sound continuous — is the recurring observation.',
    misconceptions: 'R2R is not slow. The "warmth" listeners hear is not a treble roll-off; it is the absence of the high-frequency dither and filter ringing that delta-sigma designs introduce. Conversely, R2R does not measure as cleanly as a top-tier sigma-delta — that is by design, and chasing the SINAD number defeats the point.',
    pairingImplication: 'R2R pairs naturally with revealing, neutral amplification. A lean or analytical amplifier downstream is needed to balance the topology\'s inherent density. Compounding R2R with already-warm tube amplification can push tonality past natural.',
    canonicalExamples: ['Denafrips Pontus / Terminator', 'Holo Audio May / Spring', 'TotalDAC d1-twelve', 'MHDT Orchid', 'Rockna Wavelight'],
  },
  // ── NOS (non-oversampling) DACs ─────────────────────────
  {
    id: 'nos-dac',
    label: 'NOS (non-oversampling) DAC',
    aliases: ['nos dac', 'nos-dac', 'non-oversampling dac', 'nos conversion', 'non oversampling', 'non-oversampling'],
    mechanism: 'The DAC outputs one sample per input sample with no upsampling or digital reconstruction filter. The analog stage handles the reconstruction by virtue of its bandwidth limit — typically a gentle first-order roll-off.',
    tradeoffs: 'Treble extension above ~10kHz softens (the sinc-function image is not corrected). What is gained: no pre-ringing, no time smear from the long-tap FIR filter, an impulse response that resembles the original sample edge.',
    behavior: 'Audible top-octave roll-off measurable at the analog output. Time-domain coherence very high — leading edges are unsmeared. Out-of-band imaging energy higher than oversampled designs (analog output filter does the work).',
    perception: 'Forward-of-the-band-center tonal balance, vivid presence-region body, instrument attack that "starts" without the slight pre-echo of typical oversampled designs. The treble can read as polite rather than airy — preferred by listeners who tire of high-frequency etch and image-shimmer.',
    misconceptions: 'NOS does not improve measurable distortion or SNR. The case for NOS is purely time-domain. Pairing it with a sample-rate convertor upstream defeats the entire architectural point.',
    pairingImplication: 'Best with high-resolution sources and revealing amplification — the topology\'s slight treble softness gives the downstream chain room to express upper-band detail without compounding etch. Tube buffers in the analog stage are coherent with the philosophy (Lampizator, MHDT Orchid).',
    canonicalExamples: ['MHDT Orchid', 'Audio Note DAC 1.x–5.x', 'Border Patrol DAC', 'Lampizator Baltic 5'],
  },
  // ── FPGA-based DACs ─────────────────────────────────────
  {
    id: 'fpga',
    label: 'FPGA-based DAC',
    aliases: ['fpga dac', 'fpga-based', 'fpga based', 'fpga reconstruction', 'pulse array dac', 'pulse-array', 'pulse array', 'fpga'],
    mechanism: 'Reconstruction is implemented in programmable logic with a very long FIR filter (tens of thousands of taps in flagship designs). The "DAC chip" is the FPGA itself plus a small analog smoothing stage; no off-the-shelf converter is involved.',
    tradeoffs: 'Tap-length and filter design become the dominant design variables, not chip vendor. Designs can be tuned to optimize either time-domain or frequency-domain accuracy but cannot maximize both simultaneously.',
    behavior: 'Pre-ringing and post-ringing of the reconstruction filter become audible design choices. Designs with longer tap-length produce sharper transient edges at the cost of higher pre-ring. Phase response is essentially flat in the audio band.',
    perception: 'Articulate transient onsets, precise stereo image placement, a "fast" presentation that highlights leading edges of percussive material. Listeners describe FPGA designs as articulate and precise rather than dense. Tonal weight tends to be lighter than R2R at comparable price tiers.',
    misconceptions: 'FPGA is not inherently more accurate than R2R — it is differently accurate. The "tap count" marketing number is meaningful only within a comparable filter topology. Chord and PS Audio FPGA implementations sound quite different despite using the same general approach.',
    pairingImplication: 'Pairs well with warm or tonally dense amplification — the source-level clarity cuts through added warmth rather than being masked. In systems already biased toward precision, FPGA at the source level can compound leanness.',
    canonicalExamples: ['Chord Qutest / Hugo TT2 / Dave', 'PS Audio DirectStream', 'Rockna Wavelight (hybrid)'],
  },
  // ── Delta-sigma DACs ────────────────────────────────────
  {
    id: 'delta-sigma',
    label: 'Delta-sigma DAC',
    aliases: ['delta-sigma', 'delta sigma', 'sigma-delta', 'sigma delta', 'ess sabre', 'akm dac', 'cs sabre', 'cirrus sabre'],
    mechanism: 'A 1-bit noise-shaped modulator runs at many MHz and feeds a multi-bit decimation filter. The DAC chip — typically an ESS, AKM, or Cirrus part — handles both noise shaping and reconstruction internally.',
    tradeoffs: 'Very high measured linearity and dynamic range (SINAD figures north of 120 dB are routine). The cost is correlated high-frequency dither energy that the analog output filter must reject, plus a long-tap reconstruction filter that imposes pre- and post-ringing on transients.',
    behavior: 'Best-in-class measured noise floor and harmonic distortion in the audio band. High-frequency content above the audio band is correlated and meaningful — amplifier ultrasonic stability matters. Transient response can vary widely by filter selection.',
    perception: 'Clean, neutral, precise. Listeners who prefer delta-sigma describe it as honest and unflattering — the recording is presented without character addition. Listeners who do not, describe the same presentation as etched or analytical.',
    misconceptions: 'High SINAD numbers do not translate linearly into listener preference. Some of the most measurably perfect delta-sigma implementations are also the ones listeners describe as fatiguing. Filter choice (linear-phase vs. minimum-phase, sharp vs. slow roll-off) often matters more than chip selection.',
    pairingImplication: 'Pairs well with warm amplification and forgiving speakers — the source already supplies precision. In systems also tuned for precision (Class D, lean monitors, high-feedback amps), the cumulative leanness becomes audible.',
    canonicalExamples: ['Topping D90 / E70', 'RME ADI-2', 'Benchmark DAC3', 'Schiit Modi (entry-tier)'],
  },
  // ── SET / Single-Ended Triode amplification ─────────────
  {
    id: 'set',
    label: 'Single-ended triode (SET) amplifier',
    aliases: ['single-ended triode', 'set amplifier', 'set amp', 'single ended', 'set design', '2a3 amp', '300b amp', '45 amp', '45 triode', 'triode amp', 'set'],
    mechanism: 'A single output triode (45, 2A3, 300B, 211, 845) operates in pure Class A. The output stage has no phase inverter and no push-pull symmetry — the tube alone modulates the output transformer.',
    tradeoffs: 'Power output is limited (2–25 W typical) and even-order harmonic distortion is high (1–3 % at full output is normal). The gain is exceptional second-harmonic spectrum, low odd-order distortion, and the most direct signal path possible in a tube design.',
    behavior: 'Output impedance is high (damping factor often below 5), so loudspeaker frequency response interacts with the amplifier output curve. Crossover distortion is absent. Distortion spectrum is dominated by H2 and H3 with negligible higher orders.',
    perception: 'Midrange luminosity, tonal richness, instrument body. The even-order harmonic structure psychoacoustically reinforces the fundamental, producing the perceived "tonal magic" SET listeners describe. Treble extension and bass control are weaker than push-pull or solid-state designs in the same generation.',
    misconceptions: 'SET is not always rolled-off in the highs — a well-designed output transformer (Tango, Tamura, hashimoto) can deliver extension well past 30 kHz. SET also is not "low distortion" — the H2 dominance is itself the trade. Treating SET as universally superior misses its dependence on speaker pairing.',
    pairingImplication: 'Requires speakers of 93 dB sensitivity or higher in most rooms, and impedance curves that stay stable (high-efficiency single-driver or horn designs). A 4-ohm dip in the impedance curve combined with a low-damping-factor SET produces frequency response anomalies.',
    canonicalExamples: ['Yamamoto A-08S', 'Shindo Cortese / Latour', 'Fi 2A3 / 300B', 'Audion / Audio Note SET line', 'ampsandsound SET designs'],
  },
  // ── Push-pull tube amplification ────────────────────────
  {
    id: 'push-pull-tube',
    label: 'Push-pull tube amplifier',
    aliases: ['push-pull tube', 'push pull tube', 'push-pull amp', 'push pull amp', 'kt88 amp', 'kt77 amp', 'el34 amp', 'push-pull', 'push pull'],
    mechanism: 'Two output tubes (pentodes, beam tetrodes, or triode-strapped pentodes) operate in anti-phase, with a phase splitter feeding them. Even-order harmonic distortion from the two halves cancels in the output transformer, while odd-order distortion adds.',
    tradeoffs: 'Higher output power than SET (15–100 W typical) and lower distortion at moderate levels. The cost is an output spectrum dominated by H3 / H5 rather than the H2-rich SET signature, and a more complex signal path including the phase splitter.',
    behavior: 'Output impedance moderate (damping factor 5–20 typical with ultralinear operation). Distortion rises gradually with output level. Phase splitter linearity becomes a significant design variable.',
    perception: 'Better dynamic range and bass control than SET; rhythmic conviction and macro-dynamic authority. The midrange is still tube-voiced — harmonic density and tonal weight remain — but with more drive and less "luminous" character. Tube rolling (KT77 vs. KT88 vs. EL34) audibly shifts voicing within the same chassis.',
    misconceptions: 'Push-pull is not simply "more powerful SET." The harmonic spectrum is fundamentally different. Designers who push-pull SET tubes (e.g. parallel 2A3) are seeking a hybrid character, not "more SET."',
    pairingImplication: 'Compatible with a wider speaker range than SET — sensitivity from 88 dB up is typical. Pairs especially well with BBC-lineage monitors (Harbeth, Spendor Classic) where the push-pull voicing complements the speaker\'s mid-band warmth without overdoing it.',
    canonicalExamples: ['Leben CS300 / CS600X', 'PrimaLuna EVO 300', 'Rogue Cronus Magnum III', 'Air Tight ATM-1 / ATM-3'],
  },
  // ── Class A solid-state ─────────────────────────────────
  {
    id: 'class-a-solid-state',
    label: 'Class A solid-state amplifier',
    aliases: ['class a solid state', 'class a amplifier', 'class a amp', 'class-a solid-state', 'pure class a', 'class a'],
    mechanism: 'Output transistors conduct continuously through the full signal cycle (no cut-off, no crossover). Bias current is set high enough that the output device never approaches its non-linear region during normal program material.',
    tradeoffs: 'Heat and current consumption are very high (the amplifier draws full bias regardless of output). The gain is a linear region of operation that the signal stays inside at all times, eliminating the crossover-distortion artifact that defines Class AB.',
    behavior: 'No crossover distortion. Even-order harmonics tend to dominate the residual distortion spectrum (especially in single-ended or low-feedback configurations). Output impedance can be designed low without the high feedback usually required in Class AB.',
    perception: 'A density and harmonic weight reminiscent of tube designs without tube maintenance or output-transformer rolloff. Listeners frequently describe Class A solid-state as "tube-adjacent" — body and weight in the midrange, with greater bass control than typical SET. Heat is a real ergonomic consideration.',
    misconceptions: 'Class A is not a marketing label. A genuine Class A design dissipates roughly twice its rated output continuously. Many "Class A" amplifiers are Class A only for the first few watts and transition to Class AB above that — a meaningful but distinct design.',
    pairingImplication: 'Drives a wide range of speakers (output stage is more authoritative than tube). Particularly coherent with R2R or NOS sources where the topology adds body without compounding leanness. Heat-sensitive rooms and small apartments are real constraints.',
    canonicalExamples: ['Pass Labs XA series', 'First Watt SIT-3 / J2 / F7', 'Sugden A21SE', 'Accuphase E-series (partial Class A)'],
  },
  // ── Low-feedback design philosophy ──────────────────────
  {
    id: 'low-feedback',
    label: 'Low-feedback (or zero-feedback) amplifier design',
    aliases: ['low-feedback', 'low feedback', 'zero-feedback', 'zero feedback', 'no feedback', 'no negative feedback', 'low-nfb', 'feedback design'],
    mechanism: 'The amplifier is designed with no global negative feedback loop, or with a very small loop gain (1–6 dB rather than 20–60 dB). Linearity comes from device selection and operating-point choice rather than feedback correction.',
    tradeoffs: 'Open-loop distortion is much higher (typically 0.5–3% rather than 0.001%) and damping factor is lower. The gain is freedom from transient intermodulation distortion (TIM), better behavior on complex musical material, and a distortion spectrum dominated by low-order harmonics rather than higher-order products.',
    behavior: 'Damping factor in the single or low double digits. Slew rate is naturally adequate without the compensation networks high-feedback designs require. Stability margin sets the upper bound on bandwidth.',
    perception: 'A relaxed, unforced presentation. The "tense" or "edgy" character of some high-feedback designs is absent. Listeners describe low-feedback amplifiers as breathing more naturally on complex passages — orchestral crescendos, dense electronic textures — without the audible flattening some high-feedback designs exhibit at the threshold of clipping.',
    misconceptions: 'Low-feedback does not mean "high distortion is good." It means the topology accepts more low-order distortion in exchange for never closing a fast loop around the signal. Designers who chase zero feedback for marketing reasons without supporting linearity through device selection produce amplifiers that sound exactly as bad as the distortion numbers suggest.',
    pairingImplication: 'Speaker pairing matters more — the low damping factor interacts audibly with impedance curves. High-sensitivity speakers with stable impedance (single-driver, classic two-way, horn) are ideal. Mating low-feedback to a complex 4-ohm-dip multi-way speaker is fighting the design.',
    canonicalExamples: ['Nelson Pass / Pass Labs (low-feedback line)', 'Audio Note UK amps', 'Shindo Cortese', 'Naim NAP series (Naim\'s sliding-bias topology with very low loop gain)'],
  },
  // ── Horn / high-efficiency speakers ─────────────────────
  {
    id: 'horn-high-efficiency',
    label: 'Horn / high-efficiency speaker',
    aliases: ['horn speaker', 'horn loaded', 'horn loading', 'high-efficiency speaker', 'high efficiency speaker', 'high-efficiency', 'high efficiency', 'horn', 'horns', 'compression driver', 'single-driver', 'single driver'],
    mechanism: 'Driver radiation is impedance-matched to the room through a flared structure (the horn). Acoustic loading on the driver diaphragm is increased, so a given electrical input produces a much larger acoustic output — typically 95–106 dB / 2.83 V sensitivity vs. 84–89 dB for direct-radiator designs.',
    tradeoffs: 'Bass extension typically requires a large enclosure or a separate woofer system. Horn coloration — driver/mouth modal behavior — is a real artifact that varies by horn profile and material. The gain is dynamic effortlessness at any volume, and the ability to use low-power amplification.',
    behavior: 'Driver excursion at a given SPL is far smaller than a direct-radiator design. Mechanical compression onset is much higher. Microdynamic detail (low-level transient information) is preserved through to listening volume.',
    perception: 'Music feels physically present in the room at any volume. The dynamic gap between piano and forte is more nearly the gap on the original recording, rather than the compressed range a low-sensitivity speaker delivers at apartment levels. Listeners describe horns as "alive" precisely because the dynamic envelope is not collapsed by the speaker.',
    misconceptions: 'Modern horn designs (Klipsch Heritage, Cube Audio, DeVore O-series wide-baffle) are not the harsh, colored designs of mid-century theater systems. Driver and crossover engineering has moved forward by decades.',
    pairingImplication: 'Low-power tube amplification — SET, low-power push-pull, First Watt — is the canonical pairing and historically the only practical option at 100 dB+ sensitivity. High-power amplifiers risk audible thermal compression at the amplifier rather than the speaker.',
    canonicalExamples: ['DeVore O/96 / O/baby', 'Cube Audio Nenuphar / Nendo', 'Klipsch Heritage line (Heresy, Cornwall, La Scala)', 'Avantgarde Acoustic (modern horn)', 'Zu Audio (high-sensitivity full-range)'],
  },
  // ── BBC monitor / thin-wall cabinet philosophy ──────────
  {
    id: 'bbc-thin-wall',
    label: 'BBC thin-wall monitor philosophy',
    aliases: ['bbc thin-wall', 'bbc thin wall', 'bbc monitor', 'bbc lineage', 'bbc tradition', 'ls3/5a', 'ls3 5a', 'ls35a', 'bbc speaker', 'broadcast monitor', 'bbc'],
    mechanism: 'Cabinet walls are deliberately thin and damped (typically 9–12 mm bituminous-damped birch or beech) rather than thick and rigid. The cabinet resonance is shifted into a low-Q frequency band where it minimally interferes with the voice band, instead of being suppressed by mass and stiffness.',
    tradeoffs: 'Bass extension and ultimate output are bounded by the small, light enclosure. The gain is a voice-band reproduction the cabinet does not add coloration to — the cabinet is "audible" only as a benign low-Q hum at frequencies the ear is least sensitive to. Critical-band coherence across the midrange is preserved.',
    behavior: 'Cabinet resonance lower in frequency and lower in Q than thick-wall designs. Driver excursion is the limiting factor on bass — not cabinet stiffness. Off-axis response is typically wide and uniform (a deliberate BBC R&D target for broadcast monitoring).',
    perception: 'Natural voice reproduction — speech and acoustic instruments retain their characteristic timbre because the cabinet is not stamping its own signature on the midrange. Small ensemble music (chamber, jazz trio, vocal-led) tends to sound "right." Large-scale orchestral and electronic material can sound less authoritative because the bottom octave is missing.',
    misconceptions: 'BBC thin-wall is not a cost-cutting approach. The Spencer Hughes / Dudley Harwood R&D at BBC in the 1970s mathematically modeled the resonance-vs-listenability trade and chose the trade deliberately. Modern Harbeth, Spendor Classic, Falcon Acoustics, and Graham Audio designs continue the tradition without modification of the underlying principle.',
    pairingImplication: 'Push-pull tube amplification (Leben CS300/CS600, Air Tight ATM-1) is the canonical match — the amplifier supplies tonal density and dynamic conviction the speaker deliberately understates. Sub-bass support (a well-integrated subwoofer crossed below 50 Hz) is often the path to making BBC monitors work in larger rooms.',
    canonicalExamples: ['Harbeth (P3ESR, Compact 7, M30 / 40)', 'Spendor Classic series (SP1/2, Classic 3/9)', 'Falcon Acoustics LS3/5a', 'Graham Audio LS5/9', 'Rogers (original BBC license)'],
  },
];

const BY_ID: ReadonlyMap<TopologyId, TopologyCapsule> =
  new Map(TOPOLOGY_CAPSULES.map((c) => [c.id, c] as const));

/**
 * Find the topology capsule that the user's message references, if any.
 *
 * Matching strategy:
 *   1. Lowercase the text.
 *   2. For each capsule in registration order, scan its `aliases` array
 *      (already ordered longest-first inside each capsule). The first
 *      capsule with any alias matching as a substring wins.
 *
 * Returns null when no topology is mentioned.
 */
export function findTopologyMention(text: string): TopologyCapsule | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const capsule of TOPOLOGY_CAPSULES) {
    for (const alias of capsule.aliases) {
      // Use word boundaries for short aliases (≤4 chars) to avoid "set"
      // matching inside "settled" or "fpga" matching inside "fpgam".
      if (alias.length <= 4) {
        const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (re.test(lower)) return capsule;
      } else {
        if (lower.includes(alias)) return capsule;
      }
    }
  }
  return null;
}

/** Direct accessor by canonical id. */
export function getTopologyCapsule(id: TopologyId): TopologyCapsule | null {
  return BY_ID.get(id) ?? null;
}

/** Diagnostic: list every authored topology id. Used by tests / audit. */
export function listTopologyIds(): ReadonlyArray<TopologyId> {
  return TOPOLOGY_CAPSULES.map((c) => c.id);
}

/**
 * Extract the first clause of a perception string for use as a short lens
 * inside a comparison sentence. "Tonal density, midrange weight, ..." →
 * "tonal density and midrange weight". Falls back to the raw first clause
 * if there's no comma. Always lowercases — the consumer composes a full
 * sentence with proper capitalization.
 */
function perceptionLens(perception: string): string {
  if (!perception) return '';
  // First sentence only — drop everything after the first period.
  const firstSentence = perception.split(/\.\s/)[0] ?? perception;
  // Take the first two comma-separated phrases, join with "and".
  const parts = firstSentence.split(/,\s*/).map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].toLowerCase();
  return `${parts[0].toLowerCase()} and ${parts[1].toLowerCase()}`;
}

/**
 * Build a single-sentence interaction line describing two topologies in
 * contrast. Used by the comparison renderer when both sides of a
 * comparison resolve to distinct topology capsules.
 *
 * Output shape (deterministic, specialist-register, ONE sentence):
 *   "The {capsuleA.label} favors {lensA}, while the {capsuleB.label}
 *    prioritizes {lensB}."
 *
 * Returns null when:
 *   - either capsule is missing
 *   - both capsules share the same id (no contrast)
 *   - either perception field fails to yield a usable lens
 *
 * The consumer should treat null as "skip the topology interaction line"
 * — never produce a degraded sentence.
 */
export function buildTopologyInteractionSentence(
  capsuleA: TopologyCapsule | null,
  capsuleB: TopologyCapsule | null,
): string | null {
  if (!capsuleA || !capsuleB) return null;
  if (capsuleA.id === capsuleB.id) return null;
  const lensA = perceptionLens(capsuleA.perception);
  const lensB = perceptionLens(capsuleB.perception);
  if (!lensA || !lensB) return null;
  return `The ${capsuleA.label} favors ${lensA}, while the ${capsuleB.label} prioritizes ${lensB}.`;
}

/**
 * Detect "why" or "what is" / "explain" intent against a topology.
 * Returns the capsule and the question shape when both are present.
 *
 * Examples that match:
 *   "Why do R2R DACs sound denser?" → { capsule: r2r, shape: 'why' }
 *   "What is BBC thin-wall cabinet philosophy?" → { capsule: bbc, shape: 'what' }
 *   "Explain FPGA reconstruction" → { capsule: fpga, shape: 'explain' }
 *
 * Examples that do NOT match (topology mentioned but not as a question):
 *   "Best R2R DAC under $5000" → null (shopping intent)
 *   "I love my Chord DAC" → null (no question)
 */
export interface TopologyQuestion {
  capsule: TopologyCapsule;
  shape: 'why' | 'what' | 'how' | 'explain';
}

const WHY_PATTERNS: ReadonlyArray<{ shape: TopologyQuestion['shape']; re: RegExp }> = [
  { shape: 'why', re: /\b(?:why\s+do(?:es)?|why\s+are|why\s+is)\b/i },
  { shape: 'what', re: /\b(?:what\s+is|what\s+are|what\s+does|what'?s)\b/i },
  { shape: 'how', re: /\b(?:how\s+do(?:es)?|how\s+are|how\s+is|how\s+can)\b/i },
  { shape: 'explain', re: /\b(?:explain|tell\s+me\s+about|i\s+want\s+to\s+understand)\b/i },
];

export function detectTopologyQuestion(text: string): TopologyQuestion | null {
  const capsule = findTopologyMention(text);
  if (!capsule) return null;
  for (const { shape, re } of WHY_PATTERNS) {
    if (re.test(text)) return { capsule, shape };
  }
  return null;
}

/**
 * Build a deterministic prose explainer for a topology capsule. Used by
 * callers that want a one-shot rendering (knowledge / why intents).
 *
 * Pure formatter — no side effects, no LLM, no scoring. The output is
 * stable across calls.
 */
export function buildTopologyExplainer(
  capsule: TopologyCapsule,
  shape: TopologyQuestion['shape'] = 'why',
): string {
  // Two-paragraph format: mechanism + behavior → perception, then
  // misconceptions + pairing. Canonical examples render as a tight tail.
  const opener = shape === 'why'
    ? `${capsule.label}: ${capsule.mechanism}`
    : shape === 'what'
      ? `${capsule.label} — ${capsule.mechanism}`
      : shape === 'how'
        ? `${capsule.label}: ${capsule.mechanism}`
        : `${capsule.label}. ${capsule.mechanism}`;

  const middle = `${capsule.tradeoffs} ${capsule.behavior}`;
  const perception = capsule.perception;
  const misconceptions = capsule.misconceptions;
  const pairing = capsule.pairingImplication;
  const examples = capsule.canonicalExamples.length > 0
    ? `Canonical examples: ${capsule.canonicalExamples.slice(0, 4).join('; ')}.`
    : '';

  return [
    opener,
    middle,
    perception,
    misconceptions,
    pairing,
    examples,
  ].filter(Boolean).join('\n\n');
}
