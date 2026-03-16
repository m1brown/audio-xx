/**
 * System Interaction Analyzer
 *
 * Walks the user's component chain and detects trait-level tendencies
 * and stacking risks — situations where multiple components push the
 * same sonic dimension strongly in the same direction.
 *
 * Important distinction:
 *   - Chain CHARACTER is descriptive: "your system leans toward warmth"
 *   - Stacking RISK is predictive: "adding more warmth may push too far"
 *   Character is always present. Risk only appears when a candidate
 *   or direction would compound an already-strong tendency.
 *
 * Input: component names from the user's system + candidate product.
 * Output: structured interaction analysis and a summary character.
 *
 * This is deterministic — no LLM. It reads product catalog traits
 * via resolveTraitValue() and applies threshold-based detection.
 */

import type { Product } from './products/dacs';
import { DAC_PRODUCTS } from './products/dacs';
import { SPEAKER_PRODUCTS } from './products/speakers';
import { AMPLIFIER_PRODUCTS } from './products/amplifiers';
import { TURNTABLE_PRODUCTS } from './products/turntables';
import { resolveTraitValue } from './sonic-tendencies';
import type { TasteProfile } from './taste-profile';
import { topTraits } from './taste-profile';

// ── Combined catalog ────────────────────────────────

const ALL_CATALOG: Product[] = [
  ...DAC_PRODUCTS,
  ...SPEAKER_PRODUCTS,
  ...AMPLIFIER_PRODUCTS,
  ...TURNTABLE_PRODUCTS,
];

// ── Tuning Constants ────────────────────────────────
//
// Centralized thresholds for easy tuning. All trait values
// are on a 0–1 scale via resolveTraitValue().

/** A component "emphasises" a trait when its resolved value reaches this. */
const STACKING_THRESHOLD = 0.65;

/** Chain-average below this signals a trait gap. */
const DEFICIENCY_THRESHOLD = 0.35;

/**
 * Chain character classification boundaries.
 * These are summed pairs (e.g. warmth + tonal_density) so the
 * range is 0–2. Values above LEAN_TOWARD fire a character label;
 * values above STRONG fire "strong" severity.
 */
const CHARACTER_LEAN_TOWARD = 1.2;
const CHARACTER_STRONG = 1.4;

/** Minimum components that must push a trait to flag stacking. */
const STACKING_MIN_COMPONENTS = 2;

/** Candidate compensation threshold — must reach this to count. */
const COMPENSATION_THRESHOLD = 0.6;

// ── Types ───────────────────────────────────────────

/** A single trait stacking observation. */
export interface StackingRisk {
  trait: string;
  label: string;
  componentCount: number;
  contributors: string[];
  averageValue: number;
  severity: 'moderate' | 'significant';
  /** Human-readable consequence — only used when a candidate compounds this. */
  consequence: string;
}

/** A lean/thin risk — when the chain lacks a trait. */
export interface DeficiencyRisk {
  trait: string;
  label: string;
  chainAverage: number;
  consequence: string;
}

/** A cross-trait stacking observation — two correlated traits reinforce each other. */
export interface CrossTraitRisk {
  traits: [string, string];
  label: string;
  contributors: string[];
  consequence: string;
  characterNote: string;
}

/** Full system interaction analysis result. */
export interface SystemInteraction {
  /** Descriptive chain character — what the system sounds like now. */
  chainCharacter: string;
  /** Traits the chain emphasises (descriptive, not judgmental). */
  stackingRisks: StackingRisk[];
  /** Cross-trait interactions — emergent effects from correlated stacking. */
  crossTraitRisks: CrossTraitRisk[];
  /** Traits the chain underserves. */
  deficiencyRisks: DeficiencyRisk[];
  /** How a candidate product would interact with the chain. */
  candidateInteraction?: CandidateInteraction;
  /** One-sentence summary for display (character only, no risk). */
  summary: string;
}

/** How a specific candidate product interacts with the existing chain. */
export interface CandidateInteraction {
  compounds: Array<{ trait: string; label: string; note: string }>;
  compensates: Array<{ trait: string; label: string; note: string }>;
  verdict: 'reinforces' | 'balances' | 'neutral';
}

