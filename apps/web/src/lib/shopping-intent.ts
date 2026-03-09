/**
 * Shopping-intent detection and context extraction.
 *
 * Recognises buying / upgrade questions, extracts what context the user
 * has already provided (budget, category, taste, system, use-case),
 * and returns 1–2 targeted follow-up questions before handing off to
 * the evaluation engine.
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

export interface ShoppingContext {
  /** Was shopping intent detected? */
  detected: boolean;
  /** What category are they shopping for? */
  category: ShoppingCategory;
  /** Did they specify a price or budget? */
  budgetMentioned: boolean;
  /** Did they express sonic preferences (≥2 symptoms)? */
  tasteProvided: boolean;
  /** Did they mention current gear or system? */
  systemProvided: boolean;
  /** Did they mention a use-case (e.g. near-field, low volume)? */
  useCaseProvided: boolean;
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
      category: 'general',
      budgetMentioned: false,
      tasteProvided: false,
      systemProvided: false,
      useCaseProvided: false,
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

  // 3. Budget
  const budgetMentioned = BUDGET_PATTERNS.some((re) => re.test(userText));

  // 4. Taste — reuse engine output (≥2 symptoms = meaningful taste signal)
  const tasteProvided = signals.symptoms.length >= 2;

  // 5. System / gear context
  const systemProvided = SYSTEM_KEYWORDS.some((kw) => lower.includes(kw));

  // 6. Use-case
  const useCaseProvided = USE_CASE_KEYWORDS.some((kw) => lower.includes(kw));

  return {
    detected,
    category,
    budgetMentioned,
    tasteProvided,
    systemProvided,
    useCaseProvided,
  };
}

// ── Category-specific question fragments ──────────────

const TASTE_QUESTIONS: Record<ShoppingCategory, string> = {
  dac: 'Do you value flow, sweetness, and low fatigue — or clarity, speed, and attack?',
  amplifier: 'Do you prefer rhythmic drive and engagement, or composure and refinement?',
  speakers: 'Do you prioritize soundstage scale and air, or density and intimacy?',
  headphones: 'Do you lean toward warmth and immersion, or detail and separation?',
  streamer: 'Is the streamer your main source, or a transport feeding an external DAC?',
  general: 'What does your current system do well that you want to preserve?',
};

const SYSTEM_QUESTIONS: Record<ShoppingCategory, string> = {
  dac: 'What is the DAC feeding into right now — what amp and speakers?',
  amplifier: 'What source and speakers is the amplifier working with?',
  speakers: 'What amp and source are driving the speakers?',
  headphones: 'What DAC or source will be driving the headphones?',
  streamer: 'What DAC is the streamer connected to?',
  general: 'What component do you currently suspect is limiting the system most?',
};

// ── Question selection ────────────────────────────────

/**
 * Returns a targeted follow-up question (or null if enough context
 * is already present for the engine to produce useful guidance).
 */
export function getShoppingClarification(ctx: ShoppingContext): string | null {
  if (!ctx.detected) return null;

  const { category, tasteProvided, systemProvided } = ctx;

  // Both taste and system missing → ask both
  if (!tasteProvided && !systemProvided) {
    if (category === 'general') {
      return (
        'To narrow that down well:\n' +
        `1. ${TASTE_QUESTIONS[category]}\n` +
        `2. ${SYSTEM_QUESTIONS[category]}`
      );
    }
    return (
      'Before recommending a direction, two things matter most:\n' +
      `1. ${TASTE_QUESTIONS[category]}\n` +
      `2. ${SYSTEM_QUESTIONS[category]}`
    );
  }

  // Only taste missing
  if (!tasteProvided) {
    return TASTE_QUESTIONS[category];
  }

  // Only system missing
  if (!systemProvided) {
    return SYSTEM_QUESTIONS[category];
  }

  // Everything provided (budget missing is fine — it narrows later)
  return null;
}
