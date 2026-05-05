/**
 * Decision Frame — Strategic framing layer for shopping queries.
 *
 * Before producing product recommendations, the system identifies
 * the core system decision. This frames the shortlist as supporting
 * evidence for strategic directions rather than a product catalog.
 *
 * The decision frame is mandatory for all component categories
 * (DAC, amplifier, speaker, cable) when a user system is known.
 *
 * Architecture:
 *   - Deterministic inputs (system chain, component catalog, taste profile)
 *   - Structured output (DecisionFrame)
 *   - The LLM does not participate — all reasoning is from catalog data
 */

import type { Product } from './products/dacs';
import type { ActiveSystemContext } from './system-types';
import type { TasteProfile } from './taste-profile';
import type { ShoppingAdvisoryContext } from './advisory-response';
import { DAC_PRODUCTS } from './products/dacs';
import { SPEAKER_PRODUCTS } from './products/speakers';
import { AMPLIFIER_PRODUCTS } from './products/amplifiers';
import { topTraits } from './taste-profile';
import type { ShoppingCategory } from './shopping-intent';
import { analyzeSystemInteraction } from './system-interaction';
import type { SystemInteraction } from './system-interaction';
export type { SystemInteraction } from './system-interaction';

// ── Types ────────────────────────────────────────────

export interface DecisionDirection {
  /** Short label for this direction (e.g. "Stay in FPGA philosophy"). */
  label: string;
  /** What this direction optimises for. */
  optimises: string;
  /** What you trade away or risk. */
  tradeOff: string;
  /** How this interacts with the user's system. */
  systemInteraction: string;
  /** Architecture/topology filter for matching shortlist products. */
  topologyFilter?: string[];
  /** Is this the "do nothing" path? */
  isDoNothing?: boolean;
  /**
   * Lightweight illustrative examples for this direction. Not full product
   * cards — just 2–3 representative names with deterministic used-market
   * (HiFiShark) and manufacturer links. Exists only to give the user a
   * path to explore concrete gear after reading the strategic framing.
   * Populated deterministically from the catalog; ranking/compatibility
   * logic is NOT duplicated here.
   */
  exampleGear?: ExampleGearLink[];
}

export interface ExampleGearLink {
  /** Display: "Brand Name". */
  brand: string;
  /** Display: product model. */
  name: string;
  /** Used-market search URL (always available — deterministic). */
  hifiSharkUrl: string;
  /** Manufacturer or official-site URL when catalog has one. */
  manufacturerUrl?: string;
}

export interface DecisionFrame {
  /** The user's current component in this category (if known). */
  currentComponent?: {
    name: string;
    architecture?: string;
    topology?: string;
    /** One-line description of what the current component does well. */
    characterSummary: string;
  };
  /** The strategic question the user is really facing. */
  coreQuestion: string;
  /** 2-3 meaningful directions (always includes "do nothing" when applicable). */
  directions: DecisionDirection[];
  /** Category being evaluated. */
  category: string;
  /** Trait-level system interaction analysis (when chain is known). */
  systemAnalysis?: SystemInteraction;
}

// ── Architecture philosophy groupings ────────────────

interface PhilosophyGroup {
  label: string;
  topologies: string[];
  optimises: string;
  character: string;
  /** How this philosophy interacts with fast solid-state systems. */
  withFastSS: string;
  /** How this philosophy interacts with tube/warm systems. */
  withWarmSystems: string;
}