// ── Trait metadata ──────────────────────────────────

const TRAIT_LABELS: Record<string, string> = {
  warmth: 'warmth',
  tonal_density: 'tonal density',
  clarity: 'clarity',
  speed: 'speed / transient attack',
  dynamics: 'dynamics',
  flow: 'musical flow',
  elasticity: 'elasticity / bounce',
  texture: 'texture / grain',
  spatial_precision: 'spatial precision',
  openness: 'openness / air',
  composure: 'composure',
  rhythm: 'rhythmic drive',
};

/**
 * Stacking consequences — used ONLY in candidate interaction context,
 * not in chain character descriptions. These describe what happens if
 * you ADD MORE, not what the chain sounds like now.
 */
const STACKING_CONSEQUENCES: Record<string, string> = {
  warmth: 'Adding more warmth risks thickness — clarity and transient definition may soften further.',
  tonal_density: 'Adding more density here risks heaviness — transients may slow further.',
  clarity: 'Pushing clarity further risks tipping into analytical or fatiguing territory.',
  speed: 'More speed-forward emphasis risks stripping body and tonal weight.',
  texture: 'Further texture emphasis may mask micro-detail and air.',
  composure: 'More composure risks flattening dynamics — may feel restrained.',
};

// ── Cross-trait interaction rules ────────────────────
//
// Some trait combinations produce emergent effects that single-trait
// stacking doesn't capture. These fire when BOTH traits in a pair
// exceed the stacking threshold across 2+ components.

interface CrossTraitRule {
  traits: [string, string];
  label: string;
  /** Consequence when both traits stack together. */
  consequence: string;
  /** Character description (for chain-level, not candidate). */
  characterNote: string;
}

const CROSS_TRAIT_RULES: CrossTraitRule[] = [
  {
    traits: ['warmth', 'tonal_density'],
    label: 'tonal density stacking',
    consequence:
      'When warmth and tonal density stack together, clarity and transient articulation suffer disproportionately. ' +
      'The presentation may feel congested or slow — individual instruments lose separation, and transient edges soften beyond what either trait alone would produce.',
    characterNote:
      'The chain stacks both warmth and tonal density — rich and immersive, but clarity and articulation may be constrained.',
  },
];

/**
 * Deficiency consequences — used when flagging gaps.
 * Describes what the chain currently lacks, not what a candidate does.
 */
const DEFICIENCY_CONSEQUENCES: Record<string, string> = {
  warmth: 'The chain is light on tonal warmth — may lean clinical.',
  tonal_density: 'The chain is light on body — presentation may feel lightweight.',
  flow: 'The chain is light on musical flow — may feel mechanical.',
  dynamics: 'The chain is light on dynamic contrast — may feel flat.',
  elasticity: 'The chain is light on rhythmic give — may feel rigid.',
};

// ── Component Name Resolution ────────────────────────
//
// System chains contain user-entered strings like:
//   "JOB Integrated (amp section)"
//   "Chord Hugo (v1)"
//   "Boenicke W5"
//   "Schiit Bifrost 2"
//
// We need robust matching against catalog entries. Strategy:
//   1. Normalize input (strip parentheticals, lowercase, trim)
//   2. Try aliases for known brand variations
//   3. Score by brand + name overlap

/** Brand aliases — maps common user strings to catalog brand names. */
const BRAND_ALIASES: Record<string, string[]> = {
  'job': ['job', 'goldmund / job', 'goldmund'],
  'goldmund': ['job', 'goldmund / job', 'goldmund'],
  'lta': ['linear tube audio'],
  'linear tube audio': ['linear tube audio', 'lta'],
  'devore': ['devore', 'devore fidelity'],
  'devore fidelity': ['devore', 'devore fidelity'],
  'hifiman': ['hifiman'],
  'sonnet': ['sonnet digital audio'],
  'wiim': ['wiim'],
  'holo': ['holo audio'],
  'holo audio': ['holo audio'],
  'cube': ['cube audio'],
  'qualio': ['qualio audio'],
  'crayon': ['crayon audio'],
};

