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
  activeSystemComponents?: string[],
): ShoppingContext {
  const lower = userText.toLowerCase();

  // 1. Intent
  // INTENT_KEYWORDS uses string matching which requires '$' in budget phrases.
  // Also check BUDGET_PATTERNS (regex) to catch "under 1500" without '$'.
  const detected = INTENT_KEYWORDS.some((kw) => lower.includes(kw))
    || BUDGET_PATTERNS.some((re) => re.test(userText));
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
  const hasActiveSystem = Array.isArray(activeSystemComponents) && activeSystemComponents.length > 0;
  const systemProvided = hasActiveSystem || SYSTEM_KEYWORDS.some((kw) => lower.includes(kw));
  const systemProfile = systemProvided
    ? parseSystemProfile(hasActiveSystem ? `${userText}\n${activeSystemComponents.join(' ')}` : userText)
    : DEFAULT_SYSTEM_PROFILE;
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

  // ── Catalog facts (not rendered — used for LLM validation) ──
  /** Raw architecture string from catalog (e.g. "delta-sigma (ESS)"). */
  catalogArchitecture?: string;
  /** Design topology (e.g. "r2r", "fpga", "delta-sigma"). */
  catalogTopology?: string;
  /** Country of origin (ISO code, e.g. "CN", "US", "JP"). */
  catalogCountry?: string;
  /** Brand scale (e.g. "specialist", "boutique", "major"). */
  catalogBrandScale?: string;
  /** True when this product is already in the user's current system. */
  isCurrentComponent?: boolean;
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
import { AMPLIFIER_PRODUCTS } from './products/amplifiers';
import { HEADPHONE_PRODUCTS, type HeadphoneProduct } from './products/headphones';
import { selectTurntableExamples } from './products/turntables';
import { rankProducts, type ScoredProduct, AMPLIFIER_ARCHITECTURE_TENDENCIES, type ArchitectureTendency } from './product-scoring';
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
  // Budget queries use the standard diversity or score-ranked selection.
  const hasSparseSignals = Object.keys(userTraits).length < 2;
  const top = budgetAmount === null
    ? selectTieredExploratory(ranked)
    : hasSparseSignals
      ? selectDiverseByTopology(ranked, 3)
      : ranked.slice(0, 3);

  // Build lowercase set of current component names for matching
  const currentNames = new Set(
    (currentComponentNames ?? []).map((n) => n.toLowerCase()),
  );

  return top.map(({ product }) => {
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
      // Flag when this is the user's current component
      isCurrentComponent: isCurrent || undefined,
    };
  });
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
): ScoredProduct[] {
  if (ranked.length === 0) return [];

  // Clamp target within bounds
  const count = Math.max(MIN_SHORTLIST, Math.min(target, MAX_SHORTLIST));

  // Group by topology, keeping only top-scoring entries per topology.
  // Within each topology group, prefer higher price (more refined design).
  const byTopology = new Map<string, ScoredProduct>();
  const topScore = ranked[0].score;
  const scoreTolerance = 0.5; // entries within 0.5 of the top are considered competitive

  for (const entry of ranked) {
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
    for (const entry of ranked) {
      if (selected.length >= count) break;
      if (selected.includes(entry)) continue;
      if (entry.score < pass2Floor) break; // ranked is sorted; stop early
      if (!usedBrands.has(entry.product.brand.toLowerCase())) {
        selected.push(entry);
        usedBrands.add(entry.product.brand.toLowerCase());
      }
    }
  }

  // Pass 3: last resort — fill from ranked list
  if (selected.length < count) {
    for (const entry of ranked) {
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
    'Each approach has trade-offs. The right choice depends on your listening priorities and how the component interacts with the rest of your system.',
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
    bullets.push(`Your preference for ${tasteLabel} shaped the selection toward designs that prioritize those qualities.`);
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
      bullets.push(`Your ${archetypePhrase} listening style informed the range of design approaches included here.`);
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
    bullets.push('The shortlist spans different design philosophies so you can compare how each approach interacts with your priorities.');
  }

  // 5. Budget alignment
  if (ctx.budgetAmount && products.length > 0) {
    const prices = products.filter((p) => p.price > 0).map((p) => p.price);
    if (prices.length >= 2) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (max <= ctx.budgetAmount && min < ctx.budgetAmount * 0.7) {
        bullets.push(`Options range from $${min.toLocaleString()} to $${max.toLocaleString()}, giving room to allocate budget elsewhere in the chain if needed.`);
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

  return `These options represent different sonic directions that could work well given ${parts.join(' and ')}.`;
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
  const productExamples = selectProductExamples(ctx.category, traits, ctx.budgetAmount, ctx.systemProfile, ctx.dependencies, tasteProfile, reasoning, activeSystemComponents);

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
  const refinementPrompts = provisional ? buildRefinementPrompts(gaps, ctx.category) : [];

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

