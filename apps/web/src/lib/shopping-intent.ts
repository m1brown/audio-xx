/**
 * Shopping-intent detection, mode classification, and question sequencing.
 *
 * Recognises three shopping modes:
 *   1. specific-component — user wants a particular category (DAC, amp, etc.)
 *   2. upgrade-path       — user wants to improve an existing system
 *   3. build-a-system     — user is starting from scratch
 *
 * Each mode has a priority-ordered question sequence. Questions are asked
 * one at a time. The sequence stops once enough context exists for a
 * non-generic recommendation.
 *
 * This is NOT a product database. It produces better input for the
 * existing rule engine by ensuring taste + system context are present.
 */
import type { ExtractedSignals, SignalDirection } from './signal-types';
import type { SystemProfile, OutputType, SystemCharacter } from './system-profile';
import { DEFAULT_SYSTEM_PROFILE } from './system-profile';
export type { SystemProfile, OutputType, SystemCharacter } from './system-profile';
import type { SonicArchetype } from './archetype';
import type { PrimaryAxisLeanings } from './axis-types';
import { hasTendencies, selectDefaultTendencies, hasRisk, getEmphasizedTraits, getLessEmphasizedTraits, hasExplainableProfile, resolveTraitValue } from './sonic-tendencies';
import { resolveArchetype, archetypeFitNote } from './design-archetypes';

/** Short labels for archetype context in shopping summaries. */
const ARCHETYPE_LABELS: Record<SonicArchetype, string> = {
  flow_organic: 'flow-oriented',
  precision_explicit: 'precision-oriented',
  rhythmic_propulsive: 'rhythm-oriented',
  tonal_saturated: 'tonally saturated',
  spatial_holographic: 'spatially focused',
};

// ── Types ─────────────────────────────────────────────

export type ShoppingCategory =
  | 'dac'
  | 'amplifier'
  | 'speaker'
  | 'headphone'
  | 'streamer'
  | 'turntable'
  | 'general';

export type ShoppingMode =
  | 'specific-component'
  | 'upgrade-path'
  | 'build-a-system';

/** A category-specific dependency that influences recommendations. */
export interface CategoryDependency {
  id: string;
  label: string;
  status: 'present' | 'absent' | 'unknown';
  /** Caveat shown in the recommendation when status !== 'present'. */
  caveat: string | null;
  /** Hint that feeds into the refinement question at the end. */
  refinementHint: string | null;
}

/** Optional subcategory for finer routing (e.g. cables within 'general'). */
export type ShoppingSubcategory = 'cables' | undefined;

// ── Taste confidence ──────────────────────────────────
// Measures how much we know about the user's listening preferences.
// Controls response language assertiveness and question injection.

export type TasteConfidence = 'low' | 'sufficient';

export function computeTasteConfidence({
  hasBudget,
  hasCategory,
  hasSemanticPreferences,
  hasReference,
  hasDislikes,
  hasDirectionSignal,
  hasSpecialistSignal,
}: {
  hasBudget: boolean;
  hasCategory: boolean;
  hasSemanticPreferences: boolean;
  hasReference: boolean;
  hasDislikes: boolean;
  hasDirectionSignal: boolean;
  /** User expressed specialist-path intent (SET, horn, high-efficiency, etc.) */
  hasSpecialistSignal?: boolean;
}): TasteConfidence {
  let score = 0;
  if (hasBudget) score += 1;
  if (hasCategory) score += 1;
  if (hasSemanticPreferences) score += 1;
  if (hasReference) score += 2;
  if (hasDislikes) score += 2;
  if (hasDirectionSignal) score += 2;
  if (hasSpecialistSignal) score += 2;

  if (score <= 2) return 'low';
  return 'sufficient';
}

/** Detect product references ("I like X", "I have X", "something like X"). */
const REFERENCE_PATTERNS = [
  /\bi (?:like|love|own|have|use|enjoy|prefer)\b.{0,30}\b[A-Z][a-z]+\b/,
  /\bsomething like\b/i,
  /\bsimilar to\b/i,
  /\bmy (?:current|existing)\b/i,
];

export function hasProductReference(text: string): boolean {
  return REFERENCE_PATTERNS.some((re) => re.test(text));
}

/** Detect dislike signals ("don't like", "too harsh", "hate bright sound"). */
const DISLIKE_PATTERNS = [
  /\b(?:don'?t|do not|never|hate|dislike|can'?t stand)\b.{0,30}\b(?:like|want|enjoy|listen)/i,
  /\btoo (?:harsh|bright|warm|cold|dry|thin|aggressive|fatiguing|shrill|dark|muddy|slow|boring|clinical|sterile)\b/i,
  /\bnot a fan of\b/i,
  /\bavoid\b.{0,20}\b(?:sound|tone|character)/i,
  // Comparative negation — "less dry", "less harsh" implies dissatisfaction with current state
  /\bless\s+(?:dry|harsh|bright|cold|thin|clinical|sterile|boring|fatiguing|aggressive)\b/i,
];

export function hasDislikeSignal(text: string): boolean {
  return DISLIKE_PATTERNS.some((re) => re.test(text));
}

/** Detect directional sonic preference signals ("warm", "detailed", "punchy"). */
const DIRECTION_SIGNAL_PATTERNS = [
  /\b(?:warm|smooth|lush|rich|tubey|organic|liquid|relaxed)\b/i,
  /\b(?:bright|detailed|analytical|precise|crisp|transparent|revealing|airy)\b/i,
  /\b(?:punchy|dynamic|impactful|slam|attack|fast|snappy)\b/i,
  /\b(?:controlled|tight|grip|disciplined|composed)\b/i,
  /\b(?:elastic|flowing|musical|natural|easy|effortless)\b/i,
  /\b(?:spatial|wide|open|holographic|imaging|soundstage)\b/i,
  // Emotional / involvement language — clear directional intent
  /\b(?:engaging|emotional|involving|immersive|captivating|intimate|soulful|evocative)\b/i,
  // Comparative negation — "less dry", "less harsh" etc. imply a direction
  /\bless\s+(?:dry|harsh|bright|cold|thin|clinical|sterile|boring|fatiguing|aggressive)\b/i,
  // "More X" phrasing — "more body", "more weight", "more presence"
  /\bmore\s+(?:body|weight|presence|texture|depth|slam|air|space|detail|warmth|punch|energy)\b/i,
];

export function hasDirectionSignal(text: string): boolean {
  return DIRECTION_SIGNAL_PATTERNS.some((re) => re.test(text));
}

/** Build a single targeted question when taste confidence is low. */
export function buildTasteQuestion({
  category,
  hasDirectionSignalPresent,
  hasReferencePresent,
}: {
  category: string;
  hasDirectionSignalPresent: boolean;
  hasReferencePresent: boolean;
}): string | null {
  // Don't ask if user already gave direction or reference signals
  if (hasDirectionSignalPresent || hasReferencePresent) return null;
  return 'Do you want this to lean more warm and punchy, or clean and controlled?';
}

/** Build a focused category question when taste is clear but category is missing.
 *  Only fires when: tasteConfidence is sufficient, category is general, and
 *  no products can be returned. */
export function buildCategoryQuestion({
  tasteConfidence,
  category,
  hasProducts,
}: {
  tasteConfidence: TasteConfidence;
  category: string;
  hasProducts: boolean;
}): string | null {
  // Only ask when we have taste signal but no category to act on
  if (tasteConfidence !== 'sufficient') return null;
  if (category !== 'general' && category !== 'component') return null;
  if (hasProducts) return null;
  return 'Are you thinking about speakers, headphones, or amplification?';
}

/** Detected room/environment context for ranking adjustments. */
export type RoomContext = 'large' | 'small' | 'desktop' | 'nearfield' | null;

/** Hard constraints extracted from user refinement text. These act as
 *  filters, not soft preferences — products that violate them are excluded. */
export interface HardConstraints {
  /** Topologies to exclude (e.g., user says "no tubes"). */
  excludeTopologies: string[];
  /** Topologies to require (e.g., user says "class AB only"). */
  requireTopologies: string[];
  /** Only show currently available / new products (exclude discontinued/vintage). */
  newOnly: boolean;
  /** Only show used-market / discontinued products. */
  usedOnly: boolean;
}

// ── Selection mode ────────────────────────────────────
// Detects whether the user is asking for a directional shift in
// the recommendation set, not just a refinement of the same center.

export type SelectionMode = 'default' | 'different' | 'less_traditional';

const DIFFERENT_PATTERNS = [
  /\bsomething\s+different\b/i,
  /\bdifferent\s+direction\b/i,
  /\bshow\s+me\s+(?:something\s+)?(?:else|different)\b/i,
  /\banother\s+option\b/i,
  /\bwhat\s+else\b/i,
  /\bother\s+options?\b/i,
];

const LESS_TRADITIONAL_PATTERNS = [
  /\bless\s+traditional\b/i,
  /\bnon[\s-]?traditional\b/i,
  /\bunusual\b/i,
  /\boffbeat\b/i,
  /\bboutique\b/i,
  /\bniche\b/i,
  /\bweird(?:er)?\b/i,
  /\besoteric\b/i,
];

export function detectSelectionMode(text: string): SelectionMode {
  for (const re of LESS_TRADITIONAL_PATTERNS) {
    if (re.test(text)) return 'less_traditional';
  }
  for (const re of DIFFERENT_PATTERNS) {
    if (re.test(text)) return 'different';
  }
  return 'default';
}

// ── Explicit category switch detection ────────────────
// Returns a category ONLY when the user's message clearly requests one.
// Questions *about* categories ("are these dacs or amps?") do NOT count.
// Preference statements, budget changes, dislikes, and selection modes do NOT count.
const EXPLICIT_CATEGORY_SWITCH_PATTERNS: { category: ShoppingCategory; patterns: RegExp[] }[] = [
  {
    category: 'dac',
    patterns: [
      /\b(?:show|find|recommend|suggest|looking for|help.*(?:with|find)|want|need|get)\b.{0,20}\b(?:dac|converter)s?\b/i,
      /\b(?:what about|how about|let'?s (?:try|look at|see)|now (?:for|let'?s|show))\b.{0,15}\b(?:dac|converter)s?\b/i,
      /\b(?:dac|converter)s?\b.{0,15}\b(?:instead|now|next)\b/i,
      /\b(?:switch|change|move)\b.{0,15}\b(?:to\s+)?(?:dac|converter)s?\b/i,
      /\bi want (?:a\s+)?dacs?\b/i,
    ],
  },
  {
    category: 'amplifier',
    patterns: [
      /\b(?:show|find|recommend|suggest|looking for|help.*(?:with|find)|want|need|get)\b.{0,20}\b(?:amp|amplifier|integrated|power amp|preamp)s?\b/i,
      /\b(?:what about|how about|let'?s (?:try|look at|see)|now (?:for|let'?s|show))\b.{0,15}\b(?:amp|amplifier|integrated)s?\b/i,
      /\b(?:amp|amplifier|integrated)s?\b.{0,15}\b(?:instead|now|next)\b/i,
      /\b(?:switch|change|move)\b.{0,15}\b(?:to\s+)?(?:amp|amplifier|integrated)s?\b/i,
      /\bi want (?:an?\s+)?(?:amp|amplifier|integrated)s?\b/i,
    ],
  },
  {
    category: 'speaker',
    patterns: [
      /\b(?:show|find|recommend|suggest|looking for|help.*(?:with|find)|want|need|get)\b.{0,20}\b(?:speaker|speakers|monitors|bookshelf|floorstanding)s?\b/i,
      /\b(?:what about|how about|let'?s (?:try|look at|see)|now (?:for|let'?s|show))\b.{0,15}\b(?:speaker|speakers|monitors)s?\b/i,
      /\b(?:speaker|speakers|monitors)\b.{0,15}\b(?:instead|now|next)\b/i,
      /\b(?:switch|change|move)\b.{0,15}\b(?:to\s+)?(?:speaker|speakers|monitors)\b/i,
      /\bi want\b.{0,10}\b(?:speaker|speakers)\b/i,
    ],
  },
  {
    category: 'headphone',
    patterns: [
      /\b(?:show|find|recommend|suggest|looking for|help.*(?:with|find)|want|need|get)\b.{0,20}\b(?:headphone|headphones|iem|iems|earphone)s?\b/i,
      /\b(?:what about|how about|let'?s (?:try|look at|see)|now (?:for|let'?s|show))\b.{0,15}\b(?:headphone|headphones|iem|iems)s?\b/i,
      /\b(?:headphone|headphones|iem|iems)\b.{0,15}\b(?:instead|now|next)\b/i,
      /\bi want\b.{0,10}\b(?:headphone|headphones|iem|iems)\b/i,
    ],
  },
  {
    category: 'turntable',
    patterns: [
      /\b(?:show|find|recommend|suggest|looking for|help.*(?:with|find)|want|need|get)\b.{0,20}\b(?:turntable|record player|vinyl)s?\b/i,
      /\b(?:what about|how about|let'?s (?:try|look at|see)|now (?:for|let'?s|show))\b.{0,15}\b(?:turntable|record player|vinyl)s?\b/i,
      /\b(?:turntable|record player)\b.{0,15}\b(?:instead|now|next)\b/i,
    ],
  },
  {
    category: 'streamer',
    patterns: [
      /\b(?:show|find|recommend|suggest|looking for|help.*(?:with|find)|want|need|get)\b.{0,20}\b(?:streamer|transport|network player)s?\b/i,
      /\b(?:what about|how about|let'?s (?:try|look at|see)|now (?:for|let'?s|show))\b.{0,15}\b(?:streamer|transport|network player)s?\b/i,
      /\b(?:streamer|transport)\b.{0,15}\b(?:instead|now|next)\b/i,
    ],
  },
];

/**
 * Detects an EXPLICIT category switch from user text.
 * Returns the new category if the user clearly asks for one, null otherwise.
 *
 * Questions ABOUT categories ("are these dacs?", "is this an amp or dac?")
 * do NOT trigger a switch. Only directive intent does:
 * "show me dacs", "what about speakers", "amplifiers instead", "i want an amp"
 */
export function detectExplicitCategorySwitch(text: string): ShoppingCategory | null {
  const lower = text.toLowerCase();

  // Reject question-about-category patterns — these should NOT trigger a switch.
  // "are these dacs or amplifiers?", "is this a dac?", "which category"
  if (/\b(?:are\s+these|is\s+(?:this|it)|which\s+(?:category|type))\b.{0,30}\b(?:dac|amp|speaker|headphone|turntable|streamer)/i.test(lower)) {
    return null;
  }

  for (const entry of EXPLICIT_CATEGORY_SWITCH_PATTERNS) {
    for (const re of entry.patterns) {
      if (re.test(lower)) {
        return entry.category;
      }
    }
  }

  // Budget + category shorthand is always an explicit category request even without
  // a directive verb. Handles: "warm amp under $3000", "I need a better amp",
  // "speakers under $1500". Only fires when exactly one category is present
  // to avoid ambiguity in multi-category queries.
  const hasBudgetOrUpgrade = /(?:under\s+)?\$\s?\d|\bunder\s+\d|\bbudget\b|\bneed\s+(?:a\s+)?(?:better|new|different)\b|\bwant\s+(?:a\s+)?(?:better|new|different)\b/i.test(lower);
  if (hasBudgetOrUpgrade) {
    const categoryMatches: ShoppingCategory[] = [
      /\b(?:amp|amplifier|integrated|power\s*amp|preamp)s?\b/i.test(lower) ? 'amplifier' : null,
      /\b(?:dac|d\/a|converter)s?\b/i.test(lower) ? 'dac' : null,
      /\b(?:speaker|speakers|bookshelf|floorstanding)s?\b/i.test(lower) ? 'speaker' : null,
      /\b(?:headphone|headphones|iem|iems|earphone|cans)s?\b/i.test(lower) ? 'headphone' : null,
      /\b(?:streamer|transport|network\s+player)s?\b/i.test(lower) ? 'streamer' : null,
      /\b(?:turntable|record\s+player|vinyl)s?\b/i.test(lower) ? 'turntable' : null,
    ].filter((c): c is ShoppingCategory => c !== null);
    if (categoryMatches.length === 1) return categoryMatches[0];
  }

  return null;
}

// ── Previous anchor info (for mode-aware anchor selection) ──

export interface PreviousAnchor {
  name: string;
  brand: string;
  philosophy?: 'energy' | 'neutral' | 'warm' | 'analytical';
  marketType?: 'traditional' | 'nonTraditional' | 'value';
  primaryAxes?: PrimaryAxisLeanings;
}

export interface ShoppingContext {
  detected: boolean;
  mode: ShoppingMode;
  category: ShoppingCategory;
  /** Finer classification within category. */
  subcategory?: ShoppingSubcategory;
  /** When the user asks for multiple categories ("amp and dac"), the
   *  primary category is handled first and this stores the second. */
  secondaryCategory?: ShoppingCategory;
  budgetMentioned: boolean;
  budgetAmount: number | null;
  tasteProvided: boolean;
  systemProvided: boolean;
  systemProfile: SystemProfile;
  useCaseProvided: boolean;
  preserveProvided: boolean;
  limitingProvided: boolean;
  /** Category-specific dependencies (e.g., phono stage for turntables). */
  dependencies: CategoryDependency[];
  /** Detected room size / environment context. Affects speaker ranking. */
  roomContext: RoomContext;
  /** Hard constraints (topology exclusion, new-only, etc.). */
  constraints: HardConstraints;
  /** Semantic preferences derived from natural language ("big and powerful", etc.). */
  semanticPreferences: SemanticPreferences;
}

// ── Intent keywords ───────────────────────────────────

const INTENT_KEYWORDS = [
  'best',
  'upgrade',
  'buy',
  'budget',
  'looking for',
  'recommend',
  'recommendation',
  'suggest',
  'should i get',
  'should i buy',
  'what should i get',
  'what should i buy',
  'what makes the most sense',
  'considering',
  'shopping',
  'purchase',
  'replace',
  'switch to',
  'worth it',
  'under $',
  'i have $',
  'to spend',
  'for my system',
  'for me',
  'based on my tastes',
  'how does',
  'compare to',
  'vs',
  'versus',
];

// ── Cable modifier detection ─────────────────────────
// Must run before category keyword matching to prevent
// "speaker cable" from matching the 'speaker' category.

const CABLE_MODIFIER_PATTERNS = [
  /\bspeaker\s+cables?\b/i,
  /\brca\s+cables?\b/i,
  /\binterconnects?\b/i,
  /\bpower\s+(?:cord|cable)s?\b/i,
  /\busb\s+cables?\b/i,
  /\bdigital\s+cables?\b/i,
  /\bxlr\s+cables?\b/i,
  /\banalog\s+cables?\b/i,
  /\bcables?\s+(?:for|under|around|between)\b/i,
  /\b(?:best|good|recommend)\b.*\bcables?\b/i,
  /\bcabling\b/i,
];

// ── Category extraction ───────────────────────────────

interface CategoryPattern {
  category: ShoppingCategory;
  keywords: string[];
  /** Pre-compiled word-boundary patterns for accurate matching. */
  _patterns: RegExp[];
}

function buildCategoryPatterns(
  entries: Array<{ category: ShoppingCategory; keywords: string[] }>,
): CategoryPattern[] {
  return entries.map((e) => ({
    ...e,
    _patterns: e.keywords.map((kw) => new RegExp(`\\b${kw.replace(/[-/]/g, '[-\\s]?')}s?\\b`, 'i')),
  }));
}

const CATEGORY_PATTERNS: CategoryPattern[] = buildCategoryPatterns([
  {
    category: 'dac',
    keywords: ['dac', 'converter', 'digital to analog', 'digital-to-analog'],
  },
  {
    category: 'amplifier',
    keywords: ['amp', 'amplifier', 'integrated', 'power amp', 'preamp', 'pre-amp'],
  },
  {
    category: 'speaker',
    keywords: ['speaker', 'speakers', 'monitors', 'bookshelf', 'floorstanding', 'floor-standing'],
  },
  {
    category: 'headphone',
    keywords: ['headphone', 'headphones', 'iem', 'iems', 'earphone', 'earphones', 'cans'],
  },
  {
    category: 'streamer',
    keywords: ['streamer', 'transport', 'network player', 'renderer'],
  },
  {
    category: 'turntable',
    keywords: ['turntable', 'record player', 'vinyl player', 'vinyl setup', 'vinyl playback', 'tt setup'],
  },
]);

// ── Build-a-system detection ──────────────────────────

const BUILD_KEYWORDS = [
  'build a system',
  'build a setup',
  'building a system',
  'building a setup',
  'from scratch',
  'first system',
  'first setup',
  'complete system',
  'complete setup',
  'starting out',
  'starting fresh',
  'new system',
  'new setup',
  'whole system',
  'entire system',
];

// ── Budget detection ──────────────────────────────────

const BUDGET_PATTERNS = [
  /\$\s?\d/,
  /\d+\s*dollars/i,
  /budget\s*(of|around|is|:)?\s*\d/i,
  /under\s+\d/i,
  /around\s+\d/i,
  /spend\s+\d/i,
  /\bsame\s+budget\b/i,
  /\bsame\s+price\s+range\b/i,
  /\bkeep(?:ing)?\s+(?:the\s+)?budget\b/i,
];

// ── System / gear detection ───────────────────────────

const SYSTEM_KEYWORDS = [
  'my system',
  'my setup',
  'my rig',
  'current system',
  'current setup',
  'feeding into',
  'feeds into',
  'paired with',
  'connected to',
  'driving',
  'my dac',
  'my amp',
  'my speakers',
  'my headphones',
  'my streamer',
];

// ── Use-case detection ────────────────────────────────

const USE_CASE_KEYWORDS = [
  'low volume',
  'near-field',
  'nearfield',
  'near field',
  'desktop',
  'living room',
  'bedroom',
  'vinyl',
  'streaming',
  'small room',
  'large room',
  'apartment',
  'late night',
  'background listening',
  'headphones',
  'speakers',
];

// ── Hard constraint extraction ──────────────────────────
// Detects explicit user constraints that must act as hard filters,
// not soft preferences. "no tubes", "class AB", "new only" etc.

// Topology name → canonical DesignTopology values
const TOPOLOGY_ALIASES: Record<string, string[]> = {
  // Tube topologies
  'tube': ['set', 'push-pull-tube'],
  'tubes': ['set', 'push-pull-tube'],
  'valve': ['set', 'push-pull-tube'],
  'set': ['set'],
  'single ended triode': ['set'],
  'push pull': ['push-pull-tube'],
  'otl': ['push-pull-tube'],
  // Solid-state topologies
  'class a': ['class-a-solid-state'],
  'class ab': ['class-ab-solid-state'],
  'class a/b': ['class-ab-solid-state'],
  'class-ab': ['class-ab-solid-state'],
  'class d': ['class-d'],
  'class-d': ['class-d'],
  'solid state': ['class-a-solid-state', 'class-ab-solid-state', 'class-d'],
  'solid-state': ['class-a-solid-state', 'class-ab-solid-state', 'class-d'],
  // Hybrid
  'hybrid': ['hybrid'],
};