/** Name aliases — maps common shorthand to catalog product names. */
const NAME_ALIASES: Record<string, string[]> = {
  'integrated': ['integrated', 'INTegrated'],
  'hugo': ['hugo'],
  'hugo 1': ['hugo'],
  'hugo v1': ['hugo'],
  'hugo tt': ['hugo tt2'],
  'bifrost': ['bifrost 2/64'],
  'bifrost 2': ['bifrost 2/64'],
  'pontus': ['pontus ii 12th-1'],
  'pontus ii': ['pontus ii 12th-1'],
  'ares': ['ares 12th-1'],
  'ares ii': ['ares 12th-1'],
  'o/96': ['orangutan o/96'],
  'orangutan': ['orangutan o/96', 'orangutan o/93'],
  'o/93': ['orangutan o/93'],
  'heresy': ['heresy iv'],
  'kanta': ['kanta no. 2'],
  'aria': ['aria 906'],
  'nenuphar': ['nenuphar mini (nendo)'],
  'nendo': ['nenuphar mini (nendo)'],
  'spring': ['spring 3'],
  'spring 3': ['spring 3'],
  'cyan': ['cyan 2'],
  'dirty weekend': ['dirty weekend'],
  'dw': ['dirty weekend'],
  'super hl5': ['super hl5 plus'],
  'hl5': ['super hl5 plus'],
  'harmony': ['harmony dac'],
  'frérot': ['frérot'],
  'frerot': ['frérot'],
  'orchid': ['orchid'],
  'calliope': ['calliope .21'],
  'morpheus': ['morpheus'],
  'srda': ['srda dac'],
  'goldmund srda': ['srda dac'],
  'goldmund dac': ['srda dac'],
  'great horns': ['horns'],
  'hornshoppe horns': ['horns'],
  'hornshoppe horn': ['horns'],
  'horn': ['horns'],
  'cs600x': ['cs600x'],
  'cs600': ['cs600x', 'cs300'],
  'cs300': ['cs300'],
  'cs300x': ['cs300'],
  'ta-10': ['ta-10'],
  'ta10': ['ta-10'],
  'trends ta-10': ['ta-10'],
  'rost': ['rost'],
  'hegel rost': ['rost'],
  'vega': ['vega'],
  'auralic vega': ['vega'],
  '2220b': ['2220b'],
  'marantz 2220b': ['2220b'],
  'opdv971h': ['opdv971h'],
  'oppo opdv971h': ['opdv971h'],
  'trends ta10': ['ta-10'],
};

/**
 * Normalize a user-entered component string for matching.
 * Strips parenthetical notes, extra whitespace, and lowercases.
 */
function normalizeComponentName(input: string): string {
  return input
    .replace(/\(.*?\)/g, '')    // strip parentheticals: "(amp section)", "(v1)"
    .replace(/\s+/g, ' ')       // collapse whitespace
    .trim()
    .toLowerCase();
}

/**
 * Find a catalog product by name (robust fuzzy matching).
 */