const DAC_PHILOSOPHIES: PhilosophyGroup[] = [
  {
    label: 'FPGA / Chord approach',
    topologies: ['fpga'],
    optimises: 'Timing precision, transient accuracy, spatial resolution',
    character: 'Fast, clean, energetic — excels at micro-detail and spatial cues',
    withFastSS: 'Reinforces speed and precision. Can lean toward analytical if both DAC and amp prioritise control over body',
    withWarmSystems: 'Adds definition and speed without warmth. Balances well with tube or warm-voiced amplification',
  },
  {
    label: 'Discrete R2R / ladder',
    topologies: ['r2r'],
    optimises: 'Tonal density, harmonic richness, textural engagement',
    character: 'Dense, textured, organic — prioritises musical involvement over analytical precision',
    withFastSS: 'Adds body and tonal weight. Compensates for leanness in fast solid-state systems',
    withWarmSystems: 'May stack density on top of warmth. Risk of over-richness if system is already tonally full',
  },
  {
    label: 'Delta-sigma (chip-based)',
    topologies: ['delta-sigma', 'ds'],
    optimises: 'Measured precision, low distortion, neutral transparency',
    character: 'Clean, neutral, technically precise — strong on measurements, less on tonal colour',
    withFastSS: 'Doubles down on precision. Can feel sterile or emotionally flat if the listener values engagement over accuracy',
    withWarmSystems: 'Good counterweight to warmth — adds clarity without adding density',
  },
  {
    label: 'Multibit / hybrid',
    topologies: ['multibit', 'hybrid'],
    optimises: 'Balance between precision and musicality',
    character: 'Blends chip and discrete approaches — aims for the middle ground',
    withFastSS: 'Generally integrates well. Less dramatic than a full R2R shift but adds some body',
    withWarmSystems: 'Neutral enough to avoid stacking. Adds moderate definition',
  },
];

const AMP_PHILOSOPHIES: PhilosophyGroup[] = [
  {
    label: 'High-current solid-state',
    topologies: ['solid-state', 'class-ab', 'class-a'],
    optimises: 'Control, dynamics, bass authority',
    character: 'Commanding grip on speakers, fast transients, precise imaging',
    withFastSS: 'Reinforces existing character. Change will be refinement, not transformation',
    withWarmSystems: 'Shifts balance toward precision and control',
  },
  {
    label: 'Tube amplification',
    topologies: ['tube', 'set', 'push-pull'],
    optimises: 'Harmonic richness, spatial depth, tonal colour',
    character: 'Warm, dimensional, textured — trades precision for engagement',
    withFastSS: 'Architectural shift. Fundamentally different presentation of music',
    withWarmSystems: 'Reinforces warmth. Risk of over-richness',
  },
  {
    label: 'Class D / switching',
    topologies: ['class-d'],
    optimises: 'Efficiency, clean power, modern neutrality',
    character: 'Efficient, neutral, improving rapidly. Best modern designs rival linear amps',
    withFastSS: 'Similar character. May be a lateral move unless the implementation is clearly better',
    withWarmSystems: 'Shifts toward precision and efficiency',
  },
];

// ── Catalog helpers ──────────────────────────────────

function getCatalog(category: ShoppingCategory): Product[] {
  switch (category) {
    case 'dac': return DAC_PRODUCTS;
    case 'speaker': return SPEAKER_PRODUCTS;
    case 'amplifier': return AMPLIFIER_PRODUCTS;
    default: return [];
  }
}

// ── Example-gear picker ──────────────────────────────
//
// Deterministic, read-only selection of 2–3 illustrative products per
// direction. Pure catalog filter — no scoring, no taste weighting, no
// compatibility evaluation. The decision frame already does all of that
// work for the main recommendation block; these examples exist only as
// a path for the user to explore representative gear in the named
// philosophy.

const HIFISHARK_BASE = 'https://www.hifishark.com/search?q=';

function hifiSharkUrlFor(brand: string, name: string): string {
  return `${HIFISHARK_BASE}${encodeURIComponent(`${brand} ${name}`)}`;
}