/** Extract hard constraints from accumulated user text. */
function extractHardConstraints(text: string): HardConstraints {
  const lower = text.toLowerCase();
  const excludeTopologies: string[] = [];
  const requireTopologies: string[] = [];

  // ── Exclusion patterns: "no tubes", "don't want tubes", "not tube", "exclude class d"
  const exclusionRe = /\b(?:no|don'?t\s+want|not|without|exclude|avoid|skip)\s+(tube[s]?|valve[s]?|solid[\s-]?state|class[\s-]?a\b(?![\s/]*b)|class[\s-]?ab|class[\s-]?a\s*\/\s*b|class[\s-]?d|hybrid|set|push[\s-]?pull|single[\s-]?ended)/gi;
  let match: RegExpExecArray | null;
  while ((match = exclusionRe.exec(lower)) !== null) {
    const term = match[1].replace(/[-\s]+/g, ' ').trim();
    const topos = TOPOLOGY_ALIASES[term];
    if (topos) {
      for (const t of topos) {
        if (!excludeTopologies.includes(t)) excludeTopologies.push(t);
      }
    }
  }

  // ── Requirement patterns: "class ab amps", "in class ab", "only class ab"
  const requireRe = /\b(?:in|only|just|strictly|specifically)\s+(?:class[\s-]?(?:a\b(?![\s/]*b)|ab|a\s*\/\s*b|d)|tube[s]?|solid[\s-]?state|hybrid)/gi;
  while ((match = requireRe.exec(lower)) !== null) {
    const term = match[0].replace(/^(?:in|only|just|strictly|specifically)\s+/i, '').replace(/[-\s]+/g, ' ').trim();
    const topos = TOPOLOGY_ALIASES[term];
    if (topos) {
      for (const t of topos) {
        if (!requireTopologies.includes(t)) requireTopologies.push(t);
      }
    }
  }

  // Also detect bare topology mentions as category-level requirements:
  // "class ab amps?" or "what about class ab?" in isolation
  const bareTopoRe = /\bclass[\s-]?(?:a\b(?![\s/]*b)|ab|a\s*\/\s*b|d)\b/gi;
  // Only treat as requirement if the sentence context implies filtering,
  // not just mentioning. Check for question mark, "amps", "amplifier", or "what about"
  if (/\bclass[\s-]?ab\s+(?:amp|amplifier)/i.test(lower)
    || /\bin\s+class[\s-]?ab/i.test(lower)
    || /\bclass[\s-]?ab\s+(?:amp|amplifier)?s?\s*\??$/im.test(lower)) {
    if (!requireTopologies.includes('class-ab-solid-state')) {
      requireTopologies.push('class-ab-solid-state');
    }
  }
  if (/\bclass[\s-]?a\b(?![\s/]*b)\s+(?:amp|amplifier)/i.test(lower)
    || /\bin\s+class[\s-]?a\b(?![\s/]*b)/i.test(lower)) {
    if (!requireTopologies.includes('class-a-solid-state')) {
      requireTopologies.push('class-a-solid-state');
    }
  }

  // ── SET / single-ended triode intent detection ──
  // Catch "SET amp", "single-ended triode", "triode amp", brand-driven SET (Decware, Yamamoto, Bottlehead)
  if (/\b(?:set\s+amp|single[\s-]?ended(?:\s+triode)?|triode\s+amp)/i.test(lower)
    || /\b(?:decware|yamamoto|bottlehead)\b/i.test(lower)) {
    if (!requireTopologies.includes('set')) {
      requireTopologies.push('set');
    }
  }

  // ── Availability constraints
  const newOnly = /\b(?:i\s+want\s+new|new\s+only|only\s+new|buy\s+new|brand\s+new|currently\s+(?:available|in\s+production)|still\s+(?:made|in\s+production)|not\s+(?:discontinued|used|vintage))\b/i.test(lower);
  const usedOnly = /\b(?:used\s+only|only\s+used|secondhand|second[\s-]hand|pre[\s-]?owned)\b/i.test(lower);

  return { excludeTopologies, requireTopologies, newOnly, usedOnly };
}

// ── Semantic preference extraction ──────────────────────
// Extracts soft semantic preferences from natural language
// (e.g., "big and powerful", "warm and smooth", "detailed and precise").
// These produce weighted scoring adjustments, not hard filters.

/** A semantic preference maps to one or more product traits with a weight. */
export interface SemanticWeight {
  trait: string;
  weight: number;
}

export interface SemanticPreferences {
  /** Weighted trait adjustments derived from user language. */
  weights: SemanticWeight[];
  /** Whether the user expressed a scale/power preference. */
  wantsBigScale: boolean;
  /** Whether the user expressed a compact/intimate preference. */
  wantsSmallScale: boolean;
  /** Energy level preference: 'high' | 'low' | null */
  energyLevel: 'high' | 'low' | null;
  /** Music genre hints that inform sonic priorities. */
  musicHints: string[];
  /** Specialist-path hints — detected signals for future routing (no behavior change yet). */
  specialistHints: string[];
}

/** Semantic patterns: natural-language phrase → trait weights.
 *  Each pattern can map to multiple traits with different weights.
 *  Weights are strong enough to visibly affect ranking (0.3–0.8 range). */
const SEMANTIC_PATTERNS: Array<{ pattern: RegExp; weights: SemanticWeight[] }> = [
  // ── Power / scale / dynamics ──
  { pattern: /\bbig\s+(?:and\s+)?powerful\b/i, weights: [{ trait: 'dynamics', weight: 0.8 }, { trait: 'speed', weight: 0.4 }, { trait: 'composure', weight: 0.3 }] },
  { pattern: /\bpowerful\b/i, weights: [{ trait: 'dynamics', weight: 0.6 }, { trait: 'speed', weight: 0.3 }] },
  { pattern: /\bbig\s+sound\b/i, weights: [{ trait: 'dynamics', weight: 0.6 }, { trait: 'tonal_density', weight: 0.3 }] },
  { pattern: /\bbig\s+scale\b/i, weights: [{ trait: 'dynamics', weight: 0.6 }] },
  { pattern: /\bauthoritative\b/i, weights: [{ trait: 'dynamics', weight: 0.5 }, { trait: 'composure', weight: 0.4 }] },
  { pattern: /\bimpactful\b/i, weights: [{ trait: 'dynamics', weight: 0.5 }] },
  { pattern: /\bpunchy\b/i, weights: [{ trait: 'dynamics', weight: 0.5 }, { trait: 'speed', weight: 0.4 }] },
  { pattern: /\bhigh[\s-]?power\b/i, weights: [{ trait: 'dynamics', weight: 0.6 }, { trait: 'composure', weight: 0.3 }] },
  { pattern: /\brock\s+out\b/i, weights: [{ trait: 'dynamics', weight: 0.5 }, { trait: 'speed', weight: 0.3 }] },
  // ── Warmth / density / richness ──
  { pattern: /\bwarm\s+(?:and\s+)?smooth\b/i, weights: [{ trait: 'warmth', weight: 0.6 }, { trait: 'flow', weight: 0.4 }, { trait: 'tonal_density', weight: 0.3 }] },
  { pattern: /\bwarm\b/i, weights: [{ trait: 'warmth', weight: 0.5 }, { trait: 'tonal_density', weight: 0.2 }] },
  { pattern: /\brich\b/i, weights: [{ trait: 'tonal_density', weight: 0.5 }, { trait: 'warmth', weight: 0.3 }] },
  { pattern: /\blush\b/i, weights: [{ trait: 'tonal_density', weight: 0.5 }, { trait: 'warmth', weight: 0.4 }] },
  { pattern: /\bsmooth\b/i, weights: [{ trait: 'flow', weight: 0.4 }, { trait: 'warmth', weight: 0.3 }] },
  { pattern: /\bfull[\s-]?bodied\b/i, weights: [{ trait: 'tonal_density', weight: 0.6 }, { trait: 'warmth', weight: 0.3 }] },
  { pattern: /\btubey\b/i, weights: [{ trait: 'warmth', weight: 0.5 }, { trait: 'tonal_density', weight: 0.4 }, { trait: 'flow', weight: 0.3 }] },
  // ── Clarity / precision / detail ──
  { pattern: /\bdetailed\s+(?:and\s+)?precise\b/i, weights: [{ trait: 'clarity', weight: 0.6 }, { trait: 'spatial_precision', weight: 0.4 }, { trait: 'speed', weight: 0.3 }] },
  { pattern: /\bdetailed\b/i, weights: [{ trait: 'clarity', weight: 0.5 }] },
  { pattern: /\bprecise\b/i, weights: [{ trait: 'clarity', weight: 0.4 }, { trait: 'spatial_precision', weight: 0.4 }] },
  { pattern: /\banalytical\b/i, weights: [{ trait: 'clarity', weight: 0.5 }, { trait: 'speed', weight: 0.3 }] },
  { pattern: /\btransparent\b/i, weights: [{ trait: 'clarity', weight: 0.5 }] },
  { pattern: /\brevealing\b/i, weights: [{ trait: 'clarity', weight: 0.5 }, { trait: 'spatial_precision', weight: 0.2 }] },
  // ── Speed / timing / rhythm ──
  { pattern: /\bfast\s+(?:and\s+)?tight\b/i, weights: [{ trait: 'speed', weight: 0.6 }, { trait: 'dynamics', weight: 0.3 }] },
  { pattern: /\bfast\b/i, weights: [{ trait: 'speed', weight: 0.5 }] },
  { pattern: /\btight\b/i, weights: [{ trait: 'speed', weight: 0.4 }, { trait: 'composure', weight: 0.3 }] },
  { pattern: /\brhythmic\b/i, weights: [{ trait: 'elasticity', weight: 0.5 }, { trait: 'speed', weight: 0.3 }] },
  { pattern: /\bPRaT\b/i, weights: [{ trait: 'speed', weight: 0.5 }, { trait: 'elasticity', weight: 0.4 }] },
  // ── Flow / musicality / organic ──
  { pattern: /\bmusical\b/i, weights: [{ trait: 'flow', weight: 0.5 }, { trait: 'elasticity', weight: 0.3 }] },
  { pattern: /\borganic\b/i, weights: [{ trait: 'flow', weight: 0.5 }, { trait: 'texture', weight: 0.3 }] },
  { pattern: /\bnatural\b/i, weights: [{ trait: 'flow', weight: 0.4 }, { trait: 'texture', weight: 0.3 }] },
  { pattern: /\bengaging\b/i, weights: [{ trait: 'flow', weight: 0.4 }, { trait: 'dynamics', weight: 0.3 }] },
  { pattern: /\bemotional\b/i, weights: [{ trait: 'flow', weight: 0.5 }, { trait: 'warmth', weight: 0.3 }, { trait: 'tonal_density', weight: 0.2 }] },
  { pattern: /\binvolving\b/i, weights: [{ trait: 'flow', weight: 0.5 }, { trait: 'elasticity', weight: 0.3 }] },
  { pattern: /\bimmersive\b/i, weights: [{ trait: 'spatial_precision', weight: 0.4 }, { trait: 'flow', weight: 0.3 }] },
  { pattern: /\bcaptivating\b/i, weights: [{ trait: 'flow', weight: 0.4 }, { trait: 'dynamics', weight: 0.3 }] },
  { pattern: /\bsoulful\b/i, weights: [{ trait: 'warmth', weight: 0.4 }, { trait: 'flow', weight: 0.4 }, { trait: 'tonal_density', weight: 0.3 }] },
  { pattern: /\bevocative\b/i, weights: [{ trait: 'flow', weight: 0.4 }, { trait: 'texture', weight: 0.3 }] },
  { pattern: /\bintimate\b/i, weights: [{ trait: 'texture', weight: 0.4 }, { trait: 'flow', weight: 0.3 }] },
  // ── Comparative negation → directional weights ──
  { pattern: /\bless\s+dry\b/i, weights: [{ trait: 'warmth', weight: 0.5 }, { trait: 'tonal_density', weight: 0.3 }] },
  { pattern: /\bless\s+(?:harsh|bright|aggressive|fatiguing)\b/i, weights: [{ trait: 'warmth', weight: 0.4 }, { trait: 'flow', weight: 0.3 }] },
  { pattern: /\bless\s+(?:cold|clinical|sterile)\b/i, weights: [{ trait: 'warmth', weight: 0.5 }, { trait: 'tonal_density', weight: 0.3 }] },
  { pattern: /\bless\s+(?:thin|boring)\b/i, weights: [{ trait: 'tonal_density', weight: 0.4 }, { trait: 'dynamics', weight: 0.3 }] },
  // ── Spatial / imaging ──
  { pattern: /\bsoundstage\b/i, weights: [{ trait: 'spatial_precision', weight: 0.5 }] },
  { pattern: /\bimaging\b/i, weights: [{ trait: 'spatial_precision', weight: 0.5 }] },
  { pattern: /\bholographic\b/i, weights: [{ trait: 'spatial_precision', weight: 0.6 }] },
  // ── Upgrade / improvement language (weak weights — directional hints, not strong filters) ──
  { pattern: /\bstep\s+up\b/i, weights: [{ trait: 'clarity', weight: 0.2 }, { trait: 'dynamics', weight: 0.2 }] },
  { pattern: /\bmore\s+refined\b/i, weights: [{ trait: 'clarity', weight: 0.3 }, { trait: 'composure', weight: 0.3 }] },
  { pattern: /\bmore\s+resolving\b/i, weights: [{ trait: 'clarity', weight: 0.4 }, { trait: 'spatial_precision', weight: 0.3 }] },
  // ── Composure / control ──
  { pattern: /\bcontrolled\b/i, weights: [{ trait: 'composure', weight: 0.5 }, { trait: 'speed', weight: 0.2 }] },
  { pattern: /\bcomposed\b/i, weights: [{ trait: 'composure', weight: 0.5 }] },
  { pattern: /\bgrip\b/i, weights: [{ trait: 'composure', weight: 0.4 }, { trait: 'dynamics', weight: 0.3 }] },
  // ── Texture ──
  { pattern: /\btextured\b/i, weights: [{ trait: 'texture', weight: 0.5 }] },
  { pattern: /\btactile\b/i, weights: [{ trait: 'texture', weight: 0.5 }] },
];

/** Scale/power phrases for speaker and amplifier ranking. */
const BIG_SCALE_PATTERNS = [
  /\bbig\s+(?:and\s+)?powerful\b/i,
  /\bbig\s+sound\b/i,
  /\bbig\s+scale\b/i,
  /\bloud\b/i,
  /\bhigh[\s-]?power\b/i,
  /\bfill\s+(?:a\s+)?(?:large|big)\s+room\b/i,
  /\bauthoritative\b/i,
  /\broom[\s-]?filling\b/i,
];

const SMALL_SCALE_PATTERNS = [
  /\bintimate\b/i,
  /\bnear[\s-]?field\b/i,
  /\bdesktop\b/i,
  /\bquiet\s+listening\b/i,
  /\bsmall\s+room\b/i,
  /\bbedroom\b/i,
  /\bcompact\b/i,
];

/** Energy level detection for music-genre inference. */
const HIGH_ENERGY_PATTERNS = [
  /\brock\b/i,
  /\bmetal\b/i,
  /\bvan\s+halen\b/i,
  /\bac\s*\/?\s*dc\b/i,
  /\bpunk\b/i,
  /\bhip[\s-]?hop\b/i,
  /\belectronic\b/i,
  /\bedm\b/i,
  /\bhigh[\s-]?energy\b/i,
  /\benergetic\b/i,
  /\bdynamic\b/i,
];

const LOW_ENERGY_PATTERNS = [
  /\bjazz\b/i,
  /\bclassical\b/i,
  /\bchamber\b/i,
  /\bfolk\b/i,
  /\bacoustic\b/i,
  /\bambient\b/i,
  /\bvocal\b/i,
  /\brelaxed\b/i,
  /\blate[\s-]?night\b/i,
  /\blow[\s-]?volume\b/i,
];

/** Specialist-path hint patterns — signal capture for future routing. */
const SPECIALIST_HINT_PATTERNS: Array<{ pattern: RegExp; hint: string }> = [
  // SET / triode / single-ended
  { pattern: /\b(?:set|single[\s-]?ended|triode)\b/i, hint: 'set_triode' },
  { pattern: /\b(?:decware|yamamoto|bottlehead)\b/i, hint: 'set_triode' },
  // Horn / high-efficiency speakers
  { pattern: /\bhorn(?:[\s-]?loaded)?\b/i, hint: 'horn_higheff' },
  { pattern: /\bhigh[\s-]?(?:efficiency|sensitivity)\b/i, hint: 'horn_higheff' },
  { pattern: /\b(?:klipsch|altec|tannoy|avantgarde|zu\s+audio|zu\b|omega)\b/i, hint: 'horn_higheff' },
  // Low-power preference
  { pattern: /\blow[\s-]?power\b/i, hint: 'low_power' },
  { pattern: /\bfew\s+watts?\b/i, hint: 'low_power' },
  { pattern: /\bunder\s+10\s*w/i, hint: 'low_power' },
  // Specialist amplifier brands
  { pattern: /\bfirst[\s-]?watt\b/i, hint: 'specialist_amp' },
  { pattern: /\bpass[\s-]?labs\b/i, hint: 'specialist_amp' },
  { pattern: /\bshindo\b/i, hint: 'specialist_amp' },
  { pattern: /\bleben\b/i, hint: 'specialist_amp' },
];

/** Music genre hints — extracted for context persistence. */
const MUSIC_HINT_PATTERNS: Array<{ pattern: RegExp; hint: string }> = [
  { pattern: /\bvan\s+halen\b/i, hint: 'rock' },
  { pattern: /\brock\b/i, hint: 'rock' },
  { pattern: /\bmetal\b/i, hint: 'metal' },
  { pattern: /\bjazz\b/i, hint: 'jazz' },
  { pattern: /\bclassical\b/i, hint: 'classical' },
  { pattern: /\belectronic\b/i, hint: 'electronic' },
  { pattern: /\bhip[\s-]?hop\b/i, hint: 'hip-hop' },
  { pattern: /\bfolk\b/i, hint: 'folk' },
  { pattern: /\bvocal\b/i, hint: 'vocal' },
  { pattern: /\bpop\b/i, hint: 'pop' },
];

/**
 * Derive semantic preferences from accumulated user text.
 *
 * Scans for natural-language descriptors ("big and powerful", "warm and smooth")
 * and maps them to weighted trait adjustments. These are applied as soft scoring
 * bonuses in product ranking — strong enough to visibly shift results, but not
 * hard filters.
 *
 * Supports recency weighting: when lineBreakCount is provided, patterns found
 * in later lines get a higher multiplier (recent input matters more).
 */
export function deriveSemanticPreferences(text: string): SemanticPreferences {
  const weights: SemanticWeight[] = [];
  const lines = text.split('\n');
  const lineCount = lines.length;

  // ── Trait weights from semantic patterns ──
  // Aggregate across all matching patterns with recency weighting.
  // Later lines get up to 1.5× multiplier, earlier lines get 1.0×.
  const traitAccumulator: Record<string, number> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Recency multiplier: 1.0 for first line, up to 1.5 for last line
    const recency = lineCount > 1
      ? 1.0 + 0.5 * (i / (lineCount - 1))
      : 1.0;

    for (const { pattern, weights: pw } of SEMANTIC_PATTERNS) {
      if (pattern.test(line)) {
        for (const w of pw) {
          traitAccumulator[w.trait] = (traitAccumulator[w.trait] ?? 0) + w.weight * recency;
        }
      }
    }
  }

  // Convert accumulator to weights array
  for (const [trait, weight] of Object.entries(traitAccumulator)) {
    weights.push({ trait, weight });
  }

  // ── Scale preferences ──
  const wantsBigScale = BIG_SCALE_PATTERNS.some((p) => p.test(text));
  const wantsSmallScale = SMALL_SCALE_PATTERNS.some((p) => p.test(text));

  // ── Energy level ──
  const highEnergy = HIGH_ENERGY_PATTERNS.some((p) => p.test(text));
  const lowEnergy = LOW_ENERGY_PATTERNS.some((p) => p.test(text));
  const energyLevel: SemanticPreferences['energyLevel'] = highEnergy && !lowEnergy
    ? 'high'
    : lowEnergy && !highEnergy
      ? 'low'
      : null;

  // ── Music hints ──
  const musicHints: string[] = [];
  for (const { pattern, hint } of MUSIC_HINT_PATTERNS) {
    if (pattern.test(text) && !musicHints.includes(hint)) {
      musicHints.push(hint);
    }
  }

  // ── Specialist hints ──
  const specialistHints: string[] = [];
  for (const { pattern, hint } of SPECIALIST_HINT_PATTERNS) {
    if (pattern.test(text) && !specialistHints.includes(hint)) {
      specialistHints.push(hint);
    }
  }

  return { weights, wantsBigScale, wantsSmallScale, energyLevel, musicHints, specialistHints };
}

// ── Preserve detection ("what I like…") ───────────────

const PRESERVE_KEYWORDS = [
  'i like',
  'i love',
  'i enjoy',
  'i want to keep',
  'want to preserve',
  'currently enjoy',
  'does well',
  'sounds great',
  'sounds good',
  'happy with',
  'strength is',
  'strong point',
  'best thing',
];

// ── Limiting detection ("what bothers me…") ───────────

const LIMITING_KEYWORDS = [
  'bothers me',
  'limiting',
  'weak point',
  'weakest link',
  'frustrating',
  'lacking',
  'missing',
  'wish it had',
  'falls short',
  'not enough',
  'too much',
  'fatiguing',
  'harsh',
  'thin',
  'bloated',
  'congested',
  'feels off',
  'something is wrong',
];

// ── Budget amount extraction ─────────────────────────

const BUDGET_AMOUNT_PATTERNS = [
  /\$\s?(\d{1,6}(?:,\d{3})*)/,                      // $1000 or $1,500
  /(\d{1,6}(?:,\d{3})*)\s*dollars/i,                 // 1000 dollars
  /budget\s*(?:of|around|is|=|:)?\s*\$?(\d{1,6}(?:,\d{3})*)/i,  // budget is 2000, budget: 2000, budget of 1500
  /under\s+\$?(\d{1,6}(?:,\d{3})*)/i,
  /up\s+to\s+\$?(\d{1,6}(?:,\d{3})*)/i,
  /around\s+\$?(\d{1,6}(?:,\d{3})*)/i,
  /spend\s+\$?(\d{1,6}(?:,\d{3})*)/i,
  /i\s+have\s+\$?(\d{1,6}(?:,\d{3})*)/i,
  /(\d{1,6}(?:,\d{3})*)\s+total\b/i,                // 2000 total
  /limit\s+(?:of\s+)?\$?(\d{1,6}(?:,\d{3})*)/i,    // limit of 2000
];

// "k" suffix patterns — "$5k", "5k", "$2.5k", "2.5k dollars" etc.
// Handled separately because the multiplier needs special treatment in parseBudgetAmount.
const K_SUFFIX_PATTERN = /\$\s?(\d{1,4}(?:\.\d{1,2})?)\s*k\b/gi;
const K_SUFFIX_PATTERN_NO_DOLLAR = /(?:under|around|about|up\s+to|budget\s+(?:of\s+|around\s+|is\s+|=\s*|:\s*)?|spend|limit\s+(?:of\s+)?)\s*(\d{1,4}(?:\.\d{1,2})?)\s*k\b/gi;

/**
 * Extract the most recent numeric budget amount from user text.
 *
 * Because all user messages are concatenated into a single string,
 * earlier budget mentions appear first. If the user revises their
 * budget ("best dac under $1000" → later "best dac under $500"),
 * we need the LAST match, not the first.
 */
export function parseBudgetAmount(text: string): number | null {
  let lastAmount: number | null = null;

  // 1. Check "k" suffix patterns first — "$5k" → 5000, "$2.5k" → 2500
  for (const kPattern of [K_SUFFIX_PATTERN, K_SUFFIX_PATTERN_NO_DOLLAR]) {
    kPattern.lastIndex = 0; // reset global regex state
    let match: RegExpExecArray | null;
    while ((match = kPattern.exec(text)) !== null) {
      const parsed = parseFloat(match[1]);
      if (!isNaN(parsed)) {
        lastAmount = Math.round(parsed * 1000);
      }
    }
  }

  // 2. Standard numeric patterns — "$1000", "under 500", etc.
  for (const pattern of BUDGET_AMOUNT_PATTERNS) {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes('i') ? 'gi' : 'g');
    let match: RegExpExecArray | null;
    while ((match = globalPattern.exec(text)) !== null) {
      const parsed = parseInt(match[1].replace(/,/g, ''), 10);
      if (!isNaN(parsed)) {
        lastAmount = parsed;
      }
    }
  }

  // 3. Sanity guard: if final amount is suspiciously low ($1-$99) but
  // the original text contained a "k" suffix we missed, reject it.
  // This catches edge cases where "$5k" matched "$5" via the standard
  // patterns after k-patterns failed.
  if (lastAmount !== null && lastAmount < 100 && /\d\s*k\b/i.test(text)) {
    // Re-extract from the k-suffix manually
    const kFallback = text.match(/(\d{1,4}(?:\.\d{1,2})?)\s*k\b/i);
    if (kFallback) {
      const kAmount = Math.round(parseFloat(kFallback[1]) * 1000);
      if (kAmount >= 100) lastAmount = kAmount;
    }
  }

  return lastAmount;
}

// ── System profile extraction ─────────────────────────

const SPEAKER_KEYWORDS = [
  'speakers', 'speaker', 'monitors', 'bookshelf', 'floorstanding',
  'floor-standing', 'towers', 'standmount', 'stand-mount',
];

const HEADPHONE_KEYWORDS = [
  'headphones', 'headphone', 'iems', 'iem', 'cans',
  'earphones', 'earphone', 'ear buds', 'earbuds',
];

const BRIGHT_KEYWORDS = [
  'bright', 'forward', 'analytical', 'lean', 'thin',
  'metal tweeter', 'beryllium', 'etched', 'aggressive',
  'sibilant', 'sibilance', 'glare', 'hard treble',
];

const WARM_KEYWORDS = [
  'warm', 'rich', 'dark', 'lush', 'smooth',
  'tube amp', 'tube amplifier', 'set amp', 'paper cone',
  'relaxed', 'laid back', 'laid-back', 'soft dome',
];

const TUBE_KEYWORDS = [
  'tube amp', 'tube amplifier', 'tube integrated',
  'single-ended triode', 'set amp', 'set amplifier',
  '300b', 'el34', 'kt88', 'kt120', 'kt150',
  '2a3', '845', '6l6', '6v6', 'el84',
  'push-pull tube', 'push pull tube',
];

const LOW_POWER_KEYWORDS = [
  'low power', 'low-power', 'single-ended', 'set ',
  'high sensitivity', 'high-sensitivity', 'high efficiency',
  'high-efficiency', 'horn', 'horn loaded', 'horn-loaded',
  'first watt', 'decware',
];

/**
 * Extract a structured system profile from user text.
 * Keyword-based, deterministic, no LLM.
 */
export function parseSystemProfile(text: string): SystemProfile {
  const lower = text.toLowerCase();

  // Output type
  const hasSpeakers = SPEAKER_KEYWORDS.some((kw) => lower.includes(kw));
  const hasHeadphones = HEADPHONE_KEYWORDS.some((kw) => lower.includes(kw));
  let outputType: OutputType = 'unknown';
  if (hasSpeakers && hasHeadphones) outputType = 'both';
  else if (hasSpeakers) outputType = 'speakers';
  else if (hasHeadphones) outputType = 'headphones';

  // System character
  const hasBright = BRIGHT_KEYWORDS.some((kw) => lower.includes(kw));
  const hasWarm = WARM_KEYWORDS.some((kw) => lower.includes(kw));
  let systemCharacter: SystemCharacter = 'unknown';
  if (hasBright && hasWarm) systemCharacter = 'neutral'; // conflicting signals → treat as neutral
  else if (hasBright) systemCharacter = 'bright';
  else if (hasWarm) systemCharacter = 'warm';

  // Tube amplification
  const tubeAmplification = TUBE_KEYWORDS.some((kw) => lower.includes(kw));

  // Low power context
  const lowPowerContext = LOW_POWER_KEYWORDS.some((kw) => lower.includes(kw));

  return { outputType, systemCharacter, tubeAmplification, lowPowerContext };
}

// ── Category dependency detection ────────────────────
//
// Detects practical chain dependencies that influence recommendations.
// Dependencies enrich the answer (caveats, example selection, refinement
// questions) but never block it.

const PHONO_PRESENT_PATTERNS = [
  /\bphono\s*(pre)?amp\b/i,
  /\bphono\s*stage\b/i,
  /\bhave\s+a\s+phono\b/i,
  /\bbuilt[- ]?in\s+phono\b/i,
  /\bmy\s+phono\b/i,
];

const PHONO_ABSENT_PATTERNS = [
  /\bno\s+phono\b/i,
  /\bdon'?t\s+have\s+a?\s*(phono|preamp)\b/i,
  /\bno\s+preamp\b/i,
  /\bwithout\s+a?\s*phono\b/i,
  /\bneed\s+a?\s*phono\b/i,
  /\bdon'?t\s+have\s+a?\s*preamp\s*(yet)?\b/i,
];

const BUDGET_SCOPE_TABLE_ONLY = [
  /\bjust\s+the\s+(table|turntable)\b/i,
  /\bturntable\s+only\b/i,
  /\btable\s+itself\b/i,
];

const BUDGET_SCOPE_FULL_SETUP = [
  /\beverything\s+i\s+need\b/i,
  /\bfull\s+(vinyl\s+)?setup\b/i,
  /\bincluding\s+(the\s+)?phono\b/i,
  /\bwhole\s+vinyl\b/i,
];

/**
 * Detect category-specific dependencies from user text.
 * Currently supports turntable dependencies; extensible to other categories.
 */
export function detectCategoryDependencies(
  category: ShoppingCategory,
  text: string,
): CategoryDependency[] {
  if (category === 'turntable') return detectTurntableDependencies(text);
  return [];
}

function detectTurntableDependencies(text: string): CategoryDependency[] {
  const deps: CategoryDependency[] = [];

  // 1. Phono stage
  const phonoPresent = PHONO_PRESENT_PATTERNS.some((re) => re.test(text))
    && !PHONO_ABSENT_PATTERNS.some((re) => re.test(text));
  const phonoAbsent = PHONO_ABSENT_PATTERNS.some((re) => re.test(text));
  const phonoStatus: CategoryDependency['status'] = phonoAbsent
    ? 'absent'
    : phonoPresent
      ? 'present'
      : 'unknown';

  deps.push({
    id: 'phono_stage',
    label: 'phono stage',
    status: phonoStatus,
    caveat: phonoStatus === 'absent'
      ? 'You mentioned you don\'t have a phono preamp. The turntable needs a phono stage before it reaches your amplifier. Some options below include one; others leave room in the budget for a separate unit.'
      : phonoStatus === 'unknown'
        ? 'If you don\'t already have a phono stage, you\'ll need one between the turntable and your amplifier — some turntables include one built in.'
        : null,
    refinementHint: phonoStatus === 'absent'
      ? 'Is the budget for the turntable alone, or does it need to cover the phono stage as well?'
      : null,
  });

  // 2. Budget scope
  const scopeTableOnly = BUDGET_SCOPE_TABLE_ONLY.some((re) => re.test(text));
  const scopeFullSetup = BUDGET_SCOPE_FULL_SETUP.some((re) => re.test(text));
  const scopeStatus: CategoryDependency['status'] = scopeTableOnly
    ? 'present' // "present" = we know the scope (table only)
    : scopeFullSetup
      ? 'present' // we know the scope (full setup)
      : 'unknown';

  if (scopeStatus === 'unknown' && phonoStatus === 'absent') {
    deps.push({
      id: 'budget_scope',
      label: 'budget scope',
      status: 'unknown',
      caveat: null, // phono caveat covers this
      refinementHint: 'Is the budget for the turntable alone, or does it need to cover the phono stage as well?',
    });
  }

  return deps;
}

// DEFAULT_SYSTEM_PROFILE imported from ./system-profile

// ── Detection ─────────────────────────────────────────