function findProductByName(componentName: string): Product | null {
  const normalized = normalizeComponentName(componentName);
  if (!normalized) return null;

  let bestMatch: Product | null = null;
  let bestScore = 0;

  // Split into likely brand and name parts
  const words = normalized.split(' ');

  for (const p of ALL_CATALOG) {
    const brandLower = p.brand.toLowerCase();
    const nameLower = p.name.toLowerCase();
    const fullLower = `${brandLower} ${nameLower}`;

    let score = 0;

    // Exact full match
    if (normalized === fullLower) {
      score = 100;
    }
    // Input contains both brand and name
    else if (normalized.includes(nameLower) && normalized.includes(brandLower)) {
      score = 90;
    }
    // Brand alias match + name match
    else {
      const brandAliases = BRAND_ALIASES[words[0]] ?? [words[0]];
      const brandMatches = brandAliases.some((alias) =>
        brandLower === alias || brandLower.includes(alias),
      );

      if (brandMatches) {
        // Try remaining words against product name + name aliases
        const remainder = words.slice(1).join(' ');
        if (remainder && nameLower.includes(remainder)) {
          score = 85;
        } else if (remainder) {
          // Try name aliases
          const nameAliasEntries = NAME_ALIASES[remainder] ?? [];
          if (nameAliasEntries.some((a) => a.toLowerCase() === nameLower)) {
            score = 80;
          }
        }
        // Brand-only match (e.g. just "Chord" in a multi-component string)
        if (score === 0 && normalized.includes(brandLower)) {
          score = 30; // low — brand only, no name
        }
      }
    }

    // Direct name match without brand context
    if (score === 0 && normalized.includes(nameLower) && nameLower.length >= 3) {
      score = 70;
    }

    // Name alias match
    if (score === 0) {
      for (const [alias, targets] of Object.entries(NAME_ALIASES)) {
        if (normalized.includes(alias) && targets.some((t) => t.toLowerCase() === nameLower)) {
          score = 65;
          break;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = p;
    }
  }

  return bestScore >= 50 ? bestMatch : null;
}

// ── Core analysis ───────────────────────────────────

function getProductTraits(product: Product): Record<string, number> {
  const result: Record<string, number> = {};
  for (const trait of Object.keys(TRAIT_LABELS)) {
    result[trait] = resolveTraitValue(product.tendencyProfile, product.traits, trait);
  }
  return result;
}

/**
 * Analyze system interaction for a component chain.
 *
 * @param systemComponents - Names of components in the user's system
 * @param candidate - Optional product being considered for addition/replacement
 * @param tasteProfile - Optional user taste profile for context
 */
export function analyzeSystemInteraction(
  systemComponents: string[],
  candidate?: Product | null,
  tasteProfile?: TasteProfile | null,
): SystemInteraction | null {
  // Resolve components to catalog products
  const resolved: Array<{ name: string; product: Product; traits: Record<string, number> }> = [];
  for (const comp of systemComponents) {
    const product = findProductByName(comp);
    if (product) {
      resolved.push({
        name: comp,
        product,
        traits: getProductTraits(product),
      });
    }
  }

  // Need at least 2 known components for meaningful interaction analysis
  if (resolved.length < 2) return null;

  // ── Detect trait emphasis (stacking) ──────────────
  const stackingRisks: StackingRisk[] = [];

  for (const trait of Object.keys(TRAIT_LABELS)) {
    const pushers = resolved.filter((r) => r.traits[trait] >= STACKING_THRESHOLD);

    if (pushers.length >= STACKING_MIN_COMPONENTS) {
      const avg = pushers.reduce((sum, r) => sum + r.traits[trait], 0) / pushers.length;
      const consequence = STACKING_CONSEQUENCES[trait];
      if (!consequence) continue;

      stackingRisks.push({
        trait,
        label: TRAIT_LABELS[trait],
        componentCount: pushers.length,
        contributors: pushers.map((r) => `${r.product.brand} ${r.product.name}`),
        averageValue: Math.round(avg * 100) / 100,
        severity: pushers.length >= 3 || avg >= 0.85 ? 'significant' : 'moderate',
        consequence,
      });
    }
  }

  // ── Detect deficiency risks ────────────────────────
  const deficiencyRisks: DeficiencyRisk[] = [];

  for (const trait of Object.keys(DEFICIENCY_CONSEQUENCES)) {
    const values = resolved.map((r) => r.traits[trait]);
    const chainAvg = values.reduce((a, b) => a + b, 0) / values.length;

    if (chainAvg < DEFICIENCY_THRESHOLD) {
      deficiencyRisks.push({
        trait,
        label: TRAIT_LABELS[trait],
        chainAverage: Math.round(chainAvg * 100) / 100,
        consequence: DEFICIENCY_CONSEQUENCES[trait],
      });
    }
  }

  // ── Cross-trait interactions ─────────────────────────
  const crossTraitRisks = detectCrossTraitInteractions(resolved);

  // ── Chain character ────────────────────────────────
  const chainCharacter = inferChainCharacter(resolved);

  // ── Candidate interaction ──────────────────────────
  let candidateInteraction: CandidateInteraction | undefined;
  if (candidate) {
    candidateInteraction = analyzeCandidateInteraction(
      resolved, candidate, stackingRisks, deficiencyRisks, crossTraitRisks,
    );
  }

  // ── Summary — character only, max 1 sentence ──────
  const summary = buildSummary(chainCharacter, stackingRisks, deficiencyRisks, crossTraitRisks);

  return {
    chainCharacter,
    stackingRisks,
    crossTraitRisks,
    deficiencyRisks,
    candidateInteraction,
    summary,
  };
}

// ── Cross-trait interaction detection ─────────────────

function detectCrossTraitInteractions(
  components: Array<{ name: string; product: Product; traits: Record<string, number> }>,
): CrossTraitRisk[] {
  const results: CrossTraitRisk[] = [];

  for (const rule of CROSS_TRAIT_RULES) {
    const [traitA, traitB] = rule.traits;
    // Components that push BOTH traits above stacking threshold
    const bothPushers = components.filter(
      (c) => c.traits[traitA] >= STACKING_THRESHOLD && c.traits[traitB] >= STACKING_THRESHOLD,
    );
    // Also count components that push either trait strongly (individual contribution)
    const aPushers = components.filter((c) => c.traits[traitA] >= STACKING_THRESHOLD);
    const bPushers = components.filter((c) => c.traits[traitB] >= STACKING_THRESHOLD);

    // Fire when: at least 1 component pushes both, AND the chain has 2+ pushers
    // for each individual trait — indicating genuine cross-trait reinforcement
    if (
      bothPushers.length >= 1 &&
      aPushers.length >= STACKING_MIN_COMPONENTS &&
      bPushers.length >= STACKING_MIN_COMPONENTS
    ) {
      // Collect all contributors (union of both trait pushers)
      const contributorNames = new Set<string>();
      for (const c of aPushers) contributorNames.add(`${c.product.brand} ${c.product.name}`);
      for (const c of bPushers) contributorNames.add(`${c.product.brand} ${c.product.name}`);

      results.push({
        traits: rule.traits,
        label: rule.label,
        contributors: [...contributorNames],
        consequence: rule.consequence,
        characterNote: rule.characterNote,
      });
    }
  }

  return results;
}

// ── Chain character inference ────────────────────────

function inferChainCharacter(
  components: Array<{ traits: Record<string, number> }>,
): string {
  const avgTraits: Record<string, number> = {};
  for (const trait of Object.keys(TRAIT_LABELS)) {
    const values = components.map((c) => c.traits[trait]);
    avgTraits[trait] = values.reduce((a, b) => a + b, 0) / values.length;
  }

  const warmScore = (avgTraits.warmth ?? 0.5) + (avgTraits.tonal_density ?? 0.5);
  const speedScore = (avgTraits.speed ?? 0.5) + (avgTraits.clarity ?? 0.5);
  const flowScore = (avgTraits.flow ?? 0.5) + (avgTraits.elasticity ?? 0.5);

  // Descriptive labels — character, not risk
  if (warmScore >= CHARACTER_STRONG && speedScore < CHARACTER_LEAN_TOWARD)
    return 'warm and tonally dense';
  if (speedScore >= CHARACTER_STRONG && warmScore < CHARACTER_LEAN_TOWARD)
    return 'fast and clarity-forward';
  if (warmScore >= CHARACTER_LEAN_TOWARD && speedScore < CHARACTER_LEAN_TOWARD)
    return 'leaning warm';
  if (speedScore >= CHARACTER_LEAN_TOWARD && warmScore < CHARACTER_LEAN_TOWARD)
    return 'leaning fast / analytical';
  if (flowScore >= CHARACTER_LEAN_TOWARD)
    return 'flow-oriented';
  if (warmScore >= CHARACTER_LEAN_TOWARD && speedScore >= CHARACTER_LEAN_TOWARD)
    return 'balanced — both warm and detailed';
  return 'neutral — no dominant tendency';
}

// ── Candidate interaction analysis ──────────────────

function analyzeCandidateInteraction(
  chain: Array<{ name: string; product: Product; traits: Record<string, number> }>,
  candidate: Product,
  existingStacking: StackingRisk[],
  existingDeficiencies: DeficiencyRisk[],
  existingCrossTrait: CrossTraitRisk[] = [],
): CandidateInteraction {
  const candidateTraits = getProductTraits(candidate);
  const compounds: CandidateInteraction['compounds'] = [];
  const compensates: CandidateInteraction['compensates'] = [];

  // Candidate compounds existing emphasis
  for (const risk of existingStacking) {
    if (candidateTraits[risk.trait] >= STACKING_THRESHOLD) {
      compounds.push({
        trait: risk.trait,
        label: risk.label,
        note: risk.consequence,
      });
    }
  }

  // Candidate compensates for deficiencies
  for (const deficiency of existingDeficiencies) {
    if (candidateTraits[deficiency.trait] >= COMPENSATION_THRESHOLD) {
      compensates.push({
        trait: deficiency.trait,
        label: deficiency.label,
        note: `Brings ${deficiency.label} that the rest of the chain currently lacks.`,
      });
    }
  }

  // New stacking the candidate would create
  const stackedTraits = existingStacking.map((r) => r.trait);
  for (const trait of Object.keys(TRAIT_LABELS)) {
    if (stackedTraits.includes(trait)) continue;
    if (candidateTraits[trait] < STACKING_THRESHOLD) continue;

    const chainPushers = chain.filter((c) => c.traits[trait] >= STACKING_THRESHOLD);
    if (chainPushers.length >= 1) {
      const consequence = STACKING_CONSEQUENCES[trait];
      if (consequence) {
        compounds.push({
          trait,
          label: TRAIT_LABELS[trait],
          note: consequence,
        });
      }
    }
  }

  // Candidate compounds existing cross-trait interactions
  for (const crossRisk of existingCrossTrait) {
    const [traitA, traitB] = crossRisk.traits;
    if (
      candidateTraits[traitA] >= STACKING_THRESHOLD ||
      candidateTraits[traitB] >= STACKING_THRESHOLD
    ) {
      // Only add if we haven't already flagged these individual traits
      const alreadyFlagged = compounds.some(
        (c) => c.trait === traitA || c.trait === traitB,
      );
      if (!alreadyFlagged) {
        compounds.push({
          trait: `${traitA}+${traitB}`,
          label: crossRisk.label,
          note: crossRisk.consequence,
        });
      }
    }
  }

  let verdict: CandidateInteraction['verdict'] = 'neutral';
  if (compounds.length > compensates.length + 1) verdict = 'reinforces';
  else if (compensates.length > compounds.length) verdict = 'balances';

  return { compounds, compensates, verdict };
}

// ── Summary builder ─────────────────────────────────
//
// Produces a single sentence describing chain character.
// Keeps it compact — the decision frame directions carry the detail.
// Max: 1 character sentence + 1 optional tendency note.

function buildSummary(
  chainCharacter: string,
  stackingRisks: StackingRisk[],
  deficiencyRisks: DeficiencyRisk[],
  crossTraitRisks: CrossTraitRisk[] = [],
): string {
  // Character sentence — always present
  let summary = `Your system reads as ${chainCharacter}.`;

  // At most ONE additional note — pick the most significant
  // Cross-trait interactions take priority over single-trait stacking
  if (crossTraitRisks.length > 0) {
    summary += ` ${crossTraitRisks[0].characterNote}`;
  } else if (stackingRisks.length > 0) {
    const top = stackingRisks.sort((a, b) =>
      a.severity === 'significant' && b.severity !== 'significant' ? -1 : 0,
    )[0];
    summary += ` The chain already leans into ${top.label}.`;
  } else if (deficiencyRisks.length > 0) {
    summary += ` Light on ${deficiencyRisks[0].label}.`;
  }

  return summary;
}