/** First retailer_link whose URL looks like a manufacturer / official site. */
function pickManufacturerUrl(product: Product): string | undefined {
  if (!product.retailer_links || product.retailer_links.length === 0) return undefined;
  const brandSlug = product.brand.toLowerCase().split(/\s+/)[0];
  // Prefer labels that mention the brand or "Manufacturer"/"Official".
  const preferred = product.retailer_links.find((l) => {
    const lbl = l.label.toLowerCase();
    return lbl.includes('manufacturer') || lbl.includes('official')
      || lbl.includes(brandSlug);
  });
  if (preferred) return preferred.url;
  // Fallback: first retailer_link that isn't a used-market search.
  const nonUsed = product.retailer_links.find((l) => {
    const u = l.url.toLowerCase();
    return !u.includes('hifishark') && !u.includes('ebay') && !u.includes('audiogon');
  });
  return nonUsed?.url;
}

function pickExamplesForDirection(
  direction: DecisionDirection,
  category: ShoppingCategory,
  current: Product | null,
): ExampleGearLink[] | undefined {
  // "Keep your X" path is explicitly about preserving the current product —
  // suggesting alternatives here contradicts the framing.
  if (direction.isDoNothing) return undefined;
  if (!direction.topologyFilter || direction.topologyFilter.length === 0) return undefined;

  const catalog = getCatalog(category);
  if (catalog.length === 0) return undefined;

  const filterSet = new Set(direction.topologyFilter.map((t) => t.toLowerCase()));
  const currentId = current?.id;

  const matches = catalog.filter((p) => {
    if (p.id === currentId) return false;
    if (!p.topology) return false;
    const topo = p.topology.toLowerCase();
    return [...filterSet].some((t) => topo === t || topo.includes(t) || t.includes(topo));
  });

  if (matches.length === 0) return undefined;

  // Deterministic order: (1) prefer 'current' availability, (2) higher price
  // tier = more representative flagship, (3) name ascending for stability.
  const availabilityRank = (p: Product): number =>
    p.availability === 'discontinued' || p.availability === 'vintage' ? 1 : 0;
  const ranked = [...matches].sort((a, b) => {
    const av = availabilityRank(a) - availabilityRank(b);
    if (av !== 0) return av;
    const pr = (b.price ?? 0) - (a.price ?? 0);
    if (pr !== 0) return pr;
    return a.name.localeCompare(b.name);
  });

  const selected = ranked.slice(0, 3);
  return selected.map((p) => ({
    brand: p.brand,
    name: p.name,
    hifiSharkUrl: hifiSharkUrlFor(p.brand, p.name),
    manufacturerUrl: pickManufacturerUrl(p),
  }));
}

function getPhilosophies(category: ShoppingCategory): PhilosophyGroup[] {
  switch (category) {
    case 'dac': return DAC_PHILOSOPHIES;
    case 'amplifier': return AMP_PHILOSOPHIES;
    default: return [];
  }
}

/**
 * Find the user's current component in the given category.
 * Matches system component names against the product catalog.
 */
function findCurrentComponent(
  category: ShoppingCategory,
  systemComponents?: string[],
): Product | null {
  if (!systemComponents || systemComponents.length === 0) return null;
  const catalog = getCatalog(category);

  for (const compName of systemComponents) {
    const lower = compName.toLowerCase();
    for (const p of catalog) {
      const pName = p.name.toLowerCase();
      const pBrand = p.brand.toLowerCase();
      if (lower.includes(pName) || lower.includes(`${pBrand} ${pName}`)) {
        return p;
      }
    }
  }
  return null;
}

/**
 * Identify which philosophy group a product belongs to.
 */
function findPhilosophy(product: Product, category: ShoppingCategory): PhilosophyGroup | null {
  const philosophies = getPhilosophies(category);
  if (!product.topology) return null;

  const topo = product.topology.toLowerCase();
  return philosophies.find((g) =>
    g.topologies.some((t) => topo.includes(t) || t.includes(topo)),
  ) ?? null;
}

// ── System character inference ───────────────────────

type SystemCharacter = 'fast-ss' | 'warm' | 'neutral' | 'unknown';