export function detectShoppingIntent(
  userText: string,
  signals: ExtractedSignals,
  activeSystemComponents?: string[],
  /** When switching categories mid-shopping, pass the latest message so its
   *  category takes priority over earlier mentions in the accumulated text. */
  latestMessage?: string,
  /** On refinement turns, carry the active category forward so that
   *  stale allUserText (containing prior category keywords) doesn't
   *  override the user's current category. Used only when latestMessage
   *  has no explicit category keyword. */
  fallbackCategory?: ShoppingCategory,
): ShoppingContext {
  const lower = userText.toLowerCase();

  // 1. Intent
  // INTENT_KEYWORDS uses string matching which requires '$' in budget phrases.
  // Also check BUDGET_PATTERNS (regex) to catch "under 1500" without '$'.
  const detected = INTENT_KEYWORDS.some((kw) => lower.includes(kw))
    || BUDGET_PATTERNS.some((re) => re.test(userText));
  // A bare category word ("DAC", "speakers") is also a shopping signal —
  // the user is implicitly asking for recommendations in that category.
  const hasCategoryWord = CATEGORY_PATTERNS.some((pat) => pat._patterns.some((re) => re.test(userText)));
  // When latestMessage is provided, the caller is already in shopping mode
  // (category switch / refinement). Skip the early bail-out so category
  // detection runs even when allUserText lacks explicit intent keywords.
  if (!detected && !hasCategoryWord && !latestMessage) {
    return {
      detected: false,
      mode: 'specific-component',
      category: 'general',
      budgetMentioned: false,
      budgetAmount: null,
      tasteProvided: false,
      systemProvided: false,
      systemProfile: DEFAULT_SYSTEM_PROFILE,
      useCaseProvided: false,
      preserveProvided: false,
      limitingProvided: false,
      dependencies: [],
      roomContext: null,
      constraints: { excludeTopologies: [], requireTopologies: [], newOnly: false, usedOnly: false },
      semanticPreferences: { weights: [], wantsBigScale: false, wantsSmallScale: false, energyLevel: null, musicHints: [], specialistHints: [] },
    };
  }

  // 2. Category
  // Cable modifiers must be detected first to prevent "speaker cable"
  // from matching the 'speaker' keyword in CATEGORY_PATTERNS.
  let category: ShoppingCategory = 'general';
  let subcategory: ShoppingSubcategory = undefined;
  const isCableRequest = CABLE_MODIFIER_PATTERNS.some((p) => p.test(userText));
  if (isCableRequest) {
    category = 'general';
    subcategory = 'cables';
  } else {
    // When a latest message is provided (category switch), detect from it
    // first so the new category overrides earlier mentions in allUserText.
    if (latestMessage) {
      const latestLower = latestMessage.toLowerCase();
      for (const pat of CATEGORY_PATTERNS) {
        if (pat._patterns.some((re) => re.test(latestLower))) {
          category = pat.category;
          break;
        }
      }
    }
    // Fall back: prefer carried-forward category over scanning allUserText.
    // This prevents stale category keywords in historical messages from
    // overriding the user's active category (e.g. user discussed DACs
    // earlier, now refining amps — allUserText contains "dac" but active
    // category should remain "amplifier").
    if (category === 'general' && fallbackCategory && fallbackCategory !== 'general') {
      category = fallbackCategory;
      console.log('[category-fallback] using carried-forward category=%s (latestMessage had no explicit category)', category);
    }
    // Last resort: scan full text ONLY if no carried-forward category was used.
    // When fallbackCategory is active, allUserText scanning is suppressed —
    // stale keywords from earlier turns must NOT override the locked category.
    if (category === 'general' && !fallbackCategory) {
      for (const pat of CATEGORY_PATTERNS) {
        if (pat._patterns.some((re) => re.test(lower))) {
          category = pat.category;
          break;
        }
      }
    }

    // ── Product-to-category inference ────────────────────
    // When category is still 'general' but the text mentions a known product
    // name alongside a budget signal (e.g., "i think the ares is under 1000"),
    // infer the category from the product's catalog entry. This prevents
    // clarification loops when the user names a specific product without an
    // explicit category keyword. Only fires when a budget signal is present
    // to avoid false positives on taste-only messages ("more engaging and
    // less dry") that could coincidentally contain product name substrings.
    const hasBudgetForInference = BUDGET_PATTERNS.some((re) => re.test(latestMessage ?? userText))
      || /\bunder\s+\$?\d/i.test(latestMessage ?? userText);
    if (category === 'general' && hasBudgetForInference) {
      const textToScan = (latestMessage ?? userText).toLowerCase();
      // Try PRODUCT_NAME_ALIASES (curated, no false positives)
      const aliasHit = tryProductAliasCategory(textToScan);
      if (aliasHit) {
        category = aliasHit.category as ShoppingCategory;
        console.log('[category-product-infer] alias "%s" → %s %s → category=%s',
          aliasHit.alias, aliasHit.brand, aliasHit.name, category);
      }
    }
  }

  // 2b. Multi-category detection ("amp and dac", "dac + amp", "dac/amp")
  // Detect when the user asks for two categories in one message.
  // We handle the first and store the second for a follow-up.
  let secondaryCategory: ShoppingCategory | undefined;
  const multiCatText = (latestMessage ?? userText).toLowerCase();
  const MULTI_CAT_CONNECTORS = /\b(?:and|&|\+|\/|,)\b/;
  if (MULTI_CAT_CONNECTORS.test(multiCatText) && category !== 'general') {
    // Find all categories mentioned in the text
    const mentionedCategories: ShoppingCategory[] = [];
    for (const pat of CATEGORY_PATTERNS) {
      if (pat._patterns.some((re) => re.test(multiCatText))) {
        if (!mentionedCategories.includes(pat.category)) {
          mentionedCategories.push(pat.category);
        }
      }
    }
    if (mentionedCategories.length >= 2) {
      // Primary is the one already detected; secondary is the other
      secondaryCategory = mentionedCategories.find((c) => c !== category);
      console.log('[multi-category] detected: primary=%s secondary=%s', category, secondaryCategory);
    }
  }

  // 3. Mode
  const isBuild = BUILD_KEYWORDS.some((kw) => lower.includes(kw));
  const hasSpecificCategory = category !== 'general';

  let mode: ShoppingMode;
  if (isBuild) {
    mode = 'build-a-system';
  } else if (hasSpecificCategory) {
    mode = 'specific-component';
  } else {
    mode = 'upgrade-path';
  }

  // 4. Context signals
  const budgetMentioned = BUDGET_PATTERNS.some((re) => re.test(userText));
  const budgetAmount = parseBudgetAmount(userText);
  const tasteProvided = signals.symptoms.length >= 2;
  const hasActiveSystem = Array.isArray(activeSystemComponents) && activeSystemComponents.length > 0;
  const systemProvided = hasActiveSystem || SYSTEM_KEYWORDS.some((kw) => lower.includes(kw));
  const systemProfile = systemProvided
    ? parseSystemProfile(hasActiveSystem ? `${userText}\n${activeSystemComponents.join(' ')}` : userText)
    : DEFAULT_SYSTEM_PROFILE;
  const useCaseProvided = USE_CASE_KEYWORDS.some((kw) => lower.includes(kw));
  const preserveProvided = PRESERVE_KEYWORDS.some((kw) => lower.includes(kw));
  const limitingProvided = LIMITING_KEYWORDS.some((kw) => lower.includes(kw));

  // 4b. Room context — extract room size for speaker ranking adjustments
  const roomContext: RoomContext = /\blarge\s+room\b/i.test(userText) || /\bliving\s+room\b/i.test(userText)
    ? 'large'
    : /\bdesktop\b/i.test(userText) || /\bnear[\s-]?field\b/i.test(userText)
      ? 'nearfield'
      : /\bsmall\s+room\b/i.test(userText) || /\bbedroom\b/i.test(userText) || /\bapartment\b/i.test(userText)
        ? 'small'
        : null;

  // 4c. Hard constraints — topology exclusion, availability requirements
  const constraints = extractHardConstraints(userText);

  // 4d. Semantic preferences — natural-language descriptors → trait weights
  const semanticPreferences = deriveSemanticPreferences(userText);

  // 5. Category-specific dependencies
  const dependencies = detectCategoryDependencies(category, userText);

  return {
    detected,
    mode,
    category,
    subcategory,
    secondaryCategory,
    budgetMentioned,
    budgetAmount,
    tasteProvided,
    systemProvided,
    systemProfile,
    useCaseProvided,
    preserveProvided,
    limitingProvided,
    dependencies,
    roomContext,
    constraints,
    semanticPreferences,
  };
}

// ── Context-gap evaluation ────────────────────────────
//
// Instead of fixed question sequences per mode, we evaluate which
// context dimensions are missing and ask for the most useful one.
// Questions are open-ended and adapt to what the user has already said.

export type GapDimension = 'taste' | 'system' | 'budget' | 'use_case';

export interface ContextGap {
  dimension: GapDimension;
  question: string;
}

// ── Richer "already provided" detection ──────────────

/**
 * Returns true when enough taste signal exists — either directional
 * trait signals or multiple symptom descriptions.
 */
function isTasteSufficient(signals: ExtractedSignals): boolean {
  const hasDirectionalTrait = Object.values(signals.traits).some(
    (d) => d === 'up' || d === 'down',
  );
  const hasEnoughSymptoms = signals.symptoms.length >= 2;
  return hasDirectionalTrait || hasEnoughSymptoms;
}

// ── Preference signal counting ───────────────────────
//
// Counts independent preference signals from all available sources.
// Each type contributes at most once, except symptoms which contribute
// individually. This prevents "want warmth and flow" from counting
// as a single signal just because it's one sentence.

/**
 * Categories that require system context before product recommendations.
 * These components interact strongly with the rest of the chain —
 * a recommendation without chain context risks compounding or
 * compensating in the wrong direction.
 */
const SYSTEM_REQUIRED_CATEGORIES: ShoppingCategory[] = [
  'dac', 'amplifier', 'speaker', 'general', // 'general' covers cable queries
];

/**
 * Count distinct preference signals from extracted data.
 *
 * Signal sources:
 *   - Directional traits (flow: 'up', clarity: 'down', etc.) — each counts as 1
 *   - Symptoms ("thin", "harsh", "congested") — each counts as 1
 *   - Preserve keywords ("I like the warmth") — counts as 1 if present
 *   - Limiting keywords ("lacking detail") — counts as 1 if present
 *
 * This is used for confidence gating: product recommendations
 * require at least 3 preference signals before triggering.
 */
export function countPreferenceSignals(
  ctx: ShoppingContext,
  signals: ExtractedSignals,
): number {
  let count = 0;

  // Directional traits
  for (const d of Object.values(signals.traits)) {
    if (d === 'up' || d === 'down') count += 1;
  }

  // Symptoms
  count += signals.symptoms.length;

  // Preserve / limiting context (max 1 each)
  if (ctx.preserveProvided) count += 1;
  if (ctx.limitingProvided) count += 1;

  return count;
}

/**
 * Returns true when we know enough about the user's system to
 * contextualise a recommendation — output type plus at least
 * one structural detail.
 */
function isSystemSufficient(ctx: ShoppingContext): boolean {
  const sp = ctx.systemProfile;
  if (sp.outputType === 'unknown') return ctx.systemProvided;
  // Know the output type AND at least one other detail
  return (
    sp.systemCharacter !== 'unknown' ||
    sp.tubeAmplification ||
    sp.lowPowerContext ||
    ctx.systemProvided
  );
}

// ── Context-aware question phrasing ──────────────────

function phraseTasteQuestion(ctx: ShoppingContext): string {
  switch (ctx.category) {
    case 'dac':
      return 'What matters most to you in how a DAC presents music — the texture and feel, or the clarity and precision?';
    case 'amplifier':
      return 'What do you value most in amplification — rhythmic energy and engagement, or composure and control?';
    case 'speaker':
      return 'What are you hoping these speakers will do especially well?';
    case 'headphone':
      return 'What matters most to you in the sound — warmth and immersion, or detail and separation?';
    case 'streamer':
      return 'Is the streamer your main source, or a transport feeding an external DAC?';
    case 'turntable':
      return 'What draws you to vinyl — the ritual and texture, or the fidelity and detail?';
    default:
      return 'What matters most to you in the sound?';
  }
}

function phraseSystemQuestion(ctx: ShoppingContext): string {
  const sp = ctx.systemProfile;

  // Adapt based on what we already know
  if (sp.tubeAmplification) {
    return 'You mentioned tube amplification — what speakers or headphones is it driving, and what source feeds it?';
  }
  if (sp.outputType === 'speakers') {
    return 'What source and amplification are upstream of those speakers?';
  }
  if (sp.outputType === 'headphones') {
    return 'What source or DAC is driving the headphones?';
  }

  // Category-specific fallbacks
  switch (ctx.category) {
    case 'dac':
      return 'What does the rest of your chain look like — amplification and speakers or headphones?';
    case 'amplifier':
      return 'What source and speakers will the amplifier be working with?';
    case 'speaker':
      return 'What amp and source are driving the speakers?';
    case 'headphone':
      return 'What DAC or source will be driving the headphones?';
    case 'turntable':
      return 'What amplification and speakers will the turntable feed into? And do you already have a phono stage?';
    default:
      return 'What does the rest of your chain look like?';
  }
}

function phraseBudgetQuestion(ctx: ShoppingContext): string {
  const catLabel = CATEGORY_LABELS[ctx.category] ?? 'component';
  return `Do you have a rough budget range in mind for the ${catLabel}?`;
}

function phraseUseCaseQuestion(ctx: ShoppingContext): string {
  if (ctx.mode === 'build-a-system') {
    return 'Will this be a headphone setup, a speaker system, or both?';
  }
  return 'What kind of listening environment is this for — desktop, living room, dedicated room?';
}

// ── Gap evaluation ───────────────────────────────────

/**
 * Evaluate which context gaps remain, in priority order for the
 * detected shopping mode. Returns the ordered list of unfilled gaps.
 *
 * For chain-sensitive categories (DAC, amplifier, speaker, cable),
 * system context is promoted to highest priority regardless of mode.
 *
 * Priority varies by mode:
 *   specific-component: system (if chain-sensitive) → taste → budget
 *   upgrade-path:       system → taste → budget
 *   build-a-system:     use_case → taste → budget
 */
export function evaluateContextGaps(
  ctx: ShoppingContext,
  signals: ExtractedSignals,
): ContextGap[] {
  const gaps: ContextGap[] = [];

  const checks: Record<GapDimension, { filled: boolean; question: string }> = {
    taste: {
      filled: isTasteSufficient(signals),
      question: phraseTasteQuestion(ctx),
    },
    system: {
      // If the user never mentioned a system, don't treat it as a gap —
      // fresh shopping inputs shouldn't be asked about their current gear.
      filled: isSystemSufficient(ctx) || !ctx.systemProvided,
      question: phraseSystemQuestion(ctx),
    },
    budget: {
      filled: ctx.budgetMentioned,
      question: phraseBudgetQuestion(ctx),
    },
    use_case: {
      filled: ctx.useCaseProvided,
      question: phraseUseCaseQuestion(ctx),
    },
  };

  // For chain-sensitive categories, system always comes first
  const systemFirst = SYSTEM_REQUIRED_CATEGORIES.includes(ctx.category)
    && ctx.mode !== 'build-a-system';

  // Priority order depends on mode
  let order: GapDimension[];
  switch (ctx.mode) {
    case 'specific-component':
      order = systemFirst
        ? ['system', 'taste', 'budget']
        : ['taste', 'system', 'budget'];
      break;
    case 'upgrade-path':
      order = ['system', 'taste', 'budget'];
      break;
    case 'build-a-system':
      order = ['use_case', 'taste', 'budget'];
      break;
  }

  for (const dim of order) {
    const check = checks[dim];
    if (!check.filled) {
      gaps.push({ dimension: dim, question: check.question });
    }
  }

  return gaps;
}

// ── Conversational bridging ──────────────────────────

/**
 * Optionally prepend a single short bridging sentence to a follow-up
 * question, reflecting what we already understand. At most one sentence,
 * only when it improves conversational flow.
 */
function bridgeQuestion(
  gap: ContextGap,
  ctx: ShoppingContext,
  signals: ExtractedSignals,
): string {
  // Only bridge when we have something meaningful to reflect
  // and the gap is not the very first question
  const hasTaste = isTasteSufficient(signals);
  const hasSystem = isSystemSufficient(ctx);

  let bridge = '';

  if (gap.dimension === 'system' && hasTaste) {
    bridge = 'I have a sense of what you value sonically. ';
  } else if (gap.dimension === 'taste' && hasSystem) {
    bridge = 'I know what you\'re working with. ';
  } else if (gap.dimension === 'budget' && hasTaste && hasSystem) {
    bridge = 'Good picture of what you\'re after and what you\'re working with. ';
  }

  return `${bridge}${gap.question}`;
}

// ── Turn caps per mode ────────────────────────────────

const TURN_CAPS: Record<ShoppingMode, number> = {
  'specific-component': 2,
  'upgrade-path': 2,
  'build-a-system': 2,
};

/** Returns the maximum number of inquiry turns for the detected mode. */
export function getShoppingTurnCap(mode: ShoppingMode): number {
  return TURN_CAPS[mode];
}

// ── Answer-readiness ──────────────────────────────────

/**
 * Confidence-gated answer readiness.
 *
 * Product recommendations require EITHER:
 *   A) High confidence — at least 3 preference signals AND
 *      (system context known OR system explicitly irrelevant)
 *   B) User explicitly requests quick suggestions (skipToSuggestions flag)
 *
 * For DAC, amplifier, speaker, and cable categories, system context is
 * always required unless explicitly irrelevant (e.g. first system).
 *
 * The turn cap provides a backstop that forces a provisional answer
 * regardless of what's been gathered.
 */
export function isAnswerReady(
  ctx: ShoppingContext,
  signals: ExtractedSignals,
  skipToSuggestions = false,
): boolean {
  if (!ctx.detected) return true; // not shopping — let the engine handle it

  // Skip-to-suggestions bypasses all gating
  if (skipToSuggestions) return true;

  // Direct shortlist — category + budget in a single query (e.g. "best DAC
  // under $2000"). Enough context to produce a useful recommendation
  // immediately; taste and system signals enrich but don't gate.
  if (ctx.category !== 'general' && ctx.budgetMentioned) return true;

  // Explicit buy intent — "I want to buy a DAC" without budget or taste.
  // Show popular options immediately rather than gating on discovery.
  // The response will note missing budget/taste as caveats, not blockers.
  if (ctx.category !== 'general' && ctx.mode === 'specific-component') return true;

  const hasSystem = isSystemSufficient(ctx);
  const signalCount = countPreferenceSignals(ctx, signals);
  const hasEnoughSignals = signalCount >= 3;

  // System context is required for chain-sensitive categories unless
  // the user is building from scratch (system is inherently absent)
  // or the user never mentioned having a system at all.
  const systemRequired = SYSTEM_REQUIRED_CATEGORIES.includes(ctx.category)
    && ctx.mode !== 'build-a-system'
    && ctx.systemProvided;

  if (systemRequired && !hasSystem) return false;

  switch (ctx.mode) {
    case 'specific-component':
      // Turntable exception: budget alone is sufficient — taste signals
      // are less critical for turntable mechanical-platform recommendations.
      if (ctx.category === 'turntable' && ctx.budgetMentioned) return true;
      // Standard: 3+ preference signals AND system context (or not required)
      return hasEnoughSignals;

    case 'upgrade-path':
      // System + 3+ preference signals
      return hasSystem && hasEnoughSignals;

    case 'build-a-system':
      // Use case + 3+ preference signals
      return ctx.useCaseProvided && hasEnoughSignals;
  }
}

/**
 * Returns the list of important gaps that remain even when we proceed
 * to answer. These become caveats on the recommendation.
 */
export function getStatedGaps(
  ctx: ShoppingContext,
  signals: ExtractedSignals,
): GapDimension[] {
  const gaps: GapDimension[] = [];

  if (!isTasteSufficient(signals)) gaps.push('taste');
  // Build-a-system users have no existing system — asking for one is wrong.
  // Only flag system as a gap when the user actually indicated they have one.
  // Fresh shopping inputs ("I want speakers") should not be asked about their system.
  if (!isSystemSufficient(ctx) && ctx.mode !== 'build-a-system' && ctx.systemProvided) gaps.push('system');
  if (!ctx.budgetMentioned) gaps.push('budget');
  if (ctx.mode === 'build-a-system' && !ctx.useCaseProvided) gaps.push('use_case');

  return gaps;
}

// ── Question selection ────────────────────────────────

/**
 * Returns the next follow-up question for the detected shopping mode,
 * or null if enough context has been gathered.
 *
 * Uses the context-gap evaluator to find the most useful missing
 * dimension and phrases the question contextually.
 *
 * Returns null (triggering answer mode) when:
 *   1. Readiness conditions are met, OR
 *   2. The user requested quick suggestions (skipToSuggestions), OR
 *   3. The per-mode turn cap is reached, OR
 *   4. No context gaps remain.
 *
 * @param ctx                - Shopping context derived from all user text so far
 * @param signals            - Extracted signals from all user text
 * @param turnCount          - Number of user submissions (1-indexed)
 * @param skipToSuggestions  - User requested quick exploratory suggestions
 */
export function getShoppingClarification(
  ctx: ShoppingContext,
  signals: ExtractedSignals,
  turnCount: number,
  skipToSuggestions = false,
): string | null {
  if (!ctx.detected) return null;

  // Quick suggestions bypass — go straight to exploratory answer
  if (skipToSuggestions) return null;

  // Early exit: enough context gathered — go straight to answer
  if (isAnswerReady(ctx, signals)) return null;

  // Turn cap: provide provisional direction with what we have
  const cap = TURN_CAPS[ctx.mode];
  if (turnCount >= cap) return null;

  // Find the highest-priority unfilled gap
  const gaps = evaluateContextGaps(ctx, signals);
  if (gaps.length === 0) return null;

  // Return the top gap with optional conversational bridging
  return bridgeQuestion(gaps[0], ctx, signals);
}

// ── Shopping Answer (advisor-first structure) ─────────

export interface ProductExample {
  name: string;
  brand: string;
  price: number;
  /** ISO 4217 currency code. Defaults to 'USD' when omitted. */
  priceCurrency?: string;
  /** Brief sonic character — what this component fundamentally sounds like. */
  character?: string;
  /** Design/architecture highlights — "Why it stands out" bullets. */
  standoutFeatures?: string[];
  /** Sonic character bullets — "Sound profile" (distinct from fitNote verdict). */
  soundProfile?: string[];
  fitNote: string;
  caution?: string;
  links?: { label: string; url: string; region?: string }[];
  /** Named source references from the product catalog. */
  sourceReferences?: Array<{ source: string; note: string; url?: string }>;
  // ── Enhanced card fields ─────────────────────────────
  /** Sonic direction label (e.g. "flow-oriented", "precision-focused"). */
  sonicDirectionLabel?: string;
  /** Product type for display (e.g. "Integrated Amplifier"). */
  productType?: string;
  /** Manufacturer URL. */
  manufacturerUrl?: string;
  /** Used-market exploration link. */
  usedMarketUrl?: string;
  /** Market availability. */
  availability?: 'current' | 'discontinued' | 'vintage';
  /** Used price range for discontinued/vintage products. */
  usedPriceRange?: { low: number; high: number };
  /** Used-market discovery links (HiFi Shark, Audiogon, etc.). */
  usedMarketSources?: UsedMarketSource[];
  /** Predicted sonic delta — what this product would change in the system. */
  systemDelta?: { whyFitsSystem?: string; likelyImprovements?: string[]; tradeOffs?: string[] };
  /** Anchor-only justification — 2–3 sentence expert rationale connecting
   *  user context (symptom / preference / system state) to this specific product.
   *  Only populated for the anchor product (pickRole === 'anchor' or isPrimary). */
  anchorJustification?: string;

  // ── Catalog facts (not rendered — used for LLM validation) ──
  /** Raw architecture string from catalog (e.g. "delta-sigma (ESS)"). */
  catalogArchitecture?: string;
  /** Design topology (e.g. "r2r", "fpga", "delta-sigma"). */
  catalogTopology?: string;
  /** Country of origin (ISO code, e.g. "CN", "US", "JP"). */
  catalogCountry?: string;
  /** Brand scale (e.g. "specialist", "boutique", "major"). */
  catalogBrandScale?: string;
  /** Subcategory from catalog (e.g. "integrated-amp", "power-amp", "headphone-amp"). */
  catalogSubcategory?: string;
  /** True when this product is already in the user's current system. */
  isCurrentComponent?: boolean;
  /** True when this is the primary recommendation in directed mode. */
  isPrimary?: boolean;
  /** Budget realism tier — how realistic this product is at the stated budget.
   *  - realistic_new:  comfortably within budget at retail
   *  - realistic_used: within budget at used-market prices
   *  - stretch_used:   a stretch even on the used market
   *  - above_budget:   technically outside budget range */
  budgetRealism?: 'realistic_new' | 'realistic_used' | 'stretch_used' | 'above_budget';
  /** Pick role in the structured recommendation (4-option model).
   *  - anchor:      best-fit product for this listener
   *  - close_alt:   same philosophy, slightly different
   *  - contrast:    different sonic direction
   *  - wildcard:    non-traditional / high-character option
   *  Legacy roles retained for backward compatibility:
   *  - top_pick / upgrade_pick / value_pick */
  pickRole?: 'anchor' | 'close_alt' | 'contrast' | 'wildcard' | 'top_pick' | 'upgrade_pick' | 'value_pick';

  // ── 4-option recommendation metadata ──────────────────
  /** Design philosophy — carried through from catalog for anchor tracking. */
  philosophy?: 'energy' | 'neutral' | 'warm' | 'analytical';
  /** Market type — carried through from catalog for selection mode logic. */
  marketType?: 'traditional' | 'nonTraditional' | 'value';
  /** Primary axis leanings — carried through for sonic distance calculation. */
  primaryAxes?: PrimaryAxisLeanings;

  // ── Enhanced catalog fields (Step 10) ─────────────────
  /** Product image URL — official press image or product shot. */
  imageUrl?: string;
  /** Where this product is typically found (new / used / both). */
  typicalMarket?: 'new' | 'used' | 'both';
  /** Structured buying context label — overrides card inference when present. */
  buyingContext?: 'easy_new' | 'better_used' | 'dealer_likely' | 'used_only';
}

// ── Synthesis Brief ───────────────────────────────────
//
// Structured reasoning summary that the rendering layer uses to
// generate the final narrative. The deterministic reasoning layer
// remains the source of truth — the brief makes reasoning visible
// and transportable to the presentation layer.

export interface ShoppingShortlistBrief {
  kind: 'shopping_shortlist';
  /** Canonical category (DAC, amplifier, speakers, etc.) */
  queryCategory: string;
  /** Amplifier subtype when applicable (integrated, power, preamp). */
  amplifierSubtype?: string;
  /** Budget ceiling. */
  budget: number | null;
  /** One-line user taste summary or "No taste signals detected." */
  userTasteSummary: string;
  /** Active system summary or "No system context provided." */
  activeSystemSummary: string;
  /** Which context dimensions are still missing. */
  missingContext: GapDimension[];
  /** Sonic philosophies represented by the selected candidates. */
  candidatePhilosophies: CandidatePhilosophy[];
  /** Narrative goal — what the shortlist should communicate. */
  narrativeGoal: string;
  /** Refinement prompts — questions that would deepen personalization. */
  refinementPrompts: string[];
}

/** A sonic direction represented by one or more shortlist candidates. */
export interface CandidatePhilosophy {
  /** Design topology or philosophy label (e.g., "FPGA pulse-array", "Discrete R2R"). */
  label: string;
  /** What this direction prioritizes. */
  emphasis: string;
  /** Product names that represent this direction. */
  representatives: string[];
}

export interface ProductInquiryBrief {
  kind: 'product_inquiry';
  /** Product name and brand. */
  productIdentity: string;
  /** Architecture / design family. */
  architecture: string;
  /** Likely sonic direction (one sentence). */
  sonicDirection: string;
  /** System context summary if available. */
  systemContext: string;
  /** What the narrative should explain. */
  narrativeGoal: string;
}

export interface ComparisonBrief {
  kind: 'comparison';
  /** Product A philosophy (one sentence). */
  productAPhilosophy: string;
  /** Product B philosophy (one sentence). */
  productBPhilosophy: string;
  /** Shared traits. */
  sharedTraits: string[];
  /** Key differences. */
  keyDifferences: string[];
  /** System relevance (if system context present). */
  systemRelevance: string;
  /** What the narrative should explain. */
  narrativeGoal: string;
}

export interface SystemAssessmentBrief {
  kind: 'system_assessment';
  /** System identity (component chain). */
  systemIdentity: string;
  /** Shared design philosophy. */
  sharedPhilosophy: string;
  /** Defining strengths. */
  definingStrengths: string[];
  /** Main trade-offs. */
  mainTradeoffs: string[];
  /** Refinement path. */
  refinementPath: string;
  /** Listener philosophy insight. */
  listenerInsight: string;
}

export type SynthesisBrief =
  | ShoppingShortlistBrief
  | ProductInquiryBrief
  | ComparisonBrief
  | SystemAssessmentBrief;

export interface ShoppingAnswer {
  category: string;
  budget: number | null;
  preferenceSummary: string;
  bestFitDirection: string;
  whyThisFits: string[];
  productExamples: ProductExample[];
  watchFor: string[];
  systemNote?: string;
  /** True when the recommendation is based on incomplete context — refinable. */
  provisional?: boolean;
  /** Which context dimensions are missing — shown as caveats on provisional answers. */
  statedGaps?: GapDimension[];
  /** Category-specific dependency caveat (e.g., phono stage for turntables). */
  dependencyCaveat?: string;
  /** Dependency-aware refinement question appended after the main answer. */
  refinementQuestion?: string;
  /** Structured reasoning brief for the rendering layer. */
  synthesisBrief?: ShoppingShortlistBrief;
  /** Sonic landscape guide — explains what the shortlist candidates represent. */
  sonicLandscape?: string;
  /** Refinement prompts — questions to deepen personalization. */
  refinementPrompts?: string[];
  /** Compact personalization bullets — "why this fits you" layer. */
  whyFitsYou?: string[];
  /** True when budget + category + any taste signal are present — shifts
   *  output from exploratory options to directed system-building. */
  directed?: boolean;
  /** Next build step — what the user should consider next in a system build.
   *  Only populated in directed mode when a logical next step exists. */
  nextBuildStep?: string;
  /** Taste confidence level — controls language assertiveness. */
  tasteConfidence?: TasteConfidence;
  /** Targeted question to append when confidence is low. */
  tasteQuestion?: string;
  /** Focused category question when taste is clear but category is missing. */
  categoryQuestion?: string;
}

// ── Taste direction templates ─────────────────────────

