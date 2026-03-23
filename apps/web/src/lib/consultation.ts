/**
 * Consultation response builder.
 *
 * Handles brand/technology/philosophy questions — the "consultation"
 * conversation mode. These should produce concise domain-knowledge
 * answers grounded in:
 *   1. Product tendencies (when the brand/product is in our catalog)
 *   2. Design archetype knowledge (when the question is about a topology)
 *   3. General brand/philosophy reasoning (when neither applies)
 *
 * Response structure:
 *   1. Design philosophy — what this brand/technology prioritizes
 *   2. Typical sonic tendencies — how it tends to sound
 *   3. System context — where it tends to work well
 *   4. Optional follow-up — light, only when genuinely useful
 *
 * Key constraint: answer first, then optionally ask. Never begin with
 * a diagnostic-style clarification question.
 */

import { DAC_PRODUCTS, type Product } from './products/dacs';
import { SPEAKER_PRODUCTS } from './products/speakers';
import { AMPLIFIER_PRODUCTS } from './products/amplifiers';
import { TURNTABLE_PRODUCTS } from './products/turntables';
import { getUsableProvisionalProducts } from './provisional/store';
import type { ProvisionalProduct } from './provisional/types';
import { getProvenanceLabel } from './provisional/resolve';
import type { BrandScale, GeoRegion, ProductCategory } from './catalog-taxonomy';
import {
  hasTendencies,
  hasExplainableProfile,
  selectDefaultTendencies,
  getEmphasizedTraits,
  getLessEmphasizedTraits,
} from './sonic-tendencies';
import {
  resolveArchetype,
  getArchetypeById,
  archetypeCharacter,
  archetypeCaution,
  type DesignArchetype,
  type DesignArchetypeId,
} from './design-archetypes';
import type { SubjectMatch, ContextKind, DesireSignal } from './intent';
import { getApprovedBrand } from './knowledge';
import type { BrandKnowledge } from './knowledge/schema';
import type { ActiveSystemContext } from './system-types';
import type { ClarificationResponse } from './clarification';
import {
  type PrimaryAxisLeanings,
  resolveProductAxes,
  detectCompounding,
  synthesiseSystemAxes,
  AXIS_LABELS,
} from './axis-types';
import type {
  MemoFindings,
  ComponentFindings,
  StackedTraitFinding,
  BottleneckFinding,
  UpgradePathFinding,
  KeepFinding,
  RecommendedStepFinding,
  SourceReferenceFinding,
  ListenerPriority,
  DeliberatenessSignal,
  CatalogSource,
  ComponentVerdict,
} from './memo-findings';
import { renderDeterministicMemo } from './memo-deterministic-renderer';
import { isWhitelistedSource } from './evidence/source-whitelist';
// StructuredMemoInputs is transitional — the canonical rendering path is
// renderDeterministicMemo(findings, prose) without the third argument.
// See memo-deterministic-renderer.ts header for the removal plan.
import type { LegacyProseInputs, StructuredMemoInputs } from './memo-deterministic-renderer';
import { computeSystemConfidence } from './llm-system-inference';

// ── Types ───────────────────────────────────────────

/** Where the response data originated — used for provenance labeling in the UI. */
export type ConsultationSource = 'catalog' | 'brand_profile' | 'llm_inferred' | 'provisional_system';

export interface ConsultationResponse {
  /** Display title for the assessment (e.g. "Living Room System"). */
  title?: string;
  /** The subject the user asked about (brand, topology, concept). */
  subject: string;
  /** Advisory mode label — determines response rendering. */
  advisoryMode?: import('./advisory-response').AdvisoryMode;
  /** Data provenance — 'catalog' (verified), 'brand_profile' (curated), or 'llm_inferred' (unverified). */
  source?: ConsultationSource;
  /** System signature — one-sentence sonic identity characterization. */
  systemSignature?: string;
  /**
   * Comparison summary — renders first for comparison responses.
   * A concise contrast of the two subjects, answering the question
   * before expanding into per-brand detail. Not used for single-brand
   * consultations.
   */
  comparisonSummary?: string;
  /** 1. Design philosophy — what it prioritizes. */
  philosophy?: string;
  /** 2. Typical tendencies — how it tends to sound. */
  tendencies?: string;
  /** 3. System context — where it works well. */
  systemContext?: string;
  /** 4. Optional light follow-up question. */
  followUp?: string;
  /** 5. Optional neutral reference links (website, importer, dealers, reviews). */
  links?: { label: string; url: string; kind?: 'reference' | 'dealer' | 'review'; region?: string }[];

  // ── System assessment specific fields ──────────────
  /** Per-component character paragraphs. */
  componentReadings?: string[];
  /** How the components interact as a system (prose). */
  systemInteraction?: string;
  /** What is working well in the current system. */
  assessmentStrengths?: string[];
  /** Where limitations may appear. */
  assessmentLimitations?: string[];
  /** Likely upgrade direction or "do nothing" guidance. */
  upgradeDirection?: string;

  // ── Structured assessment (memo format) ──────────
  /** Ordered system chain for display. */
  systemChain?: import('./advisory-response').SystemChain;
  /** Intro paragraph — 1–2 sentence overview. */
  introSummary?: string;
  /** Primary system constraint (bottleneck). */
  primaryConstraint?: import('./advisory-response').PrimaryConstraint;
  /** Stacked trait insights. */
  stackedTraitInsights?: import('./advisory-response').StackedTraitInsight[];
  /** Per-component structured analysis (Strengths/Weaknesses/Verdict). */
  componentAssessments?: import('./advisory-response').ComponentAssessment[];
  /** Ranked upgrade paths with product options. */
  upgradePaths?: import('./advisory-response').UpgradePath[];
  /** Components the advisor recommends keeping unchanged. */
  keepRecommendations?: import('./advisory-response').KeepRecommendation[];
  /** Sequenced upgrade steps ("What I Would Do"). */
  recommendedSequence?: import('./advisory-response').RecommendedStep[];
  /** Key observation about the listener's taste pattern. */
  keyObservation?: string;
  /** System synergy summary — why the system works well together. */
  systemSynergy?: string;
  /** Listener taste profile — structured sonic preferences. */
  listenerTasteProfile?: {
    primaryTraits: string[];
    secondaryTraits?: string[];
    avoided?: string[];
    philosophy?: string;
  };
  /** Spider chart data — numeric trait values for radar visualization. */
  spiderChartData?: Array<{ trait: string; value: number; fullMark: number }>;
  /** Source references from catalogued components. */
  sourceReferences?: import('./advisory-response').SourceReference[];
}

// ── All products ────────────────────────────────────

const ALL_PRODUCTS: Product[] = [...DAC_PRODUCTS, ...SPEAKER_PRODUCTS, ...AMPLIFIER_PRODUCTS, ...TURNTABLE_PRODUCTS];

// ── Brand knowledge ─────────────────────────────────
//
// For brands not in our product catalog, provide general
// orientation. These are brief, tendency-based, not encyclopedic.

/** A neutral reference link associated with a brand. */
interface BrandLink {
  /** What the link points to (e.g. "Official website", "US importer"). */
  label: string;
  url: string;
  /**
   * Link kind.
   *   'reference' = neutral informational (default)
   *   'dealer'    = authorized dealer or distributor
   *   'review'    = editorial review or reference article
   */
  kind?: 'reference' | 'dealer' | 'review';
  /** ISO 3166-1 region code or broad region label (e.g. 'US', 'EU', 'JP', 'global'). */
  region?: string;
}

/** A distinct design family within a brand's range. */
interface DesignFamily {
  /** Short name (e.g. "O series", "Gibbon series"). */
  name: string;
  /** One-line character description. */
  character: string;
  /** Optional amplifier-pairing note. */
  ampPairing?: string;
}

interface BrandProfile {
  names: string[];
  /** Founder or lead designer, if notable. */
  founder?: string;
  /** Country of origin or primary manufacturing. */
  country?: string;
  philosophy: string;
  tendencies: string;
  systemContext: string;
  /** Pairing tendencies — what amplifiers, sources, or cables are commonly used. */
  pairingNotes?: string;
  /** Optional structured reference links — informational, not ranked. */
  links?: BrandLink[];
  /**
   * Notable design families within the brand's range.
   * Present when a single brand-level tendency would hide important
   * differences between product lines.
   */
  designFamilies?: DesignFamily[];

  // ── Catalog diversity metadata ─────────
  /** Brand scale / market position. */
  brandScale?: BrandScale;
  /** Geographic region of brand origin / design heritage. */
  region?: GeoRegion;
  /** Primary product categories this brand operates in. */
  categories?: ProductCategory[];
}

const BRAND_PROFILES: BrandProfile[] = [
  {
    names: ['devore', 'devore fidelity'],
    founder: 'John DeVore',
    country: 'USA (Brooklyn, New York)',
    brandScale: 'boutique',
    region: 'north-america',
    categories: ['speaker'],
    philosophy: 'DeVore Fidelity designs speakers around musical engagement and natural tonal character. The philosophy prioritises ease and flow over analytical precision. Speakers are voiced by ear rather than measurement target.',
    tendencies: 'Listeners describe DeVore speakers as warm, rhythmically alive, and harmonically rich. They tend to emphasise tonal body and midrange presence at the cost of some measured linearity.',
    systemContext: 'DeVore speakers span a range of sensitivities and amplifier requirements. The brand-level tendency is warmth and engagement, but the specific design family matters for amplifier pairing.',
    pairingNotes: 'The Orangutan series is widely paired with single-ended triode amplifiers (Shindo, Line Magnetic, Audion). The Gibbon series works with a broader range of amplifiers including solid-state.',
    links: [
      { label: 'Official website', url: 'https://www.dfridelity.com/', region: 'global' },
      { label: 'Tone Imports (US distributor)', url: 'https://www.toneimports.com/', kind: 'dealer', region: 'US' },
    ],
    designFamilies: [
      {
        name: 'Orangutan (O) series',
        character: 'High sensitivity (~96–97 dB), designed around low-power tube amplification. Warm, dense, flowing.',
        ampPairing: 'Voiced for single-ended triodes and low-power tubes (2–30W). A natural tube partner.',
      },
      {
        name: 'Gibbon series',
        character: 'Lower sensitivity (~87–89 dB), more conventional load. Still warm-leaning, but needs more power.',
        ampPairing: 'Requires moderate power (30W+). Works with both solid-state and higher-power tube amps.',
      },
    ],
  },
  {
    names: ['shindo'],
    founder: 'Ken Shindo',
    country: 'Japan',
    brandScale: 'boutique',
    region: 'japan',
    categories: ['amplifier'],
    philosophy: 'Shindo amplifiers are hand-built, tube-based designs rooted in vintage circuit topologies. The design philosophy prioritizes harmonic richness and tonal saturation over measured neutrality.',
    tendencies: 'Listeners consistently describe Shindo systems as dense, flowing, and harmonically alive. They tend to emphasize tonal weight and midrange texture at the cost of some transient precision.',
    systemContext: 'Commonly paired with high-efficiency speakers — horn-loaded or single-driver designs that can work with lower power output.',
    pairingNotes: 'A natural match with DeVore Orangutan, Altec-based horns, and other high-efficiency speakers. The Shindo + DeVore combination is one of the most discussed pairings in the high-efficiency community.',
    links: [
      { label: 'Official website', url: 'https://www.shindo-laboratory.co.jp/', region: 'global' },
      { label: 'Tone Imports (US importer)', url: 'https://www.toneimports.com/', kind: 'dealer', region: 'US' },
    ],
  },
  {
    names: ['pass labs', 'pass', 'first watt'],
    founder: 'Nelson Pass',
    country: 'USA',
    brandScale: 'specialist',
    region: 'north-america',
    categories: ['amplifier'],
    philosophy: 'Pass Labs designs emphasise simplicity and Class A operation where practical. First Watt is the low-power offshoot, exploring single-ended solid-state and unusual topologies.',
    tendencies: 'Pass amplifiers tend toward warmth and midrange richness for solid-state. First Watt designs emphasise texture and intimacy at the cost of dynamic scale.',
    systemContext: 'Pass Labs works across a range of speakers. First Watt pairs best with high-efficiency speakers — similar territory to low-power tube amps.',
    links: [
      { label: 'Pass Labs official', url: 'https://www.passlabs.com/', region: 'global' },
      { label: 'First Watt official', url: 'https://www.firstwatt.com/', region: 'global' },
      { label: 'Dealer (Reno HiFi)', url: 'https://www.renohifi.com/', region: 'US' },
    ],
    designFamilies: [
      {
        name: 'Pass Labs (main line)',
        character: 'Class A and Class AB designs with substantial power. Warm for solid-state, controlled, composed.',
        ampPairing: 'Works across a wide range of speakers, including moderate-to-low-sensitivity designs.',
      },
      {
        name: 'First Watt',
        character: 'Low-power single-ended solid-state. Emphasises texture, intimacy, and midrange nuance.',
        ampPairing: 'Pairs with high-efficiency speakers (93 dB+). Similar territory to low-power tube amps.',
      },
    ],
  },
  {
    names: ['naim'],
    founder: 'Julian Vereker',
    country: 'UK (Salisbury)',
    brandScale: 'specialist',
    region: 'uk',
    categories: ['amplifier', 'streamer', 'dac'],
    philosophy: 'Naim designs prioritise rhythmic drive and musical timing. The engineering philosophy emphasises pace and engagement over tonal density or spatial refinement.',
    tendencies: 'Listeners describe Naim systems as propulsive and engaging, with strong rhythmic coherence. They tend to de-emphasise warmth and spatial holography.',
    systemContext: 'Traditionally paired with Naim sources and Naim-friendly speakers. The timing-first approach works well with speakers that have good transient response.',
    links: [
      { label: 'Official website', url: 'https://www.naimaudio.com/', region: 'global' },
    ],
  },
  {
    names: ['luxman'],
    country: 'Japan',
    brandScale: 'specialist',
    region: 'japan',
    categories: ['amplifier', 'dac'],
    philosophy: 'Luxman is a long-established Japanese manufacturer building both tube and solid-state designs with an emphasis on refinement and tonal elegance.',
    tendencies: 'Luxman amplifiers tend toward a slightly warm, composed presentation. Listeners describe good tonal density with more control and composure than most tube designs.',
    systemContext: 'Versatile pairing — works across a range of speaker types. The refined character complements both analytical and warmer speakers.',
    links: [
      { label: 'Official website', url: 'https://www.luxman.com/', region: 'global' },
      { label: 'US distributor (On a Higher Note)', url: 'https://www.onahighernote.com/', region: 'US' },
    ],
  },
  {
    names: ['accuphase'],
    country: 'Japan',
    brandScale: 'specialist',
    region: 'japan',
    categories: ['amplifier', 'dac'],
    philosophy: 'Accuphase is a precision-oriented Japanese manufacturer. The design philosophy centres on measured accuracy, build quality, and long-term reliability.',
    tendencies: 'Accuphase gear tends toward transparency and control with a slightly warm tonal balance. More composed than rhythmically aggressive.',
    systemContext: 'Works well with revealing speakers where control and composure matter. A good match for listeners who value refinement over raw energy.',
    links: [
      { label: 'Official website', url: 'https://www.accuphase.com/', region: 'global' },
    ],
  },
  {
    names: ['lampizator', 'lampi'],
    founder: 'Łukasz Fikus',
    country: 'Poland',
    brandScale: 'boutique',
    region: 'europe',
    categories: ['dac'],
    philosophy: 'Lampizator builds tube-output DACs with a deliberate emphasis on harmonic richness and musical engagement over measured transparency.',
    tendencies: 'Described as tonally dense, flowing, and harmonically saturated. These DACs trade analytical precision for musical immersion and tonal weight.',
    systemContext: 'Pairs well with systems that benefit from added harmonic density. Can be too much in already warm or dense systems.',
    links: [
      { label: 'Official website', url: 'https://www.lampizator.eu/', region: 'global' },
    ],
  },
  {
    names: ['border patrol'],
    founder: 'Gary Dews',
    country: 'UK',
    brandScale: 'boutique',
    region: 'uk',
    categories: ['dac'],
    philosophy: 'Border Patrol builds NOS (non-oversampling) tube-output DACs with minimal digital processing. The philosophy is simplicity and directness.',
    tendencies: 'Listeners describe a natural, unforced sound with strong tonal body and flow. Treble is typically rolled compared to oversampling designs.',
    systemContext: 'Works best in systems where the rest of the chain provides sufficient detail and air. Pairs naturally with tube amplification and high-efficiency speakers.',
    links: [
      { label: 'Official website', url: 'https://www.borderpatrol.net/', region: 'global' },
    ],
  },
  {
    names: ['chord', 'chord electronics'],
    founder: 'John Franks',
    country: 'UK (Kent)',
    brandScale: 'specialist',
    region: 'uk',
    categories: ['dac', 'amplifier', 'streamer'],
    philosophy: 'Chord Electronics designs around proprietary FPGA-based pulse array DAC technology developed by Rob Watts. The design philosophy prioritises timing precision and transient definition, using custom digital processing rather than off-the-shelf DAC chips.',
    tendencies: 'Listeners consistently describe Chord DACs as fast, articulate, and detailed. Timing resolution and transient clarity are the signature strengths. Tonal weight is lighter than R2R designs but avoids the clinical edge of typical delta-sigma implementations.',
    systemContext: 'Chord DACs tend to work well with warm or tonally dense amplification, where the source-level clarity cuts through added warmth rather than being masked. In systems already biased toward speed and transparency, the tonal lightness may become noticeable.',
    pairingNotes: 'Works well with tube amplification and warm solid-state designs. The Hugo and Qutest lines are widely used as headphone DAC/amps and desktop sources.',
    links: [
      { label: 'Official website', url: 'https://chordelectronics.co.uk/', region: 'global' },
    ],
  },
  {
    names: ['denafrips'],
    country: 'Singapore (designed), China (manufactured)',
    brandScale: 'specialist',
    region: 'southeast-asia',
    categories: ['dac'],
    philosophy: 'Denafrips designs around discrete R2R ladder conversion — resistor networks that convert digital audio directly to analog voltage. The philosophy prioritises tonal density, harmonic texture, and musical flow over measured precision. Products range from the entry-level Ares to the flagship Terminator, sharing a consistent R2R voice at different levels of refinement and scale.',
    tendencies: 'Listeners consistently describe Denafrips DACs as warm, dense, and harmonically rich. Tonal body, midrange texture, and a relaxed sense of timing are the signature strengths. Detail retrieval is present but softer-focused than delta-sigma designs — the emphasis is on musical weight rather than analytical separation.',
    systemContext: 'Denafrips DACs tend to add warmth and body to the chain. In systems that are already warm or tonally dense, this can compound into congestion — bass and lower midrange may feel heavy. In precise or lean systems, a Denafrips source provides a welcome counterbalance, adding tonal substance without changing the downstream character.',
    pairingNotes: 'Pairs well with fast or transparent amplifiers where the R2R density is balanced by downstream speed. Widely used with solid-state amplification from brands like Benchmark, Topping, and Pass Labs. Can compound warmth with tube amplifiers — works best when the tube stage is on the transparent side.',
    links: [
      { label: 'Vinshine Audio (official distributor)', url: 'https://www.vinshineaudio.com/', kind: 'dealer', region: 'global' },
    ],
  },
  {
    names: ['job'],
    country: 'Switzerland',
    brandScale: 'boutique',
    region: 'europe',
    categories: ['amplifier'],
    philosophy: 'JOB (a sister brand to Goldmund) designs compact, high-current solid-state amplifiers that prioritise speed, transparency, and control. The design philosophy favours minimal signal path and high damping factor.',
    tendencies: 'JOB amplifiers are described as fast, transparent, and rhythmically precise. They tend toward a lean, articulate presentation with excellent transient definition. Tonal warmth is not a primary characteristic — the emphasis is on speed and control.',
    systemContext: 'JOB integrated amplifiers tend to work well with speakers that provide their own tonal body and warmth, such as high-efficiency or paper-cone designs. In systems already biased toward leanness, the cumulative precision may thin out the presentation.',
    links: [
      { label: 'Goldmund (parent brand)', url: 'https://www.goldmund.com/', region: 'global' },
    ],
  },
  {
    names: ['rega'],
    founder: 'Roy Gandy',
    country: 'UK (Southend-on-Sea)',
    brandScale: 'specialist',
    region: 'uk',
    categories: ['turntable', 'amplifier', 'speaker'],
    philosophy: 'Rega designs prioritise mechanical integrity, low resonance, and rhythmic engagement. The turntable philosophy centres on rigidity and simplicity — lightweight plinths, glass platters, and minimal damping. Roy Gandy\'s approach favours getting the mechanical fundamentals right over feature count.',
    tendencies: 'Rega turntables are consistently described as rhythmically alive and musically engaging. They tend to emphasise pace, timing, and midrange coherence. Bass weight and tonal richness are present but secondary to rhythmic drive.',
    systemContext: 'Rega turntables work well across a range of systems. The Planar series is widely considered a benchmark for musical engagement at each price point. Cartridge matching matters — Rega\'s own cartridges are voiced for the arm, but third-party cartridges can shift the tonal balance.',
    links: [
      { label: 'Official website', url: 'https://www.rega.co.uk/', region: 'global' },
      { label: 'Dealer (The Sound Organisation, US)', url: 'https://www.soundorg.com/', kind: 'dealer', region: 'US' },
    ],
  },
  {
    names: ['technics'],
    country: 'Japan',
    brandScale: 'specialist',
    region: 'japan',
    categories: ['turntable'],
    philosophy: 'Technics turntables combine precision engineering with direct-drive motor technology. The SL-1200 series defined the direct-drive standard. The current range extends from the SL-1500C to the reference SL-1000R, emphasising speed stability, low vibration, and mechanical precision.',
    tendencies: 'Direct-drive designs offer exceptional speed stability and low wow-and-flutter. The sonic character tends toward control, composure, and precise imaging. Compared to belt-drive designs, direct-drive can feel more controlled and less elastically rhythmic.',
    systemContext: 'Technics turntables are versatile and system-friendly. The SL-1500C includes a built-in phono stage and pre-mounted cartridge, making it a strong entry point. Higher models reward better cartridges and external phono stages.',
    links: [
      { label: 'Official website', url: 'https://www.technics.com/', region: 'global' },
    ],
  },
  {
    names: ['pro-ject', 'project'],
    founder: 'Heinz Lichtenegger',
    country: 'Austria',
    brandScale: 'specialist',
    region: 'europe',
    categories: ['turntable'],
    philosophy: 'Pro-Ject Audio Systems designs turntables across a wide price range, from the Essential series to the Xtension line. The philosophy emphasises accessible, well-engineered analogue playback. Belt-drive designs with carbon-fibre tonearms and acrylic platters are common throughout the range.',
    tendencies: 'Pro-Ject turntables tend toward a refined, balanced presentation. The mid-range and upper models (X2, X8) are described as smooth, detailed, and well-controlled. Rhythmic engagement is present but the emphasis is on refinement and composure.',
    systemContext: 'Pro-Ject turntables accommodate a wide range of cartridges and can be upgraded incrementally. The X2 B is a popular mid-range choice that benefits from an external phono stage.',
    links: [
      { label: 'Official website', url: 'https://www.project-audio.com/', region: 'global' },
      { label: 'Sumiko (US distributor)', url: 'https://www.sumikoaudio.net/', kind: 'dealer', region: 'US' },
    ],
  },
  {
    names: ['eversolo'],
    country: 'China',
    brandScale: 'specialist',
    region: 'east-asia',
    categories: ['streamer', 'dac'],
    philosophy: 'Eversolo designs network streamers and DACs combining full-featured control apps with competent analogue output stages. The philosophy prioritises convenience, format support, and system integration at accessible price points.',
    tendencies: 'Eversolo streamers are described as clean, neutral, and inoffensive. The DMP-A6 and DMP-A8 provide a transparent digital front-end without imposing strong tonal character. Detail retrieval is competent for the price; the emphasis is on getting out of the way.',
    systemContext: 'Widely used as a network transport feeding external DACs via USB or coaxial. When used with its internal DAC, the character is neutral enough to take on the personality of downstream components.',
    links: [
      { label: 'Official website', url: 'https://www.eversolo.com/', region: 'global' },
    ],
  },
  {
    names: ['wiim'],
    country: 'China',
    brandScale: 'specialist',
    region: 'east-asia',
    categories: ['streamer'],
    philosophy: 'WiiM designs affordable network streamers with polished software and broad streaming service integration. The engineering prioritises app experience, multi-room support, and connectivity over audiophile-grade analogue output.',
    tendencies: 'WiiM streamers are clean and transparent when used as a digital transport. The internal DAC stages are competent but not characterful — the emphasis is on convenience and digital output quality.',
    systemContext: 'Best used as a network transport feeding a dedicated external DAC. The WiiM Pro and Ultra are popular entry points for adding streaming to existing systems.',
    links: [
      { label: 'Official website', url: 'https://www.wiimhome.com/', region: 'global' },
    ],
  },
  {
    names: ['topping'],
    country: 'China',
    brandScale: 'specialist',
    region: 'east-asia',
    categories: ['dac', 'amplifier'],
    philosophy: 'Topping designs measurement-focused DACs and amplifiers using premium chip implementations (ESS Sabre, AKM). The philosophy prioritises measured performance — low distortion, low noise, and wide dynamic range.',
    tendencies: 'Topping DACs are consistently described as clean, precise, and transparent. Tonal balance is neutral-to-slightly-bright. Detail retrieval and separation are strengths; tonal density and harmonic richness are not the emphasis.',
    systemContext: 'Works well in systems that need a precise, uncoloured source. In systems already biased toward leanness, the analytical character may compound. Pairs naturally with warmer amplification or speakers that provide their own body.',
    links: [
      { label: 'Official website', url: 'https://www.toppingaudio.com/', region: 'global' },
    ],
  },
  {
    names: ['gustard'],
    country: 'China',
    brandScale: 'specialist',
    region: 'east-asia',
    categories: ['dac'],
    philosophy: 'Gustard builds DACs across both delta-sigma and R2R architectures, targeting measured performance at competitive prices. The design philosophy balances technical ambition with value positioning.',
    tendencies: 'Gustard DACs vary by architecture — the ESS-based models (X16, X26 Pro) lean toward precision and clarity, while the R2R models (R26) offer more tonal body. Generally described as capable and transparent without strong colouration.',
    systemContext: 'Versatile system partners. The ESS-based models suit systems needing analytical precision; the R2R models offer a warmer alternative without the full density of Denafrips.',
    links: [
      { label: 'Apos Audio', url: 'https://apos.audio/collections/gustard', kind: 'dealer', region: 'global' },
    ],
  },
  {
    names: ['smsl'],
    country: 'China',
    brandScale: 'specialist',
    region: 'east-asia',
    categories: ['dac', 'amplifier'],
    philosophy: 'SMSL designs compact, measurement-oriented DACs and amplifiers. Similar design philosophy to Topping — ESS and AKM chip implementations optimised for measured performance at accessible prices.',
    tendencies: 'SMSL DACs are described as clean, precise, and detailed. The sonic character is neutral-to-analytical. Tonal weight is lighter than R2R alternatives but separation and transient clarity are strong for the price.',
    systemContext: 'Similar system context to Topping — a precise source that benefits from downstream warmth. The SU-9 and D300 are popular mid-fi choices for measurement-conscious listeners.',
    links: [
      { label: 'Apos Audio', url: 'https://apos.audio/collections/smsl', kind: 'dealer', region: 'global' },
    ],
  },
  {
    names: ['laiv'],
    country: 'China',
    brandScale: 'boutique',
    region: 'east-asia',
    categories: ['dac'],
    philosophy: 'LAiV designs discrete R2R DACs emphasising harmonic texture and tonal density. The Harmony DAC uses a proprietary discrete ladder implementation with an emphasis on musical engagement over measured specification.',
    tendencies: 'The LAiV Harmony is described as warm, dense, and harmonically rich — closer to the Denafrips/Holo end of the R2R spectrum than the precision-R2R camp. Listeners note strong tonal body and natural timbre.',
    systemContext: 'Suits systems that benefit from a harmonically rich source. Like other warm R2R designs, care is needed in systems already biased toward density.',
    links: [
      { label: 'Official website', url: 'https://www.laiv.audio/', region: 'global' },
    ],
  },
  {
    names: ['fiio'],
    country: 'China',
    brandScale: 'specialist',
    region: 'east-asia',
    categories: ['dac', 'amplifier', 'headphone'],
    philosophy: 'FiiO designs portable and desktop DACs, amplifiers, and headphone gear. The philosophy balances features, connectivity, and sound quality at accessible price points. Products tend to be well-featured for their tier.',
    tendencies: 'FiiO gear is described as clean, slightly warm, and non-fatiguing. The K9 Pro desktop unit offers a balanced, capable presentation. Tonal character is mild — neither analytical nor lush.',
    systemContext: 'Good all-rounders for desktop and headphone systems. The brand serves as a solid entry point; listeners often move to more characterful components as priorities clarify.',
    links: [
      { label: 'Official website', url: 'https://www.fiio.com/', region: 'global' },
    ],
  },
  {
    names: ['hifiman'],
    country: 'China',
    brandScale: 'specialist',
    region: 'east-asia',
    categories: ['headphone', 'dac', 'amplifier'],
    philosophy: 'HiFiMAN designs planar magnetic headphones and related electronics. The headphone philosophy emphasises open, extended frequency response with planar driver technology. The EF400 desktop unit pairs a DAC with a headphone amplifier voiced for HiFiMAN headphones.',
    tendencies: 'HiFiMAN electronics (EF400, EF600) tend toward a smooth, slightly warm presentation with good staging. The R2R DAC module in the EF400 adds tonal density compared to typical delta-sigma implementations. The emphasis is on musical engagement for headphone listening.',
    systemContext: 'The EF400 is designed as a headphone system hub — DAC + amplifier in one unit. Widely paired with HiFiMAN planar headphones (Sundara, Edition XS, Ananda) where the smooth character complements planar transparency.',
    links: [
      { label: 'Official website', url: 'https://hifiman.com/', region: 'global' },
    ],
  },
  {
    names: ['audalytic'],
    country: 'Germany',
    brandScale: 'boutique',
    region: 'europe',
    categories: ['dac'],
    philosophy: 'Audalytic designs precision DACs with an emphasis on transparency, staging, and dynamic resolution. The DR70 uses a dual-mono AKM implementation with attention to power supply design and analogue output stage quality.',
    tendencies: 'The DR70 is described as detailed, spatially open, and dynamically engaging. Tonal balance is neutral with good body — avoiding the leanness common in measurement-focused designs while maintaining high resolution.',
    systemContext: 'A balanced source that provides detail without analytical hardness. Suits systems where the listener wants precision and engagement without sacrificing tonal naturalness.',
    links: [
      { label: 'Official website', url: 'https://www.audalytic.com/', region: 'global' },
    ],
  },
  {
    names: ['goldmund'],
    country: 'Switzerland',
    brandScale: 'specialist',
    region: 'europe',
    categories: ['dac', 'amplifier'],
    philosophy: 'Goldmund designs around speed, transparency, and mechanical precision. The engineering philosophy prioritises low distortion, fast transient response, and tightly controlled signal paths. JOB is the accessible sister brand.',
    tendencies: 'Goldmund electronics are described as fast, transparent, precise, and controlled. Tonal character is lean and articulate — speed and clarity dominate over warmth or harmonic density. The SRDA DAC follows this pattern with a clean, analytical presentation.',
    systemContext: 'Goldmund sources and amplifiers work well with speakers that provide their own tonal body. In systems already biased toward precision, the cumulative leanness may thin out the presentation.',
    links: [
      { label: 'Official website', url: 'https://www.goldmund.com/', region: 'global' },
    ],
  },
  {
    names: ['crayon'],
    country: 'Germany',
    brandScale: 'boutique',
    region: 'europe',
    categories: ['amplifier'],
    philosophy: 'Crayon Audio designs compact, high-current integrated amplifiers. The CIA series uses a minimalist circuit topology with high damping factor and fast slew rate, prioritising speed and dynamic grip.',
    tendencies: 'Crayon amplifiers are described as fast, transparent, and dynamically precise. They tend toward a controlled, articulate presentation with strong transient definition and excellent speaker control. Tonal character is neutral-to-lean.',
    systemContext: 'Crayon integrateds work well with speakers that benefit from tight amplifier control — sealed-box designs, transmission lines, and low-sensitivity monitors. In systems with warm or dense sources, the Crayon provides balancing speed and grip.',
    links: [
      { label: 'Official website', url: 'https://www.crayonaudio.com/', region: 'global' },
    ],
  },
  {
    names: ['xsa'],
    country: 'Unknown',
    brandScale: 'boutique',
    region: 'other',
    categories: ['speaker'],
    philosophy: 'XSA designs speakers with an emphasis on dynamic engagement and clarity. Limited public information is available — characterisation is based on the Vanguard bookshelf model.',
    tendencies: 'The XSA Vanguard is described as lively, detailed, and dynamically engaging. A compact bookshelf design with good transient response and vocal clarity.',
    systemContext: 'Bookshelf speakers in this class benefit from quality amplification with good damping and current delivery. Room placement matters for bass reinforcement.',
  },
  {
    names: ['leben'],
    founder: 'Hyodo-san',
    country: 'Japan',
    brandScale: 'boutique',
    region: 'japan',
    categories: ['amplifier'],
    philosophy: 'Leben builds hand-wired tube amplifiers in the Japanese tradition — small-scale, obsessively crafted, voiced by ear. The CS600X and CS300X prioritise tonal density, rhythmic drive, and harmonic richness over measured neutrality. Very low negative feedback.',
    tendencies: 'Listeners describe Leben amplifiers as warm, tonally dense, rhythmically alive, and harmonically rich. Strong midrange presence and natural instrument tone. Excellent dynamics for their power rating. The KT77/KT88 push-pull topology delivers surprising bass grip for a tube amp.',
    systemContext: 'Leben amplifiers are a natural match for high-efficiency speakers — DeVore, Zu, Klipsch Heritage. The CS600X (~32W) drives speakers in the 90–96dB range with authority. A staple of the Japanese high-end community and widely regarded as one of the best tube integrateds under $10k.',
    pairingNotes: 'The Leben CS600X + DeVore O/96 is one of the most celebrated pairings in modern high-efficiency audio. Tube rolling is a significant part of the Leben experience — KT77, KT88, and EL34 all produce meaningfully different voicing.',
    links: [
      { label: 'Leben (Japan)', url: 'https://www.leben-hifi.com/', region: 'global' },
      { label: 'Tone Imports (US distributor)', url: 'https://www.toneimports.com/', kind: 'dealer', region: 'US' },
    ],
  },
  {
    names: ['totaldac', 'total dac'],
    founder: 'Vincent Brient',
    country: 'France',
    brandScale: 'boutique',
    region: 'europe',
    categories: ['dac'],
    philosophy: 'TotalDAC builds discrete R2R ladder DACs using hand-matched resistor arrays. The design philosophy prioritises time-domain accuracy, natural decay, and tonal density over measured linearity. No off-the-shelf DAC chips — every conversion stage is built from discrete components.',
    tendencies: 'Listeners describe TotalDAC as fluid, dense, and natural-sounding with exceptional transient decay and depth. Very low digital glare. The R2R topology delivers strong tonal weight and harmonic richness. Time-domain coherence is a defining characteristic — instruments start and stop naturally.',
    systemContext: 'TotalDAC pairs exceptionally well with tube amplification and high-efficiency speakers. The lack of digital glare means revealing speakers and simple amplifier topologies can be used without harshness. The d1-unity with live clocking option represents serious digital front-end investment.',
    pairingNotes: 'A natural partner for Leben, Shindo, and other tube amplifiers. The time-domain focus aligns with the priorities of high-efficiency speaker systems.',
    links: [
      { label: 'TotalDAC', url: 'https://www.totaldac.com/', region: 'global' },
    ],
  },
  {
    names: ['aurorasound'],
    founder: 'Shinobu Karaki',
    country: 'Japan',
    brandScale: 'boutique',
    region: 'japan',
    categories: ['amplifier'],
    philosophy: 'Aurorasound designs phono stages and headphone amplifiers with exceptional technical sophistication. The VIDA series is widely considered a reference phono stage — designed for extremely low noise, flexible loading, and excellent transient response.',
    tendencies: 'The VIDA MKII is described as transparent, dynamic, and exceptionally quiet. It reveals cartridge character with minimal editorialising. Transient speed and decay are reference-calibre. The EQ-100 variable equalisation mono phono amplifier is a rare speciality piece for correct playback of pre-RIAA recordings.',
    systemContext: 'Aurorasound phono stages are found in reference-level analogue front ends. The VIDA is one of the most respected phono stages for cartridge rolling — its flexible loading options make it ideal for listeners with multiple cartridges spanning different design philosophies.',
    links: [
      { label: 'Aurorasound', url: 'https://aurorasound.jp/', region: 'global' },
    ],
  },
  {
    names: ['michell', 'michell engineering'],
    founder: 'John Michell',
    country: 'UK',
    brandScale: 'specialist',
    region: 'uk',
    categories: ['turntable'],
    philosophy: 'Michell Engineering builds precision turntables using suspended subchassis designs. The Gyro SE is a long-standing reference — excellent speed stability, very low noise floor, and strong rhythmic articulation. British engineering with a focus on mechanical integrity.',
    tendencies: 'Michell turntables are described as detailed, rhythmically articulate, and dynamically open. The suspended design provides excellent isolation. The Gyro SE is one of the most respected mid-price turntables — a genuine reference that competes well above its price class.',
    systemContext: 'The Gyro SE is a strong platform for a range of tonearms and cartridges. It has an excellent upgrade ecosystem (power supply, clamp, armboard options). A serious analogue front end that rewards cartridge investment.',
    links: [
      { label: 'Michell Engineering', url: 'https://www.michell-engineering.co.uk/', region: 'global' },
    ],
  },
  {
    names: ['ortofon'],
    country: 'Denmark',
    brandScale: 'specialist',
    region: 'europe',
    categories: ['turntable'],
    philosophy: 'Ortofon is the world\'s largest cartridge manufacturer, producing designs across every price point and philosophy. The SPU series represents the classic moving-coil tradition — warm, dense, and rhythmically powerful. The 2M series covers high-resolution moving-magnet designs.',
    tendencies: 'Ortofon cartridges span from warm and dense (SPU, Cadenza) to precise and revealing (2M Black, MC Windfeld). The brand covers a wider sonic range than most — cartridge selection matters more than brand character.',
    systemContext: 'Ortofon cartridges are compatible with virtually any tonearm and phono stage. The SPU series requires medium-mass arms and MC-capable phono stages. The 2M series works with standard MM inputs.',
  },
  {
    names: ['emt'],
    country: 'Germany',
    brandScale: 'specialist',
    region: 'europe',
    categories: ['turntable'],
    philosophy: 'EMT designs broadcast-heritage cartridges known for dynamic power, tracking ability, and tonal authority. Originally built for professional broadcast use, EMT cartridges prioritise reliability and dynamic impact.',
    tendencies: 'EMT cartridges are described as dynamic, powerful, and authoritative. Strong tracking ability and excellent transient definition. The HSD 006 is a modern design that retains the EMT house sound — bold, direct, and rhythmically commanding.',
    systemContext: 'EMT cartridges pair well with medium-to-high mass tonearms. They reward phono stages with good dynamic headroom and MC gain.',
  },
  {
    names: ['rockna'],
    country: 'Romania',
    brandScale: 'boutique',
    region: 'europe',
    categories: ['dac'],
    philosophy: 'Rockna designs discrete R2R DACs with FPGA-based digital processing. The approach combines the tonal density of resistor-ladder conversion with precise digital filtering and reclocking. The Wavelight represents the brand\'s accessible reference — sharing the core architecture of the flagship Wavedream at a lower price point.',
    tendencies: 'Rockna DACs are described as transparent, resolving, and tonally balanced. Unlike many R2R designs that lean warm or dense, Rockna maintains a neutral center with excellent spatial resolution and dynamic composure. Detail retrieval is high without analytical edge.',
    systemContext: 'Rockna DACs suit systems where the listener wants R2R tonal texture without the warmth bias of brands like Denafrips or Holo. They pair well with both tube and solid-state amplification, providing a balanced source that doesn\'t impose a strong tonal character.',
    links: [
      { label: 'Official website', url: 'https://www.rockna.com/', region: 'global' },
    ],
  },
  {
    names: ['dcs', 'dcs audio'],
    country: 'UK (Cambridge)',
    brandScale: 'boutique',
    region: 'uk',
    categories: ['dac', 'streamer'],
    philosophy: 'dCS (Data Conversion Systems) designs digital audio components around a proprietary Ring DAC architecture — an FPGA-based conversion topology that uses multiple signal paths and noise shaping to achieve high linearity. The engineering philosophy prioritises measured precision, dynamic range, and long-term upgradability through firmware.',
    tendencies: 'dCS components are described as transparent, controlled, and spatially precise. The Ring DAC delivers exceptional dynamic resolution and staging accuracy. Tonal character is neutral-to-cool — the emphasis is on clarity and separation rather than harmonic warmth or density.',
    systemContext: 'dCS sources work well with amplification that provides its own tonal richness — tube amplifiers or warm solid-state designs. In systems already biased toward analytical precision, the cumulative transparency may feel lean. The Bartók is the single-box entry point; the Rossini and Vivaldi are multi-box references.',
    links: [
      { label: 'Official website', url: 'https://www.dcsaudio.com/', region: 'global' },
    ],
  },
  {
    names: ['holo', 'holo audio'],
    country: 'China',
    brandScale: 'boutique',
    region: 'east-asia',
    categories: ['dac'],
    philosophy: 'Holo Audio designs discrete R2R DACs with dual-mono architecture and proprietary resistor-ladder networks. Designer Jeff Zhu\'s approach combines the harmonic richness of R2R conversion with careful attention to power supply isolation and analogue output stage quality. The May is the flagship; the Spring is the accessible entry.',
    tendencies: 'Holo Audio DACs are described as warm, harmonically rich, and dynamically engaging. The May KTE (Kitsune Tuned Edition) is considered one of the strongest R2R DACs at its price — delivering dense tonal body with better transient definition than many warm-leaning competitors. Spatial presentation is wide and natural.',
    systemContext: 'Holo DACs add warmth and harmonic texture to the chain. They pair naturally with transparent or fast amplification where the R2R density provides a welcome counterbalance. In already warm or dense systems, care is needed to avoid congestion. The May KTE is widely used in high-end headphone and speaker systems.',
    links: [
      { label: 'Kitsune HiFi (US distributor)', url: 'https://krantenaudio.com/', kind: 'dealer', region: 'US' },
    ],
  },
  {
    names: ['auralic'],
    country: 'China',
    brandScale: 'specialist',
    region: 'east-asia',
    categories: ['dac', 'streamer'],
    philosophy: 'Auralic builds streaming DACs and digital sources with a focus on polished, refined sound quality. The Vega flagship DAC uses an ESS Sabre implementation with proprietary Sanctuary audio processing and femto-precision clocking. The brand prioritises composure, tonal body, and long-session listening comfort.',
    tendencies: 'Auralic DACs are described as grounded, tonally full, and composed. Polished presentation that emphasises stability and refinement over transient excitement. The Vega sits on the warm, dense side of the delta-sigma spectrum.',
    systemContext: 'Auralic DACs work well in lean or bright systems that need tonal grounding. In systems already dense or controlled, the combined composure may reduce dynamic excitement.',
    links: [
      { label: 'Official website', url: 'https://auralic.com/', region: 'global' },
    ],
  },
  {
    names: ['kef'],
    country: 'UK',
    brandScale: 'established',
    region: 'europe',
    categories: ['speaker'],
    philosophy: 'KEF designs speakers around its proprietary Uni-Q coaxial driver, placing the tweeter at the acoustic centre of the midrange cone. The goal is point-source coherence and precise imaging. Engineering-led, measurement-informed.',
    tendencies: 'KEF speakers tend toward precision, neutral tonal balance, and wide controlled dispersion. Strong stereo imaging and detail retrieval. Can lean analytical with certain partnering equipment.',
    systemContext: 'KEF speakers reward clean, well-controlled amplification. They pair well with neutral to slightly warm electronics. Less forgiving of harsh or grainy upstream components.',
    links: [
      { label: 'Official website', url: 'https://www.kef.com/', region: 'global' },
    ],
  },
  {
    names: ['elac'],
    country: 'Germany',
    brandScale: 'established',
    region: 'europe',
    categories: ['speaker'],
    philosophy: 'ELAC builds speakers across a wide range, from budget Debut series (designed by Andrew Jones) to reference Concentro flagships. The philosophy blends accessibility with genuine engineering ambition. Known for punching above price class.',
    tendencies: 'ELAC speakers tend toward warmth and body, with fuller bass than competitors at similar price points. The Debut and Carina series favour musical engagement over analytical precision. Higher-end models (Vela, Concentro) add refinement and resolution.',
    systemContext: 'ELAC speakers are relatively easy to drive and forgiving of upstream electronics. Their warmth complements leaner solid-state amplification. May become too full in already warm systems.',
    links: [
      { label: 'Official website', url: 'https://www.elac.com/', region: 'global' },
    ],
  },
  {
    names: ['wharfedale'],
    country: 'UK',
    brandScale: 'established',
    region: 'europe',
    categories: ['speaker'],
    philosophy: 'Wharfedale is one of the oldest speaker companies in the world, with designs that prioritise tonal warmth and musical ease. The Linton Heritage revived their classic British voicing. Recent designs balance tradition with modern driver technology.',
    tendencies: 'Warm, rich midrange with a slightly relaxed top end. Prioritises long-session listenability over razor-sharp detail. The Linton Heritage emphasises vintage character; the Evo series is more modern and balanced.',
    systemContext: 'Wharfedale speakers pair well with both tube and solid-state amplification. Their warm voicing can compensate for lean electronics. May sound slightly veiled with overly warm or slow amplifiers.',
    links: [
      { label: 'Official website', url: 'https://www.wharfedale.co.uk/', region: 'global' },
    ],
  },
  {
    names: ['harbeth'],
    country: 'UK',
    brandScale: 'specialist',
    region: 'europe',
    categories: ['speaker'],
    philosophy: 'Harbeth continues the BBC monitor tradition with proprietary RADIAL cone technology. The design goal is natural midrange reproduction and accurate voice rendering. Engineering-led with psychoacoustic research informing voicing decisions.',
    tendencies: 'Listeners describe Harbeth speakers as supremely natural in the midrange, with exceptional voice reproduction. Slightly warm, with a forgiving top end. Not the last word in bass extension or dynamic slam, but vocally and instrumentally honest.',
    systemContext: 'Harbeth speakers respond well to quality amplification — both tube and solid-state. They reveal upstream differences clearly in the midrange but are forgiving of modest electronics. Stand placement matters significantly.',
    links: [
      { label: 'Official website', url: 'https://www.harbeth.co.uk/', region: 'global' },
    ],
  },
  {
    names: ['magnepan'],
    country: 'USA',
    brandScale: 'specialist',
    region: 'north-america',
    categories: ['speaker'],
    philosophy: 'Magnepan builds planar magnetic speakers — large, thin panels that move air differently from conventional box speakers. The design philosophy prioritises transparency, open presentation, and freedom from box coloration.',
    tendencies: 'Magnepan speakers sound open, airy, and transparent. They excel at soundstage depth and width. Bass is present but differently textured than box speakers — more speed, less slam. Can sound thin without adequate amplification.',
    systemContext: 'Magnepan speakers need power (high current, stable into low impedance) and room space. They reward quality amplification but demand it. Not ideal for small rooms or low-power tube amplifiers.',
    links: [
      { label: 'Official website', url: 'https://www.magnepan.com/', region: 'global' },
    ],
  },
];

