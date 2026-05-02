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
import {
  type ComparisonPayload,
  type ComparisonSide,
  type ComparisonDecision,
  type TradeoffAxis,
  type DominantAxis,
  scoreKeywords,
  detectDominantAxis,
  computeTradeoffAxis,
  TRADEOFF_LABELS,
  validateComparisonPayload,
  validateComparisonOutput,
  renderComparisonPayload,
} from './comparison-payload';
import { getApprovedBrand } from './knowledge';
import type { BrandKnowledge } from './knowledge/schema';
import type { ActiveSystemContext } from './system-types';
import { classifySystemArchetype, consumerSystemIntro, buildConsumerWirelessResponse } from './system-class';
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
  ActiveDACInference,
  PowerMatchAssessment,
} from './memo-findings';
import { renderDeterministicMemo } from './memo-deterministic-renderer';
import { isWhitelistedSource } from './evidence/source-whitelist';
// StructuredMemoInputs is transitional — the canonical rendering path is
// renderDeterministicMemo(findings, prose) without the third argument.
// See memo-deterministic-renderer.ts header for the removal plan.
import type { LegacyProseInputs, StructuredMemoInputs } from './memo-deterministic-renderer';
import { computeSystemConfidence } from './llm-system-inference';
import { runInference } from './inference-layer';
import { assessTradeoffs } from './tradeoff-assessment';
import { assessPreferenceProtection, classifyPriorities } from './preference-protection';
import { assessCounterfactual } from './counterfactual-assessment';
import { frameStrategy, deduplicateStrategies } from './strategy-framing';
import { topReviewsForCard, type ReviewerDomain } from './curation';
import { getLegacyMapping } from './products/legacy-models';
import { getProductImage } from './product-images';
import { findCatalogProduct } from './listener-profile';
import { toSlug as routeToSlug } from './route-slug';

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
  /**
   * Optional thumbnails for the two sides of a comparison. When the
   * compared subjects resolve to brand+name pairs that have a known
   * placeholder image (via `getProductImage`), populate this array so
   * the UI can render the same visual treatment used in shopping cards
   * (catalog `imageUrl` first, deterministic SVG placeholder fallback).
   * Length is always 2 when present; first entry corresponds to the
   * "A" side, second to the "B" side.
   */
  comparisonImages?: Array<{ brand: string; name: string; imageUrl?: string }>;
  /** 1. Design philosophy — what it prioritizes. */
  philosophy?: string;
  /** 2. Typical tendencies — how it tends to sound. */
  tendencies?: string;
  /** 3. System context — where it works well. */
  systemContext?: string;
  /**
   * Optional provenance note — rendered below the main body with subdued
   * styling at the component layer. Used by the archetype layer to indicate
   * that guidance is based on general product knowledge rather than a
   * verified catalog entry. No markdown markers — styling is applied in
   * presentation only.
   */
  provenanceNote?: string;
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

  // ── Manufacturer card summaries (Pass 12) ──
  // Three short, brand-general summary lines surfaced in the product card's
  // manufacturer block. Distinct in scope from the system-specific
  // "What you gain / give up" bullets, which describe behavior in the
  // user's chain. These describe the brand's constant character.
  //
  // Source rule: derive from existing curated `philosophy` / `tendencies`
  // prose above. No new claims about brands. Each field one short line.
  // When all three are populated, the card renders the structured block;
  // when any is missing, the card falls back to the legacy single-sentence
  // composition over `philosophy`.

  /** What the brand designs FOR (engineering intent / bias). */
  designPhilosophy?: string;
  /** Consistent sonic / behavioral signature across the range. */
  sonicTendency?: string;
  /** Typical trade-off accepted to deliver the above. */
  typicalTradeoff?: string;

  // ── Brand imagery (Pass 14 — schema only) ──────────
  // Schema-enabling fields for brand-level imagery on /brand/[slug] and
  // brand-only comparison thumbnails. Both optional and additive — no
  // existing entry breaks. NO entries are populated yet; populate per
  // brand only after asset verification (manufacturer press kit, licensed
  // source, or Wikimedia Commons). See Image_Coverage_Audit.md §4a / §5
  // for source / verification / hosting rules.
  //
  // Resolution precedence at render time (when wired): representative
  // product hero is preferred over wordmark, since the same brand-only
  // path also feeds comparison thumbnails where a logo reads as weak
  // signal compared to a real product photo. Wiring lives in two
  // places and is intentionally NOT changed here:
  //   - consultation.ts brand-only resolver (audit §4b)
  //   - app/brand/[slug]/page.tsx header (new, on first asset)
  // Doing the wiring without verified assets creates an empty-data
  // shape and forces speculative URL discipline on future contributors.

  /** Representative product hero image. Preferred over `logoUrl`. */
  representativeImageUrl?: string;
  /** Brand wordmark / logo. Used only when no product image is available. */
  logoUrl?: string;

  // ── Authority page fields (Pass 16) ──────────
  // Richer content for /brand/[slug] knowledge pages. All optional
  // and additive — no existing entry breaks.

  /** Short tagline under the brand name (≤ 12 words). */
  tagline?: string;
  /** Extended philosophy — second paragraph for depth. */
  philosophyExtended?: string;
  /** Leadership / origin paragraph — founder story, design lineage. */
  leadershipOrigin?: string;
  /** Short reviewer quotes (2–4). Attribution required. */
  reviewerQuotes?: Array<{ quote: string; source: string }>;
  /** Bullet-point strengths (3–5). */
  strengths?: string[];
  /** Bullet-point trade-offs (2–4). */
  tradeoffs?: string[];
  /** Second hero or mid-page image URL. */
  secondaryImageUrl?: string;

  // ── Curated media (Pass 17) ──────────────
  /** Images and videos for the brand authority page. */
  media?: {
    /** Up to 3 curated images (hero + post-philosophy). */
    images?: Array<{
      url: string;
      caption?: string;
      /** Attribution credit for the image (e.g. photographer, brand, publication). */
      credit?: string;
      /** URL to the source page where the image was obtained. */
      sourceUrl?: string;
    }>;
    /** Curated video links (YouTube, review channels). Not embedded — link-out only. */
    videos?: Array<{
      title: string;
      source: string;
      url: string;
      thumbnailUrl?: string;
      summary?: string;
    }>;
  };
}