interface TasteProfile {
  check: (traits: Record<string, string>) => boolean;
  label: string;
  /** Associated sonic archetype for this taste preference. */
  archetype?: import('./archetype').SonicArchetype;
  directionByCategory: Partial<Record<ShoppingCategory, string>>;
  defaultDirection: string;
  whyByCategory: Partial<Record<ShoppingCategory, string[]>>;
  defaultWhy: string[];
  watchFor: string[];
}

const TASTE_PROFILES: TasteProfile[] = [
  {
    check: (t) => t.dynamics === 'up' || t.elasticity === 'up',
    label: 'speed, transient precision, and rhythmic engagement',
    archetype: 'rhythmic_propulsive',
    directionByCategory: {
      dac: 'A DAC direction that prioritizes transient definition, rhythmic precision, and dynamic contrast over warmth-first tuning.',
      amplifier: 'An amplifier direction that prioritizes current delivery, tight damping, and transient snap over tonal smoothness.',
      speaker: 'A speaker direction that prioritizes fast drivers, simple crossovers, and transient preservation over tonal warmth.',
      headphone: 'A headphone direction that prioritizes planar-magnetic speed and uniform diaphragm response over dynamic-driver warmth.',
    },
    defaultDirection: 'A component direction that prioritizes timing precision and transient definition over tonal smoothness.',
    whyByCategory: {
      dac: [
        'You prioritized speed and rhythmic engagement over smoothness.',
        'Your budget supports DACs designed for transient precision.',
        'Multibit, R2R, and certain FPGA architectures tend to serve this preference.',
      ],
    },
    defaultWhy: [
      'You prioritized speed and dynamic engagement.',
      'Components with strong transient definition tend to serve this preference.',
    ],
    watchFor: [
      'Pushing too far toward speed can reduce perceived tonal density and midrange body.',
      'Very fast systems can feel lean or relentless over long listening sessions.',
      'If the rest of the system already trends toward precision, adding more speed may overcorrect.',
    ],
  },
  {
    check: (t) => t.tonal_density === 'up' && t.flow === 'up',
    label: 'harmonic richness, flow, and tonal density',
    archetype: 'tonal_saturated',
    directionByCategory: {
      dac: 'A DAC direction that prioritizes tonal weight, harmonic texture, and musical flow over analytical precision.',
      amplifier: 'An amplifier direction that prioritizes harmonic density and musical continuity over measured specifications.',
      speaker: 'A speaker direction that prioritizes tonal weight and natural-material cone texture over speed.',
    },
    defaultDirection: 'A component direction that prioritizes harmonic richness and tonal continuity over transient precision.',
    whyByCategory: {
      dac: [
        'You prioritized flow, warmth, and tonal density.',
        'R2R and NOS tube architectures tend to deliver this kind of presentation.',
        'Your budget supports several DACs in this design family.',
      ],
    },
    defaultWhy: [
      'You prioritized harmonic richness and musical flow.',
      'Components with strong tonal density tend to serve this preference.',
    ],
    watchFor: [
      'Components that maximize tonal density may sacrifice some detail retrieval and transient edge.',
      'Very rich systems can sound congested or slow if pushed too far.',
      'If the rest of the system is already warm, adding more density may obscure detail.',
    ],
  },
  {
    check: (t) => t.clarity === 'up',
    label: 'detail, clarity, and resolution',
    archetype: 'precision_explicit',
    directionByCategory: {
      dac: 'A DAC direction that prioritizes transparency, information retrieval, and measured resolution.',
      amplifier: 'An amplifier direction that prioritizes wide bandwidth, low distortion, and upstream transparency.',
      speaker: 'A speaker direction that prioritizes resolution, rigid cabinets, and monitor-style accuracy.',
      headphone: 'A headphone direction that prioritizes electrostatic or high-end planar resolution and spatial detail.',
    },
    defaultDirection: 'A component direction that prioritizes transparency and information retrieval.',
    whyByCategory: {
      dac: [
        'You prioritized clarity and resolution over warmth or density.',
        'Delta-sigma (ESS, AKM) and FPGA architectures tend to excel at measured detail retrieval.',
        'Your budget supports several precision-first DAC designs.',
      ],
    },
    defaultWhy: [
      'You prioritized clarity and detail retrieval.',
      'Components known for transparency tend to serve this preference.',
    ],
    watchFor: [
      'Highly resolving systems can become fatiguing if any upstream component introduces edge or glare.',
      'Detail without sufficient tonal body can sound thin and clinical.',
      'If the rest of the system is already bright or forward, more clarity may overcorrect.',
    ],
  },
  {
    check: (t) => t.fatigue_risk === 'up' || t.glare_risk === 'up',
    label: 'reduced fatigue and smoother presentation',
    archetype: 'flow_organic',
    directionByCategory: {
      dac: 'A DAC direction that prioritizes smoothness, low fatigue, and listening ease over analytical resolution.',
      amplifier: 'An amplifier direction that prioritizes gentle high-frequency behavior and composure over transient edge.',
      speaker: 'A speaker direction that prioritizes soft-dome or ribbon tweeters and non-fatiguing extension.',
      headphone: 'A headphone direction that prioritizes warm tuning and rolled-off treble for long sessions.',
    },
    defaultDirection: 'A component direction that prioritizes listening ease over analytical precision.',
    whyByCategory: {
      dac: [
        'You indicated fatigue or harshness as a concern.',
        'NOS tube, R2R, and certain relaxed-filter architectures tend to reduce perceived digital edge.',
        'Addressing fatigue at the DAC level can be effective when the source is the issue.',
      ],
    },
    defaultWhy: [
      'You indicated fatigue or harshness as a concern.',
      'Components known for smoothness tend to serve this preference.',
    ],
    watchFor: [
      'Reducing fatigue by softening the presentation can also reduce perceived detail and air.',
      'The source of fatigue may be upstream — fixing the wrong component leaves the root cause intact.',
      'If the system lacks energy or engagement, a smoother direction may make that worse.',
    ],
  },
  {
    check: (t) => t.flow === 'up' && t.composure === 'up',
    label: 'smoothness, ease, and composure',
    archetype: 'flow_organic',
    directionByCategory: {
      dac: 'A DAC direction that prioritizes musical flow, composure, and organic texture over speed or analytical precision.',
      amplifier: 'An amplifier direction that prioritizes single-ended tube composure and texture over dynamic punch.',
      speaker: 'A speaker direction that prioritizes gentle crossover slopes and natural-material drivers.',
    },
    defaultDirection: 'A component direction that prioritizes musical flow and composure over speed or analytical precision.',
    whyByCategory: {
      dac: [
        'You prioritized smoothness and musical ease.',
        'Tube-output and relaxed-filter DAC architectures tend to maximize composure.',
        'This direction works best when the rest of the system provides sufficient energy.',
      ],
    },
    defaultWhy: [
      'You prioritized smoothness and composure.',
      'Components known for musical ease tend to serve this preference.',
    ],
    watchFor: [
      'Very composed systems can feel sleepy or lack dynamic contrast.',
      'Smoothness pushed too far can obscure musical detail and reduce engagement.',
      'If the system already sounds relaxed, adding more composure may reduce liveliness.',
    ],
  },
];

const FALLBACK_TASTE: Pick<TasteProfile, 'label' | 'defaultDirection' | 'defaultWhy' | 'watchFor'> = {
  label: 'musical engagement',
  defaultDirection: 'Designs that prioritise long-term listening enjoyment and emotional connection with the music, rather than optimising any single trait.',
  defaultWhy: [
    'Specific listening priorities are still being determined — these options cover the strongest design directions at this level.',
    'Narrowing your sonic preferences will sharpen the shortlist considerably.',
  ],
  watchFor: [
    'Without a clear preference signal, these recommendations cover a range of philosophies — each excels in a different dimension.',
    'Telling the system what you value most (warmth, detail, rhythm, space) will produce a more targeted list.',
  ],
};

// ── Product-to-category inference helper ──────────────
// Uses the curated alias map + catalog lookup to infer category from a
// product name mentioned in text. Only returns a result when the product
// name is unambiguously a known alias (not fuzzy matched on common words).
function tryProductAliasCategory(textLower: string): { alias: string; brand: string; name: string; category: string } | null {
  // Extract word tokens and try 1-3 word phrases against resolveProductAlias
  const words = textLower.replace(/[.,!?;:()]/g, ' ').split(/\s+/).filter(Boolean);
  for (let len = 3; len >= 1; len--) {
    for (let i = 0; i <= words.length - len; i++) {
      const phrase = words.slice(i, i + len).join(' ');
      // resolveProductAlias only matches the curated PRODUCT_NAME_ALIASES map
      const resolved = resolveProductAlias(phrase);
      if (resolved && resolved !== phrase) {
        // The alias resolved to a canonical name — look up in catalog
        const hit = findCatalogProduct(resolved);
        if (hit && hit.category !== 'general') {
          return { alias: phrase, brand: hit.brand, name: hit.name, category: hit.category };
        }
      }
      // NOTE: Direct findCatalogProduct matching is intentionally NOT used
      // here — its fuzzy matching produces false positives (e.g., "bifrost"
      // matches "Rost" because "rost" ⊂ "bifrost"). Only the curated alias
      // map above is safe for category inference.
    }
  }
  return null;
}

// ── Category labels ───────────────────────────────────

const CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  dac: 'DAC',
  amplifier: 'amplifier',
  speaker: 'speakers',
  headphone: 'headphones',
  streamer: 'streamer',
  turntable: 'turntable',
  general: 'component',
};

// ── Product integration ───────────────────────────────

import { DAC_PRODUCTS } from './products/dacs';
import type { Product } from './products/dacs';
import { SPEAKER_PRODUCTS } from './products/speakers';
import { AMPLIFIER_PRODUCTS } from './products/amplifiers';
import { HEADPHONE_PRODUCTS, type HeadphoneProduct } from './products/headphones';
import { selectTurntableExamples } from './products/turntables';
import { rankProducts, type ScoredProduct, AMPLIFIER_ARCHITECTURE_TENDENCIES, type ArchitectureTendency } from './product-scoring';
import type { ListenerProfile } from './listener-profile';
import { findCatalogProduct, resolveProductAlias } from './listener-profile';
import { tagProductArchetype } from './archetype';
import { topTraits, type TasteProfile as UserTasteProfile, type ProfileTraitKey } from './taste-profile';
import type { ReasoningResult } from './reasoning';

/**
 * Extract the key opening phrase from a tendency description.
 *
 * Tendency strings follow the pattern:
 *   "key phrase — elaboration with more detail"
 *
 * This function extracts just the key phrase for concise use in
 * verdict lines and summaries. Falls back to first 8 words if
 * no em-dash separator is found.
 */
function extractKeyPhrase(text: string): string {
  // Split on em-dash (—) and take the first part
  const emDashIndex = text.indexOf('—');
  let phrase = emDashIndex > 0
    ? text.slice(0, emDashIndex).trim()
    : text.trim();
  // Strip trailing qualifiers
  phrase = phrase.replace(/\s+(?:compared to|rather than|relative to|with\s+\w+)\s+.*/i, '');
  // Cap at 6 words to keep it punchy but complete
  const words = phrase.split(/\s+/);
  if (words.length > 6) phrase = words.slice(0, 6).join(' ');
  // Strip trailing dangling prepositions/articles (may need multiple passes)
  while (/\s+(?:from|with|for|in|on|to|of|and|the|a|that|without)$/i.test(phrase)) {
    phrase = phrase.replace(/\s+(?:from|with|for|in|on|to|of|and|the|a|that|without)$/i, '');
  }
  // Strip incomplete prepositional phrases at the end (e.g. "authority from a tiny")
  phrase = phrase.replace(/\s+(?:from|with|for|in|on|to|of)\s+.*$/i, '');
  return phrase.toLowerCase();
}

/**
 * Generate a one-sentence fit note for a product based on its
 * architecture and strongest matching traits.
 */
// ── Fit language simplification ──────────────────────
//
// Product tendency descriptions are written in reviewer/audiophile vocabulary
// ("holographic staging", "zero-crossover coherence", "tonal density").
// For user-facing product cards these need to read as plain, approachable
// language. This map normalizes the most common audiophile phrases.
//
// Rules:
//   - Replace jargon with listener-experience descriptions
//   - Keep phrases short and conversational
//   - Preserve meaning without requiring expertise to parse

const FIT_LANGUAGE_SIMPLIFICATIONS: [RegExp, string][] = [
  // Spatial
  [/holographic(?:\s+and\s+boundless)?(?:\s+(?:staging|imaging))?/gi, 'open and immersive soundstage'],
  [/holographic,?\s*three-dimensional/gi, 'open and three-dimensional'],
  [/expansive\s+and\s+layered/gi, 'wide and layered'],
  [/enormous\s+spatial\s+depth/gi, 'deep, spacious presentation'],
  [/disappearing\s+act/gi, 'speakers disappear into the room'],
  [/exceptional\s+image\s+specificity/gi, 'precisely placed instruments'],
  [/monitor-type\s+staging\s+spookiness/gi, 'uncanny spatial realism'],
  // Texture / coherence
  [/zero-crossover\s+coherence/gi, 'coherent and natural'],
  [/without\s+the\s+discontinuities\s+of\s+multi-way\s+designs/gi, 'seamless from top to bottom'],
  [/unified\s+and\s+natural/gi, 'smooth and natural'],
  // Tonal / harmonic
  [/extraordinar(?:y|ily)\s+(?:warm,?\s*)?rich(?:,?\s*golden)?/gi, 'warm and richly textured'],
  [/deep\s+tonal\s+density/gi, 'full, weighty tone'],
  [/rich\s+harmonic\s+overtones/gi, 'harmonically rich'],
  [/rich\s+tactile\s+quality/gi, 'rich and tactile'],
  [/tonal\s+(?:density|richness)/gi, 'tonal richness'],
  [/harmonically\s+dense/gi, 'harmonically rich'],
  // Dynamics
  [/explosive\s+transient\s+impact/gi, 'punchy and dynamic'],
  [/blazing\s+speed\s+on\s+leading\s+edges/gi, 'fast and immediate'],
  [/effortless\s+dynamic\s+expression/gi, 'effortless dynamics'],
  [/punchy\s+macrodynamics/gi, 'impactful dynamics'],
  [/transient\s+precision/gi, 'rhythmic precision'],
  // Flow / organic
  [/liquid,?\s*organic,?\s*tangible/gi, 'fluid and lifelike'],
  [/unhurried\s+phrasing/gi, 'relaxed, natural pacing'],
  [/music\s+flows\s+rather\s+than\s+pushes/gi, 'music flows naturally'],
  // Precision
  [/transparent\s+and\s+refined/gi, 'transparent and refined'],
  [/extremely\s+resolved/gi, 'highly detailed'],
  [/fast,?\s*precise,?\s*articulate/gi, 'fast and articulate'],
  [/neutral,?\s*transparent,?\s*clean/gi, 'neutral and transparent'],
  // Generic cleanup
  [/instruments\s+sound\s+maximally\s+real\s+and\s+present/gi, 'instruments sound lifelike'],
  [/notes\s+start\s+with\s+conviction/gi, 'notes have clear, decisive attack'],
  [/— (?:the\s+)?(?:Ring\s+DAC|OTL\s+topology|open-back\s+design|single\s+driver)\s+[^.]+\./gi, '.'],
];

/** Apply plain-language normalization to a product character or fit string. */
function simplifyFitLanguage(text: string): string {
  let result = text;
  for (const [pattern, replacement] of FIT_LANGUAGE_SIMPLIFICATIONS) {
    result = result.replace(pattern, replacement);
  }
  // Clean up doubled spaces and trailing punctuation issues
  return result.replace(/\s{2,}/g, ' ').replace(/\.\s*\./g, '.').trim();
}

/**
 * Build a concise "best for" summary for a product.
 *
 * Output: short phrase like "Best for warmth and body" or "Best for speed and clarity".
 * No architecture labels, no trade-off clauses, no internal modelling language.
 */
function buildFitNote(product: Product, _userTraits: Record<string, SignalDirection>): string {
  return simplifyFitLanguage(buildFitNoteRaw(product, _userTraits));
}

/** Raw fit note — before plain-language normalization. */
function buildFitNoteRaw(product: Product, _userTraits: Record<string, SignalDirection>): string {
  // Priority 1: curated character tendencies — extract the two strongest qualities
  if (hasTendencies(product.tendencies)) {
    const top = selectDefaultTendencies(product.tendencies.character, 3);
    if (top.length >= 2) {
      return `Best for ${extractKeyPhrase(top[0].tendency)} and ${extractKeyPhrase(top[1].tendency)}`;
    }
    if (top.length === 1) {
      return `Best for ${extractKeyPhrase(top[0].tendency)}`;
    }
  }

  // Priority 2: qualitative tendency profile — prefer 'emphasized', fall back to 'present'
  if (hasExplainableProfile(product.tendencyProfile)) {
    const emphasized = getEmphasizedTraits(product.tendencyProfile);
    if (emphasized.length >= 2) {
      return `Best for ${emphasized[0]} and ${emphasized[1]}`;
    }
    if (emphasized.length === 1) {
      return `Best for ${emphasized[0]}`;
    }
    // No 'emphasized' traits — use 'present' traits as fallback
    const present = product.tendencyProfile.tendencies
      .filter((t) => t.level === 'present')
      .map((t) => t.trait.replace(/_/g, ' '));
    if (present.length >= 2) {
      return `Best for ${present[0]} and ${present[1]}`;
    }
    if (present.length === 1) {
      return `Best for ${present[0]}`;
    }
  }

  // Priority 3: primary axis leanings
  if (product.primaryAxes) {
    const qualities: string[] = [];
    const wb = product.primaryAxes.warm_bright;
    const sd = product.primaryAxes.smooth_detailed;
    const ec = product.primaryAxes.elastic_controlled;
    if (wb === 'warm') qualities.push('warmth');
    if (wb === 'bright') qualities.push('clarity and energy');
    if (sd === 'smooth') qualities.push('smooth listening');
    if (sd === 'detailed') qualities.push('detail retrieval');
    if (ec === 'elastic') qualities.push('dynamics and punch');
    if (ec === 'controlled') qualities.push('composure and control');
    if (qualities.length >= 2) return `Best for ${qualities[0]} and ${qualities[1]}`;
    if (qualities.length === 1) return `Best for ${qualities[0]}`;
  }

  // Priority 4: description fallback
  return `${product.description.split('.')[0]}.`;
}

// ── Enhanced card field builders ────────────────────────

/** Archetype → sonic direction label mapping. */
const SONIC_DIRECTION_LABELS: Record<string, string> = {
  flow_organic: 'flow-oriented',
  precision_explicit: 'precision-focused',
  rhythmic_propulsive: 'rhythm-driven',
  tonal_saturated: 'tonally rich',
  spatial_holographic: 'spatially precise',
};

/** Build a short sonic direction label from the product's primary archetype. */
function buildSonicDirectionLabel(product: Product): string | undefined {
  const primary = product.archetypes?.primary;
  if (primary) return SONIC_DIRECTION_LABELS[primary];
  // Fallback: infer from topology
  const topo = product.topology;
  if (!topo) return undefined;
  const philo = TOPOLOGY_PHILOSOPHY[topo];
  return philo ? philo.emphasis.split(',')[0].trim() : undefined;
}

/** Build a human-readable product type label. */
function buildProductTypeLabel(product: Product): string | undefined {
  const SUBCAT_LABELS: Record<string, string> = {
    'integrated-amp': 'Integrated Amplifier',
    'power-amp': 'Power Amplifier',
    'preamp': 'Preamplifier',
    'headphone-amp': 'Headphone Amplifier',
    'standalone-dac': 'DAC',
    'dac-preamp': 'DAC / Preamp',
    'dac-amp': 'DAC / Headphone Amp',
    'floorstanding': 'Floorstanding Speaker',
    'standmount': 'Standmount Speaker',
    'full-range': 'Full-Range Speaker',
  };
  if (product.subcategory) return SUBCAT_LABELS[product.subcategory];
  const CAT_LABELS: Record<string, string> = {
    dac: 'DAC', amplifier: 'Amplifier', speaker: 'Speaker',
    headphone: 'Headphone', streamer: 'Streamer', turntable: 'Turntable',
  };
  return CAT_LABELS[product.category];
}

/** Extract used-market URL from retailer links (HiFi Shark, Audiogon, US Audio Mart, eBay). */
function extractUsedMarketUrl(product: Product): string | undefined {
  const usedPatterns = ['hifishark', 'audiogon', 'usaudiomart', 'ebay', 'reverb'];
  for (const link of product.retailer_links) {
    if (usedPatterns.some((p) => link.url.toLowerCase().includes(p))) {
      return link.url;
    }
  }
  return undefined;
}

// ── Used-market discovery sources ────────────────────────
//
// Generates search URLs for common enthusiast marketplaces.
// Shown on discontinued, vintage, and used-market products
// to help listeners find gear in the secondary market.

export interface UsedMarketSource {
  name: string;
  url: string;
  /** Geographic focus. */
  region: 'global' | 'north-america' | 'europe';
}

const USED_MARKET_SITES: Array<{ name: string; baseUrl: string; region: 'global' | 'north-america' | 'europe'; buildSearch: (query: string) => string }> = [
  { name: 'HiFi Shark', baseUrl: 'https://www.hifishark.com', region: 'global', buildSearch: (q) => `https://www.hifishark.com/search?q=${encodeURIComponent(q)}` },
  { name: 'Audiogon', baseUrl: 'https://www.audiogon.com', region: 'north-america', buildSearch: (q) => `https://www.audiogon.com/listings?query=${encodeURIComponent(q)}` },
  { name: 'US Audio Mart', baseUrl: 'https://www.usaudiomart.com', region: 'north-america', buildSearch: (q) => `https://www.usaudiomart.com/classifieds?query=${encodeURIComponent(q)}` },
  { name: 'eBay', baseUrl: 'https://www.ebay.com', region: 'global', buildSearch: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}` },
];

/**
 * Build used-market discovery links for a product.
 * Returns sources when the product is discontinued, vintage, or typically found used.
 * Limited to 2 sources: one global aggregator + one regional marketplace.
 */
export function buildUsedMarketSources(product: Product): UsedMarketSource[] | undefined {
  const showUsed = product.availability === 'discontinued'
    || product.availability === 'vintage'
    || product.typicalMarket === 'used'
    || product.typicalMarket === 'both';

  if (!showUsed) return undefined;

  const searchQuery = `${product.brand} ${product.name}`;
  const allSources = USED_MARKET_SITES.map((site) => ({
    name: site.name,
    url: site.buildSearch(searchQuery),
    region: site.region,
  }));

  // Limit to 2: prefer one global aggregator + one regional marketplace
  const global = allSources.find((s) => s.region === 'global');
  const regional = allSources.find((s) => s.region !== 'global');
  const selected = [global, regional].filter(Boolean) as UsedMarketSource[];
  return selected.length > 0 ? selected.slice(0, 2) : undefined;
}

// ── System delta reasoning ───────────────────────────────
//
// Predicts what sonic change a product would produce in the user's
// current system. Uses product tendency profiles + system character.
//
//   system tendencies × product tendencies = predicted sonic delta
//
// Does NOT change ranking. Only generates clearer explanations.

/** Trait labels for human-readable delta output. */
const TRAIT_LABELS: Record<string, string> = {
  flow: 'musical flow',
  tonal_density: 'tonal density',
  clarity: 'transparency',
  dynamics: 'dynamic range',
  composure: 'composure',
  texture: 'textural detail',
  warmth: 'warmth',
  speed: 'transient speed',
  elasticity: 'rhythmic elasticity',
  spatial_precision: 'spatial precision',
};

/** System character → traits it already has plenty of. */
const SYSTEM_CHARACTER_TRAITS: Record<string, { saturated: string[]; deficient: string[] }> = {
  bright: { saturated: ['clarity', 'speed'], deficient: ['warmth', 'tonal_density', 'flow'] },
  warm: { saturated: ['warmth', 'tonal_density'], deficient: ['clarity', 'speed', 'dynamics'] },
  neutral: { saturated: [], deficient: [] },
  unknown: { saturated: [], deficient: [] },
};

interface SystemDeltaResult {
  whyFitsSystem?: string;
  likelyImprovements?: string[];
  tradeOffs?: string[];
}

/**
 * Build a system delta explanation for a product within the current system.
 *
 * Deterministic. Uses:
 *   - Product tendency profile (emphasized / less_emphasized traits)
 *   - System character (bright / warm / neutral)
 *   - Architecture tendency map (for amplifier-specific reasoning)
 *   - User trait directions (what the listener wants more/less of)
 */
function buildSystemDelta(
  product: Product,
  systemProfile: SystemProfile,
  userTraits: Record<string, SignalDirection>,
): SystemDeltaResult | undefined {
  // Need at least a product tendency profile or system character to reason about delta
  const profile = product.tendencyProfile;
  if (!profile && systemProfile.systemCharacter === 'unknown' && Object.keys(userTraits).length === 0) {
    return undefined;
  }

  const systemChar = SYSTEM_CHARACTER_TRAITS[systemProfile.systemCharacter] ?? SYSTEM_CHARACTER_TRAITS['unknown'];
  const improvements: string[] = [];
  const tradeoffs: string[] = [];

  // Collect product's emphasized and de-emphasized traits
  const productStrengths = new Set<string>();
  const productWeaknesses = new Set<string>();

  if (profile) {
    for (const t of profile.tendencies) {
      if (t.level === 'emphasized') productStrengths.add(t.trait);
      else if (t.level === 'less_emphasized') productWeaknesses.add(t.trait);
    }
  }

  // Supplement with architecture tendency map for amplifiers
  const archTendency = findArchitectureTendency(product);
  if (archTendency) {
    for (const s of archTendency.strengths) productStrengths.add(s);
    for (const w of archTendency.weaknesses) productWeaknesses.add(w);
  }

  if (productStrengths.size === 0 && productWeaknesses.size === 0) return undefined;

  // ── Compute improvements: product strengths that address system deficiencies
  // or align with user desires ─────────────────────────────────────────────

  for (const trait of productStrengths) {
    const label = TRAIT_LABELS[trait];
    if (!label) continue;

    // Product strength fills a system gap
    if (systemChar.deficient.includes(trait)) {
      improvements.push(`greater ${label}`);
      continue;
    }

    // Product strength matches user desire
    if (userTraits[trait] === 'up') {
      improvements.push(`enhanced ${label}`);
      continue;
    }

    // Product strength doesn't conflict with system saturation
    if (!systemChar.saturated.includes(trait)) {
      // Only include if we don't already have enough
      if (improvements.length < 3) {
        improvements.push(`added ${label}`);
      }
    }
  }

  // ── Compute trade-offs: product weaknesses, or product strengths that
  // compound system saturation ─────────────────────────────────────────

  for (const trait of productWeaknesses) {
    const label = TRAIT_LABELS[trait];
    if (!label) continue;

    // Product weakness in an area the user wants more of
    if (userTraits[trait] === 'up') {
      tradeoffs.push(`may not improve ${label}`);
      continue;
    }

    // Product weakness in an area the system already lacks
    if (systemChar.deficient.includes(trait)) {
      tradeoffs.push(`doesn't address ${label} deficit`);
      continue;
    }

    // General weakness
    if (tradeoffs.length < 2) {
      tradeoffs.push(`less ${label}`);
    }
  }

  // Check for compounding — product emphasizes what system already saturates
  for (const trait of productStrengths) {
    const label = TRAIT_LABELS[trait];
    if (!label) continue;
    if (systemChar.saturated.includes(trait) && tradeoffs.length < 2) {
      tradeoffs.push(`may compound existing ${label}`);
    }
  }

  if (improvements.length === 0 && tradeoffs.length === 0) return undefined;

  // ── Build system fit sentence ────────────────────────────────────────
  let whyFitsSystem: string | undefined;
  const sysLabel = systemProfile.systemCharacter !== 'unknown'
    ? systemProfile.systemCharacter
    : undefined;

  if (sysLabel && improvements.length > 0) {
    const topImprovement = improvements[0].replace(/^(greater|enhanced|added) /, '');
    whyFitsSystem = `Your current system leans ${sysLabel}. This component would likely introduce ${topImprovement} while preserving what the system already does well.`;
  } else if (improvements.length > 0) {
    const topImprovement = improvements[0].replace(/^(greater|enhanced|added) /, '');
    whyFitsSystem = `Based on this product's design tendencies, it would likely bring ${topImprovement} to your system.`;
  }

  return {
    whyFitsSystem,
    likelyImprovements: improvements.length > 0 ? improvements.slice(0, 4) : undefined,
    tradeOffs: tradeoffs.length > 0 ? tradeoffs.slice(0, 3) : undefined,
  };
}