// ── Topology keywords for archetype matching ────────

interface TopologyKeyword {
  patterns: RegExp[];
  archetypeId: DesignArchetypeId;
  /** Human-readable label for the subject line. */
  label: string;
}

const TOPOLOGY_KEYWORDS: TopologyKeyword[] = [
  { patterns: [/\br-?2r\b/i, /\bladder\s+dac\b/i], archetypeId: 'r2r', label: 'R2R DACs' },
  { patterns: [/\bdelta[- ]sigma\b/i, /\bds\s+dac\b/i], archetypeId: 'delta_sigma', label: 'delta-sigma DACs' },
  { patterns: [/\bnos\b/i, /\bnon[- ]oversampling\b/i], archetypeId: 'nos_tube', label: 'NOS DACs' },
  { patterns: [/\bfpga\b/i], archetypeId: 'fpga', label: 'FPGA DACs' },
  { patterns: [/\bmultibit\b/i], archetypeId: 'multibit', label: 'multibit DACs' },
  { patterns: [/\bhorn\b.*\bspeaker/i, /\bhorn[- ]loaded\b/i, /\bhow\s+do\s+horns?\s+sound\b/i], archetypeId: 'horn_loaded', label: 'horn-loaded speakers' },
  { patterns: [/\bsealed\s+(?:box|cabinet|speaker)\b/i, /\bacoustic\s+suspension\b/i], archetypeId: 'sealed_box', label: 'sealed-box speakers' },
  { patterns: [/\bbass[- ]reflex\b/i, /\bported\s+speaker/i], archetypeId: 'bass_reflex', label: 'bass-reflex speakers' },
  { patterns: [/\bhigh[- ]efficiency\b.*\bspeaker/i, /\bfull[- ]range\s+driver\b/i, /\bsingle[- ]driver\b/i], archetypeId: 'high_efficiency_wideband', label: 'high-efficiency speakers' },
];

// ── Subject extraction ──────────────────────────────

function findBrandProfile(text: string): BrandProfile | undefined {
  const lower = text.toLowerCase();
  return BRAND_PROFILES.find((bp) =>
    bp.names.some((name) => lower.includes(name)),
  );
}

/** Look up a brand profile by exact brand name (case-insensitive). */
export function findBrandProfileByName(brandName: string): BrandProfile | undefined {
  const lower = brandName.toLowerCase();
  return BRAND_PROFILES.find((bp) =>
    bp.names.some((name) => name.toLowerCase() === lower),
  );
}

function findProductsByBrand(text: string): Product[] {
  const lower = text.toLowerCase();
  return ALL_PRODUCTS.filter((p) =>
    lower.includes(p.brand.toLowerCase()) || lower.includes(p.name.toLowerCase()),
  );
}

/**
 * Search the provisional product store for products matching the text.
 * Only returns review_synthesis and review_validated records.
 */
function findProvisionalProductsByBrand(text: string): ProvisionalProduct[] {
  const lower = text.toLowerCase();
  return getUsableProvisionalProducts().filter((p) =>
    lower.includes(p.brand.toLowerCase()) || lower.includes(p.name.toLowerCase()),
  );
}

/**
 * Adapt a ProvisionalProduct to the Product interface so it can be
 * used by buildProductConsultation(). Fills in required fields that
 * may be absent on provisional records.
 */
function provisionalToProduct(pp: ProvisionalProduct): Product {
  return {
    id: pp.id,
    brand: pp.brand,
    name: pp.name,
    price: pp.price ?? 0,
    priceCurrency: pp.priceCurrency,
    category: pp.category,
    architecture: pp.architecture ?? 'Unknown architecture',
    subcategory: pp.subcategory,
    priceTier: pp.priceTier,
    brandScale: pp.brandScale,
    region: pp.region,
    country: pp.country,
    topology: pp.topology,
    traits: pp.traits ?? {},
    tendencyProfile: pp.tendencyProfile,
    description: pp.description,
    retailer_links: [],
    primaryAxes: pp.primaryAxes,
    fatigueAssessment: pp.fatigueAssessment,
    tendencies: pp.tendencies,
    sourceReferences: pp.sourceReferences,
  };
}

/**
 * Look up a single product by name/id across both validated catalog
 * and provisional store (tiers 1 and 2 of the resolution chain).
 */
function findAnyProduct(name: string): Product | undefined {
  const lower = name.toLowerCase().trim();

  // Tier 1: Validated catalog
  const catalogMatch = ALL_PRODUCTS.find(
    (p) =>
      p.name.toLowerCase() === lower ||
      `${p.brand} ${p.name}`.toLowerCase() === lower ||
      p.id.toLowerCase() === lower,
  );
  if (catalogMatch) return catalogMatch;

  // Tier 2: Provisional store
  const provisionalMatch = getUsableProvisionalProducts().find((p) => {
    const full = `${p.brand} ${p.name}`.toLowerCase();
    return p.name.toLowerCase() === lower || full === lower || p.id.toLowerCase() === lower;
  });
  if (provisionalMatch) return provisionalToProduct(provisionalMatch);

  return undefined;
}

function findTopologyMatch(text: string): { archetype: DesignArchetype; label: string } | undefined {
  for (const tk of TOPOLOGY_KEYWORDS) {
    if (tk.patterns.some((p) => p.test(text))) {
      const archetype = resolveArchetype(tk.label) ?? getArchetypeById(tk.archetypeId);
      if (archetype) {
        return { archetype, label: tk.label };
      }
    }
  }
  return undefined;
}

// ── Response builders ───────────────────────────────

/**
 * Build a consultation response from product tendency data.
 * Used when we have catalog products for the asked-about brand.
 */
function buildProductConsultation(products: Product[], subject: string): ConsultationResponse {
  const primary = products[0];

  // Look up brand links from brand profile (for reference links in response)
  const brandProfile = findBrandProfileByName(primary.brand);
  const brandLinks = brandProfile?.links;

  // Collect all available links (product-level first, then brand-level)
  const links = [
    ...(primary.retailer_links ?? []).map((rl) => ({
      label: rl.label,
      url: rl.url,
      kind: 'reference' as const,
    })),
    ...(brandLinks ?? []),
  ];

  // ── Build rich philosophy section ──
  // Overall assessment: what it is, its design lineage, and description.
  const philosophyParts: string[] = [];

  // Opening line: architecture and description
  philosophyParts.push(primary.description);

  // Architecture and design identity
  if (primary.architecture) {
    philosophyParts.push(`The design is built on ${primary.architecture} architecture.`);
  }

  // Availability note for discontinued products
  if (primary.availability === 'discontinued' && primary.usedPriceRange) {
    const { low, high } = primary.usedPriceRange;
    philosophyParts.push(
      `Discontinued — available on the used market, typically $${low}–$${high}.`,
    );
  } else if (primary.price) {
    philosophyParts.push(`Retail price: approximately $${primary.price.toLocaleString()}.`);
  }

  // ── Build rich tendencies section ──
  // Sonic character: strengths, limitations, and tradeoffs.
  const tendencyParts: string[] = [];

  if (hasTendencies(primary.tendencies)) {
    // Character domains — all of them, not just top 3
    for (const char of primary.tendencies.character) {
      tendencyParts.push(`**${capitalize(char.domain)}**: ${char.tendency}.`);
    }

    // Tradeoffs
    for (const tradeoff of primary.tendencies.tradeoffs) {
      tendencyParts.push(
        `The characteristic trade-off: ${tradeoff.gains} — at the cost of ${tradeoff.cost}` +
        (tradeoff.relative_to ? ` (relative to ${tradeoff.relative_to})` : '') + '.',
      );
    }
  } else if (hasExplainableProfile(primary.tendencyProfile)) {
    const emphasized = getEmphasizedTraits(primary.tendencyProfile);
    const lessEmphasized = getLessEmphasizedTraits(primary.tendencyProfile);
    const conf = primary.tendencyProfile.confidence;
    const emphVerb = (conf === 'high' || conf === 'founder_reference')
      ? 'Listeners consistently describe it as emphasising' : 'It tends to lean toward';
    if (emphasized.length > 0) {
      tendencyParts.push(`${emphVerb} ${emphasized.join(', ')}.`);
    }
    if (lessEmphasized.length > 0) {
      tendencyParts.push(`Less of a priority: ${lessEmphasized.join(', ')}.`);
    }
  } else if (primary.traits || primary.primaryAxes) {
    // Fallback: synthesize tendencies from traits and primaryAxes for sparse catalog entries.
    // This ensures every product gets a sonic character section, not just a 3-sentence description.
    const axisDescriptions: string[] = [];
    if (primary.primaryAxes) {
      const ax = primary.primaryAxes;
      const AXIS_LABELS: Record<string, Record<string, string>> = {
        warm_bright: { warm: 'warm and tonally rich', bright: 'bright and articulate', neutral: 'tonally balanced' },
        smooth_detailed: { smooth: 'smooth and flowing', detailed: 'detailed and resolving', neutral: 'balanced between smoothness and detail' },
        elastic_controlled: { elastic: 'dynamically expressive', controlled: 'composed and controlled', neutral: 'balanced in dynamics' },
        scale_intimacy: { scale: 'open and spacious in staging', intimacy: 'focused and intimate', neutral: 'moderate in spatial presentation' },
      };
      for (const [axis, value] of Object.entries(ax)) {
        const desc = AXIS_LABELS[axis]?.[value];
        if (desc) axisDescriptions.push(desc);
      }
    }
    if (axisDescriptions.length > 0) {
      tendencyParts.push(`**Sonic character**: ${axisDescriptions.join(', ')}.`);
    }

    // Extract notable strengths from traits (values >= 0.9)
    if (primary.traits) {
      const TRAIT_LABELS: Record<string, string> = {
        flow: 'musical flow', tonal_density: 'tonal density', clarity: 'clarity and resolution',
        dynamics: 'dynamic expression', texture: 'textural richness', composure: 'composure under complexity',
        warmth: 'warmth', speed: 'transient speed', spatial_precision: 'spatial precision',
        elasticity: 'rhythmic elasticity',
      };
      const strong = Object.entries(primary.traits)
        .filter(([key, val]) => val >= 0.9 && key !== 'fatigue_risk' && key !== 'glare_risk')
        .map(([key]) => TRAIT_LABELS[key] ?? key.replace(/_/g, ' '))
        .filter(Boolean);
      const moderate = Object.entries(primary.traits)
        .filter(([key, val]) => val >= 0.6 && val < 0.9 && key !== 'fatigue_risk' && key !== 'glare_risk')
        .map(([key]) => TRAIT_LABELS[key] ?? key.replace(/_/g, ' '))
        .filter(Boolean);
      if (strong.length > 0) {
        tendencyParts.push(`**Strengths**: ${strong.join(', ')}.`);
      }
      if (moderate.length > 0) {
        tendencyParts.push(`Also competent in ${moderate.join(', ')}.`);
      }

      // Note low fatigue risk as a positive
      const fatigueRisk = primary.traits.fatigue_risk;
      if (fatigueRisk !== undefined && fatigueRisk <= 0.1) {
        tendencyParts.push('Low fatigue risk — well-suited for extended listening sessions.');
      }
    }
  }

  // Fatigue assessment
  if (primary.fatigueAssessment) {
    tendencyParts.push(`Fatigue risk: ${primary.fatigueAssessment.risk}. ${primary.fatigueAssessment.notes}`);
  }

  // ── Build system context section ──
  // Interactions, pairing advice, and source references.
  const contextParts: string[] = [];

  if (hasTendencies(primary.tendencies)) {
    // All interactions — not just the first one
    for (const interaction of primary.tendencies.interactions) {
      const prefix = interaction.valence === 'positive' ? 'Works well' : 'Worth noting';
      contextParts.push(`${prefix}: ${interaction.condition} — ${interaction.effect}.`);
    }
  } else if (primary.primaryAxes) {
    // Fallback: generate basic pairing guidance from axis positions
    const ax = primary.primaryAxes;
    if (ax.warm_bright === 'warm') {
      contextParts.push('Works well: pairs naturally with neutral or slightly lean amplification — the warmth carries through without compounding.');
      contextParts.push('Worth noting: pairing with very warm or dense downstream components may push tonality past natural.');
    } else if (ax.warm_bright === 'bright') {
      contextParts.push('Works well: pairs naturally with warmer or denser amplification — the brightness adds articulation without harshness.');
      contextParts.push('Worth noting: pairing with other lean or bright components may push the presentation toward fatigue at high volume.');
    }
    if (ax.smooth_detailed === 'smooth') {
      contextParts.push('The smooth character makes it forgiving with aggressive recordings and poorly mastered sources.');
    } else if (ax.smooth_detailed === 'detailed') {
      contextParts.push('The resolving character rewards high-quality recordings and transparent upstream components.');
    }
  }

  // Brand-level pairing notes if available
  if (brandProfile?.pairingNotes) {
    contextParts.push(brandProfile.pairingNotes);
  }

  // Source references
  if (primary.sourceReferences && primary.sourceReferences.length > 0) {
    const sourceLines = primary.sourceReferences.map((sr) => `${sr.source}: ${sr.note}`);
    contextParts.push(`Reference sources: ${sourceLines.join(' ')}`);
  }

  return {
    source: 'catalog' as const,
    subject,
    philosophy: philosophyParts.join('\n\n'),
    tendencies: tendencyParts.join('\n\n'),
    systemContext: contextParts.length > 0 ? contextParts.join('\n\n') : undefined,
    followUp: 'Are you considering this for a specific system, or exploring what it would bring?',
    links: links.length > 0 ? links : undefined,
  };
}

/**
 * Build a consultation response from design archetype knowledge.
 * Used for topology/technology questions.
 */
function buildArchetypeConsultation(
  archetype: DesignArchetype,
  label: string,
): ConsultationResponse {
  const charSentence = archetypeCharacter(archetype);
  const caution = archetypeCaution(archetype);

  const emphasized = archetype.typicalTendencies
    .filter((t) => t.direction === 'emphasized')
    .map((t) => t.trait.replace(/_/g, ' '));
  const lessEmphasized = archetype.typicalTendencies
    .filter((t) => t.direction === 'less_emphasized')
    .map((t) => t.trait.replace(/_/g, ' '));

  const tendencyParts: string[] = [];
  if (charSentence) {
    tendencyParts.push(charSentence);
  } else if (emphasized.length > 0) {
    tendencyParts.push(`This topology tends to emphasise ${emphasized.join(' and ')}.`);
  }
  if (lessEmphasized.length > 0) {
    tendencyParts.push(`It typically trades away some ${lessEmphasized.join(' and ')}.`);
  }

  return {
    subject: label,
    philosophy: archetype.designPrinciple,
    tendencies: tendencyParts.join(' '),
    systemContext: caution ? `Worth knowing: ${caution}` : undefined,
    followUp: 'Are you considering this type of design for your system?',
  };
}

/**
 * Build a brand-level consultation response from a curated brand profile.
 *
 * Includes enriched fields when available: founder, country, design families,
 * pairing notes. This is the path for "what do you know about DeVore Fidelity?"
 * — distinct from the product consultation used for "DeVore O/96 thoughts?"
 */
function buildBrandConsultation(profile: BrandProfile): ConsultationResponse {
  const name = capitalize(profile.names[0]);

  // Build an enriched philosophy line that includes founder and origin
  let philosophyLine = '';
  if (profile.founder || profile.country) {
    const founderPart = profile.founder ? `, founded by ${profile.founder}` : '';
    const countryPart = profile.country ? ` (${profile.country})` : '';
    philosophyLine = `${name}${founderPart}${countryPart}. ${profile.philosophy}`;
  } else {
    philosophyLine = profile.philosophy;
  }

  // Build system context that includes design families and pairing notes
  let systemContext = profile.systemContext;
  if (profile.designFamilies && profile.designFamilies.length > 0) {
    const familySummary = profile.designFamilies
      .map((f) => `${f.name}: ${f.character.split('.')[0].trim()}.`)
      .join(' ');
    systemContext += `\n\nNotable design families: ${familySummary}`;
  }
  if (profile.pairingNotes) {
    systemContext += `\n\n${profile.pairingNotes}`;
  }

  return {
    source: 'brand_profile' as const,
    subject: name,
    philosophy: philosophyLine,
    tendencies: profile.tendencies,
    systemContext,
    followUp: 'Are you exploring the brand generally, or considering a specific model?',
    links: profile.links,
  };
}

/**
 * Build a brand-level consultation from the approved knowledge layer.
 *
 * This is the preferred path when a BrandKnowledge entry has been
 * reviewed and approved. It is richer than buildBrandConsultation
 * (which reads from the hardcoded BRAND_PROFILES fallback).
 */
function buildKnowledgeBrandConsultation(entry: BrandKnowledge): ConsultationResponse {
  const name = entry.name;

  // Build enriched philosophy line with founder, origin, and founding date
  const parts: string[] = [name];
  if (entry.founder) parts.push(`founded by ${entry.founder}`);
  if (entry.location) {
    parts.push(`(${entry.location})`);
  } else if (entry.country) {
    parts.push(`(${entry.country})`);
  }
  if (entry.founded) parts.push(`est. ${entry.founded}`);
  const identity = parts.length > 1 ? `${parts.join(', ')}. ` : '';
  const philosophyLine = `${identity}${entry.philosophy}`;

  // Build system context with product families and pairing notes
  let systemContext = '';
  if (entry.productFamilies && entry.productFamilies.length > 0) {
    const familySummary = entry.productFamilies
      .map((f) => {
        let line = `${f.name}: ${f.character.split('.')[0].trim()}.`;
        if (f.priceRange) line += ` (${f.priceRange})`;
        return line;
      })
      .join(' ');
    systemContext += `Notable product families: ${familySummary}`;
  }
  if (entry.pairingTendencies) {
    systemContext += (systemContext ? '\n\n' : '') + entry.pairingTendencies;
  }

  // Convert knowledge links + dealers to ConsultationResponse link format
  const links: ConsultationResponse['links'] = [];
  for (const link of entry.links) {
    links.push({
      label: link.label,
      url: link.url,
      kind: link.kind === 'official' ? 'reference' : link.kind,
      region: link.region,
    });
  }
  if (entry.dealers) {
    for (const dealer of entry.dealers) {
      if (dealer.url) {
        links.push({
          label: dealer.name,
          url: dealer.url,
          kind: 'dealer',
          region: dealer.region,
        });
      }
    }
  }

  return {
    subject: name,
    philosophy: philosophyLine,
    tendencies: entry.sonicReputation,
    systemContext: systemContext || undefined,
    followUp: 'Are you exploring the brand generally, or considering a specific model?',
    links: links.length > 0 ? links : undefined,
  };
}

/**
 * Build a brand-level comparison response.
 * Used when two brands are mentioned with comparison intent and both
 * have profiles (curated or catalog-derived). Compares at the
 * philosophy/tendency level — not individual products.
 */
function buildBrandComparison(
  profileA: BrandProfile | { name: string; philosophy: string; tendencies: string },
  profileB: BrandProfile | { name: string; philosophy: string; tendencies: string },
  queryText?: string,
): ConsultationResponse {
  const nameA = capitalize('names' in profileA ? profileA.names[0] : profileA.name);
  const nameB = capitalize('names' in profileB ? profileB.names[0] : profileB.name);

  // Extract core traits — 2-3 words that capture each brand's character.
  const charA = extractCoreCharacter(profileA.tendencies);
  const charB = extractCoreCharacter(profileB.tendencies);

  // Extract 1 sentence of tendency detail for each side.
  const tendA = takeSentences(profileA.tendencies, 1);
  const tendB = takeSentences(profileB.tendencies, 1);

  // System context — 1 sentence each, for pairing guidance.
  const sysA = 'systemContext' in profileA && profileA.systemContext
    ? takeSentences(profileA.systemContext, 1)
    : '';
  const sysB = 'systemContext' in profileB && profileB.systemContext
    ? takeSentences(profileB.systemContext, 1)
    : '';

  // Price context — compact, inline.
  const brandNameA = ('names' in profileA ? profileA.names[0] : profileA.name).toLowerCase();
  const brandNameB = ('names' in profileB ? profileB.names[0] : profileB.name).toLowerCase();
  const productsA = ALL_PRODUCTS.filter((p) => p.brand.toLowerCase() === brandNameA);
  const productsB = ALL_PRODUCTS.filter((p) => p.brand.toLowerCase() === brandNameB);
  const findQueryProduct = (products: Product[], query: string | undefined): Product | null => {
    if (!query || products.length <= 1) return products[0] ?? null;
    const q = query.toLowerCase();
    const fullMatch = products.find((p) => q.includes(p.name.toLowerCase()));
    if (fullMatch) return fullMatch;
    return products.find((p) => {
      const words = p.name.toLowerCase().split(/[\s]+/);
      return words.some((w) => (w.length >= 3 || /[^a-z]/.test(w)) && w.length >= 2 && q.includes(w));
    }) ?? null;
  };
  const specificA = findQueryProduct(productsA, queryText);
  const specificB = findQueryProduct(productsB, queryText);
  const priceA = specificA?.price ?? (productsA.length === 1 ? productsA[0].price : null);
  const priceB = specificB?.price ?? (productsB.length === 1 ? productsB[0].price : null);

  let priceNote = '';
  if (priceA && priceB) {
    const ratio = Math.max(priceA, priceB) / Math.min(priceA, priceB);
    if (ratio >= 2) {
      priceNote = ` (different price tiers — ~$${Math.min(priceA, priceB).toLocaleString()} vs ~$${Math.max(priceA, priceB).toLocaleString()})`;
    } else if (ratio >= 1.3) {
      priceNote = ` (~$${Math.min(priceA, priceB).toLocaleString()} vs ~$${Math.max(priceA, priceB).toLocaleString()})`;
    }
  }

  // ── Build concise side-by-side comparison ──
  // Opening line + two trait blocks + decision guidance.
  // Total target: 5–10 lines.
  const opening = `These take different approaches${priceNote}:`;

  // Per-brand trait blocks: 2-3 traits + 1 system note each.
  const blockA = `**${nameA}** — ${charA}. ${tendA}${sysA ? ` ${sysA}` : ''}`;
  const blockB = `**${nameB}** — ${charB}. ${tendB}${sysB ? ` ${sysB}` : ''}`;

  // Decision guidance — derive from character contrast.
  const guidance = buildComparisonGuidance(nameA, charA, profileA, nameB, charB, profileB);

  // Check for design families that need model-level follow-up
  const familiesA = 'designFamilies' in profileA ? (profileA as BrandProfile).designFamilies : undefined;
  const familiesB = 'designFamilies' in profileB ? (profileB as BrandProfile).designFamilies : undefined;
  const hasAnyFamilies = (familiesA && familiesA.length > 0) || (familiesB && familiesB.length > 0);

  const followUp = hasAnyFamilies
    ? `Which models are you comparing? That changes the picture.`
    : `What are you pairing it with?`;

  // Pack everything into comparisonSummary so it renders as one concise block.
  // philosophy/tendencies/systemContext left empty — prevents long review sections.
  const fullComparison = `${opening}\n\n${blockA}\n\n${blockB}\n\n${guidance}`;

  return {
    subject: `${nameA} vs ${nameB}`,
    comparisonSummary: fullComparison,
    followUp,
  };
}

/**
 * Build compact decision guidance from brand character contrast.
 * Format: "If your system is X → A. If you want Y → B."
 */
function buildComparisonGuidance(
  nameA: string, charA: string, profileA: BrandProfile | { name: string; philosophy: string; tendencies: string },
  nameB: string, charB: string, profileB: BrandProfile | { name: string; philosophy: string; tendencies: string },
): string {
  // Detect warm vs precise axis (most common comparison dimension)
  const warmWords = /warm|rich|lush|dense|full|musical|organic|relaxed|smooth/i;
  const preciseWords = /precise|neutral|analytical|detailed|clean|fast|controlled|resolving|transparent/i;
  const aWarm = warmWords.test(profileA.tendencies) || warmWords.test(charA);
  const bWarm = warmWords.test(profileB.tendencies) || warmWords.test(charB);
  const aPrecise = preciseWords.test(profileA.tendencies) || preciseWords.test(charA);
  const bPrecise = preciseWords.test(profileB.tendencies) || preciseWords.test(charB);

  if (aWarm && bPrecise) {
    return `If you want warmth and body → ${nameA}. If you want precision and detail → ${nameB}.`;
  }
  if (bWarm && aPrecise) {
    return `If you want precision and detail → ${nameA}. If you want warmth and body → ${nameB}.`;
  }
  // Both warm or both precise — find subtler contrast
  if (aWarm && bWarm) {
    return `Both lean warm — the difference is in texture and presentation. ${nameA} tends toward ${charA}, ${nameB} toward ${charB}.`;
  }
  if (aPrecise && bPrecise) {
    return `Both lean precise — the difference is in voicing. ${nameA} tends toward ${charA}, ${nameB} toward ${charB}.`;
  }
  // Fallback — use extracted characters directly
  return `${nameA} leans toward ${charA}. ${nameB} leans toward ${charB}. The right choice depends on what your system needs.`;
}

/**
 * Build an architectural explanation for a brand comparison.
 * Connects design topology to sonic character — the "why" behind the "what."
 *
 * Returns null when topology data is unavailable for either brand.
 */
function buildArchitecturalExplanation(
  nameA: string,
  profileA: BrandProfile | { name: string; philosophy: string; tendencies: string },
  nameB: string,
  profileB: BrandProfile | { name: string; philosophy: string; tendencies: string },
): string | null {
  // Resolve the dominant topology for each brand from the product catalog
  const topoA = resolveBrandTopology(profileA);
  const topoB = resolveBrandTopology(profileB);

  if (!topoA || !topoB) return null;
  // Don't explain if both use the same topology — the difference is implementation, not architecture
  if (topoA.id === topoB.id) return null;

  const parts: string[] = [];
  parts.push(
    `Some of this traces to architecture. ${nameA} uses ${topoA.label} conversion — ${topoA.designPrinciple.toLowerCase()}`
    + ` This tends toward ${topoA.typicalTradeoff.toLowerCase()}`
  );
  parts.push(
    `${nameB} uses ${topoB.label} conversion — ${topoB.designPrinciple.toLowerCase()}`
    + ` This tends toward ${topoB.typicalTradeoff.toLowerCase()}`
  );

  // Architecture is a starting tendency, not a deterministic outcome
  parts.push('Architecture sets a starting tendency, not a deterministic outcome. Implementation choices — output stage topology, power supply design, filter algorithms — can shift the character significantly within the same conversion family.');

  return parts.join(' ');
}

/**
 * Build a system consequence note for a brand comparison.
 * Explains what happens when each brand enters different system contexts.
 *
 * Uses brand systemContext if curated, or infers from axis positions.
 */
function buildSystemConsequence(
  nameA: string,
  profileA: BrandProfile | { name: string; philosophy: string; tendencies: string },
  nameB: string,
  profileB: BrandProfile | { name: string; philosophy: string; tendencies: string },
): string | null {
  const sysA = 'systemContext' in profileA ? profileA.systemContext : null;
  const sysB = 'systemContext' in profileB ? profileB.systemContext : null;

  // Need at least one side to have system context
  if (!sysA && !sysB) return null;

  const parts: string[] = [];
  parts.push('How each fits your system depends on what surrounds it.');

  if (sysA) {
    parts.push(`${nameA}: ${takeSentences(sysA, 2)}`);
  } else {
    // Infer system context from tendency text
    const tendLower = profileA.tendencies.toLowerCase();
    if (tendLower.includes('warm') || tendLower.includes('dense') || tendLower.includes('rich')) {
      parts.push(`${nameA} tends to add warmth and body — in systems that are already warm, this can compound into congestion. In precise or lean systems, it provides a welcome counterbalance.`);
    } else if (tendLower.includes('fast') || tendLower.includes('clarity') || tendLower.includes('precise') || tendLower.includes('transparent')) {
      parts.push(`${nameA} tends to add clarity and speed — in systems that are already bright, this can push toward fatigue. In warm or dense systems, it provides articulation without changing the fundamental character.`);
    }
  }

  if (sysB) {
    parts.push(`${nameB}: ${takeSentences(sysB, 2)}`);
  } else {
    const tendLower = profileB.tendencies.toLowerCase();
    if (tendLower.includes('warm') || tendLower.includes('dense') || tendLower.includes('rich')) {
      parts.push(`${nameB} tends to add warmth and body — in systems that are already warm, this can compound into congestion. In precise or lean systems, it provides a welcome counterbalance.`);
    } else if (tendLower.includes('fast') || tendLower.includes('clarity') || tendLower.includes('precise') || tendLower.includes('transparent')) {
      parts.push(`${nameB} tends to add clarity and speed — in systems that are already bright, this can push toward fatigue. In warm or dense systems, it provides articulation without changing the fundamental character.`);
    }
  }

  return parts.length > 1 ? parts.join('\n\n') : null;
}

/**
 * Resolve the dominant design topology for a brand by examining its products.
 * Returns the most common archetype across the brand's catalog entries.
 */
function resolveBrandTopology(
  profile: BrandProfile | { name: string; philosophy: string; tendencies: string },
): import('./design-archetypes').DesignArchetype | null {
  const brandName = 'names' in profile ? profile.names[0] : profile.name;
  const brandProducts = ALL_PRODUCTS.filter(
    (p) => p.brand.toLowerCase() === brandName.toLowerCase(),
  );

  if (brandProducts.length === 0) return null;

  // Find the most common architecture string
  const archCounts = new Map<string, number>();
  for (const p of brandProducts) {
    archCounts.set(p.architecture, (archCounts.get(p.architecture) ?? 0) + 1);
  }
  let dominantArch = '';
  let maxCount = 0;
  for (const [arch, count] of archCounts) {
    if (count > maxCount) { dominantArch = arch; maxCount = count; }
  }

  return resolveArchetype(dominantArch) ?? null;
}

/**
 * Build a design-family context note for brands that have distinct product lines.
 * Returns null if neither brand has design families.
 */