function inferSystemCharacter(systemComponents?: string[]): SystemCharacter {
  if (!systemComponents) return 'unknown';
  const joined = systemComponents.join(' ').toLowerCase();

  // Fast solid-state indicators
  const fastSS = /\b(job|benchmark|bryston|chord|hegel|simaudio|classe|parasound|rotel)\b/i;
  // Warm / tube indicators
  const warm = /\b(tube|valve|set|el34|kt88|300b|leben|primaluna|line magnetic|cary|cayin)\b/i;

  if (warm.test(joined)) return 'warm';
  if (fastSS.test(joined)) return 'fast-ss';
  return 'neutral';
}

// ── Main builder ─────────────────────────────────────

/**
 * Build a decision frame for a shopping query.
 *
 * Returns null if no system context is available (the decision frame
 * requires knowing what the user currently has to frame the trade-off).
 */
export function buildDecisionFrame(
  category: ShoppingCategory,
  ctx?: ShoppingAdvisoryContext,
  tasteProfile?: TasteProfile | null,
): DecisionFrame | null {
  const philosophies = getPhilosophies(category);
  if (philosophies.length === 0) return null; // No philosophy map for this category

  const current = findCurrentComponent(category, ctx?.systemComponents);
  const systemChar = inferSystemCharacter(ctx?.systemComponents);

  // Run trait-level system interaction analysis
  const systemAnalysis = ctx?.systemComponents
    ? analyzeSystemInteraction(ctx.systemComponents, null, tasteProfile)
    : null;

  // Current component details
  const currentPhilosophy = current ? findPhilosophy(current, category) : null;
  const currentInfo = current ? {
    name: `${current.brand} ${current.name}`,
    architecture: current.architecture,
    topology: current.topology,
    characterSummary: buildCharacterSummary(current),
  } : undefined;

  // ── Build the core question ─────────────────────
  const categoryLabel = category === 'dac' ? 'DAC' : category === 'amplifier' ? 'amplifier' : category;
  const coreQuestion = current && currentPhilosophy
    ? `Your current ${categoryLabel} (${current.brand} ${current.name}) sits in the ${currentPhilosophy.label} camp — ${currentPhilosophy.character.split('—')[0].trim().toLowerCase()}. The meaningful decision is whether to refine that approach or explore a different design philosophy.`
    : current
      ? `You have a ${current.brand} ${current.name}. The question is whether to upgrade within the same design approach or shift to a different sonic philosophy.`
      : `The main decision is which design philosophy aligns with your listening priorities.`;

  // ── Build directions ────────────────────────────
  const directions: DecisionDirection[] = [];

  // Direction 1: "Do nothing" (when current component is known)
  if (current) {
    const doNothingReason = buildDoNothingCase(current, tasteProfile, category);
    directions.push({
      label: `Keep your ${current.brand} ${current.name}`,
      optimises: 'Stability — no disruption to a working system',
      tradeOff: 'You may miss sonic qualities your current component doesn\'t prioritise',
      systemInteraction: doNothingReason,
      isDoNothing: true,
    });
  }

  // Direction 2+: Alternative philosophies
  for (const philosophy of philosophies) {
    // Skip the user's current philosophy (handled separately)
    const isCurrent = currentPhilosophy && philosophy.label === currentPhilosophy.label;

    let systemNote = systemChar === 'fast-ss'
      ? philosophy.withFastSS
      : systemChar === 'warm'
        ? philosophy.withWarmSystems
        : philosophy.optimises;

    // Enrich with stacking risk warnings from trait analysis
    if (systemAnalysis && systemAnalysis.stackingRisks.length > 0) {
      systemNote = enrichWithStackingRisks(systemNote, philosophy, systemAnalysis);
    }

    if (isCurrent) {
      // "Refine within current philosophy" direction
      directions.push({
        label: `Refine within the ${philosophy.label}`,
        optimises: `Greater refinement of ${philosophy.optimises.toLowerCase()}`,
        tradeOff: 'Improvement will be incremental — same fundamental character',
        systemInteraction: systemNote,
        topologyFilter: philosophy.topologies,
      });
    } else {
      // "Explore a different philosophy" direction
      directions.push({
        label: `Move toward ${philosophy.label}`,
        optimises: philosophy.optimises,
        tradeOff: philosophy.character.split('—')[1]?.trim()
          ?? `Different emphasis than your current approach`,
        systemInteraction: systemNote,
        topologyFilter: philosophy.topologies,
      });
    }
  }

  // Limit to 3 most relevant directions (do-nothing + 2 alternatives)
  // Keep do-nothing, the "refine current" direction, and the best alternative
  const doNothing = directions.filter((d) => d.isDoNothing);
  const refineCurrent = directions.filter((d) =>
    !d.isDoNothing && d.label.startsWith('Refine'),
  );
  const alternatives = directions.filter((d) =>
    !d.isDoNothing && !d.label.startsWith('Refine'),
  );

  // Rank alternatives by taste alignment
  const rankedAlternatives = rankAlternativesByTaste(alternatives, tasteProfile);

  const finalDirections = [
    ...doNothing,
    ...refineCurrent.slice(0, 1),
    ...rankedAlternatives.slice(0, current ? 1 : 2), // More alternatives if no current
  ];

  // Enrich each non-do-nothing direction with 2-3 illustrative examples
  // from the catalog. Deterministic, read-only — does not affect the
  // main recommendation pipeline.
  const enrichedDirections = finalDirections.map((d) => {
    const examples = pickExamplesForDirection(d, category, current ?? null);
    return examples ? { ...d, exampleGear: examples } : d;
  });

  return {
    currentComponent: currentInfo,
    coreQuestion,
    directions: enrichedDirections,
    category: categoryLabel,
    systemAnalysis: systemAnalysis ?? undefined,
  };
}