/**
 * Find the architecture tendency entry for a product by matching
 * its architecture string against known patterns.
 */
function findArchitectureTendency(product: Product): ArchitectureTendency | undefined {
  const arch = product.architecture.toLowerCase();
  for (const [key, tendency] of Object.entries(AMPLIFIER_ARCHITECTURE_TENDENCIES)) {
    if (arch.includes(key.toLowerCase())) return tendency;
  }
  return undefined;
}

// ── Anchor justification (anchor product only) ─────────
//
// Builds a 2–3 sentence expert rationale for the first recommendation.
// Fuses symptom / preference / system context with product character
// and includes one explicit trade-off.
//
// Fallback hierarchy:
//   1. Full context: symptom + system + product → system-effect sentence
//   2. Partial context: preference + product → taste-alignment sentence
//   3. Minimal context: conditional phrasing → "If your system leans X…"
//
// Does NOT change ranking, routing, or selection. Output layer only.

/** Symptom keys → human-readable descriptions for anchor justification. */
const SYMPTOM_DESCRIPTIONS: Record<string, string> = {
  brightness_harshness: 'bright or harsh',
  thinness: 'thin or lacking body',
  bass_bloom: 'bass-heavy or boomy',
  flat_lifeless: 'flat or lifeless',
  congestion_muddiness: 'congested or muddy',
  fatigue: 'fatiguing over time',
  clinical_sterile: 'clinical or sterile',
  too_warm: 'overly warm',
  closed_boxy: 'closed-in or boxy',
  too_polite: 'polite but uninvolving',
  too_forward: 'too forward or aggressive',
  overdamped: 'overdamped or mechanical',
  narrow_soundstage: 'narrow or flat in staging',
  imbalanced: 'sonically off-balance',
  regression: 'worse than expected',
  dynamic_punchy: 'dynamically alive',
};

/**
 * Build anchor-only justification for the primary recommendation.
 *
 * Deterministic. Draws on:
 *   - Product tendency profile (strengths / weaknesses)
 *   - System character (bright / warm / neutral)
 *   - User symptom signals (from signal extraction)
 *   - Taste / archetype inference (from reasoning engine)
 *   - Pre-computed system delta (improvements + trade-offs)
 *
 * Returns undefined when no meaningful justification can be built
 * (better to show nothing than generic filler).
 */
function buildAnchorJustification(
  product: Product,
  systemProfile: SystemProfile,
  userTraits: Record<string, SignalDirection>,
  reasoning?: ReasoningResult,
  delta?: SystemDeltaResult,
  symptoms?: string[],
): string | undefined {
  // ── Gather product strengths and weaknesses ──────────
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (product.tendencyProfile) {
    for (const t of product.tendencyProfile.tendencies) {
      const label = TRAIT_LABELS[t.trait];
      if (!label) continue;
      if (t.level === 'emphasized') strengths.push(label);
      else if (t.level === 'less_emphasized') weaknesses.push(label);
    }
  }

  // Supplement from architecture tendency map
  const archTendency = findArchitectureTendency(product);
  if (archTendency) {
    for (const s of archTendency.strengths) {
      const label = TRAIT_LABELS[s];
      if (label && !strengths.includes(label)) strengths.push(label);
    }
    for (const w of archTendency.weaknesses) {
      const label = TRAIT_LABELS[w];
      if (label && !weaknesses.includes(label)) weaknesses.push(label);
    }
  }

  if (strengths.length === 0) return undefined;

  // ── Build trade-off sentence (required) ──────────────
  // Prefer delta trade-offs (system-aware), fall back to product weaknesses
  let tradeOff: string | undefined;
  if (delta?.tradeOffs && delta.tradeOffs.length > 0) {
    tradeOff = delta.tradeOffs[0];
  } else if (weaknesses.length > 0) {
    tradeOff = `less ${weaknesses[0]}`;
  }

  // No trade-off derivable — can't meet the hard requirement
  if (!tradeOff) return undefined;

  const tradeOffSentence = `You give up some ${tradeOff} for more ${strengths.slice(0, 2).join(' and ')}.`;

  // ── Detect context tier ──────────────────────────────
  const sysChar = systemProfile.systemCharacter;
  const hasSystem = sysChar !== 'unknown';
  const symptomList = symptoms?.filter((s) => SYMPTOM_DESCRIPTIONS[s]) ?? [];
  const hasSymptom = symptomList.length > 0;
  const tasteLabel = reasoning?.taste.tasteLabel;
  const archetype = reasoning?.taste.archetype;
  const hasTaste = !!(tasteLabel || archetype);

  // ── Tier 1: Full context (symptom + system + product) ──
  if (hasSymptom && hasSystem) {
    const symptomDesc = SYMPTOM_DESCRIPTIONS[symptomList[0]];
    const topStrength = strengths[0];

    // Use delta's system-fit sentence when available, otherwise build our own
    const systemEffect = delta?.likelyImprovements && delta.likelyImprovements.length > 0
      ? `adding ${delta.likelyImprovements.slice(0, 2).join(' and ')}`
      : `adding ${topStrength}`;

    return `In a system that sounds ${symptomDesc}, this moves it toward ${systemEffect.replace(/^adding /, '')}. ${tradeOffSentence}`;
  }

  // Symptom without system — still use symptom framing
  if (hasSymptom) {
    const symptomDesc = SYMPTOM_DESCRIPTIONS[symptomList[0]];
    const topStrength = strengths[0];
    return `You're describing something ${symptomDesc}. This moves the system toward ${topStrength}. ${tradeOffSentence}`;
  }

  // ── Tier 2: Partial context (taste/preference + product) ──
  if (hasTaste && hasSystem) {
    const preference = tasteLabel ?? 'your stated priorities';
    const topStrength = strengths[0];
    return `In a system that leans ${sysChar}, your preference for ${preference.toLowerCase()} points toward more ${topStrength} — this moves it there. ${tradeOffSentence}`;
  }

  if (hasTaste) {
    const preference = tasteLabel ?? 'your stated priorities';
    const topStrength = strengths[0];
    return `Your preference for ${preference.toLowerCase()} points toward more ${topStrength}. If your system needs that, this is a clean way to get it. ${tradeOffSentence}`;
  }

  // ── Tier 3: Minimal context (conditional phrasing) ──
  if (hasSystem) {
    const topStrength = strengths[0];
    return `In a system that leans ${sysChar}, this shifts it toward ${topStrength}. ${tradeOffSentence}`;
  }

  // No system, no taste, no symptom — use conditional framing
  if (strengths.length >= 2) {
    return `If your system is leaning away from ${strengths[0]}, this pulls it back while adding ${strengths[1]}. ${tradeOffSentence}`;
  }

  return `If your system needs more ${strengths[0]}, this gets you there. ${tradeOffSentence}`;
}

/**
 * Build a brief sonic character description for a product.
 *
 * Follows the advisory assessment structure: what this component
 * fundamentally sounds like, independent of listener preference.
 *
 * Priority: curated character tendencies → qualitative profile →
 * archetype → description fallback.
 */
function buildProductCharacter(product: Product): string {
  return simplifyFitLanguage(buildProductCharacterRaw(product));
}

/** Raw character string — before plain-language normalization. */
function buildProductCharacterRaw(product: Product): string {
  // Priority 1: curated character tendencies — the most authoritative source
  if (hasTendencies(product.tendencies)) {
    const top = selectDefaultTendencies(product.tendencies.character, 2);
    if (top.length > 0) {
      return top.map((t) => t.tendency).join('. ');
    }
  }

  // Priority 2: qualitative tendency profile
  if (hasExplainableProfile(product.tendencyProfile)) {
    const emphasized = getEmphasizedTraits(product.tendencyProfile);
    const lessEmph = getLessEmphasizedTraits(product.tendencyProfile);
    if (emphasized.length > 0) {
      const emph = emphasized.slice(0, 2).join(' and ');
      const less = lessEmph.length > 0 ? ` Less emphasis on ${lessEmph[0]}.` : '';
      return `Leans toward ${emph}.${less}`;
    }
  }

  // Priority 3: design archetype
  const arch = resolveArchetype(product.architecture);
  if (arch) {
    const charDesc = archetypeFitNote(arch);
    if (charDesc) return `${product.architecture} design — ${charDesc}`;
  }

  // Priority 4: first sentence of description
  return product.description.split('.')[0] + '.';
}

/**
 * Generate an optional caution note from the product's notes field
 * and its risk flags / trait values.
 */
function buildCaution(product: Product): string | undefined {
  const parts: string[] = [];

  if (product.notes) parts.push(product.notes);

  // Check for risk flags (prefers tendencyProfile, falls back to legacy)
  if (hasRisk(product.tendencyProfile, product.traits, 'glare_risk')) {
    parts.push('May introduce glare or edge in systems that are already bright.');
  }
  if (hasRisk(product.tendencyProfile, product.traits, 'fatigue_risk')) {
    parts.push('May contribute to listening fatigue in long sessions.');
  }

  // Placement sensitivity warning for speakers
  if (product.placementSensitivity && product.placementSensitivity.level !== 'low') {
    const ps = product.placementSensitivity;
    if (ps.level === 'high') {
      parts.push(`Placement-sensitive: ${ps.notes}`);
    } else {
      parts.push(`Moderately placement-sensitive: ${ps.notes}`);
    }
  }

  // Fallback: extract trade-off from curated tendencies if no other caution exists.
  // This ensures every product card shows at least one trade-off, matching the
  // advisor standard of always presenting what you give up alongside what you gain.
  if (parts.length === 0 && product.tendencies?.tradeoffs && product.tendencies.tradeoffs.length > 0) {
    const t = product.tendencies.tradeoffs[0];
    if (t.cost) {
      parts.push(t.cost.charAt(0).toUpperCase() + t.cost.slice(1) + '.');
    }
  }

  return parts.length > 0 ? parts.join(' ') : undefined;
}

// ── "Why it stands out" — architecture & design highlights ──────

/** Human-readable architecture descriptions. */
const ARCHITECTURE_LABELS: Record<string, string> = {
  'r2r':                  'Discrete R2R ladder DAC',
  'delta-sigma':          'Delta-sigma chip implementation',
  'delta-sigma (ESS)':    'ESS Sabre chip implementation',
  'delta-sigma (AKM)':    'AKM-based conversion',
  'fpga':                 'Custom FPGA DAC architecture',
  'multibit':             'Multibit conversion design',
  'nos':                  'Non-oversampling (NOS) DAC',
  'class-a-solid-state':  'Pure Class A solid-state design',
  'class-ab-solid-state': 'Class AB solid-state design',
  'set':                  'Single-ended triode design',
  'push-pull-tube':       'Push-pull tube design',
  'class-d':              'Class D amplifier',
  'hybrid':               'Hybrid tube/solid-state design',
};

/**
 * Build "Why it stands out" feature bullets (2–3 items).
 *
 * Draws from architecture, topology philosophy, tendency profile,
 * primary axes, and fatigue assessment to explain the design's
 * distinguishing characteristics.
 */
function buildStandoutFeatures(product: Product): string[] {
  const features: string[] = [];

  // Bullet 1: Architecture identity
  const archLabel = ARCHITECTURE_LABELS[product.topology ?? '']
    ?? ARCHITECTURE_LABELS[product.architecture]
    ?? `${product.architecture} design`;
  features.push(archLabel);

  // Bullet 2: Key design emphasis from topology philosophy
  const topo = product.topology;
  if (topo && TOPOLOGY_PHILOSOPHY[topo]) {
    features.push(capitalizeFirst(TOPOLOGY_PHILOSOPHY[topo].emphasis));
  }

  // Bullet 3: Notable quality from tendency profile or fatigue assessment
  if (product.fatigueAssessment?.notes) {
    features.push(product.fatigueAssessment.notes);
  } else if (product.notes) {
    features.push(product.notes);
  }

  return features.slice(0, 3);
}

/**
 * Build "Sound profile" bullets (2–3 items).
 *
 * Uses curated character tendencies when available (richest source),
 * falling back to qualitative tendency profile, then primary axes.
 * Each bullet is a distinct sonic trait — not a verdict or fit note.
 */
function buildSoundProfile(product: Product): string[] {
  // Priority 1: curated character tendencies — the most authoritative source
  if (hasTendencies(product.tendencies)) {
    const selected = selectDefaultTendencies(product.tendencies.character, 3);
    if (selected.length > 0) {
      return selected.map((t) => capitalizeFirst(t.tendency));
    }
  }

  // Priority 2: qualitative tendency profile → readable bullets
  if (hasExplainableProfile(product.tendencyProfile)) {
    const bullets: string[] = [];
    const emphasized = getEmphasizedTraits(product.tendencyProfile);
    const present = product.tendencyProfile.tendencies
      .filter((t) => t.level === 'present')
      .map((t) => t.trait.replace(/_/g, ' '));
    const lessEmph = getLessEmphasizedTraits(product.tendencyProfile);

    for (const trait of emphasized) {
      bullets.push(`Strong ${trait}`);
    }
    for (const trait of present.slice(0, 2)) {
      bullets.push(`Good ${trait}`);
    }
    if (lessEmph.length > 0) {
      bullets.push(`Less emphasis on ${lessEmph.slice(0, 2).join(' and ')}`);
    }
    if (bullets.length > 0) return bullets.slice(0, 3);
  }

  // Priority 3: primary axis leanings
  if (product.primaryAxes) {
    const bullets: string[] = [];
    const AXIS_LABELS: Record<string, Record<string, string>> = {
      warm_bright:       { warm: 'Warm-leaning tonality', bright: 'Bright, energetic presentation', neutral: 'Tonally neutral' },
      smooth_detailed:   { smooth: 'Smooth, easy-going', detailed: 'Detail-forward and resolving', neutral: 'Balanced detail retrieval' },
      elastic_controlled:{ elastic: 'Dynamic and expressive', controlled: 'Controlled and composed', neutral: 'Even-handed dynamics' },
      scale_intimacy:    { scale: 'Large-scale, room-filling presentation', intimacy: 'Close, listener-focused presentation', neutral: 'Moderate spatial presentation' },
    };
    for (const [axis, leaning] of Object.entries(product.primaryAxes)) {
      const label = AXIS_LABELS[axis]?.[leaning];
      if (label && leaning !== 'neutral') bullets.push(label);
    }
    if (bullets.length > 0) return bullets.slice(0, 3);
  }

  // Fallback: split description
  const desc = product.description;
  if (desc) {
    return desc.split('.').map((s) => s.trim()).filter(Boolean).slice(0, 2);
  }

  return [];
}

/** Capitalize the first letter of a string. */
function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Select up to 3 product examples for the given category, scored
 * against user traits and budget. Returns empty array if no
 * catalog exists for the category or budget is unknown.
 */
/** Map profile trait keys to product trait keys for scoring alignment. */
const PROFILE_TO_PRODUCT_TRAIT: Record<ProfileTraitKey, string> = {
  flow: 'flow',
  clarity: 'clarity',
  rhythm: 'rhythm',
  tonal_density: 'tonal_density',
  spatial_depth: 'spatial_precision',
  dynamics: 'dynamics',
  warmth: 'warmth',
};

/**
 * Direction-trait mapping for the directional bonus.
 * Maps arrow quality names to product trait keys.
 * Kept intentionally small — the bonus is a nudge, not a replacement.
 */
const DIRECTION_TRAIT_MAP: Record<string, string> = {
  warmth: 'tonal_density',
  density: 'tonal_density',
  body: 'tonal_density',
  flow: 'flow',
  smoothness: 'composure',
  composure: 'composure',
  speed: 'speed',
  dynamics: 'dynamics',
  punch: 'dynamics',
  clarity: 'clarity',
  detail: 'clarity',
  soundstage: 'spatial_precision',
  air: 'openness',
};

/** Maximum directional bonus per product. Small and auditable. */
const DIRECTION_BONUS_CAP = 0.12;

