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

// ── Types ───────────────────────────────────────────

export interface ConsultationResponse {
  /** The subject the user asked about (brand, topology, concept). */
  subject: string;
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
}

// ── All products ────────────────────────────────────

const ALL_PRODUCTS: Product[] = [...DAC_PRODUCTS, ...SPEAKER_PRODUCTS];

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
    tendencies: 'Listeners consistently describe Chord DACs as fast, articulate, and detailed. Timing resolution and transient clarity are the signature strengths. Tonal weight is lighter than R-2R designs but avoids the clinical edge of typical delta-sigma implementations.',
    systemContext: 'Chord DACs tend to work well with warm or tonally dense amplification, where the source-level clarity cuts through added warmth rather than being masked. In systems already biased toward speed and transparency, the tonal lightness may become noticeable.',
    pairingNotes: 'Works well with tube amplification and warm solid-state designs. The Hugo and Qutest lines are widely used as headphone DAC/amps and desktop sources.',
    links: [
      { label: 'Official website', url: 'https://chordelectronics.co.uk/', region: 'global' },
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
];

// ── Topology keywords for archetype matching ────────

interface TopologyKeyword {
  patterns: RegExp[];
  archetypeId: DesignArchetypeId;
  /** Human-readable label for the subject line. */
  label: string;
}