// ── Helper builders ──────────────────────────────────

function buildCharacterSummary(product: Product): string {
  const parts: string[] = [];
  if (product.architecture) parts.push(product.architecture);

  const strongTraits: string[] = [];
  for (const [k, v] of Object.entries(product.traits)) {
    if (v >= 0.7 && k !== 'fatigue_risk' && k !== 'glare_risk') {
      strongTraits.push(k.replace(/_/g, ' '));
    }
  }
  if (strongTraits.length > 0) {
    // Playbook §2: ≤2 defining characteristics per clause — no trait dumps.
    parts.push(`emphasises ${strongTraits.slice(0, 2).join(' and ')}`);
  }

  return parts.join(' — ') || product.description?.split('.')[0] || 'Character not profiled';
}

function buildDoNothingCase(
  current: Product,
  tasteProfile?: TasteProfile | null,
  _category?: ShoppingCategory,
): string {
  if (!tasteProfile) {
    return `Your ${current.brand} ${current.name} is a competent ${current.architecture ?? ''} design. Without knowing your priorities, it may already be serving you well.`;
  }

  const topUserTraits = topTraits(tasteProfile, 3).map((t) => t.label);
  const strongProductTraits: string[] = [];
  for (const [k, v] of Object.entries(current.traits)) {
    if (v >= 0.7 && k !== 'fatigue_risk' && k !== 'glare_risk') {
      strongProductTraits.push(k.replace(/_/g, ' '));
    }
  }

  const overlap = topUserTraits.filter((t) =>
    strongProductTraits.some((s) =>
      s.includes(t.toLowerCase()) || t.toLowerCase().includes(s),
    ),
  );

  if (overlap.length >= 2) {
    return `Your ${current.brand} ${current.name} already aligns well with your priorities (${overlap.join(', ')}). A change would need to be clearly better in these areas to justify the disruption.`;
  }

  if (overlap.length === 1) {
    return `Your ${current.brand} ${current.name} serves your ${overlap[0]} priority well. Your other priorities (${topUserTraits.filter((t) => !overlap.includes(t)).join(', ')}) may benefit from a different approach — but consider whether the current balance is working for you.`;
  }

  return `Your ${current.brand} ${current.name}'s strengths (${strongProductTraits.slice(0, 2).join(', ')}) don't overlap strongly with your stated priorities (${topUserTraits.join(', ')}). There may be room for a more aligned choice — but only if you're genuinely dissatisfied.`;
}

