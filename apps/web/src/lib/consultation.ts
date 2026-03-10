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
import type { SubjectMatch } from './intent';

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
  /** 5. Optional neutral reference links (website, importer, dealers). */
  links?: { label: string; url: string; kind?: 'reference'; region?: string }[];
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
   * Link kind.  'reference' = neutral informational (default).
   * Future: 'affiliate' | 'commercial' — must be visually distinguished.
   */
  kind?: 'reference';
  /** ISO 3166-1 region code or broad region label (e.g. 'US', 'EU', 'JP', 'global'). */
  region?: string;
}

interface BrandProfile {
  names: string[];
  philosophy: string;
  tendencies: string;
  systemContext: string;
  /** Optional structured reference links — informational, not ranked. */
  links?: BrandLink[];
}

const BRAND_PROFILES: BrandProfile[] = [
  {
    names: ['shindo'],
    philosophy: 'Shindo amplifiers are hand-built, tube-based designs rooted in vintage circuit topologies. The design philosophy prioritizes harmonic richness and tonal saturation over measured neutrality.',
    tendencies: 'Listeners consistently describe Shindo systems as dense, flowing, and harmonically alive. They tend to emphasize tonal weight and midrange texture at the cost of some transient precision.',
    systemContext: 'Commonly paired with high-efficiency speakers — horn-loaded or single-driver designs that can work with lower power output.',
    links: [
      { label: 'Official website', url: 'https://www.shindo-laboratory.co.jp/', region: 'global' },
      { label: 'US importer (Tone Imports)', url: 'https://www.toneimports.com/', region: 'US' },
    ],
  },
  {
    names: ['pass labs', 'pass', 'first watt'],
    philosophy: 'Pass Labs designs emphasise simplicity and Class A operation where practical. First Watt is the low-power offshoot, exploring single-ended solid-state and unusual topologies.',
    tendencies: 'Pass amplifiers tend toward warmth and midrange richness for solid-state. First Watt designs emphasise texture and intimacy at the cost of dynamic scale.',
    systemContext: 'Pass Labs works across a range of speakers. First Watt pairs best with high-efficiency speakers — similar territory to low-power tube amps.',
    links: [
      { label: 'Pass Labs official', url: 'https://www.passlabs.com/', region: 'global' },
      { label: 'First Watt official', url: 'https://www.firstwatt.com/', region: 'global' },
      { label: 'Dealer (Reno HiFi)', url: 'https://www.renohifi.com/', region: 'US' },
    ],
  },
  {
    names: ['naim'],
    philosophy: 'Naim designs prioritise rhythmic drive and musical timing. The engineering philosophy emphasises pace and engagement over tonal density or spatial refinement.',
    tendencies: 'Listeners describe Naim systems as propulsive and engaging, with strong rhythmic coherence. They tend to de-emphasise warmth and spatial holography.',
    systemContext: 'Traditionally paired with Naim sources and Naim-friendly speakers. The timing-first approach works well with speakers that have good transient response.',
    links: [
      { label: 'Official website', url: 'https://www.naimaudio.com/', region: 'global' },
    ],
  },
  {
    names: ['luxman'],
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
    philosophy: 'Accuphase is a precision-oriented Japanese manufacturer. The design philosophy centres on measured accuracy, build quality, and long-term reliability.',
    tendencies: 'Accuphase gear tends toward transparency and control with a slightly warm tonal balance. More composed than rhythmically aggressive.',
    systemContext: 'Works well with revealing speakers where control and composure matter. A good match for listeners who value refinement over raw energy.',
    links: [
      { label: 'Official website', url: 'https://www.accuphase.com/', region: 'global' },
    ],
  },
  {
    names: ['lampizator', 'lampi'],
    philosophy: 'Lampizator builds tube-output DACs with a deliberate emphasis on harmonic richness and musical engagement over measured transparency.',
    tendencies: 'Described as tonally dense, flowing, and harmonically saturated. These DACs trade analytical precision for musical immersion and tonal weight.',
    systemContext: 'Pairs well with systems that benefit from added harmonic density. Can be too much in already warm or dense systems.',
    links: [
      { label: 'Official website', url: 'https://www.lampizator.eu/', region: 'global' },
    ],
  },
  {
    names: ['border patrol'],
    philosophy: 'Border Patrol builds NOS (non-oversampling) tube-output DACs with minimal digital processing. The philosophy is simplicity and directness.',
    tendencies: 'Listeners describe a natural, unforced sound with strong tonal body and flow. Treble is typically rolled compared to oversampling designs.',
    systemContext: 'Works best in systems where the rest of the chain provides sufficient detail and air. Pairs naturally with tube amplification and high-efficiency speakers.',
    links: [
      { label: 'Official website', url: 'https://www.borderpatrol.net/', region: 'global' },
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
    links: profile.links,
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

  return {
    subject: `${nameA} vs ${nameB}`,
    comparisonSummary: summary,
    philosophy: `${nameA}: ${philoA}\n\n${nameB}: ${philoB}`,
    tendencies: `${nameA}: ${tendA}\n\n${nameB}: ${tendB}`,
    systemContext: `Where they diverge most shapes which fits better — this depends on what you value in your listening and where your system currently sits.`,
    followUp: `What draws you toward one of these over the other — is it a specific quality, or more of a general direction?`,
  };
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

  // 2. Check for specific products in catalog
  const products = findProductsByBrand(currentMessage);
  if (products.length > 0) {
    const brandName = products[0].brand;
    return buildProductConsultation(products, brandName);
  }

  // 3. Check for topology/technology match
  const topoMatch = findTopologyMatch(currentMessage);
  if (topoMatch) {
    return buildArchetypeConsultation(topoMatch.archetype, topoMatch.label);
  }

  // 4. Check for known brand profile
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

  // Build a qualified comparison summary that answers first without absolute verdicts
  const summary = buildCriterionSummary(nameA, nameB, infoA, infoB, criterion);

  // Comparison-aware follow-up that reflects the axis of comparison
  const followUp = buildCriterionFollowUp(criterion);

  return {
    subject: `${nameA} vs ${nameB} — ${criterion.label}`,
    comparisonSummary: summary,
    philosophy: `${contextA}\n\n${contextB}`,
    tendencies: `The difference comes down to design priorities — ${criterion.label.toLowerCase()} is shaped differently by each approach.`,
    systemContext: 'How much this matters in practice depends on the rest of the chain and how the room interacts.',
    followUp,
  };
}

/**
 * Build a qualified comparison summary for a criterion-based follow-up.
 * Uses qualified language — "tends to be a more natural fit" rather than "is better".
 * When both sides are comparable, frames as a contrast rather than a winner.
 */
function buildCriterionSummary(
  nameA: string,
  nameB: string,
  infoA: BrandInfo | null,
  infoB: BrandInfo | null,
  criterion: ComparisonCriterion,
): string {
  // If we don't have data for both, give an honest partial answer
  if (!infoA || !infoB) {
    const knownName = infoA ? nameA : nameB;
    return `I have more information about ${knownName} in this context. The comparison is limited without fuller data on both sides.`;
  }

  // For amplifier pairing criteria, use system context to identify the more natural fit
  if (criterion.category === 'amplifier_pairing') {
    const ampType = criterion.label.toLowerCase();
    // Check if either side's system context explicitly mentions the amplifier type
    const aRelevance = assessRelevance(infoA, criterion);
    const bRelevance = assessRelevance(infoB, criterion);

    if (aRelevance > bRelevance) {
      return `${nameA} tends to be a more natural fit with ${ampType} — its design assumptions align more closely with that topology. ${nameB} can work, but may need more careful matching.`;
    }
    if (bRelevance > aRelevance) {
      return `${nameB} tends to be a more natural fit with ${ampType} — its design assumptions align more closely with that topology. ${nameA} can work, but may need more careful matching.`;
    }
    return `Both can work with ${ampType}, but they respond differently. ${nameA} and ${nameB} have different design assumptions that shape how they interact with that amplifier topology.`;
  }

  // For trait criteria, contrast their relative emphases
  if (criterion.category === 'trait') {
    const traitName = criterion.label.toLowerCase();
    const charA = extractCoreCharacter(infoA.tendencies);
    const charB = extractCoreCharacter(infoB.tendencies);
    return `In terms of ${traitName}, ${nameA} leans toward ${charA}, while ${nameB} leans toward ${charB}. The question is which balance serves your priorities better.`;
  }

  // For room criteria
  if (criterion.category === 'room') {
    return `Room interaction is shaped by efficiency, radiation pattern, and bass loading — ${nameA} and ${nameB} handle this differently based on their design priorities.`;
  }

  // General fallback
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
