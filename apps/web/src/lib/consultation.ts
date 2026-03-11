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
import type { SubjectMatch, ContextKind } from './intent';
import { getApprovedBrand } from './knowledge';
import type { BrandKnowledge } from './knowledge/schema';

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
  philosophy: string;
  /** 2. Typical tendencies — how it tends to sound. */
  tendencies: string;
  /** 3. System context — where it works well. */
  systemContext?: string;
  /** 4. Optional light follow-up question. */
  followUp?: string;
  /** 5. Optional neutral reference links (website, importer, dealers, reviews). */
  links?: { label: string; url: string; kind?: 'reference' | 'dealer' | 'review'; region?: string }[];
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
    systemContext: 'Chord DACs pair well with warm or tonally dense amplification, where the source-level clarity cuts through added warmth rather than being masked. In systems already biased toward speed and transparency, the tonal lightness may become noticeable.',
    pairingNotes: 'Works well with tube amplification and warm solid-state designs. The Hugo and Qutest lines are widely used as headphone DAC/amps and desktop sources.',
    links: [
      { label: 'Official website', url: 'https://chordelectronics.co.uk/', region: 'global' },
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
    return `${contextLabel} — that helps narrow the comparison. ${nameA} and ${nameB} will interact with that amplifier differently based on their load characteristics and design priorities.`;
  }

  if (contextKind === 'room') {
    return `That room context matters. ${nameA} and ${nameB} will behave differently depending on boundary interaction, efficiency, and radiation pattern.`;
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
export function buildSystemAssessment(
  currentMessage: string,
  subjectMatches: SubjectMatch[],
): ConsultationResponse | null {
  const components: SystemComponent[] = [];
  const allLinks: { label: string; url: string; kind?: 'reference' | 'dealer' | 'review'; region?: string }[] = [];
  const processedNames = new Set<string>();

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
          displayName: `${product.brand} ${product.name}`,
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
          ? `${specificProduct.brand} ${specificProduct.name}`
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

  const philosophy = componentParagraphs.join('\n\n');

  // ── Infer system interaction ────────────────────────
  const tendencies = inferSystemInteraction(components);

  // ── Amplifier-speaker fit note ──────────────────────
  const systemContext = inferAmplifierSpeakerFit(components);

  // ── Subject line ────────────────────────────────────
  const subject = components.map((c) => c.displayName).join(', ');

  return {
    subject: `Your system: ${subject}`,
    philosophy,
    tendencies,
    systemContext: systemContext ?? undefined,
    followUp: 'What are you exploring — is there something you\'d like to change about this balance, or are you looking to understand what a specific upgrade path might shift?',
    links: allLinks.length > 0 ? allLinks : undefined,
  };
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

  if (warmCount > 0 && preciseCount > 0) {
    return `This is a system with complementary tendencies. ${preciseNames.join(' and ')} ${preciseCount === 1 ? 'provides' : 'provide'} articulation and clarity, while ${warmNames.join(' and ')} ${warmCount === 1 ? 'adds' : 'add'} warmth and tonal body. The source and amplification/speakers balance precision against engagement — a deliberate architectural choice that suggests a system tuned for both detail and musical involvement.`;
  }
  if (warmCount >= 2) {
    return `This system leans toward warmth and engagement throughout the chain. ${warmNames.join(', ')} all contribute tonal body and midrange presence. The overall character is likely rich and immersive, though this could compound toward density if not balanced with source-level articulation.`;
  }
  if (preciseCount >= 2) {
    return `This system leans toward precision and clarity throughout the chain. ${preciseNames.join(', ')} all emphasise detail and transient definition. The result is likely revealing and well-defined, though the cumulative precision may reduce perceived warmth or ease.`;
  }

  // Mixed or unknown
  return `The components in this system each bring distinct tendencies. The overall character depends on how they interact in practice — room acoustics, cable choices, and source material all influence the final balance.`;
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
