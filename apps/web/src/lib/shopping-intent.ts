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

export interface ShoppingContext {
  detected: boolean;
  mode: ShoppingMode;
  category: ShoppingCategory;
  /** Finer classification within category. */
  subcategory?: ShoppingSubcategory;
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
}

const CATEGORY_PATTERNS: CategoryPattern[] = [
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
];

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
  /budget\s+(?:of\s+)?(?:around\s+)?\$?(\d{1,6}(?:,\d{3})*)/i,
  /under\s+\$?(\d{1,6}(?:,\d{3})*)/i,
  /up\s+to\s+\$?(\d{1,6}(?:,\d{3})*)/i,
  /around\s+\$?(\d{1,6}(?:,\d{3})*)/i,
  /spend\s+\$?(\d{1,6}(?:,\d{3})*)/i,
  /i\s+have\s+\$?(\d{1,6}(?:,\d{3})*)/i,
];

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

  for (const pattern of BUDGET_AMOUNT_PATTERNS) {
    // Use a global copy to find ALL matches in the text
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes('i') ? 'gi' : 'g');
    let match: RegExpExecArray | null;
    while ((match = globalPattern.exec(text)) !== null) {
      const parsed = parseInt(match[1].replace(/,/g, ''), 10);
      if (!isNaN(parsed)) {
        lastAmount = parsed;
      }
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
): ShoppingContext {
  const lower = userText.toLowerCase();

  // 1. Intent
  const detected = INTENT_KEYWORDS.some((kw) => lower.includes(kw));
  if (!detected) {
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
    for (const pat of CATEGORY_PATTERNS) {
      if (pat.keywords.some((kw) => lower.includes(kw))) {
        category = pat.category;
        break;
      }
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
  const systemProvided = SYSTEM_KEYWORDS.some((kw) => lower.includes(kw));
  const systemProfile = systemProvided ? parseSystemProfile(userText) : DEFAULT_SYSTEM_PROFILE;
  const useCaseProvided = USE_CASE_KEYWORDS.some((kw) => lower.includes(kw));
  const preserveProvided = PRESERVE_KEYWORDS.some((kw) => lower.includes(kw));
  const limitingProvided = LIMITING_KEYWORDS.some((kw) => lower.includes(kw));

  // 5. Category-specific dependencies
  const dependencies = detectCategoryDependencies(category, userText);

  return {
    detected,
    mode,
    category,
    subcategory,
    budgetMentioned,
    budgetAmount,
    tasteProvided,
    systemProvided,
    systemProfile,
    useCaseProvided,
    preserveProvided,
    limitingProvided,
    dependencies,
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
  const catLabel = CATEGORY_LABELS[ctx.category];
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
      filled: isSystemSufficient(ctx),
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

  const hasSystem = isSystemSufficient(ctx);
  const signalCount = countPreferenceSignals(ctx, signals);
  const hasEnoughSignals = signalCount >= 3;

  // System context is required for chain-sensitive categories unless
  // the user is building from scratch (system is inherently absent)
  const systemRequired = SYSTEM_REQUIRED_CATEGORIES.includes(ctx.category)
    && ctx.mode !== 'build-a-system';

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
  if (!isSystemSufficient(ctx)) gaps.push('system');
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
  fitNote: string;
  caution?: string;
  links?: { label: string; url: string; region?: string }[];
  /** Named source references from the product catalog. */
  sourceReferences?: Array<{ source: string; note: string }>;
}

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
        'Multibit, R-2R, and certain FPGA architectures tend to serve this preference.',
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
        'R-2R and NOS tube architectures tend to deliver this kind of presentation.',
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
        'NOS tube, R-2R, and certain relaxed-filter architectures tend to reduce perceived digital edge.',
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
  label: 'a balanced presentation',
  defaultDirection: 'A component direction that avoids strong bias toward any single trait. Well-balanced designs that trade peak performance for versatility.',
  defaultWhy: [
    'No strong single-trait preference was detected.',
    'A balanced design reduces the risk of system-level overcorrection.',
  ],
  watchFor: [
    'Balanced components rarely excel at any single quality — they trade peak performance for versatility.',
    'What feels balanced in one system may feel colored in another. System context matters.',
  ],
};

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
import { HEADPHONE_PRODUCTS, type HeadphoneProduct } from './products/headphones';
import { selectTurntableExamples } from './products/turntables';
import { rankProducts } from './product-scoring';
import { tagProductArchetype } from './archetype';
import { topTraits, type TasteProfile as UserTasteProfile, type ProfileTraitKey } from './taste-profile';
import type { ReasoningResult } from './reasoning';

/**
 * Generate a one-sentence fit note for a product based on its
 * architecture and strongest matching traits.
 */
function buildFitNote(product: Product, userTraits: Record<string, SignalDirection>): string {
  const arch = product.architecture;

  // Priority 1: curated character tendencies
  if (hasTendencies(product.tendencies)) {
    const top = selectDefaultTendencies(product.tendencies.character, 1);
    if (top.length > 0) {
      return `${arch} design — ${top[0].tendency}`;
    }
  }

  // Priority 2: qualitative tendency profile (high/medium only)
  if (hasExplainableProfile(product.tendencyProfile)) {
    const emphasized = getEmphasizedTraits(product.tendencyProfile);
    if (emphasized.length > 0) {
      const verb = product.tendencyProfile.confidence === 'high' ? 'emphasizes' : 'leans toward';
      return `${arch} design — ${verb} ${emphasized.slice(0, 2).join(' and ')}`;
    }
  }

  // Priority 3: design archetype (class-level knowledge)
  const fitArchetype = resolveArchetype(arch);
  const fitNote = fitArchetype ? archetypeFitNote(fitArchetype) : undefined;
  if (fitNote) {
    return `${arch} design — ${fitNote}`;
  }

  // Priority 4: legacy trait-label + description path
  const strongTraits: string[] = [];

  for (const [trait, direction] of Object.entries(userTraits)) {
    const val = resolveTraitValue(product.tendencyProfile, product.traits, trait);
    if (direction === 'up' && val >= 0.7) {
      strongTraits.push(trait.replace(/_/g, ' '));
    }
  }

  if (strongTraits.length > 0) {
    const traitList = strongTraits.slice(0, 2).join(' and ');
    return `${arch} design with strong ${traitList}. ${product.description.split('.')[0]}.`;
  }

  return `${arch} design. ${product.description.split('.')[0]}.`;
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
  if (product.notes) return product.notes;

  // Check for risk flags (prefers tendencyProfile, falls back to legacy)
  if (hasRisk(product.tendencyProfile, product.traits, 'glare_risk')) {
    return 'May introduce glare or edge in systems that are already bright.';
  }
  if (hasRisk(product.tendencyProfile, product.traits, 'fatigue_risk')) {
    return 'May contribute to listening fatigue in long sessions.';
  }

  return undefined;
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
): ProductExample[] {
  // ── Turntable: illustrative examples (no trait scoring) ──
  if (category === 'turntable') {
    const phonoDep = dependencies.find((d) => d.id === 'phono_stage');
    const phonoAbsent = phonoDep?.status === 'absent';
    const selected = selectTurntableExamples(budgetAmount, phonoAbsent, 3);
    return selected.map((t) => ({
      name: t.name,
      brand: t.brand,
      price: t.price,
      priceCurrency: t.priceCurrency,
      fitNote: phonoAbsent ? t.phonoAbsentNote : t.fitNote,
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
    default: return [];
  }
  if (budgetAmount === null) return [];

  const ranked = rankProducts(catalog, userTraits, budgetAmount, systemProfile);

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

  const top = ranked.slice(0, 3);

  return top.map(({ product }) => ({
    name: product.name,
    brand: product.brand,
    price: product.price,
    priceCurrency: product.priceCurrency,
    character: buildProductCharacter(product),
    fitNote: buildFitNote(product, userTraits),
    caution: buildCaution(product),
    links: product.retailer_links.length > 0 ? product.retailer_links : undefined,
    sourceReferences: product.sourceReferences,
  }));
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
): ShoppingAnswer {
  const traits = signals.traits;
  const categoryLabel = CATEGORY_LABELS[ctx.category];

  // Find the best-matching taste profile
  const matchedProfile = TASTE_PROFILES.find((p) => p.check(traits));
  const taste = matchedProfile ?? FALLBACK_TASTE;
  const hasTasteSignal = matchedProfile !== undefined;

  // ── Category-specific practical path (turntable, etc.) ──
  // For categories without a scored catalog, use illustrative
  // examples and practical framing instead of taste-profile-only
  // messaging. Taste signals enrich but don't gate the answer.
  if (ctx.category === 'turntable') {
    return buildTurntableAnswer(ctx, signals, taste, matchedProfile, hasTasteSignal, tasteProfile, reasoning);
  }

  // ── Standard taste-driven path (DAC, etc.) ──────────

  // 1. Preference summary — use reasoning taste label when available
  const effectiveTasteLabel = reasoning?.taste.tasteLabel ?? taste.label;
  const archetypeLabel = (reasoning?.taste.archetype ?? matchedProfile?.archetype)
    ? ` — a ${ARCHETYPE_LABELS[(reasoning?.taste.archetype ?? matchedProfile?.archetype)!]} preference`
    : '';
  const profileNote = reasoning?.taste.storedProfileUsed
    ? ` Your stored taste profile reinforces this.`
    : tasteProfile && tasteProfile.confidence > 0.3
      ? ` Your stored taste profile reinforces this.`
      : '';
  const preferenceSummary = `You appear to value ${effectiveTasteLabel} more than ${getContrastLabel(effectiveTasteLabel)}${archetypeLabel}.${profileNote}`;

  // 2. Best-fit direction — prefer reasoning direction statement when available
  const bestFitDirection = reasoning?.direction.statement
    ?? matchedProfile?.directionByCategory[ctx.category]
    ?? taste.defaultDirection;

  // 3. Why this fits
  const whyThisFits = matchedProfile?.whyByCategory?.[ctx.category]
    ?? taste.defaultWhy ?? matchedProfile?.defaultWhy ?? FALLBACK_TASTE.defaultWhy;

  // 4. Product examples (only when catalog exists + budget known)
  // Pass reasoning for directional bias — existing scoring is preserved.
  const productExamples = selectProductExamples(ctx.category, traits, ctx.budgetAmount, ctx.systemProfile, ctx.dependencies, tasteProfile, reasoning);

  // 5. Watch for
  const watchFor = taste.watchFor;

  // 6. System note
  const systemNote = ctx.systemProvided
    ? `This direction makes more sense if the rest of the chain is not already biased in the same way. A ${categoryLabel} change will shift the overall balance — listen for whether the qualities you value are preserved.`
    : undefined;

  // Mark as provisional when the answer is based on incomplete context
  const gaps = getStatedGaps(ctx, signals);
  const provisional = gaps.length > 0;

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
  };
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
    ctx.systemProfile, ctx.dependencies, userTasteProfile, reasoning,
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
