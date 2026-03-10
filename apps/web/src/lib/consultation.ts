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

// ── Types ───────────────────────────────────────────

export interface ConsultationResponse {
  /** The subject the user asked about (brand, topology, concept). */
  subject: string;
  /** 1. Design philosophy — what it prioritizes. */
  philosophy: string;
  /** 2. Typical tendencies — how it tends to sound. */
  tendencies: string;
  /** 3. System context — where it works well. */
  systemContext?: string;
  /** 4. Optional light follow-up question. */
  followUp?: string;
}

// ── All products ────────────────────────────────────

const ALL_PRODUCTS: Product[] = [...DAC_PRODUCTS, ...SPEAKER_PRODUCTS];

// ── Brand knowledge ─────────────────────────────────
//
// For brands not in our product catalog, provide general
// orientation. These are brief, tendency-based, not encyclopedic.

interface BrandProfile {
  names: string[];
  philosophy: string;
  tendencies: string;
  systemContext: string;
}

const BRAND_PROFILES: BrandProfile[] = [
  {
    names: ['shindo'],
    philosophy: 'Shindo amplifiers are hand-built, tube-based designs rooted in vintage circuit topologies. The design philosophy prioritizes harmonic richness and tonal saturation over measured neutrality.',
    tendencies: 'Listeners consistently describe Shindo systems as dense, flowing, and harmonically alive. They tend to emphasize tonal weight and midrange texture at the cost of some transient precision.',
    systemContext: 'Commonly paired with high-efficiency speakers — horn-loaded or single-driver designs that can work with lower power output.',
  },
  {
    names: ['pass labs', 'pass', 'first watt'],
    philosophy: 'Pass Labs designs emphasise simplicity and Class A operation where practical. First Watt is the low-power offshoot, exploring single-ended solid-state and unusual topologies.',
    tendencies: 'Pass amplifiers tend toward warmth and midrange richness for solid-state. First Watt designs emphasise texture and intimacy at the cost of dynamic scale.',
    systemContext: 'Pass Labs works across a range of speakers. First Watt pairs best with high-efficiency speakers — similar territory to low-power tube amps.',
  },
  {
    names: ['naim'],
    philosophy: 'Naim designs prioritise rhythmic drive and musical timing. The engineering philosophy emphasises pace and engagement over tonal density or spatial refinement.',
    tendencies: 'Listeners describe Naim systems as propulsive and engaging, with strong rhythmic coherence. They tend to de-emphasise warmth and spatial holography.',
    systemContext: 'Traditionally paired with Naim sources and Naim-friendly speakers. The timing-first approach works well with speakers that have good transient response.',
  },
  {
    names: ['luxman'],
    philosophy: 'Luxman is a long-established Japanese manufacturer building both tube and solid-state designs with an emphasis on refinement and tonal elegance.',
    tendencies: 'Luxman amplifiers tend toward a slightly warm, composed presentation. Listeners describe good tonal density with more control and composure than most tube designs.',
    systemContext: 'Versatile pairing — works across a range of speaker types. The refined character complements both analytical and warmer speakers.',
  },
  {
    names: ['accuphase'],
    philosophy: 'Accuphase is a precision-oriented Japanese manufacturer. The design philosophy centres on measured accuracy, build quality, and long-term reliability.',
    tendencies: 'Accuphase gear tends toward transparency and control with a slightly warm tonal balance. More composed than rhythmically aggressive.',
    systemContext: 'Works well with revealing speakers where control and composure matter. A good match for listeners who value refinement over raw energy.',
  },
  {
    names: ['lampizator', 'lampi'],
    philosophy: 'Lampizator builds tube-output DACs with a deliberate emphasis on harmonic richness and musical engagement over measured transparency.',
    tendencies: 'Described as tonally dense, flowing, and harmonically saturated. These DACs trade analytical precision for musical immersion and tonal weight.',
    systemContext: 'Pairs well with systems that benefit from added harmonic density. Can be too much in already warm or dense systems.',
  },
  {
    names: ['border patrol'],
    philosophy: 'Border Patrol builds NOS (non-oversampling) tube-output DACs with minimal digital processing. The philosophy is simplicity and directness.',
    tendencies: 'Listeners describe a natural, unforced sound with strong tonal body and flow. Treble is typically rolled compared to oversampling designs.',
    systemContext: 'Works best in systems where the rest of the chain provides sufficient detail and air. Pairs naturally with tube amplification and high-efficiency speakers.',
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
    };
  }

  // Fallback to description
  return {
    subject,
    philosophy: `${primary.brand} ${primary.name} is an ${primary.architecture} design.`,
    tendencies: primary.description,
    followUp: 'What are you pairing it with, and what do you value most in your listening?',
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
 * Build a consultation response from static brand profile.
 * Used for brands not in our product catalog.
 */
function buildBrandConsultation(profile: BrandProfile): ConsultationResponse {
  return {
    subject: profile.names[0].charAt(0).toUpperCase() + profile.names[0].slice(1),
    philosophy: profile.philosophy,
    tendencies: profile.tendencies,
    systemContext: profile.systemContext,
    followUp: 'Is this something you\'re considering for your system, or more exploring the design approach?',
  };
}

// ── Public API ───────────────────────────────────────

/**
 * Build a consultation response for a knowledge/philosophy question.
 *
 * Resolution order:
 *   1. Product tendencies (specific product in catalog)
 *   2. Design archetype (topology/technology question)
 *   3. Brand profile (known brand, no specific product)
 *   4. null (no match — caller should fall back to gear inquiry)
 */
export function buildConsultationResponse(
  currentMessage: string,
): ConsultationResponse | null {
  // 1. Check for specific products in catalog
  const products = findProductsByBrand(currentMessage);
  if (products.length > 0) {
    const brandName = products[0].brand;
    return buildProductConsultation(products, brandName);
  }

  // 2. Check for topology/technology match
  const topoMatch = findTopologyMatch(currentMessage);
  if (topoMatch) {
    return buildArchetypeConsultation(topoMatch.archetype, topoMatch.label);
  }

  // 3. Check for known brand profile
  const brandProfile = findBrandProfile(currentMessage);
  if (brandProfile) {
    return buildBrandConsultation(brandProfile);
  }

  // 4. No match
  return null;
}