function selectProductExamples(
  category: ShoppingCategory,
  userTraits: Record<string, SignalDirection>,
  budgetAmount: number | null,
  systemProfile: SystemProfile,
  dependencies: CategoryDependency[],
  tasteProfile?: UserTasteProfile,
  reasoning?: ReasoningResult,
  currentComponentNames?: string[],
  roomContext?: RoomContext,
  /** Product names the user has engaged with (mentioned, selected, or discussed). */
  engagedProductNames?: string[],
  /** Hard constraints (topology exclusion, availability) for filtering. */
  constraints?: HardConstraints,
  /** Semantic preferences from natural language ("big and powerful", etc.). */
  semanticPreferences?: SemanticPreferences,
  /** Accumulated listener profile for taste-based filtering. */
  listenerProfile?: ListenerProfile,
  /** Selection mode override — shifts anchor based on user intent. */
  selectionMode?: SelectionMode,
  /** Previous anchor info for mode-aware anchor selection. */
  previousAnchor?: PreviousAnchor | null,
  /** Product names shown in recent shopping turns (for anti-repetition). */
  recentProductNames?: string[],
  /** Brand constraint from user query (e.g., "denafrips" from "denafrips dacs under 1000"). */
  brandConstraint?: string,
  /** Extracted symptom keys for anchor justification (output layer only). */
  symptoms?: string[],
): ProductExample[] {
  // ── Turntable: illustrative examples with full card data ──
  if (category === 'turntable') {
    const phonoDep = dependencies.find((d) => d.id === 'phono_stage');
    const phonoAbsent = phonoDep?.status === 'absent';
    const selected = selectTurntableExamples(budgetAmount, phonoAbsent, 3);
    return selected.map((t) => ({
      name: t.name,
      brand: t.brand,
      price: t.price,
      priceCurrency: t.priceCurrency,
      character: buildProductCharacter(t),
      standoutFeatures: buildStandoutFeatures(t),
      soundProfile: buildSoundProfile(t),
      fitNote: buildFitNote(t, userTraits),
      sonicDirectionLabel: buildSonicDirectionLabel(t),
      manufacturerUrl: t.retailer_links?.[0]?.url,
      availability: t.availability,
      usedPriceRange: t.usedPriceRange,
    }));
  }

  // ── Headphone / IEM path ────────────────────────────
  // Headphones use a dedicated selection path because the catalog
  // includes portable-use metadata that supplements trait scoring.
  if (category === 'headphone') {
    return selectHeadphoneExamples(userTraits, budgetAmount, systemProfile, tasteProfile, reasoning);
  }

  // ── Scored catalog path (DAC, speaker) ─────────────
  // Select the product catalog for the category. Categories without
  // a catalog return empty — the builder still provides directional guidance.
  let catalog: Product[];
  switch (category) {
    case 'dac': catalog = DAC_PRODUCTS; break;
    case 'speaker': catalog = SPEAKER_PRODUCTS; break;
    case 'amplifier': catalog = AMPLIFIER_PRODUCTS; break;
    default: return [];
  }

  const ranked = rankProducts(catalog, userTraits, budgetAmount, systemProfile, constraints, listenerProfile);

  // Apply taste profile bonus — small boost for products aligned with stored taste
  if (tasteProfile && tasteProfile.confidence > 0.2) {
    const topProfileTraits = topTraits(tasteProfile, 2);
    const profileWeight = tasteProfile.confidence * 0.15;

    for (const entry of ranked) {
      let bonus = 0;
      for (const pt of topProfileTraits) {
        const productTraitKey = PROFILE_TO_PRODUCT_TRAIT[pt.key];
        const productTraitValue = resolveTraitValue(entry.product.tendencyProfile, entry.product.traits, productTraitKey);
        bonus += productTraitValue * pt.value * profileWeight;
      }
      entry.score += bonus;
    }
    // Re-sort after bonus
    ranked.sort((a, b) => b.score - a.score);
  }

  // Directional bonus — small nudge toward products aligned with the
  // synthesized recommendation direction. Capped at DIRECTION_BONUS_CAP.
  // This biases existing scoring; it does not replace it.
  if (reasoning && reasoning.direction.arrows.length > 0) {
    const arrows = reasoning.direction.arrows;
    const perArrow = DIRECTION_BONUS_CAP / Math.max(arrows.length, 1);

    for (const entry of ranked) {
      let bonus = 0;
      for (const arrow of arrows) {
        const traitKey = DIRECTION_TRAIT_MAP[arrow.quality];
        if (!traitKey) continue;
        const productValue = resolveTraitValue(
          entry.product.tendencyProfile, entry.product.traits, traitKey,
        );
        // Only boost in the desired direction
        if (arrow.direction === 'up' && productValue > 0.5) {
          bonus += (productValue - 0.5) * perArrow;
        } else if (arrow.direction === 'down' && productValue < 0.5) {
          bonus += (0.5 - productValue) * perArrow;
        }
      }
      entry.score += Math.min(bonus, DIRECTION_BONUS_CAP);
    }
    ranked.sort((a, b) => b.score - a.score);
  }

  // ── Room-context scoring ────────────────────────────
  // When room size is detected, materially adjust speaker ranking.
  // Large rooms need sensitivity, dynamics, scale, and cabinet size.
  // Small/desktop rooms need compact designs that work nearfield.
  // Bonuses are substantial (up to ±1.0) because room-speaker mismatch
  // is one of the most common real-world buying mistakes.
  // Only applies to speaker category — DACs and amps are room-agnostic.
  if (roomContext && category === 'speaker') {
    // Room-speaker mismatch is one of the most common real-world buying
    // mistakes. Penalties/bonuses must be STRONG (cap 2.0) to materially
    // shift ranking. A standmount should never rank first in a large room.
    const ROOM_BONUS_CAP = 2.0;
    for (const entry of ranked) {
      let bonus = 0;
      const p = entry.product;
      const pTraits = p.traits ?? {};
      const tp = p.tendencyProfile;
      const notes = (p.notes ?? '').toLowerCase();
      const desc = (p.description ?? '').toLowerCase();
      const sub = (p as unknown as Record<string, unknown>).subcategory as string | undefined;

      if (roomContext === 'large') {
        // ── Dynamics: high dynamics = essential for large rooms
        const dynamicsVal = resolveTraitValue(tp, pTraits, 'dynamics');
        if (dynamicsVal >= 0.7) bonus += 0.6;
        else if (dynamicsVal >= 0.5) bonus += 0.2;
        else if (dynamicsVal <= 0.4) bonus -= 0.8;

        // ── Floorstanding / larger cabinets: strong preference for large rooms
        if (sub === 'floorstanding') bonus += 0.5;
        else if (sub === 'standmount') bonus -= 0.8; // Strong penalty — standmounts don't fill large rooms

        // ── High-sensitivity / horn designs: ideal for large rooms
        const isHighSensitivity = notes.includes('high-efficiency')
          || desc.includes('high-efficiency')
          || desc.includes('high sensitivity')
          || p.topology === 'horn-loaded'
          || p.topology === 'high-efficiency'
          || p.architecture?.toLowerCase().includes('horn');
        if (isHighSensitivity) bonus += 0.4;

        // ── Penalize speakers explicitly described as small-room
        const isSmallScale = notes.includes('smaller rooms')
          || notes.includes('small room')
          || notes.includes('limited bass extension')
          || notes.includes('limited dynamic scale')
          || desc.includes('miniature')
          || desc.includes('small enclosure')
          || desc.includes('desktop')
          || desc.includes('compact')
          || notes.includes('nearfield')
          || desc.includes('nearfield');
        if (isSmallScale) bonus -= 1.2; // Very strong penalty — wrong product for this room

        // ── "Big scale" text signal boost
        const isBigScale = desc.includes('scale')
          || desc.includes('dynamic expression')
          || desc.includes('dynamic range')
          || notes.includes('large room')
          || notes.includes('larger room')
          || desc.includes('authority');
        if (isBigScale) bonus += 0.3;
      } else if (roomContext === 'small' || roomContext === 'nearfield' || roomContext === 'desktop') {
        // Small / nearfield: boost compact designs, penalize large-scale
        if (sub === 'standmount') bonus += 0.5;
        else if (sub === 'floorstanding') bonus -= 0.6;

        const isCompact = notes.includes('smaller rooms')
          || notes.includes('small room')
          || desc.includes('small')
          || desc.includes('miniature')
          || desc.includes('nearfield')
          || desc.includes('compact');
        if (isCompact) bonus += 0.4;

        const dynamicsVal = resolveTraitValue(tp, pTraits, 'dynamics');
        if (dynamicsVal >= 0.9) bonus -= 0.3;
      }

      entry.score += Math.max(-ROOM_BONUS_CAP, Math.min(bonus, ROOM_BONUS_CAP));
    }
    ranked.sort((a, b) => b.score - a.score);
  }

  // ── Semantic preference scoring ────────────────────────
  // When natural language descriptors like "big and powerful" are detected,
  // apply weighted scoring adjustments to shift ranking meaningfully.
  // These are soft boosts, not hard filters — capped at ±1.5.
  if (semanticPreferences && semanticPreferences.weights.length > 0) {
    const SEMANTIC_BONUS_CAP = 1.5;
    for (const entry of ranked) {
      let bonus = 0;
      const p = entry.product;
      const pTraits = p.traits ?? {};
      const tp = p.tendencyProfile;

      for (const { trait, weight } of semanticPreferences.weights) {
        const productValue = resolveTraitValue(tp, pTraits, trait);
        // Product trait value (0–1) × semantic weight → bonus
        // High-trait products get full boost; low-trait products get nothing
        if (productValue >= 0.7) bonus += weight;
        else if (productValue >= 0.4) bonus += weight * 0.5;
        else if (productValue <= 0.0) bonus -= weight * 0.3;
      }

      entry.score += Math.max(-SEMANTIC_BONUS_CAP, Math.min(bonus, SEMANTIC_BONUS_CAP));
    }
    ranked.sort((a, b) => b.score - a.score);
  }

  // ── Scale preference scoring (amplifiers) ────────────
  // "Big and powerful" should boost high-power amps; "intimate" should
  // boost low-power designs. This complements room-context scoring for speakers.
  if (semanticPreferences && category === 'amplifier') {
    const SCALE_BONUS = 0.6;
    for (const entry of ranked) {
      const p = entry.product;
      const pTraits = p.traits ?? {};
      const tp = p.tendencyProfile;
      const dynamicsVal = resolveTraitValue(tp, pTraits, 'dynamics');
      const composureVal = resolveTraitValue(tp, pTraits, 'composure');

      if (semanticPreferences.wantsBigScale || semanticPreferences.energyLevel === 'high') {
        // Boost high-power, high-dynamics amps
        if (dynamicsVal >= 0.7 && composureVal >= 0.5) entry.score += SCALE_BONUS;
        else if (dynamicsVal >= 0.7) entry.score += SCALE_BONUS * 0.6;
        // Penalize low-power amps
        if (dynamicsVal <= 0.4) entry.score -= SCALE_BONUS * 0.5;
      }

      if (semanticPreferences.wantsSmallScale || semanticPreferences.energyLevel === 'low') {
        // Boost refined, low-power designs
        const flowVal = resolveTraitValue(tp, pTraits, 'flow');
        const textureVal = resolveTraitValue(tp, pTraits, 'texture');
        if (flowVal >= 0.7 || textureVal >= 0.7) entry.score += SCALE_BONUS * 0.5;
        // Don't penalize high-power amps for small scale — they still work
      }
    }
    ranked.sort((a, b) => b.score - a.score);
  }

  // ── Energy-level scoring for speakers ────────────────
  // High-energy music (rock, metal) needs speakers with dynamics and speed.
  // Low-energy music (jazz, classical) benefits from texture and flow.
  if (semanticPreferences && category === 'speaker' && semanticPreferences.energyLevel) {
    const ENERGY_BONUS = 0.4;
    for (const entry of ranked) {
      const p = entry.product;
      const pTraits = p.traits ?? {};
      const tp = p.tendencyProfile;

      if (semanticPreferences.energyLevel === 'high') {
        const dynamicsVal = resolveTraitValue(tp, pTraits, 'dynamics');
        const speedVal = resolveTraitValue(tp, pTraits, 'speed');
        if (dynamicsVal >= 0.7) entry.score += ENERGY_BONUS;
        if (speedVal >= 0.7) entry.score += ENERGY_BONUS * 0.5;
      } else if (semanticPreferences.energyLevel === 'low') {
        const flowVal = resolveTraitValue(tp, pTraits, 'flow');
        const textureVal = resolveTraitValue(tp, pTraits, 'texture');
        if (flowVal >= 0.7) entry.score += ENERGY_BONUS;
        if (textureVal >= 0.7) entry.score += ENERGY_BONUS * 0.5;
      }
    }
    ranked.sort((a, b) => b.score - a.score);
  }

  // ── Esoteric product penalty in mainstream flows ──────
  // When the user is in a practical shopping flow (budget stated, no explicit
  // signal for niche/boutique interest), penalize esoteric products so that
  // commercially available, widely reviewed, non-niche designs rank higher.
  // This prevents products like Yamamoto from appearing in "van halen + $5000"
  // flows where the user expects mainstream-accessible recommendations.
  if (budgetAmount !== null) {
    const ESOTERIC_PENALTY = 0.5;
    // Check if user explicitly wants boutique/niche gear
    const userWantsNiche = semanticPreferences
      && (semanticPreferences.weights.some((w) => w.trait === 'texture' && w.weight > 0.3)
        || semanticPreferences.weights.some((w) => w.trait === 'spatial_precision' && w.weight > 0.3));
    if (!userWantsNiche) {
      for (const entry of ranked) {
        const scale = entry.product.brandScale;
        if (scale === 'boutique') {
          entry.score -= ESOTERIC_PENALTY;
        } else if (scale === 'luxury') {
          entry.score -= ESOTERIC_PENALTY * 0.6;
        }
        // Bonus for mainstream / established / specialist brands
        if (scale === 'mainstream' || scale === 'major') {
          entry.score += 0.2;
        } else if (scale === 'established' || scale === 'specialist') {
          entry.score += 0.1;
        }
      }
      ranked.sort((a, b) => b.score - a.score);
    }
  }

  // ── Engaged-product continuity (Task 5) ──────────────
  // When the user has mentioned or selected a specific product in earlier
  // turns, boost its score so it remains in the shortlist during refinement.
  // This prevents "Klipsch Heresy IV → large living room" from dropping
  // the Heresy IV from the recommendations.
  if (engagedProductNames && engagedProductNames.length > 0) {
    const ENGAGEMENT_BOOST = 0.25;
    const engagedLower = new Set(engagedProductNames.map((n) => n.toLowerCase()));

    for (const entry of ranked) {
      const productFull = `${entry.product.brand} ${entry.product.name}`.toLowerCase();
      const productName = entry.product.name.toLowerCase();
      const isEngaged = engagedLower.has(productFull)
        || engagedLower.has(productName)
        || [...engagedLower].some((en) => productFull.includes(en) || en.includes(productName));

      if (isEngaged) {
        entry.score += ENGAGEMENT_BOOST;
      }
    }
    ranked.sort((a, b) => b.score - a.score);
  }

  // ── Brand constraint boost ─────────────────────────
  // When the user explicitly asked about a brand (e.g., "denafrips dacs
  // under 1000" or "and the ares?"), strongly boost products from that
  // brand. Products slightly over budget (within 25%) get extra rescue
  // points to compensate for the zero budget score — the user explicitly
  // asked, so the system should show what they asked for.
  if (brandConstraint) {
    const BRAND_CONSTRAINT_BOOST = 0.6;
    const OVER_BUDGET_RESCUE = 1.0; // compensate for missing budget score
    const brandLower = brandConstraint.toLowerCase();
    const ceiling = budgetAmount ? budgetAmount * 1.25 : Infinity;
    let brandMatchCount = 0;
    for (const entry of ranked) {
      if (entry.product.brand.toLowerCase() === brandLower) {
        entry.score += BRAND_CONSTRAINT_BOOST;
        // Rescue over-budget products within the hard ceiling
        if (budgetAmount && entry.product.price > budgetAmount && entry.product.price <= ceiling) {
          entry.score += OVER_BUDGET_RESCUE;
          console.log('[brand-constraint] over-budget rescue: %s %s ($%d, budget $%d)',
            entry.product.brand, entry.product.name, entry.product.price, budgetAmount);
        }
        brandMatchCount++;
      }
    }
    if (brandMatchCount > 0) {
      ranked.sort((a, b) => b.score - a.score);
      console.log('[brand-constraint] boosted %d products from %s (+%s)',
        brandMatchCount, brandConstraint, BRAND_CONSTRAINT_BOOST);
    }
  }

  // ── Architecture diversity selection ────────────────
  // When taste signals are sparse (direct shortlist queries like "best DAC
  // under $2000"), enforce topology diversity so the shortlist represents
  // different design philosophies rather than returning multiple products
  // with the same conversion approach.
  //
  // Shortlist sizing: 2–3 products. Products serve as supporting evidence
  // for strategic directions, not an exhaustive catalog.
  //
  // No-budget queries use tiered selection (accessible / mid / stretch)
  // to avoid ultra-high-end outliers dominating an exploratory shortlist.
  //
  // CRITICAL: When budget is stated, ALWAYS use score-ranked selection.
  // The budget filter in rankProducts already constrains the price range,
  // and scoreBudgetFit rewards utilization. Sparse signals with a budget
  // must NOT trigger topology-diversity selection — that downgrades
  // product quality by selecting cheaper representatives per topology
  // instead of the best-scoring products within budget. This is especially
  // important on refinement turns where "large living room" adds use-case
  // context without new taste traits.
  const hasSparseSignals = Object.keys(userTraits).length < 2;

  // ── Sonic distance computation ────────────────────────
  // Converts primaryAxes to numeric values and computes Manhattan distance.
  // Used by "different" mode to ensure the anchor is a genuinely different
  // listening experience, not just a superficially different brand/philosophy.

  const LEANING_TO_N: Record<string, number> = {
    warm: -1, bright: 1, neutral: 0,
    smooth: -1, detailed: 1, balanced: 0,
    elastic: -1, controlled: 1,
    airy: -1, closed: 1, moderate: 0,
  };

  function axisN(axes: PrimaryAxisLeanings | undefined, axis: 'warm_bright' | 'smooth_detailed' | 'elastic_controlled' | 'airy_closed'): number {
    if (!axes) return 0;
    // Prefer numeric _n value when present (–2 to +2 ordinal scale)
    const nKey = `${axis}_n` as keyof PrimaryAxisLeanings;
    const nVal = axes[nKey];
    if (typeof nVal === 'number') return nVal;
    // Fall back to categorical label → numeric mapping
    const label = axes[axis];
    if (typeof label === 'string') return LEANING_TO_N[label] ?? 0;
    return 0;
  }

  const SONIC_AXES = ['warm_bright', 'smooth_detailed', 'elastic_controlled', 'airy_closed'] as const;

  /** Manhattan distance across all 4 sonic axes. Range: 0–16 (theoretical max with _n values). */
  function sonicDistance(a: { primaryAxes?: PrimaryAxisLeanings }, b: { primaryAxes?: PrimaryAxisLeanings }): number {
    let dist = 0;
    for (const axis of SONIC_AXES) {
      dist += Math.abs(axisN(a.primaryAxes, axis) - axisN(b.primaryAxes, axis));
    }
    return dist;
  }

  /** Minimum sonic distance for "different" mode anchor. Tunable. */
  const MIN_SONIC_DISTANCE = 3;
  /** Practical max distance (with categorical labels: 4 axes × 2 max per axis). */
  const MAX_DISTANCE_PRACTICAL = 8;
  /** Scoring weights for distance-ranked anchor selection. */
  const DISTANCE_WEIGHT = 2;
  const RANK_WEIGHT = 1.5;

  // ── Mode-aware pool construction ───────────────────────
  // Default: top 8 by score. Non-default modes: pre-balance the pool to ensure
  // mode-appropriate candidates exist BEFORE filtering. Without this, pools are
  // dominated by traditional products and mode filters return empty sets.
  let top: ScoredProduct[];

  if (selectionMode === 'less_traditional') {
    // Guarantee nonTraditional products in pool regardless of score ranking
    const nonTrad = ranked.filter((sp) => sp.product.marketType === 'nonTraditional');
    const other = ranked.filter((sp) => sp.product.marketType !== 'nonTraditional');
    top = [
      ...nonTrad.slice(0, 8),
      ...other.slice(0, 7),
    ];
    console.log('[pool-balance]', {
      mode: 'less_traditional',
      nonTraditionalCount: nonTrad.length,
      poolNonTraditional: Math.min(nonTrad.length, 8),
      poolOther: Math.min(other.length, 7),
      poolTotal: top.length,
    });
  } else if (selectionMode === 'different' && previousAnchor) {
    // Guarantee sonically distant products in pool — use actual axis distance,
    // not just philosophy/marketType tags which can be superficially different.
    const different = ranked.filter((sp) =>
      sp.product.brand.toLowerCase() !== previousAnchor.brand.toLowerCase()
      && sonicDistance(sp.product, previousAnchor) >= MIN_SONIC_DISTANCE,
    );
    const similar = ranked.filter((sp) => !different.includes(sp));
    top = [
      ...different.slice(0, 8),
      ...similar.slice(0, 7),
    ];
    console.log('[pool-balance]', {
      mode: 'different',
      differentCount: different.length,
      poolDifferent: Math.min(different.length, 8),
      poolSimilar: Math.min(similar.length, 7),
      poolTotal: top.length,
    });
  } else {
    // Default mode: standard pool
    const poolSize = 8;
    top = budgetAmount === null
      ? selectTieredExploratory(ranked)
      : hasSparseSignals
        ? selectDiverseByTopology(ranked, poolSize, budgetAmount)
        : ranked.slice(0, poolSize);
  }

  // ── Liked-brand over-budget injection (post-pool) ────────
  // When the user has explicitly liked a brand (e.g., "I like Denafrips") and
  // a budget is set, products from liked brands may be hard-filtered by
  // rankProducts' budget filter AND excluded from the pool by topology
  // diversity selection. Inject them directly into the pool so they appear
  // as "worth hearing" options. Score is set to pool median.
  if (budgetAmount && listenerProfile && listenerProfile.likedBrands.length > 0) {
    const likedSet = new Set(listenerProfile.likedBrands.map((b) => b.toLowerCase()));
    const ceiling = budgetAmount * 1.25;
    const poolIds = new Set(top.map((sp) => sp.product.id));
    const medianIdx = Math.floor(top.length / 2);
    const medianScore = top.length > 0 ? top[Math.min(medianIdx, top.length - 1)].score : 0;

    for (const product of catalog) {
      if (poolIds.has(product.id)) continue;
      if (!likedSet.has(product.brand.toLowerCase())) continue;
      if (product.price <= budgetAmount) continue; // would have survived rankProducts
      if (product.price > ceiling) continue; // too far over budget

      top.push({ product, score: medianScore });
      console.log('[liked-brand-inject] %s %s ($%d, score=%s) injected into pool — liked brand, within 25%% ceiling ($%d)',
        product.brand, product.name, product.price, medianScore.toFixed(2), ceiling);
    }
  }

  // Build lowercase set of current component names for matching
  const currentNames = new Set(
    (currentComponentNames ?? []).map((n) => n.toLowerCase()),
  );

  // ── Budget realism computation ──────────────────────
  // Classify each product's price realism relative to stated budget.
  function computeBudgetRealism(product: Product): ProductExample['budgetRealism'] {
    if (!budgetAmount) return undefined;
    // Retail price within budget → realistic new purchase
    if (product.price <= budgetAmount) return 'realistic_new';
    // Used price within budget → realistic used purchase
    if (product.usedPriceRange && product.usedPriceRange.high <= budgetAmount) return 'realistic_used';
    // Used price is a stretch (within 120% of budget)
    if (product.usedPriceRange && product.usedPriceRange.high <= budgetAmount * 1.2) return 'stretch_used';
    return 'above_budget';
  }

  // ── 4-option recommendation set builder ─────────────
  // Selects up to 4 products with distinct roles:
  //   anchor    — best-fit product
  //   close_alt — same philosophy, slightly different
  //   contrast  — different sonic direction
  //   wildcard  — non-traditional / high-character option
  // Deduplicates: no product appears in more than one role.
  // Returns the subset of ProductExamples that were assigned roles.

  /**
   * Diminishing returns on sonic distance above the "sweet spot" threshold.
   * Distance 0–5 maps linearly. Distance 6–8+ gets compressed so that
   * extreme-contrast products don't dominate over practical, well-ranked ones.
   *
   * Examples: 3→3, 5→5, 6→5.5, 7→5.75, 8→5.875
   */
  const DISTANCE_SWEET_SPOT = 5;
  function effectiveDistance(raw: number): number {
    if (raw <= DISTANCE_SWEET_SPOT) return raw;
    return DISTANCE_SWEET_SPOT + (raw - DISTANCE_SWEET_SPOT) * 0.5;
  }

  function buildRecommendationSet(
    examples: ProductExample[],
    profile?: ListenerProfile,
    selectionMode: SelectionMode = 'default',
    previousAnchor?: PreviousAnchor | null,
    recentProductNames?: string[],
    budgetCeiling?: number | null,
    /** Product category — used for subcategory-based anchor filtering. */
    productCategory?: ShoppingCategory,
    /** When true, vintage products are eligible as anchors (user explicitly requested vintage). */
    userRequestedVintage?: boolean,
    /** When true, separates (power-amp, preamp) are eligible as anchors. */
    userRequestedSeparates?: boolean,
    /** When true, SET topology products are eligible as anchors (user explicitly requested SET/triode). */
    userRequestedSET?: boolean,
  ): ProductExample[] {
    if (examples.length === 0) return [];

    // ── Helpers ──────────────────────────────────────────
    type Ranked = ProductExample & { _rank: number };
    const ranked: Ranked[] = examples.map((ex, i) => ({ ...ex, _rank: i }));
    const exKey = (ex: ProductExample) => `${ex.brand} ${ex.name}`;

    // ── Diversity history ────────────────────────────────
    const recentLower = (recentProductNames ?? []).map((n) => n.toLowerCase());
    const diversityHistory = {
      brands: new Set<string>(),
      philosophies: new Set<string>(),
      marketTypes: new Set<string>(),
    };
    for (const rn of recentLower) {
      const match = ranked.find((ex) => `${ex.brand} ${ex.name}`.toLowerCase() === rn || ex.name.toLowerCase() === rn);
      if (match) {
        diversityHistory.brands.add((match.brand ?? '').toLowerCase());
        if (match.philosophy) diversityHistory.philosophies.add(match.philosophy);
        if (match.marketType) diversityHistory.marketTypes.add(match.marketType);
      }
    }

    function diversityPenalty(p: Ranked): number {
      let penalty = 0;
      // Strong brand penalty — avoid showing the same brand repeatedly
      if (diversityHistory.brands.has((p.brand ?? '').toLowerCase())) penalty += 4;
      // Philosophy overlap — weaker but still meaningful
      if (p.philosophy && diversityHistory.philosophies.has(p.philosophy)) penalty += 2;
      // Market type overlap — weakest signal
      if (p.marketType && diversityHistory.marketTypes.has(p.marketType)) penalty += 1;
      return penalty;
    }

    /** For role filling (post-anchor): lowest (_rank + diversityPenalty). */
    function bestOf(candidates: Ranked[]): Ranked | undefined {
      if (candidates.length === 0) return undefined;
      return candidates.reduce((best, c) => {
        const cScore = c._rank + diversityPenalty(c);
        const bScore = best._rank + diversityPenalty(best);
        return cScore < bScore ? c : best;
      });
    }

    /** For anchor selection in non-default modes: raw rank only — no diversity penalty. */
    function bestByRank(candidates: Ranked[]): Ranked | undefined {
      if (candidates.length === 0) return undefined;
      return candidates.reduce((best, c) => c._rank < best._rank ? c : best);
    }

    const recentSet = new Set(recentLower);
    const isRecent = (ex: Ranked) => {
      const fn = `${ex.brand} ${ex.name}`.toLowerCase();
      return recentSet.has(fn) || recentSet.has(ex.name.toLowerCase());
    };

    const isPrevAnchor = (p: Ranked): boolean => {
      if (!previousAnchor) return false;
      const fn = `${p.brand} ${p.name}`.toLowerCase();
      const prevFn = `${previousAnchor.brand} ${previousAnchor.name}`.toLowerCase();
      return fn === prevFn || p.name.toLowerCase() === previousAnchor.name.toLowerCase();
    };

    // ── Debug: dump eligible products with metadata BEFORE any mode filtering ──
    console.log('[debug-products]', ranked.map((p) => ({
      name: `${p.brand} ${p.name}`,
      philosophy: p.philosophy ?? 'MISSING',
      marketType: p.marketType ?? 'MISSING',
    })));

    // ── Dislike filter ──────────────────────────────────
    let eligible = ranked;
    if (profile) {
      const dislikedBrands = new Set(profile.dislikedBrands.map((b) => b.toLowerCase()));
      const dislikedProducts = new Set(profile.dislikedProducts.map((p) => p.toLowerCase()));
      if (dislikedBrands.size > 0 || dislikedProducts.size > 0) {
        const filtered = eligible.filter((ex) => {
          if (dislikedBrands.has(ex.brand.toLowerCase())) return false;
          const fn = `${ex.brand} ${ex.name}`.toLowerCase();
          return !dislikedProducts.has(fn) && !dislikedProducts.has(ex.name.toLowerCase());
        });
        if (filtered.length > 0) eligible = filtered;
      }
    }

    // ── Anti-repetition ─────────────────────────────────
    if (recentSet.size > 0) {
      if (selectionMode !== 'default') {
        // Non-default modes: HARD exclude all recent products
        const hardFiltered = eligible.filter((ex) => !isRecent(ex));
        if (hardFiltered.length >= 2) {
          eligible = hardFiltered;
        }
      } else {
        // Default mode: soft — push recent to back
        const fresh = eligible.filter((ex) => !isRecent(ex));
        const stale = eligible.filter((ex) => isRecent(ex));
        if (fresh.length >= 2) {
          eligible = [...fresh, ...stale];
        }
      }
    }

    // ── Hard-exclude previous anchor from re-anchoring in ALL modes ──
    // Prevents over-convergence where the same product anchors every turn.
    if (previousAnchor) {
      const withoutPrev = eligible.filter((ex) => !isPrevAnchor(ex));
      if (withoutPrev.length >= 2) {
        eligible = withoutPrev;
      }
    }

    // ──────────────────────────────────────────────────────
    // ANCHOR ELIGIBILITY: filter impractical products from anchor pool.
    // Excluded products remain in `eligible` for contrast/wildcard roles.
    // Applies in ALL modes (default, different, less_traditional).
    // ──────────────────────────────────────────────────────
    let anchorEligible = eligible;
    {
      const excluded = { vintage: 0, separates: 0, set: 0 };

      anchorEligible = eligible.filter((p) => {
        // Rule 1: Exclude vintage unless user explicitly requested it
        if (!userRequestedVintage && p.availability === 'vintage') {
          excluded.vintage++;
          return false;
        }
        // Rule 2: Exclude separates (power-amp, headphone-amp) for amplifier category
        //         unless user explicitly requested separates
        if (
          !userRequestedSeparates
          && productCategory === 'amplifier'
          && p.catalogSubcategory
          && p.catalogSubcategory !== 'integrated-amp'
        ) {
          excluded.separates++;
          return false;
        }
        // Rule 3: Exclude SET topology from anchor unless user explicitly requested SET/triode
        if (!userRequestedSET && p.catalogTopology === 'set') {
          excluded.set++;
          return false;
        }
        return true;
      });

      if (excluded.vintage > 0 || excluded.separates > 0 || excluded.set > 0) {
        console.log('[anchor-filter] excluded:', {
          vintage: excluded.vintage,
          separates: excluded.separates,
          set: excluded.set,
          anchorPoolSize: anchorEligible.length,
          fullPoolSize: eligible.length,
        });
      }

      // Safety: if filter removed everything, fall back to full eligible
      if (anchorEligible.length === 0) {
        console.warn('[anchor-filter] all candidates excluded — falling back to full eligible pool');
        anchorEligible = eligible;
      }
    }

    // ──────────────────────────────────────────────────────
    // ANCHOR SELECTION: filter first, then select — NO BYPASS
    // ──────────────────────────────────────────────────────
    let anchor: Ranked | undefined;

    if (selectionMode === 'different' && previousAnchor) {
      console.log('[selection-mode]', {
        mode: 'different',
        previousAnchor: previousAnchor.name ?? null,
        previousAxes: previousAnchor.primaryAxes
          ? { wb: axisN(previousAnchor.primaryAxes, 'warm_bright'), sd: axisN(previousAnchor.primaryAxes, 'smooth_detailed'), ec: axisN(previousAnchor.primaryAxes, 'elastic_controlled'), ac: axisN(previousAnchor.primaryAxes, 'airy_closed') }
          : 'none',
      });

      // Step 1: Build mode pool — from anchor-eligible, exclude same brand
      let modePool = anchorEligible.filter((p) =>
        p.brand.toLowerCase() !== previousAnchor.brand.toLowerCase(),
      );

      // Compute distance for each candidate and log
      const withDistance = modePool.map((p) => {
        const dist = sonicDistance(p, previousAnchor);
        console.log('[distance]', {
          previous: previousAnchor.name,
          candidate: `${p.brand} ${p.name}`,
          distance: dist,
        });
        return { p, dist };
      });

      // Prefer products meeting MIN_SONIC_DISTANCE; keep all if none qualify
      const meetsThreshold = withDistance.filter((d) => d.dist >= MIN_SONIC_DISTANCE);

      console.log('[filter]', {
        mode: 'different',
        totalCandidates: modePool.length,
        meetingMinDistance: meetsThreshold.length,
        minDistance: MIN_SONIC_DISTANCE,
      });

      let scoredPool: { p: Ranked; dist: number }[];
      if (meetsThreshold.length > 0) {
        scoredPool = meetsThreshold;
      } else {
        // Fallback: expand to full ranked pool (drop recency filters)
        // but preserve anchor eligibility rules — no vintage/separates leak
        const isAnchorIneligible = (p: Ranked): boolean => {
          if (!userRequestedVintage && p.availability === 'vintage') return true;
          if (!userRequestedSeparates && productCategory === 'amplifier'
            && p.catalogSubcategory && p.catalogSubcategory !== 'integrated-amp') return true;
          return false;
        };
        const expanded = ranked
          .filter((p) =>
            !isPrevAnchor(p)
            && p.brand.toLowerCase() !== previousAnchor.brand.toLowerCase()
            && !isAnchorIneligible(p),
          )
          .map((p) => ({ p, dist: sonicDistance(p, previousAnchor) }));
        const expandedMeetsThreshold = expanded.filter((d) => d.dist >= MIN_SONIC_DISTANCE);
        scoredPool = expandedMeetsThreshold.length > 0 ? expandedMeetsThreshold : expanded;

        if (scoredPool.length > 0) {
          console.log('[filter]', { mode: 'different', expandedPool: true, remaining: scoredPool.length });
        }
      }

      // Step 2: Score by weighted combination of distance + rank + budget proximity
      // Higher distance = better (with diminishing returns above sweet spot)
      // Lower rank = better (rank 0 is best)
      // Budget proximity: products closer to budget center score higher
      const maxRank = Math.max(...scoredPool.map((d) => d.p._rank), 1);

      /** Budget proximity bonus: 0–2 points. Products within budget get full bonus;
       *  products at budget edges or outside get reduced/zero bonus.
       *  This prevents the system from anchoring on $400 vintage or $5K ceiling items
       *  when good mid-budget candidates exist. */
      const BUDGET_PROXIMITY_WEIGHT = 2;
      function budgetProximityBonus(p: ProductExample): number {
        if (!budgetCeiling || !p.price) return 0;
        // Use effective price (used-low if available, else retail)
        const effectivePrice = (p.usedPriceRange?.low ?? p.price);
        // Budget center is 60% of ceiling (sweet spot for most shoppers)
        const budgetCenter = budgetCeiling * 0.6;
        const maxDeviation = budgetCeiling; // normalize against full budget
        const deviation = Math.abs(effectivePrice - budgetCenter) / maxDeviation;
        // 1.0 at center, tapering to 0 at extremes
        return Math.max(0, 1 - deviation) * BUDGET_PROXIMITY_WEIGHT;
      }

      /** Practicality penalty: deprioritize products that are impractical for
       *  a typical system unless the user has explicitly signaled interest.
       *  SET amps (2–3W) get a heavy penalty — they can't drive most speakers.
       *  Vintage products get a lighter penalty — reliability/availability concerns. */
      const PRACTICALITY_PENALTY_SET = 4;
      const PRACTICALITY_PENALTY_VINTAGE = 1.5;
      function practicalityPenalty(p: ProductExample): number {
        let penalty = 0;
        if (p.catalogTopology === 'set') penalty += PRACTICALITY_PENALTY_SET;
        if (p.availability === 'vintage') penalty += PRACTICALITY_PENALTY_VINTAGE;
        return penalty;
      }

      function candidateScore(d: { p: Ranked; dist: number }): number {
        const distScore = effectiveDistance(d.dist) * DISTANCE_WEIGHT;
        const rankScore = (1 - d.p._rank / maxRank) * MAX_DISTANCE_PRACTICAL * RANK_WEIGHT;
        const budgetScore = budgetProximityBonus(d.p);
        const penalty = practicalityPenalty(d.p);
        return distScore + rankScore + budgetScore - penalty;
      }

      // Log top 5 candidates by score for debugging
      const scoredWithDetails = scoredPool.map((d) => ({
        ...d,
        score: candidateScore(d),
        breakdown: {
          dist: d.dist,
          effDist: effectiveDistance(d.dist),
          distScore: effectiveDistance(d.dist) * DISTANCE_WEIGHT,
          rankScore: (1 - d.p._rank / maxRank) * MAX_DISTANCE_PRACTICAL * RANK_WEIGHT,
          budgetBonus: budgetProximityBonus(d.p),
          practicPenalty: practicalityPenalty(d.p),
        },
      }));
      scoredWithDetails.sort((a, b) => b.score - a.score);

      console.log('[candidate-scores]', scoredWithDetails.slice(0, 5).map((d) => ({
        name: `${d.p.brand} ${d.p.name}`,
        score: Math.round(d.score * 100) / 100,
        ...d.breakdown,
      })));

      const bestByDistanceScore = scoredWithDetails.length > 0
        ? scoredWithDetails[0]
        : undefined;

      anchor = bestByDistanceScore?.p;

      // ── HARD ASSERTION — must throw ──
      if (!anchor) {
        console.error('[FATAL] different mode: no candidates found after distance scoring', {
          eligibleCount: eligible.length,
          rankedCount: ranked.length,
          previousAnchor: `${previousAnchor.brand} ${previousAnchor.name}`,
        });
        throw new Error('DIFFERENT MODE FAILED: no candidates after distance scoring');
      }

      const anchorDist = bestByDistanceScore!.dist;
      if (anchorDist < MIN_SONIC_DISTANCE) {
        console.warn('[distance-fallback] using max available contrast: distance=%d < threshold=%d', anchorDist, MIN_SONIC_DISTANCE);
      }

      console.log('[anchor-distance]', {
        selected: `${anchor.brand} ${anchor.name}`,
        distanceFromPrevious: anchorDist,
        axes: anchor.primaryAxes
          ? { wb: axisN(anchor.primaryAxes, 'warm_bright'), sd: axisN(anchor.primaryAxes, 'smooth_detailed'), ec: axisN(anchor.primaryAxes, 'elastic_controlled'), ac: axisN(anchor.primaryAxes, 'airy_closed') }
          : 'none',
      });
      console.log('[anchor]', {
        mode: 'different',
        name: anchor.name,
        philosophy: anchor.philosophy ?? null,
        marketType: anchor.marketType ?? null,
        reason: anchorDist >= MIN_SONIC_DISTANCE ? 'sonic_distance' : 'max_available_contrast',
      });

    } else if (selectionMode === 'less_traditional') {
      console.log('[selection-mode]', {
        mode: 'less_traditional',
        previousAnchor: previousAnchor?.name ?? null,
      });

      // Step 1: Build mode pool — from anchor-eligible, FILTER FIRST
      let modePool = anchorEligible.filter((p) => p.marketType === 'nonTraditional');

      console.log('[filter]', { mode: 'less_traditional', remaining: modePool.length });
      console.log('[modePool]', modePool.map((p) => ({
        name: `${p.brand} ${p.name}`,
        philosophy: p.philosophy,
        marketType: p.marketType,
      })));

      // Step 2: If empty — expand to ranked pool (preserve anchor eligibility), reapply filter
      if (modePool.length === 0) {
        const anchorSafe = (p: Ranked): boolean => {
          if (!userRequestedVintage && p.availability === 'vintage') return false;
          if (!userRequestedSeparates && productCategory === 'amplifier'
            && p.catalogSubcategory && p.catalogSubcategory !== 'integrated-amp') return false;
          return true;
        };
        modePool = ranked.filter((p) =>
          p.marketType === 'nonTraditional' && !isRecent(p) && anchorSafe(p),
        );
        // If STILL empty, drop recency but keep nonTraditional + anchor safety
        if (modePool.length === 0) {
          modePool = ranked.filter((p) => p.marketType === 'nonTraditional' && anchorSafe(p));
        }
        if (modePool.length > 0) {
          console.log('[filter]', { mode: 'less_traditional', expandedPool: true, remaining: modePool.length });
        }
      }

      // Step 3: Select AFTER filtering — raw rank, no diversity penalty
      anchor = bestByRank(modePool);

      // ── HARD ASSERTION — must throw ──
      if (!anchor) {
        console.error('[FATAL] less_traditional mode: no nonTraditional candidates found', {
          eligibleCount: eligible.length,
          rankedCount: ranked.length,
          eligibleMarketTypes: eligible.map((p) => `${p.brand} ${p.name}: ${p.marketType}`),
        });
        throw new Error('LESS_TRADITIONAL FAILED: no nonTraditional candidates in pool');
      }
      if (anchor.marketType !== 'nonTraditional') {
        console.error('[FATAL] less_traditional violation', {
          anchor: `${anchor.brand} ${anchor.name}`,
          marketType: anchor.marketType,
        });
        throw new Error('LESS_TRADITIONAL FAILED: anchor marketType is ' + anchor.marketType);
      }

      console.log('[anchor]', {
        mode: 'less_traditional',
        name: anchor.name,
        philosophy: anchor.philosophy ?? null,
        marketType: anchor.marketType ?? null,
      });

    } else {
      // Default mode: prefer liked-brand product as anchor when available.
      // The +1.5 scoring boost in rankProducts already pushes liked-brand products
      // toward the top, but diversity penalty or anti-repetition might push them
      // out of #1. This forces the best liked-brand product into the anchor slot
      // when it exists in the anchor-eligible pool.
      const likedBrands = profile?.likedBrands ?? [];
      if (likedBrands.length > 0) {
        const likedSet = new Set(likedBrands.map((b) => b.toLowerCase()));
        const likedCandidates = anchorEligible.filter((p) => likedSet.has(p.brand.toLowerCase()));
        if (likedCandidates.length > 0) {
          anchor = bestByRank(likedCandidates);
          console.log('[anchor-liked-brand] forced anchor from liked brand: %s %s (rank %d)',
            anchor!.brand, anchor!.name, anchor!._rank);
        }
      }
      // Fallback: best with diversity penalty (no liked-brand match or no profile)
      if (!anchor) {
        anchor = bestOf(anchorEligible) ?? anchorEligible[0];
      }
    }

    anchor.pickRole = 'anchor';
    const anchorPhilosophy = anchor.philosophy;
    const used = new Set<string>([exKey(anchor)]);

    const remaining = () => eligible.filter((ex) => !used.has(exKey(ex)));

    // ── Role assignment: filter → bestOf (score + diversity) ──
    // close_alt: low sonic distance from anchor (similar listening experience)
    // contrast: high sonic distance from anchor (different listening experience)
    // wildcard: nonTraditional OR max distance from anchor

    // Close alternative — low sonic distance from anchor (same sonic neighborhood)
    let closeAlt: Ranked | undefined;
    const closePool = remaining().filter((ex) => ex.philosophy === anchorPhilosophy);
    if (closePool.length > 0) {
      // Among same-philosophy candidates, pick the one with lowest distance (most similar)
      closeAlt = closePool.reduce((best, cur) => {
        const curDist = sonicDistance(cur, anchor);
        const bestDist = sonicDistance(best, anchor);
        return curDist < bestDist ? cur : (curDist === bestDist ? bestOf([best, cur])! : best);
      });
    }
    if (closeAlt) { closeAlt.pickRole = 'close_alt'; used.add(exKey(closeAlt)); }

    // Contrast — highest sonic distance from anchor (genuinely different listening experience)
    const contrastPool = remaining().filter((ex) => !!ex.philosophy && ex.philosophy !== anchorPhilosophy);
    let contrast: Ranked | undefined;
    if (contrastPool.length > 0) {
      contrast = contrastPool.reduce((best, cur) => {
        const curDist = sonicDistance(cur, anchor);
        const bestDist = sonicDistance(best, anchor);
        return curDist > bestDist ? cur : best;
      });
    }
    if (contrast) { contrast.pickRole = 'contrast'; used.add(exKey(contrast)); }

    // Wildcard — nonTraditional OR highest distance from anchor if no nonTraditional
    let wildcard: Ranked | undefined;
    const nonTradPool = remaining().filter((ex) => ex.marketType === 'nonTraditional');
    if (nonTradPool.length > 0) {
      // Among nonTraditional, prefer highest distance from anchor
      wildcard = nonTradPool.reduce((best, cur) => {
        const curDist = sonicDistance(cur, anchor);
        const bestDist = sonicDistance(best, anchor);
        return curDist > bestDist ? cur : best;
      });
    } else {
      // No nonTraditional available — pick highest distance from anchor
      const distPool = remaining();
      if (distPool.length > 0) {
        wildcard = distPool.reduce((best, cur) => {
          const curDist = sonicDistance(cur, anchor);
          const bestDist = sonicDistance(best, anchor);
          return curDist > bestDist ? cur : best;
        });
      }
    }
    if (wildcard) { wildcard.pickRole = 'wildcard'; used.add(exKey(wildcard)); }

    // ── Assemble result ─────────────────────────────────
    const result: ProductExample[] = [anchor];
    if (closeAlt) result.push(closeAlt);
    if (contrast) result.push(contrast);
    if (wildcard) result.push(wildcard);

    // Pad to minimum 3 — mode-aware: padding must respect constraints
    if (result.length < 3) {
      let padPool: Ranked[];
      if (selectionMode === 'less_traditional') {
        padPool = eligible.filter((ex) =>
          !used.has(exKey(ex)) && ex.marketType === 'nonTraditional',
        );
      } else if (selectionMode === 'different' && previousAnchor) {
        // Padding in different mode: prefer sonically distant products
        const distCandidates = eligible
          .filter((ex) => !used.has(exKey(ex)))
          .map((ex) => ({ ex, dist: sonicDistance(ex, previousAnchor) }))
          .sort((a, b) => b.dist - a.dist);
        padPool = distCandidates.map((d) => d.ex);
      } else {
        padPool = eligible.filter((ex) => !used.has(exKey(ex)));
      }
      // Never fall back to unrestricted pool — empty padding is acceptable
      const padding = padPool.slice(0, 4 - result.length);
      for (const ex of padding) {
        result.push(ex);
        used.add(exKey(ex));
      }
    }

    console.log('[role-set]', {
      mode: selectionMode,
      anchor: `${anchor.brand} ${anchor.name}`,
      closeAlt: closeAlt ? `${closeAlt.brand} ${closeAlt.name}` : null,
      contrast: contrast ? `${contrast.brand} ${contrast.name}` : null,
      wildcard: wildcard ? `${wildcard.brand} ${wildcard.name}` : null,
      total: result.length,
    });

    // ── Anchor justification (anchor product only) ──────
    // Compute expert rationale for the anchor. Uses existing product data,
    // system profile, user traits, and reasoning — output layer only.
    const anchorProduct = catalog.find(
      (p) => p.brand === anchor.brand && p.name === anchor.name,
    );
    if (anchorProduct) {
      const justification = buildAnchorJustification(
        anchorProduct, systemProfile, userTraits, reasoning,
        anchor.systemDelta, symptoms,
      );
      if (justification) {
        anchor.anchorJustification = justification;
      }
    }

    return result.map(({ _rank, ...rest }) => rest as ProductExample);
  }

  const results = top.map(({ product }) => {
    // Check if this product matches a current system component
    const fullName = `${product.brand} ${product.name}`.toLowerCase();
    const isCurrent = currentNames.has(fullName)
      || currentNames.has(product.name.toLowerCase())
      || [...currentNames].some((cn) => cn.includes(product.name.toLowerCase()) || fullName.includes(cn));

    return {
      name: product.name,
      brand: product.brand,
      price: product.price,
      priceCurrency: product.priceCurrency,
      character: buildProductCharacter(product),
      standoutFeatures: buildStandoutFeatures(product),
      soundProfile: buildSoundProfile(product),
      fitNote: buildFitNote(product, userTraits),
      caution: buildCaution(product),
      links: product.retailer_links.length > 0 ? product.retailer_links : undefined,
      sourceReferences: product.sourceReferences,
      // Enhanced card fields
      sonicDirectionLabel: buildSonicDirectionLabel(product),
      productType: buildProductTypeLabel(product),
      manufacturerUrl: product.retailer_links[0]?.url,
      usedMarketUrl: extractUsedMarketUrl(product),
      availability: product.availability,
      usedPriceRange: product.usedPriceRange,
      usedMarketSources: buildUsedMarketSources(product),
      systemDelta: buildSystemDelta(product, systemProfile, userTraits),
      // Catalog facts for LLM validation
      catalogArchitecture: product.architecture,
      catalogTopology: product.topology,
      catalogCountry: product.country,
      catalogBrandScale: product.brandScale,
      catalogSubcategory: (product as any).subcategory,
      // Flag when this is the user's current component
      isCurrentComponent: isCurrent || undefined,
      // Budget realism tier
      budgetRealism: computeBudgetRealism(product),
      // Step 10: Enhanced catalog fields
      imageUrl: (product as any).imageUrl,
      typicalMarket: (product as any).typicalMarket ?? (product.availability === 'discontinued' ? 'used' : undefined),
      buyingContext: (product as any).buyingContext,
      // 4-option metadata — carried through for anchor tracking
      philosophy: product.philosophy,
      marketType: product.marketType,
      primaryAxes: product.primaryAxes,
    } as ProductExample;
  });

  // ── Final budget safety net ────────────────────────────
  // Strip any product that somehow ended up above budget (e.g. via
  // engaged-product boost or diversity selection overriding the filter).
  // Products with budgetRealism === 'above_budget' must not be shown —
  // UNLESS the user explicitly asked for that brand and the price is
  // within the hard ceiling (25% over budget). This lets "and the ares?"
  // surface a $1,199 product on a $1,000 budget.
  const brandConstraintLower = brandConstraint?.toLowerCase();
  const hardCeiling = budgetAmount ? budgetAmount * 1.25 : Infinity;
  // Build the set of brands that should be exempt from budget filtering:
  // explicit brand constraint + liked brands from listener profile.
  const exemptBrands = new Set<string>();
  if (brandConstraintLower) exemptBrands.add(brandConstraintLower);
  if (listenerProfile) {
    for (const lb of listenerProfile.likedBrands) {
      exemptBrands.add(lb.toLowerCase());
    }
  }
  const budgetFiltered = budgetAmount
    ? results.filter((r) => {
        if (r.budgetRealism !== 'above_budget') return true;
        // Exempt explicitly requested or liked brand within hard ceiling
        if (exemptBrands.has(r.brand.toLowerCase()) && r.price <= hardCeiling) {
          console.log('[budget-exempt] %s %s ($%d) — requested/liked brand, within hard ceiling ($%d)', r.brand, r.name, r.price, hardCeiling);
          return true;
        }
        return false;
      })
    : results;
  // If all products were filtered out, fall back to unfiltered (edge case).
  const finalResults = budgetFiltered.length > 0 ? budgetFiltered : results;

  // Apply 4-option recommendation set: anchor, close_alt, contrast, wildcard.
  // Pass the scored products so the builder can access philosophy/marketType.
  // Detect explicit vintage/separates intent from constraints and conversation signals.
  // Default: exclude from anchor. Only include when user explicitly signaled intent.
  const userRequestedVintage = constraints?.requireTopologies?.some(
    (t) => /vintage|classic|retro/i.test(t),
  ) ?? false;
  const userRequestedSeparates = constraints?.requireTopologies?.some(
    (t) => /power.amp|preamp|pre.amp|separates/i.test(t),
  ) ?? false;
  const userRequestedSET = constraints?.requireTopologies?.some(
    (t) => /\bset\b|single.ended|triode|low.power|decware|yamamoto|bottlehead/i.test(t),
  ) ?? false;

  const recommendationSet = buildRecommendationSet(
    finalResults, listenerProfile,
    selectionMode ?? 'default', previousAnchor, recentProductNames,
    budgetAmount,
    category,
    userRequestedVintage,
    userRequestedSeparates,
    userRequestedSET,
  );
  // ── Hard validation guards ──────────────────────────
  // Enforce category + budget constraints on final output.
  // These are last-line-of-defense checks — if anything upstream
  // leaked a wrong-category or over-budget product, we catch it here.
  const validatedSet = recommendationSet.filter((p) => {
    // Budget guard: allow up to 25% tolerance (covers stretch_used),
    // but hard-reject anything beyond that.
    if (budgetAmount && p.price) {
      const hardCeiling = budgetAmount * 1.25;
      if (p.price > hardCeiling && (!p.usedPriceRange || p.usedPriceRange.low > hardCeiling)) {
        console.warn('[budget-guard] REJECTED %s %s — price %d exceeds hard ceiling %d', p.brand, p.name, p.price, hardCeiling);
        return false;
      }
    }
    return true;
  });

  console.log('[post-filter]', {
    category,
    budget: budgetAmount ?? 'none',
    recommendationCount: recommendationSet.length,
    validatedCount: validatedSet.length,
    rejected: recommendationSet.length - validatedSet.length,
  });

  const finalSet = validatedSet.length >= 2 ? validatedSet : recommendationSet;

  // Constrained modes NEVER fall back to finalResults — that list has no
  // mode filtering and would reintroduce traditional products in less_traditional
  // or same-philosophy products in different mode.
  if (selectionMode !== 'default') {
    return finalSet;
  }

  // Default mode only: fall back to the full filtered list if the builder
  // produced fewer than 2 (e.g., very small catalog).
  return finalSet.length >= 2 ? finalSet : finalResults;
}