const TOPOLOGY_KEYWORDS: TopologyKeyword[] = [
  { patterns: [/\br-?2r\b/i, /\bladder\s+dac\b/i], archetypeId: 'r2r', label: 'R-2R DACs' },
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

  // Try curated tendencies first
  if (hasTendencies(primary.tendencies)) {
    const top = selectDefaultTendencies(primary.tendencies.character, 3);
    const tendencyText = top.map((t) => t.tendency).join('. ');
    const tradeoff = primary.tendencies.tradeoffs[0];

    return {
      subject,
      philosophy: `${primary.brand} ${primary.name} uses ${primary.architecture} architecture. The design prioritises a particular sonic character over measured neutrality.`,
      tendencies: tendencyText + (tradeoff ? `. The characteristic trade-off: ${tradeoff.gains} at the cost of ${tradeoff.cost}.` : '.'),
      systemContext: primary.tendencies.interactions[0]
        ? `System context matters: ${primary.tendencies.interactions[0].condition}, ${primary.tendencies.interactions[0].effect}.`
        : undefined,
      followUp: 'Are you considering this for a specific system, or exploring what it would bring?',
      links: brandLinks,
    };
  }

  // Try qualitative profile
  if (hasExplainableProfile(primary.tendencyProfile)) {
    const emphasized = getEmphasizedTraits(primary.tendencyProfile);
    const lessEmphasized = getLessEmphasizedTraits(primary.tendencyProfile);
    const conf = primary.tendencyProfile.confidence;

    const emphVerb = conf === 'high' ? 'Listeners consistently describe it as emphasising' : 'It tends to lean toward';
    const emphText = emphasized.length > 0 ? `${emphVerb} ${emphasized.join(' and ')}.` : '';
    const lessText = lessEmphasized.length > 0 ? ` Less of a priority: ${lessEmphasized.slice(0, 2).join(' and ')}.` : '';

    return {
      subject,
      philosophy: `${primary.brand} ${primary.name} is an ${primary.architecture} design. ${primary.description.split('.')[0]}.`,
      tendencies: `${emphText}${lessText}`,
      followUp: 'Are you considering this for a specific system, or exploring what its character would bring?',
      links: brandLinks,
    };
  }

  // Fallback to description
  return {
    subject,
    philosophy: `${primary.brand} ${primary.name} is an ${primary.architecture} design.`,
    tendencies: primary.description,
    followUp: 'What are you pairing it with, and what do you value most in your listening?',
    links: brandLinks,
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
): ConsultationResponse {
  const nameA = capitalize('names' in profileA ? profileA.names[0] : profileA.name);
  const nameB = capitalize('names' in profileB ? profileB.names[0] : profileB.name);

  // Use up to two sentences for philosophy and tendencies — enough to convey
  // character without overwhelming. Truncating to a single period fragment
  // loses too much information.
  const philoA = takeSentences(profileA.philosophy, 2);
  const philoB = takeSentences(profileB.philosophy, 2);
  const tendA = takeSentences(profileA.tendencies, 2);
  const tendB = takeSentences(profileB.tendencies, 2);

  // Build a concise comparison summary — answers the question first.
  // Extracts the core character from each side's tendencies to form a contrast.
  const charA = extractCoreCharacter(profileA.tendencies);
  const charB = extractCoreCharacter(profileB.tendencies);
  const summary = `${nameA} tends toward ${charA}, while ${nameB} leans toward ${charB}.`;

  // Check for design families that would qualify the brand-level comparison
  const familiesA = 'designFamilies' in profileA ? (profileA as BrandProfile).designFamilies : undefined;
  const familiesB = 'designFamilies' in profileB ? (profileB as BrandProfile).designFamilies : undefined;
  const familyContext = buildDesignFamilyContext(nameA, familiesA, nameB, familiesB);

  // If either brand has design families, steer the follow-up toward model specifics
  const hasAnyFamilies = (familiesA && familiesA.length > 0) || (familiesB && familiesB.length > 0);
  const followUp = hasAnyFamilies
    ? `Which model or series are you considering? That matters for how this comparison plays out.`
    : `What draws you toward one of these over the other — is it a specific quality, or more of a general direction?`;

  const systemContext = familyContext
    ? `Where they diverge most shapes which fits better.\n\n${familyContext}`
    : `Where they diverge most shapes which fits better — this depends on what you value in your listening and where your system currently sits.`;

  return {
    subject: `${nameA} vs ${nameB}`,
    comparisonSummary: summary,
    philosophy: `${nameA}: ${philoA}\n\n${nameB}: ${philoB}`,
    tendencies: `${nameA}: ${tendA}\n\n${nameB}: ${tendB}`,
    systemContext,
    followUp,
  };
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
 */
function extractCoreCharacter(tendencies: string): string {
  const lower = tendencies.toLowerCase();

  // Look for known trait-words and cluster them
  const traitHits: string[] = [];
  if (/warm/i.test(lower)) traitHits.push('warmth');
  if (/flow|flowing/i.test(lower)) traitHits.push('flow');
  if (/rhythm|rhythmic|propulsive|pace|timing/i.test(lower)) traitHits.push('rhythmic drive');
  if (/clarity|transparent|transparency|resolving/i.test(lower)) traitHits.push('clarity');
  if (/dense|density|tonal weight|tonal body|body/i.test(lower)) traitHits.push('tonal density');
  if (/spatial|soundstage|imaging|holograph/i.test(lower)) traitHits.push('spatial presence');
  if (/dynamic|punch|slam|energy/i.test(lower)) traitHits.push('dynamic energy');
  if (/controlled?|composure|composed|refined|refinement/i.test(lower)) traitHits.push('composure');
  if (/intimate|intimacy/i.test(lower)) traitHits.push('intimacy');
  if (/texture|textural/i.test(lower)) traitHits.push('texture');
  if (/harmonic|harmonically/i.test(lower)) traitHits.push('harmonic richness');
  if (/natural|unforced/i.test(lower)) traitHits.push('a natural presentation');
  if (/engaging|engagement|immersive|immersion/i.test(lower)) traitHits.push('musical engagement');
  if (/saturated|saturation/i.test(lower)) traitHits.push('tonal saturation');

  if (traitHits.length >= 2) {
    // Take up to 3 traits for a concise summary
    const selected = traitHits.slice(0, 3);
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
        return buildBrandComparison(profileA, profileB);
      }

      // One or both missing curated profiles — try catalog-derived summaries
      const productsA = ALL_PRODUCTS.filter((p) => p.brand.toLowerCase() === a.name.toLowerCase());
      const productsB = ALL_PRODUCTS.filter((p) => p.brand.toLowerCase() === b.name.toLowerCase());
      const summaryA = profileA ?? (productsA.length > 0 ? deriveBrandSummaryFromCatalog(a.name, productsA) : null);
      const summaryB = profileB ?? (productsB.length > 0 ? deriveBrandSummaryFromCatalog(b.name, productsB) : null);

      if (summaryA && summaryB) {
        return buildBrandComparison(summaryA, summaryB);
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
      // honest acknowledgement, not a diagnostic fallback
      return buildUnknownBrandResponse(brandSubject.name);
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

  return {
    subject: `${nameA} vs ${nameB} — ${criterion.label}`,
    comparisonSummary: summary,
    philosophy: `${contextA}\n\n${contextB}`,
    tendencies: `The difference comes down to design priorities — ${criterion.label.toLowerCase()} is shaped differently by each approach.`,
    systemContext,
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

  return {
    subject: `${nameA} vs ${nameB} — ${contextLabel}`,
    comparisonSummary: summary,
    philosophy: `${sideA}\n\n${sideB}`,
    tendencies: `How this context shapes the comparison depends on what each design prioritises.`,
    systemContext: 'The rest of the chain matters too — one variable doesn\'t determine the whole picture.',
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
    if (info) {
      return {
        subject: subjectName,
        philosophy: `${subjectName} in your system context: ${takeSentences(info.tendencies, 1)}`,
        tendencies: info.systemContext
          ? takeSentences(info.systemContext, 2)
          : 'How well it fits depends on what the rest of the chain brings — amplifier topology, source character, and room all interact.',
        followUp: 'What does the rest of your chain look like?',
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
function normalizeDisplayName(brand: string, name: string): string {
  const b = brand.trim();
  const n = name.trim();
  if (!b) return n || 'Unknown';
  if (!n) return b;
  // If name starts with the brand (case-insensitive), don't repeat the brand
  if (n.toLowerCase().startsWith(b.toLowerCase())) {
    return n.charAt(0).toUpperCase() + n.slice(1);
  }
  return `${b} ${n}`;
}

export function buildSystemAssessment(
  currentMessage: string,
  subjectMatches: SubjectMatch[],
  activeSystem?: ActiveSystemContext | null,
  desires?: DesireSignal[],
): ConsultationResponse | null {
  const components: SystemComponent[] = [];
  const allLinks: { label: string; url: string; kind?: 'reference' | 'dealer' | 'review'; region?: string }[] = [];
  const processedNames = new Set<string>();

  // ── Seed from active system when available ──
  if (activeSystem && activeSystem.components.length > 0) {
    for (const ac of activeSystem.components) {
      const fullName = normalizeDisplayName(ac.brand, ac.name);
      const nameLower = ac.name.toLowerCase();
      const brandLower = ac.brand.toLowerCase();
      if (processedNames.has(nameLower) || processedNames.has(brandLower)) continue;
      processedNames.add(nameLower);
      processedNames.add(brandLower);

      // Try to find rich catalog data
      const product = ALL_PRODUCTS.find(
        (p) => p.name.toLowerCase() === nameLower
          || `${p.brand} ${p.name}`.toLowerCase() === fullName.toLowerCase(),
      );
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

      // Collect links from catalog matches
      if (product?.retailer_links) {
        for (const l of product.retailer_links) {
          allLinks.push({ label: `${l.label} (${product.name})`, url: l.url });
        }
      }
      if (brandProfile?.links) {
        for (const l of brandProfile.links) {
          if (!allLinks.some((al) => al.url === l.url)) {
            allLinks.push({ label: l.label, url: l.url, kind: l.kind, region: l.region });
          }
        }
      }
    }
  }

  for (const match of subjectMatches) {
    const lower = match.name.toLowerCase();
    if (processedNames.has(lower)) continue;
    processedNames.add(lower);

    if (match.kind === 'product') {
      // Product-level lookup
      const product = ALL_PRODUCTS.find((p) => p.name.toLowerCase() === lower);
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

        // Collect product links
        if (product.retailer_links) {
          for (const l of product.retailer_links) {
            allLinks.push({ label: `${l.label} (${product.name})`, url: l.url });
          }
        }

        // Collect brand links
        if (brandProfile?.links) {
          for (const l of brandProfile.links) {
            if (!allLinks.some((al) => al.url === l.url)) {
              allLinks.push({ label: l.label, url: l.url, kind: l.kind, region: l.region });
            }
          }
        }

        // Mark brand as processed too
        processedNames.add(product.brand.toLowerCase());
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

        // Collect brand links
        if (brandProfile.links) {
          for (const l of brandProfile.links) {
            if (!allLinks.some((al) => al.url === l.url)) {
              allLinks.push({ label: l.label, url: l.url, kind: l.kind, region: l.region });
            }
          }
        }

        // Collect specific product links
        if (specificProduct?.retailer_links) {
          for (const l of specificProduct.retailer_links) {
            allLinks.push({ label: `${l.label} (${specificProduct.name})`, url: l.url });
          }
        }
      }
    }
  }

  // Need at least 2 identified components to build a system assessment
  if (components.length < 2) return null;

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

  // ── System character opening (brief) ──────────────
  // A one-two sentence overview of the system's overall lean.
  const systemCharacterOpening = inferSystemCharacterOpening(components);

  // ── Interaction detail ──────────────────────────────
  // How the components interact — more detailed architectural reading.
  const interactionParts = [interactionSummary];
  if (ampSpeakerFit) interactionParts.push(ampSpeakerFit);
  const systemInteractionDetail = interactionParts.join(' ');

  return {
    subject: `Your system: ${subject}`,
    // Undefined — assessment sections carry all content; suppress AdvisoryProse
    philosophy: undefined,
    tendencies: undefined,
    // System assessment specific fields
    systemContext: systemCharacterOpening,
    componentReadings: componentParagraphs,
    systemInteraction: systemInteractionDetail,
    assessmentStrengths,
    assessmentLimitations,
    upgradeDirection,
    followUp,
    links: allLinks.length > 0 ? allLinks : undefined,
  };
}

/**
 * Brief system character opening — one or two sentences summarising
 * the overall architectural lean before the component-by-component detail.
 */
function inferSystemCharacterOpening(components: SystemComponent[]): string {
  const leans = classifyComponentLeans(components);
  const warmCount = leans.filter((l) => l.lean === 'warm').length;
  const preciseCount = leans.filter((l) => l.lean === 'precise').length;
  const names = components.map((c) => c.displayName).join(', ');

  if (warmCount > 0 && preciseCount > 0) {
    return `A system built around complementary tendencies — precision and warmth balancing each other across the chain. Components: ${names}.`;
  }
  if (warmCount >= 2) {
    return `A system biased toward warmth and tonal density throughout the chain. Components: ${names}.`;
  }
  if (preciseCount >= 2) {
    return `A system biased toward precision and clarity throughout the chain. Components: ${names}.`;
  }
  return `A system with mixed tendencies — the overall character depends on how these components interact. Components: ${names}.`;
}

/**
 * Infer how the named components interact in a system.
 * Deterministic — based on known brand/product tendencies.
 */
function inferSystemInteraction(components: SystemComponent[]): string {
  // Classify each component's sonic lean
  const leans: { name: string; lean: 'warm' | 'neutral' | 'precise' | 'unknown' }[] = [];

  for (const c of components) {
    if (c.product?.traits) {
      const t = c.product.traits;
      if ((t.clarity ?? 0) > 0.8 && (t.tonal_density ?? 0.5) < 0.5) {
        leans.push({ name: c.displayName, lean: 'precise' });
      } else if ((t.tonal_density ?? 0.5) > 0.7 && (t.flow ?? 0.5) > 0.7) {
        leans.push({ name: c.displayName, lean: 'warm' });
      } else {
        leans.push({ name: c.displayName, lean: 'neutral' });
      }
    } else if (c.brandProfile) {
      const tendLower = c.brandProfile.tendencies.toLowerCase();
      if (tendLower.includes('warm') || tendLower.includes('rich') || tendLower.includes('dense')) {
        leans.push({ name: c.displayName, lean: 'warm' });
      } else if (tendLower.includes('precise') || tendLower.includes('clarity') || tendLower.includes('analytical')) {
        leans.push({ name: c.displayName, lean: 'precise' });
      } else {
        leans.push({ name: c.displayName, lean: 'neutral' });
      }
    } else {
      leans.push({ name: c.displayName, lean: 'unknown' });
    }
  }

  const warmCount = leans.filter((l) => l.lean === 'warm').length;
  const preciseCount = leans.filter((l) => l.lean === 'precise').length;
  const warmNames = leans.filter((l) => l.lean === 'warm').map((l) => l.name);
  const preciseNames = leans.filter((l) => l.lean === 'precise').map((l) => l.name);

  // ── Build causal explanation fragments ────────────────
  // Step 2: trace system character to component-level design traits.
  const causalParts: string[] = [];
  for (const c of components) {
    if (c.product?.architecture) {
      causalParts.push(`${c.displayName} uses a ${c.product.architecture} design`);
    } else if (c.brandProfile?.designFamily) {
      causalParts.push(`${c.displayName} belongs to a ${c.brandProfile.designFamily.name} lineage`);
    }
  }
  const causalNote = causalParts.length > 0
    ? ' ' + causalParts.join('; ') + '.'
    : '';

  if (warmCount > 0 && preciseCount > 0) {
    return `This is a system with complementary tendencies. ${preciseNames.join(' and ')} ${preciseCount === 1 ? 'provides' : 'provide'} articulation and clarity, while ${warmNames.join(' and ')} ${warmCount === 1 ? 'adds' : 'add'} warmth and tonal body.${causalNote} The precision upstream and warmth downstream balance each other — a deliberate architectural pairing that serves both detail and musical involvement.`;
  }
  if (warmCount >= 2) {
    return `This system leans toward warmth and engagement throughout the chain. ${warmNames.join(', ')} all contribute tonal body and midrange presence.${causalNote} The overall character tends toward richness and immersion — density compounds across the chain, which may sustain engagement but could reduce transient articulation.`;
  }
  if (preciseCount >= 2) {
    return `This system leans toward precision and clarity throughout the chain. ${preciseNames.join(', ')} all emphasise detail and transient definition.${causalNote} The cumulative precision tends to deliver a revealing, well-defined presentation — though without a warmth source in the chain, extended sessions may feel lean.`;
  }

  // Mixed or unknown
  return `The components in this system each bring distinct tendencies.${causalNote} The overall character depends on how they interact in practice — room acoustics, cable choices, and source material all influence the final balance.`;
}

/**
 * Infer amplifier-speaker fit from known design families and product data.
 */
function inferAmplifierSpeakerFit(components: SystemComponent[]): string | null {
  const amp = components.find((c) => c.role === 'amplifier');
  const speaker = components.find((c) => c.role === 'speaker');

  if (!amp || !speaker) return null;

  // Check for design family pairing notes
  if (amp.brandProfile?.designFamily?.ampPairing && speaker.brandProfile?.designFamily?.character) {
    return `${amp.displayName} paired with ${speaker.displayName}: ${amp.brandProfile.designFamily.ampPairing} ${speaker.brandProfile.designFamily.character.includes('sensitivity') ? speaker.brandProfile.designFamily.character : ''}`.trim();
  }

  // Check brand-level pairing notes
  if (amp.brandProfile?.systemContext) {
    return `${amp.displayName}: ${amp.brandProfile.systemContext}`;
  }

  return null;
}

/**
 * Infer trade-offs from the system's component balance.
 * Step 3 of the advisory reasoning structure.
 *
 * Uses confident language for known component traits, analytical
 * language for the system-level consequence.
 */
function inferSystemTradeoffs(components: SystemComponent[]): string | null {
  const leans: { name: string; lean: 'warm' | 'neutral' | 'precise' | 'unknown' }[] = [];

  for (const c of components) {
    if (c.product?.traits) {
      const t = c.product.traits;
      if ((t.clarity ?? 0) > 0.8 && (t.tonal_density ?? 0.5) < 0.5) {
        leans.push({ name: c.displayName, lean: 'precise' });
      } else if ((t.tonal_density ?? 0.5) > 0.7 && (t.flow ?? 0.5) > 0.7) {
        leans.push({ name: c.displayName, lean: 'warm' });
      } else {
        leans.push({ name: c.displayName, lean: 'neutral' });
      }
    } else if (c.brandProfile) {
      const tendLower = c.brandProfile.tendencies.toLowerCase();
      if (tendLower.includes('warm') || tendLower.includes('rich') || tendLower.includes('dense')) {
        leans.push({ name: c.displayName, lean: 'warm' });
      } else if (tendLower.includes('precise') || tendLower.includes('clarity') || tendLower.includes('analytical')) {
        leans.push({ name: c.displayName, lean: 'precise' });
      } else {
        leans.push({ name: c.displayName, lean: 'neutral' });
      }
    } else {
      leans.push({ name: c.displayName, lean: 'unknown' });
    }
  }

  const warmCount = leans.filter((l) => l.lean === 'warm').length;
  const preciseCount = leans.filter((l) => l.lean === 'precise').length;

  if (warmCount > 0 && preciseCount > 0) {
    // Complementary — the trade-off is that neither extreme is fully realised
    return 'The trade-off in a complementary system is that neither precision nor warmth is fully maximised. The system balances the two rather than committing to either. This is often a strength — it keeps the presentation engaging without becoming fatiguing or clinical.';
  }
  if (warmCount >= 2) {
    return 'The trade-off of stacking warmth is reduced transient precision and potentially compressed spatial definition. If recordings feel congested or slow, the system may be compounding density beyond what serves the music.';
  }
  if (preciseCount >= 2) {
    return 'The trade-off of stacking precision is reduced tonal body and listening ease. If extended sessions become fatiguing or the presentation feels clinical, the cumulative speed may be outpacing the system\'s ability to deliver warmth and flow.';
  }

  return null;
}

/**
 * Infer what is working well in the system based on component character.
 */
function inferAssessmentStrengths(components: SystemComponent[]): string[] {
  const strengths: string[] = [];
  const leans = classifyComponentLeans(components);

  const warmCount = leans.filter((l) => l.lean === 'warm').length;
  const preciseCount = leans.filter((l) => l.lean === 'precise').length;

  if (warmCount > 0 && preciseCount > 0) {
    strengths.push('Complementary tonal balance — precision and warmth offset each other');
    strengths.push('The system is likely to sustain engagement across long sessions');
  }
  if (warmCount >= 2) {
    strengths.push('Consistent warmth and tonal density — midrange should feel present and immersive');
    strengths.push('Engagement and musicality are likely high priorities this system handles well');
  }
  if (preciseCount >= 2) {
    strengths.push('Strong transient definition and clarity — micro-detail retrieval should be excellent');
    strengths.push('Spatial precision and imaging likely well-defined');
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
 */
function inferAssessmentLimitations(components: SystemComponent[]): string[] {
  const limitations: string[] = [];
  const leans = classifyComponentLeans(components);

  const warmCount = leans.filter((l) => l.lean === 'warm').length;
  const preciseCount = leans.filter((l) => l.lean === 'precise').length;

  if (warmCount >= 2 && preciseCount === 0) {
    limitations.push('Stacked warmth may reduce transient precision and spatial clarity');
    limitations.push('Complex, dense recordings could sound congested');
  }
  if (preciseCount >= 2 && warmCount === 0) {
    limitations.push('Stacked precision may thin out tonal body over long sessions');
    limitations.push('Extended listening could trend toward fatigue without a warmth counterbalance');
  }

  // Component-specific limitations
  for (const c of components) {
    if (c.product?.traits) {
      const t = c.product.traits;
      if ((t.tonal_density ?? 0.5) < 0.35) limitations.push(`${c.displayName} may lean thin in the midrange`);
      if ((t.flow ?? 0.5) < 0.35) limitations.push(`${c.displayName} may prioritize precision over musical flow`);
    }
  }

  return limitations;
}

/**
 * Infer likely upgrade direction based on system balance.
 */
function inferUpgradeDirection(components: SystemComponent[]): string {
  const leans = classifyComponentLeans(components);
  const warmCount = leans.filter((l) => l.lean === 'warm').length;
  const preciseCount = leans.filter((l) => l.lean === 'precise').length;

  if (warmCount > 0 && preciseCount > 0) {
    return 'This system appears well-balanced. Changes would likely shift the character rather than fix a gap. If you want to explore, focus on the quality you most want to intensify — but "do nothing" is a strong option here.';
  }
  if (warmCount >= 2) {
    return 'If you want to add clarity without losing the warmth that defines this system, a source upgrade (DAC or streamer) with better transient resolution is the gentlest move. Swapping the amplifier or speakers would shift the system\'s identity more fundamentally.';
  }
  if (preciseCount >= 2) {
    return 'If you want to add warmth and flow without sacrificing the clarity this system delivers, a DAC with richer harmonic texture or speakers with more tonal density would be the most aligned direction. Adding tubes upstream is another option — but changes character more broadly.';
  }

  return 'Without stronger trait data on the components, the best next step depends on what you feel is missing. Name the quality you want more of, and the analysis can get more specific.';
}

/**
 * Classify each component's sonic lean — reusable helper.
 */
function classifyComponentLeans(components: SystemComponent[]): { name: string; lean: 'warm' | 'neutral' | 'precise' | 'unknown' }[] {
  const leans: { name: string; lean: 'warm' | 'neutral' | 'precise' | 'unknown' }[] = [];

  for (const c of components) {
    if (c.product?.traits) {
      const t = c.product.traits;
      if ((t.clarity ?? 0) > 0.8 && (t.tonal_density ?? 0.5) < 0.5) {
        leans.push({ name: c.displayName, lean: 'precise' });
      } else if ((t.tonal_density ?? 0.5) > 0.7 && (t.flow ?? 0.5) > 0.7) {
        leans.push({ name: c.displayName, lean: 'warm' });
      } else {
        leans.push({ name: c.displayName, lean: 'neutral' });
      }
    } else if (c.brandProfile) {
      const tendLower = c.brandProfile.tendencies.toLowerCase();
      if (tendLower.includes('warm') || tendLower.includes('rich') || tendLower.includes('dense')) {
        leans.push({ name: c.displayName, lean: 'warm' });
      } else if (tendLower.includes('precise') || tendLower.includes('clarity') || tendLower.includes('analytical')) {
        leans.push({ name: c.displayName, lean: 'precise' });
      } else {
        leans.push({ name: c.displayName, lean: 'neutral' });
      }
    } else {
      leans.push({ name: c.displayName, lean: 'unknown' });
    }
  }

  return leans;
}

/**
 * Build preference alignment note from user desires and system character.
 * Step 5 of the advisory reasoning structure.
 *
 * Returns null when no desires are present — the follow-up question
 * takes its place.
 */
function buildAssessmentPreferenceAlignment(
  components: SystemComponent[],
  desires?: DesireSignal[],
): string | null {
  if (!desires || desires.length === 0) return null;

  // Classify system lean for alignment check
  let systemLean: 'warm' | 'precise' | 'balanced' | 'unknown' = 'unknown';
  let warmCount = 0;
  let preciseCount = 0;
  for (const c of components) {
    if (c.brandProfile) {
      const t = c.brandProfile.tendencies.toLowerCase();
      if (t.includes('warm') || t.includes('rich') || t.includes('dense')) warmCount++;
      else if (t.includes('precise') || t.includes('clarity') || t.includes('analytical')) preciseCount++;
    }
  }
  if (warmCount > 0 && preciseCount > 0) systemLean = 'balanced';
  else if (warmCount > 0) systemLean = 'warm';
  else if (preciseCount > 0) systemLean = 'precise';

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
    return `You mentioned wanting more ${quality}. Your system already leans in that direction — the question is whether it has gone far enough or whether the warmth is compounding past the point of clarity.`;
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

  // ── Active system present: acknowledge and contextualize ──
  if (activeSystem && activeSystem.components.length > 0) {
    const componentNames = activeSystem.components.map((c) => normalizeDisplayName(c.brand, c.name));
    const componentList = componentNames.join(', ');
    const tendenciesNote = activeSystem.tendencies
      ? ` The system leans toward ${activeSystem.tendencies}.`
      : '';
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

  // Fall back to brand-profile inference if no active system or lean unknown
  if (systemLean === 'unknown') {
    for (const match of subjectMatches) {
      const bp = findBrandProfile(match.name);
      if (bp) {
        const tend = bp.tendencies.toLowerCase();
        if (tend.includes('warm') || tend.includes('rich') || tend.includes('dense')) {
          systemLean = systemLean === 'precise' ? 'balanced' : 'warm';
        } else if (tend.includes('fast') || tend.includes('precise') || tend.includes('transparent') || tend.includes('lean')) {
          systemLean = systemLean === 'warm' ? 'balanced' : 'precise';
        }
      }
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