/**
 * Rank alternative directions by alignment with the user's taste profile.
 */
function rankAlternativesByTaste(
  alternatives: DecisionDirection[],
  tasteProfile?: TasteProfile | null,
): DecisionDirection[] {
  if (!tasteProfile || alternatives.length <= 1) return alternatives;

  const topLabels = topTraits(tasteProfile, 3).map((t) => t.label.toLowerCase());

  return [...alternatives].sort((a, b) => {
    const aScore = topLabels.filter((t) =>
      a.optimises.toLowerCase().includes(t),
    ).length;
    const bScore = topLabels.filter((t) =>
      b.optimises.toLowerCase().includes(t),
    ).length;
    return bScore - aScore;
  });
}

// ── Stacking risk enrichment ────────────────────────

/** Mapping from philosophy emphasis to relevant stacking traits. */
const PHILOSOPHY_STACKING_TRAITS: Record<string, string[]> = {
  // DAC philosophies
  'FPGA / Chord approach': ['clarity', 'speed'],
  'Discrete R2R / ladder': ['warmth', 'tonal_density', 'texture'],
  'Delta-sigma (chip-based)': ['clarity', 'speed'],
  'Multibit / hybrid': [],
  // Amplifier philosophies
  'High-current solid-state': ['clarity', 'speed', 'dynamics'],
  'Tube amplification': ['warmth', 'tonal_density', 'texture'],
  'Class D / switching': ['clarity', 'speed'],
};

/**
 * Enrich a direction's system interaction note with trait-aware context.
 *
 * Separates character from risk:
 *   - Character: "your chain already leans toward X" (descriptive)
 *   - Risk: "adding more in this direction may push too far" (predictive)
 */
function enrichWithStackingRisks(
  baseNote: string,
  philosophy: PhilosophyGroup,
  analysis: SystemInteraction,
): string {
  const relevantTraits = PHILOSOPHY_STACKING_TRAITS[philosophy.label] ?? [];
  const matchedEmphasis = analysis.stackingRisks.filter((r) =>
    relevantTraits.includes(r.trait),
  );

  if (matchedEmphasis.length === 0) {
    // Check if this philosophy compensates for deficiencies instead
    const compensates = analysis.deficiencyRisks.filter((d) =>
      !relevantTraits.includes(d.trait),
    );
    if (compensates.length > 0) {
      const labels = compensates.map((d) => d.label).join(' and ');
      return `${baseNote}. Your chain is currently light on ${labels} — this direction may help.`;
    }
    return baseNote;
  }

  // Character observation (descriptive)
  const labels = matchedEmphasis.map((r) => r.label).join(' and ');
  const characterNote = `Your chain already leans toward ${labels}.`;

  // Cross-trait interaction note — takes priority over single-trait risk
  const crossTraitMatch = analysis.crossTraitRisks.find((cr) =>
    cr.traits.some((t) => relevantTraits.includes(t)),
  );
  if (crossTraitMatch) {
    return `${baseNote}. ${characterNote} ${crossTraitMatch.characterNote}`;
  }

  // Risk note (predictive — only for significant emphasis)
  const hasSignificant = matchedEmphasis.some((r) => r.severity === 'significant');
  const riskNote = hasSignificant
    ? ` Adding more in this direction may push too far.`
    : ` Adding more is possible but worth listening carefully.`;

  return `${baseNote}. ${characterNote}${riskNote}`;
}