/**
 * Select products with topology diversity — no two picks share the same
 * topology unless the candidate pool is too small.
 *
 * When scores are tied (common with sparse signals), prefer the highest-priced
 * representative of each topology to surface more refined designs across the
 * budget range rather than clustering at the low end.
 *
 * Pass 1: one product per topology (highest-priced among top-scoring).
 * Pass 2: fill remaining slots with different brands.
 * Pass 3: last resort — fill from ranked list.
 */
/** Shortlist bounds — applied after diversity selection. */
const MIN_SHORTLIST = 2;
const MAX_SHORTLIST = 3;

function selectDiverseByTopology(
  ranked: ScoredProduct[],
  target: number,
  budgetAmount?: number | null,
): ScoredProduct[] {
  if (ranked.length === 0) return [];

  // Clamp target within bounds
  const count = Math.max(MIN_SHORTLIST, Math.min(target, MAX_SHORTLIST));

  // ── Price floor guard (Task 2): when budget is stated, never select
  // products below 30% of budget. This prevents refinement turns from
  // collapsing to entry-level products. A $5000 budget must produce
  // $1500+ products, not $999 starter options.
  const priceFloor = budgetAmount ? budgetAmount * 0.3 : 0;
  const eligible = priceFloor > 0
    ? ranked.filter((r) => r.product.price >= priceFloor)
    : ranked;
  // Fallback to full ranked list if price floor eliminates everything
  const pool = eligible.length >= count ? eligible : ranked;

  // Group by topology, keeping only top-scoring entries per topology.
  // Within each topology group, prefer higher price (more refined design).
  const byTopology = new Map<string, ScoredProduct>();
  const topScore = pool[0]?.score ?? 0;
  const scoreTolerance = 0.5; // entries within 0.5 of the top are considered competitive

  for (const entry of pool) {
    if (entry.score < topScore - scoreTolerance) continue;
    const topo = entry.product.topology
      ?? entry.product.architecture?.split(/\s/)[0]?.toLowerCase()
      ?? 'unknown';
    const existing = byTopology.get(topo);
    // Prefer higher price within the same topology (better representative)
    if (!existing || entry.product.price > existing.product.price) {
      byTopology.set(topo, entry);
    }
  }

  // Sort topology representatives by score descending, then price descending
  const representatives = [...byTopology.values()].sort((a, b) =>
    b.score - a.score || b.product.price - a.product.price,
  );

  const selected: ScoredProduct[] = [];
  for (const entry of representatives) {
    if (selected.length >= count) break;
    selected.push(entry);
  }

  // Pass 2: fill remaining (allow topology repeats, prefer different brands)
  // Enforce a score floor — only products within 1.5 of the top score qualify.
  // This prevents dramatically under-budget products from sneaking in via
  // brand diversity alone (e.g. $3K amp in a $10K search).
  if (selected.length < count) {
    const pass2Floor = topScore - 1.5;
    const usedBrands = new Set(selected.map((s) => s.product.brand.toLowerCase()));
    for (const entry of pool) {
      if (selected.length >= count) break;
      if (selected.includes(entry)) continue;
      if (entry.score < pass2Floor) break; // pool is sorted; stop early
      if (!usedBrands.has(entry.product.brand.toLowerCase())) {
        selected.push(entry);
        usedBrands.add(entry.product.brand.toLowerCase());
      }
    }
  }

  // Pass 3: last resort — fill from pool (price-floor-filtered when budget stated)
  if (selected.length < count) {
    for (const entry of pool) {
      if (selected.length >= count) break;
      if (!selected.includes(entry)) {
        selected.push(entry);
      }
    }
  }

  return selected;
}

/**
 * Tiered exploratory selection — for no-budget queries.
 *
 * When the user hasn't stated a budget, the shortlist should feel
 * approachable and credible — not insider-heavy. The composition rule is:
 *
 *   2 anchor picks — mainstream, established, or well-known specialist
 *   1 wildcard    — boutique or distinctive option for character
 *
 * Price tiers prevent ultra-high-end outliers from dominating:
 *
 *   Accessible:  ≤ 0.6 × median
 *   Mid-tier:    0.6 – 1.8 × median
 *   Stretch:     1.8 – 3.0 × median
 *   Excluded:    > 3.0 × median (reference/statement pieces)
 *
 * Anchors are drawn from accessible and mid tiers.
 * The wildcard is drawn from any tier (often stretch).
 * Topology diversity is enforced across all three picks.
 */

/** Brand scales considered broadly credible / recognizable. */
const ANCHOR_BRAND_SCALES = new Set(['mainstream', 'major', 'established', 'heritage', 'specialist']);
/** Brand scales considered distinctive / insider-oriented. */
const WILDCARD_BRAND_SCALES = new Set(['boutique', 'luxury']);

function selectTieredExploratory(ranked: ScoredProduct[]): ScoredProduct[] {
  if (ranked.length === 0) return [];
  if (ranked.length <= 3) return ranked;

  // Compute median price from the candidate pool
  const prices = ranked.map((r) => r.product.price).sort((a, b) => a - b);
  const median = prices.length % 2 === 0
    ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
    : prices[Math.floor(prices.length / 2)];

  // Price ceiling — exclude reference/statement pieces
  const stretchCeil = median * 3.0;
  const priceCapped = ranked.filter((r) => r.product.price <= stretchCeil);
  if (priceCapped.length <= 3) return priceCapped;

  // Tier boundaries for price spread
  const accessibleCeil = median * 0.6;
  const midCeil = median * 1.8;

  // Helper: resolve topology tag for diversity checks
  function topoOf(r: ScoredProduct): string {
    return r.product.topology
      ?? r.product.architecture?.split(/\s/)[0]?.toLowerCase()
      ?? 'unknown';
  }

  // Helper: resolve brand recognition tier
  function isAnchor(r: ScoredProduct): boolean {
    return ANCHOR_BRAND_SCALES.has(r.product.brandScale ?? 'specialist');
  }

  // ── Pass 1: pick two anchors from different price tiers ──
  const usedTopologies = new Set<string>();
  const usedBrands = new Set<string>();
  const selected: ScoredProduct[] = [];

  function tryPick(
    pool: ScoredProduct[],
    filter: (r: ScoredProduct) => boolean,
  ): ScoredProduct | null {
    // First pass: matching filter + new topology + new brand
    for (const r of pool) {
      if (!filter(r)) continue;
      if (selected.includes(r)) continue;
      const topo = topoOf(r);
      const brand = r.product.brand.toLowerCase();
      if (!usedTopologies.has(topo) && !usedBrands.has(brand)) {
        usedTopologies.add(topo);
        usedBrands.add(brand);
        return r;
      }
    }
    // Second pass: relax brand constraint (allow same brand, require new topology)
    for (const r of pool) {
      if (!filter(r)) continue;
      if (selected.includes(r)) continue;
      const topo = topoOf(r);
      if (!usedTopologies.has(topo)) {
        usedTopologies.add(topo);
        usedBrands.add(r.product.brand.toLowerCase());
        return r;
      }
    }
    // Third pass: accept anything matching the filter
    for (const r of pool) {
      if (!filter(r)) continue;
      if (selected.includes(r)) continue;
      usedTopologies.add(topoOf(r));
      usedBrands.add(r.product.brand.toLowerCase());
      return r;
    }
    return null;
  }

  // Anchor 1: prefer accessible tier (the "strong starting point" pick)
  const accessiblePool = priceCapped.filter((r) => r.product.price <= accessibleCeil);
  const midPool = priceCapped.filter((r) => r.product.price > accessibleCeil && r.product.price <= midCeil);
  // Try accessible first, fall back to mid if accessible has no anchors
  const anchor1 = tryPick(accessiblePool, isAnchor)
    ?? tryPick(accessiblePool, () => true)
    ?? tryPick(midPool, isAnchor);
  if (anchor1) selected.push(anchor1);

  // Anchor 2: prefer mid-to-stretch tier (the "step-up" pick)
  const stepUpPool = priceCapped.filter((r) => r.product.price > accessibleCeil);
  const anchor2 = tryPick(stepUpPool, isAnchor);
  if (anchor2) selected.push(anchor2);

  // ── Pass 2: pick one wildcard (boutique/luxury) — any tier ──
  const wildcard = tryPick(
    priceCapped,
    (r) => WILDCARD_BRAND_SCALES.has(r.product.brandScale ?? 'specialist'),
  );
  if (wildcard) selected.push(wildcard);

  // ── Pass 3: fill remaining slots if any tier was empty ──
  // Prefer different brand recognition from what's already selected
  if (selected.length < 3) {
    const anchorCount = selected.filter(isAnchor).length;
    const needsAnchor = anchorCount < 2;
    const fill = tryPick(priceCapped, needsAnchor ? isAnchor : () => true);
    if (fill) selected.push(fill);
  }
  if (selected.length < 3) {
    const fill = tryPick(priceCapped, () => true);
    if (fill) selected.push(fill);
  }

  // Sort final picks by price ascending — accessible → mid → stretch
  selected.sort((a, b) => a.product.price - b.product.price);

  return selected;
}

// ── Headphone / IEM selection ────────────────────────
//
// Headphones use a combined approach: trait scoring (same as DAC/speaker)
// plus portable-use metadata filtering. For travel/commute queries,
// products with portableUse=true are prioritised. When both headphones
// and IEMs are relevant, the selection includes a mix.

/** Detect whether the user is asking about portable/travel use. */
const PORTABLE_USE_PATTERNS = [
  /\bcommut/i,
  /\bflight/i,
  /\btravel/i,
  /\bportable/i,
  /\bon[- ]the[- ]go/i,
  /\btrain/i,
  /\bbus\b/i,
  /\bplane/i,
  /\bairport/i,
  /\bgym\b/i,
  /\bwireless\b/i,
  /\banc\b/i,
  /\bnoise[- ]cancell/i,
];

/** Detect whether the user specifically mentions IEMs. */
const IEM_PATTERNS = [
  /\biem/i,
  /\bearphone/i,
  /\bear\s*buds?\b/i,
  /\bin[- ]ear/i,
];

/** Detect whether the user specifically mentions over-ear/headphones. */
const OVEREAR_PATTERNS = [
  /\bover[- ]ear/i,
  /\bheadphone/i,
  /\bcans\b/i,
  /\bfull[- ]size/i,
];

function selectHeadphoneExamples(
  userTraits: Record<string, SignalDirection>,
  budgetAmount: number | null,
  systemProfile: SystemProfile,
  tasteProfile?: UserTasteProfile,
  reasoning?: ReasoningResult,
): ProductExample[] {
  // Get the full user text from the reasoning context or use empty
  // For now we read portable intent from the products themselves
  const allProducts = HEADPHONE_PRODUCTS as HeadphoneProduct[];

  // Budget filter — use generous range for headphones
  let budgetFiltered: HeadphoneProduct[];
  if (budgetAmount !== null) {
    const ceiling = budgetAmount * 1.15; // 15% grace
    budgetFiltered = allProducts.filter((p) => p.price <= ceiling);
  } else {
    budgetFiltered = allProducts;
  }

  if (budgetFiltered.length === 0) return [];

  // Score using the standard ranking pipeline
  const ranked = rankProducts(budgetFiltered as Product[], userTraits, budgetAmount ?? 10000, systemProfile);

  // Apply taste profile bonus
  if (tasteProfile && tasteProfile.confidence > 0.2) {
    const topProfileTraits = topTraits(tasteProfile, 2);
    const profileWeight = tasteProfile.confidence * 0.15;
    for (const entry of ranked) {
      let bonus = 0;
      for (const pt of topProfileTraits) {
        const productTraitKey = PROFILE_TO_PRODUCT_TRAIT[pt.key];
        const productTraitValue = resolveTraitValue(entry.product.tendencyProfile, entry.product.traits, productTraitKey);
        bonus += productTraitValue * pt.value * profileWeight;
      }
      entry.score += bonus;
    }
    ranked.sort((a, b) => b.score - a.score);
  }

  // Directional bonus from reasoning
  if (reasoning && reasoning.direction.arrows.length > 0) {
    const arrows = reasoning.direction.arrows;
    const perArrow = DIRECTION_BONUS_CAP / Math.max(arrows.length, 1);
    for (const entry of ranked) {
      let bonus = 0;
      for (const arrow of arrows) {
        const traitKey = DIRECTION_TRAIT_MAP[arrow.quality];
        if (!traitKey) continue;
        const productValue = resolveTraitValue(
          entry.product.tendencyProfile, entry.product.traits, traitKey,
        );
        if (arrow.direction === 'up' && productValue > 0.5) {
          bonus += (productValue - 0.5) * perArrow;
        } else if (arrow.direction === 'down' && productValue < 0.5) {
          bonus += (0.5 - productValue) * perArrow;
        }
      }
      entry.score += Math.min(bonus, DIRECTION_BONUS_CAP);
    }
    ranked.sort((a, b) => b.score - a.score);
  }

  // Portable-use boost — products marked portable get a score bonus
  // This is a soft preference, not a hard filter
  for (const entry of ranked) {
    const hp = allProducts.find((p) => p.id === entry.product.id);
    if (hp?.headphoneMeta.portableUse) {
      entry.score += 0.15;
    }
    // ANC bonus for travel products
    if (hp?.headphoneMeta.anc) {
      entry.score += 0.05;
    }
  }
  ranked.sort((a, b) => b.score - a.score);

  // Select top 3, but try to include a mix of form factors if possible
  const top = ranked.slice(0, 5);
  const selected: typeof ranked = [];
  let hasIEM = false;
  let hasOverEar = false;

  for (const entry of top) {
    if (selected.length >= 3) break;
    const hp = allProducts.find((p) => p.id === entry.product.id);
    const isIEM = hp?.headphoneMeta.formFactor === 'iem';
    const isOverEar = hp?.headphoneMeta.formFactor === 'over-ear';

    // Prefer variety — but don't force it if scores differ a lot
    if (selected.length === 2 && !hasIEM && isIEM) {
      selected.push(entry);
      hasIEM = true;
    } else if (selected.length === 2 && !hasOverEar && isOverEar) {
      selected.push(entry);
      hasOverEar = true;
    } else {
      selected.push(entry);
      if (isIEM) hasIEM = true;
      if (isOverEar) hasOverEar = true;
    }
  }

  return selected.map(({ product }) => {
    const hp = allProducts.find((p) => p.id === product.id);
    const metaParts: string[] = [];
    if (hp?.headphoneMeta.formFactor === 'iem') metaParts.push('IEM');
    else if (hp?.headphoneMeta.formFactor === 'over-ear') metaParts.push('over-ear');
    if (hp?.headphoneMeta.wireless) metaParts.push('wireless');
    if (hp?.headphoneMeta.anc) metaParts.push('ANC');
    const metaLabel = metaParts.length > 0 ? ` [${metaParts.join(', ')}]` : '';

    return {
      name: `${product.name}${metaLabel}`,
      brand: product.brand,
      price: product.price,
      priceCurrency: product.priceCurrency,
      fitNote: buildFitNote(product, userTraits),
      caution: buildCaution(product),
      links: product.retailer_links.length > 0 ? product.retailer_links : undefined,
      sourceReferences: product.sourceReferences,
    };
  });
}

// ── Sonic philosophy labels ──────────────────────────
//
// Maps topology tags and architecture keywords to human-readable
// philosophy labels for the sonic landscape guide.