const BRAND_PROFILES: BrandProfile[] = [
  {
    names: ['devore', 'devore fidelity'],
    founder: 'John DeVore',
    country: 'USA (Brooklyn, New York)',
    brandScale: 'boutique',
    region: 'north-america',
    categories: ['speaker'],
    tagline: 'Speakers voiced by ear for musical engagement.',
    philosophy: 'DeVore Fidelity designs speakers around musical engagement and natural tonal character. The philosophy prioritises ease and flow over analytical precision. Speakers are voiced by ear rather than measurement target.',
    philosophyExtended: 'John DeVore builds speakers in Brooklyn, testing them with real music in real rooms rather than optimizing for anechoic measurement. The result is a speaker that sounds alive and rhythmically engaging, even at low volumes. This is a deliberate trade — tonal honesty over flat response.',
    tendencies: 'Listeners describe DeVore speakers as warm, rhythmically alive, and harmonically rich. They tend to emphasise tonal body and midrange presence at the cost of some measured linearity.',
    systemContext: 'DeVore speakers span a range of sensitivities and amplifier requirements. The brand-level tendency is warmth and engagement, but the specific design family matters for amplifier pairing.',
    designPhilosophy: 'Voiced by ear for ease and flow, not to a measurement target.',
    sonicTendency: 'Warm, harmonically dense, rhythmically alive.',
    typicalTradeoff: 'Tonal body over measured linearity and surgical detail.',
    leadershipOrigin: 'John DeVore founded DeVore Fidelity in 2000 in Brooklyn, New York. Before starting the company, he worked in professional audio and developed his ear through years of live music listening. The brand remains a one-person design operation with small-batch manufacturing.',
    reviewerQuotes: [
      { quote: 'The O/96 may be the most musically engaging speaker I have heard at any price.', source: 'Art Dudley (Stereophile)' },
      { quote: 'DeVore speakers make you forget about equipment and listen to music.', source: 'Srajan Ebaen (6moons)' },
    ],
    strengths: [
      'Exceptional rhythmic engagement and musical flow',
      'Rich, natural midrange — voices and acoustic instruments shine',
      'High-sensitivity models (O series) pair beautifully with low-power tubes',
      'Room-friendly — less placement-sensitive than many competitors',
    ],
    tradeoffs: [
      'Less measured linearity and detail retrieval than precision competitors',
      'Premium pricing for boutique, small-batch manufacturing',
      'Limited model range — fewer options across price points',
    ],
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
    media: {
      images: [
        {
          url: 'https://devorefidelity.com/wp-content/uploads/2021/11/devore-fidelity-home.jpg',
          caption: 'DeVore Fidelity — handcrafted speakers from Brooklyn, New York.',
          credit: 'DeVore Fidelity',
          sourceUrl: 'https://devorefidelity.com/',
        },
        {
          url: 'https://devorefidelity.com/wp-content/uploads/2021/05/O96-new-crop-766x1024.jpg',
          caption: 'DeVore O/96 — the flagship Orangutan, voiced for low-power tubes.',
          credit: 'DeVore Fidelity',
          sourceUrl: 'https://devorefidelity.com/',
        },
      ],
      videos: [
        {
          title: 'John DeVore on Speaker Design',
          source: 'Darko.Audio',
          url: 'https://www.youtube.com/watch?v=GjKjL2QWyDc',
          thumbnailUrl: 'https://img.youtube.com/vi/GjKjL2QWyDc/hqdefault.jpg',
          summary: 'John DeVore discusses his design philosophy — voicing by ear, musical engagement over measurement.',
        },
        {
          title: 'DeVore Fidelity O/96, O/93, O/baby, micr/O — Sound Demo',
          source: "Jay's Audio Lab",
          url: 'https://www.youtube.com/watch?v=kOtOIyWhvU4',
          thumbnailUrl: 'https://img.youtube.com/vi/kOtOIyWhvU4/hqdefault.jpg',
          summary: 'Listening impressions across the DeVore Orangutan range — from the micr/O to the O/96.',
        },
      ],
    },
  },
  // ── Boenicke Audio ─────────────────────────────────────
  {
    names: ['boenicke', 'boenicke audio'],
    founder: 'Sven Boenicke',
    country: 'Switzerland (Basel)',
    brandScale: 'boutique',
    region: 'europe',
    categories: ['speaker'],
    tagline: 'Swiss precision speakers that disappear and leave the music.',
    philosophy: 'Boenicke Audio designs speakers around spatial truth and tonal refinement in unusually compact enclosures. Sven Boenicke voices every unit personally, drawing on decades of live concert recording to calibrate what sounds real.',
    philosophyExtended: 'Sven Boenicke founded the company in 1998 in Basel, Switzerland, with a simple premise: build the most honest speakers possible using unconventional engineering. Every cabinet is CNC-machined from solid wood — no MDF, no veneer — and final voicing is done by ear against the memory of live acoustic instruments. The result is a speaker that prioritises spatial precision and textural detail within a footprint most competitors would consider impossible.',
    tendencies: 'Listeners describe Boenicke speakers as holographic, spatially precise, and texturally vivid. They disappear into the room and leave an unusually coherent soundstage for their size, trading dynamic scale for imaging and refinement.',
    systemContext: 'Boenicke speakers need quality amplification to reveal their strengths. They reward clean, well-controlled power and are sensitive to upstream source quality. Placement matters — compact cabinets need boundary reinforcement or a subwoofer in larger rooms.',
    designPhilosophy: 'Compact solid-wood cabinets voiced by ear against live acoustic reference.',
    sonicTendency: 'Holographic imaging, textural precision, spatial disappearing act.',
    typicalTradeoff: 'Dynamic scale and bass weight traded for spatial truth and refinement.',
    leadershipOrigin: 'Sven Boenicke founded Boenicke Audio in 1998 in Basel, Switzerland. Before loudspeakers, he spent years recording live concerts — an experience that shaped his reference for natural timbre and spatial accuracy. He designs, voices, and signs off on every unit personally. All final assembly, quality control, and tuning happen in Basel.',
    reviewerQuotes: [
      { quote: 'The W8 supplied the most precise yet expansive imaging and soundstage I have yet to experience in my listening room.', source: 'Srajan Ebaen (6moons)' },
      { quote: 'They performed that magic trick few speakers can pull off: they disappeared.', source: '6moons (W8 review)' },
    ],
    strengths: [
      'Exceptional spatial precision — holographic imaging far beyond cabinet size',
      'Textural detail and tonal refinement without analytical harshness',
      'Solid-wood cabinets with outstanding build quality and finish options',
      'Compact footprint suits small rooms, desktop, and nearfield listening',
      'Coherent wideband design — no crossover on primary driver',
    ],
    tradeoffs: [
      'Limited dynamic scale and bass extension from compact cabinets',
      'Placement-sensitive — needs careful positioning or boundary reinforcement',
      'Requires quality amplification to perform at its best',
      'Premium pricing for boutique Swiss manufacturing',
    ],
    pairingNotes: 'Best with clean, well-controlled amplification — solid-state integrateds (Hegel, Ayre) or refined tube amps with adequate power (50W+ for W5, 50–100W for W8). Source quality is directly audible. Room gain or a subwoofer helps in larger spaces.',
    links: [
      { label: 'Official website', url: 'https://www.boenicke-audio.ch/', region: 'global' },
      { label: 'Minnesota Audio (US dealer)', url: 'https://minnesota.audio/collections/boenicke-audio-artisanal-speakers-for-the-discerning-audiophile', kind: 'dealer', region: 'US' },
    ],
    designFamilies: [
      {
        name: 'W5',
        character: 'Compact standmount — holographic spatial precision and texture from a tiny enclosure. The entry point.',
        ampPairing: 'Needs 30W minimum. Clean solid-state or moderate-power tubes. Source-quality-sensitive.',
      },
      {
        name: 'W8',
        character: 'Slim floorstanding — W5 spatial magic scaled up with more bass extension and dynamic range. Swing-base decoupling.',
        ampPairing: '50–100W recommended. Benefits from amplifiers with good current delivery.',
      },
      {
        name: 'W11 / W13',
        character: 'Full-range floorstanders — the design philosophy at larger scale with greater bass authority and dynamic headroom.',
        ampPairing: 'Benefits from high-quality amplification with headroom. Room-dependent bass tuning.',
      },
    ],
    media: {
      images: [
        {
          url: 'https://boenicke-audio.ch/wp-content/uploads/2017/08/W5_raum.jpg',
          caption: 'Boenicke W5 in a listening room — disappearing act in miniature.',
          credit: 'Boenicke Audio',
          sourceUrl: 'https://boenicke-audio.ch/',
        },
        {
          url: 'https://boenicke-audio.ch/wp-content/uploads/2026/01/W5_halbvorne_klei.jpg',
          caption: 'Boenicke W5 — half-front view showing Swiss cabinet craft.',
          credit: 'Boenicke Audio',
          sourceUrl: 'https://boenicke-audio.ch/',
        },
        {
          url: 'https://boenicke-audio.ch/wp-content/uploads/2019/05/sven-1.jpg',
          caption: 'Sven Boenicke in his Basel workshop.',
          credit: 'Boenicke Audio',
          sourceUrl: 'https://boenicke-audio.ch/',
        },
      ],
      videos: [
        {
          title: 'Boenicke W5 HiFi Speakers — Review',
          source: 'Tarun Magazines',
          url: 'https://www.youtube.com/watch?v=zeJXIEVbn34',
          thumbnailUrl: 'https://img.youtube.com/vi/zeJXIEVbn34/hqdefault.jpg',
          summary: 'Review and listening impressions of the Boenicke W5 — compact speakers with outsized spatial performance.',
        },
        {
          title: 'Boenicke W5 Sound Demo & Review',
          source: 'Tarun Magazines',
          url: 'https://www.youtube.com/watch?v=F0Abq1OJTgk',
          thumbnailUrl: 'https://img.youtube.com/vi/F0Abq1OJTgk/hqdefault.jpg',
          summary: 'Sound demonstration and extended review of the Boenicke W5 speakers.',
        },
      ],
    },
  },
  // ── Shindo Laboratory ──────────────────────────────────
  {
    names: ['shindo', 'shindo laboratory'],
    founder: 'Ken Shindo',
    country: 'Japan (Tokyo)',
    brandScale: 'boutique',
    region: 'japan',
    categories: ['amplifier'],
    tagline: 'Hand-built tube amplifiers voiced for musical truth.',
    philosophy: 'Shindo Laboratory designs tube amplifiers around musical naturalness rather than measured specification. Each circuit is designed individually to exploit the sonic character of its chosen tubes — the design serves the parts, not the other way around.',
    philosophyExtended: 'Ken Shindo started his career as an electrical engineer at Matsushita before founding Shindo Laboratory in Tokyo in 1977. He was a noted collector of new-old-stock vacuum tubes and vintage components, and designed each amplifier as a unique circuit suited to a specific set of parts, a specific kind of system, and a specific musical mood. There are no stock circuits in any Shindo product. The goal was never to build a technically optimal machine — it was to let reproduced music sing with the organic quality of a live performance.',
    tendencies: 'Listeners consistently describe Shindo amplifiers as dense, flowing, and harmonically alive. They emphasise tonal weight, midrange texture, and a sense of physical musical presence at the cost of some transient precision and measured neutrality.',
    systemContext: 'Shindo amplifiers are designed for high-efficiency speakers that can work with lower power output. The combination of Shindo electronics with high-sensitivity speakers is one of the most celebrated pairings in the tube audio community.',
    designPhilosophy: 'Each circuit designed around its chosen tubes — the design serves the parts.',
    sonicTendency: 'Dense, harmonically alive, flowing — music sounds physically present.',
    typicalTradeoff: 'Tonal saturation and musical naturalness over transient precision and measured linearity.',
    leadershipOrigin: 'Ken Shindo (1939–2014) founded Shindo Laboratory in Tokyo in 1977 after working as an electrical engineer at Matsushita. He built every amplifier by hand using point-to-point wiring, hand-wound transformers, and carefully selected vintage and NOS components. Production was deliberately limited — roughly 50 units per year globally. After his passing in 2014, production continues under the guidance of his trained associates, maintaining his methods and sonic philosophy.',
    reviewerQuotes: [
      { quote: 'The Cortese did precisely what I expect a good single-ended amplifier to do: it put recorded instruments and voices in front of me with a near-psychedelic level of presence.', source: 'Art Dudley (Stereophile)' },
      { quote: 'Shindo has a certain quality that allows you to forget about the system — music sounds more like a live acoustic event.', source: 'Pitch Perfect Audio' },
    ],
    strengths: [
      'Legendary harmonic richness and tonal density — the reference for tube musicality',
      'Each circuit individually designed — no stock topologies',
      'Hand-wound transformers and point-to-point wiring throughout',
      'Exceptional midrange presence and vocal naturalness',
      'Deep synergy with high-efficiency speakers — a defining pairing in the community',
    ],
    tradeoffs: [
      'Very limited production and high pricing — long wait times typical',
      'Low power output requires high-sensitivity speakers (90 dB+)',
      'Limited bass authority and dynamic headroom compared to high-power designs',
      'Vintage NOS tube dependency — replacement tubes can be scarce and expensive',
    ],
    pairingNotes: 'A natural match with DeVore Orangutan, Altec-based horns, and other high-efficiency speakers (90 dB+). The Shindo + DeVore combination is one of the most discussed pairings in high-efficiency audio. Source components matter — Shindo preamps are designed as system anchors and pair best with their own amplifiers.',
    links: [
      { label: 'Official website', url: 'https://www.shindo-laboratory.co.jp/', region: 'global' },
      { label: 'Tone Imports (US importer)', url: 'https://www.toneimports.com/', kind: 'dealer', region: 'US' },
    ],
    designFamilies: [
      {
        name: 'Cortese',
        character: 'Single-ended F2a stereo amplifier (~10W). Entry point to the Shindo line. Psychedelic presence and scale.',
        ampPairing: 'Requires 90 dB+ speakers. Ideal with DeVore O/96, Altec horns.',
      },
      {
        name: 'Haut-Brion / Montille',
        character: 'Push-pull designs with more power (15–25W). Richer tonal palette with greater dynamic headroom.',
        ampPairing: 'Works with 88 dB+ speakers. Broader pairing flexibility than single-ended models.',
      },
      {
        name: 'Preamps (Aurièges, Monbrison, Masseto)',
        character: 'System anchors — each voiced with a distinct character. The preamp often defines the Shindo system sound more than the power amp.',
      },
    ],
    media: {
      images: [
        {
          url: 'https://6moons.com/audioreviews/shindo3/hero_cortese.jpg',
          caption: 'Shindo Cortese — single-ended stereo amplifier, point-to-point wired.',
          credit: 'Shindo Laboratory / 6moons',
          sourceUrl: 'https://6moons.com/audioreviews/shindo3/shindo.html',
        },
        {
          url: 'https://6moons.com/audioreviews/shindo3/hero_monbrison_front.jpg',
          caption: 'Shindo Monbrison preamplifier — the system anchor.',
          credit: 'Shindo Laboratory / 6moons',
          sourceUrl: 'https://6moons.com/audioreviews/shindo3/shindo.html',
        },
      ],
      videos: [
        {
          title: 'Inside Shindo Laboratory in Tokyo, Japan',
          source: 'Lavorgna (YouTube)',
          url: 'https://www.youtube.com/watch?v=puUewwqvags',
          thumbnailUrl: 'https://img.youtube.com/vi/puUewwqvags/hqdefault.jpg',
          summary: 'Rare footage from inside Ken Shindo\'s workshop in Tokyo — the only known video of its kind.',
        },
      ],
    },
  },
  {
    names: ['pass labs', 'pass', 'first watt'],
    founder: 'Nelson Pass',
    country: 'USA (Auburn, California)',
    brandScale: 'specialist',
    region: 'north-america',
    categories: ['amplifier'],
    tagline: 'Simplicity, Class A, and the art of amplification.',
    philosophy: 'Pass Labs designs emphasise simplicity and Class A operation where practical. First Watt is the low-power offshoot, exploring single-ended solid-state and unusual topologies.',
    philosophyExtended: 'Nelson Pass approaches amplifier design as a craft. His circuits use fewer gain stages than most competitors, and he prefers Class A biasing for its linearity even at the cost of efficiency. The result is an amplifier that runs hot and draws significant power but rewards with a tonal richness unusual in solid-state.',
    tendencies: 'Pass amplifiers tend toward warmth and midrange richness for solid-state. First Watt designs emphasise texture and intimacy at the cost of dynamic scale.',
    systemContext: 'Pass Labs works across a range of speakers. First Watt pairs best with high-efficiency speakers — similar territory to low-power tube amps.',
    designPhilosophy: 'Simplicity and Class A bias — fewer gain stages, maximum linearity.',
    sonicTendency: 'Warm, textured solid-state with tube-like midrange richness.',
    typicalTradeoff: 'Heat and power draw for Class A linearity; First Watt sacrifices power for intimacy.',
    leadershipOrigin: 'Nelson Pass founded Threshold in 1974, pioneering Class A solid-state amplification. He left to start Pass Labs in 1991, and later created First Watt as a personal workshop for experimental low-power designs. He openly shares schematics and encourages DIY, contributing to a uniquely transparent design culture.',
    reviewerQuotes: [
      { quote: 'The INT-25 is the finest small amplifier I have ever used — pure Class A magic.', source: 'Herb Reichert (Stereophile)' },
      { quote: 'Pass Labs delivers the warmth and texture of tubes with the reliability of solid-state.', source: 'Robert Harley (The Absolute Sound)' },
      { quote: 'First Watt amplifiers are for listeners who value intimacy over scale.', source: 'Srajan Ebaen (6moons)' },
    ],
    strengths: [
      'Class A operation delivers exceptional linearity and midrange richness',
      'Warm, textured solid-state — closer to tubes than most competitors',
      'First Watt offers unique single-ended solid-state designs',
      'Bulletproof build quality and long service life',
      'Open design culture — schematics shared publicly',
    ],
    tradeoffs: [
      'Class A runs hot and draws significant idle power',
      'First Watt designs are power-limited — need efficient speakers',
      'Premium pricing across the range',
    ],
    pairingNotes: 'Pass Labs main-line amplifiers work across a wide range of speakers. First Watt designs pair best with high-efficiency speakers (93 dB+), similar to low-power tube territory. Both lines complement neutral-to-bright DACs, adding warmth and body.',
    links: [
      { label: 'Pass Labs', url: 'https://www.passlabs.com/', region: 'global' },
      { label: 'First Watt', url: 'https://www.firstwatt.com/', region: 'global' },
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
    media: {
      images: [
        {
          url: 'https://www.passlabs.com/wp-content/uploads/2019/12/08-banner-class-A-xa25.webp',
          caption: 'Pass Labs XA25 — pure Class A simplicity in a compact chassis.',
          credit: 'Pass Labs',
          sourceUrl: 'https://www.passlabs.com/',
        },
        {
          url: 'https://www.passlabs.com/wp-content/uploads/2019/12/INT-25-001.webp',
          caption: 'Pass Labs INT-25 — 25 watts of Class A integrated amplification.',
          credit: 'Pass Labs',
          sourceUrl: 'https://www.passlabs.com/',
        },
      ],
      videos: [
        {
          title: 'Pass Labs XA25 — Class A Amplifier Review',
          source: 'New Record Day',
          url: 'https://www.youtube.com/watch?v=4yZRdVXT8U0',
          thumbnailUrl: 'https://img.youtube.com/vi/4yZRdVXT8U0/hqdefault.jpg',
          summary: 'A detailed review of the XA25 — Pass Labs\' most accessible Class A power amplifier.',
        },
        {
          title: 'Nelson Pass — The Icon of Amplifiers',
          source: 'HiFi Hour',
          url: 'https://www.youtube.com/watch?v=2slXGpx0J5w',
          thumbnailUrl: 'https://img.youtube.com/vi/2slXGpx0J5w/hqdefault.jpg',
          summary: 'Nelson Pass discusses his design philosophy, Class A amplification, and the story behind Pass Labs.',
        },
      ],
    },
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
    designPhilosophy: 'Engineered around timing and rhythmic drive over tonal density.',
    sonicTendency: 'Propulsive, rhythmically coherent, forward-leaning.',
    typicalTradeoff: 'Less warmth and spatial holography than tonally lush designs.',
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
      { label: 'On a Higher Note', url: 'https://www.onahighernote.com/', region: 'US' },
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
    systemContext: 'Works best in systems where the rest of the system provides sufficient detail and air. Pairs naturally with tube amplification and high-efficiency speakers.',
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
    designPhilosophy: 'Custom FPGA pulse-array conversion built around timing precision.',
    sonicTendency: 'Fast, articulate, transient-clear; lighter tonal weight than R2R.',
    typicalTradeoff: 'Pairs better with warm/dense downstream than already-lean chains.',
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
    systemContext: 'Denafrips DACs tend to add warmth and body to the system. In systems that are already warm or tonally dense, this can compound into congestion — bass and lower midrange may feel heavy. In precise or lean systems, a Denafrips source provides a welcome counterbalance, adding tonal substance without changing the downstream character.',
    designPhilosophy: 'Discrete R2R ladder conversion built for tonal density.',
    sonicTendency: 'Warm, dense, harmonically rich; softer-focused detail.',
    typicalTradeoff: 'Adds warmth — can compound congestion in already-dense systems.',
    pairingNotes: 'Pairs well with fast or transparent amplifiers where the R2R density is balanced by downstream speed. Widely used with solid-state amplification from brands like Benchmark, Topping, and Pass Labs. Can compound warmth with tube amplifiers — works best when the tube stage is on the transparent side.',
    links: [
      { label: 'Denafrips', url: 'https://www.denafrips.com/', region: 'global' },
    ],
  },
  {
    names: ['job'],
    country: 'Switzerland',
    brandScale: 'boutique',
    region: 'europe',
    categories: ['amplifier'],
    philosophy: 'JOB (derived from Goldmund) builds compact, high-current solid-state amplifiers from Goldmund\'s own circuit topology. Very low global feedback, short signal path, high speed. The design prioritises transient fidelity, timing, and musical flow — the intent is to sound like music happening in real time, not a controlled reproduction. Minimalist feature set; no DAC, no streaming, no tone controls.',
    tendencies: 'JOB amplifiers are described as fast, elastic, and alive. Slightly golden tonality — fluid, almost tube-adjacent harmonic character for solid-state. Strong microdynamic nuance and expressive phrasing. Soundstage is dimensional, airy, holographic. Very low listener fatigue. The emphasis is on rhythmic engagement and transient fidelity over raw grip or bass authority.',
    systemContext: 'JOB integrated amplifiers tend to work well with speakers that provide their own tonal body and warmth, such as high-efficiency or paper-cone designs. Thrives with expressive, organic speakers (DeVore, WLM, horns). In systems already biased toward leanness, the cumulative precision may thin out the presentation.',
    pairingNotes: 'JOB + DeVore is a well-regarded complementary pairing — the JOB\'s speed and precision balances DeVore\'s warmth and tonal density. Also works well with WLM and horn-loaded speakers that supply their own body.',
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
    designPhilosophy: 'Mechanical-fundamentals-first; rigidity and low resonance over features.',
    sonicTendency: 'Pace-driven, rhythmically alive, midrange-coherent.',
    typicalTradeoff: 'Bass weight and tonal richness secondary to rhythmic drive.',
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
    philosophy: 'Leben builds hand-wired tube amplifiers in the Japanese tradition — small-scale, obsessively crafted, voiced by ear. The CS600X and CS300X use push-pull KT77/KT88/EL34 topology with very low negative feedback. The design prioritises tonal density, harmonic richness, and rhythmic drive over measured neutrality. Every unit is hand-assembled in Japan.',
    tendencies: 'Listeners describe Leben amplifiers as warm, tonally dense, rhythmically alive, and harmonically rich. Strong midrange presence and natural instrument tone — voices and acoustic instruments have unusual body and presence. Excellent dynamics for their power rating — surprising bass grip from the KT77/KT88 push-pull topology. The presentation is lush and flowing, with a dimensional soundstage that rewards close listening.',
    systemContext: 'Leben amplifiers are a natural match for high-efficiency speakers — DeVore, Zu, Klipsch Heritage. The CS600X (~32W) drives speakers in the 90–96dB range with authority. A staple of the Japanese high-end community and widely regarded as one of the best tube integrateds under $10k.',
    pairingNotes: 'The Leben CS600X + DeVore O/96 is one of the most celebrated pairings in modern high-efficiency audio — it appears consistently in "best system" discussions. Tube rolling is a significant part of the Leben experience — KT77, KT88, and EL34 all produce meaningfully different voicing.',
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
    systemContext: 'Holo DACs add warmth and harmonic texture to the system. They pair naturally with transparent or fast amplification where the R2R density provides a welcome counterbalance. In already warm or dense systems, care is needed to avoid congestion. The May KTE is widely used in high-end headphone and speaker systems.',
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
    founder: 'Raymond Cooke',
    country: 'UK (Maidstone, Kent)',
    brandScale: 'established',
    region: 'europe',
    categories: ['speaker'],
    tagline: 'Point-source precision from coaxial engineering.',
    philosophy: 'KEF designs speakers around its proprietary Uni-Q coaxial driver, placing the tweeter at the acoustic centre of the midrange cone. The goal is point-source coherence and precise imaging. Engineering-led, measurement-informed.',
    philosophyExtended: 'The Uni-Q driver is the constant thread across the range, from the entry-level Q series through LS50 and R series to the Blade and Reference flagships. Each generation refines dispersion control and crossover integration, but the core principle remains: a single apparent source produces more coherent imaging than separated drivers.',
    tendencies: 'KEF speakers tend toward precision, neutral tonal balance, and wide controlled dispersion. Strong stereo imaging and detail retrieval. Can lean analytical with certain partnering equipment.',
    systemContext: 'KEF speakers reward clean, well-controlled amplification. They pair well with neutral to slightly warm electronics. Less forgiving of harsh or grainy upstream components.',
    designPhilosophy: 'Uni-Q coaxial driver for point-source coherence and precise imaging.',
    sonicTendency: 'Precise, neutral, wide-dispersion — strong imaging and detail.',
    typicalTradeoff: 'Analytical precision over tonal warmth and body.',
    leadershipOrigin: 'Founded in 1961 by Raymond Cooke, a former BBC engineer. The name stands for Kent Engineering and Foundry. KEF pioneered computer-aided speaker design in the 1970s and introduced the Uni-Q coaxial driver in 1988. The brand maintains its own driver manufacturing and anechoic testing facility in Maidstone.',
    reviewerQuotes: [
      { quote: 'The LS50 Meta is the most accomplished stand-mount speaker at its price.', source: 'What Hi-Fi? editors (What Hi-Fi?)' },
      { quote: 'KEF\'s Uni-Q driver delivers imaging precision that separates rarely achieve.', source: 'John Atkinson (Stereophile)' },
      { quote: 'The R3 Meta punches well above its weight in resolution and soundstage depth.', source: 'Doug Schneider (SoundStage!)' },
    ],
    strengths: [
      'Exceptional stereo imaging from coaxial point-source design',
      'Wide, controlled dispersion — less room-placement sensitivity',
      'Neutral tonal balance with strong detail retrieval',
      'Consistent engineering philosophy across the entire range',
      'Strong build quality and industrial design',
    ],
    tradeoffs: [
      'Can lean analytical or thin with bright upstream electronics',
      'Less tonal warmth and body than voiced competitors (DeVore, Harbeth)',
      'Sealed designs (LS50) need a subwoofer for full bass extension',
    ],
    pairingNotes: 'KEF speakers pair well with neutral-to-warm amplification. The LS50 Meta and R series work well with warm solid-state (Hegel, Naim, Pass) or tube-hybrid designs. Avoid pairing with bright or lean DACs — the precision can become fatiguing.',
    designFamilies: [
      {
        name: 'LS50 / LS60',
        character: 'Compact point-source monitors and active towers. Precise, detailed, neutral. The LS50 Meta is the benchmark stand-mount.',
        ampPairing: 'LS50 Meta needs 50W+ of clean power. LS60 is fully active — no external amp needed.',
      },
      {
        name: 'R series (R3 Meta, R7 Meta)',
        character: 'Larger cabinets with the same Uni-Q driver. More bass extension, fuller sound, still precise.',
        ampPairing: 'Benefits from 80W+ of controlled power. Works well with warm solid-state.',
      },
      {
        name: 'Reference / Blade',
        character: 'Flagship designs with advanced cabinet engineering and force-cancelling drivers. Full-range, room-filling.',
        ampPairing: 'Rewards high-current amplification. Room treatment is important at this level.',
      },
    ],
    links: [
      { label: 'Official website', url: 'https://www.kef.com/', region: 'global' },
    ],
    media: {
      images: [
        {
          url: 'https://m.media-amazon.com/images/I/51RmYCbQVQL._AC_SX679_.jpg',
          caption: 'KEF LS50 Meta — the benchmark Uni-Q stand-mount.',
          credit: 'KEF',
        },
        {
          url: 'https://media.kef.com/pages/INT-Uni-Q/Uni-Q%2012th%20gen%20exploded-v2.1-en.png',
          caption: 'KEF Uni-Q 12th generation coaxial driver.',
          credit: 'KEF',
          sourceUrl: 'https://www.kef.com/',
        },
      ],
      videos: [
        {
          title: 'KEF LS50 Meta vs. LS50 vs. LS50 Wireless II',
          source: 'Darko.Audio',
          url: 'https://www.youtube.com/watch?v=sRgxJaPDn10',
          thumbnailUrl: 'https://img.youtube.com/vi/sRgxJaPDn10/hqdefault.jpg',
          summary: 'John Darko compares the LS50 Meta to the original LS50 and the LS50 Wireless II.',
        },
        {
          title: 'KEF R3 Meta Review',
          source: 'Darko.Audio',
          url: 'https://www.youtube.com/watch?v=tjTVOOoQDS4',
          thumbnailUrl: 'https://img.youtube.com/vi/tjTVOOoQDS4/hqdefault.jpg',
          summary: 'John Darko reviews the R3 Meta stand-mount — a significant step up from the LS50 Meta.',
        },
      ],
    },
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
    names: ['wlm'],
    country: 'Austria',
    brandScale: 'boutique',
    region: 'europe',
    categories: ['speaker'],
    philosophy: 'WLM builds high-efficiency speakers around coaxial wideband drivers, prioritising dynamic expression, rhythmic engagement, and tonal color over analytical precision. The design philosophy favors musical involvement — energy and momentum over measurement-flat neutrality.',
    tendencies: 'WLM speakers are described as rhythmically insistent, dynamically alive, and tonally warm. High efficiency delivers visceral micro and macro contrasts. The midrange is weighted and natural-sounding. Spatial precision is secondary to musical flow.',
    systemContext: 'WLM speakers pair well with moderate-power amplification, including tube amps whose full dynamic range is unlocked by the high efficiency. In small or untreated rooms, bass energy from the passive radiator can overwhelm.',
    designPhilosophy: 'High-efficiency coaxial wideband; dynamic expression and rhythmic engagement over analytical precision.',
    sonicTendency: 'Rhythmically insistent, dynamically explosive, warm midrange with natural timbres.',
    typicalTradeoff: 'Less pinpoint imaging and spatial precision than sealed-box or narrow-baffle monitors.',
    links: [
      { label: 'Official website', url: 'https://www.wlm-loudspeakers.com/', region: 'global' },
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
    designPhilosophy: 'BBC-monitor lineage; engineered around natural midrange and voice.',
    sonicTendency: 'Vocally honest, slightly warm, forgiving top end.',
    typicalTradeoff: 'Less bass extension and dynamic slam than larger floorstanders.',
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
  {
    names: ['kinki studio', 'kinki'],
    country: 'China',
    brandScale: 'boutique',
    region: 'east-asia',
    categories: ['amplifier'],
    philosophy: 'Kinki Studio builds Class AB solid-state amplifiers with a deliberately warm, tonally engaged voicing. The design philosophy prioritises tonal density, midrange richness, and musical engagement over analytical neutrality or measured transparency. Dual-mono, fully balanced topologies with high current output.',
    tendencies: 'Kinki Studio amplifiers are described as warm, dense, and muscular. Tonal body and midrange richness are the signature strengths. Bass is weighty and authoritative. The EX-M1 leans toward warmth and engagement; the EX-M1+ and Dazzle are more neutral and transparent while retaining the brand\'s composure and current authority.',
    systemContext: 'Kinki Studio amplifiers work best with neutral or analytical speakers where the added warmth and density provide complementary balance. Pairing with already-warm or tonally dense speakers may compound into heaviness. Strong value at price — frequently compared favourably to amplifiers at 2–3× their cost.',
    pairingNotes: 'The EX-M1 pairs well with neutral or revealing speakers (Dynaudio, KEF, B&W) where its tonal density is an asset. The EX-M1+ is more system-neutral and suits a wider range. High current output handles low-impedance and demanding loads.',
    links: [
      { label: 'Official website', url: 'https://www.kinkistudio.com/', region: 'global' },
    ],
    designFamilies: [
      {
        name: 'EX-M1 (original)',
        character: 'Warm-leaning, tonally dense, muscular. More colored than the successor — trades some precision for engagement.',
        ampPairing: 'Best with neutral or analytical speakers. Avoid pairing with already-warm designs.',
      },
      {
        name: 'EX-M1+ and Dazzle',
        character: 'Neutral, transparent, exceptional imaging. The house sound evolved toward precision while retaining current authority.',
        ampPairing: 'System-neutral — works across a wide range of speakers.',
      },
    ],
  },
  {
    names: ['hegel'],
    country: 'Norway (Oslo)',
    brandScale: 'specialist',
    region: 'europe',
    categories: ['amplifier', 'dac', 'streamer'],
    philosophy: 'Hegel designs amplifiers around their proprietary "SoundEngine" technology — a patented feed-forward error correction system that aims to eliminate distortion without the phase issues of conventional negative feedback. High damping factor, strong speaker control, integrated streaming and DAC in many models. The engineering prioritises measured accuracy and signal purity.',
    tendencies: 'Hegel amplifiers are described as controlled, composed, and neutral to slightly cool. Very clean, explicit detail retrieval — analytical rather than organic. Strong macrodynamic authority with grip and slam. Soundstage is structured, precise, and wide but flatter than tube or low-feedback designs. Bass is tight and highly controlled. Can sound dry over extended listening sessions — fatigue may creep in with revealing speakers.',
    systemContext: 'Hegel excels with difficult speaker loads — low impedance, multi-driver, or power-hungry designs (Wilson, KEF, B&W). The high damping factor provides strong bass control. All-in-one models (H190, H390, H590) include DAC and streaming, reducing box count. Less synergistic with already-lean or analytical speakers where the additive precision may push toward clinical presentation.',
    pairingNotes: 'Hegel + KEF, Wilson, or B&W is a common pairing — the grip and control complements modern multi-driver designs. Less common with high-efficiency or tube-friendly speakers where the control can suppress the speaker\'s natural character.',
    links: [
      { label: 'Official website', url: 'https://www.hegel.com/', region: 'global' },
    ],
  },
  {
    names: ['singxer'],
    country: 'China',
    brandScale: 'specialist',
    region: 'east-asia',
    categories: ['amplifier', 'dac'],
    philosophy: 'Singxer is better known for USB bridge products (the SU-6) but their SA-90 monoblock amplifiers use GaN FET transistors in a class AB configuration. The design philosophy applies semiconductor speed advantages to musical amplification — GaN transistors switch approximately 10x faster than silicon MOSFETs, enabling wider bandwidth and lower distortion at a price accessible to most audiophiles.',
    tendencies: 'Fast, clean, and musical without clinical coldness. GaN transistor speed provides excellent transient resolution and dynamics. Neutral tonal balance leans slightly toward detail and clarity rather than warmth. Outstanding value-per-dollar — performance associated with amplifiers at several times the price.',
    systemContext: 'Singxer SA-90 monoblocks pair well with warm or full-bodied speakers where the GaN neutrality complements rather than compounds tonal character. Excellent with planar magnetic speakers that benefit from monoblock current delivery. Less ideal in already-lean or analytical systems.',
    links: [
      { label: 'Singxer', url: 'https://singxer.com/', region: 'global' },
    ],
  },
  {
    names: ['raal-requisite', 'raal requisite', 'raal'],
    country: 'Serbia',
    brandScale: 'boutique',
    region: 'europe',
    categories: ['headphone'],
    philosophy: 'Raal-Requisite builds true ribbon headphones — a fundamentally different transducer type from dynamic or planar magnetic drivers. Their designs require speaker amplification, not headphone amps. The ribbon driver offers electrostatic-like speed with direct, zero-compression dynamics.',
    tendencies: 'Raal headphones are among the fastest and most transparent available. Massive open soundstage, lightning transients, and resolution that rivals the best electrostatics. The ribbon driver is inherently smooth despite extreme detail retrieval. Demands careful amplification pairing.',
    systemContext: 'Raal headphones need speaker amplifiers or dedicated ribbon interface boxes. The Benchmark AHB2 is a popular pairing. Not compatible with conventional headphone amplifiers. Room-like presentation — these are headphones that sound like speakers.',
    links: [
      { label: 'Raal-Requisite', url: 'https://rfrequestie.com/', region: 'global' },
    ],
  },
  {
    names: ['sound|kaos', 'soundkaos', 'sound kaos'],
    country: 'Switzerland',
    brandScale: 'boutique',
    region: 'europe',
    categories: ['speaker'],
    philosophy: 'Martin Gateley designs speakers around widebander drivers for single-point-source coherence, supplemented by supertweeters for extension. Handcrafted in Switzerland. The design philosophy prioritises tonal purity, midrange presence, and musical flow over measurement-sheet performance.',
    tendencies: 'Natural, coherent, musically engaging. Warm midrange with widebander directness. Intimate staging suited to small and medium rooms. Prioritises long-session listenability and tonal truth over analytical detail or dynamic slam.',
    systemContext: 'sound|kaos speakers are efficient enough for low-power tube amplification and sensitive enough to reveal upstream character. Pair well with SET amps, quality integrated amplifiers, and high-current solid-state designs. Room-friendly — designed for real listening spaces.',
    links: [
      { label: 'sound|kaos', url: 'https://www.soundkaos.com/', region: 'global' },
    ],
  },
  {
    names: ['linnenberg'],
    country: 'Germany',
    brandScale: 'boutique',
    region: 'europe',
    categories: ['amplifier', 'dac'],
    philosophy: 'Ivo Linnenberg designs amplifiers with ultra-wide bandwidth and zero global feedback. The philosophy prioritises phase coherence and timing accuracy over low measured distortion. German precision engineering applied to musical reproduction.',
    tendencies: 'LinnenberG amplifiers are fast, transparent, and spatially precise. Zero global feedback preserves phase relationships, creating holographic imaging. Neutral tonal balance — reveals rather than editorialises. Speed and bandwidth are the signature traits.',
    systemContext: 'LinnenberG amplifiers partner exceptionally well with widebander and full-range speakers where the speed and bandwidth match the driver coherence. Also excellent with planar magnetic speakers. The transparency is revealing — upstream source quality matters.',
    links: [
      { label: 'LinnenberG', url: 'https://www.linnenberg-audio.de/', region: 'global' },
    ],
  },
  {
    names: ['agd', 'agd productions'],
    country: 'USA',
    brandScale: 'boutique',
    region: 'north-america',
    categories: ['amplifier'],
    philosophy: 'Alberto Guerra pioneered the use of GaN (Gallium Nitride) transistors in class D amplification. His designs use proprietary GaN output stages to eliminate the timing artifacts that make conventional class D sound mechanical. The goal is tube-like musicality from a class D topology.',
    tendencies: 'AGD amplifiers sound warm, organic, and musically engaging despite being class D. Tube-like midrange richness with solid-state speed and control. GaN transistors switch fast enough to preserve musical flow and natural phrasing. Breaks the class D stereotype.',
    systemContext: 'AGD amplifiers add warmth and organic character — pair well with neutral or detailed speakers. Less ideal in already-warm systems where the organic character could push toward lush. Efficient and cool-running — practical advantages of class D with musical advantages of class A.',
    links: [
      { label: 'AGD Productions', url: 'https://agdproductions.com/', region: 'global' },
    ],
  },
  {
    names: ['cen.grand', 'cengrand'],
    country: 'China',
    brandScale: 'specialist',
    region: 'asia',
    categories: ['dac'],
    philosophy: 'Cen.Grand builds DACs with discrete DSD conversion — no off-the-shelf DAC chips. The DSD path uses individual components for conversion, similar in philosophy to how R-2R DACs approach PCM. The design goal is analog-like naturalness, particularly for DSD content.',
    tendencies: 'Dense, warm, analog-like presentation. The discrete DSD path is the standout — DSD files sound exceptionally natural and rich. PCM handled by R-2R ladder with similar character. Prioritises musicality and tonal density over analytical precision.',
    systemContext: 'Cen.Grand DACs pair well with transparent or neutral amplification where the warmth and density provide complementary balance. DSD listeners get the most from this design. Not ideal paired with already-warm tube equipment.',
    links: [],
  },
  {
    names: ['benchmark'],
    country: 'USA',
    brandScale: 'specialist',
    region: 'north-america',
    categories: ['amplifier', 'dac'],
    philosophy: 'Benchmark comes from pro audio — their products are designed to add nothing to the signal. The AHB2 amplifier has the lowest noise and distortion of any consumer amplifier by measurement. Engineering-first, measurement-validated design philosophy.',
    tendencies: 'Benchmark products are clinically transparent. Vanishingly low distortion and noise. The AHB2 is either a revelation or too clean depending on your priorities. Pro-audio DNA means accuracy over character. Polarising in the audiophile world.',
    systemContext: 'Benchmark amplifiers excel with speakers and headphones that benefit from pristine amplification — Raal ribbon headphones, planar magnetics, and revealing studio monitors. Less synergistic in systems where warmth and character are desired. The transparency reveals everything upstream.',
    links: [
      { label: 'Benchmark', url: 'https://benchmarkmedia.com/', region: 'global' },
    ],
  },
  {
    names: ['aune'],
    country: 'China',
    brandScale: 'specialist',
    region: 'asia',
    categories: ['headphone', 'amplifier', 'dac'],
    philosophy: 'Aune designs headphones and audio electronics that punch above their price class. Value-oriented but not budget-compromised. Their planar magnetic headphones and tube/solid-state hybrid amplifiers aim for refinement typically found at higher price points.',
    tendencies: 'Clean, fast, refined. Planar magnetic headphones with good composure and speed. Not warm or romantic — precision-oriented but not clinical. Outstanding value-per-dollar. Srajan Ebaen\'s 2024 brand pick on 6moons.',
    systemContext: 'Aune products are accessible entry points for listeners exploring higher-end sound. Their headphones work well with modest amplification. Their amplifiers and DACs pair broadly.',
    links: [],
  },
  {
    names: ['bluesound'],
    country: 'Canada',
    brandScale: 'specialist',
    region: 'north-america',
    categories: ['dac', 'streamer'],
    philosophy: 'Bluesound builds streaming audio products around the BluOS multi-room platform. The design priority is ecosystem integration — seamless multi-room streaming with audiophile-grade output quality. Products use ESS DAC chips and support major streaming services natively.',
    tendencies: 'Clean, neutral conversion with ESS DAC chips. The NODE series provides streaming convenience with competent DAC quality. The NODE X upgrades to ES9038PRO for better measured performance and balanced output. Sound character is determined more by the DAC implementation than any house voicing.',
    systemContext: 'Bluesound products are streaming sources — they feed amplifiers and active speakers. The BluOS ecosystem competes with Sonos for multi-room control but targets higher output quality. Best suited as convenient streaming transports; dedicated DACs at similar prices provide better conversion quality.',
    links: [
      { label: 'Bluesound', url: 'https://www.bluesound.com/', region: 'global' },
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

// ── List serialisation ──────────────────────────────────
//
// Pre-review blocker fix (PDF 2): the ad-hoc `.join(' and ')` joiner reads
// fine for two items but produces "X and Y and Z and W" for three or more.
// Use a comma-and-final-and joiner everywhere we render a contributor list.
function joinWithCommas(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

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

/**
 * Look up a brand profile by URL slug (output of `toSlug`).
 * Used by `/brand/[slug]` to resolve the route segment back to its
 * curated profile. Match is by slug-equivalence on any name in
 * BrandProfile.names — so '/brand/devore' and '/brand/devore-fidelity'
 * both resolve to the same profile.
 */
export function findBrandProfileBySlug(slug: string): BrandProfile | undefined {
  if (!slug) return undefined;
  return BRAND_PROFILES.find((bp) =>
    bp.names.some((name) => routeToSlug(name) === slug),
  );
}

/**
 * Catalog products whose brand slugifies to `slug`. Filters the unified
 * ALL_PRODUCTS pool by exact slug match on `product.brand`, so a brand
 * with multiple BrandProfile aliases (e.g. ['pass labs', 'first watt'])
 * correctly returns only the products matching the URL the user clicked
 * — not the union of every alias.
 */
export function findProductsByBrandSlug(slug: string): Product[] {
  if (!slug) return [];
  return ALL_PRODUCTS.filter((p) => routeToSlug(p.brand) === slug);
}

function findProductsByBrand(text: string): Product[] {
  const lower = text.toLowerCase();
  return ALL_PRODUCTS.filter((p) =>
    lower.includes(p.brand.toLowerCase()) || lower.includes(p.name.toLowerCase()),
  );
}

/**
 * Look up a single catalog product by a free-form component name such as
 * "WLM Diva Monitor", "JOB Integrated", or "Chord Hugo". The name comes
 * from the parsed "Do not touch:" line in the advisor's optimize body —
 * it is a display string, not a structured key.
 *
 * Strategy:
 *   1. Exact `brand + " " + name` match (case-insensitive).
 *   2. Name-only match when the input contains the brand AND name tokens.
 *   3. ID slug match ("wlm-diva-monitor" ↔ "WLM Diva Monitor").
 *
 * Returns `undefined` when no catalog product matches — callers degrade
 * honestly.
 */
export function findProductByComponentName(text: string): Product | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase().trim();
  // 1. Exact brand+name match
  const exact = ALL_PRODUCTS.find(
    (p) => `${p.brand} ${p.name}`.toLowerCase() === lower,
  );
  if (exact) return exact;
  // 2. Contains both brand and name tokens
  const byTokens = ALL_PRODUCTS.find(
    (p) =>
      lower.includes(p.brand.toLowerCase()) &&
      lower.includes(p.name.toLowerCase()),
  );
  if (byTokens) return byTokens;
  // 3. ID slug match (hyphen-separated lowercase)
  const slug = lower.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return ALL_PRODUCTS.find((p) => p.id === slug);
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
 * Build an expert-level brand comparison response.
 *
 * Flow: build ComparisonPayload → validate → render → ConsultationResponse
 *
 * All comparison reasoning is deterministic and validated before rendering.
 */
function buildBrandComparison(
  profileA: BrandProfile | { name: string; philosophy: string; tendencies: string },
  profileB: BrandProfile | { name: string; philosophy: string; tendencies: string },
  queryText?: string,
): ConsultationResponse {
  const payload = buildInitialComparisonPayload(profileA, profileB, queryText);

  // Validate — log warnings, but don't block rendering (graceful degradation).
  const validation = validateComparisonPayload(payload);
  if (!validation.valid) {
    // eslint-disable-next-line no-console
    console.warn('[comparison-payload] validation errors:', validation.errors);
  }

  // Render from payload
  const rendered = renderComparisonPayload(payload);

  // Output validation — check rendered text for generic phrases
  const outputValidation = validateComparisonOutput(rendered.comparisonSummary);
  if (!outputValidation.valid) {
    // eslint-disable-next-line no-console
    console.warn('[comparison-output] validation errors:', outputValidation.errors);
  }

  return {
    subject: payload.subject,
    comparisonSummary: rendered.comparisonSummary,
    comparisonImages: buildComparisonImages(payload.sideA.name, payload.sideB.name, queryText),
    followUp: rendered.followUp,
  };
}

/**
 * Build comparison-side thumbnails. For each side, try to resolve a
 * brand+product name from the catalog or from the query text, then ask
 * `getProductImage` for a placeholder. When the side is brand-only and no
 * product can be inferred, the entry is still returned with an undefined
 * imageUrl — the renderer is responsible for the visual fallback.
 *
 * Domain note: this is a presentation-layer helper that delegates the
 * actual image lookup to the portable `getProductImage` mapping.
 */
function buildComparisonImages(
  sideAName: string,
  sideBName: string,
  queryText?: string,
): Array<{ brand: string; name: string; imageUrl?: string }> | undefined {
  const a = resolveComparisonSubject(sideAName, queryText);
  const b = resolveComparisonSubject(sideBName, queryText);
  if (!a && !b) return undefined;
  return [
    a ?? { brand: sideAName, name: '', imageUrl: undefined },
    b ?? { brand: sideBName, name: '', imageUrl: undefined },
  ];
}

/**
 * Resolve a comparison side label to a brand+name pair with a thumbnail.
 *
 * Priority:
 *   1. Catalog product whose `${brand} ${name}` matches the side label.
 *   2. Catalog product mentioned in the user's query text under this brand.
 *   3. Brand-only entry — getProductImage falls through to undefined for
 *      unknown brands; known seed brands still return a placeholder via
 *      the brand-only path.
 */
function resolveComparisonSubject(
  sideLabel: string,
  queryText?: string,
): { brand: string; name: string; imageUrl?: string } | null {
  if (!sideLabel) return null;
  const lowerLabel = sideLabel.toLowerCase();

  // 1. Direct catalog match by combined "brand name"
  const direct = ALL_PRODUCTS.find(
    (p) => `${p.brand} ${p.name}`.toLowerCase() === lowerLabel,
  );
  if (direct) {
    return {
      brand: direct.brand,
      name: direct.name,
      imageUrl: direct.imageUrl ?? getProductImage(direct.brand, direct.name),
    };
  }

  // 2. Brand mentioned + product mentioned in the query text
  if (queryText) {
    const lowerQuery = queryText.toLowerCase();
    const brandHit = ALL_PRODUCTS.find(
      (p) => p.brand.toLowerCase() === lowerLabel
        && lowerQuery.includes(p.name.toLowerCase()),
    );
    if (brandHit) {
      return {
        brand: brandHit.brand,
        name: brandHit.name,
        imageUrl: brandHit.imageUrl ?? getProductImage(brandHit.brand, brandHit.name),
      };
    }
  }

  // 3. Brand-only fallback. getProductImage will return a placeholder for
  // brands that have at least one entry in its KNOWN_PRODUCTS seed list,
  // and undefined otherwise.
  const brandOnlyImage = getProductImage(sideLabel, undefined);
  return { brand: sideLabel, name: '', imageUrl: brandOnlyImage };
}

/**
 * Build the structured ComparisonPayload for an initial brand comparison
 * (no system context yet).
 */
export function buildInitialComparisonPayload(
  profileA: BrandProfile | { name: string; philosophy: string; tendencies: string },
  profileB: BrandProfile | { name: string; philosophy: string; tendencies: string },
  queryText?: string,
): ComparisonPayload {
  const nameA = capitalize('names' in profileA ? profileA.names[0] : profileA.name);
  const nameB = capitalize('names' in profileB ? profileB.names[0] : profileB.name);

  const charA = extractCoreCharacter(profileA.tendencies);
  const charB = extractCoreCharacter(profileB.tendencies);

  // ── Sides ──────────────────────────────────────────
  const sonicTraitsA = extractSonicTraits(profileA.tendencies);
  const sonicTraitsB = extractSonicTraits(profileB.tendencies);

  const sideA: ComparisonSide = {
    name: nameA,
    character: charA,
    designPhilosophy: takeSentences(profileA.philosophy, 2),
    sonicTraits: sonicTraitsA,
  };

  const sideB: ComparisonSide = {
    name: nameB,
    character: charB,
    designPhilosophy: takeSentences(profileB.philosophy, 2),
    sonicTraits: sonicTraitsB,
  };

  // ── Trade-off ──────────────────────────────────────
  const dominantA = detectDominantAxis(charA, profileA.tendencies);
  const dominantB = detectDominantAxis(charB, profileB.tendencies);
  const flowScoreA = scoreKeywords(charA + ' ' + profileA.tendencies, ['flow', 'elastic', 'alive', 'rhythmic', 'drive']);
  const flowScoreB = scoreKeywords(charB + ' ' + profileB.tendencies, ['flow', 'elastic', 'alive', 'rhythmic', 'drive']);

  const tradeoffAxis = computeTradeoffAxis(dominantA, dominantB, flowScoreA, flowScoreB);
  const tradeoffStatement = buildTradeoffStatement(nameA, charA, profileA.tendencies, nameB, charB, profileB.tendencies);
  const [labelA, labelB] = TRADEOFF_LABELS[tradeoffAxis];

  // ── Taste frame ────────────────────────────────────
  const explicitTaste = queryText
    ? buildTasteDecisionFrame(queryText, nameA, charA, profileA.tendencies, nameB, charB, profileB.tendencies)
    : null;
  const tasteStatement = explicitTaste ?? buildProvisionalTasteInference(nameA, charA, nameB, charB);

  // ── Decision ───────────────────────────────────────
  const guidanceText = buildComparisonGuidance(nameA, charA, profileA, nameB, charB, profileB);
  const guidanceLines = guidanceText.split(/[.\n]/).filter((l) => l.trim());
  const decision: ComparisonDecision = {
    chooseAIf: guidanceLines[0]?.trim() || `If you want ${labelA} → ${nameA}.`,
    chooseBIf: guidanceLines[1]?.trim() || `If you want ${labelB} → ${nameB}.`,
  };

  // Taste-based recommendation (overrides if explicit taste signals present)
  const tasteRec = buildInitialComparisonRecommendation(nameA, charA, profileA, nameB, charB, profileB, queryText);
  if (tasteRec) {
    decision.recommended = tasteRec;
  }

  // ── Recommendation (always present) ────────────────
  const rec = buildComparisonRecommendation(nameA, charA, profileA, nameB, charB, profileB);
  if (!decision.recommended) {
    decision.recommended = rec.recommended;
  }
  decision.rationale = rec.rationale;

  // ── Shopping ───────────────────────────────────────
  const recommendedName = decision.recommended?.match(/\*\*(\w+)\*\*/)?.[1];
  const shopping = buildComparisonShopping(nameA, profileA, nameB, profileB, recommendedName);

  // ── Sources ────────────────────────────────────────
  const sources = buildComparisonSourceRefs(nameA, profileA, nameB, profileB);

  // ── Follow-up ──────────────────────────────────────
  const familiesA = 'designFamilies' in profileA ? (profileA as BrandProfile).designFamilies : undefined;
  const familiesB = 'designFamilies' in profileB ? (profileB as BrandProfile).designFamilies : undefined;
  const hasAnyFamilies = (familiesA && familiesA.length > 0) || (familiesB && familiesB.length > 0);
  const followUp = hasAnyFamilies
    ? `Which models are you comparing? That changes the picture — and if you tell me your speakers, the recommendation gets sharper.`
    : undefined;

  return {
    subject: `${nameA} vs ${nameB}`,
    sideA,
    sideB,
    tradeoff: {
      axis: tradeoffAxis,
      label: `${labelA} vs ${labelB}`,
      statement: tradeoffStatement,
    },
    tasteFrame: {
      source: explicitTaste ? 'explicit' : 'provisional',
      statement: tasteStatement,
    },
    decision,
    shopping,
    sources: sources.length > 0 ? sources : undefined,
    followUp,
  };
}

/**
 * Extract sonic traits as a string array from tendency text.
 * Used to populate ComparisonSide.sonicTraits in the payload.
 */
function extractSonicTraits(tendencies: string): string[] {
  const lower = tendencies.toLowerCase();
  const traits: string[] = [];

  // Timing & energy
  if (/fast|speed|elastic|alive|timing|rhythmic|pace|drive/i.test(lower)) {
    if (/elastic|alive/i.test(lower)) traits.push('fast, elastic energy — music feels alive');
    else if (/rhythmic|drive|pace/i.test(lower)) traits.push('strong rhythmic drive and timing');
    else traits.push('fast, precise timing');
  }
  if (/controlled|stable|composed|restrained/i.test(lower)) {
    traits.push('controlled, stable presentation');
  }

  // Tone & harmonics
  const warmTone = /warm|golden|fluid(?!.*than)|tube[- ]?(?:adjacent|like)|harmonic.*rich|tonal.*dens|lush/i.test(lower);
  const coolTone = /neutral.*cool|slightly cool|cool|clean|dry|analytical/i.test(lower);
  if (warmTone) {
    if (/golden|tube[- ]?adjacent/i.test(lower)) traits.push('slightly golden tonality — fluid, almost tube-adjacent');
    else if (/lush|dense/i.test(lower)) traits.push('warm, tonally dense, harmonically rich');
    else traits.push('warm harmonic character');
  }
  if (coolTone && !warmTone) {
    if (/dry/i.test(lower)) traits.push('neutral to cool tonality — clean, sometimes dry');
    else traits.push('neutral, clean tonality');
  }

  // Dynamics
  if (/microdynamic|nuance|expressive.*phras/i.test(lower)) {
    traits.push('microdynamic nuance and expressive phrasing');
  }
  if (/macrodynamic|grip|slam|authority|bass.*grip/i.test(lower)) {
    traits.push('macrodynamic authority — grip and slam');
  }
  if (/dynamic/i.test(lower) && traits.every((t) => !/dynamic/i.test(t))) {
    traits.push('good dynamic range');
  }

  // Spatial
  if (/dimensional|airy|holographic|depth/i.test(lower)) {
    traits.push('dimensional, airy soundstage');
  }
  if (/structured|precise.*stage|flat|wide but/i.test(lower)) {
    traits.push('structured, precise imaging');
  }

  return traits;
}

/**
 * Build the trade-off statement — reduce the comparison to a simple tension.
 * "The real choice here is X vs Y."
 */
function buildTradeoffStatement(
  nameA: string, charA: string, tendA: string,
  nameB: string, charB: string, tendB: string,
): string {
  // Score each side's dominant tendency by counting keyword matches.
  // This avoids misclassification when a brand has traits on both axes
  // (e.g. JOB is fast AND slightly golden).
  const warmWords = ['warm', 'rich', 'dense', 'harmonic', 'tonal density', 'tonal body', 'lush', 'musical', 'golden', 'tube-adjacent', 'saturated'];
  const controlWords = ['controlled', 'composed', 'neutral', 'clean', 'damping', 'precise', 'analytical', 'tight', 'restrained', 'cool', 'dry'];
  const flowWords = ['flow', 'elastic', 'alive', 'rhythmic', 'drive'];

  function score(text: string, words: string[]): number {
    const lower = text.toLowerCase();
    return words.filter((w) => lower.includes(w)).length;
  }

  const textA = charA + ' ' + tendA;
  const textB = charB + ' ' + tendB;

  const warmScoreA = score(textA, warmWords);
  const warmScoreB = score(textB, warmWords);
  const controlScoreA = score(textA, controlWords);
  const controlScoreB = score(textB, controlWords);
  const flowScoreA = score(textA, flowWords);
  const flowScoreB = score(textB, flowWords);

  // Determine dominant axis for each side
  const dominantA = warmScoreA > controlScoreA ? 'warm' : controlScoreA > warmScoreA ? 'control' : (flowScoreA > 0 ? 'flow' : 'neutral');
  const dominantB = warmScoreB > controlScoreB ? 'warm' : controlScoreB > warmScoreB ? 'control' : (flowScoreB > 0 ? 'flow' : 'neutral');

  if (dominantA === 'warm' && dominantB === 'control') {
    if (flowScoreA > 0) return `The real choice: **musical realism through flow and harmonic richness** (${nameA}) vs **technical accuracy through control and precision** (${nameB}). These are not small variations of the same idea — they are fundamentally different interpretations of what "good sound" means.`;
    return `The real choice: **warmth and tonal body** (${nameA}) vs **precision and control** (${nameB}).`;
  }
  if (dominantB === 'warm' && dominantA === 'control') {
    if (flowScoreB > 0) return `The real choice: **technical accuracy through control and precision** (${nameA}) vs **musical realism through flow and harmonic richness** (${nameB}). These are not small variations of the same idea — they are fundamentally different interpretations of what "good sound" means.`;
    return `The real choice: **precision and control** (${nameA}) vs **warmth and tonal body** (${nameB}).`;
  }

  // Flow vs control
  if (flowScoreA > flowScoreB && controlScoreB > controlScoreA) {
    return `The real choice: **musical flow and rhythmic engagement** (${nameA}) vs **composure and control** (${nameB}).`;
  }
  if (flowScoreB > flowScoreA && controlScoreA > controlScoreB) {
    return `The real choice: **composure and control** (${nameA}) vs **musical flow and rhythmic engagement** (${nameB}).`;
  }

  // Both on same axis but different emphasis
  if (warmScoreA > 0 && warmScoreB > 0) {
    if (flowScoreA > flowScoreB) return `The real choice: **speed and rhythmic precision** (${nameA}) vs **tonal density and harmonic saturation** (${nameB}). Both have warmth — the question is how it arrives.`;
    if (flowScoreB > flowScoreA) return `The real choice: **tonal density and harmonic saturation** (${nameA}) vs **speed and rhythmic precision** (${nameB}). Both have warmth — the question is how it arrives.`;
  }

  // Generic contrast
  return `The real choice: **${charA}** (${nameA}) vs **${charB}** (${nameB}). Different priorities, not a quality gap.`;
}

/**
 * Build a provisional taste inference when no explicit taste signal is present.
 * Never say "no strong signal" — always infer a direction.
 *
 * Uses trait-consistent session-affinity logic:
 *   warm / dense / smooth / relaxed → long-session ease and comfort
 *   fast / precise / analytical / lean → short-session impact and resolution
 * Avoids generic "engagement" or "keeps you listening" heuristics.
 */
function buildProvisionalTasteInference(
  nameA: string, charA: string,
  nameB: string, charB: string,
): string {
  // Session-affinity keywords (not "engagement" which conflates rhythm with ease)
  const easeKw = ['warm', 'rich', 'lush', 'dense', 'relaxed', 'smooth', 'ease', 'body', 'tonal', 'harmonic', 'flowing', 'organic'];
  const impactKw = ['fast', 'precise', 'analytical', 'detailed', 'clean', 'controlled', 'speed', 'articulate', 'resolving', 'transparent', 'tight'];

  const easeA = scoreKeywords(charA, easeKw);
  const easeB = scoreKeywords(charB, easeKw);
  const impactA = scoreKeywords(charA, impactKw);
  const impactB = scoreKeywords(charB, impactKw);

  const aDominant = easeA > impactA ? 'ease' : impactA > easeA ? 'impact' : 'mixed';
  const bDominant = easeB > impactB ? 'ease' : impactB > easeB ? 'impact' : 'mixed';

  if (aDominant === 'ease' && bDominant === 'impact') {
    return `If long listening sessions and tonal comfort matter to you, **${nameA}** is likely the better fit. If you prioritise clarity and transient precision — the ability to hear everything in a recording — **${nameB}** is where that lives.`;
  }
  if (bDominant === 'ease' && aDominant === 'impact') {
    return `If long listening sessions and tonal comfort matter to you, **${nameB}** is likely the better fit. If you prioritise clarity and transient precision — the ability to hear everything in a recording — **${nameA}** is where that lives.`;
  }
  // Both lean the same direction — differentiate on degree and sub-traits
  if (aDominant === 'ease' && bDominant === 'ease') {
    // Both warm — distinguish by density vs flow
    const densityA = scoreKeywords(charA, ['dense', 'density', 'body', 'saturated', 'lush', 'weight', 'harmonic']);
    const densityB = scoreKeywords(charB, ['dense', 'density', 'body', 'saturated', 'lush', 'weight', 'harmonic']);
    const flowA = scoreKeywords(charA, ['flow', 'elastic', 'alive', 'rhythmic', 'drive', 'speed', 'articulate']);
    const flowB = scoreKeywords(charB, ['flow', 'elastic', 'alive', 'rhythmic', 'drive', 'speed', 'articulate']);
    if (flowA > densityA && densityB > flowB) {
      return `Both prioritise musical warmth, but **${nameA}** leans toward rhythmic drive and articulation while **${nameB}** leans toward harmonic density and tonal weight. The choice depends on whether you want your music to move or to envelop.`;
    }
    if (densityA > flowA && flowB > densityB) {
      return `Both prioritise musical warmth, but **${nameA}** leans toward harmonic density and tonal weight while **${nameB}** leans toward rhythmic drive and articulation. The choice depends on whether you want your music to envelop or to move.`;
    }
    return `Both ${nameA} and ${nameB} prioritise musical warmth. The distinction is in degree and voicing — listen for which tonal character resonates with the music you return to most.`;
  }
  if (aDominant === 'impact' && bDominant === 'impact') {
    return `Both ${nameA} and ${nameB} prioritise precision and control. The distinction is in how they handle micro-dynamics and tonal weight at the margins — which matters most depends on your source material and listening priorities.`;
  }
  return `This is ultimately a question of what you want more of in your listening — warmth and body, or speed and resolution. That preference, more than any specification, determines which direction is right.`;
}

/**
 * Build a light recommendation for initial comparisons based on
 * taste signals or brand character asymmetry.
 */
function buildInitialComparisonRecommendation(
  nameA: string, charA: string,
  profileA: BrandProfile | { name: string; philosophy: string; tendencies: string },
  nameB: string, charB: string,
  profileB: BrandProfile | { name: string; philosophy: string; tendencies: string },
  queryText?: string,
): string | null {
  if (!queryText) return null;
  const signals = extractTasteSignals(queryText);
  if (signals.length === 0) return null;

  const primary = signals[0];
  const textA = `${charA} ${profileA.tendencies}`;
  const textB = `${charB} ${profileB.tendencies}`;
  const alignA = AXIS_ALIGNMENT[primary.axis].test(textA);
  const alignB = AXIS_ALIGNMENT[primary.axis].test(textB);

  if (alignA && !alignB) {
    return `Given your interest in ${primary.phrase}, **${nameA}** is the more natural fit in this comparison.`;
  }
  if (alignB && !alignA) {
    return `Given your interest in ${primary.phrase}, **${nameB}** is the more natural fit in this comparison.`;
  }
  return null;
}

/**
 * Build compact decision guidance from brand character contrast.
 * Format: "If you want X → A. If you want Y → B."
 *
 * Uses keyword scoring (not simple regex match) to determine dominant axis,
 * since many brands have traits on both warm and precise axes.
 */
function buildComparisonGuidance(
  nameA: string, charA: string, profileA: BrandProfile | { name: string; philosophy: string; tendencies: string },
  nameB: string, charB: string, profileB: BrandProfile | { name: string; philosophy: string; tendencies: string },
): string {
  const warmKw = ['warm', 'rich', 'dense', 'harmonic', 'lush', 'musical', 'organic', 'golden', 'tonal density', 'tonal body', 'flowing', 'tube-adjacent'];
  const preciseKw = ['precise', 'neutral', 'analytical', 'detailed', 'clean', 'controlled', 'composed', 'resolving', 'transparent', 'tight', 'damping', 'restrained', 'dry', 'cool'];

  function scoreAxis(text: string, keywords: string[]): number {
    const lower = text.toLowerCase();
    return keywords.filter((w) => lower.includes(w)).length;
  }

  const textA = charA + ' ' + profileA.tendencies;
  const textB = charB + ' ' + profileB.tendencies;
  const warmA = scoreAxis(textA, warmKw);
  const warmB = scoreAxis(textB, warmKw);
  const preciseA = scoreAxis(textA, preciseKw);
  const preciseB = scoreAxis(textB, preciseKw);

  // Determine dominant direction for each side
  const aDominant = warmA > preciseA ? 'warm' : preciseA > warmA ? 'precise' : 'mixed';
  const bDominant = warmB > preciseB ? 'warm' : preciseB > warmB ? 'precise' : 'mixed';

  if (aDominant === 'warm' && bDominant === 'precise') {
    return `If you want warmth and body → ${nameA}. If you want precision and detail → ${nameB}.`;
  }
  if (bDominant === 'warm' && aDominant === 'precise') {
    return `If you want warmth and body → ${nameB}. If you want precision and detail → ${nameA}.`;
  }
  // Both lean the same way — find subtler contrast using flow/density axis
  const flowKw = ['flow', 'elastic', 'alive', 'timing', 'speed', 'fast', 'rhythmic', 'drive'];
  const densityKw = ['dense', 'density', 'body', 'harmonic', 'saturated', 'lush', 'weight', 'presence'];
  if (aDominant === 'warm' && bDominant === 'warm') {
    const flowA2 = scoreAxis(textA, flowKw);
    const flowB2 = scoreAxis(textB, flowKw);
    const densA = scoreAxis(textA, densityKw);
    const densB = scoreAxis(textB, densityKw);
    if (flowA2 > flowB2 && densB > densA) {
      return `If you want speed and rhythmic precision → ${nameA}. If you want tonal density and harmonic saturation → ${nameB}.`;
    }
    if (flowB2 > flowA2 && densA > densB) {
      return `If you want tonal density and harmonic saturation → ${nameA}. If you want speed and rhythmic precision → ${nameB}.`;
    }
    return `Both lean warm — the difference is in texture and presentation. ${nameA} tends toward ${charA}, ${nameB} toward ${charB}.`;
  }
  if (aDominant === 'precise' && bDominant === 'precise') {
    return `Both lean precise — the difference is in voicing. ${nameA} tends toward ${charA}, ${nameB} toward ${charB}.`;
  }
  // Fallback — use extracted characters directly
  return `${nameA} leans toward ${charA}. ${nameB} leans toward ${charB}. The right choice depends on what your system needs.`;
}

// ── Taste-based decision framing ──────────────────────
//
// Listener-centered layer that explicitly connects product traits
// to what the user values. This is the "which one is for YOU" layer.
//
// Differs from guidance (which is generic: "if you want X → A")
// by using second-person address and resolving the comparison
// toward the user's stated or inferred priorities.

/** Preference axes detected from user language. */
interface TasteSignal {
  axis: 'warm' | 'precise' | 'rhythmic' | 'spatial' | 'organic' | 'dynamic';
  /** The preference phrase extracted from the query (for natural quoting). */
  phrase: string;
}

const TASTE_EXTRACTORS: Array<{ axis: TasteSignal['axis']; pattern: RegExp; phrase: string }> = [
  // Warm / musical / organic
  { axis: 'warm', pattern: /\b(?:warm(?:th)?|lush|rich(?:ness)?|musical|body|harmonic|tone|tonal\s+density|vocal|midrange|tube[- ]?like)\b/i, phrase: 'warmth and tonal richness' },
  // Precise / detailed / controlled
  { axis: 'precise', pattern: /\b(?:detail(?:ed)?|precis(?:ion|e)|clarity|resolv(?:ing|e)|analytic(?:al)?|clean|speed|fast|control(?:led)?|transparent|neutral|tight)\b/i, phrase: 'detail and precision' },
  // Rhythmic / timing
  { axis: 'rhythmic', pattern: /\b(?:rhythm(?:ic)?|timing|pace|prat|drive|boogie|energy|swing|groove|toe[- ]?tapping|engagement)\b/i, phrase: 'rhythmic engagement' },
  // Spatial
  { axis: 'spatial', pattern: /\b(?:soundstage|stage|imag(?:ing|e)|spatial|separation|3d|dimensional|depth|width|air(?:y|iness)?)\b/i, phrase: 'spatial presentation' },
  // Organic / natural
  { axis: 'organic', pattern: /\b(?:organic|natural|realistic|lifelike|presence|texture|grain[- ]?free|smooth(?:ness)?|ease|relaxed|effortless)\b/i, phrase: 'natural, organic presentation' },
  // Dynamic
  { axis: 'dynamic', pattern: /\b(?:dynamic(?:s)?|slam|punch|impact|macro|micro|transient|attack|weight|authority|power(?:ful)?)\b/i, phrase: 'dynamics and impact' },
];

/** Extract listener taste signals from query text. */
function extractTasteSignals(text: string): TasteSignal[] {
  const signals: TasteSignal[] = [];
  const seen = new Set<string>();
  for (const ext of TASTE_EXTRACTORS) {
    if (ext.pattern.test(text) && !seen.has(ext.axis)) {
      seen.add(ext.axis);
      signals.push({ axis: ext.axis, phrase: ext.phrase });
    }
  }
  return signals;
}

/** Map a taste axis to the brand character words it aligns with. */
const AXIS_ALIGNMENT: Record<TasteSignal['axis'], RegExp> = {
  warm: /warm|rich|lush|dense|full|musical|organic|harmonic|tonal|vocal|midrange|tube|smooth/i,
  precise: /precise|neutral|analytical|detailed|clean|fast|controlled|resolving|transparent|clear|speed|tight/i,
  rhythmic: /rhythm|timing|pace|drive|energy|engagement|alive|dynamic|boogie|snappy|agile/i,
  spatial: /spatial|soundstage|imaging|separation|dimensional|airy|open|wide|holographic|3d/i,
  organic: /organic|natural|realistic|texture|smooth|relaxed|effortless|ease|lifelike|grain/i,
  dynamic: /dynamic|slam|punch|impact|transient|attack|weight|authority|power|macro|grip/i,
};

/**
 * Build a taste-based decision frame for a comparison.
 *
 * Returns a listener-centered paragraph that explicitly connects the
 * comparison to what the user values. Returns null when no taste signal
 * is detected — callers should fall back to generic guidance.
 *
 * @param queryText - the user's original message (for taste extraction)
 * @param nameA - display name of side A
 * @param charA - character summary of side A
 * @param tendenciesA - full tendency text for side A
 * @param nameB - display name of side B
 * @param charB - character summary of side B
 * @param tendenciesB - full tendency text for side B
 */
export function buildTasteDecisionFrame(
  queryText: string,
  nameA: string, charA: string, tendenciesA: string,
  nameB: string, charB: string, tendenciesB: string,
): string | null {
  const signals = extractTasteSignals(queryText);
  if (signals.length === 0) return null;

  // Find which side aligns better with the strongest taste signal
  const primary = signals[0];
  const textA = `${charA} ${tendenciesA}`;
  const textB = `${charB} ${tendenciesB}`;
  const alignA = AXIS_ALIGNMENT[primary.axis].test(textA);
  const alignB = AXIS_ALIGNMENT[primary.axis].test(textB);

  if (alignA && !alignB) {
    return `If your priority is ${primary.phrase}, **${nameA}** is the more natural fit — its design leans into exactly that quality.${signals.length > 1 ? ` ${nameB} would serve a different emphasis.` : ''}`;
  }
  if (alignB && !alignA) {
    return `If your priority is ${primary.phrase}, **${nameB}** is the more natural fit — its design leans into exactly that quality.${signals.length > 1 ? ` ${nameA} would serve a different emphasis.` : ''}`;
  }
  if (alignA && alignB) {
    // Both align — the distinction is subtler
    return `Both serve ${primary.phrase} to some degree — the difference is in how. ${nameA} tends toward ${charA}, ${nameB} toward ${charB}. The question is which expression of that quality resonates more with your listening.`;
  }

  // Neither clearly aligns — use the secondary signal if available
  if (signals.length > 1) {
    const secondary = signals[1];
    const align2A = AXIS_ALIGNMENT[secondary.axis].test(textA);
    const align2B = AXIS_ALIGNMENT[secondary.axis].test(textB);
    if (align2A && !align2B) {
      return `Given your interest in ${secondary.phrase}, **${nameA}** is likely the closer match.`;
    }
    if (align2B && !align2A) {
      return `Given your interest in ${secondary.phrase}, **${nameB}** is likely the closer match.`;
    }
  }

  return null;
}

/**
 * Build a generic taste tie-breaker for comparisons where the user
 * hasn't expressed a preference. This is a softer prompt than
 * `buildTasteDecisionFrame` — it asks the user to consider priorities
 * rather than resolving for them.
 */
function buildTasteTieBreakerPrompt(
  nameA: string, charA: string,
  nameB: string, charB: string,
): string {
  // Identify the axis of contrast
  const warmA = /warm|rich|lush|dense|musical|organic|harmonic|tonal|smooth/i.test(charA);
  const warmB = /warm|rich|lush|dense|musical|organic|harmonic|tonal|smooth/i.test(charB);
  const preciseA = /precise|neutral|analytical|detailed|clean|fast|controlled|resolving|transparent/i.test(charA);
  const preciseB = /precise|neutral|analytical|detailed|clean|fast|controlled|resolving|transparent/i.test(charB);

  if (warmA && preciseB) {
    return `This is ultimately a question of what you want more of in your listening — harmonic body and engagement, or resolution and clarity. That preference, more than any spec, will tell you which direction is right.`;
  }
  if (warmB && preciseA) {
    return `This is ultimately a question of what you want more of in your listening — resolution and clarity, or harmonic body and engagement. That preference, more than any spec, will tell you which direction is right.`;
  }
  return `The right choice here comes down to what you prioritise in your listening. Neither is objectively better — they optimise for different qualities, and your taste is what breaks the tie.`;
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

  // 2b-alias. Shorthand product resolution via alias map.
  //     When the user names a product by shorthand ("terminator",
  //     "kinki integrated") without the brand word in the message,
  //     findProductsByBrand above fails because the brand string isn't
  //     in the message. Consult findCatalogProduct — which runs through
  //     PRODUCT_NAME_ALIASES and the brand+category fallback — and
  //     build a product consultation from the resolved catalog entry.
  //     This keeps "Not from verified catalog" from firing on products
  //     that ARE in the catalog under a canonical name.
  if (hasProductSubject && subjectMatches) {
    const productSubject = subjectMatches.find((m) => m.kind === 'product');
    if (productSubject) {
      const resolved = findCatalogProduct(productSubject.name);
      if (resolved) {
        const brandProducts = ALL_PRODUCTS.filter(
          (p) => p.brand.toLowerCase() === resolved.brand.toLowerCase(),
        );
        if (brandProducts.length > 0) {
          return buildProductConsultation(brandProducts, resolved.brand);
        }
      }
    }
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
  let systemContext = 'How much this matters in practice depends on the rest of the system and how the room interacts.';
  let refinedFollowUp = followUp;

  if (activeComparison.scope === 'brand' && criterion.category === 'amplifier_pairing') {
    const familyNote = buildDesignFamilyAmpNote(nameA, nameB, criterion);
    if (familyNote) {
      systemContext += `\n\n${familyNote}`;
      refinedFollowUp = 'Which model or series are you considering? That shapes how this comparison plays out.';
    }
  }

  // Taste-based decision frame for the criterion follow-up.
  const tasteFrame = infoA && infoB
    ? buildTasteDecisionFrame(followUpMessage, nameA, '', infoA.tendencies, nameB, '', infoB.tendencies)
    : null;

  // Pack into concise side-by-side format — no long review sections.
  const concise = `${summary}\n\n**${nameA}:** ${contextA}\n\n**${nameB}:** ${contextB}${tasteFrame ? `\n\n${tasteFrame}` : ''}`;

  return {
    subject: `${nameA} vs ${nameB} — ${criterion.label}`,
    comparisonSummary: concise,
    comparisonImages: buildComparisonImages(nameA, nameB, followUpMessage),
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

  // Resolve the context component's brand info (e.g. DeVore for a speaker)
  const contextBrandInfo = resolveBrandInfo(contextMessage);
  const contextName = contextBrandInfo ? capitalize(contextMessage.trim()) : contextMessage.trim();

  // Extract what the user told us for the summary
  const contextLabel = describeContext(contextMessage, contextKind);

  // ── System-anchored decision path ──────────────────────
  // When the user provides system context (speaker for amp comparison,
  // amp for speaker comparison), produce a decision-oriented response
  // anchored to the specific pairing — NOT re-descriptions.
  if (infoA && infoB && isSystemAnchorableContext(contextKind)) {
    const anchored = buildSystemAnchoredDecision(
      nameA, infoA, nameB, infoB,
      contextName, contextBrandInfo, contextKind,
      contextMessage,
    );

    return {
      subject: `${nameA} vs ${nameB} — with ${contextName}`,
      comparisonSummary: anchored.body,
      comparisonImages: buildComparisonImages(nameA, nameB, contextMessage),
      followUp: anchored.followUp,
    };
  }

  // ── Fallback: generic context refinement ───────────────
  const sideA = infoA
    ? buildContextSideAnswer(nameA, infoA, contextKind, contextMessage)
    : `I don't have enough data about ${nameA} to assess this pairing specifically.`;
  const sideB = infoB
    ? buildContextSideAnswer(nameB, infoB, contextKind, contextMessage)
    : `I don't have enough data about ${nameB} to assess this pairing specifically.`;

  const summary = buildContextSummary(nameA, nameB, infoA, infoB, contextKind, contextMessage, activeComparison.scope);
  const followUp = buildContextFollowUp(contextKind, infoA, infoB);

  const tasteFrame = infoA && infoB
    ? buildTasteDecisionFrame(contextMessage, nameA, '', infoA.tendencies, nameB, '', infoB.tendencies)
    : null;

  const concise = `${summary}\n\n**${nameA}:** ${sideA}\n\n**${nameB}:** ${sideB}${tasteFrame ? `\n\n${tasteFrame}` : ''}`;

  return {
    subject: `${nameA} vs ${nameB} — ${contextLabel}`,
    comparisonSummary: concise,
    comparisonImages: buildComparisonImages(nameA, nameB, contextMessage),
    followUp,
  };
}

/** Can we build a system-anchored decision for this context type? */
function isSystemAnchorableContext(kind: ContextKind): boolean {
  return kind === 'speaker' || kind === 'amplifier' || kind === 'power';
}

/**
 * Build a system-anchored decision response (expert level).
 *
 * Flow: build ComparisonPayload → validate → render
 * The response MUST end with a decision. No questions.
 */
function buildSystemAnchoredDecision(
  nameA: string, infoA: BrandInfo,
  nameB: string, infoB: BrandInfo,
  contextName: string, contextInfo: BrandInfo | null,
  contextKind: ContextKind,
  contextMessage: string,
): { body: string; followUp?: string } {
  const payload = buildSystemAnchoredPayload(
    nameA, infoA, nameB, infoB,
    contextName, contextInfo, contextKind, contextMessage,
  );

  // Validate
  const validation = validateComparisonPayload(payload);
  if (!validation.valid) {
    // eslint-disable-next-line no-console
    console.warn('[comparison-payload] system-anchored validation errors:', validation.errors);
  }

  const rendered = renderComparisonPayload(payload);

  // Output validation
  const outputValidation = validateComparisonOutput(rendered.comparisonSummary);
  if (!outputValidation.valid) {
    // eslint-disable-next-line no-console
    console.warn('[comparison-output] system-anchored validation errors:', outputValidation.errors);
  }

  return { body: rendered.comparisonSummary, followUp: rendered.followUp };
}

/**
 * Build a ComparisonPayload for a system-anchored comparison
 * (system context already provided, e.g. speaker for amp comparison).
 */
export function buildSystemAnchoredPayload(
  nameA: string, infoA: BrandInfo,
  nameB: string, infoB: BrandInfo,
  contextName: string, contextInfo: BrandInfo | null,
  contextKind: ContextKind,
  contextMessage: string,
): ComparisonPayload {
  const charA = extractCoreCharacter(infoA.tendencies);
  const charB = extractCoreCharacter(infoB.tendencies);
  const contextChar = contextInfo ? extractCoreCharacter(contextInfo.tendencies) : null;

  // ── Sides ──────────────────────────────────────────
  const sideA: ComparisonSide = {
    name: nameA,
    character: charA,
    designPhilosophy: takeSentences(infoA.philosophy, 2),
    sonicTraits: extractSonicTraits(infoA.tendencies),
    systemInteraction: buildSystemInteractionNote(nameA, infoA, contextName, contextInfo, contextKind),
  };

  const sideB: ComparisonSide = {
    name: nameB,
    character: charB,
    designPhilosophy: takeSentences(infoB.philosophy, 2),
    sonicTraits: extractSonicTraits(infoB.tendencies),
    systemInteraction: buildSystemInteractionNote(nameB, infoB, contextName, contextInfo, contextKind),
  };

  // ── System anchor ──────────────────────────────────
  const anchorStatement = buildAnchorStatement(nameA, nameB, contextName, contextChar, contextKind);

  // ── Trade-off ──────────────────────────────────────
  const dominantA = detectDominantAxis(charA, infoA.tendencies);
  const dominantB = detectDominantAxis(charB, infoB.tendencies);
  const flowScoreA = scoreKeywords(charA + ' ' + infoA.tendencies, ['flow', 'elastic', 'alive', 'rhythmic', 'drive']);
  const flowScoreB = scoreKeywords(charB + ' ' + infoB.tendencies, ['flow', 'elastic', 'alive', 'rhythmic', 'drive']);
  const tradeoffAxis = computeTradeoffAxis(dominantA, dominantB, flowScoreA, flowScoreB);
  const [labelA, labelB] = TRADEOFF_LABELS[tradeoffAxis];

  // System-specific trade-off statement
  const systemTradeoffText = buildSystemTradeoff(nameA, charA, infoA, nameB, charB, infoB, contextName, contextChar);
  // Generic trade-off for the axis
  const tradeoffStatement = buildTradeoffStatement(nameA, charA, infoA.tendencies, nameB, charB, infoB.tendencies);

  // ── Taste frame ────────────────────────────────────
  const explicitTaste = buildTasteDecisionFrame(
    contextMessage, nameA, charA, infoA.tendencies, nameB, charB, infoB.tendencies,
  );
  const tasteStatement = explicitTaste ?? buildProvisionalTasteInference(nameA, charA, nameB, charB);

  // ── Decision ───────────────────────────────────────
  const decisionText = buildDecisionGuidance(nameA, charA, infoA, nameB, charB, infoB, contextName, contextInfo, contextKind);
  const decisionLines = decisionText.split('\n').filter((l) => l.trim());
  const decision: ComparisonDecision = {
    chooseAIf: decisionLines[0]?.trim() || `If you want ${labelA} → **${nameA}**`,
    chooseBIf: decisionLines[1]?.trim() || `If you want ${labelB} → **${nameB}**`,
  };

  // Light recommendation from known pairings
  const lightRec = buildLightRecommendation(nameA, infoA, nameB, infoB, contextName, contextInfo, contextKind);
  if (lightRec) {
    decision.recommended = lightRec;
  }

  // ── Recommendation (always present) ────────────────
  // Use BrandProfile if available for richer recommendation
  const profileA = findBrandProfileByName(nameA);
  const profileB = findBrandProfileByName(nameB);
  const fullProfileA = profileA ?? { name: nameA, philosophy: infoA.philosophy, tendencies: infoA.tendencies };
  const fullProfileB = profileB ?? { name: nameB, philosophy: infoB.philosophy, tendencies: infoB.tendencies };

  const fullRec = buildComparisonRecommendation(
    nameA, charA, fullProfileA, nameB, charB, fullProfileB,
    contextName, contextChar,
  );
  if (!decision.recommended) {
    decision.recommended = fullRec.recommended;
  }
  decision.rationale = fullRec.rationale;

  // ── Shopping ───────────────────────────────────────
  const recommendedName = decision.recommended?.match(/\*\*(\w+)\*\*/)?.[1];
  const shopping = buildComparisonShopping(nameA, fullProfileA, nameB, fullProfileB, recommendedName);

  // ── Sources ────────────────────────────────────────
  const sources = buildComparisonSourceRefs(nameA, fullProfileA, nameB, fullProfileB, contextName);

  return {
    subject: `${nameA} vs ${nameB} — with ${contextName}`,
    sideA,
    sideB,
    tradeoff: {
      axis: tradeoffAxis,
      label: `${labelA} vs ${labelB}`,
      statement: tradeoffStatement,
    },
    tasteFrame: {
      source: explicitTaste ? 'explicit' : 'provisional',
      statement: tasteStatement,
    },
    decision,
    systemAnchor: {
      name: contextName,
      character: contextChar,
      anchorStatement,
    },
    systemTradeoff: systemTradeoffText ?? undefined,
    shopping,
    sources: sources.length > 0 ? sources : undefined,
  };
}

/**
 * Build system-anchored trade-off — the real choice in context.
 */
function buildSystemTradeoff(
  nameA: string, charA: string, infoA: BrandInfo,
  nameB: string, charB: string, infoB: BrandInfo,
  contextName: string, contextChar: string | null,
): string | null {
  if (!contextChar) return null;

  const contextWarm = /warm|rich|dense|harmonic|tonal/i.test(contextChar);
  const warmA = /warm|rich|dense|harmonic|tonal|lush|flowing|tube/i.test(charA + ' ' + infoA.tendencies);
  const warmB = /warm|rich|dense|harmonic|tonal|lush|flowing|tube/i.test(charB + ' ' + infoB.tendencies);
  const fastA = /fast|speed|lean|precise|transparent|control|analytical/i.test(charA + ' ' + infoA.tendencies);
  const fastB = /fast|speed|lean|precise|transparent|control|analytical/i.test(charB + ' ' + infoB.tendencies);

  if (contextWarm) {
    if (warmA && fastB) {
      return `With ${contextName}'s own warmth in the equation: ${nameA} compounds richness (lush but risks thickness), while ${nameB} provides counterbalance (precision against body). That's the real system-level trade-off.`;
    }
    if (warmB && fastA) {
      return `With ${contextName}'s own warmth in the equation: ${nameA} provides counterbalance (precision against body), while ${nameB} compounds richness (lush but risks thickness). That's the real system-level trade-off.`;
    }
  }

  return null;
}

/**
 * Build concise source references for comparison context.
 */
function buildComparisonSources(
  nameA: string, infoA: BrandInfo,
  nameB: string, infoB: BrandInfo,
  contextName: string, contextInfo: BrandInfo | null,
): string | null {
  const refs: string[] = [];

  // Check pairing notes for known references
  if (infoA.pairingNotes && contextName.split(/\s+/).some((w) =>
    w.length > 2 && infoA.pairingNotes!.toLowerCase().includes(w.toLowerCase()))) {
    refs.push(`${nameA} + ${contextName}: documented pairing with established track record`);
  }
  if (infoB.pairingNotes && contextName.split(/\s+/).some((w) =>
    w.length > 2 && infoB.pairingNotes!.toLowerCase().includes(w.toLowerCase()))) {
    refs.push(`${nameB} + ${contextName}: documented pairing with established track record`);
  }

  if (refs.length === 0) return null;
  return `*Sources: ${refs.join('. ')}.*`;
}

/** Anchor the comparison to the system component — "this is not a neutral comparison." */
function buildAnchorStatement(
  nameA: string, nameB: string,
  contextName: string, contextChar: string | null,
  contextKind: ContextKind,
): string {
  const componentType = contextKind === 'speaker' ? 'speaker' : 'amplifier';
  if (contextChar) {
    return `With ${contextName}, this is not a neutral comparison. ${contextName} tends toward ${contextChar} — that shifts the balance between ${nameA} and ${nameB}.`;
  }
  return `With ${contextName} as your ${componentType}, the comparison between ${nameA} and ${nameB} takes on a specific character.`;
}

/** Explain how one side of the comparison interacts with the context component. */
function buildSystemInteractionNote(
  name: string, info: BrandInfo,
  contextName: string, contextInfo: BrandInfo | null,
  contextKind: ContextKind,
): string {
  const char = extractCoreCharacter(info.tendencies);
  const contextChar = contextInfo ? extractCoreCharacter(contextInfo.tendencies) : null;

  // Check for known pairing match
  const pairingMentionsContext = info.pairingNotes
    && contextName.split(/\s+/).some((word) =>
      word.length > 2 && info.pairingNotes!.toLowerCase().includes(word.toLowerCase()));

  if (pairingMentionsContext) {
    return takeSentences(info.pairingNotes!, 2);
  }

  // Analyze complementary vs compounding interaction
  if (contextChar) {
    const bothWarm = /warm|rich|dense|lush/i.test(char) && /warm|rich|dense|lush/i.test(contextChar);
    const bothLean = /lean|fast|precise|speed|control/i.test(char) && /lean|fast|precise|speed|control/i.test(contextChar);
    const complementary = (/warm|rich|dense/i.test(char) && /lean|fast|precise|speed/i.test(contextChar))
      || (/lean|fast|precise|speed/i.test(char) && /warm|rich|dense/i.test(contextChar));

    if (bothWarm) {
      return `${name} tends toward ${char}. With ${contextName}'s own warmth, expect a tonally rich, dense presentation — possibly at the cost of some transient precision.`;
    }
    if (bothLean) {
      return `${name} tends toward ${char}. Combined with ${contextName}'s own lean character, the pairing may prioritise speed and transparency — watch for thinness.`;
    }
    if (complementary) {
      return `${name} tends toward ${char}. That's a complementary balance against ${contextName}'s tendencies — the system should sound coherent without overcorrection.`;
    }
  }

  // Fallback: use system context or tendencies
  if (info.systemContext) {
    return takeSentences(info.systemContext, 2);
  }
  return `${name} tends toward ${char}. How that interacts with ${contextName} depends on sensitivity and impedance behaviour.`;
}

/** Build "If you want X → choose A, If you want Y → choose B" decision guidance. */
function buildDecisionGuidance(
  nameA: string, charA: string, infoA: BrandInfo,
  nameB: string, charB: string, infoB: BrandInfo,
  contextName: string, contextInfo: BrandInfo | null,
  contextKind: ContextKind,
): string {
  // Determine the primary contrast axis
  const warmA = /warm|rich|dense|harmonic|tube|tonal/i.test(charA + ' ' + infoA.tendencies);
  const warmB = /warm|rich|dense|harmonic|tube|tonal/i.test(charB + ' ' + infoB.tendencies);
  const fastA = /fast|speed|lean|precise|transparent|control|damping/i.test(charA + ' ' + infoA.tendencies);
  const fastB = /fast|speed|lean|precise|transparent|control|damping/i.test(charB + ' ' + infoB.tendencies);

  const lines: string[] = [];

  if (warmA && fastB) {
    lines.push(`If you want harmonic richness and tonal density → **${nameA}**`);
    lines.push(`If you want speed, control, and transient precision → **${nameB}**`);
  } else if (warmB && fastA) {
    lines.push(`If you want speed, control, and transient precision → **${nameA}**`);
    lines.push(`If you want harmonic richness and tonal density → **${nameB}**`);
  } else {
    // Generic contrast
    lines.push(`If you want ${charA.toLowerCase()} → **${nameA}**`);
    lines.push(`If you want ${charB.toLowerCase()} → **${nameB}**`);
  }

  return lines.join('\n');
}

/** Provide a light recommendation when one pairing is clearly stronger.
 * This is the first-pass recommendation for system-anchored comparisons.
 * It feeds into decision.recommended and may be overridden by buildComparisonRecommendation.
 */
function buildLightRecommendation(
  nameA: string, infoA: BrandInfo,
  nameB: string, infoB: BrandInfo,
  contextName: string, contextInfo: BrandInfo | null,
  contextKind: ContextKind,
): string | null {
  // Check if either side has known pairing notes mentioning the context component
  const aMentionsContext = infoA.pairingNotes
    && contextName.split(/\s+/).some((word) =>
      word.length > 2 && infoA.pairingNotes!.toLowerCase().includes(word.toLowerCase()));
  const bMentionsContext = infoB.pairingNotes
    && contextName.split(/\s+/).some((word) =>
      word.length > 2 && infoB.pairingNotes!.toLowerCase().includes(word.toLowerCase()));

  if (aMentionsContext && !bMentionsContext) {
    return `The ${nameA} + ${contextName} pairing is well-documented — it's a known combination with a strong track record.`;
  }
  if (bMentionsContext && !aMentionsContext) {
    return `The ${nameB} + ${contextName} pairing is well-documented — it's a known combination with a strong track record.`;
  }

  // When both have documented pairings, don't return here — let buildComparisonRecommendation
  // produce a deeper system-aware recommendation instead.
  if (aMentionsContext && bMentionsContext) return null;

  return null;
}

// ── Recommendation, Shopping, Sources builders ────────
//
// These populate the final three sections of every comparison output.
// They read from BrandProfile data (links, pairingNotes, philosophy)
// and produce deterministic content — no LLM inference.

/**
 * Build a decisive recommendation with system-aware rationale.
 * Always returns a recommendation — this is mandatory for every comparison.
 *
 * Reasoning structure:
 *   1. What the system (or general listening context) already provides
 *   2. What each option changes about that
 *   3. The real trade-off at system level
 *   4. Decisive recommendation
 *
 * Avoids shallow "complements warmth" or "balances brightness" language.
 * Instead describes: preserving flow, increasing control, adding density,
 * sharpening articulation, improving emotional coherence.
 */
function buildComparisonRecommendation(
  nameA: string, charA: string,
  profileA: BrandProfile | { name: string; philosophy: string; tendencies: string },
  nameB: string, charB: string,
  profileB: BrandProfile | { name: string; philosophy: string; tendencies: string },
  contextName?: string,
  contextChar?: string | null,
): { recommended: string; rationale: string } {
  const warmKw = ['warm', 'rich', 'dense', 'harmonic', 'lush', 'musical', 'golden', 'tube-adjacent', 'saturated', 'tonal density', 'tonal body'];
  const preciseKw = ['controlled', 'composed', 'neutral', 'clean', 'precise', 'analytical', 'tight', 'restrained', 'cool', 'dry', 'damping'];
  // Session-affinity keywords — NOT the same as "flow" or "engagement."
  // Long-session ease comes from warmth, density, smoothness, relaxed timing.
  // Short-session impact comes from speed, precision, articulation, transient clarity.
  // "fast" and "speed" are impact traits, NOT ease traits.
  const easeKw = ['warm', 'dense', 'smooth', 'relaxed', 'ease', 'body', 'flowing', 'lush', 'organic', 'musical weight', 'fatigue'];
  const impactKw = ['fast', 'speed', 'precise', 'articulate', 'detailed', 'analytical', 'transient', 'resolving', 'transparent', 'clarity'];
  // Rhythmic flow — distinct from transient speed. Flow = elastic, alive, rhythmic, drive.
  // Speed/precision without these words is NOT flow.
  const flowKw = ['flow', 'elastic', 'alive', 'rhythmic', 'drive'];
  // Broader flow scoring for system-anchored comparisons where we're evaluating
  // what each component adds to the system (speed IS relevant there).
  const systemFlowKw = ['flow', 'elastic', 'alive', 'rhythmic', 'drive', 'fast', 'speed', 'timing'];
  const densityKw = ['dense', 'density', 'body', 'harmonic', 'saturated', 'lush', 'weight', 'presence', 'tonal'];

  const textA = charA + ' ' + profileA.tendencies;
  const textB = charB + ' ' + profileB.tendencies;
  const warmA = scoreKeywords(textA, warmKw);
  const warmB = scoreKeywords(textB, warmKw);
  const preciseA = scoreKeywords(textA, preciseKw);
  const preciseB = scoreKeywords(textB, preciseKw);
  // Use broader flow scoring for system-anchored, narrow for initial
  const flowA = contextName ? scoreKeywords(textA, systemFlowKw) : scoreKeywords(textA, flowKw);
  const flowB = contextName ? scoreKeywords(textB, systemFlowKw) : scoreKeywords(textB, flowKw);
  const densityA = scoreKeywords(textA, densityKw);
  const densityB = scoreKeywords(textB, densityKw);

  // ── System-anchored recommendation ────────────────
  if (contextName && contextChar) {
    const contextWarm = /warm|rich|dense|harmonic|tonal/i.test(contextChar);
    const contextLean = /lean|precise|controlled|neutral|analytical|cool/i.test(contextChar);
    const contextFlowing = /flow|rhythmic|alive|elastic|drive/i.test(contextChar);

    if (contextWarm) {
      // The speaker already provides warmth and tonal density.
      // The question is: what does each amplifier add or preserve?
      if (flowA > flowB && preciseA >= preciseB) {
        return {
          recommended: `With ${contextName} already providing warmth and tonal density, **${nameA}** preserves the speaker's natural flow while adding articulation and transient speed — the system stays musically alive without losing body.`,
          rationale: `${nameB} adds more harmonic saturation to an already warm speaker. That can be gorgeous at low volumes but risks congestion and reduced clarity on complex passages.`,
        };
      }
      if (flowB > flowA && preciseB >= preciseA) {
        return {
          recommended: `With ${contextName} already providing warmth and tonal density, **${nameB}** preserves the speaker's natural flow while adding articulation and transient speed — the system stays musically alive without losing body.`,
          rationale: `${nameA} adds more harmonic saturation to an already warm speaker. That can be gorgeous at low volumes but risks congestion and reduced clarity on complex passages.`,
        };
      }
      if (preciseA > preciseB) {
        return {
          recommended: `${contextName} already supplies warmth and harmonic richness. **${nameA}** sharpens articulation and grip without stripping that character — it increases clarity while the speaker holds the tonal center.`,
          rationale: `${nameB} doubles down on density, which some listeners love — but the system may sacrifice transient definition and dynamic contrast at higher levels.`,
        };
      }
      if (preciseB > preciseA) {
        return {
          recommended: `${contextName} already supplies warmth and harmonic richness. **${nameB}** sharpens articulation and grip without stripping that character — it increases clarity while the speaker holds the tonal center.`,
          rationale: `${nameA} doubles down on density, which some listeners love — but the system may sacrifice transient definition and dynamic contrast at higher levels.`,
        };
      }
      // Both warm — distinguish on flow vs density
      if (flowA > flowB) {
        return {
          recommended: `Both amplifiers lean warm with ${contextName}. **${nameA}** brings stronger rhythmic drive and elastic energy — the system breathes more. **${nameB}** adds weight and harmonic saturation.`,
          rationale: `The choice is rhythmic articulation (${nameA}) vs tonal immersion (${nameB}). With an already warm speaker, rhythmic drive tends to keep the system from sounding sluggish.`,
        };
      }
      if (flowB > flowA) {
        return {
          recommended: `Both amplifiers lean warm with ${contextName}. **${nameB}** brings stronger rhythmic drive and elastic energy — the system breathes more. **${nameA}** adds weight and harmonic saturation.`,
          rationale: `The choice is rhythmic articulation (${nameB}) vs tonal immersion (${nameA}). With an already warm speaker, rhythmic drive tends to keep the system from sounding sluggish.`,
        };
      }
    }

    if (contextLean) {
      if (warmA > warmB) {
        return {
          recommended: `${contextName} is already lean and controlled. **${nameA}** introduces tonal body and harmonic richness that the speaker doesn't provide on its own — the system gains emotional weight.`,
          rationale: `${nameB} keeps the system analytical, which rewards detail-focused listening but may feel sterile over long sessions.`,
        };
      }
      if (warmB > warmA) {
        return {
          recommended: `${contextName} is already lean and controlled. **${nameB}** introduces tonal body and harmonic richness that the speaker doesn't provide on its own — the system gains emotional weight.`,
          rationale: `${nameA} keeps the system analytical, which rewards detail-focused listening but may feel sterile over long sessions.`,
        };
      }
    }

    if (contextFlowing) {
      if (preciseA > preciseB) {
        return {
          recommended: `${contextName} already delivers rhythmic drive and dynamic life. **${nameA}** adds control and definition to that foundation — tightening the system without dampening its energy.`,
          rationale: `${nameB} may compound the flowing character — alive but potentially loose at the bottom end.`,
        };
      }
      if (preciseB > preciseA) {
        return {
          recommended: `${contextName} already delivers rhythmic drive and dynamic life. **${nameB}** adds control and definition to that foundation — tightening the system without dampening its energy.`,
          rationale: `${nameA} may compound the flowing character — alive but potentially loose at the bottom end.`,
        };
      }
    }
  }

  // ── Initial comparison (no system context) ────────
  const aDominant = warmA > preciseA ? 'warm' : preciseA > warmA ? 'precise' : 'mixed';
  const bDominant = warmB > preciseB ? 'warm' : preciseB > warmB ? 'precise' : 'mixed';

  // Session-affinity scores — determines whether traits align with ease or impact
  const easeA = scoreKeywords(textA, easeKw);
  const easeB = scoreKeywords(textB, easeKw);
  const impactA = scoreKeywords(textA, impactKw);
  const impactB = scoreKeywords(textB, impactKw);

  // Confidence gating — when the axis separation is narrow, soften the claim
  const warmPreciseSeparation = Math.abs(
    (aDominant === 'warm' ? warmA - preciseA : preciseA - warmA)
    + (bDominant === 'precise' ? preciseB - warmB : warmB - preciseB),
  );
  const highConfidence = warmPreciseSeparation >= 4;

  if (aDominant === 'warm' && bDominant === 'precise') {
    const warmName = nameA;
    const preciseName = nameB;
    const easeWinner = easeA > easeB ? warmName : preciseName;
    const isEaseAlignedWithWarm = easeWinner === warmName;

    if (highConfidence && isEaseAlignedWithWarm) {
      return {
        recommended: `In most systems, **${warmName}** is the more natural match unless you're explicitly chasing maximum control and neutrality.`,
        rationale: `${warmName} leans toward warmth, density, and listening ease — traits that tend to sustain comfort over long sessions. ${preciseName} prioritises speed and analytical resolution, which rewards focused critical listening but can narrow the range of recordings that feel enjoyable.`,
      };
    }
    // Low confidence or ease doesn't align with warm side → directional, not strong
    return {
      recommended: `**${warmName}** leans toward tonal density and ease; **${preciseName}** leans toward speed and resolution. Without knowing your system and priorities, either could be the right choice.`,
      rationale: `If you value warmth and long-session comfort → ${warmName}. If you value transient clarity and analytical detail → ${preciseName}. The difference is philosophical, not quality.`,
    };
  }
  if (bDominant === 'warm' && aDominant === 'precise') {
    const warmName = nameB;
    const preciseName = nameA;
    const easeWinner = easeB > easeA ? warmName : preciseName;
    const isEaseAlignedWithWarm = easeWinner === warmName;

    if (highConfidence && isEaseAlignedWithWarm) {
      return {
        recommended: `In most systems, **${warmName}** is the more natural match unless you're explicitly chasing maximum control and neutrality.`,
        rationale: `${warmName} leans toward warmth, density, and listening ease — traits that tend to sustain comfort over long sessions. ${preciseName} prioritises speed and analytical resolution, which rewards focused critical listening but can narrow the range of recordings that feel enjoyable.`,
      };
    }
    return {
      recommended: `**${warmName}** leans toward tonal density and ease; **${preciseName}** leans toward speed and resolution. Without knowing your system and priorities, either could be the right choice.`,
      rationale: `If you value warmth and long-session comfort → ${warmName}. If you value transient clarity and analytical detail → ${preciseName}. The difference is philosophical, not quality.`,
    };
  }

  // Both lean the same way — distinguish on flow vs density
  const flowInitA = scoreKeywords(textA, flowKw);
  const flowInitB = scoreKeywords(textB, flowKw);
  if (flowInitA > flowInitB) {
    return {
      recommended: `**${nameA}** brings stronger rhythmic drive — the music feels more elastic and alive. **${nameB}** offers more tonal weight and density.`,
      rationale: `${nameB} suits listeners who prioritise immersive harmonic saturation. ${nameA} suits listeners who value rhythmic articulation and dynamic phrasing.`,
    };
  }
  if (flowInitB > flowInitA) {
    return {
      recommended: `**${nameB}** brings stronger rhythmic drive — the music feels more elastic and alive. **${nameA}** offers more tonal weight and density.`,
      rationale: `${nameA} suits listeners who prioritise immersive harmonic saturation. ${nameB} suits listeners who value rhythmic articulation and dynamic phrasing.`,
    };
  }

  // True tie — directional only, no strong claim
  return {
    recommended: `Both are strong choices with different strengths — **${nameA}** leans toward ${charA.toLowerCase()}, **${nameB}** toward ${charB.toLowerCase()}.`,
    rationale: `The right choice depends on whether you prioritise ${charA.toLowerCase()} or ${charB.toLowerCase()} in your system and with your music.`,
  };
}

/**
 * Build shopping pointers for comparison outputs.
 * Prioritises actionable buying links: HiFiShark, eBay, then dealer/official as fallback.
 *
 * Returns an array of shopping lines:
 *   - Primary recommendation with search link
 *   - Secondary path with search link
 *   - Optional dealer fallback (max 2 total alternatives)
 */
function buildComparisonShopping(
  nameA: string,
  profileA: BrandProfile | { name: string; philosophy: string; tendencies: string },
  nameB: string,
  profileB: BrandProfile | { name: string; philosophy: string; tendencies: string },
  recommendedName?: string,
): string[] {
  const lines: string[] = [];

  // Determine primary based on recommendation
  const primary = recommendedName === nameB ? nameB : nameA;
  const secondary = primary === nameA ? nameB : nameA;
  const primaryProfile = primary === nameA ? profileA : profileB;
  const secondaryProfile = secondary === nameA ? profileA : profileB;

  // Build HiFiShark and eBay search URLs
  const hifisharkUrl = (name: string) => `https://www.hifishark.com/search?q=${encodeURIComponent(name)}`;
  const ebayUrl = (name: string) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(name + ' amplifier')}`;

  // Primary recommendation — HiFiShark first, eBay second
  lines.push(`- **${primary}** — primary recommendation. Search: [HiFiShark](${hifisharkUrl(primary)}), [eBay](${ebayUrl(primary)})`);

  // Secondary path
  lines.push(`- **${secondary}** — alternative if your priorities differ. Search: [HiFiShark](${hifisharkUrl(secondary)}), [eBay](${ebayUrl(secondary)})`);

  // Dealer fallback (max 2 more lines total)
  let dealerCount = 0;
  for (const [name, profile] of [[primary, primaryProfile], [secondary, secondaryProfile]] as const) {
    if (dealerCount >= 2) break;
    const dealerLink = 'links' in profile
      ? (profile as BrandProfile).links?.find((l) => l.kind === 'dealer')
      : undefined;
    if (dealerLink) {
      lines.push(`- ${dealerLink.label} — [${dealerLink.url}](${dealerLink.url})`);
      dealerCount++;
    }
  }

  return lines;
}

/**
 * Known editorial / review outlets that represent expert-level sources.
 * Used to generate source references from brand tendencies and pairing notes.
 *
 * Each entry maps a brand name pattern to the outlets that have published
 * notable coverage of that brand. This is curated data — not a web scrape.
 */
const EDITORIAL_SOURCES: Array<{
  brandPattern: RegExp;
  sources: Array<{ outlet: string; note: string }>;
}> = [
  {
    brandPattern: /\bjob\b/i,
    sources: [
      { outlet: '6moons', note: 'JOB INTegrated review — Goldmund-derived circuit analysis' },
      { outlet: 'Darko.Audio', note: 'JOB 225 coverage — compact high-current amplification' },
    ],
  },
  {
    brandPattern: /\bleben\b/i,
    sources: [
      { outlet: '6moons', note: 'Leben CS600X review — push-pull KT77/KT88 tube integrated' },
      { outlet: 'Stereophile', note: 'Leben CS600 coverage — tube amplifier design philosophy' },
      { outlet: 'Tone Imports', note: 'US distributor — Leben product notes and system pairing guidance' },
    ],
  },
  {
    brandPattern: /\bhegel\b/i,
    sources: [
      { outlet: 'Stereophile', note: 'Hegel H390/H590 reviews — SoundEngine technology analysis' },
      { outlet: 'Darko.Audio', note: 'Hegel integrated amplifier coverage — streaming DAC integration' },
      { outlet: 'The Audiophiliac', note: 'Hegel amplifier impressions — value and performance assessment' },
    ],
  },
  {
    brandPattern: /\bdevore\b/i,
    sources: [
      { outlet: '6moons', note: 'DeVore Fidelity O/96 review — high-efficiency speaker design' },
      { outlet: 'Stereophile', note: 'DeVore O/96 measurements and listening impressions' },
    ],
  },
  {
    brandPattern: /\bkef\b/i,
    sources: [
      { outlet: 'Stereophile', note: 'KEF speaker reviews — Uni-Q driver technology' },
      { outlet: 'The Audiophiliac', note: 'KEF speaker coverage — value assessment' },
    ],
  },
  {
    brandPattern: /\belac\b/i,
    sources: [
      { outlet: 'Stereophile', note: 'ELAC speaker reviews — Andrew Jones designs' },
      { outlet: 'Darko.Audio', note: 'ELAC coverage — accessible audiophile speakers' },
    ],
  },
  {
    brandPattern: /\bshindo\b/i,
    sources: [
      { outlet: '6moons', note: 'Shindo Laboratory reviews — tube amplification heritage' },
    ],
  },
  {
    brandPattern: /\btotaldac\b/i,
    sources: [
      { outlet: '6moons', note: 'TotalDAC reviews — discrete R2R ladder DAC analysis' },
    ],
  },
];

/**
 * Build source reference lines for comparison outputs.
 * Prioritises editorial / review sources (6moons, Stereophile, Darko.Audio, etc.).
 * Official brand websites are fallback only.
 *
 * Returns 2-3 short reference strings.
 */
function buildComparisonSourceRefs(
  nameA: string,
  profileA: BrandProfile | { name: string; philosophy: string; tendencies: string },
  nameB: string,
  profileB: BrandProfile | { name: string; philosophy: string; tendencies: string },
  contextName?: string,
): string[] {
  const refs: string[] = [];
  const usedOutlets = new Set<string>();

  // 1. Editorial sources — highest priority
  for (const entry of EDITORIAL_SOURCES) {
    if (refs.length >= 3) break;
    const matchesA = entry.brandPattern.test(nameA);
    const matchesB = entry.brandPattern.test(nameB);
    const matchesContext = contextName && entry.brandPattern.test(contextName);

    if (matchesA || matchesB || matchesContext) {
      for (const src of entry.sources) {
        if (refs.length >= 3) break;
        if (usedOutlets.has(src.outlet)) continue;
        refs.push(`${src.outlet} — ${src.note}`);
        usedOutlets.add(src.outlet);
      }
    }
  }

  // 2. Documented pairing references (when system context present)
  if (contextName && refs.length < 3) {
    const pairingA = 'pairingNotes' in profileA ? (profileA as BrandProfile).pairingNotes : undefined;
    const pairingB = 'pairingNotes' in profileB ? (profileB as BrandProfile).pairingNotes : undefined;

    if (pairingA && contextName.split(/\s+/).some((w) => w.length > 2 && pairingA.toLowerCase().includes(w.toLowerCase()))) {
      if (!refs.some((r) => r.includes(nameA) && r.includes(contextName))) {
        refs.push(`${nameA} + ${contextName} — documented pairing, community track record`);
      }
    }
    if (refs.length < 3 && pairingB && contextName.split(/\s+/).some((w) => w.length > 2 && pairingB.toLowerCase().includes(w.toLowerCase()))) {
      if (!refs.some((r) => r.includes(nameB) && r.includes(contextName))) {
        refs.push(`${nameB} + ${contextName} — documented pairing, community track record`);
      }
    }
  }

  // 3. Review links from brand profiles (still editorial, not official)
  if (refs.length < 2) {
    const reviewLinksA = 'links' in profileA
      ? (profileA as BrandProfile).links?.filter((l) => l.kind === 'review') ?? []
      : [];
    const reviewLinksB = 'links' in profileB
      ? (profileB as BrandProfile).links?.filter((l) => l.kind === 'review') ?? []
      : [];
    for (const link of [...reviewLinksA, ...reviewLinksB].slice(0, 3 - refs.length)) {
      refs.push(`${link.label} — ${nameA} review`);
    }
  }

  // 4. Fallback — official/dealer links only if we have nothing better
  if (refs.length < 2) {
    const allLinks = [
      ...('links' in profileA ? (profileA as BrandProfile).links ?? [] : []),
      ...('links' in profileB ? (profileB as BrandProfile).links ?? [] : []),
    ];
    for (const link of allLinks) {
      if (refs.length >= 3) break;
      if (link.kind === 'dealer') {
        refs.push(`${link.label} — dealer/distributor`);
      }
    }
  }

  return refs.slice(0, 3);
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
    case 'speaker': {
      const cleaned = text.replace(/^(?:my\s+)?speakers?\s+(?:are?|is)\s+(?:the?\s+)?/i, '').trim();
      return cleaned.length > 0 && cleaned.length < 40 ? `with ${cleaned}` : 'speaker context';
    }
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

/** Build a follow-up question appropriate to the context just provided.
 *  Note: speaker/amplifier context follow-ups are handled by the
 *  system-anchored decision path — this is the fallback for non-anchorable contexts.
 */
function buildContextFollowUp(
  contextKind: ContextKind,
  _infoA?: BrandInfo | null,
  _infoB?: BrandInfo | null,
): string {
  switch (contextKind) {
    case 'amplifier':
    case 'power':
      // The user just told us their amp — don't ask for more system info.
      return 'What matters most to you — tonal body and engagement, or speed and clarity?';
    case 'speaker':
      // The user just told us their speaker — don't ask for amplifier.
      return 'What matters most to you — tonal body and engagement, or speed and clarity?';
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

// ── Subject-to-context classification ─────────────────
//
// When an active comparison exists and the user answers with a bare
// product/brand name (e.g. "devore o96" in response to "What are you
// pairing it with?"), we need to classify that subject as a ContextKind
// so buildContextRefinement can generate an appropriate response.

/**
 * Classify a bare product/brand answer as a ContextKind for
 * comparison refinement. Looks up the product catalog to determine
 * category; falls back to brand profile heuristics.
 */
export function classifySubjectAsContext(
  subjectMatches: SubjectMatch[],
): ContextKind {
  for (const match of subjectMatches) {
    const lower = match.name.toLowerCase();

    // 1. Check product catalog for exact category
    const product = ALL_PRODUCTS.find(
      (p) => lower.includes(p.name.toLowerCase()) || lower.includes(p.brand.toLowerCase()),
    );
    if (product) {
      switch (product.category) {
        case 'speaker': return 'speaker';
        case 'amplifier': return 'amplifier';
        case 'dac': return 'general_system';
        case 'turntable': return 'general_system';
        case 'streamer': return 'general_system';
      }
    }

    // 2. Check brand profiles — brand philosophy often reveals category
    const profile = findBrandProfile(match.name);
    if (profile) {
      const phil = profile.philosophy.toLowerCase();
      if (phil.includes('speaker') || phil.includes('loudspeaker')) return 'speaker';
      if (phil.includes('amplif') || phil.includes('integrated')) return 'amplifier';
    }
  }

  return 'general_system';
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
    return `Both can work with ${ampType}, but they respond differently — the interaction depends on specific amplifier characteristics and the rest of the system.`;
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
  pairingNotes?: string;
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
      pairingNotes: profile.pairingNotes,
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
  activeSystem?: { components: Array<{ brand: string; name: string; category?: string }> } | null,
): ConsultationResponse | null {
  if (activeConsultation.subjects.length === 0) return null;

  const primarySubject = activeConsultation.subjects[0];
  const subjectName = capitalize(primarySubject.name);
  const kind = classifyFollowUp(followUpMessage);

  // Blocker fix §2: render saved-system components inline when the user
  // asks a fit question with no gear named in the current turn. Without
  // this, "would it fit my system?" gets answered generically even when
  // the user has a saved system waiting to be referenced.
  const savedSystemRender: string | null = activeSystem && activeSystem.components.length > 0
    ? activeSystem.components
        .map((c) => {
          const b = (c.brand || '').trim();
          const n = (c.name || '').trim();
          if (!b) return n || 'Unknown';
          if (!n) return b;
          if (n.toLowerCase().startsWith(b.toLowerCase())) return n;
          return `${b} ${n}`;
        })
        .slice(0, 4)
        .join(', ')
    : null;

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
          : 'Specific sonic performance depends on the rest of the system — amplifier character, room, and source all shape the final result.',
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

      // Blocker fix §2: when a saved system is active, ground the fit
      // assessment in the user's actual chain rather than asking them
      // to describe it.
      const groundedContextualNote = savedSystemRender
        ? `${contextualNote} Against your saved system (${savedSystemRender}), this would interact with your existing system — worth weighing how the new character compounds or counterbalances what you already have.`
        : contextualNote;
      const groundedFollowUp = savedSystemRender
        ? 'Want me to walk through how this would interact with each component in your saved system?'
        : mentionsTubes
          ? 'Which tube amp are you using — or are you choosing one?'
          : 'What else is in your system?';

      return {
        subject: subjectName,
        philosophy: groundedContextualNote,
        tendencies: pairingNotes && !mentionsTubes
          ? takeSentences(pairingNotes, 2)
          : 'How well it fits depends on what the rest of the system brings — amplifier topology, source character, and room all interact.',
        followUp: groundedFollowUp,
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
  /** Primary component role (dac, amplifier, speaker, etc). */
  role: string;
  /**
   * All functional roles this component fulfills in the system.
   * E.g., Bluesound Node → ['streamer', 'dac'].
   * Always contains at least the primary role.
   */
  roles: string[];
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

// ── Multi-role resolution ────────────────────────────
//
// Centralised inference of all functional roles a component fulfils.
// Sources (in priority order):
//   1. Explicit Product.roles when present in catalog data
//   2. Subcategory → roles mapping (e.g. 'dac-preamp' → ['dac', 'preamp'])
//   3. Known multi-role product overrides (e.g. Bluesound Node)
//   4. Fallback: [primaryRole]

/**
 * Catalog lookup aliases: when the user mentions a product that doesn't
 * have its own catalog entry but is part of a documented family, alias
 * the lookup to the family's representative entry. This prevents
 * recommendation drift when the only difference is a suffix (e.g.
 * Bluesound NODE vs NODE X — same brand, same family, only the latter
 * has a catalog entry today).
 *
 * Keys and values are the normalized lowercase forms used by catalog
 * `name` and `${brand} ${name}` matches.
 *
 * Domain note: this is purely a name-resolution alias for catalog
 * lookup. It does not change role classification (already handled by
 * KNOWN_MULTI_ROLE_PRODUCTS) or the user-visible display name.
 */
const CATALOG_NAME_ALIASES: Record<string, string> = {
  'bluesound node': 'bluesound node x',
  node: 'node x',
  // Goldmund JOB → JOB: the JOB brand is a sub-brand of Goldmund.
  // Users may enter brand as "Goldmund" but the catalog lists brand as "JOB".
  'goldmund job integrated': 'job integrated',
  'job integrated': 'integrated',
};

// Brand aliases: maps parent-brand names to the catalog brand.
// Used when the user enters a parent brand but the catalog uses the sub-brand.
const BRAND_ALIASES: Record<string, string> = {
  goldmund: 'job',
};

/** Apply CATALOG_NAME_ALIASES to a normalized lookup key. */
function aliasCatalogLookup(key: string): string {
  return CATALOG_NAME_ALIASES[key] ?? key;
}

/** Known products whose functional roles differ from their primary category. */
const KNOWN_MULTI_ROLE_PRODUCTS: Record<string, string[]> = {
  'bluesound node':   ['streamer', 'dac'],
  'bluesound node x': ['streamer', 'dac'],
  'node':             ['streamer', 'dac'],
  'node x':           ['streamer', 'dac'],
  'wiim pro':         ['streamer', 'dac'],
  'wiim ultra':       ['streamer', 'dac'],
  'eversolo dmp-a6':  ['streamer', 'dac'],
  'dmp-a6':           ['streamer', 'dac'],
  'eversolo dmp-a8':  ['streamer', 'dac'],
  'dmp-a8':           ['streamer', 'dac'],
  'k9 pro':           ['dac', 'headphone_amp'],
  'ef400':            ['dac', 'headphone_amp'],
};

/** Subcategory → additional roles beyond the primary category. */
const SUBCATEGORY_ROLES: Record<string, string[]> = {
  'dac-preamp':    ['dac', 'preamp'],
  'dac-amp':       ['dac', 'headphone_amp'],
  'portable-dac':  ['dac', 'headphone_amp'],
  'integrated-amp': ['amplifier', 'preamp'],
};

/**
 * Resolve all functional roles for a component.
 *
 * Always returns an array containing at least the primary role.
 * The primary role is always the first element.
 */
export function resolveComponentRoles(
  primaryRole: string,
  product?: Product,
  displayName?: string,
): string[] {
  // 1. Explicit product roles take top priority
  if (product?.roles && product.roles.length > 0) {
    return product.roles;
  }

  // 2. Subcategory-based inference
  if (product?.subcategory) {
    const subcatRoles = SUBCATEGORY_ROLES[product.subcategory];
    if (subcatRoles) {
      return subcatRoles;
    }
  }

  // 3. Known multi-role product override (name-based)
  const nameLower = (displayName ?? product?.name ?? '').toLowerCase().trim();
  if (nameLower) {
    const knownRoles = KNOWN_MULTI_ROLE_PRODUCTS[nameLower];
    if (knownRoles) {
      return knownRoles;
    }
    // Also try brand + name combined
    if (product?.brand) {
      const fullName = `${product.brand} ${product.name}`.toLowerCase().trim();
      const knownFullRoles = KNOWN_MULTI_ROLE_PRODUCTS[fullName];
      if (knownFullRoles) {
        return knownFullRoles;
      }
    }
  }

  // 4. Fallback: single-role array from primary
  return [primaryRole];
}

// ── Active DAC inference ─────────────────────────────
//
// Topology-based best guess for which DAC is active. NOT a confirmed
// signal path — the narrative layer treats it accordingly.
//
// Behaviour summary for maintainers:
//
//   • A component is DAC-capable when its roles[] (or fallback role)
//     includes 'dac'. Classification then sorts it into standalone,
//     integrated, or source based on what other roles it carries.
//
//   • Priority: standalone (3) > integrated (2) > source (1).
//     All-in-one units (dac + amp + streamer) classify as integrated.
//
//   • Confidence is high only when exactly one DAC-capable component
//     exists and its role data is clean (roles[] present and non-empty).
//
//   • Confidence is medium when multiple DACs exist but priority
//     cleanly selects one and no role data is degraded.
//
//   • Confidence is low on same-priority ties, missing/empty roles[],
//     or unrecognised co-roles. Low confidence always sets
//     needsDACClarification = true (unless there are zero DAC-capable
//     components — that is incomplete input, not ambiguity).
//
//   • Single-DAC systems produce no narrative note. The DAC note only
//     appears when multipleDACs is true or needsDACClarification is true.
//
//   • Narrative wording scales with confidence: "uses" (high),
//     "likely uses… If…" (medium), "unclear" (low).

/** Patterns for classifying DAC-hosting components.
 *  headphone_amp is excluded — a DAC with a headphone output (Chord Hugo,
 *  RME ADI-2) is still a standalone DAC, not an integrated amplifier. */
const AMP_ROLES_RE = /\b(amp|amplifier|integrated|preamp)\b/i;
const SOURCE_ROLES_RE = /\b(streamer|transport|cd|cdp|network|player|digital)\b/i;

type DACHostType = 'standalone' | 'integrated' | 'source';

/**
 * Safely extract a normalised role list from a component.
 * Uses `roles[]` when present and non-empty, falls back to `[role]`,
 * and returns `['component']` as a last resort. Never throws.
 */
function safeRoles(c: { role?: string; roles?: string[] }): string[] {
  if (Array.isArray(c.roles) && c.roles.length > 0) return c.roles;
  if (typeof c.role === 'string' && c.role) return [c.role];
  return ['component'];
}

/**
 * Classify a DAC-capable component by what else it does.
 *
 * Classification rules (strict):
 * - standalone: has `dac`, does NOT have amp/integrated/streamer roles
 * - integrated: has `dac` AND has amp/integrated roles
 *   (all-in-one dac+amp+streamer also classifies as integrated)
 * - source: has `dac` AND has streamer/source AND does NOT have amp/integrated
 *
 * Returns `{ hostType, degraded }` where `degraded` is true when
 * classification relied on fallback heuristics (e.g. missing roles[]).
 */
function classifyDACHost(c: { role?: string; roles?: string[] }): { hostType: DACHostType; degraded: boolean } {
  const roles = safeRoles(c);
  const hasDac = roles.some((r) => r.toLowerCase() === 'dac');
  if (!hasDac) return { hostType: 'standalone', degraded: true }; // shouldn't happen — caller filters

  const otherRoles = roles.filter((r) => r.toLowerCase() !== 'dac');
  const hasAmp = otherRoles.some((r) => AMP_ROLES_RE.test(r));
  const hasSource = otherRoles.some((r) => SOURCE_ROLES_RE.test(r));

  // Integrated wins over source when both present (all-in-one units)
  if (hasAmp) return { hostType: 'integrated', degraded: false };
  if (hasSource) return { hostType: 'source', degraded: false };

  // No other recognised role — check primary `role` as fallback
  const primaryRole = (typeof c.role === 'string' ? c.role : '').toLowerCase();
  if (AMP_ROLES_RE.test(primaryRole)) return { hostType: 'integrated', degraded: true };
  if (SOURCE_ROLES_RE.test(primaryRole)) return { hostType: 'source', degraded: true };

  // Pure DAC with no other roles
  if (otherRoles.length === 0) return { hostType: 'standalone', degraded: false };

  // Unrecognised co-roles — treat as standalone but flag degraded
  return { hostType: 'standalone', degraded: true };
}

/** Priority: standalone > integrated > source. */
const DAC_PRIORITY: Record<DACHostType, number> = {
  standalone: 3,
  integrated: 2,
  source: 1,
};

/**
 * Infer which DAC-capable component is most likely active.
 *
 * This is a topology-based best guess, not a confirmed signal path.
 * Accepts SystemComponent[] so it can run at any pipeline stage.
 *
 * Rules:
 *   1. Standalone DAC wins over all others
 *   2. Integrated amp DAC beats source DAC
 *   3. Single DAC → use it
 *   4. Tie at same level → needsDACClarification
 *
 * Confidence:
 *   - high: exactly one DAC-capable component
 *   - medium: multiple DACs, priority cleanly selects one
 *   - low: same-priority tie, malformed data, or classification ambiguity
 */
export function inferActiveDAC(components: SystemComponent[]): ActiveDACInference {
  // Defensive: handle null/undefined components array.
  // This is incomplete input, not DAC-path ambiguity → needsDACClarification stays false.
  if (!Array.isArray(components) || components.length === 0) {
    return { activeDACName: null, activeDACType: null, multipleDACs: false, needsDACClarification: false, confidence: 'low' };
  }

  // Find all DAC-capable components using safe role extraction.
  //
  // Degradation is tracked at two independent levels and OR'd together:
  //
  //   1. safeRoles fallback — roles[] was missing or empty, so we fell back
  //      to [role] or ['component']. This must degrade confidence because
  //      the single-string `role` field cannot represent multi-role products.
  //      A streamer/DAC combo with only `role: 'dac'` looks like a standalone
  //      DAC, which would silently produce wrong classification and a
  //      misleadingly confident result.
  //
  //   2. classifyDACHost degradation — the roles[] data existed but contained
  //      unrecognised co-roles, or classification had to fall back to the
  //      primary `role` string.
  //
  const dacCapable: { component: SystemComponent; hostType: DACHostType; degraded: boolean; priority: number }[] = [];
  for (const c of components) {
    const rolesFellBack = !Array.isArray(c.roles) || c.roles.length === 0;
    const roles = safeRoles(c);
    const hasDac = roles.some((r) => r.toLowerCase() === 'dac');
    if (hasDac) {
      const { hostType, degraded: classifyDegraded } = classifyDACHost(c);
      dacCapable.push({ component: c, hostType, degraded: rolesFellBack || classifyDegraded, priority: DAC_PRIORITY[hostType] });
    }
  }

  // No DAC-capable component in the system.
  // Not ambiguity — just no DAC. Low confidence because we can't say anything useful.
  if (dacCapable.length === 0) {
    return { activeDACName: null, activeDACType: null, multipleDACs: false, needsDACClarification: false, confidence: 'low' };
  }

  // Single DAC — high confidence unless classification was degraded
  if (dacCapable.length === 1) {
    const d = dacCapable[0];
    const confidence = d.degraded ? 'low' as const : 'high' as const;
    return {
      activeDACName: d.component.displayName,
      activeDACType: d.hostType,
      multipleDACs: false,
      // Degraded single-DAC = low confidence = the user may need to clarify
      needsDACClarification: confidence === 'low',
      confidence,
    };
  }

  // Multiple DACs — rank by host type priority
  const anyDegraded = dacCapable.some((d) => d.degraded);
  const ranked = [...dacCapable].sort((a, b) => b.priority - a.priority);

  const topPriority = ranked[0].priority;
  const topTied = ranked.filter((r) => r.priority === topPriority);

  if (topTied.length > 1) {
    // Same-priority tie — low confidence, needs clarification
    return {
      activeDACName: null,
      activeDACType: null,
      multipleDACs: true,
      needsDACClarification: true,
      confidence: 'low',
    };
  }

  // Clear priority winner
  const winner = ranked[0];
  const confidence = anyDegraded ? 'low' as const : 'medium' as const;
  return {
    activeDACName: winner.component.displayName,
    activeDACType: winner.hostType,
    multipleDACs: true,
    // needsDACClarification = true whenever confidence is low and DACs exist
    needsDACClarification: confidence === 'low',
    confidence,
  };
}

// ── Amp/speaker power-match assessment ───────────────
//
// Deterministic assessment of whether an amplifier can physically
// drive the speakers to adequate listening levels.
//
// Behaviour summary for maintainers:
//
//   • Uses power_watts (amp) and sensitivity_db (speaker) from Product.
//     Both are optional — when either is missing, compatibility is 'unknown'
//     and the assessment produces no narrative output.
//
//   • Estimated max clean SPL = sensitivity_db + 10 * log10(power_watts).
//     This is a simplified model (anechoic, no room gain) that provides
//     a useful directional signal, not a precise prediction.
//
//   • Compatibility tiers:
//       optimal:    estimated SPL ≥ 100 dB (ample headroom)
//       adequate:   estimated SPL ≥ 95 dB  (comfortable listening, limited peaks)
//       strained:   estimated SPL ≥ 90 dB  (dynamics compress at moderate levels)
//       mismatched: estimated SPL < 90 dB   (amp cannot deliver adequate levels)
//
//   • When the amp's interactions[] array contains a condition that
//     references the speaker's efficiency range, the matching interaction
//     note is surfaced in the assessment.
//
//   • Integrates as a constraint candidate in detectPrimaryConstraint()
//     with severity 6 (strained) or 9 (mismatched), outranking most
//     axis-based constraints because power mismatch is more fundamental.

type PowerMatchCompatibility = PowerMatchAssessment['compatibility'];

/**
 * Classify the power match between an amp and a speaker.
 *
 * @param powerWatts   Amp power output in watts (null if unknown)
 * @param sensitivityDb Speaker sensitivity in dB (null if unknown)
 * @returns Compatibility tier and estimated max clean SPL
 */
function classifyPowerMatch(
  powerWatts: number | null,
  sensitivityDb: number | null,
): { compatibility: PowerMatchCompatibility; estimatedMaxCleanSPL: number | null } {
  if (powerWatts == null || sensitivityDb == null || powerWatts <= 0) {
    return { compatibility: 'unknown', estimatedMaxCleanSPL: null };
  }

  const estimatedSPL = sensitivityDb + 10 * Math.log10(powerWatts);

  if (estimatedSPL >= 100) return { compatibility: 'optimal', estimatedMaxCleanSPL: estimatedSPL };
  if (estimatedSPL >= 95)  return { compatibility: 'adequate', estimatedMaxCleanSPL: estimatedSPL };
  if (estimatedSPL >= 90)  return { compatibility: 'strained', estimatedMaxCleanSPL: estimatedSPL };
  return { compatibility: 'mismatched', estimatedMaxCleanSPL: estimatedSPL };
}

/**
 * Search the amp's interactions for a note matching the speaker's
 * efficiency range. Returns the interaction effect text, or null.
 */
function surfaceAmpSpeakerInteraction(
  ampProduct: Product | undefined,
  speakerSensitivityDb: number | null,
): string | null {
  if (!ampProduct || speakerSensitivityDb == null) return null;
  const interactions = ampProduct.tendencies?.interactions;
  if (!interactions || interactions.length === 0) return null;

  // Look for interactions whose condition references efficiency/sensitivity
  // thresholds that match this speaker
  for (const ix of interactions) {
    const cond = ix.condition.toLowerCase();
    // Match patterns like "94dB+", "90dB+", "88dB+", "85dB+"
    const dbMatch = cond.match(/(\d{2,3})\s*db\s*\+?\)?/);
    if (dbMatch) {
      const threshold = parseInt(dbMatch[1], 10);
      if (ix.valence === 'positive' && speakerSensitivityDb >= threshold) {
        return ix.effect;
      }
      if (ix.valence === 'caution' && speakerSensitivityDb < threshold) {
        return ix.effect;
      }
    }
    // Match "below NNdB" or "<NNdB" patterns
    const belowMatch = cond.match(/below\s+(\d{2,3})\s*db|<\s*(\d{2,3})\s*db/);
    if (belowMatch) {
      const threshold = parseInt(belowMatch[1] || belowMatch[2], 10);
      if (speakerSensitivityDb < threshold) {
        return ix.effect;
      }
    }
    // Match "low-efficiency" or "low-impedance" general patterns
    if (
      (cond.includes('low-efficiency') || cond.includes('low-impedance'))
      && speakerSensitivityDb < 88
    ) {
      return ix.effect;
    }
    // Match "high-efficiency" general patterns
    if (cond.includes('high-efficiency') && speakerSensitivityDb >= 92) {
      return ix.effect;
    }
  }
  return null;
}

/**
 * Assess amp/speaker power match for a system.
 *
 * Finds the primary amplifier and primary speaker, reads their
 * power_watts and sensitivity_db fields, and classifies compatibility.
 * When no amp or no speaker exists, returns an 'unknown' assessment.
 */
export function assessPowerMatch(components: SystemComponent[]): PowerMatchAssessment {
  // Find the primary amplifier (prefer integrated > power amp > headphone amp)
  const ampCandidates = components.filter((c) => {
    const role = c.role.toLowerCase();
    return role.includes('amp') || role.includes('integrated');
  });
  // Exclude headphone amps when speakers are present
  const hasSpeakers = components.some((c) => c.role.toLowerCase().includes('speak'));
  const amp = hasSpeakers
    ? ampCandidates.find((c) => !c.role.toLowerCase().includes('headphone'))
      ?? ampCandidates[0]
    : ampCandidates[0];

  // Find the primary speaker
  const speaker = components.find((c) => c.role.toLowerCase().includes('speak'));

  if (!amp || !speaker) {
    return {
      ampName: amp?.displayName ?? null,
      speakerName: speaker?.displayName ?? null,
      ampPowerWatts: amp?.product?.power_watts ?? null,
      speakerSensitivityDb: speaker?.product?.sensitivity_db ?? null,
      compatibility: 'unknown',
      estimatedMaxCleanSPL: null,
      relevantInteraction: null,
    };
  }

  const powerWatts = amp.product?.power_watts ?? null;
  const sensitivityDb = speaker.product?.sensitivity_db ?? null;
  const { compatibility, estimatedMaxCleanSPL } = classifyPowerMatch(powerWatts, sensitivityDb);
  const relevantInteraction = surfaceAmpSpeakerInteraction(amp.product, sensitivityDb);

  return {
    ampName: amp.displayName,
    speakerName: speaker.displayName,
    ampPowerWatts: powerWatts,
    speakerSensitivityDb: sensitivityDb,
    compatibility,
    estimatedMaxCleanSPL,
    relevantInteraction,
  };
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

/**
 * Explicit "<role>: <product>" colon labels. These are the unambiguous
 * signal that the user has asserted a role for a specific component, so
 * they take priority over nearby-keyword detection (QA residual R3 —
 * "streamer: eversolo dmp-a6" was being mis-read as amplifier because
 * the " - amp: job integrated -" phrase earlier in the chain bled into
 * the segment scan).
 *
 * The pattern matches `role:` at the start of the adjacent phrase —
 * typically the chunk between two chain separators.
 */
const USER_ROLE_COLON_PATTERNS: { pattern: RegExp; role: string }[] = [
  { pattern: /\bstream(?:er|ing)?\s*:/i, role: 'streamer' },
  { pattern: /\bdac\s*:/i, role: 'dac' },
  { pattern: /\bintegrated\s*:/i, role: 'integrated' },
  { pattern: /\bpre[- ]?amp(?:lifier)?\s*:/i, role: 'preamplifier' },
  { pattern: /\bamp(?:lifier)?\s*:/i, role: 'amplifier' },
  { pattern: /\bspeak(?:er)?s?\s*:/i, role: 'speaker' },
  { pattern: /\bheadphones?\s*:/i, role: 'headphone' },
  { pattern: /\bturntable\s*:/i, role: 'turntable' },
  { pattern: /\btone\s*arm\s*:/i, role: 'tonearm' },
  { pattern: /\bcartridge\s*:/i, role: 'cartridge' },
  { pattern: /\bphono\s*:/i, role: 'phono' },
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
  // (arrows, "into", commas, " - ") around the product name. This prevents
  // role keywords attached to other products from being picked up.
  //
  // " - " (whitespace-hyphen-whitespace) was added as a separator so that
  // labelled chains like "speakers: X - amp: Y - streamer: Z" segment
  // correctly and a trailing "streamer:" doesn't collide with an earlier
  // "amp:" label (QA residual R3).
  const SEP = /(?:\s*(?:→|—>|-{1,3}>|={1,2}>|>{2,3})\s*|\s+into\s+|\s*,\s*|\s+-\s+)/g;
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

  // Explicit colon-labeled role wins over nearby keyword detection.
  // "streamer: eversolo dmp-a6" is an unambiguous user assertion.
  for (const { pattern, role } of USER_ROLE_COLON_PATTERNS) {
    if (pattern.test(segment)) return role;
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
          detail: `You described the ${c.displayName} as ${userRoleDisplay}, but our data has it as ${expectedDisplay}. What role does it play in your system?`,
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
  //
  // Suppress when all components have distinct, well-known roles (dac, amplifier,
  // speaker, streamer, etc.) — the canonical signal path is inferrable even without
  // explicit ordering notation. This avoids unnecessary clarification friction for
  // natural phrasing like "I have a X DAC, Y amp, and Z speakers."
  const ambiguityExtracted = chainExtracted ?? extractFullChain(rawMessage);
  if (ambiguityExtracted && ambiguityExtracted.confidence === 'medium') {
    const knownSignalRoles = new Set(['dac', 'amplifier', 'speaker', 'streamer', 'turntable', 'phono', 'preamp', 'integrated']);
    const allRolesKnown = components.every((c) => knownSignalRoles.has(c.role));
    const allRolesDistinct = new Set(components.map((c) => c.role)).size === components.length;

    if (!allRolesKnown || !allRolesDistinct) {
      const canonicalAttempt = tryCanonicalOrder(ambiguityExtracted.segments);
      if (!canonicalAttempt) {
        issues.push({
          kind: 'chain-order-ambiguity',
          subject: 'signal path order',
          detail: 'I\'m not confident about the signal-flow order here. Could you describe the system from source to output?',
        });
      }
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

/**
 * Category/role words that are too generic to uniquely identify a saved
 * component when seeding a new assessment. If a saved component's model
 * name is exactly one of these words, the seeding pass requires the brand
 * (or the full "brand name" literal) to appear in the new message before
 * pulling the component in — otherwise words like "Integrated" in one
 * user's freshly-typed chain would drag a different brand's "Integrated"
 * in from a saved system (QA residual R1).
 *
 * This is deliberately narrow: only truly generic, interchangeable category
 * terms. Specific model names like "Diva", "Hugo", "Node" stay out — those
 * are discriminating even without the brand.
 */
const GENERIC_COMPONENT_WORDS = new Set<string>([
  'integrated', 'amp', 'amplifier', 'amplification',
  'dac', 'streamer', 'source', 'transport',
  'speaker', 'speakers', 'monitor', 'monitors',
  'pre', 'preamp', 'preamplifier', 'power', 'poweramp',
  'phono', 'phono stage', 'phonostage',
  'headphone', 'headphones', 'iem', 'iems',
  'turntable', 'tonearm', 'cartridge',
  'component',
]);

function isGenericComponentWord(nameLower: string): boolean {
  const n = nameLower.trim();
  if (!n) return true;
  return GENERIC_COMPONENT_WORDS.has(n);
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
  // ── Consumer-wireless short-circuit ──────────────────
  // Audio XX Playbook §3 (preference protection) + §6 (partial-knowledge
  // handling): if the user's system is purely lifestyle/wireless
  // (Sonos, HomePod, iPhone, Bose, etc.), the audiophile-chain
  // deterministic pipeline below produces empty output — none of these
  // brands live in the product catalog, so MemoFindings comes back
  // blank. Instead of surfacing an empty assessment, synthesize a
  // consumer-appropriate narrative that names what the user has, what
  // it's good at, and where its ceiling lies. This is the T1 fix
  // from the Phase K correctness pass.
  if (activeSystem && classifySystemArchetype(activeSystem.components) === 'consumer_wireless') {
    // Archetype-driven short first-turn shape — no encyclopedic
    // narrative, no "Not from verified catalog" (source is brand_profile).
    const firstTurn = buildConsumerWirelessResponse(activeSystem.components);
    const rawName = activeSystem.name ?? '';
    const title = rawName
      ? (rawName.toLowerCase().endsWith('system') ? rawName : `${rawName} System`)
      : firstTurn.title;

    // systemContext carries the full short body. Keep it compact:
    //   1. one-sentence characterization
    //   2. one "what this means" paragraph
    //   3. soft provenance line
    const systemContext =
      `${firstTurn.systemSignature}\n\n`
      + `${firstTurn.tendencies}`;

    const response: ConsultationResponse = {
      title,
      subject: firstTurn.subject,
      advisoryMode: 'system_review',
      source: 'brand_profile',
      systemSignature: firstTurn.systemSignature,
      tendencies: firstTurn.tendencies,
      systemContext,
      provenanceNote: firstTurn.provenanceNote,
      followUp: firstTurn.followUp,
    };

    // Minimal findings so downstream code that expects the contract
    // (e.g. tests) receives a well-formed object. Only systemContext
    // is actually rendered in the UI for this path.
    const findings = {
      systemChain: activeSystem.components.map((c, i) => ({
        position: i + 1,
        role: c.category || 'component',
        name: c.name || c.brand,
      })),
      componentVerdicts: [],
      stackedTraits: [],
      systemAxes: { warm_bright: 'neutral', smooth_detailed: 'balanced', control_bloom: 'balanced' },
      bottleneck: null,
      keeps: [],
      recommendedSequence: [],
      upgradePaths: [],
    } as unknown as MemoFindings;

    return { kind: 'assessment', findings, response };
  }

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
      //
      // Generic category/role words (e.g. "integrated", "monitor", "streamer")
      // are ambiguous — "Job Integrated" in a saved system would otherwise
      // match inside "PrimaLuna EVO 300 Integrated" in a newly-typed chain
      // and inject phantom components (QA residual R1). For these, require
      // that the brand also appears in the message, or that the full
      // "<brand> <name>" literal appears verbatim.
      const brandMentioned = wordAwareIncludes(msgLowerForSeed, brandLower);
      const fullMentioned = wordAwareIncludes(msgLowerForSeed, fullName.toLowerCase());
      const nameIsGeneric = isGenericComponentWord(nameLower);
      const strippedIsGeneric = isGenericComponentWord(strippedNameLower);
      const nameMentioned =
        (!nameIsGeneric && wordAwareIncludes(msgLowerForSeed, nameLower))
        || (!strippedIsGeneric && wordAwareIncludes(msgLowerForSeed, strippedNameLower));
      const mentionedInMessage = fullMentioned || brandMentioned || nameMentioned;
      if (!mentionedInMessage) continue;

      processedNames.add(nameLower);
      processedNames.add(strippedNameLower);
      processedNames.add(brandLower);

      // Try to find rich catalog data (use stripped name for matching too).
      // Apply CATALOG_NAME_ALIASES so family members without their own
      // entry (e.g. plain "Bluesound NODE") still resolve to the family's
      // catalog representative ("NODE X").
      const aliasedName = aliasCatalogLookup(nameLower);
      const aliasedStripped = aliasCatalogLookup(strippedNameLower);
      const aliasedFull = aliasCatalogLookup(fullName.toLowerCase());
      const aliasedBrand = BRAND_ALIASES[brandLower] ?? brandLower;
      const product = ALL_PRODUCTS.find(
        (p) => {
          const pName = p.name.toLowerCase();
          const pFull = `${p.brand} ${p.name}`.toLowerCase();
          const pBrand = p.brand.toLowerCase();
          return pName === nameLower
            || pName === strippedNameLower
            || pName === aliasedName
            || pName === aliasedStripped
            || pFull === fullName.toLowerCase()
            || pFull === aliasedFull
            // Brand+partial-name: "horn" matches inside "horns" when brand matches
            || (pBrand === brandLower && nameLower.length >= 2 && pName.includes(nameLower))
            || (pBrand === brandLower && strippedNameLower.length >= 2 && pName.includes(strippedNameLower))
            // Brand alias: e.g. brand "goldmund" → catalog brand "job"
            || (pBrand === aliasedBrand && pName === aliasedName)
            || (pBrand === aliasedBrand && nameLower.length >= 2 && pName.includes(nameLower));
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

      const primaryRole = product?.category ?? ac.category ?? 'component';
      components.push({
        displayName: fullName,
        role: primaryRole,
        roles: resolveComponentRoles(primaryRole, product ?? undefined, fullName),
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
      // and brand+partial-name (handles singular/plural: "hornshoppe horn" → "Hornshoppe Horns").
      // Apply CATALOG_NAME_ALIASES so family members without their own entry
      // (e.g. plain "node") resolve to the family representative ("node x").
      const aliasedLower = aliasCatalogLookup(lower);
      const product = ALL_PRODUCTS.find(
        (p) => {
          const pName = p.name.toLowerCase();
          const pFull = `${p.brand} ${p.name}`.toLowerCase();
          const pBrand = p.brand.toLowerCase();
          return pName === lower
            || pFull === lower
            || pName === aliasedLower
            || pFull === aliasedLower
            || (lower.length >= 3 && pName.startsWith(lower))
            // Model suffix match: "o/96" matches "Orangutan O/96"
            || (lower.length >= 3 && pName.endsWith(lower))
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

        const prodDisplayName = normalizeDisplayName(product.brand, product.name);
        components.push({
          displayName: prodDisplayName,
          role: product.category,
          roles: resolveComponentRoles(product.category, product, prodDisplayName),
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
          roles: resolveComponentRoles(role, undefined, displayName),
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

        // Use proper brand casing from catalog products when available (e.g. "DeVore" not "Devore")
        const catalogBrandCasing = brandProducts.length > 0 ? brandProducts[0].brand : undefined;
        const displayName = specificProduct
          ? normalizeDisplayName(specificProduct.brand, specificProduct.name)
          : catalogBrandCasing
            ?? brandProfile.names[0].split(' ').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

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
          roles: resolveComponentRoles(role, specificProduct ?? undefined, displayName),
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

        const resolvedRole = specificProduct?.category ?? role;
        components.push({
          displayName,
          role: resolvedRole,
          roles: resolveComponentRoles(resolvedRole, specificProduct ?? undefined, displayName),
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
    : 'What are you exploring — is there something you\'d like to change about this balance, or are you looking to understand what a specific upgrade path would shift?';

  // ── Subject line ────────────────────────────────────
  const subject = components.map((c) => c.displayName).join(', ');

  // ── System tier estimation ──────────────────────────
  // Determines whether this is a reference-level system where bottleneck
  // analysis should be suppressed or softened. Based on brand reputation,
  // component prices, and system complexity.
  const systemTier = estimateSystemTier(components);

  // ── Voicing coherence ───────────────────────────────
  // Detect whether components share deliberate axis alignment from
  // specialist/boutique brands. When coherent, axis stacking is system
  // identity — not a constraint. This gate prevents the engine from
  // treating intentional voicing as a bottleneck.
  const voicingCoherence = assessVoicingCoherence(components, componentAxisProfiles, systemAxes);

  // ── Structured memo-format fields ───────────────────
  // Pipeline: chain → stacked traits → bottleneck → assessments → paths → sequence → observation
  const memoChain = buildSystemChain(components, currentMessage);
  const memoStacked = detectStackedTraits(components, componentAxisProfiles);
  const memoConstraint = systemTier === 'reference'
    ? undefined  // Reference-level systems don't have meaningful bottlenecks
    : detectPrimaryConstraint(components, componentAxisProfiles, memoStacked, systemAxes, voicingCoherence);
  const memoAssessments = buildComponentAssessments(components, componentAxisProfiles, memoConstraint);
  // Hoist listener priority inference before upgrade paths (Feature 3: preference protection)
  const memoListenerPriorities = inferListenerPriorityTags(systemAxes, desires);
  const memoUpgradePaths = systemTier === 'reference'
    ? []  // Suppress upgrade paths for reference-tier systems
    : buildUpgradePaths(components, componentAxisProfiles, memoAssessments, memoConstraint, memoStacked, systemAxes, memoListenerPriorities, desires);
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
    memoListenerPriorities,
    voicingCoherence,
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

  // ── Rewritten system assessment output ──────────────
  // A system review is now presented as a single six-section narrative
  // carried in `systemContext`. Interpretation logic is unchanged — this
  // post-processor only re-expresses the same findings. The legacy
  // structured fields stay on the response object so existing parity
  // tests and any non-UI consumers still see them; the UI layer
  // (MemoFormat in AdvisoryMessage.tsx) skips the legacy sections
  // whenever advisoryMode === 'system_review' and systemContext is set.
  response.systemContext = composeAssessmentNarrative(findings);

  return { kind: 'assessment', findings, response };
}

// ── Rewritten system-assessment narrative composer ────
//
// Turns a MemoFindings object (the deterministic pipeline's structured
// output) into a single seven-section markdown narrative. The seven
// sections are fixed:
//   1. System read        — sonic behavior, strengths, constraints
//   2. Listener alignment — who this system works for, identity
//   3. Decision           — KEEP / REFINE / CHANGE DIRECTION / FIX A PROBLEM
//   4. Trade-offs         — what improves, gets worse, stays the same
//   5. Action path        — direction, products, risk level
//   6. Do nothing check   — when the user should stay put
//   7. Outcome validation — what to hear differently, how to judge success
//
// No hedging, no filler, no "likely" / "probably" language. No new
// interpretation — every claim is sourced from the findings contract.

function composeAssessmentNarrative(findings: MemoFindings): string {
  const axes = findings.systemAxes;
  const comps = findings.componentVerdicts;
  const stacked = findings.stackedTraits;
  const bottleneck = findings.bottleneck;
  const keeps = findings.keeps;
  const sequence = findings.recommendedSequence;
  const paths = findings.upgradePaths;

  // Listener-facing axis phrases — describe what the listener actually
  // hears rather than the abstract axis name. Each phrase is a short
  // observation in plain language.
  const tonal =
    axes.warm_bright === 'warm' ? 'a warm, full-bodied tonal balance'
    : axes.warm_bright === 'bright' ? 'a forward, lit tonal balance that emphasises presence and clarity'
    : 'an even tonal balance with no strong lean in either direction';
  const detail =
    axes.smooth_detailed === 'detailed' ? 'good inner detail — small voices and transient edges stay legible'
    : axes.smooth_detailed === 'smooth' ? 'a smooth presentation that softens edges and reduces listening fatigue'
    : 'a balance between resolution and ease';
  const timing =
    axes.elastic_controlled === 'elastic' ? 'fluid, elastic timing'
    : axes.elastic_controlled === 'controlled' ? 'tight, well-controlled timing that keeps complex passages organised'
    : 'relaxed but stable timing';
  const stage =
    axes.airy_closed === 'airy' ? 'an open soundstage with clear separation between instruments'
    : axes.airy_closed === 'closed' ? 'a closer, more intimate soundstage'
    : 'a natural sense of space';

  // Dedupe component names — catalog matches can produce both a free-text
  // and a catalog row for the same physical component. Compare on a
  // normalized key (lowercased, punctuation- and whitespace-collapsed) so
  // "WLM Diva Monitor" and "WLM Diva monitors" collapse to one entry.
  const seenNameKeys = new Set<string>();
  const uniqueNames: string[] = [];
  for (const n of findings.componentNames) {
    const key = n.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key || seenNameKeys.has(key)) continue;
    seenNameKeys.add(key);
    uniqueNames.push(n);
  }
  const namesList =
    uniqueNames.length > 1
      ? uniqueNames.slice(0, -1).join(', ') + ', and ' + uniqueNames[uniqueNames.length - 1]
      : uniqueNames[0] ?? '';
  const names = `The ${namesList}`;
  const deliberate = findings.isDeliberate
    ? 'The pieces lean in compatible directions rather than fighting one another.'
    : 'The system is technically competent but not strongly unified around a single philosophy.';
  // ── Active DAC note ──
  // When multiple DACs exist, surface which one is likely active.
  // Wording is calibrated to confidence level — never states signal path as fact.
  let dacNote = '';
  const dac = findings.activeDACInference;
  if (dac.multipleDACs && dac.activeDACName && !dac.needsDACClarification) {
    const dacOverlap = findings.roleOverlaps.find((o) => o.role === 'dac');
    const others = dacOverlap?.components.filter((n) => n !== dac.activeDACName) ?? [];

    if (dac.confidence === 'high') {
      // Single DAC — shouldn't reach here (multipleDACs is true), but handle gracefully
      dacNote = `\n\nYour system uses the ${dac.activeDACName} as its DAC.`;
    } else if (dac.confidence === 'medium') {
      // Multiple DACs, clear priority winner
      if (dac.activeDACType === 'standalone' && others.length > 0) {
        dacNote = `\n\nYour system likely uses the ${dac.activeDACName} as the primary DAC. If it is handling digital conversion, the DAC stage in the ${others.join(' and ')} would typically not be used.`;
      } else if (dac.activeDACType === 'integrated' && others.length > 0) {
        dacNote = `\n\nYour system likely uses the DAC in your integrated amplifier (${dac.activeDACName}). If so, the ${others.join(' and ')} feeds it as a transport.`;
      } else {
        dacNote = `\n\nYour system likely uses the ${dac.activeDACName} as its primary DAC.`;
      }
    } else {
      // Low confidence — note but don't assert
      dacNote = `\n\nYour system includes multiple DAC-capable components. The ${dac.activeDACName} is the most likely active DAC, but the actual conversion path depends on how they are connected.`;
    }
  } else if (dac.needsDACClarification) {
    // Suppress DAC ambiguity when a clearly dominant DAC exists:
    // If one component's primary role is 'dac' and the other DAC-capable
    // components are streamers/sources (with an internal DAC as secondary),
    // the dedicated DAC is obviously active. No need to confuse the user.
    const hasDedicatedDAC = comps.some(c => (c.role || '').toLowerCase() === 'dac');
    const otherDACsAreSourcesOnly = comps.every(c => {
      const r = (c.role || '').toLowerCase();
      if (r === 'dac') return true; // the dedicated DAC itself — skip
      // Check if this component has DAC capability (via roles array)
      const roles = (c as any).roles as string[] | undefined;
      const hasDACRole = roles?.some((ro: string) => ro.toLowerCase() === 'dac');
      if (!hasDACRole) return true; // not DAC-capable, no conflict
      // It IS DAC-capable — is its primary role a source type?
      return r === 'streamer' || r === 'source' || r === 'transport';
    });
    if (hasDedicatedDAC && otherDACsAreSourcesOnly) {
      // Clear dominant DAC — suppress clarification
      dacNote = '';
    } else {
      dacNote = `\n\nYour system includes multiple DAC-capable components, and the active conversion path is unclear. Which DAC is handling conversion affects the sound — worth confirming your signal routing.`;
    }
  }

  // ── Amp/speaker power-match note ──
  // When power data exists and shows a concerning mismatch, surface it.
  // Uses trust-calibrated language: factual observation, not alarm.
  let powerNote = '';
  const pm = findings.powerMatchAssessment;
  if (pm.compatibility === 'mismatched' && pm.ampName && pm.speakerName) {
    const splStr = pm.estimatedMaxCleanSPL != null
      ? ` (estimated ~${Math.round(pm.estimatedMaxCleanSPL)} dB maximum clean output)`
      : '';
    const interactionNote = pm.relevantInteraction
      ? ` Catalog notes suggest: ${pm.relevantInteraction}`
      : '';
    powerNote = `\n\nThe ${pm.ampName} at ${pm.ampPowerWatts}W is significantly underpowered for the ${pm.speakerName} at ${pm.speakerSensitivityDb} dB sensitivity${splStr}. Dynamic compression and loss of bass control are expected at moderate listening levels.${interactionNote}`;
  } else if (pm.compatibility === 'strained' && pm.ampName && pm.speakerName) {
    const splStr = pm.estimatedMaxCleanSPL != null
      ? ` (estimated ~${Math.round(pm.estimatedMaxCleanSPL)} dB maximum clean output)`
      : '';
    const interactionNote = pm.relevantInteraction
      ? ` Catalog notes suggest: ${pm.relevantInteraction}`
      : '';
    powerNote = `\n\nThe ${pm.ampName} at ${pm.ampPowerWatts}W has limited headroom for the ${pm.speakerName} at ${pm.speakerSensitivityDb} dB sensitivity${splStr}. Dynamic peaks may compress on demanding material.${interactionNote}`;
  } else if (pm.compatibility === 'optimal' && pm.relevantInteraction && pm.ampName && pm.speakerName) {
    // Positive pairing note — only when there's a relevant interaction to surface
    powerNote = `\n\nThe ${pm.ampName} and ${pm.speakerName} are well-matched on power and efficiency. ${pm.relevantInteraction}`;
  }

  // ── System thesis: max 2 sentences. ──
  // Sentence 1: interaction-aware — names the upstream character AND
  //   downstream counterbalance (or alignment), not just dominant axes.
  // Sentence 2: most consequential note (power > source transport > deliberate).
  //
  // Strategy: partition components into "upstream" (dac, amp, integrated)
  // and "downstream" (speaker, headphone) and "source" (streamer, turntable,
  // transport). Describe the upstream character, then contrast or align with
  // downstream, and note the source role.
  const upstreamComps = comps.filter(c => {
    const r = (c.role || '').toLowerCase();
    return r === 'dac' || r === 'amplifier' || r === 'amp' || r === 'integrated';
  });
  const downstreamComps = comps.filter(c => {
    const r = (c.role || '').toLowerCase();
    return r === 'speaker' || r === 'speakers' || r === 'headphone' || r === 'headphones';
  });
  const sourceComps = comps.filter(c => {
    const r = (c.role || '').toLowerCase();
    return r === 'streamer' || r === 'source' || r === 'turntable' || r === 'transport';
  });

  // Derive upstream and downstream character from per-component axes
  const upstreamAxes = findings.perComponentAxes.filter(a =>
    upstreamComps.some(c => c.name === a.name),
  );
  const downstreamAxes = findings.perComponentAxes.filter(a =>
    downstreamComps.some(c => c.name === a.name),
  );

  // Upstream lean: are the upstream components bright/detailed or warm/smooth?
  const upBright = upstreamAxes.filter(a => a.axes.warm_bright === 'bright').length;
  const upWarm = upstreamAxes.filter(a => a.axes.warm_bright === 'warm').length;
  const upDetailed = upstreamAxes.filter(a => a.axes.smooth_detailed === 'detailed').length;
  const upSmooth = upstreamAxes.filter(a => a.axes.smooth_detailed === 'smooth').length;

  const downWarm = downstreamAxes.filter(a => a.axes.warm_bright === 'warm').length;
  const downBright = downstreamAxes.filter(a => a.axes.warm_bright === 'bright').length;
  const downSmooth = downstreamAxes.filter(a => a.axes.smooth_detailed === 'smooth').length;

  // Build upstream character phrase
  const upstreamNames = upstreamComps.map(c => c.name);
  const downstreamNames = downstreamComps.map(c => c.name);
  const sourceNames = sourceComps.map(c => c.name);

  let upstreamChar = '';
  if (upBright > 0 && upDetailed > 0) upstreamChar = 'speed-and-clarity';
  else if (upBright > 0) upstreamChar = 'clarity-forward';
  else if (upDetailed > 0) upstreamChar = 'detail-forward';
  else if (upWarm > 0 && upSmooth > 0) upstreamChar = 'warmth-and-body';
  else if (upWarm > 0) upstreamChar = 'warm-leaning';
  else upstreamChar = 'neutral';

  // Build downstream counterbalance phrase
  let downstreamPhrase = '';
  const hasContrast = (upBright > 0 && downWarm > 0) || (upDetailed > 0 && downSmooth > 0)
    || (upWarm > 0 && downBright > 0);
  if (hasContrast) {
    // Counterbalance
    if (downWarm > 0 || downSmooth > 0) {
      downstreamPhrase = `balanced by the tonal richness of the ${downstreamNames.join(' and ')}`;
    } else {
      downstreamPhrase = `counterbalanced by the ${downstreamNames.join(' and ')}`;
    }
  } else {
    // Alignment
    downstreamPhrase = `reinforced by the ${downstreamNames.join(' and ')}`;
  }

  // Compose interaction-aware thesis
  let thesisSentence1: string;
  if (upstreamComps.length > 0 && downstreamComps.length > 0) {
    const upList = upstreamNames.join(' and ');
    thesisSentence1 = `This is a ${upstreamChar} system anchored by ${upList}, ${downstreamPhrase}.`;
    if (sourceComps.length > 0) {
      thesisSentence1 += ` The ${sourceNames.join(' and ')} feeds the chain as a neutral transport.`;
    }
  } else {
    // Fallback: no clear upstream/downstream split
    const coreId = describeCoreIdentity(axes);
    thesisSentence1 = `${names} form ${coreId}.`;
  }

  // Sentence 2: power mismatch > deliberate observation (DAC note removed
  // from thesis — handled separately or suppressed per Prompt 1C).
  const thesisSentence2 = powerNote.trim() || '';
  const overview = [
    `**System read**`,
    ``,
    thesisSentence2
      ? `${thesisSentence1} ${thesisSentence2}`
      : thesisSentence1,
  ].join('\n');

  // ── System logic: Component → Behavior → System effect (max 4 rows) ──
  // Interaction-based: each row explains what the component DOES to the system,
  // not its generic role. Derives behavior from axes + strengths, and effect
  // from how the component interacts with the system axes.
  const systemLogicRows: string[] = [];

  // Helper: derive a short behavior phrase from axes and strengths
  function deriveComponentBehavior(c: typeof comps[0], compAxes: typeof findings.perComponentAxes[0] | undefined): string {
    const wb = compAxes?.axes.warm_bright;
    const sd = compAxes?.axes.smooth_detailed;
    const ec = compAxes?.axes.elastic_controlled;
    const parts: string[] = [];
    if (wb === 'bright') parts.push('fast');
    else if (wb === 'warm') parts.push('tone-rich');
    if (sd === 'detailed') parts.push(wb === 'bright' ? 'lean' : 'resolving');
    else if (sd === 'smooth') parts.push('smooth');
    if (ec === 'elastic') parts.push('high flow');
    else if (ec === 'controlled') parts.push('controlled');
    if (parts.length === 0 && wb === 'neutral' && sd !== 'neutral') {
      parts.push(sd === 'detailed' ? 'neutral, detailed' : 'neutral');
    }
    if (parts.length === 0) parts.push('neutral, controlled');
    return parts.join(', ');
  }

  // Helper: derive interaction effect — what this component does relative to system
  function deriveInteractionEffect(
    c: typeof comps[0],
    compAxes: typeof findings.perComponentAxes[0] | undefined,
    sysAxes: typeof axes,
  ): string {
    const roleKey = (c.role || '').toLowerCase();
    const wb = compAxes?.axes.warm_bright;
    const sd = compAxes?.axes.smooth_detailed;

    // Source/streamer: typically transparent
    if (roleKey === 'streamer' || roleKey === 'source' || roleKey === 'turntable' || roleKey === 'transport') {
      if (wb === 'neutral') return 'stays out of the way';
      if (wb === 'warm') return 'adds warmth from the source stage';
      return 'contributes clarity from the source stage';
    }
    // DAC: tonal center
    if (roleKey === 'dac') {
      if (wb === 'bright' || sd === 'detailed') return 'defines the tonal center';
      if (wb === 'warm') return 'anchors the tonal foundation with warmth';
      return 'sets the tonal foundation';
    }
    // Amplifier: preserves or shapes
    if (roleKey === 'amplifier' || roleKey === 'amp' || roleKey === 'integrated') {
      // Does it match upstream (DAC) lean?
      if (wb === sysAxes.warm_bright && sd === sysAxes.smooth_detailed) return 'preserves speed and attack';
      if (wb === 'warm' && sysAxes.warm_bright === 'bright') return 'adds body to a lean upstream';
      if (wb === 'bright' && sysAxes.warm_bright === 'warm') return 'adds speed to a warm upstream';
      if (wb === 'neutral') return 'passes signal with low coloration';
      return 'preserves upstream character';
    }
    // Speaker/headphone: final voice
    if (roleKey === 'speaker' || roleKey === 'speakers' || roleKey === 'headphone' || roleKey === 'headphones') {
      // Counterbalance or reinforce?
      if ((wb === 'warm' && sysAxes.warm_bright === 'bright') || (sd === 'smooth' && sysAxes.smooth_detailed === 'detailed')) {
        return 'adds body and prevents dryness';
      }
      if (wb === sysAxes.warm_bright) return 'reinforces the system\'s overall lean';
      if (wb === 'warm') return 'adds body at the output stage';
      return 'shapes the final presentation';
    }
    return 'contributes to overall character';
  }

  // Order: DAC first (tonal center), then amp, then speaker, then source last
  const logicOrder = ['dac', 'amplifier', 'amp', 'integrated', 'speaker', 'speakers', 'headphone', 'headphones', 'streamer', 'source', 'turntable', 'transport'];
  const sortedComps = [...comps].sort((a, b) => {
    const aIdx = logicOrder.indexOf((a.role || '').toLowerCase());
    const bIdx = logicOrder.indexOf((b.role || '').toLowerCase());
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });
  for (const c of sortedComps) {
    if (systemLogicRows.length >= 4) break;
    const compAxes = findings.perComponentAxes.find(a => a.name === c.name);
    const behavior = deriveComponentBehavior(c, compAxes);
    const effect = deriveInteractionEffect(c, compAxes, axes);
    systemLogicRows.push(`${c.name} → ${behavior} → ${effect}`);
  }
  const systemLogicSection = systemLogicRows.length > 0
    ? [`**System logic**`, ``, ...systemLogicRows].join('\n')
    : '';

  // Dedupe component verdicts on the same normalized name key used above,
  // so a duplicated catalog/free-text pair doesn't generate two strength bullets.
  const seenVerdictKeys = new Set<string>();
  const dedupedComps = comps.filter(c => {
    const key = c.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key || seenVerdictKeys.has(key)) return false;
    seenVerdictKeys.add(key);
    return true;
  });
  const keepComps = dedupedComps.filter(c => c.verdict === 'keep');
  const charTraits = stacked.filter(s => s.classification === 'system_character');
  const strengths: string[] = [];
  // Vary the connective sentence per index so the section doesn't read as a template.
  // Listener-impact tails: what this strength sounds like in the room.
  const compTails = [
    (_role: string) => `This defines much of the system's overall character.`,
    (_role: string) => `On familiar recordings, this contribution is consistent and reliable.`,
    (_role: string) => `Replacing this component would change the system's sonic identity significantly.`,
  ];
  const traitTails = [
    (contribs: string) => `${contribs} reinforce the same quality, producing a clear and consistent result.`,
    (contribs: string) => `Because ${contribs} align here, the effect is strong and unambiguous.`,
    (contribs: string) => `${contribs} work together on this — the system commits rather than splitting the difference.`,
  ];
  // ── Role-based strength inclusion ──
  // Every system has up to three core role buckets:
  //   • source    — DAC, streamer, turntable, transport, phono
  //   • amplifier — integrated, preamp, power amp
  //   • listener  — speakers or headphones
  // If a keep-verdict component exists in a bucket, it MUST appear in
  // "doing well". The previous implementation capped selection at two
  // bullets, so three-component chains (DAC → amp → speakers) silently
  // dropped one — typically the source. Selection is now role-based
  // rather than top-N; ordering follows the signal chain.
  type StrengthItem =
    | { kind: 'component'; name: string; role: string; text: string; key: string }
    | { kind: 'trait'; property: string; contributors: string[]; key: string };
  const STRENGTH_SOURCE_ROLES = new Set(['dac', 'streamer', 'turntable', 'cdp', 'transport', 'phono', 'source']);
  const STRENGTH_AMP_ROLES = new Set(['amplifier', 'amp', 'integrated', 'preamp', 'preamplifier', 'power-amp', 'poweramp']);
  const STRENGTH_LISTENER_ROLES = new Set(['speaker', 'speakers', 'headphone', 'headphones']);
  const bucketOf = (role: string): 'source' | 'amp' | 'listener' | 'other' => {
    const r = (role || '').toLowerCase();
    if (STRENGTH_SOURCE_ROLES.has(r)) return 'source';
    if (STRENGTH_AMP_ROLES.has(r)) return 'amp';
    if (STRENGTH_LISTENER_ROLES.has(r)) return 'listener';
    return 'other';
  };

  type ComponentCandidate = Extract<StrengthItem, { kind: 'component' }>;
  const componentCandidates: ComponentCandidate[] = [];
  for (const c of keepComps) {
    const s = c.strengths[0];
    if (!s) continue;
    componentCandidates.push({
      kind: 'component',
      name: c.name,
      role: c.role,
      text: s,
      key: c.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
    });
  }

  const selectedStrengths: StrengthItem[] = [];
  const usedComponentKeys = new Set<string>();
  const usedPropertyKeys = new Set<string>();

  // Pick the first keep-verdict candidate per role bucket, in signal-chain
  // order. "First" preserves whatever ordering upstream findings applied —
  // this is a selection filter, not a re-ranking pass.
  for (const bucket of ['source', 'amp', 'listener'] as const) {
    const pick = componentCandidates.find(
      (c) => bucketOf(c.role) === bucket && !usedComponentKeys.has(c.key),
    );
    if (pick) {
      selectedStrengths.push(pick);
      usedComponentKeys.add(pick.key);
    }
  }

  // Components whose role does not map to a core bucket (e.g. a rare
  // 'transport' variant or an unknown label) get a chance to appear after
  // the three core roles, up to a total of three component bullets.
  for (const cand of componentCandidates) {
    if (selectedStrengths.filter((s) => s.kind === 'component').length >= 3) break;
    if (bucketOf(cand.role) !== 'other') continue;
    if (usedComponentKeys.has(cand.key)) continue;
    selectedStrengths.push(cand);
    usedComponentKeys.add(cand.key);
  }

  // Optionally surface one character-trait bullet after the role bullets,
  // but only when it adds information the component bullets haven't
  // already covered AND we haven't already hit the 3-bullet cap.
  if (selectedStrengths.length < 3) {
    for (const t of charTraits) {
      if (selectedStrengths.length >= 3) break;
      const pKey = t.property.toLowerCase();
      if (usedPropertyKeys.has(pKey)) continue;
      const allCovered = t.contributors.every((c) =>
        usedComponentKeys.has(c.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()),
      );
      if (allCovered) continue;
      selectedStrengths.push({
        kind: 'trait',
        property: t.property,
        contributors: t.contributors,
        key: pKey,
      });
      usedPropertyKeys.add(pKey);
      break;
    }
  }
  // Hard cap: max 3 strength bullets (output contract).
  const cappedStrengths = selectedStrengths.slice(0, 3);
  let sn = 1;
  for (const item of cappedStrengths) {
    if (item.kind === 'component') {
      // One sentence per bullet: component + what it does. No tail.
      strengths.push(`${sn}. **${item.name}** — ${item.text}.`);
    } else {
      const seen = new Set<string>();
      const dedupedContributors = item.contributors.filter((c) => {
        const k = (c || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      const contribs = joinWithCommas(dedupedContributors);
      strengths.push(`${sn}. **${humanizeProperty(item.property)}** — ${contribs} reinforce this quality consistently.`);
    }
    sn++;
  }
  if (strengths.length === 0) {
    for (const c of dedupedComps) {
      if (c.strengths[0]) {
        strengths.push(`${sn}. **${c.name}** — ${c.strengths[0]}.`);
        sn++;
        if (sn > 3) break;
      }
    }
  }
  if (strengths.length === 0) {
    strengths.push(`1. Internal consistency — no component is fighting the others.`);
  }

  const strengthsSection = [`**What the system does well**`, ``, ...strengths].join('\n');

  // ── Primary-constraint selection ──
  // The renderer used to dump every constraint as an equal bullet, which
  // diluted the most important point. We now pick exactly one primary
  // constraint and expand it; everything else is demoted to a single
  // optional "Also worth noting" line. Selection priority:
  //   1. A bottleneck component with concrete constrained axes (strongest signal).
  //   2. The first verdict marked 'bottleneck' or 'upgrade' that has a real weakness.
  //   3. The first stacked imbalance.
  // If none of the above, we surface the "no material constraint" line.
  type PrimaryConstraint =
    | { kind: 'bottleneck'; component: string; role: string; axes: string[] }
    | { kind: 'component'; name: string; role: string; weakness: string }
    | { kind: 'imbalance'; property: string; contributors: string[] }
    | { kind: 'none' };

  const bottleneckName = bottleneck?.component;
  // ── Guard: positive-trait properties cannot be selected as a
  // constraint unless negative evidence exists. Flow / elasticity /
  // breathing / timing-coherence properties are listener strengths by
  // default; they may only become a primary constraint when the axis
  // profile shows damping or restraint (i.e. the trait is being
  // compressed rather than expressed). Scoring, rendering, and UI are
  // untouched — this only filters candidates before selection.
  const POSITIVE_TRAIT_PROPERTIES = new Set([
    'dynamic_elasticity',
    'musical_flow',
    'timing_coherence',
    'breathing',
    'phrasing',
    'elasticity',
    'flow',
  ]);
  const isPositiveTraitProperty = (prop: string): boolean => {
    const key = (prop || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return POSITIVE_TRAIT_PROPERTIES.has(key);
  };
  // Damping evidence must be explicit, not inferred from an axis lean.
  // Axis combinations like "controlled + detailed" describe a fast,
  // clean profile and are NOT sufficient evidence of damping. We only
  // accept upstream findings that name compression / damping / loss of
  // body, bloom, sustain, or audible thinning / dryness directly.
  const stackedConstraintHint = stacked.some((s) => {
    const t = `${s.property} ${(s as { description?: string }).description ?? ''}`.toLowerCase();
    if (/compress|compressed|damping|damped|flatten|flattened|restrained|choked|overdamp/.test(t)) return true;
    if (/reduced\s+body|reduced\s+bloom|reduced\s+sustain|\bthin\b|\bdry\b|dryness/.test(t)) return true;
    return false;
  });
  const hasDampingEvidence = stackedConstraintHint;
  const imbalances = stacked
    .filter(s => s.classification === 'system_imbalance')
    .filter(s => {
      // Skip positive-trait properties unless real damping evidence
      // exists. Without that evidence, the trait is a strength or bias
      // and must not be identified as the system's primary limitation.
      if (isPositiveTraitProperty(s.property) && !hasDampingEvidence) return false;
      return true;
    });

  // ── Evidence-ranked component selection. ───────────────────────────────
  // Candidates are scored against a strength hierarchy instead of taken
  // in source order. The highest-scoring component with a specific,
  // audible weakness becomes primary; vague/hedged weakness text does not
  // qualify on its own. Only when no component clears the specificity bar
  // do we fall back to a stacked imbalance.
  //
  // Hierarchy (highest first):
  //   a. Bottleneck with concrete constrained axes.
  //   b. Component carrying multiple specific weaknesses.
  //   c. Upgrade/bottleneck verdict with a specific weakness.
  //   d. Generic or hedged weakness text (does not qualify alone).

  /** Detects vague/hedged weakness language that should not qualify
   * a component as primary on its own. */
  const isVagueWeakness = (w: string | undefined): boolean => {
    if (!w) return true;
    const t = w.trim();
    if (t.length < 25) return true;
    return /\b(may|might|could|can)\b|\bslightly\b|\bsomewhat\b|\ba bit\b|less precise|may soften|tends to|arguably/i.test(t);
  };
  const isSpecificWeakness = (w: string | undefined): boolean => !isVagueWeakness(w);

  type Scored = {
    comp: typeof dedupedComps[number];
    score: number;
    specificWeakness: string | undefined;
  };
  const scoreComponent = (c: typeof dedupedComps[number]): Scored => {
    const weaknesses = Array.isArray(c.weaknesses) ? c.weaknesses : [];
    const specific = weaknesses.filter(isSpecificWeakness);
    let score = 0;
    // (a) Explicit bottleneck match with constrained axes — strongest.
    if (
      bottleneck &&
      c.name === bottleneck.component &&
      bottleneck.constrainedAxes &&
      bottleneck.constrainedAxes.length > 0
    ) {
      score += 100 + bottleneck.constrainedAxes.length * 5;
    }
    // Bottleneck match without axes — still a component-level signal.
    if (bottleneck && c.name === bottleneck.component && !(bottleneck.constrainedAxes && bottleneck.constrainedAxes.length > 0)) {
      score += 60;
    }
    // (b) Multiple specific weaknesses.
    if (specific.length >= 2) score += 50 + specific.length * 5;
    // (c) Upgrade / bottleneck verdict with a specific weakness.
    if ((c.verdict === 'bottleneck' || c.verdict === 'upgrade') && specific.length >= 1) {
      score += c.verdict === 'bottleneck' ? 45 : 35;
    }
    // Verdict alone (no specific weakness) is a weak signal.
    if ((c.verdict === 'bottleneck' || c.verdict === 'upgrade') && specific.length === 0) {
      score += 10;
    }
    // (d) Any specific weakness at all adds a modest baseline.
    if (specific.length >= 1) score += 15;
    return { comp: c, score, specificWeakness: specific[0] };
  };

  const scored = dedupedComps
    .map(scoreComponent)
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // A component only qualifies as primary if it carries a specific,
  // audible weakness — or is the axis-backed bottleneck (which is
  // already audible by construction).
  const QUALIFY_THRESHOLD = 40;
  const winner = scored.find(s =>
    s.score >= QUALIFY_THRESHOLD && (
      (bottleneck && s.comp.name === bottleneck.component && bottleneck.constrainedAxes && bottleneck.constrainedAxes.length > 0) ||
      !!s.specificWeakness
    ),
  );

  let primary: PrimaryConstraint = { kind: 'none' };
  if (
    winner &&
    bottleneck &&
    winner.comp.name === bottleneck.component &&
    bottleneck.constrainedAxes &&
    bottleneck.constrainedAxes.length > 0
  ) {
    primary = {
      kind: 'bottleneck',
      component: bottleneck.component,
      role: bottleneck.role,
      axes: bottleneck.constrainedAxes,
    };
  } else if (winner) {
    primary = {
      kind: 'component',
      name: winner.comp.name,
      role: winner.comp.role,
      weakness:
        winner.specificWeakness ||
        'it is the weakest link in the system relative to what the other components can deliver',
    };
  } else if (imbalances.length > 0) {
    // No component cleared the specificity bar → fall back to imbalance.
    primary = {
      kind: 'imbalance',
      property: imbalances[0].property,
      contributors: imbalances[0].contributors,
    };
  }

  // ── Final positive-trait guard (applied globally, after selection). ──
  // Listener-positive traits (elasticity, flow, timing, breathing, swing)
  // must never be reported as the system's primary limitation unless
  // explicit negative evidence (damping / detail-forward restraint) is
  // present in the axis profile. This guard runs AFTER bottleneck /
  // component / imbalance selection and BEFORE rendering, and falls
  // through to the next valid candidate if the current one fails.
  const normalizeKey = (s: string): string =>
    (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const isPositiveTraitText = (s: string): boolean => {
    const k = normalizeKey(s);
    return /elastic|flow|timing|breath|swing/.test(k);
  };
  // Same explicit rule at the final guard. Axis combinations are NOT
  // accepted here either. The only ways to set damping evidence true
  // are: an explicit stacked-finding keyword match, or a real
  // axis-backed component bottleneck (which is concrete, not inferred).
  const bottleneckAlignsNegative = !!(
    bottleneck &&
    bottleneck.constrainedAxes &&
    bottleneck.constrainedAxes.length > 0
  );
  const finalDampingEvidence = stackedConstraintHint || bottleneckAlignsNegative;
  // Contextual rule: low stored energy / clean note endings is part of
  // a fast, elastic profile by default. It only becomes a constraint
  // when upstream findings explicitly describe loss of body, bloom,
  // sustain, density, scale, fullness, or audible flattening / dryness
  // / thinning. Without that evidence, suppress it as a candidate even
  // though it is not in the elastic / flow / timing keyword set above.
  const isLowStoredEnergyText = (s: string): boolean => {
    const k = normalizeKey(s);
    return /low_stored_energy|stored_energy|clean_note_endings|note_endings/.test(k);
  };
  const hasLowStoredEnergyLossEvidence = stacked.some((s) => {
    const t = `${s.property} ${(s as { description?: string }).description ?? ''}`.toLowerCase();
    return /body|bloom|sustain|tonal[_\s-]?density|scale|fullness|flatten|dry|dryness|thin/.test(t);
  });
  const isFlowProfile =
    axes.elastic_controlled === 'elastic' ||
    (axes.elastic_controlled === 'neutral' && axes.smooth_detailed !== 'detailed');
  const lowStoredEnergyShouldBeSuppressed =
    isFlowProfile && !hasLowStoredEnergyLossEvidence;

  const constraintViolatesPositiveGuard = (p: PrimaryConstraint): boolean => {
    if (finalDampingEvidence) return false; // damping signal = real constraint
    // Generic positive-trait keywords (elastic / flow / timing / breath / swing).
    if (p.kind === 'imbalance' && isPositiveTraitText(p.property)) return true;
    if (p.kind === 'component' && isPositiveTraitText(p.weakness)) return true;
    if (p.kind === 'bottleneck' && p.axes.every(isPositiveTraitText)) return true;
    // Contextual low-stored-energy rule (only suppressed when no loss evidence).
    if (lowStoredEnergyShouldBeSuppressed) {
      if (p.kind === 'imbalance' && isLowStoredEnergyText(p.property)) return true;
      if (p.kind === 'component' && isLowStoredEnergyText(p.weakness)) return true;
      if (p.kind === 'bottleneck' && p.axes.every(isLowStoredEnergyText)) return true;
    }
    return false;
  };
  if (constraintViolatesPositiveGuard(primary)) {
    // Discard this candidate and try the next valid imbalance, then fall
    // through to 'none' if nothing survives the guard.
    const remainingImbalances = imbalances.filter((im) => {
      if (finalDampingEvidence) return true;
      if (isPositiveTraitText(im.property)) return false;
      if (lowStoredEnergyShouldBeSuppressed && isLowStoredEnergyText(im.property)) return false;
      return true;
    });
    if (remainingImbalances.length > 0) {
      primary = {
        kind: 'imbalance',
        property: remainingImbalances[0].property,
        contributors: remainingImbalances[0].contributors,
      };
    } else {
      primary = { kind: 'none' };
    }
  }

  // ── Tier-relative bottleneck detection ──────────────────────────────
  // Heuristic layer: when the evidence-ranked selection found no
  // component-level bottleneck but a component is clearly below the
  // tier of the rest of the chain, promote it to primary.
  //
  // Example: Bluesound Node (mid-fi) → Leben CS600 (upper-mid) →
  // Boenicke W5 (upper-mid). The source has no explicit trait deficiency
  // but is objectively the weakest link by capability.
  //
  // Guards against false positives:
  //   - Price tier is a heuristic, not truth. It can nominate a
  //     candidate but never decides alone.
  //   - Source/DAC/streamer: gap ≥ 2 vs the *minimum* downstream tier
  //     among components that have known tiers. This prevents flagging
  //     a source that is at the same level as the amp just because the
  //     speakers are higher (e.g. Hugo + JOB + WLM — all coherent).
  //   - Amp/speaker: gap ≥ 3 vs overall max AND secondary confirmation
  //     (upgrade verdict or real weakness text).
  //   - Never overrides an already-detected component bottleneck.
  const TIER_RANK: Record<string, number> = {
    budget: 1, 'mid-fi': 1, mid: 2, 'upper-mid': 3, 'high-end': 4, reference: 5, statement: 6,
  };
  const tierOf = (c: typeof dedupedComps[number]): number =>
    TIER_RANK[c.priceTier ?? ''] ?? 0;
  // SOURCE_ROLES: components that feed the chain (streamer, transport).
  // DAC is NOT a source role for tier comparison — a DAC converts, it doesn't
  // originate the signal. A streamer/transport is upstream of the DAC.
  const SOURCE_ROLES = /\b(source|streamer|transport|cd|cdp|network|player|digital)\b/i;
  const DOWNSTREAM_ROLES = /\b(amp|amplifier|integrated|speaker|headphone|monitor)\b/i;
  // For source-vs-downstream comparisons, DAC counts as downstream.
  // A streamer at tier 1 feeding a DAC at tier 1 is a matched pair —
  // the speaker being tier 3 should not make the streamer a bottleneck.
  // DAC is NOT added to DOWNSTREAM_ROLES globally to avoid suppressing
  // legitimate amp/speaker bottleneck detection.
  const DOWNSTREAM_OR_DAC = /\b(amp|amplifier|integrated|speaker|headphone|monitor|dac)\b/i;

  if (primary.kind === 'none' || primary.kind === 'imbalance') {
    const withTiers = dedupedComps.filter(c => tierOf(c) > 0);
    if (withTiers.length >= 2) {
      // Downstream components with known tiers — the chain that the
      // source feeds into. For source comparisons, DAC is downstream.
      const downstreamWithTiers = withTiers.filter(c => DOWNSTREAM_OR_DAC.test(c.role));
      const downstreamTiers = downstreamWithTiers.map(tierOf).filter(t => t > 0);
      const maxOverallTier = Math.max(...withTiers.map(tierOf));

      // For source roles, compare against the MINIMUM downstream tier.
      // This means ALL downstream components must be clearly above the
      // source for the tier heuristic to fire. If the source is at the
      // same tier as the amp, they're a matched pair — the speakers
      // being higher does not make the source a bottleneck.
      //
      // Example:  Chord Hugo (1) + JOB (1) + WLM (3)
      //   min downstream = 1, gap = 0 → no trigger (coherent pair)
      //
      // Example:  Bluesound Node (1) + Leben CS600 (3) + Boenicke W5 (3)
      //   min downstream = 3, gap = 2 → triggers (clear mismatch)
      //
      // When the source and one downstream piece are at the same tier
      // (e.g. Node + Scott 222B + Boenicke), the tier heuristic stays
      // silent — the trait-based pipeline catches real source limitations
      // via tonal_density / flow / composure checks upstream.
      const minDownstreamTier = downstreamTiers.length > 0
        ? Math.min(...downstreamTiers)
        : 0;

      // Secondary confirmation for non-source roles: must have signals
      // beyond price alone (upgrade verdict or real weakness text).
      const hasSecondarySignal = (c: typeof dedupedComps[number]): boolean => {
        if (c.verdict === 'upgrade' || c.verdict === 'bottleneck') return true;
        const realWeaknesses = (c.weaknesses ?? []).filter(w => !isVagueWeakness(w));
        return realWeaknesses.length > 0;
      };

      const tierBottleneck = withTiers
        .filter(c => {
          const isSource = SOURCE_ROLES.test(c.role);
          if (isSource) {
            // Source must be ≥ 2 tiers below ALL downstream.
            if (minDownstreamTier === 0) return false;
            return (minDownstreamTier - tierOf(c)) >= 2;
          }
          // Non-source: ≥ 3 below overall max AND secondary signal.
          const gap = maxOverallTier - tierOf(c);
          return gap >= 3 && hasSecondarySignal(c);
        })
        .sort((a, b) => tierOf(a) - tierOf(b))[0];

      if (tierBottleneck) {
        primary = {
          kind: 'component',
          name: tierBottleneck.name,
          role: tierBottleneck.role,
          weakness:
            'it is the weakest link in the system — the rest of the chain can resolve more than this component provides',
        };
      }
    }
  }

  // ── Dominant insight selector ──────────────────────────────────────
  // Every system review organises around one primary idea:
  //   'bottleneck' — a component clearly limits the system
  //   'identity'  — no bottleneck; the system is coherent and trade-off driven
  const dominantInsight: 'bottleneck' | 'identity' =
    primary.kind === 'bottleneck' || primary.kind === 'component'
      ? 'bottleneck'
      : 'identity';

  // Render the primary constraint as expanded prose, not a bullet.
  const constraintParts: string[] = [];

  // _DEBUG instrumentation removed — the bottleneck detection logic is
  // stable and the diagnostic output was leaking into user-facing
  // system reviews (QA blocker N1).
  // Short listener-facing example clauses keyed to axis/property. Exactly
  // one appears in the primary-constraint sentence — nowhere else in the
  // response. Each is a brief noun-phrase tied to what the listener hears.
  const axisExample = (axis: string): string => {
    switch (axis) {
      case 'warm_bright': return 'less weight under male vocals';
      case 'smooth_detailed': return 'shorter cymbal decay';
      case 'elastic_controlled': return 'bass notes starting a fraction late';
      case 'airy_closed': return 'less air between instruments';
      case 'scale_intimacy': return 'a narrower stage between the speakers';
      default: return 'thinner body on sustained notes';
    }
  };
  const propertyExample = (prop: string): string => {
    const key = prop.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const map: Record<string, string> = {
      low_stored_energy: 'shorter decay on snare hits',
      transient_speed: 'harder leading edges on plucked strings',
      tonal_density: 'less body in the lower vocal register',
      harmonic_density: 'less bloom around piano notes',
      dynamic_elasticity: 'a flatter rise into crescendos',
      microdetail: 'quieter room tone behind the performers',
    };
    return map[key] ?? 'less body on sustained notes';
  };

  if (primary.kind === 'bottleneck') {
    const axesText = primary.axes.slice(0, 2).map(listenerAxisLabel).join(' and ');
    const role = primary.role.toUpperCase().length <= 4 ? primary.role.toUpperCase() : primary.role.toLowerCase();
    const example = axisExample(primary.axes[0]);
    constraintParts.push(
      `The main limitation is the **${primary.component}**. It reduces ${axesText} — for example, ${example}. Everything downstream can only resolve what the ${role} provides.`,
    );
  } else if (primary.kind === 'component') {
    const role = primary.role.toUpperCase().length <= 4 ? primary.role.toUpperCase() : primary.role.toLowerCase();
    const isTierDetected = primary.weakness.includes('weakest link in the system');
    if (isTierDetected) {
      constraintParts.push(
        `The main limitation is the **${primary.name}**. The rest of the system can resolve more than the ${role} provides. You are hearing what the ${role} allows, not what the system is capable of.`,
      );
    } else {
      constraintParts.push(
        `The clearest limitation is the **${primary.name}**: ${primary.weakness}. This is where the system stops scaling.`,
      );
    }
  } else if (primary.kind === 'imbalance') {
    const contribs = primary.contributors.join(' and ');
    const example = propertyExample(primary.property);
    const favors =
      axes.warm_bright === 'warm' || axes.smooth_detailed === 'smooth'
        ? 'the system favours acoustic, vocal, and jazz over hard rock or fast electronic material'
        : axes.elastic_controlled === 'controlled' || axes.smooth_detailed === 'detailed'
          ? 'the system favours rhythm-led rock, jazz, and electronic over dense orchestral and large-scale vocal work'
          : 'the system serves some material more generously than the opposite lean';
    void contribs;
    // ── Listener-facing lean descriptor. ─────────────────────────────
    // Only describe the system as "controlled / tight" when the axis
    // profile actually shows damping or restraint. When the traits
    // combine into coherent timing without conflicting damping, invert
    // the framing to "flowing / elastic" — the sentence must match the
    // actual listening experience, not the raw trait direction.
    const isDamped =
      axes.elastic_controlled === 'controlled' ||
      axes.smooth_detailed === 'detailed';
    const isFlowing =
      axes.elastic_controlled === 'elastic' ||
      (axes.elastic_controlled === 'neutral' && axes.smooth_detailed !== 'detailed');
    const leanDescriptor = isDamped
      ? 'controlled rather than relaxed, precise rather than loose'
      : isFlowing
        ? 'flowing rather than stiff, elastic rather than clipped'
        : 'even rather than exaggerated, coherent rather than rushed';
    constraintParts.push(
      `The clearest constraint is **${listenerPropertyLabel(primary.property)}**. The system leans ${leanDescriptor} — for example, ${example}. On familiar material, ${favors}.`,
    );
  }
  // primary.kind === 'none' falls through with constraintParts empty;
  // the section is suppressed entirely below.

  // No secondary "Also worth noting" tail — the primary is the point.
  //
  // COHERENT vs. CONSTRAINED distinction:
  //   - Coherent system (isCoherent): components share deliberate voicing.
  //     → "System trade-offs" — frame axis stacking as identity with
  //       explicit trade-off detail. No bottleneck language.
  //   - Constrained system (!isCoherent, bottleneck found):
  //     → "Where the system is constrained" — existing bottleneck narrative.
  //   - Neither: section suppressed entirely.

  let constraintsSection: string;

  if (findings.isCoherent && findings.coherentSharedTraits.length > 0) {
    // ── Coherent system: trade-offs as primary leverage ──
    // Concise: what it prioritises, what it trades, one listening consequence.
    const traitsList = findings.coherentSharedTraits.join(', ');
    const tradeoffsList = findings.coherentTradeoffs.join(', ');

    constraintsSection = [
      `**System trade-offs**`,
      ``,
      `The system prioritises ${traitsList}. The trade-off: ${tradeoffsList}. These are architectural choices, not deficiencies.`,
    ].join('\n');
  } else if (dominantInsight === 'bottleneck' && constraintParts.length > 0) {
    // ── True constraint: existing bottleneck narrative ──
    constraintsSection = [`**Where the system is constrained**`, ``, ...constraintParts].join('\n');
  } else {
    constraintsSection = '';
  }

  // Identity section removed per output contract — redundant with thesis.

  // ── Primary leverage section (output contract: mandatory) ──
  // Exactly ONE component. Explicit. No vague language.
  let primaryLeverageSection: string;
  if (primary.kind === 'bottleneck') {
    const axesText = primary.axes.slice(0, 2).map(listenerAxisLabel).join(' and ');
    primaryLeverageSection = [
      `**Primary leverage**`,
      ``,
      `Primary leverage: ${primary.component}`,
      `Controls: ${axesText}`,
      `Change this → more ${axesText} from the entire system`,
    ].join('\n');
  } else if (primary.kind === 'component') {
    const controlsText = primary.weakness.includes('weakest link')
      ? 'overall resolution ceiling'
      : primary.weakness.replace(/\.+$/, '');
    primaryLeverageSection = [
      `**Primary leverage**`,
      ``,
      `Primary leverage: ${primary.name}`,
      `Controls: ${controlsText}`,
      `Change this → unlock what the rest of the chain can already deliver`,
    ].join('\n');
  } else if (primary.kind === 'imbalance') {
    const prop = humanizeProperty(primary.property);
    primaryLeverageSection = [
      `**Primary leverage**`,
      ``,
      `Primary leverage: system balance (${prop})`,
      `Controls: ${prop} across the chain`,
      `Change this → more even response across material`,
    ].join('\n');
  } else {
    // ── KEEP with no bottleneck: identify DAC as voicing leverage ──
    // When no structural constraint exists, the DAC is the preference-
    // shaping component — changing it shifts tonal character without
    // fixing a deficiency. This applies to both coherent and compensating
    // systems: the DAC sets the tonal foundation either way.
    const dacName = findings.activeDACInference.activeDACName;
    const dacComp = dacName
      ? comps.find(c => c.name === dacName)
      : comps.find(c => (c.role || '').toLowerCase() === 'dac');
    if (dacComp) {
      primaryLeverageSection = [
        `**Primary leverage**`,
        ``,
        `Primary leverage: ${dacComp.name} (DAC voicing)`,
        `Controls: tonal balance and system character`,
        `Change this → more tonal density, body, and decay if desired`,
      ].join('\n');
    } else {
      primaryLeverageSection = [
        `**Primary leverage**`,
        ``,
        `Primary leverage: none — system is at equilibrium`,
        `Controls: n/a`,
        `Change this → n/a (no single component limits the system)`,
      ].join('\n');
    }
  }

  // Do nothing check: max 2 lines (output contract).
  // System-specific: reference the actual balance this system provides
  // and what the listener is likely valuing.
  let doNothingLine1: string;
  let doNothingLine2: string;

  if (hasContrast && downstreamComps.length > 0 && upstreamComps.length > 0) {
    // System has upstream/downstream contrast — reference the balance
    const balanceQuality =
      (upBright > 0 || upDetailed > 0) && (downWarm > 0 || downSmooth > 0)
        ? 'the balance of clarity and body'
        : (upWarm > 0) && (downBright > 0)
          ? 'the balance of warmth and articulation'
          : 'the balance';
    doNothingLine1 = `If you value ${balanceQuality} this system provides, there is no reason to change it.`;
    // Second line: explain what creates the balance
    const counterComp = downstreamComps[0]?.name ?? 'the speakers';
    const upstreamTrait = upBright > 0 || upDetailed > 0 ? 'warmth that the upstream chain deliberately omits' : 'clarity that the upstream chain does not prioritise';
    doNothingLine2 = `The ${counterComp} ${downstreamComps.length === 1 ? 'is' : 'are'} doing the work of adding ${upstreamTrait}.`;
  } else if (keeps.length > 0) {
    const keepNames = keeps.slice(0, 3).map(k => k.name);
    doNothingLine1 = `${keepNames.join(', ')} define this system's character — replacing any changes the sound significantly.`;
    doNothingLine2 = 'If the system sounds right to you, that coherence is worth preserving.';
  } else {
    doNothingLine1 = `The system already works. Swapping components without clear cause risks an adjustment period with no guaranteed improvement.`;
    doNothingLine2 = 'If the music sounds engaging, the system is doing its job.';
  }

  const doNothingCheck = [
    `**Do nothing check**`,
    ``,
    `${doNothingLine1} ${doNothingLine2}`,
  ].join('\n');

  // ── Optimize section ──
  // Single move, aligned to the primary constraint. If the analysis
  // identified clear "keep" components, lead with an explicit do-not-touch
  // line — this is one of the strongest expert tells in the reference
  // example, and it costs nothing because the data is already in `keeps`.
  const optimizeParts: string[] = [];
  // Exclude the primary-constraint component from the do-not-touch list —
  // the optimize section cannot simultaneously tell the user to change X
  // and not touch X.
  const primaryConstraintName =
    primary.kind === 'bottleneck' ? primary.component
    : primary.kind === 'component' ? primary.name
    : null;
  const primaryKey = primaryConstraintName
    ? primaryConstraintName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    : null;
  const doNotTouch = keeps
    .filter(k => {
      if (!primaryKey) return true;
      const kKey = k.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      return kKey !== primaryKey;
    })
    .slice(0, 3)
    .map(k => k.name);
  if (doNotTouch.length > 0) {
    optimizeParts.push(`**Do not touch:** ${doNotTouch.join(', ')}.`);
    optimizeParts.push('');
  }

  // Find a real swap step from the sequence — generic-sentence rows are
  // filtered out as before. Also filter out any step that targets a
  // do-not-touch component (keeps), so the optimize line cannot contradict
  // the do-not-touch line above it.
  const doNotTouchKeys = new Set(
    doNotTouch.map(n => n.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()),
  );
  const realSteps = sequence.filter((s) => {
    const role = (s.targetRole ?? '').trim();
    if (!role) return false;
    if (/[.!?]/.test(role)) return false;
    if (role.split(/\s+/).length > 4) return false;
    const actionKey = (s.action ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    for (const k of doNotTouchKeys) {
      if (k && actionKey.includes(k)) return false;
    }
    return true;
  });

  // Advisor-tone wording, branched on dominantInsight.
  // Bottleneck mode: lead with a clear "Change the X" directive.
  // Identity mode: frame all changes as lateral, not upgrades.
  let chosenStepText: string;
  if (dominantInsight === 'bottleneck') {
    // We have a real bottleneck or component-level limitation.
    const targetRole = (primary as { role: string }).role;
    const role = targetRole.toUpperCase().length <= 4 ? targetRole.toUpperCase() : targetRole.toLowerCase();
    const matchedStep = realSteps.find((s) => {
      const r = s.targetRole.toLowerCase();
      return r.includes(targetRole.toLowerCase()) || targetRole.toLowerCase().includes(r);
    });
    const lead = matchedStep ? `**${matchedStep.action}.**` : `**Change the ${role}.**`;
    // Build a listener-terms result phrase from the bottleneck axes when available.
    let resultPhrase = 'Expect more depth, more texture, more space.';
    if (primary.kind === 'bottleneck' && primary.axes.length > 0) {
      const axesText = primary.axes.slice(0, 2).map(listenerAxisLabel).join(' and ');
      if (axesText) resultPhrase = `Expect more ${axesText}.`;
    }
    chosenStepText = `${lead} ${resultPhrase}`;
  } else {
    // Identity mode — no single component to blame.
    chosenStepText =
      `There are no clear bottlenecks here.\n\nAny change would shift the sound rather than fix a problem. Swapping a component is a lateral move, not an upgrade.\n\nConsider room setup and positioning before swapping components.`;
  }

  optimizeParts.push(chosenStepText);
  const actionPathSection = [`**Action path**`, ``, ...optimizeParts].join('\n');

  // ── Decision section (output contract: KEEP / CHANGE [component] / UPGRADE PATH) ──
  // No hedging. Must follow directly from primary leverage.
  let decisionVerdict: string;
  let riskLevel: string;
  if (dominantInsight === 'identity' || primary.kind === 'none') {
    decisionVerdict = 'KEEP';
    riskLevel = 'LOW';
  } else if (primary.kind === 'bottleneck' || primary.kind === 'component') {
    const compName = primary.kind === 'bottleneck' ? primary.component : primary.name;
    decisionVerdict = `CHANGE ${compName}`;
    riskLevel = 'LOW';
  } else {
    // Imbalance — no single component swap fixes it
    decisionVerdict = 'UPGRADE PATH';
    riskLevel = 'MEDIUM';
  }

  // Decision: verdict + one-line reason.
  // For KEEP systems with no bottleneck, reference DAC voicing as the optional change path.
  const dacForDecision = (decisionVerdict === 'KEEP')
    ? (findings.activeDACInference.activeDACName
      ?? comps.find(c => (c.role || '').toLowerCase() === 'dac')?.name)
    : null;
  const decisionReason =
    decisionVerdict === 'KEEP'
      ? (dacForDecision
        ? `No component is holding the system back. If you want more tonal density, change ${dacForDecision} first.`
        : 'No component is holding the system back.')
      : decisionVerdict === 'UPGRADE PATH'
        ? 'The imbalance is architectural — a directional shift, not a single swap.'
        : `It limits what the rest of the chain can deliver.`;

  const decisionSection = [
    `**Decision**`,
    ``,
    `${decisionVerdict} — ${decisionReason}`,
  ].join('\n');

  // ── Trade-offs section (max 3 lines, output contract) ──
  // ── Trade-offs (output contract: You gain / You give up / Watch out for) ──
  let tradeOffGain: string;
  let tradeOffGiveUp: string;
  let tradeOffWatch: string;

  if (decisionVerdict === 'KEEP') {
    if (dacForDecision) {
      tradeOffGain = `You gain: more body, density, and harmonic weight (if you change ${dacForDecision})`;
      tradeOffGiveUp = `You give up: the speed and transparency ${dacForDecision} currently provides`;
      tradeOffWatch = 'Watch out for: swapping clarity for warmth without gaining engagement';
    } else {
      tradeOffGain = 'You gain: nothing new — system is at equilibrium';
      tradeOffGiveUp = 'You give up: access to qualities outside this architecture';
      tradeOffWatch = 'Watch out for: restlessness mistaken for a real problem';
    }
  } else {
    // What you gain — derived from bottleneck axes or constraint
    let gainText: string;
    if (primary.kind === 'bottleneck' && primary.axes.length > 0) {
      gainText = primary.axes.slice(0, 2).map(listenerAxisLabel).join(' and ');
    } else if (primary.kind === 'component') {
      gainText = 'resolution at the constrained link';
    } else if (primary.kind === 'imbalance') {
      gainText = `balance across ${humanizeProperty(primary.property)}`;
    } else {
      gainText = 'overall coherence';
    }
    tradeOffGain = `You gain: ${gainText}`;
    // What you give up
    tradeOffGiveUp = keeps.length > 0
      ? `You give up: existing synergy between ${keeps.slice(0, 2).map(k => k.name).join(' and ')}`
      : 'You give up: familiarity — the system will sound different before it sounds better';
    // Watch out for
    tradeOffWatch = keeps.length > 0
      ? `Watch out for: breaking what ${keeps[0].name} currently does well`
      : 'Watch out for: lateral moves that sound different but not more engaging';
  }

  const tradeOffsSection = [
    `**Trade-offs**`,
    ``,
    tradeOffGain,
    tradeOffGiveUp,
    tradeOffWatch,
  ].join('\n');

  // ── Final assembly (output contract) ──
  // Sections:
  //   1. System read (thesis, max 2 sentences)
  //   2. System logic (Component → Behavior → Effect, max 4 rows)
  //   3. What the system does well (max 3 bullets)
  //   4. Where the system is constrained / System trade-offs
  //   5. Primary leverage (mandatory)
  //   6. Decision (KEEP / CHANGE [x] / UPGRADE PATH)
  //   7. Trade-offs (You gain / You give up / Watch out for)
  //   8. Action path (when not KEEP)
  //   9. Do nothing check (max 2 lines)
  void riskLevel; // suppressed — was appended to action path, now removed for brevity

  return [
    overview,
    systemLogicSection,
    strengthsSection,
    constraintsSection,
    primaryLeverageSection,
    decisionSection,
    tradeOffsSection,
    decisionVerdict === 'KEEP' ? '' : actionPathSection,
    doNothingCheck,
  ]
    .filter((s) => typeof s === 'string' && s.trim().length > 0)
    .join('\n\n');
}

function describeCoreIdentity(axes: PrimaryAxisLeanings): string {
  if (axes.warm_bright === 'warm' && axes.smooth_detailed === 'smooth') return 'a tone-first system built for extended listening';
  if (axes.warm_bright === 'warm' && axes.elastic_controlled === 'elastic') return 'a tone-and-flow system that favours musical continuity over analytical precision';
  if (axes.smooth_detailed === 'detailed' && axes.elastic_controlled === 'controlled') return 'a resolution-first system that prioritises precision and control';
  if (axes.warm_bright === 'bright' && axes.smooth_detailed === 'detailed') return 'a transparency-first system';
  if (axes.elastic_controlled === 'elastic') return 'a flow-first system';
  if (axes.elastic_controlled === 'controlled') return 'a control-first system';
  return 'a balanced system with no dominant bias';
}
function rewardFromAxes(axes: PrimaryAxisLeanings): string {
  if (axes.warm_bright === 'warm' || axes.smooth_detailed === 'smooth') return 'extended listening sessions and tonally rich recordings';
  if (axes.elastic_controlled === 'controlled' || axes.smooth_detailed === 'detailed') return 'rhythmically driven, well-engineered recordings';
  return 'a wide range of material without strong directional preference';
}
function weakFromAxes(axes: PrimaryAxisLeanings): string {
  if (axes.warm_bright === 'warm' || axes.smooth_detailed === 'smooth') return 'material that depends on sharp transients and edge';
  if (axes.elastic_controlled === 'controlled' || axes.smooth_detailed === 'detailed') return 'material that depends on body and bloom';
  return 'no specific category';
}
// Concrete, listener-facing label for an axis. Used in constraint and
// optimize bullets where the user wants to know what they will *hear*,
// not what dimension changed.
function listenerAxisLabel(a: string): string {
  switch (a) {
    case 'warm_bright': return 'tonal weight and body';
    case 'smooth_detailed': return 'inner detail and texture';
    case 'elastic_controlled': return 'rhythmic flow and grip';
    case 'airy_closed': return 'air and depth around instruments';
    case 'scale_intimacy': return 'soundstage size';
    default: return a.replace(/_/g, ' ');
  }
}
function humanizeAxis(a: string): string {
  return a
    .replace('warm_bright', 'tone')
    .replace('smooth_detailed', 'resolution')
    .replace('elastic_controlled', 'timing')
    .replace('airy_closed', 'stage')
    .replace('scale_intimacy', 'soundstage size')
    .replace(/_/g, ' ');
}
// Listener-facing label for stacked-trait property names. The raw property
// keys are short engineering tokens (e.g. "low_stored_energy"); these
// translations describe the audible result, not the mechanism.
function listenerPropertyLabel(p: string): string {
  const key = p.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const map: Record<string, string> = {
    low_stored_energy: 'clean note endings',
    transient_speed: 'attack and snap',
    tonal_density: 'body and weight',
    harmonic_density: 'tonal richness',
    dynamic_elasticity: 'elasticity',
    microdetail: 'inner detail',
    musical_flow: 'musical flow',
    stability: 'rhythmic grip',
    spatial_scale: 'soundstage size',
  };
  return map[key] ?? p.replace(/_/g, ' ');
}
function humanizeProperty(p: string): string {
  return listenerPropertyLabel(p);
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
    return `The system has balanced tendencies — no single tonal or textural direction dominates. The overall character depends on how these components interact in practice.`;
  }

  if (strongTraits.length === 1) {
    return `The system leans toward ${strongTraits[0]}, with the remaining axes staying relatively neutral.`;
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
    return `The system leans toward ${compoundDesc.join(' and ')} across multiple components — they push in the same direction, creating a strong and coherent character.`;
  }

  // ── Single-axis lean ──
  if (system.warm_bright === 'warm') {
    return `The system leans toward warmth and engagement — richness and immersion at the potential cost of transient articulation.`;
  }
  if (system.warm_bright === 'bright') {
    return `The system leans toward precision and clarity — a revealing presentation, though extended sessions may feel lean without a warmth source.`;
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
    strengths.push('Complementary tonal balance — precision and warmth offset each other across the system');
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
      return 'No single tonal or textural direction dominates here. Any change would shift the character rather than fix a gap. If you want to explore, focus on the quality you most want to intensify — but "do nothing" is a strong option.';
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
      suggestions.push('If the system feels analytically intense, consider a warmer or more fluid component — a tube stage, a smoother DAC topology, or speakers with more midrange body could restore balance.');
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
  // Dedupe components on a normalized display-name key so the same physical
  // component (free-text + catalog match, or repeated entry) appears once
  // in the rendered chain. Same key shape used by composeAssessmentNarrative.
  const seenCompKeys = new Set<string>();
  const dedupedComponents = components.filter((c) => {
    const key = (c.displayName || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key || seenCompKeys.has(key)) return false;
    seenCompKeys.add(key);
    return true;
  });
  const sorted = [...dedupedComponents].sort((a, b) => roleSort(a.role) - roleSort(b.role));
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
      return `${tierPrefix}${traitPhrase}.${deliberateNote} The system leans toward ${imbalances[0].label} across multiple stages — this shapes both its strengths and its primary limitation.${intentNote}`;
    }
    if (characters.length > 0) {
      return `${tierPrefix}${traitPhrase}.${deliberateNote} The system shares a consistent lean toward ${characters[0].label} — this defines the system's sonic identity rather than limiting it.${intentNote}`;
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
    return 'The axis profile points toward a listener who prioritises timing accuracy, low stored energy, and rhythmic articulation. This system rewards recordings with good transient information and tends to expose compression or overdamping elsewhere in the system.';
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
  high_density: 'The system leans into tonal richness and midrange body — immersive, harmonically saturated, physically present.',
  high_damping: 'Stacked control and damping. Composure under load is excellent, but dynamic expression and elasticity may feel suppressed.',
  low_density: 'Multiple components contribute thin midrange character. The system may lack tonal body and weight on acoustic material.',
  high_detail: 'Resolution and transparency run through the system — revealing, micro-detailed, honest with recordings.',
  high_smoothness: 'Musical flow and liquidity are the prevailing character — effortless, non-fatiguing, easy to listen to for hours.',
  high_elasticity: 'Rhythmic energy and dynamic expression are a shared emphasis — alive, punchy, musically engaging.',
  high_control: 'Control emphasis stacks across the system. Stability and grip are excellent, but the presentation may feel overdamped or mechanical.',
};

const IMBALANCE_EXPLANATIONS: Record<SonicProperty, string> = {
  high_speed: 'Transient speed stacks beyond typical balance. Excellent articulation, but tonal density and midrange body may be noticeably reduced.',
  low_stored_energy: 'Multiple low-stored-energy components produce fast, articulate sound. Extended listening may feel lean on harmonically dense material.',
  high_density: 'The system stacks tonal density beyond typical balance — rich midrange, but transient precision and spatial separation may be constrained.',
  high_damping: 'Stacked control and damping. Composure under load is excellent, but dynamic expression and elasticity may feel suppressed.',
  low_density: 'Multiple components contribute thin midrange character. The system may lack tonal body and weight on acoustic material.',
  high_detail: 'Detail emphasis stacks beyond typical balance. Microdetail retrieval is strong, but lesser recordings may sound unforgiving.',
  high_smoothness: 'Smoothness stacks beyond typical balance. Musical flow is excellent, but transient edges and fine detail may be softened.',
  high_elasticity: 'Dynamic energy stacks beyond typical balance. Rhythmic engagement is strong, but composure on complex passages may be limited.',
  high_control: 'Control emphasis stacks across the system. Stability and grip are excellent, but the presentation may feel overdamped or mechanical.',
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

// ── Voicing coherence detection ──────────────────────
//
// Distinguishes "coherent system with trade-offs" from "constrained system."
// When components share aligned primary axes AND are from specialist/boutique
// brands, the system is intentionally voiced — axis stacking is identity,
// not a bottleneck. This gate prevents the engine from labelling deliberate
// voicing choices as performance limitations.

interface VoicingCoherenceResult {
  /** True when components share ≥2 aligned non-neutral axes and are specialist/boutique. */
  isCoherent: boolean;
  /** The shared axis directions that define the system's voice. */
  sharedTraits: string[];
  /** What the coherent voicing trades away — the deliberate cost. */
  tradeoffs: string[];
  /** Number of primary axes where all components agree. */
  alignedAxisCount: number;
}

function assessVoicingCoherence(
  components: SystemComponent[],
  profiles: ComponentAxisProfile[],
  system: PrimaryAxisLeanings,
): VoicingCoherenceResult {
  const none: VoicingCoherenceResult = { isCoherent: false, sharedTraits: [], tradeoffs: [], alignedAxisCount: 0 };

  // Need at least 2 components with known axis profiles
  const withAxes = profiles.filter(p =>
    p.axes.warm_bright !== 'neutral' ||
    p.axes.smooth_detailed !== 'neutral' ||
    p.axes.elastic_controlled !== 'neutral',
  );
  if (withAxes.length < 2) return none;

  // Check brand quality — coherence defence only applies to specialist/boutique brands
  // where voicing is an intentional design choice, not a budget limitation.
  const specialistCount = components.filter(c =>
    c.product?.brandScale === 'boutique' || c.product?.brandScale === 'specialist',
  ).length;
  if (specialistCount < 2) return none;

  // Count axes where ALL profiled components agree on the same non-neutral direction
  const axisChecks: Array<{
    axis: string;
    systemValue: string;
    trait: string;
    tradeoff: string;
  }> = [
    {
      axis: 'warm_bright',
      systemValue: system.warm_bright,
      trait: system.warm_bright === 'warm' ? 'tonal density and harmonic richness' : 'transient precision and clarity',
      tradeoff: system.warm_bright === 'warm' ? 'transient edge and analytical detail' : 'tonal body and midrange warmth',
    },
    {
      axis: 'smooth_detailed',
      systemValue: system.smooth_detailed,
      trait: system.smooth_detailed === 'smooth' ? 'musical flow and long-session ease' : 'micro-detail and textural resolution',
      tradeoff: system.smooth_detailed === 'smooth' ? 'micro-detail retrieval and leading-edge definition' : 'listening ease and tonal forgiveness',
    },
    {
      axis: 'elastic_controlled',
      systemValue: system.elastic_controlled,
      trait: system.elastic_controlled === 'elastic' ? 'rhythmic elasticity and dynamic expression' : 'bass grip and composure under load',
      tradeoff: system.elastic_controlled === 'elastic' ? 'iron grip on bass and composure on complex passages' : 'dynamic expressiveness and rhythmic swing',
    },
  ];

  let alignedCount = 0;
  const sharedTraits: string[] = [];
  const tradeoffs: string[] = [];

  for (const check of axisChecks) {
    if (check.systemValue === 'neutral') continue;

    // Check if all profiled components lean the same direction on this axis
    const axisKey = check.axis as keyof PrimaryAxisLeanings;
    const allAligned = withAxes.every(p => {
      const val = p.axes[axisKey];
      return val === check.systemValue || val === 'neutral' || val === 'moderate';
    });

    if (allAligned) {
      alignedCount++;
      sharedTraits.push(check.trait);
      tradeoffs.push(check.tradeoff);
    }
  }

  // Coherent when ≥ 2 axes are deliberately aligned across the system
  const isCoherent = alignedCount >= 2;

  return { isCoherent, sharedTraits, tradeoffs, alignedAxisCount: alignedCount };
}


// ── Bottleneck detection ────────────────────────────
//
// Identifies the primary system constraint — the factor that most
// limits the system relative to its architectural potential.
// Pipeline: axis analysis + trait data + stacked traits → constraint ranking.
//
// IMPORTANT: voicing coherence suppresses tonal_imbalance and stacked_bias
// candidates. When components share deliberate voicing, axis stacking is
// system identity — not a constraint. Only hard constraints (power mismatch,
// impedance, capability gaps) survive the coherence gate.

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
  coherence?: VoicingCoherenceResult,
): MemoPrimaryConstraint | undefined {
  const candidates: ConstraintCandidate[] = [];

  // ── Stacked bias constraint (system-level, not per-component) ──
  // Only system_imbalance traits count as constraints. system_character
  // traits define the system's sonic identity and are not penalized.
  // Speakers/headphones define system character — stacking with them is
  // intentional alignment, not a constraint. Blame non-speaker components.
  //
  // COHERENCE GATE: When voicing coherence is detected, stacked_bias is
  // suppressed entirely — the stacking IS the system's deliberate voice.
  const imbalanceTraits = stacked.filter((s) => s.classification === 'system_imbalance');
  if (imbalanceTraits.length > 0 && !coherence?.isCoherent) {
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
        explanation: `The ${topContributor} is reinforcing the system's lean toward ${dominant.label} — addressing it would open up the most room for improvement.`,
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
        issues.push('portable DAC in a speaker system — output authority and scale may limit the system');
      }
      if (severity > 0) {
        candidates.push({
          componentName: c.displayName,
          category: 'dac_limitation',
          explanation: `The DAC is holding back the system — ${issues.join(', ')}. Everything downstream inherits its limitations.`,
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
          explanation: `The amplifier is the limiting factor — ${issues.join(', ')}.`,
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
          explanation: `The speakers are where the system is most limited — ${issues.join(', ')}. They set the output ceiling for everything upstream.`,
          severity,
        });
      }
    }
  }

  // ── Tonal imbalance (system-level) ──
  // COHERENCE GATE: When components share deliberate voicing (specialist/
  // boutique brands with aligned axes), tonal stacking is identity — not
  // an imbalance. Only flag when the lean is accidental.
  const warmCount = profiles.filter((p) => p.axes.warm_bright === 'warm').length;
  const brightCount = profiles.filter((p) => p.axes.warm_bright === 'bright').length;
  if (warmCount >= 2 && brightCount === 0 && !coherence?.isCoherent) {
    const warmContributors = profiles.filter((p) => p.axes.warm_bright === 'warm').map((p) => p.name);
    candidates.push({
      componentName: warmContributors[0],
      category: 'tonal_imbalance',
      explanation: `System-wide warmth bias without counterbalance. ${warmContributors.join(' and ')} compound tonal density, potentially reducing transient precision.`,
      severity: warmCount * 2,
    });
  }
  if (brightCount >= 2 && warmCount === 0 && !coherence?.isCoherent) {
    const brightContributors = profiles.filter((p) => p.axes.warm_bright === 'bright').map((p) => p.name);
    candidates.push({
      componentName: brightContributors[0],
      category: 'tonal_imbalance',
      explanation: `System-wide brightness bias. ${brightContributors.join(' and ')} compound analytical character, potentially thinning tonal body and increasing fatigue risk.`,
      severity: brightCount * 2,
    });
  }

  // ── Amp/speaker power mismatch ──
  // Uses power_watts and sensitivity_db from product data. When both
  // are available, calculates estimated max clean SPL and flags
  // strained or mismatched pairings. Severity is high because power
  // mismatch is more fundamental than axis-based constraints.
  const powerMatch = assessPowerMatch(components);
  if (powerMatch.compatibility === 'mismatched' && powerMatch.ampName && powerMatch.speakerName) {
    const splNote = powerMatch.estimatedMaxCleanSPL != null
      ? ` Estimated max clean SPL is ~${Math.round(powerMatch.estimatedMaxCleanSPL)} dB — well below comfortable listening levels for dynamic music.`
      : '';
    candidates.push({
      componentName: powerMatch.ampName,
      category: 'power_match',
      explanation: `The ${powerMatch.ampName} (${powerMatch.ampPowerWatts}W) cannot adequately drive the ${powerMatch.speakerName} (${powerMatch.speakerSensitivityDb} dB sensitivity).${splNote} Dynamics will compress significantly, bass control will suffer, and the system will run out of headroom at moderate listening levels. Either more amplifier power or higher-efficiency speakers would resolve this.`,
      severity: 9,
    });
  } else if (powerMatch.compatibility === 'strained' && powerMatch.ampName && powerMatch.speakerName) {
    const splNote = powerMatch.estimatedMaxCleanSPL != null
      ? ` Estimated max clean SPL is ~${Math.round(powerMatch.estimatedMaxCleanSPL)} dB — adequate for quiet listening but limited on dynamic peaks.`
      : '';
    candidates.push({
      componentName: powerMatch.ampName,
      category: 'power_match',
      explanation: `The ${powerMatch.ampName} (${powerMatch.ampPowerWatts}W) is working hard to drive the ${powerMatch.speakerName} (${powerMatch.speakerSensitivityDb} dB sensitivity).${splNote} Dynamic compression on peaks is likely, and the amp may lose composure on complex passages. More headroom — either through amplifier power or speaker efficiency — would improve dynamic expression.`,
      severity: 6,
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
      verdict = `**This is the primary constraint in this system.** Upgrading here yields the highest system-level impact.`;
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

// ── Upgrade-path product selection ──────────────────
//
// For each upgrade path, select 2–3 catalog products matching the target role.
// Products are ranked by price proximity to the user's current component in that
// role, with a slight boost for products that contrast the current axis weaknesses.
// The user's own component is excluded.

/** Map ProductCategory → ReviewerDomain for curation lookups. */
const CATEGORY_TO_REVIEWER_DOMAIN: Record<string, ReviewerDomain> = {
  dac: 'dac', speaker: 'speaker', amplifier: 'tube-amp',
  streamer: 'streamer', turntable: 'turntable', cartridge: 'cartridge',
  headphone: 'headphone', phono: 'general',
};

const ROLE_TO_CATEGORY: Record<string, import('./catalog-taxonomy').ProductCategory> = {
  dac: 'dac', speakers: 'speaker', speaker: 'speaker',
  amplifier: 'amplifier', preamplifier: 'amplifier',
  streamer: 'streamer', turntable: 'turntable',
  cartridge: 'cartridge', 'phono stage': 'phono',
  headphones: 'headphone', subwoofer: 'speaker',
};

const TOPOLOGY_DISPLAY: Record<string, string> = {
  'fpga': 'FPGA DAC',
  'r2r': 'R2R DAC',
  'delta-sigma': 'Delta-sigma DAC',
  'set': 'Single-ended triode',
  'push-pull-tube': 'Push-pull tube',
  'hybrid': 'Hybrid tube/solid-state',
  'class-a-solid-state': 'Class A solid-state',
  'class-ab-solid-state': 'Class AB solid-state',
  'class-d': 'Class D',
  'belt-drive': 'Belt-drive turntable',
  'direct-drive': 'Direct-drive turntable',
  'bass-reflex': 'Ported speaker',
  'sealed': 'Sealed speaker',
  'horn-loaded': 'Horn-loaded speaker',
  'open-baffle': 'Open-baffle speaker',
  'planar-magnetic': 'Planar magnetic',
};

/**
 * Safely extract the first sentence from a product's tendencies.character field.
 *
 * The canonical type is CharacterTendency[] (array of { domain, tendency, ... }),
 * but some legacy inline data may pass a plain string. This helper normalises
 * both shapes and guards against malformed entries.
 */
function getCharacterSentence(character: unknown): string | undefined {
  if (Array.isArray(character)) {
    const first = character.find((t: Record<string, unknown>) => t?.tendency);
    const sentence = typeof first?.tendency === 'string'
      ? first.tendency.split('.')[0]
      : undefined;
    return sentence?.trim() || undefined;
  }
  if (typeof character === 'string') {
    const sentence = character.split('.')[0];
    return sentence?.trim() || undefined;
  }
  return undefined;
}

// ── Recommendation type classification ────────────────
//
// Compares current component against a candidate to determine whether the
// recommendation is a true upgrade, a directional change, or a sidegrade.
//
// Engine-portable: the classifier uses generic axis comparison, philosophy
// strings, and price ratios. No audio-specific vocabulary in the logic
// itself — axis names and philosophy values come from the catalog layer.

interface RecommendationClassification {
  type: 'upgrade' | 'directional' | 'sidegrade';
  gains: string[];
  losses: string[];
}

const AXIS_GAIN_LABELS: Record<string, Record<string, string>> = {
  warm_bright:        { warm: 'tonal density and midrange richness', bright: 'transient speed and air' },
  smooth_detailed:    { smooth: 'listening ease and musical flow', detailed: 'micro-detail and texture resolution' },
  elastic_controlled: { elastic: 'rhythmic flow and dynamic looseness', controlled: 'grip, precision, and bass control' },
  airy_closed:        { airy: 'spatial openness and staging', closed: 'focus and intimacy' },
};

function classifyRecommendation(
  current: { primaryAxes?: Record<string, string>; philosophy?: string; price: number; archetypes?: { primary?: string; secondary?: string } },
  candidate: { primaryAxes?: Record<string, string>; philosophy?: string; price: number; archetypes?: { primary?: string; secondary?: string } },
): RecommendationClassification {
  const gains: string[] = [];
  const losses: string[] = [];

  // Count axis flips: axes where candidate and current differ (non-neutral)
  let axisFlips = 0;
  const AXIS_KEYS = ['warm_bright', 'smooth_detailed', 'elastic_controlled', 'airy_closed'];
  const cAxes = current.primaryAxes ?? {};
  const pAxes = candidate.primaryAxes ?? {};

  for (const axis of AXIS_KEYS) {
    const cVal = cAxes[axis] ?? 'neutral';
    const pVal = pAxes[axis] ?? 'neutral';
    if (cVal === pVal) continue; // same direction or both neutral — no flip

    // Candidate has a direction where current is neutral → potential improvement
    if (cVal === 'neutral' && pVal !== 'neutral') {
      const label = AXIS_GAIN_LABELS[axis]?.[pVal];
      if (label) gains.push(label);
      continue;
    }

    // Current has a direction where candidate is neutral → potential loss
    if (pVal === 'neutral' && cVal !== 'neutral') {
      const label = AXIS_GAIN_LABELS[axis]?.[cVal];
      if (label) losses.push(label);
      continue;
    }

    // Both have different non-neutral values → clear axis flip (directional)
    axisFlips++;
    const gainLabel = AXIS_GAIN_LABELS[axis]?.[pVal];
    const lossLabel = AXIS_GAIN_LABELS[axis]?.[cVal];
    if (gainLabel) gains.push(gainLabel);
    if (lossLabel) losses.push(lossLabel);
  }

  // Philosophy comparison
  const cPhil = current.philosophy ?? '';
  const pPhil = candidate.philosophy ?? '';
  const philosophyDiffers = cPhil !== '' && pPhil !== '' && cPhil !== pPhil;

  // Archetype comparison (primary design intent)
  const cArch = current.archetypes?.primary ?? '';
  const pArch = candidate.archetypes?.primary ?? '';
  const archetypeDiffers = cArch !== '' && pArch !== '' && cArch !== pArch;

  // Price tier comparison for sidegrade detection
  const priceRatio = candidate.price / Math.max(current.price, 1);
  const sameTier = priceRatio >= 0.75 && priceRatio <= 1.35;

  // Classification rules:
  //
  // DIRECTIONAL: any axis flip (opposite non-neutral values), or philosophy
  //   differs with archetype flip. This is a change in character, not a
  //   strict improvement.
  //
  // SIDEGRADE: no axis flips but philosophy or archetype differs, and price
  //   is within the same tier. Different flavor, not different level.
  //
  // UPGRADE: same philosophy + same archetype direction (or no difference
  //   detected), candidate is at same or higher tier. Strictly better within
  //   the same design intent.

  if (axisFlips > 0) {
    return { type: 'directional', gains, losses };
  }

  if ((philosophyDiffers || archetypeDiffers) && sameTier) {
    return { type: 'sidegrade', gains, losses };
  }

  if (philosophyDiffers || archetypeDiffers) {
    return { type: 'directional', gains, losses };
  }

  return { type: 'upgrade', gains, losses };
}

function selectUpgradeOptions(
  pathLabel: string,
  components: SystemComponent[],
  weaknesses: string[],
  maxOptions = 3,
): import('./advisory-response').UpgradePathOption[] {
  // Map path label (e.g. "DAC Upgrade") → product category
  const roleKey = pathLabel.replace(/\s+(Upgrade|Change)$/i, '').toLowerCase();
  const category = ROLE_TO_CATEGORY[roleKey];
  if (!category) return [];

  // Find the user's current component in this role
  const currentComponent = components.find((c) =>
    canonicalRole(c.role).toLowerCase() === roleKey
    || c.role.toLowerCase().includes(roleKey),
  );
  const currentProduct = currentComponent?.product;
  const currentPrice = currentProduct?.price ?? 1000;
  const currentName = currentComponent?.displayName?.toLowerCase() ?? '';

  // Filter catalog: same category, exclude user's current product
  const candidates = ALL_PRODUCTS.filter((p) => {
    if (p.category !== category) return false;
    // Exclude the user's own product
    if (currentName && `${p.brand} ${p.name}`.toLowerCase() === currentName) return false;
    if (currentProduct && p.id === currentProduct.id) return false;
    // Only include products that represent an upgrade (at least 70% of current price)
    if (p.price < currentPrice * 0.7) return false;
    // Cap at 3× current price to stay in tier
    if (p.price > currentPrice * 3) return false;
    return true;
  });

  if (candidates.length === 0) return [];

  // Score: prefer price proximity + axis contrast with current weaknesses
  const scored = candidates.map((p) => {
    // Price proximity (closer = better, slight preference for modestly higher)
    const priceRatio = p.price / currentPrice;
    const priceDist = Math.abs(Math.log(priceRatio));
    let score = 10 - priceDist * 5;

    // Prefer current models: penalty for discontinued/vintage
    const avail = p.availability ?? 'current';
    if (avail === 'discontinued') score -= 3;
    if (avail === 'vintage') score -= 5;

    // Slight boost for products with primaryAxes that contrast weaknesses
    if (p.primaryAxes && weaknesses.length > 0) {
      const w = weaknesses.join(' ').toLowerCase();
      if (w.includes('bright') || w.includes('thin')) {
        if (p.primaryAxes.warm_bright === 'warm') score += 2;
      }
      if (w.includes('warm') || w.includes('dull') || w.includes('veiled')) {
        if (p.primaryAxes.warm_bright === 'bright') score += 2;
      }
      if (w.includes('smooth') || w.includes('soft')) {
        if (p.primaryAxes.smooth_detailed === 'detailed') score += 2;
      }
      if (w.includes('detailed') || w.includes('harsh') || w.includes('fatiguing')) {
        if (p.primaryAxes.smooth_detailed === 'smooth') score += 2;
      }
    }

    return { product: p, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top N and build UpgradePathOption objects
  return scored.slice(0, maxOptions).map((s, i) => {
    const p = s.product;
    const priceNote = p.usedPriceRange
      ? `~$${p.usedPriceRange.low.toLocaleString()}–${p.usedPriceRange.high.toLocaleString()} used`
      : `$${p.price.toLocaleString()}`;

    // Build pros from primaryAxes
    const pros: string[] = [];
    if (p.primaryAxes) {
      const axisLabels: Record<string, Record<string, string>> = {
        warm_bright: { warm: 'Warmer tonal balance', bright: 'Faster transients and clarity' },
        smooth_detailed: { smooth: 'Musical flow and ease', detailed: 'Greater microdetail retrieval' },
        elastic_controlled: { elastic: 'Dynamic elasticity', controlled: 'Grip and stability' },
      };
      for (const [axis, val] of Object.entries(p.primaryAxes)) {
        if (val && val !== 'neutral' && axisLabels[axis]?.[val]) {
          pros.push(axisLabels[axis][val]);
        }
      }
    }
    if (pros.length === 0 && p.tendencyProfile) {
      // Fallback: derive a pro from the tendency profile's strongest direction
      const entries = Object.entries(p.tendencyProfile).filter(([_, v]) => v !== 'neutral');
      if (entries.length > 0) {
        pros.push(`Strong ${entries[0][0].replace(/_/g, ' ')} character`);
      }
    }

    // ── Topology line ──
    const topoLabel = p.topology ? TOPOLOGY_DISPLAY[p.topology] : undefined;
    const archShort = p.architecture?.split(',')[0]?.trim();
    const topologyLine = topoLabel && archShort
      ? `${topoLabel}, ${archShort}`
      : topoLabel ?? archShort ?? undefined;

    // ── What you'll hear (sensory delta) ��─
    const whatYoullHear: string[] = [];
    if (p.primaryAxes) {
      const sensoryMap: Record<string, Record<string, string>> = {
        warm_bright: {
          warm: 'Midrange gains body and richness',
          bright: 'Transients sharpen — more attack and air',
        },
        smooth_detailed: {
          smooth: 'Treble softens — less edge, more ease',
          detailed: 'Low-level textures become more visible',
        },
        elastic_controlled: {
          elastic: 'Dynamics loosen — more bounce and flow',
          controlled: 'Bass tightens and becomes more controlled',
        },
        airy_closed: {
          airy: 'Staging opens — more air and space between instruments',
          closed: 'Focus tightens — denser, more intimate presentation',
        },
      };
      for (const [axis, val] of Object.entries(p.primaryAxes)) {
        if (val && val !== 'neutral' && sensoryMap[axis]?.[val]) {
          whatYoullHear.push(sensoryMap[axis][val]);
        }
      }
    }
    // Pad from tendencies.character if under 2 items
    if (whatYoullHear.length < 2 && p.tendencies?.character) {
      const charSentence = getCharacterSentence(p.tendencies.character);
      if (charSentence) whatYoullHear.push(charSentence);
    }
    // Second pad: extract from tendencies.tradeoffs gains description
    if (whatYoullHear.length < 2 && p.tendencies?.tradeoffs) {
      const tradeoff = (p.tendencies.tradeoffs as Array<{ gains?: string }>)[0];
      if (tradeoff?.gains) {
        const gainStr = tradeoff.gains.split(',')[0]?.trim();
        if (gainStr && !whatYoullHear.some(w => w.toLowerCase().includes(gainStr.toLowerCase().slice(0, 15)))) {
          whatYoullHear.push(gainStr.charAt(0).toUpperCase() + gainStr.slice(1));
        }
      }
    }

    // ── Technical rationale (design → outcome) ──
    const technicalRationale: string[] = [];
    const archLower = (p.architecture ?? '').toLowerCase();
    const topoLower = (p.topology ?? '').toLowerCase();
    if (topoLower.includes('fpga')) {
      technicalRationale.push('FPGA timing engine \u2192 improved transient precision and phase coherence');
    } else if (topoLower.includes('r2r') || archLower.includes('r2r') || archLower.includes('ladder') || topoLower.includes('multibit') || archLower.includes('multibit')) {
      technicalRationale.push('R2R/multibit conversion \u2192 fuller tone with less digital edge');
    } else if (topoLower.includes('delta-sigma') || archLower.includes('delta-sigma')) {
      technicalRationale.push('Delta-sigma conversion \u2192 wide dynamic range and low noise floor');
    } else if (topoLower.includes('set') || topoLower.includes('single-ended')) {
      technicalRationale.push('Single-ended triode output \u2192 harmonic richness and midrange density');
    } else if (topoLower.includes('class-a')) {
      technicalRationale.push('Class A bias \u2192 smoother treble and richer midrange texture');
    } else if (topoLower.includes('class-d')) {
      technicalRationale.push('Class D output stage \u2192 high efficiency with tight low-end control');
    } else if (topoLower.includes('push-pull')) {
      technicalRationale.push('Push-pull tube topology \u2192 power headroom with harmonic warmth');
    }
    // ── Speaker topology / architecture rationale ──
    // Design choice → mechanism → audible result (speaker-specific).
    // Checked after DAC/amp topologies so they don't collide.
    // Additive: multiple can match (e.g. sealed + BBC thin-wall + coaxial).
    if (topoLower === 'sealed' || archLower.includes('sealed')) {
      technicalRationale.push('Sealed-box loading \u2192 more predictable room interaction and easier placement, without port tuning effects');
    } else if (topoLower === 'bass-reflex' || archLower.includes('bass-reflex') || archLower.includes('ported') || archLower.includes('rear-ported') || archLower.includes('front-ported')) {
      technicalRationale.push('Ported/bass-reflex loading \u2192 extended low-frequency output from a smaller cabinet');
    } else if (topoLower === 'horn-loaded' || archLower.includes('horn')) {
      technicalRationale.push('Horn-loaded design \u2192 high sensitivity and dynamic immediacy with minimal amplifier demand');
    } else if (topoLower === 'open-baffle' || archLower.includes('open-baffle') || archLower.includes('open-back')) {
      technicalRationale.push('Open-baffle design \u2192 dipole radiation pattern with natural spatial depth and minimal box coloration');
    } else if (topoLower === 'planar-magnetic' || archLower.includes('planar magnetic')) {
      technicalRationale.push('Planar-magnetic driver \u2192 low distortion and uniform diaphragm excursion for coherent large-area radiation');
    }
    // Architecture additive: can layer on top of topology match
    if (archLower.includes('bbc') || archLower.includes('thin-wall')) {
      technicalRationale.push('BBC thin-wall cabinet \u2192 midrange naturalness and reduced boxiness through controlled panel damping');
    }
    if (archLower.includes('coaxial') || archLower.includes('uni-q')) {
      technicalRationale.push('Coaxial/Uni-Q driver \u2192 point-source coherence and stable imaging across the listening window');
    }
    if ((archLower.includes('full-range') || archLower.includes('fullrange') || archLower.includes('widebander') || archLower.includes('wideband driver')) && !archLower.includes('planar')) {
      technicalRationale.push('Full-range/widebander driver \u2192 crossoverless signal path preserving transient purity and tonal coherence');
    }
    if (archLower.includes('high-efficiency') || archLower.includes('high efficiency')) {
      technicalRationale.push('High-efficiency design \u2192 dynamic liveliness and responsiveness to low-power amplification');
    }
    // ── Generic additive checks (DAC/amp) ──
    if (archLower.includes('discrete')) {
      technicalRationale.push('Discrete output stage \u2192 lower noise floor and cleaner signal path');
    }
    if (archLower.includes('balanced') || archLower.includes('differential')) {
      technicalRationale.push('Balanced/differential design \u2192 common-mode noise rejection');
    }
    // Fallback: extract a design → outcome from catalog architecture if still empty
    if (technicalRationale.length === 0 && p.architecture) {
      const archFirst = p.architecture.split(',')[0]?.trim();
      if (archFirst && archFirst.length > 10) {
        technicalRationale.push(archFirst);
      }
    }

    // ── Cons / explicit trade-offs ──
    // Pull from catalog tendencies.tradeoffs — the 'cost' field is the
    // explicitly stated trade-off for each product.
    const cons: string[] = [];
    if (p.tendencies?.tradeoffs) {
      for (const t of p.tendencies.tradeoffs as Array<{ cost?: string }>) {
        if (t.cost) {
          // Capitalize first letter and clean up
          const costStr = t.cost.charAt(0).toUpperCase() + t.cost.slice(1);
          cons.push(costStr);
          if (cons.length >= 2) break;  // Max 2 explicit trade-offs
        }
      }
    }
    // Fallback from lessIdealIf (computed below) — handled after positioning

    // ── Positioning ──
    let bestFor: string | undefined;
    let lessIdealIf: string | undefined;
    if (p.primaryAxes) {
      const axVal = p.primaryAxes;
      if (axVal.warm_bright === 'warm') {
        bestFor = 'Systems that need tonal density or midrange richness';
        lessIdealIf = 'You prioritise transient speed and analytical clarity';
      } else if (axVal.warm_bright === 'bright') {
        bestFor = 'Listeners who want attack, air, and resolution';
        lessIdealIf = 'Your system already leans bright or fatiguing';
      } else if (axVal.smooth_detailed === 'detailed') {
        bestFor = 'Detail-focused listening and critical evaluation';
        lessIdealIf = 'You listen for long sessions and value ease over precision';
      } else if (axVal.smooth_detailed === 'smooth') {
        bestFor = 'Long listening sessions and musical flow';
        lessIdealIf = 'You need forensic detail retrieval';
      }
    }

    // ── Manufacturer context ──
    const bp = BRAND_PROFILES.find((b) =>
      b.names.some((n) => p.brand.toLowerCase().includes(n.toLowerCase())),
    );
    const makerContext: string[] = [];
    if (bp) {
      if (bp.philosophy) {
        const firstSentence = bp.philosophy.split('.')[0];
        if (firstSentence) makerContext.push(firstSentence.trim());
      }
      if (bp.tendency) {
        const tendSentence = bp.tendency.split('.')[0];
        if (tendSentence) makerContext.push(tendSentence.trim());
      }
      if (bp.systemContext) {
        const sysSentence = bp.systemContext.split('.')[0];
        if (sysSentence) makerContext.push(sysSentence.trim());
      }
    }

    // ── Curated review sources ──
    const reviewDomain = CATEGORY_TO_REVIEWER_DOMAIN[category] ?? 'general';
    const sources = topReviewsForCard(p.id, reviewDomain, 2);

    // ── Legacy model context ──
    // If this product is a known legacy model, attach notes so the card
    // can surface successor info and used-market context.
    const legacy = getLegacyMapping(p.id);
    const legacyNote = legacy?.legacyNote;
    const legacyUsedNote = legacy?.usedNote;

    // ── Recommendation type classification ──
    // Compare candidate against the user's current component to determine
    // whether this is a true upgrade, directional change, or sidegrade.
    const classification = currentProduct
      ? classifyRecommendation(
          {
            primaryAxes: currentProduct.primaryAxes as Record<string, string> | undefined,
            philosophy: (currentProduct as unknown as { philosophy?: string }).philosophy,
            price: currentProduct.price ?? currentPrice,
            archetypes: currentProduct.archetypes as { primary?: string; secondary?: string } | undefined,
          },
          {
            primaryAxes: p.primaryAxes as Record<string, string> | undefined,
            philosophy: (p as unknown as { philosophy?: string }).philosophy,
            price: p.price,
            archetypes: p.archetypes as { primary?: string; secondary?: string } | undefined,
          },
        )
      : undefined;

    return {
      rank: i + 1,
      name: p.name,
      brand: p.brand,
      price: p.usedPriceRange ? p.usedPriceRange.high : p.price,
      priceCurrency: p.priceCurrency,
      priceNote,
      summary: p.description.split('.')[0] + '.',
      pros,
      cons: cons.length > 0 ? cons : undefined,
      imageUrl: p.imageUrl ?? getProductImage(p.brand, p.name),
      topologyLine: topologyLine || undefined,
      whatYoullHear: whatYoullHear.length > 0 ? whatYoullHear.slice(0, 3) : undefined,
      technicalRationale: technicalRationale.length > 0 ? technicalRationale.slice(0, 3) : undefined,
      bestFor,
      lessIdealIf,
      makerContext: makerContext.length > 0 ? makerContext.slice(0, 3) : undefined,
      sources: sources.length > 0 ? sources : undefined,
      manufacturerUrl: p.retailer_links?.[0]?.url,
      retailerLinks: p.retailer_links?.length > 0
        ? p.retailer_links.map((l) => ({ label: l.label, url: l.url }))
        : undefined,
      availability: p.availability,
      typicalMarket: p.typicalMarket,
      usedPriceRange: p.usedPriceRange,
      legacyNote,
      legacyUsedNote,
      recommendationType: classification?.type,
      directionalGains: classification?.gains?.length ? classification.gains : undefined,
      directionalLosses: classification?.losses?.length ? classification.losses : undefined,
    };
  });
}

// ── Cross-category directional options ──────────────
//
// When the system shows stacked trait tendencies (e.g. overdamped, tight,
// controlled across multiple components), same-category replacements often
// don't address the root issue. This selector reaches across categories to
// find products with contrasting character — e.g. tube amplifiers for an
// overdamped solid-state system.
//
// Only invoked for the "System Direction" path; does NOT affect the
// standard per-component upgrade paths.

function selectDirectionalOptions(
  stackedLabel: string,
  components: SystemComponent[],
  maxOptions = 3,
): import('./advisory-response').UpgradePathOption[] {
  const label = stackedLabel.toLowerCase().replace(/_/g, ' ');
  const isControlled = label.includes('controlled') || label.includes('tight') || label.includes('damped');
  const isBright = label.includes('bright') || label.includes('analytical') || label.includes('lean');
  const isSmooth = label.includes('smooth') || label.includes('warm') || label.includes('thick');

  if (!isControlled && !isBright && !isSmooth) return [];

  // Determine desired axis contrasts
  type AxisName = 'elastic_controlled' | 'warm_bright' | 'smooth_detailed';
  const desiredAxes: Array<{ axis: AxisName; value: string }> = [];
  if (isControlled) desiredAxes.push({ axis: 'elastic_controlled', value: 'elastic' });
  if (isBright) desiredAxes.push({ axis: 'warm_bright', value: 'warm' });
  if (isSmooth) desiredAxes.push({ axis: 'smooth_detailed', value: 'detailed' });

  // Determine the amplifier price range from the current system
  const currentAmp = components.find((c) =>
    c.role.toLowerCase().includes('amp') || c.role.toLowerCase().includes('integrated'),
  );
  const refPrice = currentAmp?.product?.price ?? 2000;

  // Search amplifiers with contrasting character — tube, SET, Class A
  const candidates = ALL_PRODUCTS.filter((p) => {
    // Only amplifiers and integrated amps
    if (p.category !== 'amplifier' && p.category !== 'integrated') return false;
    // Exclude the user's current amplifier
    if (currentAmp?.product && p.id === currentAmp.product.id) return false;
    if (currentAmp && `${p.brand} ${p.name}`.toLowerCase() === (currentAmp.displayName ?? '').toLowerCase()) return false;
    // Must be current or recently available
    if (p.availability === 'vintage') return false;
    // Price: 50% to 4× of current amp (wider band for directional shifts)
    if (p.price < refPrice * 0.5) return false;
    if (p.price > refPrice * 4) return false;
    // Must have contrasting character on at least one desired axis
    if (!p.primaryAxes) return false;
    const axes = p.primaryAxes as unknown as Record<string, string>;
    return desiredAxes.some((d) => axes[d.axis] === d.value);
  });

  if (candidates.length === 0) return [];

  // Prefer tube / SET / Class A topologies for controlled→elastic shifts
  const scored = candidates.map((p) => {
    let score = 0;
    const topo = (p.topology ?? '').toLowerCase();
    const arch = (p.architecture ?? '').toLowerCase();
    const axes = p.primaryAxes as unknown as Record<string, string>;

    // Axis alignment score
    for (const d of desiredAxes) {
      if (axes[d.axis] === d.value) score += 4;
    }

    // Topology bonuses for elasticity-seeking shifts
    if (isControlled) {
      if (topo.includes('set') || topo.includes('single-ended')) score += 5;
      if (topo.includes('push-pull') && arch.includes('tube')) score += 3;
      if (topo.includes('class-a')) score += 3;
      if (topo.includes('hybrid')) score += 2;
    }

    // Availability preference
    if (p.availability === 'current') score += 2;
    if (p.availability === 'discontinued') score -= 1;

    // Price proximity — moderate preference for similar price
    const priceRatio = p.price / refPrice;
    score -= Math.abs(Math.log(priceRatio)) * 2;

    return { product: p, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Reuse the same option-building logic as selectUpgradeOptions
  return scored.slice(0, maxOptions).map((s, i) => {
    const p = s.product;
    const priceNote = p.usedPriceRange
      ? `~$${p.usedPriceRange.low.toLocaleString()}–${p.usedPriceRange.high.toLocaleString()} used`
      : `$${p.price.toLocaleString()}`;

    const pros: string[] = [];
    if (p.primaryAxes) {
      const axisLabels: Record<string, Record<string, string>> = {
        warm_bright: { warm: 'Warmer tonal balance', bright: 'Faster transients and clarity' },
        smooth_detailed: { smooth: 'Musical flow and ease', detailed: 'Greater microdetail retrieval' },
        elastic_controlled: { elastic: 'Dynamic elasticity and flow', controlled: 'Grip and stability' },
      };
      for (const [axis, val] of Object.entries(p.primaryAxes)) {
        if (val && val !== 'neutral' && axisLabels[axis]?.[val]) {
          pros.push(axisLabels[axis][val]);
        }
      }
    }

    const topoLabel = p.topology ? TOPOLOGY_DISPLAY[p.topology] : undefined;
    const archShort = p.architecture?.split(',')[0]?.trim();
    const topologyLine = topoLabel && archShort
      ? `${topoLabel}, ${archShort}`
      : topoLabel ?? archShort ?? undefined;

    // Sensory delta
    const whatYoullHear: string[] = [];
    if (p.primaryAxes) {
      const sensoryMap: Record<string, Record<string, string>> = {
        warm_bright: { warm: 'Midrange gains body and richness', bright: 'Transients sharpen — more attack and air' },
        smooth_detailed: { smooth: 'Treble softens — less edge, more ease', detailed: 'Low-level textures become more visible' },
        elastic_controlled: { elastic: 'Dynamics loosen — more bounce and flow', controlled: 'Bass tightens and becomes more controlled' },
      };
      for (const [axis, val] of Object.entries(p.primaryAxes)) {
        if (val && val !== 'neutral' && sensoryMap[axis]?.[val]) {
          whatYoullHear.push(sensoryMap[axis][val]);
        }
      }
    }

    // Technical rationale
    const technicalRationale: string[] = [];
    const topoLower = (p.topology ?? '').toLowerCase();
    if (topoLower.includes('set') || topoLower.includes('single-ended')) {
      technicalRationale.push('Single-ended triode output \u2192 harmonic richness and midrange density');
    } else if (topoLower.includes('class-a')) {
      technicalRationale.push('Class A bias \u2192 smoother treble and richer midrange texture');
    } else if (topoLower.includes('push-pull')) {
      technicalRationale.push('Push-pull tube topology \u2192 power headroom with harmonic warmth');
    } else if (topoLower.includes('hybrid')) {
      technicalRationale.push('Hybrid tube/solid-state \u2192 tube harmonic texture with solid-state grip');
    }

    return {
      rank: i + 1,
      name: p.name,
      brand: p.brand,
      price: p.usedPriceRange ? p.usedPriceRange.high : p.price,
      priceCurrency: p.priceCurrency,
      priceNote,
      summary: p.description.split('.')[0] + '.',
      pros,
      imageUrl: p.imageUrl ?? getProductImage(p.brand, p.name),
      topologyLine: topologyLine || undefined,
      whatYoullHear: whatYoullHear.length > 0 ? whatYoullHear.slice(0, 3) : undefined,
      technicalRationale: technicalRationale.length > 0 ? technicalRationale.slice(0, 3) : undefined,
      manufacturerUrl: p.retailer_links?.[0]?.url,
      retailerLinks: p.retailer_links?.length > 0
        ? p.retailer_links.map((l) => ({ label: l.label, url: l.url }))
        : undefined,
      availability: p.availability,
      typicalMarket: p.typicalMarket,
      usedPriceRange: p.usedPriceRange,
      recommendationType: 'directional' as const,
      directionalGains: pros.length > 0 ? pros : undefined,
    };
  });
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
  systemAxes?: import('./axis-types').PrimaryAxisLeanings,
  listenerPriorities?: import('./memo-findings').ListenerPriority[],
  desires?: DesireSignal[],
): MemoUpgradePath[] {
  const paths: MemoUpgradePath[] = [];

  // ── Path 1: Bottleneck (Highest Impact) ──
  if (constraint) {
    // Power mismatch is a special case: both amp and speaker are
    // valid upgrade targets. Frame as "amp OR speaker" rather than
    // blaming a single component.
    if (constraint.category === 'power_match') {
      const speaker = components.find((c) => c.role.toLowerCase().includes('speak'));
      const speakerRole = speaker ? canonicalRole(speaker.role) : 'Speaker';
      const ampRole = canonicalRole(
        components.find((c) => c.displayName === constraint.componentName)?.role ?? 'Amplifier',
      );
      const powerLabel = `${ampRole} or ${speakerRole} Change`;
      // For power mismatch, select options from the amplifier side
      const powerOptions = selectUpgradeOptions(`${ampRole} Upgrade`, components, ['power']);
      paths.push({
        rank: 1,
        label: powerLabel,
        impact: 'Highest Impact',
        rationale: `${constraint.explanation} This can be resolved from either side: more amplifier power, or higher-efficiency speakers that are easier to drive.`,
        options: powerOptions,
      });
    } else {
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
        ? `A replacement with stronger ${targets.join(' and ')} would shift the system's balance meaningfully.`
        : 'A change here would shift the system\'s fundamental character.';

      paths.push({
        rank: 1,
        label: `${role} Upgrade`,
        impact: 'Highest Impact',
        rationale: `${constraint.explanation} ${targetPhrase}`,
        options: selectUpgradeOptions(`${role} Upgrade`, components, targets),
      });
    }
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
    // Strip leading role prefix from weakness text to avoid redundancy
    // ("amplifier coloration may soften…" → "coloration may soften…" when already in an amplifier context)
    const roleLower = role.toLowerCase();
    const weaknesses = r.assessment.weaknesses.slice(0, 2).map((w) => {
      let cleaned = w.toLowerCase();
      if (cleaned.startsWith(`${roleLower} `)) cleaned = cleaned.slice(roleLower.length + 1);
      return cleaned;
    });
    const weakSummary = weaknesses.length === 1
      ? weaknesses[0]
      : `${weaknesses[0]} and ${weaknesses[1]}`;

    // Singularize the role for natural phrasing ("speakers" → "speaker")
    const roleSingular = roleLower.endsWith('s') && !roleLower.endsWith('ss')
      ? roleLower.slice(0, -1) : roleLower;

    const impactTier = added === 0 ? 'Moderate Impact' : 'Refinement';
    const brandShort = r.component.displayName.split(' ')[0];
    const rationaleVerb = added === 0
      ? `The ${brandShort} has some room to grow here — ${weakSummary}. A stronger ${roleSingular} would tighten the overall presentation.`
      : `Room for refinement in the ${roleSingular} — ${weakSummary}. Upgrading here would improve the system without changing its direction.`;

    paths.push({
      rank,
      label,
      impact: impactTier,
      rationale: rationaleVerb,
      options: selectUpgradeOptions(label, components, weaknesses),
    });
    added++;
  }

  // ── Cross-category directional path when stacked traits detected ──
  // Always offer a directional path when the system shows stacked character,
  // regardless of how many component-level paths exist. This restores the
  // "expert advisor" behavior of suggesting e.g. tube amps for controlled systems.
  if (stacked && stacked.length > 0) {
    const insight = stacked[0];
    const directionalOptions = selectDirectionalOptions(insight.label, components);

    if (paths.length < 2) {
      // Few component-level paths — frame as System Rebalancing (primary path)
      paths.push({
        rank: paths.length + 1,
        label: 'System Rebalancing',
        impact: paths.length === 0 ? 'Highest Impact' : 'Moderate Impact',
        rationale: `Multiple components reinforce ${insight.label.replace(/_/g, ' ')}, narrowing the system's range. Introducing something with contrasting character would open up the palette. ${insight.explanation}`,
        options: directionalOptions,
      });
    } else if (directionalOptions.length > 0) {
      // Component-level paths exist — add a supplementary directional path
      paths.push({
        rank: paths.length + 1,
        label: 'System Direction',
        impact: 'Moderate Impact',
        rationale: `Your system leans ${insight.label.replace(/_/g, ' ')} across multiple components. These options take a different architectural approach — trading some of what you have in surplus for qualities your system currently underserves.`,
        options: directionalOptions,
      });
    }
  }

  // ── Attach trade-off assessments (Feature 2) ──
  if (systemAxes) {
    const defaultAxes: import('./axis-types').PrimaryAxisLeanings = {
      warm_bright: 'neutral', smooth_detailed: 'neutral',
      elastic_controlled: 'neutral', airy_closed: 'neutral',
    };
    const axes = systemAxes ?? defaultAxes;

    for (const p of paths) {
      // Find the target component for this path by matching the path label
      // back to a component role. Labels are "DAC Upgrade", "Speaker Upgrade", etc.
      const pathRole = p.label.replace(/\s+(Upgrade|Change)$/i, '').toLowerCase();
      const targetIdx = components.findIndex((c) =>
        canonicalRole(c.role).toLowerCase() === pathRole
        || c.role.toLowerCase().includes(pathRole),
      );
      const targetAssessment = targetIdx >= 0
        ? assessments.find((a) => a.name === components[targetIdx].displayName)
        : undefined;
      const targetInference = targetIdx >= 0 && components[targetIdx].product
        ? runInference(components[targetIdx].product!)
        : undefined;

      // Determine impact tier for the assessment
      const pathImpact: 'highest' | 'moderate' | 'refinement' =
        p.impact === 'Highest Impact' ? 'highest'
        : p.impact === 'Moderate Impact' ? 'moderate'
        : 'refinement';

      if (targetAssessment) {
        p.tradeoff = assessTradeoffs(
          targetAssessment,
          targetInference,
          pathImpact,
          pathImpact === 'highest' ? constraint : undefined,
          stacked ?? [],
          axes,
        );
      }
    }
  }

  // ── Attach preference protection assessments (Feature 3) ──
  if (listenerPriorities && listenerPriorities.length > 0) {
    const classified = classifyPriorities(listenerPriorities, desires);

    for (const p of paths) {
      if (!p.tradeoff) continue;

      const pathImpact: 'highest' | 'moderate' | 'refinement' =
        p.impact === 'Highest Impact' ? 'highest'
        : p.impact === 'Moderate Impact' ? 'moderate'
        : 'refinement';

      // Extract target axes from rationale for axis-opposition fallback
      const targetAxes: string[] = [];
      const r = (p.rationale ?? '').toLowerCase();
      if (r.includes('tonal density') || r.includes('warmth')) targetAxes.push('warm_bright');
      if (r.includes('detail') || r.includes('microdetail') || r.includes('flow')) targetAxes.push('smooth_detailed');
      if (r.includes('elasticity') || r.includes('stability') || r.includes('grip')) targetAxes.push('elastic_controlled');

      p.protection = assessPreferenceProtection(
        p.tradeoff,
        classified,
        pathImpact,
        pathImpact === 'highest' ? constraint : undefined,
        targetAxes,
      );
    }
  }

  // ── Attach counterfactual assessments (Feature 6) ──
  for (const p of paths) {
    if (!p.tradeoff) continue;

    p.counterfactual = assessCounterfactual({
      tradeoff: p.tradeoff,
      protection: p.protection,
      constraint,
      stacked: stacked ?? [],
    });
  }

  // ── Attach strategy frames (Feature 7) ──
  for (const p of paths) {
    const frame = frameStrategy({
      rank: p.rank,
      label: p.label,
      impact: p.impact,
      rationale: p.rationale,
      tradeoff: p.tradeoff,
      protection: p.protection,
      counterfactual: p.counterfactual,
    });
    p.strategyLabel = frame.strategyLabel;
    p.strategyIntent = frame.strategyIntent;
  }

  // Deduplicate strategy labels across paths
  deduplicateStrategies(
    paths.filter((p): p is typeof p & { strategyLabel: string; strategyIntent: string } =>
      !!p.strategyLabel && !!p.strategyIntent,
    ),
  );

  // ── Attach explanation lines (Feature 9) ──
  // Select 1–2 strongest signals per path. Suppressed for HOLD paths.
  for (const p of paths) {
    p.explanation = buildExplanation(p, constraint, stacked ?? []);
  }

  return paths;
}

/**
 * Build concise explanation lines ("why this works") from existing signals.
 * Priority: constraint → stacked trait → tradeoff driver → preference alignment.
 * Max 2 lines. Suppressed for HOLD paths and low-confidence paths.
 * Feature 9 — no new reasoning, only signal selection.
 * @internal Exported for testing. Not part of the public API.
 */
export function buildExplanation(
  p: MemoUpgradePath,
  constraint: MemoPrimaryConstraint | undefined,
  stacked: MemoStackedTraitInsight[],
): string[] | undefined {
  // Suppress for HOLD paths — rationale already fully explains
  if (p.counterfactual?.restraintRecommended) return undefined;
  if (p.protection?.verdict === 'block') return undefined;

  // Suppress when confidence is low — explanation would add noise
  if (p.tradeoff?.confidence === 'low') return undefined;

  const lines: string[] = [];

  // 1. Constraint / bottleneck — if this path targets the bottleneck component
  if (constraint && p.label.toLowerCase().includes(constraint.componentName.toLowerCase())) {
    const category = constraint.category.replace(/_/g, ' ');
    lines.push(`Your ${constraint.componentName.toLowerCase()} is the current limiting factor (${category}).`);
  }

  // 2. Stacked traits — if any stacked trait relates to this path's target role
  if (lines.length < 2) {
    const role = (p.label ?? '').toLowerCase();
    for (const s of stacked) {
      if (lines.length >= 2) break;
      // Only include if a contributor matches the path's target
      const relevant = s.contributors.some((c) => role.includes(c.toLowerCase()));
      if (!relevant) continue;

      const trait = s.label.replace(/_/g, ' ');
      if (s.classification === 'system_character') {
        lines.push(`${s.contributors.join(' and ')} share a ${trait} tendency — this is a system signature, not a flaw.`);
      } else {
        lines.push(`${s.contributors.join(' and ')} both push toward ${trait}, compounding the effect.`);
      }
    }
  }

  // 3. Trade-off driver — the core gain/sacrifice tension
  if (lines.length < 2 && p.tradeoff) {
    const t = p.tradeoff;
    if (t.likelyGains.length > 0 && t.likelySacrifices.length > 0) {
      const gain = t.likelyGains[0];
      const sacrifice = t.likelySacrifices[0];
      // Skip when gain or sacrifice text is unusually long — these are
      // constraint explanations or compound phrases that don't fit the
      // "improving X requires trading Y" pattern cleanly.
      if (gain.length <= 60 && sacrifice.length <= 60) {
        lines.push(`Improving ${gain.toLowerCase()} requires trading some ${sacrifice.toLowerCase()}.`);
      }
    }
  }

  // 4. Preference alignment — if priorities match the path's direction
  if (lines.length < 2 && p.protection) {
    const prot = p.protection;
    if (prot.verdict === 'safe' && prot.threats.length === 0) {
      // Check if there are explicit priorities that align
      const explicit = prot.explicitAtRisk === false;
      if (explicit && p.tradeoff?.likelyGains && p.tradeoff.likelyGains.length > 0) {
        lines.push(`This aligns with your stated listening priorities.`);
      }
    }
  }

  return lines.length > 0 ? lines : undefined;
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
  precomputedListenerPriorities?: ListenerPriority[],
  voicingCoherence?: VoicingCoherenceResult,
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

    // Run inference layer when product data is available
    const inference = c.product ? runInference(c.product) : undefined;

    // Derive component confidence from inference layer (Feature 5)
    const componentConfidence: 'high' | 'medium' | 'low' =
      inference && inference.confidence !== 'none' ? inference.confidence : 'low';

    return {
      name: c.displayName,
      role: c.role,
      roles: c.roles,
      catalogSource: profile.source as CatalogSource,
      axisPosition: profile.axes,
      strengths: assessment?.strengths ?? [],
      weaknesses: assessment?.weaknesses ?? [],
      verdict,
      architecture: c.product?.architecture,
      priceTier: c.product?.priceTier,
      price: c.product?.price,
      links: perComponentLinks?.get(c.displayName),
      inference,
      confidence: componentConfidence,
    };
  });

  // ── Stacked traits → structured tags ──
  const stackedTraits: StackedTraitFinding[] = stacked.map((s) => {
    // Stacked trait confidence = min of contributing components (Feature 5)
    const contributorConfidences = s.contributors.map((name) => {
      const cv = componentVerdicts.find((v) => v.name === name);
      return cv?.confidence ?? 'low';
    });
    const CONF_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const minConf = contributorConfidences.reduce<'high' | 'medium' | 'low'>(
      (acc, c) => (CONF_RANK[c] < CONF_RANK[acc] ? c : acc),
      'high',
    );
    return {
      property: s.label,
      contributors: s.contributors,
      classification: s.classification,
      confidence: minConf,
    };
  });

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

    // Bottleneck confidence from the identified component (Feature 5)
    const bottleneckComponentConf = componentVerdicts.find(
      (v) => v.name === constraint.componentName,
    )?.confidence;

    bottleneck = {
      component: constraint.componentName,
      role: idx >= 0 ? components[idx].role : 'component',
      category: constraint.category,
      constrainedAxes,
      severity: 0, // severity not preserved through PrimaryConstraint — default
      confidence: bottleneckComponentConf,
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
      tradeoff: p.tradeoff,
      protection: p.protection,
      counterfactual: p.counterfactual,
      strategyLabel: p.strategyLabel,
      strategyIntent: p.strategyIntent,
      explanation: p.explanation,
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
  // Reuse precomputed priorities from the pipeline when available (Feature 3).
  const listenerPriorities: ListenerPriority[] = precomputedListenerPriorities ?? inferListenerPriorityTags(systemAxes, desires);

  // ── Source references ──
  const sourceReferences: SourceReferenceFinding[] = sourceRefs.map((r) => ({
    source: r.source,
    note: r.note,
    url: r.url,
  }));

  // ── Multi-role redundancy detection ──
  const roleCounts = new Map<string, string[]>();
  for (const cv of componentVerdicts) {
    for (const r of cv.roles) {
      const norm = r.toLowerCase();
      if (!roleCounts.has(norm)) roleCounts.set(norm, []);
      roleCounts.get(norm)!.push(cv.name);
    }
  }
  const hasMultipleDACs = (roleCounts.get('dac')?.length ?? 0) >= 2;
  const hasMultipleAmps = (
    (roleCounts.get('amplifier')?.length ?? 0) >= 2
    || (roleCounts.get('headphone_amp')?.length ?? 0) >= 2
  );
  const roleOverlaps: { role: string; components: string[] }[] = [];
  for (const [role, names] of roleCounts) {
    if (names.length >= 2) {
      roleOverlaps.push({ role, components: names });
    }
  }

  // ── Active DAC inference ──
  const activeDACInference = inferActiveDAC(components);

  // ── Amp/speaker power-match assessment ──
  const powerMatchAssessment = assessPowerMatch(components);

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
    isCoherent: voicingCoherence?.isCoherent ?? false,
    coherentSharedTraits: voicingCoherence?.sharedTraits ?? [],
    coherentTradeoffs: voicingCoherence?.tradeoffs ?? [],
    deliberatenessSignals,
    listenerPriorities,
    hasMultipleDACs,
    hasMultipleAmps,
    roleOverlaps,
    activeDACInference,
    powerMatchAssessment,
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
      return `Your taste pattern points toward equipment emphasising **${philosophyTraits.join(' and ')}**. Components in this system (${brandNames.join(', ')}) share this design approach. You also ${verb} ${quality} — future upgrades should preserve the underlying philosophy while addressing that specific axis.`;
    }

    return `You ${verb} ${quality}. The current system is broadly balanced, so targeted component changes can address this without destabilising the overall character.`;
  }

  // ── Philosophy-driven observation ──
  if (philosophyTraits.length > 0) {
    const philo = philosophyTraits.join(' and ');
    const imbalances = stacked.filter((s) => s.classification === 'system_imbalance');
    const characters = stacked.filter((s) => s.classification === 'system_character');
    let stackedNote = '';
    if (imbalances.length > 0) {
      stackedNote = ` The system leans toward ${imbalances[0].label}, which deepens this character but narrows the system's range.`;
    } else if (characters.length > 0) {
      stackedNote = ` The system shares a consistent ${characters[0].label} emphasis — this reinforces the system's identity.`;
    }

    return `Your component choices suggest a preference for equipment emphasising **${philo}**. ${brandNames.join(', ')} share this design philosophy.${stackedNote} Future upgrades should preserve this approach — swapping in components with a fundamentally different design priority would destabilise what the system does well.`;
  }

  // ── Balanced fallback ──
  if (stacked.length > 0) {
    const imbalances = stacked.filter((s) => s.classification === 'system_imbalance');
    const characters = stacked.filter((s) => s.classification === 'system_character');
    if (imbalances.length > 0) {
      return `Despite broadly balanced axis positions, the system stacks ${imbalances[0].label} across multiple components. This is worth monitoring — it can be a deliberate strength or an emerging limitation depending on listening priorities. Targeted component changes can adjust this without rebuilding the system.`;
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
    return `You mentioned wanting less ${quality}. That traces to a specific point in the system — tell me the signal path and I'll identify it.`;
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
      alignment: 'a tube amplifier would likely push the system toward warmth, flow, and midrange density — potentially compensating for analytical or lean tendencies elsewhere in the system, or compounding warmth if the source and speakers already lean that way.',
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
        followUp: 'This is architectural reasoning — specific products within the family vary. If you have a particular model in mind, I can be more specific about how it would interact with the rest of the system.',
      };
    }

    // Hypothetical language detected but no specific component identified
    return {
      subject: 'hypothetical change',
      philosophy: 'Worth reasoning through before committing. The impact depends on the role the component plays — adding something missing, compensating a tendency, or compounding one.',
      tendencies: hasTasteSignals
        ? `You value ${priorityParts.join(' and ')}. The question is whether this change moves closer to those priorities or shifts sideways. Not all changes are improvements; some are just different.`
        : 'I can reason about the architectural direction — what a given topology contributes and what it trades away.',
      followUp: 'What would you be changing — and what would you want it to improve? That clarifies whether it\'s compensating or compounding.',
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
        philosophy = `Your ${activeSystem.name} system (${componentList}) has a consistent character: ${tendencies}. That coherence is worth something. A system with a clear point of view is easier to live with than one upgraded toward no particular direction.`;
        tendenciesText = `The case for doing nothing: if the tendency you described is what you actually want, a change shifts that character — it doesn't improve on it. You'd exchange a known quantity for an unknown one. Only worth it with a specific, nameable dissatisfaction.\n\nThe case for change: if that tendency is something you've been tolerating rather than enjoying, that's a real signal. But "maybe I should change something" isn't that signal — it's restlessness.`;
      } else {
        // No tendency data — reason from structure
        philosophy = `Your ${activeSystem.name} system is: ${componentList}. Without hearing it in your room, I can't judge balance — but I can outline the case for doing nothing.`;
        tendenciesText = `The case for doing nothing: if nothing bothers you consistently across most material, there's no gap to fill. Upgrades without a real target change character without improving it.\n\nThe case for change: if something consistently bothers you — a tonal quality, a texture, a dynamic limitation — that's worth acting on. But if the system sounds good and nothing is obviously wrong, patience is the stronger position.`;
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
      philosophy = `Your ${activeSystem.name}${locationNote} system: ${componentList}.${tendenciesNote} I can evaluate how these components interact — whether they compound or balance — and identify where character is being shaped.`;
    } else if (isUpgradeFocused) {
      philosophy = `Working from your ${activeSystem.name}${locationNote} system: ${componentList}.${tendenciesNote} I can map upgrade priorities against the current balance — identifying the most effective intervention point.`;
    } else {
      philosophy = `Your ${activeSystem.name}${locationNote} system: ${componentList}.${tendenciesNote} I can evaluate alignment between these components and your listening priorities.`;
    }

    const tendencies = priorityParts.length > 0
      ? `You want ${priorityParts.join(' and ')}. I can map those priorities to component interactions and identify where a change is most effective.`
      : 'The most useful thing to share now: what you enjoy about the current sound, what feels unsatisfying, or what direction of change you\'re curious about.';

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
      ? `You value ${priorityParts.join(' and ')} — useful even without knowing exact components. "Should I change anything?" is one of the best questions in audio. The answer is often no.`
      : `"Should I change anything?" — one of the best questions in audio. The answer is often no. Change without a specific, repeatable dissatisfaction moves you sideways.`;

    const tendencies = `The case for doing nothing: you enjoy the music most of the time, dissatisfaction is vague, you can't define "better" concretely, or the upgrade impulse feels more like curiosity than frustration.\n\nThe case for change: a specific quality bothers you consistently across familiar material. The problem is repeatable, nameable, and you can describe what "better" sounds like — even roughly.`;

    const followUp = hasTasteSignals
      ? `If you can share your current system — even roughly — I can tell you whether those priorities are being served or whether there's a real gap.`
      : `If you can share your current system — even roughly — I can assess whether there's a real case for change or the instinct to hold is the right one.`;

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
    philosophy = 'Audio XX evaluates systems by examining how components interact — whether they compound the same tendency or balance each other. A system that leans warm throughout behaves very differently from one where a precise source feeds a rich amplifier. The interaction matters more than any single component\'s quality.';
  } else if (isUpgradeFocused) {
    philosophy = 'Before recommending an upgrade path, Audio XX needs to understand your current system\'s architectural balance — where energy accumulates, where it\'s absorbed, and what the system emphasises as a whole. The most effective upgrade often isn\'t the most expensive component — it\'s the one that resolves the most meaningful imbalance.';
  } else {
    philosophy = 'Audio XX approaches system guidance by examining the interaction between components, your listening priorities, and your room context. The goal is to identify whether your current system is well-aligned with what you value — and if not, where the most effective intervention lies.';
  }

  const tendencies = priorityParts.length > 0
    ? `You've mentioned wanting ${priorityParts.join(' and ')} — that gives a starting direction. To map those priorities to specific system interactions, I need to know what you're working with.`
    : 'To provide a meaningful assessment, I need to understand the components in your system and how they interact. Generic advice without system context tends to be less useful than targeted guidance.';

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
        const cableRole = product?.category ?? 'component';
        cableComponents.push({
          displayName: match.name,
          role: cableRole,
          roles: resolveComponentRoles(cableRole, product ?? undefined, match.name),
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
    philosophy = 'Speaker cables and interconnects play different roles in a system. Interconnects carry low-level signals between source and amplification — their character influences how detail and texture are transmitted. Speaker cables carry high-current signals to the drivers — their geometry and conductor material affect how dynamics, transient speed, and tonal weight are delivered. Both can shift the system\'s tonal balance, but speaker cables tend to have more audible impact on dynamics and bass character.';
  } else if (cableTypes.includes('speaker')) {
    philosophy = 'Speaker cables carry high-current signals from amplifier to drivers. Their conductor material, geometry, and dielectric influence how dynamics, transient speed, and tonal weight are delivered. They tend to have more audible impact on the system\'s macro character than interconnects.';
  } else if (cableTypes.includes('interconnect')) {
    philosophy = 'Interconnects carry low-level signals between components. Their character influences detail retrieval, textural nuance, and tonal shading. In a well-sorted system, interconnect changes tend to be subtle but can meaningfully shift the midrange texture and spatial presentation.';
  } else if (cableTypes.includes('power')) {
    philosophy = 'Power cables affect the noise floor and dynamic headroom of each component. Their impact is often described in terms of background blackness, dynamic ease, and a sense of effortlessness rather than tonal shifts. Results vary significantly by component and power supply design.';
  } else {
    philosophy = 'Cables are a system-tuning tool, not a standalone upgrade. Their role is to transmit signal with minimal coloration — or, in some cases, to introduce a deliberate tonal shift that compensates for tendencies elsewhere in the system. The most effective cable choice depends on what the rest of the system is doing.';
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
    tendencies = `With ${systemComponents.join(' and ')} in the system, the cable direction depends on what you want to shift. Cables can fine-tune tonal balance, dynamic weight, and spatial presentation — but only meaningfully when the tuning goal is clear.`;
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
      'Power conditioning — dirty power introduces high-frequency noise that manifests as harshness. A conditioner or regenerator addresses this directly',
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
      'Room acoustics — excessive reflections compound detail overload. Diffusion and selective absorption reduce this',
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
      'Room acoustics — overdamped rooms suppress warmth. Reducing absorption (especially bass traps) restores it',
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
  const opening = `With ${systemLabel}, what you're hearing as "${complaint}" is ${mapping.interpretation}.`;

  // Context: interpret in terms of the system
  let systemNote = '';
  if (componentCharacters.length > 0) {
    // Check if the system's character compounds the complaint
    const charText = componentCharacters.join('; ').toLowerCase();
    const compounders = ['neutral', 'precise', 'controlled', 'detailed', 'resolving', 'transparent', 'clean'];
    const isCompounding = complaintKey === 'dry' || complaintKey === 'sterile' || complaintKey === 'clinical' || complaintKey === 'cold' || complaintKey === 'analytical';
    if (isCompounding && compounders.some((w) => charText.includes(w))) {
      systemNote = `With highly transparent, controlled components on both ends, the system is too \"correct\" — precision without harmonic richness. This is a characteristic of reference-grade solid-state chains, not a flaw.`;
    } else if ((complaintKey === 'bright' || complaintKey === 'harsh') && charText.includes('detail')) {
      systemNote = `A system this resolving exposes recording-quality issues that less transparent systems smooth over. The harshness is partly recording-dependent.`;
    }
  }

  // Paths: 2-4 adjustment directions
  const paths = mapping.remedyDirections.slice(0, 4);
  const pathsText = paths.map((p, i) => `**${i + 1}.** ${p}`).join('\n\n');

  // Follow-up question — stays diagnostic, with optional shopping transition
  const shoppingOffer = ' I can suggest specific components to try.';
  let followUp: string;
  if (mapping.followUpAngle === 'source') {
    followUp = 'What source are you using (DAC, streamer, turntable)? That\'s the first place I\'d look.' + shoppingOffer;
  } else if (mapping.followUpAngle === 'room') {
    followUp = 'Can you describe your room — size, surfaces, treatment? That\'s the biggest variable here.' + shoppingOffer;
  } else {
    followUp = 'What are your listening habits — typical volume, session length, music types? That helps me calibrate.' + shoppingOffer;
  }

  // Assemble
  const fullDiagnosis = systemNote
    ? `${opening}\n\n${systemNote}\n\n${pathsText}`
    : `${opening}\n\n${pathsText}`;

  return {
    subject: `${systemLabel} — ${complaint}`,
    comparisonSummary: fullDiagnosis,
    advisoryMode: 'system_review' as import('./advisory-response').AdvisoryMode,
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