function buildDesignFamilyContext(
  nameA: string,
  familiesA: DesignFamily[] | undefined,
  nameB: string,
  familiesB: DesignFamily[] | undefined,
): string | null {
  const parts: string[] = [];

  if (familiesA && familiesA.length > 0) {
    const familyList = familiesA.map((f) => `${f.name} (${f.character.split('.')[0].trim()})`).join('; ');
    parts.push(`${nameA} includes distinct design families: ${familyList}.`);
  }
  if (familiesB && familiesB.length > 0) {
    const familyList = familiesB.map((f) => `${f.name} (${f.character.split('.')[0].trim()})`).join('; ');
    parts.push(`${nameB} includes distinct design families: ${familyList}.`);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * Extract the core character descriptors from a tendency string.
 * Pulls out 2–4 key trait words/phrases to form a concise contrast.
 * Falls back to the first clause of the first sentence if no traits match.
 *
 * IMPORTANT: trait matching must be context-aware. A phrase like
 * "tonal weight is lighter" should NOT produce a "tonal density" hit.
 * Negation patterns (lighter, less, without, lacks, not) near a trait
 * word suppress the match.
 */
function extractCoreCharacter(tendencies: string): string {
  const lower = tendencies.toLowerCase();

  /**
   * Match a trait only if it appears in a positive/assertive context.
   * Suppresses matches when negation language appears nearby — either
   * before ("without warmth") or after ("tonal weight is lighter").
   */
  function positiveMatch(pattern: RegExp): boolean {
    const match = pattern.exec(lower);
    if (!match) return false;
    const negationRe = /\b(?:lighter|less|without|lacks|not|avoids?|reduced|limited|absent|thin|lean)\b/;
    // Check ~40 chars before the match
    const prefixStart = Math.max(0, match.index - 40);
    const prefix = lower.slice(prefixStart, match.index);
    if (negationRe.test(prefix)) return false;
    // Check ~30 chars after the match end — catches "tonal weight is lighter"
    const suffixEnd = Math.min(lower.length, match.index + match[0].length + 30);
    const suffix = lower.slice(match.index + match[0].length, suffixEnd);
    if (negationRe.test(suffix)) return false;
    return true;
  }

  // Look for known trait-words and cluster them — order matters for selection priority
  const traitHits: string[] = [];
  if (positiveMatch(/\barticulate|articulation\b/i)) traitHits.push('articulation');
  if (positiveMatch(/\btiming\s+(?:precision|resolution)\b/i)) traitHits.push('timing precision');
  if (positiveMatch(/\bwarm\b/i)) traitHits.push('warmth');
  if (positiveMatch(/\bflow|flowing\b/i)) traitHits.push('flow');
  if (positiveMatch(/\brhythm|rhythmic|propulsive|pace\b/i)) traitHits.push('rhythmic drive');
  if (positiveMatch(/\bclarity|transparent|transparency|resolving\b/i)) traitHits.push('clarity');
  if (positiveMatch(/\bdense|density|tonal weight|tonal body\b/i)) traitHits.push('tonal density');
  if (positiveMatch(/\bbody\b/i) && !traitHits.includes('tonal density')) traitHits.push('body');
  if (positiveMatch(/\bspatial|soundstage|imaging|holograph\b/i)) traitHits.push('spatial presence');
  if (positiveMatch(/\bdynamic|punch|slam|energy\b/i)) traitHits.push('dynamic energy');
  if (positiveMatch(/\bcontrolled?\b|composure|composed|refined|refinement\b/i)) traitHits.push('composure');
  if (positiveMatch(/\bintimate|intimacy\b/i)) traitHits.push('intimacy');
  if (positiveMatch(/\btexture|textural\b/i)) traitHits.push('texture');
  if (positiveMatch(/\bharmonic|harmonically\b/i)) traitHits.push('harmonic richness');
  if (positiveMatch(/\bnatural|unforced\b/i)) traitHits.push('a natural presentation');
  if (positiveMatch(/\bengaging|engagement|immersive|immersion\b/i)) traitHits.push('musical engagement');
  if (positiveMatch(/\bsaturated|saturation\b/i)) traitHits.push('tonal saturation');

  if (traitHits.length >= 2) {
    // Take up to 4 traits for a concise summary
    const selected = traitHits.slice(0, 4);
    return joinNatural(selected);
  }

  // Fallback: first clause of first sentence
  const firstSentence = tendencies.split(/[.!]/)[0] || tendencies;
  const firstClause = firstSentence.split(/[,;—–]/)[0].trim().toLowerCase();
  return firstClause;
}

/** Join strings naturally with commas and "and". */
function joinNatural(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/** Take up to `n` sentences from a string. */
function takeSentences(text: string, n: number): string {
  const parts = text.match(/[^.!]+[.!]+/g);
  if (!parts) return text;
  return parts.slice(0, n).join('').trim();
}

/** Capitalize first letter of a string. */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Derive a minimal brand summary from catalog products.
 * Used as a fallback when we have products but no curated brand profile.
 *
 * Prefers the structured `tendencies.character` data (rich, curated)
 * over the simpler `tendencyProfile` (which may lack emphasized traits).
 */
function deriveBrandSummaryFromCatalog(
  brandName: string,
  products: Product[],
): { name: string; philosophy: string; tendencies: string } {
  const primary = products[0];
  const archLabel = products.length > 1
    ? `${primary.architecture} and related architectures`
    : `${primary.architecture} architecture`;

  // Build tendencies: prefer curated character descriptions, then profile, then description
  let tendencyText: string;
  if (hasTendencies(primary.tendencies)) {
    const chars = selectDefaultTendencies(primary.tendencies.character, 2);
    tendencyText = chars.map((c) => c.tendency).join('. ') + '.';
  } else if (hasExplainableProfile(primary.tendencyProfile)) {
    const emphasized = getEmphasizedTraits(primary.tendencyProfile);
    if (emphasized.length > 0) {
      tendencyText = `Tends to emphasise ${emphasized.slice(0, 2).join(' and ')}.`;
    } else {
      // No emphasized traits — fall back to description
      tendencyText = primary.description.split('.').slice(0, 2).join('.') + '.';
    }
  } else {
    tendencyText = primary.description.split('.').slice(0, 2).join('.') + '.';
  }

  return {
    name: brandName,
    philosophy: `${capitalize(brandName)} builds ${archLabel}. ${primary.description.split('.')[0]}.`,
    tendencies: tendencyText,
  };
}

/**
 * Build a minimal honest response for a brand we recognize by name
 * but have no curated profile or catalog data for.
 *
 * Better than falling through to the diagnostic engine, which would
 * produce a "describe what you hear" prompt instead of acknowledging
 * the brand question.
 */
function buildUnknownBrandResponse(brandName: string): ConsultationResponse {
  const name = capitalize(brandName);
  return {
    subject: name,
    philosophy: `${name} is a recognised brand, but I don't yet have a detailed profile for their design philosophy or sonic tendencies in my knowledge base.`,
    tendencies: 'I can be more helpful if you tell me what you\'re pairing it with, what draws you to this brand, or what you\'re hoping it brings to your system.',
    followUp: 'What interests you about ' + name + '?',
  };
}

// ── Public API ───────────────────────────────────────

/**
 * Build a consultation response for a knowledge/philosophy question.
 *
 * Resolution order:
 *   1. Brand-level comparison (two brand subjects, no specific products)
 *   2. Product tendencies (specific product in catalog)
 *   3. Design archetype (topology/technology question)
 *   4. Brand profile (known brand, no specific product)
 *   5. Best-effort fallback (brand in catalog but no curated profile)
 *   6. null (no match — caller should fall back to gear inquiry)
 *
 * @param currentMessage   - the user's message text
 * @param subjectMatches   - optional subject matches with brand/product kind tags
 */
export function buildConsultationResponse(
  currentMessage: string,
  subjectMatches?: SubjectMatch[],
): ConsultationResponse | null {
  // 1. Brand-level comparison — "Chord vs Denafrips" (both tagged as brands)
  if (subjectMatches && subjectMatches.length >= 2) {
    const brandMatches = subjectMatches.filter((m) => m.kind === 'brand');
    if (brandMatches.length >= 2) {
      const a = brandMatches[0];
      const b = brandMatches[1];
      const profileA = findBrandProfile(a.name);
      const profileB = findBrandProfile(b.name);

      // Both have curated profiles — direct comparison
      if (profileA && profileB) {
        return buildBrandComparison(profileA, profileB, currentMessage);
      }

      // One or both missing curated profiles — try catalog-derived summaries
      const productsA = ALL_PRODUCTS.filter((p) => p.brand.toLowerCase() === a.name.toLowerCase());
      const productsB = ALL_PRODUCTS.filter((p) => p.brand.toLowerCase() === b.name.toLowerCase());
      const summaryA = profileA ?? (productsA.length > 0 ? deriveBrandSummaryFromCatalog(a.name, productsA) : null);
      const summaryB = profileB ?? (productsB.length > 0 ? deriveBrandSummaryFromCatalog(b.name, productsB) : null);

      if (summaryA && summaryB) {
        return buildBrandComparison(summaryA, summaryB, currentMessage);
      }
    }
  }

  // 2. Distinguish brand inquiry from model inquiry
  //    "what do you know about devore fidelity?" → brand consultation
  //    "devore o96 thoughts?" → product consultation
  //
  //    Heuristic: if subjectMatches contains only brand-kind matches (no
  //    product name in the text), and a curated BrandProfile exists, route
  //    to brand consultation first. If a product-kind match is present,
  //    route to product consultation.
  const hasProductSubject = subjectMatches && subjectMatches.some((m) => m.kind === 'product');
  const hasBrandOnlySubject = subjectMatches && subjectMatches.length > 0 && !hasProductSubject;

  // 2a. Brand-only inquiry — check approved knowledge layer first,
  //     then fall back to hardcoded BRAND_PROFILES
  if (hasBrandOnlySubject) {
    // Check approved knowledge layer (highest priority)
    const brandSubject = subjectMatches!.find((m) => m.kind === 'brand');
    if (brandSubject) {
      const knowledgeEntry = getApprovedBrand(brandSubject.name);
      if (knowledgeEntry) {
        return buildKnowledgeBrandConsultation(knowledgeEntry);
      }
    }
    // Fall back to hardcoded brand profiles
    const brandProfile = findBrandProfile(currentMessage);
    if (brandProfile) {
      return buildBrandConsultation(brandProfile);
    }
  }

  // 2b. Product-level inquiry or no subject matches — check catalog products
  const products = findProductsByBrand(currentMessage);
  if (products.length > 0) {
    // If user mentioned a product name, use product consultation
    if (hasProductSubject) {
      const brandName = products[0].brand;
      return buildProductConsultation(products, brandName);
    }
    // If user mentioned only a brand name and no curated profile exists,
    // check if a brand profile can be found before falling to product level
    const brandProfile = findBrandProfile(currentMessage);
    if (brandProfile) {
      return buildBrandConsultation(brandProfile);
    }
    // No curated profile — fall through to product consultation as best-effort
    const brandName = products[0].brand;
    return buildProductConsultation(products, brandName);
  }

  // 2c. Check provisional product store (review_synthesis / review_validated)
  //     This is tier 2 of the resolution chain — products with structured
  //     trait data derived from curated review evidence.
  const provisionalProducts = findProvisionalProductsByBrand(currentMessage);
  if (provisionalProducts.length > 0) {
    const primary = provisionalProducts[0];
    const adapted = provisionalProducts.map(provisionalToProduct);
    const response = buildProductConsultation(adapted, primary.brand);

    // Add provenance label so the advisory response frames trust level correctly
    const label = getProvenanceLabel(primary.provenance.sourceType);
    if (label && response.philosophy) {
      response.philosophy = `${label}.\n\n${response.philosophy}`;
    }

    return response;
  }

  // 3. Check for topology/technology match
  const topoMatch = findTopologyMatch(currentMessage);
  if (topoMatch) {
    return buildArchetypeConsultation(topoMatch.archetype, topoMatch.label);
  }

  // 4. Check for known brand profile (no subject matches available)
  const brandProfile = findBrandProfile(currentMessage);
  if (brandProfile) {
    return buildBrandConsultation(brandProfile);
  }

  // 5. Best-effort fallback — brand recognized but no curated profile
  if (subjectMatches && subjectMatches.length > 0) {
    const brandSubject = subjectMatches.find((m) => m.kind === 'brand');
    if (brandSubject) {
      // 5a. Brand has catalog products — build from product data
      const brandProducts = ALL_PRODUCTS.filter(
        (p) => p.brand.toLowerCase() === brandSubject.name.toLowerCase(),
      );
      if (brandProducts.length > 0) {
        return buildProductConsultation(brandProducts, brandProducts[0].brand);
      }

      // 5b. Brand recognized in BRAND_NAMES but no catalog data at all —
      // return null so the caller can attempt LLM inference
      return null;
    }
  }

  // 6. No match
  return null;
}

// ── Comparison refinement ────────────────────────────

/**
 * Build a follow-up comparison response that focuses on a specific criterion.
 *
 * Used when the user asks a follow-up like "what's better with tubes?"
 * or "which has more flow?" against an active comparison context.
 *
 * @param activeComparison - stored left/right subjects and scope
 * @param followUpMessage  - the user's follow-up question
 */
export function buildComparisonRefinement(
  activeComparison: { left: SubjectMatch; right: SubjectMatch; scope: 'brand' | 'product' },
  followUpMessage: string,
): ConsultationResponse {
  const nameA = capitalize(activeComparison.left.name);
  const nameB = capitalize(activeComparison.right.name);

  // Resolve profiles or catalog summaries for both sides
  const infoA = resolveBrandInfo(activeComparison.left.name);
  const infoB = resolveBrandInfo(activeComparison.right.name);

  // Extract the criterion from the follow-up
  const criterion = extractCriterion(followUpMessage);

  // Build a criterion-focused comparison
  const contextA = infoA ? buildCriterionAnswer(nameA, infoA, criterion) : `I don't have enough data about ${nameA} to assess this specifically.`;
  const contextB = infoB ? buildCriterionAnswer(nameB, infoB, criterion) : `I don't have enough data about ${nameB} to assess this specifically.`;

  // Build a qualified comparison summary that answers first without absolute verdicts.
  // Brand-level comparisons use softer contrast language; product-level can be more specific.
  const summary = buildCriterionSummary(nameA, nameB, infoA, infoB, criterion, activeComparison.scope);

  // Comparison-aware follow-up that reflects the axis of comparison
  const followUp = buildCriterionFollowUp(criterion);

  // For brand-level amp-pairing follow-ups, surface design families if they exist
  let systemContext = 'How much this matters in practice depends on the rest of the chain and how the room interacts.';
  let refinedFollowUp = followUp;

  if (activeComparison.scope === 'brand' && criterion.category === 'amplifier_pairing') {
    const familyNote = buildDesignFamilyAmpNote(nameA, nameB, criterion);
    if (familyNote) {
      systemContext += `\n\n${familyNote}`;
      refinedFollowUp = 'Which model or series are you considering? That shapes how this comparison plays out.';
    }
  }

  // Pack into concise side-by-side format — no long review sections.
  const concise = `${summary}\n\n**${nameA}:** ${contextA}\n\n**${nameB}:** ${contextB}`;

  return {
    subject: `${nameA} vs ${nameB} — ${criterion.label}`,
    comparisonSummary: concise,
    followUp: refinedFollowUp,
  };
}

/**
 * Build an amplifier-pairing note from design families, if relevant.
 * Used in criterion-based follow-ups to surface important within-brand differences.
 */
// ── Context enrichment for active comparisons ────────

/**
 * Build a response that incorporates user-provided system context
 * into an active comparison. Used when the user says something like
 * "my amp is a Crayon CIA" mid-comparison.
 *
 * @param activeComparison - stored comparison subjects and scope
 * @param contextMessage   - the user's message providing system context
 * @param contextKind      - the classified kind of context
 */
export function buildContextRefinement(
  activeComparison: { left: SubjectMatch; right: SubjectMatch; scope: 'brand' | 'product' },
  contextMessage: string,
  contextKind: ContextKind,
): ConsultationResponse {
  const nameA = capitalize(activeComparison.left.name);
  const nameB = capitalize(activeComparison.right.name);

  const infoA = resolveBrandInfo(activeComparison.left.name);
  const infoB = resolveBrandInfo(activeComparison.right.name);

  // Extract what the user told us for the summary
  const contextLabel = describeContext(contextMessage, contextKind);

  // Build context-aware comparison text for each side
  const sideA = infoA
    ? buildContextSideAnswer(nameA, infoA, contextKind, contextMessage)
    : `I don't have enough data about ${nameA} to assess this pairing specifically.`;
  const sideB = infoB
    ? buildContextSideAnswer(nameB, infoB, contextKind, contextMessage)
    : `I don't have enough data about ${nameB} to assess this pairing specifically.`;

  const summary = buildContextSummary(nameA, nameB, infoA, infoB, contextKind, contextMessage, activeComparison.scope);
  const followUp = buildContextFollowUp(contextKind);

  // Pack into concise side-by-side format.
  const concise = `${summary}\n\n**${nameA}:** ${sideA}\n\n**${nameB}:** ${sideB}`;

  return {
    subject: `${nameA} vs ${nameB} — ${contextLabel}`,
    comparisonSummary: concise,
    followUp,
  };
}

/** Produce a short human-readable label for the context the user provided. */
function describeContext(text: string, kind: ContextKind): string {
  switch (kind) {
    case 'amplifier': {
      // Try to extract amp name from "my amp is a X" or "using a X"
      const ampMatch = text.match(/(?:amp(?:lifier)?\s+is\s+(?:a\s+)?|using\s+(?:a\s+)?|driven\s+by\s+(?:a\s+)?|powered\s+by\s+(?:a\s+)?|running\s+(?:a\s+)?|pairing\s+(?:it|them)\s+with\s+(?:a\s+)?)(.+)/i);
      if (ampMatch) return `with ${ampMatch[1].trim()}`;
      return 'amplifier context';
    }
    case 'speaker': return 'speaker context';
    case 'room': return 'room context';
    case 'music': return 'music preferences';
    case 'listening_priority': return 'listening priorities';
    case 'power': return 'power context';
    case 'budget': return 'budget context';
    default: return 'system context';
  }
}

/** Build a context-aware answer for one side of a comparison. */
function buildContextSideAnswer(
  name: string,
  info: BrandInfo,
  contextKind: ContextKind,
  contextMessage: string,
): string {
  // For amplifier/power context, use system context data if available
  if ((contextKind === 'amplifier' || contextKind === 'power') && info.systemContext) {
    return `${name}: ${takeSentences(info.systemContext, 2)}`;
  }
  // For room context, use system context
  if (contextKind === 'room' && info.systemContext) {
    return `${name}: ${takeSentences(info.systemContext, 2)}`;
  }
  // For trait/music/priority context, use tendencies
  return `${name}: ${takeSentences(info.tendencies, 2)}`;
}

/** Build the comparison summary given the new system context. */
function buildContextSummary(
  nameA: string,
  nameB: string,
  infoA: BrandInfo | null,
  infoB: BrandInfo | null,
  contextKind: ContextKind,
  contextMessage: string,
  scope: 'brand' | 'product',
): string {
  const contextLabel = describeContext(contextMessage, contextKind);

  if (!infoA || !infoB) {
    return `That context helps narrow things down, though I have limited data on one side.`;
  }

  if (contextKind === 'amplifier' || contextKind === 'power') {
    const charA = extractCoreCharacter(infoA.tendencies);
    const charB = extractCoreCharacter(infoB.tendencies);
    if (scope === 'brand') {
      return `${contextLabel} — that helps frame the comparison. ${nameA} tends toward ${charA}, while ${nameB} leans toward ${charB}. How each interacts with that amplifier depends on sensitivity, impedance behaviour, and what the amp does well.`;
    }
    return `${contextLabel} — that helps narrow the comparison. ${nameA} and ${nameB} would likely interact with that amplifier differently based on their load characteristics and design priorities.`;
  }

  if (contextKind === 'room') {
    return `That room context matters. ${nameA} and ${nameB} would likely behave differently depending on boundary interaction, efficiency, and radiation pattern.`;
  }

  if (contextKind === 'music' || contextKind === 'listening_priority') {
    const charA = extractCoreCharacter(infoA.tendencies);
    const charB = extractCoreCharacter(infoB.tendencies);
    return `That helps clarify the direction. ${nameA} leans toward ${charA}, while ${nameB} leans toward ${charB}. The question is which emphasis serves that listening better.`;
  }

  return `That context helps frame the comparison between ${nameA} and ${nameB}.`;
}

/** Build a follow-up question appropriate to the context just provided. */
function buildContextFollowUp(contextKind: ContextKind): string {
  switch (contextKind) {
    case 'amplifier':
    case 'power':
      return 'What speakers is that amp driving — or is that what we\'re choosing between?';
    case 'speaker':
      return 'What amplifier are you pairing with those speakers?';
    case 'room':
      return 'What kind of listening do you do most — and at what volume?';
    case 'music':
      return 'What do you value most in how that music is presented — body, detail, rhythm, space?';
    case 'listening_priority':
      return 'Is that the main priority, or one factor among several?';
    case 'budget':
      return 'What does the rest of your system look like?';
    default:
      return 'What would help most — narrowing by a specific quality, or understanding how they differ in that context?';
  }
}

function buildDesignFamilyAmpNote(nameA: string, nameB: string, criterion: ComparisonCriterion): string | null {
  const profileA = findBrandProfile(nameA);
  const profileB = findBrandProfile(nameB);
  const parts: string[] = [];

  for (const [name, profile] of [[nameA, profileA], [nameB, profileB]] as const) {
    if (profile?.designFamilies && profile.designFamilies.length > 0) {
      const relevant = profile.designFamilies
        .filter((f) => f.ampPairing)
        .map((f) => `${f.name}: ${f.ampPairing}`);
      if (relevant.length > 0) {
        parts.push(`${name} has distinct design families that respond differently to ${criterion.label.toLowerCase()}: ${relevant.join('. ')}.`);
      }
    }
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * Build a qualified comparison summary for a criterion-based follow-up.
 *
 * Scope rules:
 *   brand-level  → always a qualified contrast ("more often associated with",
 *                   "tends to lean toward") — never a hard winner statement
 *   product-level → can be more specific when the data justifies it
 *
 * When both sides are comparable or evidence is thin, frames as a contrast.
 */
function buildCriterionSummary(
  nameA: string,
  nameB: string,
  infoA: BrandInfo | null,
  infoB: BrandInfo | null,
  criterion: ComparisonCriterion,
  scope: 'brand' | 'product',
): string {
  // If we don't have data for both, give an honest partial answer
  if (!infoA || !infoB) {
    const knownName = infoA ? nameA : nameB;
    return `I have more information about ${knownName} in this context. The comparison is limited without fuller data on both sides.`;
  }

  // ── Amplifier pairing ──────────────────────────────
  if (criterion.category === 'amplifier_pairing') {
    const ampType = criterion.label.toLowerCase();
    const aRelevance = assessRelevance(infoA, criterion);
    const bRelevance = assessRelevance(infoB, criterion);

    if (scope === 'brand') {
      // Brand-level: qualified contrast — describe associations, not winners
      if (aRelevance > bRelevance) {
        return `At the brand level, ${nameA} is more often associated with ${ampType}-friendly design and a ${ampType}-oriented listening aesthetic. ${nameB} can also work well with ${ampType}, especially where sensitivity and dynamic expression matter.`;
      }
      if (bRelevance > aRelevance) {
        return `At the brand level, ${nameB} is more often associated with ${ampType}-friendly design and a ${ampType}-oriented listening aesthetic. ${nameA} can also work well with ${ampType}, especially where sensitivity and dynamic expression matter.`;
      }
      return `Both brands can work with ${ampType}, but they bring different priorities to the pairing. ${nameA} and ${nameB} shape the interaction differently based on their design assumptions.`;
    }

    // Product-level: can be more specific
    if (aRelevance > bRelevance) {
      return `${nameA} tends to be a more natural fit with ${ampType} — its design assumptions align more closely with that topology. ${nameB} can work, but may need more careful matching.`;
    }
    if (bRelevance > aRelevance) {
      return `${nameB} tends to be a more natural fit with ${ampType} — its design assumptions align more closely with that topology. ${nameA} can work, but may need more careful matching.`;
    }
    return `Both can work with ${ampType}, but they respond differently — the interaction depends on specific amplifier characteristics and the rest of the chain.`;
  }

  // ── Trait criteria ─────────────────────────────────
  if (criterion.category === 'trait') {
    const traitName = criterion.label.toLowerCase();
    const charA = extractCoreCharacter(infoA.tendencies);
    const charB = extractCoreCharacter(infoB.tendencies);

    if (scope === 'brand') {
      return `At the brand level, ${nameA} tends to lean toward ${charA}, while ${nameB} tends to lean toward ${charB}. Individual models within each range may vary — the question is which general direction serves your priorities better.`;
    }
    return `In terms of ${traitName}, ${nameA} leans toward ${charA}, while ${nameB} leans toward ${charB}. The question is which balance serves your priorities better.`;
  }

  // ── Room criteria ──────────────────────────────────
  if (criterion.category === 'room') {
    if (scope === 'brand') {
      return `Room interaction depends on efficiency, radiation pattern, and bass loading — both ${nameA} and ${nameB} offer models that handle this differently. The brand-level tendency gives a starting point, but specific models matter more here.`;
    }
    return `Room interaction is shaped by efficiency, radiation pattern, and bass loading — ${nameA} and ${nameB} handle this differently based on their design priorities.`;
  }

  // ── General fallback ───────────────────────────────
  if (scope === 'brand') {
    return `${nameA} and ${nameB} approach this from different directions. At the brand level, the contrast is more about design philosophy than a clear advantage — the fit depends on your priorities.`;
  }
  return `${nameA} and ${nameB} approach this from different directions. The fit depends on what you want the overall balance to feel like.`;
}

/**
 * Score how relevant a brand's data is to a specific criterion.
 * Simple keyword matching against system context and tendencies.
 */
function assessRelevance(info: BrandInfo, criterion: ComparisonCriterion): number {
  let score = 0;
  const combined = `${info.tendencies} ${info.systemContext ?? ''}`.toLowerCase();

  if (criterion.category === 'amplifier_pairing') {
    if (/tube/i.test(criterion.raw) && /tube|valve|triode|single[- ]ended|low[- ]power/i.test(combined)) score += 2;
    if (/solid/i.test(criterion.raw) && /solid[- ]state|transistor|class[- ]?[abd]/i.test(combined)) score += 2;
    if (/high[- ]efficiency|easy\s+impedance|sensitivity/i.test(combined)) score += 1;
  }
  if (criterion.category === 'room') {
    if (/small/i.test(criterion.raw) && /small|near[- ]field|intimate/i.test(combined)) score += 2;
    if (/large/i.test(criterion.raw) && /large|scale|dynamic/i.test(combined)) score += 2;
  }
  return score;
}

/**
 * Build a follow-up question that reflects the comparison axis.
 * More useful than a generic "what's the rest of your system?"
 */
function buildCriterionFollowUp(criterion: ComparisonCriterion): string {
  switch (criterion.category) {
    case 'amplifier_pairing':
      return 'What amplifier are you considering — and how much power does it make?';
    case 'room':
      return 'How large is the space, and how far do you sit from the speakers?';
    case 'trait':
      return `Is ${criterion.label.toLowerCase()} the priority, or is it one factor among several?`;
    default:
      return 'What would help most — narrowing by a specific quality, or understanding how they differ in your system context?';
  }
}

/** Resolved brand info for comparison refinement. */
interface BrandInfo {
  philosophy: string;
  tendencies: string;
  systemContext?: string;
}

/** Resolve brand info from curated profile, catalog, or null. */
function resolveBrandInfo(brandName: string): BrandInfo | null {
  // Curated profile
  const profile = findBrandProfile(brandName);
  if (profile) {
    return {
      philosophy: profile.philosophy,
      tendencies: profile.tendencies,
      systemContext: profile.systemContext,
    };
  }
  // Catalog-derived
  const products = ALL_PRODUCTS.filter((p) => p.brand.toLowerCase() === brandName.toLowerCase());
  if (products.length > 0) {
    const summary = deriveBrandSummaryFromCatalog(brandName, products);
    return { philosophy: summary.philosophy, tendencies: summary.tendencies };
  }
  return null;
}

/** Extracted criterion from a comparison follow-up. */
interface ComparisonCriterion {
  label: string;
  category: 'amplifier_pairing' | 'room' | 'trait' | 'general';
  raw: string;
}

/** Extract the criterion from a follow-up question. */
function extractCriterion(text: string): ComparisonCriterion {
  const lower = text.toLowerCase();

  // Amplifier pairing
  if (/tubes?|valve|single[- ]ended|triode|set\b/i.test(lower)) {
    return { label: 'Tube amplification', category: 'amplifier_pairing', raw: text };
  }
  if (/solid[- ]state|class[- ]?[abd]|transistor/i.test(lower)) {
    return { label: 'Solid-state amplification', category: 'amplifier_pairing', raw: text };
  }
  if (/low[- ]power/i.test(lower)) {
    return { label: 'Low-power amplification', category: 'amplifier_pairing', raw: text };
  }

  // Room context
  if (/small\s+room/i.test(lower)) {
    return { label: 'Small rooms', category: 'room', raw: text };
  }
  if (/large\s+room/i.test(lower)) {
    return { label: 'Large rooms', category: 'room', raw: text };
  }
  if (/near[- ]field/i.test(lower)) {
    return { label: 'Near-field listening', category: 'room', raw: text };
  }

  // Sonic traits
  if (/warm/i.test(lower)) return { label: 'Warmth', category: 'trait', raw: text };
  if (/flow/i.test(lower)) return { label: 'Flow', category: 'trait', raw: text };
  if (/clarity|detail/i.test(lower)) return { label: 'Clarity', category: 'trait', raw: text };
  if (/rhythm|timing|pace/i.test(lower)) return { label: 'Rhythm', category: 'trait', raw: text };
  if (/tonal|body|weight|dense|density/i.test(lower)) return { label: 'Tonal density', category: 'trait', raw: text };
  if (/spatial|soundstage|imaging/i.test(lower)) return { label: 'Spatial depth', category: 'trait', raw: text };
  if (/dynamic|punch/i.test(lower)) return { label: 'Dynamics', category: 'trait', raw: text };

  // General fallback
  return { label: 'This context', category: 'general', raw: text };
}

/** Build a criterion-specific answer for one side of a comparison. */
function buildCriterionAnswer(
  brandName: string,
  info: BrandInfo,
  criterion: ComparisonCriterion,
): string {
  if (criterion.category === 'amplifier_pairing' && info.systemContext) {
    return `${brandName}: ${takeSentences(info.systemContext, 2)}`;
  }
  if (criterion.category === 'room' && info.systemContext) {
    return `${brandName}: ${takeSentences(info.systemContext, 2)}`;
  }
  if (criterion.category === 'trait') {
    return `${brandName}: ${takeSentences(info.tendencies, 2)}`;
  }
  // General — use tendencies + system context
  const parts = [takeSentences(info.tendencies, 1)];
  if (info.systemContext) parts.push(takeSentences(info.systemContext, 1));
  return `${brandName}: ${parts.join(' ')}`;
}

// ── Consultation follow-up ──────────────────────────
//
// Handles follow-up questions to a single-subject consultation.
// Examples:
//   "devore o96 thoughts?" → "but aren't there smaller models?"
//   "tell me about harbeth" → "what about their amps?"

/**
 * Classify what the user is asking about in their follow-up.
 */
type FollowUpKind =
  | 'other_models'      // "aren't there smaller models?"
  | 'sonic_detail'      // "how is the bass?"
  | 'pairing'           // "what pairs well with it?"
  | 'system_fit'        // "how would it work in my system?"
  | 'general';          // catch-all follow-up

function classifyFollowUp(text: string): FollowUpKind {
  const lower = text.toLowerCase();
  if (/\b(?:smaller|larger|bigger|cheaper|other|different)\s+(?:models?|versions?|options?|speakers?)\b/i.test(lower)) return 'other_models';
  if (/\bdo\s+they\s+(?:make|have|offer)\b/i.test(lower)) return 'other_models';
  if (/\bother\s+(?:models?|versions?|products?|options?)\b/i.test(lower)) return 'other_models';
  if (/\b(?:bass|treble|midrange|soundstage|imaging|dynamics|timing|warmth|detail|speed)\b/i.test(lower)) return 'sonic_detail';
  if (/\bpair|match|work\s+with|goes?\s+well\b/i.test(lower)) return 'pairing';
  if (/\bmy\s+(?:system|setup|room|amp)|in\s+(?:a\s+)?(?:small|large)\b/i.test(lower)) return 'system_fit';
  // "i have a tube amp", "i'm using a Shindo", "driven by SET"
  if (/\bi\s+have\s+(?:a|an)\s+/i.test(lower) && /\b(?:amp|amplifier|preamp|integrated|receiver|dac|speakers?|turntable|phono|streamer|tube|set|push[- ]pull|single[- ]ended|class[- ]?a)\b/i.test(lower)) return 'system_fit';
  if (/\b(?:i(?:'m|\s+am)\s+)?(?:using|running|pairing|powering|driving)\b/i.test(lower)) return 'system_fit';
  if (/\b(?:driven|powered|fed)\s+by\b/i.test(lower)) return 'system_fit';
  if (/\btube\s+amp/i.test(lower) || /\b(?:300b|2a3|el34|kt88|set|push[- ]pull)\b/i.test(lower)) return 'system_fit';
  return 'general';
}

/**
 * Build a follow-up response for an active consultation.
 *
 * Uses the stored subject context to answer questions about
 * variants, sonic details, pairings, and system fit — without
 * falling through to diagnostic logic.
 *
 * @param activeConsultation - stored subjects and original query
 * @param followUpMessage    - the user's follow-up question
 */
export function buildConsultationFollowUp(
  activeConsultation: { subjects: SubjectMatch[]; originalQuery: string },
  followUpMessage: string,
): ConsultationResponse | null {
  if (activeConsultation.subjects.length === 0) return null;

  const primarySubject = activeConsultation.subjects[0];
  const subjectName = capitalize(primarySubject.name);
  const kind = classifyFollowUp(followUpMessage);

  // Resolve the brand profile for the subject
  const brandProfile = findBrandProfile(primarySubject.name);
  const knowledgeEntry = getApprovedBrand(primarySubject.name);
  const brandProducts = ALL_PRODUCTS.filter(
    (p) => p.brand.toLowerCase() === primarySubject.name.toLowerCase(),
  );

  // ── Other models / variants ──────────────────────────
  if (kind === 'other_models') {
    // Check for design families in brand profile
    if (brandProfile?.designFamilies && brandProfile.designFamilies.length > 0) {
      const familyLines = brandProfile.designFamilies.map(
        (f) => `${f.name}: ${f.character}${f.ampPairing ? ` ${f.ampPairing}` : ''}`,
      );
      return {
        subject: subjectName,
        philosophy: `${subjectName} has distinct design families that span different sizes, sensitivities, and amplifier requirements.`,
        tendencies: familyLines.join('\n\n'),
        systemContext: brandProfile.pairingNotes ?? undefined,
        followUp: 'Which of these directions interests you — or is there a specific constraint like room size or amplifier power?',
      };
    }

    // Check catalog products
    if (brandProducts.length > 1) {
      const productList = brandProducts.map(
        (p) => `${p.brand} ${p.name}: ${p.description.split('.')[0]}.`,
      );
      return {
        subject: subjectName,
        philosophy: `${subjectName} has several models in the catalog with different characteristics.`,
        tendencies: productList.join('\n\n'),
        followUp: 'What constraints matter most — size, budget, amplifier compatibility?',
      };
    }

    // No detailed family/product data — honest acknowledgement
    return {
      subject: subjectName,
      philosophy: `${subjectName} does make other models, though I have the most detail on what we discussed.`,
      tendencies: brandProfile
        ? `The broader range shares the brand philosophy: ${takeSentences(brandProfile.philosophy, 1)}`
        : `I'd suggest looking at the full lineup on their website for a complete picture of the range.`,
      followUp: 'Is there a specific size, price range, or amplifier pairing you\'re working with?',
      links: brandProfile?.links,
    };
  }

  // ── Sonic detail questions ───────────────────────────
  if (kind === 'sonic_detail') {
    const info = resolveBrandInfo(primarySubject.name);
    if (info) {
      return {
        subject: subjectName,
        philosophy: `Continuing with ${subjectName} — ${takeSentences(info.tendencies, 2)}`,
        tendencies: info.systemContext
          ? `Context matters: ${takeSentences(info.systemContext, 2)}`
          : 'Specific sonic performance depends on the rest of the chain — amplifier character, room, and source all shape the final result.',
        followUp: 'What are you pairing this with?',
      };
    }
  }

  // ── Pairing questions ────────────────────────────────
  if (kind === 'pairing') {
    if (brandProfile?.pairingNotes) {
      return {
        subject: subjectName,
        philosophy: `For ${subjectName} pairings: ${brandProfile.pairingNotes}`,
        tendencies: brandProfile.systemContext ?? 'Pairing depends on what qualities you want to emphasise or balance.',
        followUp: 'Do you have an amplifier already, or are you choosing both together?',
      };
    }
    const info = resolveBrandInfo(primarySubject.name);
    if (info?.systemContext) {
      return {
        subject: subjectName,
        philosophy: `${subjectName}: ${takeSentences(info.systemContext, 2)}`,
        tendencies: 'Pairing depends on the balance you want — complementary or reinforcing the existing character.',
        followUp: 'What kind of sound do you want overall?',
      };
    }
  }

  // ── System fit questions ─────────────────────────────
  if (kind === 'system_fit') {
    const info = resolveBrandInfo(primarySubject.name);
    // Try to resolve the product from validated catalog + provisional store
    const product = findAnyProduct(primarySubject.name);

    if (info || product) {
      // Build a contextual response that incorporates what the user told us
      const pairingNotes = brandProfile?.pairingNotes ?? info?.systemContext ?? '';
      const productTendencies = product?.description
        ? takeSentences(product.description, 2)
        : info?.tendencies
          ? takeSentences(info.tendencies, 2)
          : '';

      // Check if the user mentioned tube amplification — a very common pairing question
      const mentionsTubes = /\btube|valve|set\b|single[- ]?ended|300b|2a3|el34|kt88|push[- ]?pull/i.test(followUpMessage);
      // Extract sensitivity from product description/notes (e.g. "93dB sensitivity" or "96dB")
      const sensitivityText = product ? `${product.description} ${product.notes ?? ''}` : '';
      const sensitivityMatch = sensitivityText.match(/(\d{2,3})\s*dB\b/i);
      const productEfficiency = sensitivityMatch ? parseInt(sensitivityMatch[1], 10) : undefined;
      const isHighEfficiency = productEfficiency && productEfficiency >= 90;

      let contextualNote: string;
      if (mentionsTubes && product) {
        if (isHighEfficiency) {
          contextualNote = `${subjectName} with tube amplification is a natural pairing. At ${productEfficiency}dB sensitivity, even modest tube power (8–15W) will drive these comfortably. This is one of the design's intended use cases — the combination tends to emphasise warmth, harmonic richness, and spatial depth.`;
        } else if (productEfficiency && productEfficiency >= 86) {
          contextualNote = `${subjectName} can work with tube amplification, though at ${productEfficiency}dB sensitivity you'll want reasonable power — push-pull designs (20W+) rather than single-ended triodes. The tube character adds warmth and harmonic texture to the presentation.`;
        } else {
          contextualNote = `${subjectName} with tube amplification is possible but depends on the amp's power and the room. ${productTendencies}`;
        }
      } else {
        contextualNote = `${subjectName} in that context: ${productTendencies}${pairingNotes ? ` ${pairingNotes}` : ''}`;
      }

      return {
        subject: subjectName,
        philosophy: contextualNote,
        tendencies: pairingNotes && !mentionsTubes
          ? takeSentences(pairingNotes, 2)
          : 'How well it fits depends on what the rest of the chain brings — amplifier topology, source character, and room all interact.',
        followUp: mentionsTubes
          ? 'Which tube amp are you using — or are you choosing one?'
          : 'What else is in the chain?',
      };
    }
  }

  // ── General follow-up ────────────────────────────────
  // Re-route through the full consultation builder with the original subject
  // context. This catches anything the specific handlers missed.
  const result = buildConsultationResponse(
    `${activeConsultation.originalQuery} ${followUpMessage}`,
    activeConsultation.subjects,
  );
  if (result) return result;

  // Last resort — honest acknowledgement
  return {
    subject: subjectName,
    philosophy: `Still on ${subjectName} — that's a good question.`,
    tendencies: "I don't have enough specific data to give a detailed answer on that aspect. The brand profile and general tendencies are the most reliable basis I have.",
    followUp: 'What would be most useful — more about the brand philosophy, or practical pairing guidance?',
  };
}

// ── System Assessment ──────────────────────────────────

/**
 * System assessment response — structured differently from ConsultationResponse.
 *
 * Instead of single-subject philosophy/tendencies, this maps each named
 * component to its character and then synthesizes system-level interaction.
 * Returned as a ConsultationResponse for adapter compatibility, using:
 *   - philosophy → per-component character paragraphs
 *   - tendencies → system interaction summary
 *   - systemContext → amplifier-speaker fit assessment
 *   - followUp → open question about what to explore
 */
export interface SystemComponent {
  /** Display name (e.g. "Chord Qutest", "Pass Labs INT-25"). */
  displayName: string;
  /** Component role (dac, amplifier, speaker, etc). */
  role: string;
  /** One-line character description. */
  character: string;
  /** Brand profile if available. */
  brandProfile?: {
    philosophy: string;
    tendencies: string;
    systemContext: string;
    designFamily?: { name: string; character: string; ampPairing?: string };
  };
  /** Product data if available. */
  product?: Product;
}

// ── Pre-assessment validation ────────────────────────
//
// Lightweight validation pass that runs before the system assessment pipeline.
// Detects three classes of issues:
//   1. Role-label conflicts — user labels a component differently than catalog data
//   2. Chain-order ambiguity — system can't reconstruct signal flow confidently
//   3. Duplicate-role conflicts — two DACs, two amps, etc. without clear indication
//
// Returns a ClarificationResponse when a conflict requires user input,
// or null when the system is clear to proceed.

/** Known product → expected category mappings for role-label conflict detection. */
const KNOWN_PRODUCT_ROLES: Record<string, { expectedCategory: string; displayBrand: string }> = {
  'wiim pro': { expectedCategory: 'streamer', displayBrand: 'WiiM' },
  'wiim ultra': { expectedCategory: 'streamer', displayBrand: 'WiiM' },
  'dmp-a6': { expectedCategory: 'streamer', displayBrand: 'Eversolo' },
  'dmp-a8': { expectedCategory: 'streamer', displayBrand: 'Eversolo' },
  'dac-z8': { expectedCategory: 'dac', displayBrand: 'Eversolo' },
  'eversolo dmp-a6': { expectedCategory: 'streamer', displayBrand: 'Eversolo' },
  'eversolo dmp-a8': { expectedCategory: 'streamer', displayBrand: 'Eversolo' },
  'eversolo dac-z8': { expectedCategory: 'dac', displayBrand: 'Eversolo' },
  'k9 pro': { expectedCategory: 'dac', displayBrand: 'FiiO' },
  ef400: { expectedCategory: 'dac', displayBrand: 'HiFiMAN' },
  'hugo tt2': { expectedCategory: 'dac', displayBrand: 'Chord' },
  qutest: { expectedCategory: 'dac', displayBrand: 'Chord' },
  hugo: { expectedCategory: 'dac', displayBrand: 'Chord' },
  dave: { expectedCategory: 'dac', displayBrand: 'Chord' },
  mojo: { expectedCategory: 'dac', displayBrand: 'Chord' },
  bifrost: { expectedCategory: 'dac', displayBrand: 'Schiit' },
  yggdrasil: { expectedCategory: 'dac', displayBrand: 'Schiit' },
  'cia-1': { expectedCategory: 'integrated', displayBrand: 'Crayon' },
  'cia-1t': { expectedCategory: 'integrated', displayBrand: 'Crayon' },
  vanguard: { expectedCategory: 'speaker', displayBrand: 'XSA' },
  rost: { expectedCategory: 'amplifier', displayBrand: 'Hegel' },
  'hegel rost': { expectedCategory: 'amplifier', displayBrand: 'Hegel' },
  vega: { expectedCategory: 'dac', displayBrand: 'Auralic' },
  'auralic vega': { expectedCategory: 'dac', displayBrand: 'Auralic' },
  '2220b': { expectedCategory: 'amplifier', displayBrand: 'Marantz' },
  'marantz 2220b': { expectedCategory: 'amplifier', displayBrand: 'Marantz' },
  opdv971h: { expectedCategory: 'dac', displayBrand: 'Oppo' },
  'oppo opdv971h': { expectedCategory: 'dac', displayBrand: 'Oppo' },
  'hornshoppe horn': { expectedCategory: 'speaker', displayBrand: 'Hornshoppe' },
  'hornshoppe horns': { expectedCategory: 'speaker', displayBrand: 'Hornshoppe' },
  diva: { expectedCategory: 'speaker', displayBrand: 'WLM' },
  'diva monitor': { expectedCategory: 'speaker', displayBrand: 'WLM' },
  leben: { expectedCategory: 'amplifier', displayBrand: 'Leben' },
  cs300: { expectedCategory: 'amplifier', displayBrand: 'Leben' },
  cs600: { expectedCategory: 'amplifier', displayBrand: 'Leben' },
  'cs600x': { expectedCategory: 'amplifier', displayBrand: 'Leben' },
  'cs300x': { expectedCategory: 'amplifier', displayBrand: 'Leben' },
  totaldac: { expectedCategory: 'dac', displayBrand: 'TotalDAC' },
  'd1-unity': { expectedCategory: 'dac', displayBrand: 'TotalDAC' },
  'd1-tube': { expectedCategory: 'dac', displayBrand: 'TotalDAC' },
  'd1-twelve': { expectedCategory: 'dac', displayBrand: 'TotalDAC' },
  aurorasound: { expectedCategory: 'phono', displayBrand: 'Aurorasound' },
  vida: { expectedCategory: 'phono', displayBrand: 'Aurorasound' },
  'vida mk': { expectedCategory: 'phono', displayBrand: 'Aurorasound' },
  'eq-100': { expectedCategory: 'phono', displayBrand: 'Aurorasound' },
  michell: { expectedCategory: 'turntable', displayBrand: 'Michell' },
  'gyro se': { expectedCategory: 'turntable', displayBrand: 'Michell' },
  gyrodec: { expectedCategory: 'turntable', displayBrand: 'Michell' },
  ortofon: { expectedCategory: 'cartridge', displayBrand: 'Ortofon' },
  'spu mono': { expectedCategory: 'cartridge', displayBrand: 'Ortofon' },
  '2m black': { expectedCategory: 'cartridge', displayBrand: 'Ortofon' },
  emt: { expectedCategory: 'cartridge', displayBrand: 'EMT' },
  'hsd 006': { expectedCategory: 'cartridge', displayBrand: 'EMT' },
  sorane: { expectedCategory: 'tonearm', displayBrand: 'Sorane' },
  'sa1.2': { expectedCategory: 'tonearm', displayBrand: 'Sorane' },
  harbeth: { expectedCategory: 'speaker', displayBrand: 'Harbeth' },
  p3esr: { expectedCategory: 'speaker', displayBrand: 'Harbeth' },
  'super hl5': { expectedCategory: 'speaker', displayBrand: 'Harbeth' },
  job: { expectedCategory: 'integrated', displayBrand: 'JOB' },
  'terminator ii': { expectedCategory: 'dac', displayBrand: 'Denafrips' },
  'terminator': { expectedCategory: 'dac', displayBrand: 'Denafrips' },
  'pontus': { expectedCategory: 'dac', displayBrand: 'Denafrips' },
  'venus': { expectedCategory: 'dac', displayBrand: 'Denafrips' },
  'ares': { expectedCategory: 'dac', displayBrand: 'Denafrips' },
  'laiv harmony': { expectedCategory: 'dac', displayBrand: 'LAiV' },
  rockna: { expectedCategory: 'dac', displayBrand: 'Rockna' },
  wavelight: { expectedCategory: 'dac', displayBrand: 'Rockna' },
  wavedream: { expectedCategory: 'dac', displayBrand: 'Rockna' },
  dcs: { expectedCategory: 'dac', displayBrand: 'dCS' },
  bartók: { expectedCategory: 'dac', displayBrand: 'dCS' },
  bartok: { expectedCategory: 'dac', displayBrand: 'dCS' },
  rossini: { expectedCategory: 'dac', displayBrand: 'dCS' },
  vivaldi: { expectedCategory: 'dac', displayBrand: 'dCS' },
  'holo audio': { expectedCategory: 'dac', displayBrand: 'Holo Audio' },
  'may kte': { expectedCategory: 'dac', displayBrand: 'Holo Audio' },
  'holo may': { expectedCategory: 'dac', displayBrand: 'Holo Audio' },
  spring: { expectedCategory: 'dac', displayBrand: 'Holo Audio' },
};

/** Canonical role labels for human-readable display. */
const ROLE_DISPLAY: Record<string, string> = {
  streamer: 'a streamer',
  dac: 'a DAC',
  amplifier: 'an amplifier',
  integrated: 'an integrated amplifier',
  preamplifier: 'a preamplifier',
  speaker: 'a speaker',
  headphone: 'a headphone',
  turntable: 'a turntable',
  tonearm: 'a tonearm',
  cartridge: 'a cartridge',
  phono: 'a phono stage',
  component: 'a component',
};

/** Role keywords that can appear in user text near a product name. */
const USER_ROLE_KEYWORDS: { pattern: RegExp; role: string }[] = [
  { pattern: /\bstream(?:er|ing)?\b/i, role: 'streamer' },
  { pattern: /\bdac\b/i, role: 'dac' },
  { pattern: /\bamp(?:lifier)?\b/i, role: 'amplifier' },
  { pattern: /\bintegrated\b/i, role: 'integrated' },
  { pattern: /\bpre[- ]?amp/i, role: 'preamplifier' },
  { pattern: /\bspeak(?:er)?s?\b/i, role: 'speaker' },
  { pattern: /\bheadphone/i, role: 'headphone' },
  { pattern: /\bturntable\b/i, role: 'turntable' },
  { pattern: /\btone\s*arm\b/i, role: 'tonearm' },
  { pattern: /\bcartridge\b/i, role: 'cartridge' },
  { pattern: /\bphono\b/i, role: 'phono' },
];

/** Roles that are functionally equivalent for duplicate detection. */
const ROLE_EQUIVALENCES: Record<string, string> = {
  amplifier: 'amplification',
  integrated: 'amplification',
  'integrated-amplifier': 'amplification',
  preamplifier: 'preamplification',
  preamp: 'preamplification',
};

/**
 * Detect the role keyword the user applied to a product in the raw message.
 *
 * Scans a window of text around the product name for role keywords.
 * Returns the detected role or undefined if no role keyword is nearby.
 */
function detectUserAppliedRole(
  rawMessage: string,
  productName: string,
  otherComponentNames?: string[],
): string | undefined {
  const msgLower = rawMessage.toLowerCase();
  const prodLower = productName.toLowerCase();
  const prodIdx = msgLower.indexOf(prodLower);
  if (prodIdx < 0) return undefined;

  // Extract the text segment between the previous and next chain separators
  // (arrows, "into", commas) around the product name. This prevents role
  // keywords attached to other products from being picked up.
  const SEP = /(?:\s*(?:→|—>|-{1,3}>|={1,2}>|>{2,3})\s*|\s+into\s+|\s*,\s*)/g;
  const separators: { start: number; end: number }[] = [];
  let m;
  while ((m = SEP.exec(msgLower)) !== null) {
    separators.push({ start: m.index, end: m.index + m[0].length });
  }

  // Find the segment boundaries that contain the product name
  let segStart = 0;
  let segEnd = msgLower.length;
  for (const sep of separators) {
    if (sep.end <= prodIdx) segStart = sep.end;
    if (sep.start >= prodIdx + prodLower.length && sep.start < segEnd) {
      segEnd = sep.start;
    }
  }

  let segment = msgLower.substring(segStart, segEnd);

  // Mask out the product name itself and other component names
  segment = segment.replace(prodLower, ' '.repeat(prodLower.length));
  if (otherComponentNames) {
    for (const other of otherComponentNames) {
      segment = segment.replace(other.toLowerCase(), ' '.repeat(other.length));
    }
  }

  for (const { pattern, role } of USER_ROLE_KEYWORDS) {
    if (pattern.test(segment)) return role;
  }
  return undefined;
}

/**
 * Check whether two role strings conflict (are different functional roles)
 * or are compatible (same or equivalent).
 */
function rolesConflict(userRole: string, expectedRole: string): boolean {
  if (userRole === expectedRole) return false;
  // Check equivalences: amplifier ≈ integrated
  const userNorm = ROLE_EQUIVALENCES[userRole] ?? userRole;
  const expectedNorm = ROLE_EQUIVALENCES[expectedRole] ?? expectedRole;
  return userNorm !== expectedNorm;
}

interface ValidationIssue {
  kind: 'role-label-conflict' | 'chain-order-ambiguity' | 'duplicate-role';
  /** The product or component involved. */
  subject: string;
  /** Human-readable detail for the clarification prompt. */
  detail: string;
}

/**
 * Pre-assessment validation pass.
 *
 * Runs after component identification but before the assessment pipeline.
 * Detects conflicts that would produce misleading results if left unresolved.
 *
 * Returns a ClarificationResponse if a conflict needs user input,
 * or null if the system is clear to proceed.
 */
export function validateSystemComponents(
  rawMessage: string,
  components: SystemComponent[],
): ClarificationResponse | null {
  const issues: ValidationIssue[] = [];

  // ── 1. Role-label conflicts ──
  // Check whether the user labeled a product with a different role than
  // our catalog expects. E.g. "WiiM Pro DAC" when it's cataloged as a streamer.
  for (const c of components) {
    const nameLower = c.displayName.toLowerCase();

    // Find the best matching known product role
    let expectedCategory: string | undefined;
    let displayBrand: string | undefined;
    for (const [key, info] of Object.entries(KNOWN_PRODUCT_ROLES)) {
      if (nameLower.includes(key)) {
        expectedCategory = info.expectedCategory;
        displayBrand = info.displayBrand;
        break;
      }
    }

    // Also check catalog products
    if (!expectedCategory && c.product) {
      expectedCategory = c.product.category;
      displayBrand = c.product.brand;
    }

    if (!expectedCategory) continue;

    // Detect what role the user applied in their text
    const otherNames = components.filter((o) => o !== c).map((o) => o.displayName);
    const userAppliedRole = detectUserAppliedRole(rawMessage, c.displayName, otherNames);
    if (!userAppliedRole) continue;

    if (rolesConflict(userAppliedRole, expectedCategory)) {
      const userRoleDisplay = ROLE_DISPLAY[userAppliedRole] ?? userAppliedRole;
      const expectedDisplay = ROLE_DISPLAY[expectedCategory] ?? expectedCategory;
      const brand = displayBrand ?? c.displayName;

      // Generate a specific, direct clarification based on the conflict type
      if (expectedCategory === 'streamer' && userAppliedRole === 'dac') {
        issues.push({
          kind: 'role-label-conflict',
          subject: c.displayName,
          detail: `You described the ${c.displayName} as a DAC, but our data has it cataloged as a streamer. Are you using its internal DAC as your main conversion stage, or is it feeding an external DAC?`,
        });
      } else if (expectedCategory === 'dac' && userAppliedRole === 'streamer') {
        issues.push({
          kind: 'role-label-conflict',
          subject: c.displayName,
          detail: `You described the ${c.displayName} as a streamer, but our data has it as a DAC. Is it receiving a digital stream from a separate transport, or are you using a built-in streaming function?`,
        });
      } else if (expectedCategory === 'integrated' && (userAppliedRole === 'amplifier' || userAppliedRole === 'preamplifier')) {
        issues.push({
          kind: 'role-label-conflict',
          subject: c.displayName,
          detail: `The ${c.displayName} is an integrated amplifier. Are you using it as a full integrated, or only its power section with an external preamp?`,
        });
      } else {
        issues.push({
          kind: 'role-label-conflict',
          subject: c.displayName,
          detail: `You described the ${c.displayName} as ${userRoleDisplay}, but our data has it as ${expectedDisplay}. What role does it play in your chain?`,
        });
      }
    }
  }

  // ── 2. Duplicate-role conflicts ──
  // Detect when two or more components share the same functional role
  // without a clear indication of dual-use (bi-amping, multiple sources, etc.).
  // Conservative: only flag when the ambiguity is material — if the chain
  // order clearly implies which component is doing the main work, trust it.
  const roleCounts = new Map<string, SystemComponent[]>();
  for (const c of components) {
    const role = c.role.toLowerCase();
    // Normalize amplifier variants to a single bucket
    const normalizedRole = ROLE_EQUIVALENCES[role] ?? role;
    const bucket = roleCounts.get(normalizedRole) ?? [];
    bucket.push(c);
    roleCounts.set(normalizedRole, bucket);
  }

  // Only flag core signal-path roles, not accessories
  const FLAGGABLE_ROLES = new Set(['dac', 'amplification', 'preamplification', 'speaker', 'headphone', 'streamer']);

  // Check if the user provided an explicit chain order (arrows / "into")
  const chainExtracted = extractFullChain(rawMessage);
  const hasExplicitOrder = chainExtracted != null && chainExtracted.confidence === 'high';

  for (const [role, comps] of roleCounts) {
    if (comps.length < 2) continue;
    if (!FLAGGABLE_ROLES.has(role)) continue;

    // Don't flag if the user's message explicitly indicates dual-use
    const dualUseSignals = /\b(?:bi[- ]?amp|dual|both|pair(?:ed)?|stack(?:ed)?|two\b)/i;
    if (dualUseSignals.test(rawMessage)) continue;

    // If the user gave an explicit chain order (arrows / "into"), the sequence
    // itself resolves the ambiguity — e.g. "Streamer → DAC1 → DAC2 → Amp"
    // clearly shows DAC1 feeding DAC2. Don't force a clarification.
    if (hasExplicitOrder) continue;

    // For comma-separated or unordered input, check whether the components
    // occupy distinct positions in a canonical ordering attempt. If they do,
    // the order is still recoverable — e.g. a streamer-DAC and a standalone
    // DAC at different points in the chain. Only flag when truly ambiguous.
    if (chainExtracted && chainExtracted.confidence === 'medium') {
      // If canonical ordering succeeded, positions are recoverable — skip
      const canonical = tryCanonicalOrder(chainExtracted.segments);
      if (canonical) continue;
    }

    const names = comps.map((c) => c.displayName);
    const roleLabel = role === 'amplification' ? 'amplifier'
      : role === 'preamplification' ? 'preamplifier'
      : role;

    if (comps.length === 2) {
      issues.push({
        kind: 'duplicate-role',
        subject: names.join(' and '),
        detail: `${names[0]} and ${names[1]} both appear as ${roleLabel}s. Are both active in the signal path, or has one replaced the other?`,
      });
    } else {
      issues.push({
        kind: 'duplicate-role',
        subject: names.join(', '),
        detail: `${names.join(', ')} all appear in the ${roleLabel} role. Which are currently active in your signal path?`,
      });
    }
  }

  // ── 3. Chain-order ambiguity ──
  // Only flag when the full chain extraction returned medium confidence
  // AND the canonical ordering failed (couldn't classify all segments).
  // Reuse chainExtracted from duplicate-role check if available.
  const ambiguityExtracted = chainExtracted ?? extractFullChain(rawMessage);
  if (ambiguityExtracted && ambiguityExtracted.confidence === 'medium') {
    const canonicalAttempt = tryCanonicalOrder(ambiguityExtracted.segments);
    if (!canonicalAttempt) {
      issues.push({
        kind: 'chain-order-ambiguity',
        subject: 'signal path order',
        detail: 'I\'m not confident about the signal-flow order here. Could you describe the chain from source to output?',
      });
    }
  }

  // ── Build clarification response ──
  if (issues.length === 0) return null;

  // Prioritise: role-label > duplicate-role > chain-order
  // Only surface the first issue to keep the prompt focused.
  const prioritised = issues.sort((a, b) => {
    const order: Record<string, number> = {
      'role-label-conflict': 0,
      'duplicate-role': 1,
      'chain-order-ambiguity': 2,
    };
    return (order[a.kind] ?? 99) - (order[b.kind] ?? 99);
  });

  const primary = prioritised[0];

  return {
    acknowledge: 'Quick clarification before I run the assessment.',
    question: primary.detail,
  };
}

/**
 * Build a system assessment response for a multi-component system description.
 *
 * For each named subject, looks up brand profiles and product data to compose
 * per-component descriptions, then synthesizes a system interaction summary.
 *
 * Returns null if fewer than 2 components can be identified.
 */
/**
 * Build a clean display name from brand + product name.
 * Prevents duplication like "JOB JOB Integrated" when the product name
 * already contains the brand name as a prefix.
 */
/**
 * Substring match with word-boundary awareness for short terms.
 * For terms ≤4 characters, requires a word boundary on both sides
 * to prevent false positives (e.g. "W5" matching inside "W500" or prose).
 * For longer terms, uses simple includes() — false positives are unlikely.
 */
function wordAwareIncludes(haystack: string, needle: string): boolean {
  if (!needle || needle.length === 0) return false;
  if (needle.length <= 4) {
    // Word-boundary match for short names
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\b|[\\s(])${escaped}(?:\\b|[\\s).,!?]|$)`, 'i').test(haystack);
  }
  return haystack.includes(needle);
}

/**
 * Strip parenthetical version / section tags from a component name.
 *
 * Examples:
 *   "Hugo (v1)"         → "Hugo"
 *   "Hugo (v2)"         → "Hugo"
 *   "Integrated (amp section)" → "Integrated"
 *   "Diva Monitor"      → "Diva Monitor"  (no parenthetical — unchanged)
 *
 * The stripped tag is informational only — callers that need it can
 * capture it separately.
 */
function stripVersionTag(name: string): string {
  // Match trailing parenthetical like (v1), (v2), (amp section), (mk2), (gen 3)
  return name.replace(/\s*\((?:v\d+|mk\s*\d+|gen\s*\d+|rev\s*\w+|amp\s+section|dac\s+section|pre\s*amp?\s+section)\)\s*$/i, '').trim();
}

function normalizeDisplayName(brand: string, name: string): string {
  const b = brand.trim();
  const n = stripVersionTag(name.trim());
  if (!b) return n || 'Unknown';
  if (!n) return b;
  // If name starts with the brand (case-insensitive), don't repeat the brand
  if (n.toLowerCase().startsWith(b.toLowerCase())) {
    return n.charAt(0).toUpperCase() + n.slice(1);
  }
  return `${b} ${n}`;
}

/** Result of buildSystemAssessment — either a full assessment, a clarification, or a low-confidence signal. */
export type SystemAssessmentResult =
  | { kind: 'assessment'; response: ConsultationResponse; findings: MemoFindings }
  | { kind: 'clarification'; clarification: ClarificationResponse }
  | { kind: 'low_confidence'; components: SystemComponent[]; unknownComponents: string[]; query: string }
  | null;

export function buildSystemAssessment(
  currentMessage: string,
  subjectMatches: SubjectMatch[],
  activeSystem?: ActiveSystemContext | null,
  desires?: DesireSignal[],
): SystemAssessmentResult {
  const components: SystemComponent[] = [];
  const allLinks: { label: string; url: string; kind?: 'reference' | 'dealer' | 'review'; region?: string }[] = [];
  /** Per-component links keyed by displayName. */
  const componentLinks = new Map<string, { label: string; url: string; kind?: 'reference' | 'dealer' | 'review'; region?: string }[]>();
  const processedNames = new Set<string>();

  /** Track a link for both the global list and a specific component. */
  function trackLink(
    link: { label: string; url: string; kind?: 'reference' | 'dealer' | 'review'; region?: string },
    forComponent?: string,
  ) {
    if (!allLinks.some((al) => al.url === link.url)) {
      allLinks.push(link);
    }
    if (forComponent) {
      const existing = componentLinks.get(forComponent) ?? [];
      if (!existing.some((l) => l.url === link.url)) {
        existing.push(link);
        componentLinks.set(forComponent, existing);
      }
    }
  }

  // ── Seed from active system when available ──
  // Only include components that are mentioned (by brand or model name) in the
  // current message. This prevents cross-contamination from saved systems that
  // include components not part of the chain being evaluated.
  const msgLowerForSeed = currentMessage.toLowerCase();
  if (activeSystem && activeSystem.components.length > 0) {
    for (const ac of activeSystem.components) {
      const fullName = normalizeDisplayName(ac.brand, ac.name);
      const nameLower = ac.name.toLowerCase();
      const strippedNameLower = stripVersionTag(ac.name).toLowerCase();
      const brandLower = ac.brand.toLowerCase();
      if (processedNames.has(nameLower) || processedNames.has(strippedNameLower) || processedNames.has(brandLower)) continue;

      // Only seed if the component's brand or model name appears in the message.
      // Use word-boundary matching for short names (≤4 chars) to prevent
      // false positives like "W5" matching inside unrelated words.
      const mentionedInMessage = wordAwareIncludes(msgLowerForSeed, fullName.toLowerCase())
        || wordAwareIncludes(msgLowerForSeed, nameLower)
        || wordAwareIncludes(msgLowerForSeed, strippedNameLower)
        || wordAwareIncludes(msgLowerForSeed, brandLower);
      if (!mentionedInMessage) continue;

      processedNames.add(nameLower);
      processedNames.add(strippedNameLower);
      processedNames.add(brandLower);

      // Try to find rich catalog data (use stripped name for matching too)
      const product = ALL_PRODUCTS.find(
        (p) => {
          const pName = p.name.toLowerCase();
          const pFull = `${p.brand} ${p.name}`.toLowerCase();
          const pBrand = p.brand.toLowerCase();
          return pName === nameLower
            || pName === strippedNameLower
            || pFull === fullName.toLowerCase()
            // Brand+partial-name: "horn" matches inside "horns" when brand matches
            || (pBrand === brandLower && nameLower.length >= 2 && pName.includes(nameLower))
            || (pBrand === brandLower && strippedNameLower.length >= 2 && pName.includes(strippedNameLower));
        },
      );
      // Also mark partial product name forms as processed (e.g. "diva" for "Diva Monitor")
      // to prevent subject-match duplication
      if (product) {
        const prodNameWords = product.name.toLowerCase().split(/\s+/);
        for (const word of prodNameWords) {
          if (word.length >= 3) processedNames.add(word);
        }
      }
      const brandProfile = findBrandProfileByName(ac.brand);
      const designFamily = brandProfile?.designFamilies?.find((df) =>
        nameLower.includes(df.name.split(' ')[0].toLowerCase())
          || df.name.toLowerCase().includes(nameLower),
      );

      components.push({
        displayName: fullName,
        role: product?.category ?? ac.category ?? 'component',
        character: product?.description
          ?? designFamily?.character
          ?? brandProfile?.tendencies
          ?? `${ac.brand} ${ac.category ?? 'component'}`,
        brandProfile: brandProfile ? {
          philosophy: brandProfile.philosophy,
          tendencies: brandProfile.tendencies,
          systemContext: brandProfile.systemContext,
          designFamily: designFamily ? { name: designFamily.name, character: designFamily.character, ampPairing: designFamily.ampPairing } : undefined,
        } : undefined,
        product: product ?? undefined,
      });

      // Collect links from catalog matches — track per-component
      if (product?.retailer_links) {
        for (const l of product.retailer_links) {
          trackLink({ label: l.label, url: l.url }, fullName);
        }
      }
      if (brandProfile?.links) {
        for (const l of brandProfile.links) {
          trackLink({ label: l.label, url: l.url, kind: l.kind, region: l.region }, fullName);
        }
      }
    }
  }

  for (const match of subjectMatches) {
    const lower = match.name.toLowerCase();
    if (processedNames.has(lower)) continue;
    // Skip parenthetical brand clarifications — e.g. "Job (Goldmund)"
    // where Goldmund is a manufacturer note, not a separate component
    if (match.parenthetical) {
      processedNames.add(lower);
      continue;
    }
    processedNames.add(lower);

    if (match.kind === 'product') {
      // Product-level lookup — try exact name, brand+name compound, partial name,
      // and brand+partial-name (handles singular/plural: "hornshoppe horn" → "Hornshoppe Horns")
      const product = ALL_PRODUCTS.find(
        (p) => {
          const pName = p.name.toLowerCase();
          const pFull = `${p.brand} ${p.name}`.toLowerCase();
          const pBrand = p.brand.toLowerCase();
          return pName === lower
            || pFull === lower
            || (lower.length >= 3 && pName.startsWith(lower))
            // Brand+partial-name: input contains brand AND product name contains the remainder
            // e.g. "hornshoppe horn" → brand "hornshoppe" matches, name "horns" includes "horn"
            || (lower.includes(pBrand) && pBrand.length >= 3 && (() => {
              const remainder = lower.replace(pBrand, '').trim();
              return remainder.length >= 2 && pName.includes(remainder);
            })());
        },
      );
      if (product) {
        // Also check if there's a brand profile
        const brandProfile = findBrandProfileByName(product.brand);
        const designFamily = brandProfile?.designFamilies?.find((df) =>
          product.name.toLowerCase().includes(df.name.split(' ')[0].toLowerCase())
            || df.name.toLowerCase().includes(product.name.toLowerCase()),
        );

        components.push({
          displayName: normalizeDisplayName(product.brand, product.name),
          role: product.category,
          character: product.description,
          brandProfile: brandProfile ? {
            philosophy: brandProfile.philosophy,
            tendencies: brandProfile.tendencies,
            systemContext: brandProfile.systemContext,
            designFamily: designFamily ? { name: designFamily.name, character: designFamily.character, ampPairing: designFamily.ampPairing } : undefined,
          } : undefined,
          product,
        });

        // Collect product links — track per-component
        const prodDisplayName = normalizeDisplayName(product.brand, product.name);
        if (product.retailer_links) {
          for (const l of product.retailer_links) {
            trackLink({ label: l.label, url: l.url }, prodDisplayName);
          }
        }

        // Collect brand links
        if (brandProfile?.links) {
          for (const l of brandProfile.links) {
            trackLink({ label: l.label, url: l.url, kind: l.kind, region: l.region }, prodDisplayName);
          }
        }

        // Mark brand and full product name as processed too
        // (prevents duplication when active system uses full name like "Diva Monitor"
        // and subject match uses shorter form like "diva")
        processedNames.add(product.brand.toLowerCase());
        processedNames.add(product.name.toLowerCase());
      } else {
        // Product name recognized but not in catalog — infer from message context.
        // Find the brand NEAREST to this product in the raw text (not just the first
        // unprocessed brand). This prevents "DMP-A6" being paired with "Chord" when
        // "Eversolo" is the adjacent brand.
        const msgLower = currentMessage.toLowerCase();
        const prodIdx = msgLower.indexOf(lower);

        // Score brand matches by proximity to the product name
        const candidateBrands = subjectMatches
          .filter((m) => m.kind === 'brand' && !processedNames.has(m.name.toLowerCase()))
          .map((m) => {
            const brandIdx = msgLower.indexOf(m.name.toLowerCase());
            return { match: m, distance: brandIdx >= 0 ? Math.abs(brandIdx - prodIdx) : Infinity };
          })
          .sort((a, b) => a.distance - b.distance);

        const brandMatch = candidateBrands.length > 0 ? candidateBrands[0].match : undefined;
        let brandName = '';
        if (brandMatch) {
          // Use KNOWN_PRODUCT_ROLES displayBrand for proper casing (e.g. "XSA" not "Xsa")
          const knownBrandInfo = Object.values(KNOWN_PRODUCT_ROLES).find(
            (info) => info.displayBrand.toLowerCase() === brandMatch.name.toLowerCase(),
          );
          brandName = knownBrandInfo?.displayBrand
            ?? brandMatch.name.charAt(0).toUpperCase() + brandMatch.name.slice(1);
          processedNames.add(brandMatch.name.toLowerCase());
        }

        // Preserve original casing for model names with hyphens (DMP-A6, DAC-Z8)
        let productName = match.name.includes('-')
          ? match.name.toUpperCase()
          : match.name.charAt(0).toUpperCase() + match.name.slice(1);
        // Strip brand prefix from product name if already present (e.g. "leben cs300" → "CS300")
        if (brandName && productName.toLowerCase().startsWith(brandName.toLowerCase() + ' ')) {
          const modelPart = productName.substring(brandName.length + 1).trim();
          productName = modelPart.toUpperCase();
        }
        const displayName = brandName ? `${brandName} ${productName}` : productName;

        // Infer role from nearby text (within ~40 chars of the product name)
        const nearbyText = msgLower.substring(
          Math.max(0, prodIdx - 10),
          Math.min(msgLower.length, prodIdx + lower.length + 40),
        );
        let role: string = 'component';
        if (/stream/i.test(nearbyText)) role = 'streamer';
        else if (/\bdac\b/i.test(nearbyText)) role = 'dac';
        else if (/\bamp/i.test(nearbyText) || /\bintegrated\b/i.test(nearbyText)) role = 'amplifier';
        else if (/\bspeak/i.test(nearbyText)) role = 'speaker';

        // Fallback: check KNOWN_PRODUCT_ROLES if nearby-text inference produced 'component'
        if (role === 'component') {
          for (const [key, info] of Object.entries(KNOWN_PRODUCT_ROLES)) {
            if (lower.includes(key) || key.includes(lower)) {
              role = info.expectedCategory;
              if (!brandName) {
                brandName = info.displayBrand;
                processedNames.add(info.displayBrand.toLowerCase());
              }
              break;
            }
          }
        }

        // Try brand profile for character info
        const bp = brandName ? findBrandProfile(brandName) : undefined;

        // Fallback: check brand category from brand profile
        if (role === 'component' && bp?.categories?.[0]) {
          role = bp.categories[0];
        }

        components.push({
          displayName,
          role,
          character: bp?.tendencies ?? `${displayName} ${role}`,
          brandProfile: bp ? {
            philosophy: bp.philosophy,
            tendencies: bp.tendencies,
            systemContext: bp.systemContext,
          } : undefined,
          product: undefined,
        });
      }
    } else {
      // Brand-level lookup
      const brandProfile = findBrandProfile(match.name);
      if (brandProfile) {
        // Find specific design family if mentioned in the message
        const designFamily = brandProfile.designFamilies?.find((df) => {
          const dfWords = df.name.toLowerCase().split(/\s+/);
          return dfWords.some((w) => w.length > 2 && currentMessage.toLowerCase().includes(w));
        });

        // Check if there's a matching product in catalog
        const brandProducts = ALL_PRODUCTS.filter(
          (p) => p.brand.toLowerCase() === match.name.toLowerCase()
            || brandProfile.names.some((bn) => p.brand.toLowerCase() === bn.toLowerCase()),
        );
        // Find specific product mentioned in message
        const specificProduct = brandProducts.find((p) =>
          currentMessage.toLowerCase().includes(p.name.toLowerCase()),
        );

        const displayName = specificProduct
          ? normalizeDisplayName(specificProduct.brand, specificProduct.name)
          : brandProfile.names[0].split(' ').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

        const role = specificProduct?.category
          ?? brandProfile.categories?.[0]
          ?? 'component';

        const character = specificProduct?.description
          ?? (designFamily
            ? designFamily.character
            : brandProfile.tendencies);

        components.push({
          displayName,
          role,
          character,
          brandProfile: {
            philosophy: brandProfile.philosophy,
            tendencies: brandProfile.tendencies,
            systemContext: brandProfile.systemContext,
            designFamily: designFamily ? { name: designFamily.name, character: designFamily.character, ampPairing: designFamily.ampPairing } : undefined,
          },
          product: specificProduct,
        });

        // Collect brand links — track per-component
        if (brandProfile.links) {
          for (const l of brandProfile.links) {
            trackLink({ label: l.label, url: l.url, kind: l.kind, region: l.region }, displayName);
          }
        }

        // Collect specific product links
        if (specificProduct?.retailer_links) {
          for (const l of specificProduct.retailer_links) {
            trackLink({ label: l.label, url: l.url }, displayName);
          }
        }
      } else {
        // Brand recognized but no profile — still include as a component
        // so it appears in the chain. Infer role from message context.
        const capitalized = match.name.charAt(0).toUpperCase() + match.name.slice(1);
        const surroundingText = currentMessage.toLowerCase();
        let role: string = 'component';

        // Check for role keywords near the brand name
        const brandIdx = surroundingText.indexOf(match.name.toLowerCase());
        const nearbyText = surroundingText.substring(
          Math.max(0, brandIdx - 10),
          Math.min(surroundingText.length, brandIdx + match.name.length + 40),
        );
        if (/stream/i.test(nearbyText)) role = 'streamer';
        else if (/\bdac\b/i.test(nearbyText)) role = 'dac';
        else if (/\bamp/i.test(nearbyText)) role = 'amplifier';
        else if (/\bspeak/i.test(nearbyText)) role = 'speaker';
        else if (/\bintegrated\b/i.test(nearbyText)) role = 'integrated';

        // Fallback: check KNOWN_PRODUCT_ROLES for the brand name or nearby model names
        if (role === 'component') {
          // Try the brand name itself
          const brandLower = match.name.toLowerCase();
          const knownBrand = KNOWN_PRODUCT_ROLES[brandLower];
          if (knownBrand) {
            role = knownBrand.expectedCategory;
          } else {
            // Try model names near the brand in the message text
            for (const [key, info] of Object.entries(KNOWN_PRODUCT_ROLES)) {
              if (info.displayBrand.toLowerCase() === brandLower && nearbyText.includes(key)) {
                role = info.expectedCategory;
                break;
              }
            }
          }
        }

        // Find any product from this brand mentioned in the message
        const brandProducts = ALL_PRODUCTS.filter(
          (p) => p.brand.toLowerCase() === match.name.toLowerCase(),
        );
        const specificProduct = brandProducts.find((p) =>
          currentMessage.toLowerCase().includes(p.name.toLowerCase()),
        );

        // Try to find a model name near the brand for better display name
        let displayName = specificProduct
          ? normalizeDisplayName(specificProduct.brand, specificProduct.name)
          : capitalized;
        if (!specificProduct) {
          // Check KNOWN_PRODUCT_ROLES for model names from this brand in the message
          for (const [key, info] of Object.entries(KNOWN_PRODUCT_ROLES)) {
            if (info.displayBrand.toLowerCase() === match.name.toLowerCase()
                && key !== match.name.toLowerCase()
                && currentMessage.toLowerCase().includes(key)) {
              displayName = `${capitalized} ${key.toUpperCase()}`;
              break;
            }
          }
        }

        components.push({
          displayName,
          role: specificProduct?.category ?? role,
          character: specificProduct?.description ?? `${capitalized} ${role}`,
          product: specificProduct,
        });

        if (specificProduct?.retailer_links) {
          for (const l of specificProduct.retailer_links) {
            trackLink({ label: l.label, url: l.url }, displayName);
          }
        }
      }
    }
  }

  // Need at least 2 identified components to build a system assessment
  if (components.length < 2) return null;

  // ── Pre-assessment validation pass ──
  // Check for role-label conflicts, duplicate roles, and chain-order ambiguity
  // before running the full assessment pipeline.
  const validationClarification = validateSystemComponents(currentMessage, components);
  if (validationClarification) {
    return { kind: 'clarification', clarification: validationClarification };
  }

  // ── Step 0: Confidence check — do we have enough catalog coverage? ──
  // If too many components are unknown, the deterministic model will produce
  // misleading results (unknown components default to neutral, so the one
  // known component dominates the signature). In that case, signal the caller
  // to use the provisional LLM-assisted assessment instead.
  const componentAxisProfiles = classifyComponentAxes(components);
  const confidence = computeSystemConfidence(
    componentAxisProfiles.map(p => ({ name: p.name, source: p.source })),
    components.map(c => c.role),
  );
  if (confidence.level === 'low') {
    return {
      kind: 'low_confidence',
      components,
      unknownComponents: confidence.unknownComponents,
      query: currentMessage,
    };
  }

  // ── Step 1: Resolve axis positions for each component ──
  // This happens BEFORE prose generation so that system-level reasoning
  // (compounding, compensation, balance) is available to all downstream steps.
  const systemAxes = synthesiseSystemAxes(
    componentAxisProfiles.map(p => p.axes),
    components.map(c => c.role),
  );
  const axisCompounding = detectCompounding(componentAxisProfiles.map(p => p.axes));

  // ── Build per-component character paragraphs ──────
  const componentParagraphs = components.map((c) => {
    let para = `The ${c.displayName}`;

    if (c.product && hasTendencies(c.product.tendencies)) {
      // Rich product data available — use product description + design family context
      para += ` — ${c.character}`;
      if (c.brandProfile?.designFamily?.ampPairing) {
        para += ` ${c.brandProfile.designFamily.ampPairing}`;
      }
    } else if (c.brandProfile) {
      // Brand-level only — use brand tendencies + design family if available
      if (c.brandProfile.designFamily) {
        para += ` is part of the ${c.brandProfile.designFamily.name}. ${c.brandProfile.designFamily.character}`;
        if (c.brandProfile.designFamily.ampPairing) {
          para += ` ${c.brandProfile.designFamily.ampPairing}`;
        }
      } else {
        para += ` — ${c.character}`;
      }
    } else {
      para += ` — ${c.character}`;
    }

    return para;
  });

  // ── Infer system interaction (step 1: system character) ──
  const interactionSummary = inferSystemInteraction(components);

  // ── Amplifier-speaker fit note ──────────────────────
  const ampSpeakerFit = inferAmplifierSpeakerFit(components);

  // ── Build "what's working well" ──────────────────────
  const assessmentStrengths = inferAssessmentStrengths(components);

  // ── Build "where limitations may appear" ─────────────
  const assessmentLimitations = inferAssessmentLimitations(components);

  // ── Build upgrade direction ──────────────────────────
  const upgradeDirection = inferUpgradeDirection(components);

  // ── Preference alignment (step 5) ─────────────────────
  const preferenceNote = buildAssessmentPreferenceAlignment(components, desires);

  // ── Follow-up — preference-aware when possible ────────
  const followUp = preferenceNote
    ? preferenceNote + '\n\nIf you want to explore a specific direction, name the quality or the component — that narrows the analysis.'
    : 'What are you exploring — is there something you\'d like to change about this balance, or are you looking to understand what a specific upgrade path might shift?';

  // ── Subject line ────────────────────────────────────
  const subject = components.map((c) => c.displayName).join(', ');

  // ── System tier estimation ──────────────────────────
  // Determines whether this is a reference-level system where bottleneck
  // analysis should be suppressed or softened. Based on brand reputation,
  // component prices, and system complexity.
  const systemTier = estimateSystemTier(components);

  // ── Structured memo-format fields ───────────────────
  // Pipeline: chain → stacked traits → bottleneck → assessments → paths → sequence → observation
  const memoChain = buildSystemChain(components, currentMessage);
  const memoStacked = detectStackedTraits(components, componentAxisProfiles);
  const memoConstraint = systemTier === 'reference'
    ? undefined  // Reference-level systems don't have meaningful bottlenecks
    : detectPrimaryConstraint(components, componentAxisProfiles, memoStacked, systemAxes);
  const memoAssessments = buildComponentAssessments(components, componentAxisProfiles, memoConstraint);
  const memoUpgradePaths = systemTier === 'reference'
    ? []  // Suppress upgrade paths for reference-tier systems
    : buildUpgradePaths(components, componentAxisProfiles, memoAssessments, memoConstraint, memoStacked);
  const memoKeepsRaw = buildKeepRecommendations(memoAssessments, memoUpgradePaths, memoConstraint);
  const memoIntro = buildIntroSummary(components, systemAxes, memoStacked, systemTier);
  const memoKeyObservation = buildKeyObservation(components, componentAxisProfiles, memoStacked, systemAxes, desires);

  // ── Final reconciliation pass ─────────────────────
  // Ensures no component appears in conflicting statuses:
  //   keeper ↔ upgrade target ↔ bottleneck
  // Also reconciles the "What I Would Personally Do" sequence.
  const { keeps: memoKeeps, sequence: memoSequence } = reconcileAssessmentOutputs(
    components,
    memoAssessments,
    memoUpgradePaths,
    memoKeepsRaw,
    memoConstraint,
  );

  // ── Collect source references from catalogued products ──
  // Cross-reference with retailer_links to find review URLs.
  // Only whitelisted publications are surfaced to users (see source-whitelist.ts).
  // Non-whitelisted sources are still used internally for trait synthesis.
  // isWhitelistedSource is imported statically at top of file
  const memoSourceRefs: import('./advisory-response').SourceReference[] = [];
  const seenSources = new Set<string>();
  for (const c of components) {
    if (c.product?.sourceReferences) {
      for (const ref of c.product.sourceReferences) {
        if (!seenSources.has(ref.source) && isWhitelistedSource(ref.source)) {
          seenSources.add(ref.source);
          const matchingLink = c.product.retailer_links?.find(
            (l: { label: string; url: string }) =>
              l.label.toLowerCase().includes(ref.source.toLowerCase()) && l.label.toLowerCase().includes('review'),
          );
          memoSourceRefs.push({ source: ref.source, note: ref.note, url: ref.url ?? matchingLink?.url });
        }
      }
    }
  }

  // ── Extract MemoFindings contract ──────────────────
  // The structured contract between the deterministic pipeline and
  // all downstream renderers. Produced BEFORE any prose rendering.
  const findings: MemoFindings = extractMemoFindings(
    components,
    componentAxisProfiles,
    memoChain,
    systemAxes,
    memoStacked,
    memoConstraint,
    memoAssessments,
    memoUpgradePaths,
    memoKeeps,
    memoSequence,
    memoSourceRefs,
    desires,
    componentLinks,
  );

  // ── System character opening (brief) ──────────────
  // A one-two sentence overview of the system's overall lean.
  const systemCharacterOpening = inferSystemCharacterOpening(components);

  // ── Interaction detail ──────────────────────────────
  // How the components interact — more detailed architectural reading.
  const interactionParts = [interactionSummary];
  if (ampSpeakerFit) interactionParts.push(ampSpeakerFit);
  const systemInteractionDetail = interactionParts.join(' ');

  // ── Render via deterministic renderer ─────────────
  // Assemble prose and structured inputs, then delegate to the
  // renderer. This is the same output as before — just routed
  // through the renderer for structural separation.
  // ── Build title ──
  // Use the active system's name (e.g. "Living Room") if available,
  // otherwise generate from the component names.
  // Use the active system's name if available, but avoid "X System System" duplication.
  const rawName = activeSystem?.name ?? '';
  const assessmentTitle = rawName
    ? (rawName.toLowerCase().endsWith('system') ? rawName : `${rawName} System`)
    : `System Assessment`;

  const prose: LegacyProseInputs = {
    title: assessmentTitle,
    subject,
    systemCharacterOpening,
    componentParagraphs,
    systemInteraction: systemInteractionDetail,
    assessmentStrengths,
    assessmentLimitations,
    upgradeDirection,
    followUp,
    links: allLinks,
    introSummary: memoIntro,
    keyObservation: memoKeyObservation,
  };

  // TRANSITIONAL: passing StructuredMemoInputs for behavioral parity.
  // The canonical path is renderDeterministicMemo(findings, prose) — parity
  // tests confirm equivalent output. Remove this block and switch to the
  // two-argument call once validated in production.
  const structured: StructuredMemoInputs = {
    systemChain: memoChain,
    primaryConstraint: memoConstraint,
    stackedTraitInsights: memoStacked,
    componentAssessments: memoAssessments,
    upgradePaths: memoUpgradePaths,
    keepRecommendations: memoKeeps,
    recommendedSequence: memoSequence,
    sourceReferences: memoSourceRefs,
  };

  const response = renderDeterministicMemo(findings, prose, structured);

  return { kind: 'assessment', findings, response };
}

/**
 * Brief system character opening — one or two sentences summarising
 * the overall architectural lean before the component-by-component detail.
 *
 * Uses the 4-axis model to describe system character with more nuance
 * than the legacy warm/precise binary.
 */
function inferSystemCharacterOpening(components: SystemComponent[]): string {
  const profiles = classifyComponentAxes(components);
  const axes = profiles.map(p => p.axes);
  const roles = components.map(c => c.role);
  const system = synthesiseSystemAxes(axes, roles);

  // Use numeric intensities for nuance detection
  const weights = roles.map(r => {
    const rl = r.toLowerCase();
    if (rl.includes('speak') || rl.includes('headphone') || rl.includes('monitor')) return 3;
    if (rl.includes('dac')) return 2;
    if (rl.includes('amp') || rl.includes('integrated') || rl.includes('preamp')) return 1.5;
    if (rl.includes('stream') || rl.includes('source') || rl.includes('transport')) return 0.5;
    return 1;
  });
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  function numericAvg(axis: 'warm_bright_n' | 'smooth_detailed_n' | 'elastic_controlled_n' | 'scale_intimacy_n'): number {
    let sum = 0;
    for (let i = 0; i < axes.length; i++) {
      const val = (axes[i] as unknown as Record<string, unknown>)[axis];
      sum += (typeof val === 'number' ? val : 0) * weights[i];
    }
    return sum / totalWeight;
  }

  const wb = numericAvg('warm_bright_n');
  const sd = numericAvg('smooth_detailed_n');
  const ec = numericAvg('elastic_controlled_n');
  const ac = numericAvg('scale_intimacy_n');

  // Classify each axis as strong (>0.7), moderate (>0.3), contested (<=0.3), or neutral (~0)
  const CONTESTED_THRESHOLD = 0.35;

  // Build descriptors only for axes with clear direction
  const strongTraits: string[] = [];
  const contestedAxes: string[] = [];

  if (Math.abs(wb) > CONTESTED_THRESHOLD) {
    strongTraits.push(wb < 0 ? 'warmth' : 'brightness');
  } else if (Math.abs(wb) > 0.1) {
    contestedAxes.push('tonality');
  }

  if (Math.abs(sd) > CONTESTED_THRESHOLD) {
    strongTraits.push(sd < 0 ? 'smoothness' : 'detail retrieval');
  } else if (Math.abs(sd) > 0.1) {
    contestedAxes.push('texture');
  }

  if (Math.abs(ec) > CONTESTED_THRESHOLD) {
    strongTraits.push(ec < 0 ? 'dynamic elasticity' : 'control');
  }

  if (Math.abs(ac) > CONTESTED_THRESHOLD) {
    strongTraits.push(ac < 0 ? 'spatial openness' : 'intimacy');
  }

  // NOTE: Component names are omitted here — the chain section lists them.
  // Keep this paragraph short to fit within the ~120-150 word overview target.

  if (contestedAxes.length > 0 && strongTraits.length > 0) {
    return `The system's clear strengths are ${strongTraits.join(' and ')}. On ${contestedAxes.join(' and ')}, components pull in different directions — the source and amplifier lean one way, the speakers another — creating complementary tension rather than uniform agreement.`;
  }

  if (strongTraits.length === 0 && contestedAxes.length > 0) {
    return `The components pull in different directions across ${contestedAxes.join(' and ')}, creating a balanced system where opposing tendencies offset each other. The overall character emerges from this tension rather than from shared emphasis.`;
  }

  if (strongTraits.length === 0) {
    return `The chain has balanced tendencies — no single tonal or textural direction dominates. The overall character depends on how these components interact in practice.`;
  }

  if (strongTraits.length === 1) {
    return `The chain leans toward ${strongTraits[0]}, with the remaining axes staying relatively neutral.`;
  }

  return `The system is characterised by ${strongTraits.join(' and ')}.`;
}

/**
 * Infer how the named components interact in a system.
 * Deterministic — based on known brand/product tendencies.
 *
 * Uses the 4-axis model to describe interaction with more nuance:
 * compounding, compensation, and per-axis descriptions.
 */
function inferSystemInteraction(components: SystemComponent[]): string {
  const profiles = classifyComponentAxes(components);
  const axes = profiles.map(p => p.axes);
  const compounding = detectCompounding(axes);
  const system = synthesiseSystemAxes(axes, components.map(c => c.role));

  // NOTE: Architecture/design notes (causalNote) removed from this function.
  // They belong in per-component assessment sections, not the overview.

  // ── Per-axis component grouping for narrative ────────
  const warmComponents = profiles.filter(p => p.axes.warm_bright === 'warm').map(p => p.name);
  const brightComponents = profiles.filter(p => p.axes.warm_bright === 'bright').map(p => p.name);
  const smoothComponents = profiles.filter(p => p.axes.smooth_detailed === 'smooth').map(p => p.name);
  const detailedComponents = profiles.filter(p => p.axes.smooth_detailed === 'detailed').map(p => p.name);

  // ── Detect complementary tension FIRST ──
  // When warm and bright components coexist, or smooth and detailed coexist,
  // this is complementary balance — not uniform agreement.
  const hasWarmBrightTension = warmComponents.length > 0 && brightComponents.length > 0;
  const hasSmoothDetailedTension = smoothComponents.length > 0 && detailedComponents.length > 0;

  if (hasWarmBrightTension || hasSmoothDetailedTension) {
    const parts: string[] = [];
    if (hasWarmBrightTension) {
      parts.push(`${warmComponents.join(' and ')} ${warmComponents.length === 1 ? 'provides' : 'provide'} warmth and body, while ${brightComponents.join(' and ')} ${brightComponents.length === 1 ? 'adds' : 'add'} speed and articulation`);
    }
    if (hasSmoothDetailedTension) {
      parts.push(`${smoothComponents.join(' and ')} ${smoothComponents.length === 1 ? 'provides' : 'provide'} musical flow, while ${detailedComponents.join(' and ')} ${detailedComponents.length === 1 ? 'adds' : 'add'} resolution and transparency`);
    }

    // Note any compounding axes alongside the tension
    const compoundDesc = compounding.map(w => {
      if (w.includes('Elastic')) return 'dynamic elasticity';
      if (w.includes('Controlled')) return 'control';
      if (w.includes('Scale')) return 'scale';
      if (w.includes('Intimacy')) return 'intimacy';
      return null;
    }).filter(Boolean);

    let result = `Complementary balance: ${parts.join('; ')}.`;
    if (compoundDesc.length > 0) {
      result += ` Where the components do agree is ${compoundDesc.join(' and ')} — multiple stages reinforce this direction.`;
    }
    return result;
  }

  // ── Compounding / alignment (only when no complementary tension) ──
  if (compounding.length > 0) {
    const compoundDesc = compounding.map(w => {
      if (w.includes('Warm')) return 'warmth';
      if (w.includes('Bright')) return 'brightness';
      if (w.includes('Smooth')) return 'smoothness';
      if (w.includes('Detailed')) return 'detail';
      if (w.includes('Elastic')) return 'dynamic energy';
      if (w.includes('Controlled')) return 'control';
      if (w.includes('Scale')) return 'scale';
      if (w.includes('Intimacy')) return 'intimacy';
      return 'a shared tendency';
    });
    return `The system leans toward ${compoundDesc.join(' and ')} across the chain — multiple components push in the same direction, creating a strong and coherent character.`;
  }

  // ── Single-axis lean ──
  if (system.warm_bright === 'warm') {
    return `The chain leans toward warmth and engagement — richness and immersion at the potential cost of transient articulation.`;
  }
  if (system.warm_bright === 'bright') {
    return `The chain leans toward precision and clarity — a revealing presentation, though extended sessions may feel lean without a warmth source.`;
  }

  // Mixed or all-neutral
  return `Each component brings distinct tendencies. The overall character depends on their interaction in practice.`;
}

// ── Amplifier power classification (from topology) ──

type PowerTier = 'very-low' | 'low' | 'moderate' | 'high';

function classifyAmpPower(amp: SystemComponent): PowerTier {
  const topology = amp.product?.topology;

  // Check architecture string for explicit low wattage (e.g. "20W/ch")
  const archStr = (amp.product?.architecture ?? '').toLowerCase();
  const wattMatch = archStr.match(/(\d+)\s*w(?:\/ch|att|pc)?/);
  if (wattMatch) {
    const watts = parseInt(wattMatch[1], 10);
    if (watts <= 10) return 'very-low';
    if (watts <= 30) return 'low';
    if (watts <= 80) return 'moderate';
    return 'high';
  }

  // Vintage receivers are typically low-to-moderate power regardless of topology
  if (amp.product?.availability === 'vintage' || amp.product?.availability === 'discontinued') {
    if (topology === 'class-ab-solid-state') return 'low'; // vintage SS is usually 15–50W
  }

  if (topology === 'set') return 'very-low';                // 2–10W typical
  if (topology === 'class-a-solid-state') return 'low';     // 10–30W typical
  if (topology === 'push-pull-tube') return 'low';          // 15–50W typical
  if (topology === 'hybrid') return 'moderate';              // 25–100W typical
  if (topology === 'class-ab-solid-state') return 'high';   // 50–200W typical
  if (topology === 'class-d') return 'high';                 // 50–300W+ typical
  return 'moderate'; // unknown topology — conservative default
}

// ── Speaker efficiency classification (from topology) ──

type EfficiencyTier = 'very-high' | 'high' | 'moderate' | 'low';

function classifySpeakerEfficiency(speaker: SystemComponent): EfficiencyTier {
  const topology = speaker.product?.topology;
  if (topology === 'horn-loaded') return 'very-high';       // 95dB+ typical
  if (topology === 'high-efficiency') return 'high';        // 92–96dB typical
  if (topology === 'open-baffle') return 'moderate';        // 88–93dB typical
  if (topology === 'bass-reflex') return 'moderate';        // 85–92dB typical
  if (topology === 'sealed') return 'low';                  // 83–88dB typical
  return 'moderate'; // unknown topology — conservative default
}

/**
 * Infer amplifier-speaker fit from topology, design families, and product data.
 *
 * Checks for:
 * 1. Power/efficiency mismatch (SET into sealed standmounts)
 * 2. Over-damping risk (high-power SS into high-efficiency)
 * 3. Design family pairing notes
 * 4. Brand-level system context
 */
function inferAmplifierSpeakerFit(components: SystemComponent[]): string | null {
  const amp = components.find((c) => c.role === 'amplifier');
  const speaker = components.find((c) => c.role === 'speaker');

  if (!amp || !speaker) return null;

  const ampPower = classifyAmpPower(amp);
  const speakerEff = classifySpeakerEfficiency(speaker);
  const notes: string[] = [];

  // ── Critical mismatch: very-low power + low-efficiency speaker ──
  if (ampPower === 'very-low' && (speakerEff === 'low' || speakerEff === 'moderate')) {
    notes.push(
      `${amp.displayName} is a low-power design (likely under 10W) paired with ${speaker.displayName}, ` +
      `which has ${speakerEff} efficiency. This pairing risks dynamic compression and limited bass ` +
      `control — the amplifier may not have enough power headroom for full musical expression. ` +
      `Single-ended triode amps typically need speakers above 92dB sensitivity to perform at their best.`,
    );
  }
  // ── Moderate concern: low power + low-efficiency speaker ──
  else if (ampPower === 'low' && speakerEff === 'low') {
    notes.push(
      `${amp.displayName} offers modest power paired with ${speaker.displayName}, which has relatively ` +
      `low efficiency. This may work well at moderate volumes but could compress on dynamic peaks ` +
      `in larger rooms. Worth monitoring — if the presentation feels constrained, power headroom is the likely cause.`,
    );
  }
  // ── Over-damping concern: high-power SS + very-high-efficiency speaker ──
  else if (ampPower === 'high' && (speakerEff === 'very-high' || speakerEff === 'high')) {
    notes.push(
      `${amp.displayName} provides substantial power into ${speaker.displayName}, which is a ` +
      `high-efficiency design. The amplifier will have considerable damping authority — this delivers ` +
      `tight control but may reduce the elastic, breathing quality that high-efficiency speakers ` +
      `are often valued for. Lower-power amplification typically lets these speakers express their dynamic character more fully.`,
    );
  }

  // ── Design family pairing notes (existing logic) ──
  if (amp.brandProfile?.designFamily?.ampPairing && speaker.brandProfile?.designFamily?.character) {
    const designNote = `${amp.displayName} paired with ${speaker.displayName}: ${amp.brandProfile.designFamily.ampPairing} ${speaker.brandProfile.designFamily.character.includes('sensitivity') ? speaker.brandProfile.designFamily.character : ''}`.trim();
    notes.push(designNote);
  }
  // ── Brand-level system context (fallback) ──
  else if (notes.length === 0 && amp.brandProfile?.systemContext) {
    notes.push(`${amp.displayName}: ${amp.brandProfile.systemContext}`);
  }

  return notes.length > 0 ? notes.join(' ') : null;
}

/**
 * Infer trade-offs from the system's component balance.
 * Step 3 of the advisory reasoning structure.
 *
 * Uses the 4-axis model to identify compounding risks and
 * complementary trade-offs.
 */
function inferSystemTradeoffs(components: SystemComponent[]): string | null {
  const profiles = classifyComponentAxes(components);
  const axes = profiles.map(p => p.axes);
  const compounding = detectCompounding(axes);
  const system = synthesiseSystemAxes(axes);

  // Compounding trade-offs are the most actionable
  if (compounding.length > 0) {
    const tradeoffs: string[] = [];
    for (const warning of compounding) {
      if (warning.includes('warm')) {
        tradeoffs.push('Stacked warmth may reduce transient precision and compress spatial definition. If recordings feel congested or slow, the system may be leaning too far into density.');
      } else if (warning.includes('bright')) {
        tradeoffs.push('Stacked brightness may thin tonal body and increase fatigue risk. If extended sessions feel clinical or lean, the cumulative brightness may be outpacing the system\'s ability to deliver musical warmth.');
      } else if (warning.includes('smooth')) {
        tradeoffs.push('Stacked smoothness may soften transient edges and reduce perceived detail. If the presentation feels too polite or lacking in clarity, the system may be trading resolution for ease.');
      } else if (warning.includes('detailed')) {
        tradeoffs.push('Stacked detail emphasis may foreground analytical qualities at the expense of musical flow. If listening feels like work, the system may be prioritizing information over engagement.');
      } else if (warning.includes('controlled')) {
        tradeoffs.push('Stacked control may dampen dynamic expression and reduce the sense of musical life. If the system sounds overdamped or mechanical, consider introducing a component with more elastic character.');
      } else if (warning.includes('elastic')) {
        tradeoffs.push('Stacked elasticity may reduce composure under complex passages. If the presentation feels loose or uncontrolled on dense material, consider a component with more grip.');
      }
    }
    return tradeoffs.join(' ');
  }

  // Complementary balance — the trade-off is moderation
  const hasWarm = system.warm_bright === 'warm';
  const hasBright = system.warm_bright === 'bright';
  const hasSmooth = system.smooth_detailed === 'smooth';
  const hasDetailed = system.smooth_detailed === 'detailed';

  if ((hasWarm && hasBright) || (hasSmooth && hasDetailed)) {
    return 'The trade-off in a complementary system is that neither extreme is fully maximised. The system balances opposing tendencies rather than committing to either. This is often a strength — it keeps the presentation engaging without becoming fatiguing or clinical.';
  }

  // Single-axis lean without compounding
  if (hasWarm) return 'A warm lean trades some transient precision for tonal body and engagement. This is usually a deliberate priority — worth monitoring only if recordings start to feel congested.';
  if (hasBright) return 'A bright lean trades some tonal body for clarity and detail. This works well for revealing recordings but may become tiring on poorly mastered material.';

  return null;
}

/**
 * Infer what is working well in the system based on component character.
 * Uses the 4-axis model to identify system strengths per axis.
 */
function inferAssessmentStrengths(components: SystemComponent[]): string[] {
  const strengths: string[] = [];
  const profiles = classifyComponentAxes(components);
  const axes = profiles.map(p => p.axes);
  const system = synthesiseSystemAxes(axes);
  const compounding = detectCompounding(axes);

  // Complementary balance is a strength
  const warmComps = profiles.filter(p => p.axes.warm_bright === 'warm');
  const brightComps = profiles.filter(p => p.axes.warm_bright === 'bright');
  if (warmComps.length > 0 && brightComps.length > 0) {
    strengths.push('Complementary tonal balance — precision and warmth offset each other across the chain');
    strengths.push('The system is likely to sustain engagement across long sessions');
  }

  // Deliberate compounding can be a strength when it matches the listener's priority
  if (compounding.length === 0) {
    // No compounding — balanced system
    if (system.warm_bright === 'warm') {
      strengths.push('Consistent warmth and tonal density — midrange should feel present and immersive');
    }
    if (system.warm_bright === 'bright') {
      strengths.push('Strong transient definition and clarity — micro-detail retrieval should be excellent');
    }
    if (system.smooth_detailed === 'smooth') {
      strengths.push('Musical flow and ease — the system prioritises listening pleasure over analytical scrutiny');
    }
    if (system.smooth_detailed === 'detailed') {
      strengths.push('Revealing presentation — inner detail and textural nuance should be well-resolved');
    }
    if (system.elastic_controlled === 'elastic') {
      strengths.push('Dynamic engagement — the system should convey energy and rhythmic involvement');
    }
    if (system.elastic_controlled === 'controlled') {
      strengths.push('Composure and grip — the system should handle complex passages with authority');
    }
    if (system.scale_intimacy === 'scale') {
      strengths.push('Spatial openness — soundstage and image separation should be well-developed');
    }
  }

  // Component-specific strengths from product traits
  for (const c of components) {
    if (c.product?.traits) {
      const t = c.product.traits;
      if ((t.flow ?? 0) > 0.75) strengths.push(`${c.displayName} contributes musical flow and continuity`);
      if ((t.spatial_precision ?? 0) > 0.8) strengths.push(`${c.displayName} provides strong spatial definition`);
      if ((t.composure ?? 0) > 0.8) strengths.push(`${c.displayName} adds composure under complex passages`);
    }
  }

  return strengths.length > 0 ? strengths : ['System character depends on how components interact in practice — further listening context would refine this'];
}

/**
 * Infer where limitations may appear in the system.
 * Uses compounding detection to flag per-axis risks.
 */
function inferAssessmentLimitations(components: SystemComponent[]): string[] {
  const limitations: string[] = [];
  const profiles = classifyComponentAxes(components);
  const axes = profiles.map(p => p.axes);
  const compounding = detectCompounding(axes);

  // Compounding warnings map directly to limitations
  for (const warning of compounding) {
    if (warning.includes('warm')) {
      limitations.push('Stacked warmth may reduce transient precision and spatial clarity');
      limitations.push('Complex, dense recordings could sound congested');
    } else if (warning.includes('bright')) {
      limitations.push('Stacked brightness may thin out tonal body over long sessions');
      limitations.push('Extended listening could trend toward fatigue without a warmth counterbalance');
    } else if (warning.includes('smooth')) {
      limitations.push('Stacked smoothness may obscure transient detail and reduce perceived resolution');
    } else if (warning.includes('detailed')) {
      limitations.push('Stacked detail emphasis may feel analytical or fatiguing on lesser recordings');
    } else if (warning.includes('controlled')) {
      limitations.push('Stacked control may sound overdamped — reducing dynamic expression and musical life');
    } else if (warning.includes('elastic')) {
      limitations.push('Stacked elasticity may lose composure on complex orchestral or dense electronic material');
    }
  }

  // Component-specific limitations from product traits
  for (const c of components) {
    if (c.product?.traits) {
      const t = c.product.traits;
      if ((t.tonal_density ?? 0.5) < 0.35) limitations.push(`${c.displayName} may lean thin in the midrange`);
      if ((t.flow ?? 0.5) < 0.35) limitations.push(`${c.displayName} may prioritize precision over musical flow`);
    }

    // Placement dependency warning for speakers
    if (c.product?.placementSensitivity && c.product.placementSensitivity.level !== 'low') {
      const ps = c.product.placementSensitivity;
      if (ps.level === 'high') {
        limitations.push(`${c.displayName} has high placement sensitivity — ${ps.notes}`);
      } else if (ps.level === 'moderate') {
        limitations.push(`${c.displayName} has moderate placement sensitivity — ${ps.notes}`);
      }
    }
  }

  return limitations;
}

/**
 * Infer likely upgrade direction based on system balance.
 * Uses axis-level analysis to suggest where the most effective
 * intervention lies.
 */
function inferUpgradeDirection(components: SystemComponent[]): string {
  const profiles = classifyComponentAxes(components);
  const axes = profiles.map(p => p.axes);
  const compounding = detectCompounding(axes);
  const system = synthesiseSystemAxes(axes);

  // Well-balanced system — no compounding
  if (compounding.length === 0) {
    const nonNeutralAxes = [
      system.warm_bright !== 'neutral',
      system.smooth_detailed !== 'neutral',
      system.elastic_controlled !== 'neutral',
      system.scale_intimacy !== 'neutral',
    ].filter(Boolean).length;

    if (nonNeutralAxes <= 1) {
      return 'This system appears well-balanced — no single tonal or textural direction dominates. Changes would likely shift the character rather than fix a gap. If you want to explore, focus on the quality you most want to intensify — but "do nothing" is a strong option here.';
    }
  }

  // Compounding — suggest counter-direction
  const suggestions: string[] = [];
  for (const warning of compounding) {
    if (warning.includes('warm')) {
      suggestions.push('If you want to add clarity without losing the warmth that defines this system, a source upgrade (DAC or streamer) with better transient resolution is the gentlest move. Swapping the amplifier or speakers would shift the system\'s identity more fundamentally.');
    } else if (warning.includes('bright')) {
      suggestions.push('If you want to add warmth and flow without sacrificing the clarity this system delivers, a DAC with richer harmonic texture or speakers with more tonal density would be the most aligned direction. Adding tubes upstream is another option — but changes character more broadly.');
    } else if (warning.includes('smooth')) {
      suggestions.push('If you want to introduce more detail and presence without losing the ease, a more revealing source or cables with better transient definition could add clarity without fundamentally changing the system\'s character.');
    } else if (warning.includes('detailed')) {
      suggestions.push('If the system feels analytically intense, consider a warmer or more fluid component in the chain — a tube stage, a smoother DAC topology, or speakers with more midrange body could restore balance.');
    } else if (warning.includes('controlled')) {
      suggestions.push('If the system feels overdamped, a more elastic source or amplifier could restore dynamic life. Single-ended or low-feedback topologies tend to introduce more elasticity.');
    } else if (warning.includes('elastic')) {
      suggestions.push('If the system feels loose or uncontrolled, a more composed amplifier or tighter-grip speaker pairing could add stability without losing all dynamic energy.');
    }
  }

  if (suggestions.length > 0) return suggestions.join(' ');

  return 'Without stronger trait data on the components, the best next step depends on what you feel is missing. Name the quality you want more of, and the analysis can get more specific.';
}

// ── Axis-based component classification ───────────────
//
// Replaces the legacy warm/precise binary with 4-axis positions.
// Uses resolveProductAxes() from axis-types.ts when numeric traits
// are available; falls back to brand-profile text inference.

interface ComponentAxisProfile {
  name: string;
  axes: PrimaryAxisLeanings;
  source: 'product' | 'brand' | 'inferred';
}

/**
 * Resolve axis leanings for each component in the system.
 * Prefers explicit primaryAxes → numeric trait inference → brand text inference.
 */
function classifyComponentAxes(components: SystemComponent[]): ComponentAxisProfile[] {
  return components.map((c) => {
    // 1. Product with primaryAxes or numeric traits — use resolveProductAxes
    if (c.product) {
      return {
        name: c.displayName,
        axes: resolveProductAxes({
          primaryAxes: c.product.primaryAxes,
          traits: c.product.traits,
        }),
        source: 'product' as const,
      };
    }

    // 2. Brand-profile text inference — coarser but still useful
    if (c.brandProfile) {
      const t = c.brandProfile.tendencies.toLowerCase();
      // Context-aware keyword match: reject hits that are negated
      // e.g. "tonal warmth is not a primary characteristic" should NOT match 'warm'
      const NEGATION_RE = /\b(?:not|no|isn'?t|aren'?t|without|lack(?:s|ing)?|never)\b/;
      function hasAffirmative(text: string, keywords: string[]): boolean {
        for (const kw of keywords) {
          const idx = text.indexOf(kw);
          if (idx < 0) continue;
          // Check ~40 chars before the keyword for negation
          const before = text.slice(Math.max(0, idx - 40), idx);
          if (NEGATION_RE.test(before)) continue;
          // Check ~30 chars after the keyword for "is not", "are not" patterns
          const after = text.slice(idx, idx + kw.length + 30);
          if (/\b(?:is|are|was|were)\s+(?:not|never)\b/.test(after)) continue;
          return true;
        }
        return false;
      }
      return {
        name: c.displayName,
        axes: {
          warm_bright:
            hasAffirmative(t, ['warm', 'rich', 'dense', 'lush'])
              ? 'warm' as const
              // "lean" removed — it describes tonal density, not treble emphasis.
              // Speed/transient keywords belong on the elastic_controlled axis.
              : hasAffirmative(t, ['bright', 'analytical', 'tilted'])
                || (hasAffirmative(t, ['precise', 'clarity']) && hasAffirmative(t, ['articulate']))
                ? 'bright' as const
                : 'neutral' as const,
          smooth_detailed:
            hasAffirmative(t, ['smooth', 'liquid', 'flowing'])
              ? 'smooth' as const
              : hasAffirmative(t, ['detailed', 'revealing', 'transparent', 'resolving'])
                ? 'detailed' as const
                : 'neutral' as const,
          elastic_controlled:
            hasAffirmative(t, ['elastic', 'dynamic', 'lively', 'punchy', 'fast', 'transient', 'speed', 'agile'])
              ? 'elastic' as const
              : hasAffirmative(t, ['controlled', 'composed', 'authoritative', 'grip', 'damping'])
                ? 'controlled' as const
                : 'neutral' as const,
          scale_intimacy:
            hasAffirmative(t, ['open', 'airy', 'spacious', 'expansive'])
              ? 'scale' as const
              : hasAffirmative(t, ['intimate', 'closed', 'focused'])
                ? 'intimacy' as const
                : 'neutral' as const,
        },
        source: 'brand' as const,
      };
    }

    // 3. Unknown — all neutral
    return {
      name: c.displayName,
      axes: { warm_bright: 'neutral', smooth_detailed: 'neutral', elastic_controlled: 'neutral', scale_intimacy: 'neutral' },
      source: 'inferred' as const,
    };
  });
}

/**
 * Derive a legacy-compatible warm/precise/balanced/unknown lean from axis profiles.
 * Used by preference alignment and cable advisory where the full axis model
 * would over-complicate an already-clear decision path.
 */
function deriveSystemLeanFromAxes(profiles: ComponentAxisProfile[]): 'warm' | 'precise' | 'balanced' | 'unknown' {
  const axes = profiles.map(p => p.axes);
  if (axes.length === 0) return 'unknown';
  const system = synthesiseSystemAxes(axes);

  const warmSignals = (system.warm_bright === 'warm' ? 1 : 0)
    + (system.smooth_detailed === 'smooth' ? 1 : 0);
  const brightSignals = (system.warm_bright === 'bright' ? 1 : 0)
    + (system.smooth_detailed === 'detailed' ? 1 : 0);

  if (warmSignals > 0 && brightSignals > 0) return 'balanced';
  if (warmSignals > 0) return 'warm';
  if (brightSignals > 0) return 'precise';
  return 'unknown';
}

/**
 * Build preference alignment note from user desires and system character.
 * Step 5 of the advisory reasoning structure.
 *
 * Returns null when no desires are present — the follow-up question
 * takes its place.
 */
// ── Structured memo-format builders ──────────────────
//
// Pipeline: chain → stacked traits → bottleneck → component assessments
//         → ranked upgrade paths → keep list → sequence → key observation.
//
// All deterministic — no LLM calls.

type MemoComponentAssessment = import('./advisory-response').ComponentAssessment;
type MemoUpgradePath = import('./advisory-response').UpgradePath;
type MemoKeepRecommendation = import('./advisory-response').KeepRecommendation;
type MemoRecommendedStep = import('./advisory-response').RecommendedStep;
type MemoSystemChain = import('./advisory-response').SystemChain;
type MemoPrimaryConstraint = import('./advisory-response').PrimaryConstraint;
type MemoStackedTraitInsight = import('./advisory-response').StackedTraitInsight;

// ── Canonical role ordering for chain display ──
const ROLE_ORDER: Record<string, number> = {
  streamer: 0, source: 0, transport: 0,
  turntable: 0, tonearm: 0,
  cartridge: 0.1,
  phono: 0.2,
  dac: 1,
  preamplifier: 2, preamp: 2,
  amplifier: 3, integrated: 3, 'integrated-amplifier': 3,
  speaker: 4, headphone: 4,
  subwoofer: 5,
};

function canonicalRole(role: string): string {
  const r = role.toLowerCase();
  if (r.includes('stream') || r === 'source' || r === 'transport') return 'Streamer';
  if (r === 'turntable' || r === 'tonearm') return 'Turntable';
  if (r === 'cartridge') return 'Cartridge';
  if (r === 'phono') return 'Phono Stage';
  if (r === 'dac' || r.includes('dac')) return 'DAC';
  if (r.includes('preamp') || r === 'preamplifier') return 'Preamplifier';
  if (r.includes('amp') || r.includes('integrated')) return 'Amplifier';
  if (r.includes('speak')) return 'Speakers';
  if (r.includes('headphone')) return 'Headphones';
  if (r.includes('sub')) return 'Subwoofer';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function roleSort(role: string): number {
  const r = role.toLowerCase();
  for (const [key, order] of Object.entries(ROLE_ORDER)) {
    if (r.includes(key)) return order;
  }
  return 99;
}

/**
 * Upgrade influence weight — how much sonic impact upgrading this role has.
 * Speakers define system character, DAC refines it, amp adjusts,
 * source/streamer is secondary. Used as tiebreaker in upgrade path ranking.
 */
function upgradeInfluence(role: string): number {
  const r = role.toLowerCase();
  if (r.includes('speak') || r.includes('headphone') || r.includes('monitor')) return 3;
  if (r.includes('dac')) return 2;
  if (r.includes('amp') || r.includes('integrated') || r.includes('preamp')) return 1.5;
  if (r.includes('stream') || r.includes('source') || r.includes('transport')) return 0.5;
  if (r.includes('cable') || r.includes('accessory') || r.includes('power')) return 0.25;
  return 1;
}

/**
 * Extract the user's full chain from their raw message.
 *
 * Supports three input styles (checked in priority order):
 *   1. Arrow-separated chains (→ or ->)
 *   2. "into" phrasing ("streamer into DAC into amp into speakers")
 *   3. Comma-separated or labeled component lists when at least 2 segments exist
 *
 * Returns an object with:
 *   - segments: the extracted segment strings
 *   - confidence: 'high' when explicit ordering markers are present (arrows, "into"),
 *                 'medium' when commas provide a plausible list but order is ambiguous,
 *                 undefined when no chain could be extracted.
 */
/**
 * Split a segment containing section labels ("Turntable:", "Cartridges:", "Phono Stage:", etc.)
 * into individual sub-segments. Handles complex user input like:
 *   "DeVore O/96 speakers. Analogue: Turntable: Michell Gyro SE ... Cartridges: EMT HSD 006, ... Phono Stage: Aurorasound VIDA"
 *
 * Returns the expanded sub-segments, or the original segment in an array if no labels found.
 */
function expandSectionLabels(segment: string): string[] {
  // Match known section labels — case-insensitive, with optional period or colon before
  const SECTION_LABEL_RE = /(?:^|[.;]\s*|\s+)(?:Analogue|Analog|Digital|Turntable|Tonearm|Cartridge[s]?|Phono\s*Stage|Phono|DAC|Amp(?:lifier)?|Speaker[s]?|Streamer|Source)\s*:/gi;

  const labels: { index: number; label: string }[] = [];
  let m;
  while ((m = SECTION_LABEL_RE.exec(segment)) !== null) {
    // Find the start of the actual label (skip leading punctuation/whitespace)
    const fullMatch = m[0];
    const labelStart = m.index + fullMatch.indexOf(fullMatch.replace(/^[.\s;]+/, ''));
    labels.push({ index: labelStart, label: fullMatch.trim().replace(/^[.;]\s*/, '') });
  }

  if (labels.length === 0) return [segment];

  const results: string[] = [];

  // Content before the first label (e.g. "DeVore O/96 speakers")
  const beforeFirst = segment.substring(0, labels[0].index).replace(/[.;]\s*$/, '').trim();
  if (beforeFirst.length > 0) results.push(beforeFirst);

  // Extract content for each labeled section
  for (let i = 0; i < labels.length; i++) {
    const labelEnd = labels[i].index + labels[i].label.length;
    const contentEnd = i + 1 < labels.length ? labels[i + 1].index : segment.length;
    const content = segment.substring(labelEnd, contentEnd).replace(/^[.;,\s]+/, '').replace(/[.;,\s]+$/, '').trim();

    if (content.length === 0) continue;

    // Skip meta-labels like "Analogue:" that just group other sections
    const labelName = labels[i].label.replace(/:$/, '').trim().toLowerCase();
    if (labelName === 'analogue' || labelName === 'analog' || labelName === 'digital') continue;

    // Further split comma-separated items within a section (e.g. "EMT HSD 006, Ortofon SPU Mono, ...")
    const items = content.split(/\s*,\s*/).map((s) => s.trim()).filter((s) => s.length > 0);
    results.push(...items);
  }

  return results.length > 0 ? results : [segment];
}

function extractFullChain(
  rawMessage: string,
): { segments: string[]; confidence: 'high' | 'medium' } | undefined {
  // ── Style 1: arrow-separated ──
  // Matches: → , -> , --> , ---> , ==> , >> and similar arrow-like separators.
  const ARROW_RE = /\s*(?:→|—>|-{1,3}>|={1,2}>|>{2,3})\s*/;
  if (ARROW_RE.test(rawMessage)) {
    const rawSegments = rawMessage
      .split(ARROW_RE)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    // Expand any segments that contain section labels (e.g. "Analogue: Turntable: ...")
    const segments = rawSegments.flatMap(expandSectionLabels);
    if (segments.length >= 2) {
      return { segments, confidence: 'high' };
    }
  }

  // ── Style 2: "into" phrasing ──
  // e.g. "Eversolo DMP-A6 into Chord Hugo into JOB Integrated into WLM Diva"
  // Only use when "into" appears at least twice (otherwise it's likely just prose).
  const intoCount = (rawMessage.match(/\binto\b/gi) ?? []).length;
  if (intoCount >= 2) {
    const segments = rawMessage
      .split(/\s+into\s+/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (segments.length >= 2) {
      return { segments, confidence: 'high' };
    }
  }

  // ── Style 2b: natural-language connectors ──
  // Handles mixed connectors like "X feeding into Y, then to Z, connected to W".
  // Split on: "feeding into", "then to", "then into", "connected to", "going to/into",
  // "running to/into", "and then", "and". Must find at least 2 such connectors.
  const NL_CONNECTOR_RE = /\s*(?:,\s*)?(?:feeding\s+into|then\s+(?:to|into)|connected\s+to|going\s+(?:in)?to|running\s+(?:in)?to|and\s+then\s+(?:to\s+)?(?:the\s+)?)\s+(?:the\s+)?/gi;
  const nlConnectorCount = (rawMessage.match(NL_CONNECTOR_RE) ?? []).length;
  if (nlConnectorCount >= 2) {
    const segments = rawMessage
      .split(NL_CONNECTOR_RE)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (segments.length >= 3) {
      return { segments, confidence: 'high' };
    }
  }

  // ── Style 3: comma-separated component list ──
  // Strip common framing phrases first, then split on commas.
  // Only activate when the message looks like a component list rather than prose.
  const framingStripped = rawMessage
    .replace(/^(?:evaluate|assess|review|analyze|analyse|check|rate)\s+(?:my\s+)?(?:system|setup|chain|rig)\s*:?\s*/i, '')
    .replace(/^(?:my\s+(?:system|setup|chain|rig)\s*(?:is|:)?\s*)/i, '')
    .replace(/^(?:i(?:'m|\s+am)\s+(?:running|using)\s*:?\s*)/i, '')
    .replace(/^(?:here(?:'s|\s+is)\s+(?:my\s+)?(?:system|setup|chain)\s*:?\s*)/i, '')
    .replace(/^(?:current\s+(?:system|setup|chain)\s*:?\s*)/i, '')
    .trim();

  // Need at least one comma and the segments should look like component names
  // (not long prose sentences)
  if (framingStripped.includes(',')) {
    // First expand any section labels, then split on commas
    const expanded = expandSectionLabels(framingStripped);
    const segments = expanded
      .flatMap((s) => s.includes(',') ? s.split(/\s*,\s*/) : [s])
      .map((s) => s.trim())
      // Filter out conversational noise — keep segments that look like product/brand names
      // (short, not full sentences)
      .filter((s) => s.length > 0 && s.length < 120 && !s.includes('.'));
    if (segments.length >= 2) {
      return { segments, confidence: 'medium' };
    }
  }

  return undefined;
}

/**
 * Attempt to reorder chain segments into canonical signal-flow order.
 *
 * For each segment, tries to infer a role from known brand/product names
 * and role keywords, then sorts by ROLE_ORDER.
 *
 * Returns the reordered segments if ALL segments can be role-classified
 * (high confidence). Otherwise returns undefined — the caller should
 * fall back to the user's original order.
 */
function tryCanonicalOrder(segments: string[]): string[] | undefined {
  const classified: { segment: string; order: number; originalIdx: number }[] = [];

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i].toLowerCase();
    let bestOrder: number | undefined;

    // Cable / interconnect / power segments checked FIRST — "speaker cable"
    // should be classified as a cable, not as a speaker.
    if (/\b(?:cable|interconnect|power\s*cord)\b/i.test(s)) {
      bestOrder = 90 + i; // keeps relative order among cables
    }

    // Try ROLE_ORDER keywords (only if not already classified as cable)
    if (bestOrder === undefined) {
      for (const [key, order] of Object.entries(ROLE_ORDER)) {
        if (s.includes(key)) {
          bestOrder = order;
          break;
        }
      }
    }

    // Try well-known role keywords in the segment text
    if (bestOrder === undefined) {
      if (/\b(?:stream|transport|source|roon|tidal|server)\b/i.test(s)) bestOrder = 0;
      else if (/\b(?:turntable|tonearm|tone\s*arm)\b/i.test(s)) bestOrder = 0;
      else if (/\b(?:cartridge|stylus)\b/i.test(s)) bestOrder = 0.1;
      else if (/\b(?:phono)\b/i.test(s)) bestOrder = 0.2;
      else if (/\b(?:dac|converter)\b/i.test(s)) bestOrder = 1;
      else if (/\b(?:pre[- ]?amp|preamplifier)\b/i.test(s)) bestOrder = 2;
      else if (/\b(?:amp|amplifier|integrated|receiver)\b/i.test(s)) bestOrder = 3;
      else if (/\b(?:speaker|monitor|headphone)\b/i.test(s)) bestOrder = 4;
      else if (/\b(?:sub|subwoofer)\b/i.test(s)) bestOrder = 5;
    }

    // Try connection-type keywords as cables (usb, coax, etc.) — these
    // may not contain "cable" explicitly but are still accessories
    if (bestOrder === undefined) {
      if (/\b(?:usb|coax|optical|spdif|xlr|rca)\b/i.test(s)) {
        bestOrder = 90 + i;
      }
    }

    // Try KNOWN_PRODUCT_ROLES and BRAND_CATEGORY_MAP for products/brands
    // that don't contain role keywords in their name (e.g. "WiiM Pro" → streamer)
    if (bestOrder === undefined) {
      for (const [key, info] of Object.entries(KNOWN_PRODUCT_ROLES)) {
        if (s.includes(key)) {
          const cat = info.expectedCategory;
          bestOrder = ROLE_ORDER[cat] ?? undefined;
          break;
        }
      }
    }

    if (bestOrder === undefined) {
      // Can't confidently classify this segment — bail out
      return undefined;
    }

    classified.push({ segment: segments[i], order: bestOrder, originalIdx: i });
  }

  // Sort by inferred role order, breaking ties by original position
  classified.sort((a, b) => a.order - b.order || a.originalIdx - b.originalIdx);
  return classified.map((c) => c.segment);
}

/**
 * Build ordered system chain for display.
 *
 * Two layers:
 *   1. fullChain — preserves every segment from the user's input (cables, accessories included).
 *      When the user provides explicit ordering (arrows, "into"), their order is preserved.
 *      When the input is comma-separated (ambiguous order), the system attempts to infer
 *      canonical signal-flow order. If inference fails, uses the user's entered order.
 *   2. roles / names — major signal-path components only, sorted by canonical order.
 *
 * If the full chain cannot be reconstructed confidently from any input style,
 * fullChain is left undefined — the renderer falls back to the major signal path.
 */
function buildSystemChain(components: SystemComponent[], rawMessage: string): MemoSystemChain {
  const sorted = [...components].sort((a, b) => roleSort(a.role) - roleSort(b.role));
  const extracted = extractFullChain(rawMessage);

  let fullChain: string[] | undefined;
  if (extracted) {
    if (extracted.confidence === 'high') {
      // User provided explicit ordering — trust it
      fullChain = extracted.segments;
    } else {
      // Comma-separated — try canonical ordering, fall back to user order
      fullChain = tryCanonicalOrder(extracted.segments) ?? extracted.segments;
    }
    // Strip leading natural-language connectors from each segment.
    // Comma-split and "into" split can leave fragments like
    // "then to the Job integrated amp" or "connected to the WLM Diva".
    fullChain = fullChain.map((s) =>
      s.replace(/^(?:then\s+(?:to|into)\s+(?:the\s+)?|and\s+(?:then\s+)?(?:to\s+(?:the\s+)?)?|connected\s+to\s+(?:the\s+)?|feeding\s+into\s+(?:the\s+)?|going\s+(?:in)?to\s+(?:the\s+)?|running\s+(?:in)?to\s+(?:the\s+)?)/i, '')
    ).filter((s) => s.length > 0);

    // Deduplicate chain segments — same component mentioned twice
    // (e.g. from parsing artifacts) collapses to one entry.
    const seenSegments = new Set<string>();
    fullChain = fullChain.filter((s) => {
      const key = s.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seenSegments.has(key)) return false;
      seenSegments.add(key);
      return true;
    });
  }

  return {
    fullChain,
    roles: sorted.map((c) => canonicalRole(c.role)),
    names: sorted.map((c) => c.displayName),
  };
}

/**
 * Build intro summary — 1–2 sentence system-level opening.
 * Technical, concise, no conversational filler.
 */
function buildIntroSummary(
  components: SystemComponent[],
  system: PrimaryAxisLeanings,
  stacked: MemoStackedTraitInsight[],
  tier?: SystemTier,
): string {
  const names = components.map((c) => c.displayName);
  const count = names.length;

  // Build character phrase from system axes
  const traits: string[] = [];
  if (system.warm_bright === 'warm') traits.push('tonal density');
  if (system.warm_bright === 'bright') traits.push('transient speed');
  if (system.smooth_detailed === 'detailed') traits.push('microdetail');
  if (system.smooth_detailed === 'smooth') traits.push('musical flow');
  if (system.elastic_controlled === 'elastic') traits.push('elasticity');
  if (system.elastic_controlled === 'controlled') traits.push('stability');
  if (system.scale_intimacy === 'scale') traits.push('spatial scale');

  const traitPhrase = traits.length > 0
    ? `prioritising ${traits.join(' and ')}`
    : 'with no strong lean in any single direction';

  // Reference-tier systems get an elevated opening
  const tierPrefix = tier === 'reference'
    ? 'A reference-level system '
    : 'A system ';

  // ── Detect system deliberateness ──
  // A system is "deliberate" when components from different brands and
  // price tiers share a consistent design philosophy axis — the owner
  // assembled this intentionally rather than accumulating randomly.
  const deliberateness = assessSystemDeliberateness(components, system);
  const deliberateNote = deliberateness.isDeliberate
    ? ` ${deliberateness.note}`
    : '';

  // ── Infer listener intent ──
  // What kind of listening experience is this system optimised for?
  const listenerIntent = inferListenerIntent(components, system);
  const intentNote = listenerIntent ? ` ${listenerIntent}` : '';

  if (stacked.length > 0) {
    // Differentiate system character from system imbalance in the intro
    const imbalances = stacked.filter((s) => s.classification === 'system_imbalance');
    const characters = stacked.filter((s) => s.classification === 'system_character');

    if (imbalances.length > 0) {
      return `${tierPrefix}${traitPhrase}.${deliberateNote} The chain leans toward ${imbalances[0].label} across multiple stages — this shapes both its strengths and its primary limitation.${intentNote}`;
    }
    if (characters.length > 0) {
      return `${tierPrefix}${traitPhrase}.${deliberateNote} The chain shares a consistent lean toward ${characters[0].label} — this defines the system's sonic identity rather than limiting it.${intentNote}`;
    }
  }

  return `${tierPrefix}${traitPhrase}.${deliberateNote} The overall character emerges from how these components interact rather than any single piece dominating.${intentNote}`;
}

/**
 * Assess whether a system shows signs of deliberate, coherent assembly.
 *
 * Signals: components from different brands sharing axis alignment,
 * mix of specialist/boutique brands (not all one brand), presence of
 * uncommon or second-hand-market components, and philosophical consistency.
 */
function assessSystemDeliberateness(
  components: SystemComponent[],
  system: PrimaryAxisLeanings,
): { isDeliberate: boolean; note: string } {
  // Count distinct brands
  const brands = new Set(
    components.map((c) => {
      const parts = c.displayName.split(' ');
      return parts[0].toLowerCase();
    }),
  );
  const multiBrand = brands.size >= 2;

  // Count how many non-neutral axes exist
  const activeAxes = [
    system.warm_bright !== 'neutral',
    system.smooth_detailed !== 'neutral',
    system.elastic_controlled !== 'neutral',
    system.scale_intimacy !== 'neutral',
  ].filter(Boolean).length;

  // Count how many components have identifiable brand profiles or catalog products
  const identified = components.filter((c) => c.brandProfile || c.product).length;
  const hasSpecialistBrands = components.some(
    (c) => c.product?.brandScale === 'boutique' || c.product?.brandScale === 'specialist',
  );

  // A system is deliberate when: multi-brand, most components identified,
  // at least 1 active axis direction, and specialist brands present.
  const isDeliberate = multiBrand && identified >= components.length - 1
    && activeAxes >= 1 && hasSpecialistBrands;

  if (!isDeliberate) {
    return { isDeliberate: false, note: '' };
  }

  // Assess whether the system likely punches above its weight
  // (specialist/boutique components at mid-fi price points)
  const midFiCount = components.filter(
    (c) => c.product?.priceTier === 'mid-fi' || c.product?.priceTier === 'budget',
  ).length;
  const punchesAbove = midFiCount >= 1 && hasSpecialistBrands;

  const parts: string[] = ['This is a coherent, deliberately assembled system'];
  if (punchesAbove) {
    parts[0] += ' that likely punches above its price tier';
  }
  parts[0] += '.';

  return { isDeliberate: true, note: parts.join(' ') };
}

/**
 * Infer listener sonic priorities from system axis positions and component choices.
 *
 * CONSTRAINT: Stay at the level of sonic priorities and system philosophy.
 * Do NOT infer specific music genres, artists, or lifestyle claims unless
 * the user has explicitly provided that information. It is fine to infer
 * timing-first priorities, preference for elasticity/flow/low stored energy,
 * or likely dislike of overdamping — but not to jump from system traits to
 * "singer-songwriter" or "folk" claims.
 *
 * Returns null when the system is too balanced to make a clear inference.
 */
function inferListenerIntent(
  _components: SystemComponent[],
  system: PrimaryAxisLeanings,
): string | null {
  const hasElasticity = system.elastic_controlled === 'elastic';
  const hasDetail = system.smooth_detailed === 'detailed';
  const hasWarmth = system.warm_bright === 'warm';
  const hasBrightness = system.warm_bright === 'bright';
  const hasControl = system.elastic_controlled === 'controlled';
  const hasSmoothness = system.smooth_detailed === 'smooth';

  // Elastic + detail → timing-first, low stored energy
  if (hasElasticity && hasDetail) {
    return 'The axis profile points toward a listener who prioritises timing accuracy, low stored energy, and rhythmic articulation. This system rewards recordings with good transient information and tends to expose compression or overdamping elsewhere in the chain.';
  }

  // Warmth + smoothness → tonal immersion, fatigue resistance
  if (hasWarmth && hasSmoothness) {
    return 'The system prioritises tonal richness, harmonic density, and sustained musical flow. This profile favours long-session engagement and fatigue resistance over analytical separation.';
  }

  // Control + detail → precision, transparency
  if (hasControl && hasDetail) {
    return 'The system prioritises resolution, composure, and analytical transparency. This profile rewards well-recorded material and tends to expose source quality differences clearly.';
  }

  // Bright + elastic → transient energy, dynamic impact
  if (hasBrightness && hasElasticity) {
    return 'The system prioritises transient speed, dynamic impact, and energy. This profile favours low stored energy and fast recovery — overdamping or tonal heaviness would work against its strengths.';
  }

  // Warmth + elasticity → musical engagement with body
  if (hasWarmth && hasElasticity) {
    return 'The system combines tonal density with dynamic elasticity — body and rhythmic life together. This profile suggests a preference for musical engagement with substance rather than either analytical precision or relaxed immersion.';
  }

  return null;
}

// ── Stacked trait detection ─────────────────────────
//
// Detects when 2+ components push the system in the same sonic direction.
// More granular than axis-level compounding — operates on specific
// sonic properties (speed, density, damping) rather than binary axis poles.

/** Sonic property tags derived from axis + trait data. */
type SonicProperty = 'high_speed' | 'low_stored_energy' | 'high_density' | 'high_damping'
  | 'low_density' | 'high_detail' | 'high_smoothness' | 'high_elasticity' | 'high_control';

function deriveSonicProperties(axes: PrimaryAxisLeanings, traits?: Record<string, number>): SonicProperty[] {
  const props: SonicProperty[] = [];

  // Axis-derived
  if (axes.warm_bright === 'bright') { props.push('high_speed', 'low_stored_energy'); }
  if (axes.warm_bright === 'warm') { props.push('high_density'); }
  if (axes.smooth_detailed === 'detailed') { props.push('high_detail'); }
  if (axes.smooth_detailed === 'smooth') { props.push('high_smoothness'); }
  if (axes.elastic_controlled === 'controlled') { props.push('high_damping', 'high_control'); }
  if (axes.elastic_controlled === 'elastic') { props.push('high_elasticity'); }

  // Trait-enriched
  if (traits) {
    if ((traits.tonal_density ?? 0.5) < 0.35) props.push('low_density');
    if ((traits.tonal_density ?? 0.5) > 0.75) props.push('high_density');
    if ((traits.composure ?? 0.5) > 0.8) props.push('high_control');
  }

  return props;
}

const STACKED_LABELS: Record<SonicProperty, string> = {
  high_speed: 'transient speed',
  low_stored_energy: 'low stored energy',
  high_density: 'harmonic density',
  high_damping: 'high damping / analytical control',
  low_density: 'lean tonal body',
  high_detail: 'detail emphasis',
  high_smoothness: 'smoothness emphasis',
  high_elasticity: 'dynamic elasticity',
  high_control: 'control emphasis',
};

// ── System character vs system imbalance ─────────────
//
// Not all trait stacking is a weakness. When multiple components share a
// direction that represents a coherent sonic philosophy, it's system
// identity — not a problem. Only classify as imbalance when:
//   1. The stacking conflicts with common listening goals (e.g., extreme
//      brightness/leanness increases fatigue risk).
//   2. The opposing axis is completely absent AND the stacking is extreme
//      (3+ contributors).
//   3. The property itself is inherently subtractive (e.g., low_density
//      removes tonal body rather than adding a positive quality).

/** Properties that represent coherent sonic philosophies when stacked. */
const CHARACTER_PROPERTIES = new Set<SonicProperty>([
  'high_speed',
  'high_elasticity',
  'high_density',
  'high_detail',
  'high_smoothness',
]);

/**
 * Properties that are inherently problematic when stacked — they
 * subtract sonic qualities rather than defining a positive identity.
 */
const IMBALANCE_PROPERTIES = new Set<SonicProperty>([
  'low_density',
  'low_stored_energy',
]);

/**
 * Properties that are neutral — they can be character or imbalance
 * depending on how extreme the stacking is and what else is present.
 */
// high_damping, high_control — default to imbalance (overdamping risk)

/**
 * Opposing-axis pairs. When a character property is stacked but its
 * opposite is completely absent across all components AND 3+ components
 * contribute, reclassify as imbalance (no counterbalance).
 */
const OPPOSING_PROPERTY: Partial<Record<SonicProperty, SonicProperty[]>> = {
  high_speed: ['high_density', 'high_smoothness'],
  high_density: ['high_speed', 'high_detail'],
  high_detail: ['high_smoothness', 'high_density'],
  high_smoothness: ['high_detail', 'high_speed'],
  high_elasticity: ['high_control', 'high_damping'],
};

/**
 * Classify a stacked trait as system character or system imbalance.
 *
 * @param prop           The sonic property being stacked
 * @param contributorCount  How many components share this property
 * @param allProps       ALL properties present in ANY component (not just stacked)
 * @param componentCount Total number of components in the system
 */
function classifyStackedTrait(
  prop: SonicProperty,
  contributorCount: number,
  allProps: Set<SonicProperty>,
  componentCount: number,
): 'system_character' | 'system_imbalance' {
  // Inherently subtractive properties → always imbalance
  if (IMBALANCE_PROPERTIES.has(prop)) return 'system_imbalance';

  // Damping/control properties → default to imbalance (overdamping risk)
  if (prop === 'high_damping' || prop === 'high_control') return 'system_imbalance';

  // Character properties → system identity in most cases.
  // Only reclassify as imbalance when ALL of:
  //   1. Every non-source component contributes (near-total stacking)
  //   2. Not a single component carries the opposing trait
  //   3. The stacking exceeds the component count threshold (>75% of chain)
  if (CHARACTER_PROPERTIES.has(prop)) {
    const opposites = OPPOSING_PROPERTY[prop];
    const hasAnyOpposition = opposites ? opposites.some((opp) => allProps.has(opp)) : true;

    // If any component carries an opposing trait, system has counterbalance
    if (hasAnyOpposition) return 'system_character';

    // No opposing trait at all — only flag as imbalance if stacking is
    // near-total (>75% of the chain) AND the property is one that
    // degrades with extreme concentration
    const stackRatio = contributorCount / componentCount;
    if (stackRatio > 0.75) {
      return 'system_imbalance';
    }

    return 'system_character';
  }

  // Fallback: treat as imbalance (conservative)
  return 'system_imbalance';
}

/**
 * Two sets of explanations: one for system character (framed positively),
 * one for system imbalance (notes the trade-off risk).
 */
const CHARACTER_EXPLANATIONS: Record<SonicProperty, string> = {
  high_speed: 'Transient speed and articulation are the dominant sonic trait here — the system prioritises fast, rhythmically engaging presentation.',
  low_stored_energy: 'Multiple low-stored-energy components produce fast, articulate sound. Extended listening may feel lean on harmonically dense material.',
  high_density: 'The chain leans into tonal richness and midrange body — immersive, harmonically saturated, physically present.',
  high_damping: 'Stacked control and damping. Composure under load is excellent, but dynamic expression and elasticity may feel suppressed.',
  low_density: 'Multiple components contribute thin midrange character. The system may lack tonal body and weight on acoustic material.',
  high_detail: 'Resolution and transparency run through the chain — revealing, micro-detailed, honest with recordings.',
  high_smoothness: 'Musical flow and liquidity are the prevailing character — effortless, non-fatiguing, easy to listen to for hours.',
  high_elasticity: 'Rhythmic energy and dynamic expression are a shared emphasis — alive, punchy, musically engaging.',
  high_control: 'Control emphasis stacks in the chain. Stability and grip are excellent, but the presentation may feel overdamped or mechanical.',
};

const IMBALANCE_EXPLANATIONS: Record<SonicProperty, string> = {
  high_speed: 'Transient speed stacks beyond typical balance. Excellent articulation, but tonal density and midrange body may be noticeably reduced.',
  low_stored_energy: 'Multiple low-stored-energy components produce fast, articulate sound. Extended listening may feel lean on harmonically dense material.',
  high_density: 'The chain stacks tonal density beyond typical balance — rich midrange, but transient precision and spatial separation may be constrained.',
  high_damping: 'Stacked control and damping. Composure under load is excellent, but dynamic expression and elasticity may feel suppressed.',
  low_density: 'Multiple components contribute thin midrange character. The system may lack tonal body and weight on acoustic material.',
  high_detail: 'Detail emphasis stacks beyond typical balance. Microdetail retrieval is strong, but lesser recordings may sound unforgiving.',
  high_smoothness: 'Smoothness stacks beyond typical balance. Musical flow is excellent, but transient edges and fine detail may be softened.',
  high_elasticity: 'Dynamic energy stacks beyond typical balance. Rhythmic engagement is strong, but composure on complex passages may be limited.',
  high_control: 'Control emphasis stacks in the chain. Stability and grip are excellent, but the presentation may feel overdamped or mechanical.',
};

function detectStackedTraits(
  components: SystemComponent[],
  profiles: ComponentAxisProfile[],
): MemoStackedTraitInsight[] {
  // Collect sonic properties per component
  const propMap = new Map<SonicProperty, string[]>();
  for (let i = 0; i < components.length; i++) {
    const props = deriveSonicProperties(profiles[i].axes, components[i].product?.traits);
    for (const p of props) {
      if (!propMap.has(p)) propMap.set(p, []);
      propMap.get(p)!.push(components[i].displayName);
    }
  }

  // Collect ALL properties present across any component (for opposing-axis checks)
  const allProps = new Set<SonicProperty>(propMap.keys());

  // Properties shared by 2+ components = stacked; classify each
  const insights: MemoStackedTraitInsight[] = [];
  for (const [prop, contributors] of propMap) {
    if (contributors.length >= 2) {
      const classification = classifyStackedTrait(prop, contributors.length, allProps, components.length);
      const explanation = classification === 'system_character'
        ? CHARACTER_EXPLANATIONS[prop]
        : IMBALANCE_EXPLANATIONS[prop];
      insights.push({
        label: STACKED_LABELS[prop],
        contributors,
        explanation,
        classification,
      });
    }
  }

  return insights;
}

// ── Bottleneck detection ────────────────────────────
//
// Identifies the primary system constraint — the factor that most
// limits the system relative to its architectural potential.
// Pipeline: axis analysis + trait data + stacked traits → constraint ranking.

type ConstraintCategory = MemoPrimaryConstraint['category'];

interface ConstraintCandidate {
  componentName: string;
  category: ConstraintCategory;
  explanation: string;
  severity: number; // higher = more constraining
}

function detectPrimaryConstraint(
  components: SystemComponent[],
  profiles: ComponentAxisProfile[],
  stacked: MemoStackedTraitInsight[],
  system: PrimaryAxisLeanings,
): MemoPrimaryConstraint | undefined {
  const candidates: ConstraintCandidate[] = [];

  // ── Stacked bias constraint (system-level, not per-component) ──
  // Only system_imbalance traits count as constraints. system_character
  // traits define the system's sonic identity and are not penalized.
  // Speakers/headphones define system character — stacking with them is
  // intentional alignment, not a constraint. Blame non-speaker components.
  const imbalanceTraits = stacked.filter((s) => s.classification === 'system_imbalance');
  if (imbalanceTraits.length > 0) {
    const dominant = imbalanceTraits[0];
    // Find which NON-SPEAKER component contributes most to the imbalance
    const speakerNames = new Set(
      components
        .filter((sc) => sc.role.includes('speak') || sc.role.includes('headphone'))
        .map((sc) => sc.displayName),
    );
    const frequency = new Map<string, number>();
    for (const s of imbalanceTraits) {
      for (const name of s.contributors) {
        if (!speakerNames.has(name)) {
          frequency.set(name, (frequency.get(name) ?? 0) + 1);
        }
      }
    }
    // If only speakers contribute to stacking, this isn't a constraint
    if (frequency.size > 0) {
      let topContributor = '';
      let topCount = 0;
      for (const [name, count] of frequency) {
        if (count > topCount) { topContributor = name; topCount = count; }
      }
      candidates.push({
        componentName: topContributor,
        category: 'stacked_bias',
        explanation: `The chain leans toward ${dominant.label}. ${topContributor} is the strongest contributor to this bias.`,
        severity: imbalanceTraits.length * 2 + 1,
      });
    }
  }

  // ── Per-component constraints ──
  for (let i = 0; i < components.length; i++) {
    const c = components[i];
    const axes = profiles[i].axes;
    const traits = c.product?.traits;
    const role = c.role.toLowerCase();

    // DAC limitations — low tonal density, low flow, limited scale/authority,
    // portable-in-desktop context, delta-sigma glare risk
    if (role === 'dac' || role.includes('dac')) {
      let severity = 0;
      const issues: string[] = [];
      if (traits && (traits.tonal_density ?? 0.5) <= 0.4) {
        severity += 3;
        issues.push('limited tonal density');
      }
      if (traits && (traits.flow ?? 0.5) < 0.4) {
        severity += 2;
        issues.push('limited musical flow');
      }
      if (traits && (traits.composure ?? 0.5) <= 0.4) {
        severity += 2;
        issues.push('limited composure and authority');
      }
      if (axes.warm_bright === 'bright' && system.warm_bright === 'bright') {
        severity += 2;
        issues.push('brightness compounding with system lean');
      }
      // Portable DAC used in a desktop/speaker system — scale mismatch
      const subcat = c.product?.subcategory ?? '';
      const isPortable = subcat.includes('portable') || subcat.includes('headphone');
      const hasSpeakers = components.some((sc) => sc.role.includes('speak'));
      if (isPortable && hasSpeakers) {
        severity += 4;
        issues.push('portable DAC in a speaker system — output authority and scale may limit the chain');
      }
      if (severity > 0) {
        candidates.push({
          componentName: c.displayName,
          category: 'dac_limitation',
          explanation: `DAC limitation: ${issues.join(', ')}. The DAC sets the analog quality ceiling for everything downstream.`,
          severity,
        });
      }
    }

    // Amplifier control — check for mismatches with speaker demands
    if (role.includes('amp') || role.includes('integrated')) {
      let severity = 0;
      const issues: string[] = [];
      if (axes.elastic_controlled === 'elastic') {
        // Elastic amps can struggle with demanding speakers
        const hasDemandingSpeaker = components.some(
          (sc) => sc.role.includes('speak') && sc.product?.traits && (sc.product.traits.composure ?? 0.5) > 0.7,
        );
        if (hasDemandingSpeaker) {
          severity += 3;
          issues.push('dynamic grip may be insufficient for demanding speakers');
        }
      }
      if (axes.elastic_controlled === 'controlled' && system.elastic_controlled === 'controlled') {
        severity += 2;
        issues.push('overdamping risk — may suppress dynamic expression');
      }
      if (severity > 0) {
        candidates.push({
          componentName: c.displayName,
          category: 'amplifier_control',
          explanation: `Amplifier constraint: ${issues.join(', ')}.`,
          severity,
        });
      }
    }

    // Speaker scale — speakers often set the ceiling
    if (role.includes('speak')) {
      let severity = 0;
      const issues: string[] = [];
      if (traits && (traits.spatial_precision ?? 0.5) < 0.4) {
        severity += 2;
        issues.push('limited spatial precision');
      }
      if (axes.scale_intimacy === 'intimacy') {
        severity += 2;
        issues.push('constrained spatial scale');
      }
      if (traits && (traits.composure ?? 0.5) < 0.4) {
        // For single-driver, horn-loaded, or high-efficiency designs,
        // low composure is a known design trade-off (coherence + speed
        // over composure), not a deficiency. Reduce severity and reframe.
        const arch = (c.product?.architecture ?? '').toLowerCase();
        const topo = (c.product?.topology ?? '').toLowerCase();
        const isByDesign =
          arch.includes('single-driver') ||
          arch.includes('crossoverless') ||
          arch.includes('fullrange') ||
          topo.includes('horn') ||
          topo.includes('single-driver');
        if (isByDesign) {
          severity += 1; // reduced from 2 — design trade-off, not deficiency
          issues.push('composure limited by design (single-driver trade-off for coherence and speed)');
        } else {
          severity += 2;
          issues.push('limited composure under complex material');
        }
      }
      if (severity > 0) {
        candidates.push({
          componentName: c.displayName,
          category: 'speaker_scale',
          explanation: `Speaker constraint: ${issues.join(', ')}. Speakers set the output ceiling for the entire chain.`,
          severity,
        });
      }
    }
  }

  // ── Tonal imbalance (system-level) ──
  const warmCount = profiles.filter((p) => p.axes.warm_bright === 'warm').length;
  const brightCount = profiles.filter((p) => p.axes.warm_bright === 'bright').length;
  if (warmCount >= 2 && brightCount === 0) {
    const warmContributors = profiles.filter((p) => p.axes.warm_bright === 'warm').map((p) => p.name);
    candidates.push({
      componentName: warmContributors[0],
      category: 'tonal_imbalance',
      explanation: `System-wide warmth bias without counterbalance. ${warmContributors.join(' and ')} compound tonal density, potentially reducing transient precision.`,
      severity: warmCount * 2,
    });
  }
  if (brightCount >= 2 && warmCount === 0) {
    const brightContributors = profiles.filter((p) => p.axes.warm_bright === 'bright').map((p) => p.name);
    candidates.push({
      componentName: brightContributors[0],
      category: 'tonal_imbalance',
      explanation: `System-wide brightness bias. ${brightContributors.join(' and ')} compound analytical character, potentially thinning tonal body and increasing fatigue risk.`,
      severity: brightCount * 2,
    });
  }

  // Return highest severity — minimum threshold of 2 prevents
  // minor design trade-offs from being elevated to "primary constraint"
  candidates.sort((a, b) => b.severity - a.severity);
  if (candidates.length === 0 || candidates[0].severity < 2) return undefined;

  const top = candidates[0];
  return {
    componentName: top.componentName,
    category: top.category,
    explanation: top.explanation,
  };
}

// ── Component assessments (reviewer style) ──────────

/**
 * Build per-component structured assessments.
 * Uses concise technical vocabulary: timing, elasticity, tonal density,
 * stored energy, microdetail, stability, scale.
 */
function buildComponentAssessments(
  components: SystemComponent[],
  profiles: ComponentAxisProfile[],
  constraint?: MemoPrimaryConstraint,
): MemoComponentAssessment[] {
  return components.map((c, i) => {
    const axes = profiles[i].axes;
    const traits = c.product?.traits;
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const designTradeoffs: string[] = [];

    // ── Elite product detection ──
    // Products at this tier represent intentional design philosophy — their
    // axis-derived trade-offs are deliberate choices, not limitations.
    // Criteria: price >= $8000 OR (boutique brand at upper-mid/high-end tier).
    const isElite = c.product && (
      c.product.price >= 8000
      || (c.product.brandScale === 'boutique' && c.product.priceTier === 'high-end')
    );

    // ── Axis-derived strengths (differentiated by component role) ──
    // Same axis position on different component types reflects different
    // engineering causes — use role-specific language to avoid identical
    // descriptions for components that share axis leanings.
    const isDac = c.role === 'dac' || c.role === 'streamer';
    const isAmp = c.role === 'amplifier' || c.role === 'integrated';
    const isSpeaker = c.role === 'speaker';

    if (axes.warm_bright === 'warm') {
      strengths.push(isDac ? 'Rich harmonic rendering' : isAmp ? 'Warm current delivery and tonal body' : isSpeaker ? 'Full-bodied tonal presentation' : 'Tonal density and harmonic richness');
    }
    if (axes.warm_bright === 'bright') {
      strengths.push(isDac ? 'FPGA/conversion timing precision and low stored energy' : isAmp ? 'Fast signal path with minimal coloring' : isSpeaker ? 'Lively treble energy and articulation' : 'Transient speed and low stored energy');
    }
    if (axes.warm_bright === 'neutral') strengths.push('Neutral tonal balance');
    if (axes.smooth_detailed === 'smooth') {
      strengths.push(isDac ? 'Organic conversion character' : isAmp ? 'Easy, unforced musical delivery' : 'Musical flow and ease');
    }
    if (axes.smooth_detailed === 'detailed') {
      strengths.push(isDac ? 'Conversion-stage microdetail and transparency' : isAmp ? 'Circuit transparency — reveals source differences' : isSpeaker ? 'Driver resolution and crossover transparency' : 'Microdetail retrieval and transparency');
    }
    if (axes.elastic_controlled === 'elastic') {
      strengths.push(isDac ? 'Dynamic timing agility in the conversion stage' : isAmp ? 'Current delivery responds to musical dynamics' : isSpeaker ? 'Driver excursion and dynamic expression' : 'Elasticity and dynamic expression');
    }
    if (axes.elastic_controlled === 'controlled') {
      strengths.push(isDac ? 'Clock stability and conversion composure' : isAmp ? 'Damping factor and load control' : isSpeaker ? 'Cone control and transient discipline' : 'Stability and grip under load');
    }
    if (axes.scale_intimacy === 'scale') {
      strengths.push(isDac ? 'Spatial reconstruction from the conversion stage' : isAmp ? 'Amplifier-stage spatial openness' : isSpeaker ? 'Cabinet design and driver dispersion create open staging' : 'Spatial scale and image separation');
    }

    // ── Trait-enriched strengths ──
    if (traits) {
      if ((traits.flow ?? 0.5) > 0.7) strengths.push('Strong continuity and musical timing');
      if ((traits.spatial_precision ?? 0.5) > 0.75) strengths.push('Precise spatial imaging');
      if ((traits.composure ?? 0.5) > 0.75) strengths.push('Composure on complex passages');
    }

    // ── Architecture note ──
    if (c.product?.architecture) {
      strengths.push(`${c.product.architecture} topology`);
    }

    // ── Axis-derived observations (differentiated by component role) ──
    // For elite products, these are design trade-offs (intentional philosophy).
    // For other products, they are weaknesses (potential limitations).
    const axisTarget = isElite ? designTradeoffs : weaknesses;
    if (axes.warm_bright === 'warm') {
      axisTarget.push(isDac ? 'Conversion warmth may mask upstream detail' : isAmp ? 'Amplifier coloration may soften transient edges' : 'Transient edges may soften');
    }
    if (axes.warm_bright === 'bright') {
      axisTarget.push(isDac ? 'Light tonal weight from the source stage' : isAmp ? 'Lean amplifier voicing — tonal density may be thin' : 'Tonal density may lean thin');
    }
    if (axes.smooth_detailed === 'smooth') axisTarget.push('Fine detail may be smoothed over');
    if (axes.smooth_detailed === 'detailed') {
      axisTarget.push(isDac ? 'Source-level transparency may expose recording flaws' : isAmp ? 'Amplifier resolving power may sound unforgiving' : 'Lesser recordings may sound unforgiving');
    }
    if (axes.elastic_controlled === 'controlled') axisTarget.push('Dynamic elasticity may be suppressed');
    if (axes.elastic_controlled === 'elastic') axisTarget.push('May lose grip on dense orchestral material');
    if (axes.scale_intimacy === 'intimacy') axisTarget.push('Spatial scale is constrained');

    // ── Trait-enriched weaknesses (genuine deficiencies — always weaknesses) ──
    if (traits) {
      if ((traits.tonal_density ?? 0.5) < 0.35) weaknesses.push('Low tonal body — midrange may lack weight');
      if ((traits.flow ?? 0.5) < 0.35) weaknesses.push('Musical involvement is limited');
    }

    // ── Verdict — aware of bottleneck status and elite tier ──
    const isBottleneck = constraint?.componentName === c.displayName;
    let verdict: string;
    let verdictKind: import('./advisory-response').VerdictKind;
    if (isBottleneck) {
      verdict = `**This is the primary constraint in the chain.** Upgrading here yields the highest system-level impact.`;
      verdictKind = 'bottleneck';
    } else if (isElite) {
      verdict = `World-class component. Any different behavior is a matter of upstream matching and taste, not limitation.`;
      verdictKind = 'keeper';
    } else if (weaknesses.length === 0) {
      verdict = `Performing well. No immediate upgrade rationale.`;
      verdictKind = 'keeper';
    } else if (strengths.length > weaknesses.length + 1) {
      verdict = `Strong contributor to the system's character. Worth keeping.`;
      verdictKind = 'keeper';
    } else {
      verdict = `Solid at its tier. Room for refinement, not the priority.`;
      verdictKind = 'balanced';
    }

    // ── Summary — one line, technical ──
    const summary = c.product?.description
      ?? c.brandProfile?.tendencies
      ?? c.character;

    return {
      name: c.displayName,
      role: c.role !== 'component' ? c.role : undefined,
      summary,
      strengths: strengths.slice(0, 5),
      weaknesses: weaknesses.slice(0, 4),
      designTradeoffs: designTradeoffs.length > 0 ? designTradeoffs.slice(0, 4) : undefined,
      verdict,
      verdictKind,
    };
  });
}

// ── Keep recommendations ────────────────────────────

function buildKeepRecommendations(
  assessments: MemoComponentAssessment[],
  upgradePaths: MemoUpgradePath[],
  constraint?: MemoPrimaryConstraint,
): MemoKeepRecommendation[] {
  // Collect all component names targeted by upgrade paths.
  // A component that has an upgrade path should NOT also appear in keeps.
  const upgradeTargetRoles = new Set(
    upgradePaths.map((p) => p.label.replace(/\s+Upgrade$/i, '').toLowerCase()),
  );

  const keeps: MemoKeepRecommendation[] = [];
  for (const a of assessments) {
    const isBottleneck = constraint?.componentName === a.name;
    if (isBottleneck) continue;

    // Check whether this component's role matches an upgrade path target
    const role = a.role ? canonicalRole(a.role).toLowerCase() : '';
    const isUpgradeTarget = upgradeTargetRoles.has(role);
    if (isUpgradeTarget) continue;

    if (a.strengths.length > a.weaknesses.length) {
      keeps.push({
        name: a.name,
        reason: a.strengths.slice(0, 2).join('; '),
      });
    }
  }
  return keeps;
}

// ── System tier estimation ──────────────────────────
//
// Estimates the overall quality tier of a system from brand reputation,
// product prices, and system complexity. Used to suppress bottleneck
// analysis for reference-level systems where there are no meaningful
// weaknesses — only intentional trade-offs.
//
// Tiers:
//   'reference'  — high-end, deliberately curated system (suppress bottlenecks)
//   'enthusiast' — serious system with clear investment (normal analysis)
//   'entry'      — starter or budget system (normal analysis)

type SystemTier = 'reference' | 'enthusiast' | 'entry';

function estimateSystemTier(components: SystemComponent[]): SystemTier {
  let score = 0;

  for (const c of components) {
    // Brand reputation signals
    const scale = c.brandProfile
      ? (BRAND_PROFILES.find((bp) =>
          bp.names.some((n) => n.toLowerCase() === (c.brandProfile as any)?._matchedName?.toLowerCase()),
        )?.brandScale ?? inferBrandScale(c))
      : inferBrandScale(c);

    if (scale === 'boutique') score += 3;
    else if (scale === 'specialist') score += 2;
    else if (scale === 'mainstream') score += 1;

    // Price signals from catalogued products
    if (c.product) {
      const price = c.product.price;
      if (price >= 5000) score += 3;
      else if (price >= 2000) score += 2;
      else if (price >= 800) score += 1;
    }

    // Brand profile presence indicates a recognised, established brand
    if (c.brandProfile) score += 1;
  }

  // Normalise by component count to avoid penalising simpler systems
  const componentCount = Math.max(components.length, 1);
  const normalised = score / componentCount;

  // Reference threshold: average score ≥ 3.5 per component
  // (e.g. boutique brand + $5k+ product = 7 per component)
  if (normalised >= 3.5 && componentCount >= 3) return 'reference';
  if (normalised >= 2.0) return 'enthusiast';
  return 'entry';
}

/** Infer brand scale from component display name when no brand profile exists. */
function inferBrandScale(c: SystemComponent): string {
  // Check if the brand profile has brandScale
  // Since we may not have matched via BRAND_PROFILES array directly,
  // check the brandProfile object on the component
  if (c.brandProfile) {
    // The brandProfile on SystemComponent is a subset — check for scale
    // via the BRAND_PROFILES lookup
    const bp = BRAND_PROFILES.find((p) =>
      p.names.some((n) => c.displayName.toLowerCase().includes(n.toLowerCase())),
    );
    if (bp?.brandScale) return bp.brandScale;
  }
  return 'unknown';
}

// ── Upgrade paths (bottleneck-driven) ───────────────
//
// Pipeline: constraint → Path 1 (bottleneck) → Path 2 (secondary) → Path 3 (refinement).
// The primary constraint always drives Path 1.

function buildUpgradePaths(
  components: SystemComponent[],
  profiles: ComponentAxisProfile[],
  assessments: MemoComponentAssessment[],
  constraint?: MemoPrimaryConstraint,
  stacked?: MemoStackedTraitInsight[],
): MemoUpgradePath[] {
  const paths: MemoUpgradePath[] = [];

  // ── Path 1: Bottleneck (Highest Impact) ──
  if (constraint) {
    const bottleneckIdx = components.findIndex((c) => c.displayName === constraint.componentName);
    const role = bottleneckIdx >= 0 ? canonicalRole(components[bottleneckIdx].role) : constraint.componentName;
    const axes = bottleneckIdx >= 0 ? profiles[bottleneckIdx].axes : undefined;

    // What the upgrade should introduce
    const targets: string[] = [];
    if (axes) {
      if (axes.warm_bright === 'bright') targets.push('tonal density');
      if (axes.warm_bright === 'warm') targets.push('transient speed');
      if (axes.smooth_detailed === 'smooth') targets.push('microdetail');
      if (axes.smooth_detailed === 'detailed') targets.push('musical flow');
      if (axes.elastic_controlled === 'controlled') targets.push('elasticity');
      if (axes.elastic_controlled === 'elastic') targets.push('stability');
    }
    const targetPhrase = targets.length > 0
      ? `Look for components offering ${targets.join(' and ')}.`
      : 'A change here shifts the system\'s fundamental character.';

    paths.push({
      rank: 1,
      label: `${role} Upgrade`,
      impact: 'Highest Impact',
      rationale: `${constraint.explanation} ${targetPhrase}`,
      options: [],
    });
  }

  // ── Paths 2–3: remaining components by weakness severity ──
  // Sort by weakness count first, then by role influence hierarchy
  // (speakers > DAC > amp > streamer) as tiebreaker — higher-influence
  // components are more impactful upgrade targets.
  // Elite products (high-end boutique, $8k+) are excluded — their
  // axis-derived trade-offs are design philosophy, not upgrade targets.
  const remaining = assessments
    .map((a, i) => ({ assessment: a, component: components[i], profile: profiles[i] }))
    .filter((r) => {
      if (r.component.displayName === constraint?.componentName) return false;
      if (r.assessment.weaknesses.length < 1) return false;
      // Skip elite products — their trade-offs are intentional, not limitations
      const prod = r.component.product;
      if (prod && (prod.price >= 8000 || (prod.brandScale === 'boutique' && prod.priceTier === 'high-end'))) return false;
      // Skip single-driver / horn-loaded / crossoverless speakers — their
      // weaknesses (lean tonal density, limited composure) are inherent design
      // trade-offs for coherence, speed, and transient immediacy, not upgrade targets.
      if (prod && r.component.role.includes('speak')) {
        const arch = (prod.architecture ?? '').toLowerCase();
        const topo = (prod.topology ?? '').toLowerCase();
        const isByDesign =
          arch.includes('single-driver') || arch.includes('crossoverless')
          || arch.includes('fullrange') || topo.includes('horn') || topo.includes('single-driver');
        if (isByDesign) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const weakDiff = b.assessment.weaknesses.length - a.assessment.weaknesses.length;
      if (weakDiff !== 0) return weakDiff;
      // Tiebreaker: role influence hierarchy — speakers have the largest
      // sonic impact, followed by DAC, amplifier, then source/streamer.
      return upgradeInfluence(b.component.role) - upgradeInfluence(a.component.role);
    });

  // Track which roles already have an upgrade path (prevents duplicate categories)
  const usedRoles = new Set(paths.map((p) => p.label));

  let added = 0;
  for (const r of remaining) {
    if (added >= 2) break;
    const role = canonicalRole(r.component.role);
    const label = `${role} Upgrade`;
    // Skip if this role already has an upgrade path (e.g. bottleneck is also a DAC)
    if (usedRoles.has(label)) continue;
    usedRoles.add(label);

    const rank = paths.length + 1;
    const weakSummary = r.assessment.weaknesses.slice(0, 2).join('; ').toLowerCase();

    paths.push({
      rank,
      label,
      impact: added === 0 ? 'Moderate Impact' : 'Refinement',
      rationale: `Current limitation: ${weakSummary}. Addressing this refines the system's balance without changing its core identity.`,
      options: [],
    });
    added++;
  }

  // ── If stacked and no component-level paths remain, add a rebalancing path ──
  if (paths.length < 2 && stacked && stacked.length > 0) {
    const insight = stacked[0];
    paths.push({
      rank: paths.length + 1,
      label: 'System Rebalancing',
      impact: paths.length === 0 ? 'Highest Impact' : 'Moderate Impact',
      rationale: `The chain stacks ${insight.label}. Introducing a component with contrasting character would broaden the system's range. ${insight.explanation}`,
      options: [],
    });
  }

  return paths;
}

// ── Recommended sequence ────────────────────────────

function buildRecommendedSequence(
  paths: MemoUpgradePath[],
  keeps: MemoKeepRecommendation[],
): MemoRecommendedStep[] {
  const steps: MemoRecommendedStep[] = [];
  let stepNum = 0;

  for (const p of paths.slice(0, 3)) {
    stepNum++;
    // Extract first sentence of rationale
    const brief = p.rationale.split('.')[0];
    steps.push({
      step: stepNum,
      action: `**${p.label}** — ${brief}.`,
    });
  }

  if (keeps.length > 0) {
    stepNum++;
    const keepNames = keeps.map((k) => `**${k.name}**`).join(', ');
    steps.push({
      step: stepNum,
      action: `Keep ${keepNames} — performing well, no change warranted.`,
    });
  }

  if (stepNum > 0) {
    stepNum++;
    steps.push({
      step: stepNum,
      action: 'Audition before committing. System synergy matters more than component reputation.',
    });
  }

  return steps;
}

// ── Final reconciliation ────────────────────────────
//
// Cross-checks all assessment outputs to ensure internal consistency.
// Each component ends up in exactly one status:
//   1. bottleneck — the primary constraint (appears in Path 1)
//   2. upgrade target — secondary or refinement (appears in Paths 2–3)
//   3. keeper — "Components I Would NOT Change"
//   4. unclassified — components not in any bucket (neutral streamers, etc.)
//
// Also rebuilds the recommended sequence to match the reconciled state.

interface ReconciliationResult {
  keeps: MemoKeepRecommendation[];
  sequence: MemoRecommendedStep[];
}

function reconcileAssessmentOutputs(
  components: SystemComponent[],
  assessments: MemoComponentAssessment[],
  upgradePaths: MemoUpgradePath[],
  rawKeeps: MemoKeepRecommendation[],
  constraint?: MemoPrimaryConstraint,
): ReconciliationResult {
  // ── Build role → status map ──
  // Upgrade path labels follow the pattern "DAC Upgrade", "Speakers Upgrade", etc.
  const upgradeRoles = new Set(
    upgradePaths.map((p) => p.label.replace(/\s+Upgrade$/i, '').toLowerCase()),
  );
  const bottleneckName = constraint?.componentName?.toLowerCase() ?? '';

  // ── Reconcile keeps ──
  // A component must not appear in keeps if:
  //   (a) it is the bottleneck, or
  //   (b) its canonical role matches an upgrade path target
  const reconciledKeeps = rawKeeps.filter((k) => {
    const nameLower = k.name.toLowerCase();
    // Direct bottleneck match
    if (nameLower === bottleneckName) return false;
    // Role-based upgrade target match
    const assessment = assessments.find((a) => a.name === k.name);
    if (assessment?.role) {
      const role = canonicalRole(assessment.role).toLowerCase();
      if (upgradeRoles.has(role)) return false;
    }
    // Name-based upgrade target match (fuzzy — check if any path label contains the component name)
    for (const p of upgradePaths) {
      const pathLower = p.label.toLowerCase();
      if (pathLower.includes(nameLower) || nameLower.includes(pathLower.replace(/\s+upgrade$/i, ''))) {
        return false;
      }
    }
    return true;
  });

  // ── Rebuild sequence from reconciled data ──
  const sequence = buildRecommendedSequence(upgradePaths, reconciledKeeps);

  return { keeps: reconciledKeeps, sequence };
}

// ── MemoFindings extraction ─────────────────────────
//
// Maps pipeline outputs to the structured MemoFindings contract.
// This is the bridge between the internal builder types and the
// renderer-agnostic contract.

function extractMemoFindings(
  components: SystemComponent[],
  profiles: ComponentAxisProfile[],
  chain: MemoSystemChain,
  systemAxes: PrimaryAxisLeanings,
  stacked: MemoStackedTraitInsight[],
  constraint: MemoPrimaryConstraint | undefined,
  assessments: MemoComponentAssessment[],
  upgradePaths: MemoUpgradePath[],
  keeps: MemoKeepRecommendation[],
  sequence: MemoRecommendedStep[],
  sourceRefs: import('./advisory-response').SourceReference[],
  desires?: DesireSignal[],
  perComponentLinks?: Map<string, { label: string; url: string; kind?: 'reference' | 'dealer' | 'review'; region?: string }[]>,
): MemoFindings {
  // ── Per-component findings ──
  const componentVerdicts: ComponentFindings[] = components.map((c, i) => {
    const assessment = assessments.find((a) => a.name === c.displayName);
    const profile = profiles[i];

    // Determine verdict
    let verdict: ComponentVerdict = 'neutral';
    if (constraint?.componentName === c.displayName) {
      verdict = 'bottleneck';
    } else if (keeps.some((k) => k.name === c.displayName)) {
      verdict = 'keep';
    } else if (assessment && assessment.weaknesses.length > assessment.strengths.length) {
      verdict = 'upgrade';
    }

    return {
      name: c.displayName,
      role: c.role,
      catalogSource: profile.source as CatalogSource,
      axisPosition: profile.axes,
      strengths: assessment?.strengths ?? [],
      weaknesses: assessment?.weaknesses ?? [],
      verdict,
      architecture: c.product?.architecture,
      links: perComponentLinks?.get(c.displayName),
    };
  });

  // ── Stacked traits → structured tags ──
  const stackedTraits: StackedTraitFinding[] = stacked.map((s) => ({
    property: s.label, // inherits from STACKED_LABELS — already a short tag
    contributors: s.contributors,
    classification: s.classification,
  }));

  // ── Bottleneck → structured finding ──
  let bottleneck: BottleneckFinding | null = null;
  if (constraint) {
    const idx = components.findIndex((c) => c.displayName === constraint.componentName);
    const axes = idx >= 0 ? profiles[idx].axes : undefined;
    const constrainedAxes: string[] = [];
    if (axes) {
      if (axes.warm_bright !== 'neutral') constrainedAxes.push('warm_bright');
      if (axes.smooth_detailed !== 'neutral') constrainedAxes.push('smooth_detailed');
      if (axes.elastic_controlled !== 'neutral') constrainedAxes.push('elastic_controlled');
      if (axes.scale_intimacy !== 'neutral') constrainedAxes.push('scale_intimacy');
    }

    bottleneck = {
      component: constraint.componentName,
      role: idx >= 0 ? components[idx].role : 'component',
      category: constraint.category,
      constrainedAxes,
      severity: 0, // severity not preserved through PrimaryConstraint — default
    };
  }

  // ── Upgrade paths → structured findings ──
  const upgradePathFindings: UpgradePathFinding[] = upgradePaths.map((p) => {
    const impactTag: UpgradePathFinding['impact'] =
      p.impact === 'Highest Impact' ? 'highest'
      : p.impact === 'Moderate Impact' ? 'moderate'
      : 'refinement';

    // Extract target axes from the rationale keywords
    const targetAxes: string[] = [];
    const r = (p.rationale ?? '').toLowerCase();
    if (r.includes('tonal density') || r.includes('warmth')) targetAxes.push('warm_bright');
    if (r.includes('detail') || r.includes('microdetail') || r.includes('flow')) targetAxes.push('smooth_detailed');
    if (r.includes('elasticity') || r.includes('stability') || r.includes('grip')) targetAxes.push('elastic_controlled');
    if (r.includes('spatial') || r.includes('scale')) targetAxes.push('scale_intimacy');

    return {
      rank: p.rank,
      targetRole: p.label.replace(/\s+Upgrade$/i, ''),
      impact: impactTag,
      targetAxes,
      options: (p.options ?? []).map((o) => ({
        name: o.name,
        brand: o.brand ?? '',
        priceRange: o.priceNote ?? '',
        axisProfile: { warm_bright: 'neutral', smooth_detailed: 'neutral', elastic_controlled: 'neutral', scale_intimacy: 'neutral' } as PrimaryAxisLeanings,
      })),
    };
  });

  // ── Keep findings ──
  const keepFindings: KeepFinding[] = keeps.map((k) => {
    const idx = components.findIndex((c) => c.displayName === k.name);
    const axes = idx >= 0 ? profiles[idx].axes : undefined;
    const alignedAxes: string[] = [];
    if (axes) {
      if (axes.warm_bright !== 'neutral') alignedAxes.push('warm_bright');
      if (axes.smooth_detailed !== 'neutral') alignedAxes.push('smooth_detailed');
      if (axes.elastic_controlled !== 'neutral') alignedAxes.push('elastic_controlled');
      if (axes.scale_intimacy !== 'neutral') alignedAxes.push('scale_intimacy');
    }
    return {
      name: k.name,
      role: idx >= 0 ? components[idx].role : 'component',
      alignedAxes,
    };
  });

  // ── Recommended sequence → structured steps ──
  const recommendedSteps: RecommendedStepFinding[] = sequence.map((s) => {
    // Parse action to extract target role
    const actionMatch = s.action.match(/\*\*(.+?)\*\*/);
    const label = actionMatch ? actionMatch[1] : s.action;
    const targetRole = label.replace(/\s+Upgrade$/i, '').replace(/^Keep\s+/i, '');
    return {
      step: s.step,
      action: label,
      targetRole,
    };
  });

  // ── Deliberateness signals ──
  const deliberateness = assessSystemDeliberateness(components, systemAxes);
  const deliberatenessSignals: DeliberatenessSignal[] = [];
  if (deliberateness.isDeliberate) {
    // Infer which signals contributed
    const brands = new Set(components.map((c) => c.displayName.split(' ')[0].toLowerCase()));
    if (brands.size >= 2) deliberatenessSignals.push('multi_brand_coherence');
    const hasSpecialist = components.some((c) => c.product?.brandScale === 'boutique' || c.product?.brandScale === 'specialist');
    if (hasSpecialist) deliberatenessSignals.push('specialist_brands_present');
    // Check axis consistency
    const nonNeutralAxes = [
      systemAxes.warm_bright !== 'neutral',
      systemAxes.smooth_detailed !== 'neutral',
      systemAxes.elastic_controlled !== 'neutral',
      systemAxes.scale_intimacy !== 'neutral',
    ].filter(Boolean).length;
    if (nonNeutralAxes >= 1) deliberatenessSignals.push('consistent_axis_alignment');
    if (deliberateness.note.includes('punches above')) deliberatenessSignals.push('punches_above_tier');
  }

  // ── Listener priorities (controlled tags) ──
  const listenerPriorities: ListenerPriority[] = inferListenerPriorityTags(systemAxes, desires);

  // ── Source references ──
  const sourceReferences: SourceReferenceFinding[] = sourceRefs.map((r) => ({
    source: r.source,
    note: r.note,
    url: r.url,
  }));

  return {
    componentNames: components.map((c) => c.displayName),
    systemChain: {
      roles: chain.roles,
      names: chain.names,
      fullChain: chain.fullChain,
    },
    systemAxes,
    perComponentAxes: profiles.map((p) => ({
      name: p.name,
      axes: p.axes,
      source: p.source as CatalogSource,
    })),
    stackedTraits,
    bottleneck,
    componentVerdicts,
    upgradePaths: upgradePathFindings,
    keeps: keepFindings,
    recommendedSequence: recommendedSteps,
    isDeliberate: deliberateness.isDeliberate,
    deliberatenessSignals,
    listenerPriorities,
    sourceReferences,
  };
}

/**
 * Infer listener priority tags from system axes and desire signals.
 * Returns controlled ListenerPriority tags — no prose, no freeform strings.
 */
function inferListenerPriorityTags(
  system: PrimaryAxisLeanings,
  desires?: DesireSignal[],
): ListenerPriority[] {
  const priorities: ListenerPriority[] = [];

  // Axis-derived priorities
  if (system.elastic_controlled === 'elastic') {
    priorities.push('rhythmic_articulation');
    if (system.smooth_detailed === 'detailed' || system.warm_bright === 'bright') {
      priorities.push('timing_accuracy', 'low_stored_energy');
    }
  }
  if (system.warm_bright === 'warm') {
    priorities.push('tonal_warmth');
    if (system.smooth_detailed === 'smooth') {
      priorities.push('fatigue_resistance', 'harmonic_richness');
    } else {
      priorities.push('tonal_density');
    }
  }
  if (system.warm_bright === 'bright') {
    priorities.push('transient_speed');
  }
  if (system.smooth_detailed === 'detailed') {
    priorities.push('transparency');
  }
  if (system.smooth_detailed === 'smooth') {
    priorities.push('musical_flow');
  }
  if (system.elastic_controlled === 'controlled') {
    priorities.push('control_precision');
    if (system.smooth_detailed === 'detailed') {
      priorities.push('dynamic_contrast');
    }
  }
  if (system.scale_intimacy === 'scale') {
    priorities.push('spatial_openness');
  }

  // Desire-informed additions
  if (desires && desires.length > 0) {
    for (const d of desires) {
      const q = d.quality.toLowerCase();
      if (d.direction === 'more') {
        if (q.includes('detail') || q.includes('clarity')) priorities.push('transparency');
        if (q.includes('warm') || q.includes('body') || q.includes('rich')) priorities.push('tonal_warmth');
        if (q.includes('spatial') || q.includes('stage') || q.includes('air')) priorities.push('spatial_openness');
        if (q.includes('dynamics') || q.includes('punch')) priorities.push('dynamic_contrast');
        if (q.includes('timing') || q.includes('rhythm')) priorities.push('rhythmic_articulation');
        if (q.includes('flow') || q.includes('smooth')) priorities.push('musical_flow');
      }
    }
  }

  // Deduplicate
  return [...new Set(priorities)];
}

// ── Key observation (design philosophy inference) ───
//
// Infers the listener's underlying design philosophy from component
// choices: timing-first, harmonic-density, studio-neutral, etc.
// Reads like a reviewer's closing note, not a chatbot summary.

function buildKeyObservation(
  components: SystemComponent[],
  profiles: ComponentAxisProfile[],
  stacked: MemoStackedTraitInsight[],
  system: PrimaryAxisLeanings,
  desires?: DesireSignal[],
): string {
  // ── Infer design philosophy from component patterns ──
  const brandNames = components.map((c) => c.displayName);
  const philosophyTraits: string[] = [];

  // Timing-first: bright or detailed + elastic
  const timingFirst = (system.warm_bright === 'bright' || system.smooth_detailed === 'detailed')
    && system.elastic_controlled !== 'controlled';
  // Harmonic-density: warm + smooth
  const harmonicDensity = system.warm_bright === 'warm'
    && (system.smooth_detailed === 'smooth' || system.smooth_detailed === 'neutral');
  // Studio-neutral: all neutral or near-neutral
  const studioNeutral = system.warm_bright === 'neutral'
    && system.smooth_detailed === 'neutral'
    && system.elastic_controlled === 'neutral';
  // Control-first: controlled + detailed
  const controlFirst = system.elastic_controlled === 'controlled'
    && system.smooth_detailed === 'detailed';

  if (timingFirst) philosophyTraits.push('timing accuracy', 'low stored energy');
  if (harmonicDensity) philosophyTraits.push('harmonic richness', 'tonal density');
  if (studioNeutral) philosophyTraits.push('neutrality', 'transparency');
  if (controlFirst) philosophyTraits.push('precision', 'analytical control');
  if (system.elastic_controlled === 'elastic') philosophyTraits.push('dynamic elasticity');

  // ── Desire-informed layer ──
  if (desires && desires.length > 0) {
    const topDesire = desires[0];
    const quality = topDesire.quality.toLowerCase();
    const verb = topDesire.direction === 'more' ? 'values' : 'wants to reduce';

    if (philosophyTraits.length > 0) {
      return `Your taste pattern points toward equipment emphasising **${philosophyTraits.join(' and ')}**. Components in this chain (${brandNames.join(', ')}) share this design approach. You also ${verb} ${quality} — future upgrades should preserve the underlying philosophy while addressing that specific axis.`;
    }

    return `You ${verb} ${quality}. The current chain is broadly balanced, so targeted component changes can address this without destabilising the overall character.`;
  }

  // ── Philosophy-driven observation ──
  if (philosophyTraits.length > 0) {
    const philo = philosophyTraits.join(' and ');
    const imbalances = stacked.filter((s) => s.classification === 'system_imbalance');
    const characters = stacked.filter((s) => s.classification === 'system_character');
    let stackedNote = '';
    if (imbalances.length > 0) {
      stackedNote = ` The chain leans toward ${imbalances[0].label}, which deepens this character but narrows the system's range.`;
    } else if (characters.length > 0) {
      stackedNote = ` The chain shares a consistent ${characters[0].label} emphasis — this reinforces the system's identity.`;
    }

    return `Your component choices suggest a preference for equipment emphasising **${philo}**. ${brandNames.join(', ')} share this design philosophy.${stackedNote} Future upgrades should preserve this approach — swapping in components with a fundamentally different design priority would destabilise what the system does well.`;
  }

  // ── Balanced fallback ──
  if (stacked.length > 0) {
    const imbalances = stacked.filter((s) => s.classification === 'system_imbalance');
    const characters = stacked.filter((s) => s.classification === 'system_character');
    if (imbalances.length > 0) {
      return `Despite broadly balanced axis positions, the system stacks ${imbalances[0].label} across the chain. This is worth monitoring — it can be a deliberate strength or an emerging limitation depending on listening priorities. Targeted component changes can adjust this without rebuilding the system.`;
    }
    if (characters.length > 0) {
      return `The system shares a consistent ${characters[0].label} emphasis across components. This is a defining feature of the system's sonic identity — not a limitation. Future upgrades should preserve this character.`;
    }
  }

  return `This system is architecturally balanced. No single design philosophy dominates. Upgrades from here are about refinement — choosing which quality to intensify. The risk is low; the system tolerates experimentation in any direction.`;
}

function buildAssessmentPreferenceAlignment(
  components: SystemComponent[],
  desires?: DesireSignal[],
): string | null {
  if (!desires || desires.length === 0) return null;

  // Classify system lean using axis model
  const profiles = classifyComponentAxes(components);
  const systemLean = deriveSystemLeanFromAxes(profiles);

  // Mirror top desire and relate to system character
  const topDesire = desires[0];
  const wantMore = topDesire.direction === 'more';
  const quality = topDesire.quality.toLowerCase();

  // Warm-axis qualities
  const warmQualities = ['warmth', 'body', 'density', 'richness', 'weight', 'fullness'];
  // Precision-axis qualities
  const precisionQualities = ['detail', 'clarity', 'speed', 'sparkle', 'precision', 'articulation', 'definition'];

  const wantsWarmth = wantMore && warmQualities.some((q) => quality.includes(q));
  const wantsPrecision = wantMore && precisionQualities.some((q) => quality.includes(q));
  const wantsLessFatigue = !wantMore && ['fatigue', 'harshness', 'glare', 'brightness', 'sibilance'].some((q) => quality.includes(q));

  if (wantsWarmth && systemLean === 'warm') {
    return `You mentioned wanting more ${quality}. Your system already leans in that direction — the question is whether it has gone far enough or whether the warmth has pushed past the point of clarity.`;
  }
  if (wantsWarmth && systemLean === 'precise') {
    return `You mentioned wanting more ${quality}. Your system currently leans toward precision, so there is room to shift the balance — the most effective lever depends on which component is contributing the most analytical character.`;
  }
  if (wantsPrecision && systemLean === 'precise') {
    return `You mentioned wanting more ${quality}. Your system already emphasises this — adding more could push past incisive into fatiguing. Consider whether the current level is close to what you want before making changes.`;
  }
  if (wantsPrecision && systemLean === 'warm') {
    return `You mentioned wanting more ${quality}. Your system leans warm, so there would likely be room to increase definition without losing the underlying tonal body — the question is which component to address first.`;
  }
  if (wantsLessFatigue) {
    return `You mentioned wanting less ${quality}. This is worth investigating component by component — fatigue-related traits often trace to a specific point in the chain rather than the system as a whole.`;
  }

  // Generic fallback for other desires
  return `You mentioned wanting ${wantMore ? 'more' : 'less'} ${quality}. Understanding how your current system handles this quality is the first step — the assessment above should help frame where the leverage points are.`;
}

// ── Consultation entry builder ───────────────────────
//
// Handles vague system assessment requests where the user hasn't named
// specific gear yet. Produces a structured intake response that:
//   1. Acknowledges the request
//   2. Extracts any already-present listener priorities
//   3. Explains how Audio XX evaluates systems
//   4. Asks for specific components in a structured way
//
// This prevents these queries from falling into generic shopping clarification.

/**
 * Build a structured consultation intake response for vague system
 * assessment or upgrade-guidance queries.
 *
 * Called when the user asks for system evaluation or upgrade advice
 * but hasn't named specific components.
 */

// ── Hypothetical component detection ─────────────────
// Maps common hypothetical component descriptions to architectural
// knowledge. Returns null if no known component type is detected.

interface HypotheticalComponentInfo {
  label: string;
  character: string;
  tradeoff: string;
  /** How this component type typically aligns with or shifts a system. */
  alignment: string;
}

function detectHypotheticalComponent(text: string): HypotheticalComponentInfo | null {
  const lower = text.toLowerCase();

  // ── Amplifier topologies ─────────────────────────────
  if (/\btube\s+(?:amp|amplifier|integrated)\b/i.test(lower) || /\bvalve\s+amp/i.test(lower)) {
    return {
      label: 'a tube amplifier',
      character: 'Tube amplifiers — particularly single-ended designs — tend toward harmonic richness, midrange density, and elastic dynamics. They often add even-order harmonic texture that many listeners perceive as warmth and tonal beauty. Low-feedback tube designs prioritize musical flow over measured precision.',
      tradeoff: 'What you typically give up: ultimate bass control and damping, transient speed at the frequency extremes, and absolute low-noise transparency. Tubes add their own character — that\'s the point, but it means the amp is an active participant in the sound, not a neutral wire.',
      alignment: 'a tube amplifier would likely push the system toward warmth, flow, and midrange density — potentially compensating for analytical or lean tendencies elsewhere in the chain, or compounding warmth if the source and speakers already lean that way.',
    };
  }
  if (/\bset\b|\bsingle[- ]ended\s+triode/i.test(lower)) {
    return {
      label: 'a single-ended triode (SET) amplifier',
      character: 'SET amplifiers represent the far end of the tube spectrum: minimal circuitry, no push-pull cancellation, very low power (typically 2–8 watts). They prioritize midrange purity, harmonic texture, and a direct, intimate presentation. The best SETs convey a sense of immediacy and presence that higher-power designs can\'t replicate.',
      tradeoff: 'The constraint is power. SETs require high-efficiency speakers (typically 93 dB+ sensitivity) to work at realistic volumes. Bass control is limited by low damping factor. Complex orchestral passages at high volume will compress. This is a design that optimizes for intimacy and tonal beauty at the cost of scale and authority.',
      alignment: 'a SET amplifier would fundamentally reshape the system\'s character toward intimacy, midrange beauty, and harmonic richness — but only with compatible speakers. If the speakers are below ~93 dB sensitivity, the SET won\'t have enough power to drive them properly, and the trade-off becomes a limitation rather than a choice.',
    };
  }
  if (/\bsolid[- ]state\s+(?:amp|amplifier)/i.test(lower) || /\bclass[- ]?a\b.*\b(?:amp|amplifier)/i.test(lower)) {
    return {
      label: 'a solid-state amplifier',
      character: 'Solid-state amplifiers tend toward precision, bass control, and dynamic authority. High-feedback designs offer low distortion and high damping factor — they grip the speaker and control its behavior. Class A solid-state designs often split the difference: the control and transparency of solid-state with a touch of warmth from the bias topology.',
      tradeoff: 'What you typically give up compared to tubes: harmonic richness, midrange texture, and the elastic dynamic quality that comes from soft clipping. High-feedback solid-state can sound analytical or clinical to listeners who prioritize musical flow over precision.',
      alignment: 'a solid-state amplifier would likely push the system toward precision, control, and transparency — potentially compensating for warmth or looseness elsewhere, or compounding analytical tendencies if the source is already precision-focused.',
    };
  }
  if (/\bpush[- ]pull\b.*\b(?:tube|amp|amplifier)/i.test(lower) || /\b(?:tube|amp|amplifier).*\bpush[- ]pull\b/i.test(lower)) {
    return {
      label: 'a push-pull tube amplifier',
      character: 'Push-pull tube designs offer more power than SETs (typically 15–50+ watts) while retaining some tube character. They cancel even-order harmonics through the output transformer, which reduces the overt "tubey" texture but adds dynamic headroom and bass control. Many iconic designs (Dynaco, Marantz, McIntosh) use this topology.',
      tradeoff: 'Push-pull tubes are a compromise position: more power and control than SET, more warmth and midrange weight than solid-state. They don\'t have the stark intimacy of SET or the iron grip of high-feedback solid-state. That middle ground is exactly what many listeners want.',
      alignment: 'a push-pull tube amplifier would add warmth and midrange weight without the speaker-sensitivity constraints of SET. It\'s a moderate shift — noticeable but not radical.',
    };
  }

  // ── DAC topologies ───────────────────────────────────
  if (/\br[- ]?2r\s+(?:dac|ladder)/i.test(lower) || /\br[- ]?2r\b/i.test(lower)) {
    return {
      label: 'an R2R (ladder) DAC',
      character: 'R2R DACs use resistor-ladder networks for direct voltage output. They tend toward tonal density, harmonic texture, and musical flow. The best R2R designs convey a sense of solidity and weight that delta-sigma designs often trade for speed and precision.',
      tradeoff: 'What you typically give up: measured precision, ultimate detail retrieval, and spatial sharpness. R2R designs prioritize the body of the sound over its edges.',
      alignment: 'an R2R DAC would push the source toward warmth, density, and flow — potentially compensating for a lean or clinical downstream chain, or compounding richness if the amplifier already leans warm.',
    };
  }
  if (/\bdelta[- ]sigma\b/i.test(lower) || /\bsabre\b/i.test(lower) || /\bakm\b/i.test(lower)) {
    return {
      label: 'a delta-sigma DAC',
      character: 'Delta-sigma DACs use oversampling and noise shaping for high measured accuracy. They tend toward clarity, spatial precision, and speed. Well-implemented designs can sound detailed and transparent without harshness.',
      tradeoff: 'What you typically give up: tonal density and harmonic weight. Some listeners find delta-sigma designs leaner or less "organic" than R2R alternatives.',
      alignment: 'a delta-sigma DAC would push the source toward clarity and precision — potentially compensating for a warm or dense downstream chain, or compounding analytical tendencies if the amplifier is already precision-focused.',
    };
  }

  // ── Speaker topologies ───────────────────────────────
  if (/\bhorn\s+(?:speaker|loaded)/i.test(lower) || /\bhigh[- ]efficiency\s+speaker/i.test(lower)) {
    return {
      label: 'horn-loaded speakers',
      character: 'Horn speakers use a horn to couple the driver to the room more efficiently. They tend toward dynamic liveliness, presence, and a direct, immediate presentation. High-efficiency designs (typically 95–100+ dB) require very little amplifier power, which opens up the full range of low-power tube amplification.',
      tradeoff: 'What you typically give up: cabinet refinement, bass extension below the horn cutoff, and the polished evenness of conventional direct-radiating designs. Horns can sound colored or forward if poorly implemented.',
      alignment: 'horn speakers would fundamentally change the system\'s dynamic behavior — more immediacy, more presence, and compatibility with low-power tube amplification. The trade-off is typically less bass extension and a more forward presentation.',
    };
  }
  if (/\bplanar\b|\belectrostatic\b|\bribbon\b|\bmagnepan\b|\bmartin logan\b/i.test(lower)) {
    return {
      label: 'planar/electrostatic speakers',
      character: 'Planar and electrostatic speakers use large, thin diaphragms that move air over a wide surface area. They tend toward transparency, speed, and spatial accuracy with a quality of effortlessness that cone speakers rarely match. The best planars disappear sonically — you hear the recording, not the speaker.',
      tradeoff: 'What you typically give up: dynamic punch in the bass, room-filling macro-dynamics, and easy amplifier compatibility. Most planars need substantial current and a room with some distance from the back wall.',
      alignment: 'planar speakers would push the system toward transparency and spatial accuracy — potentially revealing everything upstream with unforgiving clarity.',
    };
  }

  return null;
}

export function buildConsultationEntry(
  currentMessage: string,
  desires: { quality: string; direction: 'more' | 'less'; raw: string }[],
  activeSystem?: ActiveSystemContext | null,
): ConsultationResponse {
  // Extract any listener priorities already expressed
  const priorityParts: string[] = [];
  if (desires.length > 0) {
    for (const d of desires) {
      priorityParts.push(
        d.direction === 'more'
          ? `more ${d.quality}`
          : `less ${d.quality}`,
      );
    }
  }

  // Detect broad upgrade vs assessment intent
  const isUpgradeFocused = /\b(?:upgrade|improve|change|next\s+step|move)\b/i.test(currentMessage);
  const isAssessmentFocused = /\b(?:assess|evaluat|review|think\s+(?:of|about)|thoughts?\s+on)\b/i.test(currentMessage);
  const isRestraintFocused = /\bcase\s+for\s+(?:doing\s+)?nothing\b|\bshould\s+i\s+(?:just\s+)?(?:wait|hold|stay|keep)\b|\bmaybe\s+i\s+should(?:n'?t)?\s+change\b|\breason\s+not\s+to\s+(?:change|upgrade)\b|\bkeep\s+(?:my\s+)?(?:system|setup|chain)\s+as\s+is\b|\bdon'?t\s+(?:need\s+to\s+)?change\s+anything\b/i.test(currentMessage);
  const isMetaQuery = /\bnot\s+in\s+(?:your|the)\s+(?:database|catalog|system)\b|\bdon'?t\s+(?:have|know)\s+(?:that|this|a)\s+(?:product|brand|model)\b|\bhow\s+(?:do|would)\s+you\s+handle\b|\bwhat\s+if\s+you\s+don'?t\s+(?:know|have)\b|\bcan\s+you\s+handle\b|\bwhat\s+are\s+your\s+(?:limits|limitations|capabilities)\b|\bisn'?t\s+in\s+your\b|\bhow\s+many\s+products?\b/i.test(currentMessage);

  // ── Meta / capability query: system self-description ──
  // Fires before system-specific paths because meta questions are
  // independent of whether the user has a saved system.
  if (isMetaQuery) {
    return {
      subject: 'how Audio XX works',
      philosophy: `Audio XX maintains a curated anchor catalog of well-understood components — currently around 127 products across DACs, amplifiers, speakers, headphones, turntables, and streamers. These are products with enough critical and community data to assign confident sonic trait profiles.`,
      tendencies: `When you mention a product outside that catalog, the system doesn't go silent. It identifies the product's design family — topology (R2R, delta-sigma, FPGA, SET, push-pull, etc.), brand philosophy, and price tier — and reasons from established principles for that family. The response will be clearly marked as inferred rather than calibrated, and the confidence level will be stated.\n\nYou can also describe a product in your own words — its general character, what you like and dislike about it — and the system will work from your description. That's often more useful than specs anyway, because it tells me how the product actually sounds in your system and room.\n\nWhat I won't do: invent specific sonic details about a product I haven't been calibrated on, or present inferred knowledge with the same confidence as calibrated data. If I'm uncertain, I'll say so.`,
      followUp: 'Is there a specific product you\'re curious about? I\'m happy to show you what the system can do with it — whether it\'s in the catalog or not.',
    };
  }

  // ── Hypothetical / counterfactual query ──────────────
  // User introduces a speculative system modification ("let's say I have
  // a tube amp", "what if I replaced the DAC with an R2R?"). Reason from
  // component archetype knowledge + accumulated taste signals.
  const isHypothetical = /\blet'?s\s+say\b|\bsuppose\s+(?:i|we)\b|\bwhat\s+if\s+(?:i|we|my)\b|\bimagine\s+(?:i|we)\b|\bhypothetically\b|\bhow\s+would\s+(?:that|it|a|an|the)\s+(?:change|affect|alter|shift)\b|\bif\s+i\s+(?:replaced|swapped|switched|added|used|had)\b/i.test(currentMessage);
  if (isHypothetical) {
    const hypotheticalComponent = detectHypotheticalComponent(currentMessage);
    const hasTasteSignals = priorityParts.length > 0;

    if (hypotheticalComponent) {
      const { label, character, tradeoff, alignment } = hypotheticalComponent;

      // Build system-context-aware or taste-signal-aware response
      let systemNote = '';
      if (activeSystem && activeSystem.components.length > 0) {
        const componentList = activeSystem.components.map((c) => normalizeDisplayName(c.brand, c.name)).join(', ');
        systemNote = `\n\nIn your current system (${componentList}${activeSystem.tendencies ? `, which leans ${activeSystem.tendencies}` : ''}), ${alignment}`;
      } else if (hasTasteSignals) {
        systemNote = `\n\nGiven what you've said you value — ${priorityParts.join(' and ')} — ${alignment}`;
      }

      return {
        subject: `hypothetical — ${label}`,
        philosophy: `${label} is a design philosophy, not a single product. But the family has characteristic tendencies that would shape the system's direction.${systemNote}`,
        tendencies: `${character}\n\nTrade-off: ${tradeoff}`,
        followUp: 'This is architectural reasoning — specific products within the family vary. If you have a particular model in mind, I can be more specific about how it would interact with the rest of the chain.',
      };
    }

    // Hypothetical language detected but no specific component identified
    return {
      subject: 'hypothetical change',
      philosophy: 'That\'s a good question to reason through before committing. The impact of a component change depends on what role it plays in the chain — whether it\'s adding something missing, compensating for an existing tendency, or compounding one.',
      tendencies: hasTasteSignals
        ? `Based on what you've said you value — ${priorityParts.join(' and ')} — the question is whether the change moves the system closer to those priorities or shifts it sideways. Not all changes are improvements; some are just different.`
        : 'Without knowing your current system or preferences in detail, I can reason about the architectural direction — what a given topology tends to contribute and what it tends to trade away.',
      followUp: 'Can you tell me more about what you\'d be changing — and what you\'re hoping it would improve? That helps me frame whether it\'s a compensating move or a compounding one.',
    };
  }

  // ── Active system present: acknowledge and contextualize ──
  if (activeSystem && activeSystem.components.length > 0) {
    const componentNames = activeSystem.components.map((c) => normalizeDisplayName(c.brand, c.name));
    const componentList = componentNames.join(', ');
    const tendenciesNote = activeSystem.tendencies
      ? ` The system leans toward ${activeSystem.tendencies}.`
      : '';

    // ── Restraint path: user asks whether any change is warranted ──
    if (isRestraintFocused) {
      const tendencies = activeSystem.tendencies;
      let philosophy: string;
      let tendenciesText: string;

      if (tendencies) {
        // System has a known character — reason from it
        philosophy = `Based on what you've described, your ${activeSystem.name} system (${componentList}) has a consistent character: ${tendencies}. That coherence is itself worth something. A system with a well-defined point of view is easier to live with than one that's been upgraded toward no particular direction.`;
        tendenciesText = `The case for doing nothing: if the system is doing what it's supposed to do — and the tendency you've described is what you actually want — then a change would shift that character, not improve on it. You'd be exchanging a known quantity for an unknown one. That's only worth it if you have a specific, nameable dissatisfaction.\n\nThe case for change: if the tendency you've described is something you've been tolerating rather than enjoying, or if there's a consistent quality you want more of, then that's a real signal. But "maybe I should change something" isn't that signal — it's restlessness.`;
      } else {
        // No tendency data — reason from structure
        philosophy = `Based on what you've shared, your ${activeSystem.name} system is: ${componentList}. Without knowing how it sounds in your room, I can't tell you whether it's balanced or imbalanced — but I can tell you what a case for doing nothing looks like.`;
        tendenciesText = `The case for doing nothing: if you aren't hearing a consistent problem — something that bothers you across most material — then there's no gap to fill. Upgrades that don't address a real gap tend to change the system's character without improving it. Changing for change's sake rarely resolves anything.\n\nThe case for change: if you've been living with something that consistently bothers you — a tonal quality, a texture, a dynamic limitation — that's worth acting on. But if the system sounds good and nothing is obviously wrong, patience is the more defensible position.`;
      }

      return {
        subject: `restraint case — ${activeSystem.name}`,
        philosophy,
        tendencies: tendenciesText,
        followUp: "Is there something specific in the current sound that's been bothering you — something that comes up consistently, not just on bad recordings? That's the question that decides it.",
      };
    }
    const locationNote = activeSystem.location
      ? ` (${activeSystem.location})`
      : '';

    let philosophy: string;
    if (isAssessmentFocused) {
      philosophy = `I have your ${activeSystem.name}${locationNote} system on file: ${componentList}.${tendenciesNote} I can evaluate how these components interact — whether they compound the same tendency or balance each other — and identify where the chain\'s character is being shaped.`;
    } else if (isUpgradeFocused) {
      philosophy = `Working from your ${activeSystem.name}${locationNote} system: ${componentList}.${tendenciesNote} I can map your upgrade priorities against the current architectural balance — identifying where the most effective intervention lies rather than just the most expensive component change.`;
    } else {
      philosophy = `I have your ${activeSystem.name}${locationNote} system: ${componentList}.${tendenciesNote} I can evaluate alignment between these components and your listening priorities.`;
    }

    const tendencies = priorityParts.length > 0
      ? `You've mentioned wanting ${priorityParts.join(' and ')}. With your system already on file, I can map those priorities directly to component interactions and suggest where a change would be most effective.`
      : 'Since I already know your components, the most useful thing you can share is what you enjoy about the current sound and what you find unsatisfying — or what direction of change you\'re curious about.';

    const followUp = priorityParts.length > 0
      ? 'What do you enjoy most about the current sound? And is there anything that feels consistently unsatisfying — even on well-recorded material?'
      : 'A few things that would help focus the assessment:\n\n' +
        '— What do you enjoy most about the current sound?\n' +
        '— What feels consistently unsatisfying?\n' +
        '— What kind of music do you listen to most?\n\n' +
        'This helps distinguish between taste alignment and system imbalance.';

    return {
      subject: `system guidance — ${activeSystem.name}`,
      philosophy,
      tendencies,
      followUp,
    };
  }

  // ── No active system: restraint query without system context ──
  // The user asks "should I change anything?" but we don't have their system.
  // Rather than ignoring the restraint framing, validate it explicitly and
  // use accumulated taste signals (desires) as reasoning material.
  if (isRestraintFocused) {
    const hasTasteSignals = priorityParts.length > 0;
    const philosophy = hasTasteSignals
      ? `You've described what you value — ${priorityParts.join(' and ')} — and that's useful even without knowing your exact components. The question "should I change anything?" is one of the best questions in audio, because the answer is often no.`
      : `"Should I change anything?" is one of the best questions in audio, because the answer is often no. Change that isn't driven by a specific, repeatable dissatisfaction tends to move you sideways rather than forward.`;

    const tendencies = `The case for doing nothing is strongest when: you're enjoying the music most of the time, your dissatisfaction is vague rather than specific, you're not sure what "better" means in concrete terms, or your interest in upgrading feels more like curiosity than frustration.\n\nThe case for change is strongest when: a specific quality bothers you consistently across material you know well, the problem is repeatable and nameable, and you can describe what "better" would sound like — even roughly.`;

    const followUp = hasTasteSignals
      ? `You've already told me some of what you value. If you can share your current system — even roughly (source, amplification, speakers/headphones) — I can tell you whether those priorities are likely being served or whether there's a real gap.`
      : `If you can share your current system — even roughly — I can help you figure out whether there's a real case for change or whether the instinct to hold is the right one.`;

    return {
      subject: 'restraint case — general',
      philosophy,
      tendencies,
      followUp,
    };
  }

  // ── No active system: original consultation intake flow ──
  let philosophy: string;
  if (isAssessmentFocused) {
    philosophy = 'Audio XX evaluates systems by examining how components interact — whether they compound the same tendency or balance each other. A system that leans warm throughout the chain behaves very differently from one where a precise source feeds a rich amplifier. The interaction matters more than any single component\'s quality.';
  } else if (isUpgradeFocused) {
    philosophy = 'Before recommending an upgrade path, Audio XX needs to understand your current system\'s architectural balance — where energy accumulates, where it\'s absorbed, and what the chain emphasises as a whole. The most effective upgrade often isn\'t the most expensive component — it\'s the one that resolves the most meaningful imbalance.';
  } else {
    philosophy = 'Audio XX approaches system guidance by examining the interaction between components, your listening priorities, and your room context. The goal is to identify whether your current system is well-aligned with what you value — and if not, where the most effective intervention lies.';
  }

  const tendencies = priorityParts.length > 0
    ? `You've mentioned wanting ${priorityParts.join(' and ')} — that gives a starting direction. To map those priorities to specific system interactions, I need to know what you're working with.`
    : 'To provide a meaningful assessment, I need to understand the components in your chain and how they interact. Generic advice without system context tends to be less useful than targeted guidance.';

  const followUp = 'What components make up your current system? The key pieces are:\n\n' +
    '— Source (DAC, streamer, turntable)\n' +
    '— Amplification (integrated, preamp + power amp, headphone amp)\n' +
    '— Output (speakers or headphones — model names help)\n\n' +
    'Also helpful: your room situation, the music you listen to most, and what you enjoy or find unsatisfying about the current sound.';

  return {
    subject: 'system guidance',
    philosophy,
    tendencies,
    followUp,
  };
}

// ── Cable advisory builder ───────────────────────────
//
// Structured cable advisory path. Cables don't have a scored catalog,
// but they DO have meaningful system-tuning implications. This builder
// produces a structured response covering:
//   1. Cable strategy — how cables affect the chain
//   2. System context — what the user's system needs
//   3. Tuning direction — what kind of cable character to look for
//   4. Trade-offs
//   5. Practical guidance
//   6. Follow-up

/** Cable types mentioned in the query. */
type CableType = 'speaker' | 'interconnect' | 'power' | 'usb' | 'digital' | 'xlr' | 'general';

function detectCableTypes(text: string): CableType[] {
  const types: CableType[] = [];
  if (/\bspeaker\s+cables?\b/i.test(text)) types.push('speaker');
  if (/\brca\b|\binterconnects?\b|\banalog\s+cables?\b/i.test(text)) types.push('interconnect');
  if (/\bpower\s+(?:cord|cable)\b/i.test(text)) types.push('power');
  if (/\busb\s+cables?\b/i.test(text)) types.push('usb');
  if (/\bdigital\s+cables?\b/i.test(text)) types.push('digital');
  if (/\bxlr\b/i.test(text)) types.push('xlr');
  if (types.length === 0) types.push('general');
  return types;
}

function cableTypeLabel(types: CableType[]): string {
  const labels: Record<CableType, string> = {
    speaker: 'speaker cables',
    interconnect: 'interconnects',
    power: 'power cables',
    usb: 'USB cables',
    digital: 'digital cables',
    xlr: 'XLR cables',
    general: 'cables',
  };
  return types.map((t) => labels[t]).join(' and ');
}

/**
 * Build a structured cable advisory response.
 *
 * Unlike product categories with scored catalogs, cable advice is
 * architectural — it depends on the system's existing tendencies
 * and the listener's desired tuning direction.
 */
export function buildCableAdvisory(
  currentMessage: string,
  subjectMatches: SubjectMatch[],
  desires: { quality: string; direction: 'more' | 'less'; raw: string }[],
  activeSystem?: ActiveSystemContext | null,
): ConsultationResponse {
  const cableTypes = detectCableTypes(currentMessage);
  const typeLabel = cableTypeLabel(cableTypes);

  // Extract system context from named subjects
  const systemComponents: string[] = [];
  const systemLinks: { label: string; url: string; kind?: 'reference' | 'dealer' | 'review'; region?: string }[] = [];

  // ── If active system exists, seed components from it ──
  if (activeSystem && activeSystem.components.length > 0) {
    for (const c of activeSystem.components) {
      systemComponents.push(normalizeDisplayName(c.brand, c.name));
    }
  }

  for (const match of subjectMatches) {
    // Look up product or brand
    const product = ALL_PRODUCTS.find(
      (p) => p.name.toLowerCase() === match.name.toLowerCase()
        || p.brand.toLowerCase() === match.name.toLowerCase(),
    );
    if (product) {
      const label = `${product.brand} ${product.name}`;
      if (!systemComponents.some((c) => c.toLowerCase() === label.toLowerCase())) {
        systemComponents.push(label);
      }
    }
    const brandProfile = findBrandProfile(match.name);
    if (brandProfile) {
      const displayName = brandProfile.names[0].charAt(0).toUpperCase() + brandProfile.names[0].slice(1);
      if (!systemComponents.some((c) => c.toLowerCase().includes(match.name.toLowerCase()))) {
        systemComponents.push(displayName);
      }
      if (brandProfile.links) {
        for (const l of brandProfile.links) {
          if (!systemLinks.some((sl) => sl.url === l.url)) {
            systemLinks.push({ label: l.label, url: l.url, kind: l.kind, region: l.region });
          }
        }
      }
    }
  }

  // Infer system lean — prefer active system tendencies if available
  let systemLean: 'warm' | 'precise' | 'balanced' | 'unknown' = 'unknown';

  if (activeSystem?.tendencies) {
    const tend = activeSystem.tendencies.toLowerCase();
    const hasWarm = /\b(warm|tube|lush|rich|organic|vinyl)\b/.test(tend);
    const hasBright = /\b(bright|analytical|precise|lean|solid-state|digital)\b/.test(tend);
    if (hasWarm && hasBright) systemLean = 'balanced';
    else if (hasWarm) systemLean = 'warm';
    else if (hasBright) systemLean = 'precise';
  }

  // Fall back to axis-model inference from brand/product profiles
  if (systemLean === 'unknown') {
    const cableComponents: SystemComponent[] = [];
    for (const match of subjectMatches) {
      const bp = findBrandProfile(match.name);
      const product = ALL_PRODUCTS.find(
        (p) => p.name.toLowerCase() === match.name.toLowerCase()
          || p.brand.toLowerCase() === match.name.toLowerCase(),
      );
      if (bp || product) {
        cableComponents.push({
          displayName: match.name,
          role: product?.category ?? 'component',
          character: product?.description ?? bp?.tendencies ?? '',
          brandProfile: bp ? { philosophy: bp.philosophy, tendencies: bp.tendencies, systemContext: bp.systemContext } : undefined,
          product: product ?? undefined,
        });
      }
    }
    if (cableComponents.length > 0) {
      const profiles = classifyComponentAxes(cableComponents);
      systemLean = deriveSystemLeanFromAxes(profiles);
    }
  }

  // Extract listener desires into cable tuning direction
  const desireParts: string[] = [];
  for (const d of desires) {
    desireParts.push(d.direction === 'more' ? d.quality : `less ${d.quality}`);
  }

  // Build the subject line
  const systemLabel = systemComponents.length > 0
    ? ` for ${systemComponents.join(' + ')}`
    : '';
  const subject = `${typeLabel}${systemLabel}`;

  // Philosophy — cable strategy in audio systems
  let philosophy: string;
  if (cableTypes.includes('speaker') && cableTypes.includes('interconnect')) {
    philosophy = 'Speaker cables and interconnects play different roles in the chain. Interconnects carry low-level signals between source and amplification — their character influences how detail and texture are transmitted. Speaker cables carry high-current signals to the drivers — their geometry and conductor material affect how dynamics, transient speed, and tonal weight are delivered. Both can shift the system\'s tonal balance, but speaker cables tend to have more audible impact on dynamics and bass character.';
  } else if (cableTypes.includes('speaker')) {
    philosophy = 'Speaker cables carry high-current signals from amplifier to drivers. Their conductor material, geometry, and dielectric influence how dynamics, transient speed, and tonal weight are delivered. They tend to have more audible impact on the system\'s macro character than interconnects.';
  } else if (cableTypes.includes('interconnect')) {
    philosophy = 'Interconnects carry low-level signals between components. Their character influences detail retrieval, textural nuance, and tonal shading. In a well-sorted system, interconnect changes tend to be subtle but can meaningfully shift the midrange texture and spatial presentation.';
  } else if (cableTypes.includes('power')) {
    philosophy = 'Power cables affect the noise floor and dynamic headroom of each component. Their impact is often described in terms of background blackness, dynamic ease, and a sense of effortlessness rather than tonal shifts. Results vary significantly by component and power supply design.';
  } else {
    philosophy = 'Cables are a system-tuning tool, not a standalone upgrade. Their role is to transmit signal with minimal coloration — or, in some cases, to introduce a deliberate tonal shift that compensates for tendencies elsewhere in the chain. The most effective cable choice depends on what the rest of the system is doing.';
  }

  // Tendencies — system-specific cable direction
  let tendencies: string;
  if (systemLean === 'precise' && desireParts.length > 0) {
    tendencies = `Your system leans toward precision and speed (${systemComponents.join(', ')}). You've expressed wanting ${desireParts.join(' and ')}. Cable choices would likely either reinforce the existing transparency or introduce a degree of warmth and body. For ${desireParts.join(' and ')}, copper conductors and relaxed geometries tend to be more effective than silver or aggressive shielding.`;
  } else if (systemLean === 'warm' && desireParts.length > 0) {
    tendencies = `Your system already leans warm (${systemComponents.join(', ')}). You've expressed wanting ${desireParts.join(' and ')}. Cable choices should complement rather than compound the existing warmth. For detail and sparkle, silver-plated or silver-core cables can introduce some upper-frequency energy, but be cautious about glare if the system is already bright in other ways.`;
  } else if (systemLean === 'balanced' && desireParts.length > 0) {
    tendencies = `Your system combines components with different tendencies (${systemComponents.join(', ')}), suggesting a deliberate balance. You've expressed wanting ${desireParts.join(' and ')}. Since the system is already balanced, cables can nudge the presentation in that direction without risk of overcorrection. The goal is refinement, not transformation.`;
  } else if (systemLean === 'balanced') {
    tendencies = `Your system combines components with different tendencies (${systemComponents.join(', ')}), suggesting a deliberate balance. Cable choices should preserve this balance. Neutral, well-constructed cables that don't impose a strong character of their own are usually the safest direction here.`;
  } else if (desireParts.length > 0) {
    tendencies = `You've expressed wanting ${desireParts.join(' and ')} from the cable upgrade. These qualities are often achievable through cable selection, but the degree of change depends on the system context. Cables tend to shift the balance — they don't transform the architecture.`;
  } else if (systemComponents.length > 0) {
    tendencies = `With ${systemComponents.join(' and ')} in the chain, the cable direction depends on what you want to shift. Cables can fine-tune tonal balance, dynamic weight, and spatial presentation — but only meaningfully when the tuning goal is clear.`;
  } else {
    tendencies = 'Cable recommendations depend heavily on system context. Without knowing the source, amplification, and speakers, cable advice tends to be generic. The most useful starting point is understanding what the system currently does well and where you want to shift the balance.';
  }

  // System context
  let systemContext: string | undefined;
  if (systemComponents.length > 0 && systemLean !== 'unknown') {
    const leanDesc = systemLean === 'precise'
      ? 'speed and transparency'
      : systemLean === 'warm'
        ? 'warmth and tonal richness'
        : 'a balanced combination of precision and warmth';
    systemContext = `${systemComponents.join(' + ')} — a system that leans toward ${leanDesc}. Cable choices should be evaluated against this existing balance.`;
  }

  // Follow-up
  let followUp: string;
  if (desireParts.length === 0 && systemComponents.length > 0) {
    followUp = `What are you hoping the cable change will do — are you looking to add warmth, extend detail, improve dynamics, or shift the tonal balance in a specific direction?`;
  } else if (systemComponents.length === 0) {
    followUp = 'What components make up your system? Source, amplification, and speakers all influence which cable direction makes sense.';
  } else {
    followUp = `What is your approximate budget for ${typeLabel}? Cable pricing varies enormously and the most effective choice depends on proportionality with the rest of the system.`;
  }

  return {
    subject,
    philosophy,
    tendencies,
    systemContext,
    followUp,
    links: systemLinks.length > 0 ? systemLinks : undefined,
  };
}

// ── System Diagnosis ─────────────────────────────────
//
// When a user provides system components AND a subjective complaint
// (e.g. "I have Wilson speakers and a Soulution amp, sound is a little dry"),
// produce a concise diagnostic response instead of a product profile.
//
// Format:
//   1. Acknowledge system + issue (1 sentence)
//   2. Interpret what the issue means in context (1–2 sentences)
//   3. 2–4 practical adjustment paths (concise bullets)
//   4. One focused follow-up question

/** Complaint vocabulary mapped to interpretation and remedy directions. */
const COMPLAINT_MAP: Record<string, {
  interpretation: string;
  remedyDirections: string[];
  followUpAngle: string;
}> = {
  dry: {
    interpretation: 'lacking harmonic richness, body, or tonal moisture — the music sounds correct but doesn\'t breathe or flow naturally',
    remedyDirections: [
      'Introduce tube character upstream — a tube preamp or tube-output DAC adds second-order harmonics perceived as warmth and body',
      'Adjust source voicing — a warmer-leaning DAC (R-2R, multibit, or tube-output) can shift the tonal center without losing resolution',
      'Review room treatment — overdamped rooms strip harmonic decay and make systems sound drier than they are',
      'Fine-tune speaker placement — increasing distance from rear wall often adds bass weight, which reduces the perception of dryness',
    ],
    followUpAngle: 'source',
  },
  thin: {
    interpretation: 'lacking bass weight and midrange density — the tonal balance feels tilted toward the upper frequencies',
    remedyDirections: [
      'Add tonal weight upstream — a warmer source or DAC (R-2R architecture, tube output) introduces midrange density',
      'Check speaker placement — pulling speakers further from the rear wall reduces bass reinforcement; moving them closer often helps',
      'Consider amplifier pairing — if the amp is lean/neutral, a warmer-voiced alternative can restore body',
      'Room treatment — thin sound often correlates with bare floors and hard walls reflecting upper frequencies',
    ],
    followUpAngle: 'source',
  },
  bright: {
    interpretation: 'treble energy feels emphasized — upper frequencies draw attention ahead of the midrange and bass',
    remedyDirections: [
      'Source voicing — an analytical DAC compounds brightness in a revealing system. A warmer, more relaxed source can recalibrate',
      'Cable tuning — copper cables generally sound warmer than silver; this is a subtle but real adjustment at this system level',
      'Room acoustics — hard reflective surfaces behind and beside the listening position amplify treble energy. Absorption at first reflection points helps',
      'Speaker toe-in — reducing toe-in with many speakers softens the direct treble energy reaching the listening position',
    ],
    followUpAngle: 'source',
  },
  harsh: {
    interpretation: 'upper midrange and treble have an aggressive, edgy quality — transients feel hard rather than natural',
    remedyDirections: [
      'Source character — the DAC is often the primary contributor to harshness in a transparent system. A more organic-sounding source helps',
      'Power conditioning — dirty power introduces high-frequency noise that manifests as harshness. A quality power conditioner or regenerator can help',
      'Tube buffering — a tube preamp or buffer between source and amplifier softens transient edges without losing information',
      'Room treatment — first reflection point absorption reduces the doubled attack transients that create perceived harshness',
    ],
    followUpAngle: 'source',
  },
  fatiguing: {
    interpretation: 'the system becomes uncomfortable over extended listening — often caused by treble energy, compression, or relentless detail',
    remedyDirections: [
      'Reduce upstream resolution pressure — a more musical source (tube DAC, R-2R) can ease the relentless detail that causes fatigue',
      'Check listening level — highly resolving systems reveal more at lower volumes. Listening slightly quieter often eliminates fatigue entirely',
      'Room acoustics — excessive reflections compound detail overload. Diffusion and selective absorption can help',
      'Consider a tube preamp — adds harmonic cushioning that makes extended sessions more comfortable',
    ],
    followUpAngle: 'listening_habits',
  },
  sterile: {
    interpretation: 'the sound is technically correct but emotionally uninvolving — precision without musical engagement',
    remedyDirections: [
      'Introduce harmonic texture — a tube preamp or tube-output DAC adds the subtle distortion that makes music feel alive',
      'Source voicing — moving from a purely measuring source to one with more musical character often transforms sterile systems',
      'Analog source — vinyl naturally adds harmonic richness and flow that can bring a sterile system to life',
      'Revisit speaker placement — toe-in and distance adjustments can shift the balance from analytical to engaging',
    ],
    followUpAngle: 'source',
  },
  clinical: {
    interpretation: 'the system prioritizes accuracy over musicality — technically impressive but emotionally distant',
    remedyDirections: [
      'Introduce tube character — a tube preamp or DAC is the most effective single change for shifting a clinical system toward musicality',
      'Source voicing — a more organic DAC architecture (R-2R, tube output) adds the harmonic density that clinical systems lack',
      'Consider cabling — warmer-voiced cables (Cardas, certain Transparent models) can subtly shift tonal character',
      'Room acoustics — adding diffusion (bookshelves, irregular surfaces) creates a more natural-sounding space',
    ],
    followUpAngle: 'source',
  },
  analytical: {
    interpretation: 'the system presents everything with forensic detail but at the cost of musical flow and engagement',
    remedyDirections: [
      'Upstream voicing — a tube DAC or preamp introduces the harmonic texture that softens analytical precision into musical involvement',
      'Source selection — moving from a delta-sigma DAC to an R-2R or multibit architecture often shifts the balance from analysis to engagement',
      'Room treatment — adding diffusion and reducing early reflections helps the brain process detail more naturally',
      'Speaker positioning — slight adjustments to toe-in and rake angle can shift the tonal center',
    ],
    followUpAngle: 'source',
  },
  cold: {
    interpretation: 'the system sounds tonally lean and emotionally distant — missing the warmth and body that make music inviting',
    remedyDirections: [
      'Add warmth upstream — a tube preamp or warm-voiced DAC is the most direct path to adding tonal warmth',
      'Review the source chain — analytical digital sources compound coldness in transparent systems',
      'Consider speaker placement — closer wall proximity increases bass reinforcement, adding perceived warmth',
      'Room acoustics — overdamped rooms suppress warmth. Reducing absorption (especially bass traps) can help',
    ],
    followUpAngle: 'source',
  },
  muddy: {
    interpretation: 'bass frequencies bleed into the midrange — individual instruments and voices lose definition',
    remedyDirections: [
      'Speaker placement — too close to walls causes bass buildup that muddies the midrange. Experiment with pulling speakers out',
      'Room treatment — bass traps in room corners reduce the low-frequency buildup that causes muddiness',
      'Amp control — if the amplifier lacks damping factor for the speakers, bass becomes loose. A higher-control amp may help',
      'Source clarity — a more detailed, precise DAC can improve separation and reduce the perception of muddiness',
    ],
    followUpAngle: 'room',
  },
  dull: {
    interpretation: 'the system lacks energy, sparkle, and treble extension — music sounds lifeless or veiled',
    remedyDirections: [
      'Source resolution — a more detailed, transparent DAC can restore the treble energy and air that a warm system suppresses',
      'Cable voicing — silver or silver-plated cables tend to open up treble extension and add sparkle',
      'Speaker positioning — more toe-in directs higher frequencies toward the listening position',
      'Room acoustics — heavy absorption can over-damp treble. Reducing curtains or carpeting near the speakers may help',
    ],
    followUpAngle: 'source',
  },
  forward: {
    interpretation: 'the presentation pushes toward the listener rather than creating depth — sound feels aggressive or in-your-face',
    remedyDirections: [
      'Speaker placement — increasing distance from the listening position and reducing toe-in can create more depth',
      'Source voicing — a more laid-back, relaxed DAC can counter an aggressive presentation',
      'Room treatment — absorption behind the speakers and diffusion at the listening position creates perceived depth',
      'Amplifier character — some amps push the midrange forward. A more relaxed design may create better staging',
    ],
    followUpAngle: 'room',
  },
};

/** Extract the primary complaint word from user text. */
function extractComplaint(text: string): string | null {
  const lower = text.toLowerCase();
  // Check for explicit complaint words, ordered by specificity
  const complaintWords = [
    'fatiguing', 'clinical', 'analytical', 'sterile',
    'forward', 'strident', 'brittle',
    'bright', 'harsh', 'thin', 'dry', 'cold', 'dull', 'muddy',
    'lean', 'hard', 'aggressive',
  ];
  for (const word of complaintWords) {
    if (lower.includes(word)) return word;
  }
  // "lacks X" / "lacking X" → map quality deficit to a complaint adjective
  const lacksMatch = lower.match(/\black(?:s|ing)\s+(?:in\s+)?(\w+)/);
  if (lacksMatch) {
    const quality = lacksMatch[1];
    const qualityToComplaint: Record<string, string> = {
      bass: 'thin', treble: 'dull', detail: 'dull', warmth: 'cold',
      body: 'thin', dynamics: 'dull', punch: 'dull', clarity: 'muddy',
      air: 'dull', space: 'dull', depth: 'thin', energy: 'dull',
      richness: 'dry', weight: 'thin', presence: 'thin',
    };
    if (qualityToComplaint[quality]) return qualityToComplaint[quality];
  }
  // "something feels off" → map to generic thin (user is vague, so start neutral)
  if (/\bsomething\s+(?:is\s+|feels?\s+)?(?:off|wrong|missing)\b/.test(lower)) {
    return 'thin';
  }
  return null;
}

/**
 * Build a concise system diagnosis response.
 *
 * Fires when the user provides system components AND a subjective complaint.
 * Returns null if it can't produce a meaningful diagnosis (no complaint found
 * or no system context to reason about).
 */
export function buildSystemDiagnosis(
  currentMessage: string,
  subjectMatches: SubjectMatch[],
): ConsultationResponse | null {
  // 1. Extract complaint
  const complaint = extractComplaint(currentMessage);
  if (!complaint) return null;

  // 2. Map complaint to remedies (use exact match first, then fall back to nearest)
  const complaintKey = COMPLAINT_MAP[complaint]
    ? complaint
    : complaint === 'lean' ? 'thin'
    : complaint === 'hard' || complaint === 'brittle' || complaint === 'strident' ? 'harsh'
    : complaint === 'aggressive' ? 'forward'
    : null;

  if (!complaintKey || !COMPLAINT_MAP[complaintKey]) return null;
  const mapping = COMPLAINT_MAP[complaintKey];

  // 3. Look up system components
  const componentNames: string[] = [];
  const componentCharacters: string[] = [];

  for (const match of subjectMatches) {
    if (match.parenthetical) continue;
    const matchLower = match.name.toLowerCase();

    // Try product-level match first, then brand-level (allow partial brand match)
    const product = ALL_PRODUCTS.find(
      (p) => p.name.toLowerCase() === matchLower
        || p.brand.toLowerCase() === matchLower
        || p.brand.toLowerCase().startsWith(matchLower)
        || matchLower.startsWith(p.brand.toLowerCase()),
    );

    if (product) {
      const displayName = match.kind === 'brand' ? product.brand : product.name;
      if (!componentNames.includes(displayName)) {
        componentNames.push(displayName);
        // Extract a brief character note
        if (hasTendencies(product.tendencies)) {
          const chars = product.tendencies.character.slice(0, 2);
          const traits = chars.map((t) => t.tendency).join(', ');
          componentCharacters.push(`${displayName}: ${traits}`);
        } else {
          const firstSentence = product.description.split(/\.\s/)[0];
          componentCharacters.push(`${displayName}: ${firstSentence}`);
        }
      }
    } else {
      // Capitalize first letter of each word for display
      const displayName = match.name.replace(/\b\w/g, (c) => c.toUpperCase());
      componentNames.push(displayName);
    }
  }

  if (componentNames.length === 0) return null;

  // 4. Build the concise diagnosis
  const systemLabel = componentNames.join(' + ');

  // Opening: acknowledge system + issue
  const opening = `${systemLabel} is a high-caliber combination. What you're describing as "${complaint}" is ${mapping.interpretation}.`;

  // Context: interpret in terms of the system
  let systemNote = '';
  if (componentCharacters.length > 0) {
    // Check if the system's character compounds the complaint
    const charText = componentCharacters.join('; ').toLowerCase();
    const compounders = ['neutral', 'precise', 'controlled', 'detailed', 'resolving', 'transparent', 'clean'];
    const isCompounding = complaintKey === 'dry' || complaintKey === 'sterile' || complaintKey === 'clinical' || complaintKey === 'cold' || complaintKey === 'analytical';
    if (isCompounding && compounders.some((w) => charText.includes(w))) {
      systemNote = `With highly transparent, controlled components on both ends, the system may be too \"correct\" — precision without harmonic richness. This is a common characteristic of reference-grade solid-state chains, not a flaw.`;
    } else if ((complaintKey === 'bright' || complaintKey === 'harsh') && charText.includes('detail')) {
      systemNote = `A system this resolving can expose recording-quality issues that less transparent systems smooth over. The harshness may be partly recording-dependent.`;
    }
  }

  // Paths: 2-4 adjustment directions
  const paths = mapping.remedyDirections.slice(0, 4);
  const pathsText = paths.map((p, i) => `**${i + 1}.** ${p}`).join('\n\n');

  // Follow-up question
  let followUp: string;
  if (mapping.followUpAngle === 'source') {
    followUp = 'What source are you using (DAC, streamer, turntable)? That\'s usually the most effective place to introduce tonal warmth in a system like this.';
  } else if (mapping.followUpAngle === 'room') {
    followUp = 'Can you describe your room — size, surfaces, treatment? Room interaction is often the biggest factor here.';
  } else {
    followUp = 'What are your listening habits — typical volume, session length, music types? That helps me calibrate the direction.';
  }

  // Assemble
  const fullDiagnosis = systemNote
    ? `${opening}\n\n${systemNote}\n\n${pathsText}`
    : `${opening}\n\n${pathsText}`;

  return {
    subject: `${systemLabel} — ${complaint}`,
    comparisonSummary: fullDiagnosis,
    followUp,
  };
}

// ── Test exports ─────────────────────────────────────
// Internal functions exposed for deterministic pipeline testing.
// Not part of the public API — import only from test files.

export const _test = {
  extractFullChain,
  tryCanonicalOrder,
  buildSystemChain,
  classifyComponentAxes,
  detectStackedTraits,
  detectPrimaryConstraint,
  buildComponentAssessments,
  buildUpgradePaths,
  buildKeepRecommendations,
  reconcileAssessmentOutputs,
  extractMemoFindings,
  detectUserAppliedRole,
  rolesConflict,
  inferListenerPriorityTags,
  canonicalRole,
  roleSort,
  KNOWN_PRODUCT_ROLES,
  ROLE_EQUIVALENCES,
};
