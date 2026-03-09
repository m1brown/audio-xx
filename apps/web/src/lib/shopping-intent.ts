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
import type { ExtractedSignals } from './signal-types';

// ── Types ─────────────────────────────────────────────

export type ShoppingCategory =
  | 'dac'
  | 'amplifier'
  | 'speakers'
  | 'headphones'
  | 'streamer'
  | 'general';

export type ShoppingMode =
  | 'specific-component'
  | 'upgrade-path'
  | 'build-a-system';

export interface ShoppingContext {
  detected: boolean;
  mode: ShoppingMode;
  category: ShoppingCategory;
  budgetMentioned: boolean;
  tasteProvided: boolean;
  systemProvided: boolean;
  useCaseProvided: boolean;
  preserveProvided: boolean;
  limitingProvided: boolean;
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
    category: 'speakers',
    keywords: ['speaker', 'speakers', 'monitors', 'bookshelf', 'floorstanding', 'floor-standing'],
  },
  {
    category: 'headphones',
    keywords: ['headphone', 'headphones', 'iem', 'iems', 'earphone', 'earphones', 'cans'],
  },
  {
    category: 'streamer',
    keywords: ['streamer', 'transport', 'network player', 'renderer'],
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
      tasteProvided: false,
      systemProvided: false,
      useCaseProvided: false,
      preserveProvided: false,
      limitingProvided: false,
    };
  }

  // 2. Category
  let category: ShoppingCategory = 'general';
  for (const pat of CATEGORY_PATTERNS) {
    if (pat.keywords.some((kw) => lower.includes(kw))) {
      category = pat.category;
      break;
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
  const tasteProvided = signals.symptoms.length >= 2;
  const systemProvided = SYSTEM_KEYWORDS.some((kw) => lower.includes(kw));
  const useCaseProvided = USE_CASE_KEYWORDS.some((kw) => lower.includes(kw));
  const preserveProvided = PRESERVE_KEYWORDS.some((kw) => lower.includes(kw));
  const limitingProvided = LIMITING_KEYWORDS.some((kw) => lower.includes(kw));

  return {
    detected,
    mode,
    category,
    budgetMentioned,
    tasteProvided,
    systemProvided,
    useCaseProvided,
    preserveProvided,
    limitingProvided,
  };
}

// ── Question templates ────────────────────────────────

const TASTE_QUESTIONS: Record<ShoppingCategory, string> = {
  dac: 'Do you value flow, sweetness, and low fatigue — or clarity, speed, and attack?',
  amplifier: 'Do you prefer rhythmic drive and engagement, or composure and refinement?',
  speakers: 'Do you prioritize soundstage scale and air, or density and intimacy?',
  headphones: 'Do you lean toward warmth and immersion, or detail and separation?',
  streamer: 'Is the streamer your main source, or a transport feeding an external DAC?',
  general: 'What kind of presentation do you tend to enjoy — lively and engaging, or smooth and composed?',
};

const SYSTEM_QUESTIONS: Record<ShoppingCategory, string> = {
  dac: 'What is the DAC feeding into right now — what amp and speakers?',
  amplifier: 'What source and speakers is the amplifier working with?',
  speakers: 'What amp and source are driving the speakers?',
  headphones: 'What DAC or source will be driving the headphones?',
  streamer: 'What DAC is the streamer connected to?',
  general: 'What does your current system look like — source, amplification, and speakers or headphones?',
};

const PRESERVE_QUESTION =
  'What does your current system do well that you want to keep?';

const LIMITING_QUESTION =
  'What feels most limiting or unsatisfying about what you hear right now?';

const USE_CASE_QUESTION =
  'Will this be a headphone setup, a speaker system, or both?';

const NEW_USED_QUESTION =
  'Are you open to used or ex-demo gear, or do you prefer buying new?';

// ── Question sequences per mode ───────────────────────

interface QuestionStep {
  /** Context key to check — if already provided, skip this step. */
  key: keyof ShoppingContext;
  /** Returns the question string for this step. */
  question: (ctx: ShoppingContext) => string;
}

const SPECIFIC_COMPONENT_SEQUENCE: QuestionStep[] = [
  {
    key: 'tasteProvided',
    question: (ctx) => TASTE_QUESTIONS[ctx.category],
  },
  {
    key: 'systemProvided',
    question: (ctx) => SYSTEM_QUESTIONS[ctx.category],
  },
];

const UPGRADE_PATH_SEQUENCE: QuestionStep[] = [
  {
    key: 'preserveProvided',
    question: () => PRESERVE_QUESTION,
  },
  {
    key: 'limitingProvided',
    question: () => LIMITING_QUESTION,
  },
  {
    key: 'systemProvided',
    question: (ctx) => SYSTEM_QUESTIONS[ctx.category],
  },
];

const BUILD_A_SYSTEM_SEQUENCE: QuestionStep[] = [
  {
    key: 'useCaseProvided',
    question: () => USE_CASE_QUESTION,
  },
  {
    key: 'tasteProvided',
    question: (ctx) => TASTE_QUESTIONS[ctx.category],
  },
  {
    key: 'budgetMentioned',
    question: () => NEW_USED_QUESTION,
  },
];

const SEQUENCES: Record<ShoppingMode, QuestionStep[]> = {
  'specific-component': SPECIFIC_COMPONENT_SEQUENCE,
  'upgrade-path': UPGRADE_PATH_SEQUENCE,
  'build-a-system': BUILD_A_SYSTEM_SEQUENCE,
};

// ── Turn caps per mode ────────────────────────────────

const TURN_CAPS: Record<ShoppingMode, number> = {
  'specific-component': 2,
  'upgrade-path': 2,
  'build-a-system': 3,
};

/** Returns the maximum number of inquiry turns for the detected mode. */
export function getShoppingTurnCap(mode: ShoppingMode): number {
  return TURN_CAPS[mode];
}

// ── Answer-readiness ──────────────────────────────────

/**
 * Returns true when the gathered context is sufficient for a
 * non-generic recommendation in the detected shopping mode.
 */
export function isAnswerReady(ctx: ShoppingContext): boolean {
  if (!ctx.detected) return true; // not shopping — let the engine handle it

  switch (ctx.mode) {
    case 'specific-component':
      return (
        ctx.category !== 'general' &&
        ctx.budgetMentioned &&
        ctx.tasteProvided &&
        ctx.systemProvided
      );

    case 'upgrade-path':
      return (
        ctx.budgetMentioned &&
        ctx.preserveProvided &&
        ctx.limitingProvided &&
        ctx.systemProvided
      );

    case 'build-a-system':
      return (
        ctx.useCaseProvided &&
        ctx.budgetMentioned &&
        ctx.tasteProvided
      );
  }
}

// ── Question selection ────────────────────────────────

/**
 * Returns the next follow-up question for the detected shopping mode,
 * or null if enough context has been gathered.
 *
 * Questions are asked one at a time in the mode's priority order.
 * Steps are skipped when the user has already provided that context.
 *
 * Returns null (triggering answer mode) when:
 *   1. All required context is present (isAnswerReady), OR
 *   2. The per-mode turn cap is reached (provisional best-effort), OR
 *   3. No more questions remain in the sequence.
 *
 * @param ctx       - Shopping context derived from all user text so far
 * @param turnCount - Number of user submissions (1-indexed)
 */
export function getShoppingClarification(
  ctx: ShoppingContext,
  turnCount: number,
): string | null {
  if (!ctx.detected) return null;

  // Early exit: enough context gathered — go straight to answer
  if (isAnswerReady(ctx)) return null;

  // Turn cap: provide provisional direction with what we have
  const cap = TURN_CAPS[ctx.mode];
  if (turnCount >= cap) return null;

  const sequence = SEQUENCES[ctx.mode];

  // Walk the priority list, return the first question whose context is missing
  for (const step of sequence) {
    if (!ctx[step.key]) {
      return step.question(ctx);
    }
  }

  // Sequence exhausted — answer with what we have
  return null;
}