const TOPOLOGY_PHILOSOPHY: Record<string, { label: string; emphasis: string }> = {
  'r2r':                  { label: 'Discrete R2R ladder',        emphasis: 'tonal density, harmonic richness, and analog-like naturalness' },
  'delta-sigma':          { label: 'Delta-sigma conversion',      emphasis: 'measured precision, low noise floor, and studio-grade neutrality' },
  'fpga':                 { label: 'FPGA pulse-array',            emphasis: 'timing precision, transient speed, and spatial definition' },
  'multibit':             { label: 'Multibit conversion',         emphasis: 'tonal weight and dynamic authority with vintage-inflected character' },
  'nos':                  { label: 'Non-oversampling (NOS)',       emphasis: 'organic flow, tube-like ease, and zero-filter naturalness' },
  // Amplifier topologies
  'set':                  { label: 'Single-ended triode (SET)',    emphasis: 'midrange purity, harmonic richness, and intimacy' },
  'push-pull-tube':       { label: 'Push-pull tube',              emphasis: 'tonal warmth with more power and dynamic range than SET' },
  'class-a-solid-state':  { label: 'Class A solid-state',         emphasis: 'warmth and refinement without tube maintenance' },
  'class-ab-solid-state': { label: 'Class AB solid-state',        emphasis: 'wide bandwidth, current delivery, and dynamic authority' },
  'class-d':              { label: 'Class D',                     emphasis: 'efficiency, compact form factor, and modern low-noise design' },
  'hybrid':               { label: 'Hybrid (tube + solid-state)', emphasis: 'tube tonality with solid-state current delivery' },
  // Speaker topologies
  'horn-loaded':          { label: 'Horn-loaded',                 emphasis: 'dynamic impact, efficiency, and immediacy' },
  'bass-reflex':          { label: 'Bass-reflex',                 emphasis: 'extended bass, wide dynamic range, and versatility' },
  'sealed':               { label: 'Sealed cabinet',              emphasis: 'tight bass control, midrange clarity, and placement flexibility' },
  'open-baffle':          { label: 'Open baffle',                 emphasis: 'spatial openness and naturalness with minimal cabinet coloration' },
  'transmission-line':    { label: 'Transmission line',           emphasis: 'deep controlled bass with open midrange character' },
};

/**
 * Build a sonic landscape paragraph from the selected product examples.
 * Explains the design philosophies represented in the shortlist.
 */
function buildSonicLandscape(
  products: ProductExample[],
  allProducts: Product[],
  category: string,
): string | undefined {
  if (products.length === 0) return undefined;

  // Find the full Product objects to access topology
  const philosophies: Map<string, string[]> = new Map();
  for (const ex of products) {
    const full = allProducts.find((p) => p.name === ex.name && p.brand === ex.brand);
    const topo = full?.topology
      ?? full?.architecture?.split(/\s/)[0]?.toLowerCase()
      ?? 'unknown';
    const philosophy = TOPOLOGY_PHILOSOPHY[topo];
    if (philosophy) {
      const existing = philosophies.get(philosophy.label) ?? [];
      existing.push(`${ex.brand} ${ex.name}`);
      philosophies.set(philosophy.label, existing);
    }
  }

  if (philosophies.size <= 1) return undefined;

  const lines: string[] = [
    `These ${category} options represent different sonic directions:`,
  ];
  for (const [label, reps] of philosophies) {
    const philo = Object.values(TOPOLOGY_PHILOSOPHY).find((p) => p.label === label);
    if (philo) {
      lines.push(`**${label}** (${reps.join(', ')}) — prioritizes ${philo.emphasis}.`);
    }
  }
  lines.push(
    'Each approach has trade-offs — the right choice depends on system interaction.',
  );
  return lines.join('\n');
}

/**
 * Build the candidate philosophy list for the synthesis brief.
 */
function buildCandidatePhilosophies(
  products: ProductExample[],
  allProducts: Product[],
): CandidatePhilosophy[] {
  const byTopo = new Map<string, CandidatePhilosophy>();
  for (const ex of products) {
    const full = allProducts.find((p) => p.name === ex.name && p.brand === ex.brand);
    const topo = full?.topology
      ?? full?.architecture?.split(/\s/)[0]?.toLowerCase()
      ?? 'unknown';
    const philosophy = TOPOLOGY_PHILOSOPHY[topo];
    if (!philosophy) continue;
    const existing = byTopo.get(topo);
    if (existing) {
      existing.representatives.push(`${ex.brand} ${ex.name}`);
    } else {
      byTopo.set(topo, {
        label: philosophy.label,
        emphasis: philosophy.emphasis,
        representatives: [`${ex.brand} ${ex.name}`],
      });
    }
  }
  return [...byTopo.values()];
}

/**
 * Build refinement prompts based on what context is missing.
 * These help the user deepen personalization in subsequent turns.
 */
function buildRefinementPrompts(
  gaps: GapDimension[],
  category: ShoppingCategory,
): string[] {
  const prompts: string[] = [];
  if (gaps.includes('taste')) {
    prompts.push('Do you prefer more tonal density and warmth, or more precision and transient speed?');
  }
  if (gaps.includes('system')) {
    const catParts = category === 'dac'
      ? 'amplifier and speakers'
      : category === 'amplifier'
        ? 'DAC and speakers'
        : category === 'speaker'
          ? 'amplifier and source'
          : 'other components';
    prompts.push(`What ${catParts} are in your system?`);
  }
  if (!gaps.includes('system') && !gaps.includes('taste')) {
    prompts.push('What room size and typical listening level do you have?');
  }
  if (gaps.includes('use_case')) {
    prompts.push('What kind of music do you listen to most?');
  }
  return prompts.slice(0, 3); // max 3 prompts
}

/**
 * Build compact "Why this fits you" personalization bullets.
 *
 * Deterministic, template-driven — uses only data already extracted
 * by the reasoning engine. Max 4 bullets. Returns undefined when
 * insufficient context exists.
 *
 * Inputs: taste profile, system profile, signal traits, product topologies.
 */
function buildWhyThisFitsYou(
  matchedProfile: TasteProfile | undefined,
  ctx: ShoppingContext,
  signals: ExtractedSignals,
  products: ProductExample[],
  allProducts: Product[],
  reasoning?: ReasoningResult,
): string[] | undefined {
  const bullets: string[] = [];

  // 1. Taste alignment — connect recommendations to listener preferences
  const tasteLabel = reasoning?.taste.tasteLabel ?? matchedProfile?.label;
  if (tasteLabel) {
    bullets.push(`Selection weighted toward designs that prioritize ${tasteLabel.toLowerCase()}.`);
  }

  // 2. System interaction — how these fit the existing chain
  if (ctx.systemProvided && ctx.systemProfile) {
    const outputType = ctx.systemProfile.outputType;
    const character = ctx.systemProfile.systemCharacter;
    if (character === 'warm') {
      bullets.push('Your system leans warm — the shortlist includes options that complement rather than compound that tendency.');
    } else if (character === 'neutral') {
      bullets.push('Your system reads as fairly neutral, so these options can shift the balance in whatever direction appeals to you.');
    } else if (character === 'bright') {
      bullets.push('Your system leans bright — options here include designs that can add body and tonal density.');
    }
    if (outputType === 'headphones' && ctx.category === 'dac') {
      bullets.push('As a headphone listener, upstream resolution from the DAC will be more directly audible.');
    }
  }

  // 3. Archetype fit — broader sonic identity
  const archetype = reasoning?.taste.archetype ?? matchedProfile?.archetype;
  if (archetype && !tasteLabel) {
    // Only add this if we didn't already use tasteLabel (avoids redundancy)
    const archetypePhrase = ARCHETYPE_LABELS[archetype];
    if (archetypePhrase) {
      bullets.push(`${archetypePhrase.charAt(0).toUpperCase() + archetypePhrase.slice(1)} listening style — shortlist reflects that axis.`);
    }
  }

  // 4. Topology diversity — explain why different approaches are present
  const topoSet = new Set<string>();
  for (const ex of products) {
    const full = allProducts.find((p) => p.name === ex.name && p.brand === ex.brand);
    const topo = full?.topology ?? 'unknown';
    if (topo !== 'unknown') topoSet.add(topo);
  }
  if (topoSet.size >= 2 && bullets.length < 3) {
    bullets.push('Shortlist spans different design philosophies for comparison.');
  }

  // 5. Budget alignment
  if (ctx.budgetAmount && products.length > 0) {
    const prices = products.filter((p) => p.price > 0).map((p) => p.price);
    if (prices.length >= 2) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (max <= ctx.budgetAmount && min < ctx.budgetAmount * 0.7) {
        bullets.push(`Options range $${min.toLocaleString()}–$${max.toLocaleString()}, leaving room elsewhere in the chain.`);
      }
    }
  }

  if (bullets.length === 0) return undefined;
  return bullets.slice(0, 4); // cap at 4
}

/**
 * Build a user context reference for the shortlist framing.
 * References system, taste, and listening preferences when available.
 */
function buildUserContextNote(
  ctx: ShoppingContext,
  signals: ExtractedSignals,
  matchedProfile: TasteProfile | undefined,
  reasoning?: ReasoningResult,
): string | undefined {
  const parts: string[] = [];

  // Taste context
  if (matchedProfile) {
    parts.push(`your preference for ${matchedProfile.label}`);
  }

  // System context
  if (ctx.systemProvided) {
    parts.push('your current system');
  }

  if (parts.length === 0) return undefined;

  return `Options selected with ${parts.join(' and ')} in mind.`;
}

// ── Builder ───────────────────────────────────────────

/**
 * Builds an advisor-first shopping answer from gathered context
 * and extracted signals. Deterministic, template-driven.
 *
 * Structure:
 *   1. Best-fit direction
 *   2. Why this fits
 *   3. Possible product examples (if catalog exists for category)
 *   4. What to watch for
 *   5. System note (if system context was provided)
 */
export function buildShoppingAnswer(
  ctx: ShoppingContext,
  signals: ExtractedSignals,
  tasteProfile?: UserTasteProfile,
  reasoning?: ReasoningResult,
  activeSystemComponents?: string[],
  /** Product names the user has engaged with in prior turns (for shortlist continuity). */
  engagedProductNames?: string[],
  /** Accumulated listener profile for taste filtering + decisive recommendations. */
  listenerProfile?: ListenerProfile,
  /** Selection mode override — shifts anchor based on user intent. */
  selectionMode?: SelectionMode,
  /** Previous anchor info for mode-aware anchor selection. */
  previousAnchor?: PreviousAnchor | null,
  /** Product names shown in recent shopping turns (for anti-repetition). */
  recentProductNames?: string[],
  /** Brand constraint from user query (e.g., "denafrips" from "denafrips dacs under 1000"). */
  brandConstraint?: string,
): ShoppingAnswer {
  const traits = signals.traits;
  const categoryLabel = CATEGORY_LABELS[ctx.category] ?? 'component';

  // Find the best-matching taste profile
  const matchedProfile = TASTE_PROFILES.find((p) => p.check(traits));
  const taste = matchedProfile ?? FALLBACK_TASTE;
  const hasTasteSignal = matchedProfile !== undefined;

  // ── Category-specific practical path (turntable, etc.) ──
  // For categories without a scored catalog, use illustrative
  // examples and practical framing instead of taste-profile-only
  // messaging. Taste signals enrich but don't gate the answer.
  if (ctx.category === 'turntable') {
    return buildTurntableAnswer(ctx, signals, taste, matchedProfile, hasTasteSignal, tasteProfile, reasoning, activeSystemComponents);
  }

  // ── Standard taste-driven path (DAC, etc.) ──────────

  // ── Directed mode detection ───────────────────────────
  // When budget, category, and *any* taste signal (explicit or inferred) are
  // present, shift from exploratory options to directed system-building:
  //   • Primary direction statement
  //   • 1–2 anchored recommendations (not 3 equal options)
  //   • Stronger, taste-committed language
  //   • No generic filler or refinement prompts
  const hasBudget = !!ctx.budgetAmount;
  const hasCategory = ctx.category !== 'general';
  // Accept even inferred/weak taste — the reasoning engine always produces
  // a tasteLabel, so we check for a matched profile OR stored profile OR
  // reasoning-level archetype as evidence of *any* signal.
  const hasAnyTaste = hasTasteSignal
    || (tasteProfile && tasteProfile.confidence > 0.15)
    || !!reasoning?.taste.archetype;
  const directed = hasBudget && hasCategory && hasAnyTaste;

  // ── Taste confidence computation ────────────────────
  const hasSemanticPrefs = ctx.semanticPreferences.weights.length > 0;
  const hasRef = (engagedProductNames ?? []).length > 0;
  const hasDislikesSignal = !!(listenerProfile
    && (listenerProfile.dislikedBrands.length > 0 || listenerProfile.dislikedProducts.length > 0));
  // Direction signal: any non-neutral trait counts
  const hasDir = Object.values(signals.traits).some((v) => v === 'up' || v === 'down');
  // Specialist signal: user expressed SET/horn/high-efficiency/low-power intent
  const hasSpecialist = ctx.semanticPreferences.specialistHints.length > 0;

  const tasteConfidence = computeTasteConfidence({
    hasBudget,
    hasCategory,
    hasSemanticPreferences: hasSemanticPrefs,
    hasReference: hasRef,
    hasDislikes: hasDislikesSignal,
    hasDirectionSignal: hasDir,
    hasSpecialistSignal: hasSpecialist,
  });

  console.log('[taste-confidence]', {
    level: tasteConfidence,
    hasBudget,
    hasCategory,
    hasSemanticPreferences: hasSemanticPrefs,
    hasReference: hasRef,
    hasDislikes: hasDislikesSignal,
    hasDirectionSignal: hasDir,
    hasSpecialistSignal: hasSpecialist,
  });

  // Build optional taste question (only when low confidence + no direction)
  const tasteQuestion = tasteConfidence === 'low'
    ? buildTasteQuestion({
        category: ctx.category,
        hasDirectionSignalPresent: hasDir,
        hasReferencePresent: hasRef,
      })
    : null;

  // 1. Preference summary — use reasoning taste label when available
  const effectiveTasteLabel = reasoning?.taste.tasteLabel ?? taste.label;
  const archetype = reasoning?.taste.archetype ?? matchedProfile?.archetype;
  const archetypeLabel = archetype && ARCHETYPE_LABELS[archetype]
    ? ` — a ${ARCHETYPE_LABELS[archetype]} preference`
    : '';
  const profileNote = reasoning?.taste.storedProfileUsed
    ? ` Your stored taste profile reinforces this.`
    : tasteProfile && tasteProfile.confidence > 0.3
      ? ` Your stored taste profile reinforces this.`
      : '';

  // Language gating: adjust assertiveness based on taste confidence.
  // Low = no preference claims. Medium = mild interpretation. High/directed = confident.
  let preferenceSummary: string;
  if (tasteConfidence === 'low') {
    // Low confidence: provide directional value without preference claims.
    // Contextualize with budget/system when available, and orient around the product category.
    const budgetFrame = ctx.budgetAmount ? `your $${ctx.budgetAmount.toLocaleString()} budget` : 'your budget';
    if (ctx.category !== 'general') {
      preferenceSummary = `${categoryLabel.charAt(0).toUpperCase() + categoryLabel.slice(1)} shortlist at this budget — each represents a different design trade-off.`;
    } else {
      preferenceSummary = `Based on ${budgetFrame}, here are some solid starting points.`;
    }
  } else if (directed) {
    preferenceSummary = `Optimizing for ${effectiveTasteLabel}${archetypeLabel}.${profileNote}`;
  } else {
    // sufficient confidence, non-directed
    preferenceSummary = `Leaning toward ${effectiveTasteLabel}${archetypeLabel}.${profileNote}`;
  }

  // 2. Best-fit direction — prefer reasoning direction statement when available.
  //    In directed mode, lead with a system-building directive.
  //    In exploratory mode, wrap in a listener-centered frame.
  const rawDirection = reasoning?.direction.statement
    ?? matchedProfile?.directionByCategory[ctx.category]
    ?? taste.defaultDirection;

  // In directed mode, prefer the archetype's category-specific direction
  // over the reasoning engine's raw statement, which may include generic
  // fallback text ("no strong directional change detected").
  const FALLBACK_MARKERS = ['no strong directional', 'avoids strong bias', 'current balance may be close'];
  const isRawFallback = FALLBACK_MARKERS.some(m => rawDirection.toLowerCase().includes(m));
  const directedDirection = matchedProfile?.directionByCategory[ctx.category]
    ?? (isRawFallback ? taste.defaultDirection : rawDirection);

  let bestFitDirection: string;
  if (tasteConfidence === 'low') {
    // Low confidence: orient the user with meaningful direction, not just generic framing.
    if (ctx.category !== 'general') {
      bestFitDirection = `Distinct approaches to ${categoryLabel} design — warmer and musical through to precise and controlled. Each shifts the system differently.`;
    } else {
      bestFitDirection = `A few different design directions, each with distinct trade-offs.`;
    }
  } else if (directed) {
    bestFitDirection = `This system should lean toward ${effectiveTasteLabel.toLowerCase()} — ${directedDirection.charAt(0).toLowerCase()}${directedDirection.slice(1)}${directedDirection.endsWith('.') ? '' : '.'}`;
  } else {
    // sufficient confidence, non-directed
    bestFitDirection = `Based on what you've described, ${rawDirection.charAt(0).toLowerCase()}${rawDirection.slice(1)}${rawDirection.endsWith('.') ? '' : '.'}`;
  }

  // 3. Why this fits — explicitly listener-centered framing
  const rawWhyThisFits = matchedProfile?.whyByCategory?.[ctx.category]
    ?? taste.defaultWhy ?? matchedProfile?.defaultWhy ?? FALLBACK_TASTE.defaultWhy;
  const whyThisFits = (hasTasteSignal || directed) && Array.isArray(rawWhyThisFits) && rawWhyThisFits.length > 0
    ? [`Designs selected to lean into ${effectiveTasteLabel.toLowerCase()}.`, ...rawWhyThisFits.slice(0, directed ? 1 : 2)]
    : rawWhyThisFits;

  // 4. Product examples (only when catalog exists + budget known)
  // Pass reasoning for directional bias — existing scoring is preserved.
  let productExamples = selectProductExamples(ctx.category, traits, ctx.budgetAmount, ctx.systemProfile, ctx.dependencies, tasteProfile, reasoning, activeSystemComponents, ctx.roomContext, engagedProductNames, ctx.constraints, ctx.semanticPreferences, listenerProfile, selectionMode, previousAnchor, recentProductNames, brandConstraint, signals.symptoms);

  // ── Directed mode: cap at 2 products, mark primary ──
  if (directed && productExamples.length > 2) {
    productExamples = productExamples.slice(0, 2);
  }
  if (directed && productExamples.length > 0) {
    productExamples[0] = { ...productExamples[0], isPrimary: true };
  }

  // 5. Watch for
  const watchFor = taste.watchFor;

  // 6. System note — references user context when available
  const userContextNote = buildUserContextNote(ctx, signals, matchedProfile, reasoning);
  const systemNote = userContextNote
    ?? (ctx.systemProvided
      ? `This direction makes more sense if the rest of the chain is not already biased in the same way. A ${categoryLabel} change will shift the overall balance — listen for whether the qualities you value are preserved.`
      : undefined);

  // Mark as provisional when the answer is based on incomplete context
  const gaps = getStatedGaps(ctx, signals);
  const provisional = gaps.length > 0;

  // 7. Sonic landscape — explains the design philosophies represented
  const fullCatalog = ctx.category === 'dac' ? DAC_PRODUCTS
    : ctx.category === 'speaker' ? SPEAKER_PRODUCTS
    : ctx.category === 'amplifier' ? AMPLIFIER_PRODUCTS
    : [];
  const sonicLandscape = buildSonicLandscape(productExamples, fullCatalog, categoryLabel);

  // 8. Refinement prompts — questions to deepen personalization
  // Suppress in directed mode: user has already provided enough context,
  // generic prompts ("For sharper recommendations...") create noise.
  const refinementPrompts = provisional && !directed ? buildRefinementPrompts(gaps, ctx.category) : [];

  // 9. Why this fits you — compact personalization bullets
  const whyFitsYou = buildWhyThisFitsYou(matchedProfile, ctx, signals, productExamples, fullCatalog, reasoning);

  // 10. Synthesis brief — structured reasoning for the rendering layer
  const synthesisBrief: ShoppingShortlistBrief = {
    kind: 'shopping_shortlist',
    queryCategory: categoryLabel,
    budget: ctx.budgetAmount,
    userTasteSummary: hasTasteSignal
      ? `Prefers ${effectiveTasteLabel}.`
      : 'No taste signals detected.',
    activeSystemSummary: ctx.systemProvided
      ? 'System context provided.'
      : 'No system context provided.',
    missingContext: gaps,
    candidatePhilosophies: buildCandidatePhilosophies(productExamples, fullCatalog),
    narrativeGoal: hasTasteSignal
      ? `Explain which ${categoryLabel} designs align with the listener's taste and why.`
      : `Guide the listener through the sonic landscape of ${categoryLabel} design philosophies within their budget.`,
    refinementPrompts,
  };

  return {
    category: categoryLabel,
    budget: ctx.budgetAmount,
    preferenceSummary,
    bestFitDirection,
    whyThisFits,
    productExamples,
    watchFor,
    systemNote,
    provisional,
    statedGaps: provisional ? gaps : undefined,
    synthesisBrief,
    sonicLandscape,
    refinementPrompts: refinementPrompts.length > 0 ? refinementPrompts : undefined,
    whyFitsYou,
    directed,
    nextBuildStep: directed ? buildNextBuildStep(ctx.category, ctx.systemProvided) : undefined,
    tasteConfidence,
    tasteQuestion: tasteQuestion ?? undefined,
    categoryQuestion: buildCategoryQuestion({
      tasteConfidence,
      category: ctx.category,
      hasProducts: productExamples.length > 0,
    }) ?? undefined,
  };
}

/**
 * Suggest the next logical build step based on the current category.
 * Only meaningful in directed mode when building a coherent system.
 */
function buildNextBuildStep(category: ShoppingCategory, systemProvided: boolean): string | undefined {
  // When the user already has a system, the "next step" is less relevant —
  // they're upgrading a single component, not building from scratch.
  if (systemProvided) return undefined;

  const NEXT_STEPS: Record<string, string> = {
    speaker: 'This speaker choice makes amplifier matching the critical next step — the amp needs to control and complement the speaker\'s character.',
    amplifier: 'Once the amplifier is chosen, the next decision should be the source — DAC or streamer — which sets the tonal foundation.',
    dac: 'With the DAC chosen, the amplifier becomes the next priority — it determines how much of the DAC\'s character reaches the speakers.',
    headphone: 'With the headphones chosen, the source and amplification chain determines how much of their potential you hear.',
    streamer: 'The streamer sets the digital foundation. The DAC is the next critical link in the chain.',
    turntable: 'The turntable is the mechanical foundation. The phono stage and cartridge matching are the next priorities.',
  };

  return NEXT_STEPS[category];
}

// ── Turntable-specific answer builder ─────────────────
//
// Turntables don't have a scored tendency catalog, so the answer
// prioritizes practical recommendations (mechanical platform,
// dependency resolution) over taste-profile-driven direction.
// Taste signals enrich the framing when available but never gate it.

function buildTurntableAnswer(
  ctx: ShoppingContext,
  signals: ExtractedSignals,
  taste: Pick<TasteProfile, 'label' | 'defaultDirection' | 'defaultWhy' | 'watchFor'>,
  matchedProfile: TasteProfile | undefined,
  hasTasteSignal: boolean,
  userTasteProfile?: UserTasteProfile,
  reasoning?: ReasoningResult,
  activeSystemComponents?: string[],
): ShoppingAnswer {
  const budgetLabel = ctx.budgetAmount ? `$${ctx.budgetAmount.toLocaleString()}` : 'your budget';

  // System context enrichment
  const systemParts: string[] = [];
  if (ctx.systemProvided) {
    // Extract system mentions for the opening framing
    const systemText = extractSystemMentions(ctx);
    if (systemText) systemParts.push(systemText);
  }

  // 1. Preference summary — practical framing for turntables
  let preferenceSummary: string;
  if (hasTasteSignal) {
    const effectiveLabel = reasoning?.taste.tasteLabel ?? taste.label;
    preferenceSummary = `At ${budgetLabel}, the priority is a well-sorted mechanical platform with a good stock cartridge. Your preference for ${effectiveLabel} will matter more at the phono-stage and cartridge level than at the turntable level in this range.`;
  } else {
    preferenceSummary = systemParts.length > 0
      ? `At ${budgetLabel} paired with ${systemParts.join(' and ')}, the priority is a solid mechanical platform with a good stock cartridge and reliable speed stability.`
      : `At ${budgetLabel}, the priority is a solid mechanical platform with a good stock cartridge and reliable speed stability.`;
  }

  // 2. Best-fit direction — practical, not taste-driven
  const bestFitDirection = 'A turntable with solid speed stability, a decent tonearm, and a musical stock cartridge. At this price, mechanical fundamentals matter more than exotic features.';

  // 3. Why this fits
  const whyThisFits = [
    'Mechanical stability and tonearm quality are the primary performance drivers at this budget.',
    'A good stock cartridge reduces the need for immediate upgrades.',
    ...(ctx.systemProvided
      ? ['Your existing amplification and speakers are resolving enough to reward a competent source.']
      : []),
  ];

  // 4. Product examples — illustrative, dependency-aware
  const productExamples = selectProductExamples(
    ctx.category, signals.traits, ctx.budgetAmount,
    ctx.systemProfile, ctx.dependencies, userTasteProfile, reasoning, activeSystemComponents,
  );

  // 5. Watch for — practical turntable caveats
  const watchFor = [
    'Speed stability and low wow/flutter matter more than specifications suggest — listen for pitch waver on sustained piano notes.',
    'The stock cartridge is usually good enough to start. Upgrading the cartridge later is one of the most cost-effective improvements.',
    'Turntable placement matters — a solid, level surface away from speakers reduces feedback and vibration.',
  ];

  // 6. System note
  const systemNote = ctx.systemProvided
    ? 'Your existing chain should work well with any of these options. The turntable is the starting point — refinement comes later through cartridge and phono-stage choices.'
    : undefined;

  // 7. Dependency caveat and refinement question
  const depCaveats = ctx.dependencies
    .filter((d) => d.caveat !== null)
    .map((d) => d.caveat!);
  const dependencyCaveat = depCaveats.length > 0 ? depCaveats.join(' ') : undefined;

  // Refinement question — prefer dependency-driven, fall back to general
  const depHints = ctx.dependencies
    .filter((d) => d.refinementHint !== null)
    .map((d) => d.refinementHint!);
  const refinementQuestion = depHints.length > 0
    ? depHints[0]
    : !hasTasteSignal
      ? 'What kind of music do you listen to most? That can help refine the direction.'
      : undefined;

  // Mark as provisional (turntable recommendations are always provisional
  // since we don't have a scored catalog)
  const gaps = getStatedGaps(ctx, signals);

  return {
    category: 'turntable',
    budget: ctx.budgetAmount,
    preferenceSummary,
    bestFitDirection,
    whyThisFits,
    productExamples,
    watchFor,
    systemNote,
    provisional: true,
    statedGaps: gaps.length > 0 ? gaps : undefined,
    dependencyCaveat,
    refinementQuestion,
  };
}

/**
 * Extract a short human-readable description of system context
 * from the shopping context (e.g., "WLM Diva monitors and JOB integrated").
 * Returns null if no meaningful system info was provided.
 */
function extractSystemMentions(ctx: ShoppingContext): string | null {
  if (!ctx.systemProvided) return null;
  const sp = ctx.systemProfile;
  const parts: string[] = [];
  if (sp.outputType === 'speakers') parts.push('speakers');
  else if (sp.outputType === 'headphones') parts.push('headphones');
  if (sp.tubeAmplification) parts.push('tube amplification');
  if (sp.systemCharacter === 'warm') parts.push('a warm-leaning system');
  else if (sp.systemCharacter === 'bright') parts.push('a bright-leaning system');
  return parts.length > 0 ? parts.join(' and ') : 'your current system';
}

/**
 * Returns a brief contrast label for the preference summary.
 * e.g., if label is about speed → contrast is smoothness/warmth.
 */
function getContrastLabel(tasteLabel: string): string {
  if (tasteLabel.includes('speed') || tasteLabel.includes('transient')) return 'warmth or density';
  if (tasteLabel.includes('density') || tasteLabel.includes('richness')) return 'transient precision or analytical detail';
  if (tasteLabel.includes('clarity') || tasteLabel.includes('resolution')) return 'warmth or tonal density';
  if (tasteLabel.includes('fatigue') || tasteLabel.includes('smooth')) return 'analytical resolution';
  if (tasteLabel.includes('composure') || tasteLabel.includes('ease')) return 'speed or analytical precision';
  return 'the opposite emphasis';
}

